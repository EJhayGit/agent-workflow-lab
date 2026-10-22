import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initProject, loadConfig } from '../src/config.js';
import { JsonVerificationStore } from '../src/storage/verification.js';
import { verifyProject } from '../src/verification/engine.js';
import { verificationRecordSchema } from '../src/verification/records.js';
import type { VerificationRecord } from '../src/verification/records.js';
import type { VerificationStore } from '../src/storage/verification.js';

describe('verification lifecycle and persistence', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), 'awl-verify-')); await initProject(root); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });
  async function configure(checks: unknown[]) {
    await writeFile(path.join(root, 'agentlab.config.json'), JSON.stringify({ version: 1, storageDir: '.agentlab', verification: { checks } }));
    return loadConfig(root);
  }
  function check(id: string, code: number, required = true) {
    return { id, name: id, executable: 'node', args: ['-e', `console.log("${id}");process.exitCode=${code}`], required };
  }

  it('persists initial and per-check evidence, including a required failure and later success', async () => {
    const config = await configure([check('fail', 4), check('pass', 0)]);
    const store = new JsonVerificationStore(root, config.storageDir);
    const snapshots: VerificationRecord[] = [];
    const recording: VerificationStore = { list: () => store.list(), save: async (record) => {
      snapshots.push(structuredClone(record)); await store.save(record);
    } };
    const result = await verifyProject(root, config, recording);
    expect(result).toMatchObject({ status: 'completed', verdict: 'FAILED' });
    expect(result.checks.map((item) => item.status)).toEqual(['FAILED', 'PASSED']);
    expect(snapshots).toHaveLength(4);
    expect(snapshots[0]).toMatchObject({ status: 'incomplete', verdict: 'BLOCKED', finishedAt: null });
    expect(snapshots[1]?.checks[0]).toMatchObject({ status: 'FAILED', exitCode: 4 });
    expect(snapshots[2]?.verdict).toBe('FAILED');
    expect((await store.list()).records).toEqual([result]);
    const files = await readdir(path.join(root, '.agentlab', 'verifications'));
    expect(files).toEqual([`${result.id}.json`]);
  });

  it('passes required gates without hiding optional failure', async () => {
    const config = await configure([check('required', 0), check('optional', 9, false)]);
    const result = await verifyProject(root, config, new JsonVerificationStore(root, config.storageDir));
    expect(result.verdict).toBe('PASSED');
    expect(result.checks[1]).toMatchObject({ required: false, status: 'FAILED', exitCode: 9 });
  });

  it('records no configuration as NOT_RUN, without automatic script discovery', async () => {
    const config = await loadConfig(root);
    const result = await verifyProject(root, config, new JsonVerificationStore(root, config.storageDir));
    expect(result).toMatchObject({ verdict: 'NOT_RUN', status: 'completed', checks: [] });
  });

  it('preserves the required policy snapshot across later configuration changes', async () => {
    let config = await configure([check('gate', 3)]);
    const store = new JsonVerificationStore(root, config.storageDir);
    const original = await verifyProject(root, config, store);
    const file = path.join(root, '.agentlab', 'verifications', `${original.id}.json`);
    const evidence = await readFile(file, 'utf8');
    config = await configure([check('gate', 0, false)]);
    await verifyProject(root, config, store);
    expect(await readFile(file, 'utf8')).toBe(evidence);
    expect((await store.list()).records).toHaveLength(2);
  });

  it('retains valid history and reports corrupt or falsified verdicts', async () => {
    const config = await configure([check('gate', 2)]);
    const store = new JsonVerificationStore(root, config.storageDir);
    const record = await verifyProject(root, config, store);
    expect(verificationRecordSchema.safeParse({ ...record, verdict: 'PASSED' }).success).toBe(false);
    const missingPolicy = structuredClone(record) as unknown as { checks: Array<Record<string, unknown>> };
    delete missingPolicy.checks[0]!.required;
    expect(verificationRecordSchema.safeParse(missingPolicy).success).toBe(false);
    await writeFile(path.join(root, '.agentlab', 'verifications', 'broken.json'), '{');
    const history = await store.list();
    expect(history.records).toEqual([record]);
    expect(history.warnings).toHaveLength(1);
  });

  it('does not execute checks when initial persistence fails', async () => {
    const marker = path.join(root, 'must-not-exist');
    const config = await configure([{ id: 'write', name: 'Write', executable: 'node', args: ['-e', 'require("node:fs").writeFileSync(process.argv[1],"bad")', marker] }]);
    const store: VerificationStore = { save: async () => { throw new Error('disk full'); }, list: async () => ({ records: [], warnings: [] }) };
    await expect(verifyProject(root, config, store)).rejects.toThrow('disk full');
    await expect(readFile(marker)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('leaves an incomplete record if final persistence fails', async () => {
    const config = await configure([check('gate', 0)]);
    const store = new JsonVerificationStore(root, config.storageDir);
    const failing: VerificationStore = { list: () => store.list(), save: async (record) => {
      if (record.status === 'completed') throw new Error('final save failed');
      await store.save(record);
    } };
    await expect(verifyProject(root, config, failing)).rejects.toThrow('final save failed');
    expect((await store.list()).records[0]).toMatchObject({ status: 'incomplete', verdict: 'BLOCKED' });
  });

  it('does not start another check when a result checkpoint cannot be saved', async () => {
    const marker = path.join(root, 'must-not-exist');
    const config = await configure([check('first', 0), {
      id: 'later', name: 'Later', executable: 'node', args: ['-e', 'require("node:fs").writeFileSync(process.argv[1],"bad")', marker],
    }]);
    const store = new JsonVerificationStore(root, config.storageDir);
    let writes = 0;
    const failing: VerificationStore = { list: () => store.list(), save: async (record) => {
      if (++writes > 1) throw new Error('checkpoint failed');
      await store.save(record);
    } };
    await expect(verifyProject(root, config, failing)).rejects.toThrow('checkpoint failed');
    await expect(readFile(marker)).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await store.list()).records[0]).toMatchObject({ status: 'incomplete', verdict: 'BLOCKED' });
  });

  it('records cancellation and skipped later checks without a passing verdict', async () => {
    const config = await configure([
      { id: 'wait', name: 'Wait', executable: 'node', args: ['-e', 'setInterval(()=>{},1000)'] }, check('later', 0),
    ]);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 400);
    try {
      const result = await verifyProject(root, config, new JsonVerificationStore(root, config.storageDir), controller.signal);
      expect(result.verdict).toBe('BLOCKED');
      expect(result.checks.map((item) => item.status)).toEqual(['INTERRUPTED', 'SKIPPED']);
    } finally { clearTimeout(timer); }
  });

  it.runIf(process.platform === 'win32')('records cleanup failure and does not start later checks', async () => {
    const marker = path.join(root, 'started');
    const config = await configure([
      { id: 'wait', name: 'Wait', executable: 'node', args: ['-e', 'require("node:fs").writeFileSync(process.argv[1],"ready");setInterval(()=>{},1000)', marker], required: false, timeoutMs: 5000 },
      check('later', 0),
    ]);
    const original = process.env.SystemRoot;
    const controller = new AbortController();
    const verification = verifyProject(root, config, new JsonVerificationStore(root, config.storageDir), controller.signal);
    try {
      // Wait for real startup before making the cleanup helper unavailable.
      // A child that inherits an invalid SystemRoot cannot initialize Node on Windows.
      const deadline = Date.now() + 4000;
      while (true) {
        try { await readFile(marker); break; }
        catch (error) {
          if (Date.now() > deadline) throw error;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
      process.env.SystemRoot = root;
      controller.abort();
      const result = await verification;
      expect(result.verdict).toBe('BLOCKED');
      expect(result.checks[0]?.status).toBe('INTERRUPTED');
      expect(result.checks[0]?.cleanupError).toMatch(/could not be confirmed/);
      expect(result.checks[1]).toMatchObject({ status: 'SKIPPED', startedAt: null });
    } finally {
      if (original === undefined) delete process.env.SystemRoot;
      else process.env.SystemRoot = original;
      controller.abort();
      await verification;
    }
  });
});

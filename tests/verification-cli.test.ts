import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
describe('built verification CLI', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), 'awl-verify-cli space-')); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });
  function command(...args: string[]) {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', timeout: 12_000 });
    if (result.error) throw result.error;
    return { code: result.status, out: result.stdout, err: result.stderr };
  }
  async function configure(checks: unknown[]) {
    await writeFile(path.join(root, 'agentlab.config.json'), JSON.stringify({ version: 1, storageDir: '.agentlab', verification: { checks } }));
  }
  function check(id: string, code: number, required = true) {
    return { id, name: id, executable: 'node', args: ['-e', `console.log("${id} output");process.exitCode=${code}`], required };
  }

  it('passes required verification while showing optional failures and retaining M1 semantics', async () => {
    await configure([check('required', 0), check('optional', 5, false)]);
    const result = command('verify');
    expect(result.code).toBe(0);
    expect(result.out).toContain('verdict: PASSED');
    expect(result.out).toContain('optional | optional | FAILED');
    expect(command('run', 'still a mock', '--mock').code).toBe(0);
    const report = command('report');
    expect(report.code).toBe(0);
    expect(report.out).toContain('verdict: PASSED');
    expect(report.out).toContain('SIMULATED');
    expect(report.out).toContain('verification: not_run');
  });

  it('returns 1 for a required failure and persists original evidence', async () => {
    await configure([check('required', 8)]);
    const result = command('verify');
    expect(result.code).toBe(1);
    expect(result.out).toContain('verdict: FAILED');
    const files = await readdir(path.join(root, '.agentlab', 'verifications'));
    const record = JSON.parse(await readFile(path.join(root, '.agentlab', 'verifications', files[0]!), 'utf8'));
    expect(record).toMatchObject({ verdict: 'FAILED', status: 'completed' });
    expect(record.checks[0]).toMatchObject({ required: true, exitCode: 8, status: 'FAILED', stdout: 'required output\n' });
    expect(command('report').out).toContain('verdict: FAILED');
  });

  it('returns BLOCKED and exit 2 for startup failures and timeouts', async () => {
    for (const settings of [
      { executable: 'awl-missing-command-32984', args: [] },
      { executable: 'node', args: ['-e', 'setInterval(()=>{},1000)'], timeoutMs: 200 },
    ]) {
      await configure([{ id: 'gate', name: 'Gate', ...settings }]);
      const result = command('verify');
      expect(result.code).toBe(2);
      expect(result.out).toContain('verdict: BLOCKED');
    }
  });

  it('returns NOT_RUN and exit 2 for absent or empty checks', async () => {
    expect(command('init').code).toBe(0);
    for (const empty of [undefined, []]) {
      if (empty) await configure(empty);
      const result = command('verify');
      expect(result.code).toBe(2);
      expect(result.out).toContain('verdict: NOT_RUN');
      expect(result.out).toContain('No checks configured');
    }
  });

  it('rejects malformed verification configuration before creating history', async () => {
    await configure([{ ...check('gate', 0), cwd: '../outside' }]);
    const result = command('verify');
    expect(result.code).toBe(1);
    expect(result.err).toContain('Invalid configuration');
    await expect(readdir(path.join(root, '.agentlab'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('reports corrupt verification history without hiding valid mock or check records', async () => {
    await configure([check('gate', 0)]);
    expect(command('verify').code).toBe(0);
    expect(command('run', 'mock', '--mock').code).toBe(0);
    await writeFile(path.join(root, '.agentlab', 'verifications', 'broken.json'), '{');
    const result = command('report');
    expect(result.code).toBe(2);
    expect(result.out).toContain('SIMULATED');
    expect(result.out).toContain('verdict: PASSED');
    expect(result.err).toContain('broken.json');
  });

  it('handles a SIGINT event, persists interrupted evidence, and exits 130', async () => {
    const marker = path.join(root, 'started');
    const preload = path.join(root, 'signal-fixture.cjs');
    // Deliver the Node signal event via IPC so the same handler can be exercised
    // on Windows, where child.kill(SIGINT) forcibly terminates the target process.
    await writeFile(preload, 'process.once("message",()=>{process.disconnect();process.emit("SIGINT")})');
    await configure([{ id: 'wait', name: 'Wait', executable: 'node', args: ['-e',
      'require("node:fs").writeFileSync(process.argv[1],"ready");setInterval(()=>{},1000)', marker] }]);
    const child = spawn(process.execPath, ['--require', preload, cli, 'verify'], {
      cwd: root, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true,
    });
    let output = '';
    let errors = '';
    child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr?.on('data', (chunk: Buffer) => { errors += chunk.toString(); });
    const finished = new Promise<number | null>((resolve, reject) => {
      child.once('error', reject); child.once('close', (code) => resolve(code));
    });
    const deadline = Date.now() + 5000;
    const watchdog = setTimeout(() => { child.kill(); }, 8000);
    try {
      while (true) {
        try { await readFile(marker); break; }
        catch (error) {
          if (Date.now() > deadline) throw error;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
      child.send('interrupt');
      expect(await finished).toBe(130);
      expect(errors).toBe('');
      expect(output).toContain('verdict: BLOCKED');
      expect(output).toContain('INTERRUPTED');
      expect(command('report').out).toContain('INTERRUPTED');
    } finally {
      clearTimeout(watchdog);
      if (child.exitCode === null && child.signalCode === null) child.kill();
      await finished;
    }
  });
});

import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JsonRunStore } from '../src/storage/json.js';
import { runRecordSchema } from '../src/records.js';
import type { RunRecord } from '../src/records.js';

function record(): RunRecord {
  return { version: 1, id: randomUUID(), task: 'example', adapter: 'mock', simulated: true,
    verification: 'not_run', status: 'incomplete', startedAt: new Date().toISOString(),
    finishedAt: null, durationMs: null, output: '', error: null };
}

describe('JSON history', () => {
  let root: string;
  let store: JsonRunStore;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'awl-store-'));
    store = new JsonRunStore(root, '.agentlab');
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it('treats missing history as empty', async () => {
    expect(await store.list()).toEqual({ records: [], warnings: [] });
  });

  it('round trips records and atomically replaces their state', async () => {
    const value = record();
    await store.save(value);
    const final: RunRecord = { ...value, status: 'succeeded', finishedAt: new Date().toISOString(), durationMs: 2 };
    await store.save(final);
    expect(await store.list()).toEqual({ records: [final], warnings: [] });
    const files = await readdir(path.join(root, '.agentlab', 'runs'));
    expect(files).toEqual([`${value.id}.json`]);
    expect(JSON.parse(await readFile(path.join(root, '.agentlab', 'runs', files[0]!), 'utf8'))).toEqual(final);
  });

  it('keeps valid history while reporting malformed and mismatched records', async () => {
    const valid = record();
    await store.save(valid);
    const dir = path.join(root, '.agentlab', 'runs');
    await writeFile(path.join(dir, 'broken.json'), '{');
    await writeFile(path.join(dir, `${randomUUID()}.json`), JSON.stringify(valid));
    await writeFile(path.join(dir, 'ignored.tmp'), 'unfinished');
    const result = await store.list();
    expect(result.records).toEqual([valid]);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings.join(' ')).toMatch(/broken.json/);
  });

  it('keeps concurrent distinct records and sorts newest first', async () => {
    const older = { ...record(), startedAt: '2026-01-01T00:00:00.000Z' };
    const newer = { ...record(), startedAt: '2026-01-02T00:00:00.000Z' };
    await Promise.all([store.save(older), store.save(newer)]);
    expect((await store.list()).records).toEqual([newer, older]);
  });

  it('sorts timestamps by time even when their fractional precision differs', async () => {
    const older = { ...record(), startedAt: '2026-01-01T00:00:00Z' };
    const newer = { ...record(), startedAt: '2026-01-01T00:00:00.123Z' };
    await store.save(older);
    await store.save(newer);
    expect((await store.list()).records).toEqual([newer, older]);
  });

  it('warns about schema-invalid records and linked entries without losing valid history', async () => {
    const valid = record();
    await store.save(valid);
    const dir = path.join(root, '.agentlab', 'runs');
    await writeFile(path.join(dir, `${randomUUID()}.json`), JSON.stringify({ ...record(), status: 'succeeded' }));
    const target = path.join(root, 'target');
    await mkdir(target);
    await symlink(target, path.join(dir, `${randomUUID()}.json`), process.platform === 'win32' ? 'junction' : 'dir');
    const history = await store.list();
    expect(history.records).toEqual([valid]);
    expect(history.warnings).toHaveLength(2);
    expect(history.warnings.join(' ')).toMatch(/symbolic link|junction/);
  });

  it('rejects path traversal and invalid lifecycle data before writing', async () => {
    await expect(store.save({ ...record(), id: '../escape' })).rejects.toThrow();
    expect(runRecordSchema.safeParse({ ...record(), status: 'succeeded' }).success).toBe(false);
    expect(runRecordSchema.safeParse({ ...record(), status: 'failed', finishedAt: new Date().toISOString(), durationMs: 0 }).success).toBe(false);
    expect(runRecordSchema.safeParse({ ...record(), durationMs: -1 }).success).toBe(false);
  });

  it('does not follow a linked runs directory or linked history record', async () => {
    const target = path.join(root, 'target');
    await mkdir(target);
    await mkdir(path.join(root, '.agentlab'));
    await symlink(target, path.join(root, '.agentlab', 'runs'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(store.save(record())).rejects.toThrow(/symbolic link|junction/);
    await expect(store.list()).rejects.toThrow(/symbolic link|junction/);
  });

  it('reports a storage directory replaced by a file as an I/O error', async () => {
    await writeFile(path.join(root, '.agentlab'), 'blocked');
    await expect(store.list()).rejects.toThrow();
    await expect(store.save(record())).rejects.toThrow();
  });
});

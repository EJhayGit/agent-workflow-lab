import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));

describe('built CLI subprocesses', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), 'awl-cli space-')); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });
  function command(...args: string[]) {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: root, encoding: 'utf8', timeout: 10_000,
    });
    if (result.error) throw result.error;
    return { code: result.status, out: result.stdout, err: result.stderr };
  }

  it('initializes, executes a literal task, and reports durable simulated evidence', async () => {
    expect(command('init')).toMatchObject({ code: 0 });
    const task = 'example task; $(echo unsafe) `quoted` & > sentinel.txt';
    const run = command('run', task, '--mock');
    expect(run.code).toBe(0);
    expect(run.out).toContain('SIMULATED');
    expect(run.out).toContain('verification: not_run');
    expect(run.out).toContain(task);
    const report = command('report');
    expect(report).toMatchObject({ code: 0, err: '' });
    expect(report.out).toContain('succeeded');
    expect(report.out).toContain('SIMULATED');
    expect(report.out).toContain(task);
    const names = await readdir(path.join(root, '.agentlab', 'runs'));
    expect(names).toHaveLength(1);
    const record = JSON.parse(await readFile(path.join(root, '.agentlab', 'runs', names[0]!), 'utf8'));
    expect(record).toMatchObject({ task, simulated: true, adapter: 'mock', status: 'succeeded', verification: 'not_run' });
    expect(await readdir(root)).not.toContain('sentinel.txt');
  });

  it('fails repeated init without modifying configuration', async () => {
    expect(command('init').code).toBe(0);
    const original = await readFile(path.join(root, 'agentlab.config.json'), 'utf8');
    expect(command('init')).toMatchObject({ code: 1, out: '' });
    expect(await readFile(path.join(root, 'agentlab.config.json'), 'utf8')).toBe(original);
  });

  it('explains uninitialized projects and has no stack trace', () => {
    for (const args of [['run', 'task', '--mock'], ['report']]) {
      const result = command(...args);
      expect(result.code).toBe(1);
      expect(result.err).toContain('agentlab init');
      expect(result.err).not.toContain('at file:');
    }
  });

  it('requires --mock, a nonempty task, and valid command syntax', () => {
    for (const args of [['run', 'task'], ['run', '  ', '--mock'], ['run', '--mock'],
      ['unknown'], ['report', '--unknown'], ['run', 'task', '--mock', 'extra']]) {
      expect(command(...args).code).toBe(1);
    }
  });

  it('reports empty or missing history without claiming an execution', () => {
    expect(command('init').code).toBe(0);
    expect(command('report')).toMatchObject({ code: 0, out: 'No executions recorded.\n' });
  });

  it('fails on invalid config rather than silently using defaults', async () => {
    await writeFile(path.join(root, 'agentlab.config.json'), JSON.stringify({ version: 99 }));
    const result = command('run', 'task', '--mock');
    expect(result.code).toBe(1);
    expect(result.err).toContain('Invalid configuration');
    expect(await readdir(root)).toEqual(['agentlab.config.json']);
  });

  it('uses configurable storage and returns degraded status for damaged history', async () => {
    await writeFile(path.join(root, 'agentlab.config.json'), JSON.stringify({ version: 1, storageDir: 'custom/history' }));
    expect(command('run', 'task', '--mock').code).toBe(0);
    await writeFile(path.join(root, 'custom/history/runs/broken.json'), '{');
    const result = command('report');
    expect(result.code).toBe(2);
    expect(result.out).toContain('succeeded');
    expect(result.err).toContain('broken.json');
    expect(result.err).toContain('Warning');
  });

  it('shows incomplete and failed states without converting them into success', async () => {
    expect(command('init').code).toBe(0);
    expect(command('run', 'task', '--mock').code).toBe(0);
    const dir = path.join(root, '.agentlab/runs');
    const names = await readdir(dir);
    const file = path.join(dir, names[0]!);
    const value = JSON.parse(await readFile(file, 'utf8'));
    await writeFile(file, JSON.stringify({ ...value, status: 'incomplete', finishedAt: null, durationMs: null }));
    const incomplete = command('report');
    expect(incomplete.code).toBe(2);
    expect(incomplete.out).toContain('incomplete');
    expect(incomplete.out).not.toContain('succeeded');
    await writeFile(file, JSON.stringify({ ...value, status: 'failed', error: 'agent failure' }));
    const failed = command('report');
    expect(failed.code).toBe(0);
    expect(failed.out).toContain('failed');
    expect(failed.out).toContain('agent failure');
    expect(failed.out).not.toContain('succeeded');
  });

  it('fails on storage I/O conflicts without claiming success', async () => {
    expect(command('init').code).toBe(0);
    await mkdir(path.join(root, '.agentlab'));
    await writeFile(path.join(root, '.agentlab', 'runs'), 'conflict');
    const result = command('run', 'task', '--mock');
    expect(result.code).toBe(1);
    expect(result.out).not.toContain('succeeded');
    expect(result.err).toMatch(/directory/);
  });

  it('prints help and version successfully', async () => {
    expect(command('--help')).toMatchObject({ code: 0 });
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    expect(command('--version')).toMatchObject({ code: 0, out: `${pkg.version}\n` });
  });
});

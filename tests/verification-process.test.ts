import { access, mkdtemp, mkdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkConfigSchema } from '../src/verification/config.js';
import { executeCheck } from '../src/verification/process.js';
import { OUTPUT_LIMIT_BYTES } from '../src/verification/records.js';

describe('verification subprocess evidence', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), 'awl-check space-')); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });
  function check(script: string, settings: Record<string, unknown> = {}) {
    return checkConfigSchema.parse({ id: 'fixture', name: 'Harmless local fixture', executable: 'node', args: ['-e', script], ...settings });
  }

  it('captures separate streams and a successful exit without a shell', async () => {
    const literal = 'spaces "quotes" & | > $(echo nope) %PATH%';
    const result = await executeCheck(root, check('process.stdout.write(process.argv[1]);process.stderr.write("diagnostic")', {
      args: ['-e', 'process.stdout.write(process.argv[1]);process.stderr.write("diagnostic")', literal],
    }));
    expect(result).toMatchObject({ status: 'PASSED', exitCode: 0, stdout: literal, stderr: 'diagnostic', error: null, cleanupError: null });
    expect(result.command?.executable).toBe(process.execPath);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records nonzero exit codes and output as a failure', async () => {
    expect(await executeCheck(root, check('console.log("failure evidence"); process.exitCode=7')))
      .toMatchObject({ status: 'FAILED', exitCode: 7, stdout: 'failure evidence\n' });
  });

  it('distinguishes a missing executable from an unsuccessful command', async () => {
    const result = await executeCheck(root, check('', { executable: 'awl-no-such-program-97e23', args: [] }));
    expect(result).toMatchObject({ status: 'EXECUTION_ERROR', exitCode: null });
    expect(result.error).toMatch(/ENOENT|not found/i);
  });

  it('times out and terminates a launched process tree', async () => {
    const marker = path.join(root, 'leaked-child.txt');
    const childScript = 'setTimeout(()=>require("node:fs").writeFileSync(process.argv[1],"leaked"),1600);setInterval(()=>{},1000)';
    const script = `const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e',${JSON.stringify(childScript)},${JSON.stringify(marker)}],{stdio:'inherit'});console.log(child.pid);setInterval(()=>{},1000)`;
    const result = await executeCheck(root, check(script, { timeoutMs: 1000 }));
    expect(result.status).toBe('TIMED_OUT');
    expect(result.cleanupError).toBeNull();
    expect(result.durationMs).toBeLessThan(7000);
    const descendant = Number(result.stdout.trim());
    expect(descendant).toBeGreaterThan(0);
    // On Unix an orphan may briefly remain a zombie; a delayed side effect tests liveness.
    if (process.platform === 'win32') expect(() => process.kill(descendant, 0)).toThrow();
    await new Promise((resolve) => setTimeout(resolve, 1800));
    await expect(access(marker)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('records caller cancellation separately and skips an already cancelled check', async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 400);
    try {
      const result = await executeCheck(root, check('setInterval(()=>{},1000)'), controller.signal);
      expect(result.status).toBe('INTERRUPTED');
      expect(result.cleanupError).toBeNull();
      const skipped = await executeCheck(root, check('throw Error("must not start")'), controller.signal);
      expect(skipped).toMatchObject({ status: 'SKIPPED', startedAt: null, pid: null });
    } finally { clearTimeout(timer); }
  });

  it('bounds both streams while draining all output', async () => {
    const result = await executeCheck(root, check('process.stdout.write("a".repeat(200000));process.stderr.write("b".repeat(180000))'));
    expect(result.status).toBe('PASSED');
    expect(result.stdout).toBe('a'.repeat(OUTPUT_LIMIT_BYTES));
    expect(result.stderr).toBe('b'.repeat(OUTPUT_LIMIT_BYTES));
    expect(result).toMatchObject({ stdoutBytes: 200000, stderrBytes: 180000, stdoutTruncated: true, stderrTruncated: true });
  });

  it('resolves a project-relative cwd and script with spaces', async () => {
    const dir = path.join(root, 'nested space');
    await mkdir(dir);
    await writeFile(path.join(dir, 'local check.cjs'), 'console.log(process.cwd())');
    const result = await executeCheck(root, check('', { cwd: 'nested space', args: ['local check.cjs'] }));
    expect(result.status).toBe('PASSED');
    expect(await realpath(result.stdout.trim())).toBe(await realpath(dir));
  });

  it('resolves the same cwd when the project root has an alias and the child reports a physical path', async () => {
    const directory = path.join(root, 'physical project', 'nested space');
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'local check.cjs'), 'console.log(require("node:fs").realpathSync(process.cwd()))');
    const alias = path.join(root, 'project alias');
    await symlink(path.join(root, 'physical project'), alias, process.platform === 'win32' ? 'junction' : 'dir');
    const logicalDirectory = path.join(alias, 'nested space');
    const result = await executeCheck(alias, check('', { cwd: 'nested space', args: ['local check.cjs'] }));
    expect(result.status).toBe('PASSED');
    expect(result.stdout.trim()).not.toBe(logicalDirectory);
    expect(await realpath(result.stdout.trim())).toBe(await realpath(logicalDirectory));
  });

  it('records missing or linked working directories as execution errors', async () => {
    expect((await executeCheck(root, check('', { cwd: 'absent' }))).status).toBe('EXECUTION_ERROR');
    const target = path.join(root, 'target');
    await mkdir(target);
    await symlink(target, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    const result = await executeCheck(root, check('', { cwd: 'linked' }));
    expect(result.status).toBe('EXECUTION_ERROR');
    expect(result.error).toMatch(/symbolic link|junction/);
  });

  it('does not implicitly invoke a shell for command wrappers', async () => {
    const result = await executeCheck(root, check('', { executable: 'unsafe.cmd', args: ['&', 'echo'] }));
    expect(result.status).toBe('EXECUTION_ERROR');
    expect(result.error).toMatch(/native executable|JavaScript/i);
  });

  it.runIf(process.platform === 'win32')('runs npm through its JavaScript entry point on Windows', async () => {
    const result = await executeCheck(root, check('', { executable: 'npm', args: ['--version'], timeoutMs: 5000 }));
    expect(result.status).toBe('PASSED');
    expect(result.stdout).toMatch(/^\d+\.\d+\.\d+/);
    expect(result.command?.executable).toBe(process.execPath);
    expect(result.command?.args[0]).toMatch(/npm-cli\.js$/);
  });
});

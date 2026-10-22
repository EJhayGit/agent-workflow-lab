import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { errorMessage } from '../errors.js';
import type { CheckConfig } from './config.js';
import { resolveCommand } from './command.js';
import { terminateTree } from './cleanup.js';
import { OUTPUT_LIMIT_BYTES, skippedCheck } from './records.js';
import type { CheckResult, CheckStatus } from './records.js';

function capture() {
  const chunks: Buffer[] = [];
  let retained = 0;
  let total = 0;
  return {
    add(chunk: Buffer) {
      total += chunk.length;
      const available = Math.min(chunk.length, OUTPUT_LIMIT_BYTES - retained);
      if (available > 0) {
        chunks.push(Buffer.from(chunk.subarray(0, available)));
        retained += available;
      }
    },
    text: () => Buffer.concat(chunks).toString('utf8'),
    bytes: () => total,
    truncated: () => total > retained,
  };
}

export async function executeCheck(root: string, check: CheckConfig, signal?: AbortSignal): Promise<CheckResult> {
  if (signal?.aborted) return skippedCheck(check, 'Verification was interrupted before this check started.');
  const base = skippedCheck(check, 'Not started.');
  const start = performance.now();
  const startedAt = new Date().toISOString();
  let resolved: Awaited<ReturnType<typeof resolveCommand>>;
  try { resolved = await resolveCommand(root, check); }
  catch (error) {
    return { ...base, status: 'EXECUTION_ERROR', startedAt, finishedAt: new Date().toISOString(),
      durationMs: performance.now() - start, error: errorMessage(error) };
  }
  if (signal?.aborted) return skippedCheck(check, 'Verification was interrupted before this check started.');
  const command = { executable: resolved.executable, args: resolved.args };
  return new Promise((resolve) => {
    const stdout = capture();
    const stderr = capture();
    let child: ChildProcess;
    try {
      child = spawn(command.executable, command.args, {
        cwd: resolved.cwd, shell: false, windowsHide: true,
        detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({ ...base, command, workingDirectory: resolved.cwd, status: 'EXECUTION_ERROR', startedAt,
        finishedAt: new Date().toISOString(), durationMs: performance.now() - start, error: errorMessage(error) });
      return;
    }
    let finished = false;
    let spawned = false;
    let forced: CheckStatus | undefined;
    let executionError: string | null = null;
    let stopping: Promise<string | null> | undefined;
    let fallback: NodeJS.Timeout | undefined;
    const finish = async (code: number | null, exitSignal: NodeJS.Signals | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      clearTimeout(fallback);
      signal?.removeEventListener('abort', abort);
      const cleanupError = stopping ? await stopping : null;
      const status = forced ?? (executionError ? 'EXECUTION_ERROR' : exitSignal ? 'INTERRUPTED' : code === 0 ? 'PASSED' : code === null ? 'EXECUTION_ERROR' : 'FAILED');
      const reason = status === 'TIMED_OUT' ? `Exceeded timeout of ${check.timeoutMs} ms.`
        : status === 'INTERRUPTED' ? 'Check was interrupted.'
        : executionError ?? (status === 'FAILED' ? `Process exited with code ${code}.` : code === null ? 'No process exit code was available.' : null);
      resolve({ ...base, status, command, workingDirectory: resolved.cwd, pid: child.pid ?? null,
        startedAt, finishedAt: new Date().toISOString(), durationMs: performance.now() - start,
        exitCode: spawned ? code : null, signal: exitSignal, stdout: stdout.text(), stderr: stderr.text(),
        stdoutBytes: stdout.bytes(), stderrBytes: stderr.bytes(),
        stdoutTruncated: stdout.truncated(), stderrTruncated: stderr.truncated(), error: reason, cleanupError });
    };
    const stop = (reason: CheckStatus) => {
      if (finished || stopping) return;
      forced = reason;
      stopping = terminateTree(child).catch((error: unknown) => `Process cleanup failed: ${errorMessage(error)}`);
      // Descendants retaining pipe handles must not keep the harness waiting forever.
      fallback = setTimeout(() => {
        child.stdout?.destroy(); child.stderr?.destroy(); child.kill('SIGKILL'); child.unref();
        const original = stopping;
        stopping = original!.then((error) => error ?? 'Process closure could not be confirmed within the cleanup deadline.');
        void finish(child.exitCode, child.signalCode);
      }, 6000);
    };
    const abort = () => stop('INTERRUPTED');
    const timeout = setTimeout(() => stop('TIMED_OUT'), check.timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    child.stdout?.on('data', (chunk: Buffer) => stdout.add(chunk));
    child.stderr?.on('data', (chunk: Buffer) => stderr.add(chunk));
    const streamError = (error: Error) => { executionError = errorMessage(error); stop('EXECUTION_ERROR'); };
    child.stdout?.on('error', streamError);
    child.stderr?.on('error', streamError);
    child.once('error', (error) => { executionError = errorMessage(error); });
    child.once('spawn', () => { spawned = true; });
    child.once('close', (code, exitSignal) => { void finish(code, exitSignal); });
    if (signal?.aborted) abort();
  });
}

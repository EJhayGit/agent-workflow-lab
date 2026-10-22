import { z } from 'zod';
import { checkConfigSchema } from './config.js';
import type { CheckConfig } from './config.js';

export const OUTPUT_LIMIT_BYTES = 64 * 1024;
const checkStatusSchema = z.enum(['PENDING', 'PASSED', 'FAILED', 'TIMED_OUT', 'EXECUTION_ERROR', 'INTERRUPTED', 'SKIPPED']);
export type CheckStatus = z.infer<typeof checkStatusSchema>;
export type Verdict = 'PASSED' | 'FAILED' | 'BLOCKED' | 'NOT_RUN';

export function aggregateVerdict(results: ReadonlyArray<{ required: boolean; status: CheckStatus; cleanupError?: string | null }>, completed = true): Verdict {
  if (!results.length) return 'NOT_RUN';
  const required = results.filter((result) => result.required);
  if (required.some((result) => result.status === 'FAILED')) return 'FAILED';
  if (results.some((result) => result.cleanupError)) return 'BLOCKED';
  if (required.some((result) => result.status !== 'PASSED')) return 'BLOCKED';
  return completed ? 'PASSED' : 'BLOCKED';
}

export const checkResultSchema = checkConfigSchema.extend({
  // Stored evidence must carry its policy explicitly; config defaults must not repair corruption.
  args: checkConfigSchema.shape.args.removeDefault(),
  required: checkConfigSchema.shape.required.removeDefault(),
  timeoutMs: checkConfigSchema.shape.timeoutMs.removeDefault(),
  cwd: checkConfigSchema.shape.cwd.removeDefault(),
  status: checkStatusSchema,
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
  durationMs: z.number().finite().nonnegative().nullable(),
  command: z.strictObject({ executable: z.string(), args: z.array(z.string()) }).nullable(),
  workingDirectory: z.string().nullable(),
  pid: z.number().int().positive().nullable(),
  exitCode: z.number().int().nullable(),
  signal: z.string().nullable(),
  stdout: z.string().max(OUTPUT_LIMIT_BYTES), stderr: z.string().max(OUTPUT_LIMIT_BYTES),
  stdoutBytes: z.number().int().nonnegative(), stderrBytes: z.number().int().nonnegative(),
  stdoutTruncated: z.boolean(), stderrTruncated: z.boolean(),
  error: z.string().nullable(),
  cleanupError: z.string().nullable(),
}).superRefine((result, context) => {
  const issue = (message: string) => context.addIssue({ code: 'custom', message });
  if (result.status === 'SKIPPED' || result.status === 'PENDING') {
    if (result.startedAt !== null || result.finishedAt !== null || result.durationMs !== null || !result.error) issue('Skipped/pending checks need a reason and no execution timing.');
  } else if (result.startedAt === null || result.finishedAt === null || result.durationMs === null) issue('Executed checks need complete timing.');
  if (result.status === 'PASSED' && (result.exitCode !== 0 || result.signal !== null || result.error !== null || result.cleanupError !== null)) issue('Passed checks require exit 0 without errors or signals.');
  if (result.status === 'FAILED' && (result.exitCode === null || result.exitCode === 0 || result.signal !== null)) issue('Failed checks require a nonzero exit code.');
  if (result.status !== 'PASSED' && !result.error) issue('Non-passing checks require a reason.');
});
export type CheckResult = z.infer<typeof checkResultSchema>;

export function skippedCheck(check: CheckConfig, reason: string): CheckResult {
  return { ...check, status: 'SKIPPED', startedAt: null, finishedAt: null, durationMs: null,
    command: null, workingDirectory: null, pid: null, exitCode: null, signal: null,
    stdout: '', stderr: '', stdoutBytes: 0, stderrBytes: 0,
    stdoutTruncated: false, stderrTruncated: false, error: reason, cleanupError: null };
}

export function pendingCheck(check: CheckConfig): CheckResult {
  return { ...skippedCheck(check, 'No terminal evidence is available; this check may not have started or may have been interrupted.'), status: 'PENDING' };
}

export const verificationRecordSchema = z.strictObject({
  kind: z.literal('verification'), version: z.literal(1), id: z.uuid(),
  status: z.enum(['incomplete', 'completed']),
  startedAt: z.iso.datetime(), finishedAt: z.iso.datetime().nullable(),
  durationMs: z.number().finite().nonnegative().nullable(),
  verdict: z.enum(['PASSED', 'FAILED', 'BLOCKED', 'NOT_RUN']),
  checks: z.array(checkResultSchema).max(64),
}).superRefine((record, context) => {
  const complete = record.status === 'completed';
  if (complete !== (record.finishedAt !== null) || complete !== (record.durationMs !== null)
    || record.verdict !== aggregateVerdict(record.checks, complete)
    || (complete && record.checks.some((check) => check.status === 'PENDING'))
    || new Set(record.checks.map((check) => check.id)).size !== record.checks.length) {
    context.addIssue({ code: 'custom', message: 'Inconsistent verification lifecycle, identifiers or verdict.' });
  }
});
export type VerificationRecord = z.infer<typeof verificationRecordSchema>;

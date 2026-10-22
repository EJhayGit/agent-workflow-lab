import { printable } from '../output.js';
import type { VerificationRecord } from './records.js';
import { OUTPUT_LIMIT_BYTES } from './records.js';

export function formatVerification(record: VerificationRecord): string {
  const required = record.checks.filter((check) => check.required).length;
  const lines = [`Verification ${record.id} | ${record.status} | verdict: ${record.verdict}`,
    `Required gates: ${required} | Optional checks: ${record.checks.length - required}`,
    `Started: ${record.startedAt} | Finished: ${record.finishedAt ?? 'not recorded'}`];
  if (!record.checks.length) lines.push('No checks configured. Add verification.checks to agentlab.config.json; no scripts were discovered or run.');
  if (record.checks.length && !required) lines.push('No required gates are configured. The verdict does not assert that optional checks passed.');
  for (const check of record.checks) {
    lines.push(`${check.id} | ${check.required ? 'required' : 'optional'} | ${check.status} | ${check.name}`);
    lines.push(`  Exit: ${check.exitCode ?? 'none'} | Signal: ${check.signal ?? 'none'} | Duration: ${check.durationMs === null ? 'not run' : `${check.durationMs.toFixed(2)} ms`}`);
    if (check.command) lines.push(`  Command: ${JSON.stringify(check.command)} | cwd: ${check.workingDirectory}`);
    for (const stream of ['stdout', 'stderr'] as const) {
      const bytes = stream === 'stdout' ? check.stdoutBytes : check.stderrBytes;
      const truncated = stream === 'stdout' ? check.stdoutTruncated : check.stderrTruncated;
      if (bytes) lines.push(`  ${stream}: ${bytes} bytes${truncated ? `; truncated to first ${OUTPUT_LIMIT_BYTES} bytes` : ''}\n${check[stream]}`);
    }
    if (check.error) lines.push(`  Detail: ${check.error}`);
    if (check.cleanupError) lines.push(`  Cleanup warning: ${check.cleanupError}`);
  }
  return printable(lines.join('\n'));
}

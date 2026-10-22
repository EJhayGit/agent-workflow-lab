import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { configSchema } from '../config.js';
import type { ProjectConfig } from '../config.js';
import type { VerificationStore } from '../storage/verification.js';
import { executeCheck } from './process.js';
import { aggregateVerdict, pendingCheck, skippedCheck } from './records.js';
import type { VerificationRecord } from './records.js';

/** Only explicit, validated configuration supplies policy. No agent owns this verdict. */
export async function verifyProject(root: string, config: ProjectConfig, store: VerificationStore, signal?: AbortSignal): Promise<VerificationRecord> {
  const checks = configSchema.parse(config).verification?.checks ?? [];
  const start = performance.now();
  const pending = checks.map(pendingCheck);
  let record: VerificationRecord = {
    kind: 'verification', version: 1, id: randomUUID(), status: 'incomplete',
    startedAt: new Date().toISOString(), finishedAt: null, durationMs: null,
    verdict: aggregateVerdict(pending, false), checks: pending,
  };
  await store.save(record);
  for (const [index, check] of checks.entries()) {
    const result = record.checks.some((previous) => previous.cleanupError)
      ? skippedCheck(check, 'An earlier process cleanup could not be confirmed; later checks were not started.')
      : await executeCheck(root, check, signal);
    const updated = record.checks.map((existing, position) => position === index ? result : existing);
    record = { ...record, checks: updated, verdict: aggregateVerdict(updated, false) };
    await store.save(record);
  }
  record = { ...record, status: 'completed', verdict: aggregateVerdict(record.checks), finishedAt: new Date().toISOString(), durationMs: performance.now() - start };
  await store.save(record);
  return record;
}

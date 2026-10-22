import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { agentOutcomeSchema } from './agents/adapter.js';
import type { AgentAdapter, AgentOutcome } from './agents/adapter.js';
import { errorMessage } from './errors.js';
import type { RunRecord } from './records.js';
import type { RunStore } from './storage/store.js';

export async function runTask(task: string, adapter: AgentAdapter, store: RunStore): Promise<RunRecord> {
  const description = task.trim();
  if (!description) throw new Error('A nonempty task description is required.');
  const start = performance.now();
  const initial: RunRecord = {
    version: 1, id: randomUUID(), task: description, adapter: adapter.id,
    simulated: adapter.simulated, verification: 'not_run', status: 'incomplete',
    startedAt: new Date().toISOString(), finishedAt: null, durationMs: null,
    output: '', error: null,
  };
  await store.save(initial);
  let outcome: AgentOutcome;
  try {
    outcome = agentOutcomeSchema.parse(await adapter.execute(description));
  } catch (error) {
    outcome = { status: 'failed', output: '', error: errorMessage(error) || 'Unknown adapter failure' };
  }
  const final: RunRecord = {
    ...initial, status: outcome.status, output: outcome.output,
    error: outcome.status === 'failed' ? outcome.error : null,
    finishedAt: new Date().toISOString(), durationMs: Math.max(0, performance.now() - start),
  };
  // Deliberately outside the adapter catch: a failed write must not be reported as success.
  await store.save(final);
  return final;
}

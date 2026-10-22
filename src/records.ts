import { z } from 'zod';

export const runRecordSchema = z.strictObject({
  version: z.literal(1),
  id: z.uuid(),
  task: z.string().trim().min(1),
  adapter: z.string().min(1),
  simulated: z.boolean(),
  verification: z.literal('not_run'),
  status: z.enum(['incomplete', 'succeeded', 'failed']),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  durationMs: z.number().finite().nonnegative().nullable(),
  output: z.string(),
  error: z.string().min(1).nullable(),
}).superRefine((record, ctx) => {
  const terminal = record.status !== 'incomplete';
  if (terminal !== (record.finishedAt !== null) || terminal !== (record.durationMs !== null)
    || (record.status === 'failed' ? record.error === null : record.error !== null)) {
    ctx.addIssue({ code: 'custom', message: 'Inconsistent lifecycle fields: terminal runs need finish time/duration; only failed runs need an error.' });
  }
  if (record.adapter === 'mock' && !record.simulated) {
    ctx.addIssue({ code: 'custom', message: 'Mock runs must be labeled simulated.' });
  }
});

export type RunRecord = z.infer<typeof runRecordSchema>;

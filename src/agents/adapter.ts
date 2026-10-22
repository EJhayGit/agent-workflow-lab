import { z } from 'zod';

export const agentOutcomeSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('succeeded'), output: z.string() }),
  z.strictObject({ status: z.literal('failed'), output: z.string(), error: z.string().min(1) }),
]);
export type AgentOutcome = z.infer<typeof agentOutcomeSchema>;

/** Execution outcomes are not verification results. The harness owns evidence. */
export interface AgentAdapter {
  readonly id: string;
  readonly simulated: boolean;
  execute(task: string): Promise<AgentOutcome>;
}

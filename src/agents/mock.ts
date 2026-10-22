import type { AgentAdapter, AgentOutcome } from './adapter.js';

export class MockAgent implements AgentAdapter {
  readonly id = 'mock';
  readonly simulated = true;

  async execute(task: string): Promise<AgentOutcome> {
    return {
      status: 'succeeded',
      output: `[SIMULATED] Mock task completed: ${task}\nNo AI was called, no task code was changed, and verification was not run.`,
    };
  }
}

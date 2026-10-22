import { describe, expect, it } from 'vitest';
import { MockAgent } from '../src/agents/mock.js';
import type { AgentAdapter } from '../src/agents/adapter.js';
import type { RunRecord } from '../src/records.js';
import { runTask } from '../src/runner.js';
import type { RunStore } from '../src/storage/store.js';

function memoryStore() {
  const writes: RunRecord[] = [];
  const store: RunStore = {
    save: async (record) => { writes.push(structuredClone(record)); },
    list: async () => ({ records: writes.slice(-1), warnings: [] }),
  };
  return { store, writes };
}

describe('execution lifecycle', () => {
  it('saves incomplete evidence before invoking the mock, then a simulated outcome', async () => {
    const { store, writes } = memoryStore();
    const mock = new MockAgent();
    const adapter: AgentAdapter = {
      id: mock.id, simulated: mock.simulated,
      execute: async (task) => {
        expect(writes).toHaveLength(1);
        expect(writes[0]).toMatchObject({ status: 'incomplete', finishedAt: null, durationMs: null });
        return mock.execute(task);
      },
    };
    const result = await runTask('example task', adapter, store);
    expect(writes).toHaveLength(2);
    expect(result).toMatchObject({ task: 'example task', adapter: 'mock', simulated: true,
      status: 'succeeded', verification: 'not_run', error: null });
    expect(result.output).toContain('SIMULATED');
    expect(result.output).toContain('example task');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(Date.parse(result.startedAt)).not.toBeNaN();
    expect(Date.parse(result.finishedAt!)).not.toBeNaN();
    expect(result.id).toMatch(/^[a-f0-9-]{36}$/);
  });

  it('persists adapter exceptions as failures', async () => {
    const { store, writes } = memoryStore();
    const adapter: AgentAdapter = { id: 'test', simulated: true,
      execute: async () => { throw new Error('adapter failed'); } };
    const result = await runTask('task', adapter, store);
    expect(result).toMatchObject({ status: 'failed', error: 'adapter failed', output: '' });
    expect(writes[1]?.status).toBe('failed');
  });

  it('preserves an explicit failed adapter outcome', async () => {
    const { store } = memoryStore();
    const adapter: AgentAdapter = { id: 'test', simulated: true,
      execute: async () => ({ status: 'failed', output: 'partial work', error: 'rejected' }) };
    expect(await runTask('task', adapter, store)).toMatchObject({ status: 'failed', output: 'partial work', error: 'rejected' });
  });

  it('never executes an adapter when the initial evidence cannot be saved', async () => {
    let executed = false;
    const { store } = memoryStore();
    store.save = async () => { throw new Error('disk unavailable'); };
    const adapter: AgentAdapter = { id: 'test', simulated: true, execute: async () => {
      executed = true;
      return { status: 'succeeded', output: 'done' };
    } };
    await expect(runTask('task', adapter, store)).rejects.toThrow('disk unavailable');
    expect(executed).toBe(false);
  });

  it('leaves incomplete evidence when the terminal save fails', async () => {
    const { store, writes } = memoryStore();
    const save = store.save;
    store.save = async (record) => {
      if (record.status !== 'incomplete') throw new Error('disk full');
      await save(record);
    };
    await expect(runTask('task', new MockAgent(), store)).rejects.toThrow(/disk full/);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.status).toBe('incomplete');
  });

  it('rejects empty tasks before creating evidence', async () => {
    const { store, writes } = memoryStore();
    await expect(runTask('  ', new MockAgent(), store)).rejects.toThrow(/task/i);
    expect(writes).toEqual([]);
  });
});

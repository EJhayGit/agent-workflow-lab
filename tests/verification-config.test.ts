import { describe, expect, it } from 'vitest';
import { configSchema } from '../src/config.js';

const check = { id: 'unit', name: 'Unit tests', executable: 'node', args: ['--version'], required: true, timeoutMs: 1000, cwd: '.' };
const config = (checks: unknown[]) => ({ version: 1, storageDir: '.agentlab', verification: { checks } });

describe('verification configuration', () => {
  it('accepts explicit checks and preserves legacy configuration', () => {
    expect(configSchema.parse(config([check])).verification?.checks).toEqual([check]);
    expect(configSchema.parse({ version: 1, storageDir: '.agentlab' })).toEqual({ version: 1, storageDir: '.agentlab' });
    expect(configSchema.parse(config([])).verification?.checks).toEqual([]);
  });

  it('supplies conservative defaults for explicitly configured checks', () => {
    const minimal = { id: 'test', name: 'Test', executable: 'node' };
    expect(configSchema.parse(config([minimal])).verification?.checks[0]).toEqual({
      ...minimal, args: [], required: true, timeoutMs: 30_000, cwd: '.',
    });
  });

  it.each([
    [check, check],
    [{ ...check, id: '' }], [{ ...check, name: ' ' }], [{ ...check, executable: '' }],
    [{ ...check, args: ['safe', 1] }], [{ ...check, args: ['bad\u0000argument'] }],
    [{ ...check, required: 'yes' }], [{ ...check, timeoutMs: 0 }],
    [{ ...check, timeoutMs: 1.5 }], [{ ...check, timeoutMs: 3_600_001 }],
    [{ ...check, cwd: '../escape' }], [{ ...check, cwd: 'C:\\outside' }],
    [{ ...check, cwd: '/outside' }], [{ ...check, shell: true }],
  ])('rejects invalid checks: %j', (...checks) => {
    expect(configSchema.safeParse(config(checks)).success).toBe(false);
  });
});

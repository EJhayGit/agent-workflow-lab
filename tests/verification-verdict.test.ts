import { describe, expect, it } from 'vitest';
import { aggregateVerdict } from '../src/verification/records.js';

describe('required verification policy', () => {
  it('does not call empty configuration a pass', () => {
    expect(aggregateVerdict([])).toBe('NOT_RUN');
  });

  it('passes required gates while retaining optional failures', () => {
    expect(aggregateVerdict([{ required: true, status: 'PASSED' }, { required: false, status: 'FAILED' }])).toBe('PASSED');
  });

  it.each(['TIMED_OUT', 'EXECUTION_ERROR', 'INTERRUPTED', 'SKIPPED', 'PENDING'] as const)('blocks on required %s', (status) => {
    expect(aggregateVerdict([{ required: true, status }])).toBe('BLOCKED');
    expect(aggregateVerdict([{ required: true, status: 'FAILED' }, { required: true, status }])).toBe('FAILED');
  });

  it('never lets optional successes overrule a required failure', () => {
    expect(aggregateVerdict([{ required: false, status: 'PASSED' }, { required: true, status: 'FAILED' }])).toBe('FAILED');
  });

  it('blocks even optional cleanup uncertainty because a process may still affect the project', () => {
    expect(aggregateVerdict([{ required: true, status: 'PASSED' }, { required: false, status: 'TIMED_OUT', cleanupError: 'Could not terminate tree' }])).toBe('BLOCKED');
  });
});

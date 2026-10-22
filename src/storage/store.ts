import type { RunRecord } from '../records.js';

export interface RunHistory {
  records: RunRecord[];
  warnings: string[];
}

export interface RunStore {
  save(record: RunRecord): Promise<void>;
  list(): Promise<RunHistory>;
}

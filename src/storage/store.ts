import type { RunRecord } from '../records.js';

export interface RecordHistory<T> {
  records: T[];
  warnings: string[];
}

export interface RecordStore<T> {
  save(record: T): Promise<void>;
  list(): Promise<RecordHistory<T>>;
}

export type RunHistory = RecordHistory<RunRecord>;
export type RunStore = RecordStore<RunRecord>;

import { runRecordSchema } from '../records.js';
import type { RunRecord } from '../records.js';
import { JsonRecordStore } from './json-records.js';

export class JsonRunStore extends JsonRecordStore<RunRecord> {
  constructor(root: string, storageDir: string) {
    super(root, storageDir, 'runs', runRecordSchema);
  }
}

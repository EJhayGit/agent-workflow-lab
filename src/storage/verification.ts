import { verificationRecordSchema } from '../verification/records.js';
import type { VerificationRecord } from '../verification/records.js';
import { JsonRecordStore } from './json-records.js';
import type { RecordStore } from './store.js';

export type VerificationStore = RecordStore<VerificationRecord>;

export class JsonVerificationStore extends JsonRecordStore<VerificationRecord> {
  constructor(root: string, storageDir: string) {
    super(root, storageDir, 'verifications', verificationRecordSchema);
  }
}

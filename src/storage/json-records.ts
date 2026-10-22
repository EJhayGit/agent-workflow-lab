import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ZodType } from 'zod';
import { errorMessage, hasCode } from '../errors.js';
import { assertManagedPath, storagePath } from '../paths.js';
import type { RecordHistory, RecordStore } from './store.js';

/** Shared atomic JSON mechanics; each collection supplies its own schema. */
export class JsonRecordStore<T extends { id: string; startedAt: string }> implements RecordStore<T> {
  private readonly root: string;
  private readonly directory: string;

  constructor(root: string, storageDir: string, collection: 'runs' | 'verifications', private readonly schema: ZodType<T>) {
    this.root = path.resolve(root);
    this.directory = path.join(storagePath(this.root, storageDir), collection);
  }

  async save(record: T): Promise<void> {
    const valid = this.schema.parse(record);
    await assertManagedPath(this.root, this.directory, 'directory');
    await mkdir(this.directory, { recursive: true });
    const target = path.join(this.directory, `${valid.id}.json`);
    await assertManagedPath(this.root, target, 'file');
    const temporary = path.join(this.directory, `.${valid.id}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, `${JSON.stringify(valid, null, 2)}\n`, { flag: 'wx' });
      await rename(temporary, target);
    } finally {
      await rm(temporary, { force: true });
    }
  }

  async list(): Promise<RecordHistory<T>> {
    await assertManagedPath(this.root, this.directory, 'directory');
    let names: string[];
    try { names = await readdir(this.directory); }
    catch (error) {
      if (hasCode(error, 'ENOENT')) return { records: [], warnings: [] };
      throw error;
    }
    const records: T[] = [];
    const warnings: string[] = [];
    for (const name of names.sort()) {
      if (!name.endsWith('.json')) continue;
      try {
        const file = path.join(this.directory, name);
        await assertManagedPath(this.root, file, 'file');
        const record = this.schema.parse(JSON.parse(await readFile(file, 'utf8')) as unknown);
        if (name !== `${record.id}.json`) throw new Error('Filename does not match record identity.');
        records.push(record);
      } catch (error) {
        warnings.push(`Cannot read ${path.basename(this.directory)} record ${name}: ${errorMessage(error)}`);
      }
    }
    records.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt) || a.id.localeCompare(b.id));
    return { records, warnings };
  }
}

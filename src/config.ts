import { writeFile, readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { hasCode } from './errors.js';
import { assertManagedPath, isSafeStorageDir, storagePath, validateProject } from './paths.js';

export const CONFIG_FILE = 'agentlab.config.json';
export const configSchema = z.strictObject({
  version: z.literal(1),
  storageDir: z.string().refine(isSafeStorageDir, 'Use a safe project-relative storage directory without traversal or reserved names.'),
});
export type ProjectConfig = z.infer<typeof configSchema>;

export async function initProject(root: string): Promise<void> {
  await validateProject(root);
  await access(root, constants.R_OK | constants.W_OK);
  await assertManagedPath(root, storagePath(root, '.agentlab'), 'directory');
  const file = path.join(root, CONFIG_FILE);
  // Exclusive creation also protects existing malformed configs and symlinks.
  try {
    await writeFile(file, `${JSON.stringify({ version: 1, storageDir: '.agentlab' }, null, 2)}\n`, { flag: 'wx' });
  } catch (error) {
    if (hasCode(error, 'EEXIST')) throw new Error(`${CONFIG_FILE} already exists. Inspect it or choose another project; init never overwrites it.`);
    throw error;
  }
}

export async function loadConfig(root: string): Promise<ProjectConfig> {
  await validateProject(root);
  const file = path.join(root, CONFIG_FILE);
  await assertManagedPath(root, file, 'file');
  let content: string;
  try {
    content = await readFile(file, 'utf8');
  } catch (error) {
    if (hasCode(error, 'ENOENT')) throw new Error(`No ${CONFIG_FILE} in the current directory. Run "agentlab init" here first.`);
    throw error;
  }
  let data: unknown;
  try { data = JSON.parse(content) as unknown; }
  catch { throw new Error(`Invalid JSON in ${CONFIG_FILE}. Repair the file and retry.`); }
  const result = configSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`).join('; ');
    throw new Error(`Invalid configuration in ${CONFIG_FILE}: ${issues}`);
  }
  await assertManagedPath(root, storagePath(root, result.data.storageDir), 'directory');
  return result.data;
}

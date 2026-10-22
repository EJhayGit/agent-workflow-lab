import { lstat, stat } from 'node:fs/promises';
import path from 'node:path';
import { hasCode } from './errors.js';

// Apply Windows restrictions on every platform so shared configurations stay portable.
export function isSafeStorageDir(value: string): boolean {
  const segments = value.replaceAll('\\', '/').split('/');
  return segments.every((part) => part.length > 0 && part !== '.' && part !== '..'
    && !/[<>:"|?*\u0000-\u001f]/u.test(part) && !/[. ]$/u.test(part)
    && !/^\s/u.test(part) && part.toLowerCase() !== '.git'
    && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part));
}

export async function validateProject(root: string): Promise<void> {
  if (path.resolve(root) === path.parse(path.resolve(root)).root) {
    throw new Error('A filesystem root is not a supported project directory. Choose a project folder.');
  }
  try {
    if (!(await stat(root)).isDirectory()) throw new Error('Not a directory');
  } catch {
    throw new Error(`Cannot access project directory ${root}. Choose an existing, accessible folder.`);
  }
}

export function storagePath(root: string, storageDir: string): string {
  if (!isSafeStorageDir(storageDir)) throw new Error('Invalid configuration: storageDir must be a safe project-relative directory.');
  return path.resolve(root, ...storageDir.replaceAll('\\', '/').split('/'));
}

/** Reject links/junctions and type conflicts, including in existing ancestors. */
export async function assertManagedPath(root: string, target: string, kind: 'file' | 'directory'): Promise<void> {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (!relative || path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`)) {
    throw new Error('Managed paths must stay inside the project directory.');
  }
  const parts = relative.split(path.sep);
  let current = path.resolve(root);
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]!);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (hasCode(error, 'ENOENT')) return;
      throw error;
    }
    if (info.isSymbolicLink()) throw new Error(`Refusing symbolic link or junction in managed path: ${current}`);
    const directory = index < parts.length - 1 || kind === 'directory';
    if (directory ? !info.isDirectory() : !info.isFile()) {
      throw new Error(`Expected a ${directory ? 'directory' : 'regular file'} at ${current}. Move the conflicting entry and retry.`);
    }
  }
}

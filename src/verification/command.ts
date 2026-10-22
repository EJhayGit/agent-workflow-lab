import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { assertManagedPath, storagePath } from '../paths.js';
import type { CheckConfig } from './config.js';

export async function resolveCommand(root: string, check: CheckConfig): Promise<{
  executable: string; args: string[]; cwd: string;
}> {
  const cwd = check.cwd === '.' ? path.resolve(root) : storagePath(root, check.cwd);
  if (check.cwd !== '.') await assertManagedPath(root, cwd, 'directory');
  if (!(await stat(cwd)).isDirectory()) throw new Error(`Working directory is not a directory: ${cwd}`);
  if (/\.(cmd|bat)$/iu.test(check.executable)) {
    throw new Error('Command wrappers are not launched implicitly. Configure a native executable or run a JavaScript entry point with node; use npm for the supported npm launcher.');
  }
  if (/^node(?:\.exe)?$/iu.test(check.executable)) return { executable: process.execPath, args: check.args, cwd };
  if (process.platform === 'win32' && /^(npm|npx)$/iu.test(check.executable)) {
    const script = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', `${check.executable.toLowerCase()}-cli.js`);
    try { await access(script); }
    catch { throw new Error(`Cannot locate the bundled ${check.executable} JavaScript entry point. Configure node with an explicit CLI script path instead.`); }
    return { executable: process.execPath, args: [script, ...check.args], cwd };
  }
  let executable = check.executable;
  if (!path.isAbsolute(executable) && /[/\\]/u.test(executable)) {
    // Relative executable paths are relative to the check cwd, but must remain in the project.
    executable = path.resolve(cwd, executable);
    await assertManagedPath(root, executable, 'file');
  }
  return { executable, args: check.args, cwd };
}

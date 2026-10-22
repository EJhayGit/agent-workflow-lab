import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import path from 'node:path';
import { errorMessage, hasCode } from '../errors.js';

/** Best-effort cleanup of the launched tree, never of unrelated process names. */
export async function terminateTree(child: ChildProcess): Promise<string | null> {
  if (child.pid === undefined) return null;
  if (process.platform !== 'win32') {
    try { process.kill(-child.pid, 'SIGKILL'); return null; }
    catch (error) {
      if (hasCode(error, 'ESRCH')) return null;
      child.kill('SIGKILL');
      return `Process-group cleanup failed: ${errorMessage(error)}`;
    }
  }
  const executable = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe');
  const failure = await new Promise<string | null>((resolve) => {
    let killer;
    try {
      killer = spawn(executable, ['/PID', String(child.pid), '/T', '/F'], {
        shell: false, windowsHide: true, stdio: 'ignore', timeout: 3000,
      });
    } catch (error) { resolve(errorMessage(error)); return; }
    killer.once('error', (error) => resolve(errorMessage(error)));
    killer.once('close', (code) => resolve(code === 0 ? null : `taskkill exited with code ${code}`));
  });
  if (failure) {
    child.kill('SIGKILL');
    return `Tree cleanup could not be confirmed: ${failure}`;
  }
  return null;
}

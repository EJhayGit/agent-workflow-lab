import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG_FILE, initProject, loadConfig } from '../src/config.js';

describe('project configuration', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), 'awl-config-')); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it('initializes an ordinary directory and never overwrites existing config', async () => {
    await initProject(root);
    const original = await readFile(path.join(root, CONFIG_FILE), 'utf8');
    expect(await loadConfig(root)).toEqual({ version: 1, storageDir: '.agentlab' });
    await expect(initProject(root)).rejects.toThrow(/already exists/);
    expect(await readFile(path.join(root, CONFIG_FILE), 'utf8')).toBe(original);
  });

  it('does not overwrite a malformed existing configuration', async () => {
    await writeFile(path.join(root, CONFIG_FILE), 'broken');
    await expect(initProject(root)).rejects.toThrow(/already exists/);
    expect(await readFile(path.join(root, CONFIG_FILE), 'utf8')).toBe('broken');
  });

  it('explains missing configuration and malformed JSON', async () => {
    await expect(loadConfig(root)).rejects.toThrow(/agentlab init/);
    await writeFile(path.join(root, CONFIG_FILE), '{');
    await expect(loadConfig(root)).rejects.toThrow(/Invalid JSON/);
  });

  it.each([
    { version: 2, storageDir: '.agentlab' },
    { version: 1, storageDir: '.agentlab', typo: true },
    { version: 1 },
    ...['../escape', '/outside', 'C:\\outside', '\\\\server\\share', '.',
      'a/../b', '.git/data', 'CON', 'aux.txt', 'data:stream', 'data.', 'data ']
      .map((storageDir) => ({ version: 1, storageDir })),
  ])('rejects unsupported or unsafe settings: %j', async (config) => {
    await writeFile(path.join(root, CONFIG_FILE), JSON.stringify(config));
    await expect(loadConfig(root)).rejects.toThrow(/Invalid configuration/);
  });

  it('supports nested configurable project-local storage', async () => {
    await writeFile(path.join(root, CONFIG_FILE), JSON.stringify({ version: 1, storageDir: 'local/history' }));
    expect((await loadConfig(root)).storageDir).toBe('local/history');
  });

  it('refuses initialization when default storage conflicts with an existing file', async () => {
    await writeFile(path.join(root, '.agentlab'), 'existing data');
    await expect(initProject(root)).rejects.toThrow(/directory/);
    expect(await readFile(path.join(root, '.agentlab'), 'utf8')).toBe('existing data');
    await expect(readFile(path.join(root, CONFIG_FILE))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects filesystem roots and nonexistent projects', async () => {
    await expect(initProject(path.parse(root).root)).rejects.toThrow(/filesystem root/);
    await expect(initProject(path.join(root, 'absent'))).rejects.toThrow(/project directory/);
  });

  it('rejects a junction in the storage path', async () => {
    const target = path.join(root, 'target');
    await mkdir(target);
    await symlink(target, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    await writeFile(path.join(root, CONFIG_FILE), JSON.stringify({ version: 1, storageDir: 'linked/history' }));
    await expect(loadConfig(root)).rejects.toThrow(/symbolic link|junction/);
  });
});

#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { Command, CommanderError } from 'commander';
import { MockAgent } from './agents/mock.js';
import { CONFIG_FILE, initProject, loadConfig } from './config.js';
import { errorMessage } from './errors.js';
import type { RunRecord } from './records.js';
import { runTask } from './runner.js';
import { JsonRunStore } from './storage/json.js';

// Treat persisted/user text as data, including terminal control characters.
function printable(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/gu,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

function displayRun(record: RunRecord): void {
  console.log(`Run ${record.id} | ${record.simulated ? 'SIMULATED' : 'REAL'} | ${record.status}`);
  console.log(`Task: ${printable(record.task)}`);
  console.log(`Adapter: ${printable(record.adapter)} | verification: ${record.verification}`);
  console.log(`Started: ${record.startedAt} | Finished: ${record.finishedAt ?? 'not recorded'}`);
  console.log(`Duration: ${record.durationMs === null ? 'not recorded' : `${record.durationMs.toFixed(2)} ms`}`);
  if (record.output) console.log(printable(record.output));
  if (record.error) console.log(`Error: ${printable(record.error)}`);
}

const metadata = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
const program = new Command()
  .name('agentlab')
  .description('Agent Workflow Lab — local execution evidence (M1: mock only).')
  .version(metadata.version)
  .exitOverride()
  .showHelpAfterError();

program.command('init')
  .description('Create local configuration in the current project directory.')
  .action(async () => {
    await initProject(process.cwd());
    console.log(`Created ${CONFIG_FILE}. Run agentlab run "example task" --mock next.`);
  });

program.command('run')
  .description('Record a simulated task. No AI calls or verification checks are performed.')
  .argument('<task>', 'Nonempty task description (quote descriptions containing spaces).')
  .requiredOption('--mock', 'Use the simulated adapter; required in M1.')
  .action(async (task: string) => {
    const config = await loadConfig(process.cwd());
    const store = new JsonRunStore(process.cwd(), config.storageDir);
    const result = await runTask(task, new MockAgent(), store);
    displayRun(result);
    process.exitCode = result.status === 'succeeded' ? 0 : 1;
  });

program.command('report')
  .description('Display local execution history, newest first; warn about incomplete or corrupt evidence.')
  .action(async () => {
    const config = await loadConfig(process.cwd());
    const history = await new JsonRunStore(process.cwd(), config.storageDir).list();
    if (history.records.length === 0) {
      console.log(history.warnings.length ? 'No readable executions. History is damaged; inspect the warnings.' : 'No executions recorded.');
    }
    for (const record of history.records) {
      displayRun(record);
      console.log();
    }
    for (const warning of history.warnings) console.error(`Warning: ${printable(warning)}`);
    const incomplete = history.records.filter((record) => record.status === 'incomplete').length;
    if (incomplete) console.error(`Warning: ${incomplete} incomplete run(s); no durable terminal outcome was recorded.`);
    process.exitCode = history.warnings.length || incomplete ? 2 : 0;
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof CommanderError) process.exitCode = error.exitCode;
  else {
    console.error(`Error: ${printable(errorMessage(error))}`);
    process.exitCode = 1;
  }
}

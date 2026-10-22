# Agent Workflow Lab

**Less orchestration. More verification. Better evidence.**

AWL is an open-source, local-first toolkit for reliable AI coding workflows.
An agent harness is the code around an agent: it controls how a task starts,
how results are recorded, and eventually which checks must pass. It does not
need to replace the coding agent itself.

**Current release: M0 + M1 only.** The CLI runs a deterministic mock agent and
stores local execution history. It makes no AI calls, requires no API keys,
and performs no task-code edits or verification. A simulated success is not
evidence that a coding task was completed or tests passed.

## Install and try it

Use [Node.js 24 LTS](https://nodejs.org/en/download) and npm. From this checkout:

```sh
npm ci
npm run build
node dist/cli.js init
node dist/cli.js run "example task" --mock
node dist/cli.js report
```

Commands operate on the **current directory**, with no parent-directory search.
Ordinary project folders and Git checkouts are supported; Git is not used yet.
Do not initialize a filesystem root. After building, use an absolute path to
`dist/cli.js` to work from another project folder.

To use the `agentlab` executable without a global installation:

```sh
npm pack
```

Then, from the project where you want to use AWL (replace the path with your
tarball's absolute path):

```sh
npm install --save-dev "/absolute/path/agent-workflow-lab-0.1.0.tgz"
npm exec -- agentlab init
npm exec -- agentlab run "example task" --mock
npm exec -- agentlab report
```

These commands work in PowerShell too; use a quoted Windows path to the tarball.
Dependency installation can use the network; the three AWL commands do not.
No global CLI installation is needed.

## Configuration and history

`init` exclusively creates `agentlab.config.json` and refuses to overwrite any
existing file, including a broken one:

```json
{
  "version": 1,
  "storageDir": ".agentlab"
}
```

Edit `storageDir` to another project-relative folder, such as `local/history`.
Absolute paths, traversal, reserved Windows names, `.git`, and symlink/junction
components in managed paths are rejected. Strict validation catches misspelled
fields and unsupported versions before a task starts. Configuration is suitable
for version control; history is local. `.agentlab/` is ignored in this checkout.
If you customize storage, add that location to your project's ignore rules.
Tasks and outputs are stored as plaintext: do not put credentials in them.

Each execution has a UUID and a JSON file at `<storageDir>/runs/<id>.json`.
The lifecycle is:

1. Validate configuration and the task description.
2. Save an `incomplete` record before invoking the adapter.
3. Invoke the mock adapter with the literal task text.
4. Save `succeeded` or `failed`, output/error, UTC timestamps and elapsed milliseconds.
5. Display the saved result with a **SIMULATED** label and `verification: not_run`.

An adapter is a small translator between the harness and a particular agent.
M1's adapter returns a fixed-style simulated response; it does not interpret the
task as a shell command. A future real adapter can use the same contract while
the harness keeps ownership of evidence and mandatory verification policy.

The mock response and validation rules are deterministic. IDs, timestamps,
durations and filesystem availability vary. `incomplete` means no terminal
outcome was durably recorded: for example, the process stopped or the final
write failed. It never means verified success.

`report` shows readable records, newest first, with status, output and timing.
Missing history is empty history. Damaged or unreadable records generate warnings
while valid records remain visible. Unsupported versions and inconsistent
lifecycle fields are treated as damaged evidence.

| Exit code | Meaning |
| --- | --- |
| 0 | Successful command; report may include historical failed runs |
| 1 | Invalid invocation/configuration, I/O error, or failed new execution |
| 2 | Report found corrupt/unreadable records or incomplete executions |

For missing configuration, run `agentlab init` in the intended directory. Repair
invalid configuration directly; init never resets it. Inspect damaged history
and recover from backups if available. AWL does not automatically delete or
rewrite unreadable records.

## Development and boundaries

```sh
npm run check
```

This checks strict TypeScript, runs unit and subprocess integration tests, and
builds the executable. See [CONTRIBUTING.md](CONTRIBUTING.md) and
[testing](docs/TESTING.md) for details.

```text
src/
  cli.ts, config.ts, paths.ts, errors.ts
  records.ts, runner.ts
  agents/adapter.ts, agents/mock.ts
  storage/store.ts, storage/json.ts
tests/                 configuration, runner, storage, built CLI
docs/                  requirements, architecture, testing, roadmap, decisions
```

The CLI handles commands and presentation; the runner owns execution lifecycle;
AgentAdapter isolates providers; RunStore isolates persistence. JSON is inspectable
and requires no database. It scans all records and has no database transactions
or power-loss guarantee. It assumes a trusted local project, not a hostile
process racing filesystem operations.

Real AI adapters, Git worktrees, multi-agent orchestration, MCP, Skills,
benchmarks, cloud services and the verification engine are outside M1.
Recommended M2 is a small deterministic verification layer before real-agent
integration. Failed mandatory checks must remain failures regardless of an
agent's opinion. See [architecture](docs/ARCHITECTURE.md),
[ADR 0001](docs/decisions/0001-m1-boundaries.md), and [roadmap](docs/roadmap.md).

Licensed under [MIT](LICENSE).

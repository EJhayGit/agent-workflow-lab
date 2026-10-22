# Agent Workflow Lab

**Less orchestration. More verification. Better evidence.**

AWL is an open-source, local-first toolkit for reliable AI coding workflows.
An agent harness is the code around an agent: it controls how a task starts,
how results are recorded, and eventually which checks must pass. It does not
need to replace the coding agent itself.

**Current release: M2.** The CLI records mock agent runs and executes explicitly
configured verification checks. AWL makes no AI calls and requires no API keys.
A simulated success never means a coding task was completed or verified.

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
npm install --save-dev "/absolute/path/agent-workflow-lab-0.2.0.tgz"
npm exec -- agentlab init
npm exec -- agentlab run "example task" --mock
npm exec -- agentlab report
```

These commands work in PowerShell too; use a quoted Windows path to the tarball.
Dependency installation can use the network. AWL makes no network requests;
configured verification programs can use the network with your permissions.
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

`report` shows mock runs and verification sessions in separate groups, newest
first within each group, with status, output and timing.
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

## Configure and run verification

Add explicit checks to `agentlab.config.json`. For a project with an npm
`typecheck` script, this example executes that script only when you run `verify`:

```json
{
  "version": 1,
  "storageDir": ".agentlab",
  "verification": {
    "checks": [
      {
        "id": "typecheck",
        "name": "TypeScript checks",
        "executable": "npm",
        "args": ["run", "typecheck"],
        "required": true,
        "timeoutMs": 60000,
        "cwd": "."
      }
    ]
  }
}
```

```sh
node dist/cli.js verify
node dist/cli.js report
```

The [example configuration](agentlab.config.example.json) includes type checking
and tests for this checkout. Init still creates the original minimal config:
it does not discover or enable package scripts. An absent or empty check list
produces `NOT_RUN` with exit code 2. A mock run never automatically runs checks.

Each check needs a unique ID, name and executable. Arguments default to `[]`,
required defaults to `true`, timeout defaults to 30,000 ms, and cwd defaults to
`.`. Limits are 64 checks, 1,024 arguments per check, and a positive integer
timeout up to one hour. Cwd must be an existing project-relative directory;
managed symlinks/junctions and traversal are rejected.

A subprocess is another program launched by AWL. The executable and arguments
are passed separately with `shell: false`, so shell-like text is literal unless
you explicitly configure a program that interprets it. `node` uses AWL's current
Node binary. On Windows, bare `npm`/`npx` use Node's bundled JavaScript entry
points; if those are unavailable, configure `node` with the CLI script's path.
Automatic `.cmd`/`.bat` launching is rejected. Other native commands use PATH or
an explicit absolute path. Relative executable paths resolve from the check cwd
and must stay inside the project. Paths with spaces do not need embedded quotes.

Checks run sequentially in configuration order, continuing after ordinary
failures. An exit code is a program's machine-readable outcome: 0 passes,
nonzero fails. Startup failures (`EXECUTION_ERROR`), timeouts (`TIMED_OUT`),
interruptions (`INTERRUPTED`) and checks not started after cancellation
(`SKIPPED`) remain distinct. `PENDING` in incomplete history means no terminal
evidence was saved; it does not prove the check never started.

| Verification verdict | Meaning | `verify` exit |
| --- | --- | --- |
| PASSED | All configured required gates passed; optional results remain separate | 0 |
| FAILED | At least one required check exited nonzero | 1 |
| BLOCKED | Required evidence is unavailable, finalization is incomplete, or cleanup is uncertain | 2 |
| NOT_RUN | No checks were configured or executed | 2 |

Required failure takes precedence over blocked evidence. Optional failures remain
visible and do not fail required gates. If only optional checks are configured,
the summary explicitly says there are no required gates; a PASSED verdict does
not claim the optional checks passed. Invalid configuration or storage errors
exit 1. Handled SIGINT/SIGTERM save interruption evidence and exit 130/143.
`report` is an inspection command: historical failed verdicts alone do not change
its exit code; damaged or incomplete history still returns 2.

Verification history lives at `<storageDir>/verifications/<uuid>.json`, separate
from mock runs. Each session snapshots required/optional policy and commands,
records resolved executable/cwd, PID, exit code/signal, UTC timestamps, elapsed
time, stdout/stderr and errors. AWL saves incomplete evidence first, checkpoints
after each result, then finalizes. Each invocation creates a new record; changing
configuration cannot rewrite the original evidence. Records are local JSON,
not signed or tamper-proof, but inconsistent verdicts are rejected when read.

AWL retains the first 64 KiB of raw bytes per stream per check, keeps draining
later output, and reports byte counts and truncation. UTF-8 decoding at the cap
may replace a partial character. Durations include setup and cleanup, so they can
exceed timeoutMs. Timeout/cancellation requests tree termination on Windows and
process-group termination on Unix. Cleanup failures are recorded, block the
verdict, and prevent later checks from starting.

**Configured programs run with your permissions; M2 provides no security
sandbox.** A project-local cwd does not stop scripts from modifying outside
files, using credentials or accessing the network. Review configuration and the
programs/scripts it invokes. Descendants that detach or outlive their parent may
escape cleanup, particularly on Windows. Forcibly killing AWL can bypass cleanup
and leave incomplete evidence. There is no filesystem isolation, source snapshot,
or guarantee that your chosen checks are sufficient or deterministic.

Deterministic verification applies fixed rules to process evidence. AI review
offers a judgment and can miss defects; it cannot replace these gate results.
Future adapters may request verification or consume its records, but they will
have no verdict-override API. Required policy comes from explicit configuration.

## Development and boundaries

```sh
npm run check
```

This checks strict TypeScript, runs unit and subprocess integration tests, and
builds the executable. See [CONTRIBUTING.md](CONTRIBUTING.md) and
[testing](docs/TESTING.md) for details.

```text
src/
  cli.ts, config.ts, paths.ts, errors.ts, output.ts
  records.ts, runner.ts
  agents/adapter.ts, agents/mock.ts
  storage/             typed stores, shared JSON mechanics, separate collections
  verification/        config, records/verdict, commands, process cleanup, engine, output
tests/                 M1 behavior plus verification policy, execution, storage, CLI
docs/                  requirements, architecture, testing, roadmap, decisions
```

The CLI handles commands and presentation; the runner owns execution lifecycle;
AgentAdapter isolates providers; RunStore isolates persistence. JSON is inspectable
and requires no database. It scans all records and has no database transactions
or power-loss guarantee. It assumes a trusted local project, not a hostile
process racing filesystem operations.

Real AI adapters, Git worktrees, multi-agent orchestration, MCP, Skills,
benchmarks, cloud services and automatic repairs remain outside M2. Failed
mandatory checks remain failures regardless of an agent's opinion. See
[architecture](docs/ARCHITECTURE.md), [M1 decisions](docs/decisions/0001-m1-boundaries.md),
[M2 decisions](docs/decisions/0002-deterministic-verification.md), and
[roadmap](docs/roadmap.md).

Licensed under [MIT](LICENSE).

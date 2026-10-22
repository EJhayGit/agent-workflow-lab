# Testing

## Verification approach

Use Node 24. Tests use actual filesystem I/O and separate Node subprocesses for
the built executable. Runner tests also use an in-memory store to inspect ordering
and inject deterministic write failures. No keys, model requests or global
installs are involved. Verification fixtures execute harmless local programs
and write only inside temporary test projects.

## Commands

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run check
```

`npm test` builds first so CLI tests execute the current compiled entry point.
Vitest runs without watch mode; `npm run check` runs all gates.

- Configuration: exclusive init, missing/malformed JSON, versions, unknown fields,
  portable storage paths, root rejection and junction rejection.
- Runner: incomplete evidence, simulated success, explicit failures, exceptions,
  initial/terminal save failure and empty tasks.
- Store: round trips, replacement, missing history, concurrent distinct records,
  sorting, damaged records, filename identity, links and filesystem conflicts.
- Built CLI: init/run/report across processes, literal shell-like tasks, exit
  codes, required flags, help/version, invalid configuration, custom storage,
  incomplete/failed states and partial corruption.
- Verification policy: unique IDs/defaults, invalid check configuration, required
  pass/fail/blocked precedence, optional failure, empty configuration and no
  false pass after incomplete finalization.
- Subprocesses: real successful/nonzero exits, missing executable, literal
  metacharacters, cwd/scripts with spaces, missing/junction cwd, independent
  output streams, byte counts/truncation, timeout and AbortSignal interruption.
- Cleanup: terminate a child tree and confirm its delayed file write never occurs;
  on Windows also confirm the descendant PID is gone. Simulate unavailable
  taskkill after real child startup, record uncertainty and skip later checks.
- Evidence/CLI: per-check checkpoints, failed record persistence, final-save
  failure, original policy preservation, corrupt/falsified verdict detection,
  verify exit codes, mixed history and Windows npm JavaScript resolution.
  A CLI subprocess test delivers a SIGINT event via a temporary IPC preload,
  disconnects IPC, and asserts interrupted evidence and exit 130. This exercises
  the real handler without claiming to simulate Windows console event delivery.

After building, smoke-test the three commands in a disposable project. Inspect
the record for `simulated: true`, `status: "succeeded"`, `verification: "not_run"`.
Confirm report displays the same UUID. `npm pack --dry-run` checks package contents;
a local tarball install tests npm's executable shim without a global install.

For M2, configure a harmless required Node command with exit 0, run verify, then
change the configured exit to nonzero and verify again. Assert exit codes 0/1,
verdicts PASSED/FAILED, distinct UUIDs, and unchanged prior evidence. Run M1
commands in the same project and confirm mock history remains `not_run`.

## Test environments and data

Each test gets a unique temporary folder, including paths containing spaces,
and removes it afterward. Failure adapters exist only in tests; the production
mock always returns simulated success. Never store secrets in fixtures.

Compare subprocess cwd evidence using `realpath` on both paths, preserving exact
directory identity across aliases such as macOS `/var` and `/private/var`.
A symlink/junction project-root regression exercises this on every platform;
links inside managed working-directory paths remain rejected.

M2 local verification is on Windows/Node 24. CI is configured for Windows, Linux
and macOS; configuration alone is not evidence of passing remote runs. This
Codex sandbox can deny Vitest temporary-file rename operations; approved
filesystem access permits the identical checks without weakening assertions.

## Known gaps

No real AI/Git automation exists. No security sandbox, hostile filesystem race,
source provenance, power-loss durability, or guaranteed cleanup of intentionally
detached descendants is tested or promised. Windows console Ctrl-C delivery and
Unix process groups require their own platform runtime validation; Windows
AbortSignal cancellation and PID-tree cleanup are exercised locally. Uncatchable
harness termination can leave children and incomplete evidence. Multiple writers
to the same record ID are unsupported.

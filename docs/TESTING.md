# Testing

## Verification approach

Use Node 24. Tests use actual filesystem I/O and separate Node subprocesses for
the built executable. Runner tests also use an in-memory store to inspect ordering
and inject deterministic write failures. No keys, model requests, global installs,
or task-code execution are involved.

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

After building, smoke-test the three commands in a disposable project. Inspect
the record for `simulated: true`, `status: "succeeded"`, `verification: "not_run"`.
Confirm report displays the same UUID. `npm pack --dry-run` checks package contents;
a local tarball install tests npm's executable shim without a global install.

## Test environments and data

Each test gets a unique temporary folder, including paths containing spaces,
and removes it afterward. Failure adapters exist only in tests; the production
mock always returns simulated success. Never store secrets in fixtures.

Initial verification is on Windows/Node 24. CI is configured for Windows, Linux
and macOS; configuration alone is not evidence of passing remote runs. This
Codex sandbox can deny Vitest temporary-file rename operations; approved
filesystem access permits the identical checks without weakening assertions.

## Known gaps

No real AI/Git operations or verification gates exist. No deliberate process-kill,
hostile filesystem race, or power-loss durability test is included. Interrupted
execution is tested through terminal-save failure and incomplete report fixtures.
Multiple writers to the same record ID are unsupported.

# Architecture

## Overview

AWL is a local command-line harness: it gives agent tasks a defined lifecycle
and records objective verification evidence. Agent execution remains simulated;
M2 adds explicitly configured checks through `verify`. No AI calls, implicit
script discovery, automatic repair, or shell interpretation of task text.

Node 24 LTS + TypeScript ESM; Commander parses CLI arguments, Zod validates data,
Vitest exercises real filesystem and CLI behavior. No server or global state.

## Structure and interfaces

```text
src/cli.ts              executable, commands, presentation, exit codes
src/config.ts           project checks, exclusive init, configuration loading
src/paths.ts            project-local path checks
src/records.ts          versioned execution schema and types
src/runner.ts           persist incomplete -> invoke adapter -> persist terminal result
src/agents/adapter.ts   small provider-independent execution contract
src/agents/mock.ts      deterministic simulated success, no network/process calls
src/storage/store.ts    typed persistence interface and listing diagnostics
src/storage/json-records.ts shared atomic JSON mechanics and per-file validation
src/storage/json.ts     original mock run store
src/storage/verification.ts separate verification store
src/verification/config.ts check configuration and safe defaults
src/verification/records.ts evidence schemas and deterministic aggregate policy
src/verification/command.ts native executable/cwd resolution, Windows npm handling
src/verification/process.ts bounded stream capture, process lifecycle and timeout
src/verification/cleanup.ts platform-specific best-effort tree termination
src/verification/engine.ts independent sequential checks and evidence checkpoints
src/verification/format.ts readable verification summaries
src/output.ts           terminal-safe text rendering
tests/                 unit and real subprocess tests in temporary folders
```

CLI -> validated config -> JSON store -> runner -> mock adapter -> final record.
Report loads valid history plus per-file warnings. A corrupt record must never
appear as successful. Missing history is an empty history; missing config is an
actionable error. Storage location is configurable inside the project.

AgentAdapter returns an execution outcome, not a verification judgment. RunStore
can later be implemented with SQLite. M1 record schemas and CLI semantics remain
compatible. Config version 1 gains an optional verification section; defaults
apply only to explicitly configured checks, not the whole legacy config.

Verify -> load/validate config -> save incomplete verification snapshot -> resolve
and execute each configured check -> save each result -> persist final verdict.
Checks execute in order and continue after ordinary failures. Cancellation and
unconfirmed cleanup skip later checks. SIGINT/SIGTERM handling belongs to the
CLI; the service consumes an AbortSignal and owns no process-global handlers.

VerificationStore shares JSON mechanics with RunStore but uses the separate
`verifications/` collection. Sessions snapshot configured required policy and
resolved commands. New config creates new evidence, never modifies older runs.
Required failure takes precedence over blocked evidence; timeout, execution
error, interruption or incomplete required evidence blocks. Empty configuration
is NOT_RUN. Optional failures remain visible. Cleanup uncertainty also blocks
because lingering processes could invalidate subsequent evidence.

Only the verification module computes verdicts. Future adapters may request it
or consume records, never override its result. No source snapshot links a
verification session to a mock run, so reports do not infer that connection.

## Conventions

Use strict TypeScript, explicit boundary validation, small async modules and
Node built-ins. No shell evaluation of user input. Persist UTC ISO timestamps
and monotonic elapsed milliseconds. Do not put credentials in config or history.
No automatic Git operations, global installations, or AWL external service calls.
Configured programs inherit user permissions/environment and can use the network
or write outside the project: cwd validation is not a security sandbox.
Run npm run check before proposing changes; update relevant docs with behavior.

## Decisions

[0001: M1 boundaries](decisions/0001-m1-boundaries.md) records options, rationale,
storage guarantees, and future integration boundaries.

[0002: deterministic verification](decisions/0002-deterministic-verification.md)
records explicit command policy, Windows resolution, independent evidence,
verdict precedence, bounded output, and cleanup guarantees/limits.

## Open technical questions

Future isolation requires worktree/source provenance and deliberate environment
policy. Detached descendants and abrupt harness termination need stronger OS
supervision for guaranteed cleanup. Neither is implemented in M2. No AI provider,
Git automation, exception mechanism, or M3 work is included.

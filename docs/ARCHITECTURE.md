# Architecture

## Overview

AWL is a local command-line harness: it gives an agent task a defined lifecycle
and records evidence around it. M1 only simulates execution. It never calls an AI,
changes task code, executes task text, or runs verification commands.

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
src/storage/store.ts    persistence interface and listing diagnostics
src/storage/json.ts     atomic JSON writes and tolerant per-file reads
tests/                 unit and subprocess integration tests in temporary folders
```

CLI -> validated config -> JSON store -> runner -> mock adapter -> final record.
Report loads valid history plus per-file warnings. A corrupt record must never
appear as successful. Missing history is an empty history; missing config is an
actionable error. Storage location is configurable inside the project.

AgentAdapter returns an execution outcome, not a verification judgment. RunStore
can later be implemented with SQLite. Future verification, Git isolation and
provider integrations remain separate responsibilities (see ADR 0001).

## Conventions

Use strict TypeScript, explicit boundary validation, small async modules and
Node built-ins. No shell evaluation of user input. Persist UTC ISO timestamps
and monotonic elapsed milliseconds. Do not put credentials in config or history.
No automatic Git operations, global installations, or external service calls.
Run npm run check before proposing changes; update relevant docs with behavior.

## Decisions

[0001: M1 boundaries](decisions/0001-m1-boundaries.md) records options, rationale,
storage guarantees, and future integration boundaries.

## Open technical questions

Before M2, define verification gate configuration and the distinction between
agent execution outcome and verified task outcome. Do not add real agents first.

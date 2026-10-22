# Requirements

## Purpose

Agent Workflow Lab is a public, local-first toolkit for reliable and efficient
coding-agent workflows. Less orchestration, more verification, better evidence.
Favor one capable agent; added orchestration must earn its complexity.

## Scope

### In scope

- M0: maintainable TypeScript/Node foundation, docs and recorded design decisions.
- M1: `agentlab init`, `agentlab run "task" --mock`, `agentlab report`.
- M2: explicit `agentlab verify` checks with unique IDs, names, executable/args,
  required policy, timeouts and optional project-relative working directories.
- Separate verification evidence: bounded stdout/stderr, exit code/signal,
  elapsed time, startup errors, timeout/interruption, skipped/pending checks,
  preserved configuration snapshots and deterministic aggregate verdicts.
- Strict configuration, configurable project-local JSON history, explicit exit
  codes, safe filesystem handling, small adapter/store interfaces.
- Records include task identity/text, simulation, status, timestamps, duration,
  output/error and explicit absence of verification.
- Unit and subprocess integration tests; Windows support; reproducible npm build.

### Out of scope

Real AI calls, keys, shell execution of task text, worktree automation, multi-agent or
planner/reviewer machinery, repair loops, MCP, Skills installation, benchmarks,
model routing, databases, dashboards, cloud deployment, security sandboxing,
source snapshots, and automatic repair loops.

## User workflows

Initialize an existing non-root project directory, run an explicit simulation,
then inspect persisted history across separate CLI processes. Git is optional.
Edit local configuration to choose another safe project-relative storage folder.
Explicitly configure verification commands, run verify, and inspect saved evidence
using report. Do not discover repository scripts or run checks after mock tasks.

## Acceptance criteria

- Build and automated tests pass. All four documented commands work.
- Init never overwrites existing configuration, including malformed files.
- Agent execution requires --mock; AWL needs no network or API keys. Verification
  only runs explicitly configured programs, with their inherited permissions.
- Incomplete evidence is saved before execution, then a terminal outcome.
- Every mock result is marked simulated in storage and presentation.
  Adapter success never implies completed coding work or verification.
- Missing history is empty; damaged records produce warnings and a nonzero
  degraded-report status while valid records remain visible.
- Invalid config and unsafe paths fail before execution. I/O errors cannot
  produce a false success. Failed and incomplete history retain their states.
- Documentation matches behavior; provider/storage interfaces permit later
  integration without introducing future milestone functionality.
- Verification distinguishes PASSED, FAILED, BLOCKED and NOT_RUN. Required failure
  cannot be overridden; optional problems remain visible. Unsuccessful required
  verification returns nonzero. No simulated run is relabeled verified.
- Capture each stream with a 64 KiB raw byte cap and truncation evidence, enforce
  timeouts, request process-tree cleanup, and report cleanup uncertainty honestly.
- Preserve earlier evidence/policy after configuration changes. Save incomplete
  checkpoints and never report incomplete finalization as a completed pass.

## Open questions

Define stronger isolation, source provenance, and environment policy before any
future milestone. Mandatory failed checks cannot be overridden by AI assessments.
No exception mechanism or real-agent adapter is included in M2.

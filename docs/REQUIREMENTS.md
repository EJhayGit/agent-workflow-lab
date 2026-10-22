# Requirements

## Purpose

Agent Workflow Lab is a public, local-first toolkit for reliable and efficient
coding-agent workflows. Less orchestration, more verification, better evidence.
Favor one capable agent; added orchestration must earn its complexity.

## Scope

### In scope

- M0: maintainable TypeScript/Node foundation, docs and recorded design decisions.
- M1: `agentlab init`, `agentlab run "task" --mock`, `agentlab report`.
- Strict configuration, configurable project-local JSON history, explicit exit
  codes, safe filesystem handling, small adapter/store interfaces.
- Records include task identity/text, simulation, status, timestamps, duration,
  output/error and explicit absence of verification.
- Unit and subprocess integration tests; Windows support; reproducible npm build.

### Out of scope

Real AI calls, keys, task command execution, worktree automation, multi-agent or
planner/reviewer machinery, repair loops, MCP, Skills installation, benchmarks,
model routing, databases, dashboards, cloud deployment and full verification.

## User workflows

Initialize an existing non-root project directory, run an explicit simulation,
then inspect persisted history across separate CLI processes. Git is optional.
Edit local configuration to choose another safe project-relative storage folder.

## Acceptance criteria

- Build and automated tests pass. All three documented commands work.
- Init never overwrites existing configuration, including malformed files.
- Only explicit --mock execution is supported; no network or keys are needed.
- Incomplete evidence is saved before execution, then a terminal outcome.
- Every mock result is marked simulated in storage and presentation.
  Adapter success never implies completed coding work or verification.
- Missing history is empty; damaged records produce warnings and a nonzero
  degraded-report status while valid records remain visible.
- Invalid config and unsafe paths fail before execution. I/O errors cannot
  produce a false success. Failed and incomplete history retain their states.
- Documentation matches behavior; provider/storage interfaces permit later
  integration without introducing future milestone functionality.

## Open questions

Define verification command policy and gate configuration before M2. Future
mandatory failed checks cannot be overridden by AI-generated assessments.
Human-controlled exceptions must be explicit; M1 has no exception machinery.

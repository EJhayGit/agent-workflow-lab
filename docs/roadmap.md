# Roadmap

## M0 + M1 — foundation and mock CLI

Architecture and conventions; local initialization; explicit simulated execution;
versioned JSON history; failure/incomplete reporting; focused automated tests.
No real coding agent or verification engine is included.

## Recommended M2 — deterministic verification

Define minimal project-local checks, execute each with explicit executable/argument
arrays (no implicit shell), capture output and exit status, add timeouts, and
persist verification evidence separately from agent execution status. Mandatory
failed gates cannot be changed by AI conclusions. Decide command/environment
policy before implementation.

## Later candidates (not implemented)

- Safe Git worktree lifecycle and protection of unrelated changes.
- One real coding-agent adapter, cancellation and bounded repair attempts.
- Risk profiles and explicit human-approved exceptions.
- Optional planning or independent review when measured benefit justifies cost.
- Reproducible benchmarks; storage/query improvements if JSON becomes limiting.
- Codex Skills/MCP entry points reusing the application interfaces.

Sequence later work based on evidence. Do not add a complex plugin or orchestration
framework in anticipation of these possibilities.

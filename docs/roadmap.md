# Roadmap

## M0 + M1 — foundation and mock CLI

Architecture and conventions; local initialization; explicit simulated execution;
versioned JSON history; failure/incomplete reporting; focused automated tests.
No real coding agent or verification engine is included.

## M2 — deterministic verification

Explicit project-local check configuration; sequential native subprocess execution;
bounded stdout/stderr; exit code/signal and elapsed-time evidence; timeouts and
handled cancellation; best-effort tree cleanup; independent versioned history;
required/optional verdict rules; CLI/report integration. Required failures cannot
be changed by AI conclusions. No security sandbox or source snapshot is provided.

## Proposed M3 — safe isolation and provenance (not implemented)

Agree on a narrow Git worktree lifecycle and source identity for verification
sessions, with protection for unrelated/uncommitted changes. Define stronger
process/environment controls before promising isolation. No automatic M3 work.

## Later candidates (not implemented)

- Safe Git worktree lifecycle and protection of unrelated changes.
- One real coding-agent adapter, cancellation and bounded repair attempts.
- Risk profiles and explicit human-approved exceptions.
- Optional planning or independent review when measured benefit justifies cost.
- Reproducible benchmarks; storage/query improvements if JSON becomes limiting.
- Codex Skills/MCP entry points reusing the application interfaces.

Sequence later work based on evidence. Do not add a complex plugin or orchestration
framework in anticipation of these possibilities.

# 0001: Small M1 runner with explicit simulation and replaceable storage

Date: 2026-10-22. Status: accepted for M0 + M1.

## Context and options

AWL needs an inspectable local lifecycle before adding real AI or verification.
A single CLI file would be smaller initially but would mix persistence with
execution. A plugin framework or event bus would add complexity without a user.
Choose a few modules with two small interfaces: AgentAdapter and RunStore.

JSON files are easy to inspect and need no database dependency. SQLite would
offer transactions and querying, but neither is needed for this milestone.
Use one versioned JSON record per run, atomic replacement, and per-record
validation; keep storage behind RunStore for a later SQLite implementation.

## Decisions and consequences

- Use Node 24 LTS, TypeScript ESM, Commander, Zod and Vitest.
- Commands operate on the current directory only; no ancestor discovery.
  Ordinary directories and Git checkouts work. Reject filesystem roots.
  Git is optional because M1 performs no Git operations.
- Configuration is agentlab.config.json; storage defaults to .agentlab.
  Only project-relative storage is allowed. Reject traversal, Windows special
  paths, reserved names, and symlink/junction components in managed paths.
- Save an incomplete record before calling an adapter; finalize it on return
  or exception. A process interruption or final write failure leaves incomplete
  evidence. Incomplete means no durable terminal result, not a diagnosis.
- Only --mock is executable. Simulation is explicit in records and CLI output.
  A successful simulation does not imply that code changed or checks passed.
  Verification is always not_run in M1.
- No automatic retries or AI judgments. Failure remains failure.
- Keep existing uppercase ARCHITECTURE.md as the canonical architecture document
  to avoid filenames that collide on Windows; architecture.md is not duplicated.

## Limits and future boundaries

Atomic rename reduces partial records; it is not a power-loss durability guarantee
or a transaction across all runs. Listing scans all JSON files. Local filesystem
checks assume a trusted project and do not sandbox hostile concurrent filesystem
changes. Concurrent tasks use UUIDs; overlapping writers for one ID are unsupported.

A future provider implements AgentAdapter. The runner will still own lifecycle
and evidence. Add a deterministic verification policy before claiming verified
success; an adapter's conclusion must never overrule failed mandatory checks.
Git worktree management belongs outside adapters and must protect unrelated work.
MCP/Skills would call the same application boundary, not replace it. No such
integration is implemented in M1.

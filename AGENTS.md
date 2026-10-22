# Project instructions

Follow the global Codex instructions. Use this file for project-specific guidance as the application takes shape.

- Find the project's goals, scope, and acceptance criteria in [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md). Read the relevant sections before changing behavior.
- Find technical structure and recorded decisions in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Consult it when changing design or interfaces.
- Find the test approach and commands in [docs/TESTING.md](docs/TESTING.md). Run checks appropriate to the change.
- Follow the conventions already present in the codebase. Keep changes focused and avoid adding dependencies or patterns without a clear need.
- For significant technical decisions, compare practical options, record the choice and rationale in `docs/ARCHITECTURE.md`, and seek user input when the choice depends on an unresolved product requirement.
- Report what changed, why, what you verified, and any remaining issues.

Update these documents as the project evolves. Small changes only require reading the material relevant to them.

## AWL conventions

- Current scope is M0 + M1: a mock-only local CLI. Do not automatically start M2.
- Use Node 24 LTS, strict TypeScript ESM and `.js` import extensions.
- Favor one capable agent and deterministic evidence over orchestration.
- Keep provider behavior behind `AgentAdapter` and persistence behind `RunStore`.
- Every mock record and presentation must identify simulation; execution success
  never implies verification. M1 always records `verification: not_run`.
- Never evaluate task text as shell commands or add implicit network/model calls.
- Run `npm run check` and review the actual diff before claiming completion.
- Record significant design choices in `docs/decisions/`; the canonical architecture
  file remains `docs/ARCHITECTURE.md` for Windows filename compatibility.

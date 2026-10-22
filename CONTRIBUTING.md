# Contributing

Use Node 24 LTS and npm. Run `npm ci`, then `npm run check`.
Tests build and execute the local CLI; no global installation is required.

Keep changes focused and preserve unrelated work. Read [requirements](docs/REQUIREMENTS.md),
[architecture](docs/ARCHITECTURE.md), and [testing](docs/TESTING.md) before changing behavior.
Update docs with public behavior and record material tradeoffs in `docs/decisions/`.

Use strict TypeScript, ESM imports with `.js` extensions, small async modules,
Node built-ins and explicit error handling. Validate untrusted data at boundaries.
Avoid dependencies and abstractions without a demonstrated need. Never evaluate
task text as shell code, store secrets in fixtures, or add hidden network calls.

Add behavior-focused tests for changes and failures. Review the actual diff and
run `npm run check` before submitting. Describe the problem, resulting behavior,
verification and relevant limitations in your contribution. Use the GitHub
pull-request flow once this project has a hosted repository; no URL is assumed.

M1 is mock-only. Discuss broader milestones before adding real agents, Git
automation, verification policy, orchestration or hosted services. Failed future
mandatory checks must remain failures regardless of AI-generated assessments.

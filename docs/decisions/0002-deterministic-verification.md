# 0002: Independent verification evidence and explicit subprocess policy

Date: 2026-10-22. Status: accepted for M2.

## Context and choices

M1 agent outcomes cannot stand in for quality checks. Attaching verification to
the latest mock run would imply a relationship that AWL cannot establish without
Git/source snapshots. Choose standalone verification records with their own UUIDs,
configuration snapshots, and verdicts. M1 records remain unchanged and unverified.

Reuse the existing JSON mechanics through a small typed JsonRecordStore, retaining
JsonRunStore and adding JsonVerificationStore. This avoids duplicated atomic-write
and corruption handling; it introduces no plugin framework or database.

## Execution policy

Only `verify` executes checks explicitly declared in local configuration. No
package-script discovery or automatic checks after a mock run. Checks run in
configuration order and continue after ordinary failures to collect evidence.
Executable and argument arrays are passed to Node spawn with shell=false.
There is no implicit shell quoting or interpolation.

Use the current Node executable for `node`. On Windows, use Node plus the bundled
npm/npx JavaScript entry point for those bare command names; fail with guidance
when that layout is unavailable. Reject .cmd/.bat wrappers instead of introducing
shell parsing. Other bare commands use the inherited PATH; native absolute paths
are allowed. Relative executable paths resolve from the check cwd and must stay
inside the project without symlink/junction components.

Working directories must be existing project-local directories without managed
path links. Commands inherit the environment and permissions. This is not a
security sandbox: configured programs and their scripts can read/write outside
the project, use the network, or change verification configuration. Treat config,
tools, npm lifecycle scripts, and the repository as trusted. Changing a working
directory cannot enforce filesystem isolation.

## Evidence and verdicts

Retain the first 64 KiB of raw bytes per stream per check, keep draining after
the cap, and record total byte counts and truncation flags. Decode retained bytes
as UTF-8; a split code point may become a replacement character. Save normalized
check policy, resolved command/cwd, PID, timestamps, duration, exit code/signal,
output and errors. Do not persist the environment or credentials.

Save an incomplete record first and a checkpoint after each result. PENDING means
terminal evidence is absent; it does not prove a process never started. Finalize
only after results are durably saved. A failed terminal save leaves BLOCKED or
FAILED incomplete evidence, never PASSED. Each invocation gets a new record;
configuration changes do not rewrite earlier policy or evidence. Local files are
not signed or tamper-proof, but reads reject inconsistent result/verdict fields.

- Required FAILED -> FAILED, even when another required check is blocked.
- Required timeout/startup error/interruption/skip/pending -> BLOCKED.
- Unconfirmed process cleanup -> BLOCKED unless a required failure already exists;
  skip later checks because a lingering process could invalidate their evidence.
- All required gates pass -> PASSED. Optional failures remain visible. With only
  optional checks, explicitly disclose that no required gates were configured.
- Zero configured checks -> NOT_RUN. No scripts are discovered or run.

Record status is independent of verdict. An incomplete session cannot be PASSED.
Exit codes: verify PASSED=0, FAILED=1, BLOCKED/NOT_RUN=2; invalid configuration or
storage errors=1. Handled SIGINT/SIGTERM return 130/143 after saving evidence.
Report retains M1 inspection semantics: historical failures alone do not make the
report command fail, while corrupt or incomplete history returns 2.

## Cleanup and limitations

Timeouts and handled cancellation force termination of the launched process group
on Unix or the PID tree using taskkill /T /F on Windows. Native helper invocation
uses an argument array and hidden windows. Record helper failures and fall back
to killing the direct child. Helper execution is limited to three seconds; a
six-second cleanup fallback bounds waiting for process/pipe closure. Duration
includes setup and cleanup, so it may exceed timeoutMs.

Cleanup is best effort. Deliberately detached descendants or children whose parent
already exited may escape tree discovery on Windows. Force-killing AWL itself
(SIGKILL, forced Windows termination, power loss) bypasses its signal handlers and
may leave children and incomplete evidence. No OS job objects, resource sandbox,
cross-process locks, source/environment snapshots, or repair loops are implemented.
Verdicts are deterministic rules over observed evidence, not a promise that
arbitrary test programs are deterministic or sufficient to prove correctness.

Future adapters may request this service or consume records. They receive no
verdict-override API; policy comes exclusively from explicit project configuration.

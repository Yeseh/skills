---
name: prove-it
description: Prove a user-facing code change with executable journeys and a visual evidence report.
disable-model-invocation: true
---

# Prove It

Run this skill explicitly after a user-facing change. A **proof run** is evidence-only: do not modify product code, silently weaken assertions, or call a change proven without user-facing evidence.

## Contract

1. Inspect both staged and unstaged changes. Identify the changed user-facing **surface**: CLI, REST API, visual web application, or more than one. If no relevant surface is affected, report `not applicable` and stop.
2. Find the project’s documented setup, start, test, and browser commands. Prefer existing tooling and an already-running local service. Start isolated local processes when needed. Ask for help only when credentials, external services, or ambiguous setup genuinely block a trustworthy run.
3. Use local or explicitly authorized environments only. Never target production. Avoid destructive commands. Prefer disposable fixtures and record setup/cleanup. Confirm before mutating shared persistent data.
4. Use credentials from documented environment variables or secret managers. Never ask for secrets in chat and never put them in the report. Redact tokens, cookies, passwords, API keys, authorization headers, and likely secret values from commands, URLs, bodies, outputs, screenshots, and metadata.
5. Run the narrowest relevant existing tests as supporting evidence. Tests never replace a real user journey.

## Surface journeys

Choose the smallest **user journey** that demonstrates the diff, including a meaningful assertion and, when useful, a contrasting before/after or negative case.

### CLI

Drive the journey through [`tui-test`](https://github.com/microsoft/tui-test) (`tui-test open`/`run`, `submit`/`type`/`press`, `wait`, `expect`) instead of an ad-hoc subprocess call, so the run is scriptable, assertable, and recorded automatically. If `tui-test` is unavailable and cannot be installed, fall back to a raw command capture and note the gap in the report.

1. Open a session scoped to the journey: `tui-test open --cwd <dir>` for a shell-driven command, or `tui-test run <program> [args...]` to launch a TUI program directly.
2. Drive it like a user: `submit "<command>"` for one-shot commands, or `type`/`press`/`keys` for interactive prompts and TUI navigation.
3. Wait on the right condition before asserting: `wait command` for shell-tracked completion, `wait idle` for TUI screens that settle without a tracked exit, `wait exit` for a program that terminates.
4. Assert with `expect`, not by eyeballing output: `expect text "<T>"` for visible output, `expect exit-code <N>` for exit status, `expect output "<T>"` for captured stdout, `expect snapshot <NAME>` for full-screen TUI states.
5. Capture evidence before closing: `tui-test get-recording > <journey>.cast` for the full asciinema transcript, and `tui-test screenshot -o <journey>.svg` for a terminal UI or other visual CLI.
6. Always run `tui-test close` when the journey ends, even on failure, so no daemon session is left running.

Record the commands run, each `wait`/`expect` call with its exit code, redacted captured output, and the recording/screenshot path. Render the transcript in a terminal-style report panel sourced from `tui-test`'s own capture; do not hand-transcribe output it already recorded.

### REST API

Make executable requests with the project’s available tooling. Record the method, redacted URL and headers, request body, status, response body, and explicit assertions for status, schema, and changed behavior. Include setup and cleanup requests when they are part of the journey.

### Visual web application

Use existing Playwright or browser automation first, then supported browser tooling. Capture checkpoint screenshots for the initial state, key interaction, and resulting state. Record navigation, actions, assertions, and any console or network failures relevant to the journey. Do not claim visual proof from source inspection or tests alone.

## Evidence report

Use the `visual-artifact` skill’s bundled manifest and renderer to create the report; do not hand-author report HTML. Include:

- change summary and detected surfaces;
- environment and setup commands, with secrets removed;
- each journey step, action, expected result, actual result, and assertion status;
- CLI transcripts (tui-test recordings/screenshots), API exchanges, browser screenshots, and supporting test results;
- links or embedded evidence artifacts, timestamps, and cleanup status;
- final status: `passed`, `failed`, `blocked`, or `not applicable`;
- exact blockers and reproduction instructions for every failed or blocked step.

If a journey cannot complete, finish the partial report and mark the run `failed` or `blocked`. Do not present it as proven. Keep evidence reproducible and limited to the smallest changed behavior.

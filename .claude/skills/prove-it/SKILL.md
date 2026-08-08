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

Run the real command as a user would. Capture the command, sanitized environment assumptions, prompts, stdout, stderr, exit code, and state assertions. Render the transcript in a terminal-style report panel. Capture an image only for a terminal UI or other visual CLI.

### REST API

Make executable requests with the project’s available tooling. Record the method, redacted URL and headers, request body, status, response body, and explicit assertions for status, schema, and changed behavior. Include setup and cleanup requests when they are part of the journey.

### Visual web application

Use existing Playwright or browser automation first, then supported browser tooling. Capture checkpoint screenshots for the initial state, key interaction, and resulting state. Record navigation, actions, assertions, and any console or network failures relevant to the journey. Do not claim visual proof from source inspection or tests alone.

## Evidence report

Use the `visual-artifact` skill’s bundled manifest and renderer to create the report; do not hand-author report HTML. Include:

- change summary and detected surfaces;
- environment and setup commands, with secrets removed;
- each journey step, action, expected result, actual result, and assertion status;
- CLI transcripts, API exchanges, browser screenshots, and supporting test results;
- links or embedded evidence artifacts, timestamps, and cleanup status;
- final status: `passed`, `failed`, `blocked`, or `not applicable`;
- exact blockers and reproduction instructions for every failed or blocked step.

If a journey cannot complete, finish the partial report and mark the run `failed` or `blocked`. Do not present it as proven. Keep evidence reproducible and limited to the smallest changed behavior.

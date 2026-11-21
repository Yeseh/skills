---
name: implementation-ticket
description: Write or split GitHub issues for implementation work (build tickets for modules, packages, services, tooling or deployment) in a fixed house format, with what is built, the value, the program design (types, function signatures, module layout) and a test plan. Use when asked to write a build/implementation ticket, to split an epic or walking-skeleton issue into sub-issues, or to turn a design decision into buildable work.
---

# Implementation tickets

An implementation ticket says what will be built, why it matters, how the code is shaped and how it will
be tested. A reviewer should be able to judge the design from the ticket alone, before any code exists.
Decision tickets are different: they ask a question. This skill is for build work only.

Write the ticket in the repo's own language and stack. The examples below span stacks; use the ones that fit.

## Reviewable scope

Make each implementation ticket small enough for a focused AI review and normally deliverable in one small PR.
Prefer one cohesive behaviour or trust-boundary change, with its own acceptance criteria and focused tests, over
bundling multiple packages, service responsibilities or independent security mechanisms. A module or package can
span multiple tickets; do not create new boundaries merely to make tickets smaller. Split further when a ticket
would require several unrelated review threads, while keeping each increment buildable and testable against
fakes. The number of tickets is not a goal.

Preserve the parent issue's security invariants, acceptance criteria and out-of-scope decisions. Assign every
deliverable and test to a child or explicitly retain it in the parent, and link only the prerequisites each child
actually needs. Check for active PRs before splitting existing work and agree how to handle them; do not split an
in-flight PR without approval.

## 1. Ground every ticket in decided design

Read what the repo has of the following before you write anything. Never invent a design the documents don't
support.

- `AGENTS.md` / `CLAUDE.md` / `CONTRIBUTING.md`: conventions, the gates (lint, build and test commands) and
  where the other documents live.
- The glossary (`GLOSSARY.md`, `CONTEXT.md` or similar): use the canonical terms and avoid listed aliases. Name
  packages, modules and binaries the way the glossary does.
- The design docs: design notes, ADRs (`docs/adr/`), RFCs or specs, especially the one that sets module or
  package boundaries and dependency rules. Also read open docs PRs and branches that record recent decisions.
- The coding standards: cite rule IDs where a design choice follows one.
- The parent issue and the decision tickets it depends on. Read the **last resolution comment** of each
  closed decision ticket: resolutions supersede the question text and sometimes each other ("Superseded
  in part"). Use `gh api repos/<owner>/<repo>/issues/<n>` and `…/comments` (`gh issue view` can print
  nothing in non-interactive shells).
- Acceptance scenarios (BDD `features/`, e2e specs) and the threat model, if the repo has them: the scenarios
  and threat IDs the work makes executable.

If the parent issue is out of date (old names, components that were dropped, superseded decisions),
offer to update it first, in glossary terms, before you split it.

## 2. Ticket format

Title: `Build: <what> (<packages or components>)`. For docs-only work, describe the outcome instead
(`Threat-model delta for …`).

Start the body with one line that places the ticket in context: the parent issue and phase, the design
docs as links, and the decision tickets as `#n`. Then use these sections, in this order. Keep the headings
exactly as written: `## What is built` and `## Test plan` are how the `next-ticket` skill recognises a
build-ready ticket.

### What is built

The packages, services, modules or artefacts this ticket delivers, and the behaviour of each in concrete
terms: hosts, paths, flows, states, limits. Number the steps of a multi-step flow. If an assumption is
unverified, put a **spike first** item at the top, saying what it must show and what happens if it fails.

### Value

Two to four bullets: what this unlocks for the walking skeleton or the product, which invariant or
threat it enforces, and why the boundary is drawn where it is. No marketing.

### Program design

- **Module layout:** a code block of the files and modules this ticket adds or changes, plus any migration,
  schema, IDL or deployment paths.
- **Object definitions and function signatures:** sketches in the repo's language of the public types,
  interfaces (ports) and functions. Prefer distinct types for identifiers, a wrapper type for secrets that
  cannot be logged, enums instead of booleans, and typed errors. Mark which parts are pure and which do I/O.
  Keep the sketches signature-level: no function bodies. Note that final names follow review.
- **Wire and storage shapes**, where relevant: REST tables (method, path, purpose), RPC services or schemas,
  database tables and columns, events.
- **Dependency rules:** which module or package dependency rules this ticket adds or enforces, and what the
  deployable must not depend on.
- Open questions that this ticket decides go here as "decide in this ticket: …". Open questions it does
  not decide go under Out of scope, with the ticket that owns them.

### Test plan

A table with columns **What | How**. Each row names the behaviour and the concrete method, for example:

- unit tests, table-driven tests, golden or snapshot files, property-based tests, compile-fail or type tests;
- in-process tests against fakes for each port (including a fake clock);
- store tests against a real throwaway database;
- integration tests against local fakes or containers;
- acceptance or BDD scenarios (name the files, and say which stay pending);
- fuzz targets;
- threat-model evidence;
- manual or skipped-by-default live tests, saying what access they need.

Always end with the repo's gates.

### Out of scope

What this ticket deliberately leaves out, each item with the ticket or decision that owns it. A feature
left out of the skeleton is a **scope choice, not a design rule**: write "(skeleton scope, not design
rules)" and keep the design doc as the candidate design.

### Done when

A checklist of observable outcomes: modules exist with their purpose documented, named rules are enforced
by the gates, named scenarios pass, and the gates pass.

## 3. Splitting a parent issue into sub-issues

1. Map the work onto the module boundaries and build order the design docs set. Split each library stack,
   deployable or lifecycle into reviewable units as described above; do not target a fixed ticket count or
   equate tickets with packages. Include docs deltas and the final end-to-end run where needed.
2. Find work that no ticket owns yet (an image, certificate issuance, a runbook) and give it a home,
   usually the final end-to-end ticket.
3. **Propose the list to the user** (titles, one line each, the blocked-by graph) and wait for approval
   before you create anything. Issues are visible to everyone with access to the repo.
4. Write the drafts to files first, using `{{KEY}}` placeholders for cross-references. Create the issues
   in dependency order so the numbers are known when you substitute them. Fail if a placeholder is left.
5. Wire them up with the GitHub API (database IDs, not numbers):
   - sub-issue: `gh api -X POST repos/<r>/issues/<parent>/sub_issues -F sub_issue_id=<id>`
   - blocked by: `gh api -X POST repos/<r>/issues/<n>/dependencies/blocked_by -F issue_id=<id>`
   Also link existing related issues as sub-issues when the user asks.
6. Update the parent's sub-issue table (phase, issue, work, blocked by). Re-fetch the body immediately
   before `gh issue edit`, because other sessions edit the same issues; diff it against what you last
   read, and re-read it afterwards to verify.
7. Report the numbers, the graph, and every assumption or scope choice you made, so the user can correct
   them.

## 4. Style

- Plain, concrete sentences in GitHub-flavoured Markdown. Use tables for surfaces and test plans, code
  blocks for layouts and signatures.
- Link design docs with full URLs to the default branch. Use `#n` for issues.
- Don't restate a whole design doc: link it and state only what this ticket builds from it.
- No credentials, tokens or secret values in tickets, not even in examples. Use placeholders such as
  `<token>`.

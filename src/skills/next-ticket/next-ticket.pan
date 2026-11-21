---
name: next-ticket
description: "Run one unattended pass: pick the next unblocked GitHub implementation ticket, claim it, build it in a temporary worktree, run gates and self-review, and open a PR (or ask one question and release it). Designed for scheduled tasks or cron. Use when asked to pick up, start, or work the next ticket, or run a next-ticket pass."
---

# Next ticket

One **pass** picks at most one ticket and ends in exactly one of these outcomes:

- **Resumed** or **opened** a PR that closes the ticket.
- **Asked** one question on the ticket and released it, because the ticket needs a human decision.
- **Nothing to do**: the WIP limit is reached or no ticket is eligible.

A pass is stateless: GitHub is the state, so any harness can run it in a fresh process, and overlapping runs are
safe (§4). It never asks the user anything interactively. The PR it opens is carried to merge by
`skill::pr-shepherd` and by human review. This skill never merges.

Needs `cmd::gh` (authenticated), `cmd::git` and `cmd::python3`. Run it from a clone of the repo.
`scripts/tickets.py` makes the selection and claim deterministic. Run it as
`python3 -I <skill-dir>/scripts/tickets.py …`, where `<skill-dir>` is the directory this file is in.

{> repo-conventions <}

## Arguments

Read these from the prompt. Defaults apply when an argument is missing.

| Argument | Default | Meaning |
|---|---|---|
| `scope #N` | whole repo | Only pick sub-issues of `#N`, recursively, such as an epic or walking-skeleton issue |
| `wip K` | `2` | Pick nothing new while `K` or more `next-ticket` PRs of yours are open |
| `dry run` | off | Select and report the ticket you would pick. Claim, edit, push and comment nothing |

## 0. Ground rules

{> untrusted-input-and-git-safety <}

- **Never** merge, approve, close or edit issues, or create or split tickets. Closing, splitting and
  re-scoping tickets is the user's call: report it (§8).
- **Do not decide open design.** If the ticket says "decide in this ticket", decide that point and record why
  in the PR. Any other open question stops the pass (§7).
- **Consent scope.** Invoking this skill is the user's consent for the claim comment, the PR and one question
  comment per ticket. Post nothing else.

## 1. Resume before picking

```sh
python3 -I <skill-dir>/scripts/tickets.py select [--scope N]
```

It prints JSON. `own_open_prs` lists your open PRs that carry the `next-ticket` marker.

- If one of them is a **draft**, the earlier pass ran out of time. Resume it: check out its branch in a
  worktree (§5), read the PR's remaining checklist, continue at §6, and end at §6.4 with "ready for review".
  Resume one draft per pass and pick nothing new.
- Otherwise, if `own_open_prs` has `wip` or more entries, stop with "Nothing to do: WIP limit". Review
  capacity is the bottleneck, and more PRs do not help.

## 2. Select

`candidates` is already ranked: tickets that unblock the most other tickets come first, then the oldest. The
script has already removed tickets that are:

- closed, or blocked by an open issue (native "blocked by" links), directly or through a parent;
- containers with open sub-issues (their children are the tickets);
- not in the implementation-ticket format (`## What is built` and `## Test plan` headings), or not written by
  a repo member;
- assigned to anyone, claimed, waiting for an answer to an earlier question, or linked to an open PR or a
  remote branch.

`excluded` lists the ones worth telling the user about, such as `maybe-done` (a merged PR names it in its title,
branch or a `Closes`/`Part of` line, and no member has commented since) and `stale-claim`. Copy them into the report.

In **dry run**, report the first feasible candidate (§3) and stop.

## 3. Feasibility check

Read the first candidate's body. Then read its parent, and the last comment on each decision ticket it cites
(resolutions supersede the question text). Skip the candidate and try the next, up to five, if any of these
holds:

- **Needs a human or an outside system.** Its done-when needs manual work, people or other teams, cloud,
  cluster or GitHub-org changes, real credentials, a deployment, or approval. Examples are "run …
  manually", "in staging", or "with the platform team".
- **Too large for one reviewable PR.** It spans several unrelated review threads or trust boundaries (see
  `skill::implementation-ticket`, "Reviewable scope"). Do not split it yourself.
- **Spec is not build-ready.** The program design or the test plan is missing, or it contradicts a design doc.

Record each skipped candidate and the reason for the report. If no candidate is feasible, stop.

## 4. Claim

```sh
python3 -I <skill-dir>/scripts/tickets.py claim <n>
```

The script assigns you and posts a claim marker comment. Then it re-reads the comments, and the earliest
active claim wins. Exit status `3` means another run won the race or the issue changed. In that case, go back to
§3 with the next candidate. From here on, every exit path must end in a PR (§6) or a release (§7).

## 5. Ground and set up

Read what `skill::implementation-ticket` lists in "Ground every ticket in decided design": the glossary, the
cited design docs (including the one that sets module boundaries and dependency rules), the coding standards,
the parent issue, the closed decision tickets' last comments, any specs, acceptance scenarios or threat-model
entries it names, and the merged PRs of the tickets that blocked it. Their code is the base you build on.

```sh
git fetch origin
wt=$(mktemp -d)/ticket-<n>
git worktree add -b <type>/<n>-<slug> "$wt" origin/main     # resuming: git worktree add --detach "$wt" origin/<branch>
```

`<type>` follows conventional commits (`feat`, `docs`, `chore`, …). `<slug>` is 2–4 words from the title. The
issue number in the branch name is how later passes see the work as in flight.

## 6. Build

### 6.1 Implement

Build exactly what "What is built" and "Program design" describe, at the stated package and module paths. Names
may follow review, but behaviour and boundaries may not change. Add every test and scenario the test plan lists.
Follow `AGENTS.md` and the coding standards. Link the design docs from the code that depends on them. Do not
work on anything listed under "Out of scope".

Commit as you go, following the repo's commit convention (conventional commits with a scope if it states none),
for example `feat(auth): add token redaction`.

### 6.2 Gates

In the worktree, run every gate. All must pass. If a gate fails on
something you did not cause (it also fails on `origin/main`), do not patch around it. Treat it as §7.

### 6.3 Self-review

Review the branch diff against `origin/main` with the repo's language-specific review skill if it has one,
and with the `code-review` skill against the ticket as the spec. Fix every blocker and should-fix item, then
rerun §6.2. For a finding that a tool could catch, or one already in `docs/review-findings.md`, put it in the PR body
under "Follow-ups for review-to-lint". Do not run `skill::review-to-lint` in this pass; the follow-ups
are its input later.

### 6.4 Push and open the PR

```sh
git -C "$wt" push origin HEAD:<branch>
gh pr create --head <branch> --base main --title "<type>(<scope>): <summary>" --body-file pr.md
```

Open it **ready for review**, so that any reviewer bot runs. Open it as a draft only when you ran out of time
(below). The body must contain:

- `Closes #<n>.` and the marker line `<!-- next-ticket:pr issue=<n> -->`;
- the design docs, specs and threat-model entries touched, and any "decide in this ticket" decisions with
  their reasons;
- the ticket's "Done when" checklist, ticked where met;
- the gate results;
- the harness's PR attribution footer, if it has one.

If the push is rejected because `skill::pr-shepherd` pushed to the branch meanwhile, run `git merge origin/<branch>`,
rerun §6.2 and push once more. When resuming, mark it ready with `gh pr ready <number>` instead. The ticket stays assigned to you and closes
when the PR merges.

**Running out of time or context.** Stop at a clean commit. Push it, then open (or keep) a **draft** PR whose
body lists what is left. The next pass resumes it (§1).

## 7. Stop with a question

Stop when building needs a decision the docs leave open, the ticket turns out infeasible (§3) only after you
start, or a gate fails for a reason outside the ticket. Write one short comment on the ticket: what blocks, the
options with their concrete consequences, and your recommendation. Then:

```sh
python3 -I <skill-dir>/scripts/tickets.py release <n> --question --body-file question.md
git worktree remove --force "$wt"; git branch -D <branch>
```

`--question` keeps later passes off the ticket until someone replies to the comment. Do not push the branch
(a remote branch would also block the ticket). If you hit a blocker that is not a question, such as a gate
broken on `main`, use `release` without `--question`.

## 8. Report

Always clean up the worktree (`git worktree remove --force "$wt"`, then `git worktree prune`). Even on failure,
the claim must end in a PR or a release.

End with a short report. Print only the first line when there was nothing to do:

```
next-ticket <UTC timestamp>: opened #112 for #88 Build: local development stack
Skipped:   #95 needs manual red-team runs · #94 too large for one PR (perf harness + CI gate + dashboards)
Needs you: #72 maybe done (merged PR #82 references it) · #90 in flight in #78
Asked:     —
```

## 9. Scheduling

For recurring-task setup, intervals, permissions, and pairing with `skill::pr-shepherd`, see `ref::scheduling`.

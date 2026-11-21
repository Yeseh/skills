# Scheduling `next-ticket`

Every pass is self-contained, so schedule the same prompt with the harness's own recurring-task feature:

```
Run one pass of the next-ticket skill.            # optionally: "scope #28, wip 2"
```

- **Pick a long interval**, such as one to two hours. A pass that builds a ticket can take a long time, and the
  WIP limit makes frequent runs do nothing.
- **Prefer a fresh session per run** (scheduled tasks, cron with the CLI's non-interactive mode). A
  session-scoped loop (for example `/loop 2h /next-ticket` in Claude Code) also works, but its context grows
  with every pass.
- **Grant the permissions a pass needs** without prompting: `gh`, `git`, `python3`, the gate tools and file edits in
  the temporary worktree. A permission prompt in an unattended run stalls the pass while the ticket stays
  claimed.
- **Run `pr-shepherd` next to it** (every 10 minutes) to move the PRs this skill opens through checks,
  review fixes and merge. Merging a PR unblocks the next tickets for later passes.

Overlapping passes are safe because of the claim race (§4 of `next-ticket`). A pass that is killed hard leaves the
ticket assigned and claimed. After 24 hours it shows up as `stale-claim`. Release it with
`tickets.py release <n>` to let a later pass retry it.

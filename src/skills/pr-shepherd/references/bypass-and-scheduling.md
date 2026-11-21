# Bypass Merge (§2.1) and Scheduling (§7)

## Bypass merge (§2.1)

Only with the `bypass` argument. An own, non-draft PR may be merged without a human approval when every other row of the readiness table (§2) holds:

- checks green, none pending;
- no unresolved review threads, and no conversation comment by a human that is still unanswered (§3);
- `mergeable == "MERGEABLE"`, and `mergeStateStatus` is `CLEAN`, or `BLOCKED` while everything else here holds (so the missing approval is what blocks it);
- no human has a `CHANGES_REQUESTED` latest review. Bypass replaces a missing approval, never a request for changes.

Address the PR's work items (§3) first. A PR that got a push in this pass is not merged in the same pass, because its checks and any review bots have to run again. Merge pinned to the head (swap `--squash` for `--merge` or `--rebase` if squash is not allowed):

```sh
gh pr merge <number> --squash --admin --match-head-commit <headRefOid>
```

After the merge succeeds, record the decision on the PR so a reader can see why it merged without an approval. Fill in the values you checked and post it with `gh pr comment <number> --body-file <file>`:

```markdown
Auto-merged by `pr-shepherd` with `bypass` (§2.1): admin merge without a human approval, because every other
merge condition held at head `<short head>`:

- [x] Checks green: <passed> of <total> passed, none pending
- [x] No unresolved review threads, no unanswered human comments
- [x] No human `CHANGES_REQUESTED`
- [x] Mergeable: `MERGEABLE`, blocked only by the missing approval

Merged with `gh pr merge --squash --admin --match-head-commit <short head>` as `<short merge commit>`.
```

If the merge fails, post nothing and report why. If only the comment fails, report that. Mark the PR in the report as `(bypass)`. Without the `bypass` argument, such a PR stays under "Waiting: not approved".

## Scheduling every 10 minutes (§7)

Each pass runs in a fresh, non-interactive agent process, so context does not grow and any harness works. From the repo root:

```sh
<skill-dir>/scripts/run-every.sh -- <agent-cli> <non-interactive flags> "Run one pass of the pr-shepherd skill."
```

Append arguments to the prompt, for example `"Run one pass of the pr-shepherd skill with bypass, team my-org/reviewers."`.

Use the agent CLI's non-interactive (print/exec/run) mode, with permissions that let it run `gh`, `git`, and the repo gates without prompting. The script runs passes back to back with 10 minutes between them (`-i <seconds>` to change it). It holds a lock so passes against the same clone never overlap, and it appends output to `.git/pr-shepherd.log`. Stop it with Ctrl-C. For cron, `-1` runs a single locked pass:

```
*/10 * * * * cd /path/to/repo && <skill-dir>/scripts/run-every.sh -1 -- <agent-cli> <flags> "Run one pass of the pr-shepherd skill."
```

If a pass is killed hard (`kill -9`, reboot), remove the stale `.git/pr-shepherd.lock` directory.

When a harness has its own recurring-task feature, it can run the same prompt every 10 minutes instead.

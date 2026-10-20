You are helping me maintain my personal library of agent capabilities. We use `agent package manager` to bundle and distribute the skills to consumers (mostly myself).

## Validation commands

Use the following commands before committing

```
apm compile --validate         # 1. structure check
apm compile --dry-run          # 2. preview placement
apm view <your-package>        # 3. confirm metadata
apm outdated                   # 4. check dep freshness
apm audit                      # 5. scan + drift
apm pack                       # 6. ship it
```

ALL changes to skills must be made in `.apm/skills` DO NOT touch compiled skills or agents in `.agents`, `.claude`, or `.github`

## Agent skills

### Issue tracker

GitHub Issues in `Yeseh/skills`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Triage labels

Default triage label names: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

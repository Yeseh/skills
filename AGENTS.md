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
---
name: static-checks
description: Per-stack reference for turning a code rule into a deterministic check. Covers where lint, type, API-ban and dependency rules are configured, how suppressions are written and policed, which type idioms design a mistake out, and the property-test and fuzz tools. Use when adding, auditing or debugging a lint or check, or when choosing how to enforce a coding rule.
---

# Static checks

Find the repo's stacks from its manifests, then read the matching reference for each one:

| Manifest | Reference |
|---|---|
| `Cargo.toml` | [references/rust.md](references/rust.md) |
| `package.json`, `tsconfig.json` | [references/typescript.md](references/typescript.md) |
| `pyproject.toml`, `setup.cfg`, `requirements*.txt` | [references/python.md](references/python.md) |
| `go.mod` | [references/go.md](references/go.md) |
| `*.csproj`, `*.sln`, `*.slnx` | [references/dotnet.md](references/dotnet.md) |

Each reference lists, in order: the gates and toolchain pin, layer 1 (design it out), layer 2 (static
analysis), suppressions, layer 3 (verification), and config gotchas.

The references are a starting map. The repo's own config and the pinned toolchain are the truth: verify every
rule name, config key and flag by running it before you propose it. When a stack has no reference here, find
its equivalent for each section and verify the same way.

For a stack-neutral syntactic pattern that the stack's linter cannot express, use semgrep: a rule in
`.semgrep/*.yml` with a test file of `ruleid:` and `ok:` annotations, run by `semgrep --test`.

# Go

## Gates and toolchain

- Typical gates: `go vet ./...`, `golangci-lint run`, `go test -race ./...`, `gofmt -l` or `gofumpt`, often behind
  a `Makefile` or `Taskfile`.
- Toolchain pin: the `go` and `toolchain` directives in `go.mod`; the `golangci-lint` version (pinned in CI or a
  `tools.go` / `go tool` entry). Its config format changed in v2; check which the repo uses.

## Layer 1: design it out

| Idiom | Prevents |
|---|---|
| Named types for identifiers (`type UserID string`) built by a parse function | Confused identifiers, unvalidated input |
| A secret type with a redacting `String()`, `GoString()` and `MarshalJSON()` | Secrets in logs and responses |
| Unexported struct fields with a constructor | Invalid zero values and partial construction |
| `internal/` packages | Imports from outside the owning subtree (enforced by the compiler) |
| Small interfaces declared by the consumer | Wide dependencies on adapters |

## Layer 2: static analysis

| Mechanism | Where |
|---|---|
| Linters | `.golangci.yml` `linters` (for example `errcheck`, `staticcheck`, `gosec`, `exhaustive`, `contextcheck`) |
| API bans with a message | `forbidigo` patterns with `msg` |
| Import and layering rules | `depguard` rules per file glob; `go-arch-lint` for layer graphs |
| Vulnerable dependencies | `govulncheck ./...` |

## Suppressions

- `//nolint:<linter> // <reason>`.
- Police them with `nolintlint` (`require-explanation`, `require-specific`, `allow-unused: false`).

## Layer 3: verification

- Native fuzzing (`func FuzzX(f *testing.F)`, `go test -fuzz`), `pgregory.net/rapid` for properties,
  `-race` for data races, golden files under `testdata/`.

## Gotchas

- Files behind build tags CI does not set are never compiled or linted. Check `build-tags` in the config.
- `new`, `new-from-rev` or `new-from-patch` in the `golangci-lint` config report only issues in changed code.
  That baseline hides existing instances.
- Generated files (with the standard `// Code generated … DO NOT EDIT.` header) are skipped.

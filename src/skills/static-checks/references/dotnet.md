# .NET

## Gates and toolchain

- Typical gates: `dotnet build -warnaserror`, `dotnet test`, `dotnet format --verify-no-changes`.
- Toolchain pin: `global.json` (SDK version and `rollForward`). Analyzer rule IDs and defaults follow
  `AnalysisLevel`; check against the pinned SDK.

## Layer 1: design it out

| Idiom | Prevents |
|---|---|
| `readonly record struct` value objects for identifiers, with a validating factory | Confused identifiers, unvalidated input |
| A secret type that redacts `ToString()` and has no public value getter beyond one explicit method | Secrets in logs |
| `sealed` classes, `required`/`init` members, nullable reference types (`<Nullable>enable</Nullable>`) | Outside subclassing, partial construction, null bugs |
| `internal` types in separate projects (with `InternalsVisibleTo` only for tests) | Reaching across a project boundary |

## Layer 2: static analysis

| Mechanism | Where |
|---|---|
| Analyzer severities | `.editorconfig`: `dotnet_diagnostic.<ID>.severity = error`; `Directory.Build.props`: `TreatWarningsAsErrors`, `AnalysisLevel`, `AnalysisMode`, `EnforceCodeStyleInBuild` |
| API bans with a message | `Microsoft.CodeAnalysis.BannedApiAnalyzers` (rule `RS0030`) with `BannedSymbols.txt` lines such as `M:System.DateTime.get_Now;Use TimeProvider` |
| Layering rules | Project references (a project that is not referenced cannot be used); architecture tests with `NetArchTest` or `ArchUnitNET` |
| Vulnerable or banned packages | `dotnet list package --vulnerable`, Central Package Management (`Directory.Packages.props`) |

## Suppressions

- `#pragma warning disable <ID>`, `[SuppressMessage("…", "<ID>", Justification = "…")]`, `<NoWarn>` in a
  project file, `GlobalSuppressions.cs`.
- Police them with `IDE0079` (unnecessary suppression) at error and a review rule that `<NoWarn>` lists stay
  empty; `Justification` is not enforced by the compiler.

## Layer 3: verification

- `FsCheck` or `CsCheck` for properties, `SharpFuzz` for fuzzing, `Verify` for snapshots, architecture tests for
  dependency rules the project graph cannot express.

## Gotchas

- MSBuild imports only the nearest `Directory.Build.props` upwards; a nested one must import its parent
  explicitly or the root settings are lost.
- `.editorconfig` cascades from the root down to the file until a file with `root = true`.
- IDE-prefixed style rules are enforced on build only with `EnforceCodeStyleInBuild`.

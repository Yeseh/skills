# TypeScript and JavaScript

## Gates and toolchain

- Typical gates: `tsc --noEmit` (or `tsc -b`), `eslint .`, the test runner (`vitest`, `jest`, `node --test`),
  `prettier --check`, all usually behind `package.json` scripts.
- Toolchain pin: `.nvmrc` / `.node-version`, `engines`, the `packageManager` field, the lockfile. Check the ESLint
  and `typescript-eslint` versions: rule names and config format differ between majors.

## Layer 1: design it out

| Idiom | Prevents |
|---|---|
| Branded types (`type UserId = string & { readonly __brand: "UserId" }`) made only by a parse function | Confused identifiers, unvalidated input |
| A secret class with `#private` storage and a `toJSON`/`toString` that redacts | Secrets in logs and responses |
| Discriminated unions and a `Result` type instead of booleans and thrown expected errors | Unhandled cases (with `switch` exhaustiveness via `never`) |
| `readonly`, `as const`, `Readonly<T>` | Accidental mutation |
| Package `exports` maps, separate workspace packages | Deep imports across a boundary |

## Layer 2: static analysis

| Mechanism | Where |
|---|---|
| Compiler strictness | `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch` |
| Lint rules | `eslint.config.*` (flat config) with `typescript-eslint` type-aware rules such as `no-floating-promises`, `no-misused-promises`, `switch-exhaustiveness-check` |
| API bans with a message | `no-restricted-imports`, `no-restricted-syntax` (AST selectors), `no-restricted-globals`, `no-restricted-properties` |
| Dependency and layering rules | `dependency-cruiser` (`.dependency-cruiser.cjs`) or `eslint-plugin-boundaries`; `knip` for unused exports and dependencies |

## Suppressions

- `// eslint-disable-next-line <rule> -- <reason>`, `// @ts-expect-error <reason>`, `// @ts-ignore`.
- Police them with `@typescript-eslint/ban-ts-comment` (require descriptions, ban `@ts-ignore`),
  `@eslint-community/eslint-comments/require-description` and `no-unlimited-disable`, and
  `linterOptions.reportUnusedDisableDirectives: "error"`.

## Layer 3: verification

- `fast-check` for properties, `@jazzer.js/core` for fuzzing, `tsd` or `expect-type` / `// @ts-expect-error`
  lines in a type test for proof that a layer 1 change rejects the wrong code.

## Gotchas

- Flat config does not cascade by directory: one `eslint.config.*` applies, with `files` globs selecting
  overrides. Legacy `.eslintrc` does cascade; know which one the repo uses.
- Type-aware rules need `parserOptions.projectService` (or `project`). Without it they silently do nothing or
  error, depending on the version.
- Files outside every `tsconfig` `include` are not type-checked. Check the gate covers tests and scripts.
- `tsconfig` `extends` merges `compilerOptions` but replaces `include`/`exclude`/`files`.

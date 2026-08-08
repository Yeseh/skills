---
paths:
  - "**/*.{ts,tsx}"
---

# TypeScript conventions

## Language and tooling

- Use strict TypeScript with `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, and `verbatimModuleSyntax` enabled.
- Use ESM-compatible imports and exports. Keep the code compatible with the repository's configured runtime; for Bun projects, prefer Bun APIs and avoid Node-only APIs unless the project explicitly supports them.
- Use the repository's existing formatter, linter, type checker, and test runner rather than introducing alternatives.

## Types and interfaces

- Use `type` for data structures, error types, result types, and unions.
- Use `interface` for contracts and ports intended to be implemented or extended.
- Use discriminated unions for result and error types. Give errors machine-readable codes and actionable messages.
- Avoid boolean flag parameters. Prefer nullable fields, distinct methods, or an enum when behavior has more than one meaningful mode.
- Default optional arrays to `[]` rather than `undefined` when an empty collection is the natural value.

## Function signatures

- Business-logic functions accept their dependency ports first, followed by operation-specific parameters, and return `Promise<Result<OperationResult, DomainError>>` for fallible asynchronous work.
- Pure helpers should have no I/O dependencies and should remain synchronous.
- Give each operation a focused result type that documents its output and idempotency semantics.
- Declare variables as late as possible and keep type narrowing close to the branch that uses it.

## Paths and platform boundaries

- Use the platform path and operating-system helpers for filesystem paths; never hardcode path separators.
- Keep filesystem, transport, and vendor-specific details outside the core module.

## Testing

- Test success, error, and edge cases for every operation.
- Keep tests isolated. Prefer real temporary directories and injectable dependencies over global module mocking.
- Test both sides of discriminated results with explicit `ok` checks before accessing `value` or `error`.

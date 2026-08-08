---
description: C# conventions derived from DryDock
applyTo: "**/*.cs"
---

# C# conventions

## Language and formatting

- Use modern C# with nullable reference types, implicit usings, collection expressions, raw string literals, records, primary constructors, and pattern matching where they make intent clearer.
- Use file-scoped namespaces and one primary public type per file.
- Use `PascalCase` for types and public members, `camelCase` for parameters and locals, and concise names that match the domain.
- Prefer expression-bodied members for short delegations and predicates. Use blocks when choreography or branching benefits from being read top-to-bottom.
- Represent empty collections with `[]` and append immutable collection properties with collection expressions such as `[.. existing, value]`.

## Async and cancellation

- Accept `CancellationToken ct` as the last parameter of asynchronous operations and propagate it to every cancellable dependency.
- Repository methods use the `Async` suffix. Application-service methods use domain verbs without the suffix, matching the existing layer convention.
- Return `Task` directly for simple delegation; use `async` only when the method performs additional work.
- Dispose resources deterministically with `using` or `await using`.

## Documentation

- Add XML documentation to public domain types, repository contracts, and behavior whose invariants or persistence implications are not obvious.
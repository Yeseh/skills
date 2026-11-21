# Enforcement layers

Go down the layers in priority order and stop at the first one that removes or catches the finding class with few false positives.

## Layer 1: design it out (codebase)

The wrong choice is no longer available, so there is nothing to check.

| Mechanism | Good for |
|---|---|
| Distinct types for identifiers, private constructors, secret types that cannot be printed, compared or serialized by accident, sealed hierarchies, must-use results | Confused identifiers, secret handling, fail-open defaults, ignored errors |
| A supported helper or API that replaces a misused one, then a ban on the misused one (layer 2) | An API that needs too much nuance to use correctly everywhere |
| Module, package or project boundaries and visibility: split a package, make internals non-exported, keep a dependency out of a package's manifest | Code that must not reach across an architectural boundary (for example core and adapters, or across a trust boundary) |
| Refactor the existing instances away | A workaround that agents keep copying |

## Layer 2: static analysis

The compiler or a linter rejects it on every PR.

| Mechanism | Good for |
|---|---|
| A compiler or linter rule at error level | Anything the tool already knows, including rules against unexplained suppressions |
| An API ban | Banning a dangerous or deprecated API, with the replacement in the message |
| A dependency or layering rule | Unwanted packages, layering rules, a dependency only one module may use |
| A semgrep rule | Syntactic patterns the linter cannot express (secrets reaching logs or error strings, workaround patterns) |
| A custom repo check, called from the lint gate | Repo-structural rules: file layout, doc links, glossary aliases in docs, generated-file freshness |

## Layer 3: verification

For behaviour a static check cannot see.

| Mechanism | Good for |
|---|---|
| Unit or integration test | A specific fail-closed path, timeout or error mapping |
| Acceptance or BDD scenario | Behaviour visible at the system boundary; threats from the threat model if the repo keeps one |
| Property-based test, fuzz target, model check | Invariants over all inputs: parsers, policy containment, state machines |

## Layer 4: prose

Only for judgment calls: wording for the coding standards or the review skill's checklist. A finding lands here when a check would need intent or design context (naming, whether a copy is defensive or lazy), when every pattern you can write has many false positives, or when it is a one-off. Say which applies. Never propose a noisy check to tick a box: a lint people learn to suppress is worse than none.

## Rules and notes

- **The error message is the fix instructions.** Whoever hits the check, often an agent, must know what to do without reading anything else. Every ban reason, semgrep `message` and custom check error names the rule ID, says what is wrong and names the supported alternative ("R-LOG-2: request headers can carry credentials; log `redactHeaders(headers)` instead"). Never just "not allowed".
- **Nested config gotchas:** know how the tool resolves config before adding a nested one (the stack reference lists the gotchas).
- **Async-only blocking bans:** a ban on blocking calls fits only code that is async throughout; name where it applies.
- **New-tool pinning cost:** a new tool needs pinning in the toolchain file or dev dependencies and a step in the lint gate or CI. Count that cost.

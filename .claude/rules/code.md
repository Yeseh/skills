---
paths:
  - "**/*"
---

## Code Style 

- Program vertically: keep lines reasonably short and organize code into focused, readable steps.
- Declare values close to where they are used. Keep a value's declaration and the control flow that operates on it together, with whitespace separating logical sections.

## Error handling

- Prefer errors as values over exceptions for expected outcomes. Use the language's discriminated-union or result type when available.
- Define machine-readable error codes alongside actionable human-readable messages.
- Translate infrastructure and vendor errors into domain errors at adapter boundaries. The adapter implementations do not have an opinion about how the domain should handle it. IE a `NotFound` error in the adapter might be expected in the specific domain scenario
- Map every expected result or error case explicitly at the application or transport boundary. Do not silently default or swallow errors.

## Architecture

- Use ports and adapters (hexagonal architecture). The core module owns domain types, invariants, and business operations; adapters contain infrastructure-specific implementations.
- Define narrow, cohesive interfaces for dependencies. Avoid monolithic service or storage interfaces.
- Keep adapter implementations focused on persistence or integration concerns and expose only the setup and operations consumers need.
- Keep externally facing applications such as user interfaces, CLIs, REST APIs, and jobs thin: validate and transform input, call core operations, and format the result.
- Do not make entrypoints depend directly on one another; share behavior through the core or application layer.
- Put each externally exposed operation in a focused module with its input and output types close to the operation. Avoid god controllers and handlers.
- Keep domain state and invariants in domain entities. Put lifecycle operations on the entity instead of reproducing domain rules in services.
- Put multi-step application choreography in focused services: fetch, authorize, mutate, persist, then notify.

## Data and persistence

- Treat query scope, partitioning, and authorization scope as part of repository correctness.
- Parameterize untrusted query values and validate any bounded values used in query construction.
- Project only the fields needed by an operation, and keep projections aligned with the persisted shape.
- Stamp server-owned metadata such as timestamps and partition keys in the domain operation or repository that owns the write.

## Asynchronous operations

- Propagate cancellation from the boundary through every cancellable dependency.
- Dispose resources deterministically, including resources used by asynchronous operations.
- Use asynchronous control flow only when needed; preserve direct delegation for simple pass-through operations.

## API and observability

- Use OpenTelemetry for structured logs, tracing, and metrics
- Keep transport-specific logging and telemetry at the edge of the system.
- Use structured logs with stable, named properties rather than interpolated messages.
- Use stable, low-cardinality telemetry names, tags, and values.
- Map domain outcomes to the transport's standard success and error representations.

## Documentation and comments

- Document public domain types, dependency contracts, and behavior whose invariants or persistence implications are not obvious.
- Comments should explain intent, constraints, authorization, or non-obvious trade-offs—not restate the code.
- Preserve established domain terminology in names and documentation.

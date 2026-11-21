# Rust

## Gates and toolchain

- Typical gates: `cargo clippy --workspace --all-targets --all-features -- -D warnings`, `cargo test --workspace`,
  `cargo fmt --check`, often wrapped in a `cargo xtask lint` task or a `justfile`.
- Toolchain pin: `rust-toolchain.toml`. Lint names change between releases; check against the pinned one.

## Layer 1: design it out

| Idiom | Prevents |
|---|---|
| Newtypes (`struct UserId(Uuid)`) with private fields and a validating constructor | Confused identifiers, unvalidated input |
| A secret wrapper with no `Debug`/`Display`/`Serialize`/`PartialEq` (or the `secrecy` crate) | Secrets in logs, timing-unsafe compares |
| `#[must_use]` on results and guards | Ignored outcomes |
| Sealed traits, `#[non_exhaustive]` enums | Outside implementations, exhaustive matches that break |
| `pub(crate)`, splitting a crate, keeping a dependency out of a crate's `Cargo.toml` | Reaching across an architectural boundary |

## Layer 2: static analysis

| Mechanism | Where |
|---|---|
| rustc and clippy lints, including `restriction` lints | `[workspace.lints.rust]` / `[workspace.lints.clippy]` in the root `Cargo.toml`; each crate needs `[lints] workspace = true` |
| API bans with a reason | `clippy.toml`: `disallowed-methods`, `disallowed-types`, `disallowed-macros` (`{ path = "…", reason = "…" }`) |
| Dependency rules | `deny.toml` (`cargo-deny`): `[bans]` with `deny` and `wrappers` (which crates may use a dependency), `[licenses]`, `[sources]` |
| Crate graph rules | An `xtask` check over `cargo metadata` |
| Async hazards | `clippy::await_holding_lock`, `clippy::await_holding_refcell_ref` |

## Suppressions

- `#[allow(lint)]`, `#[expect(lint, reason = "…")]` (`expect` warns when the lint stops firing).
- Police them with `clippy::allow_attributes` (forces `expect`) and `clippy::allow_attributes_without_reason`.

## Layer 3: verification

- `proptest` or `quickcheck` for properties, `cargo-fuzz` for fuzz targets, `trybuild` for compile-fail tests
  (proof that a layer 1 change rejects the wrong code), `insta` for snapshots.

## Gotchas

- `clippy.toml` is resolved per crate from the nearest directory upwards and does **not** merge. A crate-level
  `clippy.toml` replaces the root one, so it must repeat the workspace settings.
- A lint at `warn` only fails the gate with `-D warnings`. Check the gate passes it.
- Code behind a `cfg` or feature that CI does not build is never linted. Check `--all-features` or a feature
  matrix.
- A `disallowed-methods` ban on blocking calls fits only crates that are async throughout.

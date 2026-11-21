# Python

## Gates and toolchain

- Typical gates: `ruff check`, `ruff format --check`, `mypy` or `pyright`, `pytest`, often behind `uv run`,
  `nox`, `tox` or a `Makefile`.
- Toolchain pin: `.python-version`, `requires-python`, the lockfile (`uv.lock`, `poetry.lock`). Ruff rule codes
  and defaults change between releases; check against the pinned one.

## Layer 1: design it out

| Idiom | Prevents |
|---|---|
| `typing.NewType` or frozen dataclasses for identifiers, built by a parse function | Confused identifiers, unvalidated input |
| A secret type that redacts `__repr__`/`__str__` (or pydantic `SecretStr`) | Secrets in logs |
| `Enum`/`Literal` instead of flags and strings; `match` with `assert_never` | Unhandled cases |
| `@final`, `Protocol` ports, leading-underscore modules with an explicit `__all__` | Outside subclassing, reaching into internals |

## Layer 2: static analysis

| Mechanism | Where |
|---|---|
| Lint rules | `[tool.ruff.lint]` `select` / `extend-select` in `pyproject.toml` or `ruff.toml` |
| API bans with a message | `[tool.ruff.lint.flake8-tidy-imports.banned-api]` (`"module.name".msg = "…"`) |
| Type strictness | `[tool.mypy]` `strict = true` (per-module overrides), or `[tool.pyright]` `typeCheckingMode = "strict"` |
| Layering and import rules | `import-linter` contracts (`layers`, `forbidden`, `independence`) in `[tool.importlinter]` |
| Dependency hygiene | `deptry` for missing and unused dependencies |

## Suppressions

- `# noqa: <CODE>`, `# type: ignore[<code>]`, `# pyright: ignore[<rule>]`.
- Police them with ruff `PGH004` (blanket `noqa`), `PGH003` (blanket `type: ignore`) and `RUF100` (unused
  `noqa`), and mypy `warn_unused_ignores`.

## Layer 3: verification

- `hypothesis` for properties (and stateful tests), `atheris` for fuzzing, `syrupy` for snapshots. For proof that
  a layer 1 change rejects the wrong code, a test that runs the type checker over a snippet that must fail.

## Gotchas

- Ruff uses the nearest config file and does not merge parents unless the child says `extend = "…"`.
- mypy skips the bodies of unannotated functions unless `check_untyped_defs` (included in `strict`) is on.
- Modules outside the configured `files`/`packages` or excluded paths are never checked. Check the gate covers
  tests and scripts.

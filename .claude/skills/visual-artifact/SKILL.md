---
name: visual-artifact
description: Build polished, shareable HTML reports, plans, and documentation from reusable visual components. 
disable-model-invocation: false 
---

# Visual Artifact

Use this skill explicitly when the user needs a polished HTML report, implementation plan, or stakeholder-facing documentation. Build a JSON manifest from an ordered list of components, then use the bundled renderer. Do not hand-author a new HTML design.

## Workflow

1. Determine the artifact’s audience, purpose, title, status, and required sections from the request and repository context.
2. Gather only the source material needed for the artifact. Preserve factual distinctions between confirmed facts, recommendations, assumptions, and open questions.
3. Copy `examples/artifact.json` to a temporary manifest and compose its ordered `components` list. Keep components independently renderable and give each a stable `id`.
4. Run `node <skill-directory>/scripts/render.mjs <manifest.json> [output.html]`. The renderer inlines the predefined component runtime, styles, OpenAPI JSON, and local images into one self-contained HTML file.
5. Save reports and plans under `docs/artifacts/` unless the user names another destination.
6. Open the artifact when a local desktop is available and provide its absolute path. If it cannot be opened automatically, still provide the path.

## Component model

Represent the document as an ordered tree in the JSON manifest. Every component has a `type`, stable lowercase kebab-case `id`, and type-specific properties:

- `section`: A titled container with an ordered `children` list. Sections may nest; leaf components may not contain children.
- `prose`: Markdown-like headings, paragraphs, bold, italic, links, lists, blockquotes, and inline code. Raw HTML is always escaped.
- `code`: Source, commands, diffs, or terminal output. Set `content`, optional `language`, `filename`, `copy`, `lineNumbers`, `highlights`, and `mode` (`plain`, `diff`, or `terminal`).
- `callout`: A title and Markdown-like body with a generic `tone`: `neutral`, `info`, `success`, `warning`, or `danger`.
- `table`: Structured `columns` and object or array `rows`.
- `steps`: An ordered `items` list with title, description, and `complete`, `current`, or `pending` status.
- `image`: An embedded screenshot or diagram with alt text, caption, and optional title.
- `openapi`: A specialized API reference. Set `source` to local OpenAPI JSON or set `spec` to an object; optionally provide `paths`.

Use `examples/artifact.json` as the manifest reference. Compose purpose-specific artifacts from this grammar instead of inventing report-specific types. If a genuinely reusable visual primitive is missing, extend `assets/components.js` and `assets/styles.css` so future artifacts inherit it.

## Visual system

The predefined implementation lives in `assets/components.js` and `assets/styles.css`. Reuse it unchanged for normal artifacts. It defines standard custom elements for every visual grammar type.

Customize an artifact through its `theme` object, not by rewriting component CSS. Supported tokens are `accent`, `accent-soft`, `on-accent-soft`, `background`, `surface`, `text`, `muted`, `border`, `success`, `warning`, `danger`, `code-bg`, `code-text`, `radius`, `shadow`, `font-body`, and `font-mono`. The renderer derives `on-accent-soft` for readable contrast when only `accent-soft` is customized; set both to take explicit control. Omit tokens to retain the consistent defaults.

## OpenAPI rendering

If an OpenAPI specification changed or is provided, point the component at the actual JSON document rather than inventing an API summary. Convert YAML to JSON with the project’s existing tooling first; the dependency-free renderer intentionally accepts JSON only. Use `paths` when the request concerns selected operations.

## Commands and sharing

Copyable code must preserve its content exactly. Keep secrets out of commands and output; use documented environment-variable placeholders such as `$API_TOKEN` and label required setup. Copy buttons must work without a network connection.

The final artifact must stand alone when emailed or opened from a local file. Include a compact header with title, purpose, generated date, and status; a table of contents for multi-section artifacts; and a footer identifying the source/revision when known. Avoid embedding private source material or credentials.

## Quality bar

Before handing off, run the renderer and inspect the generated HTML for the expected title, components, embedded assets, and absence of secret values. Open it at narrow and wide widths when browser tooling is available. Never replace renderer failures with hand-written HTML.

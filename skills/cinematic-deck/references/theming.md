# Theming

The look of a deck is a decision taken from the brief, not a default. The engine is style-agnostic; a theme is one CSS file that sets tokens, optionally draws a backdrop, and picks a motion intensity. The same slides render in any theme.

## Layers

| File | Owns | Edit? |
|---|---|---|
| `deck/deck.css`, `deck/deck.js` | Stage, transitions, entrances, builds, state, navigation | No |
| `deck/diagram.css`, `deck/diagram.js` | Diagram geometry, edges, flows, traces | No |
| `deck/base.css` | Semantic classes built from tokens, neutral defaults | No |
| `theme.css` | Token values, backdrop, rare overrides | Yes, per deck |
| `<style>` in `index.html` | Deck-specific components, written with tokens | Yes |

## Deriving a theme from the brief

Settle these with the user before writing tokens:

1. **Light or dark**, from the venue: bright rooms and projectors favour light; stages, screen-shares of dark IDEs and evening events favour dark.
2. **Brand:** colours, fonts and logo if the talk represents an organisation. Brand colours go into `--accent` (and `--accent-2`); keep `--fg` / `--bg` neutral for contrast.
3. **Character:** one or two words, e.g. calm, technical, editorial, playful, cinematic. They decide type, backdrop and motion together.
4. **Motion:** `--motion` from 0 to 1.5. About 0.3 is quiet (boardroom, dense technical content), 0.6 is moderate, 1 is cinematic (keynotes, launches). The transitions keep their meaning at every level.

| Character | Type | Backdrop | Motion |
|---|---|---|---|
| Calm / corporate | One sans family, heavy display weight, tight tracking | None or a faint tint | 0.2–0.4 |
| Technical | Sans + mono, mono labels, square corners | Grid, dots, schematic frame | 0.5–0.7 |
| Editorial | Serif display, sans body, italic emphasis | Paper tone, generous margins | 0.4–0.8 |
| Cinematic | Large serif or condensed display | Drifting gradients, grain, vignette | 0.9–1.2 |

`scripts/template/themes/` in this skill holds three worked examples of this table: `plain.css` (calm), `blueprint.css` (technical) and `nocturne.css` (cinematic). Start from the closest one or from blank; they are examples to depart from.

## Tokens

All optional; unset tokens fall back to the neutral light defaults in `deck/base.css`.

| Group | Tokens |
|---|---|
| Colour | `--bg` `--bg-2` (deeper or edge tone) `--surface` (panels; colour or gradient) `--surface-solid` (opaque, used behind labels and stacked nodes) `--fg` `--muted` `--line` `--accent` `--accent-2` `--on-accent` `--danger` `--warning` `--success` |
| Type | `--font-display` `--font-sans` `--font-mono` `--display-weight` `--display-tracking` `--display-leading` `--display-case` `--em-style` `--em-color` `--kicker-case` |
| Size | `--size-display` `--size-title` `--size-heading` `--size-statement` `--size-lede` `--size-body` (stage px) |
| Shape | `--radius` `--radius-lg` `--border-width` `--shadow` `--panel-blur` |
| Motion | `--motion` `--vt-wait` (delay before entrances) |
| Code | `--code-bg` `--code-tag` `--code-attr` `--code-str` |
| Diagrams | See the diagram reference: `--node-*`, `--group-*`, `--edge-*`, `--flow-color`, `--trace-color` |
| Chrome | `--progress` (progress bar fill) |

## Hue

Each slide's `data-hue` animates `--hue`. The theme decides its role:

- **Everything follows hue** (Nocturne): write colours as `oklch(L C var(--hue))`; each slide re-tints.
- **Accent only** (Blueprint, Plain): fixed `--bg`/`--fg`, `--accent: oklch(.55 .19 var(--hue))`.
- **Ignore hue**: brand decks with fixed colours; set every colour without `var(--hue)`.

With a fixed brand palette, either ignore hue or give slides the brand hues only.

## Backdrop

`<div class="backdrop">` is fixed behind the stage, with `::before`, `::after` and three empty `<i>` layers that are hidden by default. A theme styles any of them: drifting radial gradients, a grid, grain, a vignette, a frame. `--px` / `--py` (pointer position, −1 to 1) are available for parallax. Stop any animation under `prefers-reduced-motion`.

## Fonts

`@import` Google Fonts at the top of `theme.css` for the look, and always list system fallbacks. If the deck must work offline (conference wifi), use system stacks or copy the font files into `assets/` with `@font-face`.

## Overrides

Prefer a token to an override. Override a base rule only for something tokens cannot express (uppercase buttons, a glass effect on panels), and keep each override to one line in `theme.css`. Deck-specific components in `index.html` use tokens only, so swapping `theme.css` restyles them too.

## Checks

- Body text against `--bg` and `--surface` reaches 4.5:1 contrast, large headings 3:1. Check `--muted` especially.
- `--on-accent` is readable on `--accent` (primary buttons).
- Open the slides with the most diagrams and the most text in the new theme; those break first.

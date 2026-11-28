---
name: cinematic-deck
description: "HTML slide decks in any visual style, from plain to cinematic, with builds, shared-element morphs, live state (inputs, buttons, polls) and animated architecture, traffic, trace and sequence diagrams. Use to build or edit a presentation, talk, or slide deck in HTML, especially technical and infrastructure talks."
---

# Cinematic deck

Build a presentation as plain HTML on a small bundled engine: no framework, no build step, opens from `file://`. The engine owns motion, state, navigation and diagrams; the deck owns its story; a one-file theme owns the look. Style is decided from the brief every time. The bundled themes are worked examples, never a default.

Skill files (paths relative to this skill's directory):

| Path | What |
|---|---|
| `scripts/template/deck/` | The engine: `deck.js`, `deck.css`, `diagram.js`, `diagram.css`, `base.css` |
| `scripts/template/themes/` | Example themes: `plain.css` (calm), `blueprint.css` (technical), `nocturne.css` (cinematic) |
| `references/showcase.html` | A 16-slide deck using every feature, in all three themes (`T` switches). The pattern library: copy markup from it. |
| `scripts/new-deck.sh` | Scaffolds a deck folder |
| `scripts/check.mjs` | Walks every slide and build step headlessly: screenshots, console errors, layout and markup problems |

## Step 1: Take the brief

Collect: audience, the talk's purpose, time slot, venue (projector, stage, screen-share, shared link), and the style direction. Ask with the AskUserQuestion tool for whatever the request leaves open. Ask about style whenever the user has not described one. Offer a recommendation from the venue and audience, and offer "match our brand" when the talk represents an organisation.

Done when you can state the thesis in one sentence and name the style direction (light or dark, character, motion level, brand constraints).

## Step 2: Outline the story

Read `ref::storytelling`. Choose the arc that fits the talk's purpose, then write the outline: one line per slide with its archetype, its assertion title, and its builds or interaction. Plan technical content as diagrams: architecture build-ups, request traces, flows and sequences. Plan interaction only where it changes understanding: a failure toggle, a throughput slider, a poll the recap reuses.

Show the outline to the user when the deck has more than about eight slides, and revise it until they agree. Done when every slide sets up, proves or lands the thesis, and each has exactly one point.

## Step 3: Scaffold

Put the deck in `presentations/<slug>/` when the project has a `presentations/` folder; otherwise ask where it goes. Run:

```sh
<skill-dir>/scripts/new-deck.sh <target-dir> [blank|plain|blueprint|nocturne]
```

Pick the example theme closest to the style direction, or `blank` to write one from scratch. The script copies the engine into `deck/`, writes `theme.css` and a starter `index.html`, and refuses to overwrite an existing deck.

To edit an existing deck instead, skip this step and read its `index.html` and `theme.css` first.

## Step 4: Theme

Read `ref::theming`. Turn the style direction into tokens in `theme.css`: colours, type, shape, `--motion`, how `--hue` is used, and an optional backdrop. Deck-specific components go in the `<style>` block of `index.html` and use tokens only, so the theme can change later without touching slides.

Done when `theme.css` expresses the brief's character and every token you changed passes the contrast checks in the theming reference.

## Step 5: Author the slides

Read `ref::authoring` for the markup vocabulary. Read `ref::diagrams` before the first diagram, trace or sequence slide. Build the outline slide by slide in `index.html`:

- One `<section class="slide">` per outline line, with `id`, `data-title`, and a `data-transition` chosen by meaning.
- Entrances (`data-anim`, `data-split`), builds (`data-step`), and state bindings exactly as the outline planned.
- Speaker notes on every slide: what to say, when to press, what to click.
- Initial state in `#deck-state`; computed values and custom actions in the deck script.

Done when every outline line has its slide and every planned build and interaction is wired.

## Step 6: Verify

Run the checker. It needs Playwright; if no bundled browser is installed, set `CHROMIUM_PATH` to a system Chromium:

```sh
node <skill-dir>/scripts/check.mjs <target-dir>/index.html
```

It prints the screenshot folder and three sections: console, layout, markup. Fix every reported problem and run it again until all three are clean. Then open every screenshot and look at it: text crowding, edges crossing labels, weak contrast, a slide carrying two ideas, a diagram past 12 nodes. The checker cannot see these. Click through each interactive slide in the speaker notes' order, at least once.

Done when the checker exits 0 and you have viewed every screenshot and fixed what they show.

## Step 7: Hand over

Give the user the absolute path to `index.html`, the keys (`→` next, `O` overview, `S` speaker view, `F` fullscreen, `Shift+R` clear saved state), and anything that needs a network connection (Google Fonts). Mention that saved audience state persists per browser until cleared.

## Engine boundaries

Edit `deck/` only to fix an engine bug, and tell the user what you changed so the fix can go back into this skill's engine for the next deck. A capability the engine lacks belongs in the deck script first (custom actions, `deck.on` hooks, computed values); a pattern needed by several decks belongs in the engine.

# Authoring slides

The markup vocabulary of the engine. Everything is HTML attributes on ordinary elements; the deck's own `<script>` adds computed values and custom actions. `references/showcase.html` uses every feature below. Copy patterns from it.

## Page structure

```html
<div class="backdrop" aria-hidden="true"><i></i><i></i><i></i></div>   <!-- theme may use the layers -->
<main class="deck" data-id="talk-slug" data-transition="cinematic">       <!-- data-id scopes saved state -->
  <div class="stage">                                                     <!-- fixed 1920×1080, scaled to fit -->
    <section class="slide center" id="intro" data-hue="250" data-title="Intro">…</section>
  </div>
</main>
<script type="application/json" id="deck-state">{ "name": "" }</script>
<script src="deck/deck.js"></script>
<script src="deck/diagram.js"></script>
<script>/* deck.computed(…), deck.action(…) */</script>
```

Design in stage pixels: the stage is always 1920×1080 and scales to the window, so `font-size: 72px` is the same proportion on every screen.

## Slide attributes

| Attribute | Effect |
|---|---|
| `id` | Hash route (`#/intro/2`) and `goto:` target. Unique. |
| `data-title` | Name in the speaker view and overview. |
| `data-transition` | `cinematic` · `push` · `zoom` · `fade` · `wipe` · `morph`. Forward uses the incoming slide's value, back uses the outgoing one. |
| `data-hue` | Sets `--hue` (animated). A number, or `@path` to read state/computed values. The theme decides what hue does. |
| `data-require` | Condition that must hold before "next" leaves the slide. Mark the hint with `data-require-hint`; it shakes when blocked. |

## Layout and type classes

From `deck/base.css`. Slides: `.center`, `.split` (two columns), `.split-wide` (1.6 : 1), `.full` (top-aligned, for diagrams). Helpers: `.row`, `.stack`, `.cols-2`, `.cols-3`, `.swap` (children share one cell), `.layer-back` (behind content), `.spacer`.

Type: `.kicker`, `.display`, `.title`, `.heading`, `.statement`, `.lede`, `.small`, `.muted`, `.accent`, `.gradient-text`; `<em>` inside headings uses the theme's emphasis. Blocks: `.panel`, `.callout`, `.tag`, `.code` (lines as `<span class="ln">`, tokens `.tg` `.at` `.st`), `kbd`. Controls: `.btn`, `.btn.primary`, `.link`, `.field`, `.range`, `.toggle`.

## Entrances

Replay every time a slide becomes active (not when navigating back).

- `data-anim="rise | fade | blur | scale | pop | left | right | reveal | wipe | draw | kenburns"`; `draw` needs `pathLength="1"` on the SVG shape.
- `data-delay="300"` (ms), `data-duration="1200"`.
- `data-stagger="120"` on a parent spaces the delays of its `data-anim` children; the parent's `data-delay` is the base.
- `data-split` (letters) or `data-split="words"` on a heading. Nested `<em>` is kept; a `data-tpl`/`data-bind` span inside enters as one unit.
- `data-count="240"` counts up from 0 on entry (`data-duration` sets the time); decimals follow the target.
- `data-depth="40"` adds pointer parallax (negative moves against the pointer). It uses the `translate` property, so it composes with entrances.

## Builds

Each "next" press advances the current slide's step before moving on; "back" from the next slide lands on the last step.

- `data-step="2"`: shown from step 2. `data-step-until="3"` hides it again after step 3; inside `.swap` this makes captions that replace each other.
- `.current` marks elements whose step equals the current one; `.steps-dim` on a parent dims earlier steps.
- `data-draw` with `data-step` on an SVG path draws the stroke instead of fading.
- `data-focus="1,3"` adds `.focus` at those steps; children of a `data-focus-scope` parent that are not focused dim. Use for code walkthroughs.
- The slide gets `data-current-step="n"` for custom CSS.

## Shared-element morphs

Give an element on one slide and an element on the next the same `data-morph="name"`; with `data-transition="morph"` the browser animates one into the other. Names are unique per slide (several candidates are allowed when only one is shown via `data-show`). Keep aspect ratios similar and use `width: fit-content` on text so it scales instead of stretching.

## State

Initial state is the JSON in `#deck-state`. It persists in `localStorage` (per `data-id`) and syncs to the speaker view. Paths use dots: `votes.cache`.

| Attribute | Effect |
|---|---|
| `data-model="path"` | Two-way binding for inputs, checkboxes (boolean), radios, ranges and numbers (numeric). |
| `data-bind="path"` | Text content. `data-fallback` when empty. `data-tween` animates numeric changes. |
| `data-tpl="Hi {name\|friend}"` | Text template with fallbacks. |
| `data-list="path"` + `<template>` | Renders an array; fields resolve on each item, `{index}` is 1-based. New rows append, so only they animate. |
| `data-show="cond"` | Hidden unless the condition holds. |
| `data-class="cls: cond; other: cond"` | Toggles classes. |
| `data-style="--var: path"` | Sets CSS custom properties, e.g. a bar height or `--flow-rate`. |

Conditions: `path`, `!path`, `path=value`, `path!=value`, `path>3`, `path<=3`.

## Actions

`data-action` on a button or a `<form>` (runs on submit). Chain with `;`, left to right, one render at the end.

Built-ins: `next`, `prev`, `goto:slide-id`, `set:path=value`, `toggle:path`, `inc:path[,n]`, `dec:path[,n]`, `reset`, `overview`, `fullscreen`, and `trace:…` from the diagram module.

## Script API

```js
deck
  .computed('total', s => s.items.reduce((a, b) => a + b, 0))   // usable anywhere a path is
  .action('pickRoute', (arg, { state, el, event, set, get, go }) => { … })
  .on('enter', 'slide-id', (slide, deck) => { … })                // also 'leave', 'step', 'change'
deck.set({ key: value }); deck.get('path'); deck.go('slide-id', step); deck.run('set:x=1; next');
```

Custom actions mutate `state` directly; the engine re-renders after the action.

## Presenting

`→` `Space` next · `←` back · `O` overview · `S` speaker view (second window, synced) · `F` fullscreen · `Esc` close overview · `Shift+R` clear saved state. Keys are ignored while typing in a field.

## Conflicts the checker reports

- `data-step` and `data-anim` on one element: both animate opacity; wrap one in the other.
- `data-anim` on or inside a `data-morph` element: the entrance runs during the morph and the geometry jumps.
- Reusing `data-count` for anything else: it is the counter attribute.
- Images without `alt`, slides without notes, duplicate slide ids.

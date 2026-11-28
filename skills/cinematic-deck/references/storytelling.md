# Building up a presentation

How to turn a brief into a slide list before any markup exists. The output of this stage is an **outline**: an ordered list of slides, each with an archetype, its one point, and its builds or interaction.

## From brief to thesis

Write the **thesis** first: one sentence the audience should repeat afterwards ("Moving reads to a cache cuts p95 latency by 60% for a week of work"). Every slide either sets up, proves, or lands the thesis. A slide that does none of these is cut.

Size the deck from the time slot: roughly one slide per 1–2 minutes of talk, fewer for a deep technical walkthrough where one diagram carries five minutes of builds.

## Arcs for technical talks

Pick the arc that matches the talk's purpose, then fill it with archetypes from the table below.

| Talk | Arc |
|---|---|
| Architecture walkthrough | Context (who uses it, what it must do) → the system at a glance → build-up layer by layer → follow one request → failure and scaling behaviour → trade-offs → what's next |
| Proposal / RFC / decision | Problem with evidence → constraints → options side by side → recommendation → how it works (diagram) → cost, risk, rollout → the ask |
| Incident review | Impact in numbers → timeline → what happened (trace / sequence of the failure) → root cause → why defences missed it → actions with owners |
| Migration plan | Today (diagram) → target (same diagram, changed) → phases as builds → risk per phase → cut-over and rollback |
| Teach a concept | Hook question → intuition (visual) → mechanism step by step → worked example (interactive) → pitfalls → recap |

## Slide archetypes

Every slide is one archetype with one point. Titles are **assertions**, not topics: "The cache absorbs 80% of reads", not "Caching".

| Archetype | Use for | Pattern |
|---|---|---|
| Title | Opening, section openers | `.slide.center`, `.display` with `data-split`, `.kicker`, `.lede` |
| Statement | One sentence that must land | `.statement` with `data-split="words"`, optional `data-step` caption |
| Split | Claim + evidence | `.slide.split`: text column + visual (panel, code, chart) |
| Architecture build-up | A system, layer by layer | `.slide.full`, `.heading`, `.diagram` with `data-step` per layer, `.captions.swap` underneath |
| Request trace | How one call moves; latency; failure | Same diagram + a panel with trace buttons, `data-log`, a failure toggle |
| Flow | Throughput, pipelines, fan-in/fan-out | Diagram with `flow="packets"`, a `.range` bound to `--flow-rate` |
| Sequence | Protocols, handshakes, auth flows | `.sequence`, one `data-step` per message |
| Code walkthrough | Config, API shape, a key function | `.code` with `data-focus` per step, annotations in a `.swap` |
| Numbers | Impact, scale, before/after | Large figures with `data-count`, a drawn chart |
| Comparison | Options, before/after | `.cols-2` / `.cols-3` panels, the recommended one marked with `.on` or the accent |
| Interaction | Audience input, polls, what-if | Inputs and buttons bound to state; results reused later in the deck |
| Recap | Close the loop | Three assertions max; `data-tpl` to replay audience choices |

## Pacing

- **One idea per slide.** If a slide needs two titles, it is two slides.
- **Builds over density.** Reveal a diagram in 3–6 steps rather than showing 12 boxes at once. Each step gets a one-line caption or a speaker-note beat.
- **Continuity across slides.** When a talk zooms into part of a system, repeat the diagram on the next slide and change only what matters (highlight, add detail, cut the rest). Use `data-morph` on the element that persists.
- **Interaction earns its place** only when it changes understanding: a failure toggle that reroutes a trace, a slider that shows a bottleneck, a poll whose answer the recap uses. Decorative interaction is cut.
- **Text budget:** a title, at most one lede or three short bullets. Detail goes in speaker notes.

## Motion has meaning

Pick the transition from what the change *means*, not for variety. Set a deck-wide default on `.deck` and override per slide only when the meaning differs.

| Change | Transition |
|---|---|
| Next step in a sequence | `push` |
| Drilling into detail / zooming out | `zoom` |
| Same subject, new view (element persists) | `morph` with `data-morph` pairs |
| New section or topic | `cinematic` or `fade` |
| Finale, reveal | `wipe` |

The theme's `--motion` scales all of it. A quiet theme keeps the semantics with less travel.

## Speaker notes

Every slide gets an `<aside class="notes">`: what to say, which build to press when, and what to click on interactive slides. The speaker view (`S`) shows them with a timer and the next slide's title.

## Outline format

Present the outline to the user before building when the deck has more than about eight slides:

```
1. Title — "Read path v2"                      title · split letters
2. Statement — "p95 doubled since March"        statement · caption build
3. Architecture — "Every read hits Postgres"    build-up · 4 steps
4. Trace — "A product page costs 11 queries"    trace · cache-miss toggle
…
```

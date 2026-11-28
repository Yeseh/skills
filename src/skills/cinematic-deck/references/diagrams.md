# Diagrams

Architecture diagrams, traffic and data flows, request traces and sequence diagrams, from `deck/diagram.js` and `deck/diagram.css`. Layout is CSS grid; the engine measures the nodes and draws the edges. The architecture, trace, pipeline and OAuth slides in `references/showcase.html` are working references.

## Architecture and flow diagrams

```html
<div class="diagram" data-diagram="arch" style="--cols: 6; --rows: 4">
  <div class="group" data-label="Region · eu-west" style="grid-area: 1 / 3 / 5 / 7"></div>
  <div class="node" data-node="lb"  data-icon="lb" style="grid-area: 2 / 3">Load balancer<small>L7 · TLS</small></div>
  <div class="node stack" data-node="api" data-icon="container" style="grid-area: 2 / 4">API<small>3 replicas</small></div>
  <deck-edge from="lb" to="api" flow="dash" label="HTTP/2"></deck-edge>
</div>
```

- **Grid:** `--cols` and `--rows` set the grid; `grid-area: row / col` places a node, `row-start / col-start / row-end / col-end` spans a group. On a `.slide.full` the diagram fills the height left under the heading.
- **Nodes:** `data-node` (name, unique within the diagram), `data-icon`, the label as text, a detail line in `<small>`. Classes: `.stack` (replicas / autoscaling), `.external` (third party, dashed). `.down` (failed) and `.hit` (trace arrival) are set by state and traces. A node must be a direct child of the diagram.
- **Groups:** `.group` with `data-label` draws a boundary (region, VPC, subnet, cluster, account). `.group.solid` for a nested or stronger boundary. Groups are siblings of nodes, not containers; place them by grid area.
- `data-diagram="name"` is optional; it names the diagram for `trace:name:…`.

### Edges

`<deck-edge>` is a direct child of the diagram.

| Attribute | Values |
|---|---|
| `from`, `to` | Node names. Direction matters for arrows and flow. |
| `route` | `curve` (default), `elbow` (orthogonal, best for infrastructure), `straight` |
| `sides` | Override the exits, e.g. `"top top"`, `"bottom left"`. Default picks the sides facing each other. |
| `offset` | Shift in px, to separate two edges between the same nodes. |
| `arrow` | `end` (default), `both`, `start`, `none` |
| `label` | Short text at the midpoint. |
| `flow` | `dash` (continuous traffic), `packets` (discrete messages), add `reverse` to flip. |
| `packets`, `speed` | Packet count (default 3) and px/s (default 180). |
| `latency` | ms a trace adds when it crosses this edge. |
| `class="async"` | Dashed line: events, telemetry, fire-and-forget. |

`data-class="down: cacheDown"` on a node or edge marks it failed from state. `data-style="--flow-rate: rate"` on the diagram scales every flow's speed from a state value (bind a `.range` to `rate`).

### Build-up

Put `data-step` on nodes and groups, one layer per step. An edge without its own `data-step` inherits the later step of its two nodes, so lines draw in as their endpoints arrive. Pair the diagram with a `.captions.swap` block of `data-step` / `data-step-until` lines that name each layer.

### Request traces

```html
<button class="btn" data-action="trace:users>cdn>lb>api>db>api>lb>cdn>users" data-log="req">Send request</button>
<ol data-list="req.hops"><template><li><span data-tpl="{dir} {node}"></span> <span data-tpl="{note}"></span></li></template></ol>
<b data-bind="req.total" data-tween data-fallback="0"></b> ms
```

- The packet moves hop by hop along existing edges, in either direction; each arriving node pulses (`.hit`). A new trace cancels a running one.
- `trace:name:a>b>c` targets a named diagram; without a name it uses the diagram on the current slide.
- `data-log="key"` writes `{ hops, total, running }` to state. Each hop has `node`, `ms`, `total`, `via`, `dir` (`→` first visit, `←` return) and `note` (`+4 ms`). Latency is the node's `data-latency` on its first visit plus the edge's `latency`.
- `data-trace-kind="alt"` or `"warn"` recolours the packet.
- For routes that depend on state (failover, cache hit vs miss), write a custom action that builds the hop list and calls `deck.run('trace:…', ctx)`. The showcase's `request` action reroutes around a failed cache.

## Sequence diagrams

```html
<div class="sequence">
  <div class="actor" data-actor="browser" data-icon="browser">Browser</div>
  <div class="actor" data-actor="app" data-icon="server">Web app</div>
  <div class="msg" data-from="browser" data-to="app" data-step="1">GET /login</div>
  <div class="msg reply" data-from="app" data-to="browser" data-step="2">302 → /authorize</div>
</div>
```

Actors become columns with lifelines; messages become rows in source order, drawn between the actors' centres. `.reply` is dashed; a message to the same actor draws a self-loop. One `data-step` per message is the usual build; the newest message's label takes the accent.

## Icons

Generic 24×24 line icons, set with `data-icon` on nodes and actors:

`user users browser mobile globe dns shield lb gateway server container cluster function cpu database cache queue stream storage lock key monitor chart cloud code pipeline message mail bell search cog`

Register more (for example a product's own glyph) from the deck script: `deck.icons.add('name', '<path d="…"/>')`. Draw on a 24×24 grid with strokes and no fills, in the deck script.

## Layout rules

- **12 nodes is a full diagram.** Past that, split across slides or zoom in on a subsystem.
- **Leave empty cells between connected nodes.** Edges and labels live in the gaps; adjacent cells give arrows no room.
- **Align the main path on one row** (client → edge → compute) and branch data stores and async work off it vertically. Readers scan left to right.
- **Elbow for infrastructure, curves for data flow.** Mix only with a reason.
- **Labels are two or three words.** A label that does not fit its edge goes into the node's `<small>` line instead.
- **Repeat the diagram to zoom.** Show the full system, then the same diagram on the next slide with one part expanded, using `data-morph` on a node that persists.

## Theme tokens

`--node-bg --node-border --node-radius --node-icon --node-font --node-shadow --group-bg --group-border --edge-color --edge-width --flow-color --trace-color`. Unset tokens fall back to the general colour tokens (`--surface-solid`, `--line`, `--accent`, `--muted`).

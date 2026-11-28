/* Cinematic Deck diagrams — architecture diagrams, traffic flows, request traces and sequence
 * diagrams. Load after deck.js. Nodes are laid out with CSS grid; edges are SVG paths computed
 * from the nodes' real boxes, so layout stays in CSS and the engine only draws connections.
 *
 * Architecture / flow diagram:
 *   <div class="diagram" data-diagram="arch" style="--cols: 6; --rows: 4">
 *     <div class="group" data-label="Region" style="grid-area: 1 / 3 / 5 / 7"></div>
 *     <div class="node" data-node="api" data-icon="container" data-latency="18"
 *          style="grid-area: 2 / 4">API<small>3 × containers</small></div>
 *     <deck-edge from="lb" to="api" label="HTTP/2" flow="dash" route="elbow"></deck-edge>
 *   </div>
 *
 *   deck-edge attributes: from, to (data-node names) · route = curve | elbow | straight
 *     sides = "right left" (override exits) · offset (px, for parallel edges)
 *     flow = dash | packets | dash reverse · packets (count) · speed (px/s) · arrow = end | both | none
 *     label · latency (ms added when a trace crosses it) · class="async" (dashed)
 *   An edge without data-step inherits the later step of its two nodes.
 *   --flow-rate on the diagram scales all flow speed (bind it with data-style).
 *
 * Request trace (action): data-action="trace:users>cdn>lb>api>cache>api>lb>cdn>users"
 *   optional "name:" prefix picks a diagram; data-log="req" on the trigger writes
 *   { hops: [{ node, note, ms, total, via, dir }], total, running } into state.req.
 *   data-trace-kind="write" adds a class to the packet for styling.
 *
 * Sequence diagram:
 *   <div class="sequence" data-sequence>
 *     <div class="actor" data-actor="browser" data-icon="browser">Browser</div> …
 *     <div class="msg" data-from="browser" data-to="app" data-step="1">GET /login</div>
 *     <div class="msg reply" data-from="app" data-to="browser" data-step="2">302</div>
 *   </div>
 */
(() => {
  'use strict';
  const doc = document;
  const $$ = (s, r = doc) => Array.from(r.querySelectorAll(s));
  const NS = 'http://www.w3.org/2000/svg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const svg = (tag, attrs = {}) => {
    const el = doc.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };

  /* ───────────────────────── icons ─────────────────────────
   * Generic 24×24 line icons for infrastructure concepts. No vendor logos: themes and decks
   * can register more with deck.icons.add(name, '<path …/>'). */
  const ICONS = {
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-5.8 6.5-5.8s6.5 2.2 6.5 5.8"/><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.6c2.1.7 3.5 2.6 3.5 5.4"/>',
    browser: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M6.5 6.5h.01M9 6.5h.01"/>',
    mobile: '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    dns: '<path d="M12 3v18"/><path d="M5 5.5h11l3 3-3 3H5z"/><path d="M19 13.5H8l-3 3 3 3h11z"/>',
    shield: '<path d="M12 3l8 3v6c0 4.8-3.4 8-8 9-4.6-1-8-4.2-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    lb: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7.5V17M12 11l-6 6M12 11l6 6"/>',
    gateway: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 12h10M13.5 8.5 17 12l-3.5 3.5"/>',
    server: '<rect x="4" y="3" width="16" height="7.5" rx="1.5"/><rect x="4" y="13.5" width="16" height="7.5" rx="1.5"/><path d="M7.5 6.75h.01M7.5 17.25h.01M11 6.75h5M11 17.25h5"/>',
    container: '<path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z"/><path d="M3.5 7 12 11.5 20.5 7M12 11.5v10"/>',
    cluster: '<path d="M12 2.5 20.5 7.2v9.6L12 21.5l-8.5-4.7V7.2z"/><circle cx="12" cy="12" r="3"/><path d="M12 5.5V9M12 15v3.5M6.5 8.8l3 1.7M14.5 13.5l3 1.7M6.5 15.2l3-1.7M14.5 10.5l3-1.7"/>',
    function: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 7h2.5l5.5 10M12.4 11.4 8.5 17"/>',
    cpu: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/><path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21"/>',
    database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="3"/><path d="M4.5 5.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
    cache: '<path d="M13 2.5 4.5 13.5h6.5l-1 8 8.5-11h-6.5z"/>',
    queue: '<rect x="2.5" y="7" width="19" height="10" rx="2"/><path d="M7.5 7v10M12 7v10M16.5 7v10"/>',
    stream: '<path d="M3 7.5c3-3 6 3 9 0s6 3 9 0M3 12.5c3-3 6 3 9 0s6 3 9 0M3 17.5c3-3 6 3 9 0s6 3 9 0"/>',
    storage: '<ellipse cx="12" cy="6" rx="8" ry="2.6"/><path d="M4 6l1.8 12.6c.2 1.6 2.9 2.9 6.2 2.9s6-1.3 6.2-2.9L20 6"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2.5"/>',
    key: '<circle cx="8" cy="15" r="4.5"/><path d="M11.2 11.8 20 3M16.5 6.5l3 3M14 9l2 2"/>',
    monitor: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    chart: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7.5 16.5v-4M12 16.5v-9M16.5 16.5v-6"/>',
    cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .4-8 6 6 0 0 0-11.6-1.4A4.6 4.6 0 0 0 7 18.5z"/>',
    code: '<path d="M8 7.5 3.5 12 8 16.5M16 7.5l4.5 4.5-4.5 4.5M13.5 4.5l-3 15"/>',
    pipeline: '<circle cx="4.5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19.5" cy="12" r="2.2"/><path d="M6.7 12h3.1M14.2 12h3.1"/>',
    message: '<path d="M4 5h16v11H9.5L4 20z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  };

  function renderIcon(host) {
    const name = host.dataset.icon;
    if (!name || host.querySelector(':scope > .node-icon')) return;
    const markup = ICONS[name];
    if (!markup) { console.warn(`[deck] unknown icon "${name}"`); return; }
    const el = svg('svg', { class: 'node-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true' });
    el.innerHTML = markup;
    host.prepend(el);
  }

  /* ───────────────────────── geometry ───────────────────────── */

  const NORMAL = { right: [1, 0], left: [-1, 0], top: [0, -1], bottom: [0, 1] };
  const box = n => ({ x: n.offsetLeft, y: n.offsetTop, w: n.offsetWidth, h: n.offsetHeight });

  function pickSides(a, b) {
    const hGap = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
    const vGap = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
    const dx = (b.x + b.w / 2) - (a.x + a.w / 2);
    const dy = (b.y + b.h / 2) - (a.y + a.h / 2);
    if (hGap >= vGap) return dx > 0 ? ['right', 'left'] : ['left', 'right'];
    return dy > 0 ? ['bottom', 'top'] : ['top', 'bottom'];
  }

  function anchor(r, side, offset, gap) {
    const [nx, ny] = NORMAL[side];
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const x = nx ? (nx > 0 ? r.x + r.w : r.x) : cx + offset;
    const y = ny ? (ny > 0 ? r.y + r.h : r.y) : cy + offset;
    return { x: x + nx * gap, y: y + ny * gap, n: [nx, ny] };
  }

  const len = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const toward = (from, to, d) => {
    const l = len(from, to) || 1;
    return { x: from.x + (to.x - from.x) / l * d, y: from.y + (to.y - from.y) / l * d };
  };
  const f = n => Math.round(n * 10) / 10;

  function rounded(pts, radius) {
    let d = `M${f(pts[0].x)},${f(pts[0].y)}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
      const r = Math.min(radius, len(a, b) / 2, len(b, c) / 2);
      const p1 = toward(b, a, r), p2 = toward(b, c, r);
      d += ` L${f(p1.x)},${f(p1.y)} Q${f(b.x)},${f(b.y)} ${f(p2.x)},${f(p2.y)}`;
    }
    const z = pts.at(-1);
    return `${d} L${f(z.x)},${f(z.y)}`;
  }

  // Returns the path plus the travel direction at each end (for arrowheads).
  function route(p, q, kind) {
    const unit = (dx, dy) => { const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
    if (kind === 'straight') {
      const dir = unit(q.x - p.x, q.y - p.y);
      return { d: `M${f(p.x)},${f(p.y)} L${f(q.x)},${f(q.y)}`, start: dir, end: dir };
    }
    if (kind === 'elbow') {
      const h1 = p.n[0] !== 0, h2 = q.n[0] !== 0;
      let pts;
      if (h1 && h2) { const mx = (p.x + q.x) / 2; pts = [p, { x: mx, y: p.y }, { x: mx, y: q.y }, q]; }
      else if (!h1 && !h2) { const my = (p.y + q.y) / 2; pts = [p, { x: p.x, y: my }, { x: q.x, y: my }, q]; }
      else if (h1) pts = [p, { x: q.x, y: p.y }, q];
      else pts = [p, { x: p.x, y: q.y }, q];
      pts = pts.filter((pt, i) => i === 0 || len(pt, pts[i - 1]) > 0.5);
      const a = pts[1] ?? q, b = pts.at(-2) ?? p;
      return { d: rounded(pts, 18), start: unit(a.x - p.x, a.y - p.y), end: unit(q.x - b.x, q.y - b.y) };
    }
    const k = Math.max(28, Math.min(240, len(p, q) * 0.45));
    const c1 = { x: p.x + p.n[0] * k, y: p.y + p.n[1] * k };
    const c2 = { x: q.x + q.n[0] * k, y: q.y + q.n[1] * k };
    return {
      d: `M${f(p.x)},${f(p.y)} C${f(c1.x)},${f(c1.y)} ${f(c2.x)},${f(c2.y)} ${f(q.x)},${f(q.y)}`,
      start: unit(c1.x - p.x, c1.y - p.y),
      end: unit(q.x - c2.x, q.y - c2.y),
    };
  }

  function arrowHead(tip, [dx, dy], size = 11) {
    const bx = tip.x - dx * size, by = tip.y - dy * size;
    const px = -dy * size * 0.55, py = dx * size * 0.55;
    return `M${f(bx + px)},${f(by + py)} L${f(tip.x)},${f(tip.y)} L${f(bx - px)},${f(by - py)} Z`;
  }

  /* ───────────────────────── diagrams ───────────────────────── */

  const diagrams = [];

  class Diagram {
    constructor(el) {
      this.el = el;
      this.name = el.dataset.diagram || '';
      this.nodes = new Map($$(':scope > [data-node]', el).map(n => [n.dataset.node, n]));
      for (const n of this.nodes.values()) renderIcon(n);
      this.edges = $$(':scope > deck-edge', el).map(e => this.buildEdge(e));
      this.overlay = svg('svg', { class: 'diagram-trace', 'aria-hidden': 'true' });
      el.append(this.overlay);
      this.traceId = 0;
      new ResizeObserver(() => this.layout()).observe(el);
    }

    buildEdge(el) {
      const from = el.getAttribute('from'), to = el.getAttribute('to');
      const a = this.nodes.get(from), b = this.nodes.get(to);
      if (!a || !b) console.warn(`[deck] edge ${from} → ${to}: unknown node`);
      if (!el.hasAttribute('data-step')) {
        const steps = [a, b].map(n => Number(n?.dataset.step)).filter(Number.isFinite);
        if (steps.length) el.dataset.step = Math.max(...steps);
      }
      const s = svg('svg', { class: 'edge-svg', 'aria-hidden': 'true' });
      const line = svg('path', { class: 'edge-line' });
      const flow = svg('path', { class: 'edge-flow' });
      const arrows = svg('path', { class: 'edge-arrow' });
      const packets = svg('g', { class: 'edge-packets' });
      s.append(line, flow, packets, arrows);
      el.append(s);
      let label = null;
      if (el.hasAttribute('label')) {
        label = doc.createElement('span');
        label.className = 'edge-label';
        label.textContent = el.getAttribute('label');
        el.append(label);
      }
      const flowAttr = (el.getAttribute('flow') || '').split(/\s+/);
      const count = flowAttr.includes('packets') ? Number(el.getAttribute('packets') || 3) : 0;
      for (let i = 0; i < count; i++) packets.append(svg('circle', { class: 'edge-packet', r: 5, cx: -99, cy: -99 }));
      return {
        el, from, to, a, b, line, flow, arrows, label,
        dots: [...packets.children],
        reverse: flowAttr.includes('reverse'),
        speed: Number(el.getAttribute('speed') || 180),
        latency: Number(el.getAttribute('latency') || 0),
        phase: 0, len: 0,
      };
    }

    layout() {
      if (!this.el.offsetWidth) return; // hidden slide; the observer fires again when shown
      for (const e of this.edges) {
        if (!e.a || !e.b) continue;
        const ra = box(e.a), rb = box(e.b);
        const [sa, sb] = (e.el.getAttribute('sides') || '').split(/\s+/).filter(Boolean).length === 2
          ? e.el.getAttribute('sides').split(/\s+/)
          : pickSides(ra, rb);
        const offset = Number(e.el.getAttribute('offset') || 0);
        const gap = 4;
        const p = anchor(ra, sa, offset, gap), q = anchor(rb, sb, offset, gap);
        const r = route(p, q, e.el.getAttribute('route') || 'curve');
        e.line.setAttribute('d', r.d);
        e.flow.setAttribute('d', r.d);
        const arrow = e.el.getAttribute('arrow') || 'end';
        const heads = [];
        if (arrow === 'end' || arrow === 'both') heads.push(arrowHead(q, r.end));
        if (arrow === 'start' || arrow === 'both') heads.push(arrowHead(p, r.start.map(v => -v)));
        e.arrows.setAttribute('d', heads.join(' '));
        e.len = e.line.getTotalLength();
        e.el.style.setProperty('--len', e.len.toFixed(1));
        if (e.label) {
          const mid = e.line.getPointAtLength(e.len / 2);
          e.label.style.left = `${mid.x}px`;
          e.label.style.top = `${mid.y}px`;
        }
      }
    }

    get active() { return !!this.el.closest('.slide.active') && this.el.offsetWidth > 0; }

    edgeBetween(a, b) {
      const e = this.edges.find(x => (x.from === a && x.to === b) || (x.from === b && x.to === a));
      return e ? { edge: e, forward: e.from === a } : null;
    }

    labelOf(name) {
      const n = this.nodes.get(name);
      if (!n) return name;
      return n.dataset.label || [...n.childNodes].filter(c => c.nodeType === Node.TEXT_NODE).map(c => c.textContent).join(' ').trim() || name;
    }

    // Animates one packet hop by hop. Resolves with the hop log; a newer trace cancels this one.
    async trace(hops, { speed = 650, dwell = 160, kind = '', onHop } = {}) {
      const id = ++this.traceId;
      this.overlay.replaceChildren();
      const glow = svg('circle', { class: `trace-glow ${kind}`.trim(), r: 18, cx: -99, cy: -99 });
      const dot = svg('circle', { class: `trace-packet ${kind}`.trim(), r: 8, cx: -99, cy: -99 });
      this.overlay.append(glow, dot);
      const visited = new Set([hops[0]]);
      const log = [];
      let total = 0;
      this.hit(hops[0]);

      for (let i = 0; i < hops.length - 1; i++) {
        if (id !== this.traceId || !this.active) return log;
        const [a, b] = [hops[i], hops[i + 1]];
        const link = this.edgeBetween(a, b);
        if (!link) { console.warn(`[deck] trace: no edge between ${a} and ${b}`); continue; }
        const { edge, forward } = link;
        edge.el.classList.add('active');
        await this.travel(edge, forward, speed, (x, y) => {
          for (const c of [dot, glow]) { c.setAttribute('cx', x); c.setAttribute('cy', y); }
        });
        edge.el.classList.remove('active');
        if (id !== this.traceId) return log;

        const first = !visited.has(b);
        visited.add(b);
        const ms = (first ? Number(this.nodes.get(b)?.dataset.latency || 0) : 0) + edge.latency;
        total += ms;
        const entry = { from: a, to: b, node: this.labelOf(b), via: edge.el.getAttribute('label') || '', ms, total, dir: first ? '→' : '←', note: ms ? `+${ms} ms` : '' };
        log.push(entry);
        this.hit(b);
        onHop?.(entry, log);
        await new Promise(r => setTimeout(r, dwell));
      }
      if (id === this.traceId) setTimeout(() => { if (id === this.traceId) this.overlay.replaceChildren(); }, 500);
      return log;
    }

    travel(edge, forward, speed, place) {
      const dur = reduced.matches ? 1 : Math.max(250, edge.len / speed * 1000);
      return new Promise(resolve => {
        const t0 = performance.now();
        const tick = now => {
          const p = Math.min(1, (now - t0) / dur);
          const e = p < .5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
          const pt = edge.line.getPointAtLength((forward ? e : 1 - e) * edge.len);
          place(pt.x, pt.y);
          if (p < 1) requestAnimationFrame(tick); else resolve();
        };
        requestAnimationFrame(tick);
      });
    }

    hit(name) {
      const n = this.nodes.get(name);
      if (!n) return;
      n.classList.remove('hit');
      void n.offsetWidth;
      n.classList.add('hit');
      clearTimeout(n._hit);
      n._hit = setTimeout(() => n.classList.remove('hit'), 900);
    }
  }

  // Continuous packet flow, only for diagrams on the active slide.
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const d of diagrams) {
      if (reduced.matches || !d.active) continue;
      const rate = parseFloat(getComputedStyle(d.el).getPropertyValue('--flow-rate')) || 1;
      for (const e of d.edges) {
        if (!e.dots.length || !e.len) continue;
        e.phase = (e.phase + dt * e.speed * rate / e.len) % 1;
        e.dots.forEach((c, i) => {
          let t = (e.phase + i / e.dots.length) % 1;
          if (e.reverse) t = 1 - t;
          const pt = e.line.getPointAtLength(t * e.len);
          c.setAttribute('cx', pt.x.toFixed(1));
          c.setAttribute('cy', pt.y.toFixed(1));
        });
      }
    }
    requestAnimationFrame(frame);
  }

  /* ───────────────────────── sequence diagrams ───────────────────────── */

  function buildSequence(seq) {
    const actors = $$(':scope > .actor', seq);
    const msgs = $$(':scope > .msg', seq);
    const col = new Map(actors.map((a, i) => [a.dataset.actor, i + 1]));
    seq.style.setProperty('--actors', actors.length);
    seq.style.gridTemplateRows = `auto repeat(${msgs.length}, auto)`;
    actors.forEach((a, i) => {
      renderIcon(a);
      a.style.gridArea = `1 / ${i + 1}`;
      const life = doc.createElement('div');
      life.className = 'lifeline';
      life.style.gridArea = `1 / ${i + 1} / ${msgs.length + 2} / ${i + 2}`;
      seq.prepend(life);
    });
    msgs.forEach((m, k) => {
      const a = col.get(m.dataset.from), b = col.get(m.dataset.to);
      if (!a || !b) { console.warn(`[deck] sequence message ${m.dataset.from} → ${m.dataset.to}: unknown actor`); return; }
      const lo = Math.min(a, b), hi = Math.max(a, b);
      m.style.gridArea = `${k + 2} / ${lo} / ${k + 3} / ${hi + 1}`;
      m.style.setProperty('--span', hi - lo + 1);
      m.classList.toggle('rtl', b < a);
      m.classList.toggle('self', a === b);
      if (!m.querySelector(':scope > .msg-label')) {
        const label = doc.createElement('span');
        label.className = 'msg-label';
        label.append(...m.childNodes);
        m.append(label);
      }
    });
  }

  /* ───────────────────────── wiring ───────────────────────── */

  function find(name) {
    const pool = name ? diagrams.filter(d => d.name === name) : diagrams;
    return pool.find(d => d.active) || pool[0];
  }

  // Runs at load, before the deck boots, so inherited edge steps count toward each slide's builds.
  $$('[data-sequence]').forEach(buildSequence);
  $$('[data-diagram]').forEach(el => diagrams.push(new Diagram(el)));
  doc.fonts?.ready.then(() => diagrams.forEach(d => d.layout()));
  requestAnimationFrame(frame);

  const deck = window.deck;
  deck.diagram = name => find(name);
  deck.icons = { add: (name, markup) => { ICONS[name] = markup; }, names: () => Object.keys(ICONS) };

  deck.action('trace', (arg, { el }) => {
    const m = arg.match(/^(?:([\w-]+):)?(.+)$/);
    const d = find(m?.[1]);
    if (!d) return console.warn('[deck] trace: no diagram found');
    const hops = m[2].split('>').map(s => s.trim()).filter(Boolean);
    const key = el?.dataset.log;
    if (key) deck.set({ [key]: { hops: [], total: 0, running: true } });
    d.trace(hops, {
      kind: el?.dataset.traceKind || '',
      speed: Number(el?.dataset.traceSpeed) || undefined,
      onHop: (entry, log) => { if (key) deck.set({ [key]: { hops: [...log], total: entry.total, running: true } }); },
    }).then(log => {
      if (key && deck.state[key]?.running) deck.set({ [key]: { hops: log, total: log.at(-1)?.total ?? 0, running: false } });
    });
  });
})();

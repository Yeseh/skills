/* Cinematic Deck engine — a zero-dependency runtime for HTML slide decks.
 *
 * Markup contract (see index.html for a full example):
 *   <main class="deck" data-id="my-talk">          one deck per page
 *     <div class="stage">                           fixed 1920×1080 canvas, scaled to fit
 *       <section class="slide" id="intro"
 *                data-hue="270"                      backdrop/accent hue (number or @statePath)
 *                data-transition="cinematic"         cinematic | push | zoom | fade | wipe | morph
 *                data-require="name">                block "next" until the condition holds
 *         <h1 data-split>Title</h1>                 per-character entrance (data-split="words" for words)
 *         <p data-anim="rise" data-delay="300">     entrance animation when the slide becomes active
 *         <li data-step="1">                        build: shown on the 1st "next" press
 *         <div data-morph="hero">                   shared element morphs to the same name on the next slide
 *         <aside class="notes">                     speaker notes (speaker view only)
 *   <script type="application/json" id="deck-state">{ "name": "" }</script>
 *
 * State bindings: data-model, data-bind, data-tpl, data-list, data-show, data-class, data-style, data-action.
 * Style lives elsewhere: this file never sets colours or fonts. See base.css and themes/.
 * JS API: window.deck — action(), computed(), on(), set(), get(), go(), next(), prev(), reset().
 */
(() => {
  'use strict';
  const doc = document, root = doc.documentElement;
  const $ = (s, r = doc) => r.querySelector(s);
  const $$ = (s, r = doc) => Array.from(r.querySelectorAll(s));
  const W = 1920, H = 1080;
  const FIELD = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
  const INTERACTIVE = `${FIELD}, button, a[href], label, [data-action]`;

  const deckEl = $('.deck');
  const stage = $('.stage', deckEl);
  const slides = $$(':scope > .slide', stage);
  const STORE = 'cinematic-deck:' + (deckEl.dataset.id || location.pathname);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const isPresenter = new URLSearchParams(location.search).has('presenter');

  /* ───────────────────────── state ───────────────────────── */

  const initial = JSON.parse($('#deck-state')?.textContent || '{}');
  const state = Object.assign(structuredClone(initial), load());
  const computed = {};
  const actions = {};
  const hooks = { enter: [], leave: [], step: [], change: [] };

  function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private mode */ } }

  function get(path) {
    const [head, ...rest] = String(path).trim().split('.');
    let v = head in computed ? computed[head](state) : state[head];
    for (const k of rest) v = v?.[k];
    return v;
  }
  function setPath(path, value) {
    const keys = path.trim().split('.');
    let o = state;
    for (const k of keys.slice(0, -1)) o = (o[k] ??= {});
    o[keys.at(-1)] = value;
  }
  function parse(raw) {
    raw = raw.trim();
    try { return JSON.parse(raw); } catch { return raw.replace(/^['"]|['"]$/g, ''); }
  }
  // Conditions: "path", "!path", "path=value", "path!=value", "path>3", "path<=3"
  function test(expr) {
    expr = expr.trim();
    if (expr.startsWith('!')) return !test(expr.slice(1));
    const m = expr.match(/^([\w.]+)\s*(!=|>=|<=|=|>|<)\s*(.+)$/);
    if (!m) { const v = get(expr); return Array.isArray(v) ? v.length > 0 : !!v; }
    const a = get(m[1]), b = parse(m[3]);
    switch (m[2]) {
      case '=': return a == b;   // loose on purpose: "3" from an input equals 3
      case '!=': return a != b;
      case '>': return a > b;
      case '<': return a < b;
      case '>=': return a >= b;
      default: return a <= b;
    }
  }
  const pairs = s => s.split(';').map(x => x.trim()).filter(Boolean)
    .map(x => { const i = x.indexOf(':'); return [x.slice(0, i).trim(), x.slice(i + 1).trim()]; });

  function fmt(v, ref = v) {
    if (typeof v !== 'number') return String(v);
    const decimals = Number.isInteger(ref) ? 0 : (String(ref).split('.')[1]?.length ?? 1);
    return v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function commit({ remote = false } = {}) {
    if (!remote) { save(); channel?.postMessage({ t: 'state', state }); }
    render();
  }

  // "{path|fallback}" placeholders; lookup defaults to global state.
  function interpolate(tpl, lookup = get) {
    return tpl.replace(/\{([\w.]+)(?:\|([^}]*))?\}/g, (_, p, fb = '') => {
      const v = lookup(p);
      return v == null || v === '' ? fb : fmt(v);
    });
  }

  const dig = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
  const inList = el => el.parentElement?.closest('[data-list]');

  function render() {
    for (const el of $$('[data-bind]')) if (!inList(el)) setText(el, get(el.dataset.bind), el.dataset.fallback ?? '');
    for (const el of $$('[data-tpl]')) if (!inList(el)) el.textContent = interpolate(el.dataset.tpl);
    for (const el of $$('[data-list]')) renderList(el);
    for (const el of $$('[data-model]')) syncModel(el);
    for (const el of $$('[data-show]')) el.hidden = !test(el.dataset.show);
    for (const el of $$('[data-class]')) for (const [cls, cond] of pairs(el.dataset.class)) el.classList.toggle(cls, test(cond));
    for (const el of $$('[data-style]')) for (const [prop, p] of pairs(el.dataset.style)) el.style.setProperty(prop, get(p) ?? '');
    applyHue(slides[index]);
    for (const h of hooks.change) h.fn(state, api);
  }

  // <ol data-list="path"><template><li data-tpl="{field}"></li></template></ol>
  // Existing rows are updated in place and new rows appended, so only new rows animate in.
  function renderList(el) {
    const tpl = el.querySelector(':scope > template');
    if (!tpl) return;
    const items = Array.isArray(get(el.dataset.list)) ? get(el.dataset.list) : [];
    const rows = [...el.children].filter(c => c !== tpl);
    for (const row of rows.slice(items.length)) row.remove();
    items.forEach((item, i) => {
      const row = rows[i] ?? el.appendChild(tpl.content.firstElementChild.cloneNode(true));
      const lookup = p => p === 'index' ? i + 1 : (dig(item, p) ?? get(p));
      for (const t of [row, ...row.querySelectorAll('[data-tpl], [data-bind]')]) {
        if (t.dataset.tpl) t.textContent = interpolate(t.dataset.tpl, lookup);
        else if (t.dataset.bind) t.textContent = interpolate(`{${t.dataset.bind}|${t.dataset.fallback ?? ''}}`, lookup);
      }
    });
    el.dataset.length = items.length; // not data-count: that attribute drives counters
  }

  function setText(el, v, fallback) {
    if (el.hasAttribute('data-tween') && typeof v === 'number') return tween(el, v);
    const text = v == null || v === '' ? fallback : fmt(v);
    if (el.textContent !== text) el.textContent = text;
  }

  function tween(el, to, dur = 700) {
    const from = el._v ?? 0;
    el._v = to;
    cancelAnimationFrame(el._raf);
    if (from === to || reduced.matches) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const tick = now => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(from + (to - from) * e, to);
      if (p < 1) el._raf = requestAnimationFrame(tick);
    };
    el._raf = requestAnimationFrame(tick);
  }

  function syncModel(el) {
    const v = get(el.dataset.model);
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.type === 'radio') el.checked = String(v) === el.value;
    else if (doc.activeElement !== el && el.value !== String(v ?? '')) el.value = v ?? '';
  }

  doc.addEventListener('input', e => {
    const el = e.target.closest?.('[data-model]');
    if (!el) return;
    const v = el.type === 'checkbox' ? el.checked
      : (el.type === 'number' || el.type === 'range') ? el.valueAsNumber
      : el.value;
    setPath(el.dataset.model, v);
    commit();
  });

  /* ───────────────────────── actions ───────────────────────── */

  const builtins = {
    next: () => next(),
    prev: () => prev(),
    goto: ref => go(findSlide(ref)),
    set: arg => { const i = arg.indexOf('='); setPath(arg.slice(0, i), parse(arg.slice(i + 1))); },
    toggle: p => setPath(p, !get(p)),
    inc: arg => { const [p, n = '1'] = arg.split(','); setPath(p, (Number(get(p)) || 0) + Number(n)); },
    dec: arg => { const [p, n = '1'] = arg.split(','); setPath(p, (Number(get(p)) || 0) - Number(n)); },
    reset: () => reset(),
    overview: () => toggleOverview(),
    fullscreen: () => toggleFullscreen(),
  };

  // "set:pick=orbit; goto:detail" — runs left to right, then commits once.
  function run(spec, ctx = {}) {
    for (const part of spec.split(';').map(s => s.trim()).filter(Boolean)) {
      const i = part.indexOf(':');
      const name = i < 0 ? part : part.slice(0, i).trim();
      const arg = i < 0 ? '' : part.slice(i + 1).trim();
      const fn = actions[name] || builtins[name];
      if (!fn) { console.warn(`[deck] unknown action "${name}"`); continue; }
      fn(arg, { ...ctx, state, get, set: api.set, go: api.go, next, prev });
    }
    commit();
  }

  doc.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el || el.tagName === 'FORM' || root.classList.contains('overview')) return;
    e.preventDefault();
    setOrigin(e);
    run(el.dataset.action, { el, event: e });
  });

  doc.addEventListener('submit', e => {
    const form = e.target.closest('form');
    if (!form || !deckEl.contains(form)) return;
    e.preventDefault();
    setOrigin(e.submitter ? { clientX: 0, detail: 0, target: e.submitter } : {});
    if (form.dataset.action) run(form.dataset.action, { el: form, event: e });
  });

  // Wipe transitions grow from the clicked point (in stage coordinates).
  function setOrigin(e) {
    if (e.detail > 0 && e.clientX != null) {
      const r = stage.getBoundingClientRect(), s = r.width / W;
      root.style.setProperty('--vt-x', `${(e.clientX - r.left) / s}px`);
      root.style.setProperty('--vt-y', `${(e.clientY - r.top) / s}px`);
    } else {
      root.style.setProperty('--vt-x', '50%');
      root.style.setProperty('--vt-y', '50%');
    }
  }

  /* ───────────────────────── navigation ───────────────────────── */

  let index = -1, step = 0, displayed = null, vt = null;

  const maxStep = s => s._max ??= Math.max(0, ...$$('[data-step], [data-focus]', s)
    .flatMap(e => [e.dataset.step, ...(e.dataset.focus || '').split(/[\s,]+/)])
    .map(Number).filter(Number.isFinite));

  function findSlide(ref) {
    const byId = slides.findIndex(s => s.id === String(ref));
    if (byId >= 0) return byId;
    const n = parseInt(ref, 10);
    return Number.isFinite(n) ? n - 1 : 0;
  }

  function next() {
    if (index < 0) return;
    const s = slides[index];
    if (step < maxStep(s)) return setStep(step + 1);
    if (s.dataset.require && !test(s.dataset.require)) return block(s);
    if (index < slides.length - 1) go(index + 1);
  }

  function prev() {
    if (step > 0) return setStep(step - 1);
    if (index > 0) go(index - 1, 'end');
  }

  function block(s) {
    s.classList.remove('blocked');
    void s.offsetWidth; // restart the shake animation
    s.classList.add('blocked');
    $(FIELD, s)?.focus();
  }

  function go(i, st = 0, opts = {}) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    const target = slides[i];
    const s = st === 'end' ? maxStep(target) : Math.min(st, maxStep(target));
    if (i === index) return setStep(s, opts);

    const dir = i > index ? 'forward' : 'back';
    const from = displayed;
    let kind = opts.kind || (dir === 'forward' ? target : from)?.dataset.transition
      || deckEl.dataset.transition || 'cinematic';
    if (reduced.matches) kind = 'fade';

    if (from) emit('leave', from);
    index = i; step = s;
    sync(opts);

    const update = () => {
      clearMorphs();
      target.classList.toggle('settled', dir === 'back'); // going back: no entrance replay
      show(i, s);
      nameMorphs(target);
    };

    if (!from || opts.instant || !doc.startViewTransition || root.classList.contains('overview')) {
      update(); clearMorphs(); emit('enter', target);
      return;
    }

    root.dataset.vt = kind;
    root.dataset.dir = dir;
    vt?.skipTransition();
    nameMorphs(from);
    const t = vt = doc.startViewTransition(update);
    t.ready.catch(() => {}); // duplicate names during key-mashing abort the animation, not the update
    t.updateCallbackDone.then(() => emit('enter', target), () => {});
    t.finished.finally(() => {
      if (vt !== t) return;
      vt = null;
      clearMorphs();
      delete root.dataset.vt;
    });
  }

  function show(i, s) {
    slides.forEach((el, k) => {
      const on = k === i;
      el.classList.toggle('active', on);
      el.setAttribute('aria-hidden', String(!on));
    });
    displayed = slides[i];
    applyStep(displayed, s);
    applyHue(displayed);
  }

  function applyStep(slide, s) {
    step = s;
    slide.dataset.currentStep = s;
    for (const el of $$('[data-step]', slide)) {
      const a = Number(el.dataset.step), u = el.dataset.stepUntil;
      el.classList.toggle('on', s >= a && (u === undefined || s <= Number(u)));
      el.classList.toggle('current', s === a);
    }
    let focusing = false;
    for (const el of $$('[data-focus]', slide)) {
      const on = el.dataset.focus.split(/[\s,]+/).map(Number).includes(s);
      el.classList.toggle('focus', on);
      focusing ||= on;
    }
    slide.classList.toggle('focusing', focusing);
  }

  function setStep(s, opts = {}) {
    if (index < 0) return;
    applyStep(slides[index], s);
    sync(opts);
    emit('step', slides[index]);
  }

  function applyHue(slide) {
    const h = slide?.dataset.hue;
    if (!h) return;
    const v = h.startsWith('@') ? get(h.slice(1)) : h;
    if (v != null && v !== '') root.style.setProperty('--hue', v);
  }

  const morphName = el => 'morph-' + el.dataset.morph.replace(/[^\w-]/g, '_');
  function nameMorphs(slide) {
    for (const el of $$('[data-morph]', slide)) {
      el.style.viewTransitionName = morphName(el);
      el.style.viewTransitionClass = 'morph';
    }
  }
  function clearMorphs() { for (const el of $$('[data-morph]')) el.style.viewTransitionName = ''; }

  function emit(type, slide) {
    if (type === 'enter') runCounters(slide);
    for (const h of hooks[type]) if (!h.id || h.id === slide?.id) h.fn(slide, api);
  }

  function runCounters(slide) {
    for (const el of $$('[data-count]', slide)) {
      const to = parseFloat(el.dataset.count);
      clearTimeout(el._t);
      cancelAnimationFrame(el._raf);
      if (slide.classList.contains('settled') || reduced.matches) { el._v = to; el.textContent = fmt(to); continue; }
      el._v = 0;
      el.textContent = fmt(0, to);
      el._t = setTimeout(() => tween(el, to, Number(el.dataset.duration) || 1800), 350 + (parseFloat(el.dataset.delay) || 0));
    }
  }

  /* ───────────────────────── sync: hash, HUD, other windows ───────────────────────── */

  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(STORE) : null;
  if (channel) channel.onmessage = ({ data }) => {
    if (data.t === 'go') go(data.i, data.s, { remote: true });
    else if (data.t === 'state') {
      for (const k of Object.keys(state)) delete state[k];
      Object.assign(state, data.state);
      commit({ remote: true });
    }
  };

  function sync(opts = {}) {
    const slide = slides[index];
    const ref = slide.id || index + 1;
    history.replaceState(null, '', `#/${ref}${step ? '/' + step : ''}`);
    const total = slides.length - 1 || 1;
    const max = maxStep(slide);
    hud.bar.style.transform = `scaleX(${(index + (max ? step / max : 0)) / total})`;
    hud.count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    if (isPresenter) updatePresenter();
    if (!opts.remote) channel?.postMessage({ t: 'go', i: index, s: step });
  }

  function fromHash() {
    const m = location.hash.match(/^#\/?([^/]+)(?:\/(\d+))?/);
    return m ? [findSlide(decodeURIComponent(m[1])), Number(m[2] || 0)] : [0, 0];
  }

  /* ───────────────────────── chrome: HUD, overview, fullscreen, speaker view ───────────────────────── */

  const hud = (() => {
    const el = doc.createElement('div');
    el.className = 'hud';
    el.innerHTML = `<div class="hud-progress"><i></i></div>
      <button class="hud-btn" data-action="prev" aria-label="Previous slide">←</button>
      <span class="hud-count"></span>
      <button class="hud-btn" data-action="next" aria-label="Next slide">→</button>`;
    doc.body.append(el);
    return { el, bar: $('.hud-progress i', el), count: $('.hud-count', el) };
  })();

  function toggleOverview(force) {
    const on = force ?? !root.classList.contains('overview');
    if (on === root.classList.contains('overview')) return;
    const apply = () => {
      root.classList.toggle('overview', on);
      fit();
      if (on) slides[index]?.scrollIntoView({ block: 'center' });
    };
    if (!doc.startViewTransition || reduced.matches) return apply();
    root.dataset.vt = 'page';
    doc.startViewTransition(apply).finished.finally(() => delete root.dataset.vt);
  }

  stage.addEventListener('click', e => {
    if (!root.classList.contains('overview')) return;
    const slide = e.target.closest('.slide');
    if (!slide) return;
    e.stopPropagation();
    root.classList.remove('overview');
    fit();
    go(slides.indexOf(slide), 0, { instant: true });
  }, true);

  function toggleFullscreen() {
    if (doc.fullscreenElement) doc.exitFullscreen();
    else root.requestFullscreen?.().catch(() => {});
  }

  function openPresenter() {
    const url = new URL(location.href);
    url.searchParams.set('presenter', '');
    window.open(url, 'deck-presenter', 'width=1400,height=860');
  }

  let presenter = null;
  function buildPresenter() {
    root.classList.add('presenter');
    const el = doc.createElement('aside');
    el.className = 'presenter-panel';
    el.innerHTML = `<header><button class="pp-timer" title="Click to restart">00:00</button><span class="pp-count"></span></header>
      <section class="pp-next"><small>Up next</small><div class="pp-next-title"></div></section>
      <section class="pp-notes"></section>`;
    doc.body.append(el);
    presenter = { el, timer: $('.pp-timer', el), count: $('.pp-count', el), next: $('.pp-next-title', el), notes: $('.pp-notes', el), t0: Date.now() };
    presenter.timer.addEventListener('click', () => { presenter.t0 = Date.now(); });
    setInterval(() => {
      const sec = Math.floor((Date.now() - presenter.t0) / 1000);
      presenter.timer.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    }, 500);
  }
  const titleOf = s => s ? (s.dataset.title || $('h1, h2, h3', s)?.getAttribute('aria-label') || $('h1, h2, h3', s)?.textContent.trim() || `Slide ${slides.indexOf(s) + 1}`) : 'End of deck';
  function updatePresenter() {
    if (!presenter) return;
    const slide = slides[index];
    const max = maxStep(slide);
    presenter.count.textContent = `Slide ${index + 1}/${slides.length}${max ? ` · step ${step}/${max}` : ''}`;
    presenter.next.textContent = step < max ? 'Next build on this slide' : titleOf(slides[index + 1]);
    presenter.notes.innerHTML = $('.notes', slide)?.innerHTML || '<p class="pp-empty">No notes for this slide.</p>';
  }

  /* ───────────────────────── input ───────────────────────── */

  addEventListener('keydown', e => {
    if (e.target.closest?.(FIELD)) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const onControl = e.target.closest?.('button, a[href], [data-action]');
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': next(); break;
      case ' ': case 'Enter': if (onControl) return; next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': prev(); break;
      case 'Home': go(0); break;
      case 'End': go(slides.length - 1, 'end'); break;
      case 'o': case 'O': toggleOverview(); break;
      case 'Escape': toggleOverview(false); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 's': case 'S': if (!isPresenter) openPresenter(); break;
      case 'R': reset(); break; // Shift+R
      default: return;
    }
    e.preventDefault();
  });

  let swipe = null;
  deckEl.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' || e.target.closest(INTERACTIVE)) return;
    swipe = { x: e.clientX, y: e.clientY };
  });
  deckEl.addEventListener('pointerup', e => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) dx < 0 ? next() : prev();
  });

  // Pointer parallax: eased --px/--py in [-1, 1] on <body>; [data-depth] elements read them.
  const pointer = { tx: 0, ty: 0, x: 0, y: 0, raf: 0 };
  addEventListener('pointermove', e => {
    pointer.tx = e.clientX / innerWidth * 2 - 1;
    pointer.ty = e.clientY / innerHeight * 2 - 1;
    if (!pointer.raf && !reduced.matches) pointer.raf = requestAnimationFrame(drift);
    root.classList.remove('idle');
    clearTimeout(pointer.idle);
    if (!isPresenter) pointer.idle = setTimeout(() => root.classList.add('idle'), 2600);
  });
  function drift() {
    pointer.x += (pointer.tx - pointer.x) * 0.07;
    pointer.y += (pointer.ty - pointer.y) * 0.07;
    doc.body.style.setProperty('--px', pointer.x.toFixed(4));
    doc.body.style.setProperty('--py', pointer.y.toFixed(4));
    const settled = Math.abs(pointer.tx - pointer.x) + Math.abs(pointer.ty - pointer.y) < 0.001;
    pointer.raf = settled ? 0 : requestAnimationFrame(drift);
  }

  function fit() {
    const r = deckEl.getBoundingClientRect();
    root.style.setProperty('--scale', Math.min(r.width / W, r.height / H));
    const cols = r.width < 900 ? 2 : r.width < 1500 ? 3 : 4;
    const gap = 28, pad = 48;
    root.style.setProperty('--ov-cols', cols);
    root.style.setProperty('--ov-zoom', ((r.width - pad * 2 - gap * (cols - 1)) / cols / W).toFixed(4));
  }

  /* ───────────────────────── authoring helpers ───────────────────────── */

  // data-split → <span class="w"><span class="c">…</span></span>, preserving nested markup like <em>.
  function split(el) {
    const mode = el.dataset.split || (el.dataset.split = 'chars');
    el.setAttribute('aria-label', el.textContent.trim().replace(/\s+/g, ' '));
    let i = 0;
    const walk = node => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = doc.createDocumentFragment();
          for (const part of child.textContent.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) { frag.append(' '); continue; }
            const w = doc.createElement('span');
            w.className = 'w';
            w.setAttribute('aria-hidden', 'true');
            if (mode === 'words') w.style.setProperty('--i', i++), w.textContent = part;
            else for (const ch of part) {
              const c = doc.createElement('span');
              c.className = 'c';
              c.textContent = ch;
              c.style.setProperty('--i', i++);
              w.append(c);
            }
            frag.append(w);
          }
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && !child.matches('br, [data-tpl], [data-bind]')) walk(child);
        else if (child.nodeType === Node.ELEMENT_NODE && child.matches('[data-tpl], [data-bind]')) {
          // Bound text changes at runtime, so it enters as one unit in sequence.
          child.classList.add('w');
          child.style.setProperty('--i', i++);
        }
      }
    };
    walk(el);
  }

  function prepare() {
    $$('[data-split]').forEach(split);
    for (const el of $$('[data-delay]')) el.style.setProperty('--delay', `${parseFloat(el.dataset.delay) || 0}ms`);
    for (const el of $$('[data-duration]:not([data-count])')) el.style.setProperty('--dur', `${parseFloat(el.dataset.duration)}ms`);
    for (const p of $$('[data-stagger]')) {
      const gap = parseFloat(p.dataset.stagger) || 80, base = parseFloat(p.dataset.delay) || 0;
      $$('[data-anim], [data-split]', p).forEach((el, k) => {
        if (!el.hasAttribute('data-delay')) el.style.setProperty('--delay', `${base + k * gap}ms`);
      });
    }
    for (const el of $$('[data-depth]')) el.style.setProperty('--depth', el.dataset.depth);
    for (const s of slides) $('.notes', s)?.setAttribute('aria-hidden', 'true');
  }

  function reset() {
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, structuredClone(initial));
    try { localStorage.removeItem(STORE); } catch { /* ignore */ }
    for (const el of $$('[data-tween]')) el._v = undefined;
    commit();
  }

  /* ───────────────────────── public API ───────────────────────── */

  const api = {
    get state() { return state; },
    get index() { return index; },
    get step() { return step; },
    slides,
    reduced,
    get,
    test,
    interpolate,
    set(patch) { Object.assign(state, patch); commit(); },
    setPath(path, value) { setPath(path, value); commit(); },
    action(name, fn) { actions[name] = fn; return api; },
    computed(name, fn) { computed[name] = fn; return api; },
    on(type, idOrFn, fn) {
      hooks[type].push(typeof idOrFn === 'function' ? { fn: idOrFn } : { id: idOrFn, fn });
      return api;
    },
    run: (spec, ctx) => run(spec, ctx),
    go: (ref, st = 0, opts) => go(typeof ref === 'number' ? ref : findSlide(ref), st, opts),
    next, prev, reset,
    overview: toggleOverview,
    stepCount: ref => maxStep(slides[typeof ref === 'number' ? ref : findSlide(ref)]),
  };
  window.deck = api;

  /* ───────────────────────── boot ───────────────────────── */

  function init() {
    if (isPresenter) buildPresenter();
    prepare();
    new ResizeObserver(fit).observe(deckEl);
    fit();
    root.style.transition = 'none'; // no hue sweep on first paint
    render();
    const [i, s] = fromHash();
    go(i, s, { instant: true, remote: true });
    requestAnimationFrame(() => requestAnimationFrame(() => { root.style.transition = ''; root.classList.add('ready'); }));
    addEventListener('hashchange', () => {
      const [hi, hs] = fromHash();
      if (hi !== index || hs !== step) go(hi, hs);
    });
  }
  // Wait for the page's own scripts (actions, computed values) to register first.
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else setTimeout(init);
})();

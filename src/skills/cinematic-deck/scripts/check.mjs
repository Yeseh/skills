#!/usr/bin/env node
// Walk a deck in a headless browser: every slide at its first and last build step.
// Writes one screenshot per state and reports console errors and layout problems.
//
// Usage: node check.mjs <deck/index.html> [--out <dir>] [--motion] [--width 1600]
//   --motion  keep animations (default emulates reduced motion so every frame is settled)
// Needs Playwright (local or global npm). Set CHROMIUM_PATH to use a system browser.
// Exit code: 0 clean, 1 problems found, 2 could not run.

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};

const deckPath = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--out' && args[args.indexOf(a) - 1] !== '--width');
if (!deckPath || !existsSync(deckPath)) {
  console.error('error: pass the path to a deck index.html');
  process.exit(2);
}
const slug = path.basename(path.dirname(path.resolve(deckPath)));
const out = path.resolve(option('--out', path.join(tmpdir(), `deck-check-${slug}`)));
const width = Number(option('--width', 1600));
mkdirSync(out, { recursive: true });

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch { /* try the global install */ }
  try {
    const globalRoot = execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return createRequire(path.join(globalRoot, '/'))('playwright');
  } catch {
    console.error('error: Playwright not found. Install it with `npm i -g playwright`.');
    process.exit(2);
  }
}

async function launch(chromium) {
  const candidates = [process.env.CHROMIUM_PATH, undefined, '/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser'];
  for (const executablePath of candidates) {
    if (executablePath && !existsSync(executablePath)) continue;
    try { return await chromium.launch(executablePath ? { executablePath } : {}); } catch { /* next */ }
  }
  console.error('error: no usable Chromium. Run `npx playwright install chromium` or set CHROMIUM_PATH.');
  process.exit(2);
}

// Runs inside the page. Returns human-readable problems for the active slide.
function inspect() {
  const problems = [];
  const slide = document.querySelector('.slide.active');
  const box = slide.getBoundingClientRect();
  const hidden = el => !!el.closest('[data-step]:not(.on), [hidden], .notes, .layer-back, [data-depth]');
  const name = el => {
    const text = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `<${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}> "${text}"`;
  };
  const overlap = (a, b) => {
    const r = a.getBoundingClientRect(), s = b.getBoundingClientRect();
    return Math.min(r.right, s.right) - Math.max(r.left, s.left) > 2 && Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top) > 2;
  };

  for (const el of slide.querySelectorAll('h1, h2, h3, p, li, .node, .actor, .btn, .panel, .diagram, .sequence, .code, img, table')) {
    if (hidden(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.left < box.left - 2 || r.top < box.top - 2 || r.right > box.right + 2 || r.bottom > box.bottom + 2) {
      problems.push(`outside the slide: ${name(el)}`);
    }
    // Containers (.diagram, .sequence, .panel) overhang on purpose; only text boxes are checked.
    if (el.matches('h1, h2, h3, p, li, .node, .actor, .btn') && el.scrollWidth > el.clientWidth + 2) {
      const clipped = getComputedStyle(el).overflowX !== 'visible';
      problems.push(`${clipped ? 'text clipped' : 'content spills out of its box'}: ${name(el)}`);
    }
  }

  for (const diagram of slide.querySelectorAll('.diagram')) {
    const nodes = [...diagram.querySelectorAll(':scope > .node')].filter(n => !hidden(n));
    nodes.forEach((a, i) => nodes.slice(i + 1).forEach(b => {
      if (overlap(a, b)) problems.push(`diagram nodes overlap: ${name(a)} and ${name(b)}`);
    }));
    for (const label of diagram.querySelectorAll('.edge-label')) {
      if (hidden(label)) continue;
      const hit = nodes.find(n => overlap(label, n));
      if (hit) problems.push(`edge label "${label.textContent}" covers ${name(hit)}`);
    }
  }
  return problems;
}

// Runs inside the page once. Markup conflicts the engine cannot resolve.
function lint() {
  const problems = [];
  const ids = [...document.querySelectorAll('.slide')].map(s => s.id).filter(Boolean);
  for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) problems.push(`duplicate slide id "${id}"`);
  for (const slide of document.querySelectorAll('.slide')) {
    const label = slide.id || `slide ${[...slide.parentElement.children].indexOf(slide) + 1}`;
    const morphs = [...slide.querySelectorAll('[data-morph]')].filter(el => !el.hasAttribute('data-show')).map(el => el.dataset.morph);
    for (const m of new Set(morphs.filter((m, i) => morphs.indexOf(m) !== i))) problems.push(`${label}: data-morph "${m}" used twice on one slide`);
    for (const el of slide.querySelectorAll('[data-step][data-anim]')) problems.push(`${label}: element has both data-step and data-anim (use one): ${el.outerHTML.slice(0, 80)}`);
    for (const el of slide.querySelectorAll('[data-morph] [data-anim], [data-morph][data-anim]')) problems.push(`${label}: data-anim inside a data-morph element breaks the morph: ${el.outerHTML.slice(0, 80)}`);
    for (const img of slide.querySelectorAll('img:not([alt])')) problems.push(`${label}: image without alt text: ${img.getAttribute('src')}`);
    if (!slide.querySelector('.notes')) problems.push(`${label}: no speaker notes`);
  }
  return problems;
}

const { chromium } = loadPlaywright();
const browser = await launch(chromium);
const context = await browser.newContext({
  viewport: { width, height: Math.round(width * 9 / 16) },
  reducedMotion: flag('--motion') ? 'no-preference' : 'reduce',
});
const page = await context.newPage();
await page.goto(pathToFileURL(path.resolve(deckPath)).href);
await page.evaluate(() => localStorage.clear());

const errors = [];
page.on('requestfailed', r => errors.push(`missing file: ${decodeURI(r.url())}`));
page.on('console', m => {
  if (m.text().startsWith('Failed to load resource')) return; // reported with its URL by requestfailed
  if (m.type() === 'error' || (m.type() === 'warning' && m.text().startsWith('[deck]'))) errors.push(m.text());
});
page.on('pageerror', e => errors.push(`page error: ${e.message}`));
await page.reload();
await page.waitForFunction(() => window.deck && document.documentElement.classList.contains('ready'), null, { timeout: 10000 })
  .catch(() => errors.push('deck did not boot within 10 s (is deck/deck.js loaded?)'));
await page.evaluate(() => document.fonts.ready);

const settle = flag('--motion') ? 2600 : 700;
const report = { shots: [], layout: [], markup: await page.evaluate(lint) };
const count = await page.evaluate(() => deck.slides.length);

for (let i = 0; i < count; i++) {
  const { id, steps } = await page.evaluate(n => ({ id: deck.slides[n].id || `slide-${n + 1}`, steps: deck.stepCount(n) }), i);
  for (const step of steps ? [0, steps] : [0]) {
    await page.evaluate(([n, s]) => deck.go(n, s, { instant: true }), [i, step]);
    await page.waitForTimeout(settle);
    const file = path.join(out, `${String(i + 1).padStart(2, '0')}-${id}-step${step}.png`);
    await page.screenshot({ path: file });
    report.shots.push(file);
    if (step === steps) for (const p of await page.evaluate(inspect)) report.layout.push(`${id}: ${p}`);
  }
}
await browser.close();

const sections = [['console', errors], ['layout', report.layout], ['markup', report.markup]];
console.log(`slides: ${count}  screenshots: ${report.shots.length} in ${out}`);
for (const [title, items] of sections) {
  console.log(`\n${title}: ${items.length ? items.length + ' problem(s)' : 'clean'}`);
  for (const item of items) console.log(`  - ${item}`);
}
process.exit(sections.some(([, items]) => items.length) ? 1 : 0);

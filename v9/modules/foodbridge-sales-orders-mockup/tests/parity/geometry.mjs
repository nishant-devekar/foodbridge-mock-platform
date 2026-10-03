#!/usr/bin/env node
/*
  node geometry.mjs <viewport> <css selector> [<state>]

  Opens both sides (servers from serve.mjs must be running), optionally drives them to a state from
  states.mjs, and prints the box and key computed styles of every element the selector matches,
  side by side with the delta. The tool for turning "the diff is red here" into "this element is
  2px taller because its line-height is 20px, not 18px".
*/
import { chromium } from 'playwright';
import { openSide, settle, warmStorage } from './lib/capture.mjs';
import { STATES } from './states.mjs';

const [viewport = 'desktop', selector = '[data-testid^="order-row-"]', stateName] = process.argv.slice(2);
const NOW = Number(process.env.PARITY_NOW || Date.parse('2026-09-25T11:00:00+05:30'));
const PROPS = (process.env.PROPS || 'display,font-size,line-height,font-weight,padding,margin,height,border-width,vertical-align,font-family').split(',');

const setup = (await (await fetch('http://127.0.0.1:4291/v2/multiAdmin/setup')).json()).data;
const browser = await chromium.launch({ args: ['--explicitly-allowed-ports=4190'] });
const out = {};
for (const side of ['react', 'html']) {
  const url = side === 'react' ? 'http://localhost:4190/' : 'http://127.0.0.1:4292/index.html?chrome=none';
  const { context, page } = await openSide(browser, side, { url, viewport, now: NOW, storage: side === 'react' ? warmStorage(setup) : null });
  await settle(page, { expect: 'list' });
  const state = STATES.find((s) => s.name === stateName);
  if (state?.steps) await state.steps(page, side);
  out[side] = await page.evaluate(({ selector, PROPS }) => [...document.querySelectorAll(selector)].slice(0, 40).map((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const label = (el.getAttribute('data-testid') || el.tagName.toLowerCase() + '.' + String(el.className?.baseVal ?? el.className).split(' ').slice(0, 3).join('.')).slice(0, 60);
    return { label, box: [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10), css: Object.fromEntries(PROPS.map((p) => [p, cs.getPropertyValue(p)])) };
  }), { selector, PROPS });
  await context.close();
}
await browser.close();

const n = Math.max(out.react.length, out.html.length);
for (let i = 0; i < n; i += 1) {
  const a = out.react[i]; const b = out.html[i];
  if (!a || !b) { console.log(`#${i} only on ${a ? 'react' : 'html'}: ${(a || b).label}`); continue; }
  const d = a.box.map((v, k) => Math.round((b.box[k] - v) * 10) / 10);
  const same = d.every((v) => v === 0);
  console.log(`${same ? '  ' : '≠ '}#${i} ${a.label}\n    react ${a.box.join(', ')}\n    html  ${b.box.join(', ')}  Δ ${d.join(', ')}`);
  for (const p of PROPS) if (a.css[p] !== b.css[p]) console.log(`      ${p}: ${a.css[p]}  →  ${b.css[p]}`);
}

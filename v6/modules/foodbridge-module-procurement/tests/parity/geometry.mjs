#!/usr/bin/env node
/*
  node geometry.mjs <viewport> '<css selector>' [<state>]

  Starts both sides (like run.mjs), optionally drives them to a state from states.mjs, and prints the
  box and key computed styles of every element the selector matches, side by side with the delta.
  The tool for turning "the diff is red here" into "this element is 2px taller because its
  line-height is 20px, not 18px".   PROPS=a,b,c overrides the computed properties printed.
*/
import { chromium } from 'playwright';
import { startServers, NOW } from './lib/servers.mjs';
import { openSide, settle, warmStorage } from './lib/capture.mjs';
import { STATES } from './states.mjs';

const [viewport = 'desktop', selector = '[data-testid^="sourcing-row-"]', stateName] = process.argv.slice(2);
const PROPS = (process.env.PROPS || 'display,font-size,line-height,font-weight,font-family,padding,margin,height,width,border-width,vertical-align,letter-spacing').split(',');

const servers = await startServers();
const browser = await chromium.launch();
const out = {};
try {
  const state = STATES.find((s) => s.name === stateName);
  const sc = { list: 'normal', ...state?.scenario };
  for (const side of ['react', 'html']) {
    await servers.scenario({ ...sc, reset: true });
    const params = new URLSearchParams({ chrome: 'none' });
    if (sc.list !== 'normal') params.set('scenario', sc.list === 'hang' ? 'loading' : sc.list);
    if (sc.tenant) params.set('tenant', sc.tenant);
    const url = side === 'react' ? servers.reactUrl : `${servers.htmlUrl}?${params}`;
    const { context, page } = await openSide(browser, side, { url, viewport, now: NOW, storage: side === 'react' ? await warmStorage(await servers.setup()) : null });
    await settle(page, { expect: state?.expect || (sc.list === 'hang' ? 'loading' : sc.list === 'normal' ? 'list' : 'empty') });
    if (state?.steps) await state.steps(page, { side, viewport }).catch((e) => console.log(`(${side} did not reach ${stateName}: ${e.message.split('\n')[0]})`));
    out[side] = await page.evaluate(({ selector, PROPS }) => [...document.querySelectorAll(selector)].slice(0, 60).map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const label = (el.getAttribute('data-testid') || el.tagName.toLowerCase() + '.' + String(el.className?.baseVal ?? el.className).split(' ').slice(0, 4).join('.')).slice(0, 70);
      return { label, box: [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 100) / 100), css: Object.fromEntries(PROPS.map((p) => [p, cs.getPropertyValue(p)])) };
    }), { selector, PROPS });
    await context.close();
  }
} finally {
  await browser.close();
  await servers.stop();
}

const n = Math.max(out.react.length, out.html.length);
for (let i = 0; i < n; i += 1) {
  const a = out.react[i]; const b = out.html[i];
  if (!a || !b) { const x = a || b; console.log(`#${i} only on ${a ? 'react' : 'html'}: ${x.label}  ${x.box.join(', ')}  ${JSON.stringify(x.css)}`); continue; }
  const d = a.box.map((v, k) => Math.round((b.box[k] - v) * 100) / 100);
  const same = d.every((v) => v === 0);
  console.log(`${same ? '  ' : '≠ '}#${i} ${a.label}\n    react ${a.box.join(', ')}\n    html  ${b.box.join(', ')}  Δ ${d.join(', ')}`);
  for (const p of PROPS) if (a.css[p] !== b.css[p]) console.log(`      ${p}: ${a.css[p]}  →  ${b.css[p]}`);
}

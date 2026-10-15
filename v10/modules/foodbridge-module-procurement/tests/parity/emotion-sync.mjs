#!/usr/bin/env node
/*
  node emotion-sync.mjs <viewport> <state> [<state> …]

  Drives the ORACLE to each state and copies every emotion (react-select) rule the page holds into
  css/react-select.css, if the prototype does not have it yet. Class names are hashes of the style
  objects, so a copied rule applies to the prototype markup that uses the same class name.

  Rules that position a portalled menu (react-select's menuPortal: position absolute + a measured
  top/left) depend on the viewport and are NOT copied — the prototype positions those inline.
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServers, NOW } from './lib/servers.mjs';
import { openSide, settle, warmStorage } from './lib/capture.mjs';
import { STATES } from './states.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(HERE, '../../css/react-select.css');
const [viewport, ...names] = process.argv.slice(2);
const servers = await startServers();
const browser = await chromium.launch();
const found = new Map();
try {
  for (const name of names) {
    const state = STATES.find((s) => s.name === name);
    if (!state) throw new Error(`no state ${name}`);
    const sc = { list: 'normal', ...state.scenario };
    await servers.scenario({ ...sc, reset: true });
    const { context, page } = await openSide(browser, 'react', { url: servers.reactUrl, viewport, now: NOW, storage: await warmStorage(await servers.setup()) });
    await settle(page, { expect: state.expect || 'list' });
    if (state.steps) await state.steps(page, { side: 'react', viewport });
    const rules = await page.evaluate(() => {
      const out = [];
      for (const sheet of document.styleSheets) {
        let list; try { list = sheet.cssRules; } catch { continue; }
        for (const r of list) if (r.selectorText && /^\.css-[a-z0-9]+(-[A-Za-z0-9]+)*(:[a-z-]+)*/.test(r.selectorText)) out.push(r.cssText);
      }
      return out;
    });
    for (const r of rules) found.set(r, name);
    await context.close();
  }
} finally { await browser.close(); await servers.stop(); }

let css = fs.readFileSync(FILE, 'utf8');
const have = new Set(css.split('\n').map((l) => l.trim()));
const added = [];
for (const [rule, state] of found) {
  const isPortal = /position: absolute;/.test(rule) && /top: [\d.]+px/.test(rule) && /left: [\d.]+px/.test(rule);
  if (isPortal) { console.log(`skip (menu portal position): ${rule.slice(0, 90)}`); continue; }
  // Compare against what we already have, allowing for emotion's own serialisation.
  const sel = rule.slice(0, rule.indexOf('{')).trim();
  if ([...have].some((l) => l.startsWith(sel + '{') || l.startsWith(sel + ' {'))) continue;
  added.push(`${rule} /* ${state} */`);
}
if (added.length) fs.appendFileSync(FILE, `\n${added.join('\n')}\n`);
console.log(added.length ? `added ${added.length} rules:\n${added.map((a) => '  ' + a.slice(0, 110)).join('\n')}` : 'nothing new');

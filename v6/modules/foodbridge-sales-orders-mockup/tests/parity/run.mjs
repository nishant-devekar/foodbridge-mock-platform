#!/usr/bin/env node
/*
  node run.mjs [--only list,row-expanded] [--side react|html|both] [--dpr 2] [--list]

  Starts the oracle (production module, real backend + real built screens, over this prototype's
  dataset) and the prototype, drives both through every state in states.mjs at the same viewport,
  clock, locale and time zone, photographs both, and pixel-diffs them into __shots__/report.html.

  REACT_SALES_ORDERS defaults to the sibling checkout:
    <workspace>/foodbridge-module-route-delivery/development/sales-orders
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServers, MOCKUP } from './lib/servers.mjs';
import { openSide, settle, shoot, dumpDom, warmStorage } from './lib/capture.mjs';
import { STATES } from './states.mjs';
import { compareAll, writeReport, SHOTS } from './compare.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const flag = (name) => process.argv.includes(`--${name}`);

if (flag('list')) { for (const s of STATES) console.log(`${s.name.padEnd(22)} ${s.viewports.join(', ')}`); process.exit(0); }

const REACT_SALES_ORDERS = process.env.REACT_SALES_ORDERS
  || path.resolve(MOCKUP, '../../../../foodbridge-module-route-delivery/development/sales-orders');
// Every date on both screens is counted back from this instant: Friday 25 Sep 2026, 11:00 IST.
const NOW = Number(process.env.PARITY_NOW || Date.parse('2026-09-25T11:00:00+05:30'));
const only = arg('only', '').split(',').filter(Boolean);
const sides = arg('side', 'both') === 'both' ? ['react', 'html'] : [arg('side')];
const dpr = Number(arg('dpr', 1));

const states = STATES.filter((s) => !only.length || only.includes(s.name));
const log = flag('verbose') ? (s) => process.stdout.write(s) : () => {};

const servers = await startServers({ reactSalesOrders: REACT_SALES_ORDERS, now: NOW, log });
// :4190 (the module's own sandbox port) is on Chromium's unsafe-port list.
const browser = await chromium.launch({ args: ['--explicitly-allowed-ports=4190'] });
const failures = [];

try {
  for (const state of states) {
    for (const viewport of state.viewports) {
      for (const side of sides) {
        await servers.scenario({ list: 'normal', ...state.scenario, reset: true });
        // The prototype names the never-answering server "loading"; the oracle's control calls it "hang".
        const scenario = state.scenario?.list && state.scenario.list !== 'normal' ? `&scenario=${state.scenario.list === 'hang' ? 'loading' : state.scenario.list}` : '';
        // A tenant variant: the oracle now serves that setup, and the prototype is told the same.
        const tenant = state.scenario?.tenant ? `&tenant=${state.scenario.tenant}` : '';
        const setup = state.scenario?.tenant ? (await (await fetch(`${servers.apiUrl ?? 'http://127.0.0.1:4291'}/v2/multiAdmin/setup`)).json()).data : servers.setup;
        const url = side === 'react' ? servers.reactUrl : `${servers.htmlUrl}?chrome=none${scenario}${tenant}`;
        const { context, page, errors } = await openSide(browser, side, { url, viewport, now: NOW, dpr, storage: side === 'react' ? warmStorage(setup) : null });
        await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin }).catch(() => {});
        const dir = path.join(SHOTS, side, viewport);
        fs.mkdirSync(dir, { recursive: true });
        // A state is either photographed fresh or recorded as failed — never left with a stale shot.
        for (const f of [`${state.name}.png`, `${state.name}-full.png`, `${state.name}.FAILED.png`]) fs.rmSync(path.join(dir, f), { force: true });
        try {
          await settle(page, { expect: state.expect === 'loading' ? 'loading' : state.scenario?.list === 'error' ? 'error' : state.scenario?.list === 'empty' ? 'empty' : 'list' });
          if (state.steps) await state.steps(page, side);
          if (state.expect && !state.scenario) await settle(page, { expect: state.expect });
          fs.writeFileSync(path.join(dir, `${state.name}.dom.html`), await dumpDom(page));
          await shoot(page, path.join(dir, state.name));
          process.stdout.write(`  ✓ ${side.padEnd(5)} ${viewport.padEnd(7)} ${state.name}${errors.length ? `  (${errors.length} page errors)` : ''}\n`);
        } catch (err) {
          failures.push(`${side} ${viewport} ${state.name}: ${err.message.split('\n')[0]}`);
          process.stdout.write(`  ✗ ${side.padEnd(5)} ${viewport.padEnd(7)} ${state.name}: ${err.message.split('\n')[0]}\n`);
          await page.screenshot({ path: path.join(dir, `${state.name}.FAILED.png`) }).catch(() => {});
        }
        if (errors.length && flag('verbose')) console.log(errors.join('\n'));
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  await servers.stop();
}

const rows = compareAll();
writeReport(rows);
const identical = rows.filter((r) => r.pixels === 0).length;
console.log(`\n  ${identical}/${rows.length} identical · report: ${path.relative(process.cwd(), path.join(SHOTS, 'report.html'))}`);
for (const r of rows) if (r.pixels !== 0) console.log(r.missing ? `  MISSING on ${r.missing}  ${r.key}` : `  ${String(r.pixels).padStart(8)} px  ${(r.ratio * 100).toFixed(2).padStart(6)}%  ${r.key}`);
if (failures.length) { console.log(`\n  ${failures.length} failed to reach their state:`); for (const f of failures) console.log(`   - ${f}`); }
process.exit(failures.length || identical !== rows.length ? 1 : 0);

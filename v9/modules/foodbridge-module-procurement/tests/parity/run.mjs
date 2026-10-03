#!/usr/bin/env node
/*
  node run.mjs [--only list,row-expanded] [--side react|html|both] [--viewport phone,desktop] [--dpr 2] [--list] [--verbose]

  Starts the oracle (production's /sourcing-orders page: storefront's own source + the module's
  built dist, over the module's real backend seeded with this prototype's dataset) and the
  prototype, drives both through every state in states.mjs at the same viewport, clock, locale and
  time zone, photographs both, and pixel-diffs them into __shots__/report.html.
*/
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { startServers, NOW } from './lib/servers.mjs';
import { openSide, settle, shoot, dumpDom, warmStorage } from './lib/capture.mjs';
import { STATES } from './states.mjs';
import { compareAll, writeReport, SHOTS } from './compare.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const flag = (name) => process.argv.includes(`--${name}`);

if (flag('list')) { for (const s of STATES) console.log(`${s.name.padEnd(30)} ${s.viewports.join(', ')}`); process.exit(0); }

const only = arg('only', '').split(',').filter(Boolean);
const onlyVp = arg('viewport', '').split(',').filter(Boolean);
const sides = arg('side', 'both') === 'both' ? ['react', 'html'] : [arg('side')];
const dpr = Number(arg('dpr', 1));
const states = STATES.filter((s) => !only.length || only.some((o) => (o.endsWith('*') ? s.name.startsWith(o.slice(0, -1)) : s.name === o)));
if (!states.length) { console.error('no state matches --only'); process.exit(2); }
const log = flag('verbose') ? (s) => process.stdout.write(s) : () => {};

const gaps = [];
const servers = await startServers({ log, gaps });
const browser = await chromium.launch();
const failures = [];

try {
  for (const state of states) {
    for (const viewport of state.viewports.filter((v) => !onlyVp.length || onlyVp.includes(v))) {
      for (const side of sides) {
        const sc = { list: 'normal', ...state.scenario };
        await servers.scenario({ ...sc, reset: true });
        const params = new URLSearchParams({ chrome: 'none' });
        if (sc.list !== 'normal') params.set('scenario', sc.list === 'hang' ? 'loading' : sc.list);
        if (sc.tenant) params.set('tenant', sc.tenant);
        const url = side === 'react' ? servers.reactUrl : `${servers.htmlUrl}?${params}`;
        const storage = side === 'react' ? await warmStorage(await servers.setup()) : null;
        const { context, page, errors } = await openSide(browser, side, { url, viewport, now: NOW, dpr, storage });
        await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin }).catch(() => {});
        const dir = path.join(SHOTS, side, viewport);
        fs.mkdirSync(dir, { recursive: true });
        // A state is either photographed fresh or recorded as failed — never left with a stale shot.
        for (const f of [`${state.name}.png`, `${state.name}-full.png`, `${state.name}.FAILED.png`, `${state.name}.dom.html`]) fs.rmSync(path.join(dir, f), { force: true });
        try {
          await settle(page, { expect: state.expect || (sc.list === 'hang' ? 'loading' : sc.list === 'normal' ? 'list' : 'empty') });
          if (state.steps) await state.steps(page, { side, viewport });
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
if (gaps.length) { console.log(`\n  ${gaps.length} request(s) the oracle had no fixture for:`); for (const g of [...new Set(gaps)]) console.log(`   - ${g}`); }
if (failures.length) { console.log(`\n  ${failures.length} failed to reach their state:`); for (const f of failures) console.log(`   - ${f}`); }
process.exit(failures.length || gaps.length || identical !== rows.length ? 1 : 0);

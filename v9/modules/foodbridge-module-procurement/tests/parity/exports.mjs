#!/usr/bin/env node
/*
  node exports.mjs

  The screen's one export: a PO / GRN document's Download (PODocumentModal.handleDownload) — an HTML
  file of the document plus every stylesheet rule the page holds. For each case, both sides are
  driven to the document, Download is clicked, and the files are compared three ways:

    name      the suggested file name
    cells     every heading, cell and labelled value of the document, in order, exactly
    render    the file opened on its own in a fresh page, photographed and pixel-diffed

  And the two prints, which make no file but are the screen's other output: the PO/GRN document's
  Print (the document copied into the page, everything else hidden under @media print) and the Raw
  Material report's Print (react-to-print's iframe). window.print is stubbed; the page — or the
  iframe, enlarged in place — is photographed under print media and pixel-diffed.

  The stylesheet text itself is NOT compared byte for byte: it is "every rule the page holds", and
  the prototype's page is a different build of the same styles. The render comparison is what the
  styles are for. Output: __shots__/exports/ (both files, both renders, the diff).
*/
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { startServers, NOW } from './lib/servers.mjs';
import { openSide, settle, warmStorage } from './lib/capture.mjs';
import { STATES } from './states.mjs';
import { SHOTS } from './compare.mjs';

const CASES = ['doc-po', 'doc-po-internal', 'doc-grn-short', 'doc-grn-match'];
const PRINTS = [
  { name: 'print-po', state: 'doc-po', click: (page) => page.getByTestId('po-document-print-btn').click(), frame: false },
  { name: 'print-grn', state: 'doc-grn-short', click: (page) => page.getByTestId('po-document-print-btn').click(), frame: false },
  { name: 'print-rawcalc', state: 'rawcalc-report-products', click: (page) => page.getByRole('button', { name: 'Print Report' }).click(), frame: true },
];
const diffPng = (name) => {
  const a = PNG.sync.read(fs.readFileSync(path.join(OUT, `${name}.react.png`)));
  const b = PNG.sync.read(fs.readFileSync(path.join(OUT, `${name}.html.png`)));
  if (a.width !== b.width || a.height !== b.height) return { pixels: null, size: [`${a.width}x${a.height}`, `${b.width}x${b.height}`] };
  const diff = new PNG({ width: a.width, height: a.height });
  const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  fs.writeFileSync(path.join(OUT, `${name}.diff.png`), PNG.sync.write(diff));
  return { pixels, size: [`${a.width}x${a.height}`] };
};
const OUT = path.join(SHOTS, 'exports');
fs.mkdirSync(OUT, { recursive: true });

/** The document's text, in reading order: every cell and every leaf block, whitespace-folded. */
const CELLS = () => {
  const out = [];
  const walk = (el) => {
    const kids = [...el.children];
    if (!kids.length || ['TD', 'TH'].includes(el.tagName)) { const t = el.textContent.replace(/\s+/g, ' ').trim(); if (t) out.push(`${el.tagName.toLowerCase()}: ${t}`); return; }
    for (const k of kids) walk(k);
  };
  walk(document.body);
  return out;
};

const servers = await startServers({});
const browser = await chromium.launch();
const results = [];
try {
  for (const name of CASES) {
    const state = STATES.find((s) => s.name === name);
    const got = {};
    for (const side of ['react', 'html']) {
      await servers.scenario({ list: 'normal', reset: true });
      const url = side === 'react' ? servers.reactUrl : `${servers.htmlUrl}?chrome=none`;
      const storage = side === 'react' ? await warmStorage(await servers.setup()) : null;
      const { context, page } = await openSide(browser, side, { url, viewport: 'desktop', now: NOW, storage });
      await settle(page, { expect: 'list' });
      await state.steps(page, { side, viewport: 'desktop' });
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('po-document-download-btn').click()]);
      const file = path.join(OUT, `${name}.${side}.html`);
      await download.saveAs(file);
      const viewer = await context.newPage();
      await viewer.setViewportSize({ width: 1280, height: 900 });
      await viewer.goto(`file://${file}`);
      await viewer.waitForTimeout(300);
      const cells = await viewer.evaluate(CELLS);
      await viewer.screenshot({ path: path.join(OUT, `${name}.${side}.png`), fullPage: true });
      got[side] = { filename: download.suggestedFilename(), cells };
      await context.close();
    }
    const a = PNG.sync.read(fs.readFileSync(path.join(OUT, `${name}.react.png`)));
    const b = PNG.sync.read(fs.readFileSync(path.join(OUT, `${name}.html.png`)));
    let pixels = null;
    if (a.width === b.width && a.height === b.height) {
      const diff = new PNG({ width: a.width, height: a.height });
      pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
      fs.writeFileSync(path.join(OUT, `${name}.diff.png`), PNG.sync.write(diff));
    }
    const cellDiffs = [];
    const n = Math.max(got.react.cells.length, got.html.cells.length);
    for (let i = 0; i < n; i += 1) if (got.react.cells[i] !== got.html.cells[i]) cellDiffs.push({ i, react: got.react.cells[i], html: got.html.cells[i] });
    results.push({ name, filename: [got.react.filename, got.html.filename], cells: got.react.cells.length, cellDiffs, pixels, size: [`${a.width}x${a.height}`, `${b.width}x${b.height}`] });
  }
  for (const pr of PRINTS) {
    const state = STATES.find((x) => x.name === pr.state);
    const sc = { list: 'normal', ...state.scenario };
    for (const side of ['react', 'html']) {
      await servers.scenario({ ...sc, reset: true });
      const q = new URLSearchParams({ chrome: 'none' });
      if (sc.tenant) q.set('tenant', sc.tenant);
      const url = side === 'react' ? servers.reactUrl : `${servers.htmlUrl}?${q}`;
      const storage = side === 'react' ? await warmStorage(await servers.setup()) : null;
      const { context, page } = await openSide(browser, side, { url, viewport: 'desktop', now: NOW, storage });
      await context.addInitScript(() => { window.print = () => {}; });
      await page.evaluate(() => { window.print = () => {}; });
      await settle(page, { expect: 'list' });
      await state.steps(page, { side, viewport: 'desktop' });
      await pr.click(page);
      await page.waitForTimeout(700);
      await page.emulateMedia({ media: 'print' });
      if (pr.frame) {
        // The print iframe, brought on screen at the page's width and its content's height.
        const h = await page.evaluate(() => {
          const f = [...document.querySelectorAll('iframe')].pop();
          f.style.cssText = 'position: fixed; left: 0; top: 0; width: 1280px; height: 900px; z-index: 2147483647; border: 0; background: #fff; visibility: visible; display: block;';
          return f.contentDocument.documentElement.scrollHeight;
        });
        await page.setViewportSize({ width: 1280, height: Math.min(Math.max(h, 900), 6000) });
        await page.evaluate((hh) => { [...document.querySelectorAll('iframe')].pop().style.height = `${hh}px`; }, Math.min(Math.max(h, 900), 6000));
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(OUT, `${pr.name}.${side}.png`) });
      } else {
        await page.screenshot({ path: path.join(OUT, `${pr.name}.${side}.png`), fullPage: true });
      }
      await context.close();
    }
    const d = diffPng(pr.name);
    results.push({ name: pr.name, filename: ['(print)', '(print)'], cells: 0, cellDiffs: [], pixels: d.pixels, size: d.size });
  }
} finally {
  await browser.close();
  await servers.stop();
}

let ok = true;
for (const r of results) {
  const same = r.filename[0] === r.filename[1] && !r.cellDiffs.length && r.pixels === 0;
  ok &&= same;
  console.log(`${same ? '✓' : '✗'} ${r.name.padEnd(16)} ${r.filename[0]}${r.filename[0] === r.filename[1] ? '' : ` ≠ ${r.filename[1]}`} · ${r.cells} cells, ${r.cellDiffs.length} differ · render ${r.pixels === null ? `size ${r.size.join(' vs ')}` : `${r.pixels} px`}`);
  for (const d of r.cellDiffs.slice(0, 8)) console.log(`    #${d.i}  react: ${d.react}\n         html:  ${d.html}`);
}
fs.writeFileSync(path.join(OUT, 'exports.json'), JSON.stringify(results, null, 2));
process.exit(ok ? 0 : 1);

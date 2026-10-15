/*
  Pixel diff of every captured pair, and the report.

    __shots__/react/<viewport>/<state>[-full].png   the oracle
    __shots__/html/<viewport>/<state>[-full].png    the prototype
    __shots__/diff/<viewport>/<state>[-full].png    red = differs

  A pair that exists on one side only is a FAILURE, never a skip. Images of different sizes are
  compared over the larger canvas (the missing area counts as different) — a prototype that is
  shorter than the oracle is not "the same except shorter".
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SHOTS = path.join(HERE, '__shots__');

function pad(png, w, h) {
  if (png.width === w && png.height === h) return png;
  const out = new PNG({ width: w, height: h });
  out.data.fill(0);
  for (let y = 0; y < png.height; y += 1) png.data.copy(out.data, y * w * 4, y * png.width * 4, (y + 1) * png.width * 4);
  return out;
}

export function comparePair(reactFile, htmlFile, diffFile) {
  const a = PNG.sync.read(fs.readFileSync(reactFile));
  const b = PNG.sync.read(fs.readFileSync(htmlFile));
  const w = Math.max(a.width, b.width);
  const h = Math.max(a.height, b.height);
  const A = pad(a, w, h);
  const B = pad(b, w, h);
  const diff = new PNG({ width: w, height: h });
  const bad = pixelmatch(A.data, B.data, diff.data, w, h, { threshold: 0.1, includeAA: false, alpha: 0.35 });
  fs.mkdirSync(path.dirname(diffFile), { recursive: true });
  fs.writeFileSync(diffFile, PNG.sync.write(diff));
  // react | html | diff, side by side, for reading a difference at a glance.
  const gap = 8;
  const sbs = new PNG({ width: w * 3 + gap * 2, height: h });
  sbs.data.fill(255);
  [A, B, diff].forEach((img, i) => {
    for (let y = 0; y < h; y += 1) img.data.copy(sbs.data, (y * sbs.width + i * (w + gap)) * 4, y * w * 4, (y + 1) * w * 4);
  });
  const sbsFile = diffFile.replace(`${path.sep}diff${path.sep}`, `${path.sep}sbs${path.sep}`);
  fs.mkdirSync(path.dirname(sbsFile), { recursive: true });
  fs.writeFileSync(sbsFile, PNG.sync.write(sbs));
  return { pixels: bad, ratio: bad / (w * h), size: { react: [a.width, a.height], html: [b.width, b.height] } };
}

export function compareAll() {
  const rows = [];
  const reactRoot = path.join(SHOTS, 'react');
  const htmlRoot = path.join(SHOTS, 'html');
  const names = new Set();
  for (const root of [reactRoot, htmlRoot]) {
    if (!fs.existsSync(root)) continue;
    for (const vp of fs.readdirSync(root)) for (const f of fs.readdirSync(path.join(root, vp))) if (f.endsWith('.png') && !f.includes('.FAILED')) names.add(`${vp}/${f}`);
  }
  for (const key of [...names].sort()) {
    const r = path.join(reactRoot, key);
    const h = path.join(htmlRoot, key);
    if (!fs.existsSync(r) || !fs.existsSync(h)) { rows.push({ key, missing: fs.existsSync(r) ? 'html' : 'react' }); continue; }
    rows.push({ key, ...comparePair(r, h, path.join(SHOTS, 'diff', key)) });
  }
  return rows;
}

export function writeReport(rows) {
  const pct = (x) => `${(x * 100).toFixed(3)}%`;
  const tr = rows.map((r) => r.missing
    ? `<tr class="bad"><td>${r.key}</td><td colspan="2">MISSING on ${r.missing}</td><td></td></tr>`
    : `<tr class="${r.pixels === 0 ? 'ok' : r.ratio < 0.001 ? 'near' : 'bad'}"><td>${r.key}</td><td>${r.pixels}</td><td>${pct(r.ratio)}</td>
       <td><a href="react/${r.key}">react</a> · <a href="html/${r.key}">html</a> · <a href="diff/${r.key}">diff</a>${r.size.react.join('x') !== r.size.html.join('x') ? ` <b>size ${r.size.react.join('x')} vs ${r.size.html.join('x')}</b>` : ''}</td></tr>`).join('\n');
  const html = `<!doctype html><meta charset="utf-8"><title>Purchase Orders parity</title>
<style>body{font:13px system-ui;margin:24px}table{border-collapse:collapse}td,th{padding:4px 10px;border-bottom:1px solid #eee;text-align:left}
.ok td:first-child{color:#047857}.near td:first-child{color:#b45309}.bad td:first-child{color:#b91c1c}</style>
<h1>Purchase Orders — React (oracle) vs HTML (prototype)</h1>
<p>${rows.filter((r) => r.pixels === 0).length} of ${rows.length} identical.</p>
<table><tr><th>state</th><th>pixels</th><th>ratio</th><th>images</th></tr>${tr}</table>`;
  fs.writeFileSync(path.join(SHOTS, 'report.html'), html);
  fs.writeFileSync(path.join(SHOTS, 'report.json'), JSON.stringify(rows, null, 1));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = compareAll();
  writeReport(rows);
  for (const r of rows) console.log(r.missing ? `MISSING ${r.missing.padEnd(5)} ${r.key}` : `${String(r.pixels).padStart(8)}  ${(r.ratio * 100).toFixed(3).padStart(7)}%  ${r.key}`);
}

#!/usr/bin/env node
/*
  node zoom.mjs <viewport/state.png> [out.png]

  Finds where a compared pair differs and writes the worst clusters side by side, magnified:
  react | html | diff, one row per cluster. The fastest way from "2,387 px differ" to "the
  third line's baseline is 1px lower". Default output: __shots__/zoom/<viewport>-<state>.png
*/
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { SHOTS } from './compare.mjs';

const key = process.argv[2];
if (!key) { console.error('usage: node zoom.mjs <viewport/state.png> [out.png]'); process.exit(2); }
const out = process.argv[3] || path.join(SHOTS, 'zoom', key.replace('/', '-'));
const read = (side) => PNG.sync.read(fs.readFileSync(path.join(SHOTS, side, key)));
const imgs = { react: read('react'), html: read('html'), diff: read('diff') };
const d = imgs.diff;

// Red/yellow diff pixels, grouped into 60×40 cells.
const cells = new Map();
for (let y = 0; y < d.height; y += 1) for (let x = 0; x < d.width; x += 1) {
  const i = (y * d.width + x) * 4;
  if (d.data[i] > 200 && d.data[i + 1] < 120 && d.data[i + 2] < 120) {
    const k = `${Math.floor(x / 60)},${Math.floor(y / 40)}`;
    const c = cells.get(k) || { x0: x, y0: y, x1: x, y1: y, n: 0 };
    c.x0 = Math.min(c.x0, x); c.y0 = Math.min(c.y0, y); c.x1 = Math.max(c.x1, x); c.y1 = Math.max(c.y1, y); c.n += 1;
    cells.set(k, c);
  }
}
const clusters = [...cells.values()].sort((a, b) => b.n - a.n);
console.log(`${clusters.reduce((s, c) => s + c.n, 0)} px differ; worst: ${clusters.slice(0, 10).map((c) => `[${c.x0},${c.y0}..${c.x1},${c.y1}]×${c.n}`).join(' ')}`);
if (!clusters.length) process.exit(0);

const S = 4; const PAD = 14;
const crops = clusters.slice(0, 4).map((c) => {
  const x = Math.max(0, c.x0 - PAD * 3); const y = Math.max(0, c.y0 - PAD);
  return { x, y, w: Math.min(d.width - x, c.x1 - c.x0 + PAD * 6), h: Math.min(d.height - y, c.y1 - c.y0 + PAD * 2) };
});
const W = Math.max(...crops.map((c) => c.w)) * S * 3 + 40;
const H = crops.reduce((s, c) => s + c.h * S + 10, 0);
const o = new PNG({ width: W, height: H });
o.data.fill(255);
let oy = 0;
for (const c of crops) {
  ['react', 'html', 'diff'].forEach((side, i) => {
    const im = imgs[side];
    for (let j = 0; j < c.h * S; j += 1) for (let q = 0; q < c.w * S; q += 1) {
      const sx = c.x + Math.floor(q / S); const sy = c.y + Math.floor(j / S);
      if (sx >= im.width || sy >= im.height) continue;
      const si = (sy * im.width + sx) * 4; const di = ((oy + j) * W + i * (c.w * S + 20) + q) * 4;
      im.data.copy(o.data, di, si, si + 4);
    }
  });
  oy += c.h * S + 10;
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, PNG.sync.write(o));
console.log(`→ ${path.relative(process.cwd(), out)}`);

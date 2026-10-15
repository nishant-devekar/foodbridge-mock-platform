/*
  The three processes a parity run needs, started and stopped together:

    oracle api      the production module's backend over the prototype's dataset, behind a copy
                    of cafex's /v3/purchase bridge, plus cafex-shaped host fixtures        :4390
    oracle screens  production's /sourcing-orders page: storefront-frontend's own source (host
                    providers, host CSS, the SourcingOrderModule glue) + the module's BUILT
                    dist, served by storefront's Vite through oracle/host/vite.config.mjs   :4391
    prototype       this folder, served statically                                          :4392

  Fixed ports, never 3000 (cafex's) or 5183 (the module sandbox's).
*/
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MOCKUP = path.resolve(HERE, '../../..');
const PARITY = path.resolve(HERE, '..');
const WORKSPACE = path.resolve(MOCKUP, '../../../..');

export const PORTS = { api: 4390, react: 4391, html: 4392 };
export const PURCHASE_MODULE = process.env.PURCHASE_MODULE || path.join(WORKSPACE, 'foodbridge-module-purchase/development');
export const STOREFRONT = process.env.STOREFRONT || path.join(WORKSPACE, 'storefront-frontend');
// Every date on both screens is counted back from this instant: Monday 28 Sep 2026, 11:00 IST.
export const NOW = Number(process.env.PARITY_NOW || Date.parse('2026-09-28T11:00:00+05:30'));
export const API = `http://127.0.0.1:${PORTS.api}`;

async function waitFor(url, ms = 90000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const status = await new Promise((resolve) => {
      const u = new URL(url);
      http.get({ host: u.hostname, port: u.port, path: u.pathname + u.search }, (res) => { res.resume(); resolve(res.statusCode); })
        .on('error', () => resolve(0));
    });
    if (status && status < 500) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`parity: ${url} did not come up`);
}

function track(child, label, log) {
  child.stdout.on('data', (b) => log(`${label} ${b}`));
  child.stderr.on('data', (b) => log(`${label} ${b}`));
  return child;
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function staticServer(root, port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

export async function startServers({ log = () => {}, gaps = [] } = {}) {
  const tsx = path.join(PURCHASE_MODULE, 'node_modules/.bin/tsx');
  const vite = path.join(STOREFRONT, 'node_modules/.bin/vite');
  const dist = path.join(PURCHASE_MODULE, 'frontend/dist/index.js');
  for (const f of [tsx, vite, dist]) if (!fs.existsSync(f)) throw new Error(`parity: ${f} missing — npm install in the module's development/ (and build it); storefront-frontend needs its node_modules`);

  const env = { ...process.env, TZ: 'Asia/Kolkata' };
  const api = track(spawn(tsx, ['oracle/oracle-api.mts'], {
    cwd: PARITY,
    env: { ...env, PURCHASE_MODULE, PARITY_NOW: String(NOW), PARITY_API_PORT: String(PORTS.api) },
  }), 'api  ', (s) => { if (s.includes('[parity-gap]')) gaps.push(s.trim()); log(s); });
  const children = [api];
  const bail = (err) => { for (const c of children) c.kill('SIGTERM'); throw err; };
  await waitFor(`${API}/__sandbox/health`).catch(bail);

  const screens = track(spawn(vite, ['--config', path.join(PARITY, 'oracle/host/vite.config.mjs')], {
    cwd: PARITY,
    env: {
      ...env,
      PARITY_STOREFRONT: STOREFRONT,
      PARITY_MODULE_DIST: path.dirname(dist),
      PARITY_API_URL: API,
      PARITY_REACT_PORT: String(PORTS.react),
    },
  }), 'vite ', log);
  children.push(screens);
  await waitFor(`http://127.0.0.1:${PORTS.react}/platform/sourcing-orders`).catch(bail);

  const html = await staticServer(MOCKUP, PORTS.html);

  return {
    reactUrl: `http://127.0.0.1:${PORTS.react}/platform/sourcing-orders`,
    htmlUrl: `http://127.0.0.1:${PORTS.html}/index.html`,
    async setup() {
      return (await (await fetch(`${API}/api/v2/multiAdmin/setup`)).json()).data;
    },
    async scenario(s) {
      const res = await fetch(`${API}/__parity/scenario`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(s) });
      if (!res.ok) throw new Error(`parity: scenario ${JSON.stringify(s)} refused: ${await res.text()}`);
    },
    async stop() {
      for (const child of [screens, api]) child.kill('SIGTERM');
      await new Promise((r) => html.close(r));
    },
  };
}

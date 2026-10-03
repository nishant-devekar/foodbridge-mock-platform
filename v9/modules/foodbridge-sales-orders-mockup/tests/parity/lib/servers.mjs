/*
  The three processes a parity run needs, started and stopped together:

    oracle api     the production module's backend over the prototype's dataset   :4291
    oracle screens the production module's BUILT frontend (its own sandbox, mock
                   mode, pointed at the oracle api)                                 :4190
    prototype      this folder, served statically                                   :4292

  The oracle screens are the module's own `frontend/sandbox` dev server, unmodified: it serves the
  shipped dist/ and proxies /v2 /v3 /v4 /api exactly like the host does. Only SANDBOX_API differs —
  it points at the oracle api instead of the module's own mock api.
*/
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MOCKUP = path.resolve(HERE, '../../..');

export const PORTS = { api: 4291, react: 4190, html: 4292 };

// Accepts several spellings of one address: Vite binds `localhost`, which is ::1 on some machines
// and 127.0.0.1 on others, and Node's fetch does not fall back from one to the other.
async function waitFor(urls, ms = 60000) {
  const list = [].concat(urls);
  const until = Date.now() + ms;
  while (Date.now() < until) {
    for (const url of list) {
      // http.get, not fetch: the oracle screens run on :4190, which the fetch spec lists as a
      // "bad port" (ManageSieve) — undici refuses it outright. Chromium does too; see run.mjs.
      const status = await new Promise((resolve) => {
        const u = new URL(url);
        http.get({ host: u.hostname.replace(/^\[|\]$/g, ''), port: u.port, path: u.pathname }, (res) => { res.resume(); resolve(res.statusCode); })
          .on('error', () => resolve(0));
      });
      if (status && status < 500) return url;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`parity: ${list.join(' / ')} did not come up`);
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

/**
 * @param {object} opts
 * @param {string} opts.reactSalesOrders  path to foodbridge-module-route-delivery/development/sales-orders
 * @param {number} opts.now               the instant every date in the dataset is counted back from
 */
export async function startServers({ reactSalesOrders, now, log = () => {} }) {
  const SO = reactSalesOrders;
  const tsx = path.join(SO, 'node_modules/.bin/tsx');
  const vite = path.join(SO, 'node_modules/.bin/vite');
  for (const bin of [tsx, vite]) if (!fs.existsSync(bin)) throw new Error(`parity: ${bin} missing — run npm install in ${SO}`);
  if (!fs.existsSync(path.join(SO, 'frontend/dist/index.js'))) throw new Error(`parity: ${SO}/frontend/dist is not built`);

  const env = { ...process.env, TZ: 'Asia/Kolkata' };
  const api = track(spawn(tsx, ['oracle/oracle-api.mts'], {
    cwd: path.join(MOCKUP, 'tests/parity'),
    env: { ...env, REACT_SALES_ORDERS: SO, PARITY_NOW: String(now), PARITY_API_PORT: String(PORTS.api) },
  }), 'api  ', log);
  const children = [api];
  const bail = (err) => { for (const c of children) c.kill('SIGTERM'); throw err; };
  await waitFor(`http://127.0.0.1:${PORTS.api}/__sandbox/health`).catch(bail);

  const screens = track(spawn(vite, ['--config', 'sandbox/vite.config.js'], {
    cwd: path.join(SO, 'frontend'),
    env: { ...env, SANDBOX_MODE: 'mock', SANDBOX_API: `http://127.0.0.1:${PORTS.api}` },
  }), 'vite ', log);
  children.push(screens);
  await waitFor([`http://127.0.0.1:${PORTS.react}/`, `http://[::1]:${PORTS.react}/`]).catch(bail);

  const html = await staticServer(MOCKUP, PORTS.html);
  const setup = await (await fetch(`http://127.0.0.1:${PORTS.api}/v2/multiAdmin/setup`)).json();

  return {
    reactUrl: `http://localhost:${PORTS.react}/`,
    setup: setup.data,
    htmlUrl: `http://127.0.0.1:${PORTS.html}/index.html`,
    async scenario(s) {
      await fetch(`http://127.0.0.1:${PORTS.api}/__parity/scenario`, { // :4291 is not a bad port
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(s),
      });
    },
    async stop() {
      for (const child of [screens, api]) child.kill('SIGTERM');
      await new Promise((r) => html.close(r));
    },
  };
}

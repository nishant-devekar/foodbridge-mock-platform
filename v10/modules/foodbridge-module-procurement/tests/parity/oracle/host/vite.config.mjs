/*
  The ORACLE's screens: production's Purchase Orders exactly as storefront-frontend renders it.

  Rooted at the storefront-frontend checkout and serving ITS OWN parity page
  (parity/sourcing-orders/main.jsx, ?mode=module): the host's provider stack, its real CSS
  (tailwind.css + custom.css + the windmill theme), its real glue page
  (src/pages/SourcingOrderModule.jsx) with every host capability and host component it wires,
  and the module's BUILT bundle (foodbridge-module-purchase/development/frontend/dist).

  This config is the only thing that differs from the host's own dev server, and it only says
  WHERE things are: the module package resolves to the sibling checkout's dist (storefront's
  node_modules has no copy), Tailwind scans that dist like the host's own content glob does,
  and /v2 /v3 /v4 /api go to the oracle api. No production file is written — Vite's cache lives
  here, not in the storefront checkout.
*/
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SF = process.env.PARITY_STOREFRONT;
const MODULE_DIST = process.env.PARITY_MODULE_DIST;
const API = process.env.PARITY_API_URL;
const PORT = Number(process.env.PARITY_REACT_PORT);
const req = createRequire(path.join(SF, 'package.json'));
const react = (await import(pathToFileURL(req.resolve('@vitejs/plugin-react')).href)).default;
const tailwind = req('tailwindcss');
const autoprefixer = req('autoprefixer');
// Loaded the way Tailwind itself loads it (jiti): the host config mixes ESM with require().
const sfTailwind = req('tailwindcss/loadConfig')(path.join(SF, 'tailwind.config.js'));

// The host's content glob, made absolute, plus the module dist where the host's own
// node_modules glob would find it after `npm install`.
const content = [
  ...sfTailwind.content.map((g) => (g.startsWith('./') ? path.join(SF, g) : g)),
  path.join(MODULE_DIST, '**/*.js'),
];

/*
  Other modules the host's shared components reach (the thermal-print templates import
  route-delivery's formatting, for one). storefront's node_modules predates those installs, so
  each resolves to its sibling checkout through that package's OWN `exports` table — the same file
  a git-tag install would put in node_modules. Only what the Purchase Orders page actually
  imports is ever resolved.
*/
const SIBLINGS = {
  '@modules/foodbridge-module-route-delivery-frontend': process.env.ROUTE_DELIVERY || path.resolve(SF, '../foodbridge-module-route-delivery'),
};
const siblingModules = {
  name: 'parity-sibling-modules',
  enforce: 'pre',
  resolveId(id) {
    for (const [name, dir] of Object.entries(SIBLINGS)) {
      if (id !== name && !id.startsWith(`${name}/`)) continue;
      const sub = `.${id.slice(name.length)}` || '.';
      const pkg = req(path.join(dir, 'package.json'));
      const entry = pkg.exports?.[sub === '.' ? '.' : sub];
      const file = typeof entry === 'string' ? entry : entry?.import ?? entry?.default;
      if (!file) throw new Error(`parity: ${id} is not exported by ${dir}/package.json`);
      return path.join(dir, file);
    }
    return null;
  },
};

/*
  The page itself, at the path production serves it (/platform/sourcing-orders). Its <html>,
  <meta> and <body> are storefront-frontend/index.html's; the script is entry.jsx beside this file.
*/
const PAGE = `<!DOCTYPE html>
<html lang="en"  class="light">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
    <meta name="color-scheme" content="light only" />
    <title>FoodBridge - Supply Chain Platform</title>
  </head>
  <body class="antialiased">
    <div id="root"></div>
    <script type="module" src="/@fs${path.join(HERE, 'entry.jsx')}"></script>
  </body>
</html>`;
const oraclePage = {
  name: 'parity-oracle-page',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, 'http://x');
      if (!url.pathname.startsWith('/platform/')) return next();
      const html = await server.transformIndexHtml(url.pathname, PAGE);
      res.setHeader('content-type', 'text/html');
      res.setHeader('cache-control', 'no-store');
      res.end(html);
    });
  },
};

// entry.jsx lives here, not in the storefront checkout, so its bare imports (react-redux, …) are
// resolved as if written in storefront's own src/main.jsx — the file it stands in for.
const ENTRY = path.join(HERE, 'entry.jsx');
const entryResolvesAsHost = {
  name: 'parity-entry-resolves-as-host',
  enforce: 'pre',
  async resolveId(id, importer, options) {
    if (!importer || !importer.startsWith(ENTRY) || id.startsWith('.') || id.startsWith('/') || id.startsWith('@/')) return null;
    return this.resolve(id, path.join(SF, 'src/main.jsx'), { ...options, skipSelf: true });
  },
};

const proxy =Object.fromEntries(['/v2', '/v3', '/v4', '/api'].map((p) => [p, { target: API, changeOrigin: false }]));

export default {
  root: SF,
  configFile: false,
  envDir: HERE,
  cacheDir: path.join(HERE, '../../.vite-oracle'),
  logLevel: 'warn',
  clearScreen: false,
  plugins: [oraclePage, entryResolvesAsHost, siblingModules, react()],
  css: { postcss: { plugins: [tailwind({ ...sfTailwind, content }), autoprefixer()] } },
  define: {
    // storefront's vite.config defines these two; its .env files are NOT read (they hold keys).
    'process.env': {},
    __APP_VERSION__: JSON.stringify('parity'),
  },
  resolve: {
    alias: [
      { find: /^@modules\/foodbridge-module-purchase$/, replacement: path.join(MODULE_DIST, 'index.js') },
      { find: /^@\//, replacement: path.join(SF, 'src') + '/' },
    ],
    // The module bundle leaves these external; the host provides the one copy of each.
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react-router-dom', '@windmill/react-ui'],
  },
  // Crawl the parity page only — the host app's other routes import modules not installed here.
  optimizeDeps: { entries: [path.join(HERE, 'entry.jsx')], include: ['immutable'] },
  server: {
    host: '127.0.0.1',
    port: PORT,
    strictPort: true,
    proxy,
    fs: { allow: [SF, path.dirname(MODULE_DIST), HERE, ...Object.values(SIBLINGS)] },
    hmr: false,
  },
};

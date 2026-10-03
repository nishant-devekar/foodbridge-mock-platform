/*
  Boot: load the tenant and the dataset, resolve the dataset against "now", build the product
  model, and mount the screen — bare (?chrome=none, the production module as it renders
  standalone) or inside the QA store's sidebar and header (the default, for the mock platform).
*/
import { resolveDataset } from './data/resolve.js';
import { loadStore, vasuDataset, wireToStore } from './data/vasu.js';
import { createModel } from './sales-orders/model.js';
import { mountSalesOrders } from './sales-orders/screen.js';

const params = new URLSearchParams(location.search);
const chrome = params.get('chrome') || 'full';
const scenario = params.get('scenario');

/** Plain-object deep merge: `over` wins; arrays and scalars replace. */
export function mergeDeep(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = v && typeof v === 'object' && !Array.isArray(v) && base?.[k] && typeof base[k] === 'object' ? mergeDeep(base[k], v) : v;
  return out;
}

async function json(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function boot() {
  const [base, fixture, variants] = await Promise.all([json('js/data/tenant.json'), json('js/data/dataset.json'), json('js/data/tenant-variants.json')]);
  // Vasu Foods: the business's one record (js/data/vasu.js); ?data=fixture keeps the invented dataset.
  const P = params.get('data') === 'fixture' ? null : await loadStore().catch(() => null);
  // ?tenant=<variant> — a tenant configuration other than the production default (tenant-variants.json).
  const variant = params.get('tenant');
  if (variant && !variants[variant]) throw new Error(`Unknown tenant variant "${variant}"`);
  const tenant = variant ? mergeDeep(base, variants[variant]) : base;
  const now = Date.now();
  const dataset = P ? vasuDataset(P, now) : fixture;
  if (P) tenant.username = P.business().owner;
  const model = createModel(tenant, resolveDataset(dataset, now));

  const app = document.getElementById('app');
  let host = app;
  if (chrome === 'none') {
    // The bare screen, as the module renders on its own. It still sits in the host's main area,
    // whose one inline style — 1rem of bottom padding — survives even standalone.
    app.innerHTML = '<div style="padding-bottom: 1rem;"></div>';
    host = app.firstElementChild;
  } else {
    // The QA store shell (sidebar + header), shared with the other module mockups.
    const shell = await json('seed-data/seed.json');
    if (P) {
      const biz = P.business();
      shell.store = { ...(shell.store || {}), name: biz.name, storeName: biz.name };
      shell.user = { ...(shell.user || {}), name: biz.owner, displayName: biz.owner, role: biz.role };
    }
    host = window.MockShell.renderShell(app, { store: shell.store, user: shell.user, storefrontMenus: shell.storefrontMenus }, {
      activePath: '/orders',
      pageTitle: model.label,
      // /orders renders its own phone title inside its controls, so the shell does not.
      pageOwnedMobileHeader: true,
    });
  }
  window.salesOrders = mountSalesOrders(host, model, { scenario, now: () => Date.now() });
  if (P) wireToStore(model, P, (type, message) => window.salesOrders?.toast?.(type, message));
}

boot().catch((err) => {
  document.body.innerHTML = `<pre style="font:13px ui-monospace,monospace;padding:24px;color:#b91c1c;white-space:pre-wrap">Sales Orders could not start.\n\n${String(err?.stack || err)}\n\nServe this folder over HTTP (python3 -m http.server) — the data is fetched.</pre>`;
  throw err;
});

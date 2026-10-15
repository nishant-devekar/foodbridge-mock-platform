/*
  Boot: load the tenant and the dataset, start the in-page server on "now", and mount the screen —
  in the host's bare page frame (?chrome=none, what the parity harness compares) or inside the QA
  store's sidebar and header (the default, for the mock platform).
*/
import { loadStore, vasuDataset, forecastFromStore, wireToStore } from './data/vasu.js';
import { createHost } from './host/host.js';
import { createServer } from './purchase-orders/server.js';
import { mountPurchaseOrders } from './purchase-orders/screen.js';
import { mountFlows } from './purchase-orders/flows.js';
import { createToaster } from './components/toast.js';

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

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = new URL(src, location.href).href;
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function json(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

/** Production loads these library/screen stylesheets after Tailwind's output; Play CDN appends its <style> last. */
function keepCascadeOrder() {
  const move = () => { for (const l of document.querySelectorAll('link[data-after-tailwind]')) document.head.appendChild(l); };
  move();
  new MutationObserver((records) => {
    if (records.some((r) => [...r.addedNodes].some((n) => n.tagName === 'STYLE'))) move();
  }).observe(document.head, { childList: true });
}

/**
 * The host's two application-wide input behaviours (main.jsx installs them once, by delegation):
 * an editable field selects its text when it gains focus (utils/selectEditableFieldOnFocus), and a
 * focused number input lets go of focus on wheel instead of changing (utils/blurNumberInputOnWheel).
 */
function installHostInputBehaviours() {
  const SELECTABLE = new Set(['email', 'number', 'password', 'search', 'tel', 'text', 'url']);
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
    if (el.disabled || el.readOnly || el.dataset.selectOnFocus === 'false') return;
    if (el instanceof HTMLTextAreaElement || SELECTABLE.has(el.type)) { try { el.select(); } catch { /* not selectable */ } }
  });
  document.addEventListener('wheel', (e) => {
    const el = e.target;
    if (el instanceof HTMLInputElement && el.type === 'number' && el.dataset.blurOnWheel !== 'false') el.blur();
  });
}

/**
 * v7 only: inside the platform, the shell covers this page's dead hamburger with a white mask. Over
 * an open drawer, modal or loader that mask would paint over the overlay's title, so say when one is
 * open (the platform's `overlay` message) and the shell stands the mask down. Only what renders
 * counts: the Tailwind-order element and the QA shell's mobile backdrop match but are not shown,
 * and the row menu's invisible click-catcher is not an overlay.
 */
function tellPlatformAboutOverlays() {
  if (window.parent === window) return;
  const OVERLAYS = '.drawer-open, .fixed.inset-0:not([data-act="menu-close"]), [data-lot-stickers]';
  let sent = null;
  const tell = () => {
    const on = [...document.querySelectorAll(OVERLAYS)].some((el) => el.getClientRects().length > 0);
    if (on === sent) return;
    sent = on;
    try { window.parent.postMessage({ source: 'fb-module', type: 'overlay', active: on }, '*'); } catch { /* no parent */ }
  };
  new MutationObserver(tell).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  tell();
}

async function boot() {
  installHostInputBehaviours();
  tellPlatformAboutOverlays();
  const [base, fixture, variants] = await Promise.all([json('js/data/tenant.json'), json('js/data/dataset.json'), json('js/data/tenant-variants.json')]);
  const variant = params.get('tenant');
  if (variant && !variants[variant]) throw new Error(`Unknown tenant variant "${variant}"`);
  const tenant = variant ? mergeDeep(base, variants[variant]) : base;
  const host = createHost(tenant);
  // Vasu Foods: the business's one record (js/data/vasu.js); ?data=fixture keeps the invented dataset.
  const P = params.get('data') === 'fixture' ? null : await loadStore().catch(() => null);
  const now = Date.now();
  const vasu = P ? vasuDataset(P, now) : null;
  const server = createServer(vasu ? vasu.dataset : fixture, { now, scenario, tenant, clock: vasu ? () => Date.now() : undefined });
  if (vasu) {
    // Delivered is goods in: the lots it made get their stickers (the shared sheet, v7/assets/lot-stickers.js).
    host.showLotStickers = (lots) => (window.FBLotStickers ? Promise.resolve() : loadScript('../../assets/lot-stickers.js?v=20260929PO21')).then(() => window.FBLotStickers?.open(lots)).catch(() => {});
    wireToStore(server, P, vasu.maps, host);
    server.forecastRecommendations = () => Promise.resolve(forecastFromStore(P).finished);
    server.rawMaterialForecastRecommendations = () => Promise.resolve(forecastFromStore(P).raw);
  }

  const root = document.getElementById('root');
  let outlet;
  if (chrome === 'none') {
    document.querySelector('link[data-shell-only]')?.remove();
    // Layout.jsx's frame + Main.jsx, without the Sidebar and Header.
    root.innerHTML = '<div class="Toastify" data-po-toasts></div><div class="flex h-[100dvh] bg-gray-50 overflow-x-hidden md:h-screen"><div class="flex flex-col flex-1 w-full min-h-0 overflow-hidden"><main class="flex-1 overflow-y-auto overflow-x-hidden min-h-0"><div class="w-full mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4" style="padding-bottom: 1rem;"><div data-parity-screen></div></div></main></div></div>';
    outlet = root.querySelector('[data-parity-screen]');
  } else {
    const shell = await json('js/data/shell.json');
    if (vasu) {
      shell.store = { ...(shell.store || {}), name: vasu.business.name };
      shell.user = { ...(shell.user || {}), name: vasu.business.owner, displayName: vasu.business.owner, role: vasu.business.role };
    }
    outlet = window.MockShell.renderShell(root, shell, { activePath: '/sourcing-orders', pageTitle: host.menuLabel('sourcing-orders') });
    root.insertAdjacentHTML('afterbegin', '<div class="Toastify" data-po-toasts></div>');
  }
  keepCascadeOrder();

  // The host's notify capability (SourcingOrderModule glue): notifyError / notifySuccess toasts.
  const toaster = createToaster(root.querySelector('[data-po-toasts]'));
  host.notify = (kind, message) => (kind === 'error' ? toaster.error(message) : toaster.success(message));

  const ctx = { outlet, root };
  const screen = mountPurchaseOrders(host, server, ctx);
  mountFlows(host, server, screen, ctx);
  window.purchaseOrders = { ...screen, host, server };
}

boot().catch((err) => {
  document.body.innerHTML = `<pre style="font:13px ui-monospace,monospace;padding:24px;color:#b91c1c;white-space:pre-wrap">Purchase Orders could not start.\n\n${String(err?.stack || err)}\n\nServe this folder over HTTP (python3 -m http.server) — the data is fetched.</pre>`;
  throw err;
});

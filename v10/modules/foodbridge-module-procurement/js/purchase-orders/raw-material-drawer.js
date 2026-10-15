/*
  The Raw Material Calculator: the HOST's RawMaterialReportDrawer (storefront-frontend
  components/drawer/RawMaterialReportDrawer.jsx + RawMaterialReportView.jsx), which the list opens
  in a MainDrawer when the tenant maps products to raw materials (appProp.productRawMaterialMapping).

    By Products   every product of the location's catalogue tree, each with a quantity box
    By Orders     every sales order at the location (paged in 100s), filtered by customer-type
                  catalogue, a date range and a search; Select All
    Generate      asks for a report name (the host's FormModal, portalled to <body>), then shows the
                  report: the tenant mapping expanded to leaf raw materials, per finished product
                  and consolidated, against each raw material's stock

  Reproduced as the host renders it, quirks included (the flattening that lists an empty
  subcategory as a product; react-select option lists rebuilt on every render, so the focused
  option falls back to the first).
*/
import { esc, morphOuter } from '../components/dom.js';
import { lucide } from '../components/icons.js';
import { createMainDrawer } from '../components/drawer.js';
import { buttonClass, inputClass } from '../components/windmill.js';
import { ARIA, nextSelectId } from '../components/react-select.js';
import { createMaterialsPoModal } from './materials-po-modal.js';

const T = '<!---->';
const SPINNER = 'assets/img/spinner.gif';
const ARROW = '<svg height="20" width="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false" class="css-tj5bde-Svg"><path d="M4.516 7.548c0.436-0.446 1.043-0.481 1.576 0l3.908 3.747 3.908-3.747c0.533-0.481 1.141-0.446 1.574 0 0.436 0.445 0.408 1.197 0 1.615-0.406 0.418-4.695 4.502-4.695 4.502-0.217 0.223-0.502 0.335-0.787 0.335s-0.57-0.112-0.789-0.335c0 0-4.287-4.084-4.695-4.502s-0.436-1.17 0-1.615z"></path></svg>';
const CROSS = '<svg height="20" width="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false" class="css-tj5bde-Svg"><path d="M14.348 14.849c-0.469 0.469-1.229 0.469-1.697 0l-2.651-3.030-2.651 3.029c-0.469 0.469-1.229 0.469-1.697 0-0.469-0.469-0.469-1.229 0-1.697l2.758-3.15-2.759-3.152c-0.469-0.469-0.469-1.228 0-1.697s1.228-0.469 1.697 0l2.652 3.031 2.651-3.031c0.469-0.469 1.228-0.469 1.697 0s0.469 1.229 0 1.697l-2.758 3.152 2.758 3.15c0.469 0.469 0.469 1.229 0 1.698z"></path></svg>';
const REMOVE14 = CROSS.replace('height="20" width="20"', 'height="14" width="14"');
const DATE_OPTIONS = [
  { value: '', label: 'All Dates' }, { value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisWeek', label: 'This Week' }, { value: 'lastWeek', label: 'Last Week' }, { value: 'thisMonth', label: 'This Month' },
];
const DATE_LABEL = { today: 'Today', yesterday: 'Yesterday', thisWeek: 'This Week', lastWeek: 'Last Week', thisMonth: 'This Month' };
// Emotion classes of the two selects (their `styles` props), as production renders them.
const RS = {
  catalogue: { control: 'css-1w7mw2c-control', value: 'css-4zpvg5', valueFilled: 'css-1b9ma2b' },
  date: { control: 'css-uidxsr-control', value: 'css-hlgwow', valueFilled: 'css-hlgwow' },
};
const indicator = (focused) => (focused ? 'css-15lsz6c-indicatorContainer' : 'css-1xc3v61-indicatorContainer');
const optionClass = (focused, selected) => (selected ? 'css-tr4s17-option' : focused ? 'css-d7l1ni-option' : 'css-10wo9uf-option');

// ── RawMaterialReportView's maths ──────────────────────────────────────────────────────────────

/** "p1:p2:p3" → "batch:q2:q3": each raw material per ONE unit of the finished product. */
function parseMappingConfig(mapping) {
  const map = new Map();
  if (!mapping || typeof mapping !== 'object') return map;
  for (const [keyStr, valueStr] of Object.entries(mapping)) {
    const ids = keyStr.split(':').map((s) => s.trim());
    const qtys = String(valueStr).split(':').map((s) => parseFloat(s.trim()) || 0);
    const finishedProductId = ids[0];
    const perBatch = qtys[0] || 1;
    const raw = [];
    for (let i = 1; i < ids.length; i++) if (ids[i]) raw.push({ rawMaterialId: ids[i], quantityPerUnit: (qtys[i] ?? 0) / perBatch });
    if (finishedProductId && raw.length > 0) map.set(finishedProductId, raw);
  }
  return map;
}

/** A product expanded, recursively, into its leaf raw materials (a cycle counts as a leaf). */
function expandToLeafMaterials(productId, quantity, mappingMap, visited = new Set()) {
  const result = new Map();
  if (visited.has(productId)) { result.set(productId, (result.get(productId) || 0) + quantity); return result; }
  const raw = mappingMap.get(productId);
  if (!raw || raw.length === 0) { result.set(productId, quantity); return result; }
  const next = new Set(visited); next.add(productId);
  for (const { rawMaterialId, quantityPerUnit } of raw) {
    expandToLeafMaterials(rawMaterialId, quantityPerUnit * quantity, mappingMap, next).forEach((q, id) => result.set(id, (result.get(id) || 0) + q));
  }
  return result;
}

/** The drawer's product-tree flattening: data.products → level 1 → level 2 → leaves. */
function flattenTree(res) {
  const flat = [];
  const seen = new Set();
  const add = (p) => {
    if (!p) return;
    const id = p._id || p.id;
    if (!id || seen.has(id)) return;
    // A category node is skipped only when it HAS children — so an empty subcategory passes as a product.
    if (Array.isArray(p.categories) && p.categories.length > 0) return;
    seen.add(id); flat.push(p);
  };
  const top = res?.data?.products || res?.products || res?.data || [];
  (Array.isArray(top) ? top : []).forEach((l1) => {
    add(l1);
    (l1?.categories || []).forEach((l2) => { add(l2); (l2?.categories || []).forEach((leaf) => add(leaf)); });
    (l1?.products || []).forEach((p) => add(p));
  });
  return flat;
}

export function createRawMaterialDrawer(host, server, { onClosed } = {}) {
  const drawer = createMainDrawer({ onClose: () => close() });
  // The report view's "Create Raw Material Requests" (it lives and dies with the view).
  const po = createMaterialsPoModal(host, server, { rerender: () => render() });
  let st = null;
  let modalRoot = null;
  let printStyle = null;
  let useIdCount = 0;

  const rsState = () => ({ id: nextSelectId(), focused: false, open: false, input: '', focus: 0, hidden: false, selection: '', initial: false });

  function open() {
    st = {
      orders: [], loadingOrders: true, selectedOrderIds: [], searchText: '', showPreview: false, loadingFullOrders: false, fullOrdersData: [],
      catalogues: [], selectedCatalogues: [], selectedDateFilter: '', showReportNameModal: false, reportName: '',
      allProducts: [], allRawMaterials: [], loadingProducts: true, reportMode: 'products', productQuantities: {}, productSearchText: '',
      cat: null, date: null, titleId: `:r${(useIdCount++).toString(32)}:`,
    };
    render(true);
    loadOrders(); loadCatalogues(); loadProducts();
  }
  function close() {
    if (!st) return;
    st = null;
    po.close();
    closeModal();
    printStyle?.remove(); printStyle = null;
    drawer.destroy();
    onClosed?.();
  }
  const isOpen = () => Boolean(st);

  async function loadOrders() {
    const mine = st;
    try {
      let all = []; let page = 1; let more = true;
      while (more) {
        const res = await server.listSalesOrders({ searchTerm: '', status: '', day: '', method: '', startDate: '', endDate: '', page, limit: 100 });
        if (res?.orders?.length > 0) { all = [...all, ...res.orders]; more = res.orders.length >= 100; page++; } else more = false;
      }
      if (st !== mine) return;
      st.orders = [...all].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch {
      if (st !== mine) return;
      host.notify('error', 'Failed to load orders'); st.orders = [];
    } finally { if (st === mine) { st.loadingOrders = false; render(); } }
  }
  async function loadCatalogues() {
    const mine = st;
    try { const res = await server.getCustomerCatalogues(); if (st === mine) { st.catalogues = res?.data || []; render(); } } catch { host.notify('error', 'Failed to load catalogues'); }
  }
  async function loadProducts() {
    const mine = st;
    try {
      const res = await server.getCategoryProductTree();
      if (st !== mine) return;
      st.allProducts = flattenTree(res);
      try { const rm = await server.getCategoryProductTree({ catalogueType: 'RAW-MATERIAL' }); if (st === mine) st.allRawMaterials = flattenTree(rm); } catch { /* non-critical */ }
    } catch { if (st === mine) host.notify('error', 'Failed to load product list'); } finally { if (st === mine) { st.loadingProducts = false; render(); } }
  }

  // ── Derived ──
  function filteredOrders() {
    if (!st.orders.length) return [];
    let list = [...st.orders];
    if (st.selectedCatalogues.length > 0) {
      const phones = new Set();
      st.catalogues.filter((c) => st.selectedCatalogues.includes(c.catalogue?._id)).forEach((c) => (c.organizations || []).forEach((org) => { if (org?.phone) phones.add(String(org.phone)); }));
      list = list.filter((o) => phones.has(String(o.user_info?.contact || o.user_info?.phone || '')));
    }
    if (st.selectedDateFilter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      const dow = today.getDay(); const diff = dow === 0 ? 6 : dow - 1;
      const thisWeekStart = new Date(today); thisWeekStart.setDate(today.getDate() - diff);
      const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(thisWeekStart); lastWeekEnd.setDate(lastWeekEnd.getDate() - 1); lastWeekEnd.setHours(23, 59, 59, 999);
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      list = list.filter((o) => {
        const d = new Date(o.createdAt || o.updatedAt);
        switch (st.selectedDateFilter) {
          case 'today': return d >= today;
          case 'yesterday': { const yEnd = new Date(yesterday); yEnd.setHours(23, 59, 59, 999); return d >= yesterday && d <= yEnd; }
          case 'thisWeek': return d >= thisWeekStart;
          case 'lastWeek': return d >= lastWeekStart && d <= lastWeekEnd;
          case 'thisMonth': return d >= thisMonthStart;
          default: return true;
        }
      });
    }
    const q = st.searchText.toLowerCase().trim();
    if (q) {
      list = list.filter((o) => String(o.order_number || o.invoice || '').toLowerCase().includes(q)
        || String(o.user_info?.name || '').toLowerCase().includes(q)
        || String(o.user_info?.contact || o.user_info?.phone || '').toLowerCase().includes(q));
    }
    return list;
  }
  function filteredProducts() {
    const q = st.productSearchText.toLowerCase().trim();
    if (!q) return st.allProducts;
    return st.allProducts.filter((p) => (p.name || p.title || '').toLowerCase().includes(q) || (p.articleNumber || p.article_number || '').toLowerCase().includes(q));
  }
  const selectedProductCount = () => Object.values(st.productQuantities).filter((v) => parseFloat(v) > 0).length;
  const plural = (n) => (n !== 1 ? 's' : '');

  // ── react-select look-alikes: the catalogue filter (multi) and the date filter (single) ──
  const catalogueOptions = () => st.catalogues.filter((c) => (c.products?.length || 0) > 0).map((c) => ({ value: c.catalogue?._id, label: c.catalogue?.name || 'Unnamed' }));
  const catalogueValue = () => st.selectedCatalogues.map((id) => {
    const found = st.catalogues.find((c) => c.catalogue?._id === id);
    return found ? { value: id, label: found.catalogue?.name || 'Unnamed' } : { value: id, label: 'Selected' };
  });
  const dateValue = () => (st.selectedDateFilter ? [{ value: st.selectedDateFilter, label: DATE_LABEL[st.selectedDateFilter] || 'All Dates' }] : []);
  const cfg = (which) => (which === 'cat'
    ? { rs: st.cat, multi: true, options: catalogueOptions(), value: catalogueValue(), placeholder: 'All Catalogues', c: RS.catalogue }
    : { rs: st.date, multi: false, options: DATE_OPTIONS, value: dateValue(), placeholder: 'All Dates', c: RS.date });
  /** react-select's default filter: case- and accent-insensitive, over "label value". */
  const shown = (k) => {
    const needle = k.rs.input.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!needle) return k.options;
    return k.options.filter((o) => `${o.label} ${o.value}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(needle));
  };

  function selectMarkup(which) {
    const k = cfg(which);
    const { rs } = k;
    const opts = shown(k);
    const isSel = (o) => k.value.some((v) => v.value === o.value);
    let live = '';
    if (rs.focused) {
      const f = rs.open ? opts[rs.focus] : null;
      live = `<span id="aria-selection">${esc(rs.selection)}</span>`
        + `<span id="aria-focused">${f ? esc(ARIA.focused(f.label, rs.focus, opts.length)) : ''}</span>`
        + `<span id="aria-results">${rs.open ? esc(`${opts.length} result${plural(opts.length)} available${rs.input ? ` for search term ${rs.input}` : ''}.`) : ''}</span>`
        + `<span id="aria-guidance">${rs.open ? esc(ARIA.guidanceMenu) : ''}</span>`;
    }
    const filled = k.value.length > 0;
    const values = !filled ? (rs.input ? '' : `<div class="css-14y260g-placeholder" id="react-select-${rs.id}-placeholder" data-key="ph">${esc(k.placeholder)}</div>`)
      : k.multi ? k.value.map((v) => `<div class="css-12cpy4o-multiValue" data-key="mv:${esc(v.value)}"><div class="css-q9cg70">${esc(v.label)}</div><div role="button" class="css-v7duua" aria-label="Remove ${esc(v.label)}" data-rc-remove="${esc(v.value)}" data-rc-sel="${which}">${REMOVE14}</div></div>`).join('')
        : (rs.input ? '' : `<div class="css-1dimb5e-singleValue" data-key="sv">${esc(k.value[0].label)}</div>`);
    const opacity = !k.multi && filled && rs.hidden && !rs.input ? 0 : 1;
    return `<div class="text-sm css-b62m3t-container" data-rc-rs="${which}"><span id="react-select-${rs.id}-live-region" class="css-1f43avz-a11yText-A11yText"></span><span aria-live="polite" aria-atomic="false" aria-relevant="additions text" role="log" class="css-1f43avz-a11yText-A11yText">${live}</span>`
      + `<div class="${k.c.control}" data-rc-control="${which}"><div class="${filled ? k.c.valueFilled : k.c.value}">${values}`
      + `<div class="${rs.input ? 'css-1cfo1cf' : 'css-19bb58m'}" data-value="${esc(rs.input)}" data-key="in"><input class="" autocapitalize="none" autocomplete="off" autocorrect="off" id="react-select-${rs.id}-input" spellcheck="false" tabindex="0" type="text" aria-autocomplete="list" aria-expanded="${rs.open}" aria-haspopup="true" role="combobox"${filled ? '' : ` aria-describedby="react-select-${rs.id}-placeholder"`} value="${esc(rs.input)}" style="color: inherit; background: 0px center; opacity: ${opacity}; width: 100%; grid-area: 1 / 2; font: inherit; min-width: 2px; border: 0px; margin: 0px; outline: 0px; padding: 0px;"${rs.open ? ` aria-controls="react-select-${rs.id}-listbox"` : ''} data-rc-input="${which}"></div></div>`
      + '<div class="css-1wy0on6">'
      + (filled ? `<div class="${indicator(rs.focused)}" aria-hidden="true" data-rc-clear="${which}">${CROSS}</div>` : '')
      + `<span class="css-1u9des2-indicatorSeparator"></span><div class="${indicator(rs.focused)}" aria-hidden="true" data-rc-toggle="${which}">${ARROW}</div></div></div>`
      + (rs.open ? `<div class="css-18j1mm5-menu" data-rc-menu="${which}"><div class="css-qr46ko" role="listbox" aria-multiselectable="${k.multi}" id="react-select-${rs.id}-listbox">`
        + (opts.length ? opts.map((o, i) => `<div class="${optionClass(i === rs.focus, isSel(o))}" aria-disabled="false" id="react-select-${rs.id}-option-${k.options.indexOf(o)}" tabindex="-1" role="option" data-rc-option="${i}" data-rc-sel="${which}">${esc(o.label)}</div>`).join('')
          : '<div class="css-9x5mqu">No options</div>')
        + '</div></div>' : '')
      + '</div>';
  }

  function applyValue(which, next, message) {
    const k = cfg(which);
    if (which === 'cat') st.selectedCatalogues = next.map((o) => o.value);
    else st.selectedDateFilter = next[0]?.value || '';
    k.rs.selection = message;
    // The option list is rebuilt on every render, so react-select cannot find its focused option
    // again: focus falls back to the first.
    k.rs.focus = 0;
  }
  function selectOption(which, o) {
    const k = cfg(which);
    const selected = k.value.some((v) => v.value === o.value);
    k.rs.input = '';
    if (k.multi) {
      if (selected) applyValue(which, k.value.filter((v) => v.value !== o.value), `option ${o.label}, deselected.`);
      else applyValue(which, [...k.value, o], ARIA.selected(o.label));
    } else {
      applyValue(which, o.value ? [o] : [], ARIA.selected(o.label));
      k.rs.open = false; k.rs.hidden = true;
    }
  }
  function focusSelect(which) { document.getElementById(`react-select-${cfg(which).rs.id}-input`)?.focus(); }

  // ── Markup ──
  function header() {
    const n = selectedProductCount();
    const sub = st.showPreview
      ? (st.reportMode === 'products' ? `Report for ${n} product${plural(n)}` : `Report for ${st.selectedOrderIds.length} order${st.selectedOrderIds.length > 1 ? 's' : ''}`)
      : (st.reportMode === 'orders' ? 'Select orders to generate raw material requirement report' : 'Select products and specify quantities for raw material report');
    return `<div class="flex items-center justify-between p-6 border-b border-gray-200 bg-white"><div class="flex items-center gap-3"><div class="p-2 bg-blue-50 rounded-lg">${lucide('FlaskConical', { cls: 'w-6 h-6 text-blue-600' })}</div>`
      + `<div><h2 class="text-xl font-semibold text-gray-800">${st.showPreview ? 'Raw Material Requirement Report' : 'Raw Material Requirement Calculator'}</h2><p class="text-sm text-gray-500">${esc(sub)}</p></div></div>`
      + `<button class="p-2 hover:bg-gray-100 rounded-lg transition-colors" data-rc="close">${lucide('X', { cls: 'w-5 h-5 text-gray-500' })}</button></div>`;
  }
  function tabs() {
    const n = selectedProductCount();
    const tab = (mode, icon, label, count) => `<button class="flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-all ${st.reportMode === mode ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-rc="mode" data-mode="${mode}">${lucide(icon, { cls: 'w-4 h-4' })}${label}`
      + (count > 0 ? `<span class="ml-1.5 px-1.5 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full">${count}</span>` : '') + '</button>';
    return `<div class="flex border-b border-gray-200 bg-white px-4 shrink-0">${tab('products', 'Package', 'By Products', n)}${tab('orders', 'ShoppingCart', 'By Orders', st.selectedOrderIds.length)}</div>`;
  }
  function ordersTab() {
    const list = filteredOrders();
    const all = list.length > 0 && st.selectedOrderIds.length === list.length;
    const filters = '<div class="px-4 py-3 border-b border-gray-200 bg-white shrink-0"><div class="flex items-center gap-2"><div class="flex-1 relative">'
      + lucide('Search', { cls: 'absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' })
      + `<input class="${inputClass('pl-9')}" type="search" placeholder="Search by order #, name or contact..." value="${esc(st.searchText)}" data-rc-field="searchText">`
      + (st.searchText ? `<button class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600" data-rc="clear-search">${lucide('X', { cls: 'h-4 w-4' })}</button>` : '')
      + `</div><div style="min-width: 220px; max-width: 220px;">${selectMarkup('cat')}</div><div style="min-width: 150px;">${selectMarkup('date')}</div></div>`
      + `<div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-200"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" data-rc-check="all"${all ? ' checked' : ''}><span class="text-sm font-medium text-gray-700">Select All (${T}${list.length}${T} orders)</span></label>`
      + `<span class="text-sm text-gray-600">${st.selectedOrderIds.length}${T} selected</span></div></div>`;
    let body;
    if (st.loadingOrders) body = `<div class="flex flex-col items-center justify-center py-12"><img src="${SPINNER}" alt="Loading" class="w-10 h-10 mb-4"><p class="text-gray-500 text-sm">Loading all orders...</p></div>`;
    else if (list.length === 0) body = `<div class="text-center py-12">${lucide('FileText', { cls: 'w-16 h-16 text-gray-300 mx-auto mb-4' })}<p class="text-gray-500">${st.searchText ? 'No orders found matching your search' : 'No orders available'}</p></div>`;
    else {
      body = '<div class="space-y-2">' + list.map((o) => {
        const on = st.selectedOrderIds.includes(o._id);
        return `<div class="p-3 border rounded-lg cursor-pointer transition-all hover:shadow-sm ${on ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'}" data-rc-order="${esc(o._id)}" data-key="${esc(o._id)}"><div class="flex items-center gap-3">`
          + `<input type="checkbox" class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" data-rc-check="${esc(o._id)}"${on ? ' checked' : ''}>`
          + `<div class="flex items-center gap-2 flex-shrink-0 w-36">${lucide('Hash', { cls: 'w-4 h-4 text-gray-400' })}<span class="text-sm font-semibold text-gray-900">${esc(o.order_number || o.invoice)}</span></div>`
          + `<div class="flex items-center gap-2 flex-1 min-w-0">${lucide('User', { cls: 'w-4 h-4 text-gray-400 flex-shrink-0' })}<span class="text-sm font-medium text-gray-800 truncate">${esc(o.user_info?.name || 'Unknown Customer')}</span></div>`
          + `<div class="flex items-center gap-2 flex-shrink-0 w-32">${lucide('Phone', { cls: 'w-4 h-4 text-gray-400' })}<span class="text-sm text-gray-700">${esc(o.user_info?.contact || '-')}</span></div>`
          + `<div class="flex items-center gap-2 flex-shrink-0 w-28">${lucide('Calendar', { cls: 'w-4 h-4 text-gray-400' })}<span class="text-sm text-gray-700">${esc(new Date(o.createdAt).toLocaleDateString('en-GB'))}</span></div>`
          + '</div></div>';
      }).join('') + '</div>';
    }
    return `${filters}<div class="flex-1 overflow-y-auto p-6">${body}</div>`;
  }
  function productsTab() {
    const list = filteredProducts();
    const n = selectedProductCount();
    let grid;
    if (st.loadingProducts) grid = `<div class="flex flex-col items-center justify-center py-16"><img src="${SPINNER}" alt="Loading" class="w-10 h-10 mb-3"><p class="text-slate-500 text-sm">Loading products…</p></div>`;
    else if (list.length === 0) {
      grid = `<div class="flex flex-col items-center justify-center py-16">${lucide('Package', { cls: 'w-12 h-12 text-slate-200 mb-3' })}<p class="text-slate-500 text-sm font-medium">No products found</p>`
        + (st.productSearchText ? '<p class="text-slate-400 text-xs mt-1">Try a different search term</p>' : '') + '</div>';
    } else {
      grid = '<div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-3">' + list.map((p) => {
        const pid = p._id || p.id;
        const qty = st.productQuantities[pid] || '';
        const has = parseFloat(qty) > 0;
        const unit = host.getOrderingUnitFromUnitIndex(p.measurement) || p.unit || '';
        return `<div class="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${has ? 'border-emerald-300 bg-emerald-50/70' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'}" data-key="${esc(pid)}">`
          + `<span class="w-1.5 h-1.5 rounded-full shrink-0 ${has ? 'bg-emerald-500' : 'bg-slate-200'}"></span>`
          + `<div class="flex-1 min-w-0"><p class="text-sm leading-tight truncate ${has ? 'font-semibold text-slate-800' : 'font-medium text-slate-700'}">${esc(p.name || p.title || 'Unnamed Product')}</p>`
          + (p.articleNumber ? `<p class="text-[11px] text-slate-400 font-mono leading-tight truncate">${esc(p.articleNumber)}</p>` : '') + '</div>'
          + `<input type="number" min="0" step="any" placeholder="0" class="w-16 h-7 px-2 text-sm rounded-md text-right tabular-nums shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent ${has ? 'border border-emerald-300 bg-white text-emerald-700 font-semibold' : 'border border-slate-200 bg-white text-slate-600'}" value="${esc(qty)}" data-rc-qty="${esc(pid)}">`
          + `<span class="text-xs font-medium text-slate-400 shrink-0 w-8 truncate">${esc(unit || '—')}</span></div>`;
      }).join('') + '</div>';
    }
    return '<div class="flex flex-col flex-1 overflow-hidden"><div class="px-4 py-3 border-b border-gray-100 bg-white shrink-0"><div class="flex items-center gap-2 px-3 h-9 border border-slate-200 rounded-lg bg-white focus-within:ring-2 focus-within:ring-emerald-400 focus-within:border-transparent">'
      + lucide('Search', { cls: 'w-4 h-4 text-slate-400 shrink-0' })
      + `<input type="text" placeholder="Search by product name or article number…" class="flex-1 text-sm bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none" value="${esc(st.productSearchText)}" data-rc-field="productSearchText">`
      + (st.productSearchText ? `<button class="text-slate-400 hover:text-slate-600 shrink-0" data-rc="clear-product-search">${lucide('X', { cls: 'h-4 w-4' })}</button>` : '')
      + `</div></div><div class="flex-1 overflow-y-auto">${grid}</div>`
      + `<div class="shrink-0 px-5 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between"><span class="text-xs text-slate-500">${list.length}${T} product${plural(list.length) ? `${T}s` : ''}</span>`
      + (n > 0 ? `<span class="text-xs font-semibold text-emerald-600">${n}${T} product${plural(n) ? `${T}s` : ''}${T} with qty added</span>` : '<span class="text-xs text-slate-400">Enter qty to add a product</span>')
      + '</div></div>';
  }
  function footer() {
    if (st.showPreview || st.loadingFullOrders) return '';
    const n = selectedProductCount();
    const disabled = st.reportMode === 'orders' ? st.selectedOrderIds.length === 0 || st.loadingFullOrders : n === 0;
    const label = st.loadingFullOrders ? `<img src="${SPINNER}" alt="Loading" width="16" height="16" class="inline mr-2">Loading...`
      : st.reportMode === 'orders' ? `Generate Report (${st.selectedOrderIds.length})` : `Generate Report (${n} product${plural(n)})`;
    return '<div class="p-6 border-t border-gray-200 bg-white"><div class="flex flex-row items-center justify-between gap-4">'
      + `<button class="${buttonClass({ layout: 'outline', cls: 'px-6 whitespace-nowrap' })}" type="button" data-rc="close">Cancel</button>`
      + `<button class="${buttonClass({ disabled, cls: 'px-6 bg-blue-500 hover:bg-blue-600 text-white whitespace-nowrap' })}"${disabled ? ' disabled=""' : ''} type="button" data-rc="preview">${label}</button>`
      + '</div></div>';
  }

  // ── RawMaterialReportView ──
  function report() {
    const appProp = host.appProp;
    const orders = st.fullOrdersData;
    const productMap = new Map();
    st.allProducts.forEach((p) => { if (p?._id) productMap.set(p._id, p); if (p?.id) productMap.set(p.id, p); });
    st.allRawMaterials.forEach((p) => { if (p?._id) productMap.set(p._id, p); if (p?.id) productMap.set(p.id, p); });
    orders.forEach((o) => [...(o.item_list || o.items || []), ...(o.freeItems || [])].forEach((item) => {
      const pid = item.product_id || item.productId || item._id || item.id;
      if (!pid) return;
      if (!productMap.has(pid)) productMap.set(pid, { _id: pid, name: item.name || item.title || item.productName, stock: Number(item.stock || 0), boxes: item.boxes || item.boxRatio || 1, pallets: item.pallets || item.palletRatio || 1, measurement: item.measurement || item.baseMeasurement || '' });
      else { const ex = productMap.get(pid); if (!ex.name && (item.name || item.title)) productMap.set(pid, { ...ex, name: item.name || item.title }); }
    }));
    const mappingMap = parseMappingConfig(appProp?.productRawMaterialMapping);
    const ordered = new Map();
    orders.forEach((o) => {
      for (const item of [...(o.item_list || o.items || []), ...(o.freeItems || [])]) {
        const pid = item.product_id || item.productId || item._id || item.id;
        const q = Number(item.qty || item.quantity || 0);
        if (pid && q > 0) ordered.set(pid, (ordered.get(pid) || 0) + q);
      }
    });
    const orderingIdx = appProp?.priceCalculationUnitIndex ?? host.unitIndex() ?? 0;
    const displayUnit = orderingIdx;
    const toDisplay = (stockInBase, boxes, pallets) => parseFloat(host.getQuantityFromBaseUnitQuantity(stockInBase, displayUnit, boxes || 1, pallets || 1)) || 0;
    const rows = [];
    for (const [fid, orderedQty] of ordered.entries()) {
      const fp = productMap.get(fid);
      const name = fp?.name || fp?.title || `Product (${fid.substring(0, 8)})`;
      const fpBoxes = fp?.boxes || 1; const fpPallets = fp?.pallets || 1;
      const orderedSecondary = parseFloat(host.getBaseUnitQuantityFromQuantity(orderedQty, fpBoxes, fpPallets, orderingIdx).toFixed(3)) || 0;
      const fpUnit = host.getOrderingUnitFromUnitIndex(fp?.measurement || '', 0);
      if (!mappingMap.has(fid)) { rows.push({ finishedProduct: { id: fid, name, orderedQty: orderedSecondary, unit: fpUnit }, rawMaterials: [], isMapped: false }); continue; }
      const leaf = expandToLeafMaterials(fid, host.getBaseUnitQuantityFromQuantity(orderedQty, fpBoxes, fpPallets, orderingIdx), mappingMap);
      const raw = [];
      leaf.forEach((reqBase, rid) => {
        const rm = productMap.get(rid);
        const available = toDisplay(Number(rm?.stock || 0), rm?.boxes, rm?.pallets);
        const required = parseFloat(toDisplay(reqBase, rm?.boxes, rm?.pallets).toFixed(3));
        raw.push({ id: rid, name: rm?.name || rm?.title || `Material (${rid.substring(0, 8)})`, requiredQty: required, availableStock: available, shortage: parseFloat(Math.max(0, required - available).toFixed(3)), unit: host.getOrderingUnitFromUnitIndex(rm?.measurement || '', displayUnit) });
      });
      rows.push({
        finishedProduct: { id: fid, name, orderedQty: orderedSecondary, unit: fpUnit }, rawMaterials: raw, isMapped: true,
        totalRequired: parseFloat(raw.reduce((s, r) => s + r.requiredQty, 0).toFixed(3)),
        totalAvailableStock: parseFloat(raw.reduce((s, r) => s + r.availableStock, 0).toFixed(3)),
        totalShortage: parseFloat(raw.reduce((s, r) => s + r.shortage, 0).toFixed(3)),
      });
    }
    const cons = new Map();
    rows.forEach((sec) => sec.rawMaterials.forEach((rm) => {
      if (cons.has(rm.id)) cons.get(rm.id).totalRequired += rm.requiredQty;
      else cons.set(rm.id, { id: rm.id, name: rm.name, totalRequired: rm.requiredQty, availableStock: rm.availableStock, unit: rm.unit });
    }));
    const consolidated = [...cons.values()].map((rm) => ({ ...rm, totalRequired: parseFloat(rm.totalRequired.toFixed(3)), shortage: parseFloat(Math.max(0, rm.totalRequired - rm.availableStock).toFixed(3)), productData: productMap.get(rm.id) ?? null }))
      .sort((a, b) => b.shortage - a.shortage);
    st.consolidated = consolidated;
    st.displayUnit = displayUnit;
    const shortages = consolidated.filter((r) => r.shortage > 0).length;
    const hasMapping = mappingMap.size > 0;
    const hasData = rows.length > 0;
    const n = selectedProductCount();
    const sourceLabel = st.reportMode === 'products' ? `${n} product${plural(n)} manually entered` : `${orders.length} order${orders.length > 1 ? 's' : ''} selected`;
    const th = (label, right, w) => `<th class="px-4 py-3 text-${right ? 'right' : 'left'} text-xs font-semibold text-gray-500 uppercase tracking-wider${w ? ' w-8' : ''}">${label}</th>`;
    const table = (cols, body) => `<div class="overflow-x-auto"><table class="rm-report-table w-full text-sm"><thead><tr class="bg-gray-50 border-b border-gray-200">${cols}</tr></thead><tbody class="divide-y divide-gray-100">${body}</tbody></table></div>`;
    const cells = (i, r, req) => `<td class="px-4 py-3 text-gray-400 text-xs">${i + 1}</td><td class="px-4 py-3 font-medium text-gray-800">${esc(r.name)}</td><td class="px-4 py-3 text-gray-500 text-xs">${esc(r.unit || '—')}</td>`
      + `<td class="px-4 py-3 text-right font-semibold text-gray-900">${req.toLocaleString()}</td><td class="px-4 py-3 text-right text-gray-700">${r.availableStock.toLocaleString()}</td>`
      + `<td class="px-4 py-3 text-right font-bold ${r.shortage > 0 ? 'text-red-600' : 'text-green-600'}">${r.shortage > 0 ? r.shortage.toLocaleString() : '0'}</td>`;
    let out = '<div class="h-full flex flex-col"><div class="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white no-print">'
      + `<button class="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors" data-rc="back">${lucide('ArrowLeft', { cls: 'w-4 h-4' })}Back to Orders</button>`
      + `<div class="flex items-center gap-3"><button class="${buttonClass({ disabled: !hasData, cls: 'flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4' })}"${hasData ? '' : ' disabled=""'} type="button" data-rc="print">${lucide('Printer', { cls: 'w-4 h-4' })}Print Report</button></div></div>`
      + '<div class="flex-1 overflow-y-auto bg-gray-50 p-6"><div class="max-w-5xl mx-auto" data-rc-report>'
      + `<div class="mb-6 text-center"><div class="flex items-center justify-center gap-2 mb-1">${lucide('FlaskConical', { cls: 'w-6 h-6 text-blue-600' })}<h1 class="text-2xl font-bold text-gray-900">${esc(st.reportName)}</h1></div>`
      + `<p class="text-sm text-gray-500">Generated on ${T}${esc(new Date().toLocaleDateString('en-GB'))}${T}  | ${T} ${T}${esc(sourceLabel)}</p></div>`;
    if (!hasMapping) {
      out += `<div class="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center mb-6">${lucide('FlaskConical', { cls: 'w-12 h-12 text-amber-400 mx-auto mb-3' })}<h3 class="text-lg font-semibold text-amber-800 mb-1">Raw Material Report Not Ready</h3>`
        + '<p class="text-amber-700 text-sm">The ingredients required for your products haven\'t been set up yet. Please contact your administrator to get this configured before using this report.</p></div>';
    }
    if (hasMapping && !hasData) {
      out += `<div class="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">${lucide('FlaskConical', { cls: 'w-12 h-12 text-blue-300 mx-auto mb-3' })}<h3 class="text-lg font-semibold text-blue-700 mb-1">No Products in Selected Orders</h3><p class="text-blue-600 text-sm">The selected orders do not contain any products.</p></div>`;
    }
    if (hasData && consolidated.length > 0) {
      out += '<div class="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden" style="break-inside: avoid;"><div class="px-5 py-4 border-b border-gray-200 bg-gray-50"><div class="flex items-center gap-3">'
        + `<div class="p-2 bg-amber-100 rounded-lg">${lucide('FlaskConical', { cls: 'w-5 h-5 text-amber-600' })}</div><div><h2 class="text-base font-semibold text-gray-900">Consolidated Raw Material Requirement</h2><p class="text-xs text-gray-500">Total requirement across all finished products — for procurement</p></div>`
        + (shortages ? `<span class="ml-auto inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">${shortages}${T} in shortage</span>`
          + `<button class="no-print inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors shadow-sm flex-shrink-0" data-rc="po">${lucide('ShoppingCart', { cls: 'w-4 h-4' })}Create Raw Material Requests</button>` : '')
        + '</div></div>'
        + table(th('#', false, true) + th('Raw Material') + th('Unit') + th('Total Required', true) + th('Available Stock', true) + th('Net Shortage', true),
          consolidated.map((r, i) => `<tr class="bg-white hover:bg-gray-50 transition-colors">${cells(i, r, r.totalRequired)}</tr>`).join(''))
        + '</div>';
    }
    if (hasData) {
      rows.forEach((sec, idx) => {
        out += '<div class="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden" style="break-inside: avoid;"><div class="px-5 py-4 bg-gray-50 border-b border-gray-200"><div class="flex items-start justify-between gap-4">'
          + `<div class="flex items-center gap-3"><span class="w-7 h-7 rounded-full bg-gray-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">${idx + 1}</span><div><h2 class="text-base font-semibold text-gray-900">${esc(sec.finishedProduct.name)}</h2><p class="text-xs text-gray-500">Finished Product</p></div></div>`
          + `<div class="flex items-center gap-4 flex-wrap justify-end"><div class="text-right"><p class="text-xs text-gray-400">Ordered</p><p class="text-sm font-bold text-gray-800">${sec.finishedProduct.orderedQty}${T} <span class="text-xs font-normal text-gray-500">${esc(sec.finishedProduct.unit)}</span></p></div>`
          + (sec.isMapped ? '<div class="w-px h-8 bg-gray-200"></div>'
            + `<div class="text-right"><p class="text-xs text-gray-400">Total Required</p><p class="text-sm font-semibold text-gray-700">${sec.totalRequired.toLocaleString()}</p></div>`
            + `<div class="text-right"><p class="text-xs text-gray-400">Total Available</p><p class="text-sm font-semibold text-gray-700">${sec.totalAvailableStock.toLocaleString()}</p></div>`
            + `<div class="text-right"><p class="text-xs text-gray-400">Shortage</p><p class="text-sm font-bold ${sec.totalShortage > 0 ? 'text-red-600' : 'text-green-600'}">${sec.totalShortage.toLocaleString()}</p></div>` : '')
          + '</div></div></div>'
          + (!sec.isMapped ? `<div class="px-5 py-6 flex items-center gap-3 text-amber-700 bg-amber-50">${lucide('FlaskConical', { cls: 'w-5 h-5 flex-shrink-0 text-amber-400' })}<p class="text-sm">The ingredients for this product haven't been set up yet.${T} <span class="font-semibold">Please contact your administrator to get this configured.</span></p></div>`
            : table(th('#', false, true) + th('Raw Material') + th('Unit') + th('Required Qty', true) + th('Available Stock', true) + th('Shortage', true),
              sec.rawMaterials.map((r, i) => `<tr class="bg-white hover:bg-gray-50 transition-colors">${cells(i, r, r.requiredQty)}</tr>`).join('')))
          + '</div>';
      });
    }
    return `${out}</div></div>${po.render()}</div>`;
  }

  function content() {
    let body;
    if (!st.showPreview) body = `<div class="h-full flex flex-col">${tabs()}${st.reportMode === 'orders' ? ordersTab() : productsTab()}</div>`;
    else if (st.loadingFullOrders) body = `<div class="flex flex-col items-center justify-center h-full"><img src="${SPINNER}" alt="Loading" width="60" height="60"><p class="mt-4 text-gray-600">Loading order details...</p></div>`;
    else body = report();
    const n = st.selectedOrderIds.length;
    return `<div class="flex flex-col h-full relative">${header()}`
      + (st.loadingFullOrders ? `<div class="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50"><div class="flex flex-col items-center gap-4"><img src="${SPINNER}" alt="Loading" width="48" height="48"><div class="text-center"><p class="text-lg font-semibold text-gray-700">Generating Raw Material Report...</p><p class="text-sm text-gray-500 mt-1">Processing ${T}${n}${T} order${n > 1 ? `${T}s` : ''}</p></div></div></div>` : '')
      + `<div class="flex-1 overflow-hidden">${body}</div>${footer()}</div>`;
  }

  /** FormModal "Enter Report Name": portalled to <body>, above everything, locking the page scroll. */
  function modalMarkup() {
    const ok = st.reportName.trim();
    return `<div class="fixed inset-0 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="${st.titleId}" style="z-index: 9999;" data-rc-overlay><div class="h-full w-full overflow-y-auto px-4 py-4"><div class="min-h-full flex items-start justify-center sm:items-center">`
      + '<div class="relative w-full max-w-lg rounded-xl bg-white dark:bg-gray-800 shadow-2xl overflow-visible" data-rc-panel>'
      + `<div class="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-700"><div><h2 id="${st.titleId}" class="text-lg font-semibold text-gray-800 dark:text-gray-100">Enter Report Name</h2></div>`
      + `<button class="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition" aria-label="Close modal" type="button" data-rc="modal-close">${lucide('X', { cls: 'w-5 h-5' })}</button></div>`
      + '<div class="p-6 overflow-visible"><div class="space-y-4"><div><label class="block text-sm font-medium text-gray-700 mb-2">Report Name</label>'
      + `<input class="${inputClass('w-full')}" type="text" placeholder="Enter report name" value="${esc(st.reportName)}" data-rc-field="reportName"></div>`
      + `<div class="flex justify-end gap-3 pt-2"><button class="${buttonClass({ layout: 'outline' })}" type="button" data-rc="modal-close">Cancel</button>`
      + `<button class="${buttonClass({ disabled: !ok, cls: 'bg-blue-500 hover:bg-blue-600 text-white' })}"${ok ? '' : ' disabled=""'} type="button" data-rc="modal-continue">Continue</button></div>`
      + '</div></div></div></div></div></div>';
  }
  let prevOverflow = '';
  const onModalKey = (e) => { if (e.key === 'Escape' && st?.showReportNameModal) { st.showReportNameModal = false; render(); } };
  function syncModal() {
    if (!st?.showReportNameModal) { closeModal(); return; }
    if (modalRoot) { morphOuter(modalRoot, modalMarkup()); return; }
    const tpl = document.createElement('template');
    tpl.innerHTML = modalMarkup();
    modalRoot = tpl.content.firstElementChild;
    document.body.appendChild(modalRoot);
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onModalKey);
    wire(modalRoot);
  }
  function closeModal() {
    if (!modalRoot) return;
    modalRoot.remove(); modalRoot = null;
    document.body.style.overflow = prevOverflow;
    document.removeEventListener('keydown', onModalKey);
  }

  // A re-render can blur a field mid-morph, and blurring re-renders: never nest the two.
  let rendering = false;
  let again = false;
  function render(opening = false) {
    if (!st) return;
    if (rendering) { again = true; return; }
    rendering = true;
    try { paint(opening); } finally { rendering = false; }
    if (again) { again = false; render(); }
  }
  function paint(opening) {
    // Remounting the By Orders tab mounts two fresh react-selects (new instance ids).
    const ordersShown = !st.showPreview && st.reportMode === 'orders';
    if (ordersShown && !st.cat) { st.cat = rsState(); st.date = rsState(); }
    if (!ordersShown) { st.cat = null; st.date = null; }
    // The report view's print styles, in <head> while it is mounted.
    const reportShown = st.showPreview && !st.loadingFullOrders;
    if (reportShown && !printStyle) {
      printStyle = document.createElement('style');
      printStyle.textContent = '\n      @media print {\n        @page { size: A4 landscape; margin: 10mm; }\n        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }\n        .no-print { display: none !important; }\n        .rm-report-table { border-collapse: collapse; width: 100%; }\n        .rm-report-table th, .rm-report-table td { border: 1px solid #e5e7eb; }\n      }\n    ';
      document.head.appendChild(printStyle);
    } else if (!reportShown && printStyle) { printStyle.remove(); printStyle = null; }
    if (!reportShown && po.isOpen()) po.close();
    const body = drawer.render(content(), opening || drawer.open);
    po.afterRender(body);
    syncModal();
  }

  // ── Actions ──
  function handlePreview() {
    if (st.reportMode === 'orders') { if (st.selectedOrderIds.length === 0) { alert('Please select at least one order'); return; } }
    else if (selectedProductCount() === 0) { alert('Please add quantity to at least one product'); return; }
    st.reportName = `Raw Material Report - ${new Date().toLocaleDateString('en-GB')}`;
    st.showReportNameModal = true;
  }
  async function fetchFullOrderDetails() {
    const mine = st;
    st.loadingFullOrders = true; render();
    try {
      const { data: allOrgs } = await server.getOrderHistory();
      if (st !== mine) return;
      const selected = st.orders.filter((o) => st.selectedOrderIds.includes(o._id));
      const full = [];
      for (const so of selected) {
        const customer = allOrgs.orgs.find((org) => org.phone === so.user_info?.contact);
        if (customer?.orders) {
          const fo = customer.orders.find((o) => o.order_number === so.invoice);
          if (fo) full.push({ ...so, item_list: fo.item_list || [], freeItems: fo.freeItems || [], user_info: { ...so.user_info, _id: customer._id } });
        }
      }
      st.fullOrdersData = full;
      setTimeout(() => { if (st === mine) { st.showPreview = true; st.loadingFullOrders = false; render(); } }, 100);
    } catch {
      if (st !== mine) return;
      host.notify('error', 'Failed to fetch complete order details. Please try again.');
      st.loadingFullOrders = false; render();
    }
  }
  function submitName() {
    st.showReportNameModal = false;
    if (st.reportMode === 'products') {
      st.fullOrdersData = [{
        _id: 'manual-products', order_number: 'Manual Entry',
        item_list: Object.entries(st.productQuantities).filter(([, v]) => parseFloat(v) > 0).map(([productId, qty]) => ({ product_id: productId, qty: parseFloat(qty) })),
        freeItems: [], user_info: { name: 'Manual Entry' },
      }];
      st.showPreview = true;
      render();
    } else { render(); fetchFullOrderDetails(); }
  }
  /** useReactToPrint: the report alone, printed from a frame, titled after the report name. */
  function print() {
    const node = drawer.host.querySelector('[data-rc-report]');
    if (!node) return;
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position: absolute; width: 0; height: 0; border: 0;';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    const title = st.reportName.replace(/\//g, '-').replace(/\s+/g, '_');
    doc.open();
    doc.write(`<!doctype html><html><head><title>${esc(title)}</title>${[...document.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join('')}<style>@page { size: A4 landscape; margin: 10mm; } @media print { html, body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }</style></head><body>${node.outerHTML}</body></html>`);
    doc.close();
    setTimeout(() => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 1000); }, 300);
  }

  // ── Events ──
  function wire(root) {
    root.addEventListener('mousedown', (e) => {
      if (!st) return;
      if (po.handleMouseDown(e)) return;
      // FormModal: a press outside its panel closes it.
      if (e.target.closest('[data-rc-overlay]') && !e.target.closest('[data-rc-panel]')) { st.showReportNameModal = false; render(); return; }
      const clear = e.target.closest('[data-rc-clear]');
      if (clear && e.button === 0) {
        e.preventDefault();
        const which = clear.dataset.rcClear; const k = cfg(which);
        applyValue(which, [], 'All selected options have been cleared.');
        k.rs.focused = true; render(); focusSelect(which); return;
      }
      const remove = e.target.closest('[data-rc-remove]');
      if (remove) { e.preventDefault(); return; }
      const opt = e.target.closest('[data-rc-option]');
      if (opt || e.target.closest('[data-rc-menu]')) { e.preventDefault(); return; }
      const control = e.target.closest('[data-rc-control]');
      if (control && e.button === 0) {
        const which = control.dataset.rcControl; const k = cfg(which); const onInput = e.target.tagName === 'INPUT';
        if (!k.rs.focused) { k.rs.focused = true; k.rs.open = true; k.rs.focus = 0; render(); focusSelect(which); }
        else if (!k.rs.open) { k.rs.open = true; k.rs.focus = 0; render(); }
        else if (!onInput) { k.rs.open = false; k.rs.input = ''; render(); }
        if (!onInput) e.preventDefault();
      }
    });
    root.addEventListener('mousemove', (e) => {
      const opt = e.target.closest('[data-rc-option]');
      if (!opt || !st) return;
      const k = cfg(opt.dataset.rcSel); const i = Number(opt.dataset.rcOption);
      if (k.rs.focus !== i) { k.rs.focus = i; render(); }
    });
    root.addEventListener('click', (e) => {
      if (!st) return;
      if (po.handleClick(e)) return;
      const remove = e.target.closest('[data-rc-remove]');
      if (remove) {
        const which = remove.dataset.rcSel; const k = cfg(which); const v = k.value.find((x) => x.value === remove.dataset.rcRemove);
        applyValue(which, k.value.filter((x) => x.value !== remove.dataset.rcRemove), `option ${v?.label}, deselected.`);
        k.rs.focused = true; render(); focusSelect(which); return;
      }
      const opt = e.target.closest('[data-rc-option]');
      if (opt) { const which = opt.dataset.rcSel; const k = cfg(which); selectOption(which, shown(k)[Number(opt.dataset.rcOption)]); render(); return; }
      const check = e.target.closest('[data-rc-check]');
      if (check) { e.stopPropagation(); return; }
      const order = e.target.closest('[data-rc-order]');
      if (order) { toggleOrder(order.dataset.rcOrder); return; }
      const b = e.target.closest('[data-rc]');
      if (!b) return;
      switch (b.dataset.rc) {
        case 'close':
          st.selectedOrderIds = []; st.selectedCatalogues = []; st.searchText = ''; st.selectedDateFilter = ''; st.showPreview = false; st.productQuantities = {}; st.productSearchText = '';
          drawer.requestClose('programmatic'); return;
        case 'mode': st.reportMode = b.dataset.mode; break;
        case 'clear-search': st.searchText = ''; break;
        case 'clear-product-search': st.productSearchText = ''; break;
        case 'preview': handlePreview(); break;
        case 'modal-close': st.showReportNameModal = false; break;
        case 'modal-continue': submitName(); return;
        case 'back': st.showPreview = false; break;
        case 'print': print(); return;
        case 'po': po.open(st.consolidated, st.displayUnit); break;
        default: return;
      }
      render();
    });
    root.addEventListener('change', (e) => {
      const c = e.target.closest('[data-rc-check]');
      if (!c || !st) return;
      if (c.dataset.rcCheck === 'all') {
        const list = filteredOrders();
        st.selectedOrderIds = st.selectedOrderIds.length === list.length ? [] : list.map((o) => o._id);
      } else toggleOrder(c.dataset.rcCheck, true);
      render();
    });
    root.addEventListener('input', (e) => {
      if (!st) return;
      if (po.handleInput(e)) return;
      const f = e.target.closest('[data-rc-field]');
      if (f) { st[f.dataset.rcField] = f.value; render(); return; }
      const q = e.target.closest('[data-rc-qty]');
      if (q) { st.productQuantities = { ...st.productQuantities, [q.dataset.rcQty]: q.value }; render(); return; }
      const inp = e.target.closest('[data-rc-input]');
      if (inp) { const k = cfg(inp.dataset.rcInput); k.rs.input = inp.value; k.rs.open = true; k.rs.focus = 0; k.rs.hidden = false; render(); }
    });
    root.addEventListener('keydown', (e) => {
      if (!st) return;
      if (po.handleKeydown(e)) return;
      const inp = e.target.closest('[data-rc-input]');
      if (!inp) return;
      const which = inp.dataset.rcInput; const k = cfg(which); const opts = shown(k);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!k.rs.open) { k.rs.open = true; k.rs.focus = e.key === 'ArrowDown' ? 0 : opts.length - 1; }
        else k.rs.focus = (k.rs.focus + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % Math.max(opts.length, 1);
        render();
      } else if (e.key === 'Enter' && k.rs.open && opts[k.rs.focus]) { e.preventDefault(); selectOption(which, opts[k.rs.focus]); render(); }
      else if (e.key === 'Escape' && k.rs.open) { e.preventDefault(); e.stopPropagation(); k.rs.open = false; k.rs.input = ''; render(); }
      else if (e.key === 'Backspace' && !k.rs.input && k.value.length) {
        const last = k.value[k.value.length - 1];
        applyValue(which, k.value.slice(0, -1), k.multi ? `option ${last.label}, deselected.` : 'All selected options have been cleared.');
        render();
      }
    });
    root.addEventListener('focusin', (e) => { if (st) po.handleFocusIn(e); });
    root.addEventListener('focusout', (e) => {
      if (st) po.handleFocusOut(e);
      const inp = e.target.closest?.('[data-rc-input]');
      if (!inp || !st) return;
      const k = cfg(inp.dataset.rcInput);
      if (!k.rs) return;
      k.rs.focused = false; k.rs.open = false; k.rs.input = ''; k.rs.hidden = false;
      render();
    });
  }
  function toggleOrder(id) {
    st.selectedOrderIds = st.selectedOrderIds.includes(id) ? st.selectedOrderIds.filter((x) => x !== id) : [...st.selectedOrderIds, id];
    render();
  }
  wire(drawer.host);

  return { open, close, isOpen };
}

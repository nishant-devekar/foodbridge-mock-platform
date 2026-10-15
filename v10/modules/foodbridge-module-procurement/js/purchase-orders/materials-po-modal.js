/*
  "Create Raw Material Requests": the host's CreatePurchaseOrderFromMaterialsModal
  (storefront-frontend components/purchase/), opened from the Raw Material report's consolidated
  table when something is short. Rendered inside the report, fixed over everything.

    1 Assign Suppliers   each short material: order qty (its shortage, or its total requirement),
                         unit price, and a supplier — internal sources first, then external ones.
                         An internal source's price list is fetched to say whether it carries the
                         material, and to fill the price from it. "Quick assign all" does every row.
    2 Review & Create    one purchase order per supplier
    3 Result             the orders created one by one through the host's purchase-order handler

  Its supplier dropdowns are portalled into the modal panel, positioned against it. "Add new
  supplier" opens the host's AddSupplierModal above it (z-index 110).
*/
import { esc } from '../components/dom.js';
import { lucide } from '../components/icons.js';
import { createAddSupplierModal } from './add-supplier-modal.js';

const T = '<!---->';
const ASSIGN = 'assign';
const REVIEW = 'review';
const RESULT = 'result';
const SHORTAGE = 'shortage';
const REQUIRED = 'required';
const INPUT = 'w-full text-right px-2 py-1.5 text-sm font-medium border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none';
const NO_SPIN = '[appearance:textfield] [&amp;::-webkit-outer-spin-button]:appearance-none [&amp;::-webkit-inner-spin-button]:appearance-none';
const PRICE = 'w-full text-right pl-5 pr-2 py-1.5 text-sm font-medium border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none';
const plural = (n) => (n !== 1 ? 's' : '');

/** utils/supplierType.getSupplierTypeChip */
function chip(s) {
  if (s?._sourceType === 'internalSupplier') return { label: 'Internal', shortLabel: 'Int', classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 ring-1 ring-blue-200' };
  if (s?.supplierType === 'DEPARTMENT') return { label: 'Department', shortLabel: 'Dept', classes: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 ring-1 ring-purple-200' };
  return { label: 'External', shortLabel: 'Ext', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-1 ring-amber-200' };
}

export function createMaterialsPoModal(host, server, { rerender }) {
  let s = null; // null while closed
  const addSupplier = createAddSupplierModal(host, { rerender: () => rerender(), onSave: (form) => saveNewSupplier(form), zIndex: '110', defaultSupplierType: null });

  /** One product line of the purchase-order payload (buildProductPayload). */
  function buildProductPayload(m, idx = 0) {
    const pd = m.productData || {};
    const measurement = pd.measurement || m.unit || 'Unit';
    const orderingUnit = measurement.split('-')[idx]?.trim() || pd.orderingUnit || m.unit || 'Unit';
    const entered = Number(m.orderedPrice) || 0;
    let price = entered;
    if (idx > 0) {
      const per = host.getBaseUnitQuantityFromQuantity(1, pd.boxes || 1, pd.pallets || 1, idx);
      price = per > 0 ? entered / per : entered;
    }
    const categoryId = pd.categoryId || pd.subId || '';
    const parentCategoryId = pd.parentCategoryId || pd.catId || '';
    return {
      id: m.id, name: pd.name || m.name, unitPrice: `${price}/${measurement}`, qty: String(m.orderedQty), stock: Number(m.availableStock ?? 0), comments: '',
      categoryId, parentCategoryId, articleNumber: pd.articleNumber || pd.articleNo || '', description: pd.description || '', imagesUrl: pd.imagesUrl || [],
      boxes: pd.boxes || 1, pallets: pd.pallets || 1, status: pd.status || 'ACTIVE', priceMap: { ...(pd.priceMap || {}), [orderingUnit]: entered },
      barcode: pd.barcode || '', isInventoryEnabled: pd.isInventoryEnabled ?? true, tax: 0, offerPrice: price, brand: pd.brand || '', maxRetailPrice: price,
      variants: pd.variants || [], attributes: pd.attributes ? { sku: '', taxClassificationCode: '', ...pd.attributes } : { sku: '', taxClassificationCode: '' },
      policyTemplate: pd.policyTemplate || [], _id: m.id, price, measurement, subName: 'RAW MATERIAL', subId: categoryId, catId: parentCategoryId,
      palletCount: pd.palletCount || 1, orderingUnit,
    };
  }

  const shortageItems = () => s.materials.filter((m) => m.shortage > 0);
  const defaultQty = (m, mode) => {
    const base = mode === SHORTAGE ? m.shortage : m.totalRequired;
    const pd = m.productData || {};
    const idx = s.unitIndex;
    const raw = idx > 0 ? parseFloat(host.getQuantityFromBaseUnitQuantity(base, idx, pd.boxes || 1, pd.pallets || 1)) || 0 : base;
    return idx > 0 ? Math.ceil(raw) : raw;
  };

  function open(materials, unitIndex = 0) {
    s = {
      materials, unitIndex, step: ASSIGN, suppliers: [], loadingSuppliers: true, assignments: {}, qtyMode: SHORTAGE, bulkSupplierId: '',
      isCreating: false, progress: [], results: [], cache: {}, fetching: new Set(), pendingMaterial: null, dropdown: null, focusSearch: false,
    };
    for (const m of shortageItems()) { const q = defaultQty(m, SHORTAGE); s.assignments[m.id] = { supplierId: '', qty: q, qtyStr: String(q), price: 0, priceStr: '0' }; }
    loadSuppliers();
  }
  function close() { s = null; addSupplier.close(); }
  const isOpen = () => Boolean(s);

  async function loadSuppliers() {
    const mine = s;
    try {
      const [sellers, suppliers] = await Promise.all([server.listSelectableInternalSources(), server.listExternalSuppliers()]);
      if (s !== mine) return;
      s.suppliers = [...(sellers || []).map((x) => ({ ...x, _sourceType: 'internalSupplier' })), ...(suppliers || []).map((x) => ({ ...x, _sourceType: 'externalSupplier' }))];
    } catch { host.notify('error', 'Failed to load suppliers'); } finally { if (s === mine) { s.loadingSuppliers = false; rerender(); } }
  }

  /** An internal source's price list, once: whether it carries each material, and at what price. */
  async function fetchInternal(supplier) {
    if (supplier?._sourceType !== 'internalSupplier') return;
    const sid = supplier._id;
    if (s.fetching.has(sid)) return;
    s.fetching.add(sid);
    s.cache[sid] = { loading: true, products: [] };
    const mine = s;
    try {
      const res = await server.getHostProductList(sid);
      if (s !== mine) return;
      const flat = [];
      (res?.data?.products || []).forEach((cat) => (cat.categories || []).forEach((sub) => (sub.categories || []).forEach((p) => flat.push(p))));
      s.cache[sid] = { loading: false, products: flat };
    } catch {
      if (s !== mine) return;
      s.fetching.delete(sid);
      s.cache[sid] = { loading: false, products: [] };
    }
    autofillPrices();
    rerender();
  }
  function coverage() {
    const map = {};
    for (const m of shortageItems()) {
      const a = s.assignments[m.id];
      if (!a?.supplierId) continue;
      const sup = s.suppliers.find((x) => x._id === a.supplierId);
      if (sup?._sourceType !== 'internalSupplier') continue;
      const cached = s.cache[a.supplierId];
      if (!cached) continue;
      if (cached.loading) { map[m.id] = { loading: true, supplied: null, price: null }; continue; }
      const match = cached.products.find((p) => {
        const pid = String(p.id || p._id || ''); const mid = String(m.id || '');
        if (pid && mid && pid === mid) return true;
        const art = m.productData?.articleNumber;
        return art && p.articleNumber ? String(p.articleNumber).trim() === String(art).trim() : false;
      });
      map[m.id] = { loading: false, supplied: Boolean(match), price: match ? parseFloat(match.offerPrice || match.price || 0) || null : null };
    }
    return map;
  }
  function autofillPrices() {
    const cov = coverage();
    for (const m of shortageItems()) {
      const c = cov[m.id]; const a = s.assignments[m.id];
      if (!c || c.loading || !c.supplied || !c.price || !a || a.price !== 0) continue;
      s.assignments[m.id] = { ...a, price: c.price, priceStr: String(c.price) };
    }
  }
  function setSupplier(materialId, supplierId) {
    s.assignments[materialId] = { ...s.assignments[materialId], supplierId };
    const sup = s.suppliers.find((x) => x._id === supplierId);
    if (sup) fetchInternal(sup);
  }
  function clearSupplier(materialId) {
    s.assignments[materialId] = { ...s.assignments[materialId], supplierId: '' };
    if (!Object.values(s.assignments).some((a) => a.supplierId)) s.bulkSupplierId = '';
  }
  function bulkAssign(supplierId) {
    s.bulkSupplierId = supplierId;
    for (const m of shortageItems()) s.assignments[m.id] = { ...s.assignments[m.id], supplierId };
    const sup = s.suppliers.find((x) => x._id === supplierId);
    if (sup) fetchInternal(sup);
  }
  function setQtyMode(mode) {
    s.qtyMode = mode;
    for (const m of shortageItems()) {
      const base = mode === SHORTAGE ? m.shortage : m.totalRequired;
      const pd = m.productData || {};
      const raw = s.unitIndex > 0 && mode !== SHORTAGE ? parseFloat(host.getQuantityFromBaseUnitQuantity(base, s.unitIndex, pd.boxes || 1, pd.pallets || 1)) || 0 : base;
      const q = s.unitIndex > 0 ? Math.ceil(raw) : raw;
      s.assignments[m.id] = { ...s.assignments[m.id], qty: q, qtyStr: String(q) };
    }
  }
  function groups() {
    const map = new Map();
    for (const m of shortageItems()) {
      const a = s.assignments[m.id];
      if (!a?.supplierId) continue;
      const supplier = s.suppliers.find((x) => x._id === a.supplierId);
      if (!supplier) continue;
      if (!map.has(a.supplierId)) map.set(a.supplierId, { supplier, items: [] });
      map.get(a.supplierId).items.push({ ...m, orderedQty: a.qty, orderedPrice: a.price ?? 0 });
    }
    return [...map.values()];
  }

  async function saveNewSupplier(form) {
    try {
      const res = await server.createSupplier(form);
      if (!s) return;
      if (!res?.status) { host.notify('error', res?.message || 'Failed to create supplier'); return; }
      const created = { ...(res.data || {}), _id: res.data?._id || res.data?.id, name: form.name, _sourceType: 'externalSupplier' };
      s.suppliers = [...s.suppliers, created];
      if (created._id) {
        if (s.pendingMaterial) setSupplier(s.pendingMaterial, created._id);
        else { for (const m of shortageItems()) s.assignments[m.id] = { ...s.assignments[m.id], supplierId: created._id }; s.bulkSupplierId = created._id; }
      }
      s.pendingMaterial = null;
      host.notify('success', 'Supplier created successfully');
    } catch (err) {
      host.notify('error', err?.message || 'Failed to create supplier');
    }
    rerender();
  }

  async function create() {
    const gs = groups();
    s.progress = gs.map((g) => ({ supplierId: g.supplier._id, supplierName: g.supplier.name, status: 'pending', message: '' }));
    s.step = RESULT; s.isCreating = true; rerender();
    const mine = s;
    const results = [];
    for (let i = 0; i < gs.length; i++) {
      const { supplier, items } = gs[i];
      s.progress[i] = { ...s.progress[i], status: 'creating' }; rerender();
      try {
        const products = items.filter((m) => (m.orderedQty ?? 0) > 0).map((m) => buildProductPayload(m, s.unitIndex));
        if (products.length === 0) throw new Error('All items have zero quantity');
        const totalQuantity = products.reduce((t, p) => t + parseFloat(p.qty || 0), 0);
        const totalCost = products.reduce((t, p) => t + (parseFloat(p.price) || 0) * (parseFloat(p.qty) || 0), 0);
        const payload = {
          buyerLocationStoreId: host.getCurrentLocationId(), costPrice: totalCost, transportationCost: 0, salePrice: parseFloat(totalCost).toFixed(2),
          purchaseQty: String(totalQuantity), logisticsType: 'Courier/Parcel', products,
          ...(supplier._sourceType === 'internalSupplier' ? { supplier: { _id: supplier._id, orgId: supplier.orgId } } : { supplier_id: supplier._id, supplier: null }),
        };
        // OrderServices.createPurchaseOrder: the client library's propogateUp, which flags any
        // failed response and is rethrown as one message.
        try { await server.createPurchaseOrder(payload); } catch { throw new Error('Purchase order failure'); }
        if (s !== mine) return;
        s.progress[i] = { ...s.progress[i], status: 'done' };
        results.push({ supplier: supplier.name, status: 'success', itemCount: products.length });
      } catch (err) {
        if (s !== mine) return;
        const msg = err?.response?.data?.message || err?.message || 'Failed';
        s.progress[i] = { ...s.progress[i], status: 'error', message: msg };
        results.push({ supplier: supplier.name, status: 'error', error: msg });
      }
      rerender();
    }
    s.results = results; s.isCreating = false;
    const ok = results.filter((r) => r.status === 'success').length;
    if (ok === results.length) host.notify('success', `${ok} purchase order${plural(ok)} created successfully`);
    else if (ok > 0) host.notify('success', `${ok} of ${results.length} orders created`);
    rerender();
  }

  // ── Markup ──
  function dropdownTrigger(key, supplierId, label = 'Select supplier…', showIcon = false) {
    const sel = s.suppliers.find((x) => x._id === supplierId);
    const open = s.dropdown?.key === key;
    return `<div class="relative flex items-center gap-1" data-mpo-trigger="${esc(key)}"><button type="button" class="flex-1 flex items-center justify-between h-8 px-2.5 text-sm border rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-green-500/40 ${sel ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800/50 dark:bg-green-900/20 dark:text-green-300' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500'}" data-mpo="toggle" data-k="${esc(key)}">`
      + (showIcon ? lucide('Building2', { cls: 'w-3.5 h-3.5 flex-shrink-0 mr-1' }) : '')
      + `<span class="truncate text-left text-xs font-medium flex-1">${esc(sel ? sel.name : label)}</span>${lucide('ChevronDown', { cls: `w-3.5 h-3.5 flex-shrink-0 ml-1 transition-transform duration-150${open ? ' rotate-180' : ''}` })}</button>`
      + (sel ? `<button type="button" class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors" title="Clear supplier" data-mpo="clear" data-k="${esc(key)}">${lucide('X', { cls: 'w-3 h-3' })}</button>` : '')
      + '</div>';
  }
  function dropdownPanel() {
    const d = s.dropdown;
    if (!d) return '';
    const current = d.key === '__bulk__' ? s.bulkSupplierId : s.assignments[d.key.split('|')[0]]?.supplierId;
    const list = s.suppliers.filter((x) => (x.name || '').toLowerCase().includes(d.search.toLowerCase()));
    const rows = s.loadingSuppliers ? `<div class="flex items-center justify-center py-5">${lucide('Loader2', { cls: 'w-4 h-4 animate-spin text-gray-400' })}</div>`
      : list.length === 0 ? '<p class="text-xs text-gray-400 text-center py-4">No suppliers found</p>'
        : list.map((x) => {
          const on = current === x._id; const c = chip(x);
          return `<button type="button" class="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${on ? 'bg-green-50 dark:bg-green-900/20' : ''}" data-mpo="pick" data-id="${esc(x._id)}" data-key="s:${esc(x._id)}">`
            + (on ? lucide('Check', { cls: 'w-3 h-3 text-green-600 flex-shrink-0' }) : '')
            + `<span class="flex-1 font-medium text-gray-800 dark:text-white truncate ${on ? '' : 'ml-4'}">${esc(x.name)}</span><span class="flex-shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${c.classes}">${c.shortLabel}</span></button>`;
        }).join('');
    return `<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden" style="position: absolute; top: ${d.top}px; left: ${d.left}px; width: ${d.width}px; z-index: 200;" data-mpo-dropdown>`
      + `<div class="p-2 border-b border-gray-100 dark:border-gray-700"><div class="relative"><input type="text" placeholder="Search suppliers…" class="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500" value="${esc(d.search)}" data-mpo-search>${lucide('Search', { cls: 'absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none z-10' })}</div></div>`
      + `<div class="overflow-y-auto" style="max-height: 108px;">${rows}</div>`
      + `<div class="border-t border-gray-100 dark:border-gray-700 p-1.5"><button type="button" class="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-green-700 dark:text-green-400 font-medium hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors" data-mpo="add-supplier">${lucide('Plus', { cls: 'w-3 h-3' })}Add new supplier</button></div></div>`;
  }
  function steps() {
    const list = [{ key: ASSIGN, label: 'Assign Suppliers', num: 1 }, { key: REVIEW, label: 'Review &amp; Create', num: 2 }];
    const cur = list.findIndex((x) => x.key === s.step);
    return '<div class="flex items-center gap-2 px-6 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/60">' + list.map((x, i) => {
      const done = cur > i; const active = cur === i;
      return `<div class="flex items-center gap-2"><div class="flex items-center gap-1.5"><div class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${done ? 'bg-green-500 text-white' : active ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}">${done ? lucide('Check', { cls: 'w-3 h-3' }) : x.num}</div>`
        + `<span class="text-sm font-medium ${active ? 'text-green-700 dark:text-green-400' : done ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'}">${x.label}</span></div>`
        + (i < list.length - 1 ? lucide('ChevronRight', { cls: 'w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0' }) : '') + '</div>';
    }).join('') + '</div>';
  }
  function badges(m, cov, wrap) {
    const nw = wrap ? ' whitespace-nowrap' : '';
    const c = cov[m.id];
    return `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-[10px] font-semibold text-red-600 dark:text-red-400${nw}">↓ ${T}${esc(m.shortage)}${T} ${T}${esc(m.unit)}${T} short</span>`
      + `<span class="text-[10px] text-gray-400${nw}">Stock: ${T}${esc(m.availableStock)}</span>`
      + (c ? (c.loading ? `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-[10px] text-blue-500 dark:text-blue-400${nw}">${lucide('Loader2', { cls: 'w-2.5 h-2.5 animate-spin' })} Checking...</span>`
        : !c.supplied ? `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/20 text-[10px] font-semibold text-amber-700 dark:text-amber-400${nw}">⚠ Not supplied by this supplier</span>` : '') : '');
  }
  function assignStep(items, gs) {
    const cov = coverage();
    const sufficient = s.materials.length - items.length;
    const assignedCount = items.filter((m) => s.assignments[m.id]?.supplierId).length;
    const unassigned = items.length - assignedCount;
    let out = '<div class="p-6 space-y-5"><div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div class="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg self-start">'
      + [[SHORTAGE, 'Shortage qty'], [REQUIRED, 'Total required']].map(([k, l]) => `<button class="px-3 py-1.5 text-xs font-medium rounded-md transition-all ${s.qtyMode === k ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}" data-mpo="mode" data-mode="${k}">${l}</button>`).join('')
      + `</div><div class="self-start sm:self-auto">${dropdownTrigger('__bulk__', s.bulkSupplierId, 'Quick assign all →', true)}</div></div>`;
    if (sufficient > 0) out += `<div class="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg">${lucide('CheckCircle2', { cls: 'w-3.5 h-3.5 text-green-500 flex-shrink-0' })}<p class="text-xs text-green-700 dark:text-green-400"><span class="font-semibold">${sufficient}${T} material${sufficient !== 1 ? `${T}s` : ''}</span>${T} ${T}have sufficient stock and are excluded.</p></div>`;
    if (items.length === 0) {
      out += `<div class="flex flex-col items-center text-center py-10"><div class="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-3">${lucide('CheckCircle2', { cls: 'w-7 h-7 text-green-500' })}</div><p class="text-sm font-semibold text-gray-700 dark:text-gray-300">All materials are sufficiently stocked</p><p class="text-xs text-gray-400 mt-1">No purchase orders needed right now.</p></div>`;
    } else {
      const head = (t, extra) => `<div class="col-span-${extra[0]} text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide${extra[1]}">${t}</div>`;
      out += '<div class="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800/50 overflow-hidden"><div class="hidden sm:grid sm:grid-cols-12 gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">'
        + head('Raw Material', [4, '']) + head('Order Qty', [2, ' text-center']) + head('Unit Price', [2, ' text-center']) + head('Supplier', [4, ' pl-2'])
        + '</div><div class="divide-y divide-gray-100 dark:divide-gray-700/60">';
      items.forEach((m, idx) => {
        const a = s.assignments[m.id] || {};
        const assigned = Boolean(a.supplierId);
        const check = assigned ? lucide('Check', { cls: 'w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5' }) : '';
        out += `<div class="transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-700/30 ${assigned ? 'bg-green-50/40 dark:bg-green-900/10' : ''} ${idx === items.length - 1 ? 'rounded-b-xl' : ''}" data-key="${esc(m.id)}">`
          + '<div class="hidden sm:grid sm:grid-cols-12 gap-2 px-4 py-3 items-center">'
          + `<div class="col-span-4"><div class="flex items-start gap-1.5">${check}<div class="min-w-0"><p class="text-sm font-medium text-gray-800 dark:text-gray-200 leading-tight truncate">${esc(m.name)}</p><div class="flex items-center gap-1.5 mt-0.5 flex-wrap">${badges(m, cov, true)}</div></div></div></div>`
          + `<div class="col-span-2"><div class="flex items-center gap-1.5"><input type="number" min="0" step="any" class="${INPUT} transition-all ${NO_SPIN}" value="${esc(a.qtyStr ?? '')}" data-mpo-qty="${esc(m.id)}"><span class="text-xs text-gray-400 font-medium flex-shrink-0 w-8 truncate">${esc(m.unit || '—')}</span></div></div>`
          + `<div class="col-span-2"><div class="flex items-center gap-1"><div class="relative flex-1 min-w-0"><span class="absolute left-1 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">${esc(host.currency)}</span><input type="number" min="0" step="any" class="${PRICE} transition-all ${NO_SPIN}" value="${esc(a.priceStr ?? '0')}" data-mpo-price="${esc(m.id)}"></div><span class="text-xs text-gray-400 font-medium flex-shrink-0 w-8 truncate">${esc(m.unit || '—')}</span></div></div>`
          + `<div class="col-span-4">${dropdownTrigger(`${m.id}|d`, a.supplierId || '')}</div></div>`
          + '<div class="sm:hidden px-4 py-3 space-y-2.5">'
          + `<div class="flex items-start gap-1.5">${check}<div class="min-w-0 flex-1"><p class="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">${esc(m.name)}</p><div class="flex items-center gap-1.5 mt-0.5 flex-wrap">${badges(m, cov, false)}</div></div></div>`
          + '<div class="grid grid-cols-2 gap-2">'
          + `<div><label class="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Order Qty</label><div class="flex items-center gap-1"><input type="number" min="0" step="any" class="${INPUT} ${NO_SPIN}" value="${esc(a.qtyStr ?? '')}" data-mpo-qty="${esc(m.id)}"><span class="text-xs text-gray-400 font-medium flex-shrink-0">${esc(m.unit || '—')}</span></div></div>`
          + `<div><label class="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Unit Price</label><div class="flex items-center gap-1"><div class="relative flex-1 min-w-0"><span class="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">${esc(host.currency)}</span><input type="number" min="0" step="any" class="${PRICE} ${NO_SPIN}" value="${esc(a.priceStr ?? '0')}" data-mpo-price="${esc(m.id)}"></div><span class="text-xs text-gray-400 font-medium flex-shrink-0">${esc(m.unit || '—')}</span></div></div>`
          + '</div>'
          + `<div><label class="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Supplier</label>${dropdownTrigger(`${m.id}|m`, a.supplierId || '')}</div>`
          + '</div></div>';
      });
      out += '</div></div>';
    }
    if (unassigned > 0 && items.length > 0) {
      out += `<div class="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">${lucide('AlertCircle', { cls: 'w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5' })}<p class="text-xs text-amber-700 dark:text-amber-400"><span class="font-semibold">${unassigned}${T} material${unassigned !== 1 ? `${T}s` : ''}</span>${T} ${T}${unassigned !== 1 ? 'have' : 'has'}${T} no supplier assigned and will be skipped.</p></div>`;
    }
    if (!s.loadingSuppliers && s.suppliers.length === 0) {
      out += `<div class="flex items-start gap-2.5 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl">${lucide('AlertCircle', { cls: 'w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5' })}<div class="text-xs text-blue-700 dark:text-blue-400"><p class="font-semibold mb-0.5">No suppliers found</p><p>Use${T} <button type="button" class="underline font-medium" data-mpo="add-supplier-bulk">Add new supplier</button>${T} ${T}to create your first supplier.</p></div></div>`;
    }
    return `${out}</div>`;
  }
  function reviewStep(gs, unassigned) {
    let out = '<div class="p-6 space-y-4"><p class="text-sm text-gray-500 dark:text-gray-400">Review the purchase orders below. One order will be created per supplier.</p>';
    for (const g of gs) {
      const c = chip(g.supplier);
      out += `<div class="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden" data-key="${esc(g.supplier._id)}"><div class="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"><div class="flex items-center gap-2.5">${lucide('Building2', { cls: 'w-4 h-4 text-gray-400' })}<span class="font-semibold text-gray-900 dark:text-white text-sm">${esc(g.supplier.name)}</span><span class="text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.classes}">${c.label}</span></div>`
        + `<span class="text-xs text-gray-400 dark:text-gray-500">${g.items.length}${T} item${g.items.length !== 1 ? `${T}s` : ''}</span></div><div class="divide-y divide-gray-100 dark:divide-gray-700/60">`
        + g.items.map((m) => `<div class="grid grid-cols-12 gap-2 px-4 py-2.5 text-sm items-center"><span class="col-span-4 text-gray-700 dark:text-gray-300 truncate">${esc(m.name)}</span>`
          + `<span class="col-span-3 text-right font-semibold text-gray-900 dark:text-white tabular-nums">${esc(m.orderedQty)}${T} <span class="text-xs font-normal text-gray-400">${esc(m.unit)}</span></span>`
          + `<span class="col-span-2 text-right text-gray-500 dark:text-gray-400 tabular-nums">${esc(host.currency)}${T}${host.MONEY_SPACE}${T}${Number(m.orderedPrice || 0).toFixed(2)}${m.unit ? `<span class="text-xs font-normal text-gray-400">/${T}${esc(m.unit)}</span>` : ''}</span>`
          + `<span class="col-span-3 text-right font-semibold text-gray-900 dark:text-white tabular-nums">${esc(host.currency)}${T}${host.MONEY_SPACE}${T}${(Number(m.orderedQty || 0) * Number(m.orderedPrice || 0)).toFixed(2)}</span></div>`).join('')
        + `<div class="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-400"><span>Order Total</span><span class="text-gray-900 dark:text-white tabular-nums">${esc(host.currency)}${T}${host.MONEY_SPACE}${T}${g.items.reduce((t, m) => t + Number(m.orderedQty || 0) * Number(m.orderedPrice || 0), 0).toFixed(2)}</span></div></div></div>`;
    }
    if (unassigned > 0) out += `<div class="flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">${lucide('AlertCircle', { cls: 'w-3.5 h-3.5 text-gray-400 flex-shrink-0' })}<p class="text-xs text-gray-500 dark:text-gray-400">${unassigned}${T} material${unassigned !== 1 ? `${T}s` : ''}${T} without a supplier will be skipped.</p></div>`;
    return `${out}</div>`;
  }
  function resultStep() {
    let out = '<div class="p-6 space-y-4">';
    if (s.isCreating) {
      out += '<p class="text-sm text-gray-500 dark:text-gray-400">Creating orders — please wait…</p><div class="space-y-2.5">' + s.progress.map((p) => {
        const tone = p.status === 'done' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50' : p.status === 'error' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50' : p.status === 'creating' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
        const icon = p.status === 'pending' ? '<div class="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600"></div>' : p.status === 'creating' ? lucide('Loader2', { cls: 'w-4 h-4 animate-spin text-blue-500' }) : p.status === 'done' ? lucide('CheckCircle2', { cls: 'w-4 h-4 text-green-500' }) : lucide('AlertCircle', { cls: 'w-4 h-4 text-red-500' });
        return `<div class="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300 ${tone}"><div class="w-5 h-5 flex items-center justify-center flex-shrink-0">${icon}</div><span class="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">${esc(p.supplierName)}</span>`
          + (p.status === 'creating' ? '<span class="text-xs text-blue-500">Creating…</span>' : p.status === 'done' ? '<span class="text-xs text-green-600 font-medium">Created ✓</span>' : p.status === 'error' ? `<span class="text-xs text-red-600 truncate max-w-32">${esc(p.message)}</span>` : '') + '</div>';
      }).join('') + '</div>';
    } else if (s.results.length > 0) {
      const ok = s.results.filter((r) => r.status === 'success').length;
      const hero = (tone, icon, title, text) => `<div class="flex flex-col items-center text-center py-4"><div class="w-16 h-16 bg-${tone}-100 dark:bg-${tone}-900/30 rounded-full flex items-center justify-center mb-3">${icon}</div><h3 class="text-lg font-semibold text-gray-900 dark:text-white">${title}</h3><p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${text}</p></div>`;
      if (ok === s.results.length) out += hero('green', lucide('CheckCircle2', { cls: 'w-9 h-9 text-green-600' }), 'All orders created!', `${s.results.length}${T} purchase order${s.results.length !== 1 ? `${T}s` : ''}${T} placed successfully.`);
      else if (ok === 0) out += hero('red', lucide('AlertCircle', { cls: 'w-9 h-9 text-red-500' }), 'All orders failed', 'Please check the errors below and try again.');
      else out += hero('amber', lucide('AlertCircle', { cls: 'w-9 h-9 text-amber-500' }), 'Partial success', `${ok}${T} ${T}of ${T}${s.results.length}${T} orders placed.`);
      out += '<div class="space-y-2">' + s.results.map((r) => `<div class="flex items-center gap-3 px-4 py-3 rounded-xl border ${r.status === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/40' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40'}">`
        + (r.status === 'success' ? lucide('CheckCircle2', { cls: 'w-4 h-4 text-green-500 flex-shrink-0' }) : lucide('AlertCircle', { cls: 'w-4 h-4 text-red-500 flex-shrink-0' }))
        + `<span class="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">${esc(r.supplier)}</span>`
        + (r.status === 'success' ? `<span class="text-xs text-green-600 font-semibold">${r.itemCount}${T} item${r.itemCount !== 1 ? `${T}s` : ''}${T} ✓</span>` : `<span class="text-xs text-red-600 truncate max-w-40">${esc(r.error)}</span>`)
        + '</div>').join('') + '</div>';
    }
    return `${out}</div>`;
  }

  function render() {
    if (!s) return '<!--materials-po-->';
    const items = shortageItems();
    const gs = groups();
    const assignedCount = items.filter((m) => s.assignments[m.id]?.supplierId).length;
    const unassigned = items.length - assignedCount;
    const sub = s.step === ASSIGN ? `${items.length} item${items.length !== 1 ? 's' : ''} with shortage · ${assignedCount} assigned`
      : s.step === REVIEW ? `${gs.length} purchase order${gs.length !== 1 ? 's' : ''} ready to create`
        : s.isCreating ? 'Creating purchase orders…' : 'Done';
    const btn = 'inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm';
    const cancel = '<button class="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" data-mpo="close">Cancel</button>';
    let footer = '';
    if (s.step === ASSIGN) {
      footer = `<div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0"><div class="text-xs text-gray-400 dark:text-gray-500">`
        + (assignedCount > 0 ? `<span><span class="font-semibold text-gray-700 dark:text-gray-300">${gs.length}</span>${T} ${T}PO${gs.length !== 1 ? `${T}s` : ''}${T} will be created</span>` : 'Assign a supplier to continue')
        + `</div><div class="flex items-center gap-3">${cancel}<button${gs.length === 0 ? ' disabled=""' : ''} class="${btn}" data-mpo="review">Review ${T}${gs.length > 0 ? `${gs.length}${T}` : ''} order${gs.length !== 1 ? `${T}s` : ''}${lucide('ChevronRight', { cls: 'w-4 h-4' })}</button></div></div>`;
    } else if (s.step === REVIEW) {
      footer = `<div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0"><button class="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors" data-mpo="back">${lucide('ArrowLeft', { cls: 'w-4 h-4' })}Back</button>`
        + `<div class="flex items-center gap-3">${cancel}<button${gs.length === 0 ? ' disabled=""' : ''} class="${btn}" data-mpo="create">${lucide('ShoppingCart', { cls: 'w-4 h-4' })}Create ${T}${gs.length}${T} order${gs.length !== 1 ? `${T}s` : ''}</button></div></div>`;
    } else if (!s.isCreating) {
      footer = '<div class="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0"><button class="px-5 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-sm" data-mpo="close">Done</button></div>';
    }
    return '<div class="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" style="animation: 150ms ease 0s 1 normal none running fadeIn;"></div>'
      + '<div class="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"><div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col pointer-events-auto overflow-hidden relative" style="animation: 150ms ease 0s 1 normal none running scaleIn;" data-mpo-panel>'
      + `<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"><div class="flex items-center gap-3"><div class="p-2 bg-green-50 dark:bg-green-900/20 rounded-xl">${lucide('ShoppingCart', { cls: 'w-5 h-5 text-green-600 dark:text-green-400' })}</div><div><h2 class="text-lg font-semibold text-gray-900 dark:text-white leading-tight">Create Raw Material Requests</h2><p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${esc(sub)}</p></div></div>`
      + (!s.isCreating ? `<button class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700/60 rounded-lg transition-colors" aria-label="Close" data-mpo="close">${lucide('X', { cls: 'w-5 h-5 text-gray-500 dark:text-gray-400' })}</button>` : '') + '</div>'
      + (s.step !== RESULT ? steps() : '')
      + `<div class="flex-1 overflow-y-auto">${s.step === ASSIGN ? assignStep(items, gs) : s.step === REVIEW ? reviewStep(gs, unassigned) : resultStep()}</div>`
      + footer + dropdownPanel() + '</div></div>'
      + '<style>\n        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }\n        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96) } to { opacity: 1; transform: scale(1) } }\n      </style>'
      + addSupplier.render();
  }

  function afterRender(root) {
    addSupplier.afterRender(root);
    if (s?.focusSearch) { s.focusSearch = false; setTimeout(() => root.querySelector('[data-mpo-search]')?.focus(), 50); }
  }

  // ── Events (routed from the drawer) ──
  /** SupplierDropdown.openDropdown: under the trigger, right-aligned, kept inside the panel; above it when short of room. */
  function openDropdown(trigger, key) {
    const panel = trigger.closest('[data-mpo-panel]');
    const t = trigger.getBoundingClientRect(); const c = panel.getBoundingClientRect();
    const relTop = t.bottom - c.top; const W = 240; const pad = 8;
    let left = (t.right - c.left) - W;
    if (left < pad) left = pad;
    if (left + W > c.width - pad) left = c.width - W - pad;
    const dropH = 215;
    const top = c.height - relTop < dropH && relTop > dropH ? relTop - t.height - dropH - 4 : relTop + 4;
    s.dropdown = { key, top, left, width: W, search: '' };
    s.focusSearch = true;
  }
  function handleMouseDown(e) {
    if (!s) return false;
    if (addSupplier.handleMouseDown(e)) return true;
    // The open dropdown closes on any press outside its own trigger (its panel stops the press).
    if (s.dropdown && !e.target.closest('[data-mpo-dropdown]') && e.target.closest('[data-mpo-trigger]')?.dataset.mpoTrigger !== s.dropdown.key) { s.dropdown = null; rerender(); }
    return false;
  }
  function handleClick(e) {
    if (!s) return false;
    if (addSupplier.isOpen() && addSupplier.handleClick(e)) return true;
    const b = e.target.closest('[data-mpo]');
    if (!b) return Boolean(e.target.closest('[data-mpo-panel]'));
    const key = b.dataset.k;
    switch (b.dataset.mpo) {
      case 'close': close(); break;
      case 'mode': setQtyMode(b.dataset.mode); break;
      case 'toggle':
        if (s.dropdown?.key === key) s.dropdown = null; else openDropdown(b.closest('[data-mpo-trigger]'), key);
        break;
      case 'clear': {
        e.stopPropagation();
        if (key === '__bulk__') { s.bulkSupplierId = ''; for (const m of shortageItems()) s.assignments[m.id] = { ...s.assignments[m.id], supplierId: '' }; } else clearSupplier(key.split('|')[0]);
        break;
      }
      case 'pick': {
        const k = s.dropdown?.key; s.dropdown = null;
        if (k === '__bulk__') bulkAssign(b.dataset.id); else if (k) setSupplier(k.split('|')[0], b.dataset.id);
        break;
      }
      case 'add-supplier': { const k = s.dropdown?.key; s.dropdown = null; s.pendingMaterial = k && k !== '__bulk__' ? k.split('|')[0] : null; addSupplier.open(); break; }
      case 'add-supplier-bulk': s.pendingMaterial = null; addSupplier.open(); break;
      case 'review': s.step = REVIEW; break;
      case 'back': s.step = ASSIGN; break;
      case 'create': create(); return true;
      default: return true;
    }
    rerender();
    return true;
  }
  function handleInput(e) {
    if (!s) return false;
    if (addSupplier.isOpen() && addSupplier.handleInput(e)) return true;
    const el = e.target;
    if (el.matches('[data-mpo-search]') && s.dropdown) { s.dropdown.search = el.value; rerender(); return true; }
    if (el.matches('[data-mpo-qty]')) { const id = el.dataset.mpoQty; s.assignments[id] = { ...s.assignments[id], qtyStr: el.value, qty: parseFloat(el.value) || 0 }; rerender(); return true; }
    if (el.matches('[data-mpo-price]')) { const id = el.dataset.mpoPrice; s.assignments[id] = { ...s.assignments[id], priceStr: el.value, price: parseFloat(el.value) || 0 }; rerender(); return true; }
    return false;
  }
  function handleFocusIn(e) {
    // The price box selects its text on focus (its own onFocus, on top of the host's).
    if (s && e.target.matches?.('[data-mpo-price]')) e.target.select();
  }
  function handleFocusOut(e) {
    if (!s) return;
    if (addSupplier.isOpen()) addSupplier.handleFocusOut(e);
    const el = e.target;
    if (el.matches?.('[data-mpo-price]') && el.value === '') { const id = el.dataset.mpoPrice; s.assignments[id] = { ...s.assignments[id], priceStr: '0', price: 0 }; rerender(); }
  }
  function handleKeydown(e) { return Boolean(s && addSupplier.isOpen() && addSupplier.handleKeydown(e)); }

  return { open, close, isOpen, render, afterRender, handleMouseDown, handleClick, handleInput, handleFocusIn, handleFocusOut, handleKeydown };
}

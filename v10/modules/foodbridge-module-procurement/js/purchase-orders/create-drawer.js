/*
  Create Purchase Order: the MainDrawer holding BulkOrderContext + CreateOrderDrawer (+ its phone
  twin MobileOrderProductPanel) and the review cart (order-cart.js).

  Model, as production keeps it:
    catalogue      the caller's own priced inventory (GET /productlist); for an INTERNAL supplier
                   that location's catalogue first, then the caller's own products it does not
                   carry, marked "Not supplied by this supplier"
    quantities     committed per `${productId}-${customerId}`; the inputs show `tempQuantities`,
                   committed 120ms after the last keystroke
    prices         shown tax-inclusive per ORDERING unit, resolved from the product's price maps;
                   an edited price is stored tax-exclusive and patched into its offerPriceMap
  The drawer's counterparty is a SUPPLIER; `selectedCustomers[0]` is the signed-in user.
*/
import { esc } from '../components/dom.js';
import { fi, lucide } from '../components/icons.js';
import { createMainDrawer } from '../components/drawer.js';
import { discardChangesModal } from '../components/modal.js';
import { displayImage } from '../components/windmill.js';
import { aiLoader, spinner } from '../components/ai-loader.js';
import { createOrderCart } from './order-cart.js';
import { createAddSupplierModal } from './add-supplier-modal.js';
import { createAddItemModal } from './add-item-modal.js';

const T = '<!---->';
const NB = ' '; // MONEY_SPACE
const PAGE_SIZE = 20;
const PURCHASE_ORDER_KEY = '__purchase_order__';

/** utils/supplierType.getSupplierTypeChip */
export function supplierChip(s) {
  if (s?._sourceType === 'internalSupplier') return { label: 'Internal', classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 ring-1 ring-blue-200' };
  if (s?.supplierType === 'DEPARTMENT') return { label: 'Department', classes: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 ring-1 ring-purple-200' };
  return { label: 'External', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-1 ring-amber-200' };
}

/** utils/policyUtil.getProductPolicyDetails: the first policy template's detail. */
export const policyOf = (product) => (product?.policyTemplate ? product.policyTemplate[0]?.templateDetail : null);
/** utils/policyUtil.formatPolicyDuration, auto-detecting the unit (no saved unit passed). */
export function policyDuration(seconds) {
  if (!seconds) return 'N/A';
  const days = Math.floor(seconds / 86400); const months = Math.floor(days / 30); const years = Math.floor(days / 365);
  if (years >= 1) return years === 1 ? '1 year' : `${years} years`;
  if (months >= 1) return months === 1 ? '1 month' : `${months} months`;
  return days === 1 ? '1 day' : `${days} days`;
}

/** utils/taxUtil.getProductTaxLabel(tax, { mode: "incl" }) */
export function taxLabel(tax) {
  const n = (v) => { const x = Number(typeof v === 'string' ? v.replace('%', '').trim() : v ?? 0); return Number.isFinite(x) ? x : 0; };
  let t = 0;
  if (Array.isArray(tax)) { for (const c of tax) if (n(c) > 0) { t = n(c); break; } } else if (tax && n(tax) > 0) t = n(tax);
  return t === 0 ? '0% tax' : `${t}% incl. tax`;
}

// BulkOrderContext: the catalogue helpers it runs over the API's category tree.
const isReturnable = (name) => ['returnable', 'returnables'].includes(String(name || '').trim().toLowerCase());
function mergeIntoMap(map, apiProducts) {
  for (const category of apiProducts || []) {
    const catId = category.id || category._id;
    if (!map.has(catId)) { map.set(catId, { ...category, categories: category.categories || [] }); continue; }
    const existing = map.get(catId);
    const subs = new Map((existing.categories || []).map((s) => [s.id || s._id, s]));
    for (const sub of category.categories || []) {
      const subId = sub.id || sub._id;
      if (!subs.has(subId)) { subs.set(subId, sub); continue; }
      const es = subs.get(subId);
      const prods = new Map((es.categories || []).map((p) => [p.id || p._id, p]));
      for (const p of sub.categories || []) if (!prods.has(p.id || p._id)) prods.set(p.id || p._id, p);
      es.categories = [...prods.values()];
    }
    existing.categories = [...subs.values()];
  }
}
/** convertCustomerCatalogueFormat: API tree → { _id, name, subCategories: [{ products }] }, Returnable dropped. */
const convertCatalogue = (api) => (api || []).filter((c) => !isReturnable(c?.name)).map((c) => ({
  _id: c.id || c._id, name: c.name,
  subCategories: (c.categories || []).map((s) => ({
    _id: s.id || s._id, name: s.name,
    products: (s.categories || []).map((p) => ({
      ...p, _id: p.id || p._id, name: p.name, price: p.price || p.offerPrice || 0, offerPrice: p.offerPrice || p.price || 0,
      measurement: p.unitPrice?.split('/')[1] || 'Kg', _customerCataloguePriceOnly: true,
    })),
  })),
}));
/** mergeUserAndSupplierCatalogues: the supplier's tree, then the caller's own products it lacks (disabled). */
function mergeUserAndSupplier(user, supplier) {
  const supplierArticles = new Set();
  for (const c of supplier) for (const s of c.subCategories || []) for (const p of s.products || []) if (p.articleNumber) supplierArticles.add(String(p.articleNumber).trim());
  const result = supplier.map((c) => ({ ...c, subCategories: (c.subCategories || []).map((s) => ({ ...s, products: (s.products || []).map((p) => ({ ...p, _notSuppliedByThisSupplier: false })) })) }));
  const cats = new Map(result.map((c) => [String(c._id), c]));
  for (const c of user) for (const s of c.subCategories || []) for (const p of s.products || []) {
    const art = p.articleNumber ? String(p.articleNumber).trim() : null;
    if (art && supplierArticles.has(art)) continue;
    let tc = cats.get(String(c._id));
    if (!tc) { tc = { _id: c._id, name: c.name, subCategories: [] }; result.push(tc); cats.set(String(c._id), tc); }
    let ts = tc.subCategories.find((x) => String(x._id) === String(s._id));
    if (!ts) { ts = { _id: s._id, name: s.name, products: [] }; tc.subCategories.push(ts); }
    ts.products.push({ ...p, _notSuppliedByThisSupplier: true });
  }
  return result;
}
const productIds = (p) => [p?._id, p?.id, p?.productId, p?.articleNumber, p?.articleNo, p?.product?._id, p?.product?.id, p?.product?.productId, p?.product?.articleNumber, p?.product?.articleNo].filter(Boolean).map(String);
const customerIds = (c) => [c?._id, c?.id, c?.orgId, c?.organizationId, c?.userInfo?.org?._id, c?.userInfo?.org?.id].filter(Boolean).map(String);

export function createOrderDrawer(host, server, { onClosed }) {
  const currency = host.currency;
  const ordersLabel = host.menuLabel('orders');
  const t = (s) => host.toTitleCase(s);
  const appProp = host.appProp;
  const supportedUnitIndexLevel = appProp.supportedUnitIndexLevel;
  const isInventoryPriceEnabled = appProp.sourcingOrderManagementFeature?.inventoryPrice === true;
  const isPalletCalculationEnabled = appProp.isPalletCalculationEnabled === true;
  // Read as production reads it. Tenant configs and the host's setup key map both spell the flag
  // `qrCodeScanerEnabled`, so this is always false and the scan button never renders (a production
  // defect, reproduced: README). Its BarcodeScannerModal is unreachable, so it is not ported.
  const qrCodeScannerEnabled = appProp.productManagementFeatures?.qrCodeScannerEnabled || false;
  const showAlertForOversell = !host.allowOversell() || host.getShowAlertForOversell();
  const shouldClampQuantityToStock = false; // adminFlow && checkStockForOrder — adminFlow is pinned false

  let st = null;
  let pendingResolve = null;
  let searchTimer = null;
  const qtyTimers = new Map();
  let observer = null;
  const drawer = createMainDrawer({ onClose: () => close() });
  const addSupplier = createAddSupplierModal(host, { rerender: () => render(), onSave: (data) => saveNewSupplier(data) });
  const addItem = createAddItemModal(host, server, { rerender: () => render(), onCreated: (articleNo, type) => handleNewItemCreated(articleNo, type) });
  let pendingNewItemArticleNo = null;
  const cart = createOrderCart(host, {
    rerender: () => render(),
    props: () => cartProps(),
  });

  // ── BulkOrderContext ──────────────────────────────────────────────────────────────────────
  const customerId = () => st.selectedCustomers[0]?._id || PURCHASE_ORDER_KEY;
  const getQuantity = (id, cid) => st.quantities[`${id}-${cid}`] || 0;
  /** getProductPrice: an edited price, else nothing — no org price map and no master match here. */
  function getProductPrice(product, distributorId) {
    const custom = productIds(product).find((id) => st.customPrices[`${id}-${distributorId}`] !== undefined);
    if (custom) return [Number(st.customPrices[`${custom}-${distributorId}`]) || 0, product?.measurement || '', true];
    // orgProductPriceMap is empty (the DEFAULT catalogue names no organisations) and the master
    // lookup walks `subCategories` of a tree that only has `categories` — so a catalogue product
    // (_customerCataloguePriceOnly) falls to 0.
    const price = product?._customerCataloguePriceOnly ? 0 : Number(product?.price) || 0;
    const offer = product?._customerCataloguePriceOnly ? 0 : Number(product?.offerPrice ?? product?.price) || 0;
    return [offer || price, product?.measurement || ''];
  }
  const strip = (p) => ({ ...p, priceMap: undefined, offerPriceMap: undefined, prices: p?.prices ? { ...p.prices, priceMap: undefined } : p?.prices });
  function getProductPricePerOrderingUnit(product, distributorId, idx = null) {
    const [price] = getProductPrice(product, distributorId);
    const unitIdx = idx !== null ? idx : (appProp.priceCalculationUnitIndex ?? 1);
    return [Number(host.calculateItemPrice({ ...strip(product), offerPrice: price, qty: 1, priceCalculationUnitIndex: unitIdx })) || 0];
  }
  function updateCustomPrice(productId, cid, orderingUnitPrice, unitLabel, override) {
    const matches = (p) => (p?._id || p?.id || p?.productId || '') === productId;
    let product = override && matches(override) ? override : st.selectedProducts.find(matches);
    if (!product) for (const c of st.catalogue) for (const s of c.subCategories || []) { const f = (s.products || []).find(matches); if (f && !product) product = f; }
    if (!product) { host.notify('error', 'Unable to update price for this product. Please refresh and try again.'); return; }
    if (!product) { host.notify('error', 'Unable to update price for this product. Please refresh and try again.'); return; }
    const boxes = product.boxes || 1;
    const pallets = product.pallets || 1;
    const tax = Number(product.tax) || 0;
    const multiplier = [1, boxes, boxes * pallets][appProp.priceCalculationUnitIndex ?? 1] || 1;
    const withoutTax = product.taxIncluded !== false && tax > 0 ? orderingUnitPrice / (1 + tax / 100) : orderingUnitPrice;
    const aliases = productIds(product);
    if (!aliases.includes(String(productId))) aliases.push(String(productId));
    const sel = st.selectedCustomers.find((c) => customerIds(c).includes(String(cid)));
    const cAliases = sel ? customerIds(sel) : [String(cid)];
    const next = { ...st.customPrices };
    for (const a of aliases) for (const c of cAliases) next[`${a}-${c}`] = Number(withoutTax / multiplier) || 0;
    st.customPrices = next;
    if (unitLabel) {
      const id = String(productId);
      const patch = (tree) => tree.map((c) => ({ ...c, subCategories: (c.subCategories || []).map((s) => ({ ...s, products: (s.products || []).map((p) => (productIds(p).includes(id) ? { ...p, offerPriceMap: { ...(p.offerPriceMap || {}), [unitLabel]: Number(withoutTax) || 0 } } : p)) })) }));
      st.catalogue = patch(st.catalogue);
      if (st.isRawMaterialMode) st.rawTree = patch(st.rawTree);
    }
  }
  /** getSingleCustomerCatalogue: own inventory; for an internal supplier, merged with theirs. */
  async function refreshProductsForSource(source) {
    st.catalogueLoading = true; render();
    try {
      const own = await server.getProductList();
      const ownRaw = own?.status && own?.data?.products ? own.data.products : [];
      if (!st) return;
      st.selectedCustomers = [{ ...(host.getUserInfo()?.userInfo || {}), _id: host.getUserInfo()?._id }];
      if (source?._sourceType === 'internalSupplier') {
        const theirs = await server.getProductList(source._id);
        const theirRaw = theirs?.status && theirs?.data?.products ? theirs.data.products : [];
        const um = new Map(); mergeIntoMap(um, ownRaw);
        const sm = new Map(); mergeIntoMap(sm, theirRaw);
        if (st) st.catalogue = mergeUserAndSupplier(convertCatalogue([...um.values()]), convertCatalogue([...sm.values()]));
      } else {
        const m = new Map(); mergeIntoMap(m, ownRaw);
        st.catalogue = convertCatalogue([...m.values()]);
      }
    } catch {
      host.notify('error', 'Failed to fetch customer-specific catalogue');
    } finally {
      if (st) { st.catalogueLoading = false; onCatalogueChange(); render(); }
    }
  }

  // ── Open / close ──────────────────────────────────────────────────────────────────────────
  function open({ sourceList = [], forecastSeed = null, seedKind = 'finished' } = {}) {
    const seedItems = (forecastSeed || []).filter((it) => it && (it.articleNumber || it.productId || it.productName));
    st = {
      // PurchaseForecastSeeder + the forced supplier gate (forceSupplierSelection).
      gateActive: Boolean(forecastSeed && forecastSeed.length), seed: forecastSeed && forecastSeed.length ? { items: forecastSeed, kind: seedKind, phase: seedItems.length ? 'awaiting' : 'done', sawLoading: false, timer: null } : null,
      forecastProductIds: [],
      sourceList, selectedSource: null, dropdownOpen: false, sourceSearch: '', showSupplierTooltip: false,
      selectedCustomers: [], catalogue: [], catalogueLoading: false, selectedProducts: [], quantities: {}, customPrices: {},
      productSearchInput: '', productSearch: '', isSearching: false, selectedSubcategory: '', expanded: new Set(), comment: '',
      isLoading: false, editingPrice: null, editingUnit: null, editingProduct: null, tempPrice: '', priceError: '', focusPrice: false,
      tempQuantities: {}, invalidQuantities: {}, selectedOrderingUnits: {}, openUnitDropdown: null, stockSummaryMap: {},
      visibleCount: PAGE_SIZE, idsKey: '', showDiscard: false, focusSourceSearch: false, hovering: false,
      isRawMaterialMode: false, rawTree: [], loadingRaw: false, lastCatalogue: null, refreshingAfterNewItem: false,
    };
    drawer.registerBeforeClose(async () => {
      if (!hasUnsavedChanges()) return true;
      return new Promise((resolve) => { pendingResolve = resolve; st.showDiscard = true; render(); });
    });
    render(true);
    // Mount: the catalogue (no supplier yet: own inventory) and the stock summary.
    server.getDefaultCatalogue().catch(() => null);
    refreshProductsForSource(null);
    server.getStockSummary().then((res) => {
      if (!st) return;
      const map = {};
      for (const p of res?.data?.products || []) if (p.articleNumber) map[p.articleNumber] = p;
      st.stockSummaryMap = map; render();
    }).catch(() => {});
  }

  function close() {
    for (const tm of qtyTimers.values()) clearTimeout(tm);
    qtyTimers.clear();
    clearTimeout(searchTimer);
    if (st?.seed?.timer) clearTimeout(st.seed.timer);
    observer?.disconnect();
    cart.reset();
    addSupplier.close();
    addItem.close();
    pendingNewItemArticleNo = null;
    drawer.destroy();
    st = null;
    pendingResolve = null;
    onClosed?.();
  }

  const hasUnsavedChanges = () => st.selectedCustomers.length > 0 && Object.values(st.quantities).some((q) => Number(q) > 0);

  // ── Derived ───────────────────────────────────────────────────────────────────────────────
  const activeCatalogue = () => { const c = st.isRawMaterialMode ? st.rawTree : st.catalogue; return Array.isArray(c) ? c : []; };
  /** The sidebar (and the phone's chips) hide empty subcategories and categories in raw-material mode. */
  const sidebarCatalogue = () => (!st.isRawMaterialMode ? activeCatalogue()
    : activeCatalogue().map((c) => ({ ...c, subCategories: (c.subCategories || []).filter((sub) => sub.products && sub.products.length > 0) })).filter((c) => c.subCategories.length > 0));
  const selectableSources = () => st.sourceList.filter((s) => s.supplierType !== 'DEPARTMENT');
  const isExternalPO = () => st.selectedSource?._sourceType === 'externalSupplier';
  const canEditPrice = () => isExternalPO();
  function filtered() {
    const q = st.productSearch.trim().toLowerCase();
    return activeCatalogue().map((c) => ({
      ...c,
      subCategories: (c.subCategories || [])
        .filter((s) => !st.selectedSubcategory || String(s._id) === String(st.selectedSubcategory))
        .map((s) => ({ ...s, products: (s.products || []).filter((p) => !q || p.name?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q)) }))
        .filter((s) => s.products?.length > 0),
    })).filter((c) => c.subCategories?.length > 0);
  }
  const flattened = () => filtered().flatMap((c) => c.subCategories.flatMap((s) => s.products.map((p) => ({ ...p, subName: s.name, subId: s._id, catId: c._id, categoryName: s.name, parentCategoryName: c.name }))));
  const productMap = () => {
    const m = new Map();
    for (const c of activeCatalogue()) for (const s of c.subCategories || []) for (const p of s.products || []) if (p?._id) m.set(p._id, p);
    return m;
  };
  const selectedSub = () => {
    for (const c of activeCatalogue()) { const s = c.subCategories?.find((x) => String(x._id) === String(st.selectedSubcategory)); if (s) return { sub: s, cat: c }; }
    return null;
  };
  /**
   * getEffectiveOrderingUnit: the unit picked for the row, else the tenant's priceCalculationUnitIndex
   * unit (0 secondary, 1 base, 2 pallet) — or the largest one the product has and the dropdown offers.
   */
  const effectiveUnit = (p) => {
    if (st.selectedOrderingUnits[p._id]) return st.selectedOrderingUnits[p._id];
    const parts = (p.measurement || '').split('-').filter((u) => u && u !== 'undefined');
    const max = Math.min(parts.length, supportedUnitIndexLevel == null ? parts.length : supportedUnitIndexLevel + 1) - 1;
    const idx = Math.max(0, Math.min(Number(appProp.priceCalculationUnitIndex) || 0, max));
    return parts[idx] || p.measurement || 'Unit';
  };
  function priceForUnit(p, cid, unit) {
    const resolved = host.resolvePriceFromPriceMap(p.priceMap, p.offerPriceMap, unit);
    if (resolved !== null) return resolved;
    const [withTax] = getProductPricePerOrderingUnit(p, cid, host.getUnitIndexForUnit(p, unit));
    const tax = Number(p.tax || 0);
    return tax > 0 ? Number(withTax) / (1 + tax / 100) : Number(withTax) || 0;
  }
  const unitPrice = (p, cid, unit) => host.roundPrice(priceForUnit(p, cid, unit) * (1 + Number(p.tax ?? 0) / 100));
  const unitOptions = (p) => {
    const raw = (p.unit || p.measurement || '').split('-').filter((u) => u && u !== 'undefined');
    return raw.slice(0, supportedUnitIndexLevel == null ? raw.length : supportedUnitIndexLevel + 1);
  };
  function cartItems() {
    const map = productMap();
    const cid = customerId();
    return st.selectedProducts.map((sp) => {
      const p = map.get(sp._id) || sp;
      const unit = effectiveUnit(sp);
      const ppu = unitPrice(p, cid, unit);
      const quantity = getQuantity(sp._id, cid);
      return {
        ...p, _id: p._id, name: p.name, brand: p.brand, unit: p.measurement || 'Unit', tax: p.tax, taxIncluded: p.taxIncluded !== false, stock: p.stock || 0,
        imageUrl: '', quantity, totalPrice: Number(ppu) * Number(quantity || 0), articleNumber: p.articleNumber || p.articleNo || '', orderingUnit: unit,
        pricePerOrderingUnit: Number(ppu), pallets: Number(p.pallets || 0),
      };
    });
  }
  function orderTotal() {
    const map = productMap();
    const cid = customerId();
    let total = 0;
    for (const [key, qty] of Object.entries(st.quantities)) {
      const [pid, c] = key.split('-');
      if (c !== cid || !(Number(qty) > 0)) continue;
      const p = map.get(pid);
      if (p) total += unitPrice(p, cid, effectiveUnit(p)) * Number(qty || 0);
    }
    return total;
  }
  function totalItemsLive() {
    const merged = { ...st.quantities, ...st.tempQuantities };
    let total = 0;
    for (const v of Object.values(merged)) { const n = Number(String(v ?? '').trim() || 0); if (!Number.isNaN(n) && n > 0) total += n; }
    return total;
  }

  // ── Quantities ────────────────────────────────────────────────────────────────────────────
  const normalizeDecimal = (raw) => {
    const s = String(raw ?? '');
    if (s.trim() === '') return '';
    let c = s.replace(/[^\d.]/g, '');
    if (c === '') return '';
    const dot = c.indexOf('.');
    if (dot !== -1) c = `${c.slice(0, dot).replace(/^0+(?=\d)/, '')}.${c.slice(dot + 1).replace(/\./g, '').slice(0, 2)}`;
    else c = c.replace(/^0+(?=\d)/, '');
    return c;
  };
  function updateSelected(product, qty) {
    if (qty > 0) { if (!st.selectedProducts.some((p) => p._id === product._id)) st.selectedProducts = [...st.selectedProducts, product]; return; }
    st.selectedProducts = st.selectedProducts.filter((p) => p._id !== product._id);
  }
  function commitQty(product, cleaned) {
    const key = `${product._id}-${customerId()}`;
    const trimmed = String(cleaned || '').trim();
    const dropInvalid = () => { const n = { ...st.invalidQuantities }; delete n[key]; st.invalidQuantities = n; };
    if (trimmed === '') { st.quantities = { ...st.quantities, [key]: 0 }; dropInvalid(); updateSelected(product, 0); return; }
    const num = Number(trimmed);
    if (Number.isFinite(num) && num >= 0 && /^\d*\.?\d{0,2}$/.test(trimmed)) { st.quantities = { ...st.quantities, [key]: num }; dropInvalid(); updateSelected(product, num); return; }
    st.invalidQuantities = { ...st.invalidQuantities, [key]: 'Quantity must be a valid number (up to 2 decimal places)' };
  }
  /** handleQtyChange: the input shows the cleaned value at once; the commit follows 120ms later. */
  function qtyChange(product, value) {
    const key = `${product._id}-${customerId()}`;
    const cleaned = normalizeDecimal(value);
    st.tempQuantities = { ...st.tempQuantities, [key]: cleaned };
    clearTimeout(qtyTimers.get(key));
    qtyTimers.set(key, setTimeout(() => { qtyTimers.delete(key); if (!st) return; commitQty(product, cleaned); render(); }, 120));
    render();
  }

  // ── Price editing ─────────────────────────────────────────────────────────────────────────
  function startEditPrice(pid, cid, current, unit, product) {
    st.editingPrice = `${pid}-${cid}`; st.editingUnit = unit || null; st.editingProduct = product;
    st.tempPrice = Number(current).toFixed(2); st.priceError = ''; st.focusPrice = true;
  }
  function validatePrice(value) {
    const v = value.trim();
    if (!v) return 'Price cannot be empty';
    if (!/^-?\d*\.?\d+$/.test(v)) return 'Please enter numbers only';
    const n = Number(v);
    if (Number.isNaN(n)) return 'Please enter a valid number';
    if (n < 0) return 'Price cannot be negative';
    return '';
  }
  function confirmPrice(pid, cid) {
    const err = validatePrice(st.tempPrice);
    if (err) { st.priceError = err; return; }
    updateCustomPrice(pid, cid, Number(st.tempPrice), st.editingUnit, st.editingProduct);
    cancelEdit();
  }
  function cancelEdit() { st.editingPrice = null; st.editingUnit = null; st.tempPrice = ''; st.priceError = ''; st.editingProduct = null; }

  // ── Source selection ──────────────────────────────────────────────────────────────────────
  function selectSource(item) {
    st.gateActive = false;
    st.selectedSource = item; st.dropdownOpen = false; st.sourceSearch = ''; st.selectedSubcategory = ''; st.showSupplierTooltip = false; st.hovering = false; st.isRawMaterialMode = false;
    if (item._sourceType === 'internalSupplier') {
      for (const tm of qtyTimers.values()) clearTimeout(tm);
      qtyTimers.clear();
      st.selectedProducts = []; st.quantities = {}; st.tempQuantities = {}; st.invalidQuantities = {};
    } else { st.tempQuantities = {}; st.invalidQuantities = {}; }
    refreshProductsForSource(item);
  }

  /** handleSaveNewSupplier: create it, select it (its catalogue loads), start the order afresh. */
  async function saveNewSupplier(formData) {
    try {
      const res = await server.createSupplier(formData);
      if (!st) return;
      if (!res?.status) { host.notify('error', res?.message || 'Failed to create supplier'); return; }
      const saved = { ...formData, _id: res.data?._id || res.data?.id, _sourceType: 'externalSupplier' };
      st.sourceList = [...st.sourceList, saved];
      st.selectedSource = saved; st.gateActive = false; st.dropdownOpen = false; st.sourceSearch = '';
      st.selectedProducts = []; st.quantities = {}; st.tempQuantities = {}; st.invalidQuantities = {}; st.hovering = false; st.showSupplierTooltip = false;
      host.notify('success', 'Supplier created successfully');
      refreshProductsForSource(saved);
    } catch (err) {
      host.notify('error', err?.response?.data?.message || err?.message || 'Failed to create supplier');
    }
  }

  // ── PurchaseForecastSeeder ────────────────────────────────────────────────────────────────
  // Runs like the component's effect: once a supplier is chosen and its catalogue has loaded,
  // match the forecast rows (article number, then id, then name), make them the cart — replacing
  // it, as setQuantitiesByOrderData does — pin them to the top of the list, and say what happened.
  const norm = (v) => (v == null ? '' : String(v).trim().toLowerCase());
  function runSeeder() {
    const seed = st.seed;
    if (!seed || seed.phase !== 'awaiting' || !st.selectedSource) return;
    const finish = () => { seed.phase = 'done'; if (seed.timer) clearTimeout(seed.timer); };
    if (!seed.timer) {
      seed.timer = setTimeout(() => {
        if (st?.seed === seed && seed.phase === 'awaiting') { host.notify('error', 'The catalogue took too long to load. Add the forecasted items manually.'); finish(); }
      }, 20000);
    }
    if (st.catalogueLoading) { seed.sawLoading = true; return; }
    // v7: raw-material rows from the forecast's Raw Material tab match against the RAW-MATERIAL
    // catalogue, which the drawer switches to (as its Raw Material toggle does).
    if (seed.kind === 'raw') {
      if (!st.isRawMaterialMode) { st.isRawMaterialMode = true; st.selectedSubcategory = ''; }
      if (!st.rawTree.length && !st.loadingRaw) {
        st.loadingRaw = true;
        fetchRawMaterialTree().then((tree) => { if (st) st.rawTree = tree; })
          .catch(() => host.notify('error', 'Failed to load raw material categories'))
          .finally(() => { if (st) { st.loadingRaw = false; render(); } });
      }
      if (st.loadingRaw) { seed.sawLoading = true; return; }
    }
    const flat = [];
    const walk = (arr) => (arr || []).forEach((n) => { if (Array.isArray(n?.products)) flat.push(...n.products); if (Array.isArray(n?.subCategories)) walk(n.subCategories); if (Array.isArray(n?.categories)) walk(n.categories); });
    walk(seed.kind === 'raw' ? st.rawTree : st.catalogue);
    if (!flat.length) {
      if (seed.sawLoading) { host.notify('error', 'No catalogue products to match against. Add the forecasted items manually.'); finish(); }
      return;
    }
    const uid = st.selectedCustomers[0]?._id;
    if (!uid) return;
    const byArticle = new Map(); const byId = new Map(); const byName = new Map();
    for (const p of flat) {
      const art = norm(p?.articleNumber || p?.articleNo);
      if (art && !byArticle.has(art)) byArticle.set(art, p);
      for (const id of [p?._id, p?.id, p?.productId].filter(Boolean)) if (!byId.has(norm(id))) byId.set(norm(id), p);
      const nm = norm(p?.name || p?.title);
      if (nm && !byName.has(nm)) byName.set(nm, p);
    }
    const matched = [];
    for (const it of seed.items) {
      const product = byArticle.get(norm(it.articleNumber)) || byId.get(norm(it.productId)) || byName.get(norm(it.productName));
      if (product) matched.push({ product, qty: it.requestedQty });
    }
    const dropped = seed.items.length - matched.length;
    if (!matched.length) { host.notify('error', "Couldn't match the forecasted items to your catalogue. Add them manually."); finish(); return; }
    st.selectedProducts = matched.map((m) => m.product);
    const q = {};
    for (const m of matched) q[`${m.product._id || m.product.id}-${uid}`] = Number(m.qty || 0) || 0;
    st.quantities = q;
    st.forecastProductIds = matched.map((m) => m.product._id || m.product.id);
    host.notify('success', `Added ${matched.length} item${matched.length === 1 ? '' : 's'} to the purchase${dropped ? ` (${dropped} skipped — not found in catalogue)` : ''}`);
    finish();
  }
  /** Forecast-seeded products first, the rest in catalogue order (a stable sort). */
  function prioritized(flat) {
    const pinned = new Set(st.forecastProductIds);
    if (!pinned.size) return flat;
    return [...flat].sort((a, b) => (pinned.has(a._id) ? 0 : 1) - (pinned.has(b._id) ? 0 : 1));
  }

  /** The forced supplier-selection gate: dims the drawer until a supplier is picked. */
  function gate() {
    if (!st.gateActive) return '';
    const list = selectableSources().filter((i) => (st.seed?.kind !== 'raw' || i._sourceType === 'externalSupplier') && (i.name || '').toLowerCase().includes(st.sourceSearch.toLowerCase()));
    return '<div class="absolute inset-0 z-40 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4"><div class="w-full max-w-xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">'
      + '<div class="px-5 py-4 border-b border-gray-100 dark:border-gray-700"><h3 class="text-base font-semibold text-gray-900 dark:text-white">Select a Supplier</h3><p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Choose who you\'re purchasing these items from to continue.</p></div>'
      // Its autoFocus fires at mount, and rc-drawer's own focus on open lands after it: the drawer
      // ends up holding focus, so the box opens unfocused.
      + `<div class="p-2 border-b border-gray-100 dark:border-gray-700"><div class="relative">${lucide('Search', { cls: 'absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none' })}<input type="text" placeholder="Search suppliers..." data-testid="create-order-gate-supplier-search-input" class="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" value="${esc(st.sourceSearch)}" data-co-source-search data-gate></div></div>`
      + '<div class="max-h-80 overflow-y-auto py-1 divide-y divide-gray-50 dark:divide-gray-700/50">'
      + list.map((i) => {
        const c = supplierChip(i);
        const phone = i.contact || i.phone || i.mobile || '';
        return `<div data-testid="create-order-gate-supplier-row-${esc(i._id)}" class="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"><div class="flex-1 min-w-0"><div class="flex items-center gap-2 min-w-0"><span class="font-medium text-gray-900 dark:text-white truncate">${esc(i.name)}</span><span class="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${c.classes}">${esc(c.label)}</span></div>`
          + (phone ? `<div class="flex items-center gap-1 mt-0.5 text-xs text-gray-500 dark:text-gray-400">${lucide('Phone', { cls: 'w-3 h-3 flex-shrink-0' })}<span class="truncate">${esc(phone)}</span></div>` : '')
          + `</div><button type="button" data-testid="create-order-gate-supplier-select-btn-${esc(i._id)}" class="flex-shrink-0 px-4 py-1.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors" data-act="source-pick" data-id="${esc(i._id)}" data-kind="${esc(i._sourceType)}">Select</button></div>`;
      }).join('')
      + (list.length === 0 ? '<p data-testid="create-order-gate-supplier-empty" class="text-sm text-gray-500 text-center py-4">No suppliers found</p>' : '')
      + '</div><div class="border-t border-gray-100 dark:border-gray-700 p-2 flex items-center gap-2">'
      + '<button type="button" data-testid="create-order-gate-cancel-btn" class="flex-1 flex items-center justify-center h-10 px-3 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors" data-act="gate-cancel">Cancel</button>'
      + '<button type="button" data-testid="create-order-gate-create-supplier-btn" class="flex-1 flex items-center justify-center gap-1.5 h-10 px-3 text-sm text-green-700 dark:text-green-400 font-medium border border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors" data-act="source-create"><span class="text-base leading-none">+</span><span>Create New Supplier</span></button>'
      + '</div></div></div>';
  }

  // ── Catalogue side effects: expand every category once, reset the page on a new product set ──
  function onCatalogueChange() {
    const cat = activeCatalogue();
    if (cat === st.lastCatalogue) return;
    st.lastCatalogue = cat;
    // "Expand all categories by default" — but only ever from an EMPTY set, so switching between
    // catalogues keeps whichever categories the previous one had open.
    if (!cat.length) st.expanded = new Set();
    else if (!st.expanded.size) st.expanded = new Set(cat.map((c) => c._id));
    if (cat.length) jumpToNewItem();
  }
  /** fetchRawMaterialTree: the RAW-MATERIAL tree, normalised to the drawer's catalogue shape. */
  async function fetchRawMaterialTree() {
    const res = await server.getCategoryProductTree({ catalogueType: 'RAW-MATERIAL' });
    const payload = res?.data?.data || res?.data || res;
    const top = Array.isArray(payload?.products) ? payload.products : [];
    return top.map((c) => ({ ...c, subCategories: (c.categories || []).map((sub) => ({ ...sub, products: (sub.categories || []).map((p) => ({ ...p, _id: p._id || p.id })) })) }));
  }

  /**
   * handleNewItemCreated: close the modal, refresh whichever catalogue the item went into (a raw
   * material switches the drawer to that catalogue), then — once it lands — jump to the item's
   * subcategory (jumpToNewItem, from onCatalogueChange).
   */
  async function handleNewItemCreated(articleNo, createdType) {
    addItem.close();
    if (articleNo) pendingNewItemArticleNo = articleNo;
    st.refreshingAfterNewItem = true; render();
    try {
      if (createdType === 'RAW-MATERIAL') {
        const tree = await fetchRawMaterialTree();
        if (!st) return;
        st.rawTree = tree; st.isRawMaterialMode = true;
      } else {
        if (st.isRawMaterialMode) st.isRawMaterialMode = false;
        await refreshProductsForSource(st.selectedSource);
      }
    } catch {
      host.notify('error', "Item created, but the catalogue couldn't refresh automatically. Please search for it.");
      pendingNewItemArticleNo = null;
    } finally {
      if (st) { st.refreshingAfterNewItem = false; render(); }
    }
  }
  function jumpToNewItem() {
    if (!pendingNewItemArticleNo) return;
    for (const category of activeCatalogue()) {
      const sub = (category.subCategories || []).find((s) => (s.products || []).some((p) => p.articleNumber === pendingNewItemArticleNo));
      if (sub) {
        st.selectedSubcategory = sub._id; st.productSearchInput = ''; setSearch('');
        pendingNewItemArticleNo = null;
        host.notify('success', 'New item added — set the quantity below');
        break;
      }
    }
  }

  /** handleRawMaterialToggle: the RAW-MATERIAL catalogue tree (fetched once), or back again. */
  async function toggleRawMaterial() {
    if (st.isRawMaterialMode) { st.isRawMaterialMode = false; st.selectedSubcategory = ''; render(); return; }
    st.isRawMaterialMode = true; st.selectedSubcategory = '';
    if (st.rawTree.length === 0) {
      st.loadingRaw = true; render();
      try {
        const tree = await fetchRawMaterialTree();
        if (!st) return;
        st.rawTree = tree;
      } catch {
        host.notify('error', 'Failed to load raw material categories');
        if (st) st.isRawMaterialMode = false;
      } finally {
        if (st) { st.loadingRaw = false; render(); }
      }
    } else render();
  }
  function syncPaging() {
    const key = flattened().map((p) => p._id).join('|');
    if (key !== st.idsKey) {
      st.idsKey = key; st.visibleCount = PAGE_SIZE;
      const sc = drawer.body()?.querySelector('[data-co-scroll]');
      if (sc) sc.scrollTop = 0;
    }
  }

  // ── Views ─────────────────────────────────────────────────────────────────────────────────
  const money = (v) => `${esc(currency)}${T}${NB}${T}${v}`;

  function header() {
    return '<div class="w-full relative px-4 sm:px-6 py-3 sm:py-4 pr-16 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm flex-shrink-0"><div class="flex items-center gap-2 flex-1 min-w-0">'
      + lucide('ShoppingCart', { cls: 'w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0' })
      + '<div class="min-w-0"><h2 class="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">Create Purchase Order</h2><p class="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">Add products from your inventory. Select an internal supplier to also see their catalog.</p></div></div></div>';
  }

  function sourceSelector() {
    const s = st.selectedSource;
    const q = st.sourceSearch.toLowerCase();
    const list = selectableSources().filter((i) => (i.name || '').toLowerCase().includes(q));
    const chipOf = (i) => { const c = supplierChip(i); return `<span class="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${c.classes}">${esc(c.label)}</span>`; };
    return '<div class="relative" data-co-source>'
      + '<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">Select Supplier</label>'
      + `<button type="button" data-testid="create-order-supplier-select-btn" class="w-full flex items-center justify-between h-[42px] px-3 border rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none transition ${st.showSupplierTooltip && !s ? 'border-rose-400 dark:border-rose-600 focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500' : 'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-green-500 focus:border-green-500'}" data-act="source-toggle">`
      + (s ? `<span class="flex items-center gap-2 min-w-0"><span class="truncate font-medium">${esc(s.name)}</span>${chipOf(s)}</span>` : '<span class="text-gray-400 dark:text-gray-500">Select a supplier...</span>')
      + lucide('ChevronDown', { cls: `w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${st.dropdownOpen ? 'rotate-180' : ''}` })
      + '</button>'
      + (st.dropdownOpen ? '<div class="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">'
        + `<div class="p-2 border-b border-gray-100 dark:border-gray-700"><div class="relative">${lucide('Search', { cls: 'absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none' })}<input type="text" placeholder="Search suppliers..." data-testid="create-order-supplier-dropdown-search-input" class="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" value="${esc(st.sourceSearch)}" data-co-source-search></div></div>`
        + '<div class="max-h-48 overflow-y-auto py-1">'
        + list.map((i) => `<button type="button" data-testid="create-order-supplier-option-${esc(i._id)}" class="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${s?._id === i._id ? 'bg-green-50 dark:bg-green-900/20' : ''}" data-act="source-pick" data-id="${esc(i._id)}" data-kind="${esc(i._sourceType)}"><span class="flex-1 font-medium text-gray-900 dark:text-white truncate">${esc(i.name)}</span>${chipOf(i)}</button>`).join('')
        + (list.length === 0 ? '<p data-testid="create-order-supplier-dropdown-empty" class="text-sm text-gray-500 text-center py-4">No suppliers found</p>' : '')
        + '</div><div class="border-t border-gray-100 dark:border-gray-700 p-1.5"><button type="button" data-testid="create-order-supplier-dropdown-create-btn" class="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-green-700 dark:text-green-400 font-medium hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors" data-act="source-create"><span class="text-base leading-none">+</span><span>Create New Supplier</span></button></div></div>' : '')
      + '</div>';
  }

  function chipsRow(flat) {
    const showType = isExternalPO();
    const showSubs = Boolean(st.selectedSource) && flat.length > 0;
    if (!showType && !showSubs) return '';
    const chip = 'flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] sm:px-4 sm:py-2 sm:text-sm border transition';
    const on = 'bg-green-600 border-green-600 text-white shadow-sm';
    const off = 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40';
    const sep = '<div class="flex-shrink-0 w-px self-stretch bg-gray-200 dark:bg-gray-700"></div>';
    const subs = [{ _id: '', name: 'All' }];
    const seen = new Set();
    for (const c of sidebarCatalogue()) for (const s of c.subCategories || []) { if (seen.has(String(s._id))) continue; seen.add(String(s._id)); subs.push({ _id: s._id, name: s.name }); }
    const raw = st.isRawMaterialMode;
    const flask = st.loadingRaw ? spinner('animate-spin w-3 h-3') : '<span class="text-[10px] leading-none">⚗</span>';
    return '<div class="lg:hidden mt-3 "><div class="flex items-center gap-1 overflow-x-auto py-0.5 sm:gap-2 sm:py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&amp;::-webkit-scrollbar]:hidden">'
      + (showType ? `<button type="button" data-testid="create-order-catalogue-type-finished-goods" data-status="${!raw ? 'selected' : 'unselected'}" class="${chip} ${!raw ? on : off}" data-act="finished-goods">Finished Goods</button>${sep}`
        + `<button type="button"${st.loadingRaw ? ' disabled=""' : ''} data-testid="create-order-catalogue-type-raw-material" data-status="${raw ? 'selected' : 'unselected'}" class="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:gap-1.5 sm:px-4 sm:py-2 sm:text-sm border transition disabled:opacity-60 disabled:cursor-not-allowed ${raw ? 'bg-amber-500 border-amber-500 text-white shadow-sm' : 'bg-white dark:bg-gray-800 border-amber-400 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'}" title="${raw ? 'Switch back to full catalogue' : 'Browse raw material catalogue'}" data-act="raw-material-chip">${flask}Raw Material</button>${sep}` : '')
      + (showSubs ? subs.map((s) => {
        const active = (String(s._id) === '' && !st.selectedSubcategory) || String(s._id) === String(st.selectedSubcategory);
        return `<button type="button" data-testid="create-order-subcategory-chip-mobile-${esc(s._id || 'all')}" data-status="${active ? 'selected' : 'unselected'}" class="${chip} ${active ? on : off}" data-act="subcategory" data-id="${esc(s._id)}">${esc(s._id ? t(s.name) : 'All')}</button>`;
      }).join('') : '')
      + '</div></div>';
  }

  function topBar(flat) {
    const allowed = Boolean(st.selectedSource);
    const subName = st.selectedSubcategory ? t(selectedSub()?.sub.name || '') : '';
    return '<div class="px-4 sm:px-6 py-2 sm:py-4 flex-shrink-0 bg-gray-50 dark:bg-gray-900/50"><div class="grid gap-1.5 sm:gap-2 grid-cols-1 lg:grid-cols-2">'
      + sourceSelector()
      + '<div class="min-w-0"><div class="flex items-center justify-between gap-2 mb-1 sm:mb-2"><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Search Products</label>'
      // SSOT 4 F18f canOfferAddNewItem: an external-supplier purchase order, once a supplier is chosen.
      + (allowed && isExternalPO() ? `<button type="button" data-testid="create-order-add-new-item-btn" class="flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors" data-act="add-item">${lucide('Plus', { cls: 'w-3.5 h-3.5' })}Add New Item</button>` : '')
      + `</div><div class="relative" title="${allowed ? '' : 'Please select a supplier first'}"><div class="flex gap-2"><div class="relative flex-1">`
      + (st.isSearching ? `<div class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none">${spinner('animate-spin text-green-600')}</div>` : lucide('Search', { cls: 'absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none' }))
      + `<input type="search"${allowed ? '' : ' disabled=""'} data-testid="create-order-product-search-input" placeholder="${allowed ? 'Search products...' : 'Select a supplier first...'}" class="w-full pl-10 h-[42px] text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${st.selectedSubcategory ? 'pr-36' : 'pr-4'}" value="${esc(st.productSearchInput)}" data-co-search>`
      + (st.selectedSubcategory ? `<div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-md border border-green-200 dark:border-green-700"><span class="text-xs font-medium text-green-700 dark:text-green-400 whitespace-nowrap">${esc(subName)}</span><button class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" title="Clear filter" type="button" data-testid="create-order-clear-subcategory-btn" data-act="subcategory" data-id="">${lucide('X', { cls: 'w-3.5 h-3.5' })}</button></div>` : '')
      + '</div>'
      + (qrCodeScannerEnabled ? `<button type="button"${allowed ? '' : ' disabled=""'} data-testid="create-order-scan-btn" class="flex items-center justify-center px-3 h-[42px] bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="${allowed ? 'Scan Barcode' : 'Please select a supplier first'}" data-act="scan">${lucide('ScanBarcode', { cls: 'h-4 w-4' })}</button>` : '')
      + '</div>' + chipsRow(flat) + '</div></div></div></div>';
  }

  const emptyBlock = (testId, icon, title, text, extra = '') => `<div data-testid="${testId}" class="h-full flex items-center justify-center"><div class="text-center max-w-sm"><div class="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">${lucide(icon, { cls: 'w-8 h-8 text-gray-400' })}</div><h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">${title}</h3><p class="text-sm text-gray-500 dark:text-gray-400${extra ? ' mb-4' : ''}">${text}</p>${extra}</div></div>`;

  // ── Phone: MobileOrderProductPanel ──
  // ── Policy (warranty / guarantee): the product's badge, and its details modal ──
  function desktopPolicyBadge(p) {
    const policy = policyOf(p);
    if (!policy || !policy.name) return '';
    const w = policy.type === 'WARRANTY';
    return `<div class="mt-2"><button type="button" data-testid="create-order-product-policy-btn-${esc(p._id)}" class="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ease-in-out ${w ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 hover:shadow-sm dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/30 dark:hover:border-blue-700' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 hover:shadow-sm dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/30 dark:hover:border-emerald-700'}" title="Click to view coverage details" data-act="policy" data-id="${esc(p._id)}">`
      + `${lucide('Shield', { cls: 'w-3.5 h-3.5 flex-shrink-0' })}<span class="font-semibold">${esc(policy.name)}</span>`
      + (policy.activation?.duration_in_sec ? `<span class="opacity-70 font-normal">·${T} ${T}${esc(policyDuration(policy.activation.duration_in_sec))}</span>` : '')
      + '</button></div>';
  }
  function mobilePolicyBadge(p) {
    const policy = policyOf(p);
    if (!policy || !policy.name) return '';
    const w = policy.type === 'WARRANTY';
    return `<button type="button" data-testid="create-order-mobile-product-policy-btn-${esc(p._id)}" class="mt-1 inline-flex min-h-7 items-center gap-1 rounded px-2 py-1 text-xs font-medium leading-none transition-colors ${w ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'}" title="Click to view coverage details" data-act="policy" data-id="${esc(p._id)}">`
      + `${lucide('Shield', { cls: 'h-3.5 w-3.5 flex-shrink-0' })}<span>${esc(policy.name)}</span>`
      + (policy.activation?.duration_in_sec ? `<span class="opacity-60">· ${T}${esc(policyDuration(policy.activation.duration_in_sec))}</span>` : '')
      + '</button>';
  }
  function policyModal() {
    const d = st.policyDetails;
    if (!d) return '';
    const w = d.type === 'WARRANTY';
    const pick = (a, b) => (w ? a : b);
    return '<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"><div data-testid="create-order-policy-modal" class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">'
      + `<div class="relative px-6 py-5 border-b dark:border-gray-700 ${pick('bg-gradient-to-r from-blue-50 to-blue-50/50 dark:from-blue-950/40 dark:to-blue-950/20 border-blue-100 dark:border-blue-900/50', 'bg-gradient-to-r from-emerald-50 to-emerald-50/50 dark:from-emerald-950/40 dark:to-emerald-950/20 border-emerald-100 dark:border-emerald-900/50')}"><div class="flex items-start justify-between"><div class="flex items-start gap-3 flex-1">`
      + `<div class="p-2 rounded-lg ${pick('bg-blue-100 dark:bg-blue-900/40', 'bg-emerald-100 dark:bg-emerald-900/40')}">${lucide('Shield', { cls: `w-5 h-5 ${pick('text-blue-600 dark:text-blue-400', 'text-emerald-600 dark:text-emerald-400')}` })}</div>`
      + `<div class="flex-1"><h3 class="text-lg font-semibold text-gray-900 dark:text-white leading-tight">${esc(d.name)}</h3><p class="mt-1 text-xs font-medium uppercase tracking-wide ${pick('text-blue-600 dark:text-blue-400', 'text-emerald-600 dark:text-emerald-400')}">${w ? 'Warranty Coverage' : 'Guarantee Coverage'}</p></div></div>`
      + `<button data-testid="create-order-policy-modal-close-btn" class="ml-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-all duration-150" type="button" data-act="policy-close">${lucide('X', { cls: 'w-5 h-5' })}</button></div></div>`
      + '<div class="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">'
      + (d.activation?.duration_in_sec ? `<div class="space-y-2"><label class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Coverage Duration</label><div class="flex items-center gap-2"><div class="px-3 py-2 rounded-lg font-medium text-sm ${pick('bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300')}">${esc(policyDuration(d.activation.duration_in_sec))}</div></div></div>` : '')
      + (d.ruleset?.[0]?.content ? `<div class="space-y-2"><label class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Terms &amp; Conditions</label><div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700"><p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">${esc(d.ruleset[0].content)}</p></div></div>` : '')
      + (d.status ? `<div class="space-y-2"><label class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</label><div><span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${d.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}"><span class="w-1.5 h-1.5 rounded-full ${d.status === 'ACTIVE' ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-gray-400'}"></span>${esc(d.status)}</span></div></div>` : '')
      + '</div><div class="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700"><button data-testid="create-order-policy-modal-close-footer-btn" class="w-full px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-150 font-medium text-sm shadow-sm" type="button" data-act="policy-close">Close</button></div></div></div>';
  }

  function mobileCard(p, index) {
    const cid = customerId();
    const unit = effectiveUnit(p);
    const idx = host.getUnitIndexForUnit(p, unit);
    const currentStock = host.getProductStockFromUnitIndex(p, idx, true);
    const sum = p.articleNumber ? st.stockSummaryMap[p.articleNumber] : null;
    const idealStock = sum ? host.getProductStockFromUnitIndex({ stock: Math.max(0, (sum.availableStock || 0) - (sum.requiredStock || 0)), boxes: sum.boxes || 1, pallets: sum.pallets || 1 }, idx, true) : null;
    const qty = getQuantity(p._id, cid);
    const opts = unitOptions(p);
    const dd = st.openUnitDropdown === p._id;
    const ppu = unitPrice(p, cid, unit);
    const key = `${p._id}-${cid}`;
    const tempVal = st.tempQuantities[key] !== undefined ? st.tempQuantities[key] : String(qty || 0);
    const invalid = st.invalidQuantities[key];
    const total = Number(ppu || 0) * Number(qty || 0);
    const editing = st.editingPrice === `${p._id}-${cid}`;
    const notSupplied = Boolean(p._notSuppliedByThisSupplier);
    const name = t(p.name);

    const tempQty = Number(String(tempVal ?? '').trim() || 0);
    const currentQty = Number.isNaN(tempQty) ? Number(qty || 0) : tempQty;
    const displayed = idealStock !== null ? Number(idealStock) : Number(currentStock || 0);
    const qtyRow = `<div class="grid min-h-[58px] w-full min-w-0 grid-cols-[132px_1fr_auto] items-center gap-2 border-t border-gray-100 px-3 py-2 dark:border-gray-700"><div class="flex h-10 w-[132px] flex-shrink-0 items-center overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-700">`
      + `<button type="button"${currentQty <= 0 ? ' disabled=""' : ''} data-testid="create-order-mobile-product-qty-decrement-${esc(p._id)}" class="flex h-full w-10 flex-shrink-0 items-center justify-center border-r border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600" aria-label="Decrease quantity of ${esc(p.name)}" data-act="qty-step" data-id="${esc(p._id)}" data-step="-1">${stepSvg('h-[18px] w-[18px]', 'M20 12H4')}</button>`
      + `<input type="tel" inputmode="decimal" pattern="[0-9]*\\.?[0-9]{0,2}" step="0.01" placeholder="0" id="mobile-qty-input-${index}" data-testid="create-order-mobile-product-qty-input-${esc(p._id)}" autocomplete="off" class="h-full min-w-0 flex-1 border-0 bg-transparent px-1 text-center text-sm font-bold focus:ring-0 ${invalid ? 'text-red-500' : 'text-gray-900 dark:text-white'}" value="${esc(tempVal)}" data-co-qty="${esc(p._id)}" data-mobile>`
      + `<button type="button" data-testid="create-order-mobile-product-qty-increment-${esc(p._id)}" class="flex h-full w-10 flex-shrink-0 items-center justify-center border-l border-gray-200 text-green-600 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:text-gray-300 dark:border-gray-600 dark:text-green-400 dark:hover:bg-gray-600" aria-label="Increase quantity of ${esc(p.name)}" title="Increase" data-act="qty-step" data-id="${esc(p._id)}" data-step="1">${stepSvg('h-[18px] w-[18px]', 'M12 4v16m8-8H4')}</button></div>`
      + `<div class="min-w-0 text-center text-[11px] leading-tight">${invalid ? `<div class="font-medium text-red-500">${esc(invalid)}</div>` : Number.isFinite(displayed) ? `<div><div class="truncate font-bold text-orange-500 dark:text-orange-400">${displayed}${T} avail.</div><div class="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">In Stock</div></div>` : showAlertForOversell ? '<div class="text-gray-500 dark:text-gray-400">Stock unchecked</div>' : ''}</div>`
      + `<div class="min-w-[62px] text-right leading-tight"><div class="text-[10px] font-medium text-gray-600 dark:text-gray-300">Total</div><div class="text-sm font-bold text-green-600 dark:text-green-400">${money(Number(total || 0).toFixed(2))}</div></div></div>`;

    const priceBlock = !editing
      ? `<div class="flex items-start justify-end gap-2"><div><div class="text-[17px] font-bold leading-tight text-gray-900 dark:text-white">${money(Number(ppu || 0).toFixed(2))}</div></div>`
        + (canEditPrice() ? `<button type="button" data-testid="create-order-mobile-product-price-edit-btn-${esc(p._id)}" class="group flex h-5 w-8 flex-shrink-0 items-center justify-center rounded-md transition-colors hover:bg-green-50 dark:hover:bg-green-900/20" aria-label="Edit price of ${esc(p.name)}" title="Edit price" data-act="price-edit" data-id="${esc(p._id)}" data-mobile>${lucide('Edit2', { cls: 'h-[15px] w-[15px] text-gray-500 group-hover:text-green-600 dark:text-gray-400' })}</button>` : '')
        + '</div>'
      : `<div class="flex items-center justify-end gap-1"><span class="text-xs text-gray-600 dark:text-gray-300">${esc(currency)}</span><div class="relative"><input type="number" inputmode="decimal" min="0" step="0.01" data-testid="create-order-mobile-product-price-input-${esc(p._id)}" class="h-9 w-[86px] rounded-md border-2 bg-white px-2 text-center text-base font-semibold dark:bg-gray-800 ${st.priceError ? 'border-red-500' : 'border-amber-400'} focus:ring-2 ${st.priceError ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-amber-500 focus:border-amber-500'}" placeholder="0.00" value="${esc(st.tempPrice)}" data-co-price="${esc(p._id)}" data-mobile>`
        + (st.priceError ? `<div class="absolute z-50 top-full right-0 mt-1"><div class="bg-red-500 text-white text-xs rounded py-1 px-2 whitespace-nowrap shadow-lg">${esc(st.priceError)}</div></div>` : '')
        + `</div><button type="button" data-testid="create-order-mobile-product-price-confirm-btn-${esc(p._id)}" class="flex h-9 w-8 flex-shrink-0 items-center justify-center rounded-md transition-colors hover:bg-green-100" aria-label="Confirm price for ${esc(p.name)}" title="Confirm" data-act="price-confirm" data-id="${esc(p._id)}">${lucide('Check', { cls: 'h-[18px] w-[18px] text-green-600' })}</button><button type="button" data-testid="create-order-mobile-product-price-cancel-btn-${esc(p._id)}" class="flex h-9 w-8 flex-shrink-0 items-center justify-center rounded-md transition-colors hover:bg-red-100" aria-label="Cancel price editing for ${esc(p.name)}" title="Cancel" data-act="price-cancel">${lucide('X', { cls: 'h-[18px] w-[18px] text-red-600' })}</button></div>`;

    return `<div data-testid="create-order-mobile-product-row-${esc(p._id)}" class="overflow-visible rounded-2xl border bg-white shadow-[0_2px_9px_rgba(15,23,42,0.10)] transition-all dark:border-gray-600 dark:bg-gray-800 ${notSupplied ? 'border-gray-200 bg-gray-50 opacity-70 dark:bg-gray-800/50' : Number(qty || 0) > 0 ? 'border-gray-200 dark:border-gray-600' : 'border-gray-200 hover:border-gray-300 hover:shadow-md dark:border-gray-600'}">`
      + `<div class="relative flex min-h-[75px] items-start gap-3 px-3 pb-1.5 pt-3"><div class="h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 dark:border-gray-600 dark:bg-gray-700">${displayImage({ size: 72, cls: 'h-full w-full !object-cover rounded-custom' })}</div>`
      + `<div class="flex min-h-16 min-w-0 flex-1 flex-col"><div class="flex items-start justify-between gap-2"><div class="min-w-0"><div class="truncate text-[15px] font-bold leading-tight text-gray-900 dark:text-white" title="${esc(name)}">${esc(name)}</div>`
      + `<div class="mt-1 text-[11px] leading-tight text-gray-500 dark:text-gray-400">Art No:${T} <span class="font-medium">${esc(p.articleNumber || '-')}</span>${isPalletCalculationEnabled && p.pallets > 0 ? `<span class="ml-1 text-gray-400">•${T} ${T}${p.pallets}${T}/plt</span>` : ''}</div>`
      + (!notSupplied ? `<div class="mt-3 flex min-w-0 flex-wrap items-center gap-1.5"><div data-order-unit-dropdown="true" class="relative"><button type="button" data-testid="create-order-mobile-product-unit-toggle-${esc(p._id)}" class="flex max-w-[88px] items-center gap-0.5 rounded-md bg-green-50 px-2 py-1 text-[10px] font-medium text-green-600 dark:bg-green-900/25 dark:text-green-400" data-act="unit-toggle" data-id="${esc(p._id)}" data-multi="${opts.length > 1 ? '1' : ''}"><span class="truncate">${esc(unit)}</span>${opts.length > 1 ? lucide('ChevronDown', { cls: `h-3 w-3 flex-shrink-0 transition-transform ${dd ? 'rotate-180' : ''}` }) : ''}</button>`
        + (opts.length > 1 && dd ? `<div class="absolute left-0 top-full z-30 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">${opts.map((u) => `<button type="button" data-testid="create-order-mobile-product-unit-option-${esc(p._id)}-${esc(u)}" class="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-700 ${u === unit ? 'font-semibold text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-200'}" data-act="unit-pick" data-id="${esc(p._id)}" data-unit="${esc(u)}"><span>${esc(u)}</span><span>${money(unitPrice(p, cid, u).toFixed(2))}</span></button>`).join('')}</div>` : '')
        + `</div>${p.brand ? `<span class="max-w-[88px] truncate rounded-md bg-green-50 px-2 py-1 text-[10px] font-medium text-green-600 dark:bg-green-900/25 dark:text-green-400">${esc(p.brand)}</span>` : ''}</div>` : '')
      + (notSupplied ? '<div class="mt-1"><span class="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400">Not supplied by this supplier</span></div>' : '')
      + `</div><div class="${editing ? 'w-[170px]' : 'flex-shrink-0'} pt-1 text-right">${priceBlock}</div></div>${mobilePolicyBadge(p)}</div></div>`
      + `<div class="w-full">${notSupplied ? '<div class="border-t border-gray-100 px-3 py-3 text-xs italic text-gray-400 dark:border-gray-700 dark:text-gray-500">Not available from this supplier</div>' : qtyRow}</div></div>`;
  }

  function mobilePanel(visible, hasMore) {
    let inner;
    if (st.isSearching && st.productSearch.trim()) inner = `<div class="mb-3" data-testid="create-order-mobile-products-searching">${aiLoader({ message: 'Searching products...', size: 'sm' })}</div>`;
    else if (!visible.length) {
      inner = `<div class="py-10 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-600 shadow-md" data-testid="create-order-mobile-products-empty"><div class="w-14 h-14 mx-auto mb-3 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">${lucide('Search', { cls: 'w-7 h-7 text-gray-400' })}</div><div class="text-base font-semibold text-gray-900 dark:text-white">No Products Found</div><div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Try changing category or search text.</div>`
        + (st.productSearch.trim() || st.selectedSubcategory ? `<button type="button" data-testid="create-order-mobile-products-empty-clear-filters-btn" class="mt-4 inline-flex items-center gap-2 text-sm text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-medium" data-act="clear-filters">${lucide('RotateCcw', { cls: 'w-4 h-4' })}Clear filters</button>` : '')
        + '</div>';
    } else inner = `<div class="space-y-2 pb-2">${visible.map(mobileCard).join('')}</div>`;
    return `<div class="lg:hidden">${inner}${hasMore ? sentinel('mobile') : ''}</div>`;
  }
  const sentinel = (which) => `<div class="flex items-center justify-center gap-2 py-5 text-sm text-gray-400 dark:text-gray-500" data-co-sentinel="${which}">${spinner('animate-spin w-4 h-4 text-green-500')}Loading more products…</div>`;
  const stepSvg = (cls, d) => `<svg class="${cls}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${d}"></path></svg>`;

  // ── Desktop: sidebar + table ──
  function sidebar() {
    const cat = sidebarCatalogue();
    const raw = st.isRawMaterialMode;
    const img = displayImage({ size: 20, cls: 'block rounded object-cover flex-shrink-0 shadow-none' });
    return '<div class="lg:col-span-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col"><div class="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 px-4 py-3 flex-shrink-0 flex items-center justify-between gap-2"><h4 class="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Categories</h4>'
      + (isExternalPO() ? `<button type="button"${st.loadingRaw ? ' disabled=""' : ''} data-testid="create-order-sidebar-raw-material-toggle" data-status="${raw ? 'selected' : 'unselected'}" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all duration-200 ${raw ? 'bg-amber-500 border-amber-500 text-white shadow-sm' : 'bg-white dark:bg-gray-800 border-amber-400 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'} disabled:opacity-60 disabled:cursor-not-allowed" title="${raw ? 'Switch back to full catalogue' : 'Browse raw material catalogue'}" data-act="raw-material">${st.loadingRaw ? spinner('animate-spin w-3 h-3') : '<span class="text-[10px] leading-none">⚗</span>'}Raw Material</button>` : '')
      + '</div>'
      + (!cat.length ? '<div class="flex-1 flex items-center justify-center p-6"><div class="text-center"><div class="w-12 h-12 mx-auto mb-3 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center"><svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg></div><p class="text-xs text-gray-500 dark:text-gray-400">No categories available</p></div></div>'
        : `<div class="py-2 overflow-y-auto custom-scroll flex-1"><button type="button" data-testid="create-order-sidebar-all-products-btn" data-status="${!st.selectedSubcategory ? 'selected' : 'unselected'}" class="w-full text-left px-4 py-2.5 text-sm font-medium transition-all mb-1 ${!st.selectedSubcategory ? 'bg-blue-50 dark:bg-blue-900/20 text-green-700 dark:text-green-400 border-l-4 border-green-500' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 border-transparent'}" data-act="subcategory" data-id="">All Products</button>`
          + cat.map((c) => {
            const open = st.expanded.has(c._id);
            return `<div class="mb-1"><button type="button" data-testid="create-order-sidebar-category-toggle-${esc(c._id)}" class="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors" aria-expanded="${open}" data-act="category-toggle" data-id="${esc(c._id)}"><span class="flex items-center gap-2 min-w-0">${img}<span class="truncate">${esc(t(c.name))}</span></span><svg class="w-4 h-4 text-green-700 transform transition-transform duration-200 ${open ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></button>`
              + (open ? `<div class="bg-gray-50/50 dark:bg-gray-900/20">${(c.subCategories || []).map((s) => {
                const active = String(st.selectedSubcategory) === String(s._id);
                return `<button data-testid="create-order-sidebar-subcategory-${esc(s._id)}" data-status="${active ? 'selected' : 'unselected'}" class="w-full text-left px-4 pl-8 py-2.5 text-sm transition-all flex items-center gap-2 ${active ? 'bg-blue-50 dark:bg-blue-900/20 text-green-700 dark:text-green-400 font-medium border-l-4 border-green-500' : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700/30 border-l-4 border-transparent'}" type="button" data-act="subcategory" data-id="${esc(s._id)}">${img}${esc(t(s.name))}</button>`;
              }).join('')}</div>` : '')
              + '</div>';
          }).join('')
          + '</div>')
      + '</div>';
  }

  function tableRow(p, index, visibleCount) {
    const cid = customerId();
    const unit = effectiveUnit(p);
    const idx = host.getUnitIndexForUnit(p, unit);
    const opts = unitOptions(p);
    const currentStock = showAlertForOversell ? host.getProductStockFromUnitIndex(p, idx, true) : Infinity;
    const qty = getQuantity(p._id, cid);
    const notSupplied = Boolean(p._notSuppliedByThisSupplier);
    const ppu = unitPrice(p, cid, unit);
    const editing = st.editingPrice === `${p._id}-${cid}`;
    const key = `${p._id}-${cid}`;
    const tempVal = st.tempQuantities[key] !== undefined ? st.tempQuantities[key] : String(qty || '');
    const invalid = st.invalidQuantities[key];
    const tq = Number(String(tempVal || '').trim() || 0);
    const currentQty = Number.isNaN(tq) ? Number(qty || 0) : tq;
    const dd = st.openUnitDropdown === p._id;
    const isLast = index === visibleCount - 1;
    const tempRaw = st.tempQuantities[key];
    const tempNum = tempRaw !== undefined && String(tempRaw).trim() !== '' ? Number(tempRaw) : null;
    const q = !Number.isNaN(tempNum) && tempNum !== null ? tempNum : getQuantity(p._id, cid) || 0;
    const total = Number(ppu) * Number(q);
    const conversion = host.displayUnitConversion(p);

    const priceCell = !editing
      ? `<div class="flex items-center gap-2"><span class="text-sm font-medium text-gray-800 dark:text-gray-200">${money(Number(ppu).toFixed(2))}<span class="block text-[11px] text-gray-500 leading-tight">${esc(taxLabel(p?.tax))}</span></span>`
        + (canEditPrice() ? `<button type="button" data-testid="create-order-product-price-edit-btn-${esc(p._id)}" class="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors group" title="Edit price" data-act="price-edit" data-id="${esc(p._id)}">${lucide('Edit2', { cls: 'w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-green-600' })}</button>` : '')
        + '</div>'
      : `<div class="relative flex items-center gap-1"><span class="text-xs text-gray-600 dark:text-gray-300">${esc(currency)}</span><div class="relative"><input type="number" inputmode="decimal" min="0" step="0.01" data-testid="create-order-product-price-input-${esc(p._id)}" class="w-20 px-2 py-1 border-2 ${st.priceError ? 'border-red-500' : 'border-amber-400'} rounded text-center text-xs focus:ring-2 ${st.priceError ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-amber-500 focus:border-amber-500'} bg-white dark:bg-gray-800" placeholder="0.00" value="${esc(st.tempPrice)}" data-co-price="${esc(p._id)}">`
        + (st.priceError ? `<div class="absolute z-50 top-full left-1/2 transform -translate-x-1/2 mt-1"><div class="bg-red-500 text-white text-xs rounded py-1 px-2 whitespace-nowrap shadow-lg">${esc(st.priceError)}<div class="absolute bottom-full left-1/2 transform -translate-x-1/2"><div class="border-4 border-transparent border-b-red-500"></div></div></div></div>` : '')
        + `</div><button type="button" data-testid="create-order-product-price-confirm-btn-${esc(p._id)}" class="p-1 hover:bg-green-100 rounded transition-colors" title="Confirm" data-act="price-confirm" data-id="${esc(p._id)}">${lucide('Check', { cls: 'w-3.5 h-3.5 text-green-600' })}</button><button type="button" data-testid="create-order-product-price-cancel-btn-${esc(p._id)}" class="p-1 hover:bg-red-100 rounded transition-colors" title="Cancel" data-act="price-cancel">${lucide('X', { cls: 'w-3.5 h-3.5 text-red-600' })}</button></div>`;

    const qtyCell = notSupplied ? '<span class="text-xs text-gray-400 dark:text-gray-500 italic">Not available</span>'
      : `<div data-order-unit-dropdown="true" class="relative flex min-h-[1.125rem] w-[9.75rem] items-center justify-center gap-1 text-center text-xs leading-4 text-gray-500 dark:text-gray-400 max-sm:w-36">`
        + (opts.length > 1 ? `<button type="button" data-testid="create-order-product-unit-toggle-${esc(p._id)}" class="flex items-center gap-0.5 font-medium text-gray-700 hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-400" data-act="unit-toggle" data-id="${esc(p._id)}" data-multi="1"><span>${esc(unit)}</span>${lucide('ChevronDown', { cls: `h-3 w-3 flex-shrink-0 transition-transform ${dd ? 'rotate-180' : ''}` })}</button>` : `<span class="font-medium text-gray-700 dark:text-gray-200">${esc(unit)}</span>`)
        + (showAlertForOversell && st.selectedSource?._sourceType !== 'internalSupplier' ? `<span class="${currentStock <= 0 ? 'text-amber-600 dark:text-amber-400' : ''}">${currentStock <= 0 ? '· Out of stock' : `· ${currentStock} avail.`}</span>` : '')
        + (dd ? `<div class="absolute left-1/2 z-20 w-44 -translate-x-1/2 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800 ${isLast ? 'bottom-full mb-1' : 'top-full mt-1'}"><div class="border-b border-gray-100 px-3 py-2 text-xs font-semibold text-gray-500 dark:border-gray-700 dark:text-gray-400">Order in</div>`
          + opts.map((u) => {
            const sel = u === unit;
            return `<button type="button" data-testid="create-order-product-unit-option-${esc(p._id)}-${esc(u)}" data-status="${sel ? 'selected' : 'unselected'}" class="flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${sel ? 'bg-blue-50 font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'}" data-act="unit-pick" data-id="${esc(p._id)}" data-unit="${esc(u)}"><span>${esc(u)}</span><div class="flex items-center gap-1.5"><span class="text-gray-500 dark:text-gray-400">${money(unitPrice(p, cid, u).toFixed(2))}</span>${sel ? lucide('Check', { cls: 'h-3 w-3 text-blue-600 dark:text-blue-400' }) : ''}</div></button>`;
          }).join('') + '</div>' : '')
        + '</div>'
        + `<div class="flex h-10 w-[9.75rem] items-center overflow-hidden rounded-lg border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 max-sm:w-36"><button type="button"${currentQty <= 0 ? ' disabled=""' : ''} data-testid="create-order-product-qty-decrement-${esc(p._id)}" class="flex h-full w-10 flex-shrink-0 items-center justify-center border-r border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-600 dark:disabled:hover:bg-transparent" data-act="qty-step" data-id="${esc(p._id)}" data-step="-1">${stepSvg('w-4 h-4', 'M20 12H4')}</button>`
        + `<input type="text" inputmode="decimal" pattern="[0-9]*\\.?[0-9]{0,2}" step="0.01" placeholder="0" id="qty-input-${index}" data-testid="create-order-product-qty-input-${esc(p._id)}" autocomplete="off" class="h-full w-[4.75rem] border-0 bg-transparent px-2 text-center text-sm focus:outline-none focus:ring-0 max-sm:w-16 ${invalid ? 'text-red-500' : 'text-gray-900 dark:text-white'}" value="${esc(tempVal)}" data-co-qty="${esc(p._id)}" data-index="${index}">`
        + `<button type="button" aria-label="increment" data-testid="create-order-product-qty-increment-${esc(p._id)}" class="flex h-full w-10 flex-shrink-0 items-center justify-center border-l border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-600 dark:disabled:hover:bg-transparent" data-act="qty-step" data-id="${esc(p._id)}" data-step="1">${stepSvg('w-4 h-4', 'M12 4v16m8-8H4')}</button></div>`
        + (conversion ? `<div class="text-xs text-gray-500 dark:text-gray-400">${conversion.map(esc).join(T)}</div>` : '')
        + (invalid ? `<div class="text-xs text-red-500">${esc(invalid)}</div>` : '');

    return `<tr data-testid="create-order-product-row-${esc(p._id)}" data-status="${notSupplied ? 'not-supplied' : 'available'}" class="transition-colors ${notSupplied ? 'bg-gray-50/60 dark:bg-gray-800/40 opacity-70' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}">`
      + `<td class="py-4 px-4 align-top"><div class="flex items-center gap-3"><div class="w-14 h-14 bg-white dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-600">${displayImage({ size: 56, cls: 'w-full h-full object-cover rounded-custom' })}</div><div><div class="text-sm font-semibold">${esc(t(p.name))}</div><div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Art No:${T} <span class="">${esc(p.articleNumber)}</span></div>`
      + (notSupplied ? '<div class="mt-1"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700">Not supplied by this supplier</span></div>' : '')
      + desktopPolicyBadge(p)
      + '</div></div></td>'
      + `<td class="py-4 text-center px-4 text-sm text-gray-700 dark:text-gray-300">${esc(p.brand || p.manufacturer || '-')}</td>`
      + `<td class="py-4 text-center px-4"><div class="flex items-center justify-center">${priceCell}</div></td>`
      + (isInventoryPriceEnabled ? '<td class="py-4 text-center px-4"><span class="text-sm text-gray-400">-</span></td>' : '')
      + `<td class="py-4 px-4"><div class="flex flex-col items-center gap-1">${qtyCell}</div></td>`
      + `<td class="py-4 px-4 text-center"><div class="flex flex-col items-center gap-0.5"><div class="font-semibold text-green-600">${total > 0 ? `${esc(currency)}${NB}${total.toFixed(2)}` : '-'}</div>${isPalletCalculationEnabled && p.pallets > 0 && q > 0 ? `<div class="text-xs text-gray-500 dark:text-gray-400">${(q / p.pallets).toFixed(2)}${T} plt</div>` : ''}</div></td>`
      + '</tr>';
  }

  function productsPanel(flat, visible, hasMore) {
    const sel = selectedSub();
    const crumbImg = displayImage({ size: 16, cls: 'block rounded object-cover flex-shrink-0 shadow-none' });
    let body;
    if (!flat.length) {
      const filteredOut = st.productSearch.trim() || st.selectedSubcategory;
      const msg = st.productSearch.trim() && st.selectedSubcategory ? `No products match "${st.productSearch}" in the selected category.` : st.productSearch.trim() ? `No products match "${st.productSearch}".` : 'No products in the selected category.';
      body = `<div data-testid="create-order-products-empty" class="flex-1 flex items-center justify-center p-12"><div class="text-center max-w-sm">`
        + (filteredOut ? `<div class="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">${lucide('Search', { cls: 'w-8 h-8 text-gray-400' })}</div><h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Products Found</h3><p class="text-sm text-gray-500 dark:text-gray-400 mb-4">${esc(msg)}</p><div class="flex items-center justify-center gap-4 flex-wrap"><button data-testid="create-order-products-empty-clear-filters-btn" class="inline-flex items-center gap-2 text-sm text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-medium" type="button" data-act="clear-filters">${lucide('RotateCcw', { cls: 'w-4 h-4' })}Clear filters</button></div>`
          : `<div class="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">${lucide('Package', { cls: 'w-8 h-8 text-gray-400' })}</div><h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Products Available</h3><p class="text-sm text-gray-500 dark:text-gray-400">This customer doesn't have any products in their catalog yet.</p>`)
        + '</div></div>';
    } else {
      body = '<div class="overflow-x-auto w-full"><div class="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-700/40 text-xs text-gray-500 dark:text-gray-400"><button type="button" data-testid="create-order-breadcrumb-all-products-btn" class="hover:text-green-600 dark:hover:text-green-400 transition-colors" data-act="subcategory" data-id="">All Products</button>'
        + (st.selectedSubcategory ? '<span class="text-gray-300 dark:text-gray-600">/</span>'
          + (sel?.cat.name ? `<span class="flex items-center gap-1 text-gray-500 dark:text-gray-400">${crumbImg}${esc(t(sel.cat.name))}</span><span class="text-gray-300 dark:text-gray-600">/</span>` : '')
          + `<span class="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-200">${crumbImg}${esc(t(sel?.sub.name || ''))}</span>` : '')
        + (st.productSearch.trim() ? `<span class="text-gray-300 dark:text-gray-600">/</span><span class="italic">Search: "${T}${esc(st.productSearch)}${T}"</span>` : '')
        + '</div><table class="min-w-full text-sm text-gray-900 dark:text-white border-collapse"><thead class="bg-gray-50 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide border-b border-gray-200 dark:border-gray-600"><tr><th class="text-left py-3 px-4 w-4/12">Product</th><th class="text-center py-3 px-4 w-1/12">Brand</th><th class="text-center py-3 px-4 w-2/12">Price</th>'
        + (isInventoryPriceEnabled ? '<th class="text-center py-3 px-4 w-1/12">Inventory Price</th>' : '')
        + '<th class="text-center py-3 px-4 w-2/12">Quantity</th><th class="text-left py-3 px-4 w-1/12">Total</th></tr></thead>'
        + `<tbody class="divide-y divide-gray-200 dark:divide-gray-700">${visible.map((p, i) => tableRow(p, i, visible.length)).join('')}</tbody></table>`
        + (hasMore ? sentinel('desktop') : '') + '</div>';
    }
    return '<div class="lg:col-span-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col overflow-hidden relative">'
      + (st.isSearching && st.productSearch.trim() ? `<div class="absolute inset-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm z-10 flex items-center justify-center">${aiLoader({ message: 'Searching products...', size: 'sm' })}</div>` : '')
      + (st.refreshingAfterNewItem ? `<div class="absolute inset-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm z-10 flex items-center justify-center">${aiLoader({ message: 'Adding your new item to the catalogue...', size: 'sm' })}</div>` : '')
      + body + '</div>';
  }

  function main(flat) {
    let inner;
    if (!selectableSources().length) inner = emptyBlock('create-order-no-suppliers-empty', 'Package', 'No Suppliers Available', 'Create or add a supplier before creating a purchase order.', `<button type="button" data-testid="create-order-empty-create-supplier-btn" class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors" data-act="source-create"><span class="text-base leading-none">+</span>Create Supplier</button>`);
    else if (!st.selectedSource) inner = emptyBlock('create-order-select-supplier-empty', 'Package', 'Select a Supplier First', 'Please select a supplier from the dropdown above to view available products and categories.');
    else if (st.catalogueLoading) inner = `<div data-testid="create-order-catalog-loading" class="h-full flex items-center justify-center">${aiLoader({ message: 'Loading product catalog...', size: 'md' })}</div>`;
    else {
      const visible = prioritized(flat).slice(0, st.visibleCount);
      const hasMore = st.visibleCount < flat.length;
      inner = mobilePanel(visible, hasMore)
        + `<div class="hidden lg:block h-full"><div class="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">${sidebar()}${productsPanel(flat, visible, hasMore)}</div></div>`;
    }
    return `<div class="flex-1 overflow-y-auto px-4 sm:px-6 py-2 sm:py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&amp;::-webkit-scrollbar]:hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-4" data-co-scroll>${inner}</div>`;
  }

  function footer() {
    const items = totalItemsLive();
    const total = orderTotal();
    const raw = Number(total || 0);
    const off = Math.round(raw) - raw;
    const roundOff = `${off >= 0 ? '+' : '-'}${Math.abs(off).toFixed(2)}`;
    const rounded = host.isRoundedAmountDisplayEnabled();
    const disabled = items < 1;
    const title = !st.selectedSource ? '' : items < 1 ? 'Please add products with quantities' : '';
    const amount = money(esc(host.formatAmountValue(total)));
    return '<div class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-3 py-2 sm:p-5 shadow-lg flex-shrink-0 fixed inset-x-0 bottom-0 z-40 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] lg:static lg:inset-auto lg:z-auto lg:pb-5">'
      + '<div class="lg:hidden"><div class="flex items-center justify-between gap-3"><div class="flex flex-shrink-0 items-center gap-3">'
      + `<div class="text-center"><div class="text-[10px] leading-tight text-gray-500 dark:text-gray-400">Total Items</div><div class="text-sm font-bold leading-tight text-gray-900 dark:text-white">${items}</div></div>`
      + (rounded ? `<div class="text-center"><div class="text-[10px] leading-tight text-gray-500 dark:text-gray-400">Round Off</div><div class="text-sm font-bold leading-tight text-amber-600 dark:text-amber-400">${roundOff}</div></div>` : '')
      + `<div class="text-right"><div class="text-[10px] leading-tight text-gray-500 dark:text-gray-400">${esc(ordersLabel)}${T} Total</div><div class="text-sm font-bold leading-tight text-green-600">${amount}</div></div></div>`
      + `<div class="relative w-[52%] flex-shrink-0" data-co-hover><button${disabled ? ' disabled=""' : ''} data-testid="create-order-submit-btn-mobile" class="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300" type="button" title="${title}" data-act="submit">${lucide('Package', { cls: 'h-4 w-4 flex-shrink-0' })}<span class="truncate">Create Purchase Order</span></button></div></div></div>`
      + '<div class="hidden lg:block"><div class="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">'
      + `<div class="flex items-center gap-3 flex-1" title="${st.selectedCustomers.length ? '' : 'Please select a customer first'}">${fi('FiMessageCircle', { cls: 'w-5 h-5 text-gray-400 dark:text-gray-500' })}<input placeholder="E.g. Handle with care, Deliver before 5 PM..."${st.selectedCustomers.length ? '' : ' disabled=""'} data-testid="create-order-comment-input" class="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent transition disabled:opacity-50 disabled:cursor-not-allowed" value="${esc(st.comment)}" data-co-comment></div>`
      + '<div class="flex items-center gap-6">'
      + `<div class="text-right"><div class="text-xs text-gray-500 dark:text-gray-400">Total Items</div><div class="text-xl font-bold text-gray-900 dark:text-white">${items}</div></div>`
      + (rounded ? `<div class="text-right"><div class="text-xs text-gray-500 dark:text-gray-400">Round Off</div><div class="text-xl font-bold text-amber-600 dark:text-amber-400">${roundOff}</div></div>` : '')
      + `<div class="text-right"><div class="text-xs text-gray-500 dark:text-gray-400">${esc(ordersLabel)}${T} Total</div><div class="text-xl font-bold text-green-600">${amount}</div></div>`
      + `<div class="relative" data-co-hover><button${disabled ? ' disabled=""' : ''} title="${title}" data-testid="create-order-submit-btn" class="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2" type="button" data-act="submit">${lucide('Package', { cls: 'w-4 h-4' })}Create Purchase Order</button>`
      + ((st.showSupplierTooltip || (st.hovering && items < 1)) && !st.selectedSource ? '<div class="absolute right-0 bottom-full mb-2 w-64 rounded-lg border border-rose-200 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300 shadow-lg"><span class="absolute -bottom-[6px] right-6 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[7px] border-l-transparent border-r-transparent border-t-rose-50 dark:border-t-rose-900"></span>Please select a supplier first, then proceed to create purchase order.</div>' : '')
      + '</div></div></div></div></div>';
  }

  // ── The review cart's inputs (CreateOrderDrawer → OrderCartModal props) ──
  function cartProps() {
    const items = cartItems();
    const src = st.selectedSource;
    return {
      open: st.cartOpen,
      isLoading: st.isLoading,
      checkoutSteps: isExternalPO() ? ['cart'] : host.getOrderCheckoutSteps(),
      cartItems: items,
      totalUnits: items.reduce((s, i) => s + i.quantity, 0),
      totalPrice: items.reduce((s, i) => s + i.totalPrice, 0),
      customerId: customerId(),
      customer: isExternalPO() ? { name: host.getSourceDisplayName(src), phone: src.contact || src.phone || src.mobile || '', email: src.email || '' } : st.selectedCustomers[0],
      tempQuantities: st.tempQuantities,
      invalidQuantities: st.invalidQuantities,
      comment: st.comment,
      stockSummaryMap: st.stockSummaryMap,
      // Collected and validated here, but the purchase-order payload never carries them: only the
      // (unreachable) admin order path reads policyActivationRequests. README, defects.
      policyActivationRequests: st.policyActivationRequests || {},
      onPolicyToggle: (id) => { const cur = st.policyActivationRequests?.[id] || { enabled: false, email: '' }; st.policyActivationRequests = { ...st.policyActivationRequests, [id]: { ...cur, enabled: !cur.enabled } }; },
      onPolicyEmail: (id, value) => { const cur = st.policyActivationRequests?.[id] || { enabled: false, email: '' }; st.policyActivationRequests = { ...st.policyActivationRequests, [id]: { ...cur, email: value } }; },
      ordersLabel,
      setComment: (v) => { st.comment = v; },
      setTempQuantities: (next) => { st.tempQuantities = next; },
      onQtyChange: (item, v) => qtyChange(item, v),
      onClose: () => { st.cartOpen = false; render(); },
      onDelete: (item) => {
        const key = `${item._id}-${customerId()}`;
        st.selectedProducts = st.selectedProducts.filter((p) => p._id !== item._id);
        st.quantities = { ...st.quantities, [key]: 0 };
        const tq = { ...st.tempQuantities }; delete tq[key]; st.tempQuantities = tq;
        const iq = { ...st.invalidQuantities }; delete iq[key]; st.invalidQuantities = iq;
      },
      onRestore: (item) => {
        const key = `${item._id}-${customerId()}`;
        const p = productMap().get(item._id);
        if (!st.selectedProducts.some((x) => x._id === item._id)) st.selectedProducts = [...st.selectedProducts, p || { _id: item._id, name: item.name }];
        const prev = Number(item.quantity || 1);
        st.quantities = { ...st.quantities, [key]: prev };
        st.tempQuantities = { ...st.tempQuantities, [key]: prev > 0 ? String(prev) : '' };
        const iq = { ...st.invalidQuantities }; delete iq[key]; st.invalidQuantities = iq;
      },
      onConfirm: (deletedIds, options) => createPurchaseOrder(deletedIds, options),
    };
  }

  /** handleCreatePurchaseOrder: the lines, their cost, and the supplier — then closes the drawer. */
  async function createPurchaseOrder(deletedIds = [], options = {}) {
    try {
      st.isLoading = true; render();
      let costPrice = 0;
      let totalQuantity = 0;
      const products = [];
      const map = productMap();
      for (const [key, qty] of Object.entries(st.quantities)) {
        const [pid, cid] = key.split('-');
        if (!(qty > 0) || deletedIds.includes(pid)) continue;
        const stale = st.selectedProducts.find((p) => p._id === pid);
        if (!stale) continue;
        const product = map.get(pid) || stale;
        if (product._notSuppliedByThisSupplier) continue;
        const [base] = getProductPrice(product, cid) || [product.price || 0];
        const orderingUnit = effectiveUnit(product);
        const idx = host.getUnitIndexForUnit(product, orderingUnit);
        const orderQty = String(qty);
        const boxes = Number(product.boxes || 1) || 1;
        const pallets = Number(product.pallets || 1) || 1;
        const baseUnitQty = host.getBaseUnitQuantityFromQuantity(Number(orderQty), boxes, pallets, idx);
        const { _notSuppliedByThisSupplier: _x, ...data } = product;
        const edited = st.customPrices[`${pid}-${cid}`] !== undefined;
        const newPrice = edited ? `${Number(host.calculateItemPrice({ ...product, offerPrice: base, qty: 1 })).toFixed(2)} ${currency}/${orderingUnit}` : undefined;
        products.push({
          ...data, _id: product._id, id: product._id, name: product.name, measurement: product.measurement || 'Unit', unitPrice: product.unitPrice,
          price: Number(base), offerPrice: Number(base), priceMap: product.priceMap || {}, offerPriceMap: product.offerPriceMap || {}, qty: orderQty,
          stock: Number(product.quantity ?? 0), barcode: product.barcode || '', isInventoryEnabled: Boolean(product.isInventoryEnabled ?? true), tax: product.tax || 0,
          priceCalculationUnitIndex: idx, maxRetailPrice: Number(product.maxRetailPrice || 0),
          attributes: product.attributes && typeof product.attributes === 'object' ? product.attributes : { sku: '' },
          palletCount: Number(product.pallets || 1), orderingUnit, baseUnitQty, ...(newPrice !== undefined ? { newPrice } : {}),
        });
        totalQuantity += Number(orderQty);
        costPrice += Number(host.calculateItemPrice({ ...product, offerPrice: base, priceCalculationUnitIndex: idx, qty: Number(orderQty) }));
      }
      const payload = {
        costPrice, transportationCost: 0, salePrice: host.getNumberTwo(costPrice), purchaseQty: String(totalQuantity), logisticsType: 'Courier/Parcel',
        products, buyerLocationStoreId: host.getCurrentLocationId(), orderComments: options.comment !== undefined ? options.comment : st.comment || '',
      };
      const src = st.selectedSource;
      if (src?._sourceType === 'internalSupplier') payload.supplier = { _id: src._id, orgId: src.orgId };
      else if (src?._sourceType === 'externalSupplier') { payload.supplier_id = src._id; payload.supplier = null; }
      await server.createPurchaseOrder(payload);
      host.notify('success', 'Purchase order placed successfully');
      st.quantities = {}; st.tempQuantities = {}; st.selectedProducts = []; st.selectedCustomers = [];
      st.productSearchInput = ''; st.productSearch = ''; st.selectedSubcategory = ''; st.customPrices = {}; st.comment = '';
      st.isLoading = false; st.cartOpen = false;
      close();
    } catch (err) {
      host.notify('error', err?.response?.data?.message || err?.message || 'Failed to create order');
      if (st) { st.isLoading = false; st.cartOpen = false; render(); }
    }
  }

  function render(opening = false) {
    if (!st) return;
    runSeeder();
    onCatalogueChange();
    syncPaging();
    const flat = flattened();
    // The prompt renders BEFORE the drawer's content, as production's does; a comment holds its
    // place while it is closed, so opening it never displaces (and re-creates) the content.
    const html = (st.showDiscard ? discardChangesModal({ title: 'Discard Changes', description: 'Are you sure you want to discard the changes ?', waitAct: 'co-discard-wait', discardAct: 'co-discard' }) : '<!--discard-changes-->')
      + addItem.render() + addSupplier.render()
      + `<div class="relative w-full h-full flex flex-col bg-white dark:bg-gray-800">${gate()}${header()}<div class="flex-1 flex flex-col overflow-hidden">${topBar(flat)}${main(flat)}${footer()}</div>${cart.render()}${policyModal()}</div>`;
    drawer.render(html, opening ? true : undefined);
    afterRender();
  }

  function afterRender() {
    const body = drawer.body();
    if (!body) return;
    if (st.focusSourceSearch) { st.focusSourceSearch = false; body.querySelector('[data-co-source-search]')?.focus(); }
    if (st.focusPrice) {
      st.focusPrice = false;
      const inputs = [...body.querySelectorAll('[data-co-price]')].filter((el) => el.offsetParent !== null);
      (inputs[0] || body.querySelector('[data-co-price]'))?.focus();
    }
    cart.afterRender(body);
    addItem.afterRender(body);
    addSupplier.afterRender(body);
    // The infinite-scroll sentinel: whichever one is laid out.
    observer?.disconnect();
    const sc = body.querySelector('[data-co-scroll]');
    const sentinelEl = [...body.querySelectorAll('[data-co-sentinel]')].find((el) => el.offsetParent !== null);
    if (sc && sentinelEl) {
      observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && st) { st.visibleCount = Math.min(st.visibleCount + PAGE_SIZE, flattened().length); render(); }
      }, { root: sc, rootMargin: '0px 0px 300px 0px', threshold: 0 });
      observer.observe(sentinelEl);
    }
  }

  // ── Events ────────────────────────────────────────────────────────────────────────────────
  const find = (id) => flattened().find((p) => p._id === id) || productMap().get(id);
  const H = drawer.host;
  H.addEventListener('click', (e) => {
    if (!st) return;
    if (addItem.handleClick(e)) return;
    if (addSupplier.handleClick(e)) return;
    if (cart.handleClick(e)) return;
    const el = e.target.closest('[data-act]');
    if (!el || !H.contains(el)) return;
    const act = el.dataset.act;
    const id = el.dataset.id;
    switch (act) {
      case 'source-toggle': st.dropdownOpen = !st.dropdownOpen; st.sourceSearch = ''; st.focusSourceSearch = st.dropdownOpen; break;
      case 'source-pick': selectSource(selectableSources().find((s) => String(s._id) === id && s._sourceType === el.dataset.kind)); return;
      case 'source-create': st.dropdownOpen = false; st.sourceSearch = ''; addSupplier.open(); break;
      // The gate's Cancel is the host's closeDrawer: it closes without asking.
      case 'gate-cancel': close(); return;
      // openAddItemModal: in sourcing the type is asked first.
      case 'add-item': addItem.open(null); break;
      case 'policy': { const pr = flattened().find((x) => String(x._id) === id); st.policyDetails = policyOf(pr) || null; break; }
      case 'policy-close': st.policyDetails = null; break;
      case 'subcategory': st.selectedSubcategory = id || ''; st.productSearchInput = ''; setSearch(''); break;
      case 'clear-filters': st.productSearchInput = ''; st.selectedSubcategory = ''; setSearch(''); break;
      case 'raw-material': toggleRawMaterial(); return;
      case 'raw-material-chip': if (!st.isRawMaterialMode) toggleRawMaterial(); return;
      case 'finished-goods': if (st.isRawMaterialMode) toggleRawMaterial(); return;
      case 'category-toggle': {
        const c = activeCatalogue().find((x) => String(x._id) === id);
        const next = new Set(st.expanded);
        if (next.has(c._id)) { next.delete(c._id); if (c.subCategories?.some((s) => String(s._id) === String(st.selectedSubcategory))) st.selectedSubcategory = ''; } else next.add(c._id);
        st.expanded = next; break;
      }
      case 'unit-toggle': if (el.dataset.multi) st.openUnitDropdown = st.openUnitDropdown === id ? null : id; break;
      case 'unit-pick': st.selectedOrderingUnits = { ...st.selectedOrderingUnits, [id]: el.dataset.unit }; st.openUnitDropdown = null; break;
      case 'qty-step': {
        const p = find(id);
        const key = `${id}-${customerId()}`;
        const qty = getQuantity(id, customerId());
        const temp = st.tempQuantities[key] !== undefined ? st.tempQuantities[key] : String(qty || (el.closest('[data-testid^="create-order-mobile"]') ? 0 : ''));
        const tq = Number(String(temp ?? '').trim() || 0);
        const cur = Number.isNaN(tq) ? Number(qty || 0) : tq;
        qtyChange(p, String(el.dataset.step === '1' ? cur + 1 : Math.max(0, cur - 1)));
        return;
      }
      case 'price-edit': {
        const p = find(id);
        startEditPrice(id, customerId(), unitPrice(p, customerId(), effectiveUnit(p)), effectiveUnit(p), el.hasAttribute('data-mobile') ? null : p);
        break;
      }
      case 'price-confirm': confirmPrice(id, customerId()); break;
      case 'price-cancel': cancelEdit(); break;
      case 'submit':
        if (!st.selectedSource) { st.showSupplierTooltip = true; setTimeout(() => { if (st) { st.showSupplierTooltip = false; render(); } }, 2500); break; }
        st.showSupplierTooltip = false; st.cartOpen = true; break;
      case 'co-discard-wait': pendingResolve?.(false); pendingResolve = null; st.showDiscard = false; break;
      case 'co-discard': { const r = pendingResolve; pendingResolve = null; st.showDiscard = false; r?.(true); return; }
      default: return;
    }
    render();
  });

  function setSearch(v) {
    clearTimeout(searchTimer);
    if (v.trim()) {
      st.isSearching = true;
      searchTimer = setTimeout(() => { if (!st) return; st.productSearch = v; st.isSearching = false; render(); }, 300);
    } else { st.productSearch = ''; st.isSearching = false; }
  }

  H.addEventListener('input', (e) => {
    if (!st) return;
    if (addItem.handleInput(e)) return;
    if (addSupplier.handleInput(e)) return;
    if (cart.handleInput(e)) return;
    const el = e.target;
    if (el.matches('[data-co-source-search]')) { st.sourceSearch = el.value; render(); return; }
    if (el.matches('[data-co-search]')) { st.productSearchInput = el.value; setSearch(el.value); render(); return; }
    if (el.matches('[data-co-qty]')) { qtyChange(find(el.dataset.coQty), el.value); return; }
    if (el.matches('[data-co-price]')) { st.tempPrice = el.value; if (!el.hasAttribute('data-mobile')) st.priceError = ''; render(); return; }
    if (el.matches('[data-co-comment]')) { st.comment = el.value; render(); }
  });
  H.addEventListener('keydown', (e) => {
    if (!st) return;
    if (addSupplier.handleKeydown(e)) return;
    if (cart.handleKeydown(e)) return;
    const el = e.target;
    if (el.matches('[data-co-price]')) {
      if (e.key === 'Enter') { confirmPrice(el.dataset.coPrice, customerId()); render(); }
      else if (e.key === 'Escape') { cancelEdit(); render(); }
      return;
    }
    if (el.matches('[data-co-qty]')) {
      const mobile = el.hasAttribute('data-mobile');
      const index = Number((el.id.match(/(\d+)$/) || [])[1]);
      const go = (i) => { const n = document.getElementById(`${mobile ? 'mobile-qty-input' : 'qty-input'}-${i}`); if (n) { n.focus(); n.select(); } };
      if (e.key === 'ArrowUp') { e.preventDefault(); go(index - 1); } else if (e.key === 'ArrowDown' || (mobile && e.key === 'Enter')) { e.preventDefault(); go(index + 1); }
    }
  });
  H.addEventListener('focusin', (e) => {
    const el = e.target;
    if (st && el.matches('[data-co-qty]:not([data-mobile])') && String(el.value) === '0') requestAnimationFrame(() => el.select());
  });
  H.addEventListener('mousedown', (e) => { if (st) { addItem.handleMouseDown(e); addSupplier.handleMouseDown(e); } });
  H.addEventListener('change', (e) => { if (st) addItem.handleChange(e); });
  H.addEventListener('submit', (e) => { if (st) addItem.handleSubmit(e); });
  H.addEventListener('focusout', (e) => {
    addItem.handleFocusOut(e);
    addSupplier.handleFocusOut(e);
    const el = e.target;
    if (!st || !el.matches('[data-co-qty][data-mobile]')) return;
    // MobileOrderProductPanel's blur: an empty or zero entry is committed as 0.
    const trimmed = String(el.value || '').trim();
    if (trimmed === '' || trimmed === '0') qtyChange(find(el.dataset.coQty), '0');
  });
  // onMouseEnter / onMouseLeave of the submit button's wrapper (a disabled button fires neither).
  H.addEventListener('mouseover', (e) => {
    const w = e.target.closest?.('[data-co-hover]');
    if (st && w && !w.contains(e.relatedTarget) && !st.hovering) { st.hovering = true; render(); }
  });
  H.addEventListener('mouseout', (e) => {
    const w = e.target.closest?.('[data-co-hover]');
    if (st && w && !w.contains(e.relatedTarget) && st.hovering) { st.hovering = false; render(); }
  });
  // Outside clicks close the open dropdowns (production's document listeners).
  document.addEventListener('pointerdown', (e) => {
    if (st && st.openUnitDropdown !== null && !e.target.closest('[data-order-unit-dropdown]')) { st.openUnitDropdown = null; render(); }
  });
  document.addEventListener('mousedown', (e) => {
    if (st && st.dropdownOpen && !e.target.closest('[data-co-source]')) { st.dropdownOpen = false; render(); }
  });

  return { open, get isOpen() { return Boolean(st); } };
}

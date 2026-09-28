/*
  The prototype's in-page "server": what production's backend answers the screen, computed from the
  same documents the parity oracle is seeded with (js/data/documents.js). Each method mirrors one
  endpoint of the module's Express app (foodbridge-module-purchase backend/src/api/server.ts) or one
  host endpoint, with the same rules — and answers through JSON, as the network would (dates become
  ISO strings, objects are copies).

  ?scenario=empty | error | loading changes how the purchase-order list answers.
*/
import { toModuleDocs, IDS } from '../data/documents.js';
import { createMinter } from '../data/resolve.js';
import { stockSummary, createPurchaseOrder, supplierRepo, categoryProductTree, catalogueWritePort, salesOrderList, orderHistory, customerCatalogues } from '../data/host-backend.js';

const json = (v) => JSON.parse(JSON.stringify(v));
const later = (v, ms = 0) => new Promise((resolve) => setTimeout(() => resolve(json(v)), ms));

/** backend repos/orderNode.ts toOrderNode: audits stripped, item_list from the latest itemListAudit. */
export function toOrderNode(raw) {
  const { itemListAudit, statusAudit, ...rest } = raw;
  const item_list = Array.isArray(itemListAudit) && itemListAudit.length
    ? (Array.isArray(itemListAudit[itemListAudit.length - 1]?.itemList) ? itemListAudit[itemListAudit.length - 1].itemList : [])
    : (Array.isArray(raw.item_list) ? raw.item_list : []);
  return { ...rest, _id: String(raw._id), item_list, type: raw.type || 'ORDER', relations: raw.relations || [] };
}

const timeOf = (n) => new Date(n.created_date || n.createdAt || 0).getTime();

const reject = (status, message, body) => Promise.reject(Object.assign(new Error(message), { response: { status, data: body || { status: false, message } } }));
const DOC_TYPES = ['SUPPLIER_INVOICE', 'DEBIT_NOTE', 'CREDIT_NOTE', 'OTHER'];
const MAX_ATTACHMENTS = 3;
const MAX_EXPENSES = 20;

/** purchaseOrderDocumentService.parseExpenses: the expense list the backend accepts, or a 400. */
function parseExpenses(raw) {
  let list = raw;
  if (typeof raw === 'string') { try { list = JSON.parse(raw); } catch { throw [400, 'expenses must be a JSON array']; } }
  if (!Array.isArray(list)) throw [400, 'expenses must be a JSON array'];
  if (list.length > MAX_EXPENSES) throw [400, `A supplier invoice can have at most ${MAX_EXPENSES} expenses`];
  return list.map((row, i) => {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) throw [400, `expenses[${i}] must be an object`];
    const type = typeof row.type === 'string' ? row.type.trim() : '';
    if (!type) throw [400, `expenses[${i}].type is required`];
    const amount = typeof row.amount === 'number' || (typeof row.amount === 'string' && row.amount.trim() !== '') ? Number(row.amount) : NaN;
    if (!Number.isFinite(amount) || amount <= 0) throw [400, `expenses[${i}].amount must be a positive number`];
    if (row.remarks != null && typeof row.remarks !== 'string') throw [400, `expenses[${i}].remarks must be a string`];
    return { type, amount, remarks: row.remarks ?? '', ...(typeof row._id === 'string' ? { _id: row._id } : {}) };
  });
}

/** mulberry32 from a fixed seed: the n-th draw after a (re)load is always the same number. */
function seededRandom() {
  let seed = 0x9a7c3;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * services/catalogueService.ts over the catalogue documents: the priced ROOT → SUBCATEGORY →
 * PRODUCT tree (all three under `categories`), built child-up from the products' categories. A
 * catalogue entry's offer prices overwrite the product's own — on the stored document, as the
 * repository hands the service its own objects.
 */
function catalogueService(cat) {
  const ids = (list) => (list || []).flatMap((c) => (Array.isArray(c?.products) && c.products.length ? c.products.map((p) => String(p?.id)) : [])).filter(Boolean);
  const pick = (rows, want) => rows.filter((r) => want.includes(String(r._id)));
  const findCatalogues = (loc, types) => cat.catalogues.filter((c) => String(c.locationReference) === loc && (c.catalogueType === 'MASTER' || types.includes(String(c.customerTypeReference))));

  function buildTree(productIds, catalogues, locationId) {
    if (!productIds.length) return [];
    const docs = pick(cat.products, productIds);
    if (!docs.length) return [];
    const byId = new Map(docs.map((p) => [String(p._id), p]));
    for (const c of catalogues) for (const e of c.products || []) { const p = byId.get(String(e?.id)); if (p) { p.offerPrice = e?.offerPrice; p.offerPriceMap = e?.offerPriceMap; } }
    const categoryById = new Map();
    let level = [...new Set(docs.map((p) => String(p.categoryReference || '')).filter(Boolean))];
    for (let depth = 0; depth < 20 && level.length; depth += 1) {
      const next = [];
      for (const doc of pick(cat.categories, level)) {
        const id = String(doc._id);
        if (categoryById.has(id)) continue;
        categoryById.set(id, doc);
        const parent = doc.parentCategoryReference ? String(doc.parentCategoryReference) : '';
        if (parent && !categoryById.has(parent)) next.push(parent);
      }
      level = [...new Set(next)];
    }
    // Policies (batched), and each one's owner: policy → its location → that location's org.
    const policyById = new Map(pick(cat.policies || [], [...new Set(docs.flatMap((p) => (Array.isArray(p.policyTemplateReference) ? p.policyTemplateReference : []).filter(Boolean).map(String)))]).map((x) => [String(x._id), x]));
    const policyTemplateFor = (p) => {
      const refs = p.policyTemplateReference;
      if (!Array.isArray(refs) || refs.length === 0) return [];
      return refs.map((ref) => {
        const policy = policyById.get(String(ref));
        if (!policy) return null;
        const at = String(policy.locationStoreReference || '');
        const loc = (cat.locations || []).find((l) => String(l._id) === at);
        const owner = (cat.orgs || []).find((o) => String(o._id) === String(loc?.orgId));
        return { canEditPolicy: at === locationId, owner: { name: owner?.name ?? '' }, templateDetail: JSON.parse(JSON.stringify(policy)) };
      });
    };
    const nodes = new Map([...categoryById].map(([id, doc]) => [id, { id, name: doc.name, rank: typeof doc.rank === 'number' ? doc.rank : -1, parentId: doc.parentCategoryReference ? String(doc.parentCategoryReference) : '', children: [], products: [] }]));
    for (const p of docs) nodes.get(String(p.categoryReference))?.products.push(p);
    const roots = [];
    for (const n of nodes.values()) { const parent = n.parentId ? nodes.get(n.parentId) : undefined; if (parent) parent.children.push(n); else roots.push(n); }
    const toProduct = (p, sub, root) => ({
      id: String(p._id), name: p.name, unitPrice: `${p.price}/${p.measurement}`, qty: '', stock: p.stock, comments: '', categoryId: sub, parentCategoryId: root,
      articleNumber: p.articleNo, description: p.desc, imagesUrl: [], boxes: p.boxes, pallets: p.pallets, status: p.status, priceMap: p.priceMap, barcode: p.barcode,
      isInventoryEnabled: p.isInventoryEnabled, tax: p.tax ? p.tax : 0, offerPrice: p.offerPrice ? p.offerPrice : p.price, brand: p.brand ? p.brand : '',
      maxRetailPrice: p.maxRetailPrice ? p.maxRetailPrice : 0, variants: p.variants ? p.variants : [], attributes: p.attributes, policyTemplate: policyTemplateFor(p), offerPriceMap: p.offerPriceMap,
    });
    const active = (list) => list.filter((d) => !d.status || d.status === 'ACTIVE').length;
    return roots.map((root) => {
      const descendants = [];
      const collect = (n) => { for (const c of n.children) { descendants.push(c); collect(c); } };
      collect(root);
      let rootActive = 0;
      const subs = (root.products.length ? [root, ...descendants] : descendants).map((sub) => {
        rootActive += active(sub.products);
        return { id: sub.id, name: sub.name, rank: sub.rank, activeProductCount: active(sub.products), categories: sub.products.map((p) => toProduct(p, sub.id, root.id)) };
      });
      return { id: root.id, name: root.name, rank: root.rank, activeProductCount: rootActive, categories: subs };
    });
  }

  return {
    getProductList(org, loc) {
      const o = cat.orgs.find((x) => String(x._id) === org);
      if (!o || !(o.locationCustomerTypeRefMap || []).some((e) => String(e?.locationRef) === loc)) return [];
      const types = o.locationCustomerTypeRefMap.filter((e) => String(e.locationRef) === loc).map((e) => String(e.customerTypeRef));
      const catalogues = findCatalogues(loc, types);
      const customer = catalogues.filter((c) => types.includes(String(c.customerTypeReference))).slice(0, 1);
      if (!customer.length) return [];
      const master = new Set(ids(catalogues.filter((c) => c.catalogueType === 'MASTER')));
      return buildTree(ids(customer).filter((id) => master.has(id)), customer, loc);
    },
    getCatalogueProducts(catalogueId) {
      const c = cat.catalogues.find((x) => String(x._id) === catalogueId);
      if (!c) return null;
      const master = new Set(ids(findCatalogues(String(c.locationReference), [])));
      return buildTree(ids([c]).filter((id) => master.has(id)), [c], String(c.locationReference));
    },
    getDefaultCustomerCatalogue: (loc) => cat.catalogues.filter((c) => String(c.locationReference) === loc && c.catalogueType === 'CUSTOMER' && c.name === 'DEFAULT'),
  };
}

export function createServer(dataset, { now, scenario }) {
  const docs = toModuleDocs(dataset, now);
  const catalogue = catalogueService(docs.catalogue);
  // Records created while the screen runs, each kind from its own sequence (the oracle's too).
  const minters = { po: createMinter('po', 900), ord: createMinter('ord', 900), sup: createMinter('sup', 900), prd: createMinter('prd', 900), cat: createMinter('cat', 900), ctl: createMinter('ctl', 900) };
  const newRecordId = (kind) => minters[kind]();
  const random = seededRandom();
  const caller = { organisationId: IDS.org, userId: IDS.user, locationStoreId: IDS.location };
  const writes = catalogueWritePort(docs, { newId: (k) => newRecordId(k), now });
  // New documents, attachments and expenses get ids from the same sequence the oracle uses.
  const newObjectId = createMinter('doc', 500);
  const uploads = new Map(); // url → the File, so a stored attachment opens in this browser
  const paymentsRecorded = [];
  const d = docs.d;
  const nodes = new Map([...docs.purchaseOrders, ...docs.orders, ...docs.dispatches].map((n) => [String(n._id), n]));

  /** services/purchaseOrderListService.ts — PO → ORDER (relations) → DISPATCH (hasDispatch), latest wins. */
  function listPurchaseOrders() {
    const pos = docs.purchaseOrders.filter((p) => p.buyer_location_id === IDS.location).map(toOrderNode);
    return pos.map((po) => {
      let latest = null;
      const orderIds = new Set();
      for (const rel of po.relations) for (const v of [rel?.destinationId, rel?.sourceId]) if (v && String(v) !== po._id) orderIds.add(String(v));
      for (const oid of orderIds) {
        const order = nodes.get(oid);
        if (!order || (order.type && order.type !== 'ORDER')) continue;
        for (const rel of order.relations || []) {
          if (rel?.relationType !== 'hasDispatch') continue;
          const dest = rel.destinationId && String(rel.destinationId) !== oid ? String(rel.destinationId) : String(rel.sourceId);
          const dispatch = nodes.get(dest);
          if (!dispatch || dispatch.type !== 'DISPATCH') continue;
          if (!latest || timeOf(dispatch) > timeOf(latest)) latest = dispatch;
        }
      }
      return { ...po, dispatchStatus: latest?.status ?? null, dispatchId: latest?._id ?? null };
    });
  }

  /**
   * services/purchaseForecastService.ts — outstanding sales demand (last 30 days, excluding
   * Draft/Cancelled/void) against each product's stock, clamped up to its MOQ, largest first.
   */
  function forecast() {
    const EXCLUDED = ['Draft', 'Draft Stock requested', 'Cancelled', 'void'];
    const windowStart = now - 30 * 86400000;
    const round2 = (n) => Math.round(n * 100) / 100;
    const demand = new Map();
    for (const so of d.salesOrders) {
      if (so.createdAt.getTime() < windowStart || EXCLUDED.includes(so.status)) continue;
      for (const l of so.lines) {
        const qty = parseFloat(Number(l.qty).toFixed(4));
        if (qty <= 0) continue;
        demand.set(l.product.articleNo, (demand.get(l.product.articleNo) || 0) + qty);
      }
    }
    const recs = [];
    for (const [articleNumber, qty] of demand) {
      const p = d.products.find((x) => x.articleNo === articleNumber);
      if (!p) continue;
      const dem = round2(qty);
      const stock = Number(p.stock) || 0;
      const moq = p.moq ?? 1;
      let rec = stock < 0 ? Math.max(dem, -stock) : Math.max(dem - stock, 0);
      if (rec > 0) rec = Math.max(rec, moq);
      rec = round2(rec);
      const cat = d.categories.find((c) => c.id === p.categoryId);
      recs.push({
        articleNumber, productId: docs.productId(p.id), name: p.name || null,
        category: cat ? { id: docs.categoryId(cat.id), name: cat.name } : null,
        measurement: p.measurement || null, unitPrice: `${p.price}/${p.measurement || ''}`,
        boxes: p.boxes, pallets: p.pallets, priceMap: p.priceMap || {}, price: p.price, offerPrice: p.price,
        costPrice: null, moq, demand: dem, currentStock: stock, recommendedQuantity: rec, supplier: null,
      });
    }
    return recs.sort((a, b) => b.recommendedQuantity - a.recommendedQuantity);
  }

  return {
    docs,
    // GET /v3/purchase/purchase-orders
    listPurchaseOrders() {
      if (scenario === 'loading') return new Promise(() => {});
      if (scenario === 'error') return Promise.reject(Object.assign(new Error('server failure connection reset'), { response: { status: 500, data: { status: false, message: 'server failure connection reset' } } }));
      return later(scenario === 'empty' ? [] : listPurchaseOrders());
    },
    // GET /v3/purchase/list — every supplier linked to the org, deactivated and DEPARTMENT included.
    listExternalSuppliers: () => later(docs.suppliers),
    // GET /v3/purchase/seller-list — the locations this user holds a sourcing role at.
    listSelectableInternalSources: () => later(docs.locations),
    // Host: groupedLocationData.sellerLocations first, then cafex's /sourcing/seller-list.
    listInternalLocations: () => later([docs.store, ...docs.locations.filter((l) => l._id !== docs.store._id)]),
    // GET /v3/purchase/forecast/recommendations
    forecastRecommendations: () => later(forecast()),

    // ── The create drawer's catalogue: the module's endpoints, whole envelopes as the port returns them ──
    // GET /v3/purchase/productlist[?storeId=] — sorted by rank, highest first, with `updatedOn`.
    getProductList(storeId) {
      const products = catalogue.getProductList(IDS.org, storeId || IDS.location).sort((a, b) => (b.rank ?? -1) - (a.rank ?? -1));
      return later({ status: true, data: { products, updatedOn: new Date(now).toISOString() } });
    },
    // Host: GET /v2/productlist/getList?storeId= — the same price list, but sorted as cafex sorts it
    // (rank ASCENDING) and dated dd/mm/yyyy.
    getHostProductList(storeId) {
      const products = catalogue.getProductList(IDS.org, storeId || IDS.location).sort((a, b) => (b.rank > a.rank ? -1 : 1));
      const d = new Date(now); const two = (n) => (n < 10 ? `0${n}` : `${n}`);
      return later({ status: true, data: { products, updatedOn: `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}` } });
    },
    // GET /v3/purchase/catalogue/default
    getDefaultCatalogue: () => later({ status: true, message: 'Default catalogue fetched', data: catalogue.getDefaultCustomerCatalogue(IDS.location) }),
    // GET /v3/purchase/catalogue/products?catalogueId=
    getCatalogueProducts(catalogueId) {
      const data = catalogue.getCatalogueProducts(String(catalogueId));
      return data ? later({ status: true, message: 'Catalogue products fetched', data }) : reject(404, `Catalogue with ID: ${catalogueId} doesnt exitst`);
    },
    // Host: GET /v2/productlist/getAll[?catalogueType=] — the master-catalogue tree (CataloguePort.getCategoryProductTree).
    getCategoryProductTree: ({ catalogueType } = {}) => later(categoryProductTree(docs, { catalogueType }, now)),
    // The Raw Material Calculator's host reads: GET /v4/orders, /v2/orderhistory/get, /v4/catalogue/get.
    listSalesOrders: (query = {}) => later(salesOrderList(docs, query)),
    getOrderHistory: () => later(orderHistory(docs)),
    getCustomerCatalogues: () => later(customerCatalogues(docs)),
    // GET /v3/purchase/catalogue/categories — catalogueService.getCategoryDirectory: one "Home" root whose
    // children are the location's SUBcategories (RETURNABLE and DEFAULT roots hidden); no icon base.
    listCategories() {
      const cat = docs.catalogue;
      const text = (v) => (typeof v === 'string' ? v : typeof v?.en === 'string' ? v.en : '');
      const roots = cat.categories.filter((c) => !c.parentCategoryReference && String(c.locationReference) === IDS.location).filter((r) => !['RETURNABLE', 'DEFAULT'].includes(text(r.name)));
      const ids = roots.map((r) => String(r._id));
      const subs = cat.categories.filter((c) => ids.includes(String(c.parentCategoryReference || '')));
      const children = roots.flatMap((root) => subs.filter((sub) => String(sub.parentCategoryReference) === String(root._id)).map((sub) => ({
        _id: String(sub._id), name: { en: text(sub.name) }, description: { en: text(sub.description) }, parentId: String(root._id), parentName: text(root.name), icon: '', status: 'show', children: [],
      })));
      return later({ status: true, message: 'Categories fetched', data: [{ _id: '', name: { en: 'Home' }, description: { en: 'This is Home Category' }, parentName: 'Home', status: 'show', children }] });
    },
    // POST /v3/purchase/catalogue/product | category | product-image — catalogueWriteService over the host's port.
    async createProduct(body) {
      if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length) return reject(400, 'product payload is required');
      const out = await writes.createProduct(caller, json(body));
      return out.statusCode >= 400 ? reject(out.statusCode, out.body.message, out.body) : later(out.body);
    },
    async createCategory(body) {
      if (!body || typeof body !== 'object' || typeof body.name !== 'object' || body.name === null) return reject(400, 'category name is required');
      const out = await writes.createCategory(caller, json(body));
      return out.statusCode >= 400 ? reject(out.statusCode, out.body.message, out.body) : later(out.body);
    },
    async uploadProductImage(fd) {
      const file = fd.getAll('files')[0];
      if (!file) return reject(400, 'No file provided');
      if (!fd.has('articleNumber') || !String(fd.get('articleNumber')).trim()) return reject(400, 'articleNumber is required');
      const fields = {};
      for (const k of ['articleNumber', 'index', 'isProductImageDeleted', 'resolution']) if (fd.has(k)) fields[k] = String(fd.get(k));
      const out = await writes.uploadProductImage(caller, file, fields);
      return out.statusCode >= 400 ? reject(out.statusCode, out.body.message, out.body) : later(out.body);
    },
    // GET /v3/purchase/order/stock-summary — the host's engine (StockSummaryPort).
    getStockSummary: () => later({ status: true, message: 'Stock summary fetched successfully', data: stockSummary(docs, { outstandingOnly: false }) }),
    /**
     * POST /v3/purchase/purchase-order — proxied to the host's creation handler (cafex
     * orderPropogateUpHandler), which answers the envelope itself. The new nodes join the graph.
     */
    createPurchaseOrder(payload) {
      const out = createPurchaseOrder(docs, json(payload), { now, random, newId: newRecordId });
      if (out.status >= 400) return reject(out.status, out.body.message);
      for (const n of [...docs.purchaseOrders, ...docs.orders]) nodes.set(String(n._id), n);
      return later(out.body);
    },
    /**
     * POST /v3/purchase/add — supplierService.register: name and contact required; an existing
     * supplier with that contact is linked to the organisation instead of duplicated. The opening
     * balance goes to the host's port, which only records here.
     */
    async createSupplier(input = {}) {
      const { name, contact, supplierType } = input;
      const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
      if (!nonEmpty(name) || !nonEmpty(contact)) return reject(400, 'Name, Contact is required');
      if (!['EXTERNAL', 'DEPARTMENT'].includes(supplierType)) return reject(400, 'Invalid Supplier Type');
      const repo = supplierRepo(docs, newRecordId, now);
      const existing = (await repo.findByContact(contact))[0];
      let id;
      if (existing) { await repo.addOrganisation(existing._id, IDS.org); id = existing._id; }
      else id = await repo.insert({ name, contact, orgRefs: [IDS.org], email: input.email, supplierCode: input.supplierCode, gstNumber: input.gstNumber, address: input.address, state: input.state, postNumber: input.postNumber, gstType: input.gstType, supplierType });
      return later({ status: true, message: 'Supplier Added Successfully', data: { id } });
    },
    /**
     * POST /v3/purchase/purchase-order/document — purchaseOrderDocumentService + its repo: the
     * fields present decide the write (remove / replace / add attachments / edit details / new
     * document). Files are "stored" as object URLs in this browser (the host uploads them to S3).
     */
    uploadPurchaseOrderDocument(fd) {
      const field = (k) => (fd.has(k) ? fd.get(k) : undefined);
      const r = {
        purchaseOrderId: field('purchaseOrderId'), documentId: field('documentId'), type: field('type'), attachmentId: field('attachmentId'),
        removeAttachmentId: field('removeAttachmentId'), name: field('name'), amount: field('amount'), remarks: field('remarks'), expenses: field('expenses'),
      };
      const files = fd.getAll('files');
      const at = new Date(now);
      const store = (list) => list.map((f) => { const url = URL.createObjectURL(f); uploads.set(url, f); return { url }; });
      try {
        if (!r.purchaseOrderId) throw [400, 'purchaseOrderId is required'];
        if (r.attachmentId && r.removeAttachmentId) throw [400, 'Cannot replace and remove an attachment in the same request'];
        const order = docs.purchaseOrders.find((p) => String(p._id) === String(r.purchaseOrderId));
        if (!order) throw [404, 'Purchase order not found'];
        const entryOf = () => {
          const entry = (order.purchaseOrderDocuments || []).find((d) => String(d._id) === String(r.documentId));
          if (!entry) throw [404, 'Document record not found'];
          const attachments = entry.attachments?.length ? entry.attachments : entry.documentUrl ? [{ _id: entry._id, url: entry.documentUrl, uploadedAt: entry.uploadedAt }] : [];
          return { entry, attachments };
        };
        const setAttachments = (entry, list) => { entry.attachments = list; entry.uploadedAt = at; delete entry.documentUrl; order.modified_date = at; };
        const settle = (inputs, existing) => {
          const known = new Map((existing || []).map((e) => [String(e._id), e._id]));
          return inputs.map((e) => ({ _id: (e._id !== undefined && known.get(String(e._id))) || newObjectId(), type: e.type, amount: e.amount, remarks: e.remarks }));
        };
        let result;
        if (r.documentId && r.removeAttachmentId) {
          if (files.length) throw [400, 'Cannot upload files while removing an attachment'];
          const { entry, attachments } = entryOf();
          const i = attachments.findIndex((a) => String(a._id) === String(r.removeAttachmentId));
          if (i === -1) throw [404, 'Attachment not found'];
          if (attachments.length <= 1) throw [400, 'A document must have at least one attachment'];
          const updated = attachments.filter((_, k) => k !== i);
          setAttachments(entry, updated);
          result = [200, 'Attachment removed successfully', { documentId: r.documentId, attachments: updated }];
        } else if (r.documentId && r.attachmentId) {
          if (files.length !== 1) throw [400, 'Replacing an attachment requires exactly one file'];
          const [up] = store(files);
          const { entry, attachments } = entryOf();
          const i = attachments.findIndex((a) => String(a._id) === String(r.attachmentId));
          if (i === -1) throw [404, 'Attachment not found'];
          const updated = [...attachments];
          updated[i] = { _id: attachments[i]._id, url: up.url, uploadedAt: at };
          setAttachments(entry, updated);
          result = [200, 'Attachment replaced successfully', { documentId: r.documentId, attachments: updated }];
        } else if (r.documentId && files.length) {
          const up = store(files);
          const { entry, attachments } = entryOf();
          if (attachments.length + up.length > MAX_ATTACHMENTS) throw [400, `A document can have at most ${MAX_ATTACHMENTS} attachments`];
          const updated = [...attachments, ...up.map((f) => ({ _id: newObjectId(), url: f.url, uploadedAt: at }))];
          setAttachments(entry, updated);
          result = [200, 'Attachment added successfully', { documentId: r.documentId, attachments: updated }];
        } else if (r.documentId) {
          const updates = {};
          if (r.name !== undefined) { if (!String(r.name).trim()) throw [400, 'name cannot be empty']; updates.name = String(r.name).trim(); }
          if (r.amount !== undefined) { const a = Number(r.amount); if (!Number.isFinite(a) || a <= 0) throw [400, 'amount must be a positive number']; updates.amount = a; }
          if (r.remarks !== undefined) updates.remarks = r.remarks;
          if (r.expenses !== undefined) updates.expenses = parseExpenses(r.expenses);
          if (!Object.keys(updates).length) throw [400, 'Nothing to update'];
          const { entry, attachments } = entryOf();
          let stored = {};
          if (updates.expenses !== undefined) {
            if (entry.type !== 'SUPPLIER_INVOICE') throw [400, 'Expenses are only allowed on a SUPPLIER_INVOICE'];
            entry.expenses = settle(updates.expenses, entry.expenses);
            stored = { expenses: entry.expenses };
          }
          if (!entry.attachments?.length && attachments.length) { entry.attachments = attachments; delete entry.documentUrl; }
          if (updates.name !== undefined) entry.name = updates.name;
          if (updates.amount !== undefined) entry.amount = updates.amount;
          if (updates.remarks !== undefined) entry.remarks = updates.remarks;
          order.modified_date = at;
          result = [200, 'Document updated successfully', { documentId: r.documentId, ...updates, ...stored }];
        } else {
          if (!files.length) throw [400, 'At least one file is required'];
          if (!DOC_TYPES.includes(r.type)) throw [400, `Invalid document type: ${r.type}`];
          if (r.type === 'OTHER') { if (!r.name || !String(r.name).trim()) throw [400, 'name is required']; } else { const a = Number(r.amount); if (!Number.isFinite(a) || a <= 0) throw [400, 'amount must be a positive number']; }
          let expenses;
          if (r.expenses !== undefined) { if (r.type !== 'SUPPLIER_INVOICE') throw [400, 'Expenses are only allowed on a SUPPLIER_INVOICE']; expenses = parseExpenses(r.expenses); }
          const up = store(files);
          // The repo mints the attachments' ids first, then the record's, then its expenses'.
          const attachments = up.map((f) => ({ _id: newObjectId(), url: f.url, uploadedAt: at }));
          const record = {
            _id: newObjectId(), type: r.type, name: r.name || '', amount: r.amount !== undefined ? Number(r.amount) : null, remarks: r.remarks || '',
            attachments, uploadedBy: IDS.user, uploadedAt: at,
          };
          if (expenses !== undefined) record.expenses = settle(expenses, undefined);
          order.purchaseOrderDocuments = [...(order.purchaseOrderDocuments || []), record];
          order.modified_date = at;
          result = [201, 'Document uploaded successfully', record];
        }
        return later(result[2]);
      } catch (e) {
        if (Array.isArray(e)) return reject(e[0], e[1]);
        throw e;
      }
    },
    /** POST /v3/purchase/supplier/payment-record — the ledger write is the host's; recorded here only. */
    recordSupplierPayment(entry) {
      const { supplierId, paymentAmount, paymentMethod } = entry || {};
      if (!supplierId) return reject(400, 'supplierId is required');
      if (typeof paymentAmount !== 'number' || !Number.isFinite(paymentAmount) || paymentAmount <= 0) return reject(400, 'paymentAmount must be a positive number');
      if (!['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'].includes(paymentMethod)) return reject(400, 'Invalid paymentMethod');
      paymentsRecorded.push({ organisationId: IDS.org, sellerLocationId: IDS.location, supplierId: String(supplierId), paymentAmount, paymentMethod, isWriteoff: entry.transactionType === 'CREDIT_WRITEOFF' });
      return later(null);
    },
    paymentsRecorded,
    /**
     * POST /v3/purchase/order/stage-audit — the module's stageAuditService over the host's port
     * (cafex updateNodeStageAudit): append the stage entries, move the status, merge metaData, and
     * push the challan as the node's newest itemListAudit entry — which is what its item_list reads
     * as from then on. Answers 207 (still a success to the client) when some nodes failed.
     */
    updateNodeStageAudit(nodes) {
      if (!Array.isArray(nodes) || !nodes.length) return Promise.reject(Object.assign(new Error('nodes array is required in request body'), { response: { status: 400, data: { status: false, message: 'nodes array is required in request body' } } }));
      const results = { total: nodes.length, successCount: 0, failureCount: 0, errors: [] };
      for (const { nodeId, nodeType, stageAudit, metaData } of json(nodes)) {
        const node = [...docs.purchaseOrders, ...docs.orders, ...docs.dispatches].find((n) => String(n._id) === String(nodeId));
        if (!Array.isArray(stageAudit) || !stageAudit.length || !node || (nodeType && (node.type || 'ORDER') !== nodeType)) {
          results.failureCount += 1;
          results.errors.push({ nodeId, error: !node ? 'Node not found' : 'nodeId and non-empty stageAudit array are required' });
          continue;
        }
        const first = stageAudit[0];
        const at = new Date(now);
        node.stageAudit = [...(node.stageAudit || []), ...stageAudit.map((st) => ({ ...st, updatedAt: at, updatedBy: IDS.user }))];
        node.modified_date = at;
        if (first.status) node.status = first.status;
        if (metaData) node.metaData = { ...(node.metaData || {}), ...metaData };
        if (Array.isArray(first.challan)) node.itemListAudit = [...(node.itemListAudit || []), { userId: IDS.user, date: now, itemList: first.challan }];
        if (first.status) node.statusAudit = [...(node.statusAudit || []), { userId: IDS.user, roleId: IDS.role, date: at, status: first.status }];
        if (Array.isArray(first.freeItemChallan) && first.freeItemChallan.length) node.freeItems = first.freeItemChallan;
        results.successCount += 1;
      }
      return later({ statusCode: results.failureCount > 0 ? 207 : 200, message: `Updated ${results.successCount} of ${results.total} nodes`, data: results });
    },
  };
}

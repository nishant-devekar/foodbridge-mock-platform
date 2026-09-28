/*
  The ORACLE's API: the production Purchase module's own backend, seeded with the prototype's
  dataset, behind a copy of cafex's /v3/purchase bridge. Run with the module's tsx:

    PURCHASE_MODULE=<…/foodbridge-module-purchase/development>  PARITY_NOW=<epoch ms>
    PARITY_API_PORT=4390  tsx oracle/oracle-api.mts

  What is REAL here: createApp (the module's router), and every service behind it —
  createPurchaseOrderListService, createSupplierService, createSellerListService,
  createPurchaseForecastService, createGraphTraverseService, createOrderNodeService,
  createStageAuditService, createPurchaseOrderDocumentService, createCatalogueService — over the
  module's OWN mock repositories and ports (the test doubles it ships), seeded here.
  What is decided here: only what those repositories hold (to-module-docs.mjs), what the host
  ports do (each shaped after the cafex adapter that wires it in routes/v3/purchase.js), and the
  answers of endpoints other bounded contexts own (/api/v2/multiAdmin/setup, the tenant list,
  cafex's seller list, credit groups).

  The production repos are imported by path and never written to.

  Control:  POST /__parity/scenario  {"list": "normal"|"empty"|"error"|"hang", "tenant": <variant>, "reset": true}
  A request no fixture answers gets `x-parity-gap: 1` and is logged — a gap is loud, never green.
*/
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { toModuleDocs, setupPayload, oid, IDS, SESSION } from './to-module-docs.mjs';
import { createMinter, oid as mint } from '../../../js/data/resolve.js';
import { stockSummary, createPurchaseOrder, supplierRepo, categoryProductTree, catalogueWritePort, salesOrderList, orderHistory, customerCatalogues } from '../../../js/data/host-backend.js';

const PM = process.env.PURCHASE_MODULE;
if (!PM) throw new Error('PURCHASE_MODULE must point at foodbridge-module-purchase/development');
const NOW = Number(process.env.PARITY_NOW || Date.now());
const PORT = Number(process.env.PARITY_API_PORT || 4390);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOCKUP = path.resolve(HERE, '../../..');
const dataset = JSON.parse(fs.readFileSync(path.join(MOCKUP, 'js/data/dataset.json'), 'utf8'));
const baseTenant = JSON.parse(fs.readFileSync(path.join(MOCKUP, 'js/data/tenant.json'), 'utf8'));
const variants = JSON.parse(fs.readFileSync(path.join(MOCKUP, 'js/data/tenant-variants.json'), 'utf8'));

const requireFromModule = createRequire(path.join(PM, 'backend/package.json'));
const express = requireFromModule('express');
const from = (rel: string) => import(pathToFileURL(path.join(PM, 'backend/src', rel)).href);

const { createApp } = await from('api/server.ts');
const { toOrderNode } = await from('repos/orderNode.ts');
const { createSupplierService } = await from('services/supplierService.ts');
const { createMockSupplierRepo } = await from('repos/supplierRepo.mock.ts');
const { createNoopOpeningBalancePort } = await from('ports/openingBalancePort.mock.ts');
const { createPurchaseOrderListService } = await from('services/purchaseOrderListService.ts');
const { createMockPurchaseOrderRepo } = await from('repos/purchaseOrderRepo.mock.ts');
const { createGraphTraverseService } = await from('services/graphTraverseService.ts');
const { createMockGraphRepo } = await from('repos/graphRepo.mock.ts');
const { createSellerListService } = await from('services/sellerListService.ts');
const { createMockSellerDirectoryPort, MOCK_ROLE_IDS } = await from('ports/sellerDirectoryPort.mock.ts');
const { createPurchaseForecastService } = await from('services/purchaseForecastService.ts');
const { createMockForecastRepo } = await from('repos/forecastRepo.mock.ts');
const { createOrderNodeService } = await from('services/orderNodeService.ts');
const { createStageAuditService } = await from('services/stageAuditService.ts');
const { createPurchaseOrderDocumentService } = await from('services/purchaseOrderDocumentService.ts');
const { createPurchaseOrderDocumentRepo } = await from('repos/purchaseOrderDocumentRepo.ts');
const { createSupplierPaymentService } = await from('services/supplierPaymentService.ts');
const { createCatalogueService } = await from('services/catalogueService.ts');
const { createCatalogueWriteService } = await from('services/catalogueWriteService.ts');
const { createMockCatalogueRepo } = await from('repos/catalogueRepo.mock.ts');
const { createMockOrderNodeRepo } = await from('repos/orderNodeRepo.mock.ts');

/*
  The oracle's clock and dice. The browser runs on a fixed clock (PARITY_NOW); so does this server,
  or anything it stamps would differ run to run. Math.random is a seeded mulberry32, re-seeded on
  every reset, so the n-th draw after a reset is always the same number.
*/
const RealDate = Date;
class FixedDate extends RealDate {
  constructor(...a: any[]) { if (a.length) super(...(a as [])); else super(NOW); }
  static now() { return NOW; }
}
(globalThis as any).Date = FixedDate;
let seed = 0;
const reseed = () => { seed = 0x9a7c3; };
Math.random = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
reseed();

function mergeDeep(base: any, over: any): any {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = v && typeof v === 'object' && !Array.isArray(v) && base?.[k] && typeof base[k] === 'object' ? mergeDeep(base[k], v) : v;
  return out;
}

const logger = { info() {}, warn() {}, error: (m: string, meta: unknown) => console.error('[module]', m, meta) };

let tenant = baseTenant;
let scenario: { list: string } = { list: 'normal' };
let docs: ReturnType<typeof toModuleDocs>;
let moduleApp: any;

/**
 * The graph as the real repository reads it (graphRepo.ts PATH_CONFIG + its $lookup): for a
 * traversal path, a node reaches every node its relations of that type point at, filtered to the
 * path's node type. The module's mock graph repo answers by node id alone, so one is built per path.
 */
const PATHS: Record<string, { relationType: string; type: string }> = {
  'ORDER.DISPATCH': { relationType: 'hasDispatch', type: 'DISPATCH' },
  'DISPATCH.DELIVERY': { relationType: 'isDeliveredBy', type: 'DELIVERY' },
  'DISPATCH.RETURN': { relationType: 'hasReturn', type: 'RETURN' },
  'PURCHASE_ORDER.ORDER': { relationType: 'hasOrder', type: 'ORDER' },
};
function pathAwareGraphRepo(allNodes: any[]) {
  const byId = new Map(allNodes.map((n) => [String(n._id), n]));
  const repos = Object.fromEntries(Object.entries(PATHS).map(([p, cfg]) => {
    const seedMap: Record<string, unknown[]> = {};
    for (const n of allNodes) {
      seedMap[String(n._id)] = (n.relations || [])
        .filter((r: any) => r.relationType === cfg.relationType)
        .map((r: any) => byId.get(String(r.destinationId)))
        .filter((m: any) => m && m.type === cfg.type)
        .map((m: any) => toOrderNode(structuredClone(m)));
    }
    return [p, createMockGraphRepo(seedMap)];
  }));
  return {
    async traverse(nodeIds: string[], traversalPath: string, maxDepth: number) {
      const repo = repos[traversalPath];
      if (!repo) throw new Error(`Invalid traversal path: ${traversalPath}`);
      return repo.traverse(nodeIds, traversalPath, maxDepth);
    },
  };
}

/**
 * The host's StageAuditPort, shaped after cafex's adapter (routes/v3/purchase.js
 * createStageAuditPort → multiAdminOrderService.updateNodeStageAudit): per node, append the stage
 * entries (stamped updatedAt/updatedBy), set the status from the first entry, merge metaData, and
 * $push an itemListAudit entry (the challan — which is what the node's item_list reads as from then
 * on) and a statusAudit entry. Stock movements and the bypass walk are cafex side effects this
 * screen never reads back.
 */
function stageAuditPort() {
  return {
    async update(nodes: any[], caller: any) {
      const results: any = { total: nodes.length, successCount: 0, failureCount: 0, errors: [] };
      for (const item of nodes) {
        const { nodeId, nodeType, stageAudit, metaData } = item;
        if (!nodeId || !Array.isArray(stageAudit) || !stageAudit.length) { results.failureCount++; results.errors.push({ nodeId, error: 'nodeId and non-empty stageAudit array are required' }); continue; }
        const node: any = [...docs.purchaseOrders, ...docs.orders, ...docs.dispatches].find((n: any) => String(n._id) === String(nodeId));
        if (!node || (nodeType && (node.type || 'ORDER') !== nodeType)) { results.failureCount++; results.errors.push({ nodeId, error: node ? `Node type mismatch. Expected ${nodeType}, got ${node.type}` : 'Node not found' }); continue; }
        const first = stageAudit[0];
        node.stageAudit = [...(node.stageAudit || []), ...stageAudit.map((st: any) => ({ ...st, updatedAt: new Date(), updatedBy: caller.userId }))];
        node.modified_date = new Date();
        if (first.status) node.status = first.status;
        if (metaData) node.metaData = { ...(node.metaData || {}), ...metaData };
        if (Array.isArray(first.challan)) node.itemListAudit = [...(node.itemListAudit || []), { userId: caller.userId, date: Date.now(), itemList: first.challan }];
        if (first.status) node.statusAudit = [...(node.statusAudit || []), { userId: caller.userId, roleId: caller.roleId, date: new Date(), status: first.status }];
        if (Array.isArray(first.freeItemChallan) && first.freeItemChallan.length) node.freeItems = first.freeItemChallan;
        results.successCount++;
      }
      wire();
      return results;
    },
    triggerBypassFlow() {},
  };
}

/**
 * The `orders` collection as the document repo reads and writes it (find → toArray, updateOne with
 * $push, $set on positional `purchaseOrderDocuments.$.…` paths, and $unset), over the same nodes
 * every other service here answers from — so a document added now is on the row's next listing.
 */
function ordersCollection() {
  const all = () => [...docs.purchaseOrders, ...docs.orders, ...docs.dispatches];
  return {
    find(q: any) {
      return { toArray: async () => all().filter((n: any) => String(n._id) === String(q._id) && (!q.type || (n.type || 'ORDER') === q.type)) };
    },
    async updateOne(q: any, u: any) {
      const node: any = all().find((n: any) => String(n._id) === String(q._id));
      if (!node) return { modifiedCount: 0 };
      let pos = -1;
      if (q['purchaseOrderDocuments._id'] !== undefined) {
        pos = (node.purchaseOrderDocuments || []).findIndex((d: any) => String(d._id) === String(q['purchaseOrderDocuments._id']));
        if (pos === -1) return { modifiedCount: 0 };
      }
      const at = (path: string, value: unknown, unset = false) => {
        const parts: (string | number)[] = path.split('.').map((p) => (p === '$' ? pos : p));
        let o = node;
        for (const k of parts.slice(0, -1)) { if (o[k] == null) o[k] = {}; o = o[k]; }
        const last = parts[parts.length - 1]!;
        if (unset) delete o[last]; else o[last] = value;
      };
      for (const [k, v] of Object.entries(u.$set || {})) at(k, v);
      for (const k of Object.keys(u.$unset || {})) at(k, undefined, true);
      for (const [k, v] of Object.entries(u.$push || {})) node[k] = [...(node[k] || []), v];
      wire();
      return { modifiedCount: 1 };
    },
  };
}

/**
 * The host's DocumentStoragePort, shaped after cafex's (routes/v3/purchase.js
 * createDocumentStoragePort): one url per file, in request order, under order_document/ — here on
 * a host that does not resolve, because no bytes ever leave this process.
 */
function documentStorage() {
  return {
    async upload(files: any[], purchaseOrderId: string) {
      return files.map((f) => {
        const parts = String(f.originalname || '').split('.');
        const ext = parts.length > 1 ? parts.pop() : '';
        return { url: `https://parity.invalid/order_document/${purchaseOrderId}_${fileSeq()}${ext ? `.${ext}` : ''}` };
      });
    },
    async deleteByUrl() {},
  };
}

/** The host's SupplierPaymentPort as a fake transport: it records the ledger entry and nothing else. */
const paymentsRecorded: any[] = [];
const paymentPort = { async record(entry: any) { paymentsRecorded.push(entry); } };

/** A fresh copy of the dataset's documents: every scenario reset starts from here. */
let newObjectId: () => string;
let newRecordId: (kind: string) => string;
let fileSeq: () => number;
function build() {
  reseed();
  docs = toModuleDocs(dataset, NOW);
  newObjectId = createMinter('doc', 500);
  // Records created while a state runs — purchase orders, their orders, suppliers — each kind from
  // its own sequence, the same the prototype's in-page server uses.
  const minters: Record<string, () => string> = { po: createMinter('po', 900), ord: createMinter('ord', 900), sup: createMinter('sup', 900), prd: createMinter('prd', 900), cat: createMinter('cat', 900), ctl: createMinter('ctl', 900) };
  newRecordId = (kind: string) => minters[kind]!();
  let files = 0;
  fileSeq = () => (files += 1);
  paymentsRecorded.length = 0;
  wire();
}

/** The module's services over the CURRENT documents — re-run after any write, as a database would answer. */
function wire() {
  const d = docs.d;
  const nodes = [...docs.purchaseOrders, ...docs.orders, ...docs.dispatches];

  // Suppliers: the module's real supplier service, over the supplier documents (host-backend.js).
  const suppliers = createSupplierService(
    supplierRepo(docs, newRecordId, NOW),
    createNoopOpeningBalancePort(() => {}),
    logger,
  );

  /*
    The PO listing's repository answers what the real one would for this caller — a non-PRIVATE
    user sees the PURCHASE_ORDER nodes raised AGAINST this location (buyer_location_id), each
    normalised by the module's own toOrderNode (item_list resolved from itemListAudit, audits
    stripped, relations defaulted). ORDER and DISPATCH nodes are the listing's other two hops.
  */
  const visiblePOs = docs.purchaseOrders
    .filter((p) => p.buyer_location_id === SESSION.current_loc._id)
    .map((p) => toOrderNode(structuredClone(p)));
  const listRepo = createMockPurchaseOrderRepo({
    purchaseOrders: visiblePOs,
    orders: docs.orders.map((o) => toOrderNode(structuredClone(o))),
    dispatches: docs.dispatches.map((o) => toOrderNode(structuredClone(o))),
  });

  /*
    The seller directory, shaped after cafex's adapter (roleService/userService/locationStoreService/
    orgService): this user holds a sourcing role (RETAILER_PRIMARY) at the organisation's two other
    locations, which is what makes them selectable internal sources.
  */
  const locationMap = Object.fromEntries([docs.store, ...docs.locations].map((l) => [l._id, l]));
  const sellerDirectory = createMockSellerDirectoryPort({
    async getUserLocationRoleMap() {
      return {
        locationStoreRoleMap: Object.fromEntries(docs.locations.map((l) => [l._id, MOCK_ROLE_IDS.retailerPrimary])),
        locationMap: Object.fromEntries(docs.locations.map((l) => [l._id, l])),
      };
    },
    async getLocationById(id: string) { return locationMap[id] || null; },
    async getLocationsByIds(ids: string[]) { return ids.map((id) => locationMap[id]).filter(Boolean); },
    async getLocationConfig() { return { isActive: true }; },
    async getOrgsByIds(ids: string[]) { return Object.fromEntries(ids.map((id) => [id, { tenantNames: [] }])); },
  });

  // The purchase forecast: the module's real engine over its mock repository, holding this
  // store's sales orders (the demand) and its products (the stock).
  const forecastRepo = createMockForecastRepo({
    orders: d.salesOrders.map((so: any) => ({
      _id: oid('so', so.id), type: 'ORDER', location_id: IDS.location, created_date: so.createdAt, status: so.status,
      item_list: so.lines.map((l: any) => ({ articleNumber: l.product.articleNo, qty: l.qty, measurement: l.product.measurement, orderingUnit: l.product.measurement.split('-')[0] })),
      dispatchIds: [],
    })),
    products: d.products.map((p: any) => ({
      _id: docs.productId(p.id), articleNo: p.articleNo, name: p.name, stock: p.stock, measurement: p.measurement,
      price: p.price, offerPrice: p.price, costPrice: null, boxes: p.boxes, pallets: p.pallets, priceMap: p.priceMap,
      attributes: { moq: p.moq }, categoryReference: docs.categoryId(p.categoryId),
    })),
    categories: d.categories.map((c: any) => ({ _id: docs.categoryId(c.id), name: c.name })),
    catalogueProductIds: [],
  });

  moduleApp = createApp(suppliers, { logger }, {
    purchaseOrders: createPurchaseOrderListService(listRepo),
    graph: createGraphTraverseService(pathAwareGraphRepo(nodes)),
    sellers: createSellerListService(sellerDirectory),
    forecast: createPurchaseForecastService({ repo: forecastRepo }),
    nodes: createOrderNodeService(createMockOrderNodeRepo(Object.fromEntries(nodes.map((n) => [String(n._id), toOrderNode(structuredClone(n))])))),
    stageAudit: createStageAuditService(stageAuditPort()),
    documents: createPurchaseOrderDocumentService(
      createPurchaseOrderDocumentRepo({ orders: ordersCollection(), toObjectId: (id: string) => id, newObjectId: () => newObjectId() }),
      documentStorage(),
    ),
    payments: createSupplierPaymentService(paymentPort),
    catalogue: createCatalogueService({ repo: createMockCatalogueRepo(docs.catalogue), warn: () => {} }),
    // The host's catalogue writes (routes/v3/purchase.js createCatalogueWritePort), over the same documents.
    catalogueWrites: createCatalogueWriteService(catalogueWritePort(docs, { newId: (k: string) => newRecordId(k), now: NOW })),
    // The host's ports, shaped after cafex (js/data/host-backend.js).
    stockSummary: { async get(_loc: string, _org: string, options: any) { return stockSummary(docs, options); } },
    creation: {
      handle(req: any, res: any) {
        const out = createPurchaseOrder(docs, req.body, { now: NOW, random: Math.random, newId: newRecordId });
        wire();
        res.status(out.status).send(out.body);
      },
    },
  });
}
build();

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/__sandbox/health', (_req: any, res: any) => res.json({ ok: true }));
app.post('/__parity/scenario', (req: any, res: any) => {
  const body = req.body || {};
  scenario = { list: body.list || 'normal' };
  tenant = body.tenant ? mergeDeep(baseTenant, variants[body.tenant]) : baseTenant;
  if (body.tenant && !variants[body.tenant]) return res.status(400).json({ error: `unknown tenant ${body.tenant}` });
  if (body.reset) build();
  res.json({ ok: true, scenario, tenant: body.tenant || 'default' });
});

// ── /v3/purchase — cafex's bridge (routes/v3/purchase.js), then the module ────────────────────
// cafex parses multipart for the whole mount (documentUpload.array('files', 3)); the module holds
// no multer. Memory storage here: the storage port above never needs the bytes.
const multer = createRequire(path.join(process.env.CAFEX_BACKEND || path.resolve(PM, '../../cafex-backend'), 'package.json'))('multer');
app.use('/v3/purchase', multer({ storage: multer.memoryStorage() }).array('files', 3));
app.get('/__parity/payments', (_req: any, res: any) => res.json(paymentsRecorded));
app.use('/v3/purchase', (req: any, res: any, next: any) => {
  req.headers['x-org-id'] = SESSION.org_id;
  req.headers['x-user-id'] = SESSION.user_id;
  req.headers['x-location-store-id'] = SESSION.current_loc._id;
  req.headers['x-user-role'] = SESSION.role_name;
  req.headers['x-user-login-id'] = SESSION.userId;
  req.headers['x-location-org-id'] = SESSION.current_loc.orgId;
  req.headers['x-role-id'] = SESSION.role;
  req.headers['x-sub-role-id'] = SESSION.subRole;
  req.headers['x-tenant-name'] = SESSION.tenantId;
  // List scenarios the screen's states need a server to produce.
  if (req.method === 'GET' && req.path === '/purchase-orders') {
    if (scenario.list === 'empty') return res.status(200).send({ status: true, message: 'Nodes fetched successfully', data: [] });
    if (scenario.list === 'error') return res.status(500).send({ status: false, message: 'server failure connection reset' });
    if (scenario.list === 'hang') return; // never answers — the loading state
  }
  return moduleApp(req, res, next);
});

// ── Host endpoints (cafex), shaped after the controllers that answer them ─────────────────────
app.get('/api/v2/multiAdmin/setup', (_req: any, res: any) => res.send({ status: true, message: 'ok', data: setupPayload(tenant, docs) }));
app.get('/api/v2/multiAdmin/setup/get', (_req: any, res: any) => res.send({ status: true, message: 'ok', data: { appProp: {}, uiProp: {} } }));
app.get('/v2/multiAdmin/user/tenant-list', (_req: any, res: any) => res.send({
  status: true,
  data: { tenants: [{ tenantName: 'qa-store', locations: [{ _id: IDS.location, name: docs.store.name }] }], currentTenant: 'qa-store', currentLocationId: IDS.location },
}));
// cafex's /sourcing/seller-list is the same walk the module's /seller-list ported: this user's
// sourcing-role locations.
app.get('/v2/multiAdmin/sourcing/seller-list', (_req: any, res: any) => res.send({ status: true, message: 'Seller store list fetched successfully', data: docs.locations }));
// cafex's master-catalogue tree (routes/v2/productlist.js /getAll), narrowed to a catalogue type.
app.get('/v2/productlist/getAll', (req: any, res: any) => res.send(categoryProductTree(docs, { storeId: req.query.storeId, catalogueType: req.query.catalogueType }, NOW)));
// The Raw Material Calculator's reads: the store's sales orders, its customers with their orders,
// and its customer-type catalogues with their organisations.
app.get('/v4/orders', (req: any, res: any) => res.send(salesOrderList(docs, req.query)));
app.get('/api/v2/orderhistory/get', (_req: any, res: any) => res.send(orderHistory(docs)));
app.get('/v4/catalogue/get', (_req: any, res: any) => res.send(customerCatalogues(docs)));
// "Create Raw Material Requests": the host's supplier list and add are the purchase module's own
// app, mounted by cafex at /v2/supplier (routes/v2/supplier.js delegate: session → headers); the
// internal source's price list (routes/v2/productlist.js /getList — rank ASCENDING, dd/mm/yyyy);
// and cafex's own purchase-order handler, which the module's /purchase-order also proxies to.
app.use('/v2/supplier', (req: any, res: any, next: any) => {
  req.headers['x-org-id'] = SESSION.org_id;
  req.headers['x-user-id'] = SESSION.user_id;
  req.headers['x-location-store-id'] = SESSION.current_loc._id;
  return moduleApp(req, res, next);
});
app.get('/v2/productlist/getList', async (req: any, res: any) => {
  const service = createCatalogueService({ repo: createMockCatalogueRepo(docs.catalogue), warn: () => {} });
  const products = await service.getProductList(SESSION.org_id, String(req.query.storeId || SESSION.current_loc._id));
  const sorted = [...products].sort((a: any, b: any) => (b.rank > a.rank ? -1 : 1));
  const d = new Date(NOW); const two = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  res.send({ status: true, data: { products: sorted, updatedOn: `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}` } });
});
app.post('/api/v2/placeorder/sourcing/orderPropogateUp', (req: any, res: any) => {
  const out = createPurchaseOrder(docs, req.body, { now: NOW, random: Math.random, newId: newRecordId });
  wire();
  res.status(out.status).send(out.body);
});
// cafex creditLimitServices.getCreditLimitDetails: the organisation has no credit limit mapped at any
// location, so it answers its own 500 (the buyer's payment step swallows it: no credits method here).
app.post('/v2/creditLimit/getCreditLimitDetails', (_req: any, res: any) => res.status(500).json({ status: false, error: 'No credit limit found for this location' }));
app.get('/v2/creditLimit/creditLimits', (_req: any, res: any) => res.send({ status: true, data: { creditLimits: [] } }));

// Anything else is a gap in the fixture, never a silent success.
app.use((req: any, res: any) => {
  console.error(`[parity-gap] ${req.method} ${req.originalUrl}`);
  res.setHeader('x-parity-gap', '1');
  res.status(404).send({ status: false, message: `parity gap: ${req.method} ${req.path}` });
});

app.listen(PORT, '127.0.0.1', () => console.log(`oracle api on :${PORT}`));

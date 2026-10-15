/*
  The ORACLE's API: the production Sales Orders module's own backend, seeded with the prototype's
  dataset. Run with the production repo's tsx (see ../lib/servers.mjs):

    REACT_SALES_ORDERS=<.../foodbridge-module-route-delivery/development/sales-orders>
    PARITY_NOW=<epoch ms>  PARITY_API_PORT=4291  tsx oracle-api.mts

  What is REAL here: createApp, SalesOrdersService, the mock repository and ports the module ships
  as its own test doubles — the same composition the module's own `npm run sandbox:mock` uses.
  What is decided here: only the documents in the repository (to-module-docs.mjs) and the answers
  for endpoints other bounded contexts own (tenant setup, customer directory, catalogue, staff).

  The production repo is imported by path and never written to.

  A control endpoint switches the list into the states that need a server to produce them:
    POST /__parity/scenario  {"list": "normal" | "empty" | "error" | "hang", "reset": true}
*/
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { toModuleDocs, setupPayload, sessionPayload, customerCatalogue, CALLER, IDS, ROLES, oid } from './to-module-docs.mjs';

const SO = process.env.REACT_SALES_ORDERS;
if (!SO) throw new Error('REACT_SALES_ORDERS must point at foodbridge-module-route-delivery/development/sales-orders');
const NOW = Number(process.env.PARITY_NOW || Date.now());
const PORT = Number(process.env.PARITY_API_PORT || 4291);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOCKUP = path.resolve(HERE, '../../..');
const dataset = JSON.parse(fs.readFileSync(path.join(MOCKUP, 'js/data/dataset.json'), 'utf8'));
const tenant = JSON.parse(fs.readFileSync(path.join(MOCKUP, 'js/data/tenant.json'), 'utf8'));

const requireFromSO = createRequire(path.join(SO, 'backend/package.json'));
const express = requireFromSO('express');
const from = (rel: string) => import(pathToFileURL(path.join(SO, 'backend', rel)).href);

const { createApp } = await from('src/api/server.ts');
const { SalesOrdersService } = await from('src/services/salesOrdersService.ts');
const { createMockSalesOrderNodeRepo } = await from('src/repos/salesOrderNodeRepo.mock.ts');
const { createMockWorkflowConfigPort } = await from('src/services/workflowConfigPort.mock.ts');
const { createMockCustomerIdentityPort } = await from('src/services/customerIdentityPort.mock.ts');
const { createMockProxyUserIdentityPort, createMockPriceListPort, createMockInventoryAuditPort } =
  await from('src/services/creationPorts.mock.ts');
// The client package exports ESM only, so resolve its entry from its own package.json.
const clientDir = path.join(SO, 'node_modules/@modules/foodbridge-module-route-delivery-sales-orders-client');
const clientPkg = JSON.parse(fs.readFileSync(path.join(clientDir, 'package.json'), 'utf8'));
const clientEntry = clientPkg.exports?.['.']?.import ?? clientPkg.exports?.['.']?.default ?? clientPkg.module ?? clientPkg.main;
const { ENDPOINTS } = await import(pathToFileURL(path.join(clientDir, clientEntry)).href);

const docs = toModuleDocs(dataset, tenant, NOW);

/*
  The oracle's clock and dice. The browser runs on a fixed clock (PARITY_NOW); so does this
  server, or anything it stamps — an order number is cafex's date parts + a 1..100 random
  suffix — would differ run to run. Math.random is a seeded mulberry32, re-seeded on every reset,
  so the n-th draw after a reset is always the same number.
*/
const RealDate = Date;
class FixedDate extends RealDate {
  constructor(...a: any[]) { if (a.length) super(...(a as [])); else super(NOW); }
  static now() { return NOW; }
}
(globalThis as any).Date = FixedDate;
let seed = 0;
const reseed = () => { seed = 0x5a1e5; };
Math.random = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
reseed();

/** A fresh repository over the dataset — rebuilt on every reset, so a state that writes (an
 * audit submit) never leaks into the next capture. */
const remindersSent: unknown[] = [];
let currentRepo: any = null;
let insertedIds: string[] = []; // every node the module inserted since the last reset, in order
function build() {
  const repo = createMockSalesOrderNodeRepo();
  currentRepo = repo;
  repo.__seedRaw(structuredClone([...docs.orders, ...docs.nodes]));
  repo.__seedUsersOrgs(structuredClone(docs.users), structuredClone(docs.orgs));
  repo.__seedCustomerLookups(structuredClone(docs.lookups));
  repo.__seedLocations(docs.locations);
  repo.__seedUnitMap(tenant.appProp.unitMap, tenant.appProp.priceCalculationUnitIndex ?? 0);
  // Stock is reserved by orders in the tenant's reservation statuses (its workflow says which).
  repo.__seedStock(docs.products, [], docs.products, tenant.orderWorkflow.stockReservationOnStatus ?? []);
  repo.__seedDispatchedOrders?.(docs.orders.filter((o) => o.relations.length > 0).map((o) => o._id));
  // Production has ONE orders collection; the module's mock keeps its writes (insertNode) apart
  // from what its reads see (__seedRaw), so a placed order would never reach the list. Mirror
  // each insert into the read side, stamped the way the collection's schema defaults stamp it.
  const insert = repo.insertNode.bind(repo);
  insertedIds = [];
  repo.insertNode = async (input: any) => {
    const doc = await insert(input);
    insertedIds.push(String(doc.id));
    const at = new Date();
    repo.__seedRaw([{ ...structuredClone(input), _id: String(doc.id), created_date: at, createdAt: at, modified_date: at }]);
    return doc;
  };
  return createApp(new SalesOrdersService({
    repo,
    workflowPort: createMockWorkflowConfigPort(),
    identityPort: createMockCustomerIdentityPort(),
    proxyUserPort: createMockProxyUserIdentityPort(docs.users, ROLES, docs.orgs),
    priceListPort: createMockPriceListPort(),
    inventoryAuditPort: createMockInventoryAuditPort(),
    priceCalculationUnitIndex: tenant.appProp.priceCalculationUnitIndex ?? 0,
    // Reminders are RECORDED, never sent: no WhatsApp, no email, nothing leaves this process.
    reminderTransportPort: {
      createSmartLink: async ({ phone, baseUrl }: any) => ({ shortcode: `sl-${phone}`, url: `${baseUrl || 'https://parity.invalid'}/s/sl-${phone}` }),
      normalizePhone: async (phone: string) => `91${phone}`,
      sendWhatsApp: async (input: any) => { remindersSent.push(input); return { success: true }; },
      sendEmail: async (input: any) => { remindersSent.push(input); return { success: true }; },
    },
  }));
}
let moduleApp = build();

let scenario = { list: 'normal' };

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use((req: any, _res: any, next: any) => { Object.assign(req.headers, CALLER); next(); });

app.post('/__parity/scenario', (req: any, res: any) => {
  const { reset, ...rest } = req.body || {};
  if (reset) { moduleApp = build(); reseed(); }
  scenario = { list: 'normal', ...rest };
  if (rest.tenant && !variants[rest.tenant]) return res.status(400).json({ error: `unknown tenant variant ${rest.tenant}` });
  setup = setupPayload(rest.tenant ? mergeDeep(tenant, variants[rest.tenant]) : tenant);
  res.json(scenario);
});
app.get('/__parity/reminders', (_q: any, r: any) => r.json(remindersSent));
app.get('/__sandbox/health', (_q: any, r: any) => r.json({ ok: true, orders: docs.orders.length }));
app.get('/__sandbox/session', (_q: any, r: any) => r.json(sessionPayload(tenant)));

// The list endpoint, gated by the scenario. Everything else about it is the module's own answer.
app.get('/v4/orders', async (req: any, res: any, next: any) => {
  if (scenario.list === 'empty') return res.json({ orders: [], limit: 20, pages: 0, totalDoc: 0, methodTotals: [] });
  if (scenario.list === 'error') return res.status(500).json({ message: 'Something went wrong while loading orders' });
  if (scenario.list === 'hang') return; // never answers — the loading state
  next();
});

// Module endpoints, mounted per route exactly as the host mounts them.
const groups = new Map<string, any[]>();
for (const spec of Object.values(ENDPOINTS) as any[]) {
  if (!spec.path.endsWith(spec.modulePath)) continue;
  const prefix = spec.path.slice(0, spec.path.length - spec.modulePath.length);
  if (!groups.has(prefix)) groups.set(prefix, []);
  groups.get(prefix)!.push(spec);
}
for (const [prefix, specs] of groups) {
  const router = express.Router();
  for (const spec of specs) router[spec.method.toLowerCase()](spec.modulePath, (q: any, r: any, n: any) => moduleApp(q, r, n));
  app.use(prefix, router);
}

// ── Endpoints other bounded contexts own, answered from the same dataset. ─────────────────
const ok = (res: any, data: unknown) => res.json({ status: true, message: 'ok', data });
const d = docs.resolved;
// The tenant a scenario asks for: the production default, or a variant merged over it (the
// prototype's own js/data/tenant-variants.json — both sides read the same file).
const variants = JSON.parse(fs.readFileSync(path.join(MOCKUP, 'js/data/tenant-variants.json'), 'utf8'));
const mergeDeep = (base: any, over: any): any => {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = v && typeof v === 'object' && !Array.isArray(v) && base?.[k] && typeof base[k] === 'object' ? mergeDeep(base[k], v) : v;
  return out;
};
let setup = setupPayload(tenant);
const directory = () => d.customers.map((c) => ({
  _id: oid('org', c.id), orgId: oid('org', c.id), userId: oid('usr', c.id), name: c.name, orgName: c.name,
  contact: c.phone, phone: c.phone, email: c.email, type: c.type, customerType: { name: c.type },
  locationCustomerTypeRefMap: [{ locationRef: IDS.location, customerType: { name: c.type } }],
}));
const staff = d.staff.map((s) => ({ _id: oid('stf', s.id), name: s.name, phone: s.phone, role: s.role, rolename: s.role }));
// One catalogue per customer type (the store's two), each carrying the whole product list and the
// customers of that type — wholesale buyers are Premium, everyone else Standard.
const catalogues = ['Standard', 'Premium'].map((name, i) => ({
  catalogue: { _id: oid('ctl', i + 1), name, type: name },
  products: customerCatalogue(dataset).flatMap((c) => c.categories.flatMap((s) => s.categories)),
  organizations: d.customers.filter((c) => (c.type === 'WHOLESALER') === (name === 'Premium')).map((c) => ({ _id: oid('org', c.id), name: c.name })),
}));

app.get(['/v2/multiAdmin/setup', '/v2/multiAdmin/setup/get', '/v4/setup'], (_q: any, r: any) => ok(r, setup));
app.get('/v2/multiAdmin/user/tenant-list', (_q: any, r: any) =>
  ok(r, { currentTenant: 'parity', currentLocationId: IDS.location, tenants: [{ tenantName: 'parity', locations: setup.userLoc }] }));
// cafex answers the location docs of the store's internalBuyerLocationIds — none configured here.
app.get('/v2/multiAdmin/store/buyer-location-ids', (_q: any, r: any) => ok(r, []));
app.get('/v2/multiAdmin/store/child-store', (_q: any, r: any) => ok(r, []));
app.post('/v2/multiAdmin/store/child-store', (_q: any, r: any) => ok(r, []));
app.get('/v4/customer', (_q: any, r: any) => r.json(directory()));
app.get('/v4/admin', (_q: any, r: any) => r.json({ staff, subRoles: [] }));
// Customers by id, keyed by id — the module's own picker records (the full production shape).
app.get('/v4/customer/batch', async (q: any, r: any) => {
  const ids = [].concat(q.query['ids[]'] ?? q.query.ids ?? []).map(String);
  const res = await fetch(`http://127.0.0.1:${PORT}/v4/customer/picker?page=1&limit=1000&orgType=ALL`).then((x) => x.json());
  ok(r, Object.fromEntries((res.data?.orgs ?? []).filter((o: any) => ids.includes(String(o._id))).map((o: any) => [o._id, o])));
});
/*
  Create Delivery (cafex's routeDeliveryController.createRouteDeliveryFromOrders, restated over the
  module's store): each order walks to the ORDER workflow's last status; each customer gets one
  dispatch at the DISPATCH start status (it is already delivery-eligible, so the walk stops
  there), linked to its orders; one DELIVERY node covers every dispatch and walks to the DELIVERY
  workflow's last status.
*/
let deliverySeq = 0;
async function deliverOrders(orderIds: string[], name: string, perOrder: boolean) {
  const wf = tenant.orderWorkflow.statusWorkFlow;
  const orders = (await Promise.all(orderIds.map((id: string) => currentRepo.__readRaw(id)))).filter(Boolean);
  const byOrg = new Map<string, any[]>();
  for (const o of orders) { const k = perOrder ? String(o._id) : String(o.org_id); if (!byOrg.has(k)) byOrg.set(k, []); byOrg.get(k)!.push(o); }
  const at = new Date();
  const seq = ++deliverySeq;
  const dispatchIds: string[] = [];
  const deliveryId = `6a3${String(900 + seq).padStart(21, '0')}`;
  let n = 0;
  for (const [, list] of byOrg) {
    n += 1;
    const dispatchId = `6a2${String(9000 + seq * 100 + n).padStart(21, '0')}`;
    dispatchIds.push(dispatchId);
    for (const o of list) {
      o.status = wf.ORDER[wf.ORDER.length - 1].status;
      o.relations = [...(o.relations || []), { relationType: 'hasDispatch', destinationId: dispatchId }];
    }
    currentRepo.__seedRaw([{
      _id: dispatchId, type: 'DISPATCH', order_number: `${list[0].order_number}-D${(list[0].relations || []).filter((x: any) => x.relationType === 'hasDispatch').length}`,
      status: wf.DISPATCH[0].status, item_list: list.flatMap((o: any) => o.item_list), org_id: list[0].org_id, location_id: IDS.location,
      buyer_location_id: list[0].buyer_location_id, created_date: at, createdAt: at,
      relations: [...list.map((o: any) => ({ relationType: 'isDispatchOf', destinationId: String(o._id) })), { relationType: 'isDeliveredBy', destinationId: deliveryId }],
    }]);
  }
  currentRepo.__seedRaw([{
    _id: deliveryId, type: 'DELIVERY', order_number: `DLV-R${seq}`, status: wf.DELIVERY[wf.DELIVERY.length - 1].status, comments: name,
    location_id: IDS.location, created_date: at, relations: dispatchIds.map((id) => ({ relationType: 'delivers', destinationId: id })),
  }]);
  return { seq, groups: byOrg.size };
}
app.post('/v2/multiAdmin/route-delivery/create-from-orders', async (q: any, r: any) => {
  const { orderIds = [], name = '' } = q.body || {};
  if (!orderIds.length) return r.status(400).json({ status: false, message: 'orderIds must be a non-empty array' });
  if (!String(name).trim()) return r.status(400).json({ status: false, message: 'name is required' });
  const { seq, groups } = await deliverOrders(orderIds, name, false);
  r.json({ status: true, message: 'Route delivery created successfully', data: { routeDeliveryId: `rd-${seq}`, customerCount: groups } });
});
/*
  Route Bulk Orders (cafex multi-admin routeDeliveryService.createRouteDelivery): the orders are
  placed as bulk proxy orders — here through the module's own /v4/proxyorder/bulk, so they are
  exactly what that endpoint writes — then each ORDER gets its own bypass dispatch, and one
  delivery named for the run covers them all.
*/
app.post('/v2/multiAdmin/orders/route-delivery', async (q: any, r: any) => {
  const { bulkRouteDeliveryData, routeTemplateId, routeDeliveryName, notifyUser } = q.body || {};
  if (!Array.isArray(bulkRouteDeliveryData) || !bulkRouteDeliveryData.length) return r.status(400).send({ status: false, message: 'bulkRouteDeliveryData must be a non-empty array' });
  if (!routeTemplateId) return r.status(400).send({ status: false, message: 'routeTemplateId is required' });
  if (!routeDeliveryName) return r.status(400).send({ status: false, message: 'routeDeliveryName is required' });
  const before = insertedIds.length;
  const res = await fetch(`http://127.0.0.1:${PORT}/v4/proxyorder/bulk`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bulkProxyOrderData: bulkRouteDeliveryData, notifyUser }) });
  if (!res.ok) return r.status(res.status).send(await res.text());
  const placed = [];
  for (const id of insertedIds.slice(before)) { const n = await currentRepo.__readRaw(id); if (n?.type === 'ORDER') placed.push(id); }
  const { seq } = await deliverOrders(placed, routeDeliveryName, true);
  r.json({ status: true, message: 'Route delivery created successfully', data: { deliveryId: `rd-${seq}`, orderNumbers: placed } });
});
app.get('/v4/catalogue/get-summary', (_q: any, r: any) => ok(r, catalogues.map((c) => c.catalogue)));
app.get('/v4/catalogue/get', (_q: any, r: any) => ok(r, catalogues));
// cafex's catalogue tree (catalogueAggregate.getCatalogueProducts): category → subCategories →
// products, the products as stored (ACTIVE). Both catalogues carry the whole list.
const catalogueTree = () => customerCatalogue(dataset).map((c: any) => ({
  _id: c.id, name: c.name,
  subCategories: c.categories.map((s: any) => ({ _id: s.id, name: s.name, products: s.categories.map((p: any) => ({ ...p, status: 'ACTIVE', policyTemplate: [] })) })),
}));
app.get(['/v2/catalogue/get/products', '/v4/catalogue/get/products'], (q: any, r: any) => (catalogues.some((c) => c.catalogue._id === q.query.catalogueId)
  ? ok(r, catalogueTree()) : r.status(400).send({ status: false, message: 'catalogueId is missing in the query.' })));
// cafex /v4/category/all (categoryservice.getCategories → transformSubCategoriesJson): every
// sub-category, flat, with its parent — the names the demand report files products under.
app.get(['/v4/category/all', '/v2/category/all'], (_q: any, r: any) => r.json(customerCatalogue(dataset).flatMap((c: any) => c.categories.map((sub: any) => ({
  _id: sub.id, name: { en: sub.name }, description: { en: '' }, parentId: c.id, parentName: c.name, status: 'show', __v: 0,
})))));
// cafex /v2/catalogue/get/default: the location's default catalogue (Standard), whose products are "active".
app.get('/v2/catalogue/get/default', (_q: any, r: any) => ok(r, [catalogues[0]]));
// The customer type's default catalogue: Standard.
app.get(['/v2/catalogue/get-default', '/v4/catalogue/get-default'], (_q: any, r: any) => ok(r, [catalogues[0]]));
// The route-delivery module's templates (its own API, mounted by the host at /api/v3/routeDelivery;
// the dev gateway strips /api).
app.get(['/api/v3/routeDelivery/route-templates', '/v3/routeDelivery/route-templates'], (_q: any, r: any) => r.json(dataset.routeTemplates.map((t: any) => ({
  _id: oid('rtt', t.id), name: t.name, customers: t.customerIds.map((id: string) => oid('org', id)), staffs: t.staffIds.map((id: string) => oid('stf', id)), locationStoreId: IDS.location,
}))));
app.get('/v2/productlist/getList', (_q: any, r: any) => ok(r, { products: customerCatalogue(dataset) }));
// One customer, with the credit group it is assigned (the payment step's credit check reads it).
app.get('/v4/customer/:id', (q: any, r: any, n: any) => {
  const org = docs.orgs.find((o: any) => o._id === q.params.id);
  if (!org) return n();
  r.json({ ...directory().find((c) => c._id === org._id), creditLimitRef: org.creditLimitRef, creditAmount: 0 });
});
app.get('/v2/creditLimit/creditLimits', (_q: any, r: any) => ok(r, {
  creditLimits: dataset.creditGroups.map((g: any) => ({ _id: oid('crg', g.id), creditLimitType: g.name, creditLimit: g.creditLimit, creditDays: g.creditDays })),
}));
// The store runs no promotions: nothing applies, nothing is discounted.
app.post('/v2/multiAdmin/offers/preview', (_q: any, r: any) => ok(r, { appliedOffers: [], rejectedOffers: [], pricingResult: { discountTotal: 0 } }));

const gaps = new Set<string>();
app.use((req: any, res: any) => {
  const key = `${req.method} ${req.path}`;
  if (!gaps.has(key)) { gaps.add(key); console.log(`  oracle-gap  ${key}`); }
  res.setHeader('x-parity-gap', '1');
  res.json({ status: true, message: 'parity oracle: no fixture for this path', data: [] });
});

app.listen(PORT, () => console.log(`  oracle api  http://127.0.0.1:${PORT}  ${docs.orders.length} orders, ${docs.nodes.length} fulfilment nodes, now=${new Date(NOW).toISOString()}`));

/*
  The prototype's dataset, expressed as the documents the production module stores.

  The oracle is the production app itself: its real backend (router, service, read semantics) runs
  over an in-memory repository seeded with THESE documents, and its real built screens render what
  that backend answers. So nothing in the production app is stubbed, re-implemented or modified —
  the only thing this file decides is what is in the database.

  The shapes follow the production sandbox's own dataset (foodbridge-module-route-delivery,
  development/sales-orders/backend/sandbox/dataset/*.mts), which is the module's documented
  description of a stored order, org, user, location and product. Fulfilment records are graph
  nodes joined by the relations the module traverses (cafexReadSemantics.ts GRAPH_PATHS):
    ORDER --hasDispatch--> DISPATCH --isDeliveredBy--> DELIVERY
                           DISPATCH --hasReturn-->     RETURN
  with the inverse relations on the far side.

  Everything is derived from resolveDataset(), which the prototype also uses — one input, two
  renderers.
*/
import { resolveDataset } from '../../../js/data/resolve.js';

/** Deterministic ObjectId-shaped ids: '6a' + a kind digit + the record's number, zero-padded. */
const KIND = { ord: '1', dsp: '2', dlv: '3', ret: '4', org: '5', usr: '6', loc: '7', prd: '8', stf: '9', crg: 'a', rtt: 'b', cat: 'c', sub: 'd', ctl: 'e' };
export function oid(kind, id) {
  const n = String(id).replace(/\D/g, '');
  return `6a${KIND[kind]}${n.padStart(21, '0')}`;
}

export const IDS = {
  location: '5a0000000000000000000001',
  sellerOrg: '5a0000000000000000000002',
  adminUser: '5a0000000000000000000003',
  adminRole: '5a0000000000000000000004',
  catalogue: '5a0000000000000000000005',
  customerRole: '5a0000000000000000009001',
  adminRoleDoc: '5a0000000000000000009002',
  customerTypeStandard: '5a0000000000000000009101',
  customerTypePremium: '5a0000000000000000009102',
  defaultShipping: '5a0000000000000000009201',
};

/** Roles by name — a customer's user holds RETAILER_PRIMARY at the seller's location (by role id). */
export const ROLES = [
  { _id: IDS.customerRole, name: 'RETAILER_PRIMARY' },
  { _id: IDS.adminRoleDoc, name: 'WHOLESALER_ADMIN' },
  { _id: '5a0000000000000000009003', name: 'PRIVATE_USER' },
];

/** The identity the module's router reads — what the host's bridge would set from a session. */
export const CALLER = {
  'x-user-id': IDS.adminUser,
  'x-session-user-id': IDS.adminUser,
  'x-role-id': IDS.adminRole,
  'x-role-name': 'WHOLESALER_ADMIN',
  'x-sub-role-id': '',
  'x-location-store-id': IDS.location,
  'x-org-id': IDS.sellerOrg,
};

/** The sub-category each product is filed under, by product id (the catalogue's own numbering). */
let subOf = new Map();
const lineDoc = (line) => ({
  categoryId: subOf.get(line.productId), // as every placed order stores it: the product's sub-category
  productId: oid('prd', line.productId),
  id: oid('prd', line.productId),
  articleNumber: line.articleNo,
  name: line.name,
  qty: line.qty,
  price: line.price,
  unit: line.unit,
  unitName: line.unit,
  measurement: line.unit, // the unit the order panel prints after a quantity
  tax: line.tax,
  // As every order the app places stores it: the tax-inclusive ordering-unit price, rounded to
  // paise, then the currency and unit ("44.10 ₹/Pack"). Receipts read the charged rate from it.
  unitPrice: `${(Math.round((line.price * (1 + (line.tax || 0) / 100) + Number.EPSILON) * 100) / 100).toFixed(2)} ₹/${line.unit}`,
});

const sum = (lines) => lines.reduce((s, l) => s + l.qty * l.price, 0);

export function toModuleDocs(dataset, tenant, now) {
  subOf = new Map(customerCatalogue(dataset).flatMap((c) => c.categories.flatMap((sub) => sub.categories.map((p) => [dataset.products.find((x) => oid('prd', x.id) === p.id).id, sub.id]))));
  const d = resolveDataset(dataset, now);

  const orgs = d.customers.map((c) => ({
    _id: oid('org', c.id),
    name: c.name,
    phone: c.phone,
    email: c.email,
    orgType: c.type === 'WHOLESALER' ? 'WHOLESALER' : 'RETAILER',
    status: 'APPROVED',
    creditLimitRef: c.creditGroupId ? oid('crg', c.creditGroupId) : null,
    userRefs: [oid('usr', c.id)],
    address1: c.address,
    // Wholesale buyers are Premium, everyone else Standard (the tenant's two customer types).
    locationCustomerTypeRefMap: [{ locationRef: IDS.location, customerTypeRef: c.type === 'WHOLESALER' ? IDS.customerTypePremium : IDS.customerTypeStandard }],
  }));
  const users = d.customers.map((c) => ({
    _id: oid('usr', c.id),
    name: c.name,
    email: c.email,
    phone: c.phone,
    orgRef: oid('org', c.id),
    roleRef: IDS.customerRole,
    // Their own store first — the buyer store every order of theirs names (buyer_location_id),
    // and the one an order placed for them resolves to — then the seller's, which they buy from.
    locationStoreRoleMap: { [oid('loc', c.id)]: IDS.customerRole, [IDS.location]: IDS.customerRole },
  }));
  const locations = [
    { ...tenant.sellerLocation, _id: IDS.location, locationName: tenant.sellerLocation.name },
    ...d.customers.map((c) => ({
      _id: oid('loc', c.id), name: c.name, locationName: c.name, orgId: oid('org', c.id), orgRef: oid('org', c.id), status: 'ACTIVE',
    })),
  ];
  const products = d.products.map((p) => ({
    _id: oid('prd', p.id), name: p.name, articleNo: p.articleNo, categoryReference: null, locationReference: IDS.location,
    price: String(p.price), stock: p.stock, tax: p.tax, measurement: p.unit, status: 'ACTIVE', isInventoryEnabled: true,
  }));

  const dispatchesByOrder = new Map();
  for (const x of d.dispatches) {
    if (!dispatchesByOrder.has(x.orderId)) dispatchesByOrder.set(x.orderId, []);
    dispatchesByOrder.get(x.orderId).push(x);
  }
  const deliveriesByDispatch = new Map();
  for (const v of d.deliveries) for (const dispatchId of v.dispatchIds) {
    if (!deliveriesByDispatch.has(dispatchId)) deliveriesByDispatch.set(dispatchId, []);
    deliveriesByDispatch.get(dispatchId).push(v);
  }
  const returnsByDispatch = new Map();
  for (const r of d.returns) {
    if (!returnsByDispatch.has(r.dispatchId)) returnsByDispatch.set(r.dispatchId, []);
    returnsByDispatch.get(r.dispatchId).push(r);
  }

  const orders = d.orders.map((o) => {
    const customer = d.customerById.get(o.customerId);
    const base = sum(o.items);
    return {
      _id: oid('ord', o.id),
      type: 'ORDER',
      order_number: o.number,
      invoice: o.number,
      status: o.status,
      user_id: oid('usr', customer.id),
      org_id: oid('org', customer.id), // the BUYER's org, as every real order carries (QA data: 3,700 of 3,707),
      location_id: IDS.location,
      buyer_location_id: oid('loc', customer.id),
      created_by: IDS.adminUser,
      created_date: o.createdAt,
      createdAt: o.createdAt,
      modified_date: o.createdAt,
      paymentMethod: o.paymentMethod,
      shippingCost: o.shippingCost,
      orderDiscount: o.discount,
      discountAmount: o.discount,
      baseTotal: base,
      discountTotal: o.discount,
      finalTotal: base - o.discount,
      subTotal: base,
      total: base - o.discount,
      comments: o.comment, // the creation path stores the order note as `comments`
      ShippingDetails: { Location: customer.address }, // as the creation path writes it (the buyer org's address1)
      item_list: o.items.map(lineDoc),
      relations: (dispatchesByOrder.get(o.id) || []).map((x) => ({ relationType: 'hasDispatch', destinationId: oid('dsp', x.id) })),
    };
  });

  const nodes = [];
  for (const x of d.dispatches) {
    const order = d.orderById.get(x.orderId);
    const customer = d.customerById.get(order.customerId);
    nodes.push({
      _id: oid('dsp', x.id),
      type: 'DISPATCH',
      order_number: x.number,
      status: x.status,
      item_list: x.items.map(lineDoc),
      subTotal: sum(x.items),
      total: sum(x.items),
      org_id: oid('org', customer.id),
      location_id: IDS.location,
      buyer_location_id: oid('loc', customer.id),
      created_date: x.createdAt,
      createdAt: x.createdAt,
      relations: [
        { relationType: 'isDispatchOf', destinationId: oid('ord', x.orderId) },
        ...(deliveriesByDispatch.get(x.id) || []).map((v) => ({ relationType: 'isDeliveredBy', destinationId: oid('dlv', v.id) })),
        ...(returnsByDispatch.get(x.id) || []).map((r) => ({ relationType: 'hasReturn', destinationId: oid('ret', r.id) })),
      ],
    });
  }
  for (const v of d.deliveries) {
    nodes.push({
      _id: oid('dlv', v.id),
      type: 'DELIVERY',
      order_number: v.number,
      status: v.status,
      progress: v.progress,
      location_id: IDS.location,
      created_date: new Date(now),
      relations: v.dispatchIds.map((id) => ({ relationType: 'delivers', destinationId: oid('dsp', id) })),
    });
  }
  for (const r of d.returns) {
    nodes.push({
      _id: oid('ret', r.id),
      type: 'RETURN',
      order_number: r.number,
      status: r.status,
      item_list: r.items.map(lineDoc),
      subTotal: sum(r.items),
      total: sum(r.items),
      org_id: oid('org', d.orderById.get(d.dispatches.find((x) => x.id === r.dispatchId).orderId).customerId),
      location_id: IDS.location,
      created_date: new Date(now),
      relations: [{ relationType: 'isReturnOf', destinationId: oid('dsp', r.dispatchId) }],
    });
  }

  const lookups = {
    roles: ROLES,
    customerTypes: [
      { _id: IDS.customerTypeStandard, name: 'Standard', locationRef: IDS.location },
      { _id: IDS.customerTypePremium, name: 'Premium', locationRef: IDS.location },
    ],
    catalogues: [],
    shippingAddresses: [{ _id: IDS.defaultShipping, name: 'DEFAULT', locationID: IDS.location }],
  };

  return { resolved: d, orgs, users, locations, products, orders, nodes, lookups };
}

/**
 * A customer's catalogue, as `/v2/productlist/getList?orgId=` answers it: category → sub-category
 * → products, `categories` at every level (the leaves ARE the products). Every customer at this
 * store buys from the same catalogue, at the product's own price; `unitPrice` is "price/unit".
 */
export function customerCatalogue(dataset) {
  const products = dataset.products;
  const cats = [...new Set(products.map((p) => p.category))];
  let subN = 0;
  return cats.map((cat, ci) => {
    const subs = [...new Set(products.filter((p) => p.category === cat).map((p) => p.subCategory))];
    return {
      id: oid('cat', ci + 1),
      name: cat,
      categories: subs.map((sub) => {
        subN += 1;
        return {
          id: oid('sub', subN),
          name: sub,
          categories: products.filter((p) => p.category === cat && p.subCategory === sub).map((p) => ({
            id: oid('prd', p.id), _id: oid('prd', p.id), name: p.name, title: p.name, articleNumber: p.articleNo, articleNo: p.articleNo,
            price: p.price, offerPrice: p.price, unitPrice: `${p.price}/${p.unit}`, unitName: p.unit, tax: p.tax, stock: p.stock,
            image: [], status: 'show',
          })),
        };
      }),
    };
  });
}

/** The tenant setup in the envelope `/v2/multiAdmin/setup` answers with. */
export function setupPayload(tenant) {
  const { _about, sellerLocation, ...rest } = tenant;
  const location = { ...sellerLocation, _id: IDS.location };
  return {
    ...rest,
    userLoc: [location],
    groupedLocationData: { childLocations: [], sellerLocations: [location] },
    uiProp: { isLandingPageEnabled: false, staticAsset: {} },
    menus: [],
    accessLinks: {},
  };
}

/** The session a login would have stored. The sandbox fetches it; nothing logs in. */
export function sessionPayload(tenant) {
  return {
    status: true,
    token: 'parity-oracle-session',
    _id: IDS.adminUser,
    name: tenant.username,
    role: tenant.role,
    tenantName: 'parity',
    userInfo: {
      _id: IDS.adminUser,
      loginID: 'parity-admin',
      name: tenant.username,
      org: { _id: IDS.sellerOrg, orgId: IDS.sellerOrg, name: 'QA store' },
      storeId: IDS.location,
      role: { _id: IDS.adminRole, name: tenant.role, storefrontPrivilageList: [] },
    },
  };
}

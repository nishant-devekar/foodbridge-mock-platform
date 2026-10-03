/*
  The dataset, expressed as the documents production stores. Both screens start from these: the
  prototype's in-page server (js/purchase-orders/server.js) and the parity oracle, whose repositories
  are seeded with them (tests/parity/oracle/to-module-docs.mjs). Every shape follows a real document
  (checked field-by-field against the QA data dump, never copied from it):

    orders (type PURCHASE_ORDER)   item_list + itemListAudit, stageAudit / statusAudit, org_id (the
                                   BUYER's org), buyer_location_id (this store), location_id (an
                                   internal source) XOR supplier_id (an external one), relations
                                   hasOrder → the source's ORDER node, purchaseOrderDocuments[]
    orders (type ORDER, DISPATCH)  the internal source's sales order and its dispatch, which the
                                   listing walks (PO → ORDER → DISPATCH) for `dispatchStatus`
    suppliers                      name, contact, orgRefs, supplierType EXTERNAL|DEPARTMENT, state,
                                   postNumber, gstType, supplierCode; `active` only when deactivated
    location                       name, desc, status, orgId, parentId, address (no phone)

  One input, two renderers.
*/
import { resolveDataset, oid, lineDoc } from './resolve.js';

export { oid };

export const IDS = {
  location: oid('loc', 1),
  org: oid('org', 1),
  user: oid('usr', 1),
  role: oid('rol', 1),
  subRole: oid('rol', 2),
  catalogue: oid('ctl', 1),
};

/** The session cafex bridges into the module's nine headers (routes/v3/purchase.js). */
export const SESSION = {
  user_id: IDS.user,
  org_id: IDS.org,
  current_loc: { _id: IDS.location, orgId: IDS.org },
  role_name: 'WHOLESALER_ADMIN',
  userId: '9822000001', // the LOGIN id
  role: IDS.role,
  subRole: IDS.subRole,
  tenantId: '',
};

const iso = (d) => new Date(d).toISOString();

/** The challan a status transition writes: item_list lines + expected/verified (UpdateAuditDrawer). */
function openingChallan(lines) {
  // As cafex's create flow stores it: quantities as STRINGS on the opening entry.
  return lines.map((l) => ({ ...l, qty: String(l.qty), expectedQty: String(l.qty), verifiedQty: String(l.qty) }));
}
function receiptChallan(lines, short = {}) {
  const shortBy = Object.fromEntries(Object.entries(short).map(([prd, n]) => [oid('prd', prd), n]));
  return lines.map((line) => {
    const l = { ...line, qty: Number(line.qty) };
    const got = l.qty - (shortBy[l.id] || 0);
    const unitPrice = Math.round((Number(l.priceMap[l.orderingUnit]) * (1 + (Number(l.tax) || 0) / 100) + Number.EPSILON) * 100) / 100;
    return {
      ...l,
      receiving: l.qty,
      received: got,
      expectedQty: l.qty,
      qty: got,
      verifiedQty: got,
      totalPrice: (unitPrice * got).toFixed(2),
      qtyReceived: got,
      qtyReceiving: got,
      qtyRemaining: l.qty - got,
      baseQtyReceived: l.orderingUnit === l.measurement.split('-')[1] ? got * l.boxes : got,
    };
  });
}

export function toModuleDocs(dataset, now) {
  const d = resolveDataset(dataset, now);
  const supId = (id) => (id === 'sup-99' ? oid('sup', 99) : oid('sup', id));

  const purchaseOrders = [];
  const orders = [];
  const dispatches = [];
  for (const po of d.purchaseOrders) {
    const _id = oid('po', po.id);
    const created = po.createdAt;
    // v7: an order raised for internal approval opens at Pending Approval; the decision is its next stage.
    const opening = po.opening || 'InProgress';
    const stageAudit = [{
      userId: IDS.user, roleId: IDS.role, status: opening, documents: [], comment: '',
      challan: openingChallan(po.lines), created_date: created, updatedAt: created, updatedBy: IDS.user,
    }];
    const statusAudit = [{ userId: IDS.user, roleId: IDS.role, date: created, status: opening }];
    if (po.decided) {
      stageAudit.push({
        userId: IDS.user, roleId: IDS.role, status: po.decided.status, documents: [], comment: po.decided.comment || '',
        challan: openingChallan(po.lines), created_date: po.decided.at, updatedAt: po.decided.at, updatedBy: IDS.user,
      });
      statusAudit.push({ userId: IDS.user, roleId: IDS.role, date: po.decided.at, status: po.decided.status });
    }
    if (po.received) {
      stageAudit.push({
        userId: IDS.user, roleId: IDS.role, status: 'Delivered', documents: [], comment: po.received.comment || '',
        challan: receiptChallan(po.lines, po.received.short), freeItemChallan: [],
        created_date: po.received.at, updatedAt: po.received.at, updatedBy: IDS.user,
      });
      statusAudit.push({ userId: IDS.user, roleId: IDS.role, date: po.received.at, status: 'Delivered' });
    }
    const relations = [];
    if (po.location) {
      // The internal source raised its own ORDER for this purchase order; its dispatch is what
      // the listing reports as the row's status.
      const orderId = oid('ord', po.id);
      relations.push({ relationType: 'hasOrder', sourceId: _id, destinationId: orderId });
      const orderRelations = [{ relationType: 'isPurchaseOrderOf', sourceId: orderId, destinationId: _id }];
      if (po.dispatch) {
        const dispatchId = oid('dsp', po.id);
        orderRelations.push({ relationType: 'hasDispatch', sourceId: orderId, destinationId: dispatchId });
        dispatches.push({
          _id: dispatchId, type: 'DISPATCH', order_number: `D${po.number}`, status: po.dispatch.status,
          item_list: po.lines, relations: [{ relationType: 'isDispatchOf', sourceId: dispatchId, destinationId: orderId }],
          created_date: po.dispatch.at, location_id: oid('loc', po.location),
        });
      }
      orders.push({
        _id: orderId, type: 'ORDER', order_number: `S${po.number}`, status: po.dispatch ? 'Ready for dispatch' : po.status,
        item_list: po.lines, relations: orderRelations, created_date: created, location_id: oid('loc', po.location),
        org_id: IDS.org, buyer_location_id: IDS.location,
      });
    }
    const costPrice = po.lines.reduce((s, l) => s + Number(l.priceMap[l.orderingUnit]) * Number(l.qty), 0);
    purchaseOrders.push({
      _id,
      type: 'PURCHASE_ORDER',
      order_number: po.number,
      item_list: po.lines,
      itemListAudit: [{ userId: IDS.user, date: created.getTime(), itemList: po.lines }],
      orderDiscount: 0,
      pricelist_id: null,
      PaymentDetails: {
        orderStatus: 'Payment-Confirmed', method: 'pod', verifiedStatus: false,
        details: { customerVerificationRequestStatus: false, transactionMethod: 'pod', provider: 'POD', transactionID: '' },
      },
      ShippingDetails: { method: '' },
      status: po.status,
      comments: po.comments || '',
      stageAudit,
      statusAudit,
      palletCount: null,
      user_id: IDS.user,
      org_id: IDS.org,
      created_by: null,
      location_id: po.location ? oid('loc', po.location) : null,
      buyer_location_id: IDS.location,
      created_date: created,
      updated_date: null,
      relations,
      appliedOffers: [],
      baseTotal: 0,
      discountTotal: 0,
      finalTotal: 0,
      freeItems: [],
      supplier_id: po.supplier ? supId(po.supplier) : null,
      sourcingDetails: {
        costPrice, transportationCost: 0, salePrice: costPrice.toFixed(2),
        purchaseQty: String(po.lines.reduce((s, l) => s + Number(l.qty), 0)), logisticsType: 'Courier/Parcel',
        buyerLocationStoreId: IDS.location, orderComments: po.comments || '',
      },
      modified_date: po.received ? po.received.at : created,
      ...(po.received ? { metaData: { voucherNumber: '', receivedDate: '' } } : {}),
      ...(po.documents.length ? {
        purchaseOrderDocuments: po.documents.map((doc) => ({
          _id: oid('doc', doc.id), type: doc.type, name: doc.name, amount: doc.amount, remarks: doc.remarks,
          documentUrl: `https://parity.invalid/purchase-orders/${_id}/${doc.id}.pdf`, uploadedBy: IDS.user, uploadedAt: doc.uploadedAt,
        })),
      } : {}),
    });
  }

  const suppliers = d.suppliers.map((s) => ({
    _id: supId(s.id),
    name: s.name,
    contact: s.contact,
    orgRefs: [IDS.org],
    email: s.email || '',
    supplierCode: '',
    gstNumber: s.gstNumber || '',
    address: s.address || '',
    state: { code: '27', name: s.state || '' },
    postNumber: s.postalCode || '',
    gstType: s.gstNumber ? 'regular' : '',
    supplierType: s.supplierType || 'EXTERNAL',
    created_date: new Date(now - 120 * 86400000),
    ...(s.active === false ? { active: false } : {}),
  }));

  const store = { _id: IDS.location, name: d.store.name, desc: '', status: 'ACTIVE', created_date: new Date(now - 400 * 86400000), orgId: IDS.org, parentId: null, address: d.store.address || 'Survey 41, Wanowrie, Pune' };
  const locations = d.locations.map((l) => ({
    _id: oid('loc', l.id), name: l.name, desc: '', status: 'ACTIVE', created_date: new Date(now - 300 * 86400000),
    orgId: IDS.org, parentId: null, address: '',
  }));

  /*
    The catalogue, as the module's catalogue repository reads it: product documents, categories
    (roots hold subcategories), and per location a MASTER catalogue plus the CUSTOMER catalogue named
    DEFAULT, which is also the organisation's customer-type catalogue there (the store also keeps a
    RAW-MATERIAL catalogue).
    An internal location's products are its OWN records (their own ids), carrying the store's article
    numbers at that location's price and stock.
  */
  const customerType = oid('typ', 1);
  const unitPrices = (price, p) => {
    const units = p.measurement.split('-');
    const out = { [units[0]]: price };
    if (units[1]) out[units[1]] = price * p.boxes;
    if (units[2]) out[units[2]] = price * p.boxes * p.pallets;
    return out;
  };
  const productDoc = (p, id, price, stock, priceMap = unitPrices(price, p)) => ({
    _id: id, name: p.name, articleNo: p.articleNo, desc: '', price, offerPrice: price, measurement: p.measurement,
    priceMap, categoryReference: oid('cat', p.categoryId), imagesReference: [], policyTemplateReference: p.policy ? [oid('pol', p.policy)] : [],
    stock, boxes: p.boxes, pallets: p.pallets, tax: p.tax, status: 'ACTIVE', barcode: '', isInventoryEnabled: true,
    brand: '', maxRetailPrice: 0, variants: [], attributes: { moq: p.moq },
  });
  const storeProducts = d.products.map((p) => productDoc(p, oid('prd', p.id), p.price, p.stock, { ...p.priceMap }));
  // Raw materials: the store's own records too, but only in its MASTER and RAW-MATERIAL catalogues.
  const rawMaterials = (d.rawMaterials || []).map((p) => productDoc(p, oid('prd', p.id), p.price, p.stock, { ...p.priceMap }));
  const locationProducts = Object.entries(d.catalogue.locations).flatMap(([loc, list]) => Object.entries(list).map(([prd, [price, stock]]) => {
    const p = d.products.find((x) => x.id === prd);
    // Location 2's records are prd-2nn, location 3's prd-3nn.
    return { loc, doc: productDoc(p, oid('prd', Number(loc.replace(/\D/g, '')) * 100 + Number(prd.replace(/\D/g, ''))), price, stock) };
  }));
  const catalogueFor = (locId, name, docs) => {
    const entries = docs.map((doc) => ({ id: doc._id }));
    return [
      { _id: oid('ctl', `${name}1`), locationReference: locId, catalogueType: 'MASTER', name: 'MASTER', products: entries },
      // The organisation's customer-type catalogue at a location IS that location's DEFAULT
      // catalogue — as in the QA data, where a DEFAULT catalogue always carries the customer type.
      { _id: oid('ctl', `${name}2`), locationReference: locId, catalogueType: 'CUSTOMER', customerTypeReference: customerType, name: 'DEFAULT', products: entries },
    ];
  };
  const catalogue = {
    customerType,
    locations: [{ _id: IDS.location, orgId: IDS.org }, ...d.locations.map((l) => ({ _id: oid('loc', l.id), orgId: IDS.org }))],
    orgs: [{ _id: IDS.org, name: d.store.orgName, locationCustomerTypeRefMap: [IDS.location, ...d.locations.map((l) => oid('loc', l.id))].map((locationRef) => ({ locationRef, customerTypeRef: customerType })) }],
    catalogues: [
      ...catalogueFor(IDS.location, 1, storeProducts).map((c) => (c.catalogueType === 'MASTER' ? { ...c, products: [...c.products, ...rawMaterials.map((doc) => ({ id: doc._id }))] } : c)),
      { _id: oid('ctl', 14), locationReference: IDS.location, catalogueType: 'RAW-MATERIAL', name: 'RAW-MATERIAL', products: rawMaterials.map((doc) => ({ id: doc._id })) },
      ...d.locations.map((l) => catalogueFor(oid('loc', l.id), Number(l.id.replace(/\D/g, '')), locationProducts.filter((x) => x.loc === l.id).map((x) => x.doc))).flat(),
    ],
    products: [...storeProducts, ...rawMaterials, ...locationProducts.map((x) => x.doc)],
    categories: d.categories.map((c) => ({
      _id: oid('cat', c.id), name: c.name, rank: Number(c.id.replace(/\D/g, '')),
      ...(c.parent ? { parentCategoryReference: oid('cat', c.parent) } : { locationReference: IDS.location }),
    })),
    images: [],
    // As policyTemplateService stores a template: name, type, activation, pricing, ruleset.
    policies: (d.policies || []).map((pol) => ({
      _id: oid('pol', pol.id), name: pol.name, type: pol.type, locationStoreReference: IDS.location,
      activation: { duration_in_sec: pol.days * 86400, duration_unit: pol.unit }, pricing: { amount: 0 },
      ruleset: [{ content: pol.terms }], status: 'ACTIVE', version: '1', audits: [],
    })),
  };
  // The store's other customer-type catalogue, after DEFAULT: a subset of its products.
  const horecaType = oid('typ', 2);
  const typeOf = { DEFAULT: customerType, HoReCa: horecaType };
  for (const [name, prds] of Object.entries(d.customerCatalogues || {})) {
    catalogue.catalogues.push({
      _id: oid('ctl', 15 + Object.keys(d.customerCatalogues).indexOf(name)), locationReference: IDS.location, catalogueType: 'CUSTOMER',
      customerTypeReference: typeOf[name], name, products: prds.map((prd) => ({ id: oid('prd', prd) })),
    });
  }

  /*
    The store's customers and their sales orders (type ORDER), as the host keeps them: organisations
    (orgs) whose locationCustomerTypeRefMap puts them in one of the store's customer-type catalogues,
    and ORDER nodes whose org_id is the buying organisation. The store's own organisation comes
    first, in DEFAULT — as an admin's own org does in the QA data.
  */
  const orgDoc = (id, name, phone, email, typeRef, created) => ({
    _id: id, name, address1: '', address2: '', postNumber: '', postAddress: '', phone, email, faxNumber: '', orgNumber: '',
    orgType: 'WHOLESALER', status: 'APPROVED', locationCustomerTypeRefMap: [{ locationRef: IDS.location, customerTypeRef: typeRef }],
    userRefs: [], transportationCostFactor: 0, creditTypeRef: '', taxRef: '', created_date: created, creditAmount: 0,
    modified_date: created, creditLimitRef: '', locationShippingAddressRefMap: [],
  });
  const customers = [
    orgDoc(IDS.org, d.store.orgName, SESSION.userId, '', customerType, new Date(now - 400 * 86400000)),
    ...(d.customers || []).map((c, i) => orgDoc(oid('org', c.id), c.name, c.phone, c.email, typeOf[c.catalogue], new Date(now - (200 - i) * 86400000))),
  ];
  const salesOrders = d.salesOrders.filter((so) => so.customer).map((so) => ({
    _id: oid('so', so.id), type: 'ORDER', order_number: so.number, status: so.status,
    org_id: oid('org', so.customer), location_id: IDS.location, created_date: so.createdAt, modified_date: so.createdAt,
    item_list: so.lines.map((l) => lineDoc(l.product, l.qty, 0)), freeItems: [],
    PaymentDetails: [], ShippingDetails: { charges: 0 }, relations: [],
  }));

  return {
    d, purchaseOrders, orders, dispatches, suppliers, store, locations, catalogue, customers, salesOrders,
    productId: (id) => oid('prd', id),
    categoryId: (id) => oid('cat', id),
  };
}

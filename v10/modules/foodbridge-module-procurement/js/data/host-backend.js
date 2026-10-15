/*
  What the HOST backend (cafex) does behind the module's ports, over this prototype's documents —
  shared by the prototype's in-page server and the parity oracle, so both answer alike. Each
  function is shaped after the cafex code it stands in for; none of it is the module's.

    stockSummary          stockSummaryService.getStockSummary (StockSummaryPort)
    catalogueWritePort    CatalogueWritePort: addProductService, categoryservice.addCategory and the
                          product-image upload — each answering the service's own {statusCode, body}
    categoryProductTree   GET /v2/productlist/getAll → priceListServices.fetchAllCategoryAndProducts
                          (the create drawer's Raw Material catalogue, and Add New Item's categories)
    createPurchaseOrder   placeorder.orderPropogateUpHandler → savePurchaseOrderNode / saveOrderNew
                          (PurchaseOrderCreationPort) — with every notification a no-op

  And three host reads behind the Raw Material Calculator (the host's RawMaterialReportDrawer):
    salesOrderList        GET /v4/orders → the Sales Orders module's transformOrdersJson
    orderHistory          GET /v2/orderhistory/get → the Sales Orders module's getOrderHistory
    customerCatalogues    GET /v4/catalogue/get → catalogueService.getCatalogue
*/
import { IDS } from './documents.js';

/**
 * getStockSummary: every product of the location's DEFAULT catalogue — first those with demand
 * (open orders in a stock-reserving status), then the rest at zero demand — each with its stock on
 * hand, what is reserved, and the shortfall.
 */
export function stockSummary(docs, { outstandingOnly = false, reservingStatuses = ['Pending'] } = {}) {
  const products = docs.catalogue.products.filter((p) => docs.catalogue.catalogues.some((c) => String(c.locationReference) === IDS.location && c.catalogueType === 'CUSTOMER' && c.name === 'DEFAULT' && c.products.some((e) => e.id === p._id)));
  const byArticle = new Map(products.map((p) => [p.articleNo, p]));
  const demand = new Map();
  for (const so of docs.d.salesOrders) {
    if (!reservingStatuses.includes(so.status)) continue;
    for (const l of so.lines) demand.set(l.product.articleNo, (demand.get(l.product.articleNo) || 0) + Number(l.qty));
  }
  const items = [];
  for (const [articleNumber, required] of demand) {
    const product = byArticle.get(articleNumber) || null;
    const availableStock = parseFloat(product?.stock) || 0;
    const requiredStock = parseFloat(required.toFixed(4));
    items.push({
      boxes: product?.boxes, pallets: product?.pallets, ...(product || {}),
      articleNumber: product?.articleNo ?? articleNumber, productName: product?.name, unit: product?.measurement,
      availableStock, requiredStock, outstandingStock: parseFloat(Math.max(0, requiredStock - availableStock).toFixed(4)),
    });
  }
  if (!outstandingOnly) {
    for (const product of products) {
      if (demand.has(product.articleNo)) continue;
      items.push({
        boxes: product.boxes, pallets: product.pallets, ...product,
        articleNumber: product.articleNo, productName: product.name ?? 'Unknown Product', unit: product.measurement ?? '',
        availableStock: parseFloat(product.stock) || 0, requiredStock: 0, outstandingStock: 0,
      });
    }
  }
  return { products: outstandingOnly ? items.filter((i) => i.outstandingStock > 0) : items, meta: { totalCount: items.length, outstandingOnly } };
}

/**
 * The module's SupplierRepoContract over the shared supplier documents, written the way the real
 * repository writes (supplierRepo.ts): a new supplier carries every field cafex-repo's Supplier
 * entity writes, a fresh ObjectId, and created_date. (The module's own mock repository mints
 * `mock-supplier-N` from a process-wide counter, so its ids would differ from run to run.)
 */
export function supplierRepo(docs, newId, now) {
  const clone = (d) => JSON.parse(JSON.stringify(d));
  const find = (id) => docs.suppliers.find((s) => String(s._id) === String(id));
  return {
    async findByOrganisation(org) { return docs.suppliers.filter((d) => (d.orgRefs ?? []).map(String).includes(String(org))).map(clone); },
    async findById(id) { const d = find(id); return d ? clone(d) : null; },
    async findByContact(contact) { return docs.suppliers.filter((d) => d.contact === contact).map(clone); },
    async insert(doc) {
      const _id = newId('sup');
      docs.suppliers.push({
        _id, name: doc.name, contact: doc.contact, orgRefs: doc.orgRefs.map(String), email: doc.email ?? '', supplierCode: doc.supplierCode ?? '',
        gstNumber: doc.gstNumber ?? '', address: doc.address ?? '', state: doc.state ?? { code: '', name: '' }, postNumber: doc.postNumber ?? '',
        gstType: doc.gstType ?? '', supplierType: doc.supplierType ?? '', paymentsRecord: {}, created_date: new Date(now),
      });
      return _id;
    },
    async addOrganisation(id, org) { const d = find(id); if (!d) return; const refs = (d.orgRefs ?? []).map(String); if (!refs.includes(String(org))) refs.push(String(org)); d.orgRefs = refs; },
    async removeOrganisation(id, org) { const d = find(id); if (!d) return; d.orgRefs = (d.orgRefs ?? []).map(String).filter((o) => o !== String(org)); },
    async setFields(id, fields) { const d = find(id); if (d) Object.assign(d, fields); },
  };
}

/**
 * GET /v2/productlist/getAll — fetchAllCategoryAndProducts: the location's root categories, each
 * with its subcategories (whole category documents), each holding the MASTER catalogue's products
 * as MasterProductDto — then narrowed to the requested catalogue (DEFAULT unless `catalogueType`
 * says MASTER or RAW-MATERIAL), products outside it dropped, those in it ACTIVE.
 */
export function categoryProductTree(docs, { storeId, catalogueType } = {}, now = Date.now()) {
  const cat = docs.catalogue;
  const loc = storeId || IDS.location;
  const type = catalogueType || 'DEFAULT';
  const roots = new Map(cat.categories.filter((c) => !c.parentCategoryReference && String(c.locationReference) === loc)
    .map((c) => [String(c._id), { _id: c._id, name: c.name, description: c.description, locationReference: c.locationReference, categories: [], status: c.status }]));
  for (const sub of cat.categories) if (sub.parentCategoryReference && roots.has(String(sub.parentCategoryReference))) roots.get(String(sub.parentCategoryReference)).categories.push(JSON.parse(JSON.stringify(sub)));
  const master = cat.catalogues.find((c) => String(c.locationReference) === loc && c.catalogueType === 'MASTER');
  const masterIds = new Set((master?.products || []).map((e) => String(e.id)));
  const dto = (p) => ({
    id: String(p._id), name: p.name, imagesUrl: [], unitPrice: `${p.price}/${p.measurement}`, qty: p.quantity, comments: '', articleNumber: p.articleNo, description: p.desc,
    barcode: p.barcode, priceMap: p.priceMap, boxes: p.boxes, pallets: p.pallets, type1Percent: '', type1Discount: '', type2Percent: '', type2Discount: '', status: p.status,
    tax: p.tax, costPrice: p.costPrice, maxRetailPrice: p.maxRetailPrice, brand: p.brand, variants: p.variants || [],
    attributes: p.attributes || { moq: 1, gsm: 'NA', thikness: 'NA', rollLength: 1, thresholdLength: 300000000, priceBelowThreshold: 0.85, priceAboveThreshold: 0.7 },
    sourcingMetadata: [], batchStock: [], policyTemplateReference: p.policyTemplateReference || '', offerPriceMap: p.offerPriceMap,
    tags: p.tags, stock: p.stock, isInventoryEnabled: p.isInventoryEnabled, categoryReference: p.categoryReference, measurement: p.measurement,
  });
  const products = cat.products.filter((p) => masterIds.has(String(p._id))).map(dto);
  for (const root of roots.values()) for (const sub of root.categories) sub.categories = (sub.categories || []).concat(products.filter((p) => p.categoryReference === String(sub._id)));
  const chosen = type === 'MASTER' ? master
    : type === 'RAW-MATERIAL' ? cat.catalogues.find((c) => String(c.locationReference) === loc && c.catalogueType === 'RAW-MATERIAL')
      : cat.catalogues.find((c) => String(c.locationReference) === loc && c.catalogueType === 'CUSTOMER' && c.name === 'DEFAULT');
  const entries = chosen?.products || [];
  const inCatalogue = type !== 'MASTER' ? new Set(entries.map((e) => String(e.id))) : null;
  const detail = new Map(cat.products.map((p) => [String(p._id), p]));
  const tree = [...roots.values()];
  for (const root of tree) {
    if (root.name === 'DEFAULT') { root.categories = []; root.activeProductCount = 0; continue; }
    root.id = String(root._id);
    let rootActive = 0;
    for (const sub of root.categories) {
      sub.id = String(sub._id);
      let list = sub.categories || [];
      if (inCatalogue) { list = list.filter((p) => inCatalogue.has(String(p.id))); sub.categories = list; }
      let active = 0;
      for (const p of list) {
        if (entries.some((e) => String(e.id) === p.id)) p.status = 'ACTIVE'; else if (p.status === 'ACTIVE') p.status = 'INACTIVE';
        p.tags = p.tags || [];
        p.policyTemplate = [];
        const dp = detail.get(p.id);
        if (dp) { p.imagesUrl = Array.isArray(dp.imagesUrl) ? dp.imagesUrl : []; p.imagesReference = Array.isArray(dp.imagesReference) ? dp.imagesReference : []; }
        if (p.status === 'ACTIVE') active += 1;
        p.categoryId = String(sub._id);
        p.parentCategoryId = String(root._id);
      }
      sub.activeProductCount = active;
      rootActive += active;
    }
    root.activeProductCount = rootActive;
  }
  const products2 = tree.filter((c) => c.name !== 'RETURNABLE').map((c) => ({ ...c, categories: (c.categories || []).filter((sub) => sub.name !== 'RETURNABLE') }));
  for (const root of products2) for (const sub of root.categories) for (const p of sub.categories || []) p.image = [];
  const d = new Date(now);
  const two = (n) => (n < 10 ? `0${n}` : `${n}`);
  return { status: true, data: { products: products2, updatedOn: `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}` } };
}

/**
 * The host behind CatalogueWritePort (cafex routes/v3/purchase.js createCatalogueWritePort):
 *
 *   createProduct   addProductService — an article number already at the location is refused; else
 *                   the product (tranformAddProductJson → parseProduct: price and measurement from
 *                   `prices.originalPrice` and the whole `unit` string) joins the MASTER catalogue
 *                   and the DEFAULT one — or, for a raw material, the RAW-MATERIAL catalogue
 *   createCategory  categoryservice.addCategory — a same-named sibling is a 409
 *   uploadProductImage  stores the file and answers its URL (the S3 key convention)
 */
export function catalogueWritePort(docs, { newId, now }) {
  const cat = docs.catalogue;
  return {
    async createProduct(caller, body) {
      const { catalogueType, ...product } = body || {};
      const loc = caller.locationStoreId;
      const locProducts = new Set(cat.catalogues.filter((c) => String(c.locationReference) === loc).flatMap((c) => (c.products || []).map((e) => String(e.id))));
      if (cat.products.some((p) => p.articleNo === product.articleNo && locProducts.has(String(p._id)))) return { statusCode: 400, body: { status: false, message: 'Article number already exists!' } };
      const unit = product.unit?.split('/')?.[0] || '';
      const price = parseFloat(product.prices?.originalPrice || 0);
      const offerPrice = parseFloat(product.prices?.price || 0);
      const _id = newId('prd');
      const doc = {
        _id, name: product.title?.en || '', articleNo: product.articleNo, desc: product.description?.en || '', price, offerPrice, measurement: unit,
        priceMap: product.prices?.priceMap, offerPriceMap: product.prices?.offerPriceMap, categoryReference: product.categories?.[0] || '',
        imagesReference: [], policyTemplateReference: [], stock: product.stock || 0, boxes: product.boxes || 1, pallets: product.pallets || 1, tax: product.tax || 0,
        status: product.status === 'hide' ? 'INACTIVE' : 'ACTIVE', barcode: product.barcode, isInventoryEnabled: true, brand: product.brand || '', maxRetailPrice: 0,
        variants: [], attributes: { sku: product.sku, ...product.attributes },
      };
      cat.products.push(doc);
      const entry = { id: _id, price, offerPrice, priceMap: doc.priceMap, offerPriceMap: doc.offerPriceMap };
      const at = (pred) => cat.catalogues.find((c) => String(c.locationReference) === loc && pred(c));
      at((c) => c.catalogueType === 'MASTER')?.products.push({ ...entry });
      if (catalogueType === 'RAW-MATERIAL') {
        let raw = at((c) => c.catalogueType === 'RAW-MATERIAL');
        if (!raw) { raw = { _id: newId('ctl'), locationReference: loc, catalogueType: 'RAW-MATERIAL', name: 'RAW-MATERIAL', products: [] }; cat.catalogues.push(raw); }
        raw.products.push({ ...entry });
      } else if (doc.status === 'ACTIVE') at((c) => c.catalogueType === 'CUSTOMER' && c.name === 'DEFAULT')?.products.push({ ...entry });
      return { statusCode: 200, body: { status: true, message: 'Products added successfully !!', data: { addedProducts: { [doc.articleNo]: _id } } } };
    },
    async createCategory(caller, body) {
      const name = body.name?.[body.lang] || 'Default Name';
      if (name.toUpperCase() === 'RETURNABLE') return { statusCode: 400, body: { status: false, message: 'RETURNABLE is a system-managed category and cannot be created manually.' } };
      const parent = body.parentId;
      const loc = caller.locationStoreId;
      if (cat.categories.some((c) => c.name === name && String(c.parentCategoryReference || '') === String(parent || '') && (!parent ? String(c.locationReference) === loc : true))) return { statusCode: 409, body: { status: false, message: 'Category already exists' } };
      const _id = newId('cat');
      cat.categories.push({ _id, name, ...(parent ? { parentCategoryReference: parent } : {}), description: body.description?.[body.lang] || '', locationReference: loc, created_date: new Date(now) });
      return { statusCode: 200, body: { status: true, message: 'category saved successfully', data: { categoryRef: _id, fileUploaded: Boolean(body.icon) } } };
    },
    async uploadProductImage(_caller, _file, fields) {
      const url = `https://parity.invalid/products/${fields.articleNumber}_${fields.index || 0}.jpeg`;
      return { statusCode: 200, body: { status: true, message: 'Image uploaded successfully', data: { url } } };
    },
  };
}

/** orderServices.getOrderNumber: local date and time, unpadded, then a random 1–100. */
export function orderNumber(now, random) {
  const d = new Date(now);
  return `${d.getFullYear()}${d.getMonth() + 1}${d.getDate()}${d.getHours()}${d.getMinutes()}${d.getSeconds()}${Math.floor(random() * 100 + 1)}`;
}

/**
 * orderPropogateUpHandler, over the documents. An external supplier gets one PURCHASE_ORDER node;
 * an internal location gets its own ORDER first (the seller's side, status from the seller's role)
 * and a PURCHASE_ORDER at that status, linked both ways. Answers { status, body } like the handler.
 */
export function createPurchaseOrder(docs, reqBody, { now, random, newId, placeOrderStatus = 'InProgress', sellerOrderStatus = 'Pending' }) {
  const { supplier: locationData, supplier_id, products, ...rest } = reqBody || {};
  if (!products || !Array.isArray(products) || products.length === 0) return { status: 400, body: { status: false, message: 'products is required and must be a non-empty array' } };
  const buyer = reqBody.buyerLocationStoreId || null;
  const PaymentDetails = rest.PaymentDetails || { orderStatus: 'Payment-Confirmed', method: 'pod', verifiedStatus: false, details: { customerVerificationRequestStatus: false, transactionMethod: 'pod', provider: 'POD', transactionID: '' } };
  const ShippingDetails = rest.ShippingDetails || { method: '' };
  const comments = rest.orderComments || '';
  const palletCount = rest.palletCount || 0;
  const orderDiscount = rest.orderDiscount || 0;
  const at = new Date(now);

  const node = ({ _id, type, status, location_id = null, supplier_id: supId = null, relations = [], extra = {} }) => ({
    _id, type, order_number: orderNumber(now, random), item_list: products,
    itemListAudit: [{ userId: IDS.user, date: now, itemList: products }], orderDiscount, pricelist_id: null,
    PaymentDetails, ShippingDetails, status, comments,
    stageAudit: [{ userId: IDS.user, roleId: IDS.role, status, documents: [], comment: comments || '', challan: products.map((i) => ({ ...i, expectedQty: i.qty, verifiedQty: i.qty })), created_date: at, updatedAt: at, updatedBy: IDS.user }],
    statusAudit: [{ userId: IDS.user, roleId: IDS.role, date: at, status }],
    palletCount: palletCount || null, user_id: IDS.user, org_id: IDS.org, created_by: null, location_id, buyer_location_id: buyer,
    created_date: at, updated_date: null, relations, appliedOffers: [], baseTotal: 0, discountTotal: 0, finalTotal: 0, freeItems: [], metaData: {},
    ...extra,
  });

  if (supplier_id) {
    if (!buyer) return { status: 400, body: { status: false, message: 'Could not resolve buyer location store' } };
    const supplier = docs.suppliers.find((s) => String(s._id) === String(supplier_id));
    if (!supplier) return { status: 404, body: { status: false, message: 'Supplier not found' } };
    if (!(supplier.orgRefs || []).map(String).includes(String(IDS.org))) return { status: 403, body: { status: false, message: 'Your organisation is not linked to this supplier' } };
    const po = node({ _id: newId('po'), type: 'PURCHASE_ORDER', status: placeOrderStatus, supplier_id, extra: { supplier_id, purchaseOrderDocuments: [], sourcingDetails: rest } });
    docs.purchaseOrders.push(po);
    return { status: 200, body: { status: true, message: 'Purchase order created successfully', data: po } };
  }

  if (!locationData || !locationData._id || !locationData.orgId) return { status: 400, body: { status: false, message: 'Missing required fields: supplier._id and supplier.orgId are required' } };
  if (!docs.locations.some((l) => String(l._id) === String(locationData._id)) && String(docs.store._id) !== String(locationData._id)) return { status: 404, body: { status: false, message: 'Supplier location not found' } };
  const orderId = newId('ord');
  const poId = newId('po');
  const order = node({ _id: orderId, type: 'ORDER', status: sellerOrderStatus, location_id: locationData._id, relations: [{ relationType: 'isPurchaseOrderOf', sourceId: orderId, destinationId: poId }], extra: { parentOrderId: null, sourcingDetails: rest } });
  docs.orders.push(order);
  const po = node({ _id: poId, type: 'PURCHASE_ORDER', status: order.status, location_id: locationData._id, relations: [{ relationType: 'hasOrder', sourceId: poId, destinationId: orderId }], extra: { supplier_id: null, purchaseOrderDocuments: [], sourcingDetails: rest } });
  docs.purchaseOrders.push(po);
  return { status: 200, body: { status: true, message: 'Order propagated successfully!!', data: { order, purchaseOrder: po } } };
}

/** A customer's orders at the store: its ORDER nodes, newest first, children excluded. */
function ordersByOrg(docs) {
  const byOrg = new Map();
  for (const o of docs.salesOrders || []) {
    if (o.parentOrderId) continue;
    const k = String(o.org_id);
    if (!byOrg.has(k)) byOrg.set(k, []);
    byOrg.get(k).push(o);
  }
  return byOrg;
}

/**
 * GET /v4/orders — transformOrdersJson (sales-orders backend repos/v4OrdersTransform.ts): every
 * non-child order, user_info derived from its ORGANISATION (never read from the order), newest
 * first, the page window cut in the query (so totalDoc is the pre-window count).
 */
export function salesOrderList(docs, { page = 1, limit = 8, search = '', status = '' } = {}) {
  const byOrg = ordersByOrg(docs);
  const all = (docs.customers || []).flatMap((org) => (byOrg.get(String(org._id)) || []).map((order) => ({ order, org })))
    .sort((a, b) => new Date(b.order.created_date) - new Date(a.order.created_date));
  const needle = String(search || '').trim().toLowerCase();
  const filtered = all.filter(({ order, org }) => (!status || order.status === status) && (!needle
    || String(org.name).toLowerCase().includes(needle) || String(order.order_number).toLowerCase().includes(needle) || String(org.phone).includes(String(search).trim())));
  const window = filtered.slice((Number(page) - 1) * Number(limit), Number(page) * Number(limit));
  const orders = window.map(({ order, org }) => {
    const subTotal = order.item_list.reduce((sum, l) => sum + Number(l.qty) * Number(l.priceMap?.[l.orderingUnit] ?? l.price ?? 0), 0);
    return {
      user_info: { name: org.name, contact: org.phone, email: org.email, address: org.address1 ?? '', address2: org.address2 ?? '', state: org.state, postNumber: org.postNumber, shippingState: org.shippingState, shippingPostnumber: org.shippingPostnumber },
      _id: String(order._id), paymentMethod: 'NA', status: order.status, subTotal, shippingCost: order.ShippingDetails?.charges ?? 0, total: subTotal,
      createdAt: new Date(order.created_date).toISOString(), updatedAt: new Date(order.modified_date).toISOString(), invoice: order.order_number,
      buyer_location_id: order.buyer_location_id, purchaseOrderNumber: order.linked_purchase_order_number ?? null,
    };
  });
  return { orders, limit: Number(limit), pages: Number(page), totalDoc: all.length, methodTotals: [] };
}

/** GET /v2/orderhistory/get (an admin at their own location): every org with orders there, and its orders. */
export function orderHistory(docs) {
  const byOrg = ordersByOrg(docs);
  const orgs = (docs.customers || []).filter((org) => byOrg.has(String(org._id))).map((org) => ({
    ...JSON.parse(JSON.stringify(org)),
    orders: JSON.parse(JSON.stringify(byOrg.get(String(org._id)))),
  }));
  return { status: true, data: { orgs } };
}

/**
 * GET /v4/catalogue/get — every CUSTOMER catalogue at the location (getCatalogueDetailsByType's
 * {catalogue:{_id,name,type}, location, products, …}), each with the organisations of its customer
 * type: MASTER and CANCELLED orgs left out, and DEFAULT's first one shifted off (the admin's own).
 */
export function customerCatalogues(docs, locationId = IDS.location) {
  const cat = docs.catalogue;
  const data = cat.catalogues.filter((c) => String(c.locationReference) === String(locationId) && c.catalogueType === 'CUSTOMER').map((c) => {
    const organizations = (docs.customers || [])
      .filter((org) => org.locationCustomerTypeRefMap?.find((m) => m.locationRef === String(locationId))?.customerTypeRef === c.customerTypeReference)
      .filter((org) => org.orgType !== 'MASTER' && org.status !== 'CANCELLED')
      .map(({ locationCustomerTypeRefMap, userRefs, locationShippingAddressRefMap, ...rest }) => JSON.parse(JSON.stringify(rest)));
    if (c.name === 'DEFAULT') organizations.shift();
    return {
      catalogue: { _id: String(c._id), name: c.name, type: c.catalogueType },
      location: { _id: String(c.locationReference), name: docs.store?.name },
      products: JSON.parse(JSON.stringify(c.products)),
      customerTypeReference: c.customerTypeReference,
      organizations,
    };
  });
  return { status: true, message: 'Catalogue retrieved successfully', data };
}

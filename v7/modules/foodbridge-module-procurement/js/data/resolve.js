/*
  The dataset stores AGES, not dates. This turns it into dated records against one instant ("now"),
  so the screen always opens on today. Both renderers use it: the prototype, and the parity oracle's
  fixture builder (tests/parity/oracle/to-module-docs.mjs) — one input, two screens.
*/

const MINUTE = 60000;

/** Deterministic ObjectId-shaped ids: '6a' + a kind digit + the record's number, zero-padded. */
const KIND = { po: '1', ord: '2', dsp: '3', sup: '4', loc: '5', prd: '6', cat: '7', doc: '8', so: '9', usr: 'a', org: 'b', ctl: 'c', rol: 'd', typ: 'e', pol: 'f' };
export function oid(kind, id) {
  const n = String(id).replace(/\D/g, '');
  return `6a${KIND[kind]}${n.padStart(21, '0')}`;
}

/**
 * Mints fresh ObjectId-shaped ids for records created while the screen runs (a document, an
 * attachment, an expense): the same sequence from the same start, so the prototype and the oracle
 * give the n-th new record the same id.
 */
export function createMinter(kind, start) {
  let n = start;
  return () => oid(kind, (n += 1));
}

/**
 * A purchase-order line, as the host's create drawer stores it on the node's item_list: the
 * product's ids (string ObjectIds, `id` and `_id` alike — there is no productId key), and the
 * ordered quantity as a STRING, which is how the QA data holds it on item_list.
 */
export function lineDoc(product, qty, unitLevel) {
  const units = product.measurement.split('-');
  const orderingUnit = units[unitLevel] || units[0];
  return {
    id: oid('prd', product.id),
    _id: oid('prd', product.id),
    name: product.name,
    imagesUrl: [],
    unitPrice: `${product.price}/${product.measurement}`,
    qty: String(qty),
    comments: '',
    articleNumber: product.articleNo,
    description: '',
    barcode: '',
    priceMap: { ...product.priceMap },
    boxes: product.boxes,
    pallets: product.pallets,
    status: 'show',
    tax: product.tax,
    measurement: product.measurement,
    price: product.price,
    offerPrice: product.price,
    categoryId: oid('cat', product.categoryId),
    priceCalculationUnitIndex: unitLevel,
    palletCount: product.pallets,
    orderingUnit,
    // Always in the smallest (secondary) unit — a box of 10 packets ordered as 3 boxes is 30.
    baseUnitQty: unitLevel === 1 ? qty * product.boxes : qty,
  };
}

export function resolveDataset(data, now) {
  const products = data.products.map((p) => ({ ...p }));
  const byProduct = Object.fromEntries(products.map((p) => [p.id, p]));
  const at = (minutesAgo) => new Date(now - minutesAgo * MINUTE);

  const purchaseOrders = data.purchaseOrders.map((po) => {
    const lines = po.lines.map(([productId, qty, unitLevel]) => lineDoc(byProduct[productId], qty, unitLevel));
    return {
      ...po,
      createdAt: at(po.minutesAgo),
      lines,
      received: po.received ? { ...po.received, at: at(po.received.minutesAgo) } : null,
      dispatch: po.dispatch ? { ...po.dispatch, at: at(po.dispatch.minutesAgo) } : null,
      documents: (po.documents || []).map((d) => ({ ...d, uploadedAt: at(d.minutesAgo) })),
    };
  });

  const salesOrders = data.salesOrders.map((so) => ({
    ...so,
    createdAt: at(so.daysAgo * 1440),
    lines: so.lines.map(([productId, qty]) => ({ product: byProduct[productId], qty })),
  }));

  return { ...data, products, byProduct, purchaseOrders, salesOrders, now };
}

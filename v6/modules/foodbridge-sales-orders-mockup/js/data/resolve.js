/*
  Turns dataset.json into the records the screen works with.

  The dataset stores ages ("placed 90 minutes ago"), not timestamps, so the prototype always opens
  on today. This file is the one place those ages become dates and order numbers. It is an ES
  module with no browser dependencies because the parity harness imports it too: the production
  app is fed the SAME resolved records, so a difference on screen is a difference in rendering,
  never in data.

  Nothing here formats for display. Display rules live in js/sales-orders/model.js.
*/

const MINUTE = 60 * 1000;

/**
 * The order number the production app shows: the order's calendar date with no zero padding,
 * followed by a counter — 2026 · 9 · 25 · 7534374 → "20269257534374".
 */
export function orderNumber(date, suffix) {
  return `${date.getFullYear()}${date.getMonth() + 1}${date.getDate()}${suffix}`;
}

const byId = (list) => new Map(list.map((x) => [x.id, x]));

/** Line total before tax: quantity × the line's price (the product's own price unless overridden). */
function priceLine(item, product) {
  const price = item.price ?? product.price;
  return {
    productId: product.id,
    articleNo: product.articleNo,
    name: product.name,
    unit: product.unit,
    tax: product.tax,
    price,
    qty: item.qty,
  };
}

/**
 * @param {object} dataset  js/data/dataset.json
 * @param {number} now      epoch ms the ages are counted back from — Date.now() in the browser,
 *                          a fixed instant in the parity harness
 */
export function resolveDataset(dataset, now = Date.now()) {
  const products = dataset.products.map((p) => ({ ...p }));
  const productById = byId(products);
  const customers = dataset.customers.map((c) => ({ ...c }));
  const customerById = byId(customers);

  const orders = dataset.orders.map((o) => {
    const createdAt = new Date(now - o.placedMinutesAgo * MINUTE);
    return {
      id: o.id,
      number: o.number ?? orderNumber(createdAt, o.numberSuffix),
      createdAt,
      customerId: o.customerId,
      status: o.status,
      paymentMethod: o.paymentMethod,
      shippingCost: o.shippingCost ?? 0,
      discount: o.discount ?? 0,
      comment: o.comment ?? '',
      items: o.items.map((it) => priceLine(it, productById.get(it.productId))),
    };
  });
  const orderById = byId(orders);

  const dispatches = dataset.dispatches.map((d, i) => {
    const order = orderById.get(d.orderId);
    const siblings = dataset.dispatches.filter((x) => x.orderId === d.orderId);
    const seq = siblings.indexOf(d) + 1;
    return {
      id: d.id,
      orderId: d.orderId,
      number: `${order.number}-D${seq}`,
      status: d.status,
      createdAt: new Date(order.createdAt.getTime() + (d.minutesAfterOrder ?? 90) * MINUTE),
      items: d.items.map((it) => priceLine(it, productById.get(it.productId))),
      index: i,
    };
  });
  const dispatchById = byId(dispatches);

  const deliveries = dataset.deliveries.map((d, i) => ({
    id: d.id,
    number: `DLV-${String(i + 1).padStart(4, '0')}`,
    dispatchIds: [...d.dispatchIds],
    status: d.status,
    progress: d.progress,
    staffId: d.staffId,
  }));

  const returns = dataset.returns.map((r, i) => ({
    id: r.id,
    number: `RET-${String(i + 1).padStart(4, '0')}`,
    dispatchId: r.dispatchId,
    status: r.status,
    items: r.items.map((it) => priceLine(it, productById.get(it.productId))),
  }));

  return {
    now,
    seller: dataset.seller,
    creditGroups: dataset.creditGroups,
    staff: dataset.staff,
    routeTemplates: dataset.routeTemplates,
    customers,
    customerById,
    products,
    productById,
    orders,
    orderById,
    dispatches,
    dispatchById,
    deliveries,
    returns,
  };
}

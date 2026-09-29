/*
  Every product rule of the list, as the production module states it (its SSOT 04 frontend domain
  model, F8–F17, and the controller useSourcingOrderList): who the counterparty is, what is hidden,
  what the search matches, the date range, the order, the page, the amount, the status options and
  which document actions a row offers. Views never decide any of this.
*/

export const PAGE_SIZE = 20;

/** F8 — location first (grouped locations, then the seller list), else the external supplier. */
export function resolveSeller(order, internal, external) {
  if (order.location_id) {
    const hit = internal.find((l) => l._id === order.location_id);
    if (hit) return { ...hit, _sourceType: 'internalSupplier' };
    return null;
  }
  if (order.supplier_id) {
    const hit = external.find((s) => s._id === order.supplier_id);
    return hit ? { ...hit, _sourceType: 'externalSupplier' } : null;
  }
  return null;
}

/** F10 — number, counterparty name and every item name, lowercased, joined. */
export function searchBlob(order, seller) {
  const items = Array.isArray(order.item_list) ? order.item_list.map((i) => i?.name).filter(Boolean) : [];
  return [order.order_number, seller?.name, ...items].filter(Boolean).join(' ').toLowerCase();
}

/** F8 + F10 + F14 — one row per order, resolved and sorted newest first (a stable sort). */
export function buildRows(orders, internal, external) {
  const rows = orders.map((order) => {
    const seller = resolveSeller(order, internal, external);
    return { type: 'purchase_order', order, seller, _searchBlob: searchBlob(order, seller) };
  });
  return [...rows].sort((a, b) => new Date(b.order?.created_date ?? 0).getTime() - new Date(a.order?.created_date ?? 0).getTime());
}

/** F9 + F11 + F12 + F13, in the baseline's order. */
export function filterRows(rows, { search, status, startDate, endDate }) {
  const needle = (search ?? '').toLowerCase().replace(/^po[-\s]+/, '');
  return rows
    .filter((r) => r.seller?.supplierType !== 'DEPARTMENT')
    .filter((r) => !search || Boolean(r._searchBlob?.includes(needle)))
    .filter((r) => !status || r.order.status === status)
    .filter((r) => {
      if (!startDate || !endDate) return true;
      const t = new Date(r.order?.created_date || r.order?.createdAt || 0);
      const from = new Date(startDate); const to = new Date(endDate);
      from.setHours(0, 0, 0, 0); to.setHours(23, 59, 59, 999);
      return t >= from && t <= to;
    });
}

export const pageOf = (rows, page) => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

/** F15 — DEPARTMENT sources are not offered when raising an order. */
export const selectableSources = (sources) => (sources ?? []).filter((s) => s?.supplierType !== 'DEPARTMENT');

/**
 * SourcingTable.calcOrderTotal: a stored total wins; otherwise each line through the host's
 * calculator (tax-inclusive, a 2dp STRING), summed as numbers.
 */
export function orderTotal(order, host) {
  if (order?.total && order.total > 0) return order.total;
  let total = 0;
  for (const item of order?.item_list || []) {
    const qty = Number(item.qty) || Number(item.quantity) || 0;
    total += item.itemTotal ? Number(item.itemTotal) : Number(host.calculateItemPrice({ ...item, qty, taxIncluded: true }) ?? 0);
  }
  return total;
}

/** The status control of a row: which options, which value, and whether it can change. */
export function statusControl(order, host) {
  const rules = host.orderStatusRules;
  const isExternal = Boolean(order.supplier_id);
  const next = isExternal ? rules.getNextAllowedStatuses('PURCHASE_ORDER').find((w) => w.status === order.status)?.nextStatuses || [] : [];
  const options = isExternal ? [order.status, ...next] : [order.dispatchStatus || order.status];
  const auditAllowed = isExternal && rules.isAuditAllowedForStatus(order.status, 'PURCHASE_ORDER');
  const actions = (isExternal && rules.getStep(order.status, 'PURCHASE_ORDER')?.actionLabels) || {};
  return {
    options,
    value: isExternal ? order.status : order.dispatchStatus || order.status,
    disabled: !isExternal || options.length <= 1 || !auditAllowed,
    // v7: a move the step names as an action reads as that action ("Approve", "Reject").
    label: (s) => (s !== order.status && actions[s]) || host.toTitleCase(s),
  };
}

/**
 * v7 — Internal approval: the step a new purchase order waits at before it goes to the supplier.
 * Its moves are decisions, not deliveries: nothing is received, so the drawer shows the order as
 * raised and asks only for a comment (a reason, where the step requires one).
 */
export function approvalStep(order, newStatus, host) {
  const step = host.orderStatusRules.getStep(order?.status, 'PURCHASE_ORDER');
  const action = step?.actionLabels?.[newStatus];
  if (!action) return null;
  return { action, reject: /reject/i.test(action), commentRequired: (step.commentRequired || []).includes(newStatus) };
}

/** F17 — which document actions a row offers, and whether its invoice is overdue (docMode PURCHASE_ORDER). */
export function documentState(order, host, documents) {
  const docs = documents || order.purchaseOrderDocuments || [];
  const invoices = docs.filter((d) => d.type === 'SUPPLIER_INVOICE').length;
  const delivered = host.orderStatusRules.isPurchaseOrderDelivered(order);
  const hasSupplier = Boolean(order.supplier_id);
  return {
    docs,
    invoiceCount: invoices,
    otherDocs: docs.filter((d) => d.type === 'OTHER'),
    delivered,
    showGoodsReceipt: delivered,
    showSupplierDocuments: hasSupplier,
    needsInvoice: hasSupplier && delivered && invoices === 0,
  };
}

/** The counterparty chip (domain/sourcingPresentation.getSupplierTypeChip). */
export function supplierChip(seller) {
  if (seller?._sourceType === 'internalSupplier') return { label: 'Internal', classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 ring-1 ring-blue-200' };
  if (seller?.supplierType === 'DEPARTMENT') return { label: 'Department', classes: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 ring-1 ring-purple-200' };
  return { label: 'External', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-1 ring-amber-200' };
}

/** The mobile card's status pill colours (sourcingOrderStatusTheme), by lowercased status. */
export const STATUS_THEME = {
  delivered: 'bg-green-50 text-green-700',
  'partial delivered': 'bg-purple-50 text-purple-700',
  shipping: 'bg-purple-50 text-purple-700',
  inprogress: 'bg-purple-50 text-purple-700',
  pending: 'bg-gray-50 text-gray-500',
  'not accepted': 'bg-red-50 text-red-700',
  'pending approval': 'bg-amber-50 text-amber-700',
  rejected: 'bg-red-50 text-red-700',
};

/** PurchaseForecastTable.deriveForecastRow */
export function deriveForecastRow(row, index) {
  const demand = Number(row.demand) || 0;
  const currentStock = Number(row.currentStock) || 0;
  const shortage = Math.round(Math.max(demand - currentStock, 0) * 100) / 100;
  const recommendedPurchase = row.recommendedQuantity !== undefined && row.recommendedQuantity !== null ? Number(row.recommendedQuantity) || 0 : shortage;
  const price = row.offerPrice ?? row.price ?? row.unitPrice;
  return {
    id: row.articleNumber ?? row.id ?? row._id ?? index,
    articleNumber: row.articleNumber,
    productId: row.productId ?? null,
    product: row.name || row.articleNumber || 'Unnamed product',
    sku: row.articleNumber,
    category: row.category?.name ?? row.category ?? null,
    measurement: row.measurement ?? null,
    moq: Number(row.moq) || 1,
    supplier: row.supplier ?? null,
    onOrder: Number(row.onOrder) || 0,
    demand, currentStock, shortage, recommendedPurchase,
    price: price !== undefined && price !== null ? Number(price) : undefined,
  };
}

/** The forecast banner's figures: rows short of stock, largest first, and the top three. */
/** v7: the platform keeps the business type in fb-persona (manufacturer by default). A manufacturer's
    purchase forecast leads with raw materials; finished goods stay as secondary context. */
export function isManufacturer() {
  let p = null;
  try { p = localStorage.getItem('fb-persona'); } catch { /* storage blocked */ }
  return (p || 'manufacturer') === 'manufacturer';
}

export function forecastStats(data) {
  const shortage = (data || []).map(deriveForecastRow).filter((r) => r.recommendedPurchase > 0).sort((a, b) => b.recommendedPurchase - a.recommendedPurchase);
  return {
    count: shortage.length,
    totalQty: shortage.reduce((s, r) => s + r.recommendedPurchase, 0),
    topItems: shortage.slice(0, 3).map((r) => ({ ...r, severity: r.demand > 0 && r.currentStock / r.demand < 0.5 ? 'red' : 'amber' })),
  };
}

/** The date/time strings the rows print (toLocaleDateString / toLocaleTimeString, en-IN). */
export const fmtDate = (d, withYear = true) => new Date(d).toLocaleDateString('en-IN', withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });
export const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

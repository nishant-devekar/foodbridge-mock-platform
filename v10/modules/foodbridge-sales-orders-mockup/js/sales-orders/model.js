/*
  The Sales Orders product rules — everything the screen DERIVES, in one place.

  This is the observable contract of the production screen, restated for the prototype: which
  orders a query returns and in what order, what a row's amount is, which status it shows, what
  its status control offers, when Invoice and Edit are available, what the fulfilment chips count,
  the allocation KPI, and the Smart Insights rules and wording. Each rule names the production
  behaviour it reproduces. Nothing here draws anything; the views read from this.

  Change a rule here and every screen that shows it changes with it.
*/

export const MONEY_SPACE = '\u00a0';
const DAY = 24 * 60 * 60 * 1000;
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

const lc = (s) => String(s ?? '').toLowerCase();
const normalizeStatusKey = (s) => lc(s).replace(/[\s_-]+/g, '');

/** "ORDER TEST  customer" → "Order Test Customer" (words collapse, as production does). */
export function toTitleCase(str) {
  if (typeof str !== 'string' || !str.trim()) return '';
  return str.toLowerCase().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export const formatMoney = (currency, value) => `${currency}${MONEY_SPACE}${Number(value || 0).toFixed(2)}`;

/** The list's IST day boundaries for a YYYY-MM-DD filter value. */
const istDayStart = (ymd) => (ymd ? new Date(Date.parse(`${ymd}T00:00:00.000Z`) - IST_OFFSET) : null);
const istDayEnd = (ymd) => (ymd ? new Date(Date.parse(`${ymd}T23:59:59.999Z`) - IST_OFFSET) : null);

// Dispatch status precedence when an order has several — the most "active" one is shown.
const STATUS_PRIORITY = ['reject', 'cancel', 'in_progress', 'processing', 'transit', 'shipped', 'packed', 'ready', 'deliver', 'complet'];
const rankStatus = (status) => {
  const i = STATUS_PRIORITY.findIndex((p) => lc(status).includes(p));
  return i === -1 ? STATUS_PRIORITY.length : i;
};
export function dominantDispatch(dispatches) {
  if (!dispatches?.length) return null;
  return dispatches.reduce((best, d) => (rankStatus(d.status) <= rankStatus(best.status) ? d : best), dispatches[0]);
}

export function createModel(tenant, data) {
  const workflow = tenant.orderWorkflow || {};
  const appProp = tenant.appProp || {};
  const flags = appProp.orderManagementFeatures || {};
  const currency = appProp.currency || '₹';

  // ── Labels. The screen names itself after the tenant's menu entry for "orders". ──────────
  const menu = (tenant.storefrontMenus || []).find((m) => lc(m.path) === 'orders');
  const label = menu?.name || 'Orders';

  // ── Workflow ──────────────────────────────────────────────────────────────────────────
  const statusWorkflow = (nodeType = 'ORDER') => workflow.statusWorkFlow?.[nodeType] || [];
  const nextStatusesOf = (status) => statusWorkflow('ORDER').find((w) => w.status === status)?.nextStatuses || [];
  const isAuditAllowed = (status, nodeType = 'ORDER') => statusWorkflow(nodeType).find((w) => w.status === status)?.isAuditAllowed === true;
  const isInvoiceAllowed = (status) => (workflow.invoiceAllowedStatuses || []).includes(status) && status !== 'Cancelled';
  const editAllowed = workflow.editAllowedStatuses || [];

  /** The status filter's options: the ORDER workflow's statuses, first letter capitalised. */
  const statusFilterOptions = () => [...new Set(statusWorkflow('ORDER').map((w) => w.status))]
    .map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }));

  // ── Toolbar and columns, per tenant flag (strictly === true, as production reads them) ──
  const features = {
    createDelivery: flags.createDelivery === true,
    orderForecast: flags.orderForecast === true,
    bulkProxyOrder: flags.bulkProxyOrder === true,
    demandReport: flags.demandReport === true,
    downloadAllOrders: flags.downloadAllOrders === true,
    allocationStatus: flags.allocationStatus === true,
    invoiceColumn: appProp.showOrderInvoiceAction !== false,
    googleSheetExport: appProp.googleSheet?.view === true,
    googleSheetSync: appProp.googleSheet?.edit === true,
  };

  // ── Fulfilment joins: order → dispatches → deliveries / returns ─────────────────────────
  const dispatchesByOrder = new Map();
  for (const d of data.dispatches) {
    if (!dispatchesByOrder.has(d.orderId)) dispatchesByOrder.set(d.orderId, []);
    dispatchesByOrder.get(d.orderId).push(d);
  }
  const deliveriesByDispatch = new Map();
  for (const v of data.deliveries) for (const id of v.dispatchIds) {
    if (!deliveriesByDispatch.has(id)) deliveriesByDispatch.set(id, []);
    deliveriesByDispatch.get(id).push(v);
  }
  const returnsByDispatch = new Map();
  for (const r of data.returns) {
    if (!returnsByDispatch.has(r.dispatchId)) returnsByDispatch.set(r.dispatchId, []);
    returnsByDispatch.get(r.dispatchId).push(r);
  }
  const unique = (list) => [...new Map(list.map((x) => [x.id, x])).values()];

  function liveFulfilment(orderId) {
    const dispatches = dispatchesByOrder.get(orderId) || [];
    const deliveries = unique(dispatches.flatMap((d) => deliveriesByDispatch.get(d.id) || []));
    const returns = unique(dispatches.flatMap((d) => returnsByDispatch.get(d.id) || []));
    return { dispatches, deliveries, returns, counts: { dispatches: dispatches.length, deliveries: deliveries.length, returns: returns.length } };
  }

  // The list reads an order's dispatches/deliveries/returns ONCE per set of orders on the page:
  // production's table re-fetches them only when the page's order ids change, so after a change
  // that keeps the same page (a delivery created from those orders) the chips and the locked
  // status stay as they were until the page changes. Reproduced as production shows it.
  let pinned = null;
  function pinFulfilment(orderIds) {
    const key = orderIds.join(',');
    if (pinned?.key === key) return;
    pinned = { key, map: new Map(orderIds.map((id) => [id, liveFulfilment(id)])) };
  }
  const fulfilment = (orderId) => pinned?.map.get(orderId) || liveFulfilment(orderId);

  // ── Money. A line is qty × price with its tax; the row adds shipping, takes the discount. ──
  const lineGross = (l) => l.qty * l.price * (1 + (l.tax || 0) / 100);
  const itemsGross = (items) => items.reduce((s, l) => s + lineGross(l), 0);
  const rowTotal = (order) => Math.max(0, itemsGross(order.items) + (order.shippingCost || 0) - (order.discount || 0));
  const listTotal = (order) => itemsGross(order.items); // the list endpoint's own `total`

  const customerOf = (order) => data.customerById.get(order.customerId);

  // ── The list query — production answers it server-side; the prototype answers it here. ──
  // Newest first; `status` matches the stored order status exactly; dates are IST calendar days.
  //
  // SEARCH: the query stage matches an order-number PREFIX (case-sensitive), or orders whose org —
  // the buyer's — has a matching name (any case) or phone. The post-fetch filter (name / number /
  // phone, any case) then narrows what the page holds.
  function listOrders({ search = '', status = '', startDate = '', endDate = '', page = 1, limit = 20 } = {}) {
    const raw = search.trim();
    const needle = raw.toLowerCase();
    const from = istDayStart(startDate);
    const to = istDayEnd(endDate);
    const all = [...data.orders]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter((o) => {
        const c = customerOf(o);
        if (from && o.createdAt < from) return false;
        if (to && o.createdAt > to) return false;
        if (status && o.status !== status) return false;
        if (raw) {
          if (!o.number.startsWith(raw) && !lc(c.name).includes(needle) && !String(c.phone).includes(raw)) return false; // query stage
          const hit = lc(c.name).includes(needle) || lc(o.number).includes(needle) || String(c.phone).includes(raw);
          if (!hit) return false; // post-fetch stage
        }
        return true;
      });
    return { orders: all.slice((page - 1) * limit, page * limit), totalDoc: all.length };
  }

  /**
   * The table's second pass over a page: with a status filter on, a row is kept only if its
   * EFFECTIVE status (the dominant dispatch's, else the order's) matches. The page's count still
   * reports the server's total — production does the same, so a filtered page can show fewer
   * rows than "SHOWING 1–20" says.
   */
  function visibleOnPage(orders, statusFilter) {
    if (!statusFilter) return orders;
    const key = normalizeStatusKey(statusFilter);
    return orders.filter((o) => {
      const dom = dominantDispatch(fulfilment(o.id).dispatches);
      return normalizeStatusKey(dom?.status || o.status) === key;
    });
  }

  // ── Allocation KPI: how much of the ordered quantity has been dispatched ─────────────────
  function allocation(order, dispatches) {
    if (!order.items.length) return { percentage: 0, status: 'none', label: 'No Items' };
    if (!dispatches.length) return { percentage: 0, status: 'pending', label: 'Not Dispatched' };
    const ordered = new Map(order.items.map((l) => [l.productId, l.qty]));
    const sent = new Map();
    for (const d of dispatches) for (const l of d.items) sent.set(l.productId, (sent.get(l.productId) || 0) + l.qty);
    let total = 0; let done = 0;
    for (const [id, q] of ordered) { total += q; done += Math.min(sent.get(id) || 0, q); }
    const percentage = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    if (percentage === 0) return { percentage, status: 'pending', label: 'Not Dispatched' };
    if (percentage < 100) return { percentage, status: 'partial', label: 'Partially Dispatched' };
    return { percentage, status: 'complete', label: 'Fully Dispatched' };
  }

  // ── Smart Insights: the production rules, thresholds, wording and three-item cap ─────────
  function insights(order, now = Date.now()) {
    const { dispatches, deliveries, returns } = fulfilment(order.id);
    const out = [];
    const money = (v) => `${currency}${MONEY_SPACE}${v.toFixed(0)}`;
    const orderAge = Math.floor((now - order.createdAt.getTime()) / DAY);
    const orderValue = listTotal(order) || 0;
    const itemCount = order.items.length;
    const totalQty = order.items.reduce((s, l) => s + (Number(l.qty) || 0), 0);
    const totalDispatches = dispatches.length;
    const totalDeliveries = deliveries.length;
    const totalReturns = returns.length;
    const sub = (x) => x.items.reduce((s, l) => s + l.qty * l.price, 0);

    const da = { pending: 0, ready: 0, inTransit: 0, delivered: 0, rejected: 0, qty: 0 };
    for (const d of dispatches) {
      const s = lc(d.status);
      da.qty += d.items.reduce((t, l) => t + (Number(l.qty) || 0), 0);
      if (s.includes('delivered') || s.includes('completed')) da.delivered += 1;
      else if (s.includes('rejected') || s.includes('cancelled')) da.rejected += 1;
      else if (s.includes('transit') || s.includes('shipped')) da.inTransit += 1;
      else if (s.includes('ready') || s.includes('packed')) da.ready += 1;
      else da.pending += 1;
    }
    const dv = { notStarted: 0, active: 0, completed: 0, total: 0, avg: 0 };
    for (const v of deliveries) {
      const p = v.progress || 0;
      dv.total += p;
      if (p >= 100) dv.completed += 1; else if (p > 0) dv.active += 1; else dv.notStarted += 1;
    }
    if (totalDeliveries > 0) dv.avg = Math.round(dv.total / totalDeliveries);
    const ra = { pending: 0, inTransit: 0, completed: 0, qty: 0, value: 0, rate: 0 };
    for (const r of returns) {
      const s = lc(r.status);
      ra.qty += r.items.reduce((t, l) => t + (Number(l.qty) || 0), 0);
      ra.value += sub(r);
      if (s.includes('completed') || s.includes('received')) ra.completed += 1;
      else if (s.includes('transit') || s.includes('pickup') || s.includes('returning')) ra.inTransit += 1;
      else ra.pending += 1;
    }
    if (totalQty > 0) ra.rate = Math.round((ra.qty / totalQty) * 100);
    const fulfilled = totalQty > 0 ? Math.round((da.qty / totalQty) * 100) : 0;

    if (lc(order.status) === 'cancelled') {
      out.push({ severity: 'info', title: 'Order Cancelled', message: `Cancelled ${orderAge}d ago. ${money(orderValue)} order archived.`, action: null });
      return out.slice(0, 3);
    }
    if (orderValue >= 5000 && totalDispatches === 0 && orderAge >= 2) {
      out.push({ severity: 'critical', title: '🔥 High-Value Order at Risk', message: `${money(orderValue)} order delayed ${orderAge}d. No dispatch created. Customer escalation risk.`, action: 'Prioritize & dispatch now' });
    }
    if (ra.rate >= 30 && totalReturns > 0) {
      out.push({ severity: 'critical', title: '⚠️ High Return Rate Alert', message: `${ra.rate}% items returned (${ra.qty}/${totalQty} units). Quality or accuracy issue suspected.`, action: 'Investigate root cause' });
    }
    if (da.rejected >= 2) {
      out.push({ severity: 'critical', title: '❌ Multiple Dispatch Failures', message: `${da.rejected} dispatches rejected. Fulfillment process breakdown.`, action: 'Review & create new dispatch' });
    }
    if (ra.pending > 0) {
      const refund = ra.value > 0 ? `~${money(ra.value)} refund pending` : '';
      out.push({ severity: 'high', title: 'Return Pickup Required', message: `${ra.pending} return${ra.pending > 1 ? 's' : ''} awaiting collection. ${refund}`, action: 'Schedule pickup' });
    }
    if (totalDispatches === 0) {
      if (orderAge >= 3) {
        out.push({ severity: 'high', title: 'Fulfillment Critically Delayed', message: `${orderAge}d old, ${itemCount} item${itemCount > 1 ? 's' : ''}, ${totalQty} units. Zero progress.`, action: 'Create dispatch urgently' });
      } else if (orderAge >= 1) {
        out.push({ severity: 'medium', title: 'Dispatch Allocation Pending', message: `${orderAge}d since order. ${itemCount} product${itemCount > 1 ? 's' : ''} (${totalQty} units) awaiting dispatch.`, action: 'Allocate inventory' });
      } else {
        out.push({ severity: 'normal', title: '🆕 Fresh Order Ready', message: `${itemCount} item${itemCount > 1 ? 's' : ''}, ${totalQty} units, ${money(orderValue)}. Ready for processing.`, action: 'Create dispatch' });
      }
      return out.slice(0, 3);
    }
    if (fulfilled > 0 && fulfilled < 100) {
      out.push({ severity: 'medium', title: 'Partial Fulfillment', message: `${fulfilled}% dispatched (${da.qty}/${totalQty} units). ${totalQty - da.qty} units pending.`, action: 'Complete remaining dispatch' });
    }
    if (da.rejected === 1) {
      out.push({ severity: 'high', title: 'Dispatch Rejected', message: `1 dispatch rejected. ${totalReturns > 0 ? 'Return initiated.' : 'Create return for rejected items.'}`, action: totalReturns === 0 ? 'Create return' : 'Monitor return' });
    }
    if (ra.inTransit > 0) {
      out.push({ severity: 'warning', title: 'Returns In Transit', message: `${ra.inTransit} return${ra.inTransit > 1 ? 's' : ''} being returned. ${ra.completed > 0 ? `${ra.completed} already received.` : ''}`, action: 'Track & verify receipt' });
    }
    const linked = new Set(deliveries.flatMap((v) => v.dispatchIds));
    const unassigned = dispatches.filter((d) => !linked.has(d.id)).length;
    if (unassigned > 0) {
      out.push({ severity: 'medium', title: 'Delivery Assignment Needed', message: `${unassigned} of ${totalDispatches} dispatch${unassigned > 1 ? 'es' : ''} not linked to delivery run.`, action: 'Create or assign to delivery' });
    }
    if (dv.active > 0) {
      const progressText = dv.avg > 0 ? `${dv.avg}% avg progress` : 'just started';
      out.push({ severity: 'normal', title: '🚚 Delivery In Progress', message: `${dv.active} active run${dv.active > 1 ? 's' : ''} (${progressText}). ${da.delivered}/${totalDispatches} dispatches delivered.`, action: 'Monitor delivery' });
    }
    if (da.ready > 0 && totalDeliveries === 0) {
      out.push({ severity: 'normal', title: 'Dispatches Ready for Delivery', message: `${da.ready} dispatch${da.ready > 1 ? 'es are' : ' is'} packed and ready. No delivery run created.`, action: 'Create delivery run' });
    }
    if (ra.completed > 0 && ra.pending === 0 && ra.inTransit === 0) {
      out.push({ severity: 'info', title: 'Returns Received', message: `${ra.completed} return${ra.completed > 1 ? 's' : ''} (${ra.qty} units) received. ${money(ra.value)} value.`, action: 'Process refund/exchange' });
    }
    if (dv.active > 0 && dv.avg > 0 && dv.avg < 100) {
      const perDay = dv.avg / Math.max(orderAge, 1);
      const days = Math.ceil((100 - dv.avg) / Math.max(perDay, 10));
      if (days <= 2) out.push({ severity: 'info', title: '📊 Completion Forecast', message: `Based on ${dv.avg}% progress, delivery likely complete in ~${days}d.`, action: null });
    }
    if (totalDispatches >= 3 && da.delivered > 0) {
      const eff = Math.round((da.delivered / totalDispatches) * 100);
      if (eff >= 50) out.push({ severity: 'info', title: '📦 Multi-Dispatch Order', message: `${totalDispatches} dispatches. ${eff}% delivered. ${da.inTransit > 0 ? `${da.inTransit} in transit.` : ''}`, action: null });
    }
    if (out.length === 0) {
      const parts = [];
      if (da.inTransit > 0) parts.push(`${da.inTransit} in transit`);
      if (da.ready > 0) parts.push(`${da.ready} ready`);
      if (da.pending > 0) parts.push(`${da.pending} pending`);
      out.push({ severity: 'normal', title: 'Order In Progress', message: `${totalDispatches} dispatch${totalDispatches > 1 ? 'es' : ''}, ${totalDeliveries} delivery${totalDeliveries > 1 ? ' runs' : ''}. ${parts.join(', ') || 'Monitoring'}.`, action: 'Continue monitoring' });
    }
    return out.slice(0, 3);
  }

  /** Everything one list row shows, derived. */
  function row(order) {
    const f = fulfilment(order.id);
    const c = customerOf(order);
    const dom = dominantDispatch(f.dispatches);
    const options = [order.status, ...nextStatusesOf(order.status)];
    return {
      order,
      id: order.id,
      number: order.number,
      createdAt: order.createdAt,
      customerName: toTitleCase(c.name),
      customerPhone: toTitleCase(c.phone),
      rawPhone: c.phone,
      total: formatMoney(currency, rowTotal(order)),
      amount: rowTotal(order).toFixed(2), // the number alone — the desktop cell prints symbol, space and number as separate text
      counts: f.counts,
      fulfilment: f,
      // Once dispatched, the order's own status is no longer shown: the dominant dispatch's is,
      // in a locked control ("Delivered (2)" when there are several).
      locked: dom ? { status: dom.status, label: f.dispatches.length > 1 ? `${toTitleCase(dom.status)} (${f.dispatches.length})` : toTitleCase(dom.status) } : null,
      statusOptions: options,
      statusDisabled: options.length <= 1 || !isAuditAllowed(order.status),
      mobileCanChangeStatus: !dom && options.length > 1 && isAuditAllowed(order.status),
      invoiceDisabled: !isInvoiceAllowed(order.status),
      editAllowed: editAllowed.includes(order.status) && f.counts.dispatches === 0,
      allocation: allocation(order, f.dispatches),
    };
  }

  // ── Prices as the audit shows them ─────────────────────────────────────────────────────
  // A unit price includes its tax and is rounded to paise BEFORE it is multiplied, so a line
  // total is always unit × qty exactly. Amounts print as "₹ 1,391.00" (Indian grouping).
  const roundPaise = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
  const unitPrice = (line) => roundPaise(line.price * (1 + (line.tax || 0) / 100));
  const formatCurrency = (v) => `${currency}${MONEY_SPACE}${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const roundedAmounts = appProp.amountConfiguration?.displayRoundedAmounts === true;

  /** Records an audited status change: the order moves, and the move joins its audit trail. */
  function applyStatusChange(orderId, newStatus, { received, comment, at = new Date(), by = tenant.username }) {
    const order = data.orderById.get(orderId);
    order.stageAudit = [...(order.stageAudit || []), {
      status: newStatus, from: order.status, comment: comment.trim(), by, created_date: at,
      challan: order.items.map((l) => ({ productId: l.productId, name: l.name, articleNo: l.articleNo, expectedQty: l.qty, verifiedQty: Number(received[l.productId] ?? l.qty) })),
    }];
    order.status = newStatus;
    return order;
  }

  // ── Creating an order ──────────────────────────────────────────────────────────────────
  // The customer's catalogue as production shows it: category → sub-category → products, in the
  // order the store lists its products. Every customer here buys the store's catalogue at list price.
  const catalogue = [];
  for (const p of data.products) {
    let cat = catalogue.find((c) => c.name === p.category);
    if (!cat) catalogue.push(cat = { id: `cat-${catalogue.length + 1}`, name: p.category, subs: [] });
    let sub = cat.subs.find((s) => s.name === p.subCategory);
    if (!sub) cat.subs.push(sub = { id: `sub-${catalogue.reduce((n, c) => n + c.subs.length, 1)}`, name: p.subCategory, products: [] });
    sub.products.push(p);
  }

  /**
   * What can still be promised of a product: its stock less what open orders have reserved —
   * orders in the workflow's stock-reservation statuses, net of what has already been dispatched
   * against them (production's stock summary).
   */
  function availableStock(product) {
    const reserving = workflow.stockReservationOnStatus || [];
    let reserved = 0;
    for (const o of data.orders) {
      if (!reserving.includes(o.status)) continue;
      const ordered = o.items.filter((l) => l.productId === product.id).reduce((s, l) => s + l.qty, 0);
      const sent = (dispatchesByOrder.get(o.id) || []).flatMap((d) => d.items).filter((l) => l.productId === product.id).reduce((s, l) => s + l.qty, 0);
      reserved += Math.max(0, ordered - sent);
    }
    return Math.max(0, product.stock - reserved);
  }

  /** The customer picker's pages: 8 customers a page, directory order, narrowed by name, phone or email. */
  const customerPage = (pages = 1, search = '') => {
    const q = String(search).trim().toLowerCase();
    const list = q ? data.customers.filter((c) => [c.name, c.phone, c.email].some((v) => String(v || '').toLowerCase().includes(q))) : data.customers;
    return { customers: list.slice(0, pages * 8), hasMore: list.length > pages * 8 };
  };

  // The order number is cafex's: the date and time parts unpadded, then a 1–100 random suffix.
  // The prototype's "server" draws that suffix from a seeded generator (mulberry32, the parity
  // oracle's seed), so the same session always numbers its orders the same way.
  let seed = 0x5a1e5;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let placed = 0;
  /** Places an order for a customer. It enters the workflow at its first status. */
  function placeOrder({ customerId, lines, comment = '', at = new Date() }) {
    const parts = [at.getMonth() + 1, at.getDate(), at.getHours(), at.getMinutes(), at.getSeconds()];
    const order = {
      id: `ord-new-${++placed}`,
      number: `${at.getFullYear()}${parts.join('')}${Math.floor(random() * 100 + 1)}`,
      createdAt: at, customerId,
      status: statusWorkflow('ORDER')[0]?.status || 'Pending',
      paymentMethod: 'COD', shippingCost: 0, discount: 0, comment,
      items: lines.map(({ product, qty, price }) => ({ productId: product.id, articleNo: product.articleNo, name: product.name, unit: product.unit, tax: product.tax, price: price ?? product.price, qty })),
    };
    data.orders.push(order);
    data.orderById.set(order.id, order);
    return order;
  }

  // ── Follow-up reminders ────────────────────────────────────────────────────────────────
  // One catalogue per customer type: wholesale buyers are Premium, everyone else Standard.
  const catalogues = [{ id: 'ctl-standard', name: 'Standard' }, { id: 'ctl-premium', name: 'Premium' }];
  const catalogueOf = (customer) => (customer.type === 'WHOLESALER' ? catalogues[1] : catalogues[0]);

  /** The IST calendar days a window covers: today, yesterday, or Sunday-to-today. */
  function followUpRange(window, now) {
    const n = new Date(now);
    const today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    let start = today;
    let end = today;
    if (window === 'yesterday') start = end = new Date(today.getTime() - DAY);
    if (window === 'thisWeek') { start = new Date(today); start.setDate(today.getDate() - today.getDay()); }
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { from: istDayStart(ymd(start)), to: istDayEnd(ymd(end)) };
  }

  /**
   * Customers to follow up: every customer of the store who placed no order in the window, then
   * narrowed by catalogue and by a search on name, phone or email (any case). Directory order,
   * paged by 20.
   */
  function followUp({ window = 'today', search = '', catalogue = 'all', pages = 1, now = Date.now() } = {}) {
    const { from, to } = followUpRange(window, now);
    const ordered = new Set(data.orders.filter((o) => o.createdAt >= from && o.createdAt <= to).map((o) => o.customerId));
    const q = search.trim().toLowerCase();
    const list = data.customers
      .filter((c) => !ordered.has(c.id))
      .filter((c) => catalogue === 'all' || catalogueOf(c).id === catalogue)
      .filter((c) => !q || [c.name, c.phone, c.email].some((v) => String(v || '').toLowerCase().includes(q)));
    return { customers: list.slice(0, pages * 20), total: list.length };
  }

  // ── Create Delivery ────────────────────────────────────────────────────────────────────
  /**
   * Orders a delivery can be made from: placed since the start of the UTC day `days - 1` days
   * ago, with no dispatch yet — in ANY status (a cancelled order is offered too, as production
   * offers it), newest first.
   */
  function dispatchEligible(days, now = Date.now()) {
    const n = new Date(now);
    const cutoff = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() - days + 1);
    return data.orders
      .filter((o) => o.createdAt.getTime() >= cutoff && !(dispatchesByOrder.get(o.id) || []).length)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Turns orders into a route delivery, as production does: each order walks to the ORDER
   * workflow's last status; each customer gets ONE dispatch (its orders' items together) at the
   * DISPATCH start status; one delivery covers them all, walked to the DELIVERY workflow's end.
   */
  function createDelivery({ orderIds, staffIds = [], name, at = new Date() }) {
    const orders = orderIds.map((id) => data.orderById.get(id)).filter(Boolean);
    const byCustomer = new Map();
    for (const o of orders) { if (!byCustomer.has(o.customerId)) byCustomer.set(o.customerId, []); byCustomer.get(o.customerId).push(o); }
    const orderFlow = statusWorkflow('ORDER');
    const delivery = {
      id: `dlv-new-${data.deliveries.length + 1}`, number: `DLV-${String(data.deliveries.length + 1).padStart(4, '0')}`,
      dispatchIds: [], status: statusWorkflow('DELIVERY').at(-1)?.status, progress: 0, staffIds, name,
    };
    for (const list of byCustomer.values()) {
      const d = {
        id: `dsp-new-${data.dispatches.length + 1}`, orderId: list[0].id, orderIds: list.map((o) => o.id),
        number: `${list[0].number}-D1`, status: statusWorkflow('DISPATCH')[0]?.status, createdAt: at,
        items: list.flatMap((o) => o.items), index: data.dispatches.length,
      };
      data.dispatches.push(d);
      for (const o of list) {
        o.status = orderFlow.at(-1)?.status ?? o.status;
        if (!dispatchesByOrder.has(o.id)) dispatchesByOrder.set(o.id, []);
        dispatchesByOrder.get(o.id).push(d);
      }
      delivery.dispatchIds.push(d.id);
      deliveriesByDispatch.set(d.id, [delivery]);
    }
    data.deliveries.push(delivery);
    return { customerCount: byCustomer.size };
  }

  // ── Download All (tenant flag) ─────────────────────────────────────────────────────────
  /**
   * The CSV production exports: every order the current filters find, then the page's own status
   * pass. Built from the list rows, which carry no discount, shipping or payment method — so the
   * file shows 0.00 / 0.00 / "NA" and a total that is the undiscounted subtotal (₹ 574.50 for an
   * order of ₹ 549). Reproduced as production writes it.
   */
  function exportCsv(filters) {
    const orders = visibleOnPage(listOrders({ ...filters, page: 1, limit: Infinity }).orders, filters.status);
    const cell = (v) => { const t = String(v ?? ''); return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const rows = orders.map((o) => {
      const gross = listTotal(o).toFixed(2);
      const at = o.createdAt.toISOString();
      return [o.id, o.number, gross, '0.00', '0.00', gross, 'NA', o.status, customerOf(o).name, at, at];
    });
    return [['_id', 'invoice', 'subTotal', 'shippingCost', 'discount', 'total', 'paymentMethod', 'status', 'user_info', 'createdAt', 'updatedAt'], ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  }

  // ── Order Forecast (the module's demand engine, orderForecast.ts) ───────────────────────
  // What a store is likely to reorder, how much and when: its OWN history when there are ≥ 3
  // orders of a product, else its org's, else a store-wide average with no cadence (never "due").
  // Pending, cancelled and draft orders are not demand.
  const FORECAST_EXCLUDED = ['Draft', 'Draft Stock requested', 'Cancelled', 'void', 'Pending'];
  const demandOrders = () => data.orders.filter((o) => !FORECAST_EXCLUDED.includes(o.status));
  const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /** Stores with order history: most orders first, then most recent, then id. Paged by 20. */
  function forecastCustomers({ search = '', page = 1, limit = 20 } = {}) {
    const by = new Map();
    for (const o of demandOrders()) {
      const cur = by.get(o.customerId) || { orderCount: 0, lastOrderDate: null };
      cur.orderCount += 1;
      if (!cur.lastOrderDate || o.createdAt > cur.lastOrderDate) cur.lastOrderDate = o.createdAt;
      by.set(o.customerId, cur);
    }
    let rows = [...by.entries()].map(([id, v]) => ({ buyerLocationId: id, name: data.customerById.get(id)?.name ?? 'Unknown store', ...v }));
    if (search.trim()) { const re = new RegExp(escapeRe(search.trim()), 'i'); rows = rows.filter((r) => re.test(r.name)); }
    rows.sort((a, b) => b.orderCount - a.orderCount || b.lastOrderDate - a.lastOrderDate || (a.buyerLocationId < b.buyerLocationId ? -1 : a.buyerLocationId > b.buyerLocationId ? 1 : 0));
    return { data: rows.slice((page - 1) * limit, page * limit), total: rows.length };
  }

  /** One point per product per order (split lines summed), oldest first; the latest line names it. */
  function articleSeries(orders, only = null) {
    const points = new Map();
    for (const o of orders) for (const l of o.items) {
      if (only && !only.includes(l.articleNo)) continue;
      if (!(l.qty > 0)) continue;
      const key = `${l.articleNo}::${o.id}`;
      const p = points.get(key);
      if (p) p.qty += l.qty; else points.set(key, { art: l.articleNo, qty: l.qty, date: o.createdAt, name: l.name, unit: l.unit, productId: l.productId });
    }
    const rows = [...points.values()].sort((a, b) => a.date - b.date);
    const series = new Map();
    for (const r of rows) {
      let s = series.get(r.art);
      if (!s) series.set(r.art, s = { art: r.art, orders: [] });
      s.orders.push({ qty: r.qty, date: r.date });
      Object.assign(s, { name: r.name, unit: r.unit, productId: r.productId });
    }
    return [...series.values()];
  }
  const median = (n) => { if (!n.length) return null; const s = [...n].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const anomalyFilter = (o) => {
    if (o.length < 2) return o;
    const q = o.map((x) => x.qty); const mean = q.reduce((a, b) => a + b, 0) / q.length;
    const std = Math.sqrt(q.reduce((a, b) => a + (b - mean) ** 2, 0) / q.length);
    const kept = o.filter((x) => x.qty <= mean + 2 * std); return kept.length ? kept : o;
  };
  const lastNAvg = (o, n = 5) => { const l = o.slice(-n).map((x) => x.qty); return l.reduce((a, b) => a + b, 0) / l.length; };
  const medianInterval = (o) => { const g = []; for (let i = 1; i < o.length; i++) { const d = Math.round((o[i].date - o[i - 1].date) / DAY); if (d > 0) g.push(d); } return median(g); };

  /** A store's reorder forecast, as of `now`. */
  function forecast(customerId, now = Date.now()) {
    const today = new Date(now);
    const store = articleSeries(demandOrders().filter((o) => o.customerId === customerId));
    const empty = { skusConsidered: 0, recommended: 0, dueNow: 0, upcoming: 0, lapsed: 0 };
    if (!store.length) return { totals: empty, recommendations: [] };
    const cold = store.filter((s) => s.orders.length < 3).map((s) => s.art);
    const orgMap = {};
    // Each store here is its org's only location, so the org's history is the store's own.
    if (cold.length) for (const s of articleSeries(demandOrders().filter((o) => o.customerId === customerId), cold)) { const k = anomalyFilter(s.orders); orgMap[s.art] = { qty: lastNAvg(k), interval: medianInterval(k), n: s.orders.length }; }
    const stillCold = cold.filter((a) => !(orgMap[a] && orgMap[a].n >= 3));
    const globalMap = {};
    if (stillCold.length) {
      const sums = {};
      for (const o of demandOrders()) for (const l of o.items) { if (!stillCold.includes(l.articleNo) || !(l.qty > 0)) continue; const a = sums[l.articleNo] || (sums[l.articleNo] = { total: 0, n: 0 }); a.total += l.qty; a.n += 1; }
      for (const [art, v] of Object.entries(sums)) globalMap[art] = { avgQty: v.total / v.n };
    }
    const recs = [];
    for (const s of store) {
      const last = s.orders[s.orders.length - 1].date;
      const daysSinceLast = Math.round((today - last) / DAY);
      let qty; let interval; let tier;
      if (s.orders.length >= 3) { const k = anomalyFilter(s.orders); qty = lastNAvg(k); interval = medianInterval(k); tier = 'high'; }
      else if (orgMap[s.art] && orgMap[s.art].n >= 3) { ({ qty, interval } = orgMap[s.art]); tier = 'medium'; }
      else if (globalMap[s.art]) { qty = globalMap[s.art].avgQty; interval = null; tier = 'low'; }
      else continue;
      const lapsed = daysSinceLast > (interval != null ? Math.max(60, 3 * interval) : 270);
      const dueNow = !lapsed && interval != null && daysSinceLast >= interval;
      const predictedQty = Math.round(qty * 100) / 100;
      recs.push({
        articleNumber: s.art, name: s.name || null, unit: s.unit || null, productId: s.productId || null, ordersCount: s.orders.length,
        predictedQty, recommendedQty: dueNow ? predictedQty : 0, status: lapsed ? 'lapsed' : dueNow ? 'due' : 'upcoming',
        intervalDays: interval, daysSinceLast, daysUntilDue: interval != null ? interval - daysSinceLast : null, confidenceTier: tier,
      });
    }
    const rank = { due: 0, upcoming: 1, lapsed: 2 };
    recs.sort((a, b) => {
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      const tie = () => String(a.articleNumber).localeCompare(String(b.articleNumber));
      if (a.status === 'due') return ((b.daysSinceLast - (b.intervalDays || 0)) - (a.daysSinceLast - (a.intervalDays || 0))) || tie();
      if (a.status === 'upcoming') { const av = a.daysUntilDue ?? Infinity; const bv = b.daysUntilDue ?? Infinity; return (av === bv ? 0 : av - bv) || tie(); }
      return (a.daysSinceLast - b.daysSinceLast) || tie();
    });
    const count = (st) => recs.filter((r) => r.status === st).length;
    return { totals: { skusConsidered: store.length, recommended: recs.length, dueNow: count('due'), upcoming: count('upcoming'), lapsed: count('lapsed') }, recommendations: recs };
  }

  return {
    tenant, data, currency, label, features, workflow, appProp,
    dispatchEligible, createDelivery, forecastCustomers, forecast,
    exportCsv,
    dispatchesOf: (orderId) => dispatchesByOrder.get(orderId) || [],
    catalogues, catalogueOf, followUp, pinFulfilment,
    catalogue, availableStock, customerPage, placeOrder, roundPaise,
    unitPrice, formatCurrency, roundedAmounts, applyStatusChange,
    statusWorkflow, statusFilterOptions, nextStatusesOf, isAuditAllowed, isInvoiceAllowed,
    listOrders, visibleOnPage, fulfilment, row, insights, allocation, rowTotal, customerOf,
  };
}

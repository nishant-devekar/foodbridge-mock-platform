/*
  Vasu Foods (29 Sep 2026): in the mock platform Sales Orders shows the business's ONE record — the
  production store (v7/assets/production/production-api.js) — instead of the invented dataset.json.

    read    customers (commission agents at the Anaj Mandi, distributors, shops, dhabas), Vasu's
            packs at their price for each customer, orders, dispatches, van trips and returns,
            in this screen's dataset shape — so every view and flow runs unchanged
    write   an order placed here is placed in the store under the same number (Production Plan
            and the purchase forecast see it at once); a status change moves it there; Create
            Delivery sends what Finished Goods can give — a dispatch with its tax invoice per
            order, on one van trip

  ?data=fixture opens the module on dataset.json, as the parity harness does.
*/
const STORE_SRC = '../../assets/production/production-api.js?v=20261003FL1';
const MIN = 60000;

export function loadStore() {
  if (window.FB_PRODUCTION) return Promise.resolve(window.FB_PRODUCTION);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = new URL(STORE_SRC, location.href).href;
    s.onload = () => (window.FB_PRODUCTION ? resolve(window.FB_PRODUCTION) : reject(new Error('The business store did not load')));
    s.onerror = () => reject(new Error('The business store did not load'));
    document.head.appendChild(s);
  });
}

/* the platform's customer kinds, as this screen knows them */
const TYPE = { COMMISSION_AGENT: 'WHOLESALER', DISTRIBUTOR: 'WHOLESALER', RETAILER: 'RETAILER', HORECA: 'HORECA', CONSUMER: 'RETAILER' };

export function vasuDataset(P, now) {
  return P.read((D, d) => {
    const biz = d.business;
    const ago = (iso) => Math.max(0, Math.round((now - new Date(iso).getTime()) / MIN));
    const groups = {};
    d.customers.forEach((c) => { const k = `crg-${c.creditDays}`; groups[k] = groups[k] || { id: k, name: c.creditDays ? `${c.creditDays}-day credit` : 'Cash on delivery', creditLimit: c.creditDays >= 21 ? 300000 : c.creditDays >= 15 ? 150000 : c.creditDays ? 25000 : 0, creditDays: c.creditDays }; });
    const orderById = Object.fromEntries(d.orders.map((o) => [o.id, o]));
    return {
      _about: ['Built from the Vasu Foods store (v7/assets/production/production-api.js) when the page opened.'],
      seller: { storeName: biz.name, admin: { name: biz.owner, role: biz.role } },
      creditGroups: Object.values(groups),
      customers: d.customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: '', type: TYPE[c.type] || 'RETAILER', kind: d.customerTypes[c.type], area: c.city, address: `${c.address}`, creditGroupId: `crg-${c.creditDays}`, person: c.person })),
      products: d.skus.filter((s) => !s.retired).map((s) => ({ id: s.id, articleNo: s.article, name: s.name, category: D.book(s.recipeId).category || 'Frozen Vegetables', subCategory: D.book(s.recipeId).name, price: s.price, unit: 'Pkt', tax: biz.gstPct, stock: D.availableToSell(s.id), brand: s.brand })),
      staff: d.team.filter((t) => t.role === 'DRIVER').map((t) => ({ id: t.id, name: t.name, phone: t.phone, role: 'DRIVER', vehicle: t.vehicle })),
      routeTemplates: d.routes.map((r) => ({ id: r.id, name: r.name, customerIds: d.customers.filter((c) => c.routeId === r.id).map((c) => c.id), staffIds: [r.staffId] })),
      orders: d.orders.slice().sort((a, b) => (a.placedAt < b.placedAt ? -1 : 1)).map((o) => ({
        id: o.id, number: o.number, placedMinutesAgo: ago(o.placedAt), customerId: o.customerId, status: o.status, paymentMethod: o.paymentMethod === 'online' ? 'payOnline' : 'pod',
        shippingCost: o.shippingCost || 0, discount: o.discount || 0, comment: o.comment || '', items: o.items.map((i) => ({ productId: i.skuId, qty: i.qty, price: i.price })),
      })),
      dispatches: d.dispatches.filter((x) => orderById[x.orderId]).map((x) => ({
        id: x.id, orderId: x.orderId, status: x.status, minutesAfterOrder: Math.max(0, Math.round((new Date(x.at) - new Date(orderById[x.orderId].placedAt)) / MIN)),
        items: x.items.map((i) => ({ productId: i.skuId, qty: i.qty, price: i.price })), invoice: x.invoice && x.invoice.no,
      })),
      deliveries: d.deliveries.map((v) => {
        const done = v.dispatchIds.filter((id) => (D.dispatchById(id) || {}).status === 'Delivered').length;
        return { id: v.id, dispatchIds: v.dispatchIds.slice(), status: v.status, progress: Math.round(done / Math.max(1, v.dispatchIds.length) * 100), staffId: v.staffId };
      }),
      returns: d.returns.map((r) => ({ id: r.id, dispatchId: r.dispatchId, status: r.status, items: r.items.map((i) => ({ productId: i.skuId, qty: i.qty })) })),
    };
  });
}

/** What the screen writes, written to the store as well. */
export function wireToStore(model, P, notify) {
  const safely = (what, fn) => { try { return fn(); } catch (e) { console.error(`Vasu store: ${what}`, e); notify?.('error', e?.body?.error || e.message); return null; } };
  const place = model.placeOrder;
  model.placeOrder = (args) => {
    const o = place(args);
    safely('placeOrder', () => P.write((D) => D.placeOrder({ customerId: o.customerId, number: o.number, at: o.createdAt.toISOString(), comment: o.comment, by: 'Chanchal Sachdeva', via: 'office', where: 'Sales Orders',
      items: o.items.map((i) => ({ skuId: i.productId, qty: i.qty, price: i.price })) })));
    return o;
  };
  const move = model.applyStatusChange;
  model.applyStatusChange = (orderId, newStatus, opts) => {
    const o = move(orderId, newStatus, opts);
    safely('status', () => P.write((D) => { const so = D.order(o.number); if (so && so.status !== newStatus) D.setOrderStatus(so.id, newStatus, 'Chanchal Sachdeva', opts && opts.comment); }));
    return o;
  };
  const deliver = model.createDelivery;
  model.createDelivery = (args) => {
    const numbers = (args.orderIds || []).map((id) => model.data.orderById.get(id)?.number).filter(Boolean);
    const out = deliver(args);
    safely('delivery', () => P.write((D) => {
      const sent = [];
      numbers.forEach((n) => { const so = D.order(n); if (!so || !D.isOpen(so)) return; try { sent.push(D.dispatch(so.id, { by: 'Chanchal Sachdeva', where: 'Sales Orders' })); } catch (e) { /* nothing in Finished Goods for it yet */ } });
      if (!sent.length) throw new Error('Nothing in Finished Goods to send yet — the orders stay open');
      const v = D.createDelivery({ dispatchIds: sent.map((x) => x.id), staffId: (args.staffIds || [])[0], by: 'Chanchal Sachdeva' });
      D.setDeliveryStatus(v.id, 'Vehicle Loading Completed', 'Mohan Lal');
      D.setDeliveryStatus(v.id, 'Out for Delivery', (D.staff(v.staffId) || {}).name);
      return v;
    }));
    return out;
  };
}

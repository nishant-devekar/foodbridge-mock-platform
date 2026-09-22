/* ==========================================================================
   CONTROL TOWER · TOWER — one pass of the loop, shared by the screen and the
   tests so neither re-implements it:

     records (+ what actions wrote) → CTState → CTSignals.detect
       → CTStore.reconcile (lifecycle, audit) → view model

   `readRaw()` supplies the records (FBContext in the page, the fixture in the
   tests). Everything actions write is read back from the store on the next
   pass -- orders, purchase requests, reminders -- which is how an action's
   outcome reaches the signal that asked for it.
   ========================================================================== */

(function (root) {
  "use strict";

  function create(opts) {
    const Signals = opts.signals || root.CTSignals;
    const State = opts.state || root.CTState;
    const store = opts.store;
    const clock = opts.clock || function () { return Date.now(); };
    let last = null;

    /* Which business these records are: the export, or the session's
       Dataset by its source and organisation. */
    function scopeOf(raw) {
      const dr = raw && raw.dataReady;
      if (!dr || !dr.dataset) return "export";
      const p = dr.provenance || {};
      return (p.kind || "files") + ":" + ((p.org && p.org.id) || p.label || "records");
    }

    function pass() {
      const raw = opts.readRaw();
      if (store.setScope) store.setScope(scopeOf(raw));
      const rec = store.read();
      const st = State.build(Object.assign({}, raw, {
        now: clock(),
        createdOrders: rec.orders,
        purchaseRequests: rec.purchaseRequests,
        outbox: rec.outbox,
      }));
      applyOwnEntries(st, rec);
      const d = Signals.detect(st);
      const rc = store.reconcile(d.signals);
      last = {
        state: st,
        signals: rc.visible,
        all: rc.all,
        dismissed: rc.dismissed,
        resolved: rc.resolved,
        errors: d.errors,
        pulse: Signals.pulse(st, d),
        now: Signals.businessNow(st, d),
        trend: Signals.trend(st),
        freshness: Signals.freshness(st),
        unavailable: Signals.unavailable(st),
        audit: store.read().audit,
        records: store.read(),
      };
      return last;
    }

    /* What the owner recorded in FoodBridge counts on the next pass: a
       stock count replaces the imported figure for that product, and money
       received pays the customer's oldest open invoices first -- except
       cash marked forDrop, taken at the door for that day's delivery, which
       counts as collected but leaves the old invoices as they were. Copies
       only; the imported records are never changed. */
    function applyOwnEntries(st, rec) {
      const latest = {};
      (rec.stockCounts || []).forEach(function (c) { if (!latest[c.productId] || c.at >= latest[c.productId].at) latest[c.productId] = c; });
      st.products.forEach(function (p) {
        if (latest[p.id]) { p.stock = Number(latest[p.id].qty) || 0; p.countedAt = latest[p.id].at; }
      });
      const l = st.ledger;
      if (!l || !l.invoices || !(rec.payments || []).length) return;
      l.invoices = l.invoices.map(function (i) { return Object.assign({}, i); });
      l.payments = (l.payments || []).slice();
      (rec.payments || []).forEach(function (p) {
        let left = Number(p.amount) || 0;
        /* How late the oldest invoice this payment cleared was: a payment that
           brings in long-stuck money is the best news Collections has. */
        let late = 0;
        const paidOn = new Date(p.at.slice(0, 10) + "T00:00:00Z").getTime();
        if (!p.forDrop) l.invoices.filter(function (i) { return i.customerId === p.customerId && i.balance > 0; })
          .sort(function (a, b) { return (a.dueDate || a.date) < (b.dueDate || b.date) ? -1 : 1; })
          .forEach(function (i) {
            if (left <= 0) return;
            const take = Math.min(left, i.balance); i.balance -= take; left -= take;
            if (i.dueDate) late = Math.max(late, Math.round((paidOn - new Date(i.dueDate + "T00:00:00Z").getTime()) / 86400000));
          });
        l.payments.push({ id: p.no, customerId: p.customerId, date: p.at.slice(0, 10), amount: Number(p.amount) || 0, mode: p.mode, own: true, late: late });
      });
    }

    const actions = root.CTActions.create({
      store: store, signals: Signals,
      getState: function () { return pass(); },
      business: opts.business,
    });

    return { pass: pass, last: function () { return last; }, actions: actions, store: store };
  }

  const API = { create: create };
  root.CTTower = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

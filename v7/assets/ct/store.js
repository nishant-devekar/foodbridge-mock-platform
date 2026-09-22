/* ==========================================================================
   CONTROL TOWER · STORE — lifecycle, audit, and the records actions write.

   What lives here, and why nothing existing held it:

     fb.v7.ct.lifecycle          each signal's state: new → acknowledged →
                                 in_progress → resolved, or dismissed (with a
                                 reason). Keyed by the signal's stable id.
     fb.v7.ct.audit              every meaningful event: who (the owner or
                                 FoodBridge), what, before → after, when,
                                 why, approval, outcome. Append-only.
     fb.v7.ct.purchaseRequests   PR-0001… raised from a signal. This tenant has
                                 no purchase-order store; the requests are read
                                 back by the engine as stock on order.
     fb.v7.ct.outbox             reminders prepared and approved. No sender is
                                 connected in this build; they wait here.
     fb.v7.ct.followups          call lists.
     fb.v7.ct.support            human handovers, with their context packaged.
     fb.v7.ct.deliveries         each delivery recorded at the door (22 Sep
                                 2026): delivered, missed with a reason,
                                 returned, money and empties collected, the
                                 next order taken. Fills the Deliveries lever.
     fb.v7.ct.payments           money received, recorded in FoodBridge. Read
                                 back as payments against the oldest invoices.
     fb.v7.ct.stockCounts        stock counted in FoodBridge. The latest count
                                 per product replaces the imported figure.
     fb.v7.ct.holds              customers whose supply is held (Fire).
     fb.v7.ct.route              today's planned delivery stops (the demo
                                 business's route; demo.js plans it daily).

   And one it does NOT own: orders go to fb.v7.orders, the store onboarding's
   Create Order already writes and Order Drafts reads, in that same shape.

   Storage is injected (localStorage in the page, a Map in the tests), so a
   write that fails -- a full or blocked store -- surfaces as an error the
   action reports, never as a silent success.
   ========================================================================== */

(function (root) {
  "use strict";

  const K = {
    lifecycle: "fb.v7.ct.lifecycle",
    audit: "fb.v7.ct.audit",
    purchaseRequests: "fb.v7.ct.purchaseRequests",
    outbox: "fb.v7.ct.outbox",
    followups: "fb.v7.ct.followups",
    support: "fb.v7.ct.support",
    deliveries: "fb.v7.ct.deliveries",
    payments: "fb.v7.ct.payments",
    stockCounts: "fb.v7.ct.stockCounts",
    holds: "fb.v7.ct.holds",
    route: "fb.v7.ct.route",
    orders: "fb.v7.orders",
  };
  const AUDIT_CAP = 500;
  const SEV_RANK = { opportunity: 0, medium: 1, high: 2, critical: 3 };

  function StoreError(message, cause) {
    const e = new Error(message); e.name = "StoreError"; e.code = "storage"; e.cause = cause; return e;
  }

  /* An in-memory stand-in with the localStorage shape, for tests. */
  function memory() {
    const m = new Map();
    return {
      getItem: function (k) { return m.has(k) ? m.get(k) : null; },
      setItem: function (k, v) { m.set(k, String(v)); },
      removeItem: function (k) { m.delete(k); },
      _map: m,
    };
  }

  /* Records belong to ONE business. Two tabs can hold two businesses -- the
     imported Dataset lives in each tab's sessionStorage -- and sharing one
     lifecycle between them made each tab resolve what the other detected,
     every write a storage event in the other, forever. The demonstration
     export keeps the plain keys; any other business gets its own. Orders are
     not scoped: they are filtered by the customers each business has. */
  function scoped(k, scope) {
    return !scope || scope === "export" || k === K.orders ? k : k.replace("fb.v7.ct.", "fb.v7.ct." + scope + ".");
  }

  function create(storage, clock) {
    const S0 = storage;
    let scope = "export";
    const S = {
      getItem: function (k) { return S0.getItem(scoped(k, scope)); },
      setItem: function (k, v) { return S0.setItem(scoped(k, scope), v); },
      removeItem: function (k) { return S0.removeItem(scoped(k, scope)); },
    };
    const now = clock || function () { return Date.now(); };
    const isoNow = function () { return new Date(now()).toISOString(); };

    function get(k, dflt) {
      try { const v = S.getItem(k); return v ? JSON.parse(v) : dflt; } catch (e) { return dflt; }
    }
    function put(k, v) {
      try { S.setItem(k, JSON.stringify(v)); } catch (e) { throw StoreError("This device could not save the change (" + (e && e.name || "storage") + ").", e); }
    }
    function nextNo(list, prefix) {
      const n = list.reduce(function (m, x) { const k = parseInt(String(x.no || x.id || "").replace(/\D/g, ""), 10); return isNaN(k) ? m : Math.max(m, k); }, 0);
      return prefix + String(n + 1).padStart(4, "0");
    }

    /* ── audit ────────────────────────────────────────────────────────── */
    function audit(entry) {
      const log = get(K.audit, []);
      const e = Object.assign({ id: "A" + (log.length ? (parseInt(log[log.length - 1].id.slice(1), 10) + 1) : 1),
                                at: isoNow(), actor: "owner" }, entry);
      log.push(e);
      put(K.audit, log.slice(-AUDIT_CAP));
      return e;
    }

    /* ── lifecycle ────────────────────────────────────────────────────── */
    function lifecycle() { return get(K.lifecycle, {}); }

    function transition(id, status, extra, auditEntry) {
      const lc = lifecycle();
      const before = lc[id] ? lc[id].status : null;
      const rec = Object.assign({}, lc[id] || { firstSeenAt: isoNow() }, extra || {}, { status: status, changedAt: isoNow() });
      lc[id] = rec;
      put(K.lifecycle, lc);
      if (auditEntry !== false) {
        audit(Object.assign({ kind: "signal", signalId: id, action: status, before: before, after: status }, auditEntry || {}));
      }
      return rec;
    }

    /* Signals in, signals out -- each carrying its status -- and the store
       brought up to date with what the engine now sees:
         · a new id is recorded as detected
         · a dismissed signal stays hidden unless it has materially changed:
           new members, higher severity, or it has become critical. Dismissing
           one instance never silences a critical risk for good.
         · a resolved signal that comes back is "recurred", not quietly new
         · a signal the engine has moved to monitoring is in progress
         · anything active that the engine no longer finds is RESOLVED -- the
           outcome observed, recorded. */
    function reconcile(signals) {
      const lc = lifecycle();
      const seen = {};
      const out = [];
      const events = [];
      let dirty = false;
      signals.forEach(function (s) {
        seen[s.id] = true;
        let rec = lc[s.id];
        if (!rec) {
          rec = lc[s.id] = { status: "new", firstSeenAt: isoNow(), changedAt: isoNow(), fingerprint: s.fingerprint, severity: s.severity };
          events.push({ kind: "signal", signalId: s.id, action: "detected", before: null, after: "new",
                        reason: s.title, actor: "FoodBridge", outcome: s.impact && s.impact.description });
          dirty = true;
        } else if (rec.status === "dismissed") {
          const escalated = SEV_RANK[s.severity] > SEV_RANK[rec.severity || "opportunity"] || s.severity === "critical" && rec.severity !== "critical";
          const changed = rec.fingerprint !== s.fingerprint && hasNewMembers(rec.members, s.members);
          if (escalated || changed) {
            events.push({ kind: "signal", signalId: s.id, action: "reopened", before: "dismissed", after: "new", actor: "FoodBridge",
                          reason: escalated ? "It became " + s.severity + " after it was dismissed." : "New items since it was dismissed." });
            rec = lc[s.id] = Object.assign(rec, { status: "new", changedAt: isoNow(), reopened: true });
            dirty = true;
          }
        } else if (rec.status === "resolved") {
          events.push({ kind: "signal", signalId: s.id, action: "recurred", before: "resolved", after: "new", actor: "FoodBridge", reason: s.title });
          rec = lc[s.id] = Object.assign(rec, { status: "new", changedAt: isoNow(), recurred: true });
          dirty = true;
        }
        /* Something new joined a signal already being handled: it needs the
           owner again. The earlier action does not cover what it never saw. */
        if ((rec.status === "in_progress" || rec.status === "acknowledged") && s.phase !== "monitoring" &&
            rec.members && hasNewMembers(rec.members, s.members)) {
          events.push({ kind: "signal", signalId: s.id, action: "reopened", before: rec.status, after: "new", actor: "FoodBridge",
                        reason: "New items since it was last handled." });
          rec.status = "new"; rec.changedAt = isoNow(); rec.note = null; dirty = true;
        }
        if (s.phase === "monitoring" && rec.status !== "in_progress" && rec.status !== "dismissed") {
          events.push({ kind: "signal", signalId: s.id, action: "in_progress", before: rec.status, after: "in_progress",
                        actor: "FoodBridge", reason: s.summary });
          rec.status = "in_progress"; rec.changedAt = isoNow(); dirty = true;
        }
        if (rec.fingerprint !== s.fingerprint && rec.status !== "dismissed") { rec.fingerprint = s.fingerprint; rec.members = s.members; dirty = true; }
        if (rec.status !== "dismissed") { rec.severity = s.severity; rec.members = s.members; }
        out.push(Object.assign({}, s, { status: rec.status, firstSeenAt: rec.firstSeenAt, changedAt: rec.changedAt,
                                        note: rec.note || null, dismissReason: rec.reason || null }));
      });
      Object.keys(lc).forEach(function (id) {
        const rec = lc[id];
        if (seen[id] || rec.status === "resolved" || rec.status === "dismissed") return;
        events.push({ kind: "signal", signalId: id, action: "resolved", before: rec.status, after: "resolved", actor: "FoodBridge",
                      reason: "No longer detected in your records.", outcome: "Resolved" });
        rec.status = "resolved"; rec.changedAt = isoNow(); rec.resolvedAt = isoNow(); dirty = true;
      });
      if (dirty) { put(K.lifecycle, lc); events.forEach(audit); }
      return { all: out, visible: out.filter(function (s) { return s.status !== "dismissed"; }),
               dismissed: out.filter(function (s) { return s.status === "dismissed"; }),
               resolved: Object.keys(lc).filter(function (id) { return lc[id].status === "resolved"; })
                 .map(function (id) { return Object.assign({ id: id }, lc[id]); }) };
    }
    function hasNewMembers(before, after) {
      const b = {}; (before || []).forEach(function (m) { b[m] = 1; });
      return (after || []).some(function (m) { return !b[m]; });
    }

    function acknowledge(id) {
      const lc = lifecycle();
      if (lc[id] && lc[id].status !== "new") return lc[id];
      return transition(id, "acknowledged", null, { reason: "Opened by the owner" });
    }
    function dismiss(id, reason, note, sig) {
      return transition(id, "dismissed", { reason: reason || "No reason given", note: note || null,
                                           fingerprint: sig && sig.fingerprint, severity: sig && sig.severity, members: sig && sig.members },
                        { reason: reason || "No reason given", note: note || null });
    }
    function inProgress(id, note, auditEntry) { return transition(id, "in_progress", { note: note }, auditEntry); }
    function restore(id) { return transition(id, "new", { note: null, reason: null }, { reason: "Shown again by the owner" }); }

    /* ── records actions write ────────────────────────────────────────── */
    function addPurchaseRequest(pr) {
      const list = get(K.purchaseRequests, []);
      const rec = Object.assign({ no: nextNo(list, "PR-"), createdAt: isoNow(), status: "raised" }, pr);
      list.push(rec); put(K.purchaseRequests, list);
      return rec;
    }
    function addOutbox(msgs) {
      const list = get(K.outbox, []);
      let n = list.length;
      const recs = msgs.map(function (m) { n += 1; return Object.assign({ id: "MSG-" + String(n).padStart(4, "0"), createdAt: isoNow(), status: "queued" }, m); });
      put(K.outbox, list.concat(recs));
      return recs;
    }
    function addFollowup(f) {
      const list = get(K.followups, []);
      const rec = Object.assign({ no: nextNo(list, "CL-"), createdAt: isoNow() }, f);
      list.push(rec); put(K.followups, list);
      return rec;
    }
    function addSupport(h) {
      const list = get(K.support, []);
      const rec = Object.assign({ no: nextNo(list, "HELP-"), createdAt: isoNow(), status: "waiting" }, h);
      list.push(rec); put(K.support, list);
      return rec;
    }
    /* Orders, in the record shape onboarding's createOrder() writes, so Order
       Drafts and onboarding read them as their own. All or nothing: one write. */
    function addOrders(orders, business) {
      const list = get(K.orders, []);
      let n = list.length;
      const recs = orders.map(function (o) {
        n += 1;
        return { no: "FB-ORD-" + String(n).padStart(4, "0"), customerId: o.customerId, customer: o.customer,
                 lines: o.lines, amount: o.amount, items: o.lines.reduce(function (t, l) { return t + l.qty; }, 0),
                 date: isoNow(), business: business || null, source: "control-tower" };
      });
      put(K.orders, list.concat(recs));
      return recs;
    }

    /* ── the owner's own entries (Create, and the levers' actions) ─────── */
    function addDeliveries(list) {
      const all = get(K.deliveries, []);
      let n = all.length;
      const recs = list.map(function (d) { n += 1; return Object.assign({ no: "DL-" + String(n).padStart(4, "0"), at: isoNow() }, d); });
      put(K.deliveries, all.concat(recs));
      return recs;
    }
    /* Missed deliveries go back on the next trip: the record stays, marked. */
    function rescheduleDeliveries(nos, forDate) {
      const all = get(K.deliveries, []);
      const set = {}; nos.forEach(function (x) { set[x] = 1; });
      let hit = 0;
      all.forEach(function (d) { if (set[d.no]) { d.rescheduledFor = forDate; d.rescheduledAt = isoNow(); hit += 1; } });
      put(K.deliveries, all);
      return hit;
    }
    function addPayment(p) {
      const all = get(K.payments, []);
      const rec = Object.assign({ no: nextNo(all, "RCPT-"), at: isoNow() }, p);
      all.push(rec); put(K.payments, all);
      return rec;
    }
    function addStockCounts(lines) {
      const all = get(K.stockCounts, []);
      const at = isoNow();
      const recs = lines.map(function (l) { return Object.assign({ at: at }, l); });
      put(K.stockCounts, all.concat(recs));
      return recs;
    }
    function setHold(customerId, on) {
      const h = get(K.holds, {});
      if (on) h[customerId] = { since: isoNow() }; else delete h[customerId];
      put(K.holds, h);
      return h;
    }

    function setRoute(r) { put(K.route, r); return r; }

    function read() {
      return {
        lifecycle: lifecycle(), audit: get(K.audit, []),
        purchaseRequests: get(K.purchaseRequests, []), outbox: get(K.outbox, []),
        followups: get(K.followups, []), support: get(K.support, []), orders: get(K.orders, []),
        deliveries: get(K.deliveries, []), payments: get(K.payments, []),
        stockCounts: get(K.stockCounts, []), holds: get(K.holds, {}), route: get(K.route, null),
      };
    }

    function setScope(sc) { scope = String(sc || "export").replace(/[^a-z0-9:_-]/gi, "_"); }
    function getScope() { return scope; }

    return { K: K, setScope: setScope, scope: getScope, read: read, reconcile: reconcile, acknowledge: acknowledge, dismiss: dismiss, restore: restore,
             inProgress: inProgress, audit: audit, addPurchaseRequest: addPurchaseRequest, addOutbox: addOutbox,
             addFollowup: addFollowup, addSupport: addSupport, addOrders: addOrders,
             addDeliveries: addDeliveries, rescheduleDeliveries: rescheduleDeliveries, addPayment: addPayment,
             addStockCounts: addStockCounts, setHold: setHold, setRoute: setRoute };
  }

  const API = { create: create, memory: memory, KEYS: K, StoreError: StoreError };
  root.CTStore = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

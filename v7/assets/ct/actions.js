/* ==========================================================================
   CONTROL TOWER · ACTIONS — preview, confirm, execute, record.

   THE SAFETY MODEL (requirements §18). One owner, who can do everything --
   so this is not about who, it is about what FoodBridge may do by itself:

     A  read       no confirmation           reading, explaining
     B  prepare    the owner saves it        a call list: nothing leaves
     C  execute    the owner confirms it     orders, purchase requests,
                                             reminders, a support handover
     D  policy     would run unattended      NONE enabled. POLICY is empty,
                                             and execute() refuses anything
                                             unconfirmed whatever asks for it.

   The assistant only ever PREPARES. It can hand the owner a preview; it can
   never pass `confirmed: true` on the owner's behalf -- execute() checks the
   actor, and an unconfirmed C is an AuthorizationError, not a warning.

   EVERY OUTCOME IS STATED. Success says what changed; failure says why and
   that nothing was changed. A write is one storage call, so an action is all
   or nothing -- there is no half-created batch of orders to explain.
   ========================================================================== */

(function (root) {
  "use strict";

  const CLASS = {
    A: { id: "A", label: "Read", needsConfirmation: false },
    B: { id: "B", label: "Prepare", needsConfirmation: false },
    C: { id: "C", label: "Needs your confirmation", needsConfirmation: true },
    D: { id: "D", label: "Automatic by policy", needsConfirmation: false },
  };
  /* Class D: what the business has allowed FoodBridge to do unattended.
     Deliberately empty -- nothing is enabled in this build. */
  const POLICY = {};

  const REGISTRY = {
    create_purchase_request: { cls: "C", verb: "Raise purchase request", done: "Purchase request raised" },
    create_orders:           { cls: "C", verb: "Create orders",          done: "Orders created" },
    send_reminders:          { cls: "C", verb: "Send reminders",         done: "Reminders queued" },
    create_followup:         { cls: "B", verb: "Save call list",         done: "Call list saved" },
    escalate:                { cls: "C", verb: "Send to support",        done: "Sent to support" },
  };

  function AuthorizationError(msg) { const e = new Error(msg); e.name = "AuthorizationError"; e.code = "not_authorised"; return e; }

  function create(opts) {
    const store = opts.store;
    const getState = opts.getState;            // → { state, signals } (fresh on every call)
    const fmt = (opts.signals || root.CTSignals).fmt;
    const business = opts.business || function () { return null; };

    function find(signalId) {
      const cur = getState();
      return { cur: cur, sig: cur.signals.filter(function (s) { return s.id === signalId; })[0] || null };
    }

    /* ── preview ──────────────────────────────────────────────────────── */
    function prepare(signalId, actionType) {
      const f = find(signalId);
      const s = f.sig;
      if (!s) return { ok: false, error: { code: "stale", message: "This no longer needs attention — your records changed since it was shown." } };
      const rec = s.recommendation;
      const type = actionType || (rec && rec.actionType);
      const def = REGISTRY[type];
      if (!def || !rec) return { ok: false, error: { code: "no_action", message: "There is nothing to do for this one yet." } };
      const st = f.cur.state;
      const base = { ok: true, actionType: type, cls: def.cls, clsLabel: CLASS[def.cls].label, needsConfirmation: CLASS[def.cls].needsConfirmation,
                     verb: def.verb, signalId: s.id, fingerprint: s.fingerprint, title: rec.title, reason: s.why, impact: s.impact };

      if (type === "create_purchase_request") {
        const lines = rec.lines.map(function (l) { return Object.assign({}, l, { suggestedQty: l.qty }); });
        const sups = {};
        lines.forEach(function (l) { sups[l.supplierName || "Supplier not on file"] = 1; });
        return Object.assign(base, { lines: lines, suppliers: Object.keys(sups),
          note: "Raised in FoodBridge for you to place with the supplier. Nothing is sent to a supplier." });
      }
      if (type === "create_orders") {
        const shops = rec.shops.map(function (sh) {
          return { customerId: sh.customerId, name: sh.name, include: true,
                   lines: sh.lines.map(function (l) {
                     const p = st.productById[l.productId] || {};
                     return { productId: l.productId, name: l.name || p.name, qty: l.suggestedQty, suggestedQty: l.suggestedQty,
                              unit: p.unit || "", price: p.mrp || null };
                   }) };
        });
        return Object.assign(base, { shops: shops, note: "Each order is created in FoodBridge, the way Create Order makes one. Nothing is sent to the shop." });
      }
      if (type === "send_reminders") {
        const who = business() || "us";
        const msgs = rec.customers.map(function (c) {
          return { customerId: c.customerId, name: c.name, include: true, amount: c.amount,
                   body: "Hello " + c.name + ", a reminder from " + who + ": " + fmt.inrFull(c.amount) + " is due on " +
                     (c.invoices.length === 1 ? "invoice " + c.invoices[0] : c.invoices.length + " invoices (" + c.invoices.slice(0, 3).join(", ") + (c.invoices.length > 3 ? "…" : "") + ")") +
                     ", the oldest " + c.days + " days past due. Please arrange payment. Thank you." };
        });
        return Object.assign(base, { messages: msgs, channel: "WhatsApp",
          note: "No WhatsApp sender is connected in this demo, so approved reminders wait in the outbox. Nothing reaches a customer." });
      }
      if (type === "create_followup") {
        return Object.assign(base, { customers: rec.customers.map(function (c) { return Object.assign({ include: true }, c); }),
          note: "A list for you or your team to call. Nothing is sent to anyone." });
      }
      return { ok: false, error: { code: "no_action", message: "There is nothing to do for this one yet." } };
    }

    /* From Create, not from a signal. A new order starts from what the shop
       last bought -- a fact, said as one -- and every line is the owner's to
       change. */
    function prepareOrder(customerId) {
      const st = getState().state;
      const h = st.history[customerId];
      const last = h && h.orders && h.orders.filter(function (o) { return o.source !== "foodbridge"; })[0];
      const name = st.customerById[customerId];
      if (!name) return { ok: false, error: { code: "unknown", message: "That shop isn't in your records." } };
      return { ok: true, actionType: "create_orders", cls: "C", clsLabel: CLASS.C.label, needsConfirmation: true, verb: REGISTRY.create_orders.verb,
               signalId: null, title: "New order for " + name,
               basis: last ? "Starting from their last order, " + fmt.date(last.at) + "." : "No past order to start from — add lines below.",
               shops: [{ customerId: customerId, name: name, include: true,
                         lines: (last ? last.lines : []).map(function (l) {
                           const p = st.productById[l.productId] || {};
                           return { productId: l.productId, name: p.name || l.productId, qty: l.qty, suggestedQty: l.qty, unit: p.unit || "", price: p.mrp || null };
                         }) }],
               note: "Created in FoodBridge, the way Create Order makes one. Nothing is sent to the shop." };
    }
    function preparePurchase() {
      const v = getState();
      const st = v.state;
      const dem = (opts.signals || root.CTSignals)._detectors.demand(st)
        .filter(function (d) { return d.available !== null && d.daily > 0; })
        .sort(function (a, b) { return a.cover - b.cover; }).slice(0, 15);
      const T = (opts.signals || root.CTSignals).T;
      return { ok: true, actionType: "create_purchase_request", cls: "C", clsLabel: CLASS.C.label, needsConfirmation: true,
               verb: REGISTRY.create_purchase_request.verb, signalId: null, title: "New purchase request",
               basis: "Your selling products with the least stock cover first. Suggested quantities cover 30 days plus a week, less stock and anything on order.",
               lines: dem.map(function (d) {
                 const need = Math.max(0, Math.ceil(d.daily * (T.REORDER_DAYS + T.SAFETY_DAYS) - Math.max(d.available, 0) - d.onOrder));
                 const sup = st.suppliers.filter(function (x) { return x.category && x.category === d.product.category; })[0] || null;
                 return { productId: d.product.id, name: d.product.name, qty: need, suggestedQty: need, unit: d.product.unit, mrp: d.product.mrp,
                          supplierId: sup ? sup.id : null, supplierName: sup ? sup.name : null,
                          hint: d.available <= 0 ? "Out of stock" : isFinite(d.cover) ? Math.floor(d.cover) + " days left" : "" };
               }),
               note: "Raised in FoodBridge for you to place with the supplier. Nothing is sent to a supplier." };
    }

    /* The support handover is not tied to one signal. */
    function prepareEscalation(ctx) {
      const cur = getState();
      return { ok: true, actionType: "escalate", cls: "C", clsLabel: CLASS.C.label, needsConfirmation: true, verb: REGISTRY.escalate.verb,
               signalId: ctx && ctx.signalId || null, title: "Talk to a FoodBridge expert",
               context: {
                 business: business(),
                 issue: ctx && ctx.signalId ? (cur.signals.filter(function (s) { return s.id === ctx.signalId; })[0] || {}).title || null : null,
                 signals: cur.signals.slice(0, 5).map(function (s) { return { id: s.id, severity: s.severity, title: s.title, impact: s.impact && s.impact.description }; }),
                 freshness: cur.freshness ? cur.freshness.headline + " — " + (cur.freshness.sources[0] || {}).detail : null,
                 recentActions: store.read().audit.filter(function (a) { return a.kind === "action"; }).slice(-5)
                   .map(function (a) { return a.at.slice(0, 16).replace("T", " ") + " · " + a.action + (a.outcome ? " — " + a.outcome : ""); }),
                 conversation: (ctx && ctx.conversation || []).slice(-6),
               },
               note: "Your support desk isn't connected in this demo, so the handover waits here with everything above attached." };
    }

    /* ── execute ──────────────────────────────────────────────────────── */
    function execute(preview, how) {
      const h = how || {};
      const actor = h.actor || "owner";
      const def = REGISTRY[preview && preview.actionType];
      if (!def) return fail("no_action", "Unknown action.");
      const needs = CLASS[def.cls].needsConfirmation && !POLICY[preview.actionType];
      if (needs && (!h.confirmed || actor !== "owner")) {
        const err = AuthorizationError(actor === "owner"
          ? "This needs your confirmation first."
          : "FoodBridge AI can prepare this, but only you can confirm it.");
        try { store.audit({ kind: "action", action: preview.actionType, actor: actor, aiAssisted: actor !== "owner",
                            signalId: preview.signalId, outcome: "Refused — not confirmed by the owner", approval: "missing" }); } catch (e) { /* the refusal stands */ }
        throw err;
      }

      /* Stale check: the signal must still be what the owner reviewed. */
      if (preview.signalId && preview.actionType !== "escalate") {
        const f = find(preview.signalId);
        if (!f.sig) return fail("stale", "This no longer needs attention — your records changed since you opened it. Nothing was changed.");
      }
      const aiAssisted = !!h.aiAssisted;
      const approval = needs ? "confirmed by the owner" : "not required (" + CLASS[def.cls].label.toLowerCase() + ")";
      try {
        if (h.simulateFailure) throw Object.assign(new Error(h.simulateFailure), { code: "simulated" });
        return run(preview, { aiAssisted: aiAssisted, approval: approval });
      } catch (e) {
        try { store.audit({ kind: "action", action: preview.actionType, signalId: preview.signalId, aiAssisted: aiAssisted,
                            approval: approval, outcome: "Failed — " + e.message }); } catch (x) { /* nothing more to record with */ }
        return fail(e.code || "failed", e.message + " Nothing was changed.");
      }
    }

    function run(p, meta) {
      if (p.actionType === "create_purchase_request") {
        const lines = p.lines.filter(function (l) { return Number(l.qty) > 0; })
          .map(function (l) { return { productId: l.productId, name: l.name, qty: Math.round(Number(l.qty)), unit: l.unit || "",
                                       mrp: l.mrp || null, supplierId: l.supplierId || null, supplierName: l.supplierName || null }; });
        if (!lines.length) return fail("empty", "Every quantity is zero, so there is nothing to raise. Nothing was changed.");
        const priced = lines.filter(function (l) { return l.mrp; });
        const total = priced.length === lines.length ? priced.reduce(function (n, l) { return n + l.qty * l.mrp; }, 0) : null;
        const pr = store.addPurchaseRequest({ signalId: p.signalId, lines: lines, valueAtMrp: total, aiAssisted: meta.aiAssisted });
        const outcome = pr.no + " raised for " + fmt.plural(lines.length, "product") + ", " + lines.reduce(function (n, l) { return n + l.qty; }, 0) + " units";
        if (p.signalId) store.inProgress(p.signalId, pr.no + " raised — waiting for stock", false);
        const a = store.audit({ kind: "action", action: "create_purchase_request", signalId: p.signalId, aiAssisted: meta.aiAssisted,
                                approval: meta.approval, before: "no purchase request", after: pr.no, reason: p.title, outcome: outcome,
                                ref: pr.no });
        return ok(outcome, { purchaseRequest: pr, audit: a },
                  ["Stock on order is counted from now on — these products move to monitoring.",
                   total !== null ? "Value at MRP: " + fmt.inr(total) : "Value not counted — some products have no MRP."]);
      }
      if (p.actionType === "create_orders") {
        const orders = p.shops.filter(function (s) { return s.include; }).map(function (s) {
          const lines = s.lines.filter(function (l) { return Number(l.qty) > 0; })
            .map(function (l) { return { productId: l.productId, name: l.name, qty: Math.round(Number(l.qty)), price: l.price, unit: l.unit }; });
          const priced = lines.every(function (l) { return typeof l.price === "number"; });
          return { customerId: s.customerId, customer: s.name, lines: lines,
                   amount: priced && lines.length ? lines.reduce(function (n, l) { return n + l.price * l.qty; }, 0) : null };
        }).filter(function (o) { return o.lines.length; });
        if (!orders.length) return fail("empty", "No shop has a line with a quantity, so there is nothing to create. Nothing was changed.");
        const recs = store.addOrders(orders, business());
        const outcome = fmt.plural(recs.length, "order") + " created: " + recs.map(function (r) { return r.no; }).join(", ");
        if (p.signalId) store.inProgress(p.signalId, fmt.plural(recs.length, "order") + " created", false);
        const a = store.audit({ kind: "action", action: "create_orders", signalId: p.signalId, aiAssisted: meta.aiAssisted,
                                approval: meta.approval, before: fmt.plural(recs.length, "shop") + " past their cycle", after: outcome,
                                reason: p.title, outcome: outcome, ref: recs.map(function (r) { return r.no; }).join(",") });
        return ok(outcome, { orders: recs, audit: a },
                  ["These shops are back on their cycle from today.", "The orders are in Order Drafts, and count against stock."]);
      }
      if (p.actionType === "send_reminders") {
        const msgs = p.messages.filter(function (m) { return m.include && String(m.body || "").trim(); })
          .map(function (m) { return { customerId: m.customerId, name: m.name, channel: p.channel, body: m.body.trim(), amount: m.amount, signalId: p.signalId }; });
        if (!msgs.length) return fail("empty", "No reminder is selected. Nothing was changed.");
        const recs = store.addOutbox(msgs);
        const outcome = fmt.plural(recs.length, "reminder") + " queued in the outbox";
        if (p.signalId) store.inProgress(p.signalId, outcome + " — waiting for payment", false);
        const a = store.audit({ kind: "action", action: "send_reminders", signalId: p.signalId, aiAssisted: meta.aiAssisted,
                                approval: meta.approval, before: "not reminded", after: outcome, reason: p.title, outcome: outcome,
                                ref: recs.map(function (r) { return r.id; }).join(",") });
        return ok(outcome, { messages: recs, audit: a },
                  ["No WhatsApp sender is connected in this demo — they wait in the outbox.", "These customers count as reminded for 7 days."]);
      }
      if (p.actionType === "create_followup") {
        const list = p.customers.filter(function (c) { return c.include; }).map(function (c) { return { customerId: c.customerId, name: c.name }; });
        if (!list.length) return fail("empty", "No one is selected. Nothing was changed.");
        const f = store.addFollowup({ signalId: p.signalId, customers: list, title: p.title });
        const outcome = f.no + ": " + fmt.plural(list.length, "shop") + " to call";
        if (p.signalId) store.inProgress(p.signalId, outcome, false);
        const a = store.audit({ kind: "action", action: "create_followup", signalId: p.signalId, aiAssisted: meta.aiAssisted,
                                approval: meta.approval, after: f.no, reason: p.title, outcome: outcome, ref: f.no });
        return ok(outcome, { followup: f, audit: a }, ["Nothing was sent to anyone."]);
      }
      if (p.actionType === "escalate") {
        const hdl = store.addSupport({ signalId: p.signalId, context: p.context, message: p.message || "" });
        const outcome = hdl.no + " packaged for a FoodBridge expert";
        const a = store.audit({ kind: "action", action: "escalate", signalId: p.signalId, aiAssisted: meta.aiAssisted,
                                approval: meta.approval, after: hdl.no, reason: p.context && p.context.issue || "Asked for help", outcome: outcome, ref: hdl.no });
        return ok(outcome, { handover: hdl, audit: a },
                  ["They get the issue, the evidence, what FoodBridge found and what you've already done — you won't repeat it.",
                   "Your support desk isn't connected in this demo, so it waits here."]);
      }
      return fail("no_action", "Unknown action. Nothing was changed.");
    }

    function ok(message, data, changed) { return { ok: true, message: message, data: data, changed: changed || [] }; }
    function fail(code, message) { return { ok: false, error: { code: code, message: message }, changed: [] }; }

    return { CLASS: CLASS, POLICY: POLICY, REGISTRY: REGISTRY, prepare: prepare, prepareOrder: prepareOrder, preparePurchase: preparePurchase, prepareEscalation: prepareEscalation, execute: execute };
  }

  const API = { create: create, CLASS: CLASS, REGISTRY: REGISTRY, AuthorizationError: AuthorizationError };
  root.CTActions = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

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

    const actions = root.CTActions.create({
      store: store, signals: Signals,
      getState: function () { return pass(); },
      business: opts.business,
    });

    function assistant(focus) {
      return root.CTAssistant.create({
        signals: Signals,
        getContext: function () {
          const v = last || pass();
          return { signals: v.signals, pulse: v.pulse, freshness: v.freshness, unavailable: v.unavailable,
                   business: opts.business ? opts.business() : null, focusId: focus ? focus() : null, dataEnd: v.state.dataEnd };
        },
      });
    }

    return { pass: pass, last: function () { return last; }, actions: actions, assistant: assistant, store: store };
  }

  const API = { create: create };
  root.CTTower = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

/* ==========================================================================
   FB_EVENTS — the platform's event stream (24 Sep 2026).

   Every screen that records work writes one line here when it saves: the
   delivery app when a stop is skipped, goods come back, an order is edited,
   the customer disputes, the van has a problem. The Control Tower reads the
   same stream (assets/ct/incidents.js) and names the incident — so what
   happens on the ground reaches the owner as it happens, and a fix made on
   the ground closes the incident as surely as one made in the tower.

     FB_EVENTS.emit(type, { by, where, subject: { customer, van, incident },
                            data })  → the event, with its id and time

   One key, fb.v7.events, shared by every frame of the platform (same
   origin); the tower hears each write through the storage event. Capped at
   the last 2,000. A write that fails returns null: the screen still saves
   its own record.
   ========================================================================== */

(function (root) {
  "use strict";
  const KEY = "fb.v7.events", CAP = 2000;
  function read() {
    try { const v = JSON.parse(root.localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function emit(type, o) {
    const all = read();
    const n = all.reduce(function (m, e) { const k = parseInt(String(e.id || "").replace(/\D/g, ""), 10); return isNaN(k) ? m : Math.max(m, k); }, 0) + 1;
    const ev = Object.assign({ id: "EV-" + String(n).padStart(6, "0"), at: new Date().toISOString(), type: type, how: "driver", where: "Delivery app" }, o || {});
    try { root.localStorage.setItem(KEY, JSON.stringify(all.concat([ev]).slice(-CAP))); } catch (e) { return null; }
    return ev;
  }
  /* The incident the tower names for an event this screen wrote. */
  function incidentOf(ev) { return ev ? "ev:" + ev.id : null; }
  root.FB_EVENTS = { emit: emit, read: read, incidentOf: incidentOf, KEY: KEY };
})(typeof window !== "undefined" ? window : globalThis);

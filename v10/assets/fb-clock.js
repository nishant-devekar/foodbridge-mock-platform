/* ==========================================================================
   DEMO CLOCK — run a demo at a chosen time of day (24 Sep 2026).

   Off unless localStorage "fb.v7.demoClock" holds { "offset": <ms> }. When
   set, every page that loads this file first (the delivery app and the
   Control Tower) reads the same shifted clock, so a 9 pm rehearsal of the
   morning's story still gets "Try again today" and today's delivery windows.

     localStorage.setItem("fb.v7.demoClock", JSON.stringify({ offset: Date.parse("2026-09-24T09:05:00+05:30") - Date.now() }))
     localStorage.removeItem("fb.v7.demoClock")    // back to the real clock

   FB_CLOCK.set(offset) moves an already-open page to a new time (and saves
   it, so frames opened after follow).
   ========================================================================== */

(function (root) {
  "use strict";
  let off = 0;
  try {
    const v = JSON.parse(root.localStorage.getItem("fb.v7.demoClock") || "null");
    if (v && typeof v.offset === "number" && isFinite(v.offset)) off = v.offset;
  } catch (e) { return; }
  if (!off) return;

  const Real = root.Date;
  function DemoDate() {
    if (!(this instanceof DemoDate)) return new Real(Real.now() + off).toString();
    if (!arguments.length) return new Real(Real.now() + off);
    return new (Function.prototype.bind.apply(Real, [null].concat(Array.prototype.slice.call(arguments))))();
  }
  DemoDate.prototype = Real.prototype;
  DemoDate.now = function () { return Real.now() + off; };
  DemoDate.UTC = Real.UTC;
  DemoDate.parse = Real.parse;
  root.Date = DemoDate;
  root.FB_CLOCK = {
    set: function (o) {
      off = o;
      try { root.localStorage.setItem("fb.v7.demoClock", JSON.stringify({ offset: o })); } catch (e) { /* this page only */ }
    },
    at: function (iso) { root.FB_CLOCK.set(Real.parse(iso) - Real.now()); },
  };
})(typeof window !== "undefined" ? window : globalThis);

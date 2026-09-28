/* ==========================================================================
   production-tabs.js — Production's three views as fixed tabs (29 Sep 2026).

   Owner: "Today | Week | All batches should have stable position like tabs,
   those should not move since those are fundamentals of the page." Today and
   Week are the Production board (modules/foodbridge-production-flow); All
   batches is the Batches page (batch-management, off the sidebar). Both pages
   mount this same strip right under the page header, so the three tabs sit in
   the same place, the same size, whichever view is open — and stay there
   (sticky under the 56px header) while the page scrolls.

   Under the tabs, the view's first line is drawn here too — the date, one
   line of what the view is, and its main button — so everything above the
   view's own content is the same size and place on all three.

   Use:  var t = FBProductionTabs.mount({ active: "today" | "week" | "all",
                                  sub: "…", action: { label, onClick },
                                  onSelect: function (view) { … } })
         t.set(view) · t.sub(text) — when the page changes view itself
         onSelect handles views on the same page (return true); any other
         view is opened through the platform: #/production/production-board
         ?view=today|week, or #/production/batch-management.
   ========================================================================== */
(function () {
  "use strict";
  if (window.FBProductionTabs) return;

  var VIEWS = [["today", "Today"], ["week", "Week"], ["all", "All batches"]];
  /* the header's own measures: 12px in, 24px from 640px; system-ui */
  var CSS = [
    ".fbpt,.fbpt *{box-sizing:border-box}",
    ".fbpt{position:sticky;top:56px;z-index:29;background:#fff;border-bottom:1px solid #e5e7eb;font-family:system-ui,sans-serif,Arial,Helvetica}",
    ".fbpt-in{display:flex;align-items:stretch;gap:4px;height:46px;padding:0 12px}",
    ".fbpt button{position:relative;display:inline-flex;align-items:center;justify-content:center;min-width:96px;height:46px;margin:0;padding:0 16px;border:0;background:none;font:600 14px/1 system-ui,sans-serif,Arial,Helvetica;color:#6b7280;cursor:pointer;white-space:nowrap}",
    ".fbpt button:hover{color:#111827;background:#f9fafb}",
    ".fbpt button[aria-selected=true]{color:#111827;cursor:default;background:none}",
    ".fbpt button[aria-selected=true]::after{content:'';position:absolute;left:10px;right:10px;bottom:-1px;height:3px;border-radius:3px 3px 0 0;background:#16a34a}",
    ".fbpt button:focus-visible{outline:none;box-shadow:inset 0 0 0 2px rgba(34,197,94,.5);border-radius:6px}",
    ".fbpt-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:20px 12px 0;font-family:system-ui,sans-serif,Arial,Helvetica;text-align:left}",
    ".fbpt-head h1{margin:0;font-size:20px;line-height:28px;font-weight:700;color:#111827;letter-spacing:-.01em}",
    ".fbpt-head p{margin:2px 0 0;font-size:14px;line-height:20px;color:#6b7280}",
    ".fbpt-act{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 16px;border:0;border-radius:10px;background:#16a34a;color:#fff;font:600 14px/1 system-ui,sans-serif,Arial,Helvetica;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.08)}",
    ".fbpt-act:hover{background:#15803d}",
    "@media (min-width:640px){.fbpt-in{padding:0 24px}.fbpt-head{padding:20px 24px 0}}",
    "@media (max-width:639.98px){.fbpt button{flex:1 1 0;min-width:0;padding:0 8px}.fbpt-head{padding:14px 12px 0}.fbpt-act.desk{display:none}}",
  ].join("");

  function style() {
    if (document.getElementById("fbpt-css")) return;
    var s = document.createElement("style");
    s.id = "fbpt-css"; s.textContent = CSS;
    document.head.appendChild(s);
  }
  function route(view) {
    var hash = view === "all" ? "#/production/batch-management" : "#/production/production-board?view=" + view;
    try { if (window.parent !== window) { window.parent.location.hash = hash; return; } } catch (e) { /* not inside the platform */ }
    /* on its own: the two pages, side by side in the repo */
    var inBoard = location.pathname.indexOf("/foodbridge-production-flow/") !== -1;
    var BOARD = inBoard ? "production.html" : "../../../../foodbridge-production-flow/production.html";
    var ALL = inBoard ? "../foodbridge-production-discovery/batch-management/screens/batch/batch-workspace.html" : "batch-workspace.html";
    location.href = view === "all" ? ALL : BOARD + "?view=" + view;
  }

  function mount(o) {
    o = o || {};
    style();
    var nav = document.createElement("nav");
    nav.className = "fbpt";
    nav.setAttribute("aria-label", "Production views");
    var inner = document.createElement("div");
    inner.className = "fbpt-in";
    inner.setAttribute("role", "tablist");
    VIEWS.forEach(function (v) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("data-view", v[0]);
      b.textContent = v[1];
      inner.appendChild(b);
    });
    nav.appendChild(inner);
    function set(view) {
      Array.prototype.forEach.call(inner.children, function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-view") === view)); });
    }
    set(o.active);
    inner.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-view]");
      if (!b || b.getAttribute("aria-selected") === "true") return;
      var view = b.getAttribute("data-view");
      if (o.onSelect && o.onSelect(view) === true) { set(view); return; }
      route(view);
    });
    /* the view's first line: the date, what the view is, its main button */
    var line = document.createElement("div");
    line.className = "fbpt-head";
    var txt = document.createElement("div"), h1 = document.createElement("h1"), p = document.createElement("p");
    h1.textContent = "Today, " + new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    p.textContent = o.sub || "";
    txt.appendChild(h1); txt.appendChild(p); line.appendChild(txt);
    if (o.action) {
      var a = document.createElement("button");
      a.type = "button"; a.className = "fbpt-act" + (o.action.desktopOnly ? " desk" : "");
      a.textContent = o.action.label;
      a.addEventListener("click", o.action.onClick);
      line.appendChild(a);
    }
    /* right under the page header, wherever the page put it */
    var head = document.querySelector(".fbah");
    if (head && head.parentNode) { head.parentNode.insertBefore(nav, head.nextSibling); nav.parentNode.insertBefore(line, nav.nextSibling); }
    else { document.body.insertBefore(line, document.body.firstChild); document.body.insertBefore(nav, line); }
    return { el: nav, set: set, sub: function (t) { p.textContent = t || ""; } };
  }

  window.FBProductionTabs = { mount: mount };
})();

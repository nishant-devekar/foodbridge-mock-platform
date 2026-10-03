/* ==========================================================================
   production-tabs.js — Production's views as fixed tabs (29 Sep 2026).

   Owner: the tabs are the fundamentals of the page and keep their places.
   Since 29 Sep 2026 they are, in order: Demand & supply (sales → production
   → purchase), All batches (the Batches page, off the sidebar), All shifts
   (the week's roster) and Needs you (the alerts, with a count). Today was
   retired. Demand & supply, All shifts and Needs you are the Production
   board (modules/foodbridge-production-flow); both pages mount this same
   strip right under the page header, so the tabs sit in the same place,
   the same size, whichever view is open — and stay there (sticky under the
   56px header) while the page scrolls.

   Under the tabs, the view's first line is drawn here too — the date, one
   line of what the view is, and its main button — so everything above the
   view's own content is the same size and place on all three.

   Use:  var t = FBProductionTabs.mount({ active: "flow" | "all" | "week" | "needs",
                                  sub: "…", action: { label, onClick },
                                  onSelect: function (view) { … } })
         t.set(view) · t.sub(text) — when the page changes view itself
         t.count(view, n) — a count on a tab (0 hides it)
         t.action({ label, onClick, quiet, icon }) · t.action(null) — the view's action on the date's row
         (icon: a name from ICONS, drawn before the label)
         onSelect handles views on the same page (return true); any other
         view is opened through the platform: #/production/production-board
         ?view=flow|week|needs, or #/production/batch-management.
   ========================================================================== */
(function () {
  "use strict";
  if (window.FBProductionTabs) return;

  /* Owner, 29 Sep 2026: Demand & supply first, then All batches, All shifts (the Week), Needs you; Today retired */
  /* "Production requests", not "All batches" (owner, 29 Sep 2026): a batch is a request to produce, worked in shifts */
  /* 3 Oct 2026 (owner): the first view is the owner's "Todays Production and Purchase Plan"
     sheet — Orders · Finished Goods · Semi Finished Goods · Purchase — so it is named after it */
  var VIEWS = [["flow", "Production & purchase plan"], ["all", "Production requests"], ["week", "All shifts"], ["needs", "Needs you", "hidden"]];
  /* "hidden": off the strip for now (owner, 29 Sep 2026 — "hide Needs you, do not delete"). The view
     still works (?view=needs); drop the word to bring the tab back. */
  /* icons an action can carry: 24-unit line icons, drawn in the text's colour */
  var ICONS = {
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  };
  function icon(name) {
    return ICONS[name] ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + "</svg>" : "";
  }
  /* the header's own measures: 12px in, 24px from 640px; system-ui */
  var CSS = [
    ".fbpt,.fbpt *{box-sizing:border-box}",
    ".fbpt{position:sticky;top:56px;z-index:29;background:#fff;border-bottom:1px solid #e5e7eb;font-family:system-ui,sans-serif,Arial,Helvetica}",
    ".fbpt-in{display:flex;align-items:stretch;gap:4px;height:46px;padding:0 12px}",
    ".fbpt button{position:relative;display:inline-flex;align-items:center;justify-content:center;min-width:96px;height:46px;margin:0;padding:0 16px;border:0;background:none;font:600 14px/1 system-ui,sans-serif,Arial,Helvetica;color:#6b7280;cursor:pointer;white-space:nowrap}",
    ".fbpt button:hover{color:#111827;background:#f9fafb}",
    ".fbpt button[aria-selected=true]{color:#111827;cursor:default;background:none}",
    ".fbpt button[aria-selected=true]::after{content:'';position:absolute;left:10px;right:10px;bottom:-1px;height:3px;border-radius:3px 3px 0 0;background:#16a34a}",
"    .fbpt-n{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;margin-left:6px;padding:0 6px;border-radius:10px;background:#fef3c7;color:#92400e;font:700 11px/1 system-ui,sans-serif,Arial,Helvetica}",
    ".fbpt-n[hidden]{display:none}",
    ".fbpt button:focus-visible{outline:none;box-shadow:inset 0 0 0 2px rgba(34,197,94,.5);border-radius:6px}",
    ".fbpt-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:20px 12px 0;font-family:system-ui,sans-serif,Arial,Helvetica;text-align:left}",
    ".fbpt-head h1{margin:0;font-size:20px;line-height:28px;font-weight:700;color:#111827;letter-spacing:-.01em}",
    ".fbpt-head p{margin:2px 0 0;font-size:14px;line-height:20px;color:#6b7280}",
    ".fbpt-act{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 16px;border:0;border-radius:10px;background:#16a34a;color:#fff;font:600 14px/1 system-ui,sans-serif,Arial,Helvetica;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.08)}",
    ".fbpt-act:hover{background:#15803d}",
    ".fbpt-link{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;border:0;background:none;padding:0 0 4px;font:600 14px/1.2 system-ui,sans-serif,Arial,Helvetica;color:#0f766e;cursor:pointer}",
    ".fbpt-link svg,.fbpt-act svg{flex:0 0 auto;width:16px;height:16px}",
    ".fbpt-link:hover{text-decoration:underline}",
    "@media (min-width:640px){.fbpt-in{padding:0 24px}.fbpt-head{padding:20px 24px 0}}",
    "@media (max-width:639.98px){.fbpt-in{gap:0;padding:0 4px;overflow-x:auto;scrollbar-width:none}.fbpt-in::-webkit-scrollbar{display:none}.fbpt button{flex:0 0 auto;min-width:0;padding:0 12px;font-size:13px}.fbpt-n{margin-left:4px;min-width:18px;height:18px;padding:0 5px}.fbpt-head{padding:14px 12px 0}.fbpt-act.desk{display:none}}",
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
    VIEWS.filter(function (v) { return v[2] !== "hidden"; }).forEach(function (v) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("data-view", v[0]);
      b.textContent = v[1];
      var badge = document.createElement("span");
      badge.className = "fbpt-n"; badge.hidden = true;
      b.appendChild(badge);
      inner.appendChild(b);
    });
    nav.appendChild(inner);
    function set(view) {
      Array.prototype.forEach.call(inner.children, function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-view") === view)); });
      reveal();
    }
    set(o.active);
    /* a phone scrolls the strip: keep the open tab in view */
    function reveal() { var on = inner.querySelector('[aria-selected="true"]'); if (on && inner.scrollWidth > inner.clientWidth) inner.scrollLeft = Math.max(0, on.offsetLeft - (inner.clientWidth - on.offsetWidth) / 2); }
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
    p.hidden = !o.sub;   /* owner, 29 Sep 2026: no line under the date unless a page asks for one */
    txt.appendChild(h1); txt.appendChild(p); line.appendChild(txt);
    /* the view's one action, on the date's row: a button, or a quiet link ({ quiet: true });
       a page that switches views sets or clears it with t.action(…) */
    var act = null;
    function action(x) {
      if (act) { act.remove(); act = null; }
      if (!x) return;
      act = document.createElement("button");
      act.type = "button"; act.className = (x.quiet ? "fbpt-link" : "fbpt-act") + (x.desktopOnly ? " desk" : "");
      act.innerHTML = icon(x.icon);
      act.appendChild(document.createTextNode(x.label));
      act.addEventListener("click", x.onClick);
      line.appendChild(act);
    }
    action(o.action);
    /* right under the page header, wherever the page put it */
    var head = document.querySelector(".fbah");
    if (head && head.parentNode) { head.parentNode.insertBefore(nav, head.nextSibling); nav.parentNode.insertBefore(line, nav.nextSibling); }
    else { document.body.insertBefore(line, document.body.firstChild); document.body.insertBefore(nav, line); }
    function count(view, n) {
      var b = inner.querySelector('button[data-view="' + view + '"] .fbpt-n');
      if (!b) return;
      b.hidden = !(n > 0);
      b.textContent = n > 0 ? String(n) : "";
      b.parentNode.setAttribute("aria-label", b.parentNode.firstChild.textContent + (n > 0 ? ", " + n : ""));
    }
    setTimeout(reveal, 0);
    return { el: nav, set: set, count: count, action: action, sub: function (t) { p.textContent = t || ""; p.hidden = !t; } };
  }

  window.FBProductionTabs = { mount: mount };
})();

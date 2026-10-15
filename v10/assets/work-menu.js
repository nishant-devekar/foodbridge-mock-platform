/* ==========================================================================
   THE WORK BEHIND THE DELIVERIES LEVER — what each screen can open.

   A footer tab opens its menu, never a page (owner, 23 Sep 2026: "when the
   user clicks on Delivery it should not directly open the page; it should
   first open the submenu, and the page opens on picking one"). So every
   screen on the trip needs its parts written down in one place, and the
   FIRST part is always the screen itself — a tab with nothing else to offer
   (Tracking has only its Routes panel) still has somewhere to land, and the
   pattern is the same everywhere.

   Read by both bars, so they cannot drift:
     assets/platform.js        the trip bar under a work screen
     screens/control-tower.js  the tower's own bar on the Deliveries lever

   `press` is how a part is reached once the screen is up: the first button
   or link inside `in` whose text contains `text`. A part without `press` is
   the screen as it opens. `go` is what travels in the hash
   (…?from=deliveries&go=reports), so a pick from the tower lands on the
   right part of a screen that was not even loaded yet.

   Pure data: no DOM, no clock. The icons are shapes only — each bar draws
   them at its own size, weight and colour.
   ========================================================================== */

(function (root) {
  "use strict";

  /* The same shapes the bars already use, by name. */
  var SHAPE = {
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
    box: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12M3.3 7l8.7 5 8.7-5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    home: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    report: '<path d="M4 20V10M10 20V4M16 20v-6M21 20H3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sync: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
  };

  /* The four screens, in the order the bar carries them. */
  var SCREENS = {
    "live-tracking": {
      label: "Tracking",
      parts: [
        /* The map is the screen; Routes is the panel it opens. Without this
           first line the tab had nowhere to land (owner, 23 Sep 2026). */
        { go: "map", label: "Live map", icon: "pin" },
        { go: "routes", label: "Routes", icon: "list", press: { in: "#mfooter", text: "routes" } },
      ],
    },
    "delivery-management": {
      label: "Delivery",
      parts: [
        { go: "home", label: "Delivery home", icon: "truck", press: { in: "#app div:has(> .rd-tab)", text: "home" } },
        { go: "reports", label: "Reports", icon: "report", press: { in: "#app div:has(> .rd-tab)", text: "reports" } },
      ],
    },
    "route-planning": {
      label: "Planning",
      parts: [
        { go: "templates", label: "Delivery templates", icon: "map" },
        { go: "add", label: "Add a template", icon: "plus", press: { in: "#mfooter", text: "add template" } },
      ],
    },
    /* Its three sections live inside the screen, not in a bar of its own, so
       the footer never offered them. They are the reason the owner opens it. */
    "logistic-returns": {
      label: "Assets",
      parts: [
        { go: "movement", label: "Asset movement", icon: "sync", press: { in: ".subtabs", text: "asset movement" } },
        { go: "inventory", label: "Asset inventory", icon: "box", press: { in: ".subtabs", text: "asset inventory" } },
        { go: "assets", label: "Assets", icon: "list", press: { in: ".subtabs", text: "assets" } },
      ],
    },
  };

  function parts(id) { return (SCREENS[id] && SCREENS[id].parts) || []; }
  function partOf(id, go) { return parts(id).filter(function (p) { return p.go === go; })[0] || null; }
  function shape(name) { return SHAPE[name] || SHAPE.list; }
  /* The one element a part is reached by, in a screen that is already up. */
  function find(doc, part) {
    if (!doc || !part || !part.press) return null;
    var box;
    try { box = doc.querySelector(part.press.in); } catch (e) { return null; }
    if (!box) return null;
    var els = box.querySelectorAll("button, a");
    for (var i = 0; i < els.length; i++) {
      var txt = String(els[i].textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (txt.indexOf(part.press.text) !== -1) return els[i];
    }
    return null;
  }

  root.FB_WORK = { screens: SCREENS, parts: parts, partOf: partOf, shape: shape, find: find };
  if (typeof module !== "undefined" && module.exports) module.exports = root.FB_WORK;
})(typeof window !== "undefined" ? window : globalThis);

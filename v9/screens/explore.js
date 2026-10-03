/* ==========================================================================
   EXPLORE — the screen that makes "show me around" a real answer.

   THE PROBLEM IT SOLVES. Before this existed, declining setup sent the user
   to "Where is your business data today?" — the exact question they had just
   declined — and then through roughly seven taps of import ceremony before
   any feature appeared. Explore and set-up were the same flow; only an
   account object separated them.

   WHAT IT IS. Six doors into screens that already exist, each saying what the
   user will see before they commit a tap to it. Nothing is imported, no
   account is made, and no figure on the far side is invented — the demo store
   is the tenant's own records.

   THE STANDING OFFER. "Set up my business" sits at the foot of this screen
   and every feature reached from it, at footer weight. It is deliberately
   quiet here: the persuasive moment is the end of a feature, where the
   product has just shown something. A menu that nags is the thing this
   product is positioned against.
   ========================================================================== */

(function () {
  "use strict";

  var lu = function (d) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  };

  var ICON = {
    chev: lu('<path d="m9 18 6-6-6-6"/>'),
    route: lu('<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>'),
    rupee: lu('<path d="M6 3h12"/><path d="M6 8h12"/><path d="M6 13l8.5 8"/><path d="M6 13h3a5 5 0 0 0 0-10"/>'),
    box: lu('<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'),
    cart: lu('<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>'),
    clip: lu('<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>'),
    truck: lu('<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>'),
  };

  /* Six, and no more. A chooser long enough to scroll is a menu, and a menu is
     the thing the user was trying to get past.

     `what` is a promise the screen on the far side has to keep — every one of
     these was checked against what that destination actually renders. */
  var FEATURES = [
    { id: "route", icon: ICON.route, title: "Today's route",
      what: "Stops, deliveries and cash collected, settled at the end",
      route: "distribution-logistics/delivery-management" },
    { id: "collections", icon: ICON.rupee, title: "Collections",
      what: "What each customer still owes, oldest first",
      route: "finance/customer-receivables" },
    { id: "inventory", icon: ICON.box, title: "Inventory",
      what: "What is on the shelf, and what has run out",
      route: "inventory/finished-goods-inventory" },
    { id: "orders", icon: ICON.cart, title: "Orders",
      what: "Everything open, and what is waiting on delivery",
      route: "sales-orders" },
    { id: "audit", icon: ICON.clip, title: "Shelf audit",
      what: "Count a customer's shelf and get the reorder suggested",
      route: "customer-management/stock-audit-health" },
    { id: "purchase", icon: ICON.truck, title: "Purchase",
      what: "What to buy for tomorrow, and who from",
      route: "procurement/purchase-orders" },
  ];

  var ROOT_ID = "x-root";

  /* The frame that owns the platform's hash is not always `window.top` — the
     IVR simulator frames the platform. Climb until one answers to FBPlatform. */
  function platformWin() {
    var w = window;
    for (var up = 0; up < 4; up++) {
      var next;
      try { next = w.parent; } catch (e) { return null; }
      if (!next || next === w) return null;
      w = next;
      try { if (w.FBPlatform) return w; } catch (e) { /* keep climbing */ }
    }
    return null;
  }

  function handoff(route) {
    var pw = platformWin();
    if (pw) { try { pw.location.hash = "#/" + route; return; } catch (e) { /* fall through */ } }
    window.location.href = "../index.html#/" + route;
  }

  /* Where "Set up my business" goes. `start=new` is read by onboarding, which
     shows the offer; a user who has already declined it once lands on the
     account screen instead, because asking twice is nagging. */
  function toSetup() { handoff("onboarding?signup=1"); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function featureHtml(f) {
    return '<button class="feat" data-route="' + esc(f.route) + '" data-id="' + esc(f.id) + '">' +
      '<span class="feat-ic">' + f.icon + "</span>" +
      '<span class="feat-b">' +
        '<span class="feat-t">' + esc(f.title) + "</span>" +
        '<span class="feat-s">' + esc(f.what) + "</span>" +
      "</span>" +
      '<span class="feat-c">' + ICON.chev + "</span>" +
    "</button>";
  }

  function draw() {
    var root = document.getElementById(ROOT_ID);
    if (!root) return;

    root.innerHTML =
      '<div class="app">' +
        '<header class="top">' +
          '<div class="eyebrow">Have a look around</div>' +
          '<h1 class="h1">What would you like to see?</h1>' +
        "</header>" +

        '<main class="main">' +
          '<div class="rows">' + FEATURES.map(featureHtml).join("") + "</div>" +
        "</main>" +

        '<div class="standing">' +
          "<p>Ready when you are</p>" +
          '<button class="btn" id="x-setup">Set up my business</button>' +
        "</div>" +
      "</div>";

    Array.prototype.forEach.call(root.querySelectorAll(".feat"), function (el) {
      el.addEventListener("click", function () { handoff(el.getAttribute("data-route")); });
    });
    document.getElementById("x-setup").addEventListener("click", toSetup);
  }

  window.FBExplore = { mount: draw, FEATURES: FEATURES };
})();

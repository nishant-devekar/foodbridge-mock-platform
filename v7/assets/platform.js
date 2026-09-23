/*
  FoodBridge mock platform — the shell.

  What this is: a nav shell that makes ten independently-built module mockups,
  published by six different people on their own GitHub Pages sites, behave like
  one application. It owns the sidebar, the routing and the active state; each
  module is loaded in an iframe from its own live URL.

  Nothing is copied. Every destination is fetched from the owning team's site at
  view time, so when they push, this reflects it on the next load.

  Sidebar and header markup is copied class-for-class from the storefront-frontend
  port (src/layout/*, src/components/sidebar/*, src/components/header/*), which was
  itself verified against the running app.

  Routing is hash-based — #/sales-orders, #/inventory/raw-material-inventory — so
  every module is a real, shareable URL and browser back/forward work.
*/
(function () {
  "use strict";

  var icon = function (name, cls, size, style) {
    return window.MockIcons ? window.MockIcons.get(name, cls, size, style) : "";
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var BAG_ICON =
    "data:image/svg+xml,%3csvg%20width='16'%20height='19'%20viewBox='0%200%2016%2019'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M12.5714%205.71429V4.57143C12.5714%202.05071%2010.5207%200%208%200C5.47929%200%203.42857%202.05071%203.42857%204.57143V5.71429H0V15.4286C0%2017.0065%201.27918%2018.2857%202.85714%2018.2857H13.1429C14.7208%2018.2857%2016%2017.0065%2016%2015.4286V5.71429H12.5714ZM5.71429%204.57143C5.71429%203.31107%206.73964%202.28571%208%202.28571C9.26036%202.28571%2010.2857%203.31107%2010.2857%204.57143V5.71429H5.71429V4.57143ZM11.4286%208.85714C10.9552%208.85714%2010.5714%208.47339%2010.5714%208C10.5714%207.52661%2010.9552%207.14286%2011.4286%207.14286C11.902%207.14286%2012.2857%207.52661%2012.2857%208C12.2857%208.47339%2011.902%208.85714%2011.4286%208.85714ZM4.57143%208.85714C4.09804%208.85714%203.71429%208.47339%203.71429%208C3.71429%207.52661%204.09804%207.14286%204.57143%207.14286C5.04482%207.14286%205.42857%207.52661%205.42857%208C5.42857%208.47339%205.04482%208.85714%204.57143%208.85714Z'%20fill='%2310B981'/%3e%3c/svg%3e";

  // This script's own ?v= token, reused to cache-bust modules.json (see mount).
  // Read here, at load time: document.currentScript is only set while the
  // script executes synchronously, and is null by the time mount() runs.
  var BUILD = (function () {
    var s = document.currentScript;
    return s ? (s.src.split("?v=")[1] || "") : "";
  })();

  var state = {
    config: null,
    routes: {},   // "group/leaf" or "leaf" -> destination
    order: [],    // route keys, in sidebar order
    landing: null, // where a bare URL lands, when it is not order[0]
    current: null,
    currentUrl: null,
    rootEl: null,
    openGroups: {},
    // Sidebar collapse was removed — the sidebar always stays expanded.
    sidebarCollapsed: false,
    mobileNavOpen: false,
  };

  /* A module may ship a phone-specific screen (urlMobile). Below this width we
     load it instead of the desktop url, and swap live when the width crosses.
     Aligned with the lg breakpoint where the platform switches to its mobile
     chrome (header + clip offsets), so url and chrome change together. */
  var mobileMQ = window.matchMedia("(max-width: 1023.98px)");

  /* One gate, read by BOTH buildRoutes and the sidebar. If they each filtered
     separately they would eventually disagree, and a hidden route would still be
     reachable by hash — the nav would say a distributor has no Production while
     #/production/batch-management quietly still worked. */
  function forPersona(node) {
    return !node.personas || node.personas.indexOf(state.persona) !== -1;
  }

  function personaNav(config) {
    return (config.nav || []).filter(forPersona).map(function (g) {
      if (!g.submenus) return g;
      var kids = g.submenus.filter(forPersona);
      return kids.length ? Object.assign({}, g, { submenus: kids }) : null;
    }).filter(Boolean);   // a group whose children are all hidden disappears too
  }

  function pickUrl(leaf) {
    return leaf.urlMobile && mobileMQ.matches ? leaf.urlMobile : leaf.url;
  }

  /* A VIEW INSIDE A DESTINATION, addressed from outside.

     `#/retails-overview?view=purchases` opens the storefront on its Purchases
     tab. The storefront already honours its own `#purchases` / `#help` /
     `#shop` fragment; the shell simply hands `view` through as that fragment,
     because a module reads its OWN location, never the shell's.

     This is what lets a WhatsApp row say "My orders" and mean it — without it
     every storefront link lands on the shop's front page, and "My orders"
     becomes a promise the next screen breaks. A leaf URL that already carries
     a fragment is left alone. */
  function withView(url) {
    var h = location.hash || "";
    var q = h.indexOf("?");
    if (q === -1) return url;
    var view = new URLSearchParams(h.slice(q + 1)).get("view");
    if (!view || !/^[a-z][a-z0-9-]*$/i.test(view) || url.indexOf("#") !== -1) return url;
    return url + "#" + view;
  }

  /* ── Routes ───────────────────────────────────────────────────────────────  /* ── Routes ───────────────────────────────────────────────────────────────
     A destination is addressed by its own id for top-level items, and by
     "group/leaf" for nested ones. Ids come from modules.json, so the URL stays
     readable: #/inventory/raw-material-inventory. */
  function buildRoutes(config) {
    var routes = {};
    var order = [];
    personaNav(config).forEach(function (group) {
      if (group.submenus) {
        group.submenus.forEach(function (leaf) {
          var key = group.id + "/" + leaf.id;
          routes[key] = { leaf: leaf, group: group, key: key };
          order.push(key);
        });
      } else {
        routes[group.id] = { leaf: group, group: null, key: group.id };
        order.push(group.id);
      }
    });
    // Standalone destinations are addressable by #/<id> (e.g. the storefront,
    // reached via the Store QR) but are deliberately absent from `order`, so
    // they never become the default landing or appear in the sidebar.
    (config.standalone || []).forEach(function (leaf) {
      routes[leaf.id] = { leaf: leaf, group: null, key: leaf.id };
    });
    /* A nested destination is also reachable by its own id, and by any
       `aliases` it lists -- so moving a page into a group does not break the
       links already pointing at it (#/control-tower from onboarding, the exit
       sheet and the WhatsApp tree; #/dashboard from before Reports was
       renamed). Never shadows a real route, and an id two groups share
       resolves to neither. */
    var aliases = {}, clash = {};
    Object.keys(routes).forEach(function (key) {
      var r = routes[key];
      if (!r.group) return;
      [r.leaf.id].concat(r.leaf.aliases || []).forEach(function (a) {
        if (routes[a]) return;
        if (aliases[a] && aliases[a] !== key) clash[a] = true;
        aliases[a] = key;
      });
    });
    Object.keys(clash).forEach(function (a) { delete aliases[a]; });
    return { routes: routes, order: order, aliases: aliases };
  }

  /* Falling back silently was not enough: asking for a hidden route left the
     bogus hash in the address bar while a different screen rendered, so the URL
     lied about what you were looking at. Rewrite it to what actually loaded. */
  /* `landing` exists because the sidebar's first entry is not always where a
     version wants a visitor to arrive. v5 is testing the first session after
     signing up, and the shell's own default — the dashboard — shows a
     populated business to somebody who is supposed to have just created an
     empty account. A standalone destination can therefore claim the bare URL
     without joining the sidebar, which is the whole reason it is standalone. */
  /* A destination may carry a one-time result after its route, e.g. onboarding's
     return from Zoho: #/onboarding?zoho=connected&… . The route is the part
     before "?", and the result is left in place for the module to read and
     clear — rewriting the hash here would destroy it before the iframe loads. */
  function routeFromHash() {
    var raw = (location.hash || "").replace(/^#\/?/, "");
    var h = raw.split("?")[0];
    if (state.routes[h]) return h;
    /* An old address for a page that now lives in a group: rewrite it to the
       page's own route, keeping any one-time result after the "?". */
    if (state.aliases && state.aliases[h]) {
      var q = raw.indexOf("?") === -1 ? "" : raw.slice(raw.indexOf("?"));
      location.replace("#/" + state.aliases[h] + q);
      return state.aliases[h];
    }
    var fallback = (state.landing && state.routes[state.landing]) ? state.landing : state.order[0];
    if (h && fallback) location.replace("#/" + fallback);
    return fallback;
  }

  /* WHOSE BUSINESS THIS IS.

     The seed names the store "QA store" and the user "Mahesh · Admin". Fine
     for a QA walkthrough; wrong in front of anyone else. A person who signed
     up would finish onboarding and find themselves in somebody else's shop,
     and a person just looking around would be shown what reads as a test
     account — the moment a demo stops being believable.

     So there are exactly two identities:

       · A REAL ACCOUNT — the name and business onboarding wrote, as Owner.
       · ANYONE ELSE — a guest session, or no session at all, which is what a
         WhatsApp "pick a feature" link opens with. They are looking at a demo
         store, so it says so: "Sample Distributors", the name the sample-data
         channel already uses, and "Demo store" where a user's name would go.
         Real records, shown as a demo — nothing invented, nothing pretended.

     The seed's own brand and user are never shown. */
  var DEMO_IDENTITY = { store: "Sample Distributors", name: "Demo store", role: "" };

  function identity() {
    var acct = null;
    try {
      var raw = sessionStorage.getItem("fb.v7.guest") || localStorage.getItem("fb.v7.account");
      if (raw) acct = JSON.parse(raw);
    } catch (e) { /* unreadable storage is just no account */ }

    if (!acct || acct.guest) return DEMO_IDENTITY;
    return {
      /* An account whose owner skipped the optional business name still has a
         store — theirs, unnamed — not the seed's and not the demo's. */
      store: acct.business || "Your business",
      name: acct.name || "",
      role: "Owner",
    };
  }

  /* ── Sidebar ─────────────────────────────────────────────────────────────
     SidebarContent.jsx. Class strings are verbatim from the port. */
  /* The business-type picker sits under the store name because that is what it
     is — a property of the tenant, not a filter the user applies to a list. It
     changes what the platform HAS, so it belongs with the tenant's identity. */
  function renderStoreSelector(config) {
    var name = esc(identity(config).store);
    var list = config.personas || [];
    var cur = list.filter(function (p) { return p.id === state.persona; })[0];
    return (
      '<div class="relative w-full">' +
      '<div class="flex items-center gap-3 px-1 py-1.5 rounded-md transition-colors cursor-default">' +
      '<a href="#/" class="flex-shrink-0"><img src="' + BAG_ICON + '" alt="Storefront Logo" class="w-7 h-7" /></a>' +
      '<div class="flex flex-col min-w-0 flex-1">' +
      '<span class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight" data-id-store title="' + name + '">' + name + "</span>" +
      (list.length
        ? '<span class="relative mt-0.5 block">' +
          // autocomplete=off or the browser restores the previous value across a
          // reload, leaving the control showing one business while the platform
          // is filtered for the other
          '<select data-persona aria-label="Business type" autocomplete="off" ' +
            'class="w-full cursor-pointer appearance-none truncate rounded bg-transparent py-0 pl-0 pr-4 ' +
            'text-[11px] font-medium leading-tight text-green-700 hover:text-green-800 focus:outline-none">' +
            list.map(function (p) {
              return '<option value="' + esc(p.id) + '"' + (p.id === state.persona ? " selected" : "") + ">" +
                esc(p.name) + "</option>";
            }).join("") +
          "</select>" +
          '<span class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-green-700">' +
            icon("chevronDown", "h-3 w-3") + "</span>" +
        "</span>" +
        (cur ? '<span class="sr-only">' + esc(cur.blurb) + "</span>" : "")
        : "") +
      "</div></div></div>"
    );
  }

  function renderLeaf(group, leaf) {
    var key = group ? group.id + "/" + leaf.id : leaf.id;
    var active = key === state.current;
    return (
      "<li>" +
      '<a href="#/' + key + '" data-route="' + key + '" ' +
      'class="flex items-center px-3 py-1 rounded transition-colors ' +
      (active ? "text-green-700 bg-green-100" : "hover:text-gray-600 hover:bg-gray-100") +
      '">' +
      icon("minus", "mr-1 h-3 w-3") +
      esc(leaf.name) +
      "</a></li>"
    );
  }

  function renderGroup(group) {
    var childActive = (group.submenus || []).some(function (leaf) {
      return group.id + "/" + leaf.id === state.current;
    });
    // Live default is useState(true); a group stays open once the user opens it.
    var open = state.openGroups[group.id];
    if (open === undefined) open = true;

    var children = group.submenus
      .map(function (leaf) {
        return renderLeaf(group, leaf);
      })
      .join("");

    return (
      '<li class="relative gap-y-1 rounded-md transition-colors group" data-submenu>' +
      '<button type="button" data-submenu-toggle="' + group.id + '" ' +
      'class="w-full flex justify-between items-center gap-3 px-3 py-2 rounded-lg text-left text-gray-600 hover:bg-gray-100 ' +
      (childActive
        ? "text-green-700 bg-green-50"
        : "text-gray-700 dark:text-gray-300 hover:text-green-600 hover:bg-gray-100") +
      '">' +
      '<span class="inline-flex items-center">' +
      icon(group.icon, "w-5 h-5") +
      '<span class="ml-4">' + esc(group.name) + "</span>" +
      "</span>" +
      '<span class="pl-4 text-xs">' +
      (open ? icon("chevronUp", "h-4 w-4") : icon("chevronDown", "h-4 w-4")) +
      "</span></button>" +
      '<ul class="ml-8 mt-1 space-y-1 overflow-hidden text-sm text-gray-600 dark:text-gray-400 rounded-md" ' +
      'aria-label="submenu"' + (open ? "" : " hidden") + ">" +
      children +
      "</ul></li>"
    );
  }

  function renderTopLevel(item) {
    var active = item.id === state.current;
    return (
      '<li class="relative gap-y-1">' +
      '<a href="#/' + item.id + '" data-route="' + item.id + '" ' +
      'class="text-md transition-colors duration-150 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left ' +
      (active ? "text-green-700 bg-green-50" : "text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200") +
      '">' +
      icon(item.icon, "w-5 h-5") +
      "<span>" + esc(item.name) + "</span>" +
      "</a></li>"
    );
  }

  // The real app pins Store QR Code (and Route Delivery) below the scrolling
  // nav. We mirror the pinned Store QR Code — a footer that stays put while the
  // list scrolls, opening the QR modal.
  function renderSidebarFooter(config) {
    if (!config.storeQr) return "";
    var q = config.storeQr;
    return (
      '<div class="fb-sidebar-footer">' +
      '<button type="button" data-store-qr ' +
      'class="text-md w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-gray-600 hover:text-green-600 hover:bg-gray-100">' +
      icon("qrCode", "w-5 h-5") +
      "<span>" + esc(q.label || "Store QR Code") + "</span>" +
      "</button></div>"
    );
  }

  function renderSidebarContent(config) {
    var items = personaNav(config)
      .map(function (item) {
        return item.submenus ? renderGroup(item) : renderTopLevel(item);
      })
      .join("");

    return (
      '<div class="pt-0 pb-4 px-3 lg:relative z-40 text-gray-500 dark:text-gray-400 flex flex-col h-full">' +
      '<div class="h-14 flex items-center border-b border-gray-200 dark:border-gray-700 flex-shrink-0 mb-3">' +
      renderStoreSelector(config) +
      "</div>" +
      '<div class="flex-1 overflow-y-auto sidebar-scroll">' +
      '<ul class="mt-2 space-y-2 pb-4">' + items + "</ul>" +
      "</div>" +
      renderSidebarFooter(config) +
      "</div>"
    );
  }

  /* ── Shell ───────────────────────────────────────────────────────────────
     Layout.jsx.
     Desktop: the platform owns the sidebar; the module's own header stays
     visible inside the iframe and serves as the app header (one header).
     Mobile: the module collapses its own chrome, so the platform provides the
     WHOLE QA-store chrome — a single top header (which overlays and hides the
     module's own header) plus the drawer — mirroring the desktop experience.
     There is one header and one sidebar, both the platform's, everywhere. */

  // Mobile-only QA-store header. It is absolutely positioned over the top of the
  // viewport so it covers the module's own header (which sits at the iframe top),
  // leaving exactly one header. The hamburger opens the platform drawer; the
  // brand (bag + store name) mirrors the desktop store selector; the module's own
  // in-content page heading names the screen (so no duplicate title here). The
  // user block mirrors the desktop header.
  function renderMobileHeader(config) {
    var me = identity(config);
    var u = { displayName: me.name, role: me.role };
    var name = esc(me.store);
    return (
      '<header data-mobile-bar class="fb-mhead">' +
      '<button type="button" data-mobile-toggle class="fb-mhead-burger" aria-label="Open menu">' +
      icon("menu", "w-5 h-5") +
      "</button>" +
      '<a href="#/" class="fb-mhead-brand" title="' + name + '">' +
      '<img src="' + BAG_ICON + '" alt="Storefront Logo" />' +
      '<span class="fb-mhead-brand-name" data-id-store>' + name + "</span>" +
      "</a>" +
      '<div class="fb-mhead-user">' +
      '<span class="fb-mhead-user-txt"><span class="nm" data-id-name>' + esc(u.displayName || "") + '</span><span class="rl" data-id-role>' + esc(u.role || "") + "</span></span>" +
      '<span class="fb-mhead-ava">' + icon("user", "w-4 h-4") + "</span>" +
      "</div></header>"
    );
  }

  function renderShell(config) {
    return (
      '<div class="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">' +
      '<aside data-desktop-sidebar ' +
      'class="z-30 flex-shrink-0 hidden shadow-sm overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-800 lg:block ' +
      'transition-[width,border-color] duration-300 ease-in-out w-64 border-r border-gray-200">' +
      renderSidebarContent(config) +
      "</aside>" +

      '<div data-mobile-sidebar hidden>' +
      '<div class="fixed inset-0 z-40 bg-black bg-opacity-50" data-mobile-backdrop></div>' +
      '<aside class="fixed inset-y-0 left-0 z-[10001] flex-shrink-0 w-64 flex flex-col bg-white dark:bg-gray-800 lg:hidden">' +
      renderSidebarContent(config) +
      "</aside></div>" +

      '<div class="flex flex-col flex-1 w-full min-w-0">' +
      '<div class="fb-viewport" data-viewport>' +
      // Each module draws its own hamburger in its header, and in here it is
      // dead: it toggles the module's own sidebar, which the clip has removed.
      // We cannot reach into a cross-origin frame to delete it, so we cover it.
      // Opt-in per module (`hideBurger`), because several modules have none and
      // one of them puts its page title at exactly that x.
      '<button type="button" class="fb-burger-mask" data-burger-mask data-sidebar-toggle hidden aria-label="Toggle sidebar" title="Toggle sidebar">' + icon("menu", "w-5 h-5") + "</button>" +
      renderMobileHeader(config) +
      '<div class="fb-overlay" data-loading><div class="fb-spinner" role="status" aria-label="Loading module"></div></div>' +
      '<div class="fb-overlay" data-error hidden></div>' +
      // allow: delegate device/permissions policies to the cross-origin module
      // frame — without this, camera/mic getUserMedia is blocked inside the iframe
      // (e.g. Image Gallery → Take photos), even though the module page itself is allowed.
      '<iframe data-frame title="Module" referrerpolicy="no-referrer" allow="camera; microphone; fullscreen; clipboard-write"></iframe>' +
      "</div></div></div>" +
      renderQrModal(config)
    );
  }

  /* ── Store QR modal ──────────────────────────────────────────────────────
     Two steps, like the real app: an intro with a Generate button, then the
     rendered QR with Regenerate / Download / Print. The QR encodes a deep link
     to the storefront module (config.storeQr.targetRoute), so a phone that
     scans it opens straight onto the shop. */
  function renderQrModal(config) {
    if (!config.storeQr) return "";
    var q = config.storeQr;
    var brand = esc(identity(config).store || "the store");
    var label = esc(q.label || "Store QR Code");
    return (
      '<div class="fb-modal" data-qr-modal hidden>' +
      '<div class="fb-modal-backdrop" data-qr-close></div>' +
      '<div class="fb-modal-card" role="dialog" aria-modal="true" aria-label="' + label + '">' +
      '<div class="fb-modal-head">' +
      '<span class="fb-qr-badge">' + icon("qrCode", "w-5 h-5") + "</span>" +
      "<div><h2>" + label + "</h2><p>" + esc(q.subtitle || "") + "</p></div>" +
      '<button type="button" class="fb-modal-close" data-qr-close aria-label="Close">' + icon("x", "w-5 h-5") + "</button>" +
      "</div>" +

      '<div class="fb-qr-body">' +
      '<div data-qr-intro>' +
      '<div class="fb-qr-placeholder">' + icon("qrCode", null, 40) + "</div>" +
      '<p class="fb-qr-lead">Generate a QR code for your store</p>' +
      '<p class="fb-qr-sub">Customers scan this QR code to access your store.</p>' +
      '<button type="button" class="fb-btn fb-btn-primary" data-qr-generate>' + icon("qrCode", null, 16) + " Generate QR Code</button>" +
      "</div>" +

      '<div data-qr-result hidden>' +
      '<div class="fb-qr-canvas" data-qr-canvas></div>' +
      '<p class="fb-qr-sub">Customers scan this QR to access <b>' + brand + "</b> and place orders directly.</p>" +
      '<div class="fb-qr-actions">' +
      '<button type="button" class="fb-btn fb-btn-ghost" data-qr-generate>' + icon("refreshCw", null, 16) + " Regenerate</button>" +
      '<button type="button" class="fb-btn fb-btn-ghost" data-qr-download>' + icon("download", null, 16) + " Download</button>" +
      '<button type="button" class="fb-btn fb-btn-primary" data-qr-print>' + icon("printer", null, 16) + " Print</button>" +
      "</div></div>" +
      "</div></div></div>"
    );
  }

  /* ── Module loading ────────────────────────────────────────────────────── */
  var loadTimer = null;

  /* THE WAY OUT, and who draws it.

     The shell mounts one exit bar for every destination — it used to sit on
     five of twenty-six, so finishing onboarding or opening the dashboard left
     a user stranded with no route back to the chat.

     One module still draws its own: Raw Material Inventory passes a Receive
     Stock tab through the bar, and suppressing the bar would take the control
     with it. Two bars at the same bottom edge would stack, so whoever is
     framed wins and the shell stands its own down for that destination. */
  /* ── EXIT DEMO where the destination already has a footer ──────────────
     A module with its own bottom bar was getting a second one over it
     (owner, 23 Sep 2026: "if a footer was already there, EXIT DEMO should be
     one of its actions"). `exitIn` in modules.json names that bar; the
     button is CLONED from one of the bar's own, so it wears the module's
     styling, and it is dropped beside it. Same-origin only, and only while
     that bar is on screen — most are phone-only, and above their breakpoint
     the platform's own bar comes back.

     The module's folder is never touched: this is platform-side, like the
     clip offsets and the device frame. */
  var exitWatch = null, exitWatcher = null;
  var EXIT_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>';
  /* ── The lever's own actions, carried into the work screens ────────────
     The Deliveries lever opens the four Distribution & Logistics screens
     from its own footer, as plain footer actions (owner, 23 Sep 2026: "just
     like Tower, Timeline, Assistant"). A screen opened that way carries
     `from=<lever>` in the hash, and gets THAT LEVER'S OWN ACTIONS in its own
     bottom bar, in front of its EXIT DEMO — so the way back to the tower,
     and to the other three screens, is always under the thumb. They plus the
     screen's own actions do not fit a phone, so that bar scrolls sideways;
     nothing is dropped (owner's pick, 23 Sep 2026).

     Screens with no bar of their own (Logistic Returns) get them in the
     platform's bar instead. Nothing changes for a screen reached from
     the sidebar: no `from=`, no extra actions. */
  /* Shape only: the bar's stylesheet gives every icon in the row its size,
     weight and colour. */
  function ico(d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>"; }
  /* The assistant's own face. Only what CSS cannot say — the image and its
     framing — is inline; its size comes from the bar's stylesheet, with
     every other icon's. */
  var MASCOT = '<i style="border-radius:50%;background:#fff no-repeat 33% 0/155% url(assets/ct/mascot/hello-128.png);box-shadow:0 0 0 1px rgba(17,20,24,.1)"></i>';
  var TOWER_ICON = ico('<path d="M4 20V10l8-6 8 6v10"/><path d="M9 20v-6h6v6"/>');
  /* The same list, the same order and the same words as the tower's own
     footer on that lever (screens/control-tower.js, WORK): the bar reads the
     same on both sides of the trip. No Timeline — the business's news is
     offered from the tower's home, not from a lever (owner, 23 Sep 2026). */
  var TRIP = {
    deliveries: {
      group: "distribution-logistics",
      tabs: [
        { id: "tower", label: "Tower", icon: TOWER_ICON, hash: "#/control-tower?lever=deliveries" },
        { id: "live-tracking", label: "Tracking", icon: ico('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>') },
        { id: "delivery-management", label: "Delivery", icon: ico('<rect width="12" height="20" x="6" y="2" rx="2"/><path d="M11 18h2"/>') },
        { id: "route-planning", label: "Planning", icon: ico('<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>') },
        /* "Assets", not "Returns": what the screen itself is about — asset
           movement, asset inventory, the assets (owner, 23 Sep 2026). */
        { id: "logistic-returns", label: "Assets", icon: ico('<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12M3.3 7l8.7 5 8.7-5"/>') },
        /* The assistant's own face, framed as the tower frames it, and next
           to EXIT DEMO wherever it appears (owner, 23 Sep 2026). */
        { id: "assistant", label: "Assistant", icon: MASCOT, hash: "#/control-tower?lever=deliveries&chat=1" },
      ],
    },
  };
  function fromLever() {
    var raw = location.hash || "";
    var i = raw.indexOf("?");
    if (i === -1) return null;
    var v = new URLSearchParams(raw.slice(i + 1)).get("from");
    return TRIP[v] ? v : null;
  }

  function exitInOwnFooter(frame, leaf) {
    /* `barIn` names a bar that already carries its own EXIT DEMO (Delivery
       Management draws one). Nothing is added to it — it is named so a trip
       can stand it down and put its own bar there instead. */
    var sel = leaf && (leaf.exitIn || leaf.barIn);
    if (!sel) return false;
    var doc;
    try { doc = frame.contentDocument; } catch (e) { return false; }      // cross-origin: cannot reach in
    if (!doc || !doc.body) return false;
    var bar = doc.querySelector(sel);
    /* Visible, not "laid out": these bars are position:fixed, and a fixed
       element has no offsetParent — which read as hidden and cost an hour. */
    var cs = bar && frame.contentWindow.getComputedStyle(bar);
    var shown = !!bar && cs.display !== "none" && cs.visibility !== "hidden" && bar.getBoundingClientRect().height > 0;
    var had = doc.getElementById("fbx-in");
    if (!shown) { if (had) had.remove(); return false; }                  // its bar is off: ours comes back
    if (!had && leaf.exitIn) barTab(frame, doc, bar, "fbx-in", "EXIT DEMO", EXIT_ARROW, function () { if (window.FB_EXIT) window.FB_EXIT.open(); }, null);
    watchBar(frame, doc, leaf);
    return true;
  }

  /* One of the bar's own buttons, cloned: the label and the icon are ours,
     everything else is the module's — so it wears that module's styling.
     `before` puts it ahead of a button already added (EXIT DEMO stays last). */
  function barTab(frame, doc, bar, id, label, icon, onClick, before) {
    /* Model it on a plain sibling, never the bar's main action: EXIT DEMO
       never takes the active colour (the footer spec). */
    var kids = Array.prototype.slice.call(bar.querySelectorAll("button, a"));
    var plain = kids.filter(function (b) {
      return b.id.indexOf("fbx-") !== 0 &&
        !/primary|accent|cta|create|add|emerald-600|bg-green|is-on|active/i.test(b.className + " " + (b.getAttribute("data-mf") || ""));
    });
    var model = plain[plain.length - 1] || null;
    var btn;
    if (model) btn = model.cloneNode(true);
    else {
      /* Every button in this bar is its main action (Batch Management has
         one): a quiet button of our own rather than a second green one. */
      btn = doc.createElement("button");
      btn.style.cssText = "display:flex;align-items:center;justify-content:center;gap:8px;flex:1;min-height:44px;padding:0 14px;" +
        "border:1px solid #e5e7eb;border-radius:10px;background:#fff;color:#6b7280;font:600 14px/1.2 inherit;cursor:pointer";
      btn.innerHTML = icon.replace("<svg", '<svg width="18" height="18"');
      btn.appendChild(doc.createTextNode(label));
    }
    /* A clone carries the module's own handlers' hooks and its selected
       state; strip both, so it is only ever our way out. */
    Array.prototype.slice.call(btn.attributes || []).forEach(function (a) {
      if (a.name.indexOf("data-") === 0 || a.name === "href" || a.name === "id" || a.name === "title" || a.name === "aria-current") btn.removeAttribute(a.name);
    });
    btn.className = String(btn.className || "").split(/\s+/).filter(function (c) {
      return c && !/^(is-)?(active|primary|selected|current|on)$/.test(c);
    }).join(" ");
    var svg = model ? btn.querySelector("svg") : null;
    if (!model) { /* already built */ }
    else if (svg) svg.outerHTML = icon.replace("<svg", '<svg class="' + (svg.getAttribute("class") || "") + '" width="' + (svg.getAttribute("width") || 22) + '" height="' + (svg.getAttribute("height") || 22) + '"');
    else if (model) btn.insertAdjacentHTML("afterbegin", icon);
    /* The label: the first text the clone shows, so it keeps the module's
       own type and spacing. */
    if (model) {
      var walker = doc.createTreeWalker(btn, 4 /* text nodes */), first = null, n;
      while ((n = walker.nextNode())) { if (String(n.nodeValue).trim()) { if (!first) { first = n; n.nodeValue = label; } else n.nodeValue = ""; } }
      if (!first) btn.appendChild(doc.createTextNode(label));
    }
    btn.id = id;
    btn.setAttribute("type", "button");
    btn.setAttribute("aria-label", label);
    /* Capture, and stop there: these bars answer clicks by delegation, and
       the module should never see this one. */
    btn.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      onClick();
    }, true);
    var host = (model && model.parentElement ? model.parentElement : bar);
    if (before && before.parentElement === host) host.insertBefore(btn, before);
    else host.appendChild(btn);
    return btn;
  }

  /* A module that redraws its own bar (Live Tracking does, as pings come in;
     Delivery Management redraws on every tap) throws our buttons away with
     it: put them back when that happens. */
  function watchBar(frame, doc, leaf) {
    if (exitWatcher) exitWatcher.disconnect();
    exitWatcher = new frame.contentWindow.MutationObserver(function () {
      var missing = (leaf.exitIn && !doc.getElementById("fbx-in")) || (fromLever() && !doc.getElementById("fbx-t-tower"));
      if (missing) exitInOwnFooter(frame, leaf);
    });
    exitWatcher.observe(doc.body, { childList: true, subtree: true });
  }

  function deferToFramedExitBar(frame, leaf) {
    if (exitWatcher) { exitWatcher.disconnect(); exitWatcher = null; }     // the last destination's
    if (tripWatcher) { tripWatcher.disconnect(); tripWatcher = null; }     // watched the last document
    tripSig = null; tripOpen = true;                                       // every screen opens with its own controls out
    var own = document.getElementById("fbx-foot");
    if (!own) return;
    var framed = false;
    try { framed = !!frame.contentDocument.getElementById("fbx-foot"); }
    catch (e) { framed = false; }          // cross-origin: assume it has none

    /* `noExitBar` in modules.json: a destination that should not carry the way
       out at all. Onboarding is the one — it is somebody setting their business
       up, not looking around, and a bar offering to leave and rate the demo
       argues against the thing they are in the middle of. The flow has its own
       ways out (its Back, and "Have a look around first" on the first screen),
       so nobody is trapped, and the bar returns the moment they leave it. */
    /* `ownExitBar`: the destination draws its own tab bar with EXIT DEMO in
       it, but not as #fbx-foot, so the check above cannot see it. Delivery
       Management is the one: its Home · Routes · Follow-up · Reports · EXIT
       DEMO bar was being covered by this one on a phone. */
    /* A trip first: on the way from a lever this bar IS the bar, the
       module's own is stood down, and nothing is injected into it. */
    if (tripBar(frame, leaf)) { own.hidden = false; setFrameInsets(frame); return; }
    var inBar = exitInOwnFooter(frame, leaf);
    var hide = framed || !!(leaf && (leaf.noExitBar || leaf.ownExitBar)) || !!(leaf && leaf.exitIn && inBar);
    own.hidden = hide;
    /* Some bars are drawn by the module's own script after load (Sales
       Orders, Workforce), and two of these are a redirect away (Route
       Planning, Live Tracking): look again for a moment rather than leaving
       two bars on screen, or no way back. Stops as soon as it lands, or when
       the frame moves on. */
    if (leaf && (leaf.exitIn || leaf.barIn) && !inBar) {
      clearInterval(exitWatch);
      var url = state.currentUrl, tries = 0;
      exitWatch = setInterval(function () {
        if (++tries > 20 || state.currentUrl !== url) return clearInterval(exitWatch);
        if (!exitInOwnFooter(frame, leaf)) return;
        if (leaf.exitIn) own.hidden = true;
        clearInterval(exitWatch);
      }, 150);
    }
    setFrameInsets(frame);
    /* No body padding, ever, in the shell — it mounts with `pad: false` and
       this used to put the class straight back on the next navigation. The
       shell's content is a full-height frame: 58px of padding shrinks nothing
       and only makes this page taller than the window, so the whole app gains
       a stray scroll over a white strip. Framed screens keep their own room. */
  }

  /* ── A trip takes the bar over ─────────────────────────────────────────
     On the way from a lever, every screen of the trip wears THE SAME BAR —
     the platform's own, the one the Control Tower has (owner, 23 Sep 2026:
     "all the delivery footers should look identical… it looks like I have
     come to some other page"). The module's own bar is stood down for as
     long as the owner is on the trip, and its actions are carried across as
     tabs of ours, so the screen still does everything it did: same type,
     same 22px icons, same 10px labels, one row that scrolls.

     Nothing in the module's folder changes, and nothing is injected into its
     bar: one stylesheet in its document stands the bar down, exactly as the
     clip offsets are set on its frame. Leave the trip and the bar comes
     straight back. */
  var tripWatcher = null, tripSig = null;
  function tripBar(frame, leaf) {
    var lv = fromLever(), trip = lv && TRIP[lv];
    var foot = document.getElementById("fbx-foot");
    if (!foot) return false;
    /* A big screen has no bar of ours to put anything in, and the phone app
       in its device frame still needs its own. */
    if (!trip || window.innerWidth >= 1024) { tripOff(frame); return false; }
    ownBarOff(frame, leaf, true);
    drawTripBar(frame, leaf, lv, trip, foot);
    watchTrip(frame, leaf, lv, trip, foot);
    return true;
  }
  function tripOff(frame) {
    if (tripWatcher) { tripWatcher.disconnect(); tripWatcher = null; }
    tripSig = null; tripOpen = false;
    var foot = document.getElementById("fbx-foot");
    if (foot) {
      Array.prototype.slice.call(foot.querySelectorAll('[id^="fbx-t-"],.fbx-group')).forEach(function (b) { b.remove(); });
      foot.classList.remove("is-wide");
    }
    ownBarOff(frame, null, false);
  }
  function ownBarOff(frame, leaf, off) {
    var doc;
    try { doc = frame.contentDocument; } catch (e) { return; }
    if (!doc || !doc.head) return;
    var st = doc.getElementById("fbx-standdown");
    var sel = leaf && (leaf.exitIn || leaf.barIn);
    if (!off || !sel) { if (st) st.remove(); return; }
    if (!st) { st = doc.createElement("style"); st.id = "fbx-standdown"; doc.head.appendChild(st); }
    /* Only when it actually changes: rewriting it is itself a change to the
       document, which the observer below would hear and answer for ever. */
    var css = sel + "{display:none!important}";
    /* `padIn` in modules.json: a screen whose own scroller has to keep room
       for what the platform puts at the foot of the page, now that its own
       bar is not there to do it. It reads the inset the shell measured, so
       there is no number to keep in step. */
    if (leaf.padIn) css += leaf.padIn + "{padding-bottom:var(--fb-bottom-inset,0px)!important}";
    if (st.textContent !== css) st.textContent = css;
  }
  /* The screen's own actions, said in our words: its label, its icon, its
     click — the module's handler is called by clicking its own button, so
     nothing of its behaviour is re-implemented here. */
  function ownActions(frame, leaf) {
    var doc, sel = leaf && (leaf.exitIn || leaf.barIn);
    try { doc = frame.contentDocument; } catch (e) { return []; }
    var bar = doc && sel && doc.querySelector(sel);
    if (!bar) return [];
    return Array.prototype.slice.call(bar.querySelectorAll("button, a")).map(function (el, i) {
      var texts = [], w = doc.createTreeWalker(el, 4 /* text nodes */), n;
      while ((n = w.nextNode())) { var t = String(n.nodeValue).replace(/\s+/g, " ").trim(); if (t) texts.push(t); }
      var label = texts[texts.length - 1] || "";
      var svg = el.querySelector("svg");
      var glyph = !svg && texts.length > 1 ? texts[0] : null;             // an emoji tab (Delivery Management)
      return { at: i, label: label, svg: svg, glyph: glyph, on: isOn(frame, el) };
    }).filter(function (a) { return a.label && !/^exit demo$/i.test(a.label); });
  }
  /* Which of a screen's own controls it is showing right now — the module
     says so in its own bar, and the group says it back in ours. A module
     marks it as an attribute, as a class, or (Delivery Management) simply by
     colouring that label: grey for the ones it is not on, its own colour for
     the one it is. Saturation tells those two apart without knowing any
     module's palette. */
  function isOn(frame, el) {
    if (el.getAttribute("aria-current") || el.getAttribute("aria-selected") === "true") return true;
    if (/(^|[\s-])(active|selected|current)([\s-]|$)/i.test(el.className || "")) return true;
    /* A main action is coloured because it is the main action, not because
       the screen is on it: Live Tracking's Routes and Route Planning's Add
       Template are green at rest. Those are marked by what they open, not
       by their colour. */
    if (/primary|accent|cta/i.test(el.className || "")) return false;
    try {
      var win = frame.contentWindow;
      /* Any part of it, not the first: the label that carries the colour can
         sit under an icon that does not. */
      return [el].concat(Array.prototype.slice.call(el.querySelectorAll("*"))).some(function (n) {
        var m = /(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(win.getComputedStyle(n).color || "");
        if (!m) return false;
        var r = +m[1], g = +m[2], b = +m[3], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        return mx > 0 && (mx - mn) / mx > 0.12;
      });
    } catch (e) { return false; }
  }

  /* A control is also the one the owner is on while the thing it opened is
     on screen — Routes with its route list up, Add Template with its form
     open. Any panel over the page counts, found the way anyone would find
     it: a dialog, or a drawer or sheet that is not parked off-screen. */
  var tripPressed = null;
  function panelOpen(frame) {
    var doc, win;
    try { doc = frame.contentDocument; win = frame.contentWindow; } catch (e) { return false; }
    if (!doc || !doc.body) return false;
    var nodes = doc.querySelectorAll('[role="dialog"],[aria-modal="true"],.drawer,.sheet-scrim,.modal-scrim');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i], cs = win.getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) continue;
      var r = n.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) continue;
      if (r.right <= 4 || r.bottom <= 4 || r.left >= win.innerWidth - 4 || r.top >= win.innerHeight - 4) continue;
      return true;                                                        // closed panels are parked outside
    }
    return false;
  }

  /* Back to the top of the screen the owner is on, three ways, in the order
     that disturbs it least: its own Home if its bar is up; its own address
     if it routes by one (Delivery Management does — deep in a route there is
     no bar to press, and clearing the hash is exactly what its Home does);
     otherwise load it again. */
  function goHomeIn(frame, leaf) {
    var a = ownActions(frame, leaf).filter(function (x) { return /^home$/i.test(x.label); })[0];
    var btn = a ? ownButton(frame, leaf, a.at) : null;
    if (btn) return btn.click();
    try {
      var cw = frame.contentWindow;
      if (cw.location.hash && cw.location.hash !== "#") { cw.location.hash = ""; return; }
    } catch (e) { /* cross-origin: the reload below is the only way */ }
    loadModule(state.current);
  }
  /* The nth button of the screen's own bar, as it stands right now. */
  function ownButton(frame, leaf, at) {
    var doc, sel = leaf && (leaf.exitIn || leaf.barIn);
    try { doc = frame.contentDocument; } catch (e) { return null; }
    var bar = doc && sel && doc.querySelector(sel);
    return bar ? bar.querySelectorAll("button, a")[at] || null : null;
  }
  /* ── The screen you are on holds its own controls (owner, 23 Sep 2026) ──
     One row, and a rule the owner can say in a sentence: **Tower first, the
     screen you are on second, and its own controls live inside it.** The
     second slot is always the same thing — where you are, in green — so
     nothing appears or disappears where a tab used to be. When that screen
     has controls of its own it carries a caret; tapping it opens them to the
     right, in place, and tapping it again closes them. The rest of the trip
     follows, then the assistant, then EXIT DEMO.

     So a tab is still a place, and a verb only ever shows up inside the
     place it belongs to. */
  /* Open by default (owner, 23 Sep 2026): the screen's own controls are the
     reason the owner came to this screen, so they are there without a tap.
     The caret closes them when the row is in the way. */
  var tripOpen = true;
  function drawTripBar(frame, leaf, lv, trip, foot) {
    var own = ownActions(frame, leaf), up = panelOpen(frame);
    own.forEach(function (a) { a.on = a.on || (a.label === tripPressed && up); });
    var here = state.current && state.routes[state.current] ? state.routes[state.current].leaf.id : null;
    /* The mark moves with the screen, so which one it is on is part of what
       tells this row to be redrawn. */
    var sig = here + "|" + own.map(function (a) { return a.label + (a.on ? "*" : ""); }).join("|") + "|" + tripOpen;
    if (sig === tripSig) return;                                          // the same bar: leave it alone
    tripSig = sig;
    Array.prototype.slice.call(foot.querySelectorAll('[id^="fbx-t-"],.fbx-group')).forEach(function (b) { b.remove(); });
    foot.classList.add("is-wide");
    var exit = document.getElementById("fbx-exit");
    var mine = trip.tabs.filter(function (t) { return t.id === here; })[0];

    trip.tabs.filter(function (t) { return t.id === "tower"; }).forEach(function (t) { foot.insertBefore(tripTab(t), exit); });
    /* The screen the owner is on, and what it can do, in one group: a
       parent and its children have to look like one thing. */
    if (mine) {
      var group = document.createElement("div");
      group.className = "fbx-group";
      group.appendChild(tripTab(mine));
      if (tripOpen) own.forEach(function (a, i) { group.appendChild(doTab(frame, leaf, a, i)); });
      foot.insertBefore(group, exit);
    }
    trip.tabs.filter(function (t) { return t.id !== "tower" && t.id !== "assistant" && t !== mine; })
      .forEach(function (t) { foot.insertBefore(tripTab(t), exit); });
    trip.tabs.filter(function (t) { return t.id === "assistant"; }).forEach(function (t) { foot.insertBefore(tripTab(t), exit); });
    /* From the start of the row, and again after layout: replacing the row's
       children leaves the old scroll offset behind. */
    foot.scrollLeft = 0;
    requestAnimationFrame(function () { foot.scrollLeft = 0; });

    function tripTab(t) {
      var is = t.id === here;
      var opens = is && own.length > 0;
      var icon = t.icon;
      /* The screen you are on: its controls open inside it. With none to
         open, tapping it takes you to the top of it — the way a tab bar
         behaves everywhere ("tapping Delivery lands on delivery home every
         time"), however deep in the app you are. */
      var btn = tab("fbx-t-" + t.id, icon, t.label,
        opens ? function () { tripOpen = !tripOpen; tripSig = null; drawTripBar(frame, leaf, lv, trip, foot); }
          : is ? function () { goHomeIn(frame, leaf); }
          : function () { location.hash = t.hash || ("#/" + trip.group + "/" + t.id + "?from=" + lv); });
      if (is) btn.setAttribute("aria-current", "page");
      if (opens) {
        btn.setAttribute("aria-expanded", tripOpen ? "true" : "false");
        btn.classList.add("fbx-opens");
        /* Drawn, not typed: a glyph in the label reads as a typo at 10px. */
        btn.querySelector("span").insertAdjacentHTML("beforeend",
          '<svg class="fbx-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>');
      }
      return btn;
    }
  }

  /* One of the screen's own controls, shown inside its tab when that tab is
     open: the bar's own shape — icon over a label — on a tinted ground, so
     the group reads as one thing that came out of the tab beside it. */
  function doTab(frame, leaf, a, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.id = "fbx-t-own" + i;
    b.className = "fbx-tab fbx-do" + (a.on ? " is-on" : "");
    var icon = "";
    if (a.svg) {
      /* The screen's own icon, stripped back to its shape: it is then drawn
         at the size, weight and colour every other item in the row has. */
      var c = a.svg.cloneNode(true);
      c.setAttribute("stroke", "currentColor");
      c.removeAttribute("width"); c.removeAttribute("height");
      c.removeAttribute("stroke-width"); c.removeAttribute("class"); c.removeAttribute("style");
      icon = c.outerHTML;
    } else icon = ownIcon(a.label);
    b.innerHTML = icon + "<span>" + esc(a.label) + "</span>";
    /* Looked up again at click time, never held: these bars are redrawn
       (Live Tracking redraws on every ping), and a button kept from the last
       draw is detached — the tap would do nothing. */
    b.addEventListener("click", function () {
      var now = ownActions(frame, leaf).filter(function (x) { return x.label === a.label; })[0] || { at: a.at };
      var el = ownButton(frame, leaf, now.at);
      tripPressed = a.label;                                              // it is on while what it opens is up
      if (el) el.click();
    });
    return b;
  }

  /* A screen's own action that draws its icon as an emoji (Delivery
     Management's 🏠 and 📊) is given a stroked one, so the row is one set of
     icons rather than two. Anything unrecognised gets a plain disc — the
     label is what the owner reads. */
  var OWN_ICONS = [
    [/^home$/i, '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'],
    [/report|summary|stat/i, '<path d="M4 20V10M10 20V4M16 20v-6M21 20H3"/>'],
    [/follow|task/i, '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'],
  ];
  function ownIcon(label) {
    var d = null;
    OWN_ICONS.some(function (r) { if (r[0].test(label || "")) { d = r[1]; return true; } return false; });
    return ico(d || '<circle cx="12" cy="12" r="8"/>');
  }

  /* One tab, exactly as the shared bar draws its own (assets/exit-demo.js):
     an icon over a 10px label. The bar's only colour is on the tab for the
     screen the owner is on. */
  function tab(id, icon, label, onClick) {
    var b = document.createElement("button");
    b.type = "button"; b.id = id; b.className = "fbx-tab";
    b.innerHTML = icon + "<span>" + esc(label) + "</span>";
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }
  /* These bars are drawn by the module's own script, after load and again on
     every redraw (Live Tracking as pings come in, Delivery Management on
     every tap): stand the new one down and read its actions again. */
  function watchTrip(frame, leaf, lv, trip, foot) {
    var doc;
    try { doc = frame.contentDocument; } catch (e) { return; }
    if (!doc || !doc.body || tripWatcher) return;
    var pending = null;
    tripWatcher = new frame.contentWindow.MutationObserver(function () {
      clearTimeout(pending);
      pending = setTimeout(function () {
        if (fromLever() !== lv) return;
        ownBarOff(frame, leaf, true);
        drawTripBar(frame, leaf, lv, trip, foot);
      }, 120);
    });
    tripWatcher.observe(doc.body, { childList: true, subtree: true });
  }

  /* ── How much of the frame the shell is standing on ────────────────────
     Below lg the platform's header sits OVER the top of the frame (that is
     how a module's own header is hidden), and its bar sits over the bottom.
     A module's own fixed panel — Live Tracking's route drawer — knows
     nothing about either, so it draws its header into the band behind ours
     and its foot behind the bar (owner, 23 Sep 2026: "its header is hiding
     behind the header").

     The shell measures both bands and hands them to the frame as
     `--fb-top-inset` / `--fb-bottom-inset`; a panel in there positions
     itself against them and lands exactly in the space the owner can see.
     Nothing changes for a module that ignores them. */
  function setFrameInsets(frame) {
    var doc;
    try { doc = frame.contentDocument; } catch (e) { return; }             // cross-origin: it is on its own
    if (!doc || !doc.documentElement) return;
    var r = frame.getBoundingClientRect();
    var head = document.querySelector("[data-mobile-bar]");
    var hb = head && getComputedStyle(head).display !== "none" ? head.getBoundingClientRect().bottom : 0;
    var bar = document.getElementById("fbx-foot");
    var bh = bar && !bar.hidden && getComputedStyle(bar).display !== "none" ? bar.getBoundingClientRect().height : 0;
    var top = Math.max(0, Math.round(hb - r.top));
    var bottom = Math.max(0, Math.round(r.bottom - (window.innerHeight - bh)));
    var was = doc.documentElement.style.getPropertyValue("--fb-bottom-inset") + "|" + doc.documentElement.style.getPropertyValue("--fb-top-inset");
    doc.documentElement.style.setProperty("--fb-top-inset", top + "px");
    doc.documentElement.style.setProperty("--fb-bottom-inset", bottom + "px");
    /* A page that measures the room it has (Live Tracking sizes its map to
       the screen) hears about it the way it hears about everything else. */
    if (was !== bottom + "px|" + top + "px") {
      try { frame.contentWindow.dispatchEvent(new frame.contentWindow.Event("resize")); } catch (e) { /* not ours to poke */ }
    }
  }

  function showError(dest, reason) {
    var box = document.querySelector("[data-error]");
    box.innerHTML =
      '<div class="max-w-md text-center px-6">' +
      '<div class="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-50 flex items-center justify-center">' +
      icon("alertTriangle", "w-6 h-6 text-amber-600") +
      "</div>" +
      '<h2 class="text-base font-semibold text-gray-800 mb-1">' + esc(dest.leaf.name) + " did not load</h2>" +
      '<p class="text-sm text-gray-500 mb-4">' + esc(reason) + "</p>" +
      '<a href="' + esc(pickUrl(dest.leaf)) + '" target="_blank" rel="noopener noreferrer" ' +
      'class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">' +
      "Open it directly</a>" +
      '<p class="text-xs text-gray-400 mt-4">Owned by <code>' + esc(dest.leaf.owner || "—") + "</code></p>" +
      "</div>";
    box.hidden = false;
    document.querySelector("[data-loading]").hidden = true;
  }

  /* The shell draws who you are once, at mount — but signing up, logging in
     and finishing onboarding all happen inside the frame, without reloading
     the shell. Left alone the header went on saying "Demo store" above a
     control tower that said "Good morning, Shreyas". Every navigation redraws
     it from storage, which is where those flows write the account. */
  function refreshIdentity() {
    var me = identity();
    Array.prototype.forEach.call(document.querySelectorAll("[data-id-store]"), function (el) {
      el.textContent = me.store; el.setAttribute("title", me.store);
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-id-name]"), function (el) { el.textContent = me.name; });
    Array.prototype.forEach.call(document.querySelectorAll("[data-id-role]"), function (el) { el.textContent = me.role; });
  }

  function loadModule(key) {
    var dest = state.routes[key];
    if (!dest) return;
    refreshIdentity();

    var frame = document.querySelector("[data-frame]");
    var viewport = document.querySelector("[data-viewport]");
    var loading = document.querySelector("[data-loading]");
    var error = document.querySelector("[data-error]");

    // Clip offsets. Desktop hides the module's sidebar (clipLeft). Mobile hides
    // the module's own header behind the platform's 56px bar via a vertical
    // offset (56 - mHeaderH), and only clips horizontally for non-responsive
    // modules that keep a sidebar on mobile (clipLeftMobile). Full-bleed skips
    // all of it and fills the window.
    var leaf = dest.leaf;
    var fullBleed = !!leaf.fullBleed;
    var PLATFORM_MHEAD = 56; // keep in sync with .fb-mhead height in platform.css
    var mH = leaf.mHeaderH != null ? leaf.mHeaderH : PLATFORM_MHEAD;
    // Start every module expanded: the sidebar-collapse hamburger lives in the
    // module header, so a collapse must not strand a module whose header can't
    // toggle it back.
    state.sidebarCollapsed = false;
    /* `deviceFrame`: a module that is a PHONE app, not a desktop screen —
       Delivery Management is the route rep's field app. Stretched across a
       1280px window it reads as a broken web page. On desktop the platform
       draws it inside a phone, centred on its own canvas, and keeps the
       sidebar; below lg nothing changes and the app has the screen to itself,
       which is what `fullBleed` is still there for. All of it is CSS on
       .fb-deviceframe — the module's own files are untouched, which matters
       because this one is a byte-for-byte copy of `v5`'s. */
    if (state.rootEl) {
      state.rootEl.classList.toggle("fb-fullbleed", fullBleed);
      state.rootEl.classList.toggle("fb-deviceframe", !!leaf.deviceFrame);
      state.rootEl.classList.remove("fb-module-overlay"); state.rootEl.classList.remove("fb-sidebar-collapsed");
    }
    applySidebar();
    viewport.style.setProperty("--fb-clip-left", (fullBleed ? 0 : leaf.clipLeft || 0) + "px");
    viewport.style.setProperty("--fb-clip-left-m", (fullBleed ? 0 : leaf.clipLeftMobile != null ? leaf.clipLeftMobile : 0) + "px");
    viewport.style.setProperty("--fb-clip-top-m", (fullBleed ? 0 : PLATFORM_MHEAD - mH) + "px");

    /* Cover the module's dead hamburger. Default box measured across three
       owners (burgers land at x 24-26, y 10-15, 36x36); `burgerBox` overrides
       it for any module that differs. Below lg the platform's own header
       already covers the module's, so the mask is desktop-only via CSS. */
    var mask = document.querySelector("[data-burger-mask]");
    if (mask) {
      if (fullBleed || !leaf.hideBurger) {
        mask.hidden = true;
      } else {
        // Burgers measured at x 24-26 w 36 (so they end at 60-62) and y 10-15
        // h 36 (ending 46-51). The box has to stop at 62: any wider and it eats
        // the page title, which starts ~4px later.
        var b = leaf.burgerBox || [16, 4, 46, 52];
        mask.style.left = b[0] + "px";
        mask.style.top = b[1] + "px";
        mask.style.width = b[2] + "px";
        mask.style.height = b[3] + "px";
        mask.style.background = leaf.burgerBg || "#fff";
        mask.hidden = false;
      }
    }
    frame.title = dest.leaf.name;
    loading.hidden = false;
    error.hidden = true;

    clearTimeout(loadTimer);
    // A cross-origin frame gives us `load` but no way to inspect what loaded, so
    // a stall is the only failure we can detect. 15s is generous for a static page.
    loadTimer = setTimeout(function () {
      showError(dest, "It took too long to respond. The site may be down, or GitHub Pages may still be building it.");
    }, 15000);

    frame.onload = function () {
      clearTimeout(loadTimer);
      loading.hidden = true;
      deferToFramedExitBar(frame, dest.leaf);
    };

    state.currentUrl = withView(pickUrl(dest.leaf));
    /* REPLACE, don't push. Assigning `frame.src` adds an entry to the tab's
       joint session history, so one Back press rewinds the IFRAME while the
       shell's own hash stays where it was — the address bar and the sidebar
       then name one destination while the frame shows another. Using
       location.replace() keeps the shell's hash the single source of truth for
       what is on screen, which is what Back and Forward actually navigate.
       KNOWN, PRE-EXISTING, AND NOT FIXED BY THIS: a Back that lands on an
       entry whose hash is unchanged can still have the browser restore an
       earlier frame document, so the sidebar and the address bar name one
       destination while the frame shows another. It fires no hashchange and
       no popstate on this window — a frame-only traversal notifies neither —
       so the shell cannot see it to correct it. It reproduces between any two
       destinations (Dashboard to Workforce Management does it) and predates
       the drafts route. Fixing it means the shell owning its own history
       entries rather than letting frame loads create them. */
    try {
      /* Always replace, including the first load: the frame starts on the
         initial about:blank, and replacing into that adds nothing to history
         either. Assigning `.src` at any point is what pushes the entry. */
      frame.contentWindow.location.replace(state.currentUrl);
    } catch (e) {
      frame.src = state.currentUrl;                       // cross-origin: fall back
    }
    document.title = dest.leaf.name + " — FoodBridge";
  }

  /* ── Store QR ─────────────────────────────────────────────────────────────
     The QR encodes an absolute deep link to the storefront module, built from
     the shell's own location so it works on whatever host serves the platform. */
  function qrTargetUrl() {
    var q = state.config && state.config.storeQr;
    var route = (q && q.targetRoute) || "";
    return location.href.split("#")[0] + "#/" + route;
  }

  function openQrModal() {
    var m = document.querySelector("[data-qr-modal]");
    if (!m) return;
    m.querySelector("[data-qr-intro]").hidden = false;
    m.querySelector("[data-qr-result]").hidden = true;
    m.hidden = false;
  }

  function closeQrModal() {
    var m = document.querySelector("[data-qr-modal]");
    if (m) m.hidden = true;
  }

  function generateQr() {
    var m = document.querySelector("[data-qr-modal]");
    if (!m || typeof QRCode === "undefined") return;
    var holder = m.querySelector("[data-qr-canvas]");
    holder.innerHTML = "";
    new QRCode(holder, {
      text: qrTargetUrl(),
      width: 196,
      height: 196,
      colorDark: "#111827",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
    m.querySelector("[data-qr-intro]").hidden = true;
    m.querySelector("[data-qr-result]").hidden = false;
  }

  function qrDataUrl() {
    var holder = document.querySelector("[data-qr-modal] [data-qr-canvas]");
    if (!holder) return null;
    var canvas = holder.querySelector("canvas");
    if (canvas) return canvas.toDataURL("image/png");
    var img = holder.querySelector("img");
    return img ? img.src : null;
  }

  function downloadQr() {
    var url = qrDataUrl();
    if (!url) return;
    var a = document.createElement("a");
    a.href = url;
    a.download = "store-qr-code.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function printQr() {
    var url = qrDataUrl();
    if (!url) return;
    var brand = (state.config && state.config.brand && state.config.brand.name) || "Store";
    var w = window.open("", "_blank", "width=420,height=560");
    if (!w) return; // popup blocked
    w.document.write(
      "<title>" + esc(brand) + " — Store QR</title>" +
      '<div style="font:600 18px system-ui;text-align:center;padding:28px;color:#111">' +
      esc(brand) +
      '<br><img src="' + url + '" style="width:300px;height:300px;margin:16px 0">' +
      '<br><span style="font:13px system-ui;color:#555">Scan to open the store</span></div>'
    );
    w.document.close();
    w.focus();
    setTimeout(function () { w.print(); }, 200);
  }

  /* ── Navigation ────────────────────────────────────────────────────────── */
  /* Collapsing is a class on the root, not a style on the aside, so the reopen
     button and the viewport can react to the same switch. */
  function applySidebar() {
    var root = state.rootEl || document.getElementById("root");
    if (root) root.classList.toggle("fb-sidebar-collapsed", !!state.sidebarCollapsed);
  }

  function setSidebarCollapsed(v) {
    state.sidebarCollapsed = !!v;
    try { localStorage.setItem("fb-sidebar-collapsed", state.sidebarCollapsed ? "1" : "0"); } catch (e) {}
    applySidebar();
  }

  /* Switching business type changes which routes EXIST, so the route table has
     to be rebuilt — and if the current screen is one the new persona does not
     have, we move rather than leave a dead frame on screen. */
  function setPersona(id) {
    if (!id || id === state.persona) return;
    state.persona = id;
    try { localStorage.setItem("fb-persona", id); } catch (e) {}

    var built = buildRoutes(state.config);
    state.routes = built.routes;
    state.order = built.order;
    state.aliases = built.aliases;

    if (!state.routes[state.current]) {
      var to = state.order[0];
      // Do NOT pre-assign state.current: go() only reloads the frame when the
      // key changes, so setting it first left the old module on screen while
      // the hash and the sidebar said otherwise.
      location.replace("#/" + to);
      go(to, { force: true });
      return;
    }
    refreshSidebars();
  }

  /* Re-rendering replaces the sidebar's innerHTML, which destroys the element
     the user had scrolled and sends it back to the top. On a nav list taller
     than the viewport that meant every click bounced you away from where you
     were working — pick Supplier Payables and the menu jumps to Dashboard.
     Carry the scroll offset across the swap. */
  function refreshSidebars() {
    var html = renderSidebarContent(state.config);
    [document.querySelector("[data-desktop-sidebar]"),
     document.querySelector("[data-mobile-sidebar] aside")].forEach(function (host) {
      if (!host) return;
      var prev = host.querySelector(".sidebar-scroll");
      var top = prev ? prev.scrollTop : 0;
      host.innerHTML = html;
      if (!top) return;
      var next = host.querySelector(".sidebar-scroll");
      // clamp: the list can get shorter (a business type with fewer screens),
      // and restoring past the new end would silently land at the bottom
      if (next) next.scrollTop = Math.min(top, Math.max(0, next.scrollHeight - next.clientHeight));
    });
  }

  function go(key, opts) {
    if (!state.routes[key]) return;
    var changed = key !== state.current;
    state.current = key;
    // Opening a route inside a collapsed group opens that group.
    var dest = state.routes[key];
    if (dest.group) state.openGroups[dest.group.id] = true;
    refreshSidebars();
    closeMobileNav();
    if (changed || (opts && opts.force)) loadModule(key);
  }

  function closeMobileNav() {
    state.mobileNavOpen = false;
    var el = document.querySelector("[data-mobile-sidebar]");
    if (el) el.hidden = true;
  }

  function wire(root) {
    root.addEventListener("click", function (e) {
      var toggle = e.target.closest("[data-submenu-toggle]");
      if (toggle) {
        var id = toggle.getAttribute("data-submenu-toggle");
        var open = state.openGroups[id];
        state.openGroups[id] = !(open === undefined ? true : open);
        refreshSidebars();
        return;
      }
      if (e.target.closest("[data-sidebar-toggle]")) { setSidebarCollapsed(!state.sidebarCollapsed); return; }
      if (e.target.closest("[data-persona]")) return;   // the select handles itself
      if (e.target.closest("[data-store-qr]")) { openQrModal(); return; }
      if (e.target.closest("[data-qr-generate]")) { generateQr(); return; }
      if (e.target.closest("[data-qr-download]")) { downloadQr(); return; }
      if (e.target.closest("[data-qr-print]")) { printQr(); return; }
      if (e.target.closest("[data-qr-close]")) { closeQrModal(); return; }

      var link = e.target.closest("[data-route]");
      if (link) {
        // Let the hash change drive navigation so back/forward stay honest.
        return;
      }
      if (e.target.closest("[data-mobile-toggle]")) {
        state.mobileNavOpen = !state.mobileNavOpen;
        document.querySelector("[data-mobile-sidebar]").hidden = !state.mobileNavOpen;
        return;
      }
      if (e.target.closest("[data-mobile-backdrop]")) closeMobileNav();
    });

    root.addEventListener("change", function (e) {
      var sel = e.target.closest("[data-persona]");
      if (sel) setPersona(sel.value);
    });

    window.addEventListener("hashchange", function () {
      go(routeFromHash());
    });


    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeMobileNav();
        closeQrModal();
      }
    });

    // Messages from a module's iframe:
    //  • overlay        — it opened a drawer/modal; hide the mobile header so the
    //                     overlay can cover the whole page.
    //  • toggle-sidebar — its header hamburger was clicked; the module's own
    //                     sidebar is clipped away, so the click drives the
    //                     platform's sidebar collapse instead (one control that
    //                     actually works, right where the real app puts it).
    window.addEventListener("message", function (e) {
      var d = e.data;
      if (!d || d.source !== "fb-module") return;
      if (d.type === "overlay") { if (state.rootEl) state.rootEl.classList.toggle("fb-module-overlay", !!d.active); }
      else if (d.type === "toggle-sidebar") { setSidebarCollapsed(!state.sidebarCollapsed); }
    });

    // When the viewport crosses the mobile breakpoint, a module with a phone
    // screen needs the other url. Reload only if the pick actually changed.
    var onBreakpoint = function () {
      var dest = state.current && state.routes[state.current];
      if (dest && dest.leaf.urlMobile && pickUrl(dest.leaf) !== state.currentUrl) {
        loadModule(state.current);
        return;
      }
      /* A module bar that hides itself above its own breakpoint hands EXIT
         DEMO back to the platform's bar, and takes it again below. */
      var f = document.querySelector("[data-frame]");
      if (dest && f) deferToFramedExitBar(f, dest.leaf);
    };
    window.addEventListener("resize", onBreakpoint);
    if (mobileMQ.addEventListener) mobileMQ.addEventListener("change", onBreakpoint);
    else mobileMQ.addListener(onBreakpoint); // older Safari
  }

  /* ── Boot ──────────────────────────────────────────────────────────────── */
  async function mount(el, configPath) {
    // modules.json carries the URLs, so a stale copy pins the whole platform to
    // the previous set of destinations. platform.js/.css are cache-busted by the
    // ?v= token on their script/link tags; this file had nothing, and Pages
    // serves it with a ten-minute max-age. Reuse this script's own token so one
    // bump invalidates all three.
    var url = configPath || "assets/modules.json";
    var res = await fetch(url + (BUILD && url.indexOf("?") === -1 ? "?v=" + BUILD : ""));
    if (!res.ok) throw new Error("modules.json " + res.status);
    var config = await res.json();
    state.config = config;
    state.rootEl = el;

    var saved = null;
    try { saved = localStorage.getItem("fb-persona"); } catch (e) {}
    var known = (config.personas || []).map(function (p) { return p.id; });
    state.persona = known.indexOf(saved) !== -1 ? saved
                  : (config.personaDefault || known[0] || null);

    var built = buildRoutes(config);
    state.routes = built.routes;
    state.order = built.order;
    state.aliases = built.aliases;
    state.landing = config.landing || null;
    state.current = routeFromHash();

    el.innerHTML = renderShell(config);
    wire(el);
    applySidebar();
    refreshSidebars();
    loadModule(state.current);

    if (!location.hash) location.replace("#/" + state.current);
  }

  window.FBPlatform = { mount: mount };
})();

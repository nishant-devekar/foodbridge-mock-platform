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

  /* ── Routes ───────────────────────────────────────────────────────────────
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
    return { routes: routes, order: order };
  }

  /* Falling back silently was not enough: asking for a hidden route left the
     bogus hash in the address bar while a different screen rendered, so the URL
     lied about what you were looking at. Rewrite it to what actually loaded.

     A destination may also carry a query: #/customer-management/b2b-customers?customer=c15.
     One module deep-links into another that way — Route Planning sends an
     unlocated customer to Customer Management — and going through the hash,
     rather than letting the frame navigate itself, is what keeps the sidebar,
     the clip offsets and the back button honest. The query rides on state and
     is appended to the destination's own URL when it loads. */
  function routeFromHash() {
    var raw = (location.hash || "").replace(/^#\/?/, "");
    var cut = raw.indexOf("?");
    var h = cut === -1 ? raw : raw.slice(0, cut);
    state.query = cut === -1 ? "" : raw.slice(cut + 1);
    if (state.routes[h]) return h;
    var fallback = state.order[0];
    if (h && fallback) location.replace("#/" + fallback);
    return fallback;
  }

  /* ── Sidebar ─────────────────────────────────────────────────────────────
     SidebarContent.jsx. Class strings are verbatim from the port. */
  /* The business-type picker sits under the store name because that is what it
     is — a property of the tenant, not a filter the user applies to a list. It
     changes what the platform HAS, so it belongs with the tenant's identity. */
  function renderStoreSelector(config) {
    var name = esc(config.brand && config.brand.name);
    var list = config.personas || [];
    var cur = list.filter(function (p) { return p.id === state.persona; })[0];
    return (
      '<div class="relative w-full">' +
      '<div class="flex items-center gap-3 px-1 py-1.5 rounded-md transition-colors cursor-default">' +
      '<a href="#/" class="flex-shrink-0"><img src="' + BAG_ICON + '" alt="Storefront Logo" class="w-7 h-7" /></a>' +
      '<div class="flex flex-col min-w-0 flex-1">' +
      '<span class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight" title="' + name + '">' + name + "</span>" +
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
    var u = config.user || {};
    var name = esc((config.brand && config.brand.name) || "");
    return (
      '<header data-mobile-bar class="fb-mhead">' +
      '<button type="button" data-mobile-toggle class="fb-mhead-burger" aria-label="Open menu">' +
      icon("menu", "w-5 h-5") +
      "</button>" +
      '<a href="#/" class="fb-mhead-brand" title="' + name + '">' +
      '<img src="' + BAG_ICON + '" alt="Storefront Logo" />' +
      '<span class="fb-mhead-brand-name">' + name + "</span>" +
      "</a>" +
      '<div class="fb-mhead-user">' +
      '<span class="fb-mhead-user-txt"><span class="nm">' + esc(u.displayName || "") + '</span><span class="rl">' + esc(u.role || "") + "</span></span>" +
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
    var brand = esc((config.brand && config.brand.name) || "the store");
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

  function loadModule(key) {
    var dest = state.routes[key];
    if (!dest) return;

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
    if (state.rootEl) { state.rootEl.classList.toggle("fb-fullbleed", fullBleed); state.rootEl.classList.remove("fb-module-overlay"); state.rootEl.classList.remove("fb-sidebar-collapsed"); }
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
    };

    // currentUrl stays the destination's own URL — the breakpoint check compares
    // against it — while the frame gets the query the hash carried.
    state.currentUrl = pickUrl(dest.leaf);
    state.loadedQuery = state.query || "";
    frame.src = state.currentUrl + (state.loadedQuery ? (state.currentUrl.indexOf("?") === -1 ? "?" : "&") + state.loadedQuery : "");
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
    // A new query on the route already showing is still a navigation.
    var changed = key !== state.current || (state.query || "") !== (state.loadedQuery || "");
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
      }
    };
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

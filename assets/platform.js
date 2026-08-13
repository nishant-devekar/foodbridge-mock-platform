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

  var state = {
    config: null,
    routes: {},   // "group/leaf" or "leaf" -> destination
    order: [],    // route keys, in sidebar order
    current: null,
    currentUrl: null,
    rootEl: null,
    openGroups: {},
    mobileNavOpen: false,
  };

  /* A module may ship a phone-specific screen (urlMobile). Below this width we
     load it instead of the desktop url, and swap live when the width crosses.
     768px matches the `md` breakpoint the embedded modules are built against. */
  var mobileMQ = window.matchMedia("(max-width: 767px)");

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
    config.nav.forEach(function (group) {
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

  function routeFromHash() {
    var h = (location.hash || "").replace(/^#\/?/, "");
    return state.routes[h] ? h : state.order[0];
  }

  /* ── Sidebar ─────────────────────────────────────────────────────────────
     SidebarContent.jsx. Class strings are verbatim from the port. */
  function renderStoreSelector(config) {
    var name = esc(config.brand && config.brand.name);
    return (
      '<div class="relative">' +
      '<div class="flex items-center gap-3 px-1 py-1.5 rounded-md transition-colors cursor-default">' +
      '<a href="#/" class="flex-shrink-0"><img src="' + BAG_ICON + '" alt="Storefront Logo" class="w-7 h-7" /></a>' +
      '<div class="flex flex-col min-w-0 flex-1">' +
      '<span class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight" title="' + name + '">' + name + "</span>" +
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
    var items = config.nav
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
     Layout.jsx. The platform renders no header of its own: each module's
     header stays visible inside the iframe and serves as the app header, so
     there is exactly one. On mobile the platform supplies a slim bar, because
     the module's header is off to the left of the clip. */
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
      '<div data-mobile-bar class="lg:hidden flex-shrink-0 flex items-center gap-2 h-14 px-3 bg-white border-b border-gray-200 shadow-sm">' +
      '<button type="button" data-mobile-toggle aria-label="Toggle sidebar" ' +
      'class="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50">' +
      icon("menu", "w-5 h-5 text-gray-600") +
      "</button>" +
      '<h1 class="text-base font-semibold text-gray-700 tracking-tight" data-mobile-title></h1>' +
      "</div>" +

      '<div class="fb-viewport" data-viewport>' +
      '<div class="fb-overlay" data-loading><div class="fb-spinner" role="status" aria-label="Loading module"></div></div>' +
      '<div class="fb-overlay" data-error hidden></div>' +
      '<iframe data-frame title="Module" referrerpolicy="no-referrer"></iframe>' +
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

    // A full-bleed module fills the window (sidebar hidden), so nothing is
    // clipped; otherwise offset the iframe left to hide the module's own sidebar.
    var fullBleed = !!dest.leaf.fullBleed;
    if (state.rootEl) state.rootEl.classList.toggle("fb-fullbleed", fullBleed);
    viewport.style.setProperty("--fb-clip-left", (fullBleed ? 0 : dest.leaf.clipLeft || 0) + "px");
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

    state.currentUrl = pickUrl(dest.leaf);
    frame.src = state.currentUrl;
    document.title = dest.leaf.name + " — FoodBridge";
    var mt = document.querySelector("[data-mobile-title]");
    if (mt) mt.textContent = dest.leaf.name;
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
  function refreshSidebars() {
    var html = renderSidebarContent(state.config);
    document.querySelector("[data-desktop-sidebar]").innerHTML = html;
    var mob = document.querySelector("[data-mobile-sidebar] aside");
    if (mob) mob.innerHTML = html;
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

    window.addEventListener("hashchange", function () {
      go(routeFromHash());
    });

    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeMobileNav();
        closeQrModal();
      }
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
    var res = await fetch(configPath || "assets/modules.json");
    if (!res.ok) throw new Error("modules.json " + res.status);
    var config = await res.json();
    state.config = config;
    state.rootEl = el;

    var built = buildRoutes(config);
    state.routes = built.routes;
    state.order = built.order;
    state.current = routeFromHash();

    el.innerHTML = renderShell(config);
    wire(el);
    refreshSidebars();
    loadModule(state.current);

    if (!location.hash) location.replace("#/" + state.current);
  }

  window.FBPlatform = { mount: mount };
})();

/* ==========================================================================
   app-header.js — the platform's page header, for screens that don't have it
   (28 Sep 2026).

   Owner: every Production page wears the same header as Sales Orders. That
   header is drawn by the Sales Orders module's own shell
   (modules/foodbridge-sales-orders-mockup/assets/mock-shell.js, Tailwind):
   hamburger · page title · avatar · name · role · chevron, and a profile
   menu (My Network · Edit Profile · Log Out). The Production pages have no
   Tailwind, so this is that header in plain CSS, every value measured off
   the Sales Orders page: 56px tall, 1px #e5e7eb under it, 24px in, a 36px
   hamburger, 16px / 600 title, 40px avatar with its 2px ring and green dot.

   Use:  FBAppHeader.mount({ title: "Recipes", replace: el })   — or prepend
         FBAppHeader.html("Shifts")                              — a string, for
                                                                    pages that draw
                                                                    their own DOM
   In the platform the hamburger is covered by its burger mask (modules.json
   `hideBurger`), exactly as on Sales Orders; on its own it asks the platform
   to toggle the sidebar and does nothing else.
   ========================================================================== */
(function () {
  "use strict";
  if (window.FBAppHeader) return;

  /* the user Sales Orders shows (its seed: displayName, role) */
  var USER = { name: "Mahesh", role: "Admin" };

  var svg = function (paths, size) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + "</svg>";
  };
  var I = {
    menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    chevron: '<polyline points="6 9 12 15 18 9"/>',
    nodeTree: '<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v5M5 17v-2a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2"/>',
    sparkles: '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z"/><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    logOut: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  };
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };

  /* Tailwind's values, spelled out: h-14, px-3 sm:px-6, p-2, gap-1.5, text-base
     font-semibold tracking-tight, h-8 w-8 sm:h-10 sm:w-10, ring-2 ring-green-200,
     shadow-md, w-56 shadow-xl … and the breakpoints sm 640 / lg 1024. */
  var CSS = [
    ".fbah,.fbah *{box-sizing:border-box}",
    ".fbah{position:sticky;top:0;z-index:30;flex-shrink:0;height:56px;background:#fff;border-bottom:1px solid #e5e7eb;box-shadow:0 1px 2px 0 rgba(0,0,0,.05);font-family:system-ui,sans-serif,Arial,Helvetica;font-size:16px;line-height:24px;color:#000;text-align:left;overflow:visible}",
    ".fbah-in{display:flex;align-items:center;justify-content:space-between;height:100%;padding:0 12px;margin:0 auto}",
    ".fbah-l{display:flex;align-items:center;gap:6px;min-width:0}",
    ".fbah-burger{display:inline-flex;padding:8px;border:0;border-radius:8px;background:transparent;color:#4b5563;cursor:pointer;transition:background-color .2s}",
    ".fbah-burger:hover{background:#f3f4f6}",
    ".fbah-burger:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(34,197,94,.5)}",
    ".fbah-title{display:none;margin:0;font-size:16px;line-height:24px;font-weight:600;color:#374151;letter-spacing:-.025em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".fbah-r{position:relative;display:inline-block;flex-shrink:0}",
    ".fbah-me{display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:8px;cursor:pointer;transition:background-color .2s}",
    ".fbah-me:hover{background:#f9fafb}",
    ".fbah-avw{position:relative;display:none}",
    ".fbah-av{display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;color:#fff;font-weight:600;background-image:linear-gradient(to right bottom,#22c55e,#059669);box-shadow:0 0 0 2px #bbf7d0,0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1);transition:box-shadow .2s}",
    ".fbah-me:hover .fbah-av{box-shadow:0 0 0 2px #86efac,0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1)}",
    ".fbah-dot{position:absolute;right:-2px;bottom:-2px;width:12px;height:12px;border-radius:9999px;background:#4ade80;border:2px solid #fff}",
    ".fbah-who{display:flex;flex-direction:column;align-items:flex-start;min-width:0}",
    ".fbah-nm{margin:0;max-width:128px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px;font-weight:600;color:#1f2937}",
    ".fbah-rl{margin:0;max-width:112px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:16px;font-weight:500;color:#16a34a}",
    ".fbah-chev{display:inline-flex;color:#9ca3af;transition:transform .2s,color .2s}",
    ".fbah-me:hover .fbah-chev{color:#4b5563}",
    ".fbah-chev.open{transform:rotate(180deg)}",
    ".fbah-menu{position:absolute;right:0;margin-top:8px;width:224px;list-style:none;padding:0;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 8px 10px -6px rgba(0,0,0,.1);overflow:hidden;z-index:50}",
    ".fbah-menu[hidden]{display:none}",
    ".fbah-grp{padding:4px 0}",
    ".fbah-grp+.fbah-grp{padding:0;border-top:1px solid #e5e7eb}",
    ".fbah-it{display:flex;align-items:center;justify-content:space-between;width:100%;padding:10px 16px;border:0;background:transparent;font:inherit;font-size:14px;line-height:20px;font-weight:500;color:#374151;text-decoration:none;cursor:pointer;transition:background-color .15s,color .15s}",
    ".fbah-it:hover{background:#f0fdf4;color:#16a34a}",
    ".fbah-it>span{display:flex;align-items:center;min-width:0}",
    ".fbah-it svg{flex-shrink:0;margin-right:12px;color:#6b7280}",
    ".fbah-it:hover svg{color:#16a34a}",
    ".fbah-badge{display:inline-flex!important;align-items:center;gap:2px;margin-left:8px;padding:2px 6px;border-radius:4px;background:#f3e8ff;color:#7e22ce;font-size:10px;line-height:15px;font-weight:500;white-space:nowrap}",
    ".fbah-badge svg{margin:0!important;color:#7e22ce!important}",
    ".fbah-out,.fbah-out:hover{color:#dc2626}",
    ".fbah-out:hover{background:#fef2f2}",
    ".fbah-out svg,.fbah-out:hover svg{color:#ef4444}",
    "@media (min-width:640px){.fbah-in{padding:0 24px}.fbah-title{display:block}.fbah-av{width:40px;height:40px}}",
    "@media (min-width:1024px){.fbah-avw{display:block}}",
  ].join("\n");

  function style() {
    if (document.getElementById("fbah-css")) return;
    var s = document.createElement("style");
    s.id = "fbah-css"; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  /* o.logout: extra attributes for Log Out, for a page that signs out (JobFlow) */
  function html(title, o) {
    o = o || {};
    return '<header class="fbah" data-fbah>' +
      '<div class="fbah-in">' +
        '<div class="fbah-l">' +
          '<button type="button" class="fbah-burger" aria-label="Toggle sidebar" data-fbah-burger>' + svg(I.menu, 20) + "</button>" +
          '<h1 class="fbah-title">' + esc(title) + "</h1>" +
        "</div>" +
        '<div class="fbah-r" data-fbah-root>' +
          '<div class="fbah-me" data-fbah-toggle>' +
            '<div class="fbah-avw"><div class="fbah-av">' + svg(I.user, 20) + '</div><span class="fbah-dot"></span></div>' +
            '<div class="fbah-who"><p class="fbah-nm">' + esc(USER.name) + '</p><p class="fbah-rl">' + esc(USER.role) + "</p></div>" +
            '<span class="fbah-chev" data-fbah-chev>' + svg(I.chevron, 16) + "</span>" +
          "</div>" +
          '<div class="fbah-menu" data-fbah-menu hidden>' +
            '<div class="fbah-grp">' +
              '<a href="#" class="fbah-it" data-fbah-noop><span>' + svg(I.nodeTree, 16) + '<span>My Network</span></span><span class="fbah-badge">' + svg(I.sparkles, 10) + "Preview</span></a>" +
              '<a href="#" class="fbah-it" data-fbah-noop><span>' + svg(I.settings, 16) + "<span>Edit Profile</span></span></a>" +
            "</div>" +
            '<div class="fbah-grp"><button type="button" class="fbah-it fbah-out"' + (o.logout ? " " + o.logout : "") + "><span>" + svg(I.logOut, 16) + "<span>Log Out</span></span></button></div>" +
          "</div>" +
        "</div>" +
      "</div>" +
    "</header>";
  }

  /* o.replace: an element (or selector) the header takes the place of;
     otherwise it goes first in o.into (default: <body>). o.flush: the page
     kept the browser's 8px body margin; take it off so the header meets the
     edges, as on Sales Orders. o.overlay: the page is itself a drawer over a
     dimmed screen (Batch detail, Create batch); the platform then stands its
     hamburger mask down, and every other page says it is not, so going back
     brings the mask back. */
  function mount(o) {
    o = o || {};
    style();
    if (o.flush) document.body.style.margin = "0";
    base = !!o.overlay; sent = null; tell();
    var box = document.createElement("div");
    box.innerHTML = html(o.title, o);
    var h = box.firstChild;
    var old = typeof o.replace === "string" ? document.querySelector(o.replace) : o.replace;
    if (old && old.parentNode) old.parentNode.replaceChild(h, old);
    else { var into = o.into || document.body; into.insertBefore(h, into.firstChild); }
    return h;
  }

  /* Over a dimmed dialog the platform's white hamburger mask would show as a
     white square: say when one is open, and it stands the mask down. The
     pages' own dialogs: JobFlow's [role=dialog], Recipes' .scrim, Batch
     Management's .ws-modal-scrim. */
  var OVERLAYS = '[role="dialog"], .scrim:not([hidden]), .ws-modal-scrim';
  var base = false, sent = null;
  function tell() {
    var on = base || !!document.querySelector(OVERLAYS);
    if (on === sent) return;
    sent = on;
    try { if (window.parent !== window) window.parent.postMessage({ source: "fb-module", type: "overlay", active: on }, "*"); } catch (err) {}
  }
  function watch() {
    if (!document.body || !window.MutationObserver) return;
    new MutationObserver(tell).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class"] });
    tell();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch); else watch();

  function close(except) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-fbah-root]"), function (r) {
      if (r === except) return;
      var m = r.querySelector("[data-fbah-menu]"), c = r.querySelector("[data-fbah-chev]");
      if (m) m.hidden = true;
      if (c) c.classList.remove("open");
    });
  }
  /* Delegated, so a page that redraws itself (JobFlow's morph) keeps it working. */
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest("[data-fbah-noop]")) { e.preventDefault(); return; }
    if (t.closest("[data-fbah-burger]")) {
      try { if (window.parent !== window) window.parent.postMessage({ source: "fb-module", type: "toggle-sidebar" }, "*"); } catch (err) {}
      return;
    }
    var tg = t.closest("[data-fbah-toggle]");
    if (tg) {
      var root = tg.closest("[data-fbah-root]"), m = root.querySelector("[data-fbah-menu]"), c = root.querySelector("[data-fbah-chev]");
      var open = m.hidden;
      close(root);
      m.hidden = !open; c.classList.toggle("open", open);
    }
  });
  document.addEventListener("mousedown", function (e) {
    var r = e.target.closest ? e.target.closest("[data-fbah-root]") : null;
    close(r);
  });

  style();
  window.FBAppHeader = { mount: mount, html: html, style: style };
})();

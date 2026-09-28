/*
  The lot sticker sheet (29 Sep 2026), for any screen that brings goods in.

  What comes in gets one sticker per sack, crate, box or master carton — what it
  is, its lot number, n of N, how much, when it came in and its use-by — so the
  floor can take the oldest first. The QR carries the lot number and the pack.
  The same sheet Raw Material Inventory's Receive Stock prints (its look is
  copied from there, class for class, in plain CSS so it needs no Tailwind).

    window.FBLotStickers.open(["L3001-0098", "P4007-0099"])   stickers from the store
    window.FBLotStickers.close()

  Reads the store (window.FB_PRODUCTION.stickers). Loads assets/qrcode.min.js
  itself, from beside this file. Printing puts a copy of the stickers alone on
  the page and calls window.print().
*/
(function () {
  "use strict";
  var SELF = document.currentScript && document.currentScript.src;
  var root = null, qr = null;

  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function day(v) { return new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  function plural(w, n) { return n === 1 ? w : w === "box" ? "boxes" : w + "s"; }

  var CSS = [
    ".fbls-back{position:fixed;inset:0;z-index:10095;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.5);font-family:system-ui,-apple-system,'Segoe UI',sans-serif}",
    "@media (min-width:640px){.fbls-back{align-items:center}}",
    ".fbls-modal{width:100%;max-height:92vh;display:flex;flex-direction:column;background:#fff;border-radius:8px 8px 0 0;box-shadow:0 20px 40px rgba(0,0,0,.2)}",
    "@media (min-width:640px){.fbls-modal{max-width:56rem;margin:16px;border-radius:8px}}",
    ".fbls-head{padding:16px 24px 12px;border-bottom:1px solid #f3f4f6}",
    ".fbls-head h1{margin:0;font-size:16px;font-weight:600;color:#111827}",
    ".fbls-head p{margin:2px 0 0;font-size:14px;color:#6b7280}",
    ".fbls-body{padding:16px 24px;overflow:auto}",
    ".fbls-group{margin-bottom:20px}",
    ".fbls-group>p:first-child{margin:0;font-size:14px;font-weight:600;color:#1f2937}",
    ".fbls-group>p:first-child span{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:400;color:#6b7280}",
    ".fbls-group>p.fbls-meta{margin:0 0 8px;font-size:12px;color:#6b7280}",
    ".fbls-foot{padding:12px 24px;border-top:1px solid #f3f4f6;display:flex;flex-direction:column-reverse;gap:8px}",
    "@media (min-width:640px){.fbls-foot{flex-direction:row;justify-content:flex-end;gap:12px}}",
    ".fbls-btn{display:inline-flex;height:40px;align-items:center;justify-content:center;gap:8px;border-radius:6px;padding:0 20px;font-size:14px;font-weight:500;cursor:pointer;border:1px solid #d1d5db;background:#fff;color:#374151}",
    ".fbls-btn:hover{background:#f9fafb}",
    ".fbls-btn.is-go{border-color:#059669;background:#059669;color:#fff}",
    ".fbls-btn.is-go:hover{background:#047857}",
    ".fb-sticker-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}",
    ".fb-sticker{border:1.5px dashed #94a3b8;border-radius:8px;padding:10px 12px;background:#fff;color:#0f172a;font-family:system-ui,sans-serif;break-inside:avoid;page-break-inside:avoid}",
    ".fb-sticker p{margin:0}",
    ".fb-sticker-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}",
    ".fb-sticker-name{font-size:15px;font-weight:700;line-height:1.2}",
    ".fb-sticker-sub{font-size:11px;color:#475569;margin-top:2px!important}",
    ".fb-sticker-qr{width:64px;height:64px;flex-shrink:0}",
    ".fb-sticker-qr img,.fb-sticker-qr canvas{width:64px!important;height:64px!important}",
    ".fb-sticker-lot{font:700 20px/1.1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.02em;margin-top:4px!important}",
    ".fb-sticker-qty{display:flex;justify-content:space-between;align-items:baseline;margin-top:4px!important;font-size:13px}",
    ".fb-sticker-qty b{font-size:18px}",
    ".fb-sticker-qty span{color:#334155}",
    ".fb-sticker-dates{display:flex;justify-content:space-between;gap:8px;font-size:12px;margin-top:6px!important;padding-top:6px;border-top:1px solid #e2e8f0}",
    ".fb-sticker-foot{font-size:10.5px;color:#64748b;margin-top:4px!important;line-height:1.35}",
    "#fb-print-root{display:none}",
    "@media print{@page{margin:8mm}body>*:not(#fb-print-root){display:none!important}#fb-print-root{display:block}",
    "#fb-print-root .fb-sticker-grid{grid-template-columns:repeat(3,1fr);gap:4mm}#fb-print-root .fb-sticker{border-style:solid}#fb-print-root .fb-sticker-dates{flex-direction:column;gap:1px}}",
  ].join("\n");

  function sticker(x) {
    return '<div class="fb-sticker"><div class="fb-sticker-top"><div style="min-width:0">' +
      '<p class="fb-sticker-name">' + esc(x.material) + "</p>" +
      '<p class="fb-sticker-sub">' + esc(x.article) + " · " + esc(x.store) + "</p></div>" +
      '<div class="fb-sticker-qr" data-qr="' + esc(x.lotNo + " " + x.n + "/" + x.of) + '"></div></div>' +
      '<p class="fb-sticker-lot">' + esc(x.lotNo) + "</p>" +
      '<p class="fb-sticker-qty"><b>' + esc(x.qty) + " " + esc(x.unit) + "</b><span>" + esc(x.packName) + " " + x.n + " of " + x.of + "</span></p>" +
      '<p class="fb-sticker-dates"><span>In ' + esc(day(x.receivedAt)) + "</span><span><b>Use by " + esc(day(x.useBy)) + "</b></span></p>" +
      '<p class="fb-sticker-foot">' + esc(x.supplier) + "<br>Received by " + esc(x.by) + "</p></div>";
  }

  function drawQRs() {
    var draw = function () {
      if (!root || typeof QRCode === "undefined") return;
      root.querySelectorAll("[data-qr]").forEach(function (h) {
        if (h.firstChild) return;
        new QRCode(h, { text: h.getAttribute("data-qr"), width: 128, height: 128, colorDark: "#0f172a", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
      });
    };
    if (typeof QRCode !== "undefined" || !SELF) return draw();
    qr = qr || new Promise(function (resolve) {
      var sc = document.createElement("script");
      sc.src = new URL("qrcode.min.js", SELF).href;
      sc.onload = sc.onerror = function () { resolve(); };
      document.head.appendChild(sc);
    });
    qr.then(draw);
  }

  function close() {
    if (root) { root.remove(); root = null; }
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  function open(lotNos) {
    var P = window.FB_PRODUCTION;
    if (!P || !lotNos || !lotNos.length) return;
    var groups = lotNos.map(function (no) { try { return P.stickers(no); } catch (e) { return []; } }).filter(function (g) { return g.length; });
    if (!groups.length) return;
    var total = groups.reduce(function (n, g) { return n + g.length; }, 0);
    if (!document.getElementById("fbls-css")) {
      var st = document.createElement("style"); st.id = "fbls-css"; st.textContent = CSS; document.head.appendChild(st);
    }
    close();
    root = document.createElement("div");
    root.className = "fbls-back";
    root.setAttribute("data-lot-stickers", "");
    root.innerHTML =
      '<div class="fbls-modal" role="dialog" aria-modal="true" aria-label="Stickers">' +
        '<div class="fbls-head"><h1>' + total + " sticker" + (total === 1 ? "" : "s") + " to print</h1>" +
          "<p>Stick one on every sack, crate and box before it goes in the store. The floor takes the oldest first, by the use-by.</p></div>" +
        '<div class="fbls-body" data-stickerbody>' + groups.map(function (g) {
          return '<section class="fbls-group"><p>' + esc(g[0].material) + " <span>· " + esc(g[0].lotNo) + "</span></p>" +
            '<p class="fbls-meta">' + g.length + " " + esc(plural(g[0].packName, g.length)) + " · " + esc(g[0].store) + "</p>" +
            '<div class="fb-sticker-grid">' + g.map(sticker).join("") + "</div></section>";
        }).join("") + "</div>" +
        '<div class="fbls-foot"><button type="button" class="fbls-btn" data-ls="done">Done</button>' +
          '<button type="button" class="fbls-btn is-go" data-ls="print">Print ' + total + " sticker" + (total === 1 ? "" : "s") + "</button></div>" +
      "</div>";
    root.addEventListener("click", function (e) {
      if (e.target === root) return close();
      var act = e.target.closest("[data-ls]");
      if (!act) return;
      if (act.getAttribute("data-ls") === "done") return close();
      var pr = document.getElementById("fb-print-root");
      if (!pr) { pr = document.createElement("div"); pr.id = "fb-print-root"; document.body.appendChild(pr); }
      pr.innerHTML = "";
      pr.appendChild(root.querySelector("[data-stickerbody]").cloneNode(true));
      window.print();
    });
    document.addEventListener("keydown", onKey);
    /* centre over the page, not the page's own sidebar: inside the platform that
       sidebar is clipped away under the platform's, and the sheet would sit half behind it */
    var side = document.querySelector("[data-desktop-sidebar]");
    var edge = side && side.getClientRects().length ? side.getBoundingClientRect().right : 0;
    if (edge > 0 && edge < window.innerWidth / 2) root.style.paddingLeft = edge + "px";
    document.body.appendChild(root);
    drawQRs();
  }

  window.FBLotStickers = { open: open, close: close };
})();

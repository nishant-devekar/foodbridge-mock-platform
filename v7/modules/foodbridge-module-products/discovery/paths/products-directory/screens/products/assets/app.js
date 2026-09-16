/* ==========================================================================
   Products Directory — HTML replica of the live "Murli" storefront admin (v2).
   Vanilla JS, no build step. Screens: FB.mount('products'|'categories'|'raw-materials').
   v2 makes every action functional (no demos):
     • Import  → preview modal (Category/Sub Category/Product/Price/… ), file or
                  built-in sample, then the rows appear in the table.
     • Export  → real Excel (.xls) / CSV downloads + sample template.
     • Bulk    → Recategorize modal, Update-prices modal, Assign-tags drawer, Delete.
     • Add/Edit→ Unit & Price modal + real image upload preview.
     • Row     → View (detail), Edit (drawer), Delete (confirm modal).
   Everything mutates the in-memory seed data and re-renders.
   ========================================================================== */
(function () {
  // When this module is embedded in the mock platform, the platform overlays its
  // own 56px header across the top of the iframe on mobile — which would otherwise
  // hide an open drawer's own header. Flag the document so the drawer drops below
  // it (see .fb-embedded rule in styles.css). Standalone (top-level) is untouched.
  try { if (window.self !== window.top) document.documentElement.classList.add("fb-embedded"); } catch (e) { document.documentElement.classList.add("fb-embedded"); }
  const SEED = window.SEED || { products: [], categories: [], rawMaterials: [] };
  const PAGE_SIZE = 10;
  const UNITS = ["Bottle", "Box", "Pc", "KG", "gm", "L", "ml", "Dozen", "Pack", "Roll"];

  // ── Icons ─────────────────────────────────────────────────────────────────
  const I = {
    dash: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>',
    box: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8V16a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>',
    users: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>',
    route: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>',
    cart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>',
    truck: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>',
    pin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    ret: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>',
    inv: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V7l9-4 9 4v14"/><path d="M3 21h18M9 21v-6h6v6"/></svg>',
    user: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    bag: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" opacity=".18"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M16 10a4 4 0 0 1-8 0"/></svg>',
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    plus: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    eye: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>',
    trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>',
    trashBig: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>',
    chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    chevR: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    grip: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
    menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    upload: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></svg>',
    download: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>',
    sheet: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0f9d58" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18M4 9h16M4 15h16M14 3v18"/></svg>',
    bulk: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>',
    rupee: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12M6 8h12M6 13l8.5 8M14 8a5 5 0 0 1-5 5H6"/></svg>',
    tag: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.6 2.6a2 2 0 0 0-1.4-.6H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.4 8.4a2 2 0 0 0 2.8 0l7.2-7.2a2 2 0 0 0 0-2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>',
    x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    scan: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8v8M11 8v8M16 8v8"/></svg>',
    imgph: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-5-5L5 21"/></svg>',
    imgphL: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-5-5L5 21"/></svg>',
    cam: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/></svg>',
    flip: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
    crop: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>',
    refresh: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    pkg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8V16a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8Z"/><path d="m3.3 7 8.7 5 8.7-5"/></svg>',
    check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="M22 4 12 14.01l-3-3"/></svg>',
    lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    layers: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></svg>',
    back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    file: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
    globe: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/></svg>',
    empty: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  };

  const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const taxLabel = (r) => (r > 0 ? r + "% excl. tax" : "0% tax");
  const inclTax = (p, r) => Math.round(p * (1 + (r || 0) / 100) * 100) / 100;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const attr = (s) => esc(s).replace(/'/g, "&#39;");

  function hashNum(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff; return h; }
  function imgUrl(item, size) { const kw = (item.img || "product").split(",").slice(0, 3).join(","); return `https://loremflickr.com/${size}/${size}/${encodeURIComponent(kw)}?lock=${hashNum(item.id || item.name)}`; }
  function thumb(item, size) { return `<span class="thumb"><img src="${attr(imgUrl(item, size || 160))}" alt="${attr(item.name)}" loading="lazy" onerror="this.closest('.thumb').classList.add('noimg');this.remove();"><span class="ph">${I.imgph}</span></span>`; }

  function toast(msg, tone) { const t = document.getElementById("toast"); if (!t) return; t.className = "toast show" + (tone ? " " + tone : ""); t.textContent = msg; clearTimeout(toast._t); toast._t = setTimeout(() => (t.className = "toast"), 2600); }

  // ── Full-screen overlay signal ────────────────────────────────────────────
  // A drawer / centered modal should cover the WHOLE page. When embedded in the
  // mock platform, the platform paints its own 56px header over the top of this
  // iframe, which a drawer inside the iframe cannot paint over. So we tell the
  // platform (postMessage) to hide that header while any overlay is open. It is
  // ref-counted so stacked overlays (e.g. drawer → confirm) behave correctly.
  const EMBEDDED = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  let _overlayCount = 0;
  function setOverlay(on) {
    _overlayCount = Math.max(0, _overlayCount + (on ? 1 : -1));
    if (!EMBEDDED) return;
    try { window.parent.postMessage({ source: "fb-module", type: "overlay", active: _overlayCount > 0 }, "*"); } catch (e) {}
  }

  // ── File / CSV helpers ────────────────────────────────────────────────────
  function download(filename, text, mime) { const blob = new Blob([text], { type: mime || "text/plain" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
  function toCSV(headers, rows) { const q = (v) => { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }; return [headers.map(q).join(","), ...rows.map((r) => r.map(q).join(","))].join("\r\n"); }
  function toXLS(headers, rows) { const cell = (v) => `<td>${esc(v)}</td>`; return `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map(cell).join("")}</tr>`).join("")}</tbody></table></body></html>`; }
  function parseCSV(text) {
    const rows = []; let i = 0, field = "", row = [], inQ = false;
    while (i < text.length) { const c = text[i];
      if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
      else { if (c === '"') inQ = true; else if (c === ",") { row.push(field); field = ""; } else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; } else if (c !== "\r") field += c; }
      i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((x) => String(x).trim() !== ""));
  }

  // ── Mobile detection + bottom sheet ───────────────────────────────────────
  const isMobile = () => (window.matchMedia ? window.matchMedia("(max-width: 768px)").matches : window.innerWidth <= 768);
  function sheet(title, items) {
    const scrim = document.createElement("div"); scrim.className = "sheet-scrim";
    scrim.innerHTML = `<div class="sheet"><div class="grip"></div><div class="sheet-head"></div><div class="sheet-body"></div></div>`;
    document.body.appendChild(scrim);
    const head = scrim.querySelector(".sheet-head"), body = scrim.querySelector(".sheet-body");
    const close = () => { scrim.classList.remove("show"); setTimeout(() => scrim.remove(), 280); };
    function render(t, list, back) {
      head.innerHTML = `${back ? `<button class="s-back">${I.back}</button>` : '<span style="width:34px"></span>'}<h3>${esc(t)}</h3><button class="s-x">${I.x}</button>`;
      head.querySelector(".s-x").addEventListener("click", close);
      const bk = head.querySelector(".s-back"); if (bk) bk.addEventListener("click", back);
      body.innerHTML = "";
      list.filter((it) => !it.sep).forEach((it) => {
        const b = document.createElement("button"); b.className = "sheet-item" + (it.danger ? " danger" : "");
        b.innerHTML = `<span class="si-ic">${it.icon || ""}</span><span class="si-txt"><b>${esc(it.title)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</span>${it.children || it.chev ? `<span class="chev">${I.chevR}</span>` : ""}`;
        b.addEventListener("click", () => { if (it.children) render(it.childTitle || it.title, it.children, () => render(t, list, null)); else { close(); it.onClick && it.onClick(); } });
        body.appendChild(b);
      });
    }
    render(title, items, null);
    requestAnimationFrame(() => scrim.classList.add("show"));
    scrim.addEventListener("click", (e) => { if (e.target === scrim) close(); });
  }

  // ── Popover (desktop) / bottom sheet (mobile) ─────────────────────────────
  let openPop = null;
  function closePop() { if (openPop) { openPop.remove(); openPop = null; document.removeEventListener("click", onDoc, true); } }
  function onDoc(e) { if (openPop && !openPop.contains(e.target)) closePop(); }
  function popover(anchor, items, opts) {
    if (isMobile()) { sheet((opts && opts.title) || "Actions", items); return; }
    closePop();
    const el = document.createElement("div"); el.className = "popover";
    items.forEach((it) => {
      if (it.sep) { const s = document.createElement("div"); s.className = "m-sep"; el.appendChild(s); return; }
      const b = document.createElement("button"); b.type = "button"; b.className = "m-item" + (it.danger ? " danger" : "");
      b.innerHTML = `${it.icon || ""}<span>${esc(it.title)}</span>`;
      b.addEventListener("click", (ev) => { ev.stopPropagation(); closePop(); it.onClick && it.onClick(); });
      el.appendChild(b);
    });
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect(), pw = el.offsetWidth, ph = el.offsetHeight;
    el.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pw - 8)) + "px";
    el.style.top = (r.bottom + ph + 8 <= window.innerHeight ? r.bottom + 6 : Math.max(8, r.top - ph - 6)) + "px";
    openPop = el; setTimeout(() => document.addEventListener("click", onDoc, true), 0);
  }

  // ── General modal ─────────────────────────────────────────────────────────
  function modal({ title, headExtra, body, footer, wide, panelClass }) {
    const scrim = document.createElement("div"); scrim.className = "modal-scrim";
    scrim.innerHTML = `<div class="modal-panel ${wide ? "wide" : ""} ${panelClass || ""}" role="dialog" aria-modal="true">
      <div class="mp-head"><h3>${esc(title)}</h3>${headExtra || ""}<button class="x" data-close>${I.x}</button></div>
      <div class="mp-body">${body}</div>${footer ? `<div class="mp-foot">${footer}</div>` : ""}</div>`;
    document.body.appendChild(scrim); setOverlay(true);
    requestAnimationFrame(() => scrim.classList.add("show"));
    let done = false;
    const close = () => { if (done) return; done = true; setOverlay(false); scrim.classList.remove("show"); setTimeout(() => scrim.remove(), 200); };
    scrim.addEventListener("click", (e) => { if (e.target === scrim) close(); });
    scrim.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
    return { scrim, panel: scrim.querySelector(".modal-panel"), close };
  }

  // ── Delete confirm ────────────────────────────────────────────────────────
  function confirmDelete({ name, bulk, count, catalogues, entity, onConfirm }) {
    const scrim = document.createElement("div"); scrim.className = "modal-scrim";
    const msg = bulk
      ? `You are about to permanently remove <b>${count}</b> selected ${entity}${count === 1 ? "" : "s"}. Deleting them will remove them from all listings and you won't be able to recover them later.`
      : (catalogues != null
          ? `This ${entity} is currently part of ${catalogues} catalogues.<br>Deleting it will remove it from all listings and you won't be able to recover it later.`
          : `Deleting it will remove it from all listings and you won't be able to recover it later.`);
    scrim.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true"><div class="modal-ic">${I.trashBig}</div>
      <h2>Delete${bulk ? "" : ` <span class="em">${esc(name)}</span>`}?</h2><p>${msg}</p>
      <div class="modal-foot"><button class="btn" data-keep style="border-color:var(--line)">Cancel</button><button class="btn btn-danger" data-del>Delete</button></div></div>`;
    document.body.appendChild(scrim); setOverlay(true);
    requestAnimationFrame(() => scrim.classList.add("show"));
    let done = false;
    const close = () => { if (done) return; done = true; setOverlay(false); scrim.classList.remove("show"); setTimeout(() => scrim.remove(), 200); };
    scrim.addEventListener("click", (e) => { if (e.target === scrim) close(); });
    scrim.querySelector("[data-keep]").addEventListener("click", close);
    scrim.querySelector("[data-del]").addEventListener("click", () => { onConfirm(); close(); });
  }

  // ── Drawer (Add / Edit) ───────────────────────────────────────────────────
  function drawer({ title, subtitle, body, saveLabel, onSave, wide }) {
    const scrim = document.createElement("div"); scrim.className = "drawer-scrim";
    const panel = document.createElement("div"); panel.className = "drawer" + (wide ? " wide" : "");
    panel.innerHTML = `
      <div class="drawer-head"><button class="x">${I.x}</button><h3>${esc(title)}</h3>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div>
      <div class="drawer-body"><form id="drawerForm">${body}</form></div>
      <div class="drawer-foot"><button type="button" class="btn btn-primary" data-save>${esc(saveLabel)}</button><button type="button" class="btn cancel" data-close>Cancel</button></div>`;
    document.body.appendChild(scrim); document.body.appendChild(panel); setOverlay(true);
    requestAnimationFrame(() => { scrim.classList.add("show"); panel.classList.add("open"); });
    let done = false;
    const close = () => { if (done) return; done = true; setOverlay(false); scrim.classList.remove("show"); panel.classList.remove("open"); setTimeout(() => { scrim.remove(); panel.remove(); document.removeEventListener("keydown", onKey); }, 280); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    scrim.addEventListener("click", close);
    panel.querySelector(".x").addEventListener("click", close);
    panel.querySelector("[data-close]").addEventListener("click", close);
    panel.querySelector("[data-save]").addEventListener("click", () => {
      const form = panel.querySelector("#drawerForm");
      const f = new Proxy(form, { get(t, p) { const el = t.elements ? t.elements[p] : undefined; return el !== undefined ? el : t[p]; } });
      if (onSave(f) !== false) close();
    });
    panel.querySelectorAll("[data-generate]").forEach((b) => b.addEventListener("click", () => { panel.querySelector(`[name='${b.dataset.generate}']`).value = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join(""); }));
    panel.querySelectorAll(".img-box").forEach((box) => {
      const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.style.display = "none"; box.appendChild(input);
      box.addEventListener("click", (e) => { if (e.target.closest(".rm")) return; input.click(); });
      input.addEventListener("change", () => { const file = input.files[0]; if (!file) return; const url = URL.createObjectURL(file); box.innerHTML = `<img src="${url}" alt=""><button type="button" class="rm">${I.x}</button>`; box.appendChild(input); box.querySelector(".rm").addEventListener("click", (ev) => { ev.stopPropagation(); box.innerHTML = I.plus; box.appendChild(input); input.value = ""; }); });
    });
    panel.querySelectorAll(".unit-price-btn").forEach((b) => b.addEventListener("click", () => openUnitPriceModal(panel)));
    return panel;
  }
  const dRow = (label, req, ctrl, hint) => `<div class="d-row"><label>${label}${req ? ' <span class="req">*</span>' : ""}</label><div class="ctrl">${ctrl}${hint ? `<div class="hint">${hint}</div>` : ""}</div></div>`;
  const imgGrid = `<div class="img-grid">${Array.from({ length: 4 }, () => `<div class="img-box">${I.plus}</div>`).join("")}</div>`;
  const unitOpts = (sel) => UNITS.map((u) => `<option ${u === sel ? "selected" : ""}>${u}</option>`).join("");
  function subcatOptions(selected) {
    return SEED.categories.map((c) => {
      const kids = c.children && c.children.length ? c.children : [{ id: c.id, name: c.name }];
      return `<optgroup label="${attr(c.name)}">${kids.map((k) => `<option value="${attr(k.name)}" ${k.name === selected ? "selected" : ""}>${esc(k.name)}</option>`).join("")}</optgroup>`;
    }).join("");
  }
  // Flat list of selectable category names (subcategories, falling back to the root).
  function categoryNameList() { const out = []; SEED.categories.forEach((c) => { const kids = c.children && c.children.length ? c.children : [c]; kids.forEach((k) => out.push(k.name)); }); return out; }
  // Custom "Select or Add New Category" combo (matches the app dropdown).
  function catCombo(sel) {
    return `<div class="cat-combo"><input type="hidden" name="category" value="${attr(sel || "")}">
      <div class="cat-field" tabindex="0"><span class="cat-val ${sel ? "" : "ph"}">${sel ? esc(sel) : "Select Category"}</span><span class="chev">${I.chev}</span></div>
      <div class="cat-panel" hidden></div></div>`;
  }
  function mountCategoryCombo(panel) {
    const combo = panel.querySelector(".cat-combo"); if (!combo) return;
    const field = combo.querySelector(".cat-field"), hidden = combo.querySelector("[name=category]"), pane = combo.querySelector(".cat-panel"), valEl = combo.querySelector(".cat-val");
    let q = "";
    const renderPane = () => {
      const names = categoryNameList().filter((n) => !q || n.toLowerCase().includes(q.toLowerCase()));
      pane.innerHTML = `<input class="cat-search" placeholder="Search or select" value="${attr(q)}" style="width:100%;height:38px;border:1px solid var(--line);border-radius:8px;padding:0 12px;margin-bottom:6px;outline:none">
        <button type="button" class="cat-add">${I.plus} Add New Category</button>
        <div class="cat-list">${names.map((n) => `<div class="cat-opt" data-v="${attr(n)}">${esc(n)}</div>`).join("") || '<div class="cat-grp">No matches</div>'}</div>`;
      const s = pane.querySelector(".cat-search"); s.addEventListener("input", (e) => { q = e.target.value; renderPane(); s.focus(); });
      pane.querySelector(".cat-add").addEventListener("click", () => { close(); openAddCategoryModal((name) => { hidden.value = name; valEl.textContent = name; valEl.classList.remove("ph"); }); });
      pane.querySelectorAll(".cat-opt").forEach((o) => o.addEventListener("click", () => { hidden.value = o.dataset.v; valEl.textContent = o.dataset.v; valEl.classList.remove("ph"); close(); }));
    };
    const open = () => { combo.classList.add("open"); pane.hidden = false; renderPane(); setTimeout(() => document.addEventListener("click", onDocClose, true), 0); };
    const close = () => { combo.classList.remove("open"); pane.hidden = true; document.removeEventListener("click", onDocClose, true); };
    const onDocClose = (e) => { if (!combo.contains(e.target)) close(); };
    field.addEventListener("click", () => (pane.hidden ? open() : close()));
  }
  function openAddCategoryModal(onCreated) {
    const m = modal({ title: "Add Category",
      body: `<p style="margin:-8px 0 18px;color:var(--muted);font-size:13.5px">Add your Product category and necessary information from here</p>
        <div class="ac-row"><label>Name <span class="req">*</span></label><input id="acName" placeholder="Category Title"></div>
        <div class="ac-row"><label>Description</label><textarea id="acDesc" placeholder="Description"></textarea></div>
        <div class="ac-row"><label>Parent Category</label><select id="acParent"><option value="">Select Parent Category</option>${SEED.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></div>
        <div class="ac-row"><label>Image</label><div class="ac-img">${I.plus}</div></div>`,
      footer: `<button class="btn" data-close style="border-color:var(--line);color:var(--rose-500)">Cancel</button><button class="btn btn-primary" id="acDo">Add Category</button>` });
    m.panel.querySelector(".ac-img").addEventListener("click", () => toast("Category image upload (demo)"));
    m.panel.querySelector("#acDo").addEventListener("click", () => {
      const name = m.panel.querySelector("#acName").value.trim(); if (!name) { toast("Category name is required.", "err"); return; }
      const desc = m.panel.querySelector("#acDesc").value.trim(), pid = m.panel.querySelector("#acParent").value;
      if (pid) { const par = SEED.categories.find((c) => c.id === pid); par.children = par.children || []; par.children.push({ id: "cat-" + Date.now(), name, description: desc, productCount: 0 }); }
      else SEED.categories.push({ id: "cat-" + Date.now(), name, description: desc, parent: null, productCount: 0, children: [] });
      window.SEED.categories = SEED.categories;
      m.close(); toast(`Category "${name}" added`, "ok"); onCreated && onCreated(name);
    });
  }

  // ── Unit & Price modal (fills the drawer's unit/price fields) ──────────────
  // ── Add Pricing and Unit Details (matches UnitPriceForm.jsx) ──────────────
  function openUnitPriceModal(panel, opts) {
    opts = opts || {};
    const priceLabel = opts.isRawMaterial ? "Purchasing Price Per" : "Selling Price Per";
    const cur = { smallest: panel.querySelector("[name=unit]")?.value || "", base: panel.querySelector("[name=baseUnit]")?.value || "", conv: panel.querySelector("[name=conversionQty]")?.value || 1, price: panel.querySelector("[name=price]")?.value || "", gst: panel.querySelector("[name=gst]")?.value || 0, taxType: panel.querySelector("[name=taxType]")?.value || "Included in Price" };
    const dl = `<datalist id="unitDL">${UNITS.map((u) => `<option>${u}</option>`).join("")}</datalist>`;
    const m = modal({ title: "Add Pricing and Unit Details", panelClass: "upm-modal",
      body: `<p style="margin:-8px 0 18px;color:var(--muted);font-size:13.5px">Configure selling units, conversion quantities, GST treatment, and prices.</p>${dl}
        <div class="upm-units">
          <div class="upm-field"><div class="upm-lbl">Smallest Unit <span class="req">*</span></div><div class="upm-hint">e.g. Bottle, Piece, KG</div><input id="upSmall" list="unitDL" placeholder="Select or add unit" value="${attr(cur.smallest)}"></div>
          <div class="upm-field"><div class="upm-lbl">Base Unit <span class="req">*</span></div><div class="upm-hint">e.g. Box, Carton, Dozen</div><input id="upBase" list="unitDL" placeholder="Select or add unit" value="${attr(cur.base)}"></div>
        </div>
        <div id="upExpand"></div>` });
    const expand = m.panel.querySelector("#upExpand");
    const renderExpand = () => {
      const small = m.panel.querySelector("#upSmall").value.trim(), base = m.panel.querySelector("#upBase").value.trim();
      if (!small || !base) { expand.innerHTML = `<button class="upm-save" id="upSave" disabled>SAVE</button>`; return; }
      const SM = small.toUpperCase(), BS = base.toUpperCase();
      expand.innerHTML = `
        <div class="upm-conv-q">How many ${esc(SM)} per ${esc(BS)} ? <span class="req" style="color:var(--rose-500)">*</span></div>
        <div class="upm-conv">1 ${esc(BS)} = <input id="upConv" type="number" min="1" value="${cur.conv}"> ${esc(SM)}</div>
        <div class="upm-tax"><h4>Tax Settings</h4><div class="sub">Set the GST details for pricing.</div>
          <div class="upm-tax-grid">
            <div><div class="upm-lbl" style="color:#374151">GST Rate (%) <span class="req">*</span></div><select id="upGst" style="width:100%;height:44px;border:1px solid var(--line);border-radius:8px;padding:0 12px;margin-top:6px;outline:none">${[0, 5, 12, 18, 28].map((r) => `<option value="${r}" ${String(r) === String(cur.gst) ? "selected" : ""}>${r}%</option>`).join("")}</select></div>
            <div><div class="upm-lbl" style="color:#374151">GST Treatment <span class="req">*</span></div><div class="gst-treat" style="margin-top:6px">
              <div class="gst-card ${cur.taxType === "Included in Price" ? "on" : ""}" data-tt="Included in Price"><span class="rb"></span><span><b>Included in Price</b><small>Price already includes GST.</small></span></div>
              <div class="gst-card ${cur.taxType === "Added Separately" ? "on" : ""}" data-tt="Added Separately"><span class="rb"></span><span><b>Added Separately</b><small>GST will be added on top.</small></span></div>
            </div></div>
          </div></div>
        <div class="upm-price"><span class="lbl">${priceLabel} ${esc(SM)}</span><div class="box"><span class="cur">₹</span><input id="upPrice" type="number" min="0" step="0.01" placeholder="0.00" value="${attr(cur.price)}"></div></div>
        <div class="upm-price"><span class="lbl">${priceLabel} ${esc(BS)}</span><div class="box"><span class="cur">₹</span><input id="upPriceBase" type="number" min="0" step="0.01" placeholder="0.00"></div></div>
        <button class="upm-save" id="upSave">SAVE</button>`;
      const conv = () => +m.panel.querySelector("#upConv").value || 1;
      const syncBase = () => { const p = +m.panel.querySelector("#upPrice").value || 0; m.panel.querySelector("#upPriceBase").value = p ? (p * conv()).toFixed(2) : ""; };
      m.panel.querySelector("#upPrice").addEventListener("input", syncBase);
      m.panel.querySelector("#upConv").addEventListener("input", syncBase); syncBase();
      m.panel.querySelectorAll(".gst-card").forEach((c) => c.addEventListener("click", () => { cur.taxType = c.dataset.tt; m.panel.querySelectorAll(".gst-card").forEach((x) => x.classList.toggle("on", x.dataset.tt === cur.taxType)); }));
      m.panel.querySelector("#upSave").addEventListener("click", () => {
        const price = +m.panel.querySelector("#upPrice").value || 0; if (!price) { toast("Enter a selling price.", "err"); return; }
        const set = (n, v) => { const el = panel.querySelector(`[name=${n}]`); if (el) el.value = v; };
        set("unit", small); set("baseUnit", base); set("conversionQty", conv()); set("price", price); set("gst", m.panel.querySelector("#upGst").value); set("taxType", cur.taxType);
        const disp = panel.querySelector("#priceDisplay"); if (disp) disp.value = money(price);
        const upb = panel.querySelector(".unit-price-btn"); if (upb) { upb.textContent = `${small} · ₹${price} (1 ${base} = ${conv()} ${small})`; upb.classList.add("set"); }
        m.close(); toast("Unit & price set", "ok");
      });
    };
    m.panel.querySelector("#upSmall").addEventListener("input", renderExpand);
    m.panel.querySelector("#upBase").addEventListener("input", renderExpand);
    renderExpand();
  }

  // ── Export ────────────────────────────────────────────────────────────────
  const EXPORT = {
    Products: { headers: ["Category", "Sub Category", "Product", "Price", "Cost price", "Base Unit", "Secondary Unit", "Tax", "Stock"], rows: () => SEED.products.map((p) => [p.categoryTop, p.category, p.name, p.price, 0, p.baseUnit || p.unit, p.unit, (p.taxRate || 0) + "%", p.stockTotal]) },
    Categories: { headers: ["Name", "Description", "Parent Category", "Products"], rows: () => SEED.categories.map((c) => [c.name, c.description, "Root Category", c.productCount || 0]) },
    "Raw Materials": { headers: ["Name", "Article No", "Category", "Purchasing Price", "Tax", "Unit", "Stock"], rows: () => SEED.rawMaterials.map((r) => [r.name, r.articleNo, r.category, r.purchasingPrice, (r.taxRate || 0) + "%", r.unit, r.stockTotal]) },
  };
  function doExport(entity, kind) {
    const cfg = EXPORT[entity], base = entity.toLowerCase().replace(/\s+/g, "-");
    if (kind === "excel") { download(`${base}.xls`, toXLS(cfg.headers, cfg.rows()), "application/vnd.ms-excel"); toast(`Exported ${entity} to Excel`, "ok"); }
    else if (kind === "csv") { download(`${base}.csv`, toCSV(cfg.headers, cfg.rows()), "text/csv"); toast(`Exported ${entity} to CSV`, "ok"); }
    else { download(`${base}-sample.csv`, toCSV(cfg.headers, [cfg.rows()[0] || cfg.headers.map(() => "")]), "text/csv"); toast("Downloaded sample template", "ok"); }
  }
  const exportItems = (entity) => [
    { icon: I.sheet, title: "Export to Excel", sub: "Download an Excel workbook", onClick: () => doExport(entity, "excel") },
    { icon: I.download, title: "Export to CSV", sub: "Download a comma-separated file", onClick: () => doExport(entity, "csv") },
    { icon: I.file, title: "Download Sample", sub: "Get a formatted import template", onClick: () => doExport(entity, "sample") },
  ];
  function exportMenu(anchor, entity) { popover(anchor, exportItems(entity), { title: `Export ${entity}` }); }
  // Combined Import/Export bottom sheet (mobile footer "Import/Export").
  function importExportSheet(entity, importFn) {
    sheet(`${entity} Actions`, [
      { icon: I.upload, title: `Import ${entity}`, sub: "Upload a file or import from the directory", chev: true, onClick: importFn },
      { icon: I.download, title: `Export ${entity}`, sub: "Download your data as Excel or CSV", children: exportItems(entity), childTitle: `Export ${entity}` },
    ]);
  }

  // ── Import (preview modal) ────────────────────────────────────────────────
  const IMPORT = {
    Products: {
      headers: ["#", "Category", "Sub Category", "Product", "Price", "Cost price", "Base Unit", "Secondary Unit"],
      sample: [["WATER", "ROUND BOTTLE", "2ltr Bottle", 30, 0, "Box", "Bottle"], ["BREAD", "BREAD", "Special Bread 600gm", 42, 0, "Box", "Pc"], ["BREAD", "BREAD", "Fruit Bun 04Pcs", 16, 0, "Box", "Pc"], ["BREAD", "BREAD", "Pizza Base 250gm", 32, 0, "Box", "Pc"], ["CAKE", "CAKE", "Red Velvet Cake", 450, 0, "Box", "Pc"]],
      key: "products",
      fromRow: (r) => { const top = String(r[0] || "General").replace(/\b\w/g, (m) => m.toUpperCase()); const sub = String(r[1] || top).replace(/\b\w/g, (m) => m.toUpperCase()); const price = +r[3] || 0; return { id: "p-" + Date.now() + "-" + Math.floor(Math.random() * 999), name: r[2], articleNo: "IMP" + Math.floor(Math.random() * 9000 + 1000), category: sub, categoryTop: top, price, salePrice: null, taxRate: 0, unit: r[6] || "Pc", baseUnit: r[5] || "Box", stockTotal: 0, canSell: 0, inOrders: 0, brand: "Murli", active: true, img: r[2], packaging: [{ unit: r[6] || "Pc", tag: "Smallest Unit", conv: "1 " + (r[6] || "Pc"), price: inclTax(price, 0) }] }; },
      nameIdx: 2,
    },
    Categories: {
      headers: ["#", "Name", "Description", "Parent Category"],
      sample: [["Pastry", "Pastry", "Root Category"], ["Rusk", "Rusk", "Root Category"], ["Khari", "Khari", "Root Category"]],
      key: "categories",
      fromRow: (r) => ({ id: "cat-" + Date.now() + "-" + Math.floor(Math.random() * 999), name: r[1], description: r[2] || "", parent: null, productCount: 0, children: [] }),
      nameIdx: 1,
    },
    "Raw Materials": {
      headers: ["#", "Name", "Article No", "Category", "Purchasing Price", "Unit"],
      sample: [["Milk Powder", "RM-MLK-09", "Raw Material", 320, "KG"], ["Vanilla Essence", "RM-VNL-10", "Raw Material", 180, "L"]],
      key: "rawMaterials",
      fromRow: (r) => ({ id: "rm-" + Date.now() + "-" + Math.floor(Math.random() * 999), name: r[1], articleNo: r[2] || "RM" + Math.floor(Math.random() * 9000), category: r[3] || "Raw Material", img: r[1], purchasingPrice: +r[4] || 0, taxRate: 0, unit: r[5] || "KG", stockTotal: 0 }),
      nameIdx: 1,
    },
  };
  function importModal(entity, onDone) {
    const cfg = IMPORT[entity];
    let rows = []; // empty until the user browses/drops a file (or loads a sample)
    const dataCols = cfg.headers.length - 1;
    const renderPreview = () => `<div class="prev-scroll"><table class="prev-table"><thead><tr>${cfg.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td>${r.slice(0, dataCols).map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    const m = modal({ title: `Preview ${entity === "Products" ? "Product" : entity}`, wide: true,
      body: `<div class="import-drop"><div>${I.upload}</div><div style="margin-top:6px">Drop a CSV here or <span class="browse" id="browse">browse a file</span> to preview your rows.</div><div style="margin-top:8px;font-size:12.5px;color:var(--muted-2)">No file handy? <span class="browse" id="loadSample">Load sample data</span></div><input type="file" id="impFile" accept=".csv,text/csv"></div>
        <div class="import-note" id="impNote" style="display:none"></div>
        <div id="prev"></div>`,
      footer: `<button class="btn" data-close style="border-color:var(--line)">Cancel</button><button class="btn btn-primary" id="impDo">Import</button>` });
    const showPreview = (label) => { m.panel.querySelector("#prev").innerHTML = rows.length ? renderPreview() : ""; const note = m.panel.querySelector("#impNote"); if (rows.length) { note.style.display = ""; note.textContent = `Preview (${rows.length} rows${label ? " from " + label : ""}) — columns match the Download Sample template.`; } else { note.style.display = "none"; } };
    const fileInput = m.panel.querySelector("#impFile");
    m.panel.querySelector("#browse").addEventListener("click", () => fileInput.click());
    m.panel.querySelector("#loadSample").addEventListener("click", () => { rows = cfg.sample.map((r) => r.slice()); showPreview("sample data"); toast(`Loaded ${rows.length} sample rows`, "ok"); });
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const parsed = parseCSV(String(reader.result)); if (!parsed.length) { toast("Empty file", "err"); return; }
        const first = parsed[0].map((x) => String(x).toLowerCase());
        const hasHeader = first.includes("product") || first.includes("name") || first.includes("category");
        rows = (hasHeader ? parsed.slice(1) : parsed).map((r) => r.slice(0, dataCols));
        showPreview(file.name);
        toast(`Loaded ${rows.length} rows from ${file.name}`, "ok");
      };
      reader.readAsText(file);
    });
    m.panel.querySelector("#impDo").addEventListener("click", () => {
      const items = rows.filter((r) => String(r[cfg.nameIdx] || "").trim()).map((r) => cfg.fromRow(r));
      if (!items.length) { toast("Browse a CSV file (or load the sample) first.", "err"); return; }
      SEED[cfg.key].unshift(...items); window.SEED[cfg.key] = SEED[cfg.key];
      m.close(); onDone(items.length);
    });
  }

  // ── Sidebar / shell ───────────────────────────────────────────────────────
  const SIDEBAR = [
    { label: "Dashboard", icon: I.dash },
    { label: "Products", icon: I.box, group: true, children: [ { label: "All Products", key: "products", href: "all-products.html" }, { label: "Categories", key: "categories", href: "categories.html" }, { label: "Raw Materials", key: "raw-materials", href: "raw-materials.html" }, { label: "Image Gallery", key: "image-directory", href: "image-directory.html" } ] },
    { label: "Customers", icon: I.users, group: true, children: [{ label: "B2B Customers" }, { label: "Retail Customers" }] },
    { label: "Manage Routes", icon: I.route },
    { label: "Order", icon: I.cart },
    { label: "Deliveries", icon: I.truck },
    { label: "Route Delivery", icon: I.pin },
    { label: "Returns", icon: I.ret, group: true, children: [{ label: "Order Returns" }, { label: "Logistic Returns" }] },
    { label: "Inventory", icon: I.inv, group: true, children: [{ label: "FG Live Stock" }, { label: "RM Live Stock" }, { label: "FG Expiry Report" }] },
    { label: "Purchase", icon: I.cart, group: true, collapsed: true, children: [] },
    { label: "Route Delivery", icon: I.pin },
  ];
  function shell(active, title) {
    const nav = SIDEBAR.map((item) => {
      if (!item.group) return `<div class="nav-row" data-demo="${attr(item.label)}"><span class="ic">${item.icon}</span>${esc(item.label)}</div>`;
      const hasActive = (item.children || []).some((c) => c.key === active);
      const open = hasActive || !item.collapsed;
      const subs = (item.children || []).map((c) => c.key ? `<a class="sub ${c.key === active ? "active" : ""}" href="${c.href}"><span class="dash">–</span>${esc(c.label)}</a>` : `<div class="sub" data-demo="${attr(c.label)}"><span class="dash">–</span>${esc(c.label)}</div>`).join("");
      return `<div class="nav-row group ${open ? "open" : ""} ${hasActive ? "active-parent" : ""}" data-toggle><span class="ic">${item.icon}</span>${esc(item.label)}<span class="chev">${I.chev}</span></div><div class="nav-sub" ${open ? "" : "style=display:none"}>${subs}</div>`;
    }).join("");
    return `<div class="scrim" id="scrim"></div>
      <aside class="sidebar" id="sidebar"><div class="brand"><span class="logo">${I.bag}</span><span class="name">Murli</span></div><nav class="nav">${nav}</nav></aside>
      <div class="main"><div class="topbar"><button class="hamburger" id="hamburger">${I.menu}</button><span class="topbar-brand">${I.bag}</span><div class="page-title">${esc(title)}</div><div class="spacer"></div><div class="user"><div class="who"><b>Mahesh</b><br><small>Admin</small></div><div class="av">${I.user}</div></div></div><div class="content" id="content"></div></div>
      <div class="toast" id="toast"></div>`;
  }
  function wireShell() {
    const sb = document.getElementById("sidebar"), scrim = document.getElementById("scrim");
    document.getElementById("hamburger")?.addEventListener("click", () => { sb.classList.add("open"); scrim.classList.add("show"); });
    scrim?.addEventListener("click", () => { sb.classList.remove("open"); scrim.classList.remove("show"); });
    sb.querySelectorAll("[data-toggle]").forEach((row) => row.addEventListener("click", () => { const sub = row.nextElementSibling; if (!sub || !sub.classList.contains("nav-sub")) return; const open = row.classList.toggle("open"); sub.style.display = open ? "" : "none"; }));
    sb.querySelectorAll("[data-demo]").forEach((el) => el.addEventListener("click", () => toast(`${el.dataset.demo} lives in another module — this prototype covers Products`)));
  }

  function pager(total, page, onGo) {
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1, to = Math.min(total, page * PAGE_SIZE);
    let btns = ""; for (let i = 1; i <= pages; i++) btns += `<button class="pg ${i === page ? "active" : ""}" data-pg="${i}">${i}</button>`;
    const el = document.createElement("div"); el.className = "pager";
    el.innerHTML = `<span class="info">Showing ${from}-${to} of ${total}</span><div class="pages"><button class="pg" data-pg="${page - 1}" ${page === 1 ? "disabled" : ""}>‹</button>${btns}<button class="pg" data-pg="${page + 1}" ${page >= pages ? "disabled" : ""}>›</button></div>`;
    el.querySelectorAll("[data-pg]").forEach((b) => b.addEventListener("click", () => { const p = +b.dataset.pg; if (p >= 1 && p <= pages && p !== page) onGo(p); }));
    return el;
  }
  const pagerHTML = () => `<div class="pagerslot"></div>`;
  const mountPager = (root, total, page, onGo) => { const s = root.querySelector(".pagerslot"); if (s) s.replaceWith(pager(total, page, onGo)); };
  const emptyBlock = (t, m) => `<div class="table-wrap"><div class="empty"><div class="ic">${I.empty}</div><h2>${esc(t)}</h2><p>${m}</p></div></div>`;

  /* =========================================================================
     SCREEN 1 — ALL PRODUCTS
     ========================================================================= */
  function screenProducts() {
    const state = { search: "", category: "", tag: "all", page: 1, selected: new Set(), editing: null };
    const highCount = () => SEED.products.filter((p) => p.highMargin).length;
    const subcats = () => [...new Set(SEED.products.map((p) => p.category))];
    const content = document.getElementById("content");
    content.innerHTML = `
      ${pageHead("products")}
      <div class="toolbar"><button class="btn" id="export">${I.upload} Export</button><button class="btn" id="import">${I.download} Import</button><button class="btn" id="bulk">${I.bulk} Bulk Action <span class="caret">${I.chev}</span></button><div class="grow"></div><button class="btn btn-primary" id="add">${I.plus} Add Product</button></div>
      <div class="filters"><div class="search">${I.search}<input id="q" type="search" placeholder="Search Finished Goods"></div><select class="filter desktop-filter" id="cat"></select></div>
      <div class="chips chip-scroll" id="chips"></div><div id="list"></div>`;

    const fillCat = () => { document.getElementById("cat").innerHTML = `<option value="">Select Category</option>` + subcats().map((c) => `<option value="${attr(c)}" ${c === state.category ? "selected" : ""}>${esc(c)}</option>`).join(""); };
    function fillChips() {
      const chips = document.getElementById("chips"); if (!chips) return;
      chips.innerHTML = `<button class="chip-pill ${!state.category ? "active" : ""}" data-c="">All</button>` +
        subcats().map((c) => `<button class="chip-pill ${state.category === c ? "active" : ""}" data-c="${attr(c)}">${esc(c)}</button>`).join("");
      chips.querySelectorAll(".chip-pill").forEach((el) => el.addEventListener("click", () => { state.category = el.dataset.c; state.page = 1; const sel = document.getElementById("cat"); if (sel) sel.value = state.category; render(); }));
    }
    function filtered() { const q = state.search.trim().toLowerCase(); return SEED.products.filter((p) => { if (state.category && p.category !== state.category) return false; if (!q) return true; return p.name.toLowerCase().includes(q) || String(p.articleNo).toLowerCase().includes(q); }); }
    const topOf = (catName) => SEED.categories.find((c) => (c.children || []).some((k) => k.name === catName)) || SEED.categories.find((c) => c.name === catName);
    function productForm(p) {
      p = p || {};
      return [
        `<input type="hidden" name="unit" value="${attr(p.unit || "")}"><input type="hidden" name="baseUnit" value="${attr(p.baseUnit || "")}"><input type="hidden" name="conversionQty" value="${attr(p.conversionQty || 1)}"><input type="hidden" name="gst" value="${attr(p.taxRate || 0)}"><input type="hidden" name="taxType" value="${attr(p.taxType || "Included in Price")}">`,
        dRow("Article No", false, `<div class="with-btn"><input name="articleNo" value="${attr(p.articleNo || "")}" placeholder="Article No"><button type="button" class="btn btn-primary" data-generate="articleNo" style="height:44px">Generate</button></div>`),
        dRow("Title/Name", true, `<input name="name" value="${attr(p.name || "")}" placeholder="Title/Name" required>`),
        dRow("Description", false, `<textarea name="description" placeholder="Description">${esc(p.description || "")}</textarea>`),
        dRow("Images", false, imgGrid),
        dRow("HSN/SAC", false, `<input name="hsn" value="${attr(p.hsn || "")}" placeholder="HSN/SAC">`),
        dRow("Barcode", false, `<input name="barcode" value="${attr(p.barcode || "")}" placeholder="Barcode">`),
        dRow("Category", true, catCombo(p.category)),
        dRow('Unit &amp; Price', true, `<button type="button" class="unit-price-btn${p.unit ? " set" : ""}">${p.unit ? `${esc(p.unit)} · ₹${p.price} (1 ${esc(p.baseUnit || p.unit)} = ${p.conversionQty || 1} ${esc(p.unit)})` : "Select Unit &amp; Price"}</button>`),
        dRow('Price <i class="info-i">i</i>', false, `<input name="price" type="number" readonly value="${attr(p.price != null ? p.price : "")}" placeholder="0" style="background:#f3f4f6;color:var(--muted)">`),
        dRow("Opening Stock", false, `<input name="stockTotal" type="number" min="0" value="${attr(p.stockTotal != null ? p.stockTotal : "")}" placeholder="0">`),
        dRow("Brand", false, `<input name="brand" value="${attr(p.brand || "")}" placeholder="Enter product brand">`),
      ].join("");
    }
    function buildPack(price, rate, unit, baseUnit, conv) { return [{ unit, tag: "Smallest Unit", conv: "1 " + unit, price: inclTax(price, rate) }, ...(baseUnit && baseUnit !== unit ? [{ unit: baseUnit, tag: "Base Unit", conv: `1 ${baseUnit} = ${conv} ${unit}`, price: inclTax(price, rate) * conv }] : [])]; }
    function openAdd() {
      const panel = drawer({ title: "Add Product", subtitle: "Add your product and necessary information from here", saveLabel: "Add Product", body: productForm(),
        onSave: (f) => { if (!f.name.value.trim() || !f.category.value) { toast("Title and category are required.", "err"); return false; } if (!f.price.value) { toast("Set Unit & Price first.", "err"); return false; } const top = topOf(f.category.value), stock = +f.stockTotal.value || 0, rate = +f.gst.value, conv = +f.conversionQty.value || 1, unit = f.unit.value || "Pc", baseUnit = f.baseUnit.value || unit; SEED.products.unshift({ id: "p-" + Date.now(), name: f.name.value.trim(), articleNo: f.articleNo.value.trim() || "NEW" + Math.floor(Math.random() * 9000 + 1000), category: f.category.value, categoryTop: top ? top.name : "Uncategorised", description: f.description.value.trim(), hsn: f.hsn.value.trim(), price: +f.price.value, taxRate: rate, taxType: f.taxType.value, unit, baseUnit, conversionQty: conv, stockTotal: stock, canSell: stock, inOrders: 0, barcode: f.barcode.value.trim(), brand: f.brand.value.trim() || "Murli", active: true, img: "product", packaging: buildPack(+f.price.value, rate, unit, baseUnit, conv) }); state.page = 1; fillCat(); fillChips(); render(); toast(`"${f.name.value.trim()}" added`, "ok"); } });
      mountCategoryCombo(panel);
    }
    function openEdit(p) {
      const panel = drawer({ title: "Update Product", subtitle: p.name, saveLabel: "Update Product", body: productForm(p),
        onSave: (f) => { if (!f.name.value.trim() || !f.category.value) { toast("Title and category are required.", "err"); return false; } const top = topOf(f.category.value), rate = +f.gst.value, conv = +f.conversionQty.value || p.conversionQty || 1, unit = f.unit.value || p.unit, baseUnit = f.baseUnit.value || unit; Object.assign(p, { name: f.name.value.trim(), articleNo: f.articleNo.value.trim(), category: f.category.value, categoryTop: top ? top.name : p.categoryTop, description: f.description.value.trim(), hsn: f.hsn.value.trim(), price: +f.price.value || p.price, taxRate: rate, taxType: f.taxType.value, unit, baseUnit, conversionQty: conv, stockTotal: +f.stockTotal.value || 0, barcode: f.barcode.value.trim(), brand: f.brand.value.trim() || p.brand, packaging: buildPack(+f.price.value || p.price, rate, unit, baseUnit, conv) }); fillChips(); render(); toast("Product updated", "ok"); } });
      mountCategoryCombo(panel);
    }
    // ── Recategorize — right drawer (matches BulkActionDrawer) ──────────────
    function openRecategorize(ids) {
      drawer({ title: "Recategorize Products", subtitle: "Move the selected products into a new category in one go.", saveLabel: "Recategorize Products",
        body: dRow("Categories", false, `<select name="category"><option value="">Select Category</option>${subcatOptions()}</select>`),
        onSave: (f) => { const cat = f.category.value; if (!cat) { toast("Select a category.", "err"); return false; } const top = topOf(cat); SEED.products.forEach((p) => { if (ids.includes(p.id)) { p.category = cat; p.categoryTop = top ? top.name : p.categoryTop; } }); state.selected.clear(); fillCat(); render(); toast(`${ids.length} product(s) recategorized`, "ok"); } });
    }
    // ── Update prices — inline edit mode ("Editing N products") ─────────────
    function beginInlineEdit(ids) {
      state.editing = { ids: new Set(ids), drafts: {} };
      ids.forEach((id) => { const p = SEED.products.find((x) => x.id === id); if (p) state.editing.drafts[id] = { unit: p.unit, price: p.price, taxType: "Excl", taxRate: p.taxRate || 0 }; });
      render();
    }
    function renderEditMode() {
      const content = document.getElementById("content");
      const draftsCount = () => state.editing.ids.size;
      const rowsAll = SEED.products.slice(0, 40); // edit view lists the catalogue; checked rows are editable
      const rowHtml = (p) => {
        const on = state.editing.ids.has(p.id), d = state.editing.drafts[p.id];
        return `<tr data-id="${p.id}">
          <td><input class="checkbox erow" type="checkbox" data-id="${p.id}" ${on ? "checked" : ""}></td>
          <td><div class="prod-cell">${thumb(p)}<div><div class="prod-name">${esc(p.name)}</div><div class="prod-art">Art No: ${esc(p.articleNo)}</div></div></div></td>
          <td>${on ? `<div class="edit-cell"><select class="eu">${unitOpts(d.unit)}</select></div>` : `<span class="ro">${esc(p.unit)}</span>`}</td>
          <td>${on ? `<div class="edit-cell">₹<input class="price-in ep" type="number" min="0" step="0.01" value="${d.price}"></div>` : `<span class="price-main ro">${money(p.price)}</span>`}</td>
          <td>${on ? `<div class="edit-cell"><span class="tax-toggle"><button type="button" class="tt ${d.taxType === "Incl" ? "on" : ""}" data-t="Incl">Incl</button><button type="button" class="tt ${d.taxType === "Excl" ? "on" : ""}" data-t="Excl">Excl</button></span><select class="er">${[0, 5, 12, 18, 28].map((r) => `<option value="${r}" ${r === d.taxRate ? "selected" : ""}>${r}%</option>`).join("")}</select></div>` : `<span class="ro">${taxLabel(p.taxRate)}</span>`}</td>
        </tr>`;
      };
      content.innerHTML = `
        <div class="edit-bar"><span class="lbl">Editing ${draftsCount()} product${draftsCount() === 1 ? "" : "s"}</span><button class="btn" id="editCancel" style="border-color:var(--line)">${I.x} Cancel</button><button class="btn btn-primary" id="editSave">${I.check} Save changes</button></div>
        <div class="table-wrap"><div class="table-scroll"><table class="grid"><thead><tr><th></th><th>Name</th><th>Unit</th><th>Price</th><th>Tax</th></tr></thead><tbody>${rowsAll.map(rowHtml).join("")}</tbody></table></div></div>`;
      const bar = content.querySelector(".edit-bar .lbl");
      const refreshDrafts = (id) => { const tr = content.querySelector(`tr[data-id="${id}"]`); const d = state.editing.drafts[id]; if (!d || !tr) return;
        tr.querySelector(".eu")?.addEventListener("change", (e) => (d.unit = e.target.value));
        tr.querySelector(".ep")?.addEventListener("input", (e) => (d.price = +e.target.value));
        tr.querySelector(".er")?.addEventListener("change", (e) => (d.taxRate = +e.target.value));
        tr.querySelectorAll(".tt").forEach((b) => b.addEventListener("click", () => { d.taxType = b.dataset.t; tr.querySelectorAll(".tt").forEach((x) => x.classList.toggle("on", x.dataset.t === d.taxType)); }));
      };
      state.editing.ids.forEach(refreshDrafts);
      content.querySelectorAll(".erow").forEach((c) => c.addEventListener("change", () => {
        const id = c.dataset.id;
        if (c.checked) { const p = SEED.products.find((x) => x.id === id); state.editing.ids.add(id); state.editing.drafts[id] = { unit: p.unit, price: p.price, taxType: "Excl", taxRate: p.taxRate || 0 }; }
        else { state.editing.ids.delete(id); delete state.editing.drafts[id]; }
        renderEditMode();
      }));
      content.querySelector("#editCancel").addEventListener("click", () => { state.editing = null; render(); });
      content.querySelector("#editSave").addEventListener("click", () => {
        const n = state.editing.ids.size;
        state.editing.ids.forEach((id) => { const p = SEED.products.find((x) => x.id === id); const d = state.editing.drafts[id]; if (!p || !d) return; let base = d.price; if (d.taxType === "Incl") base = Math.round((d.price / (1 + d.taxRate / 100)) * 100) / 100; p.price = base; p.taxRate = d.taxRate; p.unit = d.unit; if (p.packaging && p.packaging[0]) p.packaging[0].price = inclTax(base, d.taxRate); });
        state.editing = null; state.selected.clear(); render(); toast(`${n} product price(s) updated`, "ok");
      });
      const mf = document.getElementById("mfooter"); if (mf) mf.remove();
    }
    // ── Assign tags — "Create product tag" drawer ───────────────────────────
    function openAssignTags(ids) {
      const chosen = new Set(), picked = new Set(ids);
      let search = "";
      const panel = drawer({ title: "Create product tag", subtitle: "Name the tag, search products and select the products that belong to it.", saveLabel: "Save", wide: true,
        body: `<div class="tag-search">${I.search}<input id="tagSearch" placeholder="Search..."></div>
          <div class="tag-add-box"><div class="row"><input id="tagNew" placeholder="e.g. Seasonal, High margin"><button type="button" class="btn btn-primary" id="tagAdd">${I.plus} Add Tag</button></div><div class="hint" id="tagCount">0/10 tags · Enter or comma to add</div><div class="tag-current" id="tagCurrent"></div></div>
          <div class="tgrid" id="tgrid"></div>
          <div class="ptag-sub" id="selCount" style="margin-top:14px">${picked.size} selected</div>`,
        onSave: () => { if (!chosen.size) { toast("Add at least one tag.", "err"); return false; } if (!picked.size) { toast("Select at least one product.", "err"); return false; }
          SEED.products.forEach((p) => { if (picked.has(p.id)) { p.tags = [...new Set([...(p.tags || []), ...chosen])]; if (chosen.has("High margin")) p.highMargin = true; } });
          state.selected.clear(); fillChips(); render(); toast(`Tag applied to ${picked.size} product(s)`, "ok"); } });
      const grid = panel.querySelector("#tgrid"), cur = panel.querySelector("#tagCurrent");
      const renderGrid = () => { const q = search.trim().toLowerCase();
        grid.innerHTML = SEED.products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || String(p.articleNo).toLowerCase().includes(q)).map((p) => `<div class="tcard ${picked.has(p.id) ? "sel" : ""}" data-id="${p.id}">${thumb(p, 80)}<div class="grow"><div class="nm">${esc(p.name)}</div><div class="sub">Art No: ${esc(p.articleNo)} · ${esc(p.category)}</div><div class="ptags">${(p.tags || []).map((t) => `<span class="t">${esc(t)}</span>`).join("") || '<span class="sub">No tags</span>'}</div></div><div style="text-align:right"><div class="price">${money(p.price)}</div><div class="ck">${picked.has(p.id) ? I.check : ""}</div></div></div>`).join("");
        grid.querySelectorAll(".tcard").forEach((c) => c.addEventListener("click", () => { const id = c.dataset.id; picked.has(id) ? picked.delete(id) : picked.add(id); panel.querySelector("#selCount").textContent = `${picked.size} selected`; renderGrid(); }));
      };
      const renderCur = () => { cur.innerHTML = [...chosen].map((t) => `<span class="chip" data-t="${attr(t)}">${esc(t)} <button type="button">${I.x}</button></span>`).join(""); cur.querySelectorAll(".chip button").forEach((b) => b.addEventListener("click", () => { chosen.delete(b.parentNode.dataset.t); panel.querySelector("#tagCount").textContent = `${chosen.size}/10 tags · Enter or comma to add`; renderCur(); })); panel.querySelector("#tagCount").textContent = `${chosen.size}/10 tags · Enter or comma to add`; };
      const addTag = () => { const v = panel.querySelector("#tagNew").value.trim().replace(/,$/, ""); if (!v || chosen.has(v) || chosen.size >= 10) return; chosen.add(v); panel.querySelector("#tagNew").value = ""; renderCur(); };
      panel.querySelector("#tagAdd").addEventListener("click", addTag);
      panel.querySelector("#tagNew").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } });
      panel.querySelector("#tagSearch").addEventListener("input", (e) => { search = e.target.value; renderGrid(); });
      renderCur(); renderGrid();
    }
    function bulkMenu(anchor) {
      const ids = [...state.selected]; const need = () => { if (!ids.length) { toast("Select products first, then choose a bulk action.", "err"); return false; } return true; };
      popover(anchor, [
        { icon: I.edit, title: "Recategorize products", sub: "Move the selected products into a new category", onClick: () => need() && openRecategorize(ids) },
        { icon: I.rupee, title: "Update prices", sub: "Edit unit price and tax for the selected products", onClick: () => need() && beginInlineEdit(ids) },
        { icon: I.tag, title: "Assign tags", sub: "Add or remove tags on the selected products", onClick: () => need() && openAssignTags(ids) },
        { sep: true },
        { icon: I.trash, title: "Delete", sub: "Permanently remove the selected products", danger: true, onClick: () => { if (!need()) return; confirmDelete({ bulk: true, count: ids.length, entity: "product", onConfirm: () => { SEED.products = SEED.products.filter((p) => !state.selected.has(p.id)); window.SEED.products = SEED.products; state.selected.clear(); fillChips(); render(); toast(`${ids.length} products deleted`, "ok"); } }); } },
      ], { title: "Products Actions" });
    }
    function render() {
      if (state.editing) { renderEditMode(); return; }
      if (!document.getElementById("chips")) { screenProducts(); return; }
      const rows = filtered(); const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE)); if (state.page > pages) state.page = pages;
      const slice = rows.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
      fillChips();
      const list = document.getElementById("list");
      if (rows.length === 0) { list.innerHTML = emptyBlock("No products found", "Try another search term or clear the filters."); return; }
      const allChecked = slice.length && slice.every((p) => state.selected.has(p.id));
      const tbody = slice.map((p) => `<tr><td><input class="checkbox row-check" type="checkbox" data-id="${p.id}" ${state.selected.has(p.id) ? "checked" : ""}></td><td><div class="prod-cell">${thumb(p)}<div><div class="prod-name">${esc(p.name)}</div><div class="prod-art">Art No: ${esc(p.articleNo)}</div></div></div></td><td><span class="cat-text">${esc(p.category)}</span></td><td><div class="price-main">${money(p.price)}</div><div class="price-tax">${taxLabel(p.taxRate)}</div></td><td><div><span class="stock-total">${p.stockTotal}</span> <span class="stock-unit">${esc(p.unit)}</span> <span class="stock-label">total stock</span></div><div class="stock-sub"><span class="${p.canSell > 0 ? "ok" : "bad"}">${p.canSell} can sell</span><span class="dot">·</span><span class="${p.inOrders > 0 ? "warn" : "bad"}">${p.inOrders} in orders</span></div></td><td><div class="row-actions"><button class="icon-btn" title="View" data-act="view" data-id="${p.id}">${I.eye}</button><button class="icon-btn" title="Edit" data-act="edit" data-id="${p.id}">${I.edit}</button><button class="icon-btn danger" title="Delete" data-act="del" data-id="${p.id}">${I.trash}</button></div></td></tr>`).join("");
      const cards = slice.map((p) => { const inStock = p.stockTotal > 0; return `<div class="pcard" data-id="${p.id}">
        <div class="pc-top"><span class="icheckwrap"><input class="checkbox row-check" type="checkbox" data-id="${p.id}" ${state.selected.has(p.id) ? "checked" : ""}></span>${thumb(p, 120)}
          <div class="pc-main"><div class="pc-name">${esc(p.name)}</div><div class="pc-art">Art No: ${esc(p.articleNo)}</div><span class="chip-cat green">${esc(p.category)}</span></div>
          <div class="pc-right"><span class="stock-badge ${inStock ? "in" : "out"}">${inStock ? "In Stock" : "Out of Stock"}</span><div class="price-main">${money(p.price)}</div><div class="price-tax">${taxLabel(p.taxRate)}</div></div>
        </div>
        <div class="pc-stats"><div class="st"><b>${p.stockTotal}</b><span>${esc(p.unit)} total</span></div><div class="st"><b class="ok">${p.canSell}</b><span>Can sell</span></div><div class="st"><b class="warn">${p.inOrders}</b><span>In orders</span></div>
          <div class="pc-acts"><button class="icon-btn" data-act="view" data-id="${p.id}">${I.eye}</button><button class="icon-btn" data-act="edit" data-id="${p.id}">${I.edit}</button><button class="icon-btn danger" data-act="del" data-id="${p.id}">${I.trash}</button></div></div>
      </div>`; }).join("");
      list.innerHTML = `<div class="table-wrap desktop-only"><div class="table-scroll"><table class="grid"><thead><tr><th><input class="checkbox" id="selall" type="checkbox" ${allChecked ? "checked" : ""}></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th style="text-align:right">Actions</th></tr></thead><tbody>${tbody}</tbody></table>${pagerHTML()}</div></div><div class="cards">${cards}</div>`;
      mountPager(list, rows.length, state.page, (p) => { state.page = p; render(); window.scrollTo({ top: 0, behavior: "smooth" }); });
      list.querySelectorAll(".row-check").forEach((c) => c.addEventListener("change", () => { c.checked ? state.selected.add(c.dataset.id) : state.selected.delete(c.dataset.id); render(); }));
      document.getElementById("selall")?.addEventListener("change", (e) => { slice.forEach((p) => (e.target.checked ? state.selected.add(p.id) : state.selected.delete(p.id))); render(); });
      list.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => { const p = SEED.products.find((x) => x.id === b.dataset.id); if (b.dataset.act === "del") confirmDelete({ name: p.name, entity: "product", catalogues: 1, onConfirm: () => { SEED.products = SEED.products.filter((x) => x.id !== p.id); window.SEED.products = SEED.products; state.selected.delete(p.id); fillChips(); render(); toast(`"${p.name}" deleted`, "ok"); } }); else if (b.dataset.act === "edit") openEdit(p); else productDetail(p, () => screenProducts(), openEdit); }));
      const importFn = () => importModal("Products", (n) => { state.page = 1; fillCat(); fillChips(); render(); toast(`${n} products imported`, "ok"); });
      footer([
        { icon: I.upload, label: "Import/Export", onClick: () => importExportSheet("Products", importFn) },
        { icon: I.plus, label: "Product", cls: "primary", onClick: openAdd },
        { icon: I.bulk, label: "Bulk Action", onClick: (el) => bulkMenu(el) },
      ]);
    }
    let deb;
    document.getElementById("q").addEventListener("input", (e) => { clearTimeout(deb); deb = setTimeout(() => { state.search = e.target.value; state.page = 1; render(); }, 200); });
    document.getElementById("cat").addEventListener("change", (e) => { state.category = e.target.value; state.page = 1; render(); });
    document.getElementById("add").addEventListener("click", openAdd);
    document.getElementById("export").addEventListener("click", (e) => exportMenu(e.currentTarget, "Products"));
    document.getElementById("import").addEventListener("click", () => importModal("Products", (n) => { state.page = 1; fillCat(); fillChips(); render(); toast(`${n} products imported`, "ok"); }));
    document.getElementById("bulk").addEventListener("click", (e) => bulkMenu(e.currentTarget));
    fillCat(); fillChips(); render();
  }

  /* ── Product detail view ─────────────────────────────────────────────────── */
  function productDetail(p, onBack, onEdit) {
    const content = document.getElementById("content");
    const incl = p.packaging && p.packaging[0] ? p.packaging[0].price : inclTax(p.price, p.taxRate);
    const thumbs = Array.from({ length: 4 }, (_, i) => `<div class="t ${i === 0 ? "sel" : ""}">${I.imgph}</div>`).join("");
    const meta = [["SKU / Article No.", p.articleNo], ["Category", p.category], ["Brand", p.brand || "Murli"], ["Unit (Smallest)", p.unit], ["Base Unit", p.baseUnit || p.unit], ["Barcode", p.barcode || "—"]].map(([l, v]) => `<div class="m"><div class="lbl">${esc(l)}</div><div class="val">${esc(v)}</div></div>`).join("");
    const packRows = (p.packaging || []).map((u) => `<tr><td><b>${esc(u.unit)}</b><span class="unit-tag">${esc(u.tag)}</span></td><td>${esc(u.conv)}</td><td>${money(u.price)}</td></tr>`).join("");
    content.innerHTML = `
      <div class="detail-top"><button class="back" id="detailBack">${I.back}</button><div class="breadcrumb">Product › <b>${esc(p.name)}</b></div><div style="flex:1"></div><button class="btn btn-primary" id="detailEdit">${I.edit} Edit Product</button></div>
      <div class="detail-card"><div class="detail-gallery"><div class="big"><img src="${attr(imgUrl(p, 400))}" alt="${attr(p.name)}" onerror="this.closest('.big').classList.add('noimg');this.remove();"><span class="ph">${I.imgphL}</span></div><div class="detail-thumbs">${thumbs}</div></div><div class="detail-info"><h1>${esc(p.name)} ${p.active ? '<span class="badge-active">Active</span>' : ""}</h1><p class="detail-desc">${esc(p.description || "")}</p><div class="detail-meta">${meta}</div>${p.highMargin ? `<span class="detail-tag">High margin</span>` : ""}</div><div class="detail-price"><div class="lbl">Selling Price (Incl. tax)</div><div class="big">${money(incl)}</div><div class="lbl">Tax Rate</div><div class="big" style="font-size:22px">${p.taxRate || 0}%</div></div></div>
      <div class="detail-grid2"><div class="panel"><h3>${I.layers} Packaging &amp; Units</h3><table class="pack-table"><thead><tr><th>Unit</th><th>Conversion</th><th>Price (${p.taxRate || 0}% Incl. Tax)</th></tr></thead><tbody>${packRows}</tbody></table></div><div class="panel"><h3>${I.pkg} Inventory Summary</h3><div class="inv-tiles"><div class="inv-tile"><div class="ic">${I.pkg}</div><div class="n">${p.stockTotal}</div><div class="l">Total Stock</div></div><div class="inv-tile"><div class="ic">${I.check}</div><div class="n">${p.canSell}</div><div class="l">Available Stock</div></div><div class="inv-tile warn"><div class="ic">${I.lock}</div><div class="n">${p.inOrders}</div><div class="l">Stock Reserved In Order</div></div></div></div></div>`;
    document.getElementById("detailBack").addEventListener("click", onBack);
    document.getElementById("detailEdit").addEventListener("click", () => onEdit(p));
    const mf = document.getElementById("mfooter"); if (mf) mf.remove();
  }

  /* =========================================================================
     SCREEN 2 — CATEGORIES
     ========================================================================= */
  function screenCategories() {
    const state = { search: "", showChild: false, page: 1, expanded: new Set() };
    const content = document.getElementById("content");
    content.innerHTML = `
      ${pageHead("categories")}
      <div class="toolbar"><button class="btn" id="export">${I.upload} Export</button><button class="btn" id="import">${I.download} Import</button><div class="grow"></div><button class="btn btn-primary" id="add">${I.plus} Add Category</button></div>
      <div class="filters"><div class="search">${I.search}<input id="q" type="search" placeholder="Search by Category name"></div><label class="toggle-wrap"><span class="switch ${state.showChild ? "on" : ""}" id="sw"></span> Show subcategories</label></div>
      <div id="list"></div>`;
    function filtered() { const q = state.search.trim().toLowerCase(); if (!q) return SEED.categories.map((c) => ({ ...c })); const out = []; SEED.categories.forEach((c) => { const pm = c.name.toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q); const kids = (c.children || []).filter((k) => k.name.toLowerCase().includes(q) || (k.description || "").toLowerCase().includes(q)); if (pm) { out.push({ ...c }); if (kids.length) state.expanded.add(c.id); } else if (kids.length) { out.push({ ...c, children: kids }); state.expanded.add(c.id); } }); return out; }
    function categoryForm(c) { c = c || {}; return [dRow("Name", true, `<input name="name" value="${attr(c.name || "")}" placeholder="Category name" required>`), dRow("Parent Category", false, `<select name="parent"><option value="">— None (top-level) —</option>${SEED.categories.filter((x) => x.id !== c.id).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select>`, "Leave empty to create a root category."), dRow("Description", false, `<textarea name="description" placeholder="Category description">${esc(c.description || "")}</textarea>`), dRow("Category Icon", false, imgGrid)].join(""); }
    function openAdd() { drawer({ title: "Add Category", subtitle: "Add your category and necessary information from here", saveLabel: "Add Category", body: categoryForm(), onSave: (f) => { if (!f.name.value.trim()) { toast("Category name is required.", "err"); return false; } const name = f.name.value.trim(), desc = f.description.value.trim(), pid = f.parent.value; if (pid) { const par = SEED.categories.find((c) => c.id === pid); par.children = par.children || []; par.children.push({ id: "cat-" + Date.now(), name, description: desc, productCount: 0 }); state.expanded.add(pid); } else SEED.categories.push({ id: "cat-" + Date.now(), name, description: desc, parent: null, productCount: 0, children: [] }); render(); toast(`Category "${name}" added`, "ok"); } }); }
    function openEdit(c) { drawer({ title: "Update Category", subtitle: c.name, saveLabel: "Update Category", body: categoryForm(c), onSave: (f) => { if (!f.name.value.trim()) { toast("Category name is required.", "err"); return false; } c.name = f.name.value.trim(); c.description = f.description.value.trim(); render(); toast("Category updated", "ok"); } }); }
    function render() {
      const all = filtered(); const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE)); if (state.page > pages) state.page = pages;
      const slice = all.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
      document.getElementById("sw").classList.toggle("on", state.showChild);
      const list = document.getElementById("list");
      if (all.length === 0) { list.innerHTML = emptyBlock("No categories found", `No categories match "${esc(state.search)}".`); return; }
      let rows = "", cards = "";
      slice.forEach((c) => { const hasKids = (c.children || []).length > 0, open = state.showChild && hasKids && state.expanded.has(c.id);
        rows += `<tr class="cat-parent-row"><td><div class="cat-parent-name">${state.showChild && hasKids ? `<button class="cat-caret ${open ? "open" : ""}" data-toggle="${c.id}">${I.chevR}</button>` : `<span style="width:22px;display:inline-block"></span>`}<input class="checkbox" type="checkbox" style="margin-right:2px">${esc(c.name)}</div></td><td>${esc(c.description)}</td><td><span class="pill-root">Root Category</span></td><td><span class="badge-num">${I.pkg} ${c.productCount || 0}</span></td><td><div class="row-actions"><button class="icon-btn" data-act="edit" data-id="${c.id}">${I.edit}</button><button class="icon-btn danger" data-act="del" data-id="${c.id}">${I.trash}</button></div></td></tr>`;
        if (open) (c.children || []).forEach((k) => { rows += `<tr class="cat-child-row"><td><div class="cat-child-name">${esc(k.name)}</div></td><td>${esc(k.description)}</td><td><span class="pill-root">${esc(c.name)}</span></td><td><span class="badge-num">${I.pkg} ${k.productCount || 0}</span></td><td><div class="row-actions"><button class="icon-btn" data-act="edit-child" data-id="${k.id}" data-parent="${c.id}">${I.edit}</button><button class="icon-btn danger" data-act="del-child" data-parent="${c.id}" data-id="${k.id}">${I.trash}</button></div></td></tr>`; });
        const kidCount = (c.children || []).length;
        const mOpen = state.showChild && kidCount && state.expanded.has(c.id);
        cards += `<div class="catcard-wrap">
          <div class="catcard"><input class="checkbox" type="checkbox"><span class="thumb noimg"><span class="ph">${I.imgph}</span></span>
            <div class="grow"><div class="nm">${esc(c.name)}</div><div class="ds">${esc(c.description || "Root Category")}</div><div class="subc">${kidCount} subcategor${kidCount === 1 ? "y" : "ies"}</div></div>
            <div class="acts"><button class="icon-btn" data-act="edit" data-id="${c.id}">${I.edit}</button><button class="icon-btn danger" data-act="del" data-id="${c.id}">${I.trash}</button>${state.showChild && kidCount ? `<button class="icon-btn cat-toggle ${mOpen ? "open" : ""}" data-mtoggle="${c.id}">${I.chev}</button>` : ""}</div>
          </div>
          ${mOpen ? `<div class="subcat-list">${(c.children || []).map((k) => `<div class="subrow"><span class="drag">${I.grip}</span><span class="thumb noimg"><span class="ph">${I.imgph}</span></span><div class="grow"><div class="nm">${esc(k.name)}</div><div class="ds">${esc(k.description || "")}</div></div><span class="badge-num">${I.pkg} ${k.productCount || 0}</span><button class="icon-btn" data-act="edit-child" data-id="${k.id}" data-parent="${c.id}">${I.edit}</button><button class="icon-btn danger" data-act="del-child" data-id="${k.id}" data-parent="${c.id}">${I.trash}</button></div>`).join("")}<button class="add-subcat" data-addsub="${c.id}">${I.plus} Add subcategory</button></div>` : ""}
        </div>`;
      });
      list.innerHTML = `<div class="table-wrap desktop-only"><div class="table-scroll"><table class="grid"><thead><tr><th>Name</th><th>Description</th><th>Parent Category</th><th>Products</th><th style="text-align:right">Actions</th></tr></thead><tbody>${rows}</tbody></table>${pagerHTML()}</div></div><div class="cards">${cards}</div>`;
      mountPager(list, all.length, state.page, (p) => { state.page = p; render(); });
      list.querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", () => { const id = b.dataset.toggle; state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id); render(); }));
      list.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => {
        const act = b.dataset.act;
        if (act === "del") { const c = SEED.categories.find((x) => x.id === b.dataset.id); confirmDelete({ name: c.name, entity: "category", onConfirm: () => { SEED.categories = SEED.categories.filter((x) => x.id !== c.id); window.SEED.categories = SEED.categories; render(); toast(`Category "${c.name}" deleted`, "ok"); } }); }
        else if (act === "del-child") { const par = SEED.categories.find((x) => x.id === b.dataset.parent); const k = par.children.find((x) => x.id === b.dataset.id); confirmDelete({ name: k.name, entity: "category", onConfirm: () => { par.children = par.children.filter((x) => x.id !== b.dataset.id); render(); toast(`"${k.name}" deleted`, "ok"); } }); }
        else if (act === "edit") openEdit(SEED.categories.find((x) => x.id === b.dataset.id));
        else { const par = SEED.categories.find((x) => x.id === b.dataset.parent); const k = par.children.find((x) => x.id === b.dataset.id); drawer({ title: "Update Subcategory", subtitle: k.name, saveLabel: "Update", body: [dRow("Name", true, `<input name="name" value="${attr(k.name)}" required>`), dRow("Description", false, `<textarea name="description">${esc(k.description || "")}</textarea>`)].join(""), onSave: (f) => { if (!f.name.value.trim()) return false; k.name = f.name.value.trim(); k.description = f.description.value.trim(); render(); toast("Subcategory updated", "ok"); } }); }
      }));
      list.querySelectorAll("[data-mtoggle]").forEach((b) => b.addEventListener("click", () => { const id = b.dataset.mtoggle; state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id); render(); }));
      list.querySelectorAll("[data-addsub]").forEach((b) => b.addEventListener("click", () => {
        const par = SEED.categories.find((x) => x.id === b.dataset.addsub);
        drawer({ title: "Add Subcategory", subtitle: `Under "${par.name}"`, saveLabel: "Add Subcategory", body: [dRow("Name", true, `<input name="name" placeholder="Subcategory name" required>`), dRow("Description", false, `<textarea name="description" placeholder="Description"></textarea>`), dRow("Image", false, imgGrid)].join(""), onSave: (f) => { if (!f.name.value.trim()) { toast("Subcategory name is required.", "err"); return false; } par.children = par.children || []; par.children.push({ id: "cat-" + Date.now(), name: f.name.value.trim(), description: f.description.value.trim(), productCount: 0 }); state.expanded.add(par.id); render(); toast(`Subcategory "${f.name.value.trim()}" added`, "ok"); } });
      }));
      const importFn = () => importModal("Categories", (n) => { render(); toast(`${n} categories imported`, "ok"); });
      footer([
        { icon: I.upload, label: "Import/Export", onClick: () => importExportSheet("Categories", importFn) },
        { icon: I.plus, label: "Add", cls: "primary", onClick: openAdd },
      ]);
    }
    let deb;
    document.getElementById("q").addEventListener("input", (e) => { clearTimeout(deb); deb = setTimeout(() => { state.search = e.target.value; state.page = 1; render(); }, 200); });
    document.getElementById("sw").addEventListener("click", () => { state.showChild = !state.showChild; if (state.showChild) SEED.categories.forEach((c) => state.expanded.add(c.id)); render(); });
    document.getElementById("add").addEventListener("click", openAdd);
    document.getElementById("export").addEventListener("click", (e) => exportMenu(e.currentTarget, "Categories"));
    document.getElementById("import").addEventListener("click", () => importModal("Categories", (n) => { render(); toast(`${n} categories imported`, "ok"); }));
    render();
  }

  /* =========================================================================
     SCREEN 3 — RAW MATERIALS
     ========================================================================= */
  function screenRawMaterials() {
    const state = { search: "", category: "", page: 1, selected: new Set() };
    const cats = () => [...new Set(SEED.rawMaterials.map((r) => r.category))];
    const content = document.getElementById("content");
    content.innerHTML = `
      ${pageHead("raw-materials")}
      <div class="toolbar"><button class="btn" id="export">${I.upload} Export</button><button class="btn" id="import">${I.download} Import</button><button class="btn" id="bulk">${I.bulk} Bulk Action <span class="caret">${I.chev}</span></button><div class="grow"></div><button class="btn btn-primary" id="add">${I.plus} Add Raw Material</button></div>
      <div class="filters"><div class="search">${I.search}<input id="q" type="search" placeholder="Search Raw Material"></div><select class="filter desktop-filter" id="cat"></select></div>
      <div class="chips chip-scroll" id="chips"></div><div id="list"></div>`;
    const fillCat = () => { document.getElementById("cat").innerHTML = `<option value="">Select Category</option>` + cats().map((c) => `<option value="${attr(c)}" ${c === state.category ? "selected" : ""}>${esc(c)}</option>`).join(""); };
    function fillChips() {
      const chips = document.getElementById("chips"); if (!chips) return;
      chips.innerHTML = `<button class="chip-pill ${!state.category ? "active" : ""}" data-c="">All</button>` +
        cats().map((c) => `<button class="chip-pill ${state.category === c ? "active" : ""}" data-c="${attr(c)}">${esc(c)}</button>`).join("");
      chips.querySelectorAll(".chip-pill").forEach((el) => el.addEventListener("click", () => { state.category = el.dataset.c; state.page = 1; const sel = document.getElementById("cat"); if (sel) sel.value = state.category; render(); }));
    }
    function filtered() { const q = state.search.trim().toLowerCase(); return SEED.rawMaterials.filter((r) => { if (state.category && r.category !== state.category) return false; if (!q) return true; return r.name.toLowerCase().includes(q) || String(r.articleNo).toLowerCase().includes(q); }); }
    function rmForm(r) { r = r || {}; return [dRow("Article No", false, `<div class="with-btn"><input name="articleNo" value="${attr(r.articleNo || "")}" placeholder="Article No"><button type="button" class="btn btn-primary" data-generate="articleNo" style="height:44px">Generate</button></div>`), dRow("Title/Name", true, `<input name="name" value="${attr(r.name || "")}" placeholder="Title/Name" required>`), dRow("Description", false, `<textarea name="description" placeholder="Description">${esc(r.description || "")}</textarea>`), dRow("Images", false, imgGrid), dRow("HSN/SAC", false, `<input name="hsn" value="${attr(r.hsn || "")}" placeholder="HSN/SAC">`), dRow("Barcode", false, `<input name="barcode" value="${attr(r.barcode || "")}" placeholder="Barcode">`), dRow("Category", true, `<select name="category"><option value="">Select Category</option><option ${r.category === "Raw Material" ? "selected" : ""}>Raw Material</option><option ${r.category === "Packaging" ? "selected" : ""}>Packaging</option>${subcatOptions(r.category)}</select>`), dRow("Unit &amp; Price", true, `<button type="button" class="unit-price-btn">Select Unit &amp; Price</button>`), dRow("Unit", false, `<select name="unit">${unitOpts(r.unit || "KG")}</select>`), dRow("Purchasing Price", true, `<input name="price" type="number" min="0" step="0.01" value="${attr(r.purchasingPrice != null ? r.purchasingPrice : "")}" placeholder="0" required>`), dRow("Opening Stock", false, `<input name="stockTotal" type="number" min="0" value="${attr(r.stockTotal != null ? r.stockTotal : "")}" placeholder="0">`), `<input type="hidden" name="baseUnit"><input type="hidden" name="conversionQty"><input type="hidden" name="gst" value="${attr(r.taxRate || 0)}">`].join(""); }
    function openAdd() { drawer({ title: "Add Raw Material", subtitle: "Add your raw material and necessary information from here", saveLabel: "Add Raw Material", body: rmForm(), onSave: (f) => { if (!f.name.value.trim() || !f.price.value) { toast("Title and purchasing price are required.", "err"); return false; } SEED.rawMaterials.unshift({ id: "rm-" + Date.now(), name: f.name.value.trim(), articleNo: f.articleNo.value.trim() || "RM" + Math.floor(Math.random() * 9000 + 1000), category: f.category.value || "Raw Material", img: "raw,material", purchasingPrice: +f.price.value, taxRate: 0, unit: f.unit.value, stockTotal: +f.stockTotal.value || 0 }); state.page = 1; fillCat(); render(); toast(`"${f.name.value.trim()}" added`, "ok"); } }); }
    function openEdit(r) { drawer({ title: "Update Raw Material", subtitle: r.name, saveLabel: "Update Raw Material", body: rmForm(r), onSave: (f) => { if (!f.name.value.trim() || !f.price.value) { toast("Title and purchasing price are required.", "err"); return false; } Object.assign(r, { name: f.name.value.trim(), articleNo: f.articleNo.value.trim(), category: f.category.value || r.category, purchasingPrice: +f.price.value, unit: f.unit.value, stockTotal: +f.stockTotal.value || 0 }); fillCat(); render(); toast("Raw material updated", "ok"); } }); }
    function bulkMenu(anchor) {
      const ids = [...state.selected]; const need = () => { if (!ids.length) { toast("Select raw materials first, then choose a bulk action.", "err"); return false; } return true; };
      popover(anchor, [
        { icon: I.edit, title: "Recategorize raw materials", onClick: () => { if (!need()) return; drawer({ title: "Recategorize Raw Materials", subtitle: "Move the selected raw materials into a new category in one go.", saveLabel: "Recategorize Raw Materials", body: dRow("Move to category", false, `<input name="category" placeholder="e.g. Packaging" list="rmCatDL"><datalist id="rmCatDL">${[...new Set(SEED.rawMaterials.map((r) => r.category))].map((c) => `<option>${esc(c)}</option>`).join("")}</datalist>`), onSave: (f) => { const cat = f.category.value.trim(); if (!cat) { toast("Enter a category.", "err"); return false; } SEED.rawMaterials.forEach((r) => { if (ids.includes(r.id)) r.category = cat; }); state.selected.clear(); fillCat(); render(); toast(`${ids.length} recategorized`, "ok"); } }); } },
        { sep: true },
        { icon: I.trash, title: "Delete", sub: "Permanently remove the selected raw materials", danger: true, onClick: () => { if (!need()) return; confirmDelete({ bulk: true, count: ids.length, entity: "raw material", onConfirm: () => { SEED.rawMaterials = SEED.rawMaterials.filter((r) => !state.selected.has(r.id)); window.SEED.rawMaterials = SEED.rawMaterials; state.selected.clear(); render(); toast(`${ids.length} raw materials deleted`, "ok"); } }); } },
      ], { title: "Raw Material Actions" });
    }
    function render() {
      const rows = filtered(); const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE)); if (state.page > pages) state.page = pages;
      const slice = rows.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
      fillChips();
      const list = document.getElementById("list");
      if (rows.length === 0) { list.innerHTML = emptyBlock("No raw materials found", "Try another search term or clear the filters."); return; }
      const allChecked = slice.length && slice.every((r) => state.selected.has(r.id));
      const tbody = slice.map((r) => `<tr><td><input class="checkbox row-check" type="checkbox" data-id="${r.id}" ${state.selected.has(r.id) ? "checked" : ""}></td><td><div class="prod-cell">${thumb(r)}<div><div class="prod-name">${esc(r.name)}</div><div class="prod-art">Art No: ${esc(r.articleNo)}</div></div></div></td><td><span class="cat-text">${esc(r.category)}</span></td><td><div class="price-main">${money(r.purchasingPrice)}</div><div class="price-tax">${taxLabel(r.taxRate)}</div></td><td><span class="stock-total">${r.stockTotal}</span> <span class="stock-unit">${esc(r.unit)}</span> <span class="stock-label">total stock</span></td><td><div class="row-actions"><button class="icon-btn" data-act="edit" data-id="${r.id}">${I.eye}</button><button class="icon-btn" data-act="edit" data-id="${r.id}">${I.edit}</button><button class="icon-btn danger" data-act="del" data-id="${r.id}">${I.trash}</button></div></td></tr>`).join("");
      const cards = slice.map((r) => { const inStock = r.stockTotal > 0; return `<div class="pcard" data-id="${r.id}">
        <div class="pc-top"><span class="icheckwrap"><input class="checkbox row-check" type="checkbox" data-id="${r.id}" ${state.selected.has(r.id) ? "checked" : ""}></span>${thumb(r, 120)}
          <div class="pc-main"><div class="pc-name">${esc(r.name)}</div><div class="pc-art">Art No: ${esc(r.articleNo)}</div><span class="chip-cat green">${esc(r.category)}</span></div>
          <div class="pc-right"><span class="stock-badge ${inStock ? "in" : "out"}">${inStock ? "In Stock" : "Out of Stock"}</span><div class="price-main">${money(r.purchasingPrice)}</div><div class="price-tax">${taxLabel(r.taxRate)}</div></div>
        </div>
        <div class="pc-stats"><div class="st"><b class="${inStock ? "ok" : "warn"}">${r.stockTotal}</b><span>${esc(r.unit)} available</span></div>
          <div class="pc-acts"><button class="icon-btn" data-act="view" data-id="${r.id}">${I.eye}</button><button class="icon-btn" data-act="edit" data-id="${r.id}">${I.edit}</button><button class="icon-btn danger" data-act="del" data-id="${r.id}">${I.trash}</button></div></div>
      </div>`; }).join("");
      list.innerHTML = `<div class="table-wrap desktop-only"><div class="table-scroll"><table class="grid"><thead><tr><th><input class="checkbox" id="selall" type="checkbox" ${allChecked ? "checked" : ""}></th><th>Name</th><th>Category</th><th>Purchasing Price</th><th>Stock</th><th style="text-align:right">Actions</th></tr></thead><tbody>${tbody}</tbody></table>${pagerHTML()}</div></div><div class="cards">${cards}</div>`;
      mountPager(list, rows.length, state.page, (p) => { state.page = p; render(); });
      list.querySelectorAll(".row-check").forEach((c) => c.addEventListener("change", () => { c.checked ? state.selected.add(c.dataset.id) : state.selected.delete(c.dataset.id); render(); }));
      document.getElementById("selall")?.addEventListener("change", (e) => { slice.forEach((r) => (e.target.checked ? state.selected.add(r.id) : state.selected.delete(r.id))); render(); });
      list.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => { const r = SEED.rawMaterials.find((x) => x.id === b.dataset.id); if (b.dataset.act === "del") confirmDelete({ name: r.name, entity: "raw material", onConfirm: () => { SEED.rawMaterials = SEED.rawMaterials.filter((x) => x.id !== r.id); window.SEED.rawMaterials = SEED.rawMaterials; state.selected.delete(r.id); render(); toast(`"${r.name}" deleted`, "ok"); } }); else openEdit(r); }));
      const importFn = () => importModal("Raw Materials", (n) => { state.page = 1; fillCat(); render(); toast(`${n} raw materials imported`, "ok"); });
      footer([
        { icon: I.upload, label: "Import/Export", onClick: () => importExportSheet("Raw Materials", importFn) },
        { icon: I.plus, label: "Raw Material", cls: "primary", onClick: openAdd },
        { icon: I.bulk, label: "Bulk Action", onClick: (el) => bulkMenu(el) },
      ]);
    }
    let deb;
    document.getElementById("q").addEventListener("input", (e) => { clearTimeout(deb); deb = setTimeout(() => { state.search = e.target.value; state.page = 1; render(); }, 200); });
    document.getElementById("cat").addEventListener("change", (e) => { state.category = e.target.value; state.page = 1; render(); });
    document.getElementById("add").addEventListener("click", openAdd);
    document.getElementById("export").addEventListener("click", (e) => exportMenu(e.currentTarget, "Raw Materials"));
    document.getElementById("import").addEventListener("click", () => importModal("Raw Materials", (n) => { state.page = 1; fillCat(); render(); toast(`${n} raw materials imported`, "ok"); }));
    document.getElementById("bulk").addEventListener("click", (e) => bulkMenu(e.currentTarget));
    fillCat(); render();
  }

  // Mobile bottom nav. buttons = [{ icon, label, cls ("primary"|"accent"|"active"|""), onClick }]
  function footer(buttons) {
    let f = document.getElementById("mfooter");
    if (!f) { f = document.createElement("div"); f.className = "mobile-footer"; f.id = "mfooter"; document.querySelector(".main").appendChild(f); }
    f.innerHTML = buttons.map((b, i) => `<button class="mf-btn ${b.cls || ""}" data-i="${i}"><span class="mf-ic">${b.icon}</span>${esc(b.label)}</button>`).join("");
    f.querySelectorAll(".mf-btn").forEach((el) => el.addEventListener("click", () => buttons[+el.dataset.i].onClick(el)));
  }

  /* =========================================================================
     SCREEN 4 — IMAGE GALLERY  (/image-directory)
     ========================================================================= */
  function screenImageDirectory() {
    const state = { search: "", tab: "all", tag: "", selected: new Set() };
    const content = document.getElementById("content");
    content.innerHTML = `
      ${pageHead("image-directory")}
      <div class="gallery-toolbar">
        <div class="search">${I.search}<input id="q" type="search" placeholder="Search by name, category, article number or tag"></div>
        <button class="btn btn-primary" id="addImg">${I.imgph} Add images <span class="caret" style="color:rgba(255,255,255,.7)">${I.chev}</span></button>
        <button class="btn" id="uploadToProd">${I.pkg} Upload images to products</button>
        <button class="btn" id="bulk">${I.bulk} Bulk actions <span class="caret">${I.chev}</span></button>
        <button class="btn" id="addTag">${I.tag} Add tag</button>
      </div>
      <div class="tabs-row" id="tabs"></div>
      <div id="grid"></div>`;

    const allTags = () => { const m = {}; SEED.images.forEach((i) => (i.tags || []).forEach((t) => (m[t] = (m[t] || 0) + 1))); return Object.entries(m); };
    function filtered() {
      const q = state.search.trim().toLowerCase();
      return SEED.images.filter((i) => {
        if (state.tab === "unlinked" && i.linked) return false;
        if (state.tag && !(i.tags || []).includes(state.tag)) return false;
        if (!q) return true;
        return [i.name, i.category, i.articleNo, ...(i.tags || [])].join(" ").toLowerCase().includes(q);
      });
    }
    function fillTabs() {
      const unlinked = SEED.images.filter((i) => !i.linked).length;
      document.getElementById("tabs").innerHTML =
        `<button class="tab-pill ${state.tab === "all" && !state.tag ? "active" : ""}" data-tab="all">All <span class="num">${SEED.images.length}</span></button>` +
        `<button class="tab-pill ${state.tab === "unlinked" ? "active" : ""}" data-tab="unlinked">Unlinked <span class="num">${unlinked}</span></button>` +
        allTags().map(([t, n]) => `<button class="tab-pill ${state.tag === t ? "active" : ""}" data-tagf="${attr(t)}">${esc(t)} <span class="num">${n}</span></button>`).join("");
      document.getElementById("tabs").querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { state.tab = b.dataset.tab; state.tag = ""; state.selected.clear(); render(); }));
      document.getElementById("tabs").querySelectorAll("[data-tagf]").forEach((b) => b.addEventListener("click", () => { state.tag = b.dataset.tagf; state.tab = "all"; state.selected.clear(); render(); }));
    }
    const imgSrc = (i, size) => attr(i.url || imgUrl(i, size || 300));
    function imgTile(i, size) { return `<span class="thumb"><img src="${imgSrc(i, size || 300)}" alt="${attr(i.name)}" loading="lazy" onerror="this.closest('.thumb,.pic').classList.add('noimg');this.remove();"><span class="ph">${I.imgph}</span></span>`; }
    // ── Upload images drawer ───────────────────────────────────────────────
    function openUploadDrawer() {
      let files = []; const chosen = new Set();
      const panel = drawer({ title: "Upload images", subtitle: "Add product photos here, then link or group them from the directory.", saveLabel: "Upload images",
        body: `<div class="up-drop" id="drop"><div class="ic">${I.imgph}</div><h4>Choose images or drop them here</h4><p>JPG, PNG and WebP · up to 100 files</p><input type="file" id="upFile" accept="image/*" multiple style="display:none"></div>
          <div class="up-preview" id="upPrev"></div>
          <div class="up-tags-box"><div class="hd">Optional tags</div><div class="row"><input id="tagNew" placeholder="e.g. Front view, Summer"><button type="button" class="btn btn-primary" id="tagAdd">${I.plus} Add</button></div><div class="tag-current" id="tagCur" style="margin-top:10px"></div><div class="note" id="tagNote">0/10 tags · Enter or comma to add</div></div>`,
        onSave: () => { if (!files.length) { toast("Choose at least one image.", "err"); return false; } files.forEach((file, idx) => SEED.images.unshift({ id: "img-" + Date.now() + "-" + idx, name: file.name.replace(/\.[^.]+$/, ""), category: "Uncategorised", articleNo: "IMG-" + Math.floor(Math.random() * 9000 + 1000), url: URL.createObjectURL(file), tags: [...chosen], linked: null })); render(); toast(`${files.length} image(s) uploaded`, "ok"); } });
      const fileInput = panel.querySelector("#upFile"), prev = panel.querySelector("#upPrev"), drop = panel.querySelector("#drop");
      drop.addEventListener("click", () => fileInput.click());
      drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.style.borderColor = "var(--emerald-500)"; });
      drop.addEventListener("drop", (e) => { e.preventDefault(); drop.style.borderColor = ""; addFiles(e.dataTransfer.files); });
      const addFiles = (list) => { files = files.concat([...list]); prev.innerHTML = files.map((f) => `<div class="t"><img src="${URL.createObjectURL(f)}"></div>`).join(""); };
      fileInput.addEventListener("change", () => addFiles(fileInput.files));
      const cur = panel.querySelector("#tagCur");
      const renderCur = () => { cur.innerHTML = [...chosen].map((t) => `<span class="chip" data-t="${attr(t)}">${esc(t)} <button type="button">${I.x}</button></span>`).join(""); cur.querySelectorAll(".chip button").forEach((b) => b.addEventListener("click", () => { chosen.delete(b.parentNode.dataset.t); renderCur(); })); panel.querySelector("#tagNote").textContent = `${chosen.size}/10 tags · Enter or comma to add`; };
      const addTag = () => { const v = panel.querySelector("#tagNew").value.trim().replace(/,$/, ""); if (!v || chosen.has(v) || chosen.size >= 10) return; chosen.add(v); panel.querySelector("#tagNew").value = ""; renderCur(); };
      panel.querySelector("#tagAdd").addEventListener("click", addTag);
      panel.querySelector("#tagNew").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } });
    }
    // ── Take photos (camera) ───────────────────────────────────────────────
    // Full flow, matching the live app: a live camera with Image Format /
    // Resolution, then a review step (tags · Retake/Take Another/Crop/Save),
    // an aspect-locked crop with zoom, and a "My Photos" gallery.
    function openTakePhotos() {
      const FORMATS = { square: { label: "Square (1:1)", w: 1, h: 1 }, portrait: { label: "Portrait (4:5)", w: 4, h: 5 }, landscape: { label: "Landscape (4:3)", w: 4, h: 3 } };
      const RES = [ { v: 720, label: "Standard (720 px)" }, { v: 1028, label: "Standard+ (1028 px)" }, { v: 2048, label: "High (2048 px)" } ];
      const S = { view: "capture", format: "square", res: 1028, locked: false, count: 0, max: 4, captured: null, tags: new Set(), facing: "environment", stream: null, session: [] };
      const dims = () => { const f = FORMATS[S.format]; return f.w >= f.h ? { w: S.res, h: Math.round((S.res * f.h) / f.w) } : { w: Math.round((S.res * f.w) / f.h), h: S.res }; };

      const m = modal({ title: "Take photos", wide: true, panelClass: "cam-modal", headExtra: `<div class="cam-head-right" id="camHeadRight"></div>`, body: `<div class="cam-body" id="camBody"></div>` });
      const body = m.panel.querySelector("#camBody"), headRight = m.panel.querySelector("#camHeadRight");
      const stopStream = () => { if (S.stream) { S.stream.getTracks().forEach((t) => t.stop()); S.stream = null; } };

      async function startCamera(video, note) {
        try { stopStream(); S.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: S.facing } }); video.srcObject = S.stream; }
        catch (e) { note.textContent = "Camera unavailable — check permissions, or use Upload images instead."; const c = body.querySelector("#camCap"), f = body.querySelector("#camFlip"); if (c) c.disabled = true; if (f) f.disabled = true; }
      }
      function fmtRow(locked) {
        const d = dims();
        return `<div class="cam-fmt ${locked ? "locked" : ""}">
          <div class="cf"><label>Image Format</label><select id="fmtSel" ${locked ? "disabled" : ""}>${Object.entries(FORMATS).map(([k, f]) => `<option value="${k}" ${S.format === k ? "selected" : ""}>${f.label}</option>`).join("")}</select></div>
          <div class="cf"><label>Resolution</label><select id="resSel" ${locked ? "disabled" : ""}>${RES.map((r) => `<option value="${r.v}" ${S.res === r.v ? "selected" : ""}>${r.label}</option>`).join("")}</select></div>
          <div class="cf-dim">${d.w} × ${d.h} px</div>
          <div class="cf-note">${locked ? "Format and resolution locked until save" : "Locks after the first capture"}</div>
        </div>`;
      }
      function wireFmt() {
        const fs = body.querySelector("#fmtSel"), rs = body.querySelector("#resSel");
        const refresh = () => { const el = body.querySelector(".cf-dim"); if (el) { const d = dims(); el.textContent = `${d.w} × ${d.h} px`; } };
        if (fs && !fs.disabled) fs.addEventListener("change", () => { S.format = fs.value; refresh(); });
        if (rs && !rs.disabled) rs.addEventListener("change", () => { S.res = +rs.value; refresh(); });
      }
      function renderHead() {
        const dots = Array.from({ length: S.max }, (_, i) => `<span class="cam-dot ${i < S.count ? "on" : ""}"></span>`).join("");
        headRight.innerHTML = `<span class="cam-dots">${dots}</span><span class="cam-count">${S.count}/${S.max} photos</span><button class="btn" id="camGallery">${I.imgph} Gallery</button>`;
        headRight.querySelector("#camGallery").addEventListener("click", () => go("gallery"));
      }
      function go(v) { S.view = v; renderHead(); ({ capture: viewCapture, review: viewReview, crop: viewCrop, gallery: viewGallery })[v](); }

      function saveCurrent(close) {
        if (!S.captured) return;
        const id = "img-" + Date.now();
        SEED.images.unshift({ id, name: "Photo " + new Date().toLocaleTimeString(), category: "Uncategorised", articleNo: "IMG-" + Math.floor(Math.random() * 9000 + 1000), url: S.captured, tags: [...S.tags], linked: null });
        S.session.unshift(id); S.count = Math.min(S.max, S.count + 1); S.captured = null; S.tags = new Set();
        toast("Photo saved", "ok");
        if (close || S.count >= S.max) { stopStream(); m.close(); render(); } else go("capture");
      }

      // ---- Capture ----
      function viewCapture() {
        stopStream();
        const d = dims();
        body.innerHTML = fmtRow(S.locked) +
          `<div class="cam-view" style="aspect-ratio:${d.w}/${d.h}"><video id="camVideo" autoplay playsinline muted></video></div>
           <div class="cam-controls"><button class="btn" id="camFlip">${I.flip} Flip</button><button class="btn btn-primary" id="camCap">${I.cam} Capture</button></div>
           <div class="cam-msg" id="camNote"></div>`;
        wireFmt();
        const video = body.querySelector("#camVideo"), note = body.querySelector("#camNote");
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) startCamera(video, note);
        else { note.textContent = "Camera not supported in this browser."; body.querySelector("#camCap").disabled = true; body.querySelector("#camFlip").disabled = true; }
        body.querySelector("#camFlip").addEventListener("click", () => { S.facing = S.facing === "environment" ? "user" : "environment"; startCamera(video, note); });
        body.querySelector("#camCap").addEventListener("click", () => {
          const d2 = dims(), vw = video.videoWidth || 512, vh = video.videoHeight || 512, tAR = d2.w / d2.h, sAR = vw / vh;
          let sw, sh, sx, sy; if (sAR > tAR) { sh = vh; sw = vh * tAR; sx = (vw - sw) / 2; sy = 0; } else { sw = vw; sh = vw / tAR; sx = 0; sy = (vh - sh) / 2; }
          const c = document.createElement("canvas"); c.width = d2.w; c.height = d2.h; c.getContext("2d").drawImage(video, sx, sy, sw, sh, 0, 0, d2.w, d2.h);
          S.captured = c.toDataURL("image/jpeg", 0.9); S.locked = true; S.tags = new Set(); go("review");
        });
      }

      // ---- Review ----
      function viewReview() {
        stopStream();
        const d = dims();
        body.innerHTML = fmtRow(true) +
          `<div class="cam-view" style="aspect-ratio:${d.w}/${d.h}"><img id="camShot" src="${attr(S.captured)}" alt="Captured photo"></div>
           <div class="up-tags-box cam-tags"><div class="hd">${I.tag} Image Tags</div><div class="cam-tags-sub">Add one or more tags for these photos</div>
             <div class="row"><input id="tagNew" placeholder="Add tag"><button type="button" class="btn btn-primary" id="tagAdd">Add</button></div>
             <div class="tag-current" id="tagCur" style="margin-top:10px"></div></div>
           <div class="cam-controls cam-review-actions">
             <button class="btn" id="reRetake">${I.refresh} Retake</button>
             <button class="btn" id="reAnother">${I.cam} Take Another</button>
             <button class="btn" id="reCrop">${I.crop} Crop</button>
             <button class="btn btn-primary" id="reSave">${I.check} Save &amp; Next Product ${I.chevR}</button>
           </div>`;
        const cur = body.querySelector("#tagCur");
        const renderCur = () => { cur.innerHTML = [...S.tags].map((t) => `<span class="chip" data-t="${attr(t)}">${esc(t)} <button type="button">${I.x}</button></span>`).join(""); cur.querySelectorAll(".chip button").forEach((b) => b.addEventListener("click", () => { S.tags.delete(b.parentNode.dataset.t); renderCur(); })); };
        const addTag = () => { const inp = body.querySelector("#tagNew"), v = inp.value.trim().replace(/,$/, ""); if (!v || S.tags.has(v) || S.tags.size >= 10) return; S.tags.add(v); inp.value = ""; renderCur(); };
        body.querySelector("#tagAdd").addEventListener("click", addTag);
        body.querySelector("#tagNew").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } });
        renderCur();
        body.querySelector("#reRetake").addEventListener("click", () => { S.captured = null; go("capture"); });
        body.querySelector("#reAnother").addEventListener("click", () => saveCurrent(false));
        body.querySelector("#reCrop").addEventListener("click", () => go("crop"));
        body.querySelector("#reSave").addEventListener("click", () => saveCurrent(true));
      }

      // ---- Crop (aspect-locked selection + zoom) ----
      function viewCrop() {
        stopStream();
        const d = dims(), AR = d.w / d.h;
        body.innerHTML = fmtRow(true) +
          `<div class="crop-head"><h4>Crop your photo</h4><p>Drag the selection to move it. Pull a green corner to resize.</p></div>
           <div class="crop-stage" id="cropStage" style="aspect-ratio:${d.w}/${d.h}"><img id="cropImg" src="${attr(S.captured)}" draggable="false"><div class="crop-sel" id="cropSel"><span class="ch tl"></span><span class="ch tr"></span><span class="ch bl"></span><span class="ch br"></span></div></div>
           <div class="crop-zoom"><span class="zic">${I.search}</span><input type="range" id="cropZoom" min="100" max="300" value="100"><span id="cropZoomVal">100%</span></div>
           <div class="cam-controls"><button class="btn" id="crCancel">Cancel</button><button class="btn" id="crReset">${I.refresh} Reset</button><button class="btn btn-primary" id="crApply">${I.crop} Apply Crop</button></div>`;
        const stage = body.querySelector("#cropStage"), img = body.querySelector("#cropImg"), sel = body.querySelector("#cropSel");
        let zoom = 1, box = null, drag = null;
        const sr = () => stage.getBoundingClientRect();
        function clampBox() { const r = sr(); box.w = Math.max(40, Math.min(box.w, r.width)); box.h = box.w / AR; if (box.h > r.height) { box.h = r.height; box.w = box.h * AR; } box.x = Math.max(0, Math.min(box.x, r.width - box.w)); box.y = Math.max(0, Math.min(box.y, r.height - box.h)); }
        function applyBox() { clampBox(); sel.style.left = box.x + "px"; sel.style.top = box.y + "px"; sel.style.width = box.w + "px"; sel.style.height = box.h + "px"; }
        function resetBox() { const r = sr(); box = { x: 0, y: 0, w: r.width, h: r.height }; applyBox(); }
        const onMove = (e) => {
          if (!drag) return; const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy, b = drag.box;
          if (drag.mode === "move") { box.x = b.x + dx; box.y = b.y + dy; }
          else {
            const fixedX = drag.mode === "tl" || drag.mode === "bl" ? b.x + b.w : b.x;
            const fixedY = drag.mode === "tl" || drag.mode === "tr" ? b.y + b.h : b.y;
            const r = sr(), px = Math.max(0, Math.min(e.clientX - r.left, r.width));
            let nw = Math.max(40, Math.abs(px - fixedX)), nh = nw / AR;
            box.w = nw; box.h = nh;
            box.x = drag.mode === "tl" || drag.mode === "bl" ? fixedX - nw : fixedX;
            box.y = drag.mode === "tl" || drag.mode === "tr" ? fixedY - nh : fixedY;
          }
          applyBox();
        };
        const onUp = () => { drag = null; window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
        const onDown = (e, mode) => { e.preventDefault(); drag = { mode, sx: e.clientX, sy: e.clientY, box: { ...box } }; window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); };
        sel.addEventListener("pointerdown", (e) => { if (!e.target.classList.contains("ch")) onDown(e, "move"); });
        sel.querySelectorAll(".ch").forEach((h) => { const mode = ["tl", "tr", "bl", "br"].find((c) => h.classList.contains(c)); h.addEventListener("pointerdown", (e) => { e.stopPropagation(); onDown(e, mode); }); });
        const zr = body.querySelector("#cropZoom");
        zr.addEventListener("input", () => { zoom = +zr.value / 100; img.style.transform = `scale(${zoom})`; body.querySelector("#cropZoomVal").textContent = zr.value + "%"; });
        body.querySelector("#crCancel").addEventListener("click", () => go("review"));
        body.querySelector("#crReset").addEventListener("click", () => { zoom = 1; zr.value = 100; img.style.transform = "scale(1)"; body.querySelector("#cropZoomVal").textContent = "100%"; resetBox(); });
        body.querySelector("#crApply").addEventListener("click", () => {
          const r = sr(), natW = img.naturalWidth || d.w, natH = img.naturalHeight || d.h, base = natW / r.width, cx = r.width / 2, cy = r.height / 2;
          const toNat = (X, Y) => ({ x: ((X - cx) / zoom + cx) * base, y: ((Y - cy) / zoom + cy) * base });
          const p1 = toNat(box.x, box.y), p2 = toNat(box.x + box.w, box.y + box.h);
          let sx = Math.max(0, Math.min(p1.x, p2.x)), sy = Math.max(0, Math.min(p1.y, p2.y));
          let sw = Math.min(natW - sx, Math.abs(p2.x - p1.x)), sh = Math.min(natH - sy, Math.abs(p2.y - p1.y));
          const out = document.createElement("canvas"); out.width = d.w; out.height = d.h; out.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, d.w, d.h);
          S.captured = out.toDataURL("image/jpeg", 0.92); toast("Crop applied", "ok"); go("review");
        });
        requestAnimationFrame(resetBox);
      }

      // ---- My Photos gallery ----
      function viewGallery() {
        stopStream();
        const imgs = SEED.images;
        body.innerHTML = `<div class="cam-gallery">
          <div class="cg-head"><button class="back-link" id="cgBack">${I.back} Back</button><h3>${I.imgph} My Photos</h3></div>
          <div class="cg-pill">All ${imgs.length}</div>
          <div class="cg-grid">${imgs.map((i) => `<div class="cg-tile ${S.session.includes(i.id) ? "new" : ""}"><img src="${imgSrc(i, 300)}" alt="${attr(i.name)}" onerror="this.style.display='none'"></div>`).join("")}</div>
        </div>`;
        body.querySelector("#cgBack").addEventListener("click", () => go(S.captured ? "review" : "capture"));
      }

      // Close (X / scrim) must also stop the camera and refresh the grid behind.
      m.panel.querySelector(".x[data-close]").addEventListener("click", () => { stopStream(); render(); });
      m.scrim.addEventListener("click", (e) => { if (e.target === m.scrim) { stopStream(); render(); } });

      go("capture");
    }
    // ── Create / assign an image tag drawer ────────────────────────────────
    function openAddTag(ids) {
      const chosen = new Set(), picked = new Set(ids && ids.length ? ids : []); let search = "";
      const panel = drawer({ title: "Create or assign an image tag", subtitle: "Name the tag, search the gallery and select every image that should receive it.", saveLabel: "Save", wide: true,
        body: `<div class="up-tags-box" style="margin-bottom:18px"><div class="hd">Add one or more tags</div><div class="row"><input id="tagNew" placeholder="e.g. Front view"><button type="button" class="btn btn-primary" id="tagAdd">${I.plus} Add</button></div><div class="note" id="tagNote">0/10 tags · Enter or comma to add</div><div class="tag-current" id="tagCur" style="margin-top:10px"></div></div>
          <div class="tag-search">${I.search}<input id="tagSearch" placeholder="Search..."></div>
          <div class="itag-grid" id="igrid"></div>
          <div class="ptag-sub" id="selCount" style="margin-top:14px">${picked.size} selected</div>`,
        onSave: () => { if (!chosen.size) { toast("Add at least one tag.", "err"); return false; } if (!picked.size) { toast("Select at least one image.", "err"); return false; } SEED.images.forEach((i) => { if (picked.has(i.id)) i.tags = [...new Set([...(i.tags || []), ...chosen])]; }); render(); toast(`Tag applied to ${picked.size} image(s)`, "ok"); } });
      const grid = panel.querySelector("#igrid"), cur = panel.querySelector("#tagCur");
      const renderGrid = () => { const q = search.trim().toLowerCase(); grid.innerHTML = SEED.images.filter((i) => !q || [i.name, i.category, ...(i.tags || [])].join(" ").toLowerCase().includes(q)).map((i) => `<div class="itag-tile ${picked.has(i.id) ? "sel" : ""}" data-id="${i.id}"><img src="${imgSrc(i, 200)}" onerror="this.style.display='none'"><span class="ck">${picked.has(i.id) ? I.check : ""}</span></div>`).join(""); grid.querySelectorAll(".itag-tile").forEach((c) => c.addEventListener("click", () => { const id = c.dataset.id; picked.has(id) ? picked.delete(id) : picked.add(id); panel.querySelector("#selCount").textContent = `${picked.size} selected`; renderGrid(); })); };
      const renderCur = () => { cur.innerHTML = [...chosen].map((t) => `<span class="chip" data-t="${attr(t)}">${esc(t)} <button type="button">${I.x}</button></span>`).join(""); cur.querySelectorAll(".chip button").forEach((b) => b.addEventListener("click", () => { chosen.delete(b.parentNode.dataset.t); renderCur(); })); panel.querySelector("#tagNote").textContent = `${chosen.size}/10 tags · Enter or comma to add`; };
      const addTag = () => { const v = panel.querySelector("#tagNew").value.trim().replace(/,$/, ""); if (!v || chosen.has(v) || chosen.size >= 10) return; chosen.add(v); panel.querySelector("#tagNew").value = ""; renderCur(); };
      panel.querySelector("#tagAdd").addEventListener("click", addTag);
      panel.querySelector("#tagNew").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } });
      panel.querySelector("#tagSearch").addEventListener("input", (e) => { search = e.target.value; renderGrid(); });
      renderGrid();
    }
    // ── Upload images to products (missing-a-photo list) ───────────────────
    function openUploadToProducts() {
      document.getElementById("tabs").innerHTML = "";
      const grid = document.getElementById("grid");
      const missing = SEED.products.filter((p) => !p.hasPhoto);
      grid.innerHTML = `<button class="back-link" id="backAll">${I.back} Back to all images</button>
        <h2 style="font-size:15px;margin:0 0 12px">Missing a photo (${missing.length})</h2>
        <div class="missing-list">${missing.map((p) => `<div class="missing-row" data-id="${p.id}"><div class="ic">${I.imgph}</div><div class="grow"><div class="nm">${esc(p.name)}</div><div class="sub">${esc(p.category)}</div></div><button class="addp" data-id="${p.id}">Add photo</button></div>`).join("") || '<div style="padding:20px;text-align:center;color:var(--muted)">All products have a photo 🎉</div>'}</div>`;
      grid.querySelector("#backAll").addEventListener("click", render);
      grid.querySelectorAll(".missing-row, .addp").forEach((el) => el.addEventListener("click", (e) => { e.stopPropagation(); openManageProductImages(SEED.products.find((p) => p.id === el.dataset.id)); }));
    }
    function openManageProductImages(product) {
      let linked = [...(product.galleryImages || [])]; let search = "";
      const panel = drawer({ title: "Manage product images", subtitle: `${product.name} · ${product.articleNo} · ${product.category}`, saveLabel: "Save images",
        body: `<div><b>Image order</b><div style="font-size:12.5px;color:var(--muted);margin:2px 0 8px">The first image is the primary product image. Maximum 4.</div><div class="mpi-order" id="order"></div></div>
          <div><b>Image gallery</b><div style="font-size:12.5px;color:var(--muted);margin:2px 0 8px">Select images to add them to the product.</div><div class="tag-search">${I.search}<input id="galSearch" placeholder="Search by filename or tag..."></div><div class="itag-grid" id="galGrid"></div></div>
          <div class="ptag-sub" id="linkCount" style="margin-top:12px">${linked.length} images linked</div>`,
        onSave: () => { product.galleryImages = linked; product.hasPhoto = linked.length > 0; const first = SEED.images.find((i) => i.id === linked[0]); if (first) product.img = first.img || product.img; render(); toast(`${linked.length} image(s) saved to "${product.name}"`, "ok"); } });
      const order = panel.querySelector("#order"), gal = panel.querySelector("#galGrid"), cnt = panel.querySelector("#linkCount");
      const refresh = () => {
        cnt.textContent = `${linked.length} images linked`;
        order.innerHTML = linked.map((id, idx) => { const i = SEED.images.find((x) => x.id === id); if (!i) return ""; return `<div class="mpi-slot"><div class="pic"><img src="${imgSrc(i, 160)}"><span class="tag">${idx === 0 ? "Primary" : "Image " + (idx + 1)}</span><button class="rm" data-rm="${id}">${I.x}</button></div><div class="mv"><button data-mv="${id}" data-d="-1"${idx === 0 ? " disabled" : ""}>‹</button><button data-mv="${id}" data-d="1"${idx === linked.length - 1 ? " disabled" : ""}>›</button></div></div>`; }).join("") || '<div style="color:var(--muted-2);font-size:13px">No images linked yet.</div>';
        order.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { linked = linked.filter((x) => x !== b.dataset.rm); refresh(); }));
        order.querySelectorAll("[data-mv]").forEach((b) => b.addEventListener("click", () => { const i = linked.indexOf(b.dataset.mv), j = i + (+b.dataset.d); if (j < 0 || j >= linked.length) return; [linked[i], linked[j]] = [linked[j], linked[i]]; refresh(); }));
        const q = search.trim().toLowerCase();
        gal.innerHTML = SEED.images.filter((i) => !q || [i.name, ...(i.tags || [])].join(" ").toLowerCase().includes(q)).map((i) => `<div class="itag-tile ${linked.includes(i.id) ? "sel" : ""}" data-id="${i.id}"><img src="${imgSrc(i, 200)}" onerror="this.style.display='none'"><span class="ck">${linked.includes(i.id) ? I.check : ""}</span></div>`).join("");
        gal.querySelectorAll(".itag-tile").forEach((c) => c.addEventListener("click", () => { const id = c.dataset.id; if (linked.includes(id)) linked = linked.filter((x) => x !== id); else { if (linked.length >= 4) { toast("Maximum 4 images.", "err"); return; } linked.push(id); } refresh(); }));
      };
      panel.querySelector("#galSearch").addEventListener("input", (e) => { search = e.target.value; refresh(); });
      refresh();
    }
    function addImagesMenu(anchor) { popover(anchor, [ { icon: I.imgph, title: "Upload images", sub: "Add files from your device", onClick: openUploadDrawer }, { icon: I.imgph, title: "Take photos", sub: "Capture with your camera", onClick: openTakePhotos } ], { title: "Add images" }); }
    function bulkMenu(anchor) {
      const ids = [...state.selected]; const need = () => { if (!ids.length) { toast("Select images first.", "err"); return false; } return true; };
      popover(anchor, [
        { icon: I.tag, title: "Add tags", sub: "Tag the selected images", onClick: () => need() && openAddTag(ids) },
        { icon: I.trash, title: "Delete", sub: "Permanently remove the selected images", danger: true, onClick: () => { if (!need()) return; confirmDelete({ bulk: true, count: ids.length, entity: "image", onConfirm: () => { SEED.images = SEED.images.filter((i) => !state.selected.has(i.id)); window.SEED.images = SEED.images; state.selected.clear(); render(); toast(`${ids.length} image(s) deleted`, "ok"); } }); } },
      ], { title: `${state.selected.size} selected` });
    }
    function cardMenu(anchor, img) {
      popover(anchor, [
        { icon: I.tag, title: "Add tags", onClick: () => openAddTag([img.id]) },
        { icon: I.pkg, title: img.linked ? `Linked: ${img.linked}` : "Link to product", onClick: () => { const m = modal({ title: `Link "${img.name}" to a product`, body: `<div class="up-field"><label>Product</label><select id="lp"><option value="">Select product</option>${SEED.products.map((p) => `<option ${p.name === img.linked ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>`, footer: `<button class="btn" data-close style="border-color:var(--line)">Cancel</button><button class="btn btn-primary" id="lpDo">Link</button>` }); m.panel.querySelector("#lpDo").addEventListener("click", () => { const name = m.panel.querySelector("#lp").value; if (!name) return; img.linked = name; m.close(); render(); toast(`Linked to "${name}"`, "ok"); }); } },
        { sep: true },
        { icon: I.trash, title: "Delete image", danger: true, onClick: () => confirmDelete({ name: img.name, entity: "image", onConfirm: () => { SEED.images = SEED.images.filter((x) => x.id !== img.id); window.SEED.images = SEED.images; render(); toast(`"${img.name}" deleted`, "ok"); } }) },
      ]);
    }
    function render() {
      fillTabs();
      const rows = filtered();
      const grid = document.getElementById("grid");
      if (rows.length === 0) { grid.innerHTML = emptyBlock("No images found", "Try another search, tab or tag."); return; }
      grid.innerHTML = `<div class="img-grid-wrap">${rows.map((i) => `<div class="img-card ${state.selected.has(i.id) ? "sel" : ""}" data-id="${i.id}">
        <div class="pic"><img src="${attr(i.url || imgUrl(i, 400))}" alt="${attr(i.name)}" loading="lazy" onerror="this.closest('.pic').classList.add('noimg');this.remove();"><span class="ph">${I.imgphL}</span></div>
        <div class="cbx"><input type="checkbox" class="icheck" data-id="${i.id}" ${state.selected.has(i.id) ? "checked" : ""}></div>
        <button class="kebab" data-menu="${i.id}">⋮</button>
        <div class="foot"><div class="nm">${esc(i.name)}</div>${(i.tags || []).length ? `<div class="tags">${i.tags.map((t) => `<span class="t">${esc(t)}</span>`).join("")}</div>` : `<div class="notag">No tags</div>`}</div>
      </div>`).join("")}</div>`;
      grid.querySelectorAll(".icheck").forEach((c) => c.addEventListener("change", (e) => { e.stopPropagation(); c.checked ? state.selected.add(c.dataset.id) : state.selected.delete(c.dataset.id); render(); }));
      grid.querySelectorAll("[data-menu]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); cardMenu(b, SEED.images.find((x) => x.id === b.dataset.menu)); }));
      footer([
        { icon: I.imgph, label: "Add", cls: "primary", onClick: (el) => addImagesMenu(el) },
        { icon: I.tag, label: "Tag", onClick: () => openAddTag([...state.selected]) },
        { icon: I.pkg, label: "Products", onClick: openUploadToProducts },
        { icon: I.bulk, label: "Bulk", onClick: (el) => bulkMenu(el) },
      ]);
    }
    let deb;
    document.getElementById("q").addEventListener("input", (e) => { clearTimeout(deb); deb = setTimeout(() => { state.search = e.target.value; render(); }, 200); });
    document.getElementById("addImg").addEventListener("click", (e) => addImagesMenu(e.currentTarget));
    document.getElementById("uploadToProd").addEventListener("click", openUploadToProducts);
    document.getElementById("bulk").addEventListener("click", (e) => bulkMenu(e.currentTarget));
    document.getElementById("addTag").addEventListener("click", () => openAddTag([...state.selected]));
    render();
  }

  // Screen identity: mobile page heading (icon + title) + desktop topbar title.
  // Names match the live app exactly (see attached screens).
  const SCREEN_META = {
    products: { icon: I.box, title: "Finished Goods" },
    categories: { icon: I.box, title: "Product Categories" },
    "raw-materials": { icon: I.box, title: "Raw Materials" },
    "image-directory": { icon: I.box, title: "Image Gallery" },
  };
  const TITLES = Object.fromEntries(Object.entries(SCREEN_META).map(([k, v]) => [k, v.title]));
  // In-content page heading — the signature green icon + title shown on mobile.
  const pageHead = (key) => `<div class="page-head"><span class="ph-ic">${SCREEN_META[key].icon}</span><h1>${esc(SCREEN_META[key].title)}</h1></div>`;
  window.FB = { mount(screen) { document.getElementById("app").innerHTML = shell(screen, TITLES[screen]); wireShell(); if (screen === "products") screenProducts(); else if (screen === "categories") screenCategories(); else if (screen === "raw-materials") screenRawMaterials(); else if (screen === "image-directory") screenImageDirectory(); } };
})();

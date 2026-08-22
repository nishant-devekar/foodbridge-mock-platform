/* ==========================================================================
   Distribution & Logistics — HTML replica of the live "QA store" storefront
   admin. Vanilla JS, no build step.
   Screens: FB.mount('route-planning' | 'logistic-returns' | 'delivery-management' | 'live-tracking').
   'live-tracking' is implemented in tracking.js, which only that page loads.

     • Route Planning     — Delivery Templates table, add/edit drawer with
                            multi-select Customers + Staff (assignment badges),
                            delete confirm.
     • Logistic Returns   — Asset Movement / Asset Inventory / Assets tabs,
                            Record Asset Movement wizard (Return / Issue),
                            Add/Edit asset modal, asset detail view, ledger.
     • Delivery Management — mobile-only Route Delivery execution view.

   Everything mutates the in-memory seed data (window.SEED) and re-renders.
   ========================================================================== */
(function () {
  // When embedded in the mock platform, its 56px mobile header overlays the top of
  // this iframe and would hide an open drawer's own header. Flag the document so the
  // drawer drops below it (see .fb-embedded rule in styles.css). Standalone untouched.
  try { if (window.self !== window.top) document.documentElement.classList.add("fb-embedded"); } catch (e) { document.documentElement.classList.add("fb-embedded"); }
  const SEED = window.SEED || { routeTemplates: [], customers: [], staff: [], assets: [], orgs: [], deliveryRoute: {} };

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
    factory: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20M4 20V9l6 4V9l6 4V4l4 2v14"/></svg>',
    clip: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/></svg>',
    coin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 8h4a2.5 2.5 0 0 1 0 5H9m0 0h5m-5-5v9"/></svg>',
    wf: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    qr: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM21 14v7M14 21h7"/></svg>',
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
    menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    scan: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8v8M11 8v8M16 8v8"/></svg>',
    pkg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8V16a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8Z"/><path d="m3.3 7 8.7 5 8.7-5"/></svg>',
    crate: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z"/><path d="m3 7 9 5 9-5M12 12v10"/></svg>',
    imgph: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-5-5L5 21"/></svg>',
    imgphL: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-5-5L5 21"/></svg>',
    check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="M22 4 12 14.01l-3-3"/></svg>',
    back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    sync: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>',
    sort: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 16 4 4 4-4M7 20V4M21 8l-4-4-4 4M17 4v16"/></svg>',
    ret2: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H9"/></svg>',
    issue: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 10 5 5-5 5"/><path d="M20 15H9a5 5 0 0 1-5-5v0a5 5 0 0 1 5-5h6"/></svg>',
    note: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>',
    empty: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  };

  // ── Helpers ─────────────────────────────────────────────────────────────
  const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const attr = (s) => esc(s).replace(/'/g, "&#39;");
  const initials = (s) => String(s || "?").trim().charAt(0).toUpperCase();
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtDate = (iso) => { if (!iso) return "—"; const d = new Date(iso); if (isNaN(d)) return "—"; return `${String(d.getDate()).padStart(2, "0")} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
  const fmtTime = (d) => { d = d || new Date(); let h = d.getHours(); const m = d.getMinutes(), ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return `${h}:${String(m).padStart(2, "0")} ${ap}`; };
  const parseTime = (t) => { if (!t) return 0; const m = String(t).match(/(\d+):(\d+)\s*(AM|PM)?/i); if (!m) return 0; let h = +m[1] % 12; if (m[3] && /pm/i.test(m[3])) h += 12; return h * 60 + +m[2]; };
  const txTs = (t) => new Date(t.date).getTime() + parseTime(t.time) * 60000;
  const custById = (id) => SEED.customers.find((c) => c.id === id);
  const staffById = (id) => SEED.staff.find((s) => s.id === id);
  const count = (arr) => (Array.isArray(arr) ? arr.length : 0);

  function toast(msg, tone) { const t = document.getElementById("toast"); if (!t) return; t.className = "toast show" + (tone ? " " + tone : ""); t.textContent = msg; clearTimeout(toast._t); toast._t = setTimeout(() => (t.className = "toast"), 2600); }

  // ── Popover / bottom sheet ────────────────────────────────────────────────
  const isMobile = () => (window.matchMedia ? window.matchMedia("(max-width: 768px)").matches : window.innerWidth <= 768);

  // ── General modal ─────────────────────────────────────────────────────────
  function modal({ title, subtitle, body, footer, wide, panelClass }) {
    const scrim = document.createElement("div"); scrim.className = "modal-scrim";
    scrim.innerHTML = `<div class="modal-panel ${wide ? "wide" : ""} ${panelClass || ""}" role="dialog" aria-modal="true">
      <div class="mp-head"><h3>${esc(title)}</h3><button class="x" data-close>${I.x}</button></div>
      <div class="mp-body">${subtitle ? `<p style="margin:-6px 0 16px;color:var(--muted);font-size:13.5px">${esc(subtitle)}</p>` : ""}${body}</div>${footer ? `<div class="mp-foot">${footer}</div>` : ""}</div>`;
    document.body.appendChild(scrim);
    requestAnimationFrame(() => scrim.classList.add("show"));
    const close = () => { scrim.classList.remove("show"); setTimeout(() => scrim.remove(), 200); };
    scrim.addEventListener("click", (e) => { if (e.target === scrim) close(); });
    scrim.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
    return { scrim, panel: scrim.querySelector(".modal-panel"), close };
  }

  // ── Delete confirm ────────────────────────────────────────────────────────
  function confirmDelete({ name, title, message, onConfirm }) {
    const scrim = document.createElement("div"); scrim.className = "modal-scrim";
    scrim.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true"><div class="modal-ic">${I.trashBig}</div>
      <h2>${esc(title || "Delete")}</h2><p>${message || `Are you sure you want to delete <b>${esc(name)}</b>? This cannot be undone.`}</p>
      <div class="modal-foot"><button class="btn" data-keep style="border-color:var(--line)">Cancel</button><button class="btn btn-danger" data-del>Delete</button></div></div>`;
    document.body.appendChild(scrim);
    requestAnimationFrame(() => scrim.classList.add("show"));
    const close = () => { scrim.classList.remove("show"); setTimeout(() => scrim.remove(), 200); };
    scrim.addEventListener("click", (e) => { if (e.target === scrim) close(); });
    scrim.querySelector("[data-keep]").addEventListener("click", close);
    scrim.querySelector("[data-del]").addEventListener("click", () => { onConfirm(); close(); });
  }

  // ── Generic right drawer (Add / Edit forms) ─────────────────────────────────
  function drawer({ title, subtitle, body, saveLabel, onSave, wide }) {
    const scrim = document.createElement("div"); scrim.className = "drawer-scrim";
    const panel = document.createElement("div"); panel.className = "drawer" + (wide ? " wide" : "");
    panel.innerHTML = `
      <div class="drawer-head"><button class="x">${I.x}</button><h3>${esc(title)}</h3>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div>
      <div class="drawer-body"><form id="drawerForm">${body}</form></div>
      <div class="drawer-foot"><button type="button" class="btn btn-primary" data-save>${esc(saveLabel)}</button><button type="button" class="btn cancel" data-close>Cancel</button></div>`;
    document.body.appendChild(scrim); document.body.appendChild(panel);
    requestAnimationFrame(() => { scrim.classList.add("show"); panel.classList.add("open"); });
    const close = () => { scrim.classList.remove("show"); panel.classList.remove("open"); setTimeout(() => { scrim.remove(); panel.remove(); document.removeEventListener("keydown", onKey); }, 280); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    scrim.addEventListener("click", close);
    panel.querySelector(".x").addEventListener("click", close);
    panel.querySelector("[data-close]").addEventListener("click", close);
    panel.querySelector("[data-save]").addEventListener("click", () => {
      const form = panel.querySelector("#drawerForm");
      const f = new Proxy(form, { get(t, p) { const el = t.elements ? t.elements[p] : undefined; return el !== undefined ? el : t[p]; } });
      if (onSave(f, close) !== false) close();
    });
    panel.querySelectorAll("[data-generate]").forEach((b) => b.addEventListener("click", () => { panel.querySelector(`[name='${b.dataset.generate}']`).value = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz"[Math.floor(Math.random() * 54)]).join(""); }));
    panel.querySelectorAll("[data-scan]").forEach((b) => b.addEventListener("click", () => { panel.querySelector(`[name='${b.dataset.scan}']`).value = String(Math.floor(Math.random() * 9e11 + 1e11)); toast("Barcode captured", "ok"); }));
    panel.querySelectorAll(".img-box").forEach((box) => {
      const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.style.display = "none"; box.appendChild(input);
      box.addEventListener("click", (e) => { if (e.target.closest(".rm")) return; input.click(); });
      input.addEventListener("change", () => { const file = input.files[0]; if (!file) return; const url = URL.createObjectURL(file); box.innerHTML = `<img src="${url}" alt=""><button type="button" class="rm">${I.x}</button>`; box.appendChild(input); box.querySelector(".rm").addEventListener("click", (ev) => { ev.stopPropagation(); box.innerHTML = I.plus; box.appendChild(input); input.value = ""; }); });
    });
    return { panel, close };
  }
  const dRow = (label, req, ctrl, hint) => `<div class="d-row"><label>${label}${req ? ' <span class="req">*</span>' : ""}</label><div class="ctrl">${ctrl}${hint ? `<div class="hint">${hint}</div>` : ""}</div></div>`;
  const imgGrid = `<div class="img-grid">${Array.from({ length: 4 }, () => `<div class="img-box">${I.plus}</div>`).join("")}</div>`;
  const emptyBlock = (t, m) => `<div class="table-wrap"><div class="empty"><div class="ic">${I.empty}</div><h2>${esc(t)}</h2><p>${m}</p></div></div>`;

  // ── Assignment badge popover ("N templates") ────────────────────────────────
  let openAssignPop = null;
  function closeAssignPop() { if (openAssignPop) { openAssignPop.remove(); openAssignPop = null; document.removeEventListener("mousedown", assignDoc, true); } }
  function assignDoc(e) { if (openAssignPop && !openAssignPop.contains(e.target) && !e.target.closest(".assign-badge")) closeAssignPop(); }
  function wireAssignBadge(btn, names) {
    btn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      if (openAssignPop) { closeAssignPop(); return; }
      const r = btn.getBoundingClientRect();
      const pop = document.createElement("div"); pop.className = "assign-pop";
      pop.innerHTML = `<div class="hd">Assigned to</div><ul>${names.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`;
      pop.style.top = r.bottom + 4 + "px"; pop.style.left = Math.max(8, r.right - 210) + "px";
      document.body.appendChild(pop); openAssignPop = pop;
      setTimeout(() => document.addEventListener("mousedown", assignDoc, true), 0);
    });
  }

  // ── Multi-select widget (customers / staff) ─────────────────────────────────
  // Mutates `selectedSet`. `assignments` = { id: [templateName,...] } for badges.
  function mountMultiSelect(container, { items, selectedSet, placeholder, searchPlaceholder, assignments }) {
    let open = false, q = "";
    const render = () => {
      const chosen = items.filter((it) => selectedSet.has(it.id));
      const filtered = items.filter((it) => it.name.toLowerCase().includes(q.toLowerCase()));
      container.className = "ms" + (open ? " open" : "");
      container.innerHTML = `
        <div class="ms-trigger"><span class="${chosen.length ? "" : "ph"}">${chosen.length ? `${chosen.length} selected` : esc(placeholder)}</span><span class="chev">${I.chev}</span></div>
        ${open ? `<div class="ms-panel"><div class="ms-search">${I.search}<input class="ms-q" placeholder="${attr(searchPlaceholder)}" value="${attr(q)}"></div>
          <div class="ms-list">${filtered.length ? filtered.map((it) => {
            const on = selectedSet.has(it.id), asg = (assignments && assignments[it.id]) || [];
            return `<label class="ms-opt ${on ? "sel" : ""}" data-id="${it.id}"><input type="checkbox" ${on ? "checked" : ""}><span class="nm">${esc(it.name)}</span>${asg.length ? `<button type="button" class="assign-badge" data-badge="${it.id}">${asg.length} template${asg.length !== 1 ? "s" : ""} ${I.chev}</button>` : ""}</label>`;
          }).join("") : `<div class="ms-empty">No results</div>`}</div></div>` : ""}
        ${chosen.length ? `<div class="ms-selected"><div class="hd">Selected (${chosen.length})</div>${chosen.map((it) => {
          const asg = (assignments && assignments[it.id]) || [];
          return `<div class="row"><span class="nm">${esc(it.name)}</span>${asg.length ? `<button type="button" class="assign-badge" data-badge="${it.id}">${asg.length} template${asg.length !== 1 ? "s" : ""} ${I.chev}</button>` : ""}<button type="button" class="rm" data-rm="${it.id}">${I.x}</button></div>`;
        }).join("")}</div>` : ""}`;
      container.querySelector(".ms-trigger").addEventListener("click", () => { open = !open; render(); });
      const qi = container.querySelector(".ms-q");
      if (qi) { qi.focus(); qi.addEventListener("input", (e) => { q = e.target.value; const pos = e.target.selectionStart; render(); const ni = container.querySelector(".ms-q"); if (ni) ni.setSelectionRange(pos, pos); }); }
      container.querySelectorAll(".ms-opt").forEach((o) => o.addEventListener("click", (e) => { if (e.target.closest(".assign-badge")) return; e.preventDefault(); const id = o.dataset.id; selectedSet.has(id) ? selectedSet.delete(id) : selectedSet.add(id); render(); }));
      container.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); selectedSet.delete(b.dataset.rm); render(); }));
      container.querySelectorAll("[data-badge]").forEach((b) => wireAssignBadge(b, assignments[b.dataset.badge] || []));
    };
    render();
    const onDoc = (e) => { if (open && !container.contains(e.target)) { open = false; render(); } };
    document.addEventListener("mousedown", onDoc);
  }

  // Which OTHER templates reference each customer/staff id → assignment badges.
  function buildAssignments(field, exceptId) {
    const map = {};
    SEED.routeTemplates.forEach((r) => {
      if (exceptId && r.id === exceptId) return;
      (r[field] || []).forEach((id) => { (map[id] = map[id] || []).push(r.name); });
    });
    return map;
  }

  // ── Sidebar / shell ─────────────────────────────────────────────────────────
  const SIDEBAR = [
    { label: "Dashboard", icon: I.dash },
    { label: "Product Master", icon: I.box, group: true, children: [{ label: "Finished Goods" }, { label: "Product Categories" }, { label: "Raw Materials" }, { label: "Image Gallery" }] },
    { label: "Customer Management", icon: I.users, group: true, children: [{ label: "B2B Customers" }, { label: "Retail Customers" }] },
    { label: "Sales Orders", icon: I.cart },
    { label: "Distribution & Logistics", icon: I.users, group: true, children: [
      { label: "Route Planning", key: "route-planning", href: "route-planning.html" },
      { label: "Delivery Management", key: "delivery-management", href: "delivery-management.html" },
      { label: "Logistic Returns", key: "logistic-returns", href: "logistic-returns.html" },
      { label: "Live Delivery Tracking", key: "live-tracking", href: "live-tracking.html" },
    ] },
    { label: "Production", icon: I.factory, group: true, collapsed: true, children: [] },
    { label: "Inventory", icon: I.inv, group: true, collapsed: true, children: [] },
    { label: "Stock Audit Settlement", icon: I.clip, group: true, collapsed: true, children: [] },
    { label: "Procurement", icon: I.cart, group: true, collapsed: true, children: [] },
    { label: "Finance", icon: I.coin, group: true, collapsed: true, children: [] },
    { label: "Workforce Management", icon: I.wf },
    { label: "Route Delivery", icon: I.pin },
    { label: "Store QR Code", icon: I.qr },
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
      <aside class="sidebar" id="sidebar"><div class="brand"><span class="logo">${I.bag}</span><span class="name">QA store</span></div><nav class="nav">${nav}</nav></aside>
      <div class="main"><div class="topbar"><button class="hamburger" id="hamburger">${I.menu}</button><div class="page-title">${esc(title)}</div><div class="spacer"></div><div class="user"><div class="who"><b>Mahesh</b><br><small>Admin</small></div><div class="av">${I.user}</div></div></div><div class="content" id="content"></div></div>
      <div class="toast" id="toast"></div>`;
  }
  function wireShell() {
    const sb = document.getElementById("sidebar"), scrim = document.getElementById("scrim");
    document.getElementById("hamburger")?.addEventListener("click", () => { sb.classList.add("open"); scrim.classList.add("show"); });
    scrim?.addEventListener("click", () => { sb.classList.remove("open"); scrim.classList.remove("show"); });
    sb.querySelectorAll("[data-toggle]").forEach((row) => row.addEventListener("click", () => { const sub = row.nextElementSibling; if (!sub || !sub.classList.contains("nav-sub")) return; const open = row.classList.toggle("open"); sub.style.display = open ? "" : "none"; }));
    sb.querySelectorAll("[data-demo]").forEach((el) => el.addEventListener("click", () => toast(`${el.dataset.demo} lives in another module — this prototype covers Distribution & Logistics`)));
  }

  // Mobile bottom nav.
  function footer(buttons) {
    let f = document.getElementById("mfooter");
    if (!buttons) { if (f) f.remove(); return; }
    if (!f) { f = document.createElement("div"); f.className = "mobile-footer"; f.id = "mfooter"; document.querySelector(".main").appendChild(f); }
    f.innerHTML = buttons.map((b, i) => `<button class="mf-btn ${b.cls || ""}" data-i="${i}"><span class="mf-ic">${b.icon}</span>${esc(b.label)}</button>`).join("");
    f.querySelectorAll(".mf-btn").forEach((el) => el.addEventListener("click", () => buttons[+el.dataset.i].onClick(el)));
  }

  /* =========================================================================
     SCREEN 1 — ROUTE PLANNING  (Delivery Templates)
     ========================================================================= */
  function screenRoutePlanning() {
    const state = { search: "" };
    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="subtabs"><button class="subtab active">Delivery Templates</button></div>
      <div class="filters"><div class="search">${I.search}<input id="q" type="search" placeholder="Search delivery routes..."></div><div class="grow" style="flex:1"></div><button class="btn btn-primary" id="add">${I.plus} Add Delivery Template</button></div>
      <div id="list"></div>`;

    function filtered() {
      const q = state.search.trim().toLowerCase();
      return SEED.routeTemplates
        .filter((r) => !q || r.name.toLowerCase().includes(q))
        .slice()
        .sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0));
    }
    function routeForm(editing) {
      const custSet = new Set((editing?.customers) || []);
      const staffSet = new Set((editing?.staffs) || []);
      const { panel } = drawer({
        title: editing ? "Edit Route Template" : "New Delivery Template",
        saveLabel: editing ? "Update" : "Create", wide: false,
        body: `
          <div class="d-row"><label>Route Name <span class="req">*</span></label><div class="ctrl"><input name="name" value="${attr(editing?.name || "")}" placeholder="e.g. Bandra Route"></div></div>
          <div class="d-row"><label>Customers</label><div class="ctrl"><div id="msCust"></div></div></div>
          <div class="d-row"><label>Staff Members</label><div class="ctrl"><div id="msStaff"></div></div></div>`,
        onSave: (f) => {
          const name = f.name.value.trim();
          if (!name) { toast("Route name is required.", "err"); return false; }
          const customers = [...custSet], staffs = [...staffSet];
          if (editing) { Object.assign(editing, { name, customers, staffs }); toast("Route template updated successfully.", "ok"); }
          else { SEED.routeTemplates.unshift({ id: "rt-" + Date.now(), name, customers, staffs, created: new Date().toISOString() }); toast("Route template created successfully.", "ok"); }
          render();
        },
      });
      mountMultiSelect(panel.querySelector("#msCust"), { items: SEED.customers.map((c) => ({ id: c.id, name: c.name })), selectedSet: custSet, placeholder: "Select customers...", searchPlaceholder: "Search customers...", assignments: buildAssignments("customers", editing?.id) });
      mountMultiSelect(panel.querySelector("#msStaff"), { items: SEED.staff.map((s) => ({ id: s.id, name: s.name })), selectedSet: staffSet, placeholder: "Select staff...", searchPlaceholder: "Search staff...", assignments: buildAssignments("staffs", editing?.id) });
    }
    function render() {
      const rows = filtered();
      const list = document.getElementById("list");
      if (rows.length === 0) { list.innerHTML = emptyBlock("No delivery templates found.", "Try another search term, or add a new delivery template."); footer([{ icon: I.plus, label: "Add Template", cls: "primary", onClick: () => routeForm(null) }]); return; }
      const tbody = rows.map((r) => `<tr>
        <td><span class="prod-name">${esc(r.name)}</span></td>
        <td><span class="cat-text">${count(r.customers)} customer${count(r.customers) !== 1 ? "s" : ""}</span></td>
        <td><span class="cat-text">${count(r.staffs)} staff</span></td>
        <td><div class="row-actions"><button class="icon-btn" title="Edit" data-act="edit" data-id="${r.id}">${I.edit}</button><button class="icon-btn danger" title="Delete" data-act="del" data-id="${r.id}">${I.trash}</button></div></td>
      </tr>`).join("");
      const cards = rows.map((r) => `<div class="pcard" data-id="${r.id}"><div class="pc-top" style="padding:14px">
        <div class="pc-main"><div class="pc-name">${esc(r.name)}</div><div class="pc-art">${count(r.customers)} customer${count(r.customers) !== 1 ? "s" : ""} · ${count(r.staffs)} staff</div></div>
        <div class="pc-acts" style="display:flex;gap:4px"><button class="icon-btn" data-act="edit" data-id="${r.id}">${I.edit}</button><button class="icon-btn danger" data-act="del" data-id="${r.id}">${I.trash}</button></div>
      </div></div>`).join("");
      list.innerHTML = `<div class="table-wrap desktop-only"><div class="table-scroll"><table class="grid"><thead><tr><th>Name</th><th>Customers</th><th>Staff</th><th style="text-align:right">Actions</th></tr></thead><tbody>${tbody}</tbody></table></div></div><div class="cards">${cards}</div>`;
      list.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => {
        const r = SEED.routeTemplates.find((x) => x.id === b.dataset.id);
        if (b.dataset.act === "edit") routeForm(r);
        else confirmDelete({ title: "Delete Route Template", message: `Are you sure you want to delete <b>${esc(r.name)}</b>? This cannot be undone.`, onConfirm: () => { SEED.routeTemplates = SEED.routeTemplates.filter((x) => x.id !== r.id); window.SEED.routeTemplates = SEED.routeTemplates; render(); toast("Route template deleted.", "ok"); } });
      }));
      footer([{ icon: I.plus, label: "Add Template", cls: "primary", onClick: () => routeForm(null) }]);
    }
    let deb;
    document.getElementById("q").addEventListener("input", (e) => { clearTimeout(deb); deb = setTimeout(() => { state.search = e.target.value; render(); }, 200); });
    document.getElementById("add").addEventListener("click", () => routeForm(null));
    render();
  }

  /* =========================================================================
     SCREEN 2 — LOGISTIC RETURNS  (Asset Movement / Inventory / Assets)
     ========================================================================= */
  function warehouseStock() { return SEED.assets.reduce((s, a) => s + (a.warehouse || 0), 0); }
  function deriveStats() {
    let issued = 0, returned = 0; const custs = new Set(); const assetIds = new Set();
    SEED.orgs.forEach((o) => { custs.add(o.id); (o.reverseLogistics || []).forEach((rl) => { issued += rl.issued || 0; returned += rl.returned || 0; if (rl.assetId) assetIds.add(rl.assetId); }); });
    return { issued, returned, outstanding: issued - returned, customers: custs.size, assets: assetIds.size };
  }

  function screenLogisticReturns() {
    const state = { tab: "movement", search: "", assetFilter: "", date: "", sort: "customerAsc" };
    const content = document.getElementById("content");
    function summary() {
      const s = deriveStats(), wh = warehouseStock();
      return `<div class="rl-summary">
        <div class="rl-stat"><div class="sync">${I.sync}</div><div><div class="lbl">Total Outstanding Returns</div><div class="big">${s.outstanding}</div><div class="sub">${s.issued} issued · ${s.returned} returned · across ${s.customers} customers · ${s.assets} asset${s.assets !== 1 ? "s" : ""}</div></div></div>
        <div class="divider"></div>
        <div class="rl-stat"><div><div class="lbl">In Warehouse</div><div class="big">${wh}</div><div class="sub">${wh + s.outstanding} total assets</div></div></div>
        <div class="grow"></div>
        <button class="btn btn-primary" id="recordBtn">${I.plus} Record Asset Movement</button>
      </div>`;
    }
    function tabsBar() {
      const t = (k, icon, label) => `<button class="subtab ${state.tab === k ? "active" : ""}" data-tab="${k}">${icon} ${label}</button>`;
      return `<div class="subtabs" style="gap:22px">${t("movement", I.sync, "Asset Movement")}${t("inventory", I.inv, "Asset Inventory")}${t("assets", I.pkg, "Assets")}</div>`;
    }
    function render() {
      content.innerHTML = summary() + tabsBar() + `<div id="tabbody"></div>`;
      document.getElementById("recordBtn").addEventListener("click", () => recordMovementDrawer(""));
      content.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { state.tab = b.dataset.tab; render(); }));
      if (state.tab === "movement") renderMovement();
      else if (state.tab === "inventory") renderInventory();
      else renderAssets();
    }

    // ── Tab: Asset Movement ─────────────────────────────────────────────────
    function orgOutstanding(o) { return (o.reverseLogistics || []).reduce((s, rl) => s + (rl.outstanding || 0), 0); }
    function orgLastTx(o) { return Math.max(0, ...(o.reverseLogistics || []).map((rl) => rl.lastTransactionDate ? new Date(rl.lastTransactionDate).getTime() : 0)); }
    function renderMovement() {
      const body = document.getElementById("tabbody");
      const pills = SEED.assets.map((a) => { const out = SEED.orgs.reduce((s, o) => s + (o.reverseLogistics || []).filter((rl) => rl.assetId === a.id).reduce((x, rl) => x + rl.outstanding, 0), 0); return `<span class="asset-pill">${I.crate} ${esc(a.name)} — ${out} outstanding</span>`; }).join("");
      body.innerHTML = `
        <div class="pill-row">${pills}</div>
        <div class="tbl-controls">
          <div class="search">${I.search}<input id="rlq" type="search" placeholder="Search by customer name or asset..."></div>
          <select class="mini-select" id="afilter"><option value="">All Assets</option>${SEED.assets.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select>
          <input type="date" class="date-input" id="dfilter">
          <select class="mini-select" id="sfilter">
            <option value="customerAsc">Customer name A → Z</option><option value="customerDesc">Customer name Z → A</option>
            <option value="outstandingDesc">Outstanding: highest first</option><option value="outstandingAsc">Outstanding: lowest first</option>
            <option value="lastDesc">Last transaction: newest first</option><option value="lastAsc">Last transaction: oldest first</option>
          </select>
        </div>
        <div id="mvlist"></div>`;
      const drawList = () => {
        const q = state.search.trim().toLowerCase();
        let rows = SEED.orgs.filter((o) => {
          if (state.assetFilter && !(o.reverseLogistics || []).some((rl) => rl.assetId === state.assetFilter)) return false;
          if (q) return o.name.toLowerCase().includes(q) || (o.reverseLogistics || []).some((rl) => rl.assetName.toLowerCase().includes(q));
          return true;
        });
        rows.sort((a, b) => {
          switch (state.sort) {
            case "customerDesc": return b.name.localeCompare(a.name);
            case "outstandingDesc": return orgOutstanding(b) - orgOutstanding(a);
            case "outstandingAsc": return orgOutstanding(a) - orgOutstanding(b);
            case "lastDesc": return orgLastTx(b) - orgLastTx(a);
            case "lastAsc": return orgLastTx(a) - orgLastTx(b);
            default: return a.name.localeCompare(b.name);
          }
        });
        const mv = document.getElementById("mvlist");
        if (!rows.length) { mv.innerHTML = emptyBlock("No movements found", "Try a different search term or filter."); return; }
        const tbody = rows.map((o) => { const rl = (o.reverseLogistics || [])[0] || {}; const out = orgOutstanding(o); return `<tr>
          <td><div class="rl-cust"><div class="nm">${esc(o.name)}</div><div class="ph">${esc(o.phone)}</div></div></td>
          <td><span class="rl-asset">${I.crate}<span><span class="nm">${esc(rl.assetName || "—")}</span><br><span class="art">${esc(rl.articleNo || "")}</span></span></span></td>
          <td><span class="out-badge">${out} ${esc(rl.measurement || "Crate")}</span></td>
          <td>${fmtDate(rl.lastTransactionDate)}</td>
          <td>${esc(rl.deliveredBy || "—")}</td>
          <td style="text-align:right"><div style="display:inline-flex;gap:10px;align-items:center"><button class="rl-link" data-ledger="${o.id}">View Ledger</button><button class="rl-ghost" data-move="${o.id}">Record Movement</button></div></td>
        </tr>`; }).join("");
        const cards = rows.map((o) => { const rl = (o.reverseLogistics || [])[0] || {}; const out = orgOutstanding(o); return `<div class="pcard"><div class="pc-top" style="padding:14px;flex-direction:column;align-items:stretch;gap:8px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start"><div class="rl-cust"><div class="nm">${esc(o.name)}</div><div class="ph">${esc(o.phone)}</div></div><span class="out-badge">${out} ${esc(rl.measurement || "Crate")}</span></div>
          <div class="pc-art">${esc(rl.assetName || "—")} · ${esc(rl.articleNo || "")} · last ${fmtDate(rl.lastTransactionDate)}</div>
          <div style="display:flex;gap:8px;margin-top:4px"><button class="rl-ghost" style="flex:1" data-ledger="${o.id}">View Ledger</button><button class="rl-ghost" style="flex:1" data-move="${o.id}">Record Movement</button></div>
        </div></div>`; }).join("");
        mv.innerHTML = `<div class="table-wrap desktop-only"><div class="table-scroll"><table class="grid"><thead><tr><th>Customer</th><th>Asset</th><th>Outstanding</th><th>Last Transaction</th><th>Delivery By</th><th style="text-align:right"></th></tr></thead><tbody>${tbody}</tbody></table></div></div><div class="cards">${cards}</div>`;
        mv.querySelectorAll("[data-move]").forEach((b) => b.addEventListener("click", () => recordMovementDrawer(b.dataset.move)));
        mv.querySelectorAll("[data-ledger]").forEach((b) => b.addEventListener("click", () => ledgerPage(b.dataset.ledger)));
      };
      let deb;
      body.querySelector("#rlq").addEventListener("input", (e) => { clearTimeout(deb); deb = setTimeout(() => { state.search = e.target.value; drawList(); }, 180); });
      body.querySelector("#afilter").addEventListener("change", (e) => { state.assetFilter = e.target.value; drawList(); });
      body.querySelector("#dfilter").addEventListener("change", (e) => { state.date = e.target.value; drawList(); });
      body.querySelector("#sfilter").value = state.sort;
      body.querySelector("#sfilter").addEventListener("change", (e) => { state.sort = e.target.value; drawList(); });
      drawList();
      footer(null); // Logistic Returns has no mobile footer — Record lives in the summary header
    }

    // ── Tab: Asset Inventory ────────────────────────────────────────────────
    function renderInventory() {
      const body = document.getElementById("tabbody");
      body.innerHTML = `
        <div class="tbl-controls"><div class="search">${I.search}<input id="invq" type="search" placeholder="Search by asset name or article no..."></div><div class="grow" style="flex:1"></div><select class="mini-select" id="invsort"><option>Asset name A → Z</option><option>Asset name Z → A</option></select></div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:10px" id="invcount"></div>
        <div id="invlist"></div>`;
      const draw = () => {
        const q = (body.querySelector("#invq").value || "").trim().toLowerCase();
        let rows = SEED.assets.filter((a) => !q || a.name.toLowerCase().includes(q) || (a.articleNo || "").toLowerCase().includes(q));
        if (body.querySelector("#invsort").selectedIndex === 1) rows = rows.slice().sort((a, b) => b.name.localeCompare(a.name));
        else rows = rows.slice().sort((a, b) => a.name.localeCompare(b.name));
        body.querySelector("#invcount").textContent = `${rows.length} asset${rows.length !== 1 ? "s" : ""} tracked`;
        const inv = body.querySelector("#invlist");
        if (!rows.length) { inv.innerHTML = emptyBlock("No assets tracked", "Add a returnable asset to start tracking it."); return; }
        const tbody = rows.map((a) => `<tr>
          <td><div class="prod-cell"><span class="thumb noimg"><span class="ph">${I.imgph}</span></span><div><div class="prod-name">${esc(a.name)}</div><div class="prod-art">${esc(a.articleNo)}</div></div></div></td>
          <td class="num">${a.warehouse}</td><td class="num">${a.withCustomers}</td><td class="num"><span class="asset-total">${a.warehouse + a.withCustomers}</span></td>
        </tr>`).join("");
        const cards = rows.map((a) => `<div class="pcard"><div class="pc-top" style="padding:14px"><span class="thumb noimg"><span class="ph">${I.imgph}</span></span><div class="pc-main"><div class="pc-name">${esc(a.name)}</div><div class="pc-art">${esc(a.articleNo)}</div></div></div><div class="pc-stats"><div class="st"><b>${a.warehouse}</b><span>In warehouse</span></div><div class="st"><b class="warn">${a.withCustomers}</b><span>With customers</span></div><div class="st"><b class="ok">${a.warehouse + a.withCustomers}</b><span>Total</span></div></div></div>`).join("");
        inv.innerHTML = `<div class="table-wrap desktop-only"><div class="table-scroll"><table class="grid"><thead><tr><th>Asset</th><th class="num">In Warehouse</th><th class="num">With Customers</th><th class="num">Total Assets</th></tr></thead><tbody>${tbody}</tbody></table></div></div><div class="cards">${cards}</div>`;
      };
      let deb; body.querySelector("#invq").addEventListener("input", () => { clearTimeout(deb); deb = setTimeout(draw, 160); });
      body.querySelector("#invsort").addEventListener("change", draw);
      draw();
      footer(null);
    }

    // ── Tab: Assets (add / edit / view / delete) ───────────────────────────
    function assetForm(editing) {
      const gen = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz"[Math.floor(Math.random() * 54)]).join("");
      const artNo = editing ? editing.articleNo : gen();
      const priceBtnLabel = editing && editing.unit ? `1 ${esc(editing.baseUnit || editing.unit)} = 1 ${esc(editing.unit)}  ·  ${money(editing.price)}  ${editing.taxRate || 0}% tax` : "Select Unit &amp; Price";
      const { panel } = drawer({
        title: editing ? "Update Returnable Asset" : "Add Returnable Asset",
        subtitle: editing ? "Update returnable asset and necessary information from here" : "Add your returnable asset and necessary information from here",
        saveLabel: editing ? "Update Returnable Asset" : "Add Returnable Asset", wide: true,
        body: `
          <input type="hidden" name="unit" value="${attr(editing?.unit || "Crate")}"><input type="hidden" name="baseUnit" value="${attr(editing?.baseUnit || "")}"><input type="hidden" name="price" value="${attr(editing?.price != null ? editing.price : 0)}"><input type="hidden" name="gst" value="${attr(editing?.taxRate || 0)}">
          ${dRow("Article No", false, `<div class="with-btn"><input name="articleNo" value="${attr(artNo)}" placeholder="Article No"><button type="button" class="btn btn-primary" data-generate="articleNo" style="height:44px">Generate</button></div>`)}
          ${dRow("Title/Name", true, `<input name="name" value="${attr(editing?.name || "")}" placeholder="Title/Name" required>`)}
          ${dRow("Description", false, `<textarea name="description" placeholder="Description">${esc(editing?.description || "")}</textarea>`)}
          ${dRow("Images", false, imgGrid)}
          ${dRow("HSN/SAC", false, `<input name="hsn" value="${attr(editing?.hsn || "")}" placeholder="HSN/SAC">`)}
          ${dRow("Barcode", false, `<div class="with-btn"><input name="barcode" value="${attr(editing?.barcode || "")}" placeholder="Barcode"><button type="button" class="btn btn-primary" data-scan="barcode" style="height:44px;width:48px;padding:0;justify-content:center">${I.scan}</button></div>`)}
          ${dRow("Unit &amp; Price", true, `<button type="button" class="unit-price-btn ${editing?.unit ? "set" : ""}" id="upBtn">${priceBtnLabel}</button>`)}
          ${editing ? "" : dRow("Opening Stock", false, `<input name="warehouse" type="number" min="0" value="${attr(editing?.warehouse != null ? editing.warehouse : 0)}" placeholder="0">`)}
          ${dRow("Brand", false, `<input name="brand" value="${attr(editing?.brand || "")}" placeholder="Enter product brand">`)}`,
        onSave: (f) => {
          if (!f.name.value.trim()) { toast("Title/Name is required.", "err"); return false; }
          if (editing) {
            Object.assign(editing, { name: f.name.value.trim(), articleNo: f.articleNo.value.trim(), description: f.description.value.trim(), hsn: f.hsn.value.trim(), barcode: f.barcode.value.trim(), unit: f.unit.value || editing.unit, baseUnit: f.baseUnit.value || editing.baseUnit, price: +f.price.value || 0, taxRate: +f.gst.value || 0, brand: f.brand.value.trim() });
            toast("Returnable asset updated successfully.", "ok");
          } else {
            const wh = +f.warehouse.value || 0;
            SEED.assets.unshift({ id: "a-" + Date.now(), name: f.name.value.trim(), articleNo: f.articleNo.value.trim() || gen(), description: f.description.value.trim(), hsn: f.hsn.value.trim(), barcode: f.barcode.value.trim(), category: "RETURNABLE", unit: f.unit.value || "Crate", baseUnit: f.baseUnit.value || "undefined", price: +f.price.value || 0, taxRate: +f.gst.value || 0, status: "ACTIVE", warehouse: wh, withCustomers: 0, brand: f.brand.value.trim(), img: "crate" });
            toast("Returnable asset added successfully.", "ok");
          }
          render();
        },
      });
      panel.querySelector("#upBtn").addEventListener("click", () => openUnitPriceModal(panel));
    }
    function renderAssets() {
      const body = document.getElementById("tabbody");
      body.innerHTML = `
        <div class="tbl-controls"><div class="search">${I.search}<input id="aq" type="search" placeholder="Search by name or article no..."></div><div class="grow" style="flex:1"></div><button class="btn btn-primary" id="addAsset">${I.plus} Add Asset</button></div>
        <div id="alist"></div>`;
      const draw = () => {
        const q = (body.querySelector("#aq").value || "").trim().toLowerCase();
        const rows = SEED.assets.filter((a) => !q || a.name.toLowerCase().includes(q) || (a.articleNo || "").toLowerCase().includes(q));
        const al = body.querySelector("#alist");
        if (!rows.length) { al.innerHTML = emptyBlock("No returnable assets found.", "Add a returnable asset to get started."); return; }
        const active = (a) => a.status === "ACTIVE" || a.status === "show" || !a.status;
        const tbody = rows.map((a) => `<tr>
          <td><div class="prod-cell"><span class="thumb noimg"><span class="ph">${I.imgph}</span></span><div class="prod-name">${esc(a.name)}</div></div></td>
          <td><span style="font-family:ui-monospace,monospace;color:var(--ink-soft)">${esc(a.articleNo)}</span></td>
          <td>${a.barcode ? esc(a.barcode) : "—"}</td>
          <td>${esc(a.unit)}</td>
          <td><span class="status-pill ${active(a) ? "active" : "inactive"}">${active(a) ? "Active" : "Inactive"}</span></td>
          <td><div class="row-actions"><button class="icon-btn" title="View" data-act="view" data-id="${a.id}">${I.eye}</button><button class="icon-btn" title="Edit" data-act="edit" data-id="${a.id}">${I.edit}</button><button class="icon-btn danger" title="Delete" data-act="del" data-id="${a.id}">${I.trash}</button></div></td>
        </tr>`).join("");
        const cards = rows.map((a) => `<div class="pcard"><div class="pc-top" style="padding:14px"><span class="thumb noimg"><span class="ph">${I.imgph}</span></span><div class="pc-main"><div class="pc-name">${esc(a.name)}</div><div class="pc-art">${esc(a.articleNo)} · ${esc(a.unit)}</div></div><span class="status-pill ${active(a) ? "active" : "inactive"}">${active(a) ? "Active" : "Inactive"}</span></div><div class="pc-stats" style="justify-content:flex-end"><div class="pc-acts" style="display:flex;gap:4px"><button class="icon-btn" data-act="view" data-id="${a.id}">${I.eye}</button><button class="icon-btn" data-act="edit" data-id="${a.id}">${I.edit}</button><button class="icon-btn danger" data-act="del" data-id="${a.id}">${I.trash}</button></div></div></div>`).join("");
        al.innerHTML = `<div class="table-wrap desktop-only"><div class="table-scroll"><table class="grid"><thead><tr><th>Asset</th><th>Article No</th><th>Barcode</th><th>Unit</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead><tbody>${tbody}</tbody></table></div></div><div class="cards">${cards}</div>`;
        al.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => {
          const a = SEED.assets.find((x) => x.id === b.dataset.id);
          if (b.dataset.act === "view") assetDetail(a);
          else if (b.dataset.act === "edit") assetForm(a);
          else confirmDelete({ name: a.name, title: "Delete Asset", message: `Are you sure you want to delete <b>${esc(a.name)}</b>? This cannot be undone.`, onConfirm: () => { SEED.assets = SEED.assets.filter((x) => x.id !== a.id); window.SEED.assets = SEED.assets; render(); toast("Asset deleted successfully", "ok"); } });
        }));
      };
      let deb; body.querySelector("#aq").addEventListener("input", () => { clearTimeout(deb); deb = setTimeout(draw, 160); });
      body.querySelector("#addAsset").addEventListener("click", () => assetForm(null));
      draw();
      footer(null); // Logistic Returns has no mobile footer — Add Asset lives in the tab toolbar
    }

    // ── Asset detail view ───────────────────────────────────────────────────
    function assetDetail(a) {
      footer(null);
      const total = a.warehouse + a.withCustomers;
      const thumbs = Array.from({ length: 4 }, (_, i) => `<div class="t ${i === 0 ? "sel" : ""}">${I.imgph}</div>`).join("");
      const meta = [["SKU / Article No.", a.articleNo], ["Category", a.category || "RETURNABLE"], ["Brand", a.brand || "—"], ["Unit (Smallest)", a.unit], ["Base Unit", a.baseUnit || "undefined"], ["Barcode", a.barcode || "—"]].map(([l, v]) => `<div class="m"><div class="lbl">${esc(l)}</div><div class="val">${esc(v)}</div></div>`).join("");
      content.innerHTML = `
        <div class="detail-top"><button class="back" id="dBack">${I.back}</button><div class="breadcrumb">Asset › <b>${esc(a.name)}</b></div><div style="flex:1"></div><button class="btn btn-primary" id="dEdit">${I.edit} Edit Asset</button></div>
        <div class="detail-card"><div class="detail-gallery"><div class="big noimg"><span class="ph">${I.imgphL}</span></div><div class="detail-thumbs">${thumbs}</div></div>
          <div class="detail-info"><h1>${esc(a.name)} <span class="badge-active">Active</span></h1><p class="detail-desc">${esc(a.description || "")}</p><div class="detail-meta">${meta}</div></div>
          <div class="detail-price"><div class="lbl">Selling Price (Incl. tax)</div><div class="big">${money(a.price)}</div><div class="lbl">Tax Rate</div><div class="big" style="font-size:22px">${a.taxRate || 0}%</div></div></div>
        <div class="panel"><h3>${I.pkg} Inventory Summary</h3><div class="inv-summary">
          <div class="inv-sum-tile"><div class="ic">${I.pkg}</div><div class="n">${a.warehouse}</div><div class="l">In Warehouse</div></div>
          <div class="inv-sum-tile"><div class="ic">${I.users}</div><div class="n">${a.withCustomers}</div><div class="l">With Customers</div></div>
          <div class="inv-sum-tile"><div class="ic">${I.check}</div><div class="n">${total}</div><div class="l">Total Assets</div></div>
        </div></div>`;
      document.getElementById("dBack").addEventListener("click", render);
      document.getElementById("dEdit").addEventListener("click", () => assetForm(a));
    }

    // ── Customer ledger — full page (View Ledger) ──────────────────────────
    function ledgerPage(orgId) {
      footer(null);
      const o = SEED.orgs.find((x) => x.id === orgId);
      if (!o) { render(); return; }
      const ls = { tab: "history", q: "", asset: "", type: "", from: "", to: "" };
      // Transactions across the customer's assets, newest-first, with a per-asset
      // running "balance after" derived by walking each asset's ledger forward.
      function buildTx() {
        const txs = [];
        (o.reverseLogistics || []).forEach((rl) => (rl.ledger || []).forEach((t) => txs.push(Object.assign({}, t, { assetId: rl.assetId, assetName: rl.assetName, articleNo: rl.articleNo, measurement: rl.measurement }))));
        const asc = txs.slice().sort((a, b) => txTs(a) - txTs(b));
        const bal = {};
        asc.forEach((t) => { bal[t.assetId] = (bal[t.assetId] || 0) + (t.type === "FORWARD" ? t.qty : -t.qty); t.balanceAfter = bal[t.assetId]; });
        return asc.reverse();
      }
      function paint() {
        const allTx = buildTx(), last = allTx[0];
        const statCards = (o.reverseLogistics || []).map((rl) => `<div class="ledger-stat-card"><div class="lbl">${esc(rl.measurement || rl.assetName)}</div><div class="big out">${rl.outstanding}</div><div class="sub">${rl.issued} issued · ${rl.returned} returned</div></div>`).join("")
          + (last ? `<div class="ledger-stat-card"><div class="lbl">Last Transaction</div><div class="big">${fmtDate(last.date)}</div><div class="sub">${last.type} · ${last.qty} ${esc(last.measurement || "Crate")}</div></div>` : "");
        content.innerHTML = `
          <div class="ledger-crumb"><button class="back" id="lgBack">${I.back}</button><a id="lgReturns">Returns</a><span class="sep">/</span><b>${esc(o.name)}</b></div>
          <div class="ledger-head"><div class="av">${initials(o.name)}</div><div><div class="nm">${esc(o.name)}</div><div class="ph">${esc(o.phone)}</div></div><div class="grow"></div><button class="btn btn-primary" id="lgRecord">${I.plus} Record Asset Movement</button></div>
          <div class="ledger-stats">${statCards}</div>
          <div class="subtabs"><button class="subtab ${ls.tab === "history" ? "active" : ""}" data-lt="history">Transaction History</button><button class="subtab ${ls.tab === "summary" ? "active" : ""}" data-lt="summary">Balance Summary</button></div>
          <div id="lgbody"></div>`;
        content.querySelector("#lgBack").addEventListener("click", render);
        content.querySelector("#lgReturns").addEventListener("click", render);
        content.querySelector("#lgRecord").addEventListener("click", () => recordMovementDrawer(orgId, () => ledgerPage(orgId)));
        content.querySelectorAll("[data-lt]").forEach((b) => b.addEventListener("click", () => { ls.tab = b.dataset.lt; paint(); }));
        if (ls.tab === "history") paintHistory(allTx); else paintSummary();
      }
      function paintHistory(allTx) {
        const body = content.querySelector("#lgbody");
        body.innerHTML = `
          <div class="tbl-controls"><div class="search">${I.search}<input id="lgq" type="search" placeholder="Search transactions..."></div>
            <select class="mini-select" id="lgAsset"><option value="">All Assets</option>${SEED.assets.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select>
            <select class="mini-select" id="lgType"><option value="">All Types</option><option value="FORWARD">Forward</option><option value="REVERSE">Reverse</option></select>
            <span class="date-range"><input type="date" class="date-input" id="lgFrom">to<input type="date" class="date-input" id="lgTo"></span></div>
          <div id="lgtx"></div>`;
        const drawTx = () => {
          const rows = allTx.filter((t) => {
            if (ls.asset && t.assetId !== ls.asset) return false;
            if (ls.type && t.type !== ls.type) return false;
            if (ls.from && t.date < ls.from) return false;
            if (ls.to && t.date > ls.to) return false;
            if (ls.q) return [t.assetName, t.type, t.date].join(" ").toLowerCase().includes(ls.q.toLowerCase());
            return true;
          });
          const el = content.querySelector("#lgtx");
          if (!rows.length) { el.innerHTML = emptyBlock("No transactions", "Try a different search, type or date range."); return; }
          const tbody = rows.map((t) => `<tr>
            <td><div class="prod-name" style="font-weight:600">${fmtDate(t.date)}</div><div class="prod-art">${esc(t.time || "")}</div></td>
            <td><span class="tx-type ${t.type === "REVERSE" ? "reverse" : "forward"}">${t.type}</span></td>
            <td><span class="rl-asset">${I.crate}<span><span class="nm">${esc(t.assetName)}</span><br><span class="art">${esc(t.articleNo)}</span></span></span></td>
            <td class="qty-cell ${t.type === "FORWARD" ? "pos" : "neg"}">${t.type === "FORWARD" ? "+" : "−"}${t.qty}</td>
            <td><span class="bal-badge">${t.balanceAfter}</span></td>
            <td class="tx-muted">${t.invoice ? esc(t.invoice) : "—"}</td>
            <td>Mahesh</td>
            <td class="tx-muted">${t.remarks ? esc(t.remarks) : "—"}</td>
          </tr>`).join("");
          el.innerHTML = `<div class="table-wrap"><div class="table-scroll"><table class="grid" style="min-width:880px"><thead><tr><th>Date</th><th>Type</th><th>Asset</th><th>Qty</th><th>Balance After</th><th>Invoice / Order</th><th>Delivery By</th><th>Remarks</th></tr></thead><tbody>${tbody}</tbody></table></div></div>`;
        };
        let deb;
        body.querySelector("#lgq").addEventListener("input", (e) => { clearTimeout(deb); deb = setTimeout(() => { ls.q = e.target.value; drawTx(); }, 160); });
        body.querySelector("#lgAsset").addEventListener("change", (e) => { ls.asset = e.target.value; drawTx(); });
        body.querySelector("#lgType").addEventListener("change", (e) => { ls.type = e.target.value; drawTx(); });
        body.querySelector("#lgFrom").addEventListener("change", (e) => { ls.from = e.target.value; drawTx(); });
        body.querySelector("#lgTo").addEventListener("change", (e) => { ls.to = e.target.value; drawTx(); });
        drawTx();
      }
      function paintSummary() {
        content.querySelector("#lgbody").innerHTML = (o.reverseLogistics || []).map((rl) => `<div class="bal-summary"><div class="hd"><div class="ic">${I.pkg}</div><div><small>${esc(rl.measurement || rl.assetName)}</small><b>Running Balance</b></div></div>
          <div class="bal-tiles"><div class="bal-tile issued"><div class="l">Total Issued</div><div class="n">${rl.issued}</div></div><div class="bal-tile returned"><div class="l">Total Returned</div><div class="n">${rl.returned}</div></div><div class="bal-tile outstanding"><div class="l">Outstanding</div><div class="n">${rl.outstanding}</div></div></div></div>`).join("");
      }
      paint();
    }

    // ── Unit & Price modal (assets) ────────────────────────────────────────
    function openUnitPriceModal(panel) {
      const cur = { unit: panel.querySelector("[name=unit]").value || "Crate", base: panel.querySelector("[name=baseUnit]").value || "", price: panel.querySelector("[name=price]").value || 0, gst: panel.querySelector("[name=gst]").value || 0 };
      const m = modal({ title: "Add Pricing and Unit Details", subtitle: "Configure the returnable unit, GST treatment and price.",
        body: `
          <div class="upm-units">
            <div class="upm-field"><div class="upm-lbl">Smallest Unit <span class="req">*</span></div><div class="upm-hint">e.g. Crate, Bottle, Piece</div><input id="upUnit" value="${attr(cur.unit)}" placeholder="Crate"></div>
            <div class="upm-field"><div class="upm-lbl">Base Unit</div><div class="upm-hint">Leave blank if same as smallest</div><input id="upBase" value="${attr(cur.base)}" placeholder="Base unit"></div>
          </div>
          <div class="upm-tax"><h4>Tax Settings</h4><div class="sub">Set the GST rate for pricing.</div>
            <div class="upm-tax-grid"><div><div class="upm-lbl" style="color:#374151">GST Rate (%)</div><select id="upGst" style="width:100%;height:44px;border:1px solid var(--line);border-radius:8px;padding:0 12px;margin-top:6px;outline:none">${[0, 5, 12, 18, 28].map((r) => `<option value="${r}" ${String(r) === String(cur.gst) ? "selected" : ""}>${r}%</option>`).join("")}</select></div><div></div></div>
          </div>
          <div class="upm-price"><span class="lbl">Selling Price Per Unit</span><div class="box"><span class="cur">₹</span><input id="upPrice" type="number" min="0" step="0.01" placeholder="0.00" value="${attr(cur.price)}"></div></div>
          <button class="upm-save" id="upSave">SAVE</button>`,
        panelClass: "upm-modal" });
      m.panel.querySelector("#upSave").addEventListener("click", () => {
        const unit = m.panel.querySelector("#upUnit").value.trim() || "Crate";
        panel.querySelector("[name=unit]").value = unit;
        panel.querySelector("[name=baseUnit]").value = m.panel.querySelector("#upBase").value.trim();
        panel.querySelector("[name=price]").value = +m.panel.querySelector("#upPrice").value || 0;
        panel.querySelector("[name=gst]").value = m.panel.querySelector("#upGst").value;
        const btn = panel.querySelector("#upBtn"); btn.classList.add("set");
        btn.innerHTML = `1 ${esc(m.panel.querySelector("#upBase").value.trim() || unit)} = 1 ${esc(unit)}  ·  ${money(+m.panel.querySelector("#upPrice").value || 0)}  ${m.panel.querySelector("#upGst").value}% tax`;
        m.close(); toast("Unit & price set", "ok");
      });
    }

    // ── Record Asset Movement drawer (wizard) ──────────────────────────────
    function recordMovementDrawer(orgId, after) {
      const wz = { mode: "reverse", orgId: orgId || "", assetId: "", qty: "", notes: "", qtyErr: "" };
      const scrim = document.createElement("div"); scrim.className = "drawer-scrim";
      const panel = document.createElement("div"); panel.className = "drawer";
      document.body.appendChild(scrim); document.body.appendChild(panel);
      requestAnimationFrame(() => { scrim.classList.add("show"); panel.classList.add("open"); });
      const close = () => { scrim.classList.remove("show"); panel.classList.remove("open"); setTimeout(() => { scrim.remove(); panel.remove(); }, 280); };
      scrim.addEventListener("click", close);

      // Assets available for the chosen customer + mode.
      const availableAssets = () => {
        const org = SEED.orgs.find((o) => o.id === wz.orgId);
        if (wz.mode === "reverse") return (org?.reverseLogistics || []).filter((rl) => rl.outstanding > 0).map((rl) => ({ id: rl.assetId, name: rl.assetName, max: rl.outstanding, unit: rl.measurement }));
        return SEED.assets.map((a) => ({ id: a.id, name: a.name, max: a.warehouse, unit: a.unit }));
      };
      const selAsset = () => availableAssets().find((x) => x.id === wz.assetId);
      const step = () => (!wz.orgId ? 1 : !wz.assetId ? 2 : 3);
      const maxLabel = () => (wz.mode === "forward" ? "available warehouse stock" : "outstanding balance");
      const valid = () => wz.orgId && wz.assetId && wz.qty && Number(wz.qty) > 0 && !wz.qtyErr;

      function paint() {
        const s = step(), forward = wz.mode === "forward";
        const org = custById(wz.orgId) || SEED.orgs.find((o) => o.id === wz.orgId);
        const assets = availableAssets(), sa = selAsset();
        const stepLabel = s === 1 ? "Select customer" : s === 2 ? (forward ? "Select asset to issue" : "Select return asset") : "Enter quantity";
        panel.innerHTML = `
          <div class="drawer-head"><button class="x" id="wzX">${I.x}</button><h3>Record Asset Movement</h3><p>${forward ? "Issue an asset out to a customer" : "Record a return collection from a customer"}</p></div>
          <div class="drawer-body">
            <div class="mode-toggle"><button class="${!forward ? "on" : ""}" data-mode="reverse">${I.ret2} Return (from customer)</button><button class="${forward ? "on" : ""}" data-mode="forward">${I.issue} Issue (to customer)</button></div>
            <div class="stepper"><span class="dot ${s > 1 ? "done" : "active"}">${s > 1 ? "✓" : "1"}</span><span class="line ${s > 1 ? "done" : ""}"></span><span class="dot ${s > 2 ? "done" : s === 2 ? "active" : ""}">${s > 2 ? "✓" : "2"}</span><span class="line ${s > 2 ? "done" : ""}"></span><span class="dot ${s === 3 ? "active" : ""}">3</span><span class="lbl">${esc(stepLabel)}</span></div>

            ${wz.orgId ? `<div class="wz-block cust-picked"><div class="wz-lbl">${I.user} Customer <span class="req">*</span></div><div class="wz-cust"><div class="av">${initials(org?.name)}</div><div><div class="nm">${esc(org?.name || "")}</div><div class="ph">${esc(org?.phone || "")}</div></div><button class="change" id="wzChange">Change</button></div></div>`
              : `<div class="wz-block"><div class="wz-lbl">${I.user} Customer <span class="req">*</span></div><select id="wzCust"><option value="">Select a customer</option>${SEED.customers.map((c) => `<option value="${c.id}">${esc(c.name)} — ${esc(c.phone)}</option>`).join("")}</select></div>`}

            <div class="wz-block"><div class="wz-lbl">${I.crate} ${forward ? "Asset to Issue" : "Return Asset"} <span class="req">*</span></div>
              <select id="wzAsset" ${!wz.orgId ? "disabled" : ""}><option value="">${!wz.orgId ? "Select a customer first" : (forward ? "Select an asset to issue" : "Select a return asset")}</option>${assets.map((a) => `<option value="${a.id}" ${a.id === wz.assetId ? "selected" : ""}>${esc(a.name)} — ${a.max} ${forward ? "in warehouse" : "outstanding"}</option>`).join("")}</select>
              ${wz.orgId && !assets.length && !forward ? `<div class="wz-hint">This customer has no outstanding returns.</div>` : ""}
              ${wz.orgId && assets.length && !forward ? `<div class="wz-hint">${assets.length} asset${assets.length !== 1 ? "s" : ""} with outstanding balance</div>` : ""}
              ${wz.orgId && forward ? `<div class="wz-hint">${assets.reduce((s2, a) => s2 + a.max, 0)} asset${assets.length !== 1 ? "s" : ""} available in warehouse</div>` : ""}
            </div>

            <div class="wz-block"><div class="wz-lbl">${I.coin} Quantity to ${forward ? "Issue" : "Return"} <span class="req">*</span></div>
              <input id="wzQty" type="number" min="1" ${!wz.assetId ? "disabled" : ""} placeholder="${!wz.assetId ? "Select an asset first" : "Enter quantity"}" value="${attr(wz.qty)}">
              ${wz.qtyErr ? `<div class="wz-hint err">${esc(wz.qtyErr)}</div>` : (sa ? `<div class="wz-hint">Max ${sa.max} ${esc(sa.unit || "units")}</div>` : "")}
            </div>

            <div class="wz-block"><div class="wz-lbl">${I.note} Notes <span style="color:var(--muted-2);font-weight:500;text-transform:none;letter-spacing:0">(optional)</span></div><textarea id="wzNotes" placeholder="Pickup driver, condition of items, disputes, etc.">${esc(wz.notes)}</textarea></div>
          </div>
          <div class="drawer-foot"><button class="btn btn-primary" id="wzSubmit" ${valid() ? "" : "disabled"} style="flex:2">${I.check} ${forward ? "Issue Asset" : "Record Return"}</button><button class="btn cancel" id="wzCancel" style="flex:1">Cancel</button></div>`;

        panel.querySelector("#wzX").addEventListener("click", close);
        panel.querySelector("#wzCancel").addEventListener("click", close);
        panel.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { if (wz.mode === b.dataset.mode) return; wz.mode = b.dataset.mode; wz.assetId = ""; wz.qty = ""; wz.qtyErr = ""; paint(); }));
        panel.querySelector("#wzChange")?.addEventListener("click", () => { wz.orgId = ""; wz.assetId = ""; wz.qty = ""; wz.qtyErr = ""; paint(); });
        panel.querySelector("#wzCust")?.addEventListener("change", (e) => { wz.orgId = e.target.value; wz.assetId = ""; wz.qty = ""; wz.qtyErr = ""; paint(); });
        panel.querySelector("#wzAsset")?.addEventListener("change", (e) => { wz.assetId = e.target.value; wz.qty = ""; wz.qtyErr = ""; paint(); });
        const qi = panel.querySelector("#wzQty");
        qi?.addEventListener("input", (e) => {
          wz.qty = e.target.value;
          const n = Number(e.target.value), max = selAsset()?.max || 0;
          if (!e.target.value) wz.qtyErr = "";
          else if (n <= 0) wz.qtyErr = "Quantity must be at least 1";
          else if (n > max) wz.qtyErr = `Cannot exceed ${maxLabel()} of ${max} units`;
          else wz.qtyErr = "";
          // Update inline hint + submit state without losing focus.
          const block = qi.closest(".wz-block"); const old = block.querySelector(".wz-hint"); if (old) old.remove();
          const h = document.createElement("div"); h.className = "wz-hint" + (wz.qtyErr ? " err" : ""); h.textContent = wz.qtyErr || (selAsset() ? `Max ${max} ${selAsset().unit || "units"}` : ""); block.appendChild(h);
          panel.querySelector("#wzSubmit").disabled = !valid();
        });
        panel.querySelector("#wzNotes")?.addEventListener("input", (e) => { wz.notes = e.target.value; });
        panel.querySelector("#wzSubmit").addEventListener("click", () => {
          if (!valid()) return;
          const qty = Number(wz.qty), org = SEED.orgs.find((o) => o.id === wz.orgId), asset = SEED.assets.find((a) => a.id === wz.assetId);
          const custName = (custById(wz.orgId) || org)?.name || "customer";
          applyMovement(wz.mode, wz.orgId, wz.assetId, qty);
          close();
          toast(wz.mode === "forward" ? `Issued ${qty} to ${custName}` : `Return of ${qty} recorded`, "ok");
          (after || render)(); // refresh the screen (or the ledger page it was opened from)
        });
      }
      paint();
    }

    // Mutates seed to reflect a recorded movement, then keeps stats consistent.
    function applyMovement(mode, orgId, assetId, qty) {
      let org = SEED.orgs.find((o) => o.id === orgId);
      if (!org) { const c = custById(orgId); org = { id: c.id, name: c.name, phone: c.phone, reverseLogistics: [] }; SEED.orgs.push(org); }
      let rl = org.reverseLogistics.find((x) => x.assetId === assetId);
      const asset = SEED.assets.find((a) => a.id === assetId);
      if (!rl) { rl = { assetId, assetName: asset.name, articleNo: asset.articleNo, measurement: asset.unit, issued: 0, returned: 0, outstanding: 0, lastTransactionDate: null, deliveredBy: "Mahesh", ledger: [] }; org.reverseLogistics.push(rl); }
      const today = new Date().toISOString().slice(0, 10), time = fmtTime();
      if (mode === "forward") { rl.issued += qty; asset.warehouse -= qty; asset.withCustomers += qty; rl.ledger.unshift({ type: "FORWARD", qty, date: today, time, invoice: "", remarks: "" }); }
      else { rl.returned += qty; asset.warehouse += qty; asset.withCustomers -= qty; rl.ledger.unshift({ type: "REVERSE", qty, date: today, time, invoice: "", remarks: "" }); }
      rl.outstanding = rl.issued - rl.returned;
      rl.lastTransactionDate = today;
    }

    render();
  }

  /* =========================================================================
     SCREEN 3 — DELIVERY MANAGEMENT  (mobile Route Delivery)
     ========================================================================= */
  function screenDeliveryManagement() {
    const route = JSON.parse(JSON.stringify(SEED.deliveryRoute || { stops: [] }));
    const content = document.getElementById("content");
    footer(null);
    function stats() {
      const done = route.stops.filter((s) => s.status !== "pending").length;
      const collected = route.stops.filter((s) => s.status === "delivered").reduce((s, x) => s + x.amount, 0);
      return { done, total: route.stops.length, collected };
    }
    function render() {
      const st = stats(), pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
      content.innerHTML = `
        <p class="dm-hint" style="text-align:center;color:var(--muted);font-size:13px;margin:0 0 6px">Route Delivery runs on the driver's phone — mark stops delivered or skipped as you go.</p>
        <div class="phone-wrap"><div class="phone"><div class="notch"></div><div class="screen">
          <div class="dm-topbar"><div class="rt">${esc(route.date ? fmtDate(route.date) : "")} · ${esc(route.staff || "")}</div><h2>${esc(route.name || "Route")}</h2>
            <div class="meta"><div><b>${st.done}/${st.total}</b>stops</div><div><b>${money(st.collected)}</b>collected</div><div><b>${esc(route.vehicle || "—")}</b>vehicle</div></div>
            <div class="dm-progress"><span style="width:${pct}%"></span></div>
          </div>
          <div class="dm-body" id="dmBody"></div>
          <div class="dm-foot"><button class="ghost" id="dmReset">Reset</button><button class="primary" id="dmClose">${st.done === st.total ? "Close Route" : "End Route Early"}</button></div>
        </div></div></div>`;
      const body = content.querySelector("#dmBody");
      body.innerHTML = route.stops.map((s) => {
        const badge = s.status === "delivered" ? `<span class="stop-badge delivered">Delivered</span>` : s.status === "skipped" ? `<span class="stop-badge skipped">Skipped</span>` : `<span class="stop-badge pending">Pending</span>`;
        return `<div class="stop-card ${s.status !== "pending" ? "done" : ""}">
          <div class="row1"><div class="stop-seq">${s.seq}</div><div style="min-width:0;flex:1"><div class="nm">${esc(s.name)}</div><div class="addr">${esc(s.address)}</div></div>${badge}</div>
          <div class="amt"><span>${s.items} items</span><b>${money(s.amount)}</b></div>
          ${s.status === "pending" ? `<div class="stop-actions"><button class="deliver" data-deliver="${s.seq}">${I.check} Deliver</button><button class="skip" data-skip="${s.seq}">Skip</button></div>` : `<div class="stop-actions"><button data-undo="${s.seq}">Undo</button></div>`}
        </div>`;
      }).join("");
      body.querySelectorAll("[data-deliver]").forEach((b) => b.addEventListener("click", () => { route.stops.find((s) => s.seq == b.dataset.deliver).status = "delivered"; render(); toast("Stop marked delivered", "ok"); }));
      body.querySelectorAll("[data-skip]").forEach((b) => b.addEventListener("click", () => { route.stops.find((s) => s.seq == b.dataset.skip).status = "skipped"; render(); toast("Stop skipped"); }));
      body.querySelectorAll("[data-undo]").forEach((b) => b.addEventListener("click", () => { route.stops.find((s) => s.seq == b.dataset.undo).status = "pending"; render(); }));
      content.querySelector("#dmReset").addEventListener("click", () => { route.stops.forEach((s) => (s.status = "pending")); render(); toast("Route reset"); });
      content.querySelector("#dmClose").addEventListener("click", () => toast(st.done === st.total ? "Route closed 🎉" : "Route ended early", "ok"));
    }
    render();
  }

  const TITLES = { "route-planning": "Route Planning", "logistic-returns": "Logistic Returns", "delivery-management": "Delivery Management", "live-tracking": "Live Delivery Tracking" };
  window.FB = {
    mount(screen) {
      document.getElementById("app").innerHTML = shell(screen, TITLES[screen]);
      wireShell();
      if (screen === "route-planning") screenRoutePlanning();
      else if (screen === "logistic-returns") screenLogisticReturns();
      else if (screen === "delivery-management") screenDeliveryManagement();
      else if (screen === "live-tracking") {
        if (window.FBTrack) window.FBTrack.screen();
        else document.getElementById("content").innerHTML = '<p style="padding:20px;color:#991b1b">tracking.js did not load.</p>';
      }
    },
  };
})();

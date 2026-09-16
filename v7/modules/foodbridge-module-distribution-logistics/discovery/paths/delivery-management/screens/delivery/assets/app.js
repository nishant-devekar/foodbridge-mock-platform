/* ==========================================================================
   Delivery Management — mobile Route Delivery app (HTML replica of the live
   "QA store" route-delivery-app). Vanilla JS, no build step, MOBILE ONLY.

   Architecture (section-wise files):
     • app.js         — the DM namespace: seed → working state, a tiny router
                        with a back-stack, the phone shell (status bar + screen),
                        and shared UI helpers (topbar, bottom nav, sheets,
                        steppers, numpad, toast, money).
     • sections/*.js  — one file per screen; each registers a render function on
                        DM.sections[<name>](body, params). Screens own their own
                        teal header + footer since layouts differ per screen.

   Flow: home → route (pre-start) → load-stock → cash-change → ready-start →
         delivery-queue → stop-detail → collect-payment → settle-route →
         stock-count → cash-handover → route-report.  Everything mutates
         DM.state and re-renders.
   ========================================================================== */
(function () {
  const SEED = window.DM_SEED || { products: [], routes: [], dashboard: {}, staff: "Mahesh" };

  const DM = (window.DM = {
    staff: SEED.staff,
    dashboard: SEED.dashboard,
    // deep-cloned working state so re-mounting the demo starts fresh
    products: JSON.parse(JSON.stringify(SEED.products)),
    routes: JSON.parse(JSON.stringify(SEED.routes)),
    templates: JSON.parse(JSON.stringify(SEED.templates || [])),
    sections: {},
    history: [],
    reportsCount: 40,
    reportsCollected: 24345,
    today: "2026-08-11",
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const money2 = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const attr = (s) => esc(s).replace(/'/g, "&#39;");
  const initials = (s) => String(s || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  DM.money = money; DM.money2 = money2; DM.esc = esc; DM.attr = attr; DM.initials = initials;

  DM.product = (id) => DM.products.find((p) => p.id === id);
  DM.route = (id) => DM.routes.find((r) => r.id === id);
  // Order value for a set of {productId, qty} lines.
  DM.orderValue = (lines) => (lines || []).reduce((s, l) => { const p = DM.product(l.productId); return s + (p ? p.price * l.qty : 0); }, 0);
  DM.orderUnits = (lines) => (lines || []).reduce((s, l) => s + l.qty, 0);
  DM.routeStats = (r) => {
    const delivered = r.stops.filter((s) => s.status === "delivered").length;
    const skipped = r.stops.filter((s) => s.status === "skipped").length;
    const done = delivered + skipped;
    const collected = r.stops.reduce((s, x) => s + (x.collected || 0), 0);
    const outstanding = r.stops.filter((s) => s.status === "delivered").reduce((s, x) => s + Math.max(0, DM.orderValue(x.order) - (x.collected || 0)), 0);
    return { delivered, skipped, done, total: r.stops.length, collected, outstanding };
  };

  // ── Router + phone shell ──────────────────────────────────────────────────
  DM.go = function (name, params, replace) {
    if (!replace) DM.history.push({ name: DM.current, params: DM.params });
    DM.current = name; DM.params = params || {};
    DM.render();
  };
  DM.back = function () {
    const prev = DM.history.pop();
    if (prev) { DM.current = prev.name; DM.params = prev.params; DM.render(); }
    else DM.go("home", {}, true);
  };
  DM.render = function () {
    const body = document.getElementById("dm-screen");
    body.scrollTop = 0;
    const fn = DM.sections[DM.current];
    if (fn) fn(body, DM.params || {});
    else body.innerHTML = `<div style="padding:40px;text-align:center;color:#94a3b8">Screen "${esc(DM.current)}" not found.</div>`;
  };

  DM.mount = function () {
    const app = document.getElementById("dm-app");
    const now = new Date();
    const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    app.innerHTML = `
      <div class="dm-phone"><div class="dm-notch"></div>
        <div class="dm-device">
          <div class="dm-status"><span class="clk">${clock}</span><span class="dot"></span><span class="sig">.ıll 100% ▮</span></div>
          <div class="dm-screen" id="dm-screen"></div>
        </div>
      </div>`;
    DM.current = "home"; DM.params = {}; DM.history = [];
    DM.render();
  };

  // ── Shared UI ─────────────────────────────────────────────────────────────
  DM.toast = function (msg) {
    const host = document.getElementById("dm-screen"); if (!host) return;
    let t = host.querySelector(".dm-toast");
    if (!t) { t = document.createElement("div"); t.className = "dm-toast"; host.appendChild(t); }
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(DM.toast._t); DM.toast._t = setTimeout(() => t.classList.remove("show"), 2400);
  };

  // Teal header. opts: { title, subtitle, back(bool|onclick), home(bool), right(html), onRight }
  DM.topbar = function (opts) {
    const back = opts.back ? `<button class="tb-back" id="tbBack">← ${esc(typeof opts.back === "string" ? opts.back : "")}</button>` : "";
    const homeBtn = opts.home ? `<button class="tb-home" id="tbHome">⌂</button>` : "";
    const rightCluster = (opts.right || homeBtn) ? `<div class="tb-right">${opts.right || ""}${homeBtn}</div>` : "<span></span>";
    return `<div class="dm-topbar ${opts.plain ? "plain" : ""}">
      <div class="tb-row">${back || "<span></span>"}${rightCluster}</div>
      ${opts.title ? `<h1>${esc(opts.title)}</h1>` : ""}
      ${opts.subtitle ? `<p>${esc(opts.subtitle)}</p>` : ""}</div>`;
  };
  DM.wireTop = function (root) {
    root.querySelector("#tbBack")?.addEventListener("click", DM.back);
    root.querySelector("#tbHome")?.addEventListener("click", () => DM.go("home"));
  };

  // Bottom tab bar (Home / Routes / Follow-up / Reports / Back)
  DM.nav = function (active) {
    const items = [
      { k: "home", label: "Home", ic: "🏠" },
      { k: "routes", label: "Routes", ic: "🗺️" },
      { k: "followup", label: "Follow-up", ic: "📋" },
      { k: "reports", label: "Reports", ic: "📊" },
      { k: "back", label: "Back", ic: "←" },
    ];
    return `<div class="dm-nav">${items.map((i) => `<button class="nav-btn ${i.k === active ? "active" : ""}" data-nav="${i.k}"><span class="ic">${i.ic}</span>${i.label}</button>`).join("")}</div>`;
  };
  DM.wireNav = function (root) {
    root.querySelectorAll("[data-nav]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.nav;
      if (k === "back") return DM.back();
      if (k === "home") return DM.go("home");
      if (k === "reports") return DM.go("reports-list");
      DM.toast("This section is coming soon in the next update.");
    }));
  };

  // Bottom sheet. actions = [{label, cls:'primary'|'ghost', onClick}]
  DM.sheet = function ({ eyebrow, title, sub, body, actions }) {
    document.querySelectorAll(".dm-sheet-scrim").forEach((s) => s.remove()); // one sheet at a time
    const host = document.getElementById("dm-screen"); // stay inside the phone frame
    const scrim = document.createElement("div"); scrim.className = "dm-sheet-scrim";
    scrim.innerHTML = `<div class="dm-sheet"><div class="grip"></div>
      ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ""}
      ${title ? `<h2>${esc(title)}</h2>` : ""}
      ${sub ? `<p class="sub">${esc(sub)}</p>` : ""}
      ${body || ""}
      <div class="sheet-acts">${(actions || []).map((a, i) => `<button class="sheet-btn ${a.cls || "ghost"}" data-a="${i}">${esc(a.label)}</button>`).join("")}</div></div>`;
    host.appendChild(scrim);
    requestAnimationFrame(() => scrim.classList.add("show"));
    const close = () => { scrim.classList.remove("show"); setTimeout(() => scrim.remove(), 240); };
    scrim.addEventListener("click", (e) => { if (e.target === scrim) close(); });
    (actions || []).forEach((a, i) => scrim.querySelector(`[data-a="${i}"]`).addEventListener("click", () => { if (a.onClick && a.onClick() === false) return; close(); }));
    return { scrim, close, el: scrim.querySelector(".dm-sheet") };
  };

  // Centered modal (New Delivery). actions = [{label, cls, onClick}].
  DM.modal = function ({ title, subtitle, body, actions }) {
    document.querySelectorAll(".dm-modal-scrim").forEach((s) => s.remove());
    const host = document.getElementById("dm-screen");
    const scrim = document.createElement("div"); scrim.className = "dm-modal-scrim";
    scrim.innerHTML = `<div class="dm-modal"><div class="dm-modal-hd"><div class="mh"><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div><button class="dm-modal-x">✕</button></div>
      <div class="dm-modal-body">${body || ""}</div>
      <div class="dm-modal-foot">${(actions || []).map((a, i) => `<button class="modal-btn ${a.cls || "ghost"}" data-a="${i}">${esc(a.label)}</button>`).join("")}</div></div>`;
    host.appendChild(scrim);
    requestAnimationFrame(() => scrim.classList.add("show"));
    const close = () => { scrim.classList.remove("show"); setTimeout(() => scrim.remove(), 200); };
    scrim.addEventListener("click", (e) => { if (e.target === scrim) close(); });
    scrim.querySelector(".dm-modal-x").addEventListener("click", close);
    (actions || []).forEach((a, i) => scrim.querySelector(`[data-a="${i}"]`).addEventListener("click", () => { if (a.onClick && a.onClick() === false) return; close(); }));
    return { scrim, el: scrim.querySelector(".dm-modal"), close };
  };

  // Stepper markup + wiring. onStep(id, newValue, delta).
  DM.stepper = (id, value, opts) => `<div class="dm-stepper ${opts && opts.disabled ? "disabled" : ""}" data-step="${attr(id)}"><button data-dec ${opts && opts.disabled ? "disabled" : ""}>−</button><input data-val value="${value}" inputmode="numeric" ${opts && opts.disabled ? "disabled" : ""}><button data-inc ${opts && opts.disabled ? "disabled" : ""}>+</button></div>`;
  DM.onStep = function (root, cb) {
    root.querySelectorAll(".dm-stepper").forEach((s) => {
      const id = s.dataset.step, input = s.querySelector("[data-val]");
      const set = (v) => { v = Math.max(0, v | 0); input.value = v; cb(id, v); };
      s.querySelector("[data-dec]").addEventListener("click", () => set((+input.value || 0) - 1));
      s.querySelector("[data-inc]").addEventListener("click", () => set((+input.value || 0) + 1));
      input.addEventListener("input", () => set(+input.value || 0));
    });
  };

  // Numeric keypad markup + wiring. onKey('0'..'9' | 'back' | 'clear').
  DM.numpad = () => `<div class="dm-numpad">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "clear"].map((k) => `<button class="np-key ${k === "back" || k === "clear" ? "np-fn" : ""}" data-k="${k}">${k === "back" ? "←" : k === "clear" ? "C" : k}</button>`).join("")}</div>`;
  DM.onNumpad = function (root, handler) {
    root.querySelectorAll(".np-key").forEach((b) => b.addEventListener("click", () => handler(b.dataset.k)));
  };
  // Apply a keypad key to a numeric string amount.
  DM.applyKey = function (cur, k) {
    cur = String(cur || "");
    if (k === "clear") return "";
    if (k === "back") return cur.slice(0, -1);
    if (cur.length >= 9) return cur;
    return (cur === "0" ? "" : cur) + k;
  };

  DM.currentRoute = () => DM.route(DM.params && DM.params.routeId) || DM.routes[0];

  window.addEventListener("DOMContentLoaded", () => DM.mount());
})();

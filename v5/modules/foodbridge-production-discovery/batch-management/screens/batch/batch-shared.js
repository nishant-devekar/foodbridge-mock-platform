// batch-shared.js — ported verbatim (logic-for-logic) from the real
// development/frontend/src/components/batch/batchUi.tsx, as it exists at the v7 fork point
// (2026-08-10, post 16+ commits of drift since the v6 freeze on 2026-07-28 — see CHANGELOG).
// Icons, formatters, bucketOf/statusBadgeClass/attentionReason — the same helpers every real
// screen (List/Detail/Create/SemiFinished/InventorySyncQueue) shares from one place.

// ── seed data loader ──
// Session-persisted so a transition/create fired on one screen (a real page navigation, not an
// SPA) is still reflected when you land back on another — sessionStorage, not localStorage or a
// real API: resets per-tab, never touches anything real. "Reset demo data" clears it back to the
// original seed.json.
const SEED_STORAGE_KEY = "fbp-discovery-batch-mgmt-v7-seed";
async function loadSeed() {
  const saved = sessionStorage.getItem(SEED_STORAGE_KEY);
  if (saved) return JSON.parse(saved);
  const res = await fetch("../../seed-data/seed.json");
  const seed = await res.json();
  sessionStorage.setItem(SEED_STORAGE_KEY, JSON.stringify(seed));
  return seed;
}
function saveSeed(seed) {
  sessionStorage.setItem(SEED_STORAGE_KEY, JSON.stringify(seed));
}
function resetSeed() {
  sessionStorage.removeItem(SEED_STORAGE_KEY);
}

// ── icons (inline SVG, matches svgProps() in batchUi.tsx) ──
function svgOpen(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
}
function IconPackage(size = 20) {
  return `${svgOpen(size)}<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>`;
}
function IconPackageCheck(size = 20) {
  return `${svgOpen(size)}<path d="m16 16 2 2 4-4" /><path d="M21 12.5V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l1.5-.75" /><path d="M16.5 9.4 7.55 4.24" /><path d="M3.3 7 12 12l8.7-5" /><path d="M12 22V12" /></svg>`;
}
function IconClock(size = 20) {
  return `${svgOpen(size)}<circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>`;
}
function IconCalendar(size = 13) {
  return `${svgOpen(size)}<rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>`;
}
function IconSearch(size = 14) {
  return `${svgOpen(size)}<circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>`;
}
function IconClose(size = 14) {
  return `${svgOpen(size)}<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>`;
}
function IconPlus(size = 20) {
  return `${svgOpen(size)}<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>`;
}
// SSOT-2 addendum-0038/0040 — the mobile "Add to Inventory" sheet + OperatorPicker's own icons.
function IconChevronDown(size = 14) {
  return `${svgOpen(size)}<polyline points="6 9 12 15 18 9" /></svg>`;
}
function IconUser(size = 14) {
  return `${svgOpen(size)}<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>`;
}
function IconTruck(size = 18) {
  return `${svgOpen(size)}<path d="M10 17h4V5H2v12h3" /><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1" /><circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>`;
}

// ── formatters (byte-identical logic to batchUi.tsx) ──
function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}
function fmtDateNice(dateStr) {
  if (!dateStr) return "—";
  const iso = dateStr.includes("T") ? dateStr : dateStr + "T00:00:00";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTimeNice(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ", " + fmtTime(iso);
}
// elapsedStr(iso) — "2d 4h", "45m", "just now" — ported from screens/shared/data-layer.js
// (discovery-v3-batch-ui-brainstorm), for the workspace table's row-reason "since" phrasing.
function elapsedStr(iso) {
  if (!iso) return null;
  const ms = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}
// initials(name) — ported from screens/workspace/home.js, for the workspace table's operator avatar.
function initials(name) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "—";
}

// ── status/bucket logic (byte-identical branches to batchUi.tsx) ──
function statusBadgeClass(status) {
  if (!status) return "badge-unknown";
  return "badge-" + status.toLowerCase().replace(/\s+/g, "");
}
// Rejected now has its own bucket (not folded into Needs Attention) — a terminal dead-end, not
// something awaiting resolution the way an overdue or on-hold batch is (batchUi.tsx bucketOf).
function bucketOf(status, expectedFinishDate) {
  if (status === "In Progress") {
    if (expectedFinishDate && new Date(expectedFinishDate) < new Date()) return "attention";
    return "inprogress";
  }
  if (status === "Planned") return "waiting";
  if (status === "Completed" || status === "Closed") return "done";
  if (status === "Rejected") return "rejected";
  return "attention"; // On Hold, Unknown/missing
}
function attentionReason(status, expectedFinishDate) {
  if (status === "In Progress") {
    if (expectedFinishDate && new Date(expectedFinishDate) < new Date()) return "Overdue";
    return null;
  }
  if (["Planned", "Completed", "Closed", "On Hold", "Rejected"].includes(status)) return null;
  return "Unknown status";
}
function attentionReasonDetail(status, expectedFinishDate) {
  if (status === "In Progress") {
    if (expectedFinishDate && new Date(expectedFinishDate) < new Date()) {
      return `This batch is still In Progress but its expected finish date (${fmtDateNice(expectedFinishDate)}) has passed.`;
    }
    return null;
  }
  if (["Planned", "Completed", "Closed", "On Hold", "Rejected"].includes(status)) return null;
  return "This batch has a missing or unrecognized status — it needs data investigation (see the migration note if this is a legacy batch).";
}
// dueLabel() — the workspace table's colour-coded relative due-date text (batchUi.tsx).
function dueLabel(expectedFinishDate, now) {
  if (!expectedFinishDate) return { text: "No finish date set", cls: "" };
  const due = new Date(expectedFinishDate.includes("T") ? expectedFinishDate : expectedFinishDate + "T00:00:00");
  const todayKey = now.toISOString().slice(0, 10);
  const days = Math.round((due.getTime() - new Date(todayKey + "T00:00:00").getTime()) / 86400000);
  if (days < 0) return { text: `Due ${-days} day${-days === 1 ? "" : "s"} ago`, cls: "attn" };
  if (days === 0) return { text: "Due today", cls: "wait" };
  if (days === 1) return { text: "Due tomorrow", cls: "wait" };
  return { text: `Due in ${days} days`, cls: "" };
}
// rowIcon() — the workspace table row's severity icon (glyph + colour class) (batchUi.tsx).
function rowIcon(status, expectedFinishDate) {
  const reason = attentionReason(status, expectedFinishDate);
  if (reason === "Overdue") return { cls: "attn", glyph: "⚠" };
  if (status === "On Hold") return { cls: "wait", glyph: "⏸" };
  if (status === "Rejected") return { cls: "attn", glyph: "⛔" };
  return { cls: "", glyph: "📦" };
}
// batchSituation(b) — ported from screens/shared/data-layer.js (discovery-v3-batch-ui-brainstorm):
// the one-glance "what's going on and why" for the workspace table's row-reason line.
function batchSituation(b) {
  const overdue = attentionReasonDetail(b.statusLabel, b.expectedFinishDate);
  if (overdue) return { text: overdue, cls: "attn", icon: "⚠" };
  if (b.statusLabel === "On Hold") {
    const last = [...b.statusHistory].reverse().find((h) => h.toStatusLabel === "On Hold");
    const since = last ? elapsedStr(last.timestamp) : null;
    const reason = last && last.comment ? `"${last.comment}"` : "no reason recorded";
    return { text: `On hold — ${reason}${since ? ` · ${since} ago` : ""}`, cls: "attn", icon: "⏸" };
  }
  if (b.statusLabel === "Rejected") {
    const last = [...b.statusHistory].reverse().find((h) => h.toStatusLabel === "Rejected");
    const reason = last && last.comment ? `"${last.comment}"` : "no reason recorded";
    return { text: `Rejected — ${reason}`, cls: "attn", icon: "⛔" };
  }
  return null;
}

// ── tiny DOM helper ──
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

// ── ConfirmInline (SSOT-3 §1) — ported from components/ConfirmInline.tsx. Still used by
// create-batch.js's dirty-guard confirms. ──
function ConfirmInline({ prompt, detail, onYes, onNo, busy, yesAria, noAria }) {
  return el("span", { class: "confirm-inline" + (detail ? " has-detail" : "") },
    el("span", { class: "ci-copy" },
      el("span", { class: "muted small" }, prompt),
      detail ? el("span", { class: "muted small ci-detail" }, detail) : null),
    el("button", { class: "btn btn-sm btn-primary confirm-yes", onclick: onYes, disabled: busy || undefined, "aria-label": yesAria }, busy ? "…" : "✓"),
    el("button", { type: "button", class: "btn btn-sm confirm-no", onclick: onNo, disabled: busy || undefined, "aria-label": noAria }, "✗"));
}

// ── LoadingOverlay — ported from components/LoadingOverlay.tsx ──
function LoadingOverlay(label = "Loading…", page) {
  return el("div", { class: "fbp-loading-overlay" + (page ? " fbp-loading-overlay-page" : ""), role: "status", "aria-live": "polite" },
    el("span", { class: "fbp-loading-spinner", "aria-hidden": "true" }),
    el("span", { class: "muted small" }, label));
}

// ── KebabButton — shared dropdown-menu trigger, ported from BatchList.tsx's own component.
// Appended inside .fbp-root (not document.body): design-tokens.css scopes every --fb-* token to
// .fbp-root. ──
let openMenuFor = null;
function closeKebabMenu() {
  if (!openMenuFor) return;
  openMenuFor = null;
  document.querySelectorAll(".ws-kebab-menu").forEach((m) => m.remove());
  document.querySelectorAll('[aria-haspopup="menu"][aria-expanded="true"]').forEach((btn) => btn.setAttribute("aria-expanded", "false"));
  document.removeEventListener("mousedown", onOutsideMenuClick, true);
  document.removeEventListener("keydown", onMenuKeydown, true);
}
function onOutsideMenuClick(e) {
  if (!e.target.closest(".ws-kebab-menu") && !e.target.closest('[aria-haspopup="menu"]')) closeKebabMenu();
}
function onMenuKeydown(e) {
  if (e.key === "Escape") closeKebabMenu();
}
function KebabButton(rowKey, className, ariaLabel, actions) {
  return el("button", {
    type: "button", class: className, "aria-haspopup": "menu", "aria-expanded": "false", "aria-label": ariaLabel,
    onclick: (e) => { e.stopPropagation(); toggleKebabMenu(rowKey, ariaLabel, actions, e.currentTarget); },
  }, "⋮");
}
function toggleKebabMenu(rowKey, ariaLabel, actions, btn) {
  if (openMenuFor === rowKey) { closeKebabMenu(); return; }
  closeKebabMenu();
  openMenuFor = rowKey;
  btn.setAttribute("aria-expanded", "true");
  const menu = el("div", { class: "ws-kebab-menu", role: "menu", "aria-label": ariaLabel },
    ...actions.map((a) => el("button", {
      type: "button", role: "menuitem", class: "ws-kebab-menu-item" + (a.danger ? " danger" : ""),
      disabled: a.disabled || undefined,
      onclick: () => { closeKebabMenu(); a.onClick(); },
    }, a.label)));
  document.querySelector(".fbp-root").appendChild(menu);
  const r = btn.getBoundingClientRect();
  menu.style.top = r.bottom + 4 + window.scrollY + "px";
  menu.style.left = Math.max(8, r.right - menu.offsetWidth) + window.scrollX + "px";
  document.addEventListener("mousedown", onOutsideMenuClick, true);
  document.addEventListener("keydown", onMenuKeydown, true);
}

// ── OperatorPicker — ported from components/OperatorPicker.tsx: a search-and-select field over
// the real staff roster (MockApi.searchOperators), used by Create/Edit Batch, the status-update
// handover fields, and Inventory Sync's own operator field. `value` is `{id?, name, contact?}`;
// typing free text keeps `value.name` in sync but only a real picked result sets `value.id`
// (callers gate on `.id` being present to know a real operator was actually selected). ──
function OperatorPicker({ value, onChange, label, required, disabled, placeholder }) {
  let open = false;
  let results = [];
  let wrapEl, inputEl, popEl;

  async function runSearch(q) {
    results = await MockApi.searchOperators(q);
    renderPop();
  }
  function renderPop() {
    if (popEl) popEl.remove();
    if (!open) return;
    popEl = el("div", { class: "ta-pop" },
      ...results.map((o) => el("button", {
        type: "button", class: "opt",
        onmousedown: () => { onChange({ id: o.id, name: o.name, contact: o.contact }); open = false; inputEl.value = o.name; renderPop(); },
      }, el("span", {}, o.name), o.contact ? el("span", { class: "ds-label-note" }, o.contact) : null)));
    wrapEl.appendChild(popEl);
  }

  inputEl = el("input", {
    class: "input op-picker-input",
    placeholder: placeholder || "Search operators…",
    value: value.name || "",
    disabled: disabled || undefined,
    oninput: (e) => { onChange({ name: e.target.value }); runSearch(e.target.value); },
    onfocus: () => { open = true; runSearch(value.name || ""); },
    onblur: () => { setTimeout(() => { open = false; renderPop(); }, 120); },
  });
  wrapEl = el("div", { class: "ta-wrap op-picker-wrap" },
    el("span", { class: "op-picker-icon lead", html: IconUser() }),
    inputEl,
    el("span", { class: "op-picker-icon trail", html: IconChevronDown() }));

  return el("div", {},
    label ? el("label", { class: "label" }, label, required ? el("span", { class: "req" }, " *") : null) : null,
    wrapEl);
}

// ── InventorySyncDrawer — ported from BatchDetailDrawer.tsx's own exported component (SSOT-2
// addendum-0038). Real code imports this one component into BOTH BatchDetailDrawer's own Overview
// tab AND InventorySyncWorkspaceScreen — here it's a self-mounting factory (its own scrim/modal,
// its own local state/re-render loop) so both batch-detail.js and inventory-sync.js can call it
// identically: `InventorySyncDrawer({ batch, onClose, onSynced })`, returning `{ destroy() }`. ──
const INVENTORY_SYNC_ACTION_LABEL = { link: "linked to an inventory product", "create-product": "created a new inventory product", post: "posted to inventory", retry: "retried the inventory post" };
function inventorySyncLineName(batch, lineRef) {
  if (lineRef === "BULK") return "Bulk residual";
  const l = batch.packagingLines.find((p) => p.packagingConfigId === lineRef);
  return l ? l.name : lineRef;
}
function InventorySyncDrawer({ batch, onClose, onSynced }) {
  const sync = batch.inventorySync;
  if (!sync) return { destroy() {} };

  let busy = false, error = null;
  let operator = { name: "" };
  const rows = {};
  for (const l of sync.lines.filter((x) => x.status !== "synced")) {
    rows[l.lineRef] = {
      actualQty: String(l.expectedQty), manufacturingDate: new Date().toISOString().slice(0, 10), expiryDate: "",
      linkEditing: l.status === "failed" || (l.lineRef === "BULK" && !l.hostProductId),
      productQuery: "", productResults: [], productOpen: false, productSelected: null, productCreating: false,
      newProduct: { name: "", articleNo: "", unit: "Pc", price: "", tax: "" },
    };
  }

  function rowValid(l, row) {
    const qty = Number(row.actualQty);
    if (!(qty >= 0) || row.actualQty.trim() === "") return false;
    if (row.manufacturingDate === "" || row.expiryDate === "") return false;
    if (row.linkEditing) {
      if (row.productCreating) { if (row.newProduct.name.trim() === "" || row.newProduct.articleNo.trim() === "") return false; }
      else if (!row.productSelected) return false;
    }
    return true;
  }

  const scrim = el("div", { class: "ws-modal-scrim in", onclick: (e) => { if (e.target === scrim && !busy) close(); } });
  document.querySelector(".fbp-root").appendChild(scrim);

  function close() { scrim.remove(); onClose(); }

  function draw() {
    const editableLines = sync.lines.filter((l) => l.status !== "synced");
    const canSubmit = !busy && editableLines.length > 0 && !!operator.id && editableLines.every((l) => rowValid(l, rows[l.lineRef]));

    const trs = sync.lines.map((l) => {
      const pl = batch.packagingLines.find((p) => p.packagingConfigId === l.lineRef);
      const name = l.lineRef === "BULK" ? "Bulk residual" : (pl ? pl.name : l.lineRef);
      const unitSuffix = l.lineRef === "BULK" ? ` ${batch.batchUnit ?? "kg"}` : "";
      if (l.status === "synced") {
        return el("tr", {},
          el("td", { "data-label": "Product" }, el("div", { class: "inv-prod-row" }, el("span", { class: "inv-prod-icon", html: IconPackage(14) }), name)),
          el("td", { "data-label": "Linked Product" }, "✓ Linked"),
          el("td", { class: "num", "data-label": "Expected" }, `${l.expectedQty}${unitSuffix}`),
          el("td", { class: "num " + (l.actualQty !== undefined && l.actualQty !== l.expectedQty ? "outcome-mismatch" : "outcome-match"), "data-label": "Actual" }, `${l.actualQty ?? l.expectedQty}${unitSuffix}`),
          el("td", { "data-label": "Mfg Date" }, l.manufacturingDate ? fmtDateNice(l.manufacturingDate) : "—"),
          el("td", { "data-label": "Expiry Date" }, l.expiryDate ? fmtDateNice(l.expiryDate) : "—"));
      }
      const row = rows[l.lineRef];
      if (!row) return null;
      const autoLinkedName = l.lineRef !== "BULK" ? (pl ? (pl.name || pl.productRef) : undefined) : undefined;
      const unit = unitSuffix.trim();

      let linkedCell;
      if (!row.linkEditing) {
        linkedCell = el("div", {},
          el("div", { class: "ws-note ok" }, `✓ ${autoLinkedName ?? "Linked"}`),
          el("button", { type: "button", class: "btn btn-sm", style: "margin-top:4px", disabled: busy || undefined, onclick: () => { row.linkEditing = true; draw(); } }, "Change"));
      } else if (!row.productCreating) {
        linkedCell = el("div", {},
          el("div", { class: "inv-search-row" },
            el("div", { class: "ta-wrap inv-search-wrap" },
              el("span", { class: "inv-search-icon", html: IconSearch(13) }),
              el("input", {
                class: "input", placeholder: "Search products…", value: row.productQuery, disabled: busy || undefined,
                oninput: async (e) => { row.productQuery = e.target.value; row.productSelected = null; row.productResults = await MockApi.searchHostProducts(e.target.value); draw(); },
                onfocus: async () => { row.productOpen = true; row.productResults = await MockApi.searchHostProducts(row.productQuery); draw(); },
                onblur: () => { setTimeout(() => { row.productOpen = false; draw(); }, 150); },
              }),
              el("span", { class: "inv-search-chevron", html: IconChevronDown(13) }),
              row.productOpen
                ? el("div", { class: "ta-pop" },
                    ...row.productResults.map((p) => el("button", {
                      type: "button", class: "opt" + (row.productSelected && row.productSelected.id === p.id ? " added" : ""),
                      onmousedown: () => { row.productSelected = p; row.productQuery = p.name; row.productResults = []; row.productOpen = false; draw(); },
                    }, el("span", {}, p.name), el("span", { class: "ds-label-note" }, p.articleNo))),
                    el("button", { type: "button", class: "opt opt-add-new", onmousedown: () => { row.productCreating = true; row.productOpen = false; draw(); } }, "+ Add new product"))
                : null),
            el("button", { type: "button", class: "inv-quick-add", "aria-label": "Add new product", disabled: busy || undefined, onmousedown: () => { row.productCreating = true; row.productOpen = false; draw(); } }, el("span", { html: IconPlus(16) }))),
          row.productSelected ? el("div", { class: "ws-note ok", style: "margin-top:6px" }, `Will link to "${row.productSelected.name}".`) : null);
      } else {
        linkedCell = el("div", { class: "inv-sync-inline-form" },
          el("input", { class: "input", placeholder: "Name *", value: row.newProduct.name, disabled: busy || undefined, oninput: (e) => { row.newProduct.name = e.target.value; draw(); } }),
          el("input", { class: "input", placeholder: "Article No *", value: row.newProduct.articleNo, disabled: busy || undefined, oninput: (e) => { row.newProduct.articleNo = e.target.value; draw(); } }),
          el("input", { class: "input", placeholder: "Unit", value: row.newProduct.unit, disabled: busy || undefined, oninput: (e) => { row.newProduct.unit = e.target.value; draw(); } }),
          el("input", { class: "input", type: "number", placeholder: "Price", value: row.newProduct.price, disabled: busy || undefined, oninput: (e) => { row.newProduct.price = e.target.value; draw(); } }),
          el("input", { class: "input", type: "number", placeholder: "Tax %", value: row.newProduct.tax, disabled: busy || undefined, oninput: (e) => { row.newProduct.tax = e.target.value; draw(); } }),
          el("button", { type: "button", class: "btn btn-sm", disabled: busy || undefined, onclick: () => { row.productCreating = false; draw(); } }, "← Search instead"));
      }

      return el("tr", {},
        el("td", { "data-label": "Product" },
          el("div", { class: "inv-prod-row" }, el("span", { class: "inv-prod-icon", html: IconPackage(14) }), name),
          l.status === "failed" ? el("div", { class: "outcome-mismatch", style: "font-size:11px;margin-top:2px" }, `✗ ${l.error ?? "Failed"}`) : null),
        el("td", { "data-label": "Linked Product" }, linkedCell),
        el("td", { class: "num", "data-label": "Expected" }, el("div", { class: "inv-qty-box readonly" }, el("span", {}, String(l.expectedQty)), unit ? el("span", { class: "unit-chip" }, unit) : null), el("div", { class: "inv-field-hint" }, "From outcome verification")),
        el("td", { "data-label": "Actual" },
          el("div", { class: "inv-qty-box" },
            el("input", { class: "input", type: "number", value: row.actualQty, disabled: busy || undefined, oninput: (e) => { row.actualQty = e.target.value; draw(); } }),
            unit ? el("span", { class: "unit-chip" }, unit) : null),
          el("div", { class: "inv-field-hint" }, "Enter actual quantity")),
        el("td", { "data-label": "Mfg Date" }, el("input", { class: "input", style: "min-width:130px", type: "date", value: row.manufacturingDate, disabled: busy || undefined, oninput: (e) => { row.manufacturingDate = e.target.value; draw(); } })),
        el("td", { "data-label": "Expiry Date" }, el("input", { class: "input", style: "min-width:130px", type: "date", min: row.manufacturingDate || undefined, value: row.expiryDate, disabled: busy || undefined, oninput: (e) => { row.expiryDate = e.target.value; draw(); } })));
    });

    const modal = el("div", { class: "ws-modal ws-modal-wide ws-modal-inv-sync", role: "dialog", "aria-modal": "true", "aria-label": "Add to inventory" },
      el("div", { class: "ws-sheet-handle", "aria-hidden": "true" }),
      el("div", { class: "ws-modal-head" },
        el("div", {}, el("div", { class: "ws-modal-title" }, "Add to Inventory"), el("div", { class: "ws-modal-sub" }, `Push ${batch.batchNumber}'s actual output into inventory. Expected is what Outcome Verification recorded; a different actual raises a settlement item.`)),
        el("button", { type: "button", class: "ws-modal-close", "aria-label": "Close", disabled: busy || undefined, onclick: close }, "✕")),
      el("div", { class: "ws-modal-inv-body" },
        el("div", { class: "line-card", style: "margin-bottom:14px" }, OperatorPicker({ value: operator, disabled: busy, required: true, label: "Operator — brought this batch to inventory", onChange: (v) => { operator = v; draw(); } })),
        el("table", { class: "bm-table inv-sync-table" },
          el("thead", {}, el("tr", {}, el("th", {}, "Product"), el("th", {}, "Linked Product"), el("th", { class: "num" }, "Expected"), el("th", { class: "num" }, "Actual"), el("th", {}, "Mfg Date"), el("th", {}, "Expiry Date"))),
          el("tbody", {}, ...trs)),
        error ? el("div", { class: "nb nb-bad", style: "margin-top:14px" }, `⚠ ${error}`) : null),
      el("div", { class: "ws-modal-footer", style: "margin-top:16px" },
        el("button", { type: "button", class: "btn", disabled: busy || undefined, onclick: close }, "Cancel"),
        el("button", { type: "button", class: "btn btn-teal", disabled: !canSubmit, onclick: submit }, el("span", { class: "inv-btn-icon", html: IconTruck() }), busy ? "Pushing…" : sync.status === "failed" ? "Retry" : "Push to Inventory")));

    scrim.innerHTML = "";
    scrim.appendChild(modal);
  }

  async function submit() {
    busy = true; error = null; draw();
    try {
      const editableLines = sync.lines.filter((l) => l.status !== "synced");
      const lines = editableLines.map((l) => {
        const row = rows[l.lineRef];
        const resolution = row.linkEditing
          ? (row.productCreating ? { kind: "create", input: { name: row.newProduct.name, articleNo: row.newProduct.articleNo, unit: row.newProduct.unit, price: Number(row.newProduct.price) || 0, tax: Number(row.newProduct.tax) || 0 } }
                                  : (row.productSelected ? { kind: "link", hostProductId: row.productSelected.id } : undefined))
          : undefined;
        return { lineRef: l.lineRef, actualQty: Number(row.actualQty), manufacturingDate: row.manufacturingDate, expiryDate: row.expiryDate, resolution };
      });
      await MockApi.runInventorySync(batch.id, { operator: { id: operator.id, name: operator.name }, lines });
      scrim.remove();
      onSynced();
    } catch (e) {
      error = e.message; busy = false; draw();
    }
  }

  draw();
  return { destroy() { scrim.remove(); } };
}

// ── quality band + effective base size — ported from SSOT-2 addendum-0031 + addendum-0017 ──
const BATCH_SIZE_QUALITY_BAND_PCT = 0.1;
function round2(n) { return Math.round(n * 100) / 100; }
function batchSizeQualityBand(nominal) {
  return { lo: round2(nominal * (1 - BATCH_SIZE_QUALITY_BAND_PCT)), hi: round2(nominal * (1 + BATCH_SIZE_QUALITY_BAND_PCT)) };
}
function inBatchSizeQualityBand(size, nominal) {
  const { lo, hi } = batchSizeQualityBand(nominal);
  const EPS = 1e-9;
  return size >= lo - EPS && size <= hi + EPS;
}
function toBatchSizeBandVM(nominal, batchUnit = "kg") {
  const { lo, hi } = batchSizeQualityBand(nominal);
  return { lo, hi, label: `${lo}–${hi} ${batchUnit}` };
}
function effectiveBatchBaseSize(v) {
  const size = v.batchBaseSize ?? (v.allowedBatchSizes && v.allowedBatchSizes[0]) ?? 1;
  return size > 0 ? size : 1;
}
// packagingVariantMass — mass-denominated packs only (g/kg); count/bulk packs return undefined.
function packagingVariantMass(pack, batchUnit) {
  if (!pack.packSize || !pack.packUnit) return undefined;
  const grams = pack.packUnit === "g" ? pack.packSize : pack.packUnit === "kg" ? pack.packSize * 1000 : undefined;
  if (grams === undefined) return undefined;
  const batchGrams = batchUnit === "kg" ? 1000 : 1;
  return round2(grams / batchGrams * 1000) / 1000;
}

// ── mixEngine — ported verbatim from components/batch/mixEngine.ts ──
const MIX_EPS = 1e-9;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function rowWeight(row, batchSize) { return (batchSize * row.ratio) / 100; }
function rowQty(row, batchSize) { return Math.floor((rowWeight(row, batchSize) + MIX_EPS) / row.net); }
function allocated(rows, batchSize) { return rows.reduce((s, r) => s + rowQty(r, batchSize) * r.net, 0); }
function rebalance(rows, idx, wanted) {
  const next = rows.map((r) => ({ ...r }));
  const lockedSum = next.reduce((s, r, i) => (i !== idx && r.locked ? s + r.ratio : s), 0);
  const room = 100 - lockedSum;
  const rr = clamp(wanted, 0, room);
  next[idx].ratio = rr;

  const otherIdx = next.map((_, i) => i).filter((i) => i !== idx && !next[i].locked);
  if (!otherIdx.length) return next;

  const pool = otherIdx.reduce((s, i) => s + next[i].ratio, 0);
  let diff = room - rr - pool;

  if (pool <= MIX_EPS && diff > 0) {
    const share = diff / otherIdx.length;
    otherIdx.forEach((i) => { next[i].ratio = share; });
    return next;
  }

  otherIdx
    .slice()
    .sort((a, b) => next[b].ratio - next[a].ratio)
    .forEach((i) => {
      if (Math.abs(diff) < MIX_EPS) return;
      const nextRatio = next[i].ratio + diff;
      if (nextRatio >= -MIX_EPS) {
        next[i].ratio = Math.max(0, nextRatio);
        diff = 0;
      } else {
        diff = nextRatio;
        next[i].ratio = 0;
      }
    });
  if (Math.abs(diff) > MIX_EPS) next[idx].ratio = clamp(rr + diff, 0, room);

  return next;
}
function equalSplit(rows) {
  const share = rows.length ? round2(100 / rows.length) : 0;
  return rows.map((r, i) => ({ ...r, ratio: i === rows.length - 1 ? round2(100 - share * (rows.length - 1)) : share, locked: false }));
}

// ── Activity tab per-trigger metadata + mismatch narration — ported verbatim from batchUi.tsx ──
const TRIGGER_META = {
  start: { icon: "▶", cls: "start", desc: "Begin production on this batch." },
  hold: { icon: "⏸", cls: "hold", desc: "Temporarily pause batch activities." },
  resume: { icon: "▶", cls: "resume", desc: "Continue working on the batch." },
  complete: { icon: "✓", cls: "complete", desc: "Mark production as finished." },
  reject: { icon: "⛔", cls: "reject", desc: "Stop this batch permanently." },
  close: { icon: "🔒", cls: "close", desc: "Sign off — fully packed and accounted for." },
};
const TRIGGER_RESULT_LABEL = { start: "In Progress", hold: "On Hold", resume: "In Progress", complete: "Completed", reject: "Rejected", close: "Closed" };
const STATUS_ICON = { Planned: "○", "In Progress": "▶", "On Hold": "⏸", Completed: "✓", Closed: "🔒", Rejected: "⛔" };
const ACTIVITY_META = {
  Create: { icon: "✎", cls: "create", phrase: "Batch created" },
  Start: { icon: "▶", cls: "start", phrase: "Production started" },
  Hold: { icon: "⏸", cls: "hold", phrase: "Put on hold" },
  Resume: { icon: "▶", cls: "resume", phrase: "Production resumed" },
  Complete: { icon: "✓", cls: "complete", phrase: "Marked as complete" },
  Reject: { icon: "⛔", cls: "reject", phrase: "Batch rejected" },
  Close: { icon: "🔒", cls: "close", phrase: "Batch closed" },
};
// describeOutcomeMismatch — one phrase per mismatched packaging line + the bulk pair.
function describeOutcomeMismatch(outcome, batchUnit) {
  const parts = [];
  for (const l of outcome.lines) {
    if (l.actualUnits !== l.plannedUnits) {
      const diff = l.actualUnits - l.plannedUnits;
      parts.push(`${l.name} ${l.plannedUnits}→${l.actualUnits} (${diff > 0 ? "+" : ""}${diff})`);
    }
  }
  if (outcome.plannedSemiFinishedKg != null && outcome.actualSemiFinishedKg !== outcome.plannedSemiFinishedKg) {
    const diff = (outcome.actualSemiFinishedKg ?? 0) - outcome.plannedSemiFinishedKg;
    parts.push(`Bulk residual ${outcome.plannedSemiFinishedKg}${batchUnit}→${outcome.actualSemiFinishedKg}${batchUnit} (${diff > 0 ? "+" : ""}${diff}${batchUnit})`);
  }
  return parts;
}
// describeInventorySyncVariance — the Inventory Sync analogue of describeOutcomeMismatch.
function describeInventorySyncVariance(lineName, expectedQty, actualQty) {
  const diff = actualQty - expectedQty;
  return `${lineName} ${expectedQty}→${actualQty} (${diff > 0 ? "+" : ""}${diff})`;
}

// ── a tiny mock "API" — mutates a copy of the loaded seed, matching the real API's
// shapes/behaviour (transition validation, status-history append, ingredient ledger, inventory
// sync) without calling anything real. Session-persisted (see loadSeed/saveSeed above). ──
const MockApi = (function () {
  let seed = null;
  async function ensure() { if (!seed) seed = await loadSeed(); return seed; }

  const TRANSITIONS = {
    planned: { start: "in-progress" },
    "in-progress": { hold: "on-hold", complete: "completed" },
    "on-hold": { resume: "in-progress", reject: "rejected" },
    completed: { close: "closed" },
  };
  const STATE_LABEL = { planned: "Planned", "in-progress": "In Progress", "on-hold": "On Hold", completed: "Completed", closed: "Closed", rejected: "Rejected" };
  const TRIGGER_LABEL = { start: "Start", hold: "Hold", resume: "Resume", complete: "Complete", close: "Close", reject: "Reject" };

  function availableTransitionsFor(stateId) {
    const edges = TRANSITIONS[stateId] || {};
    return Object.keys(edges).map((trigger) => ({ trigger, label: TRIGGER_LABEL[trigger] }));
  }
  function withDerived(b) {
    return {
      ...b,
      availableTransitions: availableTransitionsFor(b.stateId),
      statusHistory: b.statusHistory || [],
      dateEditHistory: b.dateEditHistory || [],
      operatorHandoverHistory: b.operatorHandoverHistory || [],
      ingredientTransactions: b.ingredientTransactions || [],
      ingredientSummary: b.ingredientSummary || [],
    };
  }
  function nowIso() { return new Date().toISOString(); }

  return {
    async listBatches() {
      await ensure();
      return seed.batches.map((b) => withDerived(b));
    },
    async getBatch(id) {
      await ensure();
      const b = seed.batches.find((x) => x.id === id);
      if (!b) throw new Error("Batch not found: " + id);
      return withDerived(b);
    },
    async transitionBatch(id, { trigger, comment, actualOutcome, newOperator }) {
      await ensure();
      const b = seed.batches.find((x) => x.id === id);
      if (!b) throw new Error("Batch not found: " + id);
      const toState = (TRANSITIONS[b.stateId] || {})[trigger];
      if (!toState) throw new Error(`Illegal transition "${trigger}" from "${b.stateId}"`);
      b.statusHistory = b.statusHistory || [];
      b.statusHistory.push({
        fromStatusLabel: STATE_LABEL[b.stateId],
        toStatusLabel: STATE_LABEL[toState],
        triggerLabel: TRIGGER_LABEL[trigger],
        timestamp: nowIso(),
        actor: "admin",
        comment: comment || undefined,
      });
      b.stateId = toState;
      b.statusLabel = STATE_LABEL[toState];
      if (actualOutcome) {
        const lineMismatch = actualOutcome.lines.some((l) => {
          const plan = (b.packagingLines || []).find((p) => p.packagingConfigId === l.packagingConfigId);
          return plan && l.actualUnits !== plan.plannedUnits;
        });
        const bulkMismatch = b.semiFinishedKg && actualOutcome.actualSemiFinishedKg !== b.semiFinishedKg;
        b.actualOutcome = {
          lines: actualOutcome.lines.map((l) => {
            const plan = (b.packagingLines || []).find((p) => p.packagingConfigId === l.packagingConfigId) || {};
            return { packagingConfigId: l.packagingConfigId, name: plan.name, plannedUnits: plan.plannedUnits, actualUnits: l.actualUnits };
          }),
          plannedSemiFinishedKg: b.semiFinishedKg || undefined,
          actualSemiFinishedKg: actualOutcome.actualSemiFinishedKg ?? null,
          settlementRequired: !!(lineMismatch || bulkMismatch),
        };
      }
      if (newOperator && newOperator.id) {
        b.operatorHandoverHistory = b.operatorHandoverHistory || [];
        b.operatorHandoverHistory.push({ fromOperator: b.operator || null, toOperator: newOperator.name, timestamp: nowIso(), actor: "admin", comment: comment || undefined });
        b.operator = newOperator.name;
      }
      saveSeed(seed);
      return withDerived(b);
    },
    async editBatchDates(id, { plannedDate, expectedFinishDate, note }) {
      await ensure();
      const b = seed.batches.find((x) => x.id === id);
      if (!b) throw new Error("Batch not found: " + id);
      const entry = { timestamp: nowIso(), actor: "admin", note: note || undefined };
      if (plannedDate !== b.plannedDate) entry.plannedDate = { from: b.plannedDate, to: plannedDate };
      if (expectedFinishDate !== b.expectedFinishDate) entry.expectedFinishDate = { from: b.expectedFinishDate || null, to: expectedFinishDate || null };
      b.dateEditHistory = b.dateEditHistory || [];
      b.dateEditHistory.push(entry);
      b.plannedDate = plannedDate;
      b.expectedFinishDate = expectedFinishDate || undefined;
      saveSeed(seed);
      return withDerived(b);
    },
    // Snapshots each planned line's name/weight/ratio from the version's packaging catalogue at
    // create/edit time — mirrors the real backend's packagingLines snapshot (SSOT-2 addendum-0031).
    resolvePackagingLines(recipeVersionId, batchSize, rawLines) {
      const options = seed.packagingLines[recipeVersionId] || [];
      return (rawLines || []).map((l) => {
        const opt = options.find((o) => o.id === l.packagingConfigId) || {};
        const net = packagingVariantMass({ packSize: opt.packSize, packUnit: opt.packUnit }, "kg") || 0;
        const weightKg = round2(net * l.plannedUnits);
        return {
          packagingConfigId: l.packagingConfigId,
          productRef: opt.productRef,
          name: opt.name || opt.packTitle || l.packagingConfigId,
          plannedUnits: l.plannedUnits,
          weightKg,
          ratioPct: batchSize ? round2((weightKg / batchSize) * 100) : 0,
        };
      });
    },
    async createBatch(input) {
      await ensure();
      const seq = seed.batches.length + 200;
      const recipeId = Object.keys(seed.recipeHeaders).find((rid) => seed.recipeHeaders[rid].versions.some((v) => v.id === input.recipeVersionId));
      const packagingLines = this.resolvePackagingLines(input.recipeVersionId, input.batchSize, input.packagingLines);
      const b = {
        id: "batch-new-" + seq,
        batchNumber: `PB-2026-${String(seq).padStart(5, "0")}`,
        recipeVersionId: input.recipeVersionId,
        displayName: (seed.recipeHeaders[recipeId] || {}).name || "New Recipe",
        stateId: "planned",
        statusLabel: "Planned",
        batchSize: input.batchSize,
        batchUnit: "kg",
        plannedDate: input.plannedDate,
        expectedFinishDate: input.expectedFinishDate,
        operator: input.operator,
        packagingLines,
        semiFinishedKg: round2(Math.max(0, input.batchSize - packagingLines.reduce((s, l) => s + l.weightKg, 0))),
        statusHistory: [{ toStatusLabel: "Planned", triggerLabel: "Create", timestamp: nowIso(), actor: "admin" }],
        dateEditHistory: [], operatorHandoverHistory: [], ingredientTransactions: [], ingredientSummary: [],
        inventorySync: null,
      };
      seed.batches.push(b);
      saveSeed(seed);
      return withDerived(b);
    },
    async editBatch(id, input) {
      await ensure();
      const b = seed.batches.find((x) => x.id === id);
      if (!b) throw new Error("Batch not found: " + id);
      const packagingLines = input.packagingLines ? this.resolvePackagingLines(b.recipeVersionId, input.batchSize ?? b.batchSize, input.packagingLines) : b.packagingLines;
      Object.assign(b, { ...input, packagingLines });
      b.semiFinishedKg = round2(Math.max(0, (input.batchSize ?? b.batchSize) - packagingLines.reduce((s, l) => s + l.weightKg, 0)));
      saveSeed(seed);
      return withDerived(b);
    },
    async listRecipes() {
      await ensure();
      // SSOT-2 addendum-004 / real CreateBatchDrawer.tsx: recipe search filters to published-only —
      // a draft recipe isn't shown at all (not shown-disabled, as the v6 baseline used to do).
      return seed.recipes.filter((r) => r.hasPublishedVersion);
    },
    async getRecipeHeader(recipeId, versionId) {
      await ensure();
      const h = seed.recipeHeaders[recipeId];
      if (!h) throw new Error("Recipe not found: " + recipeId);
      return h;
    },
    async getPackagingLines(versionId) {
      await ensure();
      return seed.packagingLines[versionId] || [];
    },

    // ── Ingredients (SSOT-2 addendum-0041 — frontend addendum-004) ──
    async issueIngredient(batchId, input) {
      await ensure();
      const b = seed.batches.find((x) => x.id === batchId);
      if (!b) throw new Error("Batch not found: " + batchId);
      b.ingredientTransactions = b.ingredientTransactions || [];
      b.ingredientSummary = b.ingredientSummary || [];
      const row = b.ingredientSummary.find((r) => r.ingredientId === input.ingredientId);
      if (row) { row.issuedQty = round2(row.issuedQty + input.quantity); recomputeIngredientRow(row); }
      b.ingredientTransactions.push({ ingredientId: input.ingredientId, ingredientName: row ? row.ingredientName : input.ingredientId, transactionType: "issue", quantity: input.quantity, uom: input.uom, warehouseId: input.warehouseId, remarks: input.remarks, timestamp: nowIso(), actor: "admin" });
      saveSeed(seed);
      return withDerived(b);
    },
    async bulkIssueIngredient(batchId, { items }) {
      await ensure();
      const b = seed.batches.find((x) => x.id === batchId);
      if (!b) throw new Error("Batch not found: " + batchId);
      b.ingredientTransactions = b.ingredientTransactions || [];
      b.ingredientSummary = b.ingredientSummary || [];
      const results = items.map((input) => {
        const row = b.ingredientSummary.find((r) => r.ingredientId === input.ingredientId);
        if (row) { row.issuedQty = round2(row.issuedQty + input.quantity); recomputeIngredientRow(row); }
        b.ingredientTransactions.push({ ingredientId: input.ingredientId, ingredientName: row ? row.ingredientName : input.ingredientId, transactionType: "issue", quantity: input.quantity, uom: input.uom, warehouseId: input.warehouseId, remarks: input.remarks, timestamp: nowIso(), actor: "admin" });
        return { ingredientId: input.ingredientId, ok: true };
      });
      saveSeed(seed);
      return { results };
    },
    async returnIngredient(batchId, input) {
      await ensure();
      const b = seed.batches.find((x) => x.id === batchId);
      if (!b) throw new Error("Batch not found: " + batchId);
      b.ingredientTransactions = b.ingredientTransactions || [];
      b.ingredientSummary = b.ingredientSummary || [];
      const row = b.ingredientSummary.find((r) => r.ingredientId === input.ingredientId);
      if (row) { row.returnedQty = round2(row.returnedQty + input.quantity); recomputeIngredientRow(row); }
      b.ingredientTransactions.push({ ingredientId: input.ingredientId, ingredientName: row ? row.ingredientName : input.ingredientId, transactionType: "return", quantity: input.quantity, uom: input.uom, warehouseId: input.warehouseId, remarks: input.remarks, timestamp: nowIso(), actor: "admin" });
      saveSeed(seed);
      return withDerived(b);
    },
    async listIngredients(batchId, ingredientId) {
      await ensure();
      const b = seed.batches.find((x) => x.id === batchId);
      if (!b) throw new Error("Batch not found: " + batchId);
      return { transactions: (b.ingredientTransactions || []).filter((t) => t.ingredientId === ingredientId) };
    },

    // ── Inventory Sync (SSOT-2 addendum-0038) ──
    async runInventorySync(batchId, { operator, lines }) {
      await ensure();
      const b = seed.batches.find((x) => x.id === batchId);
      if (!b) throw new Error("Batch not found: " + batchId);
      const sync = b.inventorySync || { status: "pending", lines: [], events: [] };
      for (const l of lines) {
        const line = sync.lines.find((x) => x.lineRef === l.lineRef) || { lineRef: l.lineRef, status: "pending", expectedQty: l.actualQty };
        line.status = "synced";
        line.actualQty = l.actualQty;
        line.manufacturingDate = l.manufacturingDate;
        line.expiryDate = l.expiryDate;
        if (!sync.lines.includes(line)) sync.lines.push(line);
        sync.events.push({ lineRef: l.lineRef, action: l.resolution && l.resolution.kind === "create" ? "create-product" : "post", status: "ok", timestamp: nowIso(), actor: operator.name });
      }
      sync.status = sync.lines.every((l) => l.status === "synced") ? "synced" : "pending";
      if (sync.status === "synced") sync.syncedAt = nowIso();
      b.inventorySync = sync;
      saveSeed(seed);
      return withDerived(b);
    },
    async searchHostProducts(q) {
      await ensure();
      const query = (q || "").trim().toLowerCase();
      return (seed.hostProducts || []).filter((p) => !query || p.name.toLowerCase().includes(query));
    },
    async listInventorySyncQueueBatches(search) {
      await ensure();
      const q = (search || "").trim().toLowerCase();
      return seed.batches
        .filter((b) => b.inventorySync && b.inventorySync.status !== "synced")
        .filter((b) => !q || b.batchNumber.toLowerCase().includes(q) || (b.operator || "").toLowerCase().includes(q))
        .map((b) => ({
          batchId: b.id,
          displayName: b.displayName,
          batchNumber: b.batchNumber,
          operator: b.operator,
          failedLineCount: b.inventorySync.lines.filter((l) => l.status === "failed").length,
          pendingLineCount: b.inventorySync.lines.filter((l) => l.status === "pending").length,
          updatedAt: b.inventorySync.events.length ? b.inventorySync.events[b.inventorySync.events.length - 1].timestamp : null,
        }));
    },

    // ── Semi-Finished Products (SSOT-2 addendum-0043) ──
    async listSemiFinishedProducts(search) {
      await ensure();
      const q = (search || "").trim().toLowerCase();
      return (seed.semiFinishedProducts || []).filter((p) => !q || p.name.toLowerCase().includes(q) || p.batchNumber.toLowerCase().includes(q));
    },

    async searchOperators(q) {
      await ensure();
      const query = (q || "").trim().toLowerCase();
      return (seed.operators || []).filter((o) => !query || o.name.toLowerCase().includes(query));
    },
  };

  function recomputeIngredientRow(row) {
    row.netConsumed = round2(row.issuedQty - row.returnedQty);
    row.remainingRecommended = round2(Math.max(0, row.recommendedQty - row.netConsumed));
    row.variance = round2(row.netConsumed - row.recommendedQty);
  }
})();

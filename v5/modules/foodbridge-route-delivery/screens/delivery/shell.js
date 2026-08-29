/* ==========================================================================
   DELIVERY MANAGEMENT — app shell + shared UI primitives

   Everything that is not screen-specific: the design tokens, the chrome
   (sync bar, headers, tab bar, action bar), the shared controls, and the
   small helpers every screen uses. Provenance:

     region          app source
     --------------  ------------------------------------------------------
     tokens          route-delivery-app/components/ui.jsx   BRAND/GREEN/…
     SyncBar         route-delivery-app/pages/HomeDashboard.jsx  SyncBar
     DriverHeader    route-delivery-app/pages/HomeDashboard.jsx  DriverHeader
     MobileHeader    route-delivery-app/components/ui.jsx   MobileHeader
     ProgressBar     route-delivery-app/components/ui.jsx   ProgressBar
     ActionBar       route-delivery-app/components/ui.jsx   ActionBar
     BtnXL / BtnSm   route-delivery-app/components/ui.jsx   BtnXL / BtnSm
     Banner          route-delivery-app/components/ui.jsx   Banner
     Card/CardTitle  route-delivery-app/components/ui.jsx   Card / CardTitle
     StatGrid/Tile   route-delivery-app/components/ui.jsx   StatGrid/StatTile
     SectionHeader   route-delivery-app/components/ui.jsx   SectionHeader
     TabBar          route-delivery-app/components/ui.jsx   TabBar
     StatusChip      route-delivery-app/pages/HomeDashboard.jsx  StatusChip
     currency        route-delivery-app/utils/currencyDisplay.js

   WHY THE STYLES ARE OBJECTS
   The real app styles almost everything with inline `style={{…}}` objects —
   1,314 of them — rather than CSS classes. Keeping them as objects here and
   rendering them through sty() means each screen is close to a transliteration
   of its JSX, so the two can be compared line by line and stay in step. Only
   the interaction states (hover/active/focus) live in CSS, exactly as they do
   upstream in ui.css.
   ========================================================================== */

(function () {
  "use strict";

  /* ── Tokens (ui.jsx) ───────────────────────────────────────────────────── */
  const BRAND  = "#1B6272";
  const GREEN  = "#43A047";
  const ORANGE = "#f97316";
  const RED    = "#ef4444";
  const BG     = "#f0f2f5";

  /* ── Render helpers ────────────────────────────────────────────────────── */

  // Text going into HTML is escaped by default: customer names and shop names
  // are seed data today, but the New Customer screen lets a user type one, and
  // a prototype that mangles an apostrophe in "Ram's Store" looks broken.
  function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // Style object → inline style attribute. camelCase keys become kebab-case,
  // and bare numbers get "px" the way React does, so a style object copied
  // across from the JSX needs no rewriting.
  const UNITLESS = { flex: 1, flexGrow: 1, flexShrink: 1, fontWeight: 1, lineHeight: 1, opacity: 1, zIndex: 1, order: 1 };
  function sty(obj) {
    if (!obj) return "";
    const out = [];
    for (const k in obj) {
      let v = obj[k];
      if (v === null || v === undefined || v === false) continue;
      if (typeof v === "number" && !UNITLESS[k]) v = v + "px";
      out.push(k.replace(/[A-Z]/g, m => "-" + m.toLowerCase()) + ":" + v);
    }
    return out.join(";");
  }

  // Merge style objects left-to-right, mirroring JSX's `{...base, ...override}`.
  function mix() {
    return Object.assign.apply(null, [{}].concat([].slice.call(arguments)));
  }

  // data-act is how every control reports itself; delivery-core delegates one
  // listener on the root instead of binding per element, so re-rendering a
  // screen never leaks handlers.
  function act(name, payload) {
    let a = ' data-act="' + esc(name) + '"';
    if (payload !== undefined && payload !== null) a += ' data-arg="' + esc(typeof payload === "object" ? JSON.stringify(payload) : payload) + '"';
    return a;
  }

  /* ── Currency (utils/currencyDisplay.js) ───────────────────────────────── */
  // en-IN grouping, so 103800 reads ₹1,03,800 rather than ₹103,800.
  function formatAmountValue(n) {
    const value = Number(n) || 0;
    return value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function inr(n) { return "₹" + formatAmountValue(n); }

  /* ── Dates ─────────────────────────────────────────────────────────────── */
  function toLocalDateStr(d) {
    const dt = d instanceof Date ? d : new Date(d);
    return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
  }
  function timeAgoLabel(iso) {
    if (!iso) return "";
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60) return "just now";
    if (secs < 3600) return Math.floor(secs / 60) + "m ago";
    return Math.floor(secs / 3600) + "h ago";
  }
  function fmtDateLabel(dateStr) {
    if (!dateStr) return "";
    const p = dateStr.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return p[2] + " " + months[Number(p[1]) - 1];
  }
  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning 👋";
    if (h < 17) return "Good afternoon 👋";
    return "Good evening 👋";
  }

  /* ── Chrome ────────────────────────────────────────────────────────────── */

  function SyncBar(syncedAt, loading) {
    const ago = timeAgoLabel(syncedAt);
    const bar = { background: "#111", padding: "4px 16px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, flexShrink: 0 };
    if (loading) {
      return '<div style="' + sty(bar) + '">' +
        '<div style="' + sty({ width: 7, height: 7, borderRadius: "50%", background: "#888", animation: "pulse 1s infinite" }) + '"></div>' +
        '<span style="' + sty({ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 600 }) + '">Syncing…</span></div>';
    }
    // QA renders "Synced" with no relative time, so this does too. The
    // component still accepts syncedAt; it just is not surfaced, matching QA.
    return '<div style="' + sty(bar) + '">' +
      '<div style="' + sty({ width: 7, height: 7, borderRadius: "50%", background: GREEN }) + '"></div>' +
      '<span style="' + sty({ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 600 }) + '">Synced</span></div>';
  }

  function DriverHeader(name, onNewLabel) {
    return '<div style="' + sty({ background: BRAND, padding: "10px 16px 16px", flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }) + '">' +
      "<div>" +
        '<div style="' + sty({ fontSize: 14, color: "rgba(255,255,255,0.75)", marginBottom: 2 }) + '">' + greeting() + "</div>" +
        '<div style="' + sty({ fontSize: 20, fontWeight: 700, color: "white" }) + '">' + esc(name || "Driver") + "</div>" +
      "</div>" +
      (onNewLabel
        ? '<button type="button"' + act("new-route") + ' style="' + sty({
            display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 20,
            background: "rgba(255,255,255,0.18)", border: "1.5px solid rgba(255,255,255,0.35)",
            color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", marginTop: 2,
          }) + '">+ ' + esc(onNewLabel) + "</button>"
        : "") +
      "</div>";
  }

  // WhatsApp-style left-aligned header: back arrow, then title, no centring.
  function MobileHeader(o) {
    o = o || {};
    return '<div style="' + sty({ background: BRAND, padding: "10px 16px 12px", flexShrink: 0, position: "relative" }) + '">' +
      '<div style="' + sty({ display: "flex", alignItems: "center", gap: 10 }) + '">' +
        (o.onBack !== false
          ? '<button type="button" class="rd-back"' + act(o.backAct || "back") + ' style="' + sty({ background: "transparent", border: "none", color: "white", padding: "4px 6px", cursor: "pointer", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }) + '">← ' + esc(o.backLabel || "") + "</button>"
          : "") +
      "</div>" +
      '<div style="' + sty({ fontSize: 20, fontWeight: 700, color: "white", marginTop: 6 }) + '">' + esc(o.title || "") + "</div>" +
      (o.subtitle ? '<div style="' + sty({ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 }) + '">' + esc(o.subtitle) + "</div>" : "") +
      "</div>";
  }

  // The in-route header: back arrow plus the running collected total.
  function ProgressBar(o) {
    o = o || {};
    return '<div style="' + sty({ background: BRAND, padding: "10px 16px 8px", flexShrink: 0 }) + '">' +
      '<div style="' + sty({ display: "flex", alignItems: "center", justifyContent: "space-between" }) + '">' +
        '<button type="button" class="rd-back"' + act(o.backAct || "back") + ' style="' + sty({ background: "transparent", border: "none", color: "white", padding: "4px 6px", cursor: "pointer", fontSize: 15, fontWeight: 600 }) + '">← ' + esc(o.backLabel || "") + "</button>" +
        '<div style="' + sty({ color: "white", fontSize: 13, fontWeight: 700 }) + '">' + inr(o.collected || 0) +
          '<span style="' + sty({ fontSize: 11, fontWeight: 500, opacity: 0.75, marginLeft: 4 }) + '">' + esc(o.collectedLabel || "collected this route") + "</span></div>" +
      "</div>" +
      (o.total
        ? '<div style="' + sty({ height: 4, background: "rgba(255,255,255,0.25)", borderRadius: 2, marginTop: 8, overflow: "hidden" }) + '">' +
            '<div style="' + sty({ height: "100%", width: Math.round(((o.current || 0) / o.total) * 100) + "%", background: GREEN, borderRadius: 2, transition: "width 0.4s" }) + '"></div></div>'
        : "") +
      "</div>";
  }

  // Sticky footer for a screen's committing action.
  function ActionBar(inner) {
    return '<div style="' + sty({ padding: "12px 16px", background: "white", borderTop: "1px solid #f0f0f0", flexShrink: 0 }) + '">' + inner + "</div>";
  }

  /* ── Controls ──────────────────────────────────────────────────────────── */

  const BTN_VARIANTS = {
    green:   { background: GREEN,     color: "white",   border: "none" },
    brand:   { background: BRAND,     color: "white",   border: "none" },
    orange:  { background: ORANGE,    color: "white",   border: "none" },
    red:     { background: RED,       color: "white",   border: "none" },
    outline: { background: "white",   color: BRAND,     border: "2px solid " + BRAND },
    grey:    { background: "#f3f4f6", color: "#6b7280", border: "none" },
  };

  function BtnXL(o) {
    o = o || {};
    const base = { width: "100%", padding: 18, borderRadius: 16, fontSize: 17, fontWeight: 700,
      cursor: o.disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center",
      justifyContent: "center", gap: 8, opacity: o.disabled ? 0.5 : 1 };
    return '<button type="button" class="rd-btn"' + (o.disabled ? " disabled" : "") +
      (o.actName ? act(o.actName, o.arg) : "") +
      ' style="' + sty(mix(base, BTN_VARIANTS[o.variant || "green"], o.style)) + '">' + (o.label || "") + "</button>";
  }

  const BTN_SM_VARIANTS = {
    green: { background: "#f0fdf4", color: "#16a34a", border: "2px solid #bbf7d0" },
    red:   { background: "#fef2f2", color: "#dc2626", border: "2px solid #fecaca" },
    brand: { background: BRAND,     color: "white",   border: "none" },
    grey:  { background: "#f3f4f6", color: "#6b7280", border: "none" },
  };

  function BtnSm(o) {
    o = o || {};
    const base = { flex: 1, padding: "12px 16px", fontSize: 15, fontWeight: 600, borderRadius: 12,
      cursor: o.disabled ? "not-allowed" : "pointer", opacity: o.disabled ? 0.45 : 1,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 7 };
    return '<button type="button" class="rd-btn-sm"' + (o.disabled ? " disabled" : "") +
      (o.actName ? act(o.actName, o.arg) : "") +
      ' style="' + sty(mix(base, BTN_SM_VARIANTS[o.variant || "green"], o.style)) + '">' + (o.label || "") + "</button>";
  }

  const BANNER_TYPES = {
    green:  { background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" },
    orange: { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" },
    blue:   { background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe" },
    red:    { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" },
  };

  function Banner(o) {
    o = o || {};
    const base = { margin: "0 12px 10px", padding: "12px 14px", borderRadius: 14, fontSize: 13,
      fontWeight: 600, display: "flex", alignItems: "flex-start", gap: 10 };
    return '<div style="' + sty(mix(base, BANNER_TYPES[o.type || "blue"], o.style)) + '">' +
      (o.icon ? '<span style="flex-shrink:0">' + o.icon + "</span>" : "") +
      "<span>" + (o.html || esc(o.text)) + "</span></div>";
  }

  function Card(inner, o) {
    o = o || {};
    const base = { background: "white", borderRadius: 16, margin: "0 12px 10px",
      padding: o.padding !== undefined ? o.padding : 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };
    return "<div" + (o.status ? ' data-status="' + esc(o.status) + '"' : "") +
      ' style="' + sty(mix(base, o.style)) + '">' + inner + "</div>";
  }

  function CardTitle(text) {
    return '<div style="' + sty({ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#888", marginBottom: 12 }) + '">' + esc(text) + "</div>";
  }

  function StatGrid(inner, style) {
    return '<div style="' + sty(mix({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "12px 12px 0", minWidth: 0, overflow: "hidden" }, style)) + '">' + inner + "</div>";
  }

  const TILE_PALETTE = {
    default: { bg: "white",   val: "#111",  lbl: "#888" },
    green:   { bg: "#2D7A42", val: "white", lbl: "rgba(255,255,255,0.8)" },
    orange:  { bg: "#D4862A", val: "white", lbl: "rgba(255,255,255,0.8)" },
    red:     { bg: "#C0392B", val: "white", lbl: "rgba(255,255,255,0.8)" },
    blue:    { bg: "#3451B2", val: "white", lbl: "rgba(255,255,255,0.8)" },
  };

  function StatTile(value, label, color) {
    const p = TILE_PALETTE[color] || TILE_PALETTE.default;
    return '<div style="' + sty({ background: p.bg, borderRadius: 14, padding: "14px 12px", minWidth: 0, overflow: "hidden" }) + '">' +
      '<div style="' + sty({ fontSize: 22, fontWeight: 800, color: p.val, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }) + '">' + esc(value) + "</div>" +
      '<div style="' + sty({ fontSize: 11, color: p.lbl, fontWeight: 600, marginTop: 3 }) + '">' + esc(label) + "</div></div>";
  }

  function SectionHeader(text) {
    return '<div style="' + sty({ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", padding: "12px 16px 6px" }) + '">' + esc(text) + "</div>";
  }

  function Divider(style) { return '<div style="' + sty(mix({ height: 8, background: BG }, style)) + '"></div>'; }
  function Spacer(h) { return '<div style="height:' + (h === undefined ? 16 : h) + 'px"></div>'; }

  function StatusChip(o) {
    return '<button type="button" class="rd-chip"' + act(o.actName, o.arg) + ' style="' + sty({
      padding: "7px 15px", borderRadius: 20,
      border: "1.5px solid " + (o.active ? BRAND : "#e5e7eb"),
      background: o.active ? BRAND : "white",
      color: o.active ? "white" : "#6b7280",
      fontSize: 13, fontWeight: o.active ? 700 : 500,
      cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.15s",
    }) + '">' + esc(o.label) + "</button>";
  }

  const TABS = [
    { key: "home",     icon: "🏠",  label: "Home" },
    { key: "routes",   icon: "🗺️", label: "Routes" },
    { key: "followup", icon: "📋",  label: "Follow-up" },
    { key: "reports",  icon: "📊",  label: "Reports" },
    { key: "back",     icon: null,  label: "Back" },
  ];

  function TabBar(active) {
    return '<div style="' + sty({ height: 58, background: "white", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-around", flexShrink: 0 }) + '">' +
      TABS.map(function (t) {
        const on = active === t.key;
        const icon = t.icon
          ? '<div style="font-size:20px">' + t.icon + "</div>"
          : '<svg viewBox="0 0 24 24" fill="none" stroke="' + (on ? BRAND : "#9ca3af") + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>';
        return '<button type="button" class="rd-tab"' + act("tab", t.key) + ' style="' + sty({ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", padding: "4px 8px", border: "none", background: "transparent" }) + '">' +
          icon + '<div style="' + sty({ fontSize: 10, fontWeight: 600, color: on ? BRAND : "#9ca3af" }) + '">' + t.label + "</div></button>";
      }).join("") + "</div>";
  }

  /* ── Inputs (ui.jsx SearchInput / StepperInput / NumPad) ───────────────── */

  function SearchInput(o) {
    o = o || {};
    const v = o.value || "";
    return '<div style="' + sty(mix({ position: "relative" }, o.style)) + '">' +
      '<span style="' + sty({ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 15, color: "#aaa", pointerEvents: "none" }) + '">🔍</span>' +
      '<input type="text" data-model="' + esc(o.model) + '" value="' + esc(v) + '" placeholder="' + esc(o.placeholder || "Search…") + '" style="' + sty({
        width: "100%", boxSizing: "border-box",
        padding: v ? "11px 36px 11px 38px" : "11px 14px 11px 38px",
        borderRadius: 12, border: "1.5px solid #e5e7eb", background: "white",
        fontSize: 14, fontFamily: "inherit", color: "#111",
      }) + '" />' +
      (v ? '<button type="button"' + act(o.clearAct || "clear-search") + ' style="' + sty({ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "#9ca3af", fontSize: 15, cursor: "pointer" }) + '">✕</button>' : "") +
      "</div>";
  }

  // −/value/+ with a typable middle. `max` disables + at the ceiling, which is
  // how stock screens stop a driver loading more than the van holds.
  function StepperInput(o) {
    o = o || {};
    const sz = o.small ? 36 : 40;
    const atMax = o.max != null && o.value >= o.max;
    const arg = o.arg === undefined ? "" : o.arg;
    return '<div style="' + sty({ display: "flex", alignItems: "center" }) + '">' +
      '<button type="button" class="rd-stepper-btn"' + act(o.decAct, arg) + ' style="' + sty({ width: sz, height: sz, borderRadius: "10px 0 0 10px", border: "2px solid #e5e7eb", background: "white", fontSize: o.small ? 17 : 20, fontWeight: 700, color: BRAND, cursor: "pointer" }) + '">−</button>' +
      '<input value="' + esc(o.value) + '" inputmode="numeric" data-model="' + esc(o.model) + '" style="' + sty({
        width: o.small ? 44 : 48, height: sz, textAlign: "center", fontSize: o.small ? 17 : 18, fontWeight: 700,
        border: "2px solid #e5e7eb", borderLeft: "none", borderRight: "none", outline: "none", background: "white", color: "#111",
      }) + '" />' +
      '<button type="button" class="rd-stepper-btn"' + (atMax ? " disabled" : act(o.incAct, arg)) + ' style="' + sty({ width: sz, height: sz, borderRadius: "0 10px 10px 0", border: "2px solid #e5e7eb", background: atMax ? "#f9fafb" : "white", fontSize: o.small ? 17 : 20, fontWeight: 700, color: atMax ? "#d1d5db" : BRAND, cursor: atMax ? "not-allowed" : "pointer" }) + '">+</button>' +
      "</div>";
  }

  const NUMPAD_KEYS = ["1","2","3","4","5","6","7","8","9","←","0","C"];

  function NumPad(actName, style) {
    return '<div style="' + sty(mix({ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gridTemplateRows: "repeat(4,1fr)", gap: 2, background: "#e5e7eb", borderRadius: 16, overflow: "hidden", margin: "0 16px" }, style)) + '">' +
      NUMPAD_KEYS.map(function (k) {
        return '<button type="button" class="rd-key"' + act(actName, k) + ' style="' + sty({ minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 600, color: (k === "←" || k === "C") ? "#888" : "#111", background: "white", border: "none", cursor: "pointer" }) + '">' + k + "</button>";
      }).join("") + "</div>";
  }

  /* ── Rows ──────────────────────────────────────────────────────────────── */

  function SettleRow(label, value, valueColor, last) {
    return '<div style="' + sty({ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: last ? "none" : "1px dashed #e5e7eb" }) + '">' +
      '<span style="' + sty({ fontSize: 14, color: "#555", flex: 1, minWidth: 0 }) + '">' + label + "</span>" +
      '<span style="' + sty({ fontSize: 16, fontWeight: 700, color: valueColor || "#111", flexShrink: 0, maxWidth: "55%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }) + '">' + value + "</span></div>";
  }

  // A checklist line. `done` fills the circle, `active` colours the subtitle
  // amber to mark the one step the driver should do next.
  function CheckItem(o) {
    o = o || {};
    const tag = o.actName ? "button" : "div";
    return "<" + tag + ' type="button"' + (o.actName ? act(o.actName, o.arg) : "") + ' style="' + sty({
      display: "flex", alignItems: "center", padding: "14px 16px", background: "white",
      borderBottom: "1px solid #f5f5f5", borderTop: "none", borderLeft: "none", borderRight: "none",
      gap: 12, cursor: o.actName ? "pointer" : "default",
      width: o.actName ? "100%" : undefined, textAlign: o.actName ? "left" : undefined,
      fontFamily: o.actName ? "inherit" : undefined,
    }) + '">' +
      '<div style="' + sty({
        width: 28, height: 28, borderRadius: "50%",
        border: "2.5px solid " + (o.done ? GREEN : o.active ? GREEN : "#e5e7eb"),
        background: o.done ? GREEN : "transparent", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, color: o.done ? "white" : "transparent",
      }) + '">' + (o.done ? "✓" : "") + "</div>" +
      '<div style="' + sty({ flex: 1 }) + '">' +
        '<div style="' + sty({ fontSize: 15, fontWeight: 600, color: "#111" }) + '">' + esc(o.title) + "</div>" +
        (o.subtitle ? '<div style="' + sty({ fontSize: 12, color: (o.active && !o.done) ? ORANGE : "#888", marginTop: 2 }) + '">' + esc(o.subtitle) + "</div>" : "") +
      "</div>" +
      (o.action ? '<span style="' + sty({ fontSize: 13, fontWeight: 600, color: o.done ? GREEN : o.active ? ORANGE : "#888" }) + '">' + esc(o.action) + "</span>" : "") +
      "</" + tag + ">";
  }

  /* ── ConfirmPanel (ui.jsx, binaryMode) ─────────────────────────────────── */
  // The app never commits money on a single tap. The primary button swaps the
  // footer for this: what is about to happen, then two cards — escape on the
  // left, commit on the right — so the destructive choice is never where the
  // finger already is.
  function ConfirmPanel(o) {
    o = o || {};
    return '<div style="' + sty({ padding: "2px 0 0" }) + '">' +
      '<div style="' + sty({ marginBottom: 16 }) + '">' +
        (o.action ? '<div style="' + sty({ fontSize: 10, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }) + '">' + esc(o.action) + "</div>" : "") +
        (o.amount ? '<div style="' + sty({ fontSize: 30, fontWeight: 900, color: "#111", lineHeight: 1.1, letterSpacing: "-0.5px" }) + '">' + esc(o.amount) + "</div>" : "") +
        (o.context ? '<div style="' + sty({ fontSize: 13, color: "#6b7280", marginTop: 3, fontWeight: 500 }) + '">' + esc(o.context) + "</div>" : "") +
      "</div>" +
      (o.extra || "") +
      '<div style="' + sty({ display: "flex", gap: 10 }) + '">' +
        '<button type="button" class="rd-decision-card rd-decision-card--safe"' + act(o.backAct || "confirm-cancel") + ' style="' + sty({
          flex: 1, padding: "14px 16px", background: "white", border: "2px solid " + BRAND, borderRadius: 16,
          textAlign: "center", cursor: "pointer", fontFamily: "inherit", minHeight: 56,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }) + '"><div style="' + sty({ fontSize: 15, fontWeight: 700, color: BRAND, lineHeight: 1.25 }) + '">' + esc(o.backLabel || "Go Back") + "</div></button>" +
        '<button type="button" class="rd-decision-card rd-decision-card--commit"' + (o.disabled ? " disabled" : act(o.commitAct, o.arg)) + ' style="' + sty({
          flex: 1, padding: "14px 16px", background: o.disabled ? "#9ca3af" : GREEN, border: "none", borderRadius: 16,
          textAlign: "center", cursor: o.disabled ? "default" : "pointer", opacity: o.disabled ? 0.6 : 1,
          fontFamily: "inherit", minHeight: 56, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }) + '"><div style="' + sty({ fontSize: 15, fontWeight: 700, color: "white", lineHeight: 1.25 }) + '">' + esc(o.commitLabel || "Confirm") + "</div></button>" +
      "</div></div>";
  }

  // Dims and blocks the screen behind a ConfirmPanel, so the only live controls
  // are the two decision cards.
  function FreezeBackdrop() {
    return '<div style="' + sty({ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", zIndex: 40 }) + '"></div>';
  }

  /* ── States ────────────────────────────────────────────────────────────── */

  function EmptyState(icon, title, subtitle) {
    return '<div style="' + sty({ padding: "48px 24px", textAlign: "center" }) + '">' +
      '<div style="' + sty({ fontSize: 40, marginBottom: 12 }) + '">' + icon + "</div>" +
      '<div style="' + sty({ fontSize: 15, fontWeight: 600, color: "#111", marginBottom: 6 }) + '">' + esc(title) + "</div>" +
      '<div style="' + sty({ fontSize: 13, color: "#888" }) + '">' + esc(subtitle) + "</div></div>";
  }

  function ErrorState(message) {
    return '<div style="' + sty({ padding: "32px 24px", textAlign: "center" }) + '">' +
      '<div style="' + sty({ fontSize: 36, marginBottom: 12 }) + '">⚠️</div>' +
      '<div style="' + sty({ fontSize: 15, fontWeight: 600, color: "#111", marginBottom: 6 }) + '">Failed to load routes</div>' +
      '<div style="' + sty({ fontSize: 13, color: "#888", marginBottom: 20 }) + '">' + esc(message) + "</div>" +
      '<button type="button"' + act("retry") + ' style="' + sty({ padding: "12px 24px", background: BRAND, color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer" }) + '">Retry</button></div>';
  }

  window.RD_UI = {
    BRAND: BRAND, GREEN: GREEN, ORANGE: ORANGE, RED: RED, BG: BG,
    esc: esc, sty: sty, mix: mix, act: act,
    inr: inr, formatAmountValue: formatAmountValue,
    toLocalDateStr: toLocalDateStr, timeAgoLabel: timeAgoLabel, fmtDateLabel: fmtDateLabel, greeting: greeting,
    SyncBar: SyncBar, DriverHeader: DriverHeader, MobileHeader: MobileHeader, ProgressBar: ProgressBar,
    ActionBar: ActionBar, BtnXL: BtnXL, BtnSm: BtnSm, Banner: Banner,
    Card: Card, CardTitle: CardTitle, StatGrid: StatGrid, StatTile: StatTile,
    SectionHeader: SectionHeader, Divider: Divider, Spacer: Spacer,
    StatusChip: StatusChip, TabBar: TabBar, EmptyState: EmptyState, ErrorState: ErrorState,
    SearchInput: SearchInput, StepperInput: StepperInput, NumPad: NumPad,
    SettleRow: SettleRow, CheckItem: CheckItem,
    ConfirmPanel: ConfirmPanel, FreezeBackdrop: FreezeBackdrop,
  };
})();

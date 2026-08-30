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

  // The home button that sits at the right of every in-route header. QA's
  // HomeMenuButton: a 32x32 outlined square that does NOT navigate on tap — it
  // raises a confirmation sheet first, because leaving mid-route is a step a
  // driver should not take by a mis-tap.
  function HomeMenuButton(style) {
    return '<button type="button" aria-label="Go to route delivery home" title="Route delivery home"' + act("home-confirm-open") + ' style="' + sty(mix({
      width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center",
      border: "1px solid rgba(255,255,255,0.30)", borderRadius: 9, background: "transparent",
      color: "white", cursor: "pointer", opacity: 1,
    }, style)) + '">' +
      '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px">' +
        '<path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Z"></path><path d="M9 20v-6h6v6"></path></svg></button>';
  }

  // The sheet the home button raises. Rendered by whichever header is on
  // screen, so it follows the app rather than living in the router.
  function HomeConfirm() {
    if (!window.RD || !window.RD.state.homeConfirm) return "";
    return '<div style="' + sty({ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }) + '">' +
      '<div role="dialog" aria-modal="true" style="' + sty({
        position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)",
        width: "min(100%, 480px)", background: "white",
        padding: "16px 14px calc(env(safe-area-inset-bottom, 0px) + 12px)",
        boxShadow: "0 -8px 24px rgba(0,0,0,0.12)",
      }) + '">' +
        '<div style="' + sty({ fontSize: 10, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 5 }) + '">Route Delivery</div>' +
        '<div style="' + sty({ fontSize: 28, fontWeight: 900, color: "#111", lineHeight: 1.1, letterSpacing: "-0.5px" }) + '">Go to home?</div>' +
        '<div style="' + sty({ fontSize: 13, color: "#6b7280", marginTop: 4, fontWeight: 500 }) + '">Your current route progress is saved.</div>' +
        '<div style="' + sty({ display: "flex", gap: 10, marginTop: 16 }) + '">' +
          '<button type="button"' + act("home-confirm-close") + ' style="' + sty({
            flex: 1, minHeight: 62, padding: "12px 10px", border: "2px solid " + BRAND, borderRadius: 16,
            background: "white", color: BRAND, fontFamily: "inherit", fontSize: 14, fontWeight: 800, cursor: "pointer",
          }) + '">Continue Working</button>' +
          '<button type="button"' + act("home-confirm-go") + ' style="' + sty({
            flex: 1, minHeight: 62, padding: "12px 10px", border: "none", borderRadius: 16,
            background: GREEN, color: "white", fontFamily: "inherit", fontSize: 14, fontWeight: 800, cursor: "pointer",
          }) + '">Go to Home</button>' +
        "</div>" +
      "</div></div>";
  }

  // MobileHeader (ui.jsx). Left-aligned, no centring: an optional back link at
  // 13px, the title at 20/700, an optional subtitle, and a right slot the text
  // block reserves 42px for. Measured against QA — the back link is a plain
  // block button with no padding and no press state, not a chip.
  function MobileHeader(o) {
    o = o || {};
    const hasBack = o.onBack !== false;
    const hasRightSlot = !!o.rightAction || o.showHome !== false;
    const slotW = hasRightSlot ? (o.rightAction ? (o.rightSlotWidth || 42) : 42) : 0;
    return '<div style="' + sty({ background: BRAND, padding: "calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 10px) 16px 12px", flexShrink: 0, position: "relative" }) + '">' +
      '<div style="' + sty({ paddingRight: slotW }) + '">' +
        (hasBack
          ? '<button type="button"' + act(o.backAct || "back") + ' style="' + sty({
              background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13,
              color: "rgba(255,255,255,0.7)", display: "block", fontFamily: "inherit", fontWeight: 400, marginBottom: 4,
            }) + '">' + esc(o.backLabel ? "← " + o.backLabel : "← Back") + "</button>"
          : "") +
        '<div style="' + sty({ fontSize: 20, fontWeight: 700, color: "white", marginTop: hasBack ? 2 : 0 }) + '">' + esc(o.title || "") + "</div>" +
        (o.subtitle ? '<div style="' + sty({ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 }) + '">' + esc(o.subtitle) + "</div>" : "") +
      "</div>" +
      (o.rightAction
        ? '<div style="' + sty({ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)" }) + '">' + o.rightAction + "</div>"
        : (o.showHome === false ? "" : HomeMenuButton({ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)" }))) +
      "</div>" + HomeConfirm();
  }

  // ProgressBar (ui.jsx) — the in-route header. A 13px back link, a flexible
  // spacer, then a right-hand group carrying the running collected total, the
  // home button and whatever the screen hangs in `rightAction`; a 4px track
  // sits 8px below. Measured against QA down to the 0.3px the inline-flex menu
  // button adds to the row.
  function ProgressBar(o) {
    o = o || {};
    const pct = o.total > 0 ? Math.round(((o.current || 0) / o.total) * 100) : 0;
    return '<div style="' + sty({ background: BRAND, padding: "calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 10px) 16px 8px", flexShrink: 0 }) + '">' +
      '<div style="' + sty({ display: "flex", alignItems: "center", marginBottom: 8 }) + '">' +
        (o.onBack === false
          ? '<span style="' + sty({ flexShrink: 0, fontSize: 13 }) + '"></span>'
          : '<button type="button"' + act(o.backAct || "back") + ' style="' + sty({
              background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13,
              color: "rgba(255,255,255,0.75)", fontFamily: "inherit", fontWeight: 500, flexShrink: 0,
            }) + '">' + esc(o.backLabel ? "← " + o.backLabel : "← Back") + "</button>") +
        '<span style="' + sty({ flex: 1 }) + '"></span>' +
        '<div style="' + sty({ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }) + '">' +
          '<div style="' + sty({ textAlign: "right", flexShrink: 1, minWidth: 0 }) + '">' +
            '<span style="' + sty({ fontSize: 13, color: "white", fontWeight: 700, whiteSpace: "nowrap" }) + '">' + esc(o.collected === undefined ? inr(0) : o.collected) + "</span>" +
            '<span style="' + sty({ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 500, whiteSpace: "nowrap", marginLeft: 4 }) + '">' + esc(o.collectedLabel || "collected this route") + "</span>" +
          "</div>" +
          (o.showHome === false ? "" : HomeMenuButton()) +
          (o.rightAction || "") +
        "</div>" +
      "</div>" +
      '<div style="' + sty({ height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2, overflow: "hidden" }) + '">' +
        '<div style="' + sty({ height: "100%", background: GREEN, borderRadius: 2, width: pct + "%", transition: "0.3s" }) + '"></div></div>' +
      "</div>" + HomeConfirm();
  }

  // Sticky footer for a screen's committing action.
  function ActionBar(inner) {
    return '<div style="' + sty({ padding: "12px 16px calc(env(safe-area-inset-bottom, 0px) + 8px)", background: "white", borderTop: "1px solid #f0f0f0", flexShrink: 0 }) + '">' + inner + "</div>";
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
    // No class: QA's dashboard chips carry no ui.css class, only inline styles,
    // so they have neither the hover shadow nor the press-scale of .rd-chip.
    return '<button type="button"' + act(o.actName, o.arg) + ' style="' + sty({
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
      // A field with something in it takes a brand border, and its clear control
      // is a filled 20px disc — not a bare glyph.
      '<input type="text" data-model="' + esc(o.model) + '" value="' + esc(v) + '" placeholder="' + esc(o.placeholder || "Search…") + '" style="' + sty({
        width: "100%", boxSizing: "border-box",
        padding: v ? "11px 36px 11px 38px" : "11px 14px 11px 38px",
        border: "1.5px solid " + (v ? BRAND : "#e5e7eb"),
        borderRadius: 12, fontSize: 14, fontFamily: "inherit",
        color: "#111", background: "white", outline: "none",
        transition: "border-color 0.15s",
      }) + '" />' +
      (v
        ? '<button type="button" class="rd-pressable"' + act(o.clearAct || "clear-search") + ' style="' + sty({
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            width: 20, height: 20, borderRadius: "50%", background: "#e5e7eb", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, color: "#6b7280", cursor: "pointer", padding: 0, lineHeight: 1,
          }) + '">×</button>'
        : "") +
      "</div>";
  }

  // −/value/+ with a typable middle. `max` disables + at the ceiling, which is
  // how stock screens stop a driver loading more than the van holds.
  // Two shapes upstream, and they are not interchangeable: the shared ui.jsx
  // stepper (radius 10, 17/20px glyphs) and AddNewCustomer's SmallStepper
  // (radius 8, 18px glyphs, greyed +). `tight` selects the latter.
  function StepperInput(o) {
    o = o || {};
    const sz = o.small ? 36 : 40;
    const r = o.tight ? 8 : 10;
    const glyph = o.tight ? 18 : (o.small ? 17 : 20);
    const atMax = o.max != null && o.value >= o.max;
    const arg = o.arg === undefined ? "" : o.arg;
    return '<div style="' + sty({ display: "flex", alignItems: "center" }) + '">' +
      '<button type="button" class="rd-stepper-btn"' + act(o.decAct, arg) + ' style="' + sty({ width: sz, height: sz, borderRadius: r + "px 0 0 " + r + "px", border: "2px solid #e5e7eb", background: "white", fontSize: glyph, fontWeight: 700, color: BRAND, cursor: "pointer" }) + '">−</button>' +
      '<input value="' + esc(o.value) + '" inputmode="numeric" data-model="' + esc(o.model) + '" style="' + sty({
        width: o.small ? 44 : 48, height: sz, textAlign: "center", fontSize: o.small ? 17 : 18, fontWeight: 700,
        border: "2px solid #e5e7eb", borderLeft: "none", borderRight: "none", outline: "none", background: "white", color: "#111",
      }) + '" />' +
      '<button type="button" class="rd-stepper-btn"' + (atMax ? " disabled" : act(o.incAct, arg)) + ' style="' + sty({ width: sz, height: sz, borderRadius: "0 " + r + "px " + r + "px 0", border: "2px solid #e5e7eb", background: atMax ? (o.tight ? "#f3f4f6" : "#f9fafb") : "white", fontSize: glyph, fontWeight: 700, color: atMax ? "#d1d5db" : BRAND, cursor: atMax ? "not-allowed" : "pointer" }) + '">+</button>' +
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
  // ui.jsx InlineSpinner.
  function InlineSpinner(size, color) {
    size = size || 16; color = color || "white";
    return '<span style="' + sty({
      display: "inline-block", width: size, height: size,
      border: "2px solid " + color + "33", borderTopColor: color,
      borderRadius: "50%", animation: "rd-spin 0.7s linear infinite",
      verticalAlign: "middle", flexShrink: 0,
    }) + '"></span>';
  }

  function ConfirmPanel(o) {
    o = o || {};
    // Committed state. QA replaces the whole panel — header, summary and both
    // cards — with one full-width processing block for as long as the write is
    // in flight, so there is nothing left to tap twice.
    if (o.processing) {
      return '<div style="' + sty({ padding: "2px 0 0" }) + '">' +
        '<div style="' + sty({
          background: "#2e7d32", borderRadius: 16, padding: "18px 20px",
          display: "flex", alignItems: "center", gap: 16, minHeight: 60,
          animation: "rd-processing-in 0.22s ease",
        }) + '">' + InlineSpinner(22, "rgba(255,255,255,0.9)") +
          '<div style="' + sty({ flex: 1 }) + '">' +
            '<div style="' + sty({ fontSize: 15, fontWeight: 700, color: "white", lineHeight: 1.3 }) + '">' + esc(o.processingLabel || ((o.commitLabel || "Confirm") + "…")) + "</div>" +
            '<div style="' + sty({ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 3 }) + '">Please wait</div>' +
          "</div></div></div>";
    }
    return '<div style="' + sty({ padding: "2px 0 0" }) + '">' +
      '<div style="' + sty({ marginBottom: 16 }) + '">' +
        (o.action ? '<div style="' + sty({ fontSize: 10, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }) + '">' + esc(o.action) + "</div>" : "") +
        (o.amount ? '<div style="' + sty({ fontSize: 30, fontWeight: 900, color: "#111", lineHeight: 1.1, letterSpacing: "-0.5px" }) + '">' + esc(o.amount) + "</div>" : "") +
        (o.context ? '<div style="' + sty({ fontSize: 13, color: "#6b7280", marginTop: 3, fontWeight: 500 }) + '">' + esc(o.context) + "</div>" : "") +
      "</div>" +
      (o.extra ? '<div style="' + sty({ marginBottom: 12 }) + '">' + o.extra + "</div>" : "") +
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

  /* ── Bottom sheets (OfferPriceSheet.jsx / DiscountSheet.jsx) ───────────── */

  // Both sheets stay mounted and slide on a transform, so opening and closing
  // animate; when closed they are pushed fully off-screen AND made
  // pointer-events:none, or the hidden sheet would swallow taps meant for the
  // screen behind it.
  function sheetShell(o) {
    const open = !!o.open;
    return '<div' + (o.closeAct ? act(o.closeAct) : "") + ' style="' + sty({
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.42)",
      backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
      zIndex: o.zIndex - 1, opacity: open ? 1 : 0,
      pointerEvents: open ? "auto" : "none", transition: "opacity 0.25s",
    }) + '"></div>' +
    '<div style="' + sty({
      position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 480, margin: "0 auto",
      background: "white", borderRadius: "20px 20px 0 0", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
      zIndex: o.zIndex, transform: open ? "translateY(0)" : "translateY(100%)",
      pointerEvents: open ? "auto" : "none",
      transition: "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }) + '">' +
      '<div style="' + sty({ width: 36, height: 4, background: "#e2e8f0", borderRadius: 2, margin: o.handleMargin || "12px auto 16px" }) + '"></div>' +
      o.body +
    "</div>";
  }

  // Per-product offer price. The driver types what the customer actually pays,
  // inclusive of tax; the quick chips are percentages off the catalog price.
  const OFFER_CHIPS = ["5", "10", "15", "20"];

  function OfferPriceSheet(o) {
    o = o || {};
    const catalog = Number(o.catalogPrice || 0);
    const input = o.input === undefined || o.input === null ? "" : String(o.input);
    const parsed = parseFloat(input) || 0;
    const saving = parsed > 0 ? Math.round((catalog - parsed) * 100) / 100 : 0;
    const isHigher = parsed > catalog + 0.005;
    const activeChip = OFFER_CHIPS.filter(function (pct) {
      const computed = Math.round(catalog * (1 - Number(pct) / 100) * 100) / 100;
      return parsed > 0 && Math.abs(parsed - computed) < 0.01;
    })[0] || null;
    const qty = Number(o.qty || 0);
    const atMin = qty <= 0;
    const atMax = o.maxQty !== null && o.maxQty !== undefined && qty >= o.maxQty;
    const stepBtn = function (label, actName, disabled, radius) {
      return '<button type="button"' + (disabled ? " disabled" : act(actName, o.productId)) + ' style="' + sty({
        width: 36, height: 36, borderRadius: radius, border: "2px solid #e5e7eb",
        background: disabled ? "#f3f4f6" : "white", fontSize: 18, fontWeight: 700,
        color: disabled ? "#d1d5db" : BRAND, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
      }) + '">' + label + "</button>";
    };
    const body = '<div style="' + sty({ padding: "0 20px 20px" }) + '">' +
      '<div style="' + sty({ marginBottom: 16 }) + '">' +
        '<div style="' + sty({ fontSize: 16, fontWeight: 800, color: "#111", lineHeight: 1.3 }) + '">' + esc(o.productName || "") + "</div>" +
        '<div style="' + sty({ fontSize: 12, color: "#9ca3af", marginTop: 3 }) + '">Catalog price ₹' + catalog.toLocaleString("en-IN") +
          (o.taxRate > 0 ? " · " + o.taxRate + "% GST included" : "") + "</div>" +
      "</div>" +
      '<div style="' + sty({ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, padding: "10px 14px", background: "#f8fafc", borderRadius: 12 }) + '">' +
        '<span style="' + sty({ fontSize: 13, fontWeight: 600, color: "#555" }) + '">Quantity</span>' +
        '<div style="' + sty({ display: "flex", alignItems: "center" }) + '">' +
          stepBtn("−", o.decAct, atMin, "8px 0 0 8px") +
          '<div style="' + sty({ width: 48, height: 36, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #e5e7eb", borderLeft: "none", borderRight: "none", fontSize: 17, fontWeight: 700, background: "white", color: "#111" }) + '">' + qty + "</div>" +
          stepBtn("+", o.incAct, atMax, "0 8px 8px 0") +
        "</div>" +
        '<span style="' + sty({ fontSize: 11, color: atMax ? "#f97316" : "#9ca3af", fontWeight: atMax ? 600 : 400, minWidth: 60, textAlign: "right" }) + '">' +
          (o.maxQty !== null && o.maxQty !== undefined ? (atMax ? "⚠ Max " + o.maxQty : o.maxQty + " loaded") : "") + "</span>" +
      "</div>" +
      '<div style="' + sty({ fontSize: 12, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }) + '">Offer price ' +
        '<span style="' + sty({ textTransform: "none", fontWeight: 400, color: "#9ca3af" }) + '">(what customer pays)</span></div>' +
      '<div style="' + sty({ position: "relative", marginBottom: 12 }) + '">' +
        '<span style="' + sty({ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#9ca3af", pointerEvents: "none", fontWeight: 500 }) + '">₹</span>' +
        '<input inputmode="decimal" data-model="' + esc(o.model) + '" value="' + esc(input) + '" placeholder="' + catalog.toLocaleString("en-IN") + '" style="' + sty({
          width: "100%", paddingLeft: 32, paddingRight: 14, paddingTop: 13, paddingBottom: 13,
          fontSize: 18, fontWeight: 700,
          border: "2px solid " + (isHigher ? "#ef4444" : input ? BRAND : "#e5e7eb"),
          borderRadius: 12, outline: "none", background: "white", color: "#111",
          boxSizing: "border-box", fontFamily: "inherit", transition: "border-color 0.15s",
        }) + '" /></div>' +
      '<div style="' + sty({ marginBottom: 14 }) + '">' +
        '<div style="' + sty({ fontSize: 11, color: "#9ca3af", fontWeight: 500, marginBottom: 8 }) + '">Quick discount off catalog</div>' +
        '<div style="' + sty({ display: "flex", gap: 8 }) + '">' +
          OFFER_CHIPS.map(function (pct) {
            const on = activeChip === pct;
            return '<button type="button"' + act(o.chipAct, pct) + ' style="' + sty({
              flex: 1, padding: "9px 0", borderRadius: 10,
              border: "1.5px solid " + (on ? BRAND : "#e5e7eb"),
              background: on ? "#e8f3f6" : "white", color: on ? BRAND : "#374151",
              fontSize: 13, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
            }) + '">' + pct + "%</button>";
          }).join("") +
        "</div></div>" +
      (parsed > 0
        ? '<div style="' + sty({ minHeight: 20, marginBottom: 14 }) + '">' +
            (isHigher
              ? '<div style="' + sty({ fontSize: 12, color: "#f97316", fontWeight: 600 }) + '">⚠ Offer price is above catalog price</div>'
              : saving > 0
                ? '<div style="' + sty({ fontSize: 13, color: "#16a34a", fontWeight: 600 }) + '">Customer saves ₹' + saving.toLocaleString("en-IN") + " vs catalog</div>"
                : "") +
          "</div>"
        : "") +
      '<div style="' + sty({ display: "flex", gap: 10 }) + '">' +
        (o.hasCustomPrice
          ? '<button type="button"' + act(o.resetAct, o.productId) + ' style="' + sty({
              flex: 1, padding: "13px 0", borderRadius: 14, border: "1.5px solid #e5e7eb",
              background: "white", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }) + '">Reset to ₹' + catalog.toLocaleString("en-IN") + "</button>"
          : "") +
        '<button type="button"' + act(o.confirmAct, o.productId) + ' style="' + sty({
          flex: 1, padding: "13px 0", borderRadius: 14, background: BRAND, color: "white",
          border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }) + '">' + (input ? "Set Offer Price →" : "Done") + "</button>" +
      "</div></div>";
    return sheetShell({ open: o.open, zIndex: 201, closeAct: o.closeAct, body: body });
  }

  // Order-level discount, shared by the booking and new-customer flows.
  const PERCENT_CHIPS = ["2", "3", "5", "10"];
  const CASH_CHIPS = ["10", "25", "50", "100"];

  function OrderDiscountPanel(o) {
    o = o || {};
    const type = o.discountType || "percent";
    const chips = type === "percent" ? PERCENT_CHIPS : CASH_CHIPS;
    const input = o.discountInput === undefined || o.discountInput === null ? "" : String(o.discountInput);
    const activeChip = chips.indexOf(input) !== -1 ? input : null;
    const hasDiscount = o.discountPct > 0 && o.discountAmount > 0 && o.subtotal > 0;
    const savings = Math.round((o.discountAmount || 0) * 100) / 100;
    const finalTotal = Math.max(0, Math.round(((o.subtotal || 0) - (o.discountAmount || 0)) * 100) / 100);
    return '<div style="' + sty({
      margin: "0 12px 10px", borderRadius: 16,
      border: "1.5px solid " + (hasDiscount ? "#86efac" : "#e5e7eb"),
      background: hasDiscount ? "#f0fdf4" : "white", overflow: "hidden",
      transition: "border-color 0.2s, background 0.2s",
    }) + '">' +
      '<div style="' + sty({ padding: "12px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }) + '">' +
        '<div style="' + sty({ display: "flex", alignItems: "center", gap: 6 }) + '">' +
          '<span style="' + sty({ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.6px" }) + '">Discount</span>' +
          '<span style="' + sty({ fontSize: 11, color: "#9ca3af", fontWeight: 400 }) + '">· optional</span>' +
        "</div>" +
        (hasDiscount
          ? '<button type="button"' + act(o.clearAct) + ' style="' + sty({ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9ca3af", fontWeight: 600, padding: "2px 4px", lineHeight: 1, fontFamily: "inherit" }) + '">✕ Clear</button>'
          : "") +
      "</div>" +
      '<div style="' + sty({ padding: "0 16px 14px" }) + '">' +
        '<div style="' + sty({ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 3, marginBottom: 12 }) + '">' +
          [{ id: "percent", label: "% Percent" }, { id: "cash", label: "₹&nbsp; Fixed" }].map(function (opt) {
            const on = type === opt.id;
            return '<button type="button"' + act(o.typeAct, opt.id) + ' style="' + sty({
              flex: 1, padding: "8px 0", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700,
              cursor: "pointer", transition: "background 0.15s, color 0.15s",
              background: on ? BRAND : "transparent", color: on ? "white" : "#6b7280",
              fontFamily: "inherit", letterSpacing: "0.1px",
            }) + '">' + opt.label + "</button>";
          }).join("") +
        "</div>" +
        '<div style="' + sty({ display: "flex", gap: 8, marginBottom: 10 }) + '">' +
          chips.map(function (chip) {
            const on = activeChip === chip;
            return '<button type="button"' + act(o.chipAct, chip) + ' style="' + sty({
              flex: 1, padding: "8px 0", borderRadius: 10,
              border: "1.5px solid " + (on ? BRAND : "#e5e7eb"),
              background: on ? "#e8f3f6" : "white", color: on ? BRAND : "#374151",
              fontSize: 13, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
            }) + '">' + (type === "percent" ? chip + "%" : "₹" + chip) + "</button>";
          }).join("") +
        "</div>" +
        '<div style="' + sty({ position: "relative" }) + '">' +
          '<span style="' + sty({ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#9ca3af", pointerEvents: "none", fontWeight: 500 }) + '">' + (type === "percent" ? "%" : "₹") + "</span>" +
          '<input inputmode="decimal" data-model="' + esc(o.model) + '" value="' + esc(input) + '" placeholder="' + (type === "percent" ? "Or type custom % amount" : "Or type custom ₹ amount") + '" style="' + sty({
            width: "100%", paddingLeft: 30, paddingRight: 14, paddingTop: 11, paddingBottom: 11,
            fontSize: 14, fontWeight: input ? 700 : 400,
            border: "1.5px solid " + (input && !activeChip ? BRAND : "#e5e7eb"),
            borderRadius: 10, outline: "none", background: "white", color: "#111",
            boxSizing: "border-box", fontFamily: "inherit", transition: "border-color 0.15s",
          }) + '" /></div>' +
        (hasDiscount
          ? '<div style="' + sty({ marginTop: 14, paddingTop: 14, borderTop: "1px solid #dcfce7" }) + '">' +
              '<div style="' + sty({ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }) + '">' +
                '<span style="' + sty({ fontSize: 13, color: "#6b7280" }) + '">Subtotal</span>' +
                '<span style="' + sty({ fontSize: 13, color: "#6b7280" }) + '">' + inr(o.subtotal) + "</span></div>" +
              '<div style="' + sty({ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }) + '">' +
                '<span style="' + sty({ fontSize: 13, fontWeight: 600, color: "#16a34a" }) + '">Discount ' +
                  '<span style="' + sty({ fontWeight: 500 }) + '">(' + (type === "cash" ? "₹" + esc(input) : esc(input) + "%") + ")</span></span>" +
                '<span style="' + sty({ fontSize: 13, fontWeight: 700, color: "#16a34a" }) + '">−₹' + savings.toLocaleString("en-IN") + "</span></div>" +
              '<div style="' + sty({ height: 1, background: "#d1fae5", marginBottom: 12 }) + '"></div>' +
              '<div style="' + sty({ display: "flex", justifyContent: "space-between", alignItems: "center" }) + '">' +
                '<span style="' + sty({ fontSize: 15, fontWeight: 700, color: "#111" }) + '">Order Total</span>' +
                '<span style="' + sty({ fontSize: 22, fontWeight: 800, color: "#111" }) + '">' + inr(finalTotal) + "</span></div>" +
            "</div>"
          : "") +
      "</div></div>";
  }

  function DiscountSheet(o) {
    o = o || {};
    const body = OrderDiscountPanel(o) +
      '<div style="' + sty({ padding: "4px 16px 16px" }) + '">' +
        '<button type="button"' + act(o.closeAct) + ' style="' + sty({
          width: "100%", padding: "13px 0", borderRadius: 14, background: BRAND, color: "white",
          border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }) + '">Done</button></div>';
    return sheetShell({ open: o.open, zIndex: 101, closeAct: o.closeAct, body: body, handleMargin: "12px auto 4px" });
  }

  // The strip that sits above a screen's primary CTA: a plain "add discount"
  // target until something is discounted, then a summary of what was saved.
  function DiscountStrip(o) {
    o = o || {};
    const items = o.itemsWithOfferPrices || 0;
    const pct = o.discountPct || 0;
    const hasAny = pct > 0 || items > 0;
    let label = "";
    if (items > 0 && pct > 0) label = "Mixed discounts · saves " + inr(o.totalSavings);
    else if (items > 0) label = items + " offer price" + (items > 1 ? "s" : "") + " · saves " + inr(o.itemOfferSavings);
    else if (pct > 0) label = (o.discountType === "cash" ? "₹" + o.discountInput : o.discountInput + "%") + " off · saves " + inr(o.savings);
    const hint = pct > 0 ? "tap to change" : "tap to add order discount";
    return '<div style="' + sty({
      display: "flex", alignItems: "stretch", borderBottom: "1px solid #f0f0f0", minHeight: 48,
      opacity: o.disabled ? 0.38 : 1, pointerEvents: o.disabled ? "none" : "auto", transition: "opacity 0.2s",
    }) + '">' +
      (hasAny
        ? '<button type="button"' + act(o.openAct) + ' style="' + sty({
            flex: 1, display: "flex", alignItems: "center", gap: 10, background: "none", border: "none",
            cursor: "pointer", padding: "0 0 0 16px", textAlign: "left", fontFamily: "inherit",
          }) + '">' +
            '<span style="' + sty({ fontSize: 18, color: "#16a34a", lineHeight: 1, flexShrink: 0 }) + '">✓</span>' +
            "<div>" +
              '<div style="' + sty({ fontSize: 13, fontWeight: 700, color: "#16a34a", lineHeight: 1.3 }) + '">' + esc(label) + "</div>" +
              '<div style="' + sty({ fontSize: 11, color: "#9ca3af", marginTop: 2 }) + '">' + hint + "</div>" +
            "</div>" +
            '<span style="' + sty({ fontSize: 16, color: "#d1d5db", marginLeft: "auto", marginRight: 8 }) + '">›</span>' +
          "</button>" +
          (pct > 0
            ? '<div style="' + sty({ width: 1, background: "#f0f0f0", alignSelf: "stretch" }) + '"></div>' +
              '<button type="button"' + act(o.clearAct) + ' style="' + sty({ background: "none", border: "none", cursor: "pointer", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }) + '">' +
                '<span style="' + sty({ fontSize: 15, color: "#9ca3af", fontWeight: 700, lineHeight: 1 }) + '">✕</span></button>'
            : "")
        : '<button type="button"' + act(o.openAct) + ' style="' + sty({
            flex: 1, display: "flex", alignItems: "center", gap: 8, background: "none", border: "none",
            cursor: "pointer", padding: "0 16px", fontFamily: "inherit",
          }) + '">' +
            '<span style="' + sty({ width: 28, height: 28, borderRadius: 8, background: "#f0f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: BRAND, flexShrink: 0 }) + '">%</span>' +
            '<span style="' + sty({ fontSize: 13, fontWeight: 600, color: BRAND }) + '">Add order discount</span>' +
            '<span style="' + sty({ fontSize: 16, color: "#d1d5db", marginLeft: "auto" }) + '">›</span>' +
          "</button>") +
    "</div>";
  }

  // ActionsSheet (ui.jsx) — grouped actions in a bottom sheet.
  // groups = [{ label, actions: [{ icon, label, sub, act, arg }] }]
  function ActionsSheet(o) {
    o = o || {};
    const groups = o.groups || [];
    const body =
      '<div style="' + sty({ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 6 }) + '">' +
        '<div style="' + sty({ width: 36, height: 4, borderRadius: 2, background: "#e5e7eb" }) + '"></div></div>' +
      '<div style="' + sty({ padding: "4px 20px 14px", fontSize: 17, fontWeight: 700, color: "#111" }) + '">' + esc(o.title || "More Actions") + "</div>" +
      groups.map(function (g, gi) {
        return "<div>" +
          '<div style="' + sty({
            padding: "6px 20px", fontSize: 11, fontWeight: 700, color: "#9ca3af",
            letterSpacing: "0.6px", textTransform: "uppercase", background: "#f9fafb",
            borderTop: gi === 0 ? "1px solid #f0f0f0" : "none",
          }) + '">' + esc(g.label) + "</div>" +
          (g.actions || []).map(function (a, ai) {
            return '<button type="button"' + act(a.act, a.arg) + ' style="' + sty({
              width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "15px 20px",
              background: "none", border: "none",
              borderBottom: ai < g.actions.length - 1 ? "1px solid #f3f4f6" : "none",
              cursor: "pointer", fontFamily: "inherit", textAlign: "left", WebkitTapHighlightColor: "transparent",
            }) + '">' +
              '<span style="' + sty({ fontSize: 22, lineHeight: 1, flexShrink: 0 }) + '">' + a.icon + "</span>" +
              '<div style="' + sty({ flex: 1, minWidth: 0 }) + '">' +
                '<div style="' + sty({ fontSize: 15, fontWeight: 600, color: "#111" }) + '">' + esc(a.label) + "</div>" +
                (a.sub ? '<div style="' + sty({ fontSize: 12, color: "#888", marginTop: 2 }) + '">' + esc(a.sub) + "</div>" : "") +
              "</div>" +
              '<span style="' + sty({ fontSize: 18, color: "#d1d5db", flexShrink: 0 }) + '">›</span>' +
            "</button>";
          }).join("") +
          (gi < groups.length - 1 ? '<div style="' + sty({ height: 1, background: "#f0f0f0" }) + '"></div>' : "") +
        "</div>";
      }).join("") +
      '<div style="' + sty({ height: 20 }) + '"></div>';
    // The sheet supplies its own handle, so the shared shell's is suppressed.
    const open = !!o.open;
    return '<div' + (o.closeAct ? act(o.closeAct) : "") + ' style="' + sty({
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.42)",
      backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", zIndex: 100,
      opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.25s",
    }) + '"></div>' +
    '<div style="' + sty({
      position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 480, margin: "0 auto",
      background: "white", borderRadius: "20px 20px 0 0", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
      zIndex: 101, transform: open ? "translateY(0)" : "translateY(100%)",
      pointerEvents: open ? "auto" : "none",
      transition: "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }) + '">' + body + "</div>";
  }

  // The inline, editable catalog price on a product row. Two distinct shapes in
  // QA, not one styled two ways: without an offer the pencil is its own small
  // dimmed span after the price; with one set, the price turns indigo at weight
  // 600 with the pencil inline in the text, and gains a "· Offer" tag and a ×
  // that clears it.
  function EditablePrice(o) {
    o = o || {};
    const custom = o.customPrice !== null && o.customPrice !== undefined;
    const INDIGO = "#6366f1";
    if (!custom) {
      return '<span' + act(o.openAct, o.productId) + ' style="' + sty({
        color: "#374151", cursor: "pointer", borderBottom: "1px dashed #a5b4fc", paddingBottom: 1,
      }) + '">₹' + Number(o.catalogPrice).toLocaleString("en-IN") +
        '<span style="' + sty({ fontSize: 10, marginLeft: 3, color: INDIGO, opacity: 0.7 }) + '">✎</span></span>';
    }
    return '<span style="' + sty({ display: "inline-flex", alignItems: "center", gap: 4 }) + '">' +
      '<span' + act(o.openAct, o.productId) + ' style="' + sty({
        color: INDIGO, cursor: "pointer", fontWeight: 600,
        borderBottom: "1px dashed " + INDIGO, paddingBottom: 1,
      }) + '">₹' + Number(o.customPrice).toLocaleString("en-IN") + ' ✎</span>' +
      '<span style="' + sty({ fontSize: 11, color: INDIGO, fontWeight: 500 }) + '">· Offer</span>' +
      (o.resetAct
        ? '<button type="button"' + act(o.resetAct, o.productId) + ' style="' + sty({
            background: "none", border: "none", cursor: "pointer", fontSize: 13,
            color: "#9ca3af", fontWeight: 700, padding: "0 2px", lineHeight: 1, fontFamily: "inherit",
          }) + '">×</button>'
        : "") +
    "</span>";
  }

  // Dims and blocks the screen behind a ConfirmPanel, so the only live controls
  // are the two decision cards.
  // Two shades upstream: the settlement/numeric screens dim to 0.5, the
  // stop-level ones (queue, at-customer, assets, returns, new customer) to 0.45.
  function FreezeBackdrop(opacity) {
    return '<div style="' + sty({ position: "fixed", inset: 0, background: "rgba(0,0,0," + (opacity === undefined ? 0.5 : opacity) + ")", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", zIndex: 40 }) + '"></div>';
  }

  /* ── States ────────────────────────────────────────────────────────────── */

  function EmptyState(icon, title, subtitle) {
    return '<div style="' + sty({ padding: "40px 24px", textAlign: "center" }) + '">' +
      '<div style="' + sty({ fontSize: 36, marginBottom: 12 }) + '">' + icon + "</div>" +
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
    HomeMenuButton: HomeMenuButton, HomeConfirm: HomeConfirm,
    StatusChip: StatusChip, TabBar: TabBar, EmptyState: EmptyState, ErrorState: ErrorState,
    InlineSpinner: InlineSpinner,
    OfferPriceSheet: OfferPriceSheet, DiscountSheet: DiscountSheet,
    OrderDiscountPanel: OrderDiscountPanel, DiscountStrip: DiscountStrip, EditablePrice: EditablePrice,
    ActionsSheet: ActionsSheet,
    SearchInput: SearchInput, StepperInput: StepperInput, NumPad: NumPad,
    SettleRow: SettleRow, CheckItem: CheckItem,
    ConfirmPanel: ConfirmPanel, FreezeBackdrop: FreezeBackdrop,
  };
})();

/* ==========================================================================
   ONBOARDING — five locked screens, nine contextual sheets, one small router.

   Draws O-001's locked UX under the Production UX Contract recorded as D-018.
   ux/FLOW-MAP.md is canonical; nothing here adds to it. The four rules the
   flow was built under are in ../../../VERSION.md, argued in ../../../context/.

     F01 Business profile          S01
     F02 Where your business is    S02   the row opens CONSENT; it reads nothing
     F03 which source?                   a decision, on the screen they are on
     F04 connect this account?           CONSENT SHEET — the read starts here
     F05 which files?                    FILE SHEET
     F06 use a sample business?          SAMPLE CONSENT SHEET
     F07 FoodBridge reads                SYSTEM — cancellable, never a screen
     F08 What we received          S03   CONDITIONAL, two shapes
     F09 try again?                      FAILURE — a cause and a way out
     F10 enough to say anything?         the floor, re-evaluated after each read
     F11 add evidence?                   ADD-EVIDENCE SHEET
     F12 Your business             S04   one dominant message, one action
     F13 start here, or not now?         a decision, on the screen they are on
     F14 into FoodBridge                 SYSTEM — the handoff
     F15 The opportunity           S05   brief -> choose -> prepared
     F16 which shops?                    SHOP SHEET for detail
     F17 repeat a last order?            a fact, offered to the stale seven
     F18 prepare the drafts              SYSTEM — cancellable
     F19 prepare these drafts?           CONFIRM SHEET
     F20 Drafts prepared           S05
     F21 review them now?                DRAFTS SHEET

   ── THE CONTRACT, AND WHERE IT LIVES IN THIS FILE ────────────────────────
     C1  initiation      openSheet() before any read; runOp() only from a
                         named gesture inside it
     C2  progress        runOp() steps carry real record counts as they finish
     C3  cancellation    runOp({onCancel}) — every operation, no exceptions
     C4  failure         fail() — a cause and two ways out, never a dead end
     C5  retry           fail()'s "Try again" re-runs the SAME op from scratch
     C6  provenance      provenanceChip() on every screen after S02; amber for
                         sample, and leaving the sample discards what it made
     C7  persistence     save()/restore() — mode and CONFIRMED drafts only
     C8  navigation      goBack() closes a sheet before it leaves a screen,
                         and asks before discarding unconfirmed work
     C9  completion      drawS05Prepared() reports held / sent / written
     C10 placement       primary screens carry state, decision, action. Every
                         explanation in this file is inside a sheet.

   ── WHAT IS REAL ─────────────────────────────────────────────────────────
     window.SEED              86 products, 40 B2B shops (Miha's)
     window.FB_ORDER_HISTORY  532 orders across 39 of those 40, two years
     window.FB_PREDICT        the back-tested reorder engine
     window.FB_EVIDENCE       the evidence layer
     window.FB_ICONS          the product's lucide icon set

   ── WHAT IS NOT BUILT, AND HOW THIS FLOW SAYS SO ─────────────────────────
   There is no connector. Tally, Zoho and Vyapar are never contacted, so every
   record this flow shows belongs to a DEMONSTRATION business whichever source
   was chosen — and the consent sheet says that BEFORE the user commits, an
   amber chip names it on every screen from S03 on, and that chip opens a sheet
   explaining it. Nothing here claims a connection, an export, a lookup or a
   send that did not happen.

   Document reading is not built either: it reports that it read nothing,
   inside the sheet the user opened, and says plainly that it will not succeed
   for any file. The GSTIN check validates FORMAT and claims only that.

   Drafts are real in the browser: prepared, held, editable, and reachable
   afterwards at #/sales-orders/order-drafts. Sent to nobody, written nowhere.
   Declared in ../../../VERSION.md and ../../../context/STATUS.md.

   Nothing here invents a result to cover for a boundary: when documents are
   offered, the flow reports that nothing could be read rather than producing
   a figure. Receivables, collections, overdue value, capital tied and margin
   have no evidence for this tenant and are ABSENT — not zeroed, not greyed.
   ========================================================================== */

(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /* The product's own icon set, plus a few drawn to the same lucide
     conventions it documents — 24x24, stroke 2, round caps, no fill. */
  const I = window.FB_ICONS || {};
  const lu = (d, size) =>
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + (size || 20) + '" height="' + (size || 20) +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";

  const ICON = {
    building: lu('<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/>'),
    user: lu('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    phone: lu('<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>'),
    mail: lu('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'),
    badge: lu('<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>'),
    chev: lu('<path d="m9 18 6-6-6-6"/>', 18),
    back: lu('<path d="m15 18-6-6 6-6"/>', 22),
    close: lu('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 20),
    check: lu('<path d="M20 6 9 17l-5-5"/>', 18),
    checkBig: lu('<path d="M20 6 9 17l-5-5"/>', 30),
    plug: lu('<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>'),
    shield: lu('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z"/>', 18),
    lock: lu('<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 18),
    flask: lu('<path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/>', 20),
    /* One mark per source, so the list reads as real choices rather than four
       rows of the same glyph. UI tints and generic marks — no third-party
       logo is reproduced. */
    db: lu('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>', 22),
    cloud: lu('<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>', 22),
    store: lu('<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/>', 22),
    doc: lu('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M10 13h4"/><path d="M10 17h4"/>', 22),
    files: lu('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/>'),
    upload: lu('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>', 16),
    camera: lu('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z"/><circle cx="12" cy="13" r="3"/>', 16),
    plusCircle: lu('<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>', 18),
    alert: lu('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>', 18),
    clock: lu('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', 18),
    repeat: lu('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>', 18),
    box: I.Package ? null : lu('<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'),
  };
  const iconProducts = I.Package || ICON.box;
  const iconCustomers = I.Users || ICON.user;
  const iconOrders = I.ShoppingCart || ICON.files;
  const iconChart = I.LineChart || ICON.badge;

  /* SESSION FLAG, not a product path. `?evidence=none` withholds this
     tenant's real order history so the BELOW-FLOOR shape of S03 can be walked
     in a customer session. It REMOVES real data and never adds fake data, and
     it is not how sample mode is reached — D-018 rejected a hidden flag for
     that, because the person who most needs to know they are in a sample is
     the one who cannot see a URL. */
  const WITHHOLD = new URLSearchParams(location.search).get("evidence") === "none";

  /* Onboarding is Steps 1-3. S04 and S05 are activation and carry no counter
     (D-018) — a progress bar that never completes is a promise we break. */
  const STEPS = { S01: 0, S02: 1, S03: 2 };
  const STORE_KEY = "fb.v7.onboarding";

  /* This build is a PREVIEW. No connector is implemented, so every record the
     flow shows is demonstration data whichever source was chosen. `mode`
     records how the user got here so the chip can name it, and BOTH values are
     labelled as demonstration — there is no mode in which this page may claim
     it read a customer's own books. */
  const state = {
    screen: "S01",
    view: "flow",          // "flow" | "drafts"  — the drafts destination
    profile: { business: "", gstin: "" },
    /* GSTIN verification is bound to a VALUE, never to a moment. `gstVerifiedFor`
       is the exact string the provider was asked about and `gstResult` is what it
       answered. Edit the field and the badge goes, because that string has not
       been verified; edit it back and the answer returns from here without a
       second lookup. `gstPhase` is only ever transient UI. */
    gstVerifiedFor: "",
    gstResult: null,       // { found, legalName?, tradeName?, status? }
    gstPhase: "idle",      // idle | verifying | invalid | notfound | failed
    gstSeq: 0,             // guards against a slow reply for an edited value
    mode: null,            // null | "demo" | "sample"      (C6)
    source: null,          // the chosen source; set ONLY on a completed read
    ingested: null,        // what a read actually produced; null until one runs
    model: null,
    opp: null,
    parked: false,         // "Not now" — the opportunity is kept, not dropped
    stage: "brief",        // S05: brief | choose | prepared
    picked: {},            // shop id -> selected. NOTHING is pre-selected
    repeats: {},           // stale shop id -> repeat their last order
    drafts: null,          // CONFIRMED drafts. Persisted (C7)
    undo: null,            // {drafts, label} — one step back from a discard
    showAll: false,
    showAllStale: false,
    sheet: null,           // the open sheet, or null
    op: null,              // the running operation, or null
  };

  /* Every source in this preview yields the same demonstration records. The
     chip, the consent sheet and the provenance block all say so. */
  function originLabel() {
    if (state.mode === "sample") return "Sample business";
    if (state.mode === "demo") {
      return ((state.source && state.source.label) || "Preview") + " \u00b7 demo data";
    }
    return "";
  }

  /* ------------------------------------------------------- C7 persistence */

  /* Mode and CONFIRMED drafts only. An unconfirmed selection is deliberately
     not persisted: resurrecting a choice somebody abandoned is the reload
     behaving as if they had agreed to it. */
  function save() {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({
        mode: state.mode,
        source: state.source ? { id: state.source.id, label: state.source.label } : null,
        profile: state.profile,
        gstVerifiedFor: state.gstVerifiedFor,
        gstResult: state.gstResult,
        parked: state.parked,
        drafts: state.drafts,
      }));
    } catch (e) { /* private mode, blocked storage: the flow still works */ }
  }

  /* The drafts destination and the flow are two views of ONE record. Anything
     that changes drafts writes through here so the other view is never stale. */
  function readStore() {
    try {
      const raw = sessionStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function restore() {
    let raw = null;
    try { raw = sessionStorage.getItem(STORE_KEY); } catch (e) { return false; }
    if (!raw) return false;
    let v;
    try { v = JSON.parse(raw); } catch (e) { return false; }
    if (!v) return false;

    /* What the user TYPED survives a reload whether or not they got as far as
       choosing a source. Restoring it is not the same as resuming the flow:
       the screen logic below still turns on `mode`, so an unfinished S01 comes
       back filled in, on S01, rather than jumping somewhere it never reached. */
    state.profile = v.profile || state.profile;
    state.gstVerifiedFor = v.gstVerifiedFor || "";
    state.gstResult = v.gstResult || null;

    if (!v.mode) return false;                  // nothing was ingested yet

    state.mode = v.mode;
    state.source = v.source || null;
    state.parked = !!v.parked;
    state.ingested = true;
    state.model = buildModel();
    if (v.drafts && v.drafts.list && v.drafts.list.length) {
      state.drafts = v.drafts;
      state.opp = buildOpportunity();
      state.stage = "prepared";
      state.screen = "S05";
    } else {
      state.screen = state.model.floor.met ? "S04" : "S03";
    }
    return true;
  }

  function forget() {
    try { sessionStorage.removeItem(STORE_KEY); } catch (e) { /* as above */ }
  }

  /* ---------------------------------------------------------------- data */

  /* The model is built from what has actually been INGESTED, never from what
     happens to be loaded in the page. Before any read has run there is no
     model at all, which is what stops S03 and S04 from being reachable by a
     stray call. */
  function historyNow() {
    if (!state.ingested) return {};
    /* WITHHOLD models a business whose OWN source yields nothing, which is what
       the below-floor shape is for. It must not also empty the sample: the
       sample is the forward path offered from below the floor, and a forward
       path that lands back on the same screen is the loop NN11 exists to
       remove. Choosing the sample is an explicit request for the
       demonstration records, in every session. */
    if (WITHHOLD && state.mode !== "sample") return {};
    return window.FB_ORDER_HISTORY || {};
  }

  function buildModel() {
    return window.FB_EVIDENCE.build({
      seed: window.SEED || {},
      history: historyNow(),
      predict: window.FB_PREDICT,
    });
  }

  function buildOpportunity() {
    return window.FB_EVIDENCE.missedOrders({
      seed: window.SEED,
      history: historyNow(),
      predict: window.FB_PREDICT,
    });
  }

  /* S04's supporting rows are decided by the evidence, never fixed in the
     markup. A signal with a count of zero is not drawn: there is nothing to
     act on, and a "0" reads as a broken row rather than as good news. */
  /* S04's supporting rows are decided by the evidence, never fixed in the
     markup.

     NN13 — "N shops ready for a reorder" is GONE. It was a second shop count
     (32) beside the headline's (23), worded almost identically, derived
     differently, and it supported no decision the screen was asking for. What
     remains is a different dimension, not a rival count: stock, which bears
     directly on whether a reorder can actually be filled. */
  function supportingSignals(m) {
    const s = m.signals || {};
    const out = [];
    if (s.stock_position && s.stock_position.outOfStock > 0) {
      out.push({ id: "stock_position", icon: iconProducts,
        label: s.stock_position.outOfStock + " of " + s.stock_position.catalogue + " products are out of stock",
        n: s.stock_position.outOfStock, of: s.stock_position.catalogue });
    }
    return out;
  }

  /* ------------------------------------------------------------ plumbing */

  /* A re-render is not a navigation. Opening a sheet, ticking a shop and
     editing a quantity all go through render(), and scrolling the page to the
     top on each of those threw the user back to the first of sixteen shops
     every time they tapped one to look at it. The page only returns to the top
     when the SCREEN actually changes. */
  let lastPlace = null;
  function render(html) {
    const place = state.view + "/" + state.screen + "/" + (state.screen === "S05" ? state.stage : "");
    const moved = place !== lastPlace;
    const keep = window.scrollY;
    $("#ob-root").innerHTML = html + sheetHtml();
    if (moved) { lastPlace = place; window.scrollTo(0, 0); }
    else if (window.scrollY !== keep) { window.scrollTo(0, keep); }
    bindSheet();
    /* Chrome controls are bound in ONE place. Binding them per screen is how
       the provenance chip ended up inert on every screen that forgot to. */
    const back = $("#b-back");
    if (back) back.addEventListener("click", goBack);
    const prov = $("#b-prov");
    if (prov) prov.addEventListener("click", openProvenanceSheet);
    applyScrollLock();
  }

  function go(screen) { state.screen = screen; draw(); }

  /* C6 — provenance, on every screen after S02, and never ambiguous. Amber
     for a sample, neutral for the user's own connected data. */
  /* C6 — provenance, on every screen after S02, and never ambiguous. There is
     no "connected" state in this preview because nothing connects: both modes
     are demonstration data and the chip says which one. It is always a button,
     because the one question it raises — "whose data am I looking at?" — has an
     answer, and that answer belongs in a sheet. */
  function provenanceChip() {
    const label = originLabel();
    if (!label) return "";
    return '<button class="ob-prov is-demo" id="b-prov">' + ICON.flask +
           "<span>" + esc(label) + "</span></button>";
  }

  /* SHEET — what the chip means. Opened from the chip on every screen. */
  function openProvenanceSheet() {
    const src = state.source && state.source.label;
    openSheet({
      title: "Where this data comes from",
      body:
        '<div class="ob-provdemo">' + ICON.flask + "<span>DEMONSTRATION DATA</span></div>" +
        '<p class="ob-sheet-p">' +
          (state.mode === "sample"
            ? "You chose to explore with a sample business. Every record here belongs to that demonstration business."
            : "FoodBridge cannot read " + esc(src || "that source") + " yet. You are looking at a " +
              "demonstration business so you can see what FoodBridge would do — not records from " +
              esc(src || "your account") + ".") +
        "</p>" +
        '<p class="ob-sheet-eyebrow">' + ICON.lock + "WHAT THIS MEANS</p>" +
        '<ul class="ob-sheet-ul">' +
          "<li>Nothing was read from your account</li>" +
          "<li>Nothing is written anywhere</li>" +
          "<li>This marker stays on every screen</li>" +
        "</ul>",
      actions: '<button class="ob-cta ob-ghost" id="s-close">Close</button>' +
               '<button class="ob-skip" id="s-leave">Start over with a different source</button>',
      bind: function () {
        $("#s-close").addEventListener("click", closeSheet);
        $("#s-leave").addEventListener("click", function () {
          state.sheet = null;
          /* From the drafts destination this has to go back to the flow, not
             re-render the destination it was opened from — draw() dispatches on
             `view` before it looks at `screen`. */
          if (state.view === "drafts") {
            leaveData(function () { handoff("onboarding"); });
            return;
          }
          leaveData(function () { state.screen = "S02"; draw(); });
        });
      },
    });
  }

  function chrome(screen, opts) {
    const o = opts || {};
    const i = STEPS[screen];
    /* S01 asks the user to describe their own business. Which source the flow
       later read, or that it is demonstration data, is not true yet and is not
       this screen's subject — so the chip is suppressed here unconditionally,
       not merely absent on a first pass. Navigating BACK to S01 used to bring
       it with you. */
    const chip = screen === "S01" ? "" : provenanceChip();
    let steps = "";
    if (i !== undefined) {
      let bars = "";
      for (let k = 0; k < 3; k++) bars += '<i class="' + (k <= i ? "on" : "") + '"></i>';
      /* The counter is scoped to SETUP. S04 and S05 are activation and carry
         none: a bar that says "3 of 3" and is followed by two more screens is
         a promise the flow breaks. Naming the phase keeps it honest. */
      steps = '<span class="ob-brand-sep"></span><span class="ob-brand-step">Setup &#183; ' + (i + 1) + " of 3</span>";
      steps += '</header><div class="ob-prog">' + bars + "</div>";
    } else {
      steps = "</header>";
    }
    return '<header class="ob-brand">' +
             '<span class="ob-word">Food<em>Bridge</em></span>' + steps +
           (o.back || chip
             ? '<div class="ob-navrow">' +
               (o.back ? '<button class="ob-back" id="b-back" aria-label="Back">' + ICON.back + "</button>" : "<span></span>") +
               chip + "</div>"
             : "");
  }

  /* F14 — into FoodBridge. The handoff is to a destination that already
     exists; onboarding does not reimplement the field tool. */
  function handoff(route) {
    try {
      if (window.top && window.top !== window.self) { window.top.location.hash = "#/" + route; return; }
    } catch (e) { /* cross-origin parent: fall through */ }
    window.location.href = "../../../index.html#/" + route;
  }

  /* ----------------------------------------------------------- C10 sheets */

  /* ONE sheet component, nine uses. A sheet is opened from a decision the
     user is already making, returns to where it was opened from, and closes
     on back, on Escape and on the backdrop. It is never a screen: the screen
     underneath keeps its state and is not re-rendered. */
  function openSheet(spec) { state.sheet = spec; draw(); }

  function closeSheet() {
    if (state.sheet && state.sheet.onClose) state.sheet.onClose();
    state.sheet = null;
    draw();
  }

  /* A sheet covers the screen, so the screen must stop scrolling under it.
     Without this, dragging anywhere on the scrim scrolls the page behind —
     the sheet stays put and the thing it was opened from slides away. The
     scroll offset is held on the body so nothing jumps when it is released. */
  let lockedAt = 0;
  function applyScrollLock() {
    const want = !!state.sheet;
    const on = document.body.classList.contains("ob-locked");
    if (want === on) return;
    if (want) {
      lockedAt = window.scrollY;
      document.body.style.top = -lockedAt + "px";
      document.body.classList.add("ob-locked");
    } else {
      document.body.classList.remove("ob-locked");
      document.body.style.top = "";
      window.scrollTo(0, lockedAt);
    }
  }

  function sheetHtml() {
    const s = state.sheet;
    if (!s) return "";
    return '<div class="ob-scrim" id="ob-scrim"></div>' +
      '<section class="ob-sheet" role="dialog" aria-modal="true" aria-label="' + esc(s.title) + '">' +
        '<div class="ob-sheet-grip"></div>' +
        '<header class="ob-sheet-h">' +
          "<h2>" + esc(s.title) + "</h2>" +
          (s.count != null ? '<span class="ob-sheet-n">' + esc(s.count) + "</span>" : "") +
          '<button class="ob-sheet-x" id="ob-sheet-x" aria-label="Close">' + ICON.close + "</button>" +
        "</header>" +
        '<div class="ob-sheet-b">' + s.body + "</div>" +
        (s.actions ? '<footer class="ob-sheet-f">' + s.actions + "</footer>" : "") +
      "</section>";
  }

  function bindSheet() {
    if (!state.sheet) return;
    const x = $("#ob-sheet-x"), sc = $("#ob-scrim");
    if (x) x.addEventListener("click", closeSheet);
    if (sc) sc.addEventListener("click", closeSheet);
    if (state.sheet.bind) state.sheet.bind();
  }

  /* C8 — back closes a sheet before it leaves a screen. */
  function goBack() {
    if (state.sheet) { closeSheet(); return; }
    if (state.view === "drafts") return;
    if (state.screen === "S02") { go("S01"); return; }
    if (state.screen === "S03") { leaveData(function () { state.screen = "S02"; draw(); }); return; }
    if (state.screen === "S04") { leaveData(function () { state.screen = "S03"; draw(); }); return; }
    if (state.screen === "S05") {
      if (state.stage === "choose") { confirmLeaveSelection(function () { state.stage = "brief"; draw(); }); return; }
      if (state.stage === "prepared") { state.screen = "S04"; draw(); return; }
      go("S04");
    }
  }

  /* C6 — leaving a sample discards what was derived from it, and says so
     BEFORE it happens. A silent switch either way is the failure this
     clause exists to prevent. */
  function leaveData(then) {
    if (state.mode !== "sample") { then(); return; }
    openSheet({
      title: "Leave the sample business?",
      body: '<p class="ob-sheet-p">Everything you are looking at came from the sample. ' +
            "Leaving discards it.</p>" +
            '<ul class="ob-sheet-ul"><li>The sample records are cleared</li>' +
            "<li>Nothing of your own has been touched" +
            (state.drafts ? "</li><li>" + state.drafts.list.length + " prepared drafts are discarded" : "") +
            "</li></ul>",
      actions: '<button class="ob-cta is-warn" id="s-leave">Leave the sample</button>' +
               '<button class="ob-skip" id="s-stay">Stay</button>',
      bind: function () {
        $("#s-leave").addEventListener("click", function () {
          state.mode = null; state.source = null; state.ingested = null;
          state.model = null; state.opp = null; state.drafts = null;
          state.picked = {}; state.repeats = {}; state.stage = "brief";
          state.parked = false; state.undo = null; state.draftEdit = null;
          state.showAll = false; state.showAllStale = false;
          forget();
          state.sheet = null;
          state.screen = "S02";
          draw();
        });
        $("#s-stay").addEventListener("click", closeSheet);
      },
    });
  }

  function confirmLeaveSelection(then) {
    if (!pickedCount() && !repeatCount()) { then(); return; }
    openSheet({
      title: "Discard your selection?",
      body: '<p class="ob-sheet-p">' + (pickedCount() + repeatCount()) +
            " shops are selected and no drafts have been prepared yet.</p>",
      actions: '<button class="ob-cta is-warn" id="s-drop">Discard</button>' +
               '<button class="ob-skip" id="s-keep">Keep choosing</button>',
      bind: function () {
        $("#s-drop").addEventListener("click", function () {
          state.picked = {}; state.repeats = {}; state.sheet = null; then();
        });
        $("#s-keep").addEventListener("click", closeSheet);
      },
    });
  }

  /* ------------------------------------------ C1-C5 the operation runner */

  /* Every consequential operation in this flow goes through here, and there
     is no other path to one. It cannot start without a caller, it shows what
     it is doing from real counts as each step finishes, it can be stopped at
     any point, and stopping it keeps nothing. */
  function runOp(spec) {
    state.op = { spec: spec, i: 0, timer: null, done: [], cancelled: false };
    state.sheet = null;
    drawOp();
    tick();
  }

  function tick() {
    const op = state.op;
    if (!op || op.cancelled) return;
    const steps = op.spec.steps;
    if (op.i > 0) op.done.push(steps[op.i - 1]);
    if (op.i >= steps.length) {
      state.op = null;
      op.spec.onDone();
      return;
    }
    op.i += 1;
    drawOp();
    op.timer = setTimeout(tick, 850);
  }

  function cancelOp() {
    const op = state.op;
    if (!op) return;
    op.cancelled = true;
    if (op.timer) clearTimeout(op.timer);
    state.op = null;
    /* Nothing is kept. An operation stopped halfway has produced nothing the
       user agreed to, so it produces nothing at all. */
    op.spec.onCancel();
  }

  function drawOp() {
    const op = state.op;
    if (!op) return;
    const steps = op.spec.steps;
    render(
      chrome(state.screen) +
      '<main class="ob-main ob-main-op">' +
        '<h1 class="ob-h1">' + esc(op.spec.title) + "</h1>" +
        '<div class="ob-proc">' +
          steps.map(function (st, i) {
            const done = i < op.i - 1, active = i === op.i - 1;
            return '<div class="ob-pstep ' + (done ? "is-done" : active ? "is-active" : "") + '">' +
              '<span class="ob-pdot">' + (done ? ICON.check : active ? '<span class="ob-spin"></span>' : "") + "</span>" +
              '<span class="ob-pt">' + esc(st.label) + "</span>" +
              /* C2 — what it FOUND, from real record counts, the moment it
                 finishes. A step that completes with nothing to show says so
                 rather than leaving a tick to imply a result. */
              (done ? '<span class="ob-pv">' + esc(st.found || "nothing") + "</span>" : "") +
            "</div>";
          }).join("") +
        "</div>" +
      "</main>" +
      '<footer class="ob-foot"><button class="ob-skip" id="b-cancel">Cancel</button></footer>'
    );
    $("#b-cancel").addEventListener("click", cancelOp);
  }

  /* C4 — a failure is a state with a cause and a way out. Both of this flow's
     failures (documents, and add-evidence) now report INSIDE the sheet the
     user opened, so the screen they were on is never destroyed by one. There
     is no longer a full-screen failure state, and nothing falls through into
     a success screen. See documentsFailed() and openGapSheet().               */

  /* ------------------------------------------------------------- S01 */

  /* One row inside a grouped field set. The label sits above the value so a
     filled field still says what it is — which is also why only GSTIN
     carries a placeholder: its format is the one thing a label cannot say. */
  function row(id, label, icon, value, extra) {
    const e = extra || {};
    return '<div class="ob-fr' + (e.ok ? " is-ok" : "") + '">' + icon +
      '<span class="ob-fr-main"><label for="' + id + '">' + esc(label) + "</label>" +
      '<input id="' + id + '" value="' + esc(value) + '" placeholder="' + esc(e.ph || "") + '"' +
        (e.type ? ' inputmode="' + e.type + '"' : "") +
        (e.locked ? " disabled" : "") +
        (e.max ? ' maxlength="' + e.max + '"' : "") +
        /* Never autocorrect what the user is telling us their business is
           called. iOS turned "Miha Foods" into "Mina Foods" on the way in,
           and nothing downstream could know it had been changed. */
        ' autocorrect="off" spellcheck="false"' +
        ' autocapitalize="' + (e.caps ? "characters" : "words") + '"' +
        (e.enter ? ' enterkeyhint="' + e.enter + '"' : "") + "></span>" +
      (e.trail || "") +
    "</div>";
  }

  /* ── S01 · GSTIN verification ─────────────────────────────────────────────
     The Verify action is a REAL external lookup through this repo's own bridge.
     The browser never holds the provider credential and never calls the
     provider: it asks `/api/gstin`, which authenticates server-side and returns
     only what the register actually said.

     The local grammar test below exists for ONE reason — so a malformed number
     can be reported as malformed without spending a paid lookup on it, and so
     "your number is wrong" stays a different sentence from "we could not
     check". Passing it is never reported as verification. */
  const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  function gstValue() { return state.profile.gstin.trim().toUpperCase(); }

  /* Verified ⟺ the CURRENT value is the one the provider was asked about and
     the answer was yes. Nothing else can produce this. */
  function gstVerified() {
    const g = gstValue();
    return !!g && g === state.gstVerifiedFor && !!state.gstResult && state.gstResult.found === true;
  }
  function gstActive() {
    return !!state.gstResult && String(state.gstResult.status || "").toLowerCase() === "active";
  }

  /* A verdict belongs to ONE value. A failure while looking up a different
     number must not evict a good answer already held for this one, or the user
     pays for a second lookup just because they typo'd in between. */
  function forgetVerdictFor(g) {
    if (state.gstVerifiedFor === g) {
      state.gstVerifiedFor = "";
      state.gstResult = null;
    }
  }

  function apiBase() {
    const cfg = window.FB_INTEGRATION || {};
    return String(cfg.apiBaseUrl || "").replace(/\/+$/, "");
  }

  /* SYSTEM · the lookup. Cancellable only in the sense that a reply for a value
     the user has since edited is discarded — `gstSeq` is the guard. */
  function verifyGstin() {
    const g = gstValue();
    if (state.gstPhase === "verifying") return;          // one in flight, no queue

    if (!GSTIN_RE.test(g)) {                              // local gate, no network
      state.gstPhase = "invalid";
      forgetVerdictFor(g);
      return drawS01();
    }

    const seq = ++state.gstSeq;
    state.gstPhase = "verifying";
    drawS01({ keepFocus: "f-gstin" });

    const cfg = window.FB_INTEGRATION || {};
    const url = apiBase() + "/api/gstin?gstin=" + encodeURIComponent(g);

    fetch(url, { headers: cfg.apiKey ? { "X-FB-Key": cfg.apiKey } : {} })
      .then(function (r) {
        return r.json()
          .catch(function () { return {}; })        // a 404 page is not JSON
          .then(function (b) { return { ok: r.ok, status: r.status, body: b }; });
      })
      .then(function (out) {
        if (seq !== state.gstSeq || gstValue() !== g) return;   // value moved on
        const b = out.body || {};
        if (out.ok && b.found === true) {
          state.gstResult = b;
          state.gstVerifiedFor = g;
          state.gstPhase = "idle";
        } else if (out.ok && b.found === false) {
          forgetVerdictFor(g);
          state.gstPhase = "notfound";
        } else if (b.error === "invalid_gstin") {
          forgetVerdictFor(g);
          state.gstPhase = "invalid";
        } else {
          /* Every other reply — auth rejected, provider down, timeout, and the
             bridge's own not_configured — is a failure to CHECK. It is never
             reported as a verdict about the number.

             The user sees one honest sentence, because to them the three are
             the same thing. A developer needs to tell them apart, so the real
             reason goes to the console rather than onto the screen. */
          forgetVerdictFor(g);
          state.gstPhase = "failed";
          whyUnchecked(b.error || ("http_" + (out.status || "?")), b.message, url);
        }
        save();
        drawS01();
      })
      .catch(function (err) {
        if (seq !== state.gstSeq || gstValue() !== g) return;
        forgetVerdictFor(g);
        state.gstPhase = "failed";
        /* Unreachable — almost always that the bridge is not running, which is
           invisible from the screen and expensive to work out from a trace. */
        whyUnchecked("unreachable", err && err.message, url);
        save();
        drawS01();
      });
  }

  /* Why the check did not happen — for whoever is building this, not for the
     person filling the form. Named causes, and the one-line fix for the two
     that are almost always it. */
  function whyUnchecked(reason, detail, url) {
    const fix = {
      unreachable:
        "The bridge is not answering. Start it:  cd zoho-function && npm run dev\n" +
        "  Or point this page at another one with  ?fbapi=<base-url>",
      not_configured:
        "The bridge is running but holds no GST credential.\n" +
        "  Set GST_API_KEY and GST_API_SECRET in zoho-function/.env",
      upstream_auth:
        "The GST provider rejected the credential. Check GST_API_KEY / GST_API_SECRET.",
      http_404:
        "The bridge answered but has no /api/gstin — probably an older deploy.",
    }[reason];
    console.error(
      "[FoodBridge] GSTIN not checked — " + reason +
      (detail ? ": " + detail : "") + "\n  asked: " + url +
      (fix ? "\n  " + fix : "")
    );
  }

  /* The block under the card. One at a time, and only ever the fields the
     provider actually returned. */
  function gstResultBlock() {
    if (gstVerified()) {
      const r = state.gstResult;
      return '<div class="ob-gst ' + (gstActive() ? "is-ok" : "is-warn") + '" role="status" aria-live="polite">' +
        '<p class="ob-gst-h">' + ICON.check + "Business found</p>" +
        (r.legalName ? '<p class="ob-gst-legal">' + esc(r.legalName) + "</p>" : "") +
        (r.tradeName ? '<p class="ob-gst-r">Trade name: ' + esc(r.tradeName) + "</p>" : "") +
        (r.status ? '<p class="ob-gst-r">Status: ' + esc(r.status) + "</p>" : "") +
        (r.status && !gstActive()
          ? '<p class="ob-gst-note">This GSTIN is not currently active.</p>' : "") +
      "</div>";
    }
    if (state.gstPhase === "notfound") {
      return '<div class="ob-gst is-warn" role="status" aria-live="polite">' +
        '<p class="ob-gst-h">' + ICON.alert + "No business registered under this GSTIN</p>" +
        '<p class="ob-gst-r">Check the number, or continue without it.</p>' +
        '<button class="ob-gst-retry" id="b-gst-retry">Try again</button></div>';
    }
    if (state.gstPhase === "invalid") {
      return '<div class="ob-gst is-warn" role="status" aria-live="polite">' +
        '<p class="ob-gst-h">' + ICON.alert + "That is not a valid GSTIN format</p>" +
        '<p class="ob-gst-r">A GSTIN is 15 characters: 2 digits, 5 letters, ' +
          "4 digits, then 4 more.</p></div>";
    }
    if (state.gstPhase === "failed") {
      return '<div class="ob-gst is-warn" role="status" aria-live="polite">' +
        '<p class="ob-gst-h">' + ICON.alert + "Couldn't reach the GST service</p>" +
        '<p class="ob-gst-r">Nothing is wrong with your GSTIN — we just couldn\'t ' +
          "check it. You can continue without it.</p>" +
        '<button class="ob-gst-retry" id="b-gst-retry">Try again</button></div>';
    }
    return "";
  }

  function drawS01(opts) {
    const o = opts || {};
    const p = state.profile;
    const ok = gstVerified();
    const g = p.gstin.trim();
    const busy = state.gstPhase === "verifying";

    const trail = ok
      ? '<span class="ob-fr-ok">' + ICON.check + "</span>"
      : busy
        ? '<span class="ob-verify is-busy" aria-live="polite">' +
            '<span class="ob-spin"></span>Verifying…</span>'
        : '<button class="ob-verify" id="b-verify"' + (g.length === 15 ? "" : " disabled") +
            ">Verify</button>";

    render(
      chrome("S01") +
      '<main class="ob-main">' +
        '<h1 class="ob-h1">Tell FoodBridge about your business</h1>' +

        /* MUST-HAVE ONLY. Two fields, because the business is what this screen
           is about. No provenance, no sample state, no contact rows, and no
           sentence explaining what any of it is for. */
        '<section class="ob-section">' +
          '<div class="ob-fs">' +
            row("f-business", "Business name", ICON.building, p.business, { enter: "next" }) +
            row("f-gstin", "GSTIN (optional)", ICON.badge, p.gstin,
                { caps: true, ok: ok, ph: "15-character GSTIN", trail: trail,
                  enter: "done", max: 15 }) +
          "</div>" +
          gstResultBlock() +
        "</section>" +
      "</main>" +
      /* Continue is gated on the business name and nothing else. No GSTIN
         outcome — verified, not found, malformed, unreachable or untried —
         can block it. */
      '<footer class="ob-foot"><button class="ob-cta" id="b-continue"' +
        (p.business.trim() ? "" : " disabled") + ">" +
        (p.business.trim() ? "Continue" : "Enter your business name") + "</button></footer>"
    );

    ["business", "gstin"].forEach(function (k) {
      const el = $("#f-" + k);
      if (!el) return;
      el.addEventListener("input", function () {
        const before = state.profile[k];
        state.profile[k] = el.value;
        if (k === "gstin") {
          /* Any change abandons the previous verdict for display purposes.
             `gstVerifiedFor`/`gstResult` are NOT cleared, so editing back to
             the verified value restores it without another lookup. */
          state.gstPhase = "idle";
          state.gstSeq += 1;
          save();
          const caret = el.selectionStart;
          drawS01();
          const again = $("#f-gstin");
          if (again) { again.focus(); try { again.setSelectionRange(caret, caret); } catch (e) {} }
          return;
        }
        save();
        if (!before.trim() !== !el.value.trim()) {     // the CTA changes state
          const caret = el.selectionStart;
          drawS01();
          const again = $("#f-business");
          if (again) { again.focus(); try { again.setSelectionRange(caret, caret); } catch (e) {} }
        }
      });
      if (k === "gstin") {
        el.addEventListener("keydown", function (e) {
          if (e.key === "Enter" && el.value.trim().length === 15) { e.preventDefault(); verifyGstin(); }
        });
      }
    });

    const vb = $("#b-verify");
    if (vb) vb.addEventListener("click", verifyGstin);
    const rb = $("#b-gst-retry");
    if (rb) rb.addEventListener("click", verifyGstin);

    /* The keyboard must not close because the screen re-rendered underneath
       it — the field keeps focus across the idle → verifying redraw. */
    if (o.keepFocus) {
      const f = $("#" + o.keepFocus);
      if (f) { const n = f.value.length; f.focus(); try { f.setSelectionRange(n, n); } catch (e) {} }
    }

    const c = $("#b-continue");
    if (c) c.addEventListener("click", function () {
      if (!state.profile.business.trim()) return;
      save();
      go("S02");
    });
  }

  /* ------------------------------------------------------------- S02 */

  const SOURCES = [
    { id: "tally", label: "Tally", kind: "connect", icon: ICON.db, tint: "t-indigo" },
    { id: "zoho", label: "Zoho", kind: "connect", icon: ICON.cloud, tint: "t-rose" },
    { id: "vyapar", label: "Vyapar", kind: "connect", icon: ICON.store, tint: "t-blue" },
    { id: "files", label: "Files or documents", kind: "files", icon: ICON.doc, tint: "t-green" },
  ];

  function drawS02() {
    /* If a read has already produced something, this screen must say so and
       offer the way back to it. Without that, a user who reached S02 from a
       failure or from Back could only return to their own data by running a
       read again — the one thing they had already done. */
    const loaded = !!state.ingested;
    const here = state.mode === "sample" ? "sample" : (state.source && state.source.id);

    render(
      chrome("S02", { back: true }) +
      '<main class="ob-main">' +
        '<h1 class="ob-h1">Where is your business data today?</h1>' +
        '<div class="ob-sources">' +
          SOURCES.map(function (s) {
            const on = here === s.id;
            return '<button class="ob-source' + (on ? " is-on" : "") + '" data-src="' + s.id + '">' +
              '<span class="ob-mark ' + s.tint + '">' + s.icon + "</span>" +
              '<span class="ob-source-t">' + esc(s.label) + "</span>" +
              (on ? '<span class="ob-source-on">' + ICON.check + "in use</span>" : "") +
              '<span class="ob-chev">' + ICON.chev + "</span></button>";
          }).join("") +
        "</div>" +
        /* A first-class answer to the same question, quieter so it never
           competes with the four real sources (D-018). */
        '<button class="ob-samplerow' + (here === "sample" ? " is-on" : "") + '" id="b-sample">' +
          "<span>Show me with a sample business</span>" +
          (here === "sample" ? '<span class="ob-source-on">' + ICON.check + "in use</span>" : "") +
          '<span class="ob-chev">' + ICON.chev + "</span></button>" +
      "</main>" +
      (loaded
        ? '<footer class="ob-foot"><button class="ob-cta" id="b-seen">See what we received</button></footer>'
        : "")
    );
    const seen = $("#b-seen");
    if (seen) seen.addEventListener("click", function () { go("S03"); });
    $$("[data-src]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const src = SOURCES.filter(function (s) { return s.id === btn.dataset.src; })[0];
        /* NN2 — opening a sheet chooses NOTHING. `state.source` is written in
           the operation's onDone and nowhere else, so a cancelled or failed
           attempt cannot leave the chip claiming a source. */
        if (src.kind === "files") return openFileSheet(src);
        openConsentSheet(src);
      });
    });
    $("#b-sample").addEventListener("click", openSampleSheet);
  }

  /* SHEET 1 — F04, consent. C1: the tap opened this; nothing has been read.
     The user starts the read, here, by name.

     NN1 — the boundary is stated BEFORE the user commits, in the product's own
     words, not in a footnote. This preview cannot read Tally, Zoho or Vyapar,
     so the sheet does not describe a read of their books; it says what will
     actually happen, which is that a demonstration business is loaded. */
  function openConsentSheet(src) {
    openSheet({
      title: "Connect " + src.label,
      body:
        '<div class="ob-provdemo">' + ICON.flask + "<span>NOT AVAILABLE YET</span></div>" +
        '<p class="ob-sheet-p">FoodBridge cannot read ' + esc(src.label) + " in this preview. " +
          "Continue and you will see a demonstration business instead of your own records, " +
          "so you can judge what FoodBridge would do with yours.</p>" +
        '<p class="ob-sheet-eyebrow">' + ICON.shield + "WHAT WE'LL READ FROM " + esc(src.label.toUpperCase()) + "</p>" +
        '<ul class="ob-sheet-ul"><li>Nothing &#8212; there is no connection to read from</li></ul>' +
        '<p class="ob-sheet-eyebrow">' + ICON.lock + "WHAT WON'T CHANGE</p>" +
        '<ul class="ob-sheet-ul"><li>Nothing is written back to ' + esc(src.label) + "</li>" +
          "<li>Your " + esc(src.label) + " account is never contacted</li></ul>",
      actions: '<button class="ob-cta" id="s-connect">Show me with demo data</button>' +
               '<button class="ob-skip" id="s-cancel">Cancel</button>',
      bind: function () {
        $("#s-connect").addEventListener("click", function () { startConnect(src); });
        $("#s-cancel").addEventListener("click", closeSheet);
      },
    });
  }

  /* SHEET 2 — F05, which files. A real picker, and the camera, because
     `image/*` already opens it on a phone.

     It carries the SAME consent shape as the three connectors — what we will
     read, and what will not change. A source that asks for the user's
     documents and declares less than a source that asks for nothing is the
     wrong way round, and it was the only path into this flow that took an
     input without saying what happened to it. The preview boundary is stated
     here too, before any file is chosen. */
  function openFileSheet(src) {
    let chosen = [];

    function listHtml() {
      if (!chosen.length) return '<p class="ob-sheet-p">Nothing chosen yet.</p>';
      return chosen.map(function (f, i) {
        return '<div class="ob-chosen-r">' + ICON.files +
          "<span>" + esc(f.name) + "</span>" +
          '<button class="ob-chosen-x" data-rmfile="' + i + '" aria-label="Remove ' + esc(f.name) + '">' +
            ICON.close + "</button>" +
        "</div>";
      }).join("");
    }

    openSheet({
      title: "Choose your files",
      body:
        '<p class="ob-sheet-eyebrow">' + ICON.shield + "WHAT WE'LL READ</p>" +
        '<ul class="ob-sheet-ul"><li>Only the files you pick here</li>' +
          "<li>We look for your customers, products and order history in them</li></ul>" +
        '<p class="ob-sheet-eyebrow">' + ICON.lock + "WHAT WON'T CHANGE</p>" +
        '<ul class="ob-sheet-ul"><li>Your files are not uploaded anywhere</li>' +
          "<li>They are read in this browser and kept nowhere</li></ul>" +
        '<div class="ob-provdemo">' + ICON.flask + "<span>NOT AVAILABLE YET</span></div>" +
        '<p class="ob-sheet-p">Reading documents is not implemented in this preview, ' +
          "so this will not succeed for any file yet.</p>" +
        '<div class="ob-filepick">' +
          '<label class="ob-chip key">' + ICON.upload + "Choose files" +
            '<input type="file" id="s-files" multiple hidden></label>' +
          '<label class="ob-chip">' + ICON.camera + "Take photo" +
            '<input type="file" id="s-photo" accept="image/*" capture="environment" hidden></label>' +
        "</div>" +
        '<div class="ob-chosen" id="s-chosen">' + listHtml() + "</div>",
      actions: '<button class="ob-cta" id="s-read" disabled>Read them</button>' +
               '<button class="ob-skip" id="s-cancel">Cancel</button>',
      bind: function () {
        function repaint() {
          $("#s-chosen").innerHTML = listHtml();
          $("#s-read").disabled = !chosen.length;
          /* Re-bound on every repaint: the rows are rewritten, so the handlers
             that were on the old ones are gone with them. */
          $$("[data-rmfile]").forEach(function (b) {
            b.addEventListener("click", function () {
              chosen.splice(Number(b.dataset.rmfile), 1);
              repaint();
            });
          });
        }
        function picked(list) {
          chosen = chosen.concat(Array.prototype.slice.call(list));
          repaint();
        }
        $("#s-files").addEventListener("change", function () { picked(this.files); this.value = ""; });
        $("#s-photo").addEventListener("change", function () { picked(this.files); this.value = ""; });
        $("#s-read").addEventListener("click", function () { startFileRead(src, chosen); });
        $("#s-cancel").addEventListener("click", closeSheet);
        repaint();
      },
    });
  }

  /* SHEET 3 — F06, the sample. Its own confirmation, and the provenance is
     shown here before it is accepted, not discovered afterwards. */
  function openSampleSheet() {
    openSheet({
      title: "Use a sample business",
      body:
        '<p class="ob-sheet-p">You\'ll see a demonstration business, not your own.</p>' +
        '<div class="ob-provdemo">' + ICON.flask + "<span>SAMPLE BUSINESS</span></div>" +
        '<ul class="ob-sheet-ul"><li>This marker stays on every screen</li>' +
          "<li>Nothing connects to your account</li>" +
          "<li>Leaving the sample discards everything it showed you</li></ul>",
      actions: '<button class="ob-cta" id="s-use">Use the sample</button>' +
               '<button class="ob-skip" id="s-cancel">Cancel</button>',
      bind: function () {
        $("#s-use").addEventListener("click", function () { state.sheet = null; useSample(); });
        $("#s-cancel").addEventListener("click", closeSheet);
      },
    });
  }

  /* Reached from the sample sheet, and from every dead end that needs a way
     forward. Always succeeds, which is the point of offering it. */
  function useSample() {
    state.mode = "sample";
    state.source = null;
    state.ingested = true;
    state.model = buildModel();
    save();
    go("S03");
  }

  /* F07 — the read. Cancellable, and its steps report real counts.

     NN1/NN2 — the steps describe what is ACTUALLY happening. Nothing says
     "Connecting to Tally" or "Reading order history", because neither occurs.
     `state.source` and `state.mode` are written in onDone and nowhere else. */
  function startConnect(src) {
    const seed = window.SEED || {};
    const hist = WITHHOLD ? {} : (window.FB_ORDER_HISTORY || {});   // a connector read, never the sample
    let orders = 0;
    Object.keys(hist).forEach(function (k) { orders += (hist[k].orders || []).length; });

    runOp({
      title: "Loading demo data",
      steps: [
        { label: "Checking for a " + src.label + " connection", found: "none available" },
        { label: "Loading a demonstration business",
          found: (seed.products || []).length + " products \u00b7 " + (seed.b2b || []).length + " customers" },
        { label: "Loading its order history",
          found: orders ? orders.toLocaleString() + " orders" : "nothing" },
        { label: "Working out its buying patterns", found: "done" },
      ],
      onCancel: function () { go("S02"); },
      onDone: function () {
        state.mode = "demo";
        state.source = { id: src.id, label: src.label };
        state.ingested = true;
        state.model = buildModel();
        save();
        go("S03");
      },
    });
  }

  /* Documents are where this preview's boundary is, and it reports the
     boundary rather than inventing a figure to cover it.

     NN10 — the failure no longer replaces the screen. It is a RESULT STATE
     inside the sheet the user opened, so whatever they already had is still
     behind it, and the primary way out keeps that rather than discarding it. */
  function startFileRead(src, files) {
    runOp({
      title: "Reading your documents",
      steps: [
        { label: "Opening " + files.length + (files.length === 1 ? " file" : " files"),
          found: files.length + " opened" },
        { label: "Extracting the details", found: "nothing" },
      ],
      onCancel: function () { go("S02"); },
      onDone: function () {
        documentsFailed(files.length, function () { startFileRead(src, files); });
      },
    });
  }

  /* The one place a document read reports that it produced nothing. It offers
     a forward path in every case: keep what is already here if there is
     anything, and otherwise the sample, which always works. */
  function documentsFailed(count, retry) {
    const haveData = !!state.ingested;
    openSheet({
      title: "We couldn't read those documents",
      body:
        '<p class="ob-sheet-p">Nothing could be extracted from ' +
          (count === 1 ? "that file" : "those " + count + " files") + ". " +
          (haveData ? "Nothing changed, and what you already have is untouched."
                    : "Nothing was added and nothing was changed.") + "</p>" +
        '<p class="ob-sheet-eyebrow">' + ICON.flask + "WHY THIS HAPPENS</p>" +
        '<p class="ob-sheet-p">Reading documents is not implemented in this preview. ' +
          "It will not succeed for any file yet.</p>",
      actions:
        (haveData
          ? '<button class="ob-cta" id="s-keep">Keep what we have</button>'
          : '<button class="ob-cta" id="s-sample">Explore with a sample business</button>') +
        '<button class="ob-skip" id="s-retry">Try other files</button>',
      bind: function () {
        const keep = $("#s-keep");
        if (keep) keep.addEventListener("click", closeSheet);
        const smp = $("#s-sample");
        if (smp) smp.addEventListener("click", function () { state.sheet = null; useSample(); });
        $("#s-retry").addEventListener("click", function () { state.sheet = null; retry(); });
      },
    });
  }

  /* ------------------------------------------------------------- S03 */

  function drawS03() {
    const m = state.model || (state.model = buildModel());
    return m.floor.met ? drawS03Above(m) : drawS03Below(m);
  }

  /* S03-A — above the floor. Three figures, each of which opens its own
     records. Provenance is NOT here: it lives in the sheet, beside the rows
     it describes. */
  function drawS03Above(m) {
    const cells = [];
    if (m.evidence.sales.present)
      cells.push({ k: "orders", n: m.evidence.sales.orders.toLocaleString(), l: "Orders", ic: iconOrders });
    if (m.context.products.present)
      cells.push({ k: "products", n: m.context.products.count.toLocaleString(), l: "Products", ic: iconProducts });
    if (m.context.customers.present)
      cells.push({ k: "customers", n: m.context.customers.count.toLocaleString(), l: "Customers", ic: iconCustomers });

    render(
      chrome("S03", { back: true }) +
      '<main class="ob-main">' +
        '<h1 class="ob-h1">Here\'s what we received</h1>' +

        '<div class="ob-ev">' +
          cells.map(function (c) {
            return '<button class="ob-ev-cell" data-insp="' + c.k + '">' + c.ic +
              '<span class="ob-ev-n">' + esc(c.n) + "</span>" +
              '<span class="ob-ev-l">' + esc(c.l) + "</span>" +
              '<span class="ob-ev-chev">' + ICON.chev + "</span></button>";
          }).join("") +
        "</div>" +

        (m.unlocks.length
          ? '<section class="ob-section">' +
              '<p class="ob-eyebrow">ADD LATER TO SEE MORE</p>' +
              '<div class="ob-optional">' +
                m.unlocks.map(function (u, i) {
                  /* NN10 — this was an "Add" button over a file picker that
                     could never succeed for any file. It is now a plain
                     explanation of what the signal needs, because offering an
                     input that always fails is worse than offering none. */
                  return '<div class="ob-orow">' + ICON.plusCircle +
                    '<span class="ob-orow-main"><span class="ob-orow-t">' + esc(u.label) + "</span>" +
                    '<span class="ob-orow-s">Would unlock ' + esc(u.short) + "</span></span>" +
                    '<button class="ob-addlink" data-gap="' + i + '">What this needs</button></div>';
                }).join("") +
              "</div>" +
            "</section>"
          : "") +
      "</main>" +
      /* The transition is semantic: it names what happens next, not the act
         of moving. */
      '<footer class="ob-foot"><button class="ob-cta" id="b-continue">See what this means</button></footer>'
    );

    $$("[data-insp]").forEach(function (b) {
      b.addEventListener("click", function () { openInspectSheet(b.dataset.insp); });
    });
    $$("[data-gap]").forEach(function (b) {
      b.addEventListener("click", function () { openGapSheet(m.unlocks[Number(b.dataset.gap)]); });
    });
    $("#b-continue").addEventListener("click", function () { go("S04"); });
  }

  /* SHEET 4 — inspect. Enough real rows to recognise your own business, the
     total, and where it came from. A sheet, not a browser. */
  function openInspectSheet(kind) {
    const EV = window.FB_EVIDENCE;
    const r = EV.sampleRecords({ seed: window.SEED, history: historyNow(), kind: kind, limit: 5 });
    const pv = EV.provenance({ seed: window.SEED, history: historyNow() });
    const title = kind.charAt(0).toUpperCase() + kind.slice(1);

    openSheet({
      title: title,
      count: r.total.toLocaleString(),
      body:
        '<p class="ob-sheet-eyebrow">A FEW OF THEM</p>' +
        '<div class="ob-reclist">' +
          r.rows.map(function (x) {
            return '<div class="ob-rec"><span class="ob-rec-a">' + esc(x.a) + "</span>" +
                   '<span class="ob-rec-b">' + esc(x.b) + "</span></div>";
          }).join("") +
        "</div>" +
        '<p class="ob-sheet-eyebrow">WHERE THIS CAME FROM</p>' +
        '<div class="ob-prov-lines">' +
          /* NN1 — this NEVER reads "<source> export". Nothing was exported from
             anywhere. It names the demonstration business, and the source only
             as the button the user happened to press. */
          "<p>Demonstration business" +
            (state.mode === "demo" && state.source
              ? " &#8212; loaded because " + esc(state.source.label) + " is not connectable yet"
              : "") + "</p>" +
          (kind === "orders" && pv.from ? "<p>" + esc(pv.from) + " &#8211; " + esc(pv.to) + "</p>" : "") +
          /* Scope belongs to the ORDERS, not to a product catalogue. Printing
             it under all three is how a date range ended up describing 86
             pickles. */
          (kind === "orders"
            ? "<p>" + pv.shopsWithHistory + " of its " + pv.totalCustomers + " shops</p>"
            : "<p>" + r.total.toLocaleString() + " " + esc(r.unit) + " in total</p>") +
        "</div>",
      actions: '<button class="ob-cta ob-ghost" id="s-close">Close</button>',
      bind: function () { $("#s-close").addEventListener("click", closeSheet); },
    });
  }

  /* SHEET 5 — F11, what a blocked signal needs. NN10: this used to offer a
     file picker and a camera for evidence this preview cannot ingest for any
     file, so every attempt failed and the customer blamed their own documents.
     It now states the requirement and gets out of the way. The only action is
     to keep what is already here, which is what the user was doing anyway. */
  function openGapSheet(gap) {
    const needs = (gap && gap.needs) || [];
    openSheet({
      title: (gap && gap.label) || "More evidence",
      body:
        '<p class="ob-sheet-p">FoodBridge would show you ' +
          esc((gap && gap.short) || "more of your business") + " once it holds this.</p>" +
        '<p class="ob-sheet-eyebrow">' + ICON.plusCircle + "WHAT IT NEEDS</p>" +
        '<ul class="ob-sheet-ul">' +
          (needs.length
            ? needs.map(function (n) { return "<li>" + esc(String(n).replace(/_/g, " ")) + "</li>"; }).join("")
            : "<li>" + esc((gap && gap.label) || "this evidence") + " for your business</li>") +
        "</ul>" +
        '<p class="ob-sheet-eyebrow">' + ICON.flask + "IN THIS PREVIEW</p>" +
        '<p class="ob-sheet-p">There is no way to add it yet. Reading documents is ' +
          "not implemented, so nothing here can unlock it today. Until then " +
          "FoodBridge leaves these figures out rather than estimating them.</p>",
      actions: '<button class="ob-cta ob-ghost" id="s-keep">Keep what we have</button>',
      bind: function () { $("#s-keep").addEventListener("click", closeSheet); },
    });
  }

  /* S03-B — below the floor. NN11: this was a closed loop — "Connect" returned
     to S02, which returned here, and both Upload paths failed for every file.
     It now names what is missing and what that would unlock, and it always
     carries a way FORWARD that works: the sample business. */
  function drawS03Below(m) {
    const missing = [
      { name: "Sales or orders", icon: iconOrders, tint: "t-indigo",
        unlock: "which shops have stopped ordering, and what to reorder for them" },
      { name: "Your products", icon: iconProducts, tint: "t-green",
        unlock: "what is on the shelf and what is out of stock" },
    ].filter(function (x, i) {
      return i === 0 ? !(m && m.evidence && m.evidence.sales.present)
                     : !(m && m.context && m.context.products.present);
    });

    render(
      chrome("S03", { back: true }) +
      '<main class="ob-main">' +
        '<h1 class="ob-h1">We need a little more</h1>' +
        '<section class="ob-section">' +
          '<p class="ob-eyebrow">WHAT IS MISSING</p>' +
          '<div class="ob-optional">' +
            (missing.length ? missing : [{ name: "Your business records", icon: iconOrders, tint: "t-indigo",
                                           unlock: "what FoodBridge can tell you" }])
              .map(function (n) {
                return '<div class="ob-orow">' +
                  '<span class="ob-mark ' + n.tint + '">' + n.icon + "</span>" +
                  '<span class="ob-orow-main"><span class="ob-orow-t">' + esc(n.name) + "</span>" +
                  '<span class="ob-orow-s">Would unlock ' + esc(n.unlock) + "</span></span></div>";
              }).join("") +
          "</div>" +
        "</section>" +
      "</main>" +
      '<footer class="ob-foot">' +
        '<button class="ob-cta" id="b-sample">Explore with a sample business</button>' +
        '<button class="ob-skip" id="b-other">Choose a different source</button>' +
      "</footer>"
    );
    $("#b-sample").addEventListener("click", openSampleSheet);
    $("#b-other").addEventListener("click", function () {
      leaveData(function () { state.screen = "S02"; draw(); });
    });
  }

  /* ------------------------------------------------------------- S04 */

  function drawS04() {
    const m = state.model || (state.model = buildModel());
    const cad = (m.signals && m.signals.order_cadence) || { overdue: 0 };
    const rest = supportingSignals(m);

    render(
      chrome("S04", { back: true }) +
      '<main class="ob-main">' +
        '<p class="ob-eyebrow">WHAT WE NOTICED</p>' +
        (cad.overdue > 0
          ? '<h1 class="ob-lead-h">' + cad.overdue + " shops are past their usual order date</h1>" +
            '<button class="ob-why" id="b-why">Why this matters' + ICON.chev + "</button>"
          : '<p class="ob-quiet">Nothing needs your attention today.</p>') +
        (rest.length
          ? '<div class="ob-support">' + rest.map(function (x) {
              return '<button class="ob-srow" data-sig="' + esc(x.id) + '">' +
                '<span class="ob-srow-ic">' + x.icon + "</span>" +
                '<span class="ob-srow-t">' + esc(x.label) + "</span>" +
                '<span class="ob-chev">' + ICON.chev + "</span></button>";
            }).join("") + "</div>"
          : "") +
      "</main>" +
      '<footer class="ob-foot">' +
        /* NN14 — "Start here" named nothing. This names the thing it opens. */
        (cad.overdue > 0
          ? '<button class="ob-cta" id="b-start">Show me the ' + cad.overdue + " shops</button>"
          : "") +
        '<button class="ob-skip" id="b-skip">Not now</button>' +
      "</footer>"
    );

    const why = $("#b-why");
    if (why) why.addEventListener("click", function () { openWhySheet(m, cad); });
    /* NN3 — a supporting insight opens a SHEET. It used to call handoff(),
       which navigated the whole window into another module, abandoned
       onboarding, dropped the demonstration marker and left no way back. */
    $$("[data-sig]").forEach(function (b) {
      b.addEventListener("click", function () { openStockSheet(m); });
    });
    const st = $("#b-start");
    if (st) st.addEventListener("click", openOpportunity);
    $("#b-skip").addEventListener("click", parkOpportunity);
  }

  /* SHEET — the supporting insight, in place. It says what it is FOR, which is
     the reason it survived NN13: stock is what decides whether a reorder can
     actually be filled. */
  function openStockSheet(m) {
    const sp = (m.signals && m.signals.stock_position) || { outOfStock: 0, catalogue: 0 };
    const products = ((window.SEED || {}).products || []).filter(function (p) {
      return Number(p.systemStock) === 0;
    });
    openSheet({
      title: "Out of stock",
      count: sp.outOfStock,
      body:
        '<p class="ob-sheet-p">' + sp.outOfStock + " of your " + sp.catalogue +
          " products show no stock. A reorder can still be prepared for them \u2014 " +
          "this is what to expect to be short of when you come to fill it.</p>" +
        '<p class="ob-sheet-eyebrow">A FEW OF THEM</p>' +
        '<div class="ob-reclist">' +
          products.slice(0, 8).map(function (p) {
            return '<div class="ob-rec"><span class="ob-rec-a">' + esc(p.name) + "</span>" +
                   '<span class="ob-rec-b">0 in stock</span></div>';
          }).join("") +
        "</div>",
      actions: '<button class="ob-cta ob-ghost" id="s-close">Close</button>',
      bind: function () { $("#s-close").addEventListener("click", closeSheet); },
    });
  }

  /* NN4 — "Not now" is REVERSIBLE. It used to call handoff("dashboard"), which
     left onboarding for a screen with no way back and no trace of any of this.
     The opportunity is parked on a record that survives a reload and is
     reachable from the drafts destination, and the user is told where it went
     before they go anywhere. */
  function parkOpportunity() {
    const o = state.opp || (state.opp = buildOpportunity());
    openSheet({
      title: "Leave this for now?",
      body:
        '<p class="ob-sheet-eyebrow">WHAT HAPPENS</p>' +
        '<ul class="ob-sheet-ul">' +
          "<li>" + o.total + " shops stopped ordering \u2014 we keep the list</li>" +
          "<li>Nothing is sent, prepared or written</li>" +
          "<li>You can pick it up from Order Drafts whenever you want</li>" +
        "</ul>" +
        (state.mode === "sample"
          ? '<p class="ob-sheet-p">You stay in the sample business. Nothing of your own is touched.</p>'
          : ""),
      actions: '<button class="ob-cta" id="s-park">Leave it for now</button>' +
               '<button class="ob-skip" id="s-stay">Keep going</button>',
      bind: function () {
        $("#s-park").addEventListener("click", function () {
          state.sheet = null;
          state.parked = true;
          save();
          state.view = "drafts";
          drawDraftsHome();
        });
        $("#s-stay").addEventListener("click", closeSheet);
      },
    });
  }

  /* SHEET 6 — why this matters. Everything S04 refuses to carry: what we
     looked at, how we read it, and what we found. "Usual" is per shop, and
     this is the only place that says how the date was arrived at. */
  function openWhySheet(m, cad) {
    const o = state.opp || (state.opp = buildOpportunity());
    const longest = o.shops.length ? o.shops[0].daysOverdue : 0;
    openSheet({
      title: "Why this matters",
      body:
        '<p class="ob-sheet-eyebrow">WHAT WE LOOKED AT</p>' +
        '<p class="ob-sheet-p">' + esc(m.coverageSentence) + "</p>" +
        '<p class="ob-sheet-eyebrow">HOW WE READ IT</p>' +
        '<p class="ob-sheet-p">Every shop has its own buying rhythm. We worked out how ' +
          "often each one usually orders, and compared it against its own rhythm — " +
          "never against an average.</p>" +
        '<p class="ob-sheet-eyebrow">WHAT WE FOUND</p>' +
        '<div class="ob-kv">' +
          '<div class="ob-kv-r"><span>Shops past their usual date</span><b>' + cad.overdue + "</b></div>" +
          '<div class="ob-kv-r"><span>Longest overdue</span><b>' + longest + " days</b></div>" +
          '<div class="ob-kv-r"><span>We can prepare a reorder for</span><b>' + o.withSuggestion + "</b></div>" +
        "</div>",
      actions: '<button class="ob-cta ob-ghost" id="s-close">Close</button>',
      bind: function () { $("#s-close").addEventListener("click", closeSheet); },
    });
  }

  /* ------------------------------------------------------------- S05 */

  function openOpportunity() {
    state.opp = buildOpportunity();
    state.picked = {};          // NOTHING is pre-selected (D-018)
    state.repeats = {};
    state.showAll = false;
    state.stage = state.drafts ? "prepared" : "brief";
    go("S05");
  }

  function recommended() { return (state.opp.shops || []).filter(function (s) { return !!s.suggestion; }); }
  function stale() { return (state.opp.shops || []).filter(function (s) { return !s.suggestion; }); }
  function pickedCount() { return Object.keys(state.picked).filter(function (k) { return state.picked[k]; }).length; }
  function repeatCount() { return Object.keys(state.repeats).filter(function (k) { return state.repeats[k]; }).length; }

  /* Product names in this catalogue carry pack size and MRP. A shop's row
     needs the thing, not the label off the jar. */
  function shortName(nm) {
    return String(nm)
      .replace(/\(.*?\)/g, " ")
      .replace(/\b(OLD|NEW)?\s*MRP\b.*$/i, " ")
      .replace(/[.,/-]+\s*$/, "")
      .replace(/\s{2,}/g, " ")
      .toLowerCase().trim();
  }
  function shortList(names) {
    return names.map(shortName).filter(Boolean).slice(0, 3).join(", ");
  }

  function drawS05() {
    if (state.stage === "prepared") return drawS05Prepared();
    if (state.stage === "choose") return drawS05Choose();
    return drawS05Brief();
  }

  /* F15 — the BRIEF. S05 opens on what was found, never on a selection task:
     a list of twenty-three checkboxes is a job, and a job is not an
     explanation of why you are looking at one. */
  function drawS05Brief() {
    const o = state.opp;
    const rec = recommended().length, st = stale().length;
    render(
      chrome("S05", { back: true }) +
      '<main class="ob-main">' +
        '<p class="ob-eyebrow">THE OPPORTUNITY</p>' +
        '<h1 class="ob-lead-h">' + o.total + " shops stopped ordering</h1>" +
        /* NN12 — both rows are real buttons. They named two groups and opened
           neither; the seven that "need your eye" were the ones a user was
           most likely to reach for. */
        '<div class="ob-brief">' +
          '<button class="ob-brief-r" id="b-rec"><b>' + rec + "</b>" +
            "<span>we can prepare a reorder for</span>" +
            '<span class="ob-chev">' + ICON.chev + "</span></button>" +
          '<button class="ob-brief-r" id="b-stale"><b>' + st + "</b>" +
            "<span>need your eye \u2014 quiet too long to predict</span>" +
            '<span class="ob-chev">' + ICON.chev + "</span></button>" +
        "</div>" +
      "</main>" +
      '<footer class="ob-foot">' +
        '<button class="ob-cta" id="b-choose">See the ' + rec + "</button>" +
        '<button class="ob-skip" id="b-skip">Not now</button>' +
      "</footer>"
    );
    function open(showStale) {
      state.stage = "choose";
      state.showAllStale = showStale;
      state.focus = showStale ? "stale" : null;
      draw();
    }
    $("#b-rec").addEventListener("click", function () { open(false); });
    $("#b-stale").addEventListener("click", function () { open(true); });
    $("#b-choose").addEventListener("click", function () { open(false); });
    $("#b-skip").addEventListener("click", parkOpportunity);
  }

  /* F16/F17 — choosing. NOTHING arrives selected: a recommendation that
     selects itself has become a choice the user never made. */
  function drawS05Choose() {
    const rec = recommended(), st = stale();
    const shown = state.showAll ? rec : rec.slice(0, 5);
    const hidden = rec.length - shown.length;
    const staleShown = state.showAllStale ? st : st.slice(0, 3);
    const staleHidden = st.length - staleShown.length;
    const n = pickedCount(), r = repeatCount();
    const total = n + r;
    const allOn = n === rec.length;

    render(
      chrome("S05", { back: true }) +
      '<main class="ob-main">' +
        undoBar() +
        '<div class="ob-selbar">' +
          '<span class="ob-selbar-n">' + total + " selected</span>" +
          '<button class="ob-selbar-a" id="b-all">' +
            (total ? "Clear all" : "Select all " + rec.length) + "</button>" +
        "</div>" +

        '<p class="ob-eyebrow">WE CAN PREPARE A REORDER</p>' +
        '<div class="ob-shops">' +
          shown.map(function (sh) {
            return '<div class="ob-shop' + (state.picked[sh.id] ? " is-on" : "") + '">' +
              '<button class="ob-shop-pick" data-shop="' + esc(sh.id) + '" aria-pressed="' +
                (state.picked[sh.id] ? "true" : "false") + '">' +
                '<span class="ob-box">' + ICON.check + "</span></button>" +
              '<button class="ob-shop-open" data-detail="' + esc(sh.id) + '">' +
                '<span class="ob-shop-n">' + esc(sh.name) + "</span>" +
                '<span class="ob-shop-why">' + sh.daysOverdue + " days overdue · usually every " +
                  sh.cycleDays + " days</span>" +
                '<span class="ob-sugg">' + sh.suggestion.count + " lines suggested</span>" +
              "</button>" +
              '<span class="ob-chev">' + ICON.chev + "</span>" +
            "</div>";
          }).join("") +
        "</div>" +
        (hidden > 0 ? '<button class="ob-morebtn" id="b-more">Show ' + hidden + " more</button>" : "") +

        (st.length
          ? '<p class="ob-eyebrow" id="ob-stale-h">NEED YOUR EYE</p>' +
            '<div class="ob-shops">' +
              staleShown.map(function (sh) {
                return '<div class="ob-shop is-stale' + (state.repeats[sh.id] ? " is-on" : "") + '">' +
                  '<button class="ob-shop-pick" data-repeat="' + esc(sh.id) + '" aria-pressed="' +
                    (state.repeats[sh.id] ? "true" : "false") + '">' +
                    '<span class="ob-box">' + ICON.check + "</span></button>" +
                  '<button class="ob-shop-open" data-detail="' + esc(sh.id) + '">' +
                    '<span class="ob-shop-n">' + esc(sh.name) + "</span>" +
                    '<span class="ob-shop-why">' + sh.daysOverdue + " days overdue</span>" +
                    /* A FACT about the past, never a prediction, and it says
                       which it is right on the row. */
                    '<span class="ob-repeat">' + ICON.repeat + "Repeat their last order</span>" +
                  "</button>" +
                  '<span class="ob-chev">' + ICON.chev + "</span>" +
                "</div>";
              }).join("") +
            "</div>" +
            (staleHidden > 0
              ? '<button class="ob-morebtn" id="b-morestale">Show ' + staleHidden + " more</button>"
              : "")
          : "") +
      "</main>" +
      '<footer class="ob-foot">' +
        '<button class="ob-cta" id="b-prep"' + (total ? "" : " disabled") + ">" +
          (total ? "Prepare " + total + (total === 1 ? " draft" : " drafts") : "Select shops to prepare drafts") +
        "</button>" +
      "</footer>"
    );

    bindUndo();
    $$("[data-shop]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.picked[b.dataset.shop] = !state.picked[b.dataset.shop];
        draw();
      });
    });
    $$("[data-repeat]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.repeats[b.dataset.repeat] = !state.repeats[b.dataset.repeat];
        draw();
      });
    });
    $$("[data-detail]").forEach(function (b) {
      b.addEventListener("click", function () { openShopSheet(b.dataset.detail); });
    });
    const more = $("#b-more");
    if (more) more.addEventListener("click", function () { state.showAll = true; draw(); });
    if (state.focus === "stale") {
      state.focus = null;
      const h = $("#ob-stale-h");
      if (h) h.scrollIntoView({ block: "start" });
    }
    /* Select all / Clear all acts on the RECOMMENDED list only, which is what
       its own label says. The stale shops are a different decision — repeating
       a past order is a fact, not a prediction — and sweeping them in here
       would make that choice on the user's behalf. */
    const all = $("#b-all");
    if (all) all.addEventListener("click", function () {
      if (total) {
        /* "Clear all" clears ALL of it. It used to clear only the recommended
           group, so a shop picked from "need your eye" survived a clear and
           the footer went on offering to prepare a draft for it. */
        state.picked = {};
        state.repeats = {};
      } else {
        rec.forEach(function (sh) { state.picked[sh.id] = true; });
      }
      draw();
    });
    const ms = $("#b-morestale");
    if (ms) ms.addEventListener("click", function () { state.showAllStale = true; draw(); });
    const p = $("#b-prep");
    if (p) p.addEventListener("click", openConfirmSheet);
  }

  /* SHEET 7 — one shop. What it usually buys, when it last ordered, and the
     lines we would propose. `suggestedQty` is shown as FoodBridge's figure. */
  function openShopSheet(id) {
    const sh = state.opp.shops.filter(function (s) { return s.id === id; })[0];
    if (!sh) return;
    const EV = window.FB_EVIDENCE;
    const lines = sh.suggestion ? sh.suggestion.lines : (sh.lastOrder ? sh.lastOrder.lines : []);
    openSheet({
      title: sh.name,
      body:
        '<div class="ob-kv">' +
          '<div class="ob-kv-r"><span>Usually orders every</span><b>' + sh.cycleDays + " days</b></div>" +
          '<div class="ob-kv-r"><span>Days overdue</span><b>' + sh.daysOverdue + "</b></div>" +
          '<div class="ob-kv-r"><span>Last ordered</span><b>' +
            esc(sh.lastOrder ? EV.fmtDate(sh.lastOrder.at) : "—") + "</b></div>" +
          '<div class="ob-kv-r"><span>Orders on record</span><b>' + sh.orderCount + "</b></div>" +
        "</div>" +
        '<p class="ob-sheet-eyebrow">' +
          (sh.suggestion ? "WHAT WE'D PROPOSE" : "WHAT THEY LAST ORDERED") + "</p>" +
        (sh.suggestion
          ? ""
          : '<p class="ob-sheet-p">This shop has been quiet too long for its pattern to ' +
            "count as current, so we propose nothing. These are the lines from its last " +
            "order, exactly as they were.</p>") +
        '<div class="ob-reclist">' +
          lines.slice(0, 8).map(function (l) {
            /* The FULL name, pack size and all. Two lines of this catalogue
               collapse to the same words once the bracket is stripped, and a
               100 gm pouch is not a pet jar. */
            return '<div class="ob-rec"><span class="ob-rec-a">' + esc(l.name) + "</span>" +
                   '<span class="ob-rec-b">' +
                   (sh.suggestion ? l.suggestedQty + " suggested" : l.qty + " ordered") +
                   "</span></div>";
          }).join("") +
        "</div>" +
        (sh.usualProducts.length
          ? '<p class="ob-sheet-eyebrow">USUALLY BUYS</p>' +
            '<p class="ob-sheet-p">' + esc(shortList(sh.usualProducts)) + "</p>"
          : ""),
      actions: '<button class="ob-cta ob-ghost" id="s-close">Close</button>',
      bind: function () { $("#s-close").addEventListener("click", closeSheet); },
    });
  }

  /* SHEET 8 — F19, confirm. It names exactly what changes and, just as
     importantly, exactly what does not. */
  function openConfirmSheet() {
    const n = pickedCount(), r = repeatCount(), total = n + r;
    openSheet({
      title: "Prepare " + total + (total === 1 ? " draft" : " drafts") + "?",
      body:
        '<p class="ob-sheet-eyebrow">WHAT HAPPENS</p>' +
        '<ul class="ob-sheet-ul">' +
          (n ? "<li>" + n + " draft" + (n === 1 ? "" : "s") + " built from what we'd propose</li>" : "") +
          (r ? "<li>" + r + " draft" + (r === 1 ? "" : "s") + " repeating a last order, exactly as it was</li>" : "") +
          "<li>Every draft is held for your review</li>" +
        "</ul>" +
        '<p class="ob-sheet-eyebrow">WHAT DOES NOT HAPPEN</p>' +
        '<ul class="ob-sheet-ul"><li>Nothing is sent to any shop</li>' +
          "<li>Nothing is written to your accounting system</li></ul>",
      actions: '<button class="ob-cta" id="s-go">Prepare ' + total +
                 (total === 1 ? " draft" : " drafts") + "</button>" +
               '<button class="ob-skip" id="s-cancel">Cancel</button>',
      bind: function () {
        $("#s-go").addEventListener("click", prepareDrafts);
        $("#s-cancel").addEventListener("click", closeSheet);
      },
    });
  }

  /* F18 — preparing. An operation like any other: started by name, shows real
     counts, and cancellable. Cancelling leaves the SELECTION intact, because
     the selection was never what the operation produced. */
  function prepareDrafts() {
    const rec = recommended().filter(function (s) { return state.picked[s.id]; });
    const rep = stale().filter(function (s) { return state.repeats[s.id]; });
    let lineCount = 0;
    rec.forEach(function (s) { lineCount += s.suggestion.lines.length; });
    rep.forEach(function (s) { lineCount += (s.lastOrder ? s.lastOrder.lines.length : 0); });

    runOp({
      title: "Preparing your drafts",
      steps: [
        { label: "Building the lines", found: lineCount + " lines" },
        { label: "Checking against each shop's history",
          found: (rec.length + rep.length) + " shops" },
        { label: "Holding them for review", found: "held" },
      ],
      onCancel: function () { state.stage = "choose"; draw(); },
      onDone: function () {
        /* The draft contract: suggestedQty is immutable and qty starts equal
           to it, so an edit can never destroy the record of what FoodBridge
           actually proposed. `basis` says which of the two kinds this is. */
        const list = [];
        rec.forEach(function (s) {
          list.push({ shopId: s.id, name: s.name, basis: "recommended",
            lines: s.suggestion.lines.map(function (l) {
              return { name: l.name, suggestedQty: l.suggestedQty, qty: l.suggestedQty,
                       boughtOn: l.boughtOn, ofOrders: l.ofOrders };
            }) });
        });
        rep.forEach(function (s) {
          list.push({ shopId: s.id, name: s.name, basis: "repeat_last_order",
            lastOrderAt: s.lastOrder ? s.lastOrder.at : null,
            lines: (s.lastOrder ? s.lastOrder.lines : []).map(function (l) {
              return { name: l.name, suggestedQty: null, qty: l.qty };
            }) });
        });
        state.drafts = { list: list, sent: 0, written: 0 };
        state.undo = null;
        state.draftEdit = null;
        state.stage = "prepared";
        save();                                   // C7 — confirmed, so persisted
        draw();
      },
    });
  }

  /* ------------------------------------------------- draft helpers (NN7) */

  function draftEdits(dr) {
    return dr.lines.filter(function (l) {
      return l.suggestedQty != null && l.qty !== l.suggestedQty;
    }).length + (dr.added || 0) + (dr.removed || 0);
  }
  function draftLineCount(dr) { return dr.lines.length; }
  function draftsTotalLines(d) {
    return d.list.reduce(function (n, dr) { return n + dr.lines.length; }, 0);
  }
  function draftsTotalEdits(d) {
    return d.list.reduce(function (n, dr) { return n + draftEdits(dr); }, 0);
  }

  /* F20 — C9. It reports what actually happened, and the two zeroes are the
     whole point: this preview prepared drafts and did nothing else. */
  function drawS05Prepared() {
    const d = state.drafts;
    const n = d.list.length;
    const edits = draftsTotalEdits(d);
    render(
      chrome("S05", { back: true }) +
      '<main class="ob-main">' +
        '<div class="ob-done">' +
          '<div class="ob-done-ring">' + ICON.checkBig + "</div>" +
          '<h1 class="ob-done-h">' + n + (n === 1 ? " draft prepared" : " drafts prepared") + "</h1>" +
          '<div class="ob-done-list">' +
            '<div class="ob-done-row"><span>Held for your review</span><b>' + n + "</b></div>" +
            (edits ? '<div class="ob-done-row"><span>Edited by you</span><b>' + edits + "</b></div>" : "") +
            '<div class="ob-done-row"><span>Sent to shops</span><b>' + d.sent + "</b></div>" +
            '<div class="ob-done-row"><span>Written to your accounts</span><b>' + d.written + "</b></div>" +
          "</div>" +
        "</div>" +
      "</main>" +
      '<footer class="ob-foot">' +
        '<button class="ob-cta" id="b-review">Review ' + n + (n === 1 ? " draft" : " drafts") + "</button>" +
        /* NN14 — "Go to FoodBridge" went to a customer search that had no
           relationship to any of this. This names the destination and that
           destination actually holds the drafts. */
        '<button class="ob-skip" id="b-go">Open Order Drafts</button>' +
      "</footer>"
    );
    $("#b-review").addEventListener("click", function () { openDraftsListSheet(); });
    $("#b-go").addEventListener("click", function () { handoff("sales-orders/order-drafts"); });
  }

  /* SHEET 9 — F21, the drafts LIST. One row per draft, not 146 number boxes in
     a single scroll. Opening one is a separate, focused sheet. */
  function openDraftsListSheet() {
    const d = state.drafts;
    if (!d || !d.list.length) return;
    openSheet({
      title: "Your drafts",
      count: d.list.length,
      body:
        '<div class="ob-dlist">' +
          d.list.map(function (dr, i) {
            const e = draftEdits(dr);
            return '<button class="ob-drow" data-draft="' + i + '">' +
              '<span class="ob-drow-main">' +
                '<span class="ob-drow-n">' + esc(dr.name) + "</span>" +
                '<span class="ob-drow-s">' + draftLineCount(dr) + " lines &#183; " +
                  (dr.basis === "recommended" ? "suggested" : "repeat of last order") + "</span>" +
              "</span>" +
              (e ? '<span class="ob-drow-e">Edited</span>' : "") +
              '<span class="ob-chev">' + ICON.chev + "</span></button>";
          }).join("") +
        "</div>",
      actions: '<button class="ob-cta ob-ghost" id="s-close">Close</button>' +
               '<button class="ob-skip is-warn" id="s-discard">Discard all drafts</button>',
      bind: function () {
        $$("[data-draft]").forEach(function (b) {
          b.addEventListener("click", function () { openDraftEditor(Number(b.dataset.draft)); });
        });
        $("#s-close").addEventListener("click", closeSheet);
        $("#s-discard").addEventListener("click", confirmDiscardAll);
      },
    });
  }

  /* SHEET — ONE draft. NN7: full product identity including pack size, the
     suggested figure beside the edited one, per-line removal, a way to add a
     product that was missed, and an explicit Save. Edits are held on a working
     copy so Cancel means cancel. */
  function openDraftEditor(i) {
    const src = state.drafts.list[i];
    if (!state.draftEdit || state.draftEdit.i !== i) {
      state.draftEdit = {
        i: i,
        lines: src.lines.map(function (l) { return { name: l.name, suggestedQty: l.suggestedQty,
                                                     qty: l.qty, added: !!l.added }; }),
        adding: false, filter: "", dirty: false, removed: 0,
      };
    }
    const ed = state.draftEdit;

    if (ed.adding) return openDraftAddPicker(src);

    openSheet({
      title: src.name,
      count: ed.lines.length,
      body:
        '<p class="ob-sheet-p ob-draft-basis">' +
          (src.basis === "recommended"
            ? "Built from what this shop usually buys. The suggested figure stays beside every line you change."
            : "A repeat of this shop's last order, exactly as it was.") + "</p>" +
        (ed.lines.length
          ? '<div class="ob-draft-lines">' +
              ed.lines.map(function (l, li) {
                const changed = l.suggestedQty != null && l.qty !== l.suggestedQty;
                return '<div class="ob-dl' + (changed || l.added ? " is-edited" : "") + '">' +
                  '<span class="ob-dl-n">' + esc(l.name) + "</span>" +
                  '<span class="ob-dl-s">' +
                    (l.added ? "added by you"
                             : l.suggestedQty != null ? l.suggestedQty + " suggested" : "last ordered") +
                    (changed ? ' <em class="ob-dl-chg">changed</em>' : "") +
                  "</span>" +
                  '<input class="ob-dl-q" type="number" inputmode="numeric" pattern="[0-9]*" ' +
                    'min="0" max="9999" value="' + l.qty +
                    '" data-l="' + li + '" aria-label="Quantity for ' + esc(l.name) + '">' +
                  '<button class="ob-dl-x" data-rm="' + li + '" aria-label="Remove ' + esc(l.name) + '">' +
                    ICON.close + "</button>" +
                "</div>";
              }).join("") +
            "</div>"
          : '<p class="ob-sheet-p">Every line has been removed. Saving now leaves this draft empty, ' +
            "so it will be discarded instead.</p>") +
        '<button class="ob-addline" id="s-add">' + ICON.plusCircle + "Add a product</button>",
      actions: '<button class="ob-cta" id="s-save">' +
                 (ed.dirty ? "Save changes" : "Done") + "</button>" +
               '<button class="ob-skip" id="s-cancel">' + (ed.dirty ? "Cancel" : "Back to drafts") + "</button>",
      bind: function () {
        $$(".ob-dl-q").forEach(function (inp) {
          /* Tapping a quantity means replacing it, not appending to it. Without
             this, tapping "8" and typing 42 leaves 428 — the caret lands where
             the thumb did. Selecting on focus makes the first keystroke the
             new value, which is what a number field on a phone should do. */
          inp.addEventListener("focus", function () {
            setTimeout(function () { try { inp.select(); } catch (e) {} }, 0);
          });
          inp.addEventListener("change", function () {
            const q = Math.min(9999, Math.max(0, parseInt(inp.value, 10) || 0));
            inp.value = q;
            ed.lines[Number(inp.dataset.l)].qty = q;
            ed.dirty = true;
            openDraftEditor(i);
          });
        });
        $$("[data-rm]").forEach(function (b) {
          b.addEventListener("click", function () {
            ed.lines.splice(Number(b.dataset.rm), 1);
            /* Counted as it happens. Deriving it from the line total afterwards
               reports 0 when a line is also added, which is how one removal and
               one addition cancelled each other out. */
            ed.removed += 1;
            ed.dirty = true;
            openDraftEditor(i);
          });
        });
        $("#s-add").addEventListener("click", function () { ed.adding = true; openDraftEditor(i); });
        $("#s-save").addEventListener("click", function () { saveDraftEdit(); });
        $("#s-cancel").addEventListener("click", function () {
          if (!ed.dirty) { state.draftEdit = null; return openDraftsListSheet(); }
          confirmDropEdit();
        });
      },
      onClose: function () { /* the X is handled by confirmDropEdit via goBack */ },
    });
  }

  /* The product picker, inside the same sheet rather than stacked on top of
     it — one sheet at a time is the whole reason a sheet is legible. */
  function openDraftAddPicker(src) {
    const ed = state.draftEdit;
    const have = {};
    ed.lines.forEach(function (l) { have[l.name] = true; });
    const all = ((window.SEED || {}).products || []).filter(function (p) { return !have[p.name]; });
    const q = ed.filter.trim().toLowerCase();
    const hits = (q ? all.filter(function (p) { return p.name.toLowerCase().indexOf(q) >= 0; }) : all).slice(0, 40);

    openSheet({
      title: "Add a product",
      body:
        '<input class="ob-search" id="s-q" type="search" enterkeyhint="search" ' +
          'autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="Search ' +
          all.length + ' products" value="' + esc(ed.filter) + '" aria-label="Search products">' +
        (hits.length
          ? '<div class="ob-reclist">' +
              hits.map(function (p, k) {
                return '<button class="ob-rec ob-rec-btn" data-add="' + k + '">' +
                  '<span class="ob-rec-a">' + esc(p.name) + "</span>" +
                  '<span class="ob-rec-b">' + ICON.plusCircle + "</span></button>";
              }).join("") +
            "</div>"
          : '<p class="ob-sheet-p">No product matches that.</p>'),
      actions: '<button class="ob-cta ob-ghost" id="s-back">Back to the draft</button>',
      bind: function () {
        const qi = $("#s-q");
        qi.addEventListener("input", function () {
          ed.filter = qi.value;
          const pos = qi.selectionStart;
          openDraftAddPicker(src);
          const again = $("#s-q");
          if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) {} }
        });
        $$("[data-add]").forEach(function (b) {
          b.addEventListener("click", function () {
            const pr = hits[Number(b.dataset.add)];
            ed.lines.push({ name: pr.name, suggestedQty: null, qty: 1, added: true });
            ed.dirty = true;
            ed.adding = false;
            ed.filter = "";
            openDraftEditor(ed.i);
          });
        });
        $("#s-back").addEventListener("click", function () {
          ed.adding = false; ed.filter = ""; openDraftEditor(ed.i);
        });
      },
    });
  }

  /* An explicit Save, and the record of what FoodBridge proposed survives it:
     `suggestedQty` is copied through untouched so "changed" stays computable
     for the life of the draft. */
  function saveDraftEdit() {
    const ed = state.draftEdit;
    if (!ed) return;
    const dr = state.drafts.list[ed.i];
    dr.lines = ed.lines.map(function (l) {
      return { name: l.name, suggestedQty: l.suggestedQty, qty: l.qty, added: l.added };
    });
    dr.removed = (dr.removed || 0) + ed.removed;
    dr.added = dr.lines.filter(function (l) { return l.added; }).length;

    if (!dr.lines.length) {
      /* An empty draft is not a draft. Removing it is a deletion, so it is
         confirmed like one. */
      const name = dr.name;
      openSheet({
        title: "Remove this draft?",
        body: '<p class="ob-sheet-p">Every line has been removed from ' + esc(name) +
              ", so there is nothing left to send. The draft will be deleted.</p>",
        actions: '<button class="ob-cta is-warn" id="s-del">Delete this draft</button>' +
                 '<button class="ob-skip" id="s-keep">Keep editing</button>',
        bind: function () {
          $("#s-del").addEventListener("click", function () {
            state.undo = { drafts: JSON.parse(JSON.stringify(state.drafts)),
                           label: "1 draft deleted" };
            state.drafts.list.splice(ed.i, 1);
            state.draftEdit = null;
            if (!state.drafts.list.length) { state.drafts = null; state.stage = "choose"; }
            save();
            state.sheet = null;
            draw();
          });
          $("#s-keep").addEventListener("click", function () { openDraftEditor(ed.i); });
        },
      });
      return;
    }
    state.draftEdit = null;
    save();
    openDraftsListSheet();
  }

  function confirmDropEdit() {
    const ed = state.draftEdit;
    openSheet({
      title: "Discard your changes?",
      body: '<p class="ob-sheet-p">The quantities and lines you changed on this draft will ' +
            "go back to what they were. The draft itself is kept.</p>",
      actions: '<button class="ob-cta is-warn" id="s-drop">Discard changes</button>' +
               '<button class="ob-skip" id="s-keep">Keep editing</button>',
      bind: function () {
        $("#s-drop").addEventListener("click", function () {
          state.draftEdit = null; openDraftsListSheet();
        });
        $("#s-keep").addEventListener("click", function () { openDraftEditor(ed.i); });
      },
    });
  }

  /* NN6 — deleting every draft was one unconfirmed tap on a button sitting
     directly under Close. It now states the exact consequence and is undoable. */
  function confirmDiscardAll() {
    const d = state.drafts;
    const n = d.list.length, lines = draftsTotalLines(d), edits = draftsTotalEdits(d);
    openSheet({
      title: "Discard all " + n + " drafts?",
      body:
        '<p class="ob-sheet-eyebrow">' + ICON.alert + "WHAT YOU LOSE</p>" +
        '<ul class="ob-sheet-ul">' +
          "<li>" + n + " draft" + (n === 1 ? "" : "s") + " covering " + lines + " lines</li>" +
          (edits ? "<li>" + edits + " quantit" + (edits === 1 ? "y" : "ies") + " you changed yourself</li>" : "") +
        "</ul>" +
        '<p class="ob-sheet-eyebrow">' + ICON.lock + "WHAT STAYS</p>" +
        '<ul class="ob-sheet-ul"><li>The ' + (state.opp ? state.opp.total : 0) +
          " shops that stopped ordering &#8212; you can prepare drafts again</li>" +
          "<li>Nothing was sent, so nothing is recalled</li></ul>",
      actions: '<button class="ob-cta is-warn" id="s-drop">Discard ' + n + " drafts</button>" +
               '<button class="ob-skip" id="s-keep">Keep them</button>',
      bind: function () {
        $("#s-drop").addEventListener("click", function () {
          state.undo = { drafts: JSON.parse(JSON.stringify(state.drafts)),
                         label: n + (n === 1 ? " draft" : " drafts") + " discarded" };
          state.drafts = null;
          state.draftEdit = null;
          state.stage = "choose";
          save();
          state.sheet = null;
          draw();
        });
        $("#s-keep").addEventListener("click", closeSheet);
      },
    });
  }

  function undoBar() {
    if (!state.undo) return "";
    return '<div class="ob-undo"><span>' + esc(state.undo.label) + "</span>" +
           '<button id="b-undo">Undo</button></div>';
  }
  function bindUndo() {
    const b = $("#b-undo");
    if (b) b.addEventListener("click", function () {
      state.drafts = state.undo.drafts;
      state.undo = null;
      state.stage = "prepared";
      save();
      draw();
    });
  }

  /* ------------------------------------------ the drafts destination (NN5) */

  /* A real place the drafts live, reachable from the sidebar as Sales Orders →
     Order Drafts and at #/sales-orders/order-drafts. It reads the same record
     the flow writes, so a draft prepared in onboarding is here on the next
     load, after a refresh, and in a fresh tab of the same session.

     It is the same module and the same draft sheets — not a second
     implementation that could disagree with the first. */
  function drawDraftsHome() {
    const d = state.drafts;
    const biz = (state.profile.business || "").trim();
    const parked = state.parked && !d;

    render(
      '<header class="ob-brand"><span class="ob-word">Food<em>Bridge</em></span></header>' +
      (provenanceChip() ? '<div class="ob-navrow"><span></span>' + provenanceChip() + "</div>" : "") +
      '<main class="ob-main">' +
        '<p class="ob-eyebrow">ORDER DRAFTS' + (biz ? " &#183; " + esc(biz.toUpperCase()) : "") + "</p>" +
        undoBar() +
        (d && d.list.length
          ? '<h1 class="ob-h1">' + d.list.length +
              (d.list.length === 1 ? " draft held for review" : " drafts held for review") + "</h1>" +
            '<div class="ob-done-list ob-ledger">' +
              '<div class="ob-done-row"><span>Lines in total</span><b>' + draftsTotalLines(d) + "</b></div>" +
              '<div class="ob-done-row"><span>Edited by you</span><b>' + draftsTotalEdits(d) + "</b></div>" +
              '<div class="ob-done-row"><span>Sent to shops</span><b>' + d.sent + "</b></div>" +
              '<div class="ob-done-row"><span>Written to your accounts</span><b>' + d.written + "</b></div>" +
            "</div>" +
            '<div class="ob-dlist">' +
              d.list.map(function (dr, i) {
                const e = draftEdits(dr);
                return '<button class="ob-drow" data-draft="' + i + '">' +
                  '<span class="ob-drow-main">' +
                    '<span class="ob-drow-n">' + esc(dr.name) + "</span>" +
                    '<span class="ob-drow-s">' + draftLineCount(dr) + " lines &#183; " +
                      (dr.basis === "recommended" ? "suggested" : "repeat of last order") + "</span>" +
                  "</span>" +
                  (e ? '<span class="ob-drow-e">Edited</span>' : "") +
                  '<span class="ob-chev">' + ICON.chev + "</span></button>";
              }).join("") +
            "</div>"
          : parked
            ? '<h1 class="ob-h1">You left this for later</h1>' +
              '<div class="ob-park">' + ICON.clock +
                "<p>" + (state.opp ? state.opp.total : 0) + " shops stopped ordering. " +
                "Nothing has been prepared or sent.</p></div>"
            : '<h1 class="ob-h1">No drafts yet</h1>' +
              '<p class="ob-quiet">Drafts you prepare are held here for review. ' +
              "Nothing is sent to a shop and nothing is written to your accounts.</p>") +
      "</main>" +
      '<footer class="ob-foot">' +
        (d && d.list.length
          ? '<button class="ob-cta" id="b-review">Review ' + d.list.length +
              (d.list.length === 1 ? " draft" : " drafts") + "</button>" +
            '<button class="ob-skip is-warn" id="b-discard">Discard all drafts</button>'
          : '<button class="ob-cta" id="b-resume">' +
              (parked ? "Pick it up" : "Start onboarding") + "</button>") +
      "</footer>"
    );

    const prov = $("#b-prov");
    if (prov) prov.addEventListener("click", openProvenanceSheet);
    bindUndo();
    $$("[data-draft]").forEach(function (b) {
      b.addEventListener("click", function () { openDraftEditor(Number(b.dataset.draft)); });
    });
    const rv = $("#b-review");
    if (rv) rv.addEventListener("click", function () { openDraftsListSheet(); });
    const dc = $("#b-discard");
    if (dc) dc.addEventListener("click", confirmDiscardAll);
    const rs = $("#b-resume");
    if (rs) rs.addEventListener("click", function () { handoff("onboarding"); });
  }

  /* ---------------------------------------------------------------- run */

  function draw() {
    if (state.view === "drafts") return drawDraftsHome();
    if (state.op) return drawOp();
    if (state.screen === "S01") return drawS01();
    if (state.screen === "S02") return drawS02();
    if (state.screen === "S03") return drawS03();
    if (state.screen === "S05") return drawS05();
    return drawS04();
  }

  /* ── the keyboard ────────────────────────────────────────────────────────
     iOS does not shrink the layout viewport when the keyboard opens, so a
     footer stuck to `bottom: 0` sits underneath it and the primary action
     disappears exactly when the user has finished typing. The visual viewport
     does know, so the keyboard's height is published as a custom property and
     the footer and the open sheet lift by it.

     Nothing here changes what is on screen — only where the bottom of the
     screen currently is. */
  function trackKeyboard() {
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    /* Safari puts a form accessory bar (the ^ v Done strip) between the page
       and the keyboard, and reports it as neither. Measured at 44pt on every
       iPhone size here. Only iOS Safari draws one, so only iOS pays for it. */
    const ACCESSORY = CSS.supports("-webkit-touch-callout", "none") ? 44 : 0;
    const apply = function () {
      raf = 0;
      /* How much of the LAYOUT viewport sits below the bottom edge of the
         VISUAL viewport — which is where the keyboard starts. iOS shrinks the
         layout viewport too, so measuring against innerHeight alone
         under-reports it by whatever the layout already gave up. */
      const hidden = window.innerHeight - (vv.offsetTop + vv.height);
      const open = hidden > 1;
      const covered = open ? Math.max(0, hidden) + ACCESSORY : 0;
      document.documentElement.style.setProperty("--ob-kb", Math.round(covered) + "px");
      document.documentElement.classList.toggle("ob-kb-open", open);
    };
    const schedule = function () { if (!raf) raf = requestAnimationFrame(apply); };
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    apply();
  }

  /* Bring the focused field into the space the keyboard leaves. Safari does
     this for its own idea of the viewport and gets it wrong inside a sheet
     that scrolls on its own, which is where every quantity field lives. */
  function keepFocusVisible(e) {
    const el = e.target;
    if (!el || !/^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
    setTimeout(function () {
      const r = el.getBoundingClientRect();
      const kb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ob-kb")) || 0;
      const floor = window.innerHeight - kb - 16;
      if (r.bottom > floor || r.top < 8) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }, 320);                                   // after the keyboard animation
  }

  function mount() {
    if (!window.FB_EVIDENCE) throw new Error("evidence.js must load before onboarding.js");
    trackKeyboard();
    document.addEventListener("focusin", keepFocusVisible);
    restore();                                   // C7 — a reload lands where it left
    /* The drafts destination is the SAME module under a different view, so the
       drafts it shows are the drafts the flow wrote — not a second copy that
       could drift from the first. */
    if (new URLSearchParams(location.search).get("view") === "drafts") {
      state.view = "drafts";
      if (state.mode && !state.opp) { try { state.opp = buildOpportunity(); } catch (e) {} }
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.sheet) closeSheet();
    });
    draw();
  }

  window.FB_ONBOARDING = {
    mount, buildModel, buildOpportunity, supportingSignals, openOpportunity,
    runOp, cancelOp, openSheet, closeSheet, goBack, draw, save, restore, forget, state,
    drawDraftsHome, openDraftsListSheet, openDraftEditor, confirmDiscardAll,
    gstVerified, gstActive, verifyGstin, useSample, parkOpportunity,
    draftEdits, draftsTotalLines, draftsTotalEdits,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = window.FB_ONBOARDING;
})();

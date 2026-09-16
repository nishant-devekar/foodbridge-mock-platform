/* ==========================================================================
   ONBOARDING — five locked screens, nine contextual sheets, one small router.

   v5 draws O-001's locked UX (lock b556ecf1e4cdbe35, approved at GATE B on
   16 September 2026) under the Production UX Contract v2 recorded as D-018.
   versions/v5/ux/FLOW-MAP.md is canonical; nothing here adds to it.

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

   ── WHAT IS SIMULATED ────────────────────────────────────────────────────
   The Tally / Zoho / Vyapar connection, document upload and photograph,
   extraction, mapping, validation, GST verification, and the preparation of
   drafts. Nothing is contacted, nothing is looked up, and no draft leaves the
   browser. Declared in versions/v5/version.json and STATUS.md.

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
  const STORE_KEY = "fb.v5.onboarding";

  const state = {
    screen: "S01",
    profile: { business: "", name: "", mobile: "", email: "", gstin: "" },
    gstVerified: false,
    mode: null,            // null | "connected" | "sample"   (C6)
    source: null,          // the source behind "connected"
    ingested: null,        // what a read actually produced; null until one runs
    model: null,
    opp: null,
    stage: "brief",        // S05: brief | choose | prepared
    picked: {},            // shop id -> selected. NOTHING is pre-selected
    repeats: {},           // stale shop id -> repeat their last order
    drafts: null,          // CONFIRMED drafts. Persisted (C7)
    showAll: false,
    sheet: null,           // the open sheet, or null
    op: null,              // the running operation, or null
    failure: null,         // {title, cause, retry}
  };

  /* ------------------------------------------------------- C7 persistence */

  /* Mode and CONFIRMED drafts only. An unconfirmed selection is deliberately
     not persisted: resurrecting a choice somebody abandoned is the reload
     behaving as if they had agreed to it. */
  function save() {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({
        mode: state.mode,
        source: state.source ? { id: state.source.id, label: state.source.label } : null,
        drafts: state.drafts,
      }));
    } catch (e) { /* private mode, blocked storage: the flow still works */ }
  }

  function restore() {
    let raw = null;
    try { raw = sessionStorage.getItem(STORE_KEY); } catch (e) { return false; }
    if (!raw) return false;
    let v;
    try { v = JSON.parse(raw); } catch (e) { return false; }
    if (!v || !v.mode) return false;

    state.mode = v.mode;
    state.source = v.source || null;
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
    if (WITHHOLD) return {};
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
  function supportingSignals(m) {
    const s = m.signals || {};
    const out = [];
    if (s.stock_position && s.stock_position.outOfStock > 0) {
      out.push({ id: "stock_position", icon: iconProducts,
        label: s.stock_position.outOfStock + " of " + s.stock_position.catalogue + " products out of stock",
        route: "customer-management/stock-audit-health" });
    }
    if (s.reorder_prediction && s.reorder_prediction.ready > 0) {
      out.push({ id: "reorder_prediction", icon: iconChart,
        label: s.reorder_prediction.ready + " shops ready for a reorder",
        route: "customer-management/stock-audit-health" });
    }
    return out;
  }

  /* ------------------------------------------------------------ plumbing */

  function render(html) { $("#ob-root").innerHTML = html + sheetHtml(); window.scrollTo(0, 0); bindSheet(); }

  function go(screen) { state.screen = screen; state.failure = null; draw(); }

  /* C6 — provenance, on every screen after S02, and never ambiguous. Amber
     for a sample, neutral for the user's own connected data. */
  function provenanceChip() {
    if (state.mode === "sample") {
      return '<button class="ob-prov is-sample" id="b-prov">' + ICON.flask +
             "<span>Sample business</span></button>";
    }
    if (state.mode === "connected") {
      const nm = (state.source && state.source.label) || "Your data";
      return '<span class="ob-prov is-real">' + ICON.check +
             "<span>" + esc(nm) + " &#183; connected</span></span>";
    }
    return "";
  }

  function chrome(screen, opts) {
    const o = opts || {};
    const i = STEPS[screen];
    let steps = "";
    if (i !== undefined) {
      let bars = "";
      for (let k = 0; k < 3; k++) bars += '<i class="' + (k <= i ? "on" : "") + '"></i>';
      steps = '<span class="ob-brand-sep"></span><span class="ob-brand-step">Step ' + (i + 1) + " of 3</span>";
      steps += '</header><div class="ob-prog">' + bars + "</div>";
    } else {
      steps = "</header>";
    }
    return '<header class="ob-brand">' +
             '<span class="ob-word">Food<em>Bridge</em></span>' + steps +
           (o.back || provenanceChip()
             ? '<div class="ob-navrow">' +
               (o.back ? '<button class="ob-back" id="b-back" aria-label="Back">' + ICON.back + "</button>" : "<span></span>") +
               provenanceChip() + "</div>"
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

  /* C4 — a failure is a state with a cause and a way out. The user picks the
     way out; nothing is decided for them, and nothing falls through into a
     success screen. C5 — retry re-runs the same operation from the start. */
  function fail(spec) {
    state.failure = spec;
    render(
      chrome(state.screen) +
      '<main class="ob-main">' +
        '<div class="ob-fail">' + ICON.alert +
          '<h1 class="ob-h1">' + esc(spec.title) + "</h1>" +
          '<p class="ob-fail-c">' + esc(spec.cause) + "</p>" +
        "</div>" +
      "</main>" +
      '<footer class="ob-foot">' +
        '<button class="ob-cta" id="b-retry">Try again</button>' +
        '<button class="ob-skip" id="b-other">Try another way</button>' +
      "</footer>"
    );
    $("#b-retry").addEventListener("click", function () { state.failure = null; spec.retry(); });
    $("#b-other").addEventListener("click", function () {
      state.failure = null; state.source = null; go("S02");
    });
  }

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
        (e.caps ? ' autocapitalize="characters"' : "") + "></span>" +
      (e.trail || "") +
    "</div>";
  }

  function drawS01() {
    const p = state.profile;
    const v = state.gstVerified;
    const verifyBtn = v
      ? '<span class="ob-fr-ok">' + ICON.check + "Verified</span>"
      : '<button class="ob-verify" id="b-verify" disabled>Verify</button>';

    render(
      chrome("S01") +
      '<main class="ob-main">' +
        '<h1 class="ob-h1">Let\'s set up your business</h1>' +

        '<section class="ob-section">' +
          '<p class="ob-eyebrow">YOUR BUSINESS</p>' +
          '<div class="ob-fs">' +
            row("f-business", "Business name", ICON.building, p.business) +
            row("f-gstin", "GSTIN", ICON.badge, p.gstin,
                { caps: true, locked: v, ok: v, ph: "15-character GSTIN", trail: verifyBtn }) +
          "</div>" +
        "</section>" +

        '<section class="ob-section">' +
          '<p class="ob-eyebrow">HOW WE REACH YOU</p>' +
          '<div class="ob-fs">' +
            row("f-name", "Your name", ICON.user, p.name) +
            row("f-mobile", "Mobile number", ICON.phone, p.mobile, { type: "tel" }) +
            row("f-email", "Email address", ICON.mail, p.email, { type: "email" }) +
          "</div>" +
        "</section>" +
      "</main>" +
      '<footer class="ob-foot"><button class="ob-cta" id="b-continue">Continue</button></footer>'
    );

    ["business", "name", "mobile", "email", "gstin"].forEach(function (k) {
      const el = $("#f-" + k);
      if (!el) return;
      el.addEventListener("input", function () {
        state.profile[k] = el.value;
        const vb = $("#b-verify");
        if (vb) vb.disabled = state.profile.gstin.trim().length < 15;
      });
    });
    const vb = $("#b-verify");
    if (vb) {
      vb.disabled = p.gstin.trim().length < 15;
      vb.addEventListener("click", function () {
        /* SIMULATED. A real lookup returns the registered name; here it is
           filled from this tenant's own seed rather than invented. The field
           visibly changes, and that IS the evidence — no sentence says so. */
        state.gstVerified = true;
        const t = (window.SEED && window.SEED.tenant) || {};
        if (!state.profile.business && t.name) state.profile.business = t.name;
        drawS01();
      });
    }
    $("#b-continue").addEventListener("click", function () { go("S02"); });
  }

  /* ------------------------------------------------------------- S02 */

  const SOURCES = [
    { id: "tally", label: "Tally", kind: "connect", icon: ICON.db, tint: "t-indigo" },
    { id: "zoho", label: "Zoho", kind: "connect", icon: ICON.cloud, tint: "t-rose" },
    { id: "vyapar", label: "Vyapar", kind: "connect", icon: ICON.store, tint: "t-blue" },
    { id: "files", label: "Files or documents", kind: "files", icon: ICON.doc, tint: "t-green" },
  ];

  function drawS02() {
    render(
      chrome("S02", { back: true }) +
      '<main class="ob-main">' +
        '<h1 class="ob-h1">Where is your business data today?</h1>' +
        '<div class="ob-sources">' +
          SOURCES.map(function (s) {
            return '<button class="ob-source" data-src="' + s.id + '">' +
              '<span class="ob-mark ' + s.tint + '">' + s.icon + "</span>" +
              '<span class="ob-source-t">' + esc(s.label) + "</span>" +
              '<span class="ob-chev">' + ICON.chev + "</span></button>";
          }).join("") +
        "</div>" +
        /* A first-class answer to the same question, quieter so it never
           competes with the four real sources (D-018). */
        '<button class="ob-samplerow" id="b-sample">' +
          "<span>Show me with a sample business</span>" +
          '<span class="ob-chev">' + ICON.chev + "</span></button>" +
      "</main>"
    );
    const back = $("#b-back");
    if (back) back.addEventListener("click", goBack);
    $$("[data-src]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const src = SOURCES.filter(function (s) { return s.id === btn.dataset.src; })[0];
        state.source = src;
        if (src.kind === "files") return openFileSheet(src);
        openConsentSheet(src);
      });
    });
    $("#b-sample").addEventListener("click", openSampleSheet);
  }

  /* SHEET 1 — F04, consent. C1: the tap opened this; nothing has been read.
     The user starts the read, here, by name. */
  function openConsentSheet(src) {
    openSheet({
      title: "Connect " + src.label,
      body:
        '<p class="ob-sheet-eyebrow">' + ICON.shield + "WHAT WE'LL READ</p>" +
        '<ul class="ob-sheet-ul"><li>Your customers</li><li>Your products</li>' +
          "<li>Your order history</li></ul>" +
        '<p class="ob-sheet-eyebrow">' + ICON.lock + "WHAT WON'T CHANGE</p>" +
        '<ul class="ob-sheet-ul"><li>Nothing is written back to ' + esc(src.label) + "</li></ul>",
      actions: '<button class="ob-cta" id="s-connect">Connect</button>' +
               '<button class="ob-skip" id="s-cancel">Cancel</button>',
      bind: function () {
        $("#s-connect").addEventListener("click", function () { startConnect(src); });
        $("#s-cancel").addEventListener("click", closeSheet);
      },
    });
  }

  /* SHEET 2 — F05, which files. A real picker, and the camera, because
     `image/*` already opens it on a phone. */
  function openFileSheet(src) {
    let chosen = [];
    openSheet({
      title: "Choose your files",
      body:
        '<div class="ob-filepick">' +
          '<label class="ob-chip key">' + ICON.upload + "Choose files" +
            '<input type="file" id="s-files" multiple hidden></label>' +
          '<label class="ob-chip">' + ICON.camera + "Take photo" +
            '<input type="file" id="s-photo" accept="image/*" capture="environment" hidden></label>' +
        "</div>" +
        '<div class="ob-chosen" id="s-chosen"><p class="ob-sheet-p">Nothing chosen yet.</p></div>',
      actions: '<button class="ob-cta" id="s-read" disabled>Read them</button>' +
               '<button class="ob-skip" id="s-cancel">Cancel</button>',
      bind: function () {
        function picked(list) {
          chosen = chosen.concat(Array.prototype.slice.call(list));
          $("#s-chosen").innerHTML = chosen.length
            ? chosen.map(function (f) {
                return '<div class="ob-chosen-r">' + ICON.files + "<span>" + esc(f.name) + "</span></div>";
              }).join("")
            : '<p class="ob-sheet-p">Nothing chosen yet.</p>';
          $("#s-read").disabled = !chosen.length;
        }
        $("#s-files").addEventListener("change", function () { picked(this.files); });
        $("#s-photo").addEventListener("change", function () { picked(this.files); });
        $("#s-read").addEventListener("click", function () { startFileRead(src, chosen); });
        $("#s-cancel").addEventListener("click", closeSheet);
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
        $("#s-use").addEventListener("click", function () {
          state.sheet = null;
          state.mode = "sample";
          state.source = null;
          state.ingested = true;
          state.model = buildModel();
          save();
          go(state.model.floor.met ? "S03" : "S03");
        });
        $("#s-cancel").addEventListener("click", closeSheet);
      },
    });
  }

  /* F07 — the read. Cancellable, and its steps report real counts. */
  function startConnect(src) {
    const seed = window.SEED || {};
    const hist = WITHHOLD ? {} : (window.FB_ORDER_HISTORY || {});
    let orders = 0;
    Object.keys(hist).forEach(function (k) { orders += (hist[k].orders || []).length; });

    runOp({
      title: "Reading from " + src.label,
      steps: [
        { label: "Connecting to " + src.label, found: "connected" },
        { label: "Reading products and customers",
          found: (seed.products || []).length + " products · " + (seed.b2b || []).length + " customers" },
        { label: "Reading order history",
          found: orders ? orders.toLocaleString() + " orders" : "nothing" },
        { label: "Organising your business", found: "done" },
      ],
      onCancel: function () { state.source = null; go("S02"); },
      onDone: function () {
        state.mode = "connected";
        state.ingested = true;
        state.model = buildModel();
        save();
        go("S03");
      },
    });
  }

  /* Documents are where this prototype's boundary is, and it reports the
     boundary rather than inventing a figure to cover it. This is the real
     C4/C5 path: a cause, and two ways out. */
  function startFileRead(src, files) {
    runOp({
      title: "Reading your documents",
      steps: [
        { label: "Opening " + files.length + (files.length === 1 ? " file" : " files"),
          found: files.length + " opened" },
        { label: "Extracting the details", found: "nothing" },
      ],
      onCancel: function () { state.source = null; go("S02"); },
      onDone: function () {
        fail({
          title: "We couldn't read those documents",
          cause: "Nothing could be extracted from " +
                 (files.length === 1 ? "that file" : "those " + files.length + " files") +
                 ". Your data is untouched and nothing was added.",
          retry: function () { startFileRead(src, files); },
        });
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
                  return '<div class="ob-orow">' + ICON.plusCircle +
                    '<span class="ob-orow-main"><span class="ob-orow-t">' + esc(u.label) + "</span>" +
                    '<span class="ob-orow-s">Unlocks ' + esc(u.short) + "</span></span>" +
                    '<button class="ob-addlink" data-gap="' + i + '">Add</button></div>';
                }).join("") +
              "</div>" +
            "</section>"
          : "") +
      "</main>" +
      /* The transition is semantic: it names what happens next, not the act
         of moving. */
      '<footer class="ob-foot"><button class="ob-cta" id="b-continue">See what this means</button></footer>'
    );

    const back = $("#b-back");
    if (back) back.addEventListener("click", goBack);
    $$("[data-insp]").forEach(function (b) {
      b.addEventListener("click", function () { openInspectSheet(b.dataset.insp); });
    });
    $$("[data-gap]").forEach(function (b) {
      b.addEventListener("click", function () { openAddEvidenceSheet(m.unlocks[Number(b.dataset.gap)]); });
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
          "<p>" + (state.mode === "sample" ? "The sample business"
                 : esc((state.source && state.source.label) || "Your data") + " export") + "</p>" +
          (pv.from ? "<p>" + esc(pv.from) + " &#8211; " + esc(pv.to) + "</p>" : "") +
          "<p>" + pv.shopsWithHistory + " of your " + pv.totalCustomers + " shops</p>" +
        "</div>",
      actions: '<button class="ob-cta ob-ghost" id="s-close">Close</button>',
      bind: function () { $("#s-close").addEventListener("click", closeSheet); },
    });
  }

  /* SHEET 5 — F11, add evidence. Choosing and reading is still an operation
     the user starts by name, and it still recomputes in place. */
  function openAddEvidenceSheet(gap) {
    let chosen = [];
    openSheet({
      title: "Add " + (gap && gap.label ? gap.label.toLowerCase() : "evidence"),
      body:
        '<p class="ob-sheet-p">Unlocks ' + esc((gap && gap.short) || "more of your business") + ".</p>" +
        '<div class="ob-filepick">' +
          '<label class="ob-chip key">' + ICON.upload + "Choose files" +
            '<input type="file" id="s-files" multiple hidden></label>' +
          '<label class="ob-chip">' + ICON.camera + "Take photo" +
            '<input type="file" id="s-photo" accept="image/*" capture="environment" hidden></label>' +
        "</div>" +
        '<div class="ob-chosen" id="s-chosen"><p class="ob-sheet-p">Nothing chosen yet.</p></div>',
      actions: '<button class="ob-cta" id="s-read" disabled>Read them</button>' +
               '<button class="ob-skip" id="s-cancel">Cancel</button>',
      bind: function () {
        function picked(list) {
          chosen = chosen.concat(Array.prototype.slice.call(list));
          $("#s-chosen").innerHTML = chosen.map(function (f) {
            return '<div class="ob-chosen-r">' + ICON.files + "<span>" + esc(f.name) + "</span></div>";
          }).join("");
          $("#s-read").disabled = !chosen.length;
        }
        $("#s-files").addEventListener("change", function () { picked(this.files); });
        $("#s-photo").addEventListener("change", function () { picked(this.files); });
        $("#s-cancel").addEventListener("click", closeSheet);
        $("#s-read").addEventListener("click", function () {
          runOp({
            title: "Adding " + (gap && gap.label ? gap.label.toLowerCase() : "evidence"),
            steps: [
              { label: "Reading " + chosen.length + (chosen.length === 1 ? " file" : " files"),
                found: chosen.length + " opened" },
              { label: "Matching to your business", found: "nothing" },
            ],
            onCancel: function () { go(state.screen); },
            onDone: function () {
              fail({
                title: "We couldn't read that",
                cause: "Nothing could be matched to your business. Nothing changed, " +
                       "and your data is untouched.",
                retry: function () { openAddEvidenceSheet(gap); },
              });
            },
          });
        });
      },
    });
  }

  /* S03-B — below the floor. There is NO transition: offering one would
     promise a view FoodBridge cannot produce. Each evidence type carries the
     input that actually suits it. */
  function drawS03Below() {
    const needs = [
      { id: "sales", name: "Sales or orders", icon: iconOrders, tint: "t-indigo",
        acts: [{ id: "connect", label: "Connect", icon: ICON.plug, key: true },
               { id: "upload", label: "Upload", icon: ICON.upload }] },
      { id: "invoices", name: "Invoices", icon: ICON.doc, tint: "t-green",
        acts: [{ id: "upload", label: "Upload", icon: ICON.upload },
               { id: "photo", label: "Take photo", icon: ICON.camera }] },
    ];
    render(
      chrome("S03", { back: true }) +
      '<main class="ob-main">' +
        '<h1 class="ob-h1">We need a little more</h1>' +
        '<section class="ob-section">' +
          needs.map(function (n) {
            return '<div class="ob-need">' +
              '<div class="ob-need-h"><span class="ob-mark ' + n.tint + '">' + n.icon + "</span><b>" + esc(n.name) + "</b></div>" +
              '<div class="ob-acts">' +
                n.acts.map(function (a) {
                  return '<button class="ob-chip' + (a.key ? " key" : "") + '" data-need="' + n.id + '" data-act="' + a.id + '">' +
                         a.icon + esc(a.label) + "</button>";
                }).join("") +
              "</div></div>";
          }).join("") +
        "</section>" +
      "</main>"
    );
    const back = $("#b-back");
    if (back) back.addEventListener("click", goBack);
    $$("[data-need]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.dataset.act === "connect") { go("S02"); return; }
        openAddEvidenceSheet({ label: b.dataset.need === "sales" ? "Sales or orders" : "Invoices",
                               short: "more of your business" });
      });
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
              return '<button class="ob-srow" data-route="' + esc(x.route) + '">' +
                '<span class="ob-srow-ic">' + x.icon + "</span>" +
                '<span class="ob-srow-t">' + esc(x.label) + "</span>" +
                '<span class="ob-chev">' + ICON.chev + "</span></button>";
            }).join("") + "</div>"
          : "") +
      "</main>" +
      '<footer class="ob-foot">' +
        (cad.overdue > 0 ? '<button class="ob-cta" id="b-start">Start here</button>' : "") +
        '<button class="ob-skip" id="b-skip">Not now</button>' +
      "</footer>"
    );

    const back = $("#b-back");
    if (back) back.addEventListener("click", goBack);
    const why = $("#b-why");
    if (why) why.addEventListener("click", function () { openWhySheet(m, cad); });
    $$("[data-route]").forEach(function (b) {
      b.addEventListener("click", function () { handoff(b.dataset.route); });
    });
    const st = $("#b-start");
    if (st) st.addEventListener("click", openOpportunity);
    $("#b-skip").addEventListener("click", function () { handoff("dashboard"); });
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
        '<div class="ob-brief">' +
          '<div class="ob-brief-r"><b>' + rec + "</b><span>we can prepare a reorder for</span></div>" +
          '<div class="ob-brief-r"><b>' + st + "</b><span>need your eye — quiet too long to predict</span></div>" +
        "</div>" +
      "</main>" +
      '<footer class="ob-foot">' +
        '<button class="ob-cta" id="b-choose">See the ' + rec + "</button>" +
        '<button class="ob-skip" id="b-skip">Not now</button>' +
      "</footer>"
    );
    const back = $("#b-back");
    if (back) back.addEventListener("click", goBack);
    $("#b-choose").addEventListener("click", function () { state.stage = "choose"; draw(); });
    $("#b-skip").addEventListener("click", function () { handoff("dashboard"); });
  }

  /* F16/F17 — choosing. NOTHING arrives selected: a recommendation that
     selects itself has become a choice the user never made. */
  function drawS05Choose() {
    const rec = recommended(), st = stale();
    const shown = state.showAll ? rec : rec.slice(0, 5);
    const hidden = rec.length - shown.length;
    const n = pickedCount(), r = repeatCount();
    const total = n + r;
    const allOn = n === rec.length;

    render(
      chrome("S05", { back: true }) +
      '<main class="ob-main">' +
        '<div class="ob-selbar">' +
          '<span class="ob-selbar-n">' + total + " selected</span>" +
          '<button class="ob-selbar-a" id="b-all">' + (allOn ? "Clear all" : "Select all " + rec.length) + "</button>" +
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
          ? '<p class="ob-eyebrow">NEED YOUR EYE</p>' +
            '<div class="ob-shops">' +
              st.slice(0, 3).map(function (sh) {
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
            (st.length > 3 ? '<p class="ob-quiet-s">' + (st.length - 3) + " more need your eye</p>" : "")
          : "") +
      "</main>" +
      '<footer class="ob-foot">' +
        '<button class="ob-cta" id="b-prep"' + (total ? "" : " disabled") + ">" +
          (total ? "Prepare " + total + (total === 1 ? " draft" : " drafts") : "Select shops to prepare drafts") +
        "</button>" +
      "</footer>"
    );

    const back = $("#b-back");
    if (back) back.addEventListener("click", goBack);
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
    /* Select all / Clear all acts on the RECOMMENDED list only, which is what
       its own label says. The stale shops are a different decision — repeating
       a past order is a fact, not a prediction — and sweeping them in here
       would make that choice on the user's behalf. */
    const all = $("#b-all");
    if (all) all.addEventListener("click", function () {
      const on = !allOn;
      rec.forEach(function (sh) { state.picked[sh.id] = on; });
      draw();
    });
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
            return '<div class="ob-rec"><span class="ob-rec-a">' + esc(shortName(l.name)) + "</span>" +
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
        state.stage = "prepared";
        save();                                   // C7 — confirmed, so persisted
        draw();
      },
    });
  }

  /* F20 — C9. It reports what actually happened, and the two zeroes are the
     whole point: this prototype prepared drafts and did nothing else. */
  function drawS05Prepared() {
    const d = state.drafts;
    const n = d.list.length;
    render(
      chrome("S05", { back: true }) +
      '<main class="ob-main">' +
        '<div class="ob-done">' +
          '<div class="ob-done-ring">' + ICON.checkBig + "</div>" +
          '<h1 class="ob-done-h">' + n + (n === 1 ? " draft prepared" : " drafts prepared") + "</h1>" +
          '<div class="ob-done-list">' +
            '<div class="ob-done-row"><span>Held for your review</span><b>' + n + "</b></div>" +
            '<div class="ob-done-row"><span>Sent to shops</span><b>' + d.sent + "</b></div>" +
            '<div class="ob-done-row"><span>Written to your accounts</span><b>' + d.written + "</b></div>" +
          "</div>" +
        "</div>" +
      "</main>" +
      '<footer class="ob-foot">' +
        '<button class="ob-cta" id="b-review">Review ' + n + (n === 1 ? " draft" : " drafts") + "</button>" +
        '<button class="ob-skip" id="b-go">Go to FoodBridge</button>' +
      "</footer>"
    );
    const back = $("#b-back");
    if (back) back.addEventListener("click", goBack);
    /* Wrapped, not passed by reference: openDraftsSheet's first argument
       selects a single draft, and a bare handler would hand it the click
       event instead — which is not an index, and is not null either. */
    $("#b-review").addEventListener("click", function () { openDraftsSheet(); });
    $("#b-go").addEventListener("click", function () { handoff("customer-management/stock-audit-health"); });
  }

  /* SHEET 9 — F21, the drafts. Quantities are editable; the suggested figure
     sits beside each one and never moves. Discarding is explicit. */
  function openDraftsSheet(only) {
    const d = state.drafts;
    const list = only != null ? [d.list[only]] : d.list;

    openSheet({
      title: only != null ? list[0].name : "Your drafts",
      count: only != null ? null : d.list.length,
      body: list.map(function (dr, idx) {
        const i = only != null ? only : idx;
        return '<div class="ob-draft">' +
          (only != null ? "" : '<div class="ob-draft-h"><b>' + esc(dr.name) + "</b>" +
            '<span class="ob-draft-b">' + (dr.basis === "recommended" ? "Suggested" : "Repeat") + "</span></div>") +
          '<div class="ob-draft-lines">' +
            dr.lines.map(function (l, li) {
              return '<div class="ob-dl">' +
                '<span class="ob-dl-n">' + esc(shortName(l.name)) + "</span>" +
                (l.suggestedQty != null
                  ? '<span class="ob-dl-s">' + l.suggestedQty + " suggested</span>"
                  : '<span class="ob-dl-s">last ordered</span>') +
                '<input class="ob-dl-q" type="number" min="0" value="' + l.qty +
                  '" data-d="' + i + '" data-l="' + li + '" aria-label="Quantity">' +
              "</div>";
            }).join("") +
          "</div>" +
        "</div>";
      }).join(""),
      actions: '<button class="ob-cta ob-ghost" id="s-close">Close</button>' +
               '<button class="ob-skip is-warn" id="s-discard">Discard all drafts</button>',
      bind: function () {
        $$(".ob-dl-q").forEach(function (inp) {
          inp.addEventListener("change", function () {
            const dr = state.drafts.list[Number(inp.dataset.d)];
            const q = Math.max(0, parseInt(inp.value, 10) || 0);
            inp.value = q;
            /* Only `qty` moves. `suggestedQty` is what FoodBridge proposed and
               is the one thing an edit must never overwrite. */
            dr.lines[Number(inp.dataset.l)].qty = q;
            save();
          });
        });
        $("#s-close").addEventListener("click", closeSheet);
        $("#s-discard").addEventListener("click", function () {
          state.sheet = null;
          state.drafts = null;
          state.stage = "choose";
          save();
          draw();
        });
      },
    });
  }

  /* ---------------------------------------------------------------- run */

  function draw() {
    if (state.op) return drawOp();
    if (state.screen === "S01") return drawS01();
    if (state.screen === "S02") return drawS02();
    if (state.screen === "S03") return drawS03();
    if (state.screen === "S05") return drawS05();
    return drawS04();
  }

  function mount() {
    if (!window.FB_EVIDENCE) throw new Error("evidence.js must load before onboarding.js");
    restore();                                   // C7 — a reload lands where it left
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.sheet) closeSheet();
    });
    draw();
  }

  window.FB_ONBOARDING = {
    mount, buildModel, buildOpportunity, supportingSignals, openOpportunity,
    runOp, cancelOp, openSheet, closeSheet, goBack, draw, save, restore, forget, state,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = window.FB_ONBOARDING;
})();

/* ==========================================================================
   ONBOARDING — five locked screens, nine contextual sheets, one small router.

   Draws O-001's locked UX under the Production UX Contract recorded as D-018.
   ux/FLOW-MAP.md is canonical; nothing here adds to it. The four rules the
   flow was built under are in ../../../VERSION.md, argued in ../../../context/.

     F01 Business profile          S01
     S02-A How do you want to bring…   S02   Connect an app · Upload files
     S02-C Connect an app                      Zoho Books | Xero → CONSENT SHEET → the app
     S02-S Reading your <app>                  SYSTEM — real progress, Stop
     S02-F Add your business files             each file says what it holds; a result per file
           DataReady                           the one hand-off to S03 (dataset.js)
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
     C6  provenance      provenanceChip() on every screen after S02, naming the
                         user's own source; a new source replaces, after asking
     C7  persistence     save()/restore() — DataReady, read files, CONFIRMED drafts
     C8  navigation      goBack() closes a sheet before it leaves a screen,
                         and asks before discarding unconfirmed work
     C9  completion      drawS05Prepared() reports held / sent / written
     C10 placement       primary screens carry state, decision, action. Every
                         explanation in this file is inside a sheet.

   ── WHAT IS REAL ─────────────────────────────────────────────────────────
     Zoho Books, Xero     a real sign-in and a read-only read, through the
                          bridge (zoho-function/onboarding.js, xero.js)
     Excel and CSV files  read in this browser by dataset.js; not uploaded
     window.FB_PREDICT    the back-tested reorder engine
     window.FB_EVIDENCE   the evidence layer
     window.FB_ICONS      the product's lucide icon set

   S03 onward sees ONLY the Dataset S02 handed over, through engine(). There is
   no demonstration business in this flow and no global it can fall back to.
   Development stand-ins for both readers exist (readers-mock.js) and are
   reachable only on localhost with ?fbmock=…; see readers.js.

   Drafts are real in the browser: prepared, held, editable, and reachable
   afterwards at #/sales-orders/order-drafts. Sent to nobody, written nowhere.

   Receivables, collections, overdue value, capital tied and margin need
   evidence this flow does not read, and are ABSENT — not zeroed, not greyed.
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
    uploadBig: lu('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>', 22),
    chevDown: lu('<path d="m6 9 6 6 6-6"/>', 16),
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

  /* Onboarding is Steps 1-3. S04 and S05 are activation and carry no counter
     (D-018) — a progress bar that never completes is a promise we break. */
  const STEPS = { S01: 0, S02: 1, S03: 2 };
  const STORE_KEY = "fb.v7.onboarding";

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
    dataReady: null,       // S02's ONE hand-off: {provenance, readAt, dataset, notes}
    engine: null,          // the engines' view of dataReady, derived, never stored
    s02: "A",              // "A" how · "C" connect an app · "F" upload files
    conn: idleConn(),      // the app sign-in and read in progress (Zoho Books or Xero), never persisted
    files: [],             // [{id, name, type, status, reason, file, result}]
    filesRun: null,        // the file read in progress
    later: { files: [], run: null },  // S03 "Add later": files and photos chosen, and the read in progress
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

  /* The source, in the user's words. Only ever a real source: this flow has
     no demonstration mode for a label to describe. */
  function provenanceLabel() {
    const dr = state.dataReady;
    if (!dr) return "";
    const extra = (dr.provenance.additions || []).length;
    const more = extra ? " + " + extra + (extra === 1 ? " file" : " files") : "";
    if (APPS[dr.provenance.kind]) return "Your " + APPS[dr.provenance.kind].name + " \u00b7 " + dr.provenance.org.name + more;
    return "Your uploaded files" + more;
  }

  /* ------------------------------------------------------- C7 persistence */

  /* Mode and CONFIRMED drafts only. An unconfirmed selection is deliberately
     not persisted: resurrecting a choice somebody abandoned is the reload
     behaving as if they had agreed to it. */
  /* The whole Zoho records can be larger than the browser will keep for a tab.
     When they are, the tab keeps the normalised Dataset without them rather
     than keeping nothing -- the page itself still holds everything it read. */
  function withoutRaw(dr) {
    if (!dr) return dr;
    return JSON.parse(JSON.stringify(dr, function (k, v) { return k === "raw" ? undefined : v; }));
  }

  function save() {
    try { writeStore(state.dataReady); }
    catch (e) {
      try { writeStore(withoutRaw(state.dataReady)); } catch (e2) { /* storage blocked: the flow still works */ }
    }
  }

  function writeStore(dataReady) {
    {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({
        screen: state.screen,
        s02: state.s02,
        dataReady: dataReady,
        /* Files the user READ, or tried to, survive a reload with their result.
           Files only chosen do not: the browser cannot hand the file back, and
           resurrecting an unconfirmed choice is the reload deciding for them. */
        files: state.files.filter(function (f) { return f.status !== "new"; }).map(function (f) {
          const busy = f.status === "waiting" || f.status === "reading";
          return { id: f.id, name: f.name, tags: f.tags || null, choices: f.choices || null,
                   status: busy ? "failed" : f.status, reason: busy ? "interrupted" : f.reason,
                   result: f.status === "read" ? f.result : null };
        }),
        profile: state.profile,
        gstVerifiedFor: state.gstVerifiedFor,
        gstResult: state.gstResult,
        parked: state.parked,
        drafts: state.drafts,
      }));
    }
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
    const v = readStore();
    if (!v) return false;

    /* What the user TYPED survives a reload whether or not they got further. */
    state.profile = v.profile || state.profile;
    state.gstVerifiedFor = v.gstVerifiedFor || "";
    state.gstResult = v.gstResult || null;
    state.s02 = v.s02 || "A";
    state.files = (v.files || []).map(function (f) {
      // a tab from before files said what they hold kept { records } under one type
      if (f.type && !f.tags) { f.tags = [f.type]; delete f.type; }
      if (f.result && f.result.records && !f.result.found) f.result = { found: [{ type: f.tags[0], records: f.result.records, skipped: f.result.skipped || [] }] };
      // a read file that lost its records cannot be used; say so, keep it replaceable
      if (f.status === "read" && !(f.result && f.result.found && f.result.found.length)) return Object.assign(f, { status: "failed", reason: "missing" });
      return Object.assign(f, { file: null });
    });
    state.dataReady = v.dataReady || null;
    state.parked = !!v.parked;

    if (!state.dataReady) {
      if (v.screen === "S02") { state.screen = "S02"; return true; }
      return false;
    }
    if (v.drafts && v.drafts.list && v.drafts.list.length) {
      state.drafts = v.drafts;
      state.opp = buildOpportunity();
      state.stage = "prepared";
      state.screen = "S05";
    } else if (v.screen === "S02" || v.screen === "S03" || v.screen === "S04") {
      state.screen = v.screen;
    } else {
      state.model = buildModel();
      state.screen = state.model.floor.met ? "S04" : "S03";
    }
    return true;
  }

  function forget() {
    try { sessionStorage.removeItem(STORE_KEY); } catch (e) { /* as above */ }
  }

  /* ---------------------------------------------------------------- data */

  /* The engines see the Dataset S02 handed over, and nothing else. Before a
     hand-off there is nothing at all, which is what stops S03 and S04 from
     showing anything a stray call could produce. */
  const EMPTY_ENGINE = { seed: { products: [], b2b: [] }, history: {}, presence: { invoices: false, stockQuantities: false } };
  function engine() {
    if (!state.dataReady) return EMPTY_ENGINE;
    return state.engine || (state.engine = window.FB_DATASET.toEngine(state.dataReady.dataset));
  }

  function buildModel() {
    const e = engine();
    return window.FB_EVIDENCE.build({ seed: e.seed, history: e.history, presence: e.presence, predict: window.FB_PREDICT });
  }

  function buildOpportunity() {
    const e = engine();
    return window.FB_EVIDENCE.missedOrders({ seed: e.seed, history: e.history, predict: window.FB_PREDICT });
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
        /* The denominator is only the products whose stock the source supplied;
           when some were not, the label says so rather than implying the
           whole catalogue was counted. */
        label: s.stock_position.outOfStock + " of " + s.stock_position.catalogue +
               (s.stock_position.untracked ? " tracked" : "") + " products are out of stock",
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

  /* Every move between screens is remembered, so a reload on S04 comes back to
     S04 -- not to S02, which is where the data was last handed over. */
  function go(screen) { state.screen = screen; if (state.dataReady) save(); draw(); }

  /* C6 — provenance, on every screen after S02, and never ambiguous. It names
     the user's own source and is a button, because "whose data am I looking
     at?" has an answer, and that answer belongs in a sheet. */
  function provenanceChip() {
    const label = provenanceLabel();
    if (!label) return "";
    const kind = state.dataReady.provenance.kind;
    return '<button class="ob-prov" id="b-prov">' + (APPS[kind] ? ICON.cloud : ICON.files) +
           "<span>" + esc(label) + "</span></button>";
  }

  function readAtText(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) + ", " +
           d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  }

  /* SHEET — what the chip means. */
  function openProvenanceSheet() {
    const dr = state.dataReady;
    if (!dr) return;
    const TL = { orders: "Orders", customers: "Customers", products: "Products", invoices: "Invoices" };
    openSheet({
      title: "Where this data comes from",
      body: (APPS[dr.provenance.kind]
        ? '<p class="ob-sheet-p">Read from your ' + esc(APPS[dr.provenance.kind].name) + ' \u00b7 ' + esc(dr.provenance.org.name) +
            " on " + esc(readAtText(dr.readAt)) + ".</p>" +
          '<p class="ob-sheet-eyebrow">' + ICON.lock + "WHAT DIDN'T CHANGE</p>" +
          '<ul class="ob-sheet-ul"><li>FoodBridge only read.</li><li>Nothing in ' + esc(APPS[dr.provenance.kind].name) + ' was changed.</li></ul>'
        : '<p class="ob-sheet-p">Read from the files you added on ' + esc(readAtText(dr.readAt)) + ".</p>" +
          '<div class="ob-reclist">' + dr.provenance.files.map(function (f) {
            const kinds = (f.types || (f.type ? [f.type] : [])).map(function (t) { return TL[t] || t; }).join(" \u00b7 ");
            return '<div class="ob-rec"><span class="ob-rec-a">' + esc(f.name) + "</span>" +
                   '<span class="ob-rec-b">' + esc(kinds) + "</span></div>";
          }).join("") + "</div>") +
        /* Added on S03 after the original read: each named, with how it came in. */
        ((dr.provenance.additions || []).length
          ? '<p class="ob-sheet-eyebrow">' + ICON.plusCircle + "ADDED AFTERWARDS</p>" +
            '<div class="ob-reclist">' + dr.provenance.additions.map(function (f) {
              return '<div class="ob-rec"><span class="ob-rec-a">' + esc(f.name) + "</span>" +
                     '<span class="ob-rec-b">' + esc((LATER_TYPE_LABEL[f.type] || f.type) + (f.via === "photo" ? " \u00b7 photo" : "")) + "</span></div>";
            }).join("") + "</div>"
          : ""),
      actions: '<button class="ob-cta ob-ghost" id="s-close">Close</button>' +
               '<button class="ob-skip" id="s-leave">Use different data</button>',
      bind: function () {
        $("#s-close").addEventListener("click", closeSheet);
        $("#s-leave").addEventListener("click", function () {
          state.sheet = null;
          /* From the drafts destination this has to go back to the flow, not
             re-render the destination it was opened from. */
          if (state.view === "drafts") { state.s02 = "A"; state.screen = "S02"; save(); handoff("onboarding"); return; }
          goS02("A");
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
    const chip = screen === "S01" || screen === "S02" ? "" : provenanceChip();
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
    if (state.screen === "S02") {
      if (state.conn.phase === "reading") { stopAppRead(); return; }
      if (state.s02 === "C") { state.conn = idleConn(); goS02("A"); return; }
      if (state.s02 === "F") { leaveFiles(); return; }
      go("S01");
      return;
    }
    if (state.screen === "S03") { if (state.later.run) { stopLaterRead(); return; } goS02("A"); return; }
    if (state.screen === "S04") { go("S03"); return; }
    if (state.screen === "S05") {
      if (state.stage === "choose") { confirmLeaveSelection(function () { state.stage = "brief"; draw(); }); return; }
      if (state.stage === "prepared") { state.screen = "S04"; draw(); return; }
      go("S04");
    }
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

  /* S02 answers ONE question — how do you want to bring your business data in —
     and ends in ONE hand-off, DataReady (see dataset.js). Two real paths, one
     decision per surface:

       S02-A  choose how            Connect an app · Upload files
       S02-C  Connect an app        Zoho Books · Xero · My app isn't listed
       S02-S  Reading your <app>       (Customers · Products · Orders, Stop)
       S02-F  Add your business files   (each file says what it holds; a
                                        result per file, in business words)

     Every read starts from a named gesture. Nothing says "connected" before a
     genuine return from Zoho. A failed file never costs the files that read.
     A new source replaces the old data as a whole, after asking. */

  const RD = function () { return window.FB_READERS; };
  const OAUTH_KEY = "fb.v7.zoho.pending";     // { n, app, at } — the sign-in this tab is waiting on

  const TYPE_LABEL = { orders: "Orders", customers: "Customers", products: "Products", invoices: "Invoices" };
  const TYPE_HELP = {
    orders: "Sales orders or order history",
    customers: "The shops and buyers you sell to",
    products: "Your items or price list",
    invoices: "Bills you've sent to customers",
  };
  const TYPE_NEEDS = {
    orders: "An orders file needs a date, a customer, a product and a quantity on each line.",
    customers: "A customers file needs a name for each customer.",
    products: "A products file needs a name for each product.",
    invoices: "An invoices file needs a date, a customer and an amount for each invoice.",
  };
  const FILE_PROBLEM = {
    unsupported: "FoodBridge can't read this kind of file. Use Excel or CSV.",
    damaged: "This file is empty or damaged.",
    protected: "This file is password-protected. Remove the password and add it again.",
    too_large: "This file is too large. The limit is 20 MB.",
    interrupted: "Reading this file didn't finish.",
    missing: "Add this file again to read it.",
  };
  const ACCEPT = ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  /* The apps a user can connect. Each is the same channel on the bridge
     (/api/<id>/ready, start, orgs, read) and the same screens here; what
     differs is the name, the mark, what it reads, and what it calls a
     business. `reads` is what the consent sheet promises, in the user's
     words, and must match what the bridge actually asks for. */
  const APPS = {
    zoho: {
      name: "Zoho Books", short: "Zoho", logo: "zoho.svg", wide: true,
      reads: "Customers &#183; Products &#183; Orders &#183; Invoices &#183; Payments &#183; Credit notes &#183; Estimates &#183; Vendors &#183; Purchase orders &#183; Bills &#183; Expenses",
      noorg: "This Zoho account doesn't have a Zoho Books business.",
    },
    xero: {
      name: "Xero", short: "Xero", logo: "xero.svg", wide: false,
      /* Xero has no sales orders: its invoices are read as the orders. */
      reads: "Customers &#183; Products &#183; Invoices, as your orders &#183; Payments &#183; Credit notes &#183; Quotes &#183; Suppliers &#183; Purchase orders &#183; Bills",
      noorg: "This Xero login doesn't have an organisation FoodBridge can read.",
    },
  };
  const NOT_CONNECTED = function (why, app) {
    const n = APPS[app].short;
    return {
      denied: "You didn't allow access in " + n + ", so nothing was read.",
      failed: n + " couldn't finish signing you in. Nothing was read.",
      unreachable: "We couldn't reach " + n + " just now. Nothing was read.",
    }[why];
  };
  const READ_FAILED = function (reason, app) {
    const n = APPS[app].short;
    return {
      unavailable: n + " stopped responding. Nothing was kept.",
      timeout: n + " stopped responding. Nothing was kept.",
      busy: n + " is busy right now. Nothing was kept. Try again in a few minutes.",
      daily_limit: n + " has reached today's limit for reading this account. Nothing was kept. Try again tomorrow.",
      expired: "Your " + n + " sign-in expired before we finished. Nothing was kept.",
      forbidden: "This " + n + " login can't see your orders. Try again with the account owner's login.",
      noorg: APPS[app].noorg,
    }[reason];
  };

  const plural = function (n, one, many) { return n + " " + (n === 1 ? one : many); };

  function drawS02() {
    if (state.conn.phase === "reading") return drawAppReading();
    if (state.s02 === "C") return drawS02C();
    if (state.s02 === "F") return drawS02F();
    return drawS02A();
  }

  function goS02(sub) { state.s02 = sub; state.screen = "S02"; save(); draw(); }

  /* ── S02-A · how ─────────────────────────────────────────────────────── */

  /* The two ways in wear real marks, as the apps on S02-C do: Connect an app
     shows the apps themselves; Upload files a spreadsheet document. */
  const MARK_CONNECT = '<span class="ob-mark ob-mark-logo ob-mark-cluster" aria-hidden="true">' +
    ["zoho.svg", "vyapar.png", "quickbooks.svg", "xero.svg"].map(function (f) {
      return '<img src="logos/' + f + '" alt="" width="18" height="18">';
    }).join("") + "</span>";
  const MARK_UPLOAD = '<span class="ob-mark ob-mark-logo" aria-hidden="true"><img class="ob-logo is-big" src="logos/spreadsheet.svg" alt="" width="40" height="40"></span>';

  function pathRow(id, mark, title, sub, on) {
    return '<button class="ob-source ob-path' + (on ? " is-on" : "") + '" data-path="' + id + '">' +
      mark +
      '<span class="ob-path-main"><span class="ob-source-t">' + esc(title) + "</span>" +
        '<span class="ob-path-s">' + sub + "</span></span>" +
      '<span class="ob-chev">' + ICON.chev + "</span></button>";
  }

  function drawS02A() {
    const dr = state.dataReady;
    const kind = dr && dr.provenance.kind;
    const doneSub = function (text) { return '<span class="ob-path-ok">' + ICON.check + esc(text) + "</span>"; };
    render(
      chrome("S02", { back: true }) +
      '<main class="ob-main">' +
        '<h1 class="ob-h1">How do you want to bring your business data into FoodBridge?</h1>' +
        '<div class="ob-sources">' +
          pathRow("connect", MARK_CONNECT, "Connect an app",
            APPS[kind] ? doneSub("Your " + APPS[kind].name + " · " + dr.provenance.org.name)
                       : esc("Link the system you already use to manage your business"), !!APPS[kind]) +
          pathRow("upload", MARK_UPLOAD, "Upload files",
            kind === "files" ? doneSub(plural(dr.provenance.files.length, "file", "files") + " read")
                             : esc("Add orders, customers, products or invoices"), kind === "files") +
        "</div>" +
      "</main>" +
      (dr ? '<footer class="ob-foot"><button class="ob-cta" id="b-continue">Continue</button></footer>' : "")
    );
    $$("[data-path]").forEach(function (b) {
      b.addEventListener("click", function () { goS02(b.dataset.path === "connect" ? "C" : "F"); });
    });
    const c = $("#b-continue");
    if (c) c.addEventListener("click", function () { go("S03"); });
  }

  /* Starting a read that would REPLACE data the user already has asks first.
     The old data stays in use until the new read has actually produced
     something, so a failed or stopped replacement costs nothing. */
  function confirmReplaceThen(nextKind, then) {
    const dr = state.dataReady;
    const drafts = state.drafts && state.drafts.list ? state.drafts.list.length : 0;
    if (!dr || (nextKind === "files" && dr.provenance.kind === "files" && !drafts)) return then();
    openSheet({
      title: "Replace your current data?",
      body:
        '<p class="ob-sheet-p">FoodBridge will use ' +
          (APPS[nextKind] ? "your " + APPS[nextKind].name : "your uploaded files") + " instead. " +
          (APPS[dr.provenance.kind] ? "The " + APPS[dr.provenance.kind].name + " account isn't changed." : "Your files aren't changed.") +
        "</p>" +
        (drafts ? '<p class="ob-sheet-p">The ' + plural(drafts, "draft", "drafts") + " you prepared will be discarded.</p>" : ""),
      actions: '<button class="ob-cta" id="s-replace">Replace</button>' +
               '<button class="ob-skip" id="s-cancel">Cancel</button>',
      bind: function () {
        $("#s-replace").addEventListener("click", function () { state.sheet = null; then(); });
        $("#s-cancel").addEventListener("click", closeSheet);
      },
    });
  }

  /* The ONE place DataReady is emitted. Everything derived from the previous
     data goes with it: S03 onward must never mix two sources. */
  function emitDataReady(ready) {
    state.dataReady = ready;
    state.engine = null;
    state.model = null; state.opp = null; state.drafts = null;
    state.picked = {}; state.repeats = {}; state.stage = "brief";
    state.parked = false; state.undo = null; state.draftEdit = null;
    state.showAll = false; state.showAllStale = false;
    state.sheet = null;
    if (APPS[ready.provenance.kind]) state.files = [];
    state.s02 = "A";
    save();
    go("S03");
  }

  /* ── S02-C · Connect an app ──────────────────────────────────────────── */

  /* Each app's own mark (see logos/SOURCES.md). Decorative: the name beside it
     is what a screen reader announces. */
  const logo = function (file, wide) { return '<img class="ob-logo' + (wide ? " is-wide" : "") + '" src="logos/' + file + '" alt="" width="32" height="32">'; };
  const LIVE_APPS = ["zoho", "xero"];
  const SOON_APPS = [
    { label: "Tally", icon: logo("tally.png", true) },
    { label: "Vyapar", icon: logo("vyapar.png") },
    { label: "QuickBooks Online", icon: logo("quickbooks.svg") },
  ];

  function drawS02C() {
    const connected = state.conn.phase === "connected";
    render(
      chrome("S02", { back: true }) +
      '<main class="ob-main">' +
        '<h1 class="ob-h1">Connect an app</h1>' +
        '<div class="ob-sources">' +
          LIVE_APPS.map(function (id) {
            const a = APPS[id];
            const on = connected && state.conn.app === id;
            return '<button class="ob-source ob-path" data-app="' + id + '"' + (connected ? " disabled" : "") + ">" +
              '<span class="ob-mark ob-mark-logo">' + logo(a.logo, a.wide) + "</span>" +
              '<span class="ob-path-main"><span class="ob-source-t">' + esc(a.name) + "</span>" +
                '<span class="ob-path-s">' +
                  /* Only a genuine return from the app gets here. */
                  (on ? '<span class="ob-path-ok">' + ICON.check + esc(a.name) + " connected</span>"
                      : "Connect your " + esc(a.name) + " account") +
                "</span></span>" +
              '<span class="ob-chev">' + (on ? '<span class="ob-spin"></span>' : ICON.chev) + "</span></button>";
          }).join("") +
          /* Added 17 Sep 2026 at the product owner's request. They are not
             buttons: nothing happens on a tap, and each says plainly that it
             is not available yet, so an unbuilt source never looks usable. */
          SOON_APPS.map(function (a) {
            return '<div class="ob-source ob-path is-soon" aria-disabled="true">' +
              '<span class="ob-mark ob-mark-logo">' + a.icon + "</span>" +
              '<span class="ob-path-main"><span class="ob-source-t">' + esc(a.label) + "</span></span>" +
              '<span class="ob-soon">Coming soon</span></div>';
          }).join("") +
        "</div>" +
        '<button class="ob-textlink" id="b-notlisted">My app isn\'t listed</button>' +
      "</main>"
    );
    $$("[data-app]").forEach(function (b) {
      b.addEventListener("click", function () { if (!connected) openAppConsent(b.dataset.app, false); });
    });
    $("#b-notlisted").addEventListener("click", openNotListed);
  }

  function openNotListed() {
    openSheet({
      title: "Can't find your app?",
      body: '<p class="ob-sheet-p">FoodBridge connects to Zoho Books and Xero today. You can still bring your data in ' +
            "by uploading files exported from your app.</p>",
      actions: '<button class="ob-cta" id="s-upload">Upload files instead</button>' +
               '<button class="ob-skip" id="s-close">Close</button>',
      bind: function () {
        $("#s-upload").addEventListener("click", function () { state.sheet = null; goS02("F"); });
        $("#s-close").addEventListener("click", closeSheet);
      },
    });
  }

  /* C1 — the tap opened this; nothing has been read or started. */
  function openAppConsent(app, busy) {
    const a = APPS[app];
    openSheet({
      title: "Connect " + a.name,
      busy: busy,
      body:
        '<p class="ob-sheet-p">You\'ll sign in to ' + esc(a.short) + ' and allow FoodBridge to read your business records.</p>' +
        '<p class="ob-sheet-eyebrow">' + ICON.shield + "WHAT WE'LL READ</p>" +
        /* Updated 17 Sep 2026 by the product owner's decision to read every
           module the app will show: the sheet names all of it. */
        '<p class="ob-sheet-p">' + a.reads + "</p>" +
        '<p class="ob-sheet-eyebrow">' + ICON.lock + "WHAT WON'T CHANGE</p>" +
        '<ul class="ob-sheet-ul"><li>FoodBridge only reads.</li><li>Nothing in ' + esc(a.name) + ' is changed.</li></ul>',
      actions: busy
        ? '<button class="ob-cta ob-cta-busy" disabled><span class="ob-spin"></span>Opening ' + esc(a.short) + '…</button>'
        : '<button class="ob-cta" id="s-go">Continue to ' + esc(a.short) + '</button>' +
          '<button class="ob-skip" id="s-cancel">Cancel</button>',
      bind: function () {
        if (busy) return;
        $("#s-go").addEventListener("click", function () { confirmReplaceThen(app, function () { startAppSignIn(app); }); });
        $("#s-cancel").addEventListener("click", closeSheet);
      },
    });
  }

  function clearPending() { try { sessionStorage.removeItem(OAUTH_KEY); } catch (e) { /* storage blocked */ } }

  /* Leaves FoodBridge for Zoho, in the same tab. The nonce is how the return
     proves it belongs to a sign-in THIS tab started. */
  function startAppSignIn(app) {
    const nonce = RD().newNonce();
    try { sessionStorage.setItem(OAUTH_KEY, JSON.stringify({ n: nonce, app: app, at: Date.now() })); } catch (e) { /* see below */ }
    state.conn = idleConn(app);
    state.screen = "S02"; state.s02 = "C";
    save();
    openAppConsent(app, true);
    RD().apps[app].auth.begin(nonce, RD().returnUrl()).catch(function () {
      clearPending();
      openNotConnected("unreachable", app);
    });
  }

  function idleConn(app) { return { app: app || null, phase: "idle", handle: null, org: null, run: null, progress: null }; }
  /* The app the connection in progress, or the data in use, belongs to. */
  function connApp() { return state.conn.app || (state.dataReady && APPS[state.dataReady.provenance.kind] ? state.dataReady.provenance.kind : "zoho"); }
  function A() { return APPS[connApp()]; }

  /* Runs once, on load. Three ways to arrive here after leaving for Zoho:
     a result in the URL, nothing at all (the user pressed Back), or a result
     this tab never asked for. Only the first, with a matching nonce and a
     handle, is ever called connected. */
  function handleAppReturn() {
    const ret = RD().takeReturn();
    let pending = null;
    try { pending = JSON.parse(sessionStorage.getItem(OAUTH_KEY) || "null"); } catch (e) { pending = null; }
    if (!ret && !pending) return;
    clearPending();
    const app = APPS[ret ? ret.app : pending && pending.app] ? (ret ? ret.app : pending.app) : "zoho";
    state.screen = "S02"; state.s02 = "C";
    state.conn = idleConn(app);
    if (!ret) return;                                     // Back from the app: quietly here
    // A result this tab never asked for, or for a different app than it asked
    // for, is not a connection.
    if (!pending || ret.n !== pending.n || (pending.app && pending.app !== ret.app)) { state.sheet = notConnectedSheet("failed", app); return; }
    if (ret.result === "denied") { state.sheet = notConnectedSheet("denied", app); return; }
    if (ret.result !== "connected" || !ret.c) { state.sheet = notConnectedSheet("failed", app); return; }
    state.conn.handle = ret.c;
    state.conn.phase = "connected";
    discoverOrganisations();
  }

  function notConnectedSheet(why, app) {
    return {
      title: APPS[app].name + " wasn't connected",
      body: '<p class="ob-sheet-p">' + esc(NOT_CONNECTED(why, app) || NOT_CONNECTED("failed", app)) + "</p>",
      actions: '<button class="ob-cta" id="s-retry">Try again</button>' +
               '<button class="ob-skip" id="s-upload">Upload files instead</button>',
      bind: function () {
        $("#s-retry").addEventListener("click", function () { state.sheet = null; startAppSignIn(app); });
        $("#s-upload").addEventListener("click", function () { state.sheet = null; goS02("F"); });
      },
    };
  }
  function openNotConnected(why, app) { state.conn = idleConn(app); state.s02 = "C"; openSheet(notConnectedSheet(why, app)); }

  function discoverOrganisations() {
    const handle = state.conn.handle, app = state.conn.app;
    RD().apps[app].reader.organisations(handle).then(function (orgs) {
      if (state.conn.handle !== handle || state.conn.phase !== "connected") return;
      if (!orgs.length) { state.conn = idleConn(app); return openReadFailed("noorg", null); }
      if (orgs.length === 1) return startAppRead(orgs[0]);
      openChooseOrg(orgs);
    }, function (err) {
      if (state.conn.handle !== handle) return;
      state.conn.phase = "idle";
      openReadFailed((err && err.reason) || "unavailable", null);
    });
  }

  /* A decision, so NOTHING is selected until the user selects it. */
  function openChooseOrg(orgs) {
    let picked = -1;
    openSheet({
      title: "Which business should FoodBridge read?",
      body: '<div class="ob-choices" role="radiogroup">' +
        orgs.map(function (o, i) {
          return '<button class="ob-choice" role="radio" aria-checked="false" data-org="' + i + '">' +
            '<span class="ob-radio"></span><span class="ob-choice-t">' + esc(o.name) + "</span></button>";
        }).join("") + "</div>",
      actions: '<button class="ob-cta" id="s-read" disabled>Read this business</button>' +
               '<button class="ob-skip" id="s-cancel">Cancel</button>',
      onClose: function () { state.conn = idleConn(state.conn.app); },
      bind: function () {
        $$("[data-org]").forEach(function (b) {
          b.addEventListener("click", function () {
            picked = Number(b.dataset.org);
            $$("[data-org]").forEach(function (x) {
              const on = Number(x.dataset.org) === picked;
              x.classList.toggle("is-on", on);
              x.setAttribute("aria-checked", on ? "true" : "false");
            });
            $("#s-read").disabled = false;
          });
        });
        $("#s-read").addEventListener("click", function () {
          if (picked < 0) return;
          state.sheet = null;
          startAppRead(orgs[picked]);
        });
        $("#s-cancel").addEventListener("click", closeSheet);
      },
    });
  }

  function startAppRead(org) {
    const app = state.conn.app;
    const run = { stopped: false };
    state.conn.phase = "reading";
    state.conn.org = org;
    state.conn.run = run;
    state.conn.progress = { customers: "reading", products: "waiting", orders: "waiting", others: "waiting", done: 0, total: null };
    state.sheet = null;
    state.screen = "S02";
    draw();
    RD().apps[app].reader.read(state.conn.handle, org, {
      shouldStop: function () { return run.stopped; },
      onProgress: function (p) {
        if (run.stopped || state.conn.run !== run) return;
        state.conn.progress = p;
        if (state.screen === "S02" && !state.sheet) drawAppReading();
      },
    }).then(function (raw) {
      if (run.stopped || state.conn.run !== run || !raw) return;
      state.conn = idleConn();                // the handle is not kept past the read
      raw.app = app;
      emitDataReady(window.FB_DATASET.fromApp(raw));
    }, function (err) {
      if (run.stopped || state.conn.run !== run) return;
      state.conn.phase = "idle";
      state.conn.run = null;
      state.conn.progress = null;
      openReadFailed((err && err.reason) || "unavailable", org);
    });
  }

  /* Stop keeps NOTHING. A half-read account labelled "Your Zoho Books" would
     misrepresent the user's own books. */
  function stopAppRead() {
    if (state.conn.run) state.conn.run.stopped = true;
    state.conn = idleConn(state.conn.app);
    state.s02 = "C";
    draw();
  }

  function drawAppReading() {
    const p = state.conn.progress || {};
    const a = A();
    /* The fourth step exists because the read now takes in more than the three
       the screen was designed with; progress must not sit on a ticked "Orders"
       while invoices and purchases are still being read. */
    const steps = [["customers", "Customers"], ["products", "Products"], ["orders", state.conn.app === "xero" ? "Invoices, as orders" : "Orders"],
                   ["others", state.conn.app === "xero" ? "Payments, quotes and purchases" : "Invoices, payments and purchases"]];
    render(
      chrome("S02", { back: true }) +
      '<main class="ob-main ob-main-op">' +
        '<h1 class="ob-h1">Reading your ' + esc(a.name) + '</h1>' +
        '<p class="ob-sub">' + esc(state.conn.org ? state.conn.org.name : "") + "</p>" +
        '<div class="ob-proc">' +
          steps.map(function (s) {
            const st = p[s[0]];
            const done = st === "done", active = st === "reading";
            const count = s[0] === "orders" && active && p.total != null
              ? '<span class="ob-pv">' + p.done.toLocaleString() + " of " + p.total.toLocaleString() + "</span>" : "";
            return '<div class="ob-pstep ' + (done ? "is-done" : active ? "is-active" : "") + '">' +
              '<span class="ob-pdot">' + (done ? ICON.check : active ? '<span class="ob-spin"></span>' : "") + "</span>" +
              '<span class="ob-pt">' + s[1] + "</span>" + count + "</div>";
          }).join("") +
        "</div>" +
      "</main>" +
      '<footer class="ob-foot"><button class="ob-skip" id="b-stop">Stop</button></footer>'
    );
    $("#b-stop").addEventListener("click", stopAppRead);
  }

  function openReadFailed(reason, org) {
    state.screen = "S02"; state.s02 = "C";
    const app = state.conn.app || "zoho";
    const signInAgain = !org || reason === "expired" || reason === "forbidden" || reason === "noorg" || !state.conn.handle;
    openSheet({
      title: "We couldn't finish reading your " + APPS[app].name,
      body: '<p class="ob-sheet-p">' + esc(READ_FAILED(reason, app) || READ_FAILED("unavailable", app)) + "</p>",
      actions: '<button class="ob-cta" id="s-retry">Try again</button>' +
               '<button class="ob-skip" id="s-upload">Upload files instead</button>',
      onClose: function () { state.conn = idleConn(app); },
      bind: function () {
        $("#s-retry").addEventListener("click", function () {
          state.sheet = null;
          // C5 — the SAME read, from the start. A sign-in that can no longer
          // read goes back through the app instead.
          if (signInAgain) startAppSignIn(app); else startAppRead(org);
        });
        $("#s-upload").addEventListener("click", function () { state.sheet = null; state.conn = idleConn(app); goS02("F"); });
      },
    });
  }

  /* ── S02-F · Upload files ───────────────────────────────────────────── */

  /* The same shape as Connect an app: choose → Read → FoodBridge reads what it
     can → S03. The user picks files and taps Read; that tap is the consent, and
     nothing is opened before it. What each file holds is read from its own
     columns (dataset.js classify) — never from its name — so there is no
     labelling step, and a workbook with a customers sheet, an items sheet and
     an orders sheet gives all three. FoodBridge asks only when a file cannot
     say what it is (a bare "Name" column: products or customers), narrowed to
     those answers, after the read. The row of a file that read is the harvest:
     what came out of it, in the user's words — and it is where the user TAGS
     the file. A file carries any number of tags (an invoice export is
     invoices, and orders, and every customer and product on its lines); a tag
     is read from the file, and a tag that gives nothing is said, not dropped. */

  let fileSeq = 0;
  function newFileId() { fileSeq += 1; return "f" + Date.now().toString(36) + fileSeq; }

  function addFiles(list) {
    Array.prototype.forEach.call(list || [], function (file) {
      state.files.push({ id: newFileId(), name: file.name, tags: null, status: "new", reason: null, choices: null, file: file, result: null });
    });
    draw();
  }

  function fileInput(id, multiple) {
    return '<input type="file" id="' + id + '" accept="' + ACCEPT + '"' + (multiple ? " multiple" : "") + " hidden>";
  }

  /* "Orders · 517 · Products · 86 · Customers · 40": everything a file gives,
     with its count — the count S03 will show, not the number of rows. An orders
     sheet is one row per line, one customer's lines on one day are ONE order,
     and the lines NAME customers and products; so the file is put through the
     same fromFiles() and engine view S03's numbers come from, and a kind the
     lines name is listed beside the kinds that were read. A tag that gave
     nothing is listed as "none". */
  function foundCounts(f) {
    const found = (f.result && f.result.found) || [];
    if (!found.length) return [];
    if (!f.result.counts) {
      const parts = found.map(function (p) { return { id: f.id, name: f.name, type: p.type, records: p.records, skipped: p.skipped }; });
      const ds = window.FB_DATASET.fromFiles(parts).dataset;
      const hist = window.FB_DATASET.toEngine(ds).history;   // the last 24 months, as S03 counts
      const orders = Object.keys(hist).reduce(function (n, id) { return n + hist[id].orders.length; }, 0);
      const read = {};
      found.forEach(function (p) { read[p.type] = true; });
      const counts = [];
      window.FB_DATASET.FILE_TYPES.forEach(function (t) {
        const n = t === "orders" ? orders : ds[t] && ds[t].present ? ds[t].records.length : 0;
        if (read[t]) counts.push({ type: t, n: n });
        else if (n) counts.push({ type: t, n: n, named: true });   // on the lines of what was read
      });
      (f.result.none || []).forEach(function (t) { counts.push({ type: t, none: true }); });
      f.result.counts = counts;
    }
    return f.result.counts;
  }
  function foundHtml(f, tail) {
    const items = foundCounts(f).map(function (c) {
      if (c.none) return '<span class="ob-found-none">' + esc(TYPE_LABEL[c.type]) + " \u00b7 none</span>";
      return esc(TYPE_LABEL[c.type] + " \u00b7 " + c.n.toLocaleString());
    });
    // The caret stays with the last tag when the line wraps.
    if (tail && items.length) items.push('<span class="ob-nowrap">' + items.pop() + tail + "</span>");
    return items.join("  \u00b7  ");
  }
  const tagsText = function (tags) { return (tags || []).map(function (t) { return TYPE_LABEL[t]; }).join(" \u00b7 "); };

  function fileRow(f, reading) {
    let bot = "";
    if (f.status === "waiting") bot = '<span class="ob-fstat">Waiting</span>';
    else if (f.status === "reading") bot = '<span class="ob-fstat is-busy"><span class="ob-spin"></span>Reading</span>';
    else if (f.status === "read") {
      // The harvest is also where the file is tagged: tap it to add a kind.
      bot = reading
        ? '<span class="ob-found">' + ICON.check + foundHtml(f) + "</span>"
        : '<button class="ob-found is-btn" data-tags="' + f.id + '" aria-label="Tags for ' + esc(f.name) + '">' + ICON.check +
            foundHtml(f, '<span class="ob-caret">' + ICON.chevDown + "</span>") + "</button>";
    } else if (f.status === "failed" && f.reason === "ambiguous") {
      bot = '<span class="ob-fstat is-ask"><button class="ob-flink" data-why="' + f.id + '">Products or customers?</button></span>';
    } else if (f.status === "failed") {
      bot = '<span class="ob-fstat is-bad"><button class="ob-flink" data-why="' + f.id + '">Couldn\'t read</button>' +
        (reading ? "" : ' &#183; <label class="ob-flink">Replace' + fileInput("r-" + f.id, false) + "</label>") + "</span>";
    } else if (f.tags && f.tags.length) {
      // Tagged by the user, not read yet: read as these.
      bot = '<button class="ob-typechip" data-tags="' + f.id + '">' + esc(tagsText(f.tags)) + '<span class="ob-caret">' + ICON.chevDown + "</span></button>";
    }
    return '<div class="ob-file' + (f.status === "failed" && f.reason !== "ambiguous" ? " is-failed" : "") + '">' +
      '<div class="ob-file-top"><span class="ob-file-n">' + esc(f.name) + "</span>" +
        (reading ? "" : '<button class="ob-file-x" data-rm="' + f.id + '" aria-label="Remove ' + esc(f.name) + '">' + ICON.close + "</button>") +
      "</div>" +
      (bot ? '<div class="ob-file-bot">' + bot + "</div>" : "") +
    "</div>";
  }

  function drawS02F() {
    const files = state.files;
    const reading = !!state.filesRun;
    const fresh = files.filter(function (f) { return f.status === "new"; });
    const read = files.filter(function (f) { return f.status === "read"; });
    const asking = files.filter(function (f) { return f.status === "failed" && f.reason === "ambiguous"; });
    let h1, sub = "", foot = "";

    if (reading) {
      h1 = "Reading your files";
      foot = '<button class="ob-skip" id="b-stopfiles">Stop</button>';
    } else if (!files.length) {
      // Nothing yet: the screen is the four things a file can be, each a way
      // in (see drawS02FEmpty). No footer, so nothing sits below a void.
      return drawS02FEmpty();
    } else if (fresh.length) {
      h1 = "Add your business files";
      foot = '<button class="ob-cta" id="b-readfiles">Read ' + plural(fresh.length, "file", "files") + "</button>";
    } else if (read.length) {
      h1 = read.length === files.length ? "We read your files" : "We read " + read.length + " of " + files.length + " files";
      foot = '<button class="ob-cta" id="b-usefiles">Continue with ' + plural(read.length, "file", "files") + "</button>";
    } else if (asking.length === files.length) {
      h1 = "What's in these files?";
    } else {
      h1 = "We couldn't read these files";
      foot = '<button class="ob-skip" id="b-connect">Connect an app instead</button>';
    }

    render(
      chrome("S02", { back: true }) +
      '<main class="ob-main">' +
        '<h1 class="ob-h1">' + esc(h1) + "</h1>" +
        (sub ? '<p class="ob-sub">' + esc(sub) + "</p>" : "") +
        (files.length
          ? '<div class="ob-files">' + files.map(function (f) { return fileRow(f, reading); }).join("") + "</div>" +
            (reading ? "" : '<label class="ob-addmore">' + ICON.plusCircle + "Add more files" + fileInput("i-more", true) + "</label>")
          : "") +
      "</main>" +
      (foot ? '<footer class="ob-foot">' + foot + "</footer>" : "")
    );

    ["i-add", "i-more"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", function () { const l = this.files; addFiles(l); this.value = ""; });
    });
    $$("[data-rm]").forEach(function (b) {
      b.addEventListener("click", function () { removeFile(b.dataset.rm); });
    });
    $$("[data-why]").forEach(function (b) {
      b.addEventListener("click", function () {
        const f = fileById(b.dataset.why);
        // The row already asked the question; the tap lands on the answers.
        if (f && f.reason === "ambiguous") openTypeSheet(f, f.choices); else openFileProblem(f);
      });
    });
    $$("[data-tags]").forEach(function (b) {
      b.addEventListener("click", function () { openTagSheet(fileById(b.dataset.tags)); });
    });
    files.forEach(function (f) {
      const r = document.getElementById("r-" + f.id);
      if (r) r.addEventListener("change", function () { if (this.files[0]) replaceFile(f, this.files[0]); this.value = ""; });
    });
    const rf = $("#b-readfiles");
    if (rf) rf.addEventListener("click", function () { confirmReplaceThen("files", runFileRead); });
    const uf = $("#b-usefiles");
    if (uf) uf.addEventListener("click", continueWithFiles);
    const sf = $("#b-stopfiles");
    if (sf) sf.addEventListener("click", stopFileRead);
    const cf = $("#b-connect");
    if (cf) cf.addEventListener("click", function () { goS02("C"); });
  }

  /* S02-F with nothing added. The same shape as Connect an app: the question,
     then rows to tap — one per kind a file can hold, each opening the picker.
     The rows are the answer to "which file do I go and get?"; they are not
     labels, and a file chosen through any of them still says for itself what
     it holds. One quiet line names the formats and where they come from. */
  const FILE_KINDS = [
    { type: "orders",    icon: iconOrders,    tint: "t-indigo" },
    { type: "customers", icon: iconCustomers, tint: "t-blue" },
    { type: "products",  icon: iconProducts,  tint: "t-green" },
    { type: "invoices",  icon: ICON.doc,      tint: "t-rose" },
  ];
  function drawS02FEmpty() {
    render(
      chrome("S02", { back: true }) +
      '<main class="ob-main">' +
        '<h1 class="ob-h1">Add your business files</h1>' +
        '<div class="ob-sources">' +
          FILE_KINDS.map(function (k) {
            return '<label class="ob-source ob-path ob-pick">' +
              '<span class="ob-mark ' + k.tint + '">' + k.icon + "</span>" +
              '<span class="ob-path-main"><span class="ob-source-t">' + TYPE_LABEL[k.type] + "</span>" +
                '<span class="ob-path-s">' + esc(TYPE_HELP[k.type]) + "</span></span>" +
              '<span class="ob-chev">' + ICON.upload + "</span>" +
              fileInput("i-add-" + k.type, true) + "</label>";
          }).join("") +
        "</div>" +
        '<p class="ob-quiet-s">Excel or CSV, exported from Tally, Zoho, Vyapar or any spreadsheet. One file can hold more than one of these.</p>' +
      "</main>"
    );
    FILE_KINDS.forEach(function (k) {
      const el = document.getElementById("i-add-" + k.type);
      el.addEventListener("change", function () { const l = this.files; addFiles(l); this.value = ""; });
    });
  }

  function fileById(id) { return state.files.filter(function (f) { return f.id === id; })[0]; }

  function removeFile(id) {
    state.files = state.files.filter(function (f) { return f.id !== id; });
    save();
    draw();
  }

  /* The user's tags, if any, are kept: the replacement is read as those. A
     file that had said for itself starts over and says again. */
  function replaceFile(f, file) {
    f.file = file; f.name = file.name; f.status = "new"; f.reason = null; f.choices = null; f.result = null;
    state.sheet = null;
    save();
    draw();
  }

  /* Only where FoodBridge could not tell. Customer words, and nothing chosen
     for them; `choices` narrows the list to what the file could be. Saying
     what a file is makes it unread — it has to be read as what it now is. */
  function openTypeSheet(f, choices) {
    if (!f) return;
    const list = choices && choices.length ? choices : ["orders", "customers", "products", "invoices"];
    openSheet({
      title: "What's in " + f.name + "?",
      body: '<div class="ob-choices">' +
        list.map(function (t) {
          return '<button class="ob-choice ob-choice-2' + (f.tags && f.tags.indexOf(t) !== -1 ? " is-on" : "") + '" data-pick="' + t + '">' +
            '<span class="ob-choice-main"><span class="ob-choice-t">' + TYPE_LABEL[t] + "</span>" +
            '<span class="ob-choice-s">' + esc(TYPE_HELP[t]) + "</span></span></button>";
        }).join("") + "</div>",
      bind: function () {
        $$("[data-pick]").forEach(function (b) {
          b.addEventListener("click", function () {
            retag(f, [b.dataset.pick]);
            state.sheet = null;
            save();
            draw();
          });
        });
      },
    });
  }

  /* Tags changed: the file has to be read again, as what it now is. */
  function retag(f, tags) {
    f.tags = tags && tags.length ? tags : null;
    f.result = null; f.reason = null; f.choices = null;
    f.status = f.file ? "new" : "failed";
    if (!f.file) f.reason = "missing";
  }

  /* The tags on one file. Ticked is what will be read from it: after a read,
     the kinds that were; a kind the lines merely name is said so and left
     unticked, because ticking it reads it as its own list. Nothing ticked
     hands the file back to its own columns. */
  function openTagSheet(f) {
    if (!f) return;
    const counts = f.status === "read" ? foundCounts(f) : [];
    const read = {}, named = {};
    counts.forEach(function (c) { if (c.none) return; if (c.named) named[c.type] = c.n; else read[c.type] = true; });
    const on = {};
    (f.tags || (f.status === "read" ? Object.keys(read) : [])).forEach(function (t) { on[t] = true; });
    const KINDS = window.FB_DATASET.FILE_TYPES;
    const draw2 = function () {
      $$("[data-tag]").forEach(function (b) {
        const t = b.dataset.tag;
        b.classList.toggle("is-on", !!on[t]);
        b.setAttribute("aria-checked", !!on[t]);
      });
    };
    openSheet({
      title: "What's in " + f.name + "?",
      body: '<div class="ob-choices" role="group">' +
        KINDS.map(function (t) {
          const sub = named[t] ? "Named on the lines \u00b7 " + named[t].toLocaleString() + " \u00b7 tick to read as a list" : TYPE_HELP[t];
          return '<button class="ob-choice ob-choice-tag' + (on[t] ? " is-on" : "") + '" role="checkbox" aria-checked="' + !!on[t] + '" data-tag="' + t + '">' +
            '<span class="ob-tick">' + ICON.check + "</span>" +
            '<span class="ob-choice-main"><span class="ob-choice-t">' + TYPE_LABEL[t] + "</span>" +
            '<span class="ob-choice-s">' + esc(sub) + "</span></span></button>";
        }).join("") + "</div>",
      actions: '<button class="ob-cta" id="s-tagdone">Done</button>',
      bind: function () {
        $$("[data-tag]").forEach(function (b) {
          b.addEventListener("click", function () { on[b.dataset.tag] = !on[b.dataset.tag]; draw2(); });
        });
        $("#s-tagdone").addEventListener("click", function () {
          const tags = KINDS.filter(function (t) { return on[t]; });
          const before = f.tags || (f.status === "read" ? Object.keys(read) : []);
          const same = tags.length === before.length && tags.every(function (t) { return before.indexOf(t) !== -1; });
          if (!same) retag(f, tags);
          state.sheet = null;
          save();
          draw();
        });
      },
    });
  }

  function openFileProblem(f) {
    if (!f) return;
    const tagged = f.tags && f.tags.length ? f.tags : null;
    const label = tagged ? tagged.map(function (t) { return TYPE_LABEL[t].toLowerCase(); }).join(" or ") : "records";
    let why, actions;
    if (f.reason === "no_records" && !tagged) {
      why = '<p class="ob-sheet-p">We couldn\'t find orders, customers, products or invoices in this file.</p>' +
            '<p class="ob-sheet-p">Its first rows need column names, such as Order Date, Customer Name, Item Name and Quantity.</p>';
      actions = '<label class="ob-cta ob-cta-label">Replace file' + fileInput("s-replace", false) + "</label>" +
                '<button class="ob-skip" id="s-type">Say what it contains</button>' +
                '<button class="ob-skip is-warn" id="s-remove">Remove</button>';
    } else {
      why = f.reason === "no_records"
        ? '<p class="ob-sheet-p">We couldn\'t find any ' + esc(label) + " in this file.</p>" +
          tagged.map(function (t) { return '<p class="ob-sheet-p">' + esc(TYPE_NEEDS[t] || "") + "</p>"; }).join("")
        : '<p class="ob-sheet-p">' + esc(FILE_PROBLEM[f.reason] || FILE_PROBLEM.damaged) + "</p>";
      actions = '<label class="ob-cta ob-cta-label">Replace file' + fileInput("s-replace", false) + "</label>" +
                (tagged ? '<button class="ob-skip" id="s-type">Change tags</button>' : "") +
                '<button class="ob-skip is-warn" id="s-remove">Remove</button>';
    }
    openSheet({
      title: f.name,
      body: why,
      actions: actions,
      bind: function () {
        const rep = $("#s-replace");
        if (rep) rep.addEventListener("change", function () { if (this.files[0]) replaceFile(f, this.files[0]); });
        const ty = $("#s-type");
        if (ty) ty.addEventListener("click", function () { openTagSheet(f); });
        $("#s-remove").addEventListener("click", function () { state.sheet = null; removeFile(f.id); });
      },
    });
  }

  /* F — the read. One file at a time, each with its own result. A file that
     fails is marked and kept for replacing; the ones that read are untouched
     by it. A file the user has tagged is read as those kinds; every other
     file says for itself what it holds. */
  async function runFileRead() {
    const run = { stopped: false };
    state.filesRun = run;
    const queue = state.files.filter(function (f) { return f.status === "new"; });
    queue.forEach(function (f) { f.status = "waiting"; });
    draw();
    for (let i = 0; i < queue.length; i++) {
      const f = queue[i];
      if (state.filesRun !== run) return;
      if (state.files.indexOf(f) === -1) continue;
      f.status = "reading";
      draw();
      let out;
      try {
        out = f.file ? await RD().files.read(f.file, f.tags && f.tags.length ? f.tags : null, { shouldStop: function () { return run.stopped; } })
                     : { ok: false, reason: "missing" };
      } catch (e) { out = { ok: false, reason: "damaged" }; }
      if (state.filesRun !== run) return;             // stopped while this one was reading
      if (out && out.ok) {
        f.status = "read"; f.reason = null; f.choices = null;
        f.result = { found: out.found, none: out.none || [] };
        foundCounts(f);
      } else {
        f.status = "failed"; f.reason = (out && out.reason) || "damaged"; f.choices = (out && out.choices) || null;
      }
      save();
      draw();
    }
    state.filesRun = null;
    const anyFailed = state.files.some(function (f) { return f.status === "failed"; });
    const anyNew = state.files.some(function (f) { return f.status === "new"; });
    const anyRead = state.files.some(function (f) { return f.status === "read"; });
    // A tag the user put on that gave nothing is worth a look before going on.
    const anyNone = state.files.some(function (f) { return f.status === "read" && f.result && f.result.none && f.result.none.length; });
    if (anyRead && !anyFailed && !anyNew && !anyNone) return continueWithFiles();
    save();
    draw();
  }

  /* Stop keeps every file that already read; the rest go back to unread. */
  function stopFileRead() {
    const run = state.filesRun;
    if (run) run.stopped = true;
    state.filesRun = null;
    state.files.forEach(function (f) { if (f.status === "waiting" || f.status === "reading") f.status = "new"; });
    save();
    draw();
  }

  function continueWithFiles() {
    const parts = [];
    state.files.forEach(function (f) {
      if (f.status !== "read" || !f.result) return;
      (f.result.found || []).forEach(function (p) {
        parts.push({ id: f.id, name: f.name, type: p.type, records: p.records, skipped: p.skipped });
      });
    });
    if (!parts.length) return draw();
    emitDataReady(window.FB_DATASET.fromFiles(parts));
  }

  /* C8 — files chosen but not yet read are unconfirmed work. */
  function leaveFiles() {
    if (state.filesRun) return stopFileRead();
    const unread = state.files.filter(function (f) { return f.status === "new"; });
    if (!unread.length) return goS02("A");
    openSheet({
      title: "Discard these files?",
      body: '<p class="ob-sheet-p">Nothing has been read from them yet.</p>',
      actions: '<button class="ob-cta is-warn" id="s-discard">Discard</button>' +
               '<button class="ob-skip" id="s-keep">Keep adding</button>',
      bind: function () {
        $("#s-discard").addEventListener("click", function () {
          state.sheet = null;
          state.files = state.files.filter(function (f) { return f.status !== "new"; });
          goS02("A");
        });
        $("#s-keep").addEventListener("click", closeSheet);
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
              '<div class="ob-optional">' + m.unlocks.map(function (u, i) { return laterRow(u, i, m); }).join("") + "</div>" +
            "</section>"
          : "") +
      "</main>" +
      laterFooter()
    );

    $$("[data-insp]").forEach(function (b) {
      b.addEventListener("click", function () { openInspectSheet(b.dataset.insp); });
    });
    bindLaterRows(m.unlocks);
    bindLaterFooter();
  }

  /* An item the user can clear right here: tap it, add files (or photos,
     where the bridge reads them), then read them all at once from the footer.
     One renderer for both shapes of S03, so the missing and the optional are
     cleared by the same gesture. */
  function laterRow(u, i, m) {
    const st = laterStatus(u, m);
    return '<button class="ob-orow ob-orow-btn" data-later="' + i + '">' + ICON.plusCircle +
      '<span class="ob-orow-main"><span class="ob-orow-t">' + esc(u.label) + "</span>" +
      '<span class="ob-orow-s' + (st.bad ? " is-bad" : st.ready ? " is-ready" : "") + '">' + esc(st.text) + "</span></span>" +
      '<span class="ob-addlink">' + (st.staged ? "Change" : "Add") + "</span></button>";
  }
  function bindLaterRows(items) {
    $$("[data-later]").forEach(function (b) {
      b.addEventListener("click", function () { openLaterSheet(items[Number(b.dataset.later)]); });
    });
  }

  /* SHEET 4 — inspect. Enough real rows to recognise your own business, the
     total, and where it came from. A sheet, not a browser. */
  function openInspectSheet(kind) {
    const EV = window.FB_EVIDENCE;
    const e = engine();
    const r = EV.sampleRecords({ seed: e.seed, history: e.history, kind: kind, limit: 5 });
    const pv = EV.provenance({ seed: e.seed, history: e.history });
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
          /* The source S02 actually read, in the chip's words. */
          "<p>" + esc(provenanceLabel()) + "</p>" +
          (kind === "orders" && pv.from ? "<p>" + esc(pv.from) + " &#8211; " + esc(pv.to) + "</p>" : "") +
          /* Scope belongs to the ORDERS, not to a product catalogue. Printing
             it under all three is how a date range ended up describing 86
             pickles. */
          (kind === "orders"
            ? "<p>" + pv.shopsWithHistory + " of your " + pv.totalCustomers + " shops</p>"
            : "<p>" + r.total.toLocaleString() + " " + esc(r.unit) + " in total</p>") +
        "</div>",
      actions: '<button class="ob-cta ob-ghost" id="s-close">Close</button>',
      bind: function () { $("#s-close").addEventListener("click", closeSheet); },
    });
  }

  /* ── S03 · "Add later" and "What is missing", cleared right here ───────
     Product owner's request, 17 Sep 2026: each item opens a sheet where the
     user adds files or photos for it; they can do the next item the same way;
     then ONE "Read" reads all of them and adds what it finds to the data S02
     handed over (combined, never replacing -- every record names its file).
     The same day: what the floor is MISSING (S03-B) is cleared by the same
     rows, sheet and Read, so crossing the floor never means leaving S03.

     Nothing is read when a file is chosen. A file that cannot be read stays
     on its item with the reason, to be replaced; the ones that read are added. */

  const LATER_ITEMS = {
    /* Below the floor (S03-B): what the floor is missing, cleared the same way.
       Spreadsheets only — the bridge reads photographs of invoices, payments
       and price lists, not of order books. */
    orders: {
      ask: "Add your sales orders or order history.",
      types: ["orders"], photo: false,
      has: function (m) { return { orders: m.evidence.sales.present }; },
    },
    products: {
      ask: "Add your items or price list.",
      types: ["products"], photo: false,
      has: function (m) { return { products: m.context.products.present }; },
    },
    invoices_and_payments: {
      ask: "Add the bills you've sent to customers and the payments you've received.",
      types: ["invoices", "payments"],
      has: function (m) { return { invoices: m.evidence.invoices.present, payments: m.evidence.payments.present }; },
    },
    cost_price: {
      ask: "Add a price list or purchase bills that show what you pay for each product.",
      types: ["costs"],
      has: function (m) { return { costs: m.stock.cost }; },
    },
  };
  const LATER_TYPE_LABEL = { orders: "Orders", products: "Products", invoices: "Invoices", payments: "Payments", costs: "Cost prices" };
  const LATER_NEEDS = {
    orders: TYPE_NEEDS.orders,
    products: TYPE_NEEDS.products,
    invoices: "An invoices file needs a date, a customer and an amount for each invoice.",
    payments: "A payments file needs a date, a customer and an amount for each payment.",
    costs: "A cost price file needs a product name and what you pay for it.",
  };
  const LATER_PROBLEM = {
    photo_not_set_up: "Reading photos isn't set up yet.",
    photo_no_rows: "We couldn't read any rows in this photo. Try a clearer, straighter photo.",
    photo_unavailable: "Reading this photo didn't finish.",
  };
  const LATER_ACCEPT = ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*";

  function laterFiles(key) { return state.later.files.filter(function (f) { return f.item === key; }); }

  function laterStatus(u, m) {
    const files = laterFiles(u.evidence);
    const bad = files.filter(function (f) { return f.status === "failed"; }).length;
    const ready = files.filter(function (f) { return f.status === "new"; }).length;
    if (bad) return { staged: true, bad: true, text: plural(bad, "file", "files") + " couldn't be read" + (ready ? " · " + ready + " ready" : "") };
    if (ready) return { staged: true, ready: true, text: plural(ready, "file", "files") + " ready to read" };
    const item = LATER_ITEMS[u.evidence];
    if (item && item.types.length > 1) {
      const has = item.has(m);
      const got = item.types.filter(function (t) { return has[t]; });
      if (got.length) {
        const missing = item.types.filter(function (t) { return !has[t]; });
        return { text: got.map(function (t) { return LATER_TYPE_LABEL[t]; }).join(", ") + " added · add " +
                       missing.map(function (t) { return LATER_TYPE_LABEL[t].toLowerCase(); }).join(" and ") + " to finish" };
      }
    }
    return { text: "Would unlock " + u.short };
  }

  function laterFooter() {
    const fresh = state.later.files.filter(function (f) { return f.status === "new"; });
    if (!fresh.length) return '<footer class="ob-foot"><button class="ob-cta" id="b-continue">See what this means</button></footer>';
    const untyped = fresh.some(function (f) { return !f.type; });
    return '<footer class="ob-foot">' +
      (untyped
        ? '<button class="ob-cta" disabled>Choose what each file contains</button>'
        : '<button class="ob-cta" id="b-readlater">Read ' + plural(fresh.length, "file", "files") + "</button>") +
      '<button class="ob-skip" id="b-continue">Continue without them</button></footer>';
  }

  function bindLaterFooter() {
    const c = $("#b-continue");
    if (c) c.addEventListener("click", function () { go("S04"); });
    const r = $("#b-readlater");
    if (r) r.addEventListener("click", runLaterRead);
  }

  function addLaterFiles(key, list, photo) {
    const item = LATER_ITEMS[key];
    Array.prototype.forEach.call(list || [], function (file) {
      state.later.files.push({
        id: newFileId(), item: key, name: file.name || (photo ? "Photo" : "File"), file: file,
        type: item.types.length === 1 ? item.types[0] : null,   // the item names it; nothing is guessed
        status: "new", reason: null, via: photo || RD().files.isPhoto(file) ? "photo" : "file",
      });
    });
  }

  function laterProblem(f) {
    if (f.reason === "no_records") return "We couldn't find any " + LATER_TYPE_LABEL[f.type].toLowerCase() + " in this file. " + (LATER_NEEDS[f.type] || "");
    return LATER_PROBLEM[f.reason] || FILE_PROBLEM[f.reason] || FILE_PROBLEM.damaged;
  }

  /* The sheet for one item. It is re-opened (redrawn) after every change. */
  function openLaterSheet(u) {
    const key = u.evidence;
    const item = LATER_ITEMS[key];
    if (!item) return;
    const m = state.model || (state.model = buildModel());
    const has = item.has(m);
    const files = laterFiles(key);
    const multi = item.types.length > 1;

    const fileRowHtml = function (f) {
      const chips = multi
        ? '<span class="ob-seg" role="radiogroup" aria-label="What\'s in ' + esc(f.name) + '">' +
            item.types.map(function (t) {
              return '<button class="ob-seg-b' + (f.type === t ? " is-on" : "") + '" role="radio" aria-checked="' + (f.type === t) +
                '" data-ltype="' + f.id + ":" + t + '">' + LATER_TYPE_LABEL[t] + "</button>";
            }).join("") + "</span>"
        : '<span class="ob-typechip is-static">' + LATER_TYPE_LABEL[f.type] + "</span>";
      return '<div class="ob-file' + (f.status === "failed" ? " is-failed" : "") + '">' +
        '<div class="ob-file-top">' + (f.via === "photo" ? ICON.camera : ICON.files) +
          '<span class="ob-file-n">' + esc(f.name) + "</span>" +
          '<button class="ob-file-x" data-lrm="' + f.id + '" aria-label="Remove ' + esc(f.name) + '">' + ICON.close + "</button></div>" +
        '<div class="ob-file-bot">' + chips + "</div>" +
        (f.status === "failed"
          ? '<p class="ob-file-why">' + esc(laterProblem(f)) + ' <label class="ob-flink">Replace' +
              '<input type="file" data-lrep="' + f.id + '" accept="' + LATER_ACCEPT + '" hidden></label></p>'
          : "") +
      "</div>";
    };

    openSheet({
      title: u.label,
      body:
        '<p class="ob-sheet-p">' + esc(item.ask) + "</p>" +
        (multi
          ? '<div class="ob-have">' + item.types.map(function (t) {
              return '<span class="ob-have-i' + (has[t] ? " is-on" : "") + '">' + (has[t] ? ICON.check : "") +
                LATER_TYPE_LABEL[t] + (has[t] ? " added" : "") + "</span>";
            }).join("") + "</div>"
          : "") +
        '<div class="ob-addbtns">' +
          '<label class="ob-chip key">' + ICON.upload + "Choose files" +
            '<input type="file" id="l-files" accept="' + (item.photo === false ? ACCEPT : LATER_ACCEPT) + '" multiple hidden></label>' +
          (item.photo === false ? "" :
            '<label class="ob-chip">' + ICON.camera + "Take photo" +
              '<input type="file" id="l-photo" accept="image/*" capture="environment" hidden></label>') +
        "</div>" +
        (files.length ? '<div class="ob-files ob-files-sheet">' + files.map(fileRowHtml).join("") + "</div>" : "") +
        (item.photo === false
          ? '<p class="ob-quiet-s">Excel or CSV, read on this phone. Nothing is read until you tap Read.</p>'
          : '<p class="ob-quiet-s">Excel, CSV or a clear photo. Spreadsheets are read on this phone; photos are sent to FoodBridge to be read. ' +
            "Nothing is read until you tap Read.</p>"),
      actions: '<button class="ob-cta" id="l-done">Done</button>',
      bind: function () {
        const again = function () { openLaterSheet(u); };
        $("#l-files").addEventListener("change", function () { addLaterFiles(key, this.files, false); this.value = ""; again(); });
        const ph = $("#l-photo");
        if (ph) ph.addEventListener("change", function () { addLaterFiles(key, this.files, true); this.value = ""; again(); });
        $$("[data-ltype]").forEach(function (b) {
          b.addEventListener("click", function () {
            const parts = b.dataset.ltype.split(":");
            const f = state.later.files.filter(function (x) { return x.id === parts[0]; })[0];
            if (f) { f.type = parts[1]; if (f.status === "failed") { f.status = "new"; f.reason = null; } }
            again();
          });
        });
        $$("[data-lrm]").forEach(function (b) {
          b.addEventListener("click", function () {
            state.later.files = state.later.files.filter(function (x) { return x.id !== b.dataset.lrm; });
            again();
          });
        });
        $$("[data-lrep]").forEach(function (inp) {
          inp.addEventListener("change", function () {
            const f = state.later.files.filter(function (x) { return x.id === inp.dataset.lrep; })[0];
            if (f && this.files[0]) {
              f.file = this.files[0]; f.name = this.files[0].name || f.name; f.status = "new"; f.reason = null;
              f.via = RD().files.isPhoto(this.files[0]) ? "photo" : "file";
            }
            again();
          });
        });
        $("#l-done").addEventListener("click", closeSheet);
      },
    });
  }

  async function runLaterRead() {
    const run = { stopped: false, parts: [] };
    state.later.run = run;
    state.sheet = null;
    const queue = state.later.files.filter(function (f) { return f.status === "new" && f.type; });
    queue.forEach(function (f) { f.status = "waiting"; });
    draw();
    for (let i = 0; i < queue.length; i++) {
      const f = queue[i];
      if (state.later.run !== run) return;
      f.status = "reading";
      draw();
      let out;
      try { out = await RD().files.read(f.file, f.type); } catch (e) { out = { ok: false, reason: "damaged" }; }
      if (state.later.run !== run) return;
      if (out && out.ok) {
        f.status = "read";
        run.parts.push({ id: f.id, name: f.name, type: f.type, via: f.via, records: out.records, skipped: out.skipped || [] });
      } else {
        f.status = "failed";
        f.reason = (out && out.reason) || "damaged";
      }
      draw();
    }
    finishLaterRead(run);
  }

  /* What read is added; what did not stays on its item with the reason. */
  function finishLaterRead(run) {
    state.later.run = null;
    state.later.files = state.later.files.filter(function (f) { return f.status !== "read"; });
    state.later.files.forEach(function (f) { if (f.status === "waiting" || f.status === "reading") f.status = "new"; });
    if (run.parts.length) {
      state.dataReady = window.FB_DATASET.addEvidence(state.dataReady, run.parts);
      state.engine = null;
      state.model = null;
      save();
    }
    state.screen = "S03";
    draw();
  }

  function stopLaterRead() {
    const run = state.later.run;
    if (!run) return;
    run.stopped = true;
    finishLaterRead(run);          // keeps every file that already read
  }

  function drawLaterReading() {
    const files = state.later.files.filter(function (f) { return f.status !== "new" && f.status !== "failed" || state.later.run; });
    render(
      chrome("S03", { back: true }) +
      '<main class="ob-main ob-main-op">' +
        '<h1 class="ob-h1">Reading your files</h1>' +
        '<div class="ob-files">' +
          files.filter(function (f) { return ["waiting", "reading", "read", "failed"].indexOf(f.status) !== -1; }).map(function (f) {
            const status = f.status === "waiting" ? '<span class="ob-fstat">Waiting</span>'
              : f.status === "reading" ? '<span class="ob-fstat is-busy"><span class="ob-spin"></span>Reading</span>'
              : f.status === "read" ? '<span class="ob-fstat is-ok" aria-label="Read">' + ICON.check + "</span>"
              : '<span class="ob-fstat is-bad">Couldn\'t read</span>';
            return '<div class="ob-file"><div class="ob-file-top">' + (f.via === "photo" ? ICON.camera : ICON.files) +
              '<span class="ob-file-n">' + esc(f.name) + "</span></div>" +
              '<div class="ob-file-bot"><span class="ob-typechip is-static">' + esc(LATER_TYPE_LABEL[f.type] || "") + "</span>" + status + "</div></div>";
          }).join("") +
        "</div>" +
      "</main>" +
      '<footer class="ob-foot"><button class="ob-skip" id="b-stoplater">Stop</button></footer>'
    );
    $("#b-stoplater").addEventListener("click", stopLaterRead);
  }

  /* S03-B — below the floor. NN11: this was a closed loop — "Connect" returned
     to S02, which returned here, and both Upload paths failed for every file.
     It now names what is missing and what that would unlock, and it always
     carries a way forward: back to S02 to bring in more. */
  /* S03-B — below the floor. NN11: this was a closed loop — "Connect" returned
     to S02, which returned here, and both Upload paths failed for every file.
     It names what is missing and what that would unlock, and each item is
     cleared RIGHT HERE, by the same rows, sheet and Read as S03-A's "Add
     later": add the file, read it, and the floor is checked again in place.
     There is no Continue below the floor. */
  function drawS03Below(m) {
    const fromFiles = !!(state.dataReady && state.dataReady.provenance.kind === "files");
    const missing = [
      { evidence: "orders", label: "Sales or orders", short: "which shops have stopped ordering, and what to reorder for them" },
      { evidence: "products", label: "Your products", short: "what is on the shelf and what is out of stock" },
    ].filter(function (u) {
      return u.evidence === "orders" ? !(m && m.evidence && m.evidence.sales.present)
                                     : !(m && m.context && m.context.products.present);
    });
    const fresh = state.later.files.filter(function (f) { return f.status === "new"; });

    render(
      chrome("S03", { back: true }) +
      '<main class="ob-main">' +
        '<h1 class="ob-h1">We need a little more</h1>' +
        '<section class="ob-section">' +
          '<p class="ob-eyebrow">WHAT IS MISSING</p>' +
          '<div class="ob-optional">' + missing.map(function (u, i) { return laterRow(u, i, m); }).join("") + "</div>" +
        "</section>" +
      "</main>" +
      '<footer class="ob-foot">' +
        (fresh.length ? '<button class="ob-cta" id="b-readlater">Read ' + plural(fresh.length, "file", "files") + "</button>" : "") +
        (fromFiles
          ? '<button class="ob-skip" id="b-other">Connect an app instead</button>'
          : '<button class="ob-skip" id="b-other">Choose a different source</button>') +
      "</footer>"
    );
    bindLaterRows(missing);
    const r = $("#b-readlater");
    if (r) r.addEventListener("click", runLaterRead);
    $("#b-other").addEventListener("click", function () { goS02(fromFiles ? "C" : "A"); });
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
    const products = (engine().seed.products || []).filter(function (p) {
      return p.systemStock === 0;
    });
    openSheet({
      title: "Out of stock",
      count: sp.outOfStock,
      body:
        '<p class="ob-sheet-p">' + sp.outOfStock + " of your " + sp.catalogue +
          (sp.untracked ? " tracked" : "") + " products show no stock. A reorder can still be prepared for them \u2014 " +
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
        "",
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
    const all = (engine().seed.products || []).filter(function (p) { return !have[p.name]; });
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
    if (state.screen === "S03") return state.later.run ? drawLaterReading() : drawS03();
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
    handleAppReturn();                           // back from the app, however it went
    /* Back from Zoho can restore this page from the browser's cache instead of
       reloading it. iOS Safari brings the platform shell back with its iframe
       unresponsive to touch (verified on the Simulator: the screen draws, no tap
       lands), so a cached restore is turned into a real load. mount() then finds
       the unfinished sign-in with no result and lands quietly on Connect an app. */
    [window, RD().topWin()].forEach(function (w) {
      try {
        w.addEventListener("pageshow", function (e) {
          if (!e.persisted) return;
          let pending = null;
          try { pending = sessionStorage.getItem(OAUTH_KEY); } catch (x) { pending = null; }
          if (!pending && !(state.sheet && state.sheet.busy)) return;
          RD().topWin().location.reload();
        });
      } catch (x) { /* a window we may not listen to */ }
    });
    /* The drafts destination is the SAME module under a different view, so the
       drafts it shows are the drafts the flow wrote — not a second copy that
       could drift from the first. */
    if (new URLSearchParams(location.search).get("view") === "drafts") {
      state.view = "drafts";
      if (state.dataReady && !state.opp) { try { state.opp = buildOpportunity(); } catch (e) {} }
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
    gstVerified, gstActive, verifyGstin, parkOpportunity, emitDataReady, engine,
    draftEdits, draftsTotalLines, draftsTotalEdits,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = window.FB_ONBOARDING;
})();

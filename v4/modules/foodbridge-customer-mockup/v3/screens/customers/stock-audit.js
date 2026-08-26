/* ==========================================================================
   DISCOVERY — Foodbridge Module Customer — Stock Audit & Health
   A distributor field-operations hub, mobile-first.

   Mounts through shell.js's mountShell exactly like customers.js does — same
   sidebar, same topbar, same drawer/toast primitives (window.FB_SHELL) — so
   this stays a real peer of B2B Customers / Retail Customers under Customer
   Management. Everything BELOW that shared header is this feature's own
   small app: a stack-based router (go/back, mirroring Delivery Management's
   DM.go/DM.back) and a persistent bottom nav bar that stays on screen
   through every view, exactly like Delivery Management's own `.dm-nav`.

   The UX loop, top to bottom of this file (the vNext stakeholder flow —
   see the "vNext hard reset" and "Layer 2/3 UX pass" removal notes
   throughout for the older loops this replaced):
     FIND customer → PICK products → COUNT each → FINISH → LEAVE, with
     Audit History as a downstream, read-only record of what happened —
     never a second way to start counting, never a health-analytics screen.

   Views (CURRENT.view below):
     quick-pick   Search-first customer entry — the only way into a visit,
                  and always a NEW visit; no resume prompt.
     quick-count  Search/select products AND count them, one screen and no
                  modal in it: the count is a stepper in the row, and Finish
                  asks its one question inline in the sticky footer.
     audits       Audit History — every visit across every customer, newest
                  first, the "Audit History" tab in the bottom nav. A log:
                  who, when, what kind of visit, whether it finished, how
                  many products got checked. No health score, no filters
                  or sort by it.
     audit        Audit Detail — one visit: status, coverage, and the plain
                  list of what was counted. No score, breakdown, needs-
                  action tiles, recommended actions, follow-up, or evidence
                  gallery; the engine that used to feed those (scoreFromAudit,
                  healthBreakdown, recommendedActions, suggestedOutcome)
                  still runs on every completed audit, it's just unrendered.

   Persistence: customers.js's Store key (fb-discovery-customers-v1) is read
   here too, so a customer renamed/edited in the admin list shows correctly;
   this page never writes to it. Audits get their own key
   (fb-discovery-stock-audits-v1), seeded from SEED.stockAudits.
   ========================================================================== */

(function () {
  "use strict";

  const SEED = window.SEED;
  const { $, esc, titleCase, debounce, toast, mountShell } = window.FB_SHELL;

  const nameOf = (c) => (c && (typeof c.name === "object" ? c.name?.en : c.name)) || "";
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const plural = (n, word) => n + " " + word + (n === 1 ? "" : "s");
  const now = () => new Date();
  const DAY = 86400000;

  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return (
      d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
      ", " +
      d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    );
  }
  function fmtDateShort(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  }
  // REMOVED (inline pass): fmtRelative — "Today, 10:15 AM" / "Yesterday" /
  // "N days ago". Its last reader was the resume prompt's "started 2 hours
  // ago" line, which went with that sheet (see the removal note just below
  // startAuditFor). daysBetween went too once the Audit History date-range
  // filter that read it was cut.
  function addressLine(addr, state, pin) {
    return [addr, state && state.name, pin].filter(Boolean).join(", ") || "No address on file";
  }

  /* ---------------------------------------------------- keyboard insets */

  // How much of the viewport the on-screen keyboard is covering, published as
  // --kb for the app shell and the overlay layer to subtract (stock-audit.css).
  //
  // The two mobile engines disagree, and the disagreement is the whole reason
  // this exists. Android Chrome shrinks the LAYOUT viewport when the keyboard
  // opens, so `100dvh` already excludes it and this measures ~0 — subtracting
  // again would leave a keyboard-sized gap. iOS Safari shrinks only the VISUAL
  // viewport: the layout stays full height, `dvh` reports the same number it
  // did a moment ago, and a bottom action bar sits calmly behind the keys.
  // window.innerHeight − visualViewport.height is exactly that difference, and
  // is 0 on Android by construction.
  //
  // Guarded on visualViewport: without it (older Android WebViews) nothing is
  // published, --kb falls back to 0px, and the layout is what it was before.
  function trackKeyboardInset() {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      // offsetTop covers the case where the page is scrolled within the visual
      // viewport, which iOS does on its own when focusing a low field.
      const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      // Small deltas are the toolbar sliding, not a keyboard. Treating those as
      // a keyboard makes the whole app jitter as a rep scrolls.
      const open = covered > 120;
      document.documentElement.style.setProperty("--kb", (open ? covered : 0) + "px");
      // The same measurement as a class, so CSS can react to the keyboard and
      // not just subtract it. A phone in LANDSCAPE has ~100px of app left once
      // the keyboard is up, and the topbar/action bar/nav are 190px between
      // them — the column overflowed and pushed the CTA and the search results
      // off screen together. See the max-height block in stock-audit.css.
      document.documentElement.classList.toggle("sah-kb-open", open);
      syncOverlayFrame();
    };
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    sync();
  }

  // A field the rep has just focused must be visible above the keyboard. The
  // shell only scrolls .sah-wrap, so the browser's own scroll-into-view often
  // has nothing to act on; this asks the scrolling region directly, after the
  // keyboard has actually resized the viewport.
  function keepFocusVisible() {
    document.addEventListener("focusin", (e) => {
      const el = e.target;
      if (!el || !el.matches || !el.matches("input, select, textarea")) return;
      setTimeout(() => {
        if (el.isConnected && typeof el.scrollIntoView === "function") {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }, 250);
    });
  }

  /* ------------------------------------------------------- overlay layer */

  // Everything that floats over the screen — sheets and toasts — goes in here
  // rather than straight onto <body>, so that on desktop it lands INSIDE the
  // phone instead of at the browser window's own edges. Both used to be
  // `position: fixed` against the real viewport, which is the viewport on a
  // phone but the whole monitor here: toasts appeared up by the platform's
  // topbar and sheets slid up from the bottom of the browser, both outside
  // the device frame they belong to.
  //
  // Deliberately a sibling of #page, not a child: frame() rewrites #page's
  // innerHTML on every render, which would tear an open sheet — or a toast
  // still counting down — out of the DOM mid-life.
  //
  // The layer itself is inert (pointer-events: none, see stock-audit.css);
  // only what's inside it takes clicks, so an empty layer can't swallow a tap
  // meant for the screen underneath.
  let OVERLAYS = null;
  function overlayHost() {
    if (!OVERLAYS || !OVERLAYS.isConnected) {
      OVERLAYS = document.createElement("div");
      OVERLAYS.className = "sah-overlays";
      document.body.appendChild(OVERLAYS);
      // shell.js's own toast() looks up `.toasts` document-wide before making
      // one, so seeding it here means the shared toasts land in the phone too,
      // without this screen having to reach into shell.js and re-time or
      // re-home a primitive every other screen in the module shares.
      const toasts = document.createElement("div");
      toasts.className = "toasts";
      OVERLAYS.appendChild(toasts);
    }
    syncOverlayFrame();
    return OVERLAYS;
  }

  // The phone is a real, measurable box (#page, sized and centred by the
  // desktop rules in stock-audit.css), so the layer is pinned to whatever
  // that box currently is rather than to a copy of its numbers that would
  // drift the moment either side changed. Below the desktop breakpoint the
  // frame doesn't exist and the layer goes back to being the whole viewport.
  function syncOverlayFrame() {
    if (!OVERLAYS) return;
    if (!PAGE || window.innerWidth < 1024) { OVERLAYS.removeAttribute("style"); return; }
    const r = PAGE.getBoundingClientRect();
    OVERLAYS.style.cssText = `top:${r.top}px;left:${r.left}px;width:${r.width}px;height:${r.height}px;right:auto;bottom:auto;`;
  }

  /* ---------------------------------------------------------- long toast */

  // Finishing an audit is the one thing on this screen worth a longer look
  // than shell.js's 3.2s toast gives — the count is filed and the rep is
  // already walking, so it should still be on screen when they glance back.
  // A local variant rather than a change to shell.js's toast(), which every
  // other screen in this module shares and none of them wants held for 8
  // seconds. Same markup and same classes, so it IS that toast visually; only
  // the dismissal timer and the drain animation are re-timed (.toast-long in
  // stock-audit.css keeps the bar and the timer in step — a 3.2s bar under an
  // 8s toast would sit empty for five seconds and read as stuck).
  const LONG_TOAST_MS = 8000;
  function longToast(message) {
    const host = overlayHost().querySelector(".toasts");
    const el = document.createElement("div");
    el.className = "toast toast-long";
    el.innerHTML = `<span class="ticon">✓</span><span class="tmsg"></span><button class="tclose" aria-label="Close">✕</button>`;
    el.querySelector(".tmsg").textContent = message;
    el.querySelector(".tclose").onclick = () => el.remove();
    host.appendChild(el);
    setTimeout(() => el.remove(), LONG_TOAST_MS);
  }

  /* --------------------------------------------------------- bottom sheet */

  // Every sheet left in this feature is transient, so opening one always
  // sweeps away whatever is already up. (This used to carry a `:not(.pd-persist)`
  // carve-out for the Product Count Sheet, which stayed open underneath the
  // transient sheets layered over it — that sheet is gone; see the inline-count
  // removal note above quickRowHTML.)
  // On a phone, the system Back gesture is how people dismiss a sheet — on
  // Android it is THE way. Without this it pops the whole page off instead,
  // losing the visit to leave a confirmation dialog. One history entry is
  // pushed per open sheet and consumed on close, so Back and the sheet's own
  // buttons end in exactly the same place, and the entry never outlives the
  // sheet that pushed it (see closeActiveSheet, which every path goes through).
  let ACTIVE_SHEET = null; // { close }
  let SHEET_HISTORY = false;

  function closeActiveSheet(fromPopstate) {
    const active = ACTIVE_SHEET;
    ACTIVE_SHEET = null;
    if (active) active.dismiss();
    if (SHEET_HISTORY) {
      SHEET_HISTORY = false;
      // A popstate IS the entry being consumed; calling back() again would eat
      // a second one and take the rep off the screen.
      if (!fromPopstate) {
        // history.back() is async — its popstate lands after ACTIVE_SHEET/
        // SHEET_HISTORY are already cleared above, so without this flag the
        // listener below can't tell its own echo from a real Back press and
        // falls through to walking the view STACK, dropping the rep a screen
        // further out than the sheet button they actually tapped. Same
        // problem back() below solves for itself with the same flag.
        POPPING = true;
        try { history.back(); } catch (e) { POPPING = false; }
      }
    }
  }
  window.addEventListener("popstate", () => {
    // A sheet is the innermost thing Back can close, so it goes first.
    if (ACTIVE_SHEET || SHEET_HISTORY) { closeActiveSheet(true); return; }
    // Our own history.back() from an in-app back button: the view already moved.
    if (POPPING) { POPPING = false; return; }
    // The phone's Back button. Walk the view stack instead of leaving the page.
    back(true);
  });

  function sheet({ eyebrow, title, sub, body, actions }) {
    if (ACTIVE_SHEET) {
      // Chaining straight into a second sheet (e.g. "End this visit" opening
      // the reason picker) — not a real close. closeActiveSheet()'s
      // history.back() is async; by the time its popstate lands, the new
      // sheet below has already pushed its OWN history entry and become
      // ACTIVE_SHEET, so that stray popstate closed the wrong (new) sheet
      // instead of doing nothing. Dismissing directly, without touching
      // SHEET_HISTORY, keeps the single history entry the first sheet
      // pushed valid for whichever sheet is showing when Back is pressed.
      ACTIVE_SHEET.dismiss();
      ACTIVE_SHEET = null;
    } else {
      closeActiveSheet();
    }
    document.querySelectorAll(".sah-sheet-scrim").forEach((n) => n.remove());
    const scrim = document.createElement("div");
    scrim.className = "sah-sheet-scrim";
    scrim.innerHTML = `<div class="sah-sheet"><div class="grip"></div>
      ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ""}
      ${title ? `<h2>${esc(title)}</h2>` : ""}
      ${sub ? `<p class="sub">${esc(sub)}</p>` : ""}
      ${body || ""}
      <div class="sheet-acts">${(actions || [])
        .map((a, i) => `<button class="sheet-btn ${a.cls || "ghost"}" data-a="${i}">${esc(a.label)}</button>`)
        .join("")}</div>
    </div>`;
    overlayHost().appendChild(scrim);
    requestAnimationFrame(() => scrim.classList.add("show"));
    // dismiss() is the visual half; close() is what callers and the sheet's own
    // buttons use, and it settles the history entry too.
    const dismiss = () => {
      scrim.classList.remove("show");
      setTimeout(() => scrim.remove(), 200);
    };
    const close = () => closeActiveSheet();
    ACTIVE_SHEET = { dismiss };
    if (!SHEET_HISTORY) {
      SHEET_HISTORY = true;
      try { history.pushState({ sahSheet: true }, ""); } catch (e) { SHEET_HISTORY = false; }
    }
    scrim.addEventListener("click", (e) => {
      if (e.target === scrim) close();
    });
    (actions || []).forEach((a, i) =>
      scrim.querySelector(`[data-a="${i}"]`).addEventListener("click", () => {
        if (a.onClick && a.onClick() === false) return;
        close();
      }),
    );
    // An action's onClick returning false keeps the sheet open, which is how
    // a sheet with a form reports a validation failure.
    return { close, el: scrim };
  }

  /* ------------------------------------------------------------- customer */

  const CUSTOMERS_KEY = "fb-discovery-customers-v1";
  function loadCustomers() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(CUSTOMERS_KEY) || "null");
    } catch (e) {
      saved = null;
    }
    return (saved && saved.b2b) || SEED.b2b || [];
  }
  function loadCustomer(id) {
    return loadCustomers().find((c) => c._id === id) || null;
  }

  // Every audit belongs to exactly one location — stock is never mixed
  // across two physical places in one visit. Customer-level intelligence is
  // the aggregate of the location-level history, not a shortcut around it.
  //
  // Type is not decoration: it decides which questions the capture screen is
  // allowed to ask. A warehouse has no shelf, so shelf availability and
  // facings must not be asked there.
  const LOCATION_TYPES = {
    retail_store: { label: "Retail Store", icon: "🏬", shelf: true },
    outlet: { label: "Outlet", icon: "🏪", shelf: true },
    warehouse: { label: "Warehouse", icon: "🏭", shelf: false },
    other: { label: "Other", icon: "📍", shelf: false },
  };
  const locationTypeMeta = (k) => LOCATION_TYPES[k] || LOCATION_TYPES.other;

  const LOCATIONS_KEY = "fb-discovery-stock-locations-v1";
  // Locations a rep added in the field. The customer record only knows the
  // addresses it was set up with, and a visit to anywhere else would
  // otherwise have nowhere to belong.
  const LocationStore = {
    state: {},
    load() {
      try {
        this.state = JSON.parse(localStorage.getItem(LOCATIONS_KEY) || "null") || {};
      } catch (e) {
        this.state = {};
      }
      return this.state;
    },
    save() {
      try {
        localStorage.setItem(LOCATIONS_KEY, JSON.stringify(this.state));
      } catch (e) {
        /* private mode — the prototype still works, it just doesn't persist */
      }
    },
    list(customerId) {
      return this.state[customerId] || [];
    },
    add(customerId, loc) {
      (this.state[customerId] || (this.state[customerId] = [])).push(loc);
      this.save();
      return loc;
    },
  };

  // Most customers have one location — their registered address. A few in the
  // seed carry a genuinely different shipping address (store vs warehouse),
  // which becomes a real second choice here rather than an invented field.
  function locationsFor(c) {
    if (!c) return [];
    const locs = [{
      id: "primary",
      name: "Main Store",
      type: "retail_store",
      line: addressLine(c.adress1, c.state?.name, c.postnr),
    }];
    const sameAsPrimary =
      !c.adress2 ||
      (c.adress2 === c.adress1 && (c.shippingState?.code || "") === (c.state?.code || ""));
    if (!sameAsPrimary) {
      locs.push({
        id: "shipping",
        name: "Warehouse",
        type: "warehouse",
        line: addressLine(c.adress2, c.shippingState?.name, c.shippingPostnumber),
      });
    }
    return locs.concat(LocationStore.list(c._id));
  }
  function locationFor(c, id) {
    return locationsFor(c).find((l) => l.id === id) || null;
  }
  // Does this location have a shelf worth asking about?
  function locationHasShelf(c, id) {
    const l = locationFor(c, id);
    return l ? locationTypeMeta(l.type).shelf : true;
  }
  // "Acme Retail · Kothrud" — the where-am-I line every capture screen carries.
  function placeLine(c, id) {
    const l = locationFor(c, id);
    return [titleCase(nameOf(c)), l && l.name].filter(Boolean).join(" · ");
  }

  /* --------------------------------------------------------------- audits */

  const AUDITS_KEY = "fb-discovery-stock-audits-v1";
  const AuditStore = {
    state: null,
    load() {
      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem(AUDITS_KEY) || "null");
      } catch (e) {
        saved = null;
      }
      const raw = saved || clone(SEED.stockAudits || {});
      // Migrate on read — see normalizeAudit. Covers both the seed and any
      // records a rep already has in localStorage from an earlier build.
      Object.keys(raw).forEach((cid) => (raw[cid] = (raw[cid] || []).map((a) => normalizeAudit(a, cid))));
      this.state = raw;
      return this.state;
    },
    save() {
      try {
        localStorage.setItem(AUDITS_KEY, JSON.stringify(this.state));
      } catch (e) {
        /* private mode — the prototype still works, it just doesn't persist */
      }
    },
    list(customerId) {
      return this.state[customerId] || (this.state[customerId] = []);
    },
    allCustomerIds() {
      return Object.keys(this.state).filter((id) => this.state[id] && this.state[id].length);
    },
  };

  /* -------------------------------------------------- sales orders (vNext) */

  // Confirmed FoodBridge sales orders, same storage convention as AuditStore
  // above: a flat list, newest first, persisted per browser. Separate from
  // audits on purpose — an audit records what IS on the shelf, an order
  // commits to what SHOULD ship, and conflating the two would make the audit
  // history lie the moment a rep edits a recommendation.
  //
  // The Zoho half of the record lives on the SAME object rather than in a
  // queue beside it, because "FoodBridge created / Zoho pending" is one
  // order in two states, not two records to reconcile. That is also what
  // makes retry safe: there is exactly one row to update.
  const ORDERS_KEY = "fb-discovery-sales-orders-v1";

  // Lifecycle. `confirmed` is the commit point — before it there is only an
  // unsaved recommendation on screen, and nothing reaches Zoho.
  const ORDER_STATUS = {
    confirmed: { label: "Confirmed", cls: "ok" },
    zoho_pending: { label: "Zoho pending", cls: "warn" },
    zoho_created: { label: "Zoho created", cls: "ok" },
    zoho_failed: { label: "Zoho failed", cls: "danger" },
  };

  const SalesOrderStore = {
    state: [],
    load() {
      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem(ORDERS_KEY) || "null");
      } catch (e) {
        saved = null;
      }
      this.state = Array.isArray(saved) ? saved : [];
      return this.state;
    },
    save() {
      try {
        localStorage.setItem(ORDERS_KEY, JSON.stringify(this.state));
      } catch (e) {
        /* private mode — the prototype still works, it just doesn't persist */
      }
    },
    add(order) {
      this.state.unshift(order);
      this.save();
      return order;
    },
    byId(id) {
      return this.state.find((o) => o.id === id) || null;
    },
    // Mutate in place and persist: the caller holds the same object, so a
    // Zoho retry updates the row it already created rather than adding one.
    update(id, patch) {
      const o = this.byId(id);
      if (!o) return null;
      Object.assign(o, patch);
      this.save();
      return o;
    },
  };

  // FB-SO-YY-MM-NNN, sequential within the month so two orders raised on the
  // same day are visibly ordered. Derived from what is already stored rather
  // than a counter of its own, which would drift the moment storage is
  // cleared but the orders are not.
  function nextOrderId(when) {
    const d = when ? new Date(when) : new Date();
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const prefix = `FB-SO-${yy}-${mm}-`;
    const n = SalesOrderStore.state.filter((o) => String(o.id).startsWith(prefix)).length + 1;
    return prefix + String(n).padStart(3, "0");
  }

  const DRAFTS_KEY = "fb-discovery-stock-draft-audits-v1";
  // An audit in progress. A rep walks out of a store mid-count all the time —
  // a delivery blocks the aisle, the shutters come down, the phone rings —
  // and losing the count because the page reloaded would make the whole
  // feature untrustworthy. One open draft per customer: a rep is in one
  // store at a time, but may have left one half-done at another.
  const DraftStore = {
    state: {},
    load() {
      try {
        this.state = JSON.parse(localStorage.getItem(DRAFTS_KEY) || "null") || {};
      } catch (e) {
        this.state = {};
      }
      return this.state;
    },
    save() {
      try {
        localStorage.setItem(DRAFTS_KEY, JSON.stringify(this.state));
      } catch (e) {
        /* private mode — the prototype still works, it just doesn't persist */
      }
    },
    get(customerId) { return this.state[customerId] || null; },
    put(draft) { if (draft && draft.customerId) { this.state[draft.customerId] = draft; this.save(); } },
    clear(customerId) { delete this.state[customerId]; this.save(); },
    ids() { return Object.keys(this.state); },
  };
  function persistDraft() {
    if (!DRAFT || !DRAFT.customerId) return;
    // Opening a product screen creates its line so the fields have something
    // to write into; one the rep backed out of without counting is not part
    // of the visit, so it doesn't belong in the saved draft.
    Object.keys(DRAFT.lines).forEach((id) => {
      if (!lineIsCaptured(DRAFT.lines[id])) delete DRAFT.lines[id];
    });
    DraftStore.put(DRAFT);
  }
  const products = SEED.products || [];
  const productById = (id) => products.find((p) => p.id === id);
  const productName = (id) => (productById(id) || {}).name || id;
  // A real photo when the product has one, the emoji glyph as a fallback —
  // every `.thumb` in the app renders through this so the two never drift.
  const thumbHTML = (p) => (p && p.image ? `<img src="${esc(p.image)}" alt="">` : esc((p && p.emoji) || "📦"));

  /* ---------------------------------------------------- observation model */

  // A line on an audit is an OBSERVATION, not a count — what was expected,
  // what was physically found, how that physical stock breaks down by
  // condition and by where it was stored, plus whatever exception detail the
  // condition made relevant (expiry/batch, disposition, damage type). The
  // point is that the record still describes the visit six months later:
  // "20 counted" has already thrown away the fact that 5 of them were expired.
  //
  // Everything derivable — variance, condition totals, whether a line is
  // flagged, audit coverage, the health axes — is computed on read and never
  // stored, so a hand-edited seed can't end up disagreeing with itself.

  // Physical stock splits four ways, and the four must reconcile to the
  // total. That rule is enforced where it's entered, not here.
  const CONDITION_KEYS = [
    { k: "good", label: "Good", legacy: "ok", icon: "✓" },
    { k: "nearExpiry", label: "Near Expiry", legacy: "near_expiry", icon: "⏰" },
    { k: "expired", label: "Expired", legacy: "expired", icon: "⏳" },
    { k: "damaged", label: "Damaged", legacy: "damaged", icon: "⚠️" },
  ];
  // "Couldn't find it" and "confirmed zero on hand" are different business
  // states and must not collapse into each other — one is an unverified line,
  // the other is a stock-out. Hence a line status of its own, `not_found`,
  // still carried on the model and still rendered wherever a record has it.
  // NOT_FOUND_REASONS — the picker that used to set it — went with the count
  // sheet; on the count screen an untouched row now IS the unverified state,
  // and a 0 typed into it is the stock-out. See the inline-pass removal note.
  // Badge vocabulary — the single worst thing true about a line, for the many
  // places a list has room for one pill rather than a whole breakdown.
  const CONDITIONS = [
    { k: "ok", label: "OK", icon: "✓" },
    { k: "damaged", label: "Damaged", icon: "⚠️" },
    { k: "expired", label: "Expired", icon: "⏳" },
    { k: "near_expiry", label: "Near Expiry", icon: "⏰" },
    { k: "out_of_stock", label: "Out of Stock", icon: "🚫" },
    { k: "not_found", label: "Not Found", icon: "❓" },
  ];
  const condMeta = (k) => CONDITIONS.find((c) => c.k === k) || { label: k, icon: "•" };

  // Reasons a visit stopped early. Abandoned means it never really started;
  // partial means it ran and got cut short — see the closure screen.
  const PARTIAL_REASONS = [
    { k: "store_closing", label: "Store closing" },
    { k: "product_unavailable", label: "Product unavailable" },
    { k: "access_restricted", label: "Access restricted" },
    { k: "time", label: "Time constraint" },
    { k: "other", label: "Other" },
  ];
  const OPEN_STATUSES = new Set(["draft", "in_progress", "paused", "review"]);

  // The signed-in rep. Auto-populated everywhere the spec says "do not make
  // the employee type their own name, role, team".
  const AUDITOR = { id: "u-anupam", name: "Anupam", role: "Sales Executive", team: "Pune Team" };

  /* --------------------------------------------------------------- units */

  // Stock does not sit on a shelf one piece at a time. A rep facing a stack of
  // sealed boxes counts boxes, and making them multiply in their head — or
  // open the boxes — is how a count goes wrong. So each product's base unit
  // (SEED.products[].unit) opens onto the pack sizes it actually travels in.
  //
  // Keyed by base unit rather than per product: the seed carries one `unit`
  // string and no packaging at all, and inventing a bespoke ladder for each of
  // twelve mock products would be twelve made-up numbers instead of five. In a
  // real system this table is the product master's packaging config, per SKU —
  // this screen only needs `unitsFor(p)` to keep returning the same shape.
  const UNIT_LADDERS = {
    Pc: [["Pc", 1], ["Tray", 12], ["Carton", 144]],
    Packet: [["Packet", 1], ["Box", 12], ["Pallet", 144]],
    Bottle: [["Bottle", 1], ["Crate", 24], ["Pallet", 480]],
    Crate: [["Crate", 1], ["Pallet", 20]],
    Box: [["Box", 1], ["Pallet", 48]],
  };
  // A product whose base unit isn't in the table still gets a valid ladder of
  // exactly one rung, so every caller can assume there is always a base.
  function unitsFor(p) {
    const base = (p && p.unit) || "Unit";
    return (UNIT_LADDERS[base] || [[base, 1]]).map(([label, per]) => ({ label, per }));
  }
  function unitFactor(p, label) {
    const u = unitsFor(p).find((x) => x.label === label);
    return u ? u.per : 1;
  }
  const baseUnit = (p) => unitsFor(p)[0].label;
  // NOT plural() — a unit name is a label, not a noun to inflect. "Pcs" would
  // scrape by; "Boxs" and "Crates"-but-also-"Pallets" is how you get one of
  // them wrong. Trade paperwork writes "3 Box" and so does this.
  const qtyText = (n, unit) => `${n} ${unit}`;

  const emptyCondition = () => ({ good: 0, nearExpiry: 0, expired: 0, damaged: 0 });
  const emptyStorage = () => ({ shelf: 0, backroom: 0, warehouse: 0, other: 0 });
  const sumOf = (obj) => Object.keys(obj || {}).reduce((n, k) => n + (Number(obj[k]) || 0), 0);

  function blankLine(productId, expected) {
    return {
      productId,
      expected: Number(expected) || 0,
      // `physical` is ALWAYS in base units, so variance, stock-out risk,
      // coverage and the condition buckets keep reading the one scale they
      // always did. What the rep actually keyed lives beside it: countQty of
      // countUnit, with physical = countQty × that unit's pack size. Switching
      // the unit keeps the quantity and recomputes physical — "3" that turns
      // out to be boxes means thirty-six pieces, not three.
      physical: null,
      countQty: null,
      countUnit: null,
      conditionBreakdown: emptyCondition(),
      storageBreakdown: emptyStorage(),
      shelfAvailability: null,
      facings: null,
      expiryDetails: [],
      disposition: null,
      damageType: null,
      notes: "",
      evidence: [],
      status: "pending",
      notFoundReason: null,
    };
  }

  // Audits written before the observation model existed — the original seed,
  // plus whatever is already sitting in a rep's localStorage — carried one
  // enum per line: {system, counted, condition, shelfAvailable}. Read them
  // forward instead of dropping them: the history IS the value of this
  // feature, and migrating on read costs one function and loses nothing.
  function normalizeLine(raw) {
    if (!raw) return null;
    // Discriminate on the LEGACY fields, not on the presence of a
    // conditionBreakdown: a not-found line legitimately has no condition
    // buckets at all, and testing for them sent it down the migration path.
    const legacy = "counted" in raw || "system" in raw;
    if (!legacy) {
      // Already the observation shape, but very likely terse — the seed only
      // spells out the buckets that are non-zero. Fill in the rest so every
      // reader can assume the whole shape is present.
      const line = Object.assign(blankLine(raw.productId, raw.expected), raw);
      line.conditionBreakdown = Object.assign(emptyCondition(), raw.conditionBreakdown);
      line.storageBreakdown = Object.assign(emptyStorage(), raw.storageBreakdown);
      line.expiryDetails = raw.expiryDetails || [];
      line.evidence = raw.evidence || [];
      // Physical stock IS the sum of its condition buckets — that's the
      // reconciliation rule, so deriving it here rather than repeating it in
      // the seed keeps the two from ever disagreeing.
      if (line.physical == null && line.status === "audited") line.physical = sumOf(line.conditionBreakdown);
      backfillCountUnit(line);
      return line;
    }
    const physical = Number(raw.counted) || 0;
    const line = blankLine(raw.productId, raw.system);
    line.physical = physical;
    line.status = "audited";
    const bucket = { ok: "good", near_expiry: "nearExpiry", expired: "expired", damaged: "damaged" }[raw.condition];
    // out_of_stock has no bucket to land in — physical is 0, so every bucket
    // is 0 too, and the stock-out reads off expected-vs-physical instead.
    if (bucket) line.conditionBreakdown[bucket] = physical;
    const onShelf = raw.shelfAvailable !== false;
    line.storageBreakdown[onShelf ? "shelf" : "backroom"] = physical;
    line.shelfAvailability = onShelf ? "available" : "not_on_shelf";
    backfillCountUnit(line);
    return line;
  }

  // Every line written before units existed was counted in base units, by
  // definition — that was the only scale there was. Saying so explicitly beats
  // leaving countUnit null for every reader to special-case.
  function backfillCountUnit(line) {
    if (!line.countUnit) line.countUnit = baseUnit(productById(line.productId));
    if (line.countQty == null && line.physical != null) {
      line.countQty = line.physical / unitFactor(productById(line.productId), line.countUnit);
    }
    return line;
  }

  function normalizeAudit(raw, customerId) {
    const a = raw || {};
    a.customerId = a.customerId || customerId;
    a.lines = (a.lines || []).map(normalizeLine).filter(Boolean);
    // Anything that predates the lifecycle is, by definition, history.
    if (!a.status) a.status = "completed";
    // Every audit that predates vNext's Quick Audit was, by definition, a
    // full catalogue audit — that's the only kind that existed, and it's
    // exactly what an absent mode should mean on read.
    if (a.mode !== "quick") a.mode = "full";
    if (!a.createdAt) a.createdAt = a.at;
    if (!a.completedAt && a.status === "completed") a.completedAt = a.at;
    if (!a.auditor) a.auditor = AUDITOR.name;
    // Who did what, so a half-finished visit picked up by a second rep still
    // reads correctly afterwards.
    if (!a.actors) {
      const done = a.status === "completed";
      a.actors = { createdBy: a.auditor, startedBy: a.auditor, lastEditedBy: a.auditor, completedBy: done ? a.auditor : null };
    }
    if (!a.evidence) a.evidence = [];
    if (!a.finalNote) a.finalNote = "";
    if (!("outcome" in a)) a.outcome = null;
    if (!a.partial) a.partial = { isPartial: false, reason: null, note: "" };
    if (!a.followUp) a.followUp = { required: false, note: "", at: "" };
    // Replenish/pull live in Sales Orders, a different module — this just
    // remembers that a rep already asked, so re-opening the record doesn't
    // invite them to ask again.
    if (!a.actionsTaken) a.actionsTaken = { replenish: false, pull: false };
    return a;
  }


  const linePhysical = (l) => (l.physical == null ? 0 : Number(l.physical) || 0);
  const lineExpected = (l) => Number(l.expected) || 0;
  const lineVariance = (l) => linePhysical(l) - lineExpected(l);
  const lineIsCaptured = (l) => l.status === "audited" || l.status === "not_found";
  const auditLines = (a) => (a && a.lines) || [];

  // The single worst thing true about a line, as a badge key. "Not found"
  // outranks everything because it means the line was never verified at all.
  function dominantCondition(l) {
    if (l.status === "not_found") return "not_found";
    if (l.conditionBreakdown.expired > 0) return "expired";
    if (l.conditionBreakdown.damaged > 0) return "damaged";
    if (l.conditionBreakdown.nearExpiry > 0) return "near_expiry";
    if (lineExpected(l) > 0 && linePhysical(l) === 0) return "out_of_stock";
    return "ok";
  }
  // Approaching stock-out, not merely low: no sellable stock at all, or —
  // only where the expected quantity is big enough for a percentage to mean
  // anything — a quarter or less of it left in good condition.
  function isStockOutRisk(l) {
    if (l.status !== "audited") return false;
    const exp = lineExpected(l);
    if (exp <= 0) return false;
    const good = l.conditionBreakdown.good || 0;
    if (good === 0) return true;
    return exp >= 5 && good <= Math.round(exp * 0.25);
  }
  function isOverstock(l) {
    if (l.status !== "audited") return false;
    const d = lineVariance(l);
    const exp = lineExpected(l);
    return d >= 5 || (exp > 0 && linePhysical(l) >= exp * 2 && d > 0);
  }
  function flaggedLines(audit) {
    return auditLines(audit).filter((l) => lineIsCaptured(l) && dominantCondition(l) !== "ok");
  }
  function varianceLines(audit) {
    return auditLines(audit).filter((l) => l.status === "audited" && lineVariance(l) !== 0);
  }
  function stockOutLines(audit) {
    return auditLines(audit).filter(isStockOutRisk);
  }
  function conditionTotals(a) {
    const t = emptyCondition();
    auditLines(a).forEach((l) => CONDITION_KEYS.forEach((c) => (t[c.k] += Number(l.conditionBreakdown[c.k]) || 0)));
    return t;
  }
  // Coverage is about confidence, not health: how much of what we set out to
  // check actually got checked. `expected` is snapshotted onto the audit at
  // creation so a later catalogue change can't retroactively move the
  // denominator on a closed visit.
  function auditCoverage(a) {
    const lines = auditLines(a);
    const audited = lines.filter((l) => l.status === "audited").length;
    const notFound = lines.filter((l) => l.status === "not_found").length;
    // `|| lines.length || products.length` used to fall through when
    // expectedProducts was legitimately 0 (a Quick Audit with nothing
    // selected) — 0 is falsy, so it silently fell back to the full
    // catalogue count (12) instead of reporting the real, empty scope.
    // != null preserves the fallback for genuinely-absent values (older
    // records normalizeAudit never saw this field on) without mistaking a
    // real zero for one of them.
    const expected = a && a.expectedProducts != null ? a.expectedProducts : (lines.length || products.length);
    const skipped = Math.max(0, expected - audited - notFound);
    return { expected, audited, notFound, skipped, pct: expected ? Math.round((audited / expected) * 100) : 0 };
  }
  // Only a shelf a rep can't sell from earns a stop sign; "partially
  // available" is a nudge, and an unrated shelf (a warehouse visit) says
  // nothing at all.
  function auditsFor(customerId) {
    return AuditStore.list(customerId)
      .slice()
      .sort((a, b) => new Date(b.at) - new Date(a.at));
  }
  // The completed visit right before a given one — what a rep is really
  // asking when they open an old audit and wonder "was this better or worse
  // than last time".
  function previousCompleted(customerId, auditId) {
    const list = auditsFor(customerId);
    const idx = list.findIndex((a) => a.id === auditId);
    if (idx === -1) return null;
    for (let i = idx + 1; i < list.length; i++) if (list[i].status === "completed") return list[i];
    return null;
  }

  // The one current-stock source the Predictive Sales Order flow is allowed
  // to read. COMPLETED only, and deliberately so: this flow discards an
  // unfinished visit outright (see exitAuditSheet) precisely because a
  // half-walked shop is not a stock position, and a live draft is a count
  // still being taken. Either would put numbers a rep never stood behind
  // into an order that ships. `auditsFor` is already newest-first, so the
  // first completed record is the latest one.
  function latestCompletedAuditFor(customerId) {
    return auditsFor(customerId).find((a) => a.status === "completed") || null;
  }

  /* ------------------------------------------------------- health signals */

  // Audit-visit cadence — independent of ordering. "Never audited" counts
  // Reorder cadence — synthesized signal (see SEED.orderingSignals). Absent
  // on purpose for customers with no signal yet: "Unknown" is the honest
  // answer, not a guessed "On Track".
  function orderingStatusFor(customerId) {
    const sig = SEED.orderingSignals && SEED.orderingSignals[customerId];
    const orders = (sig && sig.orders) || [];
    if (!sig || !orders.length) return { bucket: "unknown", label: "Unknown", orders: [] };
    const last = orders[0];
    const expected = new Date(last.at).getTime() + sig.avgCycleDays * DAY;
    const days = Math.round((now() - expected) / DAY);
    let bucket, label;
    if (days > 5) { bucket = "overdue"; label = "Overdue"; }
    else if (days > 0) { bucket = "slipping"; label = "Slipping"; }
    else { bucket = "on_track"; label = "On Track"; }
    // The cycle the customer actually keeps, alongside the one we expect of
    // them. When those two disagree, the expectation is the thing that's
    // wrong, and a rep staring at "usually every 7 days" deserves to know.
    let observedCycle = null;
    if (orders.length > 1) {
      const spans = orders.slice(0, -1).map((o, i) => (new Date(o.at) - new Date(orders[i + 1].at)) / DAY);
      observedCycle = Math.round(spans.reduce((a, b) => a + b, 0) / spans.length);
    }
    const avgValue = Math.round(orders.reduce((n, o) => n + (o.value || 0), 0) / orders.length);
    return {
      bucket, label, orders,
      lastOrderAt: last.at, lastOrderValue: last.value,
      avgCycleDays: sig.avgCycleDays, observedCycle, avgValue,
      expectedAt: expected, daysOverdue: days,
    };
  }
  // "In ~2 days" is what a rep can act on; a timestamp is not.
  function expectedOrderText(order) {
    if (!order.expectedAt) return "Unknown";
    const days = -order.daysOverdue;
    if (days > 1) return `In ~${days} days`;
    if (days === 1) return "Tomorrow";
    if (days === 0) return "Due today";
    return `Overdue by ${plural(-days, "day")}`;
  }
  const money = (n) => (n == null ? "" : "₹" + Number(n).toLocaleString("en-IN"));

  // Raw 0-100 score from one audit — shared by the per-customer health ring
  // (customerScoreFor, 4-tier label) and the Complete Audit summary
  // (computeAuditScore, its own 3-tier copy) so the two never drift apart on
  // the underlying math, only on how each screen chooses to describe it.
  // Four axes rather than one number, because "78/100" on its own doesn't
  // tell a rep what to go fix. Each is null when this visit says nothing
  // about it — a warehouse audit captures no shelf data, and a customer with
  // no ordering signal has no ordering score — and nulls drop out of the
  // roll-up instead of being counted as zero.
  function healthBreakdown(a) {
    const lines = auditLines(a).filter((l) => l.status === "audited");
    const out = { stock: null, shelf: null, expiry: null, ordering: null };

    if (lines.length) {
      const clean = lines.filter((l) => !isStockOutRisk(l) && !isOverstock(l) && lineVariance(l) === 0).length;
      out.stock = Math.round((clean / lines.length) * 100);

      const shelfLines = lines.filter((l) => l.shelfAvailability);
      if (shelfLines.length) {
        const pts = shelfLines.reduce((s, l) => s + (l.shelfAvailability === "available" ? 1 : l.shelfAvailability === "partial" ? 0.5 : 0), 0);
        out.shelf = Math.round((pts / shelfLines.length) * 100);
      }

      // Share of the units actually on hand that are still sellable for long
      // enough to matter. Damaged stock is a stock-quality problem, not an
      // expiry one, so it stays out of this axis.
      const units = lines.reduce((s, l) => s + linePhysical(l), 0);
      const risky = lines.reduce((s, l) => s + (l.conditionBreakdown.nearExpiry || 0) + (l.conditionBreakdown.expired || 0), 0);
      out.expiry = units ? Math.round((1 - risky / units) * 100) : 100;
    }

    const os = a.customerId ? orderingStatusFor(a.customerId) : { bucket: "unknown" };
    out.ordering = { on_track: 100, slipping: 70, overdue: 40 }[os.bucket] ?? null;
    return out;
  }
  // Each is a percentage, not a count — "Stock 0" on its own reads as a
  // product count or a stock level; "0%" plus a caption of what's being
  // measured is what makes it readable without reverse-engineering the
  // formula.
  const HEALTH_AXES = [
    { k: "stock", label: "Stock", weight: 0.4, desc: "Products with no stock issues" },
    { k: "shelf", label: "Shelf", weight: 0.2, desc: "Shelf checks rated available" },
    { k: "expiry", label: "Expiry", weight: 0.25, desc: "Units not at expiry risk" },
    { k: "ordering", label: "Ordering", weight: 0.15, desc: "Based on order cadence, not this visit" },
  ];

  // Raw 0-100 roll-up from one audit — shared by the per-customer health ring
  // (customerScoreFor, 4-tier label) and the Complete Audit summary
  // (computeAuditScore, its own 3-tier copy) so the two never drift apart on
  // the underlying math, only on how each screen chooses to describe it.
  // Partial coverage deliberately does NOT cost points: auditing 42 of 50
  // products makes the score less certain, not the customer less healthy.
  function scoreFromAudit(a) {
    const hb = healthBreakdown(a);
    let sum = 0, weight = 0;
    HEALTH_AXES.forEach((ax) => {
      if (hb[ax.k] == null) return;
      sum += hb[ax.k] * ax.weight;
      weight += ax.weight;
    });
    let score = weight ? sum / weight : 100;
    // An open follow-up is a known unresolved issue, not just a past one.
    if (a.followUp && a.followUp.required) score -= 8;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function scoreLabel(score) {
    if (score == null) return { cls: "unknown", label: "Not Audited" };
    if (score >= 90) return { cls: "excellent", label: "Excellent" };
    if (score >= 75) return { cls: "good", label: "Good" };
    if (score >= 55) return { cls: "fair", label: "Fair" };
    return { cls: "poor", label: "Needs Attention" };
  }
  /* ------------------------------------------------------------------ router */

  // vNext hard reset: the stakeholder flow (quick-pick → quick-count) is the
  // ONLY user-facing Stock Audit journey. "customers" (triage landing),
  // "needs-attention", "customer-detail", "customer-audits", "create-customer"
  // and "workspace" are no longer reachable from any nav/link/redirect in
  // this file — see the removed-view block near the end for what used to
  // live there and why it's gone, not merely hidden.
  let PAGE = null;
  let STACK = [];
  let CURRENT = { view: "quick-pick", params: {} };
  let DRAFT = null; // in-progress audit while Quick Audit is open

  // Every view the STACK remembers is also a history entry, so the phone's own
  // Back — Android's gesture/button, Safari's swipe — walks this flow instead
  // of leaving it. Without the pushState below, history.length stayed 1 for the
  // whole journey and a rep three screens deep who swiped back was dropped out
  // of the app entirely, mid-audit. Verified on device: Back from Audit Detail
  // exited Chrome to the launcher.
  //
  // POPPING marks the one popstate we cause ourselves (an in-app back button
  // calls history.back()), so the listener does not pop the STACK a second time
  // for a move it has already made.
  let POPPING = false;

  function go(view, params, replace) {
    const changed = view !== CURRENT.view;
    if (!replace) {
      STACK.push(CURRENT);
      try { history.pushState({ sahView: STACK.length }, ""); } catch (e) { /* file:// */ }
    }
    CURRENT = { view, params: params || {} };
    renderCurrent();
    if (changed) scrollTop();
  }
  // fromPopstate: the history entry is already gone, so do not spend another.
  function back(fromPopstate) {
    const prev = STACK.pop();
    if (prev) { CURRENT = prev; renderCurrent(); scrollTop(); }
    else go("quick-pick", {}, true);
    if (fromPopstate !== true) {
      POPPING = true;
      try { history.back(); } catch (e) { POPPING = false; }
    }
  }
  function scrollTop() {
    const el = document.scrollingElement || document.documentElement;
    if (el) el.scrollTop = 0;
  }

  function renderCurrent() {
    ({
      audits: renderAudits,
      audit: renderAudit,
      "quick-pick": renderQuickPick,
      "quick-count": renderQuickCount,
      "order-pick": renderOrderPick,
      "order-build": renderOrderBuild,
      "order-success": renderOrderSuccess,
    })[CURRENT.view]?.();
  }

  // Location and purpose are resolved automatically rather than asked for —
  // the default location is whichever the customer trades from (first on
  // file; the rep can switch it inline in the Workspace header if there's
  // more than one), and every audit starts as a routine stock check unless
  // something downstream genuinely needs a different purpose. Nothing here
  // blocks the count from starting.
  // "mode" is a read-only historical marker now, not a branch — the old
  // comprehensive-catalogue flow ("full") has no user-facing entry point
  // left (see the removed-view block near the end of this file), so every
  // new draft is the stakeholder's one Stock Audit flow. The field stays on
  // the record because normalizeAudit/expectedProductsFor already key off
  // it (harmlessly — "full" never occurs for a new draft, but old completed
  // audits in AuditStore may still carry it, and their coverage math must
  // keep reading the same way it always did).
  function newDraft(customerId) {
    const customer = loadCustomer(customerId);
    const locs = customer ? locationsFor(customer) : [];
    const stamp = new Date();
    return {
      customerId,
      mode: "quick",
      selected: [],
      locationId: locs[0] ? locs[0].id : null,
      purpose: "routine",
      at: stamp.toISOString().slice(0, 16),
      auditor: AUDITOR.name,
      status: "draft",
      createdAt: stamp.toISOString(),
      startedAt: null,
      pausedAt: null,
      notes: "",
      lines: {},
    };
  }

  // The one entry point for "count this customer's stock" — no setup screen
  // in between, and no question asked on the way in: picking a customer always
  // starts a brand-new visit. Any half-finished draft still sitting under that
  // customer is cleared here rather than offered back.
  function startAuditFor(customerId) {
    DraftStore.clear(customerId);
    DRAFT = newDraft(customerId);
    go("quick-count", { customerId });
  }

  /* =============================================================================================
     REMOVED (inline pass): resumeDraft / resumeOrRestartSheet — the "You have a
     visit in progress here → Resume that visit / Start a new one instead" bottom
     sheet that stood between picking a customer and counting. Every visit starts
     fresh now (startAuditFor, above), so there is nothing to ask about. Two
     things followed it out: pauseAudit and the exit sheet's "Pause — keep my
     progress" action, which promised a resumption that can no longer happen (see
     exitAuditSheet), and draftProgress, whose only caller was this sheet.

     DraftStore itself STAYS and still saves on every count — it is the
     crash-safety net a rep needs when a page reloads mid-visit, not a resume
     feature; startAuditFor simply never reads it back.
     ================================================================================================= */

  /* --------------------------------------------------------- persistent nav */

  function navActiveKey(view) {
    if (view === "quick-pick" || view === "quick-count") return "stock-audit";
    if (view === "audits" || view === "audit") return "audits";
    if (view === "order-pick" || view === "order-build" || view === "order-success") return "create-order";
    return null;
  }

  // Two destinations, not three: Stock Audit (the one stakeholder journey —
  // this IS the "new audit" action, so there is no separate "+ New Audit"
  // anymore) and Audit History (a downstream record, not a competing way to
  // start a visit — see the removed-view block near the end of this file
  // for what used to live in this bar and why it doesn't anymore).
  //
  // It renders on EVERY view, quick-count included. It used to be suppressed
  // during a count, on the argument that a task screen shouldn't also be a
  // dashboard — but that left the rep with no way to check Audit History
  // mid-visit and come back, and the two tabs are a toggle, not a departure:
  // see wireNav, where Stock Audit returns to the count in progress rather
  // than to the picker.
  function navHTML(view) {
    const active = navActiveKey(view);
    return `
      <div class="sah-nav">
        <button class="nav-btn ${active === "stock-audit" ? "active" : ""}" data-nav="stock-audit"><span class="ic">🧾</span>Stock Audit</button>
        <button class="nav-btn ${active === "create-order" ? "active" : ""}" data-nav="create-order"><span class="ic">🛒</span>Create Order</button>
        <button class="nav-btn ${active === "audits" ? "active" : ""}" data-nav="audits"><span class="ic">🗂️</span>Audit History</button>
      </div>`;
  }

  // A toggle between the two tabs, so stepping over to Audit History and back
  // costs a rep nothing. The Stock Audit tab is therefore "whatever I'm doing
  // in Stock Audit right now": the live count if one is open, the customer
  // picker if not. That is NOT the resume prompt coming back — nothing here
  // reads a saved draft off DraftStore or asks a question; it just doesn't
  // throw away the count already open in this session. Leaving a count for
  // real is still Exit Audit's job, which asks first.
  function wireNav() {
    PAGE.querySelectorAll("[data-nav]").forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.nav;
        if (k === "stock-audit") {
          if (DRAFT && DRAFT.customerId) { go("quick-count", { customerId: DRAFT.customerId }, true); return; }
          QP_STATE = { q: "", primed: false, focused: false };
          go("quick-pick", {}, true);
        } else if (k === "create-order") {
          // Same courtesy the Stock Audit tab extends: an order being built
          // is "whatever I'm doing in Create Order right now", so stepping
          // over to another tab and back does not throw the edits away. Only
          // a finished (or abandoned) order resets to a fresh search.
          if (ORDER && ORDER.customerId) { go("order-build", { customerId: ORDER.customerId }, true); return; }
          OP_STATE = { q: "", focused: false };
          go("order-pick", {}, true);
        } else if (k === "audits") go("audits", {}, true);
      };
    });
  }

  // Every view's HTML + the persistent nav, optionally with a sticky action
  // bar sitting just above the nav (foot).
  function frame(bodyHTML, { foot } = {}) {
    PAGE.innerHTML = `<div class="sah-wrap${foot ? " has-foot" : ""}">${bodyHTML}</div>${foot || ""}${navHTML(CURRENT.view)}`;
    wireNav();
  }

  /* ----------------------------------------------------------- shared bits */

  // What a phone keyboard must NOT do to a search box in a field tool.
  // A rep types store names and SKUs — "b401", "250ML PET" — into these, and
  // by default iOS and Android both capitalise the first letter and run
  // autocorrect over the rest, so "b401" arrives as "B401" and an unusual
  // store name gets silently rewritten to a dictionary word mid-typing. The
  // matcher lowercases, so capitalisation alone was survivable; a substituted
  // SKU is not. enterkeyhint puts "Search" on the return key instead of a
  // newline glyph that does nothing here.
  const SEARCH_ATTRS =
    'autocapitalize="none" autocorrect="off" autocomplete="off" spellcheck="false" enterkeyhint="search"';

  function wireSearchInput(id, onInput, onFocus) {
    const box = $("#" + id, PAGE);
    if (!box) return;
    box.oninput = debounce(() => {
      onInput(box.value);
      const b = $("#" + id, PAGE);
      if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
    }, 220);
    // onFocus returns true only the first time (a re-render replaces this
    // node, so the programmatic .focus() below re-fires "focus" on the new
    // one — returning false there stops that from looping).
    if (onFocus) box.onfocus = () => {
      if (!onFocus()) return;
      const b = $("#" + id, PAGE);
      if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
    };
  }

  /* =============================================================================================
     REMOVED (vNext hard reset): Customers landing (triage list, filter chips,
     sort) and its Needs Attention drill-down. Both were the old discovery
     screen's entry point — browse-all-customers-and-triage — which the
     stakeholder flow explicitly replaces with search-first quick-pick as the
     ONLY customer entry. Neither is reachable from anywhere in this file
     anymore (no nav button, no redirect); removed rather than left dead,
     since nothing else in the new flow depended on them (verified: every
     helper they alone used — avatarFor, sortCustomers, customerCardHTML,
     wireStartButtons, startButtonHTML, naCardHTML, reasonDetailText,
     reasonsFor, visitBucketFor, nextActionFor, customerScoreFor, FILTERS,
     matchesFilter, filterCount — went with them). What Quick Audit needs
     instead — search, select, start — lives in quick-pick (below).
     ================================================================================================= */

  /* ================================================================= VIEW: audits (secondary) */

  // A field-visit history, not an activity log. Each row answers who was
  // visited, when, what kind of visit, whether anything was wrong, and how
  // healthy they were left — in that order, because that's the order a rep
  // asks the questions in.

  const AUD_SORTS = [
    { k: "newest", label: "Newest" },
    { k: "oldest", label: "Oldest" },
  ];

  const AUD_PAGE = 8;
  let AUD_STATE = { q: "", sort: "newest", shown: AUD_PAGE };

  function allAuditRows() {
    const custMap = {};
    loadCustomers().forEach((c) => (custMap[c._id] = c));
    const rows = [];
    AuditStore.allCustomerIds().forEach((cid) => {
      AuditStore.list(cid).forEach((a) => rows.push({ audit: a, customerId: cid, customer: custMap[cid] || {} }));
    });
    return rows;
  }

  function renderAudits() {
    const all = allAuditRows();

    let rows = all;
    const q = AUD_STATE.q.trim().toLowerCase();
    if (q) rows = rows.filter((r) =>
      nameOf(r.customer).toLowerCase().includes(q) ||
      (r.audit.notes || "").toLowerCase().includes(q) ||
      (r.audit.finalNote || "").toLowerCase().includes(q));

    rows.sort((x, y) => {
      if (AUD_STATE.sort === "oldest") return new Date(x.audit.at) - new Date(y.audit.at);
      return new Date(y.audit.at) - new Date(x.audit.at);
    });

    const shown = rows.slice(0, AUD_STATE.shown);

    frame(`
      <div class="sah-page-head">
        <div class="row"><div><h1>Audit History</h1><p>Every customer visit, newest first.</p></div></div>
      </div>

      <div class="sah-search-row">
        <div class="sah-search"><input type="search" id="audQ" ${SEARCH_ATTRS} value="${esc(AUD_STATE.q)}" placeholder="Search customer or note…"></div>
      </div>

      <div class="section-head-row">
        <h2>Recent Audits</h2>
        <label class="sort-field">Sort:
          <select id="audSort">${AUD_SORTS.map((s) => `<option value="${s.k}" ${AUD_STATE.sort === s.k ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select>
        </label>
      </div>

      ${shown.length
        ? `<div class="aud-list">${shown.map(auditRowCardHTML).join("")}</div>`
        : `<div class="sah-empty"><div class="big">🗂️</div><p>${all.length ? "No visits match this view." : "No audits recorded yet."}</p></div>`}

      ${rows.length
        ? `<div class="aud-more">
            <span>Showing ${shown.length} of ${plural(rows.length, "audit")}</span>
            ${rows.length > shown.length ? `<button type="button" id="audMore">Load more ⌄</button>` : ""}
          </div>`
        : ""}
    `);

    wireSearchInput("audQ", (v) => { AUD_STATE.q = v; AUD_STATE.shown = AUD_PAGE; renderAudits(); });
    $("#audSort", PAGE).onchange = (e) => { AUD_STATE.sort = e.target.value; renderAudits(); };
    const more = $("#audMore", PAGE);
    if (more) more.onclick = () => { AUD_STATE.shown += AUD_PAGE; renderAudits(); };
    PAGE.querySelectorAll("[data-open-audit]").forEach((el) => {
      el.onclick = () => go("audit", { customerId: el.dataset.customer, auditId: el.dataset.openAudit });
    });
  }

  // A log line, not a triage line: who, when, what kind of visit, whether it
  // finished, and how many products got checked. No variance/flagged/follow-
  // up signals and no health score — those were this card's own Layer 2/3
  // (see the removal note above auditsIn, below); a plain count is the one
  // fact from the count itself worth surfacing here.
  function auditRowCardHTML({ audit: a, customerId, customer }) {
    const checked = auditLines(a).length;

    return `
      <button type="button" class="aud-card" data-open-audit="${esc(a.id)}" data-customer="${esc(customerId)}">
        <span class="body">
          <span class="nm">${esc(titleCase(nameOf(customer)))}</span>
          <span class="when">${esc(fmtDate(a.at))}</span>
          <span class="signals"><span class="calm">${esc(plural(checked, "product"))} checked</span></span>
        </span>
        <span class="chev">›</span>
      </button>`;
  }

  /* =============================================================================================
     REMOVED (vNext hard reset): Customer Detail (the "Customer Health & Visit
     Hub" — header, action row, attention chips, snapshot, ordering, product
     issues, activity feed, contact card) and its wiring. This was the old
     journey's required stop between picking a customer and starting a count;
     the stakeholder flow skips it entirely (search → select → count directly
     — see quick-pick/quick-count). Not reachable from anywhere in this file
     anymore.

     REMOVED (Layer 2/3 UX pass, second wave): DETAIL/auditsIn/completedIn/
     isLowStock/issueFor and the whole Inventory view built on them
     (INV_FILTERS/INV_STATE/invMatches/invRowHTML/notAuditedHTML/
     renderInventory) — kept once, as Audit Detail's own downstream
     issue-drill-down, but Audit Detail no longer has an "issues" concept to
     drill into (see the removal note above renderAudit, below), so nothing
     in this file opens Inventory anymore. isStockOutRisk/isOverstock/
     conditionTotals/stockOutLines/flaggedLines/varianceLines stayed — the
     scoring/recommendation engine (scoreFromAudit, healthBreakdown,
     recommendedActions, suggestedOutcome) still reads them, even though no
     screen renders their output right now.
     ================================================================================================= */

  /* ================================================================= VIEW: audit (one visit) */

  /* =============================================================================================
     REMOVED (Layer 2/3 UX pass): auditNeedsActionHTML ("Needs Action" tiles
     — Low Stock/Near Expiry/Damaged/Follow-up), stockConditionSummaryHTML
     ("Stock Condition Summary" segmented bar), productFindingsSectionHTML
     (issue-ranked "Product Findings", replaced below by
     productsCheckedSectionHTML — a plain log of every line, not just the
     ones with something wrong), evidenceFor/evidenceSectionHTML/
     EVIDENCE_ICON/EVIDENCE_IMAGE (photo evidence gallery), auditActionsHTML
     ("Actions" — replenish/pull/damage-claim recommendations),
     visitNotesSectionHTML ("Visit Notes"), customerContextSectionHTML
     ("Customer Context" — health-score trend, ordering cycle, last/next
     order), auditLineDetailSheet (per-line condition/storage/expiry/
     disposition/evidence replay), followUpHTML/wireFollowUp (the Follow-up
     flag box and its Create/Clear button). All of it was analysis drawn
     from a completed visit, not the visit record itself — Audit Detail is
     now just what productsCheckedSectionHTML shows: status and the plain
     list of what was counted (auditCoverageHTML — the Coverage box — was
     cut in the same pass for the same reason: derived summary, not the
     record). The engine
     underneath (scoreFromAudit, healthBreakdown, recommendedActions,
     suggestedOutcome, issueFor's lower-level pieces — isStockOutRisk,
     isOverstock, conditionTotals, stockOutLines, flaggedLines,
     varianceLines) is untouched; nothing currently renders its output, but
     completeAudit still computes and stores it on every audit, so it's
     there the moment a screen needs it again. issueFor/isLowStock/
     notFoundMeta/CONDITION_KEYS' storage-display sibling STORAGE_KEYS/
     SHELF_AVAILABILITY/shelfMeta/shelfBadgeHTML/expiryLines went too —
     each had no caller left once auditLineDetailSheet and Inventory
     (removed just above) were gone.
     ================================================================================================= */

  // What the rep counted, in the words they counted it in. A line taken in
  // boxes says so and gives the base-unit total in brackets — "3 Box (36 Pc)"
  // — because both are the record: the second is what reconciles against
  // system stock, the first is what someone can walk back into the store and
  // check. Base-unit lines, which is every line before units existed, read
  // exactly as they always did.
  function countedText(p, l) {
    const base = baseUnit(p);
    const unit = l.countUnit || base;
    const physical = linePhysical(l);
    if (unit === base || l.countQty == null) return `${physical} ${base}`.trim();
    return `${l.countQty} ${unit} (${qtyText(physical, base)})`;
  }

  // A flat log of what was counted on this visit — not a findings view.
  // Every captured line shows, in the order the rep counted them, with
  // exactly the fact that matters: how many, or that it wasn't found.
  function productsCheckedSectionHTML(a) {
    const lines = auditLines(a);
    return `
      <div class="section-head-row"><h2>Products Checked</h2>${lines.length ? `<span class="src">${plural(lines.length, "product")}</span>` : ""}</div>
      <div class="cd-card pi-card">
        ${lines.length
          ? lines.map((l) => {
              const p = productById(l.productId) || {};
              const nf = l.status === "not_found";
              return `<div class="pi-row static">
                <span class="info">
                  <span class="nm">${esc(p.name || l.productId)}</span>
                  <span class="sku">SKU ${esc(p.artNo || "—")}</span>
                </span>
                <span class="right">
                  <span class="qty">${nf ? "Not found" : esc(countedText(p, l))}</span>
                </span>
              </div>`;
            }).join("")
          : `<div class="rv-line muted" style="padding:11px 0"><span class="ic">—</span><span class="txt">No products were counted on this visit.</span></div>`}
      </div>`;
  }

  function renderAudit() {
    const customer = loadCustomer(CURRENT.params.customerId);
    const a = auditsFor(CURRENT.params.customerId).find((x) => x.id === CURRENT.params.auditId);
    if (!customer || !a) { go("quick-pick", {}, true); return; }

    frame(`
      <div class="sah-page-head">
        <div class="row" style="align-items:center">
          <button type="button" class="back" id="auBack">← ${esc(titleCase(nameOf(customer)))}</button>
          <span style="font-size:12.5px;color:var(--muted)">${esc(fmtDate(a.at))}</span>
        </div>
      </div>

      ${productsCheckedSectionHTML(a)}
    `);

    // Wrapped, not passed directly: as a handler, back would receive the click
    // Event as its fromPopstate argument and skip spending the history entry.
    $("#auBack", PAGE).onclick = () => back();
  }

  /* =============================================================================================
     REMOVED (vNext hard reset): "create-customer" (the old "+ New Audit"
     picker) and addLocationSheet (only ever opened from the old full-audit
     Workspace's location switcher, which is also removed). quick-pick
     (below) is the one customer-search screen now, for every entry point.
     ================================================================================================= */


  /* ================================================================= VIEW: quick-pick (vNext) */

  // Search-first customer entry for Quick Audit — the requirements doc's
  // explicit "do not show the complete customer list." Same search/select
  // shape as renderCreateCustomer (above); it can arrive pre-filled with a
  // search hint (Entry Point B — see mount()) instead of always starting
  // blank. The box being active — tapped into, whether or not anything's
  // typed yet — is the one thing that puts a dropdown on screen: empty and
  // active previews the first 5 customers A-Z (a bounded preview, not the
  // full list the requirement rules out); typed and active is a live,
  // unbounded search. Untouched is the only state with no dropdown at all.
  let QP_STATE = { q: "", primed: false, focused: false };

  function renderQuickPick() {
    if (CURRENT.params.prefill != null && !QP_STATE.primed) {
      QP_STATE.q = CURRENT.params.prefill;
      QP_STATE.primed = true;
    }
    const q = QP_STATE.q.trim().toLowerCase();
    const allCustomers = loadCustomers();
    const active = QP_STATE.focused;
    const previewing = active && !q;
    const rows = !active
      ? []
      : q
        ? allCustomers.filter((c) => [nameOf(c), c.phone].some((v) => String(v || "").toLowerCase().includes(q)))
        : allCustomers.slice().sort((a, b) => nameOf(a).localeCompare(nameOf(b))).slice(0, 5);

    frame(`
      <div class="sah-page-head">
        <h1>Customer Stock Audit</h1><p>Who are you visiting?</p>
      </div>
      <div class="sah-search-row"><div class="sah-search"><input type="search" id="qpQ" ${SEARCH_ATTRS} value="${esc(QP_STATE.q)}" placeholder="Search customers…"></div></div>
      ${!active
        ? `<div class="sah-empty"><div class="big">🔍</div><p>Search for the customer you're visiting.</p></div>`
        : `<div class="picker-list dropdown">${rows.length
            ? rows.map((c) => `
              <button type="button" class="picker-row" data-pick="${c._id}">
                <span class="av">${esc(titleCase(nameOf(c)).charAt(0) || "C")}</span>
                <span><span class="nm">${esc(titleCase(nameOf(c)))}</span><div class="sub">${esc(addressLine(c.adress1, c.state?.name, c.postnr))}</div></span>
              </button>`).join("")
            : `<div class="dropdown-empty">No customers found.</div>`}${previewing && allCustomers.length > rows.length ? `<div class="suggest-hint">Showing ${rows.length} of ${plural(allCustomers.length, "customer")} — keep typing to search all</div>` : ""}</div>`}
    `);

    wireSearchInput("qpQ", (v) => { QP_STATE.q = v; renderQuickPick(); }, () => {
      if (QP_STATE.focused) return false;
      QP_STATE.focused = true;
      renderQuickPick();
      return true;
    });
    PAGE.querySelectorAll("[data-pick]").forEach((b) => (b.onclick = () => {
      QP_STATE = { q: "", primed: false, focused: false };
      startAuditFor(b.dataset.pick);
    }));
  }

  /* ================================================================= VIEW: quick-count (vNext) */

  // Search-first product selection AND counting on one screen — no
  // navigation between "select" and "count" (requirements doc: "one
  // continuous task, not multiple forms"), and since the inline pass, no
  // sheet in between either: the count happens in the row. DRAFT.selected is
  // the rep's curated scope; DRAFT.lines gains an entry only once a product
  // is actually counted.
  let QC_STATE = { q: "", focused: false };
  // Whether the sticky footer is showing the inline "Finish this audit?"
  // confirmation rather than the Finish button. Any re-render of the whole
  // view (a search, an add, a remove) puts it back — those are all changes to
  // what would be finished, so a confirmation raised against the older scope
  // should not survive them.
  let QC_CONFIRM = false;

  // The rep's own scope and how much of it is counted — the numbers the head,
  // the progress bar and the footer all read, computed one way in one place.
  function quickStats() {
    const selected = DRAFT.selected.map(productById).filter(Boolean);
    const counted = selected.filter((p) => DRAFT.lines[p.id] && lineIsCaptured(DRAFT.lines[p.id]));
    return {
      selected,
      captured: counted.length,
      total: selected.length,
      pct: selected.length ? Math.round((counted.length / selected.length) * 100) : 0,
    };
  }

  // Two states, sized for the one-line header this now sits in. A ratio is
  // meaningless before anything is selected ("0 / 0 counted" reads as broken),
  // so that case says what to do instead; from the first selection on, the
  // ratio is the honest answer and "0 / 4 counted" is a fine way to start.
  // (There used to be a third, "4 products selected", for the not-yet-counted
  // case — a whole line to say the same thing as 0 / 4.)
  function quickProgressText(s) {
    if (!s.total) return "Select products";
    return `${s.captured} / ${s.total} counted`;
  }

  // REMOVED: quickUnitsText and the card's "Total counted" bottom line, which
  // mirrored Delivery Management's "Order Total". A running total earns that
  // slot on an order — the money is the point — but a stock count has no such
  // figure: the header already says N / M counted, and summing units across
  // bottles, packets and pieces adds a number nobody asked for.

  function renderQuickCount() {
    const customer = loadCustomer(CURRENT.params.customerId);
    if (!customer || !DRAFT) { go("quick-pick", {}, true); return; }
    if (!DRAFT.startedAt) DRAFT.startedAt = new Date().toISOString();
    if (DRAFT.status === "draft") DRAFT.status = "in_progress";
    persistDraft();
    QC_CONFIRM = false;

    const q = QC_STATE.q.trim().toLowerCase();
    // Both levels of the catalogue's own hierarchy, not just the top one. The
    // group ("SPICE", "PICKLE AND MURABBA") is what a rep reaches for when they
    // want everything of a kind; the sub-category is the word that separates
    // one jar from the next ("GARLIC PICKLE" vs "MANGO PICKLE"), and for a
    // product named after its pack size it can be the only place that word
    // appears at all.
    const matches = (p) =>
      [p.name, p.artNo, p.category, p.subCategory].join(" ").toLowerCase().includes(q);
    const s = quickStats();
    // A preview of the first 5 A-Z only offers itself before anything is
    // selected — once the rep has a running Selected products list, tapping
    // back into the box shouldn't bury it under an unrelated suggestion set.
    // Typing a query always wins regardless (see the dropdown block below).
    const previewing = !q && QC_STATE.focused && !s.total;
    // (The order screen's equivalent below adds one more way in: "+ Add
    // Product" is an explicit request to add, so it opens the dropdown even
    // with a list already on screen. This screen has no such button — its
    // search box IS the add affordance — so the rule stays as it was.)
    const searching = !!q || previewing;
    const available = products.filter((p) => !DRAFT.selected.includes(p.id));
    const results = !searching
      ? []
      : q
        ? available.filter(matches)
        : available.slice().sort((a, b) => a.name.localeCompare(b.name)).slice(0, 5);

    frame(`
      <div class="ws-head">
        <button type="button" class="ws-exit" id="qcExit" aria-label="Exit audit">←</button>
        <div class="ws-who">${esc(titleCase(nameOf(customer)))}</div>
        <div class="ws-count" id="qcProg">${esc(quickProgressText(s))}</div>
        <div class="ws-bar"><span style="width:${s.pct}%"></span></div>
      </div>

      <div class="sah-search-row">
        <div class="sah-search"><input type="search" id="qcQ" ${SEARCH_ATTRS} value="${esc(QC_STATE.q)}" placeholder="Search product name or SKU…"></div>
      </div>

      ${searching
        ? // Searching is picking, not counting: the results own the screen
          // while the box is in use, and the counting sheet comes back the
          // moment it's cleared (with nothing selected — see `previewing`).
          // Showing both stacked meant the rep scrolled past a list they
          // were done with to reach the one they were working in — and the
          // sheet they'd just added to sat below the fold, so the add
          // appeared to do nothing.
          `<div class="picker-list dropdown">${results.length
            ? results.map((p) => `
              <button type="button" class="picker-row" data-add="${esc(p.id)}">
                <span class="av">${thumbHTML(p)}</span>
                <span><span class="nm">${esc(p.name)}</span><div class="sub">SKU ${esc(p.artNo)}</div></span>
                <span class="add-ic" aria-hidden="true">+</span>
              </button>`).join("")
            : `<div class="dropdown-empty">No product matches that.</div>`}${previewing && available.length > results.length ? `<div class="suggest-hint">Showing ${results.length} of ${plural(available.length, "product")} — keep typing to search all</div>` : ""}</div>`
        : `<div class="section-head-row"><h2>Selected products</h2></div>
          ${s.total
            ? `<div class="qc-card">${s.selected.map((p) => quickRowHTML(p)).join("")}</div>`
            : `<div class="sah-empty"><div class="big">📋</div><p>No products selected.<br>Search above to add one.</p></div>`}`}
    `, { foot: `<div class="sah-foot ws-foot"><div class="inner" id="qcFoot">${quickFootHTML(customer)}</div></div>` });

    wireQuickCount(customer);
  }

  // The count lives IN the row, and the rows live in ONE card with a total on
  // the bottom line — Delivery Management's order card (.order-card /
  // .order-line.editing / .dm-stepper, styled here as .qc-card / .qc-line /
  // .pd-stepper inside .qc-row), which is the same job: a list of products,
  // one number each, entered standing up. The old "Count" button that opened a
  // per-product bottom sheet is gone; a sheet per product meant a modal
  // round-trip for a number the row had room for all along.
  //
  // No thumbnail, matching that reference. It cost more than it gave: at a
  // phone's width it squeezed the product name into "NATURAL WA…", and the
  // name plus SKU is what a rep matches against the shelf label anyway. The
  // search results above still carry photos — picking the right product from a
  // catalogue is the part where a picture helps.
  //
  // An untouched row's stepper is EMPTY, not 0. That preserves the distinction
  // the removed sheet spent a whole "Can't find this product" flow on: blank
  // means nobody verified this line, 0 means the rep looked and there were
  // none. Coverage still counts only the lines actually touched.
  // Removing is confirmed in the row itself, the same ✓ / ✗ the footer uses for
  // Finish — the × discards a count with no undo behind it, and it sits one
  // thumb-width from the stepper's +.
  //
  // Both states are in the markup from the start and CSS swaps them on
  // `.confirming` (see stock-audit.css), rather than a re-render or DOM
  // surgery on click. Asking and taking the question back are then pure class
  // toggles that touch neither the draft nor the DOM's shape, only confirming
  // re-renders, and any other re-render drops the question on its own without
  // a state flag to keep in sync. The warning clause hangs off `.done`, the
  // same class that tints a counted row, so the two can never disagree.
  function quickRowHTML(p) {
    const line = DRAFT.lines[p.id];
    const done = line && lineIsCaptured(line);
    const units = unitsFor(p);
    const unit = (line && line.countUnit) || baseUnit(p);
    const qty = done && line.status !== "not_found" ? line.countQty : "";
    // The equivalent in base units, shown only when the rep is counting in
    // something bigger and the multiplication is therefore doing real work.
    const per = unitFactor(p, unit);
    const equiv = done && per > 1 && Number(qty) > 0 ? ` · ${qtyText(linePhysical(line), baseUnit(p))}` : "";
    return `
      <div class="qc-line qc-row ${done ? "done" : ""}" data-row="${esc(p.id)}">
        <div class="info">
          <div class="nm">${esc(p.name)}</div>
          <div class="meta"><span class="sku" title="${esc(p.artNo)}">SKU ${esc(p.artNo)}</span> ·
            <span class="unit-pick">
              <span class="lbl" aria-hidden="true">${esc(unit)}</span><span class="chev" aria-hidden="true">▾</span>
              <select data-unit="${esc(p.id)}" aria-label="Counting unit for ${esc(p.name)}">
                ${units.map((u) => `<option value="${esc(u.label)}" ${u.label === unit ? "selected" : ""}>${esc(u.label)}${u.per > 1 ? ` (${u.per} ${esc(baseUnit(p))})` : ""}</option>`).join("")}
              </select>
            </span><span class="equiv">${esc(equiv)}</span>
          </div>
          <div class="meta ask">Remove from this audit?<span class="lost"> Its count will be cleared.</span></div>
        </div>
        ${stepperHTML(p.id, qty == null ? "" : qty)}
        <button type="button" class="qc-remove" data-remove="${esc(p.id)}" aria-label="Remove ${esc(p.name)}">×</button>
        <button type="button" class="ci-btn sm yes" data-remove-yes="${esc(p.id)}" aria-label="Confirm removing ${esc(p.name)}">✓</button>
        <button type="button" class="ci-btn sm no" data-remove-no="${esc(p.id)}" aria-label="Keep ${esc(p.name)}">✗</button>
      </div>`;
  }

  // The sticky footer, in its two states. Everything it reports is recomputed
  // from the draft on every call, so the confirmation can sit open while the
  // rep keeps counting behind it and still describe what they'd actually be
  // finishing.
  function quickFootHTML(customer) {
    if (!QC_CONFIRM) {
      return `<button type="button" class="btn-wide primary" id="qcFinish">Finish Audit</button>`;
    }
    const cov = auditCoverage(draftAsAudit(customer));
    const detail = cov.skipped
      ? `${cov.audited + cov.notFound} of ${cov.expected} counted — the ${plural(cov.skipped, "product")} left over will be recorded as partial coverage.`
      : `All ${plural(cov.expected, "product")} counted.`;
    return `<span class="confirm-inline">
        <span class="ci-copy">
          <span class="ci-prompt">Finish this audit?</span>
          <span class="ci-detail">${esc(detail)}</span>
        </span>
        <button type="button" class="ci-btn yes" id="qcYes" aria-label="Finish audit">✓</button>
        <button type="button" class="ci-btn no" id="qcNo" aria-label="Keep counting">✗</button>
      </span>`;
  }

  function wireQuickCount(customer) {
    wireSearchInput("qcQ", (v) => { QC_STATE.q = v; renderQuickCount(); }, () => {
      if (QC_STATE.focused) return false;
      QC_STATE.focused = true;
      renderQuickCount();
      return true;
    });
    PAGE.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => {
      const id = b.dataset.add;
      if (!DRAFT.selected.includes(id)) DRAFT.selected.push(id);
      QC_STATE.q = "";
      persistDraft();
      renderQuickCount();
    }));
    // Ask, undo the asking, and do it — the row swaps by class, so only the
    // last of the three touches the draft or re-renders anything. One row asks
    // at a time: opening a second question closes the first, which otherwise
    // leaves a list of pending removals nobody meant to queue up.
    PAGE.querySelectorAll("[data-remove]").forEach((b) => (b.onclick = () => {
      PAGE.querySelectorAll(".qc-row.confirming").forEach((r) => r.classList.remove("confirming"));
      b.closest(".qc-row").classList.add("confirming");
    }));
    PAGE.querySelectorAll("[data-remove-no]").forEach((b) => (b.onclick = () => {
      b.closest(".qc-row").classList.remove("confirming");
    }));
    PAGE.querySelectorAll("[data-remove-yes]").forEach((b) => (b.onclick = () => {
      const id = b.dataset.removeYes;
      DRAFT.selected = DRAFT.selected.filter((x) => x !== id);
      delete DRAFT.lines[id];
      persistDraft();
      renderQuickCount();
    }));
    wireQuickSteppers(customer);
    $("#qcExit", PAGE).onclick = () => exitAuditSheet(customer);
    wireQuickFoot(customer);
  }

  // In place, never a re-render: a full renderQuickCount() on every tap would
  // rebuild the input the rep is typing into and drop the caret. Same shape as
  // DM.onStep in Delivery Management — the row writes its own value, then the
  // header/progress/footer chrome is refreshed around it.
  function wireQuickSteppers(customer) {
    const hasShelf = locationHasShelf(customer, DRAFT.locationId);
    PAGE.querySelectorAll(".qc-row .pd-stepper").forEach((st) => {
      const p = productById(st.dataset.field);
      if (!p) return;
      const row = st.closest(".qc-row");
      const input = st.querySelector("input");
      const select = row.querySelector("[data-unit]");

      // Quantity writes straight into the "good" bucket — the only bucket this
      // flow exposes. Physical stock is that same number CONVERTED TO BASE
      // UNITS; there is no separate total to reconcile against once
      // condition/damage/expiry aren't fields here. (They stay real fields on
      // the model — see blankLine — with no UI in this flow to set them.)
      const write = (qty, unit) => {
        const line = ensureDraftLine(p, hasShelf);
        const physical = qty * unitFactor(p, unit);
        line.countQty = qty;
        line.countUnit = unit;
        line.physical = physical;
        line.conditionBreakdown.good = physical;
        line.status = "audited";
        line.notFoundReason = null;
        persistDraft();
        row.classList.add("done");
        showEquiv(p, line, row);
        refreshQuickChrome(customer);
      };
      const set = (v) => {
        const qty = Math.max(0, Math.floor(Number(v) || 0));
        input.value = qty;
        write(qty, select ? select.value : baseUnit(p));
      };

      st.querySelectorAll("[data-delta]").forEach((b) => (b.onclick = () => set((Number(input.value) || 0) + Number(b.dataset.delta))));
      input.oninput = () => set(input.value);

      // Switching the unit keeps the quantity the rep entered and re-reads what
      // it means: three of something bigger. Re-counting from scratch because
      // they picked the wrong pack size is exactly the busywork this avoids.
      // On an untouched row it only records the choice — no count is invented.
      if (select) select.onchange = () => {
        const lbl = row.querySelector(".unit-pick .lbl");
        if (lbl) lbl.textContent = select.value;
        const line = DRAFT.lines[p.id];
        if (line && lineIsCaptured(line)) { write(Number(input.value) || 0, select.value); return; }
        ensureDraftLine(p, hasShelf).countUnit = select.value;
        showEquiv(p, DRAFT.lines[p.id], row);
      };
    });
  }

  // The "· 36 Pc" tail on a row counted in something bigger. Kept in step by
  // hand rather than by re-rendering the row, for the same reason the stepper
  // is: the input the rep is typing into must survive.
  function showEquiv(p, line, row) {
    const el = row.querySelector(".equiv");
    if (!el) return;
    const captured = line && lineIsCaptured(line);
    const per = unitFactor(p, (line && line.countUnit) || baseUnit(p));
    el.textContent = captured && per > 1 && linePhysical(line) > 0
      ? ` · ${qtyText(linePhysical(line), baseUnit(p))}`
      : "";
  }

  function refreshQuickChrome(customer) {
    const s = quickStats();
    const prog = $("#qcProg", PAGE);
    if (prog) prog.textContent = quickProgressText(s);
    const bar = PAGE.querySelector(".ws-bar > span");
    if (bar) bar.style.width = s.pct + "%";
    const foot = $("#qcFoot", PAGE);
    if (foot) { foot.innerHTML = quickFootHTML(customer); wireQuickFoot(customer); }
  }

  // Finish is a two-tap decision made in place: the footer becomes the
  // question. See quickFootHTML for why it isn't a sheet.
  function wireQuickFoot(customer) {
    const finish = $("#qcFinish", PAGE);
    if (finish) finish.onclick = () => {
      // Nothing counted — whether nothing was ever selected or a handful of
      // products sit unselected/uncounted — is nothing to finish. That's an
      // exit, not a completion, so it gets the same "Leave this audit?"
      // sheet the ← button uses (and the same honest Abandoned outcome)
      // instead of an inline confirm that could only dead-end in "count
      // something first."
      if (quickStats().captured === 0) { exitAuditSheet(customer); return; }
      QC_CONFIRM = true;
      refreshQuickChrome(customer);
    };
    const no = $("#qcNo", PAGE);
    if (no) no.onclick = () => { QC_CONFIRM = false; refreshQuickChrome(customer); };
    const yes = $("#qcYes", PAGE);
    if (yes) yes.onclick = () => {
      if (!DRAFT) return;
      if (auditCoverage(draftAsAudit(customer)).skipped) DRAFT.partial = { isPartial: true, reason: null, note: "" };
      QC_CONFIRM = false;
      completeAudit(customer);
    };
  }

  /* =============================================================================================
     REMOVED (vNext hard reset): the old full-catalogue Workspace
     (WS_STATE, productPriority, wsAttentionFor, renderWorkspace, wsRowHTML,
     wireWorkspace, nextUncaptured) and the original,
     four-condition-stepper-by-default Product Count Sheet (openProductSheet,
     closeProductSheet, renderProductSheet, wireProductSheet, PD_SHEET,
     PD_ADVANCED, advancedDetailsHTML, expiryEntry, advance, DISPOSITIONS,
     DAMAGE_TYPES). Both were the comprehensive-audit journey the stakeholder
     flow replaces outright — not reachable from anywhere in this file
     anymore. wsProgress stayed (exitAuditSheet still reads it), as did
     stepperHTML/ensureDraftLine/CONDITION_KEYS. evidenceHTML/
     saveBlockers did NOT stay a second time — see the Layer-2/3 removal
     note just below. (STORAGE_KEYS/SHELF_AVAILABILITY did stay at that
     point, for Audit Detail's benefit — a later Layer 2/3 pass over Audit
     History/Audit Detail removed their one remaining reader and took them
     with it; see the removal note above productsCheckedSectionHTML.)

     REMOVED (inline pass), one layer further: Quick Count's OWN per-product
     bottom sheet — QC_SHEET, openQuickCountSheet, closeQuickCountSheet,
     renderQuickCountSheet, wireQuickCountSheet, quickAdvance (Save & Next /
     Skip auto-advance), nextUncapturedInSelection, and notFoundSheet with its
     NOT_FOUND_REASONS. The count is a stepper in the row now (quickRowHTML),
     so there is no sheet to advance through, nothing to skip, and no separate
     screen on which "Can't find this product" was a distinct affordance — a
     row left blank says exactly that. `status: "not_found"` and
     `notFoundReason` stay on the model and are still rendered wherever an
     existing record carries them (productsCheckedSectionHTML, auditCoverage,
     followUpLines, suggestedOutcome); this flow just no longer writes them.
     ================================================================================================= */

  // Read by exitAuditSheet — the scope is the whole catalogue for a full audit,
  // unchanged, or the rep's own selection for a Quick Audit. Byte-identical to
  // the pre-vNext behavior whenever DRAFT.mode === "full". (quickStats is the
  // same shape for the live count screen; this one survives because it also
  // handles the historical "full" scope, which quickStats deliberately doesn't.)
  function wsProgress() {
    const scope = DRAFT.mode === "full" ? products : DRAFT.selected.map(productById).filter(Boolean);
    const captured = scope.filter((p) => DRAFT.lines[p.id] && lineIsCaptured(DRAFT.lines[p.id])).length;
    return { captured, total: scope.length, pct: scope.length ? Math.round((captured / scope.length) * 100) : 0 };
  }


  // total===0 only happens in Quick Audit before any product is selected —
  // "0 of 0 products counted" reads as broken, not as "nothing to leave
  // behind yet", so it gets its own copy rather than falling through to the
  // generic X-of-Y line (flagged explicitly in the UX audit as a bad pattern
  // to avoid, see quickProgressText for the sibling fix).
  function progressSummaryText(prog) {
    if (!prog.total) return "You haven't selected any products yet.";
    if (!prog.captured) return "No products counted yet.";
    return `${prog.captured} of ${prog.total} products counted so far.`;
  }

  // "Pause — keep my progress" used to lead this list. It doesn't anymore:
  // every visit now starts fresh (see startAuditFor), so there is no resume
  // to pause into and offering one would promise a return that never comes.
  // Ending a visit from here IS discarding it, full stop — no "abandoned"
  // record gets written behind the rep's back, and no toast claims a visit
  // was "recorded" when nothing was. That also makes the sub line above
  // literally true instead of a hedge: leaving without finishing really
  // does not keep it.
  function exitAuditSheet(customer) {
    const prog = wsProgress();
    sheet({
      eyebrow: placeLine(customer, DRAFT.locationId),
      title: "Leave this audit?",
      sub: progressSummaryText(prog) + " Leaving without finishing does not keep it.",
      actions: [
        { label: "Keep counting", cls: "primary" },
        { label: "End this visit", cls: "danger", onClick: () => {
          DraftStore.clear(customer._id);
          DRAFT = null;
          toast("Audit discarded.");
          go("quick-pick", {}, true);
        } },
      ],
    });
  }

  /* =============================================================================================
     REMOVED (vNext hard reset): the original Product Count Sheet
     (PD_ADVANCED, PD_SHEET, openProductSheet, closeProductSheet,
     renderProductSheet, wireProductSheet, advancedDetailsHTML, expiryEntry,
     advance) — four condition-bucket steppers up front by default, the
     density the locked interaction decision explicitly moved away from. Its
     replacement, Quick Count's own one-field sheet, is gone too (see the
     inline-pass note above wsProgress); the row's own stepper is what a rep
     uses now, built on the same stepperHTML/ensureDraftLine primitives below.
     ================================================================================================= */

  /* =============================================================================================
     REMOVED (Layer 2/3 UX pass): evidenceHTML and saveBlockers — the
     "Condition, shelf & notes" fold Quick Count's sheet used to open into
     (condition-bucket steppers, photo evidence, shelf availability, notes),
     plus the photo-required-if-damaged/expired gate on Save. None of that
     is required to physically count stock, so the stakeholder flow no longer
     renders it — at that point Quantity and "Can't find this product" were
     the whole form, and after the inline pass the quantity is the whole
     form (quickRowHTML's own stepper). The DATA these
     fields fed (conditionBreakdown, evidence[], shelfAvailability, notes)
     is untouched: still real fields on a line, computed into the scoring
     engine same as always. (At the time of this comment they were also
     still read by Audit Detail's own per-line replay sheet — a later
     Layer 2/3 pass removed that reader too, along with the display-only
     constants that had no other caller left; see the removal note above
     productsCheckedSectionHTML.) Only the two UI-rendering functions with
     no remaining caller were removed here, not the model.
     ================================================================================================= */

  function stepperHTML(key, value) {
    return `<span class="pd-stepper" data-field="${esc(key)}">
      <button type="button" data-delta="-1">−</button>
      <input type="text" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" size="3" value="${value === "" || value == null ? "" : value}" placeholder="0">
      <button type="button" data-delta="1">+</button>
    </span>`;
  }

  function ensureDraftLine(p, hasShelf) {
    if (!DRAFT.lines[p.id]) {
      const line = blankLine(p.id, p.systemStock);
      // Sensible defaults for the ordinary case, so a healthy product needs
      // no answers beyond the count itself.
      if (hasShelf) line.shelfAvailability = "available";
      DRAFT.lines[p.id] = line;
    }
    return DRAFT.lines[p.id];
  }

  /* ------------------------------------------------------ finish helpers */

  // A snapshot of the draft in the shape everything else already reads, so
  // the finish sheet and the completed record can't compute the same
  // numbers two different ways. Lines are copied, not aliased — finishing
  // must not edit what the rep captured.
  function draftAsAudit(customer) {
    return normalizeAudit({
      id: "draft-" + customer._id,
      at: DRAFT.at ? new Date(DRAFT.at).toISOString() : new Date().toISOString(),
      status: "review",
      auditor: DRAFT.auditor || AUDITOR.name,
      purpose: DRAFT.purpose,
      locationId: DRAFT.locationId,
      expectedProducts: expectedProductsFor(DRAFT),
      notes: DRAFT.notes,
      lines: Object.keys(DRAFT.lines).map((id) => clone(DRAFT.lines[id])).filter(lineIsCaptured),
    }, customer._id);
  }

  // The coverage denominator. A full audit's scope is the whole catalogue —
  // unchanged. A Quick Audit's scope is exactly what the rep chose to check
  // (DRAFT.selected), never the catalogue it was drawn from — "3 selected, 3
  // counted" must read as a complete audit, not a 3-of-12 partial one.
  function expectedProductsFor(draft) {
    return draft.mode === "full" ? products.length : (draft.selected || []).length;
  }

  // Lines the rep still owes someone an action on after they leave. Feeds
  // suggestedOutcome below; the per-product detail lives in Recommended
  // Actions on the audit's own page, not repeated here.
  function followUpLines(a) {
    return auditLines(a).filter((l) =>
      l.status === "not_found" ||
      (l.conditionBreakdown.expired || 0) > 0 ||
      (l.conditionBreakdown.damaged || 0) > 0 ||
      isStockOutRisk(l));
  }

  // How this visit ended, in the distributor's terms rather than the shelf's.
  // Still a real field on the saved record — just inferred by the system
  // (suggestedOutcome) instead of asked for, since making the rep classify
  // the visit from a blank slate is work the count already answered.
  const OUTCOMES = [
    { k: "healthy", label: "Healthy", icon: "✅", sub: "Nothing needed here" },
    { k: "replenish", label: "Needs replenishment", icon: "📦", sub: "Stock is running out" },
    { k: "pull", label: "Stock pull required", icon: "🧹", sub: "Expired or damaged stock to remove" },
    { k: "followup", label: "Needs follow-up", icon: "🚩", sub: "Something to come back for" },
    { k: "investigate", label: "Further investigation", icon: "🔍", sub: "The numbers don't add up" },
  ];
  const outcomeMeta = (k) => OUTCOMES.find((o) => o.k === k) || { label: "—", icon: "•", sub: "" };

  function suggestedOutcome(a) {
    const totals = conditionTotals(a);
    if (stockOutLines(a).length) return "replenish";
    if (totals.expired > 0 || totals.damaged > 0) return "pull";
    if (auditLines(a).some((l) => l.status === "not_found") || followUpLines(a).length) return "followup";
    const audited = auditLines(a).filter((l) => l.status === "audited");
    if (audited.length && varianceLines(a).length > audited.length / 2) return "investigate";
    return "healthy";
  }

  /* =============================================================================================
     REMOVED (inline pass): finishAuditSheet — the "Finish Audit / 1 / 4
     products counted / Continue Counting / Finish Anyway" bottom sheet. Asking
     "is this actually done?" meant covering the very list that answers it, so
     the question moved into the sticky footer the rep already had their thumb
     on: the Finish button becomes an inline ✓ / ✗ confirmation naming the
     coverage, the same pattern Production's recipe page uses to confirm a
     publish. Its logic is unchanged and now lives in quickFootHTML (the copy,
     including the partial-coverage warning) and wireQuickFoot (the partial
     flag, then completeAudit).
     ================================================================================================= */

  /* ------------------------------------------------------- complete audit */

  function completeAudit(customer) {
    if (!DRAFT) return;
    // The draft already holds observations — the product sheet writes them
    // straight in. Only lines the rep actually reached get recorded; an
    // untouched product is absent from the audit, not a zero count in it.
    const lines = Object.keys(DRAFT.lines)
      .map((id) => DRAFT.lines[id])
      .filter(lineIsCaptured);
    if (!lines.length) { toast("Count at least one product first.", "info"); return; }

    const stamp = new Date().toISOString();
    const outcome = DRAFT.outcome || suggestedOutcome(draftAsAudit(customer));
    const audit = normalizeAudit({
      id: "aud-" + customer._id + "-" + Date.now().toString(36),
      at: DRAFT.at ? new Date(DRAFT.at).toISOString() : stamp,
      status: "completed",
      createdAt: DRAFT.createdAt || stamp,
      startedAt: DRAFT.startedAt || stamp,
      completedAt: stamp,
      auditor: DRAFT.auditor || AUDITOR.name,
      actors: { createdBy: AUDITOR.name, startedBy: AUDITOR.name, lastEditedBy: AUDITOR.name, completedBy: AUDITOR.name },
      purpose: DRAFT.purpose,
      locationId: DRAFT.locationId,
      mode: DRAFT.mode,
      // Snapshot the denominator, so a later catalogue change can't move the
      // coverage of a visit that is already closed. For a Quick Audit that's
      // the selection size, not the catalogue — see expectedProductsFor.
      expectedProducts: expectedProductsFor(DRAFT),
      notes: (DRAFT.notes || "").trim(),
      outcome,
      finalNote: (DRAFT.finalNote || "").trim(),
      partial: DRAFT.partial || { isPartial: false, reason: null, note: "" },
      lines,
      followUp: { required: false, note: "", at: "" },
    }, customer._id);
    AuditStore.list(customer._id).unshift(audit);
    AuditStore.save();
    DraftStore.clear(customer._id);
    DRAFT = null;
    // vNext: the stakeholder flow's originating context is Stock Audit's own
    // customer search, not Customer Detail (removed from this journey
    // entirely — see the removed-view block near the end of this file), so
    // finishing lands the rep on a fresh search, ready for the next visit and
    // never on a stale Workspace with a cleared draft under it.
    //
    // The confirmation is a toast, not a sheet: the audit is already saved by
    // the time this runs, so there is no decision left to take and nothing to
    // block the screen for. It's the long one (see longToast) — this is the
    // end of the whole journey, not a passing acknowledgement.
    go("quick-pick", {}, true);
    longToast(`Audit saved — ${plural(auditLines(audit).length, "product")} checked.`);
  }

  /* =============================================================================================
     REMOVED (inline pass): finishedSheet — the "✓ Audit completed / N products
     checked / Done" bottom sheet. Layer-1's journey (FIND → PICK → COUNT →
     FINISH → LEAVE) already ended with nothing left to decide, which is
     precisely why it didn't need a sheet: the audit is saved before it would
     have opened, so its only job was to say so and be dismissed. completeAudit
     says it in a toast now and leaves the screen alone.

     Duplicate completion is unaffected — that was never this sheet's doing.
     completeAudit's own `if (!DRAFT) return` is the whole guard: DRAFT is
     nulled before anything else can fire, so a stray second tap on ✓ is a
     no-op.

     Its "Return to Route" action is gone with it, and so is the inline strip
     that briefly replaced it (.qp-return / RETURN_TO_ROUTE). Entry Point B —
     a tab Delivery Management opened for this one audit (window.open across
     modules; see stop-detail.js's openStockAuditLink) — now ends the same way
     every other entry does: the toast, then a fresh picker. Nothing in this
     module closes that tab anymore; the rep does, the way they close any tab.
     ================================================================================================= */

  /* =============================================================================================
     REMOVED (Layer 2/3 UX pass): axisCls/healthAxesHTML — the Stock/Shelf/
     Expiry/Ordering four-bar breakdown, only ever rendered by Audit
     Detail's own "Health Breakdown" section (also removed). HEALTH_AXES
     itself stayed: scoreFromAudit still weights across it to produce the
     overall score, which is still computed and stored on every completed
     audit even though nothing currently displays it.
     ================================================================================================= */

  // What to actually do next, in severity order, with the products named.
  // The count is the input; this is the point of having taken it.
  function recommendedActions(a) {
    const acts = [];
    const oos = stockOutLines(a).map((l) => productName(l.productId));
    const expiring = auditLines(a).filter((l) => (l.conditionBreakdown.expired || 0) + (l.conditionBreakdown.nearExpiry || 0) > 0).map((l) => productName(l.productId));
    const damaged = auditLines(a).filter((l) => (l.conditionBreakdown.damaged || 0) > 0).map((l) => productName(l.productId));
    const notFound = auditLines(a).filter((l) => l.status === "not_found").map((l) => productName(l.productId));
    const over = auditLines(a).filter(isOverstock).map((l) => productName(l.productId));

    if (oos.length) acts.push({ sev: "high", ic: "📦", title: "Replenish", text: plural(oos.length, "product") + " below expected stock — " + oos.join(", "), replenish: true });
    if (expiring.length) acts.push({ sev: "mid", ic: "🧹", title: "Pull / rotate", text: plural(expiring.length, "product") + " approaching or past expiry — " + expiring.join(", "), pull: true });
    if (damaged.length) acts.push({ sev: "mid", ic: "⚠️", title: "Raise damage claim", text: damaged.join(", ") });
    if (notFound.length) acts.push({ sev: "mid", ic: "❓", title: "Verify next visit", text: plural(notFound.length, "product") + " couldn't be checked — " + notFound.join(", ") });
    if (over.length) acts.push({ sev: "low", ic: "📉", title: "Slow-moving / overstock", text: over.join(", ") + " — consider a push offer" });

    if (a.followUp && a.followUp.required) acts.push({ sev: "mid", ic: "🚩", title: "Follow-up scheduled", text: a.followUp.note || "Return visit flagged", done: true });
    else if (flaggedLines(a).length) acts.push({ sev: "low", ic: "🚩", title: "Consider a follow-up visit", text: "This audit found flagged items.", flag: a.id });

    if (a.partial && a.partial.isPartial) {
      const why = (PARTIAL_REASONS.find((r) => r.k === a.partial.reason) || { label: "reason not given" }).label;
      acts.push({ sev: "low", ic: "🕓", title: "Finish the coverage", text: `Only part of the assortment was checked — ${why.toLowerCase()}.` });
    }
    if (!acts.length) acts.push({ sev: "none", ic: "✅", title: "All clear", text: "No issues found — the shelf looked healthy." });
    return acts;
  }

  /* ============================================================ Entry Point A: WhatsApp (mocked) */

  // A mocked integration boundary (this repo has no backend and no real
  // WhatsApp Business API access — every "send" in this module is mocked,
  // e.g. Retail Customers' own "Send via WhatsApp" button). .build()'s URL
  // contract is real, though: whatever later replaces .send()'s internals
  // with a genuine API call needs no change anywhere else, because mount()'s
  // ?entry=quick handling below only ever consumes this same URL shape,
  // whether it arrived by a real message or by hand.
  const WhatsAppLink = {
    build(customer) {
      const base = location.origin + location.pathname;
      const params = new URLSearchParams({ entry: "quick", customer: customer._id, source: "whatsapp" });
      return base + "?" + params.toString();
    },
    send(customer) {
      const url = this.build(customer);
      const name = titleCase(nameOf(customer)) || customer.phone;
      sheet({
        eyebrow: name,
        title: "Send Quick Audit Link",
        sub: `A WhatsApp message with a link straight into ${esc(name)}'s Quick Audit — no menu, no sign-in, just the count.`,
        body: `<div class="sheet-form"><label>Link<input type="text" id="waLink" readonly value="${esc(url)}"></label></div>`,
        actions: [
          { label: "Cancel", cls: "ghost" },
          {
            label: "Copy Link",
            cls: "ghost",
            onClick: () => {
              if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
              toast("Link copied.");
              return false; // stay open — Send is still a live option
            },
          },
          { label: "Send via WhatsApp", cls: "primary", onClick: () => toast(`Quick Audit link sent to ${name} via WhatsApp!`) },
        ],
      });
    },
  };

  /* =============================================================================================
     PREDICTIVE SALES ORDER (vNext) — the second journey.

         Create Order → Select Customer → Predictive Sales Order
                      → Review Order → Confirm → FoodBridge order → Zoho

     Deliberately a PEER of the audit flow, not a step inside it. Stock Audit
     records what is on the shelf; this proposes what should ship. Keeping
     them separate is what lets a rep audit today and order on Thursday, and
     is why finishing an audit never launches this — the rep decides.

     They meet through DATA only: `latestCompletedAuditFor` supplies current
     stock, `SEED.orderingSignals` supplies demand, and the confirmed order
     keeps `predictionContext` so the recommendation can be traced back to
     the exact audit and orders it was drawn from.

     Nothing here re-implements what the audit flow already has: the same
     customer/product search shape and `wireSearchInput` focus contract, the
     same `.picker-list.dropdown`, `.qc-card`/`.qc-line` rows, `stepperHTML`,
     `.sah-foot` action bar, sheets and toasts.
     ================================================================================================= */

  // The order being built. Null unless a customer has been picked — the same
  // "one live thing at a time" contract DRAFT holds for audits, and what the
  // Create Order tab reads to decide between resuming and starting fresh.
  let ORDER = null;
  let OP_STATE = { q: "", focused: false };   // Create Order → customer search
  // `adding` is set only by the "+ Add Product" button — an explicit ask to
  // add, which opens the dropdown even when a list is already on screen.
  // Incidental focus on the box does not (see `previewing` in
  // renderOrderBuild): that would bury the rep's own list under an
  // unrelated suggestion set every time they tapped near the top.
  let OB_STATE = { q: "", focused: false, adding: false };   // Predictive order → add-product search
  // Whether the sticky footer is asking "Confirm order?" rather than showing
  // the button. Exactly QC_CONFIRM's role on the counting screen, and reset
  // by any re-render for the same reason: a question raised against a scope
  // the rep has since changed must not survive the change.
  let OB_CONFIRM = false;
  // Set while the recommendation is being generated, so the view can render
  // the analysing state instead of an empty table.
  let ORDER_LOADING = false;

  /* ---- building the order from a recommendation ------------------------- */

  // Turn the engine's output into the editable order the rep works on. The
  // recommended quantity is COPIED into `qty` rather than referenced: `qty`
  // is the rep's number from this point on, and `recommendedQty` stays
  // untouched beside it so the review screen (and later, analytics) can see
  // what the system proposed versus what was actually ordered.
  function orderLineFromPrediction(l) {
    const p = productById(l.productId) || {};
    return {
      productId: l.productId,
      productName: p.name || l.productId,
      artNo: p.artNo || "",
      unit: baseUnit(p),
      currentStock: l.currentStock,
      hasStock: l.hasStock,
      expectedDemand: l.expectedDemand,
      recommendedQty: l.recommendedQty,
      qty: l.recommendedQty,
      basis: l.basis,
      addedManually: false,
    };
  }

  // A product the rep added themselves. No demand figure is invented for it —
  // it starts at zero and is theirs to set.
  function orderLineFromProduct(p, currentStock) {
    return {
      productId: p.id,
      productName: p.name,
      artNo: p.artNo || "",
      unit: baseUnit(p),
      currentStock: currentStock == null ? 0 : currentStock,
      hasStock: currentStock != null,
      expectedDemand: null,
      recommendedQty: null,
      qty: 0,
      basis: "manual",
      addedManually: true,
    };
  }

  // Current stock per product from a completed audit, for lines the rep adds
  // by hand — so an added product still shows what the shop was holding.
  function stockMapFromAudit(audit) {
    const m = {};
    auditLines(audit || {}).forEach((l) => {
      if (l && l.productId && l.status !== "not_found") m[l.productId] = Number(l.physical) || 0;
    });
    return m;
  }

  // Kick off a prediction for a customer and land on the build screen.
  // Async only so the analysing state is actually visible — the engine is
  // synchronous and deterministic, which is exactly what we want of it.
  function startOrderFor(customerId) {
    const customer = loadCustomer(customerId);
    if (!customer) { go("order-pick", {}, true); return; }

    ORDER_LOADING = true;
    ORDER = { customerId, lines: [], prediction: null, stockMap: {}, error: null };
    go("order-build", { customerId });

    setTimeout(() => {
      // The customer may have been abandoned mid-generation (tab switch,
      // Back) — don't write a result onto an order that is no longer this
      // one, and don't re-render a screen the rep has left.
      if (!ORDER || ORDER.customerId !== customerId) return;
      try {
        const audit = latestCompletedAuditFor(customerId);
        const sig = (SEED.orderingSignals && SEED.orderingSignals[customerId]) || null;
        const result = FB_PREDICT.generatePredictiveOrder({
          customerId,
          latestCompletedAudit: audit,
          orders: (sig && sig.orders) || [],
          products,
          now: new Date(),
        });
        ORDER.prediction = result;
        ORDER.stockMap = stockMapFromAudit(audit);
        ORDER.lines = result.ok ? result.lines.map(orderLineFromPrediction) : [];
      } catch (e) {
        // A prediction that throws must not take the screen down with it —
        // the rep can still build the order by hand.
        ORDER.error = e;
        ORDER.prediction = null;
        ORDER.lines = [];
      }
      ORDER_LOADING = false;
      if (CURRENT.view === "order-build") renderOrderBuild();
    }, 650);
  }

  const orderTotals = (lines) => {
    const active = (lines || []).filter((l) => Number(l.qty) > 0);
    return {
      active,
      products: active.length,
      units: active.reduce((n, l) => n + (Number(l.qty) || 0), 0),
    };
  };

  /* ---- VIEW: order-pick — which customer is this order for? -------------- */

  // Intentionally the same screen as quick-pick in everything but its title
  // and where a tap leads: same search contract, same dropdown, same rows.
  // A rep should not have to learn a second way to find a customer.
  function renderOrderPick() {
    const q = OP_STATE.q.trim().toLowerCase();
    const allCustomers = loadCustomers();
    const active = OP_STATE.focused;
    const previewing = active && !q;
    const rows = !active
      ? []
      : q
        ? allCustomers.filter((c) => [nameOf(c), c.phone].some((v) => String(v || "").toLowerCase().includes(q)))
        : allCustomers.slice().sort((a, b) => nameOf(a).localeCompare(nameOf(b))).slice(0, 5);

    frame(`
      <div class="sah-page-head">
        <h1>Create Order</h1><p>Who is this order for?</p>
      </div>
      <div class="sah-search-row"><div class="sah-search"><input type="search" id="opQ" ${SEARCH_ATTRS} value="${esc(OP_STATE.q)}" placeholder="Search customers…"></div></div>
      ${!active
        ? `<div class="sah-empty"><div class="big">🛒</div><p>Search for the customer you're ordering for.</p></div>`
        : `<div class="picker-list dropdown">${rows.length
            ? rows.map((c) => `
              <button type="button" class="picker-row" data-order-pick="${c._id}">
                <span class="av">${esc(titleCase(nameOf(c)).charAt(0) || "C")}</span>
                <span><span class="nm">${esc(titleCase(nameOf(c)))}</span><div class="sub">${esc(addressLine(c.adress1, c.state?.name, c.postnr))}</div></span>
              </button>`).join("")
            : `<div class="dropdown-empty">No customers found.</div>`}${previewing && allCustomers.length > rows.length ? `<div class="suggest-hint">Showing ${rows.length} of ${plural(allCustomers.length, "customer")} — keep typing to search all</div>` : ""}</div>`}
    `);

    wireSearchInput("opQ", (v) => { OP_STATE.q = v; renderOrderPick(); }, () => {
      if (OP_STATE.focused) return false;
      OP_STATE.focused = true;
      renderOrderPick();
      return true;
    });
    PAGE.querySelectorAll("[data-order-pick]").forEach((b) => (b.onclick = () => {
      OP_STATE = { q: "", focused: false };
      OB_STATE = { q: "", focused: false, adding: false };
      startOrderFor(b.dataset.orderPick);
    }));
  }

  /* ---- VIEW: order-build — the editable recommendation ------------------- */

  // Provenance, as one line. A rep needs to know the numbers came from the
  // shop's own stock and buying history — not the audit date, the order
  // counts, or which window each came from. That detail is real, so it is
  // kept one tap away in a sheet rather than deleted; it just has no claim
  // on the screen a rep is trying to order from.
  // Two words, riding on the "Recommended" heading's own row — the heading
  // already says these are recommendations, so this only has to say what
  // they came from.
  const basisLabel = (ctx) =>
    ctx.usedStockAudit ? "Stock + history" : "History only";

  function predictionBasisHTML(ctx) {
    return `<button type="button" class="ord-basis" id="obBasis">
        <span>${esc(basisLabel(ctx))}</span><span class="i" aria-hidden="true">i</span>
      </button>`;
  }

  // The detail, on demand. Same sheet primitive every other explanation in
  // this module uses.
  function basisSheet(ctx) {
    const row = (on, label, detail) =>
      `<div class="rv-line ${on ? "ok" : "muted"}">
        <span class="ic">${on ? "✓" : "—"}</span>
        <span class="txt">${esc(label)}${detail ? `<span class="pb-detail"> · ${esc(detail)}</span>` : ""}</span>
      </div>`;
    sheet({
      title: "How this was calculated",
      body: `<div class="pb-detail-list">
        ${row(ctx.usedStockAudit, "Stock audit",
              ctx.usedStockAudit ? `${fmtDateShort(ctx.auditAt)} · ${plural(ctx.auditProductCount, "product")}` : "none")}
        ${row(ctx.usedSamePeriodLastYear, "Same period last year",
              ctx.usedSamePeriodLastYear ? plural(ctx.samePeriodOrderCount, "order") : "none")}
        ${row(ctx.usedRecentHistory, "Recent orders",
              ctx.usedRecentHistory ? plural(ctx.recentOrderCount, "order") : "none")}
      </div>`,
      actions: [{ label: "Close", cls: "primary" }],
    });
  }

  // One editable line: product, SKU, what the shop is holding, and the
  // quantity control. The stepper's own value IS the recommendation — the
  // section heading says so once, so the row does not repeat it, and the
  // figures behind it (expected demand, what was recommended before the rep
  // touched it) stay on the record without being on the screen.
  function orderRowHTML(l) {
    const stockText = `Stock ${l.hasStock ? l.currentStock : "—"} · ${l.unit}`;
    return `
      <div class="qc-line qc-row ord-row ${Number(l.qty) > 0 ? "done" : ""}" data-order-row="${esc(l.productId)}">
        <div class="info">
          <div class="nm">${esc(l.productName)}</div>
          <div class="meta">
            <span class="sku" title="${esc(l.artNo)}">${l.artNo ? "SKU " + esc(l.artNo) : "&nbsp;"}</span>
          </div>
          <div class="meta ord-stock">${esc(stockText)}</div>
          <div class="meta ask">Remove from this order?</div>
        </div>
        ${stepperHTML(l.productId, l.qty == null ? "" : l.qty)}
        <button type="button" class="qc-remove" data-order-remove="${esc(l.productId)}" aria-label="Remove ${esc(l.productName)}">×</button>
        <button type="button" class="ci-btn sm yes" data-order-remove-yes="${esc(l.productId)}" aria-label="Confirm removing ${esc(l.productName)}">✓</button>
        <button type="button" class="ci-btn sm no" data-order-remove-no="${esc(l.productId)}" aria-label="Keep ${esc(l.productName)}">✗</button>
      </div>`;
  }

  // Nothing to recommend, said once. WHY there is nothing — no orders on
  // file, no audit, a read that threw — is a fact about our data, not a
  // decision the rep can act on; the action they can take (+ Add Product,
  // right below) is the same either way.
  function orderEmptyStateHTML() {
    if (ORDER.error) return `<div class="ord-note">Couldn't generate a recommendation</div>`;
    const pred = ORDER.prediction;
    if (pred && !pred.ok) return `<div class="ord-note">No recommendation</div>`;
    return `<div class="ord-note">No products yet</div>`;
  }

  function renderOrderBuild() {
    const customer = loadCustomer(CURRENT.params.customerId);
    if (!customer || !ORDER) { go("order-pick", {}, true); return; }
    OB_CONFIRM = false;

    // Working. The bar and the one line are the whole message — a checklist
    // of what is being consulted is a progress report nobody asked for.
    if (ORDER_LOADING) {
      frame(`
        <div class="ws-head">
          <button type="button" class="ws-exit" id="obBack" aria-label="Back">←</button>
          <div class="ws-who">${esc(titleCase(nameOf(customer)))}</div>
          <div class="ws-count">Preparing order…</div>
          <div class="ws-bar indeterminate"><span></span></div>
        </div>
      `);
      const b = $("#obBack", PAGE);
      if (b) b.onclick = () => { ORDER = null; ORDER_LOADING = false; go("order-pick", {}, true); };
      return;
    }

    const q = OB_STATE.q.trim().toLowerCase();
    const matches = (p) => [p.name, p.artNo, p.category, p.subCategory].join(" ").toLowerCase().includes(q);
    const chosen = ORDER.lines.map((l) => l.productId);
    const available = products.filter((p) => chosen.indexOf(p.id) === -1);
    // Two ways to an empty-query dropdown: the rep asked for one ("+ Add
    // Product"), or there is no list yet for it to bury.
    const previewing = !q && (OB_STATE.adding || (OB_STATE.focused && !ORDER.lines.length));
    const searching = !!q || previewing;
    const results = !searching
      ? []
      : q
        ? available.filter(matches)
        : available.slice().sort((a, b) => a.name.localeCompare(b.name)).slice(0, 5);

    const t = orderTotals(ORDER.lines);
    const ctx = ORDER.prediction && ORDER.prediction.context;
    // The basis line and the "Recommended" heading only earn their place if
    // something was actually recommended — on a hand-built order they would
    // be labelling the rep's own work as the system's.
    const recommended = !!(ORDER.prediction && ORDER.prediction.ok && ctx);

    frame(`
      <div class="ws-head">
        <button type="button" class="ws-exit" id="obBack" aria-label="Back">←</button>
        <div class="ws-who">${esc(titleCase(nameOf(customer)))}</div>
        <div class="ws-count">${t.products ? `${plural(t.products, "product")} · ${plural(t.units, "unit")}` : "Nothing to order yet"}</div>
        <div class="ws-bar"><span style="width:${ORDER.lines.length ? Math.round((t.products / ORDER.lines.length) * 100) : 0}%"></span></div>
      </div>

      <div class="sah-search-row">
        <div class="sah-search"><input type="search" id="obQ" ${SEARCH_ATTRS} value="${esc(OB_STATE.q)}" placeholder="Search product name or SKU…"></div>
      </div>

      ${searching
        ? `<div class="picker-list dropdown">${results.length
            ? results.map((p) => `
              <button type="button" class="picker-row" data-order-add="${esc(p.id)}">
                <span class="av">${thumbHTML(p)}</span>
                <span><span class="nm">${esc(p.name)}</span><div class="sub">SKU ${esc(p.artNo)}</div></span>
                <span class="add-ic" aria-hidden="true">+</span>
              </button>`).join("")
            : `<div class="dropdown-empty">No product matches that.</div>`}${previewing && available.length > results.length ? `<div class="suggest-hint">Showing ${results.length} of ${plural(available.length, "product")} — keep typing to search all</div>` : ""}</div>`
        : `${ORDER.lines.length ? `<div class="section-head-row"><h2>${recommended ? "Recommended" : "Products"}</h2>${recommended ? predictionBasisHTML(ctx) : ""}</div>` : ""}
           ${ORDER.lines.length
              ? `<div class="qc-card">${ORDER.lines.map(orderRowHTML).join("")}</div>`
              : orderEmptyStateHTML()}
           <button type="button" class="ord-add" id="obAdd">+ Add Product</button>`}
    `, { foot: `<div class="sah-foot ws-foot"><div class="inner" id="obFoot">${orderFootHTML()}</div></div>` });

    wireOrderBuild(customer);
  }

  // The sticky footer, in its two states — the same two-tap commit the audit
  // uses to finish a count (see quickFootHTML). Confirming is a decision made
  // in place, against the list the rep is already looking at; a separate
  // review screen re-listed what was on screen a moment ago and put the
  // quantities a tap further away when the answer was "no, change one".
  function orderFootHTML() {
    const t = orderTotals(ORDER.lines);
    if (ORDER.committing) {
      return `<button type="button" class="btn-wide primary" disabled>Creating order…</button>`;
    }
    if (!OB_CONFIRM) {
      return `<button type="button" class="btn-wide primary" id="obConfirm" ${t.products ? "" : "disabled"}>Confirm Order</button>`;
    }
    return `<span class="confirm-inline">
        <span class="ci-copy">
          <span class="ci-prompt">Confirm order?</span>
          <span class="ci-detail">${esc(plural(t.products, "product"))} · ${esc(plural(t.units, "unit"))} · FoodBridge → Zoho</span>
        </span>
        <button type="button" class="ci-btn yes" id="obYes" aria-label="Confirm order">✓</button>
        <button type="button" class="ci-btn no" id="obNo" aria-label="Keep editing">✗</button>
      </span>`;
  }

  function wireOrderBuild(customer) {
    wireSearchInput("obQ", (v) => { OB_STATE.q = v; renderOrderBuild(); }, () => {
      if (OB_STATE.focused) return false;
      OB_STATE.focused = true;
      renderOrderBuild();
      return true;
    });

    PAGE.querySelectorAll("[data-order-add]").forEach((b) => (b.onclick = () => {
      const p = productById(b.dataset.orderAdd);
      if (!p) return;
      if (!ORDER.lines.some((l) => l.productId === p.id)) {
        const known = Object.prototype.hasOwnProperty.call(ORDER.stockMap, p.id);
        ORDER.lines.push(orderLineFromProduct(p, known ? ORDER.stockMap[p.id] : null));
      }
      // Picking one answers the "add" the button asked, so the dropdown
      // gives the list back rather than staying open over it.
      OB_STATE.q = "";
      OB_STATE.adding = false;
      renderOrderBuild();
    }));

    // Removal asks in the row, exactly as the audit's counting row does.
    PAGE.querySelectorAll("[data-order-remove]").forEach((b) => (b.onclick = () => {
      PAGE.querySelectorAll(".qc-row.confirming").forEach((r) => r.classList.remove("confirming"));
      b.closest(".qc-row").classList.add("confirming");
    }));
    PAGE.querySelectorAll("[data-order-remove-no]").forEach((b) => (b.onclick = () => {
      b.closest(".qc-row").classList.remove("confirming");
    }));
    PAGE.querySelectorAll("[data-order-remove-yes]").forEach((b) => (b.onclick = () => {
      ORDER.lines = ORDER.lines.filter((l) => l.productId !== b.dataset.orderRemoveYes);
      renderOrderBuild();
    }));

    // Quantity, in place — never a re-render, or the caret is lost mid-type.
    // Same contract as wireQuickSteppers.
    PAGE.querySelectorAll(".ord-row .pd-stepper").forEach((st) => {
      const line = ORDER.lines.find((l) => l.productId === st.dataset.field);
      if (!line) return;
      const row = st.closest(".qc-row");
      const input = st.querySelector("input");
      const set = (v) => {
        const qty = Math.max(0, Math.floor(Number(v) || 0));
        input.value = qty;
        line.qty = qty;
        row.classList.toggle("done", qty > 0);
        refreshOrderChrome();
      };
      st.querySelectorAll("[data-delta]").forEach((b) => (b.onclick = () => set((Number(input.value) || 0) + Number(b.dataset.delta))));
      input.oninput = () => set(input.value);
    });

    const basis = $("#obBasis", PAGE);
    if (basis) basis.onclick = () => basisSheet(ORDER.prediction.context);

    const add = $("#obAdd", PAGE);
    if (add) add.onclick = () => {
      OB_STATE.focused = true;
      OB_STATE.adding = true;
      renderOrderBuild();
      const box = $("#obQ", PAGE);
      if (box) box.focus();
    };

    // Tapping away from an add-dropdown the rep opened but didn't use puts
    // the list back — the ordinary way a dropdown closes. Deferred because
    // blur lands BEFORE the click that caused it: picking a product must be
    // allowed to run first (it clears `adding` itself), and a re-render from
    // typing re-focuses the box, which the activeElement check lets through
    // so the caret is never stolen mid-word.
    const box = $("#obQ", PAGE);
    if (box) box.onblur = () => setTimeout(() => {
      if (!ORDER || !OB_STATE.adding) return;
      if (document.activeElement === $("#obQ", PAGE)) return;
      OB_STATE.adding = false;
      if (CURRENT.view === "order-build") renderOrderBuild();
    }, 150);

    const back = $("#obBack", PAGE);
    if (back) back.onclick = () => exitOrderSheet();

    wireOrderFoot(customer);
  }

  // Re-wired on every footer swap, since the footer replaces its own markup.
  function wireOrderFoot(customer) {
    const confirm = $("#obConfirm", PAGE);
    if (confirm) confirm.onclick = () => {
      if (!orderTotals(ORDER.lines).products) { toast("Set a quantity on at least one product.", "info"); return; }
      OB_CONFIRM = true;
      refreshOrderChrome();
    };
    const no = $("#obNo", PAGE);
    if (no) no.onclick = () => { OB_CONFIRM = false; refreshOrderChrome(); };
    const yes = $("#obYes", PAGE);
    if (yes) yes.onclick = () => {
      OB_CONFIRM = false;
      confirmOrder(customer);
    };
  }

  // Header + footer only, so typing in a stepper survives. Mirrors
  // refreshQuickChrome.
  function refreshOrderChrome(customer) {
    const t = orderTotals(ORDER.lines);
    const count = PAGE.querySelector(".ws-count");
    if (count) count.textContent = t.products ? `${plural(t.products, "product")} · ${plural(t.units, "unit")}` : "Nothing to order yet";
    const bar = PAGE.querySelector(".ws-bar > span");
    if (bar) bar.style.width = (ORDER.lines.length ? Math.round((t.products / ORDER.lines.length) * 100) : 0) + "%";
    const foot = $("#obFoot", PAGE);
    if (foot) {
      foot.innerHTML = orderFootHTML();
      wireOrderFoot(customer || loadCustomer(ORDER.customerId));
    }
  }

  // Leaving an order behind is the same conversation as leaving an audit:
  // ask, and mean it. Nothing has been created at this point, so ending it
  // genuinely discards — consistent with exitAuditSheet.
  function exitOrderSheet() {
    sheet({
      eyebrow: titleCase(nameOf(loadCustomer(ORDER.customerId) || {})),
      title: "Discard order?",
      actions: [
        { label: "Keep editing", cls: "primary" },
        { label: "Discard", cls: "danger", onClick: () => {
          ORDER = null;
          OP_STATE = { q: "", focused: false };
          toast("Order discarded.");
          go("order-pick", {}, true);
        } },
      ],
    });
  }

  /* ---- commit: FoodBridge order, then Zoho ------------------------------- */

  // THE commit point. Everything before this is editable and unsaved;
  // everything after is a record that exists. The two steps are strictly
  // ordered and independently represented: FoodBridge first, and Zoho only
  // once FoodBridge has actually succeeded — never in parallel, never
  // optimistically.
  function confirmOrder(customer) {
    if (!ORDER || ORDER.committing) return;
    const t = orderTotals(ORDER.lines);
    if (!t.products) { toast("Set a quantity on at least one product.", "info"); return; }

    ORDER.committing = true;
    refreshOrderChrome(customer);

    let record;
    try {
      const stamp = new Date().toISOString();
      const ctx = (ORDER.prediction && ORDER.prediction.context) || {};
      record = {
        id: nextOrderId(stamp),
        customerId: customer._id,
        customerName: titleCase(nameOf(customer)),
        createdAt: stamp,
        createdBy: AUDITOR.name,
        source: "predictive_order",
        status: "confirmed",
        // zohoStatus is the SYNC state (pending | syncing | created | failed).
        // zohoOrderStatus is Zoho's OWN word for the order once it exists, kept
        // separate so this screen never invents a processing state — what
        // happens to the order after creation is the distributor's business,
        // done in Zoho.
        zohoStatus: "pending",
        zohoOrderNumber: null,
        zohoOrderId: null,
        zohoOrderStatus: null,
        zohoCustomerId: null,
        zohoUrl: null,
        zohoError: null,
        zohoErrorCode: null,
        zohoLastSyncedAt: null,
        // Traceability: which audit, which orders, and what the system
        // proposed versus what the rep actually sent. This is the record a
        // later "was the prediction any good?" question is answered from.
        predictionContext: {
          auditId: ctx.auditId || null,
          auditAt: ctx.auditAt || null,
          usedStockAudit: !!ctx.usedStockAudit,
          usedSamePeriodLastYear: !!ctx.usedSamePeriodLastYear,
          usedRecentHistory: !!ctx.usedRecentHistory,
          sourceOrderDates: ctx.sourceOrderDates || [],
          generatedAt: ctx.generatedAt || stamp,
        },
        lines: t.active.map((l) => ({
          productId: l.productId,
          productName: l.productName,
          artNo: l.artNo,
          unit: l.unit,
          qty: l.qty,
          currentStock: l.currentStock,
          expectedDemand: l.expectedDemand,
          recommendedQty: l.recommendedQty,
          addedManually: l.addedManually,
        })),
        productCount: t.products,
        unitCount: t.units,
      };
      SalesOrderStore.add(record);
    } catch (e) {
      // FoodBridge creation failed — Zoho must NOT be attempted.
      ORDER.committing = false;
      refreshOrderChrome(customer);
      sheet({
        title: "Order could not be created.",
        sub: "Nothing was sent to Zoho. Please try again.",
        actions: [{ label: "Close", cls: "primary" }],
      });
      return;
    }

    // The FoodBridge order now EXISTS. From here the order id is the thing
    // that matters, and ORDER (the editable draft) has done its job — the
    // success screen reads the stored record, so a retry can never produce a
    // second FoodBridge order.
    ORDER = null;
    OB_STATE = { q: "", focused: false, adding: false };
    go("order-success", { orderId: record.id }, true);
    syncOrderToZoho(record.id);
  }

  // Zoho, as its own step against an order that already exists. Called on
  // confirm and again on retry — both times with the SAME order id, which is
  // what keeps a failure from multiplying records.
  function syncOrderToZoho(orderId) {
    const order = SalesOrderStore.byId(orderId);
    if (!order || order.zohoStatus === "created") return;
    SalesOrderStore.update(orderId, { zohoStatus: "syncing", zohoError: null, zohoErrorCode: null });
    if (CURRENT.view === "order-success") renderOrderSuccess();

    // The whole order goes over: the function needs the line quantities the
    // salesperson CONFIRMED, which is what `lines` holds. It re-reads nothing
    // from the prediction.
    FB_ZOHO.createSalesOrder(order)
      .then((res) => {
        SalesOrderStore.update(orderId, {
          zohoStatus: "created",
          // Every one of these came back from Zoho. None is generated here.
          zohoOrderNumber: res.zohoOrderNumber,
          zohoOrderId: res.zohoOrderId,
          zohoOrderStatus: res.zohoStatus || null,
          zohoCustomerId: res.zohoCustomerId || null,
          zohoUrl: res.zohoUrl || null,
          zohoError: null,
          zohoErrorCode: null,
          zohoLastSyncedAt: new Date().toISOString(),
          status: "zoho_created",
        });
      })
      .catch((err) => {
        const code = (err && err.code) || "zoho_unavailable";
        // A timeout is NOT a failure: Zoho may hold the order with only the
        // reply lost. It stays PENDING, and the retry asks the function to
        // look the reference up rather than post a second time.
        const timedOut = code === "timeout";
        SalesOrderStore.update(orderId, {
          zohoStatus: timedOut ? "pending" : "failed",
          zohoError: (err && err.message) || "Zoho sales order could not be created.",
          zohoErrorCode: code,
          zohoLastSyncedAt: new Date().toISOString(),
          status: timedOut ? "zoho_pending" : "zoho_failed",
        });
      })
      .then(() => {
        if (CURRENT.view === "order-success" && CURRENT.params.orderId === orderId) renderOrderSuccess();
      });
  }

  /* ---- VIEW: order-success — what exists, and where ---------------------- */

  // Reports the two systems SEPARATELY, because they genuinely can disagree:
  // a FoodBridge order with a failed Zoho sync is a real, valid order that
  // needs re-syncing, not a failed order to raise again.
  function renderOrderSuccess() {
    const order = SalesOrderStore.byId(CURRENT.params.orderId);
    if (!order) { go("order-pick", {}, true); return; }

    const zoho = order.zohoStatus;
    const done = zoho === "created";
    const failed = zoho === "failed";
    // A sync still in flight. A "pending" that already carries an error code is
    // a request that timed out — the order's fate in Zoho is genuinely unknown,
    // so it is NOT reported as failed and NOT left spinning: it offers Retry,
    // which asks the function to look the reference up before writing anything.
    const unresolved = zoho === "pending" && !!order.zohoErrorCode;
    const syncing = (zoho === "syncing" || zoho === "pending") && !unresolved;
    const needsRetry = failed || unresolved;

    frame(`
      <div class="ord-done">
        <div class="mark ${needsRetry ? "warn" : done ? "ok" : "busy"}">${needsRetry ? "!" : done ? "✓" : "⋯"}</div>
        <h1>${syncing ? "Creating order…" : "Order Created"}</h1>
      </div>

      <div class="cd-card ord-refs">
        <div class="ref-row">
          <span class="lbl">FoodBridge</span>
          <span class="val">${esc(order.id)}</span>
          <span class="status-tag ok">Created</span>
        </div>
        <div class="ref-row">
          <span class="lbl">Zoho</span>
          <span class="val">${order.zohoOrderNumber ? esc(order.zohoOrderNumber) : "—"}</span>
          <span class="status-tag ${done ? "ok" : failed ? "danger" : "warn"}">${done ? "Created" : failed ? "Failed" : unresolved ? "Pending" : "Syncing"}</span>
        </div>
      </div>
      ${needsRetry && order.zohoError
        ? // One line, only when something went wrong. Without it "Failed" gives
          // a rep nothing to act on, and the commonest cause here -- a product
          // or customer with no Zoho mapping yet -- is fixable in a minute by
          // whoever set the integration up.
          `<p class="ord-note">${esc(order.zohoError)}</p>`
        : ""}

      <div class="ord-summary">
        <div class="nm">${esc(order.customerName)}</div>
        <div class="sub">${esc(plural(order.productCount, "product"))} · ${esc(plural(order.unitCount, "unit"))}</div>
      </div>
    `, { foot: `<div class="sah-foot ws-foot"><div class="inner">
        ${needsRetry ? `<button type="button" class="btn-wide ghost" id="osRetry">Retry Zoho</button>` : ""}
        ${done && order.zohoUrl
          // Only when the function supplied a URL for this tenant. Zoho's API
          // returns none and nothing here invents one, so an unconfigured
          // deployment simply shows the number.
          ? `<a class="btn-wide ghost" id="osOpen" href="${esc(order.zohoUrl)}" target="_blank" rel="noopener">Open in Zoho</a>`
          : ""}
        <button type="button" class="btn-wide primary" id="osDone" ${syncing ? "disabled" : ""}>Done</button>
      </div></div>` });

    const retry = $("#osRetry", PAGE);
    // Re-syncs the EXISTING order. It never re-runs confirmOrder, which is
    // the only thing that can create a FoodBridge record.
    if (retry) retry.onclick = () => syncOrderToZoho(order.id);
    const doneBtn = $("#osDone", PAGE);
    if (doneBtn) doneBtn.onclick = () => {
      OP_STATE = { q: "", focused: false };
      go("order-pick", {}, true);
    };
  }

  /* ------------------------------------------------------------------ mount */

  // Every entry converges on the one Stock Audit journey — there is no
  // second destination to branch to anymore. `entry=quick` is accepted but
  // no longer changes behavior (kept only so the WhatsApp/Delivery
  // Management links already generated with it keep working unchanged);
  // what matters is whether a customer id or a search hint came along.
  //
  // Standalone-openable with query params — same convention the file's own
  // header documents. The platform shell's hash router never forwards query
  // strings into this module's iframe (it always loads the bare configured
  // URL), so both entry points MUST reach this file directly — a real
  // top-level navigation to stock-audit.html, not through
  // #/customer-management/stock-audit-health.
  function mount() {
    PAGE = mountShell($("#app"), { screen: "stock-audit", crumb: "Stock Audit & Health", tenant: SEED.tenant });
    // Built up front so shell.js's toast() finds this screen's `.toasts` host
    // already in place (inside the phone) rather than making its own on <body>.
    overlayHost();
    // The phone's box moves when the window does — it's centred, and its
    // height is capped against the viewport — so the layer is re-measured
    // rather than positioned once at mount.
    window.addEventListener("resize", syncOverlayFrame);
    window.addEventListener("orientationchange", syncOverlayFrame);
    trackKeyboardInset();
    keepFocusVisible();
    LocationStore.load();
    DraftStore.load();
    AuditStore.load();
    SalesOrderStore.load();

    const params = new URLSearchParams(location.search);
    const id = params.get("customer");
    const hint = params.get("hint");
    if (id) { startAuditFor(id); return; }
    if (hint) { QP_STATE = { q: hint, primed: true, focused: false }; go("quick-pick", {}, true); return; }
    go("quick-pick", {}, true);
  }

  window.SAH = { mount };
})();

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
  function fmtTimeShort(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
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
    // Unsaved work gets the screen's own confirmation rather than silently
    // losing it — see guardedPop.
    if (guardedPop()) return;
    // The phone's Back button. Walk the view stack instead of leaving the page.
    back(true);
  });

  // `center` renders the same component as a small centred modal instead of a
  // bottom sheet. Reserved for the questions that INTERRUPT — leaving a visit,
  // discarding an order — because those are not something the rep opened and
  // can flick away; they are a decision the screen is waiting on. Sheets stay
  // sheets for the things a rep asks to see (a product, a past version).
  function sheet({ eyebrow, title, sub, body, actions, center }) {
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
    scrim.className = "sah-sheet-scrim" + (center ? " center" : "");
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

  // The customer's name in a workspace header, as something you can open.
  //
  // The header stays ONE line: it shares that line with a back button and a
  // progress count, and it is a place marker, not somewhere a long name is
  // meant to be read. So the name gets what is left and is elided — which on a
  // phone means "A N Enterprise (Golden Mart, Guwahati)" reads as "A N
  // Enterprise (Golden…", and that is fine, because the ellipsis is now a
  // promise the app can keep: tapping the name opens the whole thing.
  //
  // (A two-line clamp was tried and reverted. It showed those names whole, but
  // grew the header on exactly the customers with long names, so the screen's
  // furniture shifted depending on which shop the rep walked into.)
  const whoHTML = (customer) => {
    const name = titleCase(nameOf(customer));
    return `<button type="button" class="ws-who" data-customer-name="${esc(name)}"
      >${esc(name)}</button>`;
  };

  // The name, whole, and deliberately nothing else — no address, no category,
  // no status, no order count. Those all live on the customer's own screens,
  // and putting any of them here would turn a one-line answer into a summary
  // card that has to be read. The only question this sheet exists to answer is
  // the one a clipped header raises: which customer am I in?
  function customerNameSheet(name) {
    sheet({ title: name, actions: [{ label: "Close", cls: "primary" }] });
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
    zoho_pending: { label: "Accounts sync pending", cls: "warn" },
    zoho_created: { label: "Invoice created", cls: "ok" },
    zoho_failed: { label: "Accounts sync failed", cls: "danger" },
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

  const DEVICE_KEY = "fb-discovery-device-tag";

  // Four characters that identify THIS browser, minted once and kept.
  //
  // The counter below is derived from this browser's own stored orders, which
  // is right for a prototype with no server to allocate numbers -- but it
  // means two phones both raise "001" on the same day. That id becomes Zoho's
  // reference_number, and the bridge de-duplicates on it: a second device's
  // 001 would be handed the first device's sales order, for a different shop,
  // and told it had synced. The tag is what keeps the two apart.
  //
  // The bridge refuses a reference that already belongs to another customer,
  // so a collision fails loudly rather than silently -- this stops it
  // happening at all.
  function deviceTag() {
    try {
      let t = localStorage.getItem(DEVICE_KEY);
      if (!t) {
        t = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "0");
        localStorage.setItem(DEVICE_KEY, t);
      }
      return t;
    } catch (e) {
      // Private mode: stable for the session, which is as far as anything
      // else in this prototype persists anyway.
      return "0000";
    }
  }

  // FB-SO-YY-MM-TTTT-NNN, sequential within the month so two orders raised on
  // the same day are visibly ordered, and tagged per device so two reps never
  // mint the same reference. Derived from what is already stored rather than a
  // counter of its own, which would drift the moment storage is cleared but
  // the orders are not.
  function nextOrderId(when) {
    const d = when ? new Date(when) : new Date();
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const prefix = `FB-SO-${yy}-${mm}-${deviceTag()}-`;
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
  // Every seeded product has an article number; one a rep added in the field
  // may not, because the SKU is optional there — a jar on a shelf does not
  // always have a code the rep can read off it. In a LIST, the answer to "no
  // SKU" is to say nothing rather than print a bare "SKU" or a dash: the row
  // is identified by its name, and the label with nothing after it reads as a
  // rendering fault. (The product sheet still shows "SKU —", which is right
  // in a label/value context where the row is the field.)
  const skuText = (p) => (p && p.artNo ? "SKU " + p.artNo : "");

  const CATALOGUE_KEY = "fb-discovery-stock-catalogue-v1";
  // Products a rep added from the shop floor, layered onto the seeded
  // catalogue exactly the way LocationStore layers field-added locations onto
  // a customer's registered addresses. The rep is standing in front of
  // something Foodbridge has never heard of; without this the count simply
  // cannot record it.
  //
  // load() PUSHES INTO `products` rather than replacing it. That array is this
  // module's catalogue — search, productById, the order screen, all of it reads
  // that one binding — so a product that lands in it is, from every reader's
  // point of view, a seeded product. That is the requirement:
  // once created it must be indistinguishable, including next visit.
  const CatalogueStore = {
    state: [],
    load() {
      try {
        this.state = JSON.parse(localStorage.getItem(CATALOGUE_KEY) || "null") || [];
      } catch (e) {
        this.state = [];
      }
      // Guarded on id: a seed that later ships a product a rep had already
      // added by hand would otherwise appear twice, and every list keyed by
      // product id would carry a duplicate row.
      this.state.forEach((p) => { if (p && p.id && !productById(p.id)) products.push(p); });
      return this.state;
    },
    save() {
      try {
        localStorage.setItem(CATALOGUE_KEY, JSON.stringify(this.state));
        return true;
      } catch (e) {
        /* private mode, or the quota — see add() */
        return false;
      }
    },
    add(p) {
      this.state.push(p);
      products.push(p);
      // A photo is an inlined data URL and every other store shares the same
      // ~5MB origin quota, so this is the one write here that can realistically
      // fail. The product matters and the picture does not: drop the image and
      // keep the catalogue rather than losing both to a silent throw. Nothing
      // on screen changes either way — see the note on `photo` below: no
      // surface in this module renders a product image any more.
      if (!this.save() && p.image) {
        delete p.image;
        if (this.save()) toast("Photo too large to save — product added without it", "info");
      }
      return p;
    },
  };

  // Continues the seed's own p01…p86 rather than minting a uuid, so a
  // rep-added product reads like catalogue and not like a foreign key that
  // escaped. Derived from what is in `products` NOW, which already includes
  // everything CatalogueStore.load() restored.
  function nextProductId() {
    const n = products.reduce((max, p) => {
      const m = /^p(\d+)$/.exec(String(p.id || ""));
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);
    return "p" + String(n + 1).padStart(2, "0");
  }

  // Two products are the same product if they share an SKU, or if their names
  // differ only by case and spacing. Not concurrency control — the prototype
  // has one tab and one rep — but enough that a rep who adds "Amla Pickle
  // 500g" twice across two visits gets the row they already made.
  const normName = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
  const normSku = (s) => String(s || "").trim().toLowerCase();
  function findExistingProduct(name, sku) {
    const n = normName(name);
    const k = normSku(sku);
    return products.find((p) => (k && normSku(p.artNo) === k) || (n && normName(p.name) === n)) || null;
  }

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
  // A product with no `unit` at all falls back to Pc, the catalogue default.
  function unitsFor(p) {
    const base = (p && p.unit) || "Pc";
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
    // Every audit is a stack of saved versions, newest last. `a.lines` always
    // mirrors the LAST one, so everything that already reads an audit —
    // coverage, the health axes, Predictive Sales Order's current-stock basis
    // — keeps reading the field it always did and gets the current count
    // without knowing versions exist. The stack is what makes an update
    // non-destructive: the 05 Aug count is still in versions[0] after the
    // 27 Aug update rewrites a.lines.
    // Audits written before versioning get their existing state as version 1,
    // which is the honest reading: one count, taken when the visit closed.
    if (!a.versions || !a.versions.length) {
      a.versions = [{
        id: (a.id || "aud") + "-v1",
        auditId: a.id || null,
        customerId: a.customerId,
        at: a.completedAt || a.at,
        by: (a.actors && a.actors.createdBy) || a.auditor,
        action: "created",
        prev: null,
        lines: clone(a.lines),
      }];
    }
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
  /* --------------------------------------------------------- losing work */

  // Work that exists only on this screen and would be gone if the rep left.
  // Deliberately narrow: a visit with nothing counted, or an order with no
  // quantities, is nothing to lose, and asking about it would train people to
  // dismiss the question that matters.
  function pendingWork() {
    if (CURRENT.view === "quick-count" && DRAFT && quickStats().captured > 0) return "audit";
    if (CURRENT.view === "audit-edit" && EDIT && editDirty()) return "edit";
    if (CURRENT.view === "order-build" && ORDER && (ORDER.lines || []).some((l) => Number(l.qty) > 0)) return "order";
    return null;
  }

  // Edit Audit holds its changes in memory and writes nothing until Save, so
  // "dirty" is the same comparison the save path makes.
  function editDirty() {
    const a = auditsFor(EDIT.customerId).find((x) => x.id === EDIT.auditId);
    return !!a && linesSignature(a.lines) !== linesSignature(editLines());
  }

  // Leaving Edit Audit without saving. The count screen and the order screen
  // already ask before dropping work; this screen was the one that didn't.
  function exitEditSheet() {
    sheet({
      title: "Discard changes?",
      center: true,
      actions: [
        { label: "Keep editing", cls: "primary" },
        { label: "Discard", cls: "danger", onClick: () => {
          EDIT = null;
          AE_CONFIRM = false;
          back();
        } },
      ],
    });
  }

  // One question per kind of work, and always the screen's OWN question — the
  // rep gets the same wording whether they used the ← button or the phone's
  // Back gesture, which is what makes the two feel like one action.
  function askBeforeLeaving(kind) {
    if (kind === "audit") { exitAuditSheet(loadCustomer(DRAFT.customerId)); return true; }
    if (kind === "edit") { exitEditSheet(); return true; }
    if (kind === "order") { exitOrderSheet(); return true; }
    return false;
  }

  // The phone's Back had been walking the view STACK straight past all of
  // that: the ← button asked, the gesture did not, and the same tap that
  // opens a confirmation on one screen threw the visit away on the other.
  // The consumed history entry is replaced first, so answering "keep
  // counting" leaves the rep exactly where they were with Back still working.
  function guardedPop() {
    const kind = pendingWork();
    if (!kind) return false;
    try { history.pushState({ sahGuard: true }, ""); } catch (e) { /* file:// */ }
    return askBeforeLeaving(kind);
  }

  // Closing the tab, reloading, or following a link out. A page teardown can
  // only ever raise the browser's own dialog — no custom sheet can run here —
  // so this is the one place the wording is not ours.
  window.addEventListener("beforeunload", (e) => {
    if (!pendingWork()) return;
    e.preventDefault();
    e.returnValue = "";
    return "";
  });

  function scrollTop() {
    const el = document.scrollingElement || document.documentElement;
    if (el) el.scrollTop = 0;
  }

  function renderCurrent() {
    ({
      audits: renderAudits,
      audit: renderAudit,
      "audit-edit": renderAuditEdit,
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

  // Every search box in this app shares one interaction, and it lives here so
  // the screens cannot drift apart on it: focusing a box opens its dropdown
  // immediately — before a single character is typed — and tapping away closes
  // it again. `dropdown` carries the two things only the screen knows: whether
  // its box is open right now, and how to set that (its own flag, plus the
  // re-render that paints it). A search that filters a list already on the
  // page has no dropdown to open and passes nothing.
  function wireSearchInput(id, onInput, dropdown) {
    const box = $("#" + id, PAGE);
    if (!box) return;
    const refocus = () => {
      const b = $("#" + id, PAGE);
      if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
    };
    box.oninput = debounce(() => { onInput(box.value); refocus(); }, 220);
    if (!dropdown) return;
    // A re-render replaces this node, so the refocus above re-fires "focus" on
    // the new one; the already-open check is what stops that from looping.
    box.onfocus = () => {
      if (dropdown.isOpen()) return;
      dropdown.setOpen(true);
      refocus();
    };
    // Deferred because blur lands BEFORE the click that caused it: picking a
    // result must be allowed to run first, and a re-render from typing
    // re-focuses the box, which the activeElement check lets through so the
    // caret is never stolen mid-word.
    box.onblur = () => setTimeout(() => {
      if (document.activeElement === $("#" + id, PAGE)) return;
      if (dropdown.isOpen()) dropdown.setOpen(false);
    }, 150);
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
  // trays says so and gives the base-unit total in brackets — "3 Tray (36 Pc)"
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
  /* --------------------------------------------------------- audit versions */

  // What a version is FOR comparison: the counted lines, and nothing else.
  // Two saves a minute apart with the same numbers are the same count, so the
  // timestamp and the actor are deliberately not in here — they are what a
  // version records, not what makes it different from the one before.
  function linesSignature(lines) {
    return (lines || [])
      .slice()
      .sort((a, b) => String(a.productId).localeCompare(String(b.productId)))
      .map((l) => [l.productId, linePhysical(l), l.countQty, l.countUnit, l.status].join(":"))
      .join("|");
  }

  // Append a version and make it current. Returns false when nothing changed,
  // which is the caller's cue to save nothing at all — a Save that only moved
  // the clock would put a "Updated" entry on the timeline for a visit nobody
  // touched, and the timeline is the one place this feature has to stay honest.
  function commitAuditVersion(audit, lines) {
    if (linesSignature(audit.lines) === linesSignature(lines)) return false;
    const prev = audit.versions[audit.versions.length - 1];
    const at = new Date().toISOString();
    audit.versions.push({
      id: audit.id + "-v" + (audit.versions.length + 1),
      auditId: audit.id,
      customerId: audit.customerId,
      at,
      by: AUDITOR.name,
      action: "updated",
      prev: prev ? prev.id : null,
      lines: clone(lines),
    });
    audit.lines = clone(lines);
    // The visit's own date (`at`) is NOT touched: an update corrects what the
    // 05 Aug visit found, it does not move the visit to today. Audit History
    // sorts on `at`, so leaving it alone is also what keeps that list exactly
    // where it was.
    audit.actors.lastEditedBy = AUDITOR.name;
    audit.updatedAt = at;
    return true;
  }

  /* ------------------------------------------------- product detail sheet */

  // One product, one sheet, reachable from anywhere the product is named.
  // Every row that names a product can only ever show a truncated name and a
  // SKU — and the question a rep actually has, standing in front of a shelf,
  // is "is this the 475 gm or the 1000 gm?". The sheet is where the rest of
  // the identity lives: the picture, the full untruncated name, the category
  // it files under, and the pack ladder it travels in, which is what gives
  // the unit chip in the row something to be read against.
  //
  // Opened by DELEGATION, never by per-screen wiring: a surface opts in by
  // marking the product's name (or thumbnail) `data-product-info="<id>"`, and
  // the single capture-phase listener in mount() does the rest. That is what
  // makes "everywhere" hold — a new product surface inherits the sheet by
  // carrying the attribute, with no handler anyone has to remember to attach,
  // and re-rendering a screen can't detach it because nothing was attached to
  // the screen in the first place.
  //
  // `data-product-ctx` names WHICH record the contextual line reads from,
  // because the same product means a different thing on each screen: what was
  // counted on this visit, what is going on this order, what a past audit
  // found. Absent, the sheet is catalogue facts alone — which is the honest
  // answer on a screen that isn't holding a number for it.
  // Which pack this product is currently being handled in — the price a rep
  // wants is for the unit they are counting or ordering in, not always the
  // base one. `data-product-ctx` names WHICH record to read: the draft, the
  // order, or the audit being viewed. Absent (a search result nothing holds a
  // number for yet), the base unit is the honest answer.
  function unitInUse(p, kind) {
    const base = baseUnit(p);
    try {
      if (kind === "audit") {
        const l = DRAFT && DRAFT.lines && DRAFT.lines[p.id];
        return (l && l.countUnit) || base;
      }
      if (kind === "order") {
        const l = ORDER && ORDER.lines && ORDER.lines.find((x) => x.productId === p.id);
        return (l && l.unit) || base;
      }
      if (kind === "history") {
        const a = auditsFor(CURRENT.params.customerId).find((x) => x.id === CURRENT.params.auditId);
        const l = a && auditLines(a).find((x) => x.productId === p.id);
        return (l && l.countUnit) || base;
      }
    } catch (e) {
      /* the record moved under a saved draft — the base unit still answers */
    }
    return base;
  }

  const unitMoney = (p, label) => {
    const v = unitPrice(p, label);
    return v == null ? null : fmtINR(v);
  };
  const priceBlockHTML = (p, label) => {
    const v = unitMoney(p, label);
    return v == null
      ? `<span class="us-price none">No price set</span>`
      : `<span class="us-price">${esc(v)}</span>`;
  };

  // The unit and its price, together, because neither means anything alone.
  // Shared by the two sheets that show them — the product sheet, which reads
  // them, and the unit sheet, which changes them — so the pair cannot drift
  // apart. Every option carries its own price, so the packs are compared
  // inside the list rather than one at a time.
  function unitPriceHTML(p, picked, labels) {
    const base = baseUnit(p);
    return `
      <div class="us-now">
        <span class="us-now-copy">
          <span class="us-label">${esc(labels.price)}</span>
          <span id="usPrice">${priceBlockHTML(p, picked)}</span>
        </span>
        <span class="us-badge" id="usBadge">${esc(picked)}</span>
      </div>
      <div class="us-pick">
        <label class="us-label" for="usUnit">${esc(labels.unit)}</label>
        <span class="us-select">
          <select id="usUnit">
            ${unitsFor(p).map((u) => {
              const packed = `${u.label}${u.per > 1 ? ` (${u.per} ${base})` : ""}`;
              const v = unitMoney(p, u.label);
              return `<option value="${esc(u.label)}" ${u.label === picked ? "selected" : ""}>${esc(v == null ? packed : `${packed} · ${v}`)}</option>`;
            }).join("")}
          </select>
          <span class="chev" aria-hidden="true">⌄</span>
        </span>
      </div>`;
  }

  // Keeps the figure and the badge answering the picker, the moment it moves.
  function wireUnitPrice(el, p, onPick) {
    const sel = el.querySelector("#usUnit");
    if (!sel) return;
    const priceHost = el.querySelector("#usPrice");
    const badge = el.querySelector("#usBadge");
    sel.onchange = () => {
      if (badge) badge.textContent = sel.value;
      if (priceHost) priceHost.innerHTML = priceBlockHTML(p, sel.value);
      if (onPick) onPick(sel.value);
    };
  }

  // Deliberately four things and no more: which product, and what a pack of it
  // costs. The picture, the category, the base unit, the system stock and the
  // "this visit" line were all removed — none of them answered the question a
  // rep opens this to ask, and together they pushed the one that does below
  // the fold. This is the start of the unit/price journey, not a datasheet.
  function productDetailSheet(id, kind) {
    const p = productById(id);
    // A product id with nothing behind it means the catalogue moved under a
    // saved draft. Silence beats a sheet full of blanks.
    if (!p) return;
    const s2 = sheet({
      body: `
        <h2 class="us-name">${esc(p.name)}</h2>
        ${p.artNo ? `<p class="us-sku">${esc(skuText(p))}</p>` : ""}
        ${unitPriceHTML(p, unitInUse(p, kind), { price: "Unit price", unit: "Unit" })}`,
      actions: [{ label: "Close", cls: "primary" }],
    });
    wireUnitPrice(s2.el, p);
  }

  // The empty state of a product search, with the way out of it: a product the
  // catalogue has never heard of is the one case where searching harder does
  // not help, so the "add it" affordance lives in the result list itself.
  function noProductFoundHTML() {
    return `<div class="dropdown-empty">No product found
      <button type="button" class="np-add" data-new-product>+ Add Product</button>
    </div>`;
  }

  function newProductSheet(query, onAdded) {
    const units = Object.keys(UNIT_LADDERS);
    // Every label says which it is, required and optional alike: a rep who has
    // never seen this sheet before should not have to press Add to find out
    // what it will refuse, and with the two halves mixed, marking only one
    // side would read as an oversight on the other.
    //
    // Order is what the rep can answer, in the order they can answer it. Name
    // and unit they know by looking at the thing. The SKU is a code they have
    // to find printed somewhere and may not find at all, so it sits after the
    // two required fields and does not block the count when the jar has no
    // legible label on it.
    const field = (id, label, req, control) =>
      `<label for="${id}">${esc(label)}<span class="tag ${req ? "req" : "opt"}">${req ? "Required" : "Optional"}</span>${control}</label>` +
      `<span class="sf-err" id="${id}Err"></span>`;

    // Held here rather than read off the input at Add: the file input carries
    // the original camera JPEG (several MB), and what the catalogue stores is
    // the downscaled copy made when the shot was taken.
    let photo = null;

    const s = sheet({
      title: "New Product",
      body: `<div class="sheet-form np-form">
        ${field("npName", "Name", true, `<input type="text" id="npName" autocomplete="off" value="${esc(query || "")}">`)}
        ${field("npUnit", "Unit", true, `<select id="npUnit">${units
          .map((u) => `<option value="${esc(u)}">${esc(u)}</option>`).join("")}</select>`)}
        ${field("npSku", "SKU Code", false, `<input type="text" id="npSku" autocomplete="off" inputmode="numeric">`)}
        <div class="np-photo">
          <span class="lbl">Photo<span class="tag opt">Optional</span></span>
          <span class="np-shot" id="npShot">📷</span>
          <button type="button" class="np-cam" id="npCam">Take Photo</button>
          <button type="button" class="np-cam ghost" id="npClear" hidden>Remove</button>
          <input type="file" accept="image/*" capture="environment" id="npFile" hidden>
        </div>
      </div>`,
      actions: [{
        label: "Add",
        cls: "primary",
        onClick() {
          const el = (id) => s.el.querySelector("#" + id);
          const name = el("npName").value.trim();
          const sku = el("npSku").value.trim();
          const unit = el("npUnit").value;

          // Every field is reported at once. Fixing one thing, pressing Add and
          // being told about the next is the slowest possible way through a
          // short form. SKU and photo are absent here by design — neither can
          // fail, so neither can hold up a count.
          const errs = { npName: name ? "" : "Name required", npUnit: unit ? "" : "Unit required" };
          Object.keys(errs).forEach((id) => {
            const n = el(id + "Err");
            n.textContent = errs[id];
            n.classList.toggle("show", !!errs[id]);
          });
          const firstBad = Object.keys(errs).find((id) => errs[id]);
          if (firstBad) {
            el(firstBad).focus();
            return false; // sheet() keeps itself open on a false
          }

          // Adopt rather than duplicate. The rep gets the row they meant
          // either way; the toast is only so the name on the row matching
          // something they didn't type isn't a mystery.
          //
          // A photo taken here is deliberately NOT written onto the product
          // that already exists: editing catalogue entries is a different job
          // from adding one, and a seeded product's image isn't in
          // CatalogueStore, so it would vanish on the next reload anyway.
          const existing = findExistingProduct(name, sku);
          if (existing) {
            toast("Already in catalogue", "info");
            onAdded(existing);
            return;
          }

          // systemStock 0, not null: nothing has ever been booked in against
          // this product, which is a fact and not a gap.
          //
          // `image` is still WRITTEN and still nothing renders it: the search
          // results were the last surface that did, and they no longer carry a
          // thumbnail. It is kept because the capture below is a deliberate
          // field affordance and a photo already taken should not be silently
          // thrown away — but nothing in this module displays it today.
          const p = { id: nextProductId(), name, artNo: sku, unit, systemStock: 0 };
          if (photo) p.image = photo;
          onAdded(CatalogueStore.add(p));
        },
      }],
    });

    /* ------------------------------------------------- the optional photo */

    // `capture="environment"` asks a phone for the REAR camera directly, so
    // the rep taps once and is shooting the shelf rather than picking their
    // way through a gallery. A desktop browser ignores it and opens a file
    // picker, which is the right fallback and needs no branch here.
    const fileInput = s.el.querySelector("#npFile");
    const shot = s.el.querySelector("#npShot");
    const cam = s.el.querySelector("#npCam");
    const clear = s.el.querySelector("#npClear");

    const showPhoto = (url) => {
      photo = url;
      shot.innerHTML = url ? `<img src="${esc(url)}" alt="">` : "📷";
      cam.textContent = url ? "Retake" : "Take Photo";
      clear.hidden = !url;
    };

    cam.onclick = () => fileInput.click();
    clear.onclick = () => { fileInput.value = ""; showPhoto(null); };
    fileInput.onchange = () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      cam.disabled = true;
      cam.textContent = "…";
      downscalePhoto(f, (url) => {
        cam.disabled = false;
        if (url) showPhoto(url);
        else { showPhoto(null); toast("Couldn't read that photo", "error"); }
      });
    };

    // Only when there is nothing in the name yet. Once the search has filled
    // it, every remaining field is either a dropdown with a working default or
    // optional — so raising the keyboard would cover half the sheet to help
    // with nothing, and the rep's next tap is most likely Add.
    if (!query) {
      const nameField = s.el.querySelector("#npName");
      if (nameField) setTimeout(() => nameField.focus(), 60);
    }
    return s;
  }

  // A phone camera hands over 3–8MB of JPEG. localStorage gives this origin
  // about 5MB for EVERY store it holds, and the biggest this image is ever
  // drawn is the ~72px detail hero, so the full-size original buys nothing and
  // costs the catalogue. 320px on the long edge at q0.7 lands around 20KB and
  // still looks right on a 3x screen.
  //
  // Canvas, not the raw file: it also strips EXIF (including where the shop
  // is) and normalises HEIC/PNG down to one JPEG, so what gets stored is one
  // predictable shape rather than whatever the handset felt like producing.
  function downscalePhoto(file, cb) {
    const MAX = 320;
    const reader = new FileReader();
    reader.onerror = () => cb(null);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => cb(null);
      img.onload = () => {
        try {
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.width * scale));
          c.height = Math.max(1, Math.round(img.height * scale));
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          cb(c.toDataURL("image/jpeg", 0.7));
        } catch (e) {
          cb(null);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function productsCheckedSectionHTML(a) {
    const lines = auditLines(a);
    return `
      <div class="section-head-row">
        <h2>Products</h2>
        <button type="button" class="hdr-act" id="auEdit">Edit</button>
      </div>
      <div class="cd-card pi-card">
        ${lines.length
          ? lines.map((l) => {
              const p = productById(l.productId) || {};
              const nf = l.status === "not_found";
              return `<div class="pi-row">
                <span class="info" data-product-info="${esc(l.productId)}" data-product-ctx="history" role="button" tabindex="0" aria-label="Details for ${esc(p.name || l.productId)}">
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

  // Newest first — the same direction Audit History reads, and the same
  // direction a rep asks the question in ("what happened to this last?").
  const versionAction = (v) => (v.action === "created" ? "Created" : "Updated");
  const versionWhen = (v) => `${fmtDateShort(v.at)} · ${fmtTimeShort(v.at)}`;

  // Oldest first, so the thread reads downward the way the visit actually
  // happened. No card around it: a card per event turned three dates into
  // three panels, which is most of a screen for what is one line of fact each.
  function auditTimelineHTML(a) {
    return `
      <div class="section-head-row"><h2>Audit timeline</h2></div>
      <div class="tl">
        ${a.versions.map((v) => `
          <button type="button" class="tl-row" data-version="${esc(v.id)}">
            <span class="dot" aria-hidden="true"></span>
            <span class="tl-when">${esc(versionWhen(v))}</span>
            <span class="tl-who">${esc(v.by || AUDITOR.name)} · ${versionAction(v)}</span>
          </button>`).join("")}
      </div>`;
  }

  // What the audit looked like at one point in time. Read-only, and rendered
  // from THAT version's stored `lines` — never recomputed from the current
  // audit, which is the whole reason the snapshot is kept.
  function versionSheet(a, versionId) {
    const v = a.versions.find((x) => x.id === versionId);
    if (!v) return;
    sheet({
      title: versionAction(v),
      sub: `${versionWhen(v)} · ${v.by || AUDITOR.name}`,
      body: `
        <div class="section-head-row" style="margin-top:16px"><h2>Products</h2></div>
        <div class="vs-list">
          ${v.lines.map((l) => {
            const p = productById(l.productId) || {};
            return `<div class="pi-row">
              <span class="info">
                <span class="nm">${esc(p.name || l.productId)}</span>
                <span class="sku">SKU ${esc(p.artNo || "—")}</span>
              </span>
              <span class="right"><span class="qty">${l.status === "not_found" ? "Not found" : esc(countedText(p, l))}</span></span>
            </div>`;
          }).join("")}
        </div>`,
      actions: [{ label: "Close", cls: "primary" }],
    });
  }

  function renderAudit() {
    const customer = loadCustomer(CURRENT.params.customerId);
    const a = auditsFor(CURRENT.params.customerId).find((x) => x.id === CURRENT.params.auditId);
    if (!customer || !a) { go("quick-pick", {}, true); return; }

    frame(`
      <div class="sah-page-head">
        <div class="row" style="align-items:center">
          <button type="button" class="back" id="auBack">← ${esc(titleCase(nameOf(customer)))}</button>
          <span class="au-when">${esc(fmtDateShort(a.at))} · ${esc(fmtTimeShort(a.at))}</span>
        </div>
      </div>

      ${productsCheckedSectionHTML(a)}
      ${auditTimelineHTML(a)}
    `);

    // Wrapped, not passed directly: as a handler, back would receive the click
    // Event as its fromPopstate argument and skip spending the history entry.
    $("#auBack", PAGE).onclick = () => back();
    // Editing is a secondary action here — this screen is for reading the
    // visit, not changing it, and a sticky full-width button said the opposite.
    $("#auEdit", PAGE).onclick = () => startAuditEdit(a);
    PAGE.querySelectorAll("[data-version]").forEach((b) => (b.onclick = () => versionSheet(a, b.dataset.version)));
  }

  /* ================================================================= VIEW: audit-edit */

  // Editing a completed audit is the SAME screen as counting one, minus the
  // parts that only make sense on a live visit: no progress header (the visit
  // is over), no finish-confirmation (there is nothing left to walk), no
  // outcome. What remains — the product rows, the stepper, the unit chip, the
  // search dropdown, the in-row remove — is the count screen's own markup,
  // rendered from this state instead of the draft.
  //
  // A separate state object rather than reusing DRAFT: DRAFT is the live-visit
  // draft, persisted per customer by persistDraft, and loading a finished
  // audit into it would put a phantom visit-in-progress under that customer.
  // Editing touches nothing until Save.
  let EDIT = null; // { auditId, customerId, lines, q, adding }
  let AE_CONFIRM = false;

  function startAuditEdit(a) {
    const lines = {};
    auditLines(a).forEach((l) => (lines[l.productId] = clone(l)));
    EDIT = { auditId: a.id, customerId: a.customerId, lines, q: "", adding: false, focused: false };
    AE_CONFIRM = false;
    go("audit-edit", { customerId: a.customerId, auditId: a.id });
  }

  function editSelected() {
    return Object.keys(EDIT.lines).map(productById).filter(Boolean);
  }

  // The lines this edit would actually save.
  function editLines() {
    return Object.keys(EDIT.lines).map((id) => EDIT.lines[id]).filter(lineIsCaptured);
  }

  // Saving asks first, in the footer — the same two-tap commit finishing a
  // count and confirming an order already use. No detail line under the
  // prompt: those two are committing something new, where the totals are the
  // decision, and this is a correction to a record the rep is looking at.
  function editFootHTML() {
    if (!AE_CONFIRM) {
      // Add sits in the sticky footer, not under the list: with thirty
      // products counted, a button below the last row is a scroll away from
      // the rep who wants a thirty-first. Hidden while the search dropdown is
      // open, where it would be offering what the rep is already doing.
      const searching = !!EDIT.q.trim() || EDIT.adding || EDIT.focused;
      return `${searching ? "" : `<button type="button" class="btn-add" id="aeAdd">+ Add Product</button>`}
        <button type="button" class="btn-wide primary" id="aeSave">Save</button>`;
    }
    return `<span class="confirm-inline">
        <span class="ci-copy"><span class="ci-prompt">Save changes?</span></span>
        <button type="button" class="ci-btn yes" id="aeYes" aria-label="Save changes">✓</button>
        <button type="button" class="ci-btn no" id="aeNo" aria-label="Keep editing">✗</button>
      </span>`;
  }

  // Only the footer is rebuilt, never the screen: a full re-render would drop
  // the caret out of whichever count the rep was typing into.
  function refreshEditFoot(a) {
    const foot = $("#aeFoot", PAGE);
    if (foot) { foot.innerHTML = editFootHTML(); wireEditFoot(a); }
  }

  function wireEditFoot(a) {
    const save = $("#aeSave", PAGE);
    if (save) save.onclick = () => {
      const lines = editLines();
      if (!lines.length) { toast("Count at least one product first.", "info"); return; }
      // Nothing changed is nothing to confirm — saveAuditEdit already knows to
      // write no version in that case, so this leaves without a question the
      // rep has no way to answer wrong.
      if (linesSignature(a.lines) === linesSignature(lines)) { saveAuditEdit(a); return; }
      AE_CONFIRM = true;
      refreshEditFoot(a);
    };
    const add = $("#aeAdd", PAGE);
    if (add) add.onclick = () => {
      EDIT.adding = true;
      renderAuditEdit();
      const box = $("#aeQ", PAGE);
      if (box) box.focus();
    };
    const no = $("#aeNo", PAGE);
    if (no) no.onclick = () => { AE_CONFIRM = false; refreshEditFoot(a); };
    const yes = $("#aeYes", PAGE);
    if (yes) yes.onclick = () => { AE_CONFIRM = false; saveAuditEdit(a); };
  }

  function renderAuditEdit() {
    const customer = loadCustomer(CURRENT.params.customerId);
    const a = auditsFor(CURRENT.params.customerId).find((x) => x.id === CURRENT.params.auditId);
    if (!customer || !a || !EDIT) { go("quick-pick", {}, true); return; }

    const q = EDIT.q.trim().toLowerCase();
    const matches = (p) => [p.name, p.artNo, p.category, p.subCategory].join(" ").toLowerCase().includes(q);
    const available = products.filter((p) => !EDIT.lines[p.id]);
    // Same three ways in as the order screen's picker: a typed query, an
    // explicit "+ Add Product", or simply focusing the box.
    const searching = !!q || EDIT.adding || EDIT.focused;
    const results = !searching
      ? []
      : q
        ? available.filter(matches)
        : available.slice().sort((x, y) => x.name.localeCompare(y.name)).slice(0, 5);
    const selected = editSelected();

    frame(`
      <div class="ws-head">
        <button type="button" class="ws-exit" id="aeBack" aria-label="Back">←</button>
        ${whoHTML(customer)}
      </div>

      <div class="sah-search-row">
        <div class="sah-search"><input type="search" id="aeQ" ${SEARCH_ATTRS} value="${esc(EDIT.q)}" placeholder="Search product name or SKU…"></div>
      </div>

      ${searching
        ? `<div class="picker-list dropdown">${results.length
            ? results.map((p) => `
              <button type="button" class="picker-row" data-edit-add="${esc(p.id)}">
                <span><span class="nm">${esc(p.name)}</span><div class="sub">${esc(skuText(p))}</div></span>
                <span class="add-ic" aria-hidden="true">+</span>
              </button>`).join("")
            : noProductFoundHTML()}</div>`
        : `${selected.length
            ? `<div class="qc-card">${selected.map((p) => quickRowHTML(p, EDIT.lines)).join("")}</div>`
            : `<div class="sah-empty"><div class="big">📋</div><p>No products.<br>Search above to add one.</p></div>`}`}
    `, { foot: `<div class="sah-foot ws-foot"><div class="inner" id="aeFoot">${editFootHTML()}</div></div>` });

    wireAuditEdit(customer, a);
  }

  function wireAuditEdit(customer, a) {
    wireSearchInput("aeQ", (v) => { EDIT.q = v; renderAuditEdit(); }, {
      isOpen: () => EDIT.focused || EDIT.adding,
      setOpen: (v) => {
        if (CURRENT.view !== "audit-edit" || !EDIT) return;
        EDIT.focused = v;
        if (!v) EDIT.adding = false;
        renderAuditEdit();
      },
    });

    $("#aeBack", PAGE).onclick = () => { if (!askBeforeLeaving(pendingWork())) back(); };

    // A product added here starts counted at zero rather than blank: the
    // untouched/zero distinction the count screen keeps is about coverage of a
    // visit in progress, and this visit is already closed — a line on it is a
    // number the audit now asserts.
    const addToEdit = (p) => {
      if (!p) return;
      if (!EDIT.lines[p.id]) {
        const line = blankLine(p.id, 0);
        line.status = "audited";
        line.physical = 0;
        line.countQty = 0;
        line.countUnit = baseUnit(p);
        // Rebuilt rather than assigned into, so the new id sits first in
        // insertion order — which is the order editSelected() reads back and
        // renders. See addToCount. Safe against the change check either way:
        // linesSignature sorts by product id, so a reorder is never a diff.
        EDIT.lines = Object.assign({ [p.id]: line }, EDIT.lines);
      }
      EDIT.q = "";
      EDIT.adding = false;
      renderAuditEdit();
    };
    PAGE.querySelectorAll("[data-edit-add]").forEach((b) => (b.onclick = () => addToEdit(productById(b.dataset.editAdd))));
    // Correcting a past visit hits the same wall as counting a live one: the
    // jar was on the shelf that day too. The product is created the same way
    // and joins the edit as an ordinary line, so the existing version/timeline
    // rules apply to it unchanged — creating a product is not itself an edit.
    const aeNp = $("[data-new-product]", PAGE);
    if (aeNp) aeNp.onclick = () => newProductSheet(EDIT.q.trim(), addToEdit);

    // Removal asks in the row — the existing pattern, not a new one.
    PAGE.querySelectorAll("[data-remove]").forEach((b) => (b.onclick = () => {
      PAGE.querySelectorAll(".qc-row.confirming").forEach((r) => r.classList.remove("confirming"));
      b.closest(".qc-row").classList.add("confirming");
    }));
    PAGE.querySelectorAll("[data-remove-no]").forEach((b) => (b.onclick = () => {
      b.closest(".qc-row").classList.remove("confirming");
    }));
    PAGE.querySelectorAll("[data-remove-yes]").forEach((b) => (b.onclick = () => {
      delete EDIT.lines[b.dataset.removeYes];
      renderAuditEdit();
    }));

    // In place, never a re-render — same contract as wireQuickSteppers, and
    // for the same reason: a re-render rebuilds the input being typed into.
    PAGE.querySelectorAll(".qc-row .pd-stepper").forEach((st) => {
      const p = productById(st.dataset.field);
      if (!p) return;
      const row = st.closest(".qc-row");
      const input = st.querySelector("input");
      const select = row.querySelector("[data-unit]");
      wireZeroDefault(input);
      const write = (qty, unit) => {
        const line = EDIT.lines[p.id];
        if (!line) return;
        line.countQty = qty;
        line.countUnit = unit;
        line.physical = qty * unitFactor(p, unit);
        line.conditionBreakdown = emptyCondition();
        line.conditionBreakdown.good = line.physical;
        line.status = "audited";
        input.value = qty;
        row.classList.add("done");
      };
      st.querySelectorAll("button").forEach((btn) => (btn.onclick = () => {
        const step = Number(btn.dataset.delta) || 0;
        write(Math.max(0, (Number(input.value) || 0) + step), rowUnit(row, baseUnit(p)));
      }));
      input.oninput = () => write(Math.max(0, Math.floor(Number(input.value) || 0)), rowUnit(row, baseUnit(p)));
      if (select) select.onclick = () => unitSheet(p, rowUnit(row, baseUnit(p)), (unit) => {
        setRowUnitLabels(row, unit);
        write(Number(input.value) || 0, unit);
        flashUnitSaved(row);
      });
    });

    wireEditFoot(a);
  }

  function saveAuditEdit(a) {
    const lines = editLines();
    if (!lines.length) { toast("Count at least one product first.", "info"); return; }
    // No change means no version — see commitAuditVersion.
    const changed = commitAuditVersion(a, lines);
    if (changed) {
      a.expectedProducts = Math.max(a.expectedProducts || 0, lines.length);
      AuditStore.save();
    }
    EDIT = null;
    back();
    if (changed) toast("Saved", "success");
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
                <span><span class="nm">${esc(titleCase(nameOf(c)))}</span><div class="sub">${esc(addressLine(c.adress1, c.state?.name, c.postnr))}</div></span>
              </button>`).join("")
            : `<div class="dropdown-empty">No customers found.</div>`}${previewing && allCustomers.length > rows.length ? `<div class="suggest-hint">Showing ${rows.length} of ${plural(allCustomers.length, "customer")} — keep typing to search all</div>` : ""}</div>`}
    `);

    wireSearchInput("qpQ", (v) => { QP_STATE.q = v; renderQuickPick(); }, {
      isOpen: () => QP_STATE.focused,
      // Guarded on the view because picking a customer navigates away, and the
      // deferred close would otherwise re-render a screen that has gone.
      setOpen: (v) => {
        if (CURRENT.view !== "quick-pick") return;
        QP_STATE.focused = v;
        renderQuickPick();
      },
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
    // Focusing the box offers the first 5 A-Z, whether or not products are
    // already selected. This used to be withheld once a Selected list existed,
    // to avoid burying it under an unrelated suggestion set; the rule is now
    // that a tapped search box always opens its options, and tapping away puts
    // the list straight back. Typing a query wins regardless.
    const previewing = !q && QC_STATE.focused;
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
        ${whoHTML(customer)}
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
                <span><span class="nm">${esc(p.name)}</span><div class="sub">${esc(skuText(p))}</div></span>
                <span class="add-ic" aria-hidden="true">+</span>
              </button>`).join("")
            : noProductFoundHTML()}${previewing && available.length > results.length ? `<div class="suggest-hint">Showing ${results.length} of ${plural(available.length, "product")} — keep typing to search all</div>` : ""}</div>`
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
  // name plus SKU is what a rep matches against the shelf label anyway.
  //
  // The search results ABOVE used to be the exception, on the argument that
  // picking the right product out of a catalogue is where a picture helps. It
  // is not, for this catalogue: what separates two entries here is the size and
  // the MRP inside the name — "(1000 gm) ... NEW MRP 660" against "(475 gm) ...
  // NEW MRP 325" — and every one of them is the same jar in the same photo. The
  // picture cost the name the width it needed to show the part that actually
  // distinguishes it. So there is no thumbnail on any product row in the module
  // now, and the rule has no exceptions to remember.
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
  // `lines` defaults to the live draft's, so every existing caller is
  // unchanged; Edit Audit passes its own map to get the identical row.
  // Names in this catalogue run from two words to fifteen, and a rep can create
  // one of any length at all — this is the rail for that. Shown whole up to
  // NAME_WORDS and elided after it, with the FULL name kept on the title and
  // the aria-label so nothing is actually lost.
  //
  // On a phone the CSS two-line clamp is what usually does the truncating: it
  // is width-aware and a word count is not. This bounds the pathological name,
  // not the ordinary one.
  const NAME_WORDS = 12;
  function shortName(name) {
    const words = String(name || "").trim().split(/\s+/);
    return words.length <= NAME_WORDS ? String(name || "") : words.slice(0, NAME_WORDS).join(" ") + "…";
  }

  function quickRowHTML(p, lines) {
    const line = (lines || DRAFT.lines)[p.id];
    const done = line && lineIsCaptured(line);
    const units = unitsFor(p);
    const unit = (line && line.countUnit) || baseUnit(p);
    const qty = done && line.status !== "not_found" ? line.countQty : "";
    return `
      <div class="qc-line qc-row ${done ? "done" : ""}" data-row="${esc(p.id)}">
        <div class="info">
          <div class="nm" data-product-info="${esc(p.id)}" data-product-ctx="audit" role="button" tabindex="0" title="${esc(p.name)}" aria-label="Details for ${esc(p.name)}">${esc(shortName(p.name))}</div>
          <div class="meta ask">Remove?<span class="lost"> Its count will be cleared.</span></div>
        </div>
        ${stepperHTML(p.id, qty == null ? "" : qty, unitPickHTML("data-unit", p.id, p.name, unit, units, baseUnit(p), "Counting unit"))}
        <button type="button" class="qc-remove" data-remove="${esc(p.id)}" aria-label="Remove ${esc(p.name)}">${TRASH_SVG}</button>
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
    wireSearchInput("qcQ", (v) => { QC_STATE.q = v; renderQuickCount(); }, {
      isOpen: () => QC_STATE.focused,
      setOpen: (v) => {
        if (CURRENT.view !== "quick-count") return;
        QC_STATE.focused = v;
        renderQuickCount();
      },
    });
    const addToCount = (id) => {
      // Newest on top. The rep went looking for this one, so it belongs where
      // they are already looking rather than at the far end of a list they'd
      // have to scroll to confirm the tap even landed. The order screen and
      // the edit screen add the same way, on purpose.
      if (!DRAFT.selected.includes(id)) DRAFT.selected.unshift(id);
      QC_STATE.q = "";
      persistDraft();
      renderQuickCount();
    };
    PAGE.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => addToCount(b.dataset.add)));
    // A product created here lands on the count through the SAME call a search
    // result does, which is the whole point: the row that appears is an
    // ordinary row, and the draft it appears in is the one already in progress
    // — same customer, same lines, same counts.
    const npBtn = $("[data-new-product]", PAGE);
    if (npBtn) npBtn.onclick = () => newProductSheet(QC_STATE.q.trim(), (p) => addToCount(p.id));
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
      wireZeroDefault(input);

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
        refreshQuickChrome(customer);
      };
      const set = (v) => {
        const qty = Math.max(0, Math.floor(Number(v) || 0));
        input.value = qty;
        write(qty, rowUnit(row, baseUnit(p)));
      };

      st.querySelectorAll("[data-delta]").forEach((b) => (b.onclick = () => set((Number(input.value) || 0) + Number(b.dataset.delta))));
      input.oninput = () => set(input.value);

      // Switching the unit keeps the quantity the rep entered and re-reads what
      // it means: three of something bigger. Re-counting from scratch because
      // they picked the wrong pack size is exactly the busywork this avoids.
      // On an untouched row it only records the choice — no count is invented.
      if (select) select.onclick = () => unitSheet(p, rowUnit(row, baseUnit(p)), (unit) => {
        setRowUnitLabels(row, unit);
        const line = DRAFT.lines[p.id];
        if (line && lineIsCaptured(line)) write(Number(input.value) || 0, unit);
        else ensureDraftLine(p, hasShelf).countUnit = unit;
        flashUnitSaved(row);
      });
    });
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
      center: true,
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

  // The <select> over the chip is invisible and the visible text is a .lbl
  // span, so changing the unit does not update the label by itself. One label
  // to write now that the unit is shown once, above the stepper.
  function setRowUnitLabels(row, unit) {
    const lbl = row.querySelector(".unit-pick .lbl");
    if (lbl) lbl.textContent = unit;
  }

  // FoodBridge stores NO price — see VERSION.md. The only price this catalogue
  // carries is the MRP printed in the tenant's own product names, and that is
  // also exactly what their Zoho items are priced at: 63 of the 86 names carry
  // an MRP and the other 23 sit at zero in Zoho, which is what this parser
  // finds too. So this reads a real configured price rather than inventing
  // one — and a product without an MRP reports null, so the sheet can say so
  // instead of showing a confident ₹0.
  //
  // The LAST match wins: these names are written "(OLD MRP 700) NEW MRP 660",
  // and the new price is the one that counts.
  function baseMrp(p) {
    const all = String((p && p.name) || "").match(/(?:NEW\s+MRP|MRP)\s*\.?\s*(\d+(?:\.\d+)?)/gi);
    if (!all || !all.length) return null;
    const last = all[all.length - 1].match(/(\d+(?:\.\d+)?)/);
    return last ? Number(last[1]) : null;
  }
  // A pack costs what its pieces cost — the same ladder the quantities use, so
  // the price and the count can never disagree about what a Carton is.
  function unitPrice(p, unit) {
    const base = baseMrp(p);
    return base == null ? null : base * unitFactor(p, unit);
  }
  const fmtINR = (n) =>
    "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // The unit picker, built in one place so the count row and the order row
  // cannot drift apart on it. `attr` is the hook the screen's own wiring looks
  // for — data-unit when counting, data-order-unit when ordering. It is a
  // BUTTON, not a select: tapping it opens unitSheet, where the unit is chosen
  // against the price it implies rather than blind in a native wheel.
  function unitPickHTML(attr, id, name, unit, units, base, purpose) {
    return `<button type="button" class="unit-pick" ${attr}="${esc(id)}"
        aria-label="${esc(purpose)} for ${esc(name)}: ${esc(unit)}. Tap to change.">
        <span class="lbl">${esc(unit)}</span><span class="chev" aria-hidden="true">⌄</span>
      </button>`;
  }

  // The unit a row is currently set to, read off the chip rather than held in
  // a second place that could disagree with it.
  function rowUnit(row, fallback) {
    const lbl = row && row.querySelector(".unit-pick .lbl");
    return (lbl && lbl.textContent.trim()) || fallback;
  }

  // Changing the unit changes what the number means, so it is asked in a sheet
  // that shows the consequence — the price for the pack being chosen — rather
  // than in a bare list of words. Nothing is written until Save; dismissing
  // the sheet leaves the row exactly as it was.
  function unitSheet(p, currentUnit, onSave) {
    let picked = currentUnit;

    const s2 = sheet({
      body: `
        <h2 class="us-name">${esc(p.name)}</h2>
        ${p.artNo ? `<p class="us-sku">${esc(skuText(p))}</p>` : ""}
        ${unitPriceHTML(p, picked, { price: "Current unit price", unit: "Select unit" })}`,
      // Returning false keeps the sheet open; the footer becomes the question.
      actions: [{ label: "Save", cls: "primary", onClick: () => { ask(); return false; } }],
    });

    const el = s2.el;
    const acts = el.querySelector(".sheet-acts");

    // Save is a two-tap commit made in place — the same contract Finish Audit
    // and Confirm Order use, so the footer asks rather than a second sheet
    // stacking on this one. The detail line states the actual change, because
    // "Save?" on its own is a question about nothing.
    function ask() {
      const to = unitMoney(p, picked);
      const changed = picked !== currentUnit;
      const detail = (changed ? `${currentUnit} → ${picked}` : picked) + (to ? ` · ${to}` : "");
      acts.classList.add("asking");
      acts.innerHTML = `<span class="confirm-inline">
          <span class="ci-copy">
            <span class="ci-prompt">${changed ? "Change unit?" : "Save unit?"}</span>
            <span class="ci-detail">${esc(detail)}</span>
          </span>
          <button type="button" class="ci-btn yes" id="usYes" aria-label="Confirm">✓</button>
          <button type="button" class="ci-btn no" id="usNo" aria-label="Keep editing">✗</button>
        </span>`;
      el.querySelector("#usYes").onclick = () => { onSave(picked); s2.close(); };
      el.querySelector("#usNo").onclick = restore;
    }

    function restore() {
      acts.classList.remove("asking");
      acts.innerHTML = `<button type="button" class="sheet-btn primary" id="usSave">Save</button>`;
      el.querySelector("#usSave").onclick = ask;
    }

    wireUnitPrice(el, p, (unit) => {
      picked = unit;
      // A pending question is about the OLD choice — putting Save back is
      // safer than silently re-pointing a ✓ the rep already read.
      if (acts.classList.contains("asking")) restore();
    });
  }

  // "Updated", on the row itself, for a moment. Saving a unit closes the sheet
  // and the row changes behind it; without this the rep is left looking for
  // what moved. It sits between the chip and the stepper — the row grows by
  // its height and shrinks back, which is the point: it is impossible to miss
  // and impossible to mistake for part of the row.
  function flashUnitSaved(row) {
    const col = row && row.querySelector(".qty-col");
    if (!col) return;
    col.querySelectorAll(".unit-flash").forEach((n) => n.remove());
    const b = document.createElement("span");
    b.className = "unit-flash";
    b.innerHTML = `<span class="ic" aria-hidden="true">✓</span>Updated`;
    b.setAttribute("role", "status");
    col.insertBefore(b, col.querySelector(".pd-stepper"));
    setTimeout(() => {
      b.classList.add("out");
      setTimeout(() => b.remove(), 220);
    }, 1500);
  }

  // The unit sits ABOVE the number and OUTSIDE the stepper's border, in a
  // column the two share. It used to be in two places at once — a pill inline
  // in the SKU line, and a small label stacked under the number inside the
  // stepper — which meant the row said "Pc" twice and the thing you could
  // change was the one further from the number it governed. One control now,
  // directly over the quantity it applies to.
  function stepperHTML(key, value, unitPick) {
    return `<span class="qty-col">
      ${unitPick || ""}
      <span class="pd-stepper" data-field="${esc(key)}">
        <button type="button" data-delta="-1">−</button>
        <span class="val">
          <input type="text" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" size="3" value="${value === "" || value == null ? "" : value}" placeholder="0">
        </span>
        <button type="button" data-delta="1">+</button>
      </span>
    </span>`;
  }

  // A stepper reading `0` is showing its default, not a number the rep chose,
  // and typing into it used to depend on where the tap put the caret: "12"
  // typed after the 0 normalised to 12, but typed before it landed as 120.
  //
  // Selecting the 0 on focus does NOT fix this — the browser places the caret
  // from the tap AFTER the focus handler runs and collapses the selection, so
  // a select() there (even deferred a tick) is undone by the very tap that
  // caused it. Measured, not assumed: left-edge tap → selection 0-0 → 120.
  //
  // So the first digit is intercepted instead. While the field still reads
  // exactly "0", an inserted digit REPLACES it rather than being placed at the
  // caret — which is what the placeholder already promises — with no timers
  // and no dependence on where the caret happens to be. A field holding a real
  // quantity is left completely alone, caret and all; so is a deletion, which
  // is not an insert. Assigned rather than addEventListener'd so re-wiring a
  // row cannot stack handlers, the same contract as the oninput around it.
  function wireZeroDefault(input) {
    if (!input) return;
    input.onbeforeinput = (e) => {
      if (input.value !== "0") return;
      if (!e.inputType || e.inputType.indexOf("insert") !== 0) return;
      // `data` is null for a paste, which carries its text on the transfer.
      const raw = e.data != null ? e.data : (e.dataTransfer ? e.dataTransfer.getData("text") : "");
      const typed = String(raw || "").replace(/\D/g, "");
      if (!typed) return;
      e.preventDefault();
      input.value = typed;
      // The row's own oninput does the writing — units, totals, chrome. This
      // only decided what the field says; it must not become a second writer.
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
  }

  // Lucide trash-2, inlined the way icons.js inlines the rest of this app's
  // glyphs. Removing is destructive and the bin says so; a bare × read as
  // "close" on a row that has no closed state.
  const TRASH_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;

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
                <span><span class="nm">${esc(titleCase(nameOf(c)))}</span><div class="sub">${esc(addressLine(c.adress1, c.state?.name, c.postnr))}</div></span>
              </button>`).join("")
            : `<div class="dropdown-empty">No customers found.</div>`}${previewing && allCustomers.length > rows.length ? `<div class="suggest-hint">Showing ${rows.length} of ${plural(allCustomers.length, "customer")} — keep typing to search all</div>` : ""}</div>`}
    `);

    wireSearchInput("opQ", (v) => { OP_STATE.q = v; renderOrderPick(); }, {
      isOpen: () => OP_STATE.focused,
      setOpen: (v) => {
        if (CURRENT.view !== "order-pick") return;
        OP_STATE.focused = v;
        renderOrderPick();
      },
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
  // The two-word label that used to ride here — "Stock + history" / "History
  // only" — is GONE FROM THE SCREEN. Two reasons. It said what the sheet's
  // first two lines already say, with the dates and counts attached, so on
  // screen it was a summary of something one tap away. And sitting at the far
  // edge of the heading's row it read as a status the heading was reporting,
  // not as something to open: the "i" beside it was doing all the work of
  // saying "tap me", from the one position that made it look like punctuation.
  //
  // What is left is the "i", against the heading it explains. The label
  // survives as the button's ACCESSIBLE NAME, so a screen reader still gets
  // the summary a sighted rep now gets by opening the sheet — an unlabelled
  // "i" would have been a worse trade than the one being made here.
  const basisLabel = (ctx) =>
    ctx.usedStockAudit ? "Stock + history" : "History only";

  function predictionBasisHTML(ctx) {
    return `<button type="button" class="ord-basis" id="obBasis"
        aria-label="Based on ${esc(basisLabel(ctx).toLowerCase())} — how this was calculated">
        <span class="i" aria-hidden="true">i</span>
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
    // Reads the engine's own context, in the order the engine uses it:
    // what is on the shelf, what the recent orders say the quantity is, and
    // how many orders the repeat-buying test had to look at. The last two
    // lines only appear when they have something to admit — that the history
    // is out of date, or that occasional buys were deliberately left off.
    sheet({
      title: "How this was calculated",
      body: `<div class="pb-detail-list">
        ${row(ctx.usedStockAudit, "Stock audit",
              ctx.usedStockAudit ? `${fmtDateShort(ctx.auditAt)} · ${plural(ctx.auditProductCount, "product")}` : "none")}
        ${row(ctx.usedRecentHistory, "Recent orders",
              ctx.usedRecentHistory ? plural(ctx.recentOrderCount, "order") : "none")}
        ${row(ctx.frequencyOrderCount > 0, "Repeat buying",
              ctx.frequencyOrderCount ? `checked across ${plural(ctx.frequencyOrderCount, "order")}` : "none")}
        ${ctx.historyIsStale && ctx.daysSinceLastOrder != null
            ? row(false, "History is out of date",
                  `last ordered ${plural(ctx.daysSinceLastOrder, "day")} ago`)
            : ""}
        ${ctx.belowFloorCount
            ? row(false, "Occasional buys left off",
                  `${plural(ctx.belowFloorCount, "product")} · search to add`)
            : ""}
      </div>`,
      actions: [{ label: "Close", cls: "primary" }],
    });
  }

  // One editable line: product, unit, SKU, and the quantity control. The
  // stepper's own value IS the recommendation — the section heading says so
  // once, so the row does not repeat it, and the figures behind it (expected
  // demand, the counted stock it was netted against, what was recommended
  // before the rep touched it) stay on the record without being on the
  // screen. `hasStock`/`currentStock` still ride on the line and still feed
  // the product detail sheet; they are simply not a row of their own.
  function orderRowHTML(l) {
    const p = productById(l.productId) || {};
    const units = unitsFor(p);
    const unit = l.unit || baseUnit(p);
    return `
      <div class="qc-line qc-row ord-row ${Number(l.qty) > 0 ? "done" : ""}" data-order-row="${esc(l.productId)}">
        <div class="info">
          <div class="nm" data-product-info="${esc(l.productId)}" data-product-ctx="order" role="button" tabindex="0" title="${esc(l.productName)}" aria-label="Details for ${esc(l.productName)}">${esc(shortName(l.productName))}</div>
          <div class="meta ask">Remove?</div>
        </div>
        ${stepperHTML(l.productId, l.qty == null ? "" : l.qty, unitPickHTML("data-order-unit", l.productId, l.productName, unit, units, baseUnit(p), "Ordering unit"))}
        <button type="button" class="qc-remove" data-order-remove="${esc(l.productId)}" aria-label="Remove ${esc(l.productName)}">${TRASH_SVG}</button>
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
          ${whoHTML(customer)}
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
    const previewing = orderPreviewing();
    const searching = orderSearching();
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
        ${whoHTML(customer)}
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
                <span><span class="nm">${esc(p.name)}</span><div class="sub">${esc(skuText(p))}</div></span>
                <span class="add-ic" aria-hidden="true">+</span>
              </button>`).join("")
            : `<div class="dropdown-empty">No product matches that.</div>`}${previewing && available.length > results.length ? `<div class="suggest-hint">Showing ${results.length} of ${plural(available.length, "product")} — keep typing to search all</div>` : ""}</div>`
        : `${ORDER.lines.length ? `<div class="section-head-row attached"><h2>${recommended ? "Recommended" : "Products"}</h2>${recommended ? predictionBasisHTML(ctx) : ""}</div>` : ""}
           ${ORDER.lines.length
              ? `<div class="qc-card">${ORDER.lines.map(orderRowHTML).join("")}</div>`
              : orderEmptyStateHTML()}`}
    `, { foot: `<div class="sah-foot ws-foot"><div class="inner" id="obFoot">${orderFootHTML()}</div></div>` });

    wireOrderBuild(customer);
  }

  // The sticky footer, in its two states — the same two-tap commit the audit
  // uses to finish a count (see quickFootHTML). Confirming is a decision made
  // in place, against the list the rep is already looking at; a separate
  // review screen re-listed what was on screen a moment ago and put the
  // quantities a tap further away when the answer was "no, change one".
  // Two ways to an empty-query dropdown: the rep asked for one ("+ Add
  // Product"), or the search box has focus. The second used to be withheld
  // once the order had lines, so a suggestion set could not bury them; a
  // focused search box now always opens its options, and tapping away puts the
  // lines back. Shared by the view and the footer so the Add button can never
  // be offered on top of the very dropdown it opens.
  const orderPreviewing = () =>
    !OB_STATE.q.trim() && (OB_STATE.adding || OB_STATE.focused);
  const orderSearching = () => !!OB_STATE.q.trim() || orderPreviewing();

  function orderFootHTML() {
    const t = orderTotals(ORDER.lines);
    if (ORDER.committing) {
      return `<button type="button" class="btn-wide primary" disabled>Creating order…</button>`;
    }
    if (!OB_CONFIRM) {
      // Same move as Edit Audit's, for the same reason — see editFootHTML.
      return `${orderSearching() ? "" : `<button type="button" class="btn-add" id="obAdd">+ Add Product</button>`}
        <button type="button" class="btn-wide primary" id="obConfirm" ${t.products ? "" : "disabled"}>Confirm Order</button>`;
    }
    return `<span class="confirm-inline">
        <span class="ci-copy">
          <span class="ci-prompt">Confirm order?</span>
          <span class="ci-detail">${esc(plural(t.products, "product"))} · ${esc(plural(t.units, "unit"))} · FoodBridge → Accounts</span>
        </span>
        <button type="button" class="ci-btn yes" id="obYes" aria-label="Confirm order">✓</button>
        <button type="button" class="ci-btn no" id="obNo" aria-label="Keep editing">✗</button>
      </span>`;
  }

  function wireOrderBuild(customer) {
    wireSearchInput("obQ", (v) => { OB_STATE.q = v; renderOrderBuild(); }, {
      isOpen: () => OB_STATE.focused || OB_STATE.adding,
      // Closing clears the explicit "+ Add Product" request too, or the
      // dropdown it opened would survive the tap that dismissed it.
      setOpen: (v) => {
        if (CURRENT.view !== "order-build") return;
        OB_STATE.focused = v;
        if (!v) OB_STATE.adding = false;
        renderOrderBuild();
      },
    });

    PAGE.querySelectorAll("[data-order-add]").forEach((b) => (b.onclick = () => {
      const p = productById(b.dataset.orderAdd);
      if (!p) return;
      if (!ORDER.lines.some((l) => l.productId === p.id)) {
        const known = Object.prototype.hasOwnProperty.call(ORDER.stockMap, p.id);
        // On top, above the recommendations — see addToCount. What the engine
        // proposed is still all there underneath; this is the line the rep is
        // about to put a quantity on, so it leads.
        ORDER.lines.unshift(orderLineFromProduct(p, known ? ORDER.stockMap[p.id] : null));
      }
      // Picking one answers the "add" the button asked, so the dropdown
      // gives the list back rather than staying open over it.
      OB_STATE.q = "";
      OB_STATE.adding = false;
      renderOrderBuild();
    }));

    // The ordering unit. Only the label and the line's own `unit` change —
    // `qty` is the number the rep typed and stays theirs, so "3" under a
    // switch from Pc to Carton means three cartons, which is exactly what the
    // order record and the accounts payload then carry.
    PAGE.querySelectorAll("[data-order-unit]").forEach((btn) => (btn.onclick = () => {
      const line = ORDER.lines.find((x) => x.productId === btn.dataset.orderUnit);
      const p = productById(btn.dataset.orderUnit);
      if (!line || !p) return;
      const row = btn.closest(".qc-row");
      unitSheet(p, rowUnit(row, baseUnit(p)), (unit) => {
        line.unit = unit;
        setRowUnitLabels(row, unit);
        flashUnitSaved(row);
      });
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
      wireZeroDefault(input);
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

    const back = $("#obBack", PAGE);
    if (back) back.onclick = () => exitOrderSheet();

    wireOrderFoot(customer);
  }

  // Re-wired on every footer swap, since the footer replaces its own markup.
  function wireOrderFoot(customer) {
    // Add lives in the footer now, so it is re-bound here rather than in
    // wireOrderBuild — the footer replaces its own markup on every refresh.
    const add = $("#obAdd", PAGE);
    if (add) add.onclick = () => {
      OB_STATE.focused = true;
      OB_STATE.adding = true;
      renderOrderBuild();
      const box = $("#obQ", PAGE);
      if (box) box.focus();
    };
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
      center: true,
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
          usedRecentHistory: !!ctx.usedRecentHistory,
          // Enough of the engine's own state to re-read this decision later:
          // how many orders each of the two tests saw, whether the history
          // was already stale when it ran, and how many products the repeat-
          // buying floor held back.
          recentOrderCount: ctx.recentOrderCount || 0,
          frequencyOrderCount: ctx.frequencyOrderCount || 0,
          historyIsStale: !!ctx.historyIsStale,
          daysSinceLastOrder: ctx.daysSinceLastOrder == null ? null : ctx.daysSinceLastOrder,
          belowFloorCount: ctx.belowFloorCount || 0,
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
        sub: "Nothing was sent to accounts. Please try again.",
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
          zohoError: (err && err.message) || "Invoice could not be created.",
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
        <h1>${syncing ? "Accounts sync in progress" : "Order Created"}</h1>
      </div>

      <div class="cd-card ord-refs">
        <div class="ref-row">
          <span class="lbl">FoodBridge</span>
          <span class="val">${esc(order.id)}</span>
          <span class="status-tag ok">Created</span>
        </div>
        <div class="ref-row">
          <span class="lbl">Invoice</span>
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
        ${needsRetry ? `<button type="button" class="btn-wide ghost" id="osRetry">Retry Sync</button>` : ""}
        ${done && order.zohoUrl
          // Only when the function supplied a URL for this tenant. Zoho's API
          // returns none and nothing here invents one, so an unconfigured
          // deployment simply shows the number.
          ? `<a class="btn-wide ghost" id="osOpen" href="${esc(order.zohoUrl)}" target="_blank" rel="noopener">Open Invoice</a>`
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

  /* ------------------------------------------------- product info, wired once */

  // The whole of "tap a product, see the product" is this one listener. PAGE
  // is created once at mount and every render only replaces its innerHTML, so
  // a listener bound here outlives all of them — which is the point: the
  // screens that name products re-render constantly (every keystroke in a
  // search box rebuilds the list), and a per-row handler is a handler to
  // rebind on each of those.
  //
  // CAPTURE phase, and it stops the event. Two of the surfaces put the product
  // name inside a control that already does something with a click — the
  // picker rows ARE the "add this product" button — so the sheet has to claim
  // the click before it reaches them, or tapping a name to read about a
  // product would silently add it to the audit instead.
  //
  // Keyboard: the marked elements are spans and divs inside existing rows
  // rather than nested buttons (which the picker rows, being buttons
  // themselves, cannot legally contain), so they carry role="button" and
  // tabindex and this supplies the Enter/Space that a real button would have
  // given for free.
  //
  // The workspace header's customer name rides on the same mechanism, for the
  // same reason: those headers are rebuilt on every progress tick.
  function wireInfoTaps() {
    const open = (e) => {
      const who = e.target.closest && e.target.closest("[data-customer-name]");
      if (who) {
        e.preventDefault();
        e.stopPropagation();
        customerNameSheet(who.dataset.customerName);
        return;
      }
      const hit = e.target.closest && e.target.closest("[data-product-info]");
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      productDetailSheet(hit.dataset.productInfo, hit.dataset.productCtx || "");
    };
    PAGE.addEventListener("click", open, true);
    PAGE.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      // A real <button> — which is what the customer name is, since nothing
      // here forbids one — already turns Enter/Space into a click, and letting
      // this fire too would open the sheet, tear it down and reopen it. This
      // branch exists for the role="button" spans that get no such help.
      if (e.target.tagName === "BUTTON") return;
      open(e);
    }, true);
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
    wireInfoTaps();
    trackKeyboardInset();
    keepFocusVisible();
    // First: a saved draft or audit may reference a product a rep added on an
    // earlier visit, and productById has to find it.
    CatalogueStore.load();
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

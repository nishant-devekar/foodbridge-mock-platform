/* ==========================================================================
   DELIVERY MANAGEMENT — router, app state, mount

   The real app is a React Router SPA mounted at /route-delivery. This is the
   same route table driven by the URL hash instead, so a screen is linkable and
   the browser's Back button works — which matters, because the app's own back
   arrows are the only way out of most screens.

     region        app source
     ------------  --------------------------------------------------------
     route table   route-delivery-app/RouteApp.jsx
     phase gating  route-delivery-app/components/PhaseGate.jsx
     session/priv  route-delivery-app/context/RouteDeliveryContext.jsx

   HASH, NOT PATH: the module is served from a static host with no rewrite
   rules, so /route-delivery/queue/RTE-001 would 404 on reload. Hash routing
   survives a reload from any screen. It also nests cleanly inside the platform
   shell, which is itself hash-routed in the parent document.

   SCREENS REGISTER THEMSELVES: each delivery-*.js file calls RD.screen(name, fn)
   at load, so adding a screen never means editing this file.
   ========================================================================== */

(function () {
  "use strict";

  const U = window.RD_UI;

  /* ── State ─────────────────────────────────────────────────────────────── */
  // Deliberately a plain object, not a store. Everything that persists lives in
  // the seed db (RD_DB); this only holds what the *view* is doing right now —
  // which screen, which filters, which sheet is open.
  const state = {
    route: null,          // { name, params }
    routeId: null,
    stopId: null,
    // Home filters
    search: "",
    statusFilter: null,
    // The dashboard opens on today, not on everything: QA mounts its date
    // filter at TODAY (HomeDashboard useState(TODAY)), so the chip reads
    // "Today" with its clear ✕, the section header reads "Today's Routes", and
    // the list is already filtered before the driver touches anything. Verified
    // against QA on a hard reload, which is the only way to see the mount
    // state — an SPA that has been navigated around keeps whatever the last
    // screen left behind, and reading that is what got this wrong before.
    dateFilter: window.RD_UI.toLocalDateStr(new Date()),
    // Per-screen scratch space, cleared on navigation.
    scratch: {},
    // The home button's confirmation sheet (ui.jsx HomeMenuButton). Lives on
    // state, not scratch: it must survive the re-render that opens it.
    homeConfirm: false,
    toast: null,
  };

  const screens = {};
  function screen(name, render) { screens[name] = render; }

  /* ── Route table (RouteApp.jsx) ────────────────────────────────────────── */
  // Longest-first: '/settlement/stock/:routeId' must win over '/settlement/:routeId'.
  const ROUTES = [
    ["",                                  "home"],
    ["/pre-start/:routeId",               "preStart"],
    ["/load-stock/:routeId",              "loadStock"],
    ["/opening-cash/:routeId",            "openingCash"],
    ["/sign-off/:routeId",                "signOff"],
    ["/queue/:routeId",                   "queue"],
    ["/delivery/:routeId/:stopId",        "atCustomer"],
    ["/payment-success/:routeId/:stopId", "paymentSuccess"],
    ["/payment/:routeId/:stopId",         "payment"],
    ["/skip-stop/:routeId/:stopId",       "skipStop"],
    ["/new-customer/:routeId",            "newCustomer"],
    ["/stop-summary/:routeId/:stopId",    "stopSummary"],
    ["/settlement/stock/:routeId",        "stockCount"],
    ["/settlement/cash/:routeId",         "cashHandover"],
    ["/settlement/:routeId",              "settlement"],
    ["/return-acceptance/:routeId",       "returnAcceptance"],
    ["/manage-assets/:routeId/:stopId",   "manageAssets"],
    ["/manage-assets/:routeId",           "manageAssets"],
    ["/restock-load/:routeId",            "restockLoad"],
    ["/restock-success/:routeId",         "restockSuccess"],
    ["/restock/:routeId",                 "restock"],
    ["/reports",                          "reports"],
    ["/closed/:routeId",                  "closed"],
    ["/analytics/:routeId",               "analytics"],
  ];

  function matchRoute(path) {
    for (const [pattern, name] of ROUTES) {
      const pp = pattern.split("/").filter(Boolean);
      const ap = path.split("/").filter(Boolean);
      if (pp.length !== ap.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < pp.length; i++) {
        if (pp[i][0] === ":") params[pp[i].slice(1)] = decodeURIComponent(ap[i]);
        else if (pp[i] !== ap[i]) { ok = false; break; }
      }
      if (ok) return { name, params };
    }
    return null;
  }

  function go(path) {
    // Always through the hash so Back works and a screen stays linkable.
    window.location.hash = path ? "#" + path : "#";
  }

  function back() {
    if (window.history.length > 1) window.history.back();
    else go("");
  }

  /* ── Commit ────────────────────────────────────────────────────────────── */
  // QA's ConfirmPanel does not act the instant the commit card is tapped: it
  // swaps itself for a processing block while the write is in flight and only
  // then moves on. Offline there is no write to wait for, so the delay is a
  // stand-in for the round trip — without it the block would flash for a frame
  // and the screen would read as if it had skipped a step.
  const COMMIT_MS = 900;

  function commit(work) {
    if (state.scratch.committing) return;
    state.scratch.committing = true;
    render();
    setTimeout(function () { state.scratch.committing = false; work(); }, COMMIT_MS);
  }

  /* ── Toast ─────────────────────────────────────────────────────────────── */
  // Upstream uses react-toastify. One transient message at a time is all the
  // screens actually raise, so this is a div rather than a queue.
  let toastTimer = null;
  function toast(message, kind) {
    state.toast = { message: message, kind: kind || "success" };
    render();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { state.toast = null; render(); }, 2600);
  }

  function renderToast() {
    if (!state.toast) return "";
    const bg = state.toast.kind === "error" ? "#dc2626" : "#111";
    return '<div style="' + U.sty({
      position: "absolute", left: 16, right: 16, bottom: 74, zIndex: 60,
      background: bg, color: "white", padding: "12px 16px", borderRadius: 12,
      fontSize: 14, fontWeight: 600, boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
      textAlign: "center",
    }) + '">' + U.esc(state.toast.message) + "</div>";
  }

  /* ── Render ────────────────────────────────────────────────────────────── */
  let rootEl = null;

  function render() {
    if (!rootEl) return;
    const r = state.route;
    const fn = r && screens[r.name];
    let body;
    if (!fn) {
      body = U.EmptyState("🚧", "Screen not built yet",
        "This part of the flow is still being ported. Use Back to return.") +
        '<div style="padding:0 12px">' + U.BtnXL({ variant: "outline", label: "← Back", actName: "back" }) + "</div>";
    } else {
      try {
        body = fn(r.params || {});
      } catch (err) {
        // A screen throwing must not blank the whole app — show it instead, so
        // a half-ported screen is obvious rather than mysteriously empty.
        body = U.ErrorState(err && err.message ? err.message : String(err));
        if (window.console) console.error("[delivery] screen '" + r.name + "' failed:", err);
      }
    }
    rootEl.innerHTML = '<div class="rd-screen">' + body + renderToast() + "</div>";
  }

  /* ── Events ────────────────────────────────────────────────────────────── */
  // One delegated listener for the whole app. Screens declare intent with
  // data-act/data-arg (see RD_UI.act) instead of binding their own handlers,
  // so a re-render can never leave a stale listener behind.
  const actions = {};
  function action(name, fn) { actions[name] = fn; }

  action("back", back);
  action("home", function () { go(""); });

  // Leaving mid-route asks first, exactly as QA does.
  action("home-confirm-open",  function () { state.homeConfirm = true;  render(); });
  action("home-confirm-close", function () { state.homeConfirm = false; render(); });
  action("home-confirm-go",    function () { state.homeConfirm = false; go(""); });
  action("retry", function () { render(); });
  action("tab", function (which) {
    if (which === "home") go("");
    else if (which === "reports") go("/reports");
    else if (which === "back") back();
    else toast(which === "routes" ? "Routes tab — not in this prototype" : "Follow-up tab — not in this prototype");
  });

  function onClick(e) {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const name = el.getAttribute("data-act");
    const fn = actions[name];
    if (!fn) return;
    let arg = el.getAttribute("data-arg");
    if (arg && (arg[0] === "{" || arg[0] === "[")) { try { arg = JSON.parse(arg); } catch (_) {} }
    e.preventDefault();
    fn(arg, el, e);
  }

  // Inputs report through data-model so a screen can keep typed text across a
  // re-render without each one wiring its own listener.
  // Inputs report through data-model. An exact handler wins; otherwise a
  // trailing -<key> is peeled off and passed to a wildcard handler, so a screen
  // with one input per row registers ONE handler ("model:count#") instead of a
  // handler per index. Without this, typed values in per-row fields silently go
  // nowhere — the field shows the digits and the state never hears about them.
  function onInput(e) {
    const el = e.target.closest("[data-model]");
    if (!el) return;
    const path = el.getAttribute("data-model");
    const exact = actions["model:" + path];
    if (exact) { exact(el.value, el); return; }
    // Try each hyphen from the left and take the first prefix that has a
    // wildcard handler. Splitting on the LAST hyphen breaks every key that
    // contains one — "give-AST-CRATE-L" resolved to base "give-AST-CRATE",
    // which nothing handles, so asset quantities silently went nowhere.
    // Left-to-right also keeps "stock-qty-0" working, where the base is two
    // segments long.
    for (let i = path.indexOf("-"); i > 0; i = path.indexOf("-", i + 1)) {
      const wild = actions["model:" + path.slice(0, i) + "#"];
      if (wild) { wild(el.value, path.slice(i + 1), el); return; }
    }
  }

  /* ── Boot ──────────────────────────────────────────────────────────────── */
  function onHashChange() {
    const raw = (window.location.hash || "").replace(/^#/, "");
    const matched = matchRoute(raw);
    if (!matched) { go(""); return; }
    // Navigating away clears per-screen scratch; screens must not rely on it
    // surviving, and anything that should survive belongs in the seed db.
    if (!state.route || state.route.name !== matched.name ||
        JSON.stringify(state.route.params) !== JSON.stringify(matched.params)) {
      state.scratch = {};
    }
    // A sheet raised on the screen you are leaving does not follow you to the
    // next one — QA unmounts it with the screen.
    state.homeConfirm = false;
    // The standalone-collection flag is a property of the payment screens QA
    // pushes it into, so leaving them drops it (React drops the nav state).
    if (matched.name !== "payment" && matched.name !== "paymentSuccess") {
      state.payOutstanding = false;
      state.outstandingPayment = null;
    }
    state.route = matched;
    state.routeId = matched.params.routeId || null;
    state.stopId = matched.params.stopId || null;
    render();
    const body = rootEl && rootEl.querySelector(".rd-body");
    if (body) body.scrollTop = 0;
  }

  // An anchored menu closes on a press outside it or on Escape, the way QA's
  // does (CustomerQueue's QueueActionsMenu listens on document, not on itself).
  function closeMenusOnOutside(e) {
    if (!state.scratch.queueMenu) return;
    const t = e.target;
    if (t && t.closest && (t.closest('[role="menu"]') || t.closest('[data-act="queue-menu"]'))) return;
    state.scratch.queueMenu = false;
    render();
  }

  function closeMenusOnEscape(e) {
    if (e.key !== "Escape" || !state.scratch.queueMenu) return;
    state.scratch.queueMenu = false;
    render();
  }

  function mount(el) {
    rootEl = el || document.getElementById("app");
    rootEl.addEventListener("click", onClick);
    rootEl.addEventListener("input", onInput);
    document.addEventListener("pointerdown", closeMenusOnOutside);
    document.addEventListener("keydown", closeMenusOnEscape);
    window.addEventListener("hashchange", onHashChange);
    onHashChange();
  }

  window.RD = {
    state: state, screen: screen, action: action, actions: actions,
    go: go, back: back, render: render, toast: toast, mount: mount, commit: commit,
  };
})();

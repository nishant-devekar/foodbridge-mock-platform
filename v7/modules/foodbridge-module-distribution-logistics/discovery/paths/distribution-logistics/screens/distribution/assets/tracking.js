/*
 * Live Delivery Tracking — the office's view of the day while it is happening.
 *
 * Registers itself as window.FBTrack; app.js calls FBTrack.screen() from
 * FB.mount("live-tracking"). Kept in its own file so app.js stays the shell and
 * the three original screens.
 *
 * Reads window.TRACK (tracking-data.js). Mutates it in place and re-renders —
 * same contract as the other screens in this module.
 *
 * Design decisions and divergences are recorded in
 * ../../../instructions/addendum-004-live-delivery-tracking.md.
 */
(function () {
  "use strict";

  const T = () => window.TRACK;

  /* ── Small helpers (app.js keeps its own inside a closure) ──────────────── */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  function toast(msg, tone) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.className = "toast show" + (tone ? " " + tone : "");
    t.textContent = msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.className = "toast"), 2600);
  }

  /* Times are "HH:MM" strings throughout, matching the delivery app's seed. */
  const toMin = (hhmm) => { if (!hhmm) return null; const p = String(hhmm).split(":"); return +p[0] * 60 + +p[1]; };
  const toHHMM = (m) => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };

  /* ── Derived state ───────────────────────────────────────────────────────
     Everything the UI shows is computed from the seed, never stored twice, so
     an intervention that mutates a stop is reflected everywhere at once. */

  function stats(r) {
    const delivered = r.stops.filter((s) => s.status === "delivered").length;
    const skipped = r.stops.filter((s) => s.status === "skipped").length;
    const pending = r.stops.filter((s) => s.status === "pending").length;
    const collected = r.stops.reduce((a, s) => a + (s.collected || 0), 0);
    const billed = r.stops.filter((s) => s.status === "delivered").reduce((a, s) => a + (s.amount || 0), 0);
    const outstanding = billed - collected;
    const sold = r.stops.filter((s) => s.status === "delivered").reduce((a, s) => a + (s.items || 0), 0);
    return { delivered, skipped, pending, collected, billed, outstanding, sold, done: delivered + skipped, total: r.stops.length };
  }

  /* Schedule delta, in minutes, from the last stop the driver actually completed.
     Positive = behind. This mirrors how route-monitoring tools express lateness:
     planned vs actual on a real event, not a guess. */
  function delta(r) {
    const done = r.stops.filter((s) => s.actualAt);
    if (!done.length) return 0;
    const last = done[done.length - 1];
    return toMin(last.actualAt) - toMin(last.plannedAt);
  }

  /* Straight-line ETA for the next pending stop (divergence V4). */
  function etaNext(r) {
    const next = r.stops.find((s) => s.status === "pending");
    if (!next) return null;
    const d = delta(r);
    return toHHMM(toMin(next.plannedAt) + d);
  }

  const STAGE = {
    ready: { label: "Ready", tone: "grey" },
    loading: { label: "Loading stock", tone: "blue" },
    "on-route": { label: "On route", tone: "green" },
    settling: { label: "Settling", tone: "amber" },
    done: { label: "Settled", tone: "grey" },
  };

  /* A route's health — this is what colours the van on the map (decision D3). */
  function health(r) {
    if (r.lastPingMin >= 15) return "offline";
    if (r.stage === "on-route" && r.speedKmph === 0) return "idle";
    if (delta(r) >= 10) return "behind";
    return "ok";
  }
  const HEALTH = {
    ok: { label: "On time", cls: "ok" },
    behind: { label: "Behind", cls: "behind" },
    idle: { label: "Idle", cls: "idle" },
    offline: { label: "No signal", cls: "offline" },
  };

  /* ── Exceptions — the hero tier (decision D2) ────────────────────────────
     "What needs attention now?" Each one names the route it belongs to so a
     click can focus it. Acknowledged exceptions drop out. */
  function exceptions() {
    const out = [];
    T().routes.forEach((r) => {
      if (r._ack) return;
      const d = delta(r);
      if (r.lastPingMin >= 15) out.push({ routeId: r.id, sev: "high", icon: "signal", text: `${r.driver} — no ping for ${r.lastPingMin} min` });
      else if (r.stage === "on-route" && r.speedKmph === 0) out.push({ routeId: r.id, sev: "med", icon: "idle", text: `${r.driver} — van idle at stop` });
      if (d >= 10) out.push({ routeId: r.id, sev: d >= 20 ? "high" : "med", icon: "clock", text: `${r.name} — ${d} min behind` });
      const skipped = r.stops.filter((s) => s.status === "skipped");
      skipped.forEach((s) => out.push({ routeId: r.id, sev: "high", icon: "skip", text: `${s.name} — skipped` }));
      const st = stats(r);
      if (st.outstanding > 0) out.push({ routeId: r.id, sev: "med", icon: "cash", text: `${r.name} — ${money(st.outstanding)} uncollected` });
      if (r.stage === "settling" && r.settlement && !r.settlement.cashHandover) out.push({ routeId: r.id, sev: "med", icon: "cash", text: `${r.driver} — cash handover pending` });
    });
    return out.sort((a, b) => (a.sev === "high" ? -1 : 1) - (b.sev === "high" ? -1 : 1));
  }

  const ICO = {
    signal: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8"/><path d="m2 2 20 20"/></svg>',
    idle: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    skip: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>',
    cash: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>',
    phone: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
    msg: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.2a8.4 8.4 0 0 1 3.6-11.4 8.4 8.4 0 0 1 12.5 7.1z"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    up: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
    list: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    target: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="2.5"/></svg>',
    move: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  };

  /* ── Rail ────────────────────────────────────────────────────────────────
     One card per route. The stop-sequence bar (decision D4) is the payload:
     one segment per stop, coloured by outcome, so a whole day reads at once. */
  function seqBar(r) {
    const nextId = (r.stops.find((s) => s.status === "pending") || {}).id;
    return (
      '<div class="tk-seq" role="img" aria-label="' + stats(r).done + " of " + r.stops.length + ' stops complete">' +
      r.stops
        .map((s) => {
          let cls = "pend";
          if (s.status === "delivered") cls = "done";
          else if (s.status === "skipped") cls = "skip";
          else if (s.id === nextId && r.stage === "on-route") cls = "now";
          return '<i class="' + cls + '" title="' + esc(s.seq + ". " + s.name) + '"></i>';
        })
        .join("") +
      "</div>"
    );
  }

  function railCard(r) {
    const st = stats(r);
    const h = health(r);
    const d = delta(r);
    const active = state.selected === r.id;
    const stage = STAGE[r.stage] || STAGE.ready;
    const eta = etaNext(r);
    return (
      '<button class="tk-card' + (active ? " active" : "") + '" data-route="' + r.id + '">' +
      '<div class="tk-card-top">' +
      '<span class="tk-av ' + h + '">' + esc(initials(r.driver)) + "</span>" +
      '<span class="tk-card-id"><b>' + esc(r.name) + "</b><small>" + esc(r.driver) + " · " + esc(r.vehicle) + "</small></span>" +
      '<span class="tk-stage ' + stage.tone + '">' + stage.label + "</span>" +
      "</div>" +
      seqBar(r) +
      '<div class="tk-card-foot">' +
      '<span class="tk-h ' + HEALTH[h].cls + '">' + HEALTH[h].label + (h === "behind" ? " " + d + "m" : "") + "</span>" +
      "<span>" + st.done + "/" + st.total + " stops</span>" +
      "<span>" + money(st.collected) + "</span>" +
      (eta ? '<span class="tk-eta">next ' + eta + "</span>" : "") +
      "</div>" +
      "</button>"
    );
  }

  /* ── Map (decision D7) ───────────────────────────────────────────────────
     Leaflet + OpenStreetMap. Markers are divIcons so they can be styled by
     state in CSS rather than shipping a sprite per status. */
  let map = null;
  const layers = { vans: {}, routes: {}, stops: {} };

  function ensureMap() {
    if (map || !window.L) return;
    const el = document.getElementById("tkMap");
    if (!el) return;
    map = L.map(el, { zoomControl: true, attributionControl: true }).setView([18.5619, 73.9143], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    L.marker([T().depot.lat, T().depot.lng], {
      icon: L.divIcon({ className: "tk-depot-ic", html: '<span class="tk-depot"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
    })
      .addTo(map)
      .bindTooltip(T().depot.name, { direction: "top" });
  }

  /* Interpolate the van along its stop chain by `progress` (divergence V1). */
  function vanPos(r) {
    const pts = [[T().depot.lat, T().depot.lng]].concat(r.stops.map((s) => [s.lat, s.lng]));
    if (r.progress <= 0) return pts[0];
    if (r.progress >= 1) return pts[pts.length - 1];
    const span = 1 / (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(r.progress / span));
    const f = (r.progress - i * span) / span;
    return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
  }

  function drawMap() {
    ensureMap();
    if (!map) return;
    const shown = T().routes.filter((r) => !state.selected || state.selected === r.id);

    Object.values(layers.routes).forEach((l) => map.removeLayer(l));
    Object.values(layers.vans).forEach((l) => map.removeLayer(l));
    Object.values(layers.stops).forEach((g) => g.forEach((l) => map.removeLayer(l)));
    layers.routes = {}; layers.vans = {}; layers.stops = {};

    shown.forEach((r) => {
      const h = health(r);
      const pts = [[T().depot.lat, T().depot.lng]].concat(r.stops.map((s) => [s.lat, s.lng]));
      layers.routes[r.id] = L.polyline(pts, {
        color: h === "ok" ? "#10b981" : h === "behind" ? "#ef4444" : "#f59e0b",
        weight: state.selected === r.id ? 4 : 3,
        opacity: state.selected === r.id ? 0.9 : 0.45,
        dashArray: "8 6",
      }).addTo(map);

      layers.stops[r.id] = r.stops.map((s) =>
        L.marker([s.lat, s.lng], {
          icon: L.divIcon({
            className: "tk-stop-ic",
            html: '<span class="tk-stop ' + s.status + '">' + s.seq + "</span>",
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
        })
          .addTo(map)
          .bindTooltip(
            "<b>" + esc(s.name) + "</b><br>" + (s.status === "pending" ? "planned " + s.plannedAt : s.status + " at " + (s.actualAt || "—")),
            { direction: "top" }
          )
          .on("click", () => openDrawer(r.id, s.id))
      );

      const p = vanPos(r);
      layers.vans[r.id] = L.marker(p, {
        zIndexOffset: 500,
        icon: L.divIcon({
          className: "tk-van-ic",
          html: '<span class="tk-van ' + h + '" title="' + esc(r.driver) + '"></span>',
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      })
        .addTo(map)
        .bindTooltip("<b>" + esc(r.driver) + "</b><br>" + esc(r.name), { direction: "top" })
        .on("click", () => openDrawer(r.id));
    });

    /* Frame what is actually on screen. Without this the map opens at its
       default zoom and every van sits in one unreadable clump in the middle. */
    if (!state._framed || state.selected !== state._framedFor) {
      const group = shown.map((r) => layers.routes[r.id]).filter(Boolean);
      if (group.length) {
        const b = group.reduce((acc, l) => (acc ? acc.extend(l.getBounds()) : L.latLngBounds(l.getBounds())), null);
        map.fitBounds(b, { padding: [50, 50], maxZoom: state.selected ? 15 : 13 });
      }
      state._framed = true;
      state._framedFor = state.selected;
    }
  }

  /* ── Drawer — the drill-down (decision D5) ──────────────────────────────── */
  function ladder(rows) {
    return '<div class="tk-ladder">' + rows.map((r) => '<div class="' + (r.strong ? "strong" : "") + '"><span>' + esc(r.l) + "</span><b>" + r.v + "</b></div>").join("") + "</div>";
  }


  /* Reassign picker — an inline list of candidate routes. Replaces a
     window.prompt: prompts are blocked in some embedded contexts, and this
     screen is embedded in the mock platform. */
  function reassignPicker(r, s) {
    if (state.reassign !== s.id) return "";
    const others = T().routes.filter((x) => x.id !== r.id && x.stage !== "done" && x.stage !== "settling");
    if (!others.length) return '<div class="tk-pick"><span class="tk-empty">No other active route to take this stop.</span></div>';
    return (
      '<div class="tk-pick"><b>Move to</b>' +
      others
        .map((o) => '<button class="tk-pick-row" data-act="reassign-to" data-stop="' + s.id + '" data-arg="' + o.id + '">' +
          "<span>" + esc(o.name) + "</span><small>" + esc(o.driver) + " · " + o.stops.length + " stops</small></button>")
        .join("") +
      '<button class="tk-mini" data-act="reassign-cancel" data-stop="' + s.id + '">Cancel</button></div>'
    );
  }

  function openDrawer(routeId, focusStopId) {
    if (routeId !== state.drawer) { state.reassign = null; state.composing = false; }
    state.drawer = routeId;
    state.focusStop = focusStopId || null;
    render();
  }

  function drawerHtml() {
    if (!state.drawer) return "";
    const r = T().routes.find((x) => x.id === state.drawer);
    if (!r) return "";
    const st = stats(r);
    const h = health(r);
    const msgs = T().messages.filter((m) => m.routeId === r.id);

    const timeline = r.stops
      .map((s) => {
        const late = s.actualAt ? toMin(s.actualAt) - toMin(s.plannedAt) : null;
        const lateTxt = late === null ? "" : late > 0 ? '<em class="late">+' + late + "m</em>" : late < 0 ? '<em class="early">' + late + "m</em>" : '<em class="ontime">on time</em>';
        return (
          '<li class="tk-tl ' + s.status + (state.focusStop === s.id ? " focus" : "") + '" data-stop="' + s.id + '">' +
          '<span class="tk-tl-dot">' + s.seq + "</span>" +
          '<div class="tk-tl-body">' +
          '<div class="tk-tl-hd"><b>' + esc(s.name) + "</b>" + (s.amount ? "<span>" + money(s.amount) + "</span>" : "") + "</div>" +
          '<div class="tk-tl-meta">planned ' + esc(s.plannedAt) + (s.actualAt ? " · actual " + esc(s.actualAt) + " " + lateTxt : "") +
          (s.paymentMode ? " · " + esc(s.paymentMode) : "") + (s.items ? " · " + s.items + " items" : "") + "</div>" +
          (s.note ? '<div class="tk-tl-note">' + esc(s.note) + "</div>" : "") +
          (s.status === "pending"
            ? '<div class="tk-tl-acts">' +
              '<button class="tk-mini" data-act="up" data-stop="' + s.id + '">' + ICO.up + " Move up</button>" +
              '<button class="tk-mini" data-act="skip" data-stop="' + s.id + '">' + ICO.skip + " Mark skipped</button>" +
              '<button class="tk-mini' + (state.reassign === s.id ? " on" : "") + '" data-act="reassign" data-stop="' + s.id + '">' + ICO.move + " Reassign</button>" +
              "</div>" + reassignPicker(r, s)
            : "") +
          "</div></li>"
        );
      })
      .join("");

    return (
      '<div class="tk-drawer-scrim" data-close></div>' +
      '<aside class="tk-drawer" role="dialog" aria-modal="true" aria-label="Route detail">' +
      '<header class="tk-dr-head">' +
      '<span class="tk-av ' + h + '">' + esc(initials(r.driver)) + "</span>" +
      "<div><b>" + esc(r.name) + "</b><small>" + esc(r.driver) + " · " + esc(r.vehicle) + " · last ping " + r.lastPingMin + "m ago</small></div>" +
      '<button class="tk-close" data-close aria-label="Close">' + ICO.x + "</button>" +
      "</header>" +

      '<div class="tk-dr-acts">' +
      '<button class="btn" data-act="call">' + ICO.phone + " Call</button>" +
      '<button class="btn" data-act="message">' + ICO.msg + " Message</button>" +
      '<button class="btn" data-act="ack">Acknowledge alerts</button>' +
      "</div>" +

      '<div class="tk-dr-body">' +
      '<div class="tk-dr-grid">' +
      '<div class="tk-tile"><b>' + st.done + "/" + st.total + "</b><small>stops done</small></div>" +
      '<div class="tk-tile"><b>' + st.skipped + "</b><small>skipped</small></div>" +
      '<div class="tk-tile"><b>' + money(st.collected) + "</b><small>collected</small></div>" +
      '<div class="tk-tile ' + (st.outstanding > 0 ? "warn" : "") + '"><b>' + money(st.outstanding) + "</b><small>outstanding</small></div>" +
      "</div>" +

      '<h4 class="tk-h4">Cash ladder</h4>' +
      ladder([
        { l: "Opening float", v: money(r.openingCash) },
        { l: "Collected on route", v: money(st.collected) },
        { l: "Billed but uncollected", v: money(st.outstanding) },
        { l: "Expected at handover", v: money(r.openingCash + st.collected), strong: true },
      ]) +

      '<h4 class="tk-h4">Stock ladder</h4>' +
      ladder([
        { l: "Loaded at depot", v: r.stockLoaded + " units" },
        { l: "Sold on route", v: st.sold + " units" },
        { l: "Expected back", v: Math.max(0, r.stockLoaded - st.sold) + " units", strong: true },
      ]) +

      '<h4 class="tk-h4">Stops</h4><ol class="tk-tls">' + timeline + "</ol>" +

      '<h4 class="tk-h4">Office messages</h4>' +
      (msgs.length
        ? '<ul class="tk-msgs">' + msgs.map((m) => "<li><b>" + esc(m.at) + "</b> " + esc(m.text) + "</li>").join("") + "</ul>"
        : '<p class="tk-empty">Nothing sent to this driver today.</p>') +
      (state.composing
        ? '<div class="tk-compose">' +
          '<input id="tkMsgInput" type="text" placeholder="Message ' + esc(r.driver) + '\u2026" maxlength="140" />' +
          '<button class="btn btn-primary" data-act="send">Send</button>' +
          '<button class="btn" data-act="cancelmsg">Cancel</button>' +
          "</div>"
        : "") +
      "</div></aside>"
    );
  }

  /* ── Interventions (decision D8) — all mutate the seed and re-render ────── */
  function findStop(id) {
    for (const r of T().routes) {
      const s = r.stops.find((x) => x.id === id);
      if (s) return { r, s };
    }
    return null;
  }

  function act(name, stopId, arg) {
    const r = T().routes.find((x) => x.id === state.drawer);
    if (name === "call") return toast("Calling " + r.driver + " on " + r.phone + " …");
    if (name === "ack") { r._ack = true; toast("Alerts acknowledged for " + r.name, "ok"); return render(); }
    if (name === "message") { state.composing = true; render(); const i = $("#tkMsgInput"); if (i) i.focus(); return; }
    if (name === "send") {
      const i = $("#tkMsgInput");
      const text = i && i.value.trim();
      if (!text) return;
      T().messages.push({ routeId: r.id, at: T().clock, from: "office", text: text });
      state.composing = false;
      toast("Message sent to " + r.driver, "ok");
      return render();
    }
    if (name === "cancelmsg") { state.composing = false; return render(); }

    const hit = findStop(stopId);
    if (!hit) return;

    if (name === "skip") {
      hit.s.status = "skipped";
      hit.s.actualAt = T().clock;
      hit.s.note = "Marked skipped from the office";
      toast(hit.s.name + " marked skipped", "ok");
      return render();
    }
    if (name === "up") {
      const arr = hit.r.stops;
      const i = arr.indexOf(hit.s);
      const prevPending = arr.slice(0, i).reverse().find((x) => x.status === "pending");
      if (!prevPending) return toast("Already the next stop");
      const j = arr.indexOf(prevPending);
      arr.splice(i, 1);
      arr.splice(j, 0, hit.s);
      arr.forEach((x, k) => (x.seq = k + 1));
      toast(hit.s.name + " moved up the queue", "ok");
      return render();
    }
    if (name === "reassign") { state.reassign = state.reassign === stopId ? null : stopId; return render(); }
    if (name === "reassign-to") {
      const target = T().routes.find((x) => x.id === arg);
      if (!target) return;
      hit.r.stops = hit.r.stops.filter((x) => x !== hit.s);
      hit.r.stops.forEach((x, k) => (x.seq = k + 1));
      target.stops.push(hit.s);
      target.stops.forEach((x, k) => (x.seq = k + 1));
      state.reassign = null;
      toast(hit.s.name + " reassigned to " + target.name, "ok");
      return render();
    }
    if (name === "reassign-cancel") { state.reassign = null; return render(); }
  }

  /* ── Live clock (divergence V1) ─────────────────────────────────────────
     Advances the simulated day so the screen genuinely moves. One tick = one
     simulated minute; vans creep along their chain and ping ages tick up. */
  let timer = null;
  function tick() {
    const t = T();
    t.clock = toHHMM(toMin(t.clock) + 1);
    t.routes.forEach((r) => {
      if (r.stage !== "on-route") return;
      if (r.speedKmph > 0) {
        r.progress = Math.min(1, r.progress + 0.004);
        r.lastPingMin = 0;
      } else {
        r.lastPingMin += 1;
      }
    });
    // Repaint the cheap parts only; a full render would close the drawer.
    const strip = $("#tkStrip");
    if (strip) strip.innerHTML = stripHtml();
    const rail = $("#tkRail");
    if (rail) rail.innerHTML = T().routes.map(railCard).join("");
    const clock = $("#tkClock");
    if (clock) clock.textContent = t.clock;
    wireRail();
    renderFooter();
    drawMap();
  }

  function stripHtml() {
    const ex = exceptions();
    if (!ex.length) return '<span class="tk-clear">All routes healthy — nothing needs attention.</span>';
    return ex
      .slice(0, 6)
      .map((e) => '<button class="tk-ex ' + e.sev + '" data-ex="' + e.routeId + '">' + ICO[e.icon] + "<span>" + esc(e.text) + "</span></button>")
      .join("");
  }

  /* ── Mobile: footer + route sheet ────────────────────────────────────────
     Below 768px the rail is hidden so the map gets the whole screen, and the
     route list moves into a bottom sheet opened from the footer. Both reuse
     the module's own .mobile-footer / .sheet classes rather than introducing
     a second pattern. */
  const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

  function renderFooter() {
    let f = document.getElementById("mfooter");
    if (!isMobile()) { if (f) f.remove(); return; }
    if (!f) {
      f = document.createElement("div");
      f.className = "mobile-footer";
      f.id = "mfooter";
      document.querySelector(".main").appendChild(f);
    }
    const n = T().routes.length;
    f.innerHTML =
      '<button class="mf-btn primary" data-mf="routes"><span class="mf-ic">' + ICO.list + "</span>Routes · " + n + "</button>" +
      '<button class="mf-btn' + (state.selected ? " accent" : "") + '" data-mf="fit"><span class="mf-ic">' + ICO.target + "</span>" +
      (state.selected ? "Show all" : "Recentre") + "</button>";
    Array.from(f.querySelectorAll("[data-mf]")).forEach(function (b) {
      b.addEventListener("click", function () {
        const k = b.getAttribute("data-mf");
        if (k === "routes") return openSheet();
        if (k === "fit") { state.selected = null; state._framed = false; state._framedFor = null; render(); }
      });
    });
  }

  function closeSheet() {
    const el = document.getElementById("tkSheet");
    if (!el) return;
    el.classList.remove("show");
    setTimeout(function () { el.remove(); }, 220);
  }

  function openSheet() {
    closeSheet();
    const el = document.createElement("div");
    el.className = "sheet-scrim";
    el.id = "tkSheet";
    el.innerHTML =
      '<div class="sheet" role="dialog" aria-modal="true" aria-label="Today’s routes">' +
      '<div class="grip"></div>' +
      '<div class="sheet-head"><span style="width:34px"></span><h3>Today’s routes</h3>' +
      '<button class="s-x" data-sheetclose aria-label="Close">' + ICO.x + "</button></div>" +
      '<div class="tk-sheet-list">' + T().routes.map(railCard).join("") + "</div>" +
      "</div>";
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("show"); });

    el.addEventListener("click", function (e) {
      if (e.target === el || e.target.closest("[data-sheetclose]")) closeSheet();
    });
    Array.from(el.querySelectorAll("[data-route]")).forEach(function (b) {
      b.addEventListener("click", function () {
        const id = b.getAttribute("data-route");
        closeSheet();
        // Tapping a route on mobile is a request to SEE it: frame the map on it
        // and open its detail, since the rail is not on screen to fall back to.
        state.selected = id;
        state._framed = false;
        state._framedFor = null;
        openDrawer(id);
      });
    });
  }

  /* The map has to fill whatever the topbar, strip and footer leave behind, and
     the topbar grows when the page title wraps. Measure it rather than
     hardcoding a number that is wrong on half the devices. */
  function sizeMobile() {
    if (!isMobile()) { document.documentElement.style.removeProperty("--tk-chrome"); return; }
    const top = document.querySelector(".topbar");
    const foot = document.getElementById("mfooter");
    const pad = 26; // .content padding-top (14) + the wrap's own gap (12)
    const h = (top ? top.getBoundingClientRect().height : 68) + (foot ? foot.getBoundingClientRect().height : 62) + pad;
    document.documentElement.style.setProperty("--tk-chrome", Math.round(h) + "px");
  }


  /* ── Render ─────────────────────────────────────────────────────────────── */
  const state = { selected: null, drawer: null, focusStop: null, reassign: null, composing: false, _framed: false, _framedFor: null };

  function wireRail() {
    $$("[data-route]").forEach((b) =>
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-route");
        state.selected = state.selected === id ? null : id;
        render();
      })
    );
    $$("[data-ex]").forEach((b) =>
      b.addEventListener("click", () => {
        openDrawer(b.getAttribute("data-ex"));
      })
    );
  }

  function render() {
    const content = document.getElementById("content");
    if (!content) return;
    const t = T();

    content.innerHTML =
      '<div class="tk-wrap">' +
      '<div class="tk-strip" id="tkStrip">' + stripHtml() + "</div>" +
      '<div class="tk-main">' +
      '<div class="tk-rail">' +
      '<div class="tk-rail-hd"><b>Today\'s routes</b><span class="tk-clock" id="tkClock">' + esc(t.clock) + "</span></div>" +
      '<div class="tk-rail-list" id="tkRail">' + t.routes.map(railCard).join("") + "</div>" +
      (state.selected ? '<button class="tk-clear-sel" data-clearsel>Show all routes</button>' : "") +
      "</div>" +
      '<div class="tk-map-wrap"><div id="tkMap" class="tk-map"></div>' +
      '<div class="tk-legend">' +
      '<span><i class="lg ok"></i>on time</span><span><i class="lg behind"></i>behind</span>' +
      '<span><i class="lg idle"></i>idle</span><span><i class="lg offline"></i>no signal</span>' +
      "</div></div>" +
      "</div>" +
      drawerHtml() +
      "</div>";

    wireRail();
    const cs = $("[data-clearsel]");
    if (cs) cs.addEventListener("click", () => { state.selected = null; render(); });
    $$("[data-close]").forEach((b) => b.addEventListener("click", () => { state.drawer = null; state.focusStop = null; render(); }));
    $$("[data-act]").forEach((b) =>
      b.addEventListener("click", () => act(b.getAttribute("data-act"), b.getAttribute("data-stop"), b.getAttribute("data-arg")))
    );
    const mi = $("#tkMsgInput");
    if (mi) { mi.focus(); mi.addEventListener("keydown", (e) => { if (e.key === "Enter") act("send"); }); }

    renderFooter();
    sizeMobile();

    // Leaflet needs a re-measure after its container is re-created, and the
    // fresh map has to be framed again.
    map = null;
    state._framed = false;
    setTimeout(drawMap, 0);
  }

  window.FBTrack = {
    screen() {
      state.selected = null;
      state.drawer = null;
      render();
      clearInterval(timer);
      timer = setInterval(tick, 4000);
      // Crossing the breakpoint swaps the whole layout, so re-render on resize.
      let wasMobile = isMobile();
      window.addEventListener("resize", () => {
        sizeMobile();
        if (map) map.invalidateSize();
        if (isMobile() !== wasMobile) { wasMobile = isMobile(); closeSheet(); render(); }
      });
    },
  };
})();

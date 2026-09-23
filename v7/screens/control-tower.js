/* ==========================================================================
   CONTROL TOWER — the screen. Five levers, one template.

   Built 22 Sep 2026 from context/control-tower/:
     CONTROL_TOWER_LEVERS.md   what each lever monitors, balances and grows
     CONTROL_TOWER_DESIGN.md   how it looks: tabs, headline, Good / Bad / Ugly,
                               a five-row list, balance, grow, sticky action,
                               the platform footer (Tower · EXIT DEMO; Create off for now,
                               product owner 22 Sep 2026)
     CONTROL_TOWER_UX_FLOW.md  how the owner moves: every change goes through
                               one confirm sheet; nothing loses their place

   The page only draws. The records and the engines are ../assets/ct/
   (state, signals, store, actions, tower) and the lever model is
   ../assets/ct/levers.js, which the tests drive headless.
   ========================================================================== */

(function () {
  "use strict";

  /* ── icons (outline, 24 grid) ─────────────────────────────────────────── */
  const sv = function (d) { return '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>"; };
  const I = {
    tower: sv('<path d="M4 20V10l8-6 8 6v10"/><path d="M9 20v-6h6v6"/>'),
    updates: sv('<path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>'),
    plus: sv('<path d="M12 5v14M5 12h14"/>'),
    chev: sv('<path d="m9 18 6-6-6-6"/>'),
    x: sv('<path d="M18 6 6 18M6 6l12 12"/>'),
    pin: sv('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>'),
    phone: sv('<rect width="12" height="20" x="6" y="2" rx="2"/><path d="M11 18h2"/>'),
    map: sv('<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>'),
    truck: sv('<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>'),
    rupee: sv('<path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a4.5 4.5 0 0 0 0-10"/>'),
    cart: sv('<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>'),
    box: sv('<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12M3.3 7l8.7 5 8.7-5"/>'),
    clip: sv('<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>'),
    scale: sv('<path d="M12 3v18M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z"/>'),
    grow: sv('<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>'),
    flame: sv('<path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.5.7-2.6 1.5-3.5.2 1.3 1 2 2 2 0-2.5-1-4.5.5-7z"/>'),
    minus: sv('<path d="M5 12h14"/>'),
    check: sv('<path d="M20 6 9 17l-5-5"/>'),
    bang: sv('<path d="M12 7v6M12 17h.01"/>'),
  };
  const CREATE = [
    { id: "delivery", label: "Record a delivery", icon: I.truck },
    { id: "payment", label: "Receive payment", icon: I.rupee },
    { id: "purchase", label: "New purchase order", icon: I.clip },
    { id: "count", label: "Stock count", icon: I.box },
    { id: "order", label: "New order", icon: I.cart },
  ];
  const ICON_OF = { deliveries: I.truck, collections: I.rupee, purchase: I.clip, inventory: I.box, order: I.cart };
  const COLOUR = { green: "Green", yellow: "Yellow", orange: "Orange", red: "Red", fire: "Fire" };
  const WORD = { ugly: "Urgent", bad: "Needs work", good: "On track", preview: "Not connected" };

  const esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  let tower, view, model, L;
  const ui = { tab: null, tile: {}, colour: null, stack: [], toastT: null, pending: false, rows: [] };

  /* ── frame: inside the platform, the shell brands the page ──────────── */
  function platformWin() {
    let w = window;
    for (let up = 0; up < 4; up++) {
      let next; try { next = w.parent; } catch (e) { return null; }
      if (!next || next === w) return null;
      w = next;
      try { if (w.FBPlatform) return w; } catch (e) { /* keep climbing */ }
    }
    return null;
  }
  function shellDesktop() { const pw = platformWin(); try { return !!pw && pw.innerWidth >= 1024; } catch (e) { return false; } }
  function applyFrame() {
    document.documentElement.classList.toggle("ct-framed", !!platformWin());
    document.documentElement.classList.toggle("ct-shell-desktop", shellDesktop());
  }
  function go(route) {
    const pw = platformWin();
    try { (pw || window.top || window).location.hash = route; } catch (e) { location.href = "../index.html" + route; }
  }

  function storage() {
    try { const k = "fb.v7.ct.probe"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return localStorage; }
    catch (e) { return window.CTStore.memory(); }
  }

  /* ── mount ───────────────────────────────────────────────────────────── */
  function mount() {
    L = window.CTLevers;
    applyFrame();
    mountTop();
    mountFooter();
    skeleton();
    window.FBContext.ready().then(init).catch(function (e) { fatal(e && e.message); });
  }
  function init() {
    const store = window.CTStore.create(storage());
    const acct = function () { return window.FBContext.account() || {}; };
    /* No connected business in this session: the live demo business, so no
       lever is ever "not connected" (product owner, 22 Sep 2026). */
    const readRaw = function () {
      const r = window.FBContext.raw();
      /* Nothing connected, or onboarding's "Try sample data" (the same
         business, dated to its import): the live demo, dated to today. A
         business the owner connected is never replaced. */
      const kind = r.dataReady && r.dataReady.provenance && r.dataReady.provenance.kind;
      if ((!r.dataReady || kind === "sample") && window.CTDemo) r.dataReady = window.CTDemo.dataReady(Date.now()) || r.dataReady;
      return r;
    };
    tower = window.CTTower.create({ store: store, readRaw: readRaw, business: function () { return acct().business || null; } });
    compute();
    ui.demo = !!(window.CTDemo && window.CTDemo.isDemo(readRaw()));
    if (ui.demo) { try { if (window.CTDemo.ensureDay(tower.store, view, Date.now())) compute(); } catch (e) { /* the tower stands without the route */ } }
    /* Where each lever stands is measured from here, once the tower (and the
       demo's day) is in place: filling in the day is not news. */
    ui.ready = true; trackStatus();
    const deep = deepLink();
    /* The Overview is home: every visit opens on the five levers; a link
       straight to one lever still lands there (owner, 22 Sep 2026). */
    ui.tab = deep.lever || "overview";
    ui.page = "tower";
    if (deep.updates) { ui.page = "updates"; ui.newSince = updSeen() || Date.now(); markSeen(); }
    draw();
    if (deep.item) { const r = findRow(deep.item); if (r) openItem(r); }
    if (deep.chat) setTimeout(openAssistant, 0);            // after the chat's own script has mounted
    wireGlobal();
  }
  function compute() {
    view = tower.pass();
    model = L.build(view, { demand: window.CTSignals._detectors.demand(view.state) });
    if (ui.ready) trackStatus();
  }

  /* ── Where each lever stands, over time: the Timeline's "… is on track now".
     A lever that flips and flips back within 15 minutes is not news: the
     two changes fold into one, or into nothing. Per device. ────────────── */
  function scopeKey(k) { return "fb.v7.ct." + k + "." + (tower.store.scope ? tower.store.scope() : "export"); }
  function readJson(k, d) { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } }
  function trackStatus() {
    const k = scopeKey("statuslog"), s = readJson(k, { last: null, log: [] });
    const now = Date.now();
    model.levers.forEach(function (x) {
      const was = s.last && s.last[x.id];
      if (!was || was === x.status || was === "preview" || x.status === "preview") return;   // connecting records is not news
      const prev = s.log.filter(function (e) { return e.lever === x.id; }).pop();
      if (prev && now - prev.at < 15 * 60000) {
        s.log.splice(s.log.indexOf(prev), 1);
        if (prev.from !== x.status) s.log.push({ at: now, lever: x.id, from: prev.from, to: x.status });
      } else s.log.push({ at: now, lever: x.id, from: was, to: x.status });
    });
    s.last = {}; model.levers.forEach(function (x) { s.last[x.id] = x.status; });
    s.log = s.log.slice(-40);
    try { localStorage.setItem(k, JSON.stringify(s)); } catch (e) { /* per device only */ }
    ui.statusLog = s.log;
  }
  /* When the owner last read the Timeline: what arrived since is New. */
  function updSeen() { const v = readJson(scopeKey("updseen"), 0); return typeof v === "number" ? v : 0; }
  function markSeen() { try { localStorage.setItem(scopeKey("updseen"), JSON.stringify(Date.now())); } catch (e) { /* per device only */ } }
  function lever(id) { return model.levers.filter(function (x) { return x.id === (id || ui.tab); })[0]; }
  function deepLink() {
    const q = new URLSearchParams(location.search);
    let lv = q.get("lever"), item = q.get("item"), vw = q.get("view"), chat = q.get("chat");
    try {
      const h = (platformWin() || window.top).location.hash || "";
      const i = h.indexOf("?");
      if (i !== -1) { const hq = new URLSearchParams(h.slice(i + 1)); lv = lv || hq.get("lever"); item = item || hq.get("item"); vw = vw || hq.get("view"); chat = chat || hq.get("chat"); }
    } catch (e) { /* not ours to read */ }
    return { lever: ["overview", "deliveries", "collections", "purchase", "inventory", "order"].indexOf(lv) !== -1 ? lv : null, item: item,
             /* `chat=1`: the Assistant action on a work screen comes back to
                the tower with the chat open, where it left off. */
             chat: chat === "1", updates: vw === "updates" && !lv };
  }

  function skeleton() {
    const b = function (w, h) { return '<i class="ct-sk" style="width:' + w + ";height:" + h + 'px"></i>'; };
    $("#ct").innerHTML = '<main class="ct-main" aria-busy="true"><section class="ct-head">' + b("70%", 34) + b("45%", 14) + "</section>" +
      '<div class="ct-tiles">' + [1, 2, 3].map(function () { return '<div class="ct-tile">' + b("50%", 12) + b("70%", 20) + "</div>"; }).join("") + "</div>" +
      '<div class="ct-list">' + [1, 2, 3, 4, 5].map(function () { return '<div class="ct-row">' + b("60%", 14) + b("20%", 14) + "</div>"; }).join("") + "</div></main>";
  }
  function fatal() {
    $("#ct").innerHTML = '<main class="ct-main"><p class="ct-err">Couldn\'t load the tower. <button class="ct-link" id="ct-retry">Retry</button></p></main>';
    $("#ct-retry").addEventListener("click", function () { location.reload(); });
  }

  /* ════════════════════════════════════════════════════════════════════
     DRAW — tabs · as of · headline · Good/Bad/Ugly · list · cards · action
     ════════════════════════════════════════════════════════════════════ */
  function draw() {
    if (ui.page === "updates") return drawUpdates();
    const over = ui.tab === "overview";
    const lv = over ? null : lever();
    const root = $("#ct");
    const keep = window.scrollY;
    root.innerHTML = (over ? "" : leverBar(lv)) +
      liveLine() +
      '<main class="ct-main" data-lever="' + (over ? "overview" : lv.id) + '">' + (over ? overviewBody() : lv.status === "preview" ? previewBody(lv) : leverBody(lv)) + "</main>" +
      (ui.pending ? '<button class="ct-newbar" id="ct-newbar">New updates · tap to update</button>' : "");
    window.scrollTo(0, keep);
    document.documentElement.classList.toggle("ct-ov", over);
    syncFooter();
    syncTop();
    if (over) ui.dialsShown = true;
  }

  /* ════════════════════════════════════════════════════════════════════
     TIMELINE — the business's news, newest first (owner, 22 Sep 2026).
     On screen "Timeline" (footer) and "Business Timeline" (title), the
     owner's pick; in code it is still "updates".
     The model is ../assets/ct/timeline.js; this only draws it.
     ════════════════════════════════════════════════════════════════════ */
  function timeline() { return window.CTTimeline.build(view, model, { now: Date.now(), statusLog: ui.statusLog || [] }); }
  function drawUpdates() {
    const tl = timeline();
    const since = ui.newSince || 0;
    ui.updItems = {};
    /* A line is highlighted once, as it arrives; a live redraw never
       replays it. */
    const shown = ui.shown || {};
    ui.shown = {};
    const keep = window.scrollY;
    $("#ct").innerHTML =
      '<div class="ct-lvhead"><div class="ct-lvbar ct-upbar"><h2 class="ct-lvname"><span class="ct-lvicon">' + I.updates + "</span>Business Timeline</h2></div></div>" +
      '<main class="ct-main" data-lever="updates">' + (tl.days.length ? tl.days.map(function (d) {
        /* Today needs no heading (owner, 22 Sep 2026); earlier days keep theirs. */
        return '<section class="ct-day">' + (d.label === "Today" ? "" : "<h3>" + esc(d.label) + "</h3>") + '<ol class="ct-tl">' + d.items.map(function (it) {
          ui.updItems[it.key] = it;
          (ui.updDay = ui.updDay || {})[it.key] = d.label;
          const fresh = it.at > since;
          const arrived = fresh && ui.shownOnce && !shown[it.key + "@" + it.at];
          ui.shown[it.key + "@" + it.at] = 1;
          return '<li><button class="ct-tli" data-upd="' + esc(it.key) + '" data-tone="' + it.tone + '"' + (it.win ? " data-win" : "") + (fresh ? " data-new" : "") + (arrived ? " data-in" : "") + ">" +
            '<span class="ct-tld" aria-hidden="true">' + (ICON_OF[it.lever] || "") + "</span>" +
            '<span class="ct-tlb">' + (it.time || fresh ? '<span class="ct-tlt">' + (it.time ? esc(it.time) : "") + (fresh ? '<em class="ct-new">New</em>' : "") + "</span>" : "") +
              '<span class="ct-tlx">' + esc(it.text) + "</span></span>" +
            '<span class="ct-go">' + I.chev + "</span></button></li>";
        }).join("") + "</ol></section>";
      }).join("") : '<p class="ct-empty">Nothing has happened in the last 7 days.</p>') + "</main>";
    ui.shownOnce = true;
    window.scrollTo(0, keep);
    document.documentElement.classList.remove("ct-ov");
    syncFooter(tl);
    syncTop(tl);
  }
  /* Tower and the Timeline are the two pages; a sheet never stays across them. */
  function setPage(p) {
    if (p === ui.page) return;
    closeAll();
    /* New: what arrived since the last read. On a first read everything is
       new, so nothing is tagged; what arrives while reading is. */
    if (p === "updates") { ui.newSince = updSeen() || Date.now(); markSeen(); ui.shownOnce = false; } else markSeen();
    ui.page = p;
    draw(); window.scrollTo(0, 0);
  }
  /* A line opens its details in a sheet, over the Timeline (owner, 22 Sep
     2026): the facts and the records it sums up. The owner stays where they
     are; Open, at the bottom, goes to the lever that acts on it. */
  function openUpdate(key) {
    const it = ui.updItems && ui.updItems[key]; if (!it) return;
    const d = it.detail || { title: it.text, facts: [], rows: [] };
    const day = ui.updDay && ui.updDay[key];
    const lv = lever(it.lever);
    sheet(function () {
      return { title: d.title, sub: [day && day !== "Today" ? day : null, it.time].filter(Boolean).join(" · ") || null,
        /* The title and facts say it; the line isn't repeated (no figure twice). */
        body: (d.facts.length ? kv(d.facts) : "") +
          (d.rows.length ? '<h4 class="ct-upd-h">' + esc(d.heading || "") + " · " + d.rows.length + '</h4><div class="ct-list">' + d.rows.map(function (r) {
            return '<div class="ct-row"><span class="ct-row-t"><span class="ct-row-n">' + esc(r.title) + "</span>" + (r.note ? "<small>" + esc(r.note) + "</small>" : "") + "</span>" +
              (r.value ? '<b class="ct-row-v">' + esc(r.value) + "</b>" : "") + "</div>";
          }).join("") + "</div>" : ""),
        foot: lv ? '<button class="ct-btn is-ghost is-wide" data-a="open">Open ' + esc(lv.label) + "</button>" : "",
        bind: function (el) {
          const b = $("[data-a=open]", el.parentNode);
          if (b) b.addEventListener("click", function () { closeAll(); openLever(it.lever, it.tile); });
        } };
    });
  }
  /* New since the owner last read the Timeline: a dot on its tab. */
  function unseen(tl) {
    const since = updSeen();
    return (tl || timeline()).days.some(function (d) { return d.items.some(function (it) { return it.at > since; }); });
  }

  /* Live: the demo business, and the last thing that happened in it. */
  function liveLine() {
    /* The demo shows no line of its own (owner, 22 Sep 2026): its numbers
       move on their own, and that is the live feel. */
    if (ui.demo) return "";
    return model.stale || model.sample ? '<p class="ct-asof">' + [model.stale ? "As of " + esc(L.date(model.asOf)) : null, model.sample ? "Sample data" : null].filter(Boolean).join(" · ") + "</p>" : "";
  }

  /* An open lever: back to the five levers, the lever's name, and how it is
     — the word its card on the Overview used (owner, 22 Sep 2026: no tabs). */
  function leverBar(lv) {
    /* One page per lever (owner, 23 Sep 2026: no Status/Suggestions tabs).
       The bar carries the way back, the lever's name, and where it stands. */
    return '<div class="ct-lvhead"><nav class="ct-lvbar" aria-label="' + esc(lv.label) + '">' +
      '<button class="ct-home" data-home aria-label="Back to all levers" title="All levers">' + I.chev + "</button>" +
      '<h2 class="ct-lvname"><span class="ct-lvicon">' + (ICON_OF[lv.id] || "") + "</span>" + esc(lv.label) + "</h2>" +
      '<span class="ct-lvword" data-s="' + lv.status + '"><i class="ct-dot" data-s="' + lv.status + '"></i>' + WORD[lv.status] + "</span></nav></div>";
  }
  /* What FoodBridge suggests, under the list on the same page: tomorrow's
     trips, the balance cards, the Grow card. */
  function extras(lv) {
    return [].concat(lv.id === "deliveries" && lv.tomorrow && lv.tomorrow.length ? [tomorrowCard(lv.tomorrow)] : [],
      (lv.balance || []).map(balanceCard), lv.grow ? [growCard(lv.grow)] : []);
  }

  /* The dot on the tab and the tile the lever opens on say the same thing:
     on track → On track, slipping → Needs work, needs action → Urgent. The
     owner's own pick, while they are in the tab, still wins. */
  const LANDS = { good: "good", bad: "bad", ugly: "ugly" };
  function selectedTile(lv) {
    const t = lv.tiles, pick = ui.tile[lv.id], land = LANDS[lv.status];
    if (pick && t[pick] && t[pick].count) return pick;
    if (land && t[land].count) return land;
    return t.ugly.count ? "ugly" : t.bad.count ? "bad" : "good";
  }

  function leverBody(lv) {
    const sel = selectedTile(lv);
    let rows = lv.tiles[sel].rows;
    if (lv.id === "collections" && ui.colour) rows = rows.filter(function (r) { return r.colour === ui.colour; });
    ui.sel = sel;
    /* On track is good news only: no who-owes colours under it. */
    return head(lv) + tiles(lv, sel) +
      (lv.id === "collections" && lv.colours && sel !== "good" ? colourBar(lv) : "") +
      (lv.id === "deliveries" && sel === "good" ? facts(lv.facts) : "") +
      list(rows, lv, sel) +
      extras(lv).join("");
  }

  function head(lv) {
    const h = lv.headline;
    return '<section class="ct-head">' +
      '<div class="ct-head-v' + (lv.status === "good" ? " is-good" : "") + '"><span>' + esc(h.value) + "</span></div>" +
      '<p class="ct-head-c">' + esc(h.context) + "</p>" +
      (typeof h.bar === "number" ? '<div class="ct-bar" role="img" aria-label="' + Math.round(h.bar * 100) + '% delivered"><i style="width:' + Math.round(h.bar * 100) + '%"></i></div>' : "") +
      "</section>";
  }

  function tiles(lv, sel) {
    return '<div class="ct-tiles" role="tablist" aria-label="On track, needs work, urgent">' + ["good", "bad", "ugly"].map(function (k) {
      const t = lv.tiles[k];
      const off = !t.count;
      /* A tile is a button: it opens its list below (the chevron says so). */
      return '<button class="ct-tile" role="tab" data-k="' + k + '" data-tile="' + k + '" aria-selected="' + (k === sel) + '"' + (off ? " disabled" : "") + ">" +
        '<span class="ct-tile-l">' + t.label + (off ? "" : '<span class="ct-tile-go">' + I.chev + "</span>") + "</span>" +
        '<span class="ct-tile-v' + (off ? " is-zero" : "") + '">' + esc(t.value) + "</span>" +
        '<span class="ct-tile-w">' + esc(t.word) + "</span></button>";
    }).join("") + "</div>";
  }

  function colourBar(lv) {
    const cs = lv.colours;
    const total = cs.reduce(function (n, c) { return n + (c.amount || 0); }, 0);
    return '<div class="ct-colours">' +
      (total ? '<div class="ct-cbar" role="img" aria-label="Outstanding by colour">' + cs.map(function (c) {
        const w = (c.amount || 0) / total * 100;
        return w ? '<i data-c="' + c.id + '" style="width:' + w + '%"></i>' : "";
      }).join("") + "</div>" : "") +
      '<div class="ct-clabels">' + cs.map(function (c) {
        return '<button class="ct-clabel" data-colour="' + c.id + '" aria-pressed="' + (ui.colour === c.id) + '"' + (c.n ? "" : " disabled") + ">" +
          '<i class="ct-cdot" data-c="' + c.id + '">' + (c.id === "fire" ? I.flame : "") + "</i>" + COLOUR[c.id] + " " + c.n + "</button>";
      }).join("") + "</div></div>";
  }

  function facts(fs) {
    return '<div class="ct-facts">' + fs.map(function (f) { return '<div class="' + (f.bad ? "is-bad" : f.good ? "is-good" : "") + '"><span>' + esc(f.label) + "</span><b>" + esc(f.value) + (f.good ? " " + I.check : "") + "</b></div>"; }).join("") + "</div>";
  }

  function rowHtml(r, i, good) {
    const fig = typeof r.value === "number" ? L.rupees(r.value) : "";
    /* A good-news row carries a green tick, never a risk colour. */
    const mark = good ? '<i class="ct-ok" role="img" aria-label="Done">' + I.check + "</i>"
      : r.colour ? '<i class="ct-cdot" data-c="' + r.colour + '" role="img" aria-label="' + COLOUR[r.colour] + '">' + (r.colour === "fire" ? I.flame : "") + "</i>" : "";
    return '<button class="ct-row' + (r.stuck ? " is-stuck" : "") + '" data-row="' + i + '">' + mark +
      '<span class="ct-row-t"><span class="ct-row-n">' + esc(r.title) + "</span>" + (r.note ? "<small>" + esc(r.note) + "</small>" : "") + "</span>" +
      (fig ? '<b class="ct-row-v">' + esc(fig) + "</b>" : "") + '<span class="ct-go">' + I.chev + "</span></button>";
  }
  function list(rows, lv, sel) {
    ui.rows = rows;
    if (!rows.length) return lv.tiles[sel].count ? "" : '<p class="ct-empty">Nothing here.</p>';
    const good = sel === "good";
    return '<div class="ct-list">' + rows.slice(0, L.T.ROWS).map(function (r, i) { return rowHtml(r, i, good); }).join("") + "</div>" +
      (rows.length > L.T.ROWS ? '<button class="ct-more" data-all>Show all ' + rows.length + "</button>" : "");
  }

  function tomorrowCard(lines) {
    return '<section class="ct-card"><h3>' + I.truck + "Tomorrow's trips</h3><ul class=\"ct-lines\">" +
      lines.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></section>";
  }
  function balanceCard(b) {
    return '<button class="ct-card ct-balance" data-goto="' + b.tab + '"><h3>' + I.scale + esc(b.title) + "</h3>" +
      "<p>" + esc(b.text) + '</p><p class="ct-move">' + esc(b.move) + I.chev + "</p></button>";
  }
  function growCard(g) {
    return '<button class="ct-card ct-grow" data-grow><h3>' + I.grow + "Grow</h3><p>" + esc(g.text) + "</p></button>";
  }

  /* ════════════════════════════════════════════════════════════════════
     OVERVIEW — home: the whole business through its five levers.
     ════════════════════════════════════════════════════════════════════ */
  /* The five levers as dials, three over two, in the owner's order so it
     never shuffles: the ring's colour and word say how it is, its fill how
     full. Nothing else (owner, 22 Sep 2026: Wins and the balance card came
     off; the dials stay, the owner preferred them to full-width rows). */
  function overviewBody() {
    /* The rings fill once, on the first look; a live update never replays it. */
    return '<div class="ct-dials' + (ui.dialsShown ? "" : " is-first") + '">' + model.levers.map(function (x) {
      const f = x.health ? Math.max(0.04, x.health.value) : 0;
      const C = 2 * Math.PI * 40;
      return '<button class="ct-dial" data-goto="' + x.id + '" data-s="' + x.status + '" aria-label="' + esc(x.label + ", " + WORD[x.status]) + '">' +
        '<span class="ct-dial-g"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="bg" cx="50" cy="50" r="40"/>' +
          '<circle class="fg" cx="50" cy="50" r="40" stroke-dasharray="' + (C * f).toFixed(1) + " " + C.toFixed(1) + '"/></svg>' +
          '<span class="ct-dial-i">' + (ICON_OF[x.id] || "") + "</span></span>" +
        '<span class="ct-dial-n">' + esc(x.label) + '</span><span class="ct-dial-w">' + WORD[x.status] + I.chev + "</span></button>";
    }).join("") + "</div>";
  }

  /* ── Preview: the whole lever, before its records arrive ─────────────── */
  function previewBody(lv) {
    const p = lv.preview;
    const t = lv.tiles;
    return '<section class="ct-head ct-promise"><div class="ct-head-v"><span>' + esc(p.promise) + '</span></div><p class="ct-head-c">' + esc(p.sub) + "</p></section>" +
      '<div class="ct-example" aria-label="Example of what you will see">' +
        '<span class="ct-extag">Example</span>' +
        '<p class="ct-exhead">' + esc(lv.headline.value) + " <small>" + esc(lv.headline.context) + "</small></p>" +
        '<div class="ct-tiles">' + ["good", "bad", "ugly"].map(function (k) {
          return '<div class="ct-tile" data-k="' + k + '"><span class="ct-tile-l">' + t[k].label + '</span><span class="ct-tile-v">' + esc(t[k].value) + '</span><span class="ct-tile-w">' + esc(t[k].word) + "</span></div>";
        }).join("") + "</div>" +
        (lv.colours ? '<div class="ct-clabels">' + lv.colours.map(function (c) { return '<span class="ct-clabel"><i class="ct-cdot" data-c="' + c.id + '">' + (c.id === "fire" ? I.flame : "") + "</i>" + COLOUR[c.id] + " " + c.n + "</span>"; }).join("") + "</div>" : "") +
        (t.ugly.rows.length ? '<div class="ct-list">' + t.ugly.rows.map(function (r) {
          return '<div class="ct-row">' + (r.colour ? '<i class="ct-cdot" data-c="' + r.colour + '">' + (r.colour === "fire" ? I.flame : "") + "</i>" : "") +
            '<span class="ct-row-t">' + esc(r.title) + (r.note ? "<small>" + esc(r.note) + "</small>" : "") + "</span>" +
            (typeof r.value === "number" ? '<b class="ct-row-v">' + L.rupees(r.value) + "</b>" : "") + "</div>";
        }).join("") + "</div>" : "") +
        (lv.facts ? facts(lv.facts) : "") +
        (lv.tomorrow ? tomorrowCard(lv.tomorrow) : "") +
      "</div>" +
      /* The one way in, in the flow of the page (owner, 23 Sep 2026: no
         floating action buttons). */
      '<button class="ct-connect" data-connect>' + esc(p.connect.label) + "</button>";
  }

  /* ── top bar: the same as Reports on a big screen ────────────────────────
     Every framed module draws its own top bar on desktop — the page's name,
     and who is signed in — and the shell only draws one below 1024 px. The
     tower matches Reports (owner, 22 Sep 2026). Who: the same record the
     shell reads, so the phone header and this bar never disagree. */
  function who() {
    const a = window.FBContext && window.FBContext.account();
    return !a || a.guest ? { name: "Demo store", role: "" } : { name: a.name || "", role: "Owner" };
  }
  function mountTop() {
    const h = document.createElement("header");
    h.className = "ct-top";
    /* The hamburger, where Reports has it: it folds the shell's sidebar away
       and back (the shell's own "toggle-sidebar" message). Standalone there
       is no sidebar to fold, so no button. */
    const burger = platformWin() ? '<button type="button" class="ct-top-burger" data-burger aria-label="Toggle sidebar" title="Toggle sidebar">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h18M3 6h18M3 18h18"/></svg></button>' : "";
    /* On a big screen the footer is off, so Tower · Timeline · Assistant live here. */
    h.innerHTML = '<div class="ct-top-l">' + burger + '<h1 class="ct-top-t">Control Tower</h1>' +
      '<nav class="ct-top-nav" aria-label="Control Tower pages"><button type="button" data-page="tower">Tower</button>' +
      /* The work screens are not repeated here: on a big screen the shell's
         sidebar lists all four under Distribution & Logistics, and seven
         pills crowd the title out of this bar (23 Sep 2026). */
      '<button type="button" data-page="updates">Timeline<i class="ct-fnew" aria-hidden="true"></i></button>' +
      '<button type="button" data-assistant class="ct-top-assist"><span class="cb-face" style="background-image:url(../assets/ct/mascot/hello-128.png)" aria-hidden="true"></span>Assistant</button></nav></div>' +
      '<div class="ct-top-u"><span class="ct-top-ava">' + sv('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>') + "<i></i></span>" +
      '<span class="ct-top-who"><b data-who-name></b><small data-who-role></small></span></div>';
    document.body.insertBefore(h, $("#ct"));
    h.addEventListener("click", function (e) {
      if (e.target.closest("[data-assistant]")) return openAssistant();
      const p = e.target.closest("[data-page]"); if (!p) return;
      if (p.dataset.page === "updates") goUpdates(); else goTower();
    });
    const b = $("[data-burger]", h);
    if (b) b.addEventListener("click", function () {
      const pw = platformWin();
      try { (pw || window.parent).postMessage({ source: "fb-module", type: "toggle-sidebar" }, "*"); } catch (e) { /* no shell to fold */ }
    });
    syncTop();
  }
  function syncTop(tl) {
    const w = who(), n = $("[data-who-name]"), r = $("[data-who-role]");
    $$(".ct-top-nav [data-page]").forEach(function (b) {
      const on = b.dataset.page === (ui.page || "tower");
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
      if (b.dataset.page !== "updates") return;
      /* The same rule as the footer, whose place this bar takes on a big
         screen: the Timeline is offered from home. */
      b.hidden = !(on || hasTimeline());
      b.classList.toggle("has-new", !on && !!tower && unseen(tl));
    });
    if (n) n.textContent = w.name;
    if (r) { r.textContent = w.role; r.hidden = !w.role; }
  }

  /* ── footer: the platform's bar ──────────────────────────────────────── */
  function mountFooter() {
    if (!window.FB_EXIT) return;
    const tabs = [
      { id: "tower", label: "Tower", icon: '<span class="ct-ftic">' + I.tower + "</span>", onClick: goTower },
      { id: "updates", label: "Timeline", icon: '<span class="ct-ftic">' + I.updates + '<i class="ct-fnew" aria-hidden="true"></i></span>', onClick: goUpdates },
    ].concat(WORK.map(function (w) {
      return { id: w.id, label: w.label, icon: '<span class="ct-ftic">' + I[w.icon] + "</span>", onClick: function () { openWork(w.id); } };
    }), [
      /* The assistant is a footer action, not a floating button (owner,
         22 Sep 2026): its face as the icon; it opens the chat over the page.
         It sits next to EXIT DEMO, whatever else is on the bar (owner,
         23 Sep 2026) — the same thumb, the same place, every screen. */
      { id: "assistant", label: "Assistant", icon: '<span class="ct-ftic ct-fassist"><span class="cb-face" style="background-image:url(../assets/ct/mascot/hello-128.png)"></span></span>', onClick: openAssistant },
    ]);
    window.FB_EXIT.mount({ pad: false, z: 39, tabs: tabs });
    /* The bar numbers its tabs by position; name them, so the ones that come
       and go (Work) never shift what the rest of this file points at. */
    tabs.forEach(function (t, i) { const b = $('#fbx-foot [data-x="' + i + '"]'); if (b) b.dataset.ft = t.id; });
  }
  function openAssistant() { closeAll(); if (window.FBChat) window.FBChat.open(); }

  /* ── the work behind the Deliveries lever ─────────────────────────────
     A lever says what is wrong; these four screens are where the owner does
     something about it. They are the platform's own Distribution & Logistics
     destinations, and on this lever they are footer actions like any other
     (owner, 23 Sep 2026: "just like Tower, Timeline, Assistant" — not a
     sheet in front of them). Eight actions do not fit a 375px bar, so the
     bar scrolls sideways; nothing is dropped.

     The same eight go into each screen's own bottom bar on the way in, so
     the way back is always there — the shell does that; see `TRIP` in
     assets/platform.js, which keeps this list in step.
     Deliveries only: no other lever has a module behind it in this cut. */
  const WORK = [
    { id: "live-tracking", label: "Tracking", icon: "pin" },
    { id: "delivery-management", label: "Delivery", icon: "phone" },
    { id: "route-planning", label: "Planning", icon: "map" },
    /* "Assets", not "Returns": what the screen itself is about — asset
       movement, asset inventory, the assets (owner, 23 Sep 2026). */
    { id: "logistic-returns", label: "Assets", icon: "box" },
  ];
  /* The work screens belong to the Deliveries lever, not to the tower. */
  function hasWork() { return ui.page === "tower" && ui.tab === "deliveries"; }
  /* The Timeline is offered from home only (owner, 23 Sep 2026). */
  function hasTimeline() { return ui.page === "tower" && ui.tab === "overview"; }
  /* `from=deliveries`: the screen opens carrying these same actions, and
     they come back to this lever. */
  function openWork(id) { closeAll(); go("#/distribution-logistics/" + id + "?from=deliveries"); }
  /* Tower is home: the five levers, from anywhere, Updates included. */
  function goTower() {
    closeAll();
    if (ui.page !== "tower") { ui.tab = "overview"; ui.overY = 0; setPage("tower"); return; }
    if (ui.tab !== "overview") { ui.overY = 0; goHome(); } else window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function goUpdates() {
    if (ui.page === "updates") { closeAll(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setPage("updates");
  }
  function syncFooter(tl) {
    const up = ui.page === "updates";
    const t = $('#fbx-foot [data-ft="tower"]'), u = $('#fbx-foot [data-ft="updates"]');
    const work = hasWork();
    WORK.forEach(function (x) { const b = $('#fbx-foot [data-ft="' + x.id + '"]'); if (b) b.hidden = !work; });
    /* Seven tabs do not fit a phone bar: it scrolls, and it starts at Tower. */
    const bar = $("#fbx-foot");
    if (bar) { bar.classList.toggle("is-wide", work); if (!work) bar.scrollLeft = 0; }
    if (t) { if (up) t.removeAttribute("aria-current"); else t.setAttribute("aria-current", "page"); }
    if (u) {
      /* The Timeline belongs to the Overview (owner, 23 Sep 2026): the
         business's news is a home-page thing, not something to carry into a
         lever, where the lever's own work is what matters. It stays on the
         bar while the owner is reading it, as the current tab. */
      u.hidden = !(up || hasTimeline());
      if (up) u.setAttribute("aria-current", "page"); else u.removeAttribute("aria-current");
      const fresh = !up && unseen(tl);
      u.classList.toggle("has-new", fresh);
      u.setAttribute("aria-label", "Timeline" + (fresh ? ", new" : ""));
    }
  }

  /* ════════════════════════════════════════════════════════════════════
     WIRING
     ════════════════════════════════════════════════════════════════════ */
  function onClick(e) {
    const b = e.target.closest("button, [data-goto]"); if (!b || b.disabled) return;
    const d = b.dataset;
    if ("home" in d) { goHome(); return; }
    if (d.upd) { openUpdate(d.upd); return; }
    if (d.tile) { ui.tile[ui.tab] = d.tile; ui.colour = null; draw(); return; }
    /* A colour lives in one tile: Yellow and Orange under Needs work, Red
       and Fire under Urgent. Tapping it opens the tile that holds it. */
    if (d.colour) {
      ui.colour = ui.colour === d.colour ? null : d.colour;
      if (ui.colour) ui.tile.collections = ui.colour === "red" || ui.colour === "fire" ? "ugly" : "bad";
      draw(); return;
    }
    if (d.row !== undefined) return openItem(ui.rows[+d.row]);
    if ("all" in d) return openAll();
    if (d.goto) { setTab(d.goto); return; }
    if ("grow" in d) return doGrow();
    if ("connect" in d) return doAction();
    if ("openCreate" in d) return openCreate();
    if (b.id === "ct-newbar") { ui.pending = false; compute(); draw(); }
  }
  /* Every way into a lever — the tab, a swipe, an Overview dial, a balance
     card — opens on the tile its dot promised; a tile the owner picks holds
     only while they stay in that lever. */
  function setTab(id) {
    if (id === ui.tab) return;
    if (ui.tab === "overview") ui.overY = window.scrollY;             // where the owner was among the cards
    delete ui.tile[id];
    ui.tab = id; ui.colour = null;
    draw(); window.scrollTo(0, 0);
  }
  /* Back to the five levers, where the owner left them. */
  function goHome() {
    if (ui.tab === "overview") return;
    setTab("overview");
    window.scrollTo(0, ui.overY || 0);
  }
  function wireGlobal() {
    $("#ct").addEventListener("click", onClick);
    window.addEventListener("storage", function (e) {
      if (!e.key || e.key.indexOf("fb.v7.") !== 0) return;
      clearTimeout(ui.st);
      ui.st = setTimeout(function () {
        if (isOpen()) { ui.pending = true; return; }
        compute(); draw();
      }, 250);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (isOpen()) back(); else if (ui.page === "tower") goHome();
    });
    window.addEventListener("resize", function () { applyFrame(); });
    setInterval(function () { if (!isOpen()) { compute(); draw(); } }, 60000);
    /* The demo business's clock: something happens every 20 seconds. The
       screen never moves under an open sheet; it catches up on close. */
    if (ui.demo) setInterval(function () {
      if (isOpen()) return;
      let ev = null;
      try { ev = window.CTDemo.tick(tower.store, view, Date.now()); } catch (e) { return; }
      if (ev) { ui.last = ev; compute(); draw(); }
    }, 20000);
  }
  function findRow(id) {
    const lv = lever(); if (!lv) return null;
    return [].concat(lv.tiles.ugly.rows, lv.tiles.bad.rows, lv.tiles.good.rows).filter(function (r) { return r.id === id; })[0] || null;
  }
  function after(msg) { compute(); draw(); toast(msg); }

  /* ════════════════════════════════════════════════════════════════════
     SHEETS — one layer, a stack so Back returns to where the owner was
     ════════════════════════════════════════════════════════════════════ */
  function layer() {
    let l = $("#ct-layer");
    if (!l) { l = document.createElement("div"); l.id = "ct-layer"; document.body.appendChild(l); }
    return l;
  }
  function isOpen() { return ui.stack.length > 0; }
  function sheet(fn, push) { if (!push) ui.stack = []; ui.stack.push(fn); paint(); }
  function back() { ui.stack.pop(); if (ui.stack.length) paint(); else closeAll(); }
  function closeAll() {
    ui.stack = [];
    const l = $("#ct-layer"); if (l) l.innerHTML = "";
    document.body.classList.remove("ct-locked");
    if (ui.pending) { ui.pending = false; compute(); draw(); }
  }
  function paint() {
    const s = ui.stack[ui.stack.length - 1]();
    const l = layer();
    document.body.classList.add("ct-locked");
    l.innerHTML = '<div class="ct-scrim" data-close></div><section class="ct-sheet" role="dialog" aria-modal="true" aria-label="' + esc(s.title) + '">' +
      '<div class="ct-grip"></div><header class="ct-sh">' +
        (ui.stack.length > 1 ? '<button class="ct-back" data-back aria-label="Back">' + I.chev + "</button>" : "") +
        "<h2>" + esc(s.title) + '</h2><button class="ct-x" data-close aria-label="Close">' + I.x + "</button></header>" +
      (s.sub ? '<p class="ct-sub">' + esc(s.sub) + "</p>" : "") +
      '<div class="ct-sb">' + s.body + "</div>" +
      (s.foot ? '<footer class="ct-sf">' + s.foot + "</footer>" : "") + "</section>";
    const el = $(".ct-sheet", l);
    l.onclick = function (e) {
      if (e.target.closest("[data-close]")) return closeAll();
      if (e.target.closest("[data-back]")) return back();
    };
    let y0 = null;
    $(".ct-grip", el).addEventListener("touchstart", function (e) { y0 = e.touches[0].clientY; }, { passive: true });
    $(".ct-grip", el).addEventListener("touchend", function (e) { if (y0 !== null && e.changedTouches[0].clientY - y0 > 60) closeAll(); y0 = null; }, { passive: true });
    if (s.bind) s.bind(el);
    const f = el.querySelector("[autofocus]"); if (f && window.matchMedia("(min-width: 768px)").matches) f.focus({ preventScroll: true });
  }
  function toast(msg) {
    let t = $("#ct-toast"); if (t) t.remove();
    t = document.createElement("div"); t.id = "ct-toast"; t.className = "ct-toast"; t.setAttribute("role", "status");
    t.textContent = msg;
    document.body.appendChild(t);
    clearTimeout(ui.toastT); ui.toastT = setTimeout(function () { if (t.parentNode) t.remove(); }, 4000);
  }

  function openAll() {
    const lv = lever();
    const sel = selectedTile(lv);
    let rows = lv.tiles[sel].rows;
    if (lv.id === "collections" && ui.colour) rows = rows.filter(function (r) { return r.colour === ui.colour; });
    sheet(function () {
      return { title: lv.tiles[sel].word + " · " + rows.length,
        body: '<div class="ct-list">' + rows.map(function (r, i) { return rowHtml(r, i, sel === "good"); }).join("") + "</div>",
        bind: function (el) { el.addEventListener("click", function (e) { const b = e.target.closest("[data-row]"); if (b) openItem(rows[+b.dataset.row], true); }); } };
    });
  }

  /* ── item sheets ───────────────────────────────────────────────────────
     One shape for every detail sheet (owner, 23 Sep 2026), because the owner
     reads them all the same way:

       title           the name that matters — a shop, a customer, a product
       sub             what this is and when: the trip, the driver, the time
       stats           the two or three figures of this one thing
       What happened   what is worth telling, good or bad, a line each
       What to do      one step the owner can take now, and the button for it

     No reference numbers. An order no, a delivery no, an invoice id tells
     the owner nothing he can act on, and the work screens hold the
     paperwork. Where FoodBridge cannot finish the job — a shop that was
     shut, a van running behind — the step is the call he would make anyway,
     with the number ready to dial. Nothing to do is said in those words.
     ──────────────────────────────────────────────────────────────────── */
  function kv(pairs) {
    return '<dl class="ct-kv">' + pairs.filter(function (p) { return p && p[1] !== null && p[1] !== undefined && p[1] !== ""; })
      .map(function (p) { return "<div><dt>" + esc(p[0]) + "</dt><dd>" + esc(p[1]) + "</dd></div>"; }).join("") + "</dl>";
  }
  /* 98200 11231 — a number the way it is read out. */
  function phoneText(p) {
    const d = String(p || "").replace(/\D/g, "");
    return d.length === 10 ? d.slice(0, 5) + " " + d.slice(5) : String(p || "");
  }
  function callBtn(label, phone, ghost) {
    if (!phone) return "";
    return '<a class="ct-btn' + (ghost ? " is-ghost" : "") + '" href="tel:' + esc(String(phone).replace(/[^\d+]/g, "")) + '">' +
      esc(label) + "<small>" + esc(phoneText(phone)) + "</small></a>";
  }
  /* Two or three figures, side by side. A figure that would read "₹0" or
     "None" is left out: an empty line is not a fact. */
  function statsHtml(list) {
    const xs = (list || []).filter(Boolean);
    if (!xs.length) return "";
    return '<div class="ct-stats">' + xs.map(function (s) {
      return '<div' + (s.tone ? ' class="is-' + s.tone + '"' : "") + "><span>" + esc(s.label) + "</span><b>" + esc(s.value) + "</b></div>";
    }).join("") + "</div>";
  }
  function tellHtml(list) {
    const xs = (list || []).filter(Boolean);
    if (!xs.length) return "";
    return '<h4 class="ct-sh4">What happened</h4><ul class="ct-inc">' + xs.map(function (i) {
      const good = i.tone === "good";
      return '<li><span class="ct-inc-i' + (good ? " is-good" : " is-bad") + '">' + (good ? I.check : I.bang) + "</span>" +
        "<span>" + esc(i.text) + (i.why ? "<small>" + esc(i.why) + "</small>" : "") + "</span></li>";
    }).join("") + "</ul>";
  }
  function todoHtml(text) {
    return '<h4 class="ct-sh4">What to do</h4><p class="ct-todo' + (text ? "" : " is-clear") + '">' +
      esc(text || "Nothing to do here.") + "</p>";
  }
  function detail(d) { return statsHtml(d.stats) + tellHtml(d.tell) + todoHtml(d.todo); }
  /* Today's stops show the time; anything older says its day too. */
  function whenOf(at) {
    const d = new Date(at);
    const clock = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }).toLowerCase();
    const today = new Date(view.state.now);
    return d.toDateString() === today.toDateString() ? clock : L.date(d.toISOString()) + ", " + clock;
  }
  function daysSince(date) { return Math.max(0, Math.round((view.state.now - new Date(String(date).slice(0, 10) + "T00:00:00Z").getTime()) / 86400000)); }

  /* Today's route, and the van as it stands: its driver, and whether it is
     still out. A van with stops left is worth a call; a finished round is
     not. */
  function routeToday() {
    const r = view.records.route;
    return r && r.day === new Date(view.state.now).toISOString().slice(0, 10) ? r : null;
  }
  function vanOf(van) {
    const r = routeToday();
    if (!r || !van) return null;
    const stops = r.stops.filter(function (s) { return s.van === van; });
    if (!stops.length) return null;
    const done = {};
    (view.records.deliveries || []).forEach(function (d) { if (d.orderNo) done[d.orderNo] = 1; });
    return { van: van, driver: stops[0].driver || null, phone: stops[0].driverPhone || null,
             left: stops.filter(function (s) { return !done[s.no]; }).length };
  }
  function driverBtn(van, phone, driver, ghost) {
    const v = vanOf(van) || {};
    const no = phone || v.phone;
    if (!no) return "";
    return callBtn("Call " + (driver || v.driver || "the driver") + " · " + van, no, ghost);
  }

  function openItem(r, push) {
    if (!r) return;
    if (r.kind === "customer") return customerSheet(r.id, push, r);
    if (r.kind === "product") return productSheet(r.id, push);
    if (r.kind === "delivery") return deliverySheet(r.ref, push);
    if (r.kind === "order") return orderSheet(r, push);
  }
  function colourMap() {
    const m = {};
    const lc = lever("collections");
    if (lc && lc.status !== "preview") [].concat(lc.tiles.ugly.rows, lc.tiles.bad.rows, lc.tiles.good.rows).forEach(function (r) { if (r.colour) m[r.id] = r.colour; });
    return m;
  }
  /* What a customer owes past its due date, read from their own invoices:
     the same money either way, whichever tile lists them. */
  function overdueOf(open) {
    const day = function (s) { return new Date(String(s).slice(0, 10) + "T00:00:00Z").getTime(); };
    const now = view.state.now;
    const late = (open || []).filter(function (i) { return i.dueDate && day(i.dueDate) < now; });
    if (!late.length) return null;
    return { value: late.reduce(function (n, i) { return n + i.balance; }, 0),
             days: Math.max.apply(null, late.map(function (i) { return Math.round((now - day(i.dueDate)) / 86400000); })) };
  }
  function soonestDue(open) {
    const day = function (s) { return new Date(String(s).slice(0, 10) + "T00:00:00Z").getTime(); };
    const ds = (open || []).filter(function (i) { return i.dueDate && day(i.dueDate) >= view.state.now; })
      .map(function (i) { return Math.max(1, Math.round((day(i.dueDate) - view.state.now) / 86400000)); });
    return ds.length ? Math.min.apply(null, ds) : null;
  }
  function lastPaymentOf(id) {
    const l = view.state.ledger;
    const today = new Date(view.state.now).toISOString().slice(0, 10);
    const ps = (l && l.payments ? l.payments : []).filter(function (p) { return p.customerId === id && String(p.date).slice(0, 10) <= today; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return ps[0] || null;
  }
  /* The last reminder this business sent them, in days. */
  function lastReminderOf(id) {
    const ms = (view.records.outbox || []).filter(function (m) { return m.customerId === id && m.createdAt; })
      .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    return ms.length ? daysSince(ms[0].createdAt) : null;
  }

  /* ── a stop on today's route ──────────────────────────────────────── */
  function deliverySheet(dl, push) {
    const st = view.state;
    const name = st.customerById[dl.customerId] || dl.customerId;
    const shop = (st.phoneById || {})[dl.customerId] || null;
    const e = dl.empties || {};
    const out = Number(e.cratesOut) || 0, back = Number(e.cratesBack) || 0;
    const crates = Math.max(0, out - back);
    const bottles = Math.max(0, out * L.T.KIT_BOTTLES - (Number(e.bottlesBack) || 0));
    const late = Number(dl.lateMin) > L.T.LATE_MIN ? Number(dl.lateMin) : 0;
    const short = Number(dl.shortCases) || 0;
    const returned = Number(dl.returnedCases) || 0;
    const money = Number(dl.collected) || 0;
    const worth = Number(dl.value) || 0;
    const cases = Number(dl.cases) || 0;
    const missed = dl.status === "missed";
    const shopSide = ["Shop closed", "Refused", "Payment not ready"].indexOf(dl.reason) !== -1;
    const van = vanOf(dl.van);

    const stats = missed
      ? [worth ? { label: "Not delivered", value: L.rupees(worth), tone: "bad" } : null]
      : [{ label: "Collected", value: L.rupees(money) || "₹0", tone: money ? "good" : "bad" },
         cases ? { label: "Cases", value: short ? (cases - short) + " of " + cases : String(cases), tone: short ? "bad" : null } : null,
         out ? { label: "Crates back", value: back + " of " + out, tone: crates ? "bad" : "good" } : null];

    const tell = missed
      ? [{ text: dl.reason || "Missed", why: dl.reason === "Van full" ? "Booked past what the van could carry." : null }]
      : [late ? { text: "Reached " + L.mins(late) + " late", why: dl.lateWhy || null } : null,
         short ? { text: L.plural(short, "case") + " short", why: "Loaded short of what was booked." } : null,
         returned ? { text: L.plural(returned, "case") + " came back", why: null } : null,
         crates ? { text: L.plural(crates, "crate") + " not back", why: bottles ? L.plural(bottles, "bottle") + " still with them" : null } : null,
         !money && worth ? { text: L.rupees(worth) + " went on credit", why: null } : null];
    if (!missed && !tell.filter(Boolean).length) tell.push({ text: "On time, in full, paid at the door", tone: "good" });

    let todo = null;
    const acts = [];
    if (missed) {
      if (dl.rescheduledFor) todo = "On the trip for " + L.date(dl.rescheduledFor) + ". Nothing else to do.";
      else if (shopSide && shop) {
        todo = "Ask when they will take it, then put it on tomorrow's trip.";
        acts.push(callBtn("Call the shop", shop), '<button class="ct-btn is-ghost" data-a="re">Reschedule</button>');
      } else {
        todo = dl.reason === "Van full" ? "It never left the dock. Put it on tomorrow's first round." : "Put it back on a trip.";
        acts.push('<button class="ct-btn" data-a="re">Reschedule</button>');
        if (shop) acts.push(callBtn("Call the shop", shop, true));
      }
    } else if (crates) {
      todo = "Ask them to keep " + L.plural(crates, "crate") + " ready for the next trip.";
      if (shop) acts.push(callBtn("Call the shop", shop));
    } else if (short) {
      todo = short === 1 ? "Tell them the case that was short follows on the next trip."
        : "Tell them the " + short + " cases follow on the next trip.";
      if (shop) acts.push(callBtn("Call the shop", shop));
    } else if (returned) {
      todo = "Find out why they came back, and take them into stock before they are sold twice.";
      if (shop) acts.push(callBtn("Call the shop", shop));
    } else if (late && van && van.left) {
      todo = dl.van + " still has " + L.plural(van.left, "stop") + " to make and is running behind.";
      acts.push(driverBtn(dl.van, dl.driverPhone, dl.driver));
    }

    sheet(function () {
      return { title: name,
        sub: [(missed ? "Missed " : "Delivered ") + whenOf(dl.at), dl.van, dl.driver].filter(Boolean).join(" · "),
        body: detail({ stats: stats, tell: tell, todo: todo }),
        foot: acts.filter(Boolean).join(""),
        bind: function (el) { const b = $("[data-a=re]", el.parentNode); if (b) b.addEventListener("click", function () { rescheduleSheet([dl.no], true); }); } };
    }, push);
  }

  /* ── a customer ───────────────────────────────────────────────────
     The same customer answers a different question in each lever: in
     Collections the money, in Order the buying (owner, 23 Sep 2026). */
  function customerSheet(id, push, row) {
    const st = view.state;
    const name = st.customerById[id] || id;
    const phone = (st.phoneById || {})[id] || null;
    const cad = st.cadence.filter(function (x) { return x.id === id; })[0] || {};
    const held = !!(view.records.holds || {})[id];
    const colour = colourMap()[id] || null;
    const open = st.ledger && st.ledger.invoices ? st.ledger.invoices.filter(function (i) { return i.customerId === id && i.balance > 0; }) : null;
    const outstanding = open ? open.reduce(function (n, i) { return n + i.balance; }, 0) : null;
    const ov = overdueOf(open);
    const dueIn = soonestDue(open);
    const emp = emptiesOf(id);
    const paid = lastPaymentOf(id);
    const reminded = lastReminderOf(id);
    const good = !!(row && row.good);
    const buying = ui.tab === "order";
    const overdueDays = Number(cad.daysOverdue) || 0;             // past their usual order day
    const gap = cad.cycleDays || null;
    const since = cad.lastOrderAt ? daysSince(cad.lastOrderAt) : null;

    const stats = buying
      ? [cad.avgValue ? { label: "Usual order", value: L.rupees(cad.avgValue) } : null,
         gap ? { label: "Usually every", value: L.plural(gap, "day") } : null,
         since !== null ? { label: "Last order", value: since === 0 ? "Today" : L.plural(since, "day") + " ago", tone: overdueDays > 0 ? "bad" : null } : null]
      : good
        ? [{ label: "Received", value: L.rupees(row.value), tone: "good" },
           ov ? { label: "Still overdue", value: L.rupees(ov.value), tone: "bad" } : null,
           emp ? { label: "Empties with them", value: emp } : null]
        : [ov ? { label: "Overdue", value: L.rupees(ov.value), tone: "bad" } : null,
           ov ? { label: "Oldest", value: L.plural(ov.days, "day"), tone: "bad" } : null,
           !ov && outstanding ? { label: "Not due yet", value: L.rupees(outstanding) } : null,
           emp ? { label: "Empties with them", value: emp } : null];

    const tell = [];
    if (buying) {
      /* The stats already carry the gap and the last order: this line says
         what those figures mean, never the same figure again. */
      if (overdueDays > 0) tell.push({ tone: "bad", text: L.plural(overdueDays, "day") + " past their usual order day" });
      if (ov) tell.push({ tone: "bad", text: L.rupees(ov.value) + " overdue for " + L.plural(ov.days, "day"), why: "Collect it with the next order." });
      if (overdueDays <= 0 && !ov && since !== null) tell.push({ tone: "good", text: "Ordering on their usual cycle" });
    } else {
      if (good) tell.push({ tone: "good",
        text: row.stuck ? "Stuck " + L.plural(row.late, "day") + " — now paid"
          : row.late > 0 ? "Paid, " + L.plural(row.late, "day") + " late" : "Paid on time" });
      else if (paid && daysSince(paid.date) <= 30) tell.push({ tone: "good", text: "Paid " + L.rupees(Number(paid.amount) || 0) + " on " + L.date(paid.date) });
      if (!good && ov && (!paid || daysSince(paid.date) > L.T.FIRE_QUIET_DAYS)) {
        tell.push({ tone: "bad", text: paid ? "No payment in " + L.plural(daysSince(paid.date), "day") : "No payment on record" });
      }
      if (reminded !== null && ov) tell.push({ tone: "bad", text: reminded ? "Reminded " + L.plural(reminded, "day") + " ago" : "Reminded today", why: "Still not paid." });
      if (good && !ov) tell.push({ tone: "good", text: "Nothing overdue now" });
    }
    if (held) tell.push({ tone: "bad", text: "Supply stopped" });

    let todo = null;
    const acts = [];
    const callShop = callBtn("Call the shop", phone);
    const callShopG = callBtn("Call the shop", phone, true);
    const order = '<button class="ct-btn" data-a="order">New order</button>';
    const orderG = '<button class="ct-btn is-ghost" data-a="order">New order</button>';
    if (held) {
      todo = "Supply is stopped. Clear the money first, then restart them.";
      acts.push(callShop, '<button class="ct-btn' + (phone ? " is-ghost" : "") + '" data-a="unhold">Restart supply</button>');
    } else if (buying) {
      if (overdueDays > 0) {
        todo = "Call and find out why they stopped, then take the usual order.";
        acts.push(callShop, phone ? orderG : order);
      } else {
        todo = "Nothing owing on their ordering. Take the next order when it is due.";
        acts.push(order, callShopG);
      }
    } else if (colour === "fire") {
      todo = "Over " + L.T.FIRE_DAYS + " days with no payment. Call the owner; with no date from them, stop supply.";
      acts.push(callShop, '<button class="ct-btn is-danger" data-a="hold">Stop supply</button>');
    } else if (ov && good) {
      todo = "Money is moving. Ask for the rest while they are paying.";
      acts.push(callShop, '<button class="ct-btn' + (phone ? " is-ghost" : "") + '" data-a="remind">Send reminder</button>');
    } else if (ov) {
      todo = "Ask for a date and a figure, and hold them to it.";
      acts.push(callShop, '<button class="ct-btn' + (phone ? " is-ghost" : "") + '" data-a="remind">Send reminder</button>');
    } else if (outstanding && dueIn !== null) {
      todo = "Falls due in " + L.plural(dueIn, "day") + ". Nothing to chase yet.";
      acts.push(orderG);
    } else {
      todo = "Nothing to collect. A good time to sell them more.";
      acts.push(order);
    }

    sheet(function () {
      return { title: name,
        sub: buying
          ? (ov ? L.rupees(ov.value) + " overdue" : outstanding ? L.rupees(outstanding) + " not due yet" : "Nothing overdue")
          : ([gap ? "Orders every " + L.plural(gap, "day") : null,
              cad.lastOrderAt ? "last on " + L.date(cad.lastOrderAt) : null].filter(Boolean).join(" · ") || null),
        body: (colour ? '<p class="ct-badge"><i class="ct-cdot" data-c="' + colour + '">' + (colour === "fire" ? I.flame : "") + "</i>" + COLOUR[colour] + "</p>" : "") +
          detail({ stats: stats, tell: tell, todo: todo }),
        foot: acts.filter(Boolean).join(""),
        bind: function (el) {
          el.parentNode.addEventListener("click", function (e) {
            const b = e.target.closest("[data-a]"); if (!b) return;
            const a = b.dataset.a;
            if (a === "remind") reminders([id], true);
            if (a === "hold") confirmHold(id, true);
            if (a === "unhold") confirmHold(id, false);
            if (a === "order") newOrder(id, true);
          });
        } };
    }, push);
  }

  /* ── a product ────────────────────────────────────────────────────── */
  function productSheet(id, push) {
    const d = window.CTSignals._detectors.demand(view.state).filter(function (x) { return x.product.id === id; })[0];
    if (!d) return;
    const p = d.product;
    const week = d.daily ? Math.round(d.daily * 7) : 0;
    const counted = p.stock !== null;
    const have = Math.max(0, d.available || 0);
    const dead = !d.daily && have > 0;
    const cover = d.available === null ? null : d.available <= 0 ? "Out" : isFinite(d.cover) ? Math.floor(d.cover) + " days" : null;
    const value = dead && p.mrp ? have * p.mrp : 0;
    const supplier = (view.state.suppliers || []).filter(function (s) { return s.category && s.category === p.category; })[0];
    const booked = Number(d.committed) || 0;

    const stats = [{ label: "In stock", value: counted ? String(have) : "Not counted", tone: counted && have <= 0 ? "bad" : null },
                   cover ? { label: "Lasts", value: cover, tone: d.available <= 0 || d.cover < L.T.HEALTHY_DAYS ? "bad" : "good" } : null,
                   week ? { label: "Sells a week", value: String(week) } : null];

    const tell = [!counted ? { tone: "bad", text: "Never counted", why: "The figure above is what the records imply, not a count." } : null,
                  counted && have <= 0 && week ? { tone: "bad", text: "Out of stock", why: week + " a week go out — every day out is a sale lost." } : null,
                  booked && booked > have ? { tone: "bad", text: L.plural(booked, "unit") + " booked on orders", why: have <= 0 ? "Nothing on the shelf to fill them." : "More than the shelf holds." } : null,
                  counted && have > 0 && week && d.cover < L.T.HEALTHY_DAYS ? { tone: "bad", text: "Below two weeks of stock" } : null,
                  d.onOrder ? { tone: "good", text: d.onOrder + " already on order" } : null,
                  dead ? { tone: "bad", text: "No sale in " + L.T.DEAD_DAYS + " days", why: value ? L.rupees(value) + " sitting on the shelf" : null } : null];

    let todo = null;
    const acts = [];
    if (dead) {
      todo = "It is not selling. Offer it to the shops that bought it before.";
      acts.push('<button class="ct-btn" data-a="offer">Offer to past buyers</button>', '<button class="ct-btn is-ghost" data-a="count">Count stock</button>');
    } else if (!counted) {
      todo = "Count it before you buy: the reorder is only as good as the figure.";
      acts.push('<button class="ct-btn" data-a="count">Count stock</button>');
    } else if (d.onOrder && have <= 0) {
      todo = "It is on order already. Chase the supplier rather than raise another.";
      acts.push('<button class="ct-btn is-ghost" data-a="po">Add to purchase order</button>');
    } else if (week && (have <= 0 || d.cover < L.T.HEALTHY_DAYS)) {
      todo = "Order today so it lands before the next trips.";
      acts.push('<button class="ct-btn" data-a="po">Add to purchase order</button>', '<button class="ct-btn is-ghost" data-a="count">Count stock</button>');
    } else {
      todo = "Enough for now. Nothing to do.";
      acts.push('<button class="ct-btn is-ghost" data-a="count">Count stock</button>');
    }

    sheet(function () {
      return { title: p.name,
        sub: supplier ? "From " + supplier.name : week ? "Fast mover" : "Not selling",
        body: detail({ stats: stats, tell: tell, todo: todo }),
        foot: acts.join(""),
        bind: function (el) {
          el.parentNode.addEventListener("click", function (e) {
            const b = e.target.closest("[data-a]"); if (!b) return;
            if (b.dataset.a === "po") purchaseSheet([id], true);
            if (b.dataset.a === "count") countSheet(id, true);
            if (b.dataset.a === "offer") offerSheet("slow-stock");
          });
        } };
    }, push);
  }

  /* ── an order still to deliver ────────────────────────────────────── */
  function orderSheet(r, push) {
    const st = view.state;
    const o = (st.made || []).filter(function (x) { return x.no === r.id; })[0] || null;
    const stop = r.ref || null;
    const id = (o && o.customerId) || (stop && stop.customerId) || null;
    const phone = id ? (st.phoneById || {})[id] : null;
    const van = stop && stop.van ? vanOf(stop.van) : null;
    const due = stop && stop.slot ? new Date(stop.slot).getTime() : null;
    const lateMin = due ? Math.round((st.now - due) / 60000) : 0;
    const late = lateMin > L.T.LATE_MIN ? lateMin : 0;
    const worth = typeof r.value === "number" ? r.value : (o && typeof o.amount === "number" ? o.amount : null);
    const cases = stop && stop.cases ? stop.cases : null;
    const items = o ? (o.lines || []).reduce(function (n, l) { return n + (Number(l.qty) || 0); }, 0) : 0;

    const stats = [worth !== null ? { label: "Worth", value: L.rupees(worth) } : null,
                   cases ? { label: "Cases", value: String(cases) } : null,
                   !cases && items ? { label: "Items", value: String(items) } : null];

    const tell = [late ? { tone: "bad", text: "Running " + L.mins(late) + " late", why: stop && stop.van ? stop.van + " is past this stop's time." : null } : null,
                  !stop && o ? { tone: "good", text: "Booked in FoodBridge", why: "Not on a van yet — it goes on the next trip." } : null];

    let todo = null;
    const acts = [];
    if (late && stop && (stop.driverPhone || (van && van.phone))) {
      todo = "Ask the driver where he is, and tell the shop when to expect him.";
      acts.push(driverBtn(stop.van, stop.driverPhone, stop.driver));
      if (phone) acts.push(callBtn("Call the shop", phone, true));
    } else if (id) {
      todo = stop && stop.van ? "On the van and on time. Nothing to do yet."
        : "Not on a van yet — it goes on the next trip.";
      acts.push('<button class="ct-btn is-ghost" data-a="dl">Record delivery</button>');
      if (phone) acts.push(callBtn("Call the shop", phone, true));
    }

    sheet(function () {
      return { title: r.title,
        sub: stop && stop.van ? ["On " + stop.van, stop.driver, due ? "due " + whenOf(due) : null].filter(Boolean).join(" · ")
          : "Booked · not on a van yet",
        body: detail({ stats: stats, tell: tell, todo: todo }),
        foot: acts.filter(Boolean).join(""),
        bind: function (el) {
          const b = $("[data-a=dl]", el.parentNode);
          if (b) b.addEventListener("click", function () { deliveryDetails(id, o || (stop ? { no: stop.no, customerId: id } : null), true); });
        } };
    }, push);
  }
  /* Empties still with a customer: crates out, less what came back. */
  function emptiesOf(id) {
    const d = (view.records.deliveries || []).filter(function (x) { return x.customerId === id; });
    if (!d.length) return null;
    let crates = 0, bottles = 0;
    d.forEach(function (x) { const e = x.empties || {}; crates += (+e.cratesOut || 0) - (+e.cratesBack || 0); bottles += (+e.cratesOut || 0) * L.T.KIT_BOTTLES - (+e.bottlesBack || 0); });
    return L.emptiesLine({ crates: Math.max(0, crates), bottles: Math.max(0, bottles) }) || null;
  }

  /* ════════════════════════════════════════════════════════════════════
     ACT — every change goes through one confirm sheet
     ════════════════════════════════════════════════════════════════════ */
  function doAction() {
    const lv = lever();
    if (lv.status === "preview") {
      const c = lv.preview.connect;
      if (c.create) return openCreateFlow(c.create);
      if (c.route) return go(c.route);
      return;
    }
    const a = lv.action; if (!a) return;
    if (a.kind === "reminders") return reminders(a.ids);
    if (a.kind === "purchase") return purchaseSheet(a.ids);
    if (a.kind === "orders") return ordersSheet(a.signal);
    if (a.kind === "reschedule") return rescheduleSheet(a.nos);
  }
  function doGrow() {
    const g = lever().grow; if (!g) return;
    if (g.tab) return setTab(g.tab);
    if (g.kind === "offer") return offerSheet(g.signal);
  }
  function stepper(k, q) {
    return '<span class="ct-step"><button type="button" data-step="' + k + '" data-d="-1" aria-label="Less">' + I.minus + "</button>" +
      '<input type="number" inputmode="numeric" min="0" data-q="' + k + '" value="' + (q || 0) + '" aria-label="Quantity">' +
      '<button type="button" data-step="' + k + '" data-d="1" aria-label="More">' + I.plus + "</button></span>";
  }
  function wireSteps(el, onChange) {
    el.addEventListener("click", function (e) {
      const b = e.target.closest("[data-step]"); if (!b) return;
      const inp = $('input[data-q="' + b.dataset.step + '"]', el);
      inp.value = Math.max(0, (parseInt(inp.value, 10) || 0) + Number(b.dataset.d));
      inp.dispatchEvent(new Event("input", { bubbles: true }));
    });
    el.addEventListener("input", function (e) { if (e.target.dataset.q !== undefined && onChange) onChange(e.target.dataset.q, Math.max(0, parseInt(e.target.value, 10) || 0)); });
  }
  function run(pv) {
    try { return tower.actions.execute(pv, { confirmed: true, actor: "owner" }); }
    catch (e) { return { ok: false, error: { message: e.message } }; }
  }

  /* Collections · reminders, the tone set by the customer's colour */
  function reminders(ids, push) {
    const pv = tower.actions.prepare("overdue");
    if (!pv.ok) return toast(pv.error.message);
    const cm = colourMap();
    const want = {}; (ids || []).forEach(function (x) { want[x] = 1; });
    let msgs = pv.messages.filter(function (m) { return !ids || want[m.customerId]; });
    if (!msgs.length && ids && ids.length === 1) {
      const st = view.state;
      const open = st.ledger && st.ledger.invoices ? st.ledger.invoices.filter(function (i) { return i.customerId === ids[0] && i.balance > 0; }) : null;
      const ov = overdueOf(open);
      const name = st.customerById[ids[0]] || ids[0];
      if (ov) msgs = [{ customerId: ids[0], name: name, include: true, amount: ov.value,
        body: "Hello " + name + ", a reminder: " + L.rupees(ov.value) + " is overdue. Please arrange payment. Thank you." }];
    }
    if (!msgs.length) return toast("Nothing to remind right now.");
    msgs.forEach(function (m) {
      const c = cm[m.customerId];
      m.body = (c === "red" ? "Final reminder. " : c === "orange" ? "Reminder. " : "Gentle reminder. ") + m.body;
    });
    pv.messages = msgs;
    const total = msgs.reduce(function (n, m) { return n + m.amount; }, 0);
    sheet(function () {
      return { title: "Remind " + L.plural(msgs.length, "customer"), sub: L.rupees(total) + " · WhatsApp with their invoices",
        body: '<div class="ct-checks">' + msgs.map(function (m, i) {
          return '<label class="ct-check"><input type="checkbox" data-i="' + i + '" checked><span>' + esc(m.name) + "</span><b>" + esc(L.rupees(m.amount)) + "</b></label>";
        }).join("") + "</div>" +
          '<details class="ct-msg"><summary>Edit messages</summary>' + msgs.map(function (m, i) {
            return '<label class="ct-field"><span>' + esc(m.name) + '</span><textarea data-body="' + i + '">' + esc(m.body) + "</textarea></label>";
          }).join("") + "</details>" +
          '<p class="ct-note">No WhatsApp sender is connected in this demo, so reminders wait in the outbox.</p>',
        foot: '<button class="ct-btn is-wide" data-go>Send ' + L.plural(msgs.length, "reminder") + "</button>",
        bind: function (el) {
          const go = $("[data-go]", el.parentNode);
          const n = function () { return msgs.filter(function (m) { return m.include; }).length; };
          el.addEventListener("change", function (e) { if (e.target.dataset.i !== undefined) { msgs[+e.target.dataset.i].include = e.target.checked; go.textContent = "Send " + L.plural(n(), "reminder"); go.disabled = !n(); } });
          el.addEventListener("input", function (e) { if (e.target.dataset.body !== undefined) msgs[+e.target.dataset.body].body = e.target.value; });
          go.addEventListener("click", function () {
            go.disabled = true;
            const res = run(pv);
            if (!res.ok) { go.disabled = false; return toast(res.error.message); }
            closeAll(); after(L.plural(n(), "reminder") + " queued");
          });
        } };
    }, push);
  }

  /* Purchase / Inventory · purchase orders, one per supplier */
  function purchaseSheet(ids, push) {
    const want = {}; (ids || []).forEach(function (x) { want[x] = 1; });
    const sig = tower.actions.prepare("stockout");
    const base = tower.actions.preparePurchase();
    const pool = {};
    (base.ok ? base.lines : []).forEach(function (l) { pool[l.productId] = Object.assign({}, l); });
    (sig.ok ? sig.lines : []).forEach(function (l) { pool[l.productId] = Object.assign({}, l); });
    let lines = Object.keys(pool).map(function (k) { return pool[k]; });
    if (ids) {
      lines = lines.filter(function (l) { return want[l.productId]; });
      ids.forEach(function (id) {
        if (pool[id]) return;
        const p = view.state.productById[id];
        if (p) lines.push({ productId: id, name: p.name, qty: 1, suggestedQty: 1, unit: p.unit, mrp: p.mrp, supplierId: null, supplierName: null });
      });
    } else lines = lines.filter(function (l) { return l.qty > 0; });
    if (!lines.length) return toast("Nothing needs buying right now.");
    const groups = {};
    lines.forEach(function (l) { const k = l.supplierName || "No supplier on file"; (groups[k] || (groups[k] = [])).push(l); });
    const names = Object.keys(groups);
    const value = function () {
      const t = lines.reduce(function (n, l) { return n + (l.mrp ? l.qty * l.mrp : 0); }, 0);
      return t ? L.rupees(t) + " at MRP" : "";
    };
    sheet(function () {
      return { title: "Raise " + L.plural(names.length, "purchase order"), sub: value(),
        body: names.map(function (s, gi) {
          return '<section class="ct-group"><h4>' + esc(s) + "</h4>" + groups[s].map(function (l, li) {
            return '<div class="ct-qline"><span>' + esc(l.name) + (l.hint ? "<small>" + esc(l.hint) + "</small>" : "") + "</span>" + stepper(gi + ":" + li, l.qty) + "</div>";
          }).join("") + "</section>";
        }).join("") + '<p class="ct-note">Raised in FoodBridge for you to place with the supplier.</p>',
        foot: '<button class="ct-btn is-wide" data-go>Raise ' + L.plural(names.length, "purchase order") + "</button>",
        bind: function (el) {
          wireSteps(el, function (k, v) { const p = k.split(":"); groups[names[+p[0]]][+p[1]].qty = v; const s = $(".ct-sub", el.parentNode); if (s) s.textContent = value(); });
          $("[data-go]", el.parentNode).addEventListener("click", function (e) {
            e.target.disabled = true;
            let made = 0, err = null;
            names.forEach(function (s) {
              const ls = groups[s].filter(function (l) { return l.qty > 0; });
              if (!ls.length) return;
              const r = run(Object.assign({}, base.ok ? base : sig, { actionType: "create_purchase_request", signalId: null, lines: ls }));
              if (r.ok) made += 1; else err = r.error.message;
            });
            if (!made) { e.target.disabled = false; return toast(err || "Nothing to order."); }
            closeAll(); after(L.plural(made, "purchase order") + " raised");
          });
        } };
    }, push);
  }

  /* Order · the usual orders */
  function ordersSheet(signal, push, pvIn) {
    const pv = pvIn || tower.actions.prepare(signal || "reorder-due");
    if (!pv.ok) return toast(pv.error.message);
    const shops = pv.shops;
    const cm = colourMap();
    const holds = view.records.holds || {};
    shops.forEach(function (s) { if (holds[s.customerId]) s.include = false; });
    const n = function () { return shops.filter(function (s) { return s.include && s.lines.some(function (l) { return l.qty > 0; }); }).length; };
    sheet(function () {
      return { title: pvIn ? pv.title : "Prepare " + L.plural(shops.length, "usual order"), sub: pv.basis || "From what each customer usually buys",
        body: shops.map(function (s, si) {
          const c = cm[s.customerId];
          return '<section class="ct-group"><label class="ct-check is-head"><input type="checkbox" data-shop="' + si + '"' + (s.include ? " checked" : "") + "><span>" + esc(s.name) + "</span>" +
            (holds[s.customerId] ? '<b class="ct-warn">Supply stopped</b>' : c === "red" || c === "fire" ? '<b class="ct-warn">Overdue · collect with this order</b>' : "") + "</label>" +
            (s.lines.length ? s.lines.map(function (l, li) {
              return '<div class="ct-qline"><span>' + esc(l.name) + "</span>" + stepper(si + ":" + li, l.qty) + "</div>";
            }).join("") : '<p class="ct-note">No lines to start from.</p>') + "</section>";
        }).join(""),
        foot: '<button class="ct-btn is-wide" data-go>Create ' + L.plural(n(), "order") + "</button>",
        bind: function (el) {
          const go = $("[data-go]", el.parentNode);
          const sync = function () { go.textContent = "Create " + L.plural(n(), "order"); go.disabled = !n(); };
          wireSteps(el, function (k, v) { const p = k.split(":"); shops[+p[0]].lines[+p[1]].qty = v; sync(); });
          el.addEventListener("change", function (e) { if (e.target.dataset.shop !== undefined) { shops[+e.target.dataset.shop].include = e.target.checked; sync(); } });
          sync();
          go.addEventListener("click", function () {
            go.disabled = true;
            const count = n();
            const res = run(pv);
            if (!res.ok) { go.disabled = false; return toast(res.error.message); }
            closeAll(); after(L.plural(count, "order") + " created · on the next trips");
          });
        } };
    }, push);
  }
  function newOrder(customerId, push) {
    const pv = tower.actions.prepareOrder(customerId);
    if (!pv.ok) return toast(pv.error.message);
    ordersSheet(null, push, pv);
  }

  /* Grow · an offer list (dead stock to past buyers, fast sellers to new) */
  function offerSheet(signal) {
    const pv = tower.actions.prepare(signal, "create_followup");
    if (!pv.ok) return toast(pv.error.message);
    const cs = pv.customers;
    sheet(function () {
      return { title: signal === "slow-stock" ? "Offer dead stock" : "Offer fast sellers", sub: "A call list of " + L.plural(cs.length, "customer"),
        body: '<div class="ct-checks">' + cs.map(function (c, i) { return '<label class="ct-check"><input type="checkbox" data-i="' + i + '" checked><span>' + esc(c.name) + "</span></label>"; }).join("") + "</div>",
        foot: '<button class="ct-btn is-wide" data-go>Save call list</button>',
        bind: function (el) {
          el.addEventListener("change", function (e) { if (e.target.dataset.i !== undefined) cs[+e.target.dataset.i].include = e.target.checked; });
          $("[data-go]", el.parentNode).addEventListener("click", function () {
            const res = run(pv); if (!res.ok) return toast(res.error.message);
            closeAll(); after("Call list saved · " + L.plural(cs.filter(function (c) { return c.include; }).length, "customer"));
          });
        } };
    });
  }

  /* Deliveries · reschedule the missed */
  function rescheduleSheet(nos, push) {
    const all = (view.records.deliveries || []).filter(function (d) { return nos.indexOf(d.no) !== -1; });
    const pick = {}; all.forEach(function (d) { pick[d.no] = true; });
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const n = function () { return Object.keys(pick).filter(function (k) { return pick[k]; }).length; };
    sheet(function () {
      return { title: "Reschedule " + L.plural(all.length, "delivery", "deliveries"), sub: "On tomorrow's trips",
        body: '<div class="ct-checks">' + all.map(function (d) {
          return '<label class="ct-check"><input type="checkbox" data-no="' + esc(d.no) + '" checked><span>' + esc(view.state.customerById[d.customerId] || d.customerId) + "<small>" + esc(d.reason || "Missed") + "</small></span></label>";
        }).join("") + "</div>",
        foot: '<button class="ct-btn is-wide" data-go>Reschedule ' + L.plural(all.length, "delivery", "deliveries") + "</button>",
        bind: function (el) {
          const go = $("[data-go]", el.parentNode);
          el.addEventListener("change", function (e) {
            if (e.target.dataset.no) pick[e.target.dataset.no] = e.target.checked;
            go.textContent = "Reschedule " + L.plural(n(), "delivery", "deliveries"); go.disabled = !n();
          });
          go.addEventListener("click", function () {
            const list = Object.keys(pick).filter(function (k) { return pick[k]; });
            try { tower.store.rescheduleDeliveries(list, tomorrow); } catch (e) { return toast(e.message + " Nothing was changed."); }
            closeAll(); after(L.plural(list.length, "delivery", "deliveries") + " on tomorrow's trips");
          });
        } };
    }, push);
  }

  /* Collections · stop or restart supply (Fire) — asks once more */
  function confirmHold(id, on) {
    const name = view.state.customerById[id] || id;
    sheet(function () {
      return { title: on ? "Stop supply to " + name + "?" : "Restart supply to " + name + "?",
        sub: on ? "Their orders are held until you restart. Collect their empties first." : "They can order again.",
        body: "",
        foot: '<button class="ct-btn is-ghost" data-back>Cancel</button><button class="ct-btn' + (on ? " is-danger" : "") + '" data-go>' + (on ? "Stop supply" : "Restart supply") + "</button>",
        bind: function (el) {
          $("[data-go]", el.parentNode).addEventListener("click", function () {
            try { tower.store.setHold(id, on); tower.store.audit({ kind: "action", action: on ? "hold_supply" : "release_supply", outcome: name }); }
            catch (e) { return toast(e.message + " Nothing was changed."); }
            closeAll(); after(on ? "Supply stopped · " + name : "Supply restarted · " + name);
          });
        } };
    }, true);
  }

  /* ════════════════════════════════════════════════════════════════════
     CREATE — one quick entry per lever, in tab order
     ════════════════════════════════════════════════════════════════════ */
  function openCreate() {
    sheet(function () {
      return { title: "Create",
        body: '<div class="ct-list ct-create">' + CREATE.map(function (c) {
          return '<button class="ct-row" data-c="' + c.id + '"><span class="ct-cic">' + c.icon + '</span><span class="ct-row-t">' + esc(c.label) + '</span><span class="ct-go">' + I.chev + "</span></button>";
        }).join("") + "</div>",
        bind: function (el) { el.addEventListener("click", function (e) { const b = e.target.closest("[data-c]"); if (b) openCreateFlow(b.dataset.c, true); }); } };
    });
  }
  function openCreateFlow(kind, push) {
    if (kind === "delivery") return deliveryForm(push);
    if (kind === "payment") return paymentForm(push);
    if (kind === "purchase") return purchaseSheet(null, push);
    if (kind === "count") return countSheet(null, push);
    if (kind === "order") return pickCustomer("New order", function (id) { newOrder(id, true); }, push);
  }
  function pickCustomer(title, done, push, first) {
    /* The suggested ones first, in the order given (largest owed first). */
    const firstSet = {}; (first || []).forEach(function (id, i) { if (!(id in firstSet)) firstSet[id] = i + 1; });
    const rank = function (c) { return firstSet[c.id] || 1e9; };
    const all = view.state.customers.slice().sort(function (a, b) { return rank(a) - rank(b) || a.name.localeCompare(b.name); });
    sheet(function () {
      return { title: title,
        body: '<label class="ct-search"><input type="search" placeholder="Search customers" autofocus data-q aria-label="Search customers"></label><div class="ct-list ct-picks" data-picks></div>',
        bind: function (el) {
          const box = $("[data-picks]", el);
          const paintList = function (q) {
            const t = String(q || "").toLowerCase();
            const hits = all.filter(function (c) { return !t || c.name.toLowerCase().indexOf(t) !== -1; }).slice(0, 40);
            box.innerHTML = hits.length ? hits.map(function (c) {
              return '<button class="ct-row" data-id="' + esc(c.id) + '"><span class="ct-row-t">' + esc(c.name) + (firstSet[c.id] ? "<small>" + esc(first.label || "Suggested") + "</small>" : "") + '</span><span class="ct-go">' + I.chev + "</span></button>";
            }).join("") : '<p class="ct-empty">No customer found.</p>';
          };
          paintList("");
          $("[data-q]", el).addEventListener("input", function (e) { paintList(e.target.value); });
          box.addEventListener("click", function (e) { const b = e.target.closest("[data-id]"); if (b) done(b.dataset.id); });
        } };
    }, push);
  }

  /* Record a delivery: delivered · missed · returned, money, empties, next order */
  function deliveryForm(push) {
    const pend = (view.state.made || []).map(function (o) { return o.customerId; });
    pend.label = "Order waiting";
    pickCustomer("Record a delivery", function (id) {
      const o = (view.state.made || []).filter(function (x) { return x.customerId === id; }).slice(-1)[0] || null;
      deliveryDetails(id, o, true);
    }, push, pend);
  }
  function deliveryDetails(customerId, order, push) {
    const f = { status: "delivered", reason: null, returnedCases: 0, shortCases: 0, collected: "", cratesOut: 0, cratesBack: 0, bottlesBack: 0, nextOrder: false };
    const REASONS = ["Shop closed", "Refused", "Payment not ready", "Other"];
    sheet(function () {
      return { title: view.state.customerById[customerId] || customerId, sub: order ? order.no : "Delivery today",
        body: '<div class="ct-seg" role="radiogroup" aria-label="Status">' + [["delivered", "Delivered"], ["missed", "Missed"], ["returned", "Returned"]].map(function (s) {
            return '<button type="button" role="radio" data-st="' + s[0] + '" aria-checked="' + (f.status === s[0]) + '">' + s[1] + "</button>";
          }).join("") + "</div>" +
          '<div data-missed hidden><p class="ct-lab">Why</p><div class="ct-chips">' + REASONS.map(function (r) { return '<button type="button" data-reason="' + esc(r) + '" aria-pressed="false">' + esc(r) + "</button>"; }).join("") + "</div></div>" +
          '<div data-done>' +
            '<label class="ct-field"><span>Money collected</span><input type="number" inputmode="numeric" min="0" placeholder="₹0" data-money></label>' +
            '<div class="ct-qline"><span>Returned cases</span>' + stepper("returnedCases", 0) + "</div>" +
            '<div class="ct-qline"><span>Short cases</span>' + stepper("shortCases", 0) + "</div>" +
            '<p class="ct-lab">Empties</p>' +
            '<div class="ct-qline"><span>Crates out<small>12 bottles each</small></span>' + stepper("cratesOut", 0) + "</div>" +
            '<div class="ct-qline"><span>Crates back</span>' + stepper("cratesBack", 0) + "</div>" +
            '<div class="ct-qline"><span>Bottles back</span>' + stepper("bottlesBack", 0) + "</div>" +
            '<p class="ct-note" data-kit hidden></p>' +
            '<label class="ct-check"><input type="checkbox" data-next><span>Next order taken</span></label>' +
          "</div>",
        foot: '<button class="ct-btn is-wide" data-go>Save delivery</button>',
        bind: function (el) {
          const go = $("[data-go]", el.parentNode);
          const sync = function () {
            $$("[data-st]", el).forEach(function (b) { b.setAttribute("aria-checked", String(b.dataset.st === f.status)); });
            $("[data-missed]", el).hidden = f.status !== "missed";
            $("[data-done]", el).hidden = f.status === "missed";
            $$("[data-reason]", el).forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.reason === f.reason)); });
            go.disabled = f.status === "missed" && !f.reason;
            go.textContent = f.status === "missed" ? "Save missed delivery" : "Save delivery";
            const short = f.cratesBack * L.T.KIT_BOTTLES - f.bottlesBack;
            const kit = $("[data-kit]", el);
            kit.hidden = !(f.cratesBack > 0 && short > 0);
            kit.textContent = L.plural(f.cratesBack, "crate") + " back with " + f.bottlesBack + " bottles: " + L.plural(short, "bottle") + " short";
          };
          el.addEventListener("click", function (e) {
            const b = e.target.closest("button"); if (!b) return;
            if (b.dataset.st) { f.status = b.dataset.st; sync(); }
            if (b.dataset.reason) { f.reason = b.dataset.reason; sync(); }
          });
          wireSteps(el, function (k, v) { f[k] = v; if (k === "returnedCases" && v > 0 && f.status === "delivered") f.status = "returned"; sync(); });
          $("[data-money]", el).addEventListener("input", function (e) { f.collected = e.target.value; });
          $("[data-next]", el).addEventListener("change", function (e) { f.nextOrder = e.target.checked; });
          sync();
          go.addEventListener("click", function () {
            const missed = f.status === "missed";
            const rec = { customerId: customerId, orderNo: order ? order.no : null, status: f.status,
                          reason: missed ? f.reason : null,
                          returnedCases: missed ? 0 : f.returnedCases, shortCases: missed ? 0 : f.shortCases,
                          collected: missed ? 0 : Math.max(0, Number(f.collected) || 0),
                          empties: missed ? {} : { cratesOut: f.cratesOut, cratesBack: f.cratesBack, bottlesBack: f.bottlesBack },
                          nextOrder: !missed && f.nextOrder };
            let saved;
            try { saved = tower.store.addDeliveries([rec])[0]; } catch (e) { return toast(e.message + " Nothing was saved."); }
            /* Money collected at the door is a payment too. */
            if (rec.collected > 0) { try { tower.store.addPayment({ customerId: customerId, amount: rec.collected, mode: "Cash", via: saved.no }); } catch (e) { /* the delivery stands */ } }
            closeAll();
            if (ui.tab !== "deliveries") setTab("deliveries");
            after(missed ? "Missed delivery saved" : "Delivery saved");
            if (rec.nextOrder) newOrder(customerId);
          });
        } };
    }, push);
  }

  /* Receive payment */
  function paymentForm(push) {
    const lc = lever("collections");
    const live = lc && lc.status !== "preview";
    const owing = live ? lc.tiles.ugly.rows.map(function (r) { return r.id; }) : [];
    owing.label = "Overdue";
    pickCustomer("Receive payment", function (id) {
      const f = { amount: "", mode: "Cash" };
      const r = live ? lc.tiles.ugly.rows.filter(function (x) { return x.id === id; })[0] : null;
      sheet(function () {
        return { title: view.state.customerById[id] || id, sub: r ? L.rupees(r.value) + " overdue" : "Payment received",
          body: '<label class="ct-field"><span>Amount</span><input type="number" inputmode="numeric" min="1" placeholder="₹0" data-amt autofocus></label>' +
            '<div class="ct-seg" role="radiogroup" aria-label="Paid by">' + ["Cash", "UPI", "Cheque"].map(function (m) { return '<button type="button" role="radio" data-mode="' + m + '" aria-checked="' + (m === f.mode) + '">' + m + "</button>"; }).join("") + "</div>",
          foot: '<button class="ct-btn is-wide" data-go disabled>Save payment</button>',
          bind: function (el) {
            const go = $("[data-go]", el.parentNode);
            $("[data-amt]", el).addEventListener("input", function (e) { f.amount = e.target.value; go.disabled = !(Number(f.amount) > 0); go.textContent = Number(f.amount) > 0 ? "Save " + L.rupees(Number(f.amount)) : "Save payment"; });
            el.addEventListener("click", function (e) { const b = e.target.closest("[data-mode]"); if (b) { f.mode = b.dataset.mode; $$("[data-mode]", el).forEach(function (x) { x.setAttribute("aria-checked", String(x.dataset.mode === f.mode)); }); } });
            go.addEventListener("click", function () {
              try { tower.store.addPayment({ customerId: id, amount: Number(f.amount), mode: f.mode }); } catch (e) { return toast(e.message + " Nothing was saved."); }
              closeAll(); after(L.rupees(Number(f.amount)) + " received · " + (view.state.customerById[id] || id));
            });
          } };
      }, true);
    }, push, owing);
  }

  /* Stock count */
  function countSheet(productId, push) {
    const dem = window.CTSignals._detectors.demand(view.state);
    const pickProduct = function (id) {
      const d = dem.filter(function (x) { return x.product.id === id; })[0];
      const f = { qty: d && d.product.stock !== null ? Math.max(0, d.product.stock) : 0 };
      sheet(function () {
        return { title: d ? d.product.name : "Stock count", sub: d && d.product.stock !== null ? "Last count " + d.product.stock : "Not counted yet",
          body: '<div class="ct-qline"><span>Counted now</span>' + stepper("qty", f.qty) + "</div>",
          foot: '<button class="ct-btn is-wide" data-go>Save count</button>',
          bind: function (el) {
            wireSteps(el, function (k, v) { f.qty = v; });
            $("[data-go]", el.parentNode).addEventListener("click", function () {
              try { tower.store.addStockCounts([{ productId: id, qty: f.qty }]); } catch (e) { return toast(e.message + " Nothing was saved."); }
              closeAll(); after("Stock counted · " + (d ? d.product.name : id));
            });
          } };
      }, true);
    };
    if (productId) return pickProduct(productId);
    const all = dem.slice().sort(function (a, b) { return b.daily - a.daily; });
    sheet(function () {
      return { title: "Stock count",
        body: '<label class="ct-search"><input type="search" placeholder="Search products" autofocus data-q aria-label="Search products"></label><div class="ct-list ct-picks" data-picks></div>',
        bind: function (el) {
          const box = $("[data-picks]", el);
          const paintList = function (q) {
            const t = String(q || "").toLowerCase();
            const hits = all.filter(function (d) { return !t || d.product.name.toLowerCase().indexOf(t) !== -1; }).slice(0, 40);
            box.innerHTML = hits.map(function (d) {
              return '<button class="ct-row" data-id="' + esc(d.product.id) + '"><span class="ct-row-t">' + esc(d.product.name) + "<small>" + (d.product.stock === null ? "Not counted" : "Stock " + Math.max(0, d.available)) + '</small></span><span class="ct-go">' + I.chev + "</span></button>";
            }).join("") || '<p class="ct-empty">No product found.</p>';
          };
          paintList("");
          $("[data-q]", el).addEventListener("input", function (e) { paintList(e.target.value); });
          box.addEventListener("click", function (e) { const b = e.target.closest("[data-id]"); if (b) pickProduct(b.dataset.id); });
        } };
    }, push);
  }

  /* What the assistant may use (control-tower-chat.js): read the business,
     and go where the owner acts. It never changes a record itself: an
     action opens the lever's own confirm sheet. */
  function openLever(id, tile) {
    if (!model || !lever(id)) return;
    closeAll(); markSeen();
    ui.page = "tower";
    if (ui.tab !== id) setTab(id);
    if (tile) ui.tile[id] = tile;
    draw(); window.scrollTo(0, 0);
  }
  const api = {
    ready: function () { return !!model; },
    model: function () { return model; },
    timeline: function () { return model ? timeline() : null; },
    openLever: openLever,
    act: function (id) { openLever(id); const lv = lever(id); if (lv && lv.action) doAction(); },
    openTimeline: function () { if (model) goUpdates(); },
    sheetOpen: function () { return isOpen(); },
  };
  window.FBControlTower = { mount: mount, api: api, _ui: ui, _model: function () { return model; }, _view: function () { return view; } };
})();

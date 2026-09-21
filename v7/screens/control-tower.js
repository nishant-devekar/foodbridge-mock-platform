/* ==========================================================================
   CONTROL TOWER — the screen. Signal → Understand → Recommend → Act → Resolve.

   The page only draws. Detection, ranking, lifecycle, actions and the
   assistant live in ../assets/ct/ and are shared with the tests; this file
   turns a CTTower pass into HTML and a click into a call.

   HIERARCHY (requirements §4, UX §5): Business Pulse → Needs Attention →
   FoodBridge AI → Business Now. Critical first, money and customers next,
   opportunities last, general metrics after all of them.

   INTERACTION: a signal opens in a right drawer on desktop and a bottom sheet
   on a phone; its action is reviewed there, confirmed there, and its outcome
   shown there -- the owner never has to leave the tower. Updates that arrive
   while they work never reorder the screen under them: a pill offers them.
   ========================================================================== */

(function () {
  "use strict";

  /* ── icons (Lucide paths, 24 grid) ───────────────────────────────────── */
  const sv = function (d, cls) { return '<svg class="i' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>"; };
  const I = {
    bell: sv('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
    bot: sv('<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/>'),
    search: sv('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
    chart: sv('<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>'),
    cart: sv('<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>'),
    box: sv('<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12M3.3 7l8.7 5 8.7-5"/>'),
    users: sv('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
    rupee: sv('<path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a4.5 4.5 0 0 0 0-10"/>'),
    truck: sv('<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>'),
    clipboard: sv('<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01"/>'),
    trend: sv('<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>'),
    home: sv('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>'),
    plus: sv('<path d="M12 5v14M5 12h14"/>'),
    headset: sv('<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/>'),
    chev: sv('<path d="m9 18 6-6-6-6"/>'),
    back: sv('<path d="m15 18-6-6 6-6"/>'),
    x: sv('<path d="M18 6 6 18M6 6l12 12"/>'),
    check: sv('<path d="M20 6 9 17l-5-5"/>'),
    alert: sv('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>'),
    send: sv('<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'),
    mic: sv('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>'),
    more: sv('<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>'),
    info: sv('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
    clock: sv('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
    list: sv('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    exit: sv('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
    cal: sv('<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
    spark: sv('<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>'),
    heart: sv('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'),
  };
  const DOMAIN_ICON = { inventory: I.box, orders: I.cart, customers: I.users, cash: I.rupee, sales: I.trend, procurement: I.clipboard };
  const SEV = { critical: "Critical", high: "High", medium: "Medium", opportunity: "Opportunity" };
  const STATUS = { new: "New", acknowledged: "Seen", in_progress: "In progress", resolved: "Resolved", dismissed: "Dismissed" };

  const esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  let F, tower, view, assistant;
  const ui = { tab: "home", nowTab: "orders", alertsFilter: "active", convo: [], focusId: null, sig: "", pending: 0,
               stack: [], lastFocus: null, blockedStorage: false, listening: null };

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function ago(iso) {
    if (!iso) return "";
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 45) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    return F.plural(Math.round(s / 86400), "day") + " ago";
  }
  function acct() { return window.FBContext.account() || {}; }
  function business() { const a = acct(); return a.business || null; }
  function firstName() { const a = acct(); return a.name ? String(a.name).split(" ")[0] : null; }
  function greeting() { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; }
  function isDesktop() { return window.matchMedia("(min-width: 1100px)").matches || shellDesktop(); }
  function sigById(id) { return (view.all || []).filter(function (s) { return s.id === id; })[0] || null; }
  function risks() { return view.signals.filter(function (s) { return s.severity !== "opportunity"; }); }
  /* One count for the bell and the Alerts tab: new, and critical or high.
     Notifications are for what needs the owner, not for every change. */
  function unseenUrgent() {
    return view.signals.filter(function (s) { return (s.severity === "critical" || s.severity === "high") && s.status === "new"; }).length;
  }
  function signature(v) { return v.signals.map(function (s) { return s.id + ":" + s.fingerprint + ":" + s.status; }).join("|"); }

  function safeStorage() {
    try { const k = "fb.v7.ct.probe"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return localStorage; }
    catch (e) { ui.blockedStorage = true; return window.CTStore.memory(); }
  }

  /* ── inside the platform ─────────────────────────────────────────────── */
  /* In the sidebar since 21 Sep 2026, framed like every other destination.
     The shell brands the page and, from its lg breakpoint, carries the
     navigation in its sidebar -- so framed, this page drops its own logo for a
     title row, and drops its phone tab bar wherever the shell's sidebar is
     showing, whatever width the frame itself has been given. The frame that
     owns the platform is not always window.top (the IVR simulator frames
     it), so climb to the one that answers to FBPlatform. */
  function platformWin() {
    let w = window;
    for (let up = 0; up < 4; up++) {
      let next;
      try { next = w.parent; } catch (e) { return null; }
      if (!next || next === w) return null;
      w = next;
      try { if (w.FBPlatform) return w; } catch (e) { /* keep climbing */ }
    }
    return null;
  }
  function framed() { return !!platformWin(); }
  function shellDesktop() { const pw = platformWin(); try { return !!pw && pw.innerWidth >= 1024; } catch (e) { return false; } }
  function applyFrame() {
    const h = document.documentElement;
    h.classList.toggle("ct-framed", framed());
    h.classList.toggle("ct-shell-desktop", shellDesktop());
  }

  /* ── mount ───────────────────────────────────────────────────────────── */
  function mount() {
    F = window.CTSignals.fmt;
    applyFrame();
    mountFooter();
    skeleton();
    window.FBContext.ready().then(init).catch(function (e) { fatal(e.message); });
  }

  function init() {
    const store = window.CTStore.create(safeStorage());
    tower = window.CTTower.create({ store: store, readRaw: window.FBContext.raw, business: business });
    assistant = tower.assistant(function () { return ui.focusId; });
    view = tower.pass();
    ui.sig = signature(view);
    draw();
    ui.convo = [{ q: null, r: safeAsk("What needs my attention?") }];
    drawAI();
    wireGlobal();
    const deep = deepLink();
    if (deep && sigById(deep)) openSignal(deep);
  }

  function skeleton() {
    const root = $("#ct");
    const sk = function (h, w) { return '<div class="ct-sk" style="height:' + h + "px;" + (w ? "width:" + w : "") + '"></div>'; };
    root.innerHTML = header() +
      '<main class="ct-main" aria-busy="true"><div class="ct-hello">' + sk(28, "60%") + '<div style="height:8px"></div>' + sk(16, "40%") + "</div>" +
      '<div class="ct-pulse">' + [1, 2, 3, 4, 5, 6].map(function () { return sk(78); }).join("") + "</div>" +
      '<div class="ct-layout" style="margin-top:16px">' +
        '<div class="ct-l-att ct-card" style="padding:12px">' + sk(20, "40%") + '<div style="height:10px"></div>' + [1, 2, 3].map(function () { return sk(64) + '<div style="height:8px"></div>'; }).join("") + "</div>" +
        '<div class="ct-l-ai ct-card" style="padding:12px">' + sk(40) + '<div style="height:10px"></div>' + sk(150) + "</div>" +
      "</div><p class=\"ct-sr\">Reading your business…</p></main>";
  }

  function fatal(msg) {
    $("#ct").innerHTML = header() + '<main class="ct-main"><div class="ct-card ct-err">' +
      "<h3>Your records didn't load</h3><p>" + esc(msg) + " Nothing is shown rather than something wrong.</p>" +
      '<button class="ct-btn" id="ct-retry">Try again</button></div></main>';
    $("#ct-retry").addEventListener("click", mount);
  }

  /* ── header ──────────────────────────────────────────────────────────── */
  /* Inside the platform on a phone the shell's 56px bar is the page's header;
     a second title row under it only repeated it (product owner, 21 Sep). The
     bell's count lives on the Alerts tab, and the AI card is on Home. */
  function header() {
    if (framed() && !shellDesktop() && !window.matchMedia("(min-width: 1100px)").matches) return "";
    const fr = view ? view.freshness : null;
    const crit = view ? unseenUrgent() : 0;
    return '<header class="ct-top">' +
      (framed() ? '<div class="ct-brand"><h1 class="ct-title">Control Tower</h1></div>'
        : '<div class="ct-brand"><img src="../assets/foodbridge-mark.png?v=20260921A3" alt="" width="30" height="30"><div><b>FoodBridge</b><span>Control Tower</span></div></div>') +
      '<div class="ct-search" role="search"><label class="ct-searchbox">' + I.search +
        '<span class="ct-sr">Search</span><input id="ct-q" type="search" autocomplete="off" placeholder="Search products, shops, orders, alerts…"></label>' +
        '<div class="ct-results" id="ct-results" hidden></div></div>' +
      (fr ? freshChip(fr, "ct-fresh-d") : "") +
      '<button class="ct-iconbtn" id="ct-bell" aria-label="Notifications' + (crit ? ", " + crit + " new" : "") + '">' + I.bell +
        (crit ? '<span class="ct-badge">' + crit + "</span>" : "") + "</button>" +
      '<button class="ct-iconbtn ct-aibtn" id="ct-aibtn" aria-label="Ask FoodBridge AI">' + I.bot + "</button>" +
    "</header>";
  }
  function freshChip(fr, cls) {
    const txt = fr.sample ? "Sample data" : fr.delayed ? "Data delayed · " + (fr.age !== null ? F.plural(fr.age, "day") + " old" : "unknown age") : "Up to date";
    return '<button class="ct-fresh ' + (cls || "") + '" data-state="' + esc(fr.state) + '" data-open-status aria-label="Data status: ' + esc(txt) + '"><i></i>' + esc(txt) + "</button>";
  }

  /* ── the whole screen ────────────────────────────────────────────────── */
  function draw() {
    const root = $("#ct");
    const keepY = window.scrollY;
    root.innerHTML = header() +
      '<main class="ct-main">' +
        '<div data-view="home" class="' + (ui.tab === "home" ? "is-on" : "") + '">' + home() + "</div>" +
        '<div data-view="insights" class="' + (ui.tab === "insights" ? "is-on" : "") + '">' + insights() + "</div>" +
        '<div data-view="alerts" class="' + (ui.tab === "alerts" ? "is-on" : "") + '">' + alerts() + "</div>" +
      "</main>";
    wire(root);
    syncFooter();
    drawAI();
    window.scrollTo(0, keepY);
  }

  function home() {
    const r = risks();
    const crit = r.filter(function (s) { return s.severity === "critical"; }).length;
    const name = firstName();
    const lead = !view.signals.length ? "Nothing needs you right now."
      : !r.length ? "Your business looks healthy. <b>" + F.plural(view.signals.length, "opportunity", "opportunities") + "</b> worth a look."
      : (crit ? "" : "Your business is mostly healthy. ") + '<b class="' + (crit ? "is-bad" : "") + '">' + F.plural(r.length, "thing needs", "things need") + " your attention" + (crit ? " — " + crit + " critical" : "") + ".</b>";
    return '<section class="ct-hello"><div><h1>' + esc(greeting()) + (name ? ", " + esc(name) : "") + "!</h1><p>" + lead + "</p></div>" +
        '<div class="ct-hello-side"><span class="ct-asof">' + I.cal + (view.state.dataEnd ? "Records to " + esc(F.date(view.state.dataEnd)) : "No dated records") + "</span></div></section>" +
      '<section class="ct-pulse" aria-label="Business pulse">' + view.pulse.map(metric).join("") + "</section>" +
      '<div class="ct-layout">' +
        '<section class="ct-l-att ct-card ct-att" aria-labelledby="ct-att-h">' + attention() + "</section>" +
        '<section class="ct-l-ai ct-card ct-ai" aria-labelledby="ct-ai-h" id="ct-ai"></section>' +
        '<aside class="ct-l-rail ct-rail">' + rail() + "</aside>" +
        '<section class="ct-l-now ct-card ct-now" aria-labelledby="ct-now-h">' + nowCard() + "</section>" +
        '<section class="ct-l-trend ct-card ct-trend" aria-labelledby="ct-trend-h">' + trendCard() + "</section>" +
      "</div>";
  }

  /* ── pulse ───────────────────────────────────────────────────────────── */
  function metric(m) {
    const ic = { sales: I.chart, orders: I.cart, stock: I.box, customers: I.users, cash: I.rupee, delivery: I.truck }[m.id];
    const tone = m.tone === "good" ? "is-good" : m.tone === "bad" ? "is-bad" : m.tone === "warn" ? "is-warn" : "";
    const arrow = m.id === "sales" && typeof m.delta === "number" ? (m.delta >= 0 ? "↑ " : "↓ ") : "";
    return '<button class="ct-metric' + (m.available ? "" : " is-na") + '" data-m="' + m.id + '" data-pulse="' + m.id + '">' +
      '<span class="ct-metric-ic">' + ic + "</span>" +
      '<span class="ct-metric-b"><span class="ct-metric-l">' + esc(m.label) + (m.sample ? " · sample" : "") + "</span>" +
        '<span class="ct-metric-v' + (m.available ? "" : " is-na") + '">' + (m.available ? esc(m.value) : "Not available") + "</span>" +
        '<span class="ct-metric-s ' + tone + '">' + arrow + esc(m.sub) + "</span>" +
        (m.period && m.available ? '<span class="ct-metric-p">' + esc(m.period) + "</span>" : "") +
      "</span></button>";
  }

  /* ── needs attention ─────────────────────────────────────────────────── */
  function attention() {
    const list = view.signals;
    const r = risks();
    const max = isDesktop() ? 6 : 5;
    let body;
    if (!list.length) {
      body = '<div class="ct-healthy"><div class="ct-tick">' + I.check + "</div><h3>Business looks healthy</h3><p>No critical issues detected. FoodBridge keeps watching.</p></div>";
    } else if (!r.length) {
      body = '<div class="ct-healthy"><div class="ct-tick">' + I.check + "</div><h3>Business looks healthy</h3><p>No critical issues detected. " +
        F.plural(list.length, "opportunity", "opportunities") + " found.</p></div>" + '<div class="ct-list">' + list.map(sigRow).join("") + "</div>";
    } else {
      body = '<div class="ct-list">' + list.slice(0, max).map(sigRow).join("") + "</div>" +
        (list.length > max ? '<p class="ct-note">' + F.plural(list.length - max, "more") + " in Alerts.</p>" : "");
    }
    const errs = view.errors.length ? '<p class="ct-note is-warn">' + F.plural(view.errors.length, "check") + " couldn't run just now — the rest are current. " +
      '<button class="ct-link" data-refresh>Retry</button></p>' : "";
    const resolved = (view.resolved || []).filter(function (x) { return x.resolvedAt && Date.now() - new Date(x.resolvedAt).getTime() < 86400000; }).length;
    return '<div class="ct-att-h"><span class="ct-bell">' + I.bell + '</span><h2 id="ct-att-h">Needs attention (' + list.length + ")</h2>" +
      '<button class="ct-link" data-tab="alerts">View all ' + I.chev + "</button></div>" + body + errs +
      (resolved ? '<p class="ct-note">✓ ' + F.plural(resolved, "issue") + " resolved in the last day.</p>" : "") +
      (ui.blockedStorage ? '<p class="ct-note is-warn">This browser is blocking storage, so actions here last only until you close the page.</p>' : "");
  }

  function sigRow(s) {
    const imp = s.impact && typeof s.impact.value === "number"
      ? '<span class="ct-impact">' + esc(s.impact.description) + "</span>"
      : '<span class="ct-impact is-na">' + esc(s.impact ? s.impact.description : "") + "</span>";
    const status = s.status === "in_progress" ? '<span class="ct-chip is-status">' + I.clock.replace('class="i"', 'class="i" style="width:12px;height:12px"') + "In progress</span>"
      : s.status === "new" && s.severity !== "opportunity" ? '<span class="ct-chip is-new">New</span>' : "";
    const cta = s.recommendation && s.status !== "in_progress"
      ? '<button class="ct-btn is-sm ct-sig-act" data-sev="' + s.severity + '" data-act="' + esc(s.id) + '">' + esc(s.recommendation.cta) + "</button>" : "";
    return '<div class="ct-sig" data-sev="' + s.severity + '" data-status="' + s.status + '" data-open="' + esc(s.id) + '">' +
      '<span class="ct-sig-ic">' + (DOMAIN_ICON[s.domain] || I.alert) + "</span>" +
      '<span class="ct-sig-b"><button class="ct-sig-t" style="all:unset;cursor:pointer;font-size:14px;line-height:19px;font-weight:700" data-open-btn="' + esc(s.id) + '">' + esc(s.title) + "</button>" +
        '<span class="ct-sig-s">' + esc(s.summary) + "</span>" +
        '<span class="ct-sig-meta"><span class="ct-chip" data-sev="' + s.severity + '"><i></i>' + SEV[s.severity] + "</span>" + imp + status + "</span></span>" +
      '<span class="ct-sig-e"><span class="ct-sig-when" data-ago="' + esc(s.firstSeenAt) + '">' + esc(ago(s.firstSeenAt)) + "</span>" + cta + '<span class="ct-sig-go">' + I.chev + "</span></span>" +
    "</div>";
  }

  /* ── FoodBridge AI ───────────────────────────────────────────────────── */
  function safeAsk(q) {
    try { return assistant.ask(q); }
    catch (e) { return { intent: "error", error: true, blocks: [{ type: "p", text: "FoodBridge AI is unavailable right now. Everything else on this screen still works." }], suggestions: [], cites: [], proposal: null }; }
  }
  function drawAI() {
    const box = $("#ct-ai");
    if (!box) return;
    const actionable = view.signals.filter(function (s) { return s.recommendation && s.status !== "in_progress"; }).slice(0, 3);
    const last = ui.convo[ui.convo.length - 1];
    const sug = last && last.r ? last.r.suggestions : [];
    box.innerHTML =
      '<div class="ct-ai-h"><span class="ct-bot">' + I.bot + '</span><div><b id="ct-ai-h">FoodBridge AI <span class="ct-beta">BETA</span></b><span>Answers only from your records</span></div></div>' +
      '<div class="ct-ai-body" id="ct-ai-body" aria-live="polite">' + ui.convo.map(function (c) {
        return (c.q ? '<p class="ct-q">You: ' + esc(c.q) + "</p>" : "") + replyHtml(c.r);
      }).join("") + "</div>" +
      (actionable.length ? '<button class="ct-btn is-wide" data-review-all>' + I.spark + "Review actions (" + actionable.length + ")</button>" : "") +
      (sug.length ? '<div class="ct-chips">' + sug.map(function (t) { return '<button data-ask="' + esc(t) + '">' + esc(t) + "</button>"; }).join("") + "</div>" : "") +
      '<form class="ct-ask" id="ct-ask"><label><span class="ct-sr">Ask FoodBridge</span><input id="ct-ask-in" autocomplete="off" placeholder="Ask anything about your business…">' +
        (speech() ? '<button type="button" class="ct-mic" id="ct-mic" aria-label="Ask by voice">' + I.mic + "</button>" : "") +
      '</label><button class="ct-send" aria-label="Send">' + I.send + "</button></form>";
    /* Open on the start of the latest answer, not the end of it: the first
       line of a reply is the one that says what it is about. */
    const body = $("#ct-ai-body");
    const qs = body.querySelectorAll(".ct-q");
    body.scrollTop = qs.length ? qs[qs.length - 1].offsetTop - body.offsetTop - 4 : 0;
    wireAI(box);
  }
  function replyHtml(r) {
    if (!r) return "";
    return r.blocks.map(function (b) {
      if (b.type === "list") {
        return "<ul>" + b.items.map(function (it) {
          return it.signalId
            ? '<li><button data-open-btn="' + esc(it.signalId) + '"><span class="ct-dot" data-sev="' + esc(it.severity || "") + '"></span><span>' + esc(it.text) + "</span>" + I.chev + "</button></li>"
            : '<li class="is-plain">' + esc(it.text) + "</li>";
        }).join("") + "</ul>";
      }
      return '<p class="' + (b.tone === "muted" ? "is-muted" : "") + '">' + esc(b.text) + "</p>";
    }).join("") +
    (r.proposal ? r.proposal.escalate
      ? '<p><button class="ct-btn is-sm is-ghost" data-support>' + I.headset + esc(r.proposal.label) + "</button></p>"
      : '<p><button class="ct-btn is-sm" data-propose="' + esc(r.proposal.signalId) + '">' + esc(r.proposal.label) + "</button></p>" : "");
  }
  function ask(q) {
    const t = String(q || "").trim();
    if (!t) return;
    if (/^talk to a person$/i.test(t)) { openSupport(); return; }
    ui.convo.push({ q: t, r: safeAsk(t) });
    ui.convo = ui.convo.slice(-8);
    drawAI();
    const inp = $("#ct-ask-in"); if (inp && isDesktop()) inp.focus();
  }
  function speech() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; }

  /* ── rail ────────────────────────────────────────────────────────────── */
  function rail() {
    const fr = view.freshness;
    const cashOk = !!(view.state.ledger && view.state.ledger.invoices);
    const od = view.signals.filter(function (s) { return s.id === "overdue"; })[0];
    return '<div class="ct-card ct-box"><h3>' + I.info + 'Data status <span style="margin-left:auto">' + '<span class="ct-state" data-s="' + esc(fr.state) + '">' + esc(fr.headline) + "</span></span></h3>" +
        '<ul class="ct-srcs">' + fr.sources.map(function (s) {
          return "<li><span>" + esc(s.label) + '</span><span class="ct-state" data-s="' + esc(s.state) + '">' + esc(stateWord(s.state)) + "</span><small>" + esc(s.detail) + "</small></li>";
        }).join("") + "</ul>" +
        '<button class="ct-link" data-open-status>What more records would unlock ' + I.chev + "</button></div>" +
      '<div class="ct-card ct-box"><h3>' + I.spark + 'Quick actions</h3><div class="ct-quick">' +
        '<button data-create="order">' + I.cart + "Create order</button>" +
        '<button data-create="purchase">' + I.clipboard + "Raise purchase request</button>" +
        '<button data-create="reminders"' + (cashOk && od ? "" : " disabled") + ">" + I.rupee + "Send payment reminders" + (cashOk ? (od ? "" : "<small>none overdue</small>") : "<small>needs invoices</small>") + "</button>" +
        '<button data-tab="alerts" data-alerts="activity">' + I.list + "Activity & audit</button>" +
      "</div></div>" +
      '<div class="ct-card ct-box"><div class="ct-help-b">' + I.headset + "<div><b>Need a person?</b><span>Talk to a FoodBridge expert — your context goes with you.</span></div></div>" +
        '<button class="ct-btn is-ghost is-wide" data-support>Talk to a person</button></div>';
  }
  function stateWord(s) { return s === "live" ? "Live" : s === "synced" ? "Synced" : s === "delayed" ? "Delayed" : s === "sample" ? "Sample" : "Not available"; }

  /* ── business now ────────────────────────────────────────────────────── */
  const NOW_TABS = [
    { id: "orders", label: "Orders", icon: I.cart },
    { id: "inventory", label: "Inventory", icon: I.box },
    { id: "procurement", label: "Procurement", icon: I.clipboard },
    { id: "delivery", label: "Delivery", icon: I.truck },
    { id: "cash", label: "Cash", icon: I.rupee },
    { id: "sales", label: "Sales", icon: I.trend },
  ];
  function nowCard() {
    const n = view.now;
    const tile = function (t) {
      const d = n[t.id];
      let v = "", tone = "good";
      if (!d.available) { v = '<b class="is-na">Not connected</b>'; tone = "na"; }
      else if (t.id === "orders") { v = "<b>" + d.count30 + "</b>"; tone = d.atRisk ? "bad" : d.pastCycle ? "warn" : "good"; }
      else if (t.id === "inventory") { v = "<b>" + (d.selling ? Math.round(d.healthy / d.selling * 100) : 0) + "%</b>"; tone = d.atRisk ? "bad" : d.slow ? "warn" : "good"; }
      else if (t.id === "procurement") { v = "<b>" + d.openRequests + " open</b>"; tone = d.needReorder ? "warn" : "good"; }
      else if (t.id === "cash") { v = "<b>" + esc(d.receivables) + "</b>"; tone = d.counts.overdue ? "bad" : "good"; }
      else if (t.id === "sales") { v = "<b>" + esc(d.value30 || "—") + "</b>"; tone = d.demandUp ? "good" : "good"; }
      return '<button class="ct-tile" data-now="' + t.id + '"><span style="color:var(--g)">' + t.icon + "</span><span>" + t.label + "</span>" + v + '<i data-t="' + tone + '"></i></button>';
    };
    return '<div class="ct-now-h"><span style="color:var(--g)">' + I.heart + '</span><h2 id="ct-now-h">Business now</h2><span class="ct-now-p">' + esc(n.period) + "</span></div>" +
      '<div class="ct-tiles">' + NOW_TABS.map(tile).join("") + "</div>" +
      '<div class="ct-tabs" role="tablist">' + NOW_TABS.map(function (t) {
        return '<button role="tab" id="ct-tab-' + t.id + '" aria-controls="ct-panel-' + t.id + '" aria-selected="' + (ui.nowTab === t.id) + '" data-nowtab="' + t.id + '">' + t.icon + t.label + "</button>";
      }).join("") + "</div>" +
      NOW_TABS.map(function (t) { return '<div class="ct-panel' + (ui.nowTab === t.id ? " is-on" : "") + '" role="tabpanel" id="ct-panel-' + t.id + '" aria-labelledby="ct-tab-' + t.id + '">' + nowPanel(t.id) + "</div>"; }).join("");
  }
  function kv(rows) { return '<ul class="ct-kv">' + rows.filter(Boolean).map(function (r) { return "<li><span>" + esc(r[0]) + "</span><b>" + esc(r[1]) + "</b></li>"; }).join("") + "</ul>"; }
  function naBox(d) { return '<div class="ct-na"><b>Not available</b>' + esc(d.reason) + "<small>" + esc(d.unlock) + "</small></div>"; }
  function nowPanel(id) {
    const d = view.now[id];
    if (!d.available) return naBox(d);
    if (id === "orders") {
      return '<div class="ct-big">' + d.count30 + "<small>orders · " + esc(view.now.period) + "</small></div>" +
        kv([["The 30 days before", String(d.countPrev)], ["Average order", d.avgValue || "—"], ["Made in FoodBridge since the import", String(d.made)],
            ["Orders stock can't fill", String(d.atRisk)], ["Shops past their cycle", String(d.pastCycle)]]) +
        (d.topCustomers.length ? '<div class="ct-group-h">Top shops · 90 days</div>' + kv(d.topCustomers.map(function (c) { return [c.name, c.value]; })) : "") +
        '<p><button class="ct-btn is-sm" data-create="order">' + I.plus + "Create order</button></p>";
    }
    if (id === "inventory") {
      const pct = d.selling ? Math.round(d.healthy / d.selling * 100) : 0;
      return '<div class="ct-big">' + pct + "%<small>healthy</small></div>" +
        '<div class="ct-bar"><i style="width:' + pct + '%"></i></div>' +
        kv([["Selling products with 2+ weeks of stock", d.healthy + " of " + d.selling], ["At risk of running out", String(d.atRisk)], ["Out of stock", String(d.out)],
            ["Not sold in 90 days", String(d.slow)], ["Products with a stock count", String(d.counted)], d.stockValue ? ["Stock on hand at MRP", d.stockValue] : null]) +
        '<p class="ct-note" style="margin:8px 0 0">No batches or expiry dates in your records, so expiry risk isn\'t checked.</p>';
    }
    if (id === "procurement") {
      return '<div class="ct-big">' + d.openRequests + "<small>open purchase requests</small></div>" +
        kv([["Units on order", String(d.openUnits)], ["Products needing a reorder", String(d.needReorder)], ["Suppliers on file", d.suppliers ? String(d.suppliers) : "None in your records"],
            d.recentPOs !== null ? ["Purchase orders in the last 30 days of records", d.recentPOs + " · " + d.recentPOValue] : null]) +
        '<p><button class="ct-btn is-sm" data-create="purchase">' + I.clipboard + "Review procurement</button></p>";
    }
    if (id === "cash") {
      return '<div class="ct-big">' + esc(d.receivables) + "<small>receivables" + (d.sample ? " · sample" : "") + "</small></div>" +
        kv([["Overdue", d.overdue + " · " + F.plural(d.counts.overdue, "invoice")], ["Due in the next 7 days", d.dueSoon + " · " + F.plural(d.counts.soon, "invoice")],
            d.payables ? ["Supplier bills unpaid", d.payables] : null, d.payablesLate ? ["Supplier bills overdue", d.payablesLate] : null]) +
        '<p><button class="ct-btn is-sm" data-open-btn="overdue">' + I.rupee + "Review collections</button></p>";
    }
    if (id === "sales") {
      return '<div class="ct-big">' + esc(d.value30) + "<small>" + esc(view.now.period) + "</small></div>" +
        kv([["The 30 days before", d.prev30], ["Products with rising demand", String(d.demandUp)], ["From", d.basis]]) +
        (d.topProducts.length ? '<div class="ct-group-h">Top products · units</div>' + kv(d.topProducts.map(function (p) { return [p.name, String(p.units)]; })) : "") +
        (d.demandUp ? '<p><button class="ct-btn is-sm" data-open-btn="demand-up">' + I.trend + "View opportunities</button></p>" : "");
    }
    return "";
  }

  function trendCard() {
    const t = view.trend;
    if (!t) return '<div class="ct-trend-h"><h2 id="ct-trend-h">Sales trend</h2></div>' + naBox({ reason: "No order values or invoices in your records.", unlock: "Connect Zoho Books or Xero." });
    const max = Math.max.apply(null, t.weeks.map(function (w) { return w.value; }).concat([1]));
    const last = t.weeks[t.weeks.length - 1], prev = t.weeks[t.weeks.length - 2];
    const ch = prev && prev.value ? Math.round((last.value / prev.value - 1) * 100) : null;
    return '<div class="ct-trend-h"><h2 id="ct-trend-h">Sales trend</h2><span>8 weeks to ' + esc(F.date(last.end)) + "</span></div>" +
      '<div class="ct-bars" role="img" aria-label="Weekly sales, 8 weeks to ' + esc(F.date(last.end)) + '">' + t.weeks.map(function (w) {
        return '<div title="Week to ' + esc(F.date(w.end)) + ": " + esc(F.inr(w.value) || "₹0") + '"><i style="height:' + Math.max(2, Math.round(w.value / max * 100)) + '%"></i><small>' + esc(F.date(w.end).replace(/ 20\d\d$/, "")) + "</small></div>";
      }).join("") + "</div>" +
      '<div class="ct-trend-f"><span>Last week <b>' + esc(F.inr(last.value) || "₹0") + "</b></span>" +
        (ch !== null ? '<span style="color:' + (ch >= 0 ? "#067647" : "var(--crit)") + '">' + (ch >= 0 ? "↑ " : "↓ ") + Math.abs(ch) + "% on the week before</span>" : "") +
        '<span style="margin-left:auto">From ' + esc(t.basis) + "</span></div>";
  }

  /* ── other views (phone tabs) ────────────────────────────────────────── */
  function insights() {
    return '<section class="ct-hello"><div><h1>Insights</h1><p>What\'s happening across the business.</p></div>' +
        '<div class="ct-hello-side"><button class="ct-btn is-sm is-ghost" data-tab="home">' + I.back + "Control Tower</button></div></section>" +
      '<div class="ct-seg" role="tablist" aria-label="Area">' + NOW_TABS.map(function (t) {
        return '<button role="tab" aria-pressed="' + (ui.nowTab === t.id) + '" data-nowtab="' + t.id + '">' + t.label + "</button>";
      }).join("") + "</div>" +
      '<div class="ct-card ct-now" style="margin-top:10px">' + nowPanel(ui.nowTab) + "</div>" +
      '<div class="ct-card ct-trend" style="margin-top:12px">' + trendCard() + "</div>" +
      '<div style="margin-top:12px" class="ct-rail">' + rail() + "</div>";
  }

  function alerts() {
    const f = ui.alertsFilter;
    const groups = {
      active: view.signals.filter(function (s) { return s.status !== "in_progress"; }),
      in_progress: view.signals.filter(function (s) { return s.status === "in_progress"; }),
      dismissed: view.dismissed || [],
      activity: null,
    };
    const tabs = [["active", "Active"], ["in_progress", "In progress"], ["dismissed", "Dismissed"], ["activity", "Activity"]];
    let body;
    if (f === "activity") body = activity();
    else if (!groups[f].length) body = '<div class="ct-card ct-healthy"><h3>' + (f === "active" ? "Nothing needs you" : f === "in_progress" ? "Nothing in progress" : "Nothing dismissed") + "</h3></div>";
    else body = '<div class="ct-card ct-att"><div class="ct-list">' + groups[f].map(function (s) {
        return f === "dismissed"
          ? '<div class="ct-sig" data-sev="' + s.severity + '"><span class="ct-sig-ic">' + (DOMAIN_ICON[s.domain] || I.alert) + '</span><span class="ct-sig-b"><span class="ct-sig-t">' + esc(s.title) + '</span><span class="ct-sig-s">Dismissed: ' + esc(s.dismissReason || "no reason") + '</span></span><span class="ct-sig-e"><button class="ct-btn is-sm is-ghost" data-restore="' + esc(s.id) + '">Show again</button></span></div>'
          : sigRow(s);
      }).join("") + "</div></div>";
    const resolved = (view.resolved || []).slice(-5).reverse();
    return '<section class="ct-hello"><div><h1>Alerts</h1><p>' + F.plural(view.signals.length, "open signal") + ".</p></div>" +
        '<div class="ct-hello-side"><button class="ct-btn is-sm is-ghost" data-tab="home">' + I.back + "Control Tower</button></div></section>" +
      '<div class="ct-seg" role="tablist" aria-label="Filter">' + tabs.map(function (t) {
        return '<button aria-pressed="' + (f === t[0]) + '" data-alerts="' + t[0] + '">' + t[1] + (groups[t[0]] ? " (" + groups[t[0]].length + ")" : "") + "</button>";
      }).join("") + "</div><div style=\"margin-top:10px\">" + body + "</div>" +
      (f !== "activity" && resolved.length ? '<div class="ct-group-h">Recently resolved</div><div class="ct-card ct-box"><ul class="ct-log">' + resolved.map(function (x) {
        return "<li>✓ <b>" + esc(titleFor(x.id)) + "</b><small>Resolved " + esc(ago(x.resolvedAt || x.changedAt)) + " — no longer found in your records</small></li>";
      }).join("") + "</ul></div>" : "");
  }
  function titleFor(id) {
    return { stockout: "Stock at risk", "order-risk": "Orders stock can't fill", overdue: "Overdue payments", "reorder-due": "Shops past their cycle",
             "reorder-soon": "Shops due to reorder", "slow-stock": "Stock not selling", "demand-up": "Rising demand" }[id] || id;
  }
  function activity() {
    const log = (view.audit || []).slice().reverse().slice(0, 60);
    if (!log.length) return '<div class="ct-card ct-healthy"><h3>No activity yet</h3></div>';
    return '<div class="ct-card ct-box"><ul class="ct-log">' + log.map(function (a) {
      const who = a.actor === "owner" ? "You" : a.actor === "assistant" ? "FoodBridge AI" : "FoodBridge";
      const what = { detected: "detected", resolved: "resolved", reopened: "reopened", recurred: "came back", in_progress: "moved to in progress",
                     acknowledged: "opened", dismissed: "dismissed", new: "shown again", create_purchase_request: "raised a purchase request",
                     create_orders: "created orders", send_reminders: "approved reminders", create_followup: "saved a call list", escalate: "asked for help" }[a.action] || a.action;
      return "<li><b>" + esc(who) + "</b> " + esc(what) + (a.signalId ? " · " + esc(titleFor(a.signalId)) : "") +
        (a.aiAssisted ? '<span class="ct-tag is-ai">AI-ASSISTED</span>' : "") + (a.actor !== "owner" && a.actor !== "assistant" ? '<span class="ct-tag is-sys">AUTO</span>' : "") +
        "<small>" + esc(new Date(a.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) +
        (a.outcome ? " · " + esc(a.outcome) : "") + (a.reason && a.kind === "signal" ? " · " + esc(a.reason) : "") +
        (a.approval ? " · " + esc(a.approval) : "") + "</small></li>";
    }).join("") + "</ul></div>";
  }

  /* ── the footer: the platform's standard one ─────────────────────────── */
  /* The same bar every screen carries (assets/exit-demo.js, FB_EXIT): its
     tabs to the left of EXIT DEMO: Home, Insights, Alerts. Creating and
     "Talk to a person" live in Insights' Quick actions and Support cards
     (product owner, 21 Sep: the bar carries no more). Mounted once; each
     draw only moves the current-tab mark and the Alerts count. The shell
     stands its own bar down because this frame carries #fbx-foot. */
  const FOOT = ["home", "insights", "alerts"];
  function footIcon(svg, id) {
    return '<span class="ct-ftic">' + svg + (id === "alerts" ? '<b class="ct-badge" data-foot-badge hidden></b>' : "") + "</span>";
  }
  function mountFooter() {
    if (!window.FB_EXIT) return;
    const go = function (tab) { return function () { if (isOpen()) close(); setTab(tab); }; };
    window.FB_EXIT.mount({ pad: false, z: 39, tabs: [
      { id: "home", label: "Home", icon: footIcon(I.home), onClick: go("home") },
      { id: "insights", label: "Insights", icon: footIcon(I.chart), onClick: go("insights") },
      { id: "alerts", label: "Alerts", icon: footIcon(I.bell, "alerts"), onClick: go("alerts") },
    ] });
  }
  function syncFooter() {
    FOOT.forEach(function (id, i) {
      const b = document.querySelector('#fbx-foot [data-x="' + i + '"]');
      if (!b) return;
      if (ui.tab === id) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    const badge = document.querySelector("#fbx-foot [data-foot-badge]");
    if (badge) { const n = unseenUrgent(); badge.textContent = n; badge.hidden = !n; }
  }

  /* ── wiring ──────────────────────────────────────────────────────────── */
  function wire(root) {
    root.addEventListener("click", onClick);
    const q = $("#ct-q");
    if (q) q.addEventListener("input", function () { searchResults(q.value); });
    if (q) q.addEventListener("keydown", function (e) { if (e.key === "Escape") { q.value = ""; searchResults(""); } });
  }
  function onClick(e) {
    const t = e.target.closest("button, [data-open]");
    if (!t) return;
    const d = t.dataset;
    if (t.id === "ct-bell") return openNotifications();
    if (t.id === "ct-aibtn") { const box = $("#ct-ai"); if (ui.tab !== "home") setTab("home"); setTimeout(function () { const b = $("#ct-ai"); if (b) { b.scrollIntoView({ behavior: "smooth", block: "start" }); const i = $("#ct-ask-in"); if (i) i.focus({ preventScroll: true }); } }, 0); void box; return; }
    if (d.act) { e.stopPropagation(); return review(d.act); }
    if (d.openBtn) { e.stopPropagation(); return openSignal(d.openBtn); }
    if (d.open && !e.target.closest(".ct-sig-act")) return openSignal(d.open);
    if (d.tab) { if (d.alerts) ui.alertsFilter = d.alerts; return setTab(d.tab); }
    if (d.alerts) { ui.alertsFilter = d.alerts; return draw(); }
    if (d.nowtab) { ui.nowTab = d.nowtab; return draw(); }
    if (d.now) { ui.nowTab = d.now; return setTab("insights"); }
    if (d.pulse) return pulseClick(d.pulse);
    if ("openStatus" in d) return openStatus();
    if ("support" in d) return openSupport();
    if (d.create) return createFlow(d.create);
    if (d.restore) { tower.store.restore(d.restore); return refresh(); }
    if ("refresh" in d) return refresh();
    if (d.result) { const r = ui.searchIndex[+d.result]; closeSearch(); return r.go(); }
  }
  function wireAI(box) {
    /* The card's contents are redrawn on every answer; the card itself is
       not, so its listener is bound once -- or one tap on a chip asks twice. */
    if (!box.dataset.wired) {
      box.dataset.wired = "1";
      box.addEventListener("click", function (e) {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.ask) return ask(b.dataset.ask);
      if (b.dataset.propose) return review(b.dataset.propose, { aiAssisted: true });
      if ("reviewAll" in b.dataset) return openPrepared();
      if ("support" in b.dataset) return openSupport();
      if (b.dataset.openBtn) return openSignal(b.dataset.openBtn);
      if (b.id === "ct-mic") return listen(b);
      });
    }
    $("#ct-ask", box).addEventListener("submit", function (e) { e.preventDefault(); const i = $("#ct-ask-in"); const v = i.value; i.value = ""; ask(v); });
  }
  function listen(btn) {
    const R = speech(); if (!R) return;
    if (ui.listening) { ui.listening.stop(); return; }
    const r = new R(); r.lang = "en-IN"; r.interimResults = false;
    ui.listening = r; btn.classList.add("is-on");
    r.onresult = function (ev) { const t = ev.results[0][0].transcript; ask(t); };
    r.onend = function () { ui.listening = null; const m = $("#ct-mic"); if (m) m.classList.remove("is-on"); };
    r.onerror = function () { toast("Voice didn't work here — type your question instead."); };
    try { r.start(); } catch (e) { ui.listening = null; }
  }
  function setTab(tab) { ui.tab = tab; draw(); window.scrollTo(0, 0); }
  function pulseClick(id) {
    const map = { sales: "sales", orders: "orders", stock: "inventory", customers: "orders", cash: "cash", delivery: "delivery" };
    const sid = { stock: "stockout", customers: "reorder-due", cash: "overdue", orders: "order-risk" }[id];
    if (sid && sigById(sid) && view.signals.some(function (s) { return s.id === sid; })) return openSignal(sid);
    ui.nowTab = map[id];
    if (isDesktop()) { draw(); const p = $(".ct-l-now"); if (p) p.scrollIntoView({ behavior: "smooth", block: "start" }); }
    else setTab("insights");
  }

  /* ── drawer / sheet ──────────────────────────────────────────────────── */
  function layer() {
    let l = $("#ct-layer");
    if (!l) { l = document.createElement("div"); l.id = "ct-layer"; document.body.appendChild(l); }
    return l;
  }
  /* screen() → { label, body, foot, bind(el) }. Pushed screens get a Back. */
  function sheet(screen, push) {
    if (!push) { ui.stack = []; ui.lastFocus = document.activeElement; }
    ui.stack.push(screen);
    paint();
  }
  function paint() {
    const screen = ui.stack[ui.stack.length - 1];
    if (!screen) return close();
    const s = screen();
    const l = layer();
    document.body.classList.add("ct-locked");
    l.innerHTML = '<div class="ct-scrim" data-close></div>' +
      '<section class="ct-drawer" role="dialog" aria-modal="true" aria-label="' + esc(s.label) + '">' +
        '<div class="ct-grip"></div><div class="ct-dh">' +
          (ui.stack.length > 1 ? '<button class="ct-back" data-back>' + I.back + "Back</button>" : '<span style="font-weight:700;font-size:14px">' + esc(s.label) + "</span>") +
          '<button class="ct-x" data-close aria-label="Close">' + I.x + "</button></div>" +
        '<div class="ct-db">' + s.body + "</div>" + (s.foot ? '<div class="ct-df">' + s.foot + "</div>" : "") +
      "</section>";
    const el = $(".ct-drawer", l);
    l.onclick = function (e) {
      if (e.target.closest("[data-close]")) return close();
      if (e.target.closest("[data-back]")) { ui.stack.pop(); return paint(); }
    };
    if (s.bind) s.bind(el);
    const f = el.querySelector("[autofocus]") || el.querySelector(".ct-df .ct-btn:not([disabled])") || el.querySelector("button");
    if (f) f.focus({ preventScroll: true });
  }
  function close() {
    ui.stack = [];
    const l = $("#ct-layer"); if (l) l.innerHTML = "";
    document.body.classList.remove("ct-locked");
    if (ui.pendingDraw) { ui.pendingDraw = false; }
    if (ui.lastFocus && document.contains(ui.lastFocus)) ui.lastFocus.focus({ preventScroll: true });
    if (ui.pending) showPill();
  }
  function isOpen() { return ui.stack.length > 0; }

  /* ── signal detail ───────────────────────────────────────────────────── */
  function openSignal(id, push) {
    const s0 = sigById(id);
    if (!s0) return toast("That no longer needs attention.");
    if (s0.status === "new") { try { tower.store.acknowledge(id); } catch (e) { /* lifecycle is best effort here */ } refresh(true); }
    ui.focusId = id;
    sheet(function () { return detail(id); }, push);
  }
  function detail(id) {
    const s = sigById(id);
    if (!s) return { label: "Signal", body: '<div class="ct-result"><h3>This no longer needs attention</h3><p>Your records changed since it was shown.</p></div>' };
    const imp = s.impact;
    const aff = s.affected || {};
    const facts = [["customers", "shops affected"], ["products", "products"], ["orders", "orders"], ["invoices", "invoices"]]
      .filter(function (k) { return aff[k[0]]; }).map(function (k) { return "<div><b>" + aff[k[0]] + "</b><span>" + k[1] + "</span></div>"; }).join("");
    const rows = s.rows || [];
    const showRows = rows.slice(0, 8);
    const rowHtml = function (r) {
      return '<div class="ct-row" data-tone="' + esc(r.tone || "") + '"><span class="ct-row-t" title="' + esc(r.title) + '">' + esc(r.title) + "</span>" +
        (r.note ? '<span class="ct-row-n">' + esc(r.note) + "</span>" : "") +
        '<span class="ct-row-c">' + r.cells.map(function (c) { return "<span>" + esc(c) + "</span>"; }).join("") + "</span></div>";
    };
    const rec = s.recommendation;
    const body =
      '<div style="--sev-bg:var(--' + sevVar(s.severity) + '-bg);--sev-line:var(--' + sevVar(s.severity) + '-line)">' +
      '<div class="ct-sig-meta" style="margin:0"><span class="ct-chip" data-sev="' + s.severity + '"><i></i>' + SEV[s.severity] + "</span>" +
        '<span class="ct-chip is-status">' + esc(labelOf(s)) + "</span>" +
        (s.status !== "new" ? '<span class="ct-chip is-status">' + esc(STATUS[s.status]) + "</span>" : "") + "</div>" +
      '<h2 class="ct-d-title">' + esc(s.title) + "</h2><p class=\"ct-d-sum\">" + esc(s.summary) + "</p>" +
      (s.status === "in_progress" || s.phase === "monitoring" ? '<div class="ct-inprog">' + I.clock + "<span>" + esc(s.note || s.summary) + "</span></div>" : "") +
      '<div class="ct-d-sec">Impact</div><div class="ct-imp"><div class="is-main"><b>' + esc(typeof imp.value === "number" ? F.inr(imp.value) : "Not yet quantified") + "</b><span>" +
        esc(typeof imp.value === "number" ? imp.description.replace(F.inr(imp.value) + " ", "") : imp.description) + "</span></div>" + facts + "</div>" +
      '<details class="ct-calc"><summary>How this is worked out</summary><p>' + esc(imp.calc) + "</p></details>" +
      '<div class="ct-d-sec">Why</div><ul class="ct-why">' + s.why.map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") + "</ul>" +
      '<div class="ct-d-sec">Affected · ' + rows.length + '</div><div class="ct-rows" id="ct-rows">' + showRows.map(rowHtml).join("") +
        (rows.length > showRows.length ? '<button class="ct-more-rows" data-allrows>Show all ' + rows.length + "</button>" : "") + "</div>" +
      (rec ? '<div class="ct-d-sec">Recommendation</div><div class="ct-rec"><b>' + esc(rec.title) + "</b><p>" + esc(rec.description) + "</p>" +
        '<span class="ct-cls">' + esc(window.CTActions.CLASS[window.CTActions.REGISTRY[rec.actionType].cls].label) + "</span></div>" : "") +
      '<div class="ct-d-sec">Why it ranks here</div><div class="ct-rank"><b>Priority ' + s.priority.score + '</b><ul>' +
        s.priority.reasons.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul></div>" +
      '<div class="ct-d-sec">Evidence</div><ul class="ct-ev">' + s.evidence.map(function (e) { return "<li><b>" + esc(e.metric) + ":</b> " + esc(e.value) + "</li>"; }).join("") + "</ul>" +
      '<p class="ct-foot-meta">First seen ' + esc(ago(s.firstSeenAt)) + " · " + esc(view.freshness.sources[0].detail) + "</p></div>";
    const foot = (rec && s.status !== "in_progress" ? '<button class="ct-btn" data-sev="' + s.severity + '" data-review>' + esc(rec.cta) + "</button>" : "") +
      '<button class="ct-btn is-ghost" data-askabout>' + I.bot + 'Ask<span class="ct-hide-m"> FoodBridge</span></button>' +
      '<button class="ct-more" data-dismiss aria-label="More: dismiss">' + I.more + "</button>";
    return { label: labelOf(s), body: body, foot: foot, bind: function (el) {
      el.addEventListener("click", function (e) {
        const b = e.target.closest("button"); if (!b) return;
        if ("review" in b.dataset) review(id, null, true);
        else if ("askabout" in b.dataset) askAbout(s);
        else if ("dismiss" in b.dataset) sheet(function () { return dismissScreen(id); }, true);
        else if ("allrows" in b.dataset) { $("#ct-rows", el).innerHTML = rows.map(rowHtml).join(""); }
      });
    } };
  }
  function sevVar(s) { return s === "critical" ? "crit" : s === "high" ? "high" : s === "medium" ? "med" : "opp"; }
  function labelOf(s) { return { STOCKOUT_RISK: "Stock risk", ORDER_RISK: "Order risk", PAYMENT_OVERDUE: "Cash risk", CUSTOMER_INACTIVITY: "Customer risk", DEAD_STOCK: "Slow stock", SALES_OPPORTUNITY: "Sales opportunity" }[s.type] || s.type; }
  function askAbout(s) {
    close();
    if (ui.tab !== "home") setTab("home");
    ui.focusId = s.id;
    ask("Why " + s.title.charAt(0).toLowerCase() + s.title.slice(1) + "?");
    const b = $("#ct-ai"); if (b) b.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function dismissScreen(id) {
    const s = sigById(id);
    const reasons = ["Not relevant", "Already handled", "Incorrect", "Don't show again", "Other"];
    return { label: "Dismiss",
      body: '<h2 class="ct-d-title">Dismiss this?</h2><p class="ct-d-sum">Tell FoodBridge why — it learns from it.' +
        (s && s.severity === "critical" ? " Critical risks come back if they get worse." : " It comes back if something new joins it.") + "</p>" +
        '<div class="ct-opts">' + reasons.map(function (r, i) { return '<label><input type="radio" name="ct-dr" value="' + esc(r) + '"' + (i === 0 ? " checked" : "") + ">" + esc(r) + "</label>"; }).join("") + "</div>" +
        '<textarea class="ct-field" id="ct-dnote" placeholder="Anything else? (optional)"></textarea>',
      foot: '<button class="ct-btn is-ghost" data-back>Cancel</button><button class="ct-btn is-danger" data-do>Dismiss</button>',
      bind: function (el) {
        $("[data-do]", el).addEventListener("click", function () {
          const r = ($('input[name="ct-dr"]:checked', el) || {}).value;
          try { tower.store.dismiss(id, r, $("#ct-dnote", el).value.trim() || null, s); }
          catch (e) { return toast(e.message + " It wasn't dismissed."); }
          close(); refresh(true); toast("Dismissed — " + r.toLowerCase() + ".");
        });
      } };
  }

  /* ── action review → confirm → result ────────────────────────────────── */
  function review(id, opt, push) {
    const pv = tower.actions.prepare(id);
    if (!pv.ok) return toast(pv.error.message);
    pv.aiAssisted = !!(opt && opt.aiAssisted);
    if (!push) ui.lastFocus = document.activeElement;
    sheet(function () { return reviewScreen(pv); }, push);
  }
  function reviewScreen(pv) {
    let body = '<div class="ct-sig-meta" style="margin:0"><span class="ct-cls" style="margin:0">' + esc(pv.clsLabel) + "</span>" +
      (pv.aiAssisted ? '<span class="ct-tag is-ai" style="margin:0">PREPARED BY FOODBRIDGE AI</span>' : "") + "</div>" +
      '<h2 class="ct-d-title">' + esc(pv.title) + "</h2>" +
      (pv.basis ? '<p class="ct-d-sum">' + esc(pv.basis) + "</p>" : "") +
      (pv.reason ? '<ul class="ct-why" style="margin-bottom:6px">' + pv.reason.map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") + "</ul>" : "") +
      (pv.impact && typeof pv.impact.value === "number" ? '<p class="ct-d-sum"><b>' + esc(pv.impact.description) + "</b></p>" : "");

    if (pv.actionType === "create_purchase_request") {
      body += '<div class="ct-d-sec">' + F.plural(pv.lines.length, "product") + '</div><div class="ct-lines">' + pv.lines.map(function (l, i) {
        return '<div class="ct-line"><span class="ct-line-n">' + esc(l.name) + '</span><span class="ct-line-s">' + esc(l.supplierName || "Supplier not on file") +
          (l.hint ? " · " + esc(l.hint) : "") + (l.suggestedQty ? " · suggested " + l.suggestedQty : "") + (l.mrp ? " · MRP ₹" + l.mrp : "") + "</span>" + stepper("l", i, l.qty) + "</div>";
      }).join("") + '</div><div class="ct-tot"><span>Value at MRP</span><b id="ct-tot">' + prTotal(pv) + "</b></div>";
    } else if (pv.actionType === "create_orders") {
      body += '<div class="ct-d-sec">' + F.plural(pv.shops.length, "order") + "</div>" + pv.shops.map(function (sh, si) {
        return '<div class="ct-shop' + (sh.include ? "" : " is-off") + '" data-shop="' + si + '"><label><input type="checkbox" class="ct-check" data-inc="' + si + '"' + (sh.include ? " checked" : "") + ">" + esc(sh.name) +
          "<small>" + F.plural(sh.lines.length, "line") + '</small></label><div class="ct-lines">' + (sh.lines.length ? sh.lines.map(function (l, li) {
            return '<div class="ct-line"><span class="ct-line-n">' + esc(l.name) + '</span><span class="ct-line-s">' + (l.suggestedQty !== undefined ? "Suggested " + l.suggestedQty : "") + (l.price ? " · MRP ₹" + l.price : "") + "</span>" + stepper("o" + si, li, l.qty) + "</div>";
          }).join("") : '<div class="ct-line"><span class="ct-line-s">No lines to start from.</span></div>') + "</div></div>";
      }).join("");
    } else if (pv.actionType === "send_reminders") {
      body += '<div class="ct-d-sec">' + F.plural(pv.messages.length, "reminder") + " · " + esc(pv.channel) + "</div>" + pv.messages.map(function (m, i) {
        return '<div class="ct-msg"><label><input type="checkbox" class="ct-check" data-minc="' + i + '" checked>' + esc(m.name) + "<small>" + esc(F.inr(m.amount)) +
          '</small></label><label class="ct-sr" for="ct-m' + i + '">Message to ' + esc(m.name) + '</label><textarea id="ct-m' + i + '" data-body="' + i + '">' + esc(m.body) + "</textarea></div>";
      }).join("");
    } else if (pv.actionType === "create_followup") {
      body += '<div class="ct-d-sec">' + F.plural(pv.customers.length, "shop") + '</div><div class="ct-opts">' + pv.customers.map(function (c, i) {
        return '<label><input type="checkbox" data-cinc="' + i + '" checked>' + esc(c.name) + "</label>";
      }).join("") + "</div>";
    }
    body += '<div class="ct-honest">' + I.info + "<span>" + esc(pv.note) + "</span></div>";
    const verb = pv.actionType === "create_orders" ? "Confirm orders" : pv.actionType === "create_purchase_request" ? "Confirm purchase request"
      : pv.actionType === "send_reminders" ? "Approve reminders" : "Save call list";
    return { label: "Review", body: body,
      foot: '<button class="ct-btn is-ghost" data-back>Cancel</button><button class="ct-btn" data-confirm>' + esc(verb) + "</button>",
      bind: function (el) {
        el.addEventListener("click", function (e) {
          const b = e.target.closest("button"); if (!b) return;
          if (b.dataset.step) {
            const inp = $('input[data-q="' + b.dataset.step + '"]', el);
            inp.value = Math.max(0, (parseInt(inp.value, 10) || 0) + Number(b.dataset.d));
            inp.dispatchEvent(new Event("input", { bubbles: true }));
          }
          if ("confirm" in b.dataset) confirmAction(pv, b);
        });
        el.addEventListener("input", function (e) {
          const t = e.target;
          if (t.dataset.q) {
            const parts = t.dataset.q.split(":"), v = Math.max(0, parseInt(t.value, 10) || 0);
            if (parts[0] === "l") pv.lines[+parts[1]].qty = v;
            else pv.shops[+parts[0].slice(1)].lines[+parts[1]].qty = v;
            const tot = $("#ct-tot", el); if (tot) tot.textContent = prTotal(pv);
          }
          if (t.dataset.body !== undefined) pv.messages[+t.dataset.body].body = t.value;
        });
        el.addEventListener("change", function (e) {
          const t = e.target;
          if (t.dataset.inc !== undefined) { pv.shops[+t.dataset.inc].include = t.checked; t.closest(".ct-shop").classList.toggle("is-off", !t.checked); }
          if (t.dataset.minc !== undefined) { pv.messages[+t.dataset.minc].include = t.checked; t.closest(".ct-msg").classList.toggle("is-off", !t.checked); }
          if (t.dataset.cinc !== undefined) pv.customers[+t.dataset.cinc].include = t.checked;
        });
      } };
  }
  function stepper(g, i, q) {
    const k = g + ":" + i;
    return '<span class="ct-step"><button type="button" data-step="' + k + '" data-d="-1" aria-label="Less">−</button>' +
      '<input type="number" inputmode="numeric" min="0" data-q="' + k + '" value="' + (q || 0) + '" aria-label="Quantity">' +
      '<button type="button" data-step="' + k + '" data-d="1" aria-label="More">+</button></span>';
  }
  function prTotal(pv) {
    if (!pv.lines) return "";
    const priced = pv.lines.filter(function (l) { return l.mrp && l.qty > 0; });
    const all = pv.lines.filter(function (l) { return l.qty > 0; });
    if (!all.length) return "Nothing to order";
    const t = priced.reduce(function (n, l) { return n + l.qty * l.mrp; }, 0);
    return F.inrFull(t) + (priced.length < all.length ? " (" + (all.length - priced.length) + " without MRP not counted)" : "");
  }
  function confirmAction(pv, btn) {
    btn.disabled = true; btn.textContent = "Working…";
    let res;
    try { res = tower.actions.execute(pv, { confirmed: true, actor: "owner", aiAssisted: pv.aiAssisted }); }
    catch (e) { res = { ok: false, error: { message: e.message } }; }
    refresh(true);
    sheet(function () { return resultScreen(pv, res); }, true);
  }
  function resultScreen(pv, res) {
    if (res.ok) {
      const s = pv.signalId ? sigById(pv.signalId) : null;
      const after = s ? (s.phase === "monitoring" ? "This is now being monitored: " + s.summary
        : "Still needs attention: " + s.title) : pv.signalId ? "✓ " + titleFor(pv.signalId) + " — resolved." : null;
      return { label: "Done",
        body: '<div class="ct-result"><div class="ct-ok">' + I.check + "</div><h3>Done</h3><p>" + esc(res.message) + ".</p>" +
          '<ul>' + res.changed.concat(after ? [after] : []).map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></div>",
        foot: '<button class="ct-btn is-ghost" data-activity>View activity</button><button class="ct-btn" data-close>Back to Control Tower</button>',
        bind: function (el) { const a = $("[data-activity]", el); if (a) a.addEventListener("click", function () { close(); ui.alertsFilter = "activity"; setTab("alerts"); }); } };
    }
    return { label: "Couldn't complete",
      body: '<div class="ct-result"><div class="ct-ok ct-bad">' + I.alert + "</div><h3>Couldn't complete this</h3><p>" + esc(res.error.message) + "</p></div>",
      foot: '<button class="ct-btn is-ghost" data-close>Close</button><button class="ct-btn" data-retry>Try again</button>',
      bind: function (el) { $("[data-retry]", el).addEventListener("click", function () { ui.stack.pop(); paint(); }); } };
  }

  /* ── prepared actions (from the AI card) ─────────────────────────────── */
  function openPrepared() {
    const list = view.signals.filter(function (s) { return s.recommendation && s.status !== "in_progress"; }).slice(0, 3);
    sheet(function () {
      return { label: "Prepared actions",
        body: '<h2 class="ct-d-title">' + F.plural(list.length, "action") + ' ready for review</h2><p class="ct-d-sum">Prepared by FoodBridge AI from your records. Nothing happens until you confirm each one.</p>' +
          '<div class="ct-list">' + list.map(function (s) {
            return '<div class="ct-rec" style="border-color:var(--line);background:#fff"><div class="ct-sig-meta" style="margin:0 0 6px"><span class="ct-chip" data-sev="' + s.severity + '"><i></i>' + SEV[s.severity] + "</span>" +
              (typeof s.impact.value === "number" ? '<span class="ct-impact">' + esc(s.impact.description) + "</span>" : "") + "</div>" +
              "<b>" + esc(s.recommendation.title) + "</b><p>" + esc(s.title) + '</p><p style="margin-top:10px"><button class="ct-btn is-sm" data-prep="' + esc(s.id) + '">Review</button></p></div>';
          }).join("") + "</div>",
        bind: function (el) { el.addEventListener("click", function (e) { const b = e.target.closest("[data-prep]"); if (b) review(b.dataset.prep, { aiAssisted: true }, true); }); } };
    });
  }

  /* ── notifications, data status, support ─────────────────────────────── */
  function openNotifications() {
    const imp = view.signals.filter(function (s) { return s.severity === "critical" || s.severity === "high"; });
    sheet(function () {
      return { label: "Notifications",
        body: '<h2 class="ct-d-title">Notifications</h2><p class="ct-d-sum">Only what needs you — critical and high. Opportunities stay on the tower.</p>' +
          (imp.length ? '<div class="ct-list">' + imp.map(sigRow).join("") + "</div>" : '<div class="ct-healthy"><h3>Nothing urgent</h3></div>') +
          '<div class="ct-group-h">Recent activity</div>' + activity(),
        bind: function (el) {
          el.addEventListener("click", function (e) {
            const a = e.target.closest("[data-act]"); if (a) { e.stopPropagation(); return review(a.dataset.act, null, true); }
            const o = e.target.closest("[data-open-btn], [data-open]"); if (o) openSignal(o.dataset.openBtn || o.dataset.open, true);
          });
        } };
    });
  }
  function openStatus() {
    sheet(function () {
      const fr = view.freshness;
      return { label: "Data status",
        body: '<h2 class="ct-d-title">Data status</h2><p class="ct-d-sum">' +
          (fr.sample ? "You're looking at sample data, built from your imported orders. It isn't a live feed."
            : fr.delayed ? "Your records aren't live. Everything here is worked out from records that end on " + F.date(view.state.dataEnd) + "." : "Your records are current.") + "</p>" +
          '<ul class="ct-srcs">' + fr.sources.map(function (s) { return "<li><span>" + esc(s.label) + '</span><span class="ct-state" data-s="' + esc(s.state) + '">' + esc(stateWord(s.state)) + "</span><small>" + esc(s.detail) + "</small></li>"; }).join("") + "</ul>" +
          '<div class="ct-group-h">What more records would unlock</div><div class="ct-list">' + view.unavailable.map(function (u) {
            return '<div class="ct-na"><b>' + esc(u.title) + "</b>" + esc(u.reason) + "<small>" + esc(u.unlock) + "</small></div>";
          }).join("") + "</div>" +
          '<p class="ct-foot-meta">FoodBridge never shows a missing figure as zero.</p>',
        foot: '<button class="ct-btn is-ghost" data-refresh-now>Check again</button>',
        bind: function (el) { $("[data-refresh-now]", el).addEventListener("click", function () { refresh(true); ui.stack.pop(); openStatus(); toast("Checked — " + view.freshness.headline.toLowerCase() + "."); }); } };
    });
  }
  function openSupport(ctxId) {
    const pv = tower.actions.prepareEscalation({ signalId: ctxId || ui.focusId, conversation: ui.convo.filter(function (c) { return c.q; }).map(function (c) { return "You: " + c.q; }) });
    const past = tower.store.read().support.slice(-3).reverse();
    sheet(function () {
      const c = pv.context;
      return { label: "Support",
        body: '<h2 class="ct-d-title">Talk to a FoodBridge expert</h2><p class="ct-d-sum">They get everything below, so you won\'t have to repeat yourself.</p>' +
          '<div class="ct-rank"><b>What goes with you</b><ul>' +
            (c.issue ? "<li>Issue: " + esc(c.issue) + "</li>" : "") +
            "<li>" + F.plural(c.signals.length, "open signal") + (c.signals.length ? ": " + esc(c.signals.map(function (s) { return s.title; }).slice(0, 3).join("; ")) : "") + "</li>" +
            (c.freshness ? "<li>Data: " + esc(c.freshness) + "</li>" : "") +
            "<li>" + F.plural(c.recentActions.length, "recent action") + "</li>" +
            (c.conversation.length ? "<li>Your last " + F.plural(c.conversation.length, "question") + " to FoodBridge AI</li>" : "") + "</ul></div>" +
          '<label class="ct-d-sec" for="ct-help-note" style="display:block">Anything to add?</label><textarea class="ct-field" id="ct-help-note" placeholder="Optional"></textarea>' +
          '<div class="ct-honest">' + I.info + "<span>" + esc(pv.note) + "</span></div>" +
          (past.length ? '<div class="ct-group-h">Your requests</div><ul class="ct-log">' + past.map(function (h) { return "<li><b>" + esc(h.no) + "</b> · waiting<small>" + esc(ago(h.createdAt)) + (h.context && h.context.issue ? " · " + esc(h.context.issue) : "") + "</small></li>"; }).join("") + "</ul>" : ""),
        foot: '<button class="ct-btn is-ghost" data-close>Cancel</button><button class="ct-btn" data-send>Send to FoodBridge support</button>',
        bind: function (el) {
          $("[data-send]", el).addEventListener("click", function (e) {
            pv.message = $("#ct-help-note", el).value.trim();
            e.target.disabled = true;
            let res; try { res = tower.actions.execute(pv, { confirmed: true, actor: "owner" }); } catch (x) { res = { ok: false, error: { message: x.message } }; }
            refresh(true);
            sheet(function () { return resultScreen(pv, res); }, true);
          });
        } };
    });
  }

  /* ── create ──────────────────────────────────────────────────────────── */
  function createFlow(kind, push) {
    if (kind === "order") return sheet(function () { return shopPicker(); }, push);
    if (kind === "purchase") {
      const pv = tower.actions.preparePurchase();
      return sheet(function () { return reviewScreen(pv); }, push);
    }
    if (kind === "reminders") return review("overdue", null, push);
  }
  function shopPicker() {
    const shops = view.state.customers.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    const due = {};
    view.state.cadence.forEach(function (c) { if (c.bucket === "overdue" || c.bucket === "slipping") due[c.id] = c.bucket; });
    const list = function (q) {
      const t = String(q || "").toLowerCase();
      const hits = shops.filter(function (s) { return !t || s.name.toLowerCase().indexOf(t) !== -1; })
        .sort(function (a, b) { return (due[b.id] ? 1 : 0) - (due[a.id] ? 1 : 0); });
      return hits.length ? hits.map(function (s) {
        return '<button data-shop="' + esc(s.id) + '">' + esc(s.name) + (due[s.id] ? '<small style="color:#b54708;font-weight:700">' + (due[s.id] === "overdue" ? "Past cycle" : "Due now") + "</small>" : "") + "</button>";
      }).join("") : '<p class="ct-note">No shop found.</p>';
    };
    return { label: "New order",
      body: '<h2 class="ct-d-title">Who is it for?</h2><label class="ct-searchbox">' + I.search + '<span class="ct-sr">Search shops</span><input id="ct-shopq" autocomplete="off" placeholder="Search shops" autofocus></label>' +
        '<div class="ct-picks" id="ct-shops">' + list("") + "</div>",
      bind: function (el) {
        $("#ct-shopq", el).addEventListener("input", function (e) { $("#ct-shops", el).innerHTML = list(e.target.value); });
        el.addEventListener("click", function (e) {
          const b = e.target.closest("[data-shop]"); if (!b) return;
          const pv = tower.actions.prepareOrder(b.dataset.shop);
          if (!pv.ok) return toast(pv.error.message);
          sheet(function () { return reviewScreen(pv); }, true);
        });
      } };
  }

  /* ── search (desktop header) ─────────────────────────────────────────── */
  function searchResults(q) {
    const box = $("#ct-results"); if (!box) return;
    const t = String(q || "").trim().toLowerCase();
    if (t.length < 2) { box.hidden = true; box.innerHTML = ""; return; }
    const idx = [];
    view.signals.forEach(function (s) { if ((s.title + " " + labelOf(s)).toLowerCase().indexOf(t) !== -1) idx.push({ g: "Alerts", t: s.title, s: SEV[s.severity], go: function () { openSignal(s.id); } }); });
    view.state.products.forEach(function (p) {
      if ((p.name + " " + p.sku).toLowerCase().indexOf(t) !== -1) idx.push({ g: "Products", t: p.name, s: p.stock === null ? "no stock count" : p.stock + " on hand", go: function () { entity("product", p.id); } });
    });
    view.state.customers.forEach(function (c) { if (c.name.toLowerCase().indexOf(t) !== -1) idx.push({ g: "Shops", t: c.name, s: "", go: function () { entity("customer", c.id); } }); });
    view.state.made.forEach(function (o) { if ((o.no + " " + o.customer).toLowerCase().indexOf(t) !== -1) idx.push({ g: "Orders", t: o.no + " · " + o.customer, s: F.plural(o.items || 0, "unit"), go: function () { entity("customer", o.customerId); } }); });
    ui.searchIndex = idx.slice(0, 24);
    let g = "";
    box.innerHTML = ui.searchIndex.length ? '<div class="ct-picks" style="margin:0">' + ui.searchIndex.map(function (r, i) {
      const h = r.g !== g ? '<div class="ct-group-h" style="margin:8px 6px 2px">' + esc(r.g) + "</div>" : ""; g = r.g;
      return h + '<button data-result="' + i + '">' + esc(r.t) + "<small>" + esc(r.s) + "</small></button>";
    }).join("") + "</div>" : '<p class="ct-note">Nothing matches “' + esc(q) + "”.</p>";
    box.hidden = false;
  }
  function closeSearch() { const q = $("#ct-q"); if (q) q.value = ""; const b = $("#ct-results"); if (b) { b.hidden = true; b.innerHTML = ""; } }

  /* A product or a shop, in one place: the facts, and the signals that name it. */
  function entity(kind, id) {
    const st = view.state;
    const named = view.signals.filter(function (s) { return (s.rows || []).some(function (r) { return r.id === id; }); });
    let title, facts;
    if (kind === "product") {
      const d = window.CTSignals._detectors.demand(st).filter(function (x) { return x.product.id === id; })[0];
      const p = st.productById[id];
      title = p.name;
      facts = [["Stock on hand", p.stock === null ? "No count" : String(p.stock)], ["Committed to FoodBridge orders", String(d.committed)], ["On order", String(d.onOrder)],
               ["Sold, last 90 days of records", d.units90 + " units"], ["Shops buying it", String(d.buyers.length)],
               ["Stock cover", d.available === null ? "—" : d.available <= 0 ? "Out of stock" : isFinite(d.cover) ? Math.floor(d.cover) + " days" : "No recent sales"],
               ["MRP", p.mrp ? "₹" + p.mrp : "Not in the name"], ["Last sold", d.lastSold ? F.date(d.lastSold) : "Never"]];
    } else {
      const c = st.cadence.filter(function (x) { return x.id === id; })[0] || {};
      title = st.customerById[id];
      const inv = st.ledger && st.ledger.invoices ? st.ledger.invoices.filter(function (i) { return i.customerId === id && i.balance > 0; }) : null;
      facts = [["Last order", c.lastOrderAt ? F.date(c.lastOrderAt) : "None"], ["Usual cycle", c.cycleDays ? c.cycleDays + " days" : "—"],
               ["Where they are", { overdue: "Past their cycle", slipping: "Due now", on_track: "On cycle", unknown: "No history" }[c.bucket] || "No history"],
               ["Average order", typeof c.avgValue === "number" && c.avgValue > 0 ? F.inr(c.avgValue) : "—"], ["Orders on record", String(c.orderCount || 0)],
               ["Outstanding", inv ? F.inr(inv.reduce(function (n, i) { return n + i.balance; }, 0)) || "₹0" : "No invoices in your records"]];
    }
    sheet(function () {
      return { label: title,
        body: '<h2 class="ct-d-title">' + esc(title) + "</h2>" + kv(facts) +
          (named.length ? '<div class="ct-group-h">Named in</div><div class="ct-list">' + named.map(sigRow).join("") + "</div>" : '<p class="ct-note">Nothing about this needs you right now.</p>'),
        foot: kind === "customer" ? '<button class="ct-btn" data-neworder>' + I.cart + "Create order</button>" : "",
        bind: function (el) {
          el.addEventListener("click", function (e) {
            const b = e.target.closest("button"); if (!b) return;
            if ("neworder" in b.dataset) { const pv = tower.actions.prepareOrder(id); sheet(function () { return reviewScreen(pv); }, true); }
            else if (b.dataset.act) { e.stopPropagation(); review(b.dataset.act, null, true); }
            else if (b.dataset.openBtn) openSignal(b.dataset.openBtn, true);
          });
        } };
    });
  }

  /* ── live updates ────────────────────────────────────────────────────── */
  /* The owner's own action redraws at once. Anything else -- another tab,
     the clock -- is checked quietly and OFFERED: the screen never reorders
     while they are working on it. A new critical signal also toasts. */
  function refresh(now) {
    const before = new Set(view.signals.map(function (s) { return s.id + ":" + s.severity; }));
    view = tower.pass();
    const sig = signature(view);
    if (now) { ui.sig = sig; ui.pending = 0; hidePill(); draw(); return; }
    if (sig === ui.sig) return;
    const fresh = view.signals.filter(function (s) { return !before.has(s.id + ":" + s.severity); });
    ui.pending = Math.max(1, fresh.length || 1);
    const crit = fresh.filter(function (s) { return s.severity === "critical"; })[0];
    if (crit) toast("Critical: " + crit.title, true);
    showPill();
  }
  function showPill() {
    if (isOpen()) return;
    let p = $("#ct-pill");
    if (!p) { p = document.createElement("div"); p.id = "ct-pill"; p.className = "ct-pill"; p.setAttribute("role", "status"); document.body.appendChild(p); }
    p.innerHTML = "<span>" + F.plural(ui.pending, "new update") + '</span><button type="button">Refresh</button>';
    $("button", p).onclick = function () { refresh(true); };
  }
  function hidePill() { const p = $("#ct-pill"); if (p) p.remove(); }
  function toast(msg, crit) {
    let t = $("#ct-toast");
    if (t) t.remove();
    t = document.createElement("div"); t.id = "ct-toast"; t.className = "ct-toast" + (crit ? " is-crit" : ""); t.setAttribute("role", crit ? "alert" : "status");
    t.textContent = msg; document.body.appendChild(t);
    clearTimeout(ui.toastT); ui.toastT = setTimeout(function () { if (t.parentNode) t.remove(); }, 3600);
  }
  function wireGlobal() {
    /* Coalesced: one action elsewhere writes several keys. */
    window.addEventListener("storage", function (e) {
      if (e.key && e.key.indexOf("fb.v7.") !== 0) return;
      clearTimeout(ui.storageT);
      ui.storageT = setTimeout(function () { refresh(false); }, 250);
    });
    setInterval(function () {
      $$("[data-ago]").forEach(function (el) { el.textContent = ago(el.getAttribute("data-ago")); });
    }, 30000);
    setInterval(function () { refresh(false); }, 60000);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) close();
      if (e.key === "/" && isDesktop() && document.activeElement === document.body) { const q = $("#ct-q"); if (q) { e.preventDefault(); q.focus(); } }
    });
    document.addEventListener("click", function (e) { if (!e.target.closest(".ct-search")) { const b = $("#ct-results"); if (b) b.hidden = true; } });
    window.matchMedia("(min-width: 1100px)").addEventListener("change", function () { if (!isOpen()) draw(); });
    /* A notification link that arrives while the tower is already open
       changes only the platform's hash -- the frame does not reload -- so the
       new ?signal= is opened here rather than on the next load. */
    const hashWin = platformWin() || window;
    try {
      hashWin.addEventListener("hashchange", function () {
        const id = deepLink();
        if (id && sigById(id)) { close(); openSignal(id); }
      });
    } catch (e) { /* a window we may not listen to */ }
    let wasShell = shellDesktop();
    window.addEventListener("resize", function () {
      applyFrame();
      const now = shellDesktop();
      if (now !== wasShell) { wasShell = now; if (!isOpen()) draw(); }
    });
  }
  /* A notification deep-links to its signal: ?signal=id here, or
     #/control-tower?signal=id on the platform above. */
  function deepLink() {
    const own = new URLSearchParams(location.search).get("signal");
    if (own) return own;
    try {
      const h = (platformWin() || window.top).location.hash || "";
      const q = h.indexOf("?");
      return q === -1 ? null : new URLSearchParams(h.slice(q + 1)).get("signal");
    } catch (e) { return null; }
  }

  window.FBControlTower = { mount: mount, _ui: ui, _view: function () { return view; } };
})();

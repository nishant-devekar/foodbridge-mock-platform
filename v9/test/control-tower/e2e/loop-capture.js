/* ==========================================================================
   LOOP CAPTURE — every delivery incident, driven end to end through the two
   real apps, with a screenshot at each step (24 Sep 2026).

     driver raises it → tower shows it → owner acts → driver sees the owner's
     action → driver finishes → tower closes it (On track)

   Load into the delivery app page (served from v7/), with html2canvas:

     const s = document.createElement("script"); s.src = "/test/control-tower/e2e/loop-capture.js"; document.head.appendChild(s);
     await LOOP.setup();                     // starts Andheri West Beat, snapshots the day
     const r = await LOOP.run("shop-closed"); // → { key, title, steps: [{ who, label, img }], log }
     LOOP.keys()                             // every flow

   The Control Tower runs in a 420×860 same-origin iframe, so what the owner
   writes reaches this page through the storage event, exactly as two phones
   on one account would. Every flow starts clean: the event stream and the
   tower's records are cleared, the delivery app's day is restored, and the
   demo clock is set to 9:05 am (fb-clock.js). Nothing here is mocked: each
   step is a click on the real screen, and each screenshot is the real page.
   ========================================================================== */

(function (root) {
  "use strict";
  const W = 420, HGT = 860;
  const DAY1 = "2026-09-24", DAY2 = "2026-09-25";
  const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  const A = function () { return root.RD.actions; };
  const norm = function (s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); };
  let steps = [], log = [], db0 = null;

  /* ── capture ─────────────────────────────────────────────────────────── */
  function cssOf(doc) {
    return Array.prototype.map.call(doc.styleSheets, function (s) {
      try { return Array.prototype.map.call(s.cssRules, function (r) { return r.cssText; }).join("\n"); } catch (e) { return ""; }
    }).join("\n");
  }
  function prep(src) {
    const css = cssOf(src);
    return function (d) {
      d.querySelectorAll('link[rel="stylesheet"]').forEach(function (l) { l.remove(); });
      const st = d.createElement("style");
      st.textContent = css + "\n*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
      d.head.appendChild(st);
    };
  }
  /* The tower's cards are centred, transformed, sliding panes: only the
     browser's own layout (foreignObject) draws them right. At scale 1 —
     html2canvas crops a scaled foreignObject — then shrunk here. */
  async function shoot(win, doc, fo) {
    /* A foreignObject drawing can't keep a scroll position: a pane the owner
       scrolled (a long list, its confirm at the foot) is drawn from its top.
       So each scrolled pane's content is moved up by as much in the copy. */
    const panes = Array.prototype.slice.call(doc.querySelectorAll(".ct-dm"));
    const tops = panes.map(function (p) { return p.scrollTop; });
    const base = prep(doc);
    const c = await win.html2canvas(doc.body, { scale: fo ? 1 : 0.6, backgroundColor: "#ffffff", logging: false, foreignObjectRendering: !!fo,
      windowWidth: W, windowHeight: HGT, width: W, height: HGT, onclone: function (d) {
        base(d);
        d.querySelectorAll(".ct-dm").forEach(function (p, i) {
          const top = tops[i]; if (!top) return;
          p.scrollTop = 0; p.style.overflow = "hidden";
          Array.prototype.forEach.call(p.children, function (ch) { ch.style.transform = "translateY(" + -top + "px)"; });
        });
      } });
    if (!fo) return c.toDataURL("image/jpeg", 0.62);
    const out = document.createElement("canvas");
    out.width = Math.round(W * 0.6); out.height = Math.round(HGT * 0.6);
    const g = out.getContext("2d");
    g.drawImage(c, 0, 0, c.width, c.height, 0, 0, out.width, out.height);
    /* A card open means the page under it is dimmed: its left edge, beside
       the card, is grey, not white. White there means the card didn't draw
       (a page the browser isn't showing can miss it, 25 Sep 2026). */
    const px = g.getImageData(3, Math.round(out.height / 2), 1, 1).data;
    shoot.dimmed = px[0] < 200;
    return out.toDataURL("image/jpeg", 0.62);
  }
  async function driver(label) {
    root.RD.render(); await wait(120);
    steps.push({ who: "driver", label: label, img: await shoot(root, document) });
  }
  async function tower(label) {
    const f = frame();
    const card = !!f.contentDocument.querySelector(".ct-sheet.is-modal");
    let img = await shoot(f.contentWindow, f.contentDocument, true);
    for (let n = 0; card && !shoot.dimmed && n < 4; n++) { await wait(700); img = await shoot(f.contentWindow, f.contentDocument, true); }
    if (card && !shoot.dimmed) log.push("BLANK CARD · " + label);
    steps.push({ who: "tower", label: label, img: img });
  }

  /* ── the tower, in its own frame ─────────────────────────────────────── */
  function frame() { return document.getElementById("__loop_tower"); }
  async function openTower(qs) {
    let f = frame(); if (f) f.remove();
    f = document.createElement("iframe");
    f.id = "__loop_tower";
    f.style.cssText = "position:fixed;top:0;left:4000px;width:" + W + "px;height:" + HGT + "px;border:0;";
    f.src = "/screens/control-tower.html" + (qs || "");
    document.body.appendChild(f);
    await new Promise(function (r) { f.onload = r; setTimeout(r, 5000); });
    if (!f.contentWindow.html2canvas) {
      const s = f.contentDocument.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      f.contentDocument.head.appendChild(s);
      await new Promise(function (r) { s.onload = r; setTimeout(r, 5000); });
    }
    await wait(1100);
    return f;
  }
  function td() { return frame().contentDocument; }
  /* The row the tower draws for what matches `pick`, from the tower's own
     engine in its own frame. */
  function rowId(pick) {
    const w = frame().contentWindow;
    const store = w.CTStore.create(w.localStorage);
    const readRaw = function () {
      const r = w.FBContext.raw();
      const kind = r.dataReady && r.dataReady.provenance && r.dataReady.provenance.kind;
      if ((!r.dataReady || kind === "sample") && w.CTDemo) r.dataReady = w.CTDemo.dataReady(w.Date.now()) || r.dataReady;
      return r;
    };
    const t = w.CTTower.create({ store: store, readRaw: readRaw, business: function () { return null; } });
    const v = t.pass();
    const d = w.CTLevers.build(v, { demand: w.CTSignals._detectors.demand(v.state) }).levers.filter(function (l) { return l.id === "deliveries"; })[0];
    const rows = [].concat(d.tiles.ugly.rows, d.tiles.bad.rows, d.tiles.good.rows);
    const r = rows.filter(pick)[0];
    if (!r) throw new Error("no tower row for this flow");
    return r.id;
  }
  function pane() {
    const on = td().querySelector('.ct-dm[data-pos="on"]');
    return on ? on.getAttribute("data-pane") + ": " + on.innerText.replace(/\s+/g, " ").slice(0, 170) : "(no card)";
  }
  async function tclick(sel, ms) {
    const e = td().querySelector(sel);
    if (!e) throw new Error("tower: nothing at " + sel + " · " + pane());
    e.click(); await wait(ms || 700);
  }
  async function ttype(key, value) {
    const e = td().querySelector('[data-tx="' + key + '"]');
    if (!e) throw new Error("tower: no field " + key);
    e.value = value; e.dispatchEvent(new Event("input", { bubbles: true })); await wait(150);
  }
  /* The card for `pick`: the list first (what the owner sees), then the card. */
  async function towerShows(pick, listLabel, cardLabel) {
    await openTower("?lever=deliveries");
    await tower(listLabel);
    const id = rowId(pick);
    await openTower("?lever=deliveries&item=" + encodeURIComponent(id));
    log.push("tower card · " + pane());
    await tower(cardLabel);
    return id;
  }
  async function towerCard(id, label) {
    await openTower("?lever=deliveries&item=" + encodeURIComponent(id));
    log.push("tower card · " + pane());
    await tower(label);
  }
  /* The close: the On track tile opened, so its list shows what was fixed. */
  async function towerList(label) {
    await openTower("?lever=deliveries");
    const t = td().querySelector('[data-tile="good"]:not([disabled])');
    if (t && t.getAttribute("aria-selected") !== "true") { t.click(); await wait(500); }
    log.push("tower list · " + td().body.innerText.replace(/\s+/g, " ").slice(0, 220));
    await tower(label);
  }
  /* The owner's action, click by click: call → an answer, or a button,
     then its choices, then Confirm. */
  async function owner(plan, id) {
    await openTower("?lever=deliveries&item=" + encodeURIComponent(id));
    for (const s of plan) {
      if (s.call) { await tclick('[data-a="call"][data-who="' + (s.who || "shop") + '"]', 1200); log.push("owner · call · " + pane()); await tower(s.label || "Owner calls — what did they say?"); }
      if (s.oc !== undefined) { await tclick('[data-oc="' + s.oc + '"]', 900); log.push("owner · answer · " + pane()); }
      if (s.act) { await tclick('[data-act="' + s.act + '"]', 900); log.push("owner · " + s.act + " · " + pane()); }
      if (s.pk) { await tclick('[data-pk="' + s.pk[0] + '"][data-v="' + s.pk[1] + '"]', 350); }
      if (s.type) { await ttype(s.type[0], s.type[1]); }
      if (s.shot) await tower(s.shot);
      if (s.go) { const g = td().querySelector('[data-a="ap-go"]'); if (g && !g.hidden && g.offsetParent !== null) { g.click(); await wait(800); }
        /* The owner pressed it at the foot of the pane: the confirm is where they are looking. */
        const cf = td().querySelector('.ct-dm[data-pos="on"] .ct-rs-conf:not([hidden])'); if (cf) { cf.scrollIntoView({ block: "end" }); await wait(200); }
        log.push("owner · confirm · " + pane()); if (s.goShot) await tower(s.goShot); }
      if (s.yes) { await tclick('[data-a="ap-yes"]', 1000); log.push("owner · done · " + pane()); if (s.yesShot) await tower(s.yesShot); }
      if (s.then) { await wait(s.then); }
    }
  }

  /* ── the delivery app ────────────────────────────────────────────────── */
  function go(path) { root.RD.go(path); return wait(160); }
  function stopOf(id, rid) { return root.RD_DB.getStops(rid || "RTE-001").filter(function (s) { return s.id === id; })[0]; }
  async function openStop(id, rid) { await go("/delivery/" + (rid || "RTE-001") + "/" + id); }
  async function queue(label, rid) { await go("/queue/" + (rid || "RTE-001")); if (label) await driver(label); }
  async function skip(id, reason, note, labels) {
    await go("/skip-stop/RTE-001/" + id);
    A()["skip-reason"](reason); A()["skip-back"]("none");
    root.RD.state.scratch.skipNote = note || "";
    await driver(labels[0]);
    A()["skip-confirm"](); await driver(labels[1]);
    A()["skip-commit"](id); await wait(1400);
  }
  async function issue(id, kind, note, gap, label) {
    await go("/issue/RTE-001/" + id);
    root.RD.state.routeId = "RTE-001";
    A()["issue-kind"](kind);
    root.RD.state.scratch.issueNote = note || "";
    if (gap) root.RD.state.scratch.issueGap = String(gap);
    A()["issue-confirm"]();
    await driver(label);
    A()["issue-send"](id); await wait(1400);
  }
  async function problem(kind, where, label, label2) {
    await go("/problem/RTE-001");
    A()["problem-kind"](kind);
    root.RD.state.scratch.problemWhere = where || "";
    A()["problem-confirm"]();
    await driver(label);
    A()["problem-send"]("RTE-001"); await wait(1400);
    if (label2) await driver(label2);
  }
  async function pay(id, label1, label2, o) {
    o = o || {};
    await go("/payment/" + (o.rid || "RTE-001") + "/" + id);
    const S = root.RD.state.scratch;
    if (o.amount !== undefined) { S.payAmount = String(o.amount); S.payPrefilled = false; }
    if (o.short) S.payShort = o.short;
    A()["pay-confirm"]();
    if (label1) await driver(label1);
    A()["pay-commit"](id); await wait(1400);
    if (label2) await driver(label2);
  }
  /* Can't pay at the door, before handing over: Report an Issue's Payment
     reasons (the office decides credit or collection). */
  async function cantPay(id, kind, label) {
    await issue(id, kind, null, null, label);
  }
  async function giveBack(id, reason, detail, labels, rid) {
    root.RD.state.routeId = rid || "RTE-001";
    root.RD.state.returnStopId = id;
    await go("/return-acceptance/" + (rid || "RTE-001"));
    const load = root.RD_DB.db.stockLoads[rid || "RTE-001"];
    A()["return-inc"](load.products[1].productId); A()["return-inc"](load.products[1].productId);
    A()["return-choose"]();
    A()["return-reason"](reason);
    if (detail) A()["return-damage"](detail);
    await driver(labels[0]);
    A()["return-reason-confirm"]();
    A()["return-commit"](rid || "RTE-001"); await wait(1400);
  }
  async function edit(id, why, label) {
    await openStop(id);
    const S = root.RD.state.scratch;
    S.editing = true; root.RD.render(); await wait(100);
    S.items[0].qty = Math.max(0, S.items[0].qty - 2);
    S.editConfirming = true; S.editWhy = why;
    await driver(label);
    A()["edit-commit"](); await wait(1400);
  }
  async function loadCheck(o, label) {
    await go("/load-stock/RTE-001");
    const S = root.RD.state.scratch;
    if (o.set) Object.keys(o.set).forEach(function (i) { S.stockQtys[+i] = o.set[i]; });
    S.dockPapers = o.noDocs ? "missing" : "ready"; S.dockBatch = o.batch ? "off" : "ok";
    A()["stock-confirm"]();
    await driver(label);
    A()["stock-commit"]("RTE-001"); await wait(1400);
  }
  async function count(o, label) {
    await go("/settlement/stock/RTE-001");
    const S = root.RD.state.scratch;
    const sheet = root.RD_SDK.routeDelivery.getStockCountSheet({ routeId: "RTE-001" }).data;
    S.actuals = sheet.items.map(function (it) { return String(it.expectedReturn); });
    S.actuals[o.i] = String(sheet.items[o.i].expectedReturn + o.diff);
    S.countNote = o.note || "Counted twice";
    A()["count-confirm"]();
    await driver(label);
    A()["count-commit"]("RTE-001"); await wait(300);
  }
  /* The office's question: the queue's Office strip says one is waiting,
     the Office screen lists it, the reply sheet sends the answer. */
  async function answer(label1, label2, rid) {
    await queue(label1, rid);
    await go("/office/" + (rid || "RTE-001"));
    const b = document.querySelector('[data-act="office-reply-open"]');
    if (!b) throw new Error("driver: no question from the office");
    b.click(); await wait(250);
    const q = document.querySelector('[data-act="office-quick"]');
    if (q) { q.click(); await wait(200); }
    if (label2) await driver(label2);
    const send = document.querySelector('[data-act="office-reply-send"]');
    if (!send) throw new Error("driver: no Send Reply");
    send.click(); await wait(1300);
  }
  /* The van moves again: the Office screen's We're Moving Again, confirmed. */
  async function moving(label1, label2) {
    await go("/office/RTE-001");
    if (label1) await driver(label1);
    const b = document.querySelector('[data-act="office-moving-confirm"]');
    if (!b) throw new Error("driver: no open van problem");
    b.click(); await wait(250);
    const c = document.querySelector('[data-act="office-moving"]');
    if (!c) throw new Error("driver: no confirm for moving again");
    c.click(); await wait(1300);
    if (label2) await driver(label2);
  }
  /* Proof of delivery, through the real sheet: a signature, saved. A day
     that runs to the evening needs it on every drop, or the route ends
     with the tower's "POD missing" on that stop. */
  async function proof(id, rid) {
    await go("/stop-summary/" + (rid || "RTE-001") + "/" + id);
    A()["pod-open"](id);
    root.RD.state.scratch.podSign = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    A()["pod-save"](id); await wait(1300);
  }
  /* Crates at the door, in Manage Assets with every other returnable. */
  async function crates(id, out, back, label) {
    const st = stopOf(id);
    root.RD.state.scratch.assetOrgId = st.customerId;
    await go("/manage-assets/RTE-001/" + id);
    const S = root.RD.state.scratch;
    S.assetOrgId = st.customerId; S.giving = { "AST-CRATE-L": out }; S.taking = { "AST-CRATE-L": back };
    A()["asset-confirm"]();
    await driver(label);
    A()["asset-commit"](st.customerId); await wait(1400);
  }

  /* ── the day ─────────────────────────────────────────────────────────── */
  async function setup() {
    if (!root.html2canvas) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      document.head.appendChild(s);
      await new Promise(function (r) { s.onload = r; });
    }
    root.FB_CLOCK.at(DAY1 + "T09:05:00+05:30");
    const r = root.RD_DB.db.routeDetails["RTE-001"];
    if (r.status !== "IN_PROGRESS") { await go("/sign-off/RTE-001"); A()["signoff-start"]("RTE-001"); await wait(300); }
    db0 = JSON.parse(JSON.stringify(root.RD_DB.db));
    return "ready";
  }
  function reset(day, time) {
    Object.keys(localStorage).filter(function (k) { return k.indexOf("fb.v7.") === 0 && k !== "fb.v7.demoClock"; }).forEach(function (k) { localStorage.removeItem(k); });
    Object.keys(db0).forEach(function (k) { root.RD_DB.db[k] = JSON.parse(JSON.stringify(db0[k])); });
    root.RD.state.scratch = {};
    root.RD.state.routeId = "RTE-001";
    root.RD_OFFICE._state.applied = {};
    root.FB_CLOCK.at((day || DAY1) + "T" + (time || "09:05") + ":00+05:30");
    const f = frame(); if (f) f.remove();
  }
  function at(day, time) {
    root.FB_CLOCK.at(day + "T" + time + ":00+05:30");
    /* A new day's route: the delivery app starts it again. */
    if (day !== DAY1) {
      Object.keys(db0).forEach(function (k) { root.RD_DB.db[k] = JSON.parse(JSON.stringify(db0[k])); });
      root.RD.state.scratch = {};
      root.RD_OFFICE._state.applied = {};
    }
  }
  const titled = function (t) { return function (r) { return norm(r.title) === norm(t); }; };
  const tagged = function (type) { return function (r) { return r.tag && r.tag.type === type; }; };

  /* ── the flows ───────────────────────────────────────────────────────── */
  /* Shared shapes: a missed stop the office sends back today; one it asks
     about; one it closes at once (money). */
  function backToday(o) {
    return async function () {
      const st = stopOf(o.stop);
      await openStop(o.stop); await driver("Driver opens " + st.customerName);
      await skip(o.stop, o.reason, o.note, ["Driver: " + o.reasonLabel + " — why no delivery?", "Driver confirms the skip"]);
      await queue("Driver's queue: " + st.customerName + " skipped");
      const id = await towerShows(titled(st.customerName), "Tower: Deliveries turns " + (o.urgent === false ? "Pending" : "Urgent"), "Tower: the incident — what happened, impact, recommends");
      await owner(o.plan, id);
      await queue("Driver's queue: the office's word on " + st.customerName);
      await openStop(o.stop); await driver("Driver opens it: the office's banner");
      await pay(o.stop, "Driver collects", "Delivered and paid");
      await towerCard(id, "Tower: the incident, fixed");
      await towerList("Tower: On track");
    };
  }
  function askLoop(o) {
    return async function () {
      const id = await o.raise();
      await owner([{ act: "ask", shot: "Owner: Ask the team", go: true, goShot: "Owner confirms the question", yes: true, yesShot: "Question sent" }], id);
      await answer("Driver's queue: the office asks", "Driver answers — it goes to the office", o.rid);
      await towerCard(id, "Tower: the driver's answer is on the card");
      await owner([{ act: "close", yesShot: null }], id);
      await tower("Owner closes it as explained");
      if (o.after) await o.after(id);
      await towerCard(id, "Tower: the incident, fixed");
      await towerList("Tower: On track");
    };
  }

  const F = {};
  F["shop-closed"] = { title: "Shop closed", run: backToday({ stop: "STP-0101", reason: "SHOP_CLOSED", reasonLabel: "Shop Closed", note: "Shutter down, owner not picking up",
    plan: [{ call: true, label: "Owner calls the shop — what did they say?" }, { oc: 0 }, { pk: ["after", "next"], shot: "Owner: Try again today — after the next stop", go: true, goShot: "Owner confirms: the van goes back, Rahul is told", yes: true, yesShot: "Back on today's route" }] }) };
  F["customer-unavailable"] = { title: "Customer unavailable", run: backToday({ stop: "STP-0103", reason: "OWNER_AWAY", reasonLabel: "Owner Away", note: "Owner gone to the mandi", urgent: false,
    plan: [{ call: true, label: "Owner calls the shop — what did they say?" }, { oc: 0 }, { shot: "Owner: Try again today", go: true, goShot: "Owner confirms", yes: true, yesShot: "Back on today's route" }] }) };
  F["address-inaccessible"] = { title: "Can't reach shop", run: backToday({ stop: "STP-0105", reason: "CANT_REACH", reasonLabel: "Can't reach shop", note: "Lane blocked by a truck", urgent: false,
    plan: [{ call: true, label: "Owner calls the shop — what did they say?" }, { oc: 0 }, { shot: "Owner: Try again today", go: true, goShot: "Owner confirms", yes: true, yesShot: "Back on today's route" }] }) };
  F["customer-refused"] = { title: "Customer refused", run: backToday({ stop: "STP-0107", reason: "REFUSED", reasonLabel: "Refused", note: "Says he ordered less",
    plan: [{ call: true, label: "Owner calls the customer — what did they say?" }, { oc: 1 }, { shot: "Owner: Fix the order", go: true, goShot: "Owner confirms the new total", yes: true, yesShot: "Order updated — the driver delivers it" }] }) };
  F["wrong-address"] = { title: "Wrong address", run: backToday({ stop: "STP-0109", reason: "WRONG_ADDRESS", reasonLabel: "Wrong address", note: "Shop moved to the next lane",
    plan: [{ call: true, label: "Owner calls the shop — what did they say?" }, { oc: 0 }, { type: ["address", "Shop 4, 2nd Lane, Andheri W"], shot: "Owner: the right address", go: true, yes: true, yesShot: "Details saved — now when to go back" },
           { pk: ["day", "0"] }, { pk: ["win", "afternoon"], shot: "Owner: Reschedule — today afternoon", go: true, goShot: "Owner confirms", yes: true, yesShot: "Delivery rescheduled" }] }) };
  F["van-full"] = { title: "Van full", run: backToday({ stop: "STP-0111", reason: "VAN_FULL", reasonLabel: "Van Full", note: "No room after the Kishore drop",
    plan: [{ act: "reschedule" }, { pk: ["day", "0"] }, { pk: ["win", "afternoon"], shot: "Owner: Reschedule — today afternoon", go: true, goShot: "Owner confirms", yes: true, yesShot: "Delivery rescheduled" }] }) };
  F["order-changed"] = { title: "Order changed", run: backToday({ stop: "STP-0113", reason: "FULLY_STOCKED", reasonLabel: "Fully Stocked", note: "Shelf full, will take half", urgent: false,
    plan: [{ act: "fixOrder", shot: "Owner: Fix the order", go: true, goShot: "Owner confirms the new total", yes: true, yesShot: "Order updated — the driver delivers it" }] }) };
  F["access-restriction"] = { title: "Access hours restriction", run: async function () {
      const st = stopOf("STP-0108");
      await openStop("STP-0108"); await driver("Driver at " + st.customerName);
      await issue("STP-0108", "hours", "Only takes deliveries 12 to 4", null, "Driver: Report an Issue — only delivers in certain hours");
      await queue("Driver's queue after telling the office");
      const id = await towerShows(titled(st.customerName), "Tower: Deliveries", "Tower: the incident");
      await owner([{ act: "reschedule" }, { pk: ["day", "0"] }, { pk: ["win", "afternoon"], shot: "Owner: Reschedule into their hours", go: true, goShot: "Owner confirms", yes: true, yesShot: "Delivery rescheduled" }], id);
      await queue("Driver's queue: the office's word"); await openStop("STP-0108"); await driver("Driver opens it: the office's banner");
      await pay("STP-0108", "Driver collects", "Delivered and paid");
      await towerCard(id, "Tower: the incident, fixed"); await towerList("Tower: On track");
    } };
  F["order-dispute"] = { title: "Order dispute", run: async function () {
      const st = stopOf("STP-0114");
      await openStop("STP-0114"); await driver("Driver at " + st.customerName);
      await issue("STP-0114", "order", "Says he ordered 2 packs of Chakli, not 4", null, "Driver: Report an Issue — disputes the order");
      const id = await towerShows(titled(st.customerName), "Tower: Deliveries turns Urgent", "Tower: the incident");
      await owner([{ call: true, label: "Owner calls the customer — what did they say?" }, { oc: 1 }, { shot: "Owner: Fix the order", go: true, goShot: "Owner confirms the new total", yes: true, yesShot: "Order updated — the driver delivers it" }], id);
      await queue("Driver's queue: the office's word"); await openStop("STP-0114"); await driver("Driver opens it: the office's banner");
      await pay("STP-0114", "Driver collects", "Delivered and paid");
      await towerCard(id, "Tower: the incident, fixed"); await towerList("Tower: On track");
    } };
  function moneyAtDoor(o) {
    return async function () {
      const st = stopOf(o.stop);
      await o.raise(st);
      const id = await towerShows(titled(st.customerName), "Tower: Deliveries", "Tower: the incident");
      await owner(o.plan, id);
      await queue("Driver's queue: the office's word");
      if (o.finish) await o.finish(st);
      else { await go("/stop-summary/RTE-001/" + o.stop); await driver("Driver: the stop shows what the office decided"); }
      await towerCard(id, "Tower: the incident, fixed"); await towerList("Tower: On track");
    };
  }
  F["price-dispute"] = { title: "Price dispute", run: moneyAtDoor({ stop: "STP-0116",
    raise: async function (st) { await openStop("STP-0116"); await driver("Driver at " + st.customerName); await issue("STP-0116", "price", "Wants last month's rate on cookies", 120, "Driver: Report an Issue — disputes ₹120 of the price"); },
    plan: [{ act: "adjust", shot: "Owner: Review adjustment — approve once", go: true, goShot: "Owner confirms", yes: true, yesShot: "Adjustment approved" }],
    finish: async function () { await openStop("STP-0116"); await driver("Driver opens it: the office approved it"); await pay("STP-0116", "Driver collects", "Delivered and paid"); } }) };
  F["scheme-dispute"] = { title: "Scheme dispute", run: moneyAtDoor({ stop: "STP-0118",
    raise: async function (st) { await openStop("STP-0118"); await driver("Driver at " + st.customerName); await issue("STP-0118", "scheme", "Claims the 10% Diwali scheme on Kaju Barfi", 150, "Driver: Report an Issue — claims ₹150 of scheme"); },
    plan: [{ act: "adjust" }, { pk: ["decision", "refuse"], shot: "Owner: Review adjustment — don't approve", go: true, goShot: "Owner confirms", yes: true, yesShot: "Balance added to Collections" }],
    finish: async function () { await openStop("STP-0118"); await driver("Driver opens it: collect it next visit"); await pay("STP-0118", "Driver collects", "Delivered and paid"); } }) };
  F["quality-complaint"] = { title: "Quality complaint", run: moneyAtDoor({ stop: "STP-0119",
    raise: async function (st) { await pay("STP-0119", null, "Driver delivers " + st.customerName); await issue("STP-0119", "quality", "Chakli packets gone soft", null, "Driver: Report an Issue — quality complaint"); },
    plan: [{ call: true, label: "Owner calls the customer — what did they say?" }, { oc: 1, shot: "Owner: Credit it — a credit note" }, { yes: true, yesShot: "Credit note raised" }] }) };
  F["pod-disputed"] = { title: "Says it never came (POD disputed)", run: async function () {
      const st = stopOf("STP-0120");
      await pay("STP-0120", "Driver collects", "Driver delivers " + st.customerName);
      await issue("STP-0120", "pod", "Says the goods never came", null, "Driver: Report an Issue — says it never came");
      const id = await towerShows(titled(st.customerName), "Tower: Deliveries turns Urgent", "Tower: the incident");
      await owner([{ act: "proof", shot: "Owner: Share proof", go: true, goShot: "Owner confirms", yes: true, yesShot: "Proof sent on WhatsApp" }], id);
      await queue("Driver's queue: the office's word"); await go("/stop-summary/RTE-001/STP-0120"); await driver("Driver: the stop shows the proof went to the shop");
      log.push("waiting for the shop to accept on WhatsApp (the demo's stand-in, ~60 s)");
      await openTower("?lever=deliveries"); await wait(70000);
      await towerCard(id, "Tower: the shop accepted — fixed"); await towerList("Tower: On track");
    } };
  F["no-parking"] = { title: "No parking / loading access", run: askLoop({ raise: async function () {
      const st = stopOf("STP-0106");
      await openStop("STP-0106"); await driver("Driver at " + st.customerName);
      await issue("STP-0106", "parking", "No spot outside; unloaded from the side lane", null, "Driver: Report an Issue — no parking");
      return towerShows(titled(st.customerName), "Tower: Deliveries", "Tower: the incident");
    }, after: async function () { await pay("STP-0106", "Driver collects", "Delivered and paid"); } }) };

  function returnLoop(o) {
    return async function () {
      const rid = o.rid || "RTE-001";
      const st = stopOf(o.stop, rid);
      if (!o.standalone) { await pay(o.stop, null, "Driver delivers " + st.customerName); if (o.evening) await proof(o.stop, rid); }
      else { root.RD.state.routeId = rid; await go("/queue/" + rid); await driver("Driver at " + st.customerName + " — nothing booked, goods to pick up"); }
      await giveBack(o.stop, o.reason, o.detail, ["Driver: Product Return — " + o.reasonLabel], rid);
      const id = await towerShows(titled(st.customerName), "Tower: Deliveries", "Tower: the incident");
      if (o.ask) {
        await owner([{ act: "ask", shot: "Owner: Ask the team", go: true, goShot: "Owner confirms the question", yes: true, yesShot: "Question sent" }], id);
        await answer("Driver's queue: the office asks", "Driver answers — it goes to the office", rid);
        await towerCard(id, "Tower: the driver's answer is on the card");
        await owner([{ act: "close" }], id); await tower("Owner closes it as explained");
      } else {
        await owner(o.plan, id);
        await queue("Driver's queue: the office's word", rid);
        await go("/stop-summary/" + rid + "/" + o.stop); await driver("Driver: the stop shows what the office decided");
      }
      if (o.nextDay) {
        at(DAY2, "09:05"); log.push("next morning");
        await queue("Next morning — the driver's queue", rid);
        await openStop(o.stop, rid); await driver("Driver opens it: the replacement is on today's trip");
        await pay(o.stop, "Driver delivers the replacement", "Delivered");
      }
      if (o.evening) { at(DAY1, "18:10"); log.push("the van settles"); await queue("Evening — the driver settles the van", rid); }
      await towerCard(id, "Tower: the incident, fixed"); await towerList("Tower: On track");
    };
  }
  const CREDIT = [{ act: "creditNote", shot: "Owner: Raise credit note" }, { yes: true, yesShot: "Credit note raised" }];
  const SEND = [{ act: "send", shot: "Owner: Send on next trip", go: true, goShot: "Owner confirms", yes: true, yesShot: "Added to the next trip" }];
  F["damaged-goods"] = { title: "Damaged goods", run: returnLoop({ stop: "STP-0103", reason: "DAMAGED", reasonLabel: "Damaged", plan: CREDIT }) };
  F["leaking"] = { title: "Leaking", run: returnLoop({ stop: "STP-0105", reason: "DAMAGED", detail: "LEAKING", reasonLabel: "Damaged · Leaking", plan: CREDIT }) };
  F["wet-carton"] = { title: "Wet carton", run: returnLoop({ stop: "STP-0107", reason: "DAMAGED", detail: "WET", reasonLabel: "Damaged · Wet carton", plan: CREDIT }) };
  F["broken-pack"] = { title: "Broken pack", run: returnLoop({ stop: "STP-0109", reason: "DAMAGED", detail: "BROKEN", reasonLabel: "Damaged · Broken pack", plan: CREDIT }) };
  F["expired-product"] = { title: "Expired product", run: returnLoop({ stop: "STP-0111", reason: "EXPIRED", reasonLabel: "Expired", plan: CREDIT }) };
  F["wrong-sku"] = { title: "Wrong SKU", run: returnLoop({ stop: "STP-0113", reason: "WRONG_PRODUCT", reasonLabel: "Wrong Product", plan: SEND, nextDay: true }) };
  F["substitute-rejected"] = { title: "Substitute rejected", run: returnLoop({ stop: "STP-0114", reason: "SUBSTITUTE", reasonLabel: "Substitute Rejected", plan: SEND, nextDay: true }) };
  F["wrong-batch"] = { title: "Wrong batch", run: returnLoop({ stop: "STP-0116", reason: "WRONG_BATCH", reasonLabel: "Wrong Batch", ask: true }) };
  F["near-expiry"] = { title: "Near expiry", run: returnLoop({ stop: "STP-0118", reason: "NEAR_EXPIRY", reasonLabel: "Near Expiry", ask: true }) };
  F["saleable-return"] = { title: "Saleable return", run: returnLoop({ stop: "STP-0119", reason: "UNSOLD", reasonLabel: "Unsold",
    plan: [{ act: "takeBack", shot: "Owner: Take it back — into stock", go: true, goShot: "Owner confirms", yes: true, yesShot: "Return recorded — back tonight" }], evening: true }) };
  F["damaged-return"] = { title: "Damaged return (Returns family)", run: returnLoop({ stop: "STP-0218", rid: "RTE-002", standalone: true, reason: "DAMAGED", reasonLabel: "Damaged (pickup, nothing booked)", plan: CREDIT }) };
  F["expiry-return"] = { title: "Expiry return (Returns family)", run: returnLoop({ stop: "STP-0218", rid: "RTE-002", standalone: true, reason: "EXPIRED", reasonLabel: "Expired (pickup, nothing booked)", plan: CREDIT }) };
  F["wrong-product-return"] = { title: "Wrong-product return (Returns family)", run: returnLoop({ stop: "STP-0218", rid: "RTE-002", standalone: true, reason: "WRONG_PRODUCT", reasonLabel: "Wrong Product (pickup, nothing booked)",
    plan: [{ act: "takeBack", shot: "Owner: Take it back", go: true, goShot: "Owner confirms", yes: true, yesShot: "Return recorded — back tonight" }], evening: true }) };
  F["crates"] = { title: "Crates", run: askLoop({ raise: async function () {
      const st = stopOf("STP-0120");
      await pay("STP-0120", "Driver collects", "Delivered and paid");
      await crates("STP-0120", 3, 1, "Driver: Manage Assets — 3 crates left, 1 back");
      return towerShows(titled(st.customerName), "Tower: Deliveries", "Tower: the incident");
    } }) };

  /* Van problems: the van's row, not a stop's. */
  function vanLoop(o) {
    return async function () {
      await problem(o.kind, o.where, "Driver: Report a problem — " + o.label, "Driver's queue: the office is told");
      const id = await towerShows(tagged(o.type), "Tower: Deliveries", "Tower: the van's incident");
      if (o.plan) await owner(o.plan, id);
      if (o.ask) {
        await owner([{ act: "ask", shot: "Owner: Ask the team", go: true, goShot: "Owner confirms the question", yes: true, yesShot: "Question sent" }], id);
        await answer("Driver's queue: the office asks", "Driver answers — it goes to the office");
      } else await queue("Driver's queue: the office's word");
      if (o.moving) await moving(null, "Driver: We're moving again — the office is told");
      /* Closed on the call: the van gets going, and the next drop proves it. */
      if (o.drive) { const cur = root.RD_DB.getStops("RTE-001").filter(function (s) { return s.status === "CURRENT"; })[0];
        await pay(cur.id, "Driver: back on the road — collects at " + cur.customerName, "Delivered and paid"); }
      await towerCard(id, "Tower: the van's incident, fixed"); await towerList("Tower: On track");
    };
  }
  const CALLED = [{ call: true, who: "driver", label: "Owner calls the driver — what did they say?" }, { oc: 0, then: 300 }, { yesShot: null }];
  /* On the call the driver says they'll be moving soon: the owner closes it. */
  const CALLED_OK = [{ call: true, who: "driver", label: "Owner calls the driver — what did they say?" }, { oc: 0, shot: "Moving again soon — closed as explained" }];
  F["breakdown"] = { title: "Breakdown", run: vanLoop({ kind: "breakdown", type: "breakdown", label: "Breakdown", where: "Near Andheri station", plan: CALLED_OK, drive: true }) };
  F["accident"] = { title: "Accident", run: vanLoop({ kind: "accident", type: "accident", label: "Accident", where: "SV Road signal", plan: CALLED_OK, drive: true }) };
  F["fridge"] = { title: "Fridge failed", run: vanLoop({ kind: "fridge", type: "fridge", label: "Fridge not cooling", where: "Lokhandwala", plan: CALLED_OK, drive: true }) };
  F["temperature"] = { title: "Temperature / cold chain", run: vanLoop({ kind: "temperature", type: "temperature", label: "Temperature / cold chain", where: "Versova", plan: CALLED_OK, drive: true }) };
  F["puncture"] = { title: "Puncture", run: vanLoop({ kind: "puncture", type: "puncture", label: "Puncture", where: "JP Road", ask: true, moving: true }) };
  F["traffic-delay"] = { title: "Traffic delay", run: vanLoop({ kind: "traffic", type: "traffic-delay", label: "Traffic jam", where: "Western Express Highway", ask: true, moving: true }) };
  F["road-closure"] = { title: "Road closure", run: vanLoop({ kind: "road", type: "road-closure", label: "Road closed", where: "Link Road, metro works",
    plan: [{ act: "retry", shot: "Owner: Try again today — after the next stop", go: true, goShot: "Owner confirms", yes: true, yesShot: "The van goes back on the route" }], moving: true }) };

  /* Payment at the door. */
  function payLoop(o) {
    return async function () {
      const st = stopOf(o.stop);
      await openStop(o.stop); await driver("Driver at " + st.customerName);
      await cantPay(o.stop, o.kind, "Driver: Report an Issue — " + o.said);
      const id = await towerShows(titled(st.customerName), "Tower: Deliveries", "Tower: the incident");
      await owner(o.plan, id);
      await queue("Driver's queue: the office's word"); await openStop(o.stop); await driver("Driver opens it: the office's banner");
      await pay(o.stop, "Driver " + o.finish, "Delivered", { amount: o.amount, short: o.short });
      await towerCard(id, "Tower: the incident, fixed"); await towerList("Tower: On track");
    };
  }
  const LATER = [{ act: "collectLater", shot: "Owner: Collect later — at the next visit", go: true, goShot: "Owner confirms", yes: true, yesShot: "Added to Collections" }];
  F["cash-unavailable"] = { title: "Cash unavailable", run: payLoop({ stop: "STP-0103", kind: "cash", said: "No cash ready", plan: LATER, finish: "delivers on credit", amount: 0, short: "later" }) };
  F["upi-failed"] = { title: "UPI failed", run: payLoop({ stop: "STP-0105", kind: "upi", said: "UPI not going through", plan: LATER, finish: "takes cash instead" }) };
  F["cheque-dispute"] = { title: "Cheque disputed", run: payLoop({ stop: "STP-0107", kind: "cheque", said: "Cheque problem", plan: [{ call: true, label: "Owner calls the customer — what did they say?" }, { oc: 0, shot: "Owner: Collect later", go: true, goShot: "Owner confirms", yes: true, yesShot: "Added to Collections" }], finish: "collects cash" }) };

  /* Edit Order at the door. */
  F["partial-acceptance"] = { title: "Part accepted (+ invoice mismatch)", run: askLoop({ raise: async function () {
      const st = stopOf("STP-0109");
      await edit("STP-0109", "customer", "Driver: Edit Order — the shop took less");
      await pay("STP-0109", "Driver collects the smaller order", "Delivered and paid");
      return towerShows(titled(st.customerName), "Tower: Deliveries", "Tower: the incident");
    }, after: async function (id) {
      await towerCard(id, "Tower: the bill still says the booked amount");
      await owner([{ act: "fixOrder", shot: "Owner: Fix the order — re-issue the bill", go: true, goShot: "Owner confirms", yes: true, yesShot: "Bill re-issued" }], id);
      await go("/stop-summary/RTE-001/STP-0109"); await driver("Driver: the stop shows the office fixed the bill");
    } }) };
  F["invoice-mismatch"] = { title: "Invoice mismatch", run: async function () {
      const st = stopOf("STP-0111");
      await edit("STP-0111", "customer", "Driver: Edit Order at the door");
      await pay("STP-0111", "Driver collects the changed amount", "Delivered and paid");
      const id = await towerShows(titled(st.customerName), "Tower: Deliveries", "Tower: the incident (bill mismatch + part accepted)");
      /* The card leads with Part accepted: the owner settles that first. */
      await owner([{ act: "ask", shot: "Owner: first, why the shop took less — Ask the team", go: true, yes: true, yesShot: "Question sent" }], id);
      await answer("Driver's queue: the office asks why", "Driver answers — it goes to the office");
      await owner([{ act: "close" }], id); await tower("Owner closes the part-accepted as explained");
      await towerCard(id, "Owner: the bill mismatch is next on the card");
      await owner([{ act: "fixOrder", shot: "Owner: Fix the order — re-issue the bill", go: true, goShot: "Owner confirms", yes: true, yesShot: "Bill re-issued" }], id);
      await go("/stop-summary/RTE-001/STP-0111"); await driver("Driver: the stop shows the office fixed the bill");
      await towerCard(id, "Tower: fixed"); await towerList("Tower: On track");
    } };
  F["short-quantity"] = { title: "Short quantity", run: async function () {
      const st = stopOf("STP-0113");
      await edit("STP-0113", "short", "Driver: Edit Order — not enough on the van");
      await pay("STP-0113", "Driver collects what was delivered", "Delivered and paid");
      const id = await towerShows(titled(st.customerName), "Tower: Deliveries", "Tower: the incident (short + bill)");
      await owner(SEND, id);
      await go("/stop-summary/RTE-001/STP-0113"); await driver("Driver: the stop shows the balance goes tomorrow");
      at(DAY2, "09:05"); log.push("next morning");
      await queue("Next morning — the driver's queue"); await openStop("STP-0113"); await driver("Driver opens it: the balance is on today's trip");
      await pay("STP-0113", "Driver delivers the balance", "Delivered");
      /* The drop was billed for the full order: once the balance is in, the
         card turns to the bill, and the owner re-issues it. */
      await openTower("?lever=deliveries&item=" + encodeURIComponent(id));
      if (td().querySelector('[data-act="fixOrder"]')) {
        log.push("the bill is next");
        await owner([{ act: "fixOrder", shot: "Owner: re-issue the bill for what was delivered", go: true, yes: true, yesShot: "Bill re-issued" }], id);
      }
      await towerCard(id, "Tower: fixed"); await towerList("Tower: On track");
    } };

  /* Load Stock: a van-level check. */
  function loadLoop(o) {
    return async function () {
      await loadCheck(o.check, "Driver: Load Stock — " + o.label);
      await queue("Driver's queue: the office is told");
      const id = await towerShows(tagged(o.type), "Tower: Deliveries", "Tower: the load check");
      if (o.ask) {
        await owner([{ act: "ask", shot: "Owner: Ask the team", go: true, goShot: "Owner confirms the question", yes: true, yesShot: "Question sent" }], id);
        await answer("Driver's queue: the office asks", "Driver answers — it goes to the office");
        await towerCard(id, "Tower: the driver's answer is on the card");
        await owner([{ act: "close" }], id); await tower("Owner closes it as explained");
      } else {
        await owner(o.plan, id);
        await queue("Driver's queue: the office's word");
        at(DAY1, "18:10"); log.push("the van settles");
        await queue("Evening — the driver settles the van");
      }
      await towerCard(id, "Tower: fixed"); await towerList("Tower: On track");
    };
  }
  F["stock-not-loaded"] = { title: "Stock not loaded", run: loadLoop({ type: "stock-not-loaded", label: "Chivda 15 of 30 loaded", check: { set: { 1: 15 } }, ask: true }) };
  F["missing-stock"] = { title: "Missing stock", run: loadLoop({ type: "missing-stock", label: "Namkeen Sev: none on the van", check: { set: { 2: 0 } }, plan: SEND }) };
  F["wrong-loading"] = { title: "Wrong loading", run: loadLoop({ type: "wrong-loading", label: "Chakli 30 loaded, 20 planned", check: { set: { 3: 30 } }, ask: true }) };
  F["wrong-batch-loaded"] = { title: "Wrong batch loaded", run: loadLoop({ type: "wrong-batch-loaded", label: "a batch isn't the one ordered", check: { batch: true }, ask: true }) };
  F["dispatch-doc-missing"] = { title: "Dispatch document missing", run: loadLoop({ type: "dispatch-doc-missing", label: "dispatch papers not ready", check: { noDocs: true }, ask: true }) };

  /* The settlement count. */
  F["excess-quantity"] = { title: "Excess quantity", run: askLoop({ raise: async function () {
      await count({ i: 0, diff: 3, note: "3 extra Mixture on the van" }, "Driver: Stock Count — 3 more than expected");
      return towerShows(tagged("excess-quantity"), "Tower: Deliveries", "Tower: the count");
    } }) };
  F["missing-item"] = { title: "Missing item", run: async function () {
      await count({ i: 4, diff: -4, note: "4 Coconut Cookies packs torn" }, "Driver: Stock Count — 4 fewer than expected");
      const id = await towerShows(tagged("missing-item"), "Tower: Deliveries", "Tower: the count");
      await owner([{ act: "writeOff", shot: "Owner: Write it off", go: true, goShot: "Owner confirms who bears it", yes: true, yesShot: "Written off" }], id);
      await queue("Driver's queue: the office's word");
      await towerCard(id, "Tower: fixed"); await towerList("Tower: On track");
    } };

  /* Proof at the door, missed at settlement. */
  F["pod-missing"] = { title: "POD missing", run: askLoop({ raise: async function () {
      const st = stopOf("STP-0112");
      await pay("STP-0112", "Driver collects — no photo taken", "Delivered and paid");
      at(DAY1, "18:10"); log.push("the route ends");
      await queue("Evening — the route ends");
      return towerShows(titled(st.customerName), "Tower: Deliveries", "Tower: delivered with no proof");
    } }) };

  /* Something else (25 Sep 2026): what fits none of the reports, told in
     the driver's own words with a photo, from Report an Issue (a shop) or
     Report a Problem (the road). The lead is a call to the driver. */
  function snap(line1, line2) {
    const c = document.createElement("canvas"); c.width = 640; c.height = 480;
    const g = c.getContext("2d"), sky = g.createLinearGradient(0, 0, 0, 480);
    sky.addColorStop(0, "#9fb6c9"); sky.addColorStop(1, "#5d6b76"); g.fillStyle = sky; g.fillRect(0, 0, 640, 480);
    g.fillStyle = "#7b8189"; g.fillRect(90, 120, 460, 300);
    g.strokeStyle = "#5f656c"; g.lineWidth = 4;
    for (let y = 140; y < 420; y += 18) { g.beginPath(); g.moveTo(90, y); g.lineTo(550, y); g.stroke(); }
    g.fillStyle = "#c8102e"; g.fillRect(90, 70, 460, 50);
    g.fillStyle = "#fff"; g.font = "bold 28px sans-serif"; g.fillText(line1, 110, 106);
    g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(0, 430, 640, 50);
    g.fillStyle = "#fff"; g.font = "20px sans-serif"; g.fillText(line2, 16, 462);
    return { data: c.toDataURL("image/jpeg", 0.72), w: 640, h: 480 };
  }
  async function tell(o, labels) {
    const from = o.stop ? "/issue/RTE-001/" + o.stop : "/problem/RTE-001";
    await go(from);
    if (o.stop) root.RD.state.scratch.issueNote = o.text; else root.RD.state.scratch.problemWhere = o.text;
    A()[o.stop ? "issue-kind" : "problem-kind"]("other"); await wait(250);
    const S = root.RD.state.scratch;
    S.tellPhotos = (o.photos || []).map(function (p) { return snap(p[0], p[1]); });
    S.tellUrgent = o.urgent ? "now" : "wait";
    await driver(labels[0]);
    A()["tell-confirm"](); await driver(labels[1]);
    A()["tell-send"](o.stop || ""); await wait(1600);
  }
  async function resolveOnCall(id, how, lead) {
    await owner([{ call: true, who: "driver", label: lead || "Owner calls the driver — what did they say?" }, { oc: 0 },
      { type: ["how", how], shot: "Owner: Sorted on the call — Mark Resolved, in their own words", go: true, goShot: "Owner confirms", yes: true, yesShot: "Resolved — it moves to On track" }], id);
  }
  F["something-else"] = { title: "Something else · at a shop, sorted on the call", run: async function () {
      const st = stopOf("STP-0104");
      await openStop("STP-0104"); await driver("Driver at " + st.customerName);
      await tell({ stop: "STP-0104", text: "Owner won't take the goods till he talks to you about the Diwali scheme. Says the salesman promised extra.", photos: [["DIWALI OFFER", "Poster at the counter"]] },
        ["Driver: Report an Issue → Something Else → Tell the Office, with a photo", "Driver confirms — the office calls back"]);
      const id = await towerShows(titled(st.customerName), "Tower: Deliveries — Something else, Pending", "Tower: the report — their words, the photo, Call Rahul");
      await resolveOnCall(id, "Spoke to the owner. He takes today's order as booked; I'll visit Friday about the scheme.");
      await queue("Driver's queue: the office's word");
      await openStop("STP-0104"); await driver("Driver opens it: Resolved, in the owner's words");
      await pay("STP-0104", "Driver collects", "Delivered and paid");
      await towerCard(id, "Tower: resolved"); await towerList("Tower: On track");
    } };
  F["something-urgent"] = { title: "Something else · on the road, Call me now", run: async function () {
      await queue("Driver on the road");
      await tell({ text: "Police stopped the van at the naka, asking for the e-way bill. Need a call.", urgent: true, photos: [["NAKA CHECK", "SV Road checkpost"], ["E-WAY BILL?", "Papers in the cabin"]] },
        ["Driver: Report a Problem → Something Else → Call me now, two photos", "Driver confirms — urgent"]);
      await go("/office/RTE-001"); await driver("Driver: Sent to Office — waiting for the call");
      const id = await towerShows(tagged("something-urgent"), "Tower: Deliveries — Urgent · call, Missed", "Tower: the report — Call Rahul now");
      await owner([{ call: true, who: "driver", label: "Owner calls Rahul — what did they say?" }, { oc: 2, then: 400 }], id);
      await tower("Owner: couldn't reach them — logged, still open");
      await queue("Driver's queue: the office tried to call you");
      await resolveOnCall(id, "E-way bill sent to the officer on WhatsApp. He let the van go — carry on with the route.", "Owner calls again — what did they say?");
      await go("/office/RTE-001"); await driver("Driver: Office — Resolved, in the owner's words");
      const cur = root.RD_DB.getStops("RTE-001").filter(function (s) { return s.status === "CURRENT"; })[0];
      await pay(cur.id, "Driver: back on the road — collects at " + cur.customerName, "Delivered and paid");
      await towerCard(id, "Tower: resolved"); await towerList("Tower: On track");
    } };
  F["something-refiled"] = { title: "Something else · re-filed as Cash unavailable", run: async function () {
      const st = stopOf("STP-0110");
      await openStop("STP-0110"); await driver("Driver at " + st.customerName);
      await tell({ stop: "STP-0110", text: "Shopkeeper says his son has the money and he's at the hospital. Wants the goods anyway." },
        ["Driver: Report an Issue → Something Else, in their own words", "Driver confirms"]);
      const id = await towerShows(titled(st.customerName), "Tower: Deliveries — Something else", "Tower: the report");
      await owner([{ call: true, who: "driver", label: "Owner calls Rahul — what did they say?" }, { oc: 1 }, { pk: ["to", "cash-unavailable"], shot: "Owner: It's one of ours — File it as Cash unavailable", go: true, goShot: "Owner confirms", yes: true, yesShot: "Filed — its own fix is on the card" }], id);
      await towerCard(id, "Tower: now Cash unavailable, with its own buttons");
      await owner(LATER, id);
      await queue("Driver's queue: the office's word"); await openStop("STP-0110"); await driver("Driver opens it: the office's banner");
      await pay("STP-0110", "Driver delivers on credit", "Delivered", { amount: 0, short: "later" });
      await towerCard(id, "Tower: fixed"); await towerList("Tower: On track");
    } };

  async function run(key) {
    const f = F[key]; if (!f) throw new Error("no flow " + key);
    reset();
    steps = []; log = [];
    try { await f.run(); }
    catch (e) { log.push("STOPPED · " + e.message); }
    const f2 = frame(); if (f2 && !root.LOOP.keep) f2.remove();   // LOOP.keep = true: leave it up to look at
    return { key: key, title: f.title, steps: steps, log: log };
  }

  root.LOOP = { setup: setup, run: run, keys: function () { return Object.keys(F); }, _F: F,
    _t: { openTower: openTower, tower: tower, steps: function () { return steps; } } };
})(window);

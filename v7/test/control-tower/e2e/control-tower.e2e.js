/* Control Tower · end to end, in a real browser. The owner's clicks, the
   requirements' §42.3 scenarios, at desktop and phone sizes.

   Needs a running v7 server and Chrome, and puppeteer-core (not a repo
   dependency — install it anywhere and point NODE_PATH at it):

     python3 -m http.server 8007 --directory v7        # or the preview server
     NODE_PATH=/path/to/node_modules node --test v7/test/control-tower/e2e/

   CT_BASE (default http://localhost:8007) and CHROME override the defaults. */

const { test, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const puppeteer = require("puppeteer-core");

const BASE = process.env.CT_BASE || "http://localhost:8007";
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL_CT = BASE + "/screens/control-tower.html";
const DESKTOP = { width: 1440, height: 900 }, PHONE = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

let browser;
before(async () => { browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" }); });
after(async () => { if (browser) await browser.close(); });
/* Every page a test opened is closed after it, pass or fail, so one failure
   cannot leave a busy page behind for the next test to trip over. */
const opened = [];
afterEach(async () => { while (opened.length) { const pg = opened.pop(); try { await pg.close(); } catch (e) { /* already closed */ } } });

async function open(viewport, prep) {
  const p = await browser.newPage();
  opened.push(p);
  await p.setViewport(viewport);
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await p.goto(URL_CT, { waitUntil: "networkidle0" });
  await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  if (prep) await p.evaluate(prep);
  await p.reload({ waitUntil: "networkidle0" });
  await p.waitForSelector(".ct-l-att .ct-sig");
  p.errors = errors;
  return p;
}
const text = (p, sel) => p.$eval(sel, (e) => e.textContent.replace(/\s+/g, " ").trim());
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/* A phone tap on what the owner can see: into view first, clear of the
   fixed bottom bar, then tapped. */
async function tap(p, sel) {
  await p.waitForSelector(sel);
  await p.$eval(sel, (e) => e.scrollIntoView({ block: "center" }));
  await wait(100);
  await p.tap(sel);
  await wait(250);
}
async function click(p, sel) { await p.waitForSelector(sel, { visible: true }); await p.click(sel); await wait(150); }

/* The onboarding's sample import, built in the page exactly as onboarding
   builds it, and left where onboarding leaves it. */
function withSampleLedger() {
  return window.FBContext.ready().then(() => {
    const seed = window.SEED, hist = window.FB_ORDER_HISTORY;
    const nameOf = (c) => (c.name && (c.name.en || c.name)) || c._id;
    const customers = seed.b2b.map((c) => ({ id: c._id, name: nameOf(c) }));
    const products = seed.products.map((p) => ({ id: p.id, name: p.name, sku: p.artNo, unit: p.unit, stockOnHand: p.systemStock }));
    const from = new Date(Date.now() - 240 * 864e5).toISOString().slice(0, 10);
    const orders = [];
    Object.keys(hist).forEach((cid) => (hist[cid].orders || []).forEach((o, i) => {
      if (o.at >= from) orders.push({ id: cid + "-" + i, customerId: cid, customerName: cid, date: o.at, lines: o.lines.map((l) => ({ itemId: l.productId, qty: l.qty, unit: "pcs" })) });
    }));
    const modules = window.FB_SAMPLE.build(seed, orders, new Date().toISOString().slice(0, 10));
    const dr = window.FB_DATASET.fromApp({ app: "sample", org: { id: "sample", name: "Sample Distributors" }, customers, products, orders, modules });
    dr.readAt = new Date().toISOString();
    sessionStorage.setItem("fb.v7.flow", JSON.stringify({ screen: "created", dataReady: dr }));
  });
}

test("desktop · Business Pulse → Needs Attention → AI → Business Now, exception first, freshness honest", async () => {
  const p = await open(DESKTOP);
  const order = await p.$$eval(".ct-layout > *", (els) => els.map((e) => e.className.match(/ct-l-\w+/)[0]));
  assert.deepEqual(order, ["ct-l-att", "ct-l-ai", "ct-l-rail", "ct-l-now", "ct-l-trend"]);
  const sev = await p.$$eval(".ct-l-att .ct-sig", (els) => els.map((e) => e.dataset.sev));
  assert.equal(sev[0], "critical", "the critical signal is first");
  assert.ok(sev.lastIndexOf("opportunity") === sev.length - 1, "opportunities last");
  assert.equal(await p.$$eval(".ct-pulse .ct-metric", (e) => e.length), 6);
  assert.match(await text(p, '[data-m="cash"]'), /Not available/, "no invoices: not ₹0");
  assert.match(await text(p, ".ct-top .ct-fresh"), /Data delayed/);
  assert.equal(await p.$eval("#fbx-foot", (n) => getComputedStyle(n).display), "none", "no footer bar on desktop");
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(p.errors, []);
  await p.close();
});

test("desktop · Scenario 1, stockout: signal → drawer → review → confirm → PR created → signal to monitoring", async () => {
  const p = await open(DESKTOP);
  await click(p, '.ct-sig[data-open="stockout"] [data-open-btn]');
  assert.match(await text(p, ".ct-drawer"), /How this is worked out/);
  assert.match(await text(p, ".ct-drawer"), /Why it ranks here/);
  const box = await p.$eval(".ct-drawer", (d) => { const r = d.getBoundingClientRect(); return { right: r.right, w: r.width }; });
  assert.equal(Math.round(box.right), DESKTOP.width, "a right drawer on desktop — the tower stays in view");
  await click(p, ".ct-drawer [data-review]");
  assert.match(await text(p, ".ct-drawer"), /Needs your confirmation/);
  const n = await p.$$eval(".ct-drawer .ct-line", (l) => l.length);
  assert.ok(n >= 1);
  const suggested = await p.$eval('.ct-drawer input[data-q="l:0"]', (i) => Number(i.value));
  await click(p, '.ct-drawer [data-step="l:0"][data-d="1"]');            // the owner adds one
  await click(p, ".ct-drawer [data-confirm]");
  await p.waitForFunction(() => /Done/.test(document.querySelector(".ct-drawer").textContent));
  assert.match(await text(p, ".ct-drawer"), /PR-0001 raised for/);
  assert.match(await text(p, ".ct-drawer"), /being monitored/);
  await click(p, ".ct-drawer [data-close].ct-btn");
  const row = await p.$('.ct-l-att .ct-sig[data-open="stockout"]');
  assert.equal(await row.evaluate((e) => e.dataset.status), "in_progress");
  assert.match(await row.evaluate((e) => e.textContent), /on order/);
  const pr = await p.evaluate(() => JSON.parse(localStorage.getItem("fb.v7.ct.purchaseRequests")));
  assert.equal(pr[0].no, "PR-0001");
  assert.equal(pr[0].lines[0].qty, suggested + 1, "what was created is the owner's edit, not the suggestion");
  const audit = await p.evaluate(() => JSON.parse(localStorage.getItem("fb.v7.ct.audit")));
  assert.ok(audit.some((a) => a.action === "create_purchase_request" && a.approval === "confirmed by the owner"));
  assert.deepEqual(p.errors, []);
  await p.close();
});

test("desktop · Scenario 3, payment overdue (sample ledger): reminders prepared → approved → queued → audited", async () => {
  const p = await open(DESKTOP, withSampleLedger);
  assert.match(await text(p, '[data-m="cash"]'), /Receivables · sample/);
  await click(p, '.ct-sig[data-open="overdue"] .ct-sig-act');
  assert.match(await text(p, ".ct-drawer"), /No WhatsApp sender is connected/);
  const msgs = await p.$$eval(".ct-drawer textarea[data-body]", (t) => t.length);
  assert.ok(msgs >= 1);
  await click(p, ".ct-drawer [data-confirm]");
  await p.waitForFunction(() => /Done/.test(document.querySelector(".ct-drawer").textContent));
  assert.match(await text(p, ".ct-drawer"), /queued in the outbox/);
  /* A session's own business keeps its own records (store.js, scoped). */
  const out = await p.evaluate(() => JSON.parse(localStorage.getItem("fb.v7.ct.sample:sample.outbox")));
  assert.equal(out.length, msgs);
  assert.ok(out.every((m) => m.status === "queued"));
  await p.close();
});

test("desktop · AI: summary cites the same signals; 'fix it' prepares, the owner confirms, audit says AI-assisted", async () => {
  const p = await open(DESKTOP);
  const listed = await p.$$eval("#ct-ai-body li button", (b) => b.map((x) => x.dataset.openBtn));
  const ranked = await p.$$eval(".ct-l-att .ct-sig", (s) => s.map((x) => x.dataset.open));
  assert.deepEqual(listed, ranked.slice(0, listed.length));
  await p.type("#ct-ask-in", "Fix the stock problem");
  await p.keyboard.press("Enter");
  await p.waitForFunction(() => /I won't do it for you/.test(document.querySelector("#ct-ai-body").textContent));
  assert.equal(await p.evaluate(() => localStorage.getItem("fb.v7.ct.purchaseRequests")), null, "asking did nothing");
  /* The newest proposal: earlier answers scroll up inside the card. */
  const props = await p.$$("#ct-ai-body [data-propose]");
  await props[props.length - 1].evaluate((b) => b.scrollIntoView({ block: "center" }));
  await props[props.length - 1].click();
  await p.waitForSelector(".ct-drawer");
  assert.match(await text(p, ".ct-drawer"), /PREPARED BY FOODBRIDGE AI/);
  await click(p, ".ct-drawer [data-confirm]");
  await p.waitForFunction(() => /Done/.test(document.querySelector(".ct-drawer").textContent));
  const audit = await p.evaluate(() => JSON.parse(localStorage.getItem("fb.v7.ct.audit")));
  const a = audit.find((x) => x.action === "create_purchase_request" && x.ref);
  assert.equal(a.aiAssisted, true);
  assert.equal(a.actor, "owner");
  await p.close();
});

test("desktop · dismiss with a reason → leaves Needs Attention → listed under Dismissed → shown again", async () => {
  const p = await open(DESKTOP);
  await click(p, '.ct-sig[data-open="slow-stock"] [data-open-btn]');
  await click(p, ".ct-drawer [data-dismiss]");
  await click(p, '.ct-drawer input[value="Already handled"]');
  await click(p, ".ct-drawer [data-do]");
  assert.equal(await p.$('.ct-l-att .ct-sig[data-open="slow-stock"]'), null);
  await click(p, '[data-view="home"].is-on [data-tab="alerts"]');
  await click(p, '[data-view="alerts"] [data-alerts="dismissed"]');
  assert.match(await text(p, '[data-view="alerts"]'), /Dismissed: Already handled/);
  await click(p, '[data-restore="slow-stock"]');
  await click(p, '[data-view="alerts"] [data-tab="home"]');
  assert.ok(await p.$('.ct-l-att .ct-sig[data-open="slow-stock"]'));
  await p.close();
});

test("desktop · action failure is visible and changes nothing", async () => {
  const p = await open(DESKTOP);
  await click(p, '.ct-sig[data-open="stockout"] .ct-sig-act');
  await p.evaluate(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === "fb.v7.ct.purchaseRequests") throw new DOMException("full", "QuotaExceededError"); return real.call(this, k, v); };
  });
  await click(p, ".ct-drawer [data-confirm]");
  await p.waitForFunction(() => /Couldn't complete/.test(document.querySelector(".ct-drawer").textContent));
  assert.match(await text(p, ".ct-drawer"), /Nothing was changed\./);
  assert.ok(await p.$(".ct-drawer [data-retry]"));
  assert.equal(await p.evaluate(() => localStorage.getItem("fb.v7.ct.purchaseRequests")), null);
  await p.close();
});

test("desktop · support handover packages the context", async () => {
  const p = await open(DESKTOP);
  await click(p, ".ct-l-rail [data-support]");
  assert.match(await text(p, ".ct-drawer"), /What goes with you/);
  await p.type("#ct-help-note", "Please call after 5");
  await click(p, ".ct-drawer [data-send]");
  await p.waitForFunction(() => /Done/.test(document.querySelector(".ct-drawer").textContent));
  const h = await p.evaluate(() => JSON.parse(localStorage.getItem("fb.v7.ct.support")));
  assert.equal(h[0].no, "HELP-0001");
  assert.equal(h[0].message, "Please call after 5");
  assert.ok(h[0].context.signals.length >= 1 && h[0].context.freshness);
  await p.close();
});

test("phone · mobile-first: bottom nav, full-width stacked cards, no horizontal scroll, sheet with a sticky action", async () => {
  const p = await open(PHONE);
  /* The platform's standard footer: this page's tabs, then EXIT DEMO. */
  const nav = await p.$$eval("#fbx-foot .fbx-tab > span:last-child", (s) => s.map((x) => x.textContent.trim()));
  assert.deepEqual(nav, ["Home", "Insights", "Alerts", "EXIT DEMO"]);
  assert.equal(await p.$eval("#fbx-foot", (f) => f.getBoundingClientRect().height), 58, "the standard 58px bar");
  assert.equal(await p.$eval('#fbx-foot [data-x="0"]', (b) => b.getAttribute("aria-current")), "page");
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await p.$eval(".ct-l-rail", (e) => getComputedStyle(e).display), "none", "the rail lives behind tabs on a phone");
  const w = await p.$eval(".ct-l-att", (e) => e.getBoundingClientRect().width);
  assert.ok(w > 340, "full-width cards");
  await tap(p, '.ct-sig[data-open="reorder-due"]');
  await wait(300);
  const sheet = await p.$eval(".ct-drawer", (d) => { const r = d.getBoundingClientRect(); return { bottom: r.bottom, left: r.left }; });
  assert.equal(Math.round(sheet.bottom), PHONE.height, "a bottom sheet");
  assert.equal(Math.round(sheet.left), 0);
  const foot = await p.$eval(".ct-drawer .ct-df", (f) => f.getBoundingClientRect().bottom);
  assert.ok(foot >= PHONE.height - 1, "the primary action is pinned to the bottom");
  await tap(p, ".ct-drawer [data-review]");
  await wait(200);
  await p.$$eval(".ct-drawer [data-inc]", (b) => b.forEach((x, i) => { if (i > 0 && x.checked) x.click(); }));
  await tap(p, ".ct-drawer [data-confirm]");
  await p.waitForFunction(() => /Done/.test(document.querySelector(".ct-drawer").textContent));
  assert.match(await text(p, ".ct-drawer"), /1 order created: FB-ORD-0001/);
  const orders = await p.evaluate(() => JSON.parse(localStorage.getItem("fb.v7.orders")));
  assert.equal(orders.length, 1);
  assert.equal(orders[0].source, "control-tower");
  assert.deepEqual(p.errors, []);
  await p.close();
});

test("phone · footer tabs: Insights shows Business Now, Alerts lists and audits; creating is in Insights", async () => {
  const p = await open(PHONE);
  await tap(p, '#fbx-foot [data-x="1"]');
  assert.match(await text(p, '[data-view="insights"]'), /orders · 30 days to 24 Aug/);
  await tap(p, '[data-view="insights"] [data-nowtab="delivery"]');
  assert.match(await text(p, '[data-view="insights"]'), /No delivery or route records/);
  await tap(p, '#fbx-foot [data-x="2"]');
  await tap(p, '[data-view="alerts"] [data-alerts="activity"]');
  assert.match(await text(p, '[data-view="alerts"]'), /FoodBridge detected/);
  /* Creating lives in Insights' Quick actions now, not in the bar. */
  await tap(p, '#fbx-foot [data-x="1"]');
  assert.match(await text(p, '[data-view="insights"] .ct-quick'), /Send payment reminders\s*needs invoices/);
  await tap(p, '[data-view="insights"] [data-create="purchase"]');
  assert.match(await text(p, ".ct-drawer"), /New purchase request/);
  await p.close();
});

test("a new order made elsewhere (another tab) is offered, not forced: pill, then refresh", async () => {
  const p = await open(DESKTOP);
  const before = await p.$$eval(".ct-l-att .ct-sig", (s) => s.map((x) => x.dataset.open));
  const q = await browser.newPage();
  opened.push(q);
  await q.goto(URL_CT, { waitUntil: "networkidle0" });
  await q.evaluate(() => {
    const out = window.SEED.products.find((x) => x.systemStock === 0);
    localStorage.setItem("fb.v7.orders", JSON.stringify([{ no: "FB-ORD-0001", customerId: "c01", customer: "ASHOK SWEETS AND NAMKEEN",
      lines: [{ productId: out.id, name: out.name, qty: 5, price: null, unit: "Pc" }], amount: null, items: 5, date: new Date().toISOString(), business: null }]));
  });
  await p.waitForSelector("#ct-pill", { timeout: 5000 });
  assert.deepEqual(await p.$$eval(".ct-l-att .ct-sig", (s) => s.map((x) => x.dataset.open)), before, "nothing moved under the owner");
  await p.bringToFront();                // the owner goes back to the tower's tab
  await p.click("#ct-pill button");
  await wait(200);
  assert.ok(await p.$('.ct-l-att .ct-sig[data-open="order-risk"]'), "the order at risk is there after refresh");
  await q.close(); await p.close();
});

test("platform · Overview › Control Tower and Reports; old links resolve; framed, the shell's navigation wins", async () => {
  const p = await browser.newPage(); opened.push(p);
  await p.setViewport(DESKTOP);
  /* Overview › Control Tower and Reports (the dashboard renamed); the old
     #/dashboard and #/control-tower addresses resolve to the new routes. */
  await p.goto(BASE + "/?z=1#/dashboard", { waitUntil: "networkidle0" });
  await p.waitForFunction(() => location.hash === "#/overview/reports");
  const labels = await p.evaluate(() => [...document.querySelectorAll("a, button")].map((e) => e.textContent.trim()));
  assert.ok(labels.includes("Overview") && labels.includes("Reports") && !labels.includes("Dashboard"));
  const item = await p.waitForSelector("xpath/.//a[normalize-space()='Control Tower'] | .//button[normalize-space()='Control Tower']");
  await item.click();
  await p.waitForFunction(() => location.hash.indexOf("#/overview/control-tower") === 0);
  await p.waitForFunction(() => { const d = document.querySelector("[data-frame]").contentDocument; return d && d.querySelector(".ct-l-att .ct-sig"); }, { timeout: 15000 });
  const info = await p.evaluate(() => {
    const f = document.querySelector("[data-frame]"), d = f.contentDocument;
    return { left: f.getBoundingClientRect().left + parseFloat(getComputedStyle(f).left || 0), cls: d.documentElement.className,
             title: d.querySelector(".ct-title").textContent, tabbar: getComputedStyle(d.getElementById("fbx-foot")).display,
             logo: !!d.querySelector(".ct-brand img"), shellBar: (document.getElementById("fbx-foot") || { hidden: true }).hidden };
  });
  assert.match(info.cls, /ct-framed/);
  assert.match(info.cls, /ct-shell-desktop/);
  assert.equal(info.title, "Control Tower");
  assert.equal(info.tabbar, "none", "the shell's sidebar is the navigation");
  assert.equal(info.logo, false, "the shell brands the page");

  const m = await browser.newPage(); opened.push(m);
  await m.setViewport(PHONE);
  await m.goto(BASE + "/?z=1#/control-tower?signal=stockout", { waitUntil: "networkidle0" });
  await m.waitForFunction(() => location.hash === "#/overview/control-tower?signal=stockout", { timeout: 5000 });
  await m.waitForFunction(() => { const d = document.querySelector("[data-frame]").contentDocument; return d && d.querySelector(".ct-l-att .ct-sig"); }, { timeout: 15000 });
  const mi = await m.evaluate(() => {
    const d = document.querySelector("[data-frame]").contentDocument;
    const shellHead = document.querySelector(".fb-mhead").getBoundingClientRect().bottom;
    const f = document.querySelector("[data-frame]").getBoundingClientRect();
    return { frameTop: f.top, shellHead: shellHead, tabbar: getComputedStyle(d.getElementById("fbx-foot")).display,
             pageHeader: !!d.querySelector(".ct-top"), chip: !!d.querySelector(".ct-main .ct-fresh"),
             shellBar: document.getElementById("fbx-foot").hidden };
  });
  assert.ok(mi.frameTop >= mi.shellHead - 1, "the title row sits below the shell's phone bar, not under it");
  assert.equal(mi.tabbar, "flex", "on a phone the page's standard footer shows");
  assert.equal(mi.pageHeader, false, "the shell's bar is the only header on a phone");
  assert.equal(mi.chip, false, "no freshness chip above the greeting");
  assert.equal(mi.shellBar, true, "…standing in for the shell's EXIT DEMO bar");
  await m.waitForFunction(() => { const d = document.querySelector("[data-frame]").contentDocument; return d.querySelector(".ct-drawer"); }, { timeout: 5000 });
  assert.equal(await m.evaluate(() => document.querySelector("[data-frame]").contentDocument.querySelector(".ct-drawer").getAttribute("aria-label")), "Stock risk",
    "an old notification link still opens its signal");
});

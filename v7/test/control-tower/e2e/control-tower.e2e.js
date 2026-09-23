/* Control Tower · end to end, in a real browser: the five levers
   (context/control-tower/CONTROL_TOWER_LEVERS.md), the owner's taps from
   CONTROL_TOWER_UX_FLOW.md, at phone and desktop sizes.

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
  await p.waitForSelector(".ct-dial, .ct-lvbar");
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

/* No tabs since 22 Sep 2026: the Overview's cards open a lever, Back returns. */
const view = (p) => p.$eval(".ct-main", (m) => m.dataset.lever);
const leverStatus = (p) => p.$eval(".ct-lvword", (w) => w.dataset.s);
async function openLever(p, id) {
  if ((await view(p)) !== "overview") await tap(p, "[data-home]");
  await tap(p, '.ct-dial[data-goto="' + id + '"]');
}

test("phone · Overview first: a dial per lever, and nothing else", async () => {
  const p = await open(PHONE);
  assert.equal(await p.$(".ct-tabs"), null, "no tab strip");
  assert.equal(await view(p), "overview", "the Overview is home");
  assert.equal(await p.$$eval(".ct-dial", (g) => g.length), 5, "one dial per area");
  assert.equal(await p.$$eval(".ct-main > *", (c) => c.length), 1, "no Wins, no balance card");
  assert.ok(await p.$$eval(".ct-dial", (g) => g.every((d) => /Good|Needs work|Urgent|Not connected/.test(d.textContent))), "each says how it is, in a word");
  await tap(p, '.ct-dial[data-goto="purchase"]');
  assert.equal(await view(p), "purchase");
  await tap(p, "[data-home]");
  assert.equal(await view(p), "overview", "Back returns to the five levers");
  await tap(p, '.ct-dial[data-goto="order"]');
  await tap(p, '#fbx-foot [data-ft="tower"]');
  assert.equal(await view(p), "overview", "Tower returns to the five levers");
  assert.deepEqual(await footTabs(p), ["Tower", "Timeline", "Assistant", "EXIT DEMO"], "the work screens belong to Deliveries, the Timeline to home");
  assert.deepEqual(p.errors, []);
});

test("phone · Timeline: the footer's second tab, news newest first, a line opens its lever", async () => {
  const p = await open(PHONE);
  await tap(p, '#fbx-foot [data-ft="updates"]');
  assert.equal(await text(p, ".ct-upbar h2"), "Business Timeline");
  assert.equal(await p.$eval('#fbx-foot [data-ft="updates"]', (b) => b.getAttribute("aria-current")), "page");
  const n = await p.$$eval(".ct-tli", (b) => b.length);
  if (n) {
    const lever = await p.$eval(".ct-tli", (b) => b.dataset.upd);
    await tap(p, ".ct-tli");
    assert.notEqual(await view(p), "updates", "a line opens a lever: " + lever);
  }
  await tap(p, '#fbx-foot [data-ft="tower"]');
  assert.equal(await view(p), "overview", "Tower returns to the five levers");
  assert.equal(await p.$eval('#fbx-foot [data-ft="updates"]', (b) => b.hidden), false, "the Timeline is offered from home");
  assert.deepEqual(p.errors, []);
});

test("phone · the assistant: the footer's Assistant, a WhatsApp-style chat, a menu number answered, a lever opened", async () => {
  const p = await open(PHONE);
  await tap(p, '#fbx-foot [data-ft="assistant"]');
  await p.waitForFunction(() => document.querySelectorAll(".cb-row").length >= 2, { timeout: 8000 });
  assert.match(await text(p, ".cb-head"), /FoodBridge Assistant/);
  await p.type(".cb-input", "3");
  await p.keyboard.press("Enter");
  await p.waitForFunction(() => /Collections ·/.test(document.querySelector(".cb-body").textContent), { timeout: 8000 });
  await tap(p, '.cb-btn[data-btn^="open:collections"]');
  await p.waitForFunction(() => document.querySelector(".cb-chat").hidden, { timeout: 5000 });
  assert.equal(await view(p), "collections", "Open took the owner to the lever");
  assert.deepEqual(p.errors, []);
});

const footTabs = (p) => p.$$eval("#fbx-foot .fbx-tab", (t) => t.filter((b) => !b.hidden).map((b) => b.lastElementChild.textContent.trim()));

test("phone · Deliveries opens in Preview; the platform footer", async () => {
  const p = await open(PHONE);
  await openLever(p, "deliveries");
  assert.equal(await leverStatus(p), "preview");
  assert.match(await text(p, ".ct-main"), /Track all \d+ orders to the door/);
  assert.match(await text(p, ".ct-example"), /Example/);
  assert.equal(await text(p, ".ct-act"), "Record your first delivery");
  /* The four Distribution & Logistics screens are the Deliveries lever's own
     footer actions (23 Sep 2026), off everywhere else. Eight do not fit a
     phone, so the bar scrolls sideways — and the page still does not. */
  const nav = await footTabs(p);
  assert.deepEqual(nav, ["Tower", "Tracking", "Delivery", "Planning", "Assets", "Assistant", "EXIT DEMO"]);
  assert.equal(await p.$eval("#fbx-foot", (f) => f.scrollWidth > f.clientWidth), true, "the bar scrolls rather than clipping");
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no sideways scroll");
  assert.deepEqual(p.errors, []);
});

test("phone · the Deliveries preview records the first delivery; a missed one is Ugly until rescheduled", async () => {
  const p = await open(PHONE);
  await openLever(p, "deliveries");
  await tap(p, ".ct-act");                               // "Record your first delivery"
  await tap(p, ".ct-sheet [data-id]");
  await tap(p, '.ct-sheet [data-st="missed"]');
  assert.equal(await p.$eval(".ct-sheet [data-go]", (b) => b.disabled), true, "a missed delivery needs its reason");
  await tap(p, '.ct-sheet [data-reason="Shop closed"]');
  await tap(p, ".ct-sheet [data-go]");
  assert.equal(await leverStatus(p), "ugly");
  assert.equal(await text(p, ".ct-act"), "Reschedule 1 delivery");
  await tap(p, ".ct-act");
  await tap(p, ".ct-sheet [data-go]");
  assert.match(await text(p, ".ct-main"), /Rescheduled/);
  assert.deepEqual(p.errors, []);
});
test("desktop · Collections on the sample ledger: colours, and a button that says what its sheet holds", async () => {
  const p = await open(DESKTOP, withSampleLedger);
  await openLever(p, "collections");
  assert.match(await text(p, ".ct-head"), /overdue/);
  const labels = await p.$$eval(".ct-clabel", (b) => b.map((x) => x.textContent.trim().split(" ")[0]));
  assert.deepEqual(labels, ["Green", "Yellow", "Orange", "Red", "Fire"]);
  const btn = await text(p, ".ct-act");
  const n = +btn.match(/Send (\d+)/)[1];
  await tap(p, ".ct-act");
  assert.equal(await text(p, ".ct-sheet h2"), "Remind " + n + " customer" + (n === 1 ? "" : "s"));
  await tap(p, ".ct-sheet [data-go]");
  const out = await p.evaluate(() => Object.keys(localStorage).filter((k) => /outbox$/.test(k)).map((k) => JSON.parse(localStorage.getItem(k))).flat());
  assert.equal(out.length, n, "queued in the outbox; nothing reaches a customer");
  assert.deepEqual(p.errors, []);
});

test("desktop · Purchase: raising the purchase orders clears what needed buying", async () => {
  const p = await open(DESKTOP);
  await openLever(p, "purchase");
  assert.match(await text(p, ".ct-act"), /^Raise \d+ purchase orders?$/);
  await tap(p, ".ct-act");
  await tap(p, ".ct-sheet [data-go]");
  assert.equal(await p.$(".ct-act"), null, "nothing left to buy: no action");
  assert.match(await text(p, '.ct-tile[data-k="ugly"]'), /0/);
});

test("platform · framed on desktop, the shell's sidebar navigates; no footer", async () => {
  const p = await browser.newPage(); opened.push(p);
  await p.setViewport(DESKTOP);
  await p.goto(BASE + "/?z=1#/control-tower", { waitUntil: "networkidle0" });
  await p.waitForFunction(() => { const f = document.querySelector("iframe"); const d = f && f.contentDocument; return d && d.querySelector(".ct-dial"); }, { timeout: 15000 });
  const info = await p.evaluate(() => {
    const d = document.querySelector("iframe").contentDocument;
    return { cls: d.documentElement.className, foot: getComputedStyle(d.getElementById("fbx-foot")).display };
  });
  assert.match(info.cls, /ct-framed/);
  assert.match(info.cls, /ct-shell-desktop/);
  assert.equal(info.foot, "none");
});

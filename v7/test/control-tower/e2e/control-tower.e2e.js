/* Control Tower · end to end, in a real browser: the five levers
   (context/control-tower/CONTROL_TOWER_LEVERS.md), the owner's taps from
   CONTROL_TOWER_UX_FLOW.md, and the footer of CONTROL_TOWER_DESIGN.md §4.9
   (Tower · Deliveries · Collections · More), at phone and desktop sizes. With nothing connected the tower runs the live demo
   business, so every lever has something to show.

   Needs a running v7 server and Chrome, and puppeteer-core (not a repo
   dependency — install it anywhere and point NODE_PATH at it):

     python3 -m http.server 8007 --directory v7        # or the preview server
     NODE_PATH=/path/to/node_modules node --test v7/test/control-tower/e2e/control-tower.e2e.js

   (Name the file: `.e2e.js` is not a pattern node --test finds in a folder.)

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

async function open(viewport, prep, query) {
  const p = await browser.newPage();
  opened.push(p);
  await p.setViewport(viewport);
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await p.goto(URL_CT + (query || ""), { waitUntil: "networkidle0" });
  await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  if (prep) await p.evaluate(prep);
  await p.reload({ waitUntil: "networkidle0" });
  await p.waitForSelector(".ct-lcard, .ct-lvbar");
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

/* The Overview's cards open a lever; Back and the footer's Tower return. */
const view = (p) => p.$eval(".ct-main", (m) => m.dataset.lever);
const leverStatus = (p) => p.$eval(".ct-lvword", (w) => w.dataset.s);
async function openLever(p, id) {
  if ((await view(p)) !== "overview") await tap(p, '#ct-foot [data-slot="tower"]').catch(() => tap(p, "[data-home]"));
  await tap(p, '.ct-lcard[data-goto="' + id + '"]');
}
/* The footer as the owner reads it: each slot, and the one they are in. */
const slots = (p) => p.$$eval("#ct-foot .ct-ft", (b) => b.map((x) => x.dataset.slot));
const lit = (p) => p.$eval('#ct-foot [aria-current="page"]', (b) => b.dataset.slot);
async function more(p, row) {
  await tap(p, '#ct-foot [data-slot="more"]');
  await p.waitForSelector(".ct-sheet .ct-mo");
  if (row) await tap(p, row);
}

test("phone · home: a greeting, a card per lever, and the four-slot footer", async () => {
  const p = await open(PHONE);
  assert.equal(await view(p), "overview", "the Overview is home");
  assert.match(await text(p, ".ct-hello"), /^Good (morning|afternoon|evening|night), .+!/);
  assert.match(await text(p, ".ct-hello"), /Here is what needs your attention today/);
  assert.deepEqual((await p.$$eval(".ct-lcard", (c) => c.map((x) => x.dataset.goto))).sort(), ["collections", "deliveries", "inventory", "order", "purchase"]);
  /* §4.9: always four slots, nothing scrolls, the tower draws its own bar
     (the shared EXIT DEMO bar is in More now). */
  assert.deepEqual(await slots(p), ["tower", "deliveries", "collections", "more"], "Tower, the two default levers, More");
  assert.equal(await lit(p), "tower");
  assert.equal(await p.$("#fbx-foot"), null, "no second bar");
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no sideways scroll");
  await tap(p, '.ct-lcard[data-goto="purchase"]');
  assert.equal(await view(p), "purchase");
  await tap(p, "[data-home]");
  assert.equal(await view(p), "overview", "Back returns to the five levers");
  await tap(p, '.ct-lcard[data-goto="order"]');
  await tap(p, '#ct-foot [data-slot="tower"]');
  assert.equal(await view(p), "overview", "Tower returns to the five levers");
  assert.deepEqual(p.errors, []);
});

test("phone · footer: a lever slot opens its lever, dots say where to look, More holds the rest", async () => {
  const p = await open(PHONE);
  /* A dot for a lever that needs the owner, in its colour; More carries the
     worst of the levers inside it. */
  const dots = await p.$$eval("#ct-foot .ct-ft", (b) => b.map((x) => { const d = x.querySelector(".ct-fdot"); return x.dataset.slot + ":" + (d ? d.dataset.s : "-"); }));
  const cards = await p.$$eval(".ct-lcard", (c) => Object.fromEntries(c.map((x) => [x.dataset.goto, x.dataset.s])));
  const want = (s) => (s === "ugly" || s === "bad" ? s : "-");
  assert.equal(dots[1], "deliveries:" + want(cards.deliveries));
  assert.equal(dots[2], "collections:" + want(cards.collections));
  assert.match(await p.$eval('#ct-foot [data-slot="deliveries"]', (b) => b.getAttribute("aria-label")), /^Deliveries/);
  await tap(p, '#ct-foot [data-slot="collections"]');
  assert.equal(await view(p), "collections");
  assert.equal(await lit(p), "collections");
  await tap(p, '#ct-foot [data-slot="collections"]');
  assert.equal(await view(p), "collections", "its slot again keeps the owner on the lever, at the top");
  /* A lever not in the bar is reached through More, which stays lit. */
  await more(p);
  const rows = await p.$$eval(".ct-sheet [data-mo-lever]", (r) => r.map((x) => x.dataset.moLever));
  assert.deepEqual(rows.slice().sort(), ["inventory", "order", "purchase"], "the other three levers");
  assert.deepEqual(await p.$$eval(".ct-sheet [data-mo]", (r) => r.map((x) => x.dataset.mo)), ["timeline", "assistant", "exit"]);
  assert.ok(await p.$$eval(".ct-sheet [data-mo-lever] small", (s) => s.every((x) => /^(Urgent|Needs work|On track)/.test(x.textContent))), "each says where it stands");
  await tap(p, '.ct-sheet [data-mo-lever="purchase"]');
  assert.equal(await view(p), "purchase");
  assert.equal(await p.$(".ct-sheet"), null, "the sheet closes");
  assert.equal(await lit(p), "more");
  assert.deepEqual(p.errors, []);
});

test("phone · a missed delivery: its modal reschedules it in place", async () => {
  const p = await open(PHONE);
  await tap(p, '#ct-foot [data-slot="deliveries"]');
  const count = (k) => p.$eval('.ct-tile[data-k="' + k + '"]', (t) => +t.textContent.replace(/\D+/g, " ").trim().split(" ")[0]);
  const missed = await count("ugly"), pending = await count("bad");
  assert.ok(missed > 0, "the demo has a missed stop");
  await tap(p, '.ct-tile[data-k="ugly"]');
  await tap(p, ".ct-list .ct-row[data-row]");
  await p.waitForSelector(".ct-sheet.is-modal");
  await click(p, ".ct-sheet [data-a=re]");
  await click(p, ".ct-sheet [data-a=rs-go]");
  assert.match(await text(p, ".ct-rs-conf-t"), /^Move to .+ · .+/, "the button asks what will happen, in place");
  await click(p, ".ct-sheet [data-a=rs-yes]");
  await p.waitForFunction((m) => {
    const t = document.querySelector('.ct-tile[data-k="ugly"]');
    return t && +t.textContent.replace(/\D+/g, " ").trim().split(" ")[0] === m - 1;
  }, { timeout: 5000 }, missed);
  await click(p, ".ct-sheet .ct-dm-x");
  assert.equal(await count("bad"), pending + 1, "it waits under Pending for its new day");
  assert.deepEqual(p.errors, []);
});

test("phone · Timeline, from More: news newest first, a line opens its details, and they open its lever", async () => {
  const p = await open(PHONE);
  await more(p, '.ct-sheet [data-mo="timeline"]');
  assert.equal(await text(p, ".ct-upbar h2"), "Business Timeline");
  assert.equal(await lit(p), "more", "the Timeline lives in More");
  assert.ok(await p.$$eval(".ct-tli", (b) => b.length) > 0, "the demo business has news");
  const key = await p.$eval(".ct-tli", (b) => b.dataset.upd);
  await tap(p, ".ct-tli");
  await p.waitForSelector(".ct-sheet");
  assert.equal(await view(p), "updates", "a line opens its details, over the Timeline: " + key);
  const go = await p.$('.ct-sheet [data-a="open"]');
  if (go) {
    const label = await text(p, '.ct-sheet [data-a="open"]');
    await tap(p, '.ct-sheet [data-a="open"]');
    assert.notEqual(await view(p), "updates", label + " opens the lever");
    assert.equal(await p.$(".ct-sheet"), null);
  } else await tap(p, ".ct-sheet [data-close]");
  await tap(p, '#ct-foot [data-slot="tower"]');
  assert.equal(await view(p), "overview", "Tower returns to the five levers");
  assert.deepEqual(p.errors, []);
});

test("phone · the assistant, from More: a WhatsApp-style chat, a menu number answered, a lever opened", async () => {
  const p = await open(PHONE);
  await more(p, '.ct-sheet [data-mo="assistant"]');
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

test("phone · Exit demo, from More: the shared exit flow", async () => {
  const p = await open(PHONE);
  await more(p, '.ct-sheet [data-mo="exit"]');
  assert.equal(await p.$(".ct-sheet"), null, "More closes");
  await p.waitForFunction(() => /Share feedback before you go/.test(document.body.innerText), { timeout: 5000 });
  assert.deepEqual(p.errors, []);
});

test("desktop \u00b7 Collections on the sample ledger: colours, and one customer reminded from their own sheet", async () => {
  const p = await open(DESKTOP, withSampleLedger);
  await openLever(p, "collections");
  assert.match(await text(p, ".ct-head"), /overdue/);
  const labels = await p.$$eval(".ct-clabel", (b) => b.map((x) => x.textContent.trim().split(" ")[0]));
  assert.deepEqual(labels, ["Green", "Yellow", "Orange", "Red", "Fire"]);
  /* The act belongs to the customer the owner opened, not to the page: one
     late or due soon is reminded (one long overdue is offered Stop supply). */
  await click(p, '.ct-tile[data-k="bad"]');
  await click(p, ".ct-list .ct-row[data-row]");
  assert.match(await text(p, ".ct-sheet .ct-stats"), /Overdue/);
  assert.match(await text(p, ".ct-sheet .ct-todo"), /\S/);
  await click(p, '.ct-sheet [data-a="remind"]');
  assert.equal(await text(p, ".ct-sheet h2"), "Remind 1 customer");
  await click(p, ".ct-sheet [data-go]");
  const out = await p.evaluate(() => Object.keys(localStorage).filter((k) => /outbox$/.test(k)).map((k) => JSON.parse(localStorage.getItem(k))).flat());
  assert.equal(out.length, 1, "queued in the outbox; nothing reaches a customer");
  assert.deepEqual(p.errors, []);
});

test("desktop \u00b7 Purchase: a product's own sheet raises its purchase order", async () => {
  const p = await open(DESKTOP);
  await openLever(p, "purchase");
  /* A covered product has nothing to buy; one that is out does. */
  await click(p, '.ct-tile[data-k="ugly"]');
  const before = await text(p, '.ct-tile[data-k="ugly"]');
  await click(p, ".ct-list .ct-row[data-row]");
  assert.match(await text(p, ".ct-sheet .ct-todo"), /\S/);
  await click(p, '.ct-sheet [data-a="po"]');
  assert.match(await text(p, ".ct-sheet h2"), /^Raise \d+ purchase orders?$/);
  await click(p, ".ct-sheet [data-go]");
  assert.match(await text(p, "#ct-toast"), /purchase order/);
  assert.notEqual(await text(p, '.ct-tile[data-k="ugly"]'), before, "the product it covered is off the Urgent list");
});

test("platform · framed on a phone, the tower's four slots are the only bar", async () => {
  const p = await browser.newPage(); opened.push(p);
  await p.setViewport(PHONE);
  await p.goto(BASE + "/?z=1#/overview/control-tower", { waitUntil: "networkidle0" });
  await p.waitForFunction(() => { const f = document.querySelector("iframe"); const d = f && f.contentDocument; return d && d.querySelector("#ct-foot .ct-ft"); }, { timeout: 15000 });
  const info = await p.evaluate(() => {
    const d = document.querySelector("iframe").contentDocument, shell = document.getElementById("fbx-foot");
    return { cls: d.documentElement.className, slots: [...d.querySelectorAll("#ct-foot .ct-ft")].map((b) => b.dataset.slot),
             shellBar: !shell || shell.hidden || getComputedStyle(shell).display === "none" };
  });
  assert.match(info.cls, /ct-framed/);
  assert.deepEqual(info.slots, ["tower", "deliveries", "collections", "more"]);
  assert.equal(info.shellBar, true, "the shell's EXIT DEMO bar stands down (ownExitBar)");
});

test("platform · framed on desktop, the shell's sidebar navigates; no footer, the top bar has Tower · Timeline · Assistant", async () => {
  const p = await browser.newPage(); opened.push(p);
  await p.setViewport(DESKTOP);
  await p.goto(BASE + "/?z=1#/overview/control-tower", { waitUntil: "networkidle0" });
  await p.waitForFunction(() => { const f = document.querySelector("iframe"); const d = f && f.contentDocument; return d && d.querySelector(".ct-lcard"); }, { timeout: 15000 });
  const info = await p.evaluate(() => {
    const d = document.querySelector("iframe").contentDocument;
    return { cls: d.documentElement.className, foot: getComputedStyle(d.getElementById("ct-foot")).display,
             top: [...d.querySelectorAll(".ct-top-nav button")].filter((b) => !b.hidden).map((b) => b.textContent.trim()) };
  });
  assert.match(info.cls, /ct-framed/);
  assert.match(info.cls, /ct-shell-desktop/);
  assert.equal(info.foot, "none");
  assert.deepEqual(info.top, ["Tower", "Timeline", "Assistant"]);
});

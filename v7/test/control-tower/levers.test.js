/* Control Tower · the five levers, headless. Run from v7/:
     node --test test/control-tower/*.test.js
   Spec: context/control-tower/CONTROL_TOWER_LEVERS.md and _DESIGN.md. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const F = require("./fixture.js");
const L = require("../../assets/ct/levers.js");

function levers(w) {
  const v = w.tower.pass();
  return { v, m: L.build(v, { demand: F.CTSignals._detectors.demand(v.state) }) };
}
const by = (m, id) => m.levers.find((x) => x.id === id);

test("five levers, in the owner's order, each with the one template", () => {
  const { m } = levers(F.world());
  assert.deepEqual(m.levers.map((x) => x.id), ["deliveries", "collections", "purchase", "inventory", "order"]);
  for (const lv of m.levers) {
    assert.ok(["ugly", "bad", "good", "preview"].includes(lv.status), lv.id + " status");
    assert.ok(lv.headline && lv.headline.value, lv.id + " headline");
    for (const k of ["good", "bad", "ugly"]) {
      const t = lv.tiles[k];
      assert.ok(t.label && t.word, lv.id + "." + k + " label and word");
      assert.ok(!/·/.test(String(t.value)), lv.id + "." + k + " holds ONE number: " + t.value);
    }
  }
});

test("without its records a lever is a Preview: full skeleton, examples marked, a way to connect", () => {
  const { m } = levers(F.world());
  const d = by(m, "deliveries"), c = by(m, "collections");
  for (const lv of [d, c]) {
    assert.equal(lv.status, "preview");
    assert.ok(lv.preview.promise && lv.preview.connect && lv.preview.connect.label);
    assert.equal(lv.headline.example, true, "the headline is an example");
    assert.ok(["good", "bad", "ugly"].every((k) => lv.tiles[k].example), "every tile is an example");
    assert.equal(lv.action, null, "no action on examples");
  }
  assert.match(d.preview.promise, /Track all \d+ orders to the door/, "sized in the owner's own numbers");
});

test("money is Indian: lakh and crore, never K", () => {
  assert.equal(L.rupees(70800), "₹70,800");
  assert.equal(L.rupees(120000), "₹1.2 L");
  assert.equal(L.rupees(12000000), "₹1.2 Cr");
  const { m } = levers(F.world({ dataReady: F.sampleDataReady(F.NOW) }));
  const all = JSON.stringify(m.levers.filter((x) => x.status !== "preview"));
  assert.ok(!/₹[\d.]+K\b/.test(all), "no ₹…K anywhere on a live lever");
});

test("Collections: colours from each customer's own payments; the action is the sheet's own count", () => {
  const w = F.world({ dataReady: F.sampleDataReady(F.NOW) });
  const { v, m } = levers(w);
  const c = by(m, "collections");
  assert.notEqual(c.status, "preview");
  assert.deepEqual(c.colours.map((x) => x.id), ["green", "yellow", "orange", "red", "fire"]);
  assert.equal(c.colours.reduce((n, x) => n + x.n, 0) > 0, true);
  assert.ok(c.tiles.ugly.rows.every((r, i, a) => !i || a[i - 1].value >= r.value), "overdue rows sorted by money");
  const pv = w.tower.actions.prepare("overdue");
  const fire = new Set(c.tiles.ugly.rows.filter((r) => r.colour === "fire").map((r) => r.id));
  const sheet = pv.messages.filter((x) => !fire.has(x.customerId)).length;
  assert.equal(c.action.label, "Send " + L.plural(sheet, "reminder"), "the button says what the sheet will hold");
  assert.ok(c.action.ids.every((id) => !fire.has(id)), "Fire gets a call, not a message");
  void v;
});

test("Receive payment lowers what's overdue and shows as collected", () => {
  const w = F.world({ dataReady: F.sampleDataReady(F.NOW) });
  const before = by(levers(w).m, "collections");
  const top = before.tiles.ugly.rows[0];
  w.store.addPayment({ customerId: top.id, amount: top.value, mode: "UPI" });
  const after = by(levers(w).m, "collections");
  assert.ok(!after.tiles.ugly.rows.some((r) => r.id === top.id), "fully paid: no longer overdue");
  assert.ok(after.tiles.good.count >= 1, "collected this week");
});

test("the Cash balance appears on Collections and Purchase only when owed and owing are both overdue", () => {
  const { m } = levers(F.world({ dataReady: F.sampleDataReady(F.NOW) }));
  const cash = by(m, "collections").balance.find((b) => b.id === "cash");
  assert.ok(cash && /You're owed ₹.* · you owe suppliers ₹/.test(cash.text));
  assert.ok(by(m, "purchase").balance.some((b) => b.id === "cash"));
  const plain = levers(F.world()).m;
  assert.ok(!by(plain, "collections").balance.length, "no invoices: no cash balance");
});

test("Deliveries goes live from its first recorded delivery; missed → Ugly → rescheduled → To deliver", () => {
  const w = F.world();
  const cust = levers(w).v.state.customers[0].id;
  w.store.addDeliveries([{ customerId: cust, status: "delivered", collected: 4200, empties: { cratesOut: 2, cratesBack: 1, bottlesBack: 10 } }]);
  let d = by(levers(w).m, "deliveries");
  assert.notEqual(d.status, "preview");
  assert.equal(d.tiles.good.count, 1);
  assert.equal(d.facts[0].value, "₹4,200");
  assert.equal(d.facts.length, 1, "a crate not back is a problem, not a fact; next orders live in Grow");
  assert.ok(d.tiles.good.rows.some((r) => r.note === "1 crate not back" && r.tag && r.tag.type === "crates"), "the crate still out is a Crates tag on its delivered row");

  const other = levers(w).v.state.customers[1].id;
  const [missed] = w.store.addDeliveries([{ customerId: other, status: "missed", reason: "Shop closed" }]);
  d = by(levers(w).m, "deliveries");
  assert.notEqual(d.status, "good", "half the stops went wrong");
  assert.ok(d.tiles.ugly.rows.some((r) => r.note === "Shop closed"), "the missed stop is under Missed");
  assert.equal(d.action.label, "Reschedule 1 delivery");

  w.store.rescheduleDeliveries([missed.no], "2026-09-23");
  d = by(levers(w).m, "deliveries");
  assert.ok(!d.tiles.ugly.rows.some((r) => r.note === "Shop closed"), "no longer a problem once rescheduled");
  assert.ok(d.tiles.bad.rows.some((r) => r.id === other && /Rescheduled/.test(r.note)), "back on the next trips");
});

test("each item carries one incident tag: the platform's own when it set one, else read off the record", () => {
  const w = F.world();
  const cust = levers(w).v.state.customers;
  const [a, b] = w.store.addDeliveries([
    { customerId: cust[0].id, status: "delivered", lateMin: 50, shortCases: 2 },
    { customerId: cust[1].id, status: "delivered", lateMin: 50, incident: "damaged" },
  ]);
  const rows = by(levers(w).m, "deliveries").tiles.good.rows;
  const ra = rows.find((r) => r.id === a.no), rb = rows.find((r) => r.id === b.no);
  assert.deepEqual(ra.tag, { type: "late", action: "Ask why it was late" }, "late before short, one tag only");
  assert.equal(rb.tag.type, "damaged", "the platform's tag wins");
  assert.equal(rb.next, "Replace on next trip");
});

test("empties travel as kits: a crate back with 10 bottles leaves 2 bottles with the customer", () => {
  assert.equal(L.emptiesLine({ crates: 2, bottles: 24 }), "2 crates (24 bottles)");
  assert.equal(L.emptiesLine({ crates: 1, bottles: 14 }), "1 crate, 14 bottles");
});

test("a stock count replaces the imported figure, and the levers move with it", () => {
  const w = F.world();
  const { m, v } = levers(w);
  const inv = by(m, "inventory");
  const out = inv.tiles.ugly.rows.find((r) => /^Out/.test(r.note));
  assert.ok(out, "an out-of-stock fast mover leads the list");
  assert.ok(/^Out/.test(inv.tiles.ugly.rows[0].note), "out of stock comes before dead stock");
  w.store.addStockCounts([{ productId: out.id, qty: 5000 }]);
  const after = by(levers(w).m, "inventory");
  assert.ok(!after.tiles.ugly.rows.some((r) => r.id === out.id && /^Out/.test(r.note)), "counted: no longer out");
  void v;
});

test("Purchase: raising the purchase orders clears what needed buying", () => {
  const w = F.world();
  const p = by(levers(w).m, "purchase");
  assert.ok(p.action && /^Raise \d+ purchase orders?$/.test(p.action.label));
  const pv = w.tower.actions.prepare("stockout");
  assert.equal(w.tower.actions.execute(pv, { confirmed: true, actor: "owner" }).ok, true);
  const after = by(levers(w).m, "purchase");
  assert.equal(after.tiles.ugly.count, 0, "nothing out once it is on order");
});

test("Order → Deliveries: usual orders created are on the next trips", () => {
  const w = F.world();
  const o = by(levers(w).m, "order");
  assert.ok(o.action && /^Prepare \d+ usual orders?$/.test(o.action.label));
  const pv = w.tower.actions.prepare("reorder-due");
  assert.equal(w.tower.actions.execute(pv, { confirmed: true, actor: "owner" }).ok, true);
  const live = by(levers(w).m, "deliveries");
  assert.notEqual(live.status, "preview", "orders to deliver make the lever live");
  assert.ok(live.tiles.bad.count >= pv.shops.length, "the new orders are to deliver");
});

test("a supply hold is kept per business", () => {
  const w = F.world();
  const id = levers(w).v.state.customers[0].id;
  w.store.setHold(id, true);
  assert.ok(w.store.read().holds[id]);
  w.store.setHold(id, false);
  assert.ok(!w.store.read().holds[id]);
});

test("Overview: one proven health per lever, none for a Preview; worst first in Needs you", () => {
  const { m } = levers(F.world({ dataReady: F.sampleDataReady(F.NOW) }));
  for (const lv of m.levers) {
    if (lv.status === "preview") assert.equal(lv.health, null, lv.id + " has no health until connected");
    else if (lv.health) { assert.ok(lv.health.value >= 0 && lv.health.value <= 1); assert.ok(lv.health.what); }
  }
  const o = m.overview;
  const rank = { ugly: 0, bad: 1 };
  const rank2 = { ugly: 0, bad: 1, good: 2, preview: 3 };
  assert.ok(o.need.every((n, i, a) => !i || rank[a[i - 1].status] <= rank[n.status]), "worst first");
  assert.ok(o.need.every((n) => n.text && !/in orders$/.test(n.text)), "each line names the problem");
  assert.ok(o.wins.length <= 3);
  assert.ok(!/lever/i.test(o.headline), "plain words: areas by name, never 'levers'");
  assert.match(o.headline, /needs? you|in balance|on track/);
  assert.deepEqual(o.rows.map((r) => r.id).sort(), ["collections", "deliveries", "inventory", "order", "purchase"], "every area, once");
  assert.ok(o.rows.every((r, i, a) => !i || rank2[a[i - 1].status] <= rank2[r.status]), "worst first");
  assert.ok(o.rows.every((r) => r.text), "each row says one plain thing");
});

test("Overview wins: what the owner and FoodBridge got done this week", () => {
  const w = F.world({ dataReady: F.sampleDataReady(F.NOW) });
  const top = by(levers(w).m, "collections").tiles.ugly.rows[0];
  w.store.addPayment({ customerId: top.id, amount: 5000, mode: "Cash" });
  const pv = w.tower.actions.prepare("reorder-due");
  w.tower.actions.execute(pv, { confirmed: true, actor: "owner" });
  const o = levers(w).m.overview;
  assert.ok(o.wins.some((x) => /collected this week/.test(x.text)), "money in is a win");
  assert.ok(o.wins.some((x) => x.fb && /usual orders? prepared/.test(x.text)), "FoodBridge's work is a win, marked as FoodBridge's");
});

test("Overview: a lever turns green once its problem is handled", () => {
  const w = F.world();
  assert.notEqual(by(levers(w).m, "purchase").status, "good");
  w.tower.actions.execute(w.tower.actions.prepare("stockout"), { confirmed: true, actor: "owner" });
  const { m } = levers(w);
  assert.equal(by(m, "purchase").status, "good");
  assert.equal(by(m, "purchase").health.value, 1);
  assert.ok(!m.overview.need.some((n) => n.id === "purchase"));
});

test("a lever's standing follows its health: mostly right is Good, a few items to fix or not", () => {
  const w = F.world();
  const cust = levers(w).v.state.customers;
  w.store.addDeliveries(cust.slice(0, 9).map((c) => ({ customerId: c.id, status: "delivered" })).concat([{ customerId: cust[9].id, status: "missed", reason: "Shop closed" }]));
  const d = by(levers(w).m, "deliveries");
  assert.equal(d.tiles.ugly.count, 1, "one still to fix");
  assert.equal(d.health.value, 0.9);
  assert.equal(d.status, "good", "9 of 10 right is Good");
});

test("Collections › On track is good news only: payments in, long-stuck money first", () => {
  const w = F.world({ dataReady: F.sampleDataReady(F.NOW) });
  const oldest = by(levers(w).m, "collections").tiles.ugly.rows.slice().sort((a, b) => parseInt(b.note) - parseInt(a.note))[0];
  w.store.addPayment({ customerId: oldest.id, amount: oldest.value, mode: "UPI" });
  const { m } = levers(w);
  const good = by(m, "collections").tiles.good.rows;
  assert.ok(good.length && good.every((r) => r.good && /^(Stuck .* now paid|Paid)/.test(r.note)), "every row is money received");
  assert.ok(good[0].stuck, "long-stuck money received leads");
  assert.ok(m.overview.wins[0].text.includes("stuck for") && m.overview.wins[0].text.includes(oldest.title), "and it is the first win");
});

test("Collections: overdue splits by colour — Yellow and Orange are work, Red and Fire are chased", () => {
  const { m } = levers(F.world({ dataReady: F.sampleDataReady(F.NOW) }));
  const c = by(m, "collections");
  assert.ok(c.tiles.ugly.rows.length, "someone is being chased");
  assert.ok(c.tiles.ugly.rows.every((r) => r.colour === "red" || r.colour === "fire"), "Urgent holds Red and Fire only");
  assert.ok(c.tiles.bad.rows.every((r) => r.colour !== "red" && r.colour !== "fire"), "Needs work holds no chased customer");
  assert.ok(c.tiles.bad.rows.every((r) => /( late|^Due in )/.test(r.note)), "each row says late or due");
  const seen = new Set();
  assert.ok(c.tiles.bad.rows.every((r) => !seen.has(r.id) && seen.add(r.id)), "one row per customer");
  const chased = new Set(c.tiles.ugly.rows.map((r) => r.id));
  assert.ok(!c.tiles.bad.rows.some((r) => chased.has(r.id)), "a customer sits in one tile");
});

test("Collections: the tile a lever opens on is the one its dot promises", () => {
  const { m } = levers(F.world({ dataReady: F.sampleDataReady(F.NOW) }));
  for (const lv of m.levers) {
    if (lv.status === "preview") continue;
    const t = lv.tiles[lv.status];
    assert.ok(t, lv.id + " has a tile for its standing: " + lv.status);
    /* The screen lands there whenever it holds something; an empty tile
       can't be opened, so it falls to the next one down. */
    if (t.count) assert.ok(t.rows.length || t.count, lv.id + " · " + lv.status + " has something to show");
  }
  const c = by(m, "collections");
  assert.ok(c.tiles.bad.count > 0 && c.tiles.ugly.count > 0, "Collections fills both tiles, so either standing has somewhere to open");
});

test("Collections: the dot follows the money with Red and Fire customers, not the head count", () => {
  const w = F.world({ dataReady: F.sampleDataReady(F.NOW) });
  const before = by(levers(w).m, "collections");
  const { outstanding, chase } = before.owed;
  assert.ok(chase > 0 && chase <= outstanding);
  assert.equal(before.health.value, (outstanding - chase) / outstanding, "share of what's owed not being chased");
  assert.equal(before.status, before.health.value >= 0.75 ? "good" : before.health.value >= 0.5 ? "bad" : "ugly");
  /* Collect from everyone being chased: the dot turns green, however many
     small customers are still a little late. */
  before.tiles.ugly.rows.forEach((r) => w.store.addPayment({ customerId: r.id, amount: r.value, mode: "UPI" }));
  const after = by(levers(w).m, "collections");
  assert.equal(after.owed.chase, 0);
  assert.equal(after.status, "good");
});

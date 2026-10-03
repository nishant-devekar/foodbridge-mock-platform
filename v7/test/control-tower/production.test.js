/* The Production lever (owner, 3 Oct 2026): the plan's four tabs only, read
   from the same tables the Production board draws, with every production
   incident filed under the tab that acts on it. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../../assets/production/production-api.js");
const P = require("../../assets/production/plan-tables.js");
const C = require("../../assets/ct/production.js");

function tower() {
  const d = A.seed(new Date(), () => {}), D = A.Domain(d, () => new Date(), () => {});
  const api = { read: (fn) => fn(D, d) };
  const alerts = D.alerts().map((a) => {
    const b = a.batch ? D.batch(a.batch) : null, bk = b && b.recipeId ? D.book(b.recipeId) : null;
    return Object.assign({ tab: bk && bk.kind === "semi" ? "sf" : "fg", batchNo: b ? b.batchNumber : null }, a);
  });
  const t = P.build(api);
  return { d, D, t, alerts, lv: C.lever(t, alerts, Date.now()) };
}

test("Production shows the plan's four tabs, and only those", () => {
  const { lv } = tower();
  assert.deepEqual(lv.tabs.map((x) => x.label), ["Orders", "Finished Goods", "Semi Finished Goods", "Purchase"]);
  lv.tabs.forEach((x) => x.rows.forEach((r) => assert.equal(r.tab, x.id, r.title + " sits under its own tab")));
});

test("its figures are the board's: to approve, to order", () => {
  const { t, lv } = tower();
  const tab = (id) => lv.tabs.find((x) => x.id === id);
  const fgOpen = [].concat(...t.fg.map((g) => g.packs)).filter((l) => l.toProduce > 0).length;
  assert.equal(tab("fg").rows.filter((r) => /to produce/.test(r.note)).length, fgOpen);
  assert.equal(tab("sf").rows.filter((r) => /to produce/.test(r.note)).length, t.semi.filter((l) => l.toProduce > 0).length);
  assert.equal(tab("pu").rows.filter((r) => /to order/.test(r.note)).length, t.purchase.filter((l) => l.toOrder > 0).length);
});

test("every production incident is linked to Finished or Semi Finished", () => {
  const { lv, alerts } = tower();
  const filed = lv.tabs.reduce((n, x) => n + x.rows.filter((r) => r.alert).length, 0);
  assert.equal(filed, alerts.filter((a) => ["help", "on_hold", "weight_loss", "waiting", "to_record"].includes(a.type)).length);
  lv.tabs.forEach((x) => x.rows.filter((r) => r.alert).forEach((r) => assert.ok(x.id === "fg" || x.id === "sf")));
});

test("approving a cut for production clears it from Semi Finished", () => {
  const s = tower(), sf = (lv) => lv.tabs.find((x) => x.id === "sf").rows.filter((r) => /to produce/.test(r.note)).length;
  const before = sf(s.lv), l = s.t.semi.find((x) => x.toProduce > 0);
  s.D.createProductionOrder({ recipeId: l.id, batchSize: l.toProduce, actor: "Owner", where: "Production Plan" });
  const after = C.lever(P.build({ read: (fn) => fn(s.D, s.d) }), s.alerts, Date.now());
  assert.equal(sf(after), before - 1);
});

/* The tower's Products: the Finished Goods page's own rules, on its own seed.
   Run from v10/:  node --test test/journey/*.test.js */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const A = require("../../assets/ct/products-area.js");
const SEED = require("../../modules/foodbridge-module-product-management/discovery/versions/v7/seed-data/seed.json").products;

function seed() {
  const d = JSON.parse(JSON.stringify(SEED));
  for (const p of d.products) { if (p.articleNumber === "SB-14") p.costPrice = 24; if (p.articleNumber === "SB-22") p.maxRetailPrice = 79; }   // the page's default scenario
  return d;
}
const build = (fixes) => { const d = seed(); return A.build({ products: d.products, categories: d.categories, demand: d.stockDemand, fixes }); };
const count = (m) => { const c = {}; m.items.forEach((x) => x.issues.forEach((i) => { c[i.kind] = (c[i.kind] || 0) + 1; })); return c; };

test("the same counts as the page: its banner and its Needs Attention chips", () => {
  const m = build();
  const c = count(m);
  assert.equal(m.facts.broken, 6, "banner: 6 products hidden from customers");
  assert.equal(c.noUnit, 6); assert.equal(c.noCategory, 1);
  assert.deepEqual([c.short, c.out, c.belowCost, c.aboveMrp, c.brand, c.noHsn], [7, 5, 1, 1, 10, 46], "chips: short · out · below cost · above MRP · brand · HSN");
});

test("one tag per product, its worst; Urgent can't sell, Needs work costs or breaks an invoice", () => {
  const m = build();
  const tags = (k) => new Set(m.tiles[k].rows.map((r) => r.tag && r.tag.type));
  for (const t of tags("ugly")) assert.ok(["noUnit", "noPrice", "noCategory", "short", "out"].includes(t), "ugly " + t);
  for (const t of tags("bad")) assert.ok(["belowCost", "aboveMrp", "brand", "noHsn"].includes(t), "bad " + t);
  const fruit = m.items.find((x) => x.sku === "SB-14" && x.id.startsWith("sb"));
  assert.equal(fruit.lead.kind, "belowCost");
  assert.match(fruit.lead.detail, /costs ₹24/);
  assert.equal(m.tiles.ugly.rows[0].kind, "jproduct");
});

test("a fix in the tower is an overlay: the product moves on, the seed is untouched", () => {
  const before = build();
  const gs = before.items.find((x) => x.name === "Ginger Snap Cookies");
  assert.equal(gs.lead.kind, "noUnit");
  const after = build({ [gs.id]: { measurement: "Pc-Box" } });
  const gs2 = after.byId[gs.id];
  assert.notEqual(gs2.lead && gs2.lead.kind, "noUnit");
  assert.equal(after.facts.broken, before.facts.broken - 1);
  assert.equal(SEED.products.find((p) => p.id === gs.id).measurement, undefined, "the page's seed is never changed");
});

test("HSN, price and stock fixes clear their own problems", () => {
  const m = build();
  const lemon = m.items.find((x) => x.sku === "SB-22" && x.id.startsWith("sb"));
  assert.ok(lemon.issues.some((i) => i.kind === "aboveMrp"));
  /* One spelling for the whole brand: every product spelled either way. */
  const fixes = { [lemon.id]: { price: 60, hsn: "2202" } };
  for (const x of m.items) if (x.brand.toLowerCase() === "amul") fixes[x.id] = Object.assign(fixes[x.id] || {}, { brand: "Amul" });
  const fixed = build(fixes).byId[lemon.id];
  assert.ok(!fixed.issues.some((i) => ["aboveMrp", "noHsn", "brand"].includes(i.kind)), JSON.stringify(fixed.issues));
});

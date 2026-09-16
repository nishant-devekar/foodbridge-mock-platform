/* The S02 → S03 Dataset, headless. Run from v7/:
     node --test modules/foodbridge-onboarding/test/
   Real files in, the contract out. Nothing here is a stand-in for the reader:
   these are the bytes a user's phone would hand it. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const D = require("../screens/dataset.js");

const fx = (name, type) => {
  const buf = fs.readFileSync(path.join(__dirname, "fixtures", name));
  return new File([buf], name, { type: type || "" });
};
const read = async (name, t) => ({ id: name, name, type: t, ...(await D.readFile(fx(name), t)) });

test("a Zoho sales order export reads as orders, by the import tool's rules", async () => {
  const r = await D.readFile(fx("orders.csv"), "orders");
  assert.equal(r.ok, true);
  assert.equal(r.records.length, 5, "draft, void and the weight line are not orders");
  const skipped = Object.fromEntries(r.skipped.map((s) => [s.reason, s.count]));
  assert.deepEqual(skipped, { not_an_order: 2, sold_by_weight: 1 });
  const lime = r.records.find((x) => x.product === "Lime Pickle 250g");
  assert.equal(lime.qty, 4, "cancelled quantity is subtracted");
  assert.equal(r.records.find((x) => x.customer.includes("Home")).customer, "Home Essential, Store", "quoted commas survive");
});

test("the same file declared as the wrong type fails alone, as no_records", async () => {
  assert.deepEqual(await D.readFile(fx("not-orders.csv"), "orders"), { ok: false, reason: "no_records" });
  assert.deepEqual(await D.readFile(fx("customers.csv"), "invoices"), { ok: false, reason: "no_records" });
});

test("each unreadable file names its own cause", async () => {
  assert.equal((await D.readFile(fx("legacy.xls"), "orders")).reason, "unsupported");
  assert.equal((await D.readFile(fx("locked.xlsx"), "orders")).reason, "protected");
  assert.equal((await D.readFile(fx("empty.csv"), "orders")).reason, "damaged");
  const big = new File([new Uint8Array(1)], "big.csv");
  Object.defineProperty(big, "size", { value: D.MAX_BYTES + 1 });
  assert.equal((await D.readFile(big, "orders")).reason, "too_large");
});

test("an xlsx is read from the sheet that holds the records, with Excel dates", async () => {
  const r = await D.readFile(fx("orders.xlsx"), "orders");
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.records.map((x) => [x.date, x.customer, x.qty]),
    [["2026-08-11", "Ashok Sweets & Co", 5], ["2026-08-10", "New Shop", 2]]);
});

test("a title row, a semicolon and a blank stock cell are all handled", async () => {
  const r = await D.readFile(fx("products-semicolon.csv"), "products");
  assert.equal(r.ok, true);
  assert.deepEqual(r.records.map((p) => p.stockOnHand), [0, undefined, 12], "blank stays absent; 0 stays 0");
});

test("dates are read day-first, and impossible dates are refused", () => {
  assert.equal(D.parseDate("14/08/2026"), "2026-08-14");
  assert.equal(D.parseDate("03/04/2026"), "2026-04-03");
  assert.equal(D.parseDate("31/02/2026"), null);
  assert.equal(D.parseDate("10 Aug 2026"), "2026-08-10");
  assert.equal(D.parseDate(46245), "2026-08-11");
});

test("files combine into ONE dataset; masters win over records derived from orders", async () => {
  const parts = [await read("orders.csv", "orders"), await read("customers.csv", "customers"),
                 await read("products-semicolon.csv", "products"), await read("invoices.csv", "invoices")];
  const ready = D.fromFiles(parts, "2026-09-17T00:00:00Z");
  assert.equal(ready.provenance.label, "Your uploaded files");
  assert.equal(ready.provenance.files.length, 4);
  const { customers, products, orders, invoices } = ready.dataset;
  assert.deepEqual(customers.records.map((c) => [c.name, !!c.derived]),
    [["Ashok Sweets", false], ["New Shop", false], ["Home Essential, Store", true]]);
  const mango = products.records.find((p) => p.name === "Mango Pickle 250g");
  assert.equal(mango.derived, undefined);
  assert.equal(mango.stockOnHand, 0);
  assert.equal(orders.records.length, 3, "SO1 and SO2 share a customer and a day, so they are one order");
  const merged = orders.records.find((o) => o.date === "2026-08-11");
  assert.equal(merged.sources.length, 2, "both source orders are still named");
  assert.equal(merged.lines.find((l) => l.qty === 8 || l.qty === 6 + 2).qty, 8, "Mango 6 + 2 summed");
  assert.ok(ready.notes.skipped.some((s) => s.reason === "merged_same_day" && s.count === 1));
  assert.equal(invoices.records[0].total, 1200.5);
  assert.ok(ready.notes.skipped.some((s) => s.reason === "missing_value"), "the nameless customer row is noted");
});

test("a type nobody provided is ABSENT, not empty", async () => {
  const ready = D.fromFiles([await read("customers.csv", "customers")]);
  assert.deepEqual(ready.dataset.orders, { present: false });
  assert.deepEqual(ready.dataset.invoices, { present: false });
  assert.equal(ready.dataset.customers.present, true);
});

test("a Zoho account with no orders is a real, present, empty result", () => {
  const ready = D.fromZoho({ org: { id: 1, name: "Acme" }, customers: [{ id: 1, name: "A" }], products: [], orders: [] });
  assert.equal(ready.provenance.label, "Your Zoho Books");
  assert.equal(ready.provenance.org.name, "Acme");
  assert.deepEqual(ready.dataset.orders, { present: true, records: [] });
  assert.deepEqual(ready.dataset.invoices, { present: false });
  const eng = D.toEngine(ready.dataset);
  assert.deepEqual(eng.history, {});
});

test("Zoho lines: weights dropped, unknown items kept by name, empty orders dropped", () => {
  const ready = D.fromZoho({
    org: { id: 1, name: "Acme" },
    customers: [{ id: "1", name: "Ashok" }],
    products: [{ id: "7", name: "Pickle", stockOnHand: 3 }],
    orders: [
      { id: "a", customerId: "1", date: "2026-08-01", lines: [{ itemId: "7", qty: 2 }, { itemId: "9", name: "Gone item", qty: 1 }] },
      { id: "b", customerId: "2", customerName: "Walk-in", date: "2026-08-02", lines: [{ itemId: "7", qty: 1, unit: "kg" }] },
    ],
  });
  assert.equal(ready.dataset.orders.records.length, 1);
  assert.equal(ready.dataset.products.records[1].derived, true);
  assert.deepEqual(ready.notes.skipped.map((s) => s.reason).sort(), ["no_usable_lines", "sold_by_weight"]);
});

test("Zoho: non-demand statuses and same-day orders are counted in the notes", () => {
  const ready = D.fromZoho({
    org: { id: 1, name: "Acme" }, customers: [{ id: "1", name: "A" }], products: [{ id: "7", name: "P" }],
    orders: [
      { id: "a", customerId: "1", date: "2026-08-01", lines: [{ itemId: "7", qty: 2 }] },
      { id: "b", customerId: "1", date: "2026-08-01", lines: [{ itemId: "7", qty: 3 }] },
    ],
    orderNotes: { listed: 5, excluded: { draft: 3 }, from: "2026-01-20" },
  });
  assert.equal(ready.dataset.orders.records.length, 1);
  assert.equal(ready.dataset.orders.records[0].lines[0].qty, 5);
  assert.deepEqual(ready.notes.skipped.map((s) => s.reason + "=" + s.count).sort(), ["merged_same_day=1", "not_demand:draft=3"]);
  assert.equal(ready.notes.ordersListed, 5);
});

test("Zoho: statuses, whole records and the other modules reach the Dataset", () => {
  const ready = D.fromZoho({
    org: { id: 1, name: "Acme" },
    customers: [{ id: "1", name: "A", raw: { contact_id: "1", email: "a@x" } }],
    products: [{ id: "7", name: "P", raw: { item_id: "7", purchase_rate: 40 } }],
    orders: [
      { id: "a", customerId: "1", date: "2026-08-01", status: "draft", raw: { salesorder_id: "a" }, lines: [{ itemId: "7", qty: 2, raw: { rate: 50 } }] },
      { id: "b", customerId: "1", date: "2026-08-01", status: "open", raw: { salesorder_id: "b" }, lines: [{ itemId: "7", qty: 1 }] },
    ],
    modules: {
      invoices: { ok: true, records: [{ invoice_id: "i1", customer_id: "1", date: "2026-08-02", total: "120.5", balance: 20, status: "overdue" }] },
      customerpayments: { ok: true, records: [] },
      bills: { ok: false, reason: "forbidden" },
    },
  });
  const d = ready.dataset;
  assert.equal(d.customers.records[0].raw.email, "a@x");
  assert.equal(d.products.records[0].raw.purchase_rate, 40);
  assert.equal(d.orders.records[0].status, "draft");
  assert.deepEqual(d.orders.records[0].statuses, ["draft", "open"]);
  assert.equal(d.orders.records[0].raw.length, 2);
  assert.deepEqual({ ...d.invoices.records[0], raw: undefined, from: undefined },
    { id: "zi1", customerId: "z1", number: undefined, date: "2026-08-02", dueDate: undefined, total: 120.5, balance: 20, status: "overdue", raw: undefined, from: undefined });
  assert.deepEqual(d.payments, { present: true, records: [] }, "read and empty is present-and-empty");
  assert.deepEqual(d.bills, { present: false, unavailable: "forbidden" }, "not shown to this login is absent, with the reason");
  assert.deepEqual(d.estimates, { present: false }, "not read at all is absent");
  assert.ok(ready.notes.skipped.some((n) => n.reason === "module_unavailable:bills:forbidden"));
  const eng = D.toEngine(d);
  assert.equal(eng.presence.invoices, true);
  assert.equal(eng.presence.payments, false);
});

test("S03's count is the Dataset's count: the engine view does not shrink it again", async () => {
  const ready = D.fromFiles([await read("orders.csv", "orders")]);
  const eng = D.toEngine(ready.dataset, "2026-09-17");
  const occasions = Object.values(eng.history).reduce((n, h) => n + h.orders.length, 0);
  assert.equal(occasions, ready.dataset.orders.records.length);
});

test("the engine view merges one day into one occasion, and keeps unknown value unknown", async () => {
  const ready = D.fromFiles([await read("orders.csv", "orders")]);
  const eng = D.toEngine(ready.dataset, "2026-09-17");
  const ashok = ready.dataset.customers.records.find((c) => c.name === "Ashok Sweets").id;
  const h = eng.history[ashok];
  assert.equal(h.orders.length, 2, "SO1 and SO2 share 11 Aug");
  assert.equal(h.orders[0].at, "2026-08-11");
  assert.equal(h.avgCycleDays, 21);
  assert.equal(eng.presence.stockQuantities, false, "no stock column, so no stock position");
  const noValue = D.toEngine(D.fromFiles([await read("orders.xlsx", "orders")]).dataset, "2026-09-17");
  assert.equal(Object.values(noValue.history)[0].orders[0].value, null);
});

test("S03 add-later: payments and cost price files read as their own kinds", async () => {
  const pay = await D.readFile(fx("payments.csv"), "payments");
  assert.deepEqual(pay.records[0], { date: "2026-08-20", customer: "Ashok Sweets", amount: 1000, row: 2 });
  const cost = await D.readFile(fx("costs.csv"), "costs");
  assert.deepEqual(cost.records[0], { name: "Mango Pickle 250g", cost: 42, sku: "MP250", row: 2 });
  assert.equal((await D.readFile(fx("orders.csv"), "payments")).reason, "no_records");
});

test("S03 add-later: evidence is ADDED to the existing data, labelled, and nothing is replaced", async () => {
  const base = D.fromFiles([await read("orders.csv", "orders"), await read("products-semicolon.csv", "products")]);
  const before = JSON.stringify(base);
  const parts = [
    { id: "p1", name: "payments.csv", type: "payments", via: "file", ...(await D.readFile(fx("payments.csv"), "payments")) },
    { id: "c1", name: "IMG_0042.jpg", type: "costs", via: "photo", records: [{ name: "Mango Pickle 250g", cost: 42, row: 1 }, { name: "Unknown", cost: 5, row: 2 }], skipped: [] },
    { id: "i1", name: "invoices.csv", type: "invoices", via: "file", ...(await D.readFile(fx("invoices.csv"), "invoices")) },
  ];
  const after = D.addEvidence(base, parts, "2026-09-17T10:00:00Z");
  assert.equal(JSON.stringify(base), before, "the original DataReady is not mutated");
  assert.equal(after.dataset.orders.records.length, base.dataset.orders.records.length, "orders untouched");
  assert.equal(after.dataset.payments.records.length, 2);
  assert.equal(after.dataset.invoices.records.length, 1);
  const ashok = after.dataset.customers.records.find((c) => c.name === "Ashok Sweets");
  assert.equal(after.dataset.payments.records[0].customerId, ashok.id, "matched to the existing customer by name");
  assert.equal(after.dataset.customers.records.find((c) => c.name === "Brand New Shop").derived, true);
  const mango = after.dataset.products.records.find((p) => p.name === "Mango Pickle 250g");
  assert.equal(mango.cost, 42);
  assert.deepEqual(mango.costFrom, { kind: "photo", fileId: "c1", row: 1 });
  assert.ok(after.notes.skipped.some((n) => n.reason === "cost_for_unknown_product" && n.count === 1), "no product is invented for a cost");
  assert.deepEqual(after.provenance.additions.map((a) => [a.name, a.type, a.via]),
    [["payments.csv", "payments", "file"], ["IMG_0042.jpg", "costs", "photo"], ["invoices.csv", "invoices", "file"]]);
  assert.equal(after.provenance.kind, "files", "the original source stays the source");
  const p = D.toEngine(after.dataset).presence;
  assert.deepEqual([p.invoices, p.payments, p.cost], [true, true, true]);
});

/* ── S02 Upload files: the file says what it holds ─────────────────────── */

test("a file's own columns say what it is; the name is never consulted", async () => {
  const r = await D.readFile(fx("orders.xlsx"), null);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.found.map((f) => [f.type, f.records.length]), [["orders", 2]]);
  const inv = await D.readFile(fx("invoices.csv"), null);
  assert.deepEqual(inv.found.map((f) => [f.type, f.records.length]), [["invoices", 1]]);
  const prod = await D.readFile(fx("products-semicolon.csv"), null);
  assert.deepEqual(prod.found.map((f) => [f.type, f.records.length]), [["products", 3]]);
  const misnamed = new File([fs.readFileSync(path.join(__dirname, "fixtures", "orders.csv"))], "customers.csv");
  assert.deepEqual((await D.readFile(misnamed, null)).found.map((f) => f.type), ["orders"]);
});

test("one workbook can hold several kinds, and every kind is kept", async () => {
  const r = await D.readFile(fx("workbook.xlsx"), null);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.found.map((f) => [f.type, f.records.length]).sort(),
    [["customers", 3], ["orders", 3], ["products", 3]], "the Summary sheet is passed over");
  const parts = r.found.map((f) => ({ id: "wb", name: "workbook.xlsx", ...f }));
  const ready = D.fromFiles(parts, "2026-09-17T00:00:00Z");
  assert.deepEqual(ready.provenance.files, [{ id: "wb", name: "workbook.xlsx", types: ["customers", "products", "orders"] }],
    "listed once, with everything read out of it");
  assert.equal(ready.dataset.customers.records.filter((c) => c.derived).length, 0, "masters came from their own sheets");
  assert.equal(ready.dataset.orders.records.length, 2, "Ashok's two lines on one day are one order");
});

test("a bare Name column is the one thing FoodBridge asks about, narrowed to two", async () => {
  const r = await D.readFile(fx("customers.csv"), null);
  assert.deepEqual(r, { ok: false, reason: "ambiguous", choices: ["products", "customers"] });
  // Told which it is, it reads as before.
  assert.equal((await D.readFile(fx("customers.csv"), "customers")).records.length, 2);
  assert.deepEqual(await D.readFile(fx("not-orders.csv"), null), { ok: false, reason: "no_records" });
  assert.equal((await D.readFile(fx("locked.xlsx"), null)).reason, "protected");
});

test("S03 below the floor: orders and products added later are absorbed by S02's rules", async () => {
  const start = D.fromFiles([await read("customers.csv", "customers")], "2026-09-17T00:00:00Z");
  assert.equal(start.dataset.orders.present, false);
  const o = await D.readFile(fx("orders.csv"), "orders");
  const p = await D.readFile(fx("products-semicolon.csv"), "products");
  const ready = D.addEvidence(start, [
    { id: "o1", name: "orders.csv", type: "orders", records: o.records, skipped: o.skipped },
    { id: "p1", name: "products.csv", type: "products", records: p.records, skipped: p.skipped },
  ], "2026-09-17T01:00:00Z");
  assert.equal(ready.dataset.orders.present, true);
  assert.equal(ready.dataset.orders.records.length, 3, "SO1 and SO2 on one day are one order, as on S02");
  const mango = ready.dataset.products.records.find((x) => x.name === "Mango Pickle 250g");
  assert.equal(mango.derived, undefined, "named in the products file, so not derived");
  assert.equal(mango.stockOnHand, 0);
  assert.equal(ready.dataset.customers.records.find((c) => c.name === "Ashok Sweets").derived, undefined, "S02's customer, not a copy");
  assert.ok(ready.dataset.customers.records.find((c) => c.name.includes("Home")).derived, "a shop only the orders name is derived");
  assert.deepEqual(ready.provenance.additions.map((a) => a.type), ["orders", "products"]);
  // and once more on top: the merge is stable, sources accumulate
  const again = D.addEvidence(ready, [{ id: "o2", name: "orders.csv", type: "orders", records: o.records, skipped: [] }]);
  assert.equal(again.dataset.orders.records.length, 3);
  assert.equal(again.dataset.orders.records.find((x) => x.date === "2026-08-11").sources.length, 4);
  const eng = D.toEngine(again.dataset);
  assert.ok(Object.keys(eng.history).length >= 2, "the engine view sees the added orders");
});

test("a file can carry several tags: each kind is read from it, and a tag that gives nothing is named", async () => {
  // An orders export also names every customer and product on its lines.
  const r = await D.readFile(fx("orders.csv"), ["orders", "customers", "products", "invoices"]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.found.map((f) => f.type), ["orders", "customers", "products"]);
  assert.deepEqual(r.none, ["invoices"], "nothing in it reads as an invoice, and that is said");
  assert.equal(r.found[1].records.length, 8, "one customer row per line; fromFiles makes them distinct");
  const ready = D.fromFiles(r.found.map((f) => ({ id: "o", name: "orders.csv", ...f })));
  assert.equal(ready.dataset.customers.records.length, 2, "the two shops the lines name, once each");
  assert.equal(ready.dataset.customers.records.filter((c) => c.derived).length, 0, "tagged, so read, not derived");
  assert.deepEqual(ready.provenance.files[0].types, ["orders", "customers", "products"]);
  assert.deepEqual(await D.readFile(fx("orders.csv"), ["invoices"]), { ok: false, reason: "no_records", none: ["invoices"] });
  assert.deepEqual(await D.readFile(fx("orders.csv"), []), { ok: false, reason: "no_records" });
});

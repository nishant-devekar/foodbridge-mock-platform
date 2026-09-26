/* Store Builder, headless. Run from v7/:
     node --test store-builder/test/*.test.js
   Writes the sample pack to $SB_OUT (if set) so it can be opened in Excel. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const CAT = require("../catalogue.js");
const M = require("../model.js");
const X = require("../export.js");

/* A Thursday, so tomorrow is Friday. */
const NOW = new Date("2026-09-24T11:00:00+05:30");

function sample() {
  const s = M.blank();
  s.startedAt = NOW.getTime();
  Object.assign(s.store, { name: "Gupta Traders", owner: "Ramesh Gupta", mobile: "+91 98200 11223", gst: "27AAPFG1234K1Z5",
    type: "distributor", makes: false, loc: { lat: 19.0761, lng: 72.8775 }, areas: ["Kurla", "Sion"] });
  s.companies.parle = { buy: 82, sell: 90, seen: true };
  s.companies.hul = { buy: 80, sell: 87, seen: true };
  s.items.par02 = { unit: "case", speed: "fast", stockCases: 12, stockLoose: 30 };
  s.items.par01 = { unit: "case" };
  s.items.hul08 = { unit: "piece", mrp: 40, touched: { mrp: true } };
  const shop = M.addPerson(s, { name: "Sharma Kirana", phone: "09820012345", src: "contact" }).id;
  Object.assign(s.people[shop], { type: "shop", area: "Kurla", days: ["tue", "fri"], pay: 15, big: true, owes: 4200 });
  const shop2 = M.addPerson(s, { name: "Balaji Stores", phone: "9820099999", src: "contact" }).id;
  Object.assign(s.people[shop2], { type: "shop", area: "Sion", days: ["mon"], pay: "cash" });
  const drv = M.addPerson(s, { name: "Raju", phone: "9876543210", src: "contact" }).id;
  Object.assign(s.people[drv], { type: "staff", role: "delivery", days: ["fri"], cash: true });
  const sup = M.addPerson(s, { name: "Parle Super Stockist", phone: "02222223333", src: "typed" }).id;
  Object.assign(s.people[sup], { type: "supplier", companies: ["parle"], owe: 50000 });
  s.usual[shop] = { par02: 2, hul08: 12 };
  s.papers.push({ id: "ph1", kind: "photo", step: "items", at: NOW.getTime(), mime: "image/jpeg" });
  return s;
}

test("catalogue: ids unique; every item has a company, a category, a real photo and a barcode", () => {
  const ids = new Set();
  const cos = new Set(CAT.companies.map((c) => c.id));
  for (const it of CAT.items) {
    assert.ok(!ids.has(it.id), "dup " + it.id);
    ids.add(it.id);
    assert.ok(cos.has(it.company), it.id + " company");
    assert.ok(CAT.categories[it.cat], it.id + " category");
    assert.ok(it.mrp > 0 && it.caseQty > 0, it.id + " numbers");
    assert.match(it.img, /^https:\/\/images\.open(food|beauty|products)facts\.org\/images\/products\/.+\.jpg$/, it.id + " photo");
    assert.match(it.barcode, /^\d{8,14}$/, it.id + " barcode");
  }
  assert.ok(CAT.items.length >= 150);
  assert.ok(CAT.companies.every((c) => CAT.items.some((i) => i.company === c.id)), "every company has items");
});

test("prices come from the per-company rule until the owner changes them", () => {
  const s = sample();
  const pg = M.item(CAT, s, "par02");            // ₹10 MRP, parle rule 82 / 90
  assert.equal(pg.sell, 9);
  assert.equal(pg.buy, 8.2);
  assert.equal(M.unitPrice(pg, "sell"), 9 * 72); // sells by the case of 72
  const lux = M.item(CAT, s, "hul08");           // owner changed MRP to 40
  assert.equal(lux.mrp, 40);
  assert.equal(lux.sell, 34.8);
  assert.equal(M.unitPrice(lux, "sell"), 34.8);
});

test("a scanned barcode finds the catalogue product", () => {
  const s = sample();
  const lux = CAT.items.find((i) => i.id === "hul08");
  assert.equal(M.findBarcode(CAT, s, lux.barcode), "hul08");
  assert.equal(M.findBarcode(CAT, s, "0000000000000"), null);
});

test("phones: Indian formats collapse to 10 digits and duplicates are not added twice", () => {
  assert.equal(M.phone10("+91 98200-11223"), "9820011223");
  assert.equal(M.phone10("09820011223"), "9820011223");
  assert.equal(M.phone10("022 2222 3333"), "02222223333");
  const s = sample();
  const again = M.addPerson(s, { name: "Sharma K", phone: "+919820012345" });
  assert.equal(again.dup, true);
});

test("vCard: folded, quoted-printable Hindi names and several numbers", () => {
  const vcf = [
    "BEGIN:VCARD", "VERSION:2.1", "N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:;=E0=A4=B6=E0=A4=B0=E0=A5=8D=E0=A4=AE=E0=A4=BE;;;",
    "FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=E0=A4=B6=E0=A4=B0=E0=A5=8D=E0=A4=AE=E0=A4=BE", "TEL;HOME:022 2222 3333", "TEL;CELL:+91 98200 12345", "END:VCARD",
    "BEGIN:VCARD", "VERSION:3.0", "FN:Balaji", " Stores", "TEL;TYPE=CELL:9820099999", "END:VCARD",
  ].join("\r\n");
  const out = M.parseVcf(vcf);
  assert.deepEqual(out, [{ name: "शर्मा", phone: "9820012345" }, { name: "BalajiStores", phone: "9820099999" }]);
});

test("routes, first orders and money are worked out from what he said", () => {
  const s = sample();
  const rts = M.routes(s);
  assert.deepEqual(rts.map((r) => r.day + ":" + r.area), ["mon:Sion", "tue:Kurla", "fri:Kurla"]);
  assert.equal(rts.find((r) => r.day === "fri").staff[0].name, "Raju");
  assert.equal(M.tomorrowDay(NOW), "fri");
  const o = M.tomorrowOrders(CAT, s, NOW);
  assert.equal(o.length, 1);
  assert.equal(o[0].shop.name, "Sharma Kirana");
  assert.equal(o[0].total, 2 * 9 * 72 + 12 * 34.8);
  assert.deepEqual(M.money(s), { owedToHim: 4200, heOwes: 50000 });
});

test("first orders skip days with no deliveries (a Saturday meeting lands on Tuesday, not Sunday)", () => {
  const s = sample();
  const shop = s.order[0];
  s.people[shop].days = ["tue"];
  const sat = new Date("2026-09-26T18:00:00+05:30");
  assert.equal(M.tomorrowDay(sat), "sun");
  const f = M.firstDay(CAT, s, sat);
  assert.equal(f.day, "tue");
  assert.equal(f.date.getDate(), 29);
  assert.equal(M.tomorrowOrders(CAT, s, sat).length, 1);
});

test("progress and missing name the gaps without blocking anything", () => {
  const s = sample();
  const p = M.progress(CAT, s);
  assert.equal(p.store.done, true);
  assert.equal(p.items.n, 3);
  assert.equal(p.rules.done, false);
  const keys = M.missing(CAT, s).map((g) => g.key);
  assert.ok(keys.includes("rulesOpen"));
  assert.ok(keys.includes("notCounted"));
  assert.ok(!keys.includes("noDelivery"));
  const empty = M.missing(CAT, M.blank()).map((g) => g.key);
  assert.ok(empty.includes("noName") && empty.includes("noItems") && empty.includes("noShops"));
});

test("migrate: an old or broken save opens as a working state", () => {
  const s = M.migrate({ store: { name: "X" }, people: { a: { id: "a", name: "A" } } });
  assert.equal(s.store.name, "X");
  assert.deepEqual(s.order, ["a"]);
  assert.deepEqual(s.rules.payMethods, []);
  assert.equal(M.migrate(null).v, M.VERSION);
});

test("the pack: a valid zip with the workbook, setup.json and photos, and it reads back", () => {
  const s = sample();
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
  const p = X.pack(CAT, s, { ph1: { bytes: jpeg, mime: "image/jpeg" } }, NOW);
  assert.match(p.name, /^FoodBridge-Setup-Gupta-Traders-2026-09-24\.zip$/);
  const files = X.unzip(p.bytes);
  assert.ok(files["FoodBridge-Setup-Gupta-Traders-2026-09-24.xlsx"]);
  assert.deepEqual([...files["photos/ph1.jpg"]], [...jpeg]);
  const back = X.read(p.bytes);
  assert.equal(back.state.store.name, "Gupta Traders");
  assert.deepEqual([...back.blobs.ph1.bytes], [...jpeg]);

  const t = X.shareText(CAT, s, { ph1: { bytes: jpeg, mime: "image/jpeg" } }, NOW);
  const back2 = X.read(new TextEncoder().encode(t.text));
  assert.equal(back2.state.people[s.order[0]].name, "Sharma Kirana");
  assert.deepEqual([...back2.blobs.ph1.bytes], [...jpeg]);

  if (process.env.SB_OUT) {
    fs.writeFileSync(path.join(process.env.SB_OUT, p.name), p.bytes);
    fs.writeFileSync(path.join(process.env.SB_OUT, "sample.xlsx"), files["FoodBridge-Setup-Gupta-Traders-2026-09-24.xlsx"]);
  }
});

test("sheets: every sheet has a header row and nothing is labelled proven that was only said", () => {
  const sh = X.sheets(CAT, sample(), NOW);
  const names = sh.map((x) => x.name);
  for (const n of ["Store", "Products", "Customers", "Suppliers", "Staff", "Routes", "Usual orders", "First orders", "Opening stock", "Opening balances", "Settings", "To follow up"]) {
    assert.ok(names.includes(n), n);
  }
  const bal = sh.find((x) => x.name === "Opening balances").rows.slice(1);
  assert.equal(bal.length, 2);
  assert.ok(bal.every((r) => r[3] === "Owner said — confirm"));
  const prod = sh.find((x) => x.name === "Products").rows;
  const lux = prod.find((r) => r[0] === "hul08");
  assert.equal(lux[9], "Owner");
  const pg = prod.find((r) => r[0] === "par02");
  assert.equal(pg[9], "Catalogue — check on pack");
  assert.match(pg[17], /^\d{8,14}$/);
  const staff = sh.find((x) => x.name === "Staff").rows[1];
  assert.equal(staff[3], "Delivery");
  const stock = sh.find((x) => x.name === "Opening stock").rows.find((r) => r[0] === "par02");
  assert.equal(stock[5], 12 * 72 + 30);
});

test("words: Hindi and English have exactly the same keys, and every gap has words", () => {
  const I = require("../i18n.js");
  const base = (k) => !/_1$/.test(k);   // English-only singular forms
  const en = Object.keys(I.en).filter(base).sort(), hi = Object.keys(I.hi).filter(base).sort();
  assert.deepEqual(hi.filter((k) => !I.en[k]), []);
  assert.deepEqual(en.filter((k) => !I.hi[k]), []);
  const gaps = M.missing(CAT, M.blank()).map((g) => "gap_" + g.key);
  for (const k of gaps) assert.ok(I.en[k] && I.hi[k], k);
  for (const st of M.STEPS) assert.ok(I.en["title_" + st] && I.hi["q_" + st], st);
});

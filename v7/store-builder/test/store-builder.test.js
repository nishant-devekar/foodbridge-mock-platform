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
  s.items.hul25 = { unit: "piece", mrp: 40, touched: { mrp: true } };
  const shop = M.addPerson(s, { name: "Sharma Kirana", phone: "09820012345", src: "contact" }).id;
  Object.assign(s.people[shop], { type: "shop", area: "Kurla", days: ["tue", "fri"], pay: 15, big: true, owes: 4200 });
  const shop2 = M.addPerson(s, { name: "Balaji Stores", phone: "9820099999", src: "contact" }).id;
  Object.assign(s.people[shop2], { type: "shop", area: "Sion", days: ["mon"], pay: "cash" });
  const drv = M.addPerson(s, { name: "Raju", phone: "9876543210", src: "contact" }).id;
  Object.assign(s.people[drv], { type: "staff", role: "delivery", days: ["fri"], cash: true });
  const sup = M.addPerson(s, { name: "Parle Super Stockist", phone: "02222223333", src: "typed" }).id;
  Object.assign(s.people[sup], { type: "supplier", companies: ["parle"], owe: 50000 });
  s.usual[shop] = { par02: 2, hul25: 12 };
  s.papers.push({ id: "ph1", kind: "photo", step: "items", at: NOW.getTime(), mime: "image/jpeg" });
  return s;
}

test("catalogue: food only; ids unique; packs have a company, a real photo and a barcode; loose goods a picture and a unit", () => {
  const ids = new Set();
  const cos = new Set(CAT.companies.map((c) => c.id));
  const NONFOOD = ["soap", "shampoo", "detergent", "dishwash", "toothpaste", "talc", "skincare", "cleaner", "repellent", "baby", "sanitary", "ohc", "agarbatti", "hairoil", "shaving"];
  for (const it of CAT.items) {
    assert.ok(!ids.has(it.id), "dup " + it.id);
    ids.add(it.id);
    assert.ok(CAT.categories[it.cat], it.id + " category");
    assert.ok(!NONFOOD.includes(it.cat), it.id + " is not food");
    assert.ok(M.aisleOf(CAT, it.cat), it.id + " sits in an aisle");
    if (it.loose) {
      assert.equal(it.company, "", it.id + " loose has no company");
      assert.ok(it.emoji && it.hi, it.id + " picture and Hindi name");
      assert.ok(["kg", "dozen", "tray30", "bunch", "piece", "litre", "pack"].includes(it.per), it.id + " unit");
      continue;
    }
    assert.ok(cos.has(it.company), it.id + " company");
    assert.ok(it.mrp > 0 && it.caseQty > 0, it.id + " numbers");
    assert.match(it.img, /^https:\/\/images\.open(food|beauty|products)facts\.org\/images\/products\/.+\.jpg$/, it.id + " photo");
    assert.match(it.barcode, /^\d{8,14}$/, it.id + " barcode");
  }
  assert.ok(CAT.items.filter((i) => !i.loose).length >= 140);
  for (const a of ["veg", "fruit", "eggs", "meat"]) assert.ok(CAT.items.some((i) => M.aisleOf(CAT, i.cat).id === a), a + " has goods");
  assert.ok(CAT.companies.every((c) => CAT.items.some((i) => i.company === c.id)), "every company has items");
});

test("loose goods: no MRP, the owner's price per unit, and a gap until he gives it", () => {
  const s = M.blank();
  s.items.veg01 = { unit: "case" };
  M.tidy(CAT, s);
  let potato = M.item(CAT, s, "veg01");
  assert.equal(potato.loose, true);
  assert.equal(potato.mrp, null);
  assert.equal(potato.sell, null);
  assert.equal(potato.unit, "piece");
  assert.deepEqual(Object.keys(s.companies), [], "a loose good brings no company");
  assert.ok(M.missing(CAT, s).some((g) => g.key === "noPrice"));
  assert.ok(!M.missing(CAT, s).some((g) => g.key === "noMrp"));
  s.items.veg01.sell = 32;
  potato = M.item(CAT, s, "veg01");
  assert.equal(M.unitPrice(potato, "sell"), 32);
  assert.ok(M.search(CAT, s, "आलू").includes("veg01"), "found by its Hindi name");
  const row = X.sheets(CAT, s, NOW).find((x) => x.name === "Products").rows.find((r) => r[0] === "veg01");
  assert.equal(row[9], "Loose — no MRP");
  assert.equal(row[13], "Per kg");
});

test("tidy: products no longer in the catalogue leave his list", () => {
  const s = M.blank();
  s.items.hul08 = { unit: "case" };   // Lux soap, gone with the non-food goods
  s.items.par02 = { unit: "case" };
  M.tidy(CAT, s);
  assert.deepEqual(Object.keys(s.items), ["par02"]);
  assert.deepEqual(Object.keys(s.companies), ["parle"]);
});

test("prices come from the per-company rule until the owner changes them", () => {
  const s = sample();
  const pg = M.item(CAT, s, "par02");            // ₹10 MRP, parle rule 82 / 90
  assert.equal(pg.sell, 9);
  assert.equal(pg.buy, 8.2);
  assert.equal(M.unitPrice(pg, "sell"), 9 * 72); // sells by the case of 72
  const lux = M.item(CAT, s, "hul25");           // owner changed MRP to 40
  assert.equal(lux.mrp, 40);
  assert.equal(lux.sell, 34.8);
  assert.equal(M.unitPrice(lux, "sell"), 34.8);
});

test("a scanned barcode finds the catalogue product", () => {
  const s = sample();
  const lux = CAT.items.find((i) => i.id === "hul25");
  assert.equal(M.findBarcode(CAT, s, lux.barcode), "hul25");
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

test("routes and money are worked out from what he said", () => {
  const s = sample();
  const rts = M.routes(s);
  assert.deepEqual(rts.map((r) => r.day + ":" + r.area), ["mon:Sion", "tue:Kurla", "fri:Kurla"]);
  assert.equal(rts.find((r) => r.day === "fri").staff[0].name, "Raju");
  assert.deepEqual(M.money(s), { owedToHim: 4200, heOwes: 50000 });
});

test("no Usual orders step: no usual-order sheets or gaps, and an old save with usual orders still opens", () => {
  assert.ok(!M.STEPS.includes("usual"));
  const s = sample();                       // carries s.usual from an old save
  const names = X.sheets(CAT, s, NOW).map((x) => x.name);
  assert.ok(!names.includes("Usual orders") && !names.includes("First orders"));
  assert.ok(!M.missing(CAT, s).some((g) => g.key === "starNoUsual" || g.key === "noStars"));
  assert.equal(M.migrate(JSON.parse(JSON.stringify(s))).usual[s.order[0]].par02, 2);
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
  for (const n of ["Store", "Products", "Customers", "Suppliers", "Staff", "Routes", "Opening stock", "Opening balances", "Settings", "To follow up"]) {
    assert.ok(names.includes(n), n);
  }
  const bal = sh.find((x) => x.name === "Opening balances").rows.slice(1);
  assert.equal(bal.length, 2);
  assert.ok(bal.every((r) => r[3] === "Owner said — confirm"));
  const prod = sh.find((x) => x.name === "Products").rows;
  const lux = prod.find((r) => r[0] === "hul25");
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

test("one Products step: companies follow the products chosen, and a search finds a product by its company", () => {
  assert.deepEqual(M.STEPS, ["store", "items", "people", "stock", "rules", "finish"]);
  const s = M.blank();
  s.items.hul25 = { unit: "case" };
  s.items.par02 = { unit: "case" };
  M.syncCompanies(CAT, s);
  assert.deepEqual(Object.keys(s.companies).sort(), ["hul", "parle"]);
  assert.deepEqual(s.companies.hul, { buy: M.DEFAULT_RULE.buy, sell: M.DEFAULT_RULE.sell });
  s.companies.parle = { buy: 82, sell: 90, seen: true };   // a rate he gave on the old Your rates step is kept
  delete s.items.hul25;
  M.syncCompanies(CAT, s);
  assert.deepEqual(Object.keys(s.companies), ["parle"]);
  assert.equal(s.companies.parle.buy, 82);

  const hul = M.search(CAT, s, "hul", null);
  assert.ok(hul.length && hul.every((id) => CAT.items.find((x) => x.id === id).company === "hul"));

  const prod = X.sheets(CAT, s, NOW).find((x) => x.name === "Products").rows;
  assert.equal(prod.find((r) => r[0] === "par02")[12], "Worked out");
  s.items.hul25 = { unit: "case" };
  M.syncCompanies(CAT, s);
  const prod2 = X.sheets(CAT, s, NOW).find((x) => x.name === "Products").rows;
  assert.equal(prod2.find((r) => r[0] === "hul25")[12], "Standard margin — confirm");
});

test("one Contacts step: a guess from the name, remove a contact, and gaps that open the right tab", () => {
  assert.equal(M.guessType("Gupta Kirana"), "shop");
  assert.equal(M.guessType("Balaji General Stores"), "shop");
  assert.equal(M.guessType("Sai Agency"), "supplier");
  assert.equal(M.guessType("Raju Driver"), "staff");
  assert.equal(M.guessType("Ramesh"), null);

  const s = sample();
  const shop = s.order[0];
  M.removePerson(s, shop);
  assert.ok(!s.people[shop] && !s.order.includes(shop) && !s.usual[shop]);

  const p = M.progress(CAT, s).people;
  assert.equal(p.shops, 1);
  assert.equal(p.staff, 1);
  assert.equal(p.suppliers, 1);
  const c = M.addPerson(s, { name: "New Kirana", phone: "9811111111", type: "shop" }).id;
  assert.equal(s.people[c].type, "shop");
  const gap = M.missing(CAT, s).find((g) => g.key === "shopNoDay");
  assert.equal(gap.step, "people");
  assert.equal(gap.tab, "shop");
});

test("use my location: the OpenStreetMap address, short, the way a bill writes it", () => {
  /* What Nominatim answered for a point in Kurla West, 26 Sep 2026. */
  const kurla = { neighbourhood: "Netaji Nagar", suburb: "Kurla West", city_district: "Mumbai Zone 5", city: "Mumbai",
    state_district: "Mumbai Suburban District", state: "Maharashtra", postcode: "400070", country: "India", country_code: "in" };
  assert.equal(M.shortAddress(kurla), "Netaji Nagar, Kurla West, Mumbai, Maharashtra 400070");
  assert.equal(M.shortAddress({ house_number: "12", road: "LBS Marg", suburb: "Kurla", city: "Kurla", state: "Maharashtra" }),
    "12 LBS Marg, Kurla, Maharashtra");
  assert.equal(M.shortAddress({ village: "Rampur", state: "Uttar Pradesh", postcode: "244901" }), "Rampur, Uttar Pradesh 244901");
  assert.equal(M.shortAddress(null), "");
});

test("godowns: one or more, and a save from before 26 Sep keeps its godown", () => {
  const same = M.migrate({ store: { godownSame: true, godownAddress: "" } }).store;
  assert.equal(same.godownAtShop, true);
  assert.deepEqual(same.godowns, []);
  assert.ok(!("godownSame" in same) && !("godownAddress" in same));
  const other = M.migrate({ store: { godownSame: false, godownAddress: "Plot 9, MIDC Bhosari" } }).store;
  assert.equal(other.godownAtShop, false);
  assert.deepEqual(other.godowns, ["Plot 9, MIDC Bhosari"]);
  assert.deepEqual(M.blank().store.godowns, []);

  const s = sample();
  s.store.godownAtShop = true;
  s.store.godowns = ["Plot 9, MIDC Bhosari", "  ", "Gala 3, Wagholi"];
  const rows = X.sheets(CAT, s, NOW).find((sh) => sh.name === "Store").rows.filter((r) => /^Godown/.test(r[0]));
  assert.deepEqual(rows.map((r) => r[0] + ": " + r[1]), ["Godown 1: At the shop", "Godown 2: Plot 9, MIDC Bhosari", "Godown 3: Gala 3, Wagholi"]);
});

test("godown stock: counts save as he taps, one number in one unit, into the opening stock", () => {
  const s = sample();                       // par02: 12 boxes of 72 + 30 loose
  s.items.veg01 = { unit: "piece" };
  s.items.hul25.stockLoose = undefined;
  assert.deepEqual(M.stockSel(CAT, s), ["par02"]);   // the count starts from what was already counted
  assert.deepEqual(M.countOf(M.item(CAT, s, "par02")), { qty: 12 * 72 + 30, unit: "piece" });

  const par01 = M.item(CAT, s, "par01"), veg = M.item(CAT, s, "veg01"), hul = M.item(CAT, s, "hul25");
  assert.deepEqual(M.countUnits(par01).map((u) => u.k), ["piece", "case"]);
  assert.equal(M.lineUnit(s, par01), "case");
  assert.deepEqual(M.countUnits(veg), [{ k: "kg", per: 1 }]);
  assert.equal(M.countOf(par01), null);   // blank: not counted

  M.setCount(s, par01, 5, "case");
  M.setCount(s, M.item(CAT, s, "veg01"), 0, "kg");   // looked, none there: counted
  M.setCount(s, hul, null, "piece");
  M.setCount(s, M.item(CAT, s, "par02"), null, "piece");
  assert.equal(M.item(CAT, s, "par01").stockCases, 5);
  assert.deepEqual(M.countOf(M.item(CAT, s, "par01")), { qty: 5, unit: "case" });
  assert.equal(M.item(CAT, s, "veg01").stockLoose, 0);
  assert.equal(M.countOf(M.item(CAT, s, "hul25")), null);

  /* A new unit keeps the number and re-reads it. */
  M.setCount(s, M.item(CAT, s, "par01"), 5, "piece");
  assert.deepEqual(M.countOf(M.item(CAT, s, "par01")), { qty: 5, unit: "piece" });
  M.setCount(s, M.item(CAT, s, "par01"), 5, "case");

  const stock = X.sheets(CAT, s, NOW).find((sh) => sh.name === "Opening stock").rows;
  assert.equal(stock.find((r) => r[0] === "par01")[5], 5 * M.item(CAT, s, "par01").caseQty);
  assert.equal(stock.find((r) => r[0] === "veg01")[7], "Counted");
  assert.equal(M.progress(CAT, s).stock.n, 2);

  s.stockSel = ["par01", "gone", "par01"];   // a product dropped on the Products step leaves the count
  assert.deepEqual(M.stockSel(CAT, s), ["par01"]);
  const old = M.migrate(Object.assign({}, s, { stockDraft: { sel: [] }, stockSel: "x" }));
  assert.ok(!("stockDraft" in old));
  assert.equal(old.stockSel, null);
});

test("build my store: the files FoodBridge receives, one by one, and the line its team sees", () => {
  const s = sample();
  s.papers = [{ id: "ph1", kind: "photo", step: "store", at: NOW.getTime(), mime: "image/jpeg" }];
  const parts = X.parts(CAT, s, { ph1: { bytes: new Uint8Array([255, 216, 255]), mime: "image/jpeg" } }, NOW);
  assert.deepEqual(parts.map((p) => p.name), ["FoodBridge-Setup-Gupta-Traders-2026-09-24.xlsx", "setup.json", "photos/ph1.jpg"]);
  assert.ok(parts[0].bytes.length > 1000, "the Excel");
  assert.equal(JSON.parse(new TextDecoder().decode(parts[1].bytes)).state.store.name, "Gupta Traders");
  const m = X.summary(CAT, s, NOW, parts.map((p) => p.name));
  assert.equal(m.shop, "Gupta Traders");
  assert.equal(m.counts.products, Object.keys(s.items).length);
  assert.equal(m.counts.photos, 1);
  assert.equal(m.files.length, 3);
  assert.equal(X.b64(new Uint8Array([104, 105])), "aGk=");
});

test("fresh produce has real photos, and the file credits each one it uses", () => {
  const loose = CAT.items.filter((i) => i.loose);
  assert.ok(loose.length > 0 && loose.every((i) => /^https:\/\/upload\.wikimedia\.org\//.test(i.img)));
  assert.ok(CAT.freshCredits.every((c) => c.licence && !/^GFDL/.test(c.licence) && /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(c.page)));
  const s = sample();
  s.items.veg01 = { sell: 30 };
  const credits = X.sheets(CAT, s, NOW).find((sh) => sh.name === "Photo credits");
  assert.ok(credits && credits.rows.some((r) => r[0] === "veg01" && r[3] === "Public domain"));
});

/* Store Builder desktop: contacts from a file, headless. Run from v7/:
     node --test store-builder/test/*.test.js */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const X = require("../export.js");
const I = require("../import.js");

test("vCard: names, the mobile of several numbers, Android's quoted-printable Hindi", function () {
  const vcf = [
    "BEGIN:VCARD", "VERSION:3.0", "FN:Sharma Kirana", "TEL;TYPE=WORK:022 2555 1234", "TEL;TYPE=CELL:+91 98200 12345", "END:VCARD",
    "BEGIN:VCARD", "VERSION:2.1", "N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:;=E0=A4=B0=E0=A4=BE=E0=A4=9C=E0=A5=82;;;", "TEL;CELL:09876543210", "END:VCARD",
    "BEGIN:VCARD", "VERSION:3.0", "N:Traders;Balaji;;;", "item1.TEL:98190 22031", "END:VCARD",
    "BEGIN:VCARD", "FN:Long", "  Name Folded", "END:VCARD",
  ].join("\r\n");
  assert.deepEqual(I.parseVcf(vcf), [
    { name: "Sharma Kirana", phone: "9820012345" },
    { name: "राजू", phone: "9876543210" },
    { name: "Balaji Traders", phone: "9819022031" },
    { name: "Long Name Folded", phone: "" },
  ]);
});

test("CSV: Google Contacts export, numbers in one cell, first + last name", function () {
  const csv = "First Name,Last Name,Organization Name,Phone 1 - Label,Phone 1 - Value\n" +
    "Raju,Driver,,Mobile,+91 98190 22031 ::: 022 2555 0000\n" +
    ",,Metro Agencies,Work,98330 10988\n" +
    '"Gupta, Om",,,Mobile,"98201 44120"\n';
  assert.deepEqual(I.fromTable(I.parseCsv(csv)), [
    { name: "Raju Driver", phone: "9819022031" },
    { name: "Metro Agencies", phone: "9833010988" },
    { name: "Gupta, Om", phone: "9820144120" },
  ]);
});

test("CSV: a list with no header we know is read by what its cells hold", function () {
  const csv = "Party;Cell no.\nSharma Kirana;9820012345\nBalaji Stores;9820099999\n";
  assert.deepEqual(I.fromTable(I.parseCsv(csv)), [
    { name: "Sharma Kirana", phone: "9820012345" },
    { name: "Balaji Stores", phone: "9820099999" },
  ]);
  const odd = "Party,Contact\nSharma Kirana,9820012345\n";
  assert.deepEqual(I.fromTable(I.parseCsv(odd)), [{ name: "Sharma Kirana", phone: "9820012345" }]);
  const bare = "Sharma Kirana,9820012345\nBalaji Stores,9820099999\n";
  assert.equal(I.fromTable(I.parseCsv(bare)).length, 2);
});

/* A zip whose entries are deflated, as Excel writes them. */
function deflatedZip(files) {
  const parts = [], central = [];
  let off = 0;
  Object.keys(files).forEach(function (name) {
    const raw = Buffer.from(files[name]), data = zlib.deflateRawSync(raw), nm = Buffer.from(name);
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(8, 8);
    loc.writeUInt32LE(zlib.crc32 ? zlib.crc32(raw) : 0, 14); loc.writeUInt32LE(data.length, 18); loc.writeUInt32LE(raw.length, 22); loc.writeUInt16LE(nm.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(8, 10);
    cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(raw.length, 24); cen.writeUInt16LE(nm.length, 28); cen.writeUInt32LE(off, 42);
    parts.push(loc, nm, data);
    central.push(cen, nm);
    off += 30 + nm.length + data.length;
  });
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat(parts.concat([cd, end])));
}

test("Excel: a customer list, stored or deflated, shared strings and numbers", async function () {
  const stored = X.xlsx([{ name: "Customers", rows: [["Customer Name", "Area", "Mobile No"], ["Sharma Kirana", "Kurla", 9820012345], ["Om Sai Provision", "Kurla", "98200 11003"]] }]);
  const r1 = await I.readFile("customers.xlsx", stored);
  assert.equal(r1.kind, "xlsx");
  assert.deepEqual(r1.people, [{ name: "Sharma Kirana", phone: "9820012345" }, { name: "Om Sai Provision", phone: "9820011003" }]);

  const deflated = deflatedZip({
    "xl/sharedStrings.xml": '<sst><si><t>Name</t></si><si><t>Phone</t></si><si><t>Patel &amp; Sons</t></si></sst>',
    "xl/worksheets/sheet1.xml": '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>9.820011005E9</v></c></row></sheetData></worksheet>',
  });
  const r2 = await I.readFile("list.XLSX", deflated);
  assert.deepEqual(r2.people, [{ name: "Patel & Sons", phone: "9820011005" }]);
});

test("a file that is not a contacts file says so", async function () {
  const r = await I.readFile("tally.xml", new Uint8Array([60, 120, 62]));
  assert.equal(r.kind, null);
  assert.deepEqual(r.people, []);
});

test("a dropped file keeps its own name under raw/, made safe, and a second of the same name is -2", function () {
  const s = { papers: [{ file: "raw/rate-list.pdf" }] };
  assert.equal(X.rawName(s, "rate list.pdf"), "raw/rate-list-2.pdf");
  assert.equal(X.rawName(s, "IMG 2041.HEIC"), "raw/IMG-2041.heic");
  assert.equal(X.rawName(s, "बिल सितंबर.jpg"), "raw/बिल-सितंबर.jpg");
  assert.equal(X.rawName(s, "Screenshot 2026-10-01 at 10.32.11 AM.png"), "raw/Screenshot-2026-10-01-at-10.32.11-AM.png");
  assert.equal(X.rawName(s, "setup.exe"), "raw/setup.exe.bin");
  assert.equal(X.rawName(s, "notes"), "raw/notes.bin");
  assert.equal(X.paperFile({ id: "fl1", kind: "file", file: "raw/a.pdf" }), "raw/a.pdf");
});

test("a file stands in for a step: products, stock, a customer list once sorted; To follow up names it", function () {
  const CAT = require("../catalogue.js"), M = require("../model.js");
  const s = M.blank();
  s.store.mobile = "9820011223";
  assert.equal(M.progress(CAT, s).items.done, false);
  s.papers.push({ id: "fl1", kind: "file", file: "raw/rate-list.pdf", name: "rate list.pdf", step: "items", at: 1 });
  s.papers.push({ id: "fl2", kind: "photo", mime: "image/jpeg", step: "stock", at: 2 });
  s.papers.push({ id: "vn1", kind: "voice", step: "rules", at: 3 });
  const P = M.progress(CAT, s);
  assert.equal(P.items.done, true);
  assert.equal(P.items.file, true);
  assert.equal(P.stock.done, true);
  assert.equal(P.rules.done, false, "a voice note is not the answers");
  const keys = M.missing(CAT, s).map((g) => g.key);
  assert.ok(!keys.includes("noItems") && !keys.includes("notCounted"));
  assert.ok(keys.includes("noShops"), "no customer list sent, so customers are still asked");

  /* A customer list: its people arrive to sort; the step is done once they are sorted. */
  s.papers.push({ id: "fl3", kind: "file", file: "raw/customers.xlsx", name: "customers.xlsx", step: "people", at: 4 });
  const r = M.addPerson(s, { name: "Sharma Kirana", phone: "9820012345" });
  assert.equal(M.progress(CAT, s).people.done, false);
  s.people[r.id].type = "shop";
  assert.equal(M.progress(CAT, s).people.done, true);

  const follow = X.sheets(CAT, s, new Date("2026-10-01T10:00:00+05:30")).find((x) => x.name === "To follow up").rows;
  assert.ok(follow.some((row) => row[0] === "items" && /Set up from his file: raw\/rate-list\.pdf/.test(row[1])));
  assert.ok(follow.some((row) => row[0] === "stock" && /photos\/fl2\.jpg/.test(row[1])));
});

test("a Tally ledger list arrives sorted: debtors are customers, creditors suppliers, banks and taxes left out", () => {
  const rows = [["Vasu Foods Pvt Ltd"], ["List of Ledgers"], [""], ["Particulars", "Under", "Mobile No.", "GSTIN/UIN"],
    ["Mehta Provision Store", "Sundry Debtors", "9876500011", ""], ["HDFC Bank", "Bank Accounts", "", ""],
    ["Britannia Industries", "Sundry Creditors", "9876500013", "27AAACB0000A1Z5"], ["CGST", "Duties & Taxes", "", ""],
    ["Raju", "Salary Payable", "9123456780", ""], ["Grand Total", "", "", ""]];
  assert.deepEqual(I.fromTable(rows), [
    { name: "Mehta Provision Store", phone: "9876500011", type: "shop" },
    { name: "Britannia Industries", phone: "9876500013", type: "supplier" },
    { name: "Raju", phone: "9123456780", type: "staff" },
  ]);
});

test("pasted text: rows from Excel, or lines with a name and a number in any shape", () => {
  assert.deepEqual(I.fromText("Name\tMobile\nA One Stores\t9820011223\nB Two\t98877 66554"),
    [{ name: "A One Stores", phone: "9820011223" }, { name: "B Two", phone: "9887766554" }]);
  assert.deepEqual(I.fromText("1. Sharma Kirana - +91 98200 11223\n[01/10/26, 9:30 pm] Ramesh: 9123456780\nGupta Traders\n+91-98765-43210\nnothing here"),
    [{ name: "Sharma Kirana", phone: "9820011223" }, { name: "Ramesh", phone: "9123456780" }, { name: "Gupta Traders", phone: "9876543210" }]);
  assert.deepEqual(I.fromText(""), []);
});

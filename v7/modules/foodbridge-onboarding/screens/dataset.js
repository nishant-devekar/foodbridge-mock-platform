/* ==========================================================================
   ONBOARDING — the Dataset. What S02 hands to S03, and how it is made.

   S02 ends in exactly one hand-off, DataReady:

     { provenance, readAt, dataset, notes }

     provenance  { kind:"zoho"|"xero", label:"Your Zoho Books"|"Your Xero", org:{id,name} }
               | { kind:"files", label:"Your uploaded files", files:[{id,name,type}] }
     dataset     { customers, products, orders, invoices }   each a Collection
     Collection  { present:false } | { present:true, records:[…] }
     notes       { skipped:[{ reason, count, from }] }

   ABSENT IS NOT EMPTY. `present:false` means "not provided"; `present:true`
   with no records means "provided, and there are none" — a Zoho account with
   no orders is the second, and is a real result, not a failure.

   Two ways in, one shape out:
     fromApp(raw)      records the bridge read from a connected app (Zoho
                       Books or Xero), in one shape; fromZoho is its old name
     fromFiles(parts)  what readFile() got out of each file the user added

   And one way on to the existing engines, which predate this contract:
     toEngine(dataset) → { seed:{products,b2b}, history, presence }

   THE ORDER RULES ARE tools/import-order-history.py's, reproduced (D-016
   style: one rule, two implementations — change one, change both):
     · drafts, voids and cancellations are not demand
     · quantity is ordered less cancelled; nothing ≤ 0 is kept
     · lines sold by weight (g / kg / gm) are dropped
     · one customer's orders on one date are ONE buying occasion
     · avgCycleDays is the median gap between occasions, 30 with one
     · the last 24 months are kept

   No DOM, no network, no storage: runs unchanged under node for its tests.
   ========================================================================== */

(function (root) {
  "use strict";

  const FILE_TYPES = ["orders", "customers", "products", "invoices"];
  /* S03's "Add later" items read two more kinds of paper. They are not offered
     on S02, whose type sheet stays the four above. */
  const EVIDENCE_TYPES = ["invoices", "payments", "costs"];
  const MAX_BYTES = 20 * 1024 * 1024;
  const WEIGHT_UNITS = { g: 1, kg: 1, gm: 1, gms: 1, gram: 1, grams: 1, kgs: 1 };
  const NOT_DEMAND = { draft: 1, void: 1, voided: 1, cancelled: 1, canceled: 1, rejected: 1, pending_approval: 1 };
  const DAY = 86400000;
  const HISTORY_MONTHS = 24;

  const norm = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().toLowerCase();
  const hkey = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, "");

  /* ───────────────────────────────────────────────── reading a file ───── */

  /* The columns FoodBridge looks for, by what the column is FOR. Header text
     is compared with case, spaces and punctuation removed, so "Order Date",
     "order_date" and "ORDER-DATE" are one header. Zoho Books' own export
     names come first in each list, because that is the first real export this
     has been matched against. There is no mapping screen: a file without the
     required columns fails, alone, with a sentence saying what it needs. */
  const COLS = {
    date:       ["Order Date", "SalesOrder Date", "Sales Order Date", "Date", "Order Dt", "Voucher Date", "Bill Date"],
    customer:   ["Customer Name", "Customer", "Party Name", "Party", "Shop Name", "Shop", "Buyer", "Client Name", "Client", "Retailer"],
    customerId: ["Customer ID", "Contact ID", "Party Code", "Customer Code"],
    product:    ["Item Name", "Product Name", "Item", "Product", "Item Description", "Particulars", "SKU Name"],
    productId:  ["Product ID", "Item ID"],
    sku:        ["SKU", "Item Code", "Product Code", "Art No", "Article Number"],
    qty:        ["QuantityOrdered", "Quantity Ordered", "Quantity", "Qty", "Item Quantity", "Units", "Order Qty"],
    cancelled:  ["QuantityCancelled", "Quantity Cancelled", "Cancelled Qty"],
    unit:       ["Usage unit", "Unit", "UOM", "Unit of Measure"],
    status:     ["Status", "SalesOrder Status", "Order Status", "Invoice Status"],
    orderId:    ["SalesOrder ID", "SalesOrder Number", "Sales Order Number", "Order Number", "Order No", "Order ID", "SO Number", "Voucher No", "Voucher Number"],
    amount:     ["Item Total", "Line Total", "Amount"],
    name:       ["Customer Name", "Display Name", "Contact Name", "Company Name", "Name", "Party Name", "Shop Name", "Customer"],
    itemName:   ["Item Name", "Product Name", "Name", "Item", "Product"],
    stock:      ["Stock On Hand", "Stock on hand", "Closing Stock", "Available Stock", "Stock", "Quantity In Stock", "Qty In Stock"],
    invDate:    ["Invoice Date", "Date", "Bill Date"],
    invNumber:  ["Invoice Number", "Invoice No", "Invoice#", "Bill Number", "Voucher No"],
    total:      ["Total", "Invoice Total", "Grand Total", "Invoice Amount", "Amount", "Net Amount"],
    balance:    ["Balance", "Balance Due", "Amount Due", "Outstanding"],
    dueDate:    ["Due Date"],
    payDate:    ["Payment Date", "Date", "Received Date", "Receipt Date"],
    paid:       ["Amount Received", "Amount", "Payment Amount", "Paid Amount", "Total"],
    cost:       ["Purchase Rate", "Purchase Price", "Cost Price", "Cost", "Unit Cost", "Buying Price", "Landing Cost"],
  };

  const SPECS = {
    orders:    { need: ["date", "customer", "product", "qty"],
                 want: ["customerId", "productId", "sku", "cancelled", "unit", "status", "orderId", "amount"] },
    customers: { need: ["name"], want: ["customerId"] },
    products:  { need: ["itemName"], want: ["productId", "sku", "unit", "stock"] },
    invoices:  { need: ["invDate", "customer", "total"], want: ["invNumber", "balance", "dueDate", "status"] },
    payments:  { need: ["payDate", "customer", "paid"], want: [] },
    costs:     { need: ["itemName", "cost"], want: ["sku", "productId"] },
  };

  /* Find the header row: the first of the opening rows that carries every
     required column. Exports often start with a title or a blank line. */
  function locate(rows, type) {
    const spec = SPECS[type];
    for (let r = 0; r < Math.min(rows.length, 15); r++) {
      const heads = (rows[r] || []).map(hkey);
      const at = {};
      const taken = {};
      const find = function (field) {
        const names = COLS[field].map(hkey);
        for (let n = 0; n < names.length; n++) {
          const i = heads.indexOf(names[n]);
          if (i !== -1 && !taken[i]) return i;
        }
        return -1;
      };
      let ok = true;
      spec.need.forEach(function (f) {
        if (!ok) return;
        const i = find(f);
        if (i === -1) { ok = false; return; }
        at[f] = i; taken[i] = true;
      });
      if (!ok) continue;
      spec.want.forEach(function (f) { const i = find(f); if (i !== -1) { at[f] = i; taken[i] = true; } });
      return { row: r, at: at };
    }
    return null;
  }

  function num(v) {
    if (typeof v === "number") return isFinite(v) ? v : null;
    const s = String(v == null ? "" : v).replace(/[,\s₹]|Rs\.?|INR/gi, "");
    if (s === "") return null;
    const n = Number(s);
    return isFinite(n) ? n : null;
  }

  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const pad = (n) => (n < 10 ? "0" : "") + n;
  function iso(y, m, d) {
    if (y < 100) y += 2000;
    const t = new Date(Date.UTC(y, m - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
    return y + "-" + pad(m) + "-" + pad(d);
  }

  /* Dates as Indian exports write them. A slashed date is read DAY first
     (14/08/2026), because that is how every Indian accounting package prints
     one; an Excel date arrives as a serial number and is converted exactly. */
  function parseDate(v) {
    if (typeof v === "number") {
      if (v > 20000 && v < 80000) {
        const t = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * DAY);
        return t.toISOString().slice(0, 10);
      }
      return null;
    }
    const s = String(v == null ? "" : v).trim();
    let m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return iso(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/.exec(s))) return iso(+m[3], +m[2], +m[1]);
    if ((m = /^(\d{1,2})[\s\-\/]([A-Za-z]{3,4})[a-z]*[\s\-\/,]+(\d{2,4})$/.exec(s)) && MON[m[2].toLowerCase()]) {
      return iso(+m[3], MON[m[2].toLowerCase()], +m[1]);
    }
    if ((m = /^([A-Za-z]{3,4})[a-z]*\s+(\d{1,2}),?\s+(\d{4})$/.exec(s)) && MON[m[1].toLowerCase()]) {
      return iso(+m[3], MON[m[1].toLowerCase()], +m[2]);
    }
    if (/^\d+(\.\d+)?$/.test(s)) return parseDate(Number(s));
    return null;
  }

  function Skips() {
    const c = {};
    return {
      add: function (reason) { c[reason] = (c[reason] || 0) + 1; },
      list: function () { return Object.keys(c).map(function (k) { return { reason: k, count: c[k] }; }); },
    };
  }

  /* Rows → the records one TYPE of file holds. Returns null when the columns
     that type needs are not there at all. */
  function extract(rows, type) {
    const loc = locate(rows, type);
    if (!loc) return null;
    const at = loc.at;
    const cell = function (row, f) { return at[f] === undefined ? "" : row[at[f]]; };
    const text = function (row, f) { return String(cell(row, f) == null ? "" : cell(row, f)).trim(); };
    const skips = Skips();
    const records = [];

    for (let r = loc.row + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      if (!row.some(function (v) { return String(v == null ? "" : v).trim() !== ""; })) continue;
      const line = r + 1;

      if (type === "customers") {
        const name = text(row, "name");
        if (!name) { skips.add("missing_value"); continue; }
        records.push({ name: name, extId: text(row, "customerId") || undefined, row: line });
      } else if (type === "products") {
        const name = text(row, "itemName");
        if (!name) { skips.add("missing_value"); continue; }
        const p = { name: name, row: line };
        if (text(row, "sku")) p.sku = text(row, "sku");
        if (text(row, "productId")) p.extId = text(row, "productId");
        if (text(row, "unit")) p.unit = text(row, "unit");
        const st = at.stock === undefined ? null : num(cell(row, "stock"));
        if (st !== null) p.stockOnHand = st;      // a blank cell stays absent
        records.push(p);
      } else if (type === "orders") {
        const date = parseDate(cell(row, "date"));
        const customer = text(row, "customer");
        const product = text(row, "product");
        const qty = num(cell(row, "qty"));
        if (!customer || !product || cell(row, "qty") === "") { skips.add("missing_value"); continue; }
        if (!date) { skips.add("unreadable_date"); continue; }
        if (qty === null) { skips.add("unreadable_quantity"); continue; }
        if (NOT_DEMAND[norm(text(row, "status")).replace(/\s+/g, "_")]) { skips.add("not_an_order"); continue; }
        const unit = text(row, "unit");
        if (unit && WEIGHT_UNITS[unit.toLowerCase()]) { skips.add("sold_by_weight"); continue; }
        const q = qty - (num(cell(row, "cancelled")) || 0);
        if (q <= 0) { skips.add("zero_quantity"); continue; }
        const rec = { date: date, customer: customer, product: product, qty: q, row: line };
        if (text(row, "customerId")) rec.customerExtId = text(row, "customerId");
        if (text(row, "productId")) rec.productExtId = text(row, "productId");
        if (text(row, "sku")) rec.sku = text(row, "sku");
        if (unit) rec.unit = unit;
        if (text(row, "orderId")) rec.orderId = text(row, "orderId");
        const amt = at.amount === undefined ? null : num(cell(row, "amount"));
        if (amt !== null) rec.amount = amt;
        records.push(rec);
      } else if (type === "invoices") {
        const date = parseDate(cell(row, "invDate"));
        const customer = text(row, "customer");
        const total = num(cell(row, "total"));
        if (!customer || cell(row, "total") === "") { skips.add("missing_value"); continue; }
        if (!date) { skips.add("unreadable_date"); continue; }
        if (total === null) { skips.add("unreadable_amount"); continue; }
        if (NOT_DEMAND[norm(text(row, "status")).replace(/\s+/g, "_")]) { skips.add("not_an_invoice"); continue; }
        const inv = { date: date, customer: customer, total: total, row: line };
        if (text(row, "invNumber")) inv.number = text(row, "invNumber");
        const due = parseDate(cell(row, "dueDate"));
        if (due) inv.dueDate = due;
        const bal = at.balance === undefined ? null : num(cell(row, "balance"));
        if (bal !== null) inv.balance = bal;
        records.push(inv);
      } else if (type === "payments") {
        const date = parseDate(cell(row, "payDate"));
        const customer = text(row, "customer");
        const amount = num(cell(row, "paid"));
        if (!customer || cell(row, "paid") === "") { skips.add("missing_value"); continue; }
        if (!date) { skips.add("unreadable_date"); continue; }
        if (amount === null) { skips.add("unreadable_amount"); continue; }
        records.push({ date: date, customer: customer, amount: amount, row: line });
      } else if (type === "costs") {
        const name = text(row, "itemName");
        const cost = num(cell(row, "cost"));
        if (!name || cell(row, "cost") === "") { skips.add("missing_value"); continue; }
        if (cost === null) { skips.add("unreadable_amount"); continue; }
        const c = { name: name, cost: cost, row: line };
        if (text(row, "sku")) c.sku = text(row, "sku");
        records.push(c);
      }
    }
    return { records: records, skipped: skips.list() };
  }

  /* ── CSV ─────────────────────────────────────────────────────────────── */

  function parseCsv(text) {
    text = String(text || "").replace(/^﻿/, "");
    /* The delimiter is whichever one splits the opening lines most consistently
       -- judged over several lines, because exports often open with a title. */
    const lines = text.split(/\r?\n/).filter(function (l) { return l.trim() !== ""; }).slice(0, 10);
    const count = function (line, ch) {
      let n = 0, q = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') q = !q;
        else if (!q && line[i] === ch) n++;
      }
      return n;
    };
    let delim = ",", best = -1;
    [",", ";", "\t", "|"].forEach(function (c) {
      const n = lines.reduce(function (m, l) { return Math.max(m, count(l, c)); }, 0);
      if (n > best) { best = n; delim = c; }
    });

    const rows = [];
    let row = [], field = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
        } else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += ch;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  /* ── XLSX ────────────────────────────────────────────────────────────────
     An .xlsx is a zip of XML. This reads the zip directory, inflates only the
     parts it needs with the platform's own DecompressionStream, and walks the
     sheet XML. No library: nothing to vendor, and nothing to trust but the
     browser. Formulas arrive as their cached values, which is what the user
     sees in Excel. */

  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

  function zipEntries(bytes) {
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (u32(bytes, i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd === -1) return null;
    const n = u16(bytes, eocd + 10);
    let p = u32(bytes, eocd + 16);
    const out = {};
    for (let k = 0; k < n; k++) {
      if (u32(bytes, p) !== 0x02014b50) return null;
      const method = u16(bytes, p + 10);
      const csize = u32(bytes, p + 20);
      const nameLen = u16(bytes, p + 28), extraLen = u16(bytes, p + 30), commentLen = u16(bytes, p + 32);
      const local = u32(bytes, p + 42);
      const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
      const lnameLen = u16(bytes, local + 26), lextraLen = u16(bytes, local + 28);
      const start = local + 30 + lnameLen + lextraLen;
      out[name] = { method: method, data: bytes.subarray(start, start + csize) };
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  }

  async function inflate(entry) {
    if (entry.method === 0) return new TextDecoder().decode(entry.data);
    if (entry.method !== 8 || typeof DecompressionStream === "undefined") throw new Error("unsupported_zip");
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([entry.data]).stream().pipeThrough(ds);
    return await new Response(stream).text();
  }

  const unxml = (s) => String(s).replace(/&(lt|gt|amp|quot|apos|#(\d+)|#x([0-9a-f]+));/gi, function (m, n, d, h) {
    if (d) return String.fromCharCode(+d);
    if (h) return String.fromCharCode(parseInt(h, 16));
    return { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" }[n.toLowerCase()];
  });
  const texts = (s) => {
    let out = "", m;
    const re = /<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g;
    while ((m = re.exec(s))) out += unxml(m[1]);
    return out;
  };
  const colIndex = (ref) => {
    const letters = /^[A-Z]+/.exec(ref || "");
    if (!letters) return -1;
    let n = 0;
    for (let i = 0; i < letters[0].length; i++) n = n * 26 + (letters[0].charCodeAt(i) - 64);
    return n - 1;
  };

  async function parseXlsx(bytes) {
    const zip = zipEntries(bytes);
    if (!zip || !zip["xl/workbook.xml"]) throw new Error("damaged");
    const shared = [];
    if (zip["xl/sharedStrings.xml"]) {
      const xml = await inflate(zip["xl/sharedStrings.xml"]);
      const re = /<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g;
      let m;
      while ((m = re.exec(xml))) shared.push(texts(m[1]));
    }
    const wb = await inflate(zip["xl/workbook.xml"]);
    const rels = zip["xl/_rels/workbook.xml.rels"] ? await inflate(zip["xl/_rels/workbook.xml.rels"]) : "";
    const target = {};
    rels.replace(/<Relationship\b([^>]*)\/?>/g, function (m, attrs) {
      const id = /Id="([^"]+)"/.exec(attrs), t = /Target="([^"]+)"/.exec(attrs);
      if (id && t) target[id[1]] = t[1].replace(/^\/?(xl\/)?/, "xl/");
      return m;
    });
    const sheets = [];
    wb.replace(/<(?:\w+:)?sheet\b([^>]*)\/?>/g, function (m, attrs) {
      const rid = /r:id="([^"]+)"/.exec(attrs);
      if (rid && target[rid[1]]) sheets.push(target[rid[1]]);
      return m;
    });
    if (!sheets.length) Object.keys(zip).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort().forEach((k) => sheets.push(k));

    const out = [];
    for (let s = 0; s < sheets.length; s++) {
      if (!zip[sheets[s]]) continue;
      const xml = await inflate(zip[sheets[s]]);
      const rows = [];
      const rowRe = /<(?:\w+:)?row\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g;
      let rm;
      while ((rm = rowRe.exec(xml))) {
        const row = [];
        const cellRe = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g;
        let cm, auto = 0;
        while ((cm = cellRe.exec(rm[1] || ""))) {
          const attrs = cm[1], inner = cm[2] || "";
          const ref = /\br="([A-Z]+\d+)"/.exec(attrs);
          const idx = ref ? colIndex(ref[1]) : auto;
          auto = idx + 1;
          const t = (/\bt="([^"]+)"/.exec(attrs) || [])[1];
          const v = /<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(inner);
          let val = "";
          if (t === "s") val = v ? (shared[+v[1]] || "") : "";
          else if (t === "inlineStr") val = texts(inner);
          else if (t === "str" || t === "e") val = v ? unxml(v[1]) : "";
          else if (t === "b") val = v ? (v[1] === "1" ? "TRUE" : "FALSE") : "";
          else if (v) { const n = Number(v[1]); val = isFinite(n) ? n : unxml(v[1]); }
          while (row.length < idx) row.push("");
          row[idx] = val;
        }
        rows.push(row);
      }
      out.push(rows);
    }
    return out;
  }

  /* One file, one declared type → { ok:true, records, skipped } or
     { ok:false, reason }. The reason is a CODE; the sentence is the page's.

       unsupported   not Excel (.xlsx) or CSV
       protected     an encrypted workbook
       too_large     over 20 MB
       damaged       empty, or not what its name says
       no_records    none of what the user said the file contains */
  /* What a sheet IS, from its own columns — never from the file's name. The
     required columns of each kind are distinctive enough to tell the four
     apart in almost every export: an orders sheet has a date, a customer, a
     product and a quantity; an invoices sheet a date, a customer and a total;
     a products sheet an item name; a customers sheet a name. Orders and
     invoices are tried first because either also carries a name column that
     would pass as a plain list. The one genuine ambiguity is a sheet with a
     bare "Name" column — products or customers — and that is the one thing
     FoodBridge asks about, with the choice narrowed to those two.

       { kind: "orders" } · { choices: ["products", "customers"] } · null */
  function classify(rows) {
    const hit = {};
    FILE_TYPES.forEach(function (t) { hit[t] = locate(rows, t); });
    if (hit.orders) return { kind: "orders" };
    if (hit.invoices) return { kind: "invoices" };
    if (hit.products && hit.customers) {
      // Two different columns (say "Item Name" beside "Customer Name") with
      // no date or quantity is not a list of either; the same column is a
      // list of one of them, and only the user knows which.
      return { choices: ["products", "customers"] };
    }
    if (hit.products) return { kind: "products" };
    if (hit.customers) return { kind: "customers" };
    return null;
  }

  /* Every kind a workbook holds, one result per kind, the largest sheet of
     each. A sheet that is neither is passed over; a sheet that could be two
     things is reported only when nothing else was found, so one clear sheet
     is never held up by an unclear one. */
  function readAll(sheets) {
    const found = {};
    let choices = null;
    sheets.forEach(function (rows) {
      const c = classify(rows);
      if (!c) return;
      if (c.choices) { choices = choices || c.choices; return; }
      const got = extract(rows, c.kind);
      if (!got || !got.records.length) return;
      if (!found[c.kind] || got.records.length > found[c.kind].records.length) found[c.kind] = got;
    });
    const list = Object.keys(found).map(function (t) { return { type: t, records: found[t].records, skipped: found[t].skipped }; });
    if (list.length) return { ok: true, found: list };
    if (choices) return { ok: false, reason: "ambiguous", choices: choices };
    return { ok: false, reason: "no_records" };
  }

  /* The kinds the user tagged a file with, each read from the sheet that
     holds most of it. A tag that gives nothing is reported by name, so the
     row can say "Invoices · none" instead of quietly dropping the tag. */
  function readAs(sheets, types) {
    const found = [], none = [];
    types.forEach(function (t) {
      let best = null;
      sheets.forEach(function (rows) {
        const got = extract(rows, t);
        if (got && got.records.length && (!best || got.records.length > best.records.length)) best = got;
      });
      if (best) found.push({ type: t, records: best.records, skipped: best.skipped }); else none.push(t);
    });
    if (found.length) return { ok: true, found: found, none: none };
    return { ok: false, reason: "no_records", none: none };
  }

  /* type: one of FILE_TYPES / EVIDENCE_TYPES to read the file AS that kind
     ({ ok, records, skipped }); a LIST of kinds — the file's tags — to read
     each of them ({ ok, found: [{ type, records, skipped }], none: [types] });
     or null to let the file say what it holds ({ ok, found } — a workbook may
     hold several). */
  async function readFile(file, type) {
    const auto = type == null;
    const tags = Array.isArray(type) ? type.filter(function (t) { return FILE_TYPES.indexOf(t) !== -1 || EVIDENCE_TYPES.indexOf(t) !== -1; }) : null;
    if (tags && !tags.length) return { ok: false, reason: "no_records" };
    if (!auto && !tags && FILE_TYPES.indexOf(type) === -1 && EVIDENCE_TYPES.indexOf(type) === -1) return { ok: false, reason: "no_records" };
    const name = String(file && file.name || "").toLowerCase();
    const ext = (/\.([a-z0-9]+)$/.exec(name) || [])[1] || "";
    if (file.size > MAX_BYTES) return { ok: false, reason: "too_large" };
    if (!file.size) return { ok: false, reason: "damaged" };
    let bytes;
    try { bytes = new Uint8Array(await file.arrayBuffer()); }
    catch (e) { return { ok: false, reason: "interrupted" }; }

    // An encrypted .xlsx is an OLE compound file, not a zip. So is a legacy .xls.
    const ole = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
    const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;

    let sheets;
    try {
      if (ext === "xlsx" || (zip && ext !== "csv")) {
        if (ole) return { ok: false, reason: "protected" };
        if (!zip) return { ok: false, reason: "damaged" };
        sheets = await parseXlsx(bytes);
      } else if (ext === "csv" || ext === "txt" || file.type === "text/csv") {
        if (ole || zip) return { ok: false, reason: "damaged" };
        sheets = [parseCsv(new TextDecoder("utf-8").decode(bytes))];
      } else {
        return { ok: false, reason: "unsupported" };
      }
    } catch (e) {
      return { ok: false, reason: e && e.message === "unsupported_zip" ? "unsupported" : "damaged" };
    }

    if (auto) return readAll(sheets);
    if (tags) return readAs(sheets, tags);

    let best = null;
    for (let i = 0; i < sheets.length; i++) {
      const got = extract(sheets[i], type);
      if (got && got.records.length && (!best || got.records.length > best.records.length)) best = got;
    }
    if (!best) return { ok: false, reason: "no_records" };
    return { ok: true, records: best.records, skipped: best.skipped };
  }

  /* ───────────────────────────────────────────── building the Dataset ── */

  const present = (records) => ({ present: true, records: records });

  /* ONE VISIT IS ONE ORDER (import-order-history.py). One customer's orders on
     one date become one order, lines summed per product. Done here, in
     normalisation, so the Dataset S03 counts is already the history the
     engines read -- not a larger number the screen quietly shrinks. The ids of
     every source order are kept on the merged one. */
  function mergeSameDay(orders) {
    const byKey = {};
    const out = [];
    orders.forEach(function (o) {
      const key = o.customerId + "|" + o.date;
      let m = byKey[key];
      if (!m) {
        m = { id: o.id, customerId: o.customerId, date: o.date, lines: [], from: o.from, sources: [] };
        if (o.status) { m.status = o.status; m.statuses = []; }
        byKey[key] = m; out.push(m);
      }
      // An order merged before (evidence added on S03) brings its sources along.
      if (o.sources && o.sources.length) m.sources.push.apply(m.sources, o.sources); else m.sources.push(o.from);
      if (o.status) { if (o.statuses && o.statuses.length) m.statuses.push.apply(m.statuses, o.statuses); else m.statuses.push(o.status); }
      if (o.raw) (m.raw || (m.raw = [])).push(o.raw);
      o.lines.forEach(function (l) {
        const hit = m.lines.filter(function (x) { return x.productId === l.productId; })[0];
        if (!hit) { m.lines.push(Object.assign({}, l)); return; }
        hit.qty += l.qty;
        if (typeof l.amount === "number") hit.amount = (typeof hit.amount === "number" ? hit.amount : 0) + l.amount;
      });
    });
    return { orders: out, merged: orders.length - out.length };
  }
  const ABSENT = { present: false };

  /* parts: [{ id, name, type, records, skipped }] — only files that were READ. */
  function fromFiles(parts, readAt) {
    const customers = [], products = [], orders = [], invoices = [];
    const custBy = {}, prodByName = {}, prodBySku = {};
    const skipped = [];
    const have = { customers: false, products: false, orders: false, invoices: false };

    function customer(name, from, derived) {
      const k = norm(name);
      if (custBy[k]) return custBy[k].id;
      const c = { id: "cu" + (customers.length + 1), name: name, from: from };
      if (derived) c.derived = true;
      custBy[k] = c; customers.push(c);
      return c.id;
    }
    function product(name, sku, from, derived, extra) {
      const ks = sku ? norm(sku) : "", kn = norm(name);
      const hit = (ks && prodBySku[ks]) || prodByName[kn];
      if (hit) {
        if (extra) Object.keys(extra).forEach(function (k) { if (hit[k] === undefined) hit[k] = extra[k]; });
        if (!derived) delete hit.derived;
        return hit.id;
      }
      const p = { id: "pr" + (products.length + 1), name: name, from: from };
      if (sku) p.sku = sku;
      if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
      if (derived) p.derived = true;
      prodByName[kn] = p; if (ks) prodBySku[ks] = p;
      products.push(p);
      return p.id;
    }

    // Masters first, so a record named in a customers or products file is the
    // one an order line attaches to rather than a copy derived from the line.
    const order = { customers: 0, products: 1, orders: 2, invoices: 3 };
    parts.slice().sort(function (a, b) { return order[a.type] - order[b.type]; }).forEach(function (f) {
      const ref = function (row) { return { kind: "file", fileId: f.id, row: row }; };
      (f.skipped || []).forEach(function (s) {
        skipped.push({ reason: s.reason, count: s.count, from: { kind: "file", fileId: f.id } });
      });
      if (!f.records) return;
      have[f.type] = true;
      if (f.type === "customers") {
        f.records.forEach(function (r) { customer(r.name, ref(r.row), false); });
      } else if (f.type === "products") {
        f.records.forEach(function (r) {
          const extra = {};
          if (r.unit) extra.unit = r.unit;
          if (r.stockOnHand !== undefined) extra.stockOnHand = r.stockOnHand;
          product(r.name, r.sku, ref(r.row), false, extra);
        });
      } else if (f.type === "orders") {
        const byKey = {};
        f.records.forEach(function (r) {
          const cid = customer(r.customer, ref(r.row), true);
          const pid = product(r.product, r.sku, ref(r.row), true, r.unit ? { unit: r.unit } : null);
          const key = r.orderId ? "o:" + r.orderId : "d:" + cid + "|" + r.date;
          let o = byKey[key];
          if (!o) {
            o = { id: "or" + (orders.length + 1), customerId: cid, date: r.date, lines: [], from: ref(r.row) };
            byKey[key] = o; orders.push(o);
          }
          const line = { productId: pid, qty: r.qty };
          if (r.unit) line.unit = r.unit;
          if (r.amount !== undefined) line.amount = r.amount;
          o.lines.push(line);
        });
      } else if (f.type === "invoices") {
        f.records.forEach(function (r) {
          const inv = { id: "in" + (invoices.length + 1), customerId: customer(r.customer, ref(r.row), true),
                        date: r.date, total: r.total, from: ref(r.row) };
          if (r.number) inv.number = r.number;
          if (r.dueDate) inv.dueDate = r.dueDate;
          if (r.balance !== undefined) inv.balance = r.balance;
          invoices.push(inv);
        });
      }
    });

    const day = mergeSameDay(orders);
    if (day.merged) skipped.push({ reason: "merged_same_day", count: day.merged, from: { kind: "files" } });

    // One file, listed once, with every kind that was read out of it.
    const files = [];
    const byId = {};
    parts.forEach(function (f) {
      let e = byId[f.id];
      if (!e) { e = byId[f.id] = { id: f.id, name: f.name, types: [] }; files.push(e); }
      if (e.types.indexOf(f.type) === -1) e.types.push(f.type);
    });

    return {
      provenance: { kind: "files", label: "Your uploaded files", files: files },
      readAt: readAt || new Date().toISOString(),
      dataset: {
        customers: customers.length || have.customers ? present(customers) : ABSENT,
        products:  products.length || have.products ? present(products) : ABSENT,
        orders:    have.orders ? present(day.orders) : ABSENT,
        invoices:  have.invoices ? present(invoices) : ABSENT,
      },
      notes: { skipped: skipped },
    };
  }

  /* raw: { org:{id,name}, customers:[{id,name}], products:[{id,name,sku?,unit?,stockOnHand?}],
            orders:[{id,customerId,customerName,date,lines:[{itemId,name,qty,unit?}]}] }
     A completed read: all three collections are present even when empty. */
  /* The apps the bridge reads. Customers, products, orders and lines arrive
     in one shape for every app (the bridge normalises); the other modules
     arrive as the app's own records, so what identifies one and what an
     invoice's fields are called is per app. */
  /* h: { customer(extId) → dataset id, vendor(extId), money(v) }. A Xero
     date is "2026-08-11T00:00:00" or "/Date(ms)/"; the bridge's orders are
     already plain, the modules are not. */
  const xdate = function (r, k) {
    const v = r[k + "String"] || r[k];
    if (!v) return undefined;
    if (/^\d{4}-\d{2}-\d{2}/.test(String(v))) return String(v).slice(0, 10);
    const m = /\/Date\((\d+)/.exec(String(v));
    return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : undefined;
  };
  const xcontact = function (r) { return r.Contact && r.Contact.ContactID; };
  const APPS = {
    zoho: {
      label: "Your Zoho Books", prefix: "z",
      idOf: { invoices: "invoice_id", customerpayments: "payment_id", creditnotes: "creditnote_id",
              estimates: "estimate_id", purchaseorders: "purchaseorder_id", bills: "bill_id",
              expenses: "expense_id", vendors: "contact_id" },
      shapes: {
        invoices: function (r, h) { return { customerId: h.customer(r.customer_id), number: r.invoice_number, date: r.date, dueDate: r.due_date || undefined, total: h.money(r.total), balance: h.money(r.balance), status: r.status }; },
        customerpayments: function (r, h) { return { customerId: h.customer(r.customer_id), date: r.date, amount: h.money(r.amount), mode: r.payment_mode }; },
        creditnotes: function (r, h) { return { customerId: h.customer(r.customer_id), date: r.date, total: h.money(r.total), balance: h.money(r.balance), status: r.status }; },
        estimates: function (r, h) { return { customerId: h.customer(r.customer_id), date: r.date, total: h.money(r.total), status: r.status }; },
        purchaseorders: function (r, h) { return { vendorId: h.vendor(r.vendor_id), date: r.date, total: h.money(r.total), status: r.status }; },
        bills: function (r, h) { return { vendorId: h.vendor(r.vendor_id), date: r.date, dueDate: r.due_date || undefined, total: h.money(r.total), balance: h.money(r.balance), status: r.status }; },
        expenses: function (r, h) { return { date: r.date, total: h.money(r.total), account: r.account_name, status: r.status }; },
        vendors: function (r) { return { name: r.contact_name }; },
      },
    },
    xero: {
      label: "Your Xero", prefix: "x",
      // Xero has no invoices module here: its ACCREC invoices ARE the orders.
      idOf: { customerpayments: "PaymentID", creditnotes: "CreditNoteID", estimates: "QuoteID",
              purchaseorders: "PurchaseOrderID", bills: "InvoiceID", vendors: "ContactID" },
      shapes: {
        customerpayments: function (r, h) { return { customerId: h.customer(r.Invoice && xcontact(r.Invoice)), date: xdate(r, "Date"), amount: h.money(r.Amount), mode: r.PaymentType }; },
        creditnotes: function (r, h) { return { customerId: h.customer(xcontact(r)), date: xdate(r, "Date"), total: h.money(r.Total), balance: h.money(r.RemainingCredit), status: r.Status }; },
        estimates: function (r, h) { return { customerId: h.customer(xcontact(r)), date: xdate(r, "Date"), total: h.money(r.Total), status: r.Status }; },
        purchaseorders: function (r, h) { return { vendorId: h.vendor(xcontact(r)), date: xdate(r, "Date"), total: h.money(r.Total), status: r.Status }; },
        bills: function (r, h) { return { vendorId: h.vendor(xcontact(r)), date: xdate(r, "Date"), dueDate: xdate(r, "DueDate"), total: h.money(r.Total), balance: h.money(r.AmountDue), status: r.Status }; },
        vendors: function (r) { return { name: r.Name }; },
      },
    },
  };

  function fromApp(raw, readAt) {
    const app = APPS[raw.app] ? raw.app : "zoho";
    const A = APPS[app];
    const zref = function (entity, id) { return { kind: app, entity: entity, externalId: String(id) }; };
    const Z = A.prefix;
    const customers = [], products = [], orders = [];
    const custById = {}, prodById = {};
    const skips = Skips();

    (raw.customers || []).forEach(function (c) {
      const r = { id: Z + c.id, name: c.name, from: zref("contact", c.id) };
      if (c.raw) r.raw = c.raw;
      custById[c.id] = r; customers.push(r);
    });
    (raw.products || []).forEach(function (p) {
      const r = { id: Z + p.id, name: p.name, from: zref("item", p.id) };
      if (p.sku) r.sku = p.sku;
      if (p.unit) r.unit = p.unit;
      if (typeof p.stockOnHand === "number") r.stockOnHand = p.stockOnHand;
      if (p.raw) r.raw = p.raw;
      prodById[p.id] = r; products.push(r);
    });
    (raw.orders || []).forEach(function (o) {
      let cust = custById[o.customerId];
      if (!cust) {
        if (!o.customerName) { skips.add("unknown_customer"); return; }
        cust = { id: Z + o.customerId, name: o.customerName, from: zref("salesorder", o.id), derived: true };
        custById[o.customerId] = cust; customers.push(cust);
      }
      const lines = [];
      (o.lines || []).forEach(function (l) {
        if (l.unit && WEIGHT_UNITS[String(l.unit).toLowerCase()]) { skips.add("sold_by_weight"); return; }
        if (!(l.qty > 0)) { skips.add("zero_quantity"); return; }
        let prod = prodById[l.itemId];
        if (!prod) {
          if (!l.name) { skips.add("unknown_product"); return; }
          prod = { id: Z + (l.itemId || "n:" + norm(l.name)), name: l.name, from: zref("salesorder", o.id), derived: true };
          prodById[l.itemId] = prod; products.push(prod);
        }
        const line = { productId: prod.id, qty: l.qty };
        if (l.unit) line.unit = l.unit;
        if (l.raw) line.raw = l.raw;
        lines.push(line);
      });
      if (!lines.length) { skips.add("no_usable_lines"); return; }
      const ord = { id: Z + o.id, customerId: cust.id, date: o.date, lines: lines, from: zref("salesorder", o.id) };
      if (o.status) ord.status = o.status;
      if (o.raw) ord.raw = Object.assign({}, o.raw, o.detail ? { detail: o.detail } : {});
      orders.push(ord);
    });

    const day = mergeSameDay(orders);
    const notes = skips.list().map(function (s) { return { reason: s.reason, count: s.count, from: { kind: app } }; });
    const ex = (raw.orderNotes && raw.orderNotes.excluded) || {};
    Object.keys(ex).forEach(function (k) { notes.push({ reason: "not_demand:" + k, count: ex[k], from: { kind: app } }); });
    if (day.merged) notes.push({ reason: "merged_same_day", count: day.merged, from: { kind: app } });

    /* Every other module the account showed, whole. A module Zoho would not
       show this login is ABSENT with the reason -- never an empty list, which
       would say the business has none. */
    const mods = raw.modules || {};
    const idOf = A.idOf;
    function moduleCollection(name, shape) {
      const m = mods[name];
      if (!m) return ABSENT;
      if (!m.ok) { notes.push({ reason: "module_unavailable:" + name + ":" + m.reason, count: 1, from: { kind: app } }); return { present: false, unavailable: m.reason }; }
      return present(m.records.map(function (r) {
        const out = shape ? shape(r) : {};
        out.id = Z + r[idOf[name]];
        out.from = zref(name, r[idOf[name]]);
        out.raw = r;
        return out;
      }));
    }
    const money = function (v) { return typeof v === "number" ? v : (v != null && v !== "" && isFinite(Number(v)) ? Number(v) : undefined); };
    const customerRef = function (extId) {
      const c = custById[extId];
      return c ? c.id : (extId ? Z + extId : undefined);
    };
    const h = { customer: customerRef, vendor: function (id) { return id ? Z + id : undefined; }, money: money };
    const mod = function (name) {
      const shape = A.shapes[name];
      return shape ? moduleCollection(name, function (r) { return shape(r, h); }) : ABSENT;
    };

    return {
      provenance: { kind: app, label: A.label, org: { id: String(raw.org.id), name: raw.org.name } },
      readAt: readAt || new Date().toISOString(),
      dataset: {
        customers: present(customers),
        products: present(products),
        orders: present(day.orders),
        invoices: mod("invoices"),
        payments: mod("customerpayments"),
        creditNotes: mod("creditnotes"),
        estimates: mod("estimates"),
        purchaseOrders: mod("purchaseorders"),
        bills: mod("bills"),
        expenses: mod("expenses"),
        vendors: mod("vendors"),
      },
      notes: { skipped: notes, window: raw.orderNotes && raw.orderNotes.from ? { from: raw.orderNotes.from } : undefined,
               ordersListed: raw.orderNotes ? raw.orderNotes.listed : undefined },
    };
  }

  /* ────────────────────────────────────── S03 "Add later" evidence ── */

  /* Adds what the user brought on S03 to the data S02 handed over, WITHOUT
     replacing it (product owner's decision, 17 Sep 2026: combine, label both).
     Every added record carries the file or photo it came from, and the
     provenance lists each addition beside the original source.

       parts: [{ id, name, type: "invoices"|"payments"|"costs", via: "file"|"photo", records, skipped }]

     Customers are matched to the existing ones by name; a name nobody has seen
     becomes a customer derived from that file. A cost price is attached to the
     product it names (by SKU, then name); a product nobody has is not invented
     -- the row is counted in the notes instead. */
  function addEvidence(ready, parts, at) {
    const dr = JSON.parse(JSON.stringify(ready));
    const ds = dr.dataset;
    const when = at || new Date().toISOString();
    const notes = (dr.notes = dr.notes || { skipped: [] });
    notes.skipped = notes.skipped || [];

    if (!ds.customers || !ds.customers.present) ds.customers = present([]);
    const custs = ds.customers.records;
    const byName = {};
    custs.forEach(function (c) { byName[norm(c.name)] = c; });
    const customerId = function (name, ref) {
      const k = norm(name);
      if (byName[k]) return byName[k].id;
      const c = { id: "ca" + (custs.length + 1) + "-" + k.replace(/[^a-z0-9]/g, "").slice(0, 12), name: name, from: ref, derived: true };
      custs.push(c); byName[k] = c;
      return c.id;
    };
    const collection = function (key) {
      if (!ds[key] || !ds[key].present) ds[key] = present([]);
      return ds[key].records;
    };
    const prods = (ds.products && ds.products.present) ? ds.products.records : [];
    const bySku = {}, byProd = {};
    prods.forEach(function (p) { if (p.sku) bySku[norm(p.sku)] = p; byProd[norm(p.name)] = p; });
    /* The same rule as fromFiles: a product named in a products file is the
       one an order line attaches to; one derived from a line is marked so. */
    const productId = function (name, sku, ref, derived, extra) {
      const ks = sku ? norm(sku) : "", kn = norm(name);
      const hit = (ks && bySku[ks]) || byProd[kn];
      if (hit) {
        if (extra) Object.keys(extra).forEach(function (k) { if (hit[k] === undefined) hit[k] = extra[k]; });
        if (!derived) delete hit.derived;
        return hit.id;
      }
      const list = collection("products");
      const p = { id: "pa" + (list.length + 1) + "-" + kn.replace(/[^a-z0-9]/g, "").slice(0, 12), name: name, from: ref };
      if (sku) p.sku = sku;
      if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
      if (derived) p.derived = true;
      list.push(p); byProd[kn] = p; if (ks) bySku[ks] = p;
      return p.id;
    };
    let ordersAdded = false;

    // Masters first, so a record named in a customers or products file is the
    // one an order line attaches to rather than a copy derived from the line.
    const order = { customers: 0, products: 1, orders: 2, invoices: 3, payments: 4, costs: 5 };
    parts.slice().sort(function (a, b) { return (order[a.type] || 0) - (order[b.type] || 0); }).forEach(function (f) {
      const ref = function (row) { return { kind: f.via === "photo" ? "photo" : "file", fileId: f.id, row: row }; };
      (f.skipped || []).forEach(function (sk) { notes.skipped.push({ reason: sk.reason, count: sk.count, from: { kind: "file", fileId: f.id } }); });
      if (f.type === "customers") {
        collection("customers");
        f.records.forEach(function (r) {
          const k = norm(r.name);
          if (byName[k]) { delete byName[k].derived; return; }
          customerId(r.name, ref(r.row));
          delete byName[k].derived;
        });
      } else if (f.type === "products") {
        collection("products");
        f.records.forEach(function (r) {
          const extra = {};
          if (r.unit) extra.unit = r.unit;
          if (r.stockOnHand !== undefined) extra.stockOnHand = r.stockOnHand;
          productId(r.name, r.sku, ref(r.row), false, extra);
        });
      } else if (f.type === "orders") {
        const list = collection("orders");
        ordersAdded = true;
        const byKey = {};
        f.records.forEach(function (r) {
          const cid = customerId(r.customer, ref(r.row));
          const pid = productId(r.product, r.sku, ref(r.row), true, r.unit ? { unit: r.unit } : null);
          const key = r.orderId ? "o:" + r.orderId : "d:" + cid + "|" + r.date;
          let o = byKey[key];
          if (!o) {
            o = { id: "oa" + (list.length + 1) + "-" + f.id, customerId: cid, date: r.date, lines: [], from: ref(r.row) };
            byKey[key] = o; list.push(o);
          }
          const line = { productId: pid, qty: r.qty };
          if (r.unit) line.unit = r.unit;
          if (r.amount !== undefined) line.amount = r.amount;
          o.lines.push(line);
        });
      } else if (f.type === "invoices") {
        const list = collection("invoices");
        f.records.forEach(function (r) {
          const inv = { id: "fi" + (list.length + 1) + "-" + f.id, customerId: customerId(r.customer, ref(r.row)),
                        date: r.date, total: r.total, from: ref(r.row) };
          if (r.number) inv.number = r.number;
          if (r.dueDate) inv.dueDate = r.dueDate;
          if (r.balance !== undefined) inv.balance = r.balance;
          list.push(inv);
        });
      } else if (f.type === "payments") {
        const list = collection("payments");
        f.records.forEach(function (r) {
          list.push({ id: "fp" + (list.length + 1) + "-" + f.id, customerId: customerId(r.customer, ref(r.row)),
                      date: r.date, amount: r.amount, from: ref(r.row) });
        });
      } else if (f.type === "costs") {
        let unmatched = 0;
        f.records.forEach(function (r) {
          const p = (r.sku && bySku[norm(r.sku)]) || byProd[norm(r.name)];
          if (!p) { unmatched++; return; }
          p.cost = r.cost;
          p.costFrom = ref(r.row);
        });
        if (unmatched) notes.skipped.push({ reason: "cost_for_unknown_product", count: unmatched, from: { kind: "file", fileId: f.id } });
      }
    });

    // One visit is one order, across what S02 handed over and what was added:
    // a shop's lines on one day are one buying occasion whichever file they
    // came from. Already-merged orders keep their sources.
    if (ordersAdded) {
      const day = mergeSameDay(ds.orders.records);
      ds.orders.records = day.orders;
      if (day.merged) notes.skipped.push({ reason: "merged_same_day", count: day.merged, from: { kind: "files" } });
    }

    dr.provenance.additions = (dr.provenance.additions || []).concat(parts.map(function (f) {
      return { id: f.id, name: f.name, type: f.type, via: f.via || "file", addedAt: when };
    }));
    dr.updatedAt = when;
    return dr;
  }

  /* ─────────────────────────────────────────────── on to the engines ── */

  /* The engines (evidence.js, predictive-order.js) were written against the
     demonstration tenant's shape. This is the ONLY place that shape is made,
     and it is made from the Dataset alone. */
  function toEngine(dataset, now) {
    const d = dataset || {};
    const recs = function (c) { return (c && c.present && c.records) || []; };
    const nowTime = now ? new Date(now).getTime() : Date.now();

    const products = recs(d.products).map(function (p) {
      const out = { id: p.id, name: p.name, artNo: p.sku || "", unit: p.unit || "" };
      if (typeof p.stockOnHand === "number") out.systemStock = p.stockOnHand;
      return out;
    });
    const b2b = recs(d.customers).map(function (c) { return { _id: c.id, name: { en: c.name } }; });

    const cutoff = new Date(nowTime - HISTORY_MONTHS * 30.44 * DAY).toISOString().slice(0, 10);
    const occasions = {};
    recs(d.orders).forEach(function (o) {
      if (!o.date || o.date < cutoff) return;
      const byDay = occasions[o.customerId] || (occasions[o.customerId] = {});
      const occ = byDay[o.date] || (byDay[o.date] = { at: o.date, qty: {}, value: 0, valued: false });
      o.lines.forEach(function (l) {
        occ.qty[l.productId] = (occ.qty[l.productId] || 0) + l.qty;
        if (typeof l.amount === "number") { occ.value += l.amount; occ.valued = true; }
      });
    });

    const history = {};
    Object.keys(occasions).forEach(function (cid) {
      const list = Object.keys(occasions[cid]).map(function (k) {
        const o = occasions[cid][k];
        return {
          at: o.at,
          value: o.valued ? Math.round(o.value) : null,      // unknown stays unknown
          lines: Object.keys(o.qty).sort().map(function (p) { return { productId: p, qty: Math.round(o.qty[p]) }; }),
        };
      }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
      const ds = list.map(function (o) { return new Date(o.at + "T00:00:00Z").getTime(); }).sort(function (a, b) { return a - b; });
      const gaps = [];
      for (let i = 0; i + 1 < ds.length; i++) { const g = Math.round((ds[i + 1] - ds[i]) / DAY); if (g > 0) gaps.push(g); }
      gaps.sort(function (a, b) { return a - b; });
      const med = gaps.length
        ? (gaps.length % 2 ? gaps[(gaps.length - 1) / 2] : (gaps[gaps.length / 2 - 1] + gaps[gaps.length / 2]) / 2)
        : null;
      history[cid] = { avgCycleDays: med === null ? 30 : Math.max(1, Math.round(med)), orders: list };
    });

    return {
      seed: { products: products, b2b: b2b },
      history: history,
      presence: {
        invoices: !!(d.invoices && d.invoices.present && d.invoices.records.length),
        payments: !!(d.payments && d.payments.present && d.payments.records.length),
        cost: recs(d.products).some(function (p) { return typeof p.cost === "number"; }),
        stockQuantities: products.some(function (p) { return typeof p.systemStock === "number"; }),
      },
    };
  }

  const fromZoho = fromApp;   // the name the first provider gave it
  const API = { FILE_TYPES, EVIDENCE_TYPES, APPS, addEvidence, MAX_BYTES, readFile, classify, parseCsv, parseXlsx, extract, parseDate, fromFiles, fromApp, fromZoho, toEngine };
  root.FB_DATASET = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

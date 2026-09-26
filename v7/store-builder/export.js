/* Store Builder · the setup pack.

   Everything the owner gave, written the way the person setting up his store
   needs it: one Excel workbook, one sheet per thing to create on the
   platform, plus the photos and voice notes, plus setup.json (the whole
   session, so it can be reopened and continued). No libraries: a tiny ZIP
   writer and a tiny XLSX writer, both below.

   Two ways out:
     pack(...)      → a .zip  (workbook + photos + voice + setup.json)
     shareText(...) → one .txt of JSON with the media inside it, because
                      phones can share a .txt straight into WhatsApp and
                      cannot share a .zip. The same app opens either. */

(function (root) {
  "use strict";

  const M = typeof module !== "undefined" && module.exports ? require("./model.js") : root.SB_MODEL;
  const enc = new TextEncoder();

  /* ────────────────────────────────────────── zip (stored, no compression) */

  const CRC = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function dosTime(d) {
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
  }

  /* files: [{ name, data: Uint8Array|string }] → Uint8Array */
  function zip(files, when) {
    const t = dosTime(when || new Date());
    const parts = [];
    const central = [];
    let offset = 0;
    files.forEach(function (f) {
      const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
      const name = enc.encode(f.name);
      const crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true);         // UTF-8 names
      local.setUint16(8, 0, true);              // stored
      local.setUint16(10, t.time, true);
      local.setUint16(12, t.date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), name, data);

      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true);
      cen.setUint16(4, 20, true);
      cen.setUint16(6, 20, true);
      cen.setUint16(8, 0x0800, true);
      cen.setUint16(10, 0, true);
      cen.setUint16(12, t.time, true);
      cen.setUint16(14, t.date, true);
      cen.setUint32(16, crc, true);
      cen.setUint32(20, data.length, true);
      cen.setUint32(24, data.length, true);
      cen.setUint16(28, name.length, true);
      cen.setUint32(42, offset, true);
      central.push(new Uint8Array(cen.buffer), name);
      offset += 30 + name.length + data.length;
    });
    const cenSize = central.reduce(function (n, p) { return n + p.length; }, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cenSize, true);
    end.setUint32(16, offset, true);
    return concat(parts.concat(central, [new Uint8Array(end.buffer)]));
  }

  /* Reads the zips this file writes (stored entries). */
  function unzip(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let e = bytes.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error("not_zip");
    const count = dv.getUint16(e + 10, true);
    let p = dv.getUint32(e + 16, true);
    const out = {};
    for (let i = 0; i < count; i++) {
      const method = dv.getUint16(p + 10, true);
      const size = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true);
      const xlen = dv.getUint16(p + 30, true);
      const clen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nlen));
      const lnlen = dv.getUint16(off + 26, true);
      const lxlen = dv.getUint16(off + 28, true);
      const start = off + 30 + lnlen + lxlen;
      if (method === 0) out[name] = bytes.subarray(start, start + size);
      p += 46 + nlen + xlen + clen;
    }
    return out;
  }

  function concat(parts) {
    const n = parts.reduce(function (t, p) { return t + p.length; }, 0);
    const out = new Uint8Array(n);
    let o = 0;
    parts.forEach(function (p) { out.set(p, o); o += p.length; });
    return out;
  }

  /* ─────────────────────────────────────────────────────────── xlsx */

  function esc(v) {
    return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function colName(i) {
    let s = "";
    i++;
    while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }

  function sheetXml(rows) {
    const widths = [];
    rows.forEach(function (r) { r.forEach(function (v, i) { widths[i] = Math.min(60, Math.max(widths[i] || 8, String(v == null ? "" : v).length + 2)); }); });
    const cols = widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join("");
    const body = rows.map(function (r, ri) {
      const cells = r.map(function (v, ci) {
        if (v == null || v === "") return "";
        const ref = colName(ci) + (ri + 1);
        const style = ri === 0 ? ' s="1"' : "";
        if (typeof v === "number" && isFinite(v)) return '<c r="' + ref + '"' + style + "><v>" + v + "</v></c>";
        return '<c r="' + ref + '"' + style + ' t="inlineStr"><is><t xml:space="preserve">' + esc(v) + "</t></is></c>";
      }).join("");
      return '<row r="' + (ri + 1) + '">' + cells + "</row>";
    }).join("");
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      (cols ? "<cols>" + cols + "</cols>" : "") +
      "<sheetData>" + body + "</sheetData></worksheet>";
  }

  /* sheets: [{ name, rows: [[...]] }] → Uint8Array (.xlsx) */
  function xlsx(sheets) {
    const names = sheets.map(function (s, i) {
      return (s.name.replace(/[\[\]:*?\/\\]/g, " ").slice(0, 31)) || "Sheet" + (i + 1);
    });
    const files = [];
    files.push({ name: "[Content_Types].xml", data:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map(function (_, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join("") +
      "</Types>" });
    files.push({ name: "_rels/.rels", data:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      "</Relationships>" });
    files.push({ name: "xl/workbook.xml", data:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      names.map(function (n, i) { return '<sheet name="' + esc(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join("") +
      "</sheets></workbook>" });
    files.push({ name: "xl/_rels/workbook.xml.rels", data:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map(function (_, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join("") +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      "</Relationships>" });
    files.push({ name: "xl/styles.xml", data:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF1E7A46"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      "</styleSheet>" });
    sheets.forEach(function (s, i) { files.push({ name: "xl/worksheets/sheet" + (i + 1) + ".xml", data: sheetXml(s.rows) }); });
    return zip(files);
  }

  /* ───────────────────────────────────────────── what goes in the sheets */

  const DAY_EN = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
  /* The platform's own sub-role names (getAllStaff().subRoles). "Delivery
     Superwiser" is spelled the way the live tenant spells it. */
  const ROLE = { salesman: "Salesman", delivery: "Delivery", supervisor: "Delivery Superwiser", office: "Admin" };
  const PAY = { cash: "Cash", 7: "Credit 7 days", 15: "Credit 15 days", 30: "Credit 30 days" };
  const RATE = { normal: "Standard", wholesale: "Wholesale", special: "Special" };
  const HOW = { salesman: "Salesman visit", phone: "Phone call", whatsapp: "WhatsApp", self: "Orders himself (app)" };
  const SPEED = { fast: "Fast", med: "Medium", slow: "Slow" };
  const SRC = { contact: "Phone contacts", vcf: "Contacts file", typed: "Typed in meeting" };
  const TYPE = { distributor: "Distributor", superstockist: "Super stockist", wholesaler: "Wholesaler", cnf: "C&F agent", retailer: "Retailer" };

  function days(p) { return M.DAYS.filter(function (d) { return (p.days || []).indexOf(d) >= 0; }).map(function (d) { return DAY_EN[d]; }).join(", "); }
  function yn(v) { return v == null ? "" : v ? "Yes" : "No"; }
  function ext(mime) { return /png/.test(mime) ? "png" : /jpe?g/.test(mime) ? "jpg" : /webm/.test(mime) ? "webm" : /mp4|m4a|aac/.test(mime) ? "m4a" : /ogg/.test(mime) ? "ogg" : "bin"; }
  function paperFile(p) { return (p.kind === "voice" ? "voice/" : "photos/") + p.id + "." + ext(p.mime || ""); }
  function slug(s) { return String(s || "store").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 40) || "store"; }
  function isoDay(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  const PER = { kg: "Per kg", dozen: "Per dozen", tray30: "Per tray of 30", bunch: "Per bunch", piece: "Per piece", litre: "Per litre", pack: "Per pack" };
  /* A loose good is sold by its own unit (kg, dozen…); a pack by the case or the piece. */
  function unitName(it) { return it.loose ? PER[it.per] || it.per : it.unit === "case" ? "Case" : "Piece"; }

  function sheets(cat, s, now) {
    now = now || new Date();
    const st = s.store;
    const companies = M.companyList(cat, s).filter(function (c) { return s.companies[c.id]; });
    const its = M.chosenItems(cat, s);
    const shops = M.peopleOf(s, "shop");
    const sups = M.peopleOf(s, "supplier");
    const staff = M.peopleOf(s, "staff");
    const r = s.rules;
    const photoOf = {};
    s.papers.forEach(function (p) { if (p.kind === "photo") photoOf[p.id] = paperFile(p); });

    const out = [];

    out.push({ name: "Read me", rows: [
      ["FoodBridge store setup pack", ""],
      ["Store", st.name || "(no name yet)"],
      ["Made on", now.toLocaleString("en-IN")],
      ["Started on", s.startedAt ? new Date(s.startedAt).toLocaleString("en-IN") : ""],
      ["Products", its.length],
      ["Customers", shops.length],
      ["Suppliers", sups.length],
      ["Staff", staff.length],
      ["Photos and voice notes", s.papers.length],
      ["", ""],
      ["HOW TO READ THE SOURCE COLUMNS", ""],
      ["Catalogue — check on pack", "MRP came from the FoodBridge catalogue; confirm it on the pack before going live."],
      ["Owner", "The owner entered or changed it himself."],
      ["Worked out", "Calculated from the company rate he gave (price per ₹100 of MRP)."],
      ["Standard margin — confirm", "Not asked: calculated from MRP at the standard margin (buys at ₹" + M.DEFAULT_RULE.buy + ", sells at ₹" + M.DEFAULT_RULE.sell + " per ₹100 MRP). Confirm his real prices before going live."],
      ["Counted", "Counted in the godown during the meeting."],
      ["Owner said — confirm", "Said from memory. Do NOT load as an opening balance until confirmed (khata photo, or the customer confirms at first visit)."],
      ["GST", "By category, GST 2.0 slabs from 22 Sep 2025. Confirm with the store's accountant."],
      ["Barcode", "Real barcode of the pack, from Open Food Facts / Open Beauty Facts / Open Products Facts."],
      ["", ""],
      ["SET UP IN THIS ORDER", ""],
      ["1", "Store (sheet Store) and module switches (sheet Settings)"],
      ["2", "Staff logins (sheet Staff)"],
      ["3", "Products, units, tax and price lists (sheets Products, Companies)"],
      ["4", "Customers with areas, delivery days and price list (sheet Customers), then Suppliers"],
      ["5", "Opening stock and opening balances (only rows marked Counted, or confirmed)"],
      ["6", "Routes (sheet Routes)"],
      ["7", "Work through sheet To follow up during week one"],
    ] });

    out.push({ name: "Store", rows: [
      ["Field", "Value", "Source"],
      ["Store name (customers see this)", st.name, "Owner"],
      ["Owner name", st.owner, "Owner"],
      ["Login mobile (WhatsApp)", M.phone10(st.mobile), "Owner"],
      ["GST number", String(st.gst || "").toUpperCase(), st.gst ? (M.gstOk(st.gst) ? "Owner (format OK)" : "Owner (format looks wrong — check)") : ""],
      ["Business type", TYPE[st.type] || "", "Owner"],
      ["Makes or packs anything", yn(st.makes), "Owner"],
      ["Shop address", st.address, "Owner"],
      ["Shop location (lat, lng)", st.loc ? st.loc.lat.toFixed(6) + ", " + st.loc.lng.toFixed(6) : "", st.loc ? "Phone GPS" : ""],
      ["Map link", st.loc ? "https://maps.google.com/?q=" + st.loc.lat.toFixed(6) + "," + st.loc.lng.toFixed(6) : "", ""],
      ["Godown", st.godownSame == null ? "" : st.godownSame ? "Same as shop" : st.godownAddress, "Owner"],
      ["Areas served", (st.areas || []).join(", "), "Owner"],
      ["Shop photo (logo)", st.photo ? photoOf[st.photo] || "" : "", ""],
    ] });

    out.push({ name: "Companies", rows: [["Company", "Brands", "He buys at (per ₹100 MRP)", "He sells at (per ₹100 MRP)", "His margin %", "Rate source", "Supplied by", "Products chosen"]]
      .concat(companies.map(function (c) {
        const rule = s.companies[c.id];
        const brands = {};
        cat.items.forEach(function (x) { if (x.company === c.id) brands[x.brand] = 1; });
        const by = sups.filter(function (p) { return (p.companies || []).indexOf(c.id) >= 0; }).map(function (p) { return p.name; }).join(", ");
        const margin = rule.buy ? M.round2((rule.sell - rule.buy) / rule.buy * 100) : "";
        return [c.name, Object.keys(brands).join(", "), rule.buy, rule.sell, margin, rule.seen ? "Owner" : "Standard margin — confirm", by, its.filter(function (it) { return it.company === c.id; }).length];
      })) });

    out.push({ name: "Products", rows: [["Item ID", "Company", "Brand", "Product", "Pack", "Category", "HSN", "GST %", "MRP (₹)", "MRP source",
      "Sell price per piece (₹)", "Buy price per piece (₹)", "Price source", "Sells in", "Pieces per case", "Sell price per selling unit (₹)",
      "Selling speed", "Barcode", "Photo", "New item (not in catalogue)"]]
      .concat(its.map(function (it) {
        const c = M.companyById(cat, s, it.company);
        const catg = cat.categories[it.cat] || cat.categories.other;
        const t = it.touched || {};
        if (it.loose) {
          return [it.id, "", "", it.name + (it.hi ? " (" + it.hi + ")" : ""), unitName(it), catg.en, it.hsn, it.gst, "", "Loose — no MRP",
            it.sell != null ? it.sell : "", it.buy != null ? it.buy : "", it.sell != null || it.buy != null ? "Owner" : "Not given — ask",
            unitName(it), "", it.sell != null ? it.sell : "",
            SPEED[it.speed] || "", "", "", ""];
        }
        return [it.id, c ? c.name : "", it.brand, it.name, it.pack, catg.en, it.hsn, it.gst, it.mrp,
          it.custom || t.mrp ? "Owner" : "Catalogue — check on pack",
          it.sell, it.buy, t.sell || t.buy ? "Owner" : (s.companies[it.company] || {}).seen ? "Worked out" : "Standard margin — confirm",
          unitName(it), it.caseQty, M.unitPrice(it, "sell"),
          SPEED[it.speed] || "", it.barcode, it.photo ? photoOf[it.photo] || "" : it.img || "", it.custom ? "Yes" : ""];
      })) });

    out.push({ name: "Customers", rows: [["Customer ID", "Customer name", "Mobile", "Area", "Delivery days", "Payment", "Price list", "Big customer",
      "Orders by", "Owes now (₹)", "Owes — source", "Came from", "Note"]]
      .concat(shops.map(function (p) {
        return [p.id, p.name, M.phone10(p.phone), p.area || "", days(p), PAY[p.pay] || "", RATE[p.rate] || "Standard", p.big ? "Yes" : "",
          HOW[p.how] || "", p.owes ? Number(p.owes) : "", p.owes ? "Owner said — confirm" : "", SRC[p.src] || "", p.note || ""];
      })) });

    out.push({ name: "Suppliers", rows: [["Supplier ID", "Name", "Mobile", "Companies they supply", "His distributor code", "Their GST number",
      "Days to deliver", "He owes them (₹)", "Owes — source", "Came from"]]
      .concat(sups.map(function (p) {
        const cs = (p.companies || []).map(function (id) { const c = M.companyById(cat, s, id); return c ? c.name : id; }).join(", ");
        return [p.id, p.name, M.phone10(p.phone), cs, p.code || "", String(p.gst || "").toUpperCase(), p.lead || "",
          p.owe ? Number(p.owe) : "", p.owe ? "Owner said — confirm" : "", SRC[p.src] || ""];
      })) });

    out.push({ name: "Staff", rows: [["Staff ID", "Name", "Mobile (login)", "Platform role", "Days out", "Vehicle number", "Collects cash", "Came from"]]
      .concat(staff.map(function (p) {
        return [p.id, p.name, M.phone10(p.phone), ROLE[p.role] || "", days(p), p.vehicle || "", yn(p.cash), SRC[p.src] || ""];
      })) });

    const routeRows = [["Day", "Route (area)", "Stop", "Customer", "Mobile", "Staff out that day"]];
    M.routes(s).forEach(function (rt) {
      rt.shops.forEach(function (p, i) {
        routeRows.push([DAY_EN[rt.day], rt.area || "(no area)", i + 1, p.name, M.phone10(p.phone), rt.staff.map(function (x) { return x.name + " (" + (ROLE[x.role] || "?") + ")"; }).join(", ")]);
      });
    });
    out.push({ name: "Routes", rows: routeRows });

    out.push({ name: "Opening stock", rows: [["Item ID", "Product", "Pack", "Cases", "Loose pieces", "Total pieces", "Value at buy price (₹)", "Source"]]
      .concat(its.map(function (it) {
        const counted = it.stockCases != null || it.stockLoose != null;
        const total = counted ? (it.stockCases || 0) * it.caseQty + (it.stockLoose || 0) : "";
        return [it.id, it.name, it.loose ? unitName(it) : it.pack, counted ? it.stockCases || 0 : "", counted ? it.stockLoose || 0 : "", total,
          counted && it.buy != null ? M.round2(total * it.buy) : "", counted ? "Counted" : "Not counted — first Stock Audit"];
      })) });

    const bal = [["Party", "Type", "Amount (₹)", "Source"]];
    shops.forEach(function (p) { if (p.owes) bal.push([p.name, "Customer owes him (receivable)", Number(p.owes), "Owner said — confirm"]); });
    sups.forEach(function (p) { if (p.owe) bal.push([p.name, "He owes supplier (payable)", Number(p.owe), "Owner said — confirm"]); });
    out.push({ name: "Opening balances", rows: bal });

    const PAYM = { cash: "Cash", upi: "UPI", cheque: "Cheque", credit: "Credit (udhaar)" };
    out.push({ name: "Settings", rows: [
      ["Question", "Answer", "Platform setting"],
      ["Payment methods he accepts", (r.payMethods || []).map(function (m) { return PAYM[m]; }).join(", "), "paymentConfig.methods"],
      ["Allows part payment", yn(r.partPay), "paymentConfig.allowPartialPayment"],
      ["Delivers by fixed route days", yn(r.routes), "appProp.isRouteDeliveryEnabled"],
      ["Customers can order themselves (Store QR)", yn(r.selfOrder), "appProp.isStoreQrCode.isEnabled + storefront"],
      ["Order steps", r.steps === "simple" ? "Order → Delivered" : r.steps === "dispatch" ? "Order → Dispatched → Delivered (or Skipped)" : "", "globalSetting.orderWorkflow.statusWorkFlow.ORDER"],
      ["Tracks batch and expiry", yn(r.batches), "Product batches (ProductBatch)"],
      ["Returns and damages", { credit: "Takes back, gives credit", replace: "Replaces", none: "Does not take back" }[r.returns] || "", "Returns handling"],
      ["First thing he checks each morning", { orders: "Orders", money: "Money to collect", stock: "Stock", trucks: "Trucks and delivery" }[r.morning] || "", "Home screen focus / first recommendation"],
      ["Makes or packs anything", yn(st.makes), "storefrontMenus: Production and raw material on/off"],
    ] });

    out.push({ name: "Papers", rows: [["File", "Type", "Screen", "Time", "Note"]]
      .concat(s.papers.map(function (p) {
        return [paperFile(p), p.kind === "voice" ? "Voice note" : "Photo", p.step || "", new Date(p.at).toLocaleString("en-IN"), p.note || ""];
      })) });

    const GAP = {
      noName: "Store name", noMobile: "Login mobile", noGst: "GST number (missing or wrong format)", noLocation: "Shop location",
      noItems: "No products chosen", noMrp: "Products without MRP", noPrice: "Loose goods without a price", unsorted: "Contacts not sorted (customer / supplier / staff)",
      noShops: "No customers added", shopNoDay: "Customers without a delivery day", shopNoPhone: "Customers without a 10-digit mobile",
      shopNoArea: "Customers without an area", shopNoPay: "Customers without cash/credit", noDelivery: "No delivery person",
      staffNoRole: "Staff without a role", noSuppliers: "No suppliers", supNoCompany: "Suppliers not linked to a company",
notCounted: "Products not counted in stock",
      rulesOpen: "How-you-work questions not answered",
    };
    out.push({ name: "To follow up", rows: [["Screen", "What is missing", "How many"]]
      .concat(M.missing(cat, s).map(function (g) { return [g.step, GAP[g.key] || g.key, g.n]; })) });

    return out;
  }

  /* ─────────────────────────────────────────────────────────── the pack */

  function fileBase(s, now) {
    return "FoodBridge-Setup-" + slug(s.store.name) + "-" + isoDay(now || new Date());
  }

  /* blobs: { paperId: { bytes: Uint8Array, mime } } */
  function pack(cat, s, blobs, now) {
    now = now || new Date();
    const base = fileBase(s, now);
    const files = [
      { name: base + ".xlsx", data: xlsx(sheets(cat, s, now)) },
      { name: "setup.json", data: JSON.stringify({ kind: "foodbridge-store-builder", v: M.VERSION, catalogue: cat.version, at: now.toISOString(), state: s }, null, 1) },
      { name: "README.txt", data: "FoodBridge store setup pack for " + (s.store.name || "a new store") + ".\r\n\r\n" +
        "Open " + base + ".xlsx and start with the sheet 'Read me'.\r\n" +
        "photos/ and voice/ hold what the owner captured in the meeting; the sheet 'Papers' says which screen each came from.\r\n" +
        "setup.json reopens this whole session in Store Builder (menu → Open a setup file).\r\n" },
    ];
    s.papers.forEach(function (p) { if (blobs && blobs[p.id]) files.push({ name: paperFile(p), data: blobs[p.id].bytes }); });
    return { name: base + ".zip", bytes: zip(files, now) };
  }

  function b64(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return typeof btoa === "function" ? btoa(bin) : Buffer.from(bytes).toString("base64");
  }
  function unb64(str) {
    if (typeof atob !== "function") return new Uint8Array(Buffer.from(str, "base64"));
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function shareText(cat, s, blobs, now) {
    now = now || new Date();
    const media = {};
    s.papers.forEach(function (p) { if (blobs && blobs[p.id]) media[p.id] = { mime: blobs[p.id].mime, b64: b64(blobs[p.id].bytes) }; });
    return {
      name: fileBase(s, now) + ".txt",
      text: JSON.stringify({ kind: "foodbridge-store-builder", v: M.VERSION, catalogue: cat.version, at: now.toISOString(), state: s, media: media }),
    };
  }

  /* Any of the three files this app writes → { state, blobs }. */
  function read(bytes) {
    let json = null;
    const blobs = {};
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      const files = unzip(bytes);
      if (!files["setup.json"]) throw new Error("no_setup");
      json = JSON.parse(new TextDecoder().decode(files["setup.json"]));
      (json.state.papers || []).forEach(function (p) {
        const f = files[paperFile(p)];
        if (f) blobs[p.id] = { bytes: new Uint8Array(f), mime: p.mime };
      });
    } else {
      json = JSON.parse(new TextDecoder().decode(bytes));
      Object.keys(json.media || {}).forEach(function (id) { blobs[id] = { bytes: unb64(json.media[id].b64), mime: json.media[id].mime }; });
    }
    if (!json || json.kind !== "foodbridge-store-builder" || !json.state) throw new Error("not_setup");
    return { state: M.migrate(json.state), blobs: blobs };
  }

  const api = { zip: zip, unzip: unzip, crc32: crc32, xlsx: xlsx, sheets: sheets, pack: pack, shareText: shareText, read: read, paperFile: paperFile, fileBase: fileBase };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SB_EXPORT = api;
})(typeof window !== "undefined" ? window : globalThis);

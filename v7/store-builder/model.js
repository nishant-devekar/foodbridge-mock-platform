/* Store Builder · the model. Pure logic, no DOM: what is kept, and everything
   worked out from it (prices, routes, first orders, what is missing).
   The screens (app.js) and the export (export.js) both read from here, and
   the headless tests run it in node. */

(function (root) {
  "use strict";

  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const VERSION = 1;

  /* Per ₹100 of MRP: what the distributor pays, and what he sells to a shop
     for. One question per company instead of one per item. */
  const DEFAULT_RULE = { buy: 80, sell: 87 };

  const STEPS = ["store", "companies", "rates", "items", "people", "shops", "staff", "suppliers", "usual", "stock", "rules", "finish"];

  function blank() {
    return {
      v: VERSION,
      lang: null,
      startedAt: null,
      updatedAt: null,
      store: { name: "", owner: "", mobile: "", gst: "", type: "", makes: null, photo: null, loc: null, address: "", godownSame: null, godownAddress: "", areas: [] },
      companies: {},        // companyId -> { buy, sell }  (presence = he distributes it)
      customCompanies: [],  // [{ id, name, color }]
      items: {},            // itemId -> { mrp?, sell?, buy?, unit, caseQty?, speed, gst?, barcode, stockCases, stockLoose, touched:{} }
      customItems: {},      // itemId -> { name, brand, company, pack, mrp, caseQty, cat, photo, barcode }
      people: {},           // id -> person
      order: [],            // people ids in the order they were added
      usual: {},            // shopId -> { itemId: qty }
      rules: { payMethods: [], routes: null, selfOrder: null, partPay: null, returns: null, steps: null, batches: null, morning: null },
      skipped: {},          // step -> true when the owner said "none / later"
      papers: [],           // [{ id, kind: photo|voice, step, at, mime }]
    };
  }

  /* ─────────────────────────────── helpers ── */

  function uid(prefix) {
    return (prefix || "x") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  /* Only a mobile loses its +91 / 0: a landline keeps its STD code. */
  function phone10(raw) {
    let d = String(raw || "").replace(/\D/g, "");
    if (d.length === 12 && d.startsWith("91") && /[6-9]/.test(d[2])) d = d.slice(2);
    if (d.length === 11 && d.startsWith("0") && /[6-9]/.test(d[1])) d = d.slice(1);
    return d;
  }

  function phoneShow(raw) {
    const d = phone10(raw);
    return d.length === 10 ? d.slice(0, 5) + " " + d.slice(5) : String(raw || "");
  }

  const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  function gstOk(g) { return GSTIN_RE.test(String(g || "").toUpperCase().trim()); }

  function tomorrowDay(now) {
    const d = new Date(now || Date.now());
    d.setDate(d.getDate() + 1);
    return DAYS[(d.getDay() + 6) % 7];
  }

  /* ──────────────────────────── catalogue ── */

  function companyList(cat, s) {
    return cat.companies.concat(s.customCompanies || []);
  }

  function companyById(cat, s, id) {
    return companyList(cat, s).find(function (c) { return c.id === id; }) || null;
  }

  /* One item as the screens see it: catalogue row + custom row + his changes. */
  function item(cat, s, id) {
    const base = cat.items.find(function (x) { return x.id === id; }) || (s.customItems[id] ? Object.assign({ id: id, custom: true }, s.customItems[id]) : null);
    if (!base) return null;
    const mine = s.items[id] || {};
    const c = cat.categories[base.cat] || cat.categories.other;
    const rule = s.companies[base.company] || DEFAULT_RULE;
    const mrp = mine.mrp != null ? mine.mrp : base.mrp;
    const caseQty = mine.caseQty != null ? mine.caseQty : base.caseQty || 1;
    return {
      id: id,
      custom: !!base.custom,
      company: base.company,
      brand: base.brand,
      name: base.name,
      pack: base.pack,
      cat: base.cat,
      icon: c.icon,
      hsn: base.hsn || c.hsn,
      gst: mine.gst != null ? mine.gst : c.gst,
      mrp: mrp,
      caseQty: caseQty,
      sell: mine.sell != null ? mine.sell : (mrp ? round2(mrp * rule.sell / 100) : null),
      buy: mine.buy != null ? mine.buy : (mrp ? round2(mrp * rule.buy / 100) : null),
      unit: mine.unit || "case",
      speed: mine.speed || null,
      barcode: mine.barcode || base.barcode || "",
      stockCases: mine.stockCases != null ? mine.stockCases : null,
      stockLoose: mine.stockLoose != null ? mine.stockLoose : null,
      photo: base.photo || null,
      img: base.img || null,
      on: !!s.items[id],
      touched: mine.touched || {},
    };
  }

  function chosenItems(cat, s) {
    return Object.keys(s.items).map(function (id) { return item(cat, s, id); }).filter(Boolean);
  }

  /* Price of one selling unit (a piece, or a whole case). */
  function unitPrice(it, which) {
    const p = which === "buy" ? it.buy : it.sell;
    if (p == null) return null;
    return it.unit === "case" ? round2(p * it.caseQty) : p;
  }

  function search(cat, s, q, companyId) {
    const words = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
    const all = cat.items.concat(Object.keys(s.customItems).map(function (id) { return Object.assign({ id: id }, s.customItems[id]); }));
    return all.filter(function (x) {
      if (companyId && x.company !== companyId) return false;
      if (!words.length) return true;
      const hay = (x.name + " " + x.brand + " " + x.pack + " " + (cat.categories[x.cat] ? cat.categories[x.cat].en + " " + cat.categories[x.cat].hi : "")).toLowerCase();
      return words.every(function (w) { return hay.indexOf(w) >= 0; });
    }).map(function (x) { return x.id; });
  }

  /* A scanned barcode → the item it is: his own changes first, then the
     catalogue (every catalogue item carries its real barcode), then his new
     products. */
  function findBarcode(cat, s, code) {
    code = String(code || "").trim();
    if (!code) return null;
    for (const id in s.items) if (s.items[id].barcode === code) return id;
    const hit = cat.items.find(function (x) { return x.barcode === code; });
    if (hit) return hit.id;
    for (const id in s.customItems) if (s.customItems[id].barcode === code) return id;
    return null;
  }

  /* ─────────────────────────────── people ── */

  function addPerson(s, p) {
    const ph = phone10(p.phone);
    if (ph) {
      for (const id in s.people) if (phone10(s.people[id].phone) === ph) return { id: id, dup: true };
    }
    const id = uid("p");
    s.people[id] = Object.assign({ id: id, name: "", phone: "", type: null, src: "typed", at: Date.now() }, p, { id: id });
    s.order.push(id);
    return { id: id, dup: false };
  }

  function peopleOf(s, type) {
    return s.order.map(function (id) { return s.people[id]; }).filter(function (p) { return p && p.type === type; });
  }

  function unsorted(s) { return peopleOf(s, null); }

  /* vCard text (one or many cards) → [{ name, phone }]. Handles folded lines
     and the quoted-printable names Android's own export writes. */
  function parseVcf(text) {
    const unfolded = String(text || "").replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").replace(/=\n/g, "");
    const out = [];
    unfolded.split(/BEGIN:VCARD/i).slice(1).forEach(function (card) {
      let name = "", n = "", tel = "", mobile = "";
      card.split("\n").forEach(function (line) {
        const i = line.indexOf(":");
        if (i < 0) return;
        const key = line.slice(0, i).toUpperCase();
        let val = line.slice(i + 1).trim();
        if (/ENCODING=QUOTED-PRINTABLE/.test(key)) val = qp(val);
        if (key === "FN" || key.startsWith("FN;")) name = val;
        else if (key === "N" || key.startsWith("N;")) n = val.split(";").filter(Boolean).reverse().join(" ");
        else if (key.startsWith("TEL") || key.includes(".TEL")) {
          if (!tel) tel = val;
          if (!mobile && /CELL|MOBILE/.test(key)) mobile = val;
        }
      });
      const nm = (name || n).trim();
      const ph = mobile || tel;
      if (nm || ph) out.push({ name: nm || ph, phone: phone10(ph) || ph });
    });
    return out;
  }

  function qp(v) {
    try {
      const bytes = [];
      for (let i = 0; i < v.length; i++) {
        if (v[i] === "=" && /^[0-9A-F]{2}$/i.test(v.substr(i + 1, 2))) { bytes.push(parseInt(v.substr(i + 1, 2), 16)); i += 2; }
        else bytes.push(v.charCodeAt(i));
      }
      return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
    } catch (e) { return v; }
  }

  /* ─────────────────────────── worked out ── */

  function routes(s) {
    const shops = peopleOf(s, "shop");
    const staff = peopleOf(s, "staff");
    const out = [];
    DAYS.forEach(function (day) {
      const onDay = shops.filter(function (p) { return (p.days || []).indexOf(day) >= 0; });
      const areas = {};
      onDay.forEach(function (p) { const a = p.area || ""; (areas[a] = areas[a] || []).push(p); });
      Object.keys(areas).sort().forEach(function (a) {
        out.push({
          day: day,
          area: a,
          shops: areas[a],
          staff: staff.filter(function (st) { return (st.days || []).indexOf(day) >= 0; }),
        });
      });
    });
    return out;
  }

  function usualLines(cat, s, shopId) {
    const u = s.usual[shopId] || {};
    return Object.keys(u).filter(function (id) { return u[id] > 0 && s.items[id]; }).map(function (id) {
      const it = item(cat, s, id);
      const rate = unitPrice(it, "sell");
      return { item: it, qty: u[id], unit: it.unit, rate: rate, amount: rate != null ? round2(rate * u[id]) : null };
    });
  }

  /* The first day FoodBridge will have work for him: the next day, from
     tomorrow, on which any shop with a usual order gets a delivery. Tomorrow
     is often a Sunday; the first orders should not be empty because of it. */
  function firstDay(cat, s, now) {
    const shops = peopleOf(s, "shop").filter(function (p) { return (p.days || []).length && usualLines(cat, s, p.id).length; });
    const base = new Date(now || Date.now());
    for (let i = 1; i <= 7; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const day = DAYS[(d.getDay() + 6) % 7];
      if (shops.some(function (p) { return p.days.indexOf(day) >= 0; })) return { day: day, date: d };
    }
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    return { day: DAYS[(d.getDay() + 6) % 7], date: d };
  }

  /* The first morning's work: every shop delivered on that day which has a
     usual order becomes a draft order. That is what makes the store feel
     ready the first time he opens it. */
  function tomorrowOrders(cat, s, now) {
    const day = firstDay(cat, s, now).day;
    return peopleOf(s, "shop").filter(function (p) {
      return (p.days || []).indexOf(day) >= 0 && usualLines(cat, s, p.id).length;
    }).map(function (p) {
      const lines = usualLines(cat, s, p.id);
      return { shop: p, day: day, lines: lines, total: round2(lines.reduce(function (t, l) { return t + (l.amount || 0); }, 0)) };
    });
  }

  function money(s) {
    const owedToHim = peopleOf(s, "shop").reduce(function (t, p) { return t + (Number(p.owes) || 0); }, 0);
    const heOwes = peopleOf(s, "supplier").reduce(function (t, p) { return t + (Number(p.owe) || 0); }, 0);
    return { owedToHim: owedToHim, heOwes: heOwes };
  }

  /* How far each step is. `done` drives the tick on the home screen; `n` is
     the one number its row shows. Continue is never blocked by any of this. */
  function progress(cat, s) {
    const items = Object.keys(s.items).length;
    const shops = peopleOf(s, "shop");
    const staff = peopleOf(s, "staff");
    const sups = peopleOf(s, "supplier");
    const stars = shops.filter(function (p) { return p.big; });
    const usualCount = shops.filter(function (p) { return usualLines(cat, s, p.id).length; }).length;
    const counted = chosenItems(cat, s).filter(function (it) { return it.stockCases != null || it.stockLoose != null; }).length;
    const r = s.rules;
    const rulesAnswered = [r.payMethods.length > 0, r.routes != null, r.selfOrder != null, r.partPay != null, r.returns != null, r.steps != null, r.batches != null, r.morning != null].filter(Boolean).length;
    const sorted = s.order.filter(function (id) { return s.people[id] && s.people[id].type; }).length;
    return {
      store:     { done: !!(s.store.name && phone10(s.store.mobile).length === 10), n: null },
      companies: { done: Object.keys(s.companies).length > 0, n: Object.keys(s.companies).length },
      rates:     { done: Object.keys(s.companies).length > 0 && Object.keys(s.companies).every(function (k) { return s.companies[k].seen; }), n: Object.keys(s.companies).length },
      items:     { done: items > 0, n: items },
      people:    { done: sorted > 0 && unsorted(s).length === 0, n: sorted },
      shops:     { done: shops.length > 0 && shops.every(function (p) { return (p.days || []).length; }), n: shops.length },
      staff:     { done: staff.length > 0 && staff.every(function (p) { return p.role; }) || !!s.skipped.staff, n: staff.length },
      suppliers: { done: sups.length > 0 || !!s.skipped.suppliers, n: sups.length },
      usual:     { done: usualCount > 0 && stars.every(function (p) { return usualLines(cat, s, p.id).length; }), n: usualCount },
      stock:     { done: counted > 0 || !!s.skipped.stock, n: counted },
      rules:     { done: rulesAnswered === 8, n: rulesAnswered },
      finish:    { done: false, n: null },
    };
  }

  /* What is still missing, for the week-one follow-up. Each gap names the
     step that fixes it. */
  function missing(cat, s) {
    const gaps = [];
    function add(step, key, n) { if (n) gaps.push({ step: step, key: key, n: n }); }
    add("store", "noName", s.store.name ? 0 : 1);
    add("store", "noMobile", phone10(s.store.mobile).length === 10 ? 0 : 1);
    add("store", "noGst", gstOk(s.store.gst) ? 0 : 1);
    add("store", "noLocation", s.store.loc ? 0 : 1);
    add("items", "noItems", Object.keys(s.items).length ? 0 : 1);
    const its = chosenItems(cat, s);
    add("items", "noMrp", its.filter(function (it) { return !it.mrp; }).length);
    add("people", "unsorted", unsorted(s).length);
    const shops = peopleOf(s, "shop");
    add("shops", "noShops", shops.length ? 0 : 1);
    add("shops", "shopNoDay", shops.filter(function (p) { return !(p.days || []).length; }).length);
    add("shops", "shopNoPhone", shops.filter(function (p) { return phone10(p.phone).length !== 10; }).length);
    add("shops", "shopNoArea", shops.filter(function (p) { return !p.area; }).length);
    add("shops", "shopNoPay", shops.filter(function (p) { return p.pay == null; }).length);
    const staff = peopleOf(s, "staff");
    add("staff", "noDelivery", staff.some(function (p) { return p.role === "delivery"; }) ? 0 : 1);
    add("staff", "staffNoRole", staff.filter(function (p) { return !p.role; }).length);
    const sups = peopleOf(s, "supplier");
    add("suppliers", "noSuppliers", sups.length || s.skipped.suppliers ? 0 : 1);
    add("suppliers", "supNoCompany", sups.filter(function (p) { return !(p.companies || []).length; }).length);
    add("usual", "starNoUsual", shops.filter(function (p) { return p.big && !usualLines(cat, s, p.id).length; }).length);
    add("usual", "noStars", shops.length && !shops.some(function (p) { return p.big; }) ? 1 : 0);
    add("stock", "notCounted", its.filter(function (it) { return it.stockCases == null && it.stockLoose == null; }).length);
    add("rules", "rulesOpen", 8 - progress(cat, s).rules.n);
    return gaps;
  }

  /* Old saves keep working: anything missing is filled from a blank state. */
  function migrate(s) {
    const b = blank();
    if (!s || typeof s !== "object") return b;
    const out = Object.assign(b, s);
    out.store = Object.assign(blank().store, s.store || {});
    out.rules = Object.assign(blank().rules, s.rules || {});
    ["companies", "items", "customItems", "people", "usual", "skipped"].forEach(function (k) { if (!out[k] || typeof out[k] !== "object") out[k] = {}; });
    ["customCompanies", "order", "papers"].forEach(function (k) { if (!Array.isArray(out[k])) out[k] = []; });
    out.order = out.order.filter(function (id) { return out.people[id]; });
    Object.keys(out.people).forEach(function (id) { if (out.order.indexOf(id) < 0) out.order.push(id); });
    out.v = VERSION;
    return out;
  }

  const api = {
    DAYS: DAYS, STEPS: STEPS, VERSION: VERSION, DEFAULT_RULE: DEFAULT_RULE,
    blank: blank, migrate: migrate, uid: uid, round2: round2,
    phone10: phone10, phoneShow: phoneShow, gstOk: gstOk, tomorrowDay: tomorrowDay,
    companyList: companyList, companyById: companyById, item: item, chosenItems: chosenItems, unitPrice: unitPrice,
    search: search, findBarcode: findBarcode,
    addPerson: addPerson, peopleOf: peopleOf, unsorted: unsorted, parseVcf: parseVcf,
    routes: routes, usualLines: usualLines, firstDay: firstDay, tomorrowOrders: tomorrowOrders, money: money,
    progress: progress, missing: missing,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SB_MODEL = api;
})(typeof window !== "undefined" ? window : globalThis);

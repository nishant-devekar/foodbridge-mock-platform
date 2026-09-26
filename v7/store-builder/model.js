/* Store Builder · the model. Pure logic, no DOM: what is kept, and everything
   worked out from it (prices, routes, first orders, what is missing).
   The screens (app.js) and the export (export.js) both read from here, and
   the headless tests run it in node. */

(function (root) {
  "use strict";

  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const VERSION = 1;

  /* Per ₹100 of MRP: what the distributor pays, and what he sells to a shop
     for. Every product starts from this standard margin; he changes a
     product's own price where his differs. (Until 26 Sep 2026 a "Your rates"
     step asked for it once per company; old saves still carry those answers,
     marked `seen`, and they still price their products.) */
  const DEFAULT_RULE = { buy: 80, sell: 87 };

  /* 26 Sep 2026: Phone contacts, Customers, Staff and Suppliers are one step,
     "people": he brings contacts in once and tags each one. */
  const STEPS = ["store", "items", "people", "stock", "rules", "finish"];   // Usual orders went 26 Sep 2026 (owner)

  function blank() {
    return {
      v: VERSION,
      lang: null,
      startedAt: null,
      updatedAt: null,
      store: { name: "", owner: "", mobile: "", gst: "", type: "", makes: null, photo: null, loc: null, address: "", godownSame: null, godownAddress: "", areas: [] },
      companies: {},        // companyId -> { buy, sell, seen? }  (presence = he sells its products; kept by syncCompanies)
      customCompanies: [],  // [{ id, name, color }]
      items: {},            // itemId -> { mrp?, sell?, buy?, unit, caseQty?, speed, gst?, barcode, stockCases, stockLoose, touched:{} }
      customItems: {},      // itemId -> { name, brand, company, pack, mrp, caseQty, cat, photo, barcode }
      people: {},           // id -> person
      order: [],            // people ids in the order they were added
      usual: {},            // shopId -> { itemId: qty }; no longer asked (26 Sep 2026), kept so old saves open
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
    const mrp = base.loose ? null : mine.mrp != null ? mine.mrp : base.mrp;
    const caseQty = mine.caseQty != null ? mine.caseQty : base.caseQty || 1;
    return {
      id: id,
      custom: !!base.custom,
      company: base.company,
      brand: base.brand,
      name: base.name,
      hi: base.hi || "",
      pack: base.pack,
      cat: base.cat,
      icon: base.emoji || c.icon,
      loose: !!base.loose,     // sold per kg / dozen / …: no brand, no MRP, no case
      per: base.per || "",
      hsn: base.hsn || c.hsn,
      gst: mine.gst != null ? mine.gst : c.gst,
      mrp: mrp,
      caseQty: caseQty,
      sell: mine.sell != null ? mine.sell : (mrp ? round2(mrp * rule.sell / 100) : null),
      buy: mine.buy != null ? mine.buy : (mrp ? round2(mrp * rule.buy / 100) : null),
      unit: base.loose ? "piece" : mine.unit || "case",
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

  /* The companies he sells are the companies of the products he chose: a
     company arrives with its first product, at the standard margin, and
     leaves with its last. A rule he already gave is kept. */
  function syncCompanies(cat, s) {
    const need = {};
    Object.keys(s.items).forEach(function (id) {
      const base = cat.items.find(function (x) { return x.id === id; }) || s.customItems[id];
      if (base && base.company) need[base.company] = 1;
    });
    Object.keys(s.companies).forEach(function (k) { if (!need[k]) delete s.companies[k]; });
    Object.keys(need).forEach(function (k) { if (!s.companies[k]) s.companies[k] = { buy: DEFAULT_RULE.buy, sell: DEFAULT_RULE.sell }; });
    return s;
  }

  /* Products that left the catalogue (26 Sep 2026: everything but food) leave
     his list too, then the companies follow what is left. */
  function tidy(cat, s) {
    Object.keys(s.items).forEach(function (id) {
      if (!s.customItems[id] && !cat.items.some(function (x) { return x.id === id; })) delete s.items[id];
    });
    return syncCompanies(cat, s);
  }

  /* The aisle a category sits in, for "by type". */
  function aisleOf(cat, catId) {
    return (cat.aisles || []).find(function (a) { return a.cats.indexOf(catId) >= 0; }) || null;
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

  /* Words match a product's name, brand, pack, category or company, so
     "surf", "hul" and "detergent" all find Surf Excel. */
  function search(cat, s, q, companyId) {
    const words = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
    const all = cat.items.concat(Object.keys(s.customItems).map(function (id) { return Object.assign({ id: id }, s.customItems[id]); }));
    const byName = [], byKind = [];
    all.forEach(function (x) {
      if (companyId && x.company !== companyId) return;
      if (!words.length) { byName.push(x.id); return; }
      const own = (x.name + " " + (x.hi || "") + " " + (x.brand || "")).toLowerCase();
      const co = companyById(cat, s, x.company);
      const hay = own + " " + ((x.pack || "") + " " + (co ? co.name + " " + co.short : "") + " " +
        (cat.categories[x.cat] ? cat.categories[x.cat].en + " " + cat.categories[x.cat].hi : "")).toLowerCase();
      if (!words.every(function (w) { return hay.indexOf(w) >= 0; })) return;
      /* The product's own name first; things that only share its company or kind after. */
      (words.every(function (w) { return own.indexOf(w) >= 0; }) ? byName : byKind).push(x.id);
    });
    return byName.concat(byKind);
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

  /* A contact leaves for good: from the list, the order, and any usual order. */
  function removePerson(s, id) {
    delete s.people[id];
    delete s.usual[id];
    s.order = s.order.filter(function (x) { return x !== id; });
    return s;
  }

  /* A first guess from the name, to show as a hint while sorting. It never
     tags anyone by itself. Distributors save customers as "Gupta Kirana",
     suppliers as "… Agency", staff as "Raju Driver". */
  const GUESS = [
    ["staff", /\b(driver|salesman|sales ?man|helper|delivery|staff|munshi|accountant|loader|office)\b/i],
    ["supplier", /\b(agency|agencies|depot|distributors?|stockist|super ?stockist|c ?& ?f|cnf|wholesale|company|ltd|limited|pvt)\b/i],
    ["shop", /\b(kirana|store|stores|general|provision|provisions|mart|bhandar|dukan|medical|dairy|bakery|sweets|hotel|restaurant|dhaba|canteen|supermarket|traders|enterprises)\b/i],
  ];
  function guessType(name) {
    const hit = GUESS.find(function (g) { return g[1].test(String(name || "")); });
    return hit ? hit[0] : null;
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
    const counted = chosenItems(cat, s).filter(function (it) { return it.stockCases != null || it.stockLoose != null; }).length;
    const r = s.rules;
    const rulesAnswered = [r.payMethods.length > 0, r.routes != null, r.selfOrder != null, r.partPay != null, r.returns != null, r.steps != null, r.batches != null, r.morning != null].filter(Boolean).length;
    const sorted = s.order.filter(function (id) { return s.people[id] && s.people[id].type; }).length;
    return {
      store:     { done: !!(s.store.name && phone10(s.store.mobile).length === 10), n: null },
      items:     { done: items > 0, n: items },
      people:    { done: sorted > 0 && unsorted(s).length === 0 && shops.length > 0 && shops.every(function (p) { return (p.days || []).length; }) &&
                   (staff.length > 0 && staff.every(function (p) { return p.role; }) || !!s.skipped.staff) && (sups.length > 0 || !!s.skipped.suppliers),
                   n: sorted, shops: shops.length, staff: staff.length, suppliers: sups.length, left: unsorted(s).length },
      stock:     { done: counted > 0 || !!s.skipped.stock, n: counted },
      rules:     { done: rulesAnswered === 8, n: rulesAnswered },
      finish:    { done: false, n: null },
    };
  }

  /* What is still missing, for the week-one follow-up. Each gap names the
     step that fixes it. */
  function missing(cat, s) {
    const gaps = [];
    function add(step, key, n) {
      if (!n) return;
      const tab = { shops: "shop", staff: "staff", suppliers: "supplier" }[step];
      gaps.push(tab ? { step: "people", tab: tab, key: key, n: n } : { step: step, key: key, n: n });
    }
    add("store", "noName", s.store.name ? 0 : 1);
    add("store", "noMobile", phone10(s.store.mobile).length === 10 ? 0 : 1);
    add("store", "noGst", gstOk(s.store.gst) ? 0 : 1);
    add("store", "noLocation", s.store.loc ? 0 : 1);
    add("items", "noItems", Object.keys(s.items).length ? 0 : 1);
    const its = chosenItems(cat, s);
    add("items", "noMrp", its.filter(function (it) { return !it.loose && !it.mrp; }).length);
    add("items", "noPrice", its.filter(function (it) { return it.loose && it.sell == null; }).length);
    add("people", "unsorted", unsorted(s).length);   // tab: to sort (the default)
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
    phone10: phone10, phoneShow: phoneShow, gstOk: gstOk,
    companyList: companyList, companyById: companyById, item: item, syncCompanies: syncCompanies, tidy: tidy, aisleOf: aisleOf, chosenItems: chosenItems, unitPrice: unitPrice,
    search: search, findBarcode: findBarcode,
    addPerson: addPerson, removePerson: removePerson, guessType: guessType, peopleOf: peopleOf, unsorted: unsorted,
    routes: routes, money: money,
    progress: progress, missing: missing,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SB_MODEL = api;
})(typeof window !== "undefined" ? window : globalThis);

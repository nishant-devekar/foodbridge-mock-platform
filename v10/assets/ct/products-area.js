/* ==========================================================================
   CONTROL TOWER · PRODUCTS — the Finished Goods page's own rules, as the
   tower's incidents. (15 Oct 2026)

   Finished Goods is product-management's frozen discovery v7 page
   (modules/foodbridge-module-product-management/discovery/versions/v7). Its
   rules are reproduced here, one for one, so the tower and the page always
   name the same problems:

     hidden from customers   (server-rules.js readiness, Addendum 016 R1)
                             no unit · no price · no category
     needs attention         (product-query.js ATTENTION_TESTS, Addendum 017)
                             short for open orders · out of stock · selling
                             below cost · priced above MRP · one brand spelled
                             two ways · no HSN code

   Each product carries one tag, its worst (the tower's incident rule):
   Urgent  = it can't be sold or an order is short  (hidden, short, out)
   Needs work = it sells, but costs money or breaks an invoice
   On track = nothing to fix

   Fixes made in the tower are an overlay (`fixes`, by product id), never a
   change to the page's seed.

     build({ products, categories, demand, fixes }) → { items, byId, tiles, facts }

   Pure: no DOM, no storage, no clock. Runs under node.
   ========================================================================== */

(function (root) {
  "use strict";

  const HSN_RE = /^\d{4}(\d{2}){0,2}$/;
  const RESERVED = { DEFAULT: 1, "DEFAULT-SUB": 1, RETURNABLE: 1 };
  const norm = function (v) { return String(v == null ? "" : v).trim().toLowerCase(); };
  const pos = function (n) { return typeof n === "number" && n > 0; };
  const money = function (n) { return "₹" + (Math.round(n * 100) / 100).toLocaleString("en-IN", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); };

  /* The incidents, worst first. `fix` names the field the tower's fix pane edits. */
  const KINDS = {
    noUnit:     { tone: "ugly", label: "No unit",     lead: "Set its unit",      fix: "unit",     why: "Hidden from customers until it has a unit" },
    noPrice:    { tone: "ugly", label: "No price",    lead: "Set its price",     fix: "price",    why: "Hidden from customers until it has a price" },
    noCategory: { tone: "ugly", label: "No category", lead: "Pick its category", fix: "category", why: "Hidden from customers until it has a category" },
    short:      { tone: "ugly", label: "Short",       lead: "Count its stock",   fix: "stock",    why: "Open orders want more than the shelf holds" },
    out:        { tone: "ugly", label: "Out of stock",lead: "Count its stock",   fix: "stock",    why: "Nothing on the shelf to sell" },
    belowCost:  { tone: "bad",  label: "Below cost",  lead: "Fix its price",     fix: "price",    why: "Every one sold loses money" },
    aboveMrp:   { tone: "bad",  label: "Above MRP",   lead: "Fix its price",     fix: "price",    why: "Priced above the MRP printed on it" },
    brand:      { tone: "bad",  label: "Brand ×2",    lead: "Pick one spelling", fix: "brand",    why: "One brand spelled two ways splits your reports" },
    noHsn:      { tone: "bad",  label: "No HSN",      lead: "Add the HSN code",  fix: "hsn",      why: "An invoice needs the HSN code" },
  };
  const ORDER = ["noUnit", "noPrice", "noCategory", "short", "out", "belowCost", "aboveMrp", "brand", "noHsn"];

  function apply(p, f) {
    if (!f) return p;
    const q = Object.assign({}, p, { attributes: Object.assign({}, p.attributes || {}) });
    if (f.measurement !== undefined) q.measurement = f.measurement;
    if (f.price !== undefined) { q.price = f.price; q.priceMap = null; }
    if (f.categoryReference !== undefined) q.categoryReference = f.categoryReference;
    if (f.brand !== undefined) q.brand = f.brand;
    if (f.hsn !== undefined) q.attributes.taxClassificationCode = f.hsn;
    if (f.stock !== undefined) q.stock = f.stock;
    return q;
  }

  function build(input) {
    const cats = {};
    (input.categories || []).forEach(function (c) { cats[c.id] = c; });
    const demand = input.demand || {};
    const fixes = input.fixes || {};
    /* Every product, inactive ones too: the page holds a broken inactive product as well (its R3). */
    const products = (input.products || []).filter(Boolean).map(function (p) { return apply(p, fixes[p.id]); });
    const unitSets = {};
    products.forEach(function (p) { if (p.measurement) unitSets[p.measurement] = 1; });
    /* One brand, two spellings: the page's own test (lower-cased, trimmed). */
    const spell = {};
    products.forEach(function (p) { if (!p.brand) return; const k = norm(p.brand); (spell[k] = spell[k] || {})[p.brand] = ((spell[k] || {})[p.brand] || 0) + 1; });

    const items = products.map(function (p) {
      const m = String(p.measurement || "").trim();
      const units = m.split("-").filter(function (u) { return u && u !== "undefined"; });
      const price = pos(p.price) ? p.price : units[0] && p.priceMap && pos(p.priceMap[units[0]]) ? p.priceMap[units[0]] : undefined;
      const tax = p.tax === undefined || p.tax === null || p.tax === "" ? 0 : Number(p.tax);
      const priceIncl = price === undefined ? undefined : Math.round(price * (1 + tax / 100) * 100) / 100;
      const cat = p.categoryReference ? cats[p.categoryReference] : null;
      const mrp = pos(p.maxRetailPrice) ? p.maxRetailPrice : undefined;
      const cost = pos(p.costPrice) ? p.costPrice : undefined;
      const hsn = String((p.attributes && p.attributes.taxClassificationCode) || "").trim();
      const inOrders = demand[p.articleNumber] || 0;
      const stock = typeof p.stock === "number" ? p.stock : null;
      const variants = p.brand && spell[norm(p.brand)] ? Object.keys(spell[norm(p.brand)]) : [];

      /* The banner's rules hold for every product; Needs Attention reads the
         page's list, which is the active products. */
      const live = p.status !== "INACTIVE";
      const has = {
        noUnit: !units.length,
        noPrice: price === undefined,
        noCategory: !p.categoryReference || !cat || !!RESERVED[String(cat.name || "").toUpperCase()],
        short: live && stock !== null && inOrders > 0 && stock < inOrders,
        out: live && stock !== null && stock <= 0 && !(inOrders > 0 && stock < inOrders),
        belowCost: live && cost !== undefined && price !== undefined && price < cost - 0.005,
        aboveMrp: live && mrp !== undefined && priceIncl !== undefined && priceIncl > mrp + 0.005,
        brand: live && variants.length > 1,
        noHsn: live && !HSN_RE.test(hsn),
      };
      const issues = ORDER.filter(function (k) { return has[k]; }).map(function (k) {
        const K = KINDS[k];
        const detail = k === "short" ? inOrders + " in open orders, " + Math.max(0, stock) + " on the shelf"
          : k === "out" ? (stock < 0 ? "Stock reads " + stock + ": count it" : "None on the shelf")
          : k === "belowCost" ? "Sells " + money(price) + ", costs " + money(cost)
          : k === "aboveMrp" ? money(priceIncl) + " with GST, MRP " + money(mrp)
          : k === "brand" ? variants.map(function (v) { return "“" + v + "”"; }).join(" and ")
          : K.why;
        return { kind: k, tone: K.tone, label: K.label, lead: K.lead, fix: K.fix, why: K.why, detail: detail };
      });
      return {
        id: p.id, name: p.name || "Unnamed product", sku: p.articleNumber || "", brand: p.brand || "", unit: m, units: units,
        price: price, priceIncl: priceIncl, tax: tax, mrp: mrp, cost: cost, hsn: hsn, stock: stock, inOrders: inOrders,
        category: cat ? cat.name : "", categoryId: p.categoryReference || null, variants: variants,
        hidden: has.noUnit || has.noPrice || has.noCategory,
        issues: issues, lead: issues[0] || null, tone: issues[0] ? issues[0].tone : "good",
      };
    });
    const byId = {};
    items.forEach(function (x) { byId[x.id] = x; });

    const rowOf = function (x) {
      const l = x.lead;
      return { id: x.id, kind: "jproduct", title: x.name,
               note: l ? l.detail : [x.category, x.price !== undefined ? money(x.price) : ""].filter(Boolean).join(" · "),
               next: l ? l.lead : "",
               tag: l ? { type: l.kind, label: l.label, tone: l.tone } : null, stand: l ? null : "ok" };
    };
    const ugly = items.filter(function (x) { return x.tone === "ugly"; });
    const bad = items.filter(function (x) { return x.tone === "bad"; });
    const good = items.filter(function (x) { return x.tone === "good"; });
    const tile = function (label, word, list) { return { label: label, word: word, value: String(list.length), count: list.length, rows: list.map(rowOf) }; };
    return {
      items: items, byId: byId,
      units: Object.keys(unitSets).sort(),
      categories: (input.categories || []).filter(function (c) { return !RESERVED[String(c.name || "").toUpperCase()]; }),
      tiles: { good: tile("On track", "Ready to sell", good), bad: tile("Needs work", "Costs or invoices", bad), ugly: tile("Urgent", "Can't sell", ugly) },
      facts: {
        count: items.length,
        broken: items.filter(function (x) { return x.hidden; }).length,
        incomplete: items.filter(function (x) { return !x.hidden && x.issues.length; }).length,
      },
    };
  }

  const API = { build: build, KINDS: KINDS, HSN_RE: HSN_RE, money: money };
  root.CTProductsArea = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

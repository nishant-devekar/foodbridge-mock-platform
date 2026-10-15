// Discovery v7 (Addendum 015) — the product query behind v7's finder, shared by the discovery
// "server" (server-rules.js, which pages the table) and the workspace (fg-workspace.js, which needs
// the same answers for counts, Needs Attention, duplicates and "Select all N"). One definition, so
// the page the server returns and the counts the screen shows can never disagree.
//
// PROPOSED, not Development: Development's GET /products takes one category, one tag and a title
// (name / article number) and does not sort. Everything here beyond that — multi-select filters,
// search across barcode / brand / category, stock level, missing fields, catalogue membership,
// Needs Attention, smart rules, sort — is a proposed extension of that endpoint (and a
// facets/ids endpoint), recorded in Addendum 015 as a contract proposal. Nothing in Development
// calls this file (R5).

const PQ = (() => {
  const norm = (v) => String(v ?? "").trim().toLowerCase();

  const MISSING_TESTS = {
    tax: (p, i) => i.tax === null,
    category: (p, i) => !i.cat,
    barcode: (p) => !p.barcode,
    image: (p, i) => !i.hasImage,
    mrp: (p, i) => i.mrp === undefined,
  };
  // Addendum 017: only what costs money, breaks an invoice or loses an order — and has a fix.
  const HSN_RE = /^\d{4}(\d{2}){0,2}$/;
  const ATTENTION_TESTS = {
    shortForOrders: (p, i) => i.inOrders > 0 && (p.stock ?? 0) < i.inOrders,
    outOfStock: (p, i) => i.stockLvl === "out" || i.stockLvl === "negative",
    belowCost: (p, i) => i.cost !== undefined && i.price !== undefined && i.price < i.cost - 0.005,
    // MRP includes every tax; the stored price excludes GST (W-287), so compare the price with GST.
    aboveMrp: (p, i) => i.mrp !== undefined && i.priceIncl !== undefined && i.priceIncl > i.mrp + 0.005,
    brandVariants: (p, i) => i.brandVariant,
    hsn: (p, i) => !HSN_RE.test(i.hsn),
  };

  // ctx: { products, names, demand, catalogues }. Catalogue membership counts CUSTOMER catalogues
  // only (what a merchant manages), as v6 did.
  function build(ctx) {
    const { products, names, demand, catalogues } = ctx;
    const spellings = {};
    for (const p of products) if (p.brand) (spellings[norm(p.brand)] ??= new Map()).set(p.brand, ((spellings[norm(p.brand)] ?? new Map()).get(p.brand) ?? 0) + 1);
    const brandLabel = Object.fromEntries(Object.entries(spellings).map(([k, m]) => [k, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]]));
    const info = new Map();
    const infoFor = (p) => {
      const vm = PM.mapProduct.mapProductToListItem(p, false, names, demand);
      const tax = p.tax === undefined || p.tax === null || p.tax === "" ? null : Number(p.tax);
      const threshold = p.stockThreshold ?? 5;
      const stock = p.stock ?? 0;
      const inCats = catalogues.filter((c) => (c.products ?? []).some((e) => e.id === p.id));
      const custom = inCats.filter((c) => {
        const e = c.products.find((x) => x.id === p.id);
        // What the catalogue's customers pay is its offer (productService.applyCataloguePrice: offerPrice ?? price).
        const own = e.offerPrice ?? e.price;
        return p.price !== undefined && own !== undefined && Math.abs(own - p.price) > 0.005;
      });
      const cat = p.categoryReference ? names[p.categoryReference] : undefined;
      return {
        vm, tax, cat, catalogues: inCats, custom,
        price: vm.price,
        priceIncl: vm.price === undefined ? undefined : Math.round(vm.price * (1 + (tax ?? 0) / 100) * 100) / 100,
        cost: p.costPrice > 0 ? p.costPrice : undefined,
        hsn: String(p.attributes?.taxClassificationCode ?? "").trim(),
        mrp: p.maxRetailPrice > 0 ? p.maxRetailPrice : undefined,
        inOrders: demand[p.articleNumber] ?? 0,
        stockLvl: stock < 0 ? "negative" : stock === 0 ? "out" : stock <= threshold ? "low" : "in",
        hasImage: Boolean(p.thumbnailUrl || p.imagesReference?.length),
        brandVariant: Boolean(p.brand && spellings[norm(p.brand)]?.size > 1),
        hay: norm([p.name, p.articleNumber, p.barcode, p.brand, cat].filter(Boolean).join(" ")),
      };
    };
    for (const p of products) info.set(p.id, infoFor(p));

    // recent: { added, edited, priced } — the caller's own session sets (sent along with the query).
    function ruleTest(r, p, i, recent) {
      switch (r.field) {
        case "stock": return r.value === "" ? true : r.op === "lt" ? (p.stock ?? 0) < Number(r.value) : (p.stock ?? 0) > Number(r.value);
        case "category": return !r.value || p.categoryReference === r.value;
        case "tax": return r.op === "missing" ? i.tax === null : r.value === "" || i.tax === Number(r.value);
        case "missing": return !r.value || MISSING_TESTS[r.value](p, i);
        case "catalogue": return r.op === "none" ? i.catalogues.length === 0 : !r.value || i.catalogues.some((c) => c.id === r.value);
        case "customPrice": return i.custom.length > 0;
        case "edited": return Boolean(recent?.edited?.has(p.id));
        default: return true;
      }
    }
    function matches(p, query, recent) {
      const i = info.get(p.id);
      const f = query.f;
      if (!i) return false;
      if (query.q && !norm(query.q).split(/\s+/).filter(Boolean).every((t) => i.hay.includes(t))) return false;
      if (f.cats.length && !f.cats.includes(p.categoryReference)) return false;
      if (f.brands.length && !f.brands.includes(norm(p.brand))) return false;
      if (f.taxes.length && !f.taxes.includes(i.tax === null ? "missing" : String(i.tax))) return false;
      if (f.stock.length && !f.stock.includes(i.stockLvl)) return false;
      if (f.tags.length && !(p.tags ?? []).some((t) => f.tags.includes(t))) return false;
      if (f.catalogues.length && !i.catalogues.some((c) => f.catalogues.includes(c.id))) return false;
      if (f.missing.length && !f.missing.every((m) => MISSING_TESTS[m](p, i))) return false;
      if (f.priceMin !== "" && !(i.price >= Number(f.priceMin))) return false;
      if (f.priceMax !== "" && !(i.price <= Number(f.priceMax))) return false;
      if (f.attention && !ATTENTION_TESTS[f.attention](p, i)) return false;
      if (f.recent && !recent?.[f.recent]?.has(p.id)) return false;
      if (f.rules.length && !f.rules.every((r) => ruleTest(r, p, i, recent))) return false;
      return true;
    }
    function sortList(list, sort) {
      const { key, dir } = sort;
      const val = (p) => {
        const i = info.get(p.id);
        return key === "price" ? i.price ?? -Infinity : key === "stock" ? p.stock ?? 0 : key === "sku" ? norm(p.articleNumber) : key === "category" ? norm(i.cat) : key === "brand" ? norm(p.brand) : norm(p.name);
      };
      return list.sort((a, b) => (val(a) < val(b) ? -dir : val(a) > val(b) ? dir : 0));
    }
    return { info, infoFor, brandLabel, matches, ruleTest, sortList };
  }

  return { norm, HSN_RE, MISSING_TESTS, ATTENTION_TESTS, build };
})();

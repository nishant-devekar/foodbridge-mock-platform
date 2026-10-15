// Discovery "server" (Addendum 015). Discovery runs on Development's FRONTEND mock ApiClient
// (api-client/mock.ts, bundled in pm-core.js). That mock does not apply several of Development's
// BACKEND rules (Addendum 014 B1–B5), so screens built on it alone would break them. This wraps
// the mock so discovery data behaves like Development's backend. Every rule below ports a
// backend behaviour and names its source; the cited backend code stays the only source of truth.
//
//   productService.list            — list = members of the requested catalogue, RETURNABLE excluded,
//                                     the catalogue's prices overlaid (applyCataloguePrice)
//   productService.assertNotReservedCategory — DEFAULT / DEFAULT-SUB / RETURNABLE refused (400 RESERVED_CATEGORY)
//   productService.resolveStatus   — omitted status = ACTIVE; a DEFAULT-root category forces INACTIVE
//   productService.createInternal  — a colliding article number gets "-xxxxxx", never refused
//   productService.removeInternal  — delete keeps the document: unlink from non-MASTER catalogues,
//                                     clear the integration link (stock zeroing / image cleanup go
//                                     through host ports, which are no-ops with no host — createApp())
//   productService.bulkImport      — code-less row = create with AUTO-XXXXXXXX (Addendum 133), else upsert
//   integrationLink.withoutIntegrationLink — a request can't set the integration link
//   catalogueMembership.syncMembership — every create/edit refreshes each member catalogue (system
//                                     catalogues mirror the offer too; discount catalogues re-price,
//                                     116), keeps MASTER in step, and adds to / removes from DEFAULT or
//                                     RAW-MATERIAL by status; DEFAULT changes mirror into discount
//                                     catalogues (117). RAW-MATERIAL is system-managed (123, PR #4).
//   zohoItemSyncService (Addendum 119) — an item made inactive in Zoho deletes its product through delete
//
// The proposed v7 query (product-query.js) is answered here too, after the backend's own scoping.
//
// PROPOSED, not Development (Addendum 016 — sale readiness; an SSOT-01/02 change to ratify):
//   R1 sale-ready = a unit registered for the location + a positive base price + a valid category
//   R2 every write normalises boxes/pallets (missing/≤0 → 1) and tax (missing → 0; non-numeric or
//      outside 0–100 → 400 INVALID_TAX) — "default values, never falsy"
//   R3 an ACTIVE product that is not sale-ready is put on hold (`saleHold`): MASTER only — out of
//      DEFAULT (and so out of discount catalogues) and out of every other customer catalogue, whose
//      entries it remembers
//   R4 once sale-ready again it goes back into DEFAULT and exactly those catalogues
//   R5 a catalogue write can't add a product that isn't sale-ready (400 PRODUCT_NOT_SALE_READY)
//   R6 every write path goes through R1–R5; R7 a sweep holds existing broken products; R8 delete
//      clears the hold. Raw materials are not held yet (their screen has no "needs fix" view).
// Discovery-only (R5): nothing in Development depends on this file.

const DiscoveryServer = (() => {
  const RESERVED = new Set(["DEFAULT", "DEFAULT-SUB", "RETURNABLE"]);
  const LINK_KEYS = ["integrationLink", "externalId", "sourceId"];
  const upper = (s) => String(s ?? "").trim().toUpperCase();
  const randomSuffix = () => Math.random().toString(36).slice(2, 8);
  const autoArticleNumber = () => {
    let s = "";
    for (let i = 0; i < 8; i++) s += "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)];
    return `AUTO-${s}`;
  };
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withoutLink = (req) => Object.fromEntries(Object.entries(req ?? {}).filter(([k]) => !LINK_KEYS.includes(k)));
  const defined = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  class ReservedCategoryError extends Error {
    constructor(message) {
      super(message);
      this.code = "RESERVED_CATEGORY";
    }
  }

  // services/discountPricing.ts — verbatim maths (module Addendum 116 / 117).
  function discounted(price, discount) {
    const p = Number(price);
    const v = Number(discount?.value ?? 0);
    let out = p;
    if (discount?.mode === "percent") out = p * (1 - v / 100);
    else if (discount?.mode === "amount") out = Math.max(0, p - v);
    return Math.round(out * 100) / 100;
  }
  const baseUnitOf = (measurement, priceMap) => measurement?.split("-")[0] || Object.keys(priceMap ?? {})[0];
  function syncDiscountMap(rules, categoryChain, units) {
    const r = rules ?? {};
    const line = categoryChain.map((c) => r.lines?.find((l) => l.type === "category" && l.id === c)).find(Boolean);
    let win;
    if (line?.mode) win = line.mode === "none" ? { mode: "none" } : { mode: line.mode, value: line.value };
    else if (r.pct != null) win = { mode: "percent", value: r.pct };
    return win ? Object.fromEntries(units.map((u) => [u, { ...win }])) : {};
  }
  function discountedOfferFields(price, priceMap, measurement, discountMap) {
    const fields = {};
    if (price !== undefined) {
      const base = baseUnitOf(measurement, priceMap);
      fields.offerPrice = discounted(price, base ? discountMap[base] : undefined);
    }
    if (priceMap) fields.offerPriceMap = Object.fromEntries(Object.entries(priceMap).map(([u, p]) => [u, discounted(Number(p), discountMap[u])]));
    return fields;
  }

  function wrap(client, seed) {
    // The backend reads categories straight from the collection (categoryLookup.ts); the mock's
    // listCategories hides reserved ones, so the server keeps its own view of every category.
    const cats = new Map((seed.categories ?? []).map((c) => [c.id, { ...c }]));
    const catalogueIds = new Set((seed.catalogues ?? []).map((c) => c.id));
    const nameOf = (id) => cats.get(id)?.name;
    function rootName(id) {
      const seen = new Set();
      for (let c = id, i = 0; c && i < 10 && !seen.has(c); i++) {
        seen.add(c);
        const doc = cats.get(c);
        if (!doc) return null;
        if (!doc.parentCategoryReference) return doc.name ?? null;
        c = doc.parentCategoryReference;
      }
      return null;
    }
    const parentsMap = () => new Map([...cats.values()].map((c) => [c.id, c.parentCategoryReference || null]));
    function categoryChain(ref, parents) {
      const chain = [];
      for (let c = ref ?? null; c && parents.has(c) && !chain.includes(c); c = parents.get(c) ?? null) chain.push(c);
      return chain.length ? chain : ["_uncategorised"];
    }

    // getCatalogue returns the stored document, so entry writes below are the mock's own storage —
    // the discovery equivalent of the backend's `$set` / `$push` / `$pull` on catalogue.products.
    async function allCatalogues(locationId) {
      try {
        const { catalogues } = await client.listCatalogues(locationId, {});
        for (const c of catalogues) catalogueIds.add(c.id);
      } catch {}
      const docs = await Promise.all([...catalogueIds].map((id) => client.getCatalogue(id)));
      return docs.filter((d) => d && d.locationId === locationId);
    }
    const isSystem = (c) => c.catalogueType === "MASTER" || c.catalogueType === "RAW-MATERIAL" || (c.catalogueType === "CUSTOMER" && c.name === "DEFAULT");
    const docsFor = (docs, type) =>
      docs.filter((c) => (type === "DEFAULT" ? c.catalogueType === "CUSTOMER" && c.name === "DEFAULT" : type === "CUSTOMER" ? c.catalogueType === "CUSTOMER" : c.catalogueType === type));
    const refreshed = (p, sys) => defined(sys ? { price: p.price, offerPrice: p.price, priceMap: p.priceMap, offerPriceMap: p.priceMap } : { price: p.price, priceMap: p.priceMap });
    function upsertEntry(doc, p, sys) {
      doc.products ??= [];
      const entry = doc.products.find((e) => e.id === p.id);
      if (entry) return Object.assign(entry, refreshed(p, sys));
      doc.products.push(defined({ id: p.id, price: p.price, offerPrice: p.price, priceMap: p.priceMap, offerPriceMap: sys ? p.priceMap : p.offerPriceMap }));
    }
    const removeEntry = (doc, id) => (doc.products = (doc.products ?? []).filter((e) => e.id !== id));

    async function syncDiscountCatalogues(locationId, productIds, known) {
      const docs = await allCatalogues(locationId);
      const discountDocs = docs.filter((c) => c.catalogueType === "CUSTOMER" && c.discountRules != null);
      const def = docsFor(docs, "DEFAULT")[0];
      if (!discountDocs.length || !def) return;
      const inScope = (id) => !productIds || productIds.includes(id);
      const defaultEntries = new Map((def.products ?? []).map((e) => [e.id, e]));
      const parents = parentsMap();
      for (const doc of discountDocs) {
        const have = new Set((doc.products ?? []).map((e) => e.id));
        const missing = [...defaultEntries.keys()].filter((id) => inScope(id) && !have.has(id));
        const gone = [...have].filter((id) => inScope(id) && !defaultEntries.has(id));
        for (const id of missing) {
          const product = known?.id === id ? known : await client.getProduct(id);
          if (!product) continue;
          const { offerPrice: _o, offerPriceMap: _om, discountMap: _d, ...rest } = defaultEntries.get(id);
          const priceMap = rest.priceMap && typeof rest.priceMap === "object" ? rest.priceMap : undefined;
          const hasPrice = rest.price != null && rest.price !== "";
          const baseUnit = product.measurement?.split("-")[0];
          const units = priceMap && Object.keys(priceMap).length ? Object.keys(priceMap) : baseUnit && hasPrice ? [baseUnit] : [];
          const discountMap = syncDiscountMap(doc.discountRules, categoryChain(product.categoryReference, parents), units);
          (doc.products ??= []).push({ ...rest, ...discountedOfferFields(hasPrice ? Number(rest.price) : undefined, priceMap, product.measurement, discountMap), discountMap });
        }
        if (gone.length) doc.products = doc.products.filter((e) => !gone.includes(e.id));
      }
    }

    async function syncMembership(product, catalogueType, resolvedStatus) {
      const docs = await allCatalogues(product.locationId);
      for (const doc of docs) {
        const entry = (doc.products ?? []).find((e) => e.id === product.id);
        if (!entry) continue;
        const sys = isSystem(doc);
        Object.assign(entry, refreshed(product, sys));
        if (!sys && entry.discountMap) Object.assign(entry, defined(discountedOfferFields(product.price, product.priceMap, product.measurement, entry.discountMap)));
      }
      const master = docsFor(docs, "MASTER")[0];
      if (master) upsertEntry(master, product, true);
      if (catalogueType !== "DEFAULT" && catalogueType !== "RAW-MATERIAL") return;
      const target = docsFor(docs, catalogueType)[0];
      if (!target) return;
      if (resolvedStatus === "ACTIVE") upsertEntry(target, product, true);
      else removeEntry(target, product.id);
      if (catalogueType === "DEFAULT") await syncDiscountCatalogues(product.locationId, [product.id], product);
    }

    function assertNotReservedCategory(ref) {
      if (!ref) return;
      const name = nameOf(ref);
      if (name && RESERVED.has(upper(name))) throw new ReservedCategoryError(`categoryReference ${ref} resolves to reserved category "${name}"`);
    }
    function resolveStatus(requested, ref) {
      const resolved = requested ?? "ACTIVE";
      if (!ref) return resolved;
      const root = rootName(ref);
      return root && upper(root) === "DEFAULT" ? "INACTIVE" : resolved;
    }
    async function all(locationId) {
      return (await client.listProducts(locationId, {})).products;
    }
    const findByArticleNumber = async (code, locationId) => (await all(locationId)).find((p) => p.articleNumber === code);

    async function createInternal(locationId, request) {
      const req = normalizeWrite(withoutLink(request), true);
      assertNotReservedCategory(req.categoryReference);
      let articleNumber = req.articleNumber;
      if (await findByArticleNumber(articleNumber, locationId)) articleNumber = `${articleNumber}-${randomSuffix()}`;
      const status = resolveStatus(req.status, req.categoryReference);
      const product = await client.createProduct(locationId, { ...req, articleNumber, status });
      saveUnitIfNew(req.measurement);
      return settle(product, req.catalogueType ?? "DEFAULT", status);
    }
    async function edit(id, request) {
      const existing = await client.getProduct(id);
      if (!existing) throw new Error(`not found: ${id}`);
      const req = { ...storedFixes(existing), ...normalizeWrite(withoutLink(request), false) };
      const categoryReference = req.categoryReference ?? existing.categoryReference;
      assertNotReservedCategory(categoryReference);
      const status = resolveStatus(req.status ?? existing.status, categoryReference);
      const updated = await client.editProduct(id, { ...req, categoryReference, status });
      saveUnitIfNew(req.measurement);
      return settle(updated, req.catalogueType ?? "DEFAULT", status);
    }
    async function removeInternal(id) {
      const existing = await client.getProduct(id);
      if (!existing) throw new Error(`not found: ${id}`);
      for (const doc of await allCatalogues(existing.locationId)) if (doc.catalogueType !== "MASTER") removeEntry(doc, id);
      await client.editProduct(id, { externalId: "", sourceId: "" });
      const stored = await client.getProduct(id);
      if (stored) delete stored.saleHold; // R8
      return existing;
    }
    // Host unitMap stand-in (getUnitMap(locationId) is a host port): the unit sets the location's
    // products use; saveUnitIfNew registers a new one on create/edit, as the backend does.
    const unitSets = new Set((seed.products ?? []).map((p) => p.measurement).filter(Boolean));
    const saveUnitIfNew = (measurement) => measurement && unitSets.add(measurement);
    class ProductValidationError extends Error {
      constructor(message, code) {
        super(message);
        this.code = code;
      }
    }
    const positive = (v) => v !== null && v !== "" && Number.isFinite(Number(v)) && Number(v) > 0;
    // R2 — default values, never falsy.
    function normalizeWrite(req, isCreate) {
      const out = { ...req };
      for (const k of ["boxes", "pallets"]) if (isCreate || k in out) if (!positive(out[k])) out[k] = 1;
      if (isCreate || "tax" in out) {
        const t = out.tax;
        if (t === undefined || t === null || String(t).trim() === "") out.tax = 0;
        else {
          const n = Number(String(t).replace("%", "").trim());
          if (!Number.isFinite(n) || n < 0 || n > 100) throw new ProductValidationError(`GST rate must be a number from 0 to 100 (got "${t}")`, "INVALID_TAX");
          out.tax = n;
        }
      }
      return out;
    }
    // Stored values that R2 would never write (data from before the rule, or from another writer).
    function storedFixes(p) {
      const fix = {};
      for (const k of ["boxes", "pallets"]) if (!positive(p[k])) fix[k] = 1;
      if (p.tax === undefined || p.tax === null || String(p.tax).trim() === "") fix.tax = 0;
      return fix;
    }
    // R1 — what keeps a product from being sold, in the order a user fixes it.
    function readiness(p) {
      const reasons = [];
      const m = String(p.measurement ?? "").trim();
      const units = m.split("-").filter((u) => u && u !== "undefined");
      if (!units.length) reasons.push({ code: "NO_UNIT", label: "No unit" });
      else if (!unitSets.has(m)) reasons.push({ code: "UNIT_NOT_REGISTERED", label: `Unit “${m}” isn't set up for this location` });
      if (!(positive(p.price) || (units[0] && positive(p.priceMap?.[units[0]])))) reasons.push({ code: "NO_PRICE", label: "No price" });
      const cat = p.categoryReference ? cats.get(p.categoryReference) : null;
      if (!p.categoryReference) reasons.push({ code: "NO_CATEGORY", label: "No category" });
      else if (!cat) reasons.push({ code: "NO_CATEGORY", label: "Its category was deleted" });
      else if (RESERVED.has(upper(cat.name))) reasons.push({ code: "NO_CATEGORY", label: `Reserved category “${cat.name}”` });
      return reasons;
    }
    const merchantCatalogue = (c) => c.catalogueType === "CUSTOMER" && c.name !== "DEFAULT" && c.discountRules == null;
    // R3 / R4 — after the backend's own catalogue sync, hold or release the product.
    async function settle(product, catalogueType, status) {
      if (catalogueType === "RAW-MATERIAL") {
        await syncMembership(product, catalogueType, status);
        return product;
      }
      // Whatever the status: development keeps an INACTIVE product in the customer catalogues it was
      // in (only DEFAULT drops it), and catalogue membership is what an order reads — so a broken
      // INACTIVE product is held too, and a fix releases it into those catalogues (not DEFAULT).
      const reasons = readiness(product);
      const held = reasons.length > 0;
      await syncMembership(product, catalogueType, held ? "ON_HOLD" : status);
      const stored = await client.getProduct(product.id);
      const docs = await allCatalogues(product.locationId);
      if (held) {
        const taken = [];
        for (const doc of docs.filter(merchantCatalogue)) {
          const e = (doc.products ?? []).find((x) => x.id === product.id);
          if (e) (taken.push({ catalogueId: doc.id, entry: { ...e } }), removeEntry(doc, product.id));
        }
        stored.saleHold = { reasons, heldEntries: [...(stored.saleHold?.heldEntries ?? []), ...taken], since: stored.saleHold?.since ?? new Date().toISOString() };
      } else if (stored.saleHold) {
        for (const { catalogueId, entry } of stored.saleHold.heldEntries ?? []) {
          const doc = docs.find((d) => d.id === catalogueId);
          if (doc && !(doc.products ?? []).some((x) => x.id === product.id)) (doc.products ??= []).push({ ...entry, ...refreshed(stored, false) });
        }
        delete stored.saleHold;
      }
      return stored;
    }
    // R5 — what a catalogue write may add.
    async function assertCatalogueProductsReady(catalogueId, products) {
      if (!products) return;
      const doc = catalogueId ? await client.getCatalogue(catalogueId) : null;
      const have = new Set((doc?.products ?? []).map((e) => e.id));
      const bad = [];
      for (const e of products) {
        if (have.has(e.id)) continue;
        const p = await client.getProduct(e.id);
        if (!p) continue;
        const reasons = readiness(p);
        if (reasons.length || p.saleHold) bad.push(`${p.name} (${(reasons.length ? reasons : p.saleHold.reasons).map((r) => r.label.toLowerCase()).join(", ")})`);
      }
      if (bad.length) throw new ProductValidationError(`Can't add products that aren't ready to sell: ${bad.join("; ")}`, "PRODUCT_NOT_SALE_READY");
    }
    const errorPayload = (error) => ({ message: error instanceof Error ? error.message : String(error), ...(error?.code ? { code: error.code } : {}) });

    // The backend's list, then (discovery-only) the proposed v7 query on top of the same scope.
    async function list(locationId, query = {}) {
      // PROPOSED (Addendum 016): the products on hold — "needs fix" — with what keeps each from being sold.
      if (query.held) {
        const held = (await all(locationId)).filter((p) => p.saleHold).map((p) => ({ ...p, saleHold: { ...p.saleHold, reasons: readiness(p) } }));
        return { products: held, totalDoc: held.length };
      }
      let products = await all(locationId);
      let prices;
      if (query.catalogueType) {
        const docs = docsFor(await allCatalogues(locationId), query.catalogueType);
        const ids = new Set(docs.flatMap((d) => (d.products ?? []).map((e) => e.id)));
        products = products.filter((p) => ids.has(p.id));
        prices = new Map((docs[0]?.products ?? []).map((e) => [e.id, e]));
      }
      const excluded = new Set([...cats.values()].filter((c) => c.locationId === locationId && upper(c.name) === "RETURNABLE").map((c) => c.id));
      products = products.filter((p) => !excluded.has(p.categoryReference));
      if (query.category) products = products.filter((p) => p.categoryReference === query.category);
      if (query.title) {
        const re = new RegExp(escapeRegExp(query.title), "i");
        products = products.filter((p) => re.test(p.name ?? "") || re.test(p.articleNo ?? "") || re.test(p.articleNumber ?? ""));
      }
      if (query.tag) products = products.filter((p) => (p.tags ?? []).includes(query.tag));
      if (prices && prices.size) {
        products = products.map((p) => {
          const e = prices.get(p.id);
          if (!e) return p;
          const next = { ...p };
          const eff = e.offerPrice ?? e.price;
          if (eff != null) next.price = eff;
          if (e.priceMap && Object.keys(e.priceMap).length) next.priceMap = e.priceMap;
          if (e.offerPriceMap && Object.keys(e.offerPriceMap).length) next.offerPriceMap = e.offerPriceMap;
          return next;
        });
      }
      if (query.v7) products = await applyV7Query(locationId, products, query.v7);
      const totalDoc = products.length;
      if (query.page && query.limit) products = products.slice((query.page - 1) * query.limit, query.page * query.limit);
      return { products, totalDoc };
    }
    // PROPOSED (Addendum 015): v7's finder as server-side query parameters on GET /products.
    async function applyV7Query(locationId, products, v7) {
      const [tree, demand, docs] = await Promise.all([client.listCategories(locationId), client.getStockDemand(locationId), allCatalogues(locationId)]);
      const engine = PQ.build({ products, names: PM.mapProduct.categoryNameMap(tree), demand, catalogues: docs.filter((d) => d.catalogueType === "CUSTOMER") });
      const recent = Object.fromEntries(Object.entries(v7.recent ?? {}).map(([k, ids]) => [k, new Set(ids)]));
      let out = products;
      if (v7.onlyIds) out = out.filter((p) => v7.onlyIds.includes(p.id));
      if (v7.query) out = out.filter((p) => engine.matches(p, v7.query, recent));
      if (v7.sort) out = engine.sortList(out.slice(), v7.sort);
      return out;
    }

    const server = Object.create(client);
    Object.assign(server, {
      ReservedCategoryError,
      readiness,
      listProducts: (locationId, query) => list(locationId, query),
      exportProducts: async (locationId, query = {}) => (await list(locationId, { ...query, page: undefined, limit: undefined })).products,
      createProduct: (locationId, request) => createInternal(locationId, request),
      editProduct: (id, request) => edit(id, request),
      async toggleProductStatus(id, visible) {
        const existing = await client.getProduct(id);
        if (!existing) throw new Error(`not found: ${id}`);
        const status = resolveStatus(visible ? "ACTIVE" : "INACTIVE", existing.categoryReference);
        const updated = await client.editProduct(id, { status });
        return settle(updated, "DEFAULT", status);
      },
      async deleteProduct(id) {
        await removeInternal(id);
      },
      async bulkEditProducts(items) {
        const results = [];
        for (const { id, ...request } of items) {
          try {
            results.push({ id, status: "ok", product: await edit(id, request) });
          } catch (error) {
            results.push({ id, status: "error", error: errorPayload(error) });
          }
        }
        return results;
      },
      async bulkDeleteProducts(ids) {
        const results = [];
        for (const id of ids) {
          try {
            await removeInternal(id);
            results.push({ id, status: "ok" });
          } catch (error) {
            results.push({ id, status: "error", error: errorPayload(error) });
          }
        }
        return results;
      },
      async bulkImportProducts(locationId, rows) {
        const results = [];
        for (const row of rows) {
          try {
            if (!row.articleNumber || !String(row.articleNumber).trim()) {
              let code = autoArticleNumber();
              for (let i = 1; (await findByArticleNumber(code, locationId)) && i < 5; i++) code = autoArticleNumber();
              if (await findByArticleNumber(code, locationId)) throw new Error("Could not make a new article number. Try again.");
              const created = await createInternal(locationId, { ...row, articleNumber: code });
              results.push({ id: created.id, status: "ok", product: created });
              continue;
            }
            const existing = await findByArticleNumber(row.articleNumber, locationId);
            let product = existing ? await edit(existing.id, row) : await createInternal(locationId, row);
            if (existing && row.stock !== undefined) {
              const stored = await client.getProduct(product.id);
              if (stored) stored.stock = row.stock; // repo.update — the one write that may set stock on an existing row
              product = stored ?? product;
            }
            results.push({ id: product.id, status: "ok", product });
          } catch (error) {
            results.push({ id: row.articleNumber, status: "error", error: errorPayload(error) });
          }
        }
        return results;
      },
      async createCategory(locationId, input) {
        const created = await client.createCategory(locationId, input);
        if (created?.id) cats.set(created.id, { ...created });
        return created;
      },
      async deleteCategory(id) {
        await client.deleteCategory(id);
        const loc = cats.get(id)?.locationId;
        cats.delete(id);
        // R6: products filed under it can no longer be sold until re-filed.
        if (loc) for (const p of await all(loc)) if (p.categoryReference === id) await settle(p, "DEFAULT", p.status);
      },
      async createCatalogue(locationId, input) {
        await assertCatalogueProductsReady(null, input?.products);
        return client.createCatalogue(locationId, input);
      },
      async updateCatalogue(id, input) {
        await assertCatalogueProductsReady(id, input?.products);
        return client.updateCatalogue(id, input);
      },
      // R7 — the one-time sweep over existing data: normalise R2's fields, then hold what can't be sold.
      async sweepSaleReadiness(locationId) {
        let held = 0;
        for (const p of await all(locationId)) {
          const fix = storedFixes(p);
          const cur = Object.keys(fix).length ? await client.editProduct(p.id, fix) : p;
          const settled = await settle(cur, "DEFAULT", cur.status);
          if (settled.saleHold) held++;
        }
        return { held };
      },
      // Host port stand-in: getUnitMap(locationId) is wired by the host (CLAUDE.md "Host ports"; with no
      // host the module offers no units). The discovery host answers with the unit sets its products use.
      async getUnitOptions() {
        return Object.fromEntries([...unitSets].map((m) => [m, m.split("-")]));
      },
      // catalogueMembership.syncDiscountCatalogues (117) — what the backend runs for the discount owner.
      syncDiscountCatalogues: (locationId, productIds) => syncDiscountCatalogues(locationId, productIds),
      // Addendum 119: an item made inactive in Zoho deletes its linked product, through the same delete.
      async startZohoSync(...args) {
        const res = await client.startZohoSync(...args);
        if (res?.started !== false) {
          for (const code of seed.zohoSync?.deactivatedArticleNumbers ?? []) {
            const p = await findByArticleNumber(code, seed.locationId ?? args[0]);
            if (p) await removeInternal(p.id).catch(() => {});
          }
        }
        return res;
      },
    });
    return server;
  }

  return { wrap };
})();

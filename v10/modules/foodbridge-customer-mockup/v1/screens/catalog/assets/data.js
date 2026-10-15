/*
 * Seed data for the Products Directory discovery prototype (v1).
 * Modelled on the live "Murli" storefront-admin screens (water + bakery
 * distribution) so the HTML replica shows the same rows, categories and
 * product-detail fields as the real app.
 *
 * Shapes mirror what the React pages consume:
 *   products     → Products.jsx / ProductTable.jsx / ProductDetails.jsx
 *   categories   → Category.jsx / CategoryTableCollapse.jsx
 *   rawMaterials → RawMaterials.jsx
 * Prices are base (tax-exclusive) INR; sellingInclTax is derived for display.
 * Loaded as a plain script (window.SEED) so screens open over file:// with no
 * fetch/CORS setup.
 */
(function () {
  const inclTax = (price, rate) => Math.round(price * (1 + rate / 100) * 100) / 100;

  // Water/soda products come in Bottle (smallest) → Box (base, ×5); bread in Pc.
  const bottle = (o) => ({
    unit: "Bottle", baseUnit: "Box", conversionQty: 5, brand: o.brand || "Murli",
    packaging: [
      { unit: "Bottle", tag: "Smallest Unit", conv: "1 Bottle", price: inclTax(o.price, o.taxRate) },
      { unit: "Box", tag: "Base Unit", conv: "1 Box = 5 Bottle", price: inclTax(o.price, o.taxRate) * 5 },
    ],
    ...o,
  });
  const piece = (o) => ({
    unit: "Pc", baseUnit: "Pc", conversionQty: 1, brand: o.brand || "Murli Bakers",
    packaging: [{ unit: "Pc", tag: "Smallest Unit", conv: "1 Pc", price: inclTax(o.price, o.taxRate) }],
    ...o,
  });

  const products = [
    bottle({ id: "p-1", name: "250ml Pet", articleNo: "34567", category: "Square Bottle", categoryTop: "Water", img: "water,bottle", price: 10, taxRate: 5, stockTotal: 2800, canSell: 603, inOrders: 2197, barcode: "12345", brand: "rsquare", active: true, highMargin: true, description: "Bottle Shape - Square, High quality plastic used Packed drinking water" }),
    bottle({ id: "p-2", name: "500ml Pet", articleNo: "89744", category: "Square Bottle", categoryTop: "Water", img: "water,bottle", price: 15, taxRate: 5, stockTotal: 2782, canSell: 2575, inOrders: 207, barcode: "89744", active: true, highMargin: true, description: "500ml square PET packed drinking water bottle." }),
    bottle({ id: "p-3", name: "1ltr Bottle", articleNo: "42534", category: "Square Bottle", categoryTop: "Water", img: "water,bottle", price: 20, taxRate: 5, stockTotal: 2775, canSell: 2704, inOrders: 71, barcode: "42534", active: true, highMargin: true, description: "1 litre square PET packed drinking water bottle." }),
    bottle({ id: "p-4", name: "Natural Water", articleNo: "4534", category: "Round Bottle", categoryTop: "Water", img: "mineral,water", price: 60, taxRate: 18, stockTotal: 2627, canSell: 2592, inOrders: 35, barcode: "4534", active: true, description: "Premium natural mineral water, round bottle." }),
    bottle({ id: "p-5", name: "Soda 650ml", articleNo: "435345", category: "Round Bottle", categoryTop: "Soda", img: "soda,bottle", price: 20, taxRate: 5, stockTotal: 2607, canSell: 2519, inOrders: 88, barcode: "435345", active: true, description: "650ml carbonated soda, round bottle." }),

    piece({ id: "p-6", name: "Mini Bread 100gm", articleNo: "a102", category: "Bread", categoryTop: "Bread", img: "bread,loaf", price: 8, taxRate: 0, stockTotal: 0, canSell: 0, inOrders: 0, barcode: "a102", active: true, description: "Soft mini bread loaf, 100gm." }),
    piece({ id: "p-7", name: "Milk Bread 200gm", articleNo: "a103", category: "Bread", categoryTop: "Bread", img: "milk,bread", price: 15, taxRate: 0, stockTotal: 62, canSell: 10, inOrders: 52, barcode: "a103", active: true, highMargin: true, description: "Milk bread loaf, 200gm." }),
    piece({ id: "p-8", name: "Milk Bread 350gm", articleNo: "a104", category: "Bread", categoryTop: "Bread", img: "milk,bread", price: 25, taxRate: 0, stockTotal: 82, canSell: 61, inOrders: 21, barcode: "a104", active: true, highMargin: true, description: "Milk bread loaf, 350gm." }),
    piece({ id: "p-9", name: "Brown Bread 250gm", articleNo: "a105", category: "Bread", categoryTop: "Bread", img: "brown,bread", price: 24, taxRate: 0, stockTotal: 91, canSell: 80, inOrders: 11, barcode: "a105", active: true, description: "Whole-wheat brown bread, 250gm." }),
    piece({ id: "p-10", name: "Brown Bread 350gm", articleNo: "a106", category: "Bread", categoryTop: "Bread", img: "brown,bread", price: 40, taxRate: 0, stockTotal: 99, canSell: 93, inOrders: 6, barcode: "a106", active: true, highMargin: true, description: "Whole-wheat brown bread, 350gm." }),
    piece({ id: "p-11", name: "Kaju Bread 160gm", articleNo: "a107", category: "Bread", categoryTop: "Bread", img: "bread", price: 16, taxRate: 0, stockTotal: 95, canSell: 90, inOrders: 5, barcode: "a107", active: true, highMargin: true, description: "Cashew (kaju) bread, 160gm." }),
    piece({ id: "p-12", name: "Vanilla Sponge Cake", articleNo: "c201", category: "Cake", categoryTop: "Cake", img: "vanilla,cake", price: 220, taxRate: 5, stockTotal: 40, canSell: 34, inOrders: 6, barcode: "c201", active: true, description: "Vanilla sponge cake, 500gm." }),
    piece({ id: "p-13", name: "Choco Truffle Cake", articleNo: "c202", category: "Cake", categoryTop: "Cake", img: "chocolate,cake", price: 380, taxRate: 5, stockTotal: 24, canSell: 18, inOrders: 6, barcode: "c202", active: true, highMargin: true, description: "Rich chocolate truffle cake, 1kg." }),
    piece({ id: "p-14", name: "Butter Cookies 200gm", articleNo: "k301", category: "Cookies", categoryTop: "Cookies", img: "butter,cookies", price: 60, taxRate: 12, stockTotal: 140, canSell: 132, inOrders: 8, barcode: "k301", active: true, description: "Crisp butter cookies, 200gm pack." }),
    piece({ id: "p-15", name: "Choco Chip Cookies", articleNo: "k302", category: "Cookies", categoryTop: "Cookies", img: "chocolate,cookies", price: 75, taxRate: 12, stockTotal: 118, canSell: 110, inOrders: 8, barcode: "k302", active: true, description: "Chocolate chip cookies, 200gm pack." }),
    piece({ id: "p-16", name: "Classic Cream Roll", articleNo: "r401", category: "Cream Roll", categoryTop: "Cream Roll", img: "cream,roll", price: 20, taxRate: 5, stockTotal: 90, canSell: 84, inOrders: 6, barcode: "r401", active: true, description: "Flaky cream roll, single piece." }),
    piece({ id: "p-17", name: "Choco Donut", articleNo: "d501", category: "Donut", categoryTop: "Donut", img: "donut", price: 35, taxRate: 5, stockTotal: 60, canSell: 52, inOrders: 8, barcode: "d501", active: true, description: "Chocolate-glazed donut." }),
    piece({ id: "p-18", name: "Veg Sandwich", articleNo: "s601", category: "Sandwitch", categoryTop: "Sandwitch", img: "sandwich", price: 45, taxRate: 5, stockTotal: 30, canSell: 26, inOrders: 4, barcode: "s601", active: true, description: "Grilled vegetable sandwich." }),
  ];

  // Root categories (as shown on the live Categories screen). productCount is the
  // total for the root; children only render when "Show subcategories" is on.
  const categories = [
    { id: "cat-bread", name: "Bread", description: "Bread", parent: null, productCount: 14, children: [
      { id: "cat-bread-white", name: "White Bread", description: "White bread loaves", productCount: 6 },
      { id: "cat-bread-brown", name: "Brown Bread", description: "Whole-wheat / brown", productCount: 5 },
    ] },
    { id: "cat-cake", name: "Cake", description: "Cake", parent: null, productCount: 10, children: [] },
    { id: "cat-cookies", name: "Cookies", description: "Cookies", parent: null, productCount: 9, children: [] },
    { id: "cat-creamroll", name: "Cream Roll", description: "Cream Roll", parent: null, productCount: 3, children: [] },
    { id: "cat-donut", name: "Donut", description: "Donut", parent: null, productCount: 2, children: [] },
    { id: "cat-fruite", name: "Fruite", description: "Fruite", parent: null, productCount: 0, children: [] },
    { id: "cat-fruits", name: "Fruits", description: "Fruits", parent: null, productCount: 0, children: [] },
    { id: "cat-milk", name: "Milk Products", description: "", parent: null, productCount: 1, children: [] },
    { id: "cat-parent", name: "Parent", description: "", parent: null, productCount: 0, children: [] },
    { id: "cat-rawmat", name: "Raw Material", description: "", parent: null, productCount: 0, children: [] },
    { id: "cat-sandwitch", name: "Sandwitch", description: "Sandwitch", parent: null, productCount: 1, children: [] },
    { id: "cat-soda", name: "Soda", description: "Soda", parent: null, productCount: 1, children: [
      { id: "cat-soda-round", name: "Round Bottle", description: "Round soda bottles", productCount: 1 },
    ] },
    { id: "cat-toast", name: "Toast", description: "Toast", parent: null, productCount: 3, children: [] },
    { id: "cat-water", name: "Water", description: "Water", parent: null, productCount: 4, children: [
      { id: "cat-water-square", name: "Square Bottle", description: "Square PET bottles", productCount: 3 },
      { id: "cat-water-round", name: "Round Bottle", description: "Round bottles", productCount: 1 },
    ] },
  ];

  const rawMaterials = [
    { id: "rm-1", name: "Maida", articleNo: "FBhIqZ", category: "Raw Material", img: "flour", purchasingPrice: 60, taxRate: 0, unit: "KG", stockTotal: 0 },
    { id: "rm-2", name: "Sugar", articleNo: "RM-SUG-02", category: "Raw Material", img: "sugar", purchasingPrice: 45, taxRate: 0, unit: "KG", stockTotal: 320 },
    { id: "rm-3", name: "Butter", articleNo: "RM-BTR-03", category: "Raw Material", img: "butter", purchasingPrice: 240, taxRate: 12, unit: "KG", stockTotal: 90 },
    { id: "rm-4", name: "Yeast", articleNo: "RM-YST-04", category: "Raw Material", img: "yeast", purchasingPrice: 180, taxRate: 5, unit: "KG", stockTotal: 40 },
    { id: "rm-5", name: "PET Preform 250ml", articleNo: "RM-PET-05", category: "Packaging", img: "plastic,bottle", purchasingPrice: 3.5, taxRate: 18, unit: "Pc", stockTotal: 12000 },
    { id: "rm-6", name: "Bottle Cap", articleNo: "RM-CAP-06", category: "Packaging", img: "bottle,cap", purchasingPrice: 0.8, taxRate: 18, unit: "Pc", stockTotal: 45000 },
    { id: "rm-7", name: "Cocoa Powder", articleNo: "RM-COC-07", category: "Raw Material", img: "cocoa", purchasingPrice: 260, taxRate: 5, unit: "KG", stockTotal: 60 },
    { id: "rm-8", name: "Corrugated Box", articleNo: "RM-BOX-08", category: "Packaging", img: "cardboard,box", purchasingPrice: 22, taxRate: 18, unit: "Pc", stockTotal: 5200 },
  ];

  // Image directory (the /image-directory gallery). `linked` = product name it is
  // attached to (null → shows under the "Unlinked" tab).
  const images = [
    { id: "img-1", name: "Bill 11404", category: "Document", articleNo: "BILL-11404", img: "invoice,paper,handwritten", tags: [], linked: null },
    { id: "img-2", name: "Bill 11404 (UPI)", category: "Document", articleNo: "BILL-11404B", img: "ledger,paper,accounts", tags: [], linked: null },
    { id: "img-3", name: "Dark capture", category: "Uncategorised", articleNo: "IMG-0003", img: "black,texture", tags: [], linked: null },
    { id: "img-4", name: "Product QR", category: "Label", articleNo: "IMG-QR-04", img: "qr,code", tags: [], linked: null },
    { id: "img-5", name: "Shrikhand bowl", category: "Sweets", articleNo: "IMG-SHR-05", img: "shrikhand,dessert,saffron", tags: [], linked: null },
    { id: "img-6", name: "Rabri bowl", category: "Sweets", articleNo: "IMG-RAB-06", img: "kheer,rabri,dessert", tags: [], linked: null },
    { id: "img-7", name: "Kalakand plate", category: "Sweets", articleNo: "IMG-KAL-07", img: "kalakand,barfi,sweet", tags: [], linked: null },
    { id: "img-8", name: "Butter cookies", category: "Cookies", articleNo: "IMG-CKY-08", img: "butter,cookies", tags: ["High margin"], linked: "Butter Cookies 200gm" },
    { id: "img-9", name: "R-Square bottle", category: "Water", articleNo: "IMG-RSB-09", img: "water,bottle,black", tags: [], linked: "250ml Pet" },
    { id: "img-10", name: "R-Square label sheet", category: "Label", articleNo: "IMG-RSL-10", img: "label,green,packaging", tags: [], linked: null },
    { id: "img-11", name: "R-Square label 2", category: "Label", articleNo: "IMG-RSL-11", img: "label,green,print", tags: [], linked: null },
    { id: "img-12", name: "Barfi tray", category: "Sweets", articleNo: "IMG-BRF-12", img: "barfi,silver,sweet", tags: [], linked: null },
    { id: "img-13", name: "Chocolate bar", category: "Snacks", articleNo: "IMG-CHO-13", img: "chocolate,bar", tags: [], linked: null },
    { id: "img-14", name: "Bread loaf", category: "Bread", articleNo: "IMG-BRD-14", img: "bread,loaf", tags: [], linked: "Milk Bread 200gm" },
  ];

  window.SEED = { products, categories, rawMaterials, images };

  /* ── Vasu Foods (29 Sep 2026) ───────────────────────────────────────────
     In the platform the catalogue is the business's one record — the production
     store (v7/assets/production/production-api.js), loaded before this file —
     not the Murli rows above: Vasu's packs with the stock Finished Goods holds
     and what customers are waiting for, its raw materials and packaging with
     the store's stock, and the pack photos. A price saved here is the pack's
     price everywhere (Recipes › Packaging, Sales Orders, invoices). */
  const P = window.FB_PRODUCTION;
  if (!P) return;
  try {
    window.SEED = P.read(function (D, d) {
      /* the category is the finished product's own (the engine's recipe book, 3 Oct 2026) */
      const TOP = (rid) => D.book(rid).category || "Frozen Vegetables";
      const IMG = { "green-peas": "green,peas", "mix-veg": "mixed,vegetables", "soya-chaap": "kebab,skewer" };
      const sub = (s) => D.book(s.recipeId).name;
      const vasuProducts = d.skus.map(function (s) {
        /* in the plant and free: what is on the shelf less what is on the vans (the plan's InStock) */
        const bk = D.book(s.recipeId), open = d.orders.reduce(function (n, so) { return n + D.openQty(so, s.id); }, 0), have = D.availableToSell(s.id), c = D.packCost(s);
        const tax = d.business.gstPct;
        return {
          id: s.id, skuId: s.id, name: s.name, articleNo: s.article, category: sub(s), categoryTop: TOP(s.recipeId), img: IMG[s.recipeId] || "frozen,food",
          price: s.price, taxRate: tax, stockTotal: have, canSell: Math.max(0, have - open), inOrders: open, barcode: "8905" + s.article.replace(/\D/g, "").padStart(8, "0"),
          brand: s.brand || "Vasu", active: !s.retired, highMargin: c.marginPct >= 40, costPrice: c.total,
          description: bk.name + " (" + bk.label + ") · " + (s.perCarton > 1 ? (s.grams >= 1000 ? s.grams / 1000 + " kg" : s.grams + " g") + " pouch, " + s.perCarton + " to a 30 kg master carton" : (s.grams / 1000) + " kg bag") +
            ". Mixed from " + bk.ingredients.filter((i) => i.sfId).map((i) => D.book(i.sfId).short + " " + i.qty + "%").join(", ") + ". Keeps " + (bk.bestBeforeDays >= 30 ? Math.round(bk.bestBeforeDays / 30) + " months" : bk.bestBeforeDays + " days") + " at −18 °C.",
          unit: "Pkt", baseUnit: s.perCarton > 1 ? "Carton" : "Pkt", conversionQty: s.perCarton,
          packaging: s.perCarton > 1 ? [
            { unit: "Pkt", tag: "Smallest Unit", conv: "1 Pkt", price: inclTax(s.price, tax) },
            { unit: "Carton", tag: "Base Unit", conv: "1 Carton (30 kg) = " + s.perCarton + " Pkt", price: Math.round(inclTax(s.price, tax) * s.perCarton * 100) / 100 },
          ] : [{ unit: "Pkt", tag: "Smallest Unit", conv: "1 Bag (" + s.grams / 1000 + " kg)", price: inclTax(s.price, tax) }],
        };
      });
      const MCAT = function (m) { return m.store === "Cold room" ? "Fresh Vegetables" : m.kind === "packaging" ? (/^Pouch|^Bag 20/.test(m.name) ? "Pouches & Bags" : "Master Cartons & Big Bags") : m.unit === "pcs" ? "Chaap Sticks" : "Flours & Gluten"; };
      const MIMG = { "rm-p01": "green,peas", "rm-p02": "carrot", "rm-p03": "cauliflower", "rm-p04": "green,beans", "rm-p05": "soy,flour", "rm-p06": "flour", "rm-p07": "wooden,skewers",
        "rm-p08": "sack", "rm-p10": "broccoli", "rm-p11": "wheat,flour", "rm-p12": "wheat,flour",
        "sf-cauliflower": "cauliflower,florets", "sf-broccoli": "broccoli,florets", "sf-carrots": "diced,carrots", "sf-beans": "chopped,beans", "sf-peas": "frozen,peas", "sf-chaap-dough": "dough" };
      const TAX = function (m) { return m.store === "Cold room" ? 0 : m.kind === "packaging" ? 18 : m.unit === "pcs" ? 12 : 5; };
      const vasuRaw = d.materials.map(function (m) {
        return { id: m.id, materialId: m.id, name: m.name, articleNo: m.article, category: MCAT(m), img: MIMG[m.id] || (m.id === "rm-k11" ? "cardboard,box" : "plastic,packaging"),
          purchasingPrice: m.price, taxRate: TAX(m), unit: m.unit === "kg" ? "KG" : "Pc", stockTotal: D.onHand(m.id), supplier: m.supplier, grade: m.grade || "", msq: m.threshold };
      }).concat(d.semiOrder.map(function (sid) {
        /* the semi-finished goods: made here from raw material, by their own recipe, into the cold store */
        const bk = D.book(sid);
        return { id: sid, materialId: sid, name: bk.name, articleNo: "SF-" + String(d.semiOrder.indexOf(sid) + 1).padStart(4, "0"), category: "Semi-Finished Goods", img: MIMG[sid] || "frozen,food",
          purchasingPrice: Math.round(D.costPerKg(sid) * 100) / 100, taxRate: 0, unit: "KG", stockTotal: D.inFreezer(sid), supplier: "Made in-house · " + bk.label, msq: bk.msq || 0, semi: true };
      }));
      const count = function (name) { return vasuProducts.filter(function (p) { return p.category === name || p.categoryTop === name; }).length; };
      const cat = function (id, name, desc, kids) {
        return { id: id, name: name, description: desc, parent: null, productCount: count(name), children: kids.map(function (k) { return { id: id + "-" + k[0], name: k[1], description: k[2], productCount: count(k[1]) }; }) };
      };
      const vasuCategories = [
        cat("cat-frozen", "Frozen Vegetables", "IQF, mixed and packed from the cold store's cut vegetables; 30 kg master cartons", [["mixveg", "Mix Veg", "low-season-recipie: cauliflower 20 · broccoli 10 · carrots 40 · beans 10 · peas 20"], ["peas", "Green Peas", "low-season-recipie: Green Peas 50 Kg, 100%"]]),
        cat("cat-chaap", "Soya Chaap", "soya-chaap-premumium: dough on wooden sticks, in 20 kg bags — Vasu Gold", [["chaap", "Soya Chaap", "Soya Chaap 20 Kg"]]),
        { id: "cat-semi", name: "Semi-Finished Goods", description: "Cut 20 mm, blanched and IQF-frozen into 50 kg bags; the chaap dough in tubs", parent: null, productCount: d.semiOrder.length, children: [] },
        { id: "cat-rawmat", name: "Raw Material", description: "Cauliflower, broccoli, carrots, beans and green peas; flours, gluten and sticks", parent: null, productCount: d.materials.filter((m) => m.kind !== "packaging").length, children: [] },
        { id: "cat-pack", name: "Packaging", description: "Printed pouches, chaap bags, master cartons and big bags", parent: null, productCount: d.materials.filter((m) => m.kind === "packaging").length, children: [] },
      ];
      const vasuImages = vasuProducts.map(function (p, i) {
        return { id: "img-" + (i + 1), name: p.name + " · pouch", category: p.category, articleNo: "IMG-" + p.articleNo, img: p.img, tags: p.highMargin ? ["High margin"] : [], linked: p.name };
      }).concat([
        { id: "img-doc-1", name: "FSSAI licence · Vasu Foods", category: "Document", articleNo: "DOC-FSSAI", img: "certificate,document", tags: [], linked: null },
        { id: "img-doc-2", name: "Master carton label", category: "Label", articleNo: "LBL-CARTON", img: "label,cardboard", tags: [], linked: null },
        { id: "img-doc-3", name: "Vasu Gold chaap bag artwork", category: "Label", articleNo: "LBL-GOLD", img: "label,gold,packaging", tags: [], linked: null },
      ]);
      return { products: vasuProducts, categories: vasuCategories, rawMaterials: vasuRaw, images: vasuImages, vasu: true };
    });
  } catch (e) { console.error("Product Master: the business store could not be read", e); }
})();

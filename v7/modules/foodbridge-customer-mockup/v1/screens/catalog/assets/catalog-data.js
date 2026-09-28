/*
 * Seed data for the Catalog screen (customers + catalogs), modelled on the live
 * b2bgreens Catalog module. Loaded after data.js, so it extends window.SEED with
 * `customers` and `catalogs`. Product/category rows are reused from data.js.
 *
 *   catalogs → Catalog list + Create/Update Catalog drawer
 *   customers → Select Customers tab + Create Campaign Links flow
 *
 * customerCount / productCount are the numbers shown on the list (kept as
 * explicit fields so the row totals match the real app); the `customers` and
 * `products` arrays drive the editable drawer.
 */
(function () {
  const SEED = window.SEED || (window.SEED = {});

  // 36 customers — the first 18 are verbatim from the live "Create Campaign
  // Links" list; the rest are plausible kirana/retail accounts to fill the book.
  const customers = [
    { id: "c-1", name: "6396376753", phone: "6396376753", type: "retail" },
    { id: "c-2", name: "Vijay", phone: "75656666444", type: "b2b" },
    { id: "c-3", name: "Sagar", phone: "99555555888", type: "b2b" },
    { id: "c-4", name: "Retail Cutsomer", phone: "7796092190", type: "retail" },
    { id: "c-5", name: "Shubham Kashid", phone: "75072073487", type: "b2b" },
    { id: "c-6", name: "Vijay Verma", phone: "755585558", type: "b2b" },
    { id: "c-7", name: "Ajay Verma", phone: "911111112", type: "b2b" },
    { id: "c-8", name: "Nishant", phone: "333333333", type: "b2b" },
    { id: "c-9", name: "Mahesh Kumar", phone: "744444444", type: "b2b" },
    { id: "c-10", name: "233844948", phone: "233844948", type: "retail" },
    { id: "c-11", name: "Vaibhav kirana Store", phone: "5378222223", type: "b2b" },
    { id: "c-12", name: "Kunal Sweet Shop", phone: "3426645432", type: "b2b" },
    { id: "c-13", name: "8767869866", phone: "8767869866", type: "retail" },
    { id: "c-14", name: "KD Ansari", phone: "9971765309", type: "b2b" },
    { id: "c-15", name: "2333633534", phone: "2333633534", type: "retail" },
    { id: "c-16", name: "Manjit Store", phone: "48392017465", type: "b2b" },
    { id: "c-17", name: "Shree Ganesh Kirana", phone: "91527364081", type: "b2b" },
    { id: "c-18", name: "Gajanan General Store", phone: "76184530928", type: "b2b" },
    { id: "c-19", name: "Rahul Traders", phone: "9812345670", type: "b2b" },
    { id: "c-20", name: "Om Provision Store", phone: "9765432109", type: "b2b" },
    { id: "c-21", name: "Sai General Store", phone: "9890011234", type: "b2b" },
    { id: "c-22", name: "Balaji Kirana", phone: "9876501234", type: "b2b" },
    { id: "c-23", name: "Annapurna Stores", phone: "9701122334", type: "b2b" },
    { id: "c-24", name: "New Bharat Store", phone: "9955001122", type: "b2b" },
    { id: "c-25", name: "Laxmi Sweet Mart", phone: "9812309876", type: "b2b" },
    { id: "c-26", name: "Krishna Dairy", phone: "9700456789", type: "b2b" },
    { id: "c-27", name: "Ganesh Provision", phone: "9811223344", type: "b2b" },
    { id: "c-28", name: "Patil Kirana Store", phone: "9922334455", type: "b2b" },
    { id: "c-29", name: "Deshmukh Stores", phone: "9833445566", type: "b2b" },
    { id: "c-30", name: "Jadhav General Store", phone: "9744556677", type: "b2b" },
    { id: "c-31", name: "More Supermarket", phone: "9655667788", type: "b2b" },
    { id: "c-32", name: "Apna Bazaar", phone: "9866778899", type: "b2b" },
    { id: "c-33", name: "Ratna Traders", phone: "9877889900", type: "b2b" },
    { id: "c-34", name: "Sharma Kirana", phone: "9788990011", type: "b2b" },
    { id: "c-35", name: "Riya Retail", phone: "9799001122", type: "retail" },
    { id: "c-36", name: "Verma Provision", phone: "9700112233", type: "b2b" },
  ];

  const allCustomerIds = customers.map((c) => c.id);
  const allProductIds = (SEED.products || []).map((p) => p.id);

  const catalogs = [
    {
      id: "cat-default", name: "Default", description: "",
      customerCount: 36, productCount: 50, lastModified: "12/08/2026",
      customers: allCustomerIds.slice(), products: allProductIds.slice(), pricing: {},
    },
    {
      id: "cat-1", name: "Catalogue 1", description: "",
      customerCount: 3, productCount: 1, lastModified: "03/07/2026",
      customers: ["c-3", "c-2", "c-5"], products: ["p-1"], pricing: {},
    },
    {
      id: "cat-2", name: "Catalogue 2", description: "",
      customerCount: 4, productCount: 1, lastModified: "03/07/2026",
      customers: ["c-3", "c-2", "c-5", "c-7"], products: ["p-2"], pricing: {},
    },
  ];

  SEED.customers = customers;
  SEED.catalogs = catalogs;

  /* Vasu Foods (29 Sep 2026): in the platform the catalogs are the business's
     price lists — one per kind of customer, at the price the store charges
     them (list price less the kind's share) — and the customers are its own. */
  const P = window.FB_PRODUCTION;
  if (!P || !SEED.vasu) return;
  try {
    P.read(function (D, d) {
      const ids = function (f) { return d.skus.filter(function (s) { return !s.retired && f(s); }).map(function (s) { return s.id; }); };
      const who = function (t) { return d.customers.filter(function (c) { return t.indexOf(c.type) !== -1; }).map(function (c) { return c.id; }); };
      const priced = function (list, t) { const out = {}; list.forEach(function (id) { out[id] = D.priceFor(who(t)[0], id); }); return out; };
      const today = new Date(), stamp = String(today.getDate()).padStart(2, "0") + "/" + String(today.getMonth() + 1).padStart(2, "0") + "/" + today.getFullYear();
      const cat = function (id, name, description, types, products) {
        const cs = who(types);
        return { id: id, name: name, description: description, customerCount: cs.length, productCount: products.length, lastModified: stamp, customers: cs, products: products, pricing: priced(products, types) };
      };
      SEED.customers = d.customers.map(function (c) { return { id: c.id, name: c.name, phone: c.phone, type: c.type === "CONSUMER" ? "retail" : "b2b" }; });
      SEED.catalogs = [
        cat("cat-default", "Shops & walk-in", "Every pack at list price", ["RETAILER", "CONSUMER"], ids(function () { return true; })),
        cat("cat-agents", "Commission Agents · Mandi", "Soya chaap by the master carton, 12% off list", ["COMMISSION_AGENT"], ids(function (s) { return /chaap/.test(s.recipeId); })),
        cat("cat-distributors", "Distributors", "Frozen vegetables and Vasu Gold chaap, 10% off list", ["DISTRIBUTOR"], ids(function (s) { return !/soya-chaap$|plain/.test(s.recipeId) && s.grams < 5000; })),
        cat("cat-horeca", "HoReCa · 5 kg packs", "Catering packs for dhabas and caterers, 5% off list", ["HORECA"], ids(function (s) { return s.grams >= 1000; })),
      ];
    });
  } catch (e) { console.error("Catalog: the business store could not be read", e); }
})();

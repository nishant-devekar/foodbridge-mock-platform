/* ==========================================================================
   DISCOVERY — Foodbridge Module Customer — inline seed

   MIRROR OF ../../seed-data/seed.json — edit both together.
   The prototype runs from file:// and cannot fetch local JSON, so the seed is
   duplicated here as a plain script. seed-data/seed.json stays the canonical,
   human-readable copy; this file is what the screens actually load.

   Shapes mirror the live API responses consumed by
   storefront-frontend/src/pages/Customers.jsx and RetailCustomers.jsx:

     GET /customer            -> { data: { orgs: [...], totalOrgsCount } }
     GET /customer/retail     -> { data: { orgs: [...], totalOrgsCount } }
     GET /catalogue           -> { data: [ { customerTypeReference, catalogue } ] }

   Field names deliberately keep the API's spelling quirks (`adress1`,
   `adress2`, `postnr`) so the prototype exercises the same mapping the React
   pages do.
   ========================================================================== */

(function () {
  // Single active location — the live app scopes catalogue + credit assignment
  // per location via getCurrentLocationId().
  const LOCATION = "loc_qa_store_01";

  // Customer types are the join between a customer and a catalogue.
  const TYPE = {
    default: "ctype_default",
    cat1: "ctype_catalogue_1",
    cat2: "ctype_catalogue_2",
  };

  const catalogues = [
    { _id: "cat_00", customerTypeReference: TYPE.default, catalogue: { name: "Default" } },
    { _id: "cat_01", customerTypeReference: TYPE.cat1, catalogue: { name: "Catalogue 1" } },
    { _id: "cat_02", customerTypeReference: TYPE.cat2, catalogue: { name: "Catalogue 2" } },
  ];

  const states = [
    { code: "MH", name: "Maharashtra" },
    { code: "GJ", name: "Gujarat" },
    { code: "KA", name: "Karnataka" },
    { code: "DL", name: "Delhi" },
    { code: "RJ", name: "Rajasthan" },
    { code: "TN", name: "Tamil Nadu" },
    { code: "UP", name: "Uttar Pradesh" },
    { code: "MP", name: "Madhya Pradesh" },
  ];

  const st = (code) => states.find((s) => s.code === code) || {};

  /** Build a customer in the exact shape the list screens read. */
  function customer(o) {
    return {
      _id: o.id,
      orgNo: o.orgNo || "",
      name: { en: o.name },
      email: o.email || "",
      phone: o.phone,
      // billing
      adress1: o.address || "",
      state: o.state ? st(o.state) : {},
      postnr: o.pin || "",
      // shipping
      adress2: o.shipAddress || o.address || "",
      shippingState: o.shipState ? st(o.shipState) : o.state ? st(o.state) : {},
      shippingPostnumber: o.shipPin || o.pin || "",
      // tax
      gstType: o.gstType || "",
      gstNumber: o.gstNumber || "",
      supplyChainType: o.supplyChainType || "PUBLIC",
      // catalogue assignment, per location
      locationCustomerTypeMap: o.type
        ? [{ locationRef: LOCATION, customerTypeRef: o.type }]
        : [],
      tags: o.tags || [],
      createdAt: o.createdAt,
    };
  }

  /* ---- B2B customers (route /customers) --------------------------------
     First ten rows reproduce the As-is screenshot verbatim (names, phone
     numbers, catalogue chips, and the empty ADDRESS column that renders "-").
     Rows 11+ add the variety the screenshot doesn't cover: filled addresses,
     GST-registered vs exempt, a customer code, and a second page of results. */

  const b2b = [
    { id: "c01", name: "Raman", email: "raman@gmail.com", phone: "985673456", type: TYPE.default, tags: ["normal"], createdAt: "2026-01-14" },
    { id: "c02", name: "A New Customer", phone: "9384594893", type: TYPE.default, createdAt: "2026-01-22" },
    { id: "c03", name: "Aai Mata General Store", phone: "82736450195", type: TYPE.default, tags: ["regular"], createdAt: "2026-02-02" },
    { id: "c04", name: "Ganraj Kirana Mart", phone: "41589627074", type: TYPE.cat2, createdAt: "2026-02-11" },
    { id: "c05", name: "Shree Ram Super Market", phone: "56820973184", type: TYPE.cat2, tags: ["regular"], createdAt: "2026-02-19" },
    { id: "c06", name: "New Bharat General Store", phone: "64082719536", type: TYPE.cat2, createdAt: "2026-03-04" },
    { id: "c07", name: "Laxmi Provision Store", phone: "97315042861", type: TYPE.default, tags: ["normal"], createdAt: "2026-03-12" },
    { id: "c08", name: "Raj Traders", phone: "53197286440", type: TYPE.cat1, createdAt: "2026-03-25" },
    { id: "c09", name: "Shivam Grocery Store", phone: "28946175318", type: TYPE.default, createdAt: "2026-04-02" },
    { id: "c10", name: "Shree Datta Super Store", phone: "70631984512", type: TYPE.default, createdAt: "2026-04-15" },

    {
      id: "c11", name: "Sai Enterprises", orgNo: "CUST-0011",
      email: "accounts@saient.in", phone: "9822014455",
      address: "Shop 14, Market Yard", state: "MH", pin: "411037",
      gstType: "regular", gstNumber: "27AAECS1234F1Z5",
      type: TYPE.cat1, createdAt: "2026-04-28",
    },
    {
      id: "c12", name: "Annapurna Wholesale", orgNo: "CUST-0012",
      email: "orders@annapurna.co.in", phone: "9930778812",
      address: "Plot 22, MIDC Phase II", state: "MH", pin: "400705",
      shipAddress: "Warehouse 4, Kalamboli Godown Cluster", shipState: "MH", shipPin: "410218",
      gstType: "regular", gstNumber: "27AABCA9876K1ZP",
      type: TYPE.cat2, createdAt: "2026-05-06",
    },
    {
      id: "c13", name: "Gokul Dairy & General", orgNo: "CUST-0013",
      email: "gokul.dairy@gmail.com", phone: "9426100077",
      address: "Near Bus Stand, Anand", state: "GJ", pin: "388001",
      gstType: "exempt", gstNumber: "UDIN-2026-004518",
      type: TYPE.default, createdAt: "2026-05-19",
    },
    {
      id: "c14", name: "Balaji Super Bazaar", orgNo: "CUST-0014",
      email: "balaji.bazaar@outlook.com", phone: "9845220311",
      address: "3rd Cross, Jayanagar 4th Block", state: "KA", pin: "560011",
      gstType: "regular", gstNumber: "29AACCB4321M1Z8",
      type: TYPE.cat1, createdAt: "2026-06-01",
    },
    {
      id: "c15", name: "Hind Provision Stores", orgNo: "CUST-0015",
      phone: "9312044566",
      address: "Khari Baoli, Chandni Chowk", state: "DL", pin: "110006",
      type: TYPE.default, createdAt: "2026-06-10",
    },
    {
      id: "c16", name: "Marwar Trading Co.", orgNo: "CUST-0016",
      email: "marwar.trading@gmail.com", phone: "9414088990",
      address: "Johari Bazaar Road", state: "RJ", pin: "302003",
      gstType: "regular", gstNumber: "08AAFCM5566Q1ZR",
      type: TYPE.cat2, createdAt: "2026-06-24",
    },
    {
      id: "c17", name: "Kaveri Stores", orgNo: "CUST-0017",
      email: "kaveristores@yahoo.in", phone: "9840566123",
      address: "12 Anna Salai", state: "TN", pin: "600002",
      type: TYPE.default, createdAt: "2026-07-03",
    },
    {
      id: "c18", name: "Ganga Kirana Bhandar", orgNo: "CUST-0018",
      phone: "9335001278",
      address: "Aminabad Main Road", state: "UP", pin: "226018",
      gstType: "exempt", gstNumber: "UDIN-2026-009902",
      type: TYPE.default, createdAt: "2026-07-16",
    },
    {
      id: "c19", name: "Narmada Distributors", orgNo: "CUST-0019",
      email: "sales@narmadadist.in", phone: "9827311456",
      address: "Zone-II, Maharana Pratap Nagar", state: "MP", pin: "462011",
      gstType: "regular", gstNumber: "23AAGCN7788L1ZW",
      type: TYPE.cat1, createdAt: "2026-07-28",
    },
    {
      id: "c20", name: "Konkan Fresh Mart", orgNo: "CUST-0020",
      email: "konkanfresh@gmail.com", phone: "9022778899",
      address: "Station Road, Ratnagiri", state: "MH", pin: "415612",
      type: TYPE.cat2, createdAt: "2026-08-04",
    },
    {
      id: "c21", name: "Vishal Wholesale Depot", orgNo: "CUST-0021",
      email: "vishal.depot@gmail.com", phone: "9998112233",
      address: "Ring Road, Surat", state: "GJ", pin: "395002",
      gstType: "regular", gstNumber: "24AADCV2211H1ZK",
      type: TYPE.cat2, createdAt: "2026-08-07",
    },
    {
      id: "c22", name: "Sharda Retail Chain", orgNo: "CUST-0022",
      phone: "9765004411",
      address: "FC Road", state: "MH", pin: "411005",
      type: TYPE.default, createdAt: "2026-08-09",
    },
  ].map(customer);

  /* ---- Retail customers (route /retail-customers) -----------------------
     supplyChainType is always PRIVATE; no GST fields, no catalogue chips in
     practice — the app auto-assigns every new customer, retail or B2B, to
     the tenant's Default catalogue at the current location — and the row
     actions swap the Stock button for Send Ordering Link. */

  const retail = [
    { id: "r01", name: "Priya Deshmukh", email: "priya.d@gmail.com", phone: "9822711045", address: "Flat 302, Sunrise Residency, Baner", state: "MH", pin: "411045", supplyChainType: "PRIVATE", type: TYPE.default, createdAt: "2026-03-08" },
    { id: "r02", name: "Anil Kumar", phone: "9812004477", address: "House 21, Sector 15", state: "DL", pin: "110085", supplyChainType: "PRIVATE", type: TYPE.default, createdAt: "2026-03-21" },
    { id: "r03", name: "Meera Iyer", email: "meera.iyer@outlook.com", phone: "9840112233", address: "4/7 Besant Nagar", state: "TN", pin: "600090", supplyChainType: "PRIVATE", type: TYPE.default, createdAt: "2026-04-05" },
    { id: "r04", name: "Rakesh Jain", phone: "9414556677", supplyChainType: "PRIVATE", type: TYPE.default, createdAt: "2026-04-18" },
    { id: "r05", name: "Sunita Patil", email: "sunita.patil91@gmail.com", phone: "9004556621", address: "B-12, Shanti Nagar, Andheri East", state: "MH", pin: "400069", supplyChainType: "PRIVATE", type: TYPE.default, createdAt: "2026-05-02" },
    { id: "r06", name: "Imran Shaikh", phone: "9739004512", address: "18, Cox Town", state: "KA", pin: "560005", supplyChainType: "PRIVATE", type: TYPE.default, createdAt: "2026-05-17" },
    { id: "r07", name: "Kavita Sharma", email: "kavita.sharma@gmail.com", phone: "9827004488", address: "Arera Colony, E-3", state: "MP", pin: "462016", supplyChainType: "PRIVATE", type: TYPE.default, createdAt: "2026-06-03" },
    { id: "r08", name: "Devendra Rathod", phone: "9925117744", address: "Navrangpura", state: "GJ", pin: "380009", supplyChainType: "PRIVATE", type: TYPE.default, createdAt: "2026-06-20" },
    { id: "r09", name: "Farida Ansari", email: "farida.ansari@yahoo.com", phone: "9335447788", address: "Gomti Nagar, Vibhuti Khand", state: "UP", pin: "226010", supplyChainType: "PRIVATE", type: TYPE.default, createdAt: "2026-07-09" },
    { id: "r10", name: "Suresh Nair", phone: "9820331155", address: "Ganesh Peth", state: "MH", pin: "411002", supplyChainType: "PRIVATE", type: TYPE.default, createdAt: "2026-07-25" },
    { id: "r11", name: "Neha Agarwal", email: "neha.ag@gmail.com", phone: "9414990022", address: "Vaishali Nagar", state: "RJ", pin: "302021", supplyChainType: "PRIVATE", type: TYPE.default, createdAt: "2026-08-02" },
    { id: "r12", name: "Ravi Verma", phone: "9312778866", supplyChainType: "PRIVATE", type: TYPE.default, createdAt: "2026-08-08" },
  ].map(customer);

  /* ---- Stock audits, backing Stock Audit & Health -----------------------
     Each line is an OBSERVATION rather than a count: what was expected, what
     was physically found, how that stock breaks down by condition and by
     where it was stored, plus the exception detail the condition made
     relevant. Records here are deliberately terse — normalizeLine() in
     stock-audit.js fills in every bucket the seed leaves out, and derives
     `physical` as the sum of the condition breakdown, so the reconciliation
     rule can't be violated by a typo in this file.

     Between them these four customers exercise the whole model: a clean
     visit, a plain variance, near-expiry with batch detail, a confirmed
     stock-out, damage with evidence, expired stock with a disposition, a
     "not found" line (which is NOT the same as zero), backroom stock behind
     a thin shelf, and a partially-completed visit.

     `lines` are keyed by productId only — name/artNo/category/unit/emoji are
     looked up from `products` at render time, so they can't drift — while
     `expected` is the system stock the visit itself saw, frozen at capture.
     Dates are picked so the landing page shows real variety across
     "Recently Audited" / "Due for Visit" / "Overdue" (see orderingSignals
     below): c01 is a healthy customer simply due for a routine check-in;
     c11 was visited recently but still has open issues. */
  const stockAudits = {
    // Healthy store, nothing to do. Scenario A.
    c01: [
      {
        id: "aud-c01-1",
        at: "2026-08-05T15:41:00",
        status: "completed",
        auditor: "Mahesh",
        purpose: "routine",
        locationId: "primary",
        expectedProducts: 3,
        outcome: "healthy",
        notes: "",
        lines: [
          { productId: "p01", expected: 2, status: "audited", conditionBreakdown: { good: 2 }, storageBreakdown: { shelf: 2 }, shelfAvailability: "available", facings: 4 },
          { productId: "p11", expected: 8, status: "audited", conditionBreakdown: { good: 8 }, storageBreakdown: { shelf: 8 }, shelfAvailability: "available", facings: 6 },
          { productId: "p12", expected: 15, status: "audited", conditionBreakdown: { good: 15 }, storageBreakdown: { shelf: 12, backroom: 3 }, shelfAvailability: "available", facings: 8 },
        ],
        followUp: { required: false, note: "", at: "" },
      },
    ],
    // A plain shortfall and a thinning shelf — no exceptions to detail.
    c02: [
      {
        id: "aud-c02-1",
        at: "2026-08-10T15:41:00",
        status: "completed",
        auditor: "Mahesh",
        purpose: "routine",
        locationId: "primary",
        expectedProducts: 2,
        outcome: "replenish",
        notes: "",
        lines: [
          { productId: "p06", expected: 2, status: "audited", conditionBreakdown: { good: 1 }, storageBreakdown: { shelf: 1 }, shelfAvailability: "partial", facings: 2 },
          { productId: "p10", expected: 30, status: "audited", conditionBreakdown: { good: 28 }, storageBreakdown: { shelf: 20, backroom: 8 }, shelfAvailability: "partial", facings: 5, notes: "Front two facings empty at close of day." },
        ],
        followUp: { required: false, note: "", at: "" },
      },
    ],
    // Near-expiry stock with real batch detail, plus a slow-moving overstock.
    c05: [
      {
        id: "aud-c05-1",
        at: "2026-08-06T11:02:00",
        status: "completed",
        auditor: "Mahesh",
        purpose: "routine",
        locationId: "primary",
        expectedProducts: 3,
        outcome: "pull",
        notes: "Monthly audit — aisle 3 & 4",
        lines: [
          { productId: "p11", expected: 8, status: "audited", conditionBreakdown: { good: 8 }, storageBreakdown: { shelf: 8 }, shelfAvailability: "available", facings: 6 },
          {
            productId: "p12", expected: 15, status: "audited",
            conditionBreakdown: { good: 11, nearExpiry: 2 },
            storageBreakdown: { shelf: 13 },
            shelfAvailability: "available", facings: 7,
            expiryDetails: [{ bucket: "nearExpiry", date: "2026-09-04", batch: "PG-2609-A", qty: 2 }],
            notes: "Two packs from the June batch still on the top shelf — rotate forward.",
          },
          { productId: "p09", expected: 12, status: "audited", conditionBreakdown: { good: 26 }, storageBreakdown: { shelf: 6, backroom: 20 }, shelfAvailability: "available", facings: 3, notes: "Customer over-ordered last cycle; backroom is full." },
        ],
        followUp: { required: false, note: "", at: "" },
      },
    ],
    // The full exception story, across two visits: a stock-out that gets
    // followed up, then a partial re-visit cut short by the store closing.
    c11: [
      {
        id: "aud-c11-1",
        at: "2026-08-07T09:20:00",
        status: "completed",
        auditor: "Mahesh",
        purpose: "routine",
        locationId: "primary",
        expectedProducts: 2,
        outcome: "replenish",
        notes: "Opening count",
        lines: [
          { productId: "p12", expected: 15, status: "audited", conditionBreakdown: { good: 15 }, storageBreakdown: { shelf: 15 }, shelfAvailability: "available", facings: 8 },
          {
            productId: "p01", expected: 2, status: "audited",
            conditionBreakdown: {},
            storageBreakdown: {},
            shelfAvailability: "not_on_shelf",
            notes: "Shelf tag still up, nothing behind it.",
            evidence: [{ id: "ev-c11-1-a", type: "shelf", label: "Empty facing, aisle 2", note: "", capturedAt: "2026-08-07T09:22:00", capturedBy: "Mahesh" }],
          },
        ],
        followUp: {
          required: true,
          note: "Restock 250ML PET before next visit — shelf empty.",
          at: "2026-08-07T09:25:00",
        },
      },
      {
        id: "aud-c11-2",
        at: "2026-08-18T10:05:00",
        status: "completed",
        auditor: "Mahesh",
        purpose: "followup",
        locationId: "primary",
        expectedProducts: 8,
        outcome: "followup",
        notes: "Follow-up visit",
        finalNote: "Store closed at 10:40 — remaining aisles not walked.",
        partial: { isPartial: true, reason: "store_closing", note: "Shutters came down early for a delivery." },
        lines: [
          { productId: "p12", expected: 15, status: "audited", conditionBreakdown: { good: 10 }, storageBreakdown: { shelf: 10 }, shelfAvailability: "available", facings: 6 },
          {
            productId: "p01", expected: 2, status: "audited",
            conditionBreakdown: { nearExpiry: 1 },
            storageBreakdown: { shelf: 1 },
            shelfAvailability: "partial", facings: 1,
            expiryDetails: [{ bucket: "nearExpiry", date: "2026-09-01", batch: "PET-0826", qty: 1 }],
            notes: "Restocked since last visit, but only one unit and it's the old batch.",
          },
          {
            productId: "p04", expected: 0, status: "audited",
            conditionBreakdown: { damaged: 3 },
            storageBreakdown: { backroom: 3 },
            shelfAvailability: "not_on_shelf",
            damageType: "leakage",
            notes: "Three bottles leaking in the backroom crate — store manager already set them aside.",
            evidence: [{ id: "ev-c11-2-a", type: "damage", label: "Leaking crate, backroom", note: "Reported by store manager", capturedAt: "2026-08-18T10:18:00", capturedBy: "Mahesh" }],
          },
          {
            productId: "p09", expected: 12, status: "audited",
            conditionBreakdown: { good: 4, expired: 2 },
            storageBreakdown: { shelf: 2, backroom: 4 },
            shelfAvailability: "partial", facings: 2,
            expiryDetails: [{ bucket: "expired", date: "2026-08-14", batch: "AT-0814", qty: 2 }],
            disposition: "pull",
            evidence: [{ id: "ev-c11-2-b", type: "expiry", label: "Expired date code, 14 Aug", note: "", capturedAt: "2026-08-18T10:26:00", capturedBy: "Mahesh" }],
          },
          // Not found is NOT zero: nobody could confirm the stock either way,
          // so this line must not be read as a stock-out.
          { productId: "p10", expected: 30, status: "not_found", notFoundReason: "no_access", notes: "Pallet blocked by the delivery being unloaded." },
        ],
        followUp: { required: false, note: "", at: "" },
      },
    ],
  };

  /* ---- Ordering signals, backing Ordering Status and Ordering Pattern ----
     Distributor-visible reorder behaviour per customer — synthesized for this
     discovery (the real signal lives in the Sales Orders module, a separate
     repo not wired into this seed). `orders` is newest-first; last order,
     order value, average order value and the observed cycle are all derived
     from it at render time, so there is one place to edit and nothing to
     keep in sync. `avgCycleDays` is the expected cadence — expected next
     order (orders[0].at + avgCycleDays) vs. today decides On Track /
     Slipping / Overdue, and feeds the Ordering axis of customer health.
     Customers absent here show "Unknown" — that's honest: it means the
     platform has no ordering signal for them yet, not that all is well. */
  const orderingSignals = {
    c01: { avgCycleDays: 7, orders: [
      { at: "2026-08-19", value: 48200 }, { at: "2026-08-12", value: 44100 },
      { at: "2026-08-05", value: 51600 }, { at: "2026-07-29", value: 46800 },
    ] },
    c02: { avgCycleDays: 10, orders: [
      { at: "2026-08-03", value: 12400 }, { at: "2026-07-24", value: 15900 },
      { at: "2026-07-13", value: 11200 },
    ] },
    c03: { avgCycleDays: 14, orders: [
      { at: "2026-07-20", value: 31500 }, { at: "2026-07-06", value: 29800 },
      { at: "2026-06-21", value: 33400 },
    ] },
    c04: { avgCycleDays: 7, orders: [
      { at: "2026-08-17", value: 27800 }, { at: "2026-08-10", value: 26400 },
      { at: "2026-08-03", value: 29100 },
    ] },
    c05: { avgCycleDays: 14, orders: [
      { at: "2026-08-15", value: 96300 }, { at: "2026-08-01", value: 88700 },
      { at: "2026-07-18", value: 91500 },
    ] },
    c11: { avgCycleDays: 5, orders: [
      { at: "2026-08-20", value: 18900 }, { at: "2026-08-15", value: 17600 },
      { at: "2026-08-10", value: 19400 }, { at: "2026-08-05", value: 16800 },
    ] },
  };

  /* ---- Per-customer offers, backing the Offers drawer -------------------
     OfferListView shows two columns only: Offer Name and Benefit. */
  const offers = {
    c01: [{ title: "Buy 10 Get 1 Free", benefit: "Free Item" }],
    c04: [{ title: "5% off on Catalogue 2 staples", benefit: "Percentage Discount" }],
    c05: [
      { title: "Buy 10 crates, get 1 free", benefit: "Free Item" },
      { title: "Flat ₹500 off above ₹10,000", benefit: "Flat Discount" },
    ],
    c11: [{ title: "Monsoon combo pack", benefit: "Bundle Price" }],
  };

  /* ---- Catalogue products, backing the Stock Count view -----------------
     StockCountView lists every product in the catalogue with its system stock
     so the admin can enter a physical count and see the difference. Shapes
     follow the product list the live view consumes (name, article number,
     category, per-unit system stock). */
  // `image` points at a local flat SVG in `img/` -- a pack-shaped tile per
  // sub-category, not the actual branded art, which this discovery has no
  // rights to. They replaced hotlinked Wikimedia Commons photos: with 86 SKUs
  // that was 86 cross-origin requests a rep in a shop pays for, and the whole
  // screen is the last thing in this snapshot that still reached the network.
  // The tiles are geometry only -- no text, so nothing depends on a font being
  // available when an SVG is loaded through <img>. `emoji` stays as the
  // fallback glyph for the render path with no room for a picture.
  const products = [
    { id: "p01", name: "AMLA PICKLE (1000 gm) (OLD MRP 700) NEW MRP 660", artNo: "405322000003173005", category: "PICKLE AND MURABBA", subCategory: "AMLA PICKLE", unit: "Box", systemStock: 0, emoji: "🫙", image: "img/jar-amber.svg" },
    { id: "p02", name: "AMLA PICKLE (475 gm) (OLD MRP 345) NEW MRP 325", artNo: "405322000001378130", category: "PICKLE AND MURABBA", subCategory: "AMLA PICKLE", unit: "Box", systemStock: 0, emoji: "🫙", image: "img/jar-amber.svg" },
    { id: "p03", name: "AMLA PICKLE (pet Jar) (OLD MRP 70) NEW MRP 65", artNo: "405322000003154070", category: "PICKLE AND MURABBA", subCategory: "AMLA PICKLE", unit: "Box", systemStock: 0, emoji: "🫙", image: "img/jar-amber.svg" },
    { id: "p04", name: "AMLA PICKLE (pet Jar) MRP 299", artNo: "405322000001645030", category: "PICKLE AND MURABBA", subCategory: "AMLA PICKLE", unit: "Box", systemStock: 0, emoji: "🫙", image: "img/jar-amber.svg" },
    { id: "p05", name: "ASSAM LEMON PICKLE (100 gm)(OLD MRP 60) NEW MRP 55", artNo: "405322000000574000", category: "PICKLE AND MURABBA", subCategory: "ASSAM LEMON PICKLE", unit: "Crate", systemStock: 200, emoji: "🍋", image: "img/jar-amber.svg" },
    { id: "p06", name: "ASSAM LEMON PICKLE (200 gm) (OLD MRP 140) NEW MRP 130", artNo: "405322000007538463", category: "PICKLE AND MURABBA", subCategory: "ASSAM LEMON PICKLE", unit: "Box", systemStock: 0, emoji: "🍋", image: "img/jar-amber.svg" },
    { id: "p07", name: "BAMBOO SHOOTS PICKLE N (pet Jar) MRP 200", artNo: "405322000001517000", category: "PICKLE AND MURABBA", subCategory: "BAMBOO SHOOT PICKLE", unit: "Box", systemStock: 200, emoji: "🎋", image: "img/jar-green.svg" },
    { id: "p08", name: "BAMBOO SHOOTS WITH KING CHILLI PICKLE ( Pet Jar) (OLD MRP 120) NEW MRP 115", artNo: "405322000004395000", category: "PICKLE AND MURABBA", subCategory: "BAMBOO SHOOT PICKLE", unit: "Box", systemStock: 200, emoji: "🎋", image: "img/jar-green.svg" },
    { id: "p09", name: "BAMBOO SHOOTS PICKLE (1000 g) (OLD MRP 700) NEW MRP 660/-", artNo: "405322000003418958", category: "PICKLE AND MURABBA", subCategory: "BAMBOO SHOOT PICKLE", unit: "Box", systemStock: 0, emoji: "🎋", image: "img/jar-green.svg" },
    { id: "p10", name: "BAMBOO SHOOTS PICKLE (475 g) OLD MRP 345 NEW MRP 325", artNo: "405322000001378099", category: "PICKLE AND MURABBA", subCategory: "BAMBOO SHOOT PICKLE", unit: "Box", systemStock: 0, emoji: "🎋", image: "img/jar-green.svg" },
    { id: "p11", name: "BAMBOO SHOOTS PICKLE (pet Jar) (OLD MRP 70) NEW MRP 65", artNo: "405322000003154034", category: "PICKLE AND MURABBA", subCategory: "BAMBOO SHOOT PICKLE", unit: "Box", systemStock: 0, emoji: "🎋", image: "img/jar-green.svg" },
    { id: "p12", name: "BAMBOO SHOOTS PICKLE . ( 200 gm) MRP 140", artNo: "405322000007538481", category: "PICKLE AND MURABBA", subCategory: "BAMBOO SHOOT PICKLE", unit: "Box", systemStock: 0, emoji: "🎋", image: "img/jar-green.svg" },
    { id: "p13", name: "BIRD EYE CHILLI PICKLE (Per Jar) OLD MRP 185 NEW MRP 175", artNo: "405322000003173000", category: "PICKLE AND MURABBA", subCategory: "BIRD EYE CHILLI", unit: "Box", systemStock: 400, emoji: "🌶️", image: "img/chilli.svg" },
    { id: "p14", name: "BIRD EYE CHILLI", artNo: "405322000001200000", category: "PICKLE AND MURABBA", subCategory: "BIRD EYE CHILLI", unit: "Box", systemStock: 200, emoji: "🌶️", image: "img/chilli.svg" },
    { id: "p15", name: "BIRD EYE CHILLI DRY", artNo: "405322000008119000", category: "PICKLE AND MURABBA", subCategory: "BIRD EYE CHILLI", unit: "Box", systemStock: 200, emoji: "🌶️", image: "img/chilli.svg" },
    { id: "p16", name: "BIRD EYE CHILLI PICKLE (100 gm) (OLD MRP 100) New MRP 95", artNo: "405322000003323470", category: "PICKLE AND MURABBA", subCategory: "BIRD EYE CHILLI", unit: "Box", systemStock: 0, emoji: "🌶️", image: "img/chilli.svg" },
    { id: "p17", name: "CUT BAMBOO GREEN VEGETABLE IN BRINE IN DRUM", artNo: "405322000000845000", category: "PICKLE AND MURABBA", subCategory: "FRESH BAMBOO SHOOT", unit: "Crate", systemStock: 200, emoji: "🎋", image: "img/bamboo.svg" },
    { id: "p18", name: "CUT BAMBOO GREEN VEGETABLE IN BRINE IN PP MRP 30", artNo: "405322000006213000", category: "PICKLE AND MURABBA", subCategory: "FRESH BAMBOO SHOOT", unit: "Box", systemStock: 200, emoji: "🎋", image: "img/bamboo.svg" },
    { id: "p19", name: "CUT BAMBOO GREEN VEGETABLE IN BRINE IN PET JAR MRP 70", artNo: "405322000003154052", category: "PICKLE AND MURABBA", subCategory: "FRESH BAMBOO SHOOT", unit: "Box", systemStock: 0, emoji: "🎋", image: "img/bamboo.svg" },
    { id: "p20", name: "DRY BAMBOO SHOOTS 20 G", artNo: "405322000009678019", category: "PICKLE AND MURABBA", subCategory: "DRY BAMBOO SHOOT", unit: "Box", systemStock: 0, emoji: "🎋", image: "img/bamboo.svg" },
    { id: "p21", name: "ELEPHANT APPLE PICKLE (100 gm) (OLD MRP 70) NEW MRP 65", artNo: "405322000004984000", category: "PICKLE AND MURABBA", subCategory: "ELEPHANT APPLE PICKLE", unit: "Box", systemStock: 200, emoji: "🍏", image: "img/jar-amber.svg" },
    { id: "p22", name: "FLAT RED RICE ( CHIRA)", artNo: "405322000009074000", category: "PICKLE AND MURABBA", subCategory: "FLAT RED RICE", unit: "Box", systemStock: 200, emoji: "🍚", image: "img/grain.svg" },
    { id: "p23", name: "Garcinia Cambogia", artNo: "405322000003221000", category: "PICKLE AND MURABBA", subCategory: "CARCINIA", unit: "Box", systemStock: 200, emoji: "🫙", image: "img/jar-amber.svg" },
    { id: "p24", name: "GARLIC PICKLE (100 gm) (OLD MRP 100) New MRP 95", artNo: "405322000000465000", category: "PICKLE AND MURABBA", subCategory: "GARLIC PICKLE", unit: "Box", systemStock: 200, emoji: "🧄", image: "img/jar-cream.svg" },
    { id: "p25", name: "GARLIC PICKLE (100 gm) MRP 80", artNo: "405322000003274000", category: "PICKLE AND MURABBA", subCategory: "GARLIC PICKLE", unit: "Box", systemStock: 200, emoji: "🧄", image: "img/jar-cream.svg" },
    { id: "p26", name: "GARLIC PICKLE (Pet Jar) MRP 399", artNo: "405322000001072000", category: "PICKLE AND MURABBA", subCategory: "GARLIC PICKLE", unit: "Box", systemStock: 200, emoji: "🧄", image: "img/jar-cream.svg" },
    { id: "p27", name: "GARLIC PICKLE (475 gm) Old MRP 495 New MRP 465", artNo: "405322000001378152", category: "PICKLE AND MURABBA", subCategory: "GARLIC PICKLE", unit: "Box", systemStock: 0, emoji: "🧄", image: "img/jar-cream.svg" },
    { id: "p28", name: "GREEN CHILLI PICKLE (200 gm) MRP 140", artNo: "405322000007538000", category: "PICKLE AND MURABBA", subCategory: "GREEN CHILLI PICKLE", unit: "Box", systemStock: 600, emoji: "🌶️", image: "img/jar-green.svg" },
    { id: "p29", name: "GREEN CHILLI PICKLE (100 gm) (OLD MRP 60) NEW MRP 55", artNo: "405322000000650186", category: "PICKLE AND MURABBA", subCategory: "GREEN CHILLI PICKLE", unit: "Box", systemStock: 0, emoji: "🌶️", image: "img/jar-green.svg" },
    { id: "p30", name: "INDIAN OLIVE PICKLE (1000 gm) (OLD MRP 700) NEW MRP 660", artNo: "405322000010046000", category: "PICKLE AND MURABBA", subCategory: "OLIVE PICKLE", unit: "Box", systemStock: 200, emoji: "🫒", image: "img/jar-olive.svg" },
    { id: "p31", name: "INDIAN OLIVE PICKLE (Pet Jar) MRP 140", artNo: "405322000007095000", category: "PICKLE AND MURABBA", subCategory: "OLIVE PICKLE", unit: "Box", systemStock: 200, emoji: "🫒", image: "img/jar-olive.svg" },
    { id: "p32", name: "INDIAN OLIVE PICKLE (475 gm) (OLD MRP 345) NEW MRP 325", artNo: "405322000001378117", category: "PICKLE AND MURABBA", subCategory: "OLIVE PICKLE", unit: "Box", systemStock: 0, emoji: "🫒", image: "img/jar-olive.svg" },
    { id: "p33", name: "INDIAN OLIVE PICKLE (Pet Jar) (OLD MRP 70) NEW MRP 65 .", artNo: "405322000003154043", category: "PICKLE AND MURABBA", subCategory: "OLIVE PICKLE", unit: "Box", systemStock: 0, emoji: "🫒", image: "img/jar-olive.svg" },
    { id: "p34", name: "INDIAN OLIVE PICKLE (Pet Jar) MRP 299", artNo: "405322000000416069", category: "PICKLE AND MURABBA", subCategory: "OLIVE PICKLE", unit: "Box", systemStock: 0, emoji: "🫒", image: "img/jar-olive.svg" },
    { id: "p35", name: "JACKFRUIT PICKLE (1000g) (OLD MRP 700)) NEW MRP 660/-", artNo: "405322000000646000", category: "PICKLE AND MURABBA", subCategory: "JACKFRUIT PICKLE", unit: "Box", systemStock: 200, emoji: "🍈", image: "img/jar-amber.svg" },
    { id: "p36", name: "JACKFRUIT PICKLE (475g) (OLD MRP 395) NEW MRP 365/-", artNo: "405322000003459000", category: "PICKLE AND MURABBA", subCategory: "JACKFRUIT PICKLE", unit: "Box", systemStock: 200, emoji: "🍈", image: "img/jar-amber.svg" },
    { id: "p37", name: "JACKFRUIT PICKLE (In Pet Jar) MRP 140", artNo: "405322000000846000", category: "PICKLE AND MURABBA", subCategory: "JACKFRUIT PICKLE", unit: "Box", systemStock: 200, emoji: "🍈", image: "img/jar-amber.svg" },
    { id: "p38", name: "JACKFRUIT PICKLE 100g (OLD MRP 70) NEW MRP 65", artNo: "405322000000617000", category: "PICKLE AND MURABBA", subCategory: "JACKFRUIT PICKLE", unit: "Box", systemStock: 200, emoji: "🍈", image: "img/jar-amber.svg" },
    { id: "p39", name: "JACKFRUIT PICKLE (1000g) MRP 600", artNo: "405322000003418967", category: "PICKLE AND MURABBA", subCategory: "JACKFRUIT PICKLE", unit: "Box", systemStock: 0, emoji: "🍈", image: "img/jar-amber.svg" },
    { id: "p40", name: "JUJUBE PICKLE (100 gm) (OLD MRP 60) NEW MRP 55", artNo: "405322000000522000", category: "PICKLE AND MURABBA", subCategory: "JUJUBE PICKLE", unit: "Box", systemStock: 200, emoji: "🫐", image: "img/jar-red.svg" },
    { id: "p41", name: "JUJUBE PICKLE (225 gm) MRP 120", artNo: "405322000005065000", category: "PICKLE AND MURABBA", subCategory: "JUJUBE PICKLE", unit: "Box", systemStock: 200, emoji: "🫐", image: "img/jar-red.svg" },
    { id: "p42", name: "JUJUBE PICKLE ( Pet Jar) OLD MRP 345 NEW MRP 325", artNo: "405322000001646000", category: "PICKLE AND MURABBA", subCategory: "JUJUBE PICKLE", unit: "Box", systemStock: 200, emoji: "🫐", image: "img/jar-red.svg" },
    { id: "p43", name: "JUJUBEE PICKLE (475 gm) (OLD MRP 345) NEW MRP 325", artNo: "405322000001378143", category: "PICKLE AND MURABBA", subCategory: "JUJUBE PICKLE", unit: "Box", systemStock: 0, emoji: "🫐", image: "img/jar-red.svg" },
    { id: "p44", name: "KING CHILLI PICKLE (Pet Jar) MRP 399", artNo: "405322000001645000", category: "PICKLE AND MURABBA", subCategory: "KING CHILLI PICKLE", unit: "Box", systemStock: 400, emoji: "🌶️", image: "img/chilli.svg" },
    { id: "p45", name: "KING CHILLI PICKLE (475 gm) OLD MRP 495 NEW MRP 465", artNo: "405322000009252000", category: "PICKLE AND MURABBA", subCategory: "KING CHILLI PICKLE", unit: "Box", systemStock: 200, emoji: "🌶️", image: "img/chilli.svg" },
    { id: "p46", name: "KING CHILLI PICKLE (pet Jar) (OLD MRP 185) NEW MRP 175", artNo: "405322000005980000", category: "PICKLE AND MURABBA", subCategory: "KING CHILLI PICKLE", unit: "Box", systemStock: 200, emoji: "🌶️", image: "img/chilli.svg" },
    { id: "p47", name: "KING CHILLI PICKLE 50g MRP 50", artNo: "405322000000496000", category: "PICKLE AND MURABBA", subCategory: "KING CHILLI PICKLE", unit: "Box", systemStock: 200, emoji: "🌶️", image: "img/chilli.svg" },
    { id: "p48", name: "KING CHILLI PICKLE (100 gm) (OLD MRP 100), NEW MRP 95", artNo: "405322000000416078", category: "PICKLE AND MURABBA", subCategory: "KING CHILLI PICKLE", unit: "Box", systemStock: 0, emoji: "🌶️", image: "img/chilli.svg" },
    { id: "p49", name: "KING CHILLI PICKLE (1000 gm) OLD MRP 1000 NEW MRP 950", artNo: "405322000000650010", category: "PICKLE AND MURABBA", subCategory: "KING CHILLI PICKLE", unit: "Box", systemStock: 0, emoji: "🌶️", image: "img/chilli.svg" },
    { id: "p50", name: "KING CHILLI PICKLE (pet Jar) MRP 200", artNo: "405322000001935650", category: "PICKLE AND MURABBA", subCategory: "KING CHILLI PICKLE", unit: "Box", systemStock: 0, emoji: "🌶️", image: "img/chilli.svg" },
    { id: "p51", name: "LIME IN BRINE (PET JAR) MRP 60/-", artNo: "405322000001684000", category: "PICKLE AND MURABBA", subCategory: "LIME PICKLE", unit: "Box", systemStock: 200, emoji: "🍋", image: "img/citrus.svg" },
    { id: "p52", name: "LEMON - GOL NEMU", artNo: "405322000001201003", category: "PICKLE AND MURABBA", subCategory: "LIME PICKLE", unit: "Box", systemStock: 0, emoji: "🍋", image: "img/citrus.svg" },
    { id: "p53", name: "MANGO PICKLE (1000g) (OLD MRP 700) NEW MRP 660/-", artNo: "405322000003418000", category: "PICKLE AND MURABBA", subCategory: "MANGO PICKLE", unit: "Box", systemStock: 600, emoji: "🥭", image: "img/jar-amber.svg" },
    { id: "p54", name: "MANGO PICKLE (pet Jar) (OLD MRP 70) NEW MRP 65", artNo: "405322000003323000", category: "PICKLE AND MURABBA", subCategory: "MANGO PICKLE", unit: "Box", systemStock: 400, emoji: "🥭", image: "img/jar-amber.svg" },
    { id: "p55", name: "MANGO PICKLE (Pet Jar) MRP 299", artNo: "405322000000650000", category: "PICKLE AND MURABBA", subCategory: "MANGO PICKLE", unit: "Box", systemStock: 600, emoji: "🥭", image: "img/jar-amber.svg" },
    { id: "p56", name: "Chatpata MANGO (100 gm) (OLD MRP 70) NEW MRP 65", artNo: "405322000007885000", category: "PICKLE AND MURABBA", subCategory: "MANGO PICKLE", unit: "Box", systemStock: 200, emoji: "🥭", image: "img/jar-amber.svg" },
    { id: "p57", name: "MANGO PICKLE (475 gm) OLD MRP 345 NEW MRP 325", artNo: "405322000001529000", category: "PICKLE AND MURABBA", subCategory: "MANGO PICKLE", unit: "Box", systemStock: 200, emoji: "🥭", image: "img/jar-amber.svg" },
    { id: "p58", name: "MANGO PICKLE (pet Jar) MRP 140", artNo: "405322000007011000", category: "PICKLE AND MURABBA", subCategory: "MANGO PICKLE", unit: "Box", systemStock: 200, emoji: "🥭", image: "img/jar-amber.svg" },
    { id: "p59", name: "MIXED PICKLE (475 gm) OLD MRP 345 NEW MRP 325", artNo: "405322000003262000", category: "PICKLE AND MURABBA", subCategory: "MIXED PICKLE", unit: "Box", systemStock: 200, emoji: "🫙", image: "img/jar-mixed.svg" },
    { id: "p60", name: "MIXED PICKLE (pet Jar) (OLD MRP 100) NEW MRP 95", artNo: "405322000001935641", category: "PICKLE AND MURABBA", subCategory: "MIXED PICKLE", unit: "Box", systemStock: 0, emoji: "🫙", image: "img/jar-mixed.svg" },
    { id: "p61", name: "SWEET LEMON PICKLE (pet Jar) MRP 60", artNo: "405322000005156000", category: "PICKLE AND MURABBA", subCategory: "SWEET LEMON PICKLE", unit: "Box", systemStock: 200, emoji: "🍋", image: "img/citrus.svg" },
    { id: "p62", name: "Sweet MANGO (100 gm) (OLD MRP 70) NEW MRP 65", artNo: "405322000004998000", category: "PICKLE AND MURABBA", subCategory: "SWEET LEMON PICKLE", unit: "Box", systemStock: 200, emoji: "🍋", image: "img/citrus.svg" },
    { id: "p63", name: "SWEET LEMON PICKLE (pet Jar) (OLD MRP 70) NEW MRP", artNo: "405322000003091142", category: "PICKLE AND MURABBA", subCategory: "SWEET LEMON PICKLE", unit: "Box", systemStock: 0, emoji: "🍋", image: "img/citrus.svg" },
    { id: "p64", name: "SWEET OLIVE PICKLE (pet Jar) (OLD MRP 75) New MRP 70", artNo: "405322000003154000", category: "PICKLE AND MURABBA", subCategory: "SWEET OLIVE PICKLE", unit: "Box", systemStock: 1000, emoji: "🫒", image: "img/jar-olive.svg" },
    { id: "p65", name: "SWEET OLIVE PICKLE (pet Jar) MRP 150", artNo: "405322000007096000", category: "PICKLE AND MURABBA", subCategory: "SWEET OLIVE PICKLE", unit: "Box", systemStock: 200, emoji: "🫒", image: "img/jar-olive.svg" },
    { id: "p66", name: "TAMARIN PICKLE (100 gm) (OLD MRP 60) New MRP 55", artNo: "405322000001935000", category: "PICKLE AND MURABBA", subCategory: "TAMARIN PICKLE", unit: "Box", systemStock: 600, emoji: "🫙", image: "img/jar-brown.svg" },
    { id: "p67", name: "Ghost peeper", artNo: "405322000000095000", category: "SPICE", subCategory: "GHOST PEPPER", unit: "Box", systemStock: 200, emoji: "🌶️", image: "img/chilli.svg" },
    { id: "p68", name: "GHOST PEPPER", artNo: "405322000000088000", category: "SPICE", subCategory: "GHOST PEPPER", unit: "Box", systemStock: 200, emoji: "🌶️", image: "img/chilli.svg" },
    { id: "p69", name: "GHOST PEPPER DRY SEEDS", artNo: "405322000000753000", category: "SPICE", subCategory: "GHOST PEPPER", unit: "Box", systemStock: 200, emoji: "🌶️", image: "img/chilli.svg" },
    { id: "p70", name: "GINGER DRY SAMPLE 002", artNo: "405322000000062000", category: "SPICE", subCategory: "GINGER", unit: "Box", systemStock: 200, emoji: "🫚", image: "img/root-ginger.svg" },
    { id: "p71", name: "GINGER POWDER", artNo: "405322000000190000", category: "SPICE", subCategory: "GINGER", unit: "Box", systemStock: 200, emoji: "🫚", image: "img/root-ginger.svg" },
    { id: "p72", name: "Moringa Dry Leaves", artNo: "405322000008911000", category: "SPICE", subCategory: "MORINGA LEAVES", unit: "Box", systemStock: 200, emoji: "🌿", image: "img/leaf.svg" },
    { id: "p73", name: "TURMERIC - FINGER", artNo: "405322000000203000", category: "SPICE", subCategory: "TURMERIC FINGER", unit: "Pp bag", systemStock: 200, emoji: "🫚", image: "img/root-turmeric.svg" },
    { id: "p74", name: "TURMERIC - LAKADONG (CHIPS)", artNo: "405322000000111000", category: "SPICE", subCategory: "TURMERIC LAKADONG CHIPS", unit: "Pp bag", systemStock: 200, emoji: "🫚", image: "img/pouch-dry.svg" },
    { id: "p75", name: "TURMERIC - LAKADONG (POWDER)", artNo: "405322000007106000", category: "SPICE", subCategory: "TURMERIC LAKADONG POWDER", unit: "Pp bag", systemStock: 200, emoji: "🫚", image: "img/pouch-turmeric.svg" },
    { id: "p76", name: "TURMERIC - LOCAL (POWDER)", artNo: "405322000003091000", category: "SPICE", subCategory: "TURMERIC LOCAL POWDER", unit: "Pp bag", systemStock: 400, emoji: "🫚", image: "img/pouch-turmeric.svg" },
    { id: "p77", name: "GINGER FRESH", artNo: "405322000000146000", category: "VEGETABLE", subCategory: "GINGER", unit: "Box", systemStock: 200, emoji: "🫚", image: "img/root-ginger.svg" },
    { id: "p78", name: "King Chilli Fresh", artNo: "405322000003573000", category: "VEGETABLE", subCategory: "KING CHILLI", unit: "Box", systemStock: 200, emoji: "🌶️", image: "img/chilli.svg" },
    { id: "p79", name: "OLIVES FRESH", artNo: "405322000001201000", category: "VEGETABLE", subCategory: "OLIVE FRESH", unit: "Box", systemStock: 400, emoji: "🫒", image: "img/olive.svg" },
    { id: "p80", name: "TURMERIC - FRESH", artNo: "405322000005661000", category: "VEGETABLE", subCategory: "TURMERIC FRESH", unit: "Pp bag", systemStock: 200, emoji: "🫚", image: "img/root-turmeric.svg" },
    { id: "p81", name: "Ice Cream Cone", artNo: "405322000000888000", category: "GROCERY", subCategory: "ICE CREAM CONE", unit: "Box", systemStock: 200, emoji: "🍦", image: "img/cone.svg" },
    { id: "p82", name: "MUKH SUDHI (DRY AMLA) 20 G MRP 40", artNo: "405322000009678000", category: "GROCERY", subCategory: "DRY AMLA", unit: "Box", systemStock: 400, emoji: "🫙", image: "img/pouch-dry.svg" },
    { id: "p83", name: "Mihas Kalkhar 500 ml (OLD MRP 60/-) NEW MRP 55/-", artNo: "405322000002951000", category: "GROCERY", subCategory: "KALKHAR", unit: "Box", systemStock: 200, emoji: "🧴", image: "img/bottle.svg" },
    { id: "p84", name: "MIHAS TURMERIC - LAKADONG (POWDER) MRP 85", artNo: "405322000001378000", category: "SPICES", subCategory: "TURMERIC", unit: "Box", systemStock: 1200, emoji: "🫚", image: "img/pouch-turmeric.svg" },
    { id: "p85", name: "MIHAS TURMERIC - LAKADONG (POWDER) MRP 30/-", artNo: "405322000009242000", category: "SPICES", subCategory: "TURMERIC", unit: "Box", systemStock: 200, emoji: "🫚", image: "img/pouch-turmeric.svg" },
    { id: "p86", name: "STICKY RICE (BORA CHAWAL)", artNo: "405322000006567000", category: "GRAIN", subCategory: "STICKY RICE (BORA CHAWAL)", unit: "Box", systemStock: 200, emoji: "🍚", image: "img/grain.svg" },
  ];

  /* ---- Tenant feature flags (localStorage `appProp` in the live app) ----
     These gate whole regions of the B2B screen. Toggle them here to role-play
     a different tenant configuration. bulkImportEnabled (and therefore
     sampleEnabled, which is nested under it) is OFF here to match the "QA
     store" As-is capture, which never shows Import / Export / Download Sample. */
  const appProp = {
    isTagFeatureEnabled: true,
    customerManagementFeatures: {
      bulkImportEnabled: false,
      deleteEnabled: true,
      stockEnabled: true,
      offerEnabled: true,
      sampleEnabled: false,
      catalogMappingEnabled: false,
      creditWalletMappingEnabled: false,
    },
    notification: { isEnabled: true },
  };

  window.SEED = {
    // Tenant + operator shown in the shell, read off the As-is capture.
    tenant: { name: "QA store", user: { name: "Mahesh", role: "Admin" } },
    location: LOCATION,
    // menu label — the live sidebar renames "Customers" per tenant via
    // useMenuLabel("customers"); this tenant calls them "B2B Customers".
    customersLabel: "B2B Customers",
    orgGstNumber: "27AAACQ1234A1Z9",
    pageSize: 20,
    catalogues,
    states,
    b2b,
    retail,
    stockAudits,
    orderingSignals,
    offers,
    products,
    appProp,
  };
})();

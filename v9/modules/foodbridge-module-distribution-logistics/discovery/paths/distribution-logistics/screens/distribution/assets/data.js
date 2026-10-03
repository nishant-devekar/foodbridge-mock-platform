/*
 * Seed data for the Distribution & Logistics discovery prototype.
 * Modelled on the live "QA store" storefront-admin screens so the HTML replica
 * shows the same rows, counts and detail fields as the real app.
 *
 * Shapes mirror what the React pages consume:
 *   routeTemplates → ManageRoutes.jsx (RouteTemplateService)
 *   customers/staff → SearchSelect assignment badges in RouteFormDrawer
 *   assets          → ReturnableProducts.jsx / ReturnableProductDrawer
 *   orgs            → ReverseLogisticDashboard.jsx (deriveStats / flattenRows)
 *   deliveryRoute   → route-delivery-app (mobile Route Delivery)
 *
 * Loaded as a plain script (window.SEED) so screens open over file:// with no
 * fetch/CORS setup. All numbers reconcile with the header stats:
 *   issued 111 · returned 101 · outstanding 10 · in-warehouse 104 · total 114.
 */
(function () {
  // ── Customers (id, display name, phone) ──────────────────────────────────
  const customers = [
    { id: "c-dinesh", name: "Dinesh Store", phone: "9087654454" },
    { id: "c-rana", name: "Rana Store", phone: "5655445654" },
    { id: "c-raman", name: "Raman", phone: "985673456" },
    { id: "c-newcust", name: "a new customer", phone: "9384594893" },
    { id: "c-aaimata", name: "Aai Mata General Store", phone: "82736450195" },
    { id: "c-ganraj", name: "Ganraj Kirana Mart", phone: "41589627074" },
    { id: "c-shreeram", name: "Shree Ram Super Market", phone: "56820973184" },
    { id: "c-newbharat", name: "New Bharat General Store", phone: "64082719536" },
    { id: "c-laxmi", name: "Laxmi Provision Store", phone: "97315042861" },
    { id: "c-raj", name: "Raj Traders", phone: "53197286440" },
    { id: "c-shivam", name: "Shivam Grocery Store", phone: "28946175318" },
    { id: "c-shreedatta", name: "Shree Datta Super Store", phone: "70631984512" },
    { id: "c-balaji", name: "Balaji General Store", phone: "85273140697" },
    { id: "c-krishna", name: "Krishna Kirana & General Store", phone: "19468572033" },
    { id: "c-omsai", name: "Om Sai Provision Store", phone: "34786019254" },
    { id: "c-mahalakshmi", name: "Mahalakshmi Super Mart", phone: "62819475306" },
    { id: "c-gajanan", name: "Gajanan General Store", phone: "76184530928" },
    { id: "c-ganesh", name: "Shree Ganesh Kirana", phone: "91527364081" },
    { id: "c-manjit", name: "Manjit Store", phone: "48392017465" },
    { id: "c-kunal", name: "Kunal Sweet Shop", phone: "3426645432" },
    { id: "c-manish", name: "Manish", phone: "655655656565" },
    { id: "c-raghav", name: "Raghav", phone: "666633373" },
    { id: "c-shubham", name: "Shubham Kashid", phone: "75072073487" },
    { id: "c-test", name: "Test", phone: "1521521521" },
  ];

  // ── Staff members ────────────────────────────────────────────────────────
  const staff = [
    { id: "s-nishant", name: "Nishant Devekar" },
    { id: "s-pawan", name: "Pawan Kaushish" },
    { id: "s-vishvajit", name: "Vishvajit" },
    { id: "s-kumar", name: "Kumar" },
    { id: "s-ajay", name: "Ajay" },
    { id: "s-mahesh", name: "Mahesh" },
  ];

  // ── Route templates (Delivery Templates tab) ─────────────────────────────
  // `created` drives newest-first sort (matches the live "- <date time>" names).
  const routeTemplates = [
    { id: "rt-1",  name: "route1 - 11 Aug 2026 12:57", customers: ["c-rana"], staffs: ["s-ajay"], created: "2026-08-11T12:57:00" },
    { id: "rt-2",  name: "Viman Nagar Clubed Orders - 11 Aug 2026 12:47", customers: ["c-dinesh", "c-rana", "c-raman"], staffs: ["s-nishant"], created: "2026-08-11T12:47:00" },
    { id: "rt-3",  name: "Evening Route - 11 Aug 2026 12:06", customers: ["c-ganraj"], staffs: ["s-pawan"], created: "2026-08-11T12:06:00" },
    { id: "rt-4",  name: "rana delivery - 11 Aug 2026 12:03", customers: ["c-rana"], staffs: ["s-kumar"], created: "2026-08-11T12:03:00" },
    { id: "rt-5",  name: "Viman Nagar Morning Route", customers: ["c-dinesh", "c-rana", "c-raman", "c-aaimata", "c-ganraj", "c-laxmi", "c-raj"], staffs: ["s-nishant", "s-vishvajit"], created: "2026-08-11T12:00:00" },
    { id: "rt-6",  name: "Gherdi - 11 Aug 2026 11:54", customers: ["c-shivam"], staffs: ["s-nishant", "s-pawan", "s-kumar"], created: "2026-08-11T11:54:00" },
    { id: "rt-7",  name: "Morning Route 76 - 11 Aug 2026 11:48", customers: ["c-balaji"], staffs: ["s-vishvajit"], created: "2026-08-11T11:48:00" },
    { id: "rt-8",  name: "Something Rout e 45 - 11 Aug 2026 11:43", customers: ["c-omsai"], staffs: ["s-kumar"], created: "2026-08-11T11:43:00" },
    { id: "rt-9",  name: "Morning Route 3 - 11 Aug 2026 11:42", customers: ["c-krishna"], staffs: ["s-pawan"], created: "2026-08-11T11:42:00" },
    { id: "rt-10", name: "Somethig ROute - 11 Aug 2026 11:41", customers: ["c-gajanan"], staffs: ["s-nishant"], created: "2026-08-11T11:41:00" },
    { id: "rt-11", name: "Morning Route - 11 Aug 2026 09:56", customers: ["c-manjit"], staffs: ["s-kumar"], created: "2026-08-11T09:56:00" },
    { id: "rt-12", name: "11th Aug 2026 Morning Delivery - 11 Aug 2026 01:11", customers: ["c-dinesh", "c-ganraj", "c-shreedatta", "c-ganesh"], staffs: ["s-vishvajit"], created: "2026-08-11T01:11:00" },
    { id: "rt-13", name: "Viman Nagar Route", customers: ["c-raman"], staffs: ["s-nishant"], created: "2026-08-10T18:20:00" },
    { id: "rt-14", name: "PCMC Route", customers: ["c-shivam", "c-raj", "c-balaji", "c-omsai", "c-newbharat"], staffs: ["s-pawan"], created: "2026-08-10T17:00:00" },
    { id: "rt-15", name: "Swarget Route", customers: ["c-krishna", "c-gajanan", "c-ganesh", "c-manjit", "c-mahalakshmi"], staffs: ["s-kumar"], created: "2026-08-10T16:30:00" },
    { id: "rt-16", name: "Hadapsar Route", customers: ["c-aaimata", "c-laxmi", "c-shreedatta", "c-shreeram", "c-newcust", "c-raman"], staffs: ["s-nishant", "s-vishvajit", "s-kumar"], created: "2026-08-10T15:10:00" },
  ];

  // ── Returnable assets ────────────────────────────────────────────────────
  // warehouse = "In Warehouse", withCustomers = sum of org outstanding (10),
  // total = warehouse + withCustomers = 114.
  const assets = [
    {
      id: "a-crate", name: "Crate", articleNo: "OsSa5a", category: "RETURNABLE",
      unit: "Crate", baseUnit: "undefined", barcode: "", hsn: "", brand: "",
      status: "ACTIVE", price: 0, taxRate: 0, warehouse: 104, withCustomers: 10,
      description: "", img: "crate,plastic",
    },
  ];

  // ── Reverse-logistics ledger per customer (org) ──────────────────────────
  // Each entry: issued/returned/outstanding for one asset, plus a ledger of
  // individual transactions (type ISSUE|RETURN, qty, date, by).
  const rl = (assetId, issued, returned, last, ledger) => {
    const a = assets.find((x) => x.id === assetId);
    return {
      assetId, assetName: a.name, articleNo: a.articleNo, measurement: a.unit,
      issued, returned, outstanding: issued - returned, lastTransactionDate: last,
      deliveredBy: "Mahesh", ledger: ledger || [],
    };
  };
  // ledger entry: { type: FORWARD (issue out) | REVERSE (return in), qty, date,
  // time, invoice, remarks }. Running "balance after" is derived in app.js by
  // walking each asset's ledger chronologically (FORWARD +qty, REVERSE −qty).
  const orgs = [
    { id: "c-kunal", name: "Kunal Sweet Shop", phone: "3426645432", reverseLogistics: [
      rl("a-crate", 10, 9, "2026-08-10", [
        { type: "FORWARD", qty: 10, date: "2026-08-05", time: "8:15 PM", invoice: "", remarks: "" },
        { type: "REVERSE", qty: 5, date: "2026-08-05", time: "8:16 PM", invoice: "", remarks: "" },
        { type: "REVERSE", qty: 3, date: "2026-08-10", time: "10:55 AM", invoice: "", remarks: "" },
        { type: "REVERSE", qty: 1, date: "2026-08-10", time: "10:56 AM", invoice: "", remarks: "" },
      ]),
    ] },
    { id: "c-manish", name: "Manish", phone: "655655656565", reverseLogistics: [
      rl("a-crate", 15, 15, "2026-06-02", [
        { type: "FORWARD", qty: 15, date: "2026-05-20", time: "9:10 AM", invoice: "", remarks: "" },
        { type: "REVERSE", qty: 15, date: "2026-06-02", time: "4:30 PM", invoice: "", remarks: "" },
      ]),
    ] },
    { id: "c-raghav", name: "Raghav", phone: "666633373", reverseLogistics: [
      rl("a-crate", 10, 10, "2026-06-02", [
        { type: "FORWARD", qty: 10, date: "2026-05-18", time: "11:00 AM", invoice: "", remarks: "" },
        { type: "REVERSE", qty: 10, date: "2026-06-02", time: "5:00 PM", invoice: "", remarks: "" },
      ]),
    ] },
    { id: "c-shreeram", name: "Shree Ram Super Market", phone: "56820973184", reverseLogistics: [
      rl("a-crate", 30, 26, "2026-08-11", [
        { type: "FORWARD", qty: 18, date: "2026-06-30", time: "10:20 AM", invoice: "", remarks: "" },
        { type: "REVERSE", qty: 16, date: "2026-07-22", time: "3:15 PM", invoice: "", remarks: "" },
        { type: "FORWARD", qty: 12, date: "2026-08-11", time: "9:05 AM", invoice: "", remarks: "" },
        { type: "REVERSE", qty: 10, date: "2026-08-11", time: "6:40 PM", invoice: "", remarks: "" },
      ]),
    ] },
    { id: "c-shubham", name: "Shubham Kashid", phone: "75072073487", reverseLogistics: [
      rl("a-crate", 31, 31, "2026-06-02", [
        { type: "FORWARD", qty: 31, date: "2026-05-25", time: "8:45 AM", invoice: "", remarks: "" },
        { type: "REVERSE", qty: 31, date: "2026-06-02", time: "2:10 PM", invoice: "", remarks: "" },
      ]),
    ] },
    { id: "c-test", name: "Test", phone: "1521521521", reverseLogistics: [
      rl("a-crate", 15, 10, "2026-08-05", [
        { type: "FORWARD", qty: 15, date: "2026-07-28", time: "12:30 PM", invoice: "", remarks: "" },
        { type: "REVERSE", qty: 10, date: "2026-08-05", time: "7:20 PM", invoice: "", remarks: "" },
      ]),
    ] },
  ];

  // ── Delivery Management — a live route on a driver's phone ───────────────
  const deliveryRoute = {
    id: "dr-1", name: "Viman Nagar Morning Route", staff: "Nishant Devekar",
    date: "2026-08-11", vehicle: "MH12 AB 4432",
    stops: [
      { seq: 1, customerId: "c-dinesh", name: "Dinesh Store", address: "Shop 4, Viman Nagar Rd", amount: 2450, items: 12, status: "delivered" },
      { seq: 2, customerId: "c-rana", name: "Rana Store", address: "Lane 6, Clover Park", amount: 1820, items: 8, status: "delivered" },
      { seq: 3, customerId: "c-raman", name: "Raman", address: "Nagar Rd, near Phoenix", amount: 640, items: 3, status: "pending" },
      { seq: 4, customerId: "c-aaimata", name: "Aai Mata General Store", address: "Datta Mandir Chowk", amount: 3110, items: 16, status: "pending" },
      { seq: 5, customerId: "c-ganraj", name: "Ganraj Kirana Mart", address: "Kharadi Bypass", amount: 980, items: 5, status: "pending" },
      { seq: 6, customerId: "c-laxmi", name: "Laxmi Provision Store", address: "Wadgaon Sheri", amount: 1560, items: 7, status: "pending" },
      { seq: 7, customerId: "c-raj", name: "Raj Traders", address: "Yerwada Main Rd", amount: 2240, items: 11, status: "pending" },
    ],
  };

  window.SEED = { routeTemplates, customers, staff, assets, orgs, deliveryRoute };
})();

/*
 * Seed data for the Delivery Management (Route Delivery) mobile prototype.
 * Modelled on the live "QA store" route-delivery-app screens. Loaded as a plain
 * script (window.DM_SEED) so screens open over file:// with no fetch/CORS setup.
 *
 * Shapes mirror the route-delivery-app models:
 *   products → catalogue loaded onto the truck
 *   routes   → today's beats; each has stops (customers) with a proxy order
 */
(function () {
  // Truck catalogue — price is per smallest unit, `truck` is stock on board.
  const products = [
    { id: "p-250", name: "250ML PET", unit: "Bottle", price: 10.5, truck: 1 },
    { id: "p-500", name: "500ML PET", unit: "Bottle", price: 15.75, truck: 2 },
    { id: "p-1l", name: "1LTR BOTTLE", unit: "Bottle", price: 21, truck: 0 },
    { id: "p-nat", name: "NATURAL WATER", unit: "Bottle", price: 60, truck: 0 },
    { id: "p-soda", name: "SODA 650ML", unit: "Bottle", price: 20, truck: 0 },
    { id: "p-mini", name: "Mini Bread 100gm", unit: "Pc", price: 8, truck: 0 },
    { id: "p-milk", name: "Milk Bread 200gm", unit: "Pc", price: 15, truck: 0 },
    { id: "p-jumbo", name: "Jumbo Bread 750gm", unit: "Pc", price: 45, truck: 0 },
    { id: "p-toast", name: "Toast (TR, Jeera, Suji) 200gm", unit: "Pc", price: 35, truck: 0 },
    { id: "p-milktoast", name: "Milk Toast 300gm (10pcs) (Std pkt)", unit: "Pc", price: 40, truck: 0 },
    { id: "p-pineapple", name: "Pineapple Toast 225gm", unit: "Pc", price: 30, truck: 0 },
  ];

  // A stop (customer) on a route. `order` = today's proxy order lines.
  const stop = (id, name, phone, order, status) => ({
    id, name, phone, order: order || [], status: status || "pending",
    collected: 0, paymentMode: null, overPayment: 0, addedOnRoute: false,
  });

  const routes = [
    {
      id: "r-cgh", name: "Chandigarh Route", date: "2026-08-11", time: "13:06",
      status: "in-progress", beatArea: "Chandigarh Route", startedAt: "13:06",
      stockLoaded: 60, openingCash: 500,
      stops: [
        stop("st-1", "Sharma Kirana", "9812345670", [{ productId: "p-500", qty: 6 }, { productId: "p-mini", qty: 10 }], "delivered"),
        stop("st-2", "Gupta Stores", "9812345671", [{ productId: "p-1l", qty: 4 }], "delivered"),
        stop("st-3", "Verma General", "9812345672", [{ productId: "p-250", qty: 12 }], "pending"),
      ],
      collected: 222,
    },
    {
      id: "r-route1", name: "route1", date: "2026-08-11", time: "12:57",
      status: "in-progress", beatArea: "route1",
      stockLoaded: 20, openingCash: 300,
      stops: [ stop("st-r1", "Rana Store", "5655445654", [{ productId: "p-500", qty: 4 }], "pending") ],
      collected: 0,
    },
    {
      id: "r-mr66", name: "Morning Route 66", date: "2026-08-11", time: null,
      status: "ready", beatArea: "Morning Route 66",
      stockLoaded: 0, openingCash: 0,
      stops: [ Object.assign(stop("st-dinesh", "Dinesh Store", "9087654454", [{ productId: "p-mini", qty: 47 }], "pending"), { credit: 428 }) ],
      collected: 0,
      // proxy order suggests loading 47 Mini Bread (auto-fill on Load Stock)
      proxyStock: [{ productId: "p-mini", qty: 47 }],
    },
    {
      id: "r-evening", name: "Evening Route", date: "2026-08-11", time: null,
      status: "ready", beatArea: "Evening Route",
      stockLoaded: 0, openingCash: 0,
      stops: [ stop("st-ev", "Ganraj Kirana Mart", "41589627074", [{ productId: "p-1l", qty: 8 }], "pending") ],
      collected: 0, proxyStock: [{ productId: "p-1l", qty: 8 }],
    },
    {
      id: "r-mr76", name: "Morning Route 76", date: "2026-08-11", time: null,
      status: "ready", beatArea: "Morning Route 76",
      stockLoaded: 0, openingCash: 0,
      stops: [ stop("st-76", "Balaji General Store", "85273140697", [{ productId: "p-500", qty: 6 }], "pending") ],
      collected: 0, proxyStock: [{ productId: "p-500", qty: 6 }],
    },
    {
      id: "r-mr3", name: "Morning Route 3", date: "2026-08-11", time: null,
      status: "ready", beatArea: "Morning Route 3",
      stockLoaded: 0, openingCash: 0,
      stops: [ stop("st-mr3", "Krishna Kirana", "19468572033", [{ productId: "p-mini", qty: 5 }], "pending") ],
      collected: 0, proxyStock: [{ productId: "p-mini", qty: 5 }],
    },
    {
      id: "r-mr", name: "Morning Route", date: "2026-08-11", time: null,
      status: "ready", beatArea: "Morning Route",
      stockLoaded: 0, openingCash: 0,
      stops: [ stop("st-mr", "Manjit Store", "48392017465", [{ productId: "p-soda", qty: 6 }], "pending") ],
      collected: 0, proxyStock: [{ productId: "p-soda", qty: 6 }],
    },
    {
      id: "r-stock", name: "Ttttyyy", date: "2026-08-11", time: null,
      status: "stock", beatArea: "Ttttyyy",
      stockLoaded: 0, openingCash: 0,
      stops: [
        stop("st-s1", "Kunal Sweet Shop", "3426645432", [{ productId: "p-mini", qty: 10 }], "pending"),
        stop("st-s2", "Shree Ram Super Market", "56820973184", [{ productId: "p-500", qty: 8 }], "pending"),
        stop("st-s3", "Raj Traders", "53197286440", [{ productId: "p-1l", qty: 4 }], "pending"),
        stop("st-s4", "Laxmi Provision Store", "97315042861", [{ productId: "p-250", qty: 12 }], "pending"),
      ],
      collected: 0, proxyStock: [{ productId: "p-mini", qty: 10 }, { productId: "p-500", qty: 8 }, { productId: "p-1l", qty: 4 }, { productId: "p-250", qty: 12 }],
    },
    {
      id: "r-vnc", name: "Viman Nagar Clubed Orders", date: "2026-08-11", time: null,
      status: "closed", beatArea: "Viman Nagar Clubed Orders",
      stockLoaded: 80, openingCash: 500,
      stops: [
        stop("st-v1", "Dinesh Store", "9087654454", [{ productId: "p-mini", qty: 20 }], "delivered"),
        stop("st-v2", "Rana Store", "5655445654", [{ productId: "p-500", qty: 12 }], "delivered"),
        stop("st-v3", "Raman", "985673456", [{ productId: "p-1l", qty: 6 }], "delivered"),
      ],
      collected: 0,
    },
  ];

  // Home dashboard headline stats (match the live tiles).
  const dashboard = { allDeliveries: 100, target: 38397, customers: 30, outstanding: 32 };

  // Route templates for the "+ New Delivery" flow. Picking one creates a fresh
  // delivery (route) seeded with that template's stops.
  const tstop = (name, phone, order) => ({ name, phone, order });
  const templates = [
    { id: "t-pune", name: "Pune Route", staff: 0, stops: [] },
    { id: "t-cgh", name: "Chandigargh Route", staff: 2, stops: [
      tstop("Sharma Kirana", "9812345670", [{ productId: "p-500", qty: 6 }]),
      tstop("Gupta Stores", "9812345671", [{ productId: "p-1l", qty: 4 }]),
      tstop("Verma General", "9812345672", [{ productId: "p-250", qty: 12 }]),
    ] },
    { id: "t-dadar", name: "Dadar Route", staff: 2, stops: [
      tstop("Dadar Kirana", "9800011111", [{ productId: "p-mini", qty: 15 }]),
      tstop("Sea View Store", "9800022222", [{ productId: "p-soda", qty: 6 }]),
      tstop("Plaza Mart", "9800033333", [{ productId: "p-500", qty: 10 }]),
    ] },
    { id: "t-sangola", name: "Sangola Route - 23 Jun 2026 11:51", staff: 1, stops: [
      tstop("Sangola General", "9700011111", [{ productId: "p-1l", qty: 6 }]),
      tstop("Bus Stand Store", "9700022222", [{ productId: "p-250", qty: 20 }]),
      tstop("Market Kirana", "9700033333", [{ productId: "p-mini", qty: 8 }]),
    ] },
    { id: "t-asdf", name: "asdfasdf - 23 Jun 2026 13:09", staff: 1, stops: [
      tstop("Test Shop", "9600011111", [{ productId: "p-500", qty: 4 }]),
    ] },
    { id: "t-asdf5", name: "asdf55555 - 23 Jun 2026 13:11", staff: 1, stops: [
      tstop("Demo Store A", "9500011111", [{ productId: "p-mini", qty: 5 }]),
      tstop("Demo Store B", "9500022222", [{ productId: "p-soda", qty: 3 }]),
    ] },
    { id: "t-hadapsar", name: "Hadapsar Route", staff: 3, stops: [
      tstop("Hadapsar Kirana", "9400011111", [{ productId: "p-500", qty: 8 }]),
      tstop("Magarpatta Store", "9400022222", [{ productId: "p-1l", qty: 6 }]),
      tstop("Amanora Mart", "9400033333", [{ productId: "p-250", qty: 14 }]),
    ] },
  ];

  window.DM_SEED = { products, routes, dashboard, templates, staff: "Mahesh" };
})();

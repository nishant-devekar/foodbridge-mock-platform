/*
 * Seed for Live Delivery Tracking (admin monitoring).
 * Loaded as a plain script (window.TRACK) so the screen opens over file://.
 *
 * Built ON TOP of the existing seeds rather than beside them:
 *   route names + staff  → data.js (SEED.routeTemplates, SEED.staff)
 *   stop statuses        → the delivery app's vocabulary: pending | delivered | skipped
 *   cash / stock fields  → route.openingCash, route.stockLoaded, stop.collected
 *
 * Nothing here invents a status the driver app cannot produce. See
 * ../../../instructions/addendum-004-live-delivery-tracking.md (design rule under
 * "What was read before designing").
 *
 * COORDINATES ARE INVENTED (divergence V2). They sit on real Pune geography so the
 * basemap is meaningful, but no point here is a real customer address.
 */
(function () {
  // Depot — where every route starts and settles.
  const depot = { name: "QA store depot", lat: 18.5619, lng: 73.9143 };

  /* A stop. `plannedAt` is the schedule from Route Planning; `actualAt` is what the
     driver app reported. The gap between them is the whole point of this screen. */
  const stop = (seq, name, lat, lng, plannedAt, o) =>
    Object.assign(
      {
        id: "s-" + seq + "-" + Math.round(lat * 1e4),
        seq, name, lat, lng, plannedAt,
        actualAt: null,
        status: "pending",      // pending | delivered | skipped
        amount: 0,
        collected: 0,
        paymentMode: null,      // cash | upi | credit
        items: 0,
        note: null,
      },
      o || {}
    );

  const routes = [
    {
      id: "r-vn",
      name: "Viman Nagar Morning Route",
      beatArea: "Viman Nagar",
      driver: "Ajay",
      driverId: "s-ajay",
      phone: "9820011231",
      vehicle: "MH 12 AB 4471",
      stage: "on-route",        // ready | loading | on-route | settling | done
      startedAt: "09:12",
      openingCash: 500,
      stockLoaded: 150,
      lastPingMin: 1,
      speedKmph: 24,
      progress: 0.52,           // 0..1 along the path, advanced by the clock
      stops: [
        stop(1, "Sharma Kirana", 18.5674, 73.9143, "09:30", { status: "delivered", actualAt: "09:28", amount: 512, collected: 512, paymentMode: "cash", items: 16 }),
        stop(2, "Gupta Stores", 18.5701, 73.9187, "09:50", { status: "delivered", actualAt: "09:47", amount: 288, collected: 288, paymentMode: "upi", items: 4 }),
        stop(3, "Aai Mata General Store", 18.5732, 73.9221, "10:15", { status: "delivered", actualAt: "10:19", amount: 940, collected: 940, paymentMode: "cash", items: 22 }),
        stop(4, "Ganraj Kirana Mart", 18.5766, 73.9168, "10:40", { status: "skipped", actualAt: "10:44", note: "Shop shut — owner asked for tomorrow", items: 8 }),
        stop(5, "Shree Ram Super Market", 18.5798, 73.9124, "11:05", { status: "delivered", actualAt: "11:12", amount: 1640, collected: 1200, paymentMode: "credit", items: 31, note: "Rs 440 left on credit" }),
        stop(6, "New Bharat General Store", 18.5822, 73.9081, "11:30", { status: "delivered", actualAt: "11:41", amount: 620, collected: 620, paymentMode: "cash", items: 12 }),
        stop(7, "Laxmi Provision Store", 18.5851, 73.9037, "11:55", { status: "pending", amount: 430, items: 9 }),
        stop(8, "Raj Traders", 18.5879, 73.8994, "12:20", { status: "pending", amount: 1180, items: 24 }),
        stop(9, "Shivam Grocery Store", 18.5904, 73.8951, "12:45", { status: "pending", amount: 260, items: 6 }),
      ],
    },
    {
      id: "r-kh",
      name: "Kharadi Route",
      beatArea: "Kharadi",
      driver: "Kumar",
      driverId: "s-kumar",
      phone: "9820011232",
      vehicle: "MH 12 CD 8820",
      stage: "on-route",
      startedAt: "09:05",
      openingCash: 300,
      stockLoaded: 120,
      lastPingMin: 27,          // stale — this is an exception in its own right (D6)
      speedKmph: 0,
      progress: 0.34,
      stops: [
        stop(1, "Shree Datta Super Store", 18.5512, 73.9412, "09:25", { status: "delivered", actualAt: "09:24", amount: 745, collected: 745, paymentMode: "cash", items: 18 }),
        stop(2, "Balaji General Store", 18.5548, 73.9455, "09:50", { status: "delivered", actualAt: "09:52", amount: 390, collected: 390, paymentMode: "upi", items: 7 }),
        stop(3, "Krishna Kirana & General Store", 18.5581, 73.9498, "10:20", { status: "pending", amount: 1320, items: 27 }),
        stop(4, "Om Sai Provision Store", 18.5617, 73.9536, "10:50", { status: "pending", amount: 480, items: 11 }),
        stop(5, "Mahalakshmi Super Mart", 18.5652, 73.9574, "11:20", { status: "pending", amount: 2050, items: 38 }),
        stop(6, "Gajanan General Store", 18.5688, 73.9611, "11:50", { status: "pending", amount: 310, items: 5 }),
      ],
    },
    {
      id: "r-pcmc",
      name: "PCMC Route",
      beatArea: "Pimpri-Chinchwad",
      driver: "Vishvajit",
      driverId: "s-vishvajit",
      phone: "9820011233",
      vehicle: "MH 14 EF 2093",
      stage: "on-route",
      startedAt: "08:40",
      openingCash: 800,
      stockLoaded: 145,
      lastPingMin: 2,
      speedKmph: 31,
      progress: 0.78,
      stops: [
        stop(1, "Shree Ganesh Kirana", 18.6280, 73.8010, "09:00", { status: "delivered", actualAt: "08:58", amount: 1450, collected: 1450, paymentMode: "cash", items: 29 }),
        stop(2, "Manjit Store", 18.6244, 73.7962, "09:25", { status: "delivered", actualAt: "09:26", amount: 680, collected: 680, paymentMode: "cash", items: 14 }),
        stop(3, "Kunal Sweet Shop", 18.6209, 73.7914, "09:50", { status: "delivered", actualAt: "09:48", amount: 2310, collected: 2310, paymentMode: "upi", items: 44 }),
        stop(4, "Rana Store", 18.6173, 73.7866, "10:15", { status: "delivered", actualAt: "10:14", amount: 520, collected: 520, paymentMode: "cash", items: 10 }),
        stop(5, "Dinesh Store", 18.6138, 73.7818, "10:40", { status: "delivered", actualAt: "10:38", amount: 875, collected: 875, paymentMode: "cash", items: 19 }),
        stop(6, "Raman", 18.6102, 73.7770, "11:05", { status: "pending", amount: 640, items: 13 }),
      ],
    },
    {
      id: "r-hd",
      name: "Hadapsar Evening Route",
      beatArea: "Hadapsar",
      driver: "Pawan Kaushish",
      driverId: "s-pawan",
      phone: "9820011234",
      vehicle: "MH 12 GH 5514",
      stage: "loading",
      startedAt: null,
      openingCash: 0,
      stockLoaded: 0,
      lastPingMin: 4,
      speedKmph: 0,
      progress: 0,
      stops: [
        stop(1, "Manish", 18.5089, 73.9260, "14:30", { amount: 340, items: 8 }),
        stop(2, "Raghav", 18.5052, 73.9304, "14:55", { amount: 1120, items: 21 }),
        stop(3, "Shubham Kashid", 18.5018, 73.9348, "15:20", { amount: 760, items: 15 }),
      ],
    },
    {
      id: "r-bn",
      name: "Baner Route",
      beatArea: "Baner",
      driver: "Mahesh",
      driverId: "s-mahesh",
      phone: "9820011235",
      vehicle: "MH 12 JK 7702",
      stage: "settling",
      startedAt: "07:50",
      openingCash: 400,
      stockLoaded: 80,
      lastPingMin: 6,
      speedKmph: 0,
      progress: 1,
      settlement: { stockCount: true, cashHandover: false },
      stops: [
        stop(1, "Aai Mata General Store", 18.5590, 73.7868, "08:10", { status: "delivered", actualAt: "08:09", amount: 980, collected: 980, paymentMode: "cash", items: 20 }),
        stop(2, "Raj Traders", 18.5625, 73.7822, "08:35", { status: "delivered", actualAt: "08:33", amount: 415, collected: 415, paymentMode: "upi", items: 9 }),
        stop(3, "Test", 18.5661, 73.7776, "09:00", { status: "delivered", actualAt: "09:04", amount: 1230, collected: 1230, paymentMode: "cash", items: 25 }),
        stop(4, "Kunal Sweet Shop", 18.5696, 73.7730, "09:25", { status: "delivered", actualAt: "09:22", amount: 560, collected: 560, paymentMode: "cash", items: 11 }),
      ],
    },
  ];

  /* Messages the office has sent to a van. Appended to by the "message driver"
     intervention, so the drawer's activity feed is real rather than decorative. */
  const messages = [
    { routeId: "r-kh", at: "11:02", from: "office", text: "No ping for a while — everything ok?" },
  ];

  window.TRACK = { depot, routes, messages, clock: "12:04" };
})();

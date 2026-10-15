/*
 * Vasu Foods (29 Sep 2026) — Distribution & Logistics on the business's one
 * record (v7/assets/production/production-api.js, loaded before this file).
 *
 *   Route Planning     the three van routes out of Samana and each day's trips,
 *                      with the customers and the driver on each
 *   Logistic Returns   the insulated crates the vans leave with shops and dhabas
 *                      for loose packets, and what came back on the next drop
 *   Live Tracking      today's vans, from the plant at Samana to Patiala,
 *                      Rajpura, Zirakpur, Patran and Sangrur, stop by stop
 *
 * Coordinates are the towns' own, a little apart per shop; no point is a real
 * customer address.
 */
(function () {
  const P = window.FB_PRODUCTION;
  if (!P || !window.SEED) return;
  try {
    P.read(function (D, d) {
      const DAY = 86400000, now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const ymd = (t) => { const x = new Date(t); return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()); };
      const hm = (t) => { const x = new Date(t); return pad(x.getHours()) + ":" + pad(x.getMinutes()); };
      const label = (t) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + " " + hm(t);
      const cust = {}; d.customers.forEach((c) => { cust[c.id] = c; });
      const staff = {}; d.team.forEach((m) => { staff[m.id] = m; });
      const route = {}; d.routes.forEach((r) => { route[r.id] = r; });

      /* Route Planning */
      const customers = d.customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone }));
      const staffList = d.team.filter((m) => m.role === "DRIVER" || m.role === "STORE").map((m) => ({ id: m.id, name: m.name }));
      const trips = d.deliveries.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const routeTemplates = d.routes.map((r, i) => ({ id: r.id, name: r.name, customers: d.customers.filter((c) => c.routeId === r.id && c.type !== "CONSUMER").map((c) => c.id), staffs: [r.staffId], created: new Date(now.getTime() - (200 + i) * DAY).toISOString().slice(0, 19) }))
        .concat(trips.slice(0, 12).map((v) => ({ id: v.id, name: (route[v.routeId] || { name: "Trip" }).name + " - " + label(v.createdAt),
          customers: [...new Set(v.dispatchIds.map((id) => (D.dispatchById(id) || {}).customerId).filter(Boolean))], staffs: [v.staffId], created: v.createdAt.slice(0, 19) })))
        .sort((a, b) => (a.created < b.created ? 1 : -1));

      /* Logistic Returns: insulated crates for the loose-packet drops (shops and dhabas) */
      const PER_CRATE = 40;
      const asset = { id: "a-crate", name: "Insulated Crate (returnable)", articleNo: "RET-ICR-01", category: "RETURNABLE", unit: "Crate", baseUnit: "Crate", barcode: "", hsn: "3923", brand: "Vasu",
        status: "ACTIVE", price: 650, taxRate: 18, warehouse: 0, withCustomers: 0, description: "Thermocol-lined crate for loose packets; comes back on the next drop.", img: "crate,plastic" };
      const orgs = [];
      d.customers.filter((c) => c.type === "RETAILER" || c.type === "HORECA").forEach((c) => {
        const drops = d.dispatches.filter((x) => x.customerId === c.id && x.status === "Delivered" && x.deliveredAt && new Date(x.deliveredAt) > new Date(now.getTime() - 45 * DAY))
          .sort((a, b) => (a.deliveredAt < b.deliveredAt ? -1 : 1));
        if (!drops.length) return;
        const ledger = [];
        drops.forEach((x, i) => {
          const n = Math.max(1, Math.ceil(x.items.reduce((t, it) => t + it.qty, 0) / PER_CRATE));
          ledger.push({ type: "FORWARD", qty: n, date: ymd(x.deliveredAt), time: new Date(x.deliveredAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }).toUpperCase(), invoice: x.invoice.no, remarks: "" });
          /* the previous drop's crates come back with this one — all but the odd one kept a few days */
          if (i > 0) {
            const prev = ledger.filter((e) => e.type === "FORWARD")[i - 1].qty;
            const back = (c.id.length + i) % 5 === 0 ? Math.max(0, prev - 1) : prev;
            if (back) ledger.push({ type: "REVERSE", qty: back, date: ymd(x.deliveredAt), time: "", invoice: "", remarks: back < prev ? "One crate still at the shop" : "" });
          }
        });
        const issued = ledger.filter((e) => e.type === "FORWARD").reduce((t, e) => t + e.qty, 0), returned = ledger.filter((e) => e.type === "REVERSE").reduce((t, e) => t + e.qty, 0);
        const rt = route[c.routeId] || {};
        orgs.push({ id: c.id, name: c.name, phone: c.phone, reverseLogistics: [{ assetId: asset.id, assetName: asset.name, articleNo: asset.articleNo, measurement: asset.unit,
          issued, returned, outstanding: issued - returned, lastTransactionDate: ledger[ledger.length - 1].date, deliveredBy: (staff[rt.staffId] || {}).name || "Van", ledger }] });
      });
      asset.withCustomers = orgs.reduce((t, o) => t + o.reverseLogistics[0].outstanding, 0);
      asset.warehouse = 120 - asset.withCustomers;

      /* today's trip on a driver's phone */
      const today = trips.find((v) => ymd(v.createdAt) === ymd(now)) || trips[0];
      const tripStops = (v) => v.dispatchIds.map((id) => D.dispatchById(id)).filter(Boolean);
      const drvOf = (v) => staff[v.staffId] || {};
      const deliveryRoute = today ? { id: today.id, name: (route[today.routeId] || {}).name, staff: drvOf(today).name, date: ymd(today.createdAt), vehicle: (drvOf(today).vehicle || "").split(" · ")[0],
        stops: tripStops(today).map((x, i) => { const c = cust[x.customerId]; return { seq: i + 1, customerId: c.id, name: c.name, address: c.address + ", " + c.city, amount: x.invoice.amount, items: x.items.reduce((t, it) => t + it.qty, 0), status: x.status === "Delivered" ? "delivered" : "pending" }; }) } : { stops: [] };

      Object.assign(window.SEED, { routeTemplates, customers, staff: staffList, assets: [asset], orgs, deliveryRoute, vasu: true });

      /* Live Tracking */
      if (!window.TRACK_VASU_PENDING) return;
      const GEO = { Samana: [30.151, 76.193], Patran: [29.957, 76.070], Patiala: [30.340, 76.386], Rajpura: [30.484, 76.594], Zirakpur: [30.642, 76.817], Sangrur: [30.245, 75.844], Ghagga: [29.990, 76.083] };
      const jig = (id, k) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997; return (((h * (k + 3)) % 100) - 50) / 10000; };
      const STAGE = { "Delivery Created": "loading", "Vehicle Loading Completed": "ready", "Out for Delivery": "on-route" };
      const todays = trips.filter((v) => ymd(v.createdAt) === ymd(now));
      const shown = todays.concat(trips.filter((v) => ymd(v.createdAt) !== ymd(now)).slice(0, Math.max(0, 3 - todays.length)));
      window.TRACK_VASU = {
        depot: { name: d.business.name + " · plant, " + d.business.city, lat: 30.1515, lng: 76.1925 },
        routes: shown.map((v, ri) => {
          const past = ymd(v.createdAt) !== ymd(now), drv = drvOf(v), rt = route[v.routeId] || {};
          const xs = tripStops(v);
          const start = new Date(v.createdAt).getTime() + 70 * 60000;
          const stops = xs.map((x, i) => {
            const c = cust[x.customerId], g = GEO[c.city] || GEO.Samana, delivered = x.status === "Delivered";
            const got = d.payments.filter((p) => p.kind === "in" && p.allocations.some((a) => a.no === x.invoice.no) && /Collected by/.test(p.ref || "")).reduce((t, p) => t + p.amount, 0);
            return { id: "s-" + x.id, seq: i + 1, name: c.name, lat: g[0] + jig(c.id, 1), lng: g[1] + jig(c.id, 2), plannedAt: hm(start + (i + 1) * 55 * 60000),
              actualAt: delivered && x.deliveredAt ? hm(x.deliveredAt) : null, status: delivered ? "delivered" : "pending", amount: x.invoice.amount, collected: Math.round(got),
              paymentMode: delivered ? (got ? "cash" : "credit") : null, items: x.items.reduce((t, it) => t + it.qty, 0), note: null };
          });
          const done = stops.filter((st) => st.status === "delivered").length;
          const stage = past ? (ri % 2 ? "done" : "settling") : STAGE[v.status] || "ready";
          return { id: v.id, name: rt.name, beatArea: (rt.name || "").split(" – ")[0], driver: drv.name, driverId: drv.id, phone: drv.phone, vehicle: (drv.vehicle || "").split(" · ")[0],
            stage, startedAt: stage === "on-route" || past ? hm(start) : null, openingCash: stage === "loading" ? 0 : 1000, stockLoaded: stops.reduce((t, st) => t + st.items, 0),
            lastPingMin: stage === "on-route" ? 2 : 6, speedKmph: stage === "on-route" ? 38 : 0, progress: stops.length ? done / stops.length : 0, stops };
        }),
        messages: [],
        clock: hm(now),
      };
    });
  } catch (e) { console.error("Distribution & Logistics: the business store could not be read", e); }
})();

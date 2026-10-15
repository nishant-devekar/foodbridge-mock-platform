/* ============================================================
   vasu-seed.js — Reports on Vasu Foods (29 Sep 2026)
   ------------------------------------------------------------
   In the platform, Reports reads the business's ONE record — the
   production store (v7/assets/production/production-api.js), loaded
   just before this file — instead of the Murli seed above it. Every
   section is built from the same orders, dispatches, invoices,
   receipts and van trips the other modules show, so a figure here
   is a figure in Sales Orders, Finance and the Control Tower.
   ============================================================ */
(function () {
  "use strict";
  var P = window.FB_PRODUCTION, S = window.SEED;
  if (!P || !S) return;
  try {
    P.read(function (D, d) {
      var DAY = 86400000, now = new Date();
      var pad = function (n) { return String(n).padStart(2, "0"); };
      var ymd = function (t) { var x = new Date(t); return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()); };
      var hm = function (t) { return new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase(); };
      var r2 = function (n) { return Math.round(n * 100) / 100; };
      var today = ymd(now), yday = ymd(now.getTime() - DAY);
      var month = today.slice(0, 7), lastMonth = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 15)).slice(0, 7);
      var gst = d.business.gstPct / 100;
      var cust = {}; d.customers.forEach(function (c) { cust[c.id] = c; });
      var route = {}; d.routes.forEach(function (r) { route[r.id] = r; });
      var staff = {}; d.team.forEach(function (m) { staff[m.id] = m; });
      var live = d.orders.filter(function (o) { return o.status !== "Cancelled"; });
      var periodOf = function (t) { var k = ymd(t); return { today: k === today, yesterday: k === yday, thisMonth: k.slice(0, 7) === month, lastMonth: k.slice(0, 7) === lastMonth }; };

      /* the tiles: what was ordered, by when */
      var sumWhere = function (f) { return r2(live.filter(function (o) { return f(periodOf(o.placedAt)); }).reduce(function (t, o) { return t + o.amount; }, 0)); };
      var kpis = [
        { id: "todayOrders", label: "Today Orders", value: sumWhere(function (p) { return p.today; }), icon: "▤", tone: "today" },
        { id: "yesterdayOrders", label: "Yesterday Orders", value: sumWhere(function (p) { return p.yesterday; }), icon: "▤", tone: "yesterday" },
        { id: "thisMonth", label: "This Month", value: sumWhere(function (p) { return p.thisMonth; }), icon: "🛒", tone: "month" },
        { id: "lastMonth", label: "Last Month", value: sumWhere(function (p) { return p.lastMonth; }), icon: "▭", tone: "lastmonth" },
        { id: "allTimeSales", label: "All-Time Sales", value: sumWhere(function () { return true; }), icon: "▭", tone: "alltime" },
      ];

      /* product sales, per period */
      var productSales = d.skus.map(function (s) {
        var per = { today: null, yesterday: null, thisMonth: null, lastMonth: null, allTime: null };
        live.forEach(function (o) {
          var p = periodOf(o.placedAt);
          o.items.forEach(function (i) {
            if (i.skuId !== s.id) return;
            var v = i.qty * i.price * (1 + gst);
            ["today", "yesterday", "thisMonth", "lastMonth"].concat(["allTime"]).forEach(function (k) {
              if (k !== "allTime" && !p[k]) return;
              per[k] = per[k] || { qty: 0, sales: 0 };
              per[k].qty += i.qty; per[k].sales = r2(per[k].sales + v);
            });
          });
        });
        return { id: s.id, name: s.name, code: s.article, unit: "Pkt", periods: per };
      }).filter(function (p) { return p.periods.allTime; });

      /* orders, newest first, with how far each has gone */
      var paidOf = function (so) {
        var inv = d.dispatches.filter(function (x) { return x.orderId === so.id && x.invoice && !x.invoice.cancelled; }).map(function (x) { return x.invoice; });
        if (!inv.length) return "Payment Pending";
        var amt = inv.reduce(function (t, i) { return t + i.amount; }, 0), paid = inv.reduce(function (t, i) { return t + (i.paid || 0); }, 0);
        return paid >= amt - 0.5 ? "Paid" : paid > 0 ? "Partially Paid" : "Payment Pending";
      };
      var statusOf = function (so) {
        if (so.status === "Cancelled") return "Cancelled";
        var xs = d.dispatches.filter(function (x) { return x.orderId === so.id && x.status !== "Rejected"; });
        if (!xs.length) return "Inprogress";
        return !D.isOpen(so) && xs.every(function (x) { return x.status === "Delivered"; }) ? "Delivered" : "Dispatched";
      };
      var orders = d.orders.slice().sort(function (a, b) { return a.placedAt < b.placedAt ? 1 : -1; }).slice(0, 150).map(function (o) {
        var c = cust[o.customerId] || {};
        var xs = d.dispatches.filter(function (x) { return x.orderId === o.id; });
        var dl = d.deliveries.filter(function (v) { return v.dispatchIds.some(function (id) { return xs.some(function (x) { return x.id === id; }); }); });
        var fulfilment = [];
        if (xs.length) fulfilment.push({ kind: "dispatch", count: xs.length });
        if (dl.length) fulfilment.push({ kind: "delivery", count: dl.length });
        return { id: o.number, date: ymd(o.placedAt), time: hm(o.placedAt), customer: { name: c.name, phone: c.phone, email: null }, amount: o.amount, paymentStatus: paidOf(o), status: statusOf(o), fulfilment: fulfilment,
          items: o.items.map(function (i) { var k = D.sku(i.skuId), rate = r2(i.price * (1 + gst)); return { name: k ? k.name : i.skuId, qty: i.qty, unit: "Pkt", rate: rate, amount: r2(rate * i.qty) }; }) };
      });

      /* who to chase: customers quiet for longer than their usual gap */
      var lastOf = {}, countOf = {};
      live.forEach(function (o) { countOf[o.customerId] = (countOf[o.customerId] || 0) + 1; if (!lastOf[o.customerId] || o.placedAt > lastOf[o.customerId]) lastOf[o.customerId] = o.placedAt; });
      var catalogueOf = { COMMISSION_AGENT: "Commission Agents · Mandi", DISTRIBUTOR: "Distributors", HORECA: "HoReCa · 5 kg packs", RETAILER: "Shops & walk-in", CONSUMER: "Shops & walk-in" };
      var trading = d.customers.filter(function (c) { return c.every > 0; });
      var since = function (c) { return lastOf[c.id] ? Math.floor((now - new Date(lastOf[c.id])) / DAY) : 99; };
      var followUpCustomers = trading.filter(function (c) { return since(c) >= 2; }).map(function (c) {
        return { id: c.id, name: c.name, phone: c.phone, catalogue: catalogueOf[c.type], daysSinceOrder: since(c), email: null, address: c.address + ", " + c.city };
      });

      /* what the price lists gave away: list price less each customer's price */
      var discountByCustomer = live.filter(function (o) { return ymd(o.placedAt) > ymd(now.getTime() - 14 * DAY); }).sort(function (a, b) { return a.placedAt < b.placedAt ? 1 : -1; }).map(function (o) {
        var c = cust[o.customerId] || {};
        var lines = o.items.map(function (i) { var k = D.sku(i.skuId), list = r2(k.price * i.qty * (1 + gst)), net = r2(i.price * i.qty * (1 + gst)); return { name: k.name, code: k.article, qty: i.qty, unit: "Pkt", orderValue: list, discount: r2(list - net), netValue: net }; });
        var ov = r2(lines.reduce(function (t, l) { return t + l.orderValue; }, 0)), dv = r2(lines.reduce(function (t, l) { return t + l.discount; }, 0));
        return { date: ymd(o.placedAt), time: hm(o.placedAt), customer: { name: c.name, phone: c.phone }, orderValue: ov, discount: dv, discountPct: ov ? Math.round(dv / ov * 1000) / 10 : 0, netValue: r2(ov - dv),
          orders: [{ id: o.number, date: ymd(o.placedAt), products: lines }] };
      });
      var byRoute = {};
      discountByCustomer.forEach(function (row, i) {
        var c = d.customers.filter(function (x) { return x.name === row.customer.name; })[0], rt = c && route[c.routeId];
        var k = row.date + "|" + (rt ? rt.name : "—");
        var g = byRoute[k] || (byRoute[k] = { date: row.date, time: "07:00 pm", route: rt ? rt.name : "—", orders: 0, orderValue: 0, discount: 0 });
        g.orders += 1; g.orderValue = r2(g.orderValue + row.orderValue); g.discount = r2(g.discount + row.discount);
      });
      var discountByRoute = Object.keys(byRoute).map(function (k) { var g = byRoute[k]; g.discountPct = g.orderValue ? Math.round(g.discount / g.orderValue * 1000) / 10 : 0; g.netValue = r2(g.orderValue - g.discount); return g; })
        .sort(function (a, b) { return a.date < b.date ? 1 : -1; });

      /* the order cycle: each customer's usual gap, and where they are in it */
      var ago = function (n) { return n === 0 ? "today" : n < 7 ? n + " days ago" : n < 14 ? "1 week ago" : n < 30 ? Math.floor(n / 7) + " weeks ago" : n < 60 ? "1 month ago" : Math.floor(n / 30) + " months ago"; };
      var orderCycle = trading.map(function (c) {
        var n = since(c), cyc = c.every;
        return { customer: c.name, ordersTotal: countOf[c.id] || 0, lastOrdered: lastOf[c.id] ? ymd(lastOf[c.id]) : "", lastOrderedAgo: ago(n), cadenceLabel: cyc === 7 ? "Every week" : "Every " + cyc + "d", cadenceDays: cyc, daysSince: n,
          status: n > cyc * 3 ? "not_ordering" : n > cyc ? "overdue" : n >= cyc - 1 ? "due_soon" : "on_track" };
      }).sort(function (a, b) { return (b.daysSince - b.cadenceDays) - (a.daysSince - a.cadenceDays); });

      /* the vans: what each trip collected in cash and UPI */
      var salesmanRouteReport = d.deliveries.slice(-20).reverse().map(function (v) {
        var st = staff[v.staffId] || {}, rt = route[v.routeId] || { name: "Route" };
        var inv = v.dispatchIds.map(function (id) { var x = D.dispatchById(id); return x && x.invoice && x.invoice.no; }).filter(Boolean);
        var got = d.payments.filter(function (p) { return p.kind === "in" && p.allocations.some(function (a) { return inv.indexOf(a.no) !== -1; }) && /Collected by/.test(p.ref || ""); });
        var cash = r2(got.filter(function (p) { return p.mode === "Cash"; }).reduce(function (t, p) { return t + p.amount; }, 0)), upi = r2(got.filter(function (p) { return p.mode === "UPI"; }).reduce(function (t, p) { return t + p.amount; }, 0));
        var expense = 350 + (v.dispatchIds.length * 40);
        return { route: rt.name + " · " + new Date(v.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), date: ymd(v.createdAt), salesman: st.name, cash: cash, upi: upi, totalCollected: r2(cash + upi),
          openingCash: 1000, expense: expense, handedOver: r2(1000 + cash - expense), difference: 0 };
      });

      /* recovery: what is owed, and why it is stuck */
      var recoveryOutstanding = D.receivables().filter(function (a) { return a.outstanding > 0.5; }).map(function (a) {
        var c = a.customer, rt = route[c.routeId] || {}, open = a.invoices.filter(function (i) { return i.balance > 0; });
        var ret = d.returns.some(function (r) { return r.customerId === c.id && r.status === "Return Created"; });
        var cause = ret ? "disputed" : c.payLate >= 30 ? "habitual_late" : a.overdue > 0 && open.some(function (i) { return i.overdueDays > 7; }) ? "terms_exceeded" : a.overdue > 0 ? "unclassified" : "habitual_late";
        var why = { disputed: "Packets came back thawed — a return is at the gate; the invoice waits on the credit note.", habitual_late: c.creditDays + "-day terms; pays, but usually " + (c.payLate || 7) + " days late.",
          terms_exceeded: c.creditDays + "-day terms; oldest open invoice is " + Math.max.apply(null, open.map(function (i) { return i.overdueDays; })) + " days overdue.", unclassified: "Nobody has recorded why this is late yet." }[cause];
        return { id: c.id, customer: c.name, phone: c.phone, route: rt.name || "—", salesman: (staff[rt.staffId] || {}).name || "Rohit Sachdeva", cause: cause, lastContact: open.length ? ymd(open[open.length - 1].at) : today,
          reason: why, outstanding: a.outstanding, invoices: open.map(function (i) { return { invoiceNo: i.no, date: ymd(i.at), amount: r2(i.balance) }; }) };
      });

      Object.assign(S, {
        tenant: Object.assign({}, S.tenant, { name: d.business.name, user: { name: d.business.owner, role: d.business.role }, asOf: now.toISOString() }),
        kpis: kpis, productSales: productSales, orders: orders, followUpReminders: followUpCustomers.length, followUpCustomers: followUpCustomers,
        discountByCustomer: discountByCustomer, discountByRoute: discountByRoute, orderCycle: orderCycle, salesmanRouteReport: salesmanRouteReport,
        routeTemplates: d.routes.map(function (r) { return r.name; }), routes: d.routes.map(function (r) { return r.name; }),
        staff: d.team.map(function (m) { return m.name; }), recoveryOutstanding: recoveryOutstanding, vasu: true,
      });
    });
  } catch (e) { console.error("Reports: the business store could not be read", e); }
})();

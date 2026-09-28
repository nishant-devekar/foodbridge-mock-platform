/*
  Vasu Foods (29 Sep 2026) — the storefront behind the Store QR code, on the
  business's one record (v7/assets/production/production-api.js, loaded
  before this file).

  The shop that scanned the QR is Aggarwal Super Store, Samana — one of Vasu's
  retailers. It sees Vasu's packs at its own price with what is free to sell,
  its own past orders as Sales Orders has them, and an order it places here is
  placed in Sales Orders under the same number (Production Plan sees it too).
*/
(function () {
  "use strict";
  var P = window.FB_PRODUCTION;
  if (!P) return;
  var SHOP = "cus-aggarwal";
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var ymd = function (t) { var x = new Date(t); return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()); };
  var time = function (t) { return new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }); };
  var CAT = { "frozen-peas": "frozen-peas", "mixed-veg": "mixed-veg", "soya-chaap": "soya-chaap", "soya-chaap-premium": "vasu-gold", "soya-chaap-plain": "soya-chaap" };

  function apply(seed, seed2, seed5) {
    P.read(function (D, d) {
      var b = d.business, c = D.customer(SHOP), gst = b.gstPct;
      seed2.store = { name: b.name, subtitle: "Frozen peas, mixed vegetables & soya chaap · Vasu and Vasu Gold", location: b.city + ", " + b.state, verified: true, logoInitial: "V",
        phone: "+91 " + b.phone, whatsapp: "+91 " + b.phone, gstin: b.gstin, supportHours: "8AM – 8PM", year: new Date().getFullYear() };
      seed2.account = { initials: "AS", name: c.name, role: "Owner" };
      seed2.promo = { badge: "Vasu Gold week", headline: "Premium stick chaap — ask for it by the master carton", validTill: new Date(Date.now() + 5 * 864e5).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ", 8:00 PM",
        offerCount: d.skus.filter(function (s) { return s.recipeId === "soya-chaap-premium"; }).length, freeDeliveryAbove: 3000 };
      seed2.categoriesV2 = [{ id: "all", label: "All" }, { id: "offers", label: "Offers" }, { id: "buy-again", label: "Buy again" }, { id: "frozen-peas", label: "Frozen Peas" },
        { id: "mixed-veg", label: "Mixed Vegetables" }, { id: "soya-chaap", label: "Soya Chaap" }, { id: "vasu-gold", label: "Vasu Gold" }, { id: "new", label: "New Arrivals" }];
      var bought = {};
      d.orders.forEach(function (o) { if (o.customerId === SHOP) o.items.forEach(function (i) { bought[i.skuId] = 1; }); });
      seed5.productsV5 = d.skus.filter(function (s) { return !s.retired; }).map(function (s) {
        var price = D.priceFor(SHOP, s.id), mrp = Math.ceil(s.price * 1.3 / 5) * 5;
        return { id: s.id, name: s.name, brand: s.brand || "Vasu", category: CAT[s.recipeId] || "all", packSize: (s.grams >= 1000 ? s.grams / 1000 + " kg" : s.grams + " g") + " pouch · " + s.perCarton + " to a carton",
          price: price, mrp: mrp, discount: Math.round((1 - price / mrp) * 100), available: D.availableToSell(s.id), offer: s.recipeId === "soya-chaap-premium", buyAgain: !!bought[s.id],
          addedDate: ymd(Date.now() - (s.id === "fg-p15" ? 5 : 90) * 864e5), taxRate: gst, perCarton: s.perCarton };
      });
      var mine = d.orders.filter(function (o) { return o.customerId === SHOP; }).sort(function (a, b2) { return a.placedAt < b2.placedAt ? 1 : -1; });
      var stepOf = function (o) {
        if (o.status === "Cancelled") return "Cancelled";
        var xs = d.dispatches.filter(function (x) { return x.orderId === o.id; });
        if (!xs.length) return "Pending";
        return xs.every(function (x) { return x.status === "Delivered"; }) && !D.isOpen(o) ? "Delivered" : xs.some(function (x) { return x.status === "Delivered"; }) ? "Out for Delivery" : "Packed";
      };
      var paidOf = function (o) {
        var inv = d.dispatches.filter(function (x) { return x.orderId === o.id && x.invoice; }).map(function (x) { return x.invoice; });
        if (!inv.length) return "Pending";
        return inv.every(function (i) { return (i.paid || 0) >= i.amount - 0.5; }) ? "Paid" : "Pending";
      };
      var month = ymd(Date.now()).slice(0, 7);
      var orders = mine.slice(0, 20).map(function (o) {
        var st = stepOf(o), steps = ["Order Placed", "Packed", "Out for Delivery", "Delivered"], k = st === "Pending" ? 0 : steps.indexOf(st);
        var sub = Math.round(o.taxable), tax = Math.round(o.gst);
        return { id: o.number, date: ymd(o.placedAt), time: time(o.placedAt), status: st, total: o.amount, subtotal: sub, tax: tax, deliveryCharge: 0,
          paymentMode: c.creditDays ? c.creditDays + "-day credit" : "Pay on delivery", paymentStatus: paidOf(o), deliveryAddress: c.address + ", " + c.city,
          items: o.items.map(function (i) { var s = D.sku(i.skuId); return { name: s ? s.name : i.skuId, qty: i.qty, price: i.price, total: Math.round(i.qty * i.price * 100) / 100, unit: "Pc" }; }),
          timeline: steps.map(function (label, n) { return { step: label, at: n === 0 ? time(o.placedAt) : "", done: n <= k }; }) };
      });
      seed5.purchasesV5 = { thisMonthTotal: Math.round(mine.filter(function (o) { return ymd(o.placedAt).slice(0, 7) === month; }).reduce(function (t, o) { return t + o.amount; }, 0)),
        openOrders: orders.filter(function (o) { return o.status !== "Delivered" && o.status !== "Cancelled"; }).length, delivered: orders.filter(function (o) { return o.status === "Delivered"; }).length,
        pendingActive: orders.filter(function (o) { return o.status === "Pending"; }).length, orders: orders };
      seed5.customer = Object.assign({}, seed5.customer, { profileComplete: true, name: c.person, mobile: c.phone, avatarInitials: "AS",
        addresses: [{ id: "a1", label: c.name, detail: c.address + ", " + c.city + ", Punjab " + "147101", default: true }] });
      seed5.storeDetails = { mapQuery: b.name + ", " + b.address + ", " + b.city + ", Punjab" };
    });
  }

  /* an order placed here, placed in Sales Orders under the same number */
  function place(id, lines) {
    try {
      P.write(function (D) {
        D.placeOrder({ customerId: SHOP, number: id, via: "storefront", where: "Storefront", by: "Aggarwal Super Store", paymentMethod: "cod",
          items: lines.map(function (l) { var s = D.sku(l.id); return { skuId: l.id, qty: l.unit === "Box" && s ? l.qty * s.perCarton : l.qty, price: l.unit === "Box" && s ? l.price / s.perCarton : l.price }; }) });
      });
    } catch (e) { if (typeof console !== "undefined") console.error("Vasu store: storefront order", e); }
  }

  window.VASU_STOREFRONT = { apply: apply, place: place };
})();

/* ==========================================================================
   Vasu Foods (29 Sep 2026) — what the driver records, in the business's
   one record (v7/assets/production/production-api.js).

     Collect at a stop     the dispatch is delivered: its packets leave
                           Finished Goods (oldest first), and what was taken
                           in cash or UPI is a receipt against the invoice
     A later payment       a receipt against the customer's oldest invoices
     A return              a return against the customer's latest delivery,
                           for the store to accept

   Loaded after services.js. When the store is not on the page (the module
   opened on its own), nothing here runs and the app is as it was.
   ========================================================================== */
(function () {
  "use strict";
  var P = window.FB_PRODUCTION, SDK = window.RD_SDK, DB = window.RD_DB;
  if (!P || !SDK || !DB) return;
  var rd = SDK.routeDelivery;
  var MODE = { CASH: "Cash", UPI: "UPI", CHEQUE: "Cheque", CREDIT: null };
  var driver = function () { return (DB.db.driver && DB.db.driver.name) || "Driver"; };
  var safely = function (what, fn) { try { return fn(); } catch (e) { if (typeof console !== "undefined") console.error("Vasu store: " + what, e); return null; } };

  var collect = rd.collectPayment;
  rd.collectPayment = function (o) {
    var res = collect.apply(this, arguments);
    var d = DB.db.stopDetails[o.stopId];
    if (d && d.dispatchId) {
      safely("deliver", function () {
        P.write(function (D) {
          var x = D.dispatchById(d.dispatchId);
          if (x && x.status === "Dispatch Created") D.deliver(x.id, { by: driver(), via: "app", where: "Delivery app" });
          var mode = MODE[o.method];
          if (mode && Number(o.amount) > 0) D.receipt({ customerId: d.customerId, amount: Number(o.amount), mode: mode, ref: "Collected by " + driver(), by: driver(), where: "Delivery app" });
        });
      });
    }
    return res;
  };

  var later = rd.recordRoutePayment;
  rd.recordRoutePayment = function (o) {
    var res = later.apply(this, arguments);
    if (!o.isWriteoff && Number(o.paymentAmount) > 0) {
      safely("payment", function () {
        P.write(function (D) { if (D.customer(o.customerId)) D.receipt({ customerId: o.customerId, amount: Number(o.paymentAmount), mode: MODE[o.paymentMethod] || "Cash", ref: "Collected by " + driver(), by: driver(), where: "Delivery app" }); });
      });
    }
    return res;
  };

  var ret = rd.createRouteReturn;
  rd.createRouteReturn = function (o) {
    var res = ret.apply(this, arguments);
    safely("return", function () {
      P.write(function (D, d) {
        var x = d.dispatches.filter(function (y) { return y.customerId === o.orgId && y.status === "Delivered"; }).pop();
        if (!x) return;
        var items = (o.items || []).map(function (i) { return { skuId: i.productId, qty: Number(i.qty) || 0 }; }).filter(function (i) { return i.qty > 0 && D.sku(i.skuId); });
        if (items.length) D.createReturn(x.id, { items: items, reason: o.reason || "", by: driver() });
      });
    });
    return res;
  };
})();

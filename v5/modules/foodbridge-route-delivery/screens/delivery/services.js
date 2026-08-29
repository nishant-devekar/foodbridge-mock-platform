/* ==========================================================================
   DELIVERY MANAGEMENT — service layer

   The Route Delivery app talks to a backend SDK. This is that SDK's shape,
   answered entirely from the in-memory seed, ported from:

     app source   storefront-frontend/src/route-delivery-app/services/mock/sdkMock.js

   All 43 methods the real service layer calls are here, so every screen and
   every branch has something to talk to: routes and stops, stock load and
   restock, payments and write-offs, booking, returns, asset movement,
   settlement, analytics and reports.

   Every method returns { toPromise() } so call sites read exactly as they do
   against the real SDK. Writes mutate the seed db, which is what makes the
   prototype feel live -- collect a payment and the route total moves.
   ========================================================================== */

(function () {
  "use strict";

  var D = window.RD_DB;
  var requireRoute        = D.requireRoute;
  var getStops            = D.getStops;
  var requireStop         = D.requireStop;
  var advanceToNextStop   = D.advanceToNextStop;
  var syncRouteAggregates = D.syncRouteAggregates;
  var logActivity         = D.logActivity;
  var resolveStopDetail   = D.resolveStopDetail;
  var uid = D.uid, now = D.now;

  /**
   * sdkMock.js — Test double for @exagon-ai/frontend-client-lib.
   *
   * Provides `routeDelivery`, `settlement`, and `productService` namespaces
   * that mirror the SDK interface but delegate to the in-memory seed db.
   * Each method returns a lazy wrapper with `.toPromise()` so the
   * service wrappers in routeService.js / stopService.js / etc. can call
   * `.toPromise()` without modification.
   *
   * In this static cut it is the only implementation -- there is no other SDK.
   */


  const ok = (data) => ({ toPromise: () => Promise.resolve(data), data, errors: [] });

  const notFound = (msg) => {
    const e = new Error(msg);
    e.code = 'NOT_FOUND';
    return Promise.reject(e);
  };

  // ─── routeDelivery ────────────────────────────────────────────────────────────

  const routeDelivery = {
    listTodayRoutes(opts = {}) {
      let routes = D.db.routes;
      if (opts.date) routes = routes.filter(r => r.scheduledDate === opts.date);
      return ok({ driver: D.db.driver, routes });
    },

    getRoute({ routeId }) {
      const route = D.db.routeDetails[routeId];
      if (!route) {
        const e = new Error(`Route ${routeId} not found`); e.code = 'NOT_FOUND'; throw e;
      }
      return ok(route);
    },

    confirmStockLoad({ routeId, products, deviceTimestamp }) {
      const route       = requireRoute(routeId);
      const confirmedAt = deviceTimestamp || now();
      const loaded      = products || [];
      const totalUnits     = loaded.reduce((s, p) => s + (p.loadedQty || 0), 0);
      const estimatedValue = loaded.reduce((s, p) => s + (p.loadedQty || 0) * (p.unitPrice || 0), 0);

      route.checklist.stockLoad = { status: 'COMPLETED', totalUnits, estimatedValue, confirmedAt };
      D.db.stockLoads[routeId] = { status: 'COMPLETED', confirmedAt, products: loaded, summary: { totalUnits, estimatedValue } };
      logActivity(routeId, 'STOCK_LOAD_CONFIRMED', { totalUnits, estimatedValue });

      return ok({ checklistStep: 'STOCK_LOAD', status: 'COMPLETED', totalUnits, estimatedValue, confirmedAt });
    },

    recordOpeningCash({ routeId, amount, deviceTimestamp }) {
      const route       = requireRoute(routeId);
      const confirmedAt = deviceTimestamp || now();
      route.checklist.openingCash = { status: 'COMPLETED', amount, confirmedAt };
      logActivity(routeId, 'OPENING_CASH_RECORDED', { amount });
      return ok({ checklistStep: 'OPENING_CASH', status: 'COMPLETED', amount, confirmedAt });
    },

    startRoute({ routeId, confirmedByDriver, deviceTimestamp }) {
      const route     = requireRoute(routeId);
      const startedAt = deviceTimestamp || now();

      if (route.status === 'IN_PROGRESS') {
        return ok({
          routeId, status: 'IN_PROGRESS', startedAt: route.startedAt,
          summary: {
            stockLoadedUnits:  route.checklist.stockLoad.totalUnits  || 0,
            openingCashAmount: route.checklist.openingCash.amount     || 0,
            totalStops: route.totalStops, beatArea: route.beatArea,
          },
        });
      }

      route.checklist.signOff = { status: 'COMPLETED', confirmedAt: startedAt };
      route.status    = 'IN_PROGRESS';
      route.startedAt = startedAt;
      route.updatedAt = startedAt;
      const summary = D.db.routes.find(r => r.id === routeId);
      if (summary) summary.status = 'IN_PROGRESS';
      const stops = getStops(routeId);
      if (!stops.some(s => s.status === 'CURRENT')) advanceToNextStop(routeId);
      logActivity(routeId, 'ROUTE_STARTED', { startedAt, confirmedByDriver });

      return ok({
        routeId, status: 'IN_PROGRESS', startedAt,
        summary: {
          stockLoadedUnits:  route.checklist.stockLoad.totalUnits  || 0,
          openingCashAmount: route.checklist.openingCash.amount     || 0,
          totalStops: route.totalStops, beatArea: route.beatArea,
        },
      });
    },

    listStops({ routeId }) {
      const all = getStops(routeId);
      if (!all.length) {
        const e = new Error(`Route ${routeId} not found`); e.code = 'NOT_FOUND'; throw e;
      }
      const current   = all.find(s => s.status === 'CURRENT');
      const collected = all.reduce((a, s) => a + (s.collectedAmount || 0), 0);
      return ok({
        progress: {
          currentStopSequence: current?.sequence ?? null,
          totalStops:   all.length,
          collectedAmount: collected,
          deliveredCount:  all.filter(s => s.status === 'DELIVERED').length,
          skippedCount:    all.filter(s => s.status === 'SKIPPED').length,
          pendingCount:    all.filter(s => s.status === 'PENDING' || s.status === 'CURRENT').length,
        },
        stops: all,
      });
    },

    getStopDetails({ stopId, routeId }) {
      if (routeId) requireRoute(routeId);
      const detail = resolveStopDetail(routeId, stopId);
      if (!detail) {
        const e = new Error(`Stop ${stopId} not found`); e.code = 'NOT_FOUND'; throw e;
      }
      return ok(detail);
    },

    collectPayment({ routeId, stopId, amount, method, sendInvoice, deviceTimestamp }) {
      const stop = requireStop(routeId, stopId);
      if (stop.status === 'DELIVERED') {
        const e = new Error('Stop already delivered'); e.code = 'ALREADY_COMPLETED'; throw e;
      }
      const collectedAt          = deviceTimestamp || now();
      const outstandingRemaining = Math.max(0, (stop.outstandingAmount || 0) - amount);
      stop.status           = 'DELIVERED';
      stop.collectedAmount  = amount;
      stop.paymentMethod    = method;
      stop.completedAt      = collectedAt;
      stop.outstandingAmount = outstandingRemaining;
      if (D.db.stopDetails[stopId]) {
        Object.assign(D.db.stopDetails[stopId], { status: 'DELIVERED', collectedAmount: amount, paymentMethod: method, completedAt: collectedAt, outstandingAmount: outstandingRemaining });
      }
      const nextStop = advanceToNextStop(routeId);
      syncRouteAggregates(routeId);
      return ok({
        stopId, status: 'DELIVERED',
        amountCollected: amount, method, outstandingRemaining,
        invoiceQueued: sendInvoice || false,
        nextStop: nextStop ? { id: nextStop.id, sequence: nextStop.sequence, customerName: nextStop.customerName, outstandingAmount: nextStop.outstandingAmount } : null,
        collectedAt,
      });
    },

    skipStop({ routeId, stopId, reason, note, deviceTimestamp }) {
      const stop = requireStop(routeId, stopId);
      if (stop.status === 'DELIVERED' || stop.status === 'SKIPPED') {
        const e = new Error('Stop already completed'); e.code = 'ALREADY_COMPLETED'; throw e;
      }
      const skippedAt  = deviceTimestamp || now();
      const followUpId = uid('FUP');
      stop.status     = 'SKIPPED';
      stop.skipReason = reason;
      stop.completedAt = skippedAt;
      if (D.db.stopDetails[stopId]) {
        Object.assign(D.db.stopDetails[stopId], { status: 'SKIPPED', skipReason: reason, completedAt: skippedAt });
      }
      const nextStop = advanceToNextStop(routeId);
      syncRouteAggregates(routeId);
      return ok({
        stopId, status: 'SKIPPED', reason,
        followUpCreated: true, followUpId,
        nextStop: nextStop ? { id: nextStop.id, sequence: nextStop.sequence, customerName: nextStop.customerName, outstandingAmount: nextStop.outstandingAmount } : null,
      });
    },

    getStockCountSheet({ routeId }) {
      const stockLoad = D.db.stockLoads[routeId];
      if (!stockLoad) {
        const e = new Error(`No stock load for route ${routeId}`); e.code = 'NOT_FOUND'; throw e;
      }
      const stops     = getStops(routeId);
      const delivered = stops.filter(s => s.status === 'DELIVERED').length;
      const items = stockLoad.products.map(p => {
        const soldEstimate   = Math.round(p.loadedQty * (delivered / Math.max(stops.length, 1)));
        const expectedReturn = Math.max(0, p.loadedQty - soldEstimate);
        return { productId: p.productId, name: p.name, unitPrice: p.unitPrice, loadedQty: p.loadedQty, expectedReturn, actualCount: null };
      });
      return ok({ items });
    },

    getRouteTimeline({ routeId, page = 1, pageSize = 30 } = {}) {
      const log    = D.db.activityLog[routeId] || [];
      const sorted = [...log].sort((a, b) => a.createdAt < b.createdAt ? -1 : 1);
      const total  = sorted.length;
      const start  = (page - 1) * pageSize;
      const paged  = sorted.slice(start, start + pageSize);
      return ok({ routeId, events: paged, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 } });
    },

    addStopNote({ stopId, routeId, text, authorId, deviceTimestamp }) {
      return ok({ id: `${stopId}-${deviceTimestamp}`, stopId, text, authorId: authorId || 'DRV-001', createdAt: deviceTimestamp });
    },

    searchCustomers({ query = '', page = 1, pageSize = 20 } = {}) {
      let results = D.db.customers;
      if (query) {
        const q = query.toLowerCase();
        results = results.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
      }
      const total = results.length;
      const start = (page - 1) * pageSize;
      const paged = results.slice(start, start + pageSize);
      return ok({ customers: paged, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 } });
    },

    getPaymentHistory(routeId) {
      const stops     = getStops(routeId);
      const delivered = stops.filter(s => s.status === 'DELIVERED');
      const payments  = delivered.map(s => ({
        stopId: s.id, customerName: s.customerName, sequence: s.sequence,
        invoiceNumber: '', amount: s.collectedAmount, method: s.paymentMethod,
        collectedAt: s.completedAt, hasOutstanding: (s.outstandingAmount || 0) > 0,
      }));
      const totalCash   = payments.filter(p => p.method === 'CASH').reduce((a, p) => a + p.amount, 0);
      const totalUpi    = payments.filter(p => p.method === 'UPI').reduce((a, p) => a + p.amount, 0);
      const totalCredit = payments.filter(p => p.method === 'CREDIT').reduce((a, p) => a + p.amount, 0);
      return ok({ routeId, payments, summary: { totalCash, totalUpi, totalCredit, total: totalCash + totalUpi + totalCredit } });
    },

    // ─── Methods added for the offline mock build ───────────────────────────────
    // The service layer migrated to the real SDK and grew past what this double
    // covered; these 17 close that gap so every screen works with no network.

    // Same payload as listTodayRoutes — the "basic" endpoint differs only in that the
    // backend skips the per-route aggregate joins, which cost nothing in memory.
    listTodayRoutesBasic(opts = {}) {
      let routes = D.db.routes;
      if (opts.date) routes = routes.filter(r => r.scheduledDate === opts.date);
      return ok({ driver: D.db.driver, routes });
    },

    // Deliberately unfiltered (addendum-091): card totals must not shift with the
    // dashboard's current search/date filter, so this reads the whole db every time.
    getRouteMetrics() {
      const customerIds = new Set();
      Object.values(D.db.stops).forEach(list => list.forEach(s => customerIds.add(s.customerId)));
      return ok({
        totalRoutes:         D.db.routes.length,
        totalTarget:         D.db.routes.reduce((a, r) => a + (r.estimatedCollectionAmount || 0), 0),
        uniqueCustomerCount: customerIds.size,
        totalOutstanding:    D.db.routes.reduce((a, r) => a + (r.outstandingAmount || 0), 0),
      });
    },

    // Same filter-free rule as getRouteMetrics (addendum-110). Only CLOSED routes are
    // reports, which is what the Reports page itself filters the list down to.
    getReportsSummary() {
      const closed = D.db.routes.filter(r => r.status === 'CLOSED');
      return ok({
        totalReports:   closed.length,
        totalCollected: closed.reduce((a, r) => a + (r.collectedAmount || 0), 0),
      });
    },

    updateStockLoad({ routeId, items, deviceTimestamp }) {
      const route = requireRoute(routeId);
      const at    = deviceTimestamp || now();
      const load  = D.db.stockLoads[routeId] || { status: 'COMPLETED', products: [] };
      (items || []).forEach(it => {
        const row = load.products.find(p => p.productId === it.productId);
        if (row) row.loadedQty = it.loadedQty ?? it.qty ?? row.loadedQty;
        else load.products.push({
          productId: it.productId,
          name:      it.name || it.productName || it.productId,
          unitPrice: it.unitPrice || 0,
          planQty:   it.loadedQty ?? it.qty ?? 0,
          loadedQty: it.loadedQty ?? it.qty ?? 0,
        });
      });
      const totalUnits     = load.products.reduce((a, p) => a + (p.loadedQty || 0), 0);
      const estimatedValue = load.products.reduce((a, p) => a + (p.loadedQty || 0) * (p.unitPrice || 0), 0);
      load.summary   = { totalUnits, estimatedValue };
      load.updatedAt = at;
      D.db.stockLoads[routeId] = load;
      route.checklist.stockLoad = { ...route.checklist.stockLoad, status: 'COMPLETED', totalUnits, estimatedValue, confirmedAt: at };
      logActivity(routeId, 'STOCK_LOAD_UPDATED', { totalUnits, estimatedValue });
      return ok({ routeId, totalUnits, estimatedValue, updatedAt: at, products: load.products });
    },

    // Updates the route's existing stock node in place and flips it back to READY,
    // mirroring the real endpoint (never creates a second node).
    approveStockRequest({ routeId, items, deviceTimestamp, comments }) {
      const route  = requireRoute(routeId);
      const result = routeDelivery.updateStockLoad({ routeId, items, deviceTimestamp }).data;
      route.status = 'READY';
      const summary = D.db.routes.find(r => r.id === routeId);
      if (summary) summary.status = 'READY';
      logActivity(routeId, 'STOCK_REQUEST_APPROVED', { comments: comments || null });
      return ok({ ...result, status: 'READY', comments: comments || null });
    },

    pauseForRestock({ routeId }) {
      const route  = requireRoute(routeId);
      const pausedAt = now();
      route.status    = 'RESTOCKING';
      route.updatedAt = pausedAt;
      const summary = D.db.routes.find(r => r.id === routeId);
      if (summary) summary.status = 'RESTOCKING';
      logActivity(routeId, 'RESTOCK_PAUSED', { pausedAt });
      return ok({ routeId, status: 'RESTOCKING', pausedAt });
    },

    resumeFromRestock({ routeId }) {
      const route     = requireRoute(routeId);
      const resumedAt = now();
      route.status    = 'IN_PROGRESS';
      route.updatedAt = resumedAt;
      const summary = D.db.routes.find(r => r.id === routeId);
      if (summary) summary.status = 'IN_PROGRESS';
      if (!getStops(routeId).some(s => s.status === 'CURRENT')) advanceToNextStop(routeId);
      logActivity(routeId, 'RESTOCK_RESUMED', { resumedAt });
      return ok({ routeId, status: 'IN_PROGRESS', resumedAt });
    },

    createOnTheMoveRoute({ routeTemplateId, name }) {
      const id   = uid('RTE');
      const date = new Date().toISOString().slice(0, 10);
      const summary = {
        id, name: name || 'On-the-move Route', status: 'READY',
        totalStops: 0, completedStops: 0,
        estimatedCollectionAmount: 0, outstandingAmount: 0, collectedAmount: 0,
        scheduledDate: date,
      };
      D.db.routes.push(summary);
      D.db.routeDetails[id] = {
        ...summary, beatArea: 'On the move', driver: D.db.driver,
        checklist: {
          stockLoad:   { status: 'PENDING', confirmedAt: null },
          openingCash: { status: 'PENDING', confirmedAt: null },
          signOff:     { status: 'PENDING', confirmedAt: null },
        },
        startedAt: null, updatedAt: now(), routeTemplateId: routeTemplateId || null,
      };
      D.db.stops[id] = [];
      D.db.settlementSteps[id] = [
        { key: 'STOCK_COUNT',      label: 'Stock Count',      description: 'Physically count remaining stock on vehicle',      status: 'PENDING', unlocked: true  },
        { key: 'CASH_HANDOVER',    label: 'Cash Handover',    description: 'Count collected cash and hand over to supervisor', status: 'PENDING', unlocked: false },
        { key: 'CUSTOMER_CLOSURE', label: 'Customer Closure', description: 'Dispatch invoices and log outstanding follow-ups', status: 'PENDING', unlocked: false },
      ];
      logActivity(id, 'ROUTE_CREATED', { routeTemplateId, name: summary.name });
      return ok(D.db.routeDetails[id]);
    },

    // What is still on the vehicle: loaded minus what earlier stops already took.
    // availableQty is what the booking screens cap quantity against.
    getBookingStock({ routeId }) {
      const load = D.db.stockLoads[routeId];
      if (!load) return ok([]);
      const booked = {};
      getStops(routeId).forEach(stop => {
        const detail = D.db.stopDetails[stop.id];
        (detail?.items || []).forEach(it => {
          if (stop.status === 'DELIVERED') booked[it.productId] = (booked[it.productId] || 0) + (it.qty || 0);
        });
      });
      return ok(load.products.map(p => ({
        productId:    p.productId,
        name:         p.name,
        unitPrice:    p.unitPrice,
        loadedQty:    p.loadedQty,
        availableQty: Math.max(0, (p.loadedQty || 0) - (booked[p.productId] || 0)),
        priceMap:     { Piece: p.unitPrice },
        tax:          0,
      })));
    },

    updateStopItems({ routeId, stopId, items, deviceTimestamp }) {
      requireStop(routeId, stopId);
      const detail = resolveStopDetail(routeId, stopId);
      const at     = deviceTimestamp || now();
      detail.items = (items || []).map(it => ({
        productId: it.productId,
        name:      it.name || it.productName || it.productId,
        qty:       it.qty ?? it.quantity ?? 0,
        unitPrice: it.unitPrice ?? it.price ?? 0,
        amount:    (it.qty ?? it.quantity ?? 0) * (it.unitPrice ?? it.price ?? 0),
      }));
      detail.todayOrderAmount = detail.items.reduce((a, i) => a + i.amount, 0);
      detail.updatedAt = at;
      const stop = requireStop(routeId, stopId);
      stop.todayOrderAmount = detail.todayOrderAmount;
      stop.totalDue = (stop.previousOutstanding || 0) + detail.todayOrderAmount;
      logActivity(routeId, 'STOP_ITEMS_UPDATED', { stopId, itemCount: detail.items.length });
      return ok(detail);
    },

    // Books an existing registered customer as a brand-new stop at the end of the route.
    bookCustomerStop({ routeId, customerId, items, orderDiscount }) {
      requireRoute(routeId);
      const cust  = D.db.customers.find(c => c.id === customerId);
      if (!cust) { const e = new Error(`Customer ${customerId} not found`); e.code = 'NOT_FOUND'; throw e; }
      const stops  = getStops(routeId);
      const amount = (items || []).reduce((a, i) => a + (i.qty ?? 0) * (i.unitPrice ?? 0), 0) - (orderDiscount || 0);
      const stop = {
        id: uid('STP'), sequence: stops.length + 1,
        customerId: cust.id, customerName: cust.name, address: cust.address, phone: cust.phone,
        status: 'PENDING',
        previousOutstanding: cust.creditAmount || 0,
        collectedAmount: 0,
        todayOrderAmount: Math.max(0, amount),
        totalDue: (cust.creditAmount || 0) + Math.max(0, amount),
        outstandingAmount: (cust.creditAmount || 0) + Math.max(0, amount),
        paymentMethod: null, completedAt: null, skipReason: null,
        isAdHoc: true,
      };
      stops.push(stop);
      D.db.stops[routeId] = stops;
      const detail = requireRoute(routeId);
      detail.totalStops = stops.length;
      const summary = D.db.routes.find(r => r.id === routeId);
      if (summary) summary.totalStops = stops.length;
      syncRouteAggregates(routeId);
      logActivity(routeId, 'STOP_BOOKED', { stopId: stop.id, customerId });
      return ok(stop);
    },

    // Walk-in: registers the customer too, then books them exactly like bookCustomerStop.
    addNewStop({ routeId, shopName, ownerPhone, orderItems = [], payment, idempotencyKey, orderDiscount }) {
      requireRoute(routeId);
      const cust = {
        id: uid('CST'), name: shopName, phone: ownerPhone,
        address: 'Added on route', orgType: 'RETAILER',
        gstType: 'unregistered', gstNumber: null, creditAmount: 0,
      };
      D.db.customers.push(cust);
      const booked = routeDelivery.bookCustomerStop({
        routeId, customerId: cust.id, items: orderItems, orderDiscount,
      }).data;
      let paymentResult = null;
      if (payment && payment.amount > 0) {
        paymentResult = routeDelivery.collectPayment({
          routeId, stopId: booked.id,
          amount: payment.amount, method: payment.method,
          sendInvoice: payment.sendInvoice,
        }).data;
      }
      logActivity(routeId, 'STOP_ADDED', { stopId: booked.id, shopName, idempotencyKey: idempotencyKey || null });
      return ok({ stop: booked, customer: cust, payment: paymentResult, idempotencyKey: idempotencyKey || null });
    },

    // Payment taken against a customer's outstanding rather than against a dispatch —
    // the standalone-collection path, which has no stop to mark delivered.
    recordRoutePayment({ routeId, customerId, dispatchId, paymentAmount, paymentMethod, collectedAt, isWriteoff }) {
      requireRoute(routeId);
      const cust = D.db.customers.find(c => c.id === customerId);
      if (cust) cust.creditAmount = Math.max(0, (cust.creditAmount || 0) - (paymentAmount || 0));
      const at = collectedAt || now();
      getStops(routeId)
        .filter(s => s.customerId === customerId && s.status !== 'DELIVERED')
        .forEach(s => { s.outstandingAmount = Math.max(0, (s.outstandingAmount || 0) - (paymentAmount || 0)); });
      syncRouteAggregates(routeId);
      logActivity(routeId, isWriteoff ? 'PAYMENT_WRITEOFF' : 'PAYMENT_RECORDED', { customerId, paymentAmount, paymentMethod });
      return ok({
        routeId, customerId, dispatchId: dispatchId || null,
        paymentAmount, paymentMethod, collectedAt: at,
        isWriteoff: !!isWriteoff,
        remainingCredit: cust ? cust.creditAmount : 0,
      });
    },

    createRouteReturn({ routeId, orgId, items, reason }) {
      requireRoute(routeId);
      const id = uid('RET');
      const totalQty   = (items || []).reduce((a, i) => a + (i.qty ?? 0), 0);
      const totalValue = (items || []).reduce((a, i) => a + (i.qty ?? 0) * (i.unitPrice ?? 0), 0);
      logActivity(routeId, 'RETURN_CREATED', { returnId: id, orgId, totalQty, reason: reason || null });
      return ok({ id, routeId, orgId, items: items || [], reason: reason || null, totalQty, totalValue, createdAt: now() });
    },

    recordAssetMovement({ routeId, customerOrgId, movements }) {
      requireRoute(routeId);
      const id = uid('ASM');
      logActivity(routeId, 'ASSET_MOVEMENT', { customerOrgId, count: (movements || []).length });
      return ok({ id, routeId, customerOrgId, movements: movements || [], recordedAt: now() });
    },

    sendNodeDocument({ nodeId }) {
      return ok({ nodeId, sent: true, sentAt: now(), channel: 'WHATSAPP' });
    },
  };

  // ─── settlement ───────────────────────────────────────────────────────────────

  const settlement = {
    getSettlementOverview(routeId) {
      const route  = requireRoute(routeId);
      const stops  = getStops(routeId);
      const steps  = D.db.settlementSteps[routeId] || [];
      const delivered   = stops.filter(s => s.status === 'DELIVERED');
      const collected   = delivered.reduce((a, s) => a + (s.collectedAmount || 0), 0);
      const outstanding = stops.filter(s => s.status !== 'DELIVERED' && s.status !== 'SKIPPED').reduce((a, s) => a + (s.outstandingAmount || 0), 0);
      return ok({ routeId, routeName: route.name, subtitle: `${route.name} · ${delivered.length}/${route.totalStops} delivered`, stats: { deliveredCount: delivered.length, skippedCount: stops.filter(s => s.status === 'SKIPPED').length, totalStops: route.totalStops, collectedAmount: collected, outstandingAmount: outstanding }, steps });
    },

    getCashHandoverSummary(routeId) {
      const route  = requireRoute(routeId);
      const stops  = getStops(routeId);
      const cashCollected   = stops.filter(s => s.status === 'DELIVERED' && s.paymentMethod === 'CASH').reduce((a, s) => a + (s.collectedAmount || 0), 0);
      const upiCollected    = stops.filter(s => s.status === 'DELIVERED' && s.paymentMethod === 'UPI').reduce((a, s) => a + (s.collectedAmount || 0), 0);
      const creditCollected = stops.filter(s => s.status === 'DELIVERED' && s.paymentMethod === 'CREDIT').reduce((a, s) => a + (s.collectedAmount || 0), 0);
      const openingCash = route.checklist.openingCash.amount || 0;
      const cashToHandOver = cashCollected + openingCash;
      const NOTES = [2000, 500, 200, 100, 50, 20, 10];
      let remaining = cashToHandOver;
      const denominations = {};
      for (const note of NOTES) {
        const count = Math.floor(remaining / note);
        if (count > 0) { denominations[note] = count; remaining -= count * note; }
      }
      return ok({ openingCash, cashCollected, upiCollected, creditCollected, cashToHandOver, denominations });
    },

    submitStockCount({ routeId, items, note, deviceTimestamp }) {
      const stockLoad = D.db.stockLoads[routeId];
      const steps     = D.db.settlementSteps[routeId] || [];
      const stops     = getStops(routeId);
      const delivered = stops.filter(s => s.status === 'DELIVERED').length;
      const discrepancies = (items || []).map(item => {
        const seed         = stockLoad?.products.find(p => p.productId === item.productId);
        const soldEstimate = Math.round((seed?.loadedQty || 0) * (delivered / Math.max(stops.length, 1)));
        const expected     = Math.max(0, (seed?.loadedQty || 0) - soldEstimate);
        const actual       = Number(item.actualCount);
        const diff         = actual - expected;
        return diff !== 0 ? { productId: item.productId, name: seed?.name || item.productId, expected, actual, diff } : null;
      }).filter(Boolean);
      const confirmedAt = deviceTimestamp || now();
      const stockStep = steps.find(s => s.key === 'STOCK_COUNT');
      const cashStep  = steps.find(s => s.key === 'CASH_HANDOVER');
      if (stockStep) stockStep.status  = 'COMPLETED';
      if (cashStep)  cashStep.unlocked = true;
      const route = requireRoute(routeId);
      if (route.status === 'IN_PROGRESS') {
        route.status = 'PENDING_SETTLEMENT';
        const summary = D.db.routes.find(r => r.id === routeId);
        if (summary) summary.status = 'PENDING_SETTLEMENT';
      }
      return ok({ status: 'COMPLETED', discrepancies, cashHandoverUnlocked: true, confirmedAt });
    },

    submitCashHandover({ routeId, amount, denominations = [], expenses = [], actualCounted, supervisorName, deviceTimestamp }) {
      const steps = D.db.settlementSteps[routeId] || [];
      const stops = getStops(routeId);
      const cashCollected    = stops.filter(s => s.status === 'DELIVERED' && s.paymentMethod === 'CASH').reduce((a, s) => a + (s.collectedAmount || 0), 0);
      const openingCash      = requireRoute(routeId).checklist.openingCash.amount || 0;
      const expenseTotal     = (expenses || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      const expectedHandOver = Math.max(0, cashCollected + openingCash - expenseTotal);
      const countedAmount    = Number(actualCounted ?? amount ?? 0);
      const difference       = countedAmount - expectedHandOver;
      const confirmedAt      = deviceTimestamp || now();
      const cashStep    = steps.find(s => s.key === 'CASH_HANDOVER');
      const closureStep = steps.find(s => s.key === 'CUSTOMER_CLOSURE');
      if (cashStep)    cashStep.status    = 'COMPLETED';
      if (closureStep) closureStep.unlocked = true;
      D.db.cashCounted[routeId] = countedAmount;
      return ok({ status: 'COMPLETED', actualCounted: countedAmount, expectedHandOver, difference, supervisorName, denominations, expenses, invoicesQueued: stops.filter(s => s.status === 'DELIVERED').length, confirmedAt });
    },

    closeRoute(routeId, { deviceTimestamp } = {}) {
      const route    = requireRoute(routeId);
      const stops    = getStops(routeId);
      const closedAt = deviceTimestamp || now();
      const delivered    = stops.filter(s => s.status === 'DELIVERED');
      const collected    = delivered.reduce((a, s) => a + (s.collectedAmount || 0), 0);
      const outstanding  = stops.filter(s => s.status !== 'DELIVERED' && s.status !== 'SKIPPED').reduce((a, s) => a + (s.outstandingAmount || 0), 0);
      const startMs      = route.startedAt ? new Date(route.startedAt).getTime() : Date.now();
      const closeMs      = new Date(closedAt).getTime();
      const totalMin     = Math.max(0, Math.round((closeMs - startMs) / 60_000));
      const avgMin       = delivered.length > 0 ? +(totalMin / delivered.length).toFixed(1) : 0;
      const stockLoad    = D.db.stockLoads[routeId];
      const stockReturned = (stockLoad?.products || []).reduce((a, p) => {
        const soldEst = Math.round(p.loadedQty * (delivered.length / Math.max(stops.length, 1)));
        return a + Math.max(0, p.loadedQty - soldEst);
      }, 0);
      route.status    = 'CLOSED';
      route.updatedAt = closedAt;
      const summary   = D.db.routes.find(r => r.id === routeId);
      if (summary) summary.status = 'CLOSED';
      (D.db.settlementSteps[routeId] || []).forEach(s => { s.status = 'COMPLETED'; s.unlocked = true; });
      return ok({
        routeId, status: 'CLOSED',
        stats: { deliveredCount: delivered.length, totalStops: stops.length, collectedAmount: collected, totalTimeMinutes: totalMin, avgMinutesPerStop: avgMin },
        settlement: { cashHandedOver: D.db.cashCounted[routeId] || collected, stockReturnedUnits: stockReturned, outstandingCarriedForward: outstanding, signedOffBy: 'Supervisor' },
        invoicesSent: delivered.length,
        closedAt,
      });
    },

    getRouteAnalytics(routeId) {
      const route     = requireRoute(routeId);
      const stops     = getStops(routeId);
      const delivered = stops.filter(s => s.status === 'DELIVERED').length;
      const skipped   = stops.filter(s => s.status === 'SKIPPED').length;
      const collected = stops.reduce((a, s) => a + (s.collectedAmount || 0), 0);
      const pct = stops.length > 0 ? Math.round((delivered / stops.length) * 100) : 0;
      return ok({
        routeId, routeName: route.name, date: route.scheduledDate,
        score: { value: pct, max: 100, label: pct >= 80 ? 'Excellent Beat' : 'Good Beat', percentileText: 'Above average' },
        kpis: [
          { key: 'COVERAGE',          label: 'Coverage',      value: `${delivered}/${stops.length}`, percentage: pct },
          { key: 'COLLECTION',        label: 'Collection',    value: `₹${collected}`,                percentage: 0   },
          { key: 'PRODUCTIVITY',      label: 'Productivity',  value: `${delivered} stops`,           percentage: pct },
          { key: 'AVG_TIME_PER_STOP', label: 'Avg Time/Stop', value: '4m',                          percentage: 0   },
        ],
        highlights: [],
        carriedForward: { skippedCount: skipped, outstandingAmount: 0 },
      });
    },

    generateDayReport(opts = {}) {
      const date    = opts.date || new Date().toISOString().slice(0, 10);
      const routes  = D.db.routes;
      const all     = routes.flatMap(r => getStops(r.id));
      const deliv   = all.filter(s => s.status === 'DELIVERED');
      const skip    = all.filter(s => s.status === 'SKIPPED');
      const actual  = deliv.reduce((a, s) => a + (s.collectedAmount || 0), 0);
      return ok({
        date, routeCount: routes.length, totalStops: all.length,
        deliveredCount: deliv.length, skippedCount: skip.length,
        collectionTarget: 0, collectionActual: actual, collectionPct: 0,
        outstandingAmount: 0,
        cashCollected:  deliv.filter(s => s.paymentMethod === 'CASH').reduce((a, s) => a + s.collectedAmount, 0),
        upiCollected:   deliv.filter(s => s.paymentMethod === 'UPI').reduce((a, s) => a + s.collectedAmount, 0),
        creditBooked:   deliv.filter(s => s.paymentMethod === 'CREDIT').reduce((a, s) => a + s.collectedAmount, 0),
      });
    },

    // The app only needs a downloadable blob + filename; no PDF engine in the mock.
    downloadRouteAnalyticsReport(routeId) {
      const route = requireRoute(routeId);
      const body  = `Route Analytics Report\nRoute: ${route.name} (${routeId})\nDate: ${route.scheduledDate}\nStops: ${route.completedStops}/${route.totalStops}\nCollected: ${route.collectedAmount}\nOutstanding: ${route.outstandingAmount}\n`;
      return ok({
        filename: `route-analytics-${routeId}.txt`,
        contentType: 'text/plain',
        blob: typeof Blob !== 'undefined' ? new Blob([body], { type: 'text/plain' }) : body,
      });
    },
  };

  // ─── productService ───────────────────────────────────────────────────────────

  const productService = {
    listProducts(opts = {}) {
      let products = D.db.products;
      if (opts.activeOnly !== false) {
        products = products.filter(p => p.status === 'show' || p.status === 'ACTIVE');
      }
      return ok({ products });
    },

    getStockLoad(routeId) {
      const stockLoad = D.db.stockLoads[routeId];
      if (stockLoad) return ok(stockLoad);
      const products = D.db.products
        .filter(p => p.status === 'show' || p.status === 'ACTIVE')
        .map(p => ({
          productId: p.productId,
          name:      p.title?.en || '',
          unitPrice: parseFloat(p.prices?.price || 0),
          planQty:   0,
          loadedQty: 0,
        }));
      return ok({ status: 'PENDING', confirmedAt: null, products, summary: { totalUnits: 0, estimatedValue: 0 } });
    },

    getProduct(productId) {
      const p = D.db.products.find(x => x.productId === productId);
      if (!p) { const e = new Error(`Product ${productId} not found`); e.code = 'NOT_FOUND'; return { toPromise: () => Promise.reject(e) }; }
      return ok(p);
    },

    searchProducts({ query = '', limit = 8, activeOnly = true } = {}) {
      let products = D.db.products;
      if (activeOnly) products = products.filter(p => p.status === 'show' || p.status === 'ACTIVE');
      const q = query.trim().toLowerCase();
      if (q) products = products.filter(p => p.title.en.toLowerCase().includes(q));
      const results = products.slice(0, limit).map(p => ({
        productId: p.productId, sku: p.sku, name: p.title.en,
        unitPrice: p.prices?.priceMap?.Piece || 0, unit: p.unit, stock: p.stock, category: p.category,
      }));
      return ok({ results, total: products.length });
    },

    getProductCategories({ activeOnly = true } = {}) {
      return ok({ categories: [] });
    },
  };

  window.RD_SDK = { routeDelivery: routeDelivery, settlement: settlement, productService: productService };
})();

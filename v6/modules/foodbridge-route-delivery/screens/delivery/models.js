/* ==========================================================================
   DELIVERY MANAGEMENT — domain models, enums and pure helpers

   Ported verbatim from the Route Delivery app. These are the rules the screens
   obey -- what a stop's total is, how an order discount spreads across lines,
   when a settlement step unlocks, what a receipt contains. They are the part of
   the app a prototype must NOT re-invent, or its numbers stop agreeing with the
   real product.

     app source   route-delivery-app/models/foundation/*.js
                  route-delivery-app/models/derived/*.js
                  route-delivery-app/utils/*.js

   Concatenated in dependency order into one IIFE. The only edits are removing
   import/export lines and dropping helpers defined twice across files.
   ========================================================================== */

(function () {
  "use strict";

  /* ── from models/foundation/enums.js ── */
  const RouteStatus = Object.freeze({
    READY:              'READY',
    IN_PROGRESS:        'IN_PROGRESS',
    PENDING_SETTLEMENT: 'PENDING_SETTLEMENT',
    CLOSED:             'CLOSED',
    RESTOCKING:         'RESTOCKING',
    // A DELIVERY-only staffer submitted a stock request on this route; awaiting a
    // STOCK_LOAD staffer to review/adjust and load it. See docs on useLoadStockController.
    STOCK_REQUESTED:    'STOCK_REQUESTED',
  });

  const StopStatus = Object.freeze({
    PENDING:   'PENDING',
    CURRENT:   'CURRENT',
    DELIVERED: 'DELIVERED',
    SKIPPED:   'SKIPPED',
  });

  const PaymentMethod = Object.freeze({
    CASH:   'CASH',
    UPI:    'UPI',
    CREDIT: 'CREDIT',
  });

  const SkipReason = Object.freeze({
    SHOP_CLOSED:      'SHOP_CLOSED',
    OWNER_AWAY:       'OWNER_AWAY',
    FULLY_STOCKED:    'FULLY_STOCKED',
    REFUSED:          'REFUSED',
    WILL_ORDER_LATER: 'WILL_ORDER_LATER',
    OTHER:            'OTHER',
  });

  const ChecklistStepStatus = Object.freeze({
    PENDING:   'PENDING',
    COMPLETED: 'COMPLETED',
  });

  const SettlementStepKey = Object.freeze({
    STOCK_COUNT:      'STOCK_COUNT',
    CASH_HANDOVER:    'CASH_HANDOVER',
    CUSTOMER_CLOSURE: 'CUSTOMER_CLOSURE',
  });

  const OrgType = Object.freeze({
    RETAILER:    'RETAILER',
    WHOLESALER:  'WHOLESALER',
    DISTRIBUTOR: 'DISTRIBUTOR',
  });

  const GstType = Object.freeze({
    REGULAR:      'regular',
    COMPOSITION:  'composition',
    UNREGISTERED: 'unregistered',
  });

  /* ── from utils/currencyDisplay.js ── */
  // Display-only currency formatting for route-delivery-app.
  //
  // Governs ONLY the four aggregate transactional amounts: order total, outstanding,
  // payment collected, advance/over-payment. Does NOT apply to per-unit rates
  // (e.g. "₹45.50/kg"), per-line item totals (qty × price), stock valuation totals,
  // opening cash/change, or discount/savings amounts — those always keep their
  // natural (unrounded, 2-decimal-capped) precision regardless of the flag.
  //
  // The `roundedAmountDisplay` flag is purely cosmetic: it only changes how numbers
  // are rendered here. It must never be used to alter a value before it's sent to
  // any backend/SDK call — doing so would desync the ledger from the displayed
  // amount and fabricate outstanding/overpayment (order total and payment amount
  // must stay in the same precision for `outstanding = orderTotal - collected` to
  // reconcile to exactly zero when fully paid).
  function isRoundedAmountDisplayEnabled() {
    if (typeof window === 'undefined') return false;
    try {
      const appProp = JSON.parse(window.localStorage.getItem('appProp') || '{}');
      return appProp?.amountConfiguration?.displayRoundedAmounts === true;
    } catch (_) {
      return false;
    }
  }

  // Numeric-only variant (no ₹ prefix) for callers that render the currency symbol
  // separately (e.g. a superscript ₹ in a numpad header).
  function formatAmountValue(n) {
    const value = Number(n) || 0;
    if (isRoundedAmountDisplayEnabled()) {
      return Math.round(value).toLocaleString('en-IN');
    }
    return value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function formatAmount(n) {
    return '₹' + formatAmountValue(n);
  }

  // Rounds to the nearest paisa (2 decimals). Use this to guard `> 0` checks on
  // outstanding/advance amounts before treating them as "significant" — floating-point
  // residue from repeated ledger arithmetic (e.g. 0.000634) is `> 0` but not a real
  // paisa-level balance, and showing an outstanding/over-payment banner for it just
  // displays a confusing "₹0" once formatted. Round first, then compare.
  function roundToPaisa(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  /* ── from utils/dateFormat.js ── */
  function parseDate(value) {
    if (!value) return null;
    const [year, month, day] = String(value).split('-').map(Number);
    const date = year && month && day ? new Date(year, month - 1, day) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatRouteDate(value, { includeYear = true, fallback = '' } = {}) {
    const date = parseDate(value);
    if (!date) return fallback;

    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      ...(includeYear ? { year: 'numeric' } : {}),
    });
  }

  function formatRouteTime(value = null, { hour12 = true, fallback = '' } = {}) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return fallback;

    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12,
    });
  }

  /* ── from utils/cashDenominations.js ── */
  const DEFAULT_CASH_DENOMINATIONS = [
    { value: 500, kind: 'Note' },
    { value: 200, kind: 'Note' },
    { value: 100, kind: 'Note' },
    { value: 50, kind: 'Note' },
    { value: 20, kind: 'Note' },
    { value: 10, kind: 'Note/Coin' },
  ];

  function parseCashQty(value) {
    const n = parseInt(String(value ?? '').replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  }

  function parseDenomination(value) {
    const n = Number(String(value ?? '').replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function formatInr(value) {
    return '₹' + Number(value || 0).toLocaleString('en-IN');
  }

  function normalizeCashBreakdown(rows) {
    const byDenomination = new Map();

    (rows || []).forEach((row) => {
      const denomination = parseDenomination(row?.denomination ?? row?.value);
      const qty = parseCashQty(row?.qty);
      if (!denomination || !qty) return;
      const existing = byDenomination.get(denomination) || {
        denomination,
        kind: row?.kind || 'Note/Coin',
        qty: 0,
      };
      byDenomination.set(denomination, {
        ...existing,
        kind: row?.kind || existing.kind,
        qty: existing.qty + qty,
      });
    });

    return Array.from(byDenomination.values()).sort((a, b) => b.denomination - a.denomination);
  }

  function buildInitialCashBreakdown(savedRows = []) {
    const saved = normalizeCashBreakdown(savedRows);
    const savedMap = new Map(saved.map((row) => [row.denomination, row]));

    const defaults = DEFAULT_CASH_DENOMINATIONS.map((item) => ({
      denomination: item.value,
      kind: item.kind,
      qty: savedMap.get(item.value)?.qty || 0,
    }));

    const custom = saved.filter(
      (row) => !DEFAULT_CASH_DENOMINATIONS.some((item) => item.value === row.denomination),
    );

    return [...defaults, ...custom].sort((a, b) => b.denomination - a.denomination);
  }

  function getCashBreakdownTotal(rows) {
    return (rows || []).reduce(
      (sum, row) => sum + parseDenomination(row?.denomination) * parseCashQty(row?.qty),
      0,
    );
  }

  function getSavedCashBreakdownRows(rows) {
    return normalizeCashBreakdown(rows).filter((row) => row.qty > 0);
  }

  /* ── from utils/expenseTypes.js ── */
  // Default per-route expense categories (e.g. "Route Bhatta", "Toll Recharge") come from
  // appProp.settlementFeatures.expenseTypes (see SettlementFeatures/ExpenseTypeConfig in
  // storefront-client-lib's private-setup.response.ts) — same appProp/localStorage source
  // used by isRoundedAmountDisplayEnabled() in currencyDisplay.js. There is no local
  // fallback list: if the backend sends no types, Cash Handover starts with an empty
  // expense list and the driver adds rows manually via "Add Expense", same as before
  // this config existed.
  function getConfiguredExpenseTypes() {
    if (typeof window === 'undefined') return [];
    try {
      const appProp = JSON.parse(window.localStorage.getItem('appProp') || '{}');
      const types = appProp?.settlementFeatures?.expenseTypes;
      return Array.isArray(types) ? types : [];
    } catch (_) {
      return [];
    }
  }

  // Seeds the runtime expense rows ({id, name, amount, ...}) that CashExpenseSection
  // renders, from the configured expense types. `editableName`/`required` are carried
  // onto each row so CashExpenseSection can lock the label and hide the remove action
  // for mandatory categories without needing the config object at render time.
  function buildInitialExpenses(configuredTypes = getConfiguredExpenseTypes()) {
    return configuredTypes
      .filter(type => type?.active !== false)
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(type => ({
        id: type.key,
        name: type.label || '',
        amount: type.defaultAmount ? String(type.defaultAmount) : '',
        editableName: type.editableName !== false,
        required: type.required === true,
      }));
  }

  /* ── from utils/orderPricing.js ── */
  const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  const roundPricePrecision = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 1000000) / 1000000;

  function buildDiscountedOrderItemPayload({
    productId,
    name,
    qty,
    price,
    customPrice,
    discountShare = 0,
    tax = 0,
  }) {
    const quantity = Number(qty) || 0;
    const taxRate = Number(tax) || 0;
    const baseTaxInclusivePrice = customPrice != null
      ? Number(customPrice) * (1 + taxRate / 100)
      : Number(price || 0);
    const lineGross = roundMoney(baseTaxInclusivePrice * quantity);
    const lineNet = roundMoney(Math.max(0, lineGross - (Number(discountShare) || 0)));
    const hasEditedPrice = customPrice != null || Number(discountShare) > 0;
    const editedTaxInclusivePrice = quantity > 0 ? lineNet / quantity : baseTaxInclusivePrice;
    const editedTaxExclusivePrice = taxRate > 0
      ? editedTaxInclusivePrice / (1 + taxRate / 100)
      : editedTaxInclusivePrice;

    return {
      productId,
      name,
      qty,
      price,
      ...(hasEditedPrice ? { editedPrice: roundPricePrecision(editedTaxExclusivePrice) } : {}),
    };
  }

  function resolveOrderDiscountAmount({
    discountType,
    discountInput,
    subtotal,
  }) {
    const value = Number.parseFloat(discountInput);
    const base = Number(subtotal) || 0;
    if (!value || value <= 0 || base <= 0) return 0;

    const amount = discountType === 'percent'
      ? base * Math.min(Math.max(value, 0), 100) / 100
      : value;

    return roundMoney(Math.min(Math.max(amount, 0), base));
  }

  function allocateOrderDiscountByGross(items = [], orderDiscount = 0) {
    const rows = (Array.isArray(items) ? items : []).map((item) => {
      const qty = Number(item.qty) || 0;
      const taxRate = Number(item.tax) || 0;
      const unitGross = item.customPrice != null
        ? Number(item.customPrice) * (1 + taxRate / 100)
        : Number(item.price || 0);
      return {
        item,
        gross: roundMoney(unitGross * qty),
      };
    });

    const grossTotal = roundMoney(rows.reduce((sum, row) => sum + row.gross, 0));
    const discount = Math.min(Math.max(Number(orderDiscount) || 0, 0), grossTotal);
    if (discount <= 0 || grossTotal <= 0) {
      return new Map(rows.map(({ item }) => [item.productId, 0]));
    }

    let allocated = 0;
    return new Map(rows.map(({ item, gross }, index) => {
      const share = index === rows.length - 1
        ? roundMoney(discount - allocated)
        : roundMoney((gross / grossTotal) * discount);
      allocated = roundMoney(allocated + share);
      return [item.productId, share];
    }));
  }

  /* ── from utils/stockSort.js ── */
  function remainingQty(item) {
    const qty = item?.availableQty ?? item?.maxQty ?? item?.loadedQty ?? 0;
    return Number.isFinite(Number(qty)) ? Number(qty) : 0;
  }

  function productName(item) {
    return String(item?.productName || item?.name || '').toLowerCase();
  }

  function sortByRemainingQtyDesc(items) {
    return [...(items || [])].sort((a, b) => {
      const qtyDiff = remainingQty(b) - remainingQty(a);
      if (qtyDiff !== 0) return qtyDiff;
      return productName(a).localeCompare(productName(b));
    });
  }

  /* ── from models/foundation/customer.model.js ── */
  /** @returns {import('./types').Customer} */
  function makeCustomer(overrides = {}) {
    return {
      id:               '',
      name:             '',
      phone:            '',
      email:            '',
      address:          '',
      orgType:          OrgType.RETAILER,
      supplyChainType:  'PUBLIC',
      gstType:          GstType.UNREGISTERED,
      gstNumber:        null,
      creditAmount:     0,
      ...overrides,
    };
  }

  function customerInitials(name = '') {
    return name
      .split(' ')
      .slice(0, 2)
      .map(w => w[0] || '')
      .join('')
      .toUpperCase();
  }

  /* ── from models/foundation/product.model.js ── */
  /** @returns {import('./types').OrderItem} */
  function makeOrderItem(overrides = {}) {
    return {
      productId:    '',
      productName:  '',
      qty:          0,
      orderingUnit: 'Piece',
      unitPrice:    0,
      lineTotal:    0,
      ...overrides,
    };
  }

  /** @returns {import('./types').StockLoadItem} */
  function makeStockLoadItem(overrides = {}) {
    return {
      productId: '',
      name:      '',
      unitPrice: 0,
      planQty:   0,
      loadedQty: 0,
      ...overrides,
    };
  }

  /** @returns {import('./types').StockCountItem} */
  function makeStockCountItem(overrides = {}) {
    return {
      productId:    '',
      name:         '',
      loadedQty:    0,
      expectedReturn: 0,
      actualCount:  null,
      ...overrides,
    };
  }

  function computeStockValue(items, qtys) {
    return items.reduce((sum, item, i) => sum + item.unitPrice * (qtys[i] ?? item.loadedQty), 0);
  }

  function computeStockUnits(qtys) {
    return qtys.reduce((s, q) => s + q, 0);
  }

  /* ── from models/foundation/payment.model.js ── */
  /** @returns {import('./types').PaymentResult} */
  function makePaymentResult(overrides = {}) {
    return {
      stopId:               '',
      status:               'DELIVERED',
      amountCollected:      0,
      method:               PaymentMethod.CASH,
      outstandingRemaining: 0,
      invoiceQueued:        false,
      nextStop:             null,
      collectedAt:          null,
      writeoffAmount:       0,
      ...overrides,
    };
  }

  function paymentMethodLabel(method) {
    switch (method) {
      case PaymentMethod.CASH:   return 'Cash';
      case PaymentMethod.UPI:    return 'UPI';
      case PaymentMethod.CREDIT: return 'Credit';
      default:                   return method;
    }
  }

  function paymentMethodIcon(method) {
    switch (method) {
      case PaymentMethod.CASH:   return '💵';
      case PaymentMethod.UPI:    return '📱';
      case PaymentMethod.CREDIT: return '📒';
      default:                   return '💰';
    }
  }

  /* ── from models/foundation/stop.model.js ── */
  /** @returns {import('./types').StopSummary} */
  function makeStopSummary(overrides = {}) {
    return {
      id:                '',
      sequence:          0,
      customerName:      '',
      customerInitials:  '',
      status:            StopStatus.PENDING,
      outstandingAmount: 0,
      collectedAmount:   0,
      paymentMethod:     null,
      skipReason:        null,
      completedAt:       null,
      todayOrderAmount:  0,
      totalDue:          0,
      ...overrides,
    };
  }

  /** @returns {import('./types').StopDetail} */
  function makeStopDetail(overrides = {}) {
    return {
      ...makeStopSummary(overrides),
      customer:         null,
      orderItems:       [],
      orderTotal:       0,
      ...overrides,
    };
  }

  // ── Selectors ─────────────────────────────────────────────────────────────────

  function getCurrentStop(stops) {
    return stops.find(s => s.status === StopStatus.CURRENT) || null;
  }

  function getCompletedStops(stops) {
    return stops.filter(s => s.status === StopStatus.DELIVERED || s.status === StopStatus.SKIPPED);
  }

  function getPendingStops(stops) {
    return stops.filter(s => s.status === StopStatus.PENDING);
  }

  function stopDisplaySubtitle(stop) {
    if (stop.status === StopStatus.SKIPPED) {
      return `Skipped · ${stop.skipReason || 'No reason'}`;
    }
    if (stop.status === StopStatus.DELIVERED) {
      const method = stop.paymentMethod ? ` · ${stop.paymentMethod}` : '';
      return `${formatAmount(stop.collectedAmount)} collected${method}`;
    }
    if (stop.outstandingAmount > 0) {
      return `${formatAmount(stop.outstandingAmount)} outstanding`;
    }
    return 'No outstanding';
  }

  /* ── from models/foundation/route.model.js ── */
  /** @returns {import('./types').DriverSummary} */
  function makeDriverSummary(overrides = {}) {
    return {
      id:          '',
      name:        '',
      phone:       '',
      email:       '',
      subRoleId:   '',
      joiningDate: '',
      syncedAt:    null,
      ...overrides,
    };
  }

  /** @returns {import('./types').ChecklistStep} */
  function makeChecklistStep(overrides = {}) {
    return {
      status:      ChecklistStepStatus.PENDING,
      confirmedAt: null,
      ...overrides,
    };
  }

  /** @returns {import('./types').RouteChecklist} */
  function makeRouteChecklist(overrides = {}) {
    return {
      stockLoad:   makeChecklistStep(overrides.stockLoad),
      openingCash: makeChecklistStep(overrides.openingCash),
      signOff:     makeChecklistStep(overrides.signOff),
    };
  }

  /** @returns {import('./types').RouteSummary} */
  function makeRouteSummary(overrides = {}) {
    return {
      id:                       '',
      name:                     '',
      status:                   RouteStatus.READY,
      totalStops:               0,
      completedStops:           0,
      estimatedCollectionAmount: 0,
      outstandingAmount:        0,
      collectedAmount:          0,
      scheduledDate:            '',
      ...overrides,
    };
  }

  /** @returns {import('./types').RouteDetail} */
  function makeRouteDetail(overrides = {}) {
    return {
      ...makeRouteSummary(overrides),
      beatArea:  '',
      driver:    makeDriverSummary(),
      checklist: makeRouteChecklist(),
      startedAt: null,
      updatedAt: null,
      ...overrides,
      checklist: makeRouteChecklist(overrides.checklist || {}),
      driver:    makeDriverSummary(overrides.driver || {}),
    };
  }

  // ── Selectors ─────────────────────────────────────────────────────────────────

  function isChecklistComplete(checklist) {
    return (
      checklist.stockLoad.status   === ChecklistStepStatus.COMPLETED &&
      checklist.openingCash.status === ChecklistStepStatus.COMPLETED
    );
  }

  function routeProgressPct(route) {
    if (!route || route.totalStops === 0) return 0;
    return Math.round((route.completedStops / route.totalStops) * 100);
  }

  function computeRouteSummaryStats(routes) {
    return {
      routesCount:  routes.length,
      target:       routes.reduce((s, r) => r.status !== RouteStatus.CLOSED ? s + (r.estimatedCollectionAmount || 0) : s, 0),
      customers:    routes.reduce((s, r) => s + (r.totalStops || 0), 0),
      outstanding:  routes.reduce((s, r) => r.status !== RouteStatus.READY ? s + (r.outstandingAmount || 0) : s, 0),
    };
  }

  /* ── from models/foundation/settlement.model.js ── */
  /** @returns {import('./types').SettlementStep} */
  function makeSettlementStep(overrides = {}) {
    return {
      key:         '',
      label:       '',
      description: '',
      status:      ChecklistStepStatus.PENDING,
      unlocked:    false,
      ...overrides,
    };
  }

  /** @returns {import('./types').SettlementStats} */
  function makeSettlementStats(overrides = {}) {
    return {
      deliveredCount:    0,
      skippedCount:      0,
      totalStops:        0,
      collectedAmount:   0,
      outstandingAmount: 0,
      ...overrides,
    };
  }

  /** @returns {import('./types').CashHandoverSummary} */
  function makeCashHandoverSummary(overrides = {}) {
    return {
      openingCash:    0,
      cashCollected:  0,
      upiCollected:   0,
      cashToHandOver: 0,
      ...overrides,
    };
  }

  /** @returns {import('./types').RouteClosedSummary} */
  function makeRouteClosedSummary(overrides = {}) {
    return {
      routeId:       '',
      status:        'CLOSED',
      stats: {
        deliveredCount:     0,
        totalStops:         0,
        collectedAmount:    0,
        totalTimeMinutes:   0,
        avgMinutesPerStop:  0,
      },
      settlement: {
        cashHandedOver:           0,
        stockReturnedUnits:       0,
        outstandingCarriedForward: 0,
        signedOffBy:              '',
      },
      invoicesSent: 0,
      closedAt:     null,
      ...overrides,
    };
  }

  // ── Selectors ─────────────────────────────────────────────────────────────────

  function isStepUnlocked(steps, key) {
    const step = steps.find(s => s.key === key);
    return step?.unlocked ?? false;
  }

  function nextUnlockedStep(steps) {
    return steps.find(s => s.unlocked && s.status === ChecklistStepStatus.PENDING) || null;
  }

  function stepRouteMap(key) {
    switch (key) {
      case SettlementStepKey.STOCK_COUNT:      return '/route-delivery/settlement/stock';
      case SettlementStepKey.CASH_HANDOVER:    return '/route-delivery/settlement/cash';
      case SettlementStepKey.CUSTOMER_CLOSURE: return '/route-delivery/closed';
      default:                                 return '/route-delivery/settlement';
    }
  }

  function formatTotalTime(minutes) {
    if (!minutes) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  /* ── from models/derived/routeExecution.model.js ── */
  /**
   * RouteExecutionModel — combines RouteDetail + StopListResponse into a
   * unified view of what a driver sees during active delivery.
   */
  function buildRouteExecutionModel(route, stopListResponse) {
    const stops   = stopListResponse?.stops   || [];
    const progress = stopListResponse?.progress || {};

    const currentStop  = getCurrentStop(stops);
    const completedStops = getCompletedStops(stops);
    const pendingStops   = getPendingStops(stops);

    const progressPct = route ? routeProgressPct(route) : 0;

    const visibleStops    = stops.slice(0, 9); // show up to 9 in queue
    const remainingCount  = Math.max(0, stops.length - visibleStops.length);

    return {
      route,
      stops,
      visibleStops,
      remainingCount,
      currentStop,
      completedCount:  completedStops.length,
      pendingCount:    pendingStops.length,
      progress: {
        currentSequence: progress.currentStopSequence || 0,
        totalStops:      progress.totalStops          || route?.totalStops || 0,
        collectedAmount: progress.collectedAmount      || 0,
      },
      progressPct,
      canCompleteRoute: pendingStops.length === 0 && currentStop === null,
      isActive: route?.status === RouteStatus.IN_PROGRESS,
    };
  }

  /**
   * RoutePreStartModel — checklist state for pre-start flow.
   */
  function buildPreStartModel(route) {
    if (!route) return null;

    const { checklist, name, beatArea, scheduledDate, totalStops, outstandingAmount, estimatedCollectionAmount, driver } = route;

    return {
      routeName:   name || '',
      beatArea:    beatArea || '',
      scheduledDate: scheduledDate || '',
      driverName:  driver?.name || '',
      totalStops:  totalStops || 0,
      outstandingAmount: outstandingAmount || 0,
      estimatedCollectionAmount: estimatedCollectionAmount || 0,
      checklist: {
        stockLoad:   checklist?.stockLoad   || { status: 'PENDING', totalUnits: 0, estimatedValue: 0 },
        openingCash: checklist?.openingCash || { status: 'PENDING', amount: 0 },
        signOff:     checklist?.signOff     || { status: 'PENDING' },
      },
      canStart:
        checklist?.stockLoad?.status   === 'COMPLETED' &&
        (checklist?.openingCash?.status === 'COMPLETED' || checklist?.openingCash?.required === false),
    };
  }

  /**
   * DashboardModel — driver home screen summary.
   */
  function buildDashboardModel(driver, routes) {
    return {
      driver: driver || null,
      routes: routes || [],
      stats:  computeRouteSummaryStats(routes || []),
    };
  }

  /**
   * RouteClosedModel — post-settlement summary view.
   */
  function buildRouteClosedModel(summary) {
    if (!summary) return null;
    return {
      ...summary,
      formattedTotalTime: formatTotalTime(summary.stats?.totalTimeMinutes),
      invoicesSent: summary.invoicesSent || 0,
    };
  }

  /* ── from models/derived/deliveryExecution.model.js ── */
  function getDeliveryAllowedStatuses() {
    try {
      const globalSetting = JSON.parse(localStorage.getItem('globalSetting') || '{}');
      return globalSetting?.orderWorkflow?.deliveryAllowedStatuses || [];
    } catch {
      return [];
    }
  }

  function isNodeDelivered(stageAudit, deliveryAllowedStatuses) {
    if (!deliveryAllowedStatuses || deliveryAllowedStatuses.length === 0) return true;
    if (!stageAudit || stageAudit.length < 2) return false;
    const secondToLast = stageAudit[stageAudit.length - 2];
    return deliveryAllowedStatuses.includes(secondToLast?.status ?? '');
  }

  // Use isNodeDelivered when stageAudit is present and deliveryAllowedStatuses configured;
  // otherwise fall back to the status field set by the backend.
  function resolveIsDone(stop) {
    const deliveryAllowedStatuses = getDeliveryAllowedStatuses();
    if (deliveryAllowedStatuses.length > 0 && stop.stageAudit?.length) {
      return isNodeDelivered(stop.stageAudit, deliveryAllowedStatuses);
    }
    return stop.status === StopStatus.DELIVERED;
  }

  /**
   * DeliveryExecutionModel — at-customer state combining stop detail + customer.
   */
  function buildDeliveryExecutionModel(stopDetail) {
    if (!stopDetail) return null;

    const {
      customer,
      orderItems,
      orderTotal,
      outstandingAmount,
      previousOutstandingAmount,
      advanceAmount,
      totalDue,
      todayOrderAmount,
      status,
      sequence,
      balanceIncludesCurrentOrder,
    } = stopDetail;

    return {
      stop: stopDetail,
      customer: customer || null,
      customerName:      customer?.name      || stopDetail.customerName || '',
      customerPhone:     customer?.phone     || '',
      customerAddress:   customer?.address   || '',
      customerInitials:  stopDetail.customerInitials || '',
      sequence:          sequence || 0,
      status:            status   || StopStatus.PENDING,
      orderItems:        orderItems  || [],
      orderTotal:        orderTotal  || 0,
      outstandingAmount: outstandingAmount || 0,
      previousOutstandingAmount: previousOutstandingAmount ?? outstandingAmount ?? 0,
      advanceAmount:     advanceAmount     || 0,
      todayOrderAmount:  todayOrderAmount  || 0,
      totalDue:          totalDue          || 0,
      balanceIncludesCurrentOrder: Boolean(balanceIncludesCurrentOrder),
      hasOutstanding: (outstandingAmount || 0) > 0,
      hasAdvance:     (advanceAmount     || 0) > 0,
      canCollect: !isNodeDelivered(stopDetail.stageAudit, getDeliveryAllowedStatuses()) && status !== StopStatus.SKIPPED,
      subtitle: stopDisplaySubtitle(stopDetail),
    };
  }

  /**
   * StopQueueItemModel — how each stop appears in the customer queue list.
   */
  function buildStopQueueItem(stop, isNext = false) {
    const isSkipped = stop.status === StopStatus.SKIPPED;
    const isCurrent = stop.status === StopStatus.CURRENT;
    const isPending = stop.status === StopStatus.PENDING;
    const isDone    = resolveIsDone(stop) || isSkipped;

    return {
      ...stop,
      isDone,
      isSkipped,
      isCurrent,
      isPending,
      isNext,
      displaySubtitle: buildStopSubtitle(stop),
      scheme: isCurrent ? 'brand' : isSkipped ? 'grey' : isDone ? 'green' : 'blue',
      opacity: isSkipped ? 0.45 : isDone ? 0.6 : 1,
    };
  }

  function buildStopSubtitle(stop) {
    if (stop.status === StopStatus.SKIPPED) {
      return `Skipped · ${skipLabelFor(stop.skipReason)}`;
    }
    if (resolveIsDone(stop)) {
      const collected = Number(stop.collectedAmount || 0);
      const advance   = Number(stop.advanceAmount   || 0);
      const left      = Math.max(0, Number(stop.outstandingAmount || 0));
      if (advance > 0) return `${formatAmount(collected)} · Over Payment`;
      if (left    > 0) return `${formatAmount(collected)} · Partial payment`;
      return `${formatAmount(collected)} · Collected`;
    }
    // Unbooked stop (no dispatch) where a standalone payment was collected
    if (!stop.hasOrder && Number(stop.collectedAmount || 0) > 0) {
      const collected = Number(stop.collectedAmount);
      return `${formatAmount(collected)} · Collected`;
    }
    // Pending stop with credit balance (customer overpaid on a previous route)
    if (Number(stop.advanceAmount || 0) > 0) {
      return `${formatAmount(stop.advanceAmount)} over payment`;
    }
    if (stop.outstandingAmount > 0) {
      return `${formatAmount(stop.outstandingAmount)} outstanding`;
    }
    // Pending stop with credit balance (customer overpaid on a previous route)
    if (Number(stop.advanceAmount || 0) > 0) {
      return `₹${Number(stop.advanceAmount).toLocaleString('en-IN')} Over Payment`;
    }
    return '—';
  }

  function skipLabelFor(reason) {
    const MAP = {
      SHOP_CLOSED:      'Shop closed',
      OWNER_AWAY:       'Owner away',
      FULLY_STOCKED:    'Fully stocked',
      REFUSED:          'Refused',
      WILL_ORDER_LATER: 'Will order later',
      OTHER:            'Other',
    };
    return MAP[reason] || reason || 'No reason';
  }

  /* ── from models/derived/paymentCollection.model.js ── */
  const PAYMENT_METHOD_OPTIONS = [
    { key: PaymentMethod.CASH, label: '💵 Cash' },
    { key: PaymentMethod.UPI,  label: '📱 UPI' },
  ];


  // (duplicate of an earlier definition of `roundMoney` - dropped in the merge)

  /**
   * Computes smart amount presets based on totalDue.
   * Always includes the full amount. Adds common round numbers below it.
   */
  function buildPaymentPresets(totalDue) {
    const fullAmount = roundMoney(totalDue);
    const candidates = [200, 500, 1000, 2000, 5000];
    const presets = candidates.filter(c => c < fullAmount);
    // Take at most 2 sub-amounts + full
    return [...presets.slice(-2), fullAmount];
  }

  /**
   * PaymentCollectionModel — form state for collecting payment at a stop.
   * The controller builds and returns this shape to the page.
   */
  function makePaymentCollectionState(totalDue) {
    const fullAmount = roundMoney(totalDue);
    return {
      totalDue: fullAmount,
      amount:  String(fullAmount),
      method:  PaymentMethod.CASH,
      presets: buildPaymentPresets(fullAmount),
    };
  }

  function applyNumpadKey(current, key, prefilled) {
    if (key === 'C')  return '0';
    if (key === '←')  return current.length > 1 ? current.slice(0, -1) : '0';
    if (prefilled)    return key;
    return current === '0' ? key : current + key;
  }

  function formatPaymentDisplay(amountStr) {
    const n = roundMoney(parseFloat(amountStr || '0'));
    return Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /**
   * PaymentSuccessModel — what to display after a successful payment.
   */
  function buildPaymentSuccessModel(paymentResult) {
    if (!paymentResult) return null;
    return {
      amountCollected: roundMoney(paymentResult.amountCollected),
      method:          paymentMethodLabel(paymentResult.method),
      methodKey:       paymentResult.method,
      outstandingRemaining: roundMoney(paymentResult.outstandingRemaining),
      writeoffAmount:  roundMoney(paymentResult.writeoffAmount),
      paymentStatus:   paymentResult.paymentStatus || (paymentResult.outstandingRemaining > 0 ? 'PARTIAL' : 'PAID'),
      invoiceQueued:   paymentResult.invoiceQueued || false,
      nextStop:        paymentResult.nextStop || null,
      hasNextStop:     !!paymentResult.nextStop,
      collectedAt:     paymentResult.collectedAt,
    };
  }

  // Fallback for when lastPaymentResult is unavailable (e.g. after a reload wipes
  // it — it's a write-once in-memory value, never persisted or refetched). Rebuilds
  // the same shape from the stop's own record of the payment it already collected.
  // writeoffAmount isn't tracked per-stop on the backend, so it's always 0 here —
  // an honest gap, not a fabricated number.
  function buildPaymentSuccessModelFromStop(stopData) {
    if (!stopData || stopData.collectedAmount == null) return null;
    const outstandingRemaining = roundMoney(stopData.outstandingAmount);
    return {
      amountCollected: roundMoney(stopData.collectedAmount),
      method:          paymentMethodLabel(stopData.paymentMethod),
      methodKey:       stopData.paymentMethod,
      outstandingRemaining,
      writeoffAmount:  0,
      paymentStatus:   outstandingRemaining > 0 ? 'PARTIAL' : 'PAID',
      invoiceQueued:   false,
      nextStop:        null,
      hasNextStop:     false,
      collectedAt:     stopData.completedAt,
    };
  }

  /* ── from models/derived/receipt.model.js ── */
  const toNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };

  // (duplicate of an earlier definition of `roundMoney` - dropped in the merge)

  const positiveNumber = (...values) => {
    for (const value of values) {
      const number = toNumber(value, 0);
      if (number > 0) return number;
    }
    return 0;
  };

  const hasItemDiscountEvidence = (item) => {
    if (!item) return false;
    if (item.newPrice != null || item.editedPrice != null) return true;

    const offerPrice = toNumber(item.offerPrice, 0);
    const price = toNumber(item.price, 0);
    if (offerPrice > 0 && price > 0 && offerPrice < price) return true;

    const offerPriceMap = item.offerPriceMap || item.prices?.offerPriceMap || null;
    const priceMap = item.priceMap || item.prices?.priceMap || null;
    if (!offerPriceMap || !priceMap) return false;

    return Object.keys(offerPriceMap).some((unit) => {
      const offer = toNumber(offerPriceMap[unit], 0);
      const base = toNumber(priceMap[unit], 0);
      return offer > 0 && base > 0 && offer < base;
    });
  };

  const distributeTargetGrossTotal = (rows, targetGrossTotal) => {
    const target = roundMoney(targetGrossTotal);
    if (!Array.isArray(rows) || rows.length === 0) return [];
    if (target <= 0) return rows.map(row => row.item);

    const currentGrossTotal = roundMoney(
      rows.reduce((sum, row) => sum + toNumber(row.item.grossAmount ?? row.item.amount, 0), 0),
    );
    if (target <= currentGrossTotal || Math.abs(target - currentGrossTotal) < 0.01) {
      return rows.map(row => row.item);
    }

    const weightTotal = currentGrossTotal > 0
      ? currentGrossTotal
      : rows.reduce((sum, row) => sum + toNumber(row.fallbackAmount, 0), 0);
    if (weightTotal <= 0) return rows.map(row => row.item);

    let allocated = 0;
    return rows.map((row, index) => {
      const qty = toNumber(row.item.qty ?? row.item.quantity, 0);
      const weight = currentGrossTotal > 0
        ? toNumber(row.item.grossAmount ?? row.item.amount, 0)
        : toNumber(row.fallbackAmount, 0);
      const grossAmount = index === rows.length - 1
        ? roundMoney(target - allocated)
        : roundMoney((weight / weightTotal) * target);
      allocated = roundMoney(allocated + grossAmount);

      const hasDiscount = row.hasDiscountEvidence && row.fallbackAmount > 0 && row.fallbackAmount < grossAmount;
      const netAmount = hasDiscount ? row.fallbackAmount : grossAmount;
      const discount = hasDiscount ? roundMoney(grossAmount - netAmount) : 0;
      const rate = qty > 0 ? roundMoney(grossAmount / qty) : row.item.rate;
      const offerRate = qty > 0 ? roundMoney(netAmount / qty) : row.item.offerRate;

      return {
        ...row.item,
        rate,
        offerRate,
        amount: grossAmount,
        grossAmount,
        discount,
        netAmount,
      };
    });
  };

  const resolveRouteOrderDiscount = (stopDetail) => {
    const amount = stopDetail?.orderDiscountAmount
      ?? stopDetail?.discountAmount
      ?? stopDetail?.discount_value
      ?? stopDetail?.orderDiscount
      ?? stopDetail?.discount
      ?? null;
    if (amount != null) return { value: toNumber(amount, 0), mode: 'amount', explicit: true };

    const percent = stopDetail?.orderDiscountPercent
      ?? stopDetail?.discountPercent
      ?? stopDetail?.discount_percentage
      ?? null;

    if (percent != null) return { value: toNumber(percent, 0), mode: 'percent', explicit: true };

    return { value: 0, mode: 'amount', explicit: false };
  };

  const inferRouteDiscountFromDue = (items, stopDetail, payment) => {
    const due = payment?.totalDue ?? stopDetail?.totalDue ?? null;
    if (due == null) return 0;

    const currentOrderTotal = items.reduce((sum, item) => sum + toNumber(item.netAmount ?? item.amount, 0), 0);
    if (currentOrderTotal <= 0) return 0;

    const outstanding = toNumber(stopDetail?.outstandingAmount, 0);
    const advance = toNumber(stopDetail?.advanceAmount, 0);
    const expectedOrderTotal = Math.max(0, toNumber(due, 0) - outstanding + advance);

    if (expectedOrderTotal <= 0 || expectedOrderTotal >= currentOrderTotal) return 0;
    return Math.round((currentOrderTotal - expectedOrderTotal + Number.EPSILON) * 100) / 100;
  };

  /**
   * Builds a ReceiptDto for a standalone payment (no order items).
   * Used on the payment success screen when collectOutstandingMode is true.
   */
  function buildPaymentReceiptDto({ customerName, amountCollected, paymentMethod, outstandingBalance = 0, writeoffAmount = 0 }, org = {}) {
    return {
      companyName:      org.name       || '',
      companyAddress:   org.address    || [],
      companyPhone:     org.phone      || '',
      companyGstin:     org.gstin      || '',
      title:            'Payment Receipt',
      invoiceDate:      new Date().toLocaleString('en-IN', { hour12: false }),
      customerName:     customerName   || '',
      billNo:           '',
      paymentMode:      paymentMethodLabel(paymentMethod || ''),
      drRef:            '',
      items:            [],
      subtotal:         0,
      outstandingBalance,
      writeoffAmount,
      discount:         0,
      taxes:            [],
      total:            amountCollected || 0,
      footerNote:       org.footerNote || '',
      currency:         org.currency   || 'Rs',
    };
  }

  /**
   * Maps a route-delivery stop detail + optional payment result to the canonical
   * ReceiptDto shape consumed by buildInvoiceEscPos.
   *
   * @param {object} stopDetail  — full stop from getStopDetail (id, customerName, customer, orderItems, completedAt…)
   * @param {object} [payment]   — lastPaymentResult { amountCollected, method } — preferred when printing live
   *                               Pass null for reprints (falls back to stop's stored collectedAmount)
   * @param {object} [org]       — optional org context { name, address, phone, gstin, currency, footerNote }
   * @returns {object|null}      — ReceiptDto or null if stopDetail is missing
   */
  function mapRouteStopToReceiptDto(stopDetail, payment = null, org = {}) {
    if (!stopDetail) return null;

    const customerName = stopDetail.customer?.name || stopDetail.customerName || '';
    const routeDiscount = resolveRouteOrderDiscount(stopDetail);

    const itemRows = (stopDetail.orderItems || [])
      .filter(item => toNumber(item.qty, 0) > 0)
      .map((item, index) => {
        const qty = toNumber(item.qty, 0);
        const fallbackLineTotal = item.lineTotal ?? item.amount ?? item.total ?? null;
        const fallbackAmount = toNumber(fallbackLineTotal, 0);
        const discountEvidence = routeDiscount.explicit || hasItemDiscountEvidence(item);
        const normalizedItem = {
          ...item,
          ...(routeDiscount.explicit
            ? {
                editedPrice: undefined,
                newPrice: undefined,
                offerPrice: undefined,
                offerPriceMap: undefined,
              }
            : {}),
          name: item.productName || item.name || 'Item',
          qty,
        };

        const receiptItem = buildReceiptLineItem(normalizedItem, index);
        if (
          fallbackLineTotal != null
          && receiptItem.amount > 0
          && fallbackAmount > 0
          && fallbackAmount < receiptItem.grossAmount
          && discountEvidence
        ) {
          return {
            fallbackAmount,
            hasDiscountEvidence: discountEvidence,
            item: {
              ...receiptItem,
              offerRate: qty > 0 ? roundMoney(fallbackAmount / qty) : receiptItem.offerRate,
              discount: roundMoney(receiptItem.grossAmount - fallbackAmount),
              netAmount: fallbackAmount,
            },
          };
        }

        if (receiptItem.amount > 0 || fallbackLineTotal == null) {
          return { fallbackAmount, hasDiscountEvidence: discountEvidence, item: receiptItem };
        }

        const amount = fallbackAmount;
        const rate = qty > 0 ? amount / qty : 0;
        return {
          fallbackAmount,
          hasDiscountEvidence: discountEvidence,
          item: {
            ...receiptItem,
            rate,
            offerRate: rate,
            amount,
            grossAmount: item.grossAmount ?? item.originalLineTotal ?? amount,
            netAmount: amount,
          },
        };
      });

    const targetGrossTotal = positiveNumber(
      stopDetail.todayOrderAmount,
      stopDetail.orderGrossTotal,
      stopDetail.grossTotal,
      stopDetail.originalOrderTotal,
      stopDetail.orderTotal,
    );
    const rawItems = distributeTargetGrossTotal(itemRows, targetGrossTotal);

    const inferredDiscount = routeDiscount.explicit
      ? 0
      : inferRouteDiscountFromDue(rawItems, stopDetail, payment);
    const discounted = applyOrderDiscountToReceiptItems(
      rawItems,
      routeDiscount.explicit ? routeDiscount.value : inferredDiscount,
      routeDiscount.explicit ? routeDiscount.mode : 'amount',
    );

    const items = discounted.items;
    const subtotal = items.reduce((sum, i) => sum + (i.grossAmount ?? i.amount ?? 0), 0);

    const total = payment?.amountCollected != null
      ? payment.amountCollected
      : Number(stopDetail.collectedAmount || 0);

    // Always run through paymentMethodLabel so reprints (which carry the raw
    // enum string on rawDetail.paymentMethod) show "Cash" not "CASH".
    const paymentMode = paymentMethodLabel(payment?.method || stopDetail.paymentMethod || '');

    const invoiceDate = stopDetail.completedAt
      ? new Date(stopDetail.completedAt).toLocaleString('en-IN', { hour12: false })
      : new Date().toLocaleString('en-IN', { hour12: false });

    // Outstanding balance the customer carried in before this delivery.
    // Shown as "Old Balance" on the receipt so the driver and customer can see
    // what prior debt was included in the total collected.
    const outstandingBalance = Number(stopDetail.outstandingAmount || 0);

    // Amount forgiven as part of this collection (checkbox on Payment Collection),
    // if any — shown on the receipt so the customer sees why totalDue and the
    // amount actually collected differ.
    const writeoffAmount = Number(payment?.writeoffAmount || 0);

    return {
      companyName:         org.name       || '',
      companyAddress:      org.address    || [],
      companyPhone:        org.phone      || '',
      companyGstin:        org.gstin      || '',
      title:               'Invoice',
      invoiceDate,
      customerName,
      billNo:              stopDetail.invoiceNumber || stopDetail.id || '',
      paymentMode,
      drRef:               '',
      items,
      subtotal,            // today's order total (sum of delivered item amounts)
      outstandingBalance,  // pre-existing balance before this delivery
      writeoffAmount,
      discount:            items.reduce((sum, i) => sum + (i.discount || 0), 0),
      taxes:               [],
      total,               // amount actually collected by the driver right now
      footerNote:          org.footerNote || '',
      currency:            org.currency   || 'Rs',
    };
  }

  /* ── from models/derived/settlementFlow.model.js ── */
  /**
   * The route-list status can lag behind settlement writes. Once either
   * driver-facing step has completed, settlement is the authoritative resume
   * destination even if the list still reports the route as IN_PROGRESS.
   */
  function hasSettlementProgress(overview) {
    return (overview?.steps || []).some(step =>
      step.key !== SettlementStepKey.CUSTOMER_CLOSURE &&
      step.status === ChecklistStepStatus.COMPLETED
    );
  }

  /**
   * SettlementFlowModel — combines SettlementOverview into a step-progression view.
   */
  function buildSettlementFlowModel(overview) {
    if (!overview) return null;

    const allSteps = overview.steps || [];
    const stats    = overview.stats || {};

    // CUSTOMER_CLOSURE has no driver-facing action — skip it from the checklist UI.
    // allDone is true once all actionable steps (Stock Count + Cash Handover) are completed.
    const steps           = allSteps.filter(s => s.key !== SettlementStepKey.CUSTOMER_CLOSURE);
    const completedSteps  = steps.filter(s => s.status === ChecklistStepStatus.COMPLETED);
    const rawNextStep     = nextUnlockedStep(steps);
    const allDone         = steps.length > 0 && completedSteps.length === steps.length;
    const routedSteps     = steps.map(s => ({
      ...s,
      route:     stepRouteMap(s.key),
      isDone:    s.status === ChecklistStepStatus.COMPLETED,
      isCurrent: rawNextStep?.key === s.key,
    }));
    const nextStep        = routedSteps.find(s => s.key === rawNextStep?.key) || null;

    return {
      routeName:  overview.routeName  || '',
      subtitle:   overview.subtitle   || '',
      stats: {
        deliveredCount:    stats.deliveredCount    || 0,
        skippedCount:      stats.skippedCount      || 0,
        totalStops:        stats.totalStops        || 0,
        collectedAmount:   stats.collectedAmount   || 0,
        outstandingAmount: stats.outstandingAmount || 0,
      },
      steps: routedSteps,
      nextStep,
      allDone,
      canClose: allDone,
      stepIcon: (key) => STEP_ICONS[key] || '📋',
    };
  }

  const STEP_ICONS = {
    [SettlementStepKey.STOCK_COUNT]:   '📦',
    [SettlementStepKey.CASH_HANDOVER]: '💵',
  };

  /**
   * StockCountFormModel — form state for the stock count sheet.
   */
  function buildStockCountFormState(sheet) {
    const items = sheet?.items || [];
    return {
      items,
      actuals: items.map(item =>
        item.actualCount !== null ? String(item.actualCount) : ''
      ),
    };
  }

  function computeStockCountDiscrepancies(items, actuals) {
    return items
      .map((item, i) => {
        const actual   = parseInt(actuals[i] || '0');
        const expected = item.expectedReturn;
        const diff     = actual - expected;
        return diff !== 0
          ? { productId: item.productId, name: item.name, expected, actual, diff }
          : null;
      })
      .filter(Boolean);
  }

  /**
   * CashHandoverFormModel — form state for cash handover.
   */
  function round2(n) { return Math.round((n || 0) * 100) / 100; }

  function buildCashHandoverFormState(summary) {
    if (!summary) return null;
    const cashToHandOver = round2((summary.cashCollected || 0) + (summary.openingCash || 0));
    return {
      openingCash:    round2(summary.openingCash),
      cashCollected:  round2(summary.cashCollected),
      upiCollected:   round2(summary.upiCollected),
      cashToHandOver,
      counted:        String(cashToHandOver),
      supervisor:     '',
    };
  }

  function computeCashDifference(counted, cashToHandOver, { roundToWholeRupee = false } = {}) {
    const countedNum = parseFloat(String(counted).replace(/[₹,\s]/g, '') || '0') || 0;
    // Cash is physically counted in the same unit shown to the driver. When the
    // route uses rounded-amount display, compare the two displayed rupee values
    // instead of comparing a whole-rupee entry with a hidden fractional amount.
    // This is presentation-only; it never changes the ledger value submitted.
    const expected = roundToWholeRupee
      ? Math.round(Number(cashToHandOver) || 0)
      : Number(cashToHandOver) || 0;
    const diff = Math.round((countedNum - expected) * 100) / 100;
    return { countedNum, diff, matched: diff === 0 };
  }

  /* ── from models/derived/stockRequest.model.js ── */
  /**
   * LoadStock has four modes depending on who's looking and whether a stock
   * request is already pending on the route:
   *   - 'blank'    — no pending request, caller has STOCK_LOAD → today's fresh form.
   *   - 'request'  — no pending request, caller lacks STOCK_LOAD → submitting a request.
   *   - 'approve'  — a request is pending, caller has STOCK_LOAD → review/adjust + load.
   *   - 'awaiting' — a request is pending, caller lacks STOCK_LOAD → read-only wait state.
   */
  function deriveStockLoadMode({ hasStockLoad, routeStatus }) {
    if (routeStatus === RouteStatus.STOCK_REQUESTED) {
      return hasStockLoad ? 'approve' : 'awaiting';
    }
    return hasStockLoad ? 'blank' : 'request';
  }

  /**
   * Diffs the stock-load staffer's entered quantities against what was requested
   * (products[i].planQty, prefilled from the pending node). Mirrors
   * computeStockCountDiscrepancies in settlementFlow.model.js.
   */
  function computeStockRequestDiscrepancies(products, qtys) {
    return products
      .map((p, i) => {
        const requested = Number(p.planQty || 0);
        const entered   = Number(qtys[i] ?? 0);
        const diff      = entered - requested;
        return diff !== 0
          ? { productId: p.id, name: p.name, requested, entered, diff }
          : null;
      })
      .filter(Boolean);
  }

  window.RD_MODELS = {
    ChecklistStepStatus: ChecklistStepStatus,
    DEFAULT_CASH_DENOMINATIONS: DEFAULT_CASH_DENOMINATIONS,
    GstType: GstType,
    OrgType: OrgType,
    PAYMENT_METHOD_OPTIONS: PAYMENT_METHOD_OPTIONS,
    PaymentMethod: PaymentMethod,
    RouteStatus: RouteStatus,
    SettlementStepKey: SettlementStepKey,
    SkipReason: SkipReason,
    StopStatus: StopStatus,
    allocateOrderDiscountByGross: allocateOrderDiscountByGross,
    applyNumpadKey: applyNumpadKey,
    buildCashHandoverFormState: buildCashHandoverFormState,
    buildDashboardModel: buildDashboardModel,
    buildDeliveryExecutionModel: buildDeliveryExecutionModel,
    buildDiscountedOrderItemPayload: buildDiscountedOrderItemPayload,
    buildInitialCashBreakdown: buildInitialCashBreakdown,
    buildInitialExpenses: buildInitialExpenses,
    buildPaymentPresets: buildPaymentPresets,
    buildPaymentReceiptDto: buildPaymentReceiptDto,
    buildPaymentSuccessModel: buildPaymentSuccessModel,
    buildPaymentSuccessModelFromStop: buildPaymentSuccessModelFromStop,
    buildPreStartModel: buildPreStartModel,
    buildRouteClosedModel: buildRouteClosedModel,
    buildRouteExecutionModel: buildRouteExecutionModel,
    buildSettlementFlowModel: buildSettlementFlowModel,
    buildStockCountFormState: buildStockCountFormState,
    buildStopQueueItem: buildStopQueueItem,
    computeCashDifference: computeCashDifference,
    computeRouteSummaryStats: computeRouteSummaryStats,
    computeStockCountDiscrepancies: computeStockCountDiscrepancies,
    computeStockRequestDiscrepancies: computeStockRequestDiscrepancies,
    computeStockUnits: computeStockUnits,
    computeStockValue: computeStockValue,
    customerInitials: customerInitials,
    deriveStockLoadMode: deriveStockLoadMode,
    formatAmount: formatAmount,
    formatAmountValue: formatAmountValue,
    formatInr: formatInr,
    formatPaymentDisplay: formatPaymentDisplay,
    formatRouteDate: formatRouteDate,
    formatRouteTime: formatRouteTime,
    formatTotalTime: formatTotalTime,
    getCashBreakdownTotal: getCashBreakdownTotal,
    getCompletedStops: getCompletedStops,
    getConfiguredExpenseTypes: getConfiguredExpenseTypes,
    getCurrentStop: getCurrentStop,
    getPendingStops: getPendingStops,
    getSavedCashBreakdownRows: getSavedCashBreakdownRows,
    hasSettlementProgress: hasSettlementProgress,
    isChecklistComplete: isChecklistComplete,
    isRoundedAmountDisplayEnabled: isRoundedAmountDisplayEnabled,
    isStepUnlocked: isStepUnlocked,
    makeCashHandoverSummary: makeCashHandoverSummary,
    makeChecklistStep: makeChecklistStep,
    makeCustomer: makeCustomer,
    makeDriverSummary: makeDriverSummary,
    makeOrderItem: makeOrderItem,
    makePaymentCollectionState: makePaymentCollectionState,
    makePaymentResult: makePaymentResult,
    makeRouteChecklist: makeRouteChecklist,
    makeRouteClosedSummary: makeRouteClosedSummary,
    makeRouteDetail: makeRouteDetail,
    makeRouteSummary: makeRouteSummary,
    makeSettlementStats: makeSettlementStats,
    makeSettlementStep: makeSettlementStep,
    makeStockCountItem: makeStockCountItem,
    makeStockLoadItem: makeStockLoadItem,
    makeStopDetail: makeStopDetail,
    makeStopSummary: makeStopSummary,
    mapRouteStopToReceiptDto: mapRouteStopToReceiptDto,
    nextUnlockedStep: nextUnlockedStep,
    normalizeCashBreakdown: normalizeCashBreakdown,
    parseCashQty: parseCashQty,
    parseDenomination: parseDenomination,
    paymentMethodIcon: paymentMethodIcon,
    paymentMethodLabel: paymentMethodLabel,
    resolveOrderDiscountAmount: resolveOrderDiscountAmount,
    roundMoney: roundMoney,
    roundToPaisa: roundToPaisa,
    routeProgressPct: routeProgressPct,
    sortByRemainingQtyDesc: sortByRemainingQtyDesc,
    stepRouteMap: stepRouteMap,
    stopDisplaySubtitle: stopDisplaySubtitle, buildStopSubtitle: buildStopSubtitle, skipLabelFor: skipLabelFor,
  };
})();

/*
  What the host (storefront-frontend) hands the Purchase Orders module: money and measurement maths
  (src/utils/PriceUtil.js + priceCalculationService.js), amount display (utils/currencyDisplay.js),
  the order status rules (utils/orders.js), the menu label (hooks/useMenuLabel.js) and the small
  formatters of hooks/useUtilsFunction.js. Same rules, same rounding order — reproduced, not
  redesigned, because every amount on the screen passes through them.

  The host reads all of this from localStorage (globalSetting / appProp); here it reads the tenant.
*/

import { oid } from '../data/resolve.js';

export function createHost(tenant) {
  const appProp = tenant.appProp || {};
  const unitIndex = () => Number(appProp.priceCalculationUnitIndex) || 0;

  // PriceUtil.roundPrice / roundQty: EPSILON-corrected 2dp.
  const roundPrice = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.round((num + Number.EPSILON) * 100) / 100;
  };
  const roundQty = roundPrice;

  const convertToDecimalFormat = (v) => {
    if (typeof v === 'string' && v.includes(',')) { const [a, b] = v.split(','); return Number(`${a}.${b}`); }
    return v;
  };

  // priceCalculationService (DEFAULT): the ordering unit's price from offerPriceMap, else priceMap.
  const priceFromMaps = (product) => {
    const taxIncluded = product.taxIncluded !== false;
    let unit = product?.orderingUnit;
    if (!unit) unit = typeof product?.measurement === 'string' ? product.measurement.split('-')[product?.priceCalculationUnitIndex] : undefined;
    const offerPriceMap = product?.offerPriceMap;
    const priceMap = product?.priceMap || product?.prices?.priceMap;
    if (!unit || (!offerPriceMap && !priceMap)) return null;
    const o = offerPriceMap?.[unit];
    const m = priceMap?.[unit];
    const resolved = o != null && !isNaN(o) && Number(o) > 0 ? Number(o) : m != null && !isNaN(m) && Number(m) > 0 ? Number(m) : null;
    if (resolved == null) return null;
    return resolved * product.qty * (1 + (taxIncluded ? product.tax || 0 : 0) / 100);
  };

  // PriceUtil.calculatePriceByUnitIndex — the fallback when no map prices the unit.
  const byUnitIndex = ({ pricePerBaseUnit, quantity, tax, priceCalculationUnitIndex, boxConversionRatio, palleteConversionRatio }) => {
    switch (priceCalculationUnitIndex) {
      case 0: return pricePerBaseUnit * quantity * (1 + tax / 100);
      case 1: return boxConversionRatio ? pricePerBaseUnit * boxConversionRatio * quantity * (1 + tax / 100) : pricePerBaseUnit * quantity * (1 + tax / 100);
      case 2: return palleteConversionRatio ? pricePerBaseUnit * boxConversionRatio * palleteConversionRatio * quantity * (1 + tax / 100) : pricePerBaseUnit * quantity * (1 + tax / 100);
      default: throw new Error('Invalid priceCalculationUnitIndex. Valid range [0,2]');
    }
  };

  // PriceUtil.CalculatePrice
  const calculatePrice = (product) => {
    const mapped = priceFromMaps(product);
    if (mapped !== null && Number.isFinite(Number(mapped))) return Number(mapped);
    let price = product.price ?? product.unitPrice?.split('/')?.[0];
    price = product.offerPrice != null ? product.offerPrice : price;
    const numericPrice = Number(convertToDecimalFormat(price));
    const numericQuantity = Number(product.qty ?? 1);
    const calculated = byUnitIndex({
      pricePerBaseUnit: Number.isFinite(numericPrice) ? numericPrice : 0,
      quantity: Number.isFinite(numericQuantity) ? numericQuantity : 1,
      tax: product.taxIncluded === false ? 0 : product.tax || 0,
      priceCalculationUnitIndex: product.priceCalculationUnitIndex || 0,
      boxConversionRatio: parseFloat(product.boxes),
      palleteConversionRatio: parseFloat(product.pallets),
    });
    return Number.isFinite(Number(calculated)) ? Number(calculated) : 0;
  };

  // PriceUtil.CalculateItemPriceFromUnitIndex — a STRING, fixed to 2dp (the host's return type).
  const calculateItemPrice = (product, roundAfterDecimal = 2) => {
    const quantity = product.qty;
    const calculated = calculatePrice({ ...product, qty: Number.isFinite(quantity) ? quantity : 1, priceCalculationUnitIndex: product.priceCalculationUnitIndex ?? unitIndex() });
    return (Number.isFinite(Number(calculated)) ? Number(calculated) : 0).toFixed(roundAfterDecimal);
  };

  const normalizeUnitKey = (unit) => {
    if (!unit) return '';
    if (typeof unit === 'string') return unit.trim();
    if (Array.isArray(unit)) return unit.map(String).join('-');
    if (typeof unit === 'object') return String(unit.value ?? unit.label ?? unit.en ?? unit.name ?? unit.unit ?? '').trim();
    return String(unit).trim();
  };

  // PriceUtil.getOrderingUnitFromUnitIndex. A TWO-part measurement ("Pkt-Carton") matches no rule
  // and falls through to returning itself — which is what the host prints.
  const getOrderingUnitFromUnitIndex = (unitInput, customIndex = null) => {
    const idx = customIndex !== null ? Number(customIndex) : unitIndex();
    const unitMap = appProp.unitMap || null;
    if (Array.isArray(unitInput)) return unitInput[idx] || unitInput[0] || '';
    const unit = normalizeUnitKey(unitInput);
    if (unit && unitMap?.[unit]?.units?.[idx]) return unitMap[unit].units[idx];
    if (unit.includes('-')) { const p = unit.split('-').map((x) => x.trim()).filter(Boolean); if (p.length === 3) return p[idx] || p[0]; }
    if (unit.includes('/')) { const p = unit.split('/').map((x) => x.trim()).filter(Boolean); if (p.length === 3) return p[idx] || p[0]; }
    return [unit || 'Kg', 'Box', 'Pallete'][idx];
  };

  // currencyDisplay.formatAmountValue
  const isRoundedAmountDisplayEnabled = () => appProp?.amountConfiguration?.displayRoundedAmounts === true;
  const formatAmountValue = (n) => {
    const value = Number(n) || 0;
    if (isRoundedAmountDisplayEnabled()) return Math.round(value).toLocaleString('en-IN');
    return value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  // useUtilsFunction
  const getNumberTwo = (value = 0) => parseFloat(value || 0).toFixed(2);
  const toTitleCase = (str, withSpaces = true) => {
    if (typeof str !== 'string' || !str.trim()) return '';
    return str.toLowerCase().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(withSpaces ? ' ' : '');
  };

  // utils/orders.js — against globalSetting.orderWorkflow
  const workflowFor = (nodeType = 'ORDER') => {
    const swf = tenant.orderWorkflow?.statusWorkFlow;
    if (!swf) return [];
    if (typeof swf === 'object' && !Array.isArray(swf)) return swf[nodeType] || [];
    return Array.isArray(swf) ? swf : [];
  };
  const getDeliveredStageAudit = (order) => {
    const sa = order?.stageAudit;
    if (!Array.isArray(sa) || !sa.length) return null;
    for (let i = sa.length - 1; i >= 0; i -= 1) {
      const c = sa[i]?.challan;
      if (Array.isArray(c) && c.some((item) => item?.qtyReceived != null)) return sa[i];
    }
    return null;
  };
  const orderStatusRules = {
    getNextAllowedStatuses: (nodeType) => workflowFor(nodeType).map((w) => ({ status: w.status, nextStatuses: w.nextStatuses })),
    isAuditAllowedForStatus: (status, nodeType) => workflowFor(nodeType).find((w) => w.status === status)?.isAuditAllowed === true,
    getDeliveredStageAudit,
    isPurchaseOrderDelivered: (order) => getDeliveredStageAudit(order) != null,
    getStatusWorkflow: workflowFor,
  };

  // hooks/useMenuLabel — component, exact path, sub-menu path, then the capitalised segment.
  const menuLabel = (segment) => {
    const menus = tenant.storefrontMenus || [];
    const seg = String(segment).trim().toLowerCase();
    const norm = (v) => String(v ?? '').trim().toLowerCase();
    const byPath = menus.find((m) => norm(m.component) === seg) || menus.find((m) => norm(m.path) === seg);
    if (byPath?.name) return byPath.name;
    for (const m of menus) { const sub = (m.submenus || []).find((s) => norm(s.path) === seg); if (sub?.name) return sub.name; }
    return segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : segment;
  };

  // utils/currency getCurrency: the tenant's ISO code as Intl's narrow symbol; anything Intl cannot
  // resolve (a symbol such as "₹") verbatim; nothing configured → ₹.
  const currency = (() => {
    const configured = appProp.currency;
    if (!configured) return '₹';
    try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: configured, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((x) => x.type === 'currency')?.value || configured; } catch { return configured; }
  })();
  // MONEY_SPACE: the non-breaking space the host puts between a symbol and the amount after it.
  const MONEY_SPACE = '\u00a0';
  // PriceUtil.formatCurrency: the symbol, MONEY_SPACE, then en-IN with exactly two decimals.
  const formatCurrency = (amount) => `${currency}${MONEY_SPACE}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // PriceUtil.getUnitIndexForUnit: where the ordering unit sits in the product's measurement.
  const getUnitIndexForUnit = (product, unitLabel) => {
    if (!unitLabel) return 0;
    const parts = (product?.unit || product?.measurement || '').split('-').filter((u) => u && u !== 'undefined');
    const idx = parts.indexOf(unitLabel);
    return idx >= 0 ? idx : 0;
  };

  // PriceUtil.getBaseUnitQuantityFromQuantity: a quantity in some unit, in the base unit.
  const getBaseUnitQuantityFromQuantity = (quantity, boxConversionRatio, palleteConversionRatio, idx = null) => {
    const effective = idx !== null ? parseInt(idx, 10) : unitIndex();
    let q = Number(quantity);
    if (effective === 1) { if (boxConversionRatio && !isNaN(boxConversionRatio)) q *= boxConversionRatio; }
    else if (effective === 2) { if (palleteConversionRatio && !isNaN(palleteConversionRatio)) q *= (boxConversionRatio * palleteConversionRatio); }
    return roundQty(q);
  };

  // utils/user.getUserInfo: the signed-in user as login stored them (adminInfo).
  const getUserInfo = () => ({ _id: oid('usr', 1), name: tenant.username, token: 'parity-session' });

  // utils/location.getCurrentLocation: the signed-in user's current location record, as login stores
  // it (userLoc): id, name, organisation and status — no address, phone or GSTIN of its own.
  const getCurrentLocation = () => ({ _id: oid('loc', 1), name: tenant.sellerLocation?.name, orgId: oid('org', 1), status: 'ACTIVE' });
  // appProp.invoice.customConfig: the printed letterhead, when the tenant has configured one.
  const getInvoiceLetterhead = () => appProp.invoice?.customConfig || null;
  // services/SupplierPaymentRecordService.buildSupplierPaymentEntry: the method id → the API enum.
  const METHOD_TO_API = { cash: 'CASH', upi: 'UPI', neft: 'BANK_TRANSFER', cheque: 'CHEQUE' };
  const buildSupplierPaymentEntry = ({ supplierId, paymentAmount, paymentMethod }) => ({
    supplierId, paymentAmount: Number(paymentAmount), paymentMethod: METHOD_TO_API[paymentMethod] || String(paymentMethod || '').toUpperCase(), transactionType: 'CREDIT',
  });

  // PriceUtil.getQuantityFromBaseUnitQuantity: a base-unit quantity, in the unit at `quantityIndex`.
  const getQuantityFromBaseUnitQuantity = (baseUnitQuantity, quantityIndex, boxConversionRatio, palleteConversionRatio) => {
    const idx = parseInt(quantityIndex, 10) || 0;
    let q = Number(baseUnitQuantity);
    if (idx === 1) { if (boxConversionRatio && !isNaN(boxConversionRatio)) q /= boxConversionRatio; }
    else if (idx === 2) { if (palleteConversionRatio && !isNaN(palleteConversionRatio)) q /= (boxConversionRatio * palleteConversionRatio); }
    else if (idx !== 0) throw Error(`cannot resolve Ordering Unit. invalid quantityIndex. valid range [0,2]. Defaulting to baseUnit${JSON.stringify(idx)}`);
    return roundQty(q);
  };
  // PriceUtil.getProductStockFromUnitIndex: stock in the unit at `idx` — floored, unless `exact`.
  const getProductStockFromUnitIndex = (product, customIndex = null, exact = false) => {
    const stock = product?.stock || 0;
    const boxes = product?.boxes || 1;
    const pallets = product?.pallets || 1;
    switch (customIndex !== null ? customIndex : unitIndex()) {
      case 0: return stock;
      case 1: return exact ? roundQty(stock / boxes) : Math.floor(stock / boxes);
      case 2: return exact ? roundQty(stock / (boxes * pallets)) : Math.floor(Math.floor(stock / boxes) / pallets);
      default: return stock;
    }
  };
  // PriceUtil.displayUnitConversion — an ARRAY, empty at unit index 0 (and still truthy).
  const displayUnitConversion = (product) => {
    const idx = unitIndex();
    if (idx === 0) return [];
    const m = product?.measurement || '';
    const boxes = Number(product?.boxes || 0);
    const pallets = Number(product?.pallets || 0);
    const [s, b, p] = [0, 1, 2].map((i) => getOrderingUnitFromUnitIndex(m, i));
    if (idx === 2 && pallets > 0 && boxes > 0) return [`1 ${p} → ${pallets} ${b} → ${pallets * boxes} ${s}`];
    if (idx === 1 && boxes > 0) return [`1 ${b} → ${boxes} ${s}`];
    return [];
  };
  // PriceUtil.resolvePriceFromPriceMap: the unit's offer price, else its list price, else null.
  const resolvePriceFromPriceMap = (priceMap, offerPriceMap, unit) => {
    if (!unit) return null;
    const o = offerPriceMap?.[unit];
    if (o != null && !isNaN(o) && Number(o) > 0) return Number(o);
    const pm = priceMap?.[unit];
    if (pm != null && !isNaN(pm) && Number(pm) > 0) return Number(pm);
    return null;
  };
  // payment/index.getOrderCheckoutSteps: cart, then shipping and payment when configured.
  const getOrderCheckoutSteps = () => {
    const steps = ['cart'];
    if (appProp.shippingMethods?.isShippingConfigured === true) steps.push('shipping');
    const active = appProp.paymentMethods?.isActive || '';
    if (typeof active === 'string' && active.split(',').some((s) => s.trim())) steps.push('payment');
    return steps;
  };
  // payment/methods: the host's payment methods, in its order, filtered by appProp.paymentMethods.
  const PAYMENT_METHODS = [
    { id: 'cash', configKey: 'cash', label: 'Cash', provider: 'CASH', hasIntegration: false },
    { id: 'upi', configKey: 'upi', label: 'UPI (GPay / PhonePe / Paytm)', provider: 'UPI', hasIntegration: false },
    { id: 'neft', configKey: 'neft', label: 'Bank Transfer (NEFT / RTGS / IMPS)', provider: 'NEFT', hasIntegration: false },
    { id: 'cheque', configKey: 'cheque', label: 'Cheque', provider: 'CHEQUE', hasIntegration: false },
    { id: 'pod', configKey: 'pod', label: 'Cash on Delivery (COD)', provider: 'POD', hasIntegration: false },
    { id: 'QR', configKey: 'qr', label: 'QR Code / UPI QR', provider: 'QR', hasIntegration: false },
    { id: 'razorpay', configKey: 'razorpay', label: 'Razorpay', provider: 'RAZORPAY', hasIntegration: true },
    { id: 'stripe', configKey: 'stripe', label: 'Stripe', provider: 'STRIPE', hasIntegration: true },
    { id: 'credits', configKey: 'creditWallet', label: 'Paid with Credits', provider: 'CREDITS', hasIntegration: false },
    { id: 'payOnline', configKey: 'payOnline', label: 'Pay Online', provider: 'PAY_ONLINE', hasIntegration: true },
  ];
  const getActivePaymentMethods = () => {
    const config = appProp.paymentMethods || {};
    if (typeof config.isActive === 'string') {
      const keys = config.isActive.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
      return PAYMENT_METHODS.filter((m) => keys.includes(m.id.toLowerCase()) || keys.includes((m.configKey || '').toLowerCase()));
    }
    return PAYMENT_METHODS.filter((m) => config[m.id]?.isActive === true || config[m.configKey || m.id]?.isActive === true);
  };
  // utils/placeOrderSource.getSourceDisplayName (no generic store names among the sources here).
  const getSourceDisplayName = (source) => source?.storeName || source?.locationName || source?.orgName || source?.businessName || source?.name || '';

  return {
    getProductStockFromUnitIndex, displayUnitConversion, resolvePriceFromPriceMap, getOrderCheckoutSteps, getSourceDisplayName, getActivePaymentMethods,
    // utils/orders: oversell is allowed, and its alert shown, unless the tenant says false.
    allowOversell: () => appProp.allowOversell !== false,
    getShowAlertForOversell: () => appProp.showAlertForOversell !== false,
    getCurrentLocationId: () => oid('loc', 1),
    getCurrentLocation, getInvoiceLetterhead, buildSupplierPaymentEntry,
    formatCurrency, getUnitIndexForUnit, getBaseUnitQuantityFromQuantity, getQuantityFromBaseUnitQuantity, getUserInfo,
    getDeliveryAllowedStatuses: () => tenant.orderWorkflow?.deliveryAllowedStatuses || [],
    appProp, unitIndex, roundPrice, roundQty, calculatePrice, calculateItemPrice, getOrderingUnitFromUnitIndex,
    isRoundedAmountDisplayEnabled, formatAmountValue, getNumberTwo, toTitleCase, orderStatusRules, menuLabel,
    currency, MONEY_SPACE,
    deliveryAllowedStatuses: () => tenant.orderWorkflow?.deliveryAllowedStatuses || [],
  };
}

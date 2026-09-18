/* ==========================================================================
   DELIVERY MANAGEMENT — form validation

   The rules that decide whether a screen's primary button is allowed to fire,
   and the message shown when it is not. Ported verbatim so the prototype
   rejects exactly what the real app rejects:

     app source   route-delivery-app/validation/*.js
   ========================================================================== */

(function () {
  "use strict";

  // The only enum these rules reference. models.js is a separate IIFE, so it
  // comes off the shared namespace rather than being in lexical scope.
  const PaymentMethod = window.RD_MODELS.PaymentMethod;

  /* ── from validation/addCustomer.validation.js ── */
  /**
   * Validates adding a new customer discovered on the route.
   * @param {{ shopName: string, phone: string, orderItems: Array, stockLimits?: Record<string,number> }} data
   */
  function validateAddCustomer({ shopName, phone, orderItems = [], stockLimits = {} }) {
    const errors = {};

    if (!shopName || !shopName.trim()) {
      errors.shopName = 'Shop name is required';
    } else if (shopName.trim().length < 3) {
      errors.shopName = 'Shop name must be at least 3 characters';
    }

    if (!phone || !phone.trim()) {
      errors.phone = 'Phone number is required';
    } else {
      const digits = phone.replace(/\D/g, '');
      if (digits.length !== 10) {
        errors.phone = 'Phone number must be 10 digits';
      }
    }

    const hasItems = orderItems.some(item => (item.qty || 0) > 0);
    if (!hasItems) {
      errors.orderItems = 'At least one product must be ordered';
    } else {
      for (const item of orderItems) {
        const qty = item.qty || 0;
        if (qty > 0 && Object.prototype.hasOwnProperty.call(stockLimits, item.productId)) {
          const limit = stockLimits[item.productId];
          if (qty > limit) {
            errors.orderItems = `Only ${limit} unit${limit !== 1 ? 's' : ''} of "${item.name}" available`;
            break;
          }
        }
      }
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  /* ── from validation/cashHandover.validation.js ── */
  /**
   * Validates cash handover form.
   * @param {{ actualCounted: number, supervisorName: string }} data
   */
  function validateCashHandover({ actualCounted, supervisorName }) {
    const errors = {};

    const n = Number(actualCounted);
    if (!actualCounted && actualCounted !== 0) {
      errors.actualCounted = 'Actual cash counted is required';
    } else if (isNaN(n) || n < 0) {
      errors.actualCounted = 'Amount must be a non-negative number';
    }

    if (!supervisorName || !supervisorName.trim()) {
      errors.supervisorName = 'Supervisor name is required for sign-off';
    } else if (supervisorName.trim().length < 3) {
      errors.supervisorName = 'Supervisor name must be at least 3 characters';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  /* ── from validation/openingCash.validation.js ── */
  /**
   * Validates the opening cash amount.
   * @param {{ amount: number }} data
   */
  function validateOpeningCash({ amount }) {
    const errors = {};
    const n = Number(amount);

    if (!amount && amount !== 0) {
      errors.amount = 'Amount is required';
    } else if (isNaN(n) || n < 0) {
      errors.amount = 'Amount must be a non-negative number';
    } else if (n > 50000) {
      errors.amount = 'Opening cash cannot exceed ₹50,000';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  /* ── from validation/payment.validation.js ── */
  /**
   * Validates a payment collection submission.
   * @param {{ amount: number, method: string, totalDue: number }} data
   */
  function validatePayment({ amount, method, totalDue, allowOverpayment = false, requirePositive = false }) {
    const errors = {};
    const n = Number(amount);

    if (!amount && amount !== 0) {
      errors.amount = 'Amount is required';
    } else if (isNaN(n) || n < 0) {
      errors.amount = 'Amount must be a non-negative number';
    } else if (requirePositive && n === 0) {
      errors.amount = 'Amount must be greater than ₹0';
    } else if (!allowOverpayment && n > totalDue * 1.01) {
      // Allow 1% tolerance for rounding
      errors.amount = `Amount (₹${n.toLocaleString('en-IN')}) exceeds total due (₹${totalDue.toLocaleString('en-IN')})`;
    }

    if (!method || !Object.values(PaymentMethod).includes(method)) {
      errors.method = 'Invalid payment method';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  /* ── from validation/skipStop.validation.js ── */
  /**
   * Validates a skip-stop submission.
   * @param {{ reason: string, note?: string }} data
   */
  function validateSkipStop({ reason, note }) {
    const errors = {};

    if (!reason || !reason.trim()) {
      errors.reason = 'A skip reason is required';
    }

    if (note && note.length > 500) {
      errors.note = 'Note must be under 500 characters';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  /* ── from validation/stockCount.validation.js ── */
  /**
   * Validates the stock count submission.
   * @param {{ items: Array<{productId, actualCount}>, note?: string, discrepancies: Array }} data
   */
  function validateStockCount({ items = [], note, discrepancies = [] }) {
    const errors = {};

    items.forEach((item, i) => {
      const val = parseInt(item.actualCount);
      if (isNaN(val) || val < 0) {
        errors[`item_${i}`] = `Invalid count for item ${i + 1}`;
      }
    });

    if (discrepancies.length > 0 && (!note || !note.trim())) {
      errors.note = 'A note explaining the discrepancy is required';
    }

    if (note && note.length > 1000) {
      errors.note = 'Note must be under 1000 characters';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  /* ── from validation/stockLoad.validation.js ── */
  /**
   * Validates the stock load confirmation form.
   * @param {{ products: Array<{productId: string, loadedQty: number}> }} data
   */
  function validateStockLoad({ products = [] }) {
    const errors = {};

    if (!products.length) {
      errors.products = 'No products to load';
    }

    products.forEach((p, i) => {
      if (!Number.isInteger(p.loadedQty) || p.loadedQty < 0) {
        errors[`product_${i}`] = `Invalid quantity for product ${i + 1}`;
      }
    });

    const totalUnits = products.reduce((s, p) => s + (p.loadedQty || 0), 0);
    if (totalUnits === 0) {
      errors.total = 'Total loaded units must be greater than 0';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  window.RD_VALID = {
    validateAddCustomer: validateAddCustomer,
    validateCashHandover: validateCashHandover,
    validateOpeningCash: validateOpeningCash,
    validatePayment: validatePayment,
    validateSkipStop: validateSkipStop,
    validateStockCount: validateStockCount,
    validateStockLoad: validateStockLoad,
  };
})();

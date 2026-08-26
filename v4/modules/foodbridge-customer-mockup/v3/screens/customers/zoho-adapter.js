/* ==========================================================================
   Zoho Sales Order — integration adapter.

   THIS IS A MOCK. There is no Zoho tenant behind this prototype and no
   network call leaves the page; `createSalesOrder` resolves against an
   in-memory fake after a short delay. It is written as a real adapter
   anyway — one async boundary, one request shape, one response shape, its
   own error type — so that swapping the body of `postToZoho` for an actual
   `fetch` against Zoho's Sales Orders API is the only change this file
   needs, and nothing that calls it has to move.

   The production sequence this stands in for:

       FoodBridge order created (already persisted, has its own id)
              ↓  createSalesOrder(order)
       POST /books/v3/salesorders          ← the real call goes here
              ↓
       { salesorder: { salesorder_number, salesorder_id } }

   IDEMPOTENCY. The FoodBridge order id is sent as the idempotency key and
   is what the adapter keys its own memory on, so a retry after a failure
   asks Zoho to finish the SAME order rather than raising a second one. The
   caller never creates a new FoodBridge order to retry — see
   `retryZohoForOrder` in stock-audit.js.
   ========================================================================== */

(function () {
  "use strict";

  // Where a real deployment would read its endpoint/token from. Kept
  // together and named as they would be so the shape of the change is
  // obvious, rather than scattering config through the call site.
  const CONFIG = {
    mode: "mock",                      // "mock" | "live"
    baseUrl: null,                     // e.g. "https://www.zohoapis.in/books/v3"
    organizationId: null,
    // Nothing reads a token in mock mode; a live build would source one from
    // the platform's auth layer, never from a literal here.
    getAuthToken: () => null,
  };

  const LATENCY_MS = 900;

  // Deterministic per FoodBridge order, so the same order retried twice
  // yields the same Zoho number instead of a fresh one each attempt.
  function mockZohoNumber(foodbridgeOrderId) {
    let h = 0;
    const s = String(foodbridgeOrderId || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return "SO-" + String(10000000 + (h % 89999999));
  }

  function ZohoError(message, code) {
    const e = new Error(message);
    e.name = "ZohoError";
    e.code = code || "zoho_unavailable";
    return e;
  }

  // Every call the adapter has already satisfied, keyed by the FoodBridge
  // order id. In a live build this is Zoho's own idempotency handling; here
  // it is what makes a retry safe within the session.
  const acknowledged = {};

  /** The request body, in the shape Zoho's Sales Orders API expects. */
  function toZohoPayload(order) {
    return {
      reference_number: order.id,
      customer_name: order.customerName,
      date: String(order.createdAt || "").slice(0, 10),
      notes: "Raised from FoodBridge predictive sales order",
      custom_fields: [
        { label: "FoodBridge Order", value: order.id },
        { label: "Source", value: order.source },
      ],
      line_items: (order.lines || []).map((l) => ({
        name: l.productName,
        sku: l.artNo || undefined,
        quantity: l.qty,
        unit: l.unit,
      })),
    };
  }

  /**
   * The one place a real network call would live. Mock mode resolves a
   * realistic response; live mode is left explicit rather than silently
   * falling back to the mock, so a half-configured deployment fails loudly.
   */
  function postToZoho(payload, order) {
    if (CONFIG.mode !== "mock") {
      return Promise.reject(ZohoError("Zoho live mode is not configured.", "not_configured"));
    }
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // A deliberate, opt-in failure switch. Nothing fails at random: a
        // demo that breaks unpredictably is worse than one that cannot show
        // its own error path at all. Set window.FB_ZOHO_FAIL = true to
        // exercise the "FoodBridge created, Zoho failed" state and the retry
        // that must not duplicate the FoodBridge order.
        if (window.FB_ZOHO_FAIL) {
          reject(ZohoError("Zoho did not accept the sales order.", "zoho_rejected"));
          return;
        }
        const number = mockZohoNumber(order.id);
        resolve({
          salesorder: {
            salesorder_id: String(Math.abs(hashOf(order.id)) % 999999999),
            salesorder_number: number,
            status: "draft",
            reference_number: payload.reference_number,
          },
        });
      }, LATENCY_MS);
    });
  }

  function hashOf(s) {
    let h = 0;
    const str = String(s || "");
    for (let i = 0; i < str.length; i++) h = (h * 33 + str.charCodeAt(i)) | 0;
    return h;
  }

  /**
   * createSalesOrder(order) -> Promise<{ zohoOrderNumber, zohoOrderId, raw }>
   *
   * `order` is a FoodBridge sales order that has ALREADY been persisted.
   * Rejects with a ZohoError the caller is expected to surface — never
   * swallowed, because a silent failure here is an order the distributor
   * thinks exists in Zoho and does not.
   */
  function createSalesOrder(order) {
    if (!order || !order.id) {
      return Promise.reject(ZohoError("A FoodBridge order is required.", "missing_order"));
    }
    // Already accepted in this session — return the same reference rather
    // than raising a duplicate sales order in Zoho.
    if (acknowledged[order.id]) return Promise.resolve(acknowledged[order.id]);

    return postToZoho(toZohoPayload(order), order).then((res) => {
      const so = (res && res.salesorder) || {};
      const result = {
        zohoOrderNumber: so.salesorder_number || null,
        zohoOrderId: so.salesorder_id || null,
        raw: res,
      };
      acknowledged[order.id] = result;
      return result;
    });
  }

  window.FB_ZOHO = { createSalesOrder, CONFIG, isMock: () => CONFIG.mode === "mock" };
})();

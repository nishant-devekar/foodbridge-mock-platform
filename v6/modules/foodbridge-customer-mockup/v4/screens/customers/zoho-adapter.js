/* ==========================================================================
   Zoho Sales Order — the browser half of a REAL integration.

   THIS IS NO LONGER A MOCK. It was one; what replaced it makes an actual HTTP
   call to the FoodBridge Zoho function, which holds the OAuth credentials and
   calls Zoho Books. Every sales order number and id this file returns came out
   of Zoho. Nothing here fabricates an identifier, and there is no offline
   success path to fall back to: if the bridge is unreachable the order is
   reported as NOT synced, because telling a distributor an order reached Zoho
   when it did not is the one outcome this feature must never produce.

       this file  ──POST /api/sales-order──▶  Zoho function  ──▶  Zoho Books
                                              (OAuth lives here)

   WHAT THE BROWSER KNOWS: the URL above, and nothing else. No client id, no
   client secret, no refresh token, no access token, no organisation id. Those
   are the function's environment and stay there — see zoho-function/README.md.

   IDEMPOTENCY is not kept here, deliberately. A flag in a tab cannot survive a
   reload, a second tab, or a phone sleeping mid-request. The function asks Zoho
   whether the FoodBridge reference already exists before it writes, every
   time, so calling this twice for one order attaches to the sales order that
   is already there rather than raising a second one. Retry is safe by
   construction rather than by remembering.

   The UI above this file knows nothing about OAuth, Zoho domains, or HTTP —
   it calls createSalesOrder(order, customer) and gets back real ids or a typed
   error, exactly as it did when this was a mock.
   ========================================================================== */

(function () {
  "use strict";

  // Long enough to outlast the function's own budget against Zoho, so that a
  // slow Zoho is reported by the server (which can then check by reference)
  // rather than guessed at here.
  const REQUEST_TIMEOUT_MS = 45000;

  const apiBase = () => (window.FB_INTEGRATION && window.FB_INTEGRATION.apiBaseUrl) || "";
  const apiKey = () => (window.FB_INTEGRATION && window.FB_INTEGRATION.apiKey) || "";

  /**
   * A typed error the screen branches on. `category` is the function's own
   * category string — the same closed set on both sides of the wire — so the
   * UI never parses a message to decide what to show.
   */
  function ZohoError(message, category, detail) {
    const e = new Error(message || "Accounts sync error.");
    e.name = "AccountsSyncError";
    e.code = category || "zoho_unavailable";
    e.category = e.code;
    e.detail = detail || null;
    return e;
  }

  /**
   * createSalesOrder(order, customer)
   *   -> Promise<{ zohoOrderNumber, zohoOrderId, zohoStatus, zohoCustomerId,
   *                zohoUrl, created, verification }>
   *
   * `order` is the CONFIRMED FoodBridge sales order, already persisted. What
   * the prediction once recommended is irrelevant by now — the line quantities
   * sent are the ones the salesperson confirmed in the footer.
   *
   * Rejects with a ZohoError the caller surfaces. Never swallowed: a silent
   * failure here is an order the distributor believes exists in Zoho and
   * does not.
   */
  function createSalesOrder(order, customer) {
    if (!order || !order.id) {
      return Promise.reject(ZohoError("A FoodBridge order is required.", "bad_request"));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    return fetch(apiBase() + "/api/sales-order", {
      method: "POST",
      headers: Object.assign(
        { "Content-Type": "application/json" },
        // Only sent when configured, so a localhost bridge needs no key.
        apiKey() ? { "X-FB-Key": apiKey() } : {}
      ),
      body: JSON.stringify({ order: order }),
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
    })
      .catch(function (e) {
        // Network-level failure: the request may or may not have reached the
        // function. Reported as a timeout so the screen holds the order as
        // PENDING and lets a retry check, rather than as a clean failure.
        const timedOut = e && e.name === "AbortError";
        throw ZohoError(
          timedOut ? "Accounts system did not respond in time." : "Accounts system unavailable.",
          timedOut ? "timeout" : "zoho_unavailable"
        );
      })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (json) {
          if (!res.ok) {
            throw ZohoError(
              (json && json.message) || "Accounts sync error.",
              (json && json.category) || "zoho_unavailable",
              (json && json.detail) || null
            );
          }
          return {
            zohoOrderNumber: json.zohoSalesOrderNumber || null,
            zohoOrderId: json.zohoSalesOrderId || null,
            zohoStatus: json.zohoStatus || null,
            zohoCustomerId: json.zohoCustomerId || null,
            zohoUrl: json.zohoUrl || null,
            created: !!json.created,
            verification: json.verification || null,
          };
        });
      })
      .finally(function () { clearTimeout(timer); });
  }

  /** Configuration check, for a support question or a setup screen. */
  function health() {
    return fetch(apiBase() + "/api/health", { credentials: "omit", cache: "no-store" })
      .then(function (res) { return res.json(); })
      .catch(function () {
        return { configured: false, missing: ["Accounts service unreachable"] };
      });
  }

  window.FB_ZOHO = { createSalesOrder: createSalesOrder, health: health, apiBase: apiBase };
})();

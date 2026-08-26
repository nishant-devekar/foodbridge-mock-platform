/* ==========================================================================
   Confirmed FoodBridge order → one real Zoho Books sales order.

   THE ONE RULE: a FoodBridge order id may correspond to at most ONE Zoho sales
   order, forever, however many times Retry is pressed.

   It is enforced by asking Zoho, not by remembering. A flag in a function
   instance dies with the instance; Zoho is the only party that actually knows
   whether the order is already there.

       already have a Zoho id?  ── yes ─▶ GET it, return it
                │ no
       search by reference_number ── found ─▶ return it, create nothing
                │ not found
             POST create
                │        └── timeout ──▶ search by reference again
                ▼                          found → return it
             GET it back                    not found → report PENDING,
                │                                       never re-POST
             verify field by field
   ========================================================================== */

import {
  ZohoError, buildSalesOrderPayload, createSalesOrder, getSalesOrder,
  findByReference, verify, salesOrderUrl, missingConfig,
} from "./zoho.js";
import { ZOHO_CUSTOMER_MAP } from "./mappings.js";

/**
 * A reference that already exists in Zoho must belong to the SAME customer,
 * or it is not this order's reference at all.
 *
 * FoodBridge order ids are counted out of each browser's own localStorage, so
 * two devices can independently mint "FB-SO-26-08-001" for different shops.
 * The de-duplication below keys on exactly that string. Without this check the
 * second device would be handed the first device's sales order and told its
 * order had synced -- the wrong customer, the wrong goods, silently.
 *
 * Refusing is the only safe answer: attaching is wrong, and creating a second
 * order under a reference that already means something else is worse.
 */
function assertSameCustomer(order, found) {
  const expected = ZOHO_CUSTOMER_MAP[order.customerId];
  if (!expected || !found.customer_id) return;
  if (String(found.customer_id) === String(expected)) return;
  throw new ZohoError("reference_conflict",
    "This order number already belongs to a different customer in Zoho.",
    `${order.id} is already ${found.salesorder_number || found.salesorder_id} for ` +
    `"${found.customer_name || found.customer_id}". Raise this order again to get a fresh number.`);
}

const log = (event, fields) =>
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }) + "\n");

/** Shape the API returns for a sales order that exists in Zoho. */
const result = (cfg, order, so, extra = {}) => ({
  foodbridgeOrderId: order.id,
  zohoSalesOrderId: String(so.salesorder_id),
  zohoSalesOrderNumber: so.salesorder_number || null,
  // Zoho's OWN status word. Never translated into a processing state this
  // bridge has not been told about — the customer owns what happens next.
  zohoStatus: so.status || null,
  zohoCustomerId: so.customer_id ? String(so.customer_id) : null,
  zohoReferenceNumber: so.reference_number || null,
  zohoUrl: salesOrderUrl(cfg, so.salesorder_id),
  ...extra,
});

export async function syncOrder(cfg, order, fetchImpl = fetch) {
  const missing = missingConfig(cfg);
  if (missing.length) {
    throw new ZohoError("not_configured", "Zoho integration is not configured.", `Missing: ${missing.join(", ")}`);
  }
  if (!order || !order.id) throw new ZohoError("bad_request", "A FoodBridge order is required.");

  log("zoho.sync.start", { orderId: order.id, customerId: order.customerId, lines: (order.lines || []).length });

  // 1. FoodBridge already believes this order is in Zoho — confirm, don't create.
  if (order.zohoOrderId) {
    const existing = await getSalesOrder(cfg, order.zohoOrderId, fetchImpl).catch(() => null);
    if (existing) {
      assertSameCustomer(order, existing);
      log("zoho.sync.already_linked", { orderId: order.id, salesorderId: existing.salesorder_id });
      return result(cfg, order, existing, { created: false });
    }
  }

  // 2. Ask Zoho whether this reference is already there. Every time, including
  //    the very first attempt — a previous run may have succeeded after the
  //    browser gave up on it.
  const found = await findByReference(cfg, order.id, fetchImpl);
  if (found) {
    assertSameCustomer(order, found);
    log("zoho.sync.already_exists", { orderId: order.id, salesorderId: found.salesorder_id });
    return result(cfg, order, found, { created: false });
  }

  // 3. Map and create. Mapping failures throw before anything is written.
  const { payload, lineMap, zohoCustomerId } = buildSalesOrderPayload(order);

  let created;
  try {
    created = await createSalesOrder(cfg, payload, fetchImpl);
  } catch (e) {
    if (e.category === "timeout") {
      // The order may well exist. Look before leaping — a blind retry here is
      // exactly how duplicate sales orders get made.
      log("zoho.sync.timeout_checking", { orderId: order.id });
      const recovered = await findByReference(cfg, order.id, fetchImpl).catch(() => null);
      if (recovered) {
        assertSameCustomer(order, recovered);
        log("zoho.sync.recovered", { orderId: order.id, salesorderId: recovered.salesorder_id });
        return result(cfg, order, recovered, { created: true, recovered: true });
      }
    }
    log("zoho.sync.failed", { orderId: order.id, category: e.category });
    throw e;
  }

  if (!created || !created.salesorder_id) {
    throw new ZohoError("zoho_rejected", "Zoho accepted the request but returned no sales order.");
  }

  // 4. Read it back. A 200 on the POST is not proof the order is in Zoho the
  //    way we meant it; the GET is.
  const readBack = await getSalesOrder(cfg, created.salesorder_id, fetchImpl).catch(() => created);
  const verification = verify(order, readBack, lineMap, zohoCustomerId);

  log("zoho.sync.created", {
    orderId: order.id,
    salesorderId: readBack.salesorder_id,
    salesorderNumber: readBack.salesorder_number,
    status: readBack.status,
    verified: verification.ok,
  });

  if (!verification.ok) {
    // The order exists but does not match. Reported as a failure rather than a
    // success, with the id so a human can go and look at it — never silently
    // accepted, and never re-created (it is there, and retrying will find it).
    const bad = verification.checks.filter((c) => !c.ok).map((c) => c.name).join(", ");
    throw new ZohoError("verification_failed",
      "Zoho created the order but it does not match.",
      `Mismatched: ${bad}. Zoho sales order ${readBack.salesorder_number || readBack.salesorder_id}.`);
  }

  return result(cfg, order, readBack, { created: true, verification });
}

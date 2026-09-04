/* The bridge, end to end, over real HTTP. Nothing in zoho.js or sync.js is
   stubbed -- only the far end of the socket, which is Zoho itself. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { startFakeZoho } from "./fake-zoho.js";
import { ZOHO_CUSTOMER_MAP, ZOHO_ITEM_MAP } from "../mappings.js";
import { config, missingConfig } from "../zoho.js";
import { syncOrder } from "../sync.js";

/* The PMF mappings a real deployment would fill in by hand. Set here so the
   committed mappings.js can stay honestly empty. */
function withMappings() {
  ZOHO_CUSTOMER_MAP.c01 = "460000000000111111";
  ZOHO_ITEM_MAP.p01 = { itemId: "460000000000222222", unit: "Box", factor: 1 };
  ZOHO_ITEM_MAP.p05 = { itemId: "460000000000333333", unit: "Pc", factor: 12 };
}
function clearMappings() {
  for (const k of Object.keys(ZOHO_CUSTOMER_MAP)) delete ZOHO_CUSTOMER_MAP[k];
  for (const k of Object.keys(ZOHO_ITEM_MAP)) delete ZOHO_ITEM_MAP[k];
}

const cfgFor = (zoho, over = {}) => config({
  ZOHO_CLIENT_ID: "cid",
  ZOHO_CLIENT_SECRET: "csecret",
  ZOHO_REFRESH_TOKEN: "rtoken",
  ZOHO_ORGANIZATION_ID: "60000000000",
  ZOHO_ACCOUNTS_URL: zoho.origin,
  ZOHO_API_BASE_URL: `${zoho.origin}/books/v3`,
  ZOHO_TIMEOUT_MS: "1500",
  ...over,
});

// A confirmed order in the exact shape stock-audit.js persists.
const order = (over = {}) => ({
  id: "FB-SO-26-08-001",
  customerId: "c01",
  customerName: "Ashok Sweets And Namkeen",
  createdAt: "2026-08-26T09:15:00.000Z",
  source: "predictive_order",
  lines: [
    // recommendedQty 12, but the salesperson set 17. 17 is what must ship.
    { productId: "p01", productName: "AMLA PICKLE", artNo: "405322000003173005",
      unit: "Box", qty: 17, recommendedQty: 12 },
  ],
  productCount: 1,
  unitCount: 17,
  ...over,
});

/* ------------------------------------------------------------------------- */

test("configuration: missing settings are named, never guessed", () => {
  assert.deepEqual(missingConfig(config({})), [
    "ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN", "ZOHO_ORGANIZATION_ID",
  ]);
});

test("unconfigured bridge reports not_configured, and calls nothing", async () => {
  const zoho = await startFakeZoho();
  try {
    await assert.rejects(
      () => syncOrder(config({ ZOHO_API_BASE_URL: `${zoho.origin}/books/v3` }), order()),
      (e) => e.category === "not_configured" && e.status === 503
    );
    assert.equal(zoho.state.posts, 0, "nothing may be sent to Zoho while unconfigured");
  } finally { await zoho.close(); }
});

test("A - happy path: real POST, real GET, confirmed quantity, reference", async () => {
  const zoho = await startFakeZoho();
  clearMappings(); withMappings();
  try {
    const res = await syncOrder(cfgFor(zoho), order());

    assert.equal(res.created, true);
    // Straight off the wire, not generated locally.
    assert.equal(res.zohoSalesOrderId, "460000000000000001");
    assert.equal(res.zohoSalesOrderNumber, "SO-00001");
    assert.equal(res.zohoStatus, "draft", "Zoho's own status, not one we chose");
    assert.equal(res.zohoReferenceNumber, "FB-SO-26-08-001");
    assert.equal(res.verification.ok, true);

    const sent = zoho.state.lastPayload;
    assert.equal(sent.customer_id, "460000000000111111", "mapped Zoho contact, not c01");
    assert.equal(sent.reference_number, "FB-SO-26-08-001");
    assert.equal(sent.line_items[0].item_id, "460000000000222222", "mapped Zoho item, not p01");
    assert.equal(sent.line_items[0].quantity, 17, "the CONFIRMED qty, not the recommended 12");
    assert.equal("rate" in sent.line_items[0], false, "no invented price");
    assert.equal(zoho.state.posts, 1);
  } finally { await zoho.close(); }
});

test("units: a factor mapping converts, and is applied to the confirmed qty", async () => {
  const zoho = await startFakeZoho();
  clearMappings(); withMappings();
  try {
    await syncOrder(cfgFor(zoho), order({
      id: "FB-SO-26-08-010",
      lines: [{ productId: "p05", productName: "LEMON PICKLE", unit: "Box", qty: 3 }],
    }));
    // 3 Box, item sold in Pc, 12 per Box -> 36. Never a bare 3.
    assert.equal(zoho.state.lastPayload.line_items[0].quantity, 36);
    assert.equal(zoho.state.lastPayload.line_items[0].unit, "Pc");
  } finally { await zoho.close(); }
});

/* ---- pricing: the confirmed price, and only the confirmed price --------- */

test("price: the CONFIRMED unit price is sent as the rate, not the catalogue's", async () => {
  const zoho = await startFakeZoho();
  clearMappings(); withMappings();
  try {
    const res = await syncOrder(cfgFor(zoho), order({
      // 65.50 is what the rep agreed with the shop. The catalogue said 70.
      lines: [{ productId: "p01", productName: "AMLA PICKLE", unit: "Box",
                qty: 17, unitPrice: 65.5, cataloguePrice: 70, priceEdited: true }],
    }));
    const item = zoho.state.lastPayload.line_items[0];
    assert.equal(item.rate, 65.5, "the rep's price, not the catalogue's 70");
    assert.equal(item.quantity, 17);
    assert.equal(res.verification.ok, true, "and Zoho is confirmed to have stored it");
  } finally { await zoho.close(); }
});

test("price: different products carry different prices, independently", async () => {
  const zoho = await startFakeZoho();
  clearMappings(); withMappings();
  try {
    await syncOrder(cfgFor(zoho), order({
      lines: [
        { productId: "p01", productName: "A", unit: "Box", qty: 2, unitPrice: 65.5 },
        { productId: "p05", productName: "B", unit: "Box", qty: 3, unitPrice: 120 },
      ],
    }));
    const items = zoho.state.lastPayload.line_items;
    assert.equal(items[0].rate, 65.5);
    // p05 maps factor 12: 3 Box -> 36 Pc, so the per-Pc rate is 120/12.
    assert.equal(items[1].rate, 10);
    assert.equal(items[1].quantity, 36);
    // The line total is the same money on both sides. That is the whole point
    // of dividing the rate by the factor the quantity was multiplied by.
    assert.equal(items[1].rate * items[1].quantity, 120 * 3);
  } finally { await zoho.close(); }
});

test("price: a confirmed ZERO is a decision and is sent; null is absent", async () => {
  const zoho = await startFakeZoho();
  clearMappings(); withMappings();
  try {
    await syncOrder(cfgFor(zoho), order({
      lines: [
        { productId: "p01", productName: "A", unit: "Box", qty: 1, unitPrice: 0 },
        { productId: "p05", productName: "B", unit: "Box", qty: 1, unitPrice: null },
      ],
    }));
    const items = zoho.state.lastPayload.line_items;
    assert.equal(items[0].rate, 0, "a free line is priced at zero, not unpriced");
    assert.equal("rate" in items[1], false, "no price on the line -> Zoho applies the item's own");
  } finally { await zoho.close(); }
});

test("price: a line from before per-line pricing sends no rate at all", async () => {
  const zoho = await startFakeZoho();
  clearMappings(); withMappings();
  try {
    // No `unitPrice` key whatsoever -- an order raised before the field
    // existed. It must behave exactly as it always did: Zoho prices it.
    await syncOrder(cfgFor(zoho), order({
      lines: [{ productId: "p01", productName: "A", artNo: "x", unit: "Box", qty: 5, recommendedQty: 5 }],
    }));
    assert.equal("rate" in zoho.state.lastPayload.line_items[0], false);
  } finally { await zoho.close(); }
});

test("price: decimals survive the round trip at the factor-1 mappings in use", async () => {
  const zoho = await startFakeZoho();
  clearMappings(); withMappings();
  try {
    const res = await syncOrder(cfgFor(zoho), order({
      lines: [{ productId: "p01", productName: "A", unit: "Box", qty: 7, unitPrice: 1234.57 }],
    }));
    assert.equal(zoho.state.lastPayload.line_items[0].rate, 1234.57);
    assert.equal(res.verification.ok, true);
  } finally { await zoho.close(); }
});

test("price: a negative or unusable price is REFUSED and nothing is written", async () => {
  const zoho = await startFakeZoho();
  clearMappings(); withMappings();
  try {
    for (const bad of [-1, Number.NaN, "abc", Infinity]) {
      await assert.rejects(
        () => syncOrder(cfgFor(zoho), order({
          lines: [{ productId: "p01", productName: "A", unit: "Box", qty: 1, unitPrice: bad }],
        })),
        (e) => e.category === "bad_request",
        `price ${String(bad)} must be refused`);
    }
    assert.equal(zoho.state.posts, 0, "nothing reached Zoho");
  } finally { await zoho.close(); }
});

test("price: Zoho storing a DIFFERENT rate fails verification, never silent success", async () => {
  const zoho = await startFakeZoho();
  clearMappings(); withMappings();
  try {
    zoho.state.mangleRate = true;      // Zoho keeps its own price instead of ours
    await assert.rejects(
      () => syncOrder(cfgFor(zoho), order({
        lines: [{ productId: "p01", productName: "A", unit: "Box", qty: 1, unitPrice: 65.5 }],
      })),
      (e) => e.category === "verification_failed" && /rate:p01/.test(e.detail),
      "a price Zoho did not store must be reported as a failure, naming the line");
  } finally { await zoho.close(); }
});

test("price: retry reuses the committed order and re-posts nothing", async () => {
  const zoho = await startFakeZoho();
  clearMappings(); withMappings();
  try {
    const priced = order({
      lines: [{ productId: "p01", productName: "A", unit: "Box", qty: 4, unitPrice: 65.5 }],
    });
    const first = await syncOrder(cfgFor(zoho), priced);
    assert.equal(zoho.state.posts, 1);
    assert.equal(zoho.state.lastPayload.line_items[0].rate, 65.5);

    // Exactly what the screen does on Retry Sync: the SAME stored record,
    // now carrying the id the first sync wrote back onto it.
    priced.zohoOrderId = first.zohoSalesOrderId;
    const again = await syncOrder(cfgFor(zoho), priced);

    assert.equal(again.created, false, "attached to the existing order");
    assert.equal(again.zohoSalesOrderId, first.zohoSalesOrderId);
    assert.equal(zoho.state.posts, 1, "no second sales order, and no second price");
  } finally { await zoho.close(); }
});

test("price: a timed-out sync retries at the same price, and never twice", async () => {
  const zoho = await startFakeZoho({ hangOnCreate: true });
  clearMappings(); withMappings();
  try {
    const priced = order({
      id: "FB-SO-26-08-777",
      lines: [{ productId: "p01", productName: "A", unit: "Box", qty: 4, unitPrice: 65.5 }],
    });

    // The POST hangs. Held as `timeout` -- PENDING to the screen, not failed --
    // and Zoho created nothing.
    await assert.rejects(() => syncOrder(cfgFor(zoho), priced), (e) => e.category === "timeout");
    assert.equal(zoho.state.posts, 0);

    // Retry Sync, with the SAME committed record. It goes through at the same
    // price -- the price is on the record, so there is nothing to re-derive.
    zoho.state.hangOnCreate = false;
    const first = await syncOrder(cfgFor(zoho), priced);
    assert.equal(zoho.state.posts, 1);
    assert.equal(zoho.state.lastPayload.line_items[0].rate, 65.5);

    // A further retry attaches to what is already there and prices nothing.
    zoho.state.hangOnCreate = true;
    const again = await syncOrder(cfgFor(zoho), priced);
    assert.equal(again.created, false, "found by reference before the hanging POST");
    assert.equal(again.zohoSalesOrderId, first.zohoSalesOrderId);
    assert.equal(zoho.state.posts, 1, "still exactly one sales order");
  } finally { await zoho.close(); }
});

test("E - unmapped customer fails clearly and writes nothing", async () => {
  const zoho = await startFakeZoho();
  clearMappings();
  ZOHO_ITEM_MAP.p01 = { itemId: "460000000000222222" };
  try {
    await assert.rejects(() => syncOrder(cfgFor(zoho), order()), (e) => {
      assert.equal(e.category, "customer_not_mapped");
      assert.match(e.detail, /c01/);
      return true;
    });
    assert.equal(zoho.state.posts, 0);
  } finally { await zoho.close(); }
});

test("F - unmapped product fails clearly and writes nothing", async () => {
  const zoho = await startFakeZoho();
  clearMappings();
  ZOHO_CUSTOMER_MAP.c01 = "460000000000111111";
  try {
    await assert.rejects(() => syncOrder(cfgFor(zoho), order()), (e) => {
      assert.equal(e.category, "product_not_mapped");
      assert.match(e.detail, /p01/);
      return true;
    });
    assert.equal(zoho.state.posts, 0, "a half-mapped order must not be half-raised");
  } finally { await zoho.close(); }
});

test("B - Zoho rejection surfaces as zoho_rejected, FoodBridge order untouched", async () => {
  const zoho = await startFakeZoho({ rejectCreate: true });
  clearMappings(); withMappings();
  try {
    await assert.rejects(() => syncOrder(cfgFor(zoho), order()),
      (e) => e.category === "zoho_rejected" && /item_id/.test(e.detail));
  } finally { await zoho.close(); }
});

test("C - retry finds the existing order by reference and creates no second one", async () => {
  const zoho = await startFakeZoho();
  clearMappings(); withMappings();
  try {
    const first = await syncOrder(cfgFor(zoho), order());
    assert.equal(first.created, true);
    assert.equal(zoho.state.posts, 1);

    // Retry with no local id at all -- the worst case, a browser that lost its
    // record. The reference lookup is what has to save it.
    const second = await syncOrder(cfgFor(zoho), order());
    assert.equal(second.created, false, "retry must attach, not create");
    assert.equal(second.zohoSalesOrderId, first.zohoSalesOrderId);
    assert.equal(zoho.state.posts, 1, "exactly one Zoho sales order, ever");

    // And again with the id FoodBridge would by then have persisted.
    const third = await syncOrder(cfgFor(zoho), order({ zohoOrderId: first.zohoSalesOrderId }));
    assert.equal(third.created, false);
    assert.equal(zoho.state.posts, 1);
  } finally { await zoho.close(); }
});

test("D - a timeout never re-posts; the reference lookup recovers the order", async () => {
  const zoho = await startFakeZoho({ hangOnCreate: true });
  clearMappings(); withMappings();
  try {
    // The POST hangs and times out. Zoho created nothing, so this is a real
    // failure -- but it is reported as `timeout`, which the UI holds as
    // PENDING rather than failed.
    await assert.rejects(() => syncOrder(cfgFor(zoho), order()), (e) => e.category === "timeout");

    // Now the other half of the same scenario: Zoho DID create it and only the
    // reply was lost. The retry must find it rather than write a duplicate.
    zoho.state.hangOnCreate = false;
    const created = await syncOrder(cfgFor(zoho), order());
    assert.equal(zoho.state.posts, 1);

    zoho.state.hangOnCreate = true;
    const retry = await syncOrder(cfgFor(zoho), order());
    assert.equal(retry.created, false, "found by reference before the hanging POST is reached");
    assert.equal(retry.zohoSalesOrderId, created.zohoSalesOrderId);
    assert.equal(zoho.state.posts, 1, "still exactly one");
  } finally { await zoho.close(); }
});

test("verification failure is reported as failure, not success", async () => {
  const zoho = await startFakeZoho({ mangleQty: true });
  clearMappings(); withMappings();
  try {
    await assert.rejects(() => syncOrder(cfgFor(zoho), order()), (e) => {
      assert.equal(e.category, "verification_failed");
      assert.match(e.detail, /qty:p01/);
      return true;
    });
  } finally { await zoho.close(); }
});

test("auth failure is its own category and leaks no secret", async () => {
  const zoho = await startFakeZoho({ badAuth: true });
  clearMappings(); withMappings();
  try {
    await assert.rejects(() => syncOrder(cfgFor(zoho), order({ id: "FB-SO-26-08-099" })), (e) => {
      assert.equal(e.category, "auth_failed");
      const blob = JSON.stringify(e.toJSON());
      assert.doesNotMatch(blob, /csecret|rtoken/, "no credential may appear in a client-visible error");
      return true;
    });
  } finally { await zoho.close(); }
});

test("a reference already belonging to another customer is REFUSED, not attached", async () => {
  const zoho = await startFakeZoho();
  clearMappings(); withMappings();
  ZOHO_CUSTOMER_MAP.c02 = "460000000000999999"; // a different shop
  try {
    // Device A raises FB-SO-26-08-001 for c01.
    const first = await syncOrder(cfgFor(zoho), order({ id: "FB-SO-26-08-001" }));
    assert.equal(first.created, true);

    // Device B, whose counter also started at 001, raises the same id for a
    // DIFFERENT customer. Handing back device A's sales order would tell the
    // second rep their order synced -- to the wrong shop.
    await assert.rejects(
      () => syncOrder(cfgFor(zoho), order({ id: "FB-SO-26-08-001", customerId: "c02" })),
      (e) => {
        assert.equal(e.category, "reference_conflict");
        assert.equal(e.status, 409);
        return true;
      }
    );
    assert.equal(zoho.state.posts, 1, "and nothing new may be written under that reference");
  } finally { await zoho.close(); }
});

test("deep link is null unless the operator configured a pattern", async () => {
  const zoho = await startFakeZoho();
  clearMappings(); withMappings();
  try {
    const plain = await syncOrder(cfgFor(zoho), order({ id: "FB-SO-26-08-020" }));
    assert.equal(plain.zohoUrl, null, "no URL is invented");

    const linked = await syncOrder(
      cfgFor(zoho, { ZOHO_SALES_ORDER_URL: "https://books.zoho.in/app#/salesorders/{salesorder_id}" }),
      order({ id: "FB-SO-26-08-021" })
    );
    assert.match(linked.zohoUrl, /^https:\/\/books\.zoho\.in\/app#\/salesorders\/4600/);
  } finally { await zoho.close(); }
});

/* Photo reading for S03's "Add later" items. The Anthropic client is a stand-in
   here (there is no API key in CI); what is under test is the request we send
   and everything we do with what comes back. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPhoto, toRecords, ExtractError, EXTRACT_MODEL } from "../extract.js";

function fakeClient(reply) {
  const calls = [];
  return {
    calls,
    beta: { messages: { create: async (req) => { calls.push(req); return typeof reply === "function" ? reply(req) : reply; } } },
  };
}
const photo = { kind: "invoices", mediaType: "image/jpeg", data: "AAAA" };

test("no API key: not configured, and no call is attempted", async () => {
  await assert.rejects(() => extractPhoto(photo, { anthropic: null }), (e) => e instanceof ExtractError && e.reason === "not_configured" && e.status === 503);
});

test("the request: Claude Opus 5, a strict tool, the image, and refusal fallbacks on", async () => {
  const c = fakeClient({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "record_rows", input: { rows: [] } }] });
  await extractPhoto(photo, { anthropic: c });
  const req = c.calls[0];
  assert.equal(req.model, EXTRACT_MODEL);
  assert.equal(req.model, "claude-opus-5");
  assert.equal(req.fallbacks, "default");
  assert.deepEqual(req.betas, ["server-side-fallback-2026-07-01"]);
  assert.equal(req.tools[0].strict, true);
  assert.equal(req.tools[0].input_schema.properties.rows.items.additionalProperties, false);
  assert.deepEqual(req.messages[0].content[0], { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAAA" } });
});

test("rows become records; a row missing what it needs is dropped and counted", async () => {
  const c = fakeClient({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "record_rows", input: { rows: [
    { date: "2026-08-14", customer: "Ashok Sweets", total: 1200.5, balance: 200, number: "INV-7", due_date: "2026-08-29" },
    { date: "14/08/2026", customer: "Bad date", total: 10, balance: null, number: null, due_date: null },
    { date: "2026-08-15", customer: "", total: 10, balance: null, number: null, due_date: null },
  ] } }] });
  const out = await extractPhoto(photo, { anthropic: c });
  assert.deepEqual(out.records, [{ date: "2026-08-14", customer: "Ashok Sweets", total: 1200.5, row: 1, balance: 200, number: "INV-7", dueDate: "2026-08-29" }]);
  assert.deepEqual(out.skipped, [{ reason: "unreadable_row", count: 2 }]);
});

test("payments and cost prices have their own shapes", () => {
  assert.deepEqual(toRecords("payments", [{ date: "2026-08-20", customer: "A", amount: 500 }]).records,
    [{ date: "2026-08-20", customer: "A", amount: 500, row: 1 }]);
  assert.deepEqual(toRecords("costs", [{ product: "Mango Pickle", sku: null, cost: 42 }, { product: "No price", sku: "X", cost: null }]),
    { records: [{ name: "Mango Pickle", cost: 42, row: 1 }], skipped: [{ reason: "unreadable_row", count: 1 }] });
});

test("a refusal, or a reply with no tool call, is unreadable -- never an empty success", async () => {
  await assert.rejects(() => extractPhoto(photo, { anthropic: fakeClient({ stop_reason: "refusal", content: [] }) }), (e) => e.reason === "unreadable");
  await assert.rejects(() => extractPhoto(photo, { anthropic: fakeClient({ stop_reason: "end_turn", content: [{ type: "text", text: "I can't read this" }] }) }), (e) => e.reason === "unreadable");
});

test("only images, only the three kinds", async () => {
  const c = fakeClient({});
  await assert.rejects(() => extractPhoto({ ...photo, mediaType: "application/pdf" }, { anthropic: c }), (e) => e.reason === "bad_request");
  await assert.rejects(() => extractPhoto({ ...photo, kind: "orders" }, { anthropic: c }), (e) => e.reason === "bad_request");
  assert.equal(c.calls.length, 0);
});

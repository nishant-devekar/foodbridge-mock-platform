/* Control Tower · FoodBridge AI, headless. Run from v7/:
     node --test test/control-tower/*.test.js
   Every answer is read off the signal engine; nothing is computed here. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const F = require("./fixture.js");

function ai(opts) {
  const w = F.world(opts);
  const v = w.tower.pass();
  return { w, v, a: w.tower.assistant(() => null) };
}
const text = (r) => r.blocks.map((b) => b.text || (b.items || []).map((i) => i.text).join(" | ")).join(" ");

test("'What's going wrong today?' summarises the ranked signals, with their figures, and cites them", () => {
  const { v, a } = ai();
  const r = a.ask("What's going wrong today?");
  assert.equal(r.intent, "summary");
  const list = r.blocks.find((b) => b.type === "list");
  assert.deepEqual(list.items.map((i) => i.signalId), v.signals.slice(0, list.items.length).map((s) => s.id), "same order as the screen");
  for (const s of v.signals.slice(0, 3)) if (typeof s.impact.value === "number") assert.ok(text(r).includes(s.impact.description), "figure straight from the signal");
  assert.deepEqual(r.cites, list.items.map((i) => i.signalId));
  assert.match(text(r), /isn't live|run to|imported/i, "it says the data is not live");
});

test("'What should I do first?' names the top actionable signal and why", () => {
  const { v, a } = ai();
  const r = a.ask("What should I do first?");
  const top = v.signals.find((s) => s.recommendation);
  assert.equal(r.proposal.signalId, top.id);
  assert.match(text(r), /first because/);
  assert.match(text(r), /Nothing happens until you confirm/);
});

test("'Why is stock at risk?' explains the stock signal: why, impact calculation, recommendation", () => {
  const { v, a } = ai();
  const r = a.ask("Why is stock at risk?");
  const s = v.signals.find((x) => x.id === "stockout");
  assert.equal(r.intent, "why");
  assert.deepEqual(r.cites, ["stockout"]);
  assert.ok(text(r).includes(s.impact.calc));
  assert.ok(text(r).includes(s.recommendation.title));
});

test("'Fix the stock problem' prepares — it returns a proposal and changes nothing", () => {
  const { w, a } = ai();
  const r = a.ask("Fix the stock problem");
  assert.equal(r.intent, "fix");
  assert.deepEqual(r.proposal, { signalId: "stockout", actionType: "create_purchase_request", label: "Review & reorder" });
  assert.equal(w.store.read().purchaseRequests.length, 0);
  assert.match(text(r), /I won't do it for you/);
});

test("asked about delivery or expiry, it says it cannot see them and why", () => {
  const { a } = ai();
  for (const q of ["Are my deliveries late?", "Anything expiring?"]) {
    const r = a.ask(q);
    assert.equal(r.intent, "unavailable");
    assert.match(text(r), /No (delivery|batch)/);
  }
});

test("asked about money with no invoices, it says so rather than guessing", () => {
  const { a } = ai();
  const r = a.ask("How much am I owed?");
  assert.match(text(r), /No invoices or payments in your records/);
});

test("with the sample ledger, money questions answer from the overdue signal", () => {
  const { v, a } = ai({ dataReady: F.sampleDataReady() });
  const r = a.ask("Who owes me money?");
  assert.deepEqual(r.cites, ["overdue"]);
  assert.ok(text(r).includes(v.signals.find((s) => s.id === "overdue").title));
});

test("'Is this live?' is answered honestly, source by source", () => {
  const { a } = ai();
  const r = a.ask("Is this data live?");
  assert.equal(r.intent, "fresh");
  assert.match(text(r), /^No — this isn't live/);
  assert.match(text(r), /Delivery: Not connected/);
});

test("outside what it knows, it offers a person", () => {
  const { a } = ai();
  const r = a.ask("Should I open a second warehouse in Pune?");
  assert.equal(r.intent, "unknown");
  assert.equal(r.proposal.escalate, true);
});

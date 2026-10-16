/* Testers' progress on Store Flow Editor trials. Under test: a report is
   rebuilt from what is allowed (never stored as sent), a tester's latest
   report replaces the last one, and a trial lists only its own testers. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.FB_JOURNEYS_DIR = mkdtempSync(join(tmpdir(), "fb-journeys-"));
delete process.env.BLOB_READ_WRITE_TOKEN;

const { cleanReport, save, list } = await import("../journeys.js");
const { default: handler } = await import("../api/journeys.js");

function call(method, { body, url = "/api/journeys" } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 0, setHeader() {}, writeHead(s) { this.statusCode = s; },
      end(b) { resolve({ status: this.statusCode, json: JSON.parse(String(b || "null")) }); },
    };
    handler({ method, url, headers: { origin: "" }, body }, res);
  });
}
const now = Date.now();
const report = (over) => Object.assign({ trial: "T-abc123", tester: { id: "d-tester01", name: "  Asha   K " }, flow: { id: "store-journey", version: "2.1.1" },
  states: { "add-products": "done", "fix-products": "open" }, opened: { "add-products": now - 9e6, "fix-products": now - 3e6 }, doneAt: { "add-products": now - 5e6 }, focus: "fix-products", at: now }, over);

test("a report keeps only known states, sane times and a clean name", () => {
  const r = cleanReport(report({ states: { "add-products": "done", "fix-products": "open", "x y": "open", "tidy": "hacked" }, opened: { "fix-products": now + 864e5 * 9 } }));
  assert.deepEqual(r.states, { "add-products": "done", "fix-products": "open" });
  assert.deepEqual(r.opened, {});
  assert.equal(r.tester.name, "Asha K");
  assert.equal(r.focus, "fix-products");
});

test("bad trial or tester ids are refused", () => {
  assert.throws(() => cleanReport(report({ trial: "../etc" })), /trial/);
  assert.throws(() => cleanReport(report({ tester: { id: "x" } })), /tester/);
  assert.throws(() => cleanReport(report({ states: {} })), /No steps/);
});

test("the latest report replaces the last; a trial lists its own testers", async () => {
  await save(cleanReport(report()));
  await save(cleanReport(report({ states: { "add-products": "done", "fix-products": "done" }, at: now + 1000 })));
  await save(cleanReport(report({ tester: { id: "d-tester02", name: "Ravi" } })));
  await save(cleanReport(report({ trial: "T-other1", tester: { id: "d-tester03" } })));
  const xs = await list("T-abc123");
  assert.equal(xs.length, 2);
  assert.equal(xs.find((x) => x.tester.id === "d-tester01").states["fix-products"], "done");
});

test("the route saves a report and reads a trial back", async () => {
  assert.equal((await call("POST", { body: report({ tester: { id: "d-tester04", name: "Meena" } }) })).status, 200);
  assert.equal((await call("POST", { body: report({ trial: "nope" }) })).status, 400);
  const r = await call("GET", { url: "/api/journeys?trial=T-abc123" });
  assert.equal(r.status, 200);
  assert.ok(r.json.testers.some((t) => t.tester.name === "Meena"));
});

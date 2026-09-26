/* Store Builder builds. What is under test is the PROMISE the phone relies
   on: a file is either stored, or the phone is told it was not -- because the
   phone deletes its copy on success. And the team's side: nothing is read
   without the team key once one is set, and a phone cannot write outside its
   own store's folder. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DIR = mkdtempSync(join(tmpdir(), "fb-stores-"));
process.env.FB_STORES_DIR = DIR;
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.FB_STORES_KEY;

const { cleanUpload, save, list, read, teamOk, storesStore, StoresError, MAX_FILE } = await import("../stores.js");
const { default: handler } = await import("../api/stores.js");

const ID = "SB-mg2k9x1a-4f7q2";
const b64 = (s) => Buffer.from(s).toString("base64");

/* A Vercel-style req/res pair, enough for the handler. */
function call(method, { body, url = "/api/stores", headers = {} } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 0, headers: {}, chunks: [],
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      writeHead(s, h) { this.statusCode = s; Object.assign(this.headers, h || {}); },
      end(b) {
        const raw = b == null ? "" : b;
        let json = null;
        try { json = JSON.parse(String(raw)); } catch { /* a file */ }
        resolve({ status: this.statusCode, json, raw, headers: this.headers });
      },
    };
    handler({ method, url, headers: Object.assign({ origin: "" }, headers), body }, res);
  });
}

test("ids and file names are held to a pattern, so nothing climbs out of its folder", () => {
  for (const id of ["", "x", "../etc", "SB-UPPER-case1", "SB-abc-12"]) {
    assert.throws(() => cleanUpload({ id, meta: {} }), (e) => e instanceof StoresError && e.reason === "bad_id", id);
  }
  for (const name of ["../x.xlsx", "photos/../../x.jpg", "a.exe", "photos/a.jpg/../b", "/etc/passwd", "voice/x.js"]) {
    assert.throws(() => cleanUpload({ id: ID, file: { name, data: b64("x") } }), (e) => e.reason === "bad_name", name);
  }
  assert.equal(cleanUpload({ id: ID, file: { name: "photos/ph_1.jpg", data: b64("x") } }).files[0].type, "image/jpeg");
  assert.equal(cleanUpload({ id: ID, file: { name: "FoodBridge-Setup-Gupta-Traders-2026-09-26.xlsx", data: b64("x") } }).files[0].name.endsWith(".xlsx"), true);
});

test("an empty or oversized file is refused, and the refusal is not retryable", () => {
  assert.throws(() => cleanUpload({ id: ID, file: { name: "setup.json", data: "" } }), (e) => e.reason === "empty_file" && e.status === 400);
  const big = Buffer.alloc(MAX_FILE + 1).toString("base64");
  assert.throws(() => cleanUpload({ id: ID, file: { name: "setup.json", data: big } }), (e) => e.reason === "too_large" && e.status === 413);
});

test("the summary is cleaned: numbers stay numbers, a far-off clock is not trusted", () => {
  const u = cleanUpload({ id: ID, meta: { shop: "  Gupta   Traders ", counts: { products: "7", customers: -3 }, at: "1999-01-01", files: ["setup.json", "../x"] } });
  assert.equal(u.meta.shop, "Gupta Traders");
  assert.equal(u.meta.counts.products, 7);
  assert.equal(u.meta.counts.customers, 0);
  assert.deepEqual(u.meta.files, ["setup.json"]);
  assert.ok(Date.parse(u.meta.at) > Date.parse("2020-01-01"), "an absurd clock falls back to arrival");
});

test("a build sent piece by piece is listed once, with what is still to come", async () => {
  assert.equal(storesStore(), "file");
  let r = await call("POST", { body: { id: ID, meta: { shop: "Gupta Traders", at: new Date().toISOString(), files: ["setup.json", "photos/ph_1.jpg"] } } });
  assert.equal(r.status, 200);
  r = await call("POST", { body: { id: ID, file: { name: "setup.json", data: b64('{"a":1}') } } });
  assert.equal(r.status, 200);
  assert.equal(readFileSync(join(DIR, ID, "setup.json"), "utf8"), '{"a":1}');

  r = await call("GET");
  assert.equal(r.status, 200);
  const s = r.json.stores.find((x) => x.id === ID);
  assert.equal(s.meta.shop, "Gupta Traders");
  assert.deepEqual(s.files.map((f) => f.name), ["setup.json"]);
  assert.deepEqual(s.missing, ["photos/ph_1.jpg"]);

  r = await call("GET", { url: "/api/stores?id=" + ID + "&file=setup.json" });
  assert.equal(r.status, 200);
  assert.equal(String(r.raw), '{"a":1}');
  assert.equal(r.headers["Content-Type"], "application/json");
});

test("a bad upload answers 4xx and writes nothing", async () => {
  const r = await call("POST", { body: { id: "SB-nope", file: { name: "setup.json", data: b64("x") } } });
  assert.equal(r.status, 400);
  assert.equal(existsSync(join(DIR, "SB-nope")), false);
});

test("once a team key is set, reading needs it; writing never does", async () => {
  process.env.FB_STORES_KEY = "team-secret-123";
  try {
    assert.equal((await call("GET")).status, 401);
    assert.equal((await call("GET", { headers: { "x-fb-team": "wrong-secret-12" } })).status, 401);
    assert.equal((await call("GET", { headers: { "x-fb-team": "team-secret-123" } })).status, 200);
    assert.equal((await call("POST", { body: { id: ID, meta: { shop: "Again" } } })).status, 200);
  } finally {
    delete process.env.FB_STORES_KEY;
  }
});

test("a Blob deployment without a team key refuses to list at all", () => {
  assert.equal(teamOk({ headers: {} }, { token: "tok", teamKey: "", dir: DIR }), false);
  assert.equal(teamOk({ headers: {} }, { token: "", teamKey: "", dir: DIR }), true);   // the local folder
});

test("reading a file outside the patterns is refused", async () => {
  await assert.rejects(read(ID, "../../etc/passwd"), (e) => e.reason === "bad_name");
  await assert.rejects(read(ID, "photos/none.jpg"), (e) => e.reason === "not_found");
  assert.ok((await list()).length >= 1);
  await save(cleanUpload({ id: ID, file: { name: "photos/ph_1.jpg", data: b64("jpeg") } }));
  assert.deepEqual((await list()).find((x) => x.id === ID).missing, []);
});

/* ── the email backup (stores-email.js), with Resend's API stubbed ─────── */

function stubFetch(status) {
  const sent = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { sent.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization }); return { ok: status < 300, status }; };
  return { sent, restore: () => { globalThis.fetch = real; } };
}
const FIRST = { id: "SB-mg2k9x1b-5f7q2", meta: { shop: "Gupta Traders", owner: "Ramesh", mobile: "9820011223", counts: { products: 7 } },
  files: [{ name: "FoodBridge-Setup-Gupta-Traders-2026-09-26.xlsx", data: b64("PK-xlsx") }, { name: "setup.json", data: b64("{}") }] };

test("the Excel is also emailed to the team, with setup.json and the store's summary", async () => {
  process.env.RESEND_API_KEY = "re_test";
  process.env.FB_STORES_EMAIL_TO = "team-a@example.com, team-b@example.com";
  const f = stubFetch(200);
  try {
    const r = await call("POST", { body: FIRST });
    assert.equal(r.status, 200);
    assert.equal(r.json.stored, true);
    assert.equal(r.json.emailed, true);
    assert.equal(f.sent.length, 1);
    const m = f.sent[0].body;
    assert.equal(f.sent[0].url, "https://api.resend.com/emails");
    assert.equal(f.sent[0].auth, "Bearer re_test");
    assert.deepEqual(m.to, ["team-a@example.com", "team-b@example.com"]);
    assert.match(m.subject, /Gupta Traders \(Ramesh, 9820011223\)/);
    assert.deepEqual(m.attachments.map((a) => a.filename), ["FoodBridge-Setup-Gupta-Traders-2026-09-26.xlsx", "SB-mg2k9x1b-5f7q2-setup.json"]);
    assert.equal(Buffer.from(m.attachments[0].content, "base64").toString(), "PK-xlsx");
    /* A photo is not emailed. */
    await call("POST", { body: { id: FIRST.id, file: { name: "photos/p1.jpg", data: b64("jpg") } } });
    assert.equal(f.sent.length, 1);
  } finally { f.restore(); }
});

test("with no file store yet, the email alone counts -- and a refused email is not a delivery", async () => {
  const dir = process.env.FB_STORES_DIR;
  process.env.FB_STORES_DIR = "/dev/null/not-a-dir";
  const ok = stubFetch(200);
  try {
    assert.equal(storesStore(), "none");
    const r = await call("POST", { body: FIRST });
    assert.equal(r.status, 200);
    assert.equal(r.json.stored, false);
    assert.equal(r.json.emailed, true);
    /* Photos need the store: they wait on the phone. */
    assert.equal((await call("POST", { body: { id: FIRST.id, file: { name: "photos/p1.jpg", data: b64("jpg") } } })).status, 503);
  } finally { ok.restore(); }
  const bad = stubFetch(500);
  try {
    assert.equal((await call("POST", { body: FIRST })).status, 503);
  } finally { bad.restore(); process.env.FB_STORES_DIR = dir; delete process.env.RESEND_API_KEY; delete process.env.FB_STORES_EMAIL_TO; }
});

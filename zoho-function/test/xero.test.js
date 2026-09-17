/* Onboarding's "Connect Xero", over real HTTP against a stand-in for Xero's
   identity and API hosts. The chunks must come out in the page's one shape. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { config, authorizeUrl, exchange, connection, organisations, readChunk, XERO_SCOPES, seal, signState, verifyState } from "../xero.js";
import { seal as zohoSeal } from "../onboarding.js";

const ENV = { FB_SEAL_KEY: "test-seal-key" };
const TENANT = "0f4c3a3e-1111-4c2b-9d5e-abcdefabcdef";

function startFake(opts = {}) {
  const calls = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    calls.push({ path: url.pathname + url.search, tenant: req.headers["xero-tenant-id"], auth: req.headers.authorization });
    const send = (s, b) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(b)); };
    if (opts.status) {
      if (opts.headers) for (const [k, v] of Object.entries(opts.headers)) res.setHeader(k, v);
      return send(opts.status, opts.body || { Title: "no" });
    }
    if (url.pathname === "/connect/token") {
      if (opts.badCode) return send(400, { error: "invalid_grant" });
      return send(200, { access_token: "xat-1", expires_in: 1800, token_type: "Bearer", scope: XERO_SCOPES });
    }
    if (url.pathname === "/connections") {
      return send(200, [{ id: "c1", tenantId: TENANT, tenantType: "ORGANISATION", tenantName: "Acme Foods NZ" },
                        { id: "c2", tenantId: "22222222-2222-4222-8222-222222222222", tenantType: "PRACTICE", tenantName: "An accountant" }]);
    }
    if (url.pathname === "/api.xro/2.0/Contacts") {
      const page = Number(url.searchParams.get("page"));
      const many = url.searchParams.get("where") === "IsCustomer==true" && page === 1 ? 100 : 1;
      return send(200, { Contacts: Array.from({ length: many }, (_, i) => ({ ContactID: "c" + (page * 1000 + i), Name: i ? "Shop " + i : "Ashok Sweets", IsCustomer: true, EmailAddress: "secret@shop" })) });
    }
    if (url.pathname === "/api.xro/2.0/Items") {
      return send(200, { Items: [
        { ItemID: "i1", Code: "PK1", Name: "Pickle 250g", IsTrackedAsInventory: true, QuantityOnHand: 12 },
        { ItemID: "i2", Code: "SVC", Description: "Delivery", IsTrackedAsInventory: false, QuantityOnHand: 0 },
      ] });
    }
    if (url.pathname === "/api.xro/2.0/Invoices") {
      return send(200, { Invoices: [
        { InvoiceID: "v1", Type: "ACCREC", Status: "AUTHORISED", DateString: "2099-01-01T00:00:00", Contact: { ContactID: "c1000", Name: "Ashok Sweets" },
          LineItems: [{ ItemCode: "PK1", Description: "Pickle 250g", Quantity: 6, UnitAmount: 55 }] },
        { InvoiceID: "v2", Type: "ACCREC", Status: "DRAFT", Date: "/Date(4070908800000+0000)/", Contact: { ContactID: "c1000", Name: "Ashok Sweets" } },
        { InvoiceID: "v3", Type: "ACCREC", Status: "VOIDED", DateString: "2099-01-03T00:00:00", Contact: { ContactID: "c1000", Name: "Ashok Sweets" }, LineItems: [] },
      ] });
    }
    if (url.pathname === "/api.xro/2.0/Invoices/v2") {
      return send(200, { Invoices: [{ InvoiceID: "v2", LineItems: [{ ItemCode: "SVC", Description: "Delivery", Quantity: 1 }] }] });
    }
    if (url.pathname === "/api.xro/2.0/Payments") return send(200, { Payments: [{ PaymentID: "p1", Amount: 10 }] });
    send(404, { Title: "nope" });
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r({
    origin: `http://127.0.0.1:${server.address().port}`, calls, close: () => new Promise((c) => server.close(c)),
  })));
}

const cfgFor = (origin) => config({
  ...ENV, ZOHO_CLIENT_SECRET: "zsecret", XERO_CLIENT_ID: "xid", XERO_CLIENT_SECRET: "xsecret",
  XERO_REDIRECT_URI: "http://localhost:8787/api/xero/callback",
  XERO_IDENTITY_URL: origin, XERO_LOGIN_URL: origin, XERO_API_URL: origin,
  ALLOWED_ORIGINS: "http://localhost:8017", ZOHO_TIMEOUT_MS: "1500",
});
const conn = (over = {}) => ({ p: "xero", at: "xat-1", exp: Date.now() + 60000, ...over });

test("the sign-in asks Xero for read scopes only, no offline access, and signs the state", () => {
  const cfg = cfgFor("http://x");
  const st = signState(cfg.sealCfg, { r: "http://localhost:8017/#/onboarding", n: "abcdefghijklmnop", p: "xero" }, ENV);
  const u = new URL(authorizeUrl(cfg, st));
  assert.equal(u.pathname, "/identity/connect/authorize");
  assert.equal(u.searchParams.get("scope"), "accounting.contacts.read accounting.settings.read accounting.invoices.read accounting.payments.read",
    "the granular scopes: a Web app made after March 2026 has no accounting.transactions.read");
  assert.ok(!/offline_access/.test(u.searchParams.get("scope")));
  assert.equal(u.searchParams.get("redirect_uri"), "http://localhost:8787/api/xero/callback");
  assert.equal(verifyState(cfg.sealCfg, u.searchParams.get("state"), ENV).p, "xero");
});

test("the code is exchanged with basic auth and sealed as a Xero connection; a Zoho seal is refused", async () => {
  const fake = await startFake();
  try {
    const cfg = cfgFor(fake.origin);
    const c = await exchange(cfg, "code-1");
    assert.equal(c.p, "xero"); assert.equal(c.at, "xat-1");
    assert.match(fake.calls[0].auth, /^Basic /);
    // Sealed and unsealed with the same key the routes use (the process env).
    const handle = seal(cfg.sealCfg, c);
    assert.equal(connection(cfg, handle).at, "xat-1");
    const zoho = zohoSeal(cfg.sealCfg, { at: "z", api: "http://z", exp: Date.now() + 1000 });
    assert.equal(connection(cfg, zoho), null, "a Zoho token is not a Xero token");
  } finally { await fake.close(); }
});

test("a bad code is 'failed', never 'connected'", async () => {
  const fake = await startFake({ badCode: true });
  try { await assert.rejects(exchange(cfgFor(fake.origin), "bad"), (e) => e.reason === "failed"); }
  finally { await fake.close(); }
});

test("only organisations are offered, never a practice", async () => {
  const fake = await startFake();
  try {
    const orgs = await organisations(cfgFor(fake.origin), conn());
    assert.deepEqual(orgs, [{ id: TENANT, name: "Acme Foods NZ" }]);
    assert.match(fake.calls[0].auth, /^Bearer xat-1$/);
  } finally { await fake.close(); }
});

test("chunks come out in the page's shape, with the tenant on every call", async () => {
  const fake = await startFake();
  try {
    const cfg = cfgFor(fake.origin);
    const c1 = await readChunk(cfg, conn(), TENANT, "customers", { page: 1 });
    assert.equal(c1.records.length, 100); assert.equal(c1.more, true);
    assert.deepEqual(Object.keys(c1.records[0]).sort(), ["id", "name", "raw"]);
    assert.equal(c1.records[0].name, "Ashok Sweets");
    const c2 = await readChunk(cfg, conn(), TENANT, "customers", { page: 2 });
    assert.equal(c2.more, false);
    assert.ok(fake.calls.every((x) => x.tenant === TENANT));

    const p = await readChunk(cfg, conn(), TENANT, "products");
    assert.deepEqual(p.records.map((x) => [x.id, x.name, x.sku, x.stockOnHand]),
      [["PK1", "Pickle 250g", "PK1", 12], ["SVC", "Delivery", "SVC", undefined]], "keyed by Code; untracked stock stays absent");

    const o = await readChunk(cfg, conn(), TENANT, "orders", { page: 1 });
    assert.equal(o.listed, 3);
    assert.deepEqual(o.excluded, { voided: 1 });
    assert.deepEqual(o.records.map((x) => [x.id, x.date, x.status, x.customerName, Array.isArray(x.lines)]),
      [["v1", "2099-01-01", "AUTHORISED", "Ashok Sweets", true], ["v2", "2099-01-01", "DRAFT", "Ashok Sweets", false]],
      "a draft counts; /Date(ms)/ is read; an invoice without lines says so");
    assert.deepEqual(o.records[0].lines, [{ itemId: "PK1", name: "Pickle 250g", qty: 6, raw: { ItemCode: "PK1", Description: "Pickle 250g", Quantity: 6, UnitAmount: 55 } }]);
    assert.match(fake.calls.at(-1).path, /Type%3D%3D%22ACCREC%22\+AND\+Date\+%3E%3D\+DateTime%28/);

    const l = await readChunk(cfg, conn(), TENANT, "lines", { ids: ["v2"] });
    assert.deepEqual(l.records[0].lines.map((x) => x.itemId), ["SVC"]);

    const m = await readChunk(cfg, conn(), TENANT, "customerpayments", { page: 1 });
    assert.equal(m.records[0].PaymentID, "p1");
    await assert.rejects(readChunk(cfg, conn(), TENANT, "nonsense"), (e) => e.reason === "bad_request");
  } finally { await fake.close(); }
});

test("Xero's refusals become the page's reasons", async () => {
  for (const [status, headers, reason] of [[401, {}, "expired"], [403, {}, "forbidden"],
       [429, { "X-Rate-Limit-Problem": "minute" }, "busy"], [429, { "X-Rate-Limit-Problem": "day" }, "daily_limit"], [500, {}, "unavailable"]]) {
    const fake = await startFake({ status, headers });
    try { await assert.rejects(readChunk(cfgFor(fake.origin), conn(), TENANT, "customers"), (e) => e.reason === reason, String(status)); }
    finally { await fake.close(); }
  }
  await assert.rejects(readChunk(cfgFor("http://x"), conn({ exp: Date.now() - 1 }), TENANT, "customers"), (e) => e.reason === "expired");
});

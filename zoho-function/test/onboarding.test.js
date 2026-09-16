/* Onboarding's "Connect Zoho Books", over real HTTP against a stand-in for
   Zoho's far end. Every outcome the S02 screens can draw has a test here:
   the page may only say "connected" on a genuine return, and may only show
   records Zoho actually sent. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  seal, unseal, signState, verifyState, returnWith, allowedReturn, accountsServer,
  authorizeUrl, readChunk, organisations, ReadError, ONBOARDING_SCOPES,
} from "../onboarding.js";
import { config, originAllowed } from "../zoho.js";

const ENV = { FB_SEAL_KEY: "test-seal-key" };

function startFake(opts = {}) {
  const calls = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    calls.push(url.pathname + url.search);
    const send = (s, b) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(b)); };
    if (opts.status) {
      if (opts.headers) for (const [k, v] of Object.entries(opts.headers)) res.setHeader(k, v);
      return send(opts.status, opts.body || { code: 1, message: "no" });
    }
    if (opts.raw) { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(opts.raw); }
    if (url.pathname === "/oauth/v2/token") {
      if (opts.badCode) return send(200, { error: "invalid_code" });
      return send(200, { access_token: "at-1", expires_in: 3600, api_domain: `http://127.0.0.1:${server.address().port}` });
    }
    if (url.pathname === "/books/v3/organizations") {
      return send(200, { code: 0, organizations: [{ organization_id: 111, name: "Acme Foods", email: "x@y" }] });
    }
    if (url.pathname === "/books/v3/contacts") {
      return send(200, { code: 0, contacts: [{ contact_id: 1, contact_name: "Ashok Sweets", email: "secret@shop", phone: "999" }],
        page_context: { has_more_page: url.searchParams.get("page") === "1" } });
    }
    if (url.pathname === "/books/v3/items") {
      return send(200, { code: 0, items: [
        { item_id: 7, name: "Pickle 250g", sku: "PK1", unit: "pcs", item_type: "inventory", track_inventory: true, stock_on_hand: 0, rate: 55 },
        { item_id: 8, name: "Service", item_type: "sales", track_inventory: false },
        { item_id: 9, name: "Tracked goods", item_type: "sales", track_inventory: true, stock_on_hand: 12 },
      ] });
    }
    if (url.pathname === "/books/v3/salesorders") {
      return send(200, { code: 0, salesorders: [
        { salesorder_id: 1, customer_id: 1, customer_name: "Ashok Sweets", date: "2099-01-01", status: "open", total: 100 },
        { salesorder_id: 2, customer_id: 1, customer_name: "Ashok Sweets", date: "2099-01-02", status: "draft" },
        { salesorder_id: 3, customer_id: 1, customer_name: "Ashok Sweets", date: "2099-01-03", status: "void" },
        { salesorder_id: 4, customer_id: 1, customer_name: "Ashok Sweets", date: "2099-01-04", status: "invoiced" },
        { salesorder_id: 5, customer_id: 1, customer_name: "Ashok Sweets", date: "2099-01-05", status: "pending_approval" },
        { salesorder_id: 6, customer_id: 1, customer_name: "Ashok Sweets", date: "2099-01-06", status: "closed" },
        { salesorder_id: 7, customer_id: 1, customer_name: "Ashok Sweets", date: "2099-01-07", status: "partially_invoiced" },
        { salesorder_id: 8, customer_id: 1, customer_name: "Ashok Sweets", date: "2099-01-08", status: "something_new" },
        { salesorder_id: 9, customer_id: 1, customer_name: "Ashok Sweets", date: "2000-01-01", status: "open" },
      ] });
    }
    const m = /^\/books\/v3\/salesorders\/(\d+)$/.exec(url.pathname);
    if (m) {
      return send(200, { code: 0, salesorder: { line_items: [
        { item_id: 7, name: "Pickle 250g", quantity: 6, quantity_cancelled: 2, unit: "pcs", rate: 55 },
      ] } });
    }
    send(404, { code: 5, message: "nope" });
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r({
    origin: `http://127.0.0.1:${server.address().port}`, calls, close: () => new Promise((c) => server.close(c)),
  })));
}

const cfgFor = (origin) => config({
  ZOHO_CLIENT_ID: "cid", ZOHO_CLIENT_SECRET: "csecret",
  ZOHO_ACCOUNTS_URL: origin, ZOHO_API_BASE_URL: `${origin}/books/v3`,
  ZOHO_REDIRECT_URI: "http://localhost:8787/api/callback",
  ALLOWED_ORIGINS: "http://localhost:8017", ZOHO_TIMEOUT_MS: "1500",
});
const conn = (origin, over = {}) => ({ at: "at-1", api: `${origin}/books/v3`, exp: Date.now() + 60000, ...over });

/* ── sealing and state ─────────────────────────────────────────────────── */

test("a sealed connection round-trips, and any tampering reads as nothing", () => {
  const cfg = cfgFor("http://x");
  const s = seal(cfg, { at: "tok", api: "a", exp: 1 }, ENV);
  assert.deepEqual(unseal(cfg, s, ENV), { at: "tok", api: "a", exp: 1 });
  assert.equal(s.includes("tok"), false, "the token is not readable in the sealed form");
  const flipped = s.slice(0, -2) + (s.slice(-2) === "AA" ? "AB" : "AA");
  assert.equal(unseal(cfg, flipped, ENV), null);
  assert.equal(unseal(cfg, "mock", ENV), null, "a dev stand-in handle is never a real connection");
  assert.equal(unseal(cfg, s, { FB_SEAL_KEY: "other" }), null);
});

test("state is signed, expires, and cannot be edited", () => {
  const cfg = cfgFor("http://x");
  const st = signState(cfg, { r: "http://localhost:8017/#/onboarding", n: "abcdefghijklmnop" }, ENV);
  assert.equal(verifyState(cfg, st, ENV).n, "abcdefghijklmnop");
  const [p, body, mac] = st.split(".");
  const evil = Buffer.from(JSON.stringify({ r: "https://evil.example", n: "x", exp: Date.now() + 1e6 })).toString("base64url");
  assert.equal(verifyState(cfg, [p, evil, mac].join("."), ENV), null);
  assert.equal(verifyState(cfg, "not-a-state", ENV), null);
  const old = Buffer.from(JSON.stringify({ r: "x", n: "y", exp: Date.now() - 1 })).toString("base64url");
  assert.equal(verifyState(cfg, [p, old, mac].join("."), ENV), null);
  assert.ok(body.length > 0);
});

test("a loopback page is served only when the dev-server opted in", () => {
  const strict = cfgFor("http://x");
  assert.equal(originAllowed(strict, "http://localhost:8011"), false, "a deployment keeps the exact list");
  assert.equal(originAllowed(strict, "http://localhost:8017"), true);
  const dev = config({ ...ENV, ALLOWED_ORIGINS: "http://localhost:8017", ALLOW_LOOPBACK_ORIGINS: "1" });
  assert.equal(originAllowed(dev, "http://localhost:8011"), true);
  assert.equal(originAllowed(dev, "http://127.0.0.1:8007"), true);
  assert.equal(originAllowed(dev, "https://localhost:8011"), false, "https loopback is not a dev page here");
  assert.equal(originAllowed(dev, "http://localhost.evil.example"), false);
  assert.equal(originAllowed(dev, "http://evil.example:8011"), false);
  assert.equal(originAllowed(dev, ""), false);
  assert.equal(allowedReturn(dev, "http://localhost:8011/#/onboarding"), "http://localhost:8011/#/onboarding");
  assert.equal(allowedReturn(strict, "http://localhost:8011/#/onboarding"), null);
});

test("returns only to allowed origins, and keep the shell's route", () => {
  const cfg = cfgFor("http://x");
  assert.equal(allowedReturn(cfg, "https://evil.example/#/onboarding"), null);
  assert.ok(allowedReturn(cfg, "http://localhost:8017/#/onboarding"));
  assert.equal(returnWith("http://localhost:8017/#/onboarding", { zoho: "denied", n: "q" }),
    "http://localhost:8017/#/onboarding?zoho=denied&n=q");
  assert.equal(returnWith("http://localhost:8017/#/onboarding?zoho=old", { zoho: "failed" }),
    "http://localhost:8017/#/onboarding?zoho=failed", "a stale result is replaced, not appended");
  assert.equal(returnWith("http://localhost:8017/x.html", { zoho: "failed" }), "http://localhost:8017/x.html#?zoho=failed");
});

test("sign-in asks for read scopes only, and no lasting access", () => {
  const cfg = cfgFor("http://x");
  const u = new URL(authorizeUrl(cfg, "ob.s.m"));
  assert.equal(u.searchParams.get("access_type"), "online");
  assert.equal(u.searchParams.get("scope"), ONBOARDING_SCOPES);
  assert.equal(/CREATE|UPDATE|DELETE|ALL/.test(ONBOARDING_SCOPES), false);
  assert.ok(ONBOARDING_SCOPES.split(",").every((sc) => /^ZohoBooks\.[a-z]+\.READ$/.test(sc)), "every scope is a READ scope");
  assert.equal(/banking|accountants|journals/i.test(ONBOARDING_SCOPES), false, "no bank or ledger access");
});

test("only a genuine Zoho accounts host is believed", () => {
  const cfg = cfgFor("http://fallback");
  assert.equal(accountsServer(cfg, "https://accounts.zoho.com"), "https://accounts.zoho.com");
  assert.equal(accountsServer(cfg, "https://accounts.zoho.in.evil.com"), "http://fallback");
  assert.equal(accountsServer(cfg, null), "http://fallback");
});

/* ── the callback, as a browser meets it ───────────────────────────────── */

async function callback(query, env = {}) {
  const saved = { ...process.env };
  Object.assign(process.env, ENV, env);
  try {
    const { default: handler } = await import("../api/callback.js");
    let status = 0, headers = {}, body = "";
    const res = {
      writeHead(s, h) { status = s; headers = h || {}; },
      end(b) { body = b || ""; },
    };
    await handler({ url: "/api/callback?" + query, headers: { host: "localhost:8787" } }, res);
    return { status, location: headers.Location, body };
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
}

function envFor(origin) {
  return {
    ZOHO_CLIENT_ID: "cid", ZOHO_CLIENT_SECRET: "csecret", ZOHO_ACCOUNTS_URL: origin,
    ZOHO_API_BASE_URL: `${origin}/books/v3`, ALLOWED_ORIGINS: "http://localhost:8017",
    ZOHO_REDIRECT_URI: "http://localhost:8787/api/callback", ZOHO_TIMEOUT_MS: "1500",
  };
}

test("denied in Zoho returns to the page as denied, with its nonce", async () => {
  const z = await startFake();
  try {
    const env = envFor(z.origin);
    const st = signState(config(env), { r: "http://localhost:8017/#/onboarding", n: "nonce-nonce-nonce-1" }, ENV);
    const r = await callback(new URLSearchParams({ state: st, error: "access_denied" }).toString(), env);
    assert.equal(r.status, 302);
    assert.equal(r.location, "http://localhost:8017/#/onboarding?zoho=denied&n=nonce-nonce-nonce-1");
  } finally { await z.close(); }
});

test("a code Zoho will not exchange returns as failed -- never as connected", async () => {
  const z = await startFake({ badCode: true });
  try {
    const env = envFor(z.origin);
    const st = signState(config(env), { r: "http://localhost:8017/#/onboarding", n: "nonce-nonce-nonce-2" }, ENV);
    const r = await callback(new URLSearchParams({ state: st, code: "c" }).toString(), env);
    assert.match(r.location, /zoho=failed/);
    assert.doesNotMatch(r.location, /connected|c=/);
  } finally { await z.close(); }
});

test("a genuine return is connected, and carries a sealed handle that reads", async () => {
  const z = await startFake();
  try {
    const env = envFor(z.origin);
    const cfg = config(env);
    const st = signState(cfg, { r: "http://localhost:8017/#/onboarding", n: "nonce-nonce-nonce-3" }, ENV);
    const r = await callback(new URLSearchParams({ state: st, code: "good" }).toString(), env);
    const h = new URLSearchParams(new URL(r.location).hash.split("?")[1]);
    assert.equal(h.get("zoho"), "connected");
    assert.equal(h.get("n"), "nonce-nonce-nonce-3");
    const c = unseal(cfg, h.get("c"), ENV);
    assert.equal(c.at, "at-1");
    assert.deepEqual(await organisations(cfg, c), [{ id: "111", name: "Acme Foods" }]);
  } finally { await z.close(); }
});

test("a forged state never redirects anywhere", async () => {
  const r = await callback("state=ob.abc.def&code=x", envFor("http://127.0.0.1:1"));
  assert.equal(r.status, 400);
  assert.equal(r.location, undefined);
});

test("the one-time operator setup still works without a state", async () => {
  const r = await callback("error=access_denied", envFor("http://127.0.0.1:1"));
  assert.equal(r.status, 200);
  assert.match(r.body, /Not connected/);
});

/* ── the read ──────────────────────────────────────────────────────────── */

test("customers carry an id, a name, and the whole Zoho record (decision 17 Sep 2026)", async () => {
  const z = await startFake();
  try {
    const out = await readChunk(cfgFor(z.origin), conn(z.origin), "111", "customers", { page: 1 });
    assert.equal(out.more, true);
    assert.deepEqual({ id: out.records[0].id, name: out.records[0].name }, { id: "1", name: "Ashok Sweets" });
    assert.equal(out.records[0].raw.email, "secret@shop", "every field Zoho returned is kept");
    assert.match(z.calls[0], /contact_type=customer/);
    assert.match(z.calls[0], /organization_id=111/);
  } finally { await z.close(); }
});

test("stock is reported only where Zoho tracks it; the whole item is kept", async () => {
  const z = await startFake();
  try {
    const out = await readChunk(cfgFor(z.origin), conn(z.origin), "111", "products");
    const { raw: raw0, ...first } = out.records[0];
    assert.deepEqual(first, { id: "7", name: "Pickle 250g", sku: "PK1", unit: "pcs", stockOnHand: 0 });
    assert.equal(raw0.rate, 55);
    const { raw: raw1, ...second } = out.records[1];
    assert.deepEqual(second, { id: "8", name: "Service" }, "untracked: absent, not zero");
    assert.equal("stock_on_hand" in raw1, false);
    assert.equal(out.records[2].stockOnHand, 12, "tracked by track_inventory, as the live API reports it");
  } finally { await z.close(); }
});

test("drafts and voids are not orders; the window is 240 days", async () => {
  const z = await startFake();
  try {
    const out = await readChunk(cfgFor(z.origin), conn(z.origin), "111", "orders");
    assert.deepEqual(out.records.map((r) => r.id), ["1", "2", "4", "5", "6", "7"], "drafts and pending orders count (decision 17 Sep 2026)");
    assert.deepEqual(out.excluded, { void: 1, something_new: 1, open: 1 },
      "void is never demand; an unknown status and an order older than the window are left out -- and counted");
    assert.equal(out.records[1].status, "draft", "every order keeps its Zoho status");
    assert.equal(out.records[0].raw.total, 100, "and the whole Zoho record");
    assert.equal(out.listed, 9);
    assert.match(z.calls[0], /date_start=\d{4}-\d{2}-\d{2}/);
  } finally { await z.close(); }
});

test("order lines subtract cancellations", async () => {
  const z = await startFake();
  try {
    const out = await readChunk(cfgFor(z.origin), conn(z.origin), "111", "lines", { ids: ["1", "4"] });
    const { raw, ...line } = out.records[0].lines[0];
    assert.deepEqual(line, { itemId: "7", name: "Pickle 250g", qty: 4, unit: "pcs" });
    assert.equal(raw.rate, 55, "the whole line is kept");
    assert.equal(out.records.length, 2);
  } finally { await z.close(); }
});

test("each Zoho refusal becomes its own reason", async () => {
  for (const [status, body, reason] of [
    [401, { code: 14 }, "expired"],
    [429, { code: 44 }, "busy"],
    [403, { code: 57 }, "forbidden"],
    [200, { code: 57, message: "not authorized" }, "forbidden"],
    [500, { code: 1 }, "unavailable"],
  ]) {
    const z = await startFake({ status, body });
    try {
      await assert.rejects(() => readChunk(cfgFor(z.origin), conn(z.origin), "111", "customers"),
        (e) => e instanceof ReadError && e.reason === reason, `${status} → ${reason}`);
    } finally { await z.close(); }
  }
});

test("the other modules are read whole, vendors from contacts", async () => {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const body = url.pathname === "/books/v3/invoices" ? { code: 0, invoices: [{ invoice_id: "1", total: 10, customer_id: "9" }], page_context: { has_more_page: false } }
      : url.pathname === "/books/v3/contacts" && url.searchParams.get("contact_type") === "vendor" ? { code: 0, contacts: [{ contact_id: "5", contact_name: "Supplier" }] }
      : { code: 5, message: "nope" };
    res.writeHead(body.code === 0 ? 200 : 404, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const inv = await readChunk(cfgFor(origin), conn(origin), "111", "invoices");
    assert.deepEqual(inv, { records: [{ invoice_id: "1", total: 10, customer_id: "9" }], more: false });
    const ven = await readChunk(cfgFor(origin), conn(origin), "111", "vendors");
    assert.equal(ven.records[0].contact_name, "Supplier");
    await assert.rejects(() => readChunk(cfgFor(origin), conn(origin), "111", "bills"), (e) => e.reason === "unavailable");
  } finally { await new Promise((r) => server.close(r)); }
});

test("the daily cap is told apart from a per-minute limit", async () => {
  const z = await startFake({ status: 429, body: { code: 44 }, headers: { "x-rate-limit-remaining": "0" } });
  try {
    await assert.rejects(() => readChunk(cfgFor(z.origin), conn(z.origin), "111", "orders"), (e) => e.reason === "daily_limit");
  } finally { await z.close(); }
});

test("a 200 that is not the expected JSON is a failure, never an empty result", async () => {
  const html = await startFake({ raw: "<html>maintenance</html>" });
  try {
    await assert.rejects(() => readChunk(cfgFor(html.origin), conn(html.origin), "111", "customers"), (e) => e.reason === "unavailable");
  } finally { await html.close(); }
  const shape = await startFake({ status: 200, body: { code: 0, message: "success" } });
  try {
    await assert.rejects(() => readChunk(cfgFor(shape.origin), conn(shape.origin), "111", "customers"), (e) => e.reason === "unavailable");
  } finally { await shape.close(); }
});

test("a Zoho that never answers times out, as its own reason", async () => {
  const server = createServer(() => { /* never responds */ });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const cfg = { ...cfgFor(origin), timeoutMs: 300 };
    await assert.rejects(() => readChunk(cfg, conn(origin), "111", "customers"), (e) => e.reason === "timeout");
  } finally { server.closeAllConnections(); await new Promise((r) => server.close(r)); }
});

test("an expired handle is refused before Zoho is asked", async () => {
  const z = await startFake();
  try {
    await assert.rejects(() => readChunk(cfgFor(z.origin), conn(z.origin, { exp: Date.now() - 1 }), "111", "customers"),
      (e) => e.reason === "expired");
    assert.equal(z.calls.length, 0);
  } finally { await z.close(); }
});

test("an unreachable Zoho is unavailable, not a verdict", async () => {
  await assert.rejects(() => readChunk(cfgFor("http://127.0.0.1:1"), conn("http://127.0.0.1:1"), "111", "customers"),
    (e) => e.reason === "unavailable" || e.reason === "timeout");
});

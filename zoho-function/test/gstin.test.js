/* GSTIN verification, end to end over real HTTP. Every state S01 can draw has
   a test here, because the whole point of this integration is that the screen
   never claims a verdict the provider did not give it. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { startFakeGst, ACTIVE_TAXPAYER, CANCELLED_TAXPAYER } from "./fake-gst.js";
import { lookupGstin, GstError, isWellFormed, isActive, normalise, _resetTokenCache } from "../gst.js";

const GOOD = "27ABCDE1234F1Z5";

function cfgFor(origin, over = {}) {
  return {
    apiKey: "key-abc",
    apiSecret: "secret-xyz",
    baseUrl: origin,
    apiVersion: "1.0",
    timeoutMs: 1200,
    ...over,
  };
}

/* ── the local gate · never counts as verification ─────────────────────── */

test("well-formed check accepts a real GSTIN grammar and rejects near misses", () => {
  assert.equal(isWellFormed(GOOD), true);
  assert.equal(isWellFormed("27abcde1234f1z5"), true, "case is normalised");
  assert.equal(isWellFormed("111111111111111"), false, "digits only");
  assert.equal(isWellFormed("27ABCDE1234F1Z"), false, "14 chars");
  assert.equal(isWellFormed("27ABCDE1234F1Y5"), false, "13th char must be Z");
  assert.equal(isWellFormed(""), false);
});

test("a malformed GSTIN fails locally and never reaches the provider", async () => {
  const gst = await startFakeGst();
  try {
    await assert.rejects(
      () => lookupGstin("111111111111111", { config: cfgFor(gst.origin) }),
      (e) => e instanceof GstError && e.reason === "invalid_gstin" && e.status === 400
    );
    assert.equal(gst.calls.authenticate, 0, "no credential spent on bad input");
    assert.equal(gst.calls.search, 0);
  } finally { await gst.close(); }
});

test("a missing credential is reported as not_configured, not as a verdict", async () => {
  const gst = await startFakeGst();
  try {
    await assert.rejects(
      () => lookupGstin(GOOD, { config: cfgFor(gst.origin, { apiKey: "", apiSecret: "" }) }),
      (e) => e instanceof GstError && e.reason === "not_configured"
    );
    assert.equal(gst.calls.search, 0);
  } finally { await gst.close(); }
});

/* ── found ─────────────────────────────────────────────────────────────── */

test("valid GSTIN, active business — returns identity the provider gave", async () => {
  _resetTokenCache();
  const gst = await startFakeGst({ searchBody: { data: ACTIVE_TAXPAYER } });
  try {
    const r = await lookupGstin(GOOD, { config: cfgFor(gst.origin) });
    assert.equal(r.found, true);
    assert.equal(r.gstin, GOOD);
    assert.equal(r.legalName, "MIHA FOODS PRIVATE LIMITED");
    assert.equal(r.tradeName, "Miha Foods");
    assert.equal(r.status, "Active");
    assert.equal(isActive(r.status), true);
    assert.equal(gst.calls.lastGstin, GOOD, "the provider was asked about this number");
    assert.equal(gst.calls.lastAuthHeader, "tok-123", "the token was carried");
    assert.equal(gst.calls.lastMethod, "POST", "search is a POST, not a GET");
    assert.match(gst.calls.lastContentType || "", /application\/json/);
  } finally { await gst.close(); }
});

test("inactive business is returned as found, with the real status", async () => {
  _resetTokenCache();
  const gst = await startFakeGst({ searchBody: { data: CANCELLED_TAXPAYER } });
  try {
    const r = await lookupGstin(GOOD, { config: cfgFor(gst.origin) });
    assert.equal(r.found, true);
    assert.equal(r.status, "Cancelled");
    assert.equal(isActive(r.status), false, "S01 must not present this as a clean pass");
    assert.equal(r.tradeName, undefined, "absent upstream stays absent here");
  } finally { await gst.close(); }
});

test("only fields the provider returned are carried through", () => {
  const r = normalise(GOOD, { lgnm: "ONLY LEGAL NAME" });
  assert.deepEqual(Object.keys(r).sort(), ["found", "gstin", "legalName"]);
  assert.equal("tradeName" in r, false);
  assert.equal("status" in r, false);
});

test("a nested provider envelope is read without special-casing each shape", async () => {
  _resetTokenCache();
  const gst = await startFakeGst({ searchBody: { code: 200, data: { data: ACTIVE_TAXPAYER } } });
  try {
    const r = await lookupGstin(GOOD, { config: cfgFor(gst.origin) });
    assert.equal(r.legalName, "MIHA FOODS PRIVATE LIMITED");
  } finally { await gst.close(); }
});

/* ── not found ─────────────────────────────────────────────────────────── */

test("404 from the provider means the register has no such number", async () => {
  _resetTokenCache();
  const gst = await startFakeGst({ searchStatus: 404 });
  try {
    const r = await lookupGstin(GOOD, { config: cfgFor(gst.origin) });
    assert.deepEqual(r, { found: false, gstin: GOOD });
  } finally { await gst.close(); }
});

test("FO8000 in a 200 is not found — their no-records answer is not a 404", async () => {
  _resetTokenCache();
  /* The shape the LIVE service actually returned: error_cd sits directly on
     `data`. Captured from a real call, not from the published sample. */
  const gst = await startFakeGst({ searchBody: {
    code: 200,
    data: { message: "No records found", error_cd: "FO8000" },
  } });
  try {
    const r = await lookupGstin(GOOD, { config: cfgFor(gst.origin) });
    assert.deepEqual(r, { found: false, gstin: GOOD });
  } finally { await gst.close(); }
});

test("FO8000 nested under data.error is also not found — the published shape", async () => {
  _resetTokenCache();
  const gst = await startFakeGst({ searchBody: {
    code: 200,
    data: { error: { error_cd: "FO8000", message: "No records found" }, status_cd: "0" },
  } });
  try {
    const r = await lookupGstin(GOOD, { config: cfgFor(gst.origin) });
    assert.deepEqual(r, { found: false, gstin: GOOD });
  } finally { await gst.close(); }
});

test("the real data.data nesting is read", async () => {
  _resetTokenCache();
  const gst = await startFakeGst({ searchBody: {
    code: 200,
    data: { data: ACTIVE_TAXPAYER, status_cd: "1" },
  } });
  try {
    const r = await lookupGstin(GOOD, { config: cfgFor(gst.origin) });
    assert.equal(r.legalName, "MIHA FOODS PRIVATE LIMITED");
    assert.equal(r.status, "Active");
  } finally { await gst.close(); }
});

test("200 with an empty record is also not found, not a broken success", async () => {
  _resetTokenCache();
  const gst = await startFakeGst({ searchBody: { data: {} } });
  try {
    const r = await lookupGstin(GOOD, { config: cfgFor(gst.origin) });
    assert.equal(r.found, false);
  } finally { await gst.close(); }
});

/* ── service failure · never a verdict about the number ────────────────── */

test("rejected credentials surface as upstream_auth", async () => {
  _resetTokenCache();
  const gst = await startFakeGst({ authStatus: 401 });
  try {
    await assert.rejects(
      () => lookupGstin(GOOD, { config: cfgFor(gst.origin) }),
      (e) => e instanceof GstError && e.reason === "upstream_auth"
    );
  } finally { await gst.close(); }
});

test("a moved auth endpoint is not reported as a bad credential", async () => {
  _resetTokenCache();
  /* Verified against the live provider: a bogus key gives 401, a wrong path
     gives 404. Collapsing both into upstream_auth would send someone hunting
     for a credential problem that is really a URL problem. */
  const gst = await startFakeGst({ authStatus: 404 });
  try {
    await assert.rejects(
      () => lookupGstin(GOOD, { config: cfgFor(gst.origin) }),
      (e) => e instanceof GstError && e.reason === "upstream_unavailable"
    );
  } finally { await gst.close(); }
});

test("a 500 from the provider is a failure to CHECK, not a failed GSTIN", async () => {
  _resetTokenCache();
  const gst = await startFakeGst({ searchStatus: 500 });
  try {
    await assert.rejects(
      () => lookupGstin(GOOD, { config: cfgFor(gst.origin) }),
      (e) => e instanceof GstError && e.reason === "upstream_unavailable"
    );
  } finally { await gst.close(); }
});

test("a provider that never answers times out rather than hanging the screen", async () => {
  _resetTokenCache();
  const gst = await startFakeGst({ hang: true });
  try {
    await assert.rejects(
      () => lookupGstin(GOOD, { config: cfgFor(gst.origin, { timeoutMs: 300 }) }),
      (e) => e instanceof GstError && e.reason === "timeout"
    );
  } finally { await gst.close(); }
});

test("an unreadable auth response is reported, not guessed at", async () => {
  _resetTokenCache();
  const gst = await startFakeGst({ authBody: { nothing: "useful" } });
  try {
    await assert.rejects(
      () => lookupGstin(GOOD, { config: cfgFor(gst.origin) }),
      (e) => e instanceof GstError && e.reason === "upstream_unreadable"
    );
  } finally { await gst.close(); }
});

/* ── token reuse · the user should not pay for two round trips ─────────── */

test("the access token is reused across lookups", async () => {
  _resetTokenCache();
  const gst = await startFakeGst({ searchBody: { data: ACTIVE_TAXPAYER } });
  try {
    const cfg = cfgFor(gst.origin);
    await lookupGstin(GOOD, { config: cfg });
    await lookupGstin(GOOD, { config: cfg });
    assert.equal(gst.calls.search, 2);
    assert.equal(gst.calls.authenticate, 1, "authenticated once for two lookups");
  } finally { await gst.close(); }
});

test("a 401 on search drops the cached token so the next call re-authenticates", async () => {
  _resetTokenCache();
  const gst = await startFakeGst({ searchStatus: 401 });
  try {
    const cfg = cfgFor(gst.origin);
    await assert.rejects(() => lookupGstin(GOOD, { config: cfg }));
    await assert.rejects(() => lookupGstin(GOOD, { config: cfg }));
    assert.equal(gst.calls.authenticate, 2, "token was not reused after rejection");
  } finally { await gst.close(); }
});

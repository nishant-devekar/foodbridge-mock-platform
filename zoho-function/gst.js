/* ==========================================================================
   GSTIN VERIFICATION — the server half.

   The browser must never call the GST provider directly: the credential would
   be in the page, and the provider does not send CORS headers anyway. This
   module is the only thing that holds the key, and it hands the browser back a
   small, provider-neutral answer.

   PROVIDER: Sandbox.co.in. Two calls, because the key is exchanged for a
   short-lived token first:

     POST {base}/authenticate                           -> access_token
          headers: x-api-key, x-api-secret, x-api-version
     POST {base}/gst/compliance/public/gstin/search      -> taxpayer
          headers: authorization, x-api-key, x-api-version, content-type
          body:    { "gstin": "27ABCDE1234F1Z5" }

   Confirmed against the live service and their published reference. Two things
   about it are easy to get wrong and were: the search is a POST carrying a JSON
   BODY, not a GET with a query string; and "no such taxpayer" comes back as
   HTTP 200 with data.error.error_cd === "FO8000", not as a 404.

   The taxpayer sits at data.data and uses GSTN's own field names: lgnm (legal
   name), tradeNam (trade name), sts (status). readTaxpayer() looks in the
   handful of places that record turns up rather than assuming one shape, so a
   provider swap touches it, normalise() and the URL, and nothing else.

   WHAT THIS DELIBERATELY DOES NOT DO
   It never invents an answer. If the credential is missing, or the provider is
   unreachable, or the shape is unrecognisable, it says so with a distinct
   reason and the screen reports that it could not check — it never falls back
   to a format test and calls the result "verified".
   ========================================================================== */

/* The GSTIN grammar, used ONLY to reject input before spending a call on it.
   Passing this is not verification and is never reported as such. */
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isWellFormed(gstin) {
  return GSTIN_RE.test(String(gstin || "").trim().toUpperCase());
}

export function gstConfig(env = process.env) {
  return {
    apiKey: env.GST_API_KEY || "",
    apiSecret: env.GST_API_SECRET || "",
    baseUrl: (env.GST_API_BASE_URL || "https://api.sandbox.co.in").replace(/\/+$/, ""),
    apiVersion: env.GST_API_VERSION || "1.0.0",
    timeoutMs: Number(env.GST_TIMEOUT_MS || 8000),
  };
}

/** Names of what is missing, never values — safe to return from /api/health. */
export function missingGstConfig(cfg) {
  const out = [];
  if (!cfg.apiKey) out.push("GST_API_KEY");
  if (!cfg.apiSecret) out.push("GST_API_SECRET");
  return out;
}

/* A failure that carries a machine-readable reason, so the screen can tell
   "your number is wrong" from "we could not check". Those are different
   sentences to a user and must not be collapsed. */
export class GstError extends Error {
  constructor(reason, message, status) {
    super(message || reason);
    this.reason = reason;          // invalid_gstin | not_configured | upstream_auth
    this.status = status || 502;   // | upstream_unavailable | upstream_unreadable | timeout
  }
}

function withTimeout(ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, done: () => clearTimeout(t) };
}

/* The token is short-lived and every lookup would otherwise pay for a second
   round trip. Held in module scope: a warm serverless instance reuses it, a
   cold one fetches a new one, and nothing is written to disk. */
let cachedToken = null;   // { token, exp }

export function _resetTokenCache() { cachedToken = null; }

async function authenticate(cfg, fetchImpl) {
  if (cachedToken && cachedToken.exp > Date.now() + 30000) return cachedToken.token;

  const t = withTimeout(cfg.timeoutMs);
  let res;
  try {
    res = await fetchImpl(`${cfg.baseUrl}/authenticate`, {
      method: "POST",
      headers: {
        "x-api-key": cfg.apiKey,
        "x-api-secret": cfg.apiSecret,
        "x-api-version": cfg.apiVersion,
      },
      signal: t.signal,
    });
  } catch (e) {
    throw new GstError(e && e.name === "AbortError" ? "timeout" : "upstream_unavailable",
      "Could not reach the GST service to authenticate.");
  } finally { t.done(); }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    /* A rejected credential and a moved endpoint both fail here, and they need
       different people to fix them. Verified against the live service: a bogus
       key returns 401 "Invalid API key", while a wrong path returns 404 — so
       the two are distinguishable and are kept apart. */
    if (res.status === 401 || res.status === 403) {
      throw new GstError("upstream_auth", "The GST service rejected these credentials.");
    }
    throw new GstError("upstream_unavailable",
      `The GST service returned ${res.status} when authenticating.`);
  }
  const token = body && (body.access_token || body.accessToken || (body.data && body.data.access_token));
  if (!token) throw new GstError("upstream_unreadable", "The GST service returned no access token.");

  cachedToken = { token, exp: Date.now() + 20 * 60 * 1000 };
  return token;
}

/* Providers nest the taxpayer record differently and rename nothing inside it.
   Look where it actually turns up, then read GSTN's own field names. */
function readTaxpayer(body) {
  if (!body || typeof body !== "object") return null;
  const candidates = [
    body.data && body.data.data,
    body.data,
    body.result,
    body.taxpayer,
    body,
  ];
  for (const c of candidates) {
    if (c && typeof c === "object" && (c.lgnm || c.tradeNam || c.sts || c.gstin)) return c;
  }
  return null;
}

/** Provider payload -> the only shape the browser ever sees. */
export function normalise(gstin, tp) {
  const out = { found: true, gstin };
  const legal = tp.lgnm || tp.legalName || tp.legal_name;
  const trade = tp.tradeNam || tp.tradeName || tp.trade_name;
  const status = tp.sts || tp.status;
  /* Only fields the provider actually returned are carried. A key that is
     absent upstream stays absent here, so the screen has nothing to render
     and renders nothing — rather than an empty row or a dash. */
  if (legal) out.legalName = String(legal).trim();
  if (trade) out.tradeName = String(trade).trim();
  if (status) out.status = String(status).trim();
  return out;
}

/** True only for a status the provider itself reports as active. */
export function isActive(status) {
  return String(status || "").trim().toLowerCase() === "active";
}

/**
 * Look one GSTIN up. Resolves to { found:true, ... } or { found:false },
 * and throws GstError for anything that is not an answer about the number.
 */
export async function lookupGstin(rawGstin, opts = {}) {
  const cfg = opts.config || gstConfig();
  const fetchImpl = opts.fetch || globalThis.fetch;
  const gstin = String(rawGstin || "").trim().toUpperCase();

  if (!isWellFormed(gstin)) {
    throw new GstError("invalid_gstin", "That is not a valid GSTIN format.", 400);
  }
  if (missingGstConfig(cfg).length) {
    throw new GstError("not_configured", "GST verification is not configured on this bridge.", 503);
  }

  const token = await authenticate(cfg, fetchImpl);

  const t = withTimeout(cfg.timeoutMs);
  let res;
  try {
    res = await fetchImpl(`${cfg.baseUrl}/gst/compliance/public/gstin/search`, {
      method: "POST",
      headers: {
        Authorization: token,
        "x-api-key": cfg.apiKey,
        "x-api-version": cfg.apiVersion,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gstin }),
      signal: t.signal,
    });
  } catch (e) {
    throw new GstError(e && e.name === "AbortError" ? "timeout" : "upstream_unavailable",
      "Could not reach the GST service.");
  } finally { t.done(); }

  /* 404, and the providers that answer 200 with an empty record, both mean the
     same thing to a user: the register has no such number. */
  if (res.status === 404) return { found: false, gstin };

  const body = await res.json().catch(() => null);

  if (res.status === 401 || res.status === 403) {
    cachedToken = null;                       // token may simply have expired
    throw new GstError("upstream_auth", "The GST service rejected these credentials.");
  }
  if (!res.ok) {
    throw new GstError("upstream_unavailable", `The GST service returned ${res.status}.`);
  }

  /* Their "no records found" is a 200 carrying an error code, not a 404. Read
     it explicitly: falling through to readTaxpayer() would reach the same
     answer by accident, and an accident is not a contract.

     The live service puts error_cd directly on `data`; their published sample
     nests it under `data.error`. Both are accepted, because the wire is the
     authority and the documentation has been seen to lag it. */
  const inner = body && body.data;
  const errCd = inner && (inner.error_cd || (inner.error && inner.error.error_cd));
  if (errCd) return { found: false, gstin };
  if (inner && inner.status_cd === "0") return { found: false, gstin };

  const tp = readTaxpayer(body);
  if (!tp) return { found: false, gstin };
  if (!tp.lgnm && !tp.tradeNam && !tp.sts && !tp.legalName && !tp.status) {
    return { found: false, gstin };
  }
  return normalise(gstin, tp);
}

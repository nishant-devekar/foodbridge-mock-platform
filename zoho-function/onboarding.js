/* ==========================================================================
   Onboarding S02 · "Connect an app" · Zoho Books, READ ONLY.

   A DIFFERENT flow from the rest of this bridge, and deliberately kept apart
   from it. zoho.js holds ONE operator's refresh token and writes sales orders
   into ONE organisation. This file lets ANY distributor sign in to THEIR OWN
   Zoho Books, and reads three things back so onboarding can show them their
   own business:

       customers · products · orders (last 240 days)

   Nothing is stored. There is no database, no refresh token and no session:

     · the sign-in asks Zoho for an ONLINE grant (no refresh token), so access
       ends on its own within the hour
     · the access token is SEALED (AES-256-GCM) and handed to the page, which
       sends it back on every read. The bridge cannot read it again without
       the page, and the page cannot read it at all
     · the page drives the read one chunk at a time, so every call fits in a
       serverless time limit and the user sees real progress and can stop

   The seal key is FB_SEAL_KEY when set, otherwise derived from
   ZOHO_CLIENT_SECRET -- a secret this bridge already holds and the page never
   sees -- so a new deployment needs no new variable.

   Customer-facing words live in the page, not here. Every failure leaves this
   file as a short reason code the page maps to its own sentence.
   ========================================================================== */

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config, originAllowed } from "./zoho.js";

/* Read scopes only -- as much of the business as Zoho Books will show, by the
   product owner's decision of 17 Sep 2026 ("excessive is good"). contacts
   covers customers AND vendors; Books files items under settings. No banking,
   no chart of accounts, no journals, and nothing that writes. */
export const ONBOARDING_SCOPES = [
  "ZohoBooks.contacts.READ",
  "ZohoBooks.settings.READ",
  "ZohoBooks.salesorders.READ",
  "ZohoBooks.invoices.READ",
  "ZohoBooks.customerpayments.READ",
  "ZohoBooks.creditnotes.READ",
  "ZohoBooks.estimates.READ",
  "ZohoBooks.purchaseorders.READ",
  "ZohoBooks.bills.READ",
  "ZohoBooks.expenses.READ",
].join(",");

/* The other modules, read as whole lists with every field Zoho returns. A
   module this account cannot see is recorded as unavailable and the read goes
   on; only customers, products and orders are required. */
export const EXTRA_MODULES = {
  invoices:         { path: "/invoices",         key: "invoices",         },
  customerpayments: { path: "/customerpayments", key: "customerpayments", },
  creditnotes:      { path: "/creditnotes",      key: "creditnotes",      },
  estimates:        { path: "/estimates",        key: "estimates",        },
  purchaseorders:   { path: "/purchaseorders",   key: "purchaseorders",   },
  bills:            { path: "/bills",            key: "bills",            },
  expenses:         { path: "/expenses",         key: "expenses",         },
  vendors:          { path: "/contacts",         key: "contacts",         query: { contact_type: "vendor" } },
};

/* 24 months, matching tools/import-order-history.py (MONTHS = 24) and what the
   engines keep. Every order in it costs one extra Zoho call for its lines. */
export const ORDER_WINDOW_DAYS = 730;
const STATE_TTL_MS = 15 * 60 * 1000;           // time allowed at Zoho's sign-in
const LINES_PER_CALL = 10;

/* Statuses counted as orders -- an allowlist, so a status nobody has seen yet
   is left out (and counted in the notes) rather than silently included.

   tools/import-order-history.py kept `confirmed`, `invoiced` and
   `partially_invoiced`; the API calls `confirmed` `open` (verified live 17 Sep
   2026). `closed` is a confirmed order that was fulfilled.

   DRAFTS COUNT, by the product owner's decision of 17 Sep 2026 -- and with them
   the orders still waiting on approval. This departs from the import tool,
   which dropped drafts; every order keeps its Zoho `status` so the rule can be
   reversed downstream. Void and rejected orders were cancelled and never
   count. */
export const DEMAND_STATUSES = new Set(["draft", "pending_approval", "approved", "open", "confirmed",
                                        "invoiced", "partially_invoiced", "closed"]);

/* One line per outcome, for whoever runs the bridge. Never a code, a token, a
   state, a secret or a customer record -- only what happened, where, and the
   error Zoho itself gave. */
export function note(event, fields = {}) {
  if (process.env.NODE_TEST_CONTEXT) return;
  const clean = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    clean[k] = typeof v === "string" ? v.replace(/Zoho-oauthtoken\s+\S+/gi, "[redacted]").slice(0, 200) : v;
  }
  process.stderr.write(JSON.stringify({ t: new Date().toISOString(), event: "onboarding." + event, ...clean }) + "\n");
}

export class ReadError extends Error {
  constructor(reason, status, detail) {
    super(reason);
    this.reason = reason;          // unreachable | expired | forbidden | busy | timeout | unavailable | bad_request | not_configured
    this.status = status || 502;
    this.detail = detail || null;
  }
}

/* ------------------------------------------------------------ secrets ---- */

function keyFor(cfg, env = process.env) {
  const base = env.FB_SEAL_KEY || cfg.clientSecret;
  if (!base) throw new ReadError("not_configured", 503);
  return createHash("sha256").update("fb-onboarding-seal|" + base).digest();
}

const b64u = (buf) => Buffer.from(buf).toString("base64url");

export function seal(cfg, payload, env) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyFor(cfg, env), iv);
  const body = Buffer.concat([c.update(JSON.stringify(payload), "utf8"), c.final()]);
  return b64u(Buffer.concat([iv, c.getAuthTag(), body]));
}

export function unseal(cfg, token, env) {
  try {
    const raw = Buffer.from(String(token || ""), "base64url");
    if (raw.length < 29) return null;
    const d = createDecipheriv("aes-256-gcm", keyFor(cfg, env), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    const out = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8"));
    return out && typeof out === "object" ? out : null;
  } catch (e) {
    if (e instanceof ReadError) throw e;
    return null;
  }
}

/* The OAuth `state`: which page to return to, and the page's own nonce, signed
   so neither can be swapped on the way through Zoho. */
export function signState(cfg, data, env) {
  const body = b64u(JSON.stringify({ ...data, exp: Date.now() + STATE_TTL_MS }));
  const mac = createHmac("sha256", keyFor(cfg, env)).update("state|" + body).digest("base64url");
  return "ob." + body + "." + mac;
}

export function verifyState(cfg, state, env) {
  const m = /^ob\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(state || ""));
  if (!m) return null;
  const want = createHmac("sha256", keyFor(cfg, env)).update("state|" + m[1]).digest();
  const got = Buffer.from(m[2], "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const data = JSON.parse(Buffer.from(m[1], "base64url").toString("utf8"));
    if (!data || data.exp < Date.now()) return null;
    return data;
  } catch { return null; }
}

export const isOnboardingState = (state) => /^ob\./.test(String(state || ""));

/* A return address is honoured only when its origin is one this bridge already
   serves. Anything else is an open redirect with a token attached. */
export function allowedReturn(cfg, url) {
  try {
    const u = new URL(url);
    return originAllowed(cfg, u.origin) ? u.toString() : null;
  } catch { return null; }
}

/* Appends the result to the page's own hash so the platform shell's route
   (#/onboarding) survives: #/onboarding?zoho=connected&… . A fragment is never
   sent to a server, so the sealed token stays out of every access log. */
export function returnWith(url, params) {
  const u = new URL(url);
  const q = new URLSearchParams(params).toString();
  const h = u.hash || "";
  const base = h.split("?")[0];
  u.hash = (base && base !== "#" ? base : "") + "?" + q;
  return u.toString();
}

/* Zoho runs regional data centres and says which one signed the user in. Only
   a real Zoho accounts host is believed. */
export function accountsServer(cfg, candidate) {
  if (candidate && /^https:\/\/accounts\.zoho\.(com|in|eu|com\.au|jp|com\.cn|sa|ca|uk)$/.test(candidate)) return candidate;
  return cfg.accountsUrl;
}

/* ----------------------------------------------------------- sign-in ---- */

export function authorizeUrl(cfg, stateToken) {
  const p = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: cfg.redirectUri,
    scope: ONBOARDING_SCOPES,
    access_type: "online",          // no refresh token: nothing to keep, nothing to leak
    prompt: "consent",
    state: stateToken,
  });
  return `${cfg.accountsUrl}/oauth/v2/auth?${p.toString()}`;
}

export async function exchange(cfg, code, accounts, fetchImpl = fetch) {
  let res;
  try {
    res = await fetchImpl(`${accounts}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: cfg.redirectUri,
        code,
      }),
      signal: AbortSignal.timeout(cfg.timeoutMs),
    });
  } catch {
    throw new ReadError("unreachable");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.error || !json.access_token) {
    note("exchange.failed", { accounts, http: res.status, zohoError: json && json.error });
    throw new ReadError("failed", 502, json && json.error);
  }
  note("exchange.ok", { accounts, apiDomain: json.api_domain || "(none: using configured base)", expiresIn: json.expires_in, scope: json.scope });
  const apiBase = json.api_domain
    ? String(json.api_domain).replace(/\/+$/, "") + "/books/v3"
    : cfg.apiBaseUrl;
  return {
    at: json.access_token,
    api: apiBase,
    exp: Date.now() + (Number(json.expires_in) || 3600) * 1000,
  };
}

/* ------------------------------------------------------------- reads ---- */

async function zget(cfg, conn, path, query = {}, fetchImpl = fetch, expect = null) {
  if (!conn || !conn.at || !conn.api) throw new ReadError("expired", 401);
  if (conn.exp && conn.exp < Date.now()) throw new ReadError("expired", 401);
  const url = new URL(conn.api + path);
  for (const [k, v] of Object.entries(query)) if (v != null && v !== "") url.searchParams.set(k, String(v));
  let res;
  try {
    res = await fetchImpl(url.toString(), {
      headers: { Authorization: `Zoho-oauthtoken ${conn.at}` },
      signal: AbortSignal.timeout(cfg.timeoutMs),
    });
  } catch (e) {
    const t = e && (e.name === "TimeoutError" || e.name === "AbortError");
    note("zoho.unreachable", { path, timedOut: !!t, error: e && e.message });
    throw new ReadError(t ? "timeout" : "unavailable", t ? 504 : 502);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || (typeof json.code === "number" && json.code !== 0)) {
    note("zoho.refused", { path, http: res.status, zohoCode: json && json.code, zohoMessage: json && json.message,
                            rateLimitRemaining: res.headers && res.headers.get && res.headers.get("x-rate-limit-remaining") });
  }
  if (res.status === 401) throw new ReadError("expired", 401);
  if (res.status === 429) {
    // Zoho caps calls per minute AND per day. The daily cap reports how many
    // are left; when none are, waiting minutes will not help and the page
    // must not say it will.
    const left = res.headers && res.headers.get && res.headers.get("x-rate-limit-remaining");
    throw new ReadError(left === "0" ? "daily_limit" : "busy", 429);
  }
  // Zoho answers "you may not see this" as 403, or as code 57 on a 401/200.
  if (res.status === 403 || (json && json.code === 57)) throw new ReadError("forbidden", 403);
  if (!res.ok || !json || (typeof json.code === "number" && json.code !== 0)) {
    throw new ReadError("unavailable", 502, json && json.message);
  }
  if (Array.isArray(expect) ? !expect.every((k) => json[k] !== undefined) : (expect && json[expect] === undefined)) {
    // A 200 that does not carry what was asked for is not an empty result.
    throw new ReadError("unavailable", 502, "unexpected response shape");
  }
  return json;
}

export async function organisations(cfg, conn, fetchImpl) {
  const j = await zget(cfg, conn, "/organizations", {}, fetchImpl, "organizations");
  const all = j.organizations || [];
  note("orgs.listed", { count: all.length, notSupported: all.filter((o) => o.isOrgNotSupported).length });
  return all.map((o) => ({ id: String(o.organization_id), name: String(o.name || "") }));
}

const more = (j) => !!(j.page_context && j.page_context.has_more_page);

function windowStart(now = Date.now()) {
  return new Date(now - ORDER_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
}

/**
 * One chunk of the read. Returns ONLY the fields onboarding uses: no emails,
 * phones, addresses, prices or tax -- what never leaves Zoho cannot leak.
 *
 *   customers  page → { records:[{id,name}], more }
 *   products   page → { records:[{id,name,sku?,unit?,stockOnHand?}], more }
 *   orders     page → { records:[{id,customerId,customerName,date}], more, from }
 *   lines      ids  → { records:[{id, lines:[{itemId,name,qty,unit?}] }] }
 */
export async function readChunk(cfg, conn, org, what, { page = 1, ids = [] } = {}, fetchImpl) {
  const base = { organization_id: org };
  if (what === "customers") {
    const j = await zget(cfg, conn, "/contacts", { ...base, contact_type: "customer", page, per_page: 200 }, fetchImpl, "contacts");
    return {
      records: (j.contacts || []).map((c) => ({ id: String(c.contact_id), name: String(c.contact_name || ""), raw: c })),
      more: more(j),
    };
  }
  if (what === "products") {
    const j = await zget(cfg, conn, "/items", { ...base, page, per_page: 200 }, fetchImpl, "items");
    return {
      records: (j.items || []).map((i) => {
        const r = { id: String(i.item_id), name: String(i.name || i.item_name || "") };
        if (i.sku) r.sku = String(i.sku);
        if (i.unit) r.unit = String(i.unit);
        // Stock only when Zoho actually tracks it for this item. A missing
        // figure stays missing; it is never reported as zero.
        // Verified live: an untracked item has `track_inventory:false` and no
        // `stock_on_hand` key at all.
        const tracked = i.track_inventory === true || i.item_type === "inventory";
        const stock = typeof i.stock_on_hand === "number" ? i.stock_on_hand
          : (typeof i.stock_on_hand === "string" && i.stock_on_hand.trim() !== "" && isFinite(Number(i.stock_on_hand)) ? Number(i.stock_on_hand) : null);
        if (tracked && stock !== null) r.stockOnHand = stock;
        r.raw = i;
        return r;
      }),
      more: more(j),
    };
  }
  if (what === "orders") {
    const from = windowStart();
    const j = await zget(cfg, conn, "/salesorders",
      { ...base, date_start: from, sort_column: "date", sort_order: "D", page, per_page: 200 }, fetchImpl, "salesorders");
    const all = j.salesorders || [];
    const kept = all.filter((s) => DEMAND_STATUSES.has(String(s.status || s.order_status || "").toLowerCase()))
                    .filter((s) => s.date && s.date >= from);
    const byStatus = {};
    all.forEach((s) => { if (!kept.includes(s)) { const k = String(s.status || s.order_status || "unknown").toLowerCase(); byStatus[k] = (byStatus[k] || 0) + 1; } });
    return {
      listed: all.length,
      excluded: byStatus,            // what was left out, and why -- counts only
      records: kept
        .map((s) => ({
          id: String(s.salesorder_id),
          customerId: String(s.customer_id || ""),
          customerName: String(s.customer_name || ""),
          date: String(s.date || ""),
          status: String(s.status || s.order_status || ""),
          raw: s,
        })),
      more: more(j),
      from,
    };
  }
  if (what === "lines") {
    const list = (Array.isArray(ids) ? ids : []).slice(0, LINES_PER_CALL).map(String);
    if (!list.length) throw new ReadError("bad_request", 400);
    const records = [];
    // Five at a time: fast enough for a chunk to finish inside a serverless
    // limit, slow enough to stay clear of Zoho's per-minute cap.
    for (let i = 0; i < list.length; i += 5) {
      const part = await Promise.all(list.slice(i, i + 5).map(async (id) => {
        const j = await zget(cfg, conn, `/salesorders/${encodeURIComponent(id)}`, base, fetchImpl, "salesorder");
        const so = j.salesorder || {};
        return {
          id,
          lines: (so.line_items || []).map((l) => ({
            itemId: String(l.item_id || ""),
            name: String(l.name || ""),
            qty: Number(l.quantity || 0) - Number(l.quantity_cancelled || 0),
            unit: l.unit ? String(l.unit) : undefined,
            raw: l,
          })),
          detail: Object.fromEntries(Object.entries(so).filter(([k]) => k !== "line_items")),
        };
      }));
      records.push(...part);
    }
    return { records };
  }
  const mod = EXTRA_MODULES[what];
  if (mod) {
    // No date filter: not every module accepts one, and a rejected parameter
    // would cost the whole module. Lists are cheap -- one call per 200 rows.
    const j = await zget(cfg, conn, mod.path, { ...base, ...(mod.query || {}), page, per_page: 200 }, fetchImpl, mod.key);
    return { records: j[mod.key] || [], more: more(j) };
  }
  throw new ReadError("bad_request", 400);
}

export { config };

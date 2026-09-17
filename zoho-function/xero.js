/* ==========================================================================
   Onboarding S02 · "Connect an app" · Xero, READ ONLY.

   The second provider on the same channel as onboarding.js (Zoho Books): a
   distributor signs in to THEIR OWN Xero, and the bridge reads it back in
   chunks the page asks for one at a time. Everything onboarding.js says about
   storing nothing holds here too -- the access token is sealed with the same
   key and handed to the page; the bridge keeps nothing between calls.

   What differs, and why:
     · Xero has NO sales orders. Demand is the ACCREC invoices (what was sold
       to whom, when, and the lines), read for the same 24-month window. Quotes
       are read as estimates, ACCPAY invoices as bills.
     · A sign-in can see several organisations ("tenants"); /connections lists
       them, like Zoho's /organizations.
     · Line items ride along with paged invoices, so there is no separate
       "lines" read; the page skips that step.
     · The access token lives 30 minutes and there is no refresh token
       (offline_access is not asked for) -- the read is chunked and fits.

   The shape every chunk returns is the one onboarding.js returns, so the
   page's dataset.js has one contract for both providers.
   ========================================================================== */

import { config as zohoConfig, ReadError, note, seal, unseal, signState, verifyState, returnWith, allowedReturn } from "./onboarding.js";

export function config(env = process.env) {
  const z = zohoConfig(env);
  return {
    ...z,                                            // allowedOrigins, timeoutMs, seal key source
    provider: "xero",
    clientId: env.XERO_CLIENT_ID || "",
    clientSecret: env.XERO_CLIENT_SECRET || "",
    redirectUri: env.XERO_REDIRECT_URI || "http://localhost:8787/api/xero/callback",
    identityUrl: (env.XERO_IDENTITY_URL || "https://identity.xero.com").replace(/\/+$/, ""),
    loginUrl: (env.XERO_LOGIN_URL || "https://login.xero.com").replace(/\/+$/, ""),
    apiUrl: (env.XERO_API_URL || "https://api.xero.com").replace(/\/+$/, ""),
    // The seal key is shared with the Zoho channel (FB_SEAL_KEY or the Zoho
    // client secret), so `sealCfg` is what seal/unseal are given.
    sealCfg: z,
  };
}

/* Read scopes only. contacts: customers and suppliers; settings: items and the
   organisation; transactions: invoices, payments, credit notes, quotes and
   purchase orders. No offline_access: nothing to keep, nothing to leak. */
export const XERO_SCOPES = ["accounting.contacts.read", "accounting.settings.read", "accounting.transactions.read"].join(" ");

export const ORDER_WINDOW_DAYS = 730;
const PAGE = 100;                                   // Xero's page size

/* Invoice statuses counted as demand. DRAFT counts, as Zoho's drafts do
   (product owner, 17 Sep 2026). VOIDED and DELETED were cancelled. */
export const DEMAND_STATUSES = new Set(["DRAFT", "SUBMITTED", "AUTHORISED", "PAID"]);

export const EXTRA_MODULES = {
  customerpayments: { path: "/Payments",       key: "Payments",       id: "PaymentID" },
  creditnotes:      { path: "/CreditNotes",    key: "CreditNotes",    id: "CreditNoteID" },
  estimates:        { path: "/Quotes",         key: "Quotes",         id: "QuoteID" },
  purchaseorders:   { path: "/PurchaseOrders", key: "PurchaseOrders", id: "PurchaseOrderID" },
  bills:            { path: "/Invoices",       key: "Invoices",       id: "InvoiceID", where: 'Type=="ACCPAY"' },
  vendors:          { path: "/Contacts",       key: "Contacts",       id: "ContactID", where: "IsSupplier==true" },
};

/* ----------------------------------------------------------- sign-in ---- */

export function authorizeUrl(cfg, stateToken) {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: XERO_SCOPES,
    state: stateToken,
  });
  return `${cfg.loginUrl}/identity/connect/authorize?${p.toString()}`;
}

export async function exchange(cfg, code, fetchImpl = fetch) {
  let res;
  try {
    res = await fetchImpl(`${cfg.identityUrl}/connect/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64"),
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: cfg.redirectUri }),
      signal: AbortSignal.timeout(cfg.timeoutMs),
    });
  } catch {
    throw new ReadError("unreachable");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.error || !json.access_token) {
    note("xero.exchange.failed", { http: res.status, xeroError: json && json.error });
    throw new ReadError("failed", 502, json && json.error);
  }
  note("xero.exchange.ok", { expiresIn: json.expires_in, scope: json.scope });
  return { p: "xero", at: json.access_token, exp: Date.now() + (Number(json.expires_in) || 1800) * 1000 };
}

/* The page hands back what it was given; only a Xero seal is honoured here. */
export function connection(cfg, handle) {
  const conn = unseal(cfg.sealCfg, handle);
  return conn && conn.p === "xero" ? conn : null;
}

/* ------------------------------------------------------------- reads ---- */

/* /connections sits at the API root; every accounting endpoint under
   /api.xro/2.0. */
const DATA = "/api.xro/2.0";

async function xget(cfg, conn, path, { tenant, query = {} } = {}, fetchImpl = fetch) {
  if (!conn || !conn.at) throw new ReadError("expired", 401);
  if (conn.exp && conn.exp < Date.now()) throw new ReadError("expired", 401);
  const url = new URL(cfg.apiUrl + (tenant ? DATA : "") + path);
  for (const [k, v] of Object.entries(query)) if (v != null && v !== "") url.searchParams.set(k, String(v));
  const headers = { Authorization: `Bearer ${conn.at}`, Accept: "application/json" };
  if (tenant) headers["xero-tenant-id"] = tenant;
  let res;
  try {
    res = await fetchImpl(url.toString(), { headers, signal: AbortSignal.timeout(cfg.timeoutMs) });
  } catch (e) {
    const t = e && (e.name === "TimeoutError" || e.name === "AbortError");
    note("xero.unreachable", { path, timedOut: !!t, error: e && e.message });
    throw new ReadError(t ? "timeout" : "unavailable", t ? 504 : 502);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    note("xero.refused", { path, http: res.status, detail: json && (json.Detail || json.Message || json.Title) });
  }
  if (res.status === 401) throw new ReadError("expired", 401);
  if (res.status === 403) throw new ReadError("forbidden", 403);
  // 60 calls a minute, 5,000 a day, per organisation. The daily one does not
  // clear within minutes and the page must not say it will.
  if (res.status === 429) {
    const problem = res.headers && res.headers.get && res.headers.get("x-rate-limit-problem");
    throw new ReadError(problem === "day" ? "daily_limit" : "busy", 429);
  }
  if (!res.ok || json == null) throw new ReadError("unavailable", 502, json && (json.Detail || json.Message));
  return json;
}

export async function organisations(cfg, conn, fetchImpl) {
  const j = await xget(cfg, conn, "/connections", {}, fetchImpl);
  if (!Array.isArray(j)) throw new ReadError("unavailable", 502, "unexpected response shape");
  const orgs = j.filter((t) => !t.tenantType || t.tenantType === "ORGANISATION")
               .map((t) => ({ id: String(t.tenantId), name: String(t.tenantName || "") }));
  note("xero.orgs.listed", { count: orgs.length });
  return orgs;
}

const dateOf = (r, key) => {
  const s = r[key + "String"] || r[key];
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(String(s))) return String(s).slice(0, 10);
  const m = /\/Date\((\d+)/.exec(String(s));         // "/Date(1754870400000+0000)/"
  return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : "";
};

function windowStart(now = Date.now()) {
  const d = new Date(now - ORDER_WINDOW_DAYS * 86400000);
  return { iso: d.toISOString().slice(0, 10), where: `DateTime(${d.getUTCFullYear()}, ${String(d.getUTCMonth() + 1).padStart(2, "0")}, ${String(d.getUTCDate()).padStart(2, "0")})` };
}

const lineOf = (l) => ({
  itemId: String(l.ItemCode || ""),
  name: String(l.Description || l.ItemCode || ""),
  qty: Number(l.Quantity || 0),
  raw: l,
});

/**
 * One chunk, in the page's shape (see onboarding.js readChunk):
 *   customers  page → { records:[{id,name,raw}], more }
 *   products   page → { records:[{id,name,sku?,stockOnHand?,raw}], more }   (one page: Xero returns all items)
 *   orders     page → { records:[{id,customerId,customerName,date,status,lines,raw}], more, from, listed, excluded }
 *   lines      ids  → { records:[{id,lines}] }  -- only for an invoice that came without them
 *   <module>   page → { records:[raw…], more }
 * Items are keyed by their Code, because that is all a line carries.
 */
export async function readChunk(cfg, conn, tenant, what, { page = 1, ids = [] } = {}, fetchImpl) {
  const opt = (query) => ({ tenant, query });
  if (what === "customers") {
    const j = await xget(cfg, conn, "/Contacts", opt({ where: "IsCustomer==true", page }), fetchImpl);
    const list = j.Contacts || [];
    return { records: list.map((c) => ({ id: String(c.ContactID), name: String(c.Name || ""), raw: c })), more: list.length >= PAGE };
  }
  if (what === "products") {
    const j = await xget(cfg, conn, "/Items", opt({}), fetchImpl);
    return {
      records: (j.Items || []).map((i) => {
        const r = { id: String(i.Code || i.ItemID), name: String(i.Name || i.Description || i.Code || "") };
        if (i.Code) r.sku = String(i.Code);
        if (i.IsTrackedAsInventory === true && typeof i.QuantityOnHand === "number") r.stockOnHand = i.QuantityOnHand;
        r.raw = i;
        return r;
      }),
      more: false,
    };
  }
  if (what === "orders") {
    const from = windowStart();
    const j = await xget(cfg, conn, "/Invoices", opt({
      where: `Type=="ACCREC" AND Date >= ${from.where}`, order: "Date DESC", page,
    }), fetchImpl);
    const all = j.Invoices || [];
    const kept = all.filter((s) => DEMAND_STATUSES.has(String(s.Status || "").toUpperCase()));
    const byStatus = {};
    all.forEach((s) => { if (!kept.includes(s)) { const k = String(s.Status || "unknown").toLowerCase(); byStatus[k] = (byStatus[k] || 0) + 1; } });
    return {
      listed: all.length,
      excluded: byStatus,
      records: kept.map((s) => ({
        id: String(s.InvoiceID),
        customerId: String((s.Contact && s.Contact.ContactID) || ""),
        customerName: String((s.Contact && s.Contact.Name) || ""),
        date: dateOf(s, "Date"),
        status: String(s.Status || ""),
        lines: Array.isArray(s.LineItems) ? s.LineItems.map(lineOf) : undefined,
        raw: s,
      })),
      more: all.length >= PAGE,
      from: from.iso,
    };
  }
  if (what === "lines") {
    const list = (Array.isArray(ids) ? ids : []).slice(0, 10).map(String);
    if (!list.length) throw new ReadError("bad_request", 400);
    const records = [];
    for (let i = 0; i < list.length; i += 5) {
      records.push(...await Promise.all(list.slice(i, i + 5).map(async (id) => {
        const j = await xget(cfg, conn, `/Invoices/${encodeURIComponent(id)}`, opt({}), fetchImpl);
        const inv = (j.Invoices || [])[0] || {};
        return { id, lines: (inv.LineItems || []).map(lineOf) };
      })));
    }
    return { records };
  }
  const mod = EXTRA_MODULES[what];
  if (mod) {
    const j = await xget(cfg, conn, mod.path, opt({ where: mod.where, page }), fetchImpl);
    const list = j[mod.key] || [];
    return { records: list, more: list.length >= PAGE };
  }
  throw new ReadError("bad_request", 400);
}

export { ReadError, note, seal, signState, verifyState, returnWith, allowedReturn };

/* ==========================================================================
   The Zoho Books bridge. One file, no dependencies, no framework.

   Real calls only. Nothing in here fabricates a sales order id, a sales order
   number or a status — every one of those comes back from Zoho or the request
   is reported as failed.

       confirmed FoodBridge order
              │
              ├─ map customer  (mappings.js)
              ├─ map products  (mappings.js)
              ├─ access token  (refresh_token grant, cached in memory)
              ├─ POST   /books/v3/salesorders
              └─ GET    /books/v3/salesorders/{id}   ← verify, don't trust
   ========================================================================== */

import { ZOHO_CUSTOMER_MAP, ZOHO_ITEM_MAP } from "./mappings.js";

/* ------------------------------------------------------------- config ---- */

// Zoho runs separate data centres and an India account does NOT answer on
// .com. Both URLs are configured rather than derived, so a customer in any
// region works without a code change.
export function config(env = process.env) {
  return {
    clientId: env.ZOHO_CLIENT_ID || "",
    clientSecret: env.ZOHO_CLIENT_SECRET || "",
    refreshToken: env.ZOHO_REFRESH_TOKEN || "",
    organizationId: env.ZOHO_ORGANIZATION_ID || "",
    accountsUrl: (env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.in").replace(/\/+$/, ""),
    apiBaseUrl: (env.ZOHO_API_BASE_URL || "https://www.zohoapis.in/books/v3").replace(/\/+$/, ""),
    redirectUri: env.ZOHO_REDIRECT_URI || "http://localhost:8787/api/callback",
    // Zoho's REST API does not return a web URL for a sales order and this
    // bridge will not guess one. Set it to your own tenant's pattern (copy a
    // sales-order URL out of your browser and swap the id for the placeholder)
    // and the success screen gets an "Open in Zoho" link; leave it blank and
    // it shows the number alone.
    salesOrderUrl: env.ZOHO_SALES_ORDER_URL || "",
    allowedOrigins: (env.ALLOWED_ORIGINS ||
      "http://localhost:8003,http://127.0.0.1:8003").split(",").map((s) => s.trim()).filter(Boolean),
    timeoutMs: Number(env.ZOHO_TIMEOUT_MS || 20000),
  };
}

// What the BRIDGE needs at runtime: raise a sales order and read it back.
export const RUNTIME_SCOPES = ["ZohoBooks.salesorders.CREATE", "ZohoBooks.salesorders.READ"];

// What the ONE-TIME setup additionally needs, so `npm run setup` can seed the
// demo customer and items over the API instead of making a human click through
// the Zoho Books UI. Read scopes are also what verify the mappings afterwards.
// Deliberately absent: invoices, payments, banking, expenses, accounting.
const SETUP_SCOPES = [
  "ZohoBooks.contacts.CREATE", "ZohoBooks.contacts.READ",
  "ZohoBooks.settings.CREATE", "ZohoBooks.settings.READ",  // Books files Items under settings
];

export const SCOPES = RUNTIME_SCOPES.concat(SETUP_SCOPES).join(",");

const REQUIRED = {
  clientId: "ZOHO_CLIENT_ID",
  clientSecret: "ZOHO_CLIENT_SECRET",
  refreshToken: "ZOHO_REFRESH_TOKEN",
  organizationId: "ZOHO_ORGANIZATION_ID",
};

/** Variable NAMES that are still unset — never values, so this is safe to
    return over HTTP and to log. */
export function missingConfig(cfg) {
  return Object.entries(REQUIRED).filter(([k]) => !cfg[k]).map(([, name]) => name);
}

/* -------------------------------------------------------------- errors ---- */

export class ZohoError extends Error {
  constructor(category, message, detail) {
    super(message);
    this.name = "ZohoError";
    this.category = category;   // what the UI branches on
    this.detail = detail || null;
    this.status = {
      not_configured: 503, auth_failed: 502, customer_not_mapped: 422,
      product_not_mapped: 422, zoho_rejected: 422, verification_failed: 422,
      bad_request: 400, timeout: 504, reference_conflict: 409,
    }[category] || 502;
  }
  toJSON() { return { category: this.category, message: this.message, detail: this.detail }; }
}

// Zoho's own error text is useful but untrusted: truncated, and anything that
// looks like a token is stripped before it can reach a browser or a log.
const safe = (v, max = 240) => {
  if (v == null) return null;
  const s = String(typeof v === "string" ? v : JSON.stringify(v))
    .replace(/Zoho-oauthtoken\s+\S+/gi, "[redacted]");
  return s.length > max ? s.slice(0, max) + "…" : s;
};

/* --------------------------------------------------------------- oauth ---- */

// The distributor authorises once; the refresh token then mints short-lived
// access tokens forever. Cached in module scope so a warm function instance
// reuses one rather than refreshing per order. Never logged, never returned.
//
// Keyed on the credential it was minted from, not stored loose: rotate the
// refresh token or repoint the region and the old access token is no longer a
// cache hit. A global `cachedToken` would happily keep serving a token minted
// against the previous account.
const tokenCache = new Map(); // key -> { value, expiresAt }
const tokenKey = (cfg) => `${cfg.accountsUrl}|${cfg.refreshToken}`;

/** Drop cached tokens. Used after a 401, and by the tests. */
export const resetTokenCache = () => tokenCache.clear();

export async function getAccessToken(cfg, fetchImpl = fetch) {
  const key = tokenKey(cfg);
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.value;

  const body = new URLSearchParams({
    refresh_token: cfg.refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
  });

  let res;
  try {
    res = await fetchImpl(`${cfg.accountsUrl}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(cfg.timeoutMs),
    });
  } catch (e) {
    throw new ZohoError("auth_failed", "Zoho authentication failed.", safe(e.message));
  }

  const json = await res.json().catch(() => null);
  // A bad refresh token comes back as HTTP 200 with an `error` key, so status
  // alone does not tell success from failure here.
  if (!res.ok || !json || json.error || !json.access_token) {
    throw new ZohoError("auth_failed", "Zoho authentication failed.", safe(json?.error || `HTTP ${res.status}`));
  }
  const token = { value: json.access_token, expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000 };
  tokenCache.set(key, token);
  return token.value;
}

/** Trade the one-time authorization code for a refresh token. */
export async function exchangeCode(cfg, code, fetchImpl = fetch) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    code,
  });
  const res = await fetchImpl(`${cfg.accountsUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.error || !json.refresh_token) {
    throw new ZohoError("auth_failed", "Could not exchange the authorization code.", safe(json?.error || `HTTP ${res.status}`));
  }
  return json;
}

/* ----------------------------------------------------------- http calls --- */

async function call(cfg, method, path, { query = {}, body } = {}, fetchImpl = fetch) {
  const token = await getAccessToken(cfg, fetchImpl);
  const url = new URL(cfg.apiBaseUrl + path);
  url.searchParams.set("organization_id", cfg.organizationId);
  for (const [k, v] of Object.entries(query)) if (v != null && v !== "") url.searchParams.set(k, String(v));

  let res;
  try {
    res = await fetchImpl(url.toString(), {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(cfg.timeoutMs),
    });
  } catch (e) {
    const timedOut = e.name === "TimeoutError" || e.name === "AbortError";
    // A timeout is NOT a failure. Zoho may have created the order and lost only
    // the reply, so this is raised as its own category and the caller verifies
    // by reference instead of posting again.
    throw new ZohoError(timedOut ? "timeout" : "zoho_unavailable",
      timedOut ? "Zoho did not respond in time." : "Zoho unavailable.", safe(e.message));
  }

  const json = await res.json().catch(() => null);
  if (res.status === 401) {
    tokenCache.delete(tokenKey(cfg));
    throw new ZohoError("auth_failed", "Zoho authentication failed.", safe(json?.message));
  }
  // Zoho answers success with code 0 in the envelope; a non-zero code is a
  // rejection even when the HTTP status is 200.
  if (!res.ok || (json && typeof json.code === "number" && json.code !== 0)) {
    throw new ZohoError("zoho_rejected", "Zoho rejected the order.", safe(json?.message || `HTTP ${res.status}`));
  }
  if (!json) throw new ZohoError("zoho_unavailable", "Zoho returned an unreadable response.");
  return json;
}

/**
 * The organisations this grant can see. Called BEFORE ZOHO_ORGANIZATION_ID is
 * known, so it is the one request that must not send it -- which is why it
 * bypasses `call()` rather than passing a blank.
 */
export async function listOrganizations(cfg, fetchImpl = fetch) {
  const token = await getAccessToken(cfg, fetchImpl);
  const res = await fetchImpl(`${cfg.apiBaseUrl}/organizations`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
    signal: AbortSignal.timeout(cfg.timeoutMs),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || (typeof json.code === "number" && json.code !== 0)) {
    throw new ZohoError("zoho_rejected", "Could not list Zoho organisations.", safe(json?.message || `HTTP ${res.status}`));
  }
  return json.organizations || [];
}

/* ---- one-time setup helpers: seed the demo customer and items ------------ */

export const listContacts = (cfg, query = {}, f = fetch) =>
  call(cfg, "GET", "/contacts", { query }, f).then((j) => j.contacts || []);

export const createContact = (cfg, body, f = fetch) =>
  call(cfg, "POST", "/contacts", { body }, f).then((j) => j.contact || null);

export const listItems = (cfg, query = {}, f = fetch) =>
  call(cfg, "GET", "/items", { query }, f).then((j) => j.items || []);

export const createItem = (cfg, body, f = fetch) =>
  call(cfg, "POST", "/items", { body }, f).then((j) => j.item || null);

/**
 * Every page of a list endpoint, not just the first.
 * Zoho caps per_page at 200 and reports more with page_context.has_more_page;
 * stopping at page one would silently look like "this item does not exist"
 * and create a duplicate.
 */
export async function listAll(cfg, path, key, query = {}, f = fetch) {
  const out = [];
  for (let page = 1; page <= 50; page++) {
    const json = await call(cfg, "GET", path, { query: { ...query, page, per_page: 200 } }, f);
    out.push(...(json[key] || []));
    if (!json.page_context || !json.page_context.has_more_page) break;
  }
  return out;
}

export const listSalesOrders = (cfg, query = {}, f = fetch) =>
  call(cfg, "GET", "/salesorders", { query }, f).then((j) => j.salesorders || []);

export const createSalesOrder = (cfg, payload, f = fetch) =>
  call(cfg, "POST", "/salesorders", { body: payload }, f).then((j) => j.salesorder || null);

export const getSalesOrder = (cfg, id, f = fetch) =>
  call(cfg, "GET", `/salesorders/${encodeURIComponent(id)}`, {}, f).then((j) => j.salesorder || null);

/**
 * The sales order carrying this FoodBridge reference, or null.
 * The filter is re-checked locally: if a Zoho build ignores the parameter it
 * returns an unfiltered page, and taking [0] from that would attach a
 * FoodBridge order to a stranger's sales order.
 */
export async function findByReference(cfg, reference, f = fetch) {
  const json = await call(cfg, "GET", "/salesorders", { query: { reference_number: reference } }, f);
  const rows = (json.salesorders || []).filter((so) => String(so.reference_number || "") === String(reference));
  return rows[0] || null;
}

/* -------------------------------------------------------------- mapping --- */

/**
 * Build the Zoho Books payload from the CONFIRMED FoodBridge order.
 *
 * The salesperson's final quantity is what ships. Whatever the prediction
 * recommended is irrelevant by this point and is not read here at all — only
 * `line.qty`, which is what the footer confirmation showed them.
 *
 * `rate` is deliberately ABSENT. FoodBridge holds no price for any product
 * (the catalogue carries name, SKU, category and unit, nothing more), so
 * omitting it lets Zoho apply the item's own configured selling price — the
 * correct number. Inventing one would create a financially wrong order that
 * looks right.
 */
export function buildSalesOrderPayload(order) {
  const zohoCustomerId = ZOHO_CUSTOMER_MAP[order.customerId];
  if (!zohoCustomerId) {
    throw new ZohoError("customer_not_mapped",
      "Customer not mapped to Zoho.",
      `Add "${order.customerId}" (${order.customerName || "?"}) to ZOHO_CUSTOMER_MAP in mappings.js.`);
  }

  const lines = Array.isArray(order.lines) ? order.lines : [];
  if (!lines.length) throw new ZohoError("bad_request", "The order has no line items.");

  const lineMap = [];
  const line_items = lines.map((line) => {
    const mapped = ZOHO_ITEM_MAP[line.productId];
    if (!mapped || !mapped.itemId) {
      throw new ZohoError("product_not_mapped",
        "Product not mapped to Zoho.",
        `Add "${line.productId}" (${line.productName || "?"}, SKU ${line.artNo || "none"}) to ZOHO_ITEM_MAP in mappings.js.`);
    }
    const qty = Number(line.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new ZohoError("bad_request", `${line.productName || line.productId} has no usable quantity.`);
    }
    const factor = Number(mapped.factor) > 0 ? Number(mapped.factor) : 1;
    const quantity = qty * factor;

    lineMap.push({
      productId: line.productId,
      zohoItemId: String(mapped.itemId),
      foodbridgeQty: qty,
      foodbridgeUnit: line.unit || null,
      zohoQty: quantity,
      factor,
    });

    const item = { item_id: String(mapped.itemId), quantity };
    // Only sent when the mapping states it; an empty string is a value to Zoho.
    if (mapped.unit) item.unit = mapped.unit;
    return item;
  });

  const payload = {
    customer_id: String(zohoCustomerId),
    // The cross-system key. This is what makes a FoodBridge order findable in
    // Zoho — both by a human scanning the list and by the duplicate check below.
    reference_number: order.id,
    date: String(order.createdAt || new Date().toISOString()).slice(0, 10),
    line_items,
    notes: `Raised from FoodBridge ${order.id}`,
  };
  return { payload, lineMap, zohoCustomerId: String(zohoCustomerId) };
}

/* --------------------------------------------------------- verification --- */

/**
 * Does the Zoho sales order actually say what FoodBridge sent?
 * "The POST returned 200" and "the order is right" are different claims, and
 * only the second one is worth telling a salesperson about.
 */
export function verify(order, salesorder, lineMap, zohoCustomerId) {
  const checks = [];
  const add = (name, ok, expected, actual) => checks.push({ name, ok: !!ok, expected, actual });

  add("reference", String(salesorder.reference_number || "") === String(order.id),
    order.id, salesorder.reference_number || null);
  add("customer", String(salesorder.customer_id || "") === String(zohoCustomerId),
    zohoCustomerId, salesorder.customer_id ? String(salesorder.customer_id) : null);

  const zohoLines = Array.isArray(salesorder.line_items) ? salesorder.line_items : [];
  add("lineCount", zohoLines.length === lineMap.length, lineMap.length, zohoLines.length);

  for (const m of lineMap) {
    const match = zohoLines.find((l) => String(l.item_id) === String(m.zohoItemId));
    add(`item:${m.productId}`, !!match, m.zohoItemId, match ? String(match.item_id) : null);
    if (match) {
      add(`qty:${m.productId}`, Number(match.quantity) === Number(m.zohoQty), m.zohoQty, Number(match.quantity));
    }
  }
  return { ok: checks.every((c) => c.ok), checks };
}

export const salesOrderUrl = (cfg, id) =>
  cfg.salesOrderUrl && id ? cfg.salesOrderUrl.replace("{salesorder_id}", encodeURIComponent(String(id))) : null;

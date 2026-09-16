/* ==========================================================================
   TEST PATH ONLY — a stand-in for Zoho's accounts server AND the Books API,
   for driving the REAL onboarding page and the REAL bridge end to end.

   Nothing in the product can reach this. It exists so every case in the S02
   test matrix can be walked in a browser with the production code unmodified:
   the page uses RealZohoOAuth + RealZohoReader, the bridge is dev-server.js
   started with its Zoho URLs pointed here (test/e2e/run.sh). Only the far end
   of the socket is replaced.

     node test/e2e/fake-zoho-server.js          # :8790
     GET /__scenario?name=<one|many|none|zero|timeout|ratelimit|daily|upstream|expired|malformed|badcode>
     GET /__expect                              # counts the data below SHOULD normalise to

   The data is deterministic, dated relative to today, and deliberately awkward:
   three pages of customers, two of items, tracked stock at zero and non-zero
   beside untracked items, every sales-order status, orders outside the window,
   same-day orders, cancelled quantities, weight-sold lines, a line for an item
   the item list does not have, and a line with neither item nor name.
   ========================================================================== */

import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_ZOHO_PORT || 8790);
const ORIGIN = `http://localhost:${PORT}`;
const TOKEN = "fake-access-token";
let scenario = "one";
let calls = 0;

const DAY = 86400000;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);

/* ── the business ──────────────────────────────────────────────────────── */

const customers = Array.from({ length: 450 }, (_, i) => ({ contact_id: String(900000 + i), contact_name: `Shop ${i + 1}`, contact_type: "customer", status: "active", email: `shop${i}@example.com` }));
const items = Array.from({ length: 250 }, (_, i) => {
  const it = { item_id: String(700000 + i), name: `Product ${i + 1}`, sku: `SKU-${i + 1}`, unit: i % 10 === 9 ? "kg" : "pcs", status: "active", rate: 50 };
  if (i < 100) Object.assign(it, { track_inventory: true, item_type: "inventory", stock_on_hand: i % 4 === 0 ? 0 : i });   // tracked: 25 at zero, 75 non-zero
  else Object.assign(it, { track_inventory: false, item_type: "sales" });                                                   // untracked: no stock key at all
  return it;
});

// 40 customers ordering on a cycle over the last 200 days. Every 10th order is
// a non-demand status; customer 0 places two orders on each of its days.
const STATUSES = ["open", "invoiced", "partially_invoiced", "closed", "open", "invoiced", "open", "invoiced", "open"];
const salesorders = [];
const lines = {};
let soid = 500000;
for (let c = 0; c < 40; c++) {
  const cycle = 14 + (c % 5) * 7;
  for (let ago = 3 + c; ago < 200; ago += cycle) {
    const copies = c === 0 ? 2 : 1;
    for (let k = 0; k < copies; k++) {
      const id = String(soid++);
      const n = salesorders.length;
      const status = n % 10 === 5 ? ["draft", "void", "pending_approval", "rejected"][(n / 10 | 0) % 4] : STATUSES[n % STATUSES.length];
      salesorders.push({ salesorder_id: id, customer_id: customers[c].contact_id, customer_name: customers[c].contact_name, date: iso(ago), status, order_status: status, total: 1000 });
      const ls = [];
      for (let p = 0; p < 3; p++) {
        const item = items[(c * 3 + p) % 250];
        ls.push({ item_id: item.item_id, name: item.name, quantity: 6, quantity_cancelled: p === 1 ? 2 : 0, unit: item.unit });
      }
      if (c === 1) ls.push({ item_id: "799999", name: "Discontinued item", quantity: 4, quantity_cancelled: 0, unit: "pcs" });
      if (c === 2) ls.push({ item_id: "", name: "", quantity: 1, quantity_cancelled: 0 });
      lines[id] = ls;
    }
  }
}
// Old orders the 240-day window must leave out.
for (let c = 0; c < 5; c++) {
  const id = String(soid++);
  salesorders.push({ salesorder_id: id, customer_id: customers[c].contact_id, customer_name: customers[c].contact_name, date: iso(300 + c), status: "invoiced", order_status: "invoiced" });
  lines[id] = [{ item_id: items[0].item_id, name: items[0].name, quantity: 1, unit: "pcs" }];
}
salesorders.sort((a, b) => (a.date < b.date ? 1 : -1));

/* The other modules. Bills answer 403, as a module a login may not see. */
const modules = {
  invoices: Array.from({ length: 230 }, (_, i) => ({ invoice_id: String(800000 + i), invoice_number: `INV-${i + 1}`, customer_id: customers[i % 40].contact_id, date: iso(i), due_date: iso(i - 15), total: 1000 + i, balance: i % 3 ? 0 : 500, status: i % 3 ? "paid" : "overdue" })),
  customerpayments: Array.from({ length: 150 }, (_, i) => ({ payment_id: String(810000 + i), customer_id: customers[i % 40].contact_id, date: iso(i), amount: 1000 + i, payment_mode: "cash" })),
  creditnotes: [{ creditnote_id: "820000", customer_id: customers[0].contact_id, date: iso(5), total: 100, balance: 0, status: "closed" }],
  estimates: Array.from({ length: 12 }, (_, i) => ({ estimate_id: String(830000 + i), customer_id: customers[i].contact_id, date: iso(i), total: 900, status: "sent" })),
  purchaseorders: Array.from({ length: 7 }, (_, i) => ({ purchaseorder_id: String(840000 + i), vendor_id: "850000", date: iso(i * 9), total: 50000, status: "billed" })),
  expenses: Array.from({ length: 3 }, (_, i) => ({ expense_id: String(860000 + i), date: iso(i), total: 250, account_name: "Fuel", status: "unbilled" })),
  vendors: [{ contact_id: "850000", contact_name: "Pickle Supplier LLP", contact_type: "vendor" }],
};

/* ── what it should come to ────────────────────────────────────────────── */

function expected() {
  const from = iso(730);
  const demand = new Set(["draft", "pending_approval", "approved", "open", "confirmed", "invoiced", "partially_invoiced", "closed"]);
  const kept = salesorders.filter((s) => demand.has(s.status) && s.date >= from);
  const days = new Set(kept.map((s) => s.customer_id + "|" + s.date));
  return {
    organisations: scenario === "many" ? 2 : scenario === "none" ? 0 : 1,
    customers: customers.length,
    products: items.length + 1,                 // + the discontinued item, named on its lines
    productsWithStock: 100, productsStockZero: 25,
    ordersListedInWindow: salesorders.filter((s) => s.date >= from).length,
    qualifyingSalesOrders: scenario === "zero" ? 0 : kept.length,
    ordersAfterSameDayMerge: scenario === "zero" ? 0 : days.size,
    customersWithOrders: scenario === "zero" ? 0 : new Set(kept.map((s) => s.customer_id)).size,
    invoices: modules.invoices.length, payments: modules.customerpayments.length, vendors: modules.vendors.length,
    estimates: modules.estimates.length, creditNotes: modules.creditnotes.length, purchaseOrders: modules.purchaseorders.length,
    bills: "unavailable (forbidden)", expenses: modules.expenses.length,
  };
}

/* ── HTTP ──────────────────────────────────────────────────────────────── */

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
};
const page = (list, url, key, size = 200) => {
  const p = Number(url.searchParams.get("page") || 1);
  const per = Math.min(size, Number(url.searchParams.get("per_page") || 200));
  const slice = list.slice((p - 1) * per, p * per);
  return { code: 0, message: "success", [key]: slice, page_context: { page: p, per_page: per, has_more_page: p * per < list.length } };
};

createServer((req, res) => {
  const url = new URL(req.url, ORIGIN);

  if (url.pathname === "/__scenario") { scenario = url.searchParams.get("name") || "one"; calls = 0; return send(res, 200, { scenario }); }
  if (url.pathname === "/__expect") return send(res, 200, expected());

  /* accounts */
  if (url.pathname === "/oauth/v2/auth") {
    const redirect = url.searchParams.get("redirect_uri");
    const state = url.searchParams.get("state");
    const go = (q) => `${redirect}?${new URLSearchParams({ ...q, state }).toString()}`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Fake Zoho (test)</title><body style="font:16px system-ui;padding:40px 20px;max-width:380px;margin:auto">
      <p style="background:#7c3aed;color:#fff;display:inline-block;padding:4px 8px;border-radius:6px;font:600 12px monospace">TEST · NOT ZOHO</p>
      <h1>Fake Zoho consent</h1><p>Scenario <b>${scenario}</b>. Scopes asked: <code>${url.searchParams.get("scope")}</code>
      · access_type <code>${url.searchParams.get("access_type")}</code></p>
      <p><a id="accept" href="${go({ code: "fake-code-" + scenario })}">Accept</a></p>
      <p><a id="reject" href="${go({ error: "access_denied" })}">Reject</a></p></body>`);
  }
  if (url.pathname === "/oauth/v2/token" && req.method === "POST") {
    if (scenario === "badcode") return send(res, 200, { error: "invalid_code" });
    return send(res, 200, { access_token: TOKEN, api_domain: ORIGIN, token_type: "Bearer", expires_in: 3600 });
  }

  /* books */
  if (!url.pathname.startsWith("/books/v3/")) return send(res, 404, { code: 5, message: "Invalid URL" });
  if (req.headers.authorization !== `Zoho-oauthtoken ${TOKEN}`) return send(res, 401, { code: 57, message: "You are not authorized to perform this operation" });
  calls++;
  const path = url.pathname.slice("/books/v3".length);

  if (path === "/organizations") {
    const orgs = [{ organization_id: "60001", name: "Test Distributors Pvt Ltd" }, { organization_id: "60002", name: "Test Distributors — Pune" }];
    return send(res, 200, { code: 0, organizations: scenario === "none" ? [] : scenario === "many" ? orgs : orgs.slice(0, 1) });
  }
  if (path === "/contacts") return send(res, 200, page(url.searchParams.get("contact_type") === "vendor" ? modules.vendors : customers, url, "contacts"));
  if (path === "/bills") return send(res, 403, { code: 57, message: "You are not authorized to perform this operation" });
  for (const name of ["invoices", "customerpayments", "creditnotes", "estimates", "purchaseorders", "expenses"]) {
    if (path === "/" + name) return send(res, 200, page(modules[name], url, name));
  }
  if (path === "/items") {
    if (scenario === "malformed") { res.writeHead(200, { "Content-Type": "text/html" }); return res.end("<html>Service temporarily unavailable</html>"); }
    if (scenario === "ratelimit") return send(res, 429, { code: 44, message: "Too many requests" }, { "x-rate-limit-remaining": "40" });
    if (scenario === "daily") return send(res, 429, { code: 45, message: "Daily limit exceeded" }, { "x-rate-limit-remaining": "0" });
    return send(res, 200, page(items, url, "items"));
  }
  if (path === "/salesorders") {
    if (scenario === "upstream") return send(res, 500, { code: 1, message: "Internal error" });
    const from = url.searchParams.get("date_start") || "0000";
    const list = scenario === "zero" ? [] : salesorders.filter((s) => s.date >= from);
    return send(res, 200, page(list, url, "salesorders"));
  }
  const m = /^\/salesorders\/(\d+)$/.exec(path);
  if (m) {
    if (scenario === "timeout") return;                                           // never answers
    if (scenario === "expired" && calls > 12) return send(res, 401, { code: 14, message: "Invalid OAuth token" });
    if (!lines[m[1]]) return send(res, 404, { code: 1002, message: "Sales order does not exist" });
    return send(res, 200, { code: 0, salesorder: { salesorder_id: m[1], line_items: lines[m[1]] } });
  }
  return send(res, 404, { code: 5, message: "Invalid URL" });
}).listen(PORT, () => process.stdout.write(`fake Zoho (TEST ONLY) on ${ORIGIN}\n`));

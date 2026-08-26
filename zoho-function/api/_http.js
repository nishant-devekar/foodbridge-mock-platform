/* Shared request plumbing. Vercel-style (req, res) handlers, which is also
   what the local dev-server speaks, so the same files run in both places. */

import { config } from "../zoho.js";

export function cors(req, res) {
  const origin = req.headers.origin || "";
  const cfg = config();
  // Exact allowlist, never "*": this endpoint drives a credentialed
  // integration, so any page must not be able to fire it from a browser.
  if (origin && cfg.allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-FB-Key");
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return true; }
  return false;
}

export function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body);
}

/**
 * A shared key, and an honest note about what it is worth.
 *
 * Once this function is deployed, its URL creates REAL sales orders in a real
 * Zoho organisation, and CORS does not stop a curl. This check turns a URL
 * anyone can POST to into one that needs a key as well.
 *
 * It is not authentication. The static FoodBridge page has to carry the key to
 * use it, so anyone who reads the page source has it too. What it buys is the
 * difference between "a scanner finds the endpoint and starts posting" and
 * "someone deliberately reads your JavaScript" -- worth having for a PMF demo,
 * not worth mistaking for security.
 *
 * Unset FB_API_KEY and the check is skipped, so local runs are unchanged.
 */
export function keyOk(req) {
  const expected = process.env.FB_API_KEY || "";
  if (!expected) return true;
  const got = req.headers["x-fb-key"] || "";
  return typeof got === "string" && got.length === expected.length && got === expected;
}

/** Vercel parses JSON bodies for you; the dev-server does not. Handle both. */
export function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { resolve(null); }
    });
    req.on("error", () => resolve(null));
  });
}

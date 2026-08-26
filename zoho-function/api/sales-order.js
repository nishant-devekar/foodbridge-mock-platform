/* POST /api/sales-order — the only endpoint FoodBridge calls.
   Takes a confirmed FoodBridge order, returns the real Zoho identifiers. */

import { config, ZohoError } from "../zoho.js";
import { syncOrder } from "../sync.js";
import { cors, json, readBody, keyOk } from "./_http.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { category: "bad_request", message: "POST only." });
  if (!keyOk(req)) return json(res, 401, { category: "auth_failed", message: "Zoho bridge rejected this request." });

  const body = await readBody(req);
  if (!body) return json(res, 400, { category: "bad_request", message: "Request body is not valid JSON." });

  const order = body.order || body;
  try {
    const out = await syncOrder(config(), order);
    return json(res, out.created ? 201 : 200, out);
  } catch (e) {
    if (e instanceof ZohoError) return json(res, e.status, e.toJSON());
    // Never leak an internal message to the browser.
    process.stderr.write(JSON.stringify({ event: "handler.unhandled", detail: String(e && e.message) }) + "\n");
    return json(res, 502, { category: "zoho_unavailable", message: "Zoho unavailable.", detail: null });
  }
}

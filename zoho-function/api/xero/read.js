/* POST /api/xero/read { c, org, what, page?, ids? } — one chunk of the read (see api/zoho/read.js). */
import { cors, json, readBody } from "../_http.js";
import { config, connection, readChunk, ReadError, note } from "../../xero.js";

const TENANT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
  const cfg = config();
  try {
    const b = (await readBody(req)) || {};
    const conn = connection(cfg, b.c);
    if (!conn) { note("xero.handle.unreadable", { route: "api/xero/read.js" }); return json(res, 401, { error: "expired" }); }
    if (!TENANT.test(String(b.org || ""))) return json(res, 400, { error: "bad_request" });
    const out = await readChunk(cfg, conn, String(b.org), String(b.what || ""),
      { page: Math.max(1, Math.min(500, Number(b.page) || 1)), ids: b.ids });
    note("xero.read", { what: b.what, page: b.page, records: (out.records || []).length, more: out.more, listed: out.listed });
    return json(res, 200, out);
  } catch (e) {
    note("xero.route.failed", { route: "api/xero/read.js", reason: e && e.reason, detail: e && e.detail, error: e instanceof ReadError ? undefined : String(e && e.message) });
    if (e instanceof ReadError) return json(res, e.status, { error: e.reason });
    return json(res, 502, { error: "unavailable" });
  }
}

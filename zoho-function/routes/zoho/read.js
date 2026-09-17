/* POST /api/zoho/read { c, org, what, page?, ids? }

   One chunk of the onboarding read. The page calls this repeatedly --
   customers, products, orders, then order lines ten at a time -- so each call
   is short, progress is real, and Stop is just the page not asking again.

     200 { records:[…], more?, from? }
     4xx/5xx { error:"expired"|"forbidden"|"busy"|"timeout"|"unavailable"|"bad_request" } */

import { cors, json, readBody } from "../../api/_http.js";
import { config } from "../../zoho.js";
import { unseal, readChunk, ReadError } from "../../onboarding.js";
import { note } from "../../onboarding.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
  const cfg = config();
  try {
    const b = (await readBody(req)) || {};
    const conn = unseal(cfg, b.c);
    if (!conn) { note("handle.unreadable", { route: "api/zoho/read.js" }); return json(res, 401, { error: "expired" }); }
    if (!/^\d{1,24}$/.test(String(b.org || ""))) return json(res, 400, { error: "bad_request" });
    const out = await readChunk(cfg, conn, String(b.org), String(b.what || ""),
      { page: Math.max(1, Math.min(500, Number(b.page) || 1)), ids: b.ids });
    note("read", { what: b.what, page: b.page, ids: Array.isArray(b.ids) ? b.ids.length : undefined, records: (out.records || []).length, more: out.more, listed: out.listed });
    return json(res, 200, out);
  } catch (e) {
    note("route.failed", { route: "api/zoho/read.js", reason: e && e.reason, detail: e && e.detail, error: e instanceof ReadError ? undefined : String(e && e.message) });
    if (e instanceof ReadError) return json(res, e.status, { error: e.reason });
    return json(res, 502, { error: "unavailable" });
  }
}

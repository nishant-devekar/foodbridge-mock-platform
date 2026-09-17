/* POST /api/xero/orgs { c } → { organizations:[{id,name}] } — the Xero organisations this sign-in can see. */
import { cors, json, readBody } from "../../api/_http.js";
import { config, connection, organisations, ReadError, note } from "../../xero.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
  const cfg = config();
  try {
    const body = await readBody(req);
    const conn = connection(cfg, body && body.c);
    if (!conn) { note("xero.handle.unreadable", { route: "api/xero/orgs.js" }); return json(res, 401, { error: "expired" }); }
    const organizations = await organisations(cfg, conn);
    return json(res, 200, { organizations });
  } catch (e) {
    note("xero.route.failed", { route: "api/xero/orgs.js", reason: e && e.reason, detail: e && e.detail, error: e instanceof ReadError ? undefined : String(e && e.message) });
    if (e instanceof ReadError) return json(res, e.status, { error: e.reason });
    return json(res, 502, { error: "unavailable" });
  }
}

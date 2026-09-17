/* POST /api/zoho/orgs { c } → { organizations:[{id,name}] }
   The Zoho Books businesses this sign-in can see. */

import { cors, json, readBody } from "../../api/_http.js";
import { config } from "../../zoho.js";
import { unseal, organisations, ReadError } from "../../onboarding.js";
import { note } from "../../onboarding.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
  const cfg = config();
  try {
    const body = await readBody(req);
    const conn = unseal(cfg, body && body.c);
    if (!conn) { note("handle.unreadable", { route: "api/zoho/orgs.js" }); return json(res, 401, { error: "expired" }); }
    const organizations = await organisations(cfg, conn);
    note("orgs", { count: organizations.length });
    return json(res, 200, { organizations });
  } catch (e) {
    note("route.failed", { route: "api/zoho/orgs.js", reason: e && e.reason, detail: e && e.detail, error: e instanceof ReadError ? undefined : String(e && e.message) });
    if (e instanceof ReadError) return json(res, e.status, { error: e.reason });
    return json(res, 502, { error: "unavailable" });
  }
}

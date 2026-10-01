/* POST /api/handoff               — the owner's phone sends contacts for his computer
                                     { code, people: [{ name, phone }] } or { code, hello: true }
   GET  /api/handoff?code=…        — the computer takes what has arrived
                                     200 { opened, people }  (read once, then gone)

   See handoff.js. Errors as /api/stores: 400 bad_code / nothing_sent,
   503 not_configured, 502 store_unavailable. */

import { cors, json, readBody } from "./_http.js";
import { cleanPost, post, take } from "../handoff.js";
import { StoresError } from "../stores.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    if (req.method === "GET") {
      const q = new URL(req.url, "http://localhost").searchParams;
      return json(res, 200, await take(q.get("code") || ""));
    }
    if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
    const body = await readBody(req);
    if (body === null) return json(res, 400, { error: "bad_json" });
    const u = cleanPost(body);
    await post(u);
    return json(res, 200, { ok: true, n: u.people.length });
  } catch (e) {
    if (e instanceof StoresError) return json(res, e.status, { error: e.reason, message: e.message });
    return json(res, 500, { error: "unexpected" });
  }
}

/* POST /api/stores                  — Store Builder sends one build, a piece at a time
   GET  /api/stores                  — the team's list of every store built (X-FB-Team)
   GET  /api/stores?id=…&file=…      — one file from one store (X-FB-Team)

   A POST carries { id, meta?, file?: { name, data (base64) } }: the summary
   and each file arrive separately, so no body nears Vercel's 4.5 MB limit and
   a dropped connection costs one file, not the build.

   Replies, so the phone has a fixed set of states rather than a guess:

     200 { ok:true, id }                               saved
     400 { error:"bad_id" | "bad_name" | … }           not saved, not retryable
     413 { error:"too_large" }                         not saved, not retryable
     200 { …, stored, emailed }                        the Excel is also emailed (stores-email.js);
                                                       with no store yet, the email alone counts
     401 { error:"bad_team_key" }                      reading without the team key
     503 { error:"not_configured" }                    no store on this deployment
     502 { error:"store_unavailable" }                 the store refused

   The 4xx/5xx split matters to the phone: it drops what it cannot fix and
   keeps retrying what it can (v7/store-builder/app.js, the send queue). */

import { cors, json, readBody } from "./_http.js";
import { cleanUpload, save, list, read, teamOk, storesStore, StoresError } from "../stores.js";
import { emailBuild, emailReady } from "../stores-email.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method === "GET") {
    if (!teamOk(req)) return json(res, 401, { error: "bad_team_key" });
    const q = new URL(req.url, "http://localhost").searchParams;
    try {
      if (q.get("id") && q.get("file")) {
        const f = await read(q.get("id"), q.get("file"));
        res.writeHead(200, { "Content-Type": f.type, "Cache-Control": "no-store", "Content-Length": f.bytes.length });
        return res.end(f.bytes);
      }
      return json(res, 200, { store: storesStore(), stores: await list() });
    } catch (e) {
      return fail(res, e);
    }
  }

  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });

  const body = await readBody(req);
  if (body === null) return json(res, 400, { error: "bad_json" });
  let u;
  try { u = cleanUpload(body); } catch (e) { return fail(res, e); }

  /* The file store first. Then, for the request that carries the Excel, the
     email backup. It counts as delivered when it was stored, or -- only while
     no store is set up -- when the email went out. A store that is set up but
     failing is retried by the phone even if the email went (a repeat email
     is better than a store that silently misses a build). */
  let stored = false, storeErr = null, emailed = false;
  try { await save(u); stored = true; } catch (e) { storeErr = e; }
  if (u.files.some((f) => /\.xlsx$/.test(f.name)) && emailReady()) {
    emailed = await emailBuild(u).catch(() => false);
  }
  const noStore = storeErr instanceof StoresError && storeErr.reason === "not_configured";
  if (stored || (noStore && emailed)) return json(res, 200, { ok: true, id: u.id, stored: stored, emailed: emailed });
  return fail(res, storeErr);
}

function fail(res, e) {
  if (e instanceof StoresError) return json(res, e.status, { error: e.reason, message: e.message });
  return json(res, 500, { error: "unexpected", message: "Not saved." });
}

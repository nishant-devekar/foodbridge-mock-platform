/* POST /api/feedback   — save what a demo user said
   GET  /api/feedback   — read it back (needs X-FB-Key when one is set)

   Replies, so the page has a fixed set of states rather than a guess:

     200 { ok:true, id, at }                      saved
     400 { error:"bad_rating" | "bad_json" }      not saved, and not retryable
     503 { error:"not_configured" }               no store on this deployment
     502 { error:"store_unavailable" }            the store refused

   The 4xx/5xx split matters to the browser: it drops what it cannot fix and
   keeps retrying what it can (v7/assets/exit-demo.js). */

import { cors, json, keyOk, readBody } from "./_http.js";
import { cleanEntry, store, list, feedbackStore, FeedbackError } from "../feedback.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method === "GET") {
    /* Reading is the operator's side of this, so it is behind the key when one
       is set. Writing is NOT: a demo user's browser is the thing posting, and
       the page they were handed carries no secret of its own. */
    if (!keyOk(req)) return json(res, 401, { error: "bad_key" });
    const n = (req.query && req.query.limit) ||
      new URL(req.url, "http://localhost").searchParams.get("limit");
    try {
      return json(res, 200, { store: feedbackStore(), entries: await list(n) });
    } catch (e) {
      return fail(res, e);
    }
  }

  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });

  const body = await readBody(req);
  if (body === null) return json(res, 400, { error: "bad_json" });

  try {
    const entry = cleanEntry(body);
    await store(entry);
    return json(res, 200, { ok: true, id: entry.id, at: entry.at });
  } catch (e) {
    return fail(res, e);
  }
}

function fail(res, e) {
  if (e instanceof FeedbackError) return json(res, e.status, { error: e.reason, message: e.message });
  return json(res, 500, { error: "unexpected", message: "Feedback was not saved." });
}

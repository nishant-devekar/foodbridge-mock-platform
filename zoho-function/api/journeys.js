/* POST /api/journeys              — a tester's tower reports where it stands on a trial flow
   GET  /api/journeys?trial=T-…    — the Store Flow Editor reads every tester of a trial (X-FB-Team)

   Replies:
     200 { ok:true }                                  saved
     200 { trial, store, testers:[…] }                the trial's testers, latest first
     400 { error:"bad_trial" | "bad_tester" | … }     not saved, not retryable
     401 { error:"bad_team_key" }                     reading without the team key
     503 { error:"not_configured" }                   no store on this deployment
     502 { error:"store_unavailable" }                the store refused */

import { cors, json, readBody } from "./_http.js";
import { cleanReport, save, list, teamOk, journeysStore } from "../journeys.js";
import { StoresError } from "../stores.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method === "GET") {
    if (!teamOk(req)) return json(res, 401, { error: "bad_team_key" });
    const trial = new URL(req.url, "http://localhost").searchParams.get("trial");
    try { return json(res, 200, { trial: trial, store: journeysStore(), testers: await list(trial) }); }
    catch (e) { return fail(res, e); }
  }

  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
  const body = await readBody(req);
  if (body === null) return json(res, 400, { error: "bad_json" });
  try {
    const r = cleanReport(body);
    await save(r);
    return json(res, 200, { ok: true });
  } catch (e) {
    return fail(res, e);
  }
}

function fail(res, e) {
  if (e instanceof StoresError) return json(res, e.status, { error: e.reason, message: e.message });
  return json(res, 500, { error: "unexpected", message: "Not saved." });
}

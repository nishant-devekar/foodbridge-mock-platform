/* POST /api/extract { kind, mediaType, data }  (data = base64 image, no prefix)
   → 200 { records, skipped }
   → 4xx/5xx { error: "not_configured" | "unreadable" | "busy" | "unavailable" | "bad_request" }
   Reads a photo of invoices, payments or cost prices; see ../extract.js. */

import { cors, json, readBody } from "./_http.js";
import { extractPhoto, ExtractError } from "../extract.js";
import { note } from "../onboarding.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
  try {
    const b = (await readBody(req)) || {};
    const out = await extractPhoto({ kind: b.kind, mediaType: b.mediaType, data: b.data });
    note("extract", { kind: b.kind, records: out.records.length, skipped: out.skipped.length ? out.skipped[0].count : 0 });
    return json(res, 200, out);
  } catch (e) {
    const reason = e instanceof ExtractError ? e.reason : "unavailable";
    note("extract.failed", { reason });
    return json(res, e instanceof ExtractError ? e.status : 502, { error: reason });
  }
}

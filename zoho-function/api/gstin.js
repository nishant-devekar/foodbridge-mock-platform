/* GET /api/gstin?gstin=27ABCDE1234F1Z5
   The browser's only route to GST verification. It never sees the credential
   and never learns which provider is behind this.

   Every reply is one of exactly four shapes, so the screen has four states to
   draw and no fifth to guess at:

     200 { found:true,  gstin, legalName?, tradeName?, status? }
     200 { found:false, gstin }
     400 { error:"invalid_gstin" }
     5xx { error:"upstream_auth" | "upstream_unavailable" | "upstream_unreadable"
                 | "timeout" | "not_configured" }

   Identity fields are present only when the provider returned them. */

import { cors, json, keyOk } from "./_http.js";
import { lookupGstin, GstError } from "../gst.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "GET") {
    return json(res, 405, { error: "method_not_allowed" });
  }
  if (!keyOk(req)) {
    return json(res, 401, { error: "bad_key" });
  }

  /* Vercel gives req.query; the dev-server gives a bare url. Handle both, the
     same way the rest of this bridge does. */
  const q = (req.query && req.query.gstin) ||
    new URL(req.url, "http://localhost").searchParams.get("gstin") || "";

  try {
    const result = await lookupGstin(q);
    return json(res, 200, result);
  } catch (e) {
    if (e instanceof GstError) {
      return json(res, e.status, { error: e.reason, message: e.message });
    }
    /* Anything unforeseen is still reported as a failure to CHECK, never as a
       verdict on the number. */
    return json(res, 502, { error: "upstream_unavailable", message: "Could not check that GSTIN." });
  }
}

/* GET /api/zoho/ready — can "Connect Zoho Books" start at all?

   The page asks BEFORE it sends the user's whole window to Zoho. Without this,
   a bridge that is down or unconfigured would strand the user on a browser
   error page with no way back into onboarding.

     200 { ready:true }
     503 { ready:false, reason:"not_configured" } */

import { cors, json } from "../../api/_http.js";
import { config } from "../../zoho.js";

export default function handler(req, res) {
  if (cors(req, res)) return;
  const cfg = config();
  if (!cfg.clientId || !cfg.clientSecret) return json(res, 503, { ready: false, reason: "not_configured" });
  return json(res, 200, { ready: true });
}

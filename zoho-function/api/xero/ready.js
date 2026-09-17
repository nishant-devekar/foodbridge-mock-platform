/* GET /api/xero/ready — can "Connect Xero" start at all? (see api/zoho/ready.js) */
import { cors, json } from "../_http.js";
import { config } from "../../xero.js";

export default function handler(req, res) {
  if (cors(req, res)) return;
  const cfg = config();
  if (!cfg.clientId || !cfg.clientSecret) return json(res, 503, { ready: false, reason: "not_configured" });
  return json(res, 200, { ready: true });
}

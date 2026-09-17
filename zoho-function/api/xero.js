/* /api/xero/<action> — one Vercel function for the Xero onboarding channel;
   see api/zoho.js for why. Includes the callback Xero redirects to. */
import ready from "../routes/xero/ready.js";
import start from "../routes/xero/start.js";
import callback from "../routes/xero/callback.js";
import orgs from "../routes/xero/orgs.js";
import read from "../routes/xero/read.js";

const ACTIONS = { ready, start, callback, orgs, read };

export default function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const action = url.searchParams.get("action") || (url.pathname.split("/")[3] || "");
  const h = ACTIONS[action];
  if (!h) { res.writeHead(404, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: "not_found" })); }
  return h(req, res);
}

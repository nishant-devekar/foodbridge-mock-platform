/* /api/zoho/<action> — one Vercel function for the Zoho onboarding channel.
   vercel.json rewrites /api/zoho/ready, start, orgs and read to this file
   with ?action=…; the handlers themselves live in routes/zoho/, outside api/,
   because the Hobby plan counts every file under api/ as a function and caps
   a deployment at twelve. The local dev-server serves routes/ directly. */
import ready from "../routes/zoho/ready.js";
import start from "../routes/zoho/start.js";
import orgs from "../routes/zoho/orgs.js";
import read from "../routes/zoho/read.js";

const ACTIONS = { ready, start, orgs, read };

export default function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const action = url.searchParams.get("action") || (url.pathname.split("/")[3] || "");
  const h = ACTIONS[action];
  if (!h) { res.writeHead(404, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: "not_found" })); }
  return h(req, res);
}

/* GET /api/connect — step 1 of the ONE-TIME setup.
   Sends the customer's Zoho admin to Zoho's consent screen. Run once, ever. */

import { config, SCOPES } from "../zoho.js";

export default function handler(req, res) {
  const cfg = config();
  if (!cfg.clientId) {
    res.writeHead(503, { "Content-Type": "text/plain" });
    return res.end("ZOHO_CLIENT_ID is not set. See .env.example.");
  }
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: cfg.redirectUri,
    scope: SCOPES,
    // Without offline + consent, Zoho returns an access token and NO refresh
    // token — the classic "it worked once and never again" failure.
    access_type: "offline",
    prompt: "consent",
  });
  res.writeHead(302, {
    Location: `${cfg.accountsUrl}/oauth/v2/auth?${params.toString()}`,
    "Cache-Control": "no-store",
  });
  res.end();
}

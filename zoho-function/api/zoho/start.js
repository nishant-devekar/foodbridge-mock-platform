/* GET /api/zoho/start?return=<page url>&n=<nonce>

   A top-level navigation, not a fetch: it sends the user to Zoho's own sign-in
   and consent screen. `return` must be on an allowed origin; `n` is the page's
   nonce, carried through Zoho inside a signed state and handed back so the page
   can tell its own sign-in from one it never started. */

import { config } from "../../zoho.js";
import { signState, allowedReturn, authorizeUrl, returnWith } from "../../onboarding.js";

const text = (res, status, msg) => {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  res.end(msg);
};

export default function handler(req, res) {
  const cfg = config();
  const url = new URL(req.url, "http://localhost");
  const back = allowedReturn(cfg, url.searchParams.get("return") || "");
  const nonce = String(url.searchParams.get("n") || "");
  // With no trusted page to go back to there is nowhere safe to send anyone.
  if (!back) return text(res, 400, "This sign-in link is not valid.");
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(nonce) || !cfg.clientId || !cfg.clientSecret) {
    res.writeHead(302, { Location: returnWith(back, { zoho: "failed", n: nonce }), "Cache-Control": "no-store" });
    return res.end();
  }
  const state = signState(cfg, { r: back, n: nonce });
  res.writeHead(302, { Location: authorizeUrl(cfg, state), "Cache-Control": "no-store" });
  res.end();
}

/* GET /api/xero/start?return=<page url>&n=<nonce>
   A top-level navigation to Xero's sign-in and consent (see api/zoho/start.js). */
import { config, signState, allowedReturn, authorizeUrl, returnWith } from "../../xero.js";

const text = (res, status, msg) => {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  res.end(msg);
};

export default function handler(req, res) {
  const cfg = config();
  const url = new URL(req.url, "http://localhost");
  const back = allowedReturn(cfg, url.searchParams.get("return") || "");
  const nonce = String(url.searchParams.get("n") || "");
  if (!back) return text(res, 400, "This sign-in link is not valid.");
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(nonce) || !cfg.clientId || !cfg.clientSecret) {
    res.writeHead(302, { Location: returnWith(back, { xero: "failed", n: nonce }), "Cache-Control": "no-store" });
    return res.end();
  }
  const state = signState(cfg.sealCfg, { r: back, n: nonce, p: "xero" });
  res.writeHead(302, { Location: authorizeUrl(cfg, state), "Cache-Control": "no-store" });
  res.end();
}

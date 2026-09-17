/* GET /api/xero/callback — where Xero sends the user back. Registered with the
   Xero app as its redirect URI. Never renders a page: the outcome goes back to
   FoodBridge in the URL fragment (see api/callback.js's onboarding branch). */
import { config, verifyState, exchange, seal, returnWith, note } from "../../xero.js";

export default async function handler(req, res) {
  const cfg = config();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const go = (loc) => { res.writeHead(302, { Location: loc, "Cache-Control": "no-store" }); res.end(); };
  const st = verifyState(cfg.sealCfg, url.searchParams.get("state"));
  if (!st || st.p !== "xero") {
    note("xero.callback.bad_state");
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    return res.end("This sign-in has expired. Go back to FoodBridge and start again.");
  }
  const err = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  note("xero.callback", { outcome: err ? "error" : code ? "code" : "nothing", xeroError: err || undefined });
  if (err || !code) return go(returnWith(st.r, { xero: err === "access_denied" ? "denied" : "failed", n: st.n }));
  try {
    const conn = await exchange(cfg, code);
    return go(returnWith(st.r, { xero: "connected", n: st.n, c: seal(cfg.sealCfg, conn) }));
  } catch (e) {
    note("xero.callback.failed", { reason: e && e.reason, detail: e && e.detail });
    return go(returnWith(st.r, { xero: "failed", n: st.n }));
  }
}

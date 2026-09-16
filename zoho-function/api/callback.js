/* GET /api/callback — step 2 of the ONE-TIME setup.
   Zoho sends the authorization code here; this trades it for the refresh
   token and shows it once so it can be pasted into the function's secrets.

   It is ALSO where onboarding's "Connect Zoho Books" returns, because this is
   the redirect URI already registered with Zoho. The two are told apart by
   `state`: the one-time setup sends none, onboarding sends a signed `ob.` one.
   An onboarding return never renders a page here -- it goes straight back to
   FoodBridge with the outcome in the URL fragment. */

import { config, exchangeCode } from "../zoho.js";
import { isOnboardingState, verifyState, exchange, seal, returnWith, accountsServer, note } from "../onboarding.js";

async function onboardingReturn(cfg, url, res) {
  const go = (loc) => { res.writeHead(302, { Location: loc, "Cache-Control": "no-store" }); res.end(); };
  const st = verifyState(cfg, url.searchParams.get("state"));
  if (!st) {
    note("callback.bad_state");
    // A forged, expired or replayed state has no trusted page to return to.
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    return res.end("This sign-in has expired. Go back to FoodBridge and start again.");
  }
  const err = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  note("callback", { outcome: err ? "error" : code ? "code" : "nothing", zohoError: err || undefined,
                    location: url.searchParams.get("location") || undefined,
                    accountsServer: url.searchParams.get("accounts-server") || undefined });
  if (err || !code) {
    return go(returnWith(st.r, { zoho: err === "access_denied" ? "denied" : "failed", n: st.n }));
  }
  try {
    const conn = await exchange(cfg, code, accountsServer(cfg, url.searchParams.get("accounts-server")));
    return go(returnWith(st.r, { zoho: "connected", n: st.n, c: seal(cfg, conn) }));
  } catch (e) {
    note("callback.failed", { reason: e && e.reason, detail: e && e.detail });
    return go(returnWith(st.r, { zoho: "failed", n: st.n }));
  }
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export default async function handler(req, res) {
  const cfg = config();
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (isOnboardingState(url.searchParams.get("state"))) return onboardingReturn(cfg, url, res);
  const code = url.searchParams.get("code");
  const page = (title, inner) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(`<!doctype html><meta charset="utf-8"><title>${title}</title>
      <body style="font:15px/1.6 system-ui;max-width:44rem;margin:3rem auto;padding:0 1rem">${inner}</body>`);
  };

  if (!code) {
    const e = url.searchParams.get("error");
    // Opened by hand (say, to check the address after registering it with
    // Zoho): nothing to do here, and /api/connect is the operator's one-time
    // setup, not a way in for a user. Point back at the app instead.
    if (!e) {
      return page("FoodBridge — Zoho sign-in", `<h1>This is where Zoho sends you back</h1>
        <p>After you sign in to Zoho from FoodBridge, Zoho returns you here and you are taken
        straight back into FoodBridge. There is nothing to do on this page.</p>
        <p><a href="${esc(cfg.appUrl)}">Go to FoodBridge</a></p>`);
    }
    return page("Zoho — not connected", `<h1>Not connected</h1><p>Zoho said: <code>${esc(e)}</code></p>
      <p>Start again at <a href="/api/connect">/api/connect</a>.</p>`);
  }

  try {
    const token = await exchangeCode(cfg, code);
    // Shown once, in the operator's own browser, on the machine running the
    // one-time setup. It is not logged and not written to the repo.
    return page("Zoho connected", `<h1>Zoho connected</h1>
      <p>Set this as <code>ZOHO_REFRESH_TOKEN</code> in the function's environment
      (Vercel → Settings → Environment Variables, or your local <code>.env</code>),
      then redeploy or restart.</p>
      <pre style="background:#f4f4f5;padding:1rem;border-radius:8px;white-space:pre-wrap;word-break:break-all">${esc(token.refresh_token)}</pre>
      <p><strong>Do not commit this.</strong> It does not expire until revoked.</p>
      ${token.api_domain ? `<p>Zoho says this account's API domain is <code>${esc(token.api_domain)}</code>.
      Make sure <code>ZOHO_API_BASE_URL</code> matches it (add <code>/books/v3</code>).</p>` : ""}
      <p>You still need <code>ZOHO_ORGANIZATION_ID</code> — Zoho Books → Settings → Organisation Profile.</p>`);
  } catch (e) {
    return page("Zoho — not connected",
      `<h1>Not connected</h1><p>${esc(e.message)}</p><p><code>${esc(e.detail || "")}</code></p>
       <p>Start again at <a href="/api/connect">/api/connect</a>.</p>`);
  }
}

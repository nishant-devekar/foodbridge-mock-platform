/* GET /api/callback — step 2 of the ONE-TIME setup.
   Zoho sends the authorization code here; this trades it for the refresh
   token and shows it once so it can be pasted into the function's secrets. */

import { config, exchangeCode } from "../zoho.js";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export default async function handler(req, res) {
  const cfg = config();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const code = url.searchParams.get("code");
  const page = (title, inner) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(`<!doctype html><meta charset="utf-8"><title>${title}</title>
      <body style="font:15px/1.6 system-ui;max-width:44rem;margin:3rem auto;padding:0 1rem">${inner}</body>`);
  };

  if (!code) {
    const e = url.searchParams.get("error") || "no authorization code";
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

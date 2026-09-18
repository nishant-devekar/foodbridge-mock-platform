/* ==========================================================================
   Run the same handlers locally, so the bridge can be exercised before it is
   deployed anywhere. Vercel serves /api/<name>.js at /api/<name>; this does
   the same on http://localhost:8787.

       node dev-server.js
   ========================================================================== */

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";

// Tiny .env reader — one less reason to need npm install.
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    if (process.env[k] === undefined) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const ROUTES = {
  "/api/sales-order": () => import("./api/sales-order.js"),
  "/api/health": () => import("./api/health.js"),
  "/api/gstin": () => import("./api/gstin.js"),
  "/api/feedback": () => import("./api/feedback.js"),
  "/api/connect": () => import("./api/connect.js"),
  "/api/callback": () => import("./api/callback.js"),
  "/api/zoho/ready": () => import("./routes/zoho/ready.js"),
  "/api/zoho/start": () => import("./routes/zoho/start.js"),
  "/api/zoho/orgs": () => import("./routes/zoho/orgs.js"),
  "/api/zoho/read": () => import("./routes/zoho/read.js"),
  "/api/extract": () => import("./api/extract.js"),
  "/api/xero/ready": () => import("./routes/xero/ready.js"),
  "/api/xero/start": () => import("./routes/xero/start.js"),
  "/api/xero/callback": () => import("./routes/xero/callback.js"),
  "/api/xero/orgs": () => import("./routes/xero/orgs.js"),
  "/api/xero/read": () => import("./routes/xero/read.js"),
};

const port = Number(process.env.PORT || 8787);

// This runner exists for the machine it runs on. A page served from any
// loopback port — the preview pane, a cut's serve.sh, a port opened for the
// iOS Simulator — may call it and be returned to after Zoho, without
// ALLOWED_ORIGINS having to be re-typed for each. Vercel never runs this file,
// so a deployment keeps the exact allowlist. Set ALLOW_LOOPBACK_ORIGINS=0 to
// test the strict behaviour locally.
if (process.env.ALLOW_LOOPBACK_ORIGINS === undefined) process.env.ALLOW_LOOPBACK_ORIGINS = "1";

createServer(async (req, res) => {
  const path = req.url.split("?")[0];
  const load = ROUTES[path];
  if (!load) {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ category: "not_found", message: "No such endpoint." }));
  }
  try {
    const mod = await load();
    await mod.default(req, res);
  } catch (e) {
    process.stderr.write(`dev-server error: ${e && e.stack}\n`);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ category: "zoho_unavailable", message: "Bridge error." }));
    }
  }
}).listen(port, async () => {
  const { config, missingConfig } = await import("./zoho.js");
  const { gstConfig, missingGstConfig } = await import("./gst.js");
  const missing = missingConfig(config());
  const gstMissing = missingGstConfig(gstConfig());
  process.stdout.write(
    `\n  FoodBridge → Zoho Books bridge on http://localhost:${port}\n` +
    `  health   http://localhost:${port}/api/health\n` +
    `  connect  http://localhost:${port}/api/connect   (one-time OAuth setup)\n` +
    `  gstin    http://localhost:${port}/api/gstin?gstin=<15 chars>\n` +
    `  feedback http://localhost:${port}/api/feedback       (POST to save, GET to read)\n` +
    `  zoho     http://localhost:${port}/api/zoho/*        (onboarding: sign in + read)\n` +
    `  xero     http://localhost:${port}/api/xero/*        (onboarding: sign in + read${process.env.XERO_CLIENT_ID ? "" : " — XERO_CLIENT_ID/SECRET not set"})\n` +
    (process.env.ALLOW_LOOPBACK_ORIGINS === "1"
      ? `  origins  any http://localhost:* or 127.0.0.1:* page, plus ALLOWED_ORIGINS\n`
      : `  origins  ALLOWED_ORIGINS only (loopback not widened)\n`) +
    (gstMissing.length
      ? `\n  GST VERIFICATION NOT CONFIGURED — missing: ${gstMissing.join(", ")}\n` +
        `  S01 will report that it could not check. Set them in .env.\n`
      : `  GST verification configured (${gstConfig().baseUrl})\n`) +
    (missing.length
      ? `\n  NOT CONFIGURED — missing: ${missing.join(", ")}\n` +
        `  Orders will return \`not_configured\` until these are set. See .env.example.\n\n`
      : `\n  Configured. Orders will hit the real Zoho Books API.\n\n`)
  );
});

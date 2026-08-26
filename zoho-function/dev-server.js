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
  "/api/connect": () => import("./api/connect.js"),
  "/api/callback": () => import("./api/callback.js"),
};

const port = Number(process.env.PORT || 8787);

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
  const missing = missingConfig(config());
  process.stdout.write(
    `\n  FoodBridge → Zoho Books bridge on http://localhost:${port}\n` +
    `  health   http://localhost:${port}/api/health\n` +
    `  connect  http://localhost:${port}/api/connect   (one-time OAuth setup)\n` +
    (missing.length
      ? `\n  NOT CONFIGURED — missing: ${missing.join(", ")}\n` +
        `  Orders will return \`not_configured\` until these are set. See .env.example.\n\n`
      : `\n  Configured. Orders will hit the real Zoho Books API.\n\n`)
  );
});

/* One-shot live check against the real GST provider.

     node check-gst.js 27ABCDE1234F1Z5

   It prints the provider's RAW payload beside what gst.js made of it, because
   the one thing a stand-in cannot prove is that the provider's field names are
   the ones the adapter reads. If "what we sent to the browser" is missing a
   name the raw payload clearly contains, the fix is readTaxpayer()/normalise()
   in gst.js and nothing else.

   Reads .env the same way check.js does. Prints no key, ever. */

import { readFileSync } from "node:fs";
import { gstConfig, missingGstConfig, lookupGstin, GstError, isWellFormed } from "./gst.js";

try {
  for (const l of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const t = l.trim(); if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("="); if (i < 0) continue;
    const k = t.slice(0, i).trim();
    if (process.env[k] === undefined) process.env[k] = t.slice(i + 1).trim();
  }
} catch { /* no .env — env may already be set */ }

const gstin = (process.argv[2] || "").trim().toUpperCase();
const cfg = gstConfig();
const missing = missingGstConfig(cfg);

console.log(`\n  provider   ${cfg.baseUrl}`);
console.log(`  credential ${missing.length ? "MISSING: " + missing.join(", ") : "set"}`);

if (missing.length) {
  console.log(`\n  Put them in zoho-function/.env, then run this again:\n`);
  console.log(`      GST_API_KEY=...`);
  console.log(`      GST_API_SECRET=...\n`);
  process.exit(1);
}
if (!gstin) {
  console.log(`\n  Pass a GSTIN:  node check-gst.js 27ABCDE1234F1Z5\n`);
  process.exit(1);
}
if (!isWellFormed(gstin)) {
  console.log(`\n  ${gstin} is not a valid GSTIN format — the bridge would reject`);
  console.log(`  this locally without spending a lookup.\n`);
  process.exit(1);
}

/* Tap the raw payload on its way past, so the adapter's mapping can be judged
   against what actually arrived rather than against what we hoped would. */
let raw = null;
const tap = async (url, init) => {
  const res = await fetch(url, init);
  if (String(url).includes("/search")) {
    const txt = await res.text();
    try { raw = JSON.parse(txt); } catch { raw = txt; }
    return new Response(txt, { status: res.status, headers: res.headers });
  }
  return res;
};

console.log(`  looking up  ${gstin}\n`);
try {
  const out = await lookupGstin(gstin, { config: cfg, fetch: tap });
  console.log("  ── what the provider returned ──────────────────────────────");
  console.log(JSON.stringify(raw, null, 2).split("\n").map(l => "  " + l).join("\n"));
  console.log("\n  ── what the bridge sends the browser ───────────────────────");
  console.log(JSON.stringify(out, null, 2).split("\n").map(l => "  " + l).join("\n"));

  if (out.found) {
    const gaps = ["legalName", "tradeName", "status"].filter(k => !(k in out));
    console.log(
      gaps.length
        ? `\n  Nothing mapped for: ${gaps.join(", ")}.\n` +
          `  If the raw payload above clearly holds them under other names,\n` +
          `  add those names in normalise() in gst.js.\n`
        : `\n  All three identity fields mapped. S01 will render them.\n`
    );
  } else {
    console.log(`\n  The register has no such number. S01 shows "No business registered".\n`);
  }
} catch (e) {
  if (e instanceof GstError) {
    console.log(`  FAILED TO CHECK — ${e.reason}`);
    console.log(`  ${e.message}`);
    console.log(
      e.reason === "upstream_auth"
        ? `\n  The key and secret reached the provider and were rejected.\n`
        : e.reason === "timeout"
          ? `\n  No reply within ${cfg.timeoutMs}ms.\n`
          : `\n  S01 reports that it could not check — never a verdict on the number.\n`
    );
    if (raw) {
      console.log("  ── raw payload, if any ─────────────────────────────────────");
      console.log(JSON.stringify(raw, null, 2).split("\n").map(l => "  " + l).join("\n") + "\n");
    }
  } else {
    console.log(`  Unexpected: ${e && e.message}\n`);
  }
  process.exit(2);
}

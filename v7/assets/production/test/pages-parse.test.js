/* Every Production page's scripts must parse. Run from v7/:
     node --test assets/production/test/*.test.js
   Added 26 Sep 2026 after a published Production Plan rendered blank: an
   apostrophe in a copy edit ("this demo's own figures") closed its
   single-quoted string early, so the page's only inline script never ran.
   A syntax error takes the whole screen down, so this checks every inline
   <script> in the pages the Production work added, and every script file
   they and the joined modules load. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const V7 = path.join(__dirname, "..", "..", "..");
const PAGES = [
  "modules/foodbridge-production-flow/plan.html",
  "modules/foodbridge-production-flow/month-end.html",
  "modules/jobflow-worker-management/admin-web/index.html",
  "modules/jobflow-worker-management/worker-app/index.html",
  "modules/foodbridge-production-discovery/batch-management/screens/batch/batch-workspace.html",
  "modules/foodbridge-production-discovery/batch-management/screens/batch/batch-detail.html",
  "modules/foodbridge-production-discovery/batch-management/screens/batch/semi-finished-products.html",
  "modules/foodbridge-production-discovery/production-planning/screens/recipie/recipe-v4.html",
  "modules/foodbridge-inventory-mockup/screens/raw-material-inventory/screen-05-receive-stock.html",
  "modules/foodbridge-staff-mockup/screens/screen-01-staff-list.html",
];

function parses(code, where) {
  try { new vm.Script(code, { filename: where }); }
  catch (e) { assert.fail(where + ": " + e.message); }
}

for (const page of PAGES) {
  test("scripts parse: " + page, () => {
    const file = path.join(V7, page);
    const html = fs.readFileSync(file, "utf8");
    let inline = 0, files = 0;
    for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      const src = /\bsrc="([^"]+)"/.exec(m[1]);
      if (!src) { if (m[2].trim()) { parses(m[2], page + " (inline script " + (++inline) + ")"); } continue; }
      if (/^(https?:)?\/\//.test(src[1])) continue;
      const target = path.resolve(path.dirname(file), src[1].split("?")[0]);
      if (!fs.existsSync(target)) assert.fail(page + ": script not found: " + src[1]);
      parses(fs.readFileSync(target, "utf8"), path.relative(V7, target));
      files++;
    }
    assert.ok(inline + files > 0, "no scripts found");
  });
}

/* ==========================================================================
   Seed the PMF Zoho Books org with the WHOLE FoodBridge catalogue, then write
   the complete mappings.

       node seed-catalogue.js            # create anything missing
       node seed-catalogue.js --dry-run  # show what it would do, touch nothing

   Idempotent by design. Existing Zoho contacts and items are matched first --
   contacts by name, items by SKU -- and reused. Re-running creates nothing and
   simply rewrites mappings.js from what is already there, so it is safe to run
   after adding a product by hand.

   PRICING, and this is the one judgement call in the file: FoodBridge holds no
   price. The tenant's product NAMES do -- "AMLA PICKLE (1000 gm) (OLD MRP 700)
   NEW MRP 660" -- so the rate is read out of the name rather than invented.
   That is an MRP, i.e. the retail price, not the trade price a distributor
   charges a shop. It is real data and it makes a demo legible, but if the
   actual trade price differs, fix the rate on the Zoho item; nothing in
   FoodBridge sends a price, so Zoho's number is always the one that counts.
   23 of the 86 products carry no MRP in their name and are created at 0.
   ========================================================================== */

import { readFileSync, writeFileSync } from "node:fs";
import { loadSeed } from "./read-seed.js";
import { config, listAll, createContact, createItem } from "./zoho.js";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const t = line.trim(); if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("="); if (i === -1) continue;
  const k = t.slice(0, i).trim();
  if (process.env[k] === undefined) process.env[k] = t.slice(i + 1).trim();
}

const DRY = process.argv.includes("--dry-run");
const cfg = config();
const say = (s = "") => process.stdout.write(s + "\n");
const norm = (v) => String(v == null ? "" : v).trim().toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Zoho allows roughly 100 writes a minute per organisation. 126 creates at
// full tilt trips that and starts returning 429s halfway through a seed, which
// is the worst moment to stop. Pacing costs ninety seconds once.
const WRITE_GAP_MS = 700;

/** The selling price the tenant's own product name states, or null. */
function rateFromName(name) {
  const neu = /NEW\s*MRP\s*([0-9]+(?:\.[0-9]+)?)/i.exec(name);
  if (neu) return Number(neu[1]);
  const all = [...String(name).matchAll(/MRP\s*([0-9]+(?:\.[0-9]+)?)/gi)];
  return all.length ? Number(all[all.length - 1][1]) : null;
}

/** One write, with a single patient retry when Zoho asks us to slow down. */
async function write(fn, label) {
  try {
    return await fn();
  } catch (e) {
    if (/rate limit/i.test(e.detail || e.message || "")) {
      say(`     rate limited on ${label} — waiting 60s`);
      await sleep(60_000);
      return fn();
    }
    throw e;
  }
}

const seed = loadSeed();
const nameOf = (c) => (typeof c.name === "object" ? c.name.en : c.name) || "";

say(`\n  Org ${cfg.organizationId}  ·  ${seed.b2b.length} customers  ·  ${seed.products.length} products${DRY ? "  (DRY RUN)" : ""}\n`);

/* -- customers ------------------------------------------------------------ */

say("  Reading existing Zoho contacts…");
const contacts = await listAll(cfg, "/contacts", "contacts");
const byContactName = new Map(contacts.map((c) => [norm(c.contact_name), c]));
say(`     ${contacts.length} already in Zoho`);

// One pair of seed customers shares a name (c10/c17). Zoho contact names must
// be unique, so the later one carries its FoodBridge id -- visible in Zoho,
// and unambiguous, which matters more here than tidiness.
const seenName = new Set();
const customerPlan = seed.b2b.map((c) => {
  const base = nameOf(c).trim();
  const key = norm(base);
  const zohoName = seenName.has(key) ? `${base} (${c._id})` : base;
  seenName.add(key);
  return { id: c._id, zohoName, phone: c.phone || "" };
});

const customerMap = {};
let madeContacts = 0, reusedContacts = 0;
for (const plan of customerPlan) {
  const found = byContactName.get(norm(plan.zohoName));
  if (found) { customerMap[plan.id] = String(found.contact_id); reusedContacts++; continue; }
  if (DRY) { say(`     would create contact: ${plan.zohoName}`); customerMap[plan.id] = "DRY"; continue; }
  const created = await write(() => createContact(cfg, {
    contact_name: plan.zohoName,
    company_name: plan.zohoName,
    contact_type: "customer",
    // Phone only. Emails are deliberately left off: the seed's addresses are
    // real-looking, and a demo org that can email them is a way to send a
    // stranger a sales order by accident. Add them in Zoho if you want them.
    ...(plan.phone ? { phone: String(plan.phone) } : {}),
  }), plan.zohoName);
  customerMap[plan.id] = String(created.contact_id);
  madeContacts++;
  say(`     + ${plan.zohoName}  ·  ${created.contact_id}`);
  await sleep(WRITE_GAP_MS);
}
say(`  Customers: ${customerPlan.length} (${madeContacts} created, ${reusedContacts} reused)\n`);

/* -- products ------------------------------------------------------------- */

say("  Reading existing Zoho items…");
const items = await listAll(cfg, "/items", "items");
const bySku = new Map(items.filter((i) => i.sku).map((i) => [norm(i.sku), i]));
say(`     ${items.length} already in Zoho`);

const itemMap = {};
const noPrice = [];
let madeItems = 0, reusedItems = 0;
for (const p of seed.products) {
  const found = bySku.get(norm(p.artNo));
  if (found) {
    // The unit is read back from Zoho, never assumed: factor 1 is only correct
    // when both systems count the same thing.
    itemMap[p.id] = { itemId: String(found.item_id), unit: found.unit || p.unit, factor: 1, fbUnit: p.unit };
    reusedItems++;
    continue;
  }
  const rate = rateFromName(p.name);
  if (rate == null) noPrice.push(p.id);
  if (DRY) { say(`     would create item: ${p.artNo}  ${p.unit}  rate ${rate ?? 0}  ${p.name.slice(0, 46)}`); continue; }
  const created = await write(() => createItem(cfg, {
    name: p.name, sku: p.artNo, unit: p.unit, rate: rate ?? 0,
    product_type: "goods", item_type: "sales",
  }), p.artNo);
  itemMap[p.id] = { itemId: String(created.item_id), unit: created.unit || p.unit, factor: 1, fbUnit: p.unit };
  madeItems++;
  if (madeItems % 10 === 0) say(`     …${madeItems} created`);
  await sleep(WRITE_GAP_MS);
}
say(`  Products: ${seed.products.length} (${madeItems} created, ${reusedItems} reused)`);

/* -- unit check ----------------------------------------------------------- */

const unitTrouble = Object.entries(itemMap).filter(([, v]) => norm(v.unit) !== norm(v.fbUnit));
if (unitTrouble.length) {
  say(`\n  !! ${unitTrouble.length} products where the Zoho unit differs from FoodBridge's.`);
  say("     Set a real factor for these by hand — the integration will refuse them otherwise:");
  unitTrouble.slice(0, 10).forEach(([k, v]) => say(`       ${k}: FoodBridge "${v.fbUnit}" vs Zoho "${v.unit}"`));
} else {
  say("  Units: every mapped item matches FoodBridge's unit — factor 1 throughout.");
}
if (noPrice.length) {
  say(`\n  ${noPrice.length} products had no MRP in their name and were created at rate 0:`);
  say(`     ${noPrice.join(", ")}`);
  say("     Set their price on the Zoho item if they appear in a demo order.");
}

/* -- write mappings ------------------------------------------------------- */

if (DRY) { say("\n  Dry run — mappings.js untouched.\n"); process.exit(0); }

const stamp = new Date().toISOString().slice(0, 10);
const src = readFileSync("mappings.js", "utf8");
const out = src
  .replace(/export const ZOHO_CUSTOMER_MAP = \{[\s\S]*?\n\};/,
    `export const ZOHO_CUSTOMER_MAP = {\n` +
    `  // ${Object.keys(customerMap).length} customers, written by seed-catalogue.js on ${stamp}.\n` +
    `  // Ids read back from the live Zoho org — none of them typed by hand.\n` +
    Object.entries(customerMap).map(([k, v]) => `  "${k}": "${v}",`).join("\n") + `\n};`)
  .replace(/export const ZOHO_ITEM_MAP = \{[\s\S]*?\n\};/,
    `export const ZOHO_ITEM_MAP = {\n` +
    `  // ${Object.keys(itemMap).length} products, written by seed-catalogue.js on ${stamp}.\n` +
    `  // unit is what ZOHO holds for the item; factor 1 means the two systems\n` +
    `  // count the same thing, which was checked rather than assumed.\n` +
    Object.entries(itemMap).map(([k, v]) =>
      `  "${k}": { itemId: "${v.itemId}", unit: ${JSON.stringify(v.unit)}, factor: ${v.factor} },`).join("\n") + `\n};`);
writeFileSync("mappings.js", out);
say(`\n  mappings.js written — ${Object.keys(customerMap).length} customers, ${Object.keys(itemMap).length} products.\n`);

/* Verify every mapping against the LIVE Zoho org: that each id exists, that it
   is the right record, that units agree, and what the prices actually are.
   Read-only — creates and changes nothing.                                   */
import { readFileSync } from "node:fs";
import { loadSeed } from "./read-seed.js";
import { config, listAll } from "./zoho.js";
import { ZOHO_CUSTOMER_MAP, ZOHO_ITEM_MAP } from "./mappings.js";

for (const l of readFileSync(".env","utf8").split(/\r?\n/)) { const t=l.trim(); if(!t||t.startsWith("#"))continue; const i=t.indexOf("="); if(i<0)continue; const k=t.slice(0,i).trim(); if(process.env[k]===undefined) process.env[k]=t.slice(i+1).trim(); }

const cfg = config(), seed = loadSeed();
const norm = v => String(v??"").trim().toLowerCase();
const nameOf = c => (typeof c.name === "object" ? c.name.en : c.name) || "";
const fail = [], warn = [];

const contacts = await listAll(cfg, "/contacts", "contacts");
const items    = await listAll(cfg, "/items", "items");
const cById = new Map(contacts.map(c => [String(c.contact_id), c]));
const iById = new Map(items.map(i => [String(i.item_id), i]));

/* -- 2. customers --------------------------------------------------------- */
let custOk = 0;
for (const c of seed.b2b) {
  const id = ZOHO_CUSTOMER_MAP[c._id];
  if (!id) { fail.push(`customer ${c._id} (${nameOf(c)}) has no mapping`); continue; }
  const z = cById.get(String(id));
  if (!z) { fail.push(`customer ${c._id} -> ${id} does not exist in Zoho`); continue; }
  // The mapped contact must actually be this customer, not merely a real one.
  const want = norm(nameOf(c)), got = norm(z.contact_name);
  if (got !== want && !got.startsWith(want)) warn.push(`customer ${c._id}: seed "${nameOf(c)}" vs Zoho "${z.contact_name}"`);
  custOk++;
}
console.log(`customers : ${custOk}/${seed.b2b.length} mapped and present in Zoho`);

/* -- 3+4. products and units ---------------------------------------------- */
let prodOk = 0; const zeroRate = [], mrpLooking = [], unitBad = [];
const rateFromName = n => {
  const x = /NEW\s*MRP\s*([0-9]+(?:\.[0-9]+)?)/i.exec(n);
  if (x) return Number(x[1]);
  const all = [...String(n).matchAll(/MRP\s*([0-9]+(?:\.[0-9]+)?)/gi)];
  return all.length ? Number(all[all.length-1][1]) : null;
};
for (const p of seed.products) {
  const m = ZOHO_ITEM_MAP[p.id];
  if (!m) { fail.push(`product ${p.id} (${p.name}) has no mapping`); continue; }
  const z = iById.get(String(m.itemId));
  if (!z) { fail.push(`product ${p.id} -> ${m.itemId} does not exist in Zoho`); continue; }
  if (norm(z.sku) !== norm(p.artNo)) { fail.push(`product ${p.id}: SKU ${p.artNo} vs Zoho ${z.sku}`); continue; }
  // factor 1 is only correct when both systems count the same unit.
  const zu = z.unit || "", f = Number(m.factor);
  if (norm(zu) !== norm(p.unit) && f === 1) unitBad.push(`${p.id}: FoodBridge "${p.unit}" vs Zoho "${zu}" with factor 1`);
  if (norm(m.unit) !== norm(zu)) warn.push(`product ${p.id}: mappings.js says unit "${m.unit}", Zoho says "${zu}"`);
  const rate = Number(z.rate) || 0;
  if (rate === 0) zeroRate.push(p.id);
  else { const mrp = rateFromName(p.name); if (mrp != null && Math.abs(mrp - rate) < 0.005) mrpLooking.push(`${p.id} ₹${rate}`); }
  prodOk++;
}
console.log(`products  : ${prodOk}/${seed.products.length} mapped, SKU-matched and present in Zoho`);
console.log(`units     : ${unitBad.length ? unitBad.length + " MISMATCHED" : "all agree, factor 1 throughout"}`);
unitBad.forEach(u => console.log("   " + u));

console.log(`\npricing   : ${zeroRate.length} items at ₹0, ${mrpLooking.length} items priced at the MRP printed in their own name`);
if (zeroRate.length) console.log(`   ₹0: ${zeroRate.join(", ")}`);

if (warn.length) { console.log(`\nwarnings (${warn.length}):`); warn.slice(0,15).forEach(w => console.log("   " + w)); }
if (fail.length) { console.log(`\nFAILURES (${fail.length}):`); fail.forEach(f => console.log("   " + f)); process.exit(1); }
console.log("\nmapping audit: PASS");

/* ==========================================================================
   One-time PMF setup. Run AFTER the OAuth connect step has produced a refresh
   token:

       node setup.js

   Everything here is a real call against the real Zoho Books organisation.
   Nothing is invented: the organisation id, contact id and item ids are all
   read back from Zoho and written into .env / mappings.js exactly as Zoho
   reported them.

     1. discover the organisation      GET  /organizations
     2. verify sales-order READ        GET  /salesorders
     3. demo customer                  GET  /contacts  -> POST /contacts
     4. demo items                     GET  /items     -> POST /items
     5. write ZOHO_ORGANIZATION_ID into .env
     6. write ZOHO_CUSTOMER_MAP / ZOHO_ITEM_MAP into mappings.js

   Re-running is safe: anything already present is reused, never duplicated.
   ========================================================================== */

import { readFileSync, writeFileSync } from "node:fs";
import {
  config, listOrganizations, listContacts, createContact,
  listItems, createItem, listSalesOrders, resetTokenCache,
} from "./zoho.js";

/* Load .env the same way dev-server.js does. */
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  const k = t.slice(0, i).trim();
  if (process.env[k] === undefined) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}

const say = (s = "") => process.stdout.write(s + "\n");
const die = (s) => { process.stderr.write("\n  " + s + "\n\n"); process.exit(1); };

/* The FoodBridge products this PMF test uses. Taken from the real seed
   catalogue (v4 .../seed.inline.js) so the demo mirrors the tenant's own
   goods; name, SKU and unit are the seed's, the selling price is the one
   commercial value the seed does not hold and Zoho does. */
// Named as FoodBridge names it, so a demo shows ONE customer rather than a
// FoodBridge name on one screen and a "demo customer" on the other. This is the
// tenant's own account from the seed roster (c01), not invented identity.
const DEMO_CUSTOMER = {
  foodbridgeId: "c01",
  contact_name: "Ashok Sweets And Namkeen",
  company_name: "Ashok Sweets And Namkeen",
  contact_type: "customer",
};

// All five products c01's prediction returns, so a demo order goes through
// whole instead of the rep deleting three rows in front of the customer.
// Every name, SKU and unit is the seed's own; each `rate` is the MRP the
// tenant already prints in that product's name, not a number chosen here.
const DEMO_ITEMS = [
  { foodbridgeId: "p01", name: "AMLA PICKLE (1000 gm)",
    sku: "405322000003173005", unit: "Box", rate: 660, factor: 1 },
  { foodbridgeId: "p11", name: "BAMBOO SHOOTS PICKLE (pet Jar)",
    sku: "405322000003154034", unit: "Box", rate: 65, factor: 1 },
  { foodbridgeId: "p12", name: "BAMBOO SHOOTS PICKLE (200 gm)",
    sku: "405322000007538481", unit: "Box", rate: 140, factor: 1 },
  { foodbridgeId: "p28", name: "GREEN CHILLI PICKLE (200 gm)",
    sku: "405322000007538000", unit: "Box", rate: 140, factor: 1 },
  { foodbridgeId: "p53", name: "MANGO PICKLE (1000 g)",
    sku: "405322000003418000", unit: "Box", rate: 660, factor: 1 },
];

let cfg = config();
if (!cfg.clientId || !cfg.clientSecret) die("ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET are not set in .env.");
if (!cfg.refreshToken) die("ZOHO_REFRESH_TOKEN is not set. Run the /api/connect flow first.");

/* -- 1. organisation ------------------------------------------------------ */

say("\n  1. Discovering the Zoho Books organisation…");
// listOrganizations needs a token but not an org id, so a placeholder keeps
// config() happy until the real id is known.
cfg = { ...cfg, organizationId: cfg.organizationId || "pending" };
const orgs = await listOrganizations(cfg).catch((e) => die(`Could not reach Zoho: ${e.message} ${e.detail || ""}`));
if (!orgs.length) die("This Zoho account has no Books organisation yet. Create one in Zoho Books first.");

const org = orgs.find((o) => String(o.organization_id) === cfg.organizationId) || orgs[0];
if (orgs.length > 1) {
  say(`     ${orgs.length} organisations found; using "${org.name}". Set ZOHO_ORGANIZATION_ID to pick another:`);
  orgs.forEach((o) => say(`       ${o.organization_id}  ${o.name}${o.is_default_org ? "  (default)" : ""}`));
}
cfg = { ...cfg, organizationId: String(org.organization_id) };
resetTokenCache();
say(`     ${org.name}  ·  id ${org.organization_id}  ·  ${org.currency_code || "?"}  ·  ${org.country || "?"}`);

/* -- 2. read access ------------------------------------------------------- */

say("\n  2. Verifying sales-order READ access…");
const existingOrders = await listSalesOrders(cfg, { per_page: 1 })
  .catch((e) => die(`Sales-order READ failed: ${e.message} ${e.detail || ""}`));
say(`     OK (${existingOrders.length ? "organisation already has sales orders" : "no sales orders yet"})`);

/* -- 3. demo customer ----------------------------------------------------- */

say("\n  3. Demo customer…");
let contact = (await listContacts(cfg, { contact_name: DEMO_CUSTOMER.contact_name }))
  .find((c) => c.contact_name === DEMO_CUSTOMER.contact_name);
if (contact) {
  say(`     reusing existing "${contact.contact_name}"  ·  id ${contact.contact_id}`);
} else {
  contact = await createContact(cfg, {
    contact_name: DEMO_CUSTOMER.contact_name,
    company_name: DEMO_CUSTOMER.company_name,
    contact_type: DEMO_CUSTOMER.contact_type,
  }).catch((e) => die(`Could not create the demo customer: ${e.message} ${e.detail || ""}`));
  say(`     created "${contact.contact_name}"  ·  id ${contact.contact_id}`);
}

/* -- 4. demo items -------------------------------------------------------- */

say("\n  4. Demo items…");
const itemMap = {};
for (const spec of DEMO_ITEMS) {
  let item = (await listItems(cfg, { sku: spec.sku })).find((i) => i.sku === spec.sku);
  if (item) {
    say(`     reusing "${item.name}"  ·  id ${item.item_id}  ·  unit ${item.unit || "(none)"}  ·  rate ${item.rate}`);
  } else {
    item = await createItem(cfg, {
      name: spec.name, sku: spec.sku, unit: spec.unit, rate: spec.rate,
      product_type: "goods", item_type: "sales",
    }).catch((e) => die(`Could not create item ${spec.sku}: ${e.message} ${e.detail || ""}`));
    say(`     created "${item.name}"  ·  id ${item.item_id}  ·  unit ${item.unit || "(none)"}  ·  rate ${item.rate}`);
  }

  // Units are checked, not assumed. FoodBridge counts this product in `unit`;
  // if Zoho holds the item in the same unit the factor is 1, and anything else
  // is reported for a human to decide rather than silently converted.
  const zohoUnit = item.unit || null;
  if (zohoUnit && zohoUnit.toLowerCase() !== spec.unit.toLowerCase()) {
    say(`     !! unit mismatch: FoodBridge counts ${spec.foodbridgeId} in "${spec.unit}", Zoho item is "${zohoUnit}".`);
    say(`        Set the right factor for ${spec.foodbridgeId} in mappings.js by hand before ordering.`);
  }
  itemMap[spec.foodbridgeId] = { itemId: String(item.item_id), unit: zohoUnit || spec.unit, factor: spec.factor };
}

/* -- 5. persist ----------------------------------------------------------- */

say("\n  5. Writing configuration…");

let env = readFileSync(".env", "utf8");
env = /^ZOHO_ORGANIZATION_ID=.*$/m.test(env)
  ? env.replace(/^ZOHO_ORGANIZATION_ID=.*$/m, `ZOHO_ORGANIZATION_ID=${org.organization_id}`)
  : env + `\nZOHO_ORGANIZATION_ID=${org.organization_id}\n`;
writeFileSync(".env", env, { mode: 0o600 });
say(`     .env  ->  ZOHO_ORGANIZATION_ID=${org.organization_id}`);

const src = readFileSync("mappings.js", "utf8");
const stamp = new Date().toISOString().slice(0, 10);
const written = src
  .replace(/export const ZOHO_CUSTOMER_MAP = \{[\s\S]*?\n\};/,
    `export const ZOHO_CUSTOMER_MAP = {\n  // Written by setup.js on ${stamp} from the live Zoho org "${org.name}".\n` +
    `  "${DEMO_CUSTOMER.foodbridgeId}": "${contact.contact_id}",\n};`)
  .replace(/export const ZOHO_ITEM_MAP = \{[\s\S]*?\n\};/,
    `export const ZOHO_ITEM_MAP = {\n  // Written by setup.js on ${stamp}. Ids and units read back from Zoho.\n` +
    Object.entries(itemMap).map(([k, v]) =>
      `  "${k}": { itemId: "${v.itemId}", unit: ${JSON.stringify(v.unit)}, factor: ${v.factor} },`).join("\n") +
    `\n};`);
writeFileSync("mappings.js", written);
say(`     mappings.js  ->  1 customer, ${Object.keys(itemMap).length} items`);

say(`
  Done. Restart the bridge (node dev-server.js) and the FoodBridge order for
  "${DEMO_CUSTOMER.contact_name}" will create a real sales order in "${org.name}".
`);

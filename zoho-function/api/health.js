/* GET /api/health — is this bridge ready? Names of missing settings only,
   never values, so it is safe to open in a browser. */

import { config, missingConfig, SCOPES } from "../zoho.js";
import { ZOHO_CUSTOMER_MAP, ZOHO_ITEM_MAP } from "../mappings.js";
import { cors, json } from "./_http.js";

export default function handler(req, res) {
  if (cors(req, res)) return;
  const cfg = config();
  const missing = missingConfig(cfg);
  return json(res, 200, {
    product: "Zoho Books",
    configured: missing.length === 0,
    missing,
    accountsUrl: cfg.accountsUrl,
    apiBaseUrl: cfg.apiBaseUrl,
    organizationIdConfigured: !!cfg.organizationId,
    deepLinkConfigured: !!cfg.salesOrderUrl,
    scopes: SCOPES,
    mappedCustomers: Object.keys(ZOHO_CUSTOMER_MAP).length,
    mappedProducts: Object.keys(ZOHO_ITEM_MAP).length,
  });
}

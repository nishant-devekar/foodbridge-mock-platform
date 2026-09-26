/* GET /api/health — is this bridge ready? Names of missing settings only,
   never values, so it is safe to open in a browser. */

import { config, missingConfig, SCOPES } from "../zoho.js";
import { ZOHO_CUSTOMER_MAP, ZOHO_ITEM_MAP } from "../mappings.js";
import { gstConfig, missingGstConfig } from "../gst.js";
import { feedbackStore } from "../feedback.js";
import { storesStore, storesConfig } from "../stores.js";
import { emailReady, emailConfig } from "../stores-email.js";
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
    /* GST verification is a separate integration on the same bridge. S01 is
       blocked on it, so its readiness is reported here too. */
    gst: {
      configured: missingGstConfig(gstConfig()).length === 0,
      missing: missingGstConfig(gstConfig()),
      baseUrl: gstConfig().baseUrl,
    },
    /* Demo feedback is stored by this bridge too. "none" means a browser's
       entries stay queued in that browser rather than reaching anyone — which
       is worth being able to see without submitting a form to find out. */
    feedback: {
      store: feedbackStore(),
      configured: feedbackStore() !== "none",
      missing: feedbackStore() === "none" ? ["FB_FEEDBACK_KV_URL", "FB_FEEDBACK_KV_TOKEN"] : [],
    },
    /* Stores built in Store Builder land here for the customer success team.
       "blob" without a team key accepts builds but refuses to list them. */
    stores: {
      store: storesStore(),
      configured: storesStore() !== "none",
      teamKey: !!storesConfig().teamKey,
      email: emailReady() ? { to: emailConfig().to.length, verifiedSender: !!process.env.FB_STORES_EMAIL_FROM } : false,
      missing: [storesStore() === "none" ? "BLOB_READ_WRITE_TOKEN" : "", storesStore() === "blob" && !storesConfig().teamKey ? "FB_STORES_KEY" : ""].filter(Boolean),
    },
  });
}

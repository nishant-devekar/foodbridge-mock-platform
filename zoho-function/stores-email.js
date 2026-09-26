/* ==========================================================================
   STORES EMAIL — every built store's Excel, emailed to the team as well.

   A backup beside the file store (stores.js), and the fallback while there
   is none: the first request of a build carries the Excel and setup.json,
   and they go out as attachments with a summary of the store.

   Resend over its REST API (https://resend.com), fetch-only like the rest of
   this bridge, when RESEND_API_KEY and FB_STORES_EMAIL_TO are set. The
   addresses live in the environment, never in this public repo.

     RESEND_API_KEY          re_…  (resend.com → API Keys)
     FB_STORES_EMAIL_TO      comma-separated addresses
     FB_STORES_EMAIL_FROM    a sender on a domain verified in Resend, e.g.
                             "FoodBridge Store Builder <stores@foodbridge.io>".
                             Without it Resend's own onboarding@resend.dev is
                             used, which delivers ONLY to the Resend account's
                             own address -- fine for a first test, not for a team.
   ========================================================================== */

const API = "https://api.resend.com/emails";
const TEAM_PAGE = "https://nishant-devekar.github.io/foodbridge-mock-platform/v7/stores.html";

export function emailConfig() {
  return {
    key: process.env.RESEND_API_KEY || "",
    to: String(process.env.FB_STORES_EMAIL_TO || "").split(",").map((s) => s.trim()).filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)),
    from: process.env.FB_STORES_EMAIL_FROM || "FoodBridge Store Builder <onboarding@resend.dev>",
  };
}
export function emailReady(cfg) { const c = cfg || emailConfig(); return !!(c.key && c.to.length); }

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** The message for one build: what the team needs to call the distributor, and the files. */
export function buildEmail(u, cfg) {
  const m = u.meta || {};
  const c = m.counts || {};
  const who = [m.owner, m.mobile].filter(Boolean).join(", ");
  const row = (k, v) => "<tr><td style=\"padding:4px 14px 4px 0;color:#6b7079\">" + esc(k) + "</td><td style=\"padding:4px 0\"><b>" + esc(v) + "</b></td></tr>";
  const html =
    "<div style=\"font:14px/1.5 system-ui,sans-serif;color:#0d0f12\">" +
    "<p>A distributor tapped <b>Build my store</b> in Store Builder. The Excel is attached; setup.json reopens the whole session.</p>" +
    "<table style=\"border-collapse:collapse\">" +
    row("Shop", m.shop || "No shop name yet") + (who ? row("Owner", who) : "") + (m.gst ? row("GST", m.gst) : "") +
    row("Products", c.products || 0) + row("Customers", c.customers || 0) + row("Suppliers", c.suppliers || 0) + row("Staff", c.staff || 0) +
    row("Stock counted", c.counted || 0) + row("Questions answered", (c.answered || 0) + " of 7") + row("To follow up", c.gaps || 0) +
    row("Photos & voice", c.photos || 0) + row("Built", m.at ? new Date(m.at).toUTCString() : "") + row("Id", u.id) +
    "</table>" +
    "<p>Every file, photos included, is on the team page: <a href=\"" + TEAM_PAGE + "\">Built stores</a>.</p></div>";
  return {
    from: cfg.from,
    to: cfg.to,
    subject: "New store built: " + (m.shop || "no shop name yet") + (who ? " (" + who + ")" : ""),
    html: html,
    attachments: u.files.filter((f) => /\.xlsx$|^setup\.json$/.test(f.name)).map((f) => ({
      filename: f.name === "setup.json" ? u.id + "-setup.json" : f.name,
      content: f.bytes.toString("base64"),
    })),
  };
}

/** Sends it. Throws when Resend does not accept it, so the caller knows. */
export async function emailBuild(u, cfg) {
  const c = cfg || emailConfig();
  if (!emailReady(c)) throw new Error("email_not_configured");
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: "Bearer " + c.key, "Content-Type": "application/json" },
    body: JSON.stringify(buildEmail(u, c)),
  }).catch(() => null);
  if (!res || !res.ok) throw new Error("email_refused " + (res ? res.status : "network"));
  return true;
}

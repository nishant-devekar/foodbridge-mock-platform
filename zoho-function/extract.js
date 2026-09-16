/* ==========================================================================
   Reading a PHOTO of business paper into rows -- S03's "Add later" items.

   A user can photograph invoices, payment receipts or a price list with cost
   prices. The page sends the image here; this asks Claude to read it and hand
   back rows through a strict tool, so the result is schema-valid JSON or
   nothing. The page then puts those rows through the same checks as a file.

   Honest by construction:
     · only rows clearly visible are returned; an unreadable photo is "no rows",
       never a guess
     · no ANTHROPIC_API_KEY  → not_configured, and the page says photos cannot
       be read yet
     · a refusal, or a reply with no tool call → unreadable

   The key stays in this bridge's environment. The base URL is fixed to
   Anthropic's API unless FB_ANTHROPIC_BASE_URL says otherwise, so a stray
   ANTHROPIC_BASE_URL in the shell that starts the bridge is never inherited.
   ========================================================================== */

import Anthropic from "@anthropic-ai/sdk";

export const EXTRACT_MODEL = "claude-opus-5";
export const KINDS = ["invoices", "payments", "costs"];

export class ExtractError extends Error {
  constructor(reason, status) { super(reason); this.reason = reason; this.status = status || 502; }
}

const nullable = (type) => ({ type: [type, "null"] });

const SCHEMAS = {
  invoices: {
    what: "invoices the business issued to its customers",
    row: {
      date: { type: "string", description: "Invoice date as YYYY-MM-DD" },
      customer: { type: "string", description: "The customer billed" },
      total: { type: "number", description: "Invoice total" },
      balance: { ...nullable("number"), description: "Amount still due, if shown" },
      number: { ...nullable("string"), description: "Invoice number, if shown" },
      due_date: { ...nullable("string"), description: "Due date as YYYY-MM-DD, if shown" },
    },
  },
  payments: {
    what: "payments the business received from its customers",
    row: {
      date: { type: "string", description: "Payment date as YYYY-MM-DD" },
      customer: { type: "string", description: "The customer who paid" },
      amount: { type: "number", description: "Amount received" },
    },
  },
  costs: {
    what: "products with the price the business PAYS for them (cost / purchase price, not the selling price)",
    row: {
      product: { type: "string", description: "Product name as written" },
      sku: { ...nullable("string"), description: "Product code or SKU, if shown" },
      cost: { type: "number", description: "Cost or purchase price per unit" },
    },
  },
};

function toolFor(kind) {
  const s = SCHEMAS[kind];
  return {
    name: "record_rows",
    description: `Record every row of ${s.what} that is clearly legible in the photo. Return an empty list if there are none or the photo cannot be read.`,
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        rows: {
          type: "array",
          items: { type: "object", properties: s.row, required: Object.keys(s.row), additionalProperties: false },
        },
      },
      required: ["rows"],
      additionalProperties: false,
    },
  };
}

let client = null;
function defaultClient(env = process.env) {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.FB_ANTHROPIC_BASE_URL || "https://api.anthropic.com" });
  return client;
}

const isoDate = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);

/* The model's rows → the page's record shape (dataset.js), dropping any row
   without what that kind needs and counting it. */
export function toRecords(kind, rows) {
  const records = [];
  let skipped = 0;
  (rows || []).forEach((r, i) => {
    const row = i + 1;
    if (kind === "invoices") {
      const date = isoDate(r.date), total = num(r.total);
      if (!date || !r.customer || total === null) return skipped++;
      const rec = { date, customer: String(r.customer).trim(), total, row };
      if (num(r.balance) !== null) rec.balance = r.balance;
      if (r.number) rec.number = String(r.number);
      if (isoDate(r.due_date)) rec.dueDate = r.due_date;
      records.push(rec);
    } else if (kind === "payments") {
      const date = isoDate(r.date), amount = num(r.amount);
      if (!date || !r.customer || amount === null) return skipped++;
      records.push({ date, customer: String(r.customer).trim(), amount, row });
    } else if (kind === "costs") {
      const cost = num(r.cost);
      if (!r.product || cost === null) return skipped++;
      const rec = { name: String(r.product).trim(), cost, row };
      if (r.sku) rec.sku = String(r.sku);
      records.push(rec);
    }
  });
  return { records, skipped: skipped ? [{ reason: "unreadable_row", count: skipped }] : [] };
}

export async function extractPhoto({ kind, mediaType, data }, { anthropic = defaultClient() } = {}) {
  if (!KINDS.includes(kind)) throw new ExtractError("bad_request", 400);
  if (!/^image\/(jpeg|png|webp|gif)$/.test(String(mediaType || ""))) throw new ExtractError("bad_request", 400);
  if (typeof data !== "string" || !data.length) throw new ExtractError("bad_request", 400);
  if (!anthropic) throw new ExtractError("not_configured", 503);

  let response;
  try {
    response = await anthropic.beta.messages.create({
      model: EXTRACT_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      tools: [toolFor(kind)],
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data } },
          { type: "text", text:
            `This is a photo a distributor took of their own business paper. Read the ${SCHEMAS[kind].what} ` +
            "and call record_rows once with every row that is clearly legible. Only include what the photo shows: " +
            "if a required value for a row is not legible, leave that row out. Write dates as YYYY-MM-DD and amounts as " +
            "plain numbers without currency symbols. If the photo shows none, call record_rows with an empty list." },
        ],
      }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new ExtractError("not_configured", 503);
    if (e instanceof Anthropic.RateLimitError) throw new ExtractError("busy", 429);
    if (e instanceof Anthropic.BadRequestError) throw new ExtractError("unreadable", 422);
    throw new ExtractError("unavailable", 502);
  }

  if (response.stop_reason === "refusal") throw new ExtractError("unreadable", 422);
  const call = (response.content || []).find((b) => b.type === "tool_use" && b.name === "record_rows");
  if (!call || !call.input || !Array.isArray(call.input.rows)) throw new ExtractError("unreadable", 422);
  return toRecords(kind, call.input.rows);
}

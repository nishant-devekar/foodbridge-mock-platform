/* ==========================================================================
   FEEDBACK — what a demo user said, kept where it can be read back.

   The demo ends with three ways on (see v7/assets/exit-demo.js). One of them
   is "Give feedback", and the point of asking is being able to read the
   answers later, so this file is about STORAGE and nothing else.

   TWO STORES, one interface:

     Upstash Redis over its REST API, when FB_FEEDBACK_KV_URL and
     FB_FEEDBACK_KV_TOKEN are set. HTTP, so it works on Vercel's serverless
     runtime with no TCP socket and no dependency — the same fetch-only style
     as the rest of this bridge. Entries are RPUSHed onto one list.

     A local JSONL file otherwise, when the filesystem is writable — which is
     true when this runs from dev-server.js and false on Vercel. This is what
     makes `npm run dev` a complete loop: submit a form, read
     zoho-function/feedback.jsonl.

   NEITHER CONFIGURED is not silent. store() throws `not_configured`, the
   route answers 503, and the browser keeps the entry in its own queue and
   retries — so an unconfigured deployment DELAYS feedback rather than
   dropping it. Nothing here ever reports a save that did not happen.
   ========================================================================== */

import { appendFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const LIST_KEY = "fb:v7:feedback";
const FILE = resolve(process.env.FB_FEEDBACK_FILE || "feedback.jsonl");

export class FeedbackError extends Error {
  constructor(reason, status, message) {
    super(message || reason);
    this.reason = reason;
    this.status = status || 500;
  }
}

export function feedbackConfig() {
  return {
    kvUrl: (process.env.FB_FEEDBACK_KV_URL || "").replace(/\/+$/, ""),
    kvToken: process.env.FB_FEEDBACK_KV_TOKEN || "",
    file: FILE,
  };
}

/** Which store is live, by name — reported by /api/health so a deployment can
    be asked what it will do BEFORE somebody types a paragraph into the form. */
export function feedbackStore(cfg) {
  const c = cfg || feedbackConfig();
  if (c.kvUrl && c.kvToken) return "kv";
  return writable() ? "file" : "none";
}

function writable() {
  /* Vercel's runtime has a read-only filesystem outside /tmp; a local run does
     not. Asking rather than guessing keeps one code path for both. */
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    appendFileSync(FILE, "");
    return true;
  } catch {
    return false;
  }
}

/* ── Shape ────────────────────────────────────────────────────────────────
   Held deliberately small, and validated here rather than trusted from the
   page: this endpoint is open to anyone who can reach it. */
export function cleanEntry(body) {
  const b = body || {};
  const str = (v, max) => String(v == null ? "" : v).trim().replace(/\s+/g, " ").slice(0, max);
  const phone = String(b.phone == null ? "" : b.phone).replace(/\D/g, "").slice(-10);
  const rating = Number(b.rating);

  if (!(rating >= 1 && rating <= 5)) throw new FeedbackError("bad_rating", 400, "Rating must be 1 to 5.");

  /* WHEN IT WAS SAID, not when it arrived. An entry the browser could not
     deliver — no route yet, no network — is sent on the next visit, which may
     be days later; stamping arrival time would file it under the wrong day and
     lose the order people gave it in. The browser's clock is not trusted
     blindly: it is taken only when it parses and falls inside a sane window,
     and `received` keeps the arrival time whenever the two differ. */
  const now = Date.now();
  const said = Date.parse(b.at);
  const trusted = Number.isFinite(said) && said <= now + 5 * 60e3 && said > now - 180 * 864e5;
  const at = new Date(trusted ? said : now).toISOString();
  const received = new Date(now).toISOString();

  return {
    id: "FB-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
    at: at,
    ...(at === received ? {} : { received: received }),
    rating: Math.round(rating),
    comment: str(b.comment, 1200),
    name: str(b.name, 80),
    phone: phone ? "+91 " + phone : "",
    /* Where they were when they were asked, so a complaint can be read against
       the screen that prompted it. */
    screen: str(b.screen, 120),
    version: str(b.version, 24) || "v7",
  };
}

/* ── Write ─────────────────────────────────────────────────────────────── */
export async function store(entry) {
  const cfg = feedbackConfig();
  const where = feedbackStore(cfg);

  if (where === "kv") {
    const res = await fetch(cfg.kvUrl + "/rpush/" + encodeURIComponent(LIST_KEY), {
      method: "POST",
      headers: { Authorization: "Bearer " + cfg.kvToken, "Content-Type": "application/json" },
      body: JSON.stringify(JSON.stringify(entry)),
    }).catch(() => null);
    if (!res || !res.ok) {
      throw new FeedbackError("store_unavailable", 502, "The feedback store did not accept the entry.");
    }
    return entry;
  }

  if (where === "file") {
    appendFileSync(FILE, JSON.stringify(entry) + "\n", "utf8");
    return entry;
  }

  throw new FeedbackError("not_configured", 503,
    "No feedback store on this deployment. Set FB_FEEDBACK_KV_URL and FB_FEEDBACK_KV_TOKEN.");
}

/* ── Read ──────────────────────────────────────────────────────────────── */
export async function list(limit) {
  const cfg = feedbackConfig();
  const where = feedbackStore(cfg);
  const n = Math.min(Math.max(Number(limit) || 200, 1), 1000);

  if (where === "kv") {
    const res = await fetch(cfg.kvUrl + "/lrange/" + encodeURIComponent(LIST_KEY) + "/-" + n + "/-1", {
      headers: { Authorization: "Bearer " + cfg.kvToken },
    }).catch(() => null);
    if (!res || !res.ok) throw new FeedbackError("store_unavailable", 502, "Could not read the feedback store.");
    const body = await res.json().catch(() => ({}));
    const rows = Array.isArray(body.result) ? body.result : [];
    return rows.map(parse).filter(Boolean).reverse();
  }

  if (where === "file") {
    if (!existsSync(FILE)) return [];
    return readFileSync(FILE, "utf8").split(/\r?\n/).filter(Boolean).map(parse).filter(Boolean).slice(-n).reverse();
  }

  throw new FeedbackError("not_configured", 503, "No feedback store on this deployment.");
}

function parse(line) {
  try { return typeof line === "string" ? JSON.parse(line) : line; } catch { return null; }
}

/* ==========================================================================
   JOURNEYS — how far each tester got on a flow sent from the Store Flow
   Editor (v10/ux/store-flow-editor.html), for the team that wrote it.
   (17 Oct 2026)

   The editor sends a flow to testers as a tower link that carries a trial
   id. A tester who presses Apply in the tower reports where they stand on
   that flow each time it changes: every step's state, when it opened and
   when it was done. The editor reads all testers of a trial back and draws
   them on the steps. This file is about STORAGE, the same shape as
   stores.js, and uses the same two stores:

     Vercel Blob, PRIVATE, when BLOB_READ_WRITE_TOKEN is set; reading goes
     through this bridge behind the team key (FB_STORES_KEY).
     A local folder otherwise (journeys-data/), from dev-server.js.

   One file per tester per trial, overwritten with the latest report:
     journeys/<trial>/<tester>.json
   ========================================================================== */

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { storesConfig, StoresError } from "./stores.js";

const PREFIX = "journeys/";
const TRIAL = /^T-[a-z0-9]{6,16}$/;
const TESTER = /^d-[a-z0-9]{6,24}$/;
const NODE = /^[A-Za-z0-9_.:-]{1,80}$/;
const STATES = ["locked", "open", "enough", "done", "skipped"];
const MAX_NODES = 300;

export function journeysConfig() {
  const c = storesConfig();
  return { token: c.token, teamKey: c.teamKey, dir: resolve(process.env.FB_JOURNEYS_DIR || "journeys-data") };
}
export function journeysStore(cfg) {
  const c = cfg || journeysConfig();
  if (c.token) return "blob";
  try { mkdirSync(c.dir, { recursive: true }); writeFileSync(join(c.dir, ".probe"), ""); return "file"; } catch { return "none"; }
}
/* The team key, as for stores. A local folder needs none: whoever runs the
   bridge can read the folder anyway. */
export function teamOk(req, cfg) {
  const c = cfg || journeysConfig();
  const where = journeysStore(c);
  if (where === "file") return true;
  if (!c.teamKey) return false;
  const got = req.headers["x-fb-team"] || "";
  return typeof got === "string" && got.length === c.teamKey.length && got === c.teamKey;
}

/* ── Shape ────────────────────────────────────────────────────────────────
   Anyone who can reach the bridge can post, so a report is rebuilt from
   what is allowed, never stored as sent. Times are the tester's clock,
   taken only inside a sane window. */
export function cleanReport(body) {
  const b = body || {};
  const trial = String(b.trial || ""), tester = b.tester || {};
  if (!TRIAL.test(trial)) throw new StoresError("bad_trial", 400, "Not a trial id.");
  if (!TESTER.test(String(tester.id || ""))) throw new StoresError("bad_tester", 400, "Not a tester id.");
  const now = Date.now();
  const str = (v, max) => String(v == null ? "" : v).trim().replace(/\s+/g, " ").slice(0, max);
  const time = (v) => { const t = Number(v); return Number.isFinite(t) && t > now - 365 * 864e5 && t <= now + 5 * 60e3 ? Math.round(t) : null; };
  const states = {}, opened = {}, done = {};
  const ids = Object.keys(b.states && typeof b.states === "object" ? b.states : {});
  if (!ids.length) throw new StoresError("no_steps", 400, "No steps in the report.");
  if (ids.length > MAX_NODES) throw new StoresError("too_large", 413, "Too many steps.");
  ids.forEach((id) => { if (NODE.test(id) && STATES.indexOf(b.states[id]) !== -1) states[id] = b.states[id]; });
  [["opened", opened], ["doneAt", done]].forEach(([k, out]) => {
    const src = b[k] && typeof b[k] === "object" ? b[k] : {};
    Object.keys(src).forEach((id) => { const t = time(src[id]); if (states[id] && t != null) out[id] = t; });
  });
  const flow = b.flow || {};
  return {
    trial: trial,
    tester: { id: String(tester.id), name: str(tester.name, 60) },
    flow: { id: str(flow.id, 60), version: str(flow.version, 24) },
    mode: b.mode === "trading" ? "trading" : "new",
    states: states, opened: opened, doneAt: done,
    focus: NODE.test(String(b.focus || "")) && states[b.focus] ? b.focus : null,
    since: time(b.since),
    at: time(b.at) || now,
    received: now,
  };
}

/* ── Blob ──────────────────────────────────────────────────────────────── */
async function blobSdk() {
  try { return await import("@vercel/blob"); }
  catch { throw new StoresError("not_configured", 503, "The @vercel/blob package is not installed on this deployment."); }
}

/* ── Write: the tester's latest report replaces the last one ───────────── */
export async function save(r) {
  const cfg = journeysConfig(), where = journeysStore(cfg);
  const path = r.trial + "/" + r.tester.id + ".json", body = JSON.stringify(r);
  if (where === "blob") {
    const sdk = await blobSdk();
    try { await sdk.put(PREFIX + path, body, { access: "private", token: cfg.token, contentType: "application/json", addRandomSuffix: false, allowOverwrite: true }); }
    catch { throw new StoresError("store_unavailable", 502, "The store did not accept it."); }
    return;
  }
  if (where === "file") {
    mkdirSync(join(cfg.dir, r.trial), { recursive: true });
    writeFileSync(join(cfg.dir, path), body);
    return;
  }
  throw new StoresError("not_configured", 503, "No store on this deployment. Set BLOB_READ_WRITE_TOKEN.");
}

/* ── Read: every tester of one trial, the most recent first ────────────── */
export async function list(trial) {
  if (!TRIAL.test(String(trial || ""))) throw new StoresError("bad_trial", 400, "Not a trial id.");
  const cfg = journeysConfig(), where = journeysStore(cfg), out = [];
  if (where === "blob") {
    const sdk = await blobSdk();
    try {
      let cursor; const paths = [];
      do {
        const page = await sdk.list({ prefix: PREFIX + trial + "/", token: cfg.token, cursor: cursor, limit: 1000 });
        page.blobs.forEach((b) => paths.push(b.pathname));
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      await Promise.all(paths.map(async (p) => {
        const r = await sdk.get(p, { access: "private", token: cfg.token, useCache: false }).catch(() => null);
        if (r && r.stream) { try { out.push(JSON.parse(await new Response(r.stream).text())); } catch { /* skip a torn file */ } }
      }));
    } catch (e) {
      if (e instanceof StoresError) throw e;
      throw new StoresError("store_unavailable", 502, "Could not read the store.");
    }
  } else if (where === "file") {
    const d = join(cfg.dir, trial);
    if (existsSync(d)) readdirSync(d).filter((n) => /\.json$/.test(n)).forEach((n) => { try { out.push(JSON.parse(readFileSync(join(d, n), "utf8"))); } catch { /* skip */ } });
  } else {
    throw new StoresError("not_configured", 503, "No store on this deployment.");
  }
  return out.sort((a, b) => (b.at || 0) - (a.at || 0));
}

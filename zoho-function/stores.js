/* ==========================================================================
   STORES — every store built in Store Builder, kept where FoodBridge's
   customer success team can open it.

   The phone sends its build here file by file (the Excel, setup.json, each
   photo and voice note) and keeps nothing once they have arrived. The team
   reads them back from v7/stores.html. That makes this file about STORAGE
   and nothing else, the same shape as feedback.js.

   TWO STORES, one interface:

     Vercel Blob, PRIVATE, when BLOB_READ_WRITE_TOKEN is set. A distributor's
     customers, phone numbers and GST are in these files, so nothing here is
     ever public: reading goes through this bridge, behind FB_STORES_KEY.
     The SDK is loaded only on this path, so a local run needs no install.

     A local folder otherwise (stores-data/), when the filesystem is writable
     -- true from dev-server.js, false on Vercel. `npm run dev` is then a
     complete loop: build a store, read zoho-function/stores-data/.

   NEITHER CONFIGURED is not silent: `not_configured`, 503, and the phone
   keeps the files in its queue and tries again. Nothing here reports a save
   that did not happen.

   Layout, in both stores:  stores/<id>/meta.json   what the list shows
                            stores/<id>/<file>      what was sent
   ========================================================================== */

import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const PREFIX = "stores/";
export const MAX_FILE = 3 * 1024 * 1024;   // a file per request keeps each body under Vercel's 4.5 MB

export class StoresError extends Error {
  constructor(reason, status, message) {
    super(message || reason);
    this.reason = reason;
    this.status = status || 500;
  }
}

export function storesConfig() {
  return { token: process.env.BLOB_READ_WRITE_TOKEN || "", teamKey: process.env.FB_STORES_KEY || "", dir: resolve(process.env.FB_STORES_DIR || "stores-data") };
}

/** Which store is live, by name -- reported by /api/health. */
export function storesStore(cfg) {
  const c = cfg || storesConfig();
  if (c.token) return "blob";
  return writable(c.dir) ? "file" : "none";
}

function writable(dir) {
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, ".probe"), "");
    return true;
  } catch {
    return false;
  }
}

/* Reading is the team's side. It needs FB_STORES_KEY -- except from a local
   folder, where whoever can run the bridge can read the folder anyway. A
   deployment with Blob and no key refuses to list rather than list to anyone. */
export function teamOk(req, cfg) {
  const c = cfg || storesConfig();
  if (!c.teamKey) return storesStore(c) === "file";
  const got = req.headers["x-fb-team"] || "";
  return typeof got === "string" && got.length === c.teamKey.length && got === c.teamKey;
}

/* ── Shape ────────────────────────────────────────────────────────────────
   Validated here, not trusted from the page: anyone who can reach the bridge
   can post. Ids and file names are held to a pattern, so nothing a phone sends
   can climb out of its own folder. */
const ID = /^SB-[a-z0-9]{6,14}-[a-z0-9]{4,10}$/;
const NAME = /^(setup\.json|[A-Za-z0-9ऀ-ॿ._-]{1,120}\.xlsx|photos\/[A-Za-z0-9_-]{1,40}\.(jpg|png|webp)|voice\/[A-Za-z0-9_-]{1,40}\.(webm|ogg|m4a|mp4|mp3|wav|aac))$/;
const TYPES = { xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", json: "application/json",
  jpg: "image/jpeg", png: "image/png", webp: "image/webp", webm: "audio/webm", ogg: "audio/ogg", m4a: "audio/mp4",
  mp4: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav", aac: "audio/aac" };

export function typeOf(name) { return TYPES[String(name).split(".").pop().toLowerCase()] || "application/octet-stream"; }

export function cleanUpload(body) {
  const b = body || {};
  const id = String(b.id || "");
  if (!ID.test(id)) throw new StoresError("bad_id", 400, "Not a Store Builder id.");
  const out = { id: id };

  if (b.meta) out.meta = cleanMeta(b.meta, id);

  /* One file, or a few small ones together (the first request of a build
     carries the Excel and setup.json, so the email backup has both). */
  const list = (Array.isArray(b.files) ? b.files : []).concat(b.file ? [b.file] : []);
  let total = 0;
  out.files = list.map(function (f) {
    const name = String((f && f.name) || "");
    if (!NAME.test(name)) throw new StoresError("bad_name", 400, "Not a file Store Builder sends.");
    const bytes = Buffer.from(String(f.data || ""), "base64");
    if (!bytes.length) throw new StoresError("empty_file", 400, "The file is empty.");
    total += bytes.length;
    if (bytes.length > MAX_FILE || total > MAX_FILE) throw new StoresError("too_large", 413, "Over " + (MAX_FILE >> 20) + " MB.");
    return { name: name, type: typeOf(name), bytes: bytes };
  });
  if (!out.meta && !out.files.length) throw new StoresError("nothing_sent", 400, "Neither a summary nor a file.");
  return out;
}

function cleanMeta(m, id) {
  const str = (v, max) => String(v == null ? "" : v).trim().replace(/\s+/g, " ").slice(0, max);
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : 0);
  /* WHEN IT WAS BUILT, not when it arrived -- the phone may send a day later.
     Its clock is taken only inside a sane window; arrival is kept beside it. */
  const now = Date.now();
  const built = Date.parse(m.at);
  const trusted = Number.isFinite(built) && built <= now + 5 * 60e3 && built > now - 180 * 864e5;
  const c = m.counts || {};
  return {
    id: id,
    at: new Date(trusted ? built : now).toISOString(),
    received: new Date(now).toISOString(),
    shop: str(m.shop, 80),
    owner: str(m.owner, 80),
    mobile: str(m.mobile, 20),
    gst: str(m.gst, 20),
    type: str(m.type, 24),
    counts: { products: num(c.products), customers: num(c.customers), suppliers: num(c.suppliers), staff: num(c.staff),
      counted: num(c.counted), answered: num(c.answered), photos: num(c.photos), gaps: num(c.gaps) },
    files: (Array.isArray(m.files) ? m.files : []).map((f) => str(f, 140)).filter((f) => NAME.test(f)).slice(0, 200),
    lang: str(m.lang, 4),
    version: str(m.version, 24),
  };
}

/* ── Blob ──────────────────────────────────────────────────────────────── */
async function blobSdk() {
  try { return await import("@vercel/blob"); }
  catch { throw new StoresError("not_configured", 503, "The @vercel/blob package is not installed on this deployment."); }
}
async function blobText(sdk, token, pathname) {
  const r = await sdk.get(pathname, { access: "private", token: token, useCache: false });
  if (!r || !r.stream) return null;
  return new Response(r.stream).text();
}

/* ── Write ─────────────────────────────────────────────────────────────── */
export async function save(u) {
  const cfg = storesConfig();
  const where = storesStore(cfg);
  const writes = [];
  (u.files || []).forEach((f) => writes.push({ path: u.id + "/" + f.name, body: f.bytes, type: f.type }));
  if (u.meta) writes.push({ path: u.id + "/meta.json", body: Buffer.from(JSON.stringify(u.meta, null, 1)), type: "application/json" });

  if (where === "blob") {
    const sdk = await blobSdk();
    try {
      for (const w of writes) {
        await sdk.put(PREFIX + w.path, w.body, { access: "private", token: cfg.token, contentType: w.type, addRandomSuffix: false, allowOverwrite: true });
      }
    } catch (e) {
      throw new StoresError("store_unavailable", 502, "The file store did not accept it.");
    }
    return;
  }
  if (where === "file") {
    for (const w of writes) {
      const p = join(cfg.dir, w.path);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, w.body);
    }
    return;
  }
  throw new StoresError("not_configured", 503, "No file store on this deployment. Set BLOB_READ_WRITE_TOKEN.");
}

/* ── Read ──────────────────────────────────────────────────────────────── */
export async function list() {
  const cfg = storesConfig();
  const where = storesStore(cfg);
  const stores = {};
  const add = (id, name, size) => {
    const s = stores[id] || (stores[id] = { id: id, meta: null, files: [] });
    if (name !== "meta.json") s.files.push({ name: name, size: size });
  };

  if (where === "blob") {
    const sdk = await blobSdk();
    try {
      let cursor;
      do {
        const page = await sdk.list({ prefix: PREFIX, token: cfg.token, cursor: cursor, limit: 1000 });
        page.blobs.forEach((b) => {
          const rest = b.pathname.slice(PREFIX.length);
          const i = rest.indexOf("/");
          if (i > 0) add(rest.slice(0, i), rest.slice(i + 1), b.size);
        });
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      await Promise.all(Object.keys(stores).map(async (id) => {
        const t = await blobText(sdk, cfg.token, PREFIX + id + "/meta.json").catch(() => null);
        stores[id].meta = t ? JSON.parse(t) : null;
      }));
    } catch (e) {
      if (e instanceof StoresError) throw e;
      throw new StoresError("store_unavailable", 502, "Could not read the file store.");
    }
  } else if (where === "file") {
    if (existsSync(cfg.dir)) {
      readdirSync(cfg.dir).filter((id) => ID.test(id)).forEach((id) => {
        const walk = (rel) => readdirSync(join(cfg.dir, id, rel)).forEach((n) => {
          const r = rel ? rel + "/" + n : n;
          const st = statSync(join(cfg.dir, id, r));
          if (st.isDirectory()) walk(r); else add(id, r, st.size);
        });
        walk("");
        const m = join(cfg.dir, id, "meta.json");
        try { stores[id] = stores[id] || { id: id, files: [] }; stores[id].meta = existsSync(m) ? JSON.parse(readFileSync(m, "utf8")) : null; } catch { stores[id].meta = null; }
      });
    }
  } else {
    throw new StoresError("not_configured", 503, "No file store on this deployment.");
  }

  return Object.values(stores).map((s) => {
    const expected = (s.meta && s.meta.files) || [];
    const have = s.files.map((f) => f.name);
    return Object.assign(s, { missing: expected.filter((n) => have.indexOf(n) < 0) });
  }).sort((a, b) => String((b.meta && b.meta.at) || "").localeCompare(String((a.meta && a.meta.at) || "")));
}

/** One file, as bytes, for the team to download. */
export async function read(id, name) {
  if (!ID.test(String(id)) || !(NAME.test(String(name)) || name === "meta.json")) throw new StoresError("bad_name", 400, "No such file.");
  const cfg = storesConfig();
  const where = storesStore(cfg);
  if (where === "blob") {
    const sdk = await blobSdk();
    const r = await sdk.get(PREFIX + id + "/" + name, { access: "private", token: cfg.token }).catch(() => null);
    if (!r || !r.stream) throw new StoresError("not_found", 404, "No such file.");
    return { bytes: Buffer.from(await new Response(r.stream).arrayBuffer()), type: typeOf(name) };
  }
  if (where === "file") {
    const p = join(cfg.dir, id, name);
    if (!existsSync(p)) throw new StoresError("not_found", 404, "No such file.");
    return { bytes: readFileSync(p), type: typeOf(name) };
  }
  throw new StoresError("not_configured", 503, "No file store on this deployment.");
}

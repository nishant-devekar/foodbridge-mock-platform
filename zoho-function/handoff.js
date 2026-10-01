/* ==========================================================================
   HANDOFF — contacts from the owner's phone to Store Builder on his computer
   (1 Oct 2026).

   A computer has no contact list; his phone does. The desktop page shows a
   QR code that carries a fresh random code. He scans it, his phone opens
   v7/store-builder/send/, he picks contacts in the phone's own picker, and
   the phone posts them here under that code. The desktop asks for that code
   every few seconds and takes what has arrived.

   It is a mailbox, not a store:
     - only names and numbers, trimmed and capped -- or one photo (or PDF)
       per post, for the Files step (1 Oct 2026: his khata, route chart and
       bills are on paper, so on his phone, not on his computer);
     - each post is its own entry (handoff/<code>/<time>-<rand>.json), so two
       posts never overwrite each other;
     - a read TAKES: what the desktop reads is deleted;
     - anything older than an hour is ignored and deleted.

   The code is the only key: 12 random characters the desktop made, shown only
   on its screen. Same two stores as stores.js (Vercel Blob, private, or a
   local folder beside stores-data/), same `not_configured` when neither.
   ========================================================================== */

import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { storesConfig, storesStore, StoresError } from "./stores.js";

const PREFIX = "handoff/";
const CODE = /^[a-z0-9]{12}$/;
const TTL = 60 * 60e3;
const MAX_PEOPLE = 3000;
const MAX_PHOTO = 2.5 * 1024 * 1024;   // one photo per post, under Vercel's 4.5 MB body once in base64
const TAKE_BYTES = 3 * 1024 * 1024;    // what one read hands over; the rest waits for the next
const PHOTO_TYPE = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;

export function cleanPost(body) {
  const b = body || {};
  const code = String(b.code || "");
  if (!CODE.test(code)) throw new StoresError("bad_code", 400, "Not a hand-off code.");
  const str = (v, max) => String(v == null ? "" : v).trim().replace(/\s+/g, " ").slice(0, max);
  const people = (Array.isArray(b.people) ? b.people : []).slice(0, MAX_PEOPLE).map((p) => ({
    name: str(p && p.name, 80),
    phone: str(p && p.phone, 20).replace(/[^\d+ -]/g, ""),
  })).filter((p) => p.name || p.phone);
  let file = null;
  if (b.file) {
    const type = String(b.file.type || "");
    if (!PHOTO_TYPE.test(type)) throw new StoresError("bad_type", 400, "Photos and PDFs only.");
    const data = String(b.file.data || "");
    const size = Math.floor(data.length * 3 / 4);
    if (!size) throw new StoresError("empty_file", 400, "The file is empty.");
    if (size > MAX_PHOTO) throw new StoresError("too_large", 413, "Over 2.5 MB.");
    file = { name: str(b.file.name, 80).replace(/[^\w .()\u0900-\u097F-]/g, "") || "photo.jpg", type: type, data: data };
  }
  /* "hello": the phone opened the link -- the desktop can say so before anything arrives. */
  if (!people.length && !file && !b.hello) throw new StoresError("nothing_sent", 400, "Nothing sent.");
  return { code: code, people: people, file: file, hello: !!b.hello && !people.length && !file };
}

async function blobSdk() {
  try { return await import("@vercel/blob"); }
  catch { throw new StoresError("not_configured", 503, "The @vercel/blob package is not installed on this deployment."); }
}
function folder(cfg, code) { return join(cfg.dir, "_handoff", code); }

let seq = 0;
export async function post(u) {
  const cfg = storesConfig();
  const where = storesStore(cfg);
  /* Sorts in the order they came, even two in the same millisecond. */
  const name = Date.now() + "-" + String(seq++ % 10000).padStart(4, "0") + Math.random().toString(36).slice(2, 6) + ".json";
  const body = JSON.stringify({ at: Date.now(), hello: u.hello || undefined, people: u.people, file: u.file || undefined });
  if (where === "blob") {
    const sdk = await blobSdk();
    try {
      await sdk.put(PREFIX + u.code + "/" + name, body, { access: "private", token: cfg.token, contentType: "application/json", addRandomSuffix: false });
    } catch (e) { throw new StoresError("store_unavailable", 502, "The store did not accept it."); }
    return;
  }
  if (where === "file") {
    mkdirSync(folder(cfg, u.code), { recursive: true });
    writeFileSync(join(folder(cfg, u.code), name), body);
    return;
  }
  throw new StoresError("not_configured", 503, "No store on this deployment. Set BLOB_READ_WRITE_TOKEN.");
}

/** What is waiting under a code, oldest first, and gone from the mailbox once read. Photos make
    it big, so one read stops at about 3 MB and the rest waits for the next (more: true). */
export async function take(code) {
  if (!CODE.test(String(code))) throw new StoresError("bad_code", 400, "Not a hand-off code.");
  const cfg = storesConfig();
  const where = storesStore(cfg);
  const now = Date.now();
  const entries = [];
  let more = false;
  if (where === "blob") {
    const sdk = await blobSdk();
    try {
      const page = await sdk.list({ prefix: PREFIX + code + "/", token: cfg.token, limit: 200 });
      const blobs = page.blobs.sort((a, b) => a.pathname.localeCompare(b.pathname));
      const read = [];
      let bytes = 0;
      for (const b of blobs) {
        if (read.length && bytes + b.size > TAKE_BYTES) { more = true; break; }
        const r = await sdk.get(b.pathname, { access: "private", token: cfg.token, useCache: false }).catch(() => null);
        if (r && r.stream) { try { entries.push(JSON.parse(await new Response(r.stream).text())); } catch { /* a broken entry is dropped */ } }
        read.push(b.url);
        bytes += b.size;
      }
      if (read.length) await sdk.del(read, { token: cfg.token });
    } catch (e) { throw new StoresError("store_unavailable", 502, "Could not read the store."); }
  } else if (where === "file") {
    const dir = folder(cfg, code);
    if (existsSync(dir)) {
      let bytes = 0;
      for (const n of readdirSync(dir).sort()) {
        const f = join(dir, n), size = statSync(f).size;
        if (bytes && bytes + size > TAKE_BYTES) { more = true; break; }
        try { entries.push(JSON.parse(readFileSync(f, "utf8"))); } catch { /* dropped */ }
        rmSync(f, { force: true });
        bytes += size;
      }
      if (!more) rmSync(dir, { recursive: true, force: true });
    }
  } else {
    throw new StoresError("not_configured", 503, "No store on this deployment.");
  }
  const fresh = entries.filter((e) => e && now - Number(e.at || 0) < TTL);
  return {
    opened: fresh.length > 0,
    people: [].concat.apply([], fresh.map((e) => e.people || [])),
    files: fresh.filter((e) => e.file).map((e) => e.file),
    more: more,
  };
}

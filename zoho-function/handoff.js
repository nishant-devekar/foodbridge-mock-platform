/* ==========================================================================
   HANDOFF — contacts from the owner's phone to Store Builder on his computer
   (1 Oct 2026).

   A computer has no contact list; his phone does. The desktop page shows a
   QR code that carries a fresh random code. He scans it, his phone opens
   v7/store-builder/send/, he picks contacts in the phone's own picker, and
   the phone posts them here under that code. The desktop asks for that code
   every few seconds and takes what has arrived.

   It is a mailbox, not a store:
     - only names and numbers, trimmed and capped;
     - each post is its own entry (handoff/<code>/<time>-<rand>.json), so two
       posts never overwrite each other;
     - a read TAKES: what the desktop reads is deleted;
     - anything older than an hour is ignored and deleted.

   The code is the only key: 12 random characters the desktop made, shown only
   on its screen. Same two stores as stores.js (Vercel Blob, private, or a
   local folder beside stores-data/), same `not_configured` when neither.
   ========================================================================== */

import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { storesConfig, storesStore, StoresError } from "./stores.js";

const PREFIX = "handoff/";
const CODE = /^[a-z0-9]{12}$/;
const TTL = 60 * 60e3;
const MAX_PEOPLE = 3000;

export function cleanPost(body) {
  const b = body || {};
  const code = String(b.code || "");
  if (!CODE.test(code)) throw new StoresError("bad_code", 400, "Not a hand-off code.");
  const str = (v, max) => String(v == null ? "" : v).trim().replace(/\s+/g, " ").slice(0, max);
  const people = (Array.isArray(b.people) ? b.people : []).slice(0, MAX_PEOPLE).map((p) => ({
    name: str(p && p.name, 80),
    phone: str(p && p.phone, 20).replace(/[^\d+ -]/g, ""),
  })).filter((p) => p.name || p.phone);
  /* "hello": the phone opened the link -- the desktop can say so before any contact arrives. */
  if (!people.length && !b.hello) throw new StoresError("nothing_sent", 400, "No contacts.");
  return { code: code, people: people, hello: !!b.hello && !people.length };
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
  const body = JSON.stringify({ at: Date.now(), hello: u.hello || undefined, people: u.people });
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

/** Everything waiting under a code, oldest first, and gone from the mailbox once read. */
export async function take(code) {
  if (!CODE.test(String(code))) throw new StoresError("bad_code", 400, "Not a hand-off code.");
  const cfg = storesConfig();
  const where = storesStore(cfg);
  const now = Date.now();
  const entries = [];
  if (where === "blob") {
    const sdk = await blobSdk();
    try {
      const page = await sdk.list({ prefix: PREFIX + code + "/", token: cfg.token, limit: 200 });
      const blobs = page.blobs.sort((a, b) => a.pathname.localeCompare(b.pathname));
      for (const b of blobs) {
        const r = await sdk.get(b.pathname, { access: "private", token: cfg.token, useCache: false }).catch(() => null);
        if (r && r.stream) { try { entries.push(JSON.parse(await new Response(r.stream).text())); } catch { /* a broken entry is dropped */ } }
      }
      if (blobs.length) await sdk.del(blobs.map((b) => b.url), { token: cfg.token });
    } catch (e) { throw new StoresError("store_unavailable", 502, "Could not read the store."); }
  } else if (where === "file") {
    const dir = folder(cfg, code);
    if (existsSync(dir)) {
      readdirSync(dir).sort().forEach((n) => {
        try { entries.push(JSON.parse(readFileSync(join(dir, n), "utf8"))); } catch { /* dropped */ }
      });
      rmSync(dir, { recursive: true, force: true });
    }
  } else {
    throw new StoresError("not_configured", 503, "No store on this deployment.");
  }
  const fresh = entries.filter((e) => e && now - Number(e.at || 0) < TTL);
  return {
    opened: fresh.length > 0,
    people: [].concat.apply([], fresh.map((e) => e.people || [])),
  };
}

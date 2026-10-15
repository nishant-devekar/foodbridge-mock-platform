/* ==========================================================================
   FB_MEDIA — photos the platform's screens attach to what they report
   (25 Sep 2026).

   A photo is far too big for the event stream (fb.v7.events lives in
   localStorage, shared and capped). It is kept here instead, in the
   browser's own database (IndexedDB "fb.v7.media", same origin, so the
   delivery app and the Control Tower read the same store), and the event
   carries only its id. In production this is an upload to file storage and
   the event carries its link; nothing that reads an event needs to change.

     FB_MEDIA.put(dataUrl, meta)  → Promise<id>        a JPEG data URL
     FB_MEDIA.get(id)             → Promise<{ id, data, meta, at } | null>

   A browser without IndexedDB (or a private window that refuses it)
   rejects put(): the screen says the photo couldn't be kept and sends the
   words alone.
   ========================================================================== */

(function (root) {
  "use strict";
  const DB = "fb.v7.media", STORE = "photos";
  let opening = null;

  function db() {
    if (opening) return opening;
    opening = new Promise(function (resolve, reject) {
      if (!root.indexedDB) return reject(new Error("No IndexedDB"));
      const req = root.indexedDB.open(DB, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE, { keyPath: "id" }); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("IndexedDB refused")); };
    });
    opening.catch(function () { opening = null; });
    return opening;
  }
  function tx(mode, work) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        const t = d.transaction(STORE, mode), st = t.objectStore(STORE);
        const req = work(st);
        t.oncomplete = function () { resolve(req && req.result); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error("aborted")); };
      });
    });
  }
  function id() { return "PH-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8); }

  function put(data, meta) {
    const rec = { id: id(), data: data, meta: meta || {}, at: new Date().toISOString() };
    return tx("readwrite", function (st) { return st.put(rec); }).then(function () { return rec.id; });
  }
  function get(pid) {
    return tx("readonly", function (st) { return st.get(pid); }).then(function (r) { return r || null; }, function () { return null; });
  }

  root.FB_MEDIA = { put: put, get: get };
})(typeof window !== "undefined" ? window : globalThis);

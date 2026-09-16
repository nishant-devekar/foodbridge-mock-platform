/* ==========================================================================
   ONBOARDING — the two readers S02 can use. REAL by default, always.

     REAL PATH (the only one a customer can reach)
       RealZohoOAuth    begin(nonce, returnUrl) → leaves for Zoho, same tab
                        takeReturn()            → {zoho, n, c} | null
       RealZohoReader   organisations(handle)   → [{id,name}]
                        read(handle, org, {onProgress, shouldStop}) → raw | null
       RealFileReader   read(file, type)        → {ok, records, skipped} | {ok:false, reason}

     TEST PATH (readers-mock.js, localhost + ?fbmock only)
       MockZohoOAuth · MockZohoReader · MockFileReader — the same interfaces

     Failures reject with { reason }: unreachable · expired · forbidden · busy ·
     daily_limit · timeout · unavailable. The screen owns every sentence.

   The real Zoho reader talks only to the FoodBridge bridge; the browser never
   holds a Zoho credential it can read, only a sealed handle it passes back.
   The real file reader runs dataset.js in this browser: files are not uploaded.

   ── DEVELOPMENT STAND-INS ───────────────────────────────────────────────
   readers-mock.js replaces BOTH readers behind these same interfaces. It can
   only ever be switched on when ALL of these hold:
     · the page is served from localhost or 127.0.0.1
     · the URL says ?fbmock=<scenario> (remembered for the tab; ?fbmock=off ends it)
   On any other host the flag is ignored, the stand-in script is never loaded,
   and anything remembered is erased. A published build cannot reach it.
   While it is on, a DEV badge sits outside the flow saying so.
   ========================================================================== */

(function () {
  "use strict";

  function topWin() {
    try { if (window.top && window.top.location.href) return window.top; } catch (e) { /* cross-origin */ }
    return window;
  }

  /* ─────────────────────────────────────────────── the dev-only guard ── */
  const MOCK_KEY = "fb.v7.mock";
  const DEV_HOST = /^(localhost|127\.0\.0\.1)$/.test(topWin().location.hostname);

  function mockSetting() {
    let asked = null;
    [topWin(), window].forEach(function (w) {
      try { const v = new URLSearchParams(w.location.search).get("fbmock"); if (v && !asked) asked = v; } catch (e) {}
    });
    try {
      if (!DEV_HOST) { sessionStorage.removeItem(MOCK_KEY); return null; }
      if (asked === "off") { sessionStorage.removeItem(MOCK_KEY); return null; }
      if (asked) sessionStorage.setItem(MOCK_KEY, asked);
      return sessionStorage.getItem(MOCK_KEY);
    } catch (e) { return null; }
  }

  const setting = mockSetting();
  const scenario = { zoho: "ok", files: "ok" };
  if (setting) setting.split(",").forEach(function (part) {
    const kv = part.split(":");
    if (kv[0] === "zoho" || kv[0] === "files") scenario[kv[0]] = kv[1] || "ok";
  });

  /* ─────────────────────────────────────────────────────── helpers ── */

  function apiBase() {
    const cfg = window.FB_INTEGRATION || {};
    return String(cfg.apiBaseUrl || "").replace(/\/+$/, "");
  }

  function post(path, body) {
    return fetch(apiBase() + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) {
        if (!r.ok) throw { reason: (b && b.error) || "unavailable" };
        return b;
      });
    }, function () { throw { reason: "unavailable" }; });
  }

  function newNonce() {
    const a = new Uint8Array(18);
    crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
  }

  /* The page to come back to: the TOP window's address without any earlier
     result, because in the platform shell onboarding is an iframe and Zoho
     cannot be framed. */
  function returnUrl() {
    const w = topWin();
    const u = new URL(w.location.href);
    u.hash = (u.hash || "").split("?")[0];
    u.searchParams.delete("fbmock");
    return u.toString();
  }

  /* #/onboarding?zoho=connected&n=…&c=… → { zoho, n, c }, read from whichever
     window carries it, and wiped from the address bar straight away so a
     reload, a bookmark or a shared link never replays it. */
  function takeReturn() {
    const wins = [topWin(), window];
    for (let i = 0; i < wins.length; i++) {
      try {
        const w = wins[i];
        const h = w.location.hash || "";
        const q = h.indexOf("?");
        if (q === -1) continue;
        const p = new URLSearchParams(h.slice(q + 1));
        if (!p.get("zoho")) continue;
        w.history.replaceState(null, "", w.location.pathname + w.location.search + h.slice(0, q));
        return { zoho: p.get("zoho"), n: p.get("n") || "", c: p.get("c") || "" };
      } catch (e) { /* a frame we may not touch */ }
    }
    return null;
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ───────────────────────────────────────────────── real: Zoho ── */

  const RealZohoOAuth = {
    begin: function (nonce, back) {
      // Ask first: sending the whole window to a bridge that is down would
      // strand the user on a browser error page with no way back in.
      return fetch(apiBase() + "/api/zoho/ready").then(function (r) {
        if (!r.ok) throw { reason: "unreachable" };
        topWin().location.href = apiBase() + "/api/zoho/start?" +
          new URLSearchParams({ return: back, n: nonce }).toString();
      }, function () { throw { reason: "unreachable" }; });
    },
    takeReturn: takeReturn,
  };

  /* Zoho's per-minute cap answers 429 and clears within the minute, so a busy
     reply is waited out twice before it is reported. The daily cap is not
     waited out: it does not clear for hours. */
  async function postPatiently(path, body, stop) {
    const waits = [3000, 8000];
    for (let i = 0; ; i++) {
      try { return await post(path, body); }
      catch (e) {
        if (!e || e.reason !== "busy" || i >= waits.length || stop()) throw e;
        await sleep(waits[i]);
      }
    }
  }

  const RealZohoReader = {
    organisations: function (handle) {
      return post("/api/zoho/orgs", { c: handle }).then(function (b) { return b.organizations || []; });
    },

    read: async function (handle, org, opts) {
      const o = opts || {};
      const stop = o.shouldStop || function () { return false; };
      const prog = { customers: "reading", products: "waiting", orders: "waiting", others: "waiting", done: 0, total: null };
      const tell = function () { if (o.onProgress) o.onProgress(Object.assign({}, prog)); };
      const notes = { listed: 0, excluded: {}, from: null };
      const all = async function (what) {
        const out = [];
        for (let page = 1; page <= 500; page++) {
          if (stop()) return null;
          const b = await postPatiently("/api/zoho/read", { c: handle, org: org.id, what: what, page: page }, stop);
          out.push.apply(out, b.records || []);
          if (what === "orders") {
            notes.listed += b.listed || 0;
            notes.from = b.from || notes.from;
            Object.keys(b.excluded || {}).forEach(function (k) { notes.excluded[k] = (notes.excluded[k] || 0) + b.excluded[k]; });
          }
          if (!b.more) break;
        }
        return out;
      };

      tell();
      const customers = await all("customers");
      if (!customers) return null;
      prog.customers = "done"; prog.products = "reading"; tell();

      const products = await all("products");
      if (!products) return null;
      prog.products = "done"; prog.orders = "reading"; tell();

      const orders = await all("orders");
      if (!orders) return null;
      prog.total = orders.length; tell();

      const byId = {};
      orders.forEach(function (x) { x.lines = []; byId[x.id] = x; });
      for (let i = 0; i < orders.length; i += 10) {
        if (stop()) return null;
        const ids = orders.slice(i, i + 10).map(function (x) { return x.id; });
        const b = await postPatiently("/api/zoho/read", { c: handle, org: org.id, what: "lines", ids: ids }, stop);
        (b.records || []).forEach(function (r) { if (byId[r.id]) byId[r.id].lines = r.lines || []; });
        prog.done = Math.min(orders.length, i + ids.length); tell();
      }
      if (stop()) return null;
      prog.orders = "done"; prog.others = "reading"; tell();

      /* Everything else the account shows. A module Zoho will not show this
         login is recorded and skipped; a sign-in that has expired, or a spent
         daily allowance, still ends the whole read. */
      const MODULES = ["invoices", "customerpayments", "creditnotes", "estimates", "purchaseorders", "bills", "expenses", "vendors"];
      const modules = {};
      for (let m = 0; m < MODULES.length; m++) {
        if (stop()) return null;
        try {
          modules[MODULES[m]] = { ok: true, records: await all(MODULES[m]) };
          if (modules[MODULES[m]].records === null) return null;
        } catch (e) {
          const reason = (e && e.reason) || "unavailable";
          if (reason === "expired" || reason === "daily_limit") throw e;
          modules[MODULES[m]] = { ok: false, reason: reason };
        }
      }
      if (stop()) return null;
      prog.others = "done"; tell();
      return { org: org, customers: customers, products: products, orders: orders, orderNotes: notes, modules: modules };
    },
  };

  /* ───────────────────────────────────────────────── real: files ── */

  /* A photo is shrunk in the browser to what Claude reads at full detail
     (2576px on the long edge) and sent to the bridge as JPEG. It leaves the
     device, unlike a spreadsheet, which is read here. */
  function photoToJpeg(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        const scale = Math.min(1, 2576 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.88).split(",")[1]);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("image")); };
      img.src = url;
    });
  }

  const isPhoto = function (file) { return /^image\//.test(file.type || "") || /\.(jpe?g|png|heic|heif|webp)$/i.test(file.name || ""); };

  /* read(file, type): AS that kind → { ok, records, skipped }; with a list of
     kinds (the file's tags) each is read → { ok, found: [{ type, … }], none };
     with type null the spreadsheet says what it holds → { ok, found }. A photo
     never says: it is read by the bridge as the kind S03's item asked for. */
  const RealFileReader = {
    isPhoto: isPhoto,
    read: async function (file, type) {
      if (!isPhoto(file)) return window.FB_DATASET.readFile(file, type);
      if (["invoices", "payments", "costs"].indexOf(type) === -1) return { ok: false, reason: "unsupported" };
      let data;
      try { data = await photoToJpeg(file); } catch (e) { return { ok: false, reason: "damaged" }; }
      let r, b;
      try {
        r = await fetch(apiBase() + "/api/extract", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: type, mediaType: "image/jpeg", data: data }),
        });
        b = await r.json().catch(function () { return {}; });
      } catch (e) { return { ok: false, reason: "photo_unavailable" }; }
      if (r.ok && b && Array.isArray(b.records)) {
        return b.records.length ? { ok: true, records: b.records, skipped: b.skipped || [] } : { ok: false, reason: "photo_no_rows" };
      }
      const why = b && b.error;
      return { ok: false, reason: why === "not_configured" ? "photo_not_set_up" : why === "unreadable" ? "photo_no_rows" : "photo_unavailable" };
    },
  };

  /* ─────────────────────────────────────────────────── the badge ── */

  function badge() {
    if (!setting || document.getElementById("fb-dev-badge")) return;
    const b = document.createElement("div");
    b.id = "fb-dev-badge";
    b.textContent = "DEV · stand-in readers · zoho:" + scenario.zoho + " · files:" + scenario.files;
    b.setAttribute("aria-hidden", "true");
    b.style.cssText = "position:fixed;right:6px;top:6px;z-index:2147483647;pointer-events:none;" +
      "font:600 10px/1 ui-monospace,monospace;letter-spacing:.02em;color:#fff;background:#7c3aed;" +
      "padding:4px 6px;border-radius:5px;opacity:.9";
    document.body.appendChild(b);
  }
  if (setting) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", badge);
    else badge();
  }

  window.FB_READERS = {
    zohoAuth: RealZohoOAuth,
    zohoReader: RealZohoReader,
    files: RealFileReader,
    mock: { active: !!setting, scenario: scenario },
    /* Called by readers-mock.js, and only honoured under the guard above. */
    useStandIns: function (zohoAuth, zohoReader, files) {
      if (!setting || !DEV_HOST) return;
      this.zohoAuth = zohoAuth;
      this.zohoReader = zohoReader;
      this.files = files;
    },
    newNonce: newNonce,
    returnUrl: returnUrl,
    takeReturn: takeReturn,
    topWin: topWin,
    sleep: sleep,
  };
})();

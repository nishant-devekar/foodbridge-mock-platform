/* ==========================================================================
   DEVELOPMENT ONLY — stand-ins for the Zoho and file readers.

   Loaded by onboarding.html only when readers.js's guard allows it (localhost
   AND ?fbmock=…). It swaps nothing in unless that same guard agrees again.

   They implement the real readers' interfaces exactly, and hand back RAW
   records that go through the same dataset.js the real readers use — so the
   screens, the Dataset and S03 cannot tell them apart, which is the point.

   Their records are the demonstration tenant's export (order-history.js +
   seed.inline.js), loaded alongside this file in dev only. That is also why
   they must never reach a customer: they would be labelled "Your Zoho Books".

   Scenarios (?fbmock=zoho:<one>,files:<one>):
     zoho   ok · orgs · noorg · denied · authfail · unreachable · readfail ·
            expired · busy · zero
     files  ok · partial (a file whose name has "bad" or "fail", or any Invoices file,
            fails) · allfail.  With no type given (S02), the kind is taken from the
            file's NAME here and nowhere else; a name saying nothing is the
            products-or-customers question, "empty" in the name is no_records.
   ========================================================================== */

(function () {
  "use strict";
  const R = window.FB_READERS;
  if (!R || !R.mock.active) return;
  const S = R.mock.scenario;
  const sleep = R.sleep;
  const DAY = 86400000;

  function fixture() {
    const seed = window.SEED || {};
    const hist = window.FB_ORDER_HISTORY || {};
    return { seed: seed, hist: hist };
  }
  const nameOf = function (c) { return (c.name && (c.name.en || c.name)) || c._id; };

  /* One stand-in serves both apps; the scenario is ?fbmock=zoho:<one> for
     either. The sign-in page is told which app it is standing in for so the
     result comes back under that app's name. */
  const MockAppOAuth = function (app) {
    return {
      takeReturn: R.takeReturn,
      begin: async function (nonce, back) {
        await sleep(400);
        if (S.zoho === "unreachable") throw { reason: "unreachable" };
        const page = new URL("mock-zoho.html", location.href);
        page.searchParams.set("return", back);
        page.searchParams.set("n", nonce);
        page.searchParams.set("s", S.zoho);
        page.searchParams.set("app", app);
        R.topWin().location.href = page.toString();
      },
    };
  };

  const MockAppReader = function (app) { return {
    organisations: async function (handle) {
      await sleep(500);
      if (handle !== "mock") throw { reason: "expired" };
      if (S.zoho === "noorg") return [];
      const name = app === "xero" ? "Stand-in Distributors (Xero)" : "Stand-in Distributors Pvt Ltd";
      if (S.zoho === "orgs") return [{ id: "9001", name: name }, { id: "9002", name: "Stand-in Distributors — Pune" }];
      return [{ id: "9001", name: name }];
    },

    read: async function (handle, org, opts) {
      const o = opts || {};
      const stop = o.shouldStop || function () { return false; };
      const prog = { customers: "reading", products: "waiting", orders: "waiting", others: "waiting", done: 0, total: null };
      const tell = function () { if (o.onProgress) o.onProgress(Object.assign({}, prog)); };
      const f = fixture();

      tell(); await sleep(700); if (stop()) return null;
      const customers = (f.seed.b2b || []).map(function (c) { return { id: c._id, name: nameOf(c) }; });
      prog.customers = "done"; prog.products = "reading"; tell();

      await sleep(700); if (stop()) return null;
      const products = (f.seed.products || []).map(function (p) {
        const r = { id: p.id, name: p.name, sku: p.artNo, unit: p.unit };
        if (typeof p.systemStock === "number") r.stockOnHand = p.systemStock;
        return r;
      });
      prog.products = "done"; prog.orders = "reading"; tell();

      await sleep(700); if (stop()) return null;
      if (S.zoho === "busy") throw { reason: "busy" };
      const from = new Date(Date.now() - 240 * DAY).toISOString().slice(0, 10);
      const byName = {};
      customers.forEach(function (c) { byName[c.id] = c.name; });
      let orders = [];
      if (S.zoho !== "zero") {
        Object.keys(f.hist).forEach(function (cid) {
          (f.hist[cid].orders || []).forEach(function (occ, i) {
            if (occ.at < from) return;
            orders.push({ id: cid + "-" + i, customerId: cid, customerName: byName[cid] || cid, date: occ.at,
              lines: occ.lines.map(function (l) { return { itemId: l.productId, qty: l.qty, unit: "pcs" }; }) });
          });
        });
      }
      prog.total = orders.length; tell();
      for (let i = 0; i < orders.length; i += 10) {
        await sleep(160);
        if (stop()) return null;
        const share = i / Math.max(1, orders.length);
        if (S.zoho === "readfail" && share >= 0.4) throw { reason: "unavailable" };
        if (S.zoho === "expired" && share >= 0.6) throw { reason: "expired" };
        prog.done = Math.min(orders.length, i + 10); tell();
      }
      prog.orders = "done"; prog.others = "done"; tell();
      return { app: app, org: org, customers: customers, products: products, orders: orders, modules: {} };
    },
  }; };

  const FAILS = ["no_records", "damaged", "protected", "unsupported", "too_large"];
  let failN = 0;

  const MockFileReader = {
    isPhoto: function (file) { return /^image\//.test(file.type || ""); },
    read: async function (file, type) {
      /* With no type the real reader lets the columns speak. The stand-in has
         no columns, so — dev only — it takes the kind from the file's name
         ("orders.xlsx", "my customers.csv"); a name that says nothing is the
         products-or-customers question, and "empty" in the name is no_records. */
      if (Array.isArray(type)) {
        const found = [], none = [];
        for (let i = 0; i < type.length; i++) {
          const out = await this.read(file, type[i]);
          if (out.ok) found.push({ type: type[i], records: out.records, skipped: out.skipped }); else none.push(type[i]);
        }
        return found.length ? { ok: true, found: found, none: none } : { ok: false, reason: "no_records", none: none };
      }
      if (type == null) {
        const n = String(file.name || "").toLowerCase();
        if (/empty|nothing/.test(n)) return sleep(900).then(function () { return { ok: false, reason: "no_records" }; });
        const kind = /order|sales/.test(n) ? "orders" : /invoice|bill/.test(n) ? "invoices"
                   : /product|item|stock/.test(n) ? "products" : /customer|shop|party/.test(n) ? "customers" : null;
        if (!kind) return sleep(900).then(function () { return { ok: false, reason: "ambiguous", choices: ["products", "customers"] }; });
        const out = await this.read(file, kind);
        return out.ok ? { ok: true, found: [{ type: kind, records: out.records, skipped: out.skipped }] } : out;
      }
      await sleep(900);
      const bad = S.files === "allfail" ||
        (S.files === "partial" && (type === "invoices" || /bad|fail/i.test(file.name)));
      if (bad) return { ok: false, reason: FAILS[failN++ % FAILS.length] };
      const f = fixture();
      const names = {};
      (f.seed.b2b || []).forEach(function (c) { names[c._id] = nameOf(c); });
      const prod = {};
      (f.seed.products || []).forEach(function (p) { prod[p.id] = p; });
      let records = [];
      if (type === "customers") {
        records = (f.seed.b2b || []).map(function (c, i) { return { name: nameOf(c), row: i + 2 }; });
      } else if (type === "products") {
        records = (f.seed.products || []).map(function (p, i) {
          const r = { name: p.name, sku: p.artNo, unit: p.unit, row: i + 2 };
          if (typeof p.systemStock === "number") r.stockOnHand = p.systemStock;
          return r;
        });
      } else if (type === "orders") {
        let row = 2;
        Object.keys(f.hist).forEach(function (cid) {
          (f.hist[cid].orders || []).forEach(function (occ, i) {
            occ.lines.forEach(function (l) {
              if (!prod[l.productId]) return;
              records.push({ date: occ.at, customer: names[cid] || cid, product: prod[l.productId].name,
                             sku: prod[l.productId].artNo, qty: l.qty, orderId: cid + "-" + i, row: row++ });
            });
          });
        });
      } else if (type === "payments") {
        let row = 2;
        Object.keys(f.hist).forEach(function (cid) {
          (f.hist[cid].orders || []).slice(0, 1).forEach(function (occ) {
            records.push({ date: occ.at, customer: names[cid] || cid, amount: occ.value, row: row++ });
          });
        });
      } else if (type === "costs") {
        records = (f.seed.products || []).slice(0, 40).map(function (p, i) { return { name: p.name, sku: p.artNo, cost: 10 + i, row: i + 2 }; });
      } else if (type === "invoices") {
        let row = 2;
        Object.keys(f.hist).forEach(function (cid) {
          (f.hist[cid].orders || []).slice(0, 2).forEach(function (occ) {
            records.push({ date: occ.at, customer: names[cid] || cid, total: occ.value, row: row++ });
          });
        });
      }
      return { ok: true, records: records, skipped: [] };
    },
  };

  R.useStandIns({
    zoho: { auth: MockAppOAuth("zoho"), reader: MockAppReader("zoho") },
    xero: { auth: MockAppOAuth("xero"), reader: MockAppReader("xero") },
  }, MockFileReader);
})();

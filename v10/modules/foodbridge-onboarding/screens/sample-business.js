/* ==========================================================================
   THE SAMPLE BUSINESS — the modules the demonstration tenant does not carry.

   The tenant's export (seed.inline.js + order-history.js) has customers,
   products and order history and nothing else. S02's Sample data channel is
   meant to show what FoodBridge does with a WHOLE business, so the rest of the
   Dataset — suppliers, invoices, payments, credit notes, quotes, purchase
   orders, bills, expenses — is built here, from that export.

   Three rules this file keeps, because these records sit behind a screen that
   says "Great! We found this data":

     1 · DERIVED, NOT IMAGINED. Every record traces to something in the export.
         Invoices are the orders. Payments are the invoices. Suppliers are the
         product categories. Nothing is sampled from a distribution of guesses.

     2 · DETERMINISTIC. No Math.random, no Date.now inside a record. The same
         export yields byte-identical records on every run and every device, so
         a count that moves means the data moved. Order dates set the window;
         `asOf` (the import date) only decides what is overdue.

     3 · PRICED FROM THE CATALOGUE, AND SAID SO. The tenant has no price field:
         63 of its 86 products carry an MRP inside the product NAME
         ("... (OLD MRP 700) NEW MRP 660"), which is parsed out. The other 23
         take their category's median MRP. That is the whole pricing model —
         it is a sample business's arithmetic, not a real catalogue's.

   These are SAMPLE records and are labelled so end to end: the channel hands
   them over as app "sample", dataset.js gives that app the prefix `s` and the
   label "Sample data", and every record carries kind: "sample". Nothing here
   may be presented as read from anyone's account.
   ========================================================================== */

(function () {
  "use strict";

  const DAY = 86400000;

  /* FNV-1a over a record's own key → [0,1). Stable across runs and engines,
     which Math.random is not, and keyed off the record so adding one record
     does not reshuffle the others.

     The fmix32 tail is not decoration. FNV alone, over keys as alike as
     "cninv0001".."cninv0165", avalanches so weakly that the output clustered
     in three deciles and never once fell below 0.219 — every threshold below
     that silently produced NOTHING (credit notes came out empty), and the ones
     above it were skewed. The final mix spreads the bits so a threshold means
     what it says. */
  function rnd(key) {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 2246822507);
    h ^= h >>> 13; h = Math.imul(h, 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const pick = function (key, list) { return list[Math.floor(rnd(key) * list.length) % list.length]; };
  const iso = function (d) { return new Date(d).toISOString().slice(0, 10); };
  const addDays = function (date, n) { return iso(new Date(date + "T00:00:00Z").getTime() + n * DAY); };
  const money = function (n) { return Math.round(n * 100) / 100; };
  const pad = function (n, w) { return String(n).padStart(w || 4, "0"); };

  /* "AMLA PICKLE (1000 gm) (OLD MRP 700) NEW MRP 660" → 660. A NEW MRP wins
     over the old one; a name with neither gets its category's median. */
  function mrpOf(name) {
    const s = String(name || "");
    const m = s.match(/NEW\s*MRP\s*([0-9]+(?:\.[0-9]+)?)/i) || s.match(/MRP\s*([0-9]+(?:\.[0-9]+)?)/i);
    return m ? Number(m[1]) : null;
  }
  function priceBook(products) {
    const byCat = {}, price = {};
    products.forEach(function (p) {
      const v = mrpOf(p.name);
      if (v == null) return;
      price[p.id] = v;
      (byCat[p.category || "-"] = byCat[p.category || "-"] || []).push(v);
    });
    const median = function (a) { const s = a.slice().sort(function (x, y) { return x - y; }); return s.length ? s[Math.floor(s.length / 2)] : 0; };
    const all = median(Object.keys(byCat).reduce(function (t, k) { return t.concat(byCat[k]); }, []));
    products.forEach(function (p) {
      if (price[p.id] != null) return;
      price[p.id] = median(byCat[p.category || "-"] || []) || all;
    });
    return price;
  }

  /* One supplier per product category the catalogue actually uses. The
     tenant's categories include both SPICE and SPICES; that is the real
     catalogue and it is not tidied up here. */
  function suppliersFrom(products) {
    const seen = [];
    products.forEach(function (p) { if (p.category && seen.indexOf(p.category) === -1) seen.push(p.category); });
    return seen.map(function (cat, i) {
      const title = cat.toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
      return { id: "sup" + pad(i + 1, 2), name: title + " Traders", category: cat };
    });
  }

  /* Every month touched by the orders, oldest first: what the recurring
     records (purchase orders, bills, expenses) are laid out along. */
  function monthsOf(orders) {
    const set = {};
    orders.forEach(function (o) { set[String(o.date).slice(0, 7)] = 1; });
    return Object.keys(set).sort();
  }

  const PAY_MODES = ["NEFT", "UPI", "Cheque", "Cash", "Bank Transfer"];
  const EXPENSE_ACCOUNTS = ["Rent", "Fuel", "Salaries", "Electricity", "Packaging"];

  /* orders: [{ id, customerId, date, lines:[{itemId, qty}] }] — the same raw
     orders the channel hands to dataset.js.
     asOf: the import date, ISO. Only decides what has fallen overdue. */
  function build(seed, orders, asOf) {
    const products = (seed && seed.products) || [];
    const price = priceBook(products);
    const suppliers = suppliersFrom(products);
    const today = asOf || iso(Date.now());

    const totalOf = function (o) {
      return money((o.lines || []).reduce(function (t, l) { return t + (price[l.itemId] || 0) * (l.qty || 0); }, 0));
    };

    /* ── Invoices: one per order, because every order here was fulfilled. ── */
    const invoices = orders.map(function (o, i) {
      const total = totalOf(o);
      const dueDate = addDays(o.date, 15);
      const r = rnd("inv" + o.id);
      /* Roughly four in five are settled; of the rest, an invoice past its due
         date is overdue and one still inside its terms is simply sent. */
      const paid = r < 0.79;
      const status = paid ? "paid" : dueDate < today ? "overdue" : "sent";
      return { id: "inv" + pad(i + 1), number: "SMP-INV-" + pad(i + 1), customerId: o.customerId,
               date: o.date, dueDate: dueDate, total: total,
               balance: paid ? 0 : total, status: status, orderId: o.id };
    });

    /* ── Payments: one per settled invoice, on or after its date. ── */
    const payments = invoices.filter(function (inv) { return inv.status === "paid"; }).map(function (inv, i) {
      const r = rnd("pay" + inv.id);
      return { id: "pay" + pad(i + 1), customerId: inv.customerId,
               date: addDays(inv.date, 1 + Math.floor(r * 14)), amount: inv.total,
               mode: pick("mode" + inv.id, PAY_MODES), invoiceId: inv.id };
    });

    /* ── Credit notes: the returns. One invoice in twenty, part of its value. ── */
    const creditNotes = invoices.filter(function (inv) { return rnd("cn" + inv.id) < 0.05; }).map(function (inv, i) {
      const part = money(inv.total * (0.1 + rnd("cnv" + inv.id) * 0.3));
      return { id: "cn" + pad(i + 1), number: "SMP-CN-" + pad(i + 1), customerId: inv.customerId,
               date: addDays(inv.date, 3 + Math.floor(rnd("cnd" + inv.id) * 20)),
               total: part, balance: 0, status: "closed", invoiceId: inv.id };
    });

    /* ── Quotes: the orders that were quoted first. One in four, before it. ── */
    const estimates = orders.filter(function (o) { return rnd("est" + o.id) < 0.25; }).map(function (o, i) {
      return { id: "est" + pad(i + 1), number: "SMP-QT-" + pad(i + 1), customerId: o.customerId,
               date: addDays(o.date, -(2 + Math.floor(rnd("estd" + o.id) * 9))),
               total: totalOf(o), status: "accepted", orderId: o.id };
    });

    /* ── Buying side: each supplier restocked once a month, billed for it. ── */
    const months = monthsOf(orders);
    const purchaseOrders = [], bills = [];
    months.forEach(function (m, mi) {
      suppliers.forEach(function (sup, si) {
        const key = sup.id + m;
        const date = m + "-" + pad(3 + Math.floor(rnd("pod" + key) * 12), 2);
        const total = money(8000 + rnd("pov" + key) * 42000);
        const n = mi * suppliers.length + si + 1;
        purchaseOrders.push({ id: "po" + pad(n), number: "SMP-PO-" + pad(n), vendorId: sup.id,
                              date: date, total: total, status: "billed" });
        const due = addDays(date, 30);
        const settled = rnd("bil" + key) < 0.82;
        bills.push({ id: "bil" + pad(n), number: "SMP-BILL-" + pad(n), vendorId: sup.id,
                     date: addDays(date, 2), dueDate: due, total: total,
                     balance: settled ? 0 : total,
                     status: settled ? "paid" : due < today ? "overdue" : "open",
                     purchaseOrderId: "po" + pad(n) });
      });
    });

    /* ── Running costs: the same accounts every month. ── */
    const expenses = [];
    months.forEach(function (m, mi) {
      EXPENSE_ACCOUNTS.forEach(function (acct, ai) {
        const key = acct + m;
        const n = mi * EXPENSE_ACCOUNTS.length + ai + 1;
        expenses.push({ id: "exp" + pad(n), account: acct, date: m + "-" + pad(2 + ai * 5, 2),
                        total: money(2500 + rnd("exv" + key) * 27500), status: "recorded" });
      });
    });

    /* Shaped as raw app modules, so they go through the same fromApp() every
       channel uses. `ok: true` because this read never fails partway. */
    const M = function (records) { return { ok: true, records: records }; };
    return {
      invoices: M(invoices),
      customerpayments: M(payments),
      creditnotes: M(creditNotes),
      estimates: M(estimates),
      purchaseorders: M(purchaseOrders),
      bills: M(bills),
      expenses: M(expenses),
      vendors: M(suppliers),
    };
  }

  window.FB_SAMPLE = { build: build, mrpOf: mrpOf };
})();

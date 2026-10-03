/* ==========================================================================
   CONTROL TOWER · PRODUCTION — the sixth lever (owner, 3 Oct 2026).

   The owner's plan, read where it stands, in its four tabs only:
     Orders · Finished Goods · Semi Finished Goods · Purchase
   (assets/production/plan-tables.js, the same tables the Production board
   draws, so a figure here is the board's figure). Every production incident
   is filed under the tab that acts on it, and every row leads to that tab
   on the board.

     Orders            a pack's open orders: in stock, being made (approved
                       batches cover them), or not covered yet
     Finished Goods    packs still to approve for production; the floor's
                       alerts on finished and packing batches
     Semi Finished     cuts still to approve; alerts on cutting batches
     Purchase          what is still to order, raised and waiting for
                       approval, or late from the supplier

   lever(tables, alerts, now) → the lever in the tower's one shape (tiles
   good / bad / ugly, headline, how) plus `tabs`, the four tabs with their
   rows. alerts are D.alerts() with `tab` ("fg" | "sf") and `batchNo` put
   on by the page. Pure: no DOM, no storage, no clock. Runs under node.
   ========================================================================== */

(function (root) {
  "use strict";

  const TABS = [["or", "Orders"], ["fg", "Finished Goods"], ["sf", "Semi Finished Goods"], ["pu", "Purchase"]];
  const WORD = { or: "not covered", fg: "to approve", sf: "to approve", pu: "to order" };
  const RANK = { ugly: 0, bad: 1, good: 2 };
  const n = function (v) { return Math.round(v).toLocaleString("en-IN"); };
  const plural = function (k, one, many) { return n(k) + " " + (Math.round(k) === 1 ? one : (many || one + "s")); };
  const unitOf = function (u) { return u === "pcs" ? "pcs" : u || "kg"; };

  /* The floor's alerts, in the tower's words: what happened, and its tone. */
  const ALERT = {
    help:        { tone: "ugly", note: function (a) { return (a.worker || "A worker") + " asked for help on " + (a.step || "a step"); } },
    on_hold:     { tone: "ugly", note: function () { return "On hold · its steps are paused"; } },
    weight_loss: { tone: "bad",  note: function (a) { return (a.step || "A step") + " lost " + a.lossPct + "% · the recipe allows " + a.allowed + "%"; } },
    waiting:     { tone: "bad",  note: function (a) { return (a.step || "A step") + " waiting " + a.minutes + " min · nobody started it"; } },
    to_record:   { tone: "bad",  note: function (a) { return (a.step || "A step") + " not recorded yet · " + a.minutes + " min"; } },
  };

  function lever(t, alerts, now) {
    const rows = { or: [], fg: [], sf: [], pu: [] };
    const fgLine = {};
    (t.fg || []).forEach(function (g) { g.packs.forEach(function (l) { fgLine[l.skuId] = l; }); });

    /* Orders: each pack with open orders, by what covers them */
    let cartons = 0, short = 0;
    (t.orders || []).forEach(function (g) {
      g.rows.forEach(function (r) {
        if (!(r.qty > 0)) return;
        const l = fgLine[r.id] || { stock: 0, approved: 0 }, per = r.perCarton || 1;
        const gap = Math.max(0, r.qty - Math.max(0, l.stock) - l.approved);
        cartons += r.cartons; short += gap / per;
        const ord = per > 1 ? plural(r.cartons, "carton") : plural(r.qty, "pack");
        rows.or.push(gap > 0
          ? { tone: "ugly", title: r.name, note: ord + " ordered · " + (per > 1 ? plural(Math.ceil(gap / per), "carton") : plural(gap, "pack")) + " not covered" }
          : l.stock >= r.qty ? { tone: "good", title: r.name, note: ord + " · in stock" }
          : { tone: "good", title: r.name, note: ord + " · being made in approved batches" });
      });
    });

    /* Finished Goods and Semi Finished: the lines still to approve for production */
    const produce = function (tab, l, unit) {
      if (l.toProduce > 0) {
        const forOrders = l.stock + l.approved < l.ordered;
        return { tone: forOrders ? "ugly" : "bad", title: l.name,
          note: n(l.toProduce) + " " + unit + " to produce · " + (forOrders ? (tab === "fg" ? "orders waiting" : "finished batches waiting") : "below minimum stock"),
          next: "Approve for production" };
      }
      if (l.approved > 0) return { tone: "good", title: l.name, note: n(l.approved) + " " + unit + " approved · " + (l.run ? n(l.run) + " in progress" : "waiting to start") };
      if (l.ordered > 0 || l.msq > 0) return { tone: "good", title: l.name, note: "Covered from stock" };
      return null;
    };
    (t.fg || []).forEach(function (g) { g.packs.forEach(function (l) { const r = produce("fg", l, "packs"); if (r) rows.fg.push(r); }); });
    (t.semi || []).forEach(function (l) { const r = produce("sf", l, "kg"); if (r) rows.sf.push(r); });

    /* Every production incident, under the tab that makes the batch */
    (alerts || []).forEach(function (a) {
      const k = ALERT[a.type], tab = a.tab === "sf" ? "sf" : "fg";
      if (!k) return;
      rows[tab].push({ tone: k.tone, title: (a.product || "A batch") + (a.batchNo ? " · " + a.batchNo : ""), note: k.note(a), alert: a.type, at: a.createdAt });
    });

    /* Purchase: to order, waiting for approval, late from the supplier, covered */
    (t.purchase || []).forEach(function (l) {
      const u = unitOf(l.unit);
      const late = (l.pos || []).filter(function (p) { return !p.waiting && p.expectedAt && new Date(p.expectedAt).getTime() < now; });
      if (l.toOrder > 0) {
        const forBatches = l.stock + l.requested + l.onWay < l.ordered;
        rows.pu.push({ tone: forBatches ? "ugly" : "bad", title: l.name,
          note: n(l.toOrder) + " " + u + " to order · " + (forBatches ? "approved batches need it" : "below minimum stock"), next: "Create order" });
      } else if (late.length) {
        rows.pu.push({ tone: "ugly", title: l.name, note: n(late.reduce(function (s, p) { return s + p.qty; }, 0)) + " " + u + " late from " + late[0].supplier.split(/ · |, /)[0], next: "Call the supplier" });
      } else if (l.requested > 0) {
        rows.pu.push({ tone: "bad", title: l.name, note: n(l.requested) + " " + u + " awaiting approval", next: "Approve in Purchase Orders" });
      } else if (l.onWay > 0) {
        rows.pu.push({ tone: "good", title: l.name, note: n(l.onWay) + " " + u + " with the supplier" });
      } else if (l.ordered > 0 || l.msq > 0) {
        rows.pu.push({ tone: "good", title: l.name, note: "In stock" });
      }
    });

    /* each tab: its rows worst first, its count of what needs the owner */
    const tabs = TABS.map(function (x) {
      const id = x[0], list = rows[id].map(function (r, i) { return Object.assign({ id: "prod:" + id + ":" + i, kind: "production", tab: id, tabLabel: x[1] }, r); })
        .sort(function (a, b) { return RANK[a.tone] - RANK[b.tone]; });
      const ugly = list.filter(function (r) { return r.tone === "ugly"; }).length, bad = list.filter(function (r) { return r.tone === "bad"; }).length;
      return { id: id, label: x[1], word: WORD[id], rows: list, count: ugly + bad, ugly: ugly, bad: bad,
               tone: ugly ? "ugly" : bad ? "bad" : "good" };
    });
    const all = [].concat.apply([], tabs.map(function (x) { return x.rows; }));
    const of = function (tone) { return all.filter(function (r) { return r.tone === tone; }); };
    const tile = function (label, word, list) { return { label: label, word: word, value: String(list.length), count: list.length, rows: list }; };
    const tiles = { good: tile("On track", "On track", of("good")), bad: tile("Needs work", "Needs work", of("bad")), ugly: tile("Urgent", "Urgent", of("ugly")) };
    const covered = Math.max(0, cartons - short);
    return {
      id: "production", label: "Production", period: "Today", byIncidents: true,
      status: tiles.ugly.count ? "ugly" : tiles.bad.count ? "bad" : "good",
      headline: cartons > 0
        ? { value: n(covered) + " of " + plural(cartons, "carton") + " covered", context: "today's orders, by stock and batches approved for production" }
        : { value: "No open orders", context: "nothing to make for customers today" },
      healthOf: cartons > 0 ? { value: covered / cartons, what: "of ordered cartons covered by stock or approved batches" } : null,
      tiles: tiles, tabs: tabs,
      balance: [], grow: null, action: null,
      how: "From today's Production and Purchase Plan. Orders: open sales orders. Finished Goods and Semi Finished Goods: what is still to approve for production, and the floor's alerts on their batches. Purchase: what approved batches still need that isn't ordered, waiting for approval, or late.",
    };
  }

  const API = { lever: lever, TABS: TABS };
  root.CTProduction = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

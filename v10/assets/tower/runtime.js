/* ==========================================================================
   TOWER RUNTIME — what the screen reads from a walked flow. (17 Oct 2026)

   The flow (contract fb.journey/2) is nodes and edges; each node names its
   `area`, and the flow's `areas` says how each area looks (label, word,
   icon, colours). The store rules (assets/tower/store-rules.json) say how a
   store's records read as work in each area (source, rank, feed, board,
   open). The tower's tabs are the shell's own. This file joins the three by
   field, never by name:

     read(ev, rules, tabs)  → { text, feed, tabs, areas, open, area(key) }
       areas                every area the flow's nodes name, in the flow's
                            `areas` sequence: { key, label, word, icon,
                            colour, rank, source, feed, board, open, promise,
                            state, count }
       state                locked: none of its nodes has opened yet;
                            skipped: all skipped; else live
       open                 the live areas
     stackOpts(model)       → the stack's rules (assets/ct/stack.js)
     fill(template, values) "{name}" from values, "{n|word}" pluralised

   Pure: no DOM, no storage, no clock. Runs under node. It names no area and
   no business: test/tower/graph.test.js checks.
   ========================================================================== */

(function (root) {
  "use strict";

  const plural = function (n, w) { return n + " " + (n === 1 ? w : /(s|x|ch|sh)$/.test(w) ? w + "es" : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + "ies" : w + "s"); };

  function read(ev, rules, tabs) {
    const R = rules || {}, looks = (ev.graph && ev.graph.areas) || {}, how = R.areas || {};
    const areas = ev.areas().map(function (x) {
      const l = looks[x.key] || {}, h = how[x.key] || {}, c = x.count;
      const all = x.nodes.length, shut = c.locked + c.skipped;
      return { key: x.key, id: x.key, label: l.label || x.key, word: l.word || l.label || x.key, icon: l.icon || "", colour: l.colour || null,
               promise: l.promise || "", rank: typeof h.rank === "number" ? h.rank : 999, source: h.source || "", model: h.model || "",
               feed: h.feed || {}, board: h.board || {}, open: h.open || null,
               state: c.skipped === all ? "skipped" : shut === all ? "locked" : "live", count: c };
    });
    const byKey = {};
    areas.forEach(function (a) { byKey[a.key] = a; });
    return {
      text: R.text || {}, feed: R.feed || {}, tabs: tabs || [], areas: areas,
      open: areas.filter(function (a) { return a.state === "live"; }),
      area: function (k) { return byKey[k] || null; },
    };
  }

  /* The stack's rules: every live area's rank, word and feed. */
  function stackOpts(model, extra) {
    const areas = {};
    model.areas.forEach(function (a) { areas[a.key] = { rank: a.rank, word: a.word, feed: a.feed }; });
    return Object.assign({ areas: areas, text: model.text, oneCardPer: model.feed.oneCardPer || [], minGroup: model.feed.minGroup || 2 }, extra || {});
  }

  /* "{name}" from values; "{n|word}" is n and the word, pluralised. */
  function fill(tpl, values) {
    const v = values || {};
    return String(tpl || "").replace(/\{(\w+)(?:\|(\w+))?\}/g, function (_, k, w) {
      const x = v[k];
      if (w) return typeof x === "number" ? plural(x, w) : "";
      return x == null ? "" : String(x);
    });
  }

  const API = { read: read, stackOpts: stackOpts, fill: fill, plural: plural };
  root.FBTower = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

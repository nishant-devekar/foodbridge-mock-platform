/* ==========================================================================
   TOWER RUNTIME — what the screen reads from the graph. (17 Oct 2026)

   The Control Tower is one graph (assets/tower/graphs/control-tower.json,
   contract fb.journey/1). The engine (assets/journey/engine.js) walks it and
   knows nothing; this file turns the walked graph into what a screen needs,
   and also knows nothing: it reads fields, never names. Change the graph and
   the tower changes: new tabs, new areas, their words, icons, colours,
   sequence, how their rows read as cards, what gates them.

     read(ev)                → { app, text, feed, tabs, areas, open, area(key) }
       tabs                  nodes with payload.view, as the graph lists them:
                             { id, label, icon, view, home }
       areas                 nodes with payload.area, as the graph lists them:
                             { key, id, label, word, icon, colour, rank,
                               source, feed, board, open, promise, state }
       open                  the areas the walk opened (not locked, not
                             skipped)
     stackOpts(model)        → the stack's rules (assets/ct/stack.js)
     fill(template, values)  "{name}" from values, "{n|word}" pluralised

   Pure: no DOM, no storage, no clock. Runs under node. It names no area and
   no business: test/tower/runtime.test.js checks.
   ========================================================================== */

(function (root) {
  "use strict";

  const plural = function (n, w) { return n + " " + (n === 1 ? w : /(s|x|ch|sh)$/.test(w) ? w + "es" : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + "ies" : w + "s"); };

  function read(ev) {
    const nodes = ev.nodes();
    const tabs = nodes.filter(function (n) { return n.payload && n.payload.view; }).map(function (n) {
      return { id: n.id, label: n.label, icon: n.payload.icon || "", view: n.payload.view, home: !!n.payload.home };
    });
    const appId = tabs.length ? ev.parent(tabs[0].id) : null;
    const app = (appId && ev.node(appId)) || { payload: {} };
    const areas = nodes.filter(function (n) { return n.payload && n.payload.area; }).map(function (n) {
      const p = n.payload;
      return { key: p.area, id: n.id, label: n.label, word: p.word || n.label, icon: p.icon || "", colour: p.colour || null,
               rank: typeof p.rank === "number" ? p.rank : 999, source: p.source || "", feed: p.feed || {}, board: p.board || {},
               open: p.open || null, promise: p.promise || "", state: n.state };
    });
    const byKey = {};
    areas.forEach(function (a) { byKey[a.key] = a; });
    return {
      app: app, text: (app.payload && app.payload.text) || {}, feed: (app.payload && app.payload.feed) || {},
      tabs: tabs, areas: areas,
      open: areas.filter(function (a) { return a.state === "available" || a.state === "done"; }),
      area: function (k) { return byKey[k] || null; },
    };
  }

  /* The stack's rules, from the graph: every open area's rank, word and feed. */
  function stackOpts(model, extra) {
    const areas = {};
    model.open.forEach(function (a) { areas[a.key] = { rank: a.rank, word: a.word, feed: a.feed }; });
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

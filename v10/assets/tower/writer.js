/* ==========================================================================
   WRITER — writes one store's flow from what the store has. (17 Oct 2026)

   The flow engine (assets/journey/flow.js) walks whatever flow it is handed
   and knows nothing. Something has to write that flow for each store: in
   time, Claude reading the store's database. Until then this file does that
   job in the browser, the same way every time, so the tower always runs on
   a flow, never on its own logic:

     the journey    the store's way in (assets/tower/graphs/store-journey.json,
                    or a flow handed over by the editor or by Claude)
     live work      every card the store's records raise today (a missed
                    drop, a payment due, a product hidden from customers),
                    built by assets/ct/stack.js with assets/tower/store-rules.json

   write(journey, cards) → { graph, facts, cards }

     graph   fb.journey/2: the urgent live work first, then the journey, then
             the rest of the live work. Each live node opens once the first
             node of its area has passed, and is done when its fact
             `live.<id>` is gone, the way any node is done on a fact.
     facts   { live: { <id>: true } } to merge into the store's facts
     cards   { <id>: the card } so the tower draws a live node with its
             record's own card

   Pure: no DOM, no storage, no clock. Runs under node.
   ========================================================================== */

(function (root) {
  "use strict";

  const safe = function (k) { return String(k).replace(/[^A-Za-z0-9_-]/g, "_"); };

  function write(journey, cards) {
    const base = (journey && journey.nodes) || [];
    const firstOf = {}, taken = {};
    base.forEach(function (n) { taken[n.id] = 1; if (n.area && !firstOf[n.area]) firstOf[n.area] = n.id; });
    const live = {}, refs = {}, urgent = [], rest = [];
    (cards || []).forEach(function (c) {
      let id = "live-" + safe(c.key);
      while (taken[id]) id += "_";
      taken[id] = 1;
      const node = { id: id, label: c.title, area: c.area, done: { fact: "live." + id, truthy: false },
                     card: { title: c.title, kicker: c.kicker || "", tone: c.tone || "", live: true } };
      if (firstOf[c.area]) node.after = [firstOf[c.area]];
      live[id] = true; refs[id] = c;
      (c.tone === "ugly" ? urgent : rest).push(node);
    });
    const graph = Object.assign({}, journey, { nodes: urgent.concat(base, rest) });
    return { graph: graph, facts: { live: live }, cards: refs };
  }

  const API = { write: write };
  root.CTWriter = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

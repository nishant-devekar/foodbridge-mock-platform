/* ==========================================================================
   CONTROL TOWER · JOURNEY VIEW — what the tower draws from a walked flow.
   (15 Oct 2026; on fb.journey/2 flows since 17 Oct 2026)

   The flow engine (assets/journey/flow.js) knows no business; this file
   knows only the tower's reading of a node's own fields:

     area                   the area the node belongs to (a field, nothing
                            more; the flow's `areas` says how it looks)
     card.title · coins     the node in a few words ("Fix {n} products",
                            {n} from card.count) and what finishing it puts
                            in the wallet
     card.ask · how · say   the question, the how, the progress line ("{n}
                            ready to sell", {n} from card.count)
     card.action · flow ·   its button: a module the tower opens, a platform
     screen · demo          screen, the new-store demo's facts
     card.announce          { on: "open"|"done", title, line } — the toast
     card.live              a node the writer made from the store's records

   Any flow that keeps to these fields draws, whatever its nodes are called
   or how many there are. Nothing here names a node id.

     home(ev, facts)        → { now, after, areas, progress, focus }
     lever(ev, facts, key)  → that area in the tower's lever shape
     moment(events, ev)     → { announce, coins, done } from one step
     earned(ev) · earnings(ev, facts) · line(n, facts) · title(n, facts)

   Pure: no DOM, no storage, no clock. Runs under node.
   ========================================================================== */

(function (root) {
  "use strict";

  const factAt = function (facts, p) { return root.FBFlow ? root.FBFlow.factAt(facts, p) : undefined; };
  const cardOf = function (n) { return (n && n.card) || {}; };
  const isLive = function (n) { return !!cardOf(n).live; };
  const counted = function (n, facts) { const c = cardOf(n); const v = c.count ? factAt(facts, c.count) : undefined; return typeof v === "number" ? v : undefined; };

  /* A node's line: its `say` with the counted fact in it, else its `ask`. */
  function line(n, facts) {
    if (!n) return "";
    const c = cardOf(n), v = counted(n, facts);
    if (c.say && v !== undefined) return c.say.replace("{n}", String(v));
    return c.ask || n.label || n.id;
  }
  /* A node in a few words: its `title`, with the counted fact in it
     ("Fix {n} products" → "Fix 6 products"; no "Fix 0 products"). */
  function title(n, facts) {
    if (!n) return "";
    const c = cardOf(n);
    if (!c.title) return n.label || c.ask || n.id;
    if (c.title.indexOf("{n}") === -1) return c.title;
    const v = counted(n, facts);
    return v !== undefined && v > 0 ? c.title.replace("{n}", String(v)) : c.title.replace("{n} ", "");
  }
  function look(ev, key) {
    const a = ((ev.graph && ev.graph.areas) || {})[key] || {};
    return { key: key, label: a.label || key, word: a.word || a.label || key, promise: a.promise || "" };
  }

  /* The thing to do now and the one after it: the walk's open nodes in order. */
  function home(ev, facts) {
    const open = ev.open().filter(function (id) { return !isLive(ev.node(id)); });
    const card = function (id) {
      const n = id && ev.node(id); if (!n) return null;
      return { id: id, title: title(n, facts), area: n.area || null, coins: Number(cardOf(n).coins) || 0, state: n.state };
    };
    const areas = {};
    ev.areas().forEach(function (a) { areas[a.key] = Object.assign({ count: a.count }, look(ev, a.key)); });
    return { now: card(open[0]), after: card(open[1]), areas: areas, progress: ev.progress(), focus: open[0] || null };
  }

  /* One area of the journey in the tower's lever shape (levers.js):
     headline, On track / To do tiles with a row per node, a status, and the
     one button its page carries. Done nodes are On track; open and optional
     nodes are To do; nodes not open yet wait out of sight. */
  const TILE = { good: "On track", bad: "Needs work", ugly: "Urgent" };
  function lever(ev, facts, key) {
    const nodes = ev.nodes().filter(function (n) { return n.area === key && n.state !== "skipped" && !isLive(n); });
    if (!nodes.length) return null;
    const L = look(ev, key);
    const locked = nodes.every(function (n) { return n.state === "locked"; });
    const next = nodes.filter(function (n) { return n.state === "open"; })[0] || nodes.filter(function (n) { return n.state === "enough"; })[0] || null;
    const row = function (n) {
      const c = cardOf(n);
      return { title: title(n, facts), jstep: n.id, now: !!next && n.id === next.id,
               note: n.state === "done" ? "Done" : n.state === "open" ? line(n, facts) : n.state === "enough" ? "Optional · " + line(n, facts) : "Opens later",
               next: Number(c.coins) && n.state !== "done" ? "+" + c.coins + " coins" : "" };
    };
    const tile = function (k, word, list) { return { label: TILE[k], word: word, value: String(list.length), count: list.length, rows: list.map(row) }; };
    const done = nodes.filter(function (n) { return n.state === "done"; });
    const todo = nodes.filter(function (n) { return n.state === "open" || n.state === "enough"; });
    const first = nodes[0], b = locked ? (ev.blockers(first.id) || { nodes: [] }) : { nodes: [] };
    const waits = b.nodes.map(function (id) { const n = ev.node(id); return n ? title(n, facts).toLowerCase() : id; }).join(" and ");
    const say = next ? line(next, facts) : "";
    return {
      id: key, label: L.label, journey: true, locked: locked, promise: L.promise,
      status: locked ? "preview" : todo.some(function (n) { return n.state === "open"; }) ? "bad" : "good",
      word: locked ? "Opens later" : null,
      cardLine: locked ? "Opens after " + (waits || "what comes first") : say || null,
      headline: locked ? { value: "Opens after " + (waits || "what comes first"), context: L.promise }
        : !next ? { value: L.label + " is set up", context: L.promise }
        : { value: say, context: say !== (cardOf(next).ask || next.label) ? (cardOf(next).ask || next.label) : (cardOf(next).how || "") },
      tiles: { good: tile("good", "Done", done), bad: tile("bad", "To do", todo), ugly: tile("ugly", "Stuck", []) },
      steps: nodes.map(function (n) { return { id: n.id, label: n.label, title: title(n, facts), state: n.state, coins: Number(cardOf(n).coins) || 0 }; }),
      action: next && !locked ? { step: next.id, label: cardOf(next).action || cardOf(next).ask || next.label,
                                  flow: cardOf(next).flow || null, screen: cardOf(next).screen || null, demo: cardOf(next).demo || null } : null,
    };
  }

  /* What one step of time is worth telling: the announce of a node that
     reached its moment, and the coins of the nodes it finished. */
  function moment(events, ev) {
    let best = null;
    (events || []).forEach(function (e) {
      const n = ev.node(e.node); if (!n || isLive(n)) return;
      const a = cardOf(n).announce;
      if (a && "node." + a.on === e.type && !best) best = { n: n, a: a };
    });
    const done = (events || []).map(function (e) { return e.type === "node.done" ? ev.node(e.node) : null; })
      .filter(function (n) { return n && !isLive(n) && Number(cardOf(n).coins); });
    return { announce: best ? Object.assign({ node: best.n.id }, best.a) : null,
             coins: done.reduce(function (s, n) { return s + Number(cardOf(n).coins); }, 0),
             done: done.map(function (n) { return cardOf(n).title ? cardOf(n).title.replace("{n} ", "") : n.label; }) };
  }

  /* Coins earned so far: every journey node with coins that is done. */
  function earnings(ev) {
    return ev.nodes().filter(function (n) { return n.state === "done" && !isLive(n) && Number(cardOf(n).coins); })
      .map(function (n) { return { id: n.id, title: cardOf(n).title ? cardOf(n).title.replace("{n} ", "") : n.label, coins: Number(cardOf(n).coins) }; });
  }
  function earned(ev) { return earnings(ev).reduce(function (s, e) { return s + e.coins; }, 0); }

  const API = { home: home, lever: lever, moment: moment, earned: earned, earnings: earnings, line: line, title: title };
  root.CTJourneyView = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

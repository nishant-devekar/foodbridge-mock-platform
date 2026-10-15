/* ==========================================================================
   CONTROL TOWER · JOURNEY VIEW — what the tower draws from a journey.
   (15 Oct 2026)

   The journey engine (assets/journey/engine.js) knows no business; this
   file knows only the Control Tower's reading of a graph's `type` and
   `payload` (assets/journey/README.md, "What the Control Tower reads"):

     a root node            a chapter: payload.line (the home's line),
                            payload.pins (the footer's two areas),
                            payload.mode "running" (today's tower)
     payload.area           the node IS that area of the tower
     a node under an area   a step: payload.ask · how · say ("{n} …" with
                            the fact named by payload.count) · screen ·
                            demo · reward
     payload.announce       { on: "available"|"done", title, line, button,
                            open } — the unlock sheet for that moment

   Any graph that keeps to these fields draws, whatever its nodes are called
   or how many there are. Nothing here names a node id.

     home(ev, facts)        → { mode, chapter, trail, cards, locked, pins, areas }
     area(ev, facts, key)   → the step sheet of one area
     moment(events, ev)     → { announce, freeDays, done } from one step

   Pure: no DOM, no storage, no clock. Runs under node.
   ========================================================================== */

(function (root) {
  "use strict";

  const factAt = function (facts, p) { return root.FBJourney ? root.FBJourney.factAt(facts, p) : undefined; };

  /* A step's line: its `say` with the counted fact in it, else its `ask`. */
  function line(stage, facts) {
    if (!stage) return "";
    const p = stage.payload || {};
    if (p.say && p.count) {
      const n = factAt(facts, p.count);
      if (typeof n === "number") return p.say.replace("{n}", String(n));
    }
    return p.ask || stage.label;
  }

  function areaOf(ev, id) {
    if (!id) return null;
    const chain = ev.path(id).concat(id).reverse();
    for (let i = 0; i < chain.length; i++) { const n = ev.node(chain[i]); if (n && n.payload.area) return n; }
    return null;
  }

  function areas(ev) {
    return ev.nodes().filter(function (n) { return n.payload.area && n.state !== "skipped"; });
  }

  function home(ev, facts) {
    const focusId = ev.focus();
    const chapterId = ev.focusAt(0) || ev.roots()[ev.roots().length - 1];
    const chapter = ev.node(chapterId);
    const running = !focusId || chapter.payload.mode === "running";
    const focusArea = areaOf(ev, focusId);
    const all = areas(ev);
    const byKey = {};
    all.forEach(function (a) { byKey[a.payload.area] = a; });

    const cards = [];
    const locked = [];
    all.forEach(function (a) {
      const next = ev.node(ev.focus(a.id));
      const isFocus = !!focusArea && focusArea.id === a.id;
      if (a.state === "locked") {
        const b = ev.blockers(a.id) || { nodes: [] };
        const after = b.nodes.map(function (id) { const n = ev.node(id); const ar = areaOf(ev, id); return ar && ar.id !== id ? ar.label + " · " + n.label.toLowerCase() : n.label; });
        locked.push({ area: a.payload.area, id: a.id, label: a.label, line: "Opens " + (a.payload.locked || (after.length ? "after " + after.join(" and ") : "later")) });
        return;
      }
      if (a.state === "available") {
        cards.push({ area: a.payload.area, id: a.id, label: a.label, tone: isFocus ? "focus" : "todo", line: line(next, facts), step: next ? next.id : null });
        return;
      }
      /* done: optional work left in it, or live. */
      if (next) cards.push({ area: a.payload.area, id: a.id, label: a.label, tone: "optional", line: line(next, facts), step: next.id });
      else cards.push({ area: a.payload.area, id: a.id, label: a.label, tone: "live", line: "", step: null });
    });
    /* The focus first; then work to do, optional work, and live areas, each in graph order. */
    const rank = { focus: 0, todo: 1, optional: 2, live: 3 };
    cards.sort(function (x, y) { return rank[x.tone] - rank[y.tone]; });

    const pins = (Array.isArray(chapter.payload.pins) ? chapter.payload.pins : []).filter(function (k) { return byKey[k]; });
    return {
      mode: running ? "running" : "journey",
      chapter: { id: chapter.id, label: chapter.label, line: chapter.payload.line || chapter.label },
      trail: ev.roots().map(function (id) { return ev.node(id); }).filter(function (n) { return n.state !== "skipped"; })
        .map(function (n) { return { id: n.id, label: n.label, state: n.state, now: n.id === chapterId }; }),
      focus: focusId ? { id: focusId, area: focusArea ? focusArea.payload.area : null, line: line(ev.node(focusId), facts) } : null,
      cards: cards,
      locked: locked,
      pins: pins.length === 2 ? pins : null,
      areas: byKey,
      progress: ev.progress(),
    };
  }

  /* One area's step sheet: its steps, the next one, and what that step offers. */
  function area(ev, facts, key) {
    const a = areas(ev).filter(function (n) { return n.payload.area === key; })[0];
    if (!a) return null;
    const leaves = [];
    (function walk(id) { const ch = ev.children(id); if (!ch.length && id !== a.id) leaves.push(ev.node(id)); ch.forEach(walk); })(a.id);
    const nextId = ev.focus(a.id);
    const next = nextId ? ev.node(nextId) : null;
    const b = ev.blockers(a.id) || { nodes: [] };
    return {
      area: key, id: a.id, label: a.label, state: a.state,
      steps: leaves.map(function (n) { return { id: n.id, label: n.label, state: n.state, optional: n.optional, now: n.id === nextId }; }),
      next: next ? { id: next.id, label: next.label, ask: next.payload.ask || next.label, how: next.payload.how || "", say: line(next, facts) !== (next.payload.ask || next.label) ? line(next, facts) : "",
                     screen: next.payload.screen || null, demo: next.payload.demo || null, reward: next.payload.reward || null, optional: next.optional } : null,
      waits: a.state === "locked" ? (a.payload.locked || "") : "",
      blockers: b.nodes,
    };
  }

  /* What one step of the journey is worth telling: the announce of the
     highest node that reached its moment, and the rewards proven in it. */
  function moment(events, ev) {
    let best = null;
    (events || []).forEach(function (e) {
      const n = ev.node(e.node); if (!n) return;
      const a = n.payload.announce;
      if (!a || "node." + a.on !== e.type) return;
      if (!best || n.depth < best.n.depth) best = { n: n, a: a };
    });
    const done = (events || []).filter(function (e) { return e.type === "node.done"; });
    const freeDays = done.reduce(function (s, e) { return s + (Number(e.payload && e.payload.reward && e.payload.reward.freeDays) || 0); }, 0);
    const labels = done.filter(function (e) { return e.payload && e.payload.reward; }).map(function (e) {
      const ar = areaOf(ev, e.node), n = ev.node(e.node);
      return ar && ar.id !== n.id ? ar.label + " · " + n.label.toLowerCase() : n.label;
    });
    return { announce: best ? Object.assign({ node: best.n.id }, best.a) : null, freeDays: freeDays, done: labels };
  }

  /* Free days earned so far: every rewarded node that is done. */
  function earned(ev) {
    return ev.nodes().filter(function (n) { return n.state === "done" && n.payload.reward; })
      .reduce(function (s, n) { return s + (Number(n.payload.reward.freeDays) || 0); }, 0);
  }

  const API = { home: home, area: area, moment: moment, earned: earned, line: line };
  root.CTJourneyView = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

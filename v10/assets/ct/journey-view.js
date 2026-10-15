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
                            demo · coins · flow (a module the tower opens) ·
                            action (its button) · cheer (the assistant's line)
     payload.announce       { on: "available"|"done", title, … } — the toast
                            for that moment
     payload.title · coins  a step in a few words (the home card) and what
                            finishing it puts in the wallet

   Any graph that keeps to these fields draws, whatever its nodes are called
   or how many there are. Nothing here names a node id.

     home(ev, facts)        → { mode, chapter, trail, cards, locked, pins, areas }
     area(ev, facts, key)   → one area: its steps and the next one
     lever(ev, facts, key)  → that area in the tower's lever shape
     moment(events, ev)     → { announce, coins, done } from one step

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

  /* A step in a few words, for the home card: its `title`, with the counted
     fact in it ("Fix {n} products" → "Fix 6 products"). */
  function title(stage, facts) {
    if (!stage) return "";
    const p = stage.payload || {};
    if (!p.title) return p.ask || stage.label;
    if (p.title.indexOf("{n}") === -1) return p.title;
    const n = p.count ? factAt(facts, p.count) : undefined;
    return typeof n === "number" && n > 0 ? p.title.replace("{n}", String(n)) : p.title.replace("{n} ", "");   // no "Fix 0 products"
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
    /* The one thing to do now, and the one after it: home shows these two
       (progressive disclosure: nothing further out is on the screen). */
    const card = function (id) {
      const n = id && ev.node(id); if (!n) return null;
      const ar = areaOf(ev, id);
      return { id: id, title: title(n, facts), area: ar ? ar.payload.area : null, coins: Number(n.payload.coins) || 0, state: n.state };
    };
    const firstLeaf = function (id) { let k = id; while (ev.children(k).length) k = ev.children(k)[0]; return k; };
    let nextId = null;
    if (focusId) {
      const open = ev.frontier().filter(function (id) { return id !== focusId && !ev.node(id).optional; });
      nextId = open[0] || ev.next(focusId).map(firstLeaf).filter(function (id) { return id !== focusId && ev.state(id) !== "done" && ev.state(id) !== "skipped"; })[0] || null;
    }
    return {
      mode: running ? "running" : "journey",
      chapter: { id: chapter.id, label: chapter.label, line: chapter.payload.line || chapter.label },
      trail: ev.roots().map(function (id) { return ev.node(id); }).filter(function (n) { return n.state !== "skipped"; })
        .map(function (n) { return { id: n.id, label: n.label, state: n.state, now: n.id === chapterId }; }),
      focus: focusId ? { id: focusId, area: focusArea ? focusArea.payload.area : null, line: line(ev.node(focusId), facts) } : null,
      now: card(focusId),
      after: card(nextId),
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
      steps: leaves.map(function (n) { return { id: n.id, label: n.label, title: title(n, facts), state: n.state, optional: n.optional, now: n.id === nextId, coins: Number(n.payload.coins) || 0 }; }),
      next: next ? { id: next.id, label: next.label, payload: next.payload, ask: next.payload.ask || next.label, how: next.payload.how || "", say: line(next, facts) !== (next.payload.ask || next.label) ? line(next, facts) : "",
                     screen: next.payload.screen || null, demo: next.payload.demo || null, coins: Number(next.payload.coins) || 0, optional: next.optional,
                     flow: next.payload.flow || null, action: next.payload.action || null, cheer: next.payload.cheer || null } : null,
      waits: a.state === "locked" ? (a.payload.locked || "") : "",
      blockers: b.nodes,
    };
  }

  /* One journey area as the tower's own lever shape (levers.js): headline,
     On track / Needs work / Urgent tiles with rows, a status — so the
     tower's original area page draws it with its own head, tiles and list.
     Tiles come from the area's payload.tiles ([{ k, word, fact }]) when the
     graph gives them, else from its steps (done · to do). `action` is the
     one button the page carries. */
  const TILE = { good: "On track", bad: "Needs work", ugly: "Urgent" };
  function lever(ev, facts, key) {
    const a = area(ev, facts, key);
    if (!a) return null;
    const node = areas(ev).filter(function (n) { return n.payload.area === key; })[0];
    const p = node.payload, n = a.next, locked = a.state === "locked";
    const tile = function (k, word, c, rows) { return { label: TILE[k], word: word, value: String(c), count: c, rows: rows || [] }; };
    const stepRow = function (st) {
      return { title: st.label, note: st.state === "done" ? "Done" : st.now ? "Do this now" : locked || st.state === "locked" ? "Opens later" : "Next",
               next: st.coins && st.state !== "done" ? "+" + st.coins + " coins" : "",
               jstep: st.id, now: !!st.now };
    };
    const tiles = {};
    if (Array.isArray(p.tiles)) {
      ["good", "bad", "ugly"].forEach(function (k) {
        const d = p.tiles.filter(function (t) { return t.k === k; })[0];
        const v = d ? factAt(facts, d.fact) : 0;
        tiles[k] = tile(k, d ? d.word : "", typeof v === "number" ? v : 0);
      });
    } else {
      const done = a.steps.filter(function (st) { return st.state === "done"; }), todo = a.steps.filter(function (st) { return st.state !== "done"; });
      tiles.good = tile("good", "Done", done.length, done.map(stepRow));
      tiles.bad = tile("bad", "To do", todo.length, todo.map(stepRow));
      tiles.ugly = tile("ugly", "Stuck", 0);
    }
    const status = locked ? "preview" : !n ? "good" : tiles.ugly.count ? "ugly" : "bad";
    const say = n ? line(n, facts) : "";
    return {
      id: key, label: a.label, journey: true, status: status, locked: locked, promise: p.promise || "",
      word: locked ? "Opens later" : null,
      cardLine: locked ? "Opens " + (a.waits || "later") : !n ? null : say,
      headline: locked ? { value: "Opens " + (a.waits || "later"), context: p.promise || "" }
        : !n ? { value: a.label + " is set up", context: p.promise || "" }
        : { value: say, context: say !== (n.payload.ask || n.label) ? (n.payload.ask || n.label) : (n.payload.how || "") },
      tiles: tiles,
      steps: a.steps,
      action: n && !locked ? { step: n.id, label: n.payload.action || n.payload.ask || n.label, flow: n.payload.flow || null, screen: n.payload.screen || null, demo: n.payload.demo || null } : null,
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
    const done = (events || []).filter(function (e) { return e.type === "node.done" && Number(e.payload && e.payload.coins); });
    const coins = done.reduce(function (s, e) { return s + Number(e.payload.coins); }, 0);
    const labels = done.map(function (e) { const n = ev.node(e.node); return n.payload.title ? n.payload.title.replace("{n} ", "") : n.label; });
    return { announce: best ? Object.assign({ node: best.n.id }, best.a) : null, coins: coins, done: labels };
  }

  /* Coins earned so far: every node with coins that is done, with when. */
  function earned(ev) {
    return ev.nodes().filter(function (n) { return n.state === "done" && Number(n.payload.coins); })
      .reduce(function (s, n) { return s + Number(n.payload.coins); }, 0);
  }
  function earnings(ev, facts) {
    return ev.nodes().filter(function (n) { return n.state === "done" && Number(n.payload.coins); })
      .map(function (n) { return { id: n.id, title: n.payload.title ? n.payload.title.replace("{n} ", "") : n.label, coins: Number(n.payload.coins) }; });
  }

  const API = { home: home, area: area, lever: lever, moment: moment, earned: earned, earnings: earnings, line: line, title: title };
  root.CTJourneyView = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

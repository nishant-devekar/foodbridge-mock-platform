/* ==========================================================================
   FLOW ENGINE — walks a flow of nodes it is handed. Knows nothing else.
   Contract fb.journey/2 (17 Oct 2026; assets/journey/FLOW.md).

   ZERO CONTEXT, ON PURPOSE. A graph is a flat list of nodes joined by
   edges. A node is one thing to do. This file reads the nodes, their edges
   (`after`) and their conditions on a plain facts object, and answers which
   node is where:

     locked    an edge into it has not passed yet
     open      its edges passed: it is to be done now
     enough    its minimum is met (`enough`): the nodes after it open, and it
               stays open as optional, to do more
     done      finished (`done`): it leaves
     skipped   not for this user (`skip`); it passes its edges like done

   A node's own fields with meaning (`area`, `card`, anything else) pass
   through untouched. This file never reads them. What any node is about
   lives in the graph and in the facts, never here.

     FBFlow.validate(graph)          → { ok, errors: [{ path, message }] }
     const F = FBFlow.load(graph)    validate + index (throws FlowError)
     F.evaluate(facts, snapshot)     → Evaluation (below)
     F.step(snapshot, facts, now)    → { snapshot, events, ev }

   Evaluation: state(id) · node(id) · nodes() · open() · focus() ·
   blockers(id) · next(id) · prev(id) · progress() · areas()

   Rules, in this sequence, per node:
     1. skip holds                          → skipped
     2. done holds (or sticky and was done) → done; proof beats sequence
     3. an edge in has not passed           → locked
        (an edge passes when its node is enough, done or skipped; `join`
        "all", the default, needs every edge, "any" one; `when` is an
        extra gate on facts)
     4. enough holds                        → enough
     5. otherwise                           → open

   Pure: no DOM, no storage, no clock of its own. Runs under node.
   ========================================================================== */

(function (root) {
  "use strict";

  const SCHEMA = "fb.journey/2";
  const STATES = ["locked", "open", "enough", "done", "skipped"];
  const PASSES = { enough: 1, done: 1, skipped: 1 };
  const OPS = ["eq", "ne", "gt", "gte", "lt", "lte", "in", "nin", "exists", "truthy", "contains"];
  const CONDS = ["skip", "done", "enough", "when"];

  function FlowError(errors) {
    const e = new Error("Flow is not valid: " + errors.map(function (x) { return x.path + " " + x.message; }).join("; "));
    e.name = "FlowError"; e.errors = errors; return e;
  }
  const isObj = function (x) { return !!x && typeof x === "object" && !Array.isArray(x); };
  const own = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

  /* ── facts: a dotted path into a plain object ("a.b.c", "list.length") */
  function factAt(facts, path) {
    if (typeof path !== "string" || !path) return undefined;
    let cur = facts;
    const parts = path.split(".");
    for (let i = 0; i < parts.length; i++) { if (cur == null) return undefined; cur = cur[parts[i]]; }
    return cur;
  }

  /* ══════════════════════════════════════════════════════════════════════
     CONDITIONS — JSON only, no code. One of:
       true | false
       { "all": [c…] }  { "any": [c…] }  { "not": c }
       { "fact": "path", "<op>": operand }   op: eq ne gt gte lt lte in nin
                                                 exists truthy contains
       { "node": "id", "is": "done" | ["enough", "done"] }
     An operand may itself be { "fact": "path" }. Several ops on one fact
     must all hold.
     ══════════════════════════════════════════════════════════════════════ */
  function checkCond(c, path, errors, ids) {
    if (c === true || c === false) return;
    if (!isObj(c)) { errors.push({ path: path, message: "must be true, false or a condition object" }); return; }
    if (own(c, "all") || own(c, "any")) {
      const k = own(c, "all") ? "all" : "any";
      if (!Array.isArray(c[k])) { errors.push({ path: path + "." + k, message: "must be an array" }); return; }
      c[k].forEach(function (x, i) { checkCond(x, path + "." + k + "[" + i + "]", errors, ids); });
      return;
    }
    if (own(c, "not")) { checkCond(c.not, path + ".not", errors, ids); return; }
    if (own(c, "node")) {
      if (!ids[c.node]) errors.push({ path: path + ".node", message: "names no node: " + c.node });
      (Array.isArray(c.is) ? c.is : [c.is]).forEach(function (s) { if (STATES.indexOf(s) === -1) errors.push({ path: path + ".is", message: "unknown state: " + s }); });
      return;
    }
    if (own(c, "fact")) {
      if (typeof c.fact !== "string" || !c.fact) { errors.push({ path: path + ".fact", message: "must be a dotted path" }); return; }
      const ops = Object.keys(c).filter(function (k) { return k !== "fact"; });
      if (!ops.length) errors.push({ path: path, message: "a fact needs an operator (" + OPS.join(", ") + ")" });
      ops.forEach(function (k) { if (OPS.indexOf(k) === -1) errors.push({ path: path + "." + k, message: "unknown operator" }); });
      return;
    }
    errors.push({ path: path, message: "unknown condition (use all, any, not, fact or node)" });
  }
  function operand(v, facts) { return isObj(v) && own(v, "fact") ? factAt(facts, v.fact) : v; }
  function cmp(op, a, b) {
    switch (op) {
      case "eq": return a === b;
      case "ne": return a !== b;
      case "gt": return typeof a === "number" && typeof b === "number" && a > b;
      case "gte": return typeof a === "number" && typeof b === "number" && a >= b;
      case "lt": return typeof a === "number" && typeof b === "number" && a < b;
      case "lte": return typeof a === "number" && typeof b === "number" && a <= b;
      case "in": return Array.isArray(b) && b.indexOf(a) !== -1;
      case "nin": return Array.isArray(b) && b.indexOf(a) === -1;
      case "exists": return (a !== undefined && a !== null) === !!b;
      case "truthy": return !!a === !!b;
      case "contains": return (Array.isArray(a) || typeof a === "string") && a.indexOf(b) !== -1;
    }
    return false;
  }
  function evalCond(c, facts, stateOf) {
    if (c === true || c === false) return c;
    if (own(c, "all")) return c.all.every(function (x) { return evalCond(x, facts, stateOf); });
    if (own(c, "any")) return c.any.some(function (x) { return evalCond(x, facts, stateOf); });
    if (own(c, "not")) return !evalCond(c.not, facts, stateOf);
    if (own(c, "node")) return (Array.isArray(c.is) ? c.is : [c.is]).indexOf(stateOf ? stateOf(c.node) : undefined) !== -1;
    const a = factAt(facts, c.fact);
    return Object.keys(c).filter(function (k) { return k !== "fact"; }).every(function (op) { return cmp(op, a, operand(c[op], facts)); });
  }

  /* ══════════════════════════════════════════════════════════════════════
     VALIDATE — every error at once, each with its JSON path, so a flow
     written by a person or a model is fixed in one pass.
     ══════════════════════════════════════════════════════════════════════ */
  function validate(g) {
    const errors = [];
    if (!isObj(g)) return { ok: false, errors: [{ path: "$", message: "must be an object" }] };
    if (g.schema !== SCHEMA) errors.push({ path: "$.schema", message: "must be \"" + SCHEMA + "\"" });
    if (typeof g.id !== "string" || !g.id) errors.push({ path: "$.id", message: "must be a non-empty string" });
    if (g.areas !== undefined && !isObj(g.areas)) errors.push({ path: "$.areas", message: "must be an object" });
    if (!Array.isArray(g.nodes) || !g.nodes.length) { errors.push({ path: "$.nodes", message: "must be a non-empty array" }); return { ok: false, errors: errors }; }
    const ids = {};
    g.nodes.forEach(function (n, i) {
      const p = "$.nodes[" + i + "]";
      if (!isObj(n)) { errors.push({ path: p, message: "must be an object" }); return; }
      if (typeof n.id !== "string" || !n.id.trim()) { errors.push({ path: p + ".id", message: "must be a non-empty string" }); return; }
      if (ids[n.id]) errors.push({ path: p + ".id", message: "repeats " + n.id });
      ids[n.id] = 1;
    });
    g.nodes.forEach(function (n, i) {
      if (!isObj(n)) return;
      const p = "$.nodes[" + i + "]";
      if (n.after !== undefined) {
        if (!Array.isArray(n.after)) errors.push({ path: p + ".after", message: "must be an array of node ids" });
        else n.after.forEach(function (a, j) {
          if (a === n.id) errors.push({ path: p + ".after[" + j + "]", message: "a node can't come after itself" });
          else if (!ids[a]) errors.push({ path: p + ".after[" + j + "]", message: "names no node: " + a });
        });
      }
      if (n.join !== undefined && n.join !== "all" && n.join !== "any") errors.push({ path: p + ".join", message: "must be \"all\" or \"any\"" });
      if (n.sticky !== undefined && typeof n.sticky !== "boolean") errors.push({ path: p + ".sticky", message: "must be true or false" });
      if (n.label !== undefined && typeof n.label !== "string") errors.push({ path: p + ".label", message: "must be a string" });
      CONDS.forEach(function (k) { if (n[k] !== undefined) checkCond(n[k], p + "." + k, errors, ids); });
    });
    if (!errors.length) {
      const cyc = cycle(g.nodes);
      if (cyc) errors.push({ path: "$.nodes", message: "edges loop: " + cyc.join(" → ") });
    }
    return { ok: !errors.length, errors: errors };
  }
  /* A loop in the edges, if any, as the ids around it. */
  function cycle(nodes) {
    const by = {}, mark = {};
    nodes.forEach(function (n) { by[n.id] = n; });
    let found = null;
    const visit = function (id, trail) {
      if (found) return;
      if (mark[id] === 2) return;
      if (mark[id] === 1) { found = trail.slice(trail.indexOf(id)).concat(id); return; }
      mark[id] = 1;
      (by[id].after || []).forEach(function (a) { visit(a, trail.concat(id)); });
      mark[id] = 2;
    };
    nodes.forEach(function (n) { visit(n.id, []); });
    return found;
  }

  /* ══════════════════════════════════════════════════════════════════════
     LOAD — index the flow once; evaluate it on any facts after.
     ══════════════════════════════════════════════════════════════════════ */
  function load(g) {
    const v = validate(g);
    if (!v.ok) throw FlowError(v.errors);
    const nodes = g.nodes, byId = {}, at = {}, succ = {};
    nodes.forEach(function (n, i) { byId[n.id] = n; at[n.id] = i; succ[n.id] = []; });
    nodes.forEach(function (n) { (n.after || []).forEach(function (a) { succ[a].push(n.id); }); });
    /* Edges first, then the graph's own listing: a node is walked after
       every node it comes after. */
    const seq = [], seen = {};
    const place = function (id) { if (seen[id]) return; seen[id] = 1; (byId[id].after || []).forEach(place); seq.push(id); };
    nodes.forEach(function (n) { place(n.id); });

    function evaluate(facts, snap) {
      const kept = (snap && snap.done) || {};
      let st = {};
      /* Twice, so a condition on a node listed later reads its state. */
      for (let pass = 0; pass < 2; pass++) {
        const prev = st, cur = {};
        const stateOf = function (id) { return own(cur, id) ? cur[id] : prev[id]; };
        seq.forEach(function (id) {
          const n = byId[id], test = function (c) { return c !== undefined && evalCond(c, facts || {}, stateOf); };
          if (test(n.skip)) { cur[id] = "skipped"; return; }
          if (test(n.done) || (n.sticky && kept[id])) { cur[id] = "done"; return; }
          const ins = (n.after || []).map(function (a) { return !!PASSES[cur[a]]; });
          let pass = n.join === "any" ? !ins.length || ins.some(Boolean) : ins.every(Boolean);
          if (pass && n.when !== undefined) pass = test(n.when);
          if (!pass) { cur[id] = "locked"; return; }
          cur[id] = test(n.enough) ? "enough" : "open";
        });
        st = cur;
      }
      const pub = function (id) { const n = byId[id]; return n ? Object.assign({}, n, { state: st[id] }) : null; };
      const listed = function (want) { return nodes.filter(function (n) { return st[n.id] === want; }).map(function (n) { return n.id; }); };
      const api = {
        graph: g,
        state: function (id) { return st[id]; },
        node: pub,
        nodes: function () { return nodes.map(function (n) { return pub(n.id); }); },
        /* What can be done now: the open nodes, then the optional ones, each as the graph lists them. */
        open: function () { return listed("open").concat(listed("enough")); },
        focus: function () { return listed("open")[0] || listed("enough")[0] || null; },
        /* What holds a node back: the edges in that have not passed, and its gate. */
        blockers: function (id) {
          const n = byId[id]; if (!n) return null;
          const nodesIn = (n.after || []).filter(function (a) { return !PASSES[st[a]]; });
          const gate = n.when !== undefined && !evalCond(n.when, facts || {}, function (k) { return st[k]; });
          return { nodes: nodesIn, gate: gate };
        },
        next: function (id) { return (succ[id] || []).slice(); },
        prev: function (id) { return byId[id] ? (byId[id].after || []).slice() : []; },
        progress: function () {
          const live = nodes.filter(function (n) { return st[n.id] !== "skipped"; });
          const done = live.filter(function (n) { return st[n.id] === "done"; }).length;
          return { done: done, total: live.length, ratio: live.length ? done / live.length : 1 };
        },
        /* The values of the nodes' `area` field, as the graph's
           `areas` lists them, then as the nodes first name them, each with
           how many of its nodes stand in each state. The engine does not
           know what an area is: it counts by a field. */
        areas: function () {
          const keys = Object.keys(isObj(g.areas) ? g.areas : {});
          nodes.forEach(function (n) { if (typeof n.area === "string" && n.area && keys.indexOf(n.area) === -1) keys.push(n.area); });
          return keys.map(function (k) {
            const count = { locked: 0, open: 0, enough: 0, done: 0, skipped: 0 };
            nodes.forEach(function (n) { if (n.area === k) count[st[n.id]]++; });
            return { key: k, count: count, nodes: nodes.filter(function (n) { return n.area === k; }).map(function (n) { return n.id; }) };
          }).filter(function (a) { return a.nodes.length; });
        },
      };
      return api;
    }

    /* One step of time: the new states, what changed, and the snapshot to keep. */
    function step(snap, facts, now) {
      const ev = evaluate(facts, snap);
      const was = (snap && snap.states) || {}, states = {}, done = Object.assign({}, (snap && snap.done) || {}), doneAt = Object.assign({}, (snap && snap.doneAt) || {});
      const events = [];
      nodes.forEach(function (n) {
        const to = ev.state(n.id), from = was[n.id];
        states[n.id] = to;
        if (to === "done") { done[n.id] = 1; if (!doneAt[n.id]) doneAt[n.id] = now || 0; }
        if (from !== undefined && from !== to) events.push({ type: "node." + to, node: n.id, from: from, to: to, at: now || 0 });
      });
      return { snapshot: { states: states, done: done, doneAt: doneAt }, events: events, ev: ev };
    }

    return { graph: g, evaluate: evaluate, step: step };
  }

  const API = { SCHEMA: SCHEMA, STATES: STATES, validate: validate, load: load, evalCond: evalCond, factAt: factAt, FlowError: FlowError };
  root.FBFlow = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

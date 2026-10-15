/* ==========================================================================
   JOURNEY ENGINE — walks a graph it is handed. Knows nothing else. (15 Oct 2026)

   ZERO CONTEXT, ON PURPOSE. This file has no idea what a business, a shop floor,
   an area or a stage is. It reads a graph (JSON, contract `fb.journey/1`,
   README.md beside this file) and a plain facts object, and answers:

     where is the user standing      cursor, its node type, its ancestors
     where did they come from        the trail (back stack), the node's sources
     where should they go next       the focus, the frontier, a node's successors
     what holds a node back          its blockers: sources not done, a gate, a parent
     what changed since last time    events: available, done, reopened, locked, skipped

   Everything with meaning lives in the graph's own `type` and `payload`
   fields, which this file passes through untouched. A new area, a new flow,
   a rotation of areas, a graph written by Claude from a live database:
   all are new JSON, never a change here.

     const J = FBJourney.load(graph)         validate + index (throws JourneyError)
     FBJourney.validate(graph)               → { ok, errors: [{ path, message }] }
     J.evaluate(facts, snapshot)             → Evaluation (states, focus, next, …)
     J.step(snapshot, facts, now)            → { snapshot, events, ev }
     J.goto(snapshot, id) · J.back(snapshot) · J.follow(snapshot) · J.mark(…)
     J.where(snapshot, facts)                → the user's position, in one object

   Pure: no DOM, no storage, no clock of its own. Snapshots are plain JSON
   the caller keeps; every call returns a new one. Runs under node.
   ========================================================================== */

(function (root) {
  "use strict";

  const SCHEMA = "fb.journey/1";
  const STATES = ["locked", "available", "done", "skipped"];
  const EDGE_KINDS = ["requires", "next"];
  const OPS = ["eq", "ne", "gt", "gte", "lt", "lte", "in", "nin", "exists", "truthy", "contains"];

  function JourneyError(errors) {
    const e = new Error("Journey graph is not valid: " + errors.map(function (x) { return x.path + " " + x.message; }).join("; "));
    e.name = "JourneyError"; e.errors = errors; return e;
  }

  const isObj = function (x) { return !!x && typeof x === "object" && !Array.isArray(x); };
  const own = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

  /* ── facts: a dotted path into a plain object ("a.b.0.c", "list.length") */
  function factAt(facts, path) {
    if (typeof path !== "string" || !path) return undefined;
    let cur = facts;
    const parts = path.split(".");
    for (let i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  /* ══════════════════════════════════════════════════════════════════════
     CONDITIONS — JSON only, no code. One of:
       true | false
       { "all": [c…] }  { "any": [c…] }  { "not": c }
       { "fact": "path", "<op>": operand }     op: eq ne gt gte lt lte in nin
                                                   exists truthy contains
       { "node": "id", "is": "done" | ["done","skipped"] }
       { "mark": "key" }                         set by J.mark, kept in the snapshot
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
      if (ids && !ids[c.node]) errors.push({ path: path + ".node", message: "names no node: " + c.node });
      const is = Array.isArray(c.is) ? c.is : [c.is];
      is.forEach(function (s) { if (STATES.indexOf(s) === -1) errors.push({ path: path + ".is", message: "unknown state: " + s }); });
      return;
    }
    if (own(c, "mark")) { if (typeof c.mark !== "string" || !c.mark) errors.push({ path: path + ".mark", message: "must be a non-empty string" }); return; }
    if (own(c, "fact")) {
      if (typeof c.fact !== "string" || !c.fact) { errors.push({ path: path + ".fact", message: "must be a dotted path" }); return; }
      const ops = Object.keys(c).filter(function (k) { return k !== "fact"; });
      if (!ops.length) errors.push({ path: path, message: "a fact needs at least one operator (" + OPS.join(", ") + ")" });
      ops.forEach(function (k) { if (OPS.indexOf(k) === -1) errors.push({ path: path + "." + k, message: "unknown operator" }); });
      return;
    }
    errors.push({ path: path, message: "unknown condition (use all, any, not, fact, node or mark)" });
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
  function evalCond(c, ctx) {
    if (c === undefined) return true;
    if (c === true || c === false) return c;
    if (own(c, "all")) return c.all.every(function (x) { return evalCond(x, ctx); });
    if (own(c, "any")) return c.any.some(function (x) { return evalCond(x, ctx); });
    if (own(c, "not")) return !evalCond(c.not, ctx);
    if (own(c, "node")) { const s = ctx.state(c.node); return (Array.isArray(c.is) ? c.is : [c.is]).indexOf(s) !== -1; }
    if (own(c, "mark")) return !!(ctx.marks && ctx.marks[c.mark]);
    const a = factAt(ctx.facts, c.fact);
    return Object.keys(c).filter(function (k) { return k !== "fact"; })
      .every(function (op) { return cmp(op, a, operand(c[op], ctx.facts)); });
  }

  /* ══════════════════════════════════════════════════════════════════════
     VALIDATE — every error at once, each with its JSON path, so a graph
     written by a person or a model can be fixed in one pass.
     ══════════════════════════════════════════════════════════════════════ */
  function validate(g) {
    const errors = [];
    if (!isObj(g)) return { ok: false, errors: [{ path: "$", message: "must be an object" }] };
    if (g.schema !== SCHEMA) errors.push({ path: "$.schema", message: "must be \"" + SCHEMA + "\"" });
    if (typeof g.id !== "string" || !g.id) errors.push({ path: "$.id", message: "must be a non-empty string" });
    if (!Array.isArray(g.nodes) || !g.nodes.length) { errors.push({ path: "$.nodes", message: "must be a non-empty array" }); return { ok: false, errors: errors }; }
    const ids = {};
    g.nodes.forEach(function (n, i) {
      const p = "$.nodes[" + i + "]";
      if (!isObj(n)) { errors.push({ path: p, message: "must be an object" }); return; }
      if (typeof n.id !== "string" || !n.id) errors.push({ path: p + ".id", message: "must be a non-empty string" });
      else if (ids[n.id]) errors.push({ path: p + ".id", message: "duplicate id: " + n.id });
      else ids[n.id] = n;
      if (typeof n.type !== "string" || !n.type) errors.push({ path: p + ".type", message: "must be a non-empty string" });
      if (n.join !== undefined && n.join !== "all" && n.join !== "any") errors.push({ path: p + ".join", message: "must be \"all\" or \"any\"" });
      if (n.payload !== undefined && !isObj(n.payload)) errors.push({ path: p + ".payload", message: "must be an object" });
      ["priority"].forEach(function (k) { if (n[k] !== undefined && typeof n[k] !== "number") errors.push({ path: p + "." + k, message: "must be a number" }); });
      ["optional", "sticky"].forEach(function (k) { if (n[k] !== undefined && typeof n[k] !== "boolean") errors.push({ path: p + "." + k, message: "must be true or false" }); });
      if (n.requires !== undefined && !Array.isArray(n.requires)) errors.push({ path: p + ".requires", message: "must be an array of node ids" });
    });
    g.nodes.forEach(function (n, i) {
      if (!isObj(n)) return;
      const p = "$.nodes[" + i + "]";
      if (n.parent != null && !ids[n.parent]) errors.push({ path: p + ".parent", message: "names no node: " + n.parent });
      if (n.parent === n.id) errors.push({ path: p + ".parent", message: "a node can't be its own parent" });
      (Array.isArray(n.requires) ? n.requires : []).forEach(function (r, k) { if (!ids[r]) errors.push({ path: p + ".requires[" + k + "]", message: "names no node: " + r }); });
      ["available", "skip"].forEach(function (k) { if (n[k] !== undefined) checkCond(n[k], p + "." + k, errors, ids); });
      if (n.done !== undefined && n.done !== "children" && n.done !== "children:any") checkCond(n.done, p + ".done", errors, ids);
    });
    (g.edges || []).forEach(function (e, i) {
      const p = "$.edges[" + i + "]";
      if (!isObj(e)) { errors.push({ path: p, message: "must be an object" }); return; }
      if (!ids[e.from]) errors.push({ path: p + ".from", message: "names no node: " + e.from });
      if (!ids[e.to]) errors.push({ path: p + ".to", message: "names no node: " + e.to });
      if (e.kind !== undefined && EDGE_KINDS.indexOf(e.kind) === -1) errors.push({ path: p + ".kind", message: "must be one of " + EDGE_KINDS.join(", ") });
    });
    if (g.edges !== undefined && !Array.isArray(g.edges)) errors.push({ path: "$.edges", message: "must be an array" });
    if (g.start !== undefined && !ids[g.start]) errors.push({ path: "$.start", message: "names no node: " + g.start });
    if (errors.length) return { ok: false, errors: errors };

    /* Parent chains end, and the gating edges never loop. A `next` edge may
       loop (a daily round, a rotation); a `requires` edge may not. */
    g.nodes.forEach(function (n, i) {
      const seen = {}; let cur = n;
      while (cur && cur.parent != null) {
        if (seen[cur.id]) { errors.push({ path: "$.nodes[" + i + "].parent", message: "parent chain loops through " + cur.id }); break; }
        seen[cur.id] = 1; cur = ids[cur.parent];
      }
    });
    if (errors.length) return { ok: false, errors: errors };
    /* What really waits on what: a node opens only inside an open parent,
       and a parent is done only when its children are. So "X requires Y"
       means every node under X waits for every leaf under Y — a loop through
       a parent is a deadlock as surely as a loop of edges. */
    const kidsOf = {};
    g.nodes.forEach(function (n) { kidsOf[n.id] = []; });
    g.nodes.forEach(function (n) { if (n.parent != null) kidsOf[n.parent].push(n.id); });
    const under = function (id) { const out = [id]; kidsOf[id].forEach(function (k) { Array.prototype.push.apply(out, under(k)); }); return out; };
    const leavesOf = function (id) { return under(id).filter(function (x) { return !kidsOf[x].length; }); };
    const into = {};
    gatingEdges(g).forEach(function (e) {
      leavesOf(e.from).forEach(function (f) { under(e.to).forEach(function (t) { (into[t] = into[t] || []).push(f); }); });
    });
    const mark = {};
    const loopAt = [];
    function visit(id, stack) {
      if (mark[id] === 2) return;
      if (mark[id] === 1) { loopAt.push(stack.concat(id).join(" → ")); return; }
      mark[id] = 1;
      (into[id] || []).forEach(function (f) { visit(f, stack.concat(id)); });
      mark[id] = 2;
    }
    Object.keys(ids).forEach(function (id) { visit(id, []); });
    if (loopAt.length) errors.push({ path: "$.edges", message: "required nodes loop: " + loopAt[0] });
    return { ok: !errors.length, errors: errors };
  }

  /* `requires` on a node is shorthand for requires-edges into it. */
  function gatingEdges(g) {
    const out = [];
    g.nodes.forEach(function (n) { (n.requires || []).forEach(function (r) { out.push({ from: r, to: n.id, kind: "requires" }); }); });
    (g.edges || []).forEach(function (e) { if ((e.kind || "requires") === "requires") out.push({ from: e.from, to: e.to, kind: "requires" }); });
    return out;
  }

  /* ══════════════════════════════════════════════════════════════════════
     LOAD — index the graph once; everything after is reads.
     ══════════════════════════════════════════════════════════════════════ */
  function load(graph) {
    const v = validate(graph);
    if (!v.ok) throw JourneyError(v.errors);
    const g = JSON.parse(JSON.stringify(graph));       // the caller's object is never held or changed
    const byId = {}, kids = {}, inReq = {}, outReq = {}, outNext = {}, inNext = {};
    g.nodes.forEach(function (n, i) { n._i = i; byId[n.id] = n; kids[n.id] = []; inReq[n.id] = []; outReq[n.id] = []; outNext[n.id] = []; inNext[n.id] = []; });
    const rank = function (a, b) { return (a.priority || 0) - (b.priority || 0) || a._i - b._i; };
    g.nodes.forEach(function (n) { if (n.parent != null) kids[n.parent].push(n); });
    Object.keys(kids).forEach(function (k) { kids[k].sort(rank); });
    const roots = g.nodes.filter(function (n) { return n.parent == null; }).sort(rank);
    gatingEdges(g).forEach(function (e) { inReq[e.to].push(e.from); outReq[e.from].push(e.to); });
    (g.edges || []).forEach(function (e) { if (e.kind === "next") { outNext[e.from].push(e.to); inNext[e.to].push(e.from); } });

    /* Tree sequence: depth first, by priority then by the graph's own listing. */
    const seqIds = [];
    (function walk(list) { list.forEach(function (n) { seqIds.push(n.id); walk(kids[n.id]); }); })(roots);
    const depth = {};
    seqIds.forEach(function (id) { const n = byId[id]; depth[id] = n.parent == null ? 0 : depth[n.parent] + 1; });

    function pub(n) {
      return n ? { id: n.id, type: n.type, label: n.label || n.id, parent: n.parent == null ? null : n.parent,
                   optional: !!n.optional, depth: depth[n.id], payload: n.payload || {} } : null;
    }

    /* ── evaluate: states from facts, to a fixed point ──────────────────── */
    function evaluate(facts, snapshot) {
      const snap = snapshot || {};
      const marks = snap.marks || {};
      const sticky = snap.doneAt || {};
      const st = {};
      seqIds.forEach(function (id) { st[id] = "locked"; });
      const ctx = { facts: facts || {}, marks: marks, state: function (id) { return st[id]; } };

      function doneOf(n) {
        if (n.sticky && sticky[n.id]) return true;
        const ch = kids[n.id];
        if (n.done === undefined || n.done === "children") {
          if (!ch.length) return !!marks[n.id];                     // a leaf with no rule is done when marked
          const need = ch.filter(function (c) { return !c.optional; });
          const set = need.length ? need : ch;
          return set.every(function (c) { return st[c.id] === "done" || st[c.id] === "skipped"; });
        }
        if (n.done === "children:any") return ch.some(function (c) { return st[c.id] === "done"; });
        return evalCond(n.done, ctx);
      }
      function sourcesMet(n) {
        const src = inReq[n.id];
        if (!src.length) return true;
        const ok = function (id) { return st[id] === "done" || st[id] === "skipped"; };
        return n.join === "any" ? src.some(ok) : src.every(ok);
      }
      const settings = g.settings || {};
      for (let pass = 0; pass < seqIds.length + 2; pass++) {
        let changed = false;
        /* Children first, so a parent's "children" rule sees this pass's children. */
        for (let i = seqIds.length - 1; i >= 0; i--) {
          const n = byId[seqIds[i]];
          let s;
          const open = sourcesMet(n) && (n.parent == null || st[n.parent] !== "locked") && evalCond(n.available, ctx);
          if ((n.parent != null && st[n.parent] === "skipped") || (n.skip !== undefined && evalCond(n.skip, ctx))) s = "skipped";   // a skipped node skips everything under it
          else if (doneOf(n) && (open || !settings.doneNeedsOpen)) s = "done";
          else s = open ? "available" : "locked";
          if (st[n.id] !== s) { st[n.id] = s; changed = true; }
        }
        if (!changed) break;
      }
      return makeEval(st, ctx);
    }

    function makeEval(st, ctx) {
      const leaves = function (id) {
        const out = [];
        (function walk(n) { if (!kids[n.id].length) out.push(n); else kids[n.id].forEach(walk); })(byId[id]);
        return out;
      };
      /* The focus: the first open leaf in tree sequence — required before optional. */
      function frontier(scope) {
        const ids = scope ? leaves(scope).map(function (n) { return n.id; }) : seqIds.filter(function (id) { return !kids[id].length; });
        return ids.filter(function (id) { return st[id] === "available"; });
      }
      function focus(scope) {
        const f = frontier(scope);
        const req = f.filter(function (id) { return !byId[id].optional && !hasOptionalAncestor(id); });
        return (req[0] || f[0]) || null;
      }
      function hasOptionalAncestor(id) { let n = byId[id]; while (n && n.parent != null) { n = byId[n.parent]; if (n.optional) return true; } return false; }
      function path(id) { const out = []; let n = byId[id]; while (n && n.parent != null) { n = byId[n.parent]; out.unshift(n.id); } return out; }
      function blockers(id) {
        const n = byId[id]; if (!n) return null;
        if (st[id] !== "locked") return { nodes: [], gate: false, parent: null };
        const ok = function (x) { return st[x] === "done" || st[x] === "skipped"; };
        const src = inReq[id];
        const waiting = n.join === "any" && src.some(ok) ? [] : src.filter(function (x) { return !ok(x); });
        let p = null, up = n;
        while (up.parent != null) { if (st[up.parent] === "locked") p = up.parent; up = byId[up.parent]; }
        return { nodes: waiting, gate: n.available !== undefined && !evalCond(n.available, ctx), parent: p };
      }
      /* Successors: what this node opens (requires), what follows it (next),
         else the next sibling in tree seqIds. */
      function next(id) {
        const out = outReq[id].concat(outNext[id]);
        if (!out.length && byId[id] && byId[id].parent != null) {
          const sib = kids[byId[id].parent]; const k = sib.indexOf(byId[id]);
          if (sib[k + 1]) out.push(sib[k + 1].id);
        }
        return out.filter(function (x, i) { return out.indexOf(x) === i; });
      }
      function prev(id) {
        const out = inReq[id].concat(inNext[id]);
        if (!out.length && byId[id] && byId[id].parent != null) {
          const sib = kids[byId[id].parent]; const k = sib.indexOf(byId[id]);
          if (k > 0) out.push(sib[k - 1].id);
        }
        return out.filter(function (x, i) { return out.indexOf(x) === i; });
      }
      function progress(id) {
        const ls = id ? leaves(id) : seqIds.filter(function (x) { return !kids[x].length; }).map(function (x) { return byId[x]; });
        const counted = ls.filter(function (n) { return st[n.id] !== "skipped" && !n.optional; });
        const done = counted.filter(function (n) { return st[n.id] === "done"; }).length;
        return { done: done, total: counted.length, ratio: counted.length ? done / counted.length : 1 };
      }
      return {
        graph: { id: g.id, version: g.version || null },
        states: Object.assign({}, st),
        state: function (id) { return st[id]; },
        node: function (id) { return byId[id] ? Object.assign(pub(byId[id]), { state: st[id] }) : null; },
        nodes: function (filter) {
          return seqIds.map(function (id) { return Object.assign(pub(byId[id]), { state: st[id] }); })
            .filter(function (n) { return !filter || Object.keys(filter).every(function (k) { return k === "payload" ? Object.keys(filter.payload).every(function (q) { return n.payload[q] === filter.payload[q]; }) : n[k] === filter[k]; }); });
        },
        roots: function () { return roots.map(function (n) { return n.id; }); },
        children: function (id) { return (kids[id] || []).map(function (n) { return n.id; }); },
        parent: function (id) { return byId[id] && byId[id].parent != null ? byId[id].parent : null; },
        path: path, frontier: frontier, focus: focus, blockers: blockers, next: next, prev: prev, progress: progress,
        /* The deepest open container on the focus path: the node a screen
           would show as "where you are" at a coarser grain (e.g. depth 0). */
        focusAt: function (depthWanted) { const f = focus(); if (!f) return null; const p = path(f).concat(f); return p[Math.min(depthWanted, p.length - 1)]; },
      };
    }

    /* ── snapshots: where the user stands, kept by the caller ───────────── */
    function blank() { return { schema: SCHEMA, graph: g.id, version: g.version || null, cursor: null, follow: true, trail: [], states: {}, since: {}, doneAt: {}, marks: {}, seq: 0 }; }
    function norm(s) {
      const b = blank();
      if (!s) return b;
      const out = Object.assign(b, JSON.parse(JSON.stringify(s)));
      /* A snapshot from another graph keeps its marks and done times for the
         ids this graph still has (a rotation, a new version): never its cursor
         into a node that no longer exists. */
      if (out.cursor && !byId[out.cursor]) out.cursor = null;
      out.trail = (out.trail || []).filter(function (id) { return byId[id]; });
      out.graph = g.id; out.version = g.version || null;
      return out;
    }

    function step(snapshot, facts, now) {
      const s = norm(snapshot);
      const at = typeof now === "number" ? now : 0;
      const ev = evaluate(facts, s);
      const events = [];
      const first = !Object.keys(s.states).length;
      seqIds.forEach(function (id) {
        const was = s.states[id], is = ev.states[id];
        if (was === is) return;
        s.since[id] = at;
        if (is === "done" && !s.doneAt[id]) s.doneAt[id] = at;
        if (!first) events.push({ type: was === "done" && is !== "done" ? "node.reopened" : "node." + is, node: id, nodeType: byId[id].type, from: was || null, at: at, payload: byId[id].payload || {} });
      });
      s.states = ev.states;
      /* The cursor follows the focus until the user steps somewhere
         themselves (goto); from then on it stays where they put it. */
      if (!s.cursor || s.follow !== false) { s.cursor = ev.focus() || g.start || roots[0].id; s.follow = true; }
      s.seq += 1;
      return { snapshot: s, events: events, ev: ev };
    }
    function goto(snapshot, id) {
      if (!byId[id]) throw JourneyError([{ path: "goto", message: "names no node: " + id }]);
      const s = norm(snapshot);
      if (s.cursor && s.cursor !== id) s.trail.push(s.cursor);
      s.trail = s.trail.slice(-50);
      s.cursor = id;
      s.follow = false;
      return s;
    }
    function back(snapshot) {
      const s = norm(snapshot);
      if (s.trail.length) s.cursor = s.trail.pop();
      s.follow = false;
      return s;
    }
    /* Hand the cursor back to the focus: it follows again from the next step. */
    function follow(snapshot) {
      const s = norm(snapshot);
      s.follow = true;
      return s;
    }
    function mark(snapshot, key, on, now) {
      const s = norm(snapshot);
      if (on === false) delete s.marks[key]; else s.marks[key] = typeof now === "number" ? now : 1;
      return s;
    }
    function where(snapshot, facts) {
      const s = norm(snapshot);
      const ev = evaluate(facts, s);
      const at = s.cursor && byId[s.cursor] ? s.cursor : (ev.focus() || g.start || roots[0].id);
      const desc = function (id) { return id ? Object.assign(ev.node(id), { blockers: ev.blockers(id), progress: ev.progress(id) }) : null; };
      return {
        at: desc(at),
        path: ev.path(at).map(desc),
        from: s.trail.length ? desc(s.trail[s.trail.length - 1]) : null,
        children: ev.children(at).map(desc),
        next: ev.next(at).map(desc),
        prev: ev.prev(at).map(desc),
        focus: desc(ev.focus()),
        progress: ev.progress(),
      };
    }

    return {
      id: g.id, version: g.version || null, label: g.label || g.id, meta: g.meta || {},
      evaluate: evaluate, step: step, goto: goto, back: back, follow: follow, mark: mark, where: where, blank: blank,
      ids: function () { return seqIds.slice(); },
    };
  }

  const API = { SCHEMA: SCHEMA, STATES: STATES, OPS: OPS, load: load, validate: validate, evalCond: evalCond, factAt: factAt, JourneyError: JourneyError };
  root.FBJourney = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

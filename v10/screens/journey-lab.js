/* ==========================================================================
   JOURNEY LAB — inject a graph and facts, watch the engine walk them.
   (15 Oct 2026)

   The page only draws what FBJourney answers. Everything it shows comes
   from evaluate() / step() / where(), so what works here works in any
   screen that hands the engine a graph. The position (snapshot) is kept per
   device, as a screen would keep it.

   From devtools, or a script Claude writes:
     FBJourneyLab.inject(graphObject, factsObject)
   ========================================================================== */

(function () {
  "use strict";

  const KEY = "fb.v7.journey.lab";
  const GRAPH_URL = "../assets/journey/graphs/store-journey.json?v=20261015JE1";
  const $ = function (s) { return document.querySelector(s); };
  const esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  const F = window.CTJourneyFacts;

  const PRESETS = {
    new: {},
    products: { products: { count: 42, broken: 3, incomplete: 8 } },
    active: { products: { count: 42, broken: 0, incomplete: 8 }, customers: { count: 18, broken: 0, incomplete: 12 } },
    first: { products: { count: 42, broken: 0, incomplete: 8 }, customers: { count: 18, broken: 0, incomplete: 12 }, orders: { count: 1, days: 1, sent: 1 } },
    day: { products: { count: 42, broken: 0, incomplete: 0 }, customers: { count: 18, broken: 0, incomplete: 0, noTerms: 4 }, orders: { count: 6, days: 2, sent: 6 },
           deliveries: { count: 5, vans: 1, daysClosed: 1 }, payments: { count: 3 } },
    maker: { business: { makes: true } },
    all: { products: { count: 42, broken: 0, incomplete: 0 }, customers: { count: 18, broken: 0, incomplete: 0, noTerms: 0 }, orders: { count: 30, days: 9, sent: 30 },
           deliveries: { count: 25, vans: 2, daysClosed: 5 }, payments: { count: 12 }, dues: { imported: true }, stock: { counted: 42, unknown: 0 },
           suppliers: { count: 3, unmapped: 0 }, purchases: { received: 1 } },
  };

  let J = null, facts = null, snap = null, log = [];

  function read() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ snap: snap, log: log.slice(-60) })); } catch (e) { /* per device only */ } }

  function parse(id) {
    try { return { ok: true, value: JSON.parse($(id).value) }; }
    catch (e) { return { ok: false, error: id.slice(1) + ": " + e.message }; }
  }

  function apply() {
    const gx = parse("#graph"), fx = parse("#facts");
    const errs = [gx, fx].filter(function (x) { return !x.ok; }).map(function (x) { return { path: "JSON", message: x.error }; });
    if (!errs.length) {
      const v = window.FBJourney.validate(gx.value);
      if (!v.ok) Array.prototype.push.apply(errs, v.errors);
    }
    $("#errs").innerHTML = errs.map(function (e) { return "<li><b>" + esc(e.path) + "</b> " + esc(e.message) + "</li>"; }).join("");
    if (errs.length) { $("#okmsg").textContent = ""; return errs; }
    const first = !J || J.id !== gx.value.id || J.version !== (gx.value.version || null);
    J = window.FBJourney.load(gx.value);
    facts = fx.value;
    const r = J.step(snap, facts, Date.now());
    snap = r.snapshot;
    const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    r.events.forEach(function (e) { log.push(t + "  " + e.type.replace("node.", "") + "  " + e.node + (e.payload && e.payload.reward ? "  · reward " + JSON.stringify(e.payload.reward) : "")); });
    $("#okmsg").textContent = (first ? "Loaded " : "Applied ") + J.label + " · v" + (J.version || "–") + (r.events.length ? " · " + r.events.length + " changed" : "");
    save();
    draw();
    return null;
  }

  function draw() {
    if (!J) return;
    const ev = J.evaluate(facts, snap);
    const w = J.where(snap, facts);
    const focus = ev.focus();
    const p = ev.progress();
    $("#bar").style.width = Math.round(p.ratio * 100) + "%";
    $("#prog").textContent = p.done + " of " + p.total + " required steps done" + (focus ? " · focus: " + ev.node(focus).label : " · nothing left open");

    $("#tree").innerHTML = ev.nodes().map(function (n) {
      return '<button type="button" class="node' + (w.at && w.at.id === n.id ? " cur" : "") + '" data-id="' + esc(n.id) + '" style="padding-left:' + (8 + n.depth * 18) + 'px" aria-label="' + esc(n.label + ", " + n.type + ", " + n.state) + '">' +
        '<span class="t">' + (n.id === focus ? '<span class="star" title="Focus">★</span>' : "") + "<b>" + esc(n.label) + '</b><span class="ty">' + esc(n.type) + "</span>" + (n.optional ? '<span class="opt">optional</span>' : "") + "</span>" +
        '<span class="st" data-s="' + n.state + '">' + n.state + "</span></button>";
    }).join("");

    const blk = function (n) {
      const b = n.blockers;
      if (!b || n.state !== "locked") return "";
      const parts = [];
      if (b.nodes.length) parts.push("waits for " + b.nodes.map(function (id) { return ev.node(id).label; }).join(", "));
      if (b.parent) parts.push("inside " + ev.node(b.parent).label + ", which is locked");
      if (b.gate) parts.push("its own gate is shut");
      return parts.join(" · ");
    };
    const item = function (n) {
      return '<div class="li"><span><b>' + esc(n.label) + "</b> <span class=\"st\" data-s=\"" + n.state + "\">" + n.state + "</span><small>" + esc(n.type + (blk(n) ? " · " + blk(n) : "")) + "</small></span>" +
        '<button type="button" data-id="' + esc(n.id) + '">Go</button></div>';
    };
    const at = w.at;
    $("#where").innerHTML =
      '<div class="crumbs">' + (w.path.length ? w.path.map(function (x) { return esc(x.label); }).join(" › ") + " ›" : "Top level") + "</div>" +
      '<div class="big">' + esc(at.label) + ' <span class="st" data-s="' + at.state + '">' + at.state + "</span></div>" +
      '<dl class="kv"><dt>Node type</dt><dd><code>' + esc(at.type) + "</code></dd>" +
        "<dt>Came from</dt><dd>" + (w.from ? esc(w.from.label) : "—") + "</dd>" +
        "<dt>Progress</dt><dd>" + at.progress.done + " of " + at.progress.total + "</dd>" +
        (blk(at) ? "<dt>Held by</dt><dd>" + esc(blk(at)) + "</dd>" : "") + "</dl>" +
      '<div class="row"><button type="button" id="back"' + (snap.trail.length ? "" : " disabled") + ">‹ Back</button>" +
        '<button type="button" class="go" id="toFocus"' + (snap.follow === false ? "" : " disabled") + ">Follow the focus" + (focus ? " · " + esc(ev.node(focus).label) : "") + "</button></div>" +
      (w.children.length ? "<h2>Inside</h2><div class=\"list\">" + w.children.map(item).join("") + "</div>" : "") +
      (w.next.length ? "<h2>Next</h2><div class=\"list\">" + w.next.map(item).join("") + "</div>" : "") +
      "<h2>Payload · read by the screen, not the engine</h2><pre class=\"payload\">" + esc(JSON.stringify(at.payload, null, 2)) + "</pre>";

    $("#marks").innerHTML = Object.keys(snap.marks || {}).map(function (k) { return '<button type="button" class="mark" data-mark="' + esc(k) + '" title="Remove">' + esc(k) + " ✕</button>"; }).join("");
    $("#log").innerHTML = log.slice().reverse().map(function (l) { return "<div>" + esc(l) + "</div>"; }).join("");
  }

  function setPreset(id) { $("#facts").value = JSON.stringify(F.blank(JSON.parse(JSON.stringify(PRESETS[id] || {}))), null, 2); }

  document.addEventListener("click", function (e) {
    const g = e.target.closest("[data-id]");
    if (g && J) { snap = J.goto(snap, g.dataset.id); save(); draw(); return; }
    const m = e.target.closest("[data-mark]");
    if (m && J) { snap = J.mark(snap, m.dataset.mark, false); apply(); return; }
    if (e.target.id === "back" && J) { snap = J.back(snap); save(); draw(); }
    if (e.target.id === "toFocus" && J) { snap = J.follow(snap); apply(); }
  });
  $("#apply").addEventListener("click", apply);
  $("#preset").addEventListener("change", function () { setPreset(this.value); apply(); });
  $("#markBtn").addEventListener("click", function () {
    const k = $("#markKey").value.trim(); if (!k || !J) return;
    snap = J.mark(snap, k, !(snap.marks && snap.marks[k]), Date.now()); $("#markKey").value = ""; apply();
  });
  $("#reset").addEventListener("click", function () { snap = null; log = []; save(); apply(); });

  window.FBJourneyLab = {
    inject: function (graph, f) {
      if (graph) $("#graph").value = JSON.stringify(graph, null, 2);
      if (f) $("#facts").value = JSON.stringify(f, null, 2);
      const errs = apply();
      return errs ? { ok: false, errors: errs } : { ok: true, where: J.where(snap, facts) };
    },
    where: function () { return J ? J.where(snap, facts) : null; },
  };

  const kept = read();
  if (kept) { snap = kept.snap || null; log = kept.log || []; }
  setPreset("new");
  fetch(GRAPH_URL).then(function (r) { return r.json(); }).then(function (g) {
    $("#graph").value = JSON.stringify(g, null, 2);
    apply();
  }).catch(function (e) { $("#errs").innerHTML = "<li>Couldn't load the store journey graph: " + esc(e.message) + ". Paste a graph and press Apply.</li>"; });
})();

/* ==========================================================================
   DELIVERY MANAGEMENT — telling the office what went wrong (24 Sep 2026)

   Not in the upstream app: the capture points the Control Tower's incident
   engine needs (v7/context/control-tower/CONTROL_TOWER_INCIDENTS.md §10).

     Report a problem   /problem/:routeId          the van: breakdown,
                                                   accident, puncture, fridge
     What's wrong here? /issue/:routeId/:stopId    the customer: disputes the
                                                   order, price or scheme; a
                                                   quality complaint; says it
                                                   never came

   Each writes one line to the platform's event stream (assets/fb-events.js),
   and nothing else: the office sees it in the tower within a second.

   RD_EMIT is the one helper every screen in this app uses to write there.
   ========================================================================== */

(function () {
  "use strict";
  const U = window.RD_UI, D = window.RD_DB;

  /* One line to the stream, with who and where; never breaks the screen. */
  window.RD_EMIT = function (type, route, stop, data, where, subject, note) {
    if (!window.FB_EVENTS) return null;
    try {
      return window.FB_EVENTS.emit(type, Object.assign({
        by: route && route.driver ? String(route.driver.name || "").split(" ")[0] : null,
        where: where || "Delivery app",
        subject: Object.assign({ customer: stop ? stop.customerName : null, van: route ? route.name : null }, subject || {}),
        data: data || {},
      }, note ? { note: note } : {}));
    } catch (e) { return null; }
  };
  function routeOf(id) { return D.db.routeDetails[id] || null; }
  function stopOf(routeId, stopId) { return D.getStops(routeId).filter(function (s) { return s.id === stopId; })[0] || null; }

  function chipGrid(list, sel, act) {
    return '<div style="' + U.sty({ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 16px" }) + '">' +
      list.map(function (r) {
        const on = sel === r.key;
        return '<button type="button" class="rd-chip"' + U.act(act, r.key) + ' style="' + U.sty({
          padding: "12px 14px", borderRadius: 12, fontSize: 14.5, fontWeight: 600, cursor: "pointer",
          flex: "1 1 calc(50% - 8px)", textAlign: "center",
          border: "2px solid " + (on ? U.BRAND : "#e5e7eb"), background: on ? "#e8f5f7" : "white", color: on ? U.BRAND : "#555",
        }) + '">' + r.icon + " " + r.label + "</button>";
      }).join("") + "</div>";
  }
  function noteBox(model, value, ph) {
    return '<div style="' + U.sty({ padding: "0 12px", marginTop: 8 }) + '">' +
      '<label style="' + U.sty({ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6, display: "block" }) + '">Note (optional)</label>' +
      '<input data-model="' + model + '" value="' + U.esc(value || "") + '" placeholder="' + U.esc(ph) + '" style="' + U.sty({
        width: "100%", padding: "14px 16px", border: "2px solid #e5e7eb", borderRadius: 14, fontSize: 15, fontWeight: 500,
        color: "#111", background: "#fafafa", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }) + '" /></div>';
  }

  /* ══ Report a problem: the van ═════════════════════════════════════════ */
  const PROBLEMS = [
    { key: "breakdown", icon: "🛠️", label: "Breakdown" },
    { key: "puncture", icon: "🛞", label: "Puncture" },
    { key: "accident", icon: "🚨", label: "Accident" },
    { key: "fridge", icon: "❄️", label: "Fridge not cooling" },
  ];
  window.RD.screen("problem", function (p) {
    const route = routeOf(p.routeId);
    const S = window.RD.state.scratch;
    const left = D.getStops(p.routeId).filter(function (s) { return s.status === "PENDING" || s.status === "CURRENT"; }).length;
    return U.MobileHeader({ title: "Report a problem", subtitle: (route ? route.name : "") + " · " + left + " stop" + (left === 1 ? "" : "s") + " left", backLabel: "Delivery Stops", backAct: "back" }) +
      '<div class="rd-body" style="background:' + U.BG + '">' + U.Spacer() +
        U.SectionHeader("What happened to the van?") + chipGrid(PROBLEMS, S.problemKind, "problem-kind") +
        (S.problemKind === "accident" ? U.Banner({ type: "orange", icon: "⚠️", text: "If anyone is hurt, call for help first. The office is told as soon as you send this.", style: { marginTop: 10 } }) : "") +
        noteBox("problem-where", S.problemWhere, "Where are you? e.g. Near the 4th Block signal") + U.Spacer() +
      "</div>" +
      U.ActionBar(U.BtnXL({ variant: S.problemKind ? "brand" : "grey", label: "Tell the office", disabled: !S.problemKind, actName: "problem-send", arg: p.routeId }));
  });
  window.RD.action("problem-kind", function (k) { window.RD.state.scratch.problemKind = k; window.RD.render(); });
  window.RD.action("model:problem-where", function (v) { window.RD.state.scratch.problemWhere = v; });
  window.RD.action("problem-send", function (routeId) {
    const S = window.RD.state.scratch;
    if (!S.problemKind) return;
    window.RD.commit(function () {
      window.RD_EMIT("problem.reported", routeOf(routeId), null, { kind: S.problemKind, where: (S.problemWhere || "").trim() || null }, "Delivery app · Report a problem");
      S.problemKind = null; S.problemWhere = "";
      window.RD.toast("The office knows. They'll move your stops if they need to.");
      window.RD.go("/queue/" + routeId);
    });
  });

  /* ══ What's wrong here? The customer ══════════════════════════════════ */
  const ISSUES = [
    { key: "order", icon: "📋", label: "Disputes the order" },
    { key: "price", icon: "₹", label: "Disputes the price" },
    { key: "scheme", icon: "🏷️", label: "Disputes the scheme" },
    { key: "quality", icon: "⚠️", label: "Quality complaint" },
    { key: "pod", icon: "📦", label: "Says it never came" },
  ];
  window.RD.screen("issue", function (p) {
    const stop = stopOf(p.routeId, p.stopId);
    if (!stop) throw new Error("Stop " + p.stopId + " not found");
    const S = window.RD.state.scratch;
    return U.MobileHeader({ title: "What's wrong here?", backLabel: stop.customerName, backAct: "back" }) +
      '<div class="rd-body" style="background:' + U.BG + '">' + U.Spacer() +
        U.SectionHeader("The customer…") + chipGrid(ISSUES, S.issueKind, "issue-kind") +
        noteBox("issue-note", S.issueNote, "What did they say?") + U.Spacer() +
      "</div>" +
      U.ActionBar(U.BtnXL({ variant: S.issueKind ? "brand" : "grey", label: "Tell the office", disabled: !S.issueKind, actName: "issue-send", arg: p.stopId }));
  });
  window.RD.action("issue-kind", function (k) { window.RD.state.scratch.issueKind = k; window.RD.render(); });
  window.RD.action("model:issue-note", function (v) { window.RD.state.scratch.issueNote = v; });
  window.RD.action("issue-send", function (stopId) {
    const S = window.RD.state.scratch;
    if (!S.issueKind) return;
    const routeId = window.RD.state.routeId;
    window.RD.commit(function () {
      const stop = stopOf(routeId, stopId) || {};
      const it = ISSUES.filter(function (x) { return x.key === S.issueKind; })[0];
      window.RD_EMIT("dispute.raised", routeOf(routeId), stop, { kind: S.issueKind, why: (S.issueNote || "").trim() || it.label.toLowerCase(),
        value: Number(stop.todayOrderAmount) || null }, "Delivery app · What's wrong here?");
      S.issueKind = null; S.issueNote = "";
      window.RD.toast("Sent to the office.");
      window.RD.back();
    });
  });

  /* ══ Proof at the door ════════════════════════════════════════════════ */
  window.RD.action("stop-proof", function (stopId) {
    const routeId = window.RD.state.routeId;
    const stop = stopOf(routeId, stopId) || {};
    window.RD.state.scratch.stopActions = false;
    window.RD_EMIT("pod.captured", routeOf(routeId), stop, { photo: true, signature: true }, "Delivery app · Stop summary");
    window.RD.toast("Photo and signature saved with this delivery.");
  });
})();

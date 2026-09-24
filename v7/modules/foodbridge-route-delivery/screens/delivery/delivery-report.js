/* ==========================================================================
   DELIVERY MANAGEMENT — reporting to the office (24 Sep 2026)

   Not in the upstream app: the capture points the Control Tower's incident
   engine needs (v7/context/control-tower/CONTROL_TOWER_INCIDENTS.md §10),
   built the way every other decision in this app is built — pick one reason
   from a list, add a note, then a two-card confirm before anything is sent.

     Report an Issue    /issue/:routeId/:stopId   the customer: disputes the
                        order, price or scheme; says it never came; can't
                        pay; a quality complaint; can't park or unload;
                        only takes deliveries at set hours.
                        From the stop's ⋮ menu, or More Actions.
     Report a Problem   /problem/:routeId         the van or the road:
                        breakdown, puncture, accident, fridge, temperature,
                        traffic, road closed. From the queue's ⋮ menu.
     Proof of Delivery  a sheet: a photo from the camera and the customer's
                        signature. From Payment Collected, and More Actions
                        on a delivered stop, until the route settles.

   Each writes one line to the platform's event stream (RD_EMIT, in
   delivery-office.js); the office sees it in the tower within a second.
   ========================================================================== */

(function () {
  "use strict";
  const U = window.RD_UI, D = window.RD_DB;

  function routeOf(id) { return D.db.routeDetails[id] || null; }
  function stopOf(routeId, stopId) { return D.getStops(routeId).filter(function (s) { return s.id === stopId; })[0] || null; }
  function lineSum(routeId, stopId) {
    const det = D.resolveStopDetail(routeId, stopId) || {};
    return (det.orderItems || []).reduce(function (a, x) { return a + x.qty * (x.unitPrice || 0); }, 0);
  }
  // What the customer owes today: the carried balance, plus today's order
  // until it has been delivered and billed.
  function dueOf(routeId, stop) {
    return Math.round((stop.outstandingAmount || 0) + (stop.status === "DELIVERED" ? 0 : lineSum(routeId, stop.id)));
  }
  function refocus(model) {
    const el = document.querySelector('[data-model="' + model + '"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }

  /* ══ Report an Issue: the customer ════════════════════════════════════ */
  const ISSUE_GROUPS = [
    { label: "The Customer Disputes", options: [
      { key: "order",  icon: "📋", label: "The Order",          sub: "Items or quantities aren't what they asked for" },
      { key: "price",  icon: "₹",  label: "The Price",          sub: "Won't pay the billed rate" },
      { key: "scheme", icon: "🏷️", label: "A Scheme or Offer",  sub: "Claims a discount or free goods" },
      { key: "pod",    icon: "📦", label: "That It Came",       sub: "Says an earlier delivery never arrived" },
    ] },
    { label: "Payment", options: [
      { key: "cash",   icon: "💵", label: "No Cash Ready",      sub: "Ask the office before leaving it on credit" },
      { key: "upi",    icon: "📱", label: "UPI Not Going Through", sub: "The payment fails or doesn't arrive" },
      { key: "cheque", icon: "🧾", label: "Cheque Problem",     sub: "A cheque bounced or is disputed" },
    ] },
    { label: "At the Shop", options: [
      { key: "quality", icon: "⚠️", label: "Quality Complaint", sub: "Unhappy with the product" },
      { key: "parking", icon: "🅿️", label: "No Parking or Loading", sub: "The van can't stop or unload here" },
      { key: "hours",   icon: "🕐", label: "Set Delivery Hours", sub: "Only takes deliveries at certain times" },
    ] },
  ];
  const ISSUES = [].concat.apply([], ISSUE_GROUPS.map(function (g) { return g.options; }));
  const PAYMENT = { cash: "CASH", upi: "UPI", cheque: "CHEQUE" };
  const needsAmount = function (k) { return k === "price" || k === "scheme"; };
  // How the chosen reason reads in a sentence, for the confirm panel.
  const ISSUE_SAYS = { order: "Disputes the order", price: "Disputes the price", scheme: "Disputes the scheme", pod: "Says it never came",
                       cash: "No cash ready", upi: "UPI not going through", cheque: "Cheque problem",
                       quality: "Quality complaint", parking: "No parking or loading", hours: "Set delivery hours" };

  window.RD.screen("issue", function (p) {
    const stop = stopOf(p.routeId, p.stopId);
    if (!stop) throw new Error("Stop " + p.stopId + " not found");
    const S = window.RD.state.scratch;
    const kind = S.issueKind || null;
    const gap = Number(S.issueGap) || 0;
    const confirming = !!S.issueConfirming;
    const due = dueOf(p.routeId, stop);
    const chosen = ISSUES.filter(function (x) { return x.key === kind; })[0] || null;

    const amountField = needsAmount(kind)
      ? '<label style="' + U.sty({ display: "block", fontSize: 12, fontWeight: 700, color: U.BRAND, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }) + '">Amount in dispute</label>' +
        '<div style="' + U.sty({ position: "relative" }) + '">' +
          '<span style="' + U.sty({ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#9ca3af", fontWeight: 600, pointerEvents: "none" }) + '">₹</span>' +
          '<input data-model="issue-gap" inputmode="numeric" value="' + U.esc(S.issueGap || "") + '" placeholder="e.g. 120" style="' + U.sty({
            width: "100%", padding: "12px 14px 12px 32px", border: "2px solid " + U.BRAND, borderRadius: 12, fontSize: 17, fontWeight: 700,
            color: "#111", background: "white", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }) + '" /></div>'
      : PAYMENT[kind]
      ? '<div style="' + U.sty({ fontSize: 13, color: U.BRAND, fontWeight: 600 }) + '">' + U.inr(due) + " due today. The office decides whether to leave it on credit.</div>"
      : "";

    const ready = !!kind && (!needsAmount(kind) || gap > 0);
    const cta = !kind ? "Choose what's wrong" : !ready ? "Enter the amount in dispute" : "Report Issue";
    const note = (S.issueNote || "").trim();

    return U.MobileHeader({ title: "Report an Issue", backLabel: stop.customerName, backAct: "back" }) +
      '<div class="rd-body" style="' + U.sty({ background: U.BG, opacity: confirming ? 0.38 : 1, pointerEvents: confirming ? "none" : "auto", transition: "opacity 0.2s" }) + '">' +
        U.NoteField({ label: "What happened? (optional)", model: "issue-note", value: S.issueNote, placeholder: "Type or speak what they said", typePlaceholder: "What did they say?", style: { marginTop: 12 } }) +
        U.Spacer(4) +
        U.ChoiceList({ groups: ISSUE_GROUPS, value: kind, actName: "issue-kind", detail: amountField }) +
        U.Spacer() +
      "</div>" +
      (confirming ? U.FreezeBackdrop() : "") +
      '<div style="' + U.sty({ position: "relative", zIndex: confirming ? 50 : "auto" }) + '">' + U.ActionBar(confirming
        ? U.ConfirmPanel({
            action: "Report to Office", amount: chosen ? chosen.icon + " " + ISSUE_SAYS[kind] : "",
            context: stop.customerName + (needsAmount(kind) ? " · " + U.inr(gap) + " in dispute" : PAYMENT[kind] ? " · " + U.inr(due) + " due" : ""),
            backLabel: "Change", commitLabel: "Send to Office",
            backAct: "issue-confirm-cancel", commitAct: "issue-send", arg: p.stopId,
            processing: !!S.committing, processingLabel: "Sending to office…",
            extra: note ? U.Quote(note) : "",
          })
        : U.BtnXL({ variant: ready ? "brand" : "grey", label: cta, disabled: !ready, actName: "issue-confirm" })) + "</div>";
  });
  window.RD.action("issue-kind", function (k) { window.RD.state.scratch.issueKind = k; window.RD.render(); });
  window.RD.action("model:issue-note", function (v) { window.RD.state.scratch.issueNote = v; });
  window.RD.action("model:issue-gap", function (v) {
    const S = window.RD.state.scratch, had = Number(S.issueGap) > 0;
    S.issueGap = String(v).replace(/\D/g, "");
    if (had !== Number(S.issueGap) > 0) { window.RD.render(); refocus("issue-gap"); }
  });
  window.RD.action("issue-confirm", function () { window.RD.state.scratch.issueConfirming = true; window.RD.render(); });
  window.RD.action("issue-confirm-cancel", function () { window.RD.state.scratch.issueConfirming = false; window.RD.render(); });
  window.RD.action("issue-send", function (stopId) {
    const S = window.RD.state.scratch;
    if (!S.issueKind) return;
    const routeId = window.RD.state.routeId;
    window.RD.commit(function () {
      const stop = stopOf(routeId, stopId) || {};
      const it = ISSUES.filter(function (x) { return x.key === S.issueKind; })[0];
      const sum = lineSum(routeId, stopId);
      const note = (S.issueNote || "").trim() || null;
      if (PAYMENT[S.issueKind]) {
        // Can't pay: the office's own "payment" incidents, for the whole
        // amount due today.
        window.RD_EMIT("payment.failed", routeOf(routeId), stop, { amount: dueOf(routeId, stop) || null, method: PAYMENT[S.issueKind], note: note },
          "Delivery app · Report an issue");
      } else {
        const gap = needsAmount(S.issueKind) && Number(S.issueGap) > 0 ? Number(S.issueGap) : null;
        window.RD_EMIT("dispute.raised", routeOf(routeId), stop, { kind: S.issueKind, why: note || ISSUE_SAYS[S.issueKind].toLowerCase(),
          value: Math.round(sum) || Number(stop.todayOrderAmount) || null, gap: gap,
          billed: gap ? Math.round(sum) : null, paid: gap ? Math.round(sum - gap) : null }, "Delivery app · Report an issue");
      }
      S.issueKind = null; S.issueNote = ""; S.issueGap = ""; S.issueConfirming = false;
      window.RD.toast({ title: "Sent to office", detail: (it ? ISSUE_SAYS[it.key] : "Issue") + " · " + (stop.customerName || "") });
      window.RD.back();
    });
  });

  /* ══ Report a Problem: the van or the road ════════════════════════════ */
  const PROBLEM_GROUPS = [
    { label: "The Van", options: [
      { key: "breakdown",   icon: "🛠️", label: "Breakdown",          sub: "Won't start, or stopped on the road" },
      { key: "puncture",    icon: "🛞", label: "Puncture",           sub: "A flat tyre" },
      { key: "accident",    icon: "🚨", label: "Accident",           sub: "A collision, or damage to the van" },
      { key: "fridge",      icon: "❄️", label: "Fridge Not Cooling", sub: "The chiller unit has stopped" },
      { key: "temperature", icon: "🌡️", label: "Temperature Out of Range", sub: "Cold-chain goods are getting warm" },
    ] },
    { label: "The Road", options: [
      { key: "traffic", icon: "🚦", label: "Traffic Jam", sub: "Stuck and running late" },
      { key: "road",    icon: "⛔", label: "Road Closed", sub: "No way through to the next stops" },
    ] },
  ];
  const PROBLEMS = [].concat.apply([], PROBLEM_GROUPS.map(function (g) { return g.options; }));

  window.RD.screen("problem", function (p) {
    const route = routeOf(p.routeId);
    if (!route) throw new Error("Route " + p.routeId + " not found");
    const S = window.RD.state.scratch;
    const kind = S.problemKind || null;
    const confirming = !!S.problemConfirming;
    const left = D.getStops(p.routeId).filter(function (s) { return s.status === "PENDING" || s.status === "CURRENT"; }).length;
    const chosen = PROBLEMS.filter(function (x) { return x.key === kind; })[0] || null;
    const open = window.RD_OFFICE ? window.RD_OFFICE.openProblem(p.routeId) : null;
    const where = (S.problemWhere || "").trim();

    return U.MobileHeader({ title: "Report a Problem", subtitle: route.name + " · " + left + " stop" + (left === 1 ? "" : "s") + " left", backLabel: "Delivery Stops", backAct: "back" }) +
      '<div class="rd-body" style="' + U.sty({ background: U.BG, opacity: confirming ? 0.38 : 1, pointerEvents: confirming ? "none" : "auto", transition: "opacity 0.2s" }) + '">' +
        (open ? U.Banner({ type: "orange", icon: "⚠️", text: window.RD_OFFICE.problemWord(open.kind) + " reported at " + window.RD_OFFICE.at(open.at) + " is still open. The office has it.", style: { marginTop: 8 } }) : "") +
        (kind === "accident" ? U.Banner({ type: "red", icon: "🚑", text: "If anyone is hurt, call 112 first. Then send this — the office is told at once.", style: { marginTop: 8 } }) : "") +
        U.NoteField({ label: "Where are you? (optional)", model: "problem-where", value: S.problemWhere, placeholder: "Type or speak where you are, e.g. near the 4th Block signal", typePlaceholder: "e.g. Near the 4th Block signal", style: { marginTop: 12 } }) +
        U.Spacer(4) +
        U.ChoiceList({ groups: PROBLEM_GROUPS, value: kind, actName: "problem-kind" }) +
        U.Spacer() +
      "</div>" +
      (confirming ? U.FreezeBackdrop() : "") +
      '<div style="' + U.sty({ position: "relative", zIndex: confirming ? 50 : "auto" }) + '">' + U.ActionBar(confirming
        ? U.ConfirmPanel({
            action: "Report to Office", amount: chosen ? chosen.icon + " " + chosen.label : "",
            context: route.name + " · " + left + " stop" + (left === 1 ? "" : "s") + " left",
            backLabel: "Change", commitLabel: "Send to Office",
            backAct: "problem-confirm-cancel", commitAct: "problem-send", arg: p.routeId,
            processing: !!S.committing, processingLabel: "Sending to office…",
            extra: where ? U.Quote("At " + where) : "",
          })
        : U.BtnXL({ variant: kind ? "brand" : "grey", label: kind ? "Report Problem" : "Choose what happened", disabled: !kind, actName: "problem-confirm" })) + "</div>";
  });
  window.RD.action("problem-kind", function (k) { window.RD.state.scratch.problemKind = k; window.RD.render(); });
  window.RD.action("model:problem-where", function (v) { window.RD.state.scratch.problemWhere = v; });
  window.RD.action("problem-confirm", function () { window.RD.state.scratch.problemConfirming = true; window.RD.render(); });
  window.RD.action("problem-confirm-cancel", function () { window.RD.state.scratch.problemConfirming = false; window.RD.render(); });
  window.RD.action("problem-send", function (routeId) {
    const S = window.RD.state.scratch;
    if (!S.problemKind) return;
    window.RD.commit(function () {
      window.RD_EMIT("problem.reported", routeOf(routeId), null, { kind: S.problemKind, where: (S.problemWhere || "").trim() || null }, "Delivery app · Report a problem");
      const pk = PROBLEMS.filter(function (x) { return x.key === S.problemKind; })[0];
      S.problemKind = null; S.problemWhere = ""; S.problemConfirming = false;
      window.RD.toast({ title: "Sent to office", detail: (pk ? pk.label : "Van problem") + " · they may move your stops" });
      window.RD.go("/queue/" + routeId);
    });
  });

  /* ══ Proof of Delivery ════════════════════════════════════════════════ */
  // What proves a drop: a photo of the goods at the shop and the customer's
  // signature. Kept on the stop (db.pod) so the stop shows it, and told to
  // the office (pod.captured) — a delivery the route settles without it is
  // the tower's "POD missing".
  function podOf(stopId) { return (D.db.pod && D.db.pod[stopId]) || null; }

  function podSheet() {
    const S = window.RD.state.scratch;
    const sid = S.podOpen || null;
    const stop = sid ? stopOf(window.RD.state.routeId, sid) : null;
    const saved = sid ? podOf(sid) : null;
    const photo = S.podPhoto !== undefined ? S.podPhoto : saved && saved.photo;
    const sign = S.podSign !== undefined ? S.podSign : saved && saved.signature;
    const saving = !!S.committing && !!sid;
    const label = function (t) { return '<div style="' + U.sty({ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: 8 }) + '">' + t + "</div>"; };
    const body = stop ? '<div style="' + U.sty({ padding: "0 20px 16px", maxHeight: "calc(92dvh - 32px)", overflowY: "auto" }) + '">' +
        '<div style="' + U.sty({ fontSize: 10, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }) + '">Proof of Delivery</div>' +
        '<div style="' + U.sty({ fontSize: 20, fontWeight: 800, color: "#111", marginBottom: 14 }) + '">' + U.esc(stop.customerName) + "</div>" +
        label("Photo of the goods") +
        '<label style="' + U.sty({ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, height: photo ? "auto" : 88, marginBottom: 16,
          border: photo ? "1px solid #e5e7eb" : "2px dashed #cbd5e1", borderRadius: 14, background: photo ? "white" : "#f8fafc", cursor: "pointer", overflow: "hidden" }) + '">' +
          (photo
            ? '<img alt="Delivery photo" src="' + photo + '" style="' + U.sty({ width: "100%", maxHeight: 180, objectFit: "cover", display: "block" }) + '" />'
            : '<span style="font-size:22px">📷</span><span style="' + U.sty({ fontSize: 14, fontWeight: 700, color: U.BRAND }) + '">Take Photo</span>') +
          '<input type="file" accept="image/*" capture="environment" data-pod-photo style="display:none" /></label>' +
        '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "baseline" }) + '">' + label("Customer's signature") +
          (sign ? '<button type="button"' + U.act("pod-sign-clear") + ' style="' + U.sty({ background: "none", border: "none", color: "#9ca3af", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }) + '">✕ Clear</button>' : "") +
        "</div>" +
        '<div style="' + U.sty({ position: "relative", marginBottom: 16 }) + '">' +
          '<canvas data-pod-sign style="' + U.sty({ width: "100%", height: 150, display: "block", border: "1.5px solid #e5e7eb", borderRadius: 14, background: "#fffef7", touchAction: "none", cursor: "crosshair" }) + '"></canvas>' +
          (sign ? "" : '<div style="' + U.sty({ position: "absolute", left: 0, right: 0, bottom: 14, textAlign: "center", fontSize: 12, color: "#b0b7c3", pointerEvents: "none" }) + '">Ask the customer to sign here</div>') +
        "</div>" +
        '<div style="' + U.sty({ display: "flex", gap: 10 }) + '">' +
          U.BtnSm({ variant: "grey", label: "Cancel", actName: "pod-close" }) +
          U.BtnXL({ variant: photo || sign ? "brand" : "grey", disabled: !(photo || sign) || saving, actName: "pod-save", arg: sid, style: { flex: 2, padding: 14, fontSize: 15 },
            label: saving ? U.InlineSpinner(16) + " Saving…" : "Save Proof" }) +
        "</div></div>"
      : "";
    return U.Sheet({ open: !!stop, zIndex: 221, closeAct: "pod-close", body: body });
  }

  // The block on Payment Collected: a button until proof is taken, a tick after.
  function podCard(stopId) {
    const saved = podOf(stopId);
    return '<div style="' + U.sty({ background: "rgba(255,255,255,0.2)", borderRadius: 14, padding: 14, width: "100%", marginBottom: 12, textAlign: "left" }) + '">' +
      '<div style="' + U.sty({ fontSize: 13, color: "white", fontWeight: 600, marginBottom: saved ? 0 : 10 }) + '">' +
        (saved ? "✓ Proof of delivery saved" + (saved.photo && saved.signature ? " · photo and signature" : saved.photo ? " · photo" : " · signature") : "Proof of delivery") + "</div>" +
      (saved ? "" : '<button type="button" class="rd-btn-sm"' + U.act("pod-open", stopId) + ' style="' + U.sty({ width: "100%", padding: 11, background: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, color: U.BRAND, cursor: "pointer" }) + '">📷 Add Photo & Signature</button>') +
    "</div>";
  }

  window.RD.action("pod-open", function (sid) {
    const S = window.RD.state.scratch;
    S.stopActions = false; S.podOpen = sid; delete S.podPhoto; delete S.podSign;
    window.RD.render();
  });
  window.RD.action("pod-close", function () {
    const S = window.RD.state.scratch; if (S.committing) return;
    S.podOpen = null; delete S.podPhoto; delete S.podSign; window.RD.render();
  });
  window.RD.action("pod-sign-clear", function () { window.RD.state.scratch.podSign = null; window.RD.render(); });
  window.RD.action("pod-save", function (sid) {
    const S = window.RD.state.scratch;
    const saved = podOf(sid) || {};
    const photo = S.podPhoto !== undefined ? S.podPhoto : saved.photo || null;
    const sign = S.podSign !== undefined ? S.podSign : saved.signature || null;
    if (!photo && !sign) return;
    const routeId = window.RD.state.routeId;
    window.RD.commit(function () {
      D.db.pod = D.db.pod || {};
      D.db.pod[sid] = { photo: photo, signature: sign, at: new Date().toISOString() };
      window.RD_EMIT("pod.captured", routeOf(routeId), stopOf(routeId, sid), { photo: !!photo, signature: !!sign }, "Delivery app · Proof of delivery");
      S.podOpen = null; delete S.podPhoto; delete S.podSign;
      window.RD.toast({ title: "Proof of delivery saved", detail: (photo && sign ? "Photo and signature" : photo ? "Photo" : "Signature") + " · " + ((stopOf(routeId, sid) || {}).customerName || "") });
    });
  });

  // The photo, shrunk to what a proof needs before it is kept.
  document.addEventListener("change", function (e) {
    const el = e.target;
    if (!el || !el.hasAttribute || !el.hasAttribute("data-pod-photo") || !el.files || !el.files[0]) return;
    const reader = new FileReader();
    reader.onload = function () {
      const img = new Image();
      img.onload = function () {
        const k = Math.min(1, 640 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        window.RD.state.scratch.podPhoto = c.toDataURL("image/jpeg", 0.72);
        window.RD.render();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(el.files[0]);
  });

  // The signature pad. The screen re-renders from a string, so the drawing
  // lives in scratch as an image and is painted back after every render.
  let pen = null;
  function padPoint(c, e) { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  window.RD.afterRender(function (root) {
    const c = root.querySelector("canvas[data-pod-sign]");
    if (!c) return;
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const g = c.getContext("2d");
    g.scale(dpr, dpr); g.lineWidth = 2.4; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#111";
    const S = window.RD.state.scratch, saved = S.podOpen ? podOf(S.podOpen) : null;
    const src = S.podSign !== undefined ? S.podSign : saved && saved.signature;
    if (src) { const img = new Image(); img.onload = function () { g.drawImage(img, 0, 0, w, h); }; img.src = src; }
  });
  document.addEventListener("pointerdown", function (e) {
    const c = e.target && e.target.closest && e.target.closest("canvas[data-pod-sign]");
    if (!c) return;
    e.preventDefault();
    c.setPointerCapture && c.setPointerCapture(e.pointerId);
    const g = c.getContext("2d"), pt = padPoint(c, e);
    g.beginPath(); g.moveTo(pt.x, pt.y);
    pen = { c: c, g: g, moved: false };
  });
  document.addEventListener("pointermove", function (e) {
    if (!pen) return;
    const pt = padPoint(pen.c, e);
    pen.g.lineTo(pt.x, pt.y); pen.g.stroke(); pen.moved = true;
  });
  function lift() {
    if (!pen) return;
    const p = pen; pen = null;
    if (!p.moved) return;
    const had = !!window.RD.state.scratch.podSign;
    window.RD.state.scratch.podSign = p.c.toDataURL("image/png");
    // Only the first stroke changes the sheet (Save lights up, Clear shows).
    if (!had) window.RD.render();
  }
  document.addEventListener("pointerup", lift);
  document.addEventListener("pointercancel", lift);

  window.RD_POD = { sheet: podSheet, card: podCard, of: podOf };
})();

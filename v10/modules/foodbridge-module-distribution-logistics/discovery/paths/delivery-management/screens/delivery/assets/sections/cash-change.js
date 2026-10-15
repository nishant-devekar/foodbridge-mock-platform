/* Cash for Change — opening float via numpad + quick amounts. */
DM.sections["cash-change"] = function (body, params) {
  const r = DM.route(params.routeId);
  let amount = String(r.openingCash || 500);
  const QUICK = [200, 500, 1000, 2000];

  function draw() {
    const n = +amount || 0;
    body.innerHTML = `
      ${DM.topbar({ back: "Load Stock", home: true, title: "Cash for Change", subtitle: "How much cash are you taking for giving change?" })}
      <div class="dm-body">
        <div class="amount-hero"><div class="lbl">Amount from register</div><div class="big"><span class="cur">₹</span>${n.toLocaleString("en-IN")}</div></div>
        <div class="sec-label" style="margin-top:6px">Quick Select</div>
        <div class="quick-row">${QUICK.map((q) => `<button class="quick ${n === q ? "on" : ""}" data-q="${q}">${DM.money(q)}</button>`).join("")}</div>
        <div style="margin-top:10px">${DM.numpad()}</div>
      </div>
      <div class="dm-foot"><button class="btn teal" id="confirm" ${n > 0 ? "" : "disabled"}>Confirm ${DM.money(n)} →</button></div>`;
    DM.wireTop(body);
    body.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => { amount = b.dataset.q; draw(); }));
    DM.onNumpad(body, (k) => { amount = DM.applyKey(amount, k); draw(); });
    body.querySelector("#confirm").addEventListener("click", () => {
      DM.sheet({ eyebrow: "Opening cash float", title: DM.money(+amount || 0), sub: "for giving change on this route",
        actions: [ { label: "Change Amount", cls: "ghost" }, { label: "Confirm Float", cls: "primary", onClick: () => { r.openingCash = +amount || 0; DM.toast("Opening cash recorded"); DM.go("ready-start", { routeId: r.id }, true); } } ] });
    });
  }
  draw();
};

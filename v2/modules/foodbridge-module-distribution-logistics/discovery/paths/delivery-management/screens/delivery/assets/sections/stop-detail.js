/* Stop detail — current customer, total due, today's order, collect/edit/skip. */
DM.sections["stop-detail"] = function (body, params) {
  const r = DM.route(params.routeId);
  const s = r.stops.find((x) => x.id === params.stopId);
  const collected = r.stops.reduce((a, x) => a + (x.collected || 0), 0);
  const today = DM.orderValue(s.order);
  const credit = s.credit || 0;
  const applied = Math.min(credit, today);
  const due = Math.max(0, today - credit);
  const overLeft = Math.max(0, credit - today);

  const orderLines = s.order.map((l) => { const p = DM.product(l.productId); return `<div class="order-line"><span>${DM.esc(p.name)} × ${l.qty}</span><b>${DM.money(p.price * l.qty)}</b></div>`; }).join("");

  body.innerHTML = `
    <div class="dm-topbar plain"><div class="tb-row"><button class="tb-back" id="tbBack">← Delivery Stops</button>
      <div class="tb-right"><span style="font-size:12px;opacity:.9"><b>${DM.money(collected)}</b> collected this route</span><button class="tb-home" id="tbHome">⌂</button></div></div></div>
    <div class="dm-body">
      <div class="stop-hero">
        <div class="eyebrow">● ${s.status === "pending" ? "CURRENT STOP" : "COMPLETED STOP"}</div>
        <h2>${DM.esc(s.name)}</h2>
        <div class="due-row"><div class="due"><div class="l">Total Due</div><div class="amt">${DM.money(due)}</div>
          ${credit > 0 ? `<div class="note">${DM.money(today)} today's order − ${DM.money(applied)} over payment ·<br>${DM.money(overLeft)} over payment left</div>` : ""}</div>
          <button class="call" id="call">📞</button></div>
      </div>
      <div class="sec-label">Today's Order</div>
      <div class="order-card">${orderLines}<div class="order-line total"><span>Order Total</span><b>${DM.money(today)}</b></div></div>
    </div>
    <div class="dm-foot" style="flex-direction:column;gap:10px;padding-top:14px">
      <button class="btn green" id="collect" style="height:52px;flex:0 0 52px">💰 Collect ${DM.money(due)}</button>
      <div style="display:flex;gap:10px;width:100%"><button class="btn ghost" id="edit" style="height:52px;font-size:14.5px">✏️ Edit Order</button><button class="btn ghost-red" id="skip" style="height:52px;font-size:14.5px">Skip Stop →</button></div>
    </div>`;

  body.querySelector("#tbBack").addEventListener("click", () => DM.go("delivery-queue", { routeId: r.id }, true));
  body.querySelector("#tbHome").addEventListener("click", () => DM.go("home"));
  body.querySelector("#call").addEventListener("click", () => DM.toast(`Calling ${s.name}…`));
  body.querySelector("#collect").addEventListener("click", () => DM.go("collect-payment", { routeId: r.id, stopId: s.id, due }));
  body.querySelector("#edit").addEventListener("click", () => DM.go("edit-order", { routeId: r.id, stopId: s.id }));
  body.querySelector("#skip").addEventListener("click", () => {
    DM.sheet({ eyebrow: "Skip stop", title: `Skip ${s.name}?`, sub: "You can revisit this stop later from the queue.",
      actions: [ { label: "Cancel", cls: "ghost" }, { label: "Skip Stop", cls: "primary", onClick: () => { s.status = "skipped"; s._time = nowTime(); DM.toast("Stop skipped"); DM.go("delivery-queue", { routeId: r.id }, true); } } ] });
  });
  function nowTime() { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
};

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
      <button class="btn ghost" id="stockAudit" style="height:52px;font-size:14.5px">🧾 Stock Audit</button>
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
  body.querySelector("#stockAudit").addEventListener("click", () => openStockAuditLink(s));
  function nowTime() { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
};

// Entry Point B (vNext Customer Stock Audit): Delivery Management and
// Customer Management are different modules, published from different
// repos — different origins in production, only coincidentally same-origin
// in this repo's local v2 snapshot (see DEVELOPMENT.md's explicit warning
// not to depend on that). There is also no shared customer-id space between
// a delivery stop and a Customer Management record — stops only carry a
// name/phone (see data.js's stop() factory), which happens to match a
// customer's own phone in this seed but is not a real foreign key. So this
// can only pass a best-effort search hint, opened as a real top-level
// navigation, never an in-app transition — the rep confirms the match
// themselves in Stock Audit's own customer picker.
//
// STOCK_AUDIT_URL is a local-snapshot convenience (this repo happens to
// serve every module from one root), standing in for what a real deployment
// would need to supply per-environment — e.g. the same per-module URL
// configuration assets/modules.json already keeps for the platform shell,
// just made available to this module too. Do not treat this relative path
// as something production can rely on.
const STOCK_AUDIT_URL = "../../../../../../foodbridge-customer-mockup/v1/screens/customers/stock-audit.html";

function openStockAuditLink(stop) {
  const params = new URLSearchParams({ entry: "quick", hint: stop.phone || "", source: "route-delivery" });
  window.open(STOCK_AUDIT_URL + "?" + params.toString(), "_blank");
}

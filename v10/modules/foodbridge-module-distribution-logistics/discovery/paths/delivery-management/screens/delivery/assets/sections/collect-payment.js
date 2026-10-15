/* Collect Payment — Cash / UPI amount entry, then a success screen. */
DM.sections["collect-payment"] = function (body, params) {
  const r = DM.route(params.routeId);
  const s = r.stops.find((x) => x.id === params.stopId);
  const due = params.due != null ? params.due : Math.max(0, DM.orderValue(s.order) - (s.credit || 0));
  const cp = DM._collect || (DM._collect = {});
  if (cp.stopId !== s.id) { cp.stopId = s.id; cp.amount = String(due); cp.method = "cash"; }

  function draw() {
    const n = +cp.amount || 0;
    body.innerHTML = `
      ${DM.topbar({ back: "Customer", title: "Collect Payment", subtitle: s.name })}
      <div class="dm-body">
        <div class="amount-hero"><div class="lbl">Collecting ${cp.method === "cash" ? "Cash" : "via UPI"}</div><div class="big"><span class="cur">₹</span>${n.toLocaleString("en-IN")}</div><div class="due-sub">Total Due ${DM.money(due)}${n > due ? ` · ${DM.money(n - due)} over payment` : n > 0 && n < due ? ` · ${DM.money(due - n)} short` : ""}</div></div>
        <div class="sec-label">Payment Method</div>
        <div class="pay-methods"><button class="pay-m ${cp.method === "cash" ? "on" : ""}" data-m="cash">💵 Cash</button><button class="pay-m ${cp.method === "upi" ? "on" : ""}" data-m="upi">📱 UPI</button></div>
        <button class="full-chip" id="full">${DM.money(due)} Full</button>
        ${DM.numpad()}
      </div>
      <div class="dm-foot"><button class="btn green" id="collect">✓ Collect ${DM.money(n)} ${cp.method === "cash" ? "Cash" : "UPI"}</button></div>`;
    DM.wireTop(body);
    body.querySelectorAll("[data-m]").forEach((b) => b.addEventListener("click", () => { cp.method = b.dataset.m; draw(); }));
    body.querySelector("#full").addEventListener("click", () => { cp.amount = String(due); draw(); });
    DM.onNumpad(body, (k) => { cp.amount = DM.applyKey(cp.amount, k); draw(); });
    body.querySelector("#collect").addEventListener("click", () => {
      DM.sheet({ eyebrow: `Collecting ${cp.method}`, title: DM.money(n), sub: `from ${s.name}`,
        actions: [ { label: "Change Amount", cls: "ghost" }, { label: "Collect Payment", cls: "primary", onClick: () => {
          s.status = "delivered"; s.collected = n; s.paymentMode = cp.method; s._time = clock();
          s.overPayment = Math.max(0, (s.credit || 0) - DM.orderValue(s.order)) + Math.max(0, n - due);
          delete cp.stopId;
          DM.go("payment-done", { routeId: r.id, stopId: s.id, amount: n, method: cp.method }, true);
        } } ] });
    });
  }
  function clock() { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
  draw();
};

/* Payment success screen. */
DM.sections["payment-done"] = function (body, params) {
  const r = DM.route(params.routeId);
  const s = r.stops.find((x) => x.id === params.stopId);
  body.innerHTML = `
    <div class="dm-success">
      <div class="tick"><span style="font-size:38px">✅</span></div>
      <h2>Payment Collected!</h2>
      <div class="amt">${DM.money(params.amount)}</div>
      <div class="who">${params.method === "cash" ? "Cash" : "UPI"} · ${DM.esc(s.name)}</div>
      <div class="share"><div class="t">Share receipt with customer?</div><div class="row"><button id="wa">📱 WhatsApp</button><button id="print">🖨️ Print Receipt</button></div></div>
      <button class="move" id="move">Move to Delivery Stops →</button>
    </div>`;
  body.querySelector("#wa").addEventListener("click", () => DM.toast("Receipt sent on WhatsApp"));
  body.querySelector("#print").addEventListener("click", () => DM.printReceiptSheet(r, s, params.amount, params.method));
  body.querySelector("#move").addEventListener("click", () => DM.go("delivery-queue", { routeId: r.id }, true));
};

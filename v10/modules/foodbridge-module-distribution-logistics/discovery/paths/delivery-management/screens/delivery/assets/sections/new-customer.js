/* New Customer — discovered on route, quick order from on-truck stock. */
DM.sections["new-customer"] = function (body, params) {
  const r = DM.route(params.routeId);
  const nc = DM._newCust || (DM._newCust = {});
  if (nc.routeId !== r.id) { nc.routeId = r.id; nc.name = ""; nc.phone = ""; nc.order = {}; }
  const st = DM._ncQ || (DM._ncQ = { q: "" });
  const orderUnits = () => Object.values(nc.order).reduce((a, v) => a + v, 0);
  const orderVal = () => DM.products.reduce((a, p) => a + (nc.order[p.id] || 0) * p.price, 0);
  const valid = () => nc.name.trim() && nc.phone.trim().length >= 10 && orderUnits() > 0;

  function draw() {
    const list = DM.products.filter((p) => !st.q || p.name.toLowerCase().includes(st.q.toLowerCase()));
    body.innerHTML = `
      ${DM.topbar({ back: "Delivery Stops", home: true, title: "New Customer", subtitle: "Discovered on route · Auto-added to beat" })}
      <div class="dm-body">
        <div class="field-lbl">Shop Name <span class="req">*</span></div>
        <input class="dm-input plain" id="nm" placeholder="e.g. Nikhil General Stores" value="${DM.attr(nc.name)}">
        <div class="field-lbl">Owner Phone <span class="req">*</span></div>
        <input class="dm-input plain" id="ph" inputmode="numeric" placeholder="10-digit mobile number" value="${DM.attr(nc.phone)}">
        <div class="sec-label" style="margin-top:18px">Quick Order</div>
        <div class="dm-search" style="margin-bottom:12px"><input id="q" placeholder="Search products..." value="${DM.attr(st.q)}"></div>
        <div id="rows">${list.map((p) => { const avail = p.truck; const oos = avail <= 0; return `<div class="prod-row"><div class="info"><div class="nm" style="${oos ? "color:var(--muted-2)" : ""}">${DM.esc(p.name)}</div><div class="meta ${oos ? "oos" : ""}">${oos ? "Out of stock" : `${DM.money(p.price)} · ${avail} available`}</div></div>${DM.stepper(p.id, nc.order[p.id] || 0, { disabled: oos })}</div>`; }).join("")}</div>
        <div class="prod-row" id="disc" style="justify-content:space-between;cursor:pointer"><div class="info"><div class="nm" style="color:var(--teal)">% Add order discount</div></div><span style="color:var(--muted-2)">›</span></div>
      </div>
      <div class="dm-foot"><button class="btn green" id="add" ${valid() ? "" : "disabled"}>${valid() ? `Add Customer & Order · ${DM.money(orderVal())}` : "Add at least one product to continue"}</button></div>`;
    DM.wireTop(body);
    body.querySelector("#nm").addEventListener("input", (e) => { nc.name = e.target.value; refreshCta(); });
    body.querySelector("#ph").addEventListener("input", (e) => { nc.phone = e.target.value.replace(/\D/g, ""); refreshCta(); });
    let deb; body.querySelector("#q").addEventListener("input", (e) => { clearTimeout(deb); deb = setTimeout(() => { st.q = e.target.value; draw(); }, 160); });
    DM.onStep(body, (id, v) => { const p = DM.product(id); if (v > p.truck) { v = p.truck; body.querySelector(`.dm-stepper[data-step="${id}"] [data-val]`).value = v; } nc.order[id] = v; refreshCta(); });
    body.querySelector("#disc").addEventListener("click", () => DM.toast("Order discount — coming soon."));
    body.querySelector("#add").addEventListener("click", () => {
      if (!valid()) return;
      const order = DM.products.filter((p) => nc.order[p.id] > 0).map((p) => ({ productId: p.id, qty: nc.order[p.id] }));
      const stop = { id: "st-new-" + Date.now(), name: nc.name.trim(), phone: nc.phone.trim(), order, status: "pending", collected: 0, paymentMode: null, overPayment: 0, addedOnRoute: true };
      order.forEach((l) => { DM.product(l.productId).truck -= l.qty; });
      r.stops.push(stop);
      DM._newCust = {};
      DM.toast(`${stop.name} added to route`);
      DM.go("stop-detail", { routeId: r.id, stopId: stop.id }, true);
    });
  }
  function refreshCta() { const btn = body.querySelector("#add"); btn.disabled = !valid(); btn.textContent = valid() ? `Add Customer & Order · ${DM.money(orderVal())}` : "Add at least one product to continue"; }
  draw();
};

/* Edit Order — adjust today's order lines and add on-truck products. */
DM.sections["edit-order"] = function (body, params) {
  const r = DM.route(params.routeId);
  const s = r.stops.find((x) => x.id === params.stopId);
  if (!s._draft) s._draft = s.order.map((l) => ({ ...l }));
  const draft = s._draft;
  const st = DM._editQ || (DM._editQ = { q: "" });
  const qtyOf = (pid) => { const l = draft.find((x) => x.productId === pid); return l ? l.qty : 0; };
  const setQty = (pid, v) => { let l = draft.find((x) => x.productId === pid); if (!l) { l = { productId: pid, qty: 0 }; draft.push(l); } l.qty = v; };
  const total = () => DM.orderValue(draft.filter((l) => l.qty > 0));
  const collected = r.stops.reduce((a, x) => a + (x.collected || 0), 0);

  // Show ordered products first, then remaining on-truck products the driver can add.
  function rows() {
    const inOrder = draft.filter((l) => l.qty > 0).map((l) => l.productId);
    const others = DM.products.filter((p) => !inOrder.includes(p.id) && p.truck > 0).map((p) => p.id);
    let ids = [...inOrder, ...others];
    if (st.q) ids = ids.filter((id) => DM.product(id).name.toLowerCase().includes(st.q.toLowerCase()));
    return ids.map((id) => {
      const p = DM.product(id), ordered = inOrder.includes(id);
      const cap = ordered ? qtyOf(id) : p.truck;
      return `<div class="order-line editing"><div class="oinfo"><div class="nm">${DM.esc(p.name)}</div>${ordered ? `<div class="warn">${DM.money(p.price)} / ${p.unit} ⚠ Max ${cap}</div>` : `<div class="meta">${DM.money(p.price)} / ${p.unit} · ${p.truck} loaded</div>`}</div>${DM.stepper(id, qtyOf(id))}</div>`;
    }).join("");
  }
  function draw() {
    body.innerHTML = `
      <div class="dm-topbar plain"><div class="tb-row"><button class="tb-back" id="tbBack">← Delivery Stops</button>
        <div class="tb-right"><span style="font-size:12px;opacity:.9"><b>${DM.money(collected)}</b> collected this route</span><button class="tb-home" id="tbHome">⌂</button></div></div></div>
      <div class="dm-body">
        <div class="stop-hero"><div class="eyebrow">● CURRENT STOP</div><h2>${DM.esc(s.name)}</h2>
          <div class="due-row"><div class="due"><div class="l">Total Due</div><div class="amt">${DM.money(Math.max(0, total() - (s.credit || 0)))}</div></div><button class="call">📞</button></div></div>
        <div class="dm-search" style="margin-bottom:12px"><input id="q" placeholder="Search products..." value="${DM.attr(st.q)}"></div>
        <div class="sec-label" style="display:flex;justify-content:space-between"><span>Today's Order</span><span style="color:var(--green);text-transform:none;font-weight:800">Editing</span></div>
        <div class="order-card" id="rows">${rows()}<div class="order-line total"><span>Order Total</span><b id="ot">${DM.money(total())}</b></div></div>
      </div>
      <div class="dm-foot"><button class="btn teal" id="done">✓ Done Editing</button></div>`;
    DM.wireTop(body);
    body.querySelector("#tbBack").addEventListener("click", () => { s.order = draft.filter((l) => l.qty > 0); delete s._draft; DM.go("stop-detail", { routeId: r.id, stopId: s.id }, true); });
    let deb; body.querySelector("#q").addEventListener("input", (e) => { clearTimeout(deb); deb = setTimeout(() => { st.q = e.target.value; draw(); }, 160); });
    DM.onStep(body, (id, v) => { setQty(id, v); body.querySelector("#ot").textContent = DM.money(total()); body.querySelector(".due .amt").textContent = DM.money(Math.max(0, total() - (s.credit || 0))); });
    body.querySelector("#done").addEventListener("click", () => { s.order = draft.filter((l) => l.qty > 0); delete s._draft; DM.toast("Order updated"); DM.go("stop-detail", { routeId: r.id, stopId: s.id }, true); });
  }
  draw();
};

/* Load Stock — auto-filled from proxy orders, adjustable, confirm sheet. */
DM.sections["load-stock"] = function (body, params) {
  const r = DM.route(params.routeId);
  if (!r._stockDraft) { r._stockDraft = {}; (r.proxyStock || r.stops.flatMap((s) => s.order)).forEach((l) => { r._stockDraft[l.productId] = (r._stockDraft[l.productId] || 0) + l.qty; }); }
  const draft = r._stockDraft;
  const st = DM._loadStockQ || (DM._loadStockQ = { q: "" });

  function totals() {
    let units = 0, val = 0;
    DM.products.forEach((p) => { const q = draft[p.id] || 0; units += q; val += q * p.price; });
    return { units, val, products: DM.products.filter((p) => draft[p.id] > 0).length };
  }
  function draw() {
    const t = totals();
    const list = DM.products.filter((p) => !st.q || p.name.toLowerCase().includes(st.q.toLowerCase()));
    body.innerHTML = `
      ${DM.topbar({ back: r.name, home: true, title: "Load Stock", subtitle: r.name })}
      <div class="dm-body">
        <div class="notice green">📦 Quantities auto-filled from today's proxy orders. Adjust if needed.</div>
        <div class="dm-search" style="margin:12px 0"><input id="q" placeholder="Search products..." value="${DM.attr(st.q)}"></div>
        <div id="rows">${list.map((p) => `<div class="prod-row"><div class="info"><div class="nm">${DM.esc(p.name)}</div><div class="meta">${DM.money(p.price)} / ${p.unit}</div></div>${DM.stepper(p.id, draft[p.id] || 0)}</div>`).join("")}</div>
        <div class="two-stat"><div class="stat-box"><div class="n">${t.units}</div><div class="l">Total Units</div></div><div class="stat-box"><div class="n green">${DM.money(t.val)}</div><div class="l">Est. Value</div></div></div>
      </div>
      <div class="dm-foot"><button class="btn teal" id="confirm">Confirm Stock ✓</button></div>`;
    DM.wireTop(body);
    DM.onStep(body, (id, v) => { draft[id] = v; const tt = totals(); body.querySelector(".two-stat").innerHTML = `<div class="stat-box"><div class="n">${tt.units}</div><div class="l">Total Units</div></div><div class="stat-box"><div class="n green">${DM.money(tt.val)}</div><div class="l">Est. Value</div></div>`; });
    let deb; body.querySelector("#q").addEventListener("input", (e) => { clearTimeout(deb); deb = setTimeout(() => { st.q = e.target.value; draw(); }, 160); });
    body.querySelector("#confirm").addEventListener("click", openConfirm);
  }
  function openConfirm() {
    const t = totals();
    const lines = DM.products.filter((p) => draft[p.id] > 0).map((p) => `<div class="order-line"><span>${DM.esc(p.name)}</span><b>× ${draft[p.id]} ${p.unit}</b></div>`).join("");
    DM.sheet({ eyebrow: "Loading stock", title: `${t.units} units`, sub: `${DM.money(t.val)} estimated value · ${t.products} product${t.products !== 1 ? "s" : ""}`,
      body: `<div class="order-card" style="margin:8px 0 4px">${lines}</div>`,
      actions: [ { label: "Edit Quantities", cls: "ghost" }, { label: "Confirm Load", cls: "primary", onClick: () => {
        r.stockLoaded = t.units;
        r._loaded = Object.assign({}, draft); // snapshot for the settlement stock count
        DM.products.forEach((p) => { p.truck += draft[p.id] || 0; });
        DM.toast("Stock loaded"); DM.go("route", { routeId: r.id }, true);
      } } ] });
  }
  draw();
};

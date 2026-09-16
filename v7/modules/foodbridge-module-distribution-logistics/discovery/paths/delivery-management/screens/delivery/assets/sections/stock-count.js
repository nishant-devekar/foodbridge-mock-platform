/* Stock Count — verify remaining stock (Loaded / Expected / Actual + Match). */
DM.sections["stock-count"] = function (body, params) {
  const r = DM.route(params.routeId);
  const actual = (r._stockCountActual = r._stockCountActual || {});

  function items() {
    const loaded = {}, delivered = {};
    if (r._loaded) DM.products.forEach((p) => (loaded[p.id] = r._loaded[p.id] || 0));
    else r.stops.forEach((s) => s.order.forEach((l) => (loaded[l.productId] = (loaded[l.productId] || 0) + l.qty)));
    r.stops.filter((s) => s.status === "delivered").forEach((s) => s.order.forEach((l) => (delivered[l.productId] = (delivered[l.productId] || 0) + l.qty)));
    return DM.products.filter((p) => (loaded[p.id] || 0) > 0 || (delivered[p.id] || 0) > 0).map((p) => ({ id: p.id, name: p.name, price: p.price, loaded: loaded[p.id] || 0, delivered: delivered[p.id] || 0, expected: Math.max(0, (loaded[p.id] || 0) - (delivered[p.id] || 0)) }));
  }
  const rows = items();
  const allEntered = () => rows.every((it) => actual[it.id] != null && actual[it.id] !== "");
  const mismatches = () => rows.filter((it) => (+actual[it.id] || 0) !== it.expected).length;

  function draw() {
    const tExp = rows.reduce((a, it) => a + it.expected * it.price, 0);
    const tAct = rows.reduce((a, it) => a + (+actual[it.id] || 0) * it.price, 0);
    body.innerHTML = `
      ${DM.topbar({ back: "Settlement", home: true, title: "Stock Count", subtitle: "Count what's left in the vehicle" })}
      <div class="dm-body">
        <div class="notice">📱 Expected return is auto-calculated. Enter actual count to verify.</div>
        <div style="overflow-x:auto;margin-top:12px">
          <div class="dm-table" style="min-width:520px">
            <div class="th"><div class="c1">Product</div><div class="c">Loaded</div><div class="c">Expected</div><div class="c wide">Actual</div></div>
            ${rows.map((it) => `<div class="tr"><div class="c1"><div class="nm">${DM.esc(it.name)}</div><div class="price">${DM.money2(it.price)}</div></div>
              <div class="c"><div>${it.loaded}</div><div class="rupee">${DM.money2(it.loaded * it.price)}</div></div>
              <div class="c"><div>${it.expected}</div><div class="rupee">${DM.money2(it.expected * it.price)}</div></div>
              <div class="c wide" style="display:flex;align-items:center;justify-content:flex-end;gap:4px"><input class="qty-box" style="width:52px" data-a="${it.id}" inputmode="numeric" value="${actual[it.id] != null ? actual[it.id] : ""}"><button class="match-btn" data-m="${it.id}">Match</button></div></div>`).join("")}
            <div class="tr total"><div class="c1">Total</div><div class="c"></div><div class="c"><div>${DM.money2(tExp)}</div></div><div class="c wide">${DM.money2(tAct)}</div></div>
          </div>
        </div>
      </div>
      <div class="dm-foot"><button class="btn ${allEntered() ? "teal" : "grey"}" id="confirm" ${allEntered() ? "" : "disabled"}>${allEntered() ? "Confirm Stock Count ✓" : "Enter all counts to continue"}</button></div>`;
    DM.wireTop(body);
    body.querySelectorAll("[data-a]").forEach((inp) => inp.addEventListener("input", () => { actual[inp.dataset.a] = inp.value; refresh(); }));
    body.querySelectorAll("[data-m]").forEach((b) => b.addEventListener("click", () => { const it = rows.find((x) => x.id === b.dataset.m); actual[it.id] = String(it.expected); draw(); }));
    body.querySelector("#confirm").addEventListener("click", () => {
      const mm = mismatches();
      DM.sheet({ eyebrow: "Stock count", title: mm === 0 ? "All counts match" : `${mm} mismatch${mm !== 1 ? "es" : ""}`, sub: mm === 0 ? "Ready to submit" : "Review before submitting",
        actions: [ { label: "Edit Count", cls: "ghost" }, { label: "Submit Count", cls: "primary", onClick: () => { r._settlement = r._settlement || {}; r._settlement.stockCount = true; DM.toast("Stock count submitted"); DM.go("settle-route", { routeId: r.id }, true); } } ] });
    });
  }
  function refresh() { const b = body.querySelector("#confirm"); const ok = allEntered(); b.className = `btn ${ok ? "teal" : "grey"}`; b.disabled = !ok; b.textContent = ok ? "Confirm Stock Count ✓" : "Enter all counts to continue"; }
  draw();
};

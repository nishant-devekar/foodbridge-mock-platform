/* Route pre-start — BEFORE YOU START checklist + route summary. */
DM.sections["route"] = function (body, params) {
  const r = DM.route(params.routeId);
  const s = DM.routeStats(r);
  const stockDone = r.stockLoaded > 0;
  const cashDone = r.openingCash > 0;
  const stockVal = DM.orderValue(r.stops.flatMap((x) => x.order)); // est value of loaded proxy
  const estCollection = r.stops.reduce((a, x) => a + DM.orderValue(x.order), 0);

  const cta = !stockDone
    ? { label: "Complete Stock Load to Start", go: () => DM.go("load-stock", { routeId: r.id }) }
    : !cashDone
    ? { label: "Complete Opening Cash to Start", go: () => DM.go("cash-change", { routeId: r.id }) }
    : { label: "Continue to Start", go: () => DM.go("ready-start", { routeId: r.id }) };

  body.innerHTML = `
    ${DM.topbar({ back: "Routes", home: true, title: r.name, subtitle: new Date(r.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) })}
    <div class="dm-body">
      <div class="info-chips"><span class="info-chip teal">👥 ${r.stops.length} customers</span><span class="info-chip red">${DM.money(0)} outstanding</span></div>
      <div class="info-chips" style="margin-top:0"><span class="info-chip">📍 ${DM.esc(r.beatArea)}</span></div>
      <div class="notice">ℹ️ Complete all steps below before starting the route</div>
      <div class="sec-label" style="margin-top:16px">Before You Start</div>
      <div class="checklist">
        <div class="check-row">
          <span class="check-ic ${stockDone ? "done" : "active"}">${stockDone ? "✓" : ""}</span>
          <div class="txt"><b>Stock Loaded</b>${stockDone ? `<small>${r.stockLoaded} units · ${DM.money(stockVal)} est. value</small>` : `<small class="act">Tap to load stock</small>`}</div>
          ${stockDone ? `<span class="status done">Done ✓</span>` : `<span class="status start" data-go="stock">Start →</span>`}
        </div>
        <div class="check-row">
          <span class="check-ic ${cashDone ? "done" : stockDone ? "active" : ""}">${cashDone ? "✓" : ""}</span>
          <div class="txt"><b>Opening Cash</b>${cashDone ? `<small>${DM.money(r.openingCash)} float</small>` : `<small class="${stockDone ? "act" : ""}">Tap to record opening cash</small>`}</div>
          ${cashDone ? `<span class="status done">Done ✓</span>` : stockDone ? `<span class="status start" data-go="cash">Start →</span>` : `<span class="status lock">🔒</span>`}
        </div>
        <div class="check-row">
          <span class="check-ic ${stockDone && cashDone ? "active" : ""}"></span>
          <div class="txt"><b>Staff Sign-Off</b><small>🔒 Complete steps above first</small></div>
          <span class="status lock">🔒</span>
        </div>
      </div>
      <div class="sec-label" style="margin-top:18px">Route Summary</div>
      <div class="kv-card">
        <div class="kv"><span class="k">Total Customers</span><span class="v">${r.stops.length}</span></div>
        <div class="kv"><span class="k">Est. Collection</span><span class="v green">${DM.money(estCollection)}</span></div>
        <div class="kv"><span class="k">Outstanding to collect</span><span class="v red">${DM.money(0)}</span></div>
        <div class="kv"><span class="k">Stock Loaded</span><span class="v">${r.stockLoaded} units</span></div>
      </div>
    </div>
    <div class="dm-foot"><button class="btn teal" id="cta">${cta.label}</button></div>`;

  DM.wireTop(body);
  body.querySelector("#cta").addEventListener("click", cta.go);
  body.querySelector("[data-go='stock']")?.addEventListener("click", () => DM.go("load-stock", { routeId: r.id }));
  body.querySelector("[data-go='cash']")?.addEventListener("click", () => DM.go("cash-change", { routeId: r.id }));
};

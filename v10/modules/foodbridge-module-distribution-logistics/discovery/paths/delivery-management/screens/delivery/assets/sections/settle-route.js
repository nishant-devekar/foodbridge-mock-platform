/* Settle Route — end-of-route tiles + Stock Count / Cash Handover steps. */
DM.sections["settle-route"] = function (body, params) {
  const r = DM.route(params.routeId);
  const s = DM.routeStats(r);
  const set = (r._settlement = r._settlement || { stockCount: false, cashHandover: false });
  const bothDone = set.stockCount && set.cashHandover;

  body.innerHTML = `
    ${DM.topbar({ title: "Settle Route", subtitle: r.name, home: true })}
    <div class="dm-body">
      <div class="settle-tiles">
        <div class="settle-tile g"><div class="n">${s.delivered}</div><div class="l">Delivered</div></div>
        <div class="settle-tile r"><div class="n">${s.skipped}</div><div class="l">Skipped</div></div>
        <div class="settle-tile g"><div class="n">${DM.money(s.collected)}</div><div class="l">Collected</div></div>
        <div class="settle-tile o"><div class="n">${DM.money(s.outstanding)}</div><div class="l">Outstanding</div></div>
      </div>
      <div class="sec-label">Complete All Steps</div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="card-sec" style="display:flex;align-items:center;gap:12px;padding:14px 16px">
          <span class="step-icon ${set.stockCount ? "done" : ""}">📦</span>
          <div style="flex:1"><b style="font-size:15px">Stock Count</b><div style="color:var(--muted);font-size:12.5px">Verify remaining stock</div></div>
          ${set.stockCount ? `<span class="check-row status-btn done">Done ✓</span>` : `<button class="status-btn" id="stock">Start →</button>`}
        </div>
        <div class="card-sec" style="display:flex;align-items:center;gap:12px;padding:14px 16px">
          <span class="step-icon ${set.cashHandover ? "done" : ""}">💵</span>
          <div style="flex:1"><b style="font-size:15px">Cash Handover</b><div style="color:var(--muted);font-size:12.5px">Count and hand over cash</div></div>
          ${set.cashHandover ? `<span class="check-row status-btn done">Done ✓</span>` : set.stockCount ? `<button class="status-btn" id="cash">Start →</button>` : `<span class="status-btn locked">Locked</span>`}
        </div>
      </div>
    </div>
    ${bothDone ? `<div class="dm-foot"><button class="btn green" id="summary">🎉 View Route Summary →</button></div>` : ""}`;

  DM.wireTop(body);
  body.querySelector("#stock")?.addEventListener("click", () => DM.go("stock-count", { routeId: r.id }));
  body.querySelector("#cash")?.addEventListener("click", () => DM.go("cash-handover", { routeId: r.id }));
  body.querySelector("#summary")?.addEventListener("click", () => { r.status = "closed"; DM.go("route-report", { routeId: r.id }); });
};

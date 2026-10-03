/* Route Intelligence — end-of-route score + performance + summaries. */
DM.sections["route-report"] = function (body, params) {
  const r = DM.route(params.routeId);
  const s = DM.routeStats(r);
  const coverage = s.total ? Math.round((s.done / s.total) * 100) : 0;
  const productivity = s.total ? Math.round((s.delivered / s.total) * 100) : 0;
  const estCollection = r.stops.filter((x) => x.status === "delivered").reduce((a, x) => a + DM.orderValue(x.order), 0);
  const collection = estCollection ? Math.round((s.collected / estCollection) * 100) : 0;
  const score = Math.round((coverage + productivity + collection + 40) / 4);
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Good Beat" : score >= 40 ? "Average" : "Needs Work";
  const overPay = r.stops.reduce((a, x) => a + (x.overPayment || 0), 0);

  // stock summary maps
  const loaded = {}, delivered = {};
  if (r._loaded) DM.products.forEach((p) => (loaded[p.id] = r._loaded[p.id] || 0));
  else r.stops.forEach((x) => x.order.forEach((l) => (loaded[l.productId] = (loaded[l.productId] || 0) + l.qty)));
  r.stops.filter((x) => x.status === "delivered").forEach((x) => x.order.forEach((l) => (delivered[l.productId] = (delivered[l.productId] || 0) + l.qty)));
  const stockRows = DM.products.filter((p) => (loaded[p.id] || 0) > 0 || (delivered[p.id] || 0) > 0);
  const loadedTot = stockRows.reduce((a, p) => a + (loaded[p.id] || 0), 0);
  const deliveredTot = stockRows.reduce((a, p) => a + (delivered[p.id] || 0), 0);
  const returnTot = loadedTot - deliveredTot;

  const circ = 2 * Math.PI * 56, off = circ * (1 - score / 100);
  const bar = (l, v, color) => `<div class="perf-row"><span class="pl">${l}</span><span class="bar"><span style="width:${v}%;background:${color}"></span></span><span class="pv" style="color:${color}">${v}%</span></div>`;

  const acc = (title, sub, id, inner) => `<div class="accordion"><div class="ahd" data-acc="${id}"><div><div class="at">${title}</div><div class="as">${sub}</div></div><span style="color:var(--muted-2)">▾</span></div><div class="abody" id="acc-${id}">${inner}</div></div>`;

  const stopsInner = `<div class="dm-table" style="border:none"><div class="th" style="background:#fff;color:var(--muted-2)"><div class="c1">Customer</div><div class="c">Delivered</div><div class="c">Return</div></div>${r.stops.filter((x) => x.status === "delivered").map((x) => `<div class="tr"><div class="c1"><b>${DM.esc(x.name)}</b></div><div class="c">${DM.orderUnits(x.order)}</div><div class="c">0</div></div>`).join("")}</div>`;
  const stockInner = `<div class="dm-table" style="border:none"><div class="th" style="background:#fff;color:var(--muted-2)"><div class="c1">Product</div><div class="c">Delivered</div><div class="c">Return</div></div>${stockRows.map((p) => { const del = delivered[p.id] || 0, ret = (loaded[p.id] || 0) - del; return `<div class="tr"><div class="c1"><div class="nm">${DM.esc(p.name)}</div><div class="price">${DM.money2(p.price)}</div></div><div class="c"><div>${del}</div><div class="rupee">${DM.money2(del * p.price)}</div></div><div class="c" style="color:var(--blue)"><div>${ret}</div><div class="rupee">${DM.money2(ret * p.price)}</div></div></div>`; }).join("")}<div class="tr total"><div class="c1">Total</div><div class="c">${DM.money2(deliveredTot * 0 + stockRows.reduce((a, p) => a + (delivered[p.id] || 0) * p.price, 0))}</div><div class="c">${DM.money2(stockRows.reduce((a, p) => a + ((loaded[p.id] || 0) - (delivered[p.id] || 0)) * p.price, 0))}</div></div></div>`;
  const expInner = `<div style="color:var(--teal);font-size:12px;margin-bottom:8px">1 settled cash audit entry</div><div style="color:var(--muted-2);text-align:center;padding:10px">No expense details recorded</div>`;
  const collInner = `<div class="kv" style="border-bottom:1px dashed var(--line)"><span class="k">Amount Collected</span><span class="v">${DM.money(s.collected)}</span></div><div class="kv" style="border-bottom:1px dashed var(--line)"><span class="k">Outstanding Amount</span><span class="v green">${DM.money(s.outstanding)}</span></div><div class="kv" style="border:none"><span class="k">Over Payment</span><span class="v green">${DM.money(overPay)}</span></div>`;

  body.innerHTML = `
    ${DM.topbar({ title: "Route Intelligence", subtitle: `${r.name} · ${new Date(r.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, right: `<button class="pill-btn" id="export" style="background:rgba(255,255,255,.18)">⬆ Export</button>` })}
    <div class="dm-body">
      <div class="score-ring"><svg width="130" height="130"><circle cx="65" cy="65" r="56" fill="none" stroke="#e5e7eb" stroke-width="10"/><circle cx="65" cy="65" r="56" fill="none" stroke="var(--teal)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${off}"/></svg><div class="mid"><div><div class="n">${score}</div><div class="d">/100</div></div></div></div>
      <div class="score-label">${label}</div>
      <div class="card-sec"><h3>Performance</h3>
        ${bar("Coverage", coverage, "var(--teal)")}${bar("Productivity", productivity, "var(--teal)")}${bar("Collection", collection, "var(--green)")}
        <div class="perf-row"><span class="pl">Avg Time / Stop</span><span class="bar"><span style="width:60%;background:var(--blue)"></span></span><span class="pv" style="color:var(--blue)">5m</span></div>
      </div>
      <div class="card-sec"><h3>Highlights</h3><div class="notice green" style="margin:0">✅ ${DM.money(overPay)} over payment collected</div></div>
      ${acc("Stops Summary", `${s.delivered} delivered`, "stops", stopsInner)}
      ${acc("Stock Summary", `${loadedTot} loaded · ${deliveredTot} delivered · ${returnTot} returned`, "stock", stockInner)}
      ${acc("Expense Summary", "0 expenses · ₹0 total · 0 documents", "exp", expInner)}
      ${acc("Collection Summary", `${DM.money(s.collected)} collected · ${DM.money(s.outstanding)} outstanding`, "coll", collInner)}
    </div>
    ${DM.nav("reports")}`;

  DM.wireTop(body); DM.wireNav(body);
  body.querySelector("#export").addEventListener("click", () => DM.toast("Report exported"));
  body.querySelectorAll("[data-acc]").forEach((h) => h.addEventListener("click", () => { const el = body.querySelector("#acc-" + h.dataset.acc); el.style.display = el.style.display === "none" ? "" : "none"; h.querySelector("span").textContent = el.style.display === "none" ? "▸" : "▾"; }));
};

/* Restock — pause, drive to warehouse, load additional stock, resume. */
DM.sections["restock"] = function (body, params) {
  const r = DM.route(params.routeId);
  const s = DM.routeStats(r);
  const pending = r.stops.filter((x) => x.status === "pending").length;
  body.innerHTML = `
    ${DM.topbar({ title: "Restock In Progress", subtitle: `Route: ${r.name}`, right: `<span class="status-tag stock" style="background:rgba(255,255,255,.18);color:#fff">🚚 Paused</span>`, home: true })}
    <div class="dm-body">
      <div class="notice amber">● Delivery paused · En route to warehouse</div>
      <div class="two-stat" style="grid-template-columns:1fr 1fr 1fr">
        <div class="stat-box"><div class="n" style="color:var(--green-d)">${s.delivered}</div><div class="l">Delivered</div></div>
        <div class="stat-box"><div class="n" style="color:var(--red)">${pending}</div><div class="l">Pending</div></div>
        <div class="stat-box"><div class="n">${DM.money(s.collected)}</div><div class="l">Collected</div></div>
      </div>
      <div style="background:var(--teal);color:#fff;border-radius:14px;padding:16px;display:flex;gap:12px;align-items:flex-start;margin-top:6px">
        <span style="font-size:26px">🏢</span><div><b style="font-size:15px">Drive to warehouse</b><div style="opacity:.9;font-size:13px;margin-top:3px">Load additional stock to resume delivery for ${pending} remaining customer${pending !== 1 ? "s" : ""}.</div></div>
      </div>
    </div>
    <div class="dm-foot"><button class="btn green" id="load">📦 Load Additional Stock</button></div>`;
  DM.wireTop(body);
  body.querySelector("#load").addEventListener("click", () => DM.go("load-additional", { routeId: r.id }));
};

/* Load Additional Stock — ON TRUCK vs ADD NOW. */
DM.sections["load-additional"] = function (body, params) {
  const r = DM.route(params.routeId);
  const n = (r._restockCount || 0) + 1;
  const add = (r._restockAdd = r._restockAdd || {});
  const st = DM._laQ || (DM._laQ = { q: "" });
  const totalAdd = () => Object.values(add).reduce((a, v) => a + v, 0);
  const addVal = () => DM.products.reduce((a, p) => a + (add[p.id] || 0) * p.price, 0);
  const truckAfter = () => DM.products.reduce((a, p) => a + p.truck, 0) + totalAdd();

  function draw() {
    const list = DM.products.filter((p) => !st.q || p.name.toLowerCase().includes(st.q.toLowerCase()));
    body.innerHTML = `
      ${DM.topbar({ back: true, home: true, title: "Load Additional Stock", subtitle: "", right: `<span class="status-tag stock" style="background:rgba(255,255,255,.18);color:#fff">Restock #${n}</span>` })}
      <div class="dm-body">
        <div class="dm-search" style="margin-bottom:12px"><input id="q" placeholder="Search products..." value="${DM.attr(st.q)}"></div>
        <div class="dm-table"><div class="th"><div class="c1">Product</div><div class="c">On Truck</div><div class="c wide">Add Now</div></div>
          ${list.map((p) => `<div class="tr"><div class="c1"><div class="nm">${DM.esc(p.name)}</div></div><div class="c" style="color:${p.truck > 0 ? "var(--muted)" : "var(--red)"};font-weight:700">${p.truck}</div><div class="c wide"><input class="qty-box" data-p="${p.id}" inputmode="numeric" value="${add[p.id] || 0}"></div></div>`).join("")}
        </div>
      </div>
      <div style="background:#ecfdf5;color:var(--green-d);font-weight:800;padding:11px 16px;display:flex;justify-content:space-between"><span>Total additional units:</span><span id="tot">+${totalAdd()} units</span></div>
      <div class="dm-foot"><button class="btn ${totalAdd() > 0 ? "green" : "grey"}" id="confirm" ${totalAdd() > 0 ? "" : "disabled"}>Confirm Restock${totalAdd() > 0 ? ` · ${totalAdd()} Units` : ""}</button></div>`;
    DM.wireTop(body);
    let deb; body.querySelector("#q").addEventListener("input", (e) => { clearTimeout(deb); deb = setTimeout(() => { st.q = e.target.value; draw(); }, 160); });
    body.querySelectorAll(".qty-box").forEach((inp) => inp.addEventListener("input", () => { add[inp.dataset.p] = Math.max(0, +inp.value || 0); body.querySelector("#tot").textContent = `+${totalAdd()} units`; const b = body.querySelector("#confirm"); b.className = `btn ${totalAdd() > 0 ? "green" : "grey"}`; b.disabled = totalAdd() === 0; b.textContent = totalAdd() > 0 ? `Confirm Restock · ${totalAdd()} Units` : "Confirm Restock"; }));
    body.querySelector("#confirm").addEventListener("click", () => {
      if (totalAdd() === 0) return;
      const products = DM.products.filter((p) => add[p.id] > 0).length;
      const lines = DM.products.filter((p) => add[p.id] > 0).map((p) => `<div class="order-line"><span>${DM.esc(p.name)}</span><b>× ${add[p.id]}</b></div>`).join("");
      DM.sheet({ eyebrow: `Restock #${n}`, title: `${totalAdd()} units`, sub: `${DM.money(addVal())} estimated value · ${products} product${products !== 1 ? "s" : ""}`,
        body: `<div class="order-card" style="margin:8px 0 4px">${lines}</div><div class="sheet-info"><span>${r.stops.filter((x) => x.status === "pending").length} stops waiting</span><span>${truckAfter()} units available after load</span></div>`,
        actions: [ { label: "Edit Quantities", cls: "ghost" }, { label: "Confirm Load", cls: "primary", onClick: () => {
          DM.products.forEach((p) => { p.truck += add[p.id] || 0; });
          r._loaded = r._loaded || {}; Object.keys(add).forEach((id) => { if (add[id] > 0) r._loaded[id] = (r._loaded[id] || 0) + add[id]; });
          r._restockCount = n; r._lastRestock = { n, added: totalAdd(), available: truckAfter(), time: clock() };
          r._restockAdd = {};
          DM.go("restock-done", { routeId: r.id }, true);
        } } ] });
    });
  }
  function clock() { const d = new Date(); return `${((d.getHours() + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() >= 12 ? "pm" : "am"}`; }
  draw();
};

/* Restock success. */
DM.sections["restock-done"] = function (body, params) {
  const r = DM.route(params.routeId);
  const rs = r._lastRestock;
  const waiting = r.stops.filter((x) => x.status === "pending").length;
  body.innerHTML = `
    ${DM.topbar({ title: "Stock Loaded", home: true })}
    <div class="dm-body" style="display:flex;flex-direction:column">
      <div style="text-align:center;padding:20px 0 6px"><div class="tick-badge"><div class="sq">✓</div></div>
        <h2 style="margin:0;font-size:22px">Stock loaded successfully</h2>
        <p style="color:var(--muted);margin:8px auto 0;max-width:280px">Restock #${rs.n} confirmed. Your route is ready to continue.</p>
        <div class="notice" style="justify-content:center;margin:16px auto;display:inline-flex">${waiting} stop${waiting !== 1 ? "s" : ""} waiting · Resuming delivery</div></div>
      <div class="kv-card">
        <div class="kv"><span class="k">Restock event</span><span class="v blue">#${rs.n}</span></div>
        <div class="kv"><span class="k">Units added</span><span class="v green">+${rs.added} units</span></div>
        <div class="kv"><span class="k">Available now</span><span class="v green">${rs.available} units</span></div>
        <div class="kv"><span class="k">Time</span><span class="v">${rs.time}</span></div>
      </div>
    </div>
    <div class="dm-foot"><button class="btn green" id="go">Go to Queue</button></div>`;
  DM.wireTop(body);
  body.querySelector("#go").addEventListener("click", () => { r._restockNote = `Restock #${rs.n} complete · ${rs.added} units added`; DM.go("delivery-queue", { routeId: r.id }, true); });
};

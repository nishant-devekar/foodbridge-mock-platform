/* Home — greeting, headline tiles, today's routes with search + date + status filter. */
DM.sections.home = function (body, params) {
  const st = DM._homeState || (DM._homeState = { q: "", filter: "all", date: DM.today });
  const d = DM.dashboard;
  const FILTERS = [["all", "All"], ["ready", "Ready"], ["stock", "Stock Requested"], ["in-progress", "In Progress"], ["closed", "Closed"]];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dateLabel = () => { if (!st.date) return "Date"; if (st.date === DM.today) return "Today"; const p = st.date.split("-"); return `${p[2]} ${MON[+p[1] - 1]}`; };

  function routeCard(r) {
    const s = DM.routeStats(r);
    const tag = { ready: ["ready", "Ready"], closed: ["closed", "Closed"], stock: ["stock", "Stock Requested"], "in-progress": ["progress", "In Progress"] }[r.status] || ["progress", "In Progress"];
    let sub, cta, pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
    if (r.status === "closed") { sub = `${s.done}/${s.total} completed`; cta = `<button class="btn ghost" data-summary="${r.id}">View Summary →</button>`; }
    else if (r.status === "stock") { sub = `${r.stops.length} customers · Stock request pending`; cta = `<button class="btn teal" data-stock="${r.id}">Review &amp; Load →</button>`; }
    else if (r.status === "ready") { sub = `${r.stops.length} customers · ${DM.money(0)} outstanding`; cta = `<button class="btn teal" data-start="${r.id}">Start Route →</button>`; }
    else { sub = `${s.done}/${s.total} done · ${DM.money(r.collected)} collected`; cta = `<button class="btn green" data-continue="${r.id}">Continue →</button>`; }
    const name = r.time ? `${r.name} ${r.date.split("-").reverse().join("/")} ${r.time}` : r.name;
    return `<div class="route-card">
      <div class="top"><div class="min0"><div class="nm">${DM.esc(name)}</div><div class="sub">${sub}</div></div><span class="status-tag ${tag[0]}">${tag[1]}</span></div>
      ${r.status === "in-progress" ? `<div class="route-bar"><span style="width:${pct}%"></span></div>` : `<div style="height:10px"></div>`}
      ${cta}</div>`;
  }

  const routes = DM.routes.filter((r) => {
    if (st.filter !== "all" && r.status !== st.filter) return false;
    if (st.date && r.date !== st.date) return false;
    if (st.q && !r.name.toLowerCase().includes(st.q.toLowerCase())) return false;
    return true;
  });

  body.innerHTML = `
    <div class="home-hd">
      <div class="sync"><b><span class="g"></span>Synced</b></div>
      <div class="row"><div><div class="greet">Good evening 👋</div><div class="name">${DM.esc(DM.staff)}</div></div><button class="new-btn" id="newDelivery">+ New Delivery</button></div>
    </div>
    <div class="tiles">
      <div class="tile blue"><div class="n">${d.allDeliveries}</div><div class="l">All Deliveries</div></div>
      <div class="tile green"><div class="n">${DM.money(d.target)}</div><div class="l">Target</div></div>
      <div class="tile orange"><div class="n">${d.customers}</div><div class="l">Customers</div></div>
      <div class="tile red"><div class="n">${DM.money(d.outstanding)}</div><div class="l">Outstanding</div></div>
    </div>
    <div class="dm-body" style="padding-top:0">
      <div class="sec-label">${st.date ? (st.date === DM.today ? "Today's Routes" : dateLabel() + " Routes") : "All Routes"}</div>
      <div class="search-row"><div class="dm-search"><input id="q" placeholder="Search routes..." value="${DM.attr(st.q)}"></div>
        <button class="date-btn" id="dateBtn">📅 <span>${DM.esc(dateLabel())}</span>${st.date ? ` <span class="dx" id="dateClear">✕</span>` : ""}</button>
        <input type="date" id="dateInput" value="${DM.attr(st.date)}" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none">
      </div>
      <div class="chips">${FILTERS.map(([k, l]) => `<button class="chip ${st.filter === k ? "on" : ""}" data-f="${k}">${l}</button>`).join("")}</div>
      <div id="routeList">${routes.length ? routes.map(routeCard).join("") : `<div style="text-align:center;color:var(--muted-2);padding:30px">No routes match this filter.</div>`}</div>
    </div>
    ${DM.nav("home")}`;

  DM.wireNav(body);
  body.querySelector("#newDelivery").addEventListener("click", openNewDelivery);
  let deb;
  body.querySelector("#q").addEventListener("input", (e) => { clearTimeout(deb); deb = setTimeout(() => { st.q = e.target.value; DM.render(); }, 180); });
  body.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { st.filter = b.dataset.f; DM.render(); }));
  body.querySelectorAll("[data-start]").forEach((b) => b.addEventListener("click", () => DM.go("route", { routeId: b.dataset.start })));
  body.querySelectorAll("[data-stock]").forEach((b) => b.addEventListener("click", () => DM.go("route", { routeId: b.dataset.stock })));
  body.querySelectorAll("[data-continue]").forEach((b) => b.addEventListener("click", () => DM.go("delivery-queue", { routeId: b.dataset.continue })));
  body.querySelectorAll("[data-summary]").forEach((b) => b.addEventListener("click", () => DM.toast("This section is coming soon in the next update.")));

  // ── Date filter (native picker) ──────────────────────────────────────────
  const dateInput = body.querySelector("#dateInput");
  body.querySelector("#dateBtn").addEventListener("click", (e) => {
    if (e.target.id === "dateClear") { st.date = ""; DM.render(); return; }
    try { dateInput.showPicker(); } catch (_) { dateInput.focus(); dateInput.click(); }
  });
  dateInput.addEventListener("change", (e) => { st.date = e.target.value; DM.render(); });

  // ── New Delivery modal ───────────────────────────────────────────────────
  function twoDigit(n) { return String(n).padStart(2, "0"); }
  function nowStamp() { const n = new Date(); return `${twoDigit(n.getDate())}/${twoDigit(n.getMonth() + 1)}/${n.getFullYear()} ${twoDigit(n.getHours())}:${twoDigit(n.getMinutes())}`; }
  function openNewDelivery() {
    let selId = null, name = "";
    const m = DM.modal({ title: "New Delivery", subtitle: "Select a route template to begin", body: `<div id="tmplList"></div>`,
      actions: [ { label: "Cancel", cls: "ghost" }, { label: "Start Delivery", cls: "primary", onClick: () => { if (!selId) return false; startDelivery(selId, name); } } ] });
    const startBtn = m.el.querySelector('[data-a="1"]'); startBtn.disabled = true;
    const list = m.el.querySelector("#tmplList");
    function paint() {
      list.innerHTML = DM.templates.map((t) => `<button class="tmpl-row ${selId === t.id ? "sel" : ""}" data-t="${t.id}"><span class="radio">${selId === t.id ? "<span class='dot'></span>" : ""}</span><span class="ti"><b>${DM.esc(t.name)}</b><small>${t.stops.length} customers · ${t.staff} staff</small></span>${selId === t.id ? "" : `<span class="chev">›</span>`}</button>${selId === t.id ? `<div class="tmpl-name"><div class="lbl">Delivery Name</div><input id="delName" value="${DM.attr(name)}"></div>` : ""}`).join("");
      list.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => {
        selId = b.dataset.t; const t = DM.templates.find((x) => x.id === selId); name = `${t.name} ${nowStamp()}`;
        startBtn.disabled = false; paint();
        const inp = list.querySelector("#delName"); if (inp) { inp.focus(); inp.select(); inp.addEventListener("input", (e) => (name = e.target.value)); }
      }));
    }
    paint();
  }
  function startDelivery(tid, name) {
    const t = DM.templates.find((x) => x.id === tid);
    const id = "r-new-" + Date.now();
    const stops = (t.stops || []).map((s, i) => ({ id: `${id}-s${i}`, name: s.name, phone: s.phone, order: (s.order || []).map((l) => ({ ...l })), status: "pending", collected: 0, paymentMode: null, overPayment: 0, addedOnRoute: false }));
    DM.routes.unshift({ id, name: (name || "").trim() || t.name, date: DM.today, time: null, status: "ready", beatArea: t.name, stockLoaded: 0, openingCash: 0, stops, collected: 0, proxyStock: stops.flatMap((s) => s.order) });
    DM.toast("Delivery created");
    DM.go("route", { routeId: id });
  }
};

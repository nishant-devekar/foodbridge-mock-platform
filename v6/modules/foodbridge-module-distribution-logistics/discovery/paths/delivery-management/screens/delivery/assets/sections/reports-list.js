/* Reports — history of completed route reports. */
DM.sections["reports-list"] = function (body, params) {
  const st = DM._reportsQ || (DM._reportsQ = { q: "", sort: "new" });
  let closed = DM.routes.filter((r) => r.status === "closed");
  if (st.q) closed = closed.filter((r) => r.name.toLowerCase().includes(st.q.toLowerCase()));
  if (st.sort === "old") closed = closed.slice().reverse();

  function card(r) {
    const s = DM.routeStats(r);
    return `<div class="route-card">
      <div class="top"><div><div class="nm">${DM.esc(r.name)}</div><div class="sub">${new Date(r.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · ${s.done}/${s.total} completed</div></div><span class="status-tag ready">Final</span></div>
      <div style="display:flex;gap:24px;margin:14px 0 12px">
        <div><div class="sec-label" style="margin:0">Collected</div><div style="color:var(--green-d);font-weight:800;font-size:15px">${DM.money(s.collected)}</div></div>
        <div><div class="sec-label" style="margin:0">Outstanding</div><div style="color:var(--green-d);font-weight:800;font-size:15px">${DM.money(s.outstanding)}</div></div>
      </div>
      <button class="btn ghost" data-report="${r.id}">View Report →</button></div>`;
  }

  body.innerHTML = `
    ${DM.topbar({ title: "Reports", subtitle: "Completed route reports" })}
    <div class="tiles" style="grid-template-columns:1fr 1fr">
      <div class="stat-box"><div class="n">${DM.reportsCount}</div><div class="l">Reports</div></div>
      <div class="stat-box"><div class="n green">${DM.money(DM.reportsCollected)}</div><div class="l">Collected</div></div>
    </div>
    <div class="dm-body" style="padding-top:0">
      <div class="sec-label" style="color:var(--ink);font-size:15px;text-transform:none;font-weight:800">Report history</div>
      <div class="dm-search" style="margin-bottom:10px"><input id="q" placeholder="Search reports..." value="${DM.attr(st.q)}"></div>
      <div class="search-row"><button class="date-btn" style="flex:1;justify-content:center">📅 All dates</button><button class="date-btn" id="sort" style="flex:1;justify-content:center">↕ ${st.sort === "new" ? "Newest first" : "Oldest first"}</button></div>
      ${closed.length ? closed.map(card).join("") : `<div style="text-align:center;color:var(--muted-2);padding:30px">No reports match this search.</div>`}
    </div>
    ${DM.nav("reports")}`;

  DM.wireTop(body); DM.wireNav(body);
  let deb; body.querySelector("#q").addEventListener("input", (e) => { clearTimeout(deb); deb = setTimeout(() => { st.q = e.target.value; DM.render(); }, 160); });
  body.querySelector("#sort").addEventListener("click", () => { st.sort = st.sort === "new" ? "old" : "new"; DM.render(); });
  body.querySelectorAll("[data-report]").forEach((b) => b.addEventListener("click", () => DM.go("route-report", { routeId: b.dataset.report })));
};

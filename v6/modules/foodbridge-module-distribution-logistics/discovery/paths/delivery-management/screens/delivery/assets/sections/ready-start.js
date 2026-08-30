/* Ready to Start — confirmation summary + start / start-later. */
DM.sections["ready-start"] = function (body, params) {
  const r = DM.route(params.routeId);
  const now = new Date();
  const time = `${((now.getHours() + 11) % 12) + 1}:${String(now.getMinutes()).padStart(2, "0")} ${now.getHours() >= 12 ? "pm" : "am"}`;
  r._startTime = r._startTime || time;

  body.innerHTML = `
    ${DM.topbar({ back: "Opening Cash", home: true, title: "Ready to Start", subtitle: `${r.name} · ${new Date(r.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` })}
    <div class="dm-body">
      <div class="kv-card">
        <div class="kv"><span class="k">CONFIRMED</span><span></span></div>
        <div class="kv"><span class="k">📦 Stock Loaded</span><span class="v green">${r.stockLoaded} units ✓</span></div>
        <div class="kv"><span class="k">💵 Opening Cash</span><span class="v green">${DM.money(r.openingCash)} ✓</span></div>
        <div class="kv"><span class="k">👥 Customers</span><span class="v">${r.stops.length} stops</span></div>
        <div class="kv"><span class="k">🗺️ Beat Area</span><span class="v">${DM.esc(r.beatArea)}</span></div>
        <div class="kv"><span class="k">⏰ Start Time</span><span class="v">${r._startTime}</span></div>
      </div>
      <div class="notice green" style="margin-top:14px">✅ By tapping Start you confirm the above and take responsibility for the stock and cash.</div>
    </div>
    <div class="dm-foot"><button class="btn ghost" id="later">Start Later</button><button class="btn green" id="start" style="flex:1.6">🚀 Start Route Now</button></div>`;

  DM.wireTop(body);
  body.querySelector("#later").addEventListener("click", () => { DM.toast("Route saved — start it later from Home."); DM.go("home"); });
  body.querySelector("#start").addEventListener("click", () => { r.status = "in-progress"; r.startedAt = r._startTime; DM.toast("Route started 🚀"); DM.go("delivery-queue", { routeId: r.id }, true); });
};

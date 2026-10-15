/* Delivery queue — the route's stop list with the current stop highlighted. */
DM.sections["delivery-queue"] = function (body, params) {
  const r = DM.route(params.routeId);
  const st = DM._queueQ || (DM._queueQ = { q: "" });
  const collected = r.stops.reduce((a, s) => a + (s.collected || 0), 0);
  const current = r.stops.find((s) => s.status === "pending");
  const stops = r.stops.filter((s) => !st.q || s.name.toLowerCase().includes(st.q.toLowerCase()) || (s.phone || "").includes(st.q));

  function item(s) {
    const done = s.status !== "pending";
    const isCurrent = current && s.id === current.id;
    if (done) {
      const over = s.overPayment > 0;
      return `<div class="queue-item" data-stop="${s.id}"><div class="queue-av done">✓</div><div class="qi"><div class="nm">${DM.esc(s.name)}</div><div class="st">${DM.money(s.collected || 0)}${over ? " · Over Payment" : s.status === "skipped" ? " · Skipped" : ""}</div></div><div style="text-align:right"><div class="tick2">✓✓</div><div class="time">${s._time || ""}</div></div></div>`;
    }
    return `<div class="queue-item ${isCurrent ? "current" : ""}" data-stop="${s.id}"><div class="queue-av">${DM.initials(s.name)}</div><div class="qi"><div class="nm">${DM.esc(s.name)}</div><div class="st">${isCurrent ? "Current stop" : "Upcoming"}</div></div>${isCurrent ? `<div class="go">→</div>` : ""}</div>`;
  }

  body.innerHTML = `
    <div class="dm-topbar plain"><div class="tb-row"><button class="tb-back" id="tbBack">← Routes</button>
      <div class="tb-right"><span style="font-size:12px;opacity:.9"><b>${DM.money(collected)}</b> collected this route</span><button class="tb-home" id="tbHome">⌂</button><button class="tb-home" id="menuBtn">☰</button></div></div></div>
    <div style="height:4px;background:var(--green)"></div>
    <div class="dm-body">
      <div class="dm-search" style="margin-bottom:12px"><input id="q" placeholder="Search by name or phone..." value="${DM.attr(st.q)}"></div>
      ${r._restockNote ? `<div class="queue-note">✅ ${DM.esc(r._restockNote)}</div>` : ""}
      ${stops.map(item).join("")}
      <div class="queue-item queue-add" id="addCust"><div class="plus">+</div><div class="qi"><div class="nm">Add Customer</div><div class="st">Add a new stop to this route</div></div></div>
    </div>`;

  body.querySelector("#tbBack").addEventListener("click", () => DM.go("home"));
  body.querySelector("#tbHome").addEventListener("click", () => DM.go("home"));
  let deb; body.querySelector("#q").addEventListener("input", (e) => { clearTimeout(deb); deb = setTimeout(() => { st.q = e.target.value; DM.render(); }, 160); });
  body.querySelectorAll("[data-stop]").forEach((b) => b.addEventListener("click", () => DM.go("stop-detail", { routeId: r.id, stopId: b.dataset.stop })));
  body.querySelector("#addCust").addEventListener("click", () => DM.go("new-customer", { routeId: r.id }));

  body.querySelector("#menuBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    if (body.querySelector(".hdr-menu")) { body.querySelector(".hdr-menu").remove(); return; }
    const menu = document.createElement("div"); menu.className = "hdr-menu";
    menu.innerHTML = `<button data-m="restock">↻&nbsp; Restock</button><button data-m="settle">₹&nbsp; Return &amp; Settle</button>`;
    body.appendChild(menu);
    menu.querySelector("[data-m='restock']").addEventListener("click", () => openRestockPrompt());
    menu.querySelector("[data-m='settle']").addEventListener("click", () => DM.go("settle-route", { routeId: r.id }));
    const off = (ev) => { if (!menu.contains(ev.target) && ev.target.id !== "menuBtn") { menu.remove(); document.removeEventListener("click", off); } };
    setTimeout(() => document.addEventListener("click", off), 0);
  });

  function openRestockPrompt() {
    body.querySelector(".hdr-menu")?.remove();
    DM.sheet({ eyebrow: "Restock", title: "Pause for restock", sub: "Drive to the warehouse and load additional stock",
      actions: [ { label: "Continue Delivering", cls: "ghost" }, { label: "Begin Restock", cls: "primary", onClick: () => DM.go("restock", { routeId: r.id }) } ] });
  }
};

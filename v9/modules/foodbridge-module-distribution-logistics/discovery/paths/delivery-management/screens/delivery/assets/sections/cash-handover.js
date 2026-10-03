/* Cash Handover — reconcile cash, expenses, denomination breakdown, sign off. */
DM.sections["cash-handover"] = function (body, params) {
  const r = DM.route(params.routeId);
  const c = (r._cash = r._cash || { expenses: [{ name: "Route Bhatta", amount: 0 }, { name: "Toll Recharge", amount: 0 }, { name: "Diesel", amount: 0 }], expenseOpen: false, docs: 0, cashbreak: null, cashbreakOpen: false, actual: "" });

  const cashCollected = r.stops.filter((s) => s.paymentMode === "cash").reduce((a, s) => a + (s.collected || 0), 0);
  const upiCollected = r.stops.filter((s) => s.paymentMode === "upi").reduce((a, s) => a + (s.collected || 0), 0);
  const totalExp = () => c.expenses.reduce((a, e) => a + (+e.amount || 0), 0);
  const toHandOver = () => r.openingCash + cashCollected - totalExp();

  function draw() {
    const actualN = c.actual === "" ? null : +c.actual;
    body.innerHTML = `
      ${DM.topbar({ back: "Settlement", home: true, title: "Cash Handover", subtitle: "Count your cash before handing over" })}
      <div class="dm-body">
        <div class="kv-card">
          <div class="kv"><span class="k">SUMMARY</span><span></span></div>
          <div class="kv"><span class="k">Opening Cash (change)</span><span class="v">${DM.money(r.openingCash)}</span></div>
          <div class="kv"><span class="k">Cash Collected</span><span class="v green">${DM.money(cashCollected)}</span></div>
          <div class="kv"><span class="k">UPI Collected</span><span class="v blue">${DM.money(upiCollected)}</span></div>
          <div class="expand-hd"><span class="k">Expense ${c.expenseOpen ? "⌄" : "›"}</span><div class="acts"><button class="add" id="expAdd">＋</button><button id="expDoc" style="color:var(--muted-2)">📎</button></div></div>
          ${c.expenseOpen ? `<div id="expBody">${c.expenses.map((e, i) => `<div class="sub-row"><span class="rn">${DM.esc(e.name)}</span><span class="rv">-${DM.money(+e.amount || 0)}</span><button class="ib edit" data-ee="${i}">✏️</button><button class="ib del" data-ed="${i}">✕</button></div>`).join("")}${c.docs ? `<div style="color:var(--teal);font-size:12px;padding:6px 0"><b>⌄ ${c.docs} expense document</b><div style="display:flex;align-items:center;gap:8px;margin-top:6px;color:var(--blue)">📄 Screenshot from 2026-08-11.png <span style="margin-left:auto">👁️</span></div></div>` : ""}<div class="kv" style="border:none"><span class="k">Total Expenses</span><span class="v red">-${DM.money(totalExp())}</span></div></div>` : ""}
          <div class="expand-hd"><span class="k">Cashbreak ${c.cashbreakOpen ? "⌄" : ""}</span><div class="acts"><button class="add" id="cbAdd">＋</button></div></div>
          ${c.cashbreakOpen && c.cashbreak ? `<div class="cur-table">${Object.entries(c.cashbreak).filter(([, q]) => q > 0).map(([d, q]) => `<div class="tr" style="padding:8px 0"><span class="cur-name">${d}</span><span class="cur-qty" style="width:60px"><input value="${q}" readonly style="text-align:center"></span><span class="cur-amt">${(+d * q).toLocaleString("en-IN")}</span></div>`).join("")}<div class="kv" style="border:none"><span class="k">Total Cashbreak</span><span class="v">${DM.money(cbTotal())}</span></div></div>` : ""}
          <div class="kv" style="border:none"><span class="k" style="font-weight:800;color:var(--ink)">Cash to Hand Over</span><span class="v big green">${DM.money(toHandOver())}</span></div>
        </div>
        <div class="field-lbl">Actual Cash Counted</div>
        <input class="dm-input" id="actual" inputmode="numeric" placeholder="Enter amount..." value="${DM.attr(c.actual)}">
        <div class="field-lbl">Delivery Person <span class="req">*</span></div>
        <input class="dm-input plain" value="${DM.esc(DM.staff)}" readonly>
      </div>
      <div class="dm-foot"><button class="btn ${actualN != null ? "teal" : "grey"}" id="cta" ${actualN != null ? "" : "disabled"}>Count cash to continue</button></div>`;
    DM.wireTop(body);
    body.querySelector(".expand-hd").addEventListener("click", (e) => { if (e.target.closest(".acts")) return; c.expenseOpen = !c.expenseOpen; draw(); });
    body.querySelectorAll(".expand-hd")[1].addEventListener("click", (e) => { if (e.target.closest(".acts")) return; c.cashbreakOpen = !c.cashbreakOpen; draw(); });
    body.querySelector("#expAdd").addEventListener("click", () => { c.expenseOpen = true; c.expenses.push({ name: "New Expense", amount: 0 }); draw(); });
    body.querySelector("#expDoc").addEventListener("click", () => { c.expenseOpen = true; c.docs = 1; DM.toast("Expense document attached"); draw(); });
    body.querySelectorAll("[data-ed]").forEach((b) => b.addEventListener("click", () => { c.expenses.splice(+b.dataset.ed, 1); draw(); }));
    body.querySelectorAll("[data-ee]").forEach((b) => b.addEventListener("click", () => editExpense(+b.dataset.ee)));
    body.querySelector("#cbAdd").addEventListener("click", openCurrency);
    body.querySelector("#actual").addEventListener("input", (e) => { c.actual = e.target.value.replace(/\D/g, ""); const n = c.actual === "" ? null : +c.actual; const b = body.querySelector("#cta"); b.className = `btn ${n != null ? "teal" : "grey"}`; b.disabled = n == null; });
    body.querySelector("#cta").addEventListener("click", () => {
      const n = +c.actual || 0, diff = n - toHandOver();
      DM.sheet({ eyebrow: "Cash handover", title: `${DM.money(n)} counted`, sub: `${diff === 0 ? "✓ Matches expected" : (diff > 0 ? "⚠ +" : "⚠ ") + DM.money(Math.abs(diff)) + " discrepancy"} · delivery person: ${DM.staff}`,
        actions: [ { label: "Recount Cash", cls: "ghost" }, { label: "Sign Off", cls: "primary", onClick: () => { r._settlement = r._settlement || {}; r._settlement.cashHandover = true; DM.toast("Cash handed over"); DM.go("settle-route", { routeId: r.id }, true); } } ] });
    });
  }
  function cbTotal() { return c.cashbreak ? Object.entries(c.cashbreak).reduce((a, [d, q]) => a + +d * q, 0) : 0; }
  function editExpense(i) {
    const e = c.expenses[i];
    DM.sheet({ eyebrow: "Expense", title: e.name, body: `<div class="field-lbl">Amount</div><input class="dm-input" id="eamt" inputmode="numeric" value="${e.amount || ""}"><div class="field-lbl">Name</div><input class="dm-input plain" id="enm" value="${DM.attr(e.name)}">`,
      actions: [ { label: "Cancel", cls: "ghost" }, { label: "Save", cls: "primary", onClick: () => { const sc = document.querySelector(".dm-sheet"); e.amount = +sc.querySelector("#eamt").value || 0; e.name = sc.querySelector("#enm").value.trim() || e.name; draw(); } } ] });
  }
  function openCurrency() {
    const denom = [500, 200, 100, 50, 20, 10];
    const qty = Object.assign({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0 }, c.cashbreak || {});
    const sh = DM.sheet({ title: "Add Currency", body: `<div id="curBody"></div>`,
      actions: [ { label: "Save Breakdown", cls: "primary", onClick: () => { c.cashbreak = qty; c.cashbreakOpen = true; DM.toast("Breakdown saved"); draw(); } } ] });
    function paintCur() {
      const total = denom.reduce((a, d) => a + d * (qty[d] || 0), 0);
      sh.el.querySelector("#curBody").innerHTML = `<div class="dm-table cur-table" style="border:none"><div class="th" style="background:#fff;color:var(--muted-2)"><div class="c1">Currency</div><div class="c">Qty</div><div class="c">Amount</div></div>
        ${denom.map((d) => `<div class="tr"><span class="cur-name c1">${d}</span><span class="cur-qty"><input data-d="${d}" inputmode="numeric" value="${qty[d] || 0}"></span><span class="cur-amt c">${(d * (qty[d] || 0)).toLocaleString("en-IN")}</span></div>`).join("")}
        <div class="tr total"><span class="c1">Total</span><span class="c"></span><span class="c" style="color:var(--green-d)">${DM.money(total)}</span></div></div>
        <div class="sheet-info" style="justify-content:flex-end;font-size:16px;font-weight:800;color:var(--teal);padding:10px 4px 0">Total ${DM.money(total)}</div>`;
      sh.el.querySelectorAll("[data-d]").forEach((inp) => inp.addEventListener("input", () => { qty[inp.dataset.d] = Math.max(0, +inp.value || 0); paintCur(); }));
    }
    paintCur();
  }
  draw();
};

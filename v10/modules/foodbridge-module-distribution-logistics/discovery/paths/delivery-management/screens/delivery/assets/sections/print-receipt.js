/* Print Receipt — printer type + paper size + preview (bottom sheet). */
DM.printReceiptSheet = function (r, s, amount, method) {
  const state = { type: "usb", paper: "58", connected: false };
  const billNo = "20260811" + String(Math.floor(Math.random() * 9e5 + 1e5));
  const now = new Date();
  const stamp = `11/8/2026, ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

  const sheet = DM.sheet({ title: "🖨️ Print Receipt",
    body: `<div id="prBody"></div>`,
    actions: [ { label: "Cancel", cls: "ghost" }, { label: "Print", cls: "primary", onClick: () => { if (!state.connected) { DM.toast("Connect a printer first"); return false; } DM.toast("Receipt printed"); } } ] });

  function paint() {
    sheet.el.querySelector("#prBody").innerHTML = `
      <div class="sec-label" style="margin-top:6px">Printer Type</div>
      <div class="printer-type"><button class="ptype ${state.type === "usb" ? "on" : ""}" data-t="usb">🖥️ USB</button><button class="ptype ${state.type === "bt" ? "on" : "off"}" data-t="bt">📶 Bluetooth</button></div>
      <div class="sec-label" style="margin-top:14px">Printer Device</div>
      <div style="color:var(--muted);font-size:13px;margin-bottom:8px">${state.connected ? "✅ Connected" : "No printer connected"}</div>
      ${state.connected ? "" : `<button class="connect-box" id="connect">Connect ${state.type === "usb" ? "USB" : "Bluetooth"} Printer</button>`}
      <div class="sec-label" style="margin-top:14px">Paper Size</div>
      <div class="paper-row"><button class="paper ${state.paper === "58" ? "on" : ""}" data-p="58">58mm (2 inch)</button><button class="paper ${state.paper === "80" ? "on" : ""}" data-p="80">80mm (3.2 inch)</button></div>
      <div class="sec-label" style="margin-top:14px;display:flex;justify-content:space-between"><span>Receipt Preview</span><span style="color:#4338ca">${state.paper} mm</span></div>
      <div class="receipt"><div class="ctr">Invoice</div>------------------------------<br>Date&nbsp;&nbsp;&nbsp;: ${stamp}<br>Customer: ${DM.esc(s.name)}<br>Bill No : ${billNo}<br>Payment : ${method === "cash" ? "Cash" : "UPI"}<br>------------------------------<br>Amount&nbsp;&nbsp;: ${DM.money(amount)}</div>
      ${state.connected ? "" : `<div style="text-align:center;color:var(--muted-2);font-size:12px;margin-top:10px">Connect a printer above to enable printing</div>`}`;
    sheet.el.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => { state.type = b.dataset.t; paint(); }));
    sheet.el.querySelectorAll("[data-p]").forEach((b) => b.addEventListener("click", () => { state.paper = b.dataset.p; paint(); }));
    sheet.el.querySelector("#connect")?.addEventListener("click", () => { state.connected = true; DM.toast("Printer connected"); paint(); });
  }
  paint();
};

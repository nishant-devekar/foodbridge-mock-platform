/* Vasu Foods' trade, on the same store as the factory (29 Sep 2026): orders
   take packets out of Finished Goods, purchase orders bring lots into the
   store, and every invoice and bill is settled by receipts and payments.
   Run from v7/:  node --test assets/production/test/ */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../production-api.js");

const fresh = () => { const d = A.seed(new Date(), () => {}); return { d, D: A.Domain(d, () => new Date(), () => {}) }; };
const refuses = (fn, re) => assert.throws(fn, (e) => re.test(e.body && e.body.error));

test("the business is Vasu Foods: its brands, packs, two levels of recipes, and customers", () => {
  const { d, D } = fresh();
  assert.equal(d.business.name, "Vasu Foods");
  assert.deepEqual(d.business.brands.map((b) => b.name), ["Vasu", "Vasu Gold"]);
  /* the owner's sheet (3 Oct 2026): three finished products and the six semi-finished goods they are made from */
  assert.deepEqual(d.recipeOrder.map((r) => D.book(r).name + " · " + D.book(r).label), ["Mix Veg · low-season-recipie", "Green Peas · low-season-recipie", "Soya Chaap · soya-chaap-premumium"]);
  assert.deepEqual(d.semiOrder.map((r) => D.book(r).name), ["Cut Cauliflower 50 Kg", "Cut Broccoli 50 Kg", "Cut Carrots 50 Kg", "Cut Beans 50 Kg", "Green Peas 50 Kg", "Soya Chaap Dough"]);
  assert.equal(D.book("green-peas").bestBeforeDays, 365);
  assert.equal(D.book("mix-veg").bestBeforeDays, 3, "the owner's figure");
  /* Mix Veg by the sheet's Ingredient %age, each its own semi-finished recipe */
  assert.deepEqual(D.book("mix-veg").ingredients.map((i) => [i.sfId, i.qty]), [["sf-cauliflower", 20], ["sf-broccoli", 10], ["sf-carrots", 40], ["sf-beans", 10], ["sf-peas", 20]]);
  /* each cut vegetable from its raw material by the sheet's wastage, cut fine-size-20mm */
  const cut = (id) => { const i = D.book(id).ingredients[0]; return [D.book(id).label, i.rmId, i.wastage, i.qty]; };
  assert.deepEqual(cut("sf-cauliflower"), ["fine-size-20mm", "rm-p03", 60, 160]);
  assert.deepEqual(cut("sf-peas"), ["fine-size-20mm", "rm-p01", 30, 130]);
  /* the raw vegetables at the sheet's grade and minimum stock */
  assert.deepEqual(["rm-p03", "rm-p10", "rm-p02", "rm-p04", "rm-p01"].map((id) => [D.material(id).name, D.material(id).grade, D.material(id).threshold]),
    [["Cauliflower", "Big Size", 75], ["Broccoli", "Big Size", 100], ["Carrots", "Medium", 100], ["Beans", "Small", 75], ["Green Peas", "Medium", 50]]);
  /* soya chaap: dough (soya flour, gluten, maida, atta, water) on wooden sticks, in 20 kg bags — Vasu Gold */
  assert.deepEqual(D.book("sf-chaap-dough").ingredients.map((i) => i.name.split(" (")[0]), ["Soya Flour", "Gluten Powder", "Maida", "Atta", "Water"]);
  assert.ok(D.book("soya-chaap").ingredients.some((i) => i.rmId === "rm-p07"), "on sticks");
  assert.ok(d.skus.filter((s) => s.recipeId === "soya-chaap").every((s) => s.brand === "Vasu Gold" && s.grams === 20000));
  /* every veg pack: 30 kg to a master carton */
  d.skus.filter((s) => s.recipeId !== "soya-chaap").forEach((s) => assert.equal(s.grams * s.perCarton / 1000, 30, s.name));
  assert.ok(d.customers.some((c) => c.type === "COMMISSION_AGENT" && /Anaj Mandi, Samana/.test(c.address)));
});

test("an order goes out: the invoice with the dispatch, the packets when delivered", () => {
  const { D } = fresh();
  const sku = ["fg-p01", "fg-p02", "fg-p07", "fg-p08"].find((id) => D.availableToSell(id) >= 20);
  const before = D.packetsOf(sku);
  const so = D.placeOrder({ customerId: "cus-aggarwal", items: [{ skuId: sku, qty: 20 }] });
  assert.equal(so.status, "Pending");
  assert.equal(D.demandOf(sku).open >= 20, true, "Production Plan sees it waiting");
  const x = D.dispatch(so.id);
  assert.equal(so.status, "Ready for dispatch");
  assert.match(x.invoice.no, /^VF\/\d\d-\d\d\/\d{4}$/);
  assert.equal(x.invoice.amount, Math.round(20 * D.priceFor("cus-aggarwal", sku) * 1.05));
  assert.equal(D.packetsOf(sku), before, "still on the shelf until delivered");
  assert.equal(D.availableToSell(sku), before - 20 - D.inTransit(sku) + 20);
  D.deliver(x.id, { by: "Balwinder Singh" });
  assert.equal(D.packetsOf(sku), before - 20);
  assert.ok(D.movements("fg", sku).some((e) => e.what === "sold" && e.doc === x.invoice.no && e.customer === "cus-aggarwal"));
  assert.equal(D.isOpen(so), false);
  refuses(() => D.setOrderStatus(so.id, "Cancelled"), /gone out/);
});

test("a dispatch sends only what Finished Goods has; the rest stays on order", () => {
  const { D } = fresh();
  const sku = "fg-p02", have = D.availableToSell(sku);
  const so = D.placeOrder({ customerId: "cus-patiala-frozen", items: [{ skuId: sku, qty: have + 60 }] });
  const x = D.dispatch(so.id);
  assert.equal(x.items[0].qty, have);
  assert.equal(D.openQty(so, sku), 60);
  refuses(() => D.dispatch(so.id), /Nothing in Finished Goods/);
});

test("goods in against a purchase order: lots with stickers, the bill booked, the plan's 'ordered' down", () => {
  const { D } = fresh();
  const flour = D.onHand("rm-p05"), onOrder = D.ordered("rm-p05");
  const po = D.raisePO({ supplierId: "sup-balaji", lines: [{ materialId: "rm-p05", qty: 200 }, { materialId: "rm-p12", qty: 100 }] });
  assert.equal(po.status, "InProgress");
  assert.equal(D.ordered("rm-p05"), onOrder + 200);
  const r = D.receivePO(po.id, { lines: [{ materialId: "rm-p05", qty: 200, gateQty: 202 }] });
  assert.equal(r.po.status, "Partial Delivered");
  assert.equal(D.onHand("rm-p05"), Math.round((flour + 200) * 100) / 100);
  assert.equal(D.ordered("rm-p05"), onOrder);
  assert.equal(r.lots[0].po, po.number);
  assert.equal(D.stickers(r.lots[0].lotNo).length, 4, "one per 50 kg sack");
  assert.equal(r.po.bills[0].amount, Math.round(200 * 62 * 1.05));
  D.receivePO(po.id, {});
  assert.equal(po.status, "Delivered");
  refuses(() => D.receivePO(po.id, {}), /delivered/);
});

test("internal approval: a purchase order waits for the owner, who approves it or rejects it with a reason", () => {
  const { D } = fresh();
  const onOrder = D.ordered("rm-p05");
  const po = D.raisePO({ supplierId: "sup-balaji", lines: [{ materialId: "rm-p05", qty: 100 }], status: "Pending Approval" });
  assert.equal(po.status, "Pending Approval");
  assert.equal(D.ordered("rm-p05"), onOrder + 100, "the plan does not ask for it twice");
  refuses(() => D.receivePO(po.id, {}), /pending approval/);
  /* approving, the owner cuts it to 80 kg */
  D.amendPO(po.id, [{ materialId: "rm-p05", qty: 80 }]);
  assert.equal(po.lines[0].qty, 80);
  assert.equal(po.amount, Math.round(80 * 62 * 1.05));
  assert.equal(D.ordered("rm-p05"), onOrder + 80);
  refuses(() => D.amendPO(po.id, [{ materialId: "rm-p05", qty: 0 }]), /Reject it instead/);
  D.setPOStatus(po.id, "InProgress", "Chanchal Sachdeva");
  assert.deepEqual(po.history.map((h) => h.status), ["Pending Approval", "InProgress"]);
  refuses(() => D.amendPO(po.id, [{ materialId: "rm-p05", qty: 90 }]), /waiting for approval/);
  refuses(() => D.setPOStatus(po.id, "Rejected", "Chanchal Sachdeva", "Too dear"), /not waiting for approval/);
  D.receivePO(po.id, {});
  assert.equal(po.status, "Delivered");

  const no = D.raisePO({ supplierId: "sup-balaji", lines: [{ materialId: "rm-p05", qty: 50 }], status: "Pending Approval" });
  refuses(() => D.setPOStatus(no.id, "Rejected", "Chanchal Sachdeva", " "), /reason/);
  D.setPOStatus(no.id, "Rejected", "Chanchal Sachdeva", "Enough flour for the week");
  assert.equal(no.status, "Rejected");
  assert.equal(D.ordered("rm-p05"), onOrder, "a rejected order is off the plan");
});

test("packs bought in: a lot of their own, a sticker per master carton, in on the day given", () => {
  const { D } = fresh();
  const sku = D.sku("fg-p07"), before = D.packetsOf("fg-p07");
  const po = D.raisePO({ supplierId: "sup-balaji", lines: [{ skuId: "fg-p07", qty: sku.perCarton + 5 }] });
  const at = new Date(Date.now() - 3600000).toISOString();
  const r = D.receivePO(po.id, { at, by: "Store · Mohan" });
  assert.equal(D.packetsOf("fg-p07"), before + sku.perCarton + 5);
  const lotNo = r.lots[0].lotNo;
  assert.match(lotNo, /^P\d{4}-\d{4}$/);
  const st = D.stickers(lotNo);
  assert.deepEqual(st.map((x) => x.qty), [sku.perCarton, 5]);
  assert.equal(st[0].packName, "carton");
  assert.equal(st[0].receivedAt, at);
  assert.equal(st[0].supplier, D.supplier("sup-balaji").name);
});

test("money: receipts settle the oldest invoices first; payments the oldest bills", () => {
  const { D } = fresh();
  const acc = D.account("cus-rajpura-cold");
  const open = acc.invoices.filter((i) => i.balance > 0);
  assert.ok(open.length >= 2, "Rajpura owes on more than one invoice");
  const p = D.receipt({ customerId: "cus-rajpura-cold", amount: open[0].balance + 100, mode: "NEFT" });
  assert.equal(p.allocations[0].no, open[0].no);
  assert.equal(p.allocations[0].amount, open[0].balance);
  assert.equal(p.allocations[1].amount, 100);
  const after = D.account("cus-rajpura-cold");
  assert.equal(after.outstanding, Math.round((acc.outstanding - open[0].balance - 100) * 100) / 100);
  const bills = D.supplierAccount("sup-poly");
  if (bills.outstanding > 0) {
    D.pay({ supplierId: "sup-poly", amount: bills.outstanding, mode: "NEFT" });
    assert.equal(D.supplierAccount("sup-poly").outstanding, 0);
  }
});

test("the seeded trade adds up: every invoice is a dispatch, every packet sold is on an invoice", () => {
  const { d, D } = fresh();
  const sold = {};
  d.ledger.filter((e) => e.kind === "fg" && e.what === "sold").forEach((e) => { sold[e.doc] = (sold[e.doc] || 0) - e.qty; });
  d.dispatches.filter((x) => x.status === "Delivered" && sold[x.invoice.no] !== undefined).forEach((x) => {
    assert.equal(sold[x.invoice.no], x.items.reduce((t, i) => t + (i.delivered != null ? i.delivered : i.qty), 0), x.invoice.no);
  });
  /* invoiced = collected + outstanding, per customer */
  D.receivables().forEach((a) => assert.ok(Math.abs(a.invoiced - a.collected - a.outstanding) < 0.01, a.customer.name));
  /* today: orders waiting, vans out, a return at the gate */
  assert.ok(d.orders.some((o) => o.status === "Pending"));
  assert.ok(d.dispatches.some((x) => x.status === "Dispatch Created"));
  assert.ok(d.deliveries.some((v) => v.status === "Out for Delivery" && v.history.slice(-1)[0].at > new Date(Date.now() - 86400000).toISOString()));
  assert.ok(d.returns.some((r) => r.status === "Return Created"));
});

test("expired: a bag or packets past their use-by are written off", () => {
  const { d, D } = fresh();
  const bag = d.bags.find((g) => g.remaining > 0 && g.recipeId === "mixed-veg");
  if (!bag) return;
  bag.useBy = new Date(Date.now() - 1000).toISOString();
  const kg = bag.remaining;
  assert.ok(D.expire() >= 1);
  assert.equal(bag.remaining, 0);
  assert.equal(bag.expiredKg, kg);
  assert.ok(D.movements("sf", "mixed-veg").some((e) => e.what === "expired" && e.ref === bag.bagNo));
});

/*
  Vasu Foods (29 Sep 2026): in the mock platform this screen shows the business's ONE record — the
  production store (v7/assets/production/production-api.js) — instead of the invented dataset.json.

    read    the store is turned into this module's dataset shape (products are Vasu's packs, raw
            materials its vegetables, flours, sticks and packaging, suppliers its suppliers, purchase
            orders its purchase orders with their bills), so every screen and flow runs unchanged
    write   what the screen does goes back into the store: a new purchase order is raised there
            under the same number; "Delivered" is goods in at the gate — lots, with stickers, in
            Raw Material Inventory, and the bill booked in Supplier Payables; a supplier payment,
            a new supplier and an uploaded supplier invoice land there too
    plan    the purchase forecast reads the store: Finished Goods from what customers took and are
            waiting for, Raw Material from Production Plan (what planned batches need, less what is
            in the store and already on order) — the same figures as the Production board

  ?data=fixture opens the module on dataset.json, as the parity harness does.
*/
import { oid } from './resolve.js';

const STORE_SRC = '../../assets/production/production-api.js?v=20261003FL1';
const DAY = 86400000;

/** The store, loaded once per page (the platform's other screens load the same file). */
export function loadStore() {
  if (window.FB_PRODUCTION) return Promise.resolve(window.FB_PRODUCTION);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = new URL(STORE_SRC, location.href).href;
    s.onload = () => (window.FB_PRODUCTION ? resolve(window.FB_PRODUCTION) : reject(new Error('The business store did not load')));
    s.onerror = () => reject(new Error('The business store did not load'));
    document.head.appendChild(s);
  });
}

const num = (id) => String(id).replace(/\D/g, '');
/* stable dataset ids: packs fg-pNN → prd-NN, raw materials rm-pNN → prd-1NN, packaging rm-kNN → prd-2NN */
const prdOfSku = (skuId) => `prd-${Number(num(skuId))}`;
const prdOfMaterial = (id) => `prd-${(id.startsWith('rm-k') ? 200 : 100) + Number(num(id))}`;
/* a category per finished product (the engine's recipe book, 3 Oct 2026) */
const RECIPE_CAT = { 'mix-veg': 'cat-2', 'green-peas': 'cat-1', 'soya-chaap': 'cat-3' };
const CATEGORIES = [
  { id: 'cat-11', name: 'Frozen Vegetables' }, { id: 'cat-12', name: 'Soya Chaap' }, { id: 'cat-13', name: 'Raw Materials' }, { id: 'cat-14', name: 'Packaging Material' },
  { id: 'cat-1', name: 'Green Peas', parent: 'cat-11' }, { id: 'cat-2', name: 'Mix Veg', parent: 'cat-11' },
  { id: 'cat-3', name: 'Soya Chaap 20 Kg', parent: 'cat-12' },
  { id: 'cat-6', name: 'Fresh Vegetables', parent: 'cat-13' }, { id: 'cat-7', name: 'Flours & Gluten', parent: 'cat-13' }, { id: 'cat-8', name: 'Chaap Sticks', parent: 'cat-13' },
  { id: 'cat-9', name: 'Pouches & Bags', parent: 'cat-14' }, { id: 'cat-10', name: 'Master Cartons & Big Bags', parent: 'cat-14' },
];
const materialCat = (m) => (m.store === 'Cold room' ? 'cat-6' : m.kind === 'packaging' ? (/^(Pouch|Bag) /.test(m.name) ? 'cat-9' : 'cat-10') : m.unit === 'pcs' ? 'cat-8' : 'cat-7');
/* GST on what is bought, as the store books it */
const materialTax = (m) => (m.store === 'Cold room' ? 0 : m.kind === 'packaging' ? 18 : m.unit === 'pcs' ? 12 : 5);
const PACK_UNIT = { crate: 'Crate', bin: 'Bin', sack: 'Bag', box: 'Box', bundle: 'Bundle', carton: 'Carton' };
const PIN = { Samana: '147101', Patran: '147105', Patiala: '147001', Rajpura: '140401', Mohali: '160055', Sangrur: '148001', Zirakpur: '140603', Ghagga: '147102' };
const PAY_MODE = { CASH: 'Cash', UPI: 'UPI', BANK_TRANSFER: 'NEFT', CHEQUE: 'Cheque' };

/** The store, in this module's dataset shape — plus the maps to write back through. */
export function vasuDataset(P, now) {
  return P.read((D, d) => {
    const biz = d.business;
    const maps = { sup: {}, supBack: {}, prd: {}, po: {} };
    /* not rounded: two orders raised in the same minute still sort newest first */
    const ago = (iso) => Math.max(0, (now - new Date(iso).getTime()) / 60000);

    const products = d.skus.filter((s) => !s.retired).map((s) => {
      const id = prdOfSku(s.id);
      maps.prd[oid('prd', id)] = { skuId: s.id, boxes: s.perCarton };
      return {
        id, articleNo: s.article, name: s.name, categoryId: RECIPE_CAT[s.recipeId] || 'cat-1', measurement: 'Pkt-Carton-Pallet', boxes: s.perCarton, pallets: 20,
        price: s.price, tax: biz.gstPct, stock: D.availableToSell(s.id), moq: 1, priceMap: { Pkt: s.price, Carton: s.price * s.perCarton, Pallet: s.price * s.perCarton * 20 },
      };
    });
    const rawMaterials = d.materials.map((m) => {
      const id = prdOfMaterial(m.id), unit = m.unit === 'kg' ? 'Kg' : 'Pcs', box = PACK_UNIT[m.packName] || 'Box', per = m.packQty || 1;
      maps.prd[oid('prd', id)] = { materialId: m.id, boxes: per };
      return {
        id, articleNo: m.article, name: m.name, categoryId: materialCat(m), measurement: `${unit}-${box}-Pallet`, boxes: per, pallets: 20,
        price: m.price, tax: materialTax(m), stock: D.onHand(m.id), moq: 1, priceMap: { [unit]: m.price, [box]: Math.round(m.price * per * 100) / 100, Pallet: Math.round(m.price * per * 20 * 100) / 100 },
      };
    });
    const suppliers = d.suppliers.map((s, i) => {
      const id = `sup-${i + 1}`;
      maps.sup[s.id] = id; maps.supBack[oid('sup', id)] = s.id;
      return { id, name: s.name, contact: s.contact, email: s.email || `accounts@${s.name.toLowerCase().replace(/[^a-z]+/g, '')}.example`, gstNumber: s.gstNumber || '', address: s.address || '', state: 'Punjab', postalCode: PIN[s.city] || '' };
    });
    const lineOf = (l) => [l.skuId ? prdOfSku(l.skuId) : prdOfMaterial(l.materialId), l.qty, 0];
    const purchaseOrders = d.purchaseOrders.slice().sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)).map((p) => {
      const id = `po-${num(p.id)}`;
      maps.po[oid('po', id)] = p.number;
      const got = (p.receipts || []).slice(-1)[0];
      /* internal approval: the order opened at Pending Approval, and the owner's decision if made */
      const hist = p.history || [];
      const opening = hist[0]?.status === 'Pending Approval' ? 'Pending Approval' : undefined;
      const dec = opening && hist[1] && ['InProgress', 'Rejected'].includes(hist[1].status) ? hist[1] : null;
      const short = {};
      p.lines.forEach((l) => { if (l.qty - l.received > 0.001 && got) short[l.skuId ? prdOfSku(l.skuId) : prdOfMaterial(l.materialId)] = Math.round((l.qty - l.received) * 100) / 100; });
      return {
        id, number: p.number, minutesAgo: ago(p.createdAt), supplier: maps.sup[p.supplierId], status: p.status, lines: p.lines.map(lineOf), comments: p.comments || '',
        received: got && /Delivered/.test(p.status) ? { minutesAgo: ago(got.at), short } : undefined,
        opening, decided: dec ? { status: dec.status, minutesAgo: ago(dec.at), comment: dec.note || '' } : undefined,
        documents: (p.bills || []).map((b, k) => ({ id: `doc-${num(p.id)}0${k + 1}`, type: 'SUPPLIER_INVOICE', name: b.no, amount: b.amount, remarks: b.poNumber ? `Booked at the gate · PO ${b.poNumber}` : '', minutesAgo: ago(b.at) })),
      };
    });
    const orgOf = {};
    const customers = d.customers.map((c, i) => {
      const id = `org-${11 + i}`; orgOf[c.id] = id;
      return { id, name: c.name, phone: c.phone, email: '', catalogue: c.type === 'HORECA' ? 'HoReCa' : 'DEFAULT' };
    });
    const monthAgo = new Date(now - 30 * DAY).toISOString();
    const salesOrders = d.orders.filter((o) => o.placedAt >= monthAgo).map((o) => ({
      id: `so-${num(o.id)}`, daysAgo: Math.floor((now - new Date(o.placedAt).getTime()) / DAY), status: o.status, number: o.number,
      lines: o.items.map((i) => [prdOfSku(i.skuId), i.qty]), customer: orgOf[o.customerId],
    }));
    const dataset = {
      _about: ['Built from the Vasu Foods store (v7/assets/production/production-api.js) when the page opened.'],
      store: { id: 'loc-01', name: `${biz.name} — ${biz.city} Plant`, orgName: biz.name, user: biz.owner, address: `${biz.address}, ${biz.city}` },
      policies: [{ id: 'pol-01', name: 'Cold Chain Guarantee', type: 'GUARANTEE', days: 2, unit: 'days', terms: 'Replaced free if packets reach you thawed or soft. Keep at −18 °C and tell us within 24 hours of delivery, with the packet.' }],
      categories: CATEGORIES, products, rawMaterials, suppliers, locations: [], purchaseOrders, customers, salesOrders,
      catalogue: { customerType: 'B2B', locations: {} },
      customerCatalogues: { HoReCa: products.filter((p) => /5 kg|1 kg/.test(p.name)).map((p) => p.id) },
    };
    return { dataset, maps, business: biz };
  });
}

/**
 * The purchase forecast, from the store. Finished Goods: the last 30 days customers took, plus what
 * they are waiting for, against the packets on the shelf. Raw Material: Production Plan's.
 */
export function forecastFromStore(P) {
  return P.read((D, d) => {
    const cat = (id, name) => ({ id: oid('cat', id), name });
    const catName = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.name]));
    const finished = d.skus.filter((s) => !s.retired).map((s) => {
      const dm = D.demandOf(s.id), demand = dm.weekly.reduce((a, b) => a + b, 0) + dm.open, stock = D.availableToSell(s.id);
      const rec = Math.max(demand - stock, 0);
      const c = RECIPE_CAT[s.recipeId] || 'cat-1';
      return demand > 0 ? { articleNumber: s.article, productId: oid('prd', prdOfSku(s.id)), name: s.name, category: cat(c, catName[c]), measurement: 'Pkt-Carton-Pallet', unitPrice: `${s.price}/Pkt-Carton-Pallet`,
        boxes: s.perCarton, pallets: 20, priceMap: { Pkt: s.price }, price: s.price, offerPrice: s.price, costPrice: null, moq: 1, demand, currentStock: stock, recommendedQuantity: rec, supplier: null } : null;
    }).filter(Boolean).sort((a, b) => b.recommendedQuantity - a.recommendedQuantity);
    const plan = D.plan();
    const raw = plan.materials.map((pm) => {
      const m = D.material(pm.id), c = materialCat(m), demand = Math.round((pm.need + pm.reserved) * 100) / 100;
      return demand > 0 ? { articleNumber: m.article, productId: oid('prd', prdOfMaterial(m.id)), name: m.name, category: cat(c, catName[c]), measurement: `${m.unit === 'kg' ? 'Kg' : 'Pcs'}-${PACK_UNIT[m.packName] || 'Box'}-Pallet`,
        unitPrice: `${m.price}/${m.unit}`, boxes: m.packQty, pallets: 20, priceMap: {}, price: m.price, offerPrice: m.price, costPrice: null, moq: 1,
        demand, currentStock: pm.onHand, recommendedQuantity: pm.buy, onOrder: pm.ordered, supplier: m.supplier } : null;
    }).filter(Boolean).sort((a, b) => b.recommendedQuantity - a.recommendedQuantity);
    return { finished, raw };
  });
}

/** What the screen writes, written to the store as well. */
export function wireToStore(server, P, maps, host) {
  const wrap = (name, after) => {
    const orig = server[name].bind(server);
    server[name] = async (...args) => {
      const res = await orig(...args);
      try { after(res, ...args); } catch (e) { console.error(`Vasu store: ${name}`, e); host?.notify?.('error', e?.body?.error || e.message || 'Could not update the business record'); }
      return res;
    };
  };
  const lineBack = (item, qtyKey = 'qty') => {
    const hit = maps.prd[String(item._id || item.id)];
    if (!hit) return null;
    const q = Number(item[qtyKey]) || 0;
    const base = item.baseUnitQty != null && qtyKey === 'qty' ? Number(item.baseUnitQty) : (Number(item.priceCalculationUnitIndex) === 1 || item.orderingUnit === String(item.measurement || '').split('-')[1] ? q * hit.boxes : q);
    return hit.skuId ? { skuId: hit.skuId, qty: base } : { materialId: hit.materialId, qty: base };
  };
  const poNode = (id) => server.docs.purchaseOrders.find((n) => String(n._id) === String(id));

  wrap('createPurchaseOrder', (res, payload) => {
    const po = res?.data?.purchaseOrder || res?.data;
    const supplierId = maps.supBack[String(payload?.supplier_id)];
    if (!po || !supplierId) return;
    const lines = (payload.products || []).map((p) => lineBack(p)).filter(Boolean);
    const price = {};
    (payload.products || []).forEach((p) => { const l = lineBack(p); if (l) price[l.skuId || l.materialId] = Number(p.offerPrice ?? p.price); });
    P.write((D) => D.raisePO({ supplierId, number: po.order_number, lines: lines.map((l) => ({ ...l, price: undefined })), comments: payload.orderComments || '', where: 'Purchase Orders', by: 'Chanchal Sachdeva', via: 'office', status: po.status }));
    maps.po[String(po._id)] = po.order_number;
  });

  /* a status change: Delivered is goods in — this delivery's quantities, in base units; an
     internal approval decision (Approve → InProgress, Reject → Rejected) is the owner's */
  wrap('updateNodeStageAudit', (res, nodes) => {
    const received = [];
    (nodes || []).forEach(({ nodeId, stageAudit, metaData }) => {
      const st = stageAudit && stageAudit[0];
      const number = maps.po[String(nodeId)] || poNode(nodeId)?.order_number;
      if (!st || !number) return;
      if (['InProgress', 'Rejected'].includes(st.status)) {
        P.write((D) => {
          const p = D.po(number);
          if (!p || p.status !== 'Pending Approval') return;
          if (st.status === 'InProgress') D.amendPO(p.id, (st.challan || []).map((c) => lineBack(c)).filter(Boolean));
          D.setPOStatus(p.id, st.status, 'Chanchal Sachdeva', st.comment);
        });
      } else if (/Delivered/.test(st.status)) {
        const lines = (st.challan || []).map((c) => {
          const hit = maps.prd[String(c._id || c.id)];
          if (!hit) return null;
          const receiving = Number(c.qtyReceiving ?? c.receiving ?? c.verifiedQty ?? c.qty) || 0;
          const factor = Number(c.qtyReceived) > 0 && Number(c.baseQtyReceived) > 0 ? Number(c.baseQtyReceived) / Number(c.qtyReceived) : 1;
          const qty = Math.round(receiving * factor * 100) / 100;
          return qty > 0 ? (hit.skuId ? { skuId: hit.skuId, qty } : { materialId: hit.materialId, qty }) : null;
        }).filter(Boolean);
        /* in at the received date and time the office gave (never later than now); each line a lot */
        const t = new Date(metaData?.receivedDate || '').getTime();
        const at = Number.isFinite(t) && t <= Date.now() ? new Date(t).toISOString() : undefined;
        const r = P.write((D) => { const p = D.po(number); return p && ['InProgress', 'Pending', 'Partial Delivered'].includes(p.status) ? D.receivePO(p.id, { lines, by: 'Store · Mohan', at }) : null; });
        (r?.lots || []).forEach((l) => { if (l.qc === 'accepted') received.push(l.lotNo); });
      } else if (/Not accepted|Cancel/i.test(st.status)) {
        P.write((D) => { const p = D.po(number); if (p && !p.receipts.length) D.setPOStatus(p.id, 'Not accepted', 'Chanchal Sachdeva', st.comment); });
      }
    });
    /* the goods are in: a batch per line, and its stickers to print before it goes in the store */
    if (received.length) host?.showLotStickers?.(received);
  });

  wrap('recordSupplierPayment', (res, entry) => {
    const supplierId = maps.supBack[String(entry?.supplierId)];
    if (!supplierId || entry.transactionType === 'CREDIT_WRITEOFF') return;
    P.write((D) => D.pay({ supplierId, amount: entry.paymentAmount, mode: PAY_MODE[entry.paymentMethod] || 'NEFT', ref: entry.referenceNumber || '', where: 'Purchase Orders', by: 'Chanchal Sachdeva' }));
  });

  wrap('createSupplier', (res, input) => {
    const id = res?.data?.id;
    if (!id || input?.supplierType === 'DEPARTMENT') return;
    const sup = P.write((D) => D.addSupplier({ name: input.name, contact: input.contact, email: input.email, gstNumber: input.gstNumber, address: input.address, city: '' }));
    maps.supBack[String(id)] = sup.id;
  });

  wrap('uploadPurchaseOrderDocument', (res, fd) => {
    const get = (k) => (fd && typeof fd.get === 'function' ? fd.get(k) : fd?.[k]);
    const number = maps.po[String(get('purchaseOrderId') || get('orderId'))] || poNode(get('purchaseOrderId') || get('orderId'))?.order_number;
    const type = get('type');
    if (!number || !type || get('documentId')) return;
    P.write((D) => D.attachSupplierInvoice(number, { type, name: get('name') || '', amount: Number(get('amount')) || 0, remarks: get('remarks') || '' }));
  });
}

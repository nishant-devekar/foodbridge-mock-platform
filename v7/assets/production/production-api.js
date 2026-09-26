/* ==========================================================================
   PRODUCTION — one store for every Production screen (26 Sep 2026).

   Owner's call (UX proposal "JobFlow in Production"): one batch, one roster,
   one record. Before this, Batch Management, Configure Recipe, JobFlow and
   the inventories each kept their own copy of the factory. Now they read and
   write this one:

     recipes · recipeHeaders · packagingLines · operators · hostProducts ·
     batches           the shape Batch Management renders (its seed.json
                       shape, so its screens need no rewrite)
     book              per recipe: line, ingredients, making cost, packs,
                       process — what Configure Recipe shows
     materials · lots  raw material and every sack / crate received
     bags              the 30 / 35 kg bags in the freezer (Freezer Stock)
     fg                packets in cartons (Finished Goods)
     demand            open orders and weekly sales per pack (Production Plan)
     workers · workflows · shifts · tasks
                       the shop floor (JobFlow)

   Business: the owner's reference — frozen green peas, mixed vegetables and
   soya chaap. Two lines: peas + vegetables (peel · cut · wash → blanch →
   freeze → fill bags) and soya chaap (weigh out → dough → cut → stick →
   boil · cool · chill → fill bags). Packets are packed later, from the
   oldest bags, when orders need them.

   Every step on the floor records who, how much and when, into the
   production log (fb.v7.production.log). It is NOT fb.v7.events: the
   Control Tower reads that stream and is left exactly as it was (owner,
   26 Sep 2026).

   The seed is not typed in: it is a month of work RUN through the same
   operations the screens use, on a clock set back in time — so every lot,
   bag and packet adds up the way live use will. Dated from today; a new day
   starts a new demo month.

   Loads in the browser (window.FB_PRODUCTION, window.JobFlowAPI) and in
   Node (module.exports) for tests and the pixel harness.
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.FB_PRODUCTION = api.browser(); root.JobFlowAPI = api; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var STORE_KEY = "fb.v7.production";
  var LOG_KEY = "fb.v7.production.log";
  var VERSION = 4;
  var MIN = 60000, HOUR = 3600000, DAY = 86400000;

  /* ── Catalogue: the reference business ─────────────────────────────── */
  var MATERIALS = [
    // id, name, article, unit, stock unit, store, price ₹ per unit, reorder at, supplier,
    // and what one sticker goes on: that many units to a sack / crate / box
    ["rm-p01", "Green Peas (shelled)", "RM-3001", "kg", "Kg-Crate-Pallet", "Cold room", 42, 400, "Azadpur Mandi · Gupta & Sons", 20, "crate"],
    ["rm-p02", "Carrot", "RM-3002", "kg", "Kg-Crate-Pallet", "Cold room", 28, 200, "Ramesh Farms, Sonipat", 25, "crate"],
    ["rm-p03", "Cauliflower", "RM-3003", "kg", "Kg-Crate-Pallet", "Cold room", 22, 120, "Ramesh Farms, Sonipat", 20, "crate"],
    ["rm-p04", "French Beans", "RM-3004", "kg", "Kg-Crate-Pallet", "Cold room", 40, 120, "Azadpur Mandi · Gupta & Sons", 20, "crate"],
    ["rm-p05", "Soya Flour", "RM-3005", "kg", "Kg-Bag-Pallet", "Dry store", 62, 150, "Shree Balaji Traders", 50, "sack"],
    ["rm-p06", "Wheat Flour (Maida)", "RM-3006", "kg", "Kg-Bag-Pallet", "Dry store", 34, 150, "Shree Balaji Traders", 50, "sack"],
    ["rm-p07", "Wooden Sticks", "RM-3007", "pcs", "Pcs-Box-Pallet", "Dry store", 0.35, 3000, "Kanpur Wood Crafts", 1000, "box"],
    ["rm-p08", "Big Bags 30 kg", "RM-3008", "pcs", "Pcs-Box-Pallet", "Dry store", 18, 40, "Delhi Poly Packers", 50, "bundle"],
    ["rm-p09", "Big Bags 35 kg", "RM-3009", "pcs", "Pcs-Box-Pallet", "Dry store", 20, 30, "Delhi Poly Packers", 50, "bundle"],
  ];
  var SUPPLIERS = [
    { name: "Azadpur Mandi · Gupta & Sons", contact: "5550402001" },
    { name: "Ramesh Farms, Sonipat", contact: "5550402002" },
    { name: "Shree Balaji Traders", contact: "5550402003" },
    { name: "Kanpur Wood Crafts", contact: "5550402004" },
    { name: "Delhi Poly Packers", contact: "5550402005" },
  ];
  /* Packs: id, recipe, name, grams, per carton, price ₹ per packet. */
  var SKUS = [
    ["fg-p01", "frozen-peas", "Frozen Green Peas 200 g", 200, 50, 30],
    ["fg-p02", "frozen-peas", "Frozen Green Peas 500 g", 500, 24, 70],
    ["fg-p03", "frozen-peas", "Frozen Green Peas 1 kg", 1000, 12, 135],
    ["fg-p04", "frozen-peas", "Frozen Green Peas 5 kg", 5000, 2, 640],
    ["fg-p05", "mixed-veg", "Mixed Vegetables 500 g", 500, 24, 80],
    ["fg-p06", "mixed-veg", "Mixed Vegetables 1 kg", 1000, 12, 150],
    ["fg-p07", "soya-chaap", "Soya Chaap 250 g", 250, 40, 60],
    ["fg-p08", "soya-chaap", "Soya Chaap 500 g", 500, 20, 110],
    ["fg-p09", "soya-chaap", "Soya Chaap 1 kg", 1000, 10, 210],
    ["fg-p10", "soya-chaap", "Soya Chaap 5 kg (no stick)", 5000, 2, 980],
  ];
  /* Recipes: ingredients are per the base batch (kg out). A material with
     no rmId (water) is used but not stocked. */
  var RECIPES = [
    {
      id: "frozen-peas", name: "Frozen Green Peas", line: "Peas + vegetables", version: "fp-v1", label: "V1", sizes: [100, 200, 300], base: 100,
      bestBeforeDays: 365, bagKg: 30, emoji: "🫛",
      ingredients: [["rm-p01", "Green Peas (shelled)", "Azadpur Mandi", 111, "kg", 90]],
      making: [["Labour", 400], ["Electricity · blanch + blast freeze", 350], ["Big bags", 72]],
      strategy: { "fg-p01": 20, "fg-p02": 40, "fg-p03": 30, "fg-p04": 10 },
    },
    {
      id: "mixed-veg", name: "Mixed Vegetables", line: "Peas + vegetables", version: "mv-v1", label: "V1", sizes: [100, 120, 150], base: 100,
      bestBeforeDays: 300, bagKg: 30, emoji: "🥕",
      ingredients: [["rm-p02", "Carrot", "Ramesh Farms", 45, "kg", 89], ["rm-p03", "Cauliflower", "Ramesh Farms", 25, "kg", 80], ["rm-p01", "Green Peas (shelled)", "Azadpur Mandi", 22, "kg", 91], ["rm-p04", "French Beans", "Azadpur Mandi", 22, "kg", 91]],
      making: [["Labour", 520], ["Electricity · blanch + blast freeze", 350], ["Big bags", 72]],
      strategy: { "fg-p05": 60, "fg-p06": 40 },
    },
    {
      id: "soya-chaap", name: "Soya Chaap", line: "Soya chaap", version: "sc-v1", label: "V1", sizes: [50, 100, 150], base: 100,
      bestBeforeDays: 180, bagKg: 35, emoji: "🍢",
      ingredients: [["rm-p05", "Soya Flour", "Shree Balaji", 28, "kg", 99], ["rm-p06", "Wheat Flour (Maida)", "Shree Balaji", 28, "kg", 99], [null, "Water", "Tap · RO", 46, "litre", 98], ["rm-p07", "Wooden Sticks", "Kanpur Wood", 1600, "pcs", 100]],
      making: [["Labour", 600], ["Gas · boiling", 260], ["Electricity · chilling", 180], ["Big bags", 60]],
      strategy: { "fg-p07": 40, "fg-p08": 30, "fg-p09": 20, "fg-p10": 10 },
    },
  ];
  /* Process steps per line: name, role, minutes, flags.
       weigh    records kg in and kg out; loss is kg in − kg out
       takes    raw materials it takes from the store, oldest lot first
       loss     loss allowed, % of kg in
       sticks   records sticks used (pcs) and takes them from the store
       bags     fills big bags of this many kg — puts them in the freezer
       pack     packs packets from the oldest bags
       cartons  packets into cartons, into the freezer (Finished Goods) */
  var PROCESS = {
    "frozen-peas": [
      ["Peel · cut · wash", "washer", 40, { weigh: true, takes: ["rm-p01"], loss: 10, instructions: "Weigh the crates before you start and the washed peas after. Take the oldest crates in the cold room first." }],
      ["Boil (blanch)", "blancher", 20, { instructions: "90 °C for 90 seconds, then straight into chilled water." }],
      ["Freeze", "blancher", 45, { instructions: "Spread thin on the blast-freezer trays. −30 °C until free-flowing." }],
      ["Fill big bags · into freezer", "packer", 30, { bags: 30, instructions: "30 kg to a bag. Write the batch number, date made and use-by on every bag." }],
    ],
    "mixed-veg": [
      ["Peel · cut · wash", "washer", 60, { weigh: true, takes: ["rm-p02", "rm-p03", "rm-p01", "rm-p04"], loss: 10, instructions: "Weigh all the vegetables before, and the cut and washed mix after. Oldest crates first." }],
      ["Boil (blanch)", "blancher", 25, { instructions: "Carrot and beans 2 minutes, cauliflower 3, peas 90 seconds. Chill at once." }],
      ["Freeze", "blancher", 45, { instructions: "Mix by the recipe ratio on the trays: carrot 40 · cauli 20 · peas 20 · beans 20." }],
      ["Fill big bags · into freezer", "packer", 30, { bags: 30, instructions: "30 kg to a bag. Batch number, date made and use-by on every bag." }],
    ],
    "soya-chaap": [
      ["Weigh out flour + water", "dough maker", 20, { weigh: true, takes: ["rm-p05", "rm-p06"], loss: 2, instructions: "Take flour from the oldest sack first. Weigh flour + water in, dough out." }],
      ["Make dough · rest", "dough maker", 60, { instructions: "Knead 15 minutes, rest 45 under a damp cloth." }],
      ["Cut pieces · flatten", "dough maker", 45, { instructions: "50 g pieces, pressed flat." }],
      ["Put on stick / no stick", "dough maker", 40, { sticks: true, instructions: "One stick a piece. The 5 kg catering pack goes without sticks." }],
      ["Boil · cool · chill", "blancher", 60, { weigh: true, loss: 3, instructions: "Boil 20 minutes, cool, chill to 4 °C. Weigh before boiling and after chilling." }],
      ["Fill big bags · into freezer", "packer", 30, { bags: 35, instructions: "35 kg to a bag. Batch number, date made and use-by on every bag." }],
    ],
    packing: [
      ["Pack small packets", "packer", 60, { pack: true, instructions: "Oldest bags first. Seal and date every packet." }],
      ["Packets into cartons · into freezer", "packer", 20, { cartons: true, instructions: "Full cartons only. Carton label: pack, count, batch." }],
    ],
  };
  var WORKERS = [
    ["asha", "Asha", "washer", "1111", "5550510001", true],
    ["ravi", "Ravi", "dough maker", "2222", "5550510002", true],
    ["meena", "Meena", "packer", "3333", "5550510003", true],
    ["suresh", "Suresh", "washer", "4444", "5550510004", false],
    ["farida", "Farida", "blancher", "5555", "5550510005", true],
    ["kiran", "Kiran", "packer", "6666", "5550510006", false],
  ];
  var FACTORY_ROLES = ["washer", "blancher", "dough maker", "packer"];
  var SUPERVISORS = [
    { id: "op-dharmendar", name: "Dharmendar Ji", contact: "9812345678" },
    { id: "op-priya", name: "Priya Sharma", contact: "9800011122" },
    { id: "op-suresh", name: "Suresh Kumar", contact: "9876543210" },
  ];
  /* Weekly packets sold, last four weeks (oldest first), open orders now. */
  var DEMAND = {
    "fg-p01": [260, 240, 280, 300, 180], "fg-p02": [180, 200, 190, 220, 140], "fg-p03": [90, 110, 100, 120, 70], "fg-p04": [8, 10, 6, 12, 6],
    "fg-p05": [120, 140, 150, 160, 110], "fg-p06": [60, 70, 65, 80, 40],
    "fg-p07": [150, 170, 180, 190, 130], "fg-p08": [80, 90, 100, 95, 60], "fg-p09": [40, 45, 50, 55, 30], "fg-p10": [6, 8, 8, 10, 6],
  };

  /* ── small helpers ─────────────────────────────────────────────────── */
  function pad(n, w) { return String(n).padStart(w || 2, "0"); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function r1(n) { return Math.round(n * 10) / 10; }
  function dayKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function isoDay(t) { return dayKey(new Date(t)); }
  function at(base, dayOffset, h, m) { return new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, h, m || 0, 0, 0); }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function find(list, id) { for (var i = 0; i < (list || []).length; i++) if (list[i]._id === id || list[i].id === id) return list[i]; return null; }
  function byOrder(a, b) { return a.order - b.order; }
  function strip(o) { var c = clone(o); delete c._seq; return c; }
  function newId(db) { db.seq += 1; return "6650" + db.seq.toString(16).padStart(20, "0"); }
  function titleCase(s) { return String(s || "").replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function kgOf(sku) { return sku.grams / 1000; }

  function ApiError(status, error) { this.status = status; this.body = { error: error }; }
  function invalid(msg) { return new ApiError(400, msg || "Validation failed"); }

  /* ── The domain: every rule the screens share ──────────────────────── */
  function Domain(db, clock, log) {
    var now = function () { return clock(); };
    var iso = function () { return now().toISOString(); };
    var D = {};

    D.material = function (id) { return find(db.materials, id); };
    D.sku = function (id) { return find(db.skus, id); };
    D.book = function (recipeId) { return db.book[recipeId]; };
    D.batch = function (id) { return find(db.batches, id); };
    D.worker = function (id) { return find(db.workers, id); };
    D.emit = function (type, o) {
      var ev = Object.assign({ at: iso(), type: type, where: "Worker app", how: "worker" }, o || {});
      log(ev);
      return ev;
    };

    /* raw material */
    D.lotsFIFO = function (materialId) {
      return db.lots.filter(function (l) { return l.materialId === materialId && l.qc === "accepted" && l.remaining > 0.0001; })
        .sort(function (a, b) { return a.receivedAt < b.receivedAt ? -1 : a.receivedAt > b.receivedAt ? 1 : a._seq - b._seq; });
    };
    D.onHand = function (materialId) { return r2(D.lotsFIFO(materialId).reduce(function (s, l) { return s + l.remaining; }, 0)); };
    /* Take from the oldest lot first. Throws when the store cannot cover it. */
    D.take = function (materialId, qty, forBatch, who) {
      var m = D.material(materialId);
      qty = r2(qty);
      if (qty <= 0) return [];
      var have = D.onHand(materialId);
      if (have + 0.0001 < qty) throw new ApiError(409, "Only " + have + " " + m.unit + " of " + m.name + " in the store");
      var out = [], left = qty;
      D.lotsFIFO(materialId).forEach(function (l) {
        if (left <= 0.0001) return;
        var t = r2(Math.min(l.remaining, left));
        l.remaining = r2(l.remaining - t); left = r2(left - t);
        out.push({ lotNo: l.lotNo, materialId: materialId, name: m.name, qty: t, unit: m.unit });
      });
      if (forBatch) D.issue(forBatch, m, qty, out, who);
      return out;
    };
    /* Batch Management's Ingredients tab: the floor's take is an issue. */
    D.issue = function (b, m, qty, lots, who) {
      b.ingredientSummary = b.ingredientSummary || [];
      var row = b.ingredientSummary.filter(function (r) { return r.ingredientId === m.id; })[0];
      if (!row) { row = { ingredientId: m.id, ingredientName: m.name, uom: m.unit, recommendedQty: 0, issuedQty: 0, returnedQty: 0, netConsumed: 0, remainingRecommended: 0, variance: 0, recipeIngredient: false }; b.ingredientSummary.push(row); }
      row.issuedQty = r2(row.issuedQty + qty);
      row.netConsumed = r2(row.issuedQty - row.returnedQty);
      row.remainingRecommended = r2(Math.max(0, row.recommendedQty - row.netConsumed));
      row.variance = r2(row.netConsumed - row.recommendedQty);
      b.ingredientTransactions = b.ingredientTransactions || [];
      b.ingredientTransactions.push({ ingredientId: m.id, ingredientName: m.name, transactionType: "issue", quantity: qty, uom: m.unit, warehouseId: m.store,
        remarks: "From the floor · lot " + lots.map(function (l) { return l.lotNo; }).join(", "), timestamp: iso(), actor: who || "floor" });
    };
    /* What planned and running batches still need from the store. */
    D.reserved = function (materialId) {
      var n = 0;
      db.batches.forEach(function (b) {
        if (b.kind !== "production" || ["planned", "in-progress", "on-hold"].indexOf(b.stateId) === -1) return;
        (b.ingredientSummary || []).forEach(function (r) { if (r.ingredientId === materialId) n += Math.max(0, r.recommendedQty - r.netConsumed); });
      });
      return r2(n);
    };
    D.ordered = function (materialId) { return r2(db.ordered[materialId] || 0); };
    D.receive = function (o) {
      var m = D.material(o.materialId);
      if (!m) throw invalid("Unknown material");
      var kg = r2(Number(o.qty));
      if (!(kg > 0)) throw invalid("Enter what was accepted");
      db.lotSeq += 1;
      var lot = {
        id: "lot-" + db.lotSeq, _seq: ++db.seq, lotNo: m.article.replace("RM-", "L") + "-" + pad(db.lotSeq, 4), materialId: m.id,
        receivedAt: o.at || iso(), supplier: o.supplier || m.supplier, gateQty: r2(Number(o.gateQty) || kg), qty: kg, remaining: o.qc === "returned" ? 0 : kg,
        store: m.store, qc: o.qc || "accepted", note: o.note || "", price: o.price != null ? Number(o.price) : m.price,
        useBy: new Date(new Date(o.at || iso()).getTime() + (m.unit === "kg" && m.store === "Cold room" ? 10 : 240) * DAY).toISOString(),
        by: o.by || "Store", packs: Math.max(1, Math.ceil(kg / (m.packQty || kg))), packName: m.packName || "sack",
      };
      db.lots.push(lot);
      if (lot.qc === "accepted") db.ordered[m.id] = Math.max(0, r2(D.ordered(m.id) - kg));
      D.emit(lot.qc === "accepted" ? "production.lot.received" : "production.lot.returned",
        { where: "Receive stock", how: "store", by: lot.by, data: { lotNo: lot.lotNo, material: m.name, gate: lot.gateQty, accepted: lot.qc === "accepted" ? kg : 0, unit: m.unit, stickers: lot.qc === "accepted" ? lot.packs : 0 } });
      return lot;
    };
    /* One sticker per sack, crate or box of a lot. */
    D.stickers = function (lotNo) {
      var l = db.lots.filter(function (x) { return x.lotNo === lotNo; })[0];
      if (!l) throw new ApiError(404, "No such lot");
      if (l.qc !== "accepted") return [];
      var m = D.material(l.materialId), per = m.packQty || l.qty, n = l.packs || Math.max(1, Math.ceil(l.qty / per)), out = [];
      for (var i = 0; i < n; i++) {
        var q = i < n - 1 ? per : r2(l.qty - per * (n - 1));
        out.push({ lotNo: l.lotNo, n: i + 1, of: n, packName: l.packName || m.packName || "sack", qty: q, unit: m.unit, material: m.name, article: m.article,
          supplier: l.supplier, receivedAt: l.receivedAt, useBy: l.useBy, store: l.store, by: l.by || "Store" });
      }
      return out;
    };

    /* freezer */
    D.bagsFIFO = function (recipeId) {
      return db.bags.filter(function (g) { return g.recipeId === recipeId && g.remaining > 0.0001; })
        .sort(function (a, b) { return a.madeAt < b.madeAt ? -1 : a.madeAt > b.madeAt ? 1 : a.bagNo < b.bagNo ? -1 : 1; });
    };
    D.inFreezer = function (recipeId) { return r2(D.bagsFIFO(recipeId).reduce(function (s, g) { return s + g.remaining; }, 0)); };
    D.fillBags = function (b, kg, bagKg) {
      var made = [], left = r2(kg), n = 0, useBy = new Date(now().getTime() + D.book(b.recipeId).bestBeforeDays * DAY).toISOString();
      while (left > 0.0001) {
        n += 1;
        var k = r2(Math.min(bagKg, left)); left = r2(left - k);
        var g = { id: "bag-" + b.batchNumber + "-" + n, bagNo: b.batchNumber.replace("PB-2026-", "") + "/" + n, batchId: b.id, batchNumber: b.batchNumber,
          recipeId: b.recipeId, product: b.displayName, kg: k, remaining: k, madeAt: iso(), useBy: useBy, _seq: ++db.seq };
        db.bags.push(g); made.push(g);
      }
      var bagMat = bagKg === 35 ? "rm-p09" : "rm-p08";
      try { D.take(bagMat, made.length, b); } catch (e) { /* bags short: the floor still bags */ }
      return made;
    };
    D.takeBags = function (recipeId, kg) {
      kg = r2(kg);
      var have = D.inFreezer(recipeId);
      if (have + 0.0001 < kg) throw new ApiError(409, "Only " + have + " kg of " + D.book(recipeId).name + " in the freezer");
      var out = [], left = kg;
      D.bagsFIFO(recipeId).forEach(function (g) {
        if (left <= 0.0001) return;
        var t = r2(Math.min(g.remaining, left));
        g.remaining = r2(g.remaining - t); left = r2(left - t);
        out.push({ bagNo: g.bagNo, batchNumber: g.batchNumber, kg: t, madeAt: g.madeAt, useBy: g.useBy });
      });
      return out;
    };

    /* finished goods */
    D.addPackets = function (skuId, qty, from, madeAt, useBy) {
      var s = db.fg[skuId] || (db.fg[skuId] = { lots: [] });
      s.lots.push({ ref: from, qty: qty, remaining: qty, madeAt: madeAt, useBy: useBy, at: iso() });
    };
    D.packetsOf = function (skuId) { return (db.fg[skuId] ? db.fg[skuId].lots : []).reduce(function (s, l) { return s + l.remaining; }, 0); };
    D.sell = function (skuId, qty) {
      var left = qty;
      ((db.fg[skuId] || {}).lots || []).slice().sort(function (a, b) { return a.madeAt < b.madeAt ? -1 : 1; }).forEach(function (l) {
        var t = Math.min(l.remaining, left); l.remaining -= t; left -= t;
      });
      return qty - left;
    };

    /* batches */
    var LABEL = { planned: "Planned", "in-progress": "In Progress", "on-hold": "On Hold", completed: "Completed", closed: "Closed", rejected: "Rejected" };
    var TRIGGER = { start: "Start", hold: "Hold", resume: "Resume", complete: "Complete", close: "Close", reject: "Reject" };
    D.LABEL = LABEL;
    D.move = function (b, to, trigger, actor, comment) {
      b.statusHistory = b.statusHistory || [];
      b.statusHistory.push({ fromStatusLabel: LABEL[b.stateId], toStatusLabel: LABEL[to], triggerLabel: TRIGGER[trigger] || trigger, timestamp: iso(), actor: actor || "admin", comment: comment || undefined });
      b.stateId = to; b.statusLabel = LABEL[to];
      D.emit("production.batch." + to, { by: actor, data: { batch: b.batchNumber, product: b.displayName } });
    };
    D.nextNumber = function (prefix) {
      var n = db.batches.filter(function (b) { return b.batchNumber.indexOf(prefix) === 0; })
        .reduce(function (m, b) { return Math.max(m, parseInt(b.batchNumber.slice(prefix.length), 10) || 0); }, prefix === "PB-2026-" ? 185 : 30);
      return prefix + pad(n + 1, 5);
    };
    function batchShell(o) {
      return Object.assign({
        batchUnit: "kg", statusHistory: [{ toStatusLabel: "Planned", triggerLabel: "Create", timestamp: iso(), actor: o.actor || "admin" }],
        dateEditHistory: [], operatorHandoverHistory: [], ingredientTransactions: [], ingredientSummary: [], inventorySync: null, packagingLines: [],
        stateId: "planned", statusLabel: "Planned", _seq: ++db.seq,
      }, o);
    }
    /* Recipes → Production order: one batch in kg; the packs it is split
       into are packed later, from the freezer, as packing orders. */
    D.createProductionOrder = function (o) {
      var bk = D.book(o.recipeId);
      if (!bk) throw invalid("Unknown recipe");
      var size = r2(Number(o.batchSize));
      if (!(size > 0)) throw invalid("Enter a batch size");
      var no = D.nextNumber("PB-2026-");
      var planned = o.plannedDate || isoDay(now());
      var b = batchShell({
        id: no.toLowerCase(), batchNumber: no, kind: "production", recipeId: bk.id, line: bk.line, recipeVersionId: bk.version, displayName: bk.name,
        batchSize: size, plannedDate: planned, expectedFinishDate: o.expectedFinishDate || planned, operator: o.supervisor || SUPERVISORS[0].name,
        semiFinishedKg: size, actor: o.actor,
      });
      b.ingredientSummary = bk.ingredients.filter(function (i) { return i.rmId; }).map(function (i) {
        var q = r2(i.qty * size / bk.base);
        return { ingredientId: i.rmId, ingredientName: i.name, uom: i.unit, recommendedQty: q, issuedQty: 0, returnedQty: 0, netConsumed: 0, remainingRecommended: q, variance: -q, recipeIngredient: true };
      });
      b.packagingLines = (o.packs || []).filter(function (p) { return p.qty > 0; }).map(function (p) {
        var s = D.sku(p.skuId); var w = r2(p.qty * kgOf(s));
        return { packagingConfigId: s.id, productRef: s.id, name: s.name, plannedUnits: p.qty, weightKg: w, ratioPct: r2(w / size * 100) };
      });
      db.batches.push(b);
      D.emit("production.batch.planned", { where: o.where || "Recipes", how: "office", by: o.actor || "admin", data: { batch: no, product: bk.name, kg: size } });
      var packs = [];
      if (o.packNow) (o.packs || []).forEach(function (p) { if (p.qty > 0) packs.push(D.createPackingOrder({ skuId: p.skuId, qty: p.qty, from: no, plannedDate: planned, supervisor: b.operator, actor: o.actor })); });
      return { batch: b, packing: packs };
    };
    D.createPackingOrder = function (o) {
      var s = D.sku(o.skuId);
      if (!s) throw invalid("Unknown pack");
      var qty = Math.round(Number(o.qty));
      if (!(qty > 0)) throw invalid("Enter how many packets");
      var bk = D.book(s.recipeId), no = D.nextNumber("PK-2026-");
      var planned = o.plannedDate || isoDay(now());
      var kg = r2(qty * kgOf(s));
      var b = batchShell({
        id: no.toLowerCase(), batchNumber: no, kind: "packing", recipeId: bk.id, line: "Packing", recipeVersionId: bk.version, displayName: "Packing · " + s.name,
        batchSize: kg, plannedDate: planned, expectedFinishDate: planned, operator: o.supervisor || SUPERVISORS[1].name, semiFinishedKg: 0, skuId: s.id, packets: qty,
        sourceBatch: o.from || null, actor: o.actor,
      });
      b.packagingLines = [{ packagingConfigId: s.id, productRef: s.id, name: s.name, plannedUnits: qty, weightKg: kg, ratioPct: 100 }];
      db.batches.push(b);
      return b;
    };

    /* ── the floor ───────────────────────────────────────────────────── */
    D.workflowFor = function (b) {
      return db.workflows.filter(function (w) { return b.kind === "packing" ? w.kind === "packing" : w.recipeId === b.recipeId; })[0] || null;
    };
    D.generateTasks = function (shift) {
      var created = 0;
      shift.batches.forEach(function (batchId) {
        if (db.tasks.some(function (t) { return t.shift === shift._id && t.batch === batchId; })) return;
        var b = D.batch(batchId), wf = b && D.workflowFor(b);
        if (!b || !wf || ["completed", "closed", "rejected"].indexOf(b.stateId) !== -1) return;
        var steps = wf.steps.slice().sort(byOrder);
        var first = steps.length ? steps[0].order : null;
        /* a batch already part-done on an earlier shift picks up where it was */
        var doneOrders = db.tasks.filter(function (t) { return t.batch === batchId && t.status === "done"; }).map(function (t) { return t.stepOrder; });
        var next = steps.filter(function (s) { return doneOrders.indexOf(s.order) === -1; })[0];
        steps.forEach(function (step) {
          if (doneOrders.indexOf(step.order) !== -1) return;
          db.tasks.push({
            _id: newId(db), batch: b.id, shift: shift._id, stepOrder: step.order, stepName: step.name, role: step.role,
            expectedMinutes: step.expectedMinutes, instructions: step.instructions, unlocksNext: step.unlocksNext,
            weigh: !!step.weigh, takes: step.takes || [], loss: step.loss == null ? null : step.loss, sticks: !!step.sticks, bags: step.bags || null,
            pack: !!step.pack, cartons: !!step.cartons,
            assignedTo: null, status: next && step.order === next.order ? "available" : "locked",
            availableAt: next && step.order === next.order ? iso() : null,
            createdAt: iso(), updatedAt: iso(), __v: 0, _seq: ++db.seq,
          });
          created += 1;
        });
        if (first == null) return;
      });
      return created;
    };
    D.claim = function (task, worker) {
      var b = D.batch(task.batch);
      if (task.status !== "available") throw new ApiError(409, "Task is not available to claim");
      if (b && b.stateId === "on-hold") throw new ApiError(409, "This batch is on hold. Ask your supervisor.");
      if (b && b.stateId === "rejected") throw new ApiError(409, "This batch was rejected");
      if (db.tasks.some(function (x) { return x.assignedTo === worker._id && x.status === "in_progress"; })) throw new ApiError(409, "Finish your current task before starting another");
      task.assignedTo = worker._id; task.assignedName = worker.name; task.status = "in_progress"; task.startedAt = iso(); task.updatedAt = iso();
      if (b && b.stateId === "planned") D.move(b, "in-progress", "start", worker.name, "Started on the floor: " + task.stepName);
      D.emit("production.step.started", { by: worker.name, data: { batch: b ? b.batchNumber : null, step: task.stepName, taskId: task._id } });
    };
    /* Finishing a step: what it records depends on the step (see PROCESS). */
    D.complete = function (task, worker, input) {
      input = input || {};
      if (task.status !== "in_progress") throw new ApiError(409, "Only an in-progress task can be completed");
      if (task.assignedTo !== worker._id) throw new ApiError(403, "You can only complete your own task");
      var b = D.batch(task.batch), bk = b ? D.book(b.recipeId) : null;
      var rec = {};
      var num = function (v) { var n = Number(v); return isFinite(n) ? n : NaN; };
      if (task.weigh) {
        var kin = num(input.kgIn), kout = num(input.kgOut);
        if (!(kin > 0) || !(kout > 0)) throw invalid("Enter the weight before and after");
        if (kout > kin) throw invalid("The weight after can't be more than before");
        rec.kgIn = r2(kin); rec.kgOut = r2(kout); rec.lossPct = r1((kin - kout) / kin * 100);
        if (task.takes && task.takes.length && b) {
          /* split what went in by the recipe's ratio, take each from its oldest lot */
          var ings = bk.ingredients.filter(function (i) { return task.takes.indexOf(i.rmId) !== -1; });
          var stocked = bk.ingredients.filter(function (i) { return i.unit === "kg" || i.unit === "litre"; });
          var total = stocked.reduce(function (s, i) { return s + i.qty; }, 0);
          rec.lots = [];
          ings.forEach(function (i) { rec.lots = rec.lots.concat(D.take(i.rmId, r2(kin * i.qty / total), b, worker.name)); });
        }
      }
      if (task.sticks) {
        var n = Math.round(num(input.sticks));
        if (!(n >= 0)) throw invalid("Enter how many sticks were used");
        rec.sticksUsed = n;
        if (n > 0) rec.lots = D.take("rm-p07", n, b, worker.name);
      }
      if (task.bags) {
        var kb = num(input.kgOut);
        if (!(kb > 0)) throw invalid("Enter the kg that went into bags");
        rec.kgOut = r2(kb);
        rec.bagsMade = D.fillBags(b, kb, task.bags).map(function (g) { return { bagNo: g.bagNo, kg: g.kg }; });
      }
      if (task.pack) {
        var s = D.sku(b.skuId), p = Math.round(num(input.packets));
        if (!(p > 0)) throw invalid("Enter how many packets were packed");
        rec.packets = p;
        rec.bagsTaken = D.takeBags(s.recipeId, r2(p * kgOf(s)));
        b.packedPackets = p; b.bagsTaken = rec.bagsTaken;
      }
      if (task.cartons) {
        var sk = D.sku(b.skuId), pk = b.packedPackets || 0;
        rec.cartonsPacked = Math.ceil(pk / sk.perCarton);
        var oldest = (b.bagsTaken || [])[0];
        D.addPackets(sk.id, pk, b.batchNumber + (oldest ? " · from " + oldest.batchNumber : ""), oldest ? oldest.madeAt : iso(), oldest ? oldest.useBy : iso());
        b.inventorySync = { status: "synced", syncedAt: iso(), lines: [{ lineRef: sk.id, status: "synced", expectedQty: b.packets, actualQty: pk, hostProductId: sk.id,
          manufacturingDate: (oldest ? oldest.madeAt : iso()).slice(0, 10), expiryDate: (oldest ? oldest.useBy : iso()).slice(0, 10) }],
          events: [{ lineRef: sk.id, action: "post", status: "ok", timestamp: iso(), actor: worker.name }] };
      }
      Object.assign(task, rec);
      task.status = "done"; task.completedAt = iso(); task.updatedAt = iso();
      if (task.startedAt) task.durationMinutes = Math.round((new Date(task.completedAt) - new Date(task.startedAt)) / MIN);
      D.emit("production.step.done", { by: worker.name, data: Object.assign({ batch: b ? b.batchNumber : null, step: task.stepName, taskId: task._id, loss: task.loss }, rec) });
      if (task.weigh && task.loss != null && rec.lossPct > task.loss) {
        D.emit("production.weight.loss", { by: worker.name, data: { batch: b.batchNumber, step: task.stepName, kgIn: rec.kgIn, kgOut: rec.kgOut, lossPct: rec.lossPct, allowed: task.loss } });
      }
      /* unlock the next step on this shift */
      if (task.unlocksNext !== false) {
        db.tasks.forEach(function (x) {
          if (x.shift === task.shift && x.batch === task.batch && x.stepOrder === task.stepOrder + 1 && x.status === "locked") { x.status = "available"; x.availableAt = iso(); x.updatedAt = iso(); }
        });
      }
      /* the last step completes the batch */
      if (b) {
        var wf = D.workflowFor(b), last = wf ? Math.max.apply(null, wf.steps.map(function (s) { return s.order; })) : task.stepOrder;
        if (task.stepOrder === last && ["in-progress", "planned"].indexOf(b.stateId) !== -1) {
          if (b.kind === "production") {
            var bagged = r2(db.bags.filter(function (g) { return g.batchId === b.id; }).reduce(function (s, g) { return s + g.kg; }, 0));
            b.actualOutcome = { lines: [], plannedSemiFinishedKg: b.batchSize, actualSemiFinishedKg: bagged, settlementRequired: Math.abs(bagged - b.batchSize) > b.batchSize * 0.05 };
            b.semiFinishedKg = bagged;
          } else {
            b.actualOutcome = { lines: [{ packagingConfigId: b.skuId, name: D.sku(b.skuId).name, plannedUnits: b.packets, actualUnits: b.packedPackets || 0 }], settlementRequired: (b.packedPackets || 0) !== b.packets };
          }
          D.move(b, "completed", "complete", worker.name, "Last step done on the floor");
        }
      }
      return rec;
    };

    /* ── Production Plan: orders + forecast − packets − bags − planned ── */
    D.plan = function () {
      var rows = db.skus.map(function (s) {
        var d = db.demand[s.id] || { weekly: [0, 0, 0, 0], open: 0 };
        var avg = d.weekly.reduce(function (a, b) { return a + b; }, 0) / d.weekly.length;
        var forecast = Math.round(avg * (d.season || 1));
        /* orders in hand + next week's forecast */
        var need = d.open + forecast;
        var packets = D.packetsOf(s.id);
        var packing = db.batches.filter(function (b) { return b.kind === "packing" && b.skuId === s.id && ["planned", "in-progress"].indexOf(b.stateId) !== -1; })
          .reduce(function (n, b) { return n + b.packets; }, 0);
        var short = Math.max(0, need - packets - packing);
        return { skuId: s.id, recipeId: s.recipeId, name: s.name, grams: s.grams, open: d.open, weekly: d.weekly, forecast: forecast, need: need, packets: packets, packing: packing, shortPackets: short, shortKg: r2(short * kgOf(s)) };
      });
      var products = db.recipeOrder.map(function (rid) {
        var bk = D.book(rid);
        var mine = rows.filter(function (r) { return r.recipeId === rid; });
        var needKg = r2(mine.reduce(function (s, r) { return s + r.shortKg; }, 0));
        var freezer = D.inFreezer(rid);
        var plannedKg = r2(db.batches.filter(function (b) { return b.kind === "production" && b.recipeId === rid && ["planned", "in-progress", "on-hold"].indexOf(b.stateId) !== -1; })
          .reduce(function (s, b) { return s + b.batchSize; }, 0));
        var toMake = r2(Math.max(0, needKg - freezer - plannedKg));
        /* whole batches at the recipe's sizes, largest first */
        var batches = [], left = toMake, sizes = bk.sizes.slice().sort(function (a, b) { return b - a; });
        while (left > 0.0001) {
          var fit = sizes.filter(function (z) { return z <= left + 0.0001; })[0] || sizes[sizes.length - 1];
          batches.push(fit); left = r2(left - fit);
        }
        return { recipeId: rid, name: bk.name, line: bk.line, needKg: needKg, freezerKg: freezer, plannedKg: plannedKg, toMakeKg: toMake, batches: batches, skus: mine };
      });
      /* raw material for those batches, against the store */
      var needMat = {};
      products.forEach(function (p) {
        var bk = D.book(p.recipeId), kg = p.batches.reduce(function (a, b) { return a + b; }, 0);
        bk.ingredients.forEach(function (i) { if (i.rmId) needMat[i.rmId] = r2((needMat[i.rmId] || 0) + i.qty * kg / bk.base); });
        var bags = Math.ceil(kg / bk.bagKg);
        var bagMat = bk.bagKg === 35 ? "rm-p09" : "rm-p08";
        if (kg) needMat[bagMat] = (needMat[bagMat] || 0) + bags;
      });
      var materials = db.materials.map(function (m) {
        var need = r2(needMat[m.id] || 0), onHand = D.onHand(m.id), reserved = D.reserved(m.id), ordered = D.ordered(m.id);
        var free = r2(onHand - reserved);
        return { id: m.id, name: m.name, unit: m.unit, supplier: m.supplier, need: need, onHand: onHand, reserved: reserved, ordered: ordered, buy: r2(Math.max(0, need - free - ordered)) };
      });
      return { skus: rows, products: products, materials: materials };
    };

    /* ── Month end: real cost and where weight was lost ───────────────── */
    D.monthEnd = function (from) {
      var start = from || new Date(now().getFullYear(), now().getMonth(), 1).toISOString();
      var batches = db.batches.filter(function (b) { return b.kind === "production" && ["completed", "closed"].indexOf(b.stateId) !== -1 && b.statusHistory.some(function (h) { return h.toStatusLabel === "Completed" && h.timestamp >= start; }); });
      var tasks = db.tasks.filter(function (t) { return t.status === "done" && t.completedAt >= start; });
      var costRows = db.recipeOrder.map(function (rid) {
        var bk = D.book(rid), mine = batches.filter(function (b) { return b.recipeId === rid; });
        var matPerKg = bk.ingredients.reduce(function (s, i) { var m = i.rmId && D.material(i.rmId); return s + (m ? m.price * i.qty : 0); }, 0) / bk.base;
        var makePerKg = bk.making.reduce(function (s, m) { return s + m.amount; }, 0) / bk.base;
        var out = 0, used = 0;
        mine.forEach(function (b) {
          out += b.semiFinishedKg || 0;
          (b.ingredientTransactions || []).forEach(function (t) { var m = D.material(t.ingredientId); if (m && t.transactionType === "issue") used += t.quantity * m.price; });
        });
        var actualMat = out ? used / out : 0;
        return { recipeId: rid, name: bk.name, batches: mine.length, kgMade: r2(out), recipeCostPerKg: r2(matPerKg + makePerKg), actualCostPerKg: out ? r2(actualMat + makePerKg) : null, gapPerKg: out ? r2(actualMat - matPerKg) : null };
      });
      var byStep = {}, byWorker = {};
      tasks.filter(function (t) { return t.weigh && t.kgIn; }).forEach(function (t) {
        var b = D.batch(t.batch), key = (b ? b.displayName : "") + " · " + t.stepName;
        var st = byStep[key] || (byStep[key] = { product: b ? b.displayName : "", step: t.stepName, allowed: t.loss, kgIn: 0, lost: 0, times: 0, over: 0 });
        st.kgIn += t.kgIn; st.lost += t.kgIn - t.kgOut; st.times += 1; if (t.loss != null && t.lossPct > t.loss) st.over += 1;
        var w = byWorker[t.assignedName] || (byWorker[t.assignedName] = { name: t.assignedName, kgIn: 0, lost: 0, over: 0, steps: 0 });
        w.kgIn += t.kgIn; w.lost += t.kgIn - t.kgOut; w.steps += 1; if (t.loss != null && t.lossPct > t.loss) w.over += 1;
      });
      var fin = function (o) { o.kgIn = r2(o.kgIn); o.lost = r2(o.lost); o.pct = o.kgIn ? r1(o.lost / o.kgIn * 100) : 0; return o; };
      return {
        from: start, to: iso(), batches: batches.length,
        cost: costRows,
        steps: Object.keys(byStep).map(function (k) { return fin(byStep[k]); }).sort(function (a, b) { return b.lost - a.lost; }),
        workers: Object.keys(byWorker).map(function (k) { return fin(byWorker[k]); }).sort(function (a, b) { return b.pct - a.pct; }),
      };
    };
    return D;
  }

  /* ── Seed: a month of the factory, run through the domain ────────────── */
  function seed(today, log) {
    var t = today.getTime();
    var clk = { t: t - 30 * DAY };
    var clock = function () { return new Date(clk.t); };
    var db = {
      version: VERSION, seededOn: dayKey(today), seq: 0, lotSeq: 0, ordered: {}, demand: {}, fg: {},
      workers: [], workflows: [], shifts: [], tasks: [], updates: [], lots: [], bags: [],
      recipes: [], recipeHeaders: {}, packagingLines: {}, operators: clone(SUPERVISORS), hostProducts: [], batches: [], book: {}, recipeOrder: [],
      materials: MATERIALS.map(function (m) { return { id: m[0], name: m[1], article: m[2], unit: m[3], stockUnit: m[4], store: m[5], price: m[6], threshold: m[7], supplier: m[8], packQty: m[9], packName: m[10] }; }),
      suppliers: clone(SUPPLIERS),
      skus: SKUS.map(function (s) { return { id: s[0], recipeId: s[1], name: s[2], grams: s[3], perCarton: s[4], price: s[5] }; }),
    };
    var D = Domain(db, clock, log);
    var stamp = function (o) { o.createdAt = o.updatedAt = clock().toISOString(); o.__v = 0; o._seq = ++db.seq; return o; };

    RECIPES.forEach(function (r) {
      db.recipeOrder.push(r.id);
      var skus = db.skus.filter(function (s) { return s.recipeId === r.id; });
      db.recipes.push({ id: r.id, name: r.name, subtitle: "1 version", active: true, hasPublishedVersion: true });
      db.recipeHeaders[r.id] = { recipeId: r.id, name: r.name, versions: [{ id: r.version, label: r.label, subLabel: r.sizes.join("/") + " kg" }], activeVersionId: r.version,
        statusLabel: "published", allowedBatchSizes: r.sizes.slice(), bestBeforeDays: r.bestBeforeDays, batchBaseSize: r.base, referenceBatchQty: r.base, batchYieldPct: 100,
        batchBaseUnit: "kg", isLocked: true, branchActions: [] };
      db.packagingLines[r.version] = skus.map(function (s) {
        return { id: s.id, productRef: s.id, packTitle: s.name, name: s.name, packSize: s.grams, packUnit: "g", productName: s.name, costPerPack: s.price,
          attributable: true, costPerPackDisplay: "₹" + s.price.toFixed(2), variantMassDisplay: kgOf(s) + " kg" };
      });
      skus.forEach(function (s) { db.hostProducts.push({ id: s.id, name: s.name, articleNo: "FG-" + s.id.slice(-2).padStart(4, "40") }); });
      db.book[r.id] = { id: r.id, name: r.name, line: r.line, version: r.version, label: r.label, sizes: r.sizes, base: r.base, bestBeforeDays: r.bestBeforeDays, bagKg: r.bagKg, emoji: r.emoji,
        ingredients: r.ingredients.map(function (i) { return { rmId: i[0], name: i[1], brand: i[2], qty: i[3], unit: i[4], yield: i[5] }; }),
        making: r.making.map(function (m) { return { name: m[0], amount: m[1] }; }), strategy: clone(r.strategy) };
      db.workflows.push(stamp({ _id: newId(db), product: r.name, recipeId: r.id, kind: "production", steps: PROCESS[r.id].map(stepOf) }));
    });
    db.workflows.push(stamp({ _id: newId(db), product: "Packing (all products)", recipeId: null, kind: "packing", steps: PROCESS.packing.map(stepOf) }));
    function stepOf(s, i) {
      var f = s[3] || {};
      return { order: i + 1, name: s[0], role: s[1], expectedMinutes: s[2], instructions: f.instructions || "", unlocksNext: true, _id: newId(db),
        weigh: !!f.weigh, takes: f.takes || [], loss: f.loss == null ? null : f.loss, sticks: !!f.sticks, bags: f.bags || null, pack: !!f.pack, cartons: !!f.cartons };
    }
    WORKERS.forEach(function (w) {
      db.workers.push(stamp({ _id: newId(db), key: w[0], name: w[1], role: w[2], pin: w[3], phone: w[4], isOnline: w[5] }));
    });
    db.workers.push(stamp({ _id: newId(db), key: "admin", name: "Admin", role: "admin", email: "admin@jobflow.local", password: "admin1234", isOnline: false }));
    Object.keys(DEMAND).forEach(function (id) { var d = DEMAND[id]; db.demand[id] = { weekly: d.slice(0, 4), open: d[4], season: 1 }; });

    var W = {}; db.workers.forEach(function (w) { W[w.key] = w; });
    var S = {}; RECIPES.forEach(function (r) { S[r.id] = r; });

    /* goods in: raw material over the month, oldest first */
    function receive(dayOff, materialId, qty, h) { clk.t = at(today, dayOff, h || 9).getTime(); return D.receive({ materialId: materialId, qty: qty, gateQty: qty + (qty > 50 ? Math.round(qty * 0.01) : 0), by: "Store · Mohan" }); }
    receive(-28, "rm-p05", 150); receive(-28, "rm-p06", 150); receive(-28, "rm-p07", 12000); receive(-28, "rm-p08", 120); receive(-28, "rm-p09", 60);
    [-27, -21, -14, -7, -2].forEach(function (d) { receive(d, "rm-p01", d === -2 ? 360 : 330); receive(d, "rm-p02", 160); receive(d, "rm-p03", 90); receive(d, "rm-p04", 90); });
    receive(-12, "rm-p05", 150); receive(-12, "rm-p06", 150);
    receive(-1, "rm-p02", 60);
    /* one truck sent back at the gate */
    clk.t = at(today, -9, 10).getTime(); D.receive({ materialId: "rm-p03", qty: 80, gateQty: 82, qc: "returned", note: "Yellow, soft heads", by: "Store · Mohan" });

    /* one shift per working day: run everything on it to the end */
    function runShift(dayOff, name, workers, jobs, endStep) {
      clk.t = at(today, dayOff, 7).getTime();
      var sh = stamp({ _id: newId(db), name: name, startTime: clock().toISOString(), status: "live", workers: workers.map(function (w) { return w._id; }), batches: jobs.map(function (b) { return b.id; }) });
      db.shifts.push(sh);
      D.generateTasks(sh);
      var mins = 5;
      var go = function (limit) {
        var guard = 0;
        while (guard++ < 200) {
          var next = db.tasks.filter(function (x) { return x.shift === sh._id && x.status === "available"; }).sort(function (a, b) { return a._seq - b._seq; })[0];
          if (!next || (limit && limit(next))) return;
          var who = pick(next.role, workers);
          clk.t += mins * MIN; D.claim(next, who);
          clk.t += (next.expectedMinutes + (next._seq % 7) - 3) * MIN;
          D.complete(next, who, inputs(next));
        }
      };
      go(endStep);
      return sh;
    }
    function pick(role, workers) { return workers.filter(function (w) { return w.role === role; })[0] || workers[0]; }
    /* what the floor records: plausible weights with the odd bad day */
    function inputs(task) {
      var b = D.batch(task.batch), wob = (task._seq % 11 === 0) ? 1.45 : 1;
      if (task.weigh && task.takes.length) {
        /* everything weighed in: the whole mix (flour + water, or all the veg) */
        var bk = D.book(b.recipeId), stocked = bk.ingredients.filter(function (i) { return i.unit === "kg" || i.unit === "litre"; }).reduce(function (s, i) { return s + i.qty; }, 0);
        var kin = r1(b.batchSize * stocked / bk.base);
        var loss = Math.min(0.2, (task.loss || 5) / 100 * (0.7 + (task._seq % 5) * 0.08) * wob);
        return { kgIn: kin, kgOut: r1(kin * (1 - loss)) };
      }
      if (task.weigh) { var k = r1(b.batchSize * 1.02); return { kgIn: k, kgOut: r1(k * (1 - (task.loss || 2) / 100 * 0.8)) }; }
      if (task.sticks) return { sticks: Math.round(b.batchSize * 16) };
      if (task.bags) return { kgOut: r1(b.batchSize * (0.97 + (task._seq % 4) * 0.01)) };
      if (task.pack) return { packets: b.packets };
      return {};
    }
    function endShift(sh, dayOff) { clk.t = at(today, dayOff, 15).getTime(); sh.status = "ended"; sh.updatedAt = clock().toISOString(); }
    function order(dayOff, rid, kg, sup) { clk.t = at(today, dayOff - 1, 17).getTime(); return D.createProductionOrder({ recipeId: rid, batchSize: kg, plannedDate: isoDay(at(today, dayOff, 7)), expectedFinishDate: isoDay(at(today, dayOff, 7)), supervisor: sup, actor: "Admin" }).batch; }
    function packOrder(dayOff, skuId, qty) { clk.t = at(today, dayOff - 1, 18).getTime(); return D.createPackingOrder({ skuId: skuId, qty: qty, plannedDate: isoDay(at(today, dayOff, 7)), actor: "Admin" }); }
    function close(b, dayOff) { clk.t = at(today, dayOff, 16).getTime(); if (b.stateId === "completed") D.move(b, "closed", "close", "Admin", "Packed and accounted for"); }
    function sell(dayOff) { clk.t = at(today, dayOff, 18).getTime(); db.skus.forEach(function (s) { D.sell(s.id, Math.round(((db.demand[s.id].weekly[3] || 0) / 3.4))); }); }

    var crew = [W.asha, W.ravi, W.meena, W.farida], crew2 = [W.suresh, W.ravi, W.kiran, W.farida];
    var history = [
      [-26, [["frozen-peas", 200], ["soya-chaap", 100]]],
      [-24, [["mixed-veg", 120]]],
      [-21, [["frozen-peas", 200], ["soya-chaap", 100]]],
      [-19, [["mixed-veg", 100]]],
      [-16, [["frozen-peas", 200], ["soya-chaap", 100]]],
      [-14, [["mixed-veg", 120]]],
      [-12, [["frozen-peas", 200], ["soya-chaap", 50]]],
      [-9, [["soya-chaap", 100], ["mixed-veg", 100]]],
      [-7, [["frozen-peas", 200]]],
      [-5, [["mixed-veg", 100], ["soya-chaap", 100]]],
      [-3, [["frozen-peas", 100]]],
      [-2, [["soya-chaap", 50]]],
      [-1, [["mixed-veg", 100]]],
    ];
    var sups = ["Dharmendar Ji", "Priya Sharma", "Suresh Kumar"];
    /* Pack small packets when orders need them: a pack below a third of a
       week's sales is packed back up to a week and a half, in full cartons, from the bags
       already in the freezer. */
    function packWhatsShort(day) {
      var planned = {};
      return db.skus.map(function (s) {
        var d = db.demand[s.id], week = d.weekly.reduce(function (a, b) { return a + b; }, 0) / d.weekly.length, have = D.packetsOf(s.id);
        if (have >= week * 0.35) return null;
        var qty = Math.ceil((week * 1.5 - have) / s.perCarton) * s.perCarton, kg = qty * kgOf(s);
        var free = D.inFreezer(s.recipeId) - (planned[s.recipeId] || 0);
        if (free < kg) { qty = Math.floor(free / kgOf(s) / s.perCarton) * s.perCarton; kg = qty * kgOf(s); }
        if (qty <= 0) return null;
        planned[s.recipeId] = (planned[s.recipeId] || 0) + kg;
        return packOrder(day, s.id, qty);
      }).filter(Boolean);
    }
    history.forEach(function (h, i) {
      var day = h[0];
      var jobs = h[1].map(function (p, j) { return order(day, p[0], p[1], sups[(i + j) % 3]); }).concat(packWhatsShort(day));
      var sh = runShift(day, "Day Shift — " + new Date(at(today, day, 7)).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), i % 3 === 2 ? crew2 : crew, jobs);
      endShift(sh, day);
      jobs.forEach(function (b) { if (b.kind === "packing") close(b, day); });
      sell(day);
    });
    /* production batches whose bags are all packed are closed; the rest wait in the freezer */
    db.batches.forEach(function (b) {
      if (b.kind === "production" && b.stateId === "completed" && !db.bags.some(function (g) { return g.batchId === b.id && g.remaining > 0; })) { clk.t = t - 2 * HOUR; D.move(b, "closed", "close", "Admin", "All bags packed"); }
    });

    /* today: two batches on the floor, a packing order, one planned for the evening */
    var mv = order(0, "mixed-veg", 120, "Priya Sharma");
    var sc = order(0, "soya-chaap", 100, "Dharmendar Ji");
    var pk = packOrder(0, "fg-p05", 48);
    var fp = order(0, "frozen-peas", 200, "Suresh Kumar");
    clk.t = at(today, -1, 16).getTime();
    var morning = stamp({ _id: newId(db), name: "Morning Shift — Today", startTime: at(today, 0, 7).toISOString(), status: "live", workers: crew.map(function (w) { return w._id; }), batches: [mv.id, sc.id, pk.id] });
    db.shifts.push(morning);
    clk.t = at(today, 0, 7).getTime();
    D.generateTasks(morning);
    db.tasks.forEach(function (x) { if (x.shift === morning._id && x.batch === pk.id && x.status === "available") x.availableAt = new Date(t - 12 * MIN).toISOString(); });
    var evening = stamp({ _id: newId(db), name: "Evening Shift — Today", startTime: at(today, 0, 15).toISOString(), status: "scheduled", workers: [W.suresh._id, W.farida._id, W.kiran._id], batches: [fp.id] });
    db.shifts.push(evening);
    /* the morning so far, relative to now: Asha washed the veg an hour ago and
       lost 12.9% (the recipe allows 10); Ravi weighed out the flour and is
       making the dough */
    var tk = function (b, order) { return db.tasks.filter(function (x) { return x.shift === morning._id && x.batch === b.id && x.stepOrder === order; })[0]; };
    clk.t = t - 95 * MIN; D.claim(tk(mv, 1), W.asha);
    clk.t = t - 58 * MIN; D.complete(tk(mv, 1), W.asha, { kgIn: 120, kgOut: 104.5 });
    clk.t = t - 80 * MIN; D.claim(tk(sc, 1), W.ravi);
    clk.t = t - 62 * MIN; D.complete(tk(sc, 1), W.ravi, { kgIn: 104, kgOut: 102.6 });
    clk.t = t - 40 * MIN; D.claim(tk(sc, 2), W.ravi);
    /* open purchase orders the store is waiting on */
    db.ordered = { "rm-p05": 200, "rm-p09": 20 };
    return db;
  }

  /* ── The JobFlow API over the store (the two floor apps) ─────────────── */
  function createServer(opts) {
    var load = opts.load, save = opts.save, now = opts.now || function () { return new Date(); };
    var log = opts.log || function () {};
    var db = null, D = null;

    function state() {
      var stored = null;
      try { stored = load(); } catch (e) { stored = null; }
      if (!stored || stored.version !== VERSION || stored.seededOn !== dayKey(now())) {
        if (opts.onReseed) opts.onReseed();
        stored = seed(now(), log);
        save(stored);
      }
      db = stored; D = Domain(db, now, log);
      return db;
    }
    function commit() { save(db); }
    function iso() { return now().toISOString(); }

    function auth(token) {
      var id = token && /^Bearer mock\.([0-9a-f]{24})$/.exec(token);
      if (!token) throw new ApiError(401, "Missing or malformed Authorization header");
      var w = id && find(db.workers, id[1]);
      if (!w) throw new ApiError(401, "Invalid or expired token");
      return w;
    }
    function admin(user) { if (user.role !== "admin") throw new ApiError(403, "Forbidden: insufficient role"); }
    function tokens(w) { return { accessToken: "mock." + w._id, refreshToken: "mock.refresh." + w._id, expiresIn: "8h" }; }
    function workerJSON(w) { var c = strip(w); delete c.pin; delete c.password; delete c.key; return c; }
    var ID = /^[\w.-]+$/;

    /* A batch as the floor apps see it. */
    function jfBatch(b) {
      var wf = D.workflowFor(b);
      var done = db.tasks.filter(function (t) { return t.batch === b.id && t.status === "done"; }).map(function (t) { return t.stepOrder; });
      var total = wf ? wf.steps.length : 0;
      var pointer = 1; while (done.indexOf(pointer) !== -1) pointer += 1;
      return { _id: b.id, code: b.batchNumber, product: b.displayName, quantity: b.kind === "packing" ? b.packets + " packets" : b.batchSize + " kg",
        status: ["completed", "closed"].indexOf(b.stateId) !== -1 ? "done" : "running", stateId: b.stateId, statusLabel: b.statusLabel, kind: b.kind, line: b.line,
        recipeId: b.recipeId, totalSteps: total, currentStepOrder: b.stateId === "completed" || b.stateId === "closed" ? total + 1 : pointer,
        workflow: wf ? { _id: wf._id, product: wf.product } : null, plannedDate: b.plannedDate, expectedFinishDate: b.expectedFinishDate, supervisor: b.operator, createdAt: b.statusHistory[0].timestamp };
    }
    function populateShift(s) {
      var c = strip(s);
      c.workers = s.workers.map(function (id) { var w = find(db.workers, id); return w && { _id: w._id, name: w.name, role: w.role, isOnline: w.isOnline }; }).filter(Boolean);
      c.batches = s.batches.map(function (id) { var b = D.batch(id); return b && { _id: b.id, code: b.batchNumber, product: b.displayName, status: jfBatch(b).status, stateId: b.stateId, kind: b.kind, line: b.line }; }).filter(Boolean);
      return c;
    }
    function workflowJSON(wf) { var c = strip(wf); c.steps.sort(byOrder); return c; }
    function populateTask(t) {
      var c = strip(t), b = D.batch(t.batch);
      c.batch = b ? { _id: b.id, code: b.batchNumber, product: b.displayName, totalSteps: jfBatch(b).totalSteps, stateId: b.stateId, statusLabel: b.statusLabel, kind: b.kind, line: b.line,
        batchSize: b.batchSize, packets: b.packets || null, skuName: b.skuId ? D.sku(b.skuId).name : null } : null;
      return c;
    }

    function shiftBody(b, partial) {
      if (!b || typeof b !== "object") throw invalid();
      var out = {};
      if ("name" in b) { if (typeof b.name !== "string" || !b.name.trim()) throw invalid(); out.name = b.name.trim(); } else if (!partial) throw invalid();
      if ("startTime" in b) { var d = new Date(b.startTime); if (isNaN(d)) throw invalid(); out.startTime = d.toISOString(); } else if (!partial) throw invalid();
      if ("status" in b) { if (["scheduled", "live", "ended"].indexOf(b.status) === -1) throw invalid(); out.status = b.status; }
      ["workers", "batches"].forEach(function (k) { if (k in b) { if (!Array.isArray(b[k]) || b[k].some(function (x) { return !ID.test(x); })) throw invalid(); out[k] = b[k].slice(); } });
      if (partial && !Object.keys(out).length) throw invalid();
      return out;
    }
    var STEP_FLAGS = ["weigh", "sticks", "pack", "cartons"];
    function stepBody(b, requireAll) {
      if (!b || typeof b !== "object") throw invalid();
      var out = {};
      if (b.order !== undefined) { if (!Number.isInteger(b.order) || b.order < 1) throw invalid(); out.order = b.order; }
      if ("name" in b) { if (typeof b.name !== "string" || !b.name.trim()) throw invalid(); out.name = b.name.trim(); } else if (requireAll) throw invalid();
      if ("role" in b) { if (typeof b.role !== "string" || !b.role.trim()) throw invalid(); out.role = b.role.trim(); } else if (requireAll) throw invalid();
      if (b.expectedMinutes !== undefined) { if (!Number.isInteger(b.expectedMinutes) || b.expectedMinutes < 1) throw invalid(); out.expectedMinutes = b.expectedMinutes; }
      if (b.instructions !== undefined) { if (typeof b.instructions !== "string") throw invalid(); out.instructions = b.instructions; }
      if (b.unlocksNext !== undefined) { if (typeof b.unlocksNext !== "boolean") throw invalid(); out.unlocksNext = b.unlocksNext; }
      STEP_FLAGS.forEach(function (k) { if (b[k] !== undefined) out[k] = !!b[k]; });
      if (b.takes !== undefined) { if (!Array.isArray(b.takes)) throw invalid(); out.takes = b.takes.filter(function (x) { return D.material(x); }); }
      if (b.loss !== undefined) out.loss = b.loss === null || b.loss === "" ? null : Math.max(0, Number(b.loss));
      if (b.bags !== undefined) out.bags = b.bags ? Number(b.bags) : null;
      if (!requireAll && !Object.keys(out).length) throw invalid();
      return out;
    }
    function stepDefaults(st) { return Object.assign({ expectedMinutes: 45, unlocksNext: true, weigh: false, takes: [], loss: null, sticks: false, bags: null, pack: false, cartons: false }, st, { _id: newId(db) }); }

    var routes = [];
    function route(method, pattern, fn) {
      var keys = [];
      var re = new RegExp("^" + pattern.replace(/:(\w+)/g, function (_, k) { keys.push(k); return "([^/]+)"; }) + "$");
      routes.push({ method: method, re: re, keys: keys, fn: fn });
    }

    route("POST", "/api/auth/worker-login", function (r) {
      var b = r.body || {};
      if (typeof b.name !== "string" || !b.name.trim() || typeof b.pin !== "string" || b.pin.length < 3 || b.pin.length > 10) throw invalid();
      var name = b.name.trim().toLowerCase();
      var w = db.workers.filter(function (x) { return x.name.toLowerCase() === name; })[0];
      if (!w || w.role === "admin" || w.pin !== b.pin) throw new ApiError(401, "Invalid name or PIN");
      w.isOnline = true; w.updatedAt = iso(); commit();
      return Object.assign({ worker: workerJSON(w) }, tokens(w));
    });
    /* The sign-in screen's "Sign in as" picker (owner, 26 Sep 2026): the
       floor roster, and a sign-in that skips the PIN. A demo shortcut the
       JobFlow API does not have. */
    route("GET", "/api/auth/workers", function () {
      var live = {};
      db.shifts.forEach(function (s) { if (s.status === "live") s.workers.forEach(function (id) { live[id] = true; }); });
      var list = db.workers.filter(function (w) { return w.role !== "admin"; });
      list.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
      return { workers: list.map(function (w) { return { _id: w._id, name: w.name, role: w.role, onShift: !!live[w._id] }; }) };
    });
    route("POST", "/api/auth/worker-login-as", function (r) {
      var b = r.body || {};
      if (typeof b.worker !== "string" || !ID.test(b.worker)) throw invalid();
      var w = find(db.workers, b.worker);
      if (!w || w.role === "admin") throw new ApiError(404, "Worker not found");
      w.isOnline = true; w.updatedAt = iso(); commit();
      return Object.assign({ worker: workerJSON(w) }, tokens(w));
    });
    route("POST", "/api/auth/admin-login", function (r) {
      var b = r.body || {};
      if (typeof b.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) || typeof b.password !== "string" || b.password.length < 6) throw invalid();
      var a = db.workers.filter(function (x) { return x.role === "admin" && x.email === b.email.trim().toLowerCase(); })[0];
      if (!a || a.password !== b.password) throw new ApiError(401, "Invalid email or password");
      return Object.assign({ worker: workerJSON(a) }, tokens(a));
    });
    route("GET", "/api/auth/me", function (r) { return { worker: workerJSON(auth(r.token)) }; });

    route("GET", "/api/workers", function (r) {
      admin(auth(r.token));
      var list = db.workers.filter(function (w) { return r.query.role ? w.role === r.query.role : w.role !== "admin"; });
      list.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
      return { workers: list.map(workerJSON) };
    });

    route("GET", "/api/shifts", function (r) {
      auth(r.token);
      var list = db.shifts.filter(function (s) { return !r.query.status || s.status === r.query.status; });
      list.sort(function (a, b) { return new Date(a.startTime) - new Date(b.startTime) || a._seq - b._seq; });
      return { shifts: list.map(populateShift) };
    });
    route("GET", "/api/shifts/:id", function (r) { auth(r.token); var s = find(db.shifts, r.params.id); if (!s) throw new ApiError(404, "Shift not found"); return { shift: populateShift(s) }; });
    route("POST", "/api/shifts", function (r) {
      admin(auth(r.token));
      var s = Object.assign({ _id: newId(db), status: "scheduled", workers: [], batches: [] }, shiftBody(r.body, false));
      s.createdAt = s.updatedAt = iso(); s.__v = 0; s._seq = ++db.seq;
      db.shifts.push(s); commit();
      return { status: 201, data: { shift: populateShift(s) } };
    });
    route("PUT", "/api/shifts/:id", function (r) {
      admin(auth(r.token));
      var body = shiftBody(r.body, true), s = find(db.shifts, r.params.id);
      if (!s) throw new ApiError(404, "Shift not found");
      Object.assign(s, body); s.updatedAt = iso();
      if (s.status === "live") D.generateTasks(s);
      commit();
      return { shift: populateShift(s) };
    });
    route("DELETE", "/api/shifts/:id", function (r) {
      admin(auth(r.token));
      var s = find(db.shifts, r.params.id);
      if (!s) throw new ApiError(404, "Shift not found");
      db.shifts.splice(db.shifts.indexOf(s), 1); commit();
      return { message: "Shift deleted" };
    });
    route("POST", "/api/shifts/:id/publish", function (r) {
      var user = auth(r.token); admin(user);
      var s = find(db.shifts, r.params.id);
      if (!s) throw new ApiError(404, "Shift not found");
      if (s.status === "ended") throw new ApiError(409, "Cannot publish an ended shift");
      s.status = "live"; s.updatedAt = iso();
      D.generateTasks(s);
      D.emit("production.shift.live", { where: "Shifts", how: "office", by: user.name, data: { shift: s.name, batches: s.batches.length } });
      commit();
      return { shift: populateShift(s) };
    });

    /* Process steps: one workflow per recipe, plus packing. */
    route("GET", "/api/workflows", function (r) {
      auth(r.token);
      var list = db.workflows.slice().sort(function (a, b) { return (a.kind === "packing") - (b.kind === "packing") || (a.product < b.product ? -1 : a.product > b.product ? 1 : 0); });
      return { workflows: list.map(workflowJSON) };
    });
    route("GET", "/api/workflows/:id", function (r) { auth(r.token); var wf = find(db.workflows, r.params.id); if (!wf) throw new ApiError(404, "Workflow not found"); return { workflow: workflowJSON(wf) }; });
    route("POST", "/api/workflows", function (r) {
      admin(auth(r.token));
      var b = r.body || {}, bk = b.recipeId && D.book(b.recipeId);
      if (!bk) throw invalid("Pick a recipe");
      if (db.workflows.some(function (w) { return w.recipeId === bk.id; })) throw new ApiError(409, bk.name + " already has its steps");
      var wf = { _id: newId(db), product: bk.name, recipeId: bk.id, kind: "production", steps: [], createdAt: iso(), updatedAt: iso(), __v: 0, _seq: ++db.seq };
      db.workflows.push(wf); commit();
      return { status: 201, data: { workflow: workflowJSON(wf) } };
    });
    route("PUT", "/api/workflows/:id/steps/reorder", function (r) {
      admin(auth(r.token));
      var ids = r.body && r.body.stepIds, wf = find(db.workflows, r.params.id);
      if (!Array.isArray(ids) || !ids.length) throw invalid();
      if (!wf) throw new ApiError(404, "Workflow not found");
      if (ids.length !== wf.steps.length) throw new ApiError(400, "stepIds must include every step exactly once");
      ids.forEach(function (id) { if (!find(wf.steps, id)) throw new ApiError(400, "Unknown step id: " + id); });
      ids.forEach(function (id, i) { find(wf.steps, id).order = i + 1; });
      wf.steps.sort(byOrder); wf.updatedAt = iso(); commit();
      return { workflow: workflowJSON(wf) };
    });
    route("DELETE", "/api/workflows/:id", function (r) {
      admin(auth(r.token));
      var wf = find(db.workflows, r.params.id);
      if (!wf) throw new ApiError(404, "Workflow not found");
      db.workflows.splice(db.workflows.indexOf(wf), 1); commit();
      return { message: "Workflow deleted" };
    });
    route("POST", "/api/workflows/:id/steps", function (r) {
      admin(auth(r.token));
      var st = stepBody(r.body, true), wf = find(db.workflows, r.params.id);
      if (!wf) throw new ApiError(404, "Workflow not found");
      if (!st.order) st.order = wf.steps.reduce(function (m, s) { return Math.max(m, s.order); }, 0) + 1;
      wf.steps.push(stepDefaults(st)); wf.steps.sort(byOrder); wf.updatedAt = iso(); commit();
      return { status: 201, data: { workflow: workflowJSON(wf) } };
    });
    route("PUT", "/api/workflows/:id/steps/:stepId", function (r) {
      admin(auth(r.token));
      var patch = stepBody(r.body, false), wf = find(db.workflows, r.params.id);
      if (!wf) throw new ApiError(404, "Workflow not found");
      var step = find(wf.steps, r.params.stepId);
      if (!step) throw new ApiError(404, "Step not found");
      Object.assign(step, patch); wf.steps.sort(byOrder); wf.updatedAt = iso(); commit();
      return { workflow: workflowJSON(wf) };
    });
    route("DELETE", "/api/workflows/:id/steps/:stepId", function (r) {
      admin(auth(r.token));
      var wf = find(db.workflows, r.params.id);
      if (!wf) throw new ApiError(404, "Workflow not found");
      var step = find(wf.steps, r.params.stepId);
      if (!step) throw new ApiError(404, "Step not found");
      wf.steps.splice(wf.steps.indexOf(step), 1); wf.updatedAt = iso(); commit();
      return { workflow: workflowJSON(wf) };
    });

    /* Batches are Batch Management's; the floor lists and reads them. */
    route("GET", "/api/batches", function (r) {
      auth(r.token);
      var list = db.batches.map(jfBatch).filter(function (b) {
        if (r.query.status && b.status !== r.query.status) return false;
        if (r.query.open === "1" && ["planned", "in-progress", "on-hold"].indexOf(b.stateId) === -1) return false;
        return true;
      });
      list.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
      return { batches: list };
    });
    route("GET", "/api/recipes", function (r) { auth(r.token); return { recipes: db.recipeOrder.map(function (id) { var bk = D.book(id); return { id: id, name: bk.name, line: bk.line, ingredients: bk.ingredients, hasSteps: db.workflows.some(function (w) { return w.recipeId === id; }) }; }) }; });
    route("GET", "/api/materials", function (r) { auth(r.token); return { materials: db.materials.map(function (m) { return { id: m.id, name: m.name, unit: m.unit, onHand: D.onHand(m.id) }; }) }; });

    /* the floor */
    function sortTasks(list) { return list.sort(function (a, b) { return a.stepOrder - b.stepOrder || new Date(a.createdAt) - new Date(b.createdAt) || a._seq - b._seq; }); }
    route("GET", "/api/tasks", function (r) {
      auth(r.token);
      var q = r.query;
      var list = db.tasks.filter(function (t) {
        if (q.shift && t.shift !== q.shift) return false;
        if (q.batch && t.batch !== q.batch) return false;
        if (q.role && t.role !== q.role) return false;
        if (q.status && t.status !== q.status) return false;
        if (q.open === "1") { var b = D.batch(t.batch); if (b && ["on-hold", "rejected"].indexOf(b.stateId) !== -1) return false; }
        return true;
      });
      return { tasks: sortTasks(list).map(populateTask) };
    });
    route("GET", "/api/tasks/mine", function (r) {
      var user = auth(r.token);
      var t = db.tasks.filter(function (x) { return x.assignedTo === user._id && x.status === "in_progress"; })[0];
      return { task: t ? populateTask(t) : null };
    });
    route("GET", "/api/tasks/:id", function (r) {
      auth(r.token);
      var t = find(db.tasks, r.params.id);
      if (!t) throw new ApiError(404, "Task not found");
      var s = find(db.shifts, t.shift), b = D.batch(t.batch);
      var c = populateTask(t);
      c.stepCount = c.batch ? c.batch.totalSteps : undefined;
      c.workersOnThis = (s ? s.workers : []).map(function (id) { return find(db.workers, id); })
        .filter(function (w) { return w && w.role === t.role; }).map(function (w) { return { _id: w._id, name: w.name, role: w.role, isOnline: w.isOnline }; });
      /* what the step will take from the store and the freezer */
      c.store = (t.takes || []).map(function (id) { var m = D.material(id), lot = D.lotsFIFO(id)[0]; return { materialId: id, name: m.name, unit: m.unit, onHand: D.onHand(id), oldest: lot ? { lotNo: lot.lotNo, remaining: lot.remaining, receivedAt: lot.receivedAt, store: lot.store } : null }; });
      if (t.sticks) { var sl = D.lotsFIFO("rm-p07")[0]; c.store.push({ materialId: "rm-p07", name: "Wooden Sticks", unit: "pcs", onHand: D.onHand("rm-p07"), oldest: sl ? { lotNo: sl.lotNo, remaining: sl.remaining, receivedAt: sl.receivedAt, store: sl.store } : null }); }
      if (t.pack && b) { var sk = D.sku(b.skuId); c.freezer = { product: D.book(sk.recipeId).name, needKg: r2(b.packets * kgOf(sk)), onHand: D.inFreezer(sk.recipeId), oldest: D.bagsFIFO(sk.recipeId).slice(0, 3).map(function (g) { return { bagNo: g.bagNo, remaining: g.remaining, madeAt: g.madeAt, useBy: g.useBy }; }) }; }
      if (t.bags && b) c.bagPlan = { bagKg: t.bags, expectedKg: b.batchSize, bestBeforeDays: D.book(b.recipeId).bestBeforeDays };
      if (t.cartons && b) { var sk2 = D.sku(b.skuId); c.cartonPlan = { packets: b.packedPackets || 0, perCarton: sk2.perCarton }; }
      return { task: c };
    });
    route("POST", "/api/tasks/:id/claim", function (r) {
      var user = auth(r.token), t = find(db.tasks, r.params.id);
      if (!t) throw new ApiError(404, "Task not found");
      /* No role restriction (owner, 26 Sep 2026): any worker takes any available task. */
      D.claim(t, user); commit();
      return { task: populateTask(t) };
    });
    route("POST", "/api/tasks/:id/updates", function (r) {
      var user = auth(r.token), b = r.body || {}, t = find(db.tasks, r.params.id);
      var quick = ["just_started", "halfway", "almost_done", "need_materials", "issue_found", "need_help"];
      if (quick.indexOf(b.quickSelect) === -1) throw invalid();
      if (!t) throw new ApiError(404, "Task not found");
      var u = { _id: newId(db), task: t._id, worker: user._id, quickSelect: b.quickSelect, note: b.note && String(b.note).trim(), createdAt: iso(), updatedAt: iso(), __v: 0 };
      db.updates.push(u); commit();
      return { status: 201, data: { update: clone(u) } };
    });
    route("POST", "/api/tasks/:id/complete", function (r) {
      var user = auth(r.token), t = find(db.tasks, r.params.id);
      if (!t) throw new ApiError(404, "Task not found");
      /* all-or-nothing: a step that fails (short stock) changes nothing */
      var before = JSON.stringify(db);
      try { D.complete(t, user, r.body || {}); }
      catch (e) { db = JSON.parse(before); throw e; }
      commit();
      return { task: populateTask(t) };
    });

    /* Alerts: what needs the office, from the floor's record. */
    route("GET", "/api/alerts", function (r) {
      auth(r.token);
      var out = [], nowT = now().getTime(), live = db.shifts.filter(function (s) { return s.status === "live"; }).map(function (s) { return s._id; });
      db.tasks.filter(function (t) { return t.status === "done" && t.weigh && t.loss != null && t.lossPct > t.loss && nowT - new Date(t.completedAt).getTime() < DAY; }).forEach(function (t) {
        var b = D.batch(t.batch);
        out.push({ _id: "loss-" + t._id, type: "weight_loss", isRead: false, createdAt: t.completedAt, batch: b.id,
          message: t.stepName + " on " + b.batchNumber + " lost " + t.lossPct + "% (" + t.kgIn + " → " + t.kgOut + " kg). The recipe allows " + t.loss + "%." });
      });
      db.tasks.filter(function (t) { return t.status === "available" && live.indexOf(t.shift) !== -1 && t.availableAt && nowT - new Date(t.availableAt).getTime() > 20 * MIN; }).forEach(function (t) {
        var b = D.batch(t.batch);
        if (!b || ["on-hold", "rejected"].indexOf(b.stateId) !== -1) return;
        out.push({ _id: "idle-" + t._id, type: "waiting", isRead: false, createdAt: t.availableAt, batch: b.id,
          message: t.stepName + " on " + b.batchNumber + " has waited " + Math.round((nowT - new Date(t.availableAt).getTime()) / MIN) + " min and no one has started it." });
      });
      db.batches.filter(function (b) { return b.stateId === "on-hold"; }).forEach(function (b) {
        out.push({ _id: "hold-" + b.id, type: "on_hold", isRead: false, createdAt: b.statusHistory[b.statusHistory.length - 1].timestamp, batch: b.id, message: b.batchNumber + " · " + b.displayName + " is on hold. Its steps are paused on the floor." });
      });
      out.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
      return { alerts: out };
    });

    function handle(method, path, query, body, token) {
      state();
      var clean = path.split("?")[0];
      for (var i = 0; i < routes.length; i++) {
        var rt = routes[i], m;
        if (rt.method !== method || !(m = rt.re.exec(clean))) continue;
        var params = {};
        rt.keys.forEach(function (k, j) { params[k] = decodeURIComponent(m[j + 1]); });
        try {
          var out = rt.fn({ params: params, query: query || {}, body: clone(body), token: token });
          if (out && out.status && out.data) return { status: out.status, data: out.data };
          return { status: 200, data: out };
        } catch (e) {
          if (e instanceof ApiError) return { status: e.status, data: e.body };
          throw e;
        }
      }
      return { status: 404, data: { error: "Route not found: " + method + " " + path } };
    }
    return { handle: handle, snapshot: function () { return clone(state()); }, reset: function () { db = seed(now(), log); save(db); } };
  }

  /* ── The floor apps' lib/api.js, over the mock ──────────────────────── */
  function createClient(opts) {
    var server = opts.server, sessionKey = opts.sessionKey, latency = opts.latency == null ? 90 : opts.latency;
    var onUnauthorized = null;
    function loadSession() { try { var raw = localStorage.getItem(sessionKey); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
    function saveSession(s) { try { localStorage.setItem(sessionKey, JSON.stringify(s)); } catch (e) {} }
    function clearSession() { try { localStorage.removeItem(sessionKey); } catch (e) {} }
    function request(method, path, o) {
      o = o || {};
      var s = loadSession();
      var token = s && s.accessToken ? "Bearer " + s.accessToken : null;
      var query = {};
      Object.keys(o.params || {}).forEach(function (k) { if (o.params[k] !== undefined && o.params[k] !== null) query[k] = String(o.params[k]); });
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          var res;
          try { res = server.handle(method, path, query, o.data, token); }
          catch (e) { if (typeof console !== "undefined") console.error(e); return reject(new Error("Something went wrong. Please try again.")); }
          if (res.status < 400) return resolve(res.data);
          if (opts.logoutOn401 && res.status === 401 && s && s.accessToken) { clearSession(); if (onUnauthorized) onUnauthorized(); }
          var err = new Error((res.data && res.data.error) || "Something went wrong. Please try again.");
          err.status = res.status;
          reject(err);
        }, latency);
      });
    }
    var g = function (k) { return function (d) { return d[k]; }; };
    return {
      loadSession: loadSession, saveSession: saveSession, clearSession: clearSession,
      setUnauthorizedHandler: function (fn) { onUnauthorized = fn; },
      workerLogin: function (name, pin) { return request("POST", "/api/auth/worker-login", { data: { name: name, pin: pin } }); },
      listSignInWorkers: function () { return request("GET", "/api/auth/workers").then(g("workers")); },
      workerLoginAs: function (id) { return request("POST", "/api/auth/worker-login-as", { data: { worker: id } }); },
      adminLogin: function (email, password) { return request("POST", "/api/auth/admin-login", { data: { email: email, password: password } }); },
      getMe: function () { return request("GET", "/api/auth/me").then(g("worker")); },
      listShifts: function (status) { return request("GET", "/api/shifts", { params: status ? { status: status } : undefined }).then(g("shifts")); },
      getShift: function (id) { return request("GET", "/api/shifts/" + id).then(g("shift")); },
      createShift: function (p) { return request("POST", "/api/shifts", { data: p }).then(g("shift")); },
      updateShift: function (id, p) { return request("PUT", "/api/shifts/" + id, { data: p }).then(g("shift")); },
      deleteShift: function (id) { return request("DELETE", "/api/shifts/" + id); },
      publishShift: function (id) { return request("POST", "/api/shifts/" + id + "/publish").then(g("shift")); },
      listWorkers: function (role) { return request("GET", "/api/workers", { params: role ? { role: role } : undefined }).then(g("workers")); },
      listWorkflows: function () { return request("GET", "/api/workflows").then(g("workflows")); },
      getWorkflow: function (id) { return request("GET", "/api/workflows/" + id).then(g("workflow")); },
      createWorkflow: function (p) { return request("POST", "/api/workflows", { data: p }).then(g("workflow")); },
      deleteWorkflow: function (id) { return request("DELETE", "/api/workflows/" + id); },
      addStep: function (id, step) { return request("POST", "/api/workflows/" + id + "/steps", { data: step }).then(g("workflow")); },
      updateStep: function (id, stepId, patch) { return request("PUT", "/api/workflows/" + id + "/steps/" + stepId, { data: patch }).then(g("workflow")); },
      deleteStep: function (id, stepId) { return request("DELETE", "/api/workflows/" + id + "/steps/" + stepId).then(g("workflow")); },
      reorderSteps: function (id, stepIds) { return request("PUT", "/api/workflows/" + id + "/steps/reorder", { data: { stepIds: stepIds } }).then(g("workflow")); },
      listBatches: function (q) { return request("GET", "/api/batches", { params: q }).then(g("batches")); },
      listRecipes: function () { return request("GET", "/api/recipes").then(g("recipes")); },
      listMaterials: function () { return request("GET", "/api/materials").then(g("materials")); },
      listAlerts: function () { return request("GET", "/api/alerts").then(function (d) { return d.alerts || []; }, function () { return []; }); },
      listTasks: function (q) { q = q || {}; return request("GET", "/api/tasks", { params: q }).then(g("tasks")); },
      getTask: function (id) { return request("GET", "/api/tasks/" + id).then(g("task")); },
      getMyTask: function () { return request("GET", "/api/tasks/mine").then(function (d) { return d.task || null; }); },
      claimTask: function (id) { return request("POST", "/api/tasks/" + id + "/claim").then(g("task")); },
      postTaskUpdate: function (id, o) { o = o || {}; return request("POST", "/api/tasks/" + id + "/updates", { data: { quickSelect: o.quickSelect, note: o.note } }); },
      completeTask: function (id, input) { return request("POST", "/api/tasks/" + id + "/complete", { data: input || {} }).then(g("task")); },
    };
  }

  /* ── The browser: one store over localStorage, for every screen ─────── */
  function readLog() { try { var v = JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function writeLog(ev) {
    var all = readLog();
    ev.id = "PL-" + String(all.length + 1).padStart(6, "0");
    try { localStorage.setItem(LOG_KEY, JSON.stringify(all.concat([ev]).slice(-3000))); } catch (e) {}
  }
  function browser() {
    var load = function () { var raw = localStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) : null; };
    var save = function (d) { try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch (e) {} };
    var server = createServer({ load: load, save: save, log: writeLog, onReseed: function () { try { localStorage.removeItem(LOG_KEY); } catch (e) {} } });
    var clock = function () { return new Date(); };
    /* Every call reads the store fresh: several frames write it. */
    function db() { server.handle("GET", "/__ensure", {}, null, null); return load(); }
    function withDomain(fn) { var d = db(); var r = fn(Domain(d, clock, writeLog), d); save(d); return r; }
    function read(fn) { var d = db(); return fn(Domain(d, clock, writeLog), d); }
    return {
      KEY: STORE_KEY, LOG_KEY: LOG_KEY, server: server,
      load: db, save: save, log: readLog,
      read: read, write: withDomain,
      /* Batch Management: its seed.json shape, straight from the store. */
      batchSeed: function () {
        var d = db(), D = Domain(d, clock, writeLog);
        var byBatch = {};
        d.bags.forEach(function (g) { if (g.remaining > 0) (byBatch[g.batchId] = byBatch[g.batchId] || []).push(g); });
        d.semiFinishedProducts = Object.keys(byBatch).map(function (id) {
          var gs = byBatch[id], b = D.batch(id);
          return { id: "sfp-" + id, name: b.displayName + " · " + gs.length + " bag" + (gs.length > 1 ? "s" : ""), batchNumber: b.batchNumber, stock: r2(gs.reduce(function (s, g) { return s + g.remaining; }, 0)),
            measurement: "kg-Bag-Freezer", status: "ACTIVE", createdAt: gs[0].madeAt };
        });
        return d;
      },
      plan: function () { return read(function (D) { return D.plan(); }); },
      monthEnd: function () { return read(function (D) { return D.monthEnd(); }); },
      createProductionOrder: function (o) { return withDomain(function (D) { return D.createProductionOrder(o); }); },
      createPackingOrder: function (o) { return withDomain(function (D) { return D.createPackingOrder(o); }); },
      receive: function (o) { return withDomain(function (D) { return D.receive(o); }); },
      stickers: function (lotNo) { return read(function (D) { return D.stickers(lotNo); }); },
      order: function (materialId, qty) { return withDomain(function (D, d) { d.ordered[materialId] = r2((d.ordered[materialId] || 0) + qty); D.emit("production.po.raised", { where: "Production Plan", how: "office", by: "Admin", data: { material: D.material(materialId).name, qty: qty } }); return d.ordered[materialId]; }); },
      addWorker: function (o) { return withDomain(function (D, d) { var w = { _id: newId(d), key: "stf-" + d.seq, name: o.name, role: o.role, pin: o.pin || String(o.phone || "0000").slice(-4), phone: o.phone || "", isOnline: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), __v: 0, _seq: ++d.seq }; d.workers.push(w); return w; }); },
      FACTORY_ROLES: FACTORY_ROLES,
    };
  }

  return { createServer: createServer, createClient: createClient, browser: browser, seed: seed, Domain: Domain, STORE_KEY: STORE_KEY, LOG_KEY: LOG_KEY, FACTORY_ROLES: FACTORY_ROLES };
});

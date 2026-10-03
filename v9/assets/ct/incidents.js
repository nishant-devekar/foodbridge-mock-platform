/* ==========================================================================
   CONTROL TOWER · INCIDENTS — Deliveries, run on what actually happened.

   Spec: context/control-tower/CONTROL_TOWER_INCIDENTS.md (owner, 24 Sep 2026).

     incident → tag → lead action → lead impact → standing → back to green

   Facts come in two ways, and both are read the same:
     · delivery records   what happened at the door (fb.v7.ct.deliveries):
                          missed with a reason, short, returned, late …
     · the event stream   fb.v7.events, written by the platform's screens
                          (the delivery app: a skip, a return, a dispute, a
                          van problem) and by the tower's own actions.

   derive() names the incidents (one catalogue of 54, plus crates), puts a
   standing on each — Missed, Pending or On track — from three questions and
   a clock, applies what was done about it (the owner in the tower, or the
   person on the ground, whichever came first), and closes it only when the
   platform records the fix: closed by proof, not by say-so.

   Pure: no DOM, no storage, no clock of its own. Runs under node.
   ========================================================================== */

(function (root) {
  "use strict";

  const MIN = 60000, HOUR = 3600000, DAY = 86400000;
  const IST = 5.5 * HOUR;
  const T = {
    LATE_MIN: 30,        // a drop this long past its slot has missed its window
    VAN_LATE: 2,         // this many stops of one van past their window: the van is late
    END_H: 18,           // the trips are done, the vans settle (IST)
    TRIP_H: 8,           // the next trip leaves (IST)
    LINE: 2000,          // money at risk above this is Missed, for the types that carry it
    TOLD_GRACE: 15,      // a told customer's new time, and this long after it
  };

  /* ── the catalogue ──────────────────────────────────────────────────────
     [id, family, tag, owner attention, starts, money line (₹, 0 = none),
      buttons (alternative + lead action), turns Missed when, recommends].
     starts: ugly = Missed, bad = Pending, good = On track (information).
     Turns Missed when: now · route-end · settle · next-trip · window ·
     30min · 7d · none. A van-level type holds its van's stops. */
  const ROWS = [
    ["customer-unavailable", "Customer", "Not available", "Sometimes", "bad", 0, "Call the shop + Try again today", "route-end", "Call the shop. If the owner is back later, send the van back today."],
    ["shop-closed", "Customer", "Shop closed", "Sometimes", "ugly", 0, "Call the shop + Reschedule", "now", "Call the shop and agree a day. Then reschedule."],
    ["customer-refused", "Customer", "Refused", "Yes", "ugly", 0, "Call the customer + Reschedule", "now", "Call to learn why. Then reschedule, fix the order or cancel it."],
    ["partial-acceptance", "Customer", "Part accepted", "Yes", "bad", 0, "Ask the team + Fix the order", "settle", "Ask why they took less, and bill what they kept."],
    ["order-changed", "Customer", "Order changed", "Yes", "bad", 0, "Call the customer + Fix the order", "none", "Check the change with the customer. Fix the order if it sticks."],
    ["order-dispute", "Customer", "Order dispute", "Yes", "ugly", 0, "Call the customer + Fix the order", "now", "Call to confirm. If they're right, fix the order and send the new bill."],
    ["price-dispute", "Customer", "Price dispute", "Yes", "bad", 500, "Call the customer + Review adjustment", "7d", "Check the scheme rate. Approve it once if they're right."],
    ["scheme-dispute", "Customer", "Scheme dispute", "Yes", "bad", 500, "Call the customer + Review adjustment", "7d", "Check the scheme they claim. Approve or refuse it."],
    ["wrong-address", "Location", "Wrong address", "Yes", "ugly", 0, "Call the shop + Fix customer details", "now", "Call for the right location, save it, then reschedule."],
    ["address-inaccessible", "Location", "Can't reach shop", "Sometimes", "bad", 0, "Call the shop + Try again today", "route-end", "Call the shop to meet the van nearby, or try again later today."],
    ["no-parking", "Location", "No parking", "Sometimes", "good", 0, "Ask the team + Fix customer details", "window", "Note where the van can unload, so the next trip doesn't lose time."],
    ["access-restriction", "Location", "Access hours", "Sometimes", "bad", 0, "Fix customer details + Reschedule", "window", "Save the hours they take deliveries, and move the drop into them."],
    ["wrong-sku", "Order", "Wrong item", "Yes", "bad", 0, "Call the customer + Send on next trip", "next-trip", "Take it back and send the right item on the next trip."],
    ["short-quantity", "Order", "Short", "Yes", "bad", 0, "Call the customer + Send on next trip", "next-trip", "Send the balance on the next trip, and tell the shop it's coming."],
    ["excess-quantity", "Order", "Excess", "Yes", "bad", 0, "Ask the team + Take it back", "settle", "Ask the driver where the extra came from before the route closes."],
    ["missing-item", "Order", "Missing", "Yes", "bad", 1000, "Ask the team + Write it off", "settle", "Ask the driver first. If it can't be found, write it off."],
    ["substitute-rejected", "Order", "Substitute rejected", "Yes", "bad", 0, "Call the customer + Send on next trip", "next-trip", "Send the item they ordered on the next trip."],
    ["damaged-goods", "Product", "Damaged", "Yes", "bad", 2000, "Raise credit note + Send on next trip", "next-trip", "Send a replacement on the next trip, or credit them."],
    ["leaking", "Product", "Leaking", "Yes", "bad", 2000, "Raise credit note + Send on next trip", "next-trip", "Send a replacement on the next trip, or credit them."],
    ["wet-carton", "Product", "Wet carton", "Yes", "bad", 2000, "Raise credit note + Send on next trip", "next-trip", "Send a replacement on the next trip, or credit them."],
    ["broken-pack", "Product", "Broken pack", "Yes", "bad", 2000, "Raise credit note + Send on next trip", "next-trip", "Send a replacement on the next trip, or credit them."],
    ["wrong-batch", "Product", "Wrong batch", "Yes", "bad", 0, "Ask the team + Send on next trip", "next-trip", "Swap the batch on the next trip."],
    ["near-expiry", "Product", "Near expiry", "Yes", "bad", 0, "Ask the team", "next-trip", "Sell it first, and keep it off the slow routes."],
    ["expired-product", "Product", "Expired", "Yes", "ugly", 0, "Take it back + Raise credit note", "now", "Take it back to be thrown away, and credit the customer."],
    ["quality-complaint", "Product", "Quality", "Yes", "ugly", 0, "Call the customer + Send on next trip", "now", "Call the customer today. Replace it or credit it."],
    ["temperature", "Product", "Temperature", "Urgent", "ugly", 0, "Call the driver + Take it back", "now", "Stop the chilled drops and call the driver."],
    ["breakdown", "Vehicle", "Breakdown", "Urgent", "ugly", 0, "Call the driver + Move to another van", "now", "Move the stops due soonest to another van now. The rest can wait for the mechanic."],
    ["accident", "Vehicle", "Accident", "Urgent", "ugly", 0, "Call the driver + Move to another van", "now", "Call the driver first. Then move the stops to another van."],
    ["puncture", "Vehicle", "Puncture", "Sometimes", "bad", 0, "Ask the team + Move to another van", "30min", "Ask how long it will take. Past half an hour, move the stops due soonest."],
    ["fridge", "Vehicle", "Fridge failed", "Urgent", "ugly", 0, "Call the driver + Move to another van", "now", "Pull the chilled drops off the van and move them."],
    ["traffic-delay", "Route", "Traffic", "Sometimes", "bad", 0, "Ask the team + Tell customers", "window", "Tell the next customers their new time before they call you."],
    ["road-closure", "Route", "Road closed", "Sometimes", "bad", 0, "Try again today + Tell customers", "window", "Re-order the stops around it and tell the customers."],
    ["route-deviation", "Route", "Off route", "Yes if material", "bad", 0, "Call the driver + Ask the team", "none", "Ask the driver why the van is off its route."],
    ["driver-delayed", "Route", "Running late", "Yes if SLA affected", "bad", 0, "Move to another van + Tell customers", "window", "Tell the customers still to come their new time. Move a stop if its time can't be kept."],
    ["window-missed", "Route", "Late", "Yes", "ugly", 0, "Call the customer + Tell customers", "now", "Tell the customer when the van will reach them, or move it to another day."],
    ["van-full", "Capacity", "Van full", "Yes", "ugly", 0, "Reschedule + Move to another van", "now", "It never left the dock. Put it on the other van or tomorrow's first round."],
    ["insufficient-capacity", "Capacity", "Over capacity", "Yes", "bad", 0, "Reschedule + Move to another van", "next-trip", "Move what doesn't fit to another van or round."],
    ["wrong-loading", "Warehouse", "Wrong load", "Yes", "bad", 0, "Ask the team", "window", "Fix the load before the van leaves."],
    ["missing-stock", "Warehouse", "Out of stock", "Yes", "bad", 0, "Tell customers + Send on next trip", "next-trip", "Tell the customer, and send it when the stock is in."],
    ["stock-not-loaded", "Warehouse", "Not loaded", "Yes", "bad", 0, "Ask the team + Send on next trip", "next-trip", "Send it on the next trip."],
    ["wrong-batch-loaded", "Warehouse", "Wrong batch", "Yes", "bad", 0, "Ask the team", "window", "Swap the batch before the van leaves."],
    ["dispatch-doc-missing", "Warehouse", "No papers", "Yes", "bad", 0, "Ask the team", "window", "Make the dispatch and the bill before the van leaves."],
    ["cash-unavailable", "Payment", "Cash not ready", "Yes", "bad", 0, "Call the customer + Collect later", "7d", "Collect it on the next delivery, and send the UPI link now."],
    ["upi-failed", "Payment", "UPI failed", "Sometimes", "bad", 0, "Ask the team + Collect later", "settle", "Retry with the shop's QR, or collect it on the next visit."],
    ["cheque-dispute", "Payment", "Cheque", "Yes", "ugly", 0, "Call the customer + Decide on credit", "now", "Call the customer, and hold credit until it clears."],
    ["credit-limit", "Payment", "Credit limit", "Yes", "ugly", 0, "Call the customer + Decide on credit", "now", "Collect part of what they owe at the door before unloading."],
    ["pod-missing", "Documentation", "No proof", "Yes", "bad", 0, "Ask the team", "settle", "Ask the driver for the photo or signature."],
    ["pod-disputed", "Documentation", "Says not received", "Yes", "ugly", 0, "Call the customer + Share proof", "now", "Share the driver's photo and signature with the shop."],
    ["invoice-mismatch", "Documentation", "Bill mismatch", "Yes", "bad", 0, "Fix the order", "settle", "Send the bill for what was delivered."],
    ["gst-mismatch", "Documentation", "GST", "Yes", "bad", 0, "Fix customer details", "settle", "Correct their billing details before the bill goes."],
    ["saleable-return", "Returns", "Returned", "Yes", "good", 0, "Take it back", "settle", "Take it back into stock at settlement."],
    ["damaged-return", "Returns", "Damaged return", "Yes", "bad", 0, "Raise credit note + Write it off", "7d", "Credit the customer and write it off, or claim it from the supplier."],
    ["expiry-return", "Returns", "Expired return", "Yes", "bad", 0, "Raise credit note + Write it off", "7d", "Credit the customer and write it off."],
    ["wrong-product-return", "Returns", "Wrong item back", "Yes", "bad", 0, "Take it back + Send on next trip", "next-trip", "Take it back into stock and send the right item."],
    ["crates", "Returns", "Crates", "Yes", "good", 0, "Call the shop + Ask the team", "next-trip", "Ask the shop to keep the crates ready for the next trip."],
    /* 25 Sep 2026 (owner): what the person on the ground reports in their
       own words, because it fits none of the above — a bandh, a police stop,
       an abusive customer, a flooded lane, anything uncertain. Its lead is a
       call to whoever raised it; the call either settles it (Mark resolved,
       with what was agreed) or finds it's one of ours (File it as …), and
       it runs that type's own fix from there. "Call me now" is the second
       row: Missed from the start. */
    ["something-else", "Other", "Something else", "Yes", "bad", 0, "Call the driver + Mark resolved", "30min", "Read what they sent, then call them. Settle it on the call, or file it as what it turns out to be."],
    ["something-urgent", "Other", "Urgent · call", "Urgent", "ugly", 0, "Call the driver + Mark resolved", "now", "They asked for a call now. Call them first, then settle it or file it as what it is."],
  ];
  const VAN_TYPES = { breakdown: 1, accident: 1, puncture: 1, fridge: 1, "driver-delayed": 1, "traffic-delay": 1, "road-closure": 1, "route-deviation": 1 };

  /* ── the sixteen lead actions (spec §6) ─────────────────────────────── */
  const ACTIONS = {
    reschedule:  { label: "Reschedule", group: "When", proof: "delivered" },
    retry:       { label: "Try again today", group: "When", proof: "delivered" },
    move:        { label: "Move to another van", group: "When", proof: "delivered" },
    tell:        { label: "Tell customers", group: "When", proof: "delivered" },
    send:        { label: "Send on next trip", group: "Goods", proof: "delivered-later" },
    takeBack:    { label: "Take it back", group: "Goods", proof: "settled" },
    cancel:      { label: "Cancel delivery", group: "Goods", proof: "now" },
    writeOff:    { label: "Write it off", group: "Goods", proof: "now" },
    fixOrder:    { label: "Fix the order", group: "Order", proof: "delivered" },
    fixCustomer: { label: "Fix customer details", group: "Customer", proof: "next" },
    adjust:      { label: "Review adjustment", group: "Money", proof: "now" },
    creditNote:  { label: "Raise credit note", group: "Money", proof: "now" },
    collectLater:{ label: "Collect later", group: "Money", proof: "now" },
    credit:      { label: "Decide on credit", group: "Money", proof: "delivered" },
    ask:         { label: "Ask the team", group: "People", proof: "answer" },
    proof:       { label: "Share proof", group: "Proof", proof: "accepted" },
    close:       { label: "Close it", group: "People", proof: "now" },
    /* 25 Sep 2026: Something else — settled on the call, in the owner's own
       words; or found to be one of ours and re-filed as it. */
    resolve:     { label: "Mark resolved", group: "People", proof: "now" },
    reclassify:  { label: "File it as…", group: "People", proof: "none" },
  };
  const BY_LABEL = {};
  Object.keys(ACTIONS).forEach(function (k) { BY_LABEL[ACTIONS[k].label] = k; });

  const CATALOG = {};
  ROWS.forEach(function (r) {
    CATALOG[r[0]] = { id: r[0], family: r[1], label: r[2], attention: r[3], starts: r[4], line: r[5], clock: r[7], rec: r[8], van: !!VAN_TYPES[r[0]],
      buttons: r[6].split(" + ").map(function (b) {
        return /^Call /.test(b) ? { id: "call", label: b, who: /driver/.test(b) ? "driver" : "shop" } : { id: BY_LABEL[b], label: b };
      }) };
  });

  /* When the first step is a call: "What did they say?", and the action the
     answer opens, already filled in (spec §6). */
  const OUTCOMES = {
    "shop-closed": [["Opens later today", "retry", { after: "later" }], ["Tomorrow", "reschedule", { day: 1 }], ["Doesn't want it", "cancel", { why: "Doesn't want it" }], ["Couldn't reach", "reschedule", { day: 1, note: "Couldn't reach the shop." }]],
    "customer-unavailable": [["Back soon", "retry", { after: "next" }], ["Tomorrow", "reschedule", { day: 1 }], ["Couldn't reach", "retry", { after: "end" }]],
    "customer-refused": [["Another day", "reschedule", { day: 1 }], ["Wants changes", "fixOrder", {}], ["Price problem", "adjust", {}], ["Doesn't want it", "cancel", { why: "Doesn't want it" }]],
    "window-missed": [["Still wants it today", "tell", {}], ["Tomorrow", "reschedule", { day: 1 }]],
    "order-dispute": [["Order is right", "close", { how: "agreed" }], ["Needs fixing", "fixOrder", {}], ["Cancel it", "cancel", { why: "Doesn't want it" }]],
    "quality-complaint": [["Replace it", "send", {}], ["Credit it", "creditNote", {}], ["Settled on the call", "close", { how: "settled" }]],
    "cash-unavailable": [["Pays on a date", "collectLater", {}], ["Won't pay", "credit", {}]],
    "cheque-dispute": [["Pays on a date", "collectLater", {}], ["Won't pay", "credit", {}]],
    "credit-limit": [["Will pay at the door", "credit", { decision: "first" }], ["Can't pay today", "credit", { decision: "once" }]],
    "wrong-address": [["Gave the new address", "fixCustomer", {}], ["Couldn't reach", "reschedule", { day: 1 }]],
    "address-inaccessible": [["Will meet the van", "retry", { after: "next" }], ["Tomorrow", "reschedule", { day: 1 }]],
    "pod-disputed": [["Wants the proof", "proof", {}], ["Found it", "close", { how: "agreed" }]],
    "price-dispute": [["They're right", "adjust", { decision: "once" }], ["Pay the balance", "adjust", { decision: "refuse" }]],
    "scheme-dispute": [["They're right", "adjust", { decision: "once" }], ["Pay the balance", "adjust", { decision: "refuse" }]],
    "crates": [["Keeping them ready", "close", { how: "agreed" }], ["Lost some", "writeOff", {}]],
    /* "none": the call is logged and the card waits — Call again. */
    "something-else": [["Sorted on the call", "resolve", {}], ["It's one of ours", "reclassify", {}], ["Couldn't reach them", "none", {}]],
    "something-urgent": [["Sorted on the call", "resolve", {}], ["It's one of ours", "reclassify", {}], ["Couldn't reach them", "none", {}]],
  };
  /* What a Something else can be re-filed as: a type a person on the ground
     would recognise, for the kind of thing it's about. A stop takes the
     customer, order, goods, money and paperwork types; a van (no stop) the
     van, road and warehouse ones. The system's own detectors (late, off
     route, credit limit, GST, bill mismatch, capacity, no proof) aren't
     offered: those are found, not told. */
  const REFILE = {
    stop: ["shop-closed", "customer-unavailable", "customer-refused", "order-changed", "order-dispute", "price-dispute", "scheme-dispute", "partial-acceptance",
           "wrong-address", "address-inaccessible", "no-parking", "access-restriction",
           "wrong-sku", "short-quantity", "substitute-rejected", "damaged-goods", "wrong-batch", "near-expiry", "expired-product", "quality-complaint",
           "cash-unavailable", "upi-failed", "cheque-dispute", "pod-disputed", "saleable-return", "crates"],
    van: ["breakdown", "accident", "puncture", "fridge", "temperature", "traffic-delay", "road-closure",
          "wrong-loading", "missing-stock", "stock-not-loaded", "wrong-batch-loaded", "dispatch-doc-missing", "missing-item", "excess-quantity"],
  };
  const DRIVER_OUTCOMES = [["Moving again soon", "close", { how: "explained" }], ["Needs help", "move", {}]];

  /* What each reason the platform records at the door is, in the catalogue.
     The delivery app's keys and the tower's own words both map. */
  const REASON = {
    "shop closed": "shop-closed", shop_closed: "shop-closed",
    "owner away": "customer-unavailable", owner_away: "customer-unavailable", "customer unavailable": "customer-unavailable",
    /* Skip Stop's "Other" was filed as Not available, which it often isn't
       (25 Sep 2026): it is what it says — something else, for a call. */
    other: "something-else",
    refused: "customer-refused",
    "payment not ready": "cash-unavailable",
    "van full": "van-full",
    "wrong address": "wrong-address", wrong_address: "wrong-address",
    "can't reach shop": "address-inaccessible", cant_reach: "address-inaccessible",
    /* "No order with them" (removed 24 Sep 2026): the customer says it isn't
       theirs, which is an order dispute. Kept so older records still read. */
    "no order with them": "order-dispute", no_order: "order-dispute",
    "fully stocked": "order-changed", fully_stocked: "order-changed", "will order later": "order-changed", will_order_later: "order-changed",
    "order dispute": "order-dispute", "credit limit": "credit-limit",
  };
  const RETURN = { damaged: "damaged-goods", expired: "expired-product", unsold: "saleable-return", wrong_product: "wrong-sku", "wrong product": "wrong-sku",
                   leaking: "leaking", wet: "wet-carton", "wet carton": "wet-carton", broken: "broken-pack", "broken pack": "broken-pack",
                   /* 24 Sep 2026: three more the Product Return screen now offers directly. */
                   substitute: "substitute-rejected", wrong_batch: "wrong-batch", "wrong batch": "wrong-batch", near_expiry: "near-expiry", "near expiry": "near-expiry" };
  /* The same fact, returned after an earlier delivery rather than at today's
     drop, is the Returns-family row instead of the Product-family one — the
     goods are the same, but nothing is being delivered today to hold it to
     (owner, 24 Sep 2026). */
  const RETURN_STANDALONE = { "damaged-goods": "damaged-return", "expired-product": "expiry-return", "wrong-sku": "wrong-product-return" };
  /* The tags records carried before the catalogue (23 Sep 2026). */
  const ALIAS = { missed: "customer-unavailable", late: "window-missed", short: "short-quantity", returned: "saleable-return", damaged: "damaged-goods", crates: "crates" };
  const typeOf = function (t) { return CATALOG[t] ? t : ALIAS[t] || null; };
  const DISPUTE = { order: "order-dispute", price: "price-dispute", scheme: "scheme-dispute", quality: "quality-complaint", pod: "pod-disputed",
                    /* 24 Sep 2026: "What's wrong here?" grew two Location reasons. */
                    parking: "no-parking", hours: "access-restriction" };
  const PROBLEM = { breakdown: "breakdown", accident: "accident", puncture: "puncture", fridge: "fridge",
                    /* 24 Sep 2026: Report a problem grew a cold-chain and two road reasons. */
                    temperature: "temperature", traffic: "traffic-delay", road: "road-closure" };
  const LOAD_ISSUE = { stock: "stock-not-loaded", wrong: "wrong-loading", batch: "wrong-batch-loaded" };
  /* Under-loaded splits on its own: none of it on the van at all is the
     warehouse never had it (Missing stock); some of it, less than planned,
     is the van left without the rest (Stock not loaded) — 24 Sep 2026. */
  const loadIssueType = function (m) { return m.reason === "stock" ? (Number(m.loaded) > 0 ? "stock-not-loaded" : "missing-stock") : LOAD_ISSUE[m.reason] || "wrong-loading"; };

  /* ── small words ─────────────────────────────────────────────────────── */
  function rupees(n) {
    const v = Math.round(Number(n) || 0), s = String(Math.abs(v));
    const last = s.slice(-3), rest = s.slice(0, -3);
    return (v < 0 ? "−" : "") + "₹" + (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last : last);
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }
  function clock(ms) {
    const d = new Date(ms + IST);
    let h = d.getUTCHours(); const m = d.getUTCMinutes(), pm = h >= 12;
    h = h % 12 || 12;
    return h + ":" + String(m).padStart(2, "0") + " " + (pm ? "pm" : "am");
  }
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  /* Days are the records' own (UTC dates, as the route and the store keep them); times are read in IST. */
  function dayIso(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function istAt(iso, h) { return new Date(iso + "T00:00:00Z").getTime() + h * HOUR - IST; }
  function dayWord(iso, today) {
    if (iso === today) return "Today";
    const d = new Date(iso + "T00:00:00Z");
    if (iso === dayIso(istAt(today, 12) + DAY)) return "Tomorrow";
    return WD[d.getUTCDay()] + ", " + d.getUTCDate() + " " + MO[d.getUTCMonth()];
  }
  const WIN = { morning: ["Morning", 8, 12], afternoon: ["Afternoon", 12, 16], evening: ["Evening", 16, 20] };
  const norm = function (s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); };

  /* ════════════════════════════════════════════════════════════════════
     derive(input) → { subjects, incidents, roots, byId, atRisk }

     input: { st (state: customerById, phoneById, customers), rec (records:
     deliveries, route, events), now, pending (orders still to deliver:
     made in FoodBridge, and today's route), owed (customerId → ₹ owed),
     limit (customerId → credit limit, or null) }
     ════════════════════════════════════════════════════════════════════ */
  function derive(input) {
    const st = input.st || {}, rec = input.rec || {}, now = input.now;
    const today = dayIso(now);
    const endOf = function (iso) { return istAt(iso, T.END_H); };
    const nameOf = function (id) { return (st.customerById || {})[id] || id; };
    const idByName = {};
    Object.keys(st.customerById || {}).forEach(function (id) { idByName[norm(st.customerById[id])] = id; });
    const route = rec.route && rec.route.day === today ? rec.route : null;
    const events = (rec.events || []).slice().sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : 0; });
    const vansByName = {};
    if (route) route.stops.forEach(function (s) { if (s.van && !vansByName[s.van]) vansByName[s.van] = { van: s.van, driver: s.driver || null, phone: s.driverPhone || null }; });
    if (route) (route.spares || []).forEach(function (v) { vansByName[v.van] = { van: v.van, driver: v.driver || null, phone: v.driverPhone || null }; });
    /* A van the route doesn't list is known by what its driver sends: the
       delivery app says who is driving and their number (25 Sep 2026), so a
       call to the driver dials. */
    events.forEach(function (ev) {
      const sj = ev.subject || {};
      if (!sj.van || !sj.driverPhone) return;
      const v = vansByName[sj.van] = vansByName[sj.van] || { van: sj.van, driver: null, phone: null };
      v.driver = v.driver || ev.by || null; v.phone = v.phone || sj.driverPhone;
    });

    /* ── subjects: one per delivery the owner is responsible for today ─── */
    const subjects = [], byKey = {};
    function subject(key, base) {
      if (byKey[key]) return Object.assign(byKey[key], base && Object.assign({}, base, { title: byKey[key].title || base.title }));
      const s = Object.assign({ key: key, kind: "stop", status: "pending", incidents: [], records: [] }, base);
      byKey[key] = s; subjects.push(s);
      return s;
    }
    (input.pending || []).forEach(function (o) {
      subject(o.no, { customerId: o.customerId, title: o.customer || nameOf(o.customerId), value: typeof o.amount === "number" ? o.amount : null,
        slot: o.slot || null, van: o.van || null, driver: o.driver || null, driverPhone: o.driverPhone || null, cases: o.cases || null,
        delayWhy: o.delayWhy || null, stop: o, orderNo: o.no, onRoute: !!o.slot, made: !o.slot });
    });
    /* Every stop of today's route is a delivery due today, recorded or not. */
    if (route) route.stops.forEach(function (s) {
      subject(s.no, { customerId: s.customerId, title: nameOf(s.customerId), value: s.value || null, slot: s.slot, van: s.van || null,
        driver: s.driver || null, driverPhone: s.driverPhone || null, cases: s.cases || null, stop: s, orderNo: s.no, onRoute: true });
    });
    /* Delivery records: today's, and any missed one still open from before. */
    const allDl = (rec.deliveries || []).slice().sort(function (a, b) { return a.at < b.at ? -1 : 1; });
    /* A missed delivery from before stays open until the customer's next
       delivery is recorded (it was fixed, one way or another). */
    const superseded = function (d) { return allDl.some(function (x) { return x.customerId === d.customerId && x.at > d.at && x.status !== "missed"; }); };
    const missedBy = {};
    allDl.forEach(function (d) {
      const isToday = String(d.at).slice(0, 10) === today;
      /* A drop recorded without an order number, after a missed one to the
         same customer, is that delivery made after all. */
      const key = d.orderNo || (d.status !== "missed" && missedBy[d.customerId]) || d.no;
      if (!d.orderNo && d.status === "missed") missedBy[d.customerId] = d.no;
      if (!isToday && !byKey[key]) {
        if (d.status !== "missed" || superseded(d)) return;
        if (d.rescheduledFor && d.rescheduledFor < today) return;
      }
      const s = subject(key, { customerId: d.customerId, title: nameOf(d.customerId), orderNo: d.orderNo || null,
        value: d.value || (byKey[key] && byKey[key].value) || null, van: d.van || (byKey[key] && byKey[key].van) || null,
        driver: d.driver || (byKey[key] && byKey[key].driver) || null, driverPhone: d.driverPhone || (byKey[key] && byKey[key].driverPhone) || null });
      s.records.push(d);
      s.last = d;
      s.status = d.status === "missed" ? "missed" : "delivered";
      s.at = d.at;
      if (!isToday) s.carried = true;
    });

    /* ── incidents ───────────────────────────────────────────────────── */
    const incidents = [], byId = {};
    function open(id, type, subj, o) {
      if (byId[id]) return byId[id];
      const c = CATALOG[type];
      if (!c) return null;
      const inc = Object.assign({ id: id, type: type, cat: c, subject: subj ? subj.key : null, customerId: subj ? subj.customerId : null,
        title: subj ? subj.title : (o && o.title) || "", van: subj ? subj.van : null, driver: subj ? subj.driver : null,
        driverPhone: subj ? subj.driverPhone : null, state: "open", trail: [], facts: {}, impact: { rupees: 0, cases: 0, stops: 1, minutes: 0 },
        children: [], parent: null, answer: null }, o || {});
      inc.trail.push({ at: inc.at, step: "captured", text: inc.capturedText || "Recorded" });
      inc.trail.push({ at: inc.at, step: "tagged", text: "Tagged " + c.label });
      inc.due = dueOf(inc, subj);
      incidents.push(inc); byId[id] = inc;
      if (subj) subj.incidents.push(inc);
      return inc;
    }
    function dueOf(inc, subj) {
      const at = new Date(inc.at).getTime();
      const iso = dayIso(at);
      switch (inc.cat.clock) {
        case "route-end": case "settle": return endOf(iso);
        case "next-trip": return istAt(dayIso(at + DAY), T.TRIP_H);
        case "window": return subj && subj.slot ? new Date(subj.slot).getTime() + T.LATE_MIN * MIN : at + HOUR;
        case "30min": return at + 30 * MIN;
        case "7d": return at + 7 * DAY;
        default: return null;
      }
    }
    const who = function (d) { return d.driver ? d.driver + (d.van ? ", " + d.van : "") : d.van || "the driver"; };

    /* From the records at the door. */
    subjects.forEach(function (s) {
      s.records.forEach(function (d) {
        const at = d.at, by = d.driver || null;
        const base = { at: at, by: by, where: "Delivery app", how: "driver", record: d };
        const val = Number(d.value) || Number(s.value) || 0;
        if (d.status === "missed") {
          const type = typeOf(d.incident) && d.incident !== "missed" ? typeOf(d.incident) : REASON[norm(d.reason)] || REASON[String(d.reason || "").toLowerCase()] || "customer-unavailable";
          const inc = open("dl:" + d.no, type, s, Object.assign(base, {
            how: type === "van-full" ? "system" : "driver",
            capturedText: type === "van-full" ? "Left at the dock: " + (d.van || "the van") + " was full" : (by ? by + " marked it " : "Marked ") + (d.reason || CATALOG[type].label),
            facts: { reason: d.reason || null, note: d.note || null }, impact: { rupees: val, cases: Number(d.cases) || Number(s.cases) || 0, stops: 1, minutes: 0 } }));
          if (d.rescheduledFor) inc.legacy = { date: d.rescheduledFor, window: d.rescheduledWindow || null, at: d.rescheduledAt || at };
          return;
        }
        /* Delivered: what went wrong with it, one incident each. */
        const lateMin = Number(d.lateMin) || 0;
        if (lateMin > T.LATE_MIN) {
          const inc = open("late:" + d.no, "window-missed", s, Object.assign({}, base, { how: "system", capturedText: "Reached " + lateMin + " min after its time",
            facts: { lateMin: lateMin, why: d.lateWhy || null }, impact: { rupees: 0, cases: 0, stops: 1, minutes: lateMin } }));
          inc.state = "resolved"; inc.proof = { at: at, text: "Delivered " + clock(new Date(at).getTime()) + ", " + lateMin + " min late" };
        }
        if (Number(d.shortCases) > 0) open("short:" + d.no, "short-quantity", s, Object.assign({}, base, { how: "system",
          capturedText: "Loaded " + plural(Number(d.shortCases), "case") + " short of the booking",
          facts: { cases: Number(d.shortCases) }, impact: { rupees: Math.round(val * Number(d.shortCases) / Math.max(1, Number(d.cases) || Number(s.cases) || 6)), cases: Number(d.shortCases), stops: 1, minutes: 0 } }));
        if (Number(d.returnedCases) > 0) {
          const type = RETURN[norm(d.returnDetail)] || RETURN[norm(d.returnReason)] || typeOf(d.incident) || "saleable-return";
          const cases = Number(d.returnedCases);
          open("ret:" + d.no, type, s, Object.assign({}, base, {
            capturedText: (by ? by + " took back " : "Took back ") + plural(cases, "case") + (d.returnReason ? " · " + String(d.returnReason).toLowerCase() : ""),
            facts: { cases: cases, reason: d.returnReason || null, detail: d.returnDetail || null, items: d.returnItems || null },
            impact: { rupees: Number(d.returnValue) || Math.round(val * cases / Math.max(1, Number(d.cases) || Number(s.cases) || 6)), cases: cases, stops: 1, minutes: 0 } }));
        }
        if (d.dispute) open("dsp:" + d.no, DISPUTE[d.dispute.kind] || "order-dispute", s, Object.assign({}, base, {
          capturedText: (by || "The driver") + " noted: " + (d.dispute.why || "the customer disputes it"),
          facts: d.dispute, impact: { rupees: Number(d.dispute.gap) || val, cases: 0, stops: 1, minutes: 0 } }));
        const e = d.empties || {};
        const cratesOut = Math.max(0, (Number(e.cratesOut) || 0) - (Number(e.cratesBack) || 0));
        if (cratesOut) open("crates:" + d.no, "crates", s, Object.assign({}, base, { capturedText: plural(cratesOut, "crate") + " not back",
          facts: { crates: cratesOut }, impact: { rupees: 0, cases: 0, stops: 1, minutes: 0 } }));
        const tagged = typeOf(d.incident);
        if (tagged && !byId["inc:" + d.no] && ["short-quantity", "window-missed", "crates"].indexOf(tagged) === -1 && !Number(d.returnedCases)) {
          open("inc:" + d.no, tagged, s, Object.assign({}, base, { capturedText: "Tagged at the door", impact: { rupees: val, cases: 0, stops: 1, minutes: 0 } }));
        }
      });
    });

    /* From the event stream: what the platform's screens recorded. */
    function subjectOf(ev) {
      const sj = ev.subject || {};
      if (sj.stopNo && byKey[sj.stopNo]) return byKey[sj.stopNo];
      if (sj.orderNo && byKey[sj.orderNo]) return byKey[sj.orderNo];
      const cid = sj.customerId || idByName[norm(sj.customer)];
      if (cid) {
        const hit = subjects.filter(function (s) { return s.customerId === cid && s.kind === "stop"; });
        if (hit.length) return hit[hit.length - 1];
        return subject("cust:" + cid, { customerId: cid, title: nameOf(cid), value: Number((ev.data || {}).value) || null, van: sj.van || null,
          driver: ev.by || null, external: true });
      }
      if (sj.customer) return subject("ext:" + norm(sj.customer), { title: sj.customer, value: Number((ev.data || {}).value) || null, van: sj.van || null,
        driver: ev.by || null, driverPhone: sj.driverPhone || null, external: true, where: ev.where || null });
      return null;
    }
    const vanRoots = {};
    function vanRoot(id, type, van, o) {
      const v = vansByName[van] || { van: van };
      const inc = open(id, type, null, Object.assign({ kind: "van", title: van,   /* the tag says what happened to it */
        van: van, driver: v.driver || null, driverPhone: v.phone || null }, o));
      if (inc) { inc.kind = "van"; vanRoots[van] = vanRoots[van] || []; if (vanRoots[van].indexOf(inc) < 0) vanRoots[van].push(inc); }
      return inc;
    }
    events.forEach(function (ev) {
      const at = ev.at, data = ev.data || {};
      const base = { at: at, by: ev.by || null, where: ev.where || "Delivery app", how: ev.how || "driver", event: ev };
      const t = ev.type;
      if (t === "stop.skipped") {
        const s = subjectOf(ev); if (!s) return;
        s.status = "missed"; s.at = at;
        const type = REASON[norm(data.reason)] || REASON[String(data.reason || "").toLowerCase()] || "customer-unavailable";
        open("ev:" + ev.id, type, s, Object.assign(base, { capturedText: (ev.by ? ev.by + " marked it " : "Marked ") + (data.label || data.reason),
          facts: { reason: data.label || data.reason, note: data.note || null }, impact: { rupees: Number(data.value) || Number(s.value) || 0, cases: 0, stops: 1, minutes: 0 } }));
      } else if (t === "return.recorded") {
        const s = subjectOf(ev); if (!s) return;
        if (s.status !== "missed") s.status = "delivered";
        let type = RETURN[norm(data.detail)] || RETURN[norm(data.reason)] || "saleable-return";
        /* Goods back with nothing delivered today (a standalone pickup, not
           today's drop) are the Returns-family row instead — the same fact,
           but there's no delivery here to hold it against (24 Sep 2026). */
        if (data.standalone && RETURN_STANDALONE[type]) type = RETURN_STANDALONE[type];
        const units = (data.items || []).reduce(function (n, x) { return n + (Number(x.qty) || 0); }, 0);
        open("ev:" + ev.id, type, s, Object.assign(base, { capturedText: (ev.by ? ev.by + " took back " : "Took back ") + plural(units || 1, "unit") + " · " + String(data.detail || data.reason || "").toLowerCase().replace(/_/g, " "),
          facts: { items: data.items || [], reason: data.reason, detail: data.detail || null }, impact: { rupees: Number(data.value) || 0, cases: 0, stops: 1, minutes: 0 } }));
      } else if (t === "stop.itemsEdited") {
        const s = subjectOf(ev); if (!s) return;
        const less = Number(data.delivered) < Number(data.booked);
        /* 24 Sep 2026: the driver now says why it's less — the shop took
           less (Part accepted) or the van didn't have enough (Short). */
        const type = data.why === "short" || data.why === "stock" ? "short-quantity" : less ? "partial-acceptance" : "order-changed";
        open("ev:" + ev.id, type, s, Object.assign(base, {
          capturedText: (ev.by || "The driver") + " changed the order at the door: " + rupees(data.booked) + " → " + rupees(data.delivered),
          facts: data, impact: { rupees: Math.abs(Number(data.booked) - Number(data.delivered)) || 0, cases: 0, stops: 1, minutes: 0 } }));
      } else if (t === "dispute.raised") {
        const s = subjectOf(ev); if (!s) return;
        const type = DISPUTE[data.kind] || "order-dispute";
        if (type === "order-dispute" || type === "pod-disputed") { if (s.status !== "delivered" || type === "order-dispute") s.status = type === "order-dispute" ? "missed" : s.status; }
        open("ev:" + ev.id, type, s, Object.assign(base, { capturedText: (ev.by ? ev.by + ": " : "") + (data.why || "the customer disputes it"),
          facts: data, impact: { rupees: Number(data.gap) || Number(data.value) || Number(s.value) || 0, cases: 0, stops: 1, minutes: 0 } }));
      } else if (t === "payment.adjusted") {
        const s = subjectOf(ev); if (!s) return;
        open("ev:" + ev.id, data.kind === "scheme" ? "scheme-dispute" : "price-dispute", s, Object.assign(base, {
          capturedText: (ev.by || "The driver") + " took " + rupees(data.paid) + " of " + rupees(data.billed) + " and adjusted the rest as an offer",
          facts: data, impact: { rupees: Number(data.gap) || 0, cases: 0, stops: 1, minutes: 0 } }));
      } else if (t === "payment.failed") {
        const s = subjectOf(ev); if (!s) return;
        /* 24 Sep 2026: not just UPI — cash not ready, and a cheque disputed,
           each land under their own tag now. */
        const type = data.method === "CASH" ? "cash-unavailable" : data.method === "CHEQUE" ? "cheque-dispute" : "upi-failed";
        const said = { CASH: "No cash ready at the door", CHEQUE: "The cheque is disputed" }[data.method] || "UPI didn't go through at the door";
        open("ev:" + ev.id, type, s, Object.assign(base, { capturedText: said, facts: data,
          impact: { rupees: Number(data.amount) || 0, cases: 0, stops: 1, minutes: 0 } }));
      } else if (t === "pod.captured") {
        const s = subjectOf(ev); if (s) s.podCaptured = true;
      } else if (t === "stop.delivered") {
        /* 24 Sep 2026: the fact a real drop closes on — nothing else in the
           driver app ever said a delivery actually happened. Without this,
           no incident whose proof is "delivered" can ever resolve. */
        const s = subjectOf(ev); if (!s) return;
        const rec = { at: at, driver: ev.by || null, status: "delivered", value: Number(data.value) || Number(s.value) || 0,
          collected: Number(data.collected) || 0, nextOrder: !!data.nextOrder, empties: data.empties || null, orderNo: s.orderNo || null, fromEvent: true };
        s.records.push(rec); s.last = rec; s.status = "delivered"; s.at = at;
        const e = rec.empties || {};
        const cratesOut = Math.max(0, (Number(e.cratesOut) || 0) - (Number(e.cratesBack) || 0));
        if (cratesOut) open("crates:ev:" + ev.id, "crates", s, Object.assign({}, base, { capturedText: plural(cratesOut, "crate") + " not back",
          facts: { crates: cratesOut }, impact: { rupees: 0, cases: 0, stops: 1, minutes: 0 } }));
      } else if (t === "assets.recorded") {
        /* 24 Sep 2026: crates are recorded in the delivery app's Manage
           Assets, with every other returnable — crates left with the shop
           against crates brought back. More out than back is crates not back. */
        const s = subjectOf(ev); if (!s) return;
        const e = data.empties || {};
        const cratesOut = Math.max(0, (Number(e.cratesOut) || 0) - (Number(e.cratesBack) || 0));
        if (cratesOut) open("crates:ev:" + ev.id, "crates", s, Object.assign({}, base, { capturedText: plural(cratesOut, "crate") + " not back",
          facts: { crates: cratesOut }, impact: { rupees: 0, cases: 0, stops: 1, minutes: 0 } }));
      } else if (t === "loadstock.checked") {
        /* 24 Sep 2026: Load Stock now says what didn't match the plan, and
           whether the dispatch papers are ready — a van-level fact, like a
           problem on the road. */
        const van = (ev.subject || {}).van || "Van";
        (data.mismatches || []).forEach(function (m, i) {
          const type = loadIssueType(m);
          const s = subject("load:" + van + ":" + dayIso(at) + ":" + i, { kind: "count", title: van + " load check", van: van, driver: ev.by || null, status: "delivered", at: at });
          open("ev:" + ev.id + ":" + i, type, s, Object.assign({}, base, {
            capturedText: m.reason === "batch" ? "A batch on the van isn't the one ordered" : m.name + ": loaded " + m.loaded + " of " + m.plan + " planned",
            facts: m, impact: { rupees: 0, cases: Math.max(0, (Number(m.plan) || 0) - (Number(m.loaded) || 0)), stops: 0, minutes: 0 } }));
        });
        if (data.dispatchDocsReady === false) {
          const ds = subject("dispatchdoc:" + van + ":" + dayIso(at), { kind: "count", title: van + " dispatch papers", van: van, driver: ev.by || null, status: "delivered", at: at });
          open("ev:" + ev.id + ":doc", "dispatch-doc-missing", ds, Object.assign({}, base, { capturedText: "Dispatch papers not ready when " + van + " left the dock" }));
        }
      } else if (t === "count.submitted") {
        const van = (ev.subject || {}).van || "Van";
        (data.mismatches || []).forEach(function (m, i) {
          const key = "count:" + van + ":" + dayIso(new Date(at).getTime());
          const s = subject(key, { kind: "count", title: van + " stock count", van: van, driver: ev.by || null, status: "delivered", counted: true, at: at });
          const excess = Number(m.diff) > 0;
          open("ev:" + ev.id + ":" + i, excess ? "excess-quantity" : "missing-item", s, Object.assign({}, base, {
            capturedText: "Counted " + m.actual + " " + m.name + ", expected " + m.expected + (data.note ? " · " + data.note : ""),
            facts: m, impact: { rupees: Math.abs(Number(m.value) || 0), cases: Math.abs(Number(m.diff) || 0), stops: 0, minutes: 0 } }));
        });
      } else if (t === "problem.reported") {
        const type = PROBLEM[data.kind] || "breakdown";
        const van = (ev.subject || {}).van;
        if (van) vanRoot("ev:" + ev.id, type, van, Object.assign(base, { capturedText: (ev.by || "The driver") + " reported: " + CATALOG[type].label.toLowerCase() + (data.where ? " at " + data.where : ""),
          facts: data }));
      } else if (t === "report.raised") {
        /* Something else (25 Sep 2026): the reporter's own words, the photos
           they took, and whether they want a call now. At a shop it sits on
           that delivery; on the road it is the van's own row, holding
           nothing (it isn't known to stop anything). */
        const type = data.urgent ? "something-urgent" : "something-else";
        const words = String(data.text || "").trim();
        const photos = data.photos || [];
        const said = words ? words : plural(photos.length || 1, "photo") + ", no words";
        const facts = { text: words || null, photos: photos, urgent: !!data.urgent, scope: data.scope || ((ev.subject || {}).customer ? "stop" : "van"), value: Number(data.value) || null };
        let s = (ev.subject || {}).customer ? subjectOf(ev) : null;
        const van = (ev.subject || {}).van || "Van";
        if (!s) s = subject("report:" + ev.id, { kind: "count", title: van + " · on the road", van: van, driver: ev.by || null, status: "delivered", at: at });
        const vv = vansByName[van] || {};
        open("ev:" + ev.id, type, s, Object.assign(base, { capturedText: (ev.by ? ev.by + ": " : "") + said, facts: facts,
          driver: ev.by || vv.driver || null, van: van, driverPhone: (ev.subject || {}).driverPhone || vv.phone || null,
          impact: { rupees: 0, cases: 0, stops: facts.scope === "stop" ? 1 : 0, minutes: 0 } }));
      } else if (t === "credit.over") {
        const s = subjectOf(ev); if (!s) return;
        open("ev:" + ev.id, "credit-limit", s, Object.assign(base, { how: "system", capturedText: "Owes " + rupees(data.owed) + " against a " + rupees(data.limit) + " limit",
          facts: data, impact: { rupees: Number(s.value) || 0, cases: 0, stops: 1, minutes: 0 } }));
      }
    });

    /* ── detectors: what the system sees on its own ───────────────────── */
    /* Credit limit: a stop today for a customer already over their limit. */
    if (input.limit && input.owed) subjects.forEach(function (s) {
      if (s.status !== "pending" || !s.customerId || !s.onRoute) return;
      const lim = input.limit(s.customerId), owed = input.owed[s.customerId] || 0;
      if (!lim || owed <= lim) return;
      open("credit:" + s.key, "credit-limit", s, { at: new Date(Math.min(now, new Date(s.slot || now).getTime() - 2 * HOUR)).toISOString(), how: "system", where: "FoodBridge",
        capturedText: "Owes " + rupees(owed) + " against a " + rupees(lim) + " credit limit", facts: { owed: owed, limit: lim, ask: Math.max(0, Math.ceil((owed - lim) / 100) * 100) },
        impact: { rupees: Number(s.value) || 0, cases: 0, stops: 1, minutes: 0 } });
    });

    /* GST: a customer's saved GSTIN that doesn't parse, with a stop due today. */
    if (input.gstinById) subjects.forEach(function (s) {
      if (s.status !== "pending" || !s.customerId || !s.onRoute) return;
      const gstin = input.gstinById[s.customerId];
      if (!gstin || /^[0-9A-Z]{15}$/i.test(gstin)) return;
      open("gst:" + s.key, "gst-mismatch", s, { at: new Date(now).toISOString(), how: "system", where: "FoodBridge",
        capturedText: "GSTIN on file doesn't parse: " + gstin, facts: { gstin: gstin }, impact: { rupees: 0, cases: 0, stops: 1, minutes: 0 } });
    });

    /* Capacity: a van booked past the cases it can carry. */
    if (input.vanCapacity && route) {
      const byVan = {};
      route.stops.forEach(function (s) { if (s.van) (byVan[s.van] = byVan[s.van] || []).push(s); });
      Object.keys(byVan).forEach(function (van) {
        const cap = input.vanCapacity[van];
        if (!cap) return;
        const cases = byVan[van].reduce(function (n, s) { return n + (Number(s.cases) || 0); }, 0);
        if (cases <= cap) return;
        const cs = subject("capacity:" + van + ":" + today, { kind: "count", title: van + " load", van: van, status: "delivered" });
        open("cap:" + van + ":" + today, "insufficient-capacity", cs, { at: new Date(Math.min(now, endOf(today) - 3 * HOUR)).toISOString(), how: "system", where: "FoodBridge",
          capturedText: van + " is booked for " + cases + " cases, " + (cases - cap) + " over its capacity of " + cap,
          facts: { cases: cases, capacity: cap }, impact: { rupees: 0, cases: cases - cap, stops: byVan[van].length, minutes: 0 } });
      });
    }

    /* The detectors below read what the delivery app recorded (a drop, an
       edit, a photo), so they run here — before what was done is applied,
       or an owner's action on them would find no incident to land on. */

    /* POD missing: delivered through the app's own "stop.delivered" fact
       (not an import or a demo record, which never modelled proof at all),
       with no photo or signature on it. Proof can be added any time until
       the route settles; only a route that has ended without it is missing
       it (spec §7: "The route is settled without it"). */
    subjects.forEach(function (s) {
      if (s.status !== "delivered" || !s.last || !s.last.fromEvent || s.podCaptured || s.cancelled) return;
      if (now < endOf(dayIso(new Date(s.last.at).getTime()))) return;
      open("pod:" + s.key, "pod-missing", s, { at: new Date(endOf(dayIso(new Date(s.last.at).getTime()))).toISOString(), how: "system", where: "Delivery app",
        capturedText: "Delivered with no photo or signature on file", facts: {}, impact: { rupees: 0, cases: 0, stops: 1, minutes: 0 } });
    });

    /* Route deviation: a stop delivered well out of its planned order on the
       van's round — 3 places or more either way. */
    if (route) {
      const plannedIx = {};
      route.stops.forEach(function (s, i) { plannedIx[s.no] = i; });
      const byVanDev = {};
      subjects.forEach(function (s) {
        if (s.status !== "delivered" || !s.last || !s.last.fromEvent || !s.van || plannedIx[s.key] === undefined) return;
        (byVanDev[s.van] = byVanDev[s.van] || []).push(s);
      });
      Object.keys(byVanDev).forEach(function (van) {
        byVanDev[van].sort(function (a, b) { return a.at < b.at ? -1 : 1; }).forEach(function (s, actualIx) {
          if (Math.abs(actualIx - plannedIx[s.key]) < 3) return;
          open("dev:" + s.key, "route-deviation", s, { at: s.at, how: "system", where: "Live Tracking",
            capturedText: van + " reached " + s.title + " well out of the planned order", facts: { planned: plannedIx[s.key], actual: actualIx },
            impact: { rupees: 0, cases: 0, stops: 1, minutes: 0 } });
        });
      });
    }

    /* Invoice mismatch: the order was changed at the door (the app's Edit
       Order) and then delivered at the changed amount — the bill made from
       the booking no longer matches what was delivered. Closed by Fix the
       order, which re-issues it. */
    subjects.forEach(function (s) {
      if (s.status !== "delivered" || !s.last || !s.last.fromEvent) return;
      const edit = s.incidents.filter(function (i) { return i.event && i.event.type === "stop.itemsEdited" && i.at < s.last.at; }).slice(-1)[0];
      if (!edit) return;
      const f = edit.facts || {};
      open("inv:" + edit.id, "invoice-mismatch", s, { at: s.last.at, how: "system", where: "FoodBridge",
        capturedText: "Billed " + rupees(f.booked) + " at booking, delivered " + rupees(f.delivered) + " after the edit at the door",
        facts: { booked: f.booked, delivered: f.delivered }, impact: { rupees: Math.abs((Number(f.booked) || 0) - (Number(f.delivered) || 0)), cases: 0, stops: 1, minutes: 0 } });
    });

    /* ── what was done, by the owner or on the ground ─────────────────── */
    const moved = {};
    events.forEach(function (ev) {
      const sj = ev.subject || {};
      const inc = sj.incident && byId[sj.incident];
      const at = ev.at, data = ev.data || {};
      if (ev.type === "stops.moved") (data.stops || []).forEach(function (no) { moved[no] = { to: data.to, driver: data.driver || null, at: at }; });
      if (!inc) return;
      if (ev.type === "call.outcome") { inc.trail.push({ at: at, step: "call", text: "Called · " + data.answer, by: ev.by }); return; }
      if (ev.type === "question.answered") { inc.answer = { at: at, text: data.text, by: ev.by }; inc.trail.push({ at: at, step: "answer", text: (ev.by || "The team") + ": " + data.text }); if (inc.state === "acting") inc.state = "open"; inc.answered = true; return; }
      if (ev.type === "customer.accepted") { if (inc.state !== "resolved") resolve(inc, at, (inc.title || "The customer") + " accepted the proof"); return; }
      if (ev.type === "van.moving") { if (inc.state !== "resolved") resolve(inc, at, (inc.van || "The van") + " is moving again"); return; }
      if (ev.type.indexOf("action.") !== 0) return;
      const id = ev.type.slice(7), a = ACTIONS[id];
      if (!a) return;
      const note = ev.note || data.summary || a.label;
      inc.trail.push({ at: at, step: "acted", text: note + (ev.by && ev.by !== "You" ? " · by " + ev.by : ""), by: ev.by });
      inc.actions = (inc.actions || []).concat([{ id: id, at: at, by: ev.by || null, data: data, note: note, where: ev.where || null }]);
      inc.lastAction = inc.actions[inc.actions.length - 1];
      if (id === "cancel") { const cs = byKey[inc.subject]; if (cs) cs.cancelled = true; }
      /* Re-filed: the same incident, now the type it turned out to be, with
         that type's buttons, recommendation and clock from here. */
      if (id === "reclassify") {
        const to = CATALOG[data.to];
        if (!to) return;
        inc.refiledFrom = inc.cat.label; inc.type = data.to; inc.cat = to;
        /* Unknown while it was Something else; as one of ours it has a
           figure — what is due at that shop (the money types read it as the
           amount). */
        const due = inc.facts.value || Number((byKey[inc.subject] || {}).value) || 0;
        if (!inc.impact.rupees && due) {
          inc.impact = Object.assign({}, inc.impact, { rupees: due });
          inc.facts = Object.assign({}, inc.facts, { amount: inc.facts.amount || due });
        }
        inc.trail.push({ at: at, step: "tagged", text: "Filed as " + to.label });
        // Its new clock runs from the re-filing, not from the first report.
        inc.due = dueOf(Object.assign({}, inc, { at: at }), byKey[inc.subject]);
        return;
      }
      if (a.proof === "now" || (id === "adjust") || (id === "collectLater")) return resolve(inc, at, ev.resolved || note);
      if (id === "fixCustomer") { if (ev.resolved) resolve(inc, at, ev.resolved); return; }   // the next action does the rest
      /* The goods are already with the shop: fixing the order re-issues the
         bill, and that is the fix. */
      if (id === "fixOrder" && inc.type === "invoice-mismatch") return resolve(inc, at, "Bill re-issued · " + note);
      inc.state = "acting";
      inc.acting = { id: id, at: at, note: note, data: data, by: ev.by || null };
      inc.due = data.due ? new Date(data.due).getTime() : null;
      if (id === "cancel") { const s = byKey[inc.subject]; if (s) s.cancelled = true; }
    });
    function resolve(inc, at, text) {
      inc.state = "resolved";
      inc.proof = { at: at, text: text };
      inc.trail.push({ at: at, step: "resolved", text: text });
      if (inc.kind === "stop" || !inc.kind) { /* nothing more */ }
    }
    /* Rescheduled from the old reschedule, before the event stream. */
    incidents.forEach(function (inc) {
      if (inc.legacy && inc.state === "open") {
        const w = WIN[inc.legacy.window] || null;
        inc.state = "acting";
        const txt = "Rescheduled · " + dayWord(inc.legacy.date, today) + (w ? " " + w[0].toLowerCase() : "");
        inc.acting = { id: "reschedule", at: inc.legacy.at, note: txt, data: { date: inc.legacy.date, window: inc.legacy.window } };
        inc.trail.push({ at: inc.legacy.at, step: "acted", text: txt });
        inc.due = inc.legacy.date === today && w ? istAt(today, w[2]) : null;
      }
    });

    /* ── moves between vans ─────────────────────────────────────────── */
    Object.keys(moved).forEach(function (no) {
      const s = byKey[no]; if (!s) return;
      const m = moved[no], v = vansByName[m.to] || {};
      s.movedFrom = s.van; s.van = m.to; s.driver = m.driver || v.driver || s.driver; s.driverPhone = v.phone || s.driverPhone; s.movedAt = m.at;
    });

    /* ── the clock on the road: stops past their window ─────────────── */
    const told = {};
    events.forEach(function (ev) { if (ev.type === "action.tell") Object.keys((ev.data || {}).times || {}).forEach(function (no) { told[no] = { at: ev.at, time: ev.data.times[no], by: ev.by }; }); });
    subjects.forEach(function (s) {
      if (s.status !== "pending" || !s.slot || s.cancelled) return;
      const slot = new Date(s.slot).getTime();
      const promised = told[s.key] ? new Date(told[s.key].time).getTime() : null;
      const late = Math.round((now - slot) / MIN);
      if (late <= T.LATE_MIN && !promised) return;
      if (late <= T.LATE_MIN) return;
      const inc = open("late:" + s.key, "window-missed", s, { at: new Date(slot + T.LATE_MIN * MIN).toISOString(), how: "system", where: "Live Tracking",
        capturedText: (s.van || "The van") + " passed this stop's time" + (s.delayWhy ? " · " + s.delayWhy.toLowerCase() : ""),
        facts: { lateMin: late, why: s.delayWhy || null }, impact: { rupees: Number(s.value) || 0, cases: 0, stops: 1, minutes: late } });
      if (promised && inc.state === "open") {
        inc.state = "acting";
        inc.acting = { id: "tell", at: told[s.key].at, note: "Told · new time " + clock(promised), data: { time: told[s.key].time } };
        inc.trail.push({ at: told[s.key].at, step: "acted", text: "Customer told the new time: " + clock(promised) });
        inc.due = promised + T.TOLD_GRACE * MIN;
      }
    });
    /* A van with several stops past their window is running late: one row
       that holds them (rule 6). */
    const lateByVan = {};
    incidents.forEach(function (inc) {
      if (inc.type !== "window-missed" || inc.state === "resolved") return;
      const s = byKey[inc.subject];
      if (!s || s.status !== "pending" || !s.van) return;
      (lateByVan[s.van] = lateByVan[s.van] || []).push(inc);
    });
    Object.keys(lateByVan).forEach(function (van) {
      const kids = lateByVan[van];
      if (kids.length < T.VAN_LATE) return;
      const first = kids.reduce(function (a, b) { return a.at < b.at ? a : b; });
      const s0 = byKey[first.subject];
      const root = vanRoot("vanlate:" + van + ":" + today, "driver-delayed", van, { at: first.at, how: "system", where: "Live Tracking",
        capturedText: van + " is behind its plan" + (s0 && s0.delayWhy ? " · " + s0.delayWhy.toLowerCase() : ""), facts: { why: s0 && s0.delayWhy } });
      kids.forEach(function (k) { k.parent = root.id; if (root.children.indexOf(k.subject) < 0) root.children.push(k.subject); });
    });
    /* A van problem holds every stop the van still has. */
    Object.keys(vanRoots).forEach(function (van) {
      vanRoots[van].forEach(function (root) {
        if (root.type === "driver-delayed") return;
        subjects.forEach(function (s) {
          if (s.status !== "pending" || s.cancelled) return;
          const wasOn = s.van === van || s.movedFrom === van;
          if (!wasOn) return;
          if (s.movedFrom === van && s.movedAt && s.movedAt >= root.at) { root.moved = (root.moved || []).concat([s.key]); return; }   // moved off, fixed
          if (s.van !== van) return;
          if (root.state === "resolved" && root.proof && root.proof.at <= new Date(now).toISOString()) return;
          if (root.children.indexOf(s.key) < 0) root.children.push(s.key);
          s.heldBy = root.id;
        });
      });
    });

    /* ── proof: the platform recorded the fix ───────────────────────── */
    incidents.forEach(function (inc) {
      if (inc.state === "resolved") return;
      const s = inc.subject ? byKey[inc.subject] : null;
      const a = inc.acting && ACTIONS[inc.acting.id];
      const deliveredAfter = function (t) {
        if (!s) return null;
        return s.records.filter(function (d) { return d.status !== "missed" && d.at > t; })[0] || null;
      };
      if (inc.kind === "van") {
        const kids = inc.children.map(function (k) { return byKey[k]; }).filter(Boolean);
        const left = kids.filter(function (k) { return k.status === "pending" && !k.cancelled && (inc.type === "driver-delayed" || k.van === inc.van); });
        if ((kids.length || (inc.moved || []).length) && !left.length) resolve(inc, new Date(now).toISOString(), inc.type === "driver-delayed" ? "Every late stop delivered or moved"
          : (inc.moved || []).length ? plural(inc.moved.length, "stop") + " moved to " + (byKey[inc.moved[0]].van || "another van") : "Every held stop delivered");
        return;
      }
      if (inc.type === "window-missed" && s && s.status !== "pending") {
        const d = s.last;
        if (d && d.status !== "missed") resolve(inc, d.at, "Delivered " + clock(new Date(d.at).getTime()) + (d.driver ? " by " + d.driver : ""));
        return;
      }
      if (!a) {
        /* Missed, then delivered after all (the van went back on its own). */
        if (inc.record && inc.record.status === "missed" && s && s.status === "delivered" && s.last !== inc.record) {
          resolve(inc, s.last.at, "Delivered " + clock(new Date(s.last.at).getTime()) + (s.last.driver ? " by " + s.last.driver : "")); return;
        }
        /* Credit limit settles when the drop happens with the money in. */
        if (inc.type === "credit-limit" && s && s.status === "delivered") resolve(inc, s.at, "Delivered " + clock(new Date(s.at).getTime()));
        return;
      }
      /* A problem found in the van's load (Load Stock, the stock count) has
         no delivery of its own to wait for: the van settling is its proof. */
      if (s && s.kind === "count" && (a.proof === "delivered" || a.proof === "delivered-later")) {
        const end = endOf(dayIso(new Date(inc.acting.at).getTime()));
        if (now >= end) resolve(inc, new Date(end).toISOString(), "Settled at the end of the route · " + inc.acting.note);
        return;
      }
      if (a.proof === "delivered" || a.proof === "delivered-later") {
        const d = deliveredAfter(inc.acting.at);
        if (d && (a.proof === "delivered" || dayIso(new Date(d.at).getTime()) > dayIso(new Date(inc.acting.at).getTime())))
          resolve(inc, d.at, "Delivered " + clock(new Date(d.at).getTime()) + (d.driver ? " by " + d.driver : "") + " · fixed");
      } else if (a.proof === "settled") {
        const end = endOf(dayIso(new Date(inc.acting.at).getTime()));
        if (now >= end) resolve(inc, new Date(end).toISOString(), "Counted back at settlement");
      }
    });

    /* ── standing: three questions and a clock (spec §4) ─────────────── */
    incidents.forEach(function (inc) {
      const s = inc.subject ? byKey[inc.subject] : null;
      inc.standing = standingOf(inc, s, now);
      inc.escalated = inc.standing === "ugly" && inc.cat.starts !== "ugly" && !(s && s.status === "missed");
    });
    incidents.forEach(function (inc) {
      if (inc.kind !== "van") return;
      const kids = inc.children.map(function (k) { return byKey[k]; }).filter(Boolean);
      inc.impact = { rupees: kids.reduce(function (n, k) { return n + (Number(k.value) || 0); }, 0), cases: 0, stops: kids.length, minutes: 0 };
      if (inc.type === "driver-delayed" && inc.state !== "resolved") {
        const kidInc = incidents.filter(function (k) { return k.parent === inc.id && k.state !== "resolved"; });
        inc.standing = kidInc.some(function (k) { return k.standing === "ugly"; }) ? "ugly" : kidInc.length ? "bad" : "good";
        if (kidInc.length && kidInc.every(function (k) { return k.state === "acting"; }) && inc.state === "open") {
          inc.state = "acting";
          inc.acting = { id: "tell", at: kidInc[0].acting.at, note: plural(kidInc.length, "customer") + " told · new times kept", data: {} };
        }
        const worst = kidInc.reduce(function (m, k) { return Math.max(m, k.facts.lateMin || 0); }, 0);
        inc.facts.lateMin = worst;
      }
    });

    /* ── each delivery's standing: its worst open incident ──────────── */
    const RANK = { ugly: 3, bad: 2, good: 1 };
    subjects.forEach(function (s) {
      const held = s.heldBy && byId[s.heldBy];
      const live = s.incidents.filter(function (i) { return i.state !== "resolved"; });
      const lead = live.slice().sort(function (a, b) { return RANK[b.standing] - RANK[a.standing] || (b.impact.rupees || 0) - (a.impact.rupees || 0); })[0] || null;
      const done = s.incidents.filter(function (i) { return i.state === "resolved"; }).sort(function (a, b) { return a.proof.at < b.proof.at ? 1 : -1; })[0] || null;
      s.lead = lead || null;
      s.fixed = !lead && done ? done : null;
      if (held && held.state !== "resolved") { s.standing = held.standing; s.parent = held.id; }
      else if (lead && lead.parent && byId[lead.parent] && byId[lead.parent].state !== "resolved") { s.standing = lead.standing; s.parent = lead.parent; }
      else if (lead) s.standing = lead.standing === "good" ? (s.status === "pending" ? "bad" : "good") : lead.standing;
      else s.standing = s.cancelled || s.status === "delivered" ? "good" : s.status === "missed" ? "ugly" : "bad";
    });

    /* A stop sits under its van's row only while that is its worst problem;
       one with a worse problem of its own keeps its own row. */
    incidents.forEach(function (r) {
      if (r.kind !== "van" || r.type !== "driver-delayed") return;
      r.children = r.children.filter(function (k) { const s = byKey[k]; return s && s.parent === r.id; });
      r.impact = { rupees: r.children.reduce(function (n, k) { return n + (Number(byKey[k].value) || 0); }, 0), cases: 0, stops: r.children.length, minutes: 0 };
    });
    const roots = incidents.filter(function (i) { return i.kind === "van"; });
    const atRisk = subjects.reduce(function (n, s) { return s.standing === "ugly" && !s.cancelled ? n + (Number(s.value) || 0) : n; }, 0);
    incidents.forEach(function (inc) { dress(inc, byKey[inc.subject], now, today); });
    return { subjects: subjects, byKey: byKey, incidents: incidents, byId: byId, roots: roots, atRisk: atRisk, today: today };
  }

  function standingOf(inc, s, now) {
    if (inc.state === "resolved") return "good";
    const c = inc.cat;
    if (inc.state === "acting") return inc.due && now > inc.due ? "ugly" : "bad";
    if (c.starts === "ugly") return "ugly";
    /* Q1: the drop can't happen today without you — unless the van can
       still go back on its own round (turns Missed when the route ends). */
    if (s && s.status === "missed" && c.clock !== "route-end") return "ugly";
    if (c.line && (inc.impact.rupees || 0) >= c.line) return "ugly"; // Q2: money above the line
    if (inc.due && now > inc.due) return "ugly";                      // the clock ran out
    if (inc.answered) return "bad";
    return c.starts;
  }

  /* What the row and the sheet say: what happened, what it costs, what to do. */
  function dress(inc, s, now, today) {
    const c = inc.cat, at = new Date(inc.at).getTime();
    const money = inc.impact.rupees ? rupees(inc.impact.rupees) : "";
    const t = clock(at);
    if (inc.kind === "van") {
      const n = inc.children.length;
      inc.note = inc.state === "resolved" ? inc.proof.text
        : inc.state === "acting" ? (inc.acting ? inc.acting.note : "Being fixed")
        : inc.type === "driver-delayed" ? "Up to " + (inc.facts.lateMin || 0) + " min behind · " + plural(n, "stop") + " past their time"
        : "Since " + t + (n ? " · holding " + plural(n, "stop") : inc.facts.where ? " · " + inc.facts.where : "");
      inc.what = inc.type === "driver-delayed"
        ? inc.van + " is behind its plan" + (inc.facts.why ? ": " + inc.facts.why.toLowerCase() : "") + ". " + plural(n, "customer") + " past their delivery time."
        : (inc.driver || "The driver") + " reported a " + c.label.toLowerCase() + (inc.facts.where ? " at " + inc.facts.where : "") + ".";
      inc.impactText = n ? plural(n, "stop") + " " + (inc.type === "driver-delayed" ? "past their time" : "held") + ", their orders waiting." : "The rest of this route waits until the van moves.";
    } else {
      const acted = inc.acting;
      inc.note = inc.state === "resolved" ? inc.proof.text
        : acted ? acted.note
        : inc.answered ? (inc.answer.by || "Answer") + ": " + inc.answer.text
        : describe(inc, s, t);
      inc.what = (inc.trail[0].text + (inc.facts.note ? ". " + inc.facts.note : "")).replace(/[.!?…]+$/, "") + ".";
      inc.impactText = impactLine(inc, s);
    }
    inc.rec = inc.state === "resolved" ? "Nothing to do here." : inc.state === "acting" ? waitLine(inc)
      : inc.kind === "van" && !inc.children.length ? "Ask " + (inc.driver || "the driver") + " how long it will take." : c.rec;
    inc.money = money;
    inc.tone = inc.standing;
    /* The row's step is the card's lead button: never one it won't offer
       (a van with nothing held has nothing to move). */
    const offered = inc.kind === "van" && !inc.children.length ? c.buttons.filter(function (b) { return b.id !== "move" && b.id !== "tell"; }) : c.buttons;
    inc.next = inc.state === "resolved" || inc.state === "acting" || !offered.length ? null : offered[offered.length - 1].label;
  }
  function describe(inc, s, t) {
    const f = inc.facts || {};
    switch (inc.type) {
      case "window-missed": return f.lateMin + " min past its time" + (inc.van ? " · " + inc.van : "");
      case "short-quantity": return plural(f.cases, "case") + " not delivered";
      case "crates": return plural(f.crates, "crate") + " not back";
      case "credit-limit": return "Owes " + rupees(f.owed) + " · limit " + rupees(f.limit);
      case "missing-item": case "excess-quantity": return (f.diff > 0 ? "+" : "") + f.diff + " " + f.name;
      /* Their own words lead the row; the photos are counted. */
      case "something-else": case "something-urgent": {
        const w = f.text ? (f.text.length > 60 ? f.text.slice(0, 58).replace(/\s+\S*$/, "") + "…" : f.text) : "No words";
        return "“" + w + "”" + ((f.photos || []).length ? " · " + plural(f.photos.length, "photo") : "") + " · " + t;
      }
      /* The pill already says what happened: the line says when, where, how much. */
      default: return t + (inc.van ? " · " + inc.van : "") + (inc.impact.rupees ? " · " + rupees(inc.impact.rupees) : "");
    }
  }
  /* The figure is the Impact's big line; this says what it means, without
     saying the figure twice (owner, 23 Sep 2026). */
  function impactLine(inc, s) {
    const f = inc.facts || {};
    if (inc.type === "window-missed") return "The customer has waited " + f.lateMin + " min.";
    if (inc.type === "something-urgent") return (inc.driver || "They") + " asked for a call now.";
    if (inc.type === "something-else") return "Nobody knows yet. A call will tell you.";
    if (inc.type === "credit-limit") return "More on credit if it's delivered as usual.";
    if (inc.type === "crates") return plural(f.crates, "crate") + " of yours still with the shop.";
    if (s && s.status === "missed") return "Not delivered today.";
    if (/dispute/.test(inc.type)) return "Held until it's settled.";
    if (inc.cat.family === "Product" || inc.cat.family === "Returns") return "Goods to replace or credit.";
    if (inc.type === "short-quantity") return plural(f.cases, "case") + " still owed to the shop.";
    if (inc.type === "missing-item" || inc.type === "excess-quantity") return "Stock the count can't explain.";
    return "Worth sorting before the route closes.";
  }
  function waitLine(inc) {
    const a = inc.acting;
    if (!a) return "Being fixed.";
    const p = ACTIONS[a.id] ? ACTIONS[a.id].proof : "";
    return p === "delivered" ? "Being fixed. It closes when it's delivered."
      : p === "delivered-later" ? "Being fixed. It closes when the next trip delivers it."
      : p === "settled" ? "Being fixed. It closes when the van settles tonight."
      : p === "answer" ? "Waiting for the answer. It shows here when it comes."
      : p === "accepted" ? "Waiting for the customer to accept the proof."
      : "Being fixed.";
  }

  /* ── the demo's proof: what would happen next on a real day ─────────
     For each incident being fixed, the platform event that would close it
     and when: a delivery once the van is back at the stop, an answer from
     the driver, the customer accepting the proof. The demo writes them. */
  function simulate(x, now) {
    const out = [];
    x.incidents.forEach(function (inc) {
      if (inc.state === "resolved") return;
      const s = inc.subject ? x.byKey[inc.subject] : null;
      const a = inc.acting;
      if (inc.kind === "van" && inc.type !== "driver-delayed" && inc.state !== "resolved") {
        const until = inc.facts && inc.facts.until ? new Date(inc.facts.until).getTime() : null;
        if (until && now >= until) out.push({ kind: "event", event: { type: "van.moving", by: inc.driver, where: "Live Tracking", how: "system", subject: { van: inc.van, incident: inc.id } } });
        return;
      }
      if (!a) return;
      const since = new Date(a.at).getTime();
      if (a.id === "ask" && now - since >= 40000) {
        out.push({ kind: "event", event: { type: "question.answered", by: inc.driver || "Kumar", where: "Delivery app", how: "driver",
          subject: { incident: inc.id }, data: { text: ANSWERS[inc.type] || "Checked. It's sorted now." } } });
      } else if (a.id === "proof" && now - since >= 60000) {
        out.push({ kind: "event", event: { type: "customer.accepted", by: inc.title, where: "WhatsApp", how: "customer", subject: { incident: inc.id } } });
      } else if (s && s.status === "missed") {
        /* Back at a stop that was missed: when the fix says so. */
        const when = a.data && a.data.at ? new Date(a.data.at).getTime() : a.id === "fixOrder" || a.id === "credit" ? since + 40000
          : a.id === "reschedule" && a.data && a.data.date === x.today && a.data.window ? istAt(x.today, WIN[a.data.window][1]) + 20 * MIN : null;
        if (when && now >= when) out.push({ kind: "deliver", subject: s, incident: inc, at: new Date(Math.max(when, since + 20000)).toISOString() });
      }
    });
    return out;
  }
  const ANSWERS = {
    "excess-quantity": "Kanti Sweets refused 4 cases. They're on the van.",
    "missing-item": "4 packs were torn at the shop. I threw them there.",
    "partial-acceptance": "They kept less; their shelf was full.",
    "crates": "The shop says they'll keep the crates ready for tomorrow.",
    "puncture": "Tyre changed. Moving again in 10 minutes.",
    "traffic-delay": "Jam on Hosur Road. About 30 minutes behind.",
    "pod-missing": "Photo taken now. It's in the stop summary.",
    "upi-failed": "They paid cash instead.",
  };

  const API = { derive: derive, simulate: simulate, standingOf: standingOf, CATALOG: CATALOG, ACTIONS: ACTIONS, OUTCOMES: OUTCOMES,
                DRIVER_OUTCOMES: DRIVER_OUTCOMES, REFILE: REFILE, REASON: REASON, WIN: WIN, T: T, clock: clock, dayIso: dayIso, dayWord: dayWord, istAt: istAt, rupees: rupees };
  root.CTIncidents = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

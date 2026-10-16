/* ==========================================================================
   CONTROL TOWER · NOW — the day as one stack of cards. (16 Oct 2026)

   Ek kaam ("one thing at a time"), the owner's pick: the tower's incidents
   from every area in one stack, worst first, one card on screen. The
   cards are not new work: each is a row the area pages already list, and
   its button opens that row's own card (the same modal or inline confirm).

   The six rules (context/control-tower/CONTROL_TOWER_NOW.md):
     1 one stack for every area: Urgent before Needs work; inside that,
       what closes first (the area's clock), then what costs most
     2 the strip is the monitor: a count per area, always on top
     3 alike things come as one card (same area, same problem, 2 or more)
     4 worse problems ask to go first (the screen does that, not this)
     5 waiting leaves the stack: acted on, now on someone else
     6 the day ends: an empty stack is a cleared day

     build(levers, opts) → { cards, waiting, areas, total }

   A card: { key, kind one|group, area, areaName, tone, title, note, tag,
   action, value, rows, items }; `items` are its rows' keys, so a card
   that changed shape (a group down to one) is not taken for done.

   `levers` are the tower's areas in the lever shape (levers.js, or a
   journey area): { id, label, tiles: { ugly, bad } with rows }. Pure: no
   DOM, no storage, no clock. Runs under node.
   ========================================================================== */

(function (root) {
  "use strict";

  /* What closes first: today's route before money owed, money before what
     to buy, buying before stock on the shelf, before customers who drifted.
     Setup areas (the journey's) come in their own order, ahead. */
  const CLOCK = { products: 0, customers: 1, deliveries: 2, collections: 3, production: 4, purchase: 5, inventory: 6, order: 7 };
  const SHORT = { purchase: "Buying", inventory: "Stock", order: "Orders" };
  /* The strip's one word per area, short enough for six on a phone (the
     owner's mockup: Delivery · Collect · Buy · Stock · Orders). */
  const STRIP = { deliveries: "Delivery", collections: "Collect", production: "Make", purchase: "Buy", inventory: "Stock", order: "Orders" };
  const NOUN = { production: ["batch", "batches"], deliveries: ["delivery", "deliveries"], collections: ["customer", "customers"], purchase: ["product", "products"],
                 inventory: ["product", "products"], order: ["customer", "customers"], products: ["product", "products"], customers: ["customer", "customers"] };
  /* A group's line, by what its rows share: the area and the step (or the incident). */
  const GROUP = {
    "collections|Call to collect": function (n, sum) { return n + " customers owe " + sum + ", long overdue"; },
    "collections|Ask for a payment date": function (n, sum) { return n + " customers are late paying " + sum; },
    "purchase|Order today": function (n) { return n + " products to buy today"; },
    "purchase|Order this week": function (n) { return n + " products to buy this week"; },
    "inventory|Order today": function (n) { return n + " products are out of stock"; },
    "inventory|Offer to past buyers": function (n, sum) { return n + " products haven't sold: " + sum + " on the shelf"; },
    "inventory|Reorder soon": function (n) { return n + " products run low soon"; },
    "order|Call to find out why": function (n) { return n + " customers stopped ordering"; },
    "order|Call to reorder": function (n) { return n + " customers are late to reorder"; },
    "production|Approve for production": function (n) { return n + " products to approve for production"; },
    "production|alert": function (n) { return n + " batches need you on the floor"; },
    "production|tab:or": function (n) { return n + " products short for orders"; },
    /* The new store's products (products-area.js), by family. */
    "products|fam:hidden": function (n) { return n + " products are hidden from customers"; },
    "products|fam:stock": function (n) { return n + " products are short or out of stock"; },
    "products|fam:price": function (n) { return n + " products are priced wrong"; },
    "products|fam:paperwork": function (n) { return n + " products need tidying for invoices"; },
    "products|tag:noUnit": function (n) { return n + " products are hidden: no unit"; },
    "products|tag:noPrice": function (n) { return n + " products are hidden: no price"; },
    "products|tag:noCategory": function (n) { return n + " products are hidden: no category"; },
    "products|tag:short": function (n) { return n + " products are short for open orders"; },
    "products|tag:out": function (n) { return n + " products are out of stock"; },
    "products|tag:belowCost": function (n) { return n + " products sell below cost"; },
    "products|tag:aboveMrp": function (n) { return n + " products are priced above MRP"; },
    "products|tag:brand": function (n) { return n + " products have a brand spelled two ways"; },
    "products|tag:noHsn": function (n) { return n + " products have no HSN code"; },
    "production|Create order": function (n) { return n + " materials to order for production"; },
  };
  const plainRupees = function (n) { return "₹" + Math.round(n).toLocaleString("en-IN"); };

  /* ── The card's words: what the owner reads, nothing else (owner, 16 Oct
     2026: "no IDs … useless to the user"). ──────────────────────────── */
  /* What happened, in two or three words, when the row has no incident. */
  const KICKER = {
    "collections|Call to collect": "Long overdue", "collections|Ask for a payment date": "Late paying",
    "order|Call to find out why": "Stopped ordering", "order|Call to reorder": "Late to reorder",
    "purchase|Order today": "Buy today", "purchase|Order this week": "Buy this week",
    "inventory|Order today": "Out of stock", "inventory|Offer to past buyers": "Not selling", "inventory|Reorder soon": "Running low",
    "production|Approve for production": "To approve", "production|Create order": "Material to order",
    "production|Call the supplier": "Late from the supplier", "production|Approve in Purchase Orders": "Waiting for approval",
    "production|tab:or": "Short for orders", "production|alert": "On the floor",
  };
  const KEEP_UP = { MRP: 1, GST: 1, HSN: 1, SBI: 1, ODC: 1, LLP: 1, FMCG: 1, "M": 1, "K": 1, "S": 1, "R": 1 };
  const UNITS = { GM: "gm", KG: "kg", ML: "ml", LTR: "ltr", G: "g", L: "l", PCS: "pcs" };
  /* Codes a person never reads: a vehicle number, an order or delivery number. */
  const CODE = [/^[A-Z]{2}[-\s]?\d{1,2}[-\s]?[A-Z]{0,3}[-\s]?\d{3,4}$/, /^[A-Z]{1,4}-\d{3,}(-\d+)*$/, /^#?\d{5,}$/];
  /* A name as people write it: "MAA KAMAKHYA RETAILS" → "Maa Kamakhya
     Retails"; a catalog's old-price notes go ("(OLD MRP 100), NEW MRP 95"). */
  function nice(name) {
    let t = String(name == null ? "" : name)
      .replace(/\(?\s*OLD MRP\s*\d+\s*\)?,?/gi, "").replace(/,?\s*NEW MRP\s*\d+/gi, "").replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").replace(/[,\s]+$/, "").trim();
    /* A vehicle or order number in a name goes too ("Van 1 · PB-11-CX-4412" → "Van 1"). */
    t = t.split(/\s+·\s+/).filter(function (x) { return !CODE.some(function (re) { return re.test(x.trim()); }); }).join(" · ") || t;
    const words = t.replace(/\([^)]*\)/g, "");                     // "(100 gm)" doesn't make a shouted name a written one
    if (/[a-z]/.test(words) || !/[A-Z]{3}/.test(words)) return t;
    return t.replace(/[A-Za-z][A-Za-z'.&]*/g, function (w) {
      const bare = w.replace(/[.']+$/, "").toUpperCase();
      if (KEEP_UP[bare]) return w.toUpperCase();
      if (UNITS[bare]) return UNITS[bare] + w.slice(bare.length);
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    });
  }
  /* A row's small line, as facts: codes dropped, the figure dropped when the
     card shows it big, the kicker not said twice. */
  function facts(note, value, money, kicker) {
    const big = value ? money(value) : null;
    return String(note || "").split(/\s+·\s+/).map(function (x) { return x.trim(); }).filter(function (x) {
      if (!x) return false;
      if (CODE.some(function (re) { return re.test(x); })) return false;
      if (big && x.replace(/\s/g, "") === big.replace(/\s/g, "")) return false;
      if (kicker && x.toLowerCase() === kicker.toLowerCase()) return false;
      return true;
    }).slice(0, 3);
  }

  /* Does a row need the owner, is it waiting on someone else, or neither? */
  function standing(r) {
    if (r.tag) {
      if (r.tag.state === "acting") return "waiting";
      if (r.tag.state) return r.tag.state === "open" && r.tag.tone !== "good" ? "now" : null;
      return r.tag.tone === "ugly" || r.tag.tone === "bad" ? "now" : null;
    }
    if (r.jstep !== undefined) return r.now ? "now" : null;
    /* Production's rows carry their own tone; an alert from the floor has no step. */
    if (r.tone) return r.tone === "ugly" || r.tone === "bad" ? "now" : null;
    return r.next && !/^nothing/i.test(r.next) ? "now" : null;
  }
  /* What alike rows share: the incident, the floor's alert, the step, or
     (Production's order rows, which have no step) the tab they sit under. */
  /* A new store's products travel by family, not by their first problem:
     a product with no unit and no category stays one "hidden" thing until
     both are set, so fixing one never looks like a new problem. */
  const FAMILY = { noUnit: "hidden", noPrice: "hidden", noCategory: "hidden", short: "stock", out: "stock",
                   belowCost: "price", aboveMrp: "price", brand: "paperwork", noHsn: "paperwork" };
  function share(r) {
    if (r.kind === "jproduct" && r.tag && FAMILY[r.tag.type]) return "fam:" + FAMILY[r.tag.type];
    if (r.tag && r.tag.type) return "tag:" + r.tag.type;
    if (r.alert) return "alert";
    return r.next || (r.tab ? "tab:" + r.tab : r.title);
  }
  function keyOf(r) { return (r.kind || "row") + ":" + (r.id != null ? r.id : r.title); }
  function areaName(lv) { return SHORT[lv.id] || lv.label; }

  function build(levers, opts) {
    const o = opts || {};
    const minGroup = o.minGroup || 2;
    const rupees = o.money || plainRupees;
    const seen = {};
    const items = [], waiting = [];
    /* In the clock's order, so Buying claims a product before Stock does. */
    const byClock = (levers || []).filter(function (lv) { return lv && lv.tiles && CLOCK[lv.id] !== undefined; })
      .sort(function (a, b) { return CLOCK[a.id] - CLOCK[b.id]; });
    byClock.forEach(function (lv) {
      ["ugly", "bad"].forEach(function (tone) {
        ((lv.tiles[tone] && lv.tiles[tone].rows) || []).forEach(function (r, i) {
          const s = standing(r);
          if (!s) return;
          const k = keyOf(r);
          /* One thing, one card: a product to buy is not also a stock card
             (Buying lists what Stock runs out of). The same customer with
             another problem (owes money, stopped ordering) is another card. */
          const same = r.kind === "product" ? k : k + "|" + (r.next || (r.tag && r.tag.type) || "");
          if (seen[same]) return;
          seen[same] = 1;
          const it = { key: lv.id + "/" + k, area: lv.id, tone: r.tag && (r.tag.tone === "ugly" || r.tag.tone === "bad") ? r.tag.tone : r.tone === "ugly" || r.tone === "bad" ? r.tone : tone,
                       row: r, value: typeof r.value === "number" ? r.value : 0, at: i };
          (s === "waiting" ? waiting : items).push(it);
        });
      });
    });

    /* Alike things travel together: same area, same incident or step. */
    const groups = {}, order = [];
    items.forEach(function (it) {
      const r = it.row;
      const g = it.area + "|" + it.tone + "|" + share(r);
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(it);
    });
    const cards = order.map(function (g) {
      const list = groups[g], first = list[0], lv = (levers || []).filter(function (x) { return x && x.id === first.area; })[0];
      const sum = list.reduce(function (n, it) { return n + it.value; }, 0);
      const base = { area: first.area, areaName: areaName(lv), tone: first.tone, value: sum, items: list.map(function (it) { return it.key; }) };
      if (list.length < minGroup) {
        const r = first.row;
        const kick = r.tag ? r.tag.label.replace(/^✓ /, "") : KICKER[first.area + "|" + share(r)] || null;
        return Object.assign(base, { key: first.key, kind: "one", rows: [r], title: nice(r.title), note: r.note || "",
          tag: r.tag ? r.tag.label : null, kicker: kick, facts: facts(r.note, base.value, rupees, kick), people: [], list: [],
          action: r.next || (r.tabLabel ? "Open " + r.tabLabel : "Open") });
      }
      const r = first.row, noun = NOUN[first.area] || ["item", "items"];
      const line = GROUP[first.area + "|" + share(r)];
      const title = line ? line(list.length, rupees(sum))
        : list.length + " " + noun[1] + (r.tag ? " · " + r.tag.label.replace(/^✓ /, "").toLowerCase() : r.next ? ": " + r.next.toLowerCase() : "");
      const people = list.map(function (it) { return nice(it.row.title); });
      return Object.assign(base, { key: first.area + "/group:" + g.split("|").slice(1).join("|"), kind: "group", rows: list.map(function (it) { return it.row; }),
        title: title, note: people.slice(0, 2).join(", ") + (list.length > 2 ? " and " + (list.length - 2) + " more" : ""),
        tag: r.tag ? r.tag.label : null, kicker: /^fam:/.test(share(r)) ? null : r.tag ? r.tag.label.replace(/^✓ /, "") : KICKER[first.area + "|" + share(r)] || null,
        facts: [], people: people, action: "See all " + list.length,
        /* Each one, by name, with its own problem: the card lists them. */
        list: list.map(function (it) { return { key: it.key, row: it.row, name: nice(it.row.title),
          what: it.row.tag ? it.row.tag.label.replace(/^✓ /, "") : (facts(it.row.note, 0, rupees)[0] || ""), value: it.value }; }) });
    });

    /* Said once: a kicker the card's line already says goes. */
    cards.forEach(function (c) { if (c.kicker && c.title.toLowerCase().indexOf(c.kicker.toLowerCase()) !== -1) c.kicker = null; });
    const TONE = { ugly: 0, bad: 1 };
    cards.sort(function (a, b) { return TONE[a.tone] - TONE[b.tone] || CLOCK[a.area] - CLOCK[b.area] || b.value - a.value; });

    /* The strip: every area, how many things in it need the owner. */
    const areas = byClock.map(function (lv) {
      const mine = items.filter(function (it) { return it.area === lv.id; });
      const tone = mine.some(function (it) { return it.tone === "ugly"; }) ? "ugly" : mine.length ? "bad" : "good";
      return { id: lv.id, label: STRIP[lv.id] || areaName(lv), name: areaName(lv), count: mine.length, tone: tone };
    });
    return { cards: cards, waiting: waiting.map(function (it) { return { key: it.key, area: it.area, row: it.row }; }), areas: areas, total: items.length };
  }

  const API = { build: build, standing: standing, nice: nice, facts: facts, CLOCK: CLOCK };
  root.CTStack = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

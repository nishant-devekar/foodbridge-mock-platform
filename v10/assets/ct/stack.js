/* ==========================================================================
   NOW — the day as one stack of cards. (16 Oct 2026; rules from the graph
   since 17 Oct 2026)

   Ek kaam, one thing at a time: the rows of every open area in one stack,
   worst first, alike rows as one card. This file holds the mechanics only.
   Every rule with meaning comes in `opts`, read from the tower graph
   (assets/tower/graphs/control-tower.json through assets/tower/runtime.js):

     opts.areas    { <key>: { rank, word, feed: { noun, groups, kickers,
                   families } } } — what closes first, the area's word, how
                   its alike rows are named
     opts.text     { keepUpper, units, drop, codes } — how names are written
                   and which codes are never shown
     opts.oneCardPer  row kinds that are one card whatever their step
     opts.minGroup    how many alike rows make a group (default 2)
     opts.money       how money is written

     build(lists, opts) → { cards, waiting, areas, total }

   A card: { key, kind one|group, area, areaName, tone, title, note, tag,
   kicker, facts, list, action, value, rows, items }. `items` are its rows'
   keys, so a card that changed shape is not taken for done.

   `lists` are the open areas, each { id, label, tiles: { ugly, bad } with
   rows }. Pure: no DOM, no storage, no clock. Runs under node. It names
   no area and no business: test/control-tower/stack.test.js checks.
   ========================================================================== */

(function (root) {
  "use strict";

  const plainMoney = function (n) { return String(Math.round(n)); };
  const fill = function (tpl, n, sum) { return String(tpl).replace(/\{n\}/g, String(n)).replace(/\{sum\}/g, sum); };
  const regexes = function (list) { return (list || []).map(function (s) { try { return new RegExp(s, "i"); } catch (e) { return null; } }).filter(Boolean); };
  const codesOf = function (list) { return (list || []).map(function (s) { try { return new RegExp(s); } catch (e) { return null; } }).filter(Boolean); };

  /* A name as people write it: a shouted name is put in title case (the
     graph's keepUpper words and units excepted); the graph's drop patterns
     and code patterns leave it. */
  function nice(name, text) {
    const T = text || {};
    const up = {}, units = T.units || {};
    (T.keepUpper || []).forEach(function (w) { up[String(w).toUpperCase()] = 1; });
    const codes = codesOf(T.codes);
    let t = String(name == null ? "" : name);
    regexes(T.drop).forEach(function (re) { t = t.replace(new RegExp(re.source, "gi"), ""); });
    t = t.replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").replace(/[,\s]+$/, "").trim();
    t = t.split(/\s+·\s+/).filter(function (x) { return !codes.some(function (re) { return re.test(x.trim()); }); }).join(" · ") || t;
    const words = t.replace(/\([^)]*\)/g, "");
    if (/[a-z]/.test(words) || !/[A-Z]{3}/.test(words)) return t;
    return t.replace(/[A-Za-z][A-Za-z'.&]*/g, function (w) {
      const bare = w.replace(/[.']+$/, "").toUpperCase();
      if (up[bare]) return w.toUpperCase();
      if (units[bare]) return units[bare] + w.slice(bare.length);
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    });
  }
  /* A row's small line, as facts: codes dropped, the figure dropped when the
     card shows it big, the kicker not said twice. */
  function facts(note, value, money, kicker, text) {
    const codes = codesOf(text && text.codes);
    const big = value ? money(value) : null;
    return String(note || "").split(/\s+·\s+/).map(function (x) { return x.trim(); }).filter(function (x) {
      if (!x) return false;
      if (codes.some(function (re) { return re.test(x); })) return false;
      if (big && x.replace(/\s/g, "") === big.replace(/\s/g, "")) return false;
      if (kicker && x.toLowerCase() === kicker.toLowerCase()) return false;
      return true;
    }).slice(0, 3);
  }

  /* Does a row need the owner, is it waiting on someone else, or neither?
     Read from the row's shape alone: an incident's state, a step's `now`, a
     row's own tone, or a next step. */
  function standing(r) {
    if (r.tag) {
      if (r.tag.state === "acting") return "waiting";
      if (r.tag.state) return r.tag.state === "open" && r.tag.tone !== "good" ? "now" : null;
      return r.tag.tone === "ugly" || r.tag.tone === "bad" ? "now" : null;
    }
    if (r.jstep !== undefined) return r.now ? "now" : null;
    if (r.tone) return r.tone === "ugly" || r.tone === "bad" ? "now" : null;
    return r.next && !/^nothing/i.test(r.next) ? "now" : null;
  }
  /* What alike rows share: an incident's family (the graph's), the
     incident, an alert, the step, or the tab they sit under. */
  function share(r, families) {
    if (r.tag && r.tag.type && families && families[r.tag.type]) return "fam:" + families[r.tag.type];
    if (r.tag && r.tag.type) return "tag:" + r.tag.type;
    if (r.alert) return "alert";
    return r.next || (r.tab ? "tab:" + r.tab : r.title);
  }
  function keyOf(r) { return (r.kind || "row") + ":" + (r.id != null ? r.id : r.title); }

  function build(lists, opts) {
    const o = opts || {};
    const specs = o.areas || {};
    const text = o.text || {};
    const oneCard = {};
    (o.oneCardPer || []).forEach(function (k) { oneCard[k] = 1; });
    const minGroup = o.minGroup || 2;
    const money = o.money || plainMoney;
    const spec = function (k) { return specs[k] || {}; };
    const feed = function (k) { return spec(k).feed || {}; };
    const rank = function (k) { const r = spec(k).rank; return typeof r === "number" ? r : 999; };
    const word = function (lv) { return spec(lv.id).word || lv.label; };
    const seen = {};
    const items = [], waiting = [];
    /* Only the areas the graph names, in its rank: the first area to claim a thing keeps it. */
    const ranked = (lists || []).filter(function (lv) { return lv && lv.tiles && specs[lv.id]; })
      .sort(function (a, b) { return rank(a.id) - rank(b.id); });
    ranked.forEach(function (lv) {
      ["ugly", "bad"].forEach(function (tone) {
        ((lv.tiles[tone] && lv.tiles[tone].rows) || []).forEach(function (r, i) {
          const s = standing(r);
          if (!s) return;
          const k = keyOf(r);
          /* One thing, one card. A row kind the graph lists (oneCardPer) is
             one card whatever its step; any other thing with a second step
             is a second card. */
          const same = oneCard[r.kind] ? k : k + "|" + (r.next || (r.tag && r.tag.type) || "");
          if (seen[same]) return;
          seen[same] = 1;
          const it = { key: lv.id + "/" + k, area: lv.id, tone: r.tag && (r.tag.tone === "ugly" || r.tag.tone === "bad") ? r.tag.tone : r.tone === "ugly" || r.tone === "bad" ? r.tone : tone,
                       row: r, value: typeof r.value === "number" ? r.value : 0, at: i };
          (s === "waiting" ? waiting : items).push(it);
        });
      });
    });

    /* Alike things travel together: same area, same tone, same share. */
    const groups = {}, seq = [];
    items.forEach(function (it) {
      const g = it.area + "|" + it.tone + "|" + share(it.row, feed(it.area).families);
      if (!groups[g]) { groups[g] = []; seq.push(g); }
      groups[g].push(it);
    });
    const cards = seq.map(function (g) {
      const list = groups[g], first = list[0], lv = ranked.filter(function (x) { return x.id === first.area; })[0];
      const F = feed(first.area);
      const sum = list.reduce(function (n, it) { return n + it.value; }, 0);
      const sh = share(first.row, F.families);
      const base = { area: first.area, areaName: word(lv), tone: first.tone, value: sum, items: list.map(function (it) { return it.key; }) };
      if (list.length < minGroup) {
        const r = first.row;
        const kick = r.tag ? r.tag.label.replace(/^✓ /, "") : (F.kickers || {})[sh] || null;
        return Object.assign(base, { key: first.key, kind: "one", rows: [r], title: nice(r.title, text), note: r.note || "",
          tag: r.tag ? r.tag.label : null, kicker: kick, facts: facts(r.note, base.value, money, kick, text), people: [], list: [],
          action: r.next || (r.tabLabel ? "Open " + r.tabLabel : "Open") });
      }
      const r = first.row, noun = F.noun || ["item", "items"];
      const tpl = (F.groups || {})[sh];
      const title = tpl ? fill(tpl, list.length, money(sum))
        : list.length + " " + noun[1] + (r.tag ? " · " + r.tag.label.replace(/^✓ /, "").toLowerCase() : r.next ? ": " + r.next.toLowerCase() : "");
      const people = list.map(function (it) { return nice(it.row.title, text); });
      return Object.assign(base, { key: first.area + "/group:" + g.split("|").slice(1).join("|"), kind: "group", rows: list.map(function (it) { return it.row; }),
        title: title, note: people.slice(0, 2).join(", ") + (list.length > 2 ? " and " + (list.length - 2) + " more" : ""),
        tag: r.tag ? r.tag.label : null, kicker: /^fam:/.test(sh) ? null : r.tag ? r.tag.label.replace(/^✓ /, "") : (F.kickers || {})[sh] || null,
        facts: [], people: people, action: "See all " + list.length,
        list: list.map(function (it) { return { key: it.key, row: it.row, name: nice(it.row.title, text),
          what: it.row.tag ? it.row.tag.label.replace(/^✓ /, "") : (facts(it.row.note, 0, money, null, text)[0] || ""), value: it.value }; }) });
    });

    /* Said once: a kicker the card's line already says goes. */
    cards.forEach(function (c) { if (c.kicker && c.title.toLowerCase().indexOf(c.kicker.toLowerCase()) !== -1) c.kicker = null; });
    const TONE = { ugly: 0, bad: 1 };
    cards.sort(function (a, b) { return TONE[a.tone] - TONE[b.tone] || rank(a.area) - rank(b.area) || b.value - a.value; });

    /* The rings: every area the graph opened, in its rank, how many things in it. */
    const areas = ranked.map(function (lv) {
      const mine = items.filter(function (it) { return it.area === lv.id; });
      const tone = mine.some(function (it) { return it.tone === "ugly"; }) ? "ugly" : mine.length ? "bad" : "good";
      return { id: lv.id, label: word(lv), name: word(lv), count: mine.length, tone: tone };
    });
    return { cards: cards, waiting: waiting.map(function (it) { return { key: it.key, area: it.area, row: it.row }; }), areas: areas, total: items.length };
  }

  const API = { build: build, standing: standing, nice: nice, facts: facts };
  root.CTStack = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

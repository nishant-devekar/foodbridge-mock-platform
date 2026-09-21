/* ==========================================================================
   CONTROL TOWER · FOODBRIDGE AI — the same signals, in conversation.

   DOWNSTREAM OF DETERMINISTIC TRUTH (requirements Rule 4). This assistant
   does not look anything up that the signal engine has not already found,
   and it does not do arithmetic of its own: every figure it says is a field
   of a signal, and every answer names the signals it rests on (`cites`).
   The Control Tower, WhatsApp and voice would read the same engine (§32).

   IT PREPARES; IT NEVER CONFIRMS. "Fix it" returns a proposal -- the owner
   reviews it in the same Action Review the screen uses and presses Confirm.
   There is no path from here to CTActions.execute().

   IT SAYS WHAT IT CANNOT SEE. Stale data, missing ledgers, delivery, expiry:
   each is answered with the reason and what would unlock it, never with a
   confident guess. Outside what it knows, it offers a person.

   No model is called in this build. Intent is matched on words; the answers
   are templates over signals. A language model can sit in front of this later
   (the bridge already carries the SDK) -- it would still answer from here.
   ========================================================================== */

(function (root) {
  "use strict";

  const INTENTS = [
    { id: "hello",    re: /^(hi|hello|hey|namaste|good (morning|afternoon|evening))\b/i },
    { id: "fresh",    re: /\b(live|fresh|up to date|stale|sync|synced|current|how old|latest|data)\b/i },
    { id: "fix",      re: /\b(fix|do it|go ahead|prepare|raise|remind|reorder|create|order it|handle|sort it)\b/i },
    { id: "why",      re: /\bwhy\b|\bexplain\b|\bhow (is|was|did)\b/i },
    { id: "first",    re: /\b(first|priority|prioriti[sz]e|focus|what should i do|most important|start)\b/i },
    { id: "summary",  re: /\b(what('?s| is) (going )?(wrong|happening|up)|needs? (my )?attention|today|summary|overview|how('?s| is) (my )?business|status|what needs)\b/i },
    { id: "help",     re: /\b(help|person|human|support|call me|talk to)\b/i },
  ];
  /* Words that point at one signal (or at something we cannot see). */
  const TOPICS = [
    { id: "order-risk",   re: /\b(order risk|can'?t (be )?fill|short order|orders? at risk)\b/i },
    { id: "stockout",     re: /\b(stock ?out|run(ning)? out|out of stock|low stock|stock|inventory|purchase|po\b|buy)\b/i },
    { id: "overdue",      re: /\b(overdue|owe[sd]?|receivable|collection|payment|cash|money|dues?)\b/i },
    { id: "reorder-due",  re: /\b(shop|customer|reorder|not ordered|cycle|quiet|inactive)\b/i },
    { id: "slow-stock",   re: /\b(slow|dead|not sold|not selling|tied)\b/i },
    { id: "demand-up",    re: /\b(demand|trend|rising|growth|opportunit)/i },
    { id: "@delivery",    re: /\b(deliver|route|driver|vehicle|dispatch|eta)\w*/i },
    { id: "@expiry",      re: /\b(expir|batch|fefo|shelf life)\w*/i },
    { id: "@supplier",    re: /\b(supplier delay|late supplier|vendor delay)\b/i },
  ];

  function create(opts) {
    const getContext = opts.getContext;       // → { signals, pulse, freshness, unavailable, business, focusId }
    const fmt = (opts.signals || root.CTSignals).fmt;

    function match(list, text) { return list.filter(function (x) { return x.re.test(text); }).map(function (x) { return x.id; }); }

    function staleNote(ctx) {
      const f = ctx.freshness;
      if (!f) return null;
      if (f.sample) return "This is sample data, built from your imported orders.";
      if (f.delayed) return "Your records run to " + fmt.date(new Date(ctx.dataEnd || f.when).toISOString()) +
        (f.age !== null ? " — imported " + fmt.plural(f.age, "day") + " ago" : "") + ", so nothing newer is counted.";
      return null;
    }

    function signalLine(s) {
      return s.title + (s.impact && typeof s.impact.value === "number" ? " — " + s.impact.description : "");
    }
    function proposalFor(s) {
      return s && s.recommendation ? { signalId: s.id, actionType: s.recommendation.actionType, label: s.recommendation.cta || "Review" } : null;
    }
    /* A named topic answers for that topic only. Falling back to "the top
       signal" when the topic has none is how a question about money gets an
       answer about stock -- confident, and about the wrong thing. */
    function pick(ctx, topics) {
      const byId = {};
      ctx.signals.forEach(function (s) { byId[s.id] = s; });
      if (topics.length) {
        for (const t of topics) if (byId[t]) return byId[t];
        return null;
      }
      if (ctx.focusId && byId[ctx.focusId]) return byId[ctx.focusId];
      return null;
    }
    function unavailableFor(ctx, topic) {
      const key = topic === "@delivery" ? "delivery" : topic === "@expiry" ? "expiry" : topic === "@supplier" ? "supplier-delay" : topic === "overdue" ? "cash" : null;
      return key ? (ctx.unavailable || []).filter(function (u) { return u.id === key; })[0] || null : null;
    }

    function ask(text) {
      const q = String(text || "").trim();
      let ctx;
      try { ctx = getContext(); }
      catch (e) {
        return { intent: "error", blocks: [{ type: "p", text: "I can't read your records right now, so I won't guess. Everything else on this screen still works." }],
                 cites: [], proposal: null, suggestions: ["Talk to a person"], error: true };
      }
      if (!q) return reply("empty", [{ type: "p", text: "Ask me about stock, orders, customers or money owed." }], [], null, starters(ctx));

      const intents = match(INTENTS, q);
      const topics = match(TOPICS, q);
      const intent = intents[0] || (topics.length ? "why" : "unknown");
      const active = ctx.signals.filter(function (s) { return s.status !== "dismissed"; });
      const actionable = active.filter(function (s) { return s.recommendation && s.status !== "in_progress"; });
      const note = staleNote(ctx);

      /* Something we cannot see, asked about directly. */
      const blind = topics.filter(function (t) { return t.charAt(0) === "@"; })[0];
      if (blind) {
        const u = unavailableFor(ctx, blind);
        return reply("unavailable", [
          { type: "p", text: u ? u.reason + " So I can't tell you about " + u.title.toLowerCase() + "." : "I can't see that in your records." },
          u ? { type: "p", text: "What would change that: " + u.unlock } : null,
        ], [], null, ["What needs my attention?", "Talk to a person"]);
      }

      if (intent === "hello") return reply("hello", [{ type: "p", text: "Hello" + (ctx.business ? ", " + ctx.business : "") + ". " + headline(ctx, active) }], cites(active.slice(0, 3)), proposalFor(actionable[0]), starters(ctx));

      if (intent === "fresh") {
        const f = ctx.freshness || {};
        return reply("fresh", [
          { type: "p", text: f.sample ? "You're looking at sample data, built from your imported orders — not a live feed." :
              f.delayed ? "No — this isn't live. " + (note || "") : "Yes — your records were read " + (f.age === 0 ? "today" : fmt.plural(f.age, "day") + " ago") + "." },
          { type: "list", items: (f.sources || []).map(function (s) { return { text: s.label + ": " + s.detail + (s.state === "unavailable" ? " (not available)" : "") }; }) },
        ], [], null, ["What needs my attention?"]);
      }

      if (intent === "help") {
        return reply("help", [{ type: "p", text: "I'll hand this to a FoodBridge expert with everything I can see attached — the issue, the evidence and what you've already done — so you won't have to repeat it." }],
                     [], { escalate: true, label: "Talk to a person" }, []);
      }

      if (intent === "summary" || (intent === "unknown" && !topics.length && /\?$/.test(q) && /\bwhat\b/i.test(q))) {
        if (!active.length) {
          return reply("summary", [{ type: "p", text: "Nothing needs you right now. I checked stock, orders and customers" + (ctx.unavailable.some(function (u) { return u.id === "cash"; }) ? "" : ", and money owed") + "." },
                                   note ? { type: "p", text: note, tone: "muted" } : null], [], null, ["Is this data live?"]);
        }
        const top = active.slice(0, 5);
        return reply("summary", [
          { type: "p", text: headline(ctx, active) },
          { type: "list", items: top.map(function (s) { return { text: signalLine(s), signalId: s.id, severity: s.severity }; }) },
          actionable.length ? { type: "p", text: "I've prepared " + fmt.plural(Math.min(actionable.length, 3), "action") + " for you to review." } : null,
          note ? { type: "p", text: note, tone: "muted" } : null,
        ], cites(top), proposalFor(actionable[0]), ["What should I do first?", "Why is " + shortTitle(top[0]) + "?", "Is this data live?"]);
      }

      if (intent === "first") {
        const s = actionable[0];
        if (!s) return reply("first", [{ type: "p", text: active.length ? "Everything open is already in hand — waiting on stock or payments." : "Nothing needs you right now." }], [], null, starters(ctx));
        return reply("first", [
          { type: "p", text: "Start with this: " + s.title.charAt(0).toLowerCase() + s.title.slice(1) + "." },
          { type: "p", text: "It's first because: " + s.priority.reasons.join("; ") + "." },
          { type: "p", text: "I can prepare it: " + s.recommendation.title + ". Nothing happens until you confirm." },
        ], [s.id], proposalFor(s), ["Why?", "What else?"]);
      }

      const s = pick(ctx, topics) || (!topics.length && (intent === "why" || intent === "fix") ? active[0] : null);

      if (!s) {
        const u = topics.length ? unavailableFor(ctx, topics[0]) : null;
        if (u) return reply("unavailable", [{ type: "p", text: u.reason + " " + u.unlock }], [], null, ["What needs my attention?"]);
        if (topics.length) return reply("clear", [{ type: "p", text: "Nothing on that needs you right now." }], [], null, starters(ctx));
        return reply("unknown", [
          { type: "p", text: "I answer from your records: stock, orders, customers" + (ctx.unavailable.some(function (u) { return u.id === "cash"; }) ? "" : " and money owed") + ". I can't see delivery or expiry yet." },
          { type: "p", text: "If this needs a person, I'll pass it on with everything attached." },
        ], [], { escalate: true, label: "Talk to a person" }, starters(ctx));
      }

      if (intent === "fix") {
        if (!s.recommendation) {
          return reply("fix", [{ type: "p", text: s.phase === "monitoring" ? s.title + " — already in hand. " + s.summary : "There's nothing I can prepare for this yet." }], [s.id], null, starters(ctx));
        }
        return reply("fix", [
          { type: "p", text: "I've prepared it: " + s.recommendation.title + "." },
          { type: "p", text: s.recommendation.description },
          { type: "p", text: "Review it and confirm — I won't do it for you.", tone: "muted" },
        ], [s.id], proposalFor(s), []);
      }

      /* why (default for a named topic) */
      return reply("why", [
        { type: "p", text: s.title + "." },
        { type: "list", items: s.why.map(function (w) { return { text: w }; }) },
        { type: "p", text: "Impact: " + s.impact.description + ". " + s.impact.calc },
        s.recommendation ? { type: "p", text: "What I'd do: " + s.recommendation.title + "." } : { type: "p", text: s.summary },
        note ? { type: "p", text: note, tone: "muted" } : null,
      ], [s.id], proposalFor(s), s.recommendation ? ["Fix it", "What else?"] : ["What else?"]);
    }

    function headline(ctx, active) {
      const crit = active.filter(function (s) { return s.severity === "critical"; }).length;
      const risks = active.filter(function (s) { return s.severity !== "opportunity"; }).length;
      const opps = active.length - risks;
      if (!active.length) return "Nothing needs you right now.";
      if (!risks) return "No risks right now — " + fmt.plural(opps, "opportunity", "opportunities") + " worth a look.";
      return fmt.plural(risks, "thing needs", "things need") + " you" + (crit ? ", " + crit + " of them critical" : "") +
        (opps ? ", and " + fmt.plural(opps, "opportunity", "opportunities") + " worth a look" : "") + ":";
    }
    function shortTitle(s) {
      return s.id === "stockout" ? "stock at risk" : s.id === "overdue" ? "money overdue" : s.id === "reorder-due" ? "a shop late"
        : s.id === "order-risk" ? "an order at risk" : s.id === "slow-stock" ? "stock not selling" : "this";
    }
    function starters(ctx) {
      return ["What needs my attention?", "What should I do first?", "Is this data live?"];
    }
    function cites(list) { return list.map(function (s) { return s.id; }); }
    function reply(intent, blocks, citeIds, proposal, suggestions) {
      return { intent: intent, blocks: blocks.filter(Boolean), cites: citeIds || [], proposal: proposal || null, suggestions: suggestions || [] };
    }

    return { ask: ask };
  }

  const API = { create: create };
  root.CTAssistant = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

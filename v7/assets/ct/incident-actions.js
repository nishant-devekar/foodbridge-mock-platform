/* ==========================================================================
   CONTROL TOWER · LEAD ACTIONS — every fix, built the way Reschedule is.

   Spec: context/control-tower/CONTROL_TOWER_INCIDENTS.md §6 (owner, 24 Sep
   2026). One pattern for all sixteen: a pane in the same card, the choices
   filled in from the incident, an optional note, who gets told, confirm in
   place, one write, a done card — and the delivery moves.

   Each action is a spec the delivery card renders; nothing here touches the
   DOM or storage:

     init(x, hint)   the choices, filled in (x = the incident in context)
     html(x, s, H)   the pane's body, from the helpers H
     go(x, s)        the button's words      ready(x, s) → error or null
     confirm(x, s)   what will happen: { main, small }
     commit(x, s)    what to write: { events, outbox, note, reschedule }
     done(x, s)      the done card: { title, sub, head, rows, pill, next }

   The same fact is written whoever makes the fix: the owner here, or the
   person on the ground in the delivery app, Live Tracking or Sales Orders.
   ========================================================================== */

(function (root) {
  "use strict";

  const MIN = 60000, HOUR = 3600000, DAY = 86400000;
  const esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  const IN = function () { return root.CTIncidents; };
  const rupees = function (n) { return IN().rupees(n); };
  const clock = function (ms) { return IN().clock(ms); };
  const plural = function (n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); };
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], WDL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const WINS = [{ id: "morning", label: "Morning", time: "8am – 12pm", from: 8, to: 12 },
                { id: "afternoon", label: "Afternoon", time: "12pm – 4pm", from: 12, to: 16 },
                { id: "evening", label: "Evening", time: "4pm – 8pm", from: 16, to: 20 }];
  const CHECK = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  /* ── days and windows, read in IST ──────────────────────────────────── */
  function dayAt(now, i) {
    const d = new Date(now + 5.5 * HOUR); d.setUTCHours(0, 0, 0, 0);
    return new Date(d.getTime() + i * DAY);
  }
  const isoOf = function (d) { return d.toISOString().slice(0, 10); };
  const istHour = function (now) { const d = new Date(now + 5.5 * HOUR); return d.getUTCHours() + d.getUTCMinutes() / 60; };
  const winOpen = function (now, dayIdx, w) { return dayIdx > 0 || istHour(now) < w.to; };
  const dayOpen = function (now, i) { return WINS.some(function (w) { return winOpen(now, i, w); }); };
  const dayName = function (d) { return WD[d.getUTCDay()] + ", " + d.getUTCDate() + " " + MO[d.getUTCMonth()]; };
  const dayPhrase = function (i, d) { return i === 0 ? "today" : i === 1 ? "tomorrow" : WDL[d.getUTCDay()]; };
  const at = function (d, h) { return new Date(d.getTime() + h * HOUR - 5.5 * HOUR).toISOString(); };

  /* ── the pane's controls: the Reschedule pane's own look ────────────── */
  const H = {
    h: function (t, first) { return '<h4 class="ct-rs-h' + (first ? "" : " ct-ap-h") + '">' + esc(t) + "</h4>"; },
    days: function (key, now, sel, label) {
      return H.h(label || "Select new delivery date", true) + '<div class="ct-rs-days" role="group" aria-label="' + esc(label || "Date") + '">' + [0, 1, 2, 3, 4].map(function (i) {
        const d = dayAt(now, i);
        return '<button type="button" class="ct-rs-day" data-pk="' + key + '" data-v="' + i + '" data-n="1" aria-pressed="' + (i === sel) + '"' + (dayOpen(now, i) ? "" : " disabled") + ">" +
          "<span>" + WD[d.getUTCDay()] + "</span><b>" + d.getUTCDate() + "</b><small>" + (i === 0 ? "Today" : i === 1 ? "Tomorrow" : "") + "</small></button>";
      }).join("") + "</div>";
    },
    wins: function (key, now, dayIdx, sel) {
      return '<h4 class="ct-rs-h is-win">Preferred time window</h4><div class="ct-rs-wins" role="group" aria-label="Preferred time window">' + WINS.map(function (w) {
        return '<button type="button" class="ct-rs-win" data-pk="' + key + '" data-v="' + w.id + '" aria-pressed="' + (w.id === sel) + '"' + (winOpen(now, dayIdx, w) ? "" : " disabled") + ">" +
          "<b>" + w.label + "</b><span>" + w.time + '</span><i class="ct-rs-ck" aria-hidden="true">' + CHECK + "</i></button>";
      }).join("") + "</div>";
    },
    /* One of a few: a card each, a title and a line under it. An option
       that can't be picked isn't shown; with one left, it isn't a question
       and says so as a line (owner, 24 Sep 2026: only what the decision
       needs). */
    opts: function (label, key, items, sel) {
      items = items.filter(function (o) { return !o.off; });
      if (!items.length) return "";
      if (items.length === 1) return H.fact(label, items[0].t + (items[0].s ? " · " + items[0].s : ""));
      return H.h(label) + '<div class="ct-ap-opts" role="radiogroup" aria-label="' + esc(label) + '">' + items.map(function (o) {
        return '<button type="button" class="ct-ap-opt" role="radio" data-pk="' + key + '" data-v="' + esc(o.v) + '" aria-checked="' + (String(o.v) === String(sel)) + '"' + (o.off ? " disabled" : "") + ">" +
          '<i aria-hidden="true"></i><span><b>' + esc(o.t) + "</b>" + (o.s ? "<small>" + esc(o.s) + "</small>" : "") + "</span></button>";
      }).join("") + "</div>";
    },
    /* Any of a list: a box each. Fewer than two is not a choice. */
    checks: function (label, key, items, set) {
      if (items.length < 2) return "";
      return H.h(label) + '<div class="ct-ap-checks">' + items.map(function (o) {
        const on = !!set[o.v];
        return '<button type="button" class="ct-ap-chk" data-ck="' + key + '" data-v="' + esc(o.v) + '" aria-pressed="' + on + '"' + (o.off ? " disabled" : "") + ">" +
          '<span class="ct-rs-box" aria-hidden="true">' + CHECK + "</span><span><b>" + esc(o.t) + "</b>" + (o.s ? "<small>" + esc(o.s) + "</small>" : "") + "</span></button>";
      }).join("") + "</div>";
    },
    /* Quantities, with − and + (never above what there is). */
    items: function (label, key, items, qty) {
      return H.h(label) + '<div class="ct-ap-items">' + items.map(function (o) {
        const q = qty[o.v] || 0;
        return '<div class="ct-ap-item"><span><b>' + esc(o.t) + "</b>" + (o.s ? "<small>" + esc(o.s) + "</small>" : "") + '</span><span class="ct-ap-step">' +
          '<button type="button" data-st="' + key + '" data-v="' + esc(o.v) + '" data-d="-1" aria-label="One less"' + (q <= 0 ? " disabled" : "") + ">−</button>" +
          '<b aria-live="polite">' + q + "</b>" +
          '<button type="button" data-st="' + key + '" data-v="' + esc(o.v) + '" data-d="1" data-max="' + (o.max || 999) + '" aria-label="One more"' + (q >= (o.max || 999) ? " disabled" : "") + ">+</button></span></div>";
      }).join("") + "</div>";
    },
    chips: function (label, key, items, sel) {
      return H.h(label) + '<div class="ct-ap-chips" role="radiogroup" aria-label="' + esc(label) + '">' + items.map(function (t) {
        return '<button type="button" class="ct-ap-chip" role="radio" data-pk="' + key + '" data-v="' + esc(t) + '" aria-checked="' + (t === sel) + '">' + esc(t) + "</button>";
      }).join("") + "</div>";
    },
    facts: function (items) {
      return '<div class="ct-dm-facts ct-ap-facts">' + items.filter(Boolean).map(function (f) { return "<div><b>" + esc(f[0]) + "</b><span>" + esc(f[1]) + "</span></div>"; }).join("") + "</div>";
    },
    text: function (label, key, value, ph, id) {
      return '<label class="ct-rs-l ct-ap-l" for="ct-ap-' + (id || key) + '">' + esc(label) + '</label><input class="ct-ap-in" id="ct-ap-' + (id || key) + '" data-tx="' + key + '" value="' + esc(value || "") + '" placeholder="' + esc(ph || "") + '" autocomplete="off">';
    },
    /* A decided thing, said once: no control. */
    fact: function (label, text) { return '<div class="ct-ap-quote ct-ap-fact"><small>' + esc(label) + "</small><p>" + esc(text) + "</p></div>"; },
    quote: function (label, text) { return '<div class="ct-ap-quote"><small>' + esc(label) + "</small><p>" + esc(text) + "</p></div>"; },
    msg: function (text) { return H.h("The message") + '<div class="ct-ap-msg">' + esc(text) + "</div>"; },
    note: function (key, value, ph, mic) {
      return '<label class="ct-rs-l" for="ct-ap-note">Add internal notes (optional)</label>' +
        '<div class="ct-rs-ta' + (mic ? " has-mic" : "") + '"><textarea id="ct-ap-note" data-tx="' + key + '" rows="3" maxlength="200" placeholder="' + esc(ph || "e.g. Confirmed on the phone.") + '">' + esc(value || "") + "</textarea>" +
        '<span class="ct-rs-count" data-count="' + key + '">' + (value || "").length + "/200</span>" +
        (mic ? '<button type="button" class="ct-dm-mic ct-rs-mic" data-a="ap-mic" aria-label="Speak your note" aria-pressed="false">' + mic + "</button>" : "") + "</div>" +
        '<p class="ct-dm-err ct-rs-err" role="alert" hidden></p>';
    },
    tell: function (key, on, title, small) {
      return '<label class="ct-rs-cb"><input type="checkbox" data-tg="' + key + '"' + (on ? " checked" : "") + '><span class="ct-rs-box" aria-hidden="true">' + CHECK + "</span>" +
        "<span><b>" + esc(title) + "</b>" + (small ? "<small>" + esc(small) + "</small>" : "") + "</span></label>";
    },
    photo: function (cap) { return '<div class="ct-ap-photo"><span>Photo at the door</span><span>Signature</span></div><p class="ct-ap-cap">' + esc(cap) + "</p>"; },
  };

  /* ── what every commit carries ─────────────────────────────────────── */
  function ev(x, id, data, note, extra) {
    return Object.assign({ type: "action." + id, by: "You", where: "Control Tower", how: "owner", note: note,
                           subject: { incident: x.inc.id, stopNo: x.subj ? x.subj.key : null, customerId: x.customerId || null, customer: x.name || null, van: x.van || null }, data: data || {} }, extra || {});
  }
  function wa(x, body, to) { return { customerId: to ? to.customerId : x.customerId, name: to ? to.title : x.name, channel: "whatsapp", kind: "incident", body: body }; }
  const orNull = function (v) { return v === undefined ? null : v; };

  /* ════════════════════════════════════════════════════════════════════
     THE SIXTEEN
     ════════════════════════════════════════════════════════════════════ */
  const A = {};

  /* When ─────────────────────────────────────────────────────────────── */
  A.reschedule = {
    title: "Reschedule Delivery",
    init: function (x, h) {
      let day = h && typeof h.day === "number" ? h.day : 1;
      if (!dayOpen(x.now, day)) day = 1;
      const w = WINS.filter(function (w) { return winOpen(x.now, day, w); })[0];
      return { day: day, win: w.id, note: (h && h.note) || "", notify: true };
    },
    fix: function (x, s) {
      if (!dayOpen(x.now, s.day)) s.day = 1;
      if (!winOpen(x.now, s.day, WINS.filter(function (w) { return w.id === s.win; })[0])) s.win = WINS.filter(function (w) { return winOpen(x.now, s.day, w); })[0].id;
    },
    html: function (x, s) {
      A.reschedule.fix(x, s);
      return H.days("day", x.now, s.day) + H.wins("win", x.now, s.day, s.win) + H.note("note", s.note, "e.g. Customer asked for tomorrow morning. Confirmed on phone.", x.mic);
    },
    go: function () { return "Reschedule Delivery"; },
    confirm: function (x, s) {
      const d = dayAt(x.now, s.day), w = WINS.filter(function (y) { return y.id === s.win; })[0];
      return { main: "Move to <b>" + esc(dayName(d)) + " · " + esc(w.time) + "</b>", small: s.notify ? x.name + " will get a WhatsApp confirmation." : "The customer won't be told." };
    },
    commit: function (x, s) {
      const d = dayAt(x.now, s.day), w = WINS.filter(function (y) { return y.id === s.win; })[0];
      const date = isoOf(d);
      const note = "Rescheduled · " + (s.day === 0 ? "today" : s.day === 1 ? "tomorrow" : WD[d.getUTCDay()]) + " " + w.label.toLowerCase();
      return { note: note,
        events: [ev(x, "reschedule", { date: date, window: w.id, notify: s.notify, due: s.day === 0 ? at(d, w.to) : null }, note)],
        outbox: s.notify ? [wa(x, "Hello " + x.name + ", your FoodBridge delivery is now on " + WDL[d.getUTCDay()] + " " + d.getUTCDate() + " " + MO[d.getUTCMonth()] + ", " + w.time + ".")] : [],
        reschedule: { date: date, window: w.id, note: s.note.trim() || null, notify: s.notify } };
    },
    done: function (x, s) {
      const d = dayAt(x.now, s.day), w = WINS.filter(function (y) { return y.id === s.win; })[0];
      return { title: "Delivery Rescheduled!", sub: "The delivery has been moved to " + dayPhrase(s.day, d) + " " + w.label.toLowerCase() + ".", head: "Rescheduled delivery",
        rows: [["Customer", x.name], ["Date", dayName(d) + " " + d.getUTCFullYear()], ["Time", w.time], x.value ? ["Order value", rupees(x.value)] : null], pill: "Scheduled" };
    },
  };

  A.retry = {
    title: "Try Again Today",
    init: function (x, h) {
      const later = !!(h && h.after === "later");
      const o = A.retry.options(x, { later: later });
      const want = h && h.after ? h.after : o[0] && o[0].v;
      return { later: later, after: (o.filter(function (y) { return y.v === want && !y.off; })[0] || o.filter(function (y) { return !y.off; })[0] || {}).v, notify: true, tellDriver: true, note: "" };
    },
    /* When the van can be back: after its next stop, two stops, the end of
       its round, or after 4 pm if the shop asked. Past the route's end is off. */
    options: function (x, s) {
      const left = x.vanStops || [];
      const t = function (i) { const s = left[i]; return s ? new Date(s.slot).getTime() + 12 * MIN : null; };
      const end = x.routeEnd || (x.now + 3 * HOUR);
      const nextAt = Math.max(x.now + 25 * MIN, t(0) || x.now + 25 * MIN);
      const twoAt = Math.max(x.now + 45 * MIN, t(1) || x.now + 50 * MIN);
      const fourPm = new Date(at(dayAt(x.now, 0), 16.25)).getTime();
      return [{ v: "next", t: "After the next stop", at: nextAt },
              { v: "two", t: "After 2 stops", at: twoAt, off: left.length < 2 },
              { v: "later", t: "After 4 pm, as the shop asked", at: fourPm, off: !(s && s.later) },   /* only when the call said so */
              { v: "end", t: "At the end of the route", at: end }].map(function (o) {
        /* Only a time the van can still make: not in the next 20 minutes,
           not after its round is over. */
        o.off = o.off || o.at > end + 30 * MIN || o.at < x.now + 20 * MIN; o.s = "about " + clock(o.at); return o;
      });
    },
    html: function (x, s) {
      return H.opts("When should " + (x.van || "the van") + " go back?", "after", A.retry.options(x, s), s.after);
    },
    ready: function (x, s) { return A.retry.options(x, s).some(function (o) { return o.v === s.after && !o.off; }) ? null : "Pick when the van goes back."; },
    pick: function (x, s) { const o = A.retry.options(x, s); return o.filter(function (y) { return y.v === s.after; })[0] || o.filter(function (y) { return !y.off; })[0] || o[o.length - 1]; },
    go: function () { return "Put Back on Route"; },
    confirm: function (x, s) {
      const o = A.retry.pick(x, s);
      return { main: (x.van || "The van") + " goes back at <b>about " + esc(clock(o.at)) + "</b>", small: [s.tellDriver ? (x.driver || "The driver") + " is told in the app" : null, s.notify ? x.name + " gets a WhatsApp" : null].filter(Boolean).join("; ") + "." };
    },
    commit: function (x, s) {
      const o = A.retry.pick(x, s);
      const note = "Back on " + (x.van || "the route") + " · about " + clock(o.at);
      return { note: note, events: [ev(x, "retry", { after: o.v, at: new Date(o.at).toISOString(), due: new Date(o.at + 90 * MIN).toISOString(), tellDriver: s.tellDriver }, note)],
        outbox: s.notify ? [wa(x, "Hello " + x.name + ", our van will come back to you today at about " + clock(o.at) + ".")] : [] };
    },
    done: function (x, s) {
      const o = A.retry.pick(x, s);
      return { title: "Back on Today's Route!", sub: (x.van || "The van") + " goes back at about " + clock(o.at) + ".", head: "Delivery",
        rows: [["Customer", x.name], ["Van", [x.van, x.driver].filter(Boolean).join(" · ")], ["Expected", "about " + clock(o.at)], x.value ? ["Order value", rupees(x.value)] : null], pill: "On the route" };
    },
  };

  A.move = {
    title: "Move to Another Van",
    stops: function (x) { return x.held && x.held.length ? x.held : x.subj ? [x.subj] : []; },
    init: function (x) {
      const st = A.move.stops(x), set = {};
      /* The stops due soonest: those before 2 hours from now, at least one. */
      const v = (x.vans || []).filter(function (y) { return !y.off; })[0];
      let room = v && typeof v.room === "number" ? v.room : 999;
      st.forEach(function (s, i) {
        const c = Number(s.cases) || 0;
        if (i < 3 && (i === 0 || !s.slot || new Date(s.slot).getTime() < x.now + 2 * HOUR) && c <= room) { set[s.key] = 1; room -= c; }
      });
      return { stops: set, to: v ? v.van : null, notify: true, tellDrivers: true };
    },
    html: function (x, s) {
      const st = A.move.stops(x);
      return H.checks("Which stops?", "stops", st.map(function (y) {
        return { v: y.key, t: y.title, s: [y.slot ? "due " + clock(new Date(y.slot).getTime()) : null, y.cases ? plural(y.cases, "case") : null, y.value ? rupees(y.value) : null].filter(Boolean).join(" · ") };
      }), s.stops) +
        H.opts("To which van?", "to", (x.vans || []).map(function (v) { return { v: v.van, t: v.van + (v.driver ? " · " + v.driver : ""), s: v.s, off: v.off }; }), s.to);
    },
    chosen: function (x, s) { return A.move.stops(x).filter(function (y) { return s.stops[y.key]; }); },
    ready: function (x, s) {
      const ch = A.move.chosen(x, s);
      if (!ch.length) return "Tick at least one stop.";
      if (!s.to) return "Pick a van with room.";
      const v = (x.vans || []).filter(function (y) { return y.van === s.to; })[0] || {};
      const need = ch.reduce(function (n, y) { return n + (Number(y.cases) || 0); }, 0);
      return typeof v.room === "number" && need > v.room ? s.to + " has room for " + v.room + " cases; these need " + need + ". Untick a stop." : null;
    },
    go: function (x, s) { const n = A.move.chosen(x, s).length; return n ? "Move " + plural(n, "Stop") : "Move Stops"; },
    first: function (x) { return x.now + 25 * MIN; },
    confirm: function (x, s) {
      const ch = A.move.chosen(x, s), v = (x.vans || []).filter(function (y) { return y.van === s.to; })[0] || {};
      const sum = ch.reduce(function (n, y) { return n + (Number(y.value) || 0); }, 0);
      return { main: "Move <b>" + plural(ch.length, "stop") + (sum ? " (" + esc(rupees(sum)) + ")" : "") + " to " + esc(s.to) + "</b>",
               small: "First drop about " + clock(A.move.first(x)) + "." + (s.tellDrivers ? " " + [v.driver, x.driver].filter(Boolean).join(" and ") + " are told." : "") + (s.notify ? " " + plural(ch.length, "customer") + " get a WhatsApp." : "") };
    },
    commit: function (x, s) {
      const ch = A.move.chosen(x, s), v = (x.vans || []).filter(function (y) { return y.van === s.to; })[0] || {};
      const note = plural(ch.length, "stop") + " moved to " + s.to;
      const moved = { type: "stops.moved", by: "You", where: "Control Tower", how: "owner", subject: { incident: x.inc.id, van: x.van || null }, data: { stops: ch.map(function (y) { return y.key; }), to: s.to, driver: v.driver || null } };
      return { note: note,
        events: [moved, ev(x, "move", { stops: ch.map(function (y) { return y.key; }), to: s.to, at: new Date(A.move.first(x)).toISOString() }, note)],
        outbox: s.notify ? ch.filter(function (y) { return y.customerId; }).map(function (y) { return wa(x, "Hello " + y.title + ", your FoodBridge delivery is now on " + s.to + " and will reach you soon.", y); }) : [] };
    },
    done: function (x, s) {
      const ch = A.move.chosen(x, s), v = (x.vans || []).filter(function (y) { return y.van === s.to; })[0] || {};
      const sum = ch.reduce(function (n, y) { return n + (Number(y.value) || 0); }, 0);
      const left = A.move.stops(x).length - ch.length;
      return { title: "Stops Moved!", sub: plural(ch.length, "stop") + " " + (ch.length === 1 ? "is" : "are") + " on " + s.to + " now.", head: "Moved",
        rows: [["Stops", plural(ch.length, "stop") + (sum ? " · " + rupees(sum) : "")], ["To", s.to + (v.driver ? " · " + v.driver : "")], ["First drop", "about " + clock(A.move.first(x))], left ? ["Still on " + (x.van || "the van"), plural(left, "stop")] : null], pill: "On " + s.to };
    },
  };

  A.tell = {
    title: "Tell Customers",
    list: function (x) {
      const st = x.held && x.held.length ? x.held : x.subj ? [x.subj] : [];
      const behind = (x.inc.facts && x.inc.facts.lateMin) || 30;
      return st.map(function (y, i) {
        const slot = y.slot ? new Date(y.slot).getTime() : x.now;
        const t = Math.max(x.now + (i + 1) * 15 * MIN, slot + behind * MIN);
        return { key: y.key, title: y.title, slot: slot, at: Math.round(t / (5 * MIN)) * 5 * MIN, subj: y };
      });
    },
    init: function (x) { const set = {}; A.tell.list(x).forEach(function (y) { set[y.key] = 1; }); return { who: set }; },
    html: function (x, s) {
      const L = A.tell.list(x);
      return H.checks("Who should hear?", "who", L.map(function (y) { return { v: y.key, t: y.title, s: "was " + clock(y.slot) + " → now " + clock(y.at) }; }), s.who);
    },
    chosen: function (x, s) { return A.tell.list(x).filter(function (y) { return s.who[y.key]; }); },
    ready: function (x, s) { return A.tell.chosen(x, s).length ? null : "Tick at least one customer."; },
    go: function (x, s) { const n = A.tell.chosen(x, s).length; return "Send to " + plural(n, "Customer"); },
    span: function (ch) { const a = ch.map(function (y) { return y.at; }); return clock(Math.min.apply(null, a)) + (a.length > 1 ? " – " + clock(Math.max.apply(null, a)) : ""); },
    confirm: function (x, s) { const ch = A.tell.chosen(x, s); return { main: "Send to <b>" + plural(ch.length, "customer") + " on WhatsApp</b>", small: "New time" + (ch.length > 1 ? "s " : " ") + A.tell.span(ch) + "." }; },
    commit: function (x, s) {
      const ch = A.tell.chosen(x, s), times = {};
      ch.forEach(function (y) { times[y.key] = new Date(y.at).toISOString(); });
      const note = plural(ch.length, "customer") + " told the new time";
      return { note: note, events: [ev(x, "tell", { times: times }, note)],
        outbox: ch.filter(function (y) { return y.subj.customerId; }).map(function (y) { return wa(x, "Hello " + y.title + ", today's FoodBridge delivery will reach you around " + clock(y.at) + ", a little later than planned. Sorry for the wait.", y.subj); }) };
    },
    done: function (x, s) { const ch = A.tell.chosen(x, s); return { title: "Customers Told!", sub: plural(ch.length, "customer") + " know" + (ch.length === 1 ? "s" : "") + " the new time.", head: "Sent", rows: [["Customers", String(ch.length)], ["New times", A.tell.span(ch)], ["Channel", "WhatsApp"]], pill: "Queued" }; },
  };

  /* Goods ────────────────────────────────────────────────────────────── */
  const ITEMS = function (x) {
    const it = (x.items && x.items.length ? x.items : x.lines || []).slice(0, 6);
    return it.length ? it : [{ name: "Items from the order", qty: Math.max(1, (x.inc.facts && x.inc.facts.cases) || 1), unit: "case" }];
  };
  const itemRows = function (x) { return ITEMS(x).map(function (l, i) { return { v: String(i), t: l.name, s: l.note || (l.unit ? l.qty + " " + l.unit : ""), max: Math.max(l.qty * 3, 1) }; }); };
  const itemQty = function (x) { const q = {}; ITEMS(x).forEach(function (l, i) { q[String(i)] = l.qty; }); return q; };
  const itemText = function (x, q) {
    const it = ITEMS(x), bits = [];
    it.forEach(function (l, i) { if (q[String(i)] > 0) bits.push(q[String(i)] + " × " + l.name); });
    return bits.join(", ") || "nothing";
  };
  const units = function (q) { return Object.keys(q).reduce(function (n, k) { return n + (q[k] || 0); }, 0); };
  const isShort = function (x) { return x.inc.type === "short-quantity" || x.inc.type === "stock-not-loaded" || x.inc.type === "missing-stock"; };

  A.send = {
    title: "Send on Next Trip",
    init: function (x) {
      /* The customer's own van, as on their usual trip. */
      const own = (x.vans || []).filter(function (y) { return y.van === x.van; })[0];
      const v = own || (x.vans || []).filter(function (y) { return !y.off; })[0] || (x.vans || [])[0];
      return { qty: itemQty(x), day: 1, van: v ? v.van : null, charge: isShort(x) ? "ordered" : "free", notify: true };
    },
    html: function (x, s) {
      return H.items(isShort(x) ? "What to send (the balance)" : "What to send", "qty", itemRows(x), s.qty) +
        H.days("day", x.now, s.day, "Which trip?");
    },
    ready: function (x, s) { return units(s.qty) ? null : "Add at least one item."; },
    go: function () { return "Add to Trip"; },
    when: function (x, s) { const d = dayAt(x.now, s.day); return dayName(d) + " · 8am – 12pm"; },
    confirm: function (x, s) {
      return { main: "Add <b>" + esc(itemText(x, s.qty)) + "</b> to " + esc(s.van || "the next trip") + ", " + esc(A.send.when(x, s)),
               small: (s.charge === "free" ? "No charge." : "Charged as ordered.") + (s.notify ? " " + x.name + " gets a WhatsApp." : "") };
    },
    commit: function (x, s) {
      const d = dayAt(x.now, s.day);
      const note = (s.charge === "free" ? "Replacement" : "Balance") + " on " + (s.day === 1 ? "tomorrow's" : dayName(d) + "'s") + " trip";
      return { note: note, events: [ev(x, "send", { items: itemText(x, s.qty), date: isoOf(d), van: s.van, charge: s.charge }, note)],
        outbox: s.notify ? [wa(x, "Hello " + x.name + ", we're sending " + itemText(x, s.qty) + " on " + A.send.when(x, s) + ".")] : [] };
    },
    done: function (x, s) {
      return { title: "Added to the Next Trip!", sub: "It goes out " + (s.day === 1 ? "tomorrow morning" : A.send.when(x, s)) + ".", head: s.charge === "free" ? "Replacement" : "Balance",
        rows: [["Customer", x.name], ["Items", itemText(x, s.qty)], ["Trip", A.send.when(x, s)], ["Charge", s.charge === "free" ? "No charge" : "As ordered"]], pill: "Booked" };
    },
  };

  A.takeBack = {
    title: "Take It Back",
    init: function (x) {
      const t = x.inc.type;
      return { qty: itemQty(x), dest: /expir/.test(t) || t === "temperature" ? "throw" : /damag|leak|wet|broken/.test(t) ? "damaged" : "stock", credit: !!x.paid, tellDriver: true };
    },
    html: function (x, s) {
      const expired = /expir/.test(x.inc.type);
      return H.items("What comes back", "qty", itemRows(x), s.qty) +
        H.opts("Where does it go?", "dest", [{ v: "stock", t: "Back into stock", s: "It can still be sold", off: expired }, { v: "damaged", t: "Damaged stock", s: "Claim from the supplier" }, { v: "throw", t: "Throw away", s: "It can't be used" }], s.dest);

    },
    dests: { stock: "back into stock", damaged: "damaged stock", throw: "be thrown away" },
    ready: function (x, s) { return units(s.qty) ? null : "Add at least one item."; },
    go: function () { return "Record Return"; },
    confirm: function (x, s) {
      return { main: "<b>" + esc(itemText(x, s.qty)) + "</b> to " + A.takeBack.dests[s.dest] + " at settlement", small: s.credit && x.inc.impact.rupees ? rupees(x.inc.impact.rupees) + " credit to " + x.name + "." : "No credit." };
    },
    commit: function (x, s) {
      const note = "Coming back on " + (x.van || "the van") + (s.credit && x.inc.impact.rupees ? " · " + rupees(x.inc.impact.rupees) + " credited" : "");
      return { note: note, events: [ev(x, "takeBack", { items: itemText(x, s.qty), dest: s.dest, credit: s.credit ? x.inc.impact.rupees || 0 : 0 }, note)], outbox: [] };
    },
    done: function (x, s) {
      return { title: "Return Recorded!", sub: (x.driver || "The driver") + " brings it back tonight.", head: "Return",
        rows: [["Items", itemText(x, s.qty)], ["Goes to", A.takeBack.dests[s.dest].replace(/^be /, "")], s.credit && x.inc.impact.rupees ? ["Credit", rupees(x.inc.impact.rupees)] : null], pill: "Coming back on " + (x.van || "the van") };
    },
  };

  A.cancel = {
    title: "Cancel Delivery",
    init: function (x, h) { return { why: (h && h.why) || "Doesn't want it", note: "", notify: true }; },
    html: function (x, s) {
      return H.chips("Why?", "why", ["Doesn't want it", "Ordered by mistake", "Duplicate order", "Other"], s.why);
    },
    go: function () { return "Cancel Delivery"; },
    danger: true,
    confirm: function (x, s) { return { main: "Cancel <b>" + esc(x.value ? rupees(x.value) + " for " : "") + esc(x.name) + "</b>", small: "The goods come back on " + (x.van || "the van") + " and go back into stock." }; },
    commit: function (x, s) {
      const note = "Cancelled · " + s.why.toLowerCase();
      return { note: note, events: [ev(x, "cancel", { why: s.why }, note, { resolved: "Cancelled · goods back on " + (x.van || "the van") })],
        outbox: s.notify ? [wa(x, "Hello " + x.name + ", as agreed, today's FoodBridge delivery is cancelled.")] : [] };
    },
    done: function (x) { return { title: "Delivery Cancelled", sub: "It leaves today's deliveries.", head: "Cancelled delivery", rows: [["Customer", x.name], x.value ? ["Order value", rupees(x.value)] : null, ["Goods", "Back into stock"]], pill: "Cancelled", grey: true }; },
  };

  A.writeOff = {
    title: "Write Off",
    init: function (x) { return { why: "Lost", who: "business" }; },
    value: function (x) { return x.inc.impact.rupees || 0; },
    html: function (x, s) {
      return H.opts("Who bears it?", "who", [{ v: "business", t: "The business", s: "Written off to stock loss" }, { v: "driver", t: "Recover from the driver", s: "From " + (x.driver || "the driver") + "'s settlement" }, { v: "supplier", t: "Claim from the supplier", s: "If it came short or faulty" }], s.who);
    },
    who: { business: "the business", driver: "recovered from the driver", supplier: "claimed from the supplier" },
    go: function (x) { return "Write Off " + rupees(A.writeOff.value(x)); },
    confirm: function (x, s) { return { main: "Write off <b>" + esc(rupees(A.writeOff.value(x))) + "</b>", small: "Borne by " + A.writeOff.who[s.who] + "." }; },
    commit: function (x, s) {
      const note = "Written off " + rupees(A.writeOff.value(x)) + " · " + A.writeOff.who[s.who];
      return { note: note, events: [ev(x, "writeOff", { value: A.writeOff.value(x), why: s.why, borneBy: s.who }, note, { resolved: note })], outbox: [] };
    },
    done: function (x, s) { return { title: "Written Off", sub: "Stock is adjusted.", head: "Write-off", rows: [["Value", rupees(A.writeOff.value(x))], ["Why", s.why], ["Borne by", A.writeOff.who[s.who]]], pill: "Adjusted" }; },
  };

  /* Order and customer ────────────────────────────────────────────────── */
  A.fixOrder = {
    title: "Fix the Order",
    init: function (x) { return { qty: itemQty(x), why: /dispute/.test(x.inc.type) ? "Customer disputes it" : "Customer changed it", bill: true, tellDriver: x.subj && x.subj.status === "missed" }; },
    total: function (x, s) {
      const it = ITEMS(x);
      const priced = it.every(function (l) { return typeof l.price === "number"; });
      if (priced) return it.reduce(function (n, l, i) { return n + (s.qty[String(i)] || 0) * l.price; }, 0);
      const was = units(itemQty(x));
      return was ? Math.round((x.value || 0) * units(s.qty) / was) : x.value || 0;
    },
    html: function (x, s) {
      return H.items("The order", "qty", ITEMS(x).map(function (l, i) { return { v: String(i), t: l.name, s: "booked " + l.qty + (l.unit ? " " + l.unit : ""), max: l.qty * 3 }; }), s.qty);

    },
    ready: function (x, s) { return units(s.qty) ? null : "An order needs at least one item. To drop it, cancel the delivery."; },
    go: function () { return "Save Order"; },
    confirm: function (x, s) {
      const now = A.fixOrder.total(x, s), was = x.value || 0, diff = was - now;
      return { main: "New total <b>" + esc(rupees(now)) + "</b>" + (diff ? " (" + rupees(Math.abs(diff)) + (diff > 0 ? " less)" : " more)") : ""), small: (s.bill ? x.name + " gets the new bill." : "No new bill sent.") + (s.tellDriver ? " " + (x.driver || "The driver") + " delivers it." : "") };
    },
    commit: function (x, s) {
      const now = A.fixOrder.total(x, s);
      const note = "Order fixed · " + rupees(now) + (s.tellDriver ? " · delivering" : "");
      return { note: note, events: [ev(x, "fixOrder", { was: x.value || 0, now: now, items: itemText(x, s.qty), why: s.why }, note)],
        outbox: s.bill ? [wa(x, "Hello " + x.name + ", here is your corrected bill: " + itemText(x, s.qty) + ", " + rupees(now) + ".")] : [] };
    },
    done: function (x, s) { return { title: "Order Updated!", sub: s.tellDriver ? (x.driver || "The driver") + " delivers the fixed order." : "The bill matches the order now.", head: "Order", rows: [["Customer", x.name], ["Was", rupees(x.value || 0)], ["Now", rupees(A.fixOrder.total(x, s))]], pill: s.bill ? "Bill resent" : "Saved" }; },
  };

  A.fixCustomer = {
    title: "Customer Details",
    init: function (x) { return { address: x.address || "", landmark: "", unload: "", hours: "", gstin: "", here: false, next: !!(x.subj && x.subj.status === "missed") }; },
    html: function (x, s) {
      const f = A.fixCustomer.fields(x);
      return (f.address ? H.text("Address", "address", s.address, "Shop no., street, area", "addr") + H.text("Landmark", "landmark", s.landmark, "e.g. Opposite the bus stop", "lm") : "") +
        (f.unload ? H.text("Where to unload", "unload", s.unload, "e.g. Side gate, lane behind", "ul") : "") +
        (f.hours ? H.text("Delivery hours", "hours", s.hours, "e.g. 9am – 1pm", "hr") : "") +
        (f.gstin ? H.text("GSTIN", "gstin", s.gstin, "15 characters", "gst") : "");
    },
    /* Only the details this problem is about. */
    fields: function (x) {
      const t = x.inc.type;
      return t === "gst-mismatch" ? { gstin: 1 } : t === "no-parking" ? { unload: 1 } : t === "access-restriction" ? { hours: 1 }
        : t === "address-inaccessible" ? { address: 1, unload: 1 } : { address: 1 };
    },
    ready: function (x, s) {
      if (s.gstin && !/^[0-9A-Z]{15}$/i.test(s.gstin.trim())) return "A GSTIN is 15 letters and numbers.";
      return (s.address || s.landmark || s.unload || s.hours || s.gstin || s.here) ? null : "Change at least one detail.";
    },
    go: function () { return "Save Details"; },
    confirm: function (x, s) { return { main: "Save the new details for <b>" + esc(x.name) + "</b>", small: s.next ? "Then reschedule." : "They're used from the next trip." }; },
    commit: function (x, s) {
      const note = "Details saved" + (s.address ? " · " + s.address.split(",")[0] : "");
      return { note: note, events: [ev(x, "fixCustomer", { address: s.address, landmark: s.landmark, unload: s.unload, hours: s.hours, gstin: s.gstin, pinned: s.here }, note,
        /gst/.test(x.inc.type) ? { resolved: "Billing details corrected" } : {})], outbox: [], next: s.next ? "reschedule" : null };
    },
    done: function (x, s) { return { title: "Details Saved", sub: s.next ? "Now pick when to go back." : "Used from the next trip.", head: "Customer", rows: [["Customer", x.name], s.address ? ["Address", s.address] : null, s.hours ? ["Hours", s.hours] : null], pill: "Saved", next: s.next ? "reschedule" : null }; },
  };

  /* Money ──────────────────────────────────────────────────────────────── */
  A.adjust = {
    title: "Price Adjustment",
    init: function (x, h) { return { decision: (h && h.decision) || "once", notify: true }; },
    f: function (x) { const f = x.inc.facts || {}; const gap = Number(f.gap) || x.inc.impact.rupees || 0; return { billed: Number(f.billed) || x.value || 0, paid: Number(f.paid) || Math.max(0, (x.value || 0) - gap), gap: gap, why: f.why || "They say the scheme rate is lower" }; },
    html: function (x, s) {
      const f = A.adjust.f(x);
      return H.facts([[rupees(f.billed), "Billed"], [rupees(f.paid), "Paid"], [rupees(f.gap), "Gap"]]) + H.quote("Customer says", f.why) +
        H.opts("Your decision", "decision", [{ v: "once", t: "Approve this once", s: "A credit note of " + rupees(f.gap) }, { v: "always", t: "Approve and use this price from now", s: "Updates their price list" }, { v: "refuse", t: "Don't approve", s: "Collect " + rupees(f.gap) + " on the next visit" }], s.decision);

    },
    go: function (x, s) { const f = A.adjust.f(x); return s.decision === "refuse" ? "Collect " + rupees(f.gap) : "Approve " + rupees(f.gap); },
    confirm: function (x, s) {
      const f = A.adjust.f(x);
      return s.decision === "refuse" ? { main: "Collect <b>" + esc(rupees(f.gap)) + "</b> from " + esc(x.name) + " on the next visit", small: "It goes to Collections." }
        : { main: "Approve <b>" + esc(rupees(f.gap)) + (s.decision === "once" ? " once" : " and the new price") + "</b> for " + esc(x.name), small: s.decision === "once" ? "A credit note is raised; the price list doesn't change." : "A credit note is raised, and their price list uses the new rate." };
    },
    commit: function (x, s) {
      const f = A.adjust.f(x);
      const note = s.decision === "refuse" ? rupees(f.gap) + " with Collections" : "Approved " + (s.decision === "once" ? "once" : "for good") + " · " + rupees(f.gap) + " credit";
      return { note: note, events: [ev(x, "adjust", { decision: s.decision, gap: f.gap }, note, { resolved: note })],
        outbox: s.notify ? [wa(x, s.decision === "refuse" ? "Hello " + x.name + ", the " + rupees(f.gap) + " difference on today's bill will be collected on the next visit." : "Hello " + x.name + ", we've approved the " + rupees(f.gap) + " difference on today's bill.")] : [] };
    },
    done: function (x, s) { const f = A.adjust.f(x); return { title: s.decision === "refuse" ? "Balance Added to Collections" : "Adjustment Approved", sub: s.decision === "refuse" ? "Collections chases it from here." : "A " + rupees(f.gap) + " credit note is raised.", head: "Adjustment", rows: [["Customer", x.name], ["Gap", rupees(f.gap)], ["Decision", { once: "Approved once", always: "Approved, new price", refuse: "Collect it" }[s.decision]]], pill: s.decision === "refuse" ? "With Collections" : "Credit note raised" }; },
  };

  A.creditNote = {
    title: "Credit Note",
    init: function (x) { return { why: /expir/.test(x.inc.type) ? "Expired" : /damag|leak|wet|broken/.test(x.inc.type) ? "Damaged" : /price/.test(x.inc.type) ? "Price" : /scheme/.test(x.inc.type) ? "Scheme" : "Short", off: true, send: true }; },
    amount: function (x) { return x.inc.impact.rupees || Math.round((x.value || 0) * 0.1); },
    html: function (x, s) {
      return "";
    },
    go: function () { return "Raise Credit Note"; },
    confirm: function (x, s) { const a = A.creditNote.amount(x); return { main: "<b>" + esc(rupees(a)) + " credit</b> to " + esc(x.name), small: (s.off && x.owed ? "Taken off their " + rupees(x.owed) + " outstanding. " : "") + (s.send ? "Sent on WhatsApp." : "") }; },
    commit: function (x, s) {
      const a = A.creditNote.amount(x), note = rupees(a) + " credited · " + s.why.toLowerCase();
      return { note: note, events: [ev(x, "creditNote", { amount: a, why: s.why, offOutstanding: s.off }, note, { resolved: note })],
        outbox: s.send ? [wa(x, "Hello " + x.name + ", a credit note of " + rupees(a) + " (" + s.why.toLowerCase() + ") has been raised for you.")] : [] };
    },
    done: function (x, s) { const a = A.creditNote.amount(x); return { title: "Credit Note Raised", sub: x.owed && s.off ? x.name + " now owes " + rupees(Math.max(0, x.owed - a)) + "." : "It's on their account.", head: "Credit note", rows: [["Customer", x.name], ["Amount", rupees(a)], ["Reason", s.why]], pill: "Adjusted" }; },
  };

  A.collectLater = {
    title: "Collect Later",
    init: function () { return { when: "next", who: "driver", remind: true }; },
    fix: function (s) { s.who = s.when === "next" ? "driver" : "counter"; },
    amount: function (x) { return x.inc.impact.rupees || x.value || 0; },
    html: function (x, s) {
      return H.opts("When?", "when", [{ v: "next", t: "At the next delivery", s: dayName(dayAt(x.now, 1)) + ", by the driver" }, { v: "week", t: "Within the week", s: "By " + dayName(dayAt(x.now, 6)) + ", at the counter" }], s.when);
    },
    go: function () { return "Plan Collection"; },
    whenText: function (x, s) { return s.when === "next" ? dayName(dayAt(x.now, 1)) : "by " + dayName(dayAt(x.now, 6)); },
    confirm: function (x, s) { A.collectLater.fix(s); return { main: "Collect <b>" + esc(rupees(A.collectLater.amount(x))) + " from " + esc(x.name) + "</b> " + esc(A.collectLater.whenText(x, s)), small: (s.who === "driver" ? "By the driver." : "At the counter.") + (s.remind ? " Reminder on WhatsApp now." : "") }; },
    commit: function (x, s) {
      const note = rupees(A.collectLater.amount(x)) + " with Collections · " + A.collectLater.whenText(x, s);
      return { note: note, events: [ev(x, "collectLater", { amount: A.collectLater.amount(x), when: s.when, who: s.who }, note, { resolved: "Delivered · " + note })],
        outbox: s.remind ? [wa(x, "Hello " + x.name + ", a gentle reminder: " + rupees(A.collectLater.amount(x)) + " is due. You can pay by UPI with this link.")] : [] };
    },
    done: function (x, s) { return { title: "Added to Collections", sub: "Collections chases it from here.", head: "Collection", rows: [["Customer", x.name], ["Amount", rupees(A.collectLater.amount(x))], ["When", A.collectLater.whenText(x, s)], ["Who", s.who === "driver" ? "The driver" : "At the counter"]], pill: "Planned" }; },
  };

  A.credit = {
    title: "Over Credit Limit",
    init: function (x, h) { return { decision: (h && h.decision) || "first", reason: "", tellDriver: true, remind: true }; },
    f: function (x) { const f = x.inc.facts || {}; return { limit: Number(f.limit) || 0, owed: Number(f.owed) || x.owed || 0, ask: Number(f.ask) || Math.max(0, (Number(f.owed) || 0) - (Number(f.limit) || 0)) }; },
    html: function (x, s) {
      const f = A.credit.f(x);
      return H.facts([[rupees(f.limit), "Limit"], [rupees(f.owed), "Owed"], [rupees(x.value || 0), "Today"]]) +
        H.opts("Your decision", "decision", [{ v: "first", t: "Collect first", s: (x.driver || "The driver") + " takes " + rupees(f.ask) + " before unloading" }, { v: "once", t: "Deliver this once", s: "Needs a reason" }, { v: "raise", t: "Raise their limit", s: "To " + rupees(Math.ceil((f.owed + (x.value || 0)) / 5000) * 5000) }], s.decision) +
        (s.decision === "once" ? H.text("Why this once?", "reason", s.reason, "e.g. Paying on Friday, confirmed on phone", "why") : "");
    },
    ready: function (x, s) { return s.decision === "once" && !s.reason.trim() ? "Say why you're allowing it this once." : null; },
    go: function (x, s) { return { first: "Collect First", once: "Allow Once", raise: "Raise Limit" }[s.decision]; },
    confirm: function (x, s) {
      const f = A.credit.f(x);
      return s.decision === "first" ? { main: (x.driver || "The driver") + " collects <b>" + esc(rupees(f.ask)) + " before unloading</b> at " + esc(x.name), small: s.remind ? "They get a payment reminder now." : "" }
        : s.decision === "once" ? { main: "Deliver <b>once</b> to " + esc(x.name) + " over the limit", small: "Reason: " + s.reason.trim() }
        : { main: "Raise " + esc(x.name) + "'s limit to <b>" + esc(rupees(Math.ceil((f.owed + (x.value || 0)) / 5000) * 5000)) + "</b>", small: "From today's delivery on." };
    },
    commit: function (x, s) {
      const f = A.credit.f(x);
      const note = s.decision === "first" ? "Collect " + rupees(f.ask) + " first" : s.decision === "once" ? "Allowed once · " + s.reason.trim() : "Limit raised";
      return { note: note, events: [ev(x, "credit", { decision: s.decision, ask: f.ask, reason: s.reason.trim() || null }, note)],
        outbox: s.remind ? [wa(x, "Hello " + x.name + ", please keep " + rupees(f.ask) + " ready for today's delivery. Thank you.")] : [] };
    },
    done: function (x, s) { const f = A.credit.f(x); return { title: { first: "Collect First", once: "Allowed Once", raise: "Limit Raised" }[s.decision], sub: s.decision === "first" ? (x.driver || "The driver") + " sees it when he reaches them." : "Delivering as planned.", head: "Credit", rows: [["Customer", x.name], ["Owed", rupees(f.owed)], ["Decision", A.credit.go(x, s)]], pill: "Set" }; },
  };

  /* People and proof ──────────────────────────────────────────────────── */
  const QUESTIONS = {
    "excess-quantity": ["Where did the extra cases come from?", "Did a customer refuse them?", "Were they loaded twice?"],
    "missing-item": ["Where did the missing items go?", "Were they damaged on the way?", "Were they given to another shop?"],
    "partial-acceptance": ["Why did they take less?", "Will they take the rest tomorrow?"],
    "puncture": ["How long until the van moves?", "Do you need help?"],
    "traffic-delay": ["How far behind are you?", "Can you skip ahead to a nearer stop?"],
    "pod-missing": ["Please add the photo or signature.", "Who took the delivery?"],
    "crates": ["Please collect the crates on the next trip.", "How many crates did they keep?"],
  };
  A.ask = {
    title: "Ask the Team",
    people: function (x) { return [{ v: x.driver || "Driver", t: x.driver || "The driver", s: "Driver" + (x.van ? " · " + x.van : "") }, { v: "Ravi", t: "Ravi", s: "Warehouse" }]; },
    qs: function (x) { return QUESTIONS[x.inc.type] || ["What happened here?", "Can you sort it on the next trip?"]; },
    init: function (x) { return { to: A.ask.people(x)[0].v, q: A.ask.qs(x)[0], own: "", wa: true }; },
    html: function (x, s) {
      return H.opts("Who?", "to", A.ask.people(x), s.to) + H.chips("Question", "q", A.ask.qs(x), s.q);
    },
    question: function (s) { return s.own.trim() || s.q; },
    go: function (x, s) { return "Ask " + s.to; },
    confirm: function (x, s) { return { main: "Ask <b>" + esc(s.to) + "</b>: " + esc(A.ask.question(s)), small: "In the delivery app" + (s.wa ? ", WhatsApp if offline." : ".") }; },
    commit: function (x, s) { const note = "Asked " + s.to + ": " + A.ask.question(s); return { note: note, events: [ev(x, "ask", { to: s.to, question: A.ask.question(s) }, note)], outbox: [] }; },
    done: function (x, s) { return { title: "Question Sent", sub: s.to + "'s answer will show here.", head: "Question", rows: [["To", s.to], ["Question", A.ask.question(s)]], pill: "Waiting" }; },
  };

  A.proof = {
    title: "Proof of Delivery",
    init: function () { return { bill: true }; },
    html: function (x, s) {
      const d = x.subj && x.subj.last;
      return H.photo("Taken by " + ((d && d.driver) || x.driver || "the driver") + (d ? " · " + clock(new Date(d.at).getTime()) : ""));
    },
    go: function () { return "Send Proof"; },
    confirm: function (x, s) { const d = x.subj && x.subj.last; return { main: "Send the proof of delivery" + (d ? " at <b>" + esc(clock(new Date(d.at).getTime())) + "</b>" : "") + " to " + esc(x.name), small: "On WhatsApp" + (s.bill ? ", with the bill." : ".") }; },
    commit: function (x, s) { const note = "Proof sent to " + x.name; return { note: note, events: [ev(x, "proof", { bill: s.bill }, note)], outbox: [wa(x, "Hello " + x.name + ", here is the photo and signature from today's delivery.")] }; },
    done: function (x) { const d = x.subj && x.subj.last; return { title: "Proof Sent", sub: "Waiting for " + x.name + " to confirm.", head: "Proof", rows: [["Customer", x.name], d ? ["Delivered", clock(new Date(d.at).getTime()) + (d.driver ? " · " + d.driver : "")] : null, ["Proof", "Photo + signature"]], pill: "Sent" }; },
  };

  /* Closing a talk-only problem: what the owner heard is the proof. */
  A.close = {
    title: "Close It",
    words: { agreed: "Settled with the customer", settled: "Settled on the call", explained: "Explained" },
    init: function (x, h) { return { how: (h && h.how) || "explained" }; },
    html: function () { return ""; },
    go: function () { return "Close"; },
    confirm: function (x, s) { return { main: "Close it as <b>" + esc(A.close.words[s.how].toLowerCase()) + "</b>", small: "" }; },
    commit: function (x, s) { const note = A.close.words[s.how]; return { note: note, events: [ev(x, "close", { how: s.how }, note, { resolved: note })], outbox: [] }; },
    done: function (x, s) { return { title: "Closed", sub: A.close.words[s.how] + ".", head: "Closed", rows: [["Item", x.name]], pill: "Done" }; },
  };

  /* An action is offered only when it can do something: nothing to move,
     nobody to tell, no button (owner, 24 Sep 2026). */
  A.move.available = function (x) { return A.move.stops(x).length > 0 && (x.vans || []).some(function (v) { return !v.off; }); };
  A.tell.available = function (x) { return A.tell.list(x).length > 0; };
  A.retry.available = function (x) { return A.retry.options(x, {}).some(function (o) { return !o.off; }); };

  const API = { A: A, H: H, WINS: WINS, dayAt: dayAt, isoOf: isoOf, esc: esc, orNull: orNull };
  root.CTLeadActions = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

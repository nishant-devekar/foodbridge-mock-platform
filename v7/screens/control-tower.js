/* ==========================================================================
   CONTROL TOWER — what needs you today.

   THE SCREEN THE FLOW ALREADY PROMISED. `drawCreated()`'s button has read
   "Open your control tower" since the UI flip, with a comment conceding it
   handed off to the dashboard until one existed. This is that screen.

   IT IS NOT A DASHBOARD. A dashboard shows everything and asks the user to
   find the problem. This shows the few things worth acting on, ranked, and
   each one names the screen that proves it. If nothing is worth acting on it
   says so, rather than filling the space.

   CADENCE, NOT CASH. This tenant's export has no invoice or payment evidence
   (D-015), so there is no rupee figure anywhere on this screen — and the
   absence is stated plainly at the foot rather than left as a gap the viewer
   has to notice. A number we cannot stand behind is worse than a gap.

   THE LOOP CLOSES HERE. Acting on a nudge, or dismissing it, is remembered;
   the next load ranks differently. That is the difference between an
   assistant and a report.
   ========================================================================== */

(function () {
  "use strict";

  var ROOT_ID = "ct-root";

  var lu = function (d) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  };
  var ICON = {
    check: lu('<path d="M20 6 9 17l-5-5"/>'),
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* The frame that owns the platform's hash is not always `window.top` — the
     IVR simulator frames the platform. Climb until one answers to FBPlatform. */
  function platformWin() {
    var w = window;
    for (var up = 0; up < 4; up++) {
      var next;
      try { next = w.parent; } catch (e) { return null; }
      if (!next || next === w) return null;
      w = next;
      try { if (w.FBPlatform) return w; } catch (e) { /* keep climbing */ }
    }
    return null;
  }

  function handoff(route) {
    var pw = platformWin();
    if (pw) { try { pw.location.hash = "#/" + route; return; } catch (e) { /* fall through */ } }
    window.location.href = "../index.html#/" + route;
  }

  /* Whose business this is. The account onboarding wrote, if this browser has
     been through it — otherwise nothing, and the screen simply says "your
     business" rather than inventing a name. */
  function who() {
    var raw = null;
    try { raw = sessionStorage.getItem("fb.v7.account") || localStorage.getItem("fb.v7.account"); } catch (e) {}
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function greeting() {
    var h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }

  /* "a 88-day cycle" reads wrong. English takes the article from the SOUND,
     and 8, 11 and 18 all begin with a vowel sound however they are spelled. */
  function article(n) {
    var d = String(n);
    if (d[0] === "8") return "an";
    if (d === "11" || d === "18" || (d.length === 4 && d.slice(0, 2) === "11")) return "an";
    return "a";
  }

  function shopRow(s) {
    var sub = s.daysOverdue + (s.daysOverdue === 1 ? " day" : " days") +
      " past " + article(s.cycleDays) + " " + s.cycleDays + "-day cycle";
    var pill = s.suggestion && s.suggestion.count
      ? '<span class="pill">' + s.suggestion.count + " suggested</span>"
      : '<span class="pill is-flat">no recent history</span>';
    return '<div class="row"><div class="row-b">' +
      '<div class="row-t">' + esc(s.name) + "</div>" +
      '<div class="row-s">' + esc(sub) + "</div>" +
    "</div>" + pill + "</div>";
  }

  function nudgeCard(n, lead) {
    var detail = "";

    /* The lead nudge earns its space by naming names. A headline with no rows
       under it is a claim; three rows make it checkable. */
    if (lead && n.id === "off_cadence" && n.detail && n.detail.shops.length) {
      /* Show the ones we can actually help with. The list is sorted by days
         overdue, and the MOST overdue are precisely the ones whose history is
         too stale to predict from (D-017) — so slicing the top three put three
         "no recent history" rows directly under a sentence promising twenty we
         could act on. The card's button says "Review the list"; the rows under
         it should be what reviewing gets you. */
      var actionable = n.detail.shops.filter(function (s) { return s.suggestion && s.suggestion.count; });
      var show = (actionable.length ? actionable : n.detail.shops).slice(0, 3);
      detail = '<div class="rows" style="margin-top:.85rem">' + show.map(shopRow).join("") + "</div>";

      var rest = (actionable.length ? actionable.length : n.detail.shops.length) - show.length;
      var tail = [];
      if (rest > 0) tail.push(rest + " more like these");
      if (actionable.length && n.detail.stale) {
        tail.push(n.detail.stale + " with nothing recent enough to suggest from");
      }
      if (tail.length) {
        detail += '<p class="dim" style="margin:.6rem 0 0">' + esc(tail.join(", and ")) + "</p>";
      }
    }

    return '<article class="card' + (lead ? " is-lead" : "") + '" data-nudge="' + esc(n.id) + '">' +
      '<h2 class="card-t">' + esc(n.title) + "</h2>" +
      '<p class="card-x">' + esc(n.explanation) + "</p>" +
      (n.evidence ? '<p class="card-e">' + esc(n.evidence) + "</p>" : "") +
      detail +
      '<div class="card-f">' +
        '<button class="btn" data-go="' + esc(n.route) + '" data-id="' + esc(n.id) + '">' +
          esc(n.recommendedAction) + "</button>" +
        '<button class="btn is-quiet" data-dismiss="' + esc(n.id) + '">Not now</button>' +
      "</div>" +
    "</article>";
  }

  function draw() {
    var root = document.getElementById(ROOT_ID);
    if (!root) return;

    var snap = window.FBContext.snapshot();
    var list = window.FBNudges.all();
    var acct = who();
    var name = acct && acct.name ? String(acct.name).split(" ")[0] : null;
    var biz = acct && acct.business ? acct.business : null;

    var head =
      '<header class="top">' +
        '<div class="eyebrow">What needs you today</div>' +
        '<h1 class="h1">' + esc(greeting()) + (name ? ", " + esc(name) : "") + "</h1>" +
        '<p class="sub">' +
          (biz ? esc(biz) + " — " : "") +
          "I checked " + snap.ordersKnown.toLocaleString("en-IN") + " orders across " +
          snap.customers + " customers." +
        "</p>" +
      "</header>";

    var strip =
      '<div class="strip">' +
        '<div class="stat"><div class="stat-n">' + snap.offCadence + "</div>" +
          '<div class="stat-l">off their cycle</div></div>' +
        '<div class="stat"><div class="stat-n">' + snap.suggestable + "</div>" +
          '<div class="stat-l">ready to reorder</div></div>' +
        '<div class="stat"><div class="stat-n">' + snap.outOfStock + "</div>" +
          '<div class="stat-l">out of stock</div></div>' +
      "</div>";

    var body;
    if (!list.length) {
      /* An empty tower is a real outcome, and saying so is the point. */
      body =
        '<article class="card">' +
          '<h2 class="card-t">Nothing needs you right now</h2>' +
          '<p class="card-x">Everything I watch is where it should be. ' +
            "I’ll message you when that changes.</p>" +
          '<div class="card-f"><button class="btn is-ghost" id="ct-reset">Show what I dismissed</button></div>' +
        "</article>";
    } else {
      body = list.map(function (n, i) { return nudgeCard(n, i === 0); }).join("");
    }

    /* D-015, said out loud. The viewer should not have to notice an absence. */
    var absent =
      '<div class="absent">' +
        "<b>No money figures here, on purpose.</b> This business’s records are orders — " +
        "there are no invoices or payments in them, so FoodBridge will not show what is owed. " +
        "Connect an accounts source and that changes." +
      "</div>";

    root.innerHTML =
      '<div class="app">' + head +
        '<main class="main">' +
          strip +
          '<div class="sec-h">' + (list.length ? "Worth acting on" : "All clear") + "</div>" +
          body +
          absent +
          '<p class="dim">Worked out from this business’s own orders, against today’s date.</p>' +
        "</main>" +
      "</div>";

    Array.prototype.forEach.call(root.querySelectorAll("[data-go]"), function (el) {
      el.addEventListener("click", function () {
        window.FBNudges.acted(el.getAttribute("data-id"));
        handoff(el.getAttribute("data-go"));
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-dismiss]"), function (el) {
      el.addEventListener("click", function () {
        window.FBNudges.dismiss(el.getAttribute("data-dismiss"));
        draw();                                  // the loop, visibly closing
      });
    });
    var rs = document.getElementById("ct-reset");
    if (rs) rs.addEventListener("click", function () { window.FBNudges.reset(); draw(); });
  }

  function mount() {
    var root = document.getElementById(ROOT_ID);
    if (root) {
      root.innerHTML = '<div class="app"><header class="top">' +
        '<div class="eyebrow">What needs you today</div>' +
        '<h1 class="h1">Reading your business…</h1></header></div>';
    }
    window.FBContext.ready().then(draw).catch(function (e) {
      if (!root) return;
      root.innerHTML = '<div class="app"><main class="main"><article class="card">' +
        '<h2 class="card-t">I could not read the records</h2>' +
        '<p class="card-x">' + esc(e.message) + "</p></article></main></div>";
    });
  }

  window.FBControlTower = { mount: mount };
})();

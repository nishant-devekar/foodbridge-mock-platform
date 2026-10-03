# Production board

**Production › Production board** (`production.html`, `board.js`, `board.css`, on `flow.css`) is one page for the day and the week. Built 28 Sep 2026, it replaces three pages: Production Plan, Shifts and Shop Floor. After the owner's review it was cut to what reads at a glance, and **it starts nothing itself**.

**Today** (the default). One line under the title: *n on the floor · n to start · n need you*.
- **Needs you:** one line each, and one thing to do: **call** the person who can sort it. Each call is a `tel:` link with the name and number.
  - A worker's help call → **Call the worker**.
  - A weighing step over its loss limit → **Call the worker who weighed it**.
  - A step nobody has picked up, or a batch on hold → **Call the batch's supervisor**.
  - Material short for what's planned (all in one line) → **Call the purchase person**.

  Lines clear themselves when the floor moves on: the call is sorted, the step is picked up, the stock or the order covers the plan, a loss is a day old.
- **Today's shifts** (29 Sep 2026, replacing the three columns below): the same Not scheduled list as Week (schedule right here), then the Week's roster, today's row. Kept for history — **On the floor → To start → Done today** (retired):
  - **On the floor:** each batch with a progress bar and one line of what's happening now: who, on what, since when, or which step is waiting and for how long.
  - **To start today:** batches in today's slots, with the slot and its in-charge; one card counts the batches not scheduled and opens Week.
  - (Before 29 Sep: all planned batches.) The card opens the batch in **Batches**, where its own **Start** (with the supervisor hand-over and Confirm) begins production. That Start puts the batch's steps on today's shift, morning or evening by the time of day, for the crew who are in (`FB_PRODUCTION.releaseToFloor` → `D.releaseToFloor` → `D.startOnFloor`).
  - **Done today:** kg into the freezer, bags, loss %.
  - Any card opens its batch in Batches.
- **Crew today:** who's in and what they're on, plus the worker-app QR.

**Week** (29 Sep 2026, simplified the same day after the owner's review: "confusing"): a roster of the shifts.
- **Not scheduled** (built to stay usable when the list is long): soonest due first, one line each — due (amber within 2 days, red today or overdue) · name · size · number · hours — then its **suggested shift in words** and **Schedule**; **Change** swaps the words for a picker (later shifts say "after due"). The five most urgent show until **Show all n ›**. **Schedule all as suggested** asks once, then puts every batch in its suggestion. Suggestions are made for the whole list together, soonest due first, counting the hours already suggested, so Schedule all never overfills a shift; the header counts any that can't fit before they're due.
- **The roster:** a row per day, a column per shift (Morning 7 am – 3 pm, Evening 3 pm – 11 pm, and any shift added in settings); on a phone, a card per day. Each shift shows **its in-charge · n people** (**Manage ›**), Running now / Stopped / Handed over / Waiting to take over, its batches as All batches shows them (name, number, size, the same status badges), and how full it is ("2.5 h of 8 h booked", or amber "11 h of work · 3 h more than the shift"). A batch opens in Batches. A day off can be worked (**Work this day**); a cancelled shift can be **Put back**.
- **Manage (one shift):** in charge and people (Save changes), its batches with **Move to another shift…** (or back to Not scheduled), and one question at a time: Hand over to the next shift (a note), Stop (why), Resume, Cancel (why).
- **Shift settings:** the shifts every working day has — name, start, end (overnight is fine), in charge, usual people — **＋ Add a shift** (e.g. Night 11 pm – 7 am), Edit, Remove (refused while batches are planned in it), and the working days. Changes apply to coming days that haven't been changed by hand. Overlapping shifts are refused.
- **One name everywhere:** a batch's supervisor is its shift's in-charge (scheduling, or changing a shift's in-charge, updates it), and All batches' Due column shows its shift ("Morning shift · 29 Sept") or **Not scheduled**.
- **Today · Week · All batches** are fixed tabs from `v7/assets/production-tabs.js`, mounted by this page and by Batches right under the page header, followed by the view's first line (date · what it is · its main button); they sit at the same place on every view. All batches opens Batches. Since 29 Sep 2026 Batches has no sidebar line (`"hidden": true` in `modules.json`); this is how it's reached. `#/production/production-board?view=week` opens Week, also when the board is already open.

Below the shifts, **the plan** (the old Production Plan): 1 what will we sell · 2 what to make, where **Create N kg batch ›** opens Batches' own **Create batch** form with the recipe and size filled in · 3 what to buy, with one **Call** to the purchase person.

The board refreshes when the floor writes the store, and every 30 s. `#/production-plan`, `#/shifts`, `#/shop-floor` (and their `production/…` forms) land here. Real cost per kg and loss by step and by worker are in **Overview › Reports › Production Report**.

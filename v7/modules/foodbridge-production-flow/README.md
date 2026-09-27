# Production board

**Production › Production board** (`production.html`, `board.js`, `board.css`, on `flow.css`) is one page for the day and the week. Built 28 Sep 2026, it replaces three pages: Production Plan, Shifts and Shop Floor. After the owner's review it was cut to what reads at a glance, and **it starts nothing itself**.

**Today** (the default). One line under the title: *n on the floor · n to start · n need you*.
- **Needs you:** one line each, and one thing to do: **call** the person who can sort it. Each call is a `tel:` link with the name and number.
  - A worker's help call → **Call the worker**.
  - A weighing step over its loss limit → **Call the worker who weighed it**.
  - A step nobody has picked up, or a batch on hold → **Call the batch's supervisor**.
  - Material short for what's planned (all in one line) → **Call the purchase person**.

  Lines clear themselves when the floor moves on: the call is sorted, the step is picked up, the stock or the order covers the plan, a loss is a day old.
- **On the floor → To start → Done today:**
  - **On the floor:** each batch with a progress bar and one line of what's happening now: who, on what, since when, or which step is waiting and for how long.
  - **To start:** Planned batches. The card opens the batch in **Batches**, where its own **Start** (with the supervisor hand-over and Confirm) begins production. That Start puts the batch's steps on today's shift, morning or evening by the time of day, for the crew who are in (`FB_PRODUCTION.releaseToFloor` → `D.releaseToFloor` → `D.startOnFloor`).
  - **Done today:** kg into the freezer, bags, loss %.
  - Any card opens its batch in Batches.
- **Crew today:** who's in and what they're on, plus the worker-app QR.

**This week** (the old Production Plan): 1 what will we sell · 2 what to make, where **Create N kg batch ›** opens Batches' own **Create batch** form with the recipe and size filled in · 3 what to buy, with one **Call** to the purchase person.

The board refreshes when the floor writes the store, and every 30 s. `#/production-plan`, `#/shifts`, `#/shop-floor` (and their `production/…` forms) land here. Real cost per kg and loss by step and by worker are in **Overview › Reports › Production Report**.

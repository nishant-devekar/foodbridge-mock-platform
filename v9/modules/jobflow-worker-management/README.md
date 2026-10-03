# JobFlow: the shop floor of Production

HTML versions of the two JobFlow clients by Nidhimehta9399 (received as a zip, 26 Sep 2026), made part of **Production** that same day under the owner's "JobFlow in Production" decisions.

| Now | Page | From |
| --- | --- | --- |
| Process Steps → the Recipes leaf's **Process** tab (28 Sep 2026) | `recipe-steps.js` in Recipes | JobFlow's Workflow Editor, bound to recipes |
| Shifts and Shop Floor → **Production › Production board** (28 Sep 2026) | [`foodbridge-production-flow/production.html`](../foodbridge-production-flow/production.html) | JobFlow's Shifts and Dashboard |
| Worker App (standalone `#/worker-app`, by QR) | [`worker-app/`](worker-app/index.html) | JobFlow's worker PWA |

**The admin app is retired (28 Sep 2026).** `admin-web/` (its Shifts, Shop Floor, sign-in and Process Steps), `shared/floor.css` and `shared/frame.css` are deleted. Its jobs moved to the Production board (plan, crew, floor, alerts, worker-app QR) and to Recipes › Process. A shift is no longer made by hand: a batch's **Start** in Batches puts its steps on today's morning or evening shift (`D.releaseToFloor`). What is left here is the Worker App and `shared/ui.js`, which it uses.

The data is the platform's production store, [`v7/assets/production/`](../../assets/production/README.md), shared with:
- Recipes
- Batch Management
- Freezer Stock
- the inventories
- Workforce Management

## What changed from the React apps, and why

- **Batches come from Batch Management.** JobFlow's own Batches page is gone. Shifts lists Planned, In Progress and On Hold batches (`PB-` production, `PK-` packing). The floor moves them: the first step started makes a batch In Progress, the last step done makes it Completed.
- **Workers come from Workforce Management.** They are staff with a factory role: washer, blancher, dough maker or packer.
- **Process Steps are per recipe.** Each step can record:
  - weight in and out, with a loss limit;
  - raw material taken from the store, oldest lot first;
  - sticks used;
  - big bags filled, which go into Freezer Stock;
  - packets packed from the oldest bags, then into cartons and Finished Goods.

  A **Packing** workflow runs every packing order.

  Since 28 Sep 2026 these are edited in **Recipes → Process**, over the same API routes. Packing shows there as a closed section every recipe shares.
- **The worker app records how much.** Task detail shows:
  - the lot or bags the step will take;
  - kg in and out, with the loss checked live against the limit;
  - the bags it will make, or the packets packed;
  - after the step, what was recorded.

  A held batch shows a banner and can't be started.
- **Shop Floor replaces the Dashboard.** It shows every batch on a live shift, by line, with each step's who · kg · lot · time. Beside the lanes are the floor's alerts (weight loss over the limit, a step waiting 20+ minutes, a batch on hold), the freezer, and the worker app QR.
- **No role restriction** (owner). Any worker on a live shift can take any available step; the step's role is a label.
- **Live and Analytics are gone.** They were placeholders.

## The worker app (28 Sep 2026)

The worker app was redesigned to the **Job Workflow — Worker App** mockup (`jobwork-worker-app.html`). The same day it was cut down after a review from the worker's side. It no longer matches the React build; the admin still does.

**Rule:** the worker app helps, it never judges. Loss %, time taken and waiting alerts belong on the office screens.

- **Loop:** PIN → Home → Work → Done → Next work → … → My day → End my day. From Work, "Need help" goes out and back.
- **Home:**
  - While working: only that work, with Continue.
  - When free: one card, "Your next work", with the worker's own role first. The rest sit folded under "Other work (n)".
  - The header shows the shift and "n done ✓". A strip appears only when there is no internet.
- **Work:**
  - The step name is the title, with the product and kg under it.
  - Then how to do it, and what to take (lot, or bags oldest first).
  - A weighed step asks for **weight before at Start**, stored as `kgInStart` on the task, and **weight after at Done**.
  - Start and Done stay locked until the numbers are in, and the button says what's missing.
  - There is no timer, no nag, and no loss verdict.
- **Need help:** three big buttons: Material finished, Machine problem, Call supervisor. One tap sends it, and the worker sees "Supervisor told". It shows on Shop Floor → Needs you as **needs help** until the worker taps "Sorted" or finishes the work.
- **Done:** "Well done!", "n done today", what you entered read back, then **Next: …** straight into the next work.
- **No dead ends** (owner, 28 Sep 2026: "he is stuck"):
  - Home always has **My day** at the foot, even while working, with no shift, or after an error. From My day the worker can sign out and change language.
  - Signing out is never locked. With work running, My day offers Continue or Sign out, and the confirmation says the work stays open in their name, where the supervisor can see it.
  - Home looks for new work every 30 s, when the phone wakes, and when another screen writes the store. "No work open" also has **↻ Check again**.
  - Load errors have **↻ Try again**.
  - If someone else takes the work first, Start shows who has it instead of a Start button that keeps failing.
  - After a wrong PIN: "Forgot your PIN? Ask your supervisor."
- **My day:** the worker's own work comes first. While working, the work in hand shows with **Continue →**. When free, all open work is listed and one tap opens it. Language is only the small pill in the header.
  - "n works done today" and "Signed in at …", which is the first sign-in of the day on this phone.
  - The list of what you did.
  - "End my day" signs out. While work is running the button is "Sign out", and its confirmation says the work stays open in their name.
- **Look:** plain CSS in [`worker-app/app.css`](worker-app/app.css): teal `#1B6272`, green `#43A047`, canvas `#f0f2f5`, Inter. Everything a worker must read is at least 13px and dark.
- **API additions:**
  - Claim takes `{ kgIn }`, and complete falls back to it.
  - `GET /api/tasks/:id` adds `nextStep`, `updates` and `help`.
  - Every task carries `updateCount`.
  - Updates also take `sorted`.
  - `/api/alerts` raises `help` alerts.
- **Every submit is confirmed in place** (no pop-ups). The button the worker tapped turns into the question, with what will be saved read back, then **Change / ✓ Yes**:
  - Start: "Start this work now?" (with the weight before)
  - Done: "Is this work finished?" (with every number entered)
  - Need help: the tapped problem opens "Send this to your supervisor?" under it
  - Sorted: "Is the problem sorted?" inside the banner
  - End my day: "End your day and sign out?"

  Editing a number cancels a question already asked, so what is confirmed is what is saved.
- **Languages:** English, हिंदी and मराठी. Every fixed word is in [`worker-app/i18n.js`](worker-app/i18n.js) (one table per language, English as the fallback), including role names and the API messages a worker can meet.
  - The switch is a small pill at the top right of sign-in (as in the mockup) and of My day. The phone remembers the choice (`fb.v7.jobflow.lang`).
  - Times and dates follow the language but keep 0–9 digits, as on the scale and the stickers. Devanagari uses Noto Sans Devanagari.
  - Step names, instructions and product names are data: they show as the office typed them. Type them in Hindi or Marathi in Process Steps to have them read that way.
- **Same-run packs (29 Sep 2026):** a batch with packs set to *In the same run* has a **Pack the planned packs** step before the fill step: one number per pack, filled in with the plan (`GET /api/tasks/:id` adds `sameRun`, `madeKg`, `packedKg`), refused if it's more than was made. The fill step then starts at **the rest** (made − packed) with the sum shown. A batch recorded in the office never reaches the phones.
- **Not built yet:**
  - A voice note per step, which needs a recorder on Process Steps.
  - Pause, Undo, photos.

## Inside the platform

- The worker app is standalone and full-bleed, drawn in a phone frame on a big screen, and opened from the QR in the Production board's **Crew today**.

## Signing in

- **Worker app:** phone number + PIN. Any formatting of the number works; the last 10 digits are matched. After the first sign-in, the phone remembers the worker and their number, and asks only for the PIN. "Use a sample worker" signs in with one tap and no PIN.

| Phone | PIN | Name | Role |
| --- | --- | --- | --- |
| 5550510001 | 1111 | Asha | washer |
| 5550510002 | 2222 | Ravi | dough maker (making dough now) |
| 5550510003 | 3333 | Meena | packer (a packing order waiting) |
| 5550510004 | 4444 | Suresh | washer |
| 5550510005 | 5555 | Farida | blancher (blanch waiting) |
| 5550510006 | 6666 | Kiran | packer |

Staff added in Workforce Management with a factory role sign in with their phone number. Their PIN is the last 4 digits of that number.

## Pixel parity with the React builds

The first cut was checked against the zip's `dist/` builds in headless Chrome: 36 screens and states, 0 px different where the build matched the source.

Screens the integration changed (Shop Floor, Process Steps, Shifts, Task detail) no longer match by design. The admin sign-in, including its error states, still matches at **0 px**. The worker app was redesigned on 28 Sep 2026 and no longer matches.

How exactness is kept, for anyone editing:
- `admin.css` is the build's own compiled Tailwind, unmodified. (The worker app left pixel parity on 28 Sep 2026; see above.)
- `shared/ui.js` gives every `{expression}` its own DOM text node, as React does, and follows JSX's whitespace rule.
- Keep every tag on one line in the render functions.

When changing anything here, bump every `?v=` token together: the two `index.html` files, the leaf URLs in `assets/modules.json`, and `platform.js` in `v7/index.html`.

# JobFlow: the shop floor of Production

HTML versions of the two JobFlow clients by Nidhimehta9399 (received as a zip, 26 Sep 2026), made part of **Production** that same day under the owner's "JobFlow in Production" decisions.

| Production leaf | Page | From |
| --- | --- | --- |
| Process Steps: retired as a leaf 28 Sep 2026, now the Recipes leaf's **Process** tab (`recipe-steps.js`) | [`admin-web/`](admin-web/index.html) `#/steps` still works on its own | JobFlow's Workflow Editor, bound to recipes |
| Shifts | `admin-web/` `#/shifts` | JobFlow's Shifts |
| Shop Floor | `admin-web/` `#/` | JobFlow's Dashboard, rebuilt |
| Worker App (standalone `#/worker-app`, by QR) | [`worker-app/`](worker-app/index.html) | JobFlow's worker PWA |

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

## The worker app's look (28 Sep 2026)

The worker app was redesigned to the **Job Workflow — Worker App** mockup (`jobwork-worker-app.html`). It no longer matches the React build; the admin still does.

- **Loop:** PIN → Shift dashboard → Task detail → In progress ⇄ Add update → Step complete → … → My shift → Close shift. One main action per screen, in a white bar at the foot.
- **Look:** plain CSS in [`worker-app/app.css`](worker-app/app.css). Petrol teal `#1B6272`, go green `#43A047`, grey canvas `#f0f2f5` under white cards, Inter. The compiled Tailwind `worker.css` is gone.
- **Sign in:** the phone remembers its last worker, so it asks only for the PIN ("Not Asha? Switch worker"). The keypad is ⌫ · 0 · ✓, and the 4th digit signs in. The sample sign-in list is unchanged in behaviour.
- **Dashboard:** the shift's progress and time left stay in the header. My current task (teal edge) sits over the pool (green edge). While a task is in hand, the pool is greyed out, because the API refuses a second claim.
- **In progress:** a live timer against the expected minutes. After 20 minutes with no update, an "Update due" nudge appears. The last update is shown, then the Record card (weights, lots, bags, packets), then the instructions. The actions are ✅ Mark done and 💬 Add update.
- **Add update:** the six quick checks the API takes, plus an optional note (`POST /api/tasks/:id/updates`).
- **Step complete:** a full green screen showing what was recorded and the next step it opened, or "Batch complete".
- **My shift:** your tasks done, time on tasks, batches and updates, all from the record. Close shift signs out on the phone; the shift itself stays live for the office.
- **API additions** (`GET /api/tasks/:id`): `nextStep` and `updates`. Every task also carries `updateCount`.
- **Left out of the mockup on purpose:**
  - The Hindi toggle: step names and instructions are English data.
  - Pause: there is no pause in the domain.
  - Undo: completing a step moves stock.
  - The photo: there is nowhere to store it.
  - The score ring and "Top 15%": there is no data behind them.
  - The tab bar: only Home would work.

## Inside the platform

- The admin's own 240px sidebar is clipped (`clipLeft` / `clipLeftMobile` 240). Its pages are Production leaves, which differ by `?at=`, so every switch is a real page load. On a phone, its "Signed in as" bar sits under the platform header (`mHeaderH` 61).
- The worker app is standalone and full-bleed, drawn in a phone frame on a big screen, and opened from the QR on Shop Floor and Shifts.
- `shared/frame.css` fits both to the shell (the EXIT DEMO inset, and dialogs between the bands), and only when the shell sets its insets.
- `shared/floor.css` styles everything the integration added, in plain CSS on JobFlow's palette.

## Signing in

- **Admin:** opens signed in as the seeded admin. After Sign out, use `admin@jobflow.local` / `admin1234`.
- **Worker app:** name + PIN (names are matched without case). After the first sign-in, the phone remembers the worker and asks only for the PIN.

| Name | PIN | Role |
| --- | --- | --- |
| Asha | 1111 | washer |
| Ravi | 2222 | dough maker (making dough now) |
| Meena | 3333 | packer (a packing order waiting) |
| Suresh | 4444 | washer |
| Farida | 5555 | blancher (blanch waiting) |
| Kiran | 6666 | packer |

Staff added in Workforce Management with a factory role sign in with their name and the last 4 digits of their phone.

## Pixel parity with the React builds

The first cut was checked against the zip's `dist/` builds in headless Chrome: 36 screens and states, 0 px different where the build matched the source.

Screens the integration changed (Shop Floor, Process Steps, Shifts, Task detail) no longer match by design. The admin sign-in, including its error states, still matches at **0 px**. The worker app was redesigned on 28 Sep 2026 and no longer matches.

How exactness is kept, for anyone editing:
- `admin.css` is the build's own compiled Tailwind, unmodified. (The worker app left pixel parity on 28 Sep 2026; see above.)
- `shared/ui.js` gives every `{expression}` its own DOM text node, as React does, and follows JSX's whitespace rule.
- Keep every tag on one line in the render functions.

When changing anything here, bump every `?v=` token together: the two `index.html` files, the leaf URLs in `assets/modules.json`, and `platform.js` in `v7/index.html`.

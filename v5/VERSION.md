# FoodBridge mock platform — Version 5

**Frozen 30 August 2026, with one standing exception.** A self-contained snapshot: the shell
plus a local copy of every module screen it shows. Nothing here loads from a module team's
GitHub Pages site, so this folder renders the same however those repos change afterwards.

**The exception is Stock Audit.** Customer Management → Stock Audit is authored in `v6` and
mirrored back into this cut at each freeze, so its files here are deliberately *not* the
30 August bytes. Every other file is. The decision was taken on 4 September 2026: the screen
is worked on across `v4`, `v5` and `v6` at once, and letting this copy drift would have forked
it silently. Mirrored files — `stock-audit.html`, `stock-audit.js`, `stock-audit.css`,
`shell.js`, `seed.inline.js`, `order-history.js`, `predictive-order.js`,
`integration-config.js`, `zoho-adapter.js`, under
`modules/foodbridge-customer-mockup/v4/screens/customers/` — plus that destination's `name` in
`assets/modules.json` and the `?v=` token in `index.html` it forces. The retired v3-cut copy at
`#/stock-audit-health-v3` is **not** mirrored and stays as frozen.

### Mirrored 4 September 2026 — selling price per order line

Create Order carries an editable selling price on every line: the price figure is
itself the tap target and becomes the field in place, riding on the unit's
existing line above the stepper so the product card keeps its shape. It is order-specific: the catalogue
seeds it and never overwrites it afterwards, and the confirmed figure is what the invoice prints
and what the accounts sync sends as the Zoho rate. `invoice.html` joins the mirrored files.

### Mirrored 4 September 2026

The nav label, the module's own sidebar entry, the in-screen crumb and the page `<title>` all
read **Stock Audit** rather than *Stock Audit & Health*. `shell.js` gained a `?v=` tag, which it
had never carried, because the module's nav labels live in it and an untagged copy would have
kept serving the old label through a reload.

260 files, 9.5 MB, 12 module repos, 26 destinations.

**Opened 29 August 2026, from `v3` as its baseline** — byte-for-byte the 26 August `v3`
freeze at the moment it was cut. Why `v3` and not `v4`: `v4` is a narrow, single-destination
cut (Customer Management → Stock Audit & Health, no sidebar). `v5` needed the whole platform
back — every module, the sidebar, the routing — so it started from the last full-platform
snapshot.

**Mobile was the target.** Work in this cut was done and reviewed at a phone viewport
(375×812) first; the desktop layout inherited from `v3` still renders, but it is not what
this cut was designed against.

What it grew, over the two days it was open, is one thing: Delivery Management stopped being
a crawled copy of the module team's screen and became a real, offline, static port of the
route-delivery app, audited against the live QA build until the two render the same. The log
below is that work, newest first. New work continues in `v6`, which opens from this freeze.

## Changes

### 30 August 2026 — QA parity audit, parts three and four: measured, not read

The two earlier passes compared QA and the port by reading the DOM and the text. This one
replaced that with measurement. A signature differ walks every visible element and emits
`depth | tag+classes | style tokens` — font, colour, background, border, radius, shadow,
padding, margin, display, the flex and grid axes, position, overflow, opacity, text-align and
-transform, white-space, flex-shrink and -grow — deliberately **excluding box geometry and
text**, so that the two environments' different datasets cannot masquerade as style
differences. The lines are hashed and the two lists aligned with a lookahead resync; every
index that differs is then drilled into with `getComputedStyle` and `getBoundingClientRect`
on both tabs at 375×812, and clicked.

**Five real differences it found, which reading could not have.**

*Sold-out products were filtered out of both catalogues.* Book Order and New Customer dropped
any product with no stock left on the van. QA keeps them — which is the only reason QA has a
`⚠️ Max 0 — no more in vehicle` row and an `Out of stock` row at all. The port had built both
branches and then made them unreachable. Filters removed.

*The calendar's next-month arrow.* QA sets `maxDate` to today, so react-datepicker **omits**
the next arrow while the current month is displayed — there is no greyed-out state. The port
drew both. Now it drops it on the current month and restores it a month back, which is what
QA does.

*Reports' sort values* were `az`/`za`; QA's deployed build uses `name-asc`/`name-desc`.

*The date-range popper* sat at `z-index: 30`; QA's is `1`.

*Manage Assets' header cell* set `text-align: left` where QA inherits `start`.

**One change made and then reverted, which is the point of the exercise.** The React source in
`storefront-frontend` renders the Reports date range as `August 10 – August 20` — an en dash,
no year — and the port was changed to match it. The *deployed* QA build renders
`10 Aug 2026 - 20 Aug 2026`, with a plain hyphen, the year, and a trailing `-` while only the
start is picked. The source is not the oracle; the running environment is. Reverted.

**The depleted-van queue, reached on live QA.** The one state the earlier passes had verified
against source rather than a render. A QA route was found with two of three products already
exhausted, the last two units were booked through the UI, and the stop completed — booking
reserves stock, only completion consumes it — at which point the queue rendered the real
thing: rows at `opacity: 0.4` with a grey avatar and `Stock depleted`, the Add-Customer row
gone, and the amber footer banner. Row and banner signatures came back byte-identical, 5/5
and 5/5, and the behaviour matched too: the rows are inert bare `div`s with no button wrapper,
the menu still offers Restock and Return & Settle, and the settle panel reads *All stops
complete / Route ready for settlement* rather than describing the remaining stops as ones that
will be skipped. No port changes were needed; the implementation built from source proved
correct against the render.

Also measured equal this pass, each by hash and by coordinate: the home stat grid and its
empty state, the New Delivery sheet in all three of its states, queue done and pending rows,
both advance-balance hero lines, the return-only Stop Summary (30/30), Manage Assets' header
and rows, the Reports filter block, and both Reports empty states.

Closing state, build `v=2026083114`: 28 of 28 routes render, 0 console errors or warnings,
0 network requests after boot, 0 external requests. The payment → DELIVERED → route total →
settlement → stock count → cash handover chain re-run end to end. The full checklist, with
the measured numbers, is `docs/route-delivery-qa-parity.md`.

### 29 August 2026 — QA parity audit, part two: the five remaining areas

Reports, Analytics, Restock ×3, Manage Assets and Return Acceptance were driven on QA the same
way as the rest — clicking every control, including a real restock confirm and a returns
submission. All five differed from the port.

**Reports.** Card rebuilt to QA's: name 17px/800, a **Final** badge, and a Collected/Outstanding
pair rather than a single figure, with a full-width outlined "View Report →". "Report history" is
sentence case at 15px, not the uppercase SectionHeader used elsewhere, and an **All dates** chip
now sits alongside the four sort chips.

**Analytics** was the largest gap. Added the third score band (**Needs Attention** below 50 — QA
scored 8/100), a **HIGHLIGHTS** block, and the four collapsible summaries QA carries: Stops,
Stock, Expense and Collection, each with QA's subtitle line and its own table. Export now opens
QA's modal (Close / Preview / Download) instead of downloading silently. KPI label corrected to
"Avg Time / Stop".

**Restock.** QA offers one action, "📦 Load Additional Stock", not two; row subtitles print only
where a stop actually owes something. Restock Load gained QA's fifth column (**ON TRUCK**), its
"Total additional units: +N units" line in place of two total cards, and QA's confirm panel —
"RESTOCK #N / N units / ₹X estimated value · N products" over a product list with "N stops
waiting" and "N units available after load", committed by "Edit Quantities" / "Confirm Load".

**Manage Assets.** QA uses plain number fields, not steppers; button reads "Save Asset Update →".

**Return Acceptance** is two steps in QA, not one screen: pick items, then a reason panel. The
primary button narrates each stage — "Select items being returned" → "Select Return Reason · N
units · ₹X →" → "Select a reason above" → "Confirm Reason →" — and the reasons are QA's
🔴 Damaged / ⏰ Expired / 📦 Unsold / ❌ Wrong Product.

**A real bug this surfaced.** The wildcard input handler split `data-model` on the *last* hyphen,
so any key containing one — every asset id, e.g. `give-AST-CRATE-L` — resolved to a base nothing
handled and typed values silently vanished. It now tries prefixes left to right and takes the
first with a registered handler, which also keeps two-segment bases like `stock-qty-0` working.

Re-verified end to end: 23/23 screens, no console errors; payment → DELIVERED → route total →
settlement; the settlement chain closes a route; returns two-step, restock confirm, asset inputs
and analytics accordions all behave as QA does; zero network requests (16 local files); six other
v5 modules unaffected; no React, JSX, npm, Vite or build tooling under `v5/`.

### 29 August 2026 — Parity audit against the QA environment

Delivery Management was audited screen by screen against the live QA build at
`qa.foodbridge.io/platform/route-delivery`, driven by clicking through it rather than by reading
source. QA was treated as the single source of truth, and it disagreed with the React source in
several places the earlier port had followed.

**Global typography.** QA's body is `13.5px / 1.5` and its form controls inherit that (Tailwind
preflight); this cut had the browser default, `16px / normal`. Every heading, row, chip and input
therefore rendered about 85% of its true height — the whole app read subtly cramped and no screen
lined up. Fixed at the source in `styles.css`; header, tiles and controls now measure identically
to QA to the pixel.

**Home.** Section header is **"All Routes"**, not "Today's routes". The date chip defaults to
**unset** ("Date"), not to today — an earlier guess from the React source. The sync pill reads
**"Synced"** with no relative timestamp. The search field and date chip were rebuilt to QA's
markup: inline SVG glyphs rather than emoji, the clear ✕ positioned *inside* the date chip with a
28×28 target, and a grey circular clear button in the search field.

**Queue.** QA renders one flat list in route order. A previous pass had grouped it into Next stop
/ Upcoming / Completed; that grouping is **reverted** to match QA. Also added the **"Over Paid"**
subtitle branch, which needed advance amounts in the seed to be reachable at all.

**At Customer.** QA shows "Collect ₹0" on a stop with nothing due, so that button is no longer
suppressed. Added the two **advance-balance** branches QA exercises: an advance paying down
today's order (Total Due ₹0 while an order exists) and an advance balance with nothing ordered.

**Stock Count** was rebuilt to QA's design: a PRODUCT / LOADED / EXPECTED / ACTUAL table where
each numeric column carries a quantity *and* its value, a per-row **Match** button that fills the
expected figure, and a live **TOTAL** row. Copy matched exactly — "Enter all counts to continue"
until every row is counted, then "Confirm Stock Count ✓", and a confirm panel reading "STOCK
COUNT / All counts match / Ready to submit" with "Edit Count" and "Submit Count".

**Cash Handover** was rebuilt to QA's design: a SUMMARY block, **Expense** and **Cashbreak**
toggles, **"Cash to Hand Over"**, **Actual Cash Counted**, a required **Delivery Person** (min. 3
chars), and a denomination breakdown (500/200/100/50/20/10) that totals live and whose Save
Breakdown fills the counted figure.

**Print sheet** gained QA's Printer Device block with a connect action, Cancel/Print buttons, and
QA's receipt format — a header carrying date, customer, bill number and payment method above the
Item/Qty/Rate/Amt table.

**Settlement.** The locked step's button reads **"Locked"**, not a padlock glyph, and the header
subtitle is the route name alone.

**Reproduced deliberately, not fixed:** QA's Stock Count table is 430px wide inside a 375px
viewport, so its ACTUAL column — the only thing typed on that screen — sits partly off the right
edge behind a horizontal scroll. An earlier pass had redesigned this into a vertical layout; that
has been reverted to match QA. It is a genuine QA usability problem and is called out here rather
than silently diverged from.

Re-verified after the audit: 23/23 screens render with no console errors; payment collects
outstanding + order through to DELIVERED, route total and settlement; the settlement chain closes
a route; Match/TOTAL, the denomination breakdown and every confirm gate behave as QA does; zero
network requests (16 local files); other v5 modules unaffected; no React, JSX, npm, Vite or build
tooling under `v5/`.

### 29 August 2026 — UX pass over the ported Delivery Management

A review of all 23 screens at 375x812 as a distributor would use them, not as a parity check.
Four things were wrong enough to fix, and two of them were bugs rather than taste.

**The stop screens were reading fields that do not exist.** The stop model uses
`outstandingAmount` / `totalDue` and its detail uses `orderItems`; the port read
`previousOutstanding` / `items`. Every stop therefore showed an empty order and a Total Due of
**₹0**, and Collect charged only the day's order while ignoring the outstanding — a stop owing
₹720 + ₹535 collected ₹480. Now corrected, and At Customer and Payment derive the figure from
the same itemised sum, so the amount on the button is the amount on the next screen and on the
printed receipt.

**Typed quantities went nowhere.** Every per-row input — stock counts, order quantities, restock,
returns, assets — rendered its digits and never told the state, so Stock Count could not be
completed by typing at all. `delivery-core`'s input delegation now supports a wildcard handler
(`model:count#`) so one handler serves a whole column, and typing works everywhere the steppers do.

**The queue opened on finished work.** Upstream renders one flat list in route order, so a driver
halfway through a 30-stop route met nine completed customers and had to scroll to find who was
next — on the screen whose entire job is "who is next". Now: **Next stop** pinned at the top,
**Upcoming · N** below it, and completed stops collapsed behind a count, one tap away.

**Stock Count hid its own input.** A four-column table with a 430px minimum width put the Actual
field — the only thing anyone types on that screen — off the right edge of a 375px phone behind a
horizontal scroll. It is now a row per product with the input permanently on screen and
loaded/expected demoted to a subtitle, where they belong as context rather than columns to scan.

**Cash Handover buried its own point.** "Expected in hand" was the last of five equal rows, below
UPI collected — which cannot be handed over at all. It now leads at 38px with its arithmetic
underneath, UPI is labelled "not handed over", and the two inputs share one card instead of two.

Smaller, throughout: no button ever reads "₹0" or commits nothing — a disabled primary says what
is still needed ("Enter your counts to continue", "Confirm 1 of 6 counted"); a stop with no order
says so instead of showing an empty screen; discrepancies surface live on the row as
"3 missing" rather than only at confirm time.

Re-verified after the pass: 23/23 routes render with no console errors; payment collects the full
outstanding + order and flows through to DELIVERED, route total and settlement; the settlement
chain closes a route including the discrepancy-note gate; zero network requests (16 local files);
the module copied elsewhere still runs; Dashboard, Sales Orders, Stock Audit, Route Planning and
Live Tracking unaffected; no React, JSX, package.json, node_modules or build tooling under `v5/`.

### 29 August 2026 — Delivery Management, ported to static

Delivery Management is now a hand-authored static module like every other one in v5 — plain
HTML, CSS and vanilla JS, IIFEs on `window` namespaces, `?v=` cache tags, **no build step**.
Open a file, change it, reload. That is the whole point: this screen exists to be shown to
customers and stakeholders, edited against their feedback, and frozen.

It replaces the compiled React bundle that briefly lived here. `/route-delivery` **stays React**
in `storefront-frontend` — that repo is untouched and remains the reference implementation.

**What was ported, and how faithfully.** All 23 screens and their branches:

| | |
| --- | --- |
| Start of day | pre-start · load stock · opening cash · staff sign-off |
| Delivery loop | queue · at-customer · payment · payment success · skip stop · new customer · stop summary |
| Settlement | overview · stock count · cash handover · route closed · analytics · reports |
| Side flows | restock in progress / load / success · manage assets · return acceptance |

**The logic layers are the original code, not a re-implementation.** `seed.inline.js` (the
808-line database), `services.js` (all 43 SDK methods), `models.js` (84 exports — pricing,
discounts, receipts, settlement maths) and `validation.js` were transformed mechanically from
the React source: imports and exports stripped, wrapped in an IIFE. So the *numbers* cannot
drift from the real product even though the *rendering* was rewritten.

**Styles carry across as objects.** The React app styles inline — 1,314 `style={{…}}` objects —
so `shell.js` renders style objects through a `sty()` helper rather than inventing CSS classes.
Each screen reads as a transliteration of its JSX, which is what makes the two diffable.
`ui.css` is copied verbatim into `styles.css`; it is the hover/press feel of every control.

**Verified against the real app running side by side.** The React build was served on `:4300`
and compared screen by screen. That caught four things a careful reading would have missed:
routes sort by status priority (In Progress above Ready), the date filter defaults to today,
`formatRouteDate` renders en-US (“August 30, 2026”), and the settlement checklist shows **two**
steps — `CUSTOMER_CLOSURE` is filtered out by `settlementFlow.model.js` and has no driver-facing
action. All four are now matched rather than approximated.

Also fixed during QA: the discrepancy-note fields on Stock Count and Cash Handover gate their
commit button, but did not re-render on input, so typing an explanation left the button dead.

**Checks that passed:** all 23 routes render with no console errors; payment → DELIVERED →
route total → settlement state mutation works end to end; the full settlement chain closes a
route; **zero** network requests (16 local files, nothing external, no CDN, no `v5/vendor`);
the folder copied to an unrelated directory still runs; other v5 modules unaffected; no React,
JSX, `package.json`, `node_modules`, Vite or ES modules anywhere under `v5/`.

**One deliberate non-fix.** Borivali North's dashboard card reads ₹14,320 collected while its
queue header reads ₹7,920. This was checked against the React reference, which shows *exactly
the same split*: the seeded route summary disagrees with the sum of its own stop rows, and
`syncRouteAggregates` recomputes from the stops on the first write. It is an upstream seed
quirk, faithfully reproduced. Correcting it here would make the prototype diverge from the app
it is meant to specify.

**Editing it.** Screens live in `delivery-{home,start,stops,settle,aside}.js`, each registering
itself via `RD.screen(name, fn)`; shared chrome and controls are in `shell.js`. Bump the `?v=`
tag on any file you edit, or a browser will serve the old copy through a reload.

### 29 August 2026 — Delivery Management is the real `/route-delivery`, running offline

The replacement the suspension below was clearing the way for. Delivery Management is back on
`#/distribution-logistics/delivery-management`, and what loads there is not a mockup of the
route-delivery app — it **is** the route-delivery app, from `nishant-devekar/storefront-frontend`,
built to run with no network at all.

**Why it was built rather than drawn.** The real screen is 24 pages, 20 controllers, 8 models
and 8 validation modules — about 24,500 lines. Redrawing that by hand gets an approximation of
the parts someone thought to redraw. Building the actual app gets every page, every branch,
every empty state and every validation message exactly right, because there is nothing to copy:
the pixels are the app's own.

**How it runs with no backend.** `storefront-frontend` already shipped an 808-line in-memory
database (`services/mock/db.js`) and an SDK test double against it. Four things closed the gap
between that and a working offline app, all on the `feat/route-delivery-mock-build` branch there
and none of them touching app code:

- **17 missing SDK methods.** The service layer had migrated to the real SDK and the double had
  drifted to 26 of the 43 methods now called. The 17 absent ones were not edge cases —
  `pauseForRestock`, `resumeFromRestock`, `createOnTheMoveRoute`, `getBookingStock`,
  `recordAssetMovement`, `recordRoutePayment`, `updateStopItems`, `createRouteReturn`,
  `getRouteMetrics`, `getReportsSummary` and the rest gate the restock, assets, returns, reports
  and analytics branches entirely.
- **Date rebasing.** The seed is written against a fixed 2026-05-24, so on any other day the
  dashboard's "today's routes" query matched nothing and the app opened on an empty list. Every
  date and timestamp is now shifted by the whole number of days to today, preserving the
  relative spacing that makes RTE-004 "yesterday's closed route" and RTE-005 "tomorrow's".
- **A session that never existed.** Privileges arrive from `setup.getPrivateConfig()`. Offline
  that call failed, and `SidebarContext`'s catch calls `logoutUser()` → `localStorage.clear()`,
  so every load wiped itself and every screen sat behind "Access Restricted". Answering that one
  call fixes it at the source and lets the real success path run.
- **Two remaining calls silenced** — `getPublicConfig` and the non-fatal tenant-list lookup — so
  the module makes **zero** network requests. It loads four files: the bundle, v5's own vendored
  Inter, and two woff2 faces.

**What is verified.** All 23 routes render: dashboard, pre-start, load stock, opening cash,
sign-off, queue, at-customer, payment, payment success, skip stop, new customer, stop summary,
settlement overview, stock count, cash handover, closed, analytics, reports, manage assets,
return acceptance, restock, restock load, restock success. Writes persist — collecting ₹680 from
Meena Kirana moved the route total from ₹0 to ₹680 and marked the stop delivered — and the
receipt, printer-type and WhatsApp-share branches all open.

**Where it lives, and what it is honest about.** `modules/storefront-route-delivery/` — named for
the repo it was built from, not for the distribution-logistics team, who did not write it. It is
a compiled bundle (30 files, 3.6 MB), unlike every other module in v5, which is readable crawled
source. Rebuild it with `npm run build:route-delivery-mock` in `storefront-frontend` and copy
`dist-route-delivery-mock/` over it, renaming `mock-index.html` to `index.html` and repointing
the font link at `../../../../vendor/`.

**It refuses to render above 640px**, showing the app's own phone-only notice. That is the real
app's behaviour, not something added here, and it suits a cut being designed at 375×812.

The screen it replaces is still at `#/delivery-management-retired`.

**Cache token** bumped `20260829b` → `20260829c`.

### 29 August 2026 — Delivery Management suspended, pending a new cut

`#/distribution-logistics/delivery-management` is gone from the nav. Unlike the Stock Audit
swap below, **nothing replaces it yet** — a new Delivery Management is being built for `v5`,
and this clears the way for it. Until that lands, Distribution & Logistics carries three
entries (Route Planning, Logistic Returns, Live Delivery Tracking), not four.

The screen itself is untouched on disk and stays addressable at
**`#/delivery-management-retired`** — a `standalone` route, so it resolves by hash but never
appears in the sidebar and can never become the landing screen. It keeps its `clipLeft: 0` and
`fullBleed`, so it still renders as the full-bleed phone app it is.

**The old route now falls through.** `#/distribution-logistics/delivery-management` is not a
route any more, so `routeFromHash` rewrites it to the first destination and lands on
`#/dashboard`. Any bookmark or shared link on the old hash silently goes to the Dashboard
rather than 404ing; the retired route is the address to hand out instead.

**Inherited defect, carried in with the retired screen and worth not repeating.** The
"🧾 Stock Audit" button on the stop detail — the hand-patched cross-module deep link `v3`'s
notes describe — points at
`modules/foodbridge-customer-mockup/v1/screens/customers/stock-audit.html`, which does not
exist in this cut: the screen lives under `v3/` (retired) and `v4/` (live). The button opens a
404 and has done since before `v5`. It is left as it is, inside a screen that is on its way
out; the replacement should link to `v4/screens/customers/stock-audit.html`.

**Cache token** bumped `20260829a` → `20260829b`, for the same reason as below.

### 29 August 2026 — Stock Audit & Health is now the `v4` cut

The screen on `#/customer-management/stock-audit-health` was replaced. The route, the id and
the sidebar label are unchanged; what loads behind them is not.

**What came in.** The Stock Audit screen as it stands in the platform's `v4` folder, copied
byte-for-byte into `modules/foodbridge-customer-mockup/v4/screens/customers/` (32 files). It is
a much larger thing than the screen it replaces — `stock-audit.js` goes 2,116 → 4,274 lines,
`stock-audit.css` 930 → 1,409 — and it carries a whole second journey the old one had no
notion of: **Create Order**, the Predictive Sales Order flow, with `predictive-order.js`,
`order-history.js`, `invoice.html`, a 21-file `img/` set, and the Zoho bridge client
(`integration-config.js`, `zoho-adapter.js`). The bottom tab bar goes from two tabs to three.
`shell.js`, `icons.js` and `styles.css` are byte-identical between the two cuts; only
`seed.inline.js`, `stock-audit.{html,js,css}` differ.

**On the folder being called `v4`.** It is named for the platform cut it came from, not for a
release of `nidhimehta9399/foodbridge-customer-mockup` — that repo has published no `v4`. Both
folders under `modules/foodbridge-customer-mockup/` descend from the same upstream `v3` crawl;
`v4/` is that crawl plus the work authored in this repo during the `v4` cut. The files are left
byte-identical to `v4/`'s copy so the two can still be diffed directly, which is why a comment
in `integration-config.js` still gives its example link as `.../v4/?fbapi=…`.

**What was retired, and where it went.** The previous screen is *suspended, not deleted*:
`modules/foodbridge-customer-mockup/v3/screens/customers/` is untouched on disk, and a
`standalone` entry keeps it addressable at **`#/stock-audit-health-v3`**. `standalone`
destinations resolve by hash but are deliberately absent from `order`, so it never appears in
the sidebar and can never become the landing screen — the same mechanism the storefront uses.
Reachable for comparison; not navigable to by accident.

**New network dependency, not in the table above.** The v3-lineage screen was fully offline.
This one is not: Create Order talks to the Zoho bridge at `https://zoho-function-nu.vercel.app`
(overridable per device with `localStorage.setItem("fb-api-base", …)` or `?fbapi=`). Auditing
and browsing work offline; confirming an order does not.

**Cache token bumped**, `20260825a` → `20260829a`, on `index.html`'s `platform.css` and
`platform.js` tags. `mount()` reuses that token to fetch `modules.json`, so without the bump
every browser that had already loaded this shell would keep the old nav — and keep opening the
retired screen — indefinitely. Any future change to `modules.json` needs the same bump.

## Running it

Served over HTTP — several packaged screens `fetch()` their seed JSON, which a browser
blocks on `file://`. The repo's `.claude/launch.json` defines `foodbridge-v5` on **port
8004**. From this folder by hand:

```
python3 -m http.server 8004
```

then open <http://localhost:8004/>.

## Provenance

Everything below this line is `v3`'s own release record, kept verbatim as the description
of what this baseline contains and where each screen came from. It describes the snapshot
`v5` started from; it is not a record of changes made in `v5`. Changes made here are
recorded above, newest first, as they land.

---

# Baseline: FoodBridge mock platform — Version 3

**Frozen 26 August 2026.** A self-contained snapshot: the shell plus a local copy of every
module screen it shows. Nothing here loads from a module team's GitHub Pages site, so this
folder renders the same however those repos change afterwards.

206 files, 8.0 MB, 12 module repos, 26 destinations.

**Recut from the 24 August 2026 freeze** once `nidhimehta9399/foodbridge-customer-mockup`
caught up. Customer Management's Stock Audit & Health screen is a real crawl of that repo —
first the screen itself (a product-owner-driven simplification down to
`quick-pick → quick-count → done`, and a mobile-browser QA pass, both authored directly
in this repo while the source lagged and ported back once `v2` was cut there), then a link
into Catalog its `shell.js` was missing, which `v2` also picked up.

**Re-pointed at that repo's `v3`** on 25 August 2026. `v2`'s own release notes carried an
explicit gap — its mobile QA pass had been done under Chromium device emulation, never on a
real mobile browser. That pass has now been run for real, on an Android emulator (Pixel 8,
Chrome 124) and an iOS Simulator (iPhone 16 Pro, Safari 605.1.15) with real touch input, and
the four bugs it turned up are fixed: the end-of-audit toast covering the app header, the
phone's Back button leaving the app entirely, `<select>` touch targets measuring 32px on
WebKit only (which ignores `min-height` on a native-appearance select), and search boxes with
no `autocapitalize`/`autocorrect` letting the keyboard rewrite a typed SKU. A fifth, found
alongside: a phone in landscape with the keyboard up had no room for its own chrome and
pushed the Finish CTA off screen. Same provenance rule as before — the work was authored
here, cut as `v3` in the module repo, and crawled back. The superseded local copy of the
module's `v2` is gone with it; nothing routed to it any more.

**Refined the vNext Quick Audit flow** on 26 August 2026, authored directly in this repo
(not yet ported upstream). Audit Detail is cut down to what a visit record actually is —
date/time and the products checked, no Coverage box, no thumbnails, no purpose/status
chrome; Audit History's cards match: customer, date/time, a plain count, nothing else.
Customer and product search now share one dropdown treatment for every state a search box
is "in use" in — a capped, first-5-A-Z preview on focus before typing, the live unbounded
match list once typing starts, both scrollable in their own box so a long result list no
longer carries the search box and page head off-screen with it. Ending a visit — the ←
exit sheet, and Finish Audit when nothing's been counted, which now routes to the same
sheet instead of dead-ending in "count something first" — genuinely discards it: no
half-written "abandoned" record, no toast implying one was kept. Fixed along the way: a
sheet closed by its own button (not the phone's Back) could, on the button after it,
silently pop the rep a screen further out than the sheet they'd just closed — a
history-timing race between the sheet's own `history.back()` and the listener meant to
catch a real Back press.

One deliberate exception remains, and is *not* reflected below since the packager has no way
to know about it: the "🧾 Stock Audit" entry point on Delivery Management's stop detail is
hand-patched into `modules/foodbridge-module-distribution-logistics/…/stop-detail.js` —
cross-module deep-link glue specific to this local snapshot (see the comment above
`STOCK_AUDIT_URL` in that file), not something that belongs in that team's own repo.
Re-running `tools/pack.py --version 3` will silently drop it; restore the file from git or
hold it back before re-packing.

## Running it

It must be **served over HTTP** — seven of the packaged screens `fetch()` their seed JSON at
runtime, which a browser blocks on `file://`. From this folder:

```
python3 -m http.server 8000
```

then open <http://localhost:8000/>. On GitHub Pages it works as-is.

## What is frozen, and what is not

| | |
| --- | --- |
| Shell — nav, routing, chrome, clip offsets | frozen |
| All 26 module screens, their JS/CSS/seed data/images | frozen, local copies |
| Google Fonts, Tailwind, Leaflet | frozen in `vendor/` |
| **4 other reference(s)** | **not frozen** — see the table below. Offline, each shows whatever its screen does when that call fails (usually a blank background or a missing image); every other reference is fully offline-capable. |

| Still reaches the network |
| --- |
| `https://cdnjs.cloudflare.com/ajax/libs/anchor-js/4.1.0/anchor.min.js` |
| `https://exagon-ai.github.io/instructions/addendum-020-v1-freeze.md` |
| `https://wa.me/` |
| `https://www.openstreetmap.org/copyright` |

## Inherited defects

Faithfully reproduced from the live sites rather than silently patched — 32
found already 404 on the freeze date and packaged as-is:

- `https://exagon-ai.github.io/foodbridge-inventory-intelligence/favicon.ico`
- `https://exagon-ai.github.io/foodbridge-inventory-intelligence/v1/screens/inventory-intelligence/$1`
- `https://exagon-ai.github.io/foodbridge-inventory-intelligence/v1/screens/inventory-intelligence/a.source,this.map.consumer(`
- `https://exagon-ai.github.io/foodbridge-inventory-intelligence/v1/screens/inventory-intelligence/t`
- `https://exagon-ai.github.io/foodbridge-inventory-intelligence/v1/screens/inventory-intelligence/tailwind.config.js`
- `https://exagon-ai.github.io/foodbridge-module-products/discovery/paths/products-directory/screens/products/blob`
- `https://exagon-ai.github.io/foodbridge-module-products/discovery/paths/products-directory/screens/products/file`
- `https://exagon-ai.github.io/foodbridge-module-products/discovery/paths/products-directory/screens/products/url`
- `https://fonts.googleapis.com`
- `https://kdansari02.github.io/foodbridge-module-distribution-logistics/discovery/paths/distribution-logistics/screens/distribution/file`
- `https://love-scripter.github.io/foodbridge-module-procurement/screens/a.href`
- `https://love-scripter.github.io/foodbridge-module-procurement/screens/blob`
- `https://nidhimehta9399.github.io/foodbridge-customer-mockup/v1/screens/catalog/blob`
- `https://nidhimehta9399.github.io/foodbridge-customer-mockup/v1/screens/catalog/url`
- `https://nidhimehta9399.github.io/foodbridge-customer-mockup/v1/screens/customers/a.href`
- `https://nidhimehta9399.github.io/foodbridge-customer-mockup/v1/screens/customers/blob`
- `https://nishant-devekar.github.io/foodbridge-inventory-mockup/screens/inventory/$1`
- `https://nishant-devekar.github.io/foodbridge-inventory-mockup/screens/inventory/a.source,this.map.consumer(`
- `https://nishant-devekar.github.io/foodbridge-inventory-mockup/screens/inventory/t`
- `https://nishant-devekar.github.io/foodbridge-inventory-mockup/screens/inventory/tailwind.config.js`
- `https://nishant-devekar.github.io/foodbridge-production-discovery/batch-management/screens/batch/styles-b.css`
- `https://nishant-devekar.github.io/foodbridge-production-discovery/production-planning/screens/recipie/_reference/ingredients-list.html`
- `https://nishant-devekar.github.io/foodbridge-sales-orders-mockup/screens/orders/$1`
- `https://nishant-devekar.github.io/foodbridge-sales-orders-mockup/screens/orders/a.href`
- `https://nishant-devekar.github.io/foodbridge-sales-orders-mockup/screens/orders/a.source,this.map.consumer(`
- `https://nishant-devekar.github.io/foodbridge-sales-orders-mockup/screens/orders/blob`
- `https://nishant-devekar.github.io/foodbridge-sales-orders-mockup/screens/orders/t`
- `https://nishant-devekar.github.io/foodbridge-sales-orders-mockup/screens/orders/tailwind.config.js`
- `https://nishant-devekar.github.io/foodbridge-staff-mockup/screens/$1`
- `https://nishant-devekar.github.io/foodbridge-staff-mockup/screens/a.source,this.map.consumer(`
- `https://nishant-devekar.github.io/foodbridge-staff-mockup/screens/t`
- `https://nishant-devekar.github.io/foodbridge-staff-mockup/screens/tailwind.config.js`


## Layout

```
index.html          the shell
assets/             shell JS/CSS + modules.json, rewritten to local paths
modules/<repo>/…    each module in its OWN original directory layout, so every
                    relative link inside it still resolves
vendor/             Google Fonts, Tailwind, Leaflet
```

- `modules/foodbridge-customer-mockup/`
- `modules/foodbridge-dashboard-mockup/`
- `modules/foodbridge-inventory-intelligence/`
- `modules/foodbridge-inventory-mockup/`
- `modules/foodbridge-module-distribution-logistics/`
- `modules/foodbridge-module-procurement/`
- `modules/foodbridge-module-products/`
- `modules/foodbridge-production-discovery/`
- `modules/foodbridge-sales-orders-mockup/`
- `modules/foodbridge-staff-mockup/`
- `modules/invoice-payment-overview/`
- `modules/retails-overview/`

## Where each screen came from

| Route | Screen | Source on the freeze date |
| --- | --- | --- |
| `#/dashboard` | Dashboard | `modules/foodbridge-dashboard-mockup/v2/screens/dashboard/dashboard.html` |
| `#/product-master/finished-goods` | Finished Goods | `modules/foodbridge-module-products/discovery/paths/products-directory/screens/products/all-products.html` |
| `#/product-master/product-categories` | Product Categories | `modules/foodbridge-module-products/discovery/paths/products-directory/screens/products/categories.html` |
| `#/product-master/raw-materials` | Raw Materials | `modules/foodbridge-module-products/discovery/paths/products-directory/screens/products/raw-materials.html` |
| `#/product-master/image-gallery` | Image Gallery | `modules/foodbridge-module-products/discovery/paths/products-directory/screens/products/image-directory.html` |
| `#/customer-management/b2b-customers` | B2B Customers | `modules/foodbridge-customer-mockup/v1/screens/customers/b2b-customers.html` |
| `#/customer-management/retail-customers` | Retail Customers | `modules/foodbridge-customer-mockup/v1/screens/customers/retail-customers.html` |
| `#/customer-management/catalog` | Catalog | `modules/foodbridge-customer-mockup/v1/screens/catalog/catalog.html` |
| `#/customer-management/stock-audit-health` | Stock Audit & Health | `modules/foodbridge-customer-mockup/v3/screens/customers/stock-audit.html` |
| `#/sales-orders` | Sales Orders | `modules/foodbridge-sales-orders-mockup/screens/orders/screen-01-orders-list.html` |
| `#/distribution-logistics/route-planning` | Route Planning | `modules/foodbridge-module-distribution-logistics/discovery/paths/route-planning/index.html` |
| `#/distribution-logistics/delivery-management` | Delivery Management | `modules/foodbridge-module-distribution-logistics/discovery/paths/delivery-management/screens/delivery/index.html` |
| `#/distribution-logistics/logistic-returns` | Logistic Returns | `modules/foodbridge-module-distribution-logistics/discovery/paths/logistic-returns/index.html` |
| `#/distribution-logistics/live-tracking` | Live Delivery Tracking | `modules/foodbridge-module-distribution-logistics/discovery/paths/live-tracking/index.html` |
| `#/production/batch-management` | Batch Management | `modules/foodbridge-production-discovery/batch-management/screens/batch/batch-workspace.html` |
| `#/production/semifinished-products` | Semifinished Products | `modules/foodbridge-production-discovery/batch-management/screens/batch/semi-finished-products.html` |
| `#/production/configure-recipe` | Configure Recipe | `modules/foodbridge-production-discovery/production-planning/screens/recipie/recipe-v4.html` |
| `#/inventory/inventory-intelligence` | Inventory Intelligence | `modules/foodbridge-inventory-intelligence/v1/screens/inventory-intelligence/index.html` |
| `#/inventory/finished-goods-inventory` | Finished Goods Inventory | `modules/foodbridge-inventory-mockup/screens/inventory/screen-01-current-stock.html` |
| `#/inventory/raw-material-inventory` | Raw Material Inventory | `modules/foodbridge-inventory-mockup/screens/raw-material-inventory/screen-01-live-stock.html` |
| `#/procurement/purchase-orders` | Purchase Orders | `modules/foodbridge-module-procurement/screens/screen-02.html` |
| `#/procurement/supplier-management` | Supplier Management | `modules/foodbridge-module-procurement/screens/screen-09.html` |
| `#/finance/customer-receivables` | Customer Receivables | `modules/invoice-payment-overview/screens/invoices-payments.html` |
| `#/finance/supplier-payables` | Supplier Payables | `modules/invoice-payment-overview/screens/supplier-invoices-payments.html` |
| `#/workforce-management` | Workforce Management | `modules/foodbridge-staff-mockup/screens/screen-01-staff-list.html` |
| `#/retails-overview` | Store | `modules/retails-overview/discovery/screens/desktop-v6.html` |

# FoodBridge mock platform — Version 4 (Stock Audit only)

**Cut 25 August 2026.** Not a successor to `v3` — a narrower thing standing beside it. `v3`
is the whole platform, 26 destinations across 12 module repos. `v4` is one screen:
Customer Management → **Stock Audit & Health**, and the shell around it, with no sidebar.

58 files, 2.1 MB, 1 module repo, 1 destination — plus a second journey
(Predictive Sales Order) authored here, not crawled. See below.

**Last released 29 August 2026** — confirming an order stopped being a screen and became a
modal that only Close dismisses, and the invoice it offers is now a real document this cut
owns. Detailed under *Refined 29 August 2026*.

The release before it, **28 August 2026**, was a pass over the row and the screen furniture
rather than over what the app can do: the unit became a control that carries a price, the row
shed the SKU and the thumbnail, every product search can create a product, and modals were
confined to leaving. Detailed under *Refined 28 August 2026*.

Before that, **27 August 2026** carried two changes still worth naming: the Predictive Sales
Order forecast is fitted to the tenant's **real** order history rather than invented seed
data, and Confirm Order works on **every** browser rather than only ones opened from a
provisioning link. Both are detailed below.

## What is different from v3

**No sidebar.** The full shell renders two — a desktop `aside` and a mobile drawer with its
backdrop, both filled by `renderSidebarContent`. With one destination a sidebar is a list of
one item, and a drawer that opens onto the screen you are already looking at. Both are gone
from `renderShell`, along with the burger in the mobile header and the `data-sidebar-toggle`
on the burger mask, because neither has anything left to toggle.

The mask itself stays and still masks: the module draws its own hamburger in its header, that
hamburger toggles the module's own sidebar, and `clipLeft` has removed that sidebar. It is
inert now rather than a control — `aria-hidden`, out of the tab order.

`renderSidebarContent` and the toggle wiring are left in `platform.js` untouched. Nothing
calls them. Deleting them would make this file diverge from the platform's for no gain the
next time the two are compared.

**One destination.** `assets/modules.json` carries a single group with a single submenu.
`standalone` and `hidden` are emptied. The grouping now names the screen rather than
navigating between screens.

**The tenant's real catalogue.** The Stock Audit screen here is the module repo's `v3` as
cut on the `only-customer-stock-audit` branch: 86 SKUs imported from the tenant's own
`products.csv` — pickles and murabba, spices, fresh vegetables, grocery, grain — with local
SVG tiles for product art instead of hotlinked photos. `v3/` of this platform still carries
the twelve invented products; the two are deliberately different.

## What is the same

Everything else, and on purpose. Same shell, same routing, same clip offsets, same
`100dvh` app column, same vendored fonts and Tailwind. `clipLeft: 256` still applies —
the module draws its own sidebar and this shell clips it away exactly as the full platform
does, which is why removing the *platform's* sidebar does not make the module's appear.

## Priced 4 September 2026 — a selling price on every order line

Every Create Order line now shows a selling price and lets the rep edit it on the row: `₹` and a
field under the stepper, mirroring the unit chip above it. The price is the **order's**, not the
catalogue's — the catalogue only seeds a new line, and once the rep touches it nothing re-derives
it, including a unit change (which rescales it along the pack ladder instead).

The confirmed price is written onto the order as `unitPrice`, with `cataloguePrice` and
`priceEdited` beside it, and is what both the invoice and the accounts payload read. Quantity and
unit changes now retract a raised confirm question, as price edits do. Authored in `v6` and
mirrored here; `invoice.html` joins the mirror set.

## Renamed 4 September 2026 — Stock Audit & Health becomes Stock Audit

The screen is **Stock Audit** now: the nav label in `assets/modules.json`, the module's own
sidebar entry in `shell.js`, the in-screen crumb in `stock-audit.js`, and the page `<title>`.
`shell.js` also gained the `?v=` cache tag it had never carried, since the label lives in it.

The row carries one chip read as a rate — `₹28/Pc` — and tapping it opens a
bottom sheet owning both: a Selling price field and a Unit picker, with a single
Apply. Choosing a unit rescales the price in front of the rep; nothing is written
until Apply.
Also fixed: the invoice was re-pricing a line whose price the rep had
deliberately cleared.

This change was authored in `v6` and mirrored here, which is now the rule for this screen — it
lives in `v4`, `v5` and `v6` at once, and a change landing in only one cut forks it silently.
The nine screen files under `modules/foodbridge-customer-mockup/v3/screens/customers/` are
byte-identical to `v6`'s copy as of this date.

## Refined 26 August 2026

The tenant rebrand (`QA store`/`Mahesh` → `Miha's`/`Anupam`) and the 40-account real
customer roster swap landed first; this pass is the same Quick Audit UX refinement made to
`v3`'s copy of the screen, carried over here so the two don't drift. Audit Detail now shows
just date/time and the products checked — no Coverage box, no thumbnails, no purpose/status
chrome; Audit History's cards match: customer, date/time, a plain count. Customer and
product search share one dropdown for every state the search box is in use — capped,
first-5-A-Z preview on focus, live unbounded matches once typing starts, both scrollable in
their own box rather than the page. Ending a visit (← exit sheet, or Finish Audit with
nothing counted, now routed to the same sheet — **the Finish half of that was reversed on
28 August**, see below) discards it outright — no "abandoned" record,
no toast implying one was kept — and a sheet closed by its own button no longer risks
popping the rep an extra screen out, a `history.back()` timing race the exit flow's testing
surfaced. `matches`' catalogue-aware search (name/SKU/category/sub-category) and the
qc-row's SKU tooltip, both specific to this module's real 86-SKU catalogue, are unchanged.

## Predictive Sales Order — added 26 August 2026

A **second journey**, standing beside Stock Audit rather than inside it. `Create Order` is a
third entry in the bottom nav:

```
Create Order → Select Customer → Predictive Sales Order → Confirm → FoodBridge order → Zoho
```

Stock Audit records what is on the shelf; this proposes what should ship. They are peers on
purpose — a rep audits today and orders on Thursday, and finishing an audit never launches
this. **The audit flow is unchanged**: the work was purely additive, and the diff that added
it deleted no line of it.

**They meet through data, not navigation.** Current stock comes from the customer's latest
**completed** audit — never a draft, never a visit ended early, matching the audit flow's own
rule that an unfinished visit is discarded rather than recorded. Demand comes from that
customer's order history.

**The recommendation.** `predictive-order.js` is a pure, UI-free, deterministic engine. It
asks two separate questions, because the real history says they need different evidence:

- **Whether** to propose a product at all — how many of the customer's last **six** orders
  included it. Below half, it is left off the order (the rep can still search and add it).
- **How much** — the mean quantity across the last **three** orders that actually contained
  it, then

```
recommended = max(0, expected demand − current stock)
```

Clamped at zero; a product history has never seen is never invented; where there is nothing
to go on, the screen says so instead of fabricating a number. The provenance sits behind one
tappable line — `Stock + history`, or `History only` where there is no audit — which also
admits when the history is out of date and how many occasional buys were held back.

**Fitted to real trading, not invented.** See "Real order history" below. The engine was
back-tested against the tenant's own 532 buying occasions: each real order predicted from
only what was known before it, tuned on 2025 and validated on unseen 2026 orders. Against
that hold-out it lifts precision from 56.8% to 66.5% and cuts over-ordering from **+42.4%
to +7.4%** of true volume, at the cost of recall (83.5% → 69.6%) — a deliberate trade, since
a missing line costs the rep a search while a wrong line nobody notices becomes real stock
in a shop and a real sales order in Zoho.

An earlier **seasonal** term — the same ±21-day period last year, blended at half weight —
was **removed**, having been measured as harmful rather than merely weak: per customer that
window holds 0 or 1 orders 71% of the time, and a product found only in it was re-ordered
just 25.3% of the time against 59.6% for one seen in recent history. That is not a finding
that the business lacks seasonality, only that one customer's three weeks a year ago is too
thin to measure it; doing it properly means pooling demand across customers by category,
which is honest work for a later cut.

Every quantity is the rep's to change: edit, zero out, remove, or search the full catalogue
to add something that was never recommended. What the system proposed is kept beside what
was actually ordered, along with the source audit id and the dates of the orders that fed it,
so the recommendation can be judged later.

**Confirming is the commit point.** Nothing is written until the rep answers the inline
`Confirm order?` in the footer — the same two-tap commit Finish Audit uses. Then, strictly in
order: the FoodBridge sales order is created, and only once that succeeds is Zoho called.

**Zoho is REAL.** `zoho-adapter.js` posts a confirmed order to
`zoho-function/`, a dependency-free serverless bridge that holds the OAuth
credentials and calls Zoho Books' own `POST /books/v3/salesorders`. Every sales
order id, number and status the success screen shows came back from Zoho; there
is no offline success path, so an unreachable or unconfigured bridge reports the
order as **not** synced rather than pretending. The success screen still reports
the two systems **separately**, because they can genuinely disagree: a
FoodBridge order with a failed Zoho sync is a real order needing a re-sync, not
a failed one to raise again.

Duplicate protection is enforced by asking Zoho, not by remembering: the
FoodBridge order id travels as Zoho's `reference_number`, and the bridge looks
it up before every write. A retry therefore attaches to the sales order that
already exists, and a timeout — where Zoho may hold the order with only the
reply lost — is held as PENDING and verified by reference rather than re-posted.
After creating, the bridge reads the order back and compares customer, lines and
quantities; a mismatch is reported as a failure, not a success.

The bridge is scoped to ONE Zoho Books organisation on purpose — this is a PMF
experiment. Customer and item mappings are two literal objects in
`zoho-function/mappings.js`, generated from the live organisation by
`seed-catalogue.js`: all 40 customers and all 86 products, every id read back
from Zoho rather than typed. FoodBridge ids are never sent to Zoho as Zoho ids,
and an unmapped customer or product fails loudly rather than landing on the
wrong record. Units were checked against each Zoho item, not assumed — Box,
Crate and Pp bag agree on both sides, so the factor is 1 throughout.

No price is sent, because FoodBridge holds none — Zoho applies the item's own
configured rate. Setup, OAuth and the required settings are in
`zoho-function/README.md`.

**Seed.** `orderingSignals` gained product-level `lines` — the existing structure extended,
not a parallel order model, and additive enough that the Ordering Status reader never
notices. Customers with no entry there have no signal at all, and the flow says
`No recommendation` rather than guessing.

Three files carry it: `predictive-order.js` (the engine), `zoho-adapter.js` (the boundary),
and four new views in `stock-audit.js`.

## Real order history — added 27 August 2026

`orderingSignals` no longer holds invented orders. It is now the tenant's **actual trading
history**, imported from their Zoho Books sales-order export into `order-history.js`, which
`seed.inline.js` simply adopts — same shape, so every existing reader keeps working.

**39 of the 40 customers, 532 buying occasions, 24 months.** Line items were matched to this
app's 86-product catalogue by Zoho item id or exact product name, and customers by name; only
`invoiced` / `partially_invoiced` / `confirmed` orders count, since a draft is not demand.

Three judgement calls are worth knowing when reading those numbers, and each is recorded in
the generated file's own header:

- **One visit is one order.** A fifth of the export's orders share a date with another for
  the same customer — one commercial order split across several Zoho sales orders. They are
  merged, because otherwise "the last three orders" can be a single afternoon. Merging alone
  raised forecast precision from 61.8% to 65.8%.
- **`value` is partial.** The catalogue is a subset of the tenant's full Zoho item list, so
  an order's value here sums only its matched lines, not the invoice total.
- **32 weight-billed lines dropped** (`g`/`kg`, for p84–p86) — the same goods sold loose
  rather than as packets. Averaging grams into a piece count would corrupt those three.

`avgCycleDays` is now the **median** gap between a customer's real orders rather than a
hoped-for cadence, so Ordering Status buckets against how they actually buy. Those cycles
run 15–117 days against the invented 7–10, which is simply what the business looks like.
One customer (c40) has no orders in the export and is therefore absent — honestly reported
as no signal rather than filled in.

## Refined 29 August 2026

**The order result stopped being a screen.** `order-success` — a view listing the FoodBridge
reference and the Zoho number side by side, each with a status tag, whose only exit was
`Done` — is gone. Confirming now returns the rep to a fresh customer search and states the
result in a modal over it: a mark, **Order Created**, the customer, `N products · N units`,
**Open Invoice**, **Close**. Both identifiers came off it; they are still on the record and
the invoice prints the reference. A rep closing an order acts on *did it work* and *give me
the invoice*, not on either number.

**Close is the only way out.** Not a backdrop tap, not the phone's Back gesture, not the
browser's Back button, not Escape, not a timer, and not Open Invoice or Retry Sync — both of
which leave it standing. That is why it is not a `sheet()`: every one of those exits is
something `sheet()` provides deliberately, for things the rep *asked* to see. Back is trapped
by re-pushing the history entry it consumes, so the view underneath never moves; Close settles
that entry the way `closeActiveSheet` does. All five refusals were driven on the simulator.

**What did not come off is whether accounts took it.** The state mark, the failure reason and
`Retry Sync` all survive the trim, because a green tick over a failed sync is the one outcome
this feature must never produce. What went is chrome.

**Open Invoice, and a FoodBridge invoice to open.** Which one it opens is decided by whether
*this* order reached Zoho — the only signal the browser has, since the customer→Zoho mapping
lives in the function's `mappings.js` and never reaches the page. Synced with a deep link
configured → Zoho's own flow. Anything else → `invoice.html`, a standalone document this cut
now owns, so a rep is never left holding a confirmed order with no way to invoice it. It
loads no seed, no shell, no catalogue and reads exactly one localStorage key, because it opens
precisely when the app's own sync path has failed.

Two fields moved onto the order record to make that possible, both written at confirm time:
`unitFactor` per line, because `Pallet` alone is ambiguous across the ladders (144, 480, 20 or
48) and a reader that guesses can misprice a pack; and `customerAddress` / `customerPhone`,
because nothing in this cut writes the customers key — `customers.js`, which owns it, is not
one of v4's screens — and an invoice should show the address as it stood when the order was
raised.

**The invoice carries money, and says less about it than it used to.** Unit prices are the
retail MRP parsed from each product name, multiplied up the pack ladder; tax is a placeholder
rate (`GST_RATE`) that nothing in FoodBridge configures. A Notes panel stated both on the page
and was removed by request, along with the seller strapline, so the rendered document now
shows a grand total with nothing qualifying it. The PDF still carries that as fine print.
**This is the open commercial question, not a solved one** — retail MRP is not the trade price
a distributor charges a shop.

**Print and Download PDF.** The PDF is assembled in the page from primitives — no library may
be fetched here — using the base-14 Helvetica faces, which need no embedding. It says `Rs.`
rather than `₹`, since the standard encoding has no rupee glyph and a missing one prints blank.

**A counted line reads in the words it was counted in, and only those.** Audit Detail showed
`4 Tray (48 Pc)`; the bracket is gone. `physical` still holds the conversion and still drives
coverage, stock-out risk and the ordering basis — the second number was printed on every
converted line to be skipped.

**Verified this release.** One real sales order raised end to end from the app: `SO-00032`,
Ahaana Bazaar, 10 products · 47 units, read back from Zoho as a single record with every
quantity matching. Open Invoice was driven on both branches, Retry Sync re-ran against the
same order without duplicating it, and the invoice page and its PDF were checked at 320, 393
and 720px on the simulator and in a desktop browser.

**Not tested this release.** The unresolved-timeout state, which needs a bridge that accepts a
request and never answers; Escape, there being no keyboard on the simulator; and the Android
half — none of this was re-run on a Pixel or through `tools/mobile-test.sh`.

## Refined 28 August 2026

Seven commits, none of which change what the app can do. They change what the rep has to
read, tap and trust while doing it. Every one of them was verified on a real iPhone 16 Pro
simulator with touch input, and the geometry and outcomes were measured against the live DOM
rather than eyeballed.

**The unit became a control that carries a price.** It used to be the same word printed
twice on a row — a chip in the SKU line and a label under the number — with the one you
could change sitting further from the number it governs. There is one now, centred directly
above the stepper, and tapping it opens a sheet where each pack option carries its own price,
so packs are compared inside the list rather than one wheel-spin at a time. The price is the
MRP printed in the tenant's own product names, which is what their Zoho items are actually
priced at (63 of 86; the other 23 sit at zero and read "No price set"). It is **shown, never
sent** — confirming an order still sends no price and Zoho still applies its own rate. The
product sheet was cut to the four things that answer the question it is opened to ask: name,
SKU, unit price, unit picker.

**The row stopped carrying what nobody reads.** The SKU is gone from it — eighteen digits
costing a line on every card, still on the product sheet, still searchable. The product
thumbnail is gone from every search result, and with it the second tap it carried: the
picture used to open a detail sheet of its own, marked with a small teal ⓘ. For *this*
catalogue a picture never earned that, because what separates two entries is the size and the
MRP inside the name — `(1000 gm) … NEW MRP 660` against `(475 gm) … NEW MRP 325` — and every
one of them is the same jar in the same photo. The customer search lost its letter chip for
the same reason. A search result is text now, on both lists, and no product row in the module
carries a thumbnail.

**Touch targets are separated by construction rather than by stacking order.** The stepper's
−/+ are a full 44×44 on both axes; the bin is red, smaller, and held off the + by a real
margin instead of a z-index arbitrating an overlap that should not exist. The unit lost its
pill entirely — the word and a chevron, no border, no fill — which returns ~10px of height on
the tallest column of every row. Measured at 402px: the quantity column went 72px to 62px,
still the taller half against a two-line name, so the second line of name is still free.

**The customer's name is one helper on every header that carries one.** It stays on one line
and is elided; tapping it opens a sheet holding the name and nothing else, which is what makes
the ellipsis a promise the app can keep. Audit Detail was the holdout — it rendered
`← Customer Name` as a single back link, so the name was the label on the back button and
wrapped to two lines on this tenant's longer names. Five headers, one code path. Where it
deliberately does not go is written down: a name that is a row you tap to *do* something keeps
its single target, and a name already whole on screen has nothing to reveal.

**`+ Add Product` is on every product search, and goes all the way.** Two halves were missing
at opposite ends. Counting had the create-a-product path but no footer button, so the only way
in was to search for the product and read the empty state — which asks a rep to prove a
product is missing before offering to add it. Ordering had the footer button but its empty
state dead-ended at "No product matches that.", so a rep standing in a shop with something the
catalogue has never heard of could **count** it but not **order** it. A product created on the
order screen reaches Accounts unmapped, which the sync already reports as a visible, retryable
error — better than having no way to record the order at all.

**Modals are for leaving; footers are for committing.** Finish Audit with nothing counted used
to raise the "Leave this audit?" sheet, on the reasoning that nothing counted is an exit rather
than a completion — **this reverses that**. The rep did not ask to leave, they pressed Finish,
and being handed `End this visit` for pressing the wrong button is a worse surprise than being
told to count something first. It also made that modal mean two things at once. It now means
one, which is what lets it be trusted on the routes it still owns: the ← button and the
phone's Back, each screen with its own wording. Save on Edit Audit now asks **every** time
rather than only when the lines differ — the rep cannot see which case they are in, and a
control that behaves differently for invisible reasons is worse than one extra tap; what the
tick commits is unchanged, so an unchanged Save still writes no version and no timeline entry.
The in-row remove question is two words on both lists, `Remove?`.

**Smaller, in the same pass.** What you add out of a search lands on **top** of the list
rather than at the far end, on all three screens. Typing `12` into a stepper showing `0` no
longer gives `120` — the first digit is intercepted in `beforeinput` while the field reads
exactly `0`, which needs no timer and does not depend on where in a 3mm digit the tap landed.
Tapping a search box opens its options everywhere, owned by `wireSearchInput` so no screen can
drift from it. Audit History lost its Newest/Oldest picker — it put a switch for breaking a
promise directly under the screen's own "newest first" subtitle — and its box is now
`Search customer…`.

**Not tested this release.** No new sales order was raised in Zoho Books, and none of this was
re-run on the deployed GitHub Pages app or through `tools/mobile-test.sh` — so the Pixel 8 half
of this cut's usual mobile bar is unverified for these changes. Nothing here touches the
order-writing path (the unit sheet shows a price and sends none), but that is reasoning, not a
test. Worth one real confirmed order and one Android pass on the deployed app before treating
this release as proven.

## Offline

Self-contained for **content**. Every asset the screen needs is packaged, including the
product tiles, so nothing here reaches the network to render. That is a difference from
`v3`, whose product art was hotlinked from Wikimedia Commons at view time.

The one deliberate exception is the network call this cut exists to make: confirming a
Predictive Sales Order posts to the Zoho bridge. Stock Audit is untouched by that and still
runs entirely offline — a rep counting stock in a shop with no signal loses nothing.

## Running it

Served over HTTP, from this folder:

```
python3 -m http.server 8000
```

then <http://localhost:8000/>. On GitHub Pages it works as-is.

**Stock Audit needs nothing else.** Create Order does: it posts to the Zoho bridge, which
is deployed separately (see below) because GitHub Pages cannot hold an OAuth secret.

## Deployed — 26 August 2026, redeployed 27 and 28 August 2026

| | |
| --- | --- |
| App | <https://nishant-devekar.github.io/foodbridge-mock-platform/v4/> |
| Bridge | `https://zoho-function-nu.vercel.app` — source in `zoho-function/`, deploy with `./deploy.sh` |
| Zoho | organisation **PMF Foodbridge**, India data centre, INR |

The bridge's `ALLOWED_ORIGINS` is the GitHub Pages origin **only**, so a page served from
`localhost:8003` cannot call production — that is deliberate, not a misconfiguration. For
local work run `node dev-server.js` and point the page at it:

```js
localStorage.setItem("fb-api-base", "http://localhost:8787")
```

## The bridge key ships with the app — changed 27 August 2026

The key now lives in `integration-config.js` as `DEFAULT_KEY`, and every browser that opens
the app sends it. **No device needs provisioning.**

It used to be handed out per device by a link, `.../v4/?fbkey=<FB_API_KEY>#/...`, which
stored the key and stripped it from the address bar. That stripping is what broke it: the
URL left in the address bar — the one people then bookmarked, shared, or opened on a second
phone — carried no key at all. Those browsers sent no `X-FB-Key`, the bridge answered `401`,
and the rep only discovered it at **Confirm Order**, after building the whole order, in
front of a `Retry Sync` button that could never succeed. Clearing site data, private mode,
or Safari evicting `localStorage` put an already-working device back into the same state.
Reproduced against the deployed bridge: no key → `401 auth_failed`; key → past the auth gate.

`?fbkey=` in an old link is now **ignored** and only stripped, and any key a device stored
under the old scheme is dropped on load, so no browser stays pinned to a rotated key.

**What this costs.** The key is in a public repo, so it is discoverable by grep rather than
only by opening devtools. That is a smaller step than it sounds — a static page has to hand
the key to every visitor to use it, so it was never secret from anyone holding the app. It
is a speed bump against scanners, **not** authentication. The Zoho OAuth credentials it
stands in front of are on the server and never reach the browser. Rotate by editing
`DEFAULT_KEY` and `FB_API_KEY` together and redeploying both.

**Order ids are per device.** `FB-SO-26-08-4G5F-001` — the four characters before the
counter identify the browser. The counter is derived from that browser's own stored orders,
so without the tag every device's first order of the month is `001`, and that id is exactly
what Zoho stores as `reference_number` and what the bridge de-duplicates on. A second
device's `001` would otherwise be handed the first device's sales order. The bridge also
refuses outright a reference whose sales order belongs to a different customer, which covers
ids minted before the tag existed.

**Pricing is an open commercial question, not a technical one.** 63 of the 86 Zoho items are
priced at the MRP printed in the tenant's own product names, which is retail rather than the
trade price a distributor charges a shop; the remaining 23 have no MRP in their name and sit
at zero. FoodBridge sends no price, so Zoho's rate is authoritative and demo totals read high
until someone sets real trade pricing on the items.

## Where the screen came from

| Route | Screen | Source |
| --- | --- | --- |
| `#/customer-management/stock-audit-health` | Stock Audit & Health | `modules/foodbridge-customer-mockup/v3/screens/customers/stock-audit.html` |

Crawled from `Nidhimehta9399/foodbridge-customer-mockup`'s `v3`, on the
`only-customer-stock-audit` branch.

## Verified

Driven on a real Android emulator (Pixel 8, Chrome 124) and a real iOS Simulator
(iPhone 16 Pro, Safari 605.1.15) — real touch input, no device emulation. Checked that the
sidebar is absent in both orientations and at desktop width, that no burger remains to open
one, that the module still fills the frame with its own sidebar clipped, and that the whole
flow runs: search customer → select products → count → finish → saved.

The Predictive Sales Order journey was then verified end to end against the real thing, from
the deployed GitHub Pages app rather than a local copy: predict → edit a quantity away from
the recommendation → confirm → the deployed bridge → Zoho Books. `SO-00005` carries
reference `FB-SO-26-08-001`, the right customer, four correct items, and the **edited** 23
rather than the recommended 40 — confirmed by reading the order back through the API and by
opening it in the Zoho Books UI. Retrying an order whose local Zoho id had been wiped
attached to the existing sales order instead of raising a second one; the organisation holds
five sales orders and five distinct references. Stock Audit, Audit History and Audit Detail
were re-run on the deployed app unchanged, at phone and desktop width, with no console
errors.

### 27 August 2026 release

**The forecast** was verified by back-test rather than by eye, which is the only way a
recommendation can be checked: each of the tenant's real orders predicted from only what was
known before it, tuned on 2025 and measured on 171 unseen 2026 orders. Both engines were run
through the identical harness for a like-for-like comparison; the figures quoted above are
that harness's output against the history this release ships. The whole flow was then driven
in the app — customer search → recommendation → the basis sheet → the in-row remove
confirmation — and cross-checked line for line against the same prediction computed outside
the browser.

**The bridge key** was reproduced as a live failure before it was fixed: a bare load of the
deployed app reported `apiKeySet: false`, and a request to the deployed bridge with no key
returned `401 auth_failed` while the same request carrying the key passed the auth gate and
failed later on a deliberately malformed body. That probe was chosen so it could never write
to Zoho. All four configuration paths — clean browser, browser holding a stale provisioned
key, an old `?fbkey=` link, and a `?fbapi=` override — were then checked to send the right
key against the right bridge.

**Not tested this release:** no new sales order was raised in Zoho Books. The order-writing
path is unchanged by both changes — the forecast only decides quantities before the commit
point, and the key fix only decides whether the request is authorised — but the end-to-end
write was last exercised on 26 August, not now. Worth one real confirmed order on the
deployed app before anyone treats this release as proven in production.

# FoodBridge mock platform — Version 7

**Opened 16 September 2026.** New-user onboarding: five primary screens and nine
contextual sheets. **A working cut — this is where onboarding work lands now.**

Its starting bytes came from `exagon-ai/foodbridge-pmf`, `versions/v5`, release
`5.2`, commit `ae311d3`. That is where it *came from*, not where it lives.

## v7 does not supersede v6, despite the number

`v6` is still the working cut for the **whole platform** — sidebar, routing, 26
destinations. Platform work lands there.

`v7` is a working cut for **one flow**. The two are beside each other, not behind
each other, the same way `v4` stands beside `v6` as a one-screen cut. A number
here means "the next folder somebody opened", never "the newest truth".

## It is self-contained, and owes nothing to the PMF repository

Every one of its 466 internal references resolves inside `v7/`. Nothing here
reads a file, a manifest or a commit from `foodbridge-pmf`, and nothing there is
affected by editing this folder. The onboarding flow loads nothing from the
network.

The PMF repository holds the same flow as its own `v5`, published at its own URL
and frozen at releases `5.1` and `5.2`. **The two are now separate products and
will diverge.** Neither is authoritative over the other; if the two ever need to
agree again, that is a decision somebody has to make and write down, not
something either repository can work out on its own.

## What it is

| | |
| --- | --- |
| **S01** | Business profile — two groups, five rows, GSTIN verified inline |
| **S02** | Where the data lives — four sources plus a sample business. A source opens **consent**; nothing is read until the user says so |
| **S03** | What we received — 532 orders · 86 products · 40 customers, each inspectable with its provenance. Gaps state what they would unlock |
| **S04** | Your business — *23 shops are past their usual order date*. The headline carries its own fact |
| **S05** | The opportunity — a brief (23 stopped · 16 we can prepare · 7 need your eye), a recommended list with **nothing pre-selected**, an explicit confirm, then 16 prepared drafts |

The nine sheets carry consent, file choice, sample confirmation, record
inspection, added evidence, the reasoning behind the insight, shop detail, the
action confirmation, and the drafts themselves. None of them is a screen: each
opens from a decision already in progress and returns where it came from.

**A bare `/v7/` opens onboarding, not the dashboard.** The shell reads a `landing`
key from `assets/modules.json`; onboarding claims it *without* joining the
sidebar, because it is not a place the user comes back to.

**The drafts it prepares have a destination: Sales Orders → Order Drafts**, at
`#/sales-orders/order-drafts`. It is the same module under `?view=drafts`, so it
reads the record the flow wrote rather than a second copy that could disagree
with it. Everything the flow creates is reachable there afterwards, including
after a reload and from a cold entry into the sidebar.

**Mobile is the target.** 375×812 is what it was designed and reviewed against.

## What is real, and what is not

Since 17 September 2026 S02 brings in the **user's own data** and nothing else.
There is no demonstration business in the customer-facing flow.

| | |
| --- | --- |
| Connect an app · Zoho Books | **real, proven 17 Sep 2026 with a real login** — the user signs in to their own Zoho and grants 10 READ scopes; the bridge reads customers, products, 24 months of sales orders (drafts included) with their lines, and invoices, payments, credit notes, estimates, purchase orders, bills, expenses and vendors, whole; it keeps nothing afterwards |
| Upload files · Excel and CSV | **real** — read in the browser, a type per file chosen by the user, a result per file. PDF is not accepted and not offered |
| Whose records the flow shows | **the user's** — the chip reads *Your Zoho Books · {organisation}* or *Your uploaded files* on every screen from S03 on |
| GSTIN check | **real** — a live GST register lookup through the bridge (S01) |
| Draft preparation | **real in the browser** — held at Order Drafts, reviewable and editable, sent to nobody, written to no accounting system |
| The reorder engine | **real** — back-tested at 66.5% precision / 69.6% recall on 171 unseen 2026 orders |
| Development stand-ins | **dev only** — `?fbmock=` on localhost swaps in stand-in readers that serve the demonstration tenant's export. They cannot load on any other host; a DEV badge shows while they are on |

The confirm sheet names what does *not* happen, and the prepared screen repeats it
as an outcome: held 16, sent 0, written 0.

**There is no rupee figure anywhere in the flow.** This tenant has no invoices, no
payments and no cost price, so receivables, collections, capital-tied and margin
are not computable. They are absent rather than shown as ₹0, because a zero would
be a lie about what we hold. The capability matrix is in
[`context/STATUS.md`](context/STATUS.md).

## Nobody has used it

The hypothesis — that a new distributor reaches a meaningful first action in one
session without manual entry — is **unvalidated**. No distributor has been
recruited and no session has been run.

## How to iterate it

This folder is edited directly. There is no release machinery here and no
validator; the discipline is this document.

**Record every change below, dated, saying what changed and why.** That is the
repository's convention — `v6/VERSION.md` is the worked example — and with the
PMF lifecycle gone it is the only place the reasoning survives.

Four rules worth keeping, because the flow was designed under them and they are
what make it defensible rather than merely finished:

1. **Must-have only on primary screens.** Every visible element explains the
   current state, supports the current decision, or enables the current action —
   or it moves into a sheet. Ambiguity is solved by cutting, never by adding a
   sentence of explanation.
2. **Nothing consequential starts on its own.** A source opens consent; the user
   starts the operation; it can be cancelled.
3. **A signal without its evidence is absent, not zero.** Never render a blocked
   figure as ₹0, greyed, or estimated.
4. **A recommendation is never a pre-made choice.** Lists arrive with nothing
   selected.

The reasoning behind all four, with the alternatives that were rejected, is in
[`context/`](context/README.md).

## Changes

### 16 September 2026 — opened

Carried over from `foodbridge-pmf` `versions/v5` at release `5.2`, then made
independent:

- The PMF lifecycle files — `version.json`, `releases/` — were moved into
  `context/`. They name commits in the other repository and cannot be rebuilt
  from here; they are kept as a record of what that repository published, not as
  machinery to maintain.
- `modules/foodbridge-inventory-intelligence/v1/index.html` loaded its stylesheet
  from `/foodbridge-inventory-intelligence/assets/css/style.css` — a root-absolute
  path that only resolved when that module was published at its own Pages root,
  and a 404 everywhere else. Pointed at the copy already sitting in this folder.
  The same was done to a commented-out favicon so no root-absolute path is left
  to be uncommented later.
- The records the flow cites — one opportunity, two learnings, eight decisions —
  were copied into `context/` so the reasoning does not depend on the other
  repository being at hand.
- The module's `owner` in `assets/modules.json` read
  `exagon-ai/foodbridge-pmf (v5)`. The shell renders that string as *"Owned
  by…"*, so it told anyone looking that changes belonged in the other
  repository. It now names this one. Where the bytes originally came from is
  recorded here instead, which is the right place for it.

Verified running from this repository at 375×812: a bare `/v7/` opens onboarding,
the engines compute 532 / 86 / 40 and the 23 overdue shops, the sample-business
marker stays amber on every screen, and there are no console errors.

### 16 September 2026 — the closed-loop correction pass

A production review drove every path in this flow and found it **not shippable**:
six P0 failures across provenance, exits, destructive actions and the draft
workflow. This is the single pass that answers them. The five-screen
architecture is unchanged, no screen gained content, and every new explanation
is in a sheet.

**Provenance — the flow no longer claims anything it did not do.**

- Choosing Tally, Zoho or Vyapar used to run "Connecting to Tally → Reading
  order history" and land on *"Here's what we received — 532 orders"*, badged
  *"Tally · connected"*, with the inspect sheet citing a *"Tally export"*. The
  same 532/86/40 came back from the sample business, because the connectors
  always returned the demonstration dataset. A distributor would have believed
  FoodBridge had read their books. The consent sheet now states the boundary
  before the user commits, the operation's steps describe what actually
  happens, the chip reads **"Tally · demo data"** in the same amber the sample
  uses, and it opens a sheet explaining whose records these are. The words
  "connected" and "export" are gone from the customer-facing UI.
- The badge used to appear on *opening* a consent sheet and survive **Cancel**,
  so the flow claimed a Zoho connection the user had declined. `state.source`
  is now written in the operation's `onDone` and nowhere else. It also never
  degrades to "Your data": the source that produced the data keeps its name
  through any later failure.
- The inspect sheets printed the orders' date range and shop count under
  Products and Customers too. Each record type now carries its own provenance.

**Exits — nothing leaves the flow by accident, and nothing leaves it for good.**

- S04's supporting rows navigated the whole window into the Stock Audit module:
  onboarding abandoned, demonstration marker dropped, no way back, and the
  screen it landed on did not even show the thing that was tapped. They open a
  **sheet** now.
- "Not now" went to a dashboard full of invented rupee figures — breaking this
  flow's own third rule two taps after honouring it — with no confirmation and
  no route back, because onboarding has no sidebar entry. It now confirms, parks
  the opportunity on the persisted record, and lands on Order Drafts, which
  offers **Pick it up**.
- The second supporting count on S04 (*"32 shops ready for a reorder"*, beside a
  headline of 23) is **removed**. It was a rival count, worded almost
  identically, derived differently, and supported no decision the screen asked
  for. What remains — stock — is a different dimension and opens a sheet saying
  what it is for.
- S02 now marks the source already in use and offers **See what we received**.
  A user who reached it from a failure could previously only return to their own
  data by running a read again.

**Failures stay in context, and nothing offers an input that cannot succeed.**

- A failed document read replaced the whole screen, removed the Back control and
  offered "Try another way", which dumped the user at source selection. It is
  now a result state **inside the sheet they opened**: S03 is untouched behind
  it, the primary action is *Keep what we have*, and it says plainly that
  reading documents is not implemented and will not succeed for any file.
- The S03 gap rows offered "Add", a file picker and a camera for evidence this
  tenant has none of and this preview cannot ingest — a guaranteed failure that
  invited the customer to blame their own documents. They are now **What this
  needs**: the requirement, what it would unlock, and no input at all.
- Below the floor the flow was a closed loop — "Connect" returned to S02, which
  returned below the floor, and both uploads failed. It now names what is
  missing and what it would unlock, and carries a forward path that works.
  `?evidence=none` no longer empties the sample, because the sample is that
  forward path.

**S05 is a real draft-review workflow.**

- 16 drafts in one sheet of 146 number boxes became a **list, one row per
  draft**, each opening its own editor.
- Product names were shortened to the point of collision: `KING CHILLI PICKLE
  (100 gm)` and `KING CHILLI PICKLE (pet Jar)` both rendered as "king chilli
  pickle" in the same order. Drafts and shop sheets now show the **full name**.
- Lines can be **removed**, products can be **added** from the catalogue, there
  is an **explicit Save**, and an edit is **visible** — the line is marked
  *changed*, `suggestedQty` stays beside it, and the draft is badged *Edited*.
  Cancelling a dirty edit confirms first.
- **Discard is protected.** It deleted 16 drafts and every edit on one
  unconfirmed tap, from a button under "Close". It now states the exact loss
  (drafts, lines, edits), and it is **undoable**.
- "Clear all" cleared only the recommended group while the counter still
  reported the leftover selection. It clears all of it.
- Both brief rows are buttons, and all seven "need your eye" shops are
  reachable — four of them were named in inert text and could not be opened.

**S01 is must-have only, and the GSTIN badge is tied to a value.**

- "✓ Verified" survived editing the GSTIN to a different value and survived
  clearing the field, and the Verify button never came back. The check is now
  bound to `gstCheckedFor`, the exact string it ran against; any change or a
  clear invalidates it and Check returns. It also validates **format**, says so
  ("Format checked"), and no longer fills in a business name it cannot know.
- "HOW WE REACH YOU" — name, mobile, email — accepted `not-a-phone-!!!` and was
  read by nothing, kept by nothing and reached nobody. The three fields are
  **removed** rather than validated into looking real. Business name stays
  because it is now used: it titles Order Drafts. Continue is blocked without it
  and says why.

**The file path now declares itself, and a chosen file can be un-chosen.**

- "Choose your files" carried no consent block while all three connectors did —
  the one path that actually takes the customer's documents said less about
  what happens to them than the paths that take nothing. It now carries the
  same two headings: what we'll read (only the files you pick, looking for
  customers, products and order history) and what won't change (nothing is
  uploaded; they are read in this browser and kept nowhere), plus the preview
  boundary before a file is chosen.
- Chosen files were plain text with no way to remove one, so picking the wrong
  document meant cancelling the sheet and starting over. Each row now carries a
  remove control, the Read button re-disables when the last one goes, and the
  input is reset after each pick so the same filename can be chosen again.

**Other**

- `assets/platform.js` loads a module with `location.replace()` rather than by
  assigning `src`, so a frame load no longer pushes its own history entry. The
  deeper problem is noted in that file and **not fixed**: see below.
- Storage key `fb.v5.onboarding` → `fb.v7.onboarding`; the profile and the
  parked flag persist alongside the drafts.
- The Sales Orders nav item becomes a group of two — the module's own list, and
  Order Drafts. That is a deliberate departure from the copied QA sidebar, taken
  because a destination nothing links to is not a destination.

**Known and not fixed.** A browser Back that lands on an entry whose hash has
not changed can have the browser restore an earlier frame document, so the
sidebar and address bar name one destination while the frame shows another. It
fires neither `hashchange` nor `popstate` on the shell's window, so the shell
cannot see it to correct it. It **predates this pass and affects every
destination** — Dashboard → Workforce Management → Back reproduces it. Fixing it
means the shell owning its history entries instead of letting frame loads create
them, which is a change to the shell's routing, not to this flow.

Verified at 375×812 and at 1280×860, in the shell and standalone: every P0 above
re-tested against the review's own steps, no console errors, and the engines
still compute 532 / 86 / 40, 23 overdue, 16 preparable, 7 needing an eye.

**One draft object, everywhere.** A sixteen-step acceptance test drove the whole
loop: prepare 16, edit a quantity in the first draft, save, close, reach Order
Drafts by clicking the sidebar, confirm the same 16 and that both the edited and
the suggested quantity survived, refresh, return to onboarding, delete exactly
one draft, and confirm it is gone from both views. The flow and the destination
are two views of one record: a single `sessionStorage` key, `fb.v7.onboarding`,
byte-identical when read from the shell and from the module, with no
`localStorage`, no IndexedDB and no cookie holding a second copy.

### 16 September 2026 — the mobile pass

Driven on real devices in the iOS Simulator, not an emulated viewport: an
**iPhone SE (3rd gen)** at 375x667 with a home button, and an **iPhone 16 Pro**
at 402x874 with a Dynamic Island and a home indicator. Nothing below changes
the flow, the data model or the locked UX; no screen gained a word.

**The keyboard.** Every editable field sat below 16px, so iOS Safari zoomed the
page on focus and never zoomed back — the layout stayed panned sideways for the
rest of the session. `.ob-fr input`, `.ob-dl-q` and `.ob-search` are now 16px
(and the placeholder with them, so text does not resize the moment typing
starts). Separately, iOS does not shrink the layout viewport by the keyboard's
full height, so the sticky footer sat underneath it and the primary action
disappeared exactly when the user finished typing. `trackKeyboard()` publishes
what the keyboard actually covers as `--ob-kb`, measured against the VISUAL
viewport, and adds the 44pt Safari form accessory bar that is reported by
neither; the footer pins itself above it and the open sheet shrinks to match.
`sticky` could not do this — on a short screen it never reaches its threshold.

**Autocorrect was editing the customer's business name.** Typing "Miha Foods"
stored "Mina Foods", and nothing downstream could know. Every field now carries
`autocorrect="off" spellcheck="false"`, with `autocapitalize` set per field, and
`enterkeyhint` set so the return key says what it does.

**Scroll position survived nothing.** `render()` scrolled to the top on every
call, and opening a sheet is a render — so tapping the twelfth shop to look at
it returned the list to the first. The page now only returns to the top when the
SCREEN changes.

**The page scrolled behind open sheets.** Dragging the scrim slid the screen
underneath away while the sheet stayed put. `applyScrollLock()` fixes the body
at its current offset while a sheet is open and restores it on close.

**Hit targets.** Fourteen controls measured under 44px, including the S05
checkbox at 27px (tapped more than anything else in the flow), "Why this
matters" at 18px tall, and every secondary action — Cancel, Not now, Discard
all drafts — at 28px. The quiet ones keep their drawn size and gain an
invisible `::after` expander, because a 44px checkbox would shout louder than
the shop name beside it; the rest grew properly.

**Quantity editing.** Tapping a quantity put a caret where the thumb landed, so
tapping "8" and typing 42 gave 428. The field selects on focus, and carries
`inputmode="numeric"`.

**Density.** The S03 gap rows wrapped three deep at phone width because the
label, its consequence and its action shared one line. The action drops below
the text at <=430px — same elements, same words.

**Safe areas.** `env(safe-area-inset-top)` on the brand header and left/right
insets on the app column, alongside the bottom inset the footer and sheet
already had.

Verified on both devices after the fixes: no zoom on focus, the CTA clears the
keyboard and the accessory bar, "Miha Foods" is stored as typed, the quantity
field replaces rather than appends, the edited line reads "8 suggested changed",
Save lands and the draft is badged Edited, and a reload returns to the prepared
drafts. Emulated sweeps at 320, 360, 375, 390, 402 and 430 report no horizontal
scroll on any screen and no control under 44px. 320 could not be covered on a
real device: the narrowest iPhone this runtime offers is 375.

One caution for anyone re-testing: **Safari remembers page zoom per origin.** A
device that visited this build before the 16px fix keeps the old zoom and looks
broken until its website data is cleared. Testing from a second origin
(127.0.0.1 rather than localhost) confirms it in seconds.

### 16 September 2026 — input-focus zoom, measured rather than assumed

The previous entry claimed the 16px rule fixed focus zoom on the evidence of
screenshots. That was not proof. This entry records measured before/after
viewport state from both devices, taken with a temporary probe that captured
`visualViewport.scale`, `devicePixelRatio`, `innerWidth/Height`,
`visualViewport.width/height/offsetLeft/offsetTop`, `scrollX/Y` and the
document, body and clientWidth, at three moments: immediately before the field
was touched, after focus settled, and after the keyboard closed.

**The first round of testing was invalid.** The Simulator had a hardware
keyboard attached, so the software keyboard never appeared and nothing that
depends on it was being exercised. `ConnectHardwareKeyboard` is now off.

**Measured, iPhone 16 Pro, business name, fresh origin:**

| | scale | inner | visual | offset | scrollX | doc / client |
| --- | --- | --- | --- | --- | --- | --- |
| before | 1 | 402x714 | 402x714 | 0,0 | 0 | 402 / 402 |
| focused | **1** | 402x714 | 402x404 | **0**,0 | **0** | 402 / 402 |
| closed | **1** | 402x714 | 402x714 | **0**,0 | **0** | 402 / 402 |

**Measured, iPhone 16 Pro, draft quantity (`type=number`, inside a sheet):**
before `scale 1`, focused `scale 1` with `offsetLeft 0`, `scrollX 0`,
`doc 402 = clientWidth`, closed `scale 1` and offsets back to `0,0`. The keypad
that appears is numeric.

**Measured, iPhone SE 3rd gen, business name:** `scale 1` before and after,
`scrollX 0`, `doc 375 = clientWidth`, `offsetLeft 0`.

**Measured, product search (`type=search`, inside a scrollable sheet):**
`scale 1 -> 1`, `scrollX 0`, `offsetLeft 0`, `doc 402 = clientWidth`.

The invariant holds on every editable control in the flow, on both devices, at
1x, with no horizontal pan and no document wider than the viewport.

**What the residual report was.** Safari persists page zoom **per origin**,
indefinitely. A device that loaded this build before the 16px fix keeps that
zoom, and the app looks panned and zoomed on every later visit until the site's
data is cleared — the page cannot reset it, and should not be able to. It
reproduces on `localhost` and disappears on `127.0.0.1` on the same device in
the same minute, which is how to tell it apart from a live defect in seconds.

**One real gap closed by this round.** `-webkit-text-size-adjust` was never set,
so Safari remained free to inflate text on its own and silently undercut the
16px floor the inputs depend on. `html, body` now pins it to 100%. The viewport
meta is unchanged and deliberately still carries **no `maximum-scale` and no
`user-scalable=no`** — the user's own pinch zoom is not taken away to solve a
layout problem.

### 17 September 2026 — S01 asks about the business, and really checks the GSTIN

S01 was two things at once: a contact form nobody read, and a GSTIN field whose
"Verified" badge came from a regular expression. It is now one thing — tell
FoodBridge about your business — and the check is a real external lookup.

**A real integration, server-side.** `zoho-function/api/gstin.js` is the only
route to the GST register. The browser never holds the credential and never
calls the provider: it asks the bridge, which authenticates against
Sandbox.co.in and returns a small provider-neutral answer. `gst.js` holds the
adapter; swapping providers touches `readTaxpayer()` and the base URL and
nothing else. The access token is reused across lookups, and dropped on a 401
so the next call re-authenticates.

**The local grammar test earns its place, and only that place.** It rejects a
malformed GSTIN before a paid lookup is spent on it, which is also what lets
"your number is wrong" stay a different sentence from "we couldn't check".
Passing it is never reported as verification. `Business found` is written only
on a `found:true` reply.

**Only what the register returned is drawn.** Legal name, trade name and status
each render if — and only if — the provider sent them. A cancelled GSTIN is
shown as found, in amber, with its real status and a line saying it is not
currently active. There is no "checked at" line and no re-verification policy.

**The user's business name is theirs.** The registry legal name is shown beside
it, never written into the field over it.

**The verdict belongs to a value, not a moment.** `gstVerifiedFor` holds the
exact string the provider was asked about. Edit the field and the badge goes;
edit it back and the answer returns from memory — proven against the provider's
own call log, which did not move across a full edit / restore / clear / retype
cycle. A failure while checking a *different* number no longer evicts a good
answer already held for this one.

**Nothing about GSTIN can block Continue** — verified, inactive, not found,
malformed, unreachable, timed out or never attempted.

**Removed from S01:** the three contact fields, and the provenance chip, which
could previously reappear on back-navigation once a source had been chosen.
`chrome()` now suppresses it on S01 unconditionally.

**Also fixed while here:** an unfinished S01 survived nothing. `restore()`
returned early when no source had been chosen, so a reload lost the business
name and the verification. The typed profile is now restored whatever stage the
flow reached, while the screen logic still turns on `mode` — so an unfinished
S01 comes back filled in, on S01.

Verified on an iPhone SE 3rd gen and at 390x844: scale 1 throughout, keyboard
stays open across the idle-to-verifying redraw, the Verify box does not change
size when it becomes a spinner, and the CTA clears the keyboard. 37/37 bridge
tests pass, 15 of them new and covering every reply the endpoint can produce.

**Closed the same day, against the live register.** With a real Sandbox.co.in
key the first live call failed, and usefully: the search is a **POST carrying a
JSON body**, not a GET with a query string, and a GET returns 404 — which reads
exactly like "no such GSTIN" and would have shipped as a silent wrong answer.
Their "no records found" also arrives as HTTP 200 with `error_cd: "FO8000"`,
directly on `data` rather than nested under `data.error` as their sample shows.
Both shapes are now accepted, and the corrected contract is covered by tests.

Proven end to end on an iPhone SE against the real GST register: business name
`Reliance Retail`, GSTIN `27AAACR5055K1Z7`, and the register answering
**RELIANCE INDUSTRIES LIMITED · Active**. That pairing is the rule about names
earning its keep — a real trading name and a real registered entity, shown as
two values, neither overwriting the other. Live not-found confirmed separately.
41 bridge tests pass.

### 17 September 2026 — S02: the user's own data, two real ways in

S02 was rebuilt from the approved UX. It asks one question — *How do you want
to bring your business data into FoodBridge?* — and offers the two real
answers: **Connect an app** and **Upload files**. It ends in ONE hand-off,
`DataReady`, that S03 consumes (`dataset.js`).

**Removed, not hidden:** Tally, Vyapar, the Zoho row that loaded demo data, the
"Files or documents" path that could never succeed, "Show me with a sample
business", the amber demo chip, the timed fake progress, the camera option and
`?evidence=none`. S02 no longer knows the demonstration tenant exists; nor do
S03–S05, which now read only the Dataset through `engine()`. `evidence.js` lost
its fallback to `window.SEED` / `FB_ORDER_HISTORY`, so forgetting to pass data
produces nothing rather than a demonstration business.

**Connect an app → Zoho Books.** A real per-user sign-in, which the bridge
did not have: its existing OAuth was a one-time operator setup. New, in
`zoho-function/onboarding.js` and `api/zoho/{ready,start,orgs,read}`:
- the return comes through the ALREADY-registered `/api/callback`, told apart
  by a signed `ob.` state, so no Zoho console change was needed
- read scopes only (contacts, settings, salesorders), `access_type=online` — no
  refresh token exists to keep or leak
- the access token is sealed (AES-256-GCM) and handed to the page in the URL
  fragment, which never reaches a server log; the bridge stores nothing
- the page drives the read in chunks (one page, or ten order-line lookups, per
  call), so progress is real, Stop is immediate, and each call fits a
  serverless limit
- a return this tab did not start (wrong or missing nonce) is "wasn't
  connected", never "connected"
- "Zoho Books connected" appears only after a genuine return
- Stop, a failure and a retry keep nothing; zero orders is a successful read

**Upload files.** Excel (.xlsx) and CSV, parsed in the browser with no library
(the xlsx zip is inflated with the platform's `DecompressionStream`). The user
says what each file contains; nothing is guessed from a name. Required columns
are found by header name (Zoho's export names first); a file without them fails
alone with the sentence saying what that type needs. The import tool's rules are
reproduced for orders: drafts/voids out, cancellations subtracted, weight-sold
lines dropped, one customer's orders on one day merged, median cycle.

**Shell.** `platform.js` now treats `#/onboarding?zoho=…` as the onboarding
route, so the result survives until the module reads and clears it.

**Found on the iPhone, fixed:** pressing Safari's Back on Zoho's sign-in page
restored the shell from the back-forward cache with its iframe no longer
accepting touches — the screen drew, no tap landed. A cached restore with a
sign-in pending is now turned into a real reload.

**Verified.** 58/58 bridge tests (17 new), 11/11 dataset tests against real CSV
and xlsx bytes. Against the **live** PMF Foodbridge org, server-side, through
the new read code: 1 organisation, 40 customers, 86 items (stock untracked, so
absent), order lines with item, quantity and unit — and 0 orders in the window,
because all 49 of its sales orders are drafts. On the iPhone 16 Pro Simulator:
S02-A, Connect an app, the consent sheet, the redirect to accounts.zoho.in,
Safari Back from Zoho, the iOS file picker with a real xlsx and two CSVs,
per-file failure and its sheet, and S03 labelled *Your uploaded files*. With the
stand-ins: one and several organisations, denied, failed sign-in, unreachable,
read failure and retry, expired sign-in, no Books organisation, Stop, zero
orders, partial and total file failure, Stop while reading files, replacing a
file, replacing Zoho data with files and files with Zoho, refresh, and S04 → S05
→ drafts on the handed-over data.

**Not verified:** a real sign-in all the way through Zoho's consent, because it
needs the account owner's credentials. Everything after the return has been run
against the live org server-side and against the stand-ins in the browser.

### 17 September 2026 — Zoho Books, proven end to end with a real login

**The real journey ran on the iPhone 16 Pro Simulator against a real Zoho
account.** S01 → Connect an app → Zoho Books → Zoho's own sign-in → Zoho's
consent screen listing ten READ permissions, accepted by the account owner →
callback → code exchanged (`accounts.zoho.in`, `api_domain www.zohoapis.in`,
all ten scopes granted) → one organisation, *PMF Foodbridge*, used
automatically → customers, products, sales orders and their lines, and eight
more modules read → DataReady → S03 **28 orders · 86 products · 40 customers**,
labelled *Your Zoho Books · PMF Foodbridge* → S04 **6 shops are past their usual
order date** → S05 the same 6. An independent server-side recompute from the
same organisation, through the same `readChunk` and `dataset.js`, gave the same
numbers: 49 sales orders (all draft, 26 Aug–9 Sep 2026) → 28 after 21 same-day
merges, 12 customers with orders, 6 overdue, no stock supplied (stock absent,
so S04 has no stock row).

**Product decisions taken in this pass (by the product owner, 17 Sep 2026):**
- **Drafts count as orders**, and so do orders pending or approved. Void and
  rejected never do. Every order keeps its Zoho `status` (and merged orders a
  `statuses` list), so this can be reversed downstream. This departs from
  `tools/import-order-history.py`, which dropped drafts.
- **Read everything Zoho Books will show a login**, keeping every field Zoho
  returns (`raw` on each record). This reverses the earlier data-minimisation
  rule: emails, phones, prices and addresses now reach the browser. Scopes:
  contacts, settings, salesorders, invoices, customerpayments, creditnotes,
  estimates, purchaseorders, bills, expenses — all `.READ`; no banking or ledger.
  A module the login may not see is ABSENT with its reason; the read goes on.
- **The consent sheet names all of it** — the one line of frozen S02 copy that
  changed, so it stays true. The reading screen gained a fourth step,
  *Invoices, payments and purchases*, so progress never sits on a ticked
  "Orders" while more is being read.
- The order window is **24 months** (the import tool's), not 240 days.

**Verified against the live API before relying on it:** `status` and
`order_status` carry the same value; `date_start` filters sales orders as a
range to today; untracked items carry `track_inventory:false` and no
`stock_on_hand` key; this plan reports a **1,000-requests-a-day** cap
(`x-rate-limit-limit`). A per-minute 429 is waited out twice (3 s, 8 s); a daily
cap (`x-rate-limit-remaining: 0`) is reported at once with its own sentence.

**Also changed:** same-day merging now happens in normalisation, so S03's count
is the Dataset's count; out-of-stock is counted only against products whose
stock was supplied ("25 of 100 tracked products", not "25 of 251"); moving
between S03/S04/S05 is saved, so a reload returns to the same screen; the
browser keeps the Dataset without `raw` if the whole thing will not fit in tab
storage; the bridge logs one line per outcome (never a code, token, state or
record).

**End-to-end harness (test path only):** `zoho-function/test/e2e/` — a stand-in
for Zoho's accounts server and Books API, and a second copy of the real bridge
pointed at it. The real page and real bridge ran unmodified through: one and
two organisations and none; zero orders; three pages of customers and two of
invoices; tracked-zero, tracked and untracked stock; missing and nameless line
items; a module refused (403); timeout; per-minute and daily limits; a 500; a
malformed 200; expiry mid-read and retry through Zoho; denial; a refused code;
a forged and an expired state (400, no redirect); a valid state carrying
another tab's nonce (refused); reload mid-read (quietly back, nothing kept).
Counts matched the harness's own expectation exactly (e.g. 450 customers · 251
products · 303 orders · 230 invoices).

**Automated:** bridge 62/62, dataset 14/14.

**Known, not fixed:** the first real attempt that afternoon ended on a failure
sheet before the bridge logged outcomes, so its cause is unknown; the next two
attempts succeeded. The 1,000-a-day cap is per organisation and each order costs
one request, so a large account cannot be read in one day. Zoho gives an
`online` token only; every visit signs in again.


### 17 September 2026 — "Coming soon" apps on Connect an app

At the product owner's request, Connect an app now lists **Tally, Vyapar,
QuickBooks Online and Xero** below Zoho Books, each greyed out with a *Coming
soon* label. This reverses the earlier "no coming-soon cards" rule, deliberately.
They are not buttons, so a tap does nothing (verified on the iPhone 16 Pro
Simulator), and nothing about them suggests they can be used. Zoho Books and
"My app isn't listed" are unchanged.

Same day: the five apps show **their own brand marks** instead of generic icons,
downloaded with the product owner's approval and recorded in
`modules/foodbridge-onboarding/screens/logos/SOURCES.md` (Simple Icons SVGs for
Zoho, QuickBooks and Xero; the published site icons for Tally and Vyapar). The
coming-soon marks are faded so the row still reads as unavailable. Tally's
source is only 48px, so it is slightly soft.

### 17 September 2026 — S03 visual pass

Four layout faults found on the iPhone 16 Pro Simulator, fixed in CSS only (no
copy or structure changed):
- the heading sat directly on the three figure cards; it now has room
- a phone-width rule wrapped each "Add later" row so its icon stood alone on a
  line above the title; rows are now a two-column grid, icon beside text
- "What this needs" floated at a 34px indent aligned to nothing; it now lines up
  with the row's text
- the card chevrons were drawn in the border colour and all but invisible; they
  now use the muted text colour. The "ADD LATER" label also sat 35px above its
  panel and now sits 10px above it.
The "We need a little more" shape uses the same row and was checked at 375px.

### 17 September 2026 — Connect Zoho Books from any local page, without a ritual

**What was seen.** On the iPhone 16 Pro Simulator, served fresh on
`localhost:8011`: S02 → Zoho Books → Continue to Zoho → *"Zoho Books wasn't
connected — We couldn't reach Zoho just now."* Nothing had been read; the sheet
told the truth, but the cause was ours, not Zoho's.

**Root cause — two independent breaks, both from a page origin nobody had
typed into a list.**
1. `integration-config.js` defaulted `apiBaseUrl` to the deployed Vercel bridge
   whenever no `fb-api-base` had been stored on that browser. The deployed
   bridge has no `/api/zoho/*` (those routes are local and undeployed) and
   allows the published origin only, so `GET /api/zoho/ready` failed and
   `RealZohoOAuth.begin` reported `unreachable`. Every fresh browser or
   Simulator hit this until someone remembered to open the page once with
   `?fbapi=http://localhost:8787`.
2. Even with the override, the local bridge matched origins against a
   hand-typed `ALLOWED_ORIGINS` (8007 and 8017 that day). From 8011, `cors()`
   would send no `Access-Control-Allow-Origin` — the same `unreachable` — and
   `allowedReturn()` would refuse the return address, so `/api/zoho/start`
   would answer 400 *"This sign-in link is not valid."*

**Fix.**
- `integration-config.js`: a page whose own host is loopback (`localhost`,
  `127.0.0.1`, `[::1]`) now defaults to `http://localhost:8787` — the same rule
  `readers.js` uses to admit dev stand-ins. A published page still defaults to
  Vercel; a stored `fb-api-base` or `?fbapi=` still wins. Cache tokens bumped
  on `onboarding.html` and `stock-audit.html`, which both load it.
- `zoho-function`: `originAllowed(cfg, origin)` in `zoho.js` — the exact list,
  plus any `http://localhost:*` / `http://127.0.0.1:*` origin when
  `ALLOW_LOOPBACK_ORIGINS=1`. `dev-server.js` sets that itself (it is the only
  thing that runs on a developer's machine; Vercel never executes it), and its
  banner says which rule is in force. `cors()` and `allowedReturn()` both use
  it. Tests added: strict config refuses 8011, dev config accepts it, and
  `https://localhost`, `localhost.evil.example` and `evil.example:8011` are all
  refused. 69/69 pass.

**Verified on the Simulator after the change:** reload → S02 → Zoho Books →
consent sheet → Continue to Zoho → Zoho's own consent page for *FoodBridge
PMF*, listing the ten READ scopes, with the bridge answering
`Access-Control-Allow-Origin: http://localhost:8011` and `/api/zoho/start`
redirecting to `accounts.zoho.in`. A return to `https://evil.example` still
gets 400.

**Why this way and not a broader one.** The deployed bridge keeps its exact
allowlist — that list is the whole defence against another page driving a
credentialed integration — so the widening is confined to the local runner and
to loopback over plain http. And the page-side default is a *default*, not a
sniff: it changes nothing for a published page and nothing for a device that
already chose a bridge.

### 17 September 2026 — Upload files: the file says what it holds

**Relooked at against the ideal, on the iPhone 16 Pro Simulator with the real
picker.** Both ways in already ended at S03; the Upload path got there by a
worse road. Walking it with one real `orders.xlsx`:

1. **It asked what it could have read.** Every file carried a *Choose what this
   contains* chip, its own sheet, and a disabled *Choose what each file
   contains* button until all were labelled — two taps per file before a
   single byte was read. The file's columns (`Order Date · Customer Name · Item
   Name · QuantityOrdered`) said what it was, and the extractor already knew
   those columns. Stage 1 of the flow map: *at no point does it ask for
   something it could have fetched*. Connect an app never asks which modules
   the account holds.
2. **No harvest moment.** Zoho shows *Reading your Zoho Books → Customers ✓
   Products ✓ Orders ✓*; files showed a spinner and a tick beside a filename.
   What came out of each file was not said until S03.
3. **One file, one kind.** A real workbook export (Tally, Zoho's *export all*)
   carries a customers sheet, an items sheet and an orders sheet; it was read
   as the one kind the user named and the rest was dropped without a word.
4. **Dead ends.** Every file failing left no footer at all. Below the floor,
   S03 sent a files user back to S02-A — *Choose a different source* — instead
   of letting them add the missing file where they were. The flow map's
   F05 → F07 → F05 loop was described and not built.

**The rule of 17 Sep was "nothing is guessed from a name", and it stands:**
the name is still never consulted. Reading the columns is not a guess; it is
the read.

**Redesigned to the same shape as Connect an app** — choose → Read →
FoodBridge reads what it can → S03:
- **S02-F.** Add files → *Read N files*. That tap is the consent; nothing is
  opened before it (rule 2). No labelling step, no disabled button.
- **Each file says what it holds** (`dataset.js classify`): orders, then
  invoices, are tried first because each also carries a name column that
  would pass as a plain list; then products; then customers. **Every sheet of
  a workbook** is classified, and each kind found is kept — one file can now
  give *Customers · 3 · Products · 3 · Orders · 2*. A sheet that is none of
  them is passed over.
- **FoodBridge asks only when a file genuinely cannot say** — a bare `Name`
  column is products or customers — after the read, in the row itself
  (*Products or customers?*), and the tap lands on those two answers, not a
  four-way list behind an explanation sheet. A file the user has named is read
  as that; a replacement keeps the answer.
- **The row of a file that read is the harvest**, in the user's words and in
  S03's numbers: an orders sheet is one row per line and one customer's lines
  on one day are one order, so the count comes through the same `fromFiles()`
  and engine view S03 uses. *Orders · 517* on the row is *517 Orders* on S03,
  not 3,931 rows first and 517 later.
- **Endings.** All read → S03, as Zoho. Some failed → *We read 2 of 3 files*,
  Continue with 2; the failed row names why and offers Replace. None →
  *Connect an app instead*, mirroring the Zoho failure sheet's *Upload files
  instead*. Below the floor, a files user gets **Add more files** in place and
  *Connect an app instead* under it; a Zoho user keeps *Choose a different
  source*.
- Provenance lists each file once with everything read from it. A tab from
  before this change restores its files under their old shape.

**Rejected:** reading on add, before *Read* — it would make the file picker a
consequential act, against rule 2, for the sake of seeing the harvest one tap
sooner. Detecting from the filename — cheap, wrong often, and exactly what 17
Sep refused. A "looks like Orders — change?" chip on every row — a
pre-made choice dressed as a fact, and noise on the nine files in ten that
FoodBridge reads without doubt.

**Not touched:** S03's *Add later* sheet keeps its own type choice; its kinds
(payments, cost price, photographs) are outside what `classify` reads.

**Verified.** 19/19 dataset tests (3 new: the columns decide and the name
never does; a four-sheet workbook gives three kinds and provenance lists it
once; the bare-Name file asks, narrowed to two, and told which it is it reads
as before). In the browser, real parser, real fixture bytes: one `orders.xlsx`
→ Read → S03 with no question asked; workbook + ambiguous file → *We read 2 of
3* → the ask → Customers → Read 1 file → S03 (3 · 3 · 4); two unreadable files
→ *We couldn't read these files* → *Connect an app instead*, and the untyped
then typed failure sheets; a customers-only file → *We need a little more* →
*Add more files* → back to the files with their harvest intact after a reload;
the stand-ins' *Reading your files* with the harvest appearing file by file;
Replace holding the user's answer. On the Simulator through the real iOS
picker: `workbook.xlsx` + `customers.csv` → Read 2 files → *Customers · 3 ·
Products · 3 · Orders · 2* and *Products or customers?* → Customers → S03,
labelled *Your uploaded files*, provenance sheet naming both files and every
kind. Bridge suite 69/69 unaffected.

### 17 September 2026 — "We need a little more" is cleared the way "Add later" is

**Product owner's request:** the items on S03-B should have exactly the flow
S03-A's *Add later* items have. They were static rows with a footer that sent
the user away — *Add more files* back to S02-F, or *Choose a different
source* — while ten centimetres up the page an optional item could be cleared
in place. The thing the user *must* add was harder to add than the thing they
might.

**Now one machinery serves both shapes of S03.** `laterRow()` draws a row for
an unlock or for a missing kind; `openLaterSheet()` is the sheet for either;
`runLaterRead()` reads everything staged from the footer and
`dataset.addEvidence()` folds it into the data S02 handed over. Two new items,
`orders` and `products`, carry the floor's missing kinds. Read, the floor is
checked again in place: a customers-only upload → *Sales or orders · Add* →
choose `orders.csv` → *Read 1 file* → *Here's what we received · 3 · 2 · 3*,
chip *Your uploaded files + 1 file*, provenance naming the addition. From a
Zoho account with no orders the same rows appear and an orders file lands
against Zoho's own 86 products and 40 customers by name.

**`addEvidence` learned orders, products and customers** under `fromFiles`'s
rules — masters first, so a product named in a products file is the one an
order line attaches to; a shop only an order names is derived and marked so;
one customer's lines on one day are one order across everything, with an
already-merged order carrying its sources along. Below the floor there is
still **no Continue**: the footer holds *Read N files* when something is
staged and the other way in under it — *Connect an app instead* for a files
user, *Choose a different source* for a Zoho user.

**Not offered for these two items: the camera.** The bridge reads photographs
of invoices, payments and price lists, not of order books, so the sheet for
orders and products takes spreadsheets only and says so in one line.

**Verified.** 20/20 dataset tests (1 new: later-added orders and products are
absorbed by S02's rules, the merge is stable and sources accumulate). In the
browser: customers-only file → S03-B rows → sheet (no camera) → *1 file ready
to read · Change* → *Read 1 file* → *Reading your files* → S03-A with the
addition in the chip and the provenance sheet; the *Your products* item
disappears once the orders name products. Stand-in Zoho with zero orders →
the same row → S03-A at 517 · 86 · 40.

### 17 September 2026 — A file carries tags, as many as it earns

**Product owner's request:** one file can be several things — an invoice
export is invoices, and it is also the sales orders on its lines, and every
customer and product those lines name. The user should be able to put more
than one tag on a file.

**What the row says now.** After a read, the row lists everything the file
gives, in S03's numbers: the kinds that were read, and the kinds its lines
name — *Orders · 3 · Customers · 2 · Products · 2* for one orders file. That
line is a button: **tap it to tag the file**. The sheet lists the four kinds
with a tick each, any number on; a kind the lines merely name says so
(*Named on the lines · 2 · tick to read as a list*) and is left unticked,
because ticking it reads the file as that list in its own right — a product
named on an order line is derived; a product in a tagged product list is a
product. Done with different ticks marks the file unread; *Read N files* reads
it as its tags, each from the sheet that holds most of it. Nothing ticked
hands the file back to its own columns.

**A tag that gives nothing is said, not dropped.** Tag a totals-only invoice
export *Orders* and the row reads *Customers · 1 · Invoices · 1 · Orders ·
none*; the screen holds with *Continue* rather than going straight to S03, so
the user sees the tag they put on gave nothing. A file none of whose tags gave
anything fails alone, with the needs of each tag it carried.

`dataset.readFile(file, tags)` takes a list of kinds and answers `found` and
`none`; the stand-in reader does the same. Tags persist across a reload
(`tags`, replacing `type`); a tab from before carries its one type over as one
tag. Replace keeps the tags. The single-answer sheet for the products-or-
customers question sets one tag.

**Verified.** 21/21 dataset tests (1 new: an orders export tagged with all
four kinds gives orders, customers and products and names invoices as giving
nothing; the customers so read are not derived; an empty tag list reads
nothing). In the browser: orders.csv + products file → rows with what each
gives → tag sheet ticked as read, the named kinds said so → tick Customers,
Products, Invoices → *Read 1 file* → S03 (4 products: the tagged list keeps
the item the order rules drop as sold by weight). invoices.csv → *Customers ·
1 · Invoices · 1* → tag Orders too → *Orders · none* in red, screen held. Tags
survive a reload. On the Simulator: orders.csv → Read → S03 → back → the row
and its sheet → tick Customers and Products → *Orders · Customers ·
Products* staged → Read → S03 at 3 · 3 · 2.

### 17 September 2026 — Upload files, with nothing added yet: rows, not a void

**Product owner, on the empty state:** the user feels lost. Looking at it
that way it was plain why — a heading, one grey line, 600px of nothing, and
the only action at the very bottom. Nothing on the screen said which file to
go and get, or where from. Connect an app never feels like this because that
screen *is* a list of things to tap.

**Now S02-F with nothing added has the same shape as S02-C.** The question,
then four rows — Orders, Customers, Products, Invoices — each with the one
line that already existed for it (*Sales orders or order history* …) and an
upload mark; each row is the file picker. One quiet line under them names the
formats and where they come from: *Excel or CSV, exported from Tally, Zoho,
Vyapar or any spreadsheet. One file can hold more than one of these.* No
footer, so nothing sits below a void. The rows are the answer to "which file
do I go and get?"; they are **not labels** — a file chosen through the
Invoices row still says for itself what it holds (an orders export chosen
there reads as orders), because the file's columns are the truth and the row
was only the way in. Once a file is added the screen becomes the list it was.

Also found on the phone: the tap that opens this screen leaves the row under
it drawn as hovered (sticky `:hover` on touch). The source-row hover style
now applies only where a pointer can hover.

**Verified.** Browser and Simulator: the four rows at 375px, each opening the
real iOS picker; a file added through a row → *Read 1 file* → S03. Dataset
tests unaffected.

### 17 September 2026 — S02-A wears real marks, as S02-C does

**Product owner:** the two rows on *How do you want to bring your business
data in* carried stroke icons (a plug, an arrow) while the apps a tap away
carried their real logos; use images, like the logos, so it looks
production-grade.

- **Connect an app** now shows the apps themselves — Zoho, Vyapar,
  QuickBooks, Xero, the marks already in `logos/`, as a 2×2 cluster in the
  same white bordered tile S02-C uses. The category, at a glance.
- **Upload files** shows a spreadsheet document: a page with a folded corner
  and a green table, drawn as `logos/spreadsheet.svg` (ours, not a brand —
  listed in `logos/SOURCES.md`). Not Excel's mark: the row is about the file,
  not the app that wrote it.

`pathRow()` takes a ready mark instead of an icon and a tint. Checked at 3× on
the iPhone 16 Pro Simulator: the four app marks stay legible at 17px, and the
sheet fills its tile with a defined edge.

### 17 September 2026 — Published, and the bridge deployed behind it

`main` is on GitHub Pages at `/v7/`. The Zoho bridge was deployed to Vercel
(`zoho-function-nu.vercel.app`) with the onboarding routes and the GST lookup,
by the product owner running `deploy.sh` (the script now sets the production
callback and fetches the CLI itself).

**Tested on the published page, in the iPhone 16 Pro Simulator:**
- **Upload files, end to end:** kind rows → the real picker → workbook +
  ambiguous file → *We read 1 of 2* → the ask → Read → S03 (2 · 3 · 3) →
  *Add later* invoices → *Invoices added · add payments to finish* → S04 *2
  shops are past their usual order date* → S05 → *Select all 2* → confirm →
  *2 drafts prepared* (held 2 · sent 0 · written 0) → *Your drafts*.
- **GST verify, live:** a real register answer — *No business registered
  under this GSTIN* for the test number, Continue open.
- **Zoho, live:** consent sheet → `/api/zoho/start` → Zoho's own page answers
  **Invalid Redirect Uri**. The deployment's callback,
  `https://zoho-function-nu.vercel.app/api/callback`, is not yet listed under
  the client's Authorized Redirect URIs in the Zoho API console; only the
  account owner can add it. Everything up to that page is the deployed code
  working; the sign-in and consent after it were proven earlier today
  against the local bridge.

**A trap, for whoever tests next:** `?fbapi=` is remembered per origin. A
published page once opened with `?fbapi=http://localhost:8787` keeps calling
localhost — which WebKit then blocks as mixed content — and reports *Couldn't
reach*. Open it once with `?fbapi=https://zoho-function-nu.vercel.app` to put
it back.

### 17 September 2026 — Xero, on the same channel as Zoho Books

**Product owner:** finish Xero end to end and make it active, just like Zoho.
Chosen over QuickBooks (production keys sit behind Intuit's questionnaire) and
over Tally and Vyapar (no hosted API; their honest path is export → Upload
files). Built as **one channel with two providers**, not a second copy:

- **Bridge** — `zoho-function/xero.js` beside `onboarding.js`, sharing the
  seal, the signed state, the return-address rule and the reason codes;
  `api/xero/{ready,start,callback,orgs,read}`. Read scopes only
  (`accounting.contacts.read`, `accounting.settings.read`,
  `accounting.transactions.read`), no `offline_access`, so the 30-minute token
  is all there is. A sealed Zoho token is refused by the Xero routes (`p:
  "xero"` inside the seal). Organisations come from `/connections`, practices
  filtered out. **Xero has no sales orders:** ACCREC invoices in the 24-month
  window are the orders (DRAFT, SUBMITTED, AUTHORISED, PAID count; VOIDED and
  DELETED are counted in the notes); their line items ride along with the
  page, so the page fetches lines only for an invoice that came without.
  Quotes are estimates, ACCPAY invoices bills, suppliers vendors, payments and
  credit notes themselves. Items are keyed by their Code, which is all a line
  carries. 429 with `X-Rate-Limit-Problem: day` is `daily_limit`, otherwise
  `busy`. Every chunk comes out in the shape `onboarding.js` already returns.
- **Page** — `readers.js` has `apps.{zoho,xero}`, each `RealAppOAuth` and
  `RealAppReader` over `/api/<app>/…`; `takeReturn` accepts `?zoho=` or
  `?xero=`. `dataset.js fromApp(raw)` (fromZoho stays as its old name) with a
  per-app table: id prefix (`z`/`x`), module id fields and module shapes —
  Xero's `/Date(ms)/` dates, `Contact.ContactID`, `AmountDue`,
  `RemainingCredit`. Provenance `kind` is the app; the label *Your Xero*.
- **Screens** — an `APPS` table (name, mark, what the consent sheet promises,
  what it calls a business) drives S02-C's rows, the consent sheet, the
  sign-in, the return, the organisation picker, *Reading your Xero* (its own
  step names: *Invoices, as orders* · *Payments, quotes and purchases*), the
  failure sentences (*You didn't allow access in Xero…*), the chip and the
  provenance sheet. `state.zoho` became `state.conn { app, … }`; a return for
  a different app than the tab asked for is *not connected*. Xero left the
  *Coming soon* list; S02-A's cluster mark already showed it.
- **Stand-ins** serve both apps (`?fbmock=zoho:<scenario>` for either).

**Verified.** 75/75 bridge tests (6 new: scopes and signed state; exchange
with basic auth and the seal boundary; a bad code; organisations only; every
chunk's shape with the tenant on every call, `/Date/` parsing, drafts kept,
voided counted, lines fetched only when missing; Xero's refusals as the page's
reasons). 22/22 dataset tests (1 new: a Xero read lands as a Zoho read does,
under its own name — derived shop and product marked, same-day merge, payments
and bills in shape, a forbidden module absent with its reason, no second
invoices list). In the browser with the stand-ins: S02-C shows Zoho Books and
Xero live; Xero → consent in Xero's words → sign-in → *Reading your Xero* →
S03 165 · 86 · 40, chip *Your Xero · Stand-in Distributors (Xero)*, provenance
sheet naming Xero; denied on each app reads as that app.

**Not yet verified: a real Xero sign-in.** It needs a Xero app (free, at
developer.xero.com) with `https://zoho-function-nu.vercel.app/api/xero/callback`
as a redirect URI and its client id and secret in the bridge's environment —
`deploy.sh` pushes them. Until then the live page's Xero row says *We couldn't
reach Xero* (`/api/xero/ready` → `not_configured`), which is the truth.

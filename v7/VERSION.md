# FoodBridge mock platform — Version 7

**Opened 16 September 2026.** New-user onboarding. **Since 17 September 2026 it
is the eleven screens of the product owner's onboarding board**
(`ux/target/onboarding-target.jpg`) — see the last entry in the log. **A working
cut — this is where onboarding work lands now.**

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

### 17 September 2026 — the UI flip: the image's eleven screens are the product

**Product owner:** the attached onboarding board is the absolute UI source of
truth — its screens, its sequence, its copy. Existing code, integrations and
data are implementation resources, not UX constraints. Nothing absent from the
image stays in the flow; nothing in it is dropped for want of a capability.

**The flow is now exactly the board** (`ux/target/onboarding-target.jpg`):

| # | Image screen | What sits behind it |
| --- | --- | --- |
| 1 | Sign Up | A local account: name, business, mobile, email, password (SHA-256, never stored plain), in `localStorage`. **There is no auth backend in this cut** — Terms and Privacy open a sheet saying they are not published yet; Log in checks the account on this device. |
| 2 | Where is your data? | Tally · Zoho · Vyapar · Other · Files / Documents · I don't have any data |
| 3 | Connect your `<X>` account | **Zoho:** the real OAuth sign-in and read through the bridge (unchanged). **Tally, Vyapar:** neither has a hosted API, so *Connect with Tally* opens the picker for their export files, read in the browser by `dataset.js`. Other and Files open the picker straight from screen 2. |
| 4 | Importing your data | Five steps, each advanced by real work: connected → the read → `fromApp`/`fromFiles` → `toEngine` → saved. Back stops the read and keeps nothing. |
| 5 | Data found | Real counts: products, customers, suppliers (Zoho vendors), staff. A kind with nothing is not drawn as 0. A file that could not be read is said in a sheet. |
| 6 | Data check | Every kind, ✓ with its count or ! Missing. Missing products or customers can be added from a file right on the row. Skipped when nothing is missing. |
| 7 | Quick setup (Staff) | The account holder as Admin, plus anyone added (sheet: name, role). Kept in this browser. |
| 8 | Ready to order | How many of the four are really ready. |
| 9 | Create order | Prefilled by `FB_PREDICT` for the shop most overdue; else that shop's last order. Real catalogue search; a price only where the source has one (Zoho item rate, or the user's own order-line amount) — otherwise no rupee figure and the total reads —. |
| 10 | Order created | FB-ORD-000N, held in this browser (`fb.v7.orders`). Not written to Zoho: the onboarding sign-in is read-only. |
| 11 | You're ready | Go to FoodBridge → the platform dashboard. |

**Dropped from the flow because the image does not have them:** the GSTIN
lookup on S01 (the bridge route stays), Connect-an-app / Upload-files as a
choice, Xero (the bridge and reader stay), the provenance chip and sheet, S03's
"Add later" evidence rows, S04's insight and "Why this matters", S05's brief,
shop selection, draft preparation and the drafts sheets. `?view=drafts` (the
Order Drafts destination in the shell) now lists the orders created here.

**The visual system** (`onboarding.css`, rewritten): every value measured off the
image. 1rem = 10 image px, with the root font size scaling the image's 220px
column to the device (capped at 402px), so proportions hold at any width. Inter,
the image's typeface, from `vendor/` — nothing loads from the network.
Illustrations (confetti check, cloud read, clipboard, shop) and the Tally, Zoho
and Vyapar marks are drawn as SVG to the image, not sliced.

**How parity was checked:** every screen rendered in the iPhone 16 Pro Simulator
(iOS 26.5, Safari), screenshotted with `simctl`, scaled to the image's 220px
column and overlaid on the matching card (target red, render cyan) with a mean
luminance diff. Final pass, full flow from a new account: 1 11.7 (empty) · 2
8.8–17.9 · 3 19.0 · 4 10.6 · 5 25.2 · 6 22.9 · 7 9.9 · 8 10.3 · 10 13.5 · 11 15.6.
What remains, and why it is not closable here:
- **The image's content is example data.** 1,248 products, "Shree Kirana
  Store", ₹1,960.00 — the render shows the real read, so rows, names and
  counts differ by design.
- **The image's cards are not one size.** Top-row cards are 418px tall, bottom-row
  392px; Safari on the iPhone 16 Pro gives the page 714pt = 391 image px. So the
  bottom CTA on screens 3, 5 and 6 sits ~27px higher than drawn; screens 7–11
  overlay exactly.
- **Screen 9 is drawn 362px wide** (the others 220). On a phone its lines put the
  stepper and total under the product name; a real name would otherwise break one
  word per line. Not pixel-comparable; structure and components match.
- **Editable text is 16px**, not the image's 7.75 image px (≈14px): iOS zooms the
  page on focus below 16px.

**Found and fixed on the device while doing this:**
- `100dvh` made every short screen 22pt taller than what Safari shows → `100svh`.
- Returning from the sign-in to an unversioned `onboarding.html` loaded Safari's
  stale cached copy — the old UI. The shell's onboarding URLs in `modules.json`
  now carry `?v=`, and `index.html`'s token was bumped with them.
- The keyboard offset added 44pt for Safari's accessory bar that iOS 26.5
  already excludes, leaving a gap under every sheet → 0.
- After sign-up Safari kept the page panned from the keyboard, opening screen 2
  7px under the status bar → `go()` blurs and scrolls to top.
- Chromium formats "Sept" where Safari formats "Sep" → month names pinned.

**Dev-only hooks, localhost only:** `?fbmock=` (as before), `?obslow` (holds
screen 4's steps long enough to photograph), `?obreset` (start as a new user;
removes itself from the URL), `?obdebug` (prints the viewport the device gives).

**Verified.** Simulator: the whole Zoho path through the stand-in (sign-up →
consent round trip → import → found → check → staff sheet ×2 → ready → order
prefilled by the engine → created → welcome → dashboard). Browser, with the
**real** file reader (stand-ins off) and the test fixtures: validation errors,
hashed account, log in (wrong and right password), no-data path, files with an
ambiguous file asked about and an unreadable one reported, role change,
create-order search/add/stepper, back and forward keeping the order, refresh
mid-order restoring it, order stored; Zoho unreachable, denied, and a forged
return with the wrong nonce refused. No console errors. Desktop: the phone
column on a surface, standalone and inside the shell. Tests: dataset 22/22,
bridge 75/75.

**Not verified:** a real Zoho sign-in (needs the account owner; the redirect-URI
blocker in the entry above still applies to the deployed bridge), and real Tally
or Vyapar export files (no samples in the repo; the reader is the same one the
fixtures exercise). `flows/` and `ux/FLOW-MAP.md` describe the previous flow and
are now history, not the spec.

### 17 September 2026 — Sign Up: four fields, GST verify back

**Product owner:** screen 1 has only Full name, Phone number, Business name and
GST number with Verify. Name and phone are required; the rest optional.

- Email and password are gone. The local account is keyed by phone number, and
  *Log in* asks for the phone number on this device.
- **GST number** runs the real lookup again — the bridge's `/api/gstin`, the
  credential server-side. Verify sits where the image drew the password's eye;
  it enables at 15 characters. Only the control and the result repaint, so the
  keyboard stays up while typing. A verdict belongs to the exact number asked
  about. Found (legal name, trade name, status), not found, invalid format and
  couldn't-reach each have their own result; none of them blocks Create account.
- Verified on the iPhone 16 Pro Simulator against the local bridge: required
  errors on name and phone only; the standard sample number returned "No
  business registered under this GST number" from the live register.

### 17 September 2026 — Sign Up: the button waits for what's required; errors that help

**Product owner:** Create account stays disabled until the required details are
in; take care of errors and help so the screen feels smooth.

- **Order:** Full name → Phone number → Business name → GST number.
- **Create account** is grey until the name and the phone number are right. A
  tap on it is not a dead end: the missing fields turn red with a small shake,
  each says what to do, and the cursor lands in the first one.
- **Nothing is red while someone is still typing a field for the first time.**
  A field is judged when they leave it or try to continue; after that it
  re-judges on every keystroke, so a hint goes the moment the value is right. A
  quiet green tick shows on each required field once it is right.
- **Hints say what to do:** *Enter your full name* · *Use letters only* · *Enter
  your 10-digit mobile number* · *Mobile numbers start with 6, 7, 8 or 9* ·
  *Enter all 10 digits — 3 more to go* · *A GST number has 15 characters — 7 so
  far. Leave it blank if you don't have one.* · *This isn't a valid GST number.
  It looks like 27AAPFU0939F1ZV.* Business and GST fields show a grey
  "Optional" help line while focused and empty.
- **Typing is cleaned, never refused:** the phone keeps digits only behind a fixed
  +91, and a pasted +91, dash, space or leading 0 is dropped (caret kept). The
  GST number is uppercased to letters and digits.
- **GST:** Verify enables only on a correctly formed number. An optional GST
  number that is half-typed blocks Create account with its hint, rather than
  saving a wrong number. "Found" offers *Use as business name* when that field
  is empty.
- **Phone already used on this device:** the hint says so with *Log in instead*.
- Keyboard: Next moves field to field; Go on the GST number verifies it when it
  is ready, otherwise tries to continue.

Verified: every rule scripted in the browser; on the iPhone 16 Pro Simulator the
tap on the disabled button, the hints, ticks and the button turning green.

### 17 September 2026 — Where is your data: Zoho and Xero live; Tally and Vyapar coming soon

**Product owner:** keep Tally and Vyapar, disabled, as Coming soon; Zoho and Xero
are the active channels; remove Other and "I don't have any data".

- Screen 2 is now **Zoho · Xero · Files / Documents** (live), then **Tally ·
  Vyapar** as greyed rows with a *Coming soon* pill — not buttons, nothing
  happens on a tap.
- **Xero** is back as a channel, on the same screens as Zoho: *Connect your Xero
  account* → the real OAuth sign-in through the bridge (`/api/xero/…`) → import →
  counts. Its mark is `logos/xero.svg`. The sign-in, organisation choice, read
  and every failure sentence now name the app they are about.
- **Other** and **I don't have any data** are gone, with their paths (the
  no-data route to Data check, the Tally/Vyapar export pickers).
- Verified on the iPhone 16 Pro Simulator: the new list, and Xero through the
  stand-in from Connect to Data found (86 products · 40 customers). A real Xero
  sign-in still needs the Xero app's client id and secret in the bridge
  environment (see the Xero entry above).

### 17 September 2026 — Sample data: a fourth channel, so nobody leaves on screen 2

**Product owner:** someone who only came to look at FoodBridge should not have to
attach a real channel to get past *Where is your data?*. Add a sample-data
channel so an explorer is never blocked on that screen.

- Screen 2 is now **Zoho · Xero · Files / Documents · Sample data** (live), then
  Tally · Vyapar as *Coming soon*. The new row carries a flask mark, the title
  **Sample data** and the line *Explore with a demo business*.
- It **skips screen 3 entirely** — there is no account to connect — and goes
  straight to Importing, then Data found. Its first import step reads *Loading
  the sample data*, never "Connecting to…", because no connection is made.
- Its records are the demonstration tenant's export (`order-history.js` +
  `seed.inline.js`), **loaded only when the row is tapped**: ~200KB a real
  import never pays for, fetched from this origin and nowhere else.
- They arrive as their **own source**, `app: "sample"`, registered in
  `dataset.js` beside `zoho` and `xero`. This is not cosmetic: `fromApp()`
  falls back to `"zoho"` for an app it does not know, which would have stamped
  every sample record `kind: "zoho"` and prefixed it `z` — the flow would have
  been carrying demonstration records labelled as the user's own Zoho Books.
  They now carry `kind: "sample"`, prefix `s`, label *Sample data*.
- Screen 6 says what it looked in: *…in the sample data*, not "in your files".
- **There is no marker after screen 2** (product owner's call, this date). The
  choice is named on the row the user taps and nowhere after it: no chip on the
  later screens, and no way back out that clears what the sample produced. The
  earlier design (D-018, before the flip) put an amber *Sample business* chip on
  every screen and discarded the sample's work on leaving; that is deliberately
  not restored here.
- Failure is honest: if the sample records cannot be fetched, the import sheet
  says *We couldn't load the sample data. Check your connection and try again.*
  and drops back to screen 2 — not to the connect screen, which sample has none.

Verified end to end on the iPhone 16 Pro Simulator and at 402×714, **with the
dev stand-ins off** (no `?fbmock`), so this was the production path: screen 2 →
Importing → Data found (86 products · 40 customers, 165 orders in the 240-day
window) → Almost there → You're all set → Create order (the predictor filled a
29-item order for Guwahati Dairy from the sample catalogue) → Order created
`FB-ORD-0001` → Welcome. No console errors. The stored dataset was checked for
provenance: every record `kind: "sample"`, no `"kind":"zoho"` anywhere in it.
The load-failure branch was exercised by serving `order-history.js` as a 404.

### 17 September 2026 — Data found shows everything the channel gave, not two rows

**Product owner:** screen 5 listed Products and Customers and nothing else. List
every data point the channel actually returned — sales orders, purchase orders,
payments, invoices, suppliers — because the whole business pattern is what
FoodBridge has to understand.

The data was never missing. Every channel already read far more than screen 5
showed, and it all reached the Dataset:

| Channel | What it reads beyond customers and products |
| --- | --- |
| Zoho | orders, then **invoices · payments · credit notes · estimates · purchase orders · bills · expenses · vendors** (`MODULES.zoho`) |
| Xero | orders, then **payments · credit notes · estimates · purchase orders · bills · vendors** |
| Files | orders and **invoices**, when a file carries them |
| Sample | orders (the demonstration tenant has no invoice, payment or vendor records) |

`counts()` read four collections — products, customers, vendors, staff — and
`drawFound()` rendered those. **Sales orders were read, counted into the
Dataset, used by the reorder engine, and never once shown**: a Zoho import of
165 orders and 1,240 invoices reported "Products 86 · Customers 40".

- A new `FINDINGS` table maps each screen-5 row to its Dataset collection:
  Sales orders · Products · Customers · Suppliers · Invoices · Payments ·
  Credit notes · Quotes · Purchase orders · Bills · Expenses. `counts()` now
  counts all of them; screen 5 lists every one with a record and skips the rest,
  so each channel shows exactly what it returned and never a row of zero.
- The subtitle carries the total: *3,596 records across 11 types.*
- **`KINDS` is untouched and still drives screen 6.** Widening what is *shown*
  must not widen what the user is *made to supply*: screen 6 asks for the same
  four things as before (products, customers, suppliers, staff), with the same
  copy and the same *I'll do this later*. Showing 11 kinds and demanding 11
  would have blocked every explorer, which is the opposite of the sample channel.
- Layout: eleven rows behind the full-size hero left **three** above the fold, so
  the screen buried the list it exists for. Above four findings it goes dense —
  smaller check, tighter rows (`.is-dense`) — which brings six into view; the
  rest scroll. Four or fewer keeps the original hero, so the sample and a files
  import look exactly as they did.

Verified at 402×714 and on the iPhone 16 Pro Simulator. Sample: *291 records
across 3 types* — Sales orders 165 · Products 86 · Customers 40, full hero, no
scroll. A Zoho-shaped dataset (rehydrated through `sessionStorage`, since a live
Zoho sign-in is still blocked and the dev stand-in returns `modules: {}`) renders
all eleven rows dense and in order, with `en-IN` grouping — *3,596 records across
11 types*. Screen 6 after both still shows its four rows unchanged.

**Not done here:** the sample channel still shows three types, because the
demonstration tenant genuinely has no invoices, payments or vendors — inventing
them would put fabricated records behind a *Great! We found this data*. If the
sample should demonstrate the full depth, the demonstration export needs those
records first. Nothing AI-facing was built; this only makes sure the Dataset such
a feature would read is all visible at the point it is captured.

### 17 September 2026 — The sample business: every collection, derived from the tenant

**Product owner:** enrich the sample so it covers all the dataset types.

The previous entry left the sample at three types, because the demonstration
tenant's export genuinely stops at customers, products and order history. The
missing eight are now built from that export by
[`sample-business.js`](modules/foodbridge-onboarding/screens/sample-business.js),
loaded lazily beside it, and the sample reports **778 records across 11 types**:

| | | |
| --- | --- | --- |
| Sales orders | 165 | the tenant's own history, 240-day window |
| Products | 86 | the tenant's catalogue |
| Customers | 40 | the tenant's B2B list |
| Suppliers | 6 | one per product **category** the catalogue uses |
| Invoices | 165 | one per order, priced from its lines |
| Payments | 134 | one per settled invoice, on or after its date |
| Credit notes | 8 | returns against an invoice, for part of its value |
| Quotes | 38 | the orders quoted first, dated before them |
| Purchase orders | 48 | each supplier restocked once a month |
| Bills | 48 | one per purchase order |
| Expenses | 40 | five accounts a month across the window |

Three rules the generator holds, because these sit behind *Great! We found this
data*:

- **Derived, not imagined.** Every record traces to the export. Invoices are the
  orders; payments are the invoices; suppliers are the product categories —
  including both `SPICE` and `SPICES`, which is the real catalogue and is not
  tidied up. Checked: payment count equals paid-invoice count, every payment
  matches its invoice's total and is dated on or after it, every credit note is
  worth less than the invoice it credits and is dated after it, every quote
  predates its order, bills match purchase orders 1:1, every purchase order's
  vendor is a supplier, no invoice totals zero, and balance agrees with status.
- **Deterministic.** No `Math.random`, no clock inside a record: the same export
  gives byte-identical output on every run (checked), so a count that moves
  means the data moved. The import date only decides what has fallen overdue —
  moving it does not change a single count (checked).
- **Priced from the catalogue, and said so.** The tenant has no price field. 63
  of its 86 products carry an MRP inside the product *name*
  (`… (OLD MRP 700) NEW MRP 660`), which is parsed out; the other 23 take their
  category's median. That is the whole pricing model, and it is written at the
  top of the file so nobody later mistakes these for real catalogue prices.
  Nothing in the flow renders money today — the totals exist so the collections
  are coherent, not to be quoted.

They remain sample records end to end: app `sample`, prefix `s`, label *Sample
data*. Verified in the stored Dataset — all eleven collections present, every
record `kind: "sample"`, customer references resolved (`sc01`), and no
`"kind":"zoho"` anywhere.

One bug worth recording. The generator keys its choices off a hash of each
record's id so they stay stable. FNV-1a alone, over keys as alike as
`cninv0001`…`cninv0165`, avalanched so weakly that the output clustered in three
deciles and **never fell below 0.219** — so `< 0.05` matched nothing and credit
notes came out empty, while every other threshold was quietly skewed. A fmix32
tail fixed the distribution (mean 0.500, full range), and the counts above are
from after it.

Verified at 402×714 and on the iPhone 16 Pro Simulator, stand-ins off: screen 5
lists all eleven dense; screen 6 now ticks Suppliers and asks only for staff —
its copy singularises itself (*We couldn't find staff data in the sample data*);
screen 8 reads *3 things are ready*; Create order still predicts a 29-item order
for Guwahati Dairy and `FB-ORD-0001` is created. No console errors.

### 17 September 2026 — The header stays put

**Product owner:** keep the back-button row sticky on every screen; take the UX
call yourself.

`.ob-top` was `position: relative`, so it scrolled away with the content. The
footer had been sticky since the flip; the header never was. On the screens that
now scroll — screen 5 with eleven findings, screen 9 with a 29-item order — the
**back button left the viewport entirely**, and the only way back was to scroll
up first. On a phone that reads as a dead end. Worse, the rows then slid up
behind the status bar with nothing between them and the clock.

`.ob-top` is now `position: sticky; top: 0; z-index: 6` on an opaque
background. Three details that matter:

- **The safe-area inset stays inside the header's own height**
  (`3.4rem + env(safe-area-inset-top)`), so pinning at `top: 0` keeps the status
  bar covered rather than sliding content under the clock.
- **z-index 6** clears the sticky footer's 5 and sits far below the sheets' 40 —
  verified: opening the Customer sheet dims and covers the header as before.
- **A fade below it** (`.ob-top::after`, the mirror of the footer's gradient) so
  rows dissolve under the header instead of being sliced by a hard edge.

**The call: this applies to `.ob-top`, not to `.ob-wordmark`.** Screens 1 and 11
head with the wordmark, which carries no back button and nothing else to reach —
it is branding, not navigation. Pinning it would cost about two rem at the top of
the sign-up form, the one screen where the keyboard already takes half the
viewport, and buy the user nothing. Sticky is for what you need to reach, not for
what you need to see once.

Verified on the iPhone 16 Pro Simulator: screens 5, 6 and 9 hold the header while
their content scrolls under it, the titled *Create Order* bar included; the
Customer sheet still covers it; the keyboard on screen 9's search does not
dislodge it; screens 1 and 11 are unchanged.

**Left alone, and worth a decision:** the sticky footer overlaps the last of the
content — screen 6's callout is cut mid-sentence by *Add staff*, and screen 9's
*Total (29 items)* by *Create order*. That is `bottom: 0` stickiness lifting the
footer off its place in the flow and over what precedes it. It predates this
change (and the findings work), so it was not fixed here; the fix is bottom
padding on `.ob-main` sized to the footer, on the screens that pin one.

### 17 September 2026 — Data check: two tiers, and a way out of every gap

**Product owner:** list all the types here, sort them into must have and can add
later, and wherever something is missing let the user upload a file or use sample
data, so nobody is blocked and anyone can explore.

Screen 6 listed the same four rows it had always listed — products, customers,
suppliers, staff — while the channel was returning up to eleven collections. It
called every gap **Missing** in red, and its only actions were *Add staff*,
a file for products or customers, and *I'll do this later*.

**The tiers are not a matter of taste.** `toEngine()` builds the reorder engine
from **products, customers and orders** and reads nothing else; without those
three the product cannot predict an order or create one. Suppliers and staff were
in the blocking list and **nothing consumes either** — they are operational
detail. So:

| Must have | Can add later |
| --- | --- |
| Sales orders · Products · Customers | Suppliers · Invoices · Payments · Credit notes · Quotes · Purchase orders · Bills · Expenses · Staff |

- **Missing is no longer one thing.** A must-have is red and says *Missing*.
  Anything else is grey and says *Not added* — calling nine optional collections
  "Missing" in red reads as nine failures, which is the fastest way to lose
  someone who only came to look.
- **Every gap carries its own way forward, on the row.** *Use sample* for any
  collection; *Upload file* only where a file genuinely merges — products and
  customers always, orders and invoices when the import was files and its `parts`
  can be rebuilt through `fromFiles`. It is not offered for payments, bills,
  expenses, quotes, credit notes or suppliers, because `FILE_TYPES` has no reader
  for them and a button that cannot work is worse than no button. Staff keeps its
  own action, to screen 7.
- **Continue is never disabled**, and *I'll do this later* is gone with it — the
  per-row actions are the way to fill a gap, and the footer's one job is to let
  anyone reach the end of the flow whatever they could bring.
- The heading answers the state: *Almost there!* with *We couldn't find
  everything in your Zoho* when a must-have is short, *Here's what we have* with
  *Everything we need is here. The rest can come later.* when it is not.

**Filling one collection from the sample is not a copy.** A collection does not
stand alone: sample invoices name sample customers and sample orders name sample
products, so dropping orders alone into a real Zoho dataset would leave the
reorder engine reading order lines whose products do not exist. `fillFromSample()`
therefore copies what the records reference as well — and **only what is actually
missing**. Verified against a dataset sharing nothing with the sample (one real
product, one real customer): filling Sales orders brought 165 orders, took
products 1 → 32 and customers 1 → 39 (the 31 and 38 those orders actually name,
not the whole 86-product catalogue), kept both real records, and left **zero
dangling product or customer references**. Per-record provenance is kept, so the
dataset carries `kind: "zoho"` and `kind: "sample"` side by side exactly as a
file added on this screen carries `kind: "file"`.

**The product owner's call, this date: the screen does not label a sample-filled
row.** It shows the count like any other. The risk was put to them — a real
account's supplier list can become six demonstration companies with nothing on
any screen saying so, including this one when they come back — and they chose no
label, consistent with the no-marker decision taken with the channel itself.
The provenance is still in the data; only the UI is silent.

Also fixed here, both introduced by the longer screen: the red `!` badge beside
the already-red alert icon was redundant and fell off the line once a row wrapped
to carry its actions, so missing rows now show their status text alone; and
`.ob-main.is-check` gained bottom padding, because the sticky footer lifts over
the end of the flow and the last row on this screen carries an action.

Verified at 402×714 and on the iPhone 16 Pro Simulator: sample lands on *Here's
what we have* with all three must-haves ticked and Staff the only *Not added*;
a stripped Zoho dataset shows *Missing* on Sales orders with *Use sample*, greys
the four it did not return, and fills each on tap; the last row clears the
footer; and the flow runs to `FB-ORD-0001` on the mixed dataset. No console
errors.

### 17 September 2026 — Data check redesigned; the Staff screen is gone

**Product owner:** the screen looks childish — re-imagine it and redesign. Remove
the Add staff flow and make staff unified like the others.

**What was childish, precisely.** Twelve separate rounded cards, each with its
own border and shadow, each carrying a large green tick and a large green icon,
several with a chunky outlined button wedged inside them at a ragged height. Every
row shouted at the same volume, and green — the colour that should mean *this is
fine* — was on all of it. It read as a reward chart, not as a summary of a
business's books.

**The redesign is a manifest.** One card per group with hairline rules between
rows, uniform 2.85rem rows, small muted icons, counts right-aligned on tabular
figures so the column reads straight down, and section labels in small caps with
their qualifier on the right (`MUST HAVE — Needed to order`). The green ticks are
gone: a row with a number is self-evidently fine, and a tick beside a count said
the same thing twice. **Colour is now spent in exactly one place** — a must-have
the product cannot run without, in red.

- The heading is *Data check*, not *Almost there!*, and the line under it states
  the case: *Sales orders are missing from your Zoho. FoodBridge needs them to
  predict and create orders*, or *779 records from the sample data. Everything
  essential is here.*
- **The fixes moved off the row and into a sheet.** Inline buttons forced rows to
  different heights and broke the column of numbers. Tapping any gap now opens
  one *Add …* sheet that says where we looked and offers what can honestly be
  done for that collection — a file only where `dataset.js` can read one and it
  merges, the sample business otherwise.
- **Screen 5 was rebuilt in the same language.** It lists the same collections
  with the same counts; leaving it as twelve chunky cards would have shipped two
  visual languages for one thing. Its row-level `is-dense` hack is gone with it —
  manifest rows are already dense — while the shrinking hero stays, since eleven
  rows still need the room.

**The Staff screen (7) is removed.** It was a whole screen for a list that starts
with one row already filled in — the account owner — and it was the only thing on
the check screen that could not be handled where it was named. Staff is now a row
in *Can add later* like any other, and because it always has at least the owner
in it, the row keeps its chevron rather than going quiet at a count: tapping it
opens the old screen's body as a sheet, where people are added, edited and given
roles. `state.staffDone` went with the screen — it only ever meant *that screen
was visited* — and staff is now present when there is a person, which there
always is.

**This is a deliberate departure from the product owner's board**, which has
Staff as its seventh screen; the flow is ten screens now. The 17 September rule
was that the image is the UI, and this overrides it on the owner's own
instruction. `README.md` says so where it describes the flow.

Verified at 402×714 and on the iPhone 16 Pro Simulator: the sample lands on *Data
check* with all three must-haves counted and staff at 1; a stripped Zoho dataset
shows *Missing* in red on Sales orders and greys the four it did not return;
tapping one opens *Add sales orders* offering only *Use sample data* (no file,
because a Zoho import has no `parts` to rebuild) and filling it flips the heading
to *Everything essential is here*; the Staff row opens the list, *Add another
staff* adds Priya Das and the row goes to 2; and the flow runs on to
`FB-ORD-0001`. Screen 5's hero measured 150×86 dense against 274×164 full, with
six rows above the fold. No console errors.

Also fixed: *sales orders is missing* — the label is a plural noun whatever the
count, so the sentence now reads *Sales orders are missing*, with only its first
letter raised.

### 17 September 2026 — Fix: the check screen blanked on reload

**Symptom:** a white page in the Simulator. The server was fine (200s), the
browser rendered fine; only that tab was dead, and `?obreset=1` brought it back.
That combination means stored state, not the build.

**Cause, and it was mine.** The last edit of the redesign rewrote `drawFound()`
by replacing everything from `function drawFound() {` up to the comment above
`checkRow` — and `const MUST` and `canUpload()` lived in that gap. The uses
survived, the definitions did not, so `drawCheck()` threw
`ReferenceError: MUST is not defined`, `render()` never ran and `#ob-root`
stayed empty. **White, not an error**, because nothing catches a throw at mount.

**Why the tests missed it.** After that edit I verified screen 5, which is what
the edit was about, and never re-opened screen 6. Navigating to screen 6 would
have caught it on the first tap. The lesson is the obvious one: an edit made by
replacing a *range* can delete what sits between the two ends, so what to re-test
is the range, not the intent.

Fixed by restoring both definitions. Then, because one bad stored screen should
not be able to white out the app, **every screen was replayed from a restored
session** — each `screen` value mounted in an iframe and checked for a throw and
for empty output. All eleven render; an unknown value falls back to sign-up.

One thing that test surfaced: a session stored before the Staff screen was
removed still points at `"staff"`, which fell through `draw()`'s switch to
`drawSignup()` — showing the sign-up form to someone who already has an account.
`restore()` now maps that stored screen to `check`, where staff lives.

Verified on the iPhone 16 Pro Simulator: run to Data check, reload in place, and
it restores to *Data check · 779 records from the sample data*, which is the
exact reload that blanked.

### 17 September 2026 — Staff is removed entirely

**Product owner:** remove the add-staff feature completely.

The previous entry took away screen 7 but kept staff as a row on *Data check*,
opening the person editor in a sheet. The feature is now gone: no row, no sheets,
no roles, no `state.staff`.

Which is the right shape for that screen anyway. *Data check* is a manifest of
**what a channel handed over**, and staff was the one entry in it that no channel
ever returns — it was a list this device kept, sitting in a column of imported
record counts and always reading `1` because the account owner seeded it.

Removed: the `Staff` row and its entry in `ALL_KINDS` (now simply `FINDINGS`),
the staff key in `counts()`, the `checkRow` special case that kept the row
tappable after it had a count, the staff branch of `openAddSheet()`,
`openStaffListSheet()`, `openStaffSheet()`, `initials()`, `ROLES`, the staff
icon, `state.staff` with its save and restore, and the CSS that only those sheets
used (`.ob-people`, `.ob-person*`, `.ob-avatar`, `.ob-select`, `.ob-choices.is-roles`,
`.ob-link.is-add`, `.s07-sub`). Nothing outside `onboarding.js` read any of it —
checked before cutting.

`restore()` still maps a stored `"staff"` screen to `check`, because sessions
saved before any of this still point at it.

Verified on the iPhone 16 Pro Simulator: *Can add later* ends at Expenses with no
Staff row, *You're all set!* reads **11 things are ready** (the eleven
collections, staff no longer among them), and the flow runs to `FB-ORD-0001`.
Every screen was replayed from a restored session again — all render, none
throws, an unknown screen falls back to sign-up.

**On the deletion method.** The regression in the previous entry came from an
edit that replaced a *range* and silently took out what sat between its ends.
This one cut by content markers with assertions on both edges and on what the
excised block did and did not contain; the first attempt used line numbers,
tripped its own guard on drifted lines, and deleted nothing.

### 17 September 2026 — Upload a file for any gap, through the reader that already exists

**Product owner:** each gap should offer *use sample data* **or** *upload files
and extract from there*, looping back through the file pipeline and returning to
Data check with the data updated. Reuse the existing flow; wire it precisely.

Before this, *Add expenses* offered only the sample, because `canUpload()` said
no: `dataset.js` could read a file as **orders, customers, products, invoices**
(`FILE_TYPES`) or **invoices, payments, costs** (`EVIDENCE_TYPES`), and nothing
else. The rest of the manifest had no reader at all.

**Extended, not replaced.** The pipeline is the one that was already there —
`readFile()` → `locate()` → `extract()` → merge → `toEngine()` → `draw()`:

- `LEDGER_TYPES` adds **credit notes, quotes, purchase orders, bills, expenses
  and suppliers**, with their own `SPECS` and the column names they arrive
  under (`Supplier Name`, `Bill Number`, `PO Number`, `Expense Head`, …).
- They are deliberately **kept out of `FILE_TYPES`**. `classify()` guesses an
  unlabelled file's kind by walking that list, and a bills sheet and a
  purchase-order sheet are the same four columns — guessing between them would
  be wrong more often than right. These are read only when the kind is named,
  which on this screen it always is: the row asked for it.
- One `DOCS` table drives a single `extract()` branch for all of them, rather
  than six near-identical ones. Each is a date, the party it is with, and a
  total, plus whatever else the sheet carries.
- **The party is linked, not invented twice.** A bill naming *Spice Traders*
  finds that supplier if it is already there; a supplier nobody has becomes one,
  marked `derived`, from that file. Verified: uploading two bills into a dataset
  with no suppliers produced 2 bills and the 2 suppliers they name, with zero
  dangling vendor references.
- **Core kinds now merge through `fromFiles()` too.** A products or orders file
  added onto a Zoho dataset used to go through a name-only merge that could not
  shape an order at all. It now reads that one file with `fromFiles()` — the same
  function screen 2 uses, so the customer and product linking is identical — and
  merges the result, re-prefixing the ids first because `fromFiles()` numbers
  from `cu1`/`pr1` every time and a second file would have collided.
- Failure copy names the columns that kind actually needs, per kind, instead of
  telling someone adding expenses to supply a *Customer Name*.

Verified at 402×714 and on the iPhone 16 Pro Simulator, driving real CSVs through
the screen's own file input: *Add expenses* offers **Upload a file** and **Use
sample data**; a five-row expenses CSV yields 3 records and skips the two bad
rows (`unreadable_date`, `missing_value`); the sheet closes, the screen is Data
check again and Expenses reads 3. Bills then took Suppliers 0 → 2 and Bills → 2.
Every record carries `from: { kind: "file", fileId, row }`. Every screen was
replayed from a restored session again — all render, none throws.

### 17 September 2026 — An added file gets the import screen, not a spinner

**Product owner:** after the upload there should be a processing screen, then the
outcome on Data check.

The upload read the file behind a small locked sheet with a spinner — the same
weight of feedback as a dropdown opening, for work that parses a spreadsheet,
matches its parties and rewrites the reorder engine's input. It also said nothing
about what it was doing.

It now runs on **screen 4, the import screen a channel already uses** — not a
second one built for the occasion. `beginImport(add)` carries what is being
added, and the screen speaks about that file rather than a channel:

| | Channel import | One added file |
| --- | --- | --- |
| Heading | *Importing your data…* | *Reading your file…* |
| Under it | This may take a few minutes. | This stays on your phone. |
| Steps | Connecting to Zoho · Fetching · Processing · Organizing · Finalizing | Opening august-expenses.csv · Reading the rows · Matching to your data · Adding your expenses · Finishing up |
| Hero | the channel's mark | the files mark |
| Ends at | Data found | **back on Data check** |

- The progress bar reads `chrome("check")` during an added file's import, so it
  **stays on the check step** instead of walking back to step 2.
- Back during it returns to Data check, not to *Where is your data?* —
  `stopImport()` knows which kind of import it stopped.
- A file that cannot be read fails on the same screen and lands back on Data
  check with *We couldn't read nonsense.csv · Its first row needs column names,
  such as Supplier Name* — per kind — and a single **Close**. The channel
  import's *Choose another way* is not offered, because from here the way is the
  row you came from.

Verified at 402×714 with `?obslow`, driving real CSVs through the screen's own
input: the processing screen shows the file's own five steps with the two done
and the third spinning, then lands on Data check with Expenses at 3 and the total
moved from 738 to 741. The bad-file path returns to Data check behind its sheet.
Every screen replayed from a restored session — all render, none throws — and the
flow was re-run to Data check on the iPhone 16 Pro Simulator.

### 17 September 2026 — Add-a-gap takes a set of files, not one

**Product owner:** the upload should let you select and upload multiple files.

Screen 2's *Files / Documents* row has always taken a set — `multiple` on the
input, and `startFileImport()` loops them. The check screen's upload did not: one
input without `multiple`, and a handler that read `this.files[0]` and ignored the
rest silently. Picking four files added one.

`addFileAs(file, kind)` is now `addFilesAs(files, kind)` and keeps screen 2's
bargain: **read one at a time, keep what reads, say what did not.** A spreadsheet
nobody can parse should not throw away the three beside it that were fine.

- Every file is read as the kind whose row asked for it; each becomes its own
  part, carrying its own name, so a record's `from.fileId` still points at the
  file it came from.
- If **none** read, it fails as before, naming the file or saying *these 3 files*.
- If **some** read, the rest are merged and the ones that did not are named on
  the screen that shows what did: *We couldn't read notes.csv — It had no
  expenses we could find. Everything else was read and is counted here.*
- The processing screen counts them: *Reading your files…* over *Opening 2
  files*, singular when there is one.
- Merging is per part, so a name appearing in two files lands once — the ledger
  merge dedupes on the collection, not within a file.

Verified at 402×714 and on the iPhone 16 Pro Simulator, driving real sets through
the screen's own input: three expenses files (two good, one nonsense) gave **5
expenses across 2 file ids**, both months present, every record `kind: "file"`,
and the third named in a sheet on Data check. Two supplier files sharing
*Coastal Foods* gave **3 suppliers, not 4**. The multi-file processing screen
reads *Reading your files… · Opening 2 files · Adding your suppliers*.

### 17 September 2026 — Screen 8 asks, rather than assuming

**Product owner:** ask whether they want to create their first order or look at
their business control tower, where they see what FoodBridge found in their data.
For now that button goes to the dashboard; the control tower comes later and the
navigation changes then.

Screen 8 had one way on — *Create first order* — and an informational card
saying how many things were ready. Someone who has just watched FoodBridge read
their whole business may well want to see what it found before they order
anything, and the screen never offered it.

- The card's count moved into the subtitle: **11 things are ready. What would you
  like to do first?** — the question the screen now actually asks.
- Two choices, weighted the same, each with a line saying what it is:
  **Create your first order** (*We've drafted one from your order history* — the
  predictor has, so the line is true) and **Open your control tower** (*See what
  FoodBridge found in your business*).
- The footer CTA is gone with the single path. The choices are the actions.

**The control tower does not exist yet, so that choice hands off to the
dashboard** — `handoff("dashboard")`, the same route screen 11 uses. When the
page is built, the one line at the end of `drawReady()` changes and nothing else.

**Worth knowing before that page is built:** the dashboard it lands on is the
existing module with its own seeded figures — *QA store*, ₹187,070.70 all-time —
not the dataset this onboarding just imported. So the placeholder does not yet
show the user their own findings, which is the whole promise of the row. The
control tower will need the Dataset wired into it, not just a page.

Verified at 402×714 and on the iPhone 16 Pro Simulator: both rows render with
their chevrons; *Create your first order* goes to screen 9 with the drafted
order for Guwahati Dairy; *Open your control tower* lands on
`index.html#/dashboard`, titled *Dashboard — FoodBridge*, and it renders. Every
screen replayed from a restored session — all render, none throws.

### 17 September 2026 — Screen 8's two ways on look like buttons

**Product owner:** the two choices are not visually clear as things to click.

They were right, and the cause was mine: I dressed the fork in the data
manifest's clothes — white card, hairline border, small grey chevron. On screens
5 and 6 those clothes mean *this is a record and a count*. Wearing them here made
two actions read as two more rows of information. The chevron was the only hint
and it was 13px of grey.

They are buttons now, and the affordance is not in doubt:

- **Create your first order** — the filled green CTA every other screen's primary
  action uses.
- **Open your control tower** — `.ob-cta.is-alt`, white with a green border and
  green text. Deliberately *not* the existing `is-ghost`, whose grey reads as a
  way out (Close, Cancel); this is a second way **on** and carries the colour to
  say so.
- What each one does moved **underneath** the button rather than inside it, so
  the thing you press is a plain, unmistakable button and the explanation is
  still there: *We've drafted one from your order history* · *See what FoodBridge
  found in your business*.

The hierarchy is deliberate. Two filled buttons of the same colour shout equally
and decide nothing; two outlined ones offer no primary. Filled plus green-
outlined reads as a real choice with a recommended first step, which is what this
screen is.

Verified at 402×714 and on the iPhone 16 Pro Simulator: both render as buttons,
*Create your first order* reaches screen 9 with the drafted order, *Open your
control tower* lands on `index.html#/dashboard`.

### 17 September 2026 — Create Order is Stock Audit's Create Order

**Product owner:** the Create Order flow here should be exactly the one from
Customer Management → Stock Audit. Refer to it and clone it. Two calls taken the
same day, both asked and answered: **create the sales order but do not sync it to
Zoho** — staged, updated and confirmed exactly as Stock Audit does, created in
FoodBridge in the background, then on to this cut's *Order created* screen; and
**drop the audit-only parts**.

Screen 9 was onboarding's own: a customer card, an Add Items list, a total, one
*Create order* button. It is now that screen's, structure and behaviour:

| | |
| --- | --- |
| Working | *Preparing order…* under an indeterminate bar, while the engine runs |
| Head | the customer, `N products · M units`, and a bar that fills as lines get quantities |
| Body | product search opening the same dropdown, **Recommended** over the engine's lines, `qc-card` rows with the `pd-stepper` |
| Remove | asks **in the row** — the stepper gives way to *Remove?* with ✓ / ✗ |
| Foot | `+ Add Product` beside `Confirm Order`, which becomes *Confirm order? N products · M units* ✓ / ✗ — the same two-tap commit, in place |
| Then | *Creating order…*, and screen 10 |

- A product added by hand **starts at zero** and is the user's to set, as it does
  there; the engine's own lines arrive at their recommended quantity.
- Quantities are set **in place**, never through a re-render — the caret is not
  lost mid-type. Only the head and the footer are refreshed.
- Changing the customer **starts that customer's order**, so a new customer gets
  their own recommendation rather than the last one's lines.
- Leaving abandons the draft, as `exitOrderSheet()` does.

**What is not cloned, and why.**

- **No `FB_ZOHO.createSalesOrder()`.** Confirm creates the order in FoodBridge
  and hands to screen 10. This flow can be driven by the sample channel, and a
  real sales order in the live PMF org for a demonstration customer is not
  something onboarding may raise. The two-tap confirm, the disabled *Creating
  order…* state and the record are all still there; only the bridge call is not.
- **No stock audit.** That screen is built on a completed shelf count — it feeds
  the recommendation and the per-line stock. Onboarding never has one, so
  `generatePredictiveOrder` is called with `latestCompletedAudit: null` and falls
  back to order history, and the basis reads *From N orders* instead of the `i`
  chip that would have explained a count that was never taken. No stock column is
  drawn rather than drawn empty.
- **No order-pick screen.** The customer is already chosen by the time this cut
  reaches screen 9; the head's name opens the picker.

**The CSS is a copy, and copies drift.** The screen's own 142 rules are lifted
from `stock-audit.css` into
[`order-stockaudit.css`](modules/foodbridge-onboarding/screens/order-stockaudit.css),
scoped under `.ob-so` — that sheet names things `.info`, `.sub`, `.meta`,
`.primary`, `.no`, `.yes`, generic enough to land on half this page if let loose,
so its palette is redefined inside the scope too. `stock-audit.css` is mirrored
across four cuts and **a change there will not reach here**; that is written at
the top of the file.

One bug caught in the extraction and worth recording: the first pass rebuilt the
rules line by line, which silently dropped every selector part before the last on
any multi-line selector — `.qc-row .ask, .qc-row .ci-btn { display: none }` came
across as the `.ci-btn` half alone, so *Remove?* showed on every row. Selectors
are collapsed before scoping now.

Verified at 402×714 and on the iPhone 16 Pro Simulator: the build screen renders
with 9 recommended lines · 37 units; search for "chilli" opens the dropdown with
14 matches; adding one puts it on top at quantity 0; the trash turns the row
amber, hides the stepper and asks *Remove?*, and ✓ takes the list from 10 to 9;
*Confirm Order* becomes *Confirm order? 9 products · 37 units*, and ✓ creates
`FB-ORD-0001` for Guwahati Dairy, 37 items, on screen 10. No bridge call is made.

### 17 September 2026 — The flow ends at Order created

**Product owner:** make *Go to dashboard* the control tower, with the navigation.
Delete the *Welcome to FoodBridge* screen.

- Screen 10's action is now **Open your control tower** — the same label and the
  same `handoff("dashboard")` screen 8 uses, so the one destination has one name.
  It used to read *Go to dashboard* and go to screen 11, which then offered *Go
  to FoodBridge* and did the handoff: two taps and two names for one exit.
- **Screen 11 is gone.** `drawWelcome()`, its route, its two icons (`track`,
  `grow`) and its styles (`.ob-feats3`, `.ob-f3*`) are removed. `HERO_STORE`
  stays — the Order Drafts screen uses it for its empty state.
- `restore()` maps a stored `"welcome"` to `created`, as it does `"staff"` to
  `check`, so a session parked on the removed screen lands where the flow now
  ends rather than falling through to the sign-up form.

**The flow is nine screens**, against the board's eleven. Both departures are the
product owner's, on the record here and in `README.md`.

Verified at 402×714 and on the iPhone 16 Pro Simulator: the order confirms to
*Order created · FB-ORD-0002 · Guwahati Dairy · 37 items* and its button lands on
`index.html#/dashboard`. Every screen replayed from a restored session — all
render, none throws, and `"welcome"` resolves to Order created (which redirects
to the order screen when there is no order yet, as it always has).

### 18 September 2026 — Continue as guest, and the foot of screen 1

**Product owner:** nobody should have to hand over a name and a number before
they can see what FoodBridge does — a small option, not a redesign.

**Screen 1** carries one line under *Create account*: **or Continue as guest**,
and the **Log in** sheet carries the same line under its button.

**A guest is a session, not an account.** An account object with `guest: true`,
no name and no number, held in `sessionStorage` under `fb.v7.guest` — its own
key, so looking around on a shared phone never overwrites the account already
in `fb.v7.account`. `restore()` prefers a live guest session, so a tab that is
exploring stays exploring and the account comes back the moment somebody logs
in (which deletes the guest session first). Every screen after sign-up treats a
guest as an account, because to them it is one. `createAccount()` now clears the
imported data only for someone who was *not* already a guest: a guest who signs
up keeps what they set up.

**Where each way in lands.** From sign-up, a guest is a new person, so they
start the flow at S02. From the Log in sheet both buttons go to the app —
*Log in* saves the restored flow state and then `handoff("dashboard")`, so
reopening onboarding still resumes where that account left off, and *Continue as
guest* goes straight there.

**The foot of screen 1 was four centred lines at one weight**, with the Terms
sentence sitting between two actions. It now reads loudest to quietest: the
button with the guest line tucked under it (one choice), the returning user's
*Log in* line apart and a step quieter, then the legal line last — smallest,
muted, under a hairline, taking the leftover height so it rests on the bottom of
the screen instead of ending in mid air. On a screen too short for that the
`auto` margin collapses and the login line's own margin holds the gap (checked
at 375×560).

Verified at 375×812 on the running v7: both guest links start a session and land
where they should, logging in with the stored number reaches the dashboard, a
wrong number still errors inside the sheet, and starting a guest left
`fb.v7.account` untouched. No console errors.

### 18 September 2026 — Distribution & Logistics comes from `v5`, codebase and all

**Product owner:** `v5`'s Distribution & Logistics is mature and finished. Drop
what `v7` has and bring `v5`'s over — the whole codebase, wired, not just the
links.

**What `v7` had.** Its Delivery Management pointed at the old crawl,
`foodbridge-module-distribution-logistics/discovery/paths/delivery-management/
screens/delivery/index.html` — the screen `v5` itself marks **(retired)**.
Route Planning, Logistic Returns and Live Delivery Tracking were already `v5`'s
bytes apart from their `?v=` cache tags.

**What came over.** Both module folders, copied whole and verified byte-identical
to `v5` before re-stamping:

| | |
| --- | --- |
| `modules/foodbridge-route-delivery/` | **new to `v7`** — 22 files, 816 KB. The real `/route-delivery` app from `storefront-frontend`, ported to run with no network: 23 screens, its own models, services, validation and an in-memory seed |
| `modules/foodbridge-module-distribution-logistics/` | replaced with `v5`'s 33 files — Route Planning, Logistic Returns, Live Delivery Tracking, and the retired delivery path `v5` still ships |

**Wired, not just re-pointed.** `assets/modules.json` moves the
`delivery-management` destination to
`modules/foodbridge-route-delivery/screens/delivery/index.html`, with `owner`
following the file to `nishant-devekar/foodbridge-mock-platform` — the port is
authored here, not crawled from the module team. `clipLeft: 0` and
`fullBleed: true` stay: this app draws its own chrome, where the other three
render their own sidebar for the shell to clip at 250.

Every `?v=` tag in both folders is re-stamped `20260918D1`, the `v7` convention,
so a browser holding the old copy fetches these.

`v7/modules/` now holds **14 folders**, against 13 in both `v5` and `v6` — this
cut carries `foodbridge-onboarding` as well.

Verified on the running cut at 375×812, all four destinations by route and from
the sidebar: Route Planning, Logistic Returns and Live Delivery Tracking each
load under their own titles, and **Delivery Management is the ported app** —
*Rahul Verma · 5 All Deliveries · ₹1,03,800 target*, and *Continue →* on
Borivali North opens the stop list with *₹7,920 collected this route*, Ravi
General Store *Collected*, Meena Kirana *Partial payment*. No console errors.
Every URL in `modules.json` resolves on disk.

### 18 September 2026 — the end of the demo is a journey, not a dead end

**Product owner**, with a drawing: every EXIT DEMO should open the same three
ways on — *Give feedback*, *Become a part of FoodBridge*, *Back to WhatsApp
menu* — feedback saved against a name and a number and readable later, and the
WhatsApp IVR at **+91 99880 87779** as the place a demo returns to.

**What was refined before it was built**

- **The sheet is dismissible.** A scrim tap, the ✕ or Escape puts someone back
  on the screen they were reading. The way out must not become a trap.
- **One tap is the whole form.** A rating is the only required answer — five
  faces, Bad to Great — because a rating everyone gives beats a paragraph
  nobody writes. Comment, name and number are optional, and name and number are
  **prefilled** from `fb.v7.account` when this browser has been through
  onboarding, so a returning user taps Send and is done.
- **Sending never blocks leaving.** The hand-off to WhatsApp happens whether or
  not the POST has come back. Waiting on our server is our problem, not theirs.
- **A wrong-looking number is said, not swallowed** — 10 digits or blank.

**Nothing is lost, ever.** The entry is written to a queue in `localStorage`
*before* the request leaves, and removed only on a 2xx. A dead network, a
closed tab, a bridge that is down or has no store configured — all of them
delay feedback rather than dropping it; the queue is flushed on the next load
of any screen carrying the footer. Proven by test: with the bridge stopped, a
submitted entry sat in the queue, and came back up it arrived on the next page
load without anyone touching it. A 4xx is the one thing dropped, because it can
never succeed on a retry.

**Where it goes.** `POST /api/feedback` on the bridge, which stores to Upstash
Redis over REST when `FB_FEEDBACK_KV_URL` and `FB_FEEDBACK_KV_TOKEN` are set,
and to `zoho-function/feedback.jsonl` on a writable filesystem otherwise —
which is what makes `npm run dev` a complete loop. Unconfigured answers
`503 not_configured` rather than pretending. `/api/health` reports the live
store. **`/v7/feedback.html` is the operator's view**: newest first, with the
face, the name, the number, the screen they were on and what they wrote.

**One asset, not five copies.** `v7/assets/exit-demo.js` draws the footer bar
AND the sheet, and every screen that wants them is now two lines:
`FB_EXIT.mount({ z, tabs })`. The four screens that had an inline footer
(Finished Goods Inventory, Raw Material Inventory, Customer Receivables,
Supplier Payables) lost ~90 duplicated lines each. Delivery Management mounts
no bar — it has its own — and its EXIT DEMO tab calls `FB_EXIT.open()`, so the
sheet is identical everywhere while the bar stays each screen's own business.
Raw Material Inventory passes its **Receive Stock** control through as an extra
tab.

**Become a part of FoodBridge** lands on the sign-up screen, not on whatever
account the browser was left holding: the sheet routes to
`#/onboarding?signup=1`, and onboarding's `takeSignupFlag()` reads that flag off
the platform hash, clears the account, orders and session keys, and starts at
S01. The flag is wiped as it is read, so a reload is not a second reset.

Verified on the running cut at 375×812: the sheet on Raw Material Inventory and
on Delivery Management; the form prefilled from this browser's account; a real
submission landing in `feedback.jsonl` with rating, name, number, screen and
comment; the offline queue described above; *Become a part of FoodBridge*
arriving at **Create your account** with `fb.v7.account` cleared; and the
operator's page listing all three entries. 6 new tests pass; the one failing
test in the suite (`extract.test.js`) is pre-existing and wants
`npm install @anthropic-ai/sdk`.

**Not yet true, and worth saying:** the deployed bridge is an older build. It
has no `/api/feedback` route at all — the live page gets a 404 — and no store
configured behind it. Live entries therefore queue in each visitor's browser
until somebody adds `FB_FEEDBACK_KV_URL` and `FB_FEEDBACK_KV_TOKEN` to
`zoho-function/.env` and runs `deploy.sh`; pushing this repo publishes the
PAGES, never the function.

That 404 found a flaw worth recording. The retry rule had been "drop any 4xx,
it can never succeed" — which is true of a malformed payload and false of a
route that is not deployed yet, so the very case this queue exists for would
have thrown feedback away. It now drops **only 400 and 422**, the two answers
that judge the entry itself; everything else is about the deployment and stays
queued.

### 19 September 2026 — the unified flow: two doors, and a way out of everywhere

**Product owner:** the WhatsApp IVR asks one thing — new, or existing — and
everything after it happens in v7. A new arrival is offered setup on their
number; whoever declines gets to look around properly rather than being sent
back into the import flow. Every screen exits the same way, and the exit ends
in the chat.

**What the walk-through found first.** Run on the live cut at 375×812 as a new
user, before anything was written:

| | |
| --- | --- |
| **Explore landed in setup** | *Continue as guest* opened *“Where is your business data today?”* — the exact question the user had just declined — then ~7 taps of import ceremony before any feature. Explore and set-up were the same flow; only the account object separated them |
| **Most of the platform had no way out** | `EXIT DEMO` sat on 5 of 26 destinations. Onboarding had none. The dashboard had none — finish onboarding and you were stranded |
| **Identity broke at the handover** | Onboarding collects a name and business; the shell showed a hardcoded *Mahesh · QA store*. You typed your name and landed in someone else’s shop |
| **The control tower was promised and missing** | `drawCreated()`’s button already read *Open your control tower*, with a comment conceding it handed off to the dashboard |

**The new screens.**

`screens/explore.html` — six doors into screens that already exist, each saying
what you will see before you spend a tap on it. **This is the one that makes the
agreed flow true**: declining setup now costs three taps to a real feature
instead of seven taps of setup. *Set up my business* sits at the foot of it at
footer weight, always there and never shouting; the persuasive moment belongs at
the end of a feature, not on a menu row.

`screens/control-tower.html` — the owner’s home, ranked from the tenant’s own
532 orders. Not a dashboard: it shows the few things worth acting on, each
naming the screen that proves it, and says so plainly when there is nothing.
Acting or dismissing is remembered, so the next load ranks differently.

**The offer screen**, `drawOffer()` in onboarding — what `?start=new` opens on.
It is the consent question, phrased as an **offer** rather than a request:
*“Shall I set up your business on this number?”* Asked cold, *“can we contact
you?”* is answered no by most people, and explore then stops being a choice and
becomes the default path by accident. Agreeing to have a business set up on a
number **is** the permission, recorded when it is given. There is no code to
type — WhatsApp verified the number before the user tapped anything, so an OTP
would prove nothing a tap does not and would cost exactly the browsers we most
want to learn from.

**The data layer.** `assets/context.js` is one read model over the tenant and a
**reader, not a second business layer**: `orderingStatusFor()` is delegated to
`FB_EVIDENCE` rather than reimplemented, so D-016’s two implementations do not
become three. `assets/nudges.js` detects and ranks deterministically — no model
in the loop — and the cadence-not-cash rule (D-015) is **enforced rather than
remembered**: `assertNoMoney()` throws on localhost if any nudge promises a
rupee figure this tenant’s records cannot support.

**Three defects the build itself surfaced**, each caught by running it:

- **Thin and out-of-stock counted the same 25 products.** `low` was `<= 5`,
  which includes zero, so two nudges described one problem — twice the apparent
  trouble and half the trust in both. They are disjoint now, and “thin” is
  correctly empty for this tenant.
- **The offer screen drew *Not now* as the primary button.** `is-alt` is the
  outlined style, and the flags were the wrong way round — which would have
  pushed people into exploring by visual default, the precise funnel accident
  the offer wording exists to avoid.
- **The lead card showed three shops it could not help with.** The list sorts by
  days overdue and the most overdue are exactly the ones too stale to predict
  from (D-017), so slicing the top three put three *no recent history* rows
  directly under a sentence promising twenty we could act on. It shows the
  actionable ones now and counts the stale ones separately.

**A nesting bug, fixed in three places.** `takeSignupFlag()` and both
`handoff()`s reached for `window.top`. That is the platform only when the
platform is the top document — and `ivr.html` frames it, so from inside a module
`top` was the simulator and neither the flag nor the route ever arrived. All
three now climb the frame chain: the flag is taken from whichever ancestor
carries it, and a route is set on the first ancestor that answers to
`FBPlatform`.

**The exit is a contract now, not a menu.** One row — *Give feedback* — and both
it and *Skip* end in the chat. **Become a part of FoodBridge is gone from it**:
it routed into onboarding, which put a whole flow between the exit and the chat.
Signing up is a door at the front now (*I’m new here* in WhatsApp, and the
standing offer on every explore screen), which is where that decision belongs.
The icons and styles for the removed rows are kept rather than deleted.

**And the exit is on every destination.** The shell mounts it once in
`index.html` rather than each screen mounting its own. Raw Material Inventory
still draws its own, because it passes a **Receive Stock** tab through the bar
and suppressing the bar would take the control with it — so whoever is framed
wins, and `deferToFramedExitBar()` stands the shell’s bar down for that one
route. The other four in-module mounts only fire when opened standalone.

**The shell shows whose business it is.** `identity()` prefers the account
onboarding wrote over the seed, for the sidebar store name, the mobile header
and the QR modal. A guest still sees the seed, because a guest has no name and
nothing is invented.

**The IVR, as configuration.** `assets/ivr-flow.json` is the object to paste
into `whatsappIvrFlow`; `ivr.html` is a simulator that reads the same file and
mirrors `ivrOrchestrator.js` — two states, reply buttons at ≤3 rows and a list
above, truncation at 20/24/72, static `url` sent verbatim, smart links minted
per user, every reply returning to `MAIN_MENU`. **Nothing in cafex-backend is
modified.** Three rows: *I’m new here* (static link to `?start=new`), *I have an
account* (`AUTO_LOGIN`, already per-user and already authenticated), and *Talk
to a person*.

Verified end to end through the simulator at 375×812: *I’m new here* → the
offer; *Not now* → explore; a feature → Customer Receivables in three taps;
*Yes* → account → sample import → data found → data check → **Good afternoon,
Shreyas · Devekar Traders — I checked 532 orders across 40 customers**, with the
sidebar carrying the same name; the exit sheet showing one row on every
destination. No console errors.

**Not fixed, and worth saying.** A static link carries no identity —
`{userName}` substitutes into message bodies, never into `url` — so a brand-new
visitor still types their number once on sign-up. A returning visitor’s is
carried by `AUTO_LOGIN`. Closing that gap means a new `smartCodeEventEnum` event
on the backend, and it is not worth paying for before the flow is proven.

**Still simulated, and it must be said out loud in a session:** the IVR here is
a mirror of the config, not the delivery; Tally and Vyapar connections reveal
records this repository already holds; accounts and orders live in the browser
only. **Still absent on purpose:** receivables, overdue value, capital tied and
margin — this tenant’s export has orders but no invoices or payments, so the
control tower draws none of them and says why.

### 20 September 2026 — the questions go back into the chat

**Product owner:** the IVR built on 19 September was too flat — three buttons,
each a link, with the questions asked in v7. That is not the agreed flow. The
agreed flow asks its questions **in WhatsApp**: new or existing; then *shall I
set up your business on this number?* or *do you run a store, or buy from one?*;
and only the end of each branch is a link into v7.

**Why it was flat, and what changed underneath.** On 19 September the
orchestrator was a two-state machine — `MAIN_MENU` and `AWAITING_SUPPORT_TEXT`,
every button returning to the first — so a second question in the chat was not
possible without backend work, and the questions were moved into v7 instead.
That was a real constraint, but moving them should have been put to the product
owner as a choice rather than made quietly. It is no longer a constraint:
**cafex-backend `ec20bd3c` added nested menus, driven by config alone** — a
`nodes` registry, `next` on a button to open one, `__BACK__` / `__HOME__` to
navigate, the position held in `session.context.menuStack`.

**`assets/ivr-flow.json` is the agreed tree now,** on that schema:

```
Hi ─┬─ I'm new here ──── Shall I set up your business on this number?
    │                        ├─ Yes, set it up  → link: sign up
    │                        └─ Not now ─────── pick a feature → link
    ├─ I have an account ─ Do you run a store, or buy from one?
    │                        ├─ I run a store   → link: what needs you today
    │                        └─ I buy from one ── my orders · shop · a problem
    └─ Talk to a person
```

Every menu is within Meta's ten rows and every node carries a way back — the
backend does not inject one, and a node without `__BACK__` or `__HOME__` holds
a user until the session times out.

**Every leaf is a static `url`.** A caller the backend does not recognise always
gets the top-level flow, and a smart link needs a resolved user, so a smart link
anywhere in this tree would answer with *smartLinkUnavailableMessage*.

**It goes in the demo tenant's `orgConfig`, never `globalConfig`.** It carries
no `roles`, and `orgConfig.whatsappIvrFlow` replaces the global flow wholesale —
pasted globally it would replace every tenant's production commerce menus.

**Two copy decisions forced by how the orchestrator behaves:**

- `unknownMessage` is *“Here's the menu again 👇”*, not *“I didn't catch that”*.
  The exit sends **Hi** back into the chat, and with nested menus the session is
  usually still inside a node — so *Hi* is “unknown input” there, and the old
  copy scolded someone for coming back from the demo. The neutral line serves
  both cases, and they land on the menu they left.
- `{userName}` appears only in the greeting. An unrecognised caller's name is
  the fallback *“there”* — right in *“Hello there!”*, and it made the support
  reply read *“Got it, there.”*

**v7 adapts in one place.** The storefront already opens its own
`#purchases` / `#shop` / `#help` tab from its fragment, but the shell never
passed one through, so *My orders* would have landed on the shop's front page.
`withView()` in `platform.js` now hands `#/retails-overview?view=purchases` to
the framed module as `#purchases`; a leaf URL that already has a fragment is
left alone.

**What the 19 September screens become.** The v7 offer screen (`?start=new`) and
`screens/explore.html` are no longer on the WhatsApp path — the chat asks the
question and lists the features itself. Both stay, as the web path: someone who
opens v7 directly still gets *Continue as guest* → explore, and a shared
`?start=new` link still gets the offer. *Yes, set it up* links to
`#/onboarding?signup=1`, so v7 does not ask a question the chat already asked.

**`ivr.html` mirrors the nested orchestrator** — the stack, current-menu-only
matching (a tap on an older message's button falls through to the current menu,
as it does on the real number), link and support taps keeping the user in place,
the support confirmation returning to the root as text only. It opens by sending
**Hi**, lints the config on load (over ten buttons, a `next` to a missing node, a
node with no way back, titles past their limits), and at phone width opens links
in a new tab the way a real phone opens a browser.

Verified through the simulator: every branch navigates and backs out one level
at a time; *My orders* opens the storefront on **Purchases** and *Shop and
offers* on **Shop**; *Yes, set it up* opens **Create your account**; *I run a
store* opens **What needs you today**; *Shelf audit* opens Stock Audit; coming
back from a demo mid-tree shows the menu the user left; support ends at the
root. No lint warnings.

### 20 September 2026 — "I run a store" opens the business menu

**Product owner, with a drawing:** an owner is not sent straight to a page. They
get **Business Options** in the chat — FoodBridge Recommends, Manage orders,
Check collections, View inventory, Create purchase request, Speak to support —
and **FoodBridge Recommends** lists what needs attention, each item a link into
the store, with *Open in FoodBridge* for the whole picture.

Two new nodes in `assets/ivr-flow.json`, `BUSINESS` and `RECOMMENDS`; the
`FB_OWNER` button now carries `next: "BUSINESS"` instead of a link. Seven and six
rows, both lists, both with a way back.

**Recommends names what needs attention, and carries no counts.** The drawing
reads *5 orders delayed · ₹1,24,000 pending collections · low stock: 3 products
· tomorrow's route ready*. Two parts of that cannot be carried over honestly:

- **A count in config is not live.** `whatsappIvrFlow` is a string in Mongo;
  the orchestrator substitutes `{userName}`, `{tenantName}` and `{title}` and
  nothing else. A count pasted today is wrong within the week — and it would sit
  in the chat beside a control tower that computes the same count fresh, so the
  two disagree in front of whoever is watching.
- **The rupee figure is one this tenant cannot support.** Its export has orders,
  no invoices or payments (D-015), and the control tower says so on screen.

So the rows say *what* — shops not ordering as usual, out of stock, tomorrow's
route — and the link shows *how much*, from the records, on the day. Live counts
in the chat are real work, not config: a dynamic node in the orchestrator, or
the 07:15 message as an approved template. *Delayed orders* is also left out: no
signal in v7 computes it.

`staticLinkMessage` lost its *“Here's”*: with verb titles it read *“Here's
Manage orders”*. It now leads with the title in bold.

Verified in the simulator: *I have an account → I run a store* shows Business
Options; *FoodBridge Recommends* shows its four items and the way back; *Back*
returns to Business Options; each row sends its link. No lint warnings.

**Correction, same day.** The entries above say this config “carries no
`roles`” and should go in the demo tenant's `orgConfig`. Both rest on a partial
copy of the live object. **The live `whatsappIvrFlow` has a `roles` block** —
WHOLESALER_ADMIN, WHOLESALER_AGENT, RETAILER_PRIMARY, PRIVATE_USER — and pasting
`assets/ivr-flow.json` over the whole object would have deleted every registered
user's menu. The file is the **top level only**: replace those keys, add
`staticLinkMessage` and `nodes`, and leave `roles` as it is. Checked by building
each role's effective flow the way `loadFlowConfig()` does, before and after: the
only keys that differ are `nodes` and `staticLinkMessage`, and no role can reach
either, because every role button is a smart link or support.

### 20 September 2026 — no more guests: setting up, or having a look around

**Product owner:** *Continue as guest* belongs to the old model. The unified
flow has no guests — a person is setting up, or having a look around — and the
word appears nowhere else, not in the chat and not on the Explore screen.

**Four changes.**

1. **Sign-up: *or Continue as guest* → *Not ready yet? Have a look around
   first*.** It already opened Explore; the wording named what the system
   thought the person was, rather than what happens. *Not ready yet?* because
   most people on this screen already chose *Yes, set it up* in WhatsApp, and
   this is their way out if the form puts them off. *Have a look around* is the
   chat's and the Explore screen's own phrase.
2. **Log in: the guest option is gone, and the dead end leads somewhere.** A
   guest door in the Log in sheet was a third way in, and it opened someone
   else's dashboard. The real dead end is a number we cannot find: its message
   ended *“Create one instead.”* as plain text. **Create one instead** is a tap
   now, and switches to sign-up with the number already filled in.
   `startGuest()` has one caller and one destination as a result.
3. **Logging in lands on the control tower**, not the old dashboard — a
   returning owner goes straight to what needs them.
4. **Anyone without a real account sees a demo store, not test data.** The
   header used to show *QA store* and *Mahesh · Admin* — the seed, which reads as
   a test account in front of anyone. `identity()` now has exactly two answers:
   a real account (its name and business, as Owner), or **Sample Distributors ·
   Demo store** — the name the sample-data channel already uses. That covers a
   guest session **and no session at all**, which matters more than it looks:
   the WhatsApp *pick a feature* links open a feature directly, without ever
   passing through v7's Explore screen, so those visitors have no guest session.
   The seed's own brand and user are never shown now.

**A bug the walk-through found.** The shell drew the identity once, at mount.
Signing up, logging in and finishing onboarding all happen inside the frame
without reloading the shell — so the header went on saying *Demo store* above a
control tower that said *Good morning, Shreyas*. It was stale before change 4
too, showing *QA store*; change 4 only made it visible. `refreshIdentity()`
redraws the header and sidebar from storage on every navigation.

The internal names — `startGuest`, `fb.v7.guest` — are unchanged: invisible to
anyone using the product, and renaming them would orphan sessions already saved
in browsers.

Verified without reloading the page between steps: the new sign-up line opens
Explore under *Sample Distributors · Demo store*; a feature opened from a
WhatsApp link with no session shows the same; Log in has no guest option; an
unknown number offers **Create one instead**, which lands on sign-up with the
number filled in; a known number lands on the control tower with the header
changing to the account's business and name; and the full sign-up path —
*Asha Kulkarni, Kulkarni Foods*, sample data, through to the tower — ends with
header, greeting and sub-line all naming the same business.

### 20 September 2026 — the exit sheet stops claiming the demo was finished

**Product owner:** *“🏁 You've completed the demo”* is something we do not know.
EXIT DEMO sits on every destination now, so most taps come from the middle of a
look around — and a chequered flag over someone who gave up after two screens is
the demo talking to itself.

- The sheet opens **“👋 Before you go — How's it going? One tap is all we need.”**
- The feedback form's own header, *“How was the demo?”*, made the same claim; it
  is **“How's it going?”**
- **“Skip — just take me back”** is **“Skip — back to WhatsApp.”** Since the exit
  sheet gained a ✕, there were two different backs on one sheet: ✕ returns to
  the screen behind, skip leaves for the chat. Only one of them said which.

The file's own diagram said *You've completed the demo* too, and now matches.
Nothing else in the sheet changes: the rating is still the only required answer,
sending still never blocks leaving, and the queue is untouched.

Verified from the middle of a look around on the Explore screen: the sheet reads
*Before you go*, the form reads *How's it going?*, and the way out is *Skip —
back to WhatsApp*.

### 20 September 2026 — no exit bar on the onboarding screens

**Product owner:** the EXIT DEMO footer should not be on the onboarding flow.

Since the shell began mounting the bar for every destination, it appeared over
sign-up, *Where is your data?*, the import, the checks and the first order —
somebody setting their business up, being offered a way to leave and rate a
demo half way through. It argues against the thing they are in the middle of.

**`noExitBar` in `modules.json`,** honoured by `deferToFramedExitBar()`, which
already decided who draws the bar. Onboarding is the only destination carrying
it. Putting it in the config rather than in the shell's logic keeps the rule
where destinations are described.

**Nobody is trapped by it.** The flow has its own Back on every screen after
sign-up, *Not ready yet? Have a look around first* on the first one, and the
bar returns the moment onboarding hands off — to the control tower at the end,
or to Explore.

**And the attribute alone did not hide it.** `#fbx-foot{…display:flex…}` is an
ID selector, so it out-specifies the browser's own `[hidden]{display:none}`:
the shell set `hidden`, the element reported `hidden === true`, and the bar
stayed on screen. `#fbx-foot[hidden]{display:none}` now sits with the rule it
has to beat. Both callers depended on this — the destination that asks for no
bar, and the one that draws its own — so the defer path was never working
either; the shell's bar was simply drawn underneath.

**The first check was wrong in the same way the code was.** It asserted
`b.hidden`, which was true, instead of asking whether anything was drawn.
Re-verified on computed `display`, the element's own box, and a screenshot:
nothing on *Create your account*, `body` padding back to `0px`; 58px of bar on
Explore with the padding restored; and on Raw Material Inventory the shell's
bar stays down while the module's own — *Receive Stock* and EXIT DEMO — is the
one drawn.

### 20 September 2026 — Explore loses two paragraphs, and the scrolling is fixed

**Product owner:** drop *“Real screens, running on a real distributor's
records…”* under the heading and *“Every figure you see is worked out from two
years…”* under the cards, and sort out the scrolling on that page.

Both gone. The six cards now say what the screen is, and the list fits a phone
without scrolling at all.

**Three separate faults were making it scroll.**

1. **No room for the bars.** Two things float over the foot of these screens —
   the shell's EXIT DEMO bar, 58px and fixed, and Explore's own sticky *Set up
   my business* bar above it — and neither is in the document's flow when the
   platform frames it. The last card and the paragraph under it sat beneath
   them. `body:not(.fbx-has-foot) .app{padding-bottom:58px}` reserves the room,
   and only when the shell draws the bar: opened standalone, `exit-demo.js`
   mounts into the page and pads the body itself, and claiming it twice would
   leave 58px of dead space.
2. **The shell was 58px taller than the window.** `FB_EXIT.mount()` pads the
   body so a flowing document's last line clears the bar. The shell is not
   that — its content is a full-height iframe, so the padding shrank nothing
   and simply gave the whole app a stray scroll over a white strip. `mount()`
   takes `pad: false`, and the shell passes it. **`deferToFramedExitBar()` was
   putting the class straight back on every navigation**, which is why the
   first attempt appeared to do nothing; that line is gone.
3. **A 5px overflow.** `.tail`, a spacer that predates the clearance above,
   left the framed page five pixels taller than the viewport — enough to make
   a page that visibly fits twitch under a finger. Removed from both screens
   and from the stylesheet.

Verified at 375×812: the shell does not scroll, the framed page overflows by
**0px**, the last card clears the sticky bar and the sticky bar clears EXIT
DEMO. The control tower, which shares the stylesheet and had the same missing
clearance, now ends clear of the bar too.

### 26 September 2026 — Store Builder, for setting up a distributor by hand

**Product owner:** we set up a distributor by hand after a 40-minute meeting, and he has nothing to export. Give him one tool to fill in during the meeting, easy enough for someone with basic schooling, whose export we set his store up from.

[`store-builder/`](store-builder/README.md) is a standalone page; nothing else in `v7` links to it.

- **Twelve steps, one question each,** in Hindi or English, with 🔊 to read it aloud. He chooses rather than types, and *Next* is never disabled.
- **Real pack photos:** 182 products, each matched by hand to an India pack photo and barcode in Open Food/Beauty/Products Facts (CC BY-SA). The owner first approved a lean six-step version, then asked to go back to the twelve steps while keeping the photos.
- **Export:** a zip containing a 15-sheet Excel workbook, the photos and voice notes, and a `setup.json` that reopens the session.
  - A figure said from memory is flagged for confirmation.
  - The first orders fall on the first day that has deliveries.

Tests: `node --test store-builder/test/*.test.js`, 12 pass.

### 26 September 2026 — Worker Management, the JobFlow apps as HTML

**Asked:** understand the JobFlow admin web and worker app (Nidhimehta9399, received as a zip) and add HTML versions of both, pixel for pixel, under Production.

[`modules/jobflow-worker-management/`](modules/jobflow-worker-management/README.md) adds seven entries to **Production**:
- **The admin web's six sections:** Shift Dashboard, Shift Batches, Workflow Editor, Shifts, Live Board, Shift Analytics. It opens signed in as the seeded admin.
- **Worker App:** the phone PWA. It opens on its PIN sign-in: Asha/1111, Ravi/2222, Meena/3333.

**One sidebar** (owner, same day, after seeing JobFlow's own sidebar beside the platform's):
- The admin's 240px sidebar is clipped away like every other module's, and its sections are platform leaves.
- The Dashboard's Quick Actions move the platform's sidebar too.
- The Worker App is no longer `fullBleed`: on a phone it keeps the platform's header and hamburger, and on a big screen it sits in the phone frame beside the sidebar.

- **Same pixels:**
  - Each page uses its app's own compiled Tailwind CSS, unmodified, and markup ported from the JSX class for class.
  - Checked in headless Chrome against the apps' shipped builds, 36 screens and states: 0 px different wherever the build matches the source.
  - The Shifts page and the worker dashboard follow newer, uncommitted source than those builds. They were checked by rewinding a copy to the committed JSX, which is also 0 px.
- **One backend for both:**
  - `shared/jobflow-api.js` is the Express API ported into the browser, over `localStorage`. It has the same rules and error messages.
  - A shift published in the admin is the shift a worker sees. A task a worker completes moves the admin's batch progress.
- **Seed:** the API's own admin and workers, plus a pickle kitchen mid-shift, dated today.
- **In the frame:** `shared/frame.css` keeps both apps clear of EXIT DEMO, and applies only when the shell sets its insets.

**No role restriction** (owner, same day): any worker on a live shift sees and can start any available task, whatever the step's role.
- The React app filters the list by role, and the API refuses a claim for another role; both are lifted here.
- A step's role stays as a label.

`platform.js?v=` bumped for the `modules.json` change.

### 26 September 2026 — Production, end to end

**Owner:** place the two JobFlow apps in Production with the other modules, so the whole flow works end to end. Understand the UX first, then build. Reference: the frozen-food flow (orders → plan → buy → gate → store → prepare on two lines → big bags → packets → deliver → month end). The proposal (<https://claude.ai/artifact/CKRuWSVsZxCuZixbqywccw>) was approved with every recommendation: all phases in one go, and **zero changes to the Control Tower**.

**One store.** [`assets/production/production-api.js`](assets/production/README.md) is the single store for every Production screen: recipes, batches, the floor, raw-material lots, the freezer's bags and the packets.
- Its seed is the owner's business (frozen green peas, mixed vegetables, soya chaap), and it is *run*, not typed: a month of goods in, orders, shifts, weighing, bagging, packing and sales.
- 9 tests: `node --test assets/production/test/*.test.js`.

**Production, in the order of the work.** The sidebar reads: Production Plan · Recipes · Process Steps · Batches · Shifts · Shop Floor · Freezer Stock · Month End. The Worker App leaves the sidebar: it is `#/worker-app`, opened by QR from Shop Floor and Shifts.
- **Production Plan** (new):
  - orders in hand + next week's forecast − packets − freezer bags − already planned = batches to make, in each recipe's sizes;
  - needed − in store − already ordered = buy.
  - It creates the production orders and records POs.
- **Recipes** (Configure Recipe): reseeded from the store by `recipe-store.js`. Create Production Order makes a real Planned batch and a packing order per pack. Phones now get this page; the cookie-only `mobile-v4.html` is no longer linked.
- **Process Steps** (JobFlow's editor): one set of steps per recipe, plus Packing. A step can record weight in/out with a loss limit, take raw material oldest lot first, count sticks, fill big bags, or pack packets.
- **Batches** (Batch Management) owns every batch number.
  - Its seed calls read the store, re-read on every call.
  - The floor moves its states.
  - A new **Steps** tab shows who · how much · lot · when.
  - "Operator" is now "Supervisor".
  - Floor takes appear on its Ingredients tab.
- **Shifts:** batches from Batches, people from Workforce Management.
- **Shop Floor** (was JobFlow's Dashboard): every batch on a live shift, by line, step by step. Beside it are the floor's alerts (weight loss over the limit, a step waiting, a batch on hold), the freezer and the worker app QR.
- **Freezer Stock** (Semifinished Products): one row per big bag, oldest first, with kg left, made and use-by.
- **Month End** (new): real cost per kg from what was actually issued, and weight lost by step and by worker.
- **Worker App:** Task detail records the lot or bags taken, kg in/out with a live loss check, bags made or packets packed. A held batch can't be started.

**Neighbours.**
- **Raw Material Inventory** and **Finished Goods Inventory** show the factory's materials, lots and packets. They merge in through the shared `MockShell.loadSeed`.
- **Receive Stock** asks for the gate weight and Accept / Send back on production materials. An accepted delivery becomes a lot; a sent-back one adds nothing.
- **Workforce Management** has the four factory roles and the floor's people. A new staff member with a factory role can sign in to the worker app with the last 4 digits of their phone.

**Not changed.** The Control Tower and `fb.v7.events`: the floor writes its record to its own log, `fb.v7.production.log`.

**Verified.**
- A click-through in headless Chrome: Production Plan → Shifts (new shift, publish) → worker app (keypad sign-in, weigh 111 → 101.6 kg) → Batch Management (In Progress, set by the floor; Steps tab) → Raw Material Inventory → Shop Floor. All 9 checks pass.
- Receive Stock (gate weight accepted; truck sent back) and the staff roster: 5 checks pass.
- JobFlow's unchanged sign-in screens re-checked against the React builds: 7 scenarios, **0 px**.
- Every leaf loads inside the platform at 1440 px and 390 px.
- `platform.js?v=` and every changed script's `?v=` bumped to `20260926PR1`.

### 26 September 2026 — Store Builder, dressed like the onboarding flow

**Asked:** the Store Builder's UI, end to end, like the onboarding flow.

Every Store Builder screen and sheet now uses the onboarding's clothes (`modules/foodbridge-onboarding/screens/onboarding.css`): its tokens, its unit (1rem = 10 image px, capped at 402px), Inter, and its parts.
- **Top bar:** a back arrow to the steps list and a twelve-segment progress bar. A camera at the right keeps photos and voice notes one tap away on every step.
- **Each step:** a small "Step n of 12", a bold title, the question in grey, and 🔊 as a round green button beside it.
- **Controls:** fields and choices are hairline boxes, and a choice turns solid green once chosen, like the onboarding's role picker. Next is pinned at the bottom in the onboarding's green.
- **Home** is a manifest like the onboarding's *Data check*: one row per step, with a tick once it is done. The next step to do is tinted.
- **Send** reads like *Data found*: counts in one card, anything still to fill in red. Save file is pinned at the bottom.
- **Icons:** line icons in place of emoji, from the same Lucide set the onboarding uses (`store-builder/icons.js`). Staff and suppliers get initials avatars. The category pictures on packs without a photo stay as they were.
- **Sheets** rise from the bottom like the onboarding's, with a grip and a round close button.

Nothing a screen asks, saves or exports has changed; only `app.js`'s markup did. `onboarding.css` is not touched: it is locked on phones, and the Store Builder does not load it. All `?v=` bumped to `20260926R2`.

Checked at 320, 375 and desktop width, in Hindi and English, with no console errors. Tests: `node --test store-builder/test/*.test.js`, 12 pass.

### 26 September 2026 — Store Builder: Companies, Your rates and Products are one step

**Asked:** merge the three into one. He searches products or brands and adds them; the brand is only an easy way to find products. The brand-wise Your rates step goes.

Store Builder has **ten steps** now: Shop · Products · Phone contacts · Shops · Staff · Suppliers · Usual orders · Godown stock · How you work · Send.
- **Products:**
  - The search finds a product by name, brand, pack, category or company.
  - Under the search is a row of every company, the ones he sells from first, each with how many of its products he chose. Tapping one shows its range and *Add all*.
  - The whole catalogue is listed, his products first. He no longer has to pick companies before seeing products.
- **Companies follow the products** (`SB_MODEL.syncCompanies`). A company arrives with its first product and leaves with its last. Saves from before this change sync when they open. A rate given on the old step is kept and still prices its products.
- **Prices** start at the standard margin (₹80 buy / ₹87 sell per ₹100 MRP). A product's sheet says so under its price until he changes it.
  - The export marks those prices *Standard margin — confirm*, both in Products and in a new *Rate source* column in Companies.
  - It no longer calls them *Worked out*, which implied he gave the rate.
- **A company not in the catalogue** is named in the New product sheet: choose *Other* and type the company.

Tests: `node --test store-builder/test/*.test.js`, 13 pass (new: companies follow products, company search, price source). `?v=` bumped to `20260926R3`.

### 26 September 2026 — Store Builder: products by company or by type, food only, fresh and loose goods

**Owner:** think of it as the user. No long scroll. Offer "import by brand", then simply show the products with name and image to select. Handle non-brand goods too (vegetables, fruits, meat, eggs…). Food products only, and very easy to search and select.

**The Products step is a short menu now, not a 20,000px list:**
- **Search**, in English or Hindi: "Maggi", "atta", "आलू". A product's own name ranks above things that only share its company or kind. The barcode scanner sits inside the search box.
- ***Your products* · n** opens the chosen products with their prices. Anything still needing a price comes first; a pencil opens the product and Done returns to the list.
- **By company | By type.**
  - *By company*: a tile per company, each with a real pack photo and a count of what he chose.
  - *By type*: the aisles of a shop. Fresh & loose first (Vegetables, Fruits, Eggs, Chicken/meat/fish, Milk/paneer/cheese), then Packed (Atta/rice/dal … Health drinks & baby food).
- **A tile opens a picture grid,** three across: photo or picture, name, pack. A tap chooses it (green border and tick), and *Select all* / *Remove all* acts on the whole tile.
- **New product** asks *packed or loose* first. Loose asks what it is sold by and his price.

**Food only.** The 36 non-food products (soap, detergent, shampoo, toothpaste…) are gone, with their 15 categories and the 8 companies that sold only those. That leaves 146 packs from 24 companies.

**Loose and fresh goods: 52 of them, with no company or brand.**
- Each is sold per kg / dozen / tray of 30 / bunch / piece / litre / pack, with a Hindi name and an emoji picture.
- There is no MRP. The owner gives the price, per unit, and *To follow up* lists any loose good without a price (`noPrice`).
- Stock counts them in their own unit, and Usual orders use it.
- The export writes them *Loose — no MRP* and sells them *Per kg* and so on.
- GST for fresh unbranded food is 0%; paneer, curd and dry fruit are 5%. The accountant confirms these, as for all GST.

`SB_MODEL.tidy` drops products that left the catalogue from older saves, then re-syncs companies. Tests: 15 pass (new: food only with every category in an aisle, loose goods, tidy). `?v=` bumped to `20260926R4`.

### 26 September 2026 — Store Builder: a step ends in Save, back to the list

**Owner:** not Next, but Save or similar: the user should always return to the list.

Every step's pinned button is now **✓ Save**. It saves and goes back to the steps list, with a toast "*Products saved*". It no longer walks on to the next step.
- The list's own button (*Continue: …*) still opens the next unfinished step.
- The skip links (*Count later*, *No staff*, *No suppliers*) also return to the list.
- Send, the last step, is unchanged.

`?v=` bumped to `20260926R5`. Tests: 15 pass.

### 26 September 2026 — Store Builder: no Continue button on the steps list

**Owner:** remove it; a step can be picked straight from the list.

The steps list has no pinned button now: he taps the step he wants. The next unfinished step stays tinted green, and all ten steps, Send included, fit on one phone screen at 375×812. `?v=` bumped to `20260926R6`. Tests: 15 pass.

### 26 September 2026 — Store Builder: they are customers, not shops

**Owner:** reframe the shop context; it's not shops but customers.

Wherever "shop" meant the distributor's buyer, the Store Builder now says **customer** (Hindi **ग्राहक**), the platform's noun (see the onboarding and the Control Tower).
- **On screen:** the step (*4. Customers*), its question and buttons (*Add a customer*, *Big customer*), contact sorting, Usual orders, How you work (*How do customers pay you?*), the product price (*Customer price*, *Your price to customer*), the counts and every follow-up gap.
- **Icon:** customers get a people icon in place of the cart and the shopfront.
- **Export columns:** Customers, Routes, Usual orders, First orders, Settings and To follow up say *Customer*.
- **Unchanged:** his own business keeps "shop": *Your shop*, shop name, location, address and photo.
- **Unchanged internally:** step and field names (`shops`, `type: "shop"`), so saves and setup files still open.

`?v=` bumped to `20260926R7`. Tests: 15 pass.

### 26 September 2026 — Store Builder: one Contacts step

**Owner:** merge Phone contacts, Customers, Staff and Suppliers into one. The user imports the relevant contacts from the phone, then tags them customer, staff or supplier, adds more, removes. Make it very easy and quick.

Store Builder has **seven steps** now: Shop · Products · Contacts · Usual orders · Godown stock · How you work · Send.

**Contacts**, one screen:
- **Add, at the top:** *Add from phone contacts* (Android picker, many at once), *Contacts file*, *Type a name*. Typing a name from inside a tab starts it with that tag.
- **Tabs with counts:** To sort · Customers · Staff · Suppliers. It opens on *To sort* while anyone is left (amber until the queue is empty), otherwise on Customers.
- **To sort:** one person at a time, with four big buttons.
  - A guess from the name marks one button *Looks like*: "… Kirana/Stores/General" → customer, "… Agency/Depot/Stockist" → supplier, "… Driver/Salesman/Helper" → staff (`SB_MODEL.guessType`). It never tags anyone by itself.
  - **The rest are customers (n)** tags the whole queue in one tap. Most of a distributor's phone book is customers. Undo takes the whole batch back.
  - *Not needed* people stay in a fold, one tap to re-tag.
- **Each tab shows only what its kind needs:** customers get the delivery-day row and ⭐ big customer, staff their job, suppliers their companies. *No staff* / *No suppliers* now stay on the screen.
- **More** opens the person, where they can be re-tagged or **removed** (`SB_MODEL.removePerson`, which also drops their usual order).

The steps list shows Contacts as "2 customers · 1 staff · 1 supplier · 2 to sort". The Send step's counts and *Still to fill* rows open Contacts on the right tab.

Saves and setup files are unchanged: the stored `type: "shop"` / `"staff"` / `"supplier"` is the same. Tests: 16 pass (new: the name guess, removing a contact, gaps pointing at the right tab). `?v=` bumped to `20260926R8`.

### 26 September 2026 — Store Builder: contacts from the phone's contact list only, iPhone and Android

**Owner:** no contacts file. Import from the phone's contacts, the way WhatsApp's share contact does, and it should work on both iOS and Android.

- **One way in:** *Add from phone contacts* opens the phone's own contact list, where he searches, ticks many and taps Add.
  - Where a contact has several numbers, the mobile is kept.
  - Everyone added lands in *To sort*, with the name-based hint.
  - *Type a name* stays beside it.
- **Contacts files are gone:** the button, the file input and the vCard reader, with its test.
- **iPhone:** a web page reaches contacts only through the browser's contact picker. Android Chrome has it on. iPhone Safari has the same picker, off until *Settings → Apps → Safari → Advanced → Feature Flags → Contact Picker API* is turned on (older iOS: *Experimental Features*).
  - The page checks for the picker on each tap, so turning the setting on needs no reload.
  - Without it, the button opens a sheet with that phone's own steps: iPhone the setting, Android open in Chrome, computer open on the phone. Typing is the fallback.
  - Only a native app (as WhatsApp is) reaches iPhone contacts with no setting at all.
- **Checked here:**
  - The iPhone steps, with an iPhone user agent.
  - The whole import path, with the phone's picker stood in: names and tel asked for, several at once; the mobile chosen over a landline; *To sort* with the hint.
  - The real picker needs a real phone.

Tests: 15 pass (the vCard test went with the feature). `?v=` bumped to `20260926R10`.

### 26 September 2026 — Store Builder: Contacts, slicker and denser

**Owner:** make the UI slick and easy, with more people visible and handled at once.

- **Adding** is one row: *Add from phone* and *Type*.
- **The four tabs** are count tiles (To sort · Customers · Staff · Suppliers), pinned under the top bar while the list scrolls. *To sort* is amber while anyone is left.
- **To sort is a list, not one card at a time.** Each row shows the name and number, then **Customer · Staff · Supplier · ×** buttons, with the name-based guess highlighted. One tap files the person.
  - *The rest are customers (n)* and *Undo* sit in a slim bar above the list.
  - *Not needed* people fold away below, with the same buttons.
- **Customers** are one compact row each: ⭐, name, number, and a mini Mon–Sun row under the name. About 7 fit on a 375×812 screen, against about 3 cards before.
- **Staff** get a mini job row. **Suppliers** show their companies, in amber when none are chosen.
- **Tapping a row** opens the person for everything else: area, payment, re-tag, remove.
- **Search** (name or number) appears once a tab holds more than 8 people.

`?v=` bumped to `20260926R11`. Tests: 15 pass.

### 26 September 2026 — Store Builder: no Usual orders step

**Owner:** remove Usual orders.

Store Builder has **six steps** now: Shop · Products · Contacts · Godown stock · How you work · Send.
- **What went with it:**
  - The step and its order sheet.
  - The *First orders* count on Send.
  - The export's *Usual orders* and *First orders* sheets; the workbook has 13 sheets now.
  - The follow-ups *Big customers without usual order* and *No big customers marked*.
  - The model's `usualLines`, `firstDay`, `tomorrowOrders` and `tomorrowDay`, with their words.
- **What stays:** ⭐ big customer on Contacts and the export's *Big customer* column.
- **Old saves** keep their `usual` field and still open; nothing reads it.

Tests: 15 pass (new: no usual-order sheets or gaps, and an old save with usual orders still opens). `?v=` bumped to `20260926R12`.

### 26 September 2026 — Store Builder: no camera in the top bar, no reopening a setup file

**Owner:** remove the top-bar camera, *Open a setup file* and *I have a setup file*.

- **Camera:** it is gone from the steps list and every step's top bar, and the step progress runs the full width.
  - Photos of paper and voice notes are still reachable from *How you work* (record a voice note) and *Send* (*Photos & voice*).
  - The shop and product photo buttons are unchanged.
- **Setup file:** the ⋯ menu has only the language switch and *Start again*, and Welcome only *Start*.
  - The file input and the reopen/replace code are gone, with their words.
  - The export still writes `setup.json` for the onboarder, and `SB_EXPORT.read` still reads it (tested).

`?v=` bumped to `20260926R13`. Tests: 15 pass.

### 26 September 2026 — Store Builder: Godown stock is the platform's Stock Audit

**Asked:** the whole Godown stock flow with the exact UI/UX of the platform's Customer Stock Audit, but for the owner counting stock in his own shop.

The step is now the platform's Quick Audit loop (`modules/foodbridge-customer-mockup/v3/screens/customers/stock-audit.js`), screen for screen, and uses its look: teal, system font and px sizes, copied into a `.sa` block in `sb.css`. It is the one Store Builder screen that does not wear the onboarding's clothes.
- **Changed for his own shop:** no *Who are you visiting?* customer picker; the audit opens on the count, headed *Godown stock*. No bottom nav, because *Create Order* and *Audit History* do not apply here.
- **Same as the platform:**
  - The header shows *N / M counted* over a progress rule.
  - Tapping the search box opens a dropdown (first 5 A–Z, then *keep typing*). His own products come first, then the catalogue. *No product found* offers *+ Add Product*.
  - *Selected products* is one card. Each row has its unit above a − n + stepper; blank means not counted, 0 means none there. A counted row turns green.
  - The trash asks *Remove?* ✓ / ✗ in the row.
  - Tapping a unit opens the platform's unit sheet: his price for one of that unit, a unit select, and *Save unit?* ✓ / ✗. The row shows *✓ Updated* afterwards.
  - *+ Add Product* and *Finish Audit* sit in the footer. Finish asks *Finish this audit?* in place, and ✓ saves and returns to the steps list.
  - ← asks *Leave this audit?* (*Keep counting* / *Leave without saving*), but only when something unsaved would be lost.
- **Data:** the count is a draft (`stockDraft`) until Finish. Finish writes `stockCases` (boxes) or `stockLoose` (pieces, kg…), so the export's *Opening stock* sheet is unchanged. Reopening the step starts from what was saved. A catalogue product counted here joins his products.
- **Gone:** the per-product cards with Boxes + Loose steppers, the company filter chips and *Count later*, with their words.

`?v=` bumped to `20260927S01`. Tests: 19 pass (new: draft from saved counts, Finish writes opening stock, blank vs 0).

### 26 September 2026 — Store Builder: the stock audit, in the same flow as the other steps

**Owner:** Godown stock should look and work like the rest of the steps, so the owner feels he is in the same flow.

It keeps the audit's way of working and drops the platform's look.
- **Same as every step:** the back arrow and six-bar progress, *STEP 4 OF 6*, the title with the spoken question in Hindi, the onboarding's tokens, Inter and rem, the green ✓ *Save* back to the list, and the sheet that rises from below.
- **Kept from the Stock Audit:**
  - Tapping the search box opens a dropdown (5 A–Z, then *keep typing*), his products first.
  - One card holds the count. Each row has the unit above a − n + stepper; blank means not counted, 0 means none there. A counted row is tinted.
- **Changed to fit the flow:**
  - Counts save as he taps, like every other step, so there is no *Finish Audit*, no *Leave this audit?* and no draft.
  - The footer shows *N of M counted* over Save.
  - The product photos are back on the rows and in the dropdown.
  - Tapping a row opens a product sheet: unit chips with his price for one, and *Take off the count*. It replaces the unit select with its ✓ / ✗, and the trash with its *Remove?*.
  - *All my products · N* puts every product he chose on the count in one tap.
- **Data:** `stockSel` is the list being counted; counts go straight into `stockCases` / `stockLoose`. The first cut's unsaved `stockDraft` is dropped from old saves.

`?v=` bumped to `20260927S03`. Tests: 19 pass.

### 26 September 2026 — Store Builder: How you work, shorter

**Owner:** make the form quick to do now rather than something to put off. A one-question-per-screen version was tried and turned down: paging felt slower, it had too much text, and it looked unlike the other steps.

It is still one page, and still the same eight answers.
- **Yes/No questions:** the four are now one card of short rows (*Fixed route days?*, *Customers order on phone?*, *Part now, rest later?*, *Check expiry dates?*), each with a Yes | No switch at the end. They sit first, so the page starts with four quick taps.
- **Choice questions:** payment, returns, order steps and the morning check keep their chips, with fewer words (*Customers pay by*, *Give credit*, *First thing each morning*).
- **Progress:** *N of 8 answered* sits over Save, as the other steps show their counts.

`?v=` bumped to `20260927S05`. Tests: 19 pass.

**Then, owner:** remove *Order steps*. *How you work* now asks 7 questions, and the count reads *N of 7 answered*. The export's settings sheet no longer has an *Order steps* row. Old saves that have the answer still open; nothing reads it. `?v=` bumped to `20260927S06`. Tests: 19 pass.

**Then, owner:** too many icons. Only the question headings (*Customers pay by*, *Damaged goods come back*, *First thing each morning*) keep their icon. The Yes/No rows and the answer chips are plain text. `?v=` bumped to `20260927S07`.

**Then, owner:** icons back on the four Yes/No questions. Each question has one icon, on its row or its heading; the answer chips stay plain. `?v=` bumped to `20260927S08`.

**Then, owner:** *Anything else? Say it* is now just a note. It used to record a voice note into Photos & voice. It is now an *Anything else?* box: he types, or taps the mic and speech becomes text (Web Speech, Hindi or English, adding to what is there). The note goes to the export's Settings sheet as *Anything else he said*. Voice notes are still on Send's *Photos & voice*. `?v=` bumped to `20260927S09`. Tests: 19 pass.

### 26 September 2026 — Store Builder: Build my store, and the files go to FoodBridge

**Owner:** redesign the last step so the Excel is kept somewhere it can be opened any time, and the button says *Build my store*. The files must NOT stay on the distributor's phone; the customer success team must be able to open them. For where they live, the owner chose **our own list on the bridge**.

- **The step (*Build your store*):**
  - Six tiles (products, customers, suppliers, staff, stock counted, photos & voice), each opening its step.
  - What is still missing is folded into one line (*9 things to fill later*) that opens the list.
  - One green **Build my store** button.
  - Gone: *Save file*, *Send on WhatsApp*, *Excel only* and the *How to send* steps.
- **Build my store:** it makes the Excel, `setup.json` and every photo and voice note, then sends them to the bridge one file per request.
  - A sheet follows it: *Sending to FoodBridge…*, then *Your store is built. FoodBridge's team has it.*
  - Offline or with no bridge, it says *Waiting to send · 0 of 2 files sent* with *Send now*. It sends by itself when the phone comes online or the app reopens.
  - The phone holds a build only until it is delivered, in its own IndexedDB queue (`fb-storebuilder-outbox`). Each file is deleted as it lands.
  - The steps list shows *Sent 26 Sep, 10:05 pm* or *Waiting to send*.
- **Bridge (`zoho-function/`):** new `POST/GET /api/stores`.
  - Storage is private Vercel Blob, or `stores-data/` under `npm run dev`. Reading needs the team key `FB_STORES_KEY`.
  - File names and ids are held to a pattern; files over 3 MB are refused.
  - `/api/health` reports `stores`.
- **Team page:** `v7/stores.html` lists every built store, newest first, with a search. Each store shows its counts and *to follow up*, and downloads its Excel, `setup.json`, photos and voice notes through the bridge with the key.
- **Not live until the owner turns it on:** a Blob store, `BLOB_READ_WRITE_TOKEN` and `FB_STORES_KEY` in `zoho-function/.env`, then `./deploy.sh` (see the bridge README). Until then, builds wait queued on the phones and arrive once it is on.

Checked end to end locally: build → 3 files at the bridge → listed on `stores.html` → the Excel downloads intact. Offline: waits, then sends on *Send now*, and the phone's queue is empty afterwards. Tests: Store Builder 20 pass; bridge `stores.test.js` 8 pass. The bridge's `extract.test.js` fails before and after this change (a package not installed locally). `?v=` bumped to `20260927S11`.

**Then, owner:** tell him he can leave. The built sheet now reads *You can close the app now. The FoodBridge team will call you soon to set up your store.* (Hindi too). `?v=` bumped to `20260927S12`.

**Then, owner:** email the Excel as a backup and fallback, to two team addresses. The addresses are kept in the bridge's `.env`, not in this public repo.
- The first request of a build now carries the summary, the Excel and `setup.json` together.
- The bridge stores them and also emails the Excel and `setup.json` to the team, with the store's summary, through Resend (`zoho-function/stores-email.js`).
- With no file store yet, the email alone counts as delivered. Photos and voice notes wait for the store.
- It needs `RESEND_API_KEY`, and a verified sender (`FB_STORES_EMAIL_FROM`) to reach both inboxes; see the bridge README.
- Bridge tests: 10 pass (new: the email and its attachments, the fallback, a refused email is not a delivery). `?v=` bumped to `20260927S13`.

**Then, owner:** success is a whole page, not a sheet. After *Build my store*, a full *Thank you!* page with a big check reads *The FoodBridge team will reach out to you soon.*, with one quiet link, *Back to my store*. While sending, the same page shows *Sending to FoodBridge…*; offline, *Waiting to send* with *Send now*. The built sheet is gone. `?v=` bumped to `20260927S14`.

**Then, owner:** no *Back to my store*; the FoodBridge logo and name sit centred at the top of the *Thank you!* page, and there is nothing else to tap. The only button is *Send now*, and only while offline. `?v=` bumped to `20260927S15`.

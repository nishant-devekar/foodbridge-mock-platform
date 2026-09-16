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

Everything behind the flow is **simulated**, and the product says so in its own
words rather than in a footnote:

| | |
| --- | --- |
| Connecting to Tally / Zoho / Vyapar | `NOT BUILT` — never contacted. The consent sheet says so **before** the user commits, and choosing one loads a demonstration business |
| Whose records the flow shows | `DEMONSTRATION` — in every mode, marked by an amber chip on every screen from S03 on, which opens a sheet explaining it |
| Extraction, mapping, validation | `NOT BUILT` — reports that it read nothing, inside the sheet the user opened |
| GSTIN check | `FORMAT ONLY` — no lookup, and it claims none: it reads "Format checked" |
| Draft preparation | **real in the browser** — held at Order Drafts, reviewable and editable, sent to nobody, written to no accounting system |
| The order history behind the insight | **real** — 532 orders, 3,931 lines, 39 of 40 shops, Aug 2024 → Aug 2026, from the tenant's own Zoho export, used here as the demonstration business |
| The reorder engine | **real** — back-tested at 66.5% precision / 69.6% recall on 171 unseen 2026 orders |

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

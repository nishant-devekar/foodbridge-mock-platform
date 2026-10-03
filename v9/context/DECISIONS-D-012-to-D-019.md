# Decisions D-012 to D-019 — what was decided, and what was rejected

Copied from `research/DECISIONS.md` in `exagon-ai/foodbridge-pmf`.
Each record keeps what was **rejected** as well as what was chosen; that is the
half that does not survive in code, and the reason these travel with the build.

---

## D-012 · 2026-09-16 · DECIDED · onboarding ends at an activation moment, not at a first order
by: Nishant Devekar · opportunity: `research/OPPORTUNITIES.md#O-001` · reading: `research/understanding/U-001-nishant-s-new-user-onboarding-brief.md`

### Decided

U-001 surfaced four conflicts in the onboarding brief and left them for the
product owner. All four are now answered.

**1 — The journey.** The latest UX flow is authoritative: Sign Up → Collect →
Connect / Upload / Manual → FoodBridge AI → Data Check → Quick Setup *if needed*
→ Business Pulse → Top Priorities / First Action → Welcome. The older
"create first order" flow is no longer the onboarding source of truth. **First
order is not forced into onboarding to complete the flow**; it stays an
important downstream activation outcome, measured afterwards. Onboarding
succeeds when the user has connected or imported their business, understands
that FoodBridge understood it, and takes a meaningful first action.

**2 — Mobile-first.** The phone viewport is the source of truth for interaction
design: one primary action per screen, vertically compact, touch-sized targets,
no hover dependency, no wide tables or multi-column layouts, the CTA reachable
without scrolling away from the decision, and nothing important hidden behind
the mobile keyboard. Desktop is the same flow with more breathing room — **no
extra features, columns, information or workflows because the space exists**.
The hierarchy is identical on both: Data → Minimum setup → Trust → Insight →
Action.

**3 — What is real.** Real wherever the data exists: Miha's products, Miha's
customers, the Zoho order history, and supplier/staff data where available.
Simulated initially: the Tally and Vyapar connections, document extraction,
import progress, and mapping/normalisation — and each simulation behaves like
the eventual contract so the design does not walk into a dead end.
**Business Pulse must not fabricate.** No margin-leakage card unless margin can
be computed honestly from the source data. Show only what can be substantiated —
the data drives the cards, not the reference.

**4 — The hypothesis.** *A new distributor who already has business data in an
existing system or files can get to a meaningful first action in FoodBridge in
one onboarding session, with minimal manual data entry, because FoodBridge does
the ingestion and setup work for them.* Weakened or wrong if: users do not trust
the imported data · must manually recreate significant amounts of it · cannot
understand what is missing · abandon during import or setup · Business Pulse
does not make the effort feel worthwhile · they reach the end and take no
action. Primary measure: **time from signup to first meaningful action**.
Secondary: manual fields entered, abandonment point, correction required,
Business Pulse interaction, first order in the following window.

**Also decided.** "Business Health" is not a separate concept — it is
presentation inside Business Pulse. The reference's *Staff 8* then *Staff
Missing* is an inconsistency and is not copied: Data Check has one deterministic
source of truth, showing a count **or** Missing, never both. And the flow is
optimised to the smallest viable screen set **before** any implementation
version exists — Business Pulse, Top Priorities and First Action are challenged
to compose into one activation screen rather than three.

### Why

The brief called the attached images authoritative while describing a journey
the images do not contain (U-001 I06 ↔ I07), and its own success signal still
ended at a first order (I16). Left unanswered, both journeys were buildable and
the one that got built would have been an accident. The same is true of desk
versus phone (I14 ↔ I15) — which decides what a session even watches — and of
what would be real (I12), which decides whether a customer is being shown a
truth or a demo.

### Rejected

| Rejected | Why |
| --- | --- |
| Keeping "create first order" as onboarding's destination | It makes onboarding complete only when a transaction happens, which pushes a made-up order into a session where the user may have nothing to order. Activation is measured, not staged. |
| Desktop-first, because owners are "typically at a desk" | The phone is the harder constraint and the one that keeps the flow compact. Designing wide and shrinking is how dense screens come back. |
| The reference's ₹72K margin-leakage card | Margin needs a cost, and the one real tenant's Zoho rates are retail MRP (L-008). An invented figure is precisely the trust failure L-005 records. |
| A separate "Business Health" screen or concept | Nothing yet distinguishes it from Business Pulse. Inventing the distinction before anyone needs it adds a screen and a vocabulary. |
| Copying the Staff 8 / Staff Missing reference behaviour | Two answers to one question on consecutive screens is exactly what destroys the trust Data Check exists to build. |
| Implementing each of Business Pulse, Top Priorities and First Action as its own screen | Three screens for one moment. They are challenged into one and must earn separation from testing, not from the reference. |

### Still open

- **What Business Pulse can honestly compute** from what is actually on file.
  The product mapping answers it, and a card with no data behind it does not
  ship — including the possibility that fewer than four cards survive.
- **The "nothing yet" branch.** A business FoodBridge has never seen gives it
  nothing to be insightful about. What that user gets instead of an activation
  moment is undecided.
- Both hypotheses behind this remain `INFERRED`, `LOW` confidence, with no
  customer heard (L-012, L-013). Nothing here is validated by being decided.


## D-013 · 2026-09-16 · DECIDED · the onboarding UX: empty stays empty, required means required, and the no-data journey waits
by: Nishant Devekar · design: `design/ux/O-001/FLOW-MAP.md` · opportunity: `research/OPPORTUNITIES.md#O-001`

### Decided

Answering the three questions the design review left open, and confirming four
things that were already designed.

**1 — Suppliers and Staff stay `Missing` for Miha's.** No seeding, and nothing
borrowed from another store. The 5 sellers in the procurement module and the 13
staff in Workforce Management belong to other demo tenants and stay there. For
this tenant those two rows are genuinely empty, and the inline add on S03 is the
only thing that fills them.

**2 — Missing required data blocks Continue.** The "I'll do this later" escape
is removed. The user completes the missing inline rows and Continue then becomes
actionable.

**3 — The "Nothing yet" source is out of this version.** It is not offered on
S02 and it is not in the flow. It remains an open future journey.

**4–7 — Confirmed as designed.** The four-screen structure stands. S04 stays one
activation screen combining Business Pulse, priorities and first action. Only
data-backed insights are shown — no invented or borrowed financial metrics.
Mobile stays the source of truth for interaction design.

### Why

Each of the three answers closes a hole that would have been discovered in front
of a customer. Another store's suppliers shown as Miha's own is the same lie as
an invented number, told at the exact moment the screen is asking to be believed
(L-005). "Please add it to continue" beside "I'll do this later" is two rules
where one has to win, and the skip is a trapdoor out of onboarding at its most
fragile step. And a half-designed manual branch in a customer session draws the
session towards itself — the hypothesis is about people who already have data.

### Rejected

| Rejected | Why |
| --- | --- |
| Seeding Miha's with suppliers and staff so the screen looks complete | A complete-looking Data Check that is not this business's data defeats the only thing that screen is for |
| Keeping "I'll do this later" beside required rows | If a row can be skipped it was not required. Two rules, one has to win |
| Designing the manual-minimum branch now | A different journey. It tests nothing in this hypothesis and would pull a session towards itself |
| Splitting S04 back into three screens | Three screens for one moment. They earn separation from a session, not from a reference diagram |

### Consequence worth knowing

Blocking Continue puts a required gate at the most fragile step in the flow, and
**"users abandon during import/setup" is on this hypothesis's own falsifier
list** (D-012). That is the thing to watch first in the session: if people stall
on S03, the block is the suspect, and that is a finding rather than a defect.

### Still open

- Pre-login onboarding has no home: master has no user model, no session and no
  tenant creation. `MISSING → NEW` means new screens, never by itself a new
  module — and which it should be here is undecided.
- Which runtime this would be built on: master's desktop iframe shell does not
  carry a mobile-first pre-login flow.
- The "nowhere yet" distributor still signs up one day. What they get is
  deferred, not answered.

### Corrected in part by D-014
Decision 4 above confirmed "the four-screen structure stands", and it still
does — but S01 was *Create account* when that was written. D-014 corrects the
premise: onboarding begins after authentication. Four screens, different first
screen. Both entries stay.

### Superseded in part by D-015
Decision 2 above — *missing required data blocks Continue* — is **superseded**.
The evidence model replaces it: missing data reduces what FoodBridge can
honestly compute, and only the evidence floor stops the journey. Decision 4's
fixed four screens is also released: three, plus a conditional fourth. Decision
1 (never borrow another tenant's suppliers or staff) and decisions 5–7 stand
unchanged. Both entries stay — this one is the record of what we thought before
reading the Control Tower reference.


## D-014 · 2026-09-16 · DECIDED · onboarding begins authenticated, and GST is verified inline
by: Nishant Devekar · design: `design/ux/O-001/FLOW-MAP.md` · corrects in part: D-013

### Decided

**The user is already authenticated when onboarding begins.** They created their
FoodBridge account before they got here. S01 is therefore **not** "Create
account" — it is **Update business profile**:

| | |
| --- | --- |
| **Must-have fields** | Business name · Your name · Mobile number · Email · GSTIN |
| **Primary actions** | Verify GST (inline, against the GSTIN) · Continue |
| **Removed entirely** | Password · Create account · Terms/Privacy account-creation copy · "Already have an account? Log in" |

**GST verification is an inline action, not a screen.** Before: `GSTIN [input]
[Verify]`. After: the field reads verified, with `✓ GST verified` beside it.
Where the verification returns business details, they populate or confirm the
fields rather than the user re-entering what was just looked up.

The journey is unchanged in shape:

```
S01 Update business profile → S02 Where your business is
                            → S03 What we found
                            → S04 Your business + first action
```

### Why

The ideal UX was written on a wrong premise — that onboarding starts at signup —
and everything downstream inherited it. A password field shown to somebody who is
already signed in does not read as thoroughness; it reads as a session that has
failed, at the first screen, before any trust exists to spend.

GSTIN also earns its place where a password does not: it is the number that
identifies the business to everyone else in the chain, it is already an
established field in this product, and verifying it can *remove* typing rather
than add a step — which is the whole hypothesis (L-012) applied to the profile
screen itself.

### What the repository already has

Checked rather than assumed:

- **No profile, settings or company destination exists** in any of the 26 —
  `master/assets/modules.json` has none, and there is no `*profile*` or
  `*setting*` screen anywhere. S01 is `MISSING → NEW`.
- **GSTIN is already a domain field.** `seed.inline.js:510` carries
  `orgGstNumber: "27AAACQ1234A1Z9"` on the tenant, customers carry
  `gstType`/`gstNumber` (`:69-70`, real values like `18ACHFA1423G1ZR`), and GSTIN
  appears across procurement, dashboard and retails-overview. **Nothing renders
  it** — `stock-audit.js` never shows GST at all. The field is `PARTIAL →
  REWIRE`.
- **Nothing can verify a GSTIN.** The only external integration is the Zoho
  bridge, and it writes sales orders. Verification is `NEW` and simulated,
  behaving like the eventual contract (D-012's rule).

### Rejected

| Rejected | Why |
| --- | --- |
| Keeping the reference's Sign Up screen | It asks an authenticated user to create the account they already have |
| A separate GST verification screen | One field does not need a journey, and the result has to return to S01 anyway |
| Asking for business details the verification could return | That is the hypothesis inverted — typing what the system just looked up |
| Rewriting Stage 1 of the Flow Map silently | The ideal is never tidied to fit the product. This was a wrong *premise*, so it is amended and the amendment says so |

### Still open

- **Where the signed-in user comes from.** master has no user model, no session
  and no tenant creation; `modules.json` hard-codes one operator. Authentication
  is now a premise of this design and has no home in the product.
- **The tenant's GSTIN is the wrong state.** `orgGstNumber` is `27…`
  (Maharashtra), inherited from the QA store, while Miha's shops are `18…`
  (Assam). If S01 shows it back, it shows the wrong state.
- **What a real GST lookup returns**, and therefore how much of S01 it can fill.


## D-015 · 2026-09-16 · DECIDED · evidence determines capability, not admission
by: Nishant Devekar · supersedes in part: D-013 · design: `design/ux/O-001/FLOW-MAP.md` · reference: the Control Tower / First Snapshot clickable wireframe

### Decided

**Missing evidence does not block the first useful Business Pulse. It reduces
the set of signals FoodBridge can honestly compute.**

This supersedes D-013's rule that missing required data blocks Continue.
Suppliers, Staff, Invoices and Payments are no longer admission criteria.

**Two axes, and they never merge:**

| | Business context | Snapshot evidence |
| --- | --- | --- |
| Products · Customers · Suppliers · Staff | Sales/Orders · Invoices · Payments |
| *describes* the business | *proves* what happened |
| missing → a coarser picture | missing → whole signals disappear |

**The evidence floor** is the only thing that stops the journey: at least one
entity master, and at least one transactional series over time. Below it,
FoodBridge asks for evidence. Above it, FoodBridge proceeds and discloses what
is missing.

**Business Data Check stops being a checklist** and answers three questions:
what does FoodBridge have · what can it understand · what would more unlock.
Every gap shown carries a named unlock — *Invoices · Missing · unlocks
receivables and collections* — and a way to close it: connect, upload, or
photograph. **A field existing in the backend is not a reason to ask for it.**

**The UI must never show** an unavailable metric as zero, an invented metric,
another tenant's data, or generic "complete your setup" language. Absent means
absent.

**For Miha's specifically**, the evidence supports order cadence, stock
position, reorder prediction and slow-stock count. Receivables, collections,
capital-tied-in-₹, margin and purchase exposure are **not exposed**, because the
evidence for them does not exist.

**The screen budget is a direction, not a decision.** Three screens minimum plus
a conditional fourth; the standing rule is that a screen earns its existence
from a genuinely different decision or state, and that rule outranks the count.

### Why

The Control Tower reference establishes sales + invoices + payments as the
evidence behind *its* first snapshot. It does not follow that every FoodBridge
customer must hold all three before FoodBridge can be useful — and Miha's, the
only real tenant on file, holds exactly one of them.

Under D-013 that business would have been blocked at the door by data it does
not have and may never have. Under this model it gets a truthful first view
built on two years of real trading, and is told plainly what invoices and
payments would add.

The failure this avoids is the one L-005 already records: a product that fills a
gap with a plausible number loses the customer the first time they catch it. The
corollary, newly stated: a product that refuses to speak because a field is
empty loses them before it ever says anything.

### Rejected

| Rejected | Why |
| --- | --- |
| Treating all six datasets as equally required | Conflates describing a business with proving what happened in it |
| Blocking until invoices and payments exist | Miha's would never pass, and its two years of real orders say plenty |
| Showing blocked metrics as ₹0 or greyed cards | A zero is a claim. Absence is the truth |
| Borrowing the bakery tenant's payments to fill receivables | Another business's money on this business's screen |
| The reference's `82%` coverage score | A score invites optimisation and reads as unfinished setup. Words can be checked; a percentage cannot |
| Listing every empty backend field as a gap | A gap that unlocks nothing nameable is nagging, not help |
| A separate snapshot-setup journey | The user must never see the seam between onboarding, ingestion, computation and Control Tower |

### Consequence worth knowing

The strongest truthful signal for Miha's is **order cadence, not cash**. The
first action a customer is offered will be about shops that have not reordered
— not about money owed. If the session shows owners do not find that compelling,
that is evidence about the evidence: it would say the receivables half is the
part that matters, and that getting real invoice and payment data is the
priority, rather than that the onboarding design is wrong.

### Still open

- The floor — one master plus one transactional series — is reasoned, not
  tested. No customer has been watched hitting it.
- What a business *below* the floor is shown is undesigned.
- Whether Miha's should get a fresh Zoho export including invoices and payments,
  which would unlock the entire receivables half of the Control Tower.
- The action → outcome → next-snapshot loop is out of scope for this version.
  The design must not foreclose it.


## D-016 · 2026-09-16 · DECIDED · the cadence rule is reproduced, not imported, and the locked mapping stands
by: Nishant Devekar · version: v5 · design: `design/ux/O-001/FLOW-MAP.md` (locked e14f20ea96ee5c51)

### Decided

**`orderingStatusFor()` cannot be called from the onboarding page.**
`stock-audit.js` is wrapped in an IIFE whose only export is
`window.SAH = { mount }` (`:4490`); the function is closure-private at
`:1061`.

Three things follow:

1. **The locked UX mapping is not edited.** It records `orderingStatusFor` as
   `REUSE`, and as a statement about the product that is true: the logic
   exists, it is proven, and the onboarding view is built on the same rule.
2. **The rule is reproduced in v5's new evidence layer**, read from
   `window.FB_ORDER_HISTORY` — the same data the Stock Audit page itself
   adopts as `SEED.orderingSignals` (`seed.inline.js:368`).
3. **What genuinely is importable stays imported**: `window.SEED`,
   `window.FB_ORDER_HISTORY`, `window.FB_PREDICT`, `window.FB_SHELL`,
   `window.FB_ICONS`, and the design tokens in `styles.css`.

### Why

A mapping verdict and an import path are two different facts. The mapping
answers *does this capability exist in the product* — it does. The constraint
answers *can this page call it* — it cannot. Editing the locked mapping to
record a build detail would rewrite what was approved at GATE B, and the lock
exists precisely so that cannot happen quietly.

### Rejected

| Rejected | Why |
| --- | --- |
| Exporting `orderingStatusFor` from `stock-audit.js` | That file is in master and in front of reps. Changing client-tested code for an internal convenience is a product change with no product reason |
| Copying `stock-audit.js` into the onboarding module | 4,490 lines of field-tool views to obtain one function, and two copies of a page that must not drift |
| Editing the locked mapping's REUSE verdict | The mapping is not wrong. The lock is not a draft |
| Inventing a simpler cadence rule | Two different definitions of "overdue" in one product is how a number stops meaning anything |

### Consequence worth knowing

**One rule now has two implementations, and they must agree.** The thresholds
are Overdue at more than 5 days past expected, Slipping at 1–5, On Track
otherwise, against each customer's own median cycle. If either copy changes,
the other is wrong — and the onboarding figure and the field tool would
disagree about the same shop on the same day.

### Still open

- Whether the rule should eventually live in one shared, UI-free module that
  both pages load. That is a refactor of a page in master, so it is a separate
  decision nobody has asked for yet.


## D-017 · 2026-09-16 · DECIDED · the first action is an opportunity, not a module
by: Nishant Devekar · supersedes in part: the S04 handoff in lock e14f20ea96ee5c51 · reference: the Control Tower / First Snapshot clickable wireframe

### Decided

**S04 ends by opening an opportunity FoodBridge has already reasoned through —
never by dropping the user into an existing module.**

The locked UX ended S04 with an action that routed to Stock Audit & Health.
That is a rep's field tool, opened on nothing in particular, leaving the user
to find the 23 shops and work out what to do for themselves. The reference is
explicit that this is the wrong move: *recommend a narrow collection workflow
rather than asking you to configure the full module.*

The post-S03 journey therefore becomes:

```
DATA → BUSINESS UNDERSTANDING → OPPORTUNITY → RECOMMENDED ACTION → OUTCOME
S03                        S04            S05 state 1        S05 state 2
```

**A fifth screen, S05**, with two states: the opportunity opened narrowly, and
what was recorded once it is confirmed. Four becomes five; the screen budget is
re-argued in the Flow Map rather than quietly exceeded.

**What S05 shows, per shop, from evidence only:** that shop's own median cycle,
how many days past due it is, and what it factually buys most — all from
`order-history.js`. **A proposed reorder appears only where
`FB_PREDICT.generatePredictiveOrder()` returns `ok === true` AND
`context.historyIsStale === false`.**

**Shops arrive pre-selected and stay adjustable.** FoodBridge did the
reasoning; making the user rebuild it is what this screen exists to prevent.

**Recording the follow-up is simulated**, and the next snapshot is not built.
The journey names the loop so the design does not foreclose it; only the first
action exists in this version.

### Why

The success test was: *when the user reaches Business Pulse they should feel
FoodBridge has already understood something important and has one concrete
thing worth doing.* A signal followed by a link to a module fails that test —
it says "here is something true, now go and deal with it".

### The consequence that shaped the design

**16 of the 23 overdue shops can carry a proposed reorder. Seven cannot.**

A shop is overdue *because* it stopped ordering, and that is exactly what makes
its history stale. The three most overdue — 171, 114 and 105 days past due —
all come back `ok: true, historyIsStale: true`. So the engine's own contract
falls silent on the shops the opportunity is most about.

Those seven show what they factually used to buy and **no proposed
quantities**. Presenting a stale pattern as a current proposal would be the
trust failure L-005 records, wearing the costume of helpfulness.

### Rejected

| Rejected | Why |
| --- | --- |
| Keeping the handoff to Stock Audit & Health | A module is a place; an opportunity is a decision already reasoned through |
| Showing a proposed reorder for all 23 | The seven most overdue are exactly the ones the engine says it cannot speak currently about |
| Fabricating receivables, collections, margin or capital-tied figures to match the reference's Control Tower | None is computable for this tenant. D-015 already settled this and it is not reopened |
| A sixth screen for the confirmation | Nothing is decided on it. It is a state of S05, by the same rule that made S03 conditional |
| An empty list the user builds | That is the work FoodBridge was supposed to have done |

### Still open

- Whether a follow-up is even the right action for a shop that went quiet.
  Calling, messaging and proposing an order are three different moves, and
  nobody has watched a customer choose between them.
- What a second snapshot compares against, and where the outcome is stored.
- **The UX lock was re-opened to make this change** (`ux.py review O-001`) and
  must be re-approved before any of it is built.


## D-018 · 2026-09-16 · DECIDED · the user drives every operation, and primary screens carry must-have only
by: Nishant Devekar · design: `design/ux/O-001/FLOW-MAP.md` (LOCKED)

### Decided

Two rules, and the production behaviour that follows from them.

**RULE 1 — MUST-HAVE ONLY on primary screens.** Every visible element must
explain the current state, support the current decision, or enable the current
action. Anything else moves to a contextual sheet or is cut. Primary screens
are icon-led and scannable: **one dominant message, one dominant action,
minimal supporting data**, in the order **HEADLINE → KEY FACT → ACTION**.
Ambiguity is never solved by adding a subtitle, paragraph, explanation,
reassurance, methodology, secondary metric or instruction. Sheets carry: why
FoodBridge thinks something · supporting evidence · record previews ·
calculation context · draft detail · secondary actions · recovery.

**RULE 2 — the user starts every consequential operation.** Timers may stand in
for backend work *only after* an explicit start, and every running operation is
cancellable.

**What follows:**

| | |
| --- | --- |
| **Sources** | a tap opens **consent** — what is read, what never changes — and the user connects. Files opens a real picker with the camera. Nothing reads on a tap of a logo |
| **Sample mode** | a first-class answer to "where does your business live", not a URL flag. Persistent **amber** provenance, never green. No silent switch either way; leaving the sample discards what was derived from it, and says so first |
| **Inspection** | each figure on S03 opens ~5 representative records, the total and the provenance. A sheet, not a browser |
| **Reasoning** | S04 keeps a headline that carries its own fact — *23 shops are past their usual order date* — and one action. **Usual is per shop**; how that date is derived, plus cycle, last order, affected shops and coverage, move behind *Why this matters* |
| **S05 entry** | a **brief** — *23 stopped · 16 we can prepare · 7 need your eye* — never a selection task |
| **Recommendation** | marked, and **never pre-selected**. Selecting all sixteen is one deliberate tap |
| **The stale seven** | offered *repeat their last order* — a fact, not a prediction, and never called a recommendation |
| **The action** | **prepare draft reorders**. `suggestedQty` stays immutable beside an editable `qty` |
| **Completion** | *prepared*, never *started*. Primary next action: **Review drafts** |
| **Persistence** | mode and prepared drafts survive a reload; discarding is explicit |
| **Progress** | onboarding is Steps 1–3. S04 and S05 carry no counter |

Five primary screens, unchanged. Nine contextual sheets. Twenty-one flow nodes.

### Why

The machine review showed the journey was *click → timer → screen → click*. The
user initiated almost nothing consequential: a source tap began a read, a fake
1500ms stood in for an input the user never made, and "Follow up with 23 shops"
confirmed an action nobody had defined over shops nobody had chosen.

Rule 1 exists because of a pattern in my own work across the last three passes:
when a screen felt unclear I added a sentence. Eleven elements are moving into
sheets and seven are being cut, and most of them are copy written to make a
screen feel considered. **Explanation is the easiest thing to add and the
hardest to justify.**

### Rejected

| Rejected | Why |
| --- | --- |
| A screen per state | Nine of them are deeper looks at a decision already in progress. That is what a sheet is for |
| Pre-selected recommendations | Presents the machine's opinion as the user's choice |
| "Started Today" | Claimed an external action over a prototype that persisted nothing |
| A hidden `?evidence=none` flag as the sample path | Invisible to the person who most needs it |
| Editing `suggestedQty` in place | Destroys the only record of what FoodBridge actually proposed |
| A "needs review" bucket with no action | A label is not an outcome |
| Solving ambiguity with more copy | The habit this rule exists to break |

### Production UX Contract v2 — the implementable form

Ten clauses. Every one is observable in the running prototype, which is what
makes this a contract rather than a description.

| # | Clause | What it forbids |
| --- | --- | --- |
| **C1 Initiation** | No consequential operation begins without a user gesture that names it. Tapping a source opens consent; **Connect** starts the read | A tap on a logo starting a read |
| **C2 Progress** | A running operation shows what it is doing now and what it has finished, from real record counts, never a bar that fills on a timer alone | A spinner that means nothing |
| **C3 Cancellation** | Every running operation is cancellable, returns to where it started, and keeps nothing | An operation the user cannot stop |
| **C4 Failure** | Failure is a state with a cause and a way out, never a dead end. The user chooses the way out | Failing silently into a success screen |
| **C5 Retry** | Retry re-runs the same operation from the same gesture. It never resumes a partial read | "Try again" that skips to the end |
| **C6 Provenance** | `SAMPLE` and `SOURCE-CONNECTED` are distinct, persistent and visible on **every** screen after S02. Sample is amber, never green. Leaving sample discards what was derived from it, and says so first | A sample that looks like the user's own business |
| **C7 Persistence** | Mode and **confirmed** drafts survive a reload. Nothing else does. Discarding is explicit | A reload that silently resurrects an abandoned selection |
| **C8 Navigation** | Back closes a sheet before it leaves a screen. Leaving a screen with unconfirmed work asks first | A back gesture that destroys work without asking |
| **C9 Truthful completion** | Completion names what actually happened. Drafts are **prepared** and **held**; sent and written counts are shown and are zero | "Started Today" over a prototype that sent nothing |
| **C10 Placement** | Primary screens carry state, decision and action only, icon-led. Explanation, evidence, previews, method, detail, secondary actions and recovery live in sheets | Solving ambiguity by adding a sentence |

**The operations this applies to**, each with its start gesture:

| Operation | Starts on | Cancellable | On failure |
| --- | --- | --- | --- |
| Read a connected source | **Connect** in the consent sheet | yes | cause + *Try again* / *Another way* |
| Read chosen files | **Read them** in the file sheet | yes | as above |
| Enter sample mode | **Use the sample** in its consent sheet | n/a — instant | n/a |
| Add evidence below the floor | **Choose and read** | yes | as above |
| Prepare drafts | **Prepare N drafts** in the confirm sheet | yes | cause + *Try again*, selection intact |

**The draft contract.** `suggestedQty` is immutable and always visible beside an
editable `qty`; a draft records which of the two it carries. The seven stale
shops are offered **repeat their last order** — a fact, never a recommendation,
and never counted among the sixteen. A prepared draft is held for review, sent
to nobody, and written to no accounting system.

### Resolved at the lock

- **Sample mode reuses the same fixture records.** Accepted. D-013 forbids
  borrowing another tenant's data and fabricating a business is a worse lie than
  a shared fixture; C6 carries the honesty instead, by marking the mode
  permanently rather than by changing the numbers.
- **`sessionStorage`** is accepted for **confirmed drafts and mode only** (C7).
  It is the narrowest form of the mechanism that makes a reload survivable.
- **The five sketches were redrawn** against this decision before the lock, so
  the lock freezes the current drawings.

### Status

**DECIDED.** `O-001` is locked against the redrawn sketches and this contract.
Implementation follows in v5, and the UX does not reopen unless implementation
reveals a contradiction with a clause above.

---


## D-019 · 2026-09-16 · DECIDED · v5's front door opens on onboarding, not the dashboard

### What happened

5.1 was published and the URL handed out for it — `/v5/` — landed on the
platform shell's default destination, the **dashboard**: a populated business
with existing customers, orders and stock. v5 is testing *the first session
after signing up*. The first thing a new distributor saw was therefore a
business they had never entered, which is the premise of the experiment
contradicted on the opening screen.

The build was not wrong. `versions/v5/STATUS.md` has always documented the flow
as living at `index.html#/onboarding`, and onboarding is deliberately
`standalone` — it is not an admin sub-screen and does not belong in the
sidebar. What was wrong is that the version's own recorded `publishedUrl` did
not reach the version's experiment.

### What was decided

**A bare `/v5/` opens onboarding.** The shell gains a `landing` key, read from
`modules.json`, which lets a version name where a visitor arrives when the
sidebar's first entry is not it. Onboarding claims the landing **without
joining the sidebar** — which is the whole point of being standalone.

Shipped as **5.2**, because navigation is something the customer sees. 5.1 is
frozen at `/v5.1/` and does not move.

### What was rejected

- **Keeping `/v5/` on the dashboard and handing testers the deep link
  `/v5/#/onboarding`.** Defensible — the dashboard is where onboarding hands
  off to at the end — and it needed no new release. Rejected because the URL a
  version records for itself should reach that version's experiment, and
  because a link that has to be explained is a link somebody will eventually
  send without the explanation. The first moment of a first-session test is the
  one moment that cannot be re-run.
- **Putting onboarding in the sidebar** so it would become `order[0]`
  naturally. Rejected: it would make onboarding look like a destination the
  user can return to, which it is not, and it contradicts D-018's standalone
  decision for no gain.
- **Calling it mechanical.** It changes navigation. Mechanical is wording only,
  and size decides nothing.

### Status

**DECIDED.** Implemented in 5.2. The Flow Map is unchanged — F01 was always the
entry, and this is the product finally opening there.

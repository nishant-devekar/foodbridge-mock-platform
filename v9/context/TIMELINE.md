# v5 — timeline

**The product history of this version.** Why it started, what was decided, what
customers did, what it taught us. Append-only: nothing here is ever edited or
removed, because a decision that was later reversed is the most useful thing
this file can tell the next person.

Each entry is a small story rather than a log line — **what** happened, **why**,
and what it **resulted in**:

```
## 2026-08-27 · DECISION
Final order editing stays in FoodBridge
why: reps were re-typing quantities in two places
result: the quantity field goes inline on S02; Zoho is read-only in this flow
→ research/DECISIONS.md#D-008
```

`why:` and `result:` are optional — "published" needs neither — but where they
are relevant they are what makes this readable to someone who was not there.

Not a git log. No commits, no branches, no file lists, no cache bumps.

*(written by `python3 tools/version.py note v5 <EVENT> --summary "…"
--why "…" --result "…"`)*

## 2026-09-16 · CREATED
Based on master
why: A new FoodBridge signup — the owner or back-office person at a small or mid-sized distributor — already keeps customers, products and suppliers in Tally, Zoho, Vyapar, Excel or in invoices and challans. Done when FoodBridge holds that business, they can see it was understood correctly, and they have taken one meaningful first action — without re-entering by hand what they already have.
result: ready to build — O-001's UX was already approved
→ versions/v5/version.json

## 2026-09-16 · USE_CASE_DEFINED
A new FoodBridge signup — the owner or back-office person at a small or mid-sized distributor — already keeps customers, products and suppliers in Tally, Zoho, Vyapar, Excel or in invoices and challans. Done when FoodBridge holds that business, they can see it was understood correctly, and they have taken one meaningful first action — without re-entering by hand what they already have.
why: tested in this situation: The first session after signing up: the owner or back-office person of a small or mid-sized distributor, on a phone, minutes after creating their account, with their customers, products and orders already in Tally, Zoho, Vyapar, or a folder of invoices and challans.
result: what a customer session on this version has to be set up to show

## 2026-09-16 · HYPOTHESIS_DEFINED
A new distributor who already has business data in an existing system or files can get to a meaningful first action in FoodBridge in one onboarding session, with minimal manual data entry, because FoodBridge does the ingestion and setup work for them.
result: this is the sentence a session can disprove; if it survives, the version taught us something

## 2026-09-16 · LEARNING
L-012 — A distributor signing up for FoodBridge already holds their customers, products and suppliers in another system or in documents, and being asked to re-enter them is the setup friction that delays first value.
why: basis INFERRED
→ research/LEARNING.md#L-012

## 2026-09-16 · LEARNING
L-013 — Showing a new customer a useful insight about their own business straight after their data is imported makes the setup effort feel worthwhile.
why: basis INFERRED
→ research/LEARNING.md#L-013

## 2026-09-16 · OPPORTUNITY
O-001 — the job this version was designed for
→ research/OPPORTUNITIES.md#O-001

## 2026-09-16 · UX_LOCKED
4 screen(s), approved by Nishant Devekar on 2026-09-16
why: the product person walked the flow and the screens and said yes — GATE B
result: this is what gets built, and what a customer will see
→ versions/v5/ux/FLOW-MAP.md

## 2026-09-16 · VERSION_READY
Implementation unblocked (e14f20ea96ee5c51)
why: the definition is complete and the UX is approved
result: build only the path the hypothesis needs

## 2026-09-16 · IMPLEMENTATION_STARTED
The evidence layer — what FoodBridge has, what it can honestly compute, and what more would unlock
why: S03 and S04 are both derived from it, so it is built and proved before any screen exists
result: computable for this tenant: order cadence, stock position, reorder readiness, slow-stock count. Blocked and therefore absent: receivables, collections, overdue value, capital tied, margin, purchase exposure

## 2026-09-16 · IMPLEMENTATION_STARTED
The four locked screens are built and wired at #/onboarding
why: GATE B approved the UX on 16 September; this is that flow drawn, with every external boundary simulated and labelled
result: S01 profile with inline GST verify, S02 source select with the read in place, S03 conditional on the evidence floor with both states, S04 ranked from computable signals only. Receivables and margin absent for want of evidence

## 2026-09-16 · UX_CHANGED
Onboarding redrawn in FoodBridge's own visual language
why: the first pass converted the low-fidelity sketches straight into markup; the sketches settle information architecture, content, states and behaviour, not visual design
result: same four screens, same copy, same states and same behaviour, now with the product's brand bar, step context, icon-led cards, floating-label inputs and green primary action. No change to the locked Flow Map

## 2026-09-16 · UX_CHANGED
Onboarding refined: grouped identity, distinct sources, evidence that reads as understood
why: five identical fields, four identical source rows and three equal signal cards gave every screen one flat level, so nothing led
result: S01 groups business and contact; S02 gives each source its own mark; the read is a process timeline; S03 shows evidence as figures with options subordinate on muted ground; S04 has one dominant insight over supporting rows and a secondary text link

## 2026-09-16 · UX_CHANGED
Replaced by O-001 lock 0ff5a4347c695a6b
why: a different design was approved for this version
result: the earlier flow and sketches are no longer what gets built
→ versions/v5/ux/FLOW-MAP.md

## 2026-09-16 · OPPORTUNITY
O-001 — the job this version was designed for
→ research/OPPORTUNITIES.md#O-001

## 2026-09-16 · SKETCHES_CREATED
5 low-fidelity screen(s), one per visible flow node
why: a flow nobody can see is a flow nobody reviewed
→ versions/v5/ux/screens/

## 2026-09-16 · UX_LOCKED
5 screen(s), 13 flow node(s), approved by Nishant Devekar on 2026-09-16
why: the product person walked the flow and the screens and said yes — GATE B
result: this is what gets built, and what a customer will see
→ versions/v5/ux/FLOW-MAP.md

## 2026-09-16 · VERSION_READY
Implementation unblocked (0ff5a4347c695a6b)
why: the definition is complete and the UX is approved
result: build only the path the hypothesis needs

## 2026-09-16 · UX_CHANGED
The first action became an opportunity: S05, built on real cadence and buying history
why: S04 previously handed the user to a module and left them to work out which shops and what to do — the failure the Control Tower reference names outright
result: Start here opens the 23 overdue shops pre-selected, each with its own cycle, days overdue and usual products; a suggested order appears for the 16 the engine will speak currently about; confirming records the follow-up and names the next-snapshot loop. D-017, lock 0ff5a4347c695a6b

## 2026-09-16 · UX_CHANGED
Replaced by O-001 lock b556ecf1e4cdbe35
why: a different design was approved for this version
result: the earlier flow and sketches are no longer what gets built
→ versions/v5/ux/FLOW-MAP.md

## 2026-09-16 · OPPORTUNITY
O-001 — the job this version was designed for
→ research/OPPORTUNITIES.md#O-001

## 2026-09-16 · SKETCHES_CREATED
5 low-fidelity screen(s), one per visible flow node
why: a flow nobody can see is a flow nobody reviewed
→ versions/v5/ux/screens/

## 2026-09-16 · UX_LOCKED
5 screen(s), 21 flow node(s), approved by Nishant Devekar on 2026-09-16
why: the product person walked the flow and the screens and said yes — GATE B
result: this is what gets built, and what a customer will see
→ versions/v5/ux/FLOW-MAP.md

## 2026-09-16 · VERSION_READY
Implementation unblocked (b556ecf1e4cdbe35)
why: the definition is complete and the UX is approved
result: build only the path the hypothesis needs

## 2026-09-16 · IMPLEMENTATION_STARTED
The five screens and nine sheets of the D-018 build
why: the locked UX needed the must-have rule carried into the implementation, not just the sketches
result: the whole journey runs on a phone — profile to 16 prepared drafts; two dead controls found and fixed in the process

## 2026-09-16 · PUBLISHED
5.1 — The first release: signup to a prepared reorder, in one session
why: the locked UX is built and the whole journey runs on a phone
result: customers on 5.1; /v5.1/ is frozen and /v5/ follows the current release
→ versions/v5/releases/5.1.json

## 2026-09-16 · ITERATION_STARTED
5.2 — a new distributor opening /v5/ landed on a populated dashboard of an existing business — the opposite of the first session after signing up
result: the UX for 5.2 has to be frozen before it can be built
→ versions/v5/ux/FLOW-MAP.md

## 2026-09-16 · VERSION_READY
Approved by Nishant Devekar — 5 screen(s), use case and hypothesis defined
why: the product person walked it and said yes — GATE B
result: implementation is unblocked
→ versions/v5/ux/FLOW-MAP.md

## 2026-09-16 · PUBLISHED
5.2 — A bare /v5/ opens onboarding, not the dashboard
why: a new distributor's first session was starting on a populated business they had never entered
result: customers on 5.2; /v5.2/ is frozen and /v5/ follows the current release
→ versions/v5/releases/5.2.json

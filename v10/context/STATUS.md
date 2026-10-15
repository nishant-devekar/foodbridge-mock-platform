# v5 — status

| | |
| --- | --- |
| **State** | `CREATED` — not yet in front of anyone |
| **Ready to build** | `READY_FOR_IMPLEMENTATION` — the UX was approved at GATE B |
| **Owner** | nishant-devekar |
| **Use case** | A new FoodBridge signup — the owner or back-office person at a small or mid-sized distributor — already keeps customers, products and suppliers in Tally, Zoho, Vyapar, Excel or in invoices and challans. Done when FoodBridge holds that business, they can see it was understood correctly, and they have taken one meaningful first action — without re-entering by hand what they already have. |
| **Scenario** | The first session after signing up: the owner or back-office person of a small or mid-sized distributor, on a phone, minutes after creating their account, with their customers, products and orders already in Tally, Zoho, Vyapar, or a folder of invoices and challans. |
| **Published at** | *(not published)* |
| **Customers** | *(none recorded)* |
| **Data** | `SEEDED` |
| **Integrations** | *(none)* — every external boundary in this flow is simulated, see below |
| **Learning** | L-012, L-013 |
| **UX** | O-001 — locked e14f20ea96ee5c51, 4 screen(s), in `ux/FLOW-MAP.md` |

## The hypothesis under test

> A new distributor who already has business data in an existing system or files can get to a meaningful first action in FoodBridge in one onboarding session, with minimal manual data entry, because FoodBridge does the ingestion and setup work for them.

## Active experiments

**Can a distributor who already has their data elsewhere reach one meaningful
action in a single session, with almost no typing?** That is the hypothesis
above, and the flow is built so a session can disprove it.

What to watch, in order:

1. **Do they trust what S03 shows them?** It states what was found and what is
   still missing, each gap naming what it would buy. If they don't believe the
   counts, nothing downstream matters.
2. **Does S04 land as "here's what matters" or as analytics?** The dominant
   signal is whichever the evidence ranks first — today *"23 shops haven't
   ordered as usual"*. If they read past it to hunt for money figures, the
   cadence story is not the one they came for.
3. **Do they take the action, or skip?** Skipping is a real answer and is
   deliberately possible; forcing it would corrupt the measurement.
4. **Where do they stall?** D-015 removed the blocking gate, so nothing stops
   them above the floor. If they stall anyway, it is comprehension, not a gate.

## Known limitations

**Everything a customer might mistake for the real thing, said plainly.**

**These are NOT captioned on the screens.** The customer-facing UI carries no
prototype or debug language, so *whoever runs a session has to say out loud
what is simulated* — this table is the record, not the screen. What the flow
will never do is invent a result to cover for a boundary: offer it a document
and it reports that nothing could be read, rather than producing a figure.

| Boundary | Status | What actually happens |
| --- | --- | --- |
| Tally / Zoho / Vyapar connection | `SIMULATED` | Nothing is contacted. Choosing a source runs a staged progress state and then reveals the records this repository already holds. It does not pretend to have fetched them. |
| Document upload · photograph · scan | `SIMULATED` | The interaction is real and mobile-ready; the ingestion is not. The flow runs extract → map → validate and then says nothing could be read, because no invoice or payment data exists here to find. |
| Extraction · mapping · validation | `SIMULATED` | A system state, never a screen, exactly as the locked Flow Map requires. |
| GST verification | `SIMULATED` | Nothing is looked up. Any 15-character GSTIN is accepted; the business name is then filled from this tenant's own seed rather than invented. |
| Recording a follow-up | `SIMULATED` | S05's confirm records nothing beyond the session. What comes back is exactly what was selected — no figure is invented — and the next snapshot is not built. |
| Products · customers · orders | **REAL** | 86 products, 40 B2B shops, and 532 orders across 39 of them — the tenant's own Zoho export, two years to 2026-08-24. |
| Cadence · stock · reorder signals | **REAL** | Computed from those records at render time against the live clock. Every figure moves with the calendar. |
| Receivables · collections · overdue value · capital tied · margin | **ABSENT** | No invoice, payment or cost evidence exists for this tenant, so these are not drawn at all — not zeroed, not greyed, not promised. |

### The journey, as built

```
S01 profile → S02 source → (read) → S03 evidence check → S04 Business Pulse
                                                            ↓ Start here
                                          S05 the opportunity → confirm → recorded
```

**S04** explains the strongest truthful signal — what FoodBridge noticed, why it
matters, where to look — and offers one **Start here**. **S05** opens that
opportunity narrowly: the 23 shops past their own cycle, longest overdue first,
each with its cadence, days overdue, what it factually buys, and a suggested
order **only for the 16 where `FB_PREDICT` returns `ok` and the history is not
stale**. Shops arrive pre-selected. Confirming moves the same screen to its
recorded state and names the next-snapshot loop.

**The seven shops with no suggested order are the most overdue ones** — a shop
goes stale precisely because it stopped ordering. They show what they used to
buy and no quantities (D-017).

### Prototype entry points

| URL | Shows |
| --- | --- |
| `index.html#/onboarding` | the flow, in the platform shell, full-bleed |
| `modules/foodbridge-onboarding/screens/onboarding.html` | the same flow standalone, for phone testing |
| `…/onboarding.html?evidence=none` | the **below-floor** state of S03. It withholds the order history so that branch can be walked; it never adds fabricated data |

### Two things a session should not be surprised by

- **The dominant signal is cadence, not cash.** Every rupee figure the Control
  Tower reference leads with is unavailable here, and D-015 records why.
- **`orderingStatusFor()` has two implementations** — the field tool's and the
  evidence layer's (D-016). They agree today. If one changes the other is
  wrong, and the two screens would disagree about the same shop.

## Customer learnings

*(fill in after each session — this is the output of the whole exercise)*

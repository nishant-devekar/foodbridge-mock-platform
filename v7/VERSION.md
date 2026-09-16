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

**Mobile is the target.** 375×812 is what it was designed and reviewed against.

## What is real, and what is not

Everything behind the flow is **simulated**, and the product says so in its own
words rather than in a footnote:

| | |
| --- | --- |
| Connecting to Tally / Zoho / Vyapar | `SIMULATED` — the interaction is real, the ingestion is not |
| Extraction, mapping, validation | `SIMULATED` |
| GST verification | `SIMULATED` — nothing is looked up |
| Draft preparation | `SIMULATED` — drafts are held in the browser, sent to nobody, written to no accounting system |
| The order history behind the insight | **real** — 532 orders, 3,931 lines, 39 of 40 shops, Aug 2024 → Aug 2026, from the tenant's own Zoho export |
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

# FoodBridge mock platform — Version 7

**Opened 16 September 2026, carried over from `exagon-ai/foodbridge-pmf` — its `v5`,
release `5.2`, at commit `ae311d3`.** 245 files, 8.7 MB, self-contained.

## v7 is not the next full-platform cut, and does not supersede v6

Read that first, because the number says otherwise.

`v6` is still the working cut. It is the whole platform — sidebar, routing, 26
destinations — and it is where current platform work lands. Nothing here changes
that.

`v7` is a **narrow product experiment**, carried across from the PMF repository so
its reasoning is readable beside the platform it was designed against. It tests
one job, in one flow:

> A new distributor who already has their business in Tally, Zoho, Vyapar or a
> folder of invoices can reach a meaningful first action in FoodBridge in one
> session, without re-entering by hand what they already have.

It is here to be **referred to**, not continued. Work that would change it belongs
in `foodbridge-pmf`, where it carries its lifecycle, its release manifests and its
customer URL. Changing it here would fork an experiment away from the evidence it
was built on.

## What it is

Five primary screens and nine contextual sheets.

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
key from `assets/modules.json`. Onboarding claims the landing *without* joining
the sidebar — it is not a place the user comes back to. That was the last change
made before this was carried over, and the reason for it is `D-019` in
[`context/`](context/DECISIONS-D-012-to-D-019.md): a new distributor was landing
on a populated business they had never entered, which contradicts the premise of
the experiment on its opening screen.

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
| The reorder engine | **real** — the back-tested predictor, 66.5% precision / 69.6% recall on 171 unseen 2026 orders |

The confirm sheet names what does *not* happen — nothing sent to a shop, nothing
written to an accounting system — and the prepared screen repeats it as an
outcome: held 16, sent 0, written 0.

**There is no rupee figure anywhere in the flow.** This tenant has no invoices, no
payments and no cost price, so receivables, collections, capital-tied and margin
are not computable. They are absent rather than shown as ₹0, because a zero would
be a lie about what we hold. `context/STATUS.md` has the capability matrix.

## Nobody has used it

The hypothesis is unvalidated. No distributor has been recruited and no session
has been run. Published, in this context, means it has a URL — not that it has
been tested.

## What came with it

```
index.html  assets/  modules/  vendor/  flows/     the runnable cut
ux/FLOW-MAP.md                                     the one canonical UX artifact
ux/screens/*.svg                                   five low-fidelity sketches, 390x844
context/                                           why it is like this
```

`context/` holds the records the build cites, copied from the PMF repository as
reading copies — the ledgers there remain the source:

| | |
| --- | --- |
| `OPPORTUNITY-O-001.md` | the job somebody decided to design for |
| `LEARNING-L-012-L-013.md` | the learning it exists because of, with every dated occurrence |
| `DECISIONS-D-012-to-D-019.md` | eight decisions, each keeping **what was rejected** — the half that does not survive in code |
| `TIMELINE.md` | the version's product history, append-only |
| `STATUS.md` | what is real, what is simulated, what is known broken on purpose |
| `PROVENANCE.md`, `CHANGELOG.md`, `MASTER.md` | where its files came from |
| `VERSION-pmf.md` | the PMF-side version document, kept verbatim |
| `version.json`, `releases/` | **inert here.** They are PMF lifecycle state and release manifests; the commit shas in them refer to `exagon-ai/foodbridge-pmf` and cannot be rebuilt from this repository. Kept as evidence of what was published, not as machinery |

## Changes

### 16 September 2026 — carried over

Copied whole from `foodbridge-pmf` `versions/v5/` at release `5.2`. Nothing in the
runnable cut was modified: the bytes are the bytes a customer would be served at
`/v5/` there. The PMF-side records were moved into `context/` so nothing in this
repository mistakes a lifecycle file for live machinery, and `README.md` and this
document were written for this repository's conventions.

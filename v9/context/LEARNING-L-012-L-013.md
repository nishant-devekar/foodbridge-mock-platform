# Learning L-012 and L-013 — why v7 exists

Copied from `research/LEARNING.md` in `exagon-ai/foodbridge-pmf`.
A learning is a claim plus every dated occurrence underneath it; both are kept
here. The ledger there is the source and may have gained occurrences since.

---

## L-012 · INSIGHT · INFERRED · OPEN
date: 2026-09-16 · reviewed: 2026-09-16 · confidence: LOW
topics: onboarding, data-import
versions: v5 · opportunities: O-001
relates: RELATED L-009

### Statement

A distributor signing up for FoodBridge already holds their customers, products and suppliers in another system or in documents, and being asked to re-enter them is the setup friction that delays first value.

### Evidence

#### E1 — 2026-09-16 · INFERRED · unattributed · research/inbox/2026-09-16-nishant-onboarding-brief.md

Product owner's brief, not a customer: "Customers already have business data somewhere. Asking them to recreate that data inside FoodBridge creates unnecessary friction." (L114-116). Sources named: Tally, Zoho, Vyapar, Excel/CSV, invoices/challans/POs, manual records.

### What we don't know

No distributor has been heard or watched on this. Which systems new customers actually use, in what proportion; whether their data there is clean enough to import without correction; whether they would grant a connection to their accounting system at signup, before trusting FoodBridge.

### Product implications

None yet. Candidate ground for a new-user onboarding version (U-001).


## L-013 · INSIGHT · INFERRED · OPEN
date: 2026-09-16 · reviewed: 2026-09-16 · confidence: LOW
topics: onboarding, insight, trust
versions: v5 · opportunities: O-001
relates: RELATED L-005, RELATED L-008

### Statement

Showing a new customer a useful insight about their own business straight after their data is imported makes the setup effort feel worthwhile.

### Evidence

#### E1 — 2026-09-16 · INFERRED · unattributed · research/inbox/2026-09-16-nishant-onboarding-brief.md

Product owner's brief, explicitly marked by him as a hypothesis: "Showing immediate business value after data ingestion can make the setup effort feel worthwhile." (L118-126)

### What we don't know

Untested. Whether the figures would be believed on first contact; what data they could honestly be computed from (margin needs a cost; the one real tenant's Zoho rates are MRP, L-008); whether an owner acts on an insight or skips to the product.

### Product implications

None yet. An insight figure that cannot be computed from real or clearly-simulated data must not be shown (L-005).

# Opportunity O-001 — the job v7 was designed for

Copied from `research/OPPORTUNITIES.md` in `exagon-ai/foodbridge-pmf`.
That ledger is the source; this is a reading copy.

---

## O-001 · IN_VERSION · A new distributor's business is mostly in FoodBridge before they have to enter it manually
owner: nishant-devekar · created: 2026-09-16
learning: L-012, L-013
version: v5

### The job

A new FoodBridge signup — the owner or back-office person at a small or mid-sized distributor — already keeps customers, products and suppliers in Tally, Zoho, Vyapar, Excel or in invoices and challans. Done when FoodBridge holds that business, they can see it was understood correctly, and they have taken one meaningful first action — without re-entering by hand what they already have.

### Why now

Two hypotheses, neither yet heard from a customer: that re-entering data they already hold is the friction that delays first value (L-012), and that an insight shown straight after import makes the setup effort feel worthwhile (L-013). Both are the product owner's, recorded as INFERRED and LOW confidence. Designing for it is a decision to find out, not a conclusion that it is true.

### What would make this wrong

Users do not trust the imported data; users must manually recreate significant amounts of it; users cannot understand what is still missing; users abandon during import or setup; Business Pulse does not make the setup feel worthwhile; users reach the end and take no action at all.

### Out of scope

Creating the first order inside onboarding — it is the downstream activation
measure, not a step (D-012). A separate "Business Health" concept. The FoodBridge
dashboard itself: charts, filters, segmentation, tables, reports, feature tours,
secondary navigation. Real Tally or Vyapar connections and real document
extraction — simulated in this design, behaving like the eventual contract.

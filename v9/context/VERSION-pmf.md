# v5

**Created 2026-09-16.** Owner: **nishant-devekar**. Branched from `master` @ `1568888`.

This version is the whole experiment: **why** it exists, the **UX** it tests, the
**UI** that draws it, the **implementation**, and what **customers** did with it.

## Use case

A new FoodBridge signup — the owner or back-office person at a small or mid-sized distributor — already keeps customers, products and suppliers in Tally, Zoho, Vyapar, Excel or in invoices and challans. Done when FoodBridge holds that business, they can see it was understood correctly, and they have taken one meaningful first action — without re-entering by hand what they already have.

## Scenario

The first session after signing up: the owner or back-office person of a small or mid-sized distributor, on a phone, minutes after creating their account, with their customers, products and orders already in Tally, Zoho, Vyapar, or a folder of invoices and challans.

## Purpose

A new FoodBridge signup — the owner or back-office person at a small or mid-sized distributor — already keeps customers, products and suppliers in Tally, Zoho, Vyapar, Excel or in invoices and challans. Done when FoodBridge holds that business, they can see it was understood correctly, and they have taken one meaningful first action — without re-entering by hand what they already have.

## Hypothesis

> A new distributor who already has business data in an existing system or files can get to a meaningful first action in FoodBridge in one onboarding session, with minimal manual data entry, because FoodBridge does the ingestion and setup work for them.

## Learning this version exists because of

- **L-012** — A distributor signing up for FoodBridge already holds their customers, products and suppliers in another system or in documents, and being asked to re-enter them is the setup friction that delays first value.
- **L-013** — Showing a new customer a useful insight about their own business straight after their data is imported makes the setup effort feel worthwhile.

The learning itself lives in `research/LEARNING.md`, not here. Reference it by id; never copy it in.

## UX

Implements the UX locked as **O-001** (`e14f20ea96ee5c51`, approved by Nishant Devekar on 2026-09-16), 4 screen(s).

The canonical Flow Map for this version is [`ux/FLOW-MAP.md`](ux/FLOW-MAP.md), with its sketches in `ux/screens/`. It is the one UX artifact: refine it here as implementation teaches you things, and keep the sketches in step with it.

`design/ux/O-001/` keeps the locked record of what was approved.

## What is different from master

*(nothing yet — record each product change here as you make it, so the promotion
review has something to read that is not a diff)*

## Real vs simulated

| Surface | Status |
| --- | --- |
| Stock Audit | `SEEDED` |
| Predictive engine | `SIMULATED` |
| Zoho Books | *(set this before any customer sees it — `SEEDED`, `SIMULATED`, `REAL` or `CONNECTED`)* |

## Running it

```
python3 tools/serve.py v5
```

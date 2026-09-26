# Production Plan and Month End

These are two screens added on 26 Sep 2026 for the stages of the owner's reference flow that had no home. Both read the production store (`v7/assets/production/`).

- **Production Plan** (`plan.html`). It covers stages 2–4 of the flow in three steps:
  1. **How much will we sell?** Last four weeks of sales, orders in hand, next week.
  2. **What to make this week:** short packets in kg, less the freezer and batches already planned, rounded to each recipe's batch sizes. **Create production orders** opens them as Planned in Batch Management.
  3. **Raw material and bags:** needed − in store − already ordered = buy. **Raise PO** records the quantity as already ordered.
- **Month End** (`month-end.html`). It covers stage 15 of the flow:
  - real cost per kg against the recipe;
  - weight lost by step, against each step's limit;
  - weight lost by worker.

Both live in the platform under Production, and use `flow.css` in the platform's look.

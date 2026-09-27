# Production Plan

This is a screen added on 26 Sep 2026 for the stages of the owner's reference flow that had no home. It reads the production store (`v7/assets/production/`).

- **Production Plan** (`plan.html`). It covers stages 2–4 of the flow in three steps:
  1. **How much will we sell?** Last four weeks of sales, orders in hand, next week.
  2. **What to make this week:** short packets in kg, less the freezer and batches already planned, rounded to each recipe's batch sizes. **Create production orders** opens them as Planned in Batch Management.
  3. **Raw material and bags:** needed − in store − already ordered = buy. **Raise PO** records the quantity as already ordered.

It lives in the platform under Production, and uses `flow.css` in the platform's look.

**Month End moved (28 Sep 2026).** Stage 15 of the flow is now a report. Month End used to be `month-end.html`, a Production leaf. It covered real cost per kg against the recipe, and weight lost by step and by worker. It is now the **Production Report** tab of **Overview › Reports** (`modules/foodbridge-dashboard-mockup/v2/screens/dashboard/`), for manufacturers only, with the same figures from `FB_PRODUCTION.monthEnd()`. `#/month-end` and `#/production/month-end` land on Reports.

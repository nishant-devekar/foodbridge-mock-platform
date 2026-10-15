# Flow — Predictive Sales Order

```
Create Order ─► Select Customer ─► Predicted order ─► Confirm ─► FoodBridge order ─► Zoho
```

A peer of Stock Audit, not a step inside it. Stock Audit records what is on the
shelf; this proposes what should ship. A rep audits today and orders on Thursday,
and finishing an audit never launches this.

## Where the numbers come from

**Current stock** — the customer's latest **completed** audit. Never a draft,
never a visit ended early. Same rule as the audit flow's own: an unfinished visit
is discarded, so it cannot feed a recommendation either.

**Demand** — that customer's order history, blended from two signals:

- **the same period last year**, a ±21-day window around today's date, matched on
  real dates
- **the recent trend**, mean quantity across the last three orders

Then:

```
recommended = max(0, expected demand − current stock)
```

Clamped at zero. A product the history has never seen is never invented. Where
there is nothing to go on the screen says so.

`predictive-order.js` is pure, UI-free and deterministic — the same customer
gives the same answer every time. That is what makes the recommendation
arguable rather than magic.

## Provenance is one line

`Stock + history`, or `History only` where there is no audit, behind one tappable
line. Enough to answer "where did 40 come from?" without turning the screen into
a report.

## The rep's edit is the point

Every quantity is theirs to change: edit, zero out, remove, or search the full
catalogue to add something never recommended. What the system proposed is kept
**beside** what was actually ordered, along with the source audit id and the dates
of the orders that fed it — so the recommendation can be judged later.

That is the measurement. A flow that only stored the final order would tell you
nothing about whether the prediction was any good.

## Confirming is the commit point

Nothing is written until the rep answers the inline `Confirm order?` in the
footer — the same two-tap commit Finish Audit uses. Then, strictly in order: the
FoodBridge sales order is created, and **only once that succeeds** is Zoho called.

## Zoho is real

`CONNECTED`. A genuine sales order in the customer's own Zoho Books organisation.

The success screen reports FoodBridge and Zoho **separately**, because they can
disagree: a FoodBridge order with a failed sync is a real order needing a
re-sync, not a failed one to raise again.

There is no offline success path. An unreachable or unconfigured bridge reports
the order as *not synced*.

Read `docs/INTEGRATION-STATUS.md` before changing anything on this path — the
duplicate protection, the timeout handling and the read-back verification each
exist because of a specific failure.

## Known prototype-only behaviour

- **The rep's price is sent.** Each line carries a selling price, seeded from
  the MRP printed in the product name and editable behind one `₹28/Pc` chip.
  It reaches the invoice, and Zoho as the item rate, checked on read-back
  (D-011). A line with no price sends no rate, and Zoho applies its own. Trade
  pricing is still an open commercial question.
- **Zoho's trial has ended** (found 15 September 2026), so Zoho refuses every
  new order until the organisation is upgraded. The success modal reports the
  sync as failed, with Retry Sync.
- Order ids carry a per-device tag, because the counter comes from that browser's
  `localStorage`.
- The bridge's shared key ships with the app (since 16 September 2026), so no
  device needs provisioning. An old `?fbkey=` link is ignored and stripped.

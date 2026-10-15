# Flows — master

What master actually does. Read these before changing a screen; the reasoning is
not in the code.

| | |
| --- | --- |
| [`stock-audit.md`](stock-audit.md) | Stock Audit — what is on the shelf |
| [`predictive-sales-order.md`](predictive-sales-order.md) | Predictive Sales Order — what should ship, and a real Zoho Books sales order |

## Promoted from v4

**Predictive Sales Order** came from `versions/v4` through a promotion review
on 16 September 2026 (`research/promotions/v4-to-master.md`), together with the
rest of v4's Stock Audit page. It creates real Zoho Books sales orders.

## The other 25 destinations

master is the whole platform: Dashboard, Product Master, Customer Management,
Sales Orders, Distribution & Logistics, Production, Inventory, Procurement,
Finance, Workforce Management. Those are module mockups carried over from the
playground; the nav tree, every destination and every clip offset is
`assets/modules.json`, whose own `_comment` block is the spec.

Only the flows we are actively testing get a document here. A screen nobody is
running customer sessions against does not need one.

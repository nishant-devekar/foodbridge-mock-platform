# master — the agreed product baseline

**What it is:** the full FoodBridge platform — 26 destinations across every
module. Its Customer Management → **Stock Audit** page is v4's, promoted on
16 September 2026: the simplified counting flow plus Predictive Sales Order,
which creates real Zoho Books sales orders.

**Where it came from:** `versions/v3`, the client-tested full-platform baseline
migrated from the playground. master carries v3's runtime; v3 itself stays
locked and immutable beside it. The Stock Audit page came from `versions/v4`
through a promotion review (`research/promotions/v4-to-master.md`); every other
destination is still v3's.

**What it is not:** the newest thing anyone has built. Only what a promotion
review accepted is here — from v4, the Stock Audit page and nothing else; v4's
one-screen shell was rejected. See `docs/RELEASE-FLOW.md`.

**Real, not simulated:** confirming an order on the Stock Audit page creates a
real sales order in the PMF Foodbridge Zoho Books organisation (`CONNECTED`),
through `integrations/zoho`. The page carries the bridge's shared key, committed
by the owner's decision (D-009). Zoho is refusing orders until its trial is
upgraded (D-011).

## Running it

```bash
python3 tools/serve.py master
```

## Inherited runtime, and what to know about it

master's layout comes from the playground: `index.html` frames each destination
from `modules/<repo>/…` in an iframe, and hides each module's own sidebar with a
per-destination `clipLeft` offset. Four different offset values are in use, every
one measured in a browser rather than derived.

That is **inherited**, not chosen. It came with v3 and it is what the customer
has been shown. Two things follow:

1. **Do not extend it.** Adding a destination by measuring another offset, or
   composing a new screen in an iframe, is rebuilding the architecture this
   repository left behind. See `.claude/rules/coding-rules.md`.
2. **There is a worked alternative.** `experiments/shell-free-app/` is the same
   Stock Audit product with the shell removed — the 256px offset and the iframe
   replaced by three CSS rules. It is a probe, not a version. If a future version
   wants to move off the shell, start there.

The known cost of the inherited approach, unfixed: clipping shifts a module's
viewport origin, so a dialog centred on its own viewport lands `clipLeft / 2` px
left of the visible centre.

## Data

Each module carries its own seed under `modules/<repo>/…`. The canonical seed —
86 SKUs, 40 accounts, four seeded audit situations — is `shared/data/seed.js`,
which is what `experiments/shell-free-app/` and v4 use. The Stock Audit page's
own copy is Miha's real catalogue and roster plus their Zoho order history
(`order-history.js`), accepted into master on 16 September 2026.

## Flows

See [`flows/`](flows/).

# Flow — Stock Audit & Health

A field rep, in a shop, on a phone, one-handed. Everything below follows from
that.

```
  Customers ──► search customer ──► Quick Audit ──► count ──► Finish ──► done
                                        │
                                        └──► ← exit ──► discard
```

## The loop

1. **Search a customer.** Empty state first: a capped, first-5-A-Z preview on
   focus, the live unbounded match list once typing starts. Never the whole list.
2. **Search and pick products.** Same treatment. On an 86-SKU catalogue a full
   dump is a wall, and the rep is checking three or four things.
3. **Count.** A stepper in the product row — not a per-product bottom sheet.
   Counts in packs as well as base units.
4. **Finish.** An inline `✓ / ✗` confirmation in the sticky footer. Two taps,
   no slide-up sheet.

A persistent bottom nav stays on screen through every view, at every width, so
Customers / Audits / + New Audit / Attention / Back are always in thumb reach.

(v4 adds a `Create Order` entry here for the Predictive Sales Order journey.
That journey is not in master — see `versions/v4/flows/`.)

## Decisions worth not re-litigating

**No modals in the counting flow.** Every one that came out made it faster and
lost nothing.

**Search is empty-state-first everywhere.** Both pickers used to render the full
unfiltered list. See `research/insights/what-the-playground-taught-us.md`.

**Ending a visit discards it.** The `←` exit sheet, and Finish Audit with nothing
counted (which routes to the same sheet), genuinely discard: no half-written
"abandoned" record, no toast implying one was kept. Reps read a saved-sounding
toast as "the count is in there somewhere" — it was not.

**Audit Detail is a visit record, nothing more.** Date/time and the products
checked. No Coverage box, no thumbnails, no purpose/status chrome. Audit
History's cards match: customer, date/time, a plain count.

**The full-catalogue audit still exists** as a secondary action, for the rarer job
it was built for. It is not the default any more.

## Real vs simulated

`SEEDED` throughout. Audits persist to `localStorage`. **No network at all** — a
rep counting stock in a shop with no signal loses nothing, and that is deliberate.

## Known prototype-only behaviour

- Clearing site data loses every audit.
- No login. The rep is whoever holds the phone.
- One location per customer, auto-resolved and hidden.

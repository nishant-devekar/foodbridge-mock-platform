# FoodBridge mock platform — `v7`

**New-user onboarding. A working cut — edits land here.**

`v6` is still the working cut for the whole platform. `v7` is a working cut for
one flow, standing *beside* it rather than behind it, the same way `v4` does.

It is **self-contained**: every internal reference resolves inside this folder, it
owes nothing to any other repository, and the onboarding flow loads nothing from
the network. Its starting bytes came from `exagon-ai/foodbridge-pmf` on 16
September 2026 — that is where it came from, not where it lives. The two have
been separate since, and will diverge.

## Run it

It needs HTTP; the screens `fetch()` their seed JSON and their nav config, which
browsers block on `file://`.

```
python3 -m http.server 8007 --directory v7
```

Or `./serve.sh` from this folder, or the `foodbridge-v7` config in
[`.claude/launch.json`](../.claude/launch.json). Then open
<http://localhost:8007/> — a bare URL opens onboarding, not the dashboard.

**Use a phone viewport.** It is validated on the iPhone 16 Pro Simulator (402pt); `?obreset` on localhost starts as a new user.

**State persists per browser.** The flow keeps progress in `sessionStorage`, so a
second run continues where the first stopped. Clear site data — or use a fresh
browser — to see what a new distributor actually sees. This catches people out
when demoing.

## The flow

The product owner's onboarding board,
[`ux/target/onboarding-target.jpg`](ux/target/onboarding-target.jpg), in its
order: Sign Up → Where is your data? → Connect your account → Importing →
Data found → Data check → Ready → Create order → Order created.
The image is the UI; what sits behind each screen, and what is real, is in
the last entry of [`VERSION.md`](VERSION.md).

**Nine screens, not the board's eleven.** Two were removed on 17 September 2026:
*Staff*, and the feature with it — nothing in this cut collects people or roles —
and *You're ready*, the wordmark screen that followed *Order created*. The flow
now ends at *Order created*, whose action opens the control tower. Both are
deliberate departures from the image — see `VERSION.md`.

**Create Order is Customer Management → Stock Audit's Create Order**, cloned:
its head, its search, its recommended lines and steppers, its in-row remove and
its two-tap confirm. It creates the order in FoodBridge and does **not** sync to
Zoho.

*Where is your data?* offers a fourth live channel, **Sample data**, added after
the board: it skips *Connect your account* and runs the demonstration tenant's
records through the same import, so someone who only came to look is not stopped
on that screen. It is its own source throughout — nothing labels it as read from
a connected account — and after screen 2 the flow does not mark it. The tenant's
export stops at customers, products and orders, so the other collections —
suppliers, invoices, payments, credit notes, quotes, purchase orders, bills,
expenses — are **derived from it** by
[`sample-business.js`](modules/foodbridge-onboarding/screens/sample-business.js),
deterministically and with its pricing rule written down. *Data found* then lists
every collection the channel returned, whichever channel it was, and *Data check*
sorts them into **must have** (sales orders, products, customers — what the
reorder engine reads) and **can add later** (everything else), offering a file or
the sample business on any row that is empty. Continue is never disabled.

Real: the Zoho Books sign-in and read (through the bridge), Excel/CSV read in the
browser, the reorder engine. Held in this browser only: the account, the staff
list and the orders created — this cut has no backend for them, and nothing is
written to Zoho.

## Before you change it

[`VERSION.md`](VERSION.md) is the record: what this is, what is real and what is
simulated, the four design rules the flow was built under, and the dated change
log. **Add to that log.** With no release machinery here, it is the only place the
reasoning survives.

[`ux/FLOW-MAP.md`](ux/FLOW-MAP.md) — the one canonical UX artifact: the ideal UX
written before the product was opened, the mapping onto what exists, the refined
flow, the screen budget argument and the flow diagram. Five sketches sit in
[`ux/screens/`](ux/screens/). Keep it to one UX document; a second one is two
answers to the same question.

[`context/`](context/README.md) — why it is like this. One opportunity, two
learnings, eight decisions, each keeping **what was rejected**. That is the half
that does not survive in code, and the half that answers "why isn't it just…?"

The repo-level [`README`](../README.md) covers the shell at `/` and the versions
beside this one.

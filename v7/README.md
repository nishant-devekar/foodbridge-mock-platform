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

**Use a phone viewport.** 375×812 is what it was designed and reviewed against.

**State persists per browser.** The flow keeps progress in `sessionStorage`, so a
second run continues where the first stopped. Clear site data — or use a fresh
browser — to see what a new distributor actually sees. This catches people out
when demoing.

## The flow

`Business profile → where your data is → what we received → your business → the
opportunity`, ending in 16 prepared draft reorders. Five screens, nine sheets.

Everything behind it is **simulated** — the connection, the extraction, the GST
lookup, the draft preparation. Nothing is sent to a shop and nothing is written to
an accounting system, and the product says so where it matters rather than in a
footnote. The order history it reasons from is real, and so is the reorder engine.

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

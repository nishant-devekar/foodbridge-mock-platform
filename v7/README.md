# FoodBridge mock platform — `v7`

**A narrow product experiment, carried over for reference. Not the working cut.**

`v6` remains the working cut and the full platform. `v7` is one flow — new-user
onboarding — brought across from `exagon-ai/foodbridge-pmf` (`versions/v5`,
release `5.2`) so the reasoning behind it can be read beside the platform it was
designed against.

Work that would change it belongs in the PMF repository, where it carries its
lifecycle, its release manifests and its customer URL.

## Run it

It needs HTTP; the screens `fetch()` their seed JSON and their nav config, which
browsers block on `file://`.

```
python3 -m http.server 8007 --directory v7
```

Or `./serve.sh` from this folder. Then open <http://localhost:8007/> — a bare URL
opens onboarding, not the dashboard.

**Use a phone viewport.** 375×812 is what it was designed and reviewed against.

**State persists per browser.** The flow keeps its progress in `sessionStorage`,
so a second run continues where the first stopped. Clear site data — or use a
fresh browser — to see what a new distributor actually sees.

## The flow

`Business profile → where your data is → what we received → your business → the
opportunity`, ending in 16 prepared draft reorders. Five screens, nine sheets.

Everything behind it is **simulated** — the connection, the extraction, the GST
lookup, the draft preparation. Nothing is sent to a shop and nothing is written to
an accounting system, and the product says so where it matters rather than in a
footnote. The order history it reasons from is real, and so is the reorder engine.

## What is in here

[`VERSION.md`](VERSION.md) — what this is, why the number does not mean what it
looks like, what is real and what is not, and what came with it.

[`ux/FLOW-MAP.md`](ux/FLOW-MAP.md) — the one canonical UX artifact: the ideal UX
written before the product was opened, the mapping onto what exists, the refined
flow, the screen budget argument and the flow diagram. Five sketches sit in
[`ux/screens/`](ux/screens/).

[`context/`](context/) — the records the build cites: the opportunity, the
learning it exists because of, and eight decisions that each keep **what was
rejected**. That is the half that does not survive in code, and it is why they
travelled with it.

The repo-level [`README`](../README.md) covers the shell at `/` and the versions
beside this one.

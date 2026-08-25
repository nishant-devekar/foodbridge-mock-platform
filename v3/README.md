# FoodBridge — Mock Platform

One shell that makes ten independently-built module mockups, published by six
different people on their own GitHub Pages sites, behave like a single
application. Pick a module in the sidebar and it loads in place.

**▶ Live site:** https://nishant-devekar.github.io/foodbridge-mock-platform/

Every module is a real, shareable URL — `#/inventory/raw-material-inventory`
opens straight to that screen, and browser back/forward work.

## What it is, and what it is not

**It is a nav shell.** It owns the sidebar, the routing and the active state.
The sidebar markup is copied class-for-class from the `storefront-frontend`
port, which was verified against the running app at `b2bgreens.com`, so it
matches the real QA store sidebar.

**It is not a copy of anyone's work.** Nothing is vendored. Every destination is
loaded live, in an iframe, from the URL its owning team publishes. When they
push, this reflects it on the next load. That also means a module going down or
changing shape shows up here — which is the point.

## The modules

| Nav | Screens | Owner |
| --- | ------- | ----- |
| Dashboard | 1 | `nidhimehta9399/foodbridge-dashboard-mockup` |
| Product Master | Finished Goods · Product Categories · Raw Materials | `exagon-ai/foodbridge-module-products` |
| Customer Management | B2B Customers · Retail Customers | `nidhimehta9399/foodbridge-customer-mockup` |
| Sales Orders | 1 | `nishant-devekar/foodbridge-sales-orders-mockup` |
| Distribution & Logistics | Route Planning · Delivery Management · Logistic Returns | `kdansari02/foodbridge-module-distribution-logistics` |
| Production | Batch Management · Semifinished Products · Configure Recipe | `nishant-devekar/foodbridge-production-discovery` |
| Inventory | Finished Goods Inventory · Raw Material Inventory | `nishant-devekar/foodbridge-inventory-mockup` |
| Procurement | Purchase Orders · Supplier Management | `love-scripter/foodbridge-module-procurement` |
| Finance | Customer Receivables · Supplier Payables | `kdansari02/invoice-payment-overview` |
| Workforce Management | 1 | `nishant-devekar/foodbridge-staff-mockup` |

20 destinations. The whole tree — every URL, every offset — is
[`assets/modules.json`](assets/modules.json). Adding a module means adding an
entry there; there is no other place to change.

## Versions

Each `v<N>/` is a **frozen, self-contained snapshot** — the shell plus a local copy of every
module screen it showed on its freeze date. Nothing in one loads from a module team's Pages site,
so it renders the same however those repos change afterwards. That is the point: the live
platform at `/` follows the teams, and a frozen version does not — and never changes again once
cut, so `v1` stays exactly what it was even after `v2` exists.

**▶ Current frozen version:** <https://nishant-devekar.github.io/foodbridge-mock-platform/v3/>

| | Live (`/`) | Frozen (`v3/`, current) | Frozen (`v2/`) | Frozen (`v1/`) |
| --- | ---------- | -------------- | -------------- | -------------- |
| Freeze date | — moves with every push | 25 August 2026 | 22 August 2026 | 14 August 2026 |
| Destinations | 26, whatever `assets/modules.json` says today | 26 | 26 | 24 |
| Module screens | fetched from each team's Pages site at view time | local copies under `v3/modules/<repo>/` | local copies under `v2/modules/<repo>/` | local copies under `v1/modules/<repo>/` |
| Changes when a team pushes | yes, on the next load | no | no | no |
| Share as | a link | a link, or the folder / release zip | a link, or the folder / release zip | a link, or the folder / release zip |

`v3` was recut on 25 August 2026 once `nidhimehta9399/foodbridge-customer-mockup`'s live site
caught up: Customer Management's Stock Audit & Health screen is now a real crawl of that repo like
every other screen, replacing the version authored directly here while the source lagged. One
deliberate exception remains — the "🧾 Stock Audit" entry point on Delivery Management's stop
detail is still hand-patched into `foodbridge-module-distribution-logistics`'s own
`stop-detail.js` here, because it is cross-module deep-link glue specific to this local snapshot
(see the comment above `STOCK_AUDIT_URL` in that file) rather than something that belongs in that
team's own repo. Re-running `tools/pack.py --version 3` will silently drop it; restore the file
from git or hold it back before re-packing.

Every frozen version's [release](https://github.com/nishant-devekar/foodbridge-mock-platform/releases)
carries **two** assets, because "look at it" and "work on it" need different things:

| Asset | For |
| ----- | --- |
| `foodbridge-mock-platform-v<N>.zip` | Seeing it run — the folder below, self-contained. |
| `foodbridge-v<N>-source.zip` | Handing to a developer — every repo behind it as a ready-to-work git clone. Unzip, `./run.sh`, `./update.sh`. |

The runtime half is built by crawling what a browser loads, so it holds a small fraction of each
module's full source — enough to render every screen, and nothing else. `discovery/instructions/`,
`development/` trees, screens reached only by JavaScript, canonical seed JSON, superseded version
folders and all git history are invisible to a browser and live in the source half instead.

- Browse the current version: <https://nishant-devekar.github.io/foodbridge-mock-platform/v3/> —
  or [`v2`](https://nishant-devekar.github.io/foodbridge-mock-platform/v2/) /
  [`v1`](https://nishant-devekar.github.io/foodbridge-mock-platform/v1/) for what came before it
- What is inside each one, where every screen came from, and that version's own limitations:
  [`v3/VERSION.md`](v3/VERSION.md) · [`v2/VERSION.md`](v2/VERSION.md) · [`v1/VERSION.md`](v1/VERSION.md)
- Tagged `v3` / `v2` / `v1` in git; each release's source half records every repository's exact
  commit SHA in its own `MANIFEST.md`.

Rebuild or cut a later snapshot with `tools/pack.py --version <N>` (see its docstring — `--dry`
reports what would be fetched without writing anything). It re-crawls every
destination in `assets/modules.json`, keeps each module's own directory layout so relative links
survive, vendors the CDN assets, and rewrites `modules.json` to local paths.

## How the seam works

Each module renders its *own* copy of the QA sidebar, so naive embedding would
show two. The platform pushes the module's sidebar out of view by making its
iframe `clipLeft` px wider than the visible area and offsetting it left by the
same amount, inside `overflow: hidden`.

The module's own **header is deliberately kept** and serves as the app header, so
there is exactly one. Clipping vertically as well would look right at rest and
break on scroll, because a module's sticky toolbar sticks to the iframe's top
edge — which would then sit above the visible area.

`clipLeft` is measured per destination, never inferred. Four widths are in use
(0, 212, 250, 256), and two screens in the *same repo* differ. See
[`tools/measuring-clip-offsets.md`](tools/measuring-clip-offsets.md).

**The known cost:** clipping shifts a module's viewport origin, so a dialog the
module centres on its own viewport lands `clipLeft / 2` px left of the visible
centre. The fix is for each module to support `?embed=1` and hide its own
sidebar, which would let the platform set `clipLeft: 0`. That needs a change in
each module's repo, so it is not done yet.

## What is not in the nav

Five items from the real QA sidebar are omitted because no mockup exists for
them, rather than shown as dead links:

| Item | Why |
| ---- | --- |
| Image Gallery | Not built in the products module |
| Stock Audit Settlement | No mockup supplied |
| Route Delivery | No mockup supplied |
| Store QR Code | No mockup supplied |
| Production Settlement | A mockup *does* exist, but the QA sidebar has no such item, so it is not in the nav |

Two mappings are worth knowing about:

- **Finished Goods** points at the products module's "All Products" screen — the
  same list, under the name the QA sidebar uses.
- **Purchase Orders** is what the procurement module's screen 02 actually is; it
  was described as "Sourcing Orders" in the original list.

## Running locally

For **development** — editing modules and seeing the change — see
**[DEVELOPMENT.md](DEVELOPMENT.md)**. Short version, with the checkouts side by side:

```bash
python3 tools/dev.py
```

which rewrites every destination to point at your checkouts and serves them from one root.
Without that step the shell keeps loading each module from its live Pages site, and nothing you
edit locally appears.

### Just viewing it

`modules.json` is read with `fetch()`, which browsers block on `file://`. Serve
over HTTP:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.

## Verification

All 20 destinations were driven in a real browser: each loads, applies its
measured clip, and sets the correct active state in the sidebar. Six were
additionally checked by eye against the module opened standalone.

One caution for anyone re-checking this: the browser screenshot pipeline
regularly returns a **stale frame** right after an iframe navigates, which looks
exactly like a blank or broken module. Four "broken" modules during the build
were this artifact and nothing else. Force a repaint before trusting a
screenshot — the method is in the tools doc.

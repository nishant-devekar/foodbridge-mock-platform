# FoodBridge — Mock Platform

One shell that makes twelve independently-built module mockups, published from
five different GitHub accounts on their own Pages sites, behave like a single
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
| Product Master | Finished Goods · Product Categories · Raw Materials · Image Gallery | `exagon-ai/foodbridge-module-products` |
| Customer Management | B2B Customers · Retail Customers · Catalog · Stock Audit & Health | `nidhimehta9399/foodbridge-customer-mockup` |
| Sales Orders | 1 | `nishant-devekar/foodbridge-sales-orders-mockup` |
| Distribution & Logistics | Route Planning · Delivery Management · Logistic Returns · Live Delivery Tracking | `kdansari02/foodbridge-module-distribution-logistics` |
| Production | Batch Management · Semifinished Products · Configure Recipe | `nishant-devekar/foodbridge-production-discovery` |
| Inventory | Inventory Intelligence | `exagon-ai/foodbridge-inventory-intelligence` |
| Inventory | Finished Goods Inventory · Raw Material Inventory | `nishant-devekar/foodbridge-inventory-mockup` |
| Procurement | Purchase Orders · Supplier Management | `love-scripter/foodbridge-module-procurement` |
| Finance | Customer Receivables · Supplier Payables | `kdansari02/invoice-payment-overview` |
| Workforce Management | 1 | `nishant-devekar/foodbridge-staff-mockup` |
| *(not in the nav)* | Store — reached from the sidebar footer's QR | `kdansari02/retails-overview` |

26 destinations — 25 in the sidebar plus the storefront the QR points at. The
whole tree — every URL, every offset — is
[`assets/modules.json`](assets/modules.json). Adding a module means adding an
entry there; there is no other place to change.

## Versions

Each `v<N>/` is a **self-contained snapshot** — the shell plus a local copy of every module
screen it shows. Nothing in one loads from a module team's Pages site, so it renders the same
however those repos change afterwards. That is the point: the live platform at `/` follows the
teams, and a version folder does not.

`v1`–`v3` are **frozen**: cut on a date and never touched again, so `v1` stays exactly what it
was even after `v2` exists. `v4` and `v6` are **working cuts** — self-contained the same way, but
still edited. `v5` is frozen **except for Stock Audit**: that one screen is authored in `v6` and
mirrored back into `v5` and `v4` at each freeze, so the three cuts do not fork it. Everything else
in `v5` is still the 30 August bytes. See [`v5/VERSION.md`](v5/VERSION.md).

**▶ Current: [`v6`](https://nishant-devekar.github.io/foodbridge-mock-platform/v6/)** — the full platform, opened from the `v5` freeze.
[`v4`](https://nishant-devekar.github.io/foodbridge-mock-platform/v4/) is a one-screen cut standing *beside* it, not behind it.

| | What it is | State | Destinations |
| --- | --- | --- | --- |
| Live (`/`) | follows each team's Pages site at view time | moves with every push | 26, whatever `assets/modules.json` says today |
| [`v6`](https://nishant-devekar.github.io/foodbridge-mock-platform/v6/) | the full platform, from the `v5` freeze | working — opened 30 August 2026 | 26, plus 1 retired |
| [`v5`](https://nishant-devekar.github.io/foodbridge-mock-platform/v5/) | the full platform, with Delivery Management ported to a real offline app | frozen 30 August 2026, except Stock Audit | 26, plus 1 retired |
| [`v4`](https://nishant-devekar.github.io/foodbridge-mock-platform/v4/) | Stock Audit alone, no sidebar | working — cut 25 August 2026 | 1 |
| [`v3`](https://nishant-devekar.github.io/foodbridge-mock-platform/v3/) | the full platform | frozen 26 August 2026 | 26 |
| [`v2`](https://nishant-devekar.github.io/foodbridge-mock-platform/v2/) | the full platform | frozen 22 August 2026 | 26 |
| [`v1`](https://nishant-devekar.github.io/foodbridge-mock-platform/v1/) | the full platform | frozen 14 August 2026 | 24 |

In every `v<N>/` the module screens are local copies under `v<N>/modules/<repo>/`, none of which
change when a team pushes, and each can be shared as a link or as the folder / release zip.

### `v5` — the current full platform

<https://nishant-devekar.github.io/foodbridge-mock-platform/v5/>

Opened 29 August 2026 from the `v3` freeze rather than from `v4`, because `v4` is a narrow
single-destination cut and this needed the whole platform back. Every file outside its own
paperwork and its nav is byte-for-byte `v3`.

**Stock Audit & Health is `v4`'s screen now.** Same route, same id, same sidebar label; a far
larger screen behind them — `stock-audit.js` goes 2,116 → 4,274 lines — carrying the journey
`v3`'s copy had no notion of: **Create Order**, the Predictive Sales Order flow, together with
the tenant's real 86-SKU catalogue and its local product tiles. Two bottom tabs become three.

**The screen it replaced is suspended, not deleted.** Its files stay where they were, and
`#/stock-audit-health-v3` still opens it — a `standalone` route, so it resolves by hash but
never appears in the sidebar and can never become the landing screen. There to compare against,
not reachable by accident.

Two things that costs, both confined to that one route: it is no longer offline-capable, since
Create Order talks to the Zoho bridge; and any change to `v5/assets/modules.json` now needs the
`?v=` token in `v5/index.html` bumped alongside it, because `mount()` fetches the config with
that token and a stale copy pins a browser to the previous nav. See
[`v5/VERSION.md`](v5/VERSION.md).

`v5` is worked on at a **phone viewport** (375×812). The inherited desktop layout still renders.

### `v4` — Stock Audit only

<https://nishant-devekar.github.io/foodbridge-mock-platform/v4/>

`v4` is **not a successor to `v3`** — a narrower thing standing beside the full platform. One
destination, Customer Management → Stock Audit & Health, and **no sidebar**: with a single
screen a sidebar is a list of one item, and a drawer that opens onto the screen you are already
looking at, so both it and the mobile burger are gone from the shell.

It is where the tenant's real catalogue landed — 86 SKUs imported from their own `products.csv`,
with local SVG product tiles instead of hotlinked photos — and where Create Order and the Zoho
Books bridge were built. `v5` now carries that same screen; `v3` and earlier still show the
twelve invented products. The difference is deliberate — see [`v4/VERSION.md`](v4/VERSION.md).

### `v3` and earlier

`v3` was recut on 26 August 2026: Customer Management's Stock Audit & Health screen is a real
crawl of `nidhimehta9399/foodbridge-customer-mockup`'s **`v2`** — the module's own repo caught
up, first with the screen itself (a product-owner-driven simplification down to
`quick-pick → quick-count → done`, and a real mobile-browser QA pass, both done directly in
this repo while the source lagged and ported back once it was ready), then with a link into
Catalog its `shell.js` was missing. One deliberate exception remains: the "🧾 Stock Audit"
entry point on Delivery Management's stop detail is still hand-patched into
`foodbridge-module-distribution-logistics`'s own `stop-detail.js` here, because it is
cross-module deep-link glue specific to this local snapshot rather than something that
belongs in that team's repo. Re-running `tools/pack.py --version 3` will silently drop it;
restore the file from git or hold it back before re-packing.

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

- Browse the current cut: <https://nishant-devekar.github.io/foodbridge-mock-platform/v5/> — or
  [`v4`](https://nishant-devekar.github.io/foodbridge-mock-platform/v4/) /
  [`v3`](https://nishant-devekar.github.io/foodbridge-mock-platform/v3/) /
  [`v2`](https://nishant-devekar.github.io/foodbridge-mock-platform/v2/) /
  [`v1`](https://nishant-devekar.github.io/foodbridge-mock-platform/v1/) for what stands beside and behind it
- What is inside each one, where every screen came from, and that version's own limitations:
  [`v5/VERSION.md`](v5/VERSION.md) · [`v4/VERSION.md`](v4/VERSION.md) ·
  [`v3/VERSION.md`](v3/VERSION.md) · [`v2/VERSION.md`](v2/VERSION.md) · [`v1/VERSION.md`](v1/VERSION.md)
- Tagged `v4` / `v3` / `v2` / `v1` in git; each release's source half records every repository's
  exact commit SHA in its own `MANIFEST.md`. `v5` carries no tag yet — it is still being worked
  on, so there is no fixed point to tag.

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

Items are omitted rather than shown as dead links. The list is kept in
`assets/modules.json`'s own `hidden` array, which is where to look for the
current answer:

| Item | Why |
| ---- | --- |
| Stock Audit Settlement | No mockup supplied |
| Route Delivery | No mockup supplied |
| Production Settlement | A mockup *does* exist, but the QA sidebar has no such item, so it is not in the nav |

Two that used to be on this list have since arrived: **Image Gallery** is built
and sits under Product Master, and **Store QR Code** is in the sidebar footer —
it opens a QR that deep-links to the `retails-overview` storefront.

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

All 20 destinations that existed when this was written were driven in a real
browser: each loads, applies its measured clip, and sets the correct active
state in the sidebar. Six were additionally checked by eye against the module
opened standalone. The nav has grown to 26 since; the destinations added after
that pass have not had the same one.

One caution for anyone re-checking this: the browser screenshot pipeline
regularly returns a **stale frame** right after an iframe navigates, which looks
exactly like a blank or broken module. Four "broken" modules during the build
were this artifact and nothing else. Force a repaint before trusting a
screenshot — the method is in the tools doc.

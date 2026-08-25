# FoodBridge mock platform — Version 3

**Frozen 26 August 2026.** A self-contained snapshot: the shell plus a local copy of every
module screen it shows. Nothing here loads from a module team's GitHub Pages site, so this
folder renders the same however those repos change afterwards.

206 files, 8.0 MB, 12 module repos, 26 destinations.

**Recut from the 24 August 2026 freeze** once `nidhimehta9399/foodbridge-customer-mockup`
caught up. Customer Management's Stock Audit & Health screen is a real crawl of that repo —
first the screen itself (a product-owner-driven simplification down to
`quick-pick → quick-count → done`, and a mobile-browser QA pass, both authored directly
in this repo while the source lagged and ported back once `v2` was cut there), then a link
into Catalog its `shell.js` was missing, which `v2` also picked up.

**Re-pointed at that repo's `v3`** on 25 August 2026. `v2`'s own release notes carried an
explicit gap — its mobile QA pass had been done under Chromium device emulation, never on a
real mobile browser. That pass has now been run for real, on an Android emulator (Pixel 8,
Chrome 124) and an iOS Simulator (iPhone 16 Pro, Safari 605.1.15) with real touch input, and
the four bugs it turned up are fixed: the end-of-audit toast covering the app header, the
phone's Back button leaving the app entirely, `<select>` touch targets measuring 32px on
WebKit only (which ignores `min-height` on a native-appearance select), and search boxes with
no `autocapitalize`/`autocorrect` letting the keyboard rewrite a typed SKU. A fifth, found
alongside: a phone in landscape with the keyboard up had no room for its own chrome and
pushed the Finish CTA off screen. Same provenance rule as before — the work was authored
here, cut as `v3` in the module repo, and crawled back. The superseded local copy of the
module's `v2` is gone with it; nothing routed to it any more.

**Refined the vNext Quick Audit flow** on 26 August 2026, authored directly in this repo
(not yet ported upstream). Audit Detail is cut down to what a visit record actually is —
date/time and the products checked, no Coverage box, no thumbnails, no purpose/status
chrome; Audit History's cards match: customer, date/time, a plain count, nothing else.
Customer and product search now share one dropdown treatment for every state a search box
is "in use" in — a capped, first-5-A-Z preview on focus before typing, the live unbounded
match list once typing starts, both scrollable in their own box so a long result list no
longer carries the search box and page head off-screen with it. Ending a visit — the ←
exit sheet, and Finish Audit when nothing's been counted, which now routes to the same
sheet instead of dead-ending in "count something first" — genuinely discards it: no
half-written "abandoned" record, no toast implying one was kept. Fixed along the way: a
sheet closed by its own button (not the phone's Back) could, on the button after it,
silently pop the rep a screen further out than the sheet they'd just closed — a
history-timing race between the sheet's own `history.back()` and the listener meant to
catch a real Back press.

One deliberate exception remains, and is *not* reflected below since the packager has no way
to know about it: the "🧾 Stock Audit" entry point on Delivery Management's stop detail is
hand-patched into `modules/foodbridge-module-distribution-logistics/…/stop-detail.js` —
cross-module deep-link glue specific to this local snapshot (see the comment above
`STOCK_AUDIT_URL` in that file), not something that belongs in that team's own repo.
Re-running `tools/pack.py --version 3` will silently drop it; restore the file from git or
hold it back before re-packing.

## Running it

It must be **served over HTTP** — seven of the packaged screens `fetch()` their seed JSON at
runtime, which a browser blocks on `file://`. From this folder:

```
python3 -m http.server 8000
```

then open <http://localhost:8000/>. On GitHub Pages it works as-is.

## What is frozen, and what is not

| | |
| --- | --- |
| Shell — nav, routing, chrome, clip offsets | frozen |
| All 26 module screens, their JS/CSS/seed data/images | frozen, local copies |
| Google Fonts, Tailwind, Leaflet | frozen in `vendor/` |
| **4 other reference(s)** | **not frozen** — see the table below. Offline, each shows whatever its screen does when that call fails (usually a blank background or a missing image); every other reference is fully offline-capable. |

| Still reaches the network |
| --- |
| `https://cdnjs.cloudflare.com/ajax/libs/anchor-js/4.1.0/anchor.min.js` |
| `https://exagon-ai.github.io/instructions/addendum-020-v1-freeze.md` |
| `https://wa.me/` |
| `https://www.openstreetmap.org/copyright` |

## Inherited defects

Faithfully reproduced from the live sites rather than silently patched — 32
found already 404 on the freeze date and packaged as-is:

- `https://exagon-ai.github.io/foodbridge-inventory-intelligence/favicon.ico`
- `https://exagon-ai.github.io/foodbridge-inventory-intelligence/v1/screens/inventory-intelligence/$1`
- `https://exagon-ai.github.io/foodbridge-inventory-intelligence/v1/screens/inventory-intelligence/a.source,this.map.consumer(`
- `https://exagon-ai.github.io/foodbridge-inventory-intelligence/v1/screens/inventory-intelligence/t`
- `https://exagon-ai.github.io/foodbridge-inventory-intelligence/v1/screens/inventory-intelligence/tailwind.config.js`
- `https://exagon-ai.github.io/foodbridge-module-products/discovery/paths/products-directory/screens/products/blob`
- `https://exagon-ai.github.io/foodbridge-module-products/discovery/paths/products-directory/screens/products/file`
- `https://exagon-ai.github.io/foodbridge-module-products/discovery/paths/products-directory/screens/products/url`
- `https://fonts.googleapis.com`
- `https://kdansari02.github.io/foodbridge-module-distribution-logistics/discovery/paths/distribution-logistics/screens/distribution/file`
- `https://love-scripter.github.io/foodbridge-module-procurement/screens/a.href`
- `https://love-scripter.github.io/foodbridge-module-procurement/screens/blob`
- `https://nidhimehta9399.github.io/foodbridge-customer-mockup/v1/screens/catalog/blob`
- `https://nidhimehta9399.github.io/foodbridge-customer-mockup/v1/screens/catalog/url`
- `https://nidhimehta9399.github.io/foodbridge-customer-mockup/v1/screens/customers/a.href`
- `https://nidhimehta9399.github.io/foodbridge-customer-mockup/v1/screens/customers/blob`
- `https://nishant-devekar.github.io/foodbridge-inventory-mockup/screens/inventory/$1`
- `https://nishant-devekar.github.io/foodbridge-inventory-mockup/screens/inventory/a.source,this.map.consumer(`
- `https://nishant-devekar.github.io/foodbridge-inventory-mockup/screens/inventory/t`
- `https://nishant-devekar.github.io/foodbridge-inventory-mockup/screens/inventory/tailwind.config.js`
- `https://nishant-devekar.github.io/foodbridge-production-discovery/batch-management/screens/batch/styles-b.css`
- `https://nishant-devekar.github.io/foodbridge-production-discovery/production-planning/screens/recipie/_reference/ingredients-list.html`
- `https://nishant-devekar.github.io/foodbridge-sales-orders-mockup/screens/orders/$1`
- `https://nishant-devekar.github.io/foodbridge-sales-orders-mockup/screens/orders/a.href`
- `https://nishant-devekar.github.io/foodbridge-sales-orders-mockup/screens/orders/a.source,this.map.consumer(`
- `https://nishant-devekar.github.io/foodbridge-sales-orders-mockup/screens/orders/blob`
- `https://nishant-devekar.github.io/foodbridge-sales-orders-mockup/screens/orders/t`
- `https://nishant-devekar.github.io/foodbridge-sales-orders-mockup/screens/orders/tailwind.config.js`
- `https://nishant-devekar.github.io/foodbridge-staff-mockup/screens/$1`
- `https://nishant-devekar.github.io/foodbridge-staff-mockup/screens/a.source,this.map.consumer(`
- `https://nishant-devekar.github.io/foodbridge-staff-mockup/screens/t`
- `https://nishant-devekar.github.io/foodbridge-staff-mockup/screens/tailwind.config.js`


## Layout

```
index.html          the shell
assets/             shell JS/CSS + modules.json, rewritten to local paths
modules/<repo>/…    each module in its OWN original directory layout, so every
                    relative link inside it still resolves
vendor/             Google Fonts, Tailwind, Leaflet
```

- `modules/foodbridge-customer-mockup/`
- `modules/foodbridge-dashboard-mockup/`
- `modules/foodbridge-inventory-intelligence/`
- `modules/foodbridge-inventory-mockup/`
- `modules/foodbridge-module-distribution-logistics/`
- `modules/foodbridge-module-procurement/`
- `modules/foodbridge-module-products/`
- `modules/foodbridge-production-discovery/`
- `modules/foodbridge-sales-orders-mockup/`
- `modules/foodbridge-staff-mockup/`
- `modules/invoice-payment-overview/`
- `modules/retails-overview/`

## Where each screen came from

| Route | Screen | Source on the freeze date |
| --- | --- | --- |
| `#/dashboard` | Dashboard | `modules/foodbridge-dashboard-mockup/v2/screens/dashboard/dashboard.html` |
| `#/product-master/finished-goods` | Finished Goods | `modules/foodbridge-module-products/discovery/paths/products-directory/screens/products/all-products.html` |
| `#/product-master/product-categories` | Product Categories | `modules/foodbridge-module-products/discovery/paths/products-directory/screens/products/categories.html` |
| `#/product-master/raw-materials` | Raw Materials | `modules/foodbridge-module-products/discovery/paths/products-directory/screens/products/raw-materials.html` |
| `#/product-master/image-gallery` | Image Gallery | `modules/foodbridge-module-products/discovery/paths/products-directory/screens/products/image-directory.html` |
| `#/customer-management/b2b-customers` | B2B Customers | `modules/foodbridge-customer-mockup/v1/screens/customers/b2b-customers.html` |
| `#/customer-management/retail-customers` | Retail Customers | `modules/foodbridge-customer-mockup/v1/screens/customers/retail-customers.html` |
| `#/customer-management/catalog` | Catalog | `modules/foodbridge-customer-mockup/v1/screens/catalog/catalog.html` |
| `#/customer-management/stock-audit-health` | Stock Audit & Health | `modules/foodbridge-customer-mockup/v3/screens/customers/stock-audit.html` |
| `#/sales-orders` | Sales Orders | `modules/foodbridge-sales-orders-mockup/screens/orders/screen-01-orders-list.html` |
| `#/distribution-logistics/route-planning` | Route Planning | `modules/foodbridge-module-distribution-logistics/discovery/paths/route-planning/index.html` |
| `#/distribution-logistics/delivery-management` | Delivery Management | `modules/foodbridge-module-distribution-logistics/discovery/paths/delivery-management/screens/delivery/index.html` |
| `#/distribution-logistics/logistic-returns` | Logistic Returns | `modules/foodbridge-module-distribution-logistics/discovery/paths/logistic-returns/index.html` |
| `#/distribution-logistics/live-tracking` | Live Delivery Tracking | `modules/foodbridge-module-distribution-logistics/discovery/paths/live-tracking/index.html` |
| `#/production/batch-management` | Batch Management | `modules/foodbridge-production-discovery/batch-management/screens/batch/batch-workspace.html` |
| `#/production/semifinished-products` | Semifinished Products | `modules/foodbridge-production-discovery/batch-management/screens/batch/semi-finished-products.html` |
| `#/production/configure-recipe` | Configure Recipe | `modules/foodbridge-production-discovery/production-planning/screens/recipie/recipe-v4.html` |
| `#/inventory/inventory-intelligence` | Inventory Intelligence | `modules/foodbridge-inventory-intelligence/v1/screens/inventory-intelligence/index.html` |
| `#/inventory/finished-goods-inventory` | Finished Goods Inventory | `modules/foodbridge-inventory-mockup/screens/inventory/screen-01-current-stock.html` |
| `#/inventory/raw-material-inventory` | Raw Material Inventory | `modules/foodbridge-inventory-mockup/screens/raw-material-inventory/screen-01-live-stock.html` |
| `#/procurement/purchase-orders` | Purchase Orders | `modules/foodbridge-module-procurement/screens/screen-02.html` |
| `#/procurement/supplier-management` | Supplier Management | `modules/foodbridge-module-procurement/screens/screen-09.html` |
| `#/finance/customer-receivables` | Customer Receivables | `modules/invoice-payment-overview/screens/invoices-payments.html` |
| `#/finance/supplier-payables` | Supplier Payables | `modules/invoice-payment-overview/screens/supplier-invoices-payments.html` |
| `#/workforce-management` | Workforce Management | `modules/foodbridge-staff-mockup/screens/screen-01-staff-list.html` |
| `#/retails-overview` | Store | `modules/retails-overview/discovery/screens/desktop-v6.html` |

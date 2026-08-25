# FoodBridge mock platform — Version 3

**Frozen 24 August 2026.** A self-contained snapshot: the shell plus a local copy of every
module screen it shows. Nothing here loads from a module team's GitHub Pages site, so this
folder renders the same however those repos change afterwards.

202 files, 7.8 MB, 12 module repos, 26 destinations.

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
| **Stock Audit & Health** | frozen like the rest, but **authored in this repo rather than crawled** — see the section below |
| **7 other reference(s)** | **not frozen** — see the table below. Offline, each shows whatever its screen does when that call fails (usually a blank background or a missing image); every other reference is fully offline-capable. |

| Still reaches the network |
| --- |
| `https://cdnjs.cloudflare.com/ajax/libs/anchor-js/4.1.0/anchor.min.js` |
| `https://commons.wikimedia.org/wiki/Special:FilePath/Batch%20no%2C%20MFG%20Date%20and%20EXP%20Date.jpg` |
| `https://commons.wikimedia.org/wiki/Special:FilePath/Messy%20storage%20room%20with%20boxes.jpg` |
| `https://commons.wikimedia.org/wiki/Special:FilePath/Supermarket%20shelves.jpg` |
| `https://exagon-ai.github.io/instructions/addendum-020-v1-freeze.md` |
| `https://wa.me/` |
| `https://www.openstreetmap.org/copyright` |

## The one screen that is not a crawl

Every other screen here is a byte copy of what its team's Pages site served on the freeze
date. **Customer Management → Stock Audit & Health is not** — it is authored and maintained
in this repository, because `nidhimehta9399/foodbridge-customer-mockup`'s live site has not
caught up with it. Three files:

```
modules/foodbridge-customer-mockup/v1/screens/customers/stock-audit.{html,css,js}
```

Each says so in its own header comment. The rest of that module — B2B Customers, Retail
Customers, Catalog, the shared `shell.js` / `styles.css` / `seed.inline.js` those three build
on — is a normal crawl, unmodified.

What it is: a mobile-first field tool for a distributor's rep, one journey end to end —
**find the customer → pick the products → count each → finish → leave** — with Audit History
as a read-only record downstream. The counting screen carries no modal of its own: the count
is a stepper in the product row (the same control Delivery Management's Load Stock uses),
finishing is an inline ✓ / ✗ confirmation in the footer, and picking a customer always starts
a new visit. Products can be counted in packs (Packet → Box → Pallet), with `physical` still
stored in base units so every existing calculation reads one scale.

It is built as a phone app shell, not a document: one column the height of the *dynamic*
viewport (`100dvh`, not `100vh`), only the product list scrolling, and the action bar and nav
as ordinary rows at the bottom rather than `position: fixed` elements competing with a mobile
browser's own toolbar. `viewport-fit=cover` plus `env(safe-area-inset-*)` keep it clear of the
home indicator, controls carry 16px text so iOS does not zoom on focus (pinch-zoom is left
enabled), and the on-screen keyboard is measured from `visualViewport` because iOS shrinks only
the visual viewport. On desktop the same column runs inside the device frame, so sheets and
toasts land in the phone rather than at the browser window's edges.

**Not yet validated on real phone hardware.** The mobile pass was tested in Chromium under
device emulation across seven viewports and all 18 flow states; real iOS Safari and real
Android Chrome, and therefore the actual `env(safe-area-inset-*)` values, remain unverified.

> **If you re-run `tools/pack.py --version 3`, you will lose this screen.** The packager
> re-crawls every destination in `assets/modules.json` and writes what it finds, so it would
> replace these three files with the older versions still on the module's Pages site. Restore
> them from git (they are tracked here like any other source) or hold them back before
> re-packing.

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
| `#/customer-management/stock-audit-health` | Stock Audit & Health | `modules/foodbridge-customer-mockup/v1/screens/customers/stock-audit.html` — **authored here, not crawled**; see above |
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

# FoodBridge mock platform — Version 1

**Frozen 14 August 2026.** A self-contained snapshot: the shell plus a local copy of every
module screen it shows. Nothing here loads from a module team's GitHub Pages site, so this
folder renders the same however those repos change afterwards.

181 files, 6.7 MB, 11 module repos, 24 destinations.

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
| All 24 module screens, their JS/CSS/seed data/images | frozen, local copies |
| Google Fonts, Tailwind, Leaflet | frozen in `vendor/` |
| **Map tiles on Live Delivery Tracking** | **not frozen** — `tile.openstreetmap.org`, the only remaining network call in the package. Offline that map shows its markers and controls on a blank background; every other screen is fully offline-capable. |

## Inherited defects

Faithfully reproduced from the live sites rather than silently patched:

- `modules/foodbridge-production-discovery/batch-management/screens/batch/styles-b.css` — referenced
  by Batch Management, already 404 on the live site on the freeze date.
- `https://nishant-devekar.github.io/seed-data/seed.json` — an absolute URL missing its repo
  segment, so already broken upstream; left as it was found.

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
| `#/sales-orders` | Sales Orders | `modules/foodbridge-sales-orders-mockup/screens/orders/screen-01-orders-list.html` |
| `#/distribution-logistics/route-planning` | Route Planning | `modules/foodbridge-module-distribution-logistics/discovery/paths/route-planning/index.html` |
| `#/distribution-logistics/delivery-management` | Delivery Management | `modules/foodbridge-module-distribution-logistics/discovery/paths/delivery-management/screens/delivery/index.html` |
| `#/distribution-logistics/logistic-returns` | Logistic Returns | `modules/foodbridge-module-distribution-logistics/discovery/paths/logistic-returns/index.html` |
| `#/distribution-logistics/live-tracking` | Live Delivery Tracking | `modules/foodbridge-module-distribution-logistics/discovery/paths/live-tracking/index.html` |
| `#/production/batch-management` | Batch Management | `modules/foodbridge-production-discovery/batch-management/screens/batch/batch-workspace.html` |
| `#/production/semifinished-products` | Semifinished Products | `modules/foodbridge-production-discovery/batch-management/screens/batch/semi-finished-products.html` |
| `#/production/configure-recipe` | Configure Recipe | `modules/foodbridge-production-discovery/production-planning/screens/recipie/recipe-v4.html` |
| `#/inventory/finished-goods-inventory` | Finished Goods Inventory | `modules/foodbridge-inventory-mockup/screens/inventory/screen-01-current-stock.html` |
| `#/inventory/raw-material-inventory` | Raw Material Inventory | `modules/foodbridge-inventory-mockup/screens/raw-material-inventory/screen-01-live-stock.html` |
| `#/procurement/purchase-orders` | Purchase Orders | `modules/foodbridge-module-procurement/screens/screen-02.html` |
| `#/procurement/supplier-management` | Supplier Management | `modules/foodbridge-module-procurement/screens/screen-09.html` |
| `#/finance/customer-receivables` | Customer Receivables | `modules/invoice-payment-overview/screens/invoices-payments.html` |
| `#/finance/supplier-payables` | Supplier Payables | `modules/invoice-payment-overview/screens/supplier-invoices-payments.html` |
| `#/workforce-management` | Workforce Management | `modules/foodbridge-staff-mockup/screens/screen-01-staff-list.html` |
| `#/retails-overview` | Store | `modules/retails-overview/discovery/screens/desktop-v6.html` |

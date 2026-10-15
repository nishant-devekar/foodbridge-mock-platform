# Purchase Orders — product-owner prototype

A vanilla HTML/CSS/JS replica of the production Purchase Orders screen (`/sourcing-orders`,
foodbridge-module-purchase mounted by storefront-frontend) and every flow it opens, kept
pixel-identical to it so UX changes can be tried here first. No framework, no build step, no React
anywhere: it runs from a handful of JSON files.

```
python3 -m http.server              # from this folder, then open index.html
index.html?chrome=none              # the screen alone, as the production module renders it
index.html?scenario=empty           # or error / loading — how the purchase-order list's "server" answers
index.html?tenant=all-features      # a tenant variant (js/data/tenant-variants.json)
```

## How it is built

| Path | What it is | Change it to… |
|---|---|---|
| `js/data/dataset.json` | 28 purchase orders (external suppliers and internal sources, every status, with GRNs, invoices, documents and payments), 10 suppliers, 2 internal locations, 13 categories, 16 products, 4 raw materials, 2 policies, 5 customers and 12 sales orders (for the forecast and the Raw Material Calculator). Ages, not dates (`minutesAgo`, `daysAgo`), so it always opens on today | add or reshape business data |
| `js/data/tenant.json` | The QA store's production tenant configuration: feature flags, unit map, tax states, labels, checkout steps | change the default tenant |
| `js/data/tenant-variants.json` | Overrides deep-merged over the tenant, picked with `?tenant=`. `all-features` switches on the Raw Material Calculator (a product → raw-material mapping) and the scanner flag; `no-forecast`, `three-part-units`, `raw-calc-unmapped` | model another tenant |
| `js/data/resolve.js` · `documents.js` | Turn the dataset into dated records, then into the documents production stores (orders, the PO → ORDER → DISPATCH graph, suppliers, catalogues). The parity oracle is seeded from the same documents | — |
| `js/data/host-backend.js` | What the host backend (cafex) does behind the module's ports: stock summary, catalogue writes, the category/product tree, placing a purchase order, the calculator's sales-order and catalogue reads. Shared with the oracle | change what the host answers |
| `js/purchase-orders/server.js` | The in-page "server": each method one endpoint of the module's Express app or one host endpoint, same rules, answered through JSON | change an endpoint's behaviour |
| `js/host/host.js` | What the host hands the module: money and measurement maths (PriceUtil), amount display, status rules, menu labels, checkout steps | change a price, unit or label rule |
| `js/purchase-orders/model.js` | **Every product rule of the list**: counterparty, search, date range, order, paging, amount, status options, document actions | change a list behaviour |
| `js/purchase-orders/list-views.js` · `fulfillment.js` | The list's views (toolbar, table, phone cards, forecast banner, paging) and the row's Details / Items panel: state in, HTML out | change what the list shows |
| `audit-drawer.js` | Status change and goods receipt (GRN) | change the receive flow |
| `po-document.js` · `po-documents-modal.js` | The printable PO / GRN (Download, Print); supplier invoices, payments, other documents | change a document flow |
| `forecast-drawer.js` | The purchase forecast drawer and its hand-off to Create | change the forecast |
| `create-drawer.js` · `order-cart.js` | Create Purchase Order: supplier, catalogue (own, internal source's, Raw Material), quantities, units, prices, policies; the review cart, deleted items, comment, payment step, placing | change creating an order |
| `add-supplier-modal.js` · `add-item-modal.js` | Register Supplier; Add New Item (with its category and unit/price dialogs) | change a create-from-the-drawer form |
| `raw-material-drawer.js` · `materials-po-modal.js` | The host's Raw Material Calculator (by products / by orders, report, print) and Create Raw Material Requests | change the calculator |
| `js/purchase-orders/screen.js` · `flows.js` | The list's state (`window.purchaseOrders.store.state`), which part re-renders when, and the wiring of every flow | — |
| `js/components/` | Icons (production's SVGs, synced — see below), drawer and modal shells, react-select / datepicker / toast look-alikes, DOM helpers (a keyed morph so focus, caret and hover survive re-renders) | — |
| `css/host/custom.css` · `react-select.css` · `purchase-orders.css` · `vendor/` | The host page's stylesheet, library-look widgets, and a few cascade pins. Everything else is Tailwind in the markup, in production's utility order (`js/vendor/tailwind-order.js`) | — |
| `tests/parity/` | The pixel-parity harness — below | — |

## Proving parity

`tests/parity` runs **production itself** as the oracle: storefront-frontend's own source for the
host page, the module's built frontend, and the module's real Express backend (`createApp` and
every service behind it) over its own mock repositories, seeded with *this* dataset. It drives both
through the same states with production's own selectors, and pixel-diffs them. React is the oracle;
the HTML is under test; the production repos are never written to.

```
cd tests/parity && npm install
node run.mjs                     # every state, both sides; report at __shots__/report.html
node run.mjs --only create-* --viewport phone --side html
node exports.mjs                 # PO/GRN downloads (name, every cell, render) and the three prints
node zoom.mjs desktop/list.png   # magnify where a pair differs
node geometry.mjs desktop '<css selector>' [state]   # box + style of matching elements, both sides
node lucide-sync.mjs <state-prefix> | --icon a,b     # copy production's icons into js/components/
node emotion-sync.mjs            # react-select's emotion class names, from the live oracle
node tailwind-order-sync.mjs     # production's Tailwind utility order
```

Both sides run under the same conditions: phone 375×812 (touch), tablet 768×1024, desktop
1280×900, wide 1440×900; the clock fixed at 28 Sep 2026 11:00 IST; `Asia/Kolkata`; `en-IN`;
seeded random numbers and ids. Each state is shot at its viewport, and states with a scroller also
`-full` (every scroller expanded, pointer parked). Pixelmatch threshold 0.1.

Requires the sibling checkouts `foodbridge-module-purchase` (`development/`, installed; its built
`frontend/dist` is tracked), `storefront-frontend` (installed), `foodbridge-module-route-delivery`
(the host's receipt code imports its formatting) and `cafex-backend` (for its `multer`); override
with `PURCHASE_MODULE`, `STOREFRONT`, `ROUTE_DELIVERY`, `CAFEX_BACKEND`. Point them at the versions
production runs: the latest run used module `v0.24.1`, storefront `develop` @ `f47c5bc9` and the
route-delivery tag it pins (`v0.44.0`).

### What the oracle decides

Only the documents in the store (`oracle/to-module-docs.mjs`) and the answers of endpoints other
bounded contexts own. Each follows the shape of the real service, checked against `cafex-backend`
and the QA data dump:

| Fixture | Why it is shaped this way |
|---|---|
| `order.org_id` is the **buyer's** org; an internal PO has `location_id`, an external one `supplier_id`, never both | How QA purchase orders are stored |
| Host ports (stock summary, catalogue writes, purchase-order creation, stage audit) | `js/data/host-backend.js`, each after the cafex adapter that wires it (`routes/v3/purchase.js`, `purchaseModuleApp.js`) |
| The `DEFAULT` catalogue is the location's customer-type catalogue; raw materials live in `RAW-MATERIAL` | What the QA store holds |
| `/api/v2/multiAdmin/setup`, tenant list, seller list, `/v2/productlist/getAll` · `getList`, `/v4/orders`, order history, `/v4/catalogue/get`, `placeorder/sourcing/orderPropogateUp`, credit limits | cafex shapes. `getCreditLimitDetails` answers 500 "No credit limit found for this location" — the QA store has none |
| Document and image storage | A URL per file on `parity.invalid`; no bytes leave the process |
| Supplier payments, order notifications | Record only — nothing is sent (no WhatsApp, email or payment) |
| A path with no fixture | Answers `x-parity-gap: 1` and is logged, so a gap is visible rather than silently green |

## Status

**Latest full run (29 Sep 2026): 590 of 610 captures pixel-identical across 200 states** (305
viewport shots and their `-full` pairs, at phone, tablet, desktop and wide), plus all 7 export and
print comparisons (`exports.mjs`). The 20 that are not identical are the one known residual listed
at the end of the next section. No request went to a path without a fixture.

| Area | States |
|---|---|
| List | populated (4 widths), loading, empty, error, search (name, PO prefix, item, no match), phone filters, status filter menu and pick, quick ranges, date picker (open, start, range, previous month), cleared, page 2 |
| Row | desktop panel (Details, Items, internal, delivered), copy toasts, documents menu (none, with docs, internal), phone card (plain, with docs, internal) |
| Status change / GRN | drawer (4 widths), variance, variance error, history, receipt filled, discard prompt and wait, submitted, submitted with variance, cancelled |
| PO / GRN document | PO (4 widths), internal, closed, GRN short and matching; Download and Print compared by `exports.mjs` |
| Invoices and documents | add, refused, filled, expenses, expense refused, wrong file, leave prompt, saved, payment form, payment saved, skip to list, list, view, edit, save, attachment added/removed; other document add, filled, saved, view |
| Forecast | banner (phone), drawer (4 widths), search, no match, category menu and pick, sort, selection, quantities; the supplier gate (4 widths, no match, add supplier, cancel) and the seeded drawer and cart |
| Create Purchase Order | open (4 widths), supplier menu, search, none, external (4 widths), internal, sub-category, collapsed category, search, quantities, stepper, invalid qty, unit menu and pick, price edit, invalid and changed, cart (external, internal), submit hint, deleted items, restored, cart quantities, comment, phone summary, placed, internal payment (full, split, none, phone), placed internal, discard prompt |
| Register Supplier | open, invalid, filled, bad input, state menu and pick, exempt, GST typed, opening balance, saved |
| Raw Material catalogue | opened, quantities, back, cart |
| Add New Item | open, product, raw material, back, empty submit, category menu and pick, unit dialog and menu, add category (parent menu, invalid, new parent, created); three-part units: units, saved, product created, raw material created |
| Policies | policy modal, warranty, closed, cart policies, toggled, email |
| Tenant `all-features` | Raw Material Calculator: open (4 widths), quantities, search, by orders (selected, all, search), customer-type catalogue filter (menu, pick, typed, removed, blurred), date filter, report name, report by products (4 widths) and by orders, back, unmapped products, closed; `raw-calc-unmapped` empty report; create drawer with all features |
| Create Raw Material Requests (from the report) | open, supplier menu, search, assigned, internal source (its price list), quick-assign menu and all, total required, price edited, review, created, add new supplier, closed |
| Exports | `doc-po`, `doc-po-internal`, `doc-grn-short`, `doc-grn-match` downloads: same file name, every cell identical, render 0 px; PO, GRN and Raw Material report prints: 0 px |

## Known differences from production

**Production behaviour reproduced deliberately.** Each looks like a defect; each is how production
behaves today, found while matching it (and checked against our own fixtures first), and the
prototype does the same so the two stay comparable:

| Where | What production does |
|---|---|
| List, load fails | The screen shows the empty state ("no purchase orders"), not an error: `SourcingOrderScreen` takes the list's `error` and never renders it |
| List rows | The Dispatches / Deliveries chips never appear: the fulfilment prefetch traverses `ORDER.DISPATCH` from the purchase-order nodes, which carry `hasOrder`, not `hasDispatch` |
| Forecast, audit drawer | A two-part measurement the tenant's unit map does not know (`Pkt-Carton`) is printed whole as the unit (PriceUtil's fall-through returns the input) |
| Create drawer and cart | The totals read "Sales Orders Total" / "Sales Orders Summary": the label is the host's menu label for *orders*, which this tenant calls Sales Orders |
| Create, placing an order | Each line's `price` in the payload is 0 when it was not edited: the master-price lookup walks sub-categories the DEFAULT catalogue does not have, and that catalogue carries no organisations |
| Create drawer | The barcode scan button never renders: tenant configs spell the flag `qrCodeScanerEnabled`, the drawer reads `qrCodeScannerEnabled` |
| Cart, policies | Policy activations chosen in the cart are dropped when placing a purchase order: only the (unreachable) admin order path reads `policyActivationRequests` |
| Add New Item | The unit picker lists only three-part unit strings; the default tenant's are all two-part, so it offers no units and an item cannot be created (the `three-part-units` variant shows the rest of the flow) |
| GRN | The audit reads `item.pallet` (sic), a key the lines do not carry |
| Copy toast | "Order reference reference copied: …" |
| Raw Material Calculator | An empty sub-category is flattened into the product list as a product; the catalogue filter's focused option falls back to the first on every re-render |
| Create, phone | The product panel shows the stock summary's available-less-required stock; the desktop row shows the product's own stock |
| Internal payment step | The credit-limit lookup's 500 is swallowed; the step renders as if there were no limit |
| Phone action bar | Padded twice at the bottom: the host's `.fixed.bottom-0` rule (custom.css, meant for drawer and modal Cancel/Save bars) adds safe-area + 1rem under a row that already pads for the safe area, so the tabs sit high over ~20px of white. (The v7 copy corrects this for the demo platform; v6 keeps production's look.) |

**Outside what a static prototype can do.** These hand off to other systems; the prototype does
nothing, or says so:

| Production | Prototype |
|---|---|
| Invoice, document and product-image uploads go to S3 | Files stay in the page (object URLs); the saved record points at them |
| Recording a supplier payment posts to the host's ledger | The payment is recorded in the page only |
| Register Supplier → Verify GST / UDIN calls the host's GST lookup | "Failed to fetch GST details" |
| Placing an order notifies the supplier (WhatsApp, email) | Nothing is sent |
| Print opens the browser's print dialog | Same; the dialog itself is the browser's |
| In the native app, PO / GRN Download and Print render the document to a PDF and open it in the system viewer | The web behaviour (a file download, the print dialog) |
| Supplier phone and email link to `tel:` / `mailto:` | Same links |
| Record ids are MongoDB ObjectIds | Deterministic ObjectId-shaped ids (`6a1…`) |

**Residual pixel differences.** Twenty phone captures differ by 66–370 pixels (≤ 0.12%): the anti-aliasing of the text in the
list's sticky search-and-filter bar (and the drawers opened over it), which production draws one
pixel lower. DOM, computed styles and every box are identical on both sides (`geometry.mjs`: 0 of
53 boxes differ; the compositor layer trees match), and forcing Chrome to re-rasterise the layer
(`LayerTree.enable`) makes the pair identical — the glyphs depend on the page's paint history, not
on anything the page says. Recorded as known, not masked: the captures are compared as they are.

`legacy-hub.html`, `screens/` and `seed-data/` are the previous, hand-ported prototype, kept for
reference (Supplier Management still opens `screens/screen-09.html`); the platform now opens
`index.html` for Purchase Orders.

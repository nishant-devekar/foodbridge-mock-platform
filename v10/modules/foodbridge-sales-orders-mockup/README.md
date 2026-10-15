# Sales Orders — product-owner prototype

A vanilla HTML/CSS/JS replica of the production Sales Orders screen (`/orders`) and every flow it
opens, kept pixel-identical to it so UX changes can be tried here first. No framework, no build
step, no React anywhere: it runs from a handful of JSON files.

```
python3 -m http.server              # from this folder, then open index.html
index.html?chrome=none              # the screen alone, as the production module renders it
index.html?scenario=empty           # or error / loading — how the list's "server" answers
index.html?tenant=all-features      # a tenant variant (js/data/tenant-variants.json)
```

## How it is built

| Path | What it is | Change it to… |
|---|---|---|
| `js/data/dataset.json` | 48 orders, 12 customers, 16 products, 3 staff, 2 route templates, and the dispatches, deliveries and returns against them. Ages, not dates (`placedMinutesAgo`), so it always opens on today | add or reshape business data |
| `js/data/tenant.json` | The QA store's production tenant configuration: feature flags, status workflow, labels | change the default tenant |
| `js/data/tenant-variants.json` | Overrides deep-merged over the tenant, picked with `?tenant=`. `all-features` switches on Forecast, Generate Demand, Download All, Allocation Status and Google Sheet | model another tenant |
| `js/data/resolve.js` | Turns the dataset into dated records and order numbers | — |
| `js/sales-orders/model.js` | **Every product rule**: search, filters, paging, amounts, status options, invoice/edit eligibility, fulfilment, allocation, Smart Insights, audit pricing, order placing, follow-up windows, delivery eligibility, the forecast engine, the CSV export | change a behaviour |
| `js/sales-orders/controls.js` · `table.js` · `fulfilment.js` · `footer.js` · `overlays.js` | The list screen's views: state in, HTML out | change what the list shows |
| `audit-drawer.js` · `create-views.js` · `cart-modal.js` · `reminders.js` · `delivery.js` · `bulk-views.js` · `forecast.js` · `demand.js` · `demand-report.js` · `thermal.js` | Each flow's views | change a flow's screens |
| `create-order.js` · `bulk.js` · the `…Flow` in each flow file | Each flow's state and interactions | change a workflow |
| `js/sales-orders/screen.js` | The list's state, which view re-renders when, and the wiring of every flow | — |
| `js/components/` | Icons (the production SVGs, synced — see below), drawer and modal shells, tooltips, DOM helpers | — |
| `css/host.css` · `components.css` · `sales-orders.css` | The host page, library-look widgets (react-select, react-toastify, rc-drawer, react-tooltip), screen rules. Everything else is Tailwind in the markup | — |
| `tests/parity/` | The pixel-parity harness — below | — |

The app state is one object (`window.salesOrders.store.state` in the console), and list states are
deep-linkable: `#/orders?search=2026925&status=Pending&page=2&expand=ord-003`.

## Proving parity

`tests/parity` runs the **production module itself** as the oracle: its real Express backend
(router, `SalesOrdersService`, its own mock repository and ports) over an in-memory store seeded
with *this* dataset, and its real built screens, next to this prototype. It drives both through the
same states with the production app's own selectors, and pixel-diffs them. React is the oracle; the
HTML is under test; the production repo is never written to.

```
cd tests/parity && npm install
node run.mjs                     # every state, both sides; report at __shots__/report.html
node run.mjs --only list,insights --side html
node serve.mjs                   # both running side by side, for looking at by eye
node zoom.mjs desktop/list.png   # magnify where a pair differs
node geometry.mjs desktop '<css selector>' [state]   # box + style of matching elements, both sides
node lucide-sync.mjs <state-prefix> | --icon a,b     # copy production's icons into js/components/icons.js
```

Both sides run under the same conditions: phone 375×812, tablet 768, desktop 1280×900, wide
1440×900; the clock fixed at 25 Sep 2026 11:00 IST; `Asia/Kolkata`; `en-IN`; seeded random order
numbers. Each state is shot twice — the viewport, and `-full` with every scroller expanded and the
pointer parked. Pixelmatch threshold 0.1.

Requires the sibling checkout `foodbridge-module-route-delivery` with `development/sales-orders`
installed and built.

### What the oracle decides

Only the documents in the store (`oracle/to-module-docs.mjs`) and the answers of endpoints other
bounded contexts own (tenant setup, customer directory, catalogue, staff, categories). Each follows
the shape of the real service, checked against `cafex-backend` and the QA data dump:

| Fixture | Why it is shaped this way |
|---|---|
| `order.org_id` is the **buyer's** org | 3,700 of 3,707 QA orders. (The module's addendum-053 comment says "seller org"; the data says otherwise, and customer-name search depends on it.) |
| Order lines carry `unitPrice` ("44.10 ₹/Pack", tax-inclusive) and `categoryId` (the product's sub-category) | What every order the app places stores; receipts read the charged rate from `unitPrice`, the demand report files products by `categoryId` |
| `/v2/catalogue/get/products`, `/get-default`, `/v2/catalogue/get/default`, `/v4/category/all` | cafex `catalogueServices.getCatalogueProducts` / `categoryservice.getCategories` shapes |
| `POST /v2/multiAdmin/orders/route-delivery` | cafex `routeDeliveryService.createRouteDelivery`: orders placed through the module's own `/v4/proxyorder/bulk`, a bypass dispatch per order, one delivery staffed from the route template |
| Reminders transport | Records, never sends — no WhatsApp or email leaves the process |
| A path with no fixture | Answers `x-parity-gap: 1` and is logged, so a gap is visible rather than silently green |

## Status

**Latest full run (27 Sep 2026): 272 of 278 captures pixel-identical** (139 viewport shots and their `-full` pairs, across 88 states). The six that are
not identical are the known residuals listed at the end of the next section.

| Area | States |
|---|---|
| List | populated (4 widths), loading, empty, error, search by name / number / no match, status menu and filter, date picker, pages 2 and 3, row and phone card expanded, Smart Insights, copy toast, tooltips, invoice menu, phone create menu |
| Status change (audit) | drawer, variance, comment required, discard prompt, submitted |
| Create Sales Order | drawer, customer menu (paged), catalogue, search, no match, sub-category, quantities, cart, payment, placed, list after placing |
| Follow-up Reminders | open, yesterday, search, expanded, selected, sent, done, hand-over to Create Order |
| Create Delivery | open, window, picked, expanded, search, staff, review, created |
| Bulk Sales Orders | configure, customer menu, catalogue menu, catalogue confirmation, catalogue added, customers picked, discard prompt, grid, quantities, clear-quantity prompt, cleared, price edit, price edited, preview, preview expanded, created |
| Route Bulk Sales Orders | route picker, route picked, grid, created |
| Invoice → Thermal Print | receipt preview (58 mm, phone and desktop), 80 mm |
| Tenant `all-features` | toolbar (4 widths) with Allocation Status column; Forecast (open, customer, Coming up, search, add to order); Generate Demand (open, selected, report name, report preview); Google Sheet (menu, unconfigured export) |
| Download All | `orders.csv` compared cell by cell: identical on every row except `_id` (the prototype's own record ids) |

## Known differences from production

**Production behaviour reproduced deliberately.** Each looks like a defect; each is how production
behaves today, found while matching it, and the prototype does the same so the two stay comparable:

| Where | What production does |
|---|---|
| Create Delivery | Order totals leave the order discount out (the eligible-orders projection omits `orderDiscount`) |
| Create Delivery | Cancelled orders are offered as eligible |
| List after Create Delivery | Fulfilment chips stay stale until the page's set of order ids changes (the table refetches only then) |
| Create Order, customer handed over from Reminders or Forecast | The picker resolves the customer by id, and every re-render cancels that lookup; its loading dots stay stuck in most runs (2 of 3 observed) and clear in the rest. The prototype shows the stuck outcome |
| Create Order, payment step | Recording a payment is silently refused for non-private customers (the seller's location is sent as the buyer's) |
| Follow-up Reminders, phone | The "+ Sales Orders" button has no tooltip (its tooltip id does not match) |
| Bulk grid | The sub-category header row has an extra filler cell; each cell class carries a literal `rowSpan="2"` token |
| Bulk totals | The grid totals a line as price × qty × tax (₹ 317.63), the preview as the rounded unit price × qty (₹ 317.65), and the placed order stores the rounded unit price (₹ 216.85 for a customer the grid showed at ₹ 216.83) |
| Bulk, "By Catalogue" | Confirming a catalogue adds its customers but not its products: the selection is rebuilt from the products ticked by hand whenever the customers change |
| Thermal receipt | Built from the list row, which carries no discount: a ₹ 549 order prints ₹ 575 |
| Download All | Built from the same rows: discount and shipping are 0.00, the total is the undiscounted subtotal, the payment method is "NA" |
| Generate Demand | Orders whose dispatches are all in the workflow's `deliveryAllowedStatuses` are hidden as "delivered" — for this tenant that is "Dispatch Created", so orders still to go out are the hidden ones |
| Generate Demand preview | "Create Stock Request" renders green, not its intended blue (stylesheet order) |
| Google Sheet | With no Google credentials configured, both modes answer "Google Sheet credentials missing…" — as they do here, where there is no Google account |
| After any drawer closes | Its red ✕ stays in the DOM (rc-drawer keeps closed drawers mounted) |

**Outside what a static prototype can do.** These hand off to other systems; the prototype does
nothing, or says so:

| Production | Prototype |
|---|---|
| Invoice → A4 Print opens a server-rendered PDF | The menu closes |
| Thermal Print connects a printer over WebUSB / Web Bluetooth and prints ESC/POS | The preview and settings match; "Connect … Printer" does nothing, so Print stays "Connect Printer First" |
| Generate Demand → Download Excel (an .xlsx) and Create Stock Request (the Procurement module's modal) | Nothing happens. Print prints the report |
| Google Sheet export / sync into a live spreadsheet | The unconfigured answer above |
| View (👁) and Timeline (🕒) go to host pages `/order/…`, `/order-timeline/…` | Nothing happens — those pages belong to storefront-frontend, and the module standalone behaves the same |
| Edit | Always disabled for this tenant: its workflow allows editing in no status |
| Record ids are MongoDB ObjectIds | The prototype's own ids (`ord-001`) — visible only in `data-testid`s and the CSV's `_id` column |

**Residual pixel differences.** Six captures in Follow-up Reminders differ by 20–250 pixels
(≤ 0.04%): the anti-aliasing of tooltip text. Tooltip geometry is identical on both sides
(`geometry.mjs`); the glyph rasterisation depends on the page's paint history. Recorded as known.

`legacy-hub.html`, `screens/` and `assets/mock-orders.js` are the previous, hand-ported prototype,
kept for reference; the platform now opens `index.html`.

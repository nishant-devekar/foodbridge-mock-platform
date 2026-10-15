# Control Tower — implementation audit (Phase 0)

21 Sep 2026 · v7 · against `FOODBRIDGE_BUSINESS_CONTROL_TOWER_REQUIREMENTS.md` and
`FOODBRIDGE_CONTROL_TOWER_UX_FLOW.md` (product owner), plus the desktop and mobile
reference images.

Scope decision from the owner, same day: **no RBAC — one role, the owner, who sees
and does everything.** The action *safety* classes (A read · B prepare · C execute
with confirmation · D policy) still apply; they are about what FoodBridge may do
on its own, not about who the user is.

## 1. What exists today

| Area | What is there | File |
| --- | --- | --- |
| Control Tower screen | 235-line vanilla-JS screen: greeting, three counts, ranked "nudge" cards, "Not now". No drill-down, no actions beyond a hand-off to another module, no ₹ anywhere | `screens/control-tower.{html,js}`, styles in `screens/screens.css` |
| Signal engine | `FBNudges`: five deterministic detectors (off-cadence, slipping, out-of-stock, low-stock, no-history), a written-down score, dismiss/acted memory in `localStorage fb.v7.nudges.seen`, and `assertNoMoney()` | `assets/nudges.js` |
| Read model | `FBContext`: loads the tenant's export and delegates every rule — cadence to `FB_EVIDENCE`, reorder drafts to `FB_PREDICT` | `assets/context.js` |
| Tenant records (Miha's, real) | 40 B2B customers, 86 products with `systemStock` (25 at zero), shelf stock audits · **532 real sales orders** (Zoho export imported **27 Aug 2026**, last order **24 Aug 2026**) each with a ₹ `value` and lines | `modules/foodbridge-customer-mockup/v3/screens/customers/{seed.inline,order-history}.js` |
| Reorder engine | back-tested `generatePredictiveOrder()` | `…/customers/predictive-order.js` |
| Cadence / missed orders | the ONE `orderingStatusFor()` + `missedOrders()` (D-016) | `modules/foodbridge-onboarding/screens/evidence.js` |
| Ledger (money) | Onboarding's Dataset (`FB_DATASET`) — invoices, payments, credit notes, quotes, purchase orders, bills, expenses, suppliers — **only when the session imported them** (Zoho/Xero/files, or "Try sample data", which derives them deterministically from the export: `sample-business.js`). Kept in `sessionStorage fb.v7.flow → dataReady.dataset` | `modules/foodbridge-onboarding/screens/{dataset,sample-business}.js` |
| Orders created in FoodBridge | `localStorage fb.v7.orders` — written by onboarding's Create Order (`createOrder()`), read by Order Drafts | `onboarding.js` |
| MRP | 63 of 86 product names carry an MRP; `FB_SAMPLE.mrpOf()` parses it | `sample-business.js` |
| Account | `fb.v7.account` (name, business, mobile) | onboarding |
| Exit bar / human channel | `FB_EXIT` — shared EXIT DEMO bar (tabs API, `#fbx-foot`; the shell stands its own bar down when the framed page draws one) and the feedback queue (`fb.v7.feedback.queue`, bridge `/api/feedback`, not deployed) | `assets/exit-demo.js` |
| AI infrastructure | The bridge uses `@anthropic-ai/sdk` for photo extraction only (`zoho-function/extract.js`). **No conversational agent exists**, and the static site cannot hold a key | — |
| Events / notifications | None. No event bus, no push. Only the browser's `storage` event between tabs | — |
| RBAC | None (`personas` are business types, not roles). Out of scope by the owner's call | — |
| Tests | `node --test` headless suites next to the code (`modules/foodbridge-onboarding/test/dataset.test.js`); no browser test harness in the repo | — |

### What the tenant's evidence can and cannot support (D-015)

D-015 is binding here: **evidence determines capability; the UI never shows an
unavailable metric as zero, an invented metric, or another tenant's data.**

| Pulse / signal | Evidence | Verdict |
| --- | --- | --- |
| Sales | real sales-order values (₹) | **Available** — as "last 30 days of records vs the 30 before", never "today" (no order after 24 Aug) |
| Orders | real orders + orders created in FoodBridge | **Available** |
| Stock / stockout risk | `systemStock` + order velocity + MRP | **Available**; ₹ exposure at MRP where the name carries one, else "not quantified" |
| Customers past their cycle | cadence engine | **Available**; ₹ = each shop's own average order value |
| Slow / dead stock | stock + order history | **Available** |
| Demand opportunity | order history | **Available** |
| Receivables / overdue | invoices, payments | **Only with a ledger in the session**; otherwise *unavailable, with the unlock named* |
| Supplier bills due | bills | **Only with a ledger** |
| Procurement suggestions | stock + velocity; suppliers only with a ledger | **Available** (supplier named when known) |
| Supplier delay | needs expected delivery dates on POs — no source has them | **Unavailable** |
| Delivery / routes | Delivery Management runs on its **own** 30-customer, 20-SKU seed — another business | **Unavailable** — borrowing it is exactly what D-015 rejects |
| Expiry risk | no batch or expiry dates anywhere for this tenant | **Unavailable** |

## 2. What is replaced, what is reused

**Scrapped:** `screens/control-tower.js` (whole), `assets/nudges.js` (whole — its
detectors are subsumed, its store superseded), the Control-Tower rules in
`screens/screens.css`, and the old `fb.v7.nudges.seen` store.

**Reused, unchanged:** `FB_EVIDENCE` (cadence, missed orders), `FB_PREDICT`
(reorder drafts), `FB_DATASET` / Dataset contract (ledger), `FB_SAMPLE.mrpOf`
(MRP), `fb.v7.orders` (the order store — Control Tower writes the same record
shape `createOrder()` does, so Order Drafts shows them), `fb.v7.account`,
`FB_EXIT` (exit sheet), `platform.js` hand-off (`#/route`).

**Extended:** `assets/context.js` — also reads the session's ledger and the orders
created in FoodBridge, so a new order resolves a "not reordered" signal on the
next evaluation. Still one reader; still delegates.

## 3. What is introduced (the smallest additions)

| New | Why nothing existing covers it |
| --- | --- |
| `assets/ct/signals.js` — detectors, severity, impact (with its calculation), transparent priority with reasons, grouping, dedup | the requirement's signal model; pure, node-testable |
| `assets/ct/store.js` — signal lifecycle, dismiss reasons, audit log, purchase requests, outbox, support handovers (`localStorage fb.v7.ct.*`) | no lifecycle, audit, PO or message store exists for this tenant |
| `assets/ct/actions.js` — action registry with safety class, preview → confirm → execute → outcome, failure paths | nothing executes business actions today |
| `assets/ct/assistant.js` — FoodBridge AI: intents over the signal engine (summary, why, first, prepare, freshness), never executes without the user's confirm | no agent exists; deterministic truth first (Rule 4). An LLM can sit behind it later via the bridge |
| `screens/control-tower.{html,js,css}` — new UI | the scrapped screen |
| `test/control-tower/*.test.js` | unit + integration + failure suites; `e2e/` browser scenarios |

## 4. Architectural risks

1. **Stale import presented as live** — the export is 25 days old. Freshness is a first-class state; nothing says "Live".
2. **Session-scoped ledger** — money signals exist only in a session that imported a ledger. Stated in Data status, never hidden.
3. **Actions without a backend** — purchase requests and reminders are recorded, not transmitted; the UI says so (no WhatsApp/e-mail sender is connected in the demo).
4. **Clock** — cadence uses the live clock (existing decision); sales windows anchor on the data's own latest record so a gap after import is not read as a collapse in sales.

## 5. Sequence

1. Signal engine + read-model extension + unit tests
2. Store + actions + integration tests (stockout → PR → monitoring first, then reorder, reminders)
3. Assistant + tests
4. UI: shell, pulse, attention, detail drawer/sheet, action review/success/failure, Business Now, AI, freshness, mobile nav
5. Browser E2E at desktop and phone widths; traceability matrix

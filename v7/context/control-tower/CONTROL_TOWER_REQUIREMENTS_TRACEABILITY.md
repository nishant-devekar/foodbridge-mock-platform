# Control Tower — requirements traceability

21 Sep 2026 · v7. Status: **Done** · **Partial** (built, with a stated limit) ·
**Unavailable** (the evidence does not exist for this business; shown as such,
per D-015) · **Out of scope** (owner's call, or a V1 non-goal).

Files: `assets/ct/{state,signals,store,actions,assistant,tower}.js`,
`assets/context.js`, `screens/control-tower.{html,js,css}`.
Tests: `test/control-tower/*.test.js` (headless, 40) and
`test/control-tower/e2e/control-tower.e2e.js` (browser, 11).

## Screen and hierarchy

| Req | Implementation | Test | Status | Limitation |
| --- | --- | --- | --- | --- |
| §4 exception-first hierarchy; understand in 10 s | `control-tower.js home()` — greeting states the count, pulse, then ranked Needs Attention | e2e 1 (critical first, opportunities last) | Done | |
| §5 layout: Pulse → Needs Attention → AI → Business Now | `.ct-layout` areas; desktop 3-column, phone stacked | e2e 1, e2e 8 | Done | |
| §6 Business Pulse ≤ 7 metrics: sales, orders, inventory, delivery, cash | `signals.js pulse()` — 6 cards incl. customers | signals "windows anchor", e2e 1 | Done | Sales is "30 days of records", never "today" (no order after 24 Aug) |
| §6.4 Delivery pulse | shown as *Not available*, reason + unlock | e2e 1 | Unavailable | Delivery Management runs on another business's seed |
| §6.5 Cash pulse | receivables/overdue from the session ledger; *Not available* without one | signals "no ₹0", "sample ledger" | Done / Unavailable | Money exists only when invoices were imported |
| §26 healthy state; no fake alerts | `attention()` healthy card, opportunities kept | — (rendered path) | Done | |
| §27 data-quality state; never healthy from missing data | `freshness()`, `unavailable()`; stock pulse null without counts | failures "missing inventory", signals "missing stock counts" | Done | |
| §28 filters (location, warehouse, date) | — | — | Out of scope | One location in the records; date context shown as "Records to 24 Aug" |

## Signals

| Req | Implementation | Test | Status | Limitation |
| --- | --- | --- | --- | --- |
| §7 card: severity, what, impact, why, action, freshness, source | `sigRow()`, `detail()` | signals 1, e2e 2 | Done | |
| §7.2 four severities that drive rank | `SEVERITY`, `weigh()` | signals "ranking" | Done | |
| §8 order risk | `detectOrderRisk` — FoodBridge orders stock cannot fill | loop "order risk" | Done | Only orders made in FoodBridge: the import carries no open/pending status |
| §9.1 stockout risk (stock, committed, velocity, open POs) | `detectStockout` + `demand()` | signals "stockout", loop 1 | Done | No supplier lead time in any record; covers 30 days + 7 safety instead |
| §9.2–9.3 overstock / dead stock | `detectSlowStock` | signals 1 | Done | |
| §9.4 expiry risk | `unavailable()` → "No batch or expiry dates" | assistant "delivery or expiry" | Unavailable | No batches in the records |
| §10 procurement: what to buy, how much, from whom | stockout recommendation lines (qty, supplier by category) | loop 1 | Done | Supplier named only with a ledger |
| §11 supplier intelligence / delays | `unavailable()` | — | Unavailable | POs carry no expected dates |
| §12 delivery control | `unavailable()` | e2e 9 (Delivery tab) | Unavailable | |
| §13 collections: overdue, top-share, reminders | `detectOverdue` | loop "overdue", e2e 3 | Done | Needs a ledger in the session |
| §14–15 sales / customer: reorder due, inactivity, demand up | `detectReorderDue`, `detectReorderSoon`, `detectDemandUp` | loop "reorder", signals 1 | Done | |
| §16 impact; "not yet quantified" when unreliable | each detector's `impact.calc`; null → "Impact not yet quantified" | signals "no price" | Done | ₹ only from real order values, ledger balances, or the MRP printed in a product name — and it says which |
| §23 signal object | detector output (`type, severity, title, summary, impact, evidence, rows, recommendation, status, fingerprint`) | signals 1 | Done | Adapted to this codebase, per the spec |
| §24 lifecycle; dismissal recorded | `store.reconcile/acknowledge/dismiss/inProgress/restore` | loop "lifecycle" ×3 | Done | |
| §25 transparent ranking with reasons | `weigh()` — sum of named parts, reasons as sentences | signals "ranking", drawer "Why it ranks here" | Done | |
| §41 deduplicated, grouped, resolved disappear | one signal per kind; `reconcile` resolves | signals "grouped", loop "resolved", loop "idempotent" | Done | |

## Actions, safety, audit

| Req | Implementation | Test | Status | Limitation |
| --- | --- | --- | --- | --- |
| §18 classes A–D; confirmation per class | `actions.js CLASS/REGISTRY/POLICY`, `execute()` | loop 1 (refused unconfirmed), failures "assistant cannot bypass" | Done | Class D: no policy enabled |
| §19 action card WHAT/WHY/IMPACT/RECOMMENDATION/ACTION | detail drawer + review screen | e2e 2 | Done | |
| §34C create PO | `create_purchase_request` → `fb.v7.ct.purchaseRequests`, read back as on order | loop 1, e2e 2 | Done | Recorded in FoodBridge; nothing reaches a supplier (said on screen) |
| §34C send reminder | `send_reminders` → outbox | loop "overdue", e2e 3 | Partial | No WhatsApp sender connected: queued, and the screen says so |
| orders from signals and from Create | `create_orders` → `fb.v7.orders` (onboarding's shape) | loop "reorder", e2e 8 | Done | |
| UX §30–31 success / failure with context; nothing changed | `resultScreen()`; all-or-nothing writes | failures "store cannot write", "partial", e2e 6 | Done | |
| §32 outcome feeds back into the signal | tower re-reads what actions wrote | loop 1 (monitoring), loop "reorder" (shops leave) | Done | |
| §40 audit: who, human/AI, what, before/after, when, why, approval, outcome | `store.audit()` on every event | loop 1, failures "AI-assisted" | Done | |
| §20 human-in-the-loop with packaged context | `prepareEscalation` / `escalate` | e2e 7 | Partial | Support desk not connected: the handover waits, and says so |

## FoodBridge AI

| Req | Implementation | Test | Status | Limitation |
| --- | --- | --- | --- | --- |
| §17 summarise, explain, recommend, prepare | `assistant.js` intents over the signal engine | assistant ×9 | Done | No language model is called: intent matching + templates. Deterministic truth first (Rule 4) |
| AI cannot bypass authorisation | proposals only; `execute` refuses non-owner | failures "assistant cannot bypass", e2e 4 | Done | |
| AI states stale / unavailable data | freshness + unavailable answers | assistant "live", "delivery", "money with no invoices" | Done | |
| AI unavailable → tower still works | `safeAsk()` | failures "AI unavailable" | Done | |
| UX §26 voice entry | Web Speech API mic where the browser has it | — (browser-dependent) | Partial | Hidden where unsupported |
| §32 same engine for WhatsApp / voice | the assistant reads `CTTower`, not its own facts | — | Partial | WhatsApp/voice channels not wired to it in this build |

## Real-time, mobile, notifications

| Req | Implementation | Test | Status | Limitation |
| --- | --- | --- | --- | --- |
| §21 freshness visible; never stale-as-live | header chip, Data status sheet, per-source states | signals "stale", failures "delayed sync", e2e 1 | Done | |
| UX §37 updates without reordering under the user | `storage` event + 60 s pass → pill; critical → toast | e2e 10 | Done | No server push: other tabs and the clock are the event sources |
| UX §38 sync status sheet | `openStatus()` | e2e (via rail) | Done | |
| §30 / UX §41 mobile-first; bottom sheets; sticky CTA; no horizontal scroll | phone layout, `.ct-drawer` sheet, `.ct-df` pinned | e2e 8, 9 | Done | |
| Mobile nav: Home, Insights, Create, Alerts, Support | `nav()` | e2e 8 | Done | EXIT DEMO moved to the header on phones |
| Part of the platform, under Overview with Reports (the dashboard renamed) (owner, 21 Sep) | `modules.json` nav group `overview`; old `#/control-tower` / `#/dashboard` links resolve via `platform.js` aliases; framed mode in `control-tower.js` (`applyFrame`) | e2e 11 | Done | Next to the shell's sidebar the page's tab bar is hidden; on a phone the tab bar stands in for the shell's EXIT DEMO bar |
| UX §43 desktop right drawer | `.ct-drawer` at 1100+ | e2e 2 | Done | |
| §31 notifications only for meaningful events | bell = new critical/high | — | Partial | In-app only; no push/WhatsApp/e-mail sender |
| UX §36 notification deep-links to the signal | `?signal=` / `#/control-tower?signal=` | — | Done | |
| UX §35 global search | desktop header: alerts, products, shops, orders → quick view | — | Done | Desktop only |
| UX §55 accessibility | semantic buttons, labels on icon buttons, severity in words, Esc closes, focus returns | — | Partial | No automated a11y audit run |
| §39 permissions / RBAC | — | — | Out of scope | Owner's call, 21 Sep: one role that owns everything |
| §33 / Phase 5 network intelligence | — | — | Out of scope | V1 non-goal |
| §43 observability | audit log only | — | Partial | No telemetry pipeline in this repository |

## Definition of done (§51)

Real business data represented ✓ · Pulse ✓ · deterministic, explainable signals ✓ ·
exception-first ✓ · impact where reliable ✓ · drill-downs ✓ · actions ✓ ·
authorisation (safety classes) ✓ · audited ✓ · AI explains ✓ · AI prepares ✓ ·
AI cannot bypass ✓ · freshness ✓ · missing/stale handled ✓ · mobile ✓ ·
unit ✓ · integration ✓ · E2E ✓ (delivery and expiry scenarios assert the
*unavailable* state — the evidence does not exist) · traceability ✓ ·
no duplicate source of truth ✓ (orders written to onboarding's own store;
engines reused; the Control Tower's own records are lifecycle, audit, requests,
outbox, handovers — which nothing held before).

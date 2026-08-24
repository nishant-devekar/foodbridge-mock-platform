# Stock Audit & Health vNext — Pre-Implementation Audit

**Status:** Audit complete. §14 now carries a concrete, decided implementation contract (routes, views, components, reuse map, integration boundaries) superseding the earlier open-ended §14–16. **No implementation performed** — this remains a planning document. Awaiting review/approval before any vNext code is written.
**Scope of this document:** What exists today (from the code, not the docs), compared against `customer-stock-audit-ux-requirements.md`, plus a resolved build contract for vNext.
**Repo state audited:** `main` @ `c0972d2` ("Stock Audit & Health: collapse the audit flow to count -> finish -> leave"), working tree clean except `.claude/`.

---

## 1. Executive Summary

The current Stock Audit & Health feature (`v2/modules/foodbridge-customer-mockup/v1/screens/customers/stock-audit.js`, 3,284 lines) is a **field-operations audit tool**, not the **quick-count entry** the new requirements describe. It already went through one simplification pass — commit `c0972d2` collapsed a three-step creation wizard (pick customer → pick location → confirm purpose/date) down to "tap Start Audit, land straight in the count." That instinct is exactly the direction vNext wants to continue, just much further.

The gap is not that the current experience is unfinished — it's that it's built around a different job. Today's Workspace assumes a rep is doing a **comprehensive shelf audit**: every product in the catalogue is listed up front, ordered by what needs attention, with health scoring, condition breakdowns, shelf-presence tracking, and recommended actions computed at the end. vNext wants a **fast, targeted count**: search for the 3–4 products that need checking, enter a quantity, done. These are different tasks that happen to share a customer and a product list.

Three concrete findings shape the recommendation:

1. **Both "search-first" screens the requirements ask for already exist in code, but both default to the opposite behavior.** The customer picker (`renderCreateCustomer`) and the product list (`renderWorkspace`) both render their **full unfiltered list** when the search box is empty (`stock-audit.js:2338`, `stock-audit.js:2456`). Making them empty-state-first is a small, surgical change to two functions — not a rebuild.
2. **"Route Delivery," as the requirements describe it (Collection / Return / Delivery / Customer Stock Audit), does not exist anywhere in this codebase.** It is a permanently-stubbed sidebar item everywhere it appears (`data-stub="Route Delivery"` → toast: *`"Route Delivery" is outside this discovery iteration.`*). The real, working per-stop screen is a **different module** — Delivery Management (Distribution & Logistics) — with a different action set (Collect Payment / Edit Order / Skip Stop) and, confusingly, its **own, unrelated "Stock Count"** step already in its route-settlement flow.
3. **There is no WhatsApp integration anywhere.** The one WhatsApp-adjacent UI in the repo is a "Send via WhatsApp" button in Retail Customers that only fires a toast (`customers.js:1090`) — no link, no deep-link handler, no `wa.me` URL. Entry Point A requires new infrastructure, not a wire-up of something existing.

None of this blocks vNext. It does mean the "two entry points already exist, just add an action" framing in the requirements doc needs correcting before scoping: Entry Point B needs a real decision about *which* module owns the action, and Entry Point A needs to be built, not connected. **§14 resolves both**, plus every other scope ambiguity, into a concrete contract — exact routes, new views, new components, and a reuse map — ready to build against.

---

## 2. Current Architecture

### 2.1 What kind of project this is

There is no build step, no package manager, and no backend anywhere in the path this feature touches.

| | |
|---|---|
| **Stack** | Vanilla HTML/CSS/JS. No framework, no bundler, no TypeScript. |
| **package.json** | None, anywhere in `v1/` or `v2/`. Confirmed absent by search. |
| **Backend / API** | None. `customers.js:36`: *"Every action is real against the seed data (persisted to localStorage for the session) — nothing here calls an API."* Same is true of `stock-audit.js`. |
| **Persistence** | `localStorage`, browser-session-scoped, per the keys in §11. |
| **Serving** | `python3 -m http.server` (`v2/serve.sh`), or `tools/dev.py` for cross-module local dev (rewrites `assets/modules.json` → `assets/modules.local.json`, gitignored). |
| **Design system** | No component library. Each module ships its own `styles.css` + a feature-specific stylesheet, hand-authored, copied class-for-class from a real captured app where one exists. |
| **Tests** | None for this module or its repo. (Two *other*, unrelated repos — `invoice-payment-overview`, `foodbridge-module-procurement` — have npm workspaces with real test suites, per `DEVELOPMENT.md`; irrelevant to Customer Management.) |

This repo (`foodbridge-mock-platform`) is a **nav shell**: the live site at `/` iframes each module from its owning team's own GitHub Pages repo. `v1/` and `v2/` are **frozen, self-contained snapshots** — full local copies, no iframes to the outside world, that stop changing once cut. **`v2` is current** (README: "v2 is the current frozen version"). All exploration below is against `v2`.

### 2.2 Locating the exact target

```
Customer Management
└── Stock Audit & Health
```

resolves to:

| | |
|---|---|
| **Nav entry** | `v2/assets/modules.json:140-146` — `id: "stock-audit-health"`, under section `id: "customer-management"` |
| **Route** | `#/customer-management/stock-audit-health` (hash router in `v2/assets/platform.js`) |
| **Loaded file** | `modules/foodbridge-customer-mockup/v1/screens/customers/stock-audit.html` |
| **Logic** | `.../screens/customers/stock-audit.js` (3,284 lines) |
| **Mounts through** | `shell.js`'s `mountShell()` — same sidebar/topbar/toast/sheet primitives as `b2b-customers.html` and `retail-customers.html`. Not a standalone app, not a drawer. |
| **Standalone-openable** | Yes — the file can be opened directly with `?customer=c01` etc. for review, per its own header comment. This deep-link param already works (`stock-audit.js:3277-3280`) and is a real asset for vNext entry points (see §4). |

This confirms the requirements doc's assumed route is still correct — nothing has moved.

Important scoping note: **`stock-audit.html`/`.js` exist only in `v2`, not `v1`.** `v1` is otherwise a fully frozen snapshot; Stock Audit & Health was added later as a deliberate, called-out exception (`stock-audit.html:1-46`, the file's own header comment). There is no earlier version to diff against — `git log` on this file shows exactly two commits: the initial freeze (`b5f5bed`) and the wizard-collapse (`c0972d2`).

### 2.3 Routing & state management

`v2/assets/platform.js` is the shell's hash router (`#/section` or `#/section/submenu`), unrelated to any app-level router elsewhere. Inside Stock Audit itself, `stock-audit.js` runs its **own** small stack-based router (`go()`/`back()`, `stock-audit.js:843-853`), independent of the platform hash — it holds view state in memory (`CURRENT`, `STACK`), not in the URL. Only one thing is URL-addressable inside the feature: `?customer=<id>` on initial load. Mid-session navigation (Workspace, product sheets, Exit dialogs, etc.) is **not** deep-linkable or back-button-safe beyond the platform's own iframe boundary.

### 2.4 Data / seed layer

- `seed.inline.js` (customer module) is the single source for **customers**, **products**, **stock audits**, and **ordering signals** (`window.SEED = { ..., stockAudits, orderingSignals, ... }`, `seed.inline.js:465-479`).
- **Products are a flat, global 12-SKU list** (`p01`–`p12`), each with one fixed `systemStock` value (`seed.inline.js:432-443`). There is no per-customer or per-location expected-stock concept — "Expected 12 units" is identical whether the visit is at Laxmi Store or Aai Mata General Store. This is a real modeling gap if vNext needs shop-specific assortments (see §13).
- **Catalog (a different screen entirely) uses a *different*, differently-shaped product seed** (`catalog/assets/data.js`: `articleNo`, `categoryTop`, `price`, `stockTotal`, `taxRate` — vs. Stock Audit's `artNo`, `category`, `systemStock`). There is no single product source of truth across the module.
- The "rep" is hardcoded: `const AUDITOR = { id: "u-mahesh", name: "Mahesh", role: "Sales Executive", team: "Pune Team" }` (`stock-audit.js:410`). No login, no session, no multi-rep support anywhere in this feature.

---

## 3. Current User Flow

Traced from the router (`stock-audit.js:857-869`) and each view's own render function — not from screenshots. Full behavior detail (search boxes, sheets, data captured) is in the flow diagram delivered earlier this session; this is the state-by-state summary for the audit.

| Step | Current behavior |
|---|---|
| 1. Enter Customer Management | Sidebar group with B2B Customers / Retail Customers / Stock Audit & Health as peers (`shell.js:190-196`). No dashboard interstitial. |
| 2. Reach Stock Audit & Health | Lands on **Customers** view (`renderCustomers`, `stock-audit.js:1034`) — search box, filter chips (`all`/`attention`/`due`/`overdue`, `stock-audit.js:818-823`), sort (Health/Name/Last Audit), full customer card list. **List is shown by default, not search-first.** |
| 3. Search/select a customer | Search filters the existing rendered list client-side (`stock-audit.js:1044-1049`); tapping a card → Customer Detail. |
| 4. Open Customer Detail | `renderCustomerDetail` (`stock-audit.js:1498`) — health score/axes, Needs Attention block, last-visit snapshot, ordering status, product-issues section, full activity/audit history, customer info. Heavy screen, by design (it's the "everything about this customer" view). |
| 5. Start an audit | `startAuditFor(customerId)` (`stock-audit.js:906-913`). If no open draft: builds a fresh draft (`newDraft`, auto-fills location + purpose = "routine") and goes **straight to Workspace** — no wizard. If a draft exists: shows a Resume-or-Restart sheet first (never silently overwrites). |
| 6. Resume an existing audit | Same entry point (`startAuditFor`) detects the open draft via `DraftStore.get(customerId)` and routes to the resume sheet before Workspace. |
| 7. Select a product | Workspace (`renderWorkspace`, `stock-audit.js:2441`) lists **every catalogue product by default**, ordered by "needs checking first," with a search box and All/Needs-Attention tabs layered on top of that full list — not search-first. |
| 8. Enter a count | Tapping a row opens the **Product Count Sheet** (`openProductSheet`, `stock-audit.js:2665`) — one persistent sheet reused per product: stepper, condition breakdown, shelf toggle, notes/photo, all in one surface. |
| 9. Save a product | Line is written into `DRAFT.lines`; sheet auto-advances to the next uncounted product (`nextUncaptured`, `stock-audit.js:2551`) rather than closing back to the list. |
| 10. Search for a product | The Workspace search box (`WS_STATE.q`) filters the already-rendered full list — same "filter-not-search" pattern as customer search. |
| 11. Can't find a product | A second, transient sheet (`notFoundSheet`, `stock-audit.js:3016`) layers *on top of* the product sheet (not replacing it) — pick a reason, line marked `not_found`. |
| 12. Exit an audit | `exitAuditSheet` (`stock-audit.js:2563`) — three real outcomes: Pause / Keep counting / End this visit. |
| 13. Pause | `pauseAudit` (`stock-audit.js:2577`) — draft status → `paused`, kept in `DraftStore`, rep lands on Customer Detail. No score, no history entry. |
| 14. End a visit | Opens a second sheet (`endVisitSheet`, `stock-audit.js:2598`) requiring an abandon reason. |
| 15. Discard a draft | Same sheet's "Discard it instead" — `DraftStore.clear()`, nothing written to history at all. |
| 16. Finish an audit | `finishAuditSheet` (`stock-audit.js:3129`) checks coverage first; if nothing skipped, one-tap finish; if some skipped, warns and asks Continue Counting vs. Finish Anyway. |
| 17. Complete a partial audit | Same path, `DRAFT.partial = { isPartial: true, ... }` set before `completeAudit()` runs. |
| 18. View the completed audit | `completeAudit` (`stock-audit.js:3163`) computes score/outcome, writes to `AuditStore`, clears the draft, routes to Customer Detail, then layers a confirmation sheet (`successSheet`, `stock-audit.js:3211`) on top — "Audit completed, N products counted, Done." No score/recommendations shown on this sheet by design (comment: *"A confirmation, not another workflow step"*). |
| 19. Return to Customer Detail | Always the landing spot after Pause/Abandon/Discard/Complete — never back to a stale Workspace. |
| 20. Open Audit History | Bottom-nav tab (`renderAudits`, `stock-audit.js:1254`) — every audit, every customer, newest first. |
| 21. Open Inventory | Reached only from Customer Detail (health axis / attention item tap) → `renderInventory` (`stock-audit.js:1834`), scoped to that customer, All/Issues filter. |

---

## 4. Entry Point Audit

### Entry A — FoodBridge WhatsApp → Customer Stock Audit → link

**Does not exist.** Searched the entire repo (`v1` and `v2`) for `whatsapp` (case-insensitive). The only genuine hit is `customers.js:1064-1093` — a "Send Ordering Link" modal on **Retail Customers** (unrelated feature: sending a product-ordering link to a customer, not a stock-audit entry). Its "Send via WhatsApp" button does exactly this and nothing else:

```js
$("[data-send]", wrap).onclick = () => {
  closeOverlays();
  toast(`Ordering link sent to ${name || c.phone}!`);
};
```

No `wa.me` URL construction, no deep-link payload, no server to send from. **If WhatsApp integration is claimed to exist anywhere else in this ecosystem, it is not in this repository.**

What *is* reusable: the deep-link **landing** side already works. `stock-audit.html?customer=c05` opens straight to that customer's Customer Detail (`stock-audit.js:3277-3280`). A WhatsApp link only needs to resolve to a URL; the receiving end of that URL already exists for the customer-context case. It does not exist for a "land directly in the count, skip Customer Detail" case — that's a new, small routing branch.

Required for vNext: message-sending infrastructure (real WhatsApp Business API integration or a mock of one), a link-generation mechanism, and a receiving route that skips Customer Detail and opens counting directly. None of this exists today.

### Entry B — Route Delivery → Customer Stock Audit

**"Route Delivery" as a distinct experience with Collection/Return/Delivery actions does not exist.** It appears as a nav label in *many* places (every module's own copy of the standalone sidebar mockup, `platform.js:223`, `modules.json:349-353`), and in every case it is either:

- A **permanent stub**, everywhere it's clickable: `shell.js:253-255` renders it as `data-stub="Route Delivery"`; the stub handler (`shell.js:292-297`) fires: `toast('"Route Delivery" is outside this discovery iteration.', 'info')`.
- Explicitly documented as unimplemented in the platform's own nav config: `modules.json:349-352` — `"name": "Route Delivery", "under": "(sidebar footer)", "why": "No mockup supplied."`

The real, functional, mobile-only screen that matches what the requirements describe is a **different module**: **Delivery Management** (`Distribution & Logistics → Delivery Management`), literally subtitled "mobile Route Delivery app" in its own header comment (`.../delivery-management/screens/delivery/assets/app.js:2-3`). Its actual flow:

```
home → route (pre-start) → load-stock → cash-change → ready-start →
delivery-queue → stop-detail → collect-payment → settle-route →
stock-count → cash-handover → route-report
```

The per-customer stop screen (`sections/stop-detail.js`) has three real actions: **💰 Collect Payment**, **✏️ Edit Order**, **Skip Stop →**. There is no literal "Collection / Return / Delivery" action triad anywhere — that appears to be the requirements author's shorthand for the general Route Delivery concept, not a 1:1 match to what's built. "Logistic Returns" is a **separate, top-level Distribution & Logistics module**, not a per-stop action inside Delivery Management.

**A naming collision worth flagging explicitly:** Delivery Management's own settlement flow already has a step called **"Stock Count"** (`sections/stock-count.js`) — verifying what's left in the vehicle (Loaded / Expected / Actual, per product, for the whole route) before handing over cash. This is a completely different concept from Customer Management's per-customer **Stock Audit** (shelf health at one shop), but the names are close enough that stakeholders and future engineers may conflate them. A third, unrelated concept — **"Stock Audit Settlement"** — also exists as an empty top-level sidebar stub (`modules.json:344-347`, `distribution-logistics/.../app.js:220`, "No mockup supplied"). Three distinct "stock ___" concepts, one real implementation among them.

Required for vNext: a real decision on where the "Customer Stock Audit" action lives — inside Delivery Management's `stop-detail` (adding a 4th action button next to Collect/Edit/Skip, `stock-audit.js:2665` product-sheet flow slotting in as `DM.go("stock-audit", {...})`), inside the platform's dormant "Route Delivery" stub (which would mean *building* Route Delivery, a much larger scope), or as a standalone deep link independent of either. This is a scoping decision the requirements doc does not currently resolve, because it assumes an integration point that isn't there.

**Authentication/session:** Neither entry point has anything to check — there is no login or session layer in the codebase at all (`AUDITOR` is a hardcoded constant, §2.4). Any auth requirement for vNext is new work, not a gap in an existing system.

---

## 5. Customer Selection Audit

| Question | Current answer |
|---|---|
| Full list rendered by default? | **Yes**, in both places customers are picked: the Customers landing view (`renderCustomers`) and the audit-creation picker (`renderCreateCustomer`, `stock-audit.js:2338`: `const rows = q ? all.filter(...) : all;`). Empty query → full list. |
| Search available? | Yes, in both places, debounced (`wireSearchInput`, 220ms). |
| Search-first / empty-state-first? | **No.** Nothing currently renders "no customer selected, search to begin" as an initial state. |
| Existing customer picker component? | Yes — `renderCreateCustomer` (`stock-audit.js:2335-2355`) is a dedicated, minimal search-then-pick screen, structurally very close to what vNext wants. It just needs its default-list behavior flipped to empty-state. |
| Reusable elsewhere? | It's already generic (search box + row list + `data-pick` handler); nothing about it is Workspace-specific. Directly liftable. |
| How is selection persisted? | Not persisted as a "selection" — picking a customer immediately calls `startAuditFor(customerId)`, which either opens a fresh draft or the resume sheet. There's no intermediate "customer selected, now what" state to persist. |
| What data is available on selection? | The full customer record from `Store` (name, phone, email, address, tags, type) plus, immediately, `locationsFor(customer)` and any existing `DraftStore` entry. |
| Does selecting a customer lead straight into the audit? | From the picker (`renderCreateCustomer`), **yes** — one call to `startAuditFor`. From the Customers landing card or Customer Detail, selection lands on Customer Detail first; a *second* tap (Start Audit / primary action) is required to reach the count. |
| Is Customer Detail mandatory? | **No**, not architecturally — `startAuditFor` is callable directly from anywhere with a `customerId` and skips Customer Detail entirely (this is exactly the `renderCreateCustomer` path). It's mandatory only along the "browse the Customers list, tap a card" path, which is the *default* landing experience today. |

**Gap vs. requirement:** The requirement wants the *default* first screen to be empty-state search. Today's default first screen (Customers landing) is a populated, filterable, sortable list — a genuinely different tool for a different job (triage, not a single quick visit). The picker that already matches the requirement (`renderCreateCustomer`) is reachable only via the bottom-nav "+ New Audit" button, not the entry point vNext would use.

---

## 6. Product Selection Audit

| Question | Current answer |
|---|---|
| Full catalogue shown? | **Yes**, by default, in Workspace (`renderWorkspace`, `stock-audit.js:2452-2456`) — all 12 products, ordered by priority (previously-flagged first), before any search input. |
| Product search? | Yes — by name, SKU (`artNo`), or category (`stock-audit.js:2450`), but it **filters** the already-rendered full list rather than starting empty. |
| Search by barcode? | **No.** No barcode field exists on the product model (`{id, name, artNo, category, unit, systemStock, emoji, image}`) and no scan/camera input anywhere in this feature. |
| How are selected products represented? | There is no "selection" concept distinct from "counted." A product becomes part of the audit the moment its line is captured in `DRAFT.lines[p.id]` via the Product Count Sheet — there's no intermediate "added, not yet counted" row. |
| Existing selected-products collection? | Not as its own UI concept — `DRAFT.lines` is the closest data structure, but it's populated by *counting*, not by a separate *selecting* step. |
| Does selection create an audit line immediately? | Selection and counting are the same action today (tap a product → sheet opens → the count you enter *is* the line). vNext wants these split: select (adds an empty row) → then count (fills the row). |
| Quantity entered immediately? | Yes, in the same sheet as selection — consistent with the *spirit* of the requirement (no separate detail page), just via a bottom sheet rather than an inline row. |
| Product detail page? | No separate page — the Product Count Sheet is the closest equivalent, and it's already a sheet-over-the-list, not a navigation-away page. This matches what vNext wants structurally; it's just heavier (condition breakdown, shelf toggle, advanced/reasoning section, notes, photo) than a bare quantity control. |
| Product rows reusable? | `wsRowHTML` (`stock-audit.js:2504-2525`) is a compact, single-purpose row (thumbnail, name, SKU/expected, status tag, count-or-done state) — a reasonable structural starting point, though it currently shows more metadata than vNext's "minimum required" bar. |
| Filtering already implemented? | Yes — All/Needs-Attention tabs (`WS_STATE.tab`). Not part of the requirement, but not in conflict with it either; can stay as a secondary control. |

**Two independent product-data realities worth flagging:** Stock Audit's product seed (`seed.inline.js`, 12 SKUs) and Catalog's product seed (`catalog/assets/data.js`, differently shaped) are not the same data. Neither is a real product search service — both are static in-memory arrays filtered client-side. A vNext "search product / SKU / barcode" experience needs one clear source of truth; today there are two, and neither supports barcode.

---

## 7. Counting Audit

Traced from the Product Count Sheet (`openProductSheet` → `renderProductSheet`, `stock-audit.js:2665-2820`+).

| Captured today | Required / Optional / Legacy / Business-rule / Visual |
|---|---|
| Physical count (stepper) | **Required** — the core of the interaction, keep as-is. |
| Direct numeric input | Present alongside the stepper (same field, typeable). Keep. |
| Condition (ok/damaged/expired/near-expiry) breakdown | **Business-rule-driven** — feeds `dominantCondition()`, which drives Needs-Attention flags, stock-out risk, and recommended actions (§9). Cannot be silently dropped without losing those downstream outcomes; can be **deferred** behind progressive disclosure ("only when needed") rather than always-on. |
| Shelf-presence toggle | Conditional — only rendered `locationHasShelf(customer, locationId)` is true (`stock-audit.js:2701`). Already progressive; a good existing example of the pattern vNext wants applied more broadly. |
| Notes / photo | Optional today, inside a collapsible "Advanced" section (`PD_ADVANCED`, `stock-audit.js:2649`) that starts collapsed and remembers its open/closed state per-product. **This is already exactly the progressive-disclosure pattern the requirements ask for** — just currently applied to one section of a much bigger sheet. |
| Save behavior | Writes the line, **auto-advances to the next uncounted product** (`nextUncaptured`, walks the priority-ordered list forward from the current position) rather than returning to a static list. This matches the requirement's "repeat only for required products" framing well, *if* "required products" becomes "products the rep explicitly selected" instead of "the whole catalogue in priority order." |
| Does the current product remain selected / does the rep return to the list? | Neither, exactly — the sheet **replaces itself** with the next product (same persistent DOM node, `stock-audit.js:2657` comment: *"reused across products rather than torn down and rebuilt"*). The rep never manually returns to a list mid-flow unless they close the sheet. |

**Nothing here is legacy or purely decorative.** Every field ties into either the health-scoring model (§9) or a real operational outcome (stock-out flags, recommended actions, follow-up scheduling). The counting mechanics — stepper, auto-advance, one persistent sheet — are *already* well-aligned with "fast and obvious." The gap is entirely about **what's shown by default vs. what's tucked behind progressive disclosure**, not about the interaction model itself.

---

## 8. Audit Lifecycle Audit

### States (from the code, not assumed names)

`DRAFT.status`: `draft` → `in_progress` → (`paused` | discarded | completed | abandoned via `AuditStore`)

Actual transitions, verified against the router and mutation call sites:

```
newDraft()              status: "draft"
  ↓ (renderWorkspace runs, first paint)
"in_progress"            stock-audit.js:2445
  ↓
  ├─ pauseAudit()      → status: "paused", persisted in DraftStore, DRAFT cleared from memory
  ├─ abandonAudit()    → new AuditStore record, status: "abandoned", DraftStore cleared entirely
  ├─ DraftStore.clear() (Discard) → nothing written anywhere, draft gone
  └─ completeAudit()   → new AuditStore record, status: "completed", DraftStore cleared entirely
```

`paused` is the only state that keeps the draft alive for a future `resumeDraft()` call. Everything else terminates it — completed and abandoned both become permanent `AuditStore` records; discarded leaves no record at all.

### Draft persistence

- Key: `fb-discovery-stock-draft-audits-v1` (`DraftStore`, `stock-audit.js:262-281`), a customer-id-keyed map, one open draft per customer at a time.
- Resuming re-marks status `in_progress`, clears `pausedAt`, stamps `actorsLastEditedBy` — so a second rep picking up a paused visit is attributed correctly (`resumeDraft`, `stock-audit.js:919-925`).

### "Start Audit tapped while a draft exists" — verified explicitly

`startAuditFor` (`stock-audit.js:906-913`) checks `DraftStore.get(customerId)` **before** doing anything else. If found, it never silently proceeds — it routes to `resumeOrRestartSheet`, which requires an explicit tap on either "Resume that visit" or "Start a new one instead" (the latter calling `DraftStore.clear()` first). **A draft cannot be accidentally overwritten in the current implementation.** This is called out in the code's own comment (`stock-audit.js:900-901`: *"An existing draft always wins over starting fresh, so a stray tap can never throw away a real count."*).

### Partial completion

`finishAuditSheet` computes `auditCoverage()` (audited + not-found vs. `expectedProducts`, snapshotted at draft creation so a later catalogue edit can't retroactively shrink/grow a closed audit's denominator). Zero skipped → one-tap finish. Some skipped → forces an explicit choice (Continue Counting vs. Finish Anyway), and only the latter sets `partial.isPartial = true` before scoring.

### Does a completed audit affect customer health?

Yes — `Customer Detail`'s score comes from `scoreFromAudit(last)` where `last` is the most recent **completed** audit (`stock-audit.js:1512,1517`). Paused and abandoned audits do not contribute a score. This is the load-bearing business rule vNext must not break: **only a completed audit updates health.**

---

## 9. Completion / Partial / Exit Audit

All four possible visit-ending outcomes, with their full effects:

| Outcome | Trigger | UI | State | Persistence | Customer history | Score |
|---|---|---|---|---|---|---|
| **Completed** | Finish Audit (full or accepted-partial coverage) | `finishAuditSheet` → `completeAudit` → `successSheet` | `DRAFT` cleared | New record in `AuditStore` (`fb-discovery-stock-audits-v1`) | New entry, visible in Audit History and Customer Detail | **Yes** — the only outcome that does |
| **Paused** | Exit Audit → "Pause — keep my progress" | `exitAuditSheet` → `pauseAudit` | `paused`, `pausedAt` stamped | Stays in `DraftStore` only | No history entry (not yet a visit outcome) | No |
| **Recorded incomplete (abandoned)** | Exit Audit → End this visit → reason required | `exitAuditSheet` → `endVisitSheet` → `abandonAudit` | New `AuditStore` record, `status: "abandoned"`, `partial.isPartial: true` with the picked reason | Draft cleared from `DraftStore`; audit **is** written to `AuditStore` | Yes — appears in history as an incomplete visit, deliberately *not* deleted (comment: *"leaves a customer looking simply un-visited"* is the thing being avoided) | No |
| **Discarded** | Exit Audit → End this visit → "Discard it instead" | `endVisitSheet` | `DraftStore.clear()` | Nothing written anywhere | None | No |

**These are four genuinely distinct business outcomes** (the requirements-audit brief's own callout — *"Paused ≠ incomplete ≠ discarded"* — is correct and matches the code exactly). A vNext redesign that collapses "leave without finishing" into a single generic "exit" action would lose the abandoned-vs-discarded distinction, which is deliberately preserved today so that a shop that genuinely couldn't be checked doesn't disappear from the record the way a true mis-tap should.

**Completion detail:** coverage → outcome suggestion (`suggestedOutcome`) → score (`scoreFromAudit`) → health axes (`healthBreakdown`: Stock / Shelf / Expiry / Ordering) → recommended actions (`recommendedActions`, `stock-audit.js:3244-3267`: replenish, pull & rotate, raise damage claim, verify next visit, consider push offer, follow-up) → written to `AuditStore` → navigate to Customer Detail (already updated) → confirmation sheet on top, no score/actions repeated there by design.

---

## 10. Reusable Components

| Component | Location | Current purpose | Recommendation | Reason |
|---|---|---|---|---|
| `renderCreateCustomer` (customer picker) | `stock-audit.js:2335-2355` | "+ New Audit" nav entry's customer picker | **Adapt** | Structurally already search-then-select; only needs its empty-query fallback (`all` → `[]`) flipped to match empty-state-first. |
| `wireSearchInput` (debounced search) | `stock-audit.js:995-1002` | Shared by every search box in this feature | **Reuse directly** | Generic debounce-and-refocus helper, no coupling to what it filters. |
| `sheet()` (bottom-sheet primitive) | `stock-audit.js:79-...` | Every confirmation/decision surface in the feature | **Reuse directly** | Already supports the "persistent sheet with a transient sheet layered on top" pattern vNext's product-count-then-can't-find interaction needs. |
| Product Count Sheet mechanics (persistent, reused DOM node, auto-advance) | `stock-audit.js:2657-2680`, `nextUncaptured` | Full product capture | **Adapt** | The *mechanism* (one sheet, Save advances to next) is exactly right for vNext; the *content* (condition breakdown, shelf toggle, advanced section) is too heavy for the default state and needs to move behind progressive disclosure. |
| `wsRowHTML` (product row) | `stock-audit.js:2504-2525` | Workspace list row | **Adapt** | Right shape (thumbnail/name/meta/status/action), more metadata than the requirement's minimum ("name + optional identifier + quantity"). |
| `renderWorkspace` (product list + search) | `stock-audit.js:2441-2502` | Full-catalogue count screen | **Replace** for the primary vNext journey | Built around "browse the whole catalogue," the opposite of search-first; keep available as the *secondary*, full-audit experience per requirements §19 ("existing capabilities may remain available where they serve their appropriate use case"). |
| `renderCustomers` (customer landing) | `stock-audit.js:1034-1095` | Triage/browse entry point | **Keep as secondary**, not primary entry | This *is* the right tool for "which of my 22 customers needs a visit," which is a real, different job from "I'm standing in Laxmi Store right now." |
| `renderCustomerDetail` and its sections | `stock-audit.js:1498-1532`+ | Full customer health/history view | **Keep as secondary** | Explicitly out of scope to redesign per the requirements doc §16/§19; safe to leave untouched and reuse for the "view more" path off a completed quick-count. |
| `DraftStore` / "draft always wins" logic | `stock-audit.js:262-281`, `906-925` | Resume-safety | **Reuse directly** | This exact mechanism (never silently overwrite an open draft) is a hard requirement carried over implicitly from the current system's own correctness guarantees — nothing in vNext's requirements suggests relaxing it. |
| `AuditStore` write path + scoring (`completeAudit`, `scoreFromAudit`, `healthBreakdown`, `recommendedActions`) | `stock-audit.js:3163-3267`, `747-`, `790-` | Turns a finished count into a scored, actionable record | **Reuse directly** | This is the business logic that makes a "quick count" mean something afterward. vNext's minimal counting UI still needs to feed this same pipeline, or health scoring silently breaks. |
| Catalog's "Selected Products Preview" pattern (chip row + remove-X) | `catalog/assets/catalog.js:465-471` | Shows currently-selected products in the catalog-builder drawer | **Adapt** (pattern only) | The visual idiom (row + name + remove button) is close to what a vNext "selected products" list needs; the surrounding interaction (category-tree bulk select, desktop drawer) is not reusable. |
| Catalog's "Individual" product search (`drawIndividual`) | `catalog/assets/catalog.js:473-501` | Search/filter within catalog-builder | **Not reusable as-is** | Same full-list-by-default anti-pattern as Workspace, plus a different product schema entirely (see §6). |

---

## 11. API/Data Reuse

There is no backend, so "API reuse" in the traditional sense doesn't apply — everything below is about the **client-side data model and persistence layer**.

| Capability | Classification | Notes |
|---|---|---|
| Customer records (`Store`, `fb-discovery-customers-v1`) | **Reuse** | Shared, already read (never written) by `stock-audit.js`; same records vNext's customer picker would search. |
| Audit data model (`normalizeAudit`, `stock-audit.js:475-500`) — id, customerId, locationId, status, timestamps, actors, purpose, lines, outcome, partial, followUp, actionsTaken, evidence | **Reuse** | This is the record vNext's finished count must produce to keep scoring/history/recommendations working. A minimal counting UI can write a *subset* of these fields (most have safe defaults via `normalizeAudit`) and still produce a valid audit. |
| Audit line model (productId, status, physical/expected, conditionBreakdown, shelfAvailability, storageBreakdown) | **Extend** | vNext's minimal flow only needs `productId` + a quantity to start. Condition/shelf/storage become **optional, deferred** fields rather than always-collected ones — the schema already supports this (defaults exist), so this is a UI change, not a schema change. |
| `DraftStore` (`fb-discovery-stock-draft-audits-v1`) | **Reuse** | The draft shape (`newDraft`, `stock-audit.js:882-897`) already accommodates a partially-built audit; a vNext draft with only 2 of 12 products touched is not a new case, it's the *normal* case. |
| `LocationStore` (`fb-discovery-stock-locations-v1`) | **Reuse, but reconsider exposure** | Multi-location support already exists and auto-resolves a default; vNext's requirements never mention location at all, meaning it should stay auto-resolved and hidden unless a shop has more than one location — which the current Workspace already does correctly. |
| Product catalogue (`seed.inline.js`, 12 SKUs, global `systemStock`) | **Extend** | Works for a search-by-name/SKU mock today. Needs: (a) a barcode field if barcode search is required, (b) a decision on whether per-customer/location assortment and expected-stock ever matters for vNext (currently it's globally flat). |
| Catalog's separate product data (`catalog/assets/data.js`) | **New / reconcile** | Not usable as-is; if vNext ever needs to search "the" product catalogue from multiple entry points (WhatsApp + Route Delivery + existing Workspace), the two seeds need to converge on one shape first. |
| Scoring/health pipeline (`scoreFromAudit`, `healthBreakdown`, `recommendedActions`) | **Reuse** | Pure functions over an audit record; agnostic to how that record was produced. This is the strongest argument for treating vNext as a **new front door onto the same data model**, not a new backend. |
| Session / auth (`AUDITOR` constant) | **New** | Nothing to reuse — there is no session layer at all in this repo. |
| WhatsApp messaging | **New** | Confirmed absent (§4). |

---

## 12. Requirements Gap Analysis

| Requirement | Current behavior | Gap | Severity | Recommended action |
|---|---|---|---|---|
| Search-first customer selection | `renderCreateCustomer` shows full list when query is empty (`stock-audit.js:2338`) | Default-list, not empty-state | **High** | Flip the empty-query branch to render an empty state; the search-and-select mechanics underneath already work. |
| Empty initial customer list | Customers landing (the actual default entry) always renders all matching customers | Landing screen is the wrong tool for this entry point, not just wrong default state | **High** | Don't reuse Customers-landing for the quick-audit entry; build/reuse the picker (`renderCreateCustomer`) as the true entry screen for Entry Points A/B. |
| Search-first products | Workspace shows the full catalogue by default (`stock-audit.js:2452-2456`) | Same default-list pattern | **High** | New/adapted view: empty-state + search, not Workspace's product list. |
| No full catalogue initially | Same as above | Same | **High** | Same fix; 12 SKUs today, but the interaction model is the point, not the current catalogue size. |
| Minimal product row | `wsRowHTML` shows thumbnail, name, SKU, expected qty, status tag | More metadata than "name + optional identifier + quantity" | **Medium** | New, lighter row for the quick-count surface; keep the richer row for the existing full-audit Workspace. |
| Fast quantity capture | Stepper + numeric input already exist, inside a heavier sheet | Mechanism is right; surrounding sheet (condition/shelf/notes) is not minimal by default | **Medium** | Reuse the stepper/auto-advance mechanics; move condition/shelf/notes behind progressive disclosure, matching the pattern the "Advanced" section already uses. |
| No unnecessary product detail page | Product Count Sheet is already a sheet, not a page | None, structurally | **Low** | Trim content, don't rearchitect. |
| WhatsApp entry | Does not exist; nearest artifact is a decorative WhatsApp button elsewhere with no real link | Full gap — infra, not UI | **High** | Net-new: link generation + a route that opens straight into counting for a given customer, bypassing Customer Detail. |
| Route Delivery entry | "Route Delivery" is a stub everywhere; closest real screen (Delivery Management) has a different action set and its own unrelated "Stock Count" step | Full gap — the integration point itself is undecided | **High** | Product decision needed on where the action lives (Delivery Management's `stop-detail`, or build out the dormant Route Delivery stub) before this can be scoped, let alone built. |
| Single continuous task, not three forms | Current flow is naturally three stops (Customers → Customer Detail → Workspace) even without literal form pages | Structurally closer to "multiple forms" than the requirement wants, even though no page reload occurs | **Medium** | The picker → count flow (`renderCreateCustomer` → `renderWorkspace`) already skips the Customer Detail stop; extending that skip to be the *default*, not the "+ New Audit" special case, gets most of the way there. |
| Progressive disclosure ("only show what's needed now") | Partially present (Advanced section, shelf-toggle conditionality) | Applied narrowly; most of the sheet and most of Workspace's metadata is always-on | **Medium** | Systematic pass, not a new pattern — extend what already exists in one place to the rest of the surface. |

---

## 13. Technical Risks

- **No unified product source of truth.** Stock Audit and Catalog each maintain their own, differently-shaped product data. Any vNext feature that needs to search "products" from a new entry point (WhatsApp, Route Delivery) inherits this ambiguity immediately.
- **Global, not per-customer, expected stock.** `systemStock` is a flat per-product constant. If vNext's product search is meant to reflect what a *specific* shop actually carries (as opposed to the entire 12-SKU catalogue at every shop), that's new modeling work, not a UI change.
- **No barcode field or scanning capability anywhere.** Requirements list barcode search as conditional ("if the existing platform supports barcode input") — it currently does not, at the data-model or UI level.
- **No session/auth layer at all.** `AUDITOR` is hardcoded. Any real "who is the rep" concept for a WhatsApp- or Route-Delivery-originated audit needs this built from nothing; today one and only one identity exists in the whole feature.
- **Mid-session state is memory-only, not URL-addressable.** Only the initial `?customer=` param is a real deep link; Workspace/product-sheet state doesn't survive a reload. A WhatsApp link that's meant to resume a specific in-progress count (not just open the feature generally) needs new persistence/routing work.
- **The feature's own internal router is independent of the platform's hash router.** Two routing layers already coexist here; a third entry surface (WhatsApp link → deep state) needs to compose with both without fighting either.
- **"Route Delivery" ownership is genuinely undecided**, not just unbuilt — Delivery Management (real, working) and the platform's dormant Route Delivery stub are two different plausible homes for Entry Point B, with different scope implications (adding a button to an existing per-stop screen vs. building a new top-level experience).
- **No tests exist for this feature or its dependencies.** Any refactor of `renderCreateCustomer`/`renderWorkspace`'s default-list behavior has no regression safety net beyond manual verification.
- **`localStorage`-only persistence, session-scoped, no server.** This is consistent with the rest of the mock platform and is presumably fine for a continued discovery iteration, but is worth stating plainly: nothing here survives a cleared browser or moves between devices, which matters if "start on WhatsApp, finish via Route Delivery" (or vice versa) is ever a real requirement.

---

## 14. vNext Implementation Contract

*(Still structure only — function/component/route names and their responsibilities, not code. This section supersedes the earlier open-ended architecture sketch by resolving every ambiguity in §16's original questions into a decision. Where a decision is a genuine product/business call rather than a technical one, it's marked accordingly — see §14.8.)*

**Core idea, unchanged and now load-bearing:** vNext is a **new, minimal front door** onto the *same* customer/product/draft/audit data model that already exists (`DraftStore`, `AuditStore`, `scoreFromAudit`, `healthBreakdown`, `recommendedActions`). No new backend, no new scoring system, no new storage keys. Every new screen below ends by calling the same functions the current Workspace already calls.

### 14.1 Resolved decisions

| # | Ambiguity (was §16) | Resolution | Basis |
|---|---|---|---|
| 1 | Where does Entry Point B's action live? | **Delivery Management's `stop-detail.js`**, as a fourth footer action alongside Collect / Edit Order / Skip Stop. Not the dormant platform-shell "Route Delivery" stub — building that out is a separate, much larger, cross-cutting effort with no owner today (§4). | `stop-detail.js` is the only *real, working* per-customer stop screen in the codebase; the literal "Route Delivery" label is unimplemented everywhere it appears. |
| 2 | Real or mocked WhatsApp? | **Fully mocked**, matching the rest of this codebase's convention (`customers.js`'s existing "Send via WhatsApp" button: toast, no real send). No WhatsApp Business API integration in this phase. | Every other "send"-style action in this module is mocked; nothing about vNext's requirements demands this be the exception. |
| 3 | Per-shop product assortment / expected stock? | **Out of scope for this vNext pass.** Keep the existing global, flat 12-SKU catalogue (`systemStock` per product, same value everywhere). | Requirements doc never raises this; it's a data-model expansion, not a UX change. Flagged as a non-goal (§14.6), not silently dropped. |
| 4 | Barcode search? | **Out of scope for this vNext pass.** Search matches name + SKU (`artNo`) only, exactly like today's Workspace search. The search function's signature reserves a `code` field so barcode can be added later without an interaction redesign. | Requirements doc's own phrasing is conditional ("if the existing platform supports barcode input") — it doesn't. |
| 5 | New views, or mode-flag the existing ones? | **New, separate view functions** (`quick-pick`, `quick-count`), not a mode flag on `renderCreateCustomer`/`renderWorkspace`. | Zero test coverage on this module (§13) means editing the existing full-audit path in place carries real regression risk with no safety net. Net-new functions isolate that risk; the old views stay provably untouched. |
| 6 | Does a quick count score like a full audit? | **Yes, identically — same pipeline, no special case.** A 2-of-12-products quick count is not a new *kind* of audit; it's the existing partial-coverage case `finishAuditSheet` already handles ("N products haven't been counted yet — Continue or Finish Anyway"). | One audit model, one scoring model. Forking scoring logic for "quick" vs. "full" audits would double the surface this feature has to keep consistent, for no requirement that asks for it. |
| 7 | Does a WhatsApp link resume a specific draft? | **It composes with the existing rule, not a new one.** The link carries `customer=<id>`; the receiving code calls the *same* `startAuditFor(customerId)` used everywhere else today, so the existing "draft always wins" resume-or-restart check runs unchanged. | Reuses `stock-audit.js:906-913` as-is — no new resume logic to build or verify. |
| 8 | Does Route Delivery's link carry a direct customer id? | **No — it can't, reliably.** See §14.5: Delivery Management's stops and Customer Management's customers are **different ID spaces** (`st-ev` vs. `c04`) with no shared key in the data model, only a coincidentally-matching `name`/`phone` in the seed. The Route Delivery link therefore passes a **search hint** (phone number), not a customer id — see the routing contract below. | Verified directly in `delivery-management/.../assets/data.js` vs. `customers/seed.inline.js`: same shop ("Ganraj Kirana Mart", phone `41589627074`) exists under `stop id: "st-ev"` in one and `customer id: "c04"` in the other, joined only by the seed authors having typed matching values — not a real foreign key. |

### 14.2 New routes / URL contract

**Hard constraint this contract must respect:** the platform shell's hash router **drops query strings**. `state.currentUrl = pickUrl(dest.leaf); frame.src = state.currentUrl;` (`platform.js:453-454`) always loads the bare `url`/`urlMobile` string from `modules.json` — there is no code path that forwards `#/customer-management/stock-audit-health?...` params into the iframe. This means **every deep link below must open `stock-audit.html` directly** (its own tab/window), never through `#/customer-management/stock-audit-health`. This is exactly how the module already documents itself as usable ("Standalone-openable... optionally with `?customer=c01`"), so it's a constraint the feature already lives with, not a new one vNext introduces.

| URL | Consumer | Behavior |
|---|---|---|
| `stock-audit.html?entry=quick&customer=<id>&source=whatsapp` | Entry A (WhatsApp link, tapped on the rep's phone) | Skips Customer Detail entirely. Calls `startAuditFor(id)` directly → existing draft-wins check → `quick-count` for that customer. |
| `stock-audit.html?entry=quick&hint=<phone>&source=route-delivery` | Entry B (Delivery Management's new stop-detail action) | Opens `quick-pick` (the new customer picker) with its search box **pre-filled** with `hint`, not auto-selected. The rep confirms the match with one tap — see §14.1.8 for why this can't skip straight to a customer. |
| `stock-audit.html?entry=quick` (no customer, no hint) | Bottom-nav "+ New Audit" (redefined, see §14.4) | Opens `quick-pick`, empty state, exactly as today's "+ New Audit" reaches a picker — just a different, empty-by-default one. |
| `stock-audit.html?customer=<id>` (no `entry=`) | **Unchanged.** Existing behavior, e.g. an internal link or bookmark. | Opens Customer Detail, exactly as today (`stock-audit.js:3277-3280`). Not touched by this contract. |
| `stock-audit.html` (no params) | **Unchanged.** Normal in-shell access via the sidebar. | Opens the Customers landing/browse view, exactly as today. |
| `source=whatsapp` \| `source=route-delivery` | Both A and B | Attribution only — carried onto the resulting `DRAFT`/audit record if convenient (e.g. as a non-blocking `entrySource` field), never gates behavior. Safe to ignore entirely without breaking the flow. |

### 14.3 New views

Both are added as two more entries in the existing router's dispatch table (`renderCurrent`, `stock-audit.js:859-869`) — same file, same closure, same `go()`/`back()` stack. (Splitting them into a second file was considered and rejected: the router's state — `CURRENT`, `STACK`, `DRAFT` — is private to `stock-audit.js`'s own IIFE, so a separate file could only participate by the module exposing a registration hook, which is more surface area than just adding two functions where the other nine already live.)

| View key | Renders | Reached from |
|---|---|---|
| `quick-pick` | `renderQuickPick()` — new. Empty-state-first customer search (no results list until a query is typed; no "browse all" affordance). | "+ New Audit" (redefined), `?entry=quick` with no `customer`/`hint`, `?entry=quick&hint=...` (pre-filled). |
| `quick-count` | `renderQuickCount()` — new. Search-first product list; selecting a product adds an inline row with a stepper directly on the row (no sheet-per-product for the default path). | `quick-pick` on selection, `?entry=quick&customer=<id>` directly, Customer Detail's new "Quick Audit" primary action. |

Existing views are **unmodified**: `customers`, `needs-attention`, `audits`, `customer-detail`, `inventory`, `audit`, `customer-audits`, `create-customer`, `workspace`.

### 14.4 New components and the exact edits to existing ones

**New, inside `stock-audit.js`:**

| Component | Responsibility |
|---|---|
| `renderQuickPick()` | Structurally mirrors `renderCreateCustomer` (`stock-audit.js:2335-2355`) — same search box, same debounce, same `data-pick` row pattern — but the empty-query branch renders an empty state ("Search for the customer you're visiting") instead of `all`. Accepts an optional prefill value (for the `hint` case). |
| `renderQuickCount()` | New product search (empty-state-first, matches name/SKU). Selecting a product from results adds it to a "Selected products" list on the same screen — no navigation away. |
| `quickRowHTML(product, line)` | New, minimal row: product name, SKU as secondary text, inline stepper (`− qty +`) directly on the row. No condition/shelf/status metadata by default. |
| `quickMore(product)` | The progressive-disclosure affordance ("+ add condition, shelf, notes" or similar) on a `quickRowHTML` row. Opens the *existing* `sheet()` primitive, pre-populated with the condition-breakdown/shelf-toggle/notes markup **extracted from**, not duplicated from, today's Product Count Sheet (`renderProductSheet`, `stock-audit.js:2695`+). Writes into the exact same `DRAFT.lines[p.id]` shape either way — a quick row and a fully-detailed line are the same data structure, just filled in to different depths. |
| `WhatsAppLink.build(customer)` | Pure function → `location.origin + path + "?entry=quick&customer=" + customer._id + "&source=whatsapp"`. No side effects. |
| `WhatsAppLink.send(customer)` | Mocked action: builds the URL, shows it (toast and/or a small "copy link" sheet), does not call any external service — same convention as `customers.js:1090`'s existing mock. Wired to a new "Send Quick Audit Link" trigger on Customer Detail, visually following the existing `openCampaignModal` pattern (`customers.js:1069-1094`: centered modal, customer name/phone, description, Cancel + green action button) rather than inventing a new interaction style. |

**Changed, existing files — small and targeted:**

| File / function | Current behavior | Change |
|---|---|---|
| `stock-audit.js` — `wireNav()` (`:975-978`) | Bottom-nav "+ New Audit" calls `go("create-customer", {})`. | Calls `go("quick-pick", {})` instead. `create-customer`/`renderCreateCustomer` stay in the codebase (still usable internally) but are no longer wired to this button. |
| `stock-audit.js` — `actionRowHTML()` (`:1562-1567`) | Renders one primary button (Start Audit / Resume) that routes into `workspace`. | Primary button now routes into `quick-count` (via `startAuditFor`, unchanged internals). A new secondary, lower-emphasis link/button — "Full Shelf Audit" — is added alongside it, routing into the existing `workspace` view exactly as today's primary button used to. Nothing about `workspace` itself changes. |
| `stock-audit.js` — `mount()` (`:3271-3281`) | Reads `location.search` for `customer` only; two branches (`customer` present → Customer Detail, absent → Customers landing). | Adds one check *before* those two: if `entry=quick`, branch into §14.2's table (straight to `quick-count` with `customer`, or `quick-pick` with optional `hint`). Both existing branches are untouched and still run for every URL shape that isn't `entry=quick`. |
| `delivery-management/.../sections/stop-detail.js` (different module) | Footer has three actions: Collect / Edit Order / Skip Stop (`:24-26`). | Adds a fourth action, e.g. `🧾 Stock Audit`, calling a new `openStockAuditLink(s)` that builds `".../stock-audit.html?entry=quick&hint=" + encodeURIComponent(s.phone) + "&source=route-delivery"` and opens it with `window.open(url, "_blank")` — a real top-level navigation, not an in-app screen transition (see §14.5). |

### 14.5 Why Route Delivery's boundary is a real top-level navigation, not an in-app link

Two independent constraints force this, both already documented by the repo itself, not introduced by this contract:

1. **Modules are siloed in production.** `DEVELOPMENT.md`: *"Locally everything is same-origin... in production it is not. Do not write anything that depends on that."* Delivery Management and Stock Audit are different modules, published from different repos, loaded as different iframes. There is no in-app route from one to the other in production, only in a developer's local `tools/dev.py` session.
2. **No shared customer identity exists between the two modules** (§14.1.8) — so even if a same-app transition *were* possible, there is no reliable id to hand across it today.

Both constraints point to the same shape: a real URL, opened as a real navigation, carrying a best-effort hint instead of a guaranteed key. This is a **mocked integration boundary** in the same sense WhatsApp is — clean today, and replaceable later (real cross-module customer resolution, or a real message-based handoff) without touching anything inside `quick-pick`/`quick-count` themselves, because both only ever consume the same three query params.

### 14.6 Explicit non-goals for this vNext pass

Deferred on purpose, not silently dropped — each was a §16 open question, now closed as out of scope:

- Barcode field on the product model, or any scan/camera input.
- Per-customer/per-location product assortment or expected-stock (`systemStock` stays global).
- Real WhatsApp Business API integration (mocked only, §14.1.2).
- A real cross-module shared customer-id service (Route Delivery's link stays hint-based, §14.1.8).
- Building out the dormant, unrelated platform-shell "Route Delivery" stub itself.

### 14.7 Reuse map (supersedes §10's provisional classifications with final calls)

| Reused, unchanged | New |
|---|---|
| `sheet()`, `wireSearchInput()`, `toast()`, `mountShell()` | `renderQuickPick()`, `renderQuickCount()` |
| `DraftStore`, `AuditStore`, `LocationStore` — same keys, same shapes | `quickRowHTML()`, `quickMore()` |
| `startAuditFor()`, `resumeOrRestartSheet()` (draft-wins logic) | `WhatsAppLink.build()` / `.send()` |
| `normalizeAudit`, `scoreFromAudit`, `healthBreakdown`, `recommendedActions`, `auditCoverage`, `finishAuditSheet`, `completeAudit` | `openStockAuditLink()` (Delivery Management side) |
| Condition-breakdown / shelf-toggle markup (extracted into `quickMore`, not duplicated) | Two new bottom-nav/action-row wiring changes (§14.4) |
| `renderWorkspace`, `renderCustomers`, `renderCustomerDetail` and all its sections, `renderCreateCustomer` — kept exactly as-is, as secondary paths | Fourth action button in `stop-detail.js` |

### 14.8 Decisions that are product calls, not engineering ones — confirm before building

Everything above is resolved enough to build against. Two items in §14.1 are engineering defaults standing in for a decision that should have explicit stakeholder sign-off, because reasonable people could want the other answer:

- **§14.1.6 (quick count scores identically to a full audit):** is stakeholder comfortable with a 1–2 product spot-check moving a shop's public health score exactly as much as a full audit would, with no minimum-coverage floor? The engineering default here is "yes, same pipeline" because it's the simplest correct thing the data model already supports — but it's a business policy question, not a technical one.
- **§14.1.1 (Delivery Management, not a rebuilt Route Delivery):** this is the pragmatic choice given today's codebase, but it does mean the feature ships inside a screen literally subtitled "mobile Route Delivery app" rather than under the platform's own "Route Delivery" label — worth confirming that's an acceptable look for v1 rather than a surprise.

---

## 15. Proposed Implementation Phases

1. **Phase 0 — Sign-off.** Confirm §14.8's two product-policy calls; everything else in §14 is ready to build against without further input.
2. **Phase 1 — `quick-pick`.** New view + `renderQuickPick()`, wired to a temporary/test route only (not yet to "+ New Audit"), so it ships and is reviewable in isolation before anything existing is touched.
3. **Phase 2 — `quick-count`.** New view + `renderQuickCount()`, `quickRowHTML`, `quickMore` (extracting, not duplicating, the condition/shelf markup). Writes into `DRAFT.lines` exactly as today; verify a quick-count draft finishes through the existing `finishAuditSheet`/`completeAudit` path unmodified.
4. **Phase 3 — Wire the journey.** `quick-pick` → `quick-count` end to end. Only now touch existing code: `wireNav()`'s "+ New Audit" and `actionRowHTML()`'s primary button (§14.4), both single-line-ish changes with the old behavior still reachable via the new "Full Shelf Audit" secondary link.
5. **Phase 4 — `mount()` entry-param handling.** Add the `entry=quick` branch (§14.2). Verify the two existing branches (`customer` alone, no params) are provably unchanged — this is the highest-leverage regression point given zero test coverage.
6. **Phase 5 — Entry Point A.** `WhatsAppLink.build()`/`.send()` + the Customer Detail trigger. Mocked send only, per §14.1.2.
7. **Phase 6 — Entry Point B.** `stop-detail.js`'s fourth action + `openStockAuditLink()`, per §14.4/§14.5. Owned by/coordinated with the Delivery Management module, since this is the one change outside Customer Management's own files.
8. **Phase 7 — Validation pass.** Every path in §14.2's table produces a valid, correctly-scored `AuditStore` record visible in the right places (Customer Detail, Audit History) — the same check called out in §13 for the lack of existing tests.

---

## Validation (repo state as inspected)

No implementation, redesign, or business-logic change was made during this audit. No route, component, or data file was edited or deleted.

```text
Build:      N/A — no build step exists for this module (static HTML/CSS/JS, no bundler)
Typecheck:  N/A — no TypeScript in this module
Tests:      0/0 — no test suite exists for this module or its dependencies
Lint:       N/A — no linter configured for this module
Serve:      PASS — v2 snapshot confirmed running and rendering correctly via `python3 -m http.server 8000 --directory v2`
```

These are **pre-existing** conditions of the repo, not failures introduced by this audit. No files were run, built, or modified. This update added the implementation contract in §14 and the phase list in §15 to `docs/stock-audit-vnext-audit.md`; no other file in the repository was touched.

---

## Final Summary

```text
CURRENT STATE
- Stock Audit & Health is a mature, well-built field-ops audit tool (3,284 lines, v2-only)
  optimized for comprehensive shelf audits, not quick spot-checks.
- It already went through one wizard-collapse simplification (commit c0972d2) in the
  direction vNext wants to continue.
- Pure static HTML/JS/CSS, no backend, no build, no tests, localStorage-only persistence.

REUSABLE
- The customer picker (renderCreateCustomer) is already search-then-select; just needs
  its empty-state default flipped.
- The Product Count Sheet mechanism (persistent sheet, auto-advance on Save) is exactly
  right, just too heavy by default.
- The full audit data model + scoring/health pipeline (AuditStore, DraftStore,
  scoreFromAudit, healthBreakdown, recommendedActions) is sound and should be the single
  target every entry point writes to.
- "Draft always wins" resume-safety logic is solid and should not change.

NEEDS CHANGE
- Customer picker and Workspace both default to showing the full list; both need to
  default to empty-state-with-search instead.
- Product Count Sheet and product rows carry more always-visible metadata than the
  "minimum required" bar; needs a progressive-disclosure pass (a pattern that already
  exists narrowly — the Advanced section — and needs to be applied more broadly).

MUST BUILD — now a concrete contract, see §14
- quick-pick + quick-count: two new views/functions inside stock-audit.js, isolated
  from the existing full-audit path (§14.3, §14.4).
- Entry Point A (WhatsApp): mocked send only (WhatsAppLink.build/.send), a new
  ?entry=quick&customer=<id> receiving branch in mount(). No real WhatsApp API.
- Entry Point B (Route Delivery): a fourth action button in Delivery Management's
  stop-detail.js, opening stock-audit.html?entry=quick&hint=<phone> as a real
  top-level navigation (production modules are cross-origin — confirmed via
  DEVELOPMENT.md's own same-origin-only-in-local-dev warning).
- Both entry links must open stock-audit.html directly, never through the platform
  shell's #/... hash route — confirmed the shell's frame.src never forwards query
  strings (platform.js:453-454).

RESOLVED DECISIONS (were open questions; now defaults to build against — see §14.1)
- Entry B lives in Delivery Management's stop-detail, not a rebuilt "Route Delivery."
- WhatsApp is mocked, matching the rest of the codebase's convention.
- Per-shop assortment, expected-stock, and barcode search are explicit non-goals
  for this pass (§14.6), not silently dropped.
- quick-pick/quick-count are new views, not mode flags on the existing ones.
- A quick count scores through the exact same pipeline as a full audit — no
  special-cased scoring.
- A WhatsApp link's customer=<id> is real and reliable (generated by Stock Audit
  itself); a Route Delivery link's hint=<phone> is not a guaranteed match, because
  Delivery Management and Customer Management use different, unlinked customer ID
  spaces (§14.1.8) — this is why Entry A can skip straight to counting and Entry B
  cannot.

RISKS — unchanged, still real under the resolved contract
- No unified product data model (Stock Audit's 12-SKU seed vs. Catalog's separate,
  differently-shaped seed).
- Product stock is global, not per-customer/location (explicit non-goal, §14.6).
- No barcode field or scanning support anywhere (explicit non-goal, §14.6).
- No session/auth layer at all — a single hardcoded rep identity.
- Zero test coverage as a regression safety net — Phase 4 (mount()'s new branch)
  is the highest-leverage point to verify by hand (§15).
- Naming collision risk: "Stock Audit" (Customer Mgmt), "Stock Count" (Delivery Mgmt),
  and "Stock Audit Settlement" (unbuilt stub) are three unrelated concepts already
  coexisting in this codebase.

OPEN — genuine product-policy calls, not technical ones (§14.8)
- Should a 1–2 product quick count move a shop's public health score exactly as
  much as a full audit, with no minimum-coverage floor?
- Is it acceptable that Entry Point B ships inside a screen literally subtitled
  "mobile Route Delivery app" (Delivery Management) rather than under the
  platform's own dormant "Route Delivery" label?

RECOMMENDED NEXT STEP
- Sign off on §14.8's two policy calls (Phase 0), then build Phases 1–4 (quick-pick,
  quick-count, wiring, entry-param handling) as a self-contained unit reviewable
  before either integration boundary (WhatsApp, Route Delivery) is touched.
```

**STOP. No implementation has been started. Awaiting review and approval before proceeding.**

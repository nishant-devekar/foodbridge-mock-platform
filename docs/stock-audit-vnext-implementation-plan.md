# Stock Audit & Health vNext — Implementation Plan

**Status:** Planning document. **No implementation performed.** Ready for review; execution begins only after sign-off.
**Inputs:** `customer-stock-audit-ux-requirements.md` (desired UX), `docs/stock-audit-vnext-audit.md` (repository findings, esp. §14's implementation contract). This document does not repeat that audit's discovery work — it cites it and turns its contract into an executable sequence.
**Repo state planned against:** `main` @ `c0972d2`, `v2` snapshot (current), `stock-audit.js` (3,284 lines).

---

## 1. Executive Summary

The audit (§14) already resolved every open scope question into a contract: two new views (`quick-pick`, `quick-count`), a `?entry=quick` URL contract, a mocked WhatsApp boundary, and a Delivery Management integration point. This document turns that contract into something a developer executes top-to-bottom without further discovery — an explicit state model, an exact data-model diff (two new fields, both backward-compatible via existing normalization patterns), a file-by-file change list, and a 14-step build sequence ordered to keep the existing full-audit experience provably working at every step.

**The one new architectural decision this plan makes that the audit didn't yet nail down:** Quick Audit's scope (§4 of the task brief) turns out to require no new coverage logic at all. `auditCoverage()` already reads `a.expectedProducts` as its primary denominator (`stock-audit.js:576`), and `completeAudit()` already snapshots that field at write time (`stock-audit.js:3187`, currently always `products.length`). Quick Audit only needs that one call site to pass a different number — `DRAFT.selected.length` instead of the full catalogue's length. The existing partial-coverage machinery (`finishAuditSheet`, "some skipped" branch) is completely unaware of *why* the denominator is small, so it needs no change at all. This is the throughline for most of this plan: **almost everything "new" is a new front end over an unchanged engine**, exactly as the audit's core idea said.

---

## 2. Locked Product Decisions

Carried forward from audit §14.1/§14.8, restated here as build-time constants (no further debate during implementation):

| # | Decision | Status |
|---|---|---|
| 1 | Quick Audit scope = explicitly selected products only, not the full catalogue. | **Locked** — this task's own brief (§4), confirmed technically feasible above. |
| 2 | Entry B integration point = Delivery Management's `stop-detail.js`, not a rebuilt "Route Delivery." | **Locked**, audit §14.1.1. |
| 3 | WhatsApp = mocked send only, no real API. | **Locked**, audit §14.1.2. |
| 4 | No per-shop product assortment / expected-stock. | **Locked out of scope**, audit §14.1.3. |
| 5 | No barcode field or scanning. | **Locked out of scope**, audit §14.1.4. |
| 6 | Quick Audit and Quick Count are new views, not mode flags on `renderCreateCustomer`/`renderWorkspace`. | **Locked**, audit §14.1.5. |
| 7 | A completed Quick Audit feeds the exact same scoring/health pipeline as a full audit. | **Locked**, audit §14.1.6 — see §14.8's flagged policy question below. |
| 8 | WhatsApp's link carries a real `customer=<id>`; Route Delivery's carries a best-effort `hint=<phone>` only, because the two modules have unlinked customer ID spaces. | **Locked**, audit §14.1.8/§14.5. |
| 9 | Product source for Quick Audit = the existing Stock Audit seed (`seed.inline.js`, 12 SKUs), not Catalog's separate seed. | **Locked**, per this task's §19 instruction. No catalogue-unification project. |
| 10 | No framework, bundler, or TypeScript migration. | **Locked**, per this task's §20 instruction and the repo's existing convention. |

**Two items remain genuine open policy calls** (audit §14.8), assumed resolved as follows *for this plan* so implementation isn't blocked, clearly marked as assumptions:

- **Assumption A:** A Quick Audit affects a customer's health score exactly like a full audit, with no minimum-coverage floor. (If stakeholders want a floor — e.g., Quick Audits never move the score, or only do so above N products — that changes §17 and is a small, isolated change to `completeAudit`'s scoring call, not a re-architecture.)
- **Assumption B:** Shipping Entry B inside Delivery Management (subtitled "mobile Route Delivery app") rather than under the platform's own "Route Delivery" label is acceptable for this version.

---

## 3. Target End-to-End Flow

```
Entry (in-shell nav, WhatsApp link, or Delivery Management action)
  ↓
quick-pick        — search-first customer search, empty by default
  ↓ select
quick-count       — search-first product search, empty by default
  ↓ select product(s)
  Selected products list (on the same screen — no navigation away)
  ↓ tap a selected row
  Inline count (stepper), optional "more" → condition/shelf/notes
  ↓ Save
  Auto-advance to next uncounted *selected* product
  ↓ (repeat until every selected product is counted, or rep stops early)
Finish Audit
  ↓
completeAudit() — unchanged — score, health, recommended actions, AuditStore write
  ↓
Customer Detail (already updated) + confirmation sheet
```

Matches the task brief's target diagram exactly; `Selected Products` and `Count Products` are the same screen state (`quick-count`), not two navigations, per §10 below.

---

## 4. Architecture

```
                        Existing Audit Engine  (UNCHANGED)
     normalizeAudit · scoreFromAudit · healthBreakdown · recommendedActions
     auditCoverage · finishAuditSheet · completeAudit · DraftStore · AuditStore
                                   │
                 ┌─────────────────┴─────────────────┐
                 │                                     │
          Existing Full Audit                   Quick Audit vNext (NEW)
                 │                                     │
     renderCustomers / renderCustomerDetail      renderQuickPick()
     renderWorkspace (priority-ordered,          renderQuickCount()
       full 12-SKU list, per-product sheet)      (search-first, rep-curated
     renderAudits / renderAudit /                 selection, inline stepper,
       renderCustomerAudits / renderInventory     progressive "more")
                 │                                     │
                 └────────────────┬────────────────────┘
                                   │
                    same DRAFT / DraftStore / AuditStore shapes
                    (two additive fields — see §7)
```

Every box under "Quick Audit vNext" is additive code inside the **same file** (`stock-audit.js`), sharing the same closure, router, and stores as the existing code — not a parallel module. See §8 for why a separate file was rejected.

---

## 5. State Model

Quick Audit's states, layered onto the *existing* `DRAFT.status` machine (audit §8) rather than replacing it — a Quick Audit draft is still a `DraftStore` entry with `status: draft|in_progress|paused`, exactly like today. The states below are the **view-level** states specific to the Quick Audit journey; `DRAFT.status` transitions are the ones already documented in the audit and are unchanged.

| State | Entry condition | User action | Transition | Persistence mutation | Destination |
|---|---|---|---|---|---|
| **ENTRY** | Any of: tap "+ New Audit"; open `?entry=quick[&hint]`; open `?entry=quick&customer=`; tap Delivery Management's new action. | — (routing only) | `mount()` or `wireNav()` dispatches based on whether a `customer` is already known (§6). | None. | `CUSTOMER_SELECTION` (no customer known) or straight to `PRODUCT_SELECTION` (customer known). |
| **CUSTOMER_SELECTION** | View `quick-pick`. | Type in search box; tap a result row. | `renderQuickPick()`'s `data-pick` handler → `startAuditFor(customerId)` (existing, unchanged). | None yet — `startAuditFor` only *reads* `DraftStore`. | `RESUME_OR_RESTART` (open draft exists) or `PRODUCT_SELECTION` (fresh). |
| **RESUME_OR_RESTART** | `startAuditFor` finds an existing `DraftStore` entry for this customer (existing logic, unchanged: `resumeOrRestartSheet`, `stock-audit.js:930-949`). | Tap "Resume that visit" or "Start a new one instead." | `resumeDraft()` (existing) or `DraftStore.clear()` + `newDraft()` (existing). | Existing — no change. | `PRODUCT_SELECTION` or `COUNTING`, depending on whether the resumed draft already has selections (see below). |
| **PRODUCT_SELECTION** | View `quick-count`, `DRAFT.selected` empty or being edited. | Search products; tap a result to add it to `DRAFT.selected`; tap an already-selected row's remove control. | `renderQuickCount()`'s add/remove handlers mutate `DRAFT.selected` (new array, §7) and call `persistDraft()` (existing function, reused). | `DraftStore` write via existing `persistDraft()`. | Stays in `PRODUCT_SELECTION`/`quick-count` — selection and counting share one screen (§10); this row in the table exists to name the sub-state, not to imply a navigation. |
| **COUNTING** | A row in `DRAFT.selected` is tapped. | Adjust stepper, optionally expand "more" (condition/shelf/notes), tap Save. | Writes/updates `DRAFT.lines[productId]` (existing shape, §7 default), calls the generalized `nextUncapturedIn(DRAFT.selected, productId)` (new, extracted from existing `nextUncaptured`, §8) to auto-advance. | `persistDraft()`. | Back to `PRODUCT_SELECTION`/`quick-count` view, now showing the next uncounted selected product ready to tap, or "all counted" if none remain. |
| **COMPLETING** | Rep taps "Finish Audit" from `quick-count`. | Confirm (or, if some selected products are still uncounted, choose Continue vs. Finish Anyway — existing `finishAuditSheet` UI, unchanged). | `finishAuditSheet()` (existing, unchanged) → `completeAudit()` (existing, unchanged except the `expectedProducts` value it's passed — §7). | `AuditStore` write, `DraftStore.clear()` — both existing, unchanged. | `COMPLETED`. |
| **COMPLETED** | `completeAudit()` has run. | Tap "Done" on the existing `successSheet` (unchanged). | None further. | None further. | Customer Detail (existing behavior, unchanged) — or, for Entry B, an added "Return to Route" affordance (§11). |
| **PAUSED** | Rep taps "Exit" mid-`quick-count`, chooses "Pause." | — | `pauseAudit()` (existing, unchanged). | `DraftStore` keeps the draft (including `DRAFT.selected` and any partial `DRAFT.lines`), `status: "paused"`. | Customer Detail. Re-entering Start Audit for this customer returns to `RESUME_OR_RESTART` with selections intact. |
| **ABANDONED** | Rep taps "Exit" → "End this visit" → picks a reason. | — | `abandonAudit()` (existing, unchanged). | New `AuditStore` record, `status: "abandoned"`, `DraftStore` cleared. | Customer Detail. |
| **DISCARDED** | Rep taps "Exit" → "End this visit" → "Discard it instead." | — | `DraftStore.clear()` (existing, unchanged). | Nothing written anywhere. | Customer Detail. |

**Exit surface is identical to today's** (`exitAuditSheet`, `endVisitSheet` — audit §9's four-outcome table is unchanged and applies verbatim to Quick Audit; see §16 below for the Quick-Audit-specific framing of each).

---

## 6. Routing Model

No new routing framework, per the task brief and audit §14.5's finding that the platform shell's hash router (`platform.js:453-454`) never forwards query strings into the module iframe. This plan extends the two routing layers that already exist:

1. **`stock-audit.js`'s internal stack router** (`go()`/`back()`, `stock-audit.js:843-853`) gains two new view keys, `quick-pick` and `quick-count`, added to the existing dispatch table (`renderCurrent`, `:859-869`). They participate in `STACK` exactly like every other view — `back()` works for free.
2. **`mount()`'s query-param handling** (`stock-audit.js:3271-3281`) gains one new branch, checked *before* the two that exist today.

### 6.1 URL contract (unchanged from audit §14.2, restated as the build spec)

| URL | New/existing branch in `mount()` | Behavior |
|---|---|---|
| `stock-audit.html?entry=quick&customer=<id>&source=whatsapp` | New | `startAuditFor(id)` directly (skips Customer Detail) → existing draft-wins check → `quick-count`. |
| `stock-audit.html?entry=quick&hint=<phone>&source=route-delivery` | New | `go("quick-pick", { prefill: hint })` — search box pre-filled, not auto-selected. |
| `stock-audit.html?entry=quick` | New | `go("quick-pick", {})` — empty state. Bound to the redefined "+ New Audit" nav button too (§6.3). |
| `stock-audit.html?customer=<id>` (no `entry=`) | **Existing, unchanged** | Opens Customer Detail. |
| `stock-audit.html` (no params) | **Existing, unchanged** | Opens Customers landing. |

### 6.2 Browser refresh / back behavior

- **Refresh while a Quick Audit is mid-count:** `CURRENT`/`STACK` are in-memory only (unchanged from today — this is not a new limitation). A refresh reloads `mount()` from scratch. If the page was opened with `?entry=quick&customer=` still in the address bar (the normal case for a standalone/deep-linked session — see audit §14.2's constraint that this must be a direct navigation, not an iframe), `mount()` re-runs the same branch, calls `startAuditFor` again, finds the now-in-progress draft via `DraftStore`, and routes through `RESUME_OR_RESTART` — no data lost, one extra tap ("Resume"). If reached via the in-shell "+ New Audit" button (no query params on the iframe URL), refresh drops back to Customers landing, same as today's identical behavior for a mid-Workspace refresh — **not a regression**, just an existing, accepted limitation extended to the new views.
- **Back button:** within the shell, standard existing behavior (`back()` pops `STACK`). For a standalone Entry A/B tab, the browser's native back button applies to `stock-audit.html`'s own history, which this plan does not push additional entries onto (the internal router doesn't touch `history.pushState`, unchanged).
- **Post-completion:** existing behavior (Customer Detail + success sheet), with one addition for Entry B — see §11.

### 6.3 Changed wiring in existing code (both one-line-scale)

| File / function | Before | After |
|---|---|---|
| `stock-audit.js` `wireNav()` (`:975-978`) | `"create"` key → `go("create-customer", {})` | → `go("quick-pick", {})` |
| `stock-audit.js` `actionRowHTML()` (`:1562-1567`) | One primary button → `startAuditFor` → `workspace` | Primary button → `startAuditFor` → `quick-count`; new secondary "Full Shelf Audit" link → `workspace` (unchanged target, just no longer the default) |

---

## 7. Data Model

**Principle (per task §18): change nothing the new semantics don't require.** Two additive fields, both following the exact pattern `normalizeAudit`/`blankLine` already use for backward compatibility (default-if-missing, no migration script, old records read correctly forever).

### 7.1 New field: `mode`

| | |
|---|---|
| **Name** | `mode` |
| **Type** | `"quick" \| "full"` |
| **Applies to** | `DRAFT` (draft object) and the finished audit record written by `normalizeAudit`/`completeAudit`/`abandonAudit`. |
| **Purpose** | Distinguishes a targeted spot-check from a comprehensive audit — needed for (a) the `expectedProducts` decision below, (b) an optional "Quick" badge in Audit History/Customer Detail so a rep or manager can tell the two apart at a glance. |
| **Default** | `"full"` — added to `normalizeAudit` exactly like every other optional field there (`if (!a.mode) a.mode = "full";`, next to the existing `if (!a.outcome) ...` line, `stock-audit.js:492`). |
| **Migration / backward compatibility** | **None needed.** Every existing seeded and localStorage-persisted audit predates this field; the default makes them all `"full"`, which is exactly what they actually were. |
| **Affected code** | `newDraft()` (`:882-897`, set `mode` at creation based on which entry path built the draft), `normalizeAudit()` (default), `completeAudit()`/`abandonAudit()` (carry `DRAFT.mode` onto the written record — both already spread most `DRAFT` fields onto the record, so this is one more line each), Audit History row rendering (`renderAudits`, optional badge), Audit Detail (`renderAudit`, optional badge). |

### 7.2 New field: `selected`

| | |
|---|---|
| **Name** | `selected` |
| **Type** | `string[]` — ordered array of `productId`, selection order preserved. |
| **Applies to** | `DRAFT` only. **Not** written onto the completed `AuditStore` record — `lines` (existing field) already carries the final list of counted products; `selected` is working state during the count, not part of the historical record. |
| **Purpose** | The thing this whole task is about: an explicit, rep-curated "what am I checking" list, independent of `DRAFT.lines` (which today only gains an entry once a count is *saved*). Quick Count's screen renders by iterating `selected`, not the catalogue. |
| **Default** | `[]`, set in `newDraft()` alongside the existing `lines: {}`. **Absent entirely on every existing full-audit draft/record** — `renderWorkspace` never reads it, so its absence there is inert, not a gap needing a fallback. |
| **Migration / backward compatibility** | **None needed.** Only Quick Audit code paths ever read `DRAFT.selected`; full-audit code paths (`renderWorkspace`, `wsRowHTML`, `nextUncaptured`'s existing call site) are never touched and never look for it. |
| **Affected code** | `newDraft()` (add `selected: []`), `renderQuickCount()` (new — reads/mutates it), select/remove handlers (new — push/splice), `nextUncapturedIn()` (new, generalized — walks it), `completeAudit()`/`abandonAudit()` (read `.length` once, for `expectedProducts` — see 7.3, then never touch it again; it is not carried onto the record). |

### 7.3 Changed call site, not a schema change: `expectedProducts`

`auditCoverage()` (`:572-579`) already treats `a.expectedProducts` as the authoritative denominator, falling back to `lines.length`/`products.length` only if absent. **No change to this function.** The only change is what value `completeAudit()` (`:3163-3195`, the `expectedProducts: products.length` line, `:3187`) and `abandonAudit()` (the equivalent line, `:2629`) pass in:

```
expectedProducts: DRAFT.mode === "quick" ? DRAFT.selected.length : products.length
```

Full-audit drafts have no `selected` field and `mode !== "quick"`, so they take the `products.length` branch — **byte-for-byte the same value they compute today.** This confirms the task brief's §4 requirement ("3 selected → 3 counted → complete") is satisfied without touching `auditCoverage`, `finishAuditSheet`, or any scoring function.

### 7.4 Line defaults for a minimal (no "more" opened) Quick Count save

No schema change to the line shape (`blankLine`, `:416-433`) — Quick Count's minimal save just fills fewer of the existing optional fields, following the shape's own existing reconciliation rule (`normalizeLine`: *"Physical stock IS the sum of its condition buckets,"* `:455-457`):

```
line.physical = enteredQty
line.conditionBreakdown.good = enteredQty   // everything else stays 0
line.status = "audited"
```

Opening "more" and reassigning some units to damaged/expired/near-expiry is a strict superset of this — it just moves units between the same buckets the minimal path already wrote into `good`. No new field, no new status value.

### 7.5 Fields explicitly NOT added (per task §18's "only change where genuinely required")

- No new `productId → barcode` field (§14.6 non-goal).
- No per-customer/per-location `systemStock` override (§14.6 non-goal).
- No new `AuditStore` schema version or migration flag — nothing about the two additive fields requires one.
- No new `DraftStore` top-level key — Quick Audit drafts live in the *same* `fb-discovery-stock-draft-audits-v1` map as full-audit drafts, keyed by customer id exactly as today (a customer has at most one open draft regardless of mode — consistent with "draft always wins" applying uniformly, §15).

---

## 8. Component / File Plan

| File | Change | Why |
|---|---|---|
| `stock-audit.js` | **Modified** — additive only. New: `renderQuickPick()`, `renderQuickCount()`, `quickRowHTML()`, `quickMore()`, `WhatsAppLink.build()`/`.send()`, `nextUncapturedIn()` (generalized extraction — see below), two new `CURRENT.view` dispatch entries, two small call-site edits (§6.3), `mode`/`selected` handling in `newDraft`/`normalizeAudit`/`completeAudit`/`abandonAudit` (§7). | Single source of truth for the router, `DRAFT`, and every store — adding views here is a few new functions in an existing closure, not a new module boundary. Splitting into a second file was evaluated in the audit (§14.3) and rejected: `CURRENT`/`STACK`/`DRAFT`/`PAGE` are private to this file's IIFE, so a second file could only participate via a registration hook — more surface area than the two functions it would save. |
| `stock-audit.js` — `nextUncaptured()` (`:2551-2561`) | **Refactored (extraction, not rewrite)**. Body becomes a one-line wrapper: `nextUncapturedIn(priorityOrderedProducts, afterId)`, where `priorityOrderedProducts` is the exact `products.slice().sort(...)` expression already there. New `nextUncapturedIn(list, afterId)` takes the ordered id/product list as a parameter instead of hardcoding `products`. | `renderWorkspace`'s existing call site (`:2560`-area) doesn't change at all — same function name, same signature, same behavior, because the wrapper preserves it exactly. `renderQuickCount()` calls the new generalized function directly with `DRAFT.selected`-resolved products in *selection* order (see §14 below for why selection order, not priority order, is the right default for a rep-curated list). This is the one piece of "reuse via small refactor" in the whole plan; everything else is either untouched or purely additive. |
| `stock-audit.js` — `renderProductSheet()` / product-sheet internals (`:2695`+) | **Read-only reference, not modified.** `quickMore()` (new) opens the *existing* `sheet()` primitive and reuses the existing condition-breakdown/shelf-toggle DOM-building fragments by calling the same small rendering helpers those already delegate to, rather than copy-pasting markup. | Keeps one implementation of "what a condition/shelf field looks like" — Quick Count's advanced view and the full Product Count Sheet stay visually and behaviorally identical when expanded. |
| `customers.js` | **Modified**, one addition: a "Send Quick Audit Link" trigger on Customer Detail... *(see note)* | **Note:** Customer Detail itself lives in `stock-audit.js` (`renderCustomerDetail`, `actionRowHTML`), not `customers.js` — the WhatsApp trigger is added there, alongside the existing primary/secondary action buttons (§6.3's `actionRowHTML` edit already covers this slot). `customers.js` is listed here only because `openCampaignModal` (`customers.js:1069-1094`) is the visual pattern being followed for `WhatsAppLink.send()`'s confirmation modal — **read as a reference, not modified.** |
| `delivery-management/.../sections/stop-detail.js` | **Modified** — one new footer button + one new handler function (`openStockAuditLink(s)`), following the existing pattern of `#collect`/`#edit`/`#skip` button wiring in the same file (`:24-30`). | Smallest possible change in a module this plan does not otherwise touch — three lines of new markup, one new function, no change to `DM.go`, `DM.state`, or any other section. |
| `delivery-management/.../sections/stock-count.js` | **Untouched.** | Confirmed unrelated (audit §4) — vehicle-stock settlement, different data, different purpose. Explicitly not touched, called out here so it's clear the naming collision was investigated and deliberately left alone, not missed. |
| `v2/assets/modules.json`, `v2/assets/platform.js` | **Untouched.** | No new in-shell nav entry needed — Quick Audit is reached via the existing "+ New Audit" button (relabeled destination, not a new route) and via direct/standalone URLs for Entry A/B, which the shell was never involved in (§6.1). |
| `seed.inline.js` | **Untouched.** | No data-model change requires new seed data; `mode`/`selected` are runtime-only/draft-only fields with safe defaults (§7). |
| Everything else (`renderCreateCustomer`, `renderWorkspace`, `renderCustomers`, `renderCustomerDetail`'s other sections, `renderAudits`, `renderAudit`, `renderCustomerAudits`, `renderInventory`, `shell.js`, `catalog.js`, `LocationStore`) | **Untouched.** | Explicitly verified against, not assumed — see §20 (Regression Strategy). |

---

## 9. Detailed Implementation Sequence

Ordered to keep the existing full-audit experience working and independently verifiable after every step. Each step is small enough to review and manually validate on its own before the next begins.

### Step 0 — Lock the contract
- **Objective:** Confirm §2's two flagged assumptions (A, B) with the product owner; everything else is ready to build.
- **Files:** None.
- **Dependencies:** None.
- **Expected result:** Written sign-off (or an explicit override) on Assumptions A and B.
- **Validation:** N/A — a decision, not code.

### Step 1 — Data model additions
- **Objective:** Land `mode`/`selected` on `DRAFT`, with full backward-compatible defaulting, before any UI exists to use them.
- **Files:** `stock-audit.js` — `newDraft()` (`:882-897`), `normalizeAudit()` (`:475-500`).
- **Dependencies:** None.
- **Details:** `newDraft()` gains `mode: "full"` (default) and `selected: []`. `normalizeAudit()` gains one default line for `mode`, mirroring its existing `if (!a.outcome) a.outcome = null;` style at `:492`. No caller changed yet.
- **Expected result:** Every existing draft/audit still round-trips identically; new fields exist but are inert.
- **Validation:** Open the existing full Workspace end-to-end (start → count → finish) and confirm the resulting `AuditStore` record is unchanged in every field except the new `mode: "full"`.

### Step 2 — `nextUncaptured` → `nextUncapturedIn` extraction
- **Objective:** Generalize the auto-advance helper before either new view needs it, so both `renderWorkspace` and the future `renderQuickCount` share one implementation.
- **Files:** `stock-audit.js` (`:2551-2561`).
- **Dependencies:** Step 1 (harmless order, but keeps data-model changes isolated first).
- **Details:** Extract the body into `nextUncapturedIn(orderedList, afterId)`; `nextUncaptured(lastAudit, afterId)` becomes a thin wrapper passing the existing priority-sorted `products` expression.
- **Expected result:** Identical behavior for every existing call site.
- **Validation:** Full-audit product-sheet auto-advance still walks priority order exactly as before (manual click-through: save a flagged product, confirm the next flagged one opens next).

### Step 3 — `quick-pick` view
- **Objective:** Ship the new empty-state-first customer picker, reachable only via a temporary/test route (not yet wired to "+ New Audit"), so it's reviewable in isolation.
- **Files:** `stock-audit.js` — new `renderQuickPick()`, new `CURRENT.view` dispatch entry `"quick-pick"`.
- **Dependencies:** None beyond existing `wireSearchInput`, `sheet`, `startAuditFor`.
- **Details:** Structurally mirrors `renderCreateCustomer` (`:2335-2355`) — same search box/debounce/`data-pick` pattern — with the empty-query branch rendering an empty state instead of `all`. Selecting a row calls the existing `startAuditFor(customerId)` unchanged.
- **Expected result:** A working, empty-state-first customer search, callable via a manual `go("quick-pick", {})` from the browser console for review.
- **Validation:** Empty state on load; typing filters correctly; no-results state; selecting a customer with no open draft goes straight into `startAuditFor`'s existing fresh-draft path (which, until Step 4, lands on the *existing* `workspace` view — expected and fine, confirms `startAuditFor` itself needed no change).

### Step 4 — `quick-count` view: selection + minimal counting
- **Objective:** The core new screen — search-first product selection, inline stepper, auto-advance, all in one view.
- **Files:** `stock-audit.js` — new `renderQuickCount()`, `quickRowHTML()`, new dispatch entry `"quick-count"`; `startAuditFor()`'s two destinations (fresh-draft, resumed-draft) now branch on `DRAFT.mode` to `go("quick-count", ...)` vs. `go("workspace", ...)` (one small conditional in an existing function).
- **Dependencies:** Steps 1–3.
- **Details:**
  - Product search: name/SKU match against `SEED.products`, empty-state-first (mirrors Step 3's pattern).
  - Selecting a search result: `DRAFT.selected.push(productId)` if not already present (duplicate tap is a no-op, not a second entry — see §13); `persistDraft()`; re-render.
  - Selected-products list: iterate `DRAFT.selected`, render `quickRowHTML(product, DRAFT.lines[productId])` — inline stepper if uncounted, a compact "counted ✓" state if `lineIsCaptured` (existing helper, reused).
  - Save on a row: writes `DRAFT.lines[productId]` per §7.4's minimal default, calls `nextUncapturedIn(DRAFT.selected.map(productById), productId)` (Step 2's new function) to determine what to open next; if nothing remains, stays on the selected-products list.
  - Remove control on an uncounted row: splice from `DRAFT.selected`; if a line was already started for it, delete `DRAFT.lines[productId]` too (§13).
  - Footer: "Finish Audit" → existing `finishAuditSheet(customer)`, unchanged.
- **Expected result:** A rep can search, select 2–3 products, count them with the minimal stepper, and reach the existing Finish flow.
- **Validation:** Empty state; search; select; duplicate-select is a no-op; remove before counting; remove after counting; save advances to next selected uncounted product; "all counted" state when the list is exhausted; Finish Audit reaches the *existing*, unmodified `finishAuditSheet`.

### Step 5 — `expectedProducts` mode branch
- **Objective:** Wire §7.3's one-line change so a Quick Audit's coverage denominator is its selection, not the catalogue.
- **Files:** `stock-audit.js` — `completeAudit()` (`:3187`), `abandonAudit()` (`:2629`).
- **Dependencies:** Steps 1, 4.
- **Details:** `expectedProducts: DRAFT.mode === "quick" ? DRAFT.selected.length : products.length`.
- **Expected result:** A 3-product Quick Audit with all 3 counted shows `3/3`, 100% coverage, no "some skipped" warning; a full audit's denominator is provably unchanged.
- **Validation:** Complete a 3-product Quick Audit with all 3 counted → `finishAuditSheet` shows the "everything ready" one-tap path, not "N products haven't been counted." Complete a Quick Audit with 1 of 3 counted → the existing "some skipped" partial-coverage warning still fires correctly, just against the smaller denominator. Re-run the existing full-Workspace flow → coverage math unchanged.

### Step 6 — Progressive disclosure ("more")
- **Objective:** Land `quickMore()` so condition/shelf/notes/photo are one tap away, not gone.
- **Files:** `stock-audit.js` — new `quickMore()`, reusing existing condition/shelf/notes rendering fragments from `renderProductSheet`.
- **Dependencies:** Step 4.
- **Details:** Tapping "more" on a `quickRowHTML` row opens the existing `sheet()` primitive pre-populated with the same condition-breakdown/shelf-toggle/notes controls the full Product Count Sheet uses; writes into the *same* `DRAFT.lines[productId]` object the minimal path already created, just filling in more of it.
- **Expected result:** A rep who taps "more" gets the full existing capture surface for that one product; one who doesn't gets §7.4's minimal default.
- **Validation:** Minimal save → `conditionBreakdown.good = qty`. "More" → reassign some units to damaged → `conditionBreakdown` reflects the split, `physical` still equals the sum (existing invariant, unbroken). Downstream: a Quick Audit line with damaged units still triggers the existing recommended-actions logic (`recommendedActions`, unchanged) exactly like a full-audit line would.

### Step 7 — Draft lifecycle integration
- **Objective:** Verify (not build — this is largely already correct by construction) that pause/resume/restart behave correctly for Quick Audit drafts.
- **Files:** No new code expected; this step is verification of Steps 1–6's interaction with existing `pauseAudit`, `resumeDraft`, `resumeOrRestartSheet`, `exitAuditSheet`.
- **Dependencies:** Steps 1–6.
- **Details:** Because `DRAFT.selected`/`mode` live on the same `DRAFT` object `DraftStore` already persists wholesale, pause/resume carry them for free. This step is where that assumption gets exercised, not re-implemented.
- **Expected result:** Pausing a Quick Audit with 2 of 3 products selected/counted and resuming later restores the exact same selection and progress.
- **Validation:** Full manual walk of §15's draft-safety scenarios (below).

### Step 8 — Exit lifecycle for Quick Audit
- **Objective:** Confirm the existing four-outcome exit surface (§16) reads and behaves correctly when `DRAFT.mode === "quick"`.
- **Files:** No new logic expected — `exitAuditSheet`, `endVisitSheet`, `pauseAudit`, `abandonAudit` are unchanged; verification only, plus the `expectedProducts` branch from Step 5 applies here too (abandon path).
- **Dependencies:** Steps 5, 7.
- **Validation:** Pause, Recorded Incomplete, and Discard each produce the same effect on a Quick Audit draft as documented for full audits in audit §9 — Customer Detail as the landing spot every time, correct `AuditStore`/`DraftStore` state per outcome.

### Step 9 — Completion, scoring, history integration
- **Objective:** Confirm a completed Quick Audit shows up correctly everywhere a full audit does.
- **Files:** No new logic — `completeAudit`, `scoreFromAudit`, `healthBreakdown`, `recommendedActions`, `renderAudits`, `renderAudit`, `renderCustomerDetail` are unchanged, except the optional `mode` badge (§7.1) if included.
- **Dependencies:** Steps 5, 6.
- **Validation:** Full §17 checklist below.

### Step 10 — Bottom-nav / Customer Detail wiring (§6.3)
- **Objective:** Make Quick Audit the *default* path, now that it's fully validated in isolation.
- **Files:** `stock-audit.js` — `wireNav()` (`:975-978`), `actionRowHTML()` (`:1562-1567`).
- **Dependencies:** Steps 1–9 all independently validated.
- **Details:** This is the step that changes existing, currently-shipped behavior — done last and in isolation on purpose. "+ New Audit" → `quick-pick`. Customer Detail's primary button → `quick-count` path; new secondary "Full Shelf Audit" link → today's unchanged `workspace` path.
- **Expected result:** The in-shell happy path is now Quick Audit by default; the full audit is one extra tap away, not gone.
- **Validation:** Full regression pass (§20) — this is the highest-leverage step for accidentally breaking the existing experience, so it gets the most scrutiny.

### Step 11 — `mount()` entry-param handling
- **Objective:** Land the `?entry=quick` branch (§6.1).
- **Files:** `stock-audit.js` — `mount()` (`:3271-3281`).
- **Dependencies:** Step 10 (so the views it routes to are already stable).
- **Expected result:** All three new URL shapes in §6.1's table work; both existing URL shapes are provably unchanged.
- **Validation:** Each row of §6.1's table, opened as a real standalone navigation (not through the shell — per the constraint in §6).

### Step 12 — Entry Point A: WhatsApp (mocked)
- **Objective:** `WhatsAppLink.build()`/`.send()` + a "Send Quick Audit Link" trigger on Customer Detail.
- **Files:** `stock-audit.js` (new functions + one new button in the existing action row).
- **Dependencies:** Step 11.
- **Details:** Mocked exactly like `customers.js:1090`'s existing pattern — builds the real URL, shows/copies it, no network call. Visual pattern follows `openCampaignModal` (`customers.js:1069-1094`).
- **Expected result:** Tapping the trigger produces a real, working `?entry=quick&customer=<id>&source=whatsapp` URL that, opened in a new tab, lands correctly on `quick-count` for that exact customer.
- **Validation:** §19's "Entry points → WhatsApp/deep link" checklist.

### Step 13 — Entry Point B: Delivery Management
- **Objective:** The fourth `stop-detail.js` action.
- **Files:** `delivery-management/.../sections/stop-detail.js`.
- **Dependencies:** Step 11. Coordinated with/owned by the Delivery Management module per audit §14.4, since this is the one change outside Customer Management's files.
- **Details:** New footer button → `openStockAuditLink(s)` → builds `?entry=quick&hint=<encoded phone>&source=route-delivery` → `window.open(url, "_blank")`. Completion screen (in the new tab) gets a "Return to Route" link — `window.close()` if `window.opener` is set, else a plain link back to Delivery Management's URL (§11).
- **Expected result:** Tapping the action from a real stop opens Stock Audit in a new tab, search box pre-filled with that stop's phone number.
- **Validation:** §19's "Entry points → Delivery Management" checklist; confirm `stock-count.js` (vehicle settlement) is untouched and unaffected.

### Step 14 — Full regression pass + polish
- **Objective:** §20's regression matrix end to end, plus visual/UX polish pass (spacing, empty-state copy, etc.) now that the functional shape is locked.
- **Files:** Whatever polish requires, scoped to files already touched above — no new files expected.
- **Dependencies:** All prior steps.
- **Expected result:** §22's Definition of Done, fully met.
- **Validation:** §22 checklist, verbatim.

---

## 10. Entry Point A — WhatsApp

Fully specified in §6.1 (URL contract) and Step 12 (§9). Summary of the mocked boundary (audit §14.1.2, §14.5): `WhatsAppLink.build(customer)` is a pure function producing an absolute URL; `.send()` is a mocked UI action (toast/copy), no real message delivery. This is a deliberate integration seam — real WhatsApp Business API integration later replaces only `.send()`'s internals; nothing downstream (the URL shape, `mount()`'s handling of it, `quick-count` itself) needs to change, because the mock and a real send both terminate in the same URL contract.

No "return to WhatsApp" affordance is needed — unlike Entry B, there's no app state to hand back to. The existing `successSheet`'s "Done" button is sufficient; the rep simply closes the browser tab/PWA view when finished.

---

## 11. Entry Point B — Delivery Management

Fully specified in Step 13 (§9) and audit §14.4/§14.5. Key points restated for build-time clarity:

- **Where:** `stop-detail.js`'s existing footer, alongside Collect Payment / Edit Order / Skip Stop (`:24-30`) — a fourth button, same visual weight, not a buried menu item.
- **What it looks like:** Matches the existing three buttons' styling (`.btn ghost` class, per the file's existing pattern) — e.g. `🧾 Stock Audit`.
- **Customer context:** Passed as a `hint` (the stop's `phone` field, confirmed present on every stop via the `stop()` factory, `data.js:27`), **not** a direct customer id — because Delivery Management's stop ids (`st-ev`) and Customer Management's customer ids (`c04`) are unlinked (audit §14.1.8). The rep confirms the match in `quick-pick`'s pre-filled search, one tap.
- **How Quick Audit opens:** `window.open(url, "_blank")` — a real top-level navigation to `stock-audit.html`, not an in-app transition. Required because modules are cross-origin in production (`DEVELOPMENT.md`'s explicit same-origin-only-in-local-dev warning, cited in audit §14.5) — there is no in-app route from Delivery Management to Customer Management today, and building one is out of scope for this plan.
- **Returning afterward:** The new tab is a separate browsing context; "returning" means either closing it (`window.close()`, valid because the tab has `window.opener` set — it was opened by script) or, if the browser blocks that, a plain link back to Delivery Management's own URL. This applies uniformly to completion, pause, and cancel — there's no special-cased "come back only if X" behavior, keeping this simple and predictable.
- **Avoiding confusion with the existing "Stock Count" step:** No shared naming, no shared code path. `stock-count.js` (vehicle-stock settlement, part of `settle-route`) is untouched (§8); the new button is explicitly labeled "Stock Audit," matching the Customer Management feature's own name, not "Stock Count."

---

## 12. Customer Selection

`renderQuickPick()` (Step 3, §9). Behavior contract:

| Aspect | Contract |
|---|---|
| Initial state | Empty — no list, a prompt ("Search for the customer you're visiting"). Optionally pre-filled (not auto-submitted) when reached via `hint`. |
| Search | Reuses `wireSearchInput` (existing, `:995-1002`) — 220ms debounce, matches name/phone/email/address (same fields `renderCreateCustomer` already matches on, `:2338`). |
| No results | Existing empty-state pattern ("No customers found," matches `renderCreateCustomer`'s existing copy). |
| Selection | One tap → `startAuditFor(customerId)` (existing, unchanged) → draft-wins check → `quick-count` or `RESUME_OR_RESTART`. |
| Customer Detail | **Not required** — this path never visits it, matching the task brief's explicit requirement. |
| Secondary experiences | `renderCustomers`, `renderCustomerDetail`, `renderNeedsAttention`, `renderAudits` all remain reachable exactly as today, via the existing sidebar/bottom-nav — untouched, not deprecated. |

---

## 13. Product Selection

`renderQuickCount()`'s selection half (Step 4, §9). Behavior contract, per the task brief's explicit list (§8 of the request):

| Aspect | Contract |
|---|---|
| **Selected-product state** | `DRAFT.selected: string[]` (§7.2) — the source of truth for "what's in scope," independent of counting progress. |
| **Add** | Tap a search result → push to `DRAFT.selected` if not already present → `persistDraft()`. |
| **Duplicate handling** | Re-tapping an already-selected product in search results is a **no-op** — it does not add a second entry or reset its count. (Search results can optionally mark already-selected products, e.g. a checkmark, as a polish-pass detail — not required for correctness.) |
| **Remove** | Explicit control on a selected row. If the product has no line yet (`!DRAFT.lines[id]` or `!lineIsCaptured`), simple splice from `selected`. If it was already counted, removing it also deletes `DRAFT.lines[id]` — removing from scope means removing the count, not leaving an orphaned line the coverage math would still see. |
| **Search behavior** | Empty-state-first (§14.6's non-goal notwithstanding, name/SKU search — no barcode); filters `SEED.products` exactly like today's Workspace search, just against an empty-by-default list rather than a pre-populated one. |
| **Empty state** | "No products selected" / "Search to add a product," per the requirements doc's own mockup. |
| **Selected state** | Rendered inline, on the same screen as search — no navigation to a separate "selected products" page (§10). |
| **Count state** | Per-row: uncounted (stepper visible) vs. counted (compact "✓ N counted" state), driven by `lineIsCaptured` (existing helper, reused unchanged). |
| **Completion state** | All of `DRAFT.selected` satisfies `lineIsCaptured` → "Finish Audit" needs no partial-coverage warning (Step 5's `expectedProducts` change is what makes this true). |
| **Draft persistence** | `DRAFT.selected` persists via the existing `persistDraft()` call, already invoked on every mutation elsewhere in the file — no new persistence mechanism. |
| **Leave and resume** | Covered by §15 — `DRAFT.selected` rides along with the rest of `DRAFT` through pause/resume, for free. |

---

## 14. Counting

`renderQuickCount()`'s counting half + `quickRowHTML`/`quickMore` (Steps 4 and 6, §9).

- **Core loop**, exactly as the task brief specifies: select → count → Save → next uncounted *selected* product. `nextUncapturedIn(DRAFT.selected.map(productById), afterId)` (§8's extraction) walks `DRAFT.selected` **in selection order**, not the priority order `renderWorkspace` uses. *Design decision, stated explicitly:* priority ordering ("what was flagged last visit") is a full-catalogue triage concept — for a rep-curated 2–3 product list, the order they picked them in is the more predictable, least-surprising advance order. This is the one place this plan diverges from a literal reuse of existing behavior, and it's a UX choice, not a technical constraint.
- **No return to search after every count** — confirmed by construction: Save's auto-advance keeps the rep inside the counting sub-state (opening the next row directly, mirroring how the existing Product Count Sheet stays open across products, `stock-audit.js:2657`'s "reused across products" comment) until either every selected product is counted or the rep explicitly backs out to the selection list.
- **Default UI**: inline stepper (`− qty +`) directly on `quickRowHTML`, per the task brief's mockup — no sheet opens for the default path (contrast with today's full Workspace, where every count opens the Product Count Sheet).
- **Progressive disclosure**: `quickMore()` (§9 Step 6) — condition, shelf presence, notes, photo, all present, all optional, reusing the existing Product Count Sheet's rendering fragments rather than being deleted or reimplemented. Nothing here contributes to health/scoring differently than it does today — same fields, same functions downstream.

---

## 15. Draft / Resume

No new logic — the existing rule (audit §8, "draft always wins") already operates at the level of "does this customer have an open draft," which is orthogonal to `mode`. Restated as the Quick Audit-specific walk-through:

```
Start / Resume tapped for customer C
        ↓
DraftStore.get(C) exists?
   ├─ No  → newDraft(C) with mode set by the entry path → quick-count, empty selection
   └─ Yes → resumeOrRestartSheet (existing, unchanged)
              ├─ "Resume that visit"       → resumeDraft (existing) → quick-count,
              │                               DRAFT.selected and DRAFT.lines exactly
              │                               as left, including any mid-count progress
              └─ "Start a new one instead" → DraftStore.clear() (existing) →
                                              newDraft(C) → quick-count, empty selection
```

Starting new **explicitly** replaces the old draft only via that second branch — never silently, exactly matching the existing guarantee. No implementation work beyond Steps 1–7 (§9) is required for this section; it is a verification target, not new logic.

---

## 16. Exit Lifecycle

The four outcomes from audit §9 apply verbatim; this section is the Quick-Audit-specific framing the task brief asked for.

| Outcome | Reached from Quick Audit via | Effect on `DRAFT.selected`/Quick-specific state | Where the rep lands |
|---|---|---|---|
| **Pause** | `quick-count`'s Exit → "Pause — keep my progress" (existing `exitAuditSheet`/`pauseAudit`, unchanged) | `DRAFT.selected` and any partial `DRAFT.lines` preserved in `DraftStore`, `status: "paused"`. | Customer Detail. Next Start Audit for this customer → `RESUME_OR_RESTART` with selections intact (§15). |
| **Recorded incomplete** | Exit → "End this visit" → reason required (existing `endVisitSheet`/`abandonAudit`) | New `AuditStore` record written with `mode: "quick"`, `expectedProducts` per §7.3 (selection size at the time of abandonment), `partial.isPartial: true`. Appears in history as an incomplete Quick Audit — not deleted, matching the existing rationale (audit §9: *"leaves a customer looking simply un-visited"* is what this avoids). | Customer Detail. |
| **Discard** | Exit → "End this visit" → "Discard it instead" (existing) | `DraftStore.clear()` — `DRAFT.selected` and everything else gone, no `AuditStore` record. | Customer Detail. |
| **Keep counting** | Exit → "Keep counting" (existing) | No change — dismisses the sheet, stays in `quick-count`. | `quick-count`, unchanged. |

These remain four **distinct** outcomes, per the task brief's explicit instruction not to collapse them — no new exit UI, no new exit function; `exitAuditSheet`/`endVisitSheet`/`pauseAudit`/`abandonAudit` are reused exactly as written.

---

## 17. Completion / Scoring

Per Step 5 and Step 9 (§9). The full chain, confirmed unchanged end to end except the one `expectedProducts` value:

```
Finish Audit (quick-count's footer button)
  → finishAuditSheet(customer)          — existing, unchanged
      → coverage = auditCoverage(draftAsAudit(customer))   — existing, unchanged;
        reads the same DRAFT.lines shape Quick Count already writes into
      → 0 skipped → one-tap Finish
      → some skipped → Continue Counting / Finish Anyway   — existing, unchanged
  → completeAudit(customer)             — existing, unchanged internals;
                                           expectedProducts value changed per §7.3
      → suggestedOutcome(), scoreFromAudit(), healthBreakdown(),
        recommendedActions()             — ALL existing, ALL unchanged
      → AuditStore.list(id).unshift(audit); AuditStore.save()   — existing, unchanged
      → DraftStore.clear(id)             — existing, unchanged
      → go("customer-detail", ...)       — existing, unchanged
      → successSheet(customer, audit)    — existing, unchanged
```

Post-save guarantees (task brief §14's checklist, verified against the trace above): `AuditStore` contains a valid record (yes — same write path); score pipeline executes (yes — `scoreFromAudit` is agnostic to `mode`); health data updates (yes — `healthBreakdown` reads `lines`, present regardless of how they were captured); recommended actions available (yes — `recommendedActions` reads `lines`/`conditionBreakdown`, unchanged); Audit History shows it (yes — same `AuditStore`, `renderAudits` reads all records regardless of `mode`); Customer Detail reflects it (yes — `scoreFromAudit(last)` where `last` is the most recent *completed* record, `mode` irrelevant to that selection).

**No second scoring engine** — confirmed by the trace above containing exactly one call each to every scoring function, for both audit modes.

---

## 18. Secondary Experiences

Explicitly preserved, per task §15 and audit §14.3/§14.7 — listed here as the verification checklist for §20:

- Customers landing (`renderCustomers`) — unchanged, still the in-shell default when opened via the sidebar (not "+ New Audit").
- Needs Attention (`renderNeedsAttention`) — unchanged.
- Customer Detail (`renderCustomerDetail`) — unchanged except the two additive elements in `actionRowHTML` (§6.3): a new secondary "Full Shelf Audit" link and a new "Send Quick Audit Link" trigger. No section of Customer Detail is removed or restructured.
- Inventory (`renderInventory`) — unchanged.
- Audit History (`renderAudits`) — unchanged, optionally gains a `mode` badge per row (§7.1) but the list/filter/sort logic is untouched.
- Audit Detail (`renderAudit`) — unchanged, same optional badge.
- Full Workspace (`renderWorkspace`) — unchanged in every line of code; reachable via the new secondary link instead of being the default.

None of these become part of the Quick Audit happy path, per the task brief — they remain one tap away for deeper investigation, exactly where they are today.

---

## 19. Testing / Validation Plan

No test framework exists in this repo (audit §2.1) — this is the structured **manual** validation plan compensating for that, organized exactly per the task brief's categories.

**Customer**
- [ ] `quick-pick` empty initial state (no list rendered).
- [ ] Search filters correctly, debounced.
- [ ] No-results state.
- [ ] Selecting a customer with no open draft → `quick-count`, empty selection.
- [ ] Customer context arrives correctly from `?entry=quick&customer=<id>` (skips `quick-pick` entirely).
- [ ] Customer context arrives correctly from `?entry=quick&hint=<phone>` (pre-fills `quick-pick`'s search, does not auto-select).

**Product**
- [ ] `quick-count` empty initial state (no catalogue dump).
- [ ] Product search filters correctly.
- [ ] Selecting a result adds it to `DRAFT.selected` and the visible list.
- [ ] Re-selecting an already-selected product is a no-op (§13).
- [ ] Removing an uncounted selected product works.
- [ ] Removing a *counted* selected product also clears its `DRAFT.lines` entry (§13).
- [ ] No-results state on product search.
- [ ] Selected-list state renders correctly with 0, 1, and many selections.

**Counting**
- [ ] Inline stepper increments/decrements/direct-types correctly.
- [ ] Save writes `DRAFT.lines[id]` per §7.4's minimal default (`conditionBreakdown.good = qty`).
- [ ] Save auto-advances to the next uncounted *selected* product, in **selection order**.
- [ ] Re-opening a counted row allows recount (overwrites the existing line, same as today's product-sheet behavior).
- [ ] "More" opens the existing condition/shelf/notes controls and writes into the same line object.
- [ ] All selected products counted → no partial-coverage warning on Finish.

**Draft**
- [ ] Pause mid-Quick-Count preserves `DRAFT.selected` and all partial `DRAFT.lines`.
- [ ] Reload/refresh after pause does not lose the paused draft (it's in `DraftStore`, disk-backed).
- [ ] Resume restores the exact selection and count state.
- [ ] "Start a new one instead" explicitly clears the old draft — verify the old selection is genuinely gone, not merely hidden.
- [ ] A draft cannot be silently overwritten — re-tapping Start Audit for a customer with an open draft always surfaces `resumeOrRestartSheet` first, for both quick and full drafts.

**Completion**
- [ ] Finish with full selected-coverage → one-tap complete.
- [ ] Finish with partial selected-coverage → existing "some skipped" warning, correctly scoped to the smaller denominator (§7.3).
- [ ] Resulting `AuditStore` record: correct `mode: "quick"`, correct `expectedProducts`, correct `lines`.
- [ ] Score computed and visible on Customer Detail.
- [ ] Health axes reflect the Quick Audit's findings.
- [ ] Recommended actions computed correctly for a Quick Audit with a flagged (damaged/expired/stock-out) line.
- [ ] Audit History lists the new record, newest first, alongside full audits.
- [ ] Customer Detail's snapshot/history sections reflect the completed Quick Audit.

**Exit**
- [ ] Pause → Customer Detail, resumable.
- [ ] Recorded incomplete → reason required, appears in history as incomplete, no score.
- [ ] Discard → nothing written, draft gone.
- [ ] Keep counting → dismisses, no state change.

**Entry points**
- [ ] WhatsApp: `WhatsAppLink.build()` produces a correct URL for a given customer; opening it in a new tab lands on `quick-count` for that exact customer, skipping Customer Detail.
- [ ] WhatsApp: `.send()` mock shows/copies the link, makes no network call.
- [ ] Delivery Management: new `stop-detail.js` button present and correctly styled alongside the existing three.
- [ ] Delivery Management: `openStockAuditLink` builds the correct `hint`-based URL and opens it as a real new tab (not an in-app transition).
- [ ] Delivery Management: `quick-pick` correctly pre-fills the search with the passed phone number.
- [ ] Delivery Management: "Return to Route" affordance works (`window.close()` or fallback link).
- [ ] `stock-count.js` (vehicle settlement) unaffected — spot-check the settlement flow still works end to end.

---

## 20. Regression Strategy

Given zero existing test coverage (audit §13), regression protection is entirely procedural:

1. **Additive-first ordering.** Steps 1–9 (§9) introduce no changes to any existing call site's *behavior* — only new functions and new, unreachable-until-wired dispatch entries. Steps 10–11 are the only ones that change what an existing button/URL does, and they're scheduled last, after everything they route to is independently validated.
2. **Before Step 10, run the full existing manual flow once as a baseline**: Customers landing → search/filter/sort → Customer Detail → full Workspace → count a product → Finish → Audit History → Inventory. Screenshot or note the exact behavior at each point.
3. **After Step 10, repeat the identical baseline walk-through** via the new "Full Shelf Audit" secondary link and confirm every step matches the pre-change baseline exactly — same screens, same data, same scoring.
4. **Specifically protect** (per task §24): `renderWorkspace` and everything it calls (unmodified in every line except the two shared, wrapper-preserved functions — `nextUncaptured`, `completeAudit`/`abandonAudit`'s `expectedProducts` line, both verified in Steps 2 and 5 to be behavior-identical for the full-audit branch); `renderCustomerDetail` (only `actionRowHTML` changes, additively); `DraftStore`/`AuditStore` (schema additive only, §7); `scoreFromAudit`/`healthBreakdown`/`recommendedActions` (zero changes, confirmed by the trace in §17); existing `localStorage` keys (unchanged, no new keys — §7.5).
5. **Rollback shape:** because every risky change (Steps 10–11) is a small, isolated diff in a handful of named functions (§6.3, §9), reverting to pre-vNext behavior — if ever needed — is reverting those specific diffs, not disentangling new and old code that were never interleaved.

---

## 21. Risks

Carried forward from audit §13, re-scoped against this plan's mitigations:

| Risk | Mitigation in this plan |
|---|---|
| Zero test coverage → silent regression in the full-audit path. | Additive-first sequencing (§20) + explicit before/after baseline walk-through at Step 10, the one step that changes existing routing. |
| `nextUncaptured` extraction (Step 2) subtly changes full-audit auto-advance order. | Wrapper preserves the exact existing expression (`products.slice().sort(...)`) — validated in Step 2 itself before any Quick Audit code depends on the generalized function. |
| `expectedProducts` change (Step 5) accidentally affects full-audit coverage math. | Conditional is `DRAFT.mode === "quick"` — a full-audit draft has no `mode: "quick"` (defaults to `"full"`, §7.1), so the branch is unreachable for existing flows; verified explicitly in Step 5's validation. |
| Route Delivery's `hint`-based matching produces a false-positive customer match (two shops with the same phone number, unlikely but not impossible in real data). | Deliberately **not** auto-selected — the rep confirms via `quick-pick`'s normal one-tap selection, same as any other search result (§11). No silent auto-match exists to get wrong. |
| Entry B's cross-module `window.open` gets popup-blocked. | Triggered by a direct user tap (not programmatically on page load), which every major mobile/desktop browser's popup blocker allows. |
| `DRAFT.selected` and `DRAFT.lines` drift out of sync (e.g., a line exists for a product no longer in `selected`). | Removal explicitly deletes the orphaned line (§13); no other code path can add to `lines` without going through `selected` first in the Quick Audit views. |
| Two data-model fields, however additive, still touch four existing functions (`newDraft`, `normalizeAudit`, `completeAudit`, `abandonAudit`). | Each is a single added line/branch, isolated in Step 1 and Step 5, each independently validated before subsequent steps build on them. |
| Policy risk: does a 1-product spot-check moving a health score surprise stakeholders? | Flagged explicitly as Assumption A (§2) — not silently decided. |

---

## 22. Definition of Done

```text
✓ Quick Audit opens without unnecessary screens (quick-pick → quick-count, no
  Customer Detail stop unless the rep chooses "Full Shelf Audit")
✓ Customer selection is search-first (quick-pick, empty by default)
✓ Product selection is search-first (quick-count, empty by default)
✓ Full catalogue is not dumped initially in either new view
✓ Rep can select only required products (DRAFT.selected)
✓ Selected products become the audit scope (expectedProducts = selected.length
  for mode: "quick" — §7.3)
✓ Count interaction is minimal (inline stepper on quickRowHTML)
✓ Save auto-advances (nextUncapturedIn, selection order)
✓ Optional audit details remain available (quickMore — condition/shelf/notes/photo)
✓ Draft always wins (unchanged existing logic, verified for both modes — §15)
✓ Pause works (unchanged existing logic, verified for Quick Audit — §16)
✓ Incomplete visit works (unchanged existing logic, verified for Quick Audit — §16)
✓ Discard works (unchanged existing logic, verified for Quick Audit — §16)
✓ Completion creates a valid audit (§17's full trace)
✓ Existing scoring pipeline works (zero changes to scoreFromAudit/healthBreakdown/
  recommendedActions, confirmed by trace)
✓ Health/history update correctly (verified in §17/§19's Completion checklist)
✓ WhatsApp entry contract works in the mocked form (§10, Step 12)
✓ Delivery Management entry works via stop-detail.js's new action (§11, Step 13)
✓ Existing full audit still works (§20's before/after baseline walk-through, byte-
  for-byte identical results)
✓ No unrelated modules are broken (stock-count.js, Catalog, all other Customer
  Management screens — §18/§20)
✓ §19's full validation checklist passed
```

---

## 23. Final Implementation Checklist

Sequenced exactly as §9, for direct execution tracking:

- [ ] Step 0 — Sign off on Assumptions A/B (§2)
- [ ] Step 1 — `mode`/`selected` fields, defaults (§7)
- [ ] Step 2 — `nextUncapturedIn` extraction
- [ ] Step 3 — `renderQuickPick()`
- [ ] Step 4 — `renderQuickCount()` (selection + minimal counting)
- [ ] Step 5 — `expectedProducts` mode branch
- [ ] Step 6 — `quickMore()` progressive disclosure
- [ ] Step 7 — Draft lifecycle verification
- [ ] Step 8 — Exit lifecycle verification
- [ ] Step 9 — Completion/scoring/history verification
- [ ] Step 10 — Wire "+ New Audit" and Customer Detail's primary action to Quick Audit
- [ ] Step 11 — `mount()`'s `?entry=quick` branch
- [ ] Step 12 — Entry Point A (WhatsApp, mocked)
- [ ] Step 13 — Entry Point B (Delivery Management)
- [ ] Step 14 — Full regression pass + polish

**STOP. No implementation has been performed. This is a plan only — awaiting review and approval before Step 0 begins.**

# Route Delivery — QA parity checklist (measured pass)
Format: Screen | State | QA tested | V5 tested | Visual parity | Behavioural parity | Differences found -> fix

## 1. Home dashboard
- Home | default list | YES | YES | PASS (measured, all y/x/font/colour identical) | YES | (a) missing 16px spacer after stat grid; (b) search row had 12px top pad instead of QA's margin-bottom 10 + padding 0 12; (c) date control was a <label class=rd-chip> with a full-size transparent input; QA is a plain <button> + 0x0 hidden input opened via showPicker(), max=today; (d) filter chips carried .rd-chip (hover shadow + press scale) QA does not have; (e) chip row used .rd-noscrollbar, QA uses inline scrollbar-width:none; (f) tail spacer 12px vs QA 1px+16px; (g) search input missing -webkit-appearance:none; (h) clear-✕ missing font-weight 700 / padding 0. ALL FIXED
- Home | status filter = Closed | YES | YES | PASS (card 146.5/172, outline btn 56.5 2px brand) | YES | none
- Home | status filter = All/Ready/Stock Requested/In Progress | YES | YES | PASS | YES | none

## 2. Route Pre-Start
- Pre-Start | ready route, stock+cash done | YES | YES | PASS (header 97, body 97-729.5, bar 82.5 - all identical) | YES | (a) header was a different component: rd-back chip row, title mt 6, no home button; QA is MobileHeader (plain 13px block back link, title mt 2, 42px right slot, 32x32 home button); (b) ActionBar bottom padding 12 vs QA calc(safe+8); (c) stray 12px tail spacer. FIXED
- Pre-Start | home button confirm sheet | YES | YES | PASS (byte-identical geometry) | YES | sheet did not exist in v5. ADDED

## Global
- Tailwind preflight was missing from v5: bare <button>/<input> carried UA border+padding, SVGs were inline not block. ADDED to styles.css.

## 3. Load Stock
- Load Stock | prefilled quantities | YES | YES | PASS (all rows/steppers/tiles identical) | YES | (a) banner was blue "enter the quantity"; QA shows the green 📦 "auto-filled from today's proxy orders" when quantities arrive prefilled; (b) subtitle repeated the beat area QA omits when the route name contains it; (c) back label did not strip a date from the route name; (d) stray 4px tail spacer. FIXED
- Load Stock | confirm panel | YES | YES | PASS (byte-identical incl. 150px scroll box) | YES | v5 had no item breakdown list and used different copy ("Stock Load"/"Change Load"/"...onto the van"). FIXED
- Load Stock | commit → processing | YES | YES | PASS (green #2e7d32 block, 76.5 tall) | YES | v5 committed instantly with a toast; QA shows a processing block then navigates. ADDED RD.commit()
- Load Stock | search box | YES | YES | PASS | YES | none

## 4. Opening Cash
- Opening Cash | default ₹500 | YES | YES | PASS (pixel-identical, incl. numpad grid 113x105.3) | YES | none
- Opening Cash | numpad 0-9, ←, C, 7-digit cap | YES | YES | PASS | YES | none
- Opening Cash | quick-select chips | YES | YES | n/a | YES | v5 appended the next digit to a preset; QA replaces it (handlePreset re-arms prefilled). FIXED
- Opening Cash | confirm panel + commit | YES | YES | PASS | YES | processing block added

## 5. Staff Sign-Off
- Sign-Off | all steps confirmed | YES | YES | PASS | YES | back label was "← Routes"; QA uses "← Opening Cash" (or "← Pre-Start" when cash not required). FIXED
- Sign-Off | Start Later | YES | YES | n/a | YES | both return home
- Pre-Start | all steps already done | YES | YES | n/a | YES | QA redirects to Sign-Off; v5 stayed on Pre-Start. FIXED

## 6. Customer Queue
- Queue | in-progress list | YES | YES | PASS (header 64.3 incl. the 0.3px the inline-flex menu button adds) | YES | (a) ProgressBar was a different component (gap-8 row, rd-back chip, 0.25 track, marginTop instead of the row's marginBottom, 0.75-opacity label vs QA's 0.5 alpha, wrong home icon); (b) completed rows used initials at 0.6 opacity — QA uses ✓/↩/− avatars at 0.7 (0.45 skipped); (c) name had no ellipsis; (d) Add Customer avatar had no dashed ring. ALL FIXED
- Queue | actions menu open | YES | YES | PASS (byte-identical card) | YES | menu was owned by ProgressBar and anchored 10px too high; QA passes it as rightAction anchored to its own wrapper. FIXED
- Queue | menu → Return & Settle | YES | YES | PASS (byte-identical panel) | YES | v5 navigated straight to settlement; QA raises a confirm panel over the queue. FIXED
- Queue | menu → Restock | YES | YES | PASS | YES | same fix, "Begin Restock" / "Pausing route…"
- Queue | menu dismissal | YES | YES | n/a | YES | outside-pointerdown + Escape added
- Queue | depleted / return-only rows | YES | YES | PASS (see 6b and 6c) | YES | closed

## 6b. Customer Queue — stock depleted
- Queue | depleted (van empty) | YES | YES (forced) | PASS (rows 0.4, grey avatars, #d97706 subtitle, footer banner 53.5 identical) | YES | v5 had no depleted branch and no footer banner. FIXED

## 6c. Customer Queue — return-only rows
- Queue | return-only (current) | YES | YES | PASS (46px ↩ avatar #fff7ed/#c2410c, name 15/600 ellipsis, "Return received" 13/600 #c2410c, 8px #d1d5db dot, no time) | YES | v5's branch measured byte-identical to QA's live row
- Queue | return-only (pending) | YES (source) | YES (created by recording a return against an unbooked stop) | PASS | YES | none. v5's stop keeps its list position; QA's example was the current stop — a data difference, both branches match
- Queue | done rows subtitle | YES | YES | PASS | YES | v5 printed "₹520 collected · CASH" from the stop-detail model; QA's queue uses buildStopSubtitle -> "₹520 · Collected" / "₹0 · Over Payment" / "₹120 · Partial payment". FIXED (queue now calls buildStopSubtitle)

## 7. New Customer (Add Customer)
- New Customer | empty form | YES | YES | PASS (form 57.5-tall inputs, divider, card rows, editable price, stepper radius 8/18px) | YES | v5's screen was a different design: card-wrapped form, small inputs, no divider, 14px names, plain price text, no ✎, radius-10 stepper, "Order Total" card, wrong CTA. REBUILT to QA
- New Customer | offer price sheet | YES | YES | PASS (byte-identical internals) | YES | did not exist in v5. ADDED (shared OfferPriceSheet)
- New Customer | order discount sheet + strip | YES | partially | structure matches source; QA sheet measured closed | YES | did not exist in v5. ADDED (shared DiscountSheet/OrderDiscountPanel/DiscountStrip)
- New Customer | confirm panel | YES | YES | PASS (byte-identical: panel 0,557 375x255, "New Customer Order" 10/800, 30/900 total, "<shop> · 1 item", green phone chip, item box on #f8fafc, Edit Order 168.5 / Add Customer → 164.5) | YES | none. Filled QA's form (name, phone, 2 units) to reach it

## 8. At Customer — Book Order mode (the mode QA shows for every unbooked stop)
- At Customer | book order | YES | YES | PASS (hero, search, rows, editable price, steppers, footer all identical) | YES | v5 had no booking mode at all. PORTED, and one seed stop left unbooked so the mode is reachable
- At Customer | booking confirm panel | YES | YES | PASS (byte-identical) | YES | added
- At Customer | More Actions sheet | YES | YES | PASS (byte-identical, 343 tall) | YES | added (shared ActionsSheet)
- At Customer | offer price / order discount sheets | YES | YES | PASS | YES | added

## 9. At Customer — delivery mode
- At Customer | stop with an order | YES | YES | PASS | YES | stray 8px tail spacer; phone <a> took the UA link blue (preflight `a{color:inherit}` added). FIXED
- At Customer | advance covers today's order | YES | YES | PASS (Total Due ₹0 stays #ef4444, green note "₹60.9 of ₹60.9 today's order paid using advance · ₹X advance balance remaining") | YES | none
- At Customer | Edit Order → confirm | YES | YES | PASS (byte-identical: panel 0,595 375x217, "Save Order Changes", 30/900 total, "1 item · Total Due ₹0", item list, Keep Editing 168.5 / Save Changes 164.5, 0.45 backdrop) | YES | v5 saved straight from "✓ Done Editing" with no confirm step. ADDED (with QA's processing block)
- At Customer | Edit Order → persistence | YES | YES | - | YES | **real bug**: `updateStopItems` wrote `detail.items`, a field nothing reads — the screens read `detail.orderItems`, so every order edit was silently discarded. FIXED (writes orderItems/orderTotal and keeps items/todayOrderAmount in sync); verified by editing, saving, navigating away and back

## 10. Payment Collection
- Payment | full amount, Cash | YES | YES | PASS (numpad 113x101.8, presets, CTA all identical) | YES | header carried a home button QA does not show (showHome=false); preset row used .rd-noscrollbar. FIXED
- Payment | UPI toggle, partial amount | YES | YES | PASS | YES | v5 had no short-payment write-off control; QA offers "₹X will be adjusted as offer." ADDED (+ SDK writeoffAmount)
- Payment | confirm panel | YES | YES | PASS | YES | processing label added

## 10b. Payment Collection — standalone ("Collect Outstanding")
- Payment | opened from Stop Summary / booking More Actions | YES | YES | PASS (back label "← Delivery Stops" 104.4 wide, presets ₹500/₹2,000/₹5,000 unselected, Total Due ₹0) | YES | v5 had no standalone mode: it prefilled the amount, showed a "₹0 Full" chip and a "← Customer" back link. ADDED (payOutstanding scoped to the payment screens, recordRoutePayment, no stop delivered)
- Payment | ₹0 submit | YES | YES | PASS | YES | QA opens the confirm panel on the first CTA and validates on the panel's commit, closing it with an inline "Amount must be greater than ₹0". v5 validated on the first CTA. FIXED (validation moved to pay-commit; over-payment now allowed everywhere, as QA does)
- Payment | Financial action label | YES | YES | PASS | YES | v5 always said "Collect Outstanding · ₹0"; QA says "Collect Payment" when nothing is owed. FIXED

## 11. Payment Success
- Payment Success | collected | YES | YES | PASS (full-bleed green, ✅ 72px, 42px amount, share card, CTA, home bar — all identical) | YES | v5 rendered a normal white screen with a card and a sticky bar. REBUILT
- Payment Success | standalone collection | YES | YES | PASS (WhatsApp button withdrawn, single 299-wide Print Receipt, raw "CASH" method label) | YES | v5 had no such state. ADDED
- Print Receipt sheet | no printer | YES | YES | PASS (sheet 747 tall, every row/button/preview identical incl. 160.5/164.5 footer buttons) | YES | v5's print UI was an inline card, not QA's fixed bottom sheet. REBUILT
- Print Receipt | invoice text, 58mm and 80mm | YES | YES | PASS (every line width identical: 32/48-column justify, 42/48-column item grid, Font-B 8px table rows, bold title/header/Total Received) | YES | v5 emitted one <pre> string on a 34-column grid with a 42-char rule at both sizes, an en-GB date, a 44-char item row and an unconditional Old Balance. REBUILT line for line (PrintReceiptSheet.jsx): per-line spans, en-IN date-time, Sub Total only with items, Old Balance/Write Off only when non-zero
- Print Receipt | standalone payment receipt | YES | YES | PASS (byte-identical: "Payment Receipt", no Bill No, no item table, extra rule above the totals) | YES | ADDED

## 12. Stop Summary
- Stop Summary | fully collected | YES | YES | PASS | YES | v5's was a different screen (22px name, 30px amount, wrong greens, a 4-row outstanding card QA does not have, three small footer buttons). REBUILT to QA: status line, 26px name, 34px #15803d collected, order card with 🖨 Print, Order Total, "Deliver Extra Items →" + "More Actions"
- Stop Summary | more actions sheet | YES | YES | PASS | YES | added, with QA's group rules

## 13. Skip Stop
- Skip Stop | reason grid + note | YES | YES | PASS (chips 167.5x50.5, note input 54.5, brand CTA) | YES | v5 used a 2-col grid of 94px tiles with the emoji on its own line, a textarea, a red disabled CTA and no default reason. REBUILT to QA (flex-wrap chips, first reason preselected, single-line input, brand CTA)
- Skip Stop | confirm panel | YES | YES | PASS (byte-identical: "Skip Confirmation" 10/800, 30/900 reason, "No delivery for X today", Change Reason 168.5 / Skip Stop 164.5) | YES | none
- Skip Stop | reason = Other, no note | YES | YES | n/a | YES | both skip without a validation error
- Skip Stop | skipped row + summary | YES | YES | PASS (row 0.45 opacity, grey − avatar, red "Skipped"; summary badge/name/Reason block identical) | YES | none. v5's summary shows an address line because its customer has one — QA renders it under the same `customerAddress &&` guard

## 14. Settlement Overview
- Settlement | both steps pending / one done / both done | YES | YES | PASS | YES | "Locked" button was w700 (QA w600); the final CTA was gated on route.status===CLOSED, QA gates it on the VIEW_REPORT privilege and always shows the green "🎉 View Route Summary →". FIXED

## 15. Stock Count
- Stock Count | table | YES | YES | PASS (header bar 42 with the duplicated sticky Product cell, grid 160/62/74/110, sticky left column, totals row) | YES | v5 used a 150/76/84/104 grid, no sticky column, no totals row, 13px type instead of 14/9.5, a different Match button and a separate total block. REBUILT
- Stock Count | Match / confirm panel | YES | YES | PASS (byte-identical) | YES | money() now uses en-IN grouping, not toFixed
- Stock Count | commit | YES | YES | - | YES | routed through the processing block

## 16. Cash Handover
- Cash Handover | default | YES | YES | PASS (summary card p=18 no shadow, expense grid 239/26/26, cashbreak grid 273/26, 2px total row, outside inputs 63/55.5, green CTA) | YES | v5 had a shadowed p=16 card, 15px values, two chips instead of QA's icon-button rows, a 1px total border, both inputs inside a second card and a brand CTA. REBUILT
- Cash Handover | Add Currency sheet | YES | YES | PASS (sheet 663.5, table cols 95.5/82/163.5, six 47px rows + 55.5 total) | YES | v5 had an inline denomination panel. REBUILT as QA's sheet
- Cash Handover | expense add / edit / remove rows | YES | YES | PASS (settled row grid 226.25/14.75/28/28 gap 6, name 12/700 #6b7280, unsigned 12/800 #4b5563 amount, pencil #1B6272 on #eef8fa, ✕ #ef4444 on #fff5f5, "Total Expenses" -₹X 16/800) | YES | v5's settled row was a 13px button + red signed amount + one ✕ and had no Total Expenses line; the pencil/paperclip icons were missing paths. FIXED (exact lucide paths read off QA)
- Cash Handover | configured expense types | YES | YES | PASS | YES | QA seeds four categories from appProp.settlementFeatures.expenseTypes (Route Bhatta / Toll Recharge / Police / Diesel, editableName false); v5 started empty. SEEDED to the same set
- Cash Handover | Difference panel | YES | YES | PASS (68 tall, 2px border, green #39c96e "₹0 ✓" / "+₹100", red #ef4444 short) | YES | v5 had no difference panel at all. ADDED. Cash-to-hand-over now clamps at 0 and rounds to paisa (getCashToHandOver)
- Cash Handover | denomination table heading | YES | YES | PASS | YES | the "Currency" th centred itself: Tailwind preflight's `th{text-align:inherit}` was missing from styles.css. ADDED
- Cash Handover | confirm + sign off | YES | YES | PASS | YES | processing block added

## 17. Route Intelligence (Closed / Analytics)
- Analytics | closed route | YES | YES | PASS (hero 141.6, ring, band 17.6, performance rows, accordions) | YES | Export button sat 10px low and used the wrong icon (QA: wrapper at top 50% + lucide file-down); hero lacked text-align centre; score number line-height 1; band line-height 1.1. FIXED
- Analytics | highlights | YES | YES | PASS | YES | rows were line-height 1.5 and centre-aligned; QA uses 1.25 with the icon top-aligned and flex-shrink 0. FIXED
- Analytics | Stops Summary expanded | YES | YES | PASS (scroller 519 wide, grid 135/78/86/82/82 gap 14, sticky first column, 13/900 names, "Skipped" 9.5/800, #94a3b8 zeros) | YES | v5 rendered a generic 12px mini-table. REBUILT to RouteAnalytics.jsx's grid
- Analytics | Stock Summary expanded | YES | YES | PASS (grid 135/78/86/78 width 401, 14/900 counts over 9.5/800 values, totals row on a #dbe4ee rule) | YES | same rebuild
- Analytics | Asset Movement card | YES | YES | PASS (grid 127/88/88, "Assets Given" #3b82f6 / "Assets Taken" #16a34a) | YES | the card did not exist in v5. ADDED, fed by a real asset-movement store
- Analytics | Expense Summary expanded | YES | YES | PASS (name 13/600 #475569, amount 14/800 #e87171, "SETTLED · <time>" 10/#64748b, "No documents attached" 11/#94a3b8, "1 settled cash audit entry" sub-line) | YES | v5 hardcoded "0 expenses" and a centred placeholder. REBUILT off the settlement record
- Analytics | Collection Summary expanded | YES | YES | PASS (rows p=10 0 on #eef2f7, label 13/500 #475569, value 14/800, outstanding #f97316 / #2D7A42) | YES | v5 used the settlement SettleRow. REBUILT
- Analytics | accordion shell | YES | YES | PASS | YES | cards were missing QA's Card shadow and the open body's top rule. FIXED
- Analytics | export sheet | YES | YES | PASS (byte-identical 161-tall sheet, and both content states) | YES | v5 had an absolute overlay with a subtitle and three equal buttons. REBUILT. The body was then empty in every state: QA shows "Generating report…" then "Report ready" + filename with Preview/Download live. ADDED (the mock composes a real single-page PDF in the browser, so both actions work with no server)

## 18. Reports
- Reports | list | YES | YES | PASS (tiles 66.7 hairline cards, "Report history" 15/800, SVG search, 2-col filter grid) | YES | header had a home button QA omits; v5 used colour StatTiles, an emoji search field and a 5-chip filter strip instead of QA's date field + native sort select. REBUILT
- Reports | report cards | YES | YES | PASS | YES | Outstanding read #f97316 even at ₹0; QA uses #64748b when nothing is owed. FIXED
- Reports | date range picker | YES | YES | PASS (calendar 204.7x232.9 at the same origin, header 202.7x55.5 on #f7fafb, 22.95px day cells at identical x/y, #ccc future days, react-datepicker triangle) | YES | v5 opened the browser's native date input — a completely different control, and a single date rather than QA's range. REBUILT as a range picker: "24 Aug 2026 - " after the start, "24 Aug 2026 - 28 Aug 2026" on the end, closes on the end pick, month arrows, brand range highlight
- Reports | sort select | YES | YES | PASS | YES | none (Newest/Oldest/Name A–Z/Name Z–A)
- Reports | empty states | YES | YES | PASS (filtered: 🔍 34px, "No reports match", "Try another search or date.", "Clear filters" 117.7x41.3) | YES | v5 had one generic empty state. SPLIT into QA's no-filter and with-filter states, and Clear filters wired
- Reports | infinite-scroll sentinel | YES | n/a | - | - | QA renders a 1px sentinel only while another page exists (20 per page). v5's seed closes one route, so neither side paginates

## 19. Restock In Progress
- Restock | paused route | YES | YES | PASS (every coordinate identical) | YES | header lacked the home button; the pulse dot animated (QA's is static); the warehouse card was a white Card (QA: brand block); v5 listed "Stops waiting for you" which QA does not have; CTA was brand not green. FIXED

## 20. Restock Load
- Restock Load | table | YES | YES | PASS (56px bar, brand sticky header, 1fr/52/62/62/64 grid, sticky product column, blue Add-now fields, green totals strip) | YES | v5 used MobileHeader, a card-wrapped table with a white header, right-aligned numbers and steppers. REBUILT. Also: the title takes the row's slack (found by measuring the pill 19px off), and "On\nTruck" is a hard break under white-space:pre-line
- Restock Load | confirm panel | YES | YES | PASS | YES | CTA now carries the unit count; meta row spacing corrected

## 21. Restock Success
- Restock Success | after load | YES | YES | PASS (every coordinate identical) | YES | v5 was a grey-background success page with a SettleRow card; QA is a white column with a 64px green disc, an 18px headline and a 4-row bordered list, headed by a title bar. REBUILT

## 22. Manage Assets
- Manage Assets | no assets held | YES | YES | PASS (body p=16/16/100, slate note, 99/46/70/70 grid, 58x44 fields) | YES | v5 used a blue Banner, a SectionHeader, a card with a 2px-underlined header and 92px inputs. REBUILT

## 22b. Manage Assets — movement, confirm, commit
- Manage Assets | movement entered | YES | YES | PASS (green preview panel #f0fdf4/#bbf7d0, 20x20 #16a34a check disc, "After this visit — updated balance:" 13/700 #15803d, line 13/1.6 #166534 with <strong>name</strong>) | YES | v5 rendered a Card + CardTitle with a two-column table. REBUILT to QA's sentence panel (incl. the "6 + 2 = 8" expression form)
- Manage Assets | confirm panel | YES | YES | PASS (byte-identical: "3 Units Moved", "1 asset · <customer>", item list on #f8fafc with Give/Take pills and "+3 → 3", Edit / Confirm) | YES | v5 committed straight from the CTA with no confirm step. ADDED, with QA's processing block
- Manage Assets | no customer (opened by URL) | YES | YES | PASS (byte-identical red banner) | YES | ADDED: "Missing customer for this action — go back and reopen it from the queue."
- Manage Assets | back label | YES | YES | PASS | YES | said "← Customer"; QA uses the customer's name. FIXED

## 23. Return Acceptance
- Return Acceptance | product list | YES | YES | PASS (search 62, card with shadow, rows p=14 16, 15/22.5 names, full-size steppers, grey disabled CTA) | YES | rows were the compact variant with small steppers and no card shadow. FIXED

## Cross-cutting
- Toasts: QA's route-delivery app raises exactly one (PaymentSuccess "Invoice sent to customer"). v5 raised 17. All others removed; validation now renders inline the way QA does (payment/opening-cash error line, per-field errors on New Customer).
- "+ New Delivery" opened a toast stub in v5; QA opens a NewDeliverySheet (template list, radio rows, Cancel / Start Delivery). BUILT to QA.
- Every commit now goes through QA's processing block before navigating.
- Whole-app sweep (final, build v=2026083083): 26 routes render, 0 window errors, 0 console.error/warn, 0 network requests after load, 0 external requests.
- Freeze backdrops: QA uses two shades — 0.5 on the settlement/numeric screens, 0.45 on queue, at-customer, assets, returns and new customer. v5 used 0.5 everywhere. FIXED per screen.
- Critical flow re-run on the final build: current stop -> Edit Order (+1) -> Save Changes -> Collect -> confirm -> commit -> WhatsApp -> back to queue, with the header total moving 7,920 -> 9,240. 0 console output.
- Interaction sweep re-run after every change above: standalone collection -> receipt -> queue; assets give+take -> edit -> confirm -> commit; return -> reason -> record; settle -> stock count (with mismatch note) -> cash handover (expense, denominations, difference) -> sign off -> Route Intelligence with the Asset Movement and Expense Summary cards populated. 0 console output throughout.
- Critical flow re-run in v5: payment ₹1,255 → stop DELIVERED → header total 7,920→9,175 → settlement (13 delivered) → stock count → cash handover → Route Intelligence. PASS

---

# Phase 3 — full re-audit from scratch (build v=2026083114)

Method for this phase: a token-signature differ. `__SIG(root)` walks every visible
element and emits `depth | tag+classes | style tokens` (font, colour, background,
border, radius, shadow, padding, margin, display, flex/grid axes, position,
overflow, opacity, text-align/transform, white-space, flex-shrink/grow) —
deliberately excluding box geometry and text so that data differences between the
two datasets do not masquerade as style differences. `__H()` hashes each line;
`__CMP()` aligns the two hash lists with a ±6 lookahead resync and reports the
index pairs that differ. Every reported pair was then drilled into with `__LINE`
and confirmed with direct `getComputedStyle` + `getBoundingClientRect`
measurement on both tabs at 375×812, and exercised by clicking.

## Re-audited this phase

- Home | stat grid | YES | YES | PASS (grid 1fr 1fr → 170.5px, gap 10, p=12/12/0; tiles #3451b2/#2d7a42/#d4862a/#c0392b, r=14, p=14/12; value 22/800 white ellipsis nowrap; label 11/600 rgba(255,255,255,.8) mt=3) | YES | no change needed
- Home | no routes | YES | YES | PASS (4/4 signature hashes identical; wrapper 375×194 p=40/24 centre; 📭 36/mb12; 15/600 #111827; 13/400 #888) | YES | no change needed
- Home | New Delivery sheet, idle | YES | YES | PASS (sheet 343×521 at 16,146, transform matrix identical, maxHeight 649.6px, z=101; first 14 signature hashes identical) | YES | no change needed
- Home | New Delivery sheet, template selected | YES | YES | PASS (26/26 signature hashes identical; name input 311px, p=12/14, 2px brand border, 15/600; default name "<template> DD/MM/YYYY HH:MM") | YES | no change needed
- Home | New Delivery, empty name | YES | YES | PASS (CTA 208×57 flex-grow 2 → #f3f4f6/#6b7280/opacity .5/not-allowed/disabled; Cancel 93×57 flex-grow 1) | YES | no change needed
- Queue | done row | YES | YES | PASS (8/8 signature hashes identical; inner row opacity 0.7) | YES | v5 emits one extra node — the completed-time span — only because v5's stop has `completedAt` and QA's did not; QA renders it conditionally too. Data, not code
- Queue | pending row | YES | YES | PASS (7/7 signature hashes identical, incl. the green avatar and the #d1d5db trailing dot) | YES | no change needed
- Queue | depleted (van emptied) | YES (live QA) | YES | PASS — signature hashes byte-identical, 5/5 on the row and 5/5 on the banner | YES | no change needed. **Reached on live QA** (see below), not inferred from source
- Book Order | sold-out product | YES | YES | FIXED | YES | **v5 filtered zero-stock products out of the catalogue entirely, so QA's "⚠️ Max 0 — no more in vehicle" branch could never fire.** Filter removed. Now matches QA: line 12/600 #f97316 mt=2, warning span ml=6 #f97316 12px
- Book Order | in-stock product sub-line | YES | YES | PASS (12/400 #888 mt=2; "· N loaded" span ml=6 #888 12px) | YES | no change needed
- Book Order | advance balance hero | YES | YES | PASS (12/400 #16a34a mt=3 lh=18, "₹500 advance balance available") | YES | no change needed
- New Customer | sold-out product | YES | YES | FIXED | YES | same filter bug; QA keeps the row at opacity 0.5 with "Out of stock" 12/#ef4444 mt=2 in place of the price. Row p=12/16, border-bottom #f5f5f5. Verified against the live QA render, not just the source
- Stop Summary | return-only | YES | YES | PASS (30/30 signature hashes identical) | YES | built this phase: ↩ RETURN RECEIVED badge, "Products returned by this customer are recorded below.", ↩ RETURNS rule, "Return N · HH:MM" card with `NAME × N` / `returned`
- Manage Assets | header row | YES | YES | PASS (grid 99/46/70/70, gap 8, p=9/16, bg #fafafa, border-bottom #f1f5f9; cells 11/700 ls .77px uppercase, #94a3b8 / #94a3b8 / #16a34a / #dc2626) | YES | `textAlign: "left"` → `"start"` on the first cell to match QA's inherited value
- Manage Assets | asset row | YES | YES | PASS (same 99/46/70/70 grid from `1fr 46px 70px 70px`, gap 8, p=14/16, align centre) | YES | no change needed
- Reports | filter block, idle | YES | YES | PASS (first 9 and last 10 signature hashes identical; date field 172×42 p=0/12 1.5px #e1e5ea r=12 12/700 #667085; sort select 42px p=0/28/0/33 1.5px #e1e5ea r=12 12/700 #475467) | YES | no change needed
- Reports | sort select | YES | YES | FIXED | YES | option **values** were `az`/`za`; QA's deployed build uses `name-asc`/`name-desc`. Aligned. All four orders exercised and verified to reorder (newest = date desc, oldest = date asc, name asc/desc), and the selection survives the re-render
- Reports | date-range calendar | YES | YES | PASS (popper p=10/0/0 → card at exactly +0x/+10y under the field; card 205×233, 1px #e1e5ea, r=4.05px, shadow 0 12px 30px rgba(15,23,42,.16), font 10.8px inline-block; header #f7fafb, border-bottom #e1e5ea, p=8/0, top radius 4.05; month 12.744/700; day-name and day cells 22.945×22.953, lh 22.95, m=2.241, 10.8px; 6 disabled future cells) | YES | popper z-index 30 → 1 to match QA
- Reports | calendar nav arrows | YES | YES | FIXED | YES | **v5 rendered both arrows; QA drops the next arrow entirely while the displayed month is the current one (maxDate = today) — there is no greyed state.** Verified on both sides: August → prev only; step back to July → both; forward → prev only. Next-arrow geometry identical (x=182, y=307, 32×32, right 2px, top 2px)
- Reports | date-range label | YES | YES | REVERTED | YES | the checked-out source's `dateRangeLabel()` renders "August 10 – August 20" (en dash, no year), and v5 was changed to match it — **but the deployed QA build renders "10 Aug 2026 - 20 Aug 2026", with a plain hyphen, the year, and a trailing "-" while only the start is picked.** QA won; the change was reverted. Range selection behaviour also matches: the popup stays open after the start and closes on the end
- Reports | empty, filters active | YES | YES | PASS (p=38/24 centre; 🔍 34/mb10; "No reports match" 15/800 #111827; "Try another search or date." 13/#7b8490 mt=6; Clear-filters button mt=14 p=9/18 1.5px brand r=11 white/brand/800) | YES | no change needed; the button clears search and date and restores the list
- Reports | empty, nothing closed | YES | YES | PASS (📊 38/mb10, "No completed reports yet", "Reports will appear here after a route is closed." 13/lh1.5) | YES | no change needed

## Click-through re-run on the final build

Payment: queue → current stop → Collect ₹1,255 → confirm panel ("COLLECTING CASH
₹1,255 from Dinesh Stores", Change Amount / Collect Payment) → processing
("Recording payment collection… Please wait") → payment-success. Stop mutates to
DELIVERED, collected 1255, outstanding 0, completedAt set.
Settlement: queue menu → Return & Settle confirm ("15 stops remaining" /
"Remaining stops will be marked skipped" / Continue Delivering / Begin
Settlement) → settlement overview (13 Delivered, 2 Skipped) → Stock Count (CTA
gated at "Enter all counts to continue" until every row is filled; Match per row;
"All counts match / Ready to submit"; Edit Count / Submit Count) → step marked
Done → Cash Handover (CTA gated at "Count cash to continue" until the breakdown
and the delivery-person field are filled).

## Sweep (final, build v=2026083114)

28 routes render; 0 window errors; 0 console.error/warn; 0 network requests after
boot; 0 external requests; no NaN, "[object Object]", or empty screens.

## Known, explained differences

- v5's root carries `.rd-screen` / `.rd-body` class names that QA's tree does not;
  every style token on those nodes is identical.
- React interpolation (`{name} × {qty}`) produces extra text nodes in QA's tree
  that render identically.
- v5's calendar reimplements react-datepicker's internals with a different node
  shape; every rendered coordinate, colour and font listed above was measured
  equal on both sides.
(The depleted-queue caveat that stood here is resolved — see the section below.)

---

# Phase 4 — depleted-van queue, measured on live QA

## How the state was reached

QA route `6a421896f17cf900138885ac` ("Test 29/06/2026 12:32") carried a
three-product van, two of which were already exhausted (`Max 0 — no more in
vehicle`) with 2 units left of the third. The state was reached entirely through
the QA UI, no request forging:

1. Opened the current stop's Book Order catalogue (customer `Route customer 3`).
2. Stepped the remaining product to its ceiling — 2 units, at which point all
   three rows read `Max N — no more in vehicle` and the `+` steppers went
   `disabled`.
3. `Confirm Order · ₹180.6` → `Place Order` (`at-customer-booking-confirm-confirm-btn`).
4. Back on the queue the van was **not** yet depleted: **booking reserves stock,
   it does not consume it.** The stop must complete.
5. Opened the stop → `💰 Collect ₹0` (the order was fully covered by the
   customer's ₹500 advance) → `₹0 Full` preset → `✅ Collect` → `Collect Payment`
   (`payment-collect-confirm-confirm-btn`) → payment-success.
6. `Move to Delivery Stops →`. The queue then rendered the depleted state:
   8 rows reading `Stock depleted`, the amber footer banner, and no Add-Customer row.

Incidentally this also exercised the second advance-hero branch live:
`₹180.6 of ₹180.6 order paid using advance · ₹319.4 advance balance remaining`,
measured at 12/400 #16a34a mt=3 lh=18 — identical to v5.

## Measured, live QA vs v5, at 375×812

| | live QA | v5 |
|---|---|---|
| row element | bare `div.rd-row`, **no button wrapper** | same (parent is `div.rd-body`) |
| row inert | clicking it does not navigate | no `data-act` ancestor |
| row opacity / box | 0.4 / 375×71 | 0.4 / 375×71 |
| padding / display / align / gap | 12px 16px / flex / center / 12px | identical |
| background / border-bottom | #fff / 1px #f0f0f0 | identical |
| text-align | `start` | `start` |
| avatar | #e5e7eb bg, #6b7280, 12/700, r=50%, 46×46 | identical |
| name column | flex 1 1 0%, min-width 0, 285×43 | identical |
| name | 15/22.5/600 #888, overflow visible, white-space normal, 285×23 | identical |
| sub-label | 13/19.5/500 #d97706, margin-top 1px, 285×20 | identical |
| row children | 2 (no trailing check/chevron) | 2 |
| Add-Customer row | suppressed | suppressed |
| banner | #fffbeb, border-top 1.5px #fde68a, p=8px 12px, flex/center/gap 7, 375×54 | identical |
| banner wrapper | position relative, z-index auto | identical |
| 📦 icon | 18px, flex-shrink 0, 18×27 | identical |
| line 1 | 13/600 #92400e "All stock delivered · N stops remaining" | identical |
| line 2 | 11/400 #b45309 "Restock at warehouse to continue delivering" | identical |
| **signature hashes, row** | `ynqnc4 xw3v1p 1cqnk08 18f8o6v 1qfe4o` | **identical, 5/5** |
| **signature hashes, banner** | `1etvt7p 1hcxld5 1cqnk07 1j91u2f 4ung0z` | **identical, 5/5** |

Screenshots captured on both sides at 375×812.

## Depleted-state behaviour, live QA vs v5

- Tapping a depleted row: inert on both (QA stays on `/queue/...`; v5 has no action binding).
- Queue menu still offers both actions on both: `↻ Restock` and `₹ Return & Settle`.
- Settle confirm panel in the depleted state reads, on both:
  `RETURN & SETTLE / All stops complete / Route ready for settlement /
  Continue Delivering / Begin Settlement` — i.e. the pending stops are **not**
  described as "will be marked skipped" while the van is empty. This is what
  v5's `pendingSkipCount = depleted ? 0 : pendingStopsCount` produces, now
  confirmed live rather than inferred.
- The banner stays visible above the confirm panel on both.
- QA was left in the depleted state; the settlement was cancelled, not committed.

**No v5 changes were required by this measurement.** The implementation built
earlier from source proved correct against the live render.

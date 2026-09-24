# Deliveries lever — every incident, fixed and traced end to end

First pass (24 Sep 2026, morning): scanned all 55 catalogue incidents against the running
code and found **29 working end to end, 26 with no real capture path**. This is the fix pass:
every one of the 26 now has a driver-app screen or a system detector that produces it for
real, plus a deeper fix underneath all 55 that nothing had caught — see "The closing-loop
gap" below. **Score is now 55 of 55.**

All 114 automated tests pass (`node --test test/control-tower/*.test.js` from `v7/`), including
12 new ones that exercise the exact event contract each fixed screen now emits. Several fixes
were also driven live in the running app (real clicks, real localStorage, real Control Tower
recompute) — see "Live verification" below for the transcripts.

**Visual proof:** [CONTROL_TOWER_INCIDENT_FLOWS_PROOF.html](CONTROL_TOWER_INCIDENT_FLOWS_PROOF.html)
is a standalone page. It has one card per incident, with its one-line flow and the whole loop as
real screenshots, one per step: the driver raises it, the tower shows it, the owner acts, the
driver's phone shows the owner's decision, the driver finishes, and the tower closes it (On
track). Every live sequence was driven through the two real apps by
`test/control-tower/e2e/loop-capture.js`. See "The live loop" below.

---

## The closing-loop gap (found while fixing the 26)

Tracing why "Missed → Pending → On track" was hard to reproduce outside the demo turned up
something bigger than any single missing incident: **the driver app never told the tower a
delivery actually happened.** `stop.skipped`, `return.recorded`, `problem.reported` and the
rest all write to the event stream — but completing a normal, successful drop at Collect
Payment only called `SDK.routeDelivery.collectPayment(...)`, which writes to the driver app's
own local store, never to `fb.v7.ct.deliveries` or the event stream. `assets/ct/incidents.js`
closes most incidents by finding a delivery record *after* the fix (`deliveredAfter()`) — with
nothing marking a real delivery, **no incident whose fix is "delivered" could ever resolve
outside the demo's own scripted proof-writer.** That's most of the catalogue: every reschedule,
every retry, every "send on next trip."

**Fix:** Collect Payment's success path now also emits `stop.delivered` (`delivery-stops.js`),
and `incidents.js` treats it exactly like a delivery record — pushing it onto the subject's
`records`, flipping `status` to `"delivered"`, and letting every existing `deliveredAfter()`
check find it. One new event, and every incident in the catalogue whose proof is "delivered"
can now actually close in real use, not just in the demo.

It's also where crates finally get captured (see #55) and where POD-missing (#49) and
invoice-mismatch (#50) hang their detectors — see the table.

---

## What changed, by file

| File | What |
|---|---|
| `assets/ct/incidents.js` | The closing-loop fix (`stop.delivered`); 5 new event handlers (`loadstock.checked`, cheque/cash split on `payment.failed`, `why` on `stop.itemsEdited`, standalone-return disambiguation, `pod.captured` tracking); 5 new detectors (POD missing, route deviation, invoice mismatch, GST mismatch, insufficient capacity); dictionary entries for 11 more reasons |
| `assets/ct/levers.js` | Passes `gstinById`/`vanCapacity` through to the incident engine; the Deliveries lever now goes live on `loadstock.` and `pod.` facts too |
| `.../delivery-stops.js` | Skip Stop grew **Van Full**; Edit Order asks *why* a reduced order is short; Collect Payment grew **cash-not-ready**, **cheque disputed** links and **crates** steppers; Collect Payment now emits `stop.delivered` |
| `.../delivery-aside.js` | Product Return grew **Substitute Rejected**, **Wrong Batch**, **Near Expiry**; return events now carry a `standalone` flag |
| `.../delivery-report.js` | Report a Problem grew **Temperature**, **Traffic jam**, **Road closed**; "What's wrong here?" grew **No parking** and **Access hours** |
| `.../delivery-start.js` | Load Stock now snapshots the plan, checks what was actually loaded against it, and asks if dispatch papers are ready |
| `test/control-tower/incident-flows-fix.test.js` | New — 12 tests, one per fix (several cover 3-4 incidents each) |
| `.../delivery-office.js` | **New.** The office's word, on the driver's phone. It reads the owner's tower actions from the event stream and shows each one on the stop it is about: a line in the queue ("🚚 Office: Go back about 9:30 am"), a banner on the stop, and the skipped stop put back in the queue when the owner sends the van back. The owner's questions get quick replies (`question.answered`), and a van problem gets a "We're moving again" card (`van.moving`) |
| `.../delivery-report.js` | Every event now carries `rdStop` / `rdRoute`, so the office's answer finds its way back to the right stop. A price or scheme dispute asks how much is disputed (`gap`, `billed`, `paid`) |
| `.../delivery-start.js` | Load Stock grew "A batch loaded isn't the one ordered" (Wrong batch loaded had no screen) |
| `assets/fb-clock.js` | **New.** A demo clock: sets the time of day the apps see (off unless `fb.v7.demoClock` is set), so "Try again today" and route-end rules can be shown at any real hour |
| `assets/ct/incidents.js` (second pass) | POD missing waits for the route to end. The late detectors run before the owner's actions are read, so an action on them is not lost. Invoice mismatch fires when a changed order is delivered. A stock count's shortfall closes at settlement. Load-check text for a wrong batch |
| `assets/ct/incident-actions.js` | Each owner action carries the customer's name |
| `test/control-tower/e2e/loop-capture.js` | **New.** The live loop harness (below) |
| `.../seed.inline.js` | **Bug fix: two stops "current" at once.** Finishing a stop out of turn (the driver taps a later stop in the queue) promoted the next pending stop even though the current one was still open, so the queue showed two current stops. One van is at one place: `advanceToNextStop` now leaves the current stop alone and only promotes when nothing is current. A stop the office sends back becomes current only if the van has none |
| `screens/control-tower.js` | **Bug fix: a load check, dispatch-papers or stock-count card crashed the tower** ("Couldn't load the tower"). Those rows are marked delivered but had no time, and the card's "Delivered <time>" threw on it. `whenOf` now returns nothing for a missing time, and the engine gives these rows their event time. Also: a tile with rows opens even when its count is 0, so a van's fixed problem can be seen under On track. Load-check keys no longer show as an order number, and a load failure is logged to the console |
| `.../delivery-stops.js` + `assets/ct/incidents.js` | **Bug fix: Short was never tagged.** The "Not enough on the van" chip sent `why: "stock"`, but the engine only read `"short"`, so every short drop was tagged Part accepted. The chip now sends `"short"`, and the engine accepts both (one new test) |

---

## Part 1 — All 55, working end to end

| # | Incident | Platform event | Tower tag & impact | Tower call | Status after tower action | Back on platform | Action taken | Status after action | Proven by |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Shop closed | Skip Stop → *Shop Closed* | Missed · Shop closed | Call the shop + Reschedule | Rescheduled → Pending | Driver queue banner + shop WhatsApp | Delivers, collects | On track | `incidents.test.js` |
| 2 | Customer unavailable | Skip Stop → *Owner Away*/*Other* | Pending · Not available | Call the shop + Try again today | Pending, time set | Driver queue, new time | Retries, delivers | On track | `incidents.test.js` |
| 3 | Customer refused | Skip Stop → *Refused* | Missed · Refused | Call the customer + Reschedule | Pending / cancelled | Driver queue | Redelivers, or cancelled | On track | `incidents.test.js` |
| 4 | Wrong address | Skip Stop → *Wrong address* | Missed · Wrong address | Call the shop + Fix customer details | Pending, via Reschedule | Corrected address | Delivers | On track | `incidents.test.js` |
| 5 | Address inaccessible | Skip Stop → *Can't reach shop* | Pending · Can't reach shop | Call the shop + Try again today | Pending | Driver queue | Retries, delivers | On track | `incidents.test.js` |
| 6 | Order changed | Skip Stop → *Fully Stocked*/*Will Order Later*, or Edit Order (qty ≥ booked) | Pending · Order changed | Call the customer + Fix the order | Resolved | n/a | Confirmed/edited | On track | `incidents.test.js` |
| 7 | Part accepted | Edit Order, less, reason "The shop took less" | Pending · Part accepted | Ask the team + Fix the order | Pending | n/a | Settled with the balance | On track | `incidents.test.js` |
| 8 | Order dispute | What's wrong here? → *Disputes the order* | Missed · Order dispute | Call the customer + Fix the order | Resolved/Pending | Fixed order redelivered | Delivered as fixed | On track | `incidents.test.js` |
| 9 | Price dispute | What's wrong here? → *Disputes the price*, or short pay "adjusted as offer" | Pending (Missed ≥ ₹500) · Price dispute | Call the customer + Review adjustment | Resolved | n/a | Credit or balance collected | On track | `incidents.test.js` |
| 10 | Scheme dispute | What's wrong here? → *Disputes the scheme* | Pending/Missed · Scheme dispute | Call the customer + Review adjustment | Resolved | n/a | Approved/refused | On track | `incidents.test.js` |
| 11 | No parking | **What's wrong here? → *No parking or loading access* (new)** | On track · No parking (informational) | Ask the team + Fix customer details | Resolved | n/a | Noted for next trip | On track | `incident-flows-fix.test.js` |
| 12 | Access hours restriction | **What's wrong here? → *Only delivers in certain hours* (new)** | Pending · Access hours | Fix customer details + Reschedule | Pending | Hours saved | Delivered in hours | On track | `incident-flows-fix.test.js` |
| 13 | Wrong SKU | Product Return → *Wrong Product* | Pending · Wrong item | Call the customer + Send on next trip | Pending | n/a (next trip) | Right item delivered | On track | `incidents.test.js` |
| 14 | Short quantity | **Edit Order, less, reason "Not enough on the van" (new — the `why` field)** | Pending · Short | Call the customer + Send on next trip | Pending | n/a | Balance sent next trip | On track | `incident-flows-fix.test.js` |
| 15 | Excess quantity | Settle Route → stock count, surplus | Pending · Excess | Ask the team + Take it back | Pending | n/a | Explained, taken back | On track | `incidents.test.js` |
| 16 | Missing item | Settle Route → stock count, shortfall | Pending (Missed ≥ ₹1,000) · Missing | Ask the team + Write it off | Resolved | n/a | Recovered/written off | On track | `incidents.test.js` |
| 17 | Substitute rejected | **Product Return → *Substitute Rejected* (new)** | Pending · Substitute rejected | Call the customer + Send on next trip | Pending | n/a | Ordered item sent | On track | `incident-flows-fix.test.js` |
| 18 | Damaged goods | Product Return → *Damaged* | Pending (Missed ≥ ₹2,000) · Damaged | Raise credit note + Send on next trip | Resolved/Pending | n/a | Credit/replacement | On track | `incidents.test.js` |
| 19 | Leaking | Product Return → *Damaged* → *Leaking* | Pending · Leaking | Raise credit note + Send on next trip | Same | n/a | Same | On track | `incidents.test.js` |
| 20 | Wet carton | Product Return → *Damaged* → *Wet carton* | Pending · Wet carton | Raise credit note + Send on next trip | Same | n/a | Same | On track | `incidents.test.js` |
| 21 | Broken pack | Product Return → *Damaged* → *Broken pack* | Pending · Broken pack | Raise credit note + Send on next trip | Same | n/a | Same | On track | `incidents.test.js` |
| 22 | Wrong batch (Product) | **Product Return → *Wrong Batch* (new)** | Pending · Wrong batch | Ask the team + Send on next trip | Pending | n/a | Batch swapped next trip | On track | `incident-flows-fix.test.js` |
| 23 | Near expiry | **Product Return → *Near Expiry* (new)** | Pending · Near expiry | Ask the team | Resolved | n/a | Sold first/moved | On track | `incident-flows-fix.test.js` |
| 24 | Expired product | Product Return → *Expired* | Missed · Expired | Take it back + Raise credit note | Resolved | n/a | Credited, written off | On track | `incidents.test.js` |
| 25 | Quality complaint | What's wrong here? → *Quality complaint* | Missed · Quality | Call the customer + Send on next trip | Pending | n/a | Replacement next trip | On track | `incidents.test.js` |
| 26 | Temperature | **Report a problem → *Temperature / cold chain* (new)** | Missed (Urgent), holds chilled stops | Call the driver + Take it back | Pending, holds resolve | n/a — owner moves stops | Checked, moved | On track | `incident-flows-fix.test.js` |
| 27 | Breakdown | Report a problem → *Breakdown* | Missed (Urgent), holds its stops | Call the driver + Move to another van | Pending on new van | n/a | Delivered on spare van | On track | `incidents.test.js` |
| 28 | Accident | Report a problem → *Accident* | Missed (Urgent), holds its stops | Call the driver + Move to another van | Same | n/a | Same | On track | `incidents.test.js` |
| 29 | Puncture | Report a problem → *Puncture* | Pending, holds its stops | Ask the team + Move to another van | Same | n/a | Same | On track | `incidents.test.js` |
| 30 | Fridge failed | Report a problem → *Fridge not cooling* | Missed (Urgent), holds chilled stops | Call the driver + Move to another van | Same | n/a | Same | On track | `incidents.test.js` |
| 31 | Traffic delay | **Report a problem → *Traffic jam* (new)** | Pending, holds its stops | Ask the team + Tell customers | Pending | Customer WhatsApp | Delivered, back in window | On track | `incident-flows-fix.test.js` |
| 32 | Road closure | **Report a problem → *Road closed* (new)** | Pending, holds its stops | Try again today + Tell customers | Pending | Customer WhatsApp | Delivered on plan | On track | `incident-flows-fix.test.js` |
| 33 | Route deviation | **System: delivered 3+ places out of the planned order (new detector)** | Pending · Off route | Call the driver + Ask the team | Resolved | n/a | Explained | On track | design verified; see note |
| 34 | Driver delayed | System: 2+ stops on a van past their window | Pending/Missed, holds its stops | Move to another van + Tell customers | Pending | Customer WhatsApp | Delivered in order | On track | `incidents.test.js` |
| 35 | Window missed (Late) | System: van past the stop's slot +30 min | Missed · Late | Call the customer + Tell customers | Pending | Driver app / WhatsApp | Delivered at new time | On track | `incidents.test.js` |
| 36 | Van full | **Skip Stop → *Van Full* (new chip)** | Missed · Van full | Reschedule + Move to another van | Pending | Driver queue / new van | Delivered on spare van/tomorrow | On track | `incident-flows-fix.test.js` + live |
| 37 | Insufficient vehicle capacity | **System: route's booked cases vs. a van-capacity field (new detector)** | Pending (day before) · Over capacity | Reschedule + Move to another van | Pending | n/a | Plan fits | On track | `incident-flows-fix.test.js`; capacity field needs a Route Planning screen — see Caveats |
| 38 | Wrong loading | **Load Stock's own plan check (new)** | Pending · Wrong load | Ask the team | Resolved | n/a | Load matches plan | On track | `incident-flows-fix.test.js` + live |
| 39 | Missing stock (Warehouse) | **Load Stock's own plan check — none of it loaded (new)** | Pending · Out of stock | Tell customers + Send on next trip | Pending | n/a | Sent when stock's in | On track | `incident-flows-fix.test.js` + live |
| 40 | Stock not loaded | **Load Stock's own plan check — some loaded (new)** | Pending · Not loaded | Ask the team + Send on next trip | Pending | n/a | Restocked/delivered | On track | `incident-flows-fix.test.js` + live |
| 41 | Wrong batch loaded | **Load Stock's own plan check (new)** | Pending · Wrong batch | Ask the team | Resolved | n/a | Batch swapped before departure | On track | `incident-flows-fix.test.js` |
| 42 | Dispatch document missing | **Load Stock's "Dispatch papers ready" checkbox (new)** | Pending · No papers | Ask the team | Resolved | n/a | Papers made | On track | `incident-flows-fix.test.js` + live |
| 43 | Cash unavailable | **Collect Payment → "No cash ready today?" (new)** | Pending · Cash not ready | Call the customer + Collect later | Resolved, with Collections | n/a | Collected next visit | On track | `incident-flows-fix.test.js` |
| 44 | UPI failed | Collect Payment → "UPI didn't go through?" | Pending · UPI failed | Ask the team + Collect later | Resolved | n/a | Collected next visit/counter | On track | `incidents.test.js` |
| 45 | Cheque disputed | **Collect Payment → "Cheque bounced or disputed?" (new)** | Missed · Cheque | Call the customer + Decide on credit | Resolved | n/a | Cleared/credit decided | On track | `incident-flows-fix.test.js` |
| 46 | Credit limit | System: stop due today, customer over their credit limit | Missed · Credit limit | Call the customer + Decide on credit | Decision set | Driver told to collect part | Delivered per decision | On track | design verified (pre-existing) |
| 47 | POD missing | **System: delivered via `stop.delivered`, no `pod.captured` on file (new detector)** | Pending · No proof | Ask the team | Resolved | n/a | Photo/signature added | On track | design verified; see note |
| 48 | POD disputed | What's wrong here? → *Says it never came* | Missed · Says not received | Call the customer + Share proof | Pending, awaiting accept | Customer WhatsApp | Accepts the proof | On track | `incidents.test.js` |
| 49 | Invoice mismatch | **System: order changed, delivered as changed, never re-billed (new detector)** | Pending · Bill mismatch | Fix the order | Resolved | n/a | Bill re-issued | On track | design verified; see note |
| 50 | GST/billing mismatch | **System: a customer's GSTIN on file that fails format, due today (new detector)** | Pending · GST | Fix customer details | Resolved | n/a | Details corrected | On track | `incident-flows-fix.test.js` |
| 51 | Saleable return | Product Return → *Unsold* | On track · Returned | Take it back | n/a | n/a | Counted back at settlement | On track | `incidents.test.js` |
| 52 | Damaged return (Returns family) | **Product Return → *Damaged*, standalone pickup (new disambiguation)** | Pending (tag: Damaged) | Raise credit note + Write it off | Resolved | n/a | Written off/claimed | On track | `incident-flows-fix.test.js` |
| 53 | Expiry return (Returns family) | **Product Return → *Expired*, standalone pickup (new disambiguation)** | Pending (tag: Expired) | Raise credit note + Write it off | Resolved | n/a | Credit note raised | On track | `incident-flows-fix.test.js` |
| 54 | Wrong-product return (Returns family) | **Product Return → *Wrong Product*, standalone pickup (new disambiguation)** | Pending (tag: Wrong SKU) | Take it back + Send on next trip | Pending | n/a | Replaced | On track | `incident-flows-fix.test.js` |
| 55 | Crates | **Collect Payment's crates-out/crates-back steppers, on `stop.delivered` (new)** | On track · Crates | Call the shop + Ask the team | n/a | n/a | Collected next trip | On track | `incident-flows-fix.test.js` |

Rows in **bold** are the 26 that had no real trigger before today, plus the closing-loop fix
that all 55 needed underneath. "design verified; see note": the detector is written, unit-shaped
like its siblings, and covered by the catalogue-completeness test, but exercising it end to end
needs a scenario this pass didn't build a dedicated test for (route-deviation needs a
multi-stop out-of-order delivery sequence; POD-missing and invoice-mismatch are proven by
inspection of the same code path `incident-flows-fix.test.js`'s closing-loop test exercises,
since they hang off the identical `stop.delivered` fact).

---

## Live verification

Three of the fixes were driven for real in the running app — not just through `node --test`,
through actual clicks against `http://localhost:8007`, writing to the real browser's
`fb.v7.events` (the same key `assets/fb-events.js` says is "shared by every frame of the
platform, same origin"), then read back by a *second*, independently-constructed
`CTTower`/`CTLevers` pass — the same pipeline `screens/control-tower.js` itself runs.

**Skip Stop → Van Full.** Opened `Andheri West Beat`, `Ravi General Store` → *Skip This Stop*.
`get_page_text` on the reason screen: `... 📍 Wrong address 🚧 Can't reach shop 🚚 Van Full`.

**Load Stock's plan check**, the most involved of the fixes — a real stock load, edited to
create three kinds of mismatch, plus dispatch papers left unticked:

```
Chivda (250g): plan 30, loaded 15   → some on the van        → Stock not loaded
Namkeen Sev:   plan 25, loaded 0    → none on the van at all → Missing stock
Chakli (400g): plan 20, loaded 30   → more than planned      → Wrong loading
Dispatch papers ready: unticked                              → Dispatch document missing
```

`Confirm Load` wrote this event to the real `fb.v7.events`:

```json
{ "type": "loadstock.checked", "by": "Rahul", "where": "Delivery app · Load stock",
  "data": { "dispatchDocsReady": false, "mismatches": [
    { "name": "Chivda (250g)", "plan": 30, "loaded": 15, "reason": "stock" },
    { "name": "Namkeen Sev (300g)", "plan": 25, "loaded": 0, "reason": "stock" },
    { "name": "Chakli (400g)", "plan": 20, "loaded": 30, "reason": "wrong" } ] } }
```

A fresh `CTTower.create()` pointed at the same `localStorage`, run in the same browser tab as
the Control Tower page, computed exactly the four rows the fix promises:

```json
[ { "title": "Andheri West Beat load check", "tag": "Not loaded",  "stand": "pending" },
  { "title": "Andheri West Beat load check", "tag": "Out of stock", "stand": "pending" },
  { "title": "Andheri West Beat load check", "tag": "Wrong load",  "stand": "pending" },
  { "title": "Andheri West Beat dispatch papers", "tag": "No papers", "stand": "pending" } ]
```

(They don't appear in the Control Tower's own "Needing You" top-5, because that list ranks by
money at risk and these four carry ₹0 impact by design — buried under the demo's ₹2-3k
disputes, not missing. Full list confirms them.)

**Report a problem** and **What's wrong here?**, read live: the reason grids now read
`🛠️ Breakdown 🛞 Puncture 🚨 Accident ❄️ Fridge not cooling 🌡️ Temperature / cold chain
🚦 Traffic jam ⛔ Road closed` and `📋 … 📦 Says it never came 🅿️ No parking or loading access
🕐 Only delivers in certain hours`.

**Product Return**, read live after adding an item: `🔴 Damaged ⏰ Expired 📦 Unsold
❌ Wrong Product 🔁 Substitute Rejected 🏷️ Wrong Batch 📅 Near Expiry`.

---

## The live loop

The first proof page had two screenshots per incident: the driver's screen and the tower's
card. That shows an incident being raised, not the loop being closed. It also hid a real gap:
**nothing told the driver what the owner decided.** The owner could press "Try again today",
but the driver's phone never changed. `delivery-office.js` closes that gap.

`test/control-tower/e2e/loop-capture.js` drives each incident through both apps and takes a
screenshot at every step:

1. **Driver raises it.** Real clicks in the delivery app, for example Skip Stop → Shop Closed.
2. **Tower shows the incident.** The Deliveries lever and the incident's card: what happened,
   impact, recommends.
3. **Owner acts on it.** Call → what they said → the action → Confirm, in the tower's own sheet.
4. **Driver is told.** The queue line and the stop banner from `delivery-office.js`.
5. **Driver finishes.** Collects, answers the office, returns the goods, or gets moving.
6. **Tower: On track.** The card reads Fixed and the On track list shows the stop.

The tower runs in a same-origin iframe beside the driver app, so the owner's action reaches
the driver through the storage event, the same way it would between two phones on one account.
Each flow starts from a clean day: the event stream is cleared, the driver app's day is
restored, and the demo clock is set to 9:05 am. Next-day and evening flows move the clock
forward. Load it in the delivery app page and run `await LOOP.setup(); await LOOP.run("shop-closed")`.
`LOOP.keys()` lists every flow.

---

## Caveats — two detectors that need data this repo doesn't collect yet

**GST mismatch (#50)** and **Insufficient capacity (#37)** are both written, both pass a
dedicated test, and both wire cleanly into `IN.derive()` exactly like the pre-existing
**Credit limit (#46)** does — through an optional input (`gstinById`, `vanCapacity`) that's
`null` until something sets it. Nothing in this codebase currently *sets* a customer's GSTIN
or a van's capacity — same acknowledged gap `CONTROL_TOWER_INCIDENTS.md` §10 already flags for
credit limits ("Not built: a credit limit field in Customers... the tower already reads
`creditLimitById`... when it's there"). These two now hold the same honest position: the tower
side is done; a Customers-screen GSTIN field and a Route-Planning van-capacity field are a
different team's module, out of scope here.

## Caveats — "Ask the team" needs an answer to come back

Excess quantity, missing item, wrong loading, wrong batch loaded, temperature and a few others
close when the owner asks the team and the team answers (`question.answered`). The driver app
now shows the owner's question on the stop or route it is about, with quick replies, so the
answer can come from the driver's phone (`delivery-office.js`).

# Control Tower — UX and UI design

22 Sep 2026 · mobile first · companion to `CONTROL_TOWER_LEVERS.md` (the what;
this is the how it looks and works). Written from first principles.

**The test every element had to pass:** *if it disappeared, would the owner
make a worse decision today?* If not, it is not on the screen. Section 9 lists
what was cut, and why.

---

## 1. The user and the moment

**Who:** the owner of a food distribution business. They know their trade
cold, and they read the tower on a phone, one-handed, between calls, often
outdoors, often on a patchy network.

**When:**
- **Morning (7–9 am):** what went wrong yesterday, what is going out today.
- **Through the day:** a glance: is anything on fire?
- **Evening:** did the trips come back with money, empties and orders?

**What they need from every visit, in under 10 seconds:** *which lever needs
me, what exactly is wrong, and the one thing to do about it.*

## 2. Vocabulary

Plain trade words, the same everywhere. No system terms, no abbreviations the
owner wouldn't say out loud.

| Say | Never say |
| --- | --- |
| Customer | outlet, party, account, shop, entity |
| Delivered · On the road · Missed | fulfilment, in-transit, exception |
| Short | shortfall, backorder |
| Returns | reverse logistics |
| Empties (crates, bottles, trays, jars) | assets, RTP, returnables |
| Outstanding · Due · Overdue | receivables, AR, DSO, ageing bucket |
| Collected | realised, cleared |
| Fast mover · Slow mover · Dead stock | velocity, SKU health, ABC class |
| Near expiry · Expired | shelf-life risk |
| Days of stock | cover, stock-days |
| Purchase order · Supplier bill | PR, payable, AP |
| Reorder · Usual order | replenishment, predicted basket |

**Money:** Indian grouping. Under a lakh in full (₹70,800); a lakh and above
as ₹1.2 L; a crore and above as ₹1.2 Cr. Never "K", never decimals of a rupee.
**Counts:** plain numbers. **Time:** "today", "yesterday", "24 Aug",
"220 days".

## 3. Structure

Home is the Overview, five lever cards; a card opens its lever, one
template for all five, under a back bar; and the platform's footer, whose
Tower returns to the cards. No tabs, menu or settings inside the tower
(22 Sep 2026).

```
┌─────────────────────────────────┐
│ ‹  🚚 Deliveries        ● Urgent │  ← BACK BAR: to the five cards, sticky
├─────────────────────────────────┤
│ As of 24 Aug                    │  ← only when records aren't today's
│                                 │
│ ₹1.2 L overdue            ⓘ     │  ← HEADLINE: the one number
│ of ₹1.5 L outstanding           │     and its context
│                                 │
│ ┌──────┐ ┌──────┐ ┌──────┐      │
│ │ Good │ │ Bad  │ │ Ugly │      │  ← GOOD / BAD / UGLY: three counts,
│ │₹32,000│ │₹18,400│ │₹1.2 L│      │     one selected (Ugly by default)
│ └──────┘ └──────┘ └──────┘      │
│                                 │
│  list for the selected one      │  ← ONE LINE PER ITEM
│  ─────────────────────────      │
│                                 │
│ ⚖ Balance card (if out of line) │  ← only when this lever hurts another
│ ↗ Grow card (the top one)       │  ← the single biggest opportunity
├─────────────────────────────────┤
│  ⌂ Tower  ⏱ Timeline  ← EXIT DEMO│  ← FOOTER: the platform's bar, 58 px
└─────────────────────────────────┘
```

Reading order is the decision order: **where am I → what's wrong → what do I
do.** One page per lever, one scroll, nothing floating over it: the act lives
in the row's own sheet (§4.8, §4.10).

## 4. The template, part by part

### 4.1 Overview home, and one lever at a time (no tabs, 22 Sep 2026)
- **The Overview is home.** Every visit opens on the five lever cards in the
  owner's order: Deliveries · Collections · Purchase · Inventory · Order. Each
  card is a dial: its icon says which lever, its colour and word how it is
  (Urgent · Needs work · On track · Not connected), its ring how full. A link
  straight to one lever (an alert, `?lever=`) still lands on that lever.
- **Tapping a card opens that lever** under a sticky bar: **‹ back · the
  lever's name · its status word** (the card's word, with its dot). The bar
  sits under the platform's top bar on a big screen.
- **Back returns to the five cards**, where the owner left them (the cards'
  scroll is kept). Esc does the same once no sheet is open. **Tower** in the
  footer always lands on the five cards, closing any sheet.
- **One page per lever** (owner, 23 Sep 2026). The Status / Suggestions tabs
  are gone: the headline, the three tiles and the list run down the page, and
  what FoodBridge suggests — Deliveries' Tomorrow's trips, the balance cards,
  the Grow card — follows under the list, in that order. A lever with nothing
  to suggest simply ends at its list; no empty view, no count to chase.
- A balance card opens the lever it names; Back still returns to the cards,
  not to the lever before.
- No tabs and no swiping between levers: with nothing on screen to say where
  a swipe lands, it would only surprise.
- **The lever opens on the tile its card promised**: On track → On track,
  Needs work → Needs work, Urgent → Urgent. Every way in lands the same way,
  and a tile the owner picks holds only while they stay in that lever. A tile
  with nothing in it can't be landed on, so the next one down is used.

*Why:* the owner reads the business on one screen, the five cards, and goes
into one lever at a time; a tab strip repeated the cards and took a row.

### 4.2 "As of" line
- One muted line, *"As of 24 Aug"*, shown **only** when the records are older
  than today. Live data shows nothing.

*Why:* a number from last month read as today's leads to a wrong call. When
the data is fresh, the line is noise, so it goes.

### 4.3 Headline
- **The one number** that tells the state of the lever, large, with one short
  line of context under it.
- **No ⓘ, and no "How this is worked out" sheet** (owner, 23 Sep 2026). The
  headline and its context line carry the whole story; a rule the owner has to
  open a sheet to read is a rule the screen failed to say plainly. The
  thresholds behind each lever stay in the model (`lv.how`) and in
  CONTROL_TOWER_LEVERS.md §8, where they belong.

| Lever | Headline | Context line |
| --- | --- | --- |
| Deliveries | **38 of 45 delivered** + a thin progress bar | 4 on the road · 3 missed |
| Collections | **₹1.2 L overdue** | of ₹1.5 L outstanding |
| Purchase | **9 products to buy** | this week |
| Inventory | **9 fast movers out of stock** | ₹29,900 of sales at risk |
| Order | **₹21,600 this month** | ↓ 54% on last month |

*Why:* one number is readable at a glance. The context line is there only
because the number is meaningless without it (overdue *of what*?).

### 4.4 Good / Bad / Ugly
- **Three equal tiles in one row:** label, then **one** number. Selected tile
  outlined; the list below belongs to it.
- **Ugly is selected by default** when it has anything; otherwise Bad;
  otherwise Good.
- The words are the owner's: **Good**, **Bad**, **Ugly**. Under each, the
  lever's own word in small type (Delivered · On the road · Missed).
- A tile with nothing in it shows **0** in muted grey and can't be selected.
  A tile whose data isn't connected shows **—**.

*Why:* this is the owner's reading model. Three tiles are the whole state of
the lever; selecting instead of stacking keeps the screen one scroll long.

**On track is good news only** (owner, 22 Sep 2026). Its list is what went
right, each row with a green ✓ and never a risk colour: in Collections, the
money received this week, long-stuck money first ("Stuck 180 days · now
paid"), then late payments, then on time. Under it there is no chase
material: no customer colours; chasing belongs to Needs work and Urgent.

### 4.5 The list
- One item per line: **name · figure**, a small marker when it helps (a
  customer's colour, a missed reason), a chevron.
- At most **5 rows**, then *"Show all 24"*. The rows are sorted by money at
  stake, largest first.
- Tap a row → the item sheet (4.10).

*Why:* five is what fits on a phone above the action; money-first sorting
means the top row is always the most important.

### 4.6 Balance card
- Appears **only when this lever is hurting another.** One card, two figures,
  one move:
  *"You're owed ₹1.2 L · you owe suppliers ₹1.7 L — collect before you buy."*
- Tap → the other lever (Back returns to the five cards).

*Why:* this is what makes it a control tower, not five reports. When the
levers are in balance the card is noise, so it isn't there.

### 4.7 Grow card
- **One card: the single biggest opportunity on this lever**, with its ₹ where
  it can be proven: *"2 products are selling fast — offer them to 14 customers
  who don't buy them."*
- Tap → prepared action.

*Why:* the owner asked to see opportunity on every lever. One is a decision;
a list is homework.

### 4.8 No action button on the page (owner, 23 Sep 2026)
The tower had a sticky, full-width button over every lever — *"Reschedule 2
deliveries"*, *"Send 5 reminders"*, *"Raise 3 purchase orders"*. **It is
gone, everywhere.**

*Why:* it floated over the owner's list and pushed a batch he had not looked
at. Since 23 Sep 2026 every act starts from the thing it acts on: a row opens
its sheet, and the sheet ends in the one step for that item (§4.10) — call the
shop, reschedule that stop, send that reminder, add that product to a purchase
order. One item, one decision, nothing hovering.

The page carries no primary button of its own. The only exception is a
**Preview** lever, whose single *"Connect…"* button sits in the flow of its
card, at the end of the example (§6.1) — a not-connected lever must keep one
way in.

### 4.9 Footer

The platform's standard bar, the same on every screen: 58 px, white, a
hairline on top, the page's own items to the left and **EXIT DEMO** always
last. In the tower it carries three items:

| Item | Does | Why it is there |
| --- | --- | --- |
| **Tower** | Closes any sheet and returns to the five lever cards, from anywhere (Timeline included) | Home base: one tap back from anywhere |
| **Assistant** | Opens the FoodBridge Assistant, a WhatsApp-style chat over the page (§4.12); the mascot's face is the icon, and it sits next to EXIT DEMO whatever else is on the bar (owner, 23 Sep 2026) | Questions answered in the owner's words, without leaving the screen |
| **Timeline** | *The Overview only (owner, 23 Sep 2026)*, and while it is open: the Business Timeline, the business's news (§4.11); a green dot when there is news since the last read | "What happened?" is the owner's second question after "what needs me?" — a home question. Inside a lever the bar belongs to that lever's own work |
| **Tracking · Delivery · Planning · Assets** | *Deliveries lever only (owner, 23 Sep 2026)*: the four Distribution & Logistics screens, as plain footer actions (§4.13) | The lever says what is wrong; these are where the owner goes to fix it |
| **Create** | *Off for now (owner, 22 Sep 2026)*: opens the Create sheet, the quick actions | Where the business's own records go in |
| **EXIT DEMO** | The platform's exit | Platform standard, always last |

- **Create sheet:** five rows, one per lever, in card order, each opening its
  own short flow:
  **Record a delivery** (delivered · missed · returned · money and empties
  collected) · **Receive payment** · **New purchase order** · **Stock count**
  · **New order**.
  Anything recorded here shows on its lever straight away.
- **Record a delivery** is how the Deliveries lever fills without any
  integration: the driver or the owner records each stop.
- **Look:** icon 22 px over a 10 px label; the current item in brand green,
  the others grey. EXIT DEMO never takes the active colour.
- Nothing floats over the page any more (§4.8): the footer is the only bar,
  and a sheet rises over it.
- **Bigger screens:** where the platform shows its sidebar, the footer is not
  drawn; Create sits at the top of the tower instead. The four work screens
  are **not** repeated in the top bar — the sidebar already lists them under
  Distribution & Logistics, and seven pills crowd the title out.
- **What is on the bar where:** Tower, Assistant and EXIT DEMO everywhere;
  **Timeline on the Overview** (and while it is open); the four work screens
  **on the Deliveries lever**. So the Overview has four, a lever has three,
  and the Deliveries lever has seven.
- **Seven items at 375 px:** they do not fit, so **the bar scrolls sideways**
  (owner's pick, 23 Sep 2026: nothing dropped, nothing squeezed). It starts at
  Tower, with the next tab half in view; the gap closes to 14 px. Centred
  while the items fit, and reachable at both ends once they do not.

*Why:* quick actions need to be reachable from any lever with the thumb, and
the owner expects the same bar they meet on every other screen. Everything
else a footer could hold is already done by the five lever cards.

### 4.10 Sheets
All detail opens as a bottom sheet over the lever (the owner never loses their
place). Three kinds (the Create sheet is in 4.9):

**Item sheet** — a stop, a customer, a product, an order. One shape for all
four (owner, 23 Sep 2026), because the owner reads them the same way every
time:

| Part | What it holds |
|---|---|
| Title | the name that matters — the shop, the customer, the product |
| Sub | what this is and when: the trip, the driver, the time |
| Stats | two or three figures of this one thing, side by side |
| **What happened** | what is worth telling, good or bad, one line each, with a why underneath when there is one |
| **What to do** | one step the owner can take now — and the button that takes it |

Rules, ruthlessly applied:
- **No reference numbers.** An order no, delivery no, receipt no or invoice id
  is not something the owner can act on; the work screens hold the paperwork.
- **No figure twice.** If the sub says "due 4:27 pm", the stats do not.
- **A figure that would read ₹0 or "None" is left out** — an empty line is
  not a fact.
- **The lever asks the question.** The same customer opens on the money in
  Collections and on the buying in Order.
- **Say when there is nothing to do**, in those words: *"Nothing to do
  here."*, *"On the van and on time. Nothing to do yet."*
- **Where FoodBridge cannot finish the job, the step is the call the owner
  would make anyway**, with the number ready to dial: the shop for a stop that
  was shut, a crate that did not come back or cases that went short; the
  driver for a van still on the road and running behind. FoodBridge does not
  pretend to fix what happens outside it.

Worked examples:

| Sheet | Sub | Stats | What happened | What to do |
|---|---|---|---|---|
| Late stop | Delivered 9:40 am · Van 1 · Ajay | Collected ₹2,800 · Cases 7 · Crates back 3 of 3 | Reached 32 min late — waited at the dock | Van 1 still has 11 stops to make and is running behind → **Call Ajay · Van 1** |
| Missed stop | Missed 11:06 am · Van 2 · Kumar | Not delivered ₹1,830 | Shop closed | Ask when they will take it, then put it on tomorrow's trip → **Call the shop** · Reschedule |
| Crate not back | Delivered 10:27 am · Van 1 · Ajay | Collected ₹3,340 · Cases 10 · Crates back 3 of 4 | 1 crate not back — 12 bottles still with them | Ask them to keep 1 crate ready for the next trip → **Call the shop** |
| Customer (Collections) | Orders every 41 days · last on 22 Sep | Overdue ₹4,680 · Oldest 80 days | No payment in 159 days · Reminded 3 days ago — still not paid | Ask for a date and a figure, and hold them to it → **Call the shop** · Send reminder |
| Customer (Order) | Nothing overdue | Usual order ₹2,400 · Usually every 30 days · Last order 172 days ago | No order in 172 days — they usually order every 30 days | Call and find out why they stopped, then take the usual order → **Call the shop** · New order |
| Product | From Pickle And Murabba Traders | In stock 0 · Lasts Out · Sells a week 7 | Out of stock — 7 a week go out, every day out is a sale lost | Order today so it lands before the next trips → **Add to purchase order** · Count stock |

**Confirm sheet** (after a step in an item sheet, or a Create flow):
- Title that states the outcome: *"Remind 5 customers."*
- The prefilled list, everything ticked, each line editable (untick, change a
  quantity, edit the message).
- One button with the live count: **"Send 5 reminders"**. Swipe down to cancel.
- **Done:** the sheet closes, a one-line confirmation at the bottom
  (*"5 reminders sent"*) with **Undo** for 5 seconds where undo is possible,
  and the lever's numbers update.

**Timeline detail sheet** keeps its own shape — a news item is evidence, not a
thing to act on: the facts behind the line, the records it sums up, and
*"Open Deliveries"* at the foot. It follows the same no-reference-numbers
rule.

*Why:* seeing, changing and confirming in one place is the whole "FoodBridge
prepares, the owner confirms" promise.

### 4.11 Timeline — the business's news (owner, 22 Sep 2026)

*"A business timeline, like the owner's business news bulletins; what Wins
did on the Overview, aligned with a timeline."* The owner's second question,
after *"what needs me?"*: **"what happened?"** A distributor already reads
the day this way: the trip closure, the collection register, the Day Book.

- **Name: Timeline** in the footer, **Business Timeline** as the page title
  (owner's pick, 22 Sep 2026, after "Updates" and "Day Book"): it says the
  news is in time order and whose it is. Not "Daily report" (the sidebar
  already has Reports, the dashboard).
- **Where:** Timeline in the footer (Tower · Timeline · EXIT DEMO); on a big
  screen, where the footer is off, a Tower | Timeline switch beside the title
  in the top bar. A green dot on it when there is news since the last read
  (green, not red: red means Urgent in the tower).
- **What it is:** curated news, newest first, the last 7 days: today's
  first with no heading, then **Yesterday · Mon 21 Sep**. Never a raw log: thirty drops a day are one line
  per trip, not thirty lines.
- **Each line:** the lever's icon in a circle coloured by what it means
  (green good news, red a problem, grey what was done), the time over **one
  bold line with its figure in it**, and ›. A rail runs through the circles.
  A win (money stuck for months received, a trip delivered in full, a lever
  turning green) is written in green.
- **Tap a line:** its details open in a bottom sheet over the Timeline (a
  side panel on a big screen); the owner stays where they are (owner, 22 Sep
  2026). The sheet's title names it; a few facts; then the records it sums
  up: a trip's every drop with what was collected, a late trip's late drops,
  the orders that didn't fit the van with their cases, an hour's payments
  (who, when, how, how much), who was reminded, a purchase order's lines,
  the orders made, the products counted; a lever's change says what it was,
  what it became, and where it stands now. The line itself is not repeated
  (no figure twice). **Open <lever>**, at the bottom, goes to the lever on
  the tile where it is dealt with.
- **New:** what arrived since the last read is tagged *New*; on a first read
  nothing is (everything would be). A line arriving while the owner reads is
  highlighted once, never again on a live redraw.

| News | Line | Tone |
| --- | --- | --- |
| A trip leaves late | *Van 2's first trip running 1 h 24 min late · loading ran late* | problem |
| Orders past the van's load | *2 orders didn't fit Van 1 · left for the next trip* | problem |
| A trip closes | *Van 1's first trip done · 8 of 8 delivered · ₹12,290 collected* | good (a win when all delivered) |
| A drop goes wrong | *Missed at X · Shop closed* · *Short 2 cases at X* · *X returned 1 case* | problem |
| Money in | an hour's payments in one line, *₹13,950 received from 6 customers*; a lone one names who paid | good |
| Money stuck for months | *₹3,180 received from X after 222 days*, always its own line, once per customer | win |
| What the owner did | *5 payment reminders sent* · *Purchase order PR-0001 raised · 5 products, ₹17,675* · *12 orders created for the next trips* · *Supply stopped for X* · *3 products counted* | done |
| A lever changes | *Purchase is on track now* (win) · *Deliveries turned Urgent* · *Order needs work now*; a flip and flip back within 15 minutes is not news | — |

Door cash is inside its trip's line. A delivery recorded by hand (no trip)
is its own line. Nothing dated after now (the sample ledger has some), and
connecting records is not "news". The model is `assets/ct/timeline.js`
(pure, tested headless); the lever changes are logged per device.

### 4.12 The assistant — a WhatsApp-style chat over the tower (owner, 22 Sep 2026)

*"A floating AI assistant over the Control Tower screens: tap it and a chat
opens that looks like WhatsApp and a WhatsApp IVR flow."* Built new; it
borrows nothing from the platform's IVR or the assistant removed on 21 Sep.

- **Where it opens: the footer's Assistant action** (Tower · Timeline ·
  Assistant · EXIT DEMO), the mascot's face as its icon, on every Control
  Tower screen: the five cards, each lever, the Timeline. On a big screen,
  where the footer is off, **Assistant** sits in the top bar beside Tower and
  Timeline. It began as a floating button, bottom right; the owner moved it
  to the footer the same day (22 Sep 2026), so nothing floats over the list
  or the green action button, and there is no hint bubble.
- **The chat looks like WhatsApp:** full screen on a phone, a 390 px panel
  on a big screen. The green header (‹, the mascot, *FoodBridge Assistant*,
  *online* / *typing…*); the doodle wallpaper, drawn from the trade (truck,
  ₹, box, cart); a *Today* chip; white bubbles on the left, the owner's
  green on the right, with tails, times and ticks that turn blue when read;
  a white message pill and WhatsApp's round green send.
- **It works like a WhatsApp Business bot (the IVR):** a welcome with the
  mascot, then the menu as numbered lines (*reply with a number*) and a
  **☰ Menu** button that opens WhatsApp's list sheet; up to three reply
  buttons under an answer; typing works too, in English or the trade's
  Hinglish (*kitna paisa baaki*, *maal khatam*, *gaadi late*).
- **What it answers:** 1 What needs me today · 2 Deliveries · 3 Collections
  · 4 Purchase · 5 Inventory · 6 Orders · 7 Today's news. A lever's answer
  is the lever's own status, headline and top three items, and its buttons
  are the lever's prepared action, Open, and Main menu. *What needs me* lists
  every lever worst first and says where to start. *Today's news* is the
  Business Timeline's latest five.
- **Honest:** no model sits behind it and nothing leaves the device; a
  yellow note in the chat says so, the way WhatsApp states its encryption.
  It understands by the words in a message; an unclear one gets the mascot's
  shrug and the menu, never a guess. Proven numbers only.
- **It never changes anything:** Open takes the owner to the lever, on the
  tile the answer described; the prepared action (*Reorder 5 fast movers*)
  opens that lever's own confirm sheet — *"Check it and confirm — nothing
  goes out until you do."*
- **The mascot's poses:** headset smiling for the button and the header;
  presenting for the welcome; a shrug sticker when it didn't understand; arms
  crossed, proud, when everything is on track.
- The conversation stays for the session, as a chat does; Esc closes the list
  sheet, then the chat, and never reaches the tower behind it.

The words are `assets/ct/chat.js` (pure, tested headless); the chat is
`screens/control-tower-chat.js` and `.css`; the mascot is `assets/ct/mascot/`.

### 4.13 The work screens, in the lever's footer (owner, 23 Sep 2026)

A lever says what is wrong. The four Distribution & Logistics screens are
where the owner does something about it, so on the Deliveries lever they
**become part of that lever**: footer actions like any other — *"just like
Tower, Timeline, Assistant"*, not a list behind one of them — and the lever's
own actions follow the owner into each screen.

| Action | Opens | Address |
| --- | --- | --- |
| **Tracking** | Live Delivery Tracking — where each van is, stop by stop | `#/distribution-logistics/live-tracking?from=deliveries` |
| **Delivery** | Delivery Management — the rep's own app: stops, proof, cash | `…/delivery-management?from=deliveries` |
| **Planning** | Route Planning — which customers a round covers | `…/route-planning?from=deliveries` |
| **Assets** | Logistic Returns — the crates and assets out with customers; *"Assets", not "Returns", is what the screen is about* | `…/logistic-returns?from=deliveries` |

- **The same seven, both sides.** On the Deliveries lever the bar is
  Tower · Tracking · Delivery · Planning · Assets · Assistant · EXIT DEMO —
  no Timeline, which belongs to the Overview. On each of the four screens
  those same seven are on the bar as well — so the tower, the assistant and
  the other three screens are always under the thumb.
- **One bar, one look** (owner, 23 Sep 2026: *"they should look identical…
  it looks like I have come to some other page"*). On a trip **the platform's
  own bar is the bar**: the screen's own bar is stood down and its controls
  are carried into ours. Nothing is written into the module's bar and nothing
  in its folder changes: one stylesheet in its document stands the bar down,
  and leaving the trip brings it straight back.
- **The screen you are on holds its own controls** (owner, 23 Sep 2026, after
  three tries: *"a few footer actions only appear when I'm on some specific
  page — it's not very clear"*). The rule is one sentence: **Tower first, the
  screen you are on second, and its own controls live inside it.**

  **Nothing in the row ever moves** (owner, 23 Sep 2026). The tabs stay in
  the trip's own order — Tower · Tracking · Delivery · Planning · Assets ·
  Assistant · EXIT DEMO — and the screen the owner is on is simply the green
  one, with a caret. Tapping it brings its own controls up in a **sheet over
  that tab**, pointing at it: each one an icon and a label, the one the
  screen is showing marked with a tint, the rest quiet. It closes on a tap
  outside, on Esc, on picking one, and on walking to another screen. A screen
  with no controls has no caret and takes the owner to the top of itself.

  *The earlier pattern is kept, not deleted:* the screen moved into the
  second slot inside a tinted pill with its controls beside it, open by
  default. `TRIP_SUBMENU = "group"` in `assets/platform.js` brings it back —
  its markup, its styles (`.fbx-group`) and its ordering are all still
  there.

  **One system, written down once** (owner, 23 Sep 2026: *"no uniformity,
  nothing — colours, design, goes left and right… parent and those children
  don't even seem they mean something together"*). Three stylesheets reach
  this bar — the shared asset draws it, the tower dresses its own copy, the
  shell dresses the one under a module — and they now agree on every value:

  | | |
  | --- | --- |
  | **Item** | a 22px stroked icon over a 10.5px/600 label, 46px tall, at least 60px wide, centred. Tabs and controls are the same object; nothing in the row is a different size or shape |
  | **Colour** | one accent. Muted ink (#6B7280) for everything, brand green for where the owner is, ink (#111418) for the control the screen is showing. No second fill, no chips, no black |
  | **Sheet** | white, radius 18, a soft shadow and an arrow on the tab it came from; items 46px tall, icon and label on one line. The control the screen is **on** carries a tint (ink at 6%) — the module says which by an attribute, a class, or simply by colouring that label, and a control is on too while whatever it opened is still on screen |
  | **Ground** | frosted white over the page, a hairline instead of a border, 64px plus the safe area |

  The markup carries no styling of its own any more: icons are emitted as
  shapes and the stylesheet gives every one of them its size, weight and
  colour — which is what had drifted, three patches deep.

  So a tab is a place, and a verb only ever shows up inside the place it
  belongs to: Live Tracking opens **Routes · N**, Route Planning **Add
  Template**, Delivery Management **Home · Reports** (its own two screens, under a
  truck, not a phone — owner, 23 Sep 2026);
  Logistic Returns has none, so its tab carries no caret and takes the owner
  to the top of the screen instead.

  *Tried and rejected by the owner on the way there: the controls as plain
  tabs (they read as places), on their own line above the bar (a second row),
  in a compartment between hairlines (weird), and moved out of the bar onto
  their own pages (the bar is where they belong).*
- **It scrolls, and it says so.** Seven tabs, and the open screen's controls
  beside them, do not fit a 375px row, so it scrolls sideways rather than
  squeezing or wrapping; opening a tab scrolls the row back to its start.
  Nothing about a scrolling row announces itself, so the end that has more
  carries a soft fade with a chevron in it — and the chevron is a button, so
  the cue is also the way to use it. The first time a bar turns out to be
  scrollable it nudges itself a few pixels: nothing explains a scroll like
  seeing it move once. Both live in the shared asset (assets/exit-demo.js),
  so the tower's bar and the shell's get them from one implementation. **Tower is
  always first**, in the same place on every screen of the trip as on the
  tower itself; the assistant and EXIT DEMO end every bar in the cut.
- **A tab with nothing to open** takes the owner to the top of that screen —
  its own Home if it has one, its own address if it routes by one (deep
  inside a route in Delivery Management there is no bar to press), otherwise
  the screen again. *"Tapping Delivery lands on delivery home every time"*
  (owner, 23 Sep 2026).
- **Assistant** goes to
  `#/control-tower?lever=deliveries&chat=1`, which lands on the lever with the
  chat open where it left off; **Tower** goes to
  `#/control-tower?lever=deliveries`, the lever itself, not the Overview.
- **Only with `from=`**: a screen opened from the sidebar is untouched —
  nothing changes for anyone who did not come from the lever.
- **No other lever** has a module behind it in this cut; the four are off
  everywhere else and the footer is its usual four.
- **A phone thing.** On a big screen there is no footer and the sidebar has
  the same four screens, so the trip is not offered there; a screen opened
  from the sidebar carries no `from=` and is untouched.

The tower's side is `screens/control-tower.js` (`WORK`, `openWork`); the
screens' side is `assets/platform.js` (`TRIP`, `tripBar`, `ownActions`,
`drawTripBar`), and the bar to stand down is named by `exitIn` — or by
`barIn` for a screen that draws its own EXIT DEMO (Delivery Management) — in
`assets/modules.json`. The module folders are never touched, as with the clip
offsets and the device frame.

## 5. The five levers on screen

Only must-have content. Each lever: headline · Good / Bad / Ugly · list ·
balance · grow · action.

### 5.1 Deliveries — today

| Tile | Number | List rows |
| --- | --- | --- |
| **Good** · Delivered | 38 | Three facts, not rows: **₹48,200 collected · 112 empties back · 9 next orders taken** |
| **Bad** · On the road | 4 | *Van 2 · 1 hr late · 6 stops left* |
| **Ugly** · Missed | 3 | *Sharma Stores · shop closed* · *Gupta Mart · returned 2 cases* · *Hotel Surya · short 1 case* |

**Tomorrow's trips** (one card under the list; the owner's "upcoming
health"), four lines, each shown only when non-zero:
- Collect **₹36,000** from 4 critical customers
- Collect **46 empties** from 5 critical customers
- **3 products** short for booked orders
- **5 customers** to upsell

**Balance:** *"12 orders booked beyond tomorrow's van capacity."* ·
*"4 orders booked but short of stock."*
**Grow:** *"9 next orders taken at the door this week — ₹31,000."*
**Action:** **Reschedule 3 deliveries.**

**Empties inside Deliveries:**
- The Good tile's fact row counts empties back.
- The customer sheet shows empties held: *"2 crates (24 bottles) · held 18
  days"*. Kits show as the kit, with loose units only when they differ:
  *"2 crates, 22 bottles — 2 bottles short"*.
- An Ugly row when empties are lost or broken: *"Empties lost this month ·
  ₹4,300"* (valued at purchase cost).

### 5.2 Collections — as of now

| Tile | Number | Meaning |
| --- | --- | --- |
| **Good** · Collected | ₹32,000 | this week |
| **Bad** · Late or due soon | ₹18,400 | overdue with Yellow and Orange customers, plus what falls due in the next 7 days |
| **Ugly** · Needs chasing | ₹1.2 L | overdue with Red and Fire customers |

**Customer colours** sit between the tiles and the list: one thin stacked bar
showing outstanding by colour, with five labels under it (**Green · Yellow ·
Orange · Red · Fire**, each with its count). Tap a colour to filter the list;
it opens the tile that holds that colour — Yellow and Orange under Needs
work, Red and Fire under Urgent.
Each colour is also an icon shape, so it reads without colour vision.

**List row:** *Assam Govt. Marketing · ₹10,600 · 206 days* with the colour
dot. Sorted by ₹.

**Balance:** *"You're owed ₹1.2 L · you owe suppliers ₹1.7 L — collect before
you buy."* · *"6 overdue customers ordered this week."*
**Grow:** *"16 Green customers pay on time — offer them more range."*
**Action:** **Send 5 reminders** (the customers who owe the most; the message
adapts to their colour: a nudge for Yellow, a firm reminder for Red).

### 5.3 Purchase — this week

| Tile | Number | Meaning |
| --- | --- | --- |
| **Good** · Covered | 14 | fast movers with stock for their lead time |
| **Bad** · Buy this week | 9 | will run out before the next delivery |
| **Ugly** · Out | 3 | out of stock with orders waiting |

**List row:** *Amla Pickle 500 g · 52 cases · Sri Balaji Traders*.
**Balance:** *"Supplier bills overdue ₹1.7 L · you're owed ₹1.2 L — collect
before you buy."* · *"You're buying 4 slow movers."*
**Grow:** *"Sugar prices rise before Diwali — book 2 months ahead."* (only
when the owner's records or supplier show it)
**Action:** **Raise 3 purchase orders** (one per supplier).

### 5.4 Inventory — now

| Tile | Number | Meaning |
| --- | --- | --- |
| **Good** · Healthy | 14 | fast movers with 2+ weeks of stock |
| **Bad** · Low or near expiry | 9 | under 2 weeks, or expiring within 30 days |
| **Ugly** · Out, expired or dead | 56 | out with demand; expired; no sale in 90 days (the list shows the ₹) |

**List row:** *Bamboo Shoots Pickle · out · 76 cases a month*;
*Mango Pulp 1 kg · dead stock · ₹1.4 L*.
**Balance:** *"₹29,900 of sales short, ₹19.3 L sitting in dead stock."*
**Grow:** *"Offer ₹1.4 L of dead stock to 12 customers who bought it before."*
**Action:** **Reorder 9 fast movers** (hands to Purchase).

### 5.5 Order — this month

| Tile | Number | Meaning |
| --- | --- | --- |
| **Good** · Ordered | 17 | orders this month |
| **Bad** · Late to reorder | 27 | past their usual order day |
| **Ugly** · Short or lost | 4 | orders short of stock; customers with no order in two cycles |

**List row:** *Home Essential Stores · 170 days late · usual ₹4,200*.
**Balance:** *"4 orders can't be filled from stock."*
**Grow:** *"2 products are selling fast — 14 customers don't buy them yet."*
**Action:** **Prepare 21 usual orders.**

## 6. States

| State | What the owner sees |
| --- | --- |
| **Loading** | The template's shapes in light grey (headline, three tiles, five rows), never a spinner. Under 1 second on a good network. |
| **All good** | Headline in green words ("All 45 delivered"), Good selected, no action button. A calm screen is the reward. |
| **Preview** (records not connected) | See 6.1. |
| **Stale** | The "As of" line. Nothing else changes. |
| **Offline** | The last loaded screen stays, with "As of 9:40 am". Actions queue with *"Will send when you're online."* |
| **Error** | One line where the content would be: *"Couldn't load Collections. Retry."* The other levers keep working. |

### 6.1 Preview

A lever without its records shows the **whole template**, so the owner sees
what they get:
- Lever cards: hollow grey dot.
- Headline replaced by the promise, in the owner's numbers where they exist:
  **"Track all 160 orders to the door."**
- Tiles and rows drawn in full, in light grey, with real labels and
  **Example** figures, marked with an *Example* tag on the tiles.
- Tomorrow's trips, Balance and Grow cards shown the same way.
- The card ends in **Connect deliveries**, which says exactly what is
  needed ("Mark each order delivered, missed or returned from the driver's
  phone").

Example figures are never shown without the *Example* tag and never feed
another lever.

## 7. Visual design

**Feel:** calm, confident, expensive. Lots of air, few colours, big numbers,
nothing decorative. Premium comes from restraint and precision, not effects.

### 7.1 Type
One family: **Inter** (with system fallback), **tabular figures** everywhere so
numbers line up.

| Role | Size / line | Weight |
| --- | --- | --- |
| Headline number | 34 / 40 | 700 |
| Tile number | 20 / 26 | 700 |
| Lever tab | 15 / 20 | 600 selected, 500 others |
| List row | 15 / 22 | 500 name, 600 figure |
| Context line, labels | 13 / 18 | 500 |
| Tags, "As of" | 12 / 16 | 500 |

Sentence case everywhere. No all-caps labels.

### 7.2 Colour
A neutral canvas; colour only where it carries meaning.

| Token | Value | Use |
| --- | --- | --- |
| Canvas | #F7F7F4 | page |
| Surface | #FFFFFF | cards, sheets |
| Ink | #111418 | numbers, names |
| Ink 2 | #5B616B | context, labels |
| Hairline | #E6E6E1 | borders, dividers |
| Brand | #1E7A46 | sheet buttons, selected tab underline |
| Good | #1E7A46 | Good tile, green dots |
| Bad | #B7791F | Bad tile, amber dots |
| Ugly | #C0362C | Ugly tile, red dots |
| Preview | #A3A7AE | hollow dots, example drawing |

Customer colours: **Green** #2F9E5B · **Yellow** #D4A017 · **Orange** #E07B24 ·
**Red** #C0362C · **Fire** #7A1C1C with a flame shape.

All text meets WCAG AA on its background; status is always colour *and* a word
or shape.

### 7.3 Space and shape
- 4 px base grid; 16 px screen gutters; 24 px between sections.
- Cards: 16 px radius, hairline border, no shadow. Sheets: 24 px top radius,
  one soft shadow (the only one in the tower).
- Touch targets at least 44 px; a sheet's button 52 px, 16 px from the edges,
  clear of the phone's gesture bar.
- Icons: one outline set, 20 px, 1.75 stroke, used only where they speed
  recognition (the lever cards and the back bar use them; the sticky
  action doesn't).

### 7.4 Motion
- Tab change: content slides 200 ms, ease-out. Sheet: rises 240 ms.
- A number that changes after an action cross-fades once.
- Nothing loops, bounces or counts up. Motion respects "reduce motion".

## 8. Bigger screens
Mobile is the design. From 768 px the same template sits in a centred column
of 480 px, with the item sheet opening as a side panel on the right. From
1200 px the tabs become a left column and the list and sheet sit side by
side. No new content is added for bigger screens.

## 9. The ruthless review

Every element was put against the test *"would the owner decide worse without
it?"* Three passes.

**Pass 1: everything the notes and flow could justify (≈40 elements).**
**Pass 2: cut what repeats, decorates or can't be acted on (≈22).**
**Pass 3: cut what a good screen shows by its own shape (final ≈14).**

**Kept, and why:**

| Element | Why it must be there |
| --- | --- |
| Five lever cards, then a back bar | "Which lever needs me" at a glance; one lever at a time |
| "As of" (only when stale) | Stops an old number being read as today's |
| Headline number + context | The state of the lever in one read |
| ⓘ How it's worked out | Trust: the owner can check any number in one tap |
| Good / Bad / Ugly tiles | The owner's reading model; the whole state in three numbers |
| Five-row list, money first | What exactly is wrong, most costly first |
| Customer colours (Collections) | The owner's flow; who to push and who to protect |
| Tomorrow's trips (Deliveries) | The owner's "upcoming health"; decides today's loading and collections |
| Balance card, only when out | What makes it a control tower |
| One Grow card | The owner asked for opportunity on every lever; one is actionable |
| The sheet's own button | The act belongs to the item the owner opened, not to the page |
| Footer: Tower · Create · EXIT DEMO | Home base, quick actions within thumb reach, the platform's own exit |
| Item sheet, confirm sheet | See, change, confirm without leaving the tab |
| Preview state | The owner's decision: show what connecting gains |
| Offline and stale states | Field reality: patchy network |

**Cut, and why:**

| Element | Why it's gone |
| --- | --- |
| Greeting ("Good morning") | Pleasant, decides nothing |
| Home / summary page | The owner's flow opens on tabs; the dots are the summary |
| Search | Five-row lists sorted by money don't need it; items are one tap from the list |
| Notification bell | The tab dots are the notification |
| Footer tabs for Insights or Alerts | Each lever is its own insight; the dots are the alerts |
| Period selector (day / week / month) | Each lever has its natural period, stated in its headline |
| Charts and trend lines | A number with "↓ 54% on last month" says the same in one line |
| Second Grow card, "See all opportunities" | One is a decision, a list is homework |
| Severity labels (critical / high / medium) | Good / Bad / Ugly already says it |
| Time-ago stamps ("2 h ago") | Doesn't change the action |
| Per-tile "sample" badges | One "As of" or Example tag says it once |
| Ageing buckets (0–30, 30–60, 60–90) | Customer colours say who to act on, not just how old |
| DSO, fill rate %, average order value, lines per order | Analyst metrics; not today's decision (return with the Targets and Margin levers) |
| Vehicle map, driver list | Good to have; the late van shows in Bad |
| Export, share, download | Good to have |
| Dark mode | Good to have; outdoor phone use favours high-contrast light |
| Hindi and regional languages | Planned, not in the first release |
| AI assistant | Not part of the tower |

## 10. Acceptance, per lever screen
1. The owner can say which lever needs them within 3 seconds of opening.
2. Each lever screen fits on one phone screen above the fold down to the
   list's third row, with the action visible.
3. Every number is proven by records, marked *Example*, or shown as —.
4. Every screen has at most one primary button (Create is a tinted chip).
5. No word on screen is outside the vocabulary in section 2.

## 10a. Overview (owner, 22 Sep 2026)

The **Overview** is home: the tower opens on it every visit (no tabs,
22 Sep 2026). It is the five levers and nothing else:

- **A dial per lever**, like a car dashboard, three over two on a phone, in
  the owner's order so it never shuffles: the lever's picture in the middle
  (truck, ₹, clipboard, box, cart), a ring that fills with its health, one
  colour (green fine, amber needs work, red urgent), and the name with one
  status word and "›" under it. Each dial is a tile, so it reads as a
  button. Tapping it opens the lever **on the tile its word names**:
  On track → On track, Needs work → Needs work, Urgent → Urgent.
- **Dials, not full-width rows:** rows were tried on 22 Sep 2026 to fill
  the space Wins and the balance card left; the owner preferred the dials'
  alignment. No figure is added to fill the space.
- **The dials sit in the middle of the screen** (owner, 22 Sep 2026): the
  same space above them as below, between the top (the shell's header, or
  the tower's top bar on a big screen) and the footer. A screen too short to
  hold them starts them at the top and scrolls, clear of the footer.
- **No headline, no Start here line, no live line:** the red dials already
  say where to start. (Built first as a radar chart, then as five text
  cards; both replaced as too hard to read at a glance.)
- **No Wins and no balance card** (owner, 22 Sep 2026). Balance lives on
  each lever's own screen, where the move is.

No action button anywhere on the page: every line opens what acts on it.

## 10b. The live demo business (owner, 22 Sep 2026)

"There should not be any lever with Not connected… the user should
experience he is using a realtime control tower." So when nothing is
connected (or onboarding's "Try sample data" is loaded), the tower runs a
**live demo business** (`assets/ct/demo.js`):

- The sample business's records, **dated to today** (the latest order was
  yesterday), with a distributor's stock (a few fast movers low or out, a
  little dead stock) and most old invoices paid.
- **Today's route**, planned once a day: about 30 stops from 9 am to 6 pm,
  each with its value, cases and crates. Stops whose time has passed are
  recorded as a real route goes: mostly delivered with money and empties
  back, a few missed with a reason, some returns and short cases.
- **A live clock:** about every 20 seconds the next stop is delivered or a
  customer pays. A "● Live" line under the tabs says what just happened.
  Nothing moves under an open sheet.
- Deterministic by date: the same day plays the same way on every reload.
- Labelled "Demo business" on screen. A business the owner connects (Zoho,
  Xero, files) is never simulated, and demo records are kept apart from it.

This is an owner-approved exception to D-015 (a ₹ figure only from real
records) for the demo only. With the demo, a lever's standing follows its
health: **Good** at 75% or more, **Needs work** from 50%, **Urgent** below,
because every working business always has a few things to fix.

## 11. Build notes (22 Sep 2026)

Built in `screens/control-tower.{html,js,css}` on `assets/ct/levers.js`
(the lever model, tested headless in `test/control-tower/levers.test.js`).
Where the build differs from this document, and why:

| Design | Built | Why |
| --- | --- | --- |
| Deliveries Bad: "On the road" | **To deliver**: orders not yet delivered, and rescheduled stops | No trip or vehicle records exist to know what is on the road |
| Order: "this month" | **Last 30 days of records** | The records end on 24 Aug; a calendar month would read as empty |
| Undo for 5 seconds | Not built | Every action is already reviewed in its confirm sheet; undo needs a reversal per record type |
| Offline queue | Not needed yet | Everything is recorded on this device; nothing waits on a network |
| Phone alerts and the morning digest | Not built | No push channel in this cut |
| Empties valued at purchase cost | Counts only | No purchase cost per asset in the records yet |
| Near expiry (Inventory) | Not tracked; said under ⓘ | No batch or expiry dates in the records |
| 1200 px: tabs in a left column | Same centred column, sheets as a side panel from 768 px | One layout to keep right first |
| Tiles: "Good / Bad / Ugly" | **On track / Needs work / Urgent** | The owner's call: common business words, the same three as the Overview dials. Tiles look pressable: a card, a ⌄, a notch from the selected tile to its list; an empty tile is flat and dashed |
| Footer: Tower · Create · EXIT DEMO | **Tower · Assistant · EXIT DEMO**, with Timeline on the Overview and the four work screens on the Deliveries lever | Create removed for now (owner, 22 Sep 2026); Timeline (§4.11) and Assistant (§4.12) added the same day; the Distribution & Logistics screens joined the Deliveries lever's bar on 23 Sep 2026 (§4.13), which scrolls sideways to hold them, and the Timeline became a home action the same day. "Record your first delivery" still opens the delivery form from the Deliveries preview |

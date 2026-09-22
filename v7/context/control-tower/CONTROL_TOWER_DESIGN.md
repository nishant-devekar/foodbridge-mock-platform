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

One screen, five tabs, one template, and the platform's footer. There is no
home page, menu or settings inside the tower.

```
┌─────────────────────────────────┐
│ Deliveries● Collections● Purcha…│  ← lever tabs, horizontal scroll, sticky
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
│                                 │
│ [   Send 5 reminders   ]        │  ← STICKY ACTION: the one prepared move
├─────────────────────────────────┤
│  ⌂ Tower    ⊕ Create   ← EXIT DEMO│  ← FOOTER: the platform's bar, 58 px
└─────────────────────────────────┘
```

Reading order is the decision order: **where am I → what's wrong → what do I
do.** The action is always under the thumb.

## 4. The template, part by part

### 4.1 Lever tabs
- Five tabs in the owner's order: Deliveries · Collections · Purchase ·
  Inventory · Order. Horizontal scroll, sticky at the top, the selected tab
  scrolled into view.
- **A status dot before each name:** red (something Ugly) · amber (something
  Bad) · green (all good) · hollow grey (Preview). The dot always sits beside
  the word, so colour is never the only signal.
- Swipe left and right on the content to change tab.
- **The lever opens on the tile its dot promised** (22 Sep 2026): green → On
  track, amber → Needs work, red → Urgent. Every way in — the tab, a swipe,
  an Overview dial, a balance card, a win — lands the same way, and a tile
  the owner picks holds only while they stay in that lever. A tile with
  nothing in it can't be landed on, so the next one down is used.
- The tower opens on Deliveries. It remembers the last tab within a day.

*Why:* the owner's flow asks for fixed tabs; the dot answers "which lever
needs me" without opening five tabs.

### 4.2 "As of" line
- One muted line, *"As of 24 Aug"*, shown **only** when the records are older
  than today. Live data shows nothing.

*Why:* a number from last month read as today's leads to a wrong call. When
the data is fresh, the line is noise, so it goes.

### 4.3 Headline
- **The one number** that tells the state of the lever, large, with one short
  line of context under it.
- **ⓘ** opens "How this is worked out" in a sheet: the rule, in one or two
  sentences.

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
material: no customer colours, and no sticky action; those belong to Needs
work and Urgent. Long-stuck money received is also the first Overview win.

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
- Tap → the other lever's tab.

*Why:* this is what makes it a control tower, not five reports. When the
levers are in balance the card is noise, so it isn't there.

### 4.7 Grow card
- **One card: the single biggest opportunity on this lever**, with its ₹ where
  it can be proven: *"2 products are selling fast — offer them to 14 customers
  who don't buy them."*
- Tap → prepared action.

*Why:* the owner asked to see opportunity on every lever. One is a decision;
a list is homework.

### 4.8 Sticky action
- A full-width button pinned above the phone's edge, **56 px**, naming exactly
  what will happen and to how many: **"Send 5 reminders"**, **"Reschedule 3
  deliveries"**, **"Raise 3 purchase orders"**.
- It acts on the top Ugly (or Bad) items. When there's nothing to do, the
  button is gone. It never says "Take action" or "Review".

*Why:* one prepared move under the thumb is how FoodBridge shows its value:
the work is already done; the owner only confirms.

### 4.9 Footer

The platform's standard bar, the same on every screen: 58 px, white, a
hairline on top, the page's own items to the left and **EXIT DEMO** always
last. In the tower it carries three items:

| Item | Does | Why it is there |
| --- | --- | --- |
| **Tower** | Closes any sheet and returns to the top of the current lever | Home base: one tap back from anywhere |
| **Create** | Opens the Create sheet: the quick actions | Where the business's own records go in |
| **EXIT DEMO** | The platform's exit | Platform standard, always last |

- **Create sheet:** five rows, one per lever, in tab order, each opening its
  own short flow:
  **Record a delivery** (delivered · missed · returned · money and empties
  collected) · **Receive payment** · **New purchase order** · **Stock count**
  · **New order**.
  Anything recorded here shows on its lever straight away.
- **Record a delivery** is how the Deliveries lever fills without any
  integration: the driver or the owner records each stop.
- **Look:** icon 22 px over a 10 px label; the current item in brand green,
  the others grey. Create is a green-tinted chip, not a filled button, so the
  sticky action stays the only primary button on screen. EXIT DEMO never takes
  the active colour.
- **With the sticky action:** the action sits directly above the footer, 12 px
  clear of it. A sheet rises over both.
- **Bigger screens:** where the platform shows its sidebar, the footer is not
  drawn; Create sits at the top of the tower instead.

*Why:* quick actions need to be reachable from any lever with the thumb, and
the owner expects the same bar they meet on every other screen. Everything
else a footer could hold is already done by the tabs and their dots.

### 4.10 Sheets
All detail opens as a bottom sheet over the tab (the owner never loses their
place). Three kinds (the Create sheet is in 4.9):

**Item sheet** (a customer, product or delivery): its name, the three or four
facts that matter for this lever, and one action.
- *Customer:* colour · outstanding · oldest overdue · empties with them ·
  last order → **"Send reminder"**.
- *Product:* days of stock · selling per week · on order → **"Add to purchase
  order"**.
- *Missed delivery:* customer · reason · what was short or returned →
  **"Reschedule"**.

**Confirm sheet** (after the sticky action):
- Title that states the outcome: *"Remind 5 customers."*
- The prefilled list, everything ticked, each line editable (untick, change a
  quantity, edit the message).
- One button with the live count: **"Send 5 reminders"**. Swipe down to cancel.
- **Done:** the sheet closes, a one-line confirmation at the bottom
  (*"5 reminders sent"*) with **Undo** for 5 seconds where undo is possible,
  and the lever's numbers update.

*Why:* seeing, changing and confirming in one place is the whole "FoodBridge
prepares, the owner confirms" promise.

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
| **Loading** | The template's shapes in light grey (tabs, headline, three tiles, five rows), never a spinner. Under 1 second on a good network. |
| **All good** | Headline in green words ("All 45 delivered"), Good selected, no action button. A calm screen is the reward. |
| **Preview** (records not connected) | See 6.1. |
| **Stale** | The "As of" line. Nothing else changes. |
| **Offline** | The last loaded screen stays, with "As of 9:40 am". Actions queue with *"Will send when you're online."* |
| **Error** | One line where the content would be: *"Couldn't load Collections. Retry."* Other tabs keep working. |

### 6.1 Preview

A lever without its records shows the **whole template**, so the owner sees
what they get:
- Tabs: hollow grey dot.
- Headline replaced by the promise, in the owner's numbers where they exist:
  **"Track all 160 orders to the door."**
- Tiles and rows drawn in full, in light grey, with real labels and
  **Example** figures, marked with an *Example* tag on the tiles.
- Tomorrow's trips, Balance and Grow cards shown the same way.
- Sticky action becomes **Connect deliveries**, which says exactly what is
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
| Brand | #1E7A46 | sticky action, selected tab underline |
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
- Touch targets at least 44 px; the sticky action 56 px, 16 px from the edges,
  clear of the phone's gesture bar.
- Icons: one outline set, 20 px, 1.75 stroke, used only where they speed
  recognition (lever tabs don't need them; the sticky action doesn't).

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
| Lever tabs with dots | The owner's flow; "which lever needs me" at a glance |
| "As of" (only when stale) | Stops an old number being read as today's |
| Headline number + context | The state of the lever in one read |
| ⓘ How it's worked out | Trust: the owner can check any number in one tap |
| Good / Bad / Ugly tiles | The owner's reading model; the whole state in three numbers |
| Five-row list, money first | What exactly is wrong, most costly first |
| Customer colours (Collections) | The owner's flow; who to push and who to protect |
| Tomorrow's trips (Deliveries) | The owner's "upcoming health"; decides today's loading and collections |
| Balance card, only when out | What makes it a control tower |
| One Grow card | The owner asked for opportunity on every lever; one is actionable |
| Sticky action | Shows FoodBridge has done the work; one tap to act |
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

A sixth tab, **Overview**, before the five levers; the tower opens on it. It
shows the whole business through its levers, more visual than numeric:

- **No headline:** the dials already say which areas need the owner, and
  Start here names the first (owner, 22 Sep 2026).
- **A dial per area**, like a car dashboard, in the tab order so it never
  shuffles: the area's picture in the middle (truck, ₹, clipboard, box,
  cart), a ring that fills with its health, one colour (green fine, amber
  needs work, red urgent), and the name with one status word and "›" under
  it ("Needs work ›"). Each dial is a tile, so it reads as a button. Tapping
  it opens the area **on the tile its word names**: On track → On track,
  Needs work → Needs work, Urgent → Urgent. Three
  over two on a phone. (A ✓ / ! badge was cut: a third way of saying the
  colour and the word.)
- **No Start here line:** removed by the owner (22 Sep 2026); the red dial
  already says where to start, and opens on its Urgent list.
  (Built first as a radar chart, then as five text cards; both replaced the
  same day as too hard to read at a glance for a traditional trader.)
- **Wins:** up to three proven good things, the owner's results first
  ("₹10,600 collected this week"), then FoodBridge's work, tagged
  FoodBridge ("20 usual orders prepared"). A lever that turned green since
  the owner last looked is celebrated once, with a sparkle: "Purchase is on
  track now".
- **Balance:** only the single most important tension; the rest live on each
  area's own screen.
- **No live line:** removed by the owner (22 Sep 2026). The demo shows no
  label of its own; its numbers move on their own every 20 seconds.
- Wins never repeat a dial: no "X is on track"; only the moment an area
  turns green ("… is on track now") is news.

No sticky action on Overview: every line opens the lever that acts.

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
| Footer: Tower · Create · EXIT DEMO | **Tower · EXIT DEMO** | Create removed for now (owner, 22 Sep 2026). "Record your first delivery" still opens the delivery form from the Deliveries preview |

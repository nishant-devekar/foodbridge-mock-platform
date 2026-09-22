# Control Tower — the five levers

22 Sep 2026 · product specification · written from first principles.

Sources: the owner's problem notes ("Control-Tower.md": twelve problem areas of
a food distributor) and the owner's Control Tower flow (21 Sep 2026, 17:24).
Nothing here is derived from any earlier screen or design.

---

## 1. Purpose

A food distributor runs the business by pulling five levers. The Control Tower
exists to answer one question, all day:

> "Given everything happening in my business right now, what should I do next
> to grow profitable revenue while keeping stock, cash and customers healthy?"

It does three jobs for every lever:

- **Monitor:** where the lever stands right now, in the owner's terms.
- **Balance:** where this lever is hurting another, and the move that fixes it.
- **Grow:** the business opportunity this lever is opening.

"Don't just show me what happened. Tell me what needs to happen next."
(notes §12)

## 2. The five levers

In the owner's order, which is also the order of the tabs:

| # | Lever | The owner's question | Notes § |
| --- | --- | --- | --- |
| 1 | **Deliveries** | Did every committed order reach the customer, and what came back with it? | 6, 9, 11 |
| 2 | **Collections** | Who do I collect from, how much, when, and how? | 7, 8, 9 |
| 3 | **Purchase** | What do I buy, when, from whom, and can I afford it? | 5, 8 |
| 4 | **Inventory** | What do I keep, move, discount, return or liquidate, and when? | 5 |
| 5 | **Order** | What should this customer order, when should they order it, and how should we fulfil it? | 1, 2, 3, 4 |

More levers follow later (Targets, Margin and pricing, Field reconciliation,
Customer growth). A lever is a self-contained unit with the same parts, so a
new one is added without changing the others.

## 3. How the owner uses it

1. **Arrives.** The five levers are fixed tabs in a horizontal row, in the
   order above. Each tab carries a status dot, so the owner sees which lever
   needs them before opening anything.
2. **Opens a lever.** Every lever reads the same way, top to bottom:
   - **Key KPIs as Good, Bad and Ugly.** *Good* is what went right, *Bad* is
     what is slipping, *Ugly* is what went wrong and needs action now. Each
     KPI is a number and a short label; a number that can't be proven is shown
     as not available, never as zero.
   - **What to do now.** Each Ugly and Bad item has one prepared action.
   - **Balance.** Only when this lever is hurting another.
   - **Grow.** The opportunities this lever opens.
3. **Acts.** Every action is prepared by FoodBridge and confirmed by the owner:
   see what will happen, change it, confirm. The outcome is stated, and it
   feeds back into the lever's KPIs.

**Status of a lever:** *On track* (no Ugly, little Bad) · *Needs attention*
(Bad items) · *At risk* (Ugly items) · *Preview* (the records this lever needs
aren't connected yet).

**Preview: the full lever before the data arrives** (owner's decision, 22 Sep).
A lever without its records is never an empty tab. It shows the complete
skeleton — every Good, Bad and Ugly KPI, every action, balance and grow line —
so the owner sees everything they would gain by connecting:

- Each KPI shows its label and one line on what it would tell the owner.
- Where the owner's own records can size it, the preview says so in their
  numbers ("160 orders a quarter would be tracked to the door", "40 customers
  would each get an asset balance").
- Where they can't, a figure is marked **Example** and is never presented as
  the owner's.
- One **Connect** action per lever names exactly which records unlock it.

The tower opens on the first tab, Deliveries, even in preview.

## 4. The levers

### 4.1 Deliveries

The lever where all the others meet in the field (notes §11): one delivery
drops product, collects money and returnable assets, takes the next order,
and brings back returns and shortfalls.

| | KPIs |
| --- | --- |
| **Good — Done** | Deliveries completed · products delivered · amount collected · assets collected · next order collected at the door |
| **Bad — In progress** | Deliveries on the road · running late · first-trip delay pushing later trips (notes §6) |
| **Ugly — Missed** | Missed deliveries and why: shop closed, refused, van full · delivered late, and why · products returned: which shop, how much · shortfalls: what was booked but not loaded |

**Where Deliveries stands: on time and in full** (22 Sep 2026) — "How do I
fulfil every committed order on time with limited people, vehicles and
inventory?" Of the stops due so far, the share delivered within 30 minutes
of their slot with nothing short. Late, short and missed each fail a drop; a
stop past its slot and still on the road is already failing. On track at
75%, urgent under 50%. Returns and empties are problems to fix, not failed
drops.

**The demo day** shows the constraints behind it: two vans, two rounds
each, a load of 40 cases a round, one loading crew. One van's first round
leaves the dock 60–99 minutes late and the delay carries down its route and
into its second round; the other van waits its turn at the dock and catches
up within a few stops; the other van's afternoon round is booked past its
load, so what doesn't fit is missed ("Van full") when it leaves; about one
drop in eight goes short.

**Upcoming health**, the forward look for the next deliveries:
- amount to collect from critical (Red and Fire) customers on this route
- assets to collect from critical customers, in kits and loose units
- product shortfalls against what is booked
- products to upsell at each stop

**What to do now:** reschedule a missed delivery; send the short product on
the next trip; collect with the next drop; confirm returns into stock.

**Balance:**
- *With Order:* bookings beyond delivery capacity (vehicles, people, trips).
- *With Inventory:* booked orders that stock can't fill (overbooking).
- *With Collections:* critical customers on today's route; collect before
  dropping more credit.

**Grow:** the upsell list per stop; next orders captured at the door; on-time
delivery as the retention promise (notes §2).

**Data needed:** delivery records per order (status, reason if missed,
returns, amount and assets collected), vehicles and trips.

#### Returnable assets

Assets are what leaves with the product and must come back. In Indian FMCG
distribution they are money: a returnable glass bottle costs ₹18–25 and
carries ₹200–400 of revenue over 10–20 trips, and 5–8% of bottles in
circulation are lost each year. Distributors keep a separate running ledger
per asset type, and every delivery records the empties collected.

**Asset types the tower recognises:**

| Kind | Examples | Moves |
| --- | --- | --- |
| **Carriers** | plastic crates (beverage, milk, produce), bread and bakery trays, egg trays, pallets, roll cages | every trip |
| **Returnable containers** | glass bottles (soft drinks, milk, water, beer), PET, 20 L water jars, milk cans, oil tins, kegs, gas cylinders | every trip, swapped full for empty |
| **Cold chain** | insulated and ice boxes | every trip |
| **Equipment on loan** | visi-coolers, freezers, display racks, dispensers | stays with the customer; checked, not collected |

**Kits.** Some assets always travel together: *1 crate = 12 glass bottles* (or
24 at 300 ml). The kit is counted at both levels, on the way out and on the
way back. A crate returned with 10 bottles is a kit shortfall of 2 bottles; a
customer can return loose bottles without the crate, or a crate without its
bottles. Each product names the kit it ships in, so booking an order also
books the assets it will need.

**At the door, each delivery records per asset:** issued · returned (full
kits and loose units) · broken · lost · swapped. Returns and breakage are
checked against the customer's balance.

**Per customer:** an asset balance (out, back, still with them), how long each
asset has been held (ageing), and the value at risk at the asset's purchase
cost.

**The money in assets.** Businesses don't take a security deposit per asset;
each asset has a purchase cost, so every asset lost or broken is the
distributor's own money until it is replaced. A few businesses charge
customers for breakage: that is a per-business setting, off by default.

**Asset KPIs inside Deliveries:**

| | KPIs |
| --- | --- |
| **Good** | Assets collected this trip · return rate |
| **Bad** | Assets held beyond their usual turn · customers holding more than their usual float |
| **Ugly** | Broken and lost, valued · kit shortfalls · assets with Red and Fire customers |

**Balance:**
- *With Collections:* assets out with Red and Fire customers are collected
  first; where the business charges for breakage, the charge joins the
  customer's outstanding.
- *With Order:* not enough empties in the warehouse to ship what is booked
  (asset float).
- *With Purchase:* lost and broken assets become a purchase (replacements at
  purchase cost); empties owed back to the brand or supplier, and the credit
  they return.

**Data needed:** an asset master (type, kit composition, purchase cost per
unit, whether breakage is charged), per-delivery counts issued and returned,
and customer balances.

### 4.2 Collections

| | KPIs |
| --- | --- |
| **Good** | Collected this period · customers paying on time |
| **Bad** | Coming due in 7 days · overdue with Yellow and Orange customers |
| **Ugly** | Overdue with Red and Fire customers · oldest overdue |

Overdue money splits by the customer's colour, so the tile a lever opens on
says the same thing as its dot (22 Sep 2026): Yellow pays late and Orange
needs following up — that is work; Red and Fire are the money to chase, and
they alone make Collections Urgent.

**The dot follows the money** (22 Sep 2026), not the head count: Collections
is on track while no more than 25% of what customers owe sits with Red and
Fire customers, slipping up to 50%, urgent past that. Thirty small customers
paying on time no longer outweigh ₹18,000 with the nine who don't.

**Customers by colour, each with its outstanding** (owner's flow: "Green
customers — outstanding"; notes §7: gold, silver, bronze, fire):

| Colour | Who | Standard next step |
| --- | --- | --- |
| **Green** | Pays on time | Keep credit open; offer more range |
| **Yellow** | Pays late, but pays | A nudge before the due date |
| **Orange** | Needs repeated follow-up | A call; collect with the next delivery |
| **Red** | Overdue long or large, but engaging and paying something | Hold new credit; the owner calls; an instalment plan |
| **Fire** | Stopped paying or responding; a write-off risk | Stop supply; collect assets first; recovery |

A customer's colour comes from their own payment history. The thresholds are
the owner's to set; the tower shows how each colour is worked out.

**What to do now:** the right nudge for each colour (message, call, collect on
delivery, recovery); instalment plans for Red customers who can pay in parts;
recovery and asset collection for Fire.

**Balance:**
- *With Purchase:* money owed to you vs what you owe suppliers; collect before
  you buy.
- *With Order:* customers still ordering while overdue; hold or collect with
  the order.
- *With Deliveries:* Orange, Red and Fire customers on the next routes, and
  the assets they hold.

**Grow:** Green customers are the safest place to grow: more range, higher
credit, first look at new products. Strategically valuable late payers (notes
§7) are flagged, not punished.

**Data needed:** invoices with due dates, payments with dates, credit limit and
credit period per customer.

### 4.3 Purchase

| | KPIs |
| --- | --- |
| **Good** | Products covered for their lead time · purchase orders arriving on time |
| **Bad** | Products that need buying this week · supplier bills coming due |
| **Ugly** | Products already out with open demand · buying stock that isn't selling · supplier bills overdue |

**What to do now:** a purchase request per supplier, sized to demand plus
safety, less stock and open orders; stop or cut a purchase of slow stock;
advance-book products short in supply (notes §3: sugar, rice).

**Balance:**
- *With Collections:* can this purchase be paid for? The cash that collections
  will bring in before the bill is due.
- *With Inventory:* buy what sells, not what sits.

**Grow:** advance booking ahead of shortages; better terms with the suppliers
the business buys from most.

**Data needed:** purchase orders with lines and expected dates, supplier lead
times, supplier bills with due dates.

### 4.4 Inventory

| | KPIs |
| --- | --- |
| **Good** | Selling products with healthy cover (2+ weeks) |
| **Bad** | Running low · near expiry · no sale in 60 days |
| **Ugly** | Out of stock with demand · expired · no sale in 90 days, valued |

**What to do now:** reorder what is short (hands to Purchase); rotate
near-expiry stock first; discount, return to brand or liquidate what won't
sell in time.

**Balance:**
- *With Order:* demand the business can't meet vs money sitting in stock that
  doesn't move.
- *With Purchase:* stop buying what is overstocked.

**Grow:** find buyers for excess and near-expiry stock: past buyers, look-alike
customers, restaurants (notes §5).

**Data needed:** stock on hand per product, batches with expiry dates, cost and
selling price.

### 4.5 Order

| | KPIs |
| --- | --- |
| **Good** | Orders and order value against the previous period (against target once targets exist) · repeat customers |
| **Bad** | Customers late to reorder · falling order value |
| **Ugly** | Orders stock can't fill · customers gone quiet (churn risk) |

**What to do now:** prepare each late customer's usual order; call the ones
too quiet to predict; schedule recurring and advance orders (notes §3).

**Balance:**
- *With Inventory:* orders that stock can't fill.
- *With Collections:* orders from customers who are overdue.
- *With Deliveries:* bookings beyond delivery capacity.

**Grow:** products the customer should add (look-alike customers, same area,
most-sold and most-margin; notes §3, §4); the first product to pitch in the
ten seconds a salesperson has (notes §4); turning new retailers into repeat,
multi-product customers (notes §2).

**Data needed:** orders with lines and values; later, targets, cost prices.

## 5. Balance, across the tower

The levers pull against each other (notes §8, §11). The tower's distinct job,
beyond five separate reports, is to show where one lever is hurting another.

| Balance | Levers | The question |
| --- | --- | --- |
| **Cash** | Collections ↔ Purchase | Can I pay for what I need to buy? |
| **Stock** | Inventory ↔ Purchase ↔ Order | Am I short of what sells and long on what doesn't? |
| **Credit** | Collections ↔ Order | Am I selling on credit to customers who don't pay? |
| **Fulfilment** | Order ↔ Inventory ↔ Deliveries | Can I deliver everything I've booked? |
| **Field** | Deliveries ↔ Collections ↔ Order | Is each trip collecting, recovering assets and taking the next order? |

Each balance shows its two figures and one move, and appears on every lever it
touches, only when it is out of line.

## 6. Principles

1. **The owner's words.** Customers, products, orders, deliveries; no system
   terms.
2. **One thing per line.** Each KPI is a number and a label; each action is one
   line.
3. **Proven numbers only.** A figure appears only when the records prove it.
   Missing data is *not available*, never zero, and the tower says what
   connecting would unlock.
4. **FoodBridge prepares, the owner confirms.** Nothing is sent, created or
   spent without the owner's confirmation.
5. **Every action closes the loop.** Its outcome shows up in the lever's KPIs,
   so the owner sees what FoodBridge changed.

## 7. Phasing

1. The five tabs with status; Collections, Purchase, Inventory and Order with
   Good/Bad/Ugly, actions, balance and grow, from the records available.
   Deliveries in full Preview.
2. Deliveries captured on every order (status, reason, returns, amount and
   assets collected), which fills Done, Missed and Upcoming health.
3. Returnable assets: asset master with kits and purchase cost, balances per
   customer, breakage charge where the business uses it.
4. Collections colours with credit limits and terms.
5. New levers: Targets (run rate, gap to target), Margin (price, margin, RGM),
   Field reconciliation (stock and cash per driver, notes §9).

## 8. Decisions (owner, 22 Sep 2026)

0. **On screen, Good / Bad / Ugly read as On track / Needs work / Urgent**
   (plain business words; the same three on the tiles and the Overview
   dials). This spec keeps Good / Bad / Ugly as the model's names.

1. **Good, Bad, Ugly applies to every lever.**
2. **Collections colours:** Green, Yellow, Orange, Red and Fire (Red split in
   two; Fire is the write-off risk).
3. **Assets:** crates, trays, cans and similar returnables, including kits that
   always travel together (12 glass bottles in 1 crate). Modelled in 4.1.
4. **Preview, not empty:** a lever without its records shows its full skeleton
   and what the owner gains by connecting. The tower opens on Deliveries.

5. **Asset money:** no security deposit per asset. Assets carry a purchase
   cost, so losses are valued at it. Charging customers for breakage is rare
   and is a per-business setting, off by default.

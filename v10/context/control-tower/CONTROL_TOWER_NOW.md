# Control Tower · Now (Ek kaam, one thing at a time)

16 Oct 2026. Owner's pick from five themed experiments (road, cricket, one card, godown, radar): **Ek kaam**.
The owner's question that shaped it: once setup is done, how does one card work when several areas need them at
once? This page answers that question.

Code: `assets/ct/stack.js` (the model, pure, tested in `test/control-tower/stack.test.js`), `screens/control-tower.js`
(the NOW section: `stackNow`, `drawNow`, `nowAct`, `nowClick`), `screens/control-tower.css` (the Now block).

## What the owner sees

Second pass, 16 Oct 2026. In the owner's words: "premium experience … when levers are more than 3–4 it becomes
cluttered … swappable or scrollable like reels … each card something different to the eye … no IDs … use his
habitual usages". Every part of the page is something the owner already uses on a phone every day, so there is
nothing new to learn:

| Part | Borrowed from | What it does |
|---|---|---|
| **Stories** (the areas) | Instagram / WhatsApp status | A ring per area. Red-orange means Urgent, amber means Needs work, and grey with a tick means clear. The badge counts cards. Tapping a ring shows only that area; "All" shows everything. Any number of areas fits, because the row scrolls sideways. |
| **Reels** (the cards) | Reels, Shorts | One card per screen. Swipe up for the next, one card per swipe (snap). The next card's top peeks below, so there is always more. |
| **A new look each card** | Reels | Each area has its own colour. The big mark is the incident's own (missed, late, damaged…) or the area's. Three layouts take turns, so two cards in a row never look the same. |
| **The button** | A reel's "Shop now" | One white button at the foot: the row's own fix, with the coins it earns. |
| **"↑ New"** | A timeline's new-posts pill | Something worse arrived above. Tapping goes to it; it never moves the card being read. |
| **The end** | Instagram's "You're all caught up" | With nothing left: what was cleared today, the coins, what is waiting on others, and "Watching". With cards left: "That's everything for now" and "Back to the top". |
| **↑ ↓ on a computer** | Shorts on desktop | Buttons beside the column, plus the arrow keys and j / k. |

The card says only what a person reads:

- What happened (Urgent or Needs work, plus the incident or a two-word kicker such as "Long overdue").
- The name, written as people write it: "MAA KAMAKHYA RETAILS" becomes "Maa Kamakhya Retails", and a catalog's
  "(OLD MRP 100), NEW MRP 95" goes.
- The amount, big.
- At most three facts as chips.

Vehicle numbers, order and delivery numbers, and an amount already shown are dropped (`CTStack.nice`,
`CTStack.facts`). A group card shows initials and "Sangrur Food Distributors, Rajpura … and 9 more", the way a
post says who liked it.

The feed is redrawn only when its cards change. The live demo's ticks never move the owner off the card they are
on, and a redraw puts them back on the same card, or on the one that took its place.

The page is one screen high and only the feed scrolls. The footer is **Now · Business · Wallet · More**, and
Business is the tower home as it was.

## Third pass: used as the owner (16 Oct 2026)

The owner said: "feels good but a bit weird as an experience". So I used it as the owner would, fixing things
end to end on day 1 and on the running demo. What felt weird, and what changed:

| What felt weird | Why | Now |
|---|---|---|
| Fixing a product **raised** the count (8 → 9) | A product's next problem (no unit, then no category) became a new card | Products go by family (hidden, stock, price, paperwork). A product stays one "hidden" thing until it can sell. |
| "↑ New · Sandbox Gadget" right after fixing it | The pill fired for any card not seen before | The pill fires only for something new and urgent. A thing already on screen with its next problem comes right after the card being read. |
| The card being read moved from 1 to 3 | The feed re-sorted on every change | The feed keeps its order while the owner is in it. |
| Six taps to fix one product: card, list, product, Set unit, Save, Confirm | The card's button opened a list, then a summary of what the card already said | A group lists its things by name on the card. Each one, and the button ("Fix Sandbox Gadget"), opens straight on its fix. A delivery's button opens on the action it names when the card has one. |
| The card said "+10"; the step paid 50 + 10. Fixing 1 of 6 paid nothing | Coins were paid per card | Coins are per thing (+10 each). The button shows the real amount (+60 for a setup step). |
| Doing the job turned 1 card into 8, with no moment of success | No feedback in the feed | A fix ends in a check and the coins bursting over the feed. The chip counts up; the toast is gone from Now. |
| "Customers is open" | The journey's own word | "Products added": the step, said as done. |
| "1" four times on day 1 (header, All, Products, 1 / 1) | Counts everywhere | No numbers on the stories, no "1 / 8". One line: "2 fixed today · 9 to go". |
| "Upload your list" opened a sheet asking to upload again | The step's summary sheet in between | The button opens store activation straight away. The sample data is a link on the card. |
| The product's code (SB-2) in its card | | Gone. |
| The demo and the new store counted each other's things as fixed (40 fixed, 406 coins) | One day record for both | Each business keeps its own day. |

Left as is:

- **The delivery modal still shows the vehicle and order numbers.** It is the owner's own mockup, copied pixel
  for pixel.
- **"Not available" deliveries open the delivery's card.** Their first step is a call, which is never placed
  for the owner.

## The six rules

1. **One stack for every area.** Urgent comes before Needs work. Inside each, the areas follow the clock: setup,
   then deliveries, collections, production, buying, stock and orders. Within an area, the card that costs most
   comes first.
2. **The stories are the monitor.** They show every area, including any with nothing to do.
3. **Alike things come as one card.** Two or more rows in the same area that share an incident, a floor alert, a
   step, or (Production's order rows) a tab become one card ("5 customers owe ₹14,360, long overdue"). Its button
   ("See all 5") lists the rows, and each row opens its own card.
4. **Worse problems ask to go first.** A new Urgent card that ranks above the one on screen shows the "↑ New"
   pill. It never replaces the card the owner is on. Nothing cuts in on the first look of the day.
5. **Waiting leaves the stack.** An incident the owner acted on that now waits on someone else (state
   `acting`) shows only on the end card, under "Waiting on others".
6. **The day ends.** An empty stack ends on "You're all caught up", with what was cleared, the coins earned today
   and "Watching." Cards appear again as soon as something needs the owner.

One product is one card: what Buying lists is not also a Stock card, because Buying claims it first. A customer
with two problems, such as owing money and having stopped ordering, gets two cards.

## A card is a row

Cards are not new work. Each card is a row the area pages already list. Its button opens that row's own card:
the delivery modal, the customer or product sheet, a journey step's sheet, or a product fix. Production asks in
place ("Open Orders on the Production board?") before it leaves, as its rows do. Every fix is the one the area
page has.

## Coins

- A thing (a customer, a product, a delivery) the owner worked on, through its card's button or its line on a
  card, pays **10** once it leaves the stack because the records moved.
- A thing that leaves without being touched, because the business moved on its own, pays nothing.
- The first time the stack empties after something was cleared that day pays **150**.
- Journey steps pay their own coins, as before.
- The Wallet adds journey coins and card coins, minus what was spent.

Storage, per device:

- `fb.v7.ct.now.<business>`: today's open things, the done ones, those the owner touched, and the day bonus. It
  resets each day and is kept per business.
- `fb.v7.ct.coins`: the coin log.

A new store clears both.

## Day one

The new store's areas are in the lever shape, so the same stack holds the setup. "No products yet" is the first
card, and its button opens the step. The demo's sample products then fill the stack with the Finished Goods
page's own problems ("6 products are hidden: no unit"). The owner learns this interface on day one and keeps
using it every day after.

## Not done yet

- The end-to-end browser script (`test/control-tower/e2e/control-tower.e2e.js`) still expects v7's Overview home
  and Deliveries / Collections in the footer.
- There are no bulk actions on a group card yet (for example "Put all 3 on the 4 pm trip"). A group lists its
  rows, and each row is fixed on its own card.
- There is no streak yet.

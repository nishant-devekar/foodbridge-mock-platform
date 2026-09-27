# Production store

`production-api.js` is the single store behind every Production screen. It was built on 26 Sep 2026 to implement the owner's decisions in "JobFlow in Production": one batch list, one roster, one record of the floor.

Before this, Batch Management, Configure Recipe, JobFlow and the inventories each kept their own copy of the factory. Now all of them read and write `localStorage["fb.v7.production"]`.

| Collection | Who reads / writes it |
| --- | --- |
| `recipes`, `recipeHeaders`, `operators`, `batches` | **Batch Management**. These use its own `seed.json` shape, and its `loadSeed()` / `saveSeed()` point here. Its `packagingLines` and `hostProducts` are not stored: `batchSeed()` makes them from `skus` each time it loads. |
| `book` (line, ingredients, making cost) | **Configure Recipe**, through `recipe-store.js`. |
| `skus` (the packs: size, per carton, price, pouch, split, retired) | Changed only in **Recipes → Packaging** (`D.savePack` / `D.retirePack`). Read by the header, Cost, the Production split, Production Plan, Batch Management, the Worker App's pack step and Finished Goods. |
| `workflows`, `shifts`, `tasks`, `workers` | **Recipes → Process** (the steps, through the JobFlow API), **Batch Management**'s Start (which puts the batch's steps on today's shift: `D.releaseToFloor` → `D.startOnFloor`) and the **Worker App**. The **Production board** reads them. |
| `materials`, `lots`, `ordered` (raw material, and packaging: pouches, cartons, big bags) | **Raw Material Inventory** (merged in by `MockShell.loadSeed`), **Receive Stock**, **Production Plan**. Each lot also has its stickers (see below). |
| `bags` | **Inventory → Semi-Finished Inventory** (merged in by the Inventory module's `mock-shell.js`, via `D.semiFinished` and `D.bagHistory`). The recipe's fill step fills them (what they are and where they're kept: its container, unit and store); packing empties them, oldest first. |
| `fg` | **Finished Goods Inventory**. Packing orders post their packets here. |
| `demand` | **Production board › This week**: weekly sales and orders in hand. |

## The business

The seeded business is the owner's reference: frozen green peas, mixed vegetables and soya chaap. It runs on two lines:
- **Peas + vegetables:** peel · cut · wash → blanch → freeze → fill 30 kg bags.
- **Soya chaap:** weigh out flour + water → dough → cut → stick → boil · cool · chill → fill 35 kg bags.

Small packets are packed later, from the oldest bags, when orders need them.

The seed is not typed in. `seed()` *runs* a month of the business through the same operations the screens use, on a clock set back in time:
- goods received;
- production orders;
- shifts;
- every step weighed, with the odd bad day;
- bags filled;
- packing orders run when a pack runs low;
- sales.

So every lot, bag and packet adds up the way live use will. A new day starts a new demo month.

## Rules the screens share (`Domain`)

- **Stickers.** Every lot accepted at the gate gets one sticker per sack, crate or box. The material sets the size: 20 kg crates of peas, 25 kg crates of carrot, 50 kg sacks of flour, boxes of 1000 sticks, bundles of 50 big bags. The last sticker holds what is left over.
  - Each sticker shows the material, the lot number, "crate 3 of 17", the quantity, the day it came in, its use-by, the store, the supplier and who received it. Its QR code holds the lot number and the pack.
  - Receive Stock opens the sticker sheet as soon as the truck is booked in. The Batch History Report has a **Stickers** button on every lot for reprinting.
  - A truck sent back at the gate never enters the store, so it gets no stickers.
- **Taking from the store.** A weighing step with materials takes from the oldest lot first, splitting what went in by the recipe's ratio. Each take is an *issue* on the batch's Ingredients tab. If the store can't cover a step, the step fails and nothing changes.
- **Batch status is moved by the floor.** The first step started moves a batch from Planned to In Progress. The last step done moves it to Completed, with the bagged kg as its outcome. A batch On Hold or Rejected can't be started on the floor.
- **Weight loss.** A loss over the step's limit becomes a line on the Production board's **Needs you** (`D.alerts`, which `/api/alerts` also serves). Help calls, steps nobody picked up and batches on hold join it. Each line says who to call (`call`: the worker, the batch's supervisor via `D.supervisorOf`, or `D.purchase()` for short material) and clears itself when the floor moves on.
- **Packing** takes kg from the oldest bags and one pouch a packet. Its cartons step takes whole cartons, posts the packets to Finished Goods and marks the order synced. A packing order keeps the carton size it was made with.
- **Packs** (Recipes → Packaging): a pack that has been made keeps its size (a new size is a new pack). Changing one pack's split rebalances the others to 100%; retiring a pack gives its split to the rest. A cost per packet = the recipe's cost per kg × kg + pouch + carton ÷ per carton.
- **Plan:**
  - Short packets = orders in hand + next week's forecast − packets − packets being packed.
  - To make = short kg − freezer − already planned, rounded to the recipe's batch sizes.
  - Buy = needed − (in store − held for planned batches) − already ordered.
- **Month end:**
  - Real cost per kg = the raw material actually issued, at each lot's price, plus making cost, over the kg bagged.
  - Weight lost is shown by step and by worker.

## The record

Every step writes to `localStorage["fb.v7.production.log"]`: who, how much, which lot or bag, and when.

The Control Tower's stream, `fb.v7.events`, is deliberately **not** used. The owner asked for zero change to the Control Tower, and the delivery incident engine reads that stream.

## Tests

Run from `v7/`:

```
node --test assets/production/test/*.test.js
```

There are 10 tests:
- the seeded month balances;
- the floor moves batches and bags them;
- packing is first in, first out;
- a failed step changes nothing;
- loss alerts;
- a held batch pauses its steps;
- the plan's arithmetic;
- receiving and sending back at the gate;
- one sticker per sack, crate or box;
- month end.

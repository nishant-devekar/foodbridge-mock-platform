# Control Tower · one flow, walked node by node

17 Oct 2026. Supersedes CONTROL_TOWER_GRAPH.md. The owner said the earlier graph was wrong: it put the app,
its tabs, area containers and milestones in as nodes. "Tree traversal should be pure … products as area
should be some property of that node … tomorrow Claude can understand from the store's db what this store's
status is, generate the nodes for that store and run them on Now by injecting the JSON. The control tower
engine should have zero store business context."

## What is where

| Layer | File | Knows |
|---|---|---|
| **Flow** | `assets/tower/graphs/store-journey.json` (fb.journey/2, `assets/journey/FLOW.md`) | The store's steps, their edges, their conditions, how each area looks |
| **Engine** | `assets/journey/flow.js` | Nothing: nodes, edges, conditions, five states. A test fails if it names a business word |
| **Facts** | `assets/ct/journey-facts.js` | Reads a store's records into numbers |
| **Writer** | `assets/tower/writer.js` + `assets/tower/store-rules.json` | Turns a trading store's live records into nodes (the stand-in for Claude) |
| **Tower** | `screens/control-tower.js`, `assets/tower/runtime.js`, `assets/ct/journey-view.js` | Draws the walk: Now is `open()`, rings are the areas its nodes name. Tabs are the shell's own |

## The journey (the owner's words, node by node)

- A new store lands on **Add products**. Nothing else is open.
- **Fix products** opens once a product is in. When 5 products are right it is *enough*: it stays as an
  optional card and **Add customers** opens beside it.
- **Fix customers**, the same at 5 reachable customers. Then **Take your first order** opens. It needs both
  fixes to be enough.
- After the first order (owner, 17 Oct 2026): **Keep taking orders** and **Record a delivery**; then **Send the
  invoice** and **Record a payment** (both after the delivery); then **Count your stock**; then **Create a
  purchase order**, adding its supplier inside it. No manufacturing steps: Write a recipe and Plan a batch
  are gone, as are Name your van, Bring in old dues, Set credit terms and Receive a purchase.

13 steps in 7 areas. Production keeps its look in the flow's `areas` only so a store that makes things still
draws its live production work (from its records, not the journey). A trading store walks the same flow on its own facts, so the journey stands where its
records say: done steps are done, optional work stays offered. Its live work arrives as nodes in the same
flow.

## Change the flow, change the tower

- The **Store Flow Editor** (claude.ai artifact): one lane per area, steps left to right as they open,
  arrows for "comes after". You can:
  - drag a step onto another to re-link it ("Comes after" or "Also needs");
  - drag a step into another lane to change its area;
  - drag a step's ● to link a step after it, and click an arrow to remove it;
  - walk the flow on sample facts or your own and see what Now shows;
  - save versions, and apply to the tower: the tower shows Apply / Not now.
- **Real users** (17 Oct 2026): every tower link from the editor carries a trial id (`#graph=…&trial=T-…`).
  A tester who presses Apply (and gives a name) reports where they stand on that flow whenever a step opens or
  is done: the flow's steps, their states and times, never the store's records. It goes to the bridge
  (`zoho-function/api/journeys.js`, private Blob; local `journeys-data/`), and the editor's Real users panel
  reads it back behind the team key: who is on which step, for how long, who is stuck (one step over a day).
  Going back to the shipped flow ends the trial.
- `FBControlTower.api.graph.inject(flow)` from a script. Validated first; kept on the device; More → Store
  flow goes back.

## Tests

- `test/journey/flow.test.js`: the engine (states, edges, enough, proof beats sequence, sticky, events, zero
  context) and the owner's walk.
- `test/tower/graph.test.js`: the flow has no app/tab/container nodes, the new store, the trading store with
  live nodes, a new area drawn with no code change, the view, a moment's coins.
- `test/control-tower/stack.test.js`: live cards from the rules.

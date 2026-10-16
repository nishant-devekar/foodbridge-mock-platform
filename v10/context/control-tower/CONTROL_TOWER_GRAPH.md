> **Superseded 17 Oct 2026 by [CONTROL_TOWER_FLOW.md](CONTROL_TOWER_FLOW.md).** The owner rejected this design: app, tabs, area containers and milestones don't belong in the graph. The tower now walks a flat flow of steps (fb.journey/2). Kept for the record.

# Control Tower · one graph drives the whole tower

17 Oct 2026. The owner said: "establish the engine for end to end control tower where nothing is statically
defined and everything is driven from contract tree JSON … if JSON tree updated then whole context gets updated
and engine has nothing to do with JSON context."

## Three layers

| Layer | File | Knows |
|---|---|---|
| **Graph** | `assets/tower/graphs/control-tower.json` (contract `fb.journey/1`, schema `assets/journey/fb.journey-1.schema.json`) | Everything with meaning (see below) |
| **Engine** | `assets/journey/engine.js` | Nothing. It walks nodes and edges on facts: locked, available, done, skipped; focus, next, blockers |
| **Runtime** | `assets/tower/runtime.js` and `assets/ct/stack.js` | Nothing. They read fields (`payload.view`, `payload.area`, …), never names. A test fails if either mentions an area or a business word |

The screen (`screens/control-tower.js`) draws what the runtime hands it. It has no list of areas, tabs, words,
icons, colours or ranks.

## What lives in the graph

- **Tabs** (`payload.view`: feed, board, wallet or menu; `icon`; `home`). The footer, the desktop navigation, the
  top bar and the page the tower opens on.
- **Areas** (`payload.area`):
  - `label` (Business), `word` (rings and cards), `icon`, `colour` {deep, bright, tint};
  - `rank` (what closes first on Now) and the graph's own sequence (Business);
  - `source` (where its rows come from);
  - `feed` {noun, groups, kickers, families}: how alike rows become one card and read;
  - `board.line` (its card on Business) and `open` (ask in place, then go to a route).
- **Steps** under each area, with their gates (`requires`, `skip`, `done` on facts), coins and ways in.
- **Milestones**: `store-ready` (done on setup or on a first order, sticky) and `running`.
- **Text rules** on the app node: names written in title case, units kept, catalogue notes dropped, codes never
  shown.

## One graph for a store's whole life

The facts decide where a store stands; the graph is the same for every store:

- **A new store** (More → Start as a new store, or `?journey=new`) walks the graph on its own facts, with
  `store.new` true. Only Products opens, then Customers, then Orders when the store is ready, and so on. Each area
  shows its steps as cards.
- **The trading business** walks the graph on facts read from its records (`assets/ct/journey-facts.js`, with
  `store.new` false and `business.makes`). Its areas open on proof: 176 orders open Orders even with one
  customer to fix. The setup areas are skipped, and each area's cards come from its source (`lever:<id>`).

## Change the graph, change the tower

- Edit `control-tower.json`, or hand the tower a graph at runtime: `FBControlTower.api.graph.inject(graph)`. It
  validates first, keeps the graph on this device, and redraws everything: tabs, rings, cards, Business, colours,
  order. `api.graph.reset()` goes back to the file. Another open tab follows through storage.
- Tested in `test/tower/graph.test.js`:
  - a new store, a ready store and a trading business;
  - renaming an area, re-ranking it, hiding one, renaming a tab;
  - adding an area the code has never heard of.
- Seen in the preview: renaming Collections "Money in", recolouring and ranking it first, skipping Production
  and renaming Now "Today". The rings, cards, Business board and footer followed with no code change.

## What stays code, on purpose

- **Data sources.** `lever:<id>` is the tower's lever model over the platform's records (`assets/ct/levers.js`,
  incidents, signals). `products` and `store-activation` are the new store's data. The graph names a source; the
  source turns records into rows.
- **Facts.** `assets/ct/journey-facts.js` is the one place that reads the business into facts.
- **A row's own card.** The delivery modal, the customer and product sheets, the product fix and the step
  sheet, chosen by the row's kind. They are the platform's record screens; the graph decides which rows reach
  Now and what their buttons say.
- **The views.** Rings, feed, card, board, wallet and menu: generic pieces a tab names.

## Files

| File | |
|---|---|
| `assets/tower/graphs/control-tower.json` | the graph (v2.0.0, 39 nodes) |
| `assets/tower/runtime.js` | `FBTower.read(ev)`, `stackOpts`, `fill` |
| `assets/ct/stack.js` | Now's stack, rules from `stackOpts` |
| `assets/journey/engine.js` | the walker, unchanged |
| `test/tower/graph.test.js`, `test/control-tower/stack.test.js` | the graph's walks; zero context |
| `assets/journey/graphs/store-journey.json` | the earlier setup-only graph, kept for the Journey Lab and its tests |

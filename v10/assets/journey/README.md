# Journey engine — `fb.journey/1`

A graph walker with **zero business context** (15 Oct 2026). It is handed a graph (JSON) and a
plain facts object. It says which nodes are locked, available, done or skipped, where the user
stands, where they came from, what to do next and what holds a node back. It names no business:
`test/journey/engine.test.js` fails if the engine's source ever mentions products, customers,
orders, deliveries, collections, stock, invoices or levers.

All meaning lives in the graph's own `type` and `payload` fields, which the engine passes through
untouched to whoever draws the screen. You get a new area, a new flow, a rotation of areas, or a
graph Claude writes from a store's database by writing new JSON, never by changing `engine.js`.

| File | What |
| --- | --- |
| `engine.js` | the engine, `window.FBJourney` / `require()` |
| `graphs/store-journey.json` | the store journey (proposal: `context/control-tower/CONTROL_TOWER_JOURNEY.md`) |
| `../ct/journey-facts.js` | the one place that knows the business: a tower pass → facts |
| `../../screens/journey-lab.html` | inject a graph and facts, watch it walk |
| `../../test/journey/` | `node --test test/journey/*.test.js` |

## The graph

```json
{
  "schema": "fb.journey/1",
  "id": "store-journey",
  "version": "1.0.0",
  "label": "Store journey",
  "settings": { "doneNeedsOpen": false },
  "nodes": [
    { "id": "setup", "type": "chapter", "payload": { "pins": ["products", "customers"] } },
    { "id": "products.added", "type": "stage", "parent": "setup",
      "done": { "fact": "products.count", "gte": 1 } },
    { "id": "products.fixed", "type": "stage", "parent": "setup", "requires": ["products.added"],
      "done": { "all": [ { "fact": "products.count", "gte": 1 }, { "fact": "products.broken", "eq": 0 } ] } }
  ],
  "edges": [ { "from": "a", "to": "b", "kind": "next" } ]
}
```

### Node fields

| Field | Meaning to the engine |
| --- | --- |
| `id` | unique; any string |
| `type` | **opaque**; returned as-is (chapter, area, stage, incident, screen… whatever the screen draws) |
| `parent` | makes a tree. A child is never available inside a locked parent |
| `requires` | node ids that must be done (or skipped) before this one opens. Shorthand for `requires` edges |
| `join` | `"all"` (default) or `"any"`: how `requires` sources combine |
| `available` | an extra gate (condition) on opening |
| `done` | a condition; or `"children"` (default for a node with children: every required child done or skipped); or `"children:any"`. A leaf with no `done` is done when **marked** with its own id |
| `skip` | a condition; when true the node is `skipped`, and so is everything under it. A skipped node counts as passed for whatever it gates |
| `optional` | true: doesn't hold its parent's `"children"` rule, isn't counted in progress, and only takes the focus when no required work is open |
| `sticky` | true: once done, stays done even if the facts later drop (a milestone proven once) |
| `priority` | number; lower comes first among siblings (default 0, then listing order) |
| `label` | for people; defaults to the id |
| `payload` | **opaque** object; returned as-is |

### Edges

`{ "from", "to", "kind" }`. `kind` is `"requires"` (default) or `"next"`:

- **`requires`** gates `to`. These must never loop. Validation also catches the loops that run
  through a parent, such as a child that requires its own container.
- **`next`** only says what follows, for `next()` and `prev()`. It may loop (a daily round, a rotation).

### Conditions

JSON only, no code:

| Form | True when |
| --- | --- |
| `true` / `false` | always / never |
| `{ "all": [c…] }` · `{ "any": [c…] }` · `{ "not": c }` | the usual |
| `{ "fact": "a.b.c", "<op>": v }` | the fact at that dotted path passes every op given. Ops: `eq ne gt gte lt lte in nin exists truthy contains`. `v` may itself be `{ "fact": "other.path" }`. A missing number never passes a comparison |
| `{ "node": "id", "is": "done" }` | that node is in that state (or in one of a list) |
| `{ "mark": "key" }` | the snapshot holds that mark (`J.mark`) |

### States, in the order the engine decides them

1. **skipped**: its parent is skipped, or its `skip` holds.
2. **done**: its `done` holds, or it is sticky and was done before. This applies even while it is
   still locked, so a store that already has the records jumps ahead. Set `settings.doneNeedsOpen`
   to make nothing count before it opens.
3. **available**: `requires` met, parent not locked, `available` holds.
4. **locked**: otherwise.

The engine evaluates every node, repeating until nothing changes, so a node may test another
node's state.

**The focus** is the first available leaf in tree order (by priority, then listing order),
required work before optional.

## Snapshots: where the user stands

The engine keeps no state. A snapshot is plain JSON the caller stores and hands back:

```json
{ "schema": "fb.journey/1", "graph": "store-journey", "version": "1.0.0",
  "cursor": "products.fixed", "follow": true, "trail": ["setup"],
  "states": { "…": "available" }, "since": { "…": 1792070000000 },
  "doneAt": { "products.added": 1792070000000 }, "marks": { "skip:purchase": 1792070000000 }, "seq": 4 }
```

- **`cursor`** is the node the user stands on. It follows the focus until the user steps somewhere
  themselves (`goto`, `back`); `follow()` hands it back.
- **`trail`** is where they came from (the back stack, last 50).
- **`marks`** are things the user or the platform said, the only state that isn't derived from facts.
- **Another graph** (a new version, a rotation) can take over a snapshot. It keeps the marks and
  done times for the ids it still has, and drops a cursor that points at a node it doesn't have.

## API

```js
const J = FBJourney.load(graph);          // validates; throws JourneyError { errors: [{ path, message }] }
FBJourney.validate(graph);                // → { ok, errors } — every error at once, each with its JSON path

const ev = J.evaluate(facts, snapshot);   // read-only answers:
ev.state(id) · ev.states · ev.node(id) · ev.nodes({ type, payload: {…} })
ev.focus(scopeId?) · ev.frontier(scopeId?) · ev.focusAt(depth)
ev.next(id) · ev.prev(id) · ev.path(id) · ev.children(id) · ev.parent(id) · ev.roots()
ev.blockers(id)    // → { nodes: [ids not done], gate: bool, parent: locked ancestor | null }
ev.progress(id?)   // → { done, total, ratio } over required leaves

const r = J.step(snapshot, facts, now);   // → { snapshot, events, ev }
// events since the last step (none on the first, since loading is not news):
// { type: "node.available" | "node.done" | "node.reopened" | "node.locked" | "node.skipped",
//   node, nodeType, from, at, payload }

J.goto(snapshot, id) · J.back(snapshot) · J.follow(snapshot) · J.mark(snapshot, key, on, now)
J.where(snapshot, facts)   // → { at, path, from, children, next, prev, focus, progress }
                           //   each node with its state, blockers and progress
```

Events are what other modules listen to. A rewards module reads `payload.reward` on
`node.done`; the Timeline turns `node.available` into "Orders is open"; the team's feed sends
`payload.event` ("store.active") onward. None of that is the engine's business.

## Writing a graph (by hand, or by Claude)

1. **Facts first.** Decide the facts the graph will test, as a flat-ish object of numbers and
   booleans. For the Control Tower they come from `assets/ct/journey-facts.js`. A graph written
   from a store's database can bring its own; the names are a convention, not something the engine
   checks.
2. **"None missing" needs "something there".** `{ "fact": "products.broken", "eq": 0 }` holds in an
   empty store. Pair it with `{ "fact": "products.count", "gte": 1 }`, or with the node that
   proves the thing exists (`test/journey/store-journey.test.js` checks that nothing is done in
   an empty store).
3. **Done is proof, not a tap.** Use facts. Use a mark only for what no record can show (a choice,
   "not for my business").
4. **Types and payloads are yours.** The screen decides what `"type": "area"` and
   `"payload": { "area": "collections" }` mean. The engine never looks.
5. **Validate, then inject.** `FBJourney.validate()` returns every problem with its JSON path, so
   a model can fix a whole graph in one pass. Paste it into the Journey Lab, or call
   `FBJourneyLab.inject(graph, facts)`.

### What the Control Tower reads (a convention of `store-journey.json`, not of the engine)

`assets/ct/journey-view.js` reads these fields. It never reads a node id, so any graph that keeps
to them draws, whatever its nodes are called.

| Where | `payload` field | What the tower does with it |
| --- | --- | --- |
| a root node (chapter, milestone) | `line` | the line under the greeting while it is the chapter |
| | `pins` | the footer's two areas (`["products", "customers"]`) |
| | `mode: "running"` | home is today's tower again |
| any node | `area` | this node is that area of the tower: one card, one footer slot, one step sheet |
| | `locked` | the locked row's reason ("when your store is ready"); otherwise built from its blockers |
| | `announce` | `{ on: "available" \| "done", title, line, button, open }`: the unlock sheet for that moment. `open` is the area its button opens |
| a step under an area | `ask`, `how` | the step sheet's title and helper line; `ask` is the card's line |
| | `count` + `say` | `say` with `{n}` replaced by the fact named in `count` ("3 would break an order") |
| | `screen` | `{ route, label }`: the green button, opening that platform screen |
| | `demo` | `{ label, facts }`: in the new-store demo, a button that merges these facts in, as if the step were done |
| | `reward` | `{ freeDays }`: shown on the step; summed on the unlock sheet or a toast when it is done |
| | `flow` | `{ module: "store-activation", step, mode }`: the green button opens that module's own modal over the tower (`modules/foodbridge-store-activation`) |
| | `action` | the green button's words ("Add your products") |
| | `cheer` | what the assistant says over the step, in the step sheet |

**The new-store demo.** More → Start as a new store, or `#/control-tower?journey=new`, starts it.
More → Back to the demo business, or `?journey=off`, leaves it. Its facts are its own
(`fb.v7.ct.journey.demo`) and the live demo business is untouched. A store the owner connects
would bring real facts through `journey-facts.js`; that depends on decision D1.

**Injecting a graph.** `FBControlTower.api.journey.inject(graph, facts?)` validates the graph and,
when it is valid, keeps it (`fb.v7.ct.journey.graph`) in place of the file and redraws the tower.
It returns `{ ok: false, errors }` otherwise and changes nothing.
`FBControlTower.api.journey.reset()` goes back to the file. The Journey Lab's `FBJourneyLab.inject`
does the same for the lab.

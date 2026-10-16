# fb.journey/2 — a store's flow

17 Oct 2026. The contract the flow engine (`flow.js`) walks. A flow is a flat list of nodes joined by edges.
Each node is one thing to do. The engine knows only nodes, edges, conditions on facts and five states. It
never reads what a node is about.

## A flow

```json
{
  "schema": "fb.journey/2",
  "id": "store-journey",
  "label": "Store journey",
  "version": "2.0.0",
  "areas": { "products": { "label": "Products", "word": "Products", "icon": "tag",
                           "colour": { "deep": "#A04A05", "bright": "#E3940B", "tint": "#FFF2DC" } } },
  "nodes": [ … ]
}
```

`areas` is how each area looks on the tower, in the sequence its rings and the editor's lanes take. The
engine ignores it. A node's `area` names one of them.

## A node

```json
{
  "id": "fix-products",
  "label": "Fix products",
  "area": "products",
  "after": ["add-products"],
  "join": "all",
  "when":   { "fact": "store.new", "truthy": true },
  "enough": { "fact": "products.correct", "gte": 5 },
  "done":   { "all": [ { "fact": "products.correct", "gte": 5 }, { "fact": "products.broken", "eq": 0 } ] },
  "skip":   { "not": { "fact": "business.makes", "truthy": true } },
  "sticky": false,
  "card":   { "title": "Fix products", "ask": "Get 5 products ready to sell", "say": "{n} ready to sell",
              "count": "products.correct", "action": "Fix now", "coins": 100,
              "screen": { "route": "#/product-master/finished-goods", "label": "Finished Goods" } }
}
```

| Field | Read by | Meaning |
|---|---|---|
| `id` | engine | Unique. Other nodes name it in `after` and in `{ "node": … }` conditions |
| `after` | engine | The edges in: the nodes it comes after. None means it is open from the start |
| `join` | engine | `all` (default): every edge must pass. `any`: one is enough |
| `when` | engine | An extra gate on facts, on top of the edges |
| `enough` | engine | The minimum. When it holds, the nodes after it open and it stays open as optional |
| `done` | engine | When it holds the node is finished. Proof beats sequence: it holds even before its edges pass |
| `skip` | engine | Not for this store. A skipped node passes its edges like a done one |
| `sticky` | engine | Once done, it stays done even if the fact later drops |
| `label`, `area`, `card` | the tower | Never read by the engine |

## States, and how a node gets one

Per node, in this sequence:

1. `skip` holds → **skipped**
2. `done` holds (or `sticky` and it was done before) → **done**
3. an edge in has not passed → **locked** (an edge passes when its node is enough, done or skipped)
4. `enough` holds → **enough** (optional)
5. otherwise → **open**

`enough: true` makes a node optional from the moment it opens.

## Conditions

JSON only: `true`, `false`, `{ "all": […] }`, `{ "any": […] }`, `{ "not": c }`,
`{ "fact": "dotted.path", "<op>": value }` with op one of `eq ne gt gte lt lte in nin exists truthy contains`
(a value may be `{ "fact": "other.path" }`), and `{ "node": "id", "is": "done" | ["enough", "done"] }`.

## The card (what the tower shows)

`title` (`{n}` is the `count` fact), `ask`, `how`, `say` (the progress line, `{n}` again), `count` (a fact
path), `action` (the button), `coins`, `screen` `{ route, label }`, `flow` (a module the tower opens), `demo`
`{ label, facts }` (the new-store demo), `announce` `{ on: "open" | "done", title, line }`.

## Facts

The tower reads a store's records into facts (`assets/ct/journey-facts.js`): `products.count`, `.broken`,
`.correct`, `.incomplete`; `customers.count`, `.broken`, `.correct`, `.incomplete`, `.noTerms`;
`orders.count`, `.days`, `.sent`; `deliveries.count`, `.vans`; `payments.count`; `dues.imported`;
`stock.counted`, `.unknown`; `suppliers.count`; `purchases.count`, `.received`; `production.recipes`, `.batches`;
`business.makes`; `store.new`. A flow written from a store's database may bring its own facts; the names
are a convention, not something the engine checks.

## Live work

On a trading store, `assets/tower/writer.js` adds the store's live work (a missed drop, a payment due) as
nodes: `id` `live-…`, the card's area, `after` the first node of that area, `done` when the fact
`live.<id>` is gone. Urgent ones go before the journey, the rest after it. This is the stand-in for Claude
writing a store's nodes from its database: whatever writes them, the engine walks the same way.

## The API

```js
FBFlow.validate(flow)              // { ok, errors: [{ path, message }] }, every problem with its JSON path
const F = FBFlow.load(flow)        // throws FlowError when not valid
const ev = F.evaluate(facts, snap) // state(id) node(id) nodes() open() focus() blockers(id) next(id) prev(id) progress() areas()
F.step(snap, facts, now)           // { snapshot, events: [{ type: "node.<state>", node, from, to }], ev }
```

`open()` is what to do now (open nodes, then optional ones), each in the flow's listing order. The tower's
Now shows exactly that list.

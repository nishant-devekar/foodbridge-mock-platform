# v7 → the unified journey

What `v7` is today, what the unified journey needs, the gap between them, and the order to close it in. Plus the full WhatsApp configuration required to make the flow work.

Reads on from [`foodbridge-unified-journey.md`](foodbridge-unified-journey.md). Source detail in [`foodbridge-master-reference.md`](foodbridge-master-reference.md).

**Everything stated about v7 below was read from the cut on 19 September 2026**, at `e3f2fd3`. Where I am asserting a design decision rather than reporting code, it says so.

---

## Part 1 — The constraint, and what it changes

> **The IVR helps you choose things and ends with a link to the app.**

This is a much smaller WhatsApp than the unified journey assumed, and it is worth being precise about what it deletes, because it deletes a lot — and almost all of it was the expensive part.

### What leaves WhatsApp

| Unified journey had | Under the constraint |
|---|---|
| 08:05 — Buyer orders in chat: *"Need 10 atta, 6 oil and 4 tea"* | IVR routes to an order screen. **No NLU, no cart in chat** |
| 15:00 — credit negotiated across two conversations | IVR routes both parties to the same record in the app |
| Agent explains evidence conversationally | Headline + link. **The explaining happens on the screen** |
| Free-text questions answered in chat | Not supported. The menu is the whole vocabulary |

### What WhatsApp keeps — and it is still the front door

1. **Identity.** The phone number *is* the identity — `whatsappUserResolverService` already resolves `wa_id` to a user and a role.
2. **Routing.** One tap, from a flat menu, to one destination.
3. **The link.** A `cta_url` message carrying a URL into the app.
4. **Push.** Possible, but only through an approved template — see §5.7.

### The IVR is not hypothetical — it is running

`cafex-backend/whatsapp/` already implements all of this: a webhook, a user resolver, a role resolver, a two-state orchestrator and an outbound service. **It is not being modified.** The whole of Part 5 is therefore about *configuration* — what to put in the `whatsappIvrFlow` document in Mongo — and not about building anything.

Two facts from that code shape everything below, and both are tighter than the unified journey assumed:

- **The menu is flat.** Two states, `MAIN_MENU` and `AWAITING_SUPPORT_TEXT`. No submenus, no nesting.
- **A menu holds at most 10 rows**, and static-link buttons carry a *fixed* URL with no per-user substitution.

### The consequence that should drive every decision below

**Under this constraint the entire value of the IVR is the quality of the link.** A menu that ends on a generic dashboard is a worse experience than no menu at all, because the user tapped to arrive somewhere they could have bookmarked. A menu that ends on *the 23 shops past their cycle, longest overdue first* is the product.

So the v7 question is not "can we build a chatbot". It is:

> **Can v7 be addressed from outside — by route, and later by role and record — and land someone in a working, specific state?**

Today the answer is *by route, yes, and nothing else*. That is enough to wire the whole pull path this week, and it is the axis the rest of this document runs along.

---

## Part 2 — What v7 actually is today

### 2.1 Two things in one folder

**A. A nine-screen new-user onboarding flow** — the thing v7 was cut for.

```
Sign Up → Where is your data? → Connect your account → Importing
   → Data found → Data check → Ready → Create order → Order created
```

Real: the Zoho Books sign-in and read through the bridge, Excel/CSV read in the browser, GST verification, the reorder engine. Simulated: Tally, Vyapar, document scan, extraction. Held in this browser only: the account, the orders created.

**B. A 26-destination platform shell** wrapping 14 module mockups — dashboard, products, customers, stock audit, sales orders, route planning, delivery, production, inventory, procurement, finance, workforce.

### 2.2 The runtime, and the warning attached to it

`index.html` frames each destination in an **iframe** from `modules/<repo>/…`, hiding each module's own sidebar with a per-destination `clipLeft` offset. Four different offset values are in use, every one measured in a browser rather than derived.

`context/MASTER.md` is explicit about this:

> *"That is **inherited**, not chosen. … **Do not extend it.** Adding a destination by measuring another offset, or composing a new screen in an iframe, is rebuilding the architecture this repository left behind."*

There is a worked alternative already in the tree — `experiments/shell-free-app/`, the same Stock Audit product with the 256px offset and the iframe replaced by three CSS rules. **It is a probe, not a version, and it is where a move off the shell should start.**

This matters here because several things the unified journey needs — a role-scoped session, a context layer every screen reads, a nudge surface that spans modules — are exactly the things an iframe-per-module shell makes hardest.

### 2.3 What is genuinely strong

Three things in v7 are better than the unified journey assumed they would be:

**The data is real.** 86 products, 40 B2B shops, 532 orders across 39 of them — the tenant's own Zoho export, two years to 2026-08-24. Not seeded plausibles.

**The signal engine is real and live.** Cadence, stock and reorder signals are computed from those records *at render time against the live clock*. Every figure moves with the calendar. This is beat ① and beat ② of the loop, already built, on real data.

**One write path reaches a real external system.** Stock Audit → Predictive Sales Order creates an actual Zoho Books sales order through the bridge.

`v7` also already has the honesty discipline the journey needs: `context/STATUS.md` lists every simulated boundary in a table, and the flow "will never invent a result to cover for a boundary" — offer it an unreadable document and it says nothing could be read.

### 2.4 What the demo exit already does

`assets/exit-demo.js` is one shared asset mounted on five screens — Finished Goods Inventory, Raw Material Inventory, Customer Receivables, Supplier Payables, and Delivery Management (which calls `FB_EXIT.open()` from its own chrome). It draws the footer bar and the end-of-demo sheet.

It already knows about the IVR: `WA_NUMBER = "919988087779"`, and it hands off with `whatsapp://send` first, falling back to `wa.me` after 1.4s if the document is still there.

**The traffic is one-way.** v7 sends people *to* WhatsApp. Nothing comes back the other way — there is no inbound link handler, no session-from-link, no identity from a `wa_id`.

---

## Part 3 — The gap

### 3.1 By lane

| Lane | v7 today | Gap |
|---|---|---|
| **Visitor** | Sign Up screen: name, business, mobile, GSTIN, with **real GST verification**. No OTP. | No WhatsApp entry. Identity is a form, not a phone number. **OTP does not exist** |
| **Explorer** | **Best-built lane.** `Continue as guest` from sign-up and from Log in, guest held in `sessionStorage` under `fb.v7.guest` separate from `fb.v7.account`. A **Sample data** channel so nobody stalls on screen 2 | No module-demo entry points. The Guest IVR's *"Explore Delivery / Collections / Inventory"* has nothing to link to that is scoped as a demo |
| **Operator** | 26 destinations, real data, real cadence engine | **It is a nav tree, not a loop.** No Control Tower, no ranked "what needs attention", no nudges outside onboarding |
| **Field** | Delivery Management is the **real ported route-delivery app** — 23 screens, stops, collection, settle, its own models and validation | No invite, no role, no scope. Anyone can open it from the sidebar. A field user would see receivables and purchase orders |
| **Buyer** | `retails-overview` standalone storefront, reachable by Store QR | **Unparented.** No identity, no store relationship, no order tracking, no offers tied to a customer |

### 3.2 By beat — where the loop is open

| Beat | v7 | Verdict |
|---|---|---|
| **① Signal** | Cadence/stock/reorder computed live from 532 real orders | **Built** |
| **② Detect & rank** | S04 Business Pulse ranks evidence, picks the dominant signal — *"23 shops haven't ordered as usual"* | **Built, but trapped inside onboarding and run once** |
| **③ Reach** | — | **Absent.** No push, no inbound channel |
| **④ Understand** | S05 opens one opportunity well: 23 shops, longest overdue first, cadence, days overdue, what it buys | **Built for one opportunity. The other 26 destinations explain nothing** |
| **⑤ Decide** | Create Order's two-tap confirm | **Absent as a system.** No policy, no risk level, no approval model |
| **⑥ Execute & verify** | Real Zoho sales order via the bridge | **Half.** Execution is real; there is no read-back verification |
| **⑦ Record & learn** | Feedback queue (`fb.v7.feedback.queue` / `.log`) | **Absent for business outcomes.** Feedback is about the demo, not the business. No snapshot store |

**The shape of the gap:** v7 has beats ① and ② built better than expected, on real data, and beats ③ ⑤ ⑦ not at all. The loop is open at both ends — nothing reaches the user proactively, and nothing is remembered after they act.

### 3.3 The architectural gap that gates the rest

**There are 15 separate seed files.** Each module carries its own data. Modules cannot see each other's state.

The canary is already documented. From `context/STATUS.md`:

> *"`orderingStatusFor()` has **two implementations** — the field tool's and the evidence layer's (D-016). They agree today. If one changes the other is wrong, and the two screens would disagree about the same shop."*

That is the unified journey's central requirement failing in miniature. The journey needs **one business context that every lane reads and writes**; v7 has fourteen module folders each with its own copy of the truth, and the same derived fact already computed twice.

> **This is the gate.** A Control Tower that ranks nudges across orders, stock, receivables and routes cannot be built on fifteen seeds. Nor can a Field session that is a scoped view of the same data, nor a Buyer view parented to a store. **Extracting the context layer is the prerequisite for four of the five lanes.**

### 3.4 The deep-link gap — and the good news

The unified journey's whole front door is deep links. What does v7 support?

**Routing exists and is decent.** `platform.js` resolves `#/<route>` and, for grouped items, `#/<group>/<leaf>`. Standalone destinations are addressable by `#/<id>`. There is already a convention for a one-time parameter after the route — `#/onboarding?signup=1` and `#/onboarding?zoho=connected&…` — and `routeFromHash()` deliberately preserves the query so the module can read and clear it.

**So most IVR leaves can be wired to real, working URLs today.** This is the single most encouraging finding in this analysis:

| IVR destination | Works today |
|---|---|
| Receivables / collections | `#/finance/customer-receivables` |
| Sales orders | `#/sales-orders` |
| Stock audit | `#/customer-management/stock-audit-health` |
| Today's route | `#/distribution-logistics/delivery-management` |
| Route planning | `#/distribution-logistics/route-planning` |
| Inventory | `#/inventory/finished-goods-inventory` |
| Purchase orders | `#/procurement/purchase-orders` |
| Storefront (Buyer) | `#/retails-overview` |
| Onboarding, forced to sign-up | `#/onboarding?signup=1` |
| Order drafts | `#/order-drafts` |

**What is missing from every one of those links:**

1. **No identity.** Nothing carries *who* is arriving. `signup=1` actively *clears* the account.
2. **No role.** Persona is a sidebar `<select>` defaulting to `manufacturer` — a UI filter, not a session property.
3. **No record or filter.** There is no `#/sales-orders?order=SO-1042`, no `#/finance/customer-receivables?customer=C-17`.
4. **No return.** Nothing marks a session as having come from WhatsApp, so nothing can send it back with an outcome.

---

## Part 4 — The migration

Six stages. Each ships something demonstrable; nothing is built before the thing it depends on.

```
  A  the door         link grammar · session from link · role in session
        ↓
  B  one context      15 seeds → 1 read model · collapse orderingStatusFor()
        ↓
  C  the tower        S04's ranking promoted out of onboarding, runs every load
        ↓
  D  the lanes        Field scoped · Buyer parented · Explorer demo entries
        ↓
  E  the write path   confirm envelope · read-back verify · snapshot store
        ↓
  F  push             templates · scheduler · the 07:15 message
```

### Stage 0 — Wire the IVR to what exists (this week, config only)

Before any of the above, and **this is the stage you are actually on.** The routes in §3.4 work right now, and the running IVR can point at them with no code change — static-link buttons in `whatsappIvrFlow`, per Part 5.

That makes the demo a WhatsApp-first product immediately: unauthenticated, unscoped, unpersonalised, same link for everyone, but real and clickable end to end. It also makes every later stage testable against a live IVR rather than against a spec.

**Ready-to-paste config is in §5.5.**

### Stage A — Make the door real *(backend work — not yet)*

Everything in Stage A needs changes to `cafex-backend/whatsapp/` or to the bridge. **It is the destination, not the next step**, and it is listed here so the Stage 0 config is understood as a deliberate floor rather than the finished thing.

**A1. Link grammar.** One shape for every link the IVR emits:

```
https://<host>/v7/#/<route>?t=<token>&r=<record>&f=<filter>&src=wa
```

| Param | Meaning |
|---|---|
| `t` | One-time session token. Short TTL, exchanged on first load for a session, then stripped from the address |
| `r` | Record to open — order id, customer id, route id |
| `f` | Filter or view to apply on arrival |
| `src` | Always `wa` from the IVR. Marks the session as having come from WhatsApp |

**A2. Session from link.** A handler in `platform.js` that reads `t`, calls the bridge to exchange it, writes `fb.v7.session`, and `history.replaceState`s the token out of the URL. Follow the pattern `takeSignupFlag()` already establishes — read the flag off the platform hash, act, wipe it so a reload is not a second application.

**A3. Role in the session, not in a dropdown.** `{ role: "owner" | "staff" | "customer", storeId, userId }`. The sidebar is then *rendered from the role* rather than being the whole platform with a persona filter. A `staff` session gets Delivery Management and nothing else.

**A4. Record-addressable destinations.** Each module that the IVR can land on accepts `r` and `f` and honours them on load. Start with the four that carry the demo: receivables, sales orders, stock audit, delivery.

> **Security note, said plainly.** A token in a URL is logged by proxies and lands in browser history. For a prototype this is an acceptable trade; for anything real, make it single-use, TTL it in minutes, bind it to the `wa_id` it was issued for, and exchange it for an `HttpOnly` cookie on first load. Do not let `t` be a long-lived credential.

> **What A1–A4 cost on the IVR side.** The orchestrator sends a static `url` verbatim — `{userName}` and friends are substituted into message *bodies*, never into the link. So per-user links mean either a new smart-code event in `shortCodeService.smartCodeEventEnum` (the mechanism `AUTO_LOGIN` already uses, and the cleaner fit), or templating in the `url` field. Both are implementation changes. **Until one of them lands, every v7 link is the same for every user** — which is exactly why the Stage 0 config targets the default flow.

### Stage B — One context, not fifteen seeds

**B1.** `assets/context.js` — a single read model over the tenant: customers, products, orders, plus the derived layer (cadence, stock position, reorder signal, ordering status).

**B2.** Collapse the **two** `orderingStatusFor()` implementations into it. D-016 already flags this as a live hazard; it is the cheapest possible proof that the context layer earns its place.

**B3.** Repoint the demo-carrying modules at it, in this order: dashboard → sales orders → stock audit → delivery → receivables. Leave the rest on their seeds until they are needed.

> Do this **without** extending the iframe shell. Where a screen needs to be composed rather than framed, start from `experiments/shell-free-app/`, per MASTER.md.

### Stage C — The Control Tower

**C1. Promote S04.** The Business Pulse ranking already picks the dominant truthful signal. Lift it out of onboarding into a standalone destination that recomputes on every load.

**C2.** Give it the nudge model from the build spec — `id · category · title · explanation · evidence · urgency · confidence · potential_impact · recommended_action · expires_at · status · feedback` — and the ranking formula, with suppression for recently dismissed and already-actioned.

**C3.** This screen is what *"Foodbridge Recommends"* links to. It is the single most important destination in the whole IVR, because it is the only one whose content the user could not have predicted.

> **Say the cadence/cash thing out loud.** D-015 records that this tenant has no invoice, payment or cost evidence, so receivables, overdue value and margin **are not drawn at all** — not zeroed, not greyed. The dominant signal here is cadence, not cash. The IVR's menu copy must match: *"23 shops are off their usual cycle"*, not *"₹2.1L overdue"*. Promising rupees the data cannot support is the fastest way to lose a demo.

### Stage D — The lanes get their own doors

**D1. Field.** Operator invites a staff member → bridge issues a token → WhatsApp delivers it → the link opens Delivery Management in a **role-scoped session with no sidebar**. The app is already built and ported; the work is entirely scope and session.

**D2. Buyer.** Parent `retails-overview` to a store and a customer. Store QR already exists and already deep-links — it needs identity behind it.

**D3. Explorer.** Demo entry points at the hours the unified journey specifies — Delivery enters at route prep, Collections at the collection nudge, Inventory at stock-vs-demand. A `demo` flag on the context that **disables outbound sends** and marks the surface.

### Stage E — Decide, verify, record

**E1.** A confirmation envelope around the real write path (Stock Audit → Zoho sales order): action type, actor, parameters, approval, idempotency key.

**E2.** Read-back verification after execution. Today the order is created and believed; `get_salesorder` after the write is a small change with a large honesty dividend.

**E3.** A snapshot store, so *"what changed since last time"* has an answer. This is what turns a demo into a loop.

### Stage F — Push

Last, because it depends on everything above and on WhatsApp approvals that take days. Details in Part 5.

---

# Part 5 — WhatsApp configuration

**Revised after reading the running IVR.** The IVR is already built, in `cafex-backend/whatsapp/`. This section is no longer "what to build on the WhatsApp Business Platform" — it is **what to put in `whatsappIvrFlow` to point the existing IVR at v7, without touching a line of its implementation.**

Everything below was read from `cafex-backend/whatsapp/` on 19 September 2026.

## 5.1 What the existing IVR actually is

```
inbound message
      ↓
whatsappWebhookController → whatsappUserResolverService (wa_id → user)
      ↓
ivrOrchestrator — a TWO-STATE machine
      ├── MAIN_MENU              greeting + one flat button list
      └── AWAITING_SUPPORT_TEXT  free-text captured and forwarded
      ↓
reply: text · interactive_buttons · interactive_list · cta_url
```

**It is a flat, one-level menu.** There are no submenus, no nesting, no "back". Every path is: greeting → one list → a `cta_url` message with a link. Then straight back to `MAIN_MENU`.

That is a tighter constraint than the menu trees I specified before, and it is the right one to design to. The trees in the unified journey — Explorer → module → demo, Operator → category → record — assumed depth the orchestrator does not have.

### Where the config lives

```
1. DEFAULT_IVR_FLOW  (whatsapp/services/ivrFlows/defaultCommerceFlow.js)  ← lowest
2. globalConfig.APP.whatsappIvrFlow                                       ← platform-wide
3. orgConfig.whatsappIvrFlow                                              ← per tenant
4. whatsappIvrFlow.roles[ROLE_NAME]                                       ← partial, on top
```

MongoDB, not code. **All merges are shallow** — a `buttons` array in a higher layer *replaces* the lower one entirely. It never appends.

## 5.2 The mechanism you are using — static-link buttons

This is the part that makes the whole approach work with zero backend change. From `ivrOrchestrator.js`, a button is one of three kinds, checked in order:

| Kind | Condition | What happens |
|---|---|---|
| Support | `id === "SUPPORT"` | Switches to `AWAITING_SUPPORT_TEXT` |
| **Static link** | **button has a `url` key** | **`url` is sent as-is in a `cta_url` message. `id` is freeform** |
| Smart link | otherwise | `id` must match a `smartCodeEventEnum`; a per-user link is generated |

```jsonc
{ "id": "V7_ATTENTION", "title": "What needs attention",
  "description": "See what FoodBridge noticed in your business",
  "url": "https://nishant-devekar.github.io/foodbridge-mock-platform/v7/#/dashboard" }
```

Freeform `id`, fixed `url`, body rendered from `staticLinkMessage`. **No code change, no smart-code enum entry, no per-user data.** This is the right call and it is why "default user" is the correct scope — see §5.4.

## 5.3 The hard limits, and one live trap

Enforced by `whatsappOutboundService.js`, by silent truncation:

| Field | Limit | Enforcement |
|---|---|---|
| Reply-button title | 20 | `substring(0, 20)` |
| List-row title | **24** | `substring(0, 24)` |
| List-row description | **72** | `substring(0, 72)` |
| `menuButtonLabel` | 20 | `substring(0, 20)` |
| `smartLinkButtonLabel` / CTA display text | 20 | `substring(0, 20)` |
| Buttons ≤ 3 | → `interactive_buttons` | `buildMenuReply` |
| Buttons > 3 | → `interactive_list`, **single section** | `buildMenuReply` |

> ### ⚠️ The 10-row trap
>
> `buildMenuReply` maps **every** button into rows with no cap:
>
> ```js
> rows: buttons.map((b) => ({ id: b.id, title: b.title, description: b.description || '' }))
> ```
>
> **Meta rejects a list message with more than 10 rows.** Titles and descriptions are truncated; the row *count* is not.
>
> `DEFAULT_IVR_FLOW` ships **11** buttons. `whatsappIvrFlow.json` ships **12**. Both exceed the limit, so any flow using them as-is fails to send — and it fails at the Meta API, not in config validation, so it looks like the bot has gone silent.
>
> **Keep every `buttons` array at 10 or fewer.** Since the array is replaced wholesale rather than appended to, every v7 button you add must displace an existing one. Budget accordingly: this is a 10-slot menu, and that is the single tightest constraint on the whole design.

### Template variables

Only three, and only in the places listed:

| Variable | Available in |
|---|---|
| `{userName}` | `greeting`, `supportPrompt`, `supportConfirmation`, `unknownMessage`, link messages. Falls back to **`there`** when the user is unresolved |
| `{tenantName}` | same |
| `{title}` | `smartLinkMessage` / `staticLinkMessage` only — resolves to the button's own `title` |

**`url` is not templated.** There is no substitution into the link. This is the mechanical reason the v7 links are the same for every user.

## 5.4 What "default user" buys, and what it costs

Putting the v7 buttons at the **top level** of `whatsappIvrFlow` (not under `roles`) means they apply to everyone whose role has no matching entry — and to anyone unresolved. Given static links cannot vary per user anyway, this is the correct scope. It is the cheapest correct thing.

**Be clear-eyed about what it gives up**, because two of these contradict advice in my previous draft:

| Wanted | Available? |
|---|---|
| Deep link to a v7 route | **Yes.** The whole point |
| Live counts in row descriptions — *"23 shops off cycle"* | **No.** Descriptions are static strings in Mongo. A live count needs a backend call before render, which is an implementation change |
| Per-user or per-role v7 links | **No**, not from a static `url`. Role-specific *menus* are possible via `roles`; role-specific *links* are not |
| A session/identity token in the v7 link | **No.** Nothing is substituted into `url` |
| Submenus | **No.** Two-state machine, one flat list |
| Back to menu | **Implicit** — every `cta_url` reply sets `nextStep: 'MAIN_MENU'`, so the next message re-shows the menu |

**Retract from the earlier draft:** the `/api/ivr/menu` read API and the token-bearing link grammar in Stage A both require backend work. They are the right destination, not the next step. Under this constraint the links are static and unauthenticated, and v7 must carry its own demo identity — which it already does, via `Continue as guest`.

## 5.5 A ready-to-paste config

Ten buttons exactly. Set as `globalConfig.APP.whatsappIvrFlow`, or `orgConfig.whatsappIvrFlow` for one tenant.

**Replace `<BASE>`** with your published v7 root — likely `https://nishant-devekar.github.io/foodbridge-mock-platform/v7` — and confirm it resolves before pasting.

```jsonc
{
  "greeting": "Hello *{userName}*! 👋\n\nWelcome to *{tenantName}*.\n\nI can open any part of your business. Pick one:",

  "menuButtonLabel": "View Options",
  "smartLinkButtonLabel": "Open FoodBridge",

  "staticLinkMessage": "Opening *{title}* 🔗\n\nTap below. You can come back here any time — just send a message.",

  "smartLinkMessage": "Your *{title}* link is ready! 🔗\n\nTap below to open it securely. Valid for *24 hours*.",

  "buttons": [
    { "id": "AUTO_LOGIN",
      "title": "Log in to my store",
      "description": "A secure link into your own FoodBridge account" },

    { "id": "V7_ATTENTION",
      "title": "What needs attention",
      "description": "What FoodBridge noticed in your business today",
      "url": "<BASE>/#/dashboard" },

    { "id": "V7_ORDERS",
      "title": "Orders",
      "description": "Open orders, and what is waiting on delivery",
      "url": "<BASE>/#/sales-orders" },

    { "id": "V7_COLLECTIONS",
      "title": "Collections",
      "description": "What customers still owe, oldest first",
      "url": "<BASE>/#/finance/customer-receivables" },

    { "id": "V7_INVENTORY",
      "title": "Inventory",
      "description": "Stock on hand, and what is running short",
      "url": "<BASE>/#/inventory/finished-goods-inventory" },

    { "id": "V7_ROUTE",
      "title": "Today's route",
      "description": "Stops, deliveries and collections for today",
      "url": "<BASE>/#/distribution-logistics/delivery-management" },

    { "id": "V7_STOCK_AUDIT",
      "title": "Stock audit",
      "description": "Count a customer's shelf and suggest a reorder",
      "url": "<BASE>/#/customer-management/stock-audit-health" },

    { "id": "V7_PURCHASE",
      "title": "Purchase orders",
      "description": "What to buy for tomorrow, and from whom",
      "url": "<BASE>/#/procurement/purchase-orders" },

    { "id": "V7_TRY",
      "title": "Try FoodBridge",
      "description": "Set up a demo business in a couple of minutes",
      "url": "<BASE>/#/onboarding?signup=1" },

    { "id": "SUPPORT",
      "title": "Talk to a person",
      "description": "A human, not a menu" }
  ]
}
```

**Every `url` above resolves against v7 today** — the routes were verified in `assets/modules.json` and against `platform.js`'s hash router. Two notes on specific rows:

- **`AUTO_LOGIN` is kept first and deliberately.** It is a real smart link into the real product; the nine below it are the v7 demo. Mixing them is fine — the orchestrator dispatches per button — and keeping the real one at the top means the menu does not become a demo that has eaten the product.
- **`V7_TRY` uses `?signup=1`**, which onboarding's `takeSignupFlag()` reads off the platform hash, clears the account, and starts at S01. It is the one v7 route that already understands a parameter arriving from outside.

### Every v7 route available to a static link

Verified against `assets/modules.json`. Anything here is a legal `url` suffix today.

| Destination | Route |
|---|---|
| Dashboard | `#/dashboard` |
| Sales Orders | `#/sales-orders` |
| Customer Receivables | `#/finance/customer-receivables` |
| Supplier Payables | `#/finance/supplier-payables` |
| Stock Audit | `#/customer-management/stock-audit-health` |
| B2B Customers | `#/customer-management/b2b-customers` |
| Retail Customers | `#/customer-management/retail-customers` |
| Catalog | `#/customer-management/catalog` |
| Delivery Management | `#/distribution-logistics/delivery-management` |
| Route Planning | `#/distribution-logistics/route-planning` |
| Live Tracking | `#/distribution-logistics/live-tracking` |
| Logistic Returns | `#/distribution-logistics/logistic-returns` |
| Finished Goods Inventory | `#/inventory/finished-goods-inventory` |
| Raw Material Inventory | `#/inventory/raw-material-inventory` |
| Purchase Orders | `#/procurement/purchase-orders` |
| Supplier Management | `#/procurement/supplier-management` |
| Products | `#/product-master/finished-goods` |
| Workforce | `#/workforce-management` |
| Onboarding (force sign-up) | `#/onboarding?signup=1` |
| Order Drafts | `#/order-drafts` |
| Storefront (Buyer view) | `#/retails-overview` |
| Inventory Intelligence | `#/inventory-intelligence` |

## 5.6 Role variants, if you want them later

Role keys must match `role.name` from the `role` collection, case-insensitively: `MASTER_ADMIN`, `SUPER_ADMIN`, `WHOLESALER_ADMIN`, `WHOLESALER_AGENT`, `RETAILER_PRIMARY`, `RETAILER_SECONDARY`, `RETAILER_PROVISIONAL`, `PRIVATE_USER`, `SUPPLIER_ADMIN`.

This maps onto the unified journey's lanes better than expected:

| Journey lane | Role key | v7 buttons worth showing |
|---|---|---|
| Operator | `WHOLESALER_ADMIN`, `SUPER_ADMIN` | the full ten above |
| **Field** | `WHOLESALER_AGENT` | route, stock audit, collections — **and nothing else** |
| **Buyer** | `PRIVATE_USER`, `RETAILER_PRIMARY` | storefront, order tracking, offers |
| Explorer | *(no role — top level)* | `V7_TRY` plus two or three demo entries |

**`WHOLESALER_AGENT` is the Field lane and it already exists.** Giving it a 3-button menu — Today's route / Stock audit / Support — is the cheapest possible version of §4 Stage D1, and it needs no session scoping at all: the menu *is* the scope, as far as WhatsApp is concerned. It does not stop someone navigating the v7 sidebar once inside, so it is a demo-grade scope, not a real one. Worth doing anyway.

Remember the shallow merge: a role's `buttons` array replaces the top-level one completely. Write each role's full list.

## 5.7 Proactive messages — unchanged, and still gated

The static-link mechanism only works **inside** the 24-hour window, because it is a reply to an inbound message. `whatsappOutboundService.sendTemplateMessage()` exists and is the only way to message someone outside it.

So the 07:15 nudge still needs an approved template, and — unlike the menu — **a template is not configuration.** It needs a Meta submission and a scheduler calling `sendTemplateMessage`. That is Stage F, it is backend work, and none of it is unlocked by the config above.

**What the config above does unlock: the entire pull path, today.** Someone messages the number, sees a menu of their business, taps, and lands in v7. That is most of the demo, with no code written.

## 5.8 Configuration checklist

1. Confirm the published v7 base URL resolves (`<BASE>/#/dashboard` in a browser).
2. Decide the layer: `globalConfig.APP.whatsappIvrFlow` for every tenant, `orgConfig.whatsappIvrFlow` for one. Remember §5.1 — orgConfig replaces global wholesale.
3. Paste §5.5. **Count the buttons. Ten or fewer.**
4. Message the number and check: greeting renders with `{userName}`/`{tenantName}`; the list opens; each row's CTA opens the right v7 screen.
5. Check truncation on a phone — a 24-char row title and a 72-char description are shorter than they look in a JSON editor.
6. Confirm `SUPPORT` still reaches whoever handles it; it is the one row that is not a link.
7. Only then consider role variants (§5.6), starting with `WHOLESALER_AGENT`.
---

## Part 6 — What I would do first

**This week, config only:** paste §5.5 into `whatsappIvrFlow`. Ten buttons, nine of them static links into v7 routes that already resolve, one real `AUTO_LOGIN` smart link kept at the top. No code, no deploy, no Meta submission. The demo becomes WhatsApp-first the moment it saves, and every later stage gets a live test harness.

**Same day, while you are in there:** cap every `buttons` array at ten. The shipped `DEFAULT_IVR_FLOW` has 11 and `whatsappIvrFlow.json` has 12, and `buildMenuReply` does not truncate the row count — so any flow inheriting either fails at the Meta API and looks like the bot has gone quiet. This is a live bug in the config as shipped, independent of anything to do with v7.

**Then the cheapest lane win:** give `WHOLESALER_AGENT` a three-button menu — today's route, stock audit, support. That is the Field lane from the unified journey, and at the WhatsApp layer it costs one config block.

**Then the one thing that gates four of the five lanes:** extract the context layer (Stage B), starting by collapsing the two `orderingStatusFor()` implementations. Do not extend the iframe shell to do it; start from `experiments/shell-free-app/`.

**Then the screen the IVR exists to open:** promote S04's ranking into a standing Control Tower (Stage C). Right now `V7_ATTENTION` points at the dashboard, which is a module mockup, not a ranked answer to "what needs attention". It is the only menu row whose content a user could not have guessed, and until Stage C it is the weakest row in the menu rather than the strongest.

**Only when you are ready to touch the backend:** per-user links, via a new `smartCodeEventEnum` event rather than templating the `url` field — that is the mechanism `AUTO_LOGIN` already uses and it keeps static links static.

**Three things to decide before building, not during:**

| Decision | Why it cannot wait |
|---|---|
| **Cadence or cash in the IVR copy?** | This tenant has no invoice or payment evidence (D-015), so *"₹2.1L overdue"* cannot be drawn. The menus must promise cadence — *"23 shops off cycle"* — or the first tap lands on a screen that contradicts the message. The §5.5 descriptions are written to be true of what v7 actually renders |
| **Which config layer?** | `orgConfig.whatsappIvrFlow` replaces `globalConfig.APP.whatsappIvrFlow` wholesale, not key-by-key. Picking the wrong layer silently drops every key you did not restate |
| **Does the shell move off iframes now or later?** | Stages B, C and D all push against it. Deciding late means doing parts of them twice |

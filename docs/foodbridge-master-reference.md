# Foodbridge — Master Reference

One consolidated document covering the product story, the WhatsApp digital-assistant UX flow, the daily-lifecycle demo, and the agentic-AI build specification.

**Sources merged into this file**

| # | Source | What it contributes |
|---|--------|---------------------|
| 1 | `Whatsapp-Digital-Assistant-flow.docx` | WhatsApp-first identity + IVR flow for all user types |
| 2 | Infographic — *Digital Assistant Flow* | Visual master flow (New / Guest / Business / Private) |
| 3 | Infographic — *Agentic AI Assistant for Every Food Business* | Visual agent architecture, human-in-the-loop, governance |
| 4 | `Foodbridge-Daily-Flow.docx` | Demo narrative shift: day-in-the-life, not a module tour |
| 5 | `foodbridge_daily_lifecycle_demo_v1.zip` | The 13-screen clickable prototype that realises that narrative |
| 6 | `tech/architecture.docx` | Architecture rationale and phase order |
| 7 | `tech/foodbridge_agentic_ai_build_package_v1/` | Build spec (39 sections) + 15 sequential coding work orders |

---

## Part 0 — The one-paragraph thesis

Foodbridge is not another ERP, dashboard or chatbot. **WhatsApp is the lightweight, always-on conversational interface. Foodbridge is the operating environment. Foodbridge Context is the shared memory layer. Existing tools (Tally, Zoho, Excel, Vyapar) stay where they are and become signal sources.** The product is the loop that connects them:

```
Awareness → Nudge → Decision → Action → Verification → Learning
```

Three positioning lines to keep verbatim:

- *WhatsApp is how the user talks to the business. Foodbridge is how the business remembers, thinks and operates.*
- *Keep using the tools you already use. Foodbridge connects them and creates the operating context around your business.*
- *Foodbridge doesn't ask the user to operate another piece of software. It progressively becomes the operating layer around the user's existing business.*

Two loops, stated once and reused everywhere:

```
Core agent loop:
Observe → Understand → Plan → Ask/Confirm → Execute → Verify → Learn → Nudge

Product / business loop:
Snapshot → Insight → Action → Outcome → Next Snapshot
```

---

# PART A — The WhatsApp Digital Assistant (UX flow)

Design principle: **WhatsApp-first, with the user's identity determining which journey they enter.** WhatsApp establishes identity; the web application provides the richer experience.

## A1. Master flow

```
              USER PINGS FOODBRIDGE WHATSAPP IVR
                        "Hi / Hello / Menu"
                                │
                        IDENTIFY USER
                       New? / Existing?
                    ┌───────────┴───────────┐
                 NEW USER               EXISTING USER
                    │                         │
             LOGIN LINK + OTP          IDENTIFY USER TYPE
             foodbridge.io/login       Guest / Business / Private
                    │              ┌──────────┼──────────┐
              VERIFY OTP        GUEST     BUSINESS     PRIVATE
                    │              │          │           │
             GUEST LANDING     Guest IVR  Business IVR  Private IVR
          (Wholesaler/Retailer/    │          │           │
           Distributor/Mfr)     EXPLORE   FOODBRIDGE   PRIVATE
                    │           MODULES   RECOMMENDS   SERVICES
                  DEMO             │          │           │
                    │          DEMO STORE  AUTO-LOGIN  CUSTOMER
              ONBOARDING        JOURNEY      LINK      JOURNEY
                    └───────┬──────┘          │           │
                    DEMO / PRODUCT JOURNEY    │           │
                            │                 │           │
                     FEEDBACK / SURVEY   FOODBRIDGE   OFFERS /
                            │            OPERATIONS   COMPLAINTS /
                   BECOME FOODBRIDGE USER     │        ORDERS
                                              └─────┬─────┘
                                            CONTINUOUS USAGE
```

The welcome IVR itself is deliberately two options only:

```
👋 Welcome to Foodbridge! How can I help you today?
1  I have a Foodbridge account
2  I'm new here
```

## A2. New User journey (frictionless by design)

```
Step 1 — WhatsApp
User → "Hi" → "Welcome to Foodbridge 👋 Let's get you started." → [Login / Get Started]

Step 2 — Login + OTP        (the WhatsApp message carries both URL and OTP)
WhatsApp → foodbridge.io/login → Enter OTP → Verify → Authenticated
```

Sequence as drawn in the infographic:

- **A1 · Send login link + OTP** — "To get started, click the link below and enter the OTP we've sent you." `https://foodbridge.io/login`, OTP e.g. `589321`, timestamped 10:01
- **A2 · Enter OTP** — 6-box OTP entry on `foodbridge.io/login` + **Verify**
- **A3 · Landing page (Guest User)** — "Welcome to Foodbridge! Explore how we can help your business." Four business-type tiles: **Wholesaler · Retailer · Distributor · Manufacturer**, plus a **▶ Try a Demo** CTA. Footnote: *"You are a Guest User for now. Explore the platform and its features."*
- **A4 · Start Onboarding (Demo)** — "You will now experience a guided demo of Foodbridge." → **Start Demo Journey**

**Do not force business registration immediately after authentication.** The user becomes a *Guest User* — someone who can explore before committing to a store/business relationship. For v1, **Demo is the primary CTA.**

## A3. Guest User → Demo journey

The demo must be *a realistic mini Foodbridge business*, not a slideshow.

```
Guest → select "Demo" → choose/enter demo business → Demo store
     → explore real-looking business context → select a module
     → complete mini workflow → see result
     → Foodbridge recommends next action → Feedback
     → "Become part of Foodbridge"
```

Worked example — the Delivery Management module:

```
[Delivery Management] → Demo Store → Today's Route → Customer Stop
   → Delivery → Collection → Route Closed
   → "Here's what Foodbridge saved you today."
```

**Returning Guest IVR** (has an account, no store yet):

```
Welcome back 👋  Explore what Foodbridge can do. Select an option:
1️⃣ Explore Delivery Management
2️⃣ Explore Collection Module
3️⃣ Explore Inventory Management
4️⃣ Explore More Modules
```

Each selection produces an **auto-login link straight into the relevant demo store/module**: `WhatsApp → "Explore Delivery" → auto-login link → Demo Store → Delivery module`.

**Open Demo Store** interstitial: *"Experience Foodbridge — You're viewing a demo store. Explore and try out the features."* → **Go to Demo Store**

**End of Demo Journey** — the infographic's final revision narrows this to **two ways on, not three**:

```
🏁 You've completed the demo!
[ Give Feedback / Take Survey ]
[ Become a part of Foodbridge ]
[ ↩ Back to WhatsApp Menu ]
```

> Note: the current v7 build ends the demo *in the chat*, not on a page about the chat, and its end-menu offers two ways on. Treat the three-button block above as the doc-era spec and the v7 behaviour as current.

## A4. Business User — the primary ongoing journey

A Business User already has a Foodbridge store (retailer / distributor / manufacturer).

```
Welcome back, Miha 👋  Select an option:
1️⃣ Foodbridge Recommends 🔔
2️⃣ Manage Orders
3️⃣ Check Collections
4️⃣ View Inventory
5️⃣ Create Purchase Request
6️⃣ Speak to Support
```

### Foodbridge Recommends — where the proactive AI becomes visible

The assistant must surface business context, not another menu:

```
✨ Foodbridge Recommends
Here are a few things for your attention:
1️⃣ 5 orders delayed
2️⃣ ₹1,24,000 pending collections
3️⃣ Low stock: 3 products
4️⃣ Tomorrow's delivery route ready
[ Open in Foodbridge ↗ ]
```

Every item deep-links into the matching Foodbridge experience, via an **auto-login link that lands on the relevant page inside the user's own store**:

```
WhatsApp
 ├── Order delay   → Foodbridge Orders
 ├── Collections   → Collection Control
 ├── Low stock     → Inventory
 └── Route         → Route Planning
```

Landing state: `foodbridge.io/your-store/…` — *"Continue running your business with Foodbridge."* This is the **WhatsApp → AI → Foodbridge overlay model**.

## A5. Private User — a different product entirely

A Private User does *not* operate the business. They are an end customer linked to a retail or D2C store. Their IVR must therefore be completely different.

```
Welcome to Foodbridge! Select an option:
1️⃣ Browse Offers / Coupons
2️⃣ Foodbridge Recommends
3️⃣ Register a Complaint
4️⃣ Track My Order
5️⃣ Speak to Support
```

Their context chain is:

```
PRIVATE USER → STORE / BRAND → CUSTOMER CONTEXT → ORDERS / OFFERS / SUPPORT
```

**Not** inventory, purchase, working capital, route or settlement.

Example — *Browse Offers* returns a **Special Offers Just for You!** card (e.g. Fresh Milk ₹60 → **₹50**, save 17%; Multigrain Bread ₹50 → **₹40**, save 20%) with **View More Offers**. The journey ends in *Continue as a Private User — stay connected for offers, recommendations and support.*

## A6. The clean three-journey architecture

```
                    FOODBRIDGE WHATSAPP
                            ▼
                    IDENTITY RESOLUTION
          ┌─────────────────┼─────────────────┐
         NEW            EXISTING           EXISTING
          ▼                 ▼                 ▼
       GUEST?             GUEST            BUSINESS
          ▼                 ▼                 ▼
      ONBOARDING         DEMO IVR        BUSINESS IVR
          ▼                 ▼                 ▼
      DEMO STORE       MODULE DEMOS    AI RECOMMENDATIONS
                            │                 ▼
                            │           FOODBRIDGE APP
                            │        ┌────────┼────────┐
                            │     Orders  Inventory  Collections
                            └──────→ FEEDBACK / CONVERSION

        and independently:
        EXISTING USER → PRIVATE USER → PRIVATE IVR
              ┌───────────────┼──────────────┐
           OFFERS         RECOMMENDS      COMPLAINT
              └───────────────┼──────────────┘
                       CUSTOMER JOURNEY
```

## A7. The UX principle behind the whole flow

The journey is **not** `WhatsApp → Website`. It is:

```
WhatsApp  ↔  Foodbridge  ↔  Business Context
```

```
CUSTOMER
  │ WhatsApp
  ↓
AI ASSISTANT        (understands customer + order context)
  ↓
FOODBRIDGE CONTEXT  ├── Customer ├── Orders ├── Products
                    ├── Inventory ├── Payments └── History
  ↓
ACTION → FOODBRIDGE → OUTCOME → NEXT NUDGE ──→ back to WhatsApp
```

Closing banner from the infographic: **One Platform. Multiple Journeys. Always Connected.** — *Foodbridge works for businesses, their teams and their customers — all through a simple WhatsApp conversation.* Four capability pillars along the footer: integrates with existing tools (Tally, Zoho, Vyapar, Excel) · builds a unified business context · provides proactive nudges · works for businesses, staff and customers.

---

# PART B — The Daily Lifecycle Demo

## B1. The narrative shift

Move the demo **from a feature-by-feature product tour to a "day in the life of a food business."** The story: *the user runs the business; Foodbridge is always on in the background, continuously building context, detecting what matters, nudging the user, helping staff and customers collaborate, and taking bounded actions.*

The demo must **not** open with "Here are our modules." It opens with:

> "Good morning. Here are the three things that need your attention."

That single change establishes the product as an operating assistant rather than another ERP. The user then moves naturally between **WhatsApp → Foodbridge → Mobile → Customer → WhatsApp → Foodbridge** without feeling these are separate products.

**Demo thesis:** *Foodbridge is always on — the business runs through it.*

It exists to prove exactly four things:

1. Foodbridge is a live operating platform, not a static dashboard.
2. Users, staff and customers collaborate through the same business context.
3. The AI assistant removes operational friction by nudging, preparing and executing bounded actions.
4. Foodbridge overlays existing tools, extracts signals and builds a unified context layer.

Primary narrative arc: **WhatsApp Nudge → Foodbridge Context → Action → Field / Customer Collaboration → Outcome → Next Day.**

## B2. The 13-step storyboard

Persona throughout: **Miha, a distributor.**

| # | Time | Screen | What it proves | Key numbers |
|---|------|--------|----------------|-------------|
| 01 | 07:15 | Morning WhatsApp nudge | Proactive AI — arrives before the user asks | ₹2.1L collections due · ₹38K projected stock gap · 2 delivery exceptions |
| 02 | 07:30 | Control Tower | WhatsApp = conversational interface, Foodbridge = operating interface | Orders ₹4.8L · Inventory ₹31.4L · Receivables ₹18.6L · Route 9 stops |
| 03 | 08:05 | Orders | Customer collaborates without learning Foodbridge | Shree Stores ₹4,860 (WhatsApp) · Metro Wholesale ₹8,420 (staff) · Fresh Mart ₹3,280 (Zoho sync) |
| 04 | 09:10 | Inventory + forecast | AI connects demand → stock; no manual reconciliation | Available ₹31.4L · Reserved ₹6.8L · Gap ₹38K · Slow stock ₹3.5L |
| 05 | 10:00 | Route plan | AI prepares work; owner reviews instead of constructing | 9 customers · ₹2.8L orders · ₹3.1L suggested load |
| 06 | 10:15 | Mobile route | Field execution with contextual nudges | North Route · next stop Shree Stores ₹48,000 |
| 07 | 11:00 | Customer stock audit | Physical reality becomes Foodbridge context | Oil: system 42 / counted 38 · Atta: system 24 / counted 21 |
| 08 | 14:20 | Collections nudge | Continuous operation, not morning-only automation | ₹86K collected · ₹1.24L overdue across 5 customers · top 2 = ₹72K |
| 09 | 15:00 | Customer collaboration | Collaboration across business boundaries | Outstanding ₹42K · payment ₹30K · credit request ₹18K |
| 10 | 16:10 | Purchase recommendation | Forecast → focused purchase request | Oil: demand 120 / avail 84 / buy **36** · Atta: 90 / 71 / in-transit 10 / buy **9** |
| 11 | 17:20 | Route close | Operational reconciliation | Delivered ₹2.5L · returns ₹12.4K · collected ₹86K · 1 exception |
| 12 | 18:30 | Evening snapshot | Today's actions become tomorrow's context | 12 orders · 9 customers served · ₹86K collected · 7-unit variance |
| 13 | — | Next morning | No restart, no re-upload | Assistant continues from context |

### Step detail

**01 · 07:15 — Morning WhatsApp nudge.** The assistant contacts the owner first. It does not say *"What can I help you with?"* It says what matters.

```
Good morning 👋 I checked your business overnight.
3 things need attention today.
1. ₹2.1L collections   2. ₹38K projected stock gap   3. 2 delivery exceptions

I can prepare today's route and collection list for you.
You only need to review and confirm.
[Review today's priorities]  [Prepare route]
```
Priority cards: **₹2.1L collections due** (8 customers, 3 already overdue) · **Tomorrow's demand is higher** (46 SKUs, route stock may be short ₹38K) · **2 deliveries need attention** (one route delay, one pending confirmation). Today's plan: Sales 12 new orders `Ready` · Delivery 9 customers `Prepare` · Collection ₹2.1L `Attention`.

**02 · 07:30 — Control Tower.** *"What needs attention today?"* — one operating picture assembled from Foodbridge and the tools the business already uses, tagged `Live context`. Same three items as actionable rows: ₹2.1L overdue → **Act**, ₹38K gap → **Review**, 2 delivery exceptions → **Resolve**. Exits: *Prepare today's route* and *See how context was built*.

**03 · 08:05 — Orders.** Customer on WhatsApp: *"Need 10 atta, 6 oil and 4 tea."* Assistant: *"Got it. I found your usual products and prices. Order value ₹4,860."* The order pool shows three different origins side by side — WhatsApp, staff entry, Zoho sync. Assistant insight: *"12 orders are now in the pool. Demand forecast has already adjusted the route recommendation."*

**04 · 09:10 — Inventory.** The assistant compares confirmed orders, stock, reservations, forecast and route demand, and finds a projected gap. Recommendation table: Sunflower Oil 1L 120/84/**36** · Atta 10kg 90/71/**19** · Tea 250g 75/70/**5**. The user does not perform the reconciliation.

**05 · 10:00 — Route plan.** One exception surfaced before start: *"Fresh Mart has not confirmed its delivery window. I can send a WhatsApp confirmation."* Sequence: Shree Stores ₹48K @10:30 · Metro Wholesale ₹72K @11:15 · Fresh Mart ₹31K @12:00 (confirm) · remaining stops ₹1.77L.

**06 · 10:15 — Mobile route.** Lightweight field experience. Nudge at the stop: *"2 cartons of oil are reserved for this customer."*

**07 · 11:00 — Customer stock audit.** The field user counts physical stock; that observation becomes new context, letting the system compare **system stock → physical stock → future demand**. Result: 7-unit variance detected, suggested follow-up *review tomorrow's load*.

**08 · 14:20 — Collections.** *"Update: ₹86K has been collected today. ₹1.24L remains overdue across 5 customers. The top 2 accounts represent ₹72K."* Choices: *Review top 2* / *Remind me at 17:00*.

**09 · 15:00 — Customer + owner collaboration.** Customer: *"Can pay ₹30K today. Need another ₹18K credit."* Assistant: *"I can record today's ₹30K payment. Your current credit balance is ₹42K. I'll ask the business owner about the additional ₹18K."* The customer stays in WhatsApp; the owner sees the same context in Foodbridge and approves.

**10 · 16:10 — Purchase.** Instead of asking the user to reconcile sales, stock and forecast manually, Foodbridge proposes a focused purchase request.

**11 · 17:20 — Route close.** Delivery, returns and collections reconcile; the assistant prepares the day-end state.

**12 · 18:30 — Evening.** *"You ran the business. Foodbridge kept the context."* The assistant explains what happened, what completed, what remains and what should happen tomorrow — and has **2 actions already prepared** (purchase request for 45 units, follow-up for 2 overdue customers).

**13 · Next morning.** No onboarding restart. Carry-forward across three axes: orders + customers (12 active relationships and preferences), inventory context (audit + forecast updated), action outcomes (₹86K collected, campaign/purchase outcomes tracked).

```
WhatsApp, 07:05 tomorrow:
"Good morning. Your route is ready. I found one stock gap
 and two collections worth your attention."
```

```
Snapshot → Nudge → Action → Outcome → Next Snapshot
```

## B3. The integration overlay screen

```
   Tally ──────→ ┌──────────────────────┐        Zoho ─────→ WhatsApp Assistant
   Invoices ·    │  FOODBRIDGE CONTEXT  │        Orders ·    Nudges · conversations
   ledgers ·     │ Customers · products │        customer    · actions
   payments      │ orders · inventory   │        records
                 │ events · outcomes    │     Staff/Field ─→ Foodbridge Operations
                 └──────────────────────┘     Mobile audits  Routes · settlements
                                              · delivery ·   · campaigns
                                              collection
```

| Signal source | Signal | Foodbridge context | Agent action |
|---|---|---|---|
| Tally | Invoice overdue | Customer + amount + ageing | Collection nudge |
| Zoho | New order | Customer + SKU + quantity | Add to order pool |
| Mobile audit | Stock variance | Customer + product + count | Adjust forecast / route |
| WhatsApp | Customer request | Conversation + account context | Prepare / execute action |

## B4. Human support screen

*AI when it can. People when they should.* Three cards: **Level 1 — Foodbridge Customer Support Pod** (complex configuration, agent uncertainty, billing, account issues, at-risk customers) · **Level 2 — Direct user intervention** (in-app, WhatsApp, call or meeting) · **Feedback — learn from resolution** (capture what was resolved, improve future nudges).

## B5. Demonstration principles — show, don't explain

| Never say | Show instead |
|---|---|
| "Foodbridge is proactive." | A WhatsApp message arriving *before* the user asks. |
| "Foodbridge integrates with Tally and Zoho." | An invoice/order signal arriving and becoming part of unified context. |
| "Foodbridge reduces errors." | The assistant detecting a stock/delivery mismatch *before* execution. |
| "Foodbridge supports collaboration." | customer → assistant → owner → Foodbridge context. |

The demo deliberately has three participants working against one context: **OWNER ↕ FOODBRIDGE AI ↕ STAFF / FIELD USER ↕ CUSTOMER.**

The agentic distinction to land: the assistant doesn't merely answer *"Your inventory is low."* It says *"Tomorrow's route has a ₹38K projected gap. I have identified the products and prepared the route/load recommendation."*

## B6. Running the demo

**5-minute version** — Morning nudge 30s · Control Tower 30s · Customer order 40s · Inventory/route 60s · Field stock audit 40s · Collection nudge 40s · Day-end + next day 40s · Integration architecture 20s.

**10-minute version** — the complete 13-step storyboard.

Positioning demonstrated: WhatsApp = always-on AI interface · Foodbridge = operating platform · existing tools = data/capability sources · context layer = shared business memory · human support = exception layer · outcome = better business operation.

**Closing slide message:** *Not another app. Not another chatbot.* Foodbridge becomes the operating context between the business, its people, customers and existing tools — while WhatsApp becomes the lightest possible always-on interface to the intelligence.

## B7. Prototype package (as shipped)

Static, no build step — open `index.html`.

```
index.html                      demo hub: thesis, 3 pillars, 13-item storyboard list
DEMO-STORYBOARD.md              presenter script
README.md
assets/style.css                design tokens + all components
assets/app.js                   one function: demoAction(msg) → alert()
screens/
  morning.html  control-tower.html  orders.html  inventory.html
  route-plan.html  mobile-route.html  mobile-stock-audit.html
  mobile-audit-done.html  collections.html  customer-collaboration.html
  purchases.html  routes.html  evening.html  next-day.html
  integration-context.html  human-support.html
```

Design tokens: `--green #087f5b` · `--green2 #0b6b53` · `--blue #2563a8` · `--purple #6941c6` · `--orange #c56b08` · `--ink #17323a` · `--muted #66777d` · `--line #dbe3e5` · `--bg #f6f8f7` · sidebar `#12343a` · WhatsApp header `#075e54` · own-message bubble `#d9fdd3`.

Component vocabulary: `.hero` `.card` `.nudge` (+`.blue/.orange/.purple` left border) `.grid3` `.grid4` `.split` `.metric` `.tag`(`.good`/`.warn`) `.list`/`.item` `.timeline` `.wa`/`.bubble`/`.choice` `.mobile` (390px frame) `.table` `.integration`. Sidebar collapses below 900px. Sidebar nav links `customers.html` and `integrations.html`, which are not in the package — add them or remove the links.

---

# PART C — Agentic AI Architecture & Build Specification

Spec version 1.0, dated 2026-09-15. Build an **Agentic AI Assistant as an overlay to the Foodbridge application** — it must work across the existing system without replacing it.

## C1. Product architecture

```
                    FOODBRIDGE USER
          ┌───────────────┼────────────────┐
      In-app Chat       Voice          WhatsApp
          └───────────────┼────────────────┘
                          ↓
                NUDGE & INSIGHT ENGINE
                          ↓
                FOODBRIDGE AI ASSISTANT
                 ┌────────┼─────────┐
             Understand  Plan    Respond
                          ↓
                       Execute → Learn
          ┌───────────────┼────────────────┐
   Foodbridge APIs   Tools/Integrations   Context
                          ↓
                 Foodbridge application
```

The crucial separation:

```
Foodbridge    = System of Record + Business Operations
AI Layer      = Awareness + Intelligence + Decision + Orchestration
Nudge Engine  = Continuous Detection + Prioritisation
Human Support = Exception Handling + Complex Intervention
```

**The architectural decision to hold the line on.** Do not build `LLM → Foodbridge APIs`. Build:

```
LLM → Agent Orchestrator → Policy Engine → Action Executor → Foodbridge Business Services
```

This prevents the AI from becoming a second business-logic system.

### Infographic view — four promises across the top

**Always On** (24×7 real-time assistance) · **Proactive** (nudges before issues arise) · **Action-Oriented** (gets things done, not just answers) · **Human Supported** (you're never alone).

Five columns left to right:

1. **Store User** (supplier / distributor / retailer) — in-app chat ("Show today's orders", "Add new product") · voice, in-app or WhatsApp ("Create an order", "What should I restock?") · WhatsApp ("Send me sales report", "Create purchase order") · dashboard widgets (quick actions, alerts, suggestions) · notifications & nudges.
2. **Nudge & Insight Engine** — usage & behaviour (low stock, inactive categories, pending orders) · business insights (sales trends, top/slow movers, buying patterns) · operational (supplier re-order, payment reminders, delivery delays) · growth (new products, cross-sell, seasonal) · learning (how-to videos, feature recommendations, best practice).
3. **Foodbridge AI Assistant (Agentic AI)** — *Understands. Plans. Acts. Learns.* Understand → Plan → Execute → Respond → Learn, **connected to tools & systems**: store management (products, customers, orders, inventory, staff) · marketplace (buy/sell, pricing, catalog) · procurement & suppliers (RFQ, POs, supplier communication) · logistics & delivery · warehouse services · working capital (credit, loan status, limits) · analytics & reporting · communication (email, WhatsApp, SMS) · external integrations (payment gateways, accounting, GST).
4. **Actions & Outcomes** — create/update products · place/manage orders · generate reports · send communications · update inventory · raise purchase requests · track deliveries · check payments/dues · get financing options · schedule reminders · provide insights & recommendations · escalate to human.
5. **Business Impact** — save time · fewer errors · better inventory control · higher sales & margins · improved supplier/customer relationships · faster access to finance · continuous learning · digital growth.

Underneath, **Human in the Loop (two levels)** feeding back into the engine, and a governance strip: **Data, Security & Governance** across the architecture — data security & privacy · access control (role-based) · audit & compliance (GDPR, DPDP) · monitoring & observability (agent performance, errors, usage) · continuous learning (human feedback + outcomes).

Footer: *Your AI Assistant. Your Team. Your Growth Partner.*

## C2. Non-negotiable design rules

**Rule 1 — AI does not own business state.** Foodbridge remains source of truth for products, customers, orders, inventory, routes, invoices, payments, suppliers, campaigns, purchase requests and settlements. The agent reads and acts through application services.

**Rule 2 — AI does not directly mutate the database.**

```
Bad:      Agent → Database

Correct:  Agent → Action proposal → Permission/policy check
                → Foodbridge business action → Result → Verification
```

**Rule 3 — Every action must be auditable.** Store the user request, agent reasoning *summary*, tools selected, inputs, approval, action result, verification result, human intervention and final outcome. **Do not store hidden chain-of-thought** — store concise decision rationale.

**Rule 4 — Start with bounded autonomy.** Default every new action to L2/L3.

| Level | Name | Meaning |
|---|---|---|
| **L0** | Observe | Read data only |
| **L1** | Recommend | Generate insight / nudge |
| **L2** | Prepare | Prepare an action, require user approval |
| **L3** | Execute with confirmation | User explicitly confirms; agent executes |
| **L4** | Bounded autonomous | Pre-approved low-risk actions within policy |
| **L5** | Human escalation | Agent cannot safely proceed |

## C3. Phase 1 — Agent shell (build the overlay before the intelligence)

**Desktop:** launcher · right-side assistant panel · conversation · suggested prompts · nudge cards · action cards · human-support entry.
**Mobile:** floating entry · full-screen assistant · action confirmation · context-aware handoff.
**WhatsApp:** message entry · menu · agent conversation · workflow handoff.

No autonomous actions yet. **Acceptance:** a user can open the assistant, ask a question, get a response, see a suggested action and open the relevant Foodbridge screen.

## C4. Phase 2 — Context layer

```
UserContext
├── user                ├── current_entity_id   ├── recent_nudges
├── organization        ├── selected_filters    ├── business_snapshot
├── role                ├── recent_actions      └── permissions
├── current_screen      ├── pending_tasks
└── current_entity
```

e.g. `current_screen = inventory`, `current_product = SKU-123`, `current_customer = Customer-45`. The assistant receives this automatically — the user must never have to repeat *"I am looking at this customer."*

## C5. Phase 3 — Business context / memory (three levels)

- **Live context** — what is happening now: current inventory, open orders, pending deliveries, outstanding payments.
- **Historical context** — what happened recently: previous actions, snapshots, campaigns, customer interactions.
- **Preference context** — how this user operates: preferred route timing, approval behaviour, frequent customers, preferred channel.

**Memory must never override permissions or current business state.**

## C6. Phase 4 — Tool registry

Reads: `get_inventory` `get_product` `get_customer` `get_orders` `get_route` `get_receivables` `get_purchase_forecast` `get_sales_performance` `get_business_snapshot`

Writes: `create_order` `update_order` `create_campaign` `send_campaign` `create_purchase_request` `create_route` `start_route` `close_route` `record_collection` `record_stock_audit` `generate_report` `send_customer_message` `schedule_reminder`

Every tool declares: `name` · `description` · `read_or_write` · `risk_level` · `required_permissions` · `required_confirmation` · `input_schema` · `output_schema` · `idempotency_requirement` · `audit_requirement`.

## C7. Phase 5 — Action policy engine

**Never let the LLM decide whether an action is allowed.** The agent proposes; a deterministic policy layer decides.

```
Agent Proposal → Policy Engine → Allowed?
                                 ├── Yes → Execute
                                 └── No  → Ask user / Human
```

Policy dimensions: user role · organization policy · action type · financial value · customer impact · communication impact · data sensitivity · reversibility · confidence · frequency limits.

| Action | Policy |
|---|---|
| `send_customer_message` | Allowed with user confirmation |
| `create_purchase_request` > ₹1L | Human approval |
| `change_invoice` | Privileged confirmation |
| `schedule_reminder` | Potentially autonomous |
| Delete business data | Never autonomous |

## C8. Phase 6 — Agent orchestrator

```
INPUT → Understand → Retrieve context → Identify intent
      → Determine required data → Select tools → Build plan
      → Policy check → Ask / Confirm / Execute
      → Verify result → Respond → Record outcome
```

**The agent should not call every tool — use progressive retrieval.** e.g. *"Why are sales down?"* → `get_sales_performance` → `compare_periods` → `identify_products` → `identify_customers`, retrieving further only if needed.

## C9. Phase 7 — Nudge & insight engine

A **separate subsystem** from the conversational AI.

```
Foodbridge Events → Signal Detection → Rules/Thresholds → Business Context
   → Opportunity Scoring → Nudge Candidate → Policy/Frequency Check → User Nudge
```

Categories: usage & behaviour · business insights · operational · growth · learning.

**Nudge model:** `id` `category` `title` `explanation` `evidence` `urgency` `confidence` `potential_impact` `recommended_action` `action_type` `action_parameters` `expires_at` `status` `feedback`.

Example rendering:

```
Slow-moving stock
₹3.5L currently tied up
18 products have low movement. 12 customers appear relevant.
Potential movement: ₹1.4L
[Review opportunity]
```

**Ranking** — do not show every detected issue:

```
priority = business_impact × urgency × confidence
         × actionability × user_relevance × freshness
```

Reduce score for: recently dismissed · recently shown · duplicate issue · low-confidence data · action already completed.

**Division of labour:** the Nudge Engine discovers; the Agent explains and acts. **Never make the LLM the primary event detector** — use deterministic/analytical detection for business signals, and AI for interpretation, planning and interaction.

## C10. Phase 8 — Snapshot intelligence

```
Snapshot → Insight → Action → Outcome → Next Snapshot
```

For each new snapshot: `previous_state → current_state → difference → actions_since_previous → observed_outcomes → next_best_action`.

Target utterance:

> "Receivables reduced by ₹1.8L since your last snapshot. The collection action on 8 customers appears to account for most of the improvement."

## C11. Phase 9 — Action execution framework

```
ActionRequest
├── action_type   ├── business_context  ├── idempotency_key
├── actor         ├── parameters        └── correlation_id
├── source        ├── approval

Proposed → Awaiting Approval → Approved → Executing → Executed → Verified
Failure:   Executing → Failed → Retryable / Needs User / Human Escalation
```

## C12. Phase 10 — Verification

**Never assume an action succeeded because the API returned successfully.** Execute → read resulting state → compare expected vs actual → mark verified. e.g. after creating a campaign, call `get_campaign(campaign_id)` and verify it exists with the correct products, customers, offer and status — *then* respond "Campaign sent to 12 customers."

## C13. Phase 11 — Human in the loop

**Level 1 — Foodbridge Customer Support / Pod.** Escalate when the agent is unsure, data is inconsistent, configuration is complex, there's an account/billing issue, the customer is at risk, or the agent has repeatedly failed.

```
Agent → detect escalation condition → create support context
      → Customer Success Pod → human resolution → return context to Agent
```

**Level 2 — Direct user intervention.** *Talk to a person*, any time: in-app handover · WhatsApp handover · schedule call · meeting request.

**Escalation context.** Never send a human *"User needs help."* Send: customer · issue · current screen · relevant entities · what the user asked · what the agent attempted · tools used · failure · recommended human action · conversation summary.

## C14. Phase 12 — Learning loop

```
Nudge shown → Viewed → Accepted/dismissed → Action taken
            → Action result → Business outcome
```

Capture: helpful/not helpful · dismiss reason · action acceptance · action completion · outcome · human correction. Use to improve nudge ranking, recommendations, tool selection, explanations and escalation thresholds. **Do not allow uncontrolled online model self-modification.**

## C15. Channels and overlay UX

| Channel | Use for |
|---|---|
| In-app | Control Tower, complex actions, data-heavy review, approvals |
| Voice | Questions, quick decisions, hands-free, route workflows |
| WhatsApp | Quick commands, notifications, simple workflows, route entry, customer stock audit, delivery/settlement entry |

All channels share the same agent identity and business context.

**Four overlay modes:** **Ask** (user initiates — "Show today's orders") · **Nudge** (agent initiates — "12 customers have pending orders. Want me to prepare today's route?") · **Action** (agent proposes — "I found ₹2.1L overdue. Review the 8 customers?") · **Escalate** ("I can't safely resolve this account issue. Would you like to talk to Foodbridge support?").

**Contextual behaviour** — the same assistant behaves differently by screen: Inventory → *"You have ₹3.5L of slow-moving stock."* Customer → *"This customer has ₹42K overdue."* Route → *"Two stops have unresolved delivery exceptions."* Control Tower → *"Your largest opportunity today is ₹2.1L in overdue collections."*

**Standard action card, three states:**

```
[ICON]                    [Executing…]              ✓ Completed
Problem                   Reviewing 8 customers     8 customers targeted
₹2.1L overdue             Preparing collection      ₹2.1L expected recovery
Why                       actions                   [View collection]
8 customers have
overdue balances.
Potential  ₹2.1L recovery
Recommended
Start collection review
[Review] [Dismiss]
```

## C16. Autonomy guardrails

Autonomous execution is permitted **only when all hold**: action is low-risk **AND** permission exists **AND** policy allows it **AND** parameters are unambiguous **AND** the action is reversible or low-impact **AND** confidence is above threshold **AND** no unusual condition exists. Otherwise: ask the user, or escalate.

**Never autonomously:** delete data · change financial records without policy · make high-value purchases · issue refunds without authority · change invoices · send sensitive communications · override business controls.

## C17. State machines

```
AGENT                                CONVERSATION
IDLE → TRIGGERED → UNDERSTANDING     NEW → UNDERSTANDING → NEEDS_INFORMATION
 → CONTEXT_RETRIEVAL → PLANNING       → READY_TO_ACT → AWAITING_CONFIRMATION
 → POLICY_CHECK                       → EXECUTING → VERIFYING → COMPLETED
    ├── REJECT → ESCALATE
    ├── ASK → AWAITING_USER           ANY STATE → HUMAN_REQUESTED
    └── ALLOW → EXECUTING              → HUMAN_HANDOFF → RESOLVED → RESUME
         → VERIFYING
            ├── SUCCESS → RESPOND
            ├── RETRY → EXECUTING
            └── FAILURE → ESCALATE
                  → LEARN → IDLE
```

## C18. Event model and priority

Events: `ORDER_CREATED` `ORDER_PENDING` `ORDER_DELAYED` `INVENTORY_LOW` `INVENTORY_SLOW_MOVING` `INVENTORY_EXPIRING` `PAYMENT_DUE` `PAYMENT_OVERDUE` `PAYMENT_RECEIVED` `PURCHASE_REQUIRED` `ROUTE_STARTED` `ROUTE_DELAYED` `ROUTE_CLOSED` `SETTLEMENT_PENDING` `SNAPSHOT_CREATED` `SNAPSHOT_UPDATED` `CAMPAIGN_COMPLETED` `ACTION_FAILED` `USER_REQUESTED_HUMAN`. The event system feeds the Nudge Engine.

| Priority | Events |
|---|---|
| **P0** | Payment overdue · low inventory · pending orders · delivery delay · route close · snapshot updated |
| **P1** | Slow-moving inventory · expiry · purchase opportunity · sales decline · customer inactivity |
| **P2** | Cross-sell · seasonal opportunity · product suggestions · learning recommendations |

## C19. First seven skills

Do not build 50 skills first.

1. **Business Snapshot** — "How is my business doing?" / "What needs attention?" / "Where is my working capital?"
2. **Receivables** — find overdue · explain ageing · prepare collection action · record collection
3. **Inventory** — slow-moving · low stock · expiry risk · explain inventory value
4. **Orders** — pending orders · explain delays · prepare delivery action
5. **Route** — prepare · status · close · explain exceptions
6. **Purchase** — identify requirement · suggest products/quantities · prepare request
7. **Campaign** — identify target products · identify customers · prepare · send after approval

## C20. Vertical slices

**Slice #1 — "What needs my attention?"** Trigger: user opens Control Tower. Retrieve overdue payments, low/slow inventory, pending orders, delivery exceptions; rank them; respond:

```
You have 3 things worth acting on today.
1. ₹2.1L overdue payments — 8 customers   [Review]
2. ₹3.5L slow-moving stock — 18 products  [Explore]
3. 4 pending orders                       [View orders]
```

Proves context, retrieval, nudge, ranking and action linking — **without autonomous writes.**

**Slice #2 — "Recover overdue payments."** Nudge → opportunity → customer list → user selects → agent prepares action → user confirms → Foodbridge executes → agent verifies → result. **This becomes the reference implementation for all future write actions.**

**Slice #3 — "Snapshot → Outcome."** Snapshot 01 → agent finds ₹2.1L overdue → collection action → business changes → Snapshot 02 → agent detects ₹1.8L reduction → explains outcome → recommends next action. **This proves the central agentic loop.**

## C21. Evaluation

Every skill is evaluated on: **correctness** (understood the business request) · **retrieval** (right context) · **tool selection** (correct Foodbridge capability) · **safety** (respected permissions) · **action correctness** (intended business outcome) · **verification** (verified the actual result) · **explanation** (user can understand what happened) · **escalation** (asked for human help when appropriate).

Required test categories: happy path · missing data · ambiguous request · permission denied · high-risk action · tool failure · duplicate request · stale data · conflicting information · human handoff.

**Definition of done for every action** — not complete until: intent understood · context retrieved · permission checked · risk evaluated · approval obtained where required · action executed · result verified · user informed · audit record created · outcome available for learning.

## C22. Long-term target architecture

```
                         USER
        ┌──────────────────┼─────────────────┐
      IN-APP             VOICE           WHATSAPP
        └──────────────────┼─────────────────┘
                  EXPERIENCE ADAPTER
                  CONTEXT MANAGER
                 NUDGE / INSIGHT ENGINE
                    AI ORCHESTRATOR
             ┌─────────────┼──────────────┐
        REASONING       TOOL SELECT     MEMORY
             └──────┬──────┘
              POLICY ENGINE
          ┌─────────┴─────────┐
      USER APPROVAL       AUTONOMOUS
          └─────────┬─────────┘
             ACTION EXECUTOR → FOODBRIDGE APIs → BUSINESS SYSTEM
                → VERIFICATION → OUTCOME → LEARNING → NUDGE ENGINE ↺

       HUMAN SUPPORT POD ↕ DIRECT USER SUPPORT
```

## C23. The most important product principle

Do **not** build *"ChatGPT inside Foodbridge."* Build:

> **A continuously aware business operating assistant that observes Foodbridge, identifies what matters, proposes the next best action, executes approved work, verifies the outcome and learns from what happened.**

The chat interface is only one entry point. The actual product is **awareness + nudge + decision + action + verification + learning.**

**First milestone is not "we have an AI chatbot."** It is:

> A Foodbridge user opens the application and the assistant can identify one real business issue, explain why it matters, propose a relevant action, execute it safely after approval, verify the result, and remember that outcome for the next business snapshot.

---

# PART D — Coding-agent work orders

Sequential. **Each agent must inspect existing Foodbridge code before implementing anything.**

| WO | Name | Build | Done when |
|---|---|---|---|
| **01** | Assistant Shell | Desktop overlay, mobile entry, conversation surface, nudge cards, action cards, human-support entry. *No autonomous execution.* | A user can ask a question and navigate from an answer into an existing Foodbridge screen |
| **02** | Context Manager | Expose user, org, role, screen, entity, filters, recent actions, pending tasks, snapshot | The assistant answers differently on Inventory, Customer, Route and Control Tower |
| **03** | Tool Registry | Typed read/write tool definitions declaring risk, permissions, confirmation, I/O, idempotency, audit | The orchestrator can discover approved tools without hard-coded tool logic |
| **04** | Policy Engine | Deterministic action policy — agent proposes, policy decides | Low-risk allowed · risky requires confirmation · unauthorized rejected · high-risk escalates |
| **05** | Orchestrator | Understand → Retrieve → Plan → Policy → Ask/Execute → Verify → Respond → Audit | Works with mocked tools first, then real Foodbridge actions |
| **06** | Snapshot Engine | Snapshot 01/02, previous↔current comparison, action-to-outcome association, next-action context | The agent can explain *"what changed since my last snapshot?"* |
| **07** | Nudge Engine | Deterministic signals for overdue payments, low stock, pending orders, delivery delays, route closure, snapshot updates + ranking, suppression, expiry | Control Tower surfaces only high-value nudges |
| **08** | Receivables Skill | Overdue retrieval → explanation → customer review → action preparation → approval → execution → verification | **This is the reference write-action implementation** |
| **09** | Inventory Skill | Slow-moving detection, low-stock explanation, expiry risk, inventory opportunity, campaign handoff | Writes stay confirmation-based |
| **10** | Order / Route Skills | Pending orders, route preparation, route status, delivery exceptions, route close, settlement handoff | — |
| **11** | Purchase / Campaign Skills | Purchase opportunities, supplier recommendations, campaign creation, customer targeting, offer preparation, confirm & send | — |
| **12** | Human Support | Talk to a person, support context, escalation, handover, resume after resolution | — |
| **13** | Learning | Nudge impressions, accepts, dismissals, action outcomes, human corrections, business outcomes. *No uncontrolled self-modifying model behaviour.* | — |
| **14** | Bounded Autonomy | Only explicitly approved low-risk actions: reminders, low-risk internal summaries, non-sensitive notifications. Everything else confirm-first | — |
| **15** | Evaluation | Intent, retrieval, tool selection, safety, execution, verification, explanation, escalation, duplicate prevention, stale data | — |

### The agent contract

Before coding: **1.** read the relevant existing Foodbridge modules · **2.** identify reusable business services · **3.** do not duplicate business rules · **4.** define interfaces before implementation · **5.** implement the smallest vertical slice · **6.** test happy path *and* failure path · **7.** verify integration · **8.** document changed behaviour.

Required work pattern:

```
READ → UNDERSTAND EXISTING SYSTEM → DEFINE CONTRACT
     → IMPLEMENT SMALLEST VERTICAL SLICE → TEST
     → INTEGRATE → VERIFY → DOCUMENT
```

Before adding a tool: search for existing Foodbridge capability → reuse the existing service if available → add an adapter only if necessary → keep AI-specific logic outside core business logic.

**Never skip policy, verification or audit for convenience.**

---

# PART E — How the four sources fit together

```
WHATSAPP DIGITAL ASSISTANT FLOW        ← who the user is, and which door they come through
        (Part A)                          New / Guest / Business / Private
              ↓
DAILY LIFECYCLE DEMO                   ← what a day looks like once they're through
        (Part B)                          13 steps, 07:15 → next morning
              ↓
AGENTIC AI BUILD SPEC                  ← what has to exist for that day to be real
        (Part C)                          overlay, context, tools, policy, nudges, verification
              ↓
CODING AGENT WORK ORDERS               ← the order to build it in
        (Part D)                          WO-01 … WO-15
```

- **Part A is the front door.** Identity resolution decides journey. Business users land on *Foodbridge Recommends* — which is Part C's Nudge Engine rendered as a WhatsApp list.
- **Part B is the proof.** Every screen in the demo is a Part C component made concrete: the 07:15 nudge is the Nudge Engine at L1; the route plan is L2 (prepare); "Send confirmation" and "Approve request" are L3 (confirm & execute); the evening snapshot is the Snapshot Engine; `integration-context.html` is the context layer.
- **Part C is the contract.** It is what keeps the demo honest — policy before execution, verification after it, audit around it.
- **Part D is the sequence.** Build the shell before the intelligence; build Receivables as the one reference write action; earn autonomy last.

### The single loop that appears in all four

```
       OBSERVE → CONTEXT → NUDGE → ACT → VERIFY → OUTCOME → NEXT CONTEXT
                    ↑                                            │
                    └────────────────────────────────────────────┘
```

Read it as a UX flow (Part A), as a business day (Part B), as an architecture (Part C), or as a build order (Part D). It is the same loop each time.

# Customer → Route → Run → Ground

**A product model for three modules: B2B Customer Management · Route Planning · Delivery Management**

**Scope:** only these three. Other modules appear only where a dependency must be explained.
**Purpose:** establish a clean product model before any v6 change.
**Status:** model only. No product code changed, nothing implemented.

**Status key** — 🟢 Can extend existing UX now · 🟡 Can extend, needs product/UX solutioning ·
🔵 Needs a new capability inside these modules · ⚪ Already covered · 🔴 Conflicts with current UX

**Label key** — ✅ Agreed *(from the brief)* · 💡 Recommended *(proposed, not approved)* · ❓ Open

---

## 1. What the three modules actually are today

### 1.1 B2B Customer Management

| | |
| --- | --- |
| **Screen** | A single list: **Name · Email · Phone · Address · Catalog · Actions** |
| **Address column** | `address + state + PIN` joined, rendering "-" when empty |
| **Row actions** | Offers · Send Campaign · Edit · Delete |
| **Toolbar** | Import · Export · Download Sample |
| **The drawer** | GST Type & Number · Customer Code · Name · Email · **Phone\*** · Opening Balance · Billing Address · State (Billing) · **PIN Code (Billing)** · *"use billing as shipping"* · Shipping Address · State · **PIN Code (Shipping)** · notify |
| **Validation** | **Phone is the only required field.** Inline error + toast, a pattern that already works |
| **Bulk capture contract** | Import/Sample columns: `name, email, phone, address, state, postnr` |
| **What it does not hold** | No coordinates · no beat/area · no credit or payment terms · no delivery window · no site contact · **no link to any route** |

### 1.2 Route Planning

| | |
| --- | --- |
| **Screen** | One tab — **"Delivery Templates"**. Table: **Name · Customers · Staff · Actions**, newest first, searchable |
| **The drawer** | **Route Name\*** · Customers *(multi-select)* · Staff Members *(multi-select)* |
| **The multi-select** | Search, checkbox list, a **"N templates" conflict badge** showing where else that customer or staff member is already assigned, and a **"Selected (N)"** list with per-row remove |
| **What it does not hold** | No **sequence** — the Selected list is unordered · no **area** · no date · no vehicle · no orders · no load · no schedule · **no run** |

### 1.3 Delivery Management

The driver's execution app — 23 screens, fully specified in `delivery-management-ux-flow.md`.

| | |
| --- | --- |
| **A route carries** | name · **beatArea** · scheduledDate · status · driver · stops · collected/outstanding totals |
| **A stop carries** | customer *(name, phone, **address**, GST, **creditAmount**)* · order lines · outstanding · advance |
| **The journey** | Home → Pre-Start *(Load Stock · Cash for Change · Ready to Start)* → Delivery Queue → the stop screen → Collect Payment → Settle Route → Route Intelligence |
| **What it does not hold** | No coordinates · no role/permission model · no reference to a Sales Order · **no way to create a run** |

### 1.4 The finding that reframes everything

> ## The three modules are not connected. At all.

```mermaid
flowchart LR
    subgraph A["👤 B2B CUSTOMER MANAGEMENT"]
        A1["Customers c01, c02, c03 …<br/><i>name · phone · address · state · PIN</i>"]
        A2["❌ no route field<br/>❌ no area<br/>❌ no coordinates"]
    end
    subgraph B["🗺️ ROUTE PLANNING"]
        B1["Templates: name · customers · staff"]
        B2["Its OWN customer list —<br/>c-dinesh, c-rana, c-raman …<br/><i>a different id space entirely</i>"]
        B3["❌ no sequence<br/>❌ no area<br/>❌ no run"]
    end
    subgraph C["📦 DELIVERY MANAGEMENT"]
        C1["Its OWN routes — RTE-001 … RTE-005<br/><i>pre-seeded, with stops and a driver</i>"]
        C2["'New Delivery' lists DM's own routes,<br/>NOT Route Planning's templates.<br/>'Start Delivery' NAVIGATES to an existing<br/>route — it creates nothing"]
    end

    A -. "❌ no link" .-> B
    B -. "❌ no link" .-> C

    N1["A customer does not know which route it is on"]
    N2["A route template cannot become a delivery run"]
    N3["A driver's route was never planned by Route Planning"]
    A2 --- N1
    B3 --- N2
    C2 --- N3

    classDef mod fill:#eef2ff,stroke:#6366f1,color:#111
    classDef gap fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#111
    class A1,B1,B2,C1 mod
    class A2,B3,C2,N1,N2,N3 gap
```

**Three facts, each verified in the repository:**

1. **B2B Customer Management and Route Planning do not share a customer.** The master holds `c01, c02, c03…`; Route Planning holds its own `c-dinesh, c-rana, c-raman…`. Different id spaces, different records.
2. **Route Planning cannot produce anything Delivery Management can open.** A template is a name plus two unordered sets. Delivery Management opens routes it was seeded with.
3. **Neither module can create a delivery run.** Route Planning creates templates. Delivery Management's "Start Delivery" validates the name, then navigates to a route that already exists.

> **The missing object is the run.** Not a screen, not a field — the thing that turns *"these customers, in this area, in this order, with this crew, on this date"* into something a driver can be handed. Every requirement in this journey either feeds that object or consumes it.

---

## 2. Requirement filter

55 requirements, filtered against one test: **can this requirement participate in
*capture customer info for delivery → plan the route → execute on ground*, using only these three
modules?**

**21 in · 34 out.** The full assessment of all 55 lives in
`delivery-requirements-solution-assessment.md`; this document does not restate it.

### A — Requirements that belong in this journey

| # | Requirement | Best-fit module | Existing UX to extend | What changes | Status | Dependency |
|---:|---|---|---|---|:---:|---|
| **4** | All mandatory terms completed before the customer can be saved | B2B Customer | The customer drawer's **required-field pattern** *(Phone, inline error + toast)* | The gate widens from "Phone" to "everything delivery needs" — see §3.1 | 🟡 | ❓ which fields are mandatory |
| **24** | Address includes ZIP/postal code | B2B Customer | **PIN Code (Billing) and (Shipping)** | Nothing. Already captured, already shown in the Address column | ⚪ | — |
| **25** | Address includes location/GPS | B2B Customer | The address block in the drawer | A delivery pin on the customer record | 🔵 | ❓ how it is captured *(D6)* |
| **1** | Credit options — 30 / 20 days | B2B Customer | Opening Balance sits next to where terms belong. DM's stop already carries `creditAmount` | A credit-terms field that the driver's Total Due can respect | 🟡 | ❓ what it does at the door |
| **11** | The route should be selected/defined first | Route Planning | The template list | The template becomes the entry point for preparing a run | 🔴 | ❓ **D1** — conflicts with Sales Orders' order-first Create Delivery |
| **12** | Show the customers/orders belonging to the selected route | Route Planning + DM | Template drawer shows customers; DM's Queue shows stops | The customer half is nearly covered; the **orders** half is Sales Orders and stays outside | 🟡 | Req 11 |
| **26** | Customers grouped by location/area | Route Planning | The template drawer | An **Area** on the route, and area-filtered customer selection | 🔵 | Req 24 ⚪, req 25 |
| **39** | Loading should consider route sequence | Route Planning | **The "Selected (N)" list** — it exists, it just isn't ordered | Make it orderable. Sequence is the product of this change | 🔵 | — |
| **27** | Recommend staff by delivery area / ZIP | Route Planning | **The staff multi-select's "N templates" conflict badge** — the same row, a second hint | An area-match hint beside each staff member | 🔵 | Staff area *(Workforce)* |
| **28** | The recommendation reduces incorrect assignment | Route Planning | The same conflict badge — **it already does half of this** | Surface it during run preparation, not only template editing | 🔵 | Req 27 |
| **7** | Staff see the customer route/location during delivery | Delivery Management | **At Customer already shows 📍 address + 📞 call.** The Queue row shows name and money only | Address on the Queue row and Stop Summary | 🟢 | — |
| **8** | The route helps staff navigate between customers | Delivery Management | The stop screen's address block | A **Navigate** action handing off to the phone's maps app | 🟡 | Address string works now; a pin needs req 25 |
| **9** | Denominations when cash is allotted to staff | Delivery Management | **The "Add Currency" sheet Cash Handover already has** | Reuse that sheet at Cash for Change | 🟢 | — |
| **10** | Denominations when collecting from customers | Delivery Management | The same sheet | Placement, not construction | 🟡 | ❓ **D4** — per stop, or handover only |
| **29** | Save the delivery date/time on Delivered | Delivery Management | `completedAt`, stamped and read back on the Queue row and Stop Summary | Nothing | ⚪ | — |
| **30** | Save the final order details | Delivery Management | Stop Summary's order card; Route Intelligence's summaries | Nothing in UX | ⚪ | 🛑 the route never closes |
| **31** | Save the payment details | Delivery Management | Amount, method, write-off, partial and advance outcomes are all captured | Nothing | ⚪ | — |
| **32** | The delivered order is locked for normal users | Delivery Management | A completed stop already withdraws Collect, Edit and Skip | Make the lock explicit and state why | 🟡 | RBAC *(outside)* |
| **41** | Loading should consider product quantity | Delivery Management | **Load Stock**, and its banner *"Quantities auto-filled… Adjust if needed."* | Bind the pre-fill to the run's plan | 🟡 | ❓ **D5** |
| **52** | Sales-capturing staff cannot change prices | *owner outside* | **DM's Offer Price sheet** — every driver can reprice any line | The conflict is inside this journey even though the rule is not | 🔴 | ❓ **D2**, RBAC |
| **53** | Sales-capturing staff cannot apply discounts | *owner outside* | **DM's order-discount sheet and write-off tick-box** | Same | 🔴 | ❓ **D2**, RBAC |

**Distribution:** 🟢 2 · 🟡 7 · 🔵 5 · ⚪ 4 · 🔴 3 — **21 total**

### B — Requirements that should explicitly stay outside

| Requirements | Why they cannot be solved by these three modules |
| --- | --- |
| **2, 3** *(COD, 50% at booking)* | Commercial payment terms are defined on the **order**. Delivery Management executes the resulting state |
| **5, 6, 54** *(category, subcategory, approved price list)* | **Product Master / Catalog.** Nothing to do with customer capture, route or execution |
| **13–17** *(Driver, Supervisor, Cash Handler, Un-loader, other roles)* | The **role taxonomy is Workforce's**. Route Planning's staff multi-select *consumes* it — adding a role is a Workforce change, not a change to this journey |
| **18** *(total weight)* | Needs a **product weight** attribute in Product Master, and totals an **order** selection in Sales Orders |
| **19–23, 40, 42, 43, 44** *(vehicle, capacity, distance, clubbing, cost, LIFO, weight, refrigeration)* | Needs a **vehicle master** that exists in no module, plus product weight. **Nine requirements of pure new foundation** — see the note below |
| **33** *(authorised correction + audit)* | Needs RBAC and a separate approval workflow. Delivery Management's only in-scope part would be a "Request Correction" entry point |
| **34–38** *(10 PM cutoff, eligibility, no UI filter)* | A **backend** rule feeding Sales Orders. Explicitly must not become a UI filter |
| **45–51** *(invoice format, order number, CGST/SGST, packaging unit, T&C, amount in words)* | The **commercial document** belongs to Sales Orders and Finance |
| **55** *(price changes restricted to Management/Marketing)* | **Platform RBAC.** Requirements 52 and 53 appear in list A only because the *conflict* is inside Delivery Management |

> **On 19–23 and 42–44.** These are genuinely part of *preparing a run*, so they are journey-adjacent
> rather than irrelevant. They are excluded because a vehicle master exists nowhere in v6 and product
> weight lives in Product Master — **no UX change across these three modules can deliver them.** Adding
> them here would make the change set large and dependent, which is the opposite of what this model is
> for. They belong to a Vehicle & Load Planning capability, sequenced after this journey works.

---

## 3. The target-state journey

Four states, three modules, one chain.

```mermaid
flowchart LR
    S1["① CUSTOMER DATA<br/>👤 B2B Customer Management<br/><i>a customer that CAN be delivered to</i>"]
    S2["② ROUTE PLAN<br/>🗺️ Route Planning<br/><i>who, where, in what order</i>"]
    S3["③ DELIVERY RUN<br/>🗺️ Route Planning → 📦 DM<br/><i>a dated, crewed instance of a route</i>"]
    S4["④ GROUND EXECUTION<br/>📦 Delivery Management<br/><i>the driver works it</i>"]

    S1 -->|"delivery-ready customers only"| S2
    S2 -->|"an ordered, area-scoped stop list"| S3
    S3 ==>|"THE APPROVED RUN"| S4
    S4 -.->|"📍 pin captured at the door"| S1
    S4 -.->|"outcomes per stop"| S3

    classDef cust fill:#eef2ff,stroke:#6366f1,color:#111
    classDef route fill:#e8f5f7,stroke:#1B6272,color:#111
    classDef run fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#111
    classDef exec fill:#f0fdf4,stroke:#16a34a,color:#111
    class S1 cust
    class S2 route
    class S3 run
    class S4 exec
```

### 3.0 What flows between the modules

```mermaid
flowchart TD
    subgraph CM["👤 B2B CUSTOMER MANAGEMENT — owns the customer"]
        direction TB
        C1["Name · Phone ✅ required today"]
        C2["Address · State · PIN ⚪ already captured"]
        C3["➕ Delivery pin — req 25"]
        C4["➕ Beat / area — feeds req 26"]
        C5["➕ Credit terms — req 1"]
    end

    subgraph RP["🗺️ ROUTE PLANNING — owns the plan"]
        direction TB
        R1["Route name ⚪ exists"]
        R2["Customers ⚪ exists as a multi-select"]
        R3["Staff ⚪ exists as a multi-select"]
        R4["➕ Area — req 26"]
        R5["➕ Stop sequence — req 39"]
        R6["➕ THE RUN — date + crew + status"]
    end

    subgraph DM["📦 DELIVERY MANAGEMENT — owns execution"]
        direction TB
        D1["Route card by status ⚪ exists"]
        D2["Stop: name · address · phone ⚪ exists"]
        D3["Order · outstanding · advance ⚪ exists"]
        D4["➕ Address on the Queue row — req 7"]
        D5["➕ Navigate — req 8"]
        D6["➕ Denominations on the float — req 9"]
    end

    C1 --> R2
    C2 --> R4
    C3 --> D5
    C4 --> R4
    C5 --> D3
    R5 --> D1
    R6 ==>|"the run is what DM opens"| D1
    C2 --> D4

    D5 -.->|"pin confirmed at the door"| C3

    classDef cust fill:#eef2ff,stroke:#6366f1,color:#111
    classDef route fill:#e8f5f7,stroke:#1B6272,color:#111
    classDef exec fill:#f0fdf4,stroke:#16a34a,color:#111
    classDef new fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#111
    class C1,C2 cust
    class R1,R2,R3 route
    class D1,D2,D3 exec
    class C3,C4,C5,R4,R5,R6,D4,D5,D6 new
```

---

### 3.1 State ① — A customer that can be delivered to

> **Actor:** store admin · **Goal:** *"Capture enough about this shop that a driver can actually find it
> and settle with it."*

**The product question this state answers:** *what must be true before a customer may enter a route?*

```mermaid
flowchart TD
    G(["🎯 A customer a driver can find, reach and settle with"]) --> ADD

    ADD["👤 Add / Edit B2B Customer — the existing drawer"]
    ADD --> IDENT["IDENTITY ⚪ exists<br/>Customer Code · Name · Email · Phone*"]
    ADD --> ADDR["WHERE ⚪ exists<br/>Billing Address · State · PIN Code<br/>+ separate Shipping Address"]
    ADD --> COMM["COMMERCIAL ⚪ partly<br/>GST type &amp; number · Opening Balance"]

    ADD --> NEW["➕ NEW: DELIVERY PROFILE — one new block"]
    NEW --> N1["📍 Delivery pin — req 25"]
    NEW --> N2["🗺️ Beat / area — feeds req 26"]
    NEW --> N3["💳 Credit terms — req 1<br/><i>DM's stop already carries creditAmount</i>"]

    N1 --> D6{"❓ D6 OPEN — how is the pin captured?"}
    D6 -->|"map pin in the drawer"| P1["Admin effort · accurate · poor coverage"]
    D6 -->|"geocoded from address + PIN"| P2["No effort · unreliable for shop fronts"]
    D6 -->|"driver confirms at the door"| P3["💡 RECOMMENDED, NOT APPROVED<br/>Coverage approaches 100% in one cycle —<br/>State ④ already opens every shop once"]

    IDENT --> GATE
    ADDR --> GATE
    NEW --> GATE{"➕ DELIVERY-READY? — req 4 reframed"}
    GATE -->|"Yes"| OK["✅ Customer may enter a route"]
    GATE -->|"No"| BLOCK["⚠️ Saved, but flagged NOT DELIVERY-READY.<br/>Reuses the existing inline-error + toast pattern"]

    BLOCK --> LIST["➕ The list gains a delivery-readiness signal<br/><i>the Address column already renders '-' when empty —<br/>the same idea, made actionable</i>"]

    GATE --> D4Q{"❓ OPEN — is the gate hard or soft?"}
    D4Q -->|"HARD"| H1["Cannot save without delivery fields.<br/>Breaks quick capture and bulk import"]
    D4Q -->|"SOFT · 💡 recommended"| H2["Saves, but cannot be added to a route<br/>until complete. Keeps capture fast"]

    OK --> END(["✅ STATE ① — a delivery-ready customer"])
    H2 --> END

    ALT["↩️ EXCEPTION — bulk import<br/><i>Import columns are name, email, phone, address, state, postnr.<br/>Imported rows land NOT delivery-ready until a pin exists</i>"]
    ADD -.-> ALT

    classDef goal fill:#1B6272,color:#fff,stroke:none
    classDef exist fill:#eef2ff,stroke:#6366f1,color:#111
    classDef new fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#111
    classDef dec fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#111
    classDef alt fill:#fff7ed,stroke:#f97316,color:#111
    class G goal
    class ADD,IDENT,ADDR,COMM exist
    class NEW,N1,N2,N3,GATE,LIST,P1,P2,P3,H1,H2,OK new
    class D6,D4Q dec
    class ALT,BLOCK alt
    class END exist
```

**Minimum customer information for delivery** — the contract State ② depends on:

| Field | Today | Needed for |
| --- | --- | --- |
| Name, Phone | ⚪ Phone is already required | Identifying and calling the shop — DM's stop already shows 📞 |
| Address, State, **PIN** | ⚪ all three exist | Finding the shop; grouping by area *(req 26)* |
| **Delivery pin** | ❌ | Navigation *(req 8)*, distance, accurate area grouping |
| **Beat / area** | ❌ | Which route this customer belongs to *(req 26)* |
| **Credit terms** | ❌ | What the driver may collect *(req 1)* |

---

### 3.2 State ② — The route plan

> **Actor:** distribution planner · **Goal:** *"Decide who is on this route, and in what order."*

```mermaid
flowchart TD
    G(["🎯 An ordered list of shops a driver can actually drive"]) --> T

    T["🗺️ Delivery Templates — the existing list<br/><i>Name · Customers · Staff · Actions</i>"]
    T --> DR["The existing drawer: Route Name* · Customers · Staff"]

    DR --> A["➕ AREA on the route — req 26<br/><i>DM routes already carry a beatArea label;<br/>Route Planning has no such field</i>"]

    A --> HOW{"❓ OPEN — how do customers enter a route?"}
    HOW -->|"TODAY — manual multi-select"| E1["Planner searches and ticks each customer.<br/>⚪ works; does not scale past a few dozen"]
    HOW -->|"💡 RECOMMENDED, NOT APPROVED"| E2["Filter the SAME multi-select by area,<br/>then tick. Keeps the component, adds a lens"]
    HOW -->|"auto-assign by area"| E3["Every delivery-ready customer in the area<br/>joins automatically. Fast, but the planner<br/>loses control of the round"]

    E2 --> ELIG{"➕ Only DELIVERY-READY customers are selectable — State ①"}
    ELIG -->|"ready"| SEL["Selected (N) — the existing list"]
    ELIG -->|"not ready"| GREY["⚠️ Shown but not selectable, with the reason.<br/><i>Sends the planner back to State ① rather than<br/>letting an unreachable shop onto a route</i>"]

    SEL --> SEQ["➕ MAKE 'Selected (N)' ORDERABLE — req 39<br/><i>the list already exists with per-row remove;<br/>it simply has no order. Drag to sequence</i>"]

    SEQ --> SQ{"❓ OPEN — who owns the order of stops?"}
    SQ -->|"💡 fixed at planning"| Q1["The run's sequence is the driver's sequence"]
    SQ -->|"driver may resequence"| Q2["Planning order becomes a suggestion"]

    DR --> STAFF["Staff multi-select ⚪ exists,<br/>with its 'N templates' conflict badge"]
    STAFF --> REC["➕ Area-match hint on the same row — reqs 27, 28<br/><i>the badge already warns about double-booking;<br/>this adds 'works this area'</i>"]

    Q1 --> END(["✅ STATE ② — an ordered, area-scoped route<br/>with a crew"])
    REC --> END

    ALT1["↩️ EXCEPTION — a customer belongs to no area<br/>❓ manual placement, or blocked?"]
    ALT2["↩️ EXCEPTION — a customer is already on another template<br/>⚪ the conflict badge ALREADY warns about this"]
    A -.-> ALT1
    SEL -.-> ALT2

    classDef goal fill:#1B6272,color:#fff,stroke:none
    classDef exist fill:#e8f5f7,stroke:#1B6272,color:#111
    classDef new fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#111
    classDef dec fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#111
    classDef alt fill:#fff7ed,stroke:#f97316,color:#111
    class G goal
    class T,DR,E1,SEL,STAFF exist
    class A,E2,E3,ELIG,SEQ,REC,Q1,Q2 new
    class HOW,SQ dec
    class ALT1,ALT2,GREY alt
    class END exist
```

**Minimum route information** — the contract State ③ depends on:

| Field | Today | Needed for |
| --- | --- | --- |
| Route name | ⚪ exists, required | Identifying the route |
| Customers | ⚪ exists as an unordered set | Who is on the round |
| Staff | ⚪ exists as an unordered set | Who works it |
| **Area** | ❌ | Grouping *(26)*, staff suggestion *(27)* |
| **Sequence** | ❌ | The order the driver drives *(39)* |

---

### 3.3 State ③ — The delivery run, and the handoff

> **Actor:** distribution planner · **Goal:** *"Turn this route into today's work and hand it to a driver."*
>
> **This is the missing object.** Route Planning makes templates; Delivery Management opens pre-seeded
> routes. Neither can create a run.

```mermaid
flowchart TD
    G(["🎯 One reviewable thing a driver can be handed"]) --> T

    T["🗺️ A route template — State ②"]
    T --> NEW["➕ NEW: 'PREPARE RUN' — the one genuinely new screen"]

    NEW --> F1["📅 Date"]
    NEW --> F2["👤 Driver — from the route's staff"]
    NEW --> F3["📋 The stop list, in sequence, read back for review"]
    NEW --> F4["📍 Area"]

    F3 --> CHK{"Every stop still delivery-ready? — State ①"}
    CHK -->|"Yes"| OKR["Run can be prepared"]
    CHK -->|"No"| WARN["⚠️ Named shops blocked, with the reason.<br/>Drop them, or fix them in 👤 Customer Management"]
    WARN -.-> T

    OKR --> D1{"❓ D1 OPEN — where does a run start?"}
    D1 -->|"ROUTE-FIRST · what req 11 asks for"| R1["The planner starts from a route.<br/>💡 RECOMMENDED for this journey — it is the only<br/>path these three modules can complete alone"]
    D1 -->|"ORDER-FIRST · Sales Orders' shipped wizard"| R2["🔴 A second, contradictory entry exists today.<br/>Both must converge on ONE run object"]

    R1 --> RUN["📜 THE RUN — the handoff contract<br/>route · area · <b>ordered stops</b> · date · driver · status<br/><i>DM's route object already has name, beatArea,<br/>scheduledDate, status, driver and stops —<br/>the shape it needs already exists</i>"]

    RUN --> NAME["Name the run<br/><i>♻️ DM's New Delivery modal already pre-fills<br/>'&lt;Template&gt; DD/MM/YYYY HH:MM' and refuses duplicates</i>"]

    NAME --> HAND["📦 The run appears on DM's Home as a READY route<br/><i>♻️ Home already renders route cards by status and<br/>opens the right screen for each — no change needed</i>"]

    HAND --> END(["✅ STATE ③ — the driver has today's work"])

    ALT["↩️ EXCEPTION — no driver assigned<br/>❓ block the run, or prepare it unassigned?"]
    F2 -.-> ALT

    GAP["⚠️ NO REQUIREMENT DESCRIBES THIS STATE.<br/>Requirements 11 and 12 circle it; none defines the object.<br/>💡 Recommended, not approved: treat the run contract as a<br/>first-class deliverable — without it, State ② produces<br/>nothing State ④ can consume"]
    RUN -.-> GAP

    classDef goal fill:#1B6272,color:#fff,stroke:none
    classDef exist fill:#e8f5f7,stroke:#1B6272,color:#111
    classDef new fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#111
    classDef dec fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#111
    classDef alt fill:#fff7ed,stroke:#f97316,color:#111
    classDef warn fill:#fee2e2,stroke:#dc2626,color:#111
    class G goal
    class T,NAME,HAND exist
    class NEW,F1,F2,F3,F4,OKR,R1,RUN new
    class D1 dec
    class ALT,WARN alt
    class GAP,R2 warn
    class END exist
```

**What the driver receives** — and how much of it Delivery Management can already hold:

| The run carries | DM's route object today |
| --- | --- |
| Route name | ⚪ `name` |
| Area | ⚪ `beatArea` |
| Date | ⚪ `scheduledDate` |
| Driver | ⚪ `driver` |
| Status | ⚪ `status` — Ready / In Progress / … |
| Stops with name, phone, address | ⚪ all present on the stop's customer |
| **Ordered** stops | ❌ a `sequence` exists in seed data that no planner can set |
| **Delivery pin per stop** | ❌ needs State ① |

---

### 3.4 State ④ — Ground execution

> **Actor:** driver · **Goal:** *"Work the round, settle each shop, account for the day."*
>
> This state is **already built end to end.** The changes below are three small extensions, not a redesign.

```mermaid
flowchart TD
    G(["🎯 Work the round the planner handed me"]) --> H

    H["📦 HOME — the run appears as a READY route card ⚪"]
    H --> PS["📦 PRE-START — three gates, in order ⚪<br/><i>a route cannot start until stock AND cash are recorded</i>"]

    PS --> LS["📦 ① Load Stock ⚪<br/><i>steppers, live totals, and a banner already reading<br/>'Quantities auto-filled… Adjust if needed.'</i>"]
    LS --> D5{"❓ D5 OPEN — free count, or confirm a plan? — req 41"}
    D5 -->|"free count · today"| L1["Driver types any quantity"]
    D5 -->|"confirm the run's plan"| L2["Pre-filled with variance shown"]

    L1 --> CC
    L2 --> CC["📦 ② Cash for Change ⚪ — amount + quick chips"]
    CC --> DEN["➕ DENOMINATION BREAKDOWN — req 9 🟢<br/>♻️ REUSES the 'Add Currency' sheet Cash Handover already has"]

    DEN --> RTS["📦 ③ Ready to Start ⚪ — take responsibility"]
    RTS --> Q["📦 DELIVERY QUEUE ⚪<br/><i>one flat list in route order — the ORDER now comes from State ②</i>"]

    Q --> ADDR["➕ ADDRESS ON EACH ROW — req 7 🟢<br/><i>At Customer already shows 📍 address; the Queue shows<br/>name and money only</i>"]
    Q --> NAV["➕ 🧭 NAVIGATE — req 8"]
    NAV --> NQ{"What can we hand the maps app?"}
    NQ -->|"TODAY"| NV1["The address string → maps search. 🟢 buildable now"]
    NQ -->|"WITH State ①'s pin"| NV2["An exact pin"]
    NV2 -.->|"❓ D6"| CAP["➕ Confirm the pin at the door<br/>→ writes back to 👤 Customer Management"]

    Q --> STOP["📦 THE STOP SCREEN ⚪<br/><i>Book Order when nothing is booked · At Customer otherwise</i>"]

    STOP --> TERM["➕ Total Due respects the customer's CREDIT TERMS — req 1<br/><i>DM's stop already carries creditAmount; Total Due already<br/>has four explaining lines</i>"]

    STOP --> PRICE{"❓ D2 OPEN — may this driver change the price? — reqs 52, 53"}
    PRICE -->|"TODAY — unrestricted"| PR1["🔴 Offer Price sheet + order-discount sheet,<br/>with NO permission check"]
    PRICE -->|"restricted"| PR2["Controls gated. A live capability is withdrawn"]

    PR1 --> PAY
    PR2 --> PAY["📦 COLLECT PAYMENT ⚪ — Cash | UPI, chips, pad"]
    PAY --> D4{"❓ D4 OPEN — denominations here? — req 10"}
    D4 -->|"per stop"| DN1["Six more fields on the most repeated screen"]
    D4 -->|"💡 handover only"| DN2["⚪ Already covered at Cash Handover"]

    DN1 --> OUT
    DN2 --> OUT["📦 OUTCOME ⚪ — full · over · partial · write-off · ₹0 on advance"]
    OUT --> SAVE["⚪ AUTOMATICALLY SAVED — reqs 29, 30, 31<br/>date/time · final order lines · payment outcome"]
    SAVE --> LOCK["➕ THE STOP IS EXPLICITLY LOCKED — req 32 🟡<br/><i>Collect, Edit and Skip are already withdrawn;<br/>saying so, and making it role-aware, is the change</i>"]

    LOCK --> NEXT["⚙️ The next pending stop becomes Current ⚪"]
    NEXT -.-> Q

    Q --> SETTLE["📦 SETTLE ROUTE ⚪ — Stock Count → Cash Handover<br/><i>the denomination sheet lives here today</i>"]
    SETTLE --> RI["📦 ROUTE INTELLIGENCE ⚪ — the day read back"]
    RI --> END(["✅ STATE ④ — the round is worked and accounted for"])

    EX["↩️ EXCEPTIONS ⚪ ALL BUILT<br/>Edit Order · Skip Stop · Product Return · Manage Assets<br/>· standalone collection · Stop Summary · Restock"]
    STOP -.-> EX
    EX -.-> Q

    classDef goal fill:#1B6272,color:#fff,stroke:none
    classDef exist fill:#f0fdf4,stroke:#16a34a,color:#111
    classDef new fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#111
    classDef dec fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#111
    classDef conflict fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#111
    classDef alt fill:#fff7ed,stroke:#f97316,color:#111
    class G goal
    class H,PS,LS,CC,RTS,Q,STOP,PAY,OUT,SAVE,NEXT,SETTLE,RI,L1,DN2 exist
    class DEN,ADDR,NAV,NV1,NV2,CAP,TERM,LOCK,L2,DN1,PR2 new
    class D5,NQ,PRICE,D4 dec
    class PR1 conflict
    class EX alt
    class END exist
```

---

## 4. The answers

### C — The target-state end-to-end UX flow

States ①–④ above. In one line each:

1. **① Customer data** — a customer becomes *delivery-ready* when it has an address, a PIN, a pin on the map and a beat. Not delivery-ready means not selectable for a route.
2. **② Route plan** — a route gains an **area** and an **ordered** stop list, chosen from delivery-ready customers, with an area hint on staff.
3. **③ Delivery run** — a route plus a date plus a driver becomes a **run**: the object that does not exist today and that everything else waits on.
4. **④ Ground execution** — Delivery Management opens the run as a Ready route and works it unchanged, plus three small extensions: address on the queue, Navigate, denominations on the float.

### D — Existing UX we can reuse

| Reuse this | For | Requirement |
| --- | --- | --- |
| The customer drawer's **required-field pattern** *(Phone, inline error, toast)* | The delivery-readiness gate | 4 |
| **PIN Code (Billing / Shipping)** | Area grouping | 24 ⚪, 26 |
| The **Address column's "-" when empty** | The delivery-readiness signal on the list | 4 |
| The customer **multi-select** — search, checkbox, Selected(N) | Area-filtered selection | 26 |
| The **"N templates" conflict badge** | Staff area hint — *it already does half of req 28* | 27, 28 |
| The **"Selected (N)" list** with per-row remove | Make it orderable → sequence | 39 |
| DM's **route object** — name, beatArea, scheduledDate, status, driver, stops | The run contract; the shape already exists | 11, 12 |
| DM's **Home route cards by status** | Receiving the run — no change needed | 11 |
| DM's **New Delivery naming** — pre-fill + duplicate refusal | Naming the run | 11 |
| DM's **"Add Currency" denomination sheet** | Denominations on the cash float | 9, 10 |
| **At Customer's** 📍 address + 📞 call block | Address on the Queue row; Navigate | 7, 8 |
| DM's **Total Due** and its four explaining lines | A fifth line for credit terms | 1 |
| DM's **completed-stop state** | The explicit lock | 32 |
| DM's **Load Stock** auto-fill banner | Plan confirmation | 41 |
| **All DM exceptions** — Edit Order, Skip, Return, Assets, Restock, Stop Summary | Nothing changes | — |

### E — New UX / capabilities required

| # | New capability | Module | Size | Serves |
| --- | --- | --- | --- | --- |
| **N1** | **Delivery Profile block** — pin, beat/area, credit terms | B2B Customer | Small — one drawer section | 1, 25, 26 |
| **N2** | **Delivery-readiness gate + list signal** | B2B Customer | Small — reuses the validation pattern | 4 |
| **N3** | **Area on a route**, and area-filtered customer selection | Route Planning | Small — one field, one filter on an existing component | 26 |
| **N4** | **Orderable Selected(N) list** → stop sequence | Route Planning | Small — the list exists, it needs an order | 39 |
| **N5** | **Area hint on the staff multi-select** | Route Planning | Small — a second badge on an existing row | 27, 28 |
| **N6** | **"Prepare Run"** — route + date + driver → a run | Route Planning → DM | **Medium — the only new screen** | 11, 12 |
| **N7** | **Address on the Queue row** | Delivery Management | Small | 7 |
| **N8** | **Navigate action** on a stop | Delivery Management | Small | 8 |
| **N9** | **Denominations at Cash for Change** | Delivery Management | Small — reuses an existing sheet | 9 |
| **N10** | **Pin capture at the door** → writes to Customer Management | Delivery Management | Medium — new data direction | 25 |
| **N11** | **Explicit locked state** | Delivery Management | Small, but needs RBAC | 32 |
| **N12** | **Credit-terms-aware Total Due** | Delivery Management | Small | 1 |

### F — The smallest sensible implementation sequence

**The critical question was: what is the smallest coherent change set that solves the largest useful
subset?** The answer is **six changes — N1, N2, N3, N4, N6, N7 — which connect the chain and solve
13 of the 21 in-journey requirements.** Everything else is optional on top.

```mermaid
flowchart LR
    W1["WAVE 1 — CONNECT THE CHAIN<br/>N1 Delivery Profile · N2 readiness gate<br/>N3 area · N4 sequence · N6 Prepare Run<br/>N7 address on the queue"]
    W2["WAVE 2 — MAKE THE ROUND EASIER<br/>N8 Navigate · N9 denominations on the float<br/>N5 staff area hint · N12 credit-aware Total Due"]
    W3["WAVE 3 — DECISION-GATED<br/>N10 pin at the door ❓D6<br/>N11 explicit lock ❓D2 + RBAC<br/>denominations placement ❓D4<br/>load confirmation ❓D5"]

    W1 --> W2 --> W3
    classDef w fill:#e8f5f7,stroke:#1B6272,color:#111
    classDef d fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#111
    class W1,W2 w
    class W3 d
```

| Wave | Changes | Solves | Why this order |
| :---: | --- | --- | --- |
| **1** | N1, N2, N3, N4, N6, N7 | **1 *(field)*, 4, 7, 11, 12, 24 ⚪, 25 *(field)*, 26, 29 ⚪, 30 ⚪, 31 ⚪, 39** — **13** | **Connects Customer → Route → Run → Ground for the first time.** Five of the six are extensions of existing components; only N6 is a new screen. Nothing here is blocked on a decision except D1, and route-first is the only path these three modules can complete alone |
| **2** | N8, N9, N5, N12 | **8, 9, 27, 28** — **4** | Pure quality-of-life on a chain that already works. N9 reuses an existing sheet; N5 adds a badge to an existing row. N8 ships with the address string and improves when N10 lands |
| **3** | N10, N11, and the placement of denominations and load confirmation | **10, 32, 41, 52, 53** — **5** | **Every one is gated on an open decision** — D6, D2, D4, D5 — or on RBAC, which is outside these three modules. Building any of them before the decision is rework |

**What Wave 1 does not need:** a vehicle master, product weight, RBAC, backend eligibility, order
references, or any change to Sales Orders, Finance, Workforce, Product Master or Live Tracking.

**What Wave 1 does need Product to decide:** ❓ **D1** — if delivery creation must stay order-first in
Sales Orders, then N6 belongs there instead, and these three modules cannot complete the journey alone.
💡 *Recommended, not approved:* let Route Planning own run preparation for route-based delivery, and
require that any order-first path produce **the same run object**.

---

## 5. Open questions this model raises

| # | Question | Where it bites | Label |
| --- | --- | --- | --- |
| Q1 | Is the delivery-readiness gate **hard** *(cannot save)* or **soft** *(cannot route)*? | State ① | ❓ Open — 💡 soft |
| Q2 | How is the delivery pin captured — admin, geocode, or driver at the door? | State ①, ④ | ❓ **D6** — 💡 driver |
| Q3 | Is an area a **PIN cluster**, a **named beat**, or a **drawn zone**? | State ② | ❓ Open — 💡 named beat, since `beatArea` already exists as vocabulary in DM |
| Q4 | Does the planner fix the stop order, or may the driver resequence? | State ②, ④ | ❓ Open — 💡 fixed at planning |
| Q5 | Can a run be prepared with no driver assigned? | State ③ | ❓ Open |
| Q6 | Does Route Planning own run preparation, or Sales Orders? | State ③ | ❓ **D1** |
| Q7 | What does a credit term actually change at the door? | State ①, ④ | ❓ Open |
| Q8 | May the driver set offer prices and discounts? | State ④ | ❓ **D2** — a live DM capability is at stake |

> **Nothing in this document is approved.** Every 💡 is a proposed direction with reasoning, not a
> product rule. D1, D2, D4, D5 and D6 are the same decisions registered in
> `delivery-requirements-solution-assessment.md` Part G, and remain ❓ OPEN there.

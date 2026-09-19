# Foodbridge — The Unified User Journey

One end-to-end journey. Every flow from the four source documents merged into a single spine, with the duplications collapsed and the contradictions decided.

Companion to [`foodbridge-master-reference.md`](foodbridge-master-reference.md), which holds the unmerged detail of each source. This document does not repeat that content — it resolves it.

---

## The problem this document solves

The four sources each describe a journey, but they describe **different slices of the same journey from different angles**, and where they touch they disagree:

- The WhatsApp flow describes *how you get in* — but stops at the door of the product.
- The lifecycle demo describes *a day inside* — but assumes you are already a customer, and never shows how you became one.
- The build spec describes *the machine* — the loop underneath both, in machine terms.
- Neither user-facing flow accounts for the field staff, who appear in the demo with no way in.

Read literally, the four documents specify **four products**: an onboarding funnel, a demo, an operating platform, and an agent. They are one product. This is that one product's journey.

---

## Part 1 — The shape of the whole thing

### 1.1 One gate, five lanes, one loop

```
                          ANY INBOUND CONTACT
                      WhatsApp · in-app · voice
                                  │
                      ┌───────────▼───────────┐
                      │  IDENTITY RESOLUTION  │   resolved on the phone number,
                      │  one gate, five ways  │   before a single question is asked
                      └───────────┬───────────┘
                                  │
      ┌───────────┬───────────────┼───────────────┬───────────┐
      ▼           ▼               ▼               ▼           ▼
   VISITOR     EXPLORER        OPERATOR         FIELD       BUYER
   unknown     no store yet    runs a store     invited     customer of
   number                                       staff       a store
      │           │               │               │           │
   OTP bind    DEMO — the        THE DAY        scoped      store-scoped
      │        loop running         │           mobile       services
      │        on demo data         │             │           │
      └──────────►│                 │             │           │
                  │                 │             │           │
            CONVERSION              │             │           │
       store + signal source        │             │           │
          + first snapshot          │             │           │
                  └─────────────────┤             │           │
                                    ▼             ▼           ▼
              ╔═══════════════════════════════════════════════════╗
              ║   THE LOOP — the same seven beats, whichever      ║
              ║   lane you came in through, on demo data or real  ║
              ╚═══════════════════════════════════════════════════╝
                                    │
                        every pass leaves the business
                        one verified outcome richer
                                    ↺
```

**The single idea that merges the four documents:** there are not four journeys. There is one loop, and the lanes differ only in *who is standing in it*, *whether the data is real*, and *how much the agent is allowed to do without asking*.

### 1.2 The seven beats

Every meaningful thing that happens to any user, in any lane, is one pass through these:

```
   ① SIGNAL ────────► ② DETECT & RANK ────────► ③ REACH
       ▲                                            │
       │                                            ▼
       │                                      ④ UNDERSTAND
       │                                            │
       │                                            ▼
   ⑦ RECORD & LEARN ◄─── ⑥ EXECUTE & VERIFY ◄─── ⑤ DECIDE
                                                    │
                                    policy gate: allow · ask · escalate
```

| Beat | What happens | Who owns it | Source |
|---|---|---|---|
| **① Signal** | Something changed — an invoice aged, stock moved, an order arrived, a route closed | Foodbridge events | Spec §26 |
| **② Detect & rank** | Deterministic detection scores it; most candidates are suppressed | Nudge Engine — *not the LLM* | Spec §9–11 |
| **③ Reach** | The survivor reaches the right person on the right channel | Channel adapter | WhatsApp flow §7, Demo 01 |
| **④ Understand** | The agent explains it with evidence, in the context of the screen the user is on | AI Assistant | Spec §8, §21 |
| **⑤ Decide** | Policy gates it; user confirms, or it is pre-approved, or it escalates to a human | Policy Engine | Spec §7, §16, §23 |
| **⑥ Execute & verify** | Runs through a Foodbridge business action, then reads state back to confirm it actually happened | Action Executor | Spec §14–15 |
| **⑦ Record & learn** | Outcome joins the snapshot; accept/dismiss trains the ranking | Snapshot + Learning | Spec §13, §18 |

Beat ⑦ produces beat ① of the next pass. That is the whole product.

### 1.3 The two axes the journey actually travels

The user does not progress through *screens*. They progress along two axes, and the journey is the diagonal:

```
  REAL ▲
       │                                        ┌──────────────┐
       │                          ┌─────────────┤  Stage 5     │
       │            ┌─────────────┤  Stage 4    │  compounding │
       │  ┌─────────┤  Stage 3    │  the team   └──────────────┘
       │  │ Stage 2 │  the day    │  joins
       │  │ convert └─────────────┘
  DATA │  └─────────┐
       │  ┌─────────┴───┐
       │  │  Stage 1    │
       │  │  the demo   │
  DEMO │  └─────────────┘
       └──────────────────────────────────────────────────────►
         L0/L1          L2            L3           L4    AUTONOMY
        observe      prepare       confirm &    bounded
       recommend                    execute    autonomous
```

Two rules fall straight out of this picture, and both are load-bearing:

- **Nothing moves right before it moves up.** The agent never prepares or executes on data it has only just met. A newly connected store runs at L0/L1 until its first real snapshot exists.
- **Autonomy is earned per action type, never granted per user.** `schedule_reminder` may reach L4 in week two. `create_purchase_request` may never leave L2. The fence in Spec §23 is absolute regardless of tenure.

---

## Part 2 — The five identities, reconciled

The sources name these inconsistently, and one of them is missing entirely.

| Unified name | Source name | Who they are | Their surface | Can act on |
|---|---|---|---|---|
| **Visitor** | *(unnamed)* | A WhatsApp number we do not recognise | WhatsApp only | Nothing |
| **Explorer** | Guest User | Authenticated, no store yet | WhatsApp + demo web | Demo data only |
| **Operator** | Business User | Owns or runs a store | WhatsApp + full web + mobile | Their own store |
| **Field** | ***missing*** | Staff invited by an Operator | WhatsApp + scoped mobile | Route, audit, collection |
| **Buyer** | Private User | End customer linked to a store | WhatsApp only | Their own orders |

### Three naming and scoping decisions

**1. "Private User" should be renamed "Customer" (or "Buyer").** "Private" reads as a privacy setting, not a person. Everywhere else in the product this person is called *the customer* — the demo calls them Shree Stores and puts them in a customer list. Two words for one person in one product is a defect. *Recommendation, not yet decided — it touches the IVR copy and probably schema.*

**2. Field is a real identity and has to be specified.** The demo has a field user running a route at 10:15 and submitting a stock audit at 11:00. The WhatsApp flow has no lane that produces that person. They get in exactly one way: **an Operator invites them, the invite arrives on WhatsApp, and they land in a scoped mobile session.** Their scope is deliberately narrow — route, stops, delivery, audit, collection. No receivables, no purchase, no working capital, no customer credit. Field staff see the stops, not the books.

**3. One phone number can hold more than one role.** A man can be the owner of a wholesale business *and* a retail customer of a distributor who also uses Foodbridge. Both source flows assume one number resolves to exactly one person-type; it does not. Resolution: when identity resolves to more than one role, **ask once, remember the answer, and offer a switch** in the menu footer. Never make them re-answer.

```
You're set up two ways on Foodbridge 👋
Which one do you want right now?
1️⃣ Miha Traders — your business
2️⃣ Shree Stores — your orders as a customer
      (you can switch any time)
```

---

## Part 3 — The journey, stage by stage

### Stage 0 — First contact

**Trigger:** any inbound message from any number.

Identity resolves *before the first reply*, and the reply is already lane-specific. This is the first overlap resolved: the two-option welcome ("1 I have an account / 2 I'm new here") from the WhatsApp flow is **only ever shown to an unrecognised number.** A returning Operator who texts "Hi" should not be asked whether they have an account — the number already answered that. Asking is a dead step that makes the always-on assistant look like it has amnesia.

```
inbound "Hi"
     ↓
resolve(phone_number)
     ├── unknown ....................... → Visitor   → welcome + get started
     ├── known, no store ............... → Explorer  → "Welcome back — pick up where you left off"
     ├── known, store, owner/admin ..... → Operator  → today's ranked nudges, immediately
     ├── known, store, staff ........... → Field     → today's route
     ├── known, linked as customer ..... → Buyer     → their store's services
     └── known, multiple roles ......... → ask once, remember
```

**What an Operator sees at beat ③ is the same content whether they pulled it or it was pushed at 07:15.** That is overlap #1 resolved and it is worth being explicit about, because the two sources describe it as two different features:

| | Push | Pull |
|---|---|---|
| Trigger | Schedule (07:15) or a P0 event | User texts anything |
| Surface | **Foodbridge Recommends** | **Foodbridge Recommends** |
| Content | Top-ranked open nudges | Top-ranked open nudges |
| Freshness | Computed at send | Recomputed on open |

One surface. Two doors. Not two features.

---

### Stage 1 — Prove it *(Visitor → Explorer)*

**Goal:** the user experiences the loop before they own anything.

```
Visitor
   ↓  "Get started"
LOGIN LINK + OTP                        WhatsApp establishes identity;
foodbridge.io/login · OTP 589321        the web app provides the experience
   ↓
VERIFY → authenticated
   ↓
"What kind of food business are you?"
Wholesaler · Retailer · Distributor · Manufacturer
   ↓
EXPLORER — no store, no commitment, full demo access
```

**The business-type question is not a registration step — it is Snapshot 00.** It seeds the demo with a plausible shape (a distributor gets routes and collections; a manufacturer gets production and supply) and gives the cold-start ranker a prior. The moment real data arrives in Stage 2, observed reality supersedes the declared type. Treating self-classification as a *prior to be overwritten* rather than a *fact to be stored* is the merge of the WhatsApp flow's landing page with the spec's snapshot model.

#### The demo is the lifecycle. There is only one of them.

This is the largest duplication in the sources, and collapsing it removes an entire product's worth of build.

The WhatsApp flow offers module demos — *Explore Delivery / Collection / Inventory*. The lifecycle demo is a 13-screen narrated day. **These are the same thing entered at different hours.**

```
THE DEMO DAY  (one build, one dataset, one set of screens)

  07:15  nudge ──┐
  07:30  tower ──┤
  08:05  orders ─┤
  09:10  stock ──┼── "Explore Inventory"  enters here ──┐
  10:00  route ──┼── "Explore Delivery"   enters here ──┼─┐
  10:15  mobile ─┤                                      │ │
  11:00  audit ──┤                                      │ │
  14:20  collect ┼── "Explore Collections" enters here ─┼─┼─┐
  15:00  credit ─┤                                      │ │ │
  16:10  purchase┼──────────────────────────────────────┘ │ │
  17:20  close ──┼────────────────────────────────────────┘ │
  18:30  outcome ┤                                          │
  next   carry ──┘◄─────────────────────────────────────────┘
                     every path converges on the same ending
```

| Guest IVR option | Enters the day at | Runs through | Ends at |
|---|---|---|---|
| Explore Delivery Management | 10:00 route plan | mobile route → stock audit | 17:20 route close |
| Explore Collection Management | 14:20 collections | customer credit collaboration | 18:30 outcome |
| Explore Inventory Management | 09:10 stock vs demand | 16:10 purchase recommendation | 18:30 outcome |
| Explore Foodbridge (full) | 07:15 morning nudge | the whole arc | next morning |

Every route ends identically: **"Here's what Foodbridge saved you today"** — a concrete, numbered outcome, not a thank-you screen. Then the hinge.

> **Build consequence.** There is no "demo product" to maintain alongside the real product. There is the real product, pointed at a demo dataset, with a `demo` flag on the context that disables outbound sends and marks the surface. The 13 screens are the real screens.

---

### Stage 2 — Make it yours *(Explorer → Operator)*

**This is the stage neither source document specifies, and it is the one that decides whether the company has customers.**

The WhatsApp flow ends the demo with a **[Become a part of Foodbridge]** button. The lifecycle demo opens with Miha already onboarded. Between the button and Miha there is an unspecified gap, and everything hard lives in it.

Conversion is not a button. It is three gates:

```
        ┌─────────────────────────────────────────────────┐
        │  GATE 1 — the store exists                      │
        │  name · type (carried from Snapshot 00) ·       │
        │  location · the Operator's own role             │
        └────────────────────────┬────────────────────────┘
                                 ▼
        ┌─────────────────────────────────────────────────┐
        │  GATE 2 — at least one signal source connected  │
        │  Tally · Zoho · CSV upload · or 10 customers    │
        │  and 20 products entered by hand                │
        └────────────────────────┬────────────────────────┘
                                 ▼
        ┌─────────────────────────────────────────────────┐
        │  GATE 3 — Snapshot 01 renders on real data      │
        │  the Control Tower shows their numbers,         │
        │  not the demo's                                 │
        └────────────────────────┬────────────────────────┘
                                 ▼
                          THE LOOP GOES LIVE
```

**Gate 2 is the real activation threshold, and it should be stated as product policy.** An assistant with no signal source has nothing to be proactive about — it degenerates into exactly the chatbot the spec forbids. A store that clears Gates 1 and 3 but not Gate 2 is not activated; it is a logo.

**Until Gate 3, the assistant runs at L0/L1 only.** It observes and it recommends. It does not prepare actions, and it certainly does not execute them, against a dataset it met an hour ago and has never seen move. The first snapshot is not just a screen — it is the evidence that the agent understands this business well enough to be allowed to propose things.

The honest framing for the user:

> "I've connected to your Tally. Give me until tomorrow morning — I'll have watched a full day of your business and I'll tell you the three things worth your attention."

That sentence converts the L0/L1 restriction from a limitation into the product's core promise, and it sets up the 07:15 nudge as the payoff.

---

### Stage 3 — The loop runs *(the Operator's day)*

Now the lifecycle demo becomes real. The clock stays as the spine because it is the strongest telling of the story — but every beat is now annotated with what the machine is actually doing, which is the merge of the demo with the build spec.

**Read the two rightmost columns as the contract.** They are what stops the day from being a demo script.

| Time | What the user sees | Lane | Beat | Level | Policy gate |
|---|---|---|---|---|---|
| **07:15** | *"3 things need attention: ₹2.1L collections, ₹38K stock gap, 2 delivery exceptions"* | Operator · WhatsApp | ③ Reach | L1 | — |
| **07:30** | Control Tower — same three, richer, with evidence | Operator · Web | ④ Understand | L1 | — |
| **08:05** | *"Need 10 atta, 6 oil and 4 tea"* → ₹4,860 order | **Buyer** · WhatsApp | ①→⑤ | L3 | order confirm by customer |
| **09:10** | Demand vs stock reconciled; ₹38K gap found | *(background)* | ② Detect | L1 | — |
| **10:00** | Route prepared — 9 stops, ₹3.1L load, **reviewed not built** | Operator · Web | ⑤ Decide | L2 | `start_route` needs confirm |
| **10:00** | *"Fresh Mart hasn't confirmed. Shall I message them?"* → sent | Operator · Web → WhatsApp out | ⑥ Execute | L3 | `send_customer_message` = confirm |
| **10:15** | Route on the phone, nudge at the stop | **Field** · Mobile | ④ | — | scoped: no books |
| **11:00** | Counts 38 against a system 42 | **Field** · Mobile | ① Signal | L3 | `record_stock_audit` |
| **11:08** | 7-unit variance detected → tomorrow's load flagged | *(background)* | ② Detect | L1 | — |
| **14:20** | *"₹86K collected. ₹1.24L still out; top 2 are ₹72K"* | Operator · WhatsApp | ③ Reach | L1 | — |
| **15:00** | *"Can pay ₹30K. Need ₹18K more credit."* | **Buyer** · WhatsApp | ① Signal | L2 | credit = **privileged** |
| **15:00** | Same request, owner's view, with the ₹42K balance | Operator · Web | ⑤ Decide | L3 | owner approves |
| **16:10** | Purchase request prepared: 36 oil, 9 atta | Operator · Web | ⑤ Decide | L2 | >₹1L → human approval |
| **17:20** | Delivered ₹2.5L · returns ₹12.4K · collected ₹86K | Operator · Web | ⑥ Verify | L3 | — |
| **18:30** | *"You ran the business. Foodbridge kept the context."* | Operator · both | ⑦ Record | L1 | — |
| **07:05⁺¹** | Tomorrow's three — shaped by today's outcomes | Operator · WhatsApp | ③ → ① | L1 | — |

#### What this table proves that neither source proves alone

**Three people acted inside one day and never once left the same context.** The Buyer at 08:05 and 15:00, the Field user at 10:15 and 11:00, the Operator throughout — three lanes from the WhatsApp flow, collapsed into one continuous business day from the lifecycle demo. Nobody was asked to learn Foodbridge. Nobody had to be in the same app. The context was the only thing they shared, and it was enough.

That is the merge. Everything else in this document is scaffolding for that row of the table.

#### The escalation lane, available from every beat

Both source flows list "Speak to Support" as a menu option; the spec makes it a state transition from anywhere. The spec is right, and it applies to all five lanes:

```
ANY BEAT, ANY LANE
        │
        ▼  user asks · or agent detects it cannot safely proceed
HUMAN_REQUESTED
        │
        ▼  never "user needs help" — always the full packet:
SUPPORT CONTEXT     customer · issue · screen · entities · what they asked ·
        │           what the agent tried · tools used · failure · recommendation
        ▼
   L1 Support Pod  ─────────►  L2 Direct intervention
   agent unsure · complex      in-app · WhatsApp · call · meeting
   config · billing · at-risk
        │
        ▼
RESOLVED ──► context returns to the agent ──► RESUME at the beat it left
```

The resume is the part that gets dropped in implementation and matters most: the user comes back to the beat they were on, not to the top of the menu.

---

### Stage 4 — The business grows into it

Stage 3 was one person with an assistant. Stage 4 is when the loop stops being personal and starts being organisational — and it is where the WhatsApp flow's separate journeys finally justify themselves, because now they are all pointed at the same store.

```
                          OPERATOR
                       (store exists,
                     loop running daily)
                             │
             ┌───────────────┴───────────────┐
             ▼                               ▼
      invites staff                  customers get linked
             │                               │
             ▼                               ▼
      ┌─────────────┐                 ┌─────────────┐
      │    FIELD    │                 │    BUYER    │
      │ scoped      │                 │ store-      │
      │ mobile      │                 │ scoped      │
      └──────┬──────┘                 └──────┬──────┘
             │                               │
     route · stops · delivery        offers · track order ·
     audit · collection              complaint · reorder · support
             │                               │
             └───────────────┬───────────────┘
                             ▼
                   ONE BUSINESS CONTEXT
              every action any of them takes
              becomes a signal for the others
```

**Field activation.** The Operator adds a staff member; the invite goes out over WhatsApp; the staff member taps and lands in a scoped mobile session. No app store, no password, no training. Their permissions are a strict subset and the subset is the point — the route, not the receivables.

**Buyer activation.** A customer of the store messages the Foodbridge number and resolves as a Buyer *of that store*. Their IVR is the Private User IVR from the WhatsApp flow, but correctly parented: **offers from this store, this store's orders, a complaint about this store's delivery.** A Buyer with no store parent is a Visitor; the parenting is what makes the lane meaningful.

**The closing loop of the whole product.** A Buyer's order at 08:05 becomes the Operator's demand signal at 09:10, becomes the Field user's stop at 10:15, becomes the variance at 11:08, becomes tomorrow's purchase at 16:10, becomes the Buyer's in-stock delivery the following week. One loop, four hands, nobody co-ordinating it.

---

### Stage 5 — Compounding

The journey does not end at a steady state. Three things accumulate.

**Context deepens.** Snapshot over snapshot, the agent can say what changed *and why*: *"Receivables are down ₹1.8L since your last snapshot. The collection action on 8 customers accounts for most of it."* An assistant that can attribute an outcome to an action is categorically different from one that can only report a number.

**Autonomy earns up — per action type, on evidence.**

```
        L2 prepare ──► L3 confirm & execute ──► L4 bounded autonomous
             │                   │                       │
       default for      after the user has        only when ALL hold:
       everything new   confirmed this action     low-risk · permitted ·
                        type N times with no      unambiguous · reversible ·
                        correction                confident · nothing unusual

        ╔═══════════════════════════════════════════════════════════╗
        ║  THE FENCE — never autonomous, at any tenure, ever:       ║
        ║  delete data · change financial records without policy ·  ║
        ║  high-value purchases · refunds without authority ·       ║
        ║  change invoices · sensitive communications ·             ║
        ║  override business controls                               ║
        ╚═══════════════════════════════════════════════════════════╝
```

`schedule_reminder` can reach L4 in a fortnight. `create_purchase_request` above ₹1L never leaves human approval no matter how well it has behaved. Tenure buys speed on the safe things and buys nothing at all on the fence.

**Ranking sharpens.** Every accept, dismiss, dismissal reason and outcome feeds the score. A nudge the user has killed three times stops arriving. A nudge that reliably converts to a verified outcome rises. The 07:15 message in month six should be materially better than the one in week one, and the user should be able to feel that without being told.

#### When the user goes quiet

Neither source handles lapse, and every real product needs an answer.

Nudges **decay in frequency, never in quality.** Daily becomes every other day becomes weekly. What must not happen is the assistant getting louder as it gets less useful — that is how an always-on assistant becomes a muted notification.

Re-engagement uses the **last verified outcome** as the hook, because it is the only thing that is demonstrably true and demonstrably theirs:

> "It's been a while 👋 Last time we spoke you recovered ₹86K from two accounts. There's ₹1.4L sitting out now — want me to pull the list?"

Not *"we miss you."* Not *"here's what's new."* The specific money they made, and the specific money on the table.

---

## Part 4 — Overlap resolution register

Every place the sources duplicated or contradicted each other, and the call made.

| # | Overlap | Source A | Source B | Resolution |
|---|---|---|---|---|
| 1 | Morning nudge vs *Foodbridge Recommends* | WhatsApp flow: pull, menu option 1 | Demo: push, 07:15 | **One surface, two triggers.** Same content, same deep-links, recomputed on open |
| 2 | Module demos vs the 13-screen demo day | WhatsApp flow: Explore Delivery / Collection / Inventory | Demo: narrated 07:15→next morning | **One demo day, four entry points.** Module demos enter at the matching hour and converge on the same ending |
| 3 | Business-type tiles vs snapshot | WhatsApp flow: pick Wholesaler/Retailer/… | Spec: snapshot built from data | **Declared type is Snapshot 00** — a cold-start prior, overwritten by observed reality at Gate 3 |
| 4 | Private User vs the demo's customer | WhatsApp flow: own journey, own IVR | Demo: Shree Stores ordering and asking for credit | **Same person.** Not a parallel journey — the counterparty role inside the Operator's day, parented to a store |
| 5 | Three human-support entries | WhatsApp flow: IVR option · Demo: a screen | Spec: `ANY STATE → HUMAN_REQUESTED` | **Spec wins.** One escalation lane from any beat in any lane, with the full context packet and a resume |
| 6 | OTP vs auto-login links | WhatsApp flow: OTP for new users | WhatsApp flow: auto-login for existing | **One ladder.** The number is the identity; OTP binds it to a web session once; every later link is a signed auto-login to the right page |
| 7 | Conversion moment | WhatsApp flow: *[Become a Foodbridge Business]* | Demo: Miha already onboarded | **Three gates, not a button.** Store → signal source → first real snapshot. Gate 2 is the activation threshold |
| 8 | Welcome menu for known numbers | WhatsApp flow: *"1 I have an account / 2 I'm new"* | Demo: assistant already knows everything | **Only unknown numbers see it.** A recognised number gets its lane's menu immediately |
| 9 | Field staff | *(absent)* | Demo: mobile route + stock audit at 10:15 | **A fifth identity**, entered only by Operator invite, scoped to route/audit/collection |
| 10 | Route close + settlement | Demo step 11 | WhatsApp flow demo module ending | Same workflow, described twice. **One implementation** |
| 11 | End-of-demo menu | Docs: three buttons | v7 build: two, and it ends in the chat | **v7 is current.** Feedback + become a user; the chat is where the demo ends |
| 12 | One number, one role | Both flows assume it | Reality: owner of one business, customer of another | **Ask once, remember, offer a switch.** Never re-ask |

---

## Part 5 — What is still open

Honest list. These are product calls, not gaps in the documents.

| # | Question | Why it matters | Leaning |
|---|---|---|---|
| 1 | Rename *Private User* → *Customer*? | Two names for one person in one product | **Yes** — touches IVR copy and probably schema, so decide before the copy is written |
| 2 | Is a connected signal source mandatory before L2? | It is the difference between an assistant and a chatbot | **Yes, mandatory** — asserted as policy in Stage 2, needs sign-off |
| 3 | How is demo data marked so nobody mistakes it for real? | An Operator acting on demo numbers is a trust-ending event | v7 already banners the demo store; formalise it as a context flag that also blocks outbound sends |
| 4 | Role-switching mechanics for multi-role numbers | Rare but real, and confusing when it breaks | Menu footer switch; remember the last choice |
| 5 | What is N for autonomy promotion? | Governs how fast L2 → L3 → L4 | Per action type, not global; start conservative and instrument it |
| 6 | Sidebar links `customers.html` / `integrations.html` don't exist | Dead links in the shipped prototype | Build them or cut them before the next demo |

---

## Part 6 — The journey on one page

```
  UNKNOWN NUMBER
        │  "Hi"
        ▼
  IDENTITY RESOLUTION ─────────────────────────────────┐
        │                                              │ known → straight
        ▼ unknown                                      │ to your lane
  OTP → EXPLORER                                       │
        │                                              │
        ▼  the loop, on demo data                      │
  THE DEMO DAY ── enter at any hour ── one ending      │
        │  "here's what Foodbridge saved you today"    │
        ▼                                              │
  CONVERSION ── store ── signal source ── Snapshot 01  │
        │  L0/L1 only until the first real snapshot    │
        ▼                                              │
  OPERATOR ◄───────────────────────────────────────────┘
        │
        ▼  the loop, on real data, every day
  ┌──────────────────────────────────────────────────┐
  │  SIGNAL → DETECT → REACH → UNDERSTAND →          │
  │  DECIDE → EXECUTE & VERIFY → RECORD & LEARN      │
  │      ▲                                    │      │
  │      └────────────────────────────────────┘      │
  └──────────────────────────────────────────────────┘
        │
        ├──► invites FIELD ────┐
        ├──► links BUYERS ─────┼──► one context, three hands
        │                      │
        ▼                      ▼
  COMPOUNDING ◄────────────────┘
  context deepens · autonomy earns up per action ·
  ranking sharpens · the fence never moves
        │
        ▼
  "Receivables are down ₹1.8L since your last snapshot.
   The collection action accounts for most of it."
```

**The test of the whole journey, in one sentence:** a person who has never heard of Foodbridge can text a number, watch a realistic business day run itself, connect their own books, and inside a week receive a message at 07:15 that tells them something true about their business that they did not already know — and act on it without leaving the conversation.

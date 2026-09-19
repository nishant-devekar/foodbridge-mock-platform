# v7 — the unified flow, and what has to change

A product review of v7 against the agreed flow, from a walk-through as a user, and the plan that follows.
Supersedes the earlier implementation plan, which was written against a five-lane model that no longer exists.

**The flow, settled:**

```
"Hi" ──┬── I'm new here      ──▶ "Shall I set up your business on this number?"
       │                              ├── Yes      → set up → your business
       │                              └── Not now  → pick a feature → land in it
       │                                             (set up stays one tap away)
       └── I have an account ──▶ owner → what needs you today
                                  buyer → orders, offers, your shop
```

---

## 1 — What the walk-through found

Run on the live cut at 375×812, as a new user with `?obreset`.

| # | Finding | Severity |
|---|---|---|
| **F1** | **Explore lands in setup.** `Continue as guest` goes to *"Where is your business data today?"* — the exact question the user just declined | **Breaks the flow** |
| **F2** | **Explore costs ~7 taps before any feature.** guest → sample → import → data found → continue → data check → continue → ready → … → dashboard. All ceremony, no product | **Breaks the flow** |
| **F3** | **No way out of most of the platform.** `EXIT DEMO` is on 5 of 26 destinations. Onboarding has none. The dashboard has none — a user who finishes onboarding is stranded with no route back to WhatsApp | High |
| **F4** | **Identity discontinuity.** Onboarding collects a name and business; the shell hardcodes *"Mahesh · QA store"*. You type your own name, then land in someone else's store | High — credibility |
| **F5** | **The phone number is typed, not confirmed.** We arrive from WhatsApp, where the number is already verified, and then ask the user to type it | Medium |
| **F6** | **The control tower is promised and missing.** `drawCreated()`'s CTA reads *"Open your control tower"*; the code comment concedes it hands off to the dashboard until one exists | Medium |
| **F7** | **Explore and set-up are the same flow.** Both start at S02. The only difference is whether an account object exists | Structural |

F1, F2 and F7 are the same root cause: **v7 has no concept of exploring. It has onboarding, with an account or without one.** The new flow needs a second, genuinely different path — and that is the one new screen that matters.

---

## 2 — The decisions this plan makes

| # | Decision | Reasoning |
|---|---|---|
| 1 | **Explore gets its own screen** — a feature chooser, not the import flow | The whole point of *Not now* is to skip setup. Sending them to S02 is the opposite |
| 2 | **The offer question lives in v7, not WhatsApp** | The IVR is a two-state machine; a second menu needs backend code. v7 can ask it on arrival for free |
| 3 | **Onboarding keeps its nine screens** | They are the product owner's board, and *Data found* / *Data check* are the trust screens — they prove we understood the business. Not the place to save taps |
| 4 | **The shell shows the signed-up user, not `Mahesh`** | A demo where you type your name and land in someone else's store loses the room |
| 5 | **Exit is on every destination, and is one path** | Feedback, then the chat. The *Become a part of FoodBridge* row comes out — signing up is a door at the front, not an exit |
| 6 | **`Continue as guest` stays on S01, but re-points to the feature chooser** | It is the only way in for someone arriving on the web directly. It should not be a third route into setup |
| 7 | **No new backend work** | Everything below is v7 plus IVR config |

---

## 3 — What gets built, changed and removed

### New

| File | What it is |
|---|---|
| `screens/explore.html` + `.js` | **The feature chooser.** Six features, each a card saying what you will see; tapping one opens the real screen. Carries *Set up my business* at footer weight throughout |
| `screens/control-tower.html` + `.js` | **The owner's home.** The ranked answer to *what needs you today*, cadence first. The destination `drawCreated()` already names |
| `assets/context.js` | One read model over the tenant — customers, products, orders, cadence, reorder. A single `orderingStatusFor()`, closing D-016 |
| `assets/nudges.js` | Deterministic detection and ranking over context. No model in the loop |
| `assets/ivr-flow.json` | The IVR config, v7's copy, for the simulator and for pasting |
| `ivr.html` | The WhatsApp simulator — same config, same rules, so the whole flow is demoable on one laptop |

### Changed

| File | Change |
|---|---|
| `onboarding.js` — new `offer` screen | The first screen for `?start=new`: *"Shall I set up your business on this number?"* → **Yes, set up** / **Not now — show me around** |
| `onboarding.js` — `startGuest()` | Routes to `explore`, not `source` (**fixes F1, F2, F7**) |
| `onboarding.js` — `drawSignup()` | Name and phone only above the fold; business and GST move behind *Add business details*. Copy acknowledges the number came from WhatsApp (**F5**) |
| `onboarding.js` — `drawCreated()` | *Open your control tower* goes to the control tower, not the dashboard (**F6**) |
| `onboarding.html` | Mounts `FB_EXIT` — onboarding currently has no way out at all (**F3**) |
| `platform.js` | Sidebar identity reads the account; falls back to the seed only when there is none (**F4**). Mounts `FB_EXIT` on every destination (**F3**) |
| `modules.json` | Registers `control-tower` and `explore` as standalone, `fullBleed: true`, `clipLeft: 0` — the pattern onboarding already proves, so no new clip offset is measured |
| `assets/exit-demo.js` | One path: rate, or skip, then the chat. The *Become a part of FoodBridge* row is removed |

### Removed

- The *Become a part of FoodBridge* row from the exit sheet, and the `?signup=1` round trip it depended on.
- Nothing else. No screens are deleted — the board's nine stay.

---

## 4 — The WhatsApp IVR configuration

**Superseded 20 September 2026.** This section described a flat, three-button
menu with the questions asked in v7. The agreed flow asks them in the chat, and
cafex-backend `ec20bd3c` (nested menus, config-driven) makes that possible
without backend code.

The config to paste is **`v7/assets/ivr-flow.json`** — the source of truth, with
the tree, the limits and the reasoning in its `_comment`. Paste it into the
**demo tenant's `orgConfig.whatsappIvrFlow`**, never `globalConfig`. The full
account of the change is in `v7/VERSION.md`, 20 September 2026.

## 5 — The user's path, after this plan

Counted in taps, which is the only unit that matters.

### New, and wants it

```
WhatsApp  "I'm new here"                      1 tap
v7        "Yes, set it up"                    1 tap   ← consent, recorded
          name + phone, Create account        1 screen
          where's your data → connect         2 taps
          importing…                          (waits)
          Data found → Continue               1 tap   ← the trust screen
          Data check → Continue               1 tap   ← the honesty screen
          Ready → Create order                2 taps
          Order created → control tower       1 tap
```

**Nine interactions from a WhatsApp message to a live business with one real order.** Nothing re-typed except a name and a number.

### New, and browsing

```
WhatsApp  "I'm new here"                      1 tap
v7        "Not now — show me around"          1 tap
          pick a feature                      1 tap
          → inside a real screen, real data
```

**Three taps to the product**, against roughly seven of setup ceremony today. Every screen carries *Set up my business*, and each feature ends on *here's what that would have saved you*.

### Returning

```
WhatsApp  "I have an account"                 1 tap
v7        control tower, or your shop         —
```

**One tap.** No code, no question, no menu.

---

## 6 — Build order

Dependency-ordered; each step is worth having on its own.

```
 1  context.js        pure logic, no UI
 2  nudges.js         needs 1
 3  explore screen    the missing path — fixes F1, F2, F7
 4  offer screen      the consent question, in onboarding
 5  startGuest()      re-point to explore
 6  control tower     needs 1, 2 — fixes F6
 7  exit everywhere   single path, all destinations — fixes F3
 8  shell identity    read the account — fixes F4
 9  signup trim       name + phone above the fold — fixes F5
10  ivr-flow.json + ivr.html
11  VERSION.md        the record, including what is still simulated
```

Steps 3 and 5 together are the smallest change that makes the agreed flow true. If only one thing ships, ship those.

---

## 7 — Done when

- From `ivr.html`, all three rows work and land where this document says.
- *Not now* reaches a real feature screen in **three taps**, and never shows the import flow.
- *Yes* reaches a created order in nine interactions, and the control tower ranks real signals from the tenant's own 532 orders, cadence first.
- Every destination has `EXIT DEMO`; it offers one path; it ends in the chat.
- The sidebar shows the name the user signed up with.
- `VERSION.md` carries the entry, saying plainly that the IVR is simulated locally and that the demo's numbers come from one real distributor's export.

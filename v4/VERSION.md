# FoodBridge mock platform — Version 4 (Stock Audit only)

**Cut 25 August 2026.** Not a successor to `v3` — a narrower thing standing beside it. `v3`
is the whole platform, 26 destinations across 12 module repos. `v4` is one screen:
Customer Management → **Stock Audit & Health**, and the shell around it, with no sidebar.

51 files, 1.7 MB, 1 module repo, 1 destination.

## What is different from v3

**No sidebar.** The full shell renders two — a desktop `aside` and a mobile drawer with its
backdrop, both filled by `renderSidebarContent`. With one destination a sidebar is a list of
one item, and a drawer that opens onto the screen you are already looking at. Both are gone
from `renderShell`, along with the burger in the mobile header and the `data-sidebar-toggle`
on the burger mask, because neither has anything left to toggle.

The mask itself stays and still masks: the module draws its own hamburger in its header, that
hamburger toggles the module's own sidebar, and `clipLeft` has removed that sidebar. It is
inert now rather than a control — `aria-hidden`, out of the tab order.

`renderSidebarContent` and the toggle wiring are left in `platform.js` untouched. Nothing
calls them. Deleting them would make this file diverge from the platform's for no gain the
next time the two are compared.

**One destination.** `assets/modules.json` carries a single group with a single submenu.
`standalone` and `hidden` are emptied. The grouping now names the screen rather than
navigating between screens.

**The tenant's real catalogue.** The Stock Audit screen here is the module repo's `v3` as
cut on the `only-customer-stock-audit` branch: 86 SKUs imported from the tenant's own
`products.csv` — pickles and murabba, spices, fresh vegetables, grocery, grain — with local
SVG tiles for product art instead of hotlinked photos. `v3/` of this platform still carries
the twelve invented products; the two are deliberately different.

## What is the same

Everything else, and on purpose. Same shell, same routing, same clip offsets, same
`100dvh` app column, same vendored fonts and Tailwind. `clipLeft: 256` still applies —
the module draws its own sidebar and this shell clips it away exactly as the full platform
does, which is why removing the *platform's* sidebar does not make the module's appear.

## Refined 26 August 2026

The tenant rebrand (`QA store`/`Mahesh` → `Miha's`/`Anupam`) and the 40-account real
customer roster swap landed first; this pass is the same Quick Audit UX refinement made to
`v3`'s copy of the screen, carried over here so the two don't drift. Audit Detail now shows
just date/time and the products checked — no Coverage box, no thumbnails, no purpose/status
chrome; Audit History's cards match: customer, date/time, a plain count. Customer and
product search share one dropdown for every state the search box is in use — capped,
first-5-A-Z preview on focus, live unbounded matches once typing starts, both scrollable in
their own box rather than the page. Ending a visit (← exit sheet, or Finish Audit with
nothing counted, now routed to the same sheet) discards it outright — no "abandoned" record,
no toast implying one was kept — and a sheet closed by its own button no longer risks
popping the rep an extra screen out, a `history.back()` timing race the exit flow's testing
surfaced. `matches`' catalogue-aware search (name/SKU/category/sub-category) and the
qc-row's SKU tooltip, both specific to this module's real 86-SKU catalogue, are unchanged.

## Offline

Fully self-contained. Every asset the screen needs is packaged, including the product tiles,
so nothing here reaches the network for content. That is a difference from `v3`, whose
product art was hotlinked from Wikimedia Commons at view time.

## Running it

Served over HTTP, from this folder:

```
python3 -m http.server 8000
```

then <http://localhost:8000/>. On GitHub Pages it works as-is.

## Where the screen came from

| Route | Screen | Source |
| --- | --- | --- |
| `#/customer-management/stock-audit-health` | Stock Audit & Health | `modules/foodbridge-customer-mockup/v3/screens/customers/stock-audit.html` |

Crawled from `Nidhimehta9399/foodbridge-customer-mockup`'s `v3`, on the
`only-customer-stock-audit` branch.

## Verified

Driven on a real Android emulator (Pixel 8, Chrome 124) and a real iOS Simulator
(iPhone 16 Pro, Safari 605.1.15) — real touch input, no device emulation. Checked that the
sidebar is absent in both orientations and at desktop width, that no burger remains to open
one, that the module still fills the frame with its own sidebar clipped, and that the whole
flow runs: search customer → select products → count → finish → saved.

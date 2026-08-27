# Architecture, releases, and the workspace

How this repo is put together, how a version gets frozen and shipped, and where the
multi-repo working directory sits around it.

> **On "roleplay workspace":** there is no directory or code path by that name. Read here as
> the **`FoodBridge Workspace/` parent directory** — the side-by-side checkouts of every
> repository the platform pretends is owned by someone else, which is what lets one person
> run and edit a "ten modules, six owners" product locally. The role-play convention those
> repos carry (`discovery/instructions/` addenda, prototypes role-played against seed data)
> is covered in [§3](#3-the-workspace). If you meant something else by the term, say so and
> this section can be rewritten.

---

## 0. The repo at a glance

```
foodbridge-mock-platform/
  index.html            the live shell
  assets/               modules.json (the config), platform.js, platform.css, vendored deps
  tools/                dev.py · pack.py · pack-source.py · mobile-test.sh
  v1/ v2/ v3/           frozen, self-contained snapshots — never edited after cutting
  v4/                   an isolated narrow cut, NOT the successor to v3
  zoho-function/        a serverless bridge to Zoho Books — outside the freeze entirely
  docs/                 planning documents (this file; the Stock Audit vNext audit + plan)
```

Three things live in this repo that are usually three different projects: a **shell**, a
**packaging pipeline**, and — since v4 — a **real backend integration**. They have different
lifecycles and deliberately do not share machinery.

---

## 1. Architecture — the shell

### 1.1 What it actually is

A **nav shell**, not an application. It owns the sidebar, the routing and the active state.
Every destination is a *live* `<iframe>` pointed at the URL its owning team publishes on their
own GitHub Pages site. Nothing is vendored at `/`; when a team pushes, the next load reflects
it — including a module going down, which is the point.

Ten modules, six owners, 12 repositories, **26 destinations** today.

### 1.2 Config is the source of truth

[`assets/modules.json`](../assets/modules.json) is the whole tree: nav groups, leaves, URLs,
per-destination clip offsets, owners, personas. Adding a module means adding an entry there
and nothing else. Its top-level keys:

| Key | What it carries |
| --- | --- |
| `brand`, `user` | tenant identity shown in the chrome (`QA store`/`Mahesh`; `Miha's`/`Anupam` in v4) |
| `nav` | 10 groups → submenu leaves; sidebar order is array order |
| `standalone` | routable by `#/<id>` but **not** in the sidebar (the storefront, reached by QR) |
| `hidden` | 4 entries kept out of both |
| `personas` / `personaDefault` | manufacturer vs distributor |
| `storeQr` | the sidebar-footer QR deep link |

The file leads with a long `_comment` array explaining every optional leaf field. That comment
is the spec — read it before adding a destination.

### 1.3 Routing

Hash-based (`#/sales-orders`, `#/inventory/raw-material-inventory`), built in
[`buildRoutes`](../assets/platform.js) into a flat `"group/leaf" → destination` map plus an
ordered key list. Consequences worth knowing:

- Every screen is a real, shareable URL, and browser back/forward work.
- **Personas gate through one function.** `forPersona` is read by *both* `buildRoutes` and the
  sidebar renderer, on purpose: if they filtered separately, a hidden route would still be
  reachable by hash — the nav would claim a distributor has no Production while
  `#/production/batch-management` quietly still opened.
- A leaf may declare `urlMobile`; the shell swaps between it and `url` live at the `lg`
  breakpoint, so URL and chrome change together.

### 1.4 The seam — the one genuinely tricky part

Each module renders its **own** copy of the QA sidebar, so naive embedding shows two. The shell
makes the iframe `clipLeft` px wider than the visible area and offsets it left by the same
amount inside `overflow: hidden`.

| Leaf field | Purpose |
| --- | --- |
| `clipLeft` | px of the module's own sidebar to push out of view on desktop. Four values in use: 0, 212, 250, 256 |
| `clipLeftMobile` | usually 0 — only the few non-responsive modules that keep a sidebar at phone width need it |
| `mHeaderH` | height of the module's own header on mobile; the shell's 56px bar is aligned to it via `56 - mHeaderH` |
| `hideBurger` / `burgerBox` / `burgerBg` | mask over the module's now-inert hamburger (desktop only — on mobile the shell's header already covers it) |
| `fullBleed` | the module is its own experience (the storefront): sidebar hidden, all clipping skipped |

Two rules this carries:

1. **`clipTop` is 0 everywhere, deliberately.** The module's header is *kept* and serves as the
   app header, so there is exactly one. Clipping vertically looks right at rest and breaks on
   scroll, because a module's sticky toolbar sticks to the *iframe's* top edge.
2. **Every offset is measured, never inferred.** Two screens in the same repo can differ. See
   [`tools/measuring-clip-offsets.md`](../tools/measuring-clip-offsets.md).

**The known cost:** clipping shifts the module's viewport origin, so a dialog the module centres
on its own viewport lands `clipLeft / 2` px left of the visible centre. The real fix is
`?embed=1` support in each module repo, which is not done.

### 1.5 What the shell can and cannot see

A cross-origin frame gives `load` but nothing inspectable, so **a stall is the only detectable
failure** — hence the 15s timeout and error panel in `loadModule`. Locally everything is
same-origin and the shell *could* reach into iframes; nothing may depend on that, because in
production it cannot.

### 1.6 Dependencies

Tailwind (play CDN 3.4.16) and a QR encoder are vendored into `assets/` — no build step, no
network at view time. The Tailwind config **replaces** the default `screens` scale to mirror
`storefront-frontend`, or the breakpoints diverge from the modules being embedded. Neither Pages
nor `python3 -m http.server` sends useful cache headers, so `platform.js` / `platform.css` carry
a `?v=` token that also cache-busts `modules.json`.

---

## 2. Releases and version freezing

### 2.1 The two clocks

| | Live (`/`) | Frozen (`v<N>/`) |
| --- | --- | --- |
| Where screens come from | each team's Pages site, at view time | local copies under `v<N>/modules/<repo>/` |
| Changes when a team pushes | yes, next load | no — ever |
| Purpose | follow the teams, surface breakage | a thing you can point at and it stays that thing |

Once cut, a version folder is not edited again. `v1` stays exactly what it was after `v2`
exists. (`v4` is the standing exception — see §2.6.)

### 2.2 `tools/pack.py` — the runtime half

`python3 tools/pack.py --version <N>` (`--dry` reports without writing) does:

1. **Crawl** every `url` / `urlMobile` in `assets/modules.json`, following `src`/`href`,
   CSS `url()`, and bare asset-looking strings.
2. **Preserve each module's own directory layout** under `modules/<repo>/…`, so relative links
   (`../seed-data/seed.json`) survive untouched. Only absolute and CDN URLs get rewritten.
3. **Vendor** fonts/Tailwind/unpkg into `vendor/`.
4. **Relocate** every destination in the copied `modules.json` to its local path and stamp a
   `_frozen` note into the file.
5. **Write docs** — `VERSION.md`, `README.md`, `serve.sh`, favicon — with the real file count,
   size, destination table and repo list from *this* crawl.

Output lands in `./pkg`; move it to `v<N>/` once verified.

Two subtleties encoded in the crawler, both learned the hard way:

- A classic `<script src>` file's own relative `fetch()` resolves against the **page**, not the
  script — so only `.js` inherits the caller's `page_base`. CSS is the opposite and re-bases on
  itself.
- `assets/modules.local.json` is excluded via the repo's own `.gitignore`, because
  `shutil.copytree` has no concept of gitignore and would otherwise leak whichever dev machine
  cut the version.

### 2.3 What a frozen snapshot honestly is *not*

The crawl captures **what a browser loads** — roughly 14% of the source. Invisible to it, and
therefore absent: `discovery/instructions/`, `development/` npm trees, screens reached only by
JS, canonical seed JSON, superseded version folders, and all git history.

`VERSION.md` records the rest of the truth rather than hiding it:

- **references that still reach the network** (OpenStreetMap tiles in v1; seven in v2) — the
  package is honest about not being fully offline.
- **inherited defects** — links already 404 on the live site are reproduced as found, not
  silently patched, including some that are the crawler misreading a JS string literal. Left in
  rather than hand-filtered, because guessing would be less honest than showing the crawl.

### 2.4 `tools/pack-source.py` — the other half

Every release carries **two** assets, because "look at it" and "work on it" need different
things:

| Asset | Built by | For |
| --- | --- | --- |
| `foodbridge-mock-platform-v<N>.zip` | `pack.py` | seeing it run — self-contained, open in a browser |
| `foodbridge-v<N>-source.zip` | `pack-source.py` | handing to a developer |

The source half clones all 12 repos into `repos/`, **keeping `.git` and the GitHub `origin`**,
plus `run.sh`, `update.sh` and a `MANIFEST.md` recording each repo's exact commit SHA. An
earlier build shipped stripped trees with separate git bundles; a clone already is both halves.

Git tags `v1` / `v2` / `v3` mark the freeze commits.

### 2.5 Anatomy of a frozen folder

```
v3/
  index.html  assets/  vendor/  favicon.ico
  modules/<repo>/…      local copies, original layout
  tools/                copied along
  serve.sh              python3 -m http.server, because file:// breaks fetch()
  README.md  VERSION.md generated by pack.py — provenance, limits, defects
```

`VERSION.md` is the important one: it says what is frozen, what still touches the network, what
was already broken upstream, where each screen came from, and what that cut has *not* been
verified against.

### 2.6 `v4` — an isolated cut, not a successor

`v4` stands **beside** `v3`, which remains the current full platform.

| | `v3` | `v4` |
| --- | --- | --- |
| Destinations | 26 across 12 repos | 1 (Customer Management → Stock Audit & Health) |
| Sidebar | yes | **removed** — a list of one item, and a drawer onto the screen you are on |
| Catalogue | 12 invented products | 86 real SKUs from the tenant's `products.csv`, local SVG art |
| Extra journey | — | Predictive Sales Order → **real** Zoho Books sales orders |
| Files | 206 | 55 |

Notes that matter when working in it:

- `renderSidebarContent` and the toggle wiring are **left in `v4/assets/platform.js` untouched
  and uncalled**, so the file does not gratuitously diverge from the platform's the next time
  the two are compared.
- `clipLeft: 256` still applies — the *module's* sidebar is still clipped, which is why removing
  the *platform's* sidebar does not make the module's appear.
- The two cuts are deliberately different, and refinements have been carried across **by hand**
  to stop them drifting. Nothing propagates automatically in either direction.

### 2.7 Re-cutting hazards

- **`v3` carries one hand-patched exception**: the "🧾 Stock Audit" entry point in Delivery
  Management's `stop-detail.js` is cross-module deep-link glue specific to this snapshot.
  Re-running `tools/pack.py --version 3` **silently drops it** — restore from git or hold it back.
- Work has repeatedly been authored *here* while a module repo lagged, then ported upstream and
  crawled back. When that happens, `VERSION.md` records the provenance explicitly; keep doing it.
- Mobile claims are held to a real bar: `tools/mobile-test.sh` boots an actual Pixel 8 (Chrome)
  and iPhone 16 Pro (Safari) against the local server. Desktop device emulation has already
  produced a version whose "mobile QA pass" had to be redone.

### 2.8 `zoho-function/` is outside all of this

A dependency-free serverless bridge on Vercel holding the OAuth credentials, because GitHub
Pages cannot hold a secret. It is **not** crawled, frozen, or versioned with the `v<N>` folders,
and it has its own lifecycle (`./deploy.sh`, `npm test`, `.env` never committed). Design points
worth carrying: duplicate protection is enforced by asking Zoho (the FoodBridge order id travels
as `reference_number`) rather than by remembering; a timeout is held PENDING and verified by
reference rather than re-posted; the order is read back and compared after writing. Full detail
in [`zoho-function/README.md`](../zoho-function/README.md) and
[`v4/VERSION.md`](../v4/VERSION.md).

---

## 3. The workspace

### 3.1 Placement

The repo is **not** self-sufficient for development. It expects to sit as one sibling among the
checkouts it federates:

```
FoodBridge Workspace/            ← the workspace root (--root defaults to the parent)
  foodbridge-mock-platform/      ← this repo
  foodbridge-customer-mockup/
  foodbridge-module-inventory-management/
  foodbridge-module-sales-orders/
  foodbridge-module-staff-management/
  storefront-frontend/           ← the real app the sidebar was ported from, class-for-class
```

That layout is not a convention someone happened to adopt — it is exactly what the source
release reproduces under `repos/`, and what `tools/dev.py` resolves against by default.

**A missing checkout is not fatal.** Only some of the 12 repos are cloned here today; `dev.py`
wires what it finds and lists what it could not, so one module can be worked on without cloning
everything.

### 3.2 Why a plain static server is not enough

Published, the shell iframes each team's **live** Pages site. Serving this folder locally would
still load every module from the internet, and nothing edited locally would appear — silently,
with nothing looking broken. That wiring is the part that needs doing:

```bash
python3 tools/dev.py
```

1. Reads `assets/modules.json` and rewrites every destination to point at the checkouts.
2. Writes `assets/modules.local.json` — **gitignored, never committed**; `modules.json` stays
   canonical. The shell picks it up through `?config=<path>`, the only hook `dev.py` needs and
   one the published build ignores.
3. Serves every checkout from one root with `Cache-Control: no-store`.

`--root ../..` moves the search; `--port` moves the port.

### 3.3 When a checkout is named differently from the repo

`dev.py` finds a module by the **repository name in its published URL**. That breaks when a
module's content moves to a differently named repo while the published URL, owned by someone
else, still points at the old one. [`tools/local-checkouts.json`](../tools/local-checkouts.json)
records those cases and only those — bare directory names, never absolute paths, so it stays
portable. It also carries an `_evidence` block saying how each mapping was *verified* rather
than inferred.

`dev.py` refuses to start rather than serve the wrong checkout under a module's name: invalid
JSON, a path-like target, two repos claiming one directory, or a duplicate destination `id` in
`modules.json` all stop it with the reason.

### 3.4 The role-play convention the checkouts carry

Each module repo keeps `discovery/instructions/` — one addendum per iteration
(`addendum-NNN-slug.md`, numbers never reused) recording what was asked, what was decided, and
what was **rejected**. The loop those working rules define:

> a new ask arrives → written into a new addendum → the prototype iteration is built and
> **role-played against seed data**, analysis tabled → the addendum records the outcome; if
> accepted, the iteration is snapshotted as a version.

`design-principles.md` is described in those repos as the bridge between "what we role-played"
and the SSOTs that govern development. Two repos (`invoice-payment-overview`,
`foodbridge-module-procurement`) have moved past discovery and carry `development/` npm
workspaces.

Branches follow the same idea — `discovery/inventory-intelligence`,
`only-customer-stock-audit` — each a cut of the world rather than a feature branch heading for
a merge into `main`.

**Read the addenda before changing a screen.** They carry the reasoning the code does not, and
they are the main thing the source package has that the runtime build lacks.

### 3.5 Gotchas

| | |
| --- | --- |
| Must be HTTP, not `file://` | several screens `fetch()` their seed JSON; double-clicking `index.html` gives a half-empty app |
| Two repos publish Pages from `discovery/` | their URL paths do not match their disk paths; `dev.py` resolves against real files and reports what it cannot find |
| Same-origin locally, cross-origin in production | never write anything that depends on reaching into an iframe |
| `seed.json` **and** `seed.inline.js` | several modules ship both; **edit both** or they disagree, and which you see depends on how the page was opened |
| `?v=` cache tags | bump them when editing a module's JS/CSS/seed inside a `v<N>/` folder — no server here sends cache headers |

---

## 4. Invariants

1. `assets/modules.json` is canonical. `modules.local.json` is machine-specific and never committed.
2. Clip offsets are measured in a browser, one destination at a time. Never inferred from a sibling.
3. A frozen `v<N>/` is never edited after cutting. Divergence is documented in its `VERSION.md`.
4. `v4` is not downstream of `v3`. Nothing propagates between cuts automatically.
5. Inherited breakage is reproduced and recorded, not silently patched.
6. Secrets live in `zoho-function/.env` and Vercel's environment — never in the repo, never in a
   deployment bundle, never on Pages.

# Running this locally for development

There are two different things you might mean by "run it", and they need different setups.

| | What it is | Setup |
| --- | ---------- | ----- |
| **The mockups** | 10 of the 12 repos. Static HTML/CSS/JS driven by seed JSON. No build step, no npm. | `tools/dev.py` — below |
| **The `development/` trees** | Where two modules have progressed past discovery: TypeScript services, an OpenAPI spec, tests. | npm workspaces — [below](#the-development-trees) |

## The mockups

### The problem this solves

Published, the shell iframes each team's **live GitHub Pages site**. So cloning the repos and
serving the shell is not enough on its own: it would still load every module from the internet,
and nothing you edited locally would appear. The wiring is the part that needs doing.

### Setup

Put the checkouts side by side — which is exactly how the v1 source package is already laid out:

```
<root>/
  foodbridge-mock-platform/
  foodbridge-dashboard-mockup/
  invoice-payment-overview/
  …
```

Then, from `foodbridge-mock-platform`:

```
python3 tools/dev.py
```

It prints a URL. Open it. That's the whole setup — Python 3 and a browser, nothing to install.

What it does:

1. Reads `assets/modules.json` and rewrites every destination to point at your checkouts.
2. Writes the result to `assets/modules.local.json` — **gitignored; never commit it.**
   `assets/modules.json` stays canonical.
3. Serves all the checkouts from one root with `Cache-Control: no-store`, so a refresh always
   picks up what you just saved.

Edit any file in any checkout and refresh. No rebuild, no cache, no restart.

```
python3 tools/dev.py --root ../..     # if the checkouts are somewhere else
python3 tools/dev.py --port 8080
```

### When the checkout is named differently from the repo

`dev.py` finds a module by the **repository name in its published URL** — for
`https://user.github.io/some-repo/screens/x.html` it looks for `<root>/some-repo/`. That works
until a module's content moves to a differently named repository while the published URL, owned by
someone else, still points at the old one.

`tools/local-checkouts.json` records those cases, and only those:

```json
{ "map": { "foodbridge-inventory-mockup": "foodbridge-module-inventory-management" } }
```

Directory names only — never absolute paths. `--root` supplies the location, so the file stays
portable across machines. A repository **not** listed resolves to a directory of its own name,
exactly as before, so this file changes nothing for a module that already works.

`dev.py` refuses to start on a bad map rather than silently serving the wrong checkout under a
module's name: invalid JSON, an empty or path-like target, or two repositories claiming the same
directory all stop it with the reason. A duplicate destination `id` in `assets/modules.json` stops
it too — the shell would route both to one hash and the loser would simply never open.

### Things that will otherwise catch you out

| | |
| --- | --- |
| **It must be HTTP, not `file://`** | Several screens `fetch()` their seed JSON, which browsers block on `file://`. Opening `index.html` by double-clicking gives you a half-empty app. |
| **Two repos publish Pages from a subdirectory** | `invoice-payment-overview` and `foodbridge-module-procurement` serve from `discovery/`, so their published URL paths do not match their paths on disk. `dev.py` resolves every destination against the actual files and reports anything it cannot find, rather than letting it 404 later. |
| **Locally everything is same-origin; in production it is not** | Published, each module is a separate origin, so the shell cannot reach into the iframes. Served locally from one root, it can. Do not write anything that depends on that — it will not work in production. |
| **A missing checkout is not fatal** | `dev.py` wires what it finds and lists what it could not, so you can work on one module without cloning all twelve. |
| **`?config=`** | The shell accepts `?config=<path>` to load a different nav config. That is the only hook `dev.py` needs; the published build ignores it. |

### Where the module seed data lives

Each mockup is driven by a seed file, usually `seed-data/seed.json`. Several modules also ship
`seed.inline.js`, a verbatim copy of the same data as a script, because `file://` blocks fetching
local JSON. **Where both exist, edit both** — they will otherwise disagree, and which one you see
depends on how the page was opened.

## The `development/` trees

Two modules have them: `invoice-payment-overview` and `foodbridge-module-procurement`. They are
npm workspaces — `sources-of-truth`, `frontend`, `backend`.

```
cd <repo>/development
npm install          # postinstall compiles the sources-of-truth package
npm test
```

Verified on Node 22 / npm 10 against `invoice-payment-overview`:

| | |
| --- | --- |
| `npm install` | works — 229 packages, and the postinstall `tsc` build succeeds |
| Backend tests | **4 files, 5 tests, all pass** |
| Frontend `business`, `behavioural`, `integration` | **pass** |
| Frontend `functional` | **fails** — `ReferenceError: document is not defined` |

The functional failure is pre-existing, not something the packaging introduced. That suite renders
React through Testing Library, which needs a DOM, and there is no vitest config in `frontend/`
setting `environment: "jsdom"`. So `npm test` at the workspace root exits non-zero even though 8 of
the 9 test files pass. Adding the config, or an `// @vitest-environment jsdom` docblock to that one
file, is the fix — it belongs to the module team.

Other useful scripts: `npm run dev -w …-backend` (API server) and `npm run sandbox -w …-frontend`
(Vite sandbox).

## The rest of the repos

Everything else is static. Serve the folder and open it — `python3 -m http.server` is enough if you
only want one module and not the whole shell around it.

Each module keeps its own working notes under `discovery/instructions/`: an addendum per iteration
recording what was asked, what was decided, and what was rejected. Read those before changing a
screen; they carry the reasoning that the code does not.

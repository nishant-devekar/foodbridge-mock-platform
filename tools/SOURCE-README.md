# FoodBridge v1 — source

Everything behind the platform: 12 repositories, their full history, and the decision log
for every screen. Its companion `foodbridge-mock-platform-v1.zip` is the runtime build —
open that one in a browser to *look* at the product; use this one to *work* on it.

## Run

```bash
./run.sh
```

It prints a URL. Open it. That's the whole setup — Python 3 and a browser, no install, no
build step. Edit any file under `repos/` and refresh.

## Update

```bash
./update.sh
```

Pulls every checkout up to date with GitHub. Anything with uncommitted changes is reported
and left alone rather than clobbered.

## Maintain

`repos/` holds ordinary git clones with their GitHub `origin` already set. Work in them
normally:

```bash
cd repos/foodbridge-dashboard-mockup
git checkout -b my-change
# edit, refresh the browser, repeat
git commit -am "…"
git push -u origin my-change
```

Nothing to reassemble, no remotes to fix.

## What is here

```
run.sh          start the platform against these checkouts
update.sh       pull them all up to date
repos/<name>/   a full git clone of each repository
MANIFEST.md     every repository, its commit at v1, and its GitHub URL
```

## The one thing worth knowing

Published, the shell iframes each team's **live GitHub Pages site**. So serving this folder
with a plain static server would still load every module from the internet, and nothing you
edited locally would appear — silently, with nothing looking broken.

`run.sh` is what avoids that: it repoints all 26 destinations at `repos/` and serves them
from one root with `Cache-Control: no-store`. It also writes `modules.local.json`, which is
gitignored — `assets/modules.json` stays canonical.

Two repositories publish Pages from a `discovery/` subdirectory, so their published URL paths
don't match their paths on disk. Every destination is resolved against the real files, and
anything missing is reported at startup instead of 404-ing later. A missing checkout isn't
fatal either, so you can delete the repos you don't care about and still run the rest.

## Editing seed data

Each mockup is driven by a seed file, usually `seed-data/seed.json`. Several modules also ship
`seed.inline.js`, a verbatim copy as a script, because `file://` blocks fetching local JSON.
**Where both exist, edit both** — otherwise they disagree and which one you see depends on how
the page was opened.

## Read the addenda before changing a screen

Each module keeps `discovery/instructions/` — an addendum per iteration recording what was
asked, what was decided, and what was rejected. That reasoning isn't in the code, and it is the
main thing this package has that the runtime build does not.

## The two npm trees

`invoice-payment-overview` and `foodbridge-module-procurement` have gone past discovery and
carry `development/` npm workspaces:

```bash
cd repos/invoice-payment-overview/development
npm install
npm test
```

`npm install` works. `npm test` currently exits non-zero: 8 of its 9 test files pass, and the
`functional` suite fails with `ReferenceError: document is not defined` because vitest has no
jsdom environment configured for it. Pre-existing in the module, not caused by the packaging.

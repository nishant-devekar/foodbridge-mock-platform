# FoodBridge v1 — source

The **source** half of v1. Its companion, `foodbridge-mock-platform-v1.zip`, is the runtime
half: a self-contained build you open in a browser and click through without installing
anything. Use that one to *see* the product; use this one to *work* on it.

## Run it, in one command

The repos are already laid out the way the tooling expects. From this folder:

```bash
cd repos/foodbridge-mock-platform
python3 tools/dev.py
```

It prints a URL. Open it. Python 3 and a browser — nothing to install, no build step.

Edit any file under `repos/` and refresh; the change is there. Full notes, including the
`development/` npm workspaces and the things that otherwise catch people out, are in
[`repos/foodbridge-mock-platform/DEVELOPMENT.md`](repos/foodbridge-mock-platform/DEVELOPMENT.md).

> **Why a script rather than "serve the folder"?** Published, the shell iframes each team's
> live GitHub Pages site. Serving the shell on its own would still load every module from the
> internet, and nothing you edited locally would appear. `dev.py` repoints every destination at
> the checkouts and serves them from one root.

## What is here

```
repos/<name>/           full working tree at the v1 commit — plain files, no git needed
bundles/<name>.bundle   the same repository with complete history, branches and tags
MANIFEST.md             every repository, its exact commit SHA and date
```

12 repositories, 1347 files.

## If you are going to commit

`repos/` holds plain files with **no `.git`** — fine for reading and for a quick experiment, but
you cannot commit from it. The history is in `bundles/`, and a bundle clones like a remote. To get
a set of real, committable repos:

```bash
mkdir work && cd work
for b in ../bundles/*.bundle; do
  git clone -q "$b" "$(basename "$b" .bundle)"
done
```

You now have every commit, branch and tag — `git log`, `git diff` and `git blame` all work
offline. `tools/dev.py` picks these up with no arguments, because they sit side by side exactly
as it expects:

```bash
cd foodbridge-mock-platform
python3 tools/dev.py
```

**Repoint `origin` before doing real work.** A bundle clone's `origin` is the bundle file, so
pushing would go nowhere useful:

```bash
git remote set-url origin https://github.com/<owner>/<name>.git
```

`MANIFEST.md` lists the owner for each repository.

## Why this is separate from the runtime package

The runtime package was built by crawling what a browser loads, so it holds only the 155 files
needed to render the 24 screens — about 14% of the source. Everything below is invisible to a
browser and therefore absent from it:

- `discovery/instructions/` — the addenda and decision log for every module. The *why* behind
  each design choice.
- `development/` — where modules have gone past discovery: TypeScript services and repositories,
  OpenAPI specs, tests, and `sources-of-truth/` (state machine, domain model, component library,
  workflow model, collaboration contract).
- Screens reached only by JavaScript rather than by a link.
- Canonical `seed-data/*.json` where a module ships an inlined mirror for the browser.
- Superseded and frozen version folders.
- Briefs, walkthroughs and screenshots of the as-is system.
- All git history.

## Known issue on arrival

`npm test` in `repos/invoice-payment-overview/development` exits non-zero: 8 of its 9 test files
pass, and the `functional` suite fails with `ReferenceError: document is not defined` because
vitest has no jsdom environment configured for it. Pre-existing in the module, not caused by the
packaging. See DEVELOPMENT.md.

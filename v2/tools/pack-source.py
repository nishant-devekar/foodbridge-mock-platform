#!/usr/bin/env python3
"""Build the source half of a release: every repo as a real git clone, plus a
launcher, an updater and a manifest.

    python3 tools/pack-source.py --out ~/foodbridge-v1-source

Companion to pack.py, which builds the runtime half. That one crawls what a
browser loads (~14% of the source); this one carries everything else — the
instruction logs, the development/ trees, unlinked screens, and all history.

The clones keep their .git and their GitHub origin, so the folder is ready to
work in the moment it is unzipped: edit, commit, push, pull. An earlier build
shipped stripped trees alongside separate git bundles, which forced whoever
received it to reassemble the two before they could commit anything. A clone
already is both halves.
"""
import argparse, json, pathlib, shutil, subprocess, sys, urllib.parse

SELF = pathlib.Path(__file__).resolve()
PLATFORM = SELF.parent.parent


def git(*args, cwd=None):
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True).stdout.strip()


def repo_slugs():
    """owner/name for the platform and every repo it points at, platform first."""
    cfg = json.loads((PLATFORM / "assets/modules.json").read_text())
    owners, order = {}, []

    def walk(items):
        for it in items:
            if it.get("submenus"):
                walk(it["submenus"])
            if it.get("owner") and it["owner"].split("/")[-1] not in owners:
                owners[it["owner"].split("/")[-1]] = it["owner"]
                order.append(it["owner"].split("/")[-1])
            for k in ("url", "urlMobile"):
                if it.get(k):
                    u = urllib.parse.urlsplit(it[k])
                    name = u.path.lstrip("/").split("/")[0]
                    if name not in owners:
                        owners[name] = f"{u.netloc.split('.')[0]}/{name}"
                        order.append(name)
    walk(cfg["nav"]); walk(cfg.get("standalone", []))

    this = git("remote", "get-url", "origin", cwd=PLATFORM) \
        .replace("https://github.com/", "").replace(".git", "")
    return [this] + [owners[n] for n in order if owners[n] != this]


RUN = """#!/usr/bin/env bash
# Start the platform against the checkouts in repos/. Edit any file there and
# refresh — no build step, nothing to install beyond Python 3.
set -e
cd "$(dirname "$0")"
exec python3 repos/{platform}/tools/dev.py "$@"
"""

UPDATE = """#!/usr/bin/env bash
# Pull every checkout up to date with GitHub. Anything with local changes is
# reported and left alone rather than being clobbered.
# Not passed through str.format — braces here are literal shell.
set -e
cd "$(dirname "$0")/repos"
for d in */; do
  d="${d%/}"
  [ -d "$d/.git" ] || continue
  if [ -n "$(git -C "$d" status --porcelain)" ]; then
    printf '  %-44s skipped - you have local changes\n' "$d"
    continue
  fi
  before=$(git -C "$d" rev-parse --short HEAD)
  if ! git -C "$d" pull --ff-only --quiet 2>/dev/null; then
    printf '  %-44s pull failed\n' "$d"
    continue
  fi
  after=$(git -C "$d" rev-parse --short HEAD)
  if [ "$before" = "$after" ]; then
    printf '  %-44s up to date\n' "$d"
  else
    printf '  %-44s %s -> %s\n' "$d" "$before" "$after"
  fi
done
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--frozen-on", default="14 August 2026")
    args = ap.parse_args()

    out = pathlib.Path(args.out).resolve()
    if out.exists():
        shutil.rmtree(out)
    (out / "repos").mkdir(parents=True)

    rows = []
    for slug in repo_slugs():
        name = slug.split("/")[-1]
        dest = out / "repos" / name
        print(f"  {name}…", flush=True)
        r = subprocess.run(["git", "clone", "-q", f"https://github.com/{slug}.git", str(dest)],
                           capture_output=True, text=True)
        if r.returncode:
            print(f"    SKIPPED — {r.stderr.strip()[:80]}", flush=True)
            continue
        sha = git("rev-parse", "HEAD", cwd=dest)
        rows.append(dict(name=name, slug=slug, sha=sha, short=sha[:7],
                         date=git("log", "-1", "--format=%cI", cwd=dest)[:10],
                         commits=git("rev-list", "--count", "HEAD", cwd=dest),
                         branch=git("rev-parse", "--abbrev-ref", "HEAD", cwd=dest),
                         files=sum(1 for f in dest.rglob("*")
                                   if f.is_file() and ".git/" not in str(f))))

    platform_name = PLATFORM.name
    (out / "run.sh").write_text(RUN.format(platform=platform_name))
    (out / "update.sh").write_text(UPDATE)
    (out / "run.sh").chmod(0o755)
    (out / "update.sh").chmod(0o755)
    shutil.copy2(PLATFORM / "tools" / "SOURCE-README.md", out / "README.md")

    total = sum(r["files"] for r in rows)
    man = [f"""# FoodBridge v1 — source manifest

Every repository behind the platform, at the commit it was on when v1 was cut
({args.frozen_on}). {len(rows)} repositories, {total} files.

These are live clones with their GitHub `origin` intact — `./update.sh` moves them
forward whenever you want. The commits below are where they started.

| Repository | Commit | Dated | Branch | Commits | Files |
| ---------- | ------ | ----- | ------ | ------: | ----: |"""]
    man += [f"| [`{r['name']}`](https://github.com/{r['slug']}) | `{r['short']}` | {r['date']} | "
            f"{r['branch']} | {r['commits']} | {r['files']} |" for r in rows]
    man += ["\n## Full commit SHAs\n\n```"]
    man += [f"{r['sha']}  {r['slug']}" for r in rows]
    man += ["```\n", "Return any repository to exactly where v1 was:\n",
            "```\ngit -C repos/<name> checkout <sha>\n```"]
    (out / "MANIFEST.md").write_text("\n".join(man))

    print(f"\n  {len(rows)} repos, {total} files -> {out}")
    bad = [r["name"] for r in rows
           if git("remote", "get-url", "origin", cwd=out / "repos" / r["name"])
           != f"https://github.com/{r['slug']}.git"]
    print("  OK — every clone has its GitHub origin, ready to push and pull" if not bad
          else f"  WRONG ORIGIN: {bad}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

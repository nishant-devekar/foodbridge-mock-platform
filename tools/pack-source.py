#!/usr/bin/env python3
"""Build the source half of a release: every repo as a working tree, as a git
bundle, and a manifest tying both to one commit.

    python3 tools/pack-source.py --out ~/foodbridge-v1-source

Companion to pack.py, which builds the runtime half. That one crawls what a
browser loads (~14% of the source); this one carries everything else — the
instruction logs, the development/ trees, unlinked screens, and all history.

Clone, bundle and strip happen in that order from a single fresh clone, so the
tree, the bundle and the manifest can never disagree about which commit a repo
is at. An earlier hand-assembled build shipped a tree one commit ahead of its
own bundle; this exists so that cannot recur.
"""
import argparse, json, pathlib, shutil, subprocess, sys, urllib.parse

SELF = pathlib.Path(__file__).resolve()
PLATFORM = SELF.parent.parent


def git(*args, cwd=None):
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True,
                          check=False).stdout.strip()


def repo_slugs():
    """owner/name for the platform and every repo it points at."""
    cfg = json.loads((PLATFORM / "assets/modules.json").read_text())
    owners, order = {}, []

    def walk(items):
        for it in items:
            if it.get("submenus"):
                walk(it["submenus"])
            if it.get("owner"):
                name = it["owner"].split("/")[-1]
                if name not in owners:
                    owners[name] = it["owner"]
                    order.append(name)
            for k in ("url", "urlMobile"):
                if it.get(k):
                    host = urllib.parse.urlsplit(it[k]).netloc
                    name = urllib.parse.urlsplit(it[k]).path.lstrip("/").split("/")[0]
                    if name not in owners:
                        owners[name] = f"{host.split('.')[0]}/{name}"
                        order.append(name)
    walk(cfg["nav"]); walk(cfg.get("standalone", []))

    this = git("remote", "get-url", "origin", cwd=PLATFORM)
    this = this.replace("https://github.com/", "").replace(".git", "")
    return [this] + [owners[n] for n in order if owners[n] != this]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="directory to build the package in")
    ap.add_argument("--frozen-on", default="14 August 2026")
    args = ap.parse_args()

    out = pathlib.Path(args.out).resolve()
    if out.exists():
        shutil.rmtree(out)
    (out / "repos").mkdir(parents=True)
    (out / "bundles").mkdir()

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
        subprocess.run(["git", "bundle", "create", "-q",
                        str(out / "bundles" / f"{name}.bundle"), "--all"],
                       cwd=dest, capture_output=True, check=True)
        rows.append(dict(name=name, slug=slug, sha=sha, short=sha[:7],
                         date=git("log", "-1", "--format=%cI", cwd=dest)[:10],
                         commits=git("rev-list", "--count", "HEAD", cwd=dest)))
        shutil.rmtree(dest / ".git")          # history lives in the bundle
        rows[-1]["files"] = sum(1 for f in dest.rglob("*") if f.is_file())

    total = sum(r["files"] for r in rows)
    man = [f"""# FoodBridge v1 — source manifest

Every repository behind the platform, frozen at the commit it was on when v1 was
cut ({args.frozen_on}). {len(rows)} repositories, {total} files.

Each repository's working tree under `repos/` and its bundle under `bundles/` are
built from the same clone, so they are always at the commit named here.

| Repository | Commit | Dated | Commits | Files |
| ---------- | ------ | ----- | ------: | ----: |"""]
    man += [f"| [`{r['name']}`](https://github.com/{r['slug']}) | `{r['short']}` | "
            f"{r['date']} | {r['commits']} | {r['files']} |" for r in rows]
    man += ["\n## Full commit SHAs\n\n```"]
    man += [f"{r['sha']}  {r['slug']}" for r in rows]
    man += ["```\n", "Check out any repo exactly as it was at v1:\n",
            "```\ngit clone bundles/<name>.bundle <name>\n"
            "cd <name> && git checkout <sha-from-above>\n```"]
    (out / "MANIFEST.md").write_text("\n".join(man))

    shutil.copy2(PLATFORM / "tools" / "SOURCE-README.md", out / "README.md")
    print(f"\n  {len(rows)} repos, {total} files -> {out}")
    print("  verifying tree and bundle agree…", flush=True)

    bad = []
    for r in rows:
        probe = out / ".verify" / r["name"]
        subprocess.run(["git", "clone", "-q", str(out / "bundles" / f"{r['name']}.bundle"),
                        str(probe)], capture_output=True, check=True)
        if git("rev-parse", "HEAD", cwd=probe) != r["sha"]:
            bad.append(r["name"])
        shutil.rmtree(probe)
    shutil.rmtree(out / ".verify", ignore_errors=True)
    print("  OK — every bundle clones back to its manifest commit" if not bad
          else f"  MISMATCH: {bad}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

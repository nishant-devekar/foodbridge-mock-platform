#!/usr/bin/env python3
"""Run the whole platform against local checkouts, so edits show up on refresh.

Published, the shell iframes each team's GitHub Pages site. Cloning the repos and
serving the shell is therefore not enough on its own — it would still load every
module from the internet, and nothing you edited locally would appear. This
rewrites the nav config to point at the checkouts instead, and serves them all
from one root.

    python3 tools/dev.py                # auto-detect sibling checkouts
    python3 tools/dev.py --root ../..   # where the repos live
    python3 tools/dev.py --port 8000

Expects the repos side by side, which is how the v1 source package is laid out:

    <root>/
      foodbridge-mock-platform/
      foodbridge-dashboard-mockup/
      invoice-payment-overview/
      …

Two repos publish Pages from a subdirectory (discovery/), so their URL paths do
not match their paths on disk. Every destination is resolved against the actual
files rather than assumed, and anything that cannot be found is reported instead
of silently 404-ing later.
"""
import argparse, functools, http.server, json, pathlib, socketserver, sys, urllib.parse

SELF = pathlib.Path(__file__).resolve()
PLATFORM = SELF.parent.parent
LOCAL_CONFIG = "modules.local.json"          # gitignored; never commit this
CHECKOUT_MAP = SELF.parent / "local-checkouts.json"   # tracked; portable, no absolute paths


def load_checkout_map():
    """Published repo name -> local checkout directory name.

    A repo not listed resolves to a directory of its own name, which is what
    every module did before this file existed. Validated on load: a bad mapping
    that silently points at the wrong checkout is worse than no mapping, because
    the platform would serve someone else's screens under this module's name.
    """
    if not CHECKOUT_MAP.is_file():
        return {}
    try:
        raw = json.loads(CHECKOUT_MAP.read_text())
    except json.JSONDecodeError as e:
        sys.exit(f"{CHECKOUT_MAP.name} is not valid JSON: {e}")
    m = {k: v for k, v in (raw.get("map") or {}).items() if not k.startswith("_")}

    problems = []
    for repo, local in m.items():
        if not isinstance(local, str) or not local:
            problems.append(f"{repo}: target must be a non-empty directory name")
        elif "/" in local or local.startswith("."):
            problems.append(f"{repo}: '{local}' must be a bare directory name, not a path")
    seen = {}
    for repo, local in m.items():
        seen.setdefault(local, []).append(repo)
    for local, repos in seen.items():
        if len(repos) > 1:
            problems.append(f"'{local}' is claimed by {len(repos)} repos: {', '.join(sorted(repos))}")
    if problems:
        sys.exit(f"{CHECKOUT_MAP.name} is not usable:\n"
                 + "\n".join(f"  - {p}" for p in problems))
    return m


def resolve(repo_dir, rest):
    """Map a published URL path to a file in the checkout.

    Tries the path as published, then under discovery/ (two repos serve Pages
    from there), then falls back to a search for any file with that suffix.
    """
    if (repo_dir / rest).is_file():
        return rest
    for prefix in ("discovery", "docs"):
        if (repo_dir / prefix / rest).is_file():
            return f"{prefix}/{rest}"
    tail = rest.split("/")[-1]
    for cand in repo_dir.rglob(tail):
        if cand.is_file() and str(cand.relative_to(repo_dir)).endswith(rest.split("/")[-2] + "/" + tail
                                                                      if "/" in rest else tail):
            return str(cand.relative_to(repo_dir))
    return None


def build_config(root):
    cfg = json.loads((PLATFORM / "assets/modules.json").read_text())
    aliases = load_checkout_map()
    missing, mapped, repos = [], 0, set()

    def walk(items):
        nonlocal mapped
        for it in items:
            if it.get("submenus"):
                walk(it["submenus"])
            for key in ("url", "urlMobile"):
                if not it.get(key):
                    continue
                parts = urllib.parse.urlsplit(it[key]).path.lstrip("/").split("/")
                repo, rest = parts[0], "/".join(parts[1:])
                local = aliases.get(repo, repo)
                repo_dir = root / local
                if not repo_dir.is_dir():
                    where = f"{local}/" if local == repo else f"{local}/ (mapped from {repo})"
                    missing.append(f"{it.get('id', '?')}: no checkout at {where}"
                                   + ("" if local != repo else
                                      f" — if it is cloned under a different name, add it to "
                                      f"tools/{CHECKOUT_MAP.name}"))
                    continue
                found = resolve(repo_dir, rest)
                if not found:
                    missing.append(f"{it.get('id', '?')}: {rest} not in {local}/")
                    continue
                # the served path must match the directory on disk, not the
                # published repo name, or the static handler 404s on the alias
                it[key] = f"/{local}/{found}"
                repos.add(local)
                mapped += 1

    walk(cfg["nav"]); walk(cfg.get("standalone", []))

    # a duplicate id makes the shell route two destinations to one hash, and the
    # loser simply never opens — silent, and very hard to see from the UI
    ids = []
    def collect(items):
        for it in items:
            if it.get("submenus"):
                collect(it["submenus"])
            elif it.get("id"):
                ids.append(it["id"])
    collect(cfg["nav"]); collect(cfg.get("standalone", []))
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    if dupes:
        sys.exit("assets/modules.json has duplicate destination id(s): " + ", ".join(dupes))
    cfg["_local"] = ("Generated by tools/dev.py — every destination points at a checkout on "
                     "disk. Do not commit this file; assets/modules.json stays canonical.")
    return cfg, mapped, missing, repos


class Handler(http.server.SimpleHTTPRequestHandler):
    """No-store, so a refresh always picks up what you just saved."""
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        code = args[1] if len(args) > 1 else ""
        if str(code).startswith(("4", "5")):
            sys.stderr.write(f"  {code} {self.path}\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=str(PLATFORM.parent),
                    help="directory holding the repo checkouts (default: the platform's parent)")
    ap.add_argument("--port", type=int, default=8000)
    args = ap.parse_args()

    # the banner is the tool's whole UI; unbuffer so it appears immediately even
    # when stdout is a pipe or a log file rather than a terminal
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except AttributeError:
        pass

    root = pathlib.Path(args.root).resolve()
    if not (root / PLATFORM.name).is_dir():
        sys.exit(f"No {PLATFORM.name}/ under {root}.\n"
                 f"Point --root at the directory holding the checkouts.")

    cfg, mapped, missing, repos = build_config(root)
    (PLATFORM / "assets" / LOCAL_CONFIG).write_text(json.dumps(cfg, indent=2, ensure_ascii=False))

    url = f"http://localhost:{args.port}/{PLATFORM.name}/?config=assets/{LOCAL_CONFIG}"
    print(f"\n  serving   {root}")
    print(f"  wired     {mapped} destinations across {len(repos)} checkouts")
    if missing:
        print(f"\n  {len(missing)} destination(s) could not be resolved — they will 404:")
        for m in missing:
            print(f"    - {m}")
        print("    (clone the missing repo, or check out the branch that has the screen)")
    print(f"\n  OPEN      {url}\n")
    print("  Edit any file under a checkout and refresh — no rebuild, no cache.")
    print("  Ctrl-C to stop.\n")

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", args.port),
                                functools.partial(Handler, directory=str(root))) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  stopped")


if __name__ == "__main__":
    main()

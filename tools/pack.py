#!/usr/bin/env python3
"""Vendor the whole platform — shell + every module screen it iframes — into one
self-contained folder.

Each module keeps its OWN directory layout under modules/<repo>/…, so every
relative link inside it (../seed-data/seed.json, order.html?x=1) resolves
unchanged. Only absolute and CDN URLs are rewritten.

  python3 pack.py --dry     report what would be fetched
  python3 pack.py           write the package to ./pkg
"""
import json, re, sys, hashlib, pathlib, shutil, urllib.request, urllib.parse, collections

HERE = pathlib.Path(__file__).parent
PLATFORM = pathlib.Path(__file__).resolve().parent.parent   # the repo root
OUT = PLATFORM / "pkg"   # move/rename to v2/ once verified
DRY = "--dry" in sys.argv
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

# references worth following. Groups: tag attribute | css url() | bare asset string
ASSET_RE = re.compile(
    r"""(?:src|href)\s*=\s*["']([^"'\s<>]+)["']"""
    r"""|url\(\s*["']?([^"')\s]+)["']?\s*\)"""
    r"""|["']([^"'\s<>()]+\.(?:json|js|css|png|jpe?g|svg|gif|webp|woff2?|ttf))(?:\?[^"']*)?["']""",
    re.I)
SKIP = re.compile(r"^(?:data:|blob:|mailto:|tel:|javascript:|#)", re.I)
BINARY = re.compile(r"\.(png|jpe?g|gif|webp|woff2?|ttf|eot|ico|mp4|pdf)$", re.I)
# hosts whose assets we pull down and ship locally
VENDORABLE = ("fonts.googleapis.com", "fonts.gstatic.com", "cdn.tailwindcss.com", "unpkg.com")

cache, files, failed, notfound = {}, {}, [], []
external = collections.Counter()
vendor = {}          # absolute url -> vendor/<name>


def get(url, binary=False):
    if url in cache:
        return cache[url]
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            cache[url] = r.read()
    except urllib.error.HTTPError as e:
        (notfound if e.code == 404 else failed).append((url, f"HTTP {e.code}"))
        cache[url] = None
    except Exception as e:
        failed.append((url, type(e).__name__ + ": " + str(e)[:50]))
        cache[url] = None
    return cache[url]


def repo_of(url):
    p = urllib.parse.urlsplit(url)
    parts = p.path.lstrip("/").split("/")
    return f"{p.scheme}://{p.netloc}/{parts[0]}/", "/".join(parts[1:]), parts[0]


def refs(text, base):
    """Yield absolute URLs referenced by this text."""
    for m in ASSET_RE.finditer(text):
        ref = (m.group(1) or m.group(2) or m.group(3) or "").strip()
        if not ref or SKIP.match(ref) or "{" in ref or "\\" in ref:
            continue          # {z}/{x}/{y} tile templates and escaped strings
        yield urllib.parse.urljoin(base, ref.split("#")[0])


def crawl(url, depth=0):
    root, rest, repo = repo_of(url)
    if (repo, rest) in files:
        return
    body = get(url)
    if body is None:
        return
    files[(repo, rest)] = body
    if BINARY.search(rest) or depth > 6:
        return
    try:
        text = body.decode("utf-8")
    except UnicodeDecodeError:
        return
    base = urllib.parse.urljoin(url, ".")
    for t in refs(text, base):
        if t.startswith(root):
            crawl(t, depth + 1)
        elif t.startswith(("http://", "https://")):
            external[t.split("#")[0]] += 1


def slug(url):
    """A stable, collision-free local name for a vendored CDN asset."""
    p = urllib.parse.urlsplit(url)
    name = pathlib.PurePosixPath(p.path).name or "index"
    h = hashlib.sha1(url.encode()).hexdigest()[:8]
    if p.netloc == "cdn.tailwindcss.com":
        return f"tailwind-{name}.js"
    if p.netloc == "fonts.googleapis.com":
        return f"fonts-{h}.css"        # one per family set; the query is the identity
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)


def pull_vendor():
    """Download CDN assets. Only CSS is followed — @font-face and leaflet's own
    url() refs are real, whereas a minified JS bundle is full of string literals
    that merely look like filenames (tailwind's own source yielded '$1.js')."""
    queue = [u for u in external if any(h in u for h in VENDORABLE)]
    while queue:
        url = queue.pop(0)
        if url in vendor:
            continue
        body = get(url)
        if body is None:
            continue
        vendor[url] = slug(url)
        if not vendor[url].endswith(".css"):
            continue
        try:
            text = body.decode("utf-8")
        except UnicodeDecodeError:
            continue
        for t in refs(text, urllib.parse.urljoin(url, ".")):
            if t.startswith(("http://", "https://")) and t not in vendor:
                queue.append(t)


def rewrite(text, depth_to_root, in_vendor=False):
    """Point CDN references at the local vendor/ copy. A file that already lives
    in vendor/ refers to its siblings by bare name — prefixing vendor/ there
    produced /vendor/vendor/<font>.woff2."""
    up = "../" * depth_to_root
    for url, name in vendor.items():
        text = text.replace(url, name if in_vendor else f"{up}vendor/{name}")
    # preconnect hints to hosts we no longer talk to
    text = re.sub(r'<link[^>]+rel=["\'](?:preconnect|dns-prefetch)["\'][^>]*>\s*', "", text, flags=re.I)
    return text


def main():
    cfg = json.loads((PLATFORM / "assets/modules.json").read_text())
    seeds = []

    def walk(items):
        for it in items:
            if it.get("submenus"):
                walk(it["submenus"])
            for k in ("url", "urlMobile"):
                if it.get(k):
                    seeds.append(it[k])
    walk(cfg["nav"]); walk(cfg.get("standalone", []))

    print(f"crawling {len(seeds)} destinations…\n")
    for u in seeds:
        crawl(u)
    pull_vendor()

    by_repo = collections.Counter(r for r, _ in files)
    print(f"{'repo':44} files")
    for r, n in by_repo.most_common():
        print(f"  {r:42} {n:4}")
    print(f"\n  {len(files)} module files, {sum(len(b) for b in files.values())/1e6:.2f} MB")
    print(f"  {len(vendor)} vendored CDN files, {sum(len(cache[u] or b'') for u in vendor)/1e6:.2f} MB")

    live = {u: n for u, n in external.items() if not any(h in u for h in VENDORABLE)}
    if live:
        print(f"\ncannot be vendored — still reach the network at view time:")
        for u, n in sorted(live.items(), key=lambda x: -x[1]):
            print(f"  x{n:<3} {u[:100]}")
    if notfound:
        print(f"\nalready 404 on the live site ({len(notfound)}) — packaged as-is:")
        for u, _ in notfound[:6]:
            print(f"  {u[:110]}")
    if failed:
        print(f"\nfetch errors ({len(failed)}):")
        for u, e in failed[:8]:
            print(f"  {e:28} {u[:80]}")
    if DRY:
        return
    write(cfg)


FROZEN_ON = "14 August 2026"


def badge():
    """A small fixed marker so a copy of this folder, detached from any context,
    still says what it is. Fixed-position and z-indexed, so it overlays rather
    than reflows — the shell underneath stays pixel-identical to what v1 was."""
    f = OUT / "index.html"
    html = f.read_text()
    mark = (
        '<style>'
        '#v1-badge{position:fixed;right:10px;bottom:10px;z-index:2147483647;'
        'font:500 11px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.02em;'
        'background:rgba(15,23,42,.72);color:#fff;padding:6px 10px;border-radius:999px;'
        'text-decoration:none;opacity:.45;transition:opacity .15s;backdrop-filter:blur(4px);'
        '-webkit-backdrop-filter:blur(4px)}'
        '#v1-badge:hover{opacity:1}'
        '@media print{#v1-badge{display:none}}'
        '</style>'
        f'<a id="v1-badge" href="VERSION.md" title="Frozen snapshot — click for what is inside">'
        f'v1 \u00b7 frozen {FROZEN_ON}</a>'
    )
    f.write_text(html.replace("</body>", mark + "\n</body>", 1))


def docs(cfg):
    dests = []

    def walk(items, pre=""):
        for it in items:
            if it.get("submenus"):
                walk(it["submenus"], it["id"] + "/")
            elif it.get("url"):
                dests.append((pre + it["id"], it["name"], it["url"]))
    walk(cfg["nav"]); walk(cfg.get("standalone", []))

    repos = sorted({d.name for d in (OUT / "modules").iterdir() if d.is_dir()})
    nfiles = sum(1 for f in OUT.rglob("*") if f.is_file())
    size = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file()) / 1e6

    rows = "\n".join(f"| `#/{r}` | {name} | `{u}` |" for r, name, u in dests)
    repolist = "\n".join(f"- `modules/{r}/`" for r in repos)

    (OUT / "VERSION.md").write_text(f"""# FoodBridge mock platform — Version 1

**Frozen {FROZEN_ON}.** A self-contained snapshot: the shell plus a local copy of every
module screen it shows. Nothing here loads from a module team's GitHub Pages site, so this
folder renders the same however those repos change afterwards.

{nfiles} files, {size:.1f} MB, {len(repos)} module repos, {len(dests)} destinations.

## Running it

It must be **served over HTTP** — seven of the packaged screens `fetch()` their seed JSON at
runtime, which a browser blocks on `file://`. From this folder:

```
python3 -m http.server 8000
```

then open <http://localhost:8000/>. On GitHub Pages it works as-is.

## What is frozen, and what is not

| | |
| --- | --- |
| Shell — nav, routing, chrome, clip offsets | frozen |
| All {len(dests)} module screens, their JS/CSS/seed data/images | frozen, local copies |
| Google Fonts, Tailwind, Leaflet | frozen in `vendor/` |
| **Map tiles on Live Delivery Tracking** | **not frozen** — `tile.openstreetmap.org`, the only remaining network call in the package. Offline that map shows its markers and controls on a blank background; every other screen is fully offline-capable. |

## Inherited defects

Faithfully reproduced from the live sites rather than silently patched:

- `modules/foodbridge-production-discovery/batch-management/screens/batch/styles-b.css` — referenced
  by Batch Management, already 404 on the live site on the freeze date.
- `https://nishant-devekar.github.io/seed-data/seed.json` — an absolute URL missing its repo
  segment, so already broken upstream; left as it was found.

## Layout

```
index.html          the shell
assets/             shell JS/CSS + modules.json, rewritten to local paths
modules/<repo>/…    each module in its OWN original directory layout, so every
                    relative link inside it still resolves
vendor/             Google Fonts, Tailwind, Leaflet
```

{repolist}

## Where each screen came from

| Route | Screen | Source on the freeze date |
| --- | --- | --- |
{rows}
""")

    (OUT / "serve.sh").write_text(
        "#!/usr/bin/env bash\n"
        "# Serve this snapshot. It needs HTTP — several screens fetch() their seed JSON,\n"
        "# which browsers block on file://.\n"
        'cd "$(dirname "$0")" && python3 -m http.server "${1:-8000}"\n')
    (OUT / "serve.sh").chmod(0o755)


def favicon():
    """16x16 32bpp ICO in the platform's emerald. Written by hand so the package
    has no image dependency and stops asking the server for /favicon.ico."""
    import struct
    w = h = 16
    px = bytes((0x81, 0xB9, 0x10, 0xFF))            # BGRA
    xor = px * (w * h)
    and_mask = b"\x00" * (w * h // 8)
    dib = struct.pack("<IiiHHIIiiII", 40, w, h * 2, 1, 32, 0, len(xor), 0, 0, 0, 0)
    img = dib + xor + and_mask
    return (struct.pack("<HHH", 0, 1, 1) +
            struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(img), 22) + img)


def write(cfg):
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "modules").mkdir(parents=True)
    (OUT / "vendor").mkdir()

    for url, name in vendor.items():
        body = cache[url]
        if body is None:
            continue
        if not BINARY.search(name):
            body = rewrite(body.decode("utf-8", "replace"), 0, in_vendor=True).encode("utf-8")
        (OUT / "vendor" / name).write_bytes(body)

    for (repo, rest), body in files.items():
        p = OUT / "modules" / repo / rest
        p.parent.mkdir(parents=True, exist_ok=True)
        if not BINARY.search(rest):
            depth = 2 + rest.count("/")          # modules/<repo>/<rest> -> back to package root
            body = rewrite(body.decode("utf-8", "replace"), depth).encode("utf-8")
        p.write_bytes(body)

    # the shell, with every destination repointed at its local copy
    for item in ["index.html", "assets", "tools", ".nojekyll", "README.md"]:
        src = PLATFORM / item
        if not src.exists():
            continue
        dst = OUT / item
        shutil.copytree(src, dst) if src.is_dir() else shutil.copy2(src, dst)

    def relocate(items):
        for it in items:
            if it.get("submenus"):
                relocate(it["submenus"])
            for k in ("url", "urlMobile"):
                if it.get(k):
                    _, rest, repo = repo_of(it[k])
                    it[k] = f"modules/{repo}/{rest}"
    relocate(cfg["nav"]); relocate(cfg.get("standalone", []))
    cfg["_frozen"] = ("Version 1 — a frozen, self-contained snapshot. Every destination below is a "
                      "local copy under modules/, not a live GitHub Pages URL, so this folder renders "
                      "the same whatever the module teams push next. See VERSION.md.")
    (OUT / "assets/modules.json").write_text(json.dumps(cfg, indent=2, ensure_ascii=False))

    (OUT / "favicon.ico").write_bytes(favicon())
    badge()
    docs(cfg)

    total = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    n = sum(1 for f in OUT.rglob("*") if f.is_file())
    print(f"\nwrote {n} files, {total/1e6:.2f} MB -> {OUT}")


if __name__ == "__main__":
    main()

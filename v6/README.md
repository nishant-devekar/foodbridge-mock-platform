# FoodBridge mock platform — `v5`

The working cut. Opened 29 August 2026 from the `v3` freeze, unchanged from it at the
moment it was copied: the whole platform — sidebar, routing, 26 destinations across 12
module repos, every screen a local copy.

Unlike `v1`–`v3` this folder is **not frozen**; it is where current work lands. Unlike
`v4` it is the full platform, not the single-screen Stock Audit cut.

**Designed for mobile first** — a 375×812 phone viewport is the reference. The inherited
desktop layout still renders.

## Run it

It needs HTTP; several screens `fetch()` their seed JSON, which browsers block on
`file://`.

```
python3 -m http.server 8004 --directory v5
```

Or `./serve.sh` from this folder, or the `foodbridge-v5` config in
[`.claude/launch.json`](../.claude/launch.json). Then open <http://localhost:8004/>.

## What is in here, and where it came from

[`VERSION.md`](VERSION.md) — the `v5` header first, then `v3`'s full release record kept
verbatim as the description of this baseline: what each screen is, which repo it was
crawled from, what still reaches the network, and the defects inherited with it.

The repo-level [`README`](../README.md) covers the live shell at `/` and the frozen
versions beside this one.

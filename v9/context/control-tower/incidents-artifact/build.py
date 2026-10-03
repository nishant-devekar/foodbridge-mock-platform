#!/usr/bin/env python3
"""Build the incident-engine artifact from its twin markdown.

    python3 v7/context/control-tower/incidents-artifact/build.py

Reads  ../CONTROL_TOWER_INCIDENTS.md   (the source of truth)
       template.html                   (look, sketches, catalogue UI)
Writes ../CONTROL_TOWER_INCIDENTS.html (what gets published as the artifact)

The page is the markdown, rendered: every word on it comes from the .md, so the
two cannot drift. Three markers in the .md swap a block for a live component:
  <!-- fig:loop -->      the next mermaid block  -> the loop strip
  <!-- fig:catalog -->   the next table          -> the filterable catalogue
  <!-- fig:sketches -->  the scenarios up to --- -> the phone player
  <!-- fig:actions -->   the ### actions up to ---  -> the action-flow player
Other mermaid blocks stay mermaid (the artifact renders them natively).
No dependencies: a small markdown subset, the one this file uses.
"""
import html
import json
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent
MD = HERE.parent / "CONTROL_TOWER_INCIDENTS.md"
OUT = HERE.parent / "CONTROL_TOWER_INCIDENTS.html"
TEMPLATE = HERE / "template.html"


def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![*\w])\*([^*\n]+)\*(?![*\w])", r"<em>\1</em>", s)
    return s


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", re.sub(r"^\d+\.\s*", "", s.lower())).strip("-")


def tokens(text):
    lines = text.split("\n")
    out, i = [], 0
    starts = re.compile(r"^(#{1,3} |```|---$|> |\||\d+\. |- |<!-- fig:)")
    while i < len(lines):
        ln = lines[i]
        if not ln.strip():
            i += 1
            continue
        m = re.match(r"<!-- fig:(\w+) -->", ln)
        if m:
            out.append(("fig", m.group(1)))
            i += 1
        elif ln.startswith("```"):
            lang, body = ln[3:].strip(), []
            i += 1
            while not lines[i].startswith("```"):
                body.append(lines[i])
                i += 1
            out.append(("code", lang, "\n".join(body)))
            i += 1
        elif ln.startswith("#"):
            lvl = len(ln) - len(ln.lstrip("#"))
            out.append(("h", lvl, ln[lvl:].strip()))
            i += 1
        elif ln.strip() == "---":
            out.append(("hr",))
            i += 1
        elif ln.startswith("> "):
            body = []
            while i < len(lines) and lines[i].startswith(">"):
                body.append(lines[i][1:].strip())
                i += 1
            out.append(("quote", " ".join(body)))
        elif ln.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            out.append(("table", rows[0], rows[2:]))
        elif re.match(r"\d+\. |- ", ln):
            ordered = bool(re.match(r"\d+\. ", ln))
            items = []
            while i < len(lines) and (re.match(r"\d+\. |- ", lines[i]) or lines[i].startswith("  ")):
                if re.match(r"\d+\. |- ", lines[i]):
                    items.append(re.sub(r"^(\d+\. |- )", "", lines[i]))
                else:
                    items[-1] += " " + lines[i].strip()
                i += 1
            out.append(("list", ordered, items))
        else:
            body = []
            while i < len(lines) and lines[i].strip() and not starts.match(lines[i]):
                body.append(lines[i].strip())
                i += 1
            out.append(("p", " ".join(body)))
    return out


def table_html(head, rows):
    th = "".join("<th>%s</th>" % inline(h) for h in head)
    tr = "".join("<tr>%s</tr>" % "".join('<td data-label="%s">%s</td>' % (html.escape(head[k]), inline(c)) for k, c in enumerate(r)) for r in rows)
    return '<div class="tbl"><table><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>' % (th, tr)


def build():
    toks = tokens(MD.read_text())
    body, toc, data = [], [], {"catalog": [], "scenarios": [], "actions": []}
    title, lead, open_section, i = "", [], False, 0
    while i < len(toks):
        t = toks[i]
        kind = t[0]
        if kind == "h" and t[1] == 1:
            title = t[2]
        elif kind == "h" and t[1] == 2:
            if open_section:
                body.append("</section>")
            sid = slug(t[2])
            num = re.match(r"^(\d+)\.\s*(.*)", t[2])
            toc.append((sid, num.group(1) if num else "", num.group(2) if num else t[2]))
            body.append('<section id="%s"><h2>%s</h2>' % (sid, (('<span class="n">%s</span>' % num.group(1)) + inline(num.group(2))) if num else inline(t[2])))
            open_section = True
        elif kind == "h":
            body.append("<h3>%s</h3>" % inline(t[2]))
        elif kind == "hr":
            pass  # sections already separate the page
        elif kind == "p" and not open_section:
            lead.append("<p>%s</p>" % inline(t[1]))
        elif kind == "p":
            body.append("<p>%s</p>" % inline(t[1]))
        elif kind == "quote":
            body.append('<blockquote>%s</blockquote>' % inline(t[1]))
        elif kind == "list":
            tag = "ol" if t[1] else "ul"
            body.append("<%s>%s</%s>" % (tag, "".join("<li>%s</li>" % inline(x) for x in t[2]), tag))
        elif kind == "table":
            body.append(table_html(t[1], t[2]))
        elif kind == "code" and t[1] == "mermaid":
            body.append('<figure class="mm"><pre class="mermaid">%s</pre></figure>' % html.escape(t[2], quote=False))
        elif kind == "code":
            body.append('<pre class="code"><code>%s</code></pre>' % html.escape(t[2], quote=False))
        elif kind == "fig":
            name = t[1]
            if name == "loop":
                i += 1  # the mermaid block it stands for
                body.append('<div class="fig-loop" id="fig-loop" aria-label="The incident loop"></div>')
            elif name == "catalog":
                i += 1
                head, rows = toks[i][1], toks[i][2]
                keys = ["family", "incident", "attention", "today", "where", "starts", "red", "buttons", "closed"]
                assert len(head) == len(keys), head
                data["catalog"] = [dict(zip(keys, r)) for r in rows]
                body.append('<div class="fig-catalog" id="fig-catalog"></div>')
            elif name == "sketches":
                i += 1
                while i < len(toks) and toks[i][0] != "hr":
                    p, lst = toks[i], toks[i + 1]
                    assert p[0] == "p" and lst[0] == "list", (p, lst)
                    head = re.match(r"\*\*(.+?)\*\*", p[1]).group(1)
                    name_, _, arc = head.partition(" — ")
                    data["scenarios"].append({"title": inline(name_), "arc": inline(arc), "steps": [inline(s) for s in lst[2]]})
                    i += 2
                body.append('<div class="fig-sketches" id="fig-sketches"></div>')
                continue
            elif name == "actions":
                i += 1
                while i < len(toks) and toks[i][0] != "hr":
                    h, p, lst = toks[i], toks[i + 1], toks[i + 2]
                    assert h[0] == "h" and h[1] == 3 and p[0] == "p" and lst[0] == "list", (h, p, lst)
                    data["actions"].append({"title": h[2], "group": p[1].split(" · ")[0], "meta": inline(p[1].split(" · ", 1)[1]), "steps": [inline(s) for s in lst[2]]})
                    i += 3
                body.append('<div class="fig-actions" id="fig-actions"></div>')
                continue
        i += 1
    if open_section:
        body.append("</section>")
    toc_html = "".join('<a href="#%s"><span class="n">%s</span>%s</a>' % (s, n, html.escape(l)) for s, n, l in toc)
    page = TEMPLATE.read_text()
    page = page.replace("{{TITLE}}", inline(title)).replace("{{LEAD}}", "".join(lead)).replace("{{TOC}}", toc_html)
    page = page.replace("{{BODY}}", "\n".join(body)).replace("{{DATA}}", json.dumps(data, ensure_ascii=False).replace("</", "<\\/"))
    OUT.write_text(page)
    print("wrote", OUT.relative_to(HERE.parents[3]), "·", len(data["catalog"]), "incidents ·", len(data["actions"]), "actions ·", len(data["scenarios"]), "scenarios ·", len(page) // 1024, "KB")


if __name__ == "__main__":
    build()

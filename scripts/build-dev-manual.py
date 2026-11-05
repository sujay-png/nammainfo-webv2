"""Turns the Developer Guide markdown into a TS module for /developers-manual.

Output: src/features/manuals/content/developers-manual-content.ts
  - devManualSections: [{ id, title, html }]   one entry per "## " section
  - devManualToc:      [{ id, title, children: [{ id, title }] }]
Run: python3 scripts/build-dev-manual.py docs/developer-guide.md src/features/manuals/content/developers-manual-content.ts
(needs: pip install markdown pygments)
"""
import json
import re
import sys

import markdown
from markdown.extensions.toc import slugify

src, out = sys.argv[1], sys.argv[2]
text = open(src, encoding="utf-8").read()

# Drop the doc title and byline; the page renders its own header.
lines = text.split("\n")
while lines and not lines[0].startswith("## "):
    lines.pop(0)
text = "\n".join(lines)

# The architecture diagram is rendered by a React component instead.
text = re.sub(r"^.*embedded content: Namma Info architecture.*$", "@@ARCH@@", text, flags=re.M)
text = text.replace("&#91;", "[")

parts = re.split(r"^## ", text, flags=re.M)
sections, toc, used = [], [], set()


def uniq(slug):
    base, n = slug, 2
    while slug in used:
        slug = f"{base}-{n}"
        n += 1
    used.add(slug)
    return slug


for part in parts:
    if not part.strip():
        continue
    title, _, body = part.partition("\n")
    title = title.strip()
    sid = uniq(slugify(re.sub(r"[`*]", "", title), "-"))
    children = []

    def h3(m):
        t = m.group(1).strip()
        cid = uniq(sid + "--" + slugify(re.sub(r"[`*]", "", t), "-"))
        children.append({"id": cid, "title": re.sub(r"`", "", t)})
        return f'<h3 id="{cid}">{markdown.markdown(t)[3:-4]}</h3>'

    body = re.sub(r"^### (.+)$", h3, body, flags=re.M)
    html = markdown.markdown(
        body,
        extensions=["tables", "fenced_code", "codehilite", "sane_lists"],
        extension_configs={"codehilite": {"css_class": "hl", "guess_lang": False}},
    )
    html = html.replace("<table>", '<div class="tableWrap"><table>').replace("</table>", "</table></div>")
    html = html.replace("<p>@@ARCH@@</p>", "@@ARCH@@")
    sections.append({"id": sid, "title": re.sub(r"`", "", title), "html": html})
    toc.append({"id": sid, "title": re.sub(r"`", "", title), "children": children})

ts = (
    "/* Generated from the Namma Info Developer Guide by scripts/build-dev-manual.py from docs/developer-guide.md. Edit the guide,\n"
    "   then regenerate, rather than editing this file by hand. */\n\n"
    "export interface ManualSection { id: string; title: string; html: string }\n"
    "export interface TocEntry { id: string; title: string; children?: TocEntry[] }\n\n"
    f"export const devManualSections: ManualSection[] = {json.dumps(sections, ensure_ascii=False, indent=1)};\n\n"
    f"export const devManualToc: TocEntry[] = {json.dumps(toc, ensure_ascii=False, indent=1)};\n"
)
open(out, "w", encoding="utf-8").write(ts)
print(len(sections), "sections,", sum(len(t["children"]) for t in toc), "subsections")

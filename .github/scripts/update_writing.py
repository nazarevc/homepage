"""Rewrite the Writing section of index.html from the Robot Wave feed.

Usage: python3 update_writing.py index.html
Keeps the latest 3 essays and the latest 3 AI Waves issues.
Exits without writing if the feed does not give 3 of each.
"""
import html
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

FEED = "https://robotwave.nazare.io/feed"
COUNT = 3


def fetch_items():
    req = urllib.request.Request(FEED, headers={"User-Agent": "nazare-site-updater"})
    root = ET.fromstring(urllib.request.urlopen(req, timeout=30).read())
    essays, waves = [], []
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub = item.findtext("pubDate")
        if not (title and link and pub):
            continue
        when = parsedate_to_datetime(pub)
        title = re.sub(r"\s*[–—]\s*", ", ", title)  # no em or en dashes on the site
        issue = re.match(r"AI Waves\s*#\s*(\d+)\s*:?\s*(.*)", title, re.I)
        if issue:
            waves.append((when, f"#{issue.group(1)}: {issue.group(2).strip()}", link))
        else:
            essays.append((when, title, link))
    essays.sort(key=lambda x: x[0], reverse=True)
    waves.sort(key=lambda x: x[0], reverse=True)
    return essays[:COUNT], waves[:COUNT]


def render(items):
    out = []
    for when, title, link in items:
        date = f"{when:%b} {when.day}, {when.year}"
        out.append(
            f'          <a class="witem" href="{html.escape(link)}" target="_blank" rel="noopener">\n'
            f'            <div class="wtitle-group">\n'
            f'              <span class="wtitle">{html.escape(title, quote=False)}</span>\n'
            f'              <span class="warrow">↗</span>\n'
            f'            </div>\n'
            f'            <span class="wdate">{date}</span>\n'
            f'          </a>'
        )
    return "\n".join(out)


def replace_block(page, name, body):
    pattern = re.compile(
        rf"(<!-- writing:{name} -->\n).*?(\n\s*<!-- /writing:{name} -->)", re.S
    )
    if not pattern.search(page):
        sys.exit(f"marker writing:{name} not found")
    return pattern.sub(lambda m: m.group(1) + body + m.group(2), page, count=1)


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "index.html"
    essays, waves = fetch_items()
    if len(essays) < COUNT or len(waves) < COUNT:
        sys.exit(f"feed gave {len(essays)} essays and {len(waves)} AI Waves; not updating")
    page = open(path, encoding="utf-8").read()
    new = replace_block(page, "essays", render(essays))
    new = replace_block(new, "aiwaves", render(waves))
    if new != page:
        open(path, "w", encoding="utf-8").write(new)
        print("updated")
    else:
        print("no change")


if __name__ == "__main__":
    main()

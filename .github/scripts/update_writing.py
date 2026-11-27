"""Refresh the Writing lists on nazare.io from the Robot Wave feed.

Usage: python3 update_writing.py index.html

1. Home page (index.html). Keeps the latest 3 essays and the latest 3 AI Waves
   issues. Exits without writing if the feed does not give 3 of each.
2. Archive (writing/posts.json and writing/index.html, beside index.html).
   Adds each feed post the archive does not hold, then redraws the list.
   The feed holds only the latest 20 posts, so posts.json is the full record.
   Posts already in posts.json are never changed; edit that file by hand.

python3 update_writing.py --rebuild-archive index.html
   Redraws writing/index.html from posts.json. Does not read the feed.
"""
import datetime
import html
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

FEED = "https://robotwave.nazare.io/feed"
COUNT = 3
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()

# "AI Waves #034: Title", "AI Waves 13: Title", "AI Waves #020 — Title", "AI Waves #15 Title"
ISSUE = re.compile(r"AI\s*Waves\s*#?\s*(\d+)\s*(?:--|[:.\-–—|])?\s*(.*)", re.I | re.S)
ESSAY_PREFIX = re.compile(r"^Robot\s*wave\s*#\s*\d+\s*:\s*", re.I)
EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿️‍]")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "nazare-site-updater"})
    return urllib.request.urlopen(req, timeout=30).read()


def tidy(text):
    """Site style for titles: no emoji, no em or en dashes, single spaces."""
    text = EMOJI.sub("", text)
    text = re.sub(r"(\d)\s*[–—]\s*(\d)", r"\1-\2", text)  # number ranges keep a hyphen
    text = re.sub(r"\s*[–—]\s*", ", ", text)
    return re.sub(r"\s+", " ", text).strip()


def classify(raw):
    """Return (series, issue, title). series is 'aiwaves' or 'essay'; issue keeps the feed's digits."""
    raw = raw.strip()
    m = ISSUE.match(raw)
    if m:
        return "aiwaves", m.group(1), tidy(m.group(2))
    return "essay", None, tidy(ESSAY_PREFIX.sub("", raw))  # drop issue-number prefix on essays


def complete(raw, link):
    """A title that ends in a comma continues in the post's subtitle. Ask the post for the full line."""
    if not raw.rstrip().endswith(","):
        return raw
    try:
        origin, slug = link.rstrip("/").split("/p/", 1)
        full = (json.loads(get(f"{origin}/api/v1/posts/{slug}")).get("social_title") or "").strip()
        if full.startswith(raw.strip()):
            return full
    except Exception:
        pass
    return raw


def fetch_items():
    root = ET.fromstring(get(FEED))
    items = []
    for item in root.iter("item"):
        raw = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip().split("?")[0]
        pub = item.findtext("pubDate")
        if not (raw and link and pub):
            continue
        series, issue, title = classify(complete(raw, link))
        items.append({"when": parsedate_to_datetime(pub), "series": series, "issue": issue, "title": title, "link": link})
    items.sort(key=lambda i: i["when"], reverse=True)
    return items


# ── Home page ──

def home_lists(items):
    essays = [(i["when"], i["title"], i["link"]) for i in items if i["series"] == "essay"]
    waves = [(i["when"], f'#{i["issue"]}: {i["title"]}', i["link"]) for i in items if i["series"] == "aiwaves"]
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


# ── Archive page ──

def us_date(iso, year=True):
    y, m, d = (int(x) for x in iso.split("-"))
    return f"{MONTHS[m - 1]} {d}, {y}" if year else f"{MONTHS[m - 1]} {d}"


def sort_posts(posts):
    return sorted(posts, key=lambda p: (p["date"], p.get("issue") or 0, p["url"]), reverse=True)


def save_archive(path, data):
    lines = ",\n".join("  " + json.dumps(p, ensure_ascii=False) for p in sort_posts(data["posts"]))
    text = '{\n "updated": %s,\n "posts": [\n%s\n ]\n}\n' % (json.dumps(data["updated"]), lines)
    open(path, "w", encoding="utf-8").write(text)


def merge(data, items, today):
    have = {p["url"].rstrip("/") for p in data["posts"]}
    added = 0
    for i in items:
        if i["link"].rstrip("/") in have:
            continue
        post = {"date": f'{i["when"]:%Y-%m-%d}', "series": i["series"]}
        if i["series"] == "aiwaves":
            post["issue"] = int(i["issue"])
        post["title"] = i["title"] or f'AI Waves #{int(i["issue"])}'
        post["url"] = i["link"]
        data["posts"].append(post)
        added += 1
    if added:
        data["updated"] = today
    return added


def render_list(posts):
    out, year = [], None
    for p in posts:
        y = p["date"][:4]
        if y != year:
            if year:
                out.append("  </ul>\n</section>")
            n = sum(1 for q in posts if q["date"][:4] == y)
            out.append(f'<section class="yr">\n  <h2>{y} <span class="n">{n}</span></h2>\n  <ul class="rows">')
            year = y
        label = f'AI Waves #{p["issue"]}' if p["series"] == "aiwaves" else "Essay"
        out.append(
            f'    <li data-s="{p["series"]}"><a href="{html.escape(p["url"])}" target="_blank" rel="noopener">'
            f'<span class="d">{us_date(p["date"], False)}</span>'
            f'<span class="t">{html.escape(p["title"], quote=False)}</span>'
            f'<span class="s">{label}</span></a></li>'
        )
    if year:
        out.append("  </ul>\n</section>")
    return "\n".join(out)


def render_chips(posts):
    essays = sum(1 for p in posts if p["series"] == "essay")
    waves = sum(1 for p in posts if p["series"] == "aiwaves")
    chip = '<button type="button" class="chip{on}" data-s="{s}" aria-pressed="{p}">{label} <span class="n">{n}</span></button>'
    return "\n".join([
        chip.format(on=" on", s="all", p="true", label="All", n=len(posts)),
        chip.format(on="", s="essay", p="false", label="Essays", n=essays),
        chip.format(on="", s="aiwaves", p="false", label="AI Waves", n=waves),
    ])


def replace_mark(page, name, body):
    pattern = re.compile(rf"(<!-- archive:{name} -->).*?(<!-- /archive:{name} -->)", re.S)
    if not pattern.search(page):
        raise ValueError(f"marker archive:{name} not found")
    return pattern.sub(lambda m: m.group(1) + body + m.group(2), page, count=1)


def update_archive(home_path, items):
    base = os.path.join(os.path.dirname(os.path.abspath(home_path)), "writing")
    data_path, page_path = os.path.join(base, "posts.json"), os.path.join(base, "index.html")
    if not (os.path.exists(data_path) and os.path.exists(page_path)):
        print("archive: not present, skipped")
        return
    data = json.load(open(data_path, encoding="utf-8"))
    today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    added = merge(data, items, today)
    posts = sort_posts(data["posts"])
    page = open(page_path, encoding="utf-8").read()
    new = replace_mark(page, "list", "\n" + render_list(posts) + "\n")
    new = replace_mark(new, "chips", "\n" + render_chips(posts) + "\n")
    new = replace_mark(new, "updated", us_date(data["updated"]))
    if added:
        save_archive(data_path, data)
    if new != page:
        open(page_path, "w", encoding="utf-8").write(new)
    print(f"archive: {added} added, {len(posts)} posts")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    path = args[0] if args else "index.html"
    if "--rebuild-archive" in sys.argv:
        update_archive(path, [])
        return
    items = fetch_items()
    essays, waves = home_lists(items)
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
    try:
        update_archive(path, items)
    except Exception as err:  # the home page refresh must not depend on the archive
        print(f"::warning::archive not updated: {err}")


if __name__ == "__main__":
    main()

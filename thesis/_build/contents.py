"""Redraw the Contents list on thesis/index.html from thesis/_src/units.json.
A chapter with an HTML page (thesis/chapter-N/index.html) links there; its PDF is a secondary link.
Usage: python3 thesis/_build/contents.py <repo root>"""
import html, json, os, re, sys
root = sys.argv[1] if len(sys.argv) > 1 else '.'
T = os.path.join(root, 'thesis')
U = json.load(open(os.path.join(T, '_src', 'units.json'), encoding='utf-8'))
def page_for(u):
    if u['key'].isdigit(): d = f"chapter-{u['key']}"
    elif u['key'] == 'bib': d = 'bibliography'
    elif u['key'] in 'ABC': d = f"appendix-{u['key'].lower()}"
    else: return None
    return f'/thesis/{d}/' if os.path.exists(os.path.join(T, d, 'index.html')) else None
L = []
for u in U:
    if u['part']:
        L.append(f'    <li class="part">{html.escape(u["part"])}</li>')
    pdf = f'/thesis/chapters/{u["file"]}'
    web = page_for(u)
    href = web or pdf
    pp = f'{u["pages"]} page' + ('s' if u['pages'] != 1 else '')
    side = f'<a class="pdf" href="{pdf}">PDF</a> · {pp}' if web else f'{pp}, PDF'
    secs = ''
    if u['sections']:
        items = ''.join(
            f'\n        <li><a href="{(web + "#s" + s["n"].replace(".", "-")) if web else pdf + "#page=" + str(s["p"])}"><span class="sn">{s["n"]}</span>{html.escape(s["t"])}</a></li>'
            for s in u['sections'])
        secs = '\n      <ul class="secs">' + items + '\n      </ul>'
    L.append(f'    <li class="ch"><div class="row"><span class="n">{u["label"]}</span><a href="{href}">{html.escape(u["title"])}</a><span class="pp">{side}</span></div>{secs}\n    </li>')
new = '<ul class="toc">\n' + '\n'.join(L) + '\n  </ul>'
p = os.path.join(T, 'index.html')
s = open(p, encoding='utf-8').read()
s, n = re.subn(r'<ul class="toc">.*?\n  </ul>', lambda m: new, s, count=1, flags=re.S)
assert n == 1
done = sum(1 for u in U if page_for(u))
hint = ('Each chapter opens as a web page, with its PDF beside it.' if done == len(U) - 1 else
        'Chapters marked PDF open as a PDF until their web page is ready. Section links jump to the section.')
s = re.sub(r'<p class="hint">.*?</p>', f'<p class="hint">{hint}</p>', s, count=1)
if '.toc .pp a' not in s:
    s = s.replace('.toc .pp{', '.toc .pp a{color:var(--ink2)}\n.toc .pp a:hover{color:var(--ink)}\n.toc .pp{', 1)
open(p, 'w', encoding='utf-8').write(s)
print(f'contents: {done} units with web pages')

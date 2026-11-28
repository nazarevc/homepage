// Build the HTML edition of the thesis.
// Usage: node thesis/_build/build.mjs <repo root>   (needs `npm install katex@0.16` beside this file or globally)
// Sources: thesis/_src/chNN.txt (one per chapter), bibliography.json, units.json.
// Output: thesis/chapter-N/index.html, thesis/bibliography/index.html, thesis/katex/ (styles and fonts).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(process.argv[2] || '.');
const T = path.join(ROOT, 'thesis');
const SRC = path.join(T, '_src');
const require = createRequire(path.join(process.cwd(), 'noop.js'));
const katex = require('katex');

const MACROS = {
  '\\bx': '\\boldsymbol{x}', '\\by': '\\boldsymbol{y}', '\\bth': '\\boldsymbol{\\theta}',
  '\\bmu': '\\boldsymbol{\\mu}', '\\bv': '\\mathbf{v}', '\\bw': '\\mathbf{w}', '\\bz': '\\boldsymbol{z}',
  '\\bg': '\\boldsymbol{g}', '\\bu': '\\mathbf{u}', '\\balpha': '\\boldsymbol{\\alpha}', '\\bbeta': '\\boldsymbol{\\beta}',
  '\\E': '\\mathcal{E}',
};
const tex = (s, display) => katex.renderToString(s, { displayMode: display, macros: { ...MACROS }, throwOnError: true, strict: 'ignore', output: 'html' });

const units = JSON.parse(fs.readFileSync(path.join(SRC, 'units.json'), 'utf8'));
const bib = JSON.parse(fs.readFileSync(path.join(SRC, 'bibliography.json'), 'utf8'));
const chapterUnits = units.filter(u => /^\d+$/.test(u.key));

// ── read sources ──
function readSource(file) {
  const raw = fs.readFileSync(path.join(SRC, file), 'utf8');
  const [head, body] = raw.split(/\n---\n/);
  const meta = Object.fromEntries(head.trim().split('\n').map(l => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  return { meta, body };
}
const sources = fs.readdirSync(SRC).filter(f => /^ch\d+\.txt$/.test(f)).sort().map(readSource);
const built = new Set(sources.map(s => +s.meta.number));

// equation labels across the whole thesis, for cross-references like (2.3)
const EQ = new Map();
for (const s of sources) for (const m of s.body.matchAll(/\$\$\s*\((\d+\.\d+)\)/g)) EQ.set(m[1], +s.meta.number);

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const chHref = n => `/thesis/chapter-${n}/`;
const eqId = l => 'eq-' + l.replace('.', '-');

// ── inline markup ──
function inline(text, ctx) {
  const slots = [];
  const keep = html => `\u0000${slots.push(html) - 1}\u0000`;
  // footnotes ^[ ... ] with nested brackets
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '^' && text[i + 1] === '[') {
      let depth = 0, j = i + 1;
      for (; j < text.length; j++) { if (text[j] === '[') depth++; else if (text[j] === ']' && --depth === 0) break; }
      const n = ctx.notes.push(inline(text.slice(i + 2, j), ctx));
      out += keep(`<sup class="fn"><a href="#note-${n}" id="ref-note-${n}">${n}</a></sup>`);
      i = j;
    } else out += text[i];
  }
  text = out;
  text = text.replace(/\$([^$]+)\$/g, (_, m) => keep(tex(m, false)));
  text = text.replace(/\{p(\d+)\}/g, (_, n) => keep(`<span class="pg" id="page-${n}"></span>`));
  text = esc(text);
  text = text.replace(/'/g, '’');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // citations: [104], [29, 133, 153], [<em>e.g.,</em> 18]
  text = text.replace(/\[((?:<em>[^<]*<\/em>\s*)?)(\d+(?:,\s*\d+)*)\]/g, (_, pre, nums) =>
    `[${pre}${nums.split(/,\s*/).map(n => `<a class="cite" href="/thesis/bibliography/#ref-${n}" title="${esc(bibShort(+n))}">${n}</a>`).join(', ')}]`);
  // chapter links
  text = text.replace(/\b(Chapters?) (\d+)((?:, \d+)*)( and (\d+))?/g, (all, w, a, mid, and_, b) => {
    const link = n => (+n !== ctx.number && +n >= 1 && +n <= 12) ? `<a href="${built.has(+n) ? chHref(n) : `/thesis/chapters/${chapterUnits[+n - 1].file}`}">${n}</a>` : n;
    let s = `${w} ${link(a)}`;
    if (mid) s += mid.split(', ').map(x => x && link(x)).join(', ');
    if (and_) s += ` and ${link(b)}`;
    return s;
  });
  // equation references (2.3)
  text = text.replace(/\((\d+\.\d+)\)/g, (all, l) => EQ.has(l) ? `(<a class="eqref" href="${EQ.get(l) === ctx.number ? '' : chHref(EQ.get(l))}#${eqId(l)}">${l}</a>)` : all);
  return text.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[+i]);
}
function bibShort(n) { const e = bib[n - 1]; return e ? e.text.replace(/\s+/g, ' ').slice(0, 140) : ''; }

// ── blocks ──
function renderBody(body, ctx) {
  const blocks = body.trim().split(/\n\s*\n/);
  const html = [];
  let carry = '';
  for (let b of blocks) {
    b = b.trim();
    if (/^\{p\d+\}$/.test(b)) { carry += b; continue; }
    if (carry) { b = carry + b; carry = ''; }
    let pg = '';
    const lead = b.match(/^((?:\{p\d+\})+)/);
    if (lead && /^\{p\d+\}(#|\$\$)/.test(b)) { pg = inline(lead[1], ctx); b = b.slice(lead[1].length).trim(); }
    let m;
    if ((m = b.match(/^(#{2,3}) (.+)$/))) {
      const id = m[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      ctx.toc.push({ id, title: m[2], level: m[1].length });
      html.push(`${pg}<h${m[1].length} id="${id}">${inline(m[2], ctx)}</h${m[1].length}>`);
    } else if ((m = b.match(/^\$\$([\s\S]+?)\$\$\s*(?:\((\d+\.\d+)\))?$/))) {
      const label = m[2];
      html.push(`${pg}<div class="eq"${label ? ` id="${eqId(label)}"` : ''}><div class="m">${tex(m[1].trim(), true)}</div>${label ? `<span class="eqn">(${label})</span>` : ''}</div>`);
    } else if ((m = b.match(/^:::raw\n([\s\S]*)\n:::$/))) {
      html.push(pg + m[1]);
    } else {
      html.push(`${pg}<p>${inline(b.replace(/\s*\n\s*/g, ' '), ctx)}</p>`);
    }
  }
  return html.join('\n');
}

// ── page shell (shares the site header and tokens with /writing/) ──
const writing = fs.readFileSync(path.join(ROOT, 'writing', 'index.html'), 'utf8');
const IMGS = [...writing.matchAll(/src="(data:image\/png;base64,[A-Za-z0-9+/=]+)"/g)].map(m => m[1]);
const FAVICON = writing.match(/<link rel="icon"[^>]*href="(data:image\/png;base64,[^"]+)"/)[1];
const FONTS = writing.match(/@import url\('([^']+)'\);/)[1];
const GA = `<script async src="https://www.googletagmanager.com/gtag/js?id=G-PKQ3ER5JL9"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-PKQ3ER5JL9');</script>`;

const CSS = `@import url('${FONTS}');
:root{--plane:#05070a;--surface:#0c111c;--line:#18202e;--ink:#e8ecf0;--ink2:#9aa3ae;--accent:#3b9eda;
--serif:'Playfair Display',Georgia,serif;--font:'Manrope',system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color-scheme:dark}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-padding-top:16px}
body{margin:0;background:var(--plane);color:var(--ink);font:400 16px/1.7 var(--font);-webkit-font-smoothing:antialiased}
main{max-width:760px;margin:0 auto;padding:0 18px 56px}
a{color:var(--accent);text-decoration:none;transition:color .15s}
a:hover{color:var(--ink)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.brand{position:relative;margin:0 -18px;padding:14px 18px 26px;overflow:hidden;border-bottom:1px solid var(--line)}
.bar{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:28px;font-size:13px}
.bar img{height:17px;width:auto;display:block}
.mark{position:absolute;right:6px;top:92px;width:140px;height:auto;opacity:.09;pointer-events:none}
.kicker{position:relative;font-size:13px;color:var(--ink2);margin:0 0 8px}
h1{position:relative;font-family:var(--serif);font-weight:500;font-size:clamp(30px,7vw,44px);line-height:1.08;letter-spacing:-.02em;margin:0 0 12px;text-wrap:balance}
.meta{position:relative;font-size:13px;color:var(--ink2);margin:0}
.jump{font-size:13px;margin:18px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:4px 14px}
article{margin-top:8px}
article p{margin:0 0 1em;text-wrap:pretty}
article em{padding-right:.12em}
article h2{font:500 21px/1.3 var(--font);margin:2em 0 .6em;text-wrap:balance}
article h3{font:500 17px/1.35 var(--font);margin:1.8em 0 .5em;text-wrap:balance}
.eq{display:grid;grid-template-columns:1fr auto;align-items:center;gap:12px;margin:.4em 0 1.1em}
.eq .m{overflow-x:auto;overflow-y:hidden;min-width:0;padding:2px 0}
.eq .katex-display{margin:0}
.eqn{font-size:14px;color:var(--ink2);white-space:nowrap}
.katex{font-size:1.08em}
.cite,.eqref{white-space:nowrap}
.fn{font-size:.72em;line-height:0}
.pg{scroll-margin-top:16px}
.notes{margin-top:2.4em;border-top:1px solid var(--line);padding-top:12px;font-size:14px;color:var(--ink2)}
.notes h2{font:500 15px/1.3 var(--font);color:var(--ink);margin:0 0 8px}
.notes ol{margin:0;padding-left:20px}
.notes li{margin:0 0 6px}
.pn{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:40px;border-top:1px solid var(--line);padding-top:16px;font-size:14px}
.pn a{display:block;padding:10px 12px;border:1px solid var(--line);border-radius:8px;color:var(--ink);transition:border-color .15s}
.pn a:hover{border-color:var(--accent)}
.pn .k{display:block;font-size:12px;color:var(--ink2)}
.pn .next{text-align:right;grid-column:2}
.foot{font-size:13px;color:var(--ink2);margin-top:32px;border-top:1px solid var(--line);padding-top:14px}
.foot p{margin:0 0 6px}
.foot .links a{margin-right:14px}
.bib{list-style:none;margin:16px 0 0;padding:0}
.bib li{display:grid;grid-template-columns:44px 1fr;gap:0 8px;padding:8px 0;border-bottom:1px solid var(--line);font-size:14px;scroll-margin-top:16px}
.bib li:target{background:var(--surface)}
.bib .n{color:var(--ink2);text-align:right}
@media(min-width:760px){.mark{top:70px;width:260px}}
@media(max-width:520px){.eq{grid-template-columns:1fr}.eqn{justify-self:end;margin-top:-6px}}`;

function shell({ title, desc, url, body }) {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="https://nazare.io${url}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://nazare.io${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="https://nazare.io/og-image.png?v=2">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="${FAVICON}">
<link rel="apple-touch-icon" href="https://nazare.io/apple-touch-icon.png">
<link rel="stylesheet" href="/thesis/katex/katex.min.css">
${GA}
<style>
${CSS}
</style>
</head>
<body>
<main>
${body}
<footer class="foot">
  <p>From <a href="/thesis/">Classification and Regression using Mixtures of Experts</a>, Steven Waterhouse, PhD thesis, University of Cambridge, 1997.</p>
  <p class="links"><a href="/thesis/">Thesis contents</a><a href="/writing/">Writing</a><a href="https://nazare.io">nazare.io</a></p>
  <p>© 2026 Nazaré Ventures</p>
</footer>
</main>
</body>
</html>
`;
}
const header = (kicker, h1, meta, extra = '') => `<div class="brand">
  <div class="bar"><a href="https://nazare.io" aria-label="Nazaré Ventures home"><img src="${IMGS[0]}" alt="nazaré" width="75" height="17"></a><a href="/thesis/#contents">Thesis contents</a></div>
  <img class="mark" src="${IMGS[1]}" alt="" width="480" height="144">
  <p class="kicker">${kicker}</p>
  <h1>${h1}</h1>
  <p class="meta">${meta}</p>${extra}
</div>`;

// ── chapters ──
const order = [...chapterUnits.map(u => ({ href: chHref(u.key), label: `Chapter ${u.key}`, title: u.title, n: +u.key }))];
const navTarget = i => {
  const t = order[i];
  if (!t) return null;
  return built.has(t.n) ? t : { ...t, href: `/thesis/chapters/${chapterUnits[i].file}`, pdf: true };
};
for (const s of sources) {
  const n = +s.meta.number, unit = chapterUnits.find(u => +u.key === n), i = chapterUnits.indexOf(unit);
  const ctx = { number: n, notes: [], toc: [] };
  const content = renderBody(s.body, ctx);
  const first = +s.meta.first_page, last = first + unit.pages - 1 - (unit.part ? 1 : 0);
  const jumps = ctx.toc.length >= 3 ? `\n  <ul class="jump">${ctx.toc.map(t => `<li><a href="#${t.id}">${esc(t.title)}</a></li>`).join('')}</ul>` : '';
  const notes = ctx.notes.length ? `\n<section class="notes"><h2>Notes</h2><ol>${ctx.notes.map((t, k) => `<li id="note-${k + 1}">${t} <a href="#ref-note-${k + 1}" aria-label="Back to text">↩</a></li>`).join('')}</ol></section>` : '';
  const prev = navTarget(i - 1), next = navTarget(i + 1);
  const pn = `\n<nav class="pn" aria-label="Chapters">${prev ? `<a class="prev" href="${prev.href}"><span class="k">Previous: ${prev.label}${prev.pdf ? ' (PDF)' : ''}</span>${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a class="next" href="${next.href}"><span class="k">Next: ${next.label}${next.pdf ? ' (PDF)' : ''}</span>${esc(next.title)}</a>` : ''}</nav>`;
  const body = header(`Chapter ${n}${unit.part ? ` · ${esc(unit.part.split(':')[0])}` : ''}`, esc(s.meta.title),
    `Pages ${first} to ${last} of the thesis. <a href="/thesis/chapters/${unit.file}">PDF of this chapter</a>`, jumps)
    + `\n<article>\n${content}\n</article>${notes}${pn}`;
  const dir = path.join(T, `chapter-${n}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), shell({
    title: `Chapter ${n}: ${s.meta.title} | Waterhouse, Mixtures of Experts (1997)`,
    desc: `Chapter ${n}, ${s.meta.title}, of Steven Waterhouse's 1997 Cambridge PhD thesis on mixtures of experts.`,
    url: `/thesis/chapter-${n}/`, body }));
  console.log(`chapter ${n}: ${ctx.notes.length} notes, ${(content.match(/class="eq"/g) || []).length} equations`);
}

// ── bibliography ──
{
  const items = bib.map(e => {
    let t = esc(e.text).replace(/(cam\.ac\.uk\/) (\w)/g, '$1~$2');
    t = t.replace(/ URL: (\S+)/, ' URL: <span class="url">$1</span>');
    t = t.replace(/\[(\d+)\](?!,? ?\d{4})/g, (all, n) => (+n >= 1 && +n <= bib.length && !/\[\d{4}/.test(all)) ? `[<a href="#ref-${n}">${n}</a>]` : all);
    return `<li id="ref-${e.n}"><span class="n">[${e.n}]</span><span>${t}</span></li>`;
  }).join('\n');
  const body = header('Bibliography', 'Bibliography', `${bib.length} references. Pages 179 to 198 of the thesis. <a href="/thesis/chapters/bibliography.pdf">PDF</a>`) + `\n<ol class="bib">\n${items}\n</ol>`;
  fs.mkdirSync(path.join(T, 'bibliography'), { recursive: true });
  fs.writeFileSync(path.join(T, 'bibliography', 'index.html'), shell({
    title: 'Bibliography | Waterhouse, Mixtures of Experts (1997)', desc: 'The 259 references of Steven Waterhouse’s 1997 Cambridge PhD thesis on mixtures of experts.',
    url: '/thesis/bibliography/', body }));
}

// ── KaTeX styles and fonts ──
{
  const dist = path.dirname(require.resolve('katex/dist/katex.min.css'));
  const out = path.join(T, 'katex');
  fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });
  fs.copyFileSync(path.join(dist, 'katex.min.css'), path.join(out, 'katex.min.css'));
  for (const f of fs.readdirSync(path.join(dist, 'fonts'))) if (f.endsWith('.woff2')) fs.copyFileSync(path.join(dist, 'fonts', f), path.join(out, 'fonts', f));
  // keep only woff2 sources in the stylesheet
  const css = fs.readFileSync(path.join(out, 'katex.min.css'), 'utf8').replace(/,url\(fonts\/[^)]+\.woff\) format\("woff"\)|,url\(fonts\/[^)]+\.ttf\) format\("truetype"\)/g, '');
  fs.writeFileSync(path.join(out, 'katex.min.css'), css);
}
console.log('done');

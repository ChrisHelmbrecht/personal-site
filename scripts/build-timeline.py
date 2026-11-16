#!/usr/bin/env python3
"""Build the timeline from content/timeline/: the overview (timeline.html) and one album page per year
(timeline/1997.html), a contact sheet of every published photograph of that year.

  build-timeline.py                  build into the site (run from the repository's root)
  build-timeline.py --out DIR        build somewhere else (a copy of the site), for trying things out
  build-timeline.py --only 3         take just the newest three years
  build-timeline.py --synthetic      add made-up test years (one photo, five, thirty, 120, long captions, many
                                     years). Never into the site: needs --out

One document per year: content/timeline/1997.txt. Blocks of "key: value" lines, a blank line between blocks.
Lines beginning with # are notes. The order of the blocks is the order on the page; to change the order of the
photographs, move their blocks. Nothing else lists photographs by hand.

The first block is the year:
  year          1997
  title_en/_de  optional short title
  text_en/_de   optional short memory, shown above the contact sheet
  places        optional, separated by semicolons
  lead          id of the photograph that stands for the year on the overview. Empty: the first one
  previews      ids of two to four more for the overview, separated by commas. Empty: the next ones in order
  draft         yes: the whole year stays out

A block beginning with "photo:" is one photograph (scripts/timeline-pictures.py writes these):
  photo         its id, e.g. 1997-03. Stable: links to a photograph use it, so it is never changed
  file          the original's name, so the picture script knows it has been taken in
  size          width x height of the large web size
  caption_en/_de  optional. If only one language is there, that one is shown. Nothing is translated by machine
  alt_en/_de    what the picture shows, for people who cannot see it. Empty: "Photo 3 of 9, 1997"
  place, when   optional; "when" may be as vague as it is known ("summer", "March 1997")
  credit        who took it or holds the rights, if known
  focus         where the subject sits, for the cropped previews on the overview ("50% 30%" = centre, upper third)
  draft         yes: not shown, and its web sizes are removed from assets/timeline, so nothing of it is in the site
  note          for ourselves, never shown

A block beginning with "chapter:" starts a chapter; the photographs after it belong to it until the next one:
  chapter       a short key (tenerife)
  title_en/_de, text_en/_de   its heading and optional short text

To add photographs: put the originals into their year's folder, run scripts/timeline-pictures.py <folder>,
then this script, and commit. A new year needs nothing more than its folder.
"""
import sys, os, re, json, html, glob, argparse

ap = argparse.ArgumentParser(); ap.add_argument('--out', default='.'); ap.add_argument('--only', type=int); ap.add_argument('--synthetic', action='store_true')
A = ap.parse_args()
OUT = A.out
assert not (A.synthetic and os.path.abspath(OUT) == os.path.abspath('.')), 'test years never go into the site: use --out'

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from siteconf import SITE, NAME, ME, OG, NOSCRIPT, person, crumbs, ld      # the site's address and name live in scripts/siteconf.py
LANGS = ('en',)                               # 'de' joins when the whole site gets its language switch; the German labels are ready below
NEWEST_FIRST = True                           # the order of the years on the overview. False: oldest first. The documents stay as they are
PREVIEWS = 4                                  # photographs beside the lead photograph on the overview, at most
EAGER = 8                                     # photographs of an album fetched at once; the rest when they come near
PLACEHOLDERS = (2008, 2026)                   # years in this span that have no photographs yet are shown as empty frames
                                              # ("Photos to come"). None: only years with photographs appear, as it is meant in the end
DOCS, PICS = 'content/timeline', 'assets/timeline'

T = {
 'en': dict(nav='Timeline', h1='A life in frames.', lead='Munich, New York, Tenerife, Moscow and back. The <a href="bio.html">bio</a> tells the story. Here are the pictures.',
            sum_='{n} photographs · {y} years', n1='1 photo', nn='{n} photos', open='Open year', open_aria='Open {y}: {c}', soon='Photos to come',
            choose='Choose year', years='Years', decade='{d}s', back='Back to timeline', prev_year='Earlier year', next_year='Later year',
            photo='Photo {a} of {n}, {y}', large='Photo {a} of {n}, open large', desc='Timeline: {n} photographs from {y} years. Chris Helmbrecht, DJ, author of Fucking Moskau and brand consultant in Munich.',
            desc_year='{y}: {c}. From the timeline of Chris Helmbrecht.', dialog='Photo, large', close='Close', prev='Previous photo', next='Next photo',
            zoom_in='Full size', zoom_out='Fit to window', count='{a} / {n}', end='That was {y}.', again='View again', onward='On to {y}', album='Back to the album',
            failed='This photo did not load.', retry='Try again', by='Photo: {c}'),
 'de': dict(nav='Timeline', h1='Ein Leben in Bildern.', lead='München, New York, Teneriffa, Moskau und zurück. Die <a href="bio.html">Bio</a> erzählt den Weg. Hier sind die Bilder.',
            sum_='{n} Fotos · {y} Jahre', n1='1 Foto', nn='{n} Fotos', open='Jahr öffnen', open_aria='{y} öffnen: {c}', soon='Fotos folgen',
            choose='Jahr wählen', years='Jahre', decade='{d}er', back='Zur Timeline', prev_year='Früheres Jahr', next_year='Späteres Jahr',
            photo='Foto {a} von {n}, {y}', large='Foto {a} von {n}, groß öffnen', desc='Timeline: {n} Fotos aus {y} Jahren. Chris Helmbrecht, DJ, Autor von Fucking Moskau und Markenberater in München.',
            desc_year='{y}: {c}. Aus der Timeline von Chris Helmbrecht.', dialog='Foto, groß', close='Schließen', prev='Vorheriges Foto', next='Nächstes Foto',
            zoom_in='Volle Größe', zoom_out='Ins Fenster einpassen', count='{a} / {n}', end='Das war {y}.', again='Noch einmal ansehen', onward='Weiter zu {y}', album='Zurück zum Album',
            failed='Dieses Foto konnte nicht geladen werden.', retry='Noch einmal versuchen', by='Foto: {c}'),
}
JS_LABELS = ('close', 'prev', 'next', 'zoom_in', 'zoom_out', 'count', 'end', 'again', 'onward', 'album', 'failed', 'retry', 'by', 'choose')

esc = lambda s: html.escape(str(s), quote=True)
yes = lambda v: str(v or '').strip().lower() in ('yes', 'true', '1', 'ja')


# ---------------------------------------------------------------- reading the documents
def blocks(text):
    for raw in re.split(r'\n\s*\n', text):
        d, first = {}, None
        for line in raw.splitlines():
            if not line.strip() or line.lstrip().startswith('#') or ':' not in line: continue
            k, v = line.split(':', 1); k = k.strip().lower(); d[k] = v.strip()
            first = first or k
        if d: yield first, d


def read(path):
    year, items = None, []
    for kind, d in blocks(open(path, encoding='utf-8').read()):
        if kind == 'year': year = d
        elif kind in ('photo', 'chapter'): items.append((kind, d))
    assert year and re.fullmatch(r'\d{4}', year.get('year', '')), f'{path}: the first block has to begin with "year: 1997"'
    y = dict(year=int(year['year']), raw=year, draft=yes(year.get('draft')), photos=[], parts=[], held=[])
    part = dict(chapter=None, photos=[]); y['parts'].append(part); seen = set()
    for kind, d in items:
        if kind == 'chapter':
            part = dict(chapter=d, photos=[]); y['parts'].append(part); continue
        pid = d['photo']
        assert re.fullmatch(r'[a-z0-9][a-z0-9-]*', pid), f'{path}: "{pid}" cannot be an id (small letters, digits, hyphens)'
        assert pid not in seen, f'{path}: the id {pid} is there twice'; seen.add(pid)
        if yes(d.get('draft')): y['held'].append(pid); continue
        m = re.fullmatch(r'(\d+)\s*x\s*(\d+)', d.get('size', ''))
        assert m, f'{path}: {pid} has no size (width x height)'
        p = dict(id=pid, d=d, w=int(m.group(1)), h=int(m.group(2)), base=f'{PICS}/{y["year"]}/{pid}', focus=d.get('focus') or '50% 50%')
        p['r'] = p['w'] / p['h']
        part['photos'].append(p); y['photos'].append(p)
    y['parts'] = [pt for pt in y['parts'] if pt['photos']]
    for n, p in enumerate(y['photos'], 1): p['n'] = n
    return y


years = [read(f) for f in sorted(glob.glob(f'{DOCS}/*.txt'))]

if A.synthetic:                                   # made-up years out of real pictures, to see how the pages carry 1, 5, 30 and 120 photographs
    pool = [p for y in years for p in y['photos']]
    def fake(year, n, cap=None, chapters=False):
        ps = []
        for k in range(n):
            src = pool[(year * 7 + k * 13) % len(pool)]
            d = {'caption_en': cap(k) if cap else '', 'place': 'Testville' if k % 5 == 0 else '', 'when': 'some summer' if k % 7 == 0 else '', 'credit': 'A. Tester' if k % 9 == 0 else ''}
            ps.append(dict(src, id=f'{year}-{k + 1:02d}', d=d, n=k + 1))
        parts = [dict(chapter=None, photos=ps)] if not chapters else [dict(chapter=dict(chapter=f'c{i}', title_en=f'Test chapter {i + 1}', text_en='A made-up chapter, to see how chapters sit on the sheet.' if i else ''), photos=ps[i * 6:(i + 1) * 6 if i < 3 else None]) for i in range(4)]
        return dict(year=year, raw=dict(title_en='Made-up test year' if n > 1 else '', places='Here; There' if n > 4 else '', text_en='A short made-up memory that says what this year was about, so the space above the sheet can be judged.' if n == 30 else ''), draft=False, photos=ps, parts=[pt for pt in parts if pt['photos']], held=[])
    long = lambda k: ('A caption that goes on and on, because some memories do not fit into six words and the sheet has to carry that too without falling apart, ' * 2).strip(' ,') + '.' if k % 4 == 0 else 'Short one.' if k % 3 == 0 else ''
    years += [fake(1901, 1), fake(1902, 5, long), fake(1903, 30, long, chapters=True), fake(1904, 120)] + [fake(y, 3 + y % 5) for y in range(1905, 1960)]

years = [y for y in years if not y['draft'] and y['photos']]
years.sort(key=lambda y: y['year'])
if A.only: years = years[-A.only:]
have = {y['year'] for y in years}
gaps = [n for n in range(PLACEHOLDERS[0], PLACEHOLDERS[1] + 1) if n not in have] if PLACEHOLDERS and not A.only else []
for i, y in enumerate(years):
    y['before'] = years[i - 1]['year'] if i else None
    y['after'] = years[i + 1]['year'] if i + 1 < len(years) else None


def said(d, key, lang):                           # the text in this language, else in the other one, with the language it is in
    other = 'de' if lang == 'en' else 'en'
    if d.get(f'{key}_{lang}'): return d[f'{key}_{lang}'], lang
    if d.get(f'{key}_{other}'): return d[f'{key}_{other}'], other
    return '', lang


def span(text, l, lang, tag='span', cls=''):
    return f'<{tag}{f" class=\"{cls}\"" if cls else ""}{f" lang=\"{l}\"" if l != lang else ""}>{esc(text)}</{tag}>' if text else ''


def count(n, lang): return T[lang]['n1'] if n == 1 else T[lang]['nn'].format(n=n)
def album(year, lang): return f"timeline/{'de/' if lang == 'de' else ''}{year}.html"
def home(lang): return 'timeline.html' if lang == 'en' else 'timeline/de/index.html'
def up(path): return '../' * path.count('/')
def alt(p, y, lang): return said(p['d'], 'alt', lang)[0] or T[lang]['photo'].format(a=p['n'], n=len(y['photos']), y=y['year'])


def img(p, y, lang, tall, eager=False, cls=''):
    """A picture by its row height: the small size for ordinary screens, the middle one for sharp ones."""
    ws, wm = round(320 * p['r']), round(640 * p['r'])
    return (f'<img{f" class=\"{cls}\"" if cls else ""} src="{p["base"]}-s.webp" srcset="{p["base"]}-s.webp {ws}w, {p["base"]}-m.webp {wm}w" sizes="{round(tall * p["r"])}px" '
            f'width="{ws}" height="320" alt="{esc(alt(p, y, lang))}" {"fetchpriority=\"high\"" if eager else "loading=\"lazy\""} decoding="async" style="object-position:{esc(p["focus"])}">')


def picker(lang, here=None, to_album=False):
    """The years by decade: a rail beside the overview on a wide screen, a "Choose year" list everywhere else."""
    t, every = T[lang], sorted(have | set(gaps), reverse=NEWEST_FIRST)
    decades = []
    for n in every:
        if not decades or decades[-1][0] != n // 10 * 10: decades.append((n // 10 * 10, []))
        decades[-1][1].append(n)
    link = (lambda n: album(n, lang)) if to_album else (lambda n: f'{home(lang)}#{n}' if here is not None else f'#{n}')
    out = []
    for dec, ns in decades:
        real = [n for n in ns if n in have] if to_album else ns
        if not real: continue
        lis = ''.join(f'<li><a href="{link(n)}"{" class=\"soon\"" if n not in have else ""}{" aria-current=\"page\"" if n == here else ""} data-year="{n}">{n}</a></li>' for n in real)
        out.append(f'<li class="dec" data-decade="{dec}"><a class="dec-a" href="{link(real[0])}">{t["decade"].format(d=dec)}</a><ol>{lis}</ol></li>')
    return f'<details class="tl-pick" id="tl-pick"><summary>{t["choose"]}</summary><nav aria-label="{t["years"]}"><ol class="decades">{"".join(out)}</ol></nav></details>'


def page(path, lang, title, desc, body, head=''):
    b = up(path)
    doc = f'''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
{f'<base href="{b}">' if b else ''}
<meta name="description" content="{esc(desc)}">
<meta name="author" content="{NAME}">
<link rel="canonical" href="{SITE}/{path}">
<meta property="og:site_name" content="{NAME}">
<meta property="og:type" content="website">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{SITE}/{path}">
<meta name="twitter:card" content="summary_large_image">
{head}<link rel="icon" href="favicon.ico" sizes="48x48">
<link rel="icon" href="assets/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/icon-180.png">
<!--page-->
<title>{esc(title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#d6d9d6">
<link rel="stylesheet" href="css/site.css">
<link rel="stylesheet" href="css/timeline.css">
{NOSCRIPT}
{body}
<script src="js/site.js"></script>
<script src="js/timeline.js"></script>
<!--/page-->
</body>
</html>
'''
    doc = re.sub(r'\n{2,}', '\n', doc)
    full = os.path.join(OUT, path); os.makedirs(os.path.dirname(full) or '.', exist_ok=True)
    open(full, 'w', encoding='utf-8').write(doc)


# ---------------------------------------------------------------- the overview
def group(y, lang, first):
    t, raw, ps = T[lang], y['raw'], y['photos']
    by_id = {p['id']: p for p in ps}
    lead = by_id.get(raw.get('lead', '').strip()) or ps[0]
    chosen = [by_id[i.strip()] for i in raw.get('previews', '').split(',') if i.strip() in by_id and by_id[i.strip()] is not lead]
    rest = chosen or [p for p in ps if p is not lead]
    more = rest[:PREVIEWS if len(rest) != 3 else 2] if len(rest) > 1 else rest[:1]        # one, two or four beside the lead: three would leave a hole in the stack
    title, tl = said(raw, 'title', lang)
    places = [s.strip() for s in raw.get('places', '').split(';') if s.strip()]
    c, href = count(len(ps), lang), album(y['year'], lang)
    pics = f'<a class="yr-lead" href="{href}#p-{lead["id"]}" style="--r:{lead["r"]:.4f}">{img(lead, y, lang, 300, first)}</a>'
    if more: pics += f'<span class="yr-more n{len(more)}">' + ''.join(f'<a class="yr-pre" href="{href}#p-{p["id"]}">{img(p, y, lang, 150)}</a>' for p in more) + '</span>'
    return (f'<li class="yr" id="{y["year"]}" data-year="{y["year"]}"><div class="yr-facts"><h2 class="yr-no"><a href="{href}" aria-label="{esc(t["open_aria"].format(y=y["year"], c=c))}">{y["year"]}</a></h2>'
            f'{span(title, tl, lang, "p", "yr-title")}{f"<p class=\"tag yr-places\">{esc(" · ".join(places))}</p>" if places else ""}'
            f'<p class="tag yr-count">{c}</p><a class="yr-open" href="{href}">{t["open"]}<span class="sr"> {y["year"]}</span></a></div><div class="yr-pics">{pics}</div></li>')


def overview(lang):
    t = T[lang]
    rows = {y['year']: y for y in years}
    order = sorted(have | set(gaps), reverse=NEWEST_FIRST)
    first = next((n for n in order if n in have), None)
    lis = ''.join(group(rows[n], lang, n == first) if n in rows else f'<li class="yr empty" id="{n}" data-year="{n}"><div class="yr-facts"><h2 class="yr-no">{n}</h2></div><div class="yr-pics"><span class="yr-soon tag">{t["soon"]}</span></div></li>' for n in order)
    total = sum(len(y['photos']) for y in years)
    body = f'''<main class="page tl" id="tl" data-lang="{lang}">
  <a class="back" href="index.html" aria-label="Back to the skull"><img src="assets/skull-thumb.webp" alt="" width="252" height="252"></a>
  <article class="room tl-room">
    <header class="tl-head"><span class="tag">{t["nav"]}</span>
      <h1>{t["h1"]}</h1>
      <p class="tl-lead">{t["lead"]}</p>
      <p class="tag tl-sum">{t["sum_"].format(n=total, y=len(years))}</p>
    </header>
    <div class="tl-body">
      {picker(lang)}
      <ol class="tl-years">{lis}</ol>
    </div>
  </article>
</main>'''
    path = home(lang)
    head = f'<meta property="og:image" content="{OG}">\n' + ld({'@type': 'CollectionPage', '@id': f'{SITE}/{path}', 'url': f'{SITE}/{path}', 'name': f'{t["nav"]}: {t["h1"]}', 'description': t['desc'].format(n=total, y=len(years)), 'inLanguage': lang, 'about': {'@id': ME},
                'hasPart': [{'@type': 'ImageGallery', 'name': str(y['year']), 'url': f'{SITE}/{album(y["year"], lang)}'} for y in sorted(years, key=lambda y: -y['year'])]}, person(), crumbs((t['nav'], path))) + '\n'
    page(path, lang, f'{t["nav"]} · Chris Helmbrecht', t['desc'].format(n=total, y=len(years)), body, head)


# ---------------------------------------------------------------- one year: the contact sheet
def frame(p, y, lang, k):
    t, d, n = T[lang], p['d'], len(y['photos'])
    cap, cl = said(d, 'caption', lang)
    data = ''.join(f' data-{key}="{esc(val)}"' for key, val in (('cap', cap), ('cap-lang', cl if cap and cl != lang else ''), ('place', d.get('place', '')), ('when', d.get('when', '')), ('credit', d.get('credit', ''))) if val)
    return (f'<li class="frame" id="p-{p["id"]}" style="--r:{p["r"]:.4f};--i:{min(k, 16)}"><a href="{p["base"]}-l.webp" data-id="{p["id"]}" data-w="{p["w"]}" data-h="{p["h"]}"{data} aria-label="{esc(t["large"].format(a=p["n"], n=n))}">'
            f'{img(p, y, lang, 290, k < EAGER)}</a><p class="frame-note"><b>{p["n"]:02d}</b>{span(cap, cl, lang)}</p></li>')


def year_page(y, lang):
    t, raw, n = T[lang], y['raw'], len(y['photos'])
    title, tl = said(raw, 'title', lang); text, xl = said(raw, 'text', lang)
    places = [s.strip() for s in raw.get('places', '').split(';') if s.strip()]
    k, sheets = 0, ''
    for part in y['parts']:
        ch = part['chapter']
        if ch:
            ct, ctl = said(ch, 'title', lang); cx, cxl = said(ch, 'text', lang)
            sheets += f'<section class="chapter" id="c-{esc(ch["chapter"])}">{span(ct, ctl, lang, "h2")}{span(cx, cxl, lang, "p")}'
        sheets += '<ol class="sheet">' + ''.join(frame(p, y, lang, k + i) for i, p in enumerate(part['photos'])) + '</ol>'
        k += len(part['photos'])
        if ch: sheets += '</section>'
    step = ((f'<a rel="prev" href="{album(y["before"], lang)}" aria-label="{t["prev_year"]}: {y["before"]}">← {y["before"]}</a>' if y['before'] else '') +
            (f'<a rel="next" href="{album(y["after"], lang)}" aria-label="{t["next_year"]}: {y["after"]}">{y["after"]} →</a>' if y['after'] else ''))
    labels = {key: T[lang][key] for key in JS_LABELS}
    body = f'''<main class="page tl tl-album" id="tl-album" data-lang="{lang}" data-year="{y["year"]}" data-home="{home(lang)}#{y["year"]}"{f' data-after="{y["after"]}" data-after-href="{album(y["after"], lang)}"' if y["after"] else ''} data-labels="{esc(json.dumps(labels, ensure_ascii=False))}">
  <a class="back" href="index.html" aria-label="Back to the skull"><img src="assets/skull-thumb.webp" alt="" width="252" height="252"></a>
  <article class="room tl-room">
    <nav class="al-top" aria-label="{t["nav"]}"><a id="tl-home" href="{home(lang)}#{y["year"]}">← {t["back"]}</a>{picker(lang, y["year"], True)}<span class="al-step">{step}</span></nav>
    <header class="al-head"><span class="tag">{t["nav"]}</span>
      <h1 class="al-no">{y["year"]}</h1>
      {span(title, tl, lang, "p", "al-title")}
      <p class="tag al-facts">{esc(" · ".join(places + [count(n, lang)]))}</p>
      {span(text, xl, lang, "p", "al-text")}
    </header>
    {sheets}
    <nav class="al-foot" aria-label="{t["years"]}"><a href="{home(lang)}#{y["year"]}">← {t["back"]}</a><span class="al-step">{step}</span></nav>
  </article>
</main>
<dialog class="lb" id="lb" aria-label="{t["dialog"]}">
  <div class="lb-top"><strong>{y["year"]}</strong><span id="lb-count" aria-live="polite"></span><span class="lb-tools"><button id="lb-zoom" type="button" aria-pressed="false" hidden>{t["zoom_in"]}</button><button id="lb-close" type="button">{t["close"]}</button></span></div>
  <div class="lb-view" id="lb-view"><img id="lb-img" alt="" hidden><div class="lb-msg" id="lb-msg" hidden></div><div class="lb-end" id="lb-end" hidden></div></div>
  <button class="lb-arrow" id="lb-prev" type="button" aria-label="{t["prev"]}"><span aria-hidden="true">←</span></button>
  <button class="lb-arrow" id="lb-next" type="button" aria-label="{t["next"]}"><span aria-hidden="true">→</span></button>
  <div class="lb-foot"><p id="lb-cap"></p><p class="tag" id="lb-meta"></p></div>
</dialog>'''
    path = album(y['year'], lang); by_id = {p['id']: p for p in y['photos']}; lead = by_id.get(raw.get('lead', '').strip()) or y['photos'][0]
    shot = lambda p: {k: v for k, v in (('@type', 'ImageObject'), ('contentUrl', f'{SITE}/{p["base"]}-l.webp'), ('thumbnailUrl', f'{SITE}/{p["base"]}-s.webp'), ('width', p['w']), ('height', p['h']), ('caption', said(p['d'], 'caption', lang)[0]),
                                          ('contentLocation', p['d'].get('place', '')), ('creditText', p['d'].get('credit', ''))) if v}
    head = f'<meta property="og:image" content="{SITE}/{lead["base"]}-l.webp">\n' + ld({'@type': 'ImageGallery', '@id': f'{SITE}/{path}', 'url': f'{SITE}/{path}', 'name': f'{y["year"]}' + (f': {title}' if title else ''), 'description': t['desc_year'].format(y=y['year'], c=count(n, lang)),
                'inLanguage': lang, 'temporalCoverage': str(y['year']), 'about': {'@id': ME}, 'image': [shot(p) for p in y['photos']]}, person(), crumbs((t['nav'], home(lang)), (str(y['year']), path))) + '\n'
    page(path, lang, f'{y["year"]} · {t["nav"]} · Chris Helmbrecht', t['desc_year'].format(y=y['year'], c=count(n, lang)), body, head)


for lang in LANGS:
    overview(lang)
    for y in years: year_page(y, lang)

# ---------------------------------------------------------------- tidy: what is not published is not in the site
if os.path.abspath(OUT) == os.path.abspath('.') and not A.only:
    keep_pages = {album(y['year'], lang) for y in years for lang in LANGS}
    for f in glob.glob('timeline/*.html') + glob.glob('timeline/de/*.html'):
        if f.replace(os.sep, '/') not in keep_pages and not f.endswith('de/index.html'): os.remove(f); print('removed', f)
    keep = {f'{p["base"]}-{s}.webp' for y in years for p in y['photos'] for s in 'sml'}
    for f in glob.glob(f'{PICS}/*/*.webp'):
        if f.replace(os.sep, '/') not in keep: os.remove(f); print('removed', f, '(draft, or no longer in its year\'s document)')
    missing = [f for f in sorted(keep) if not os.path.exists(f)]
    if missing: print(f'{len(missing)} picture files are missing, e.g. {missing[0]}: run scripts/timeline-pictures.py with the originals')
held = sum(len(y['held']) for y in years)
print(f'{len(years)} years, {sum(len(y["photos"]) for y in years)} photographs' + (f', {held} held back as drafts' if held else '') + (f', {len(gaps)} empty years shown as placeholders' if gaps else ''))

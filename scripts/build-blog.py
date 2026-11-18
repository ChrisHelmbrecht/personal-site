#!/usr/bin/env python3
"""Build the blog from content/blog/: the overviews, one page per article, feeds, the sitemap and the redirect list.

  build-blog.py                      build into the site (run from the repository's root)
  build-blog.py --out DIR            build somewhere else (a copy of the site), for trying things out
  build-blog.py --only 6             take just the newest six articles
  build-blog.py --synthetic 100      pad the collection to a hundred with made-up test entries (never into the site:
                                     needs --out)

One document per article and language: content/blog/<date-name>/en.html and de.html. On top a few lines of
facts ("key: value"), then a line with three dashes, then the text as plain HTML (p, h2-h4, lists, blockquote,
links, tables). The folder name is the article's id and ties the two languages together.

  title       as it stands above the article
  short       optional shorter title for the floating cards; the full one stays everywhere else
  slug        the article's address: blog/<slug>.html, German ones blog/de/<slug>.html
  date        day of publication, YYYY-MM-DD; "updated" only if the text really was revised
  intro       the paragraph under the title of the article
  teaser      two or three short sentences for the preview on the overview, written to make curious. Empty: the
              preview shows the first sentences of the intro (whole sentences, never cut inside one)
  image       name of the picture in assets/blog (scripts/blog-pictures.py makes the sizes); empty: no picture
  alt, credit what the picture shows, and whose it is
  focus       where the picture's subject sits, for cropping ("50% 30%" = centre, upper third)
  categories  main categories, comma separated, from CATS below
  tags        words to be found by, separated by semicolons
  featured    yes: keep it among the floating cards even when newer articles arrive
  draft       yes: not built
  old         the article's address on the old site, for the redirect list

To publish article number 33: add its folder with en.html and/or de.html, put the picture's original through
blog-pictures.py, run this script, commit. Nothing else lists articles by hand.
"""
import sys, os, re, json, html, glob, datetime, argparse, shutil

ap = argparse.ArgumentParser(); ap.add_argument('--out', default='.'); ap.add_argument('--only', type=int); ap.add_argument('--synthetic', type=int)
A = ap.parse_args()
OUT = A.out
assert not (A.synthetic and os.path.abspath(OUT) == os.path.abspath('.')), 'test entries never go into the site: use --out'

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from siteconf import SITE, NAME, ME, OG, PLAIN, DE, TIMELINE, de, address, alternates, noscript, person, crumbs, ld      # the site's address and name live in scripts/siteconf.py
EXPLORE, FRESH, PER_PAGE = 7, 3, 12           # floating cards at most; of those, places kept for the newest; articles per archive page
# EXPLORE can go down, not up: the arrangement (js/blog.js "chosen", css/blog.css ".drift-col") has seven places, one large, two middle,
# four small. More cards need new places there first. A growing blog grows in the archive, not here.
assert EXPLORE <= 7, 'Explore has seven places (see the note above EXPLORE); more cards need the arrangement in js/blog.js and css/blog.css extended first'
TOC_FROM = 4                                  # a table of contents from this many headings on
CATS = {'politics': ('Politics', 'Politik'), 'economy': ('Economy', 'Wirtschaft'), 'geopolitics': ('Geopolitics', 'Geopolitik'),
        'germany': ('Germany', 'Deutschland'), 'society': ('Culture & Society', 'Kultur & Gesellschaft')}
MONTHS = dict(en='January February March April May June July August September October November December'.split(),
              de='Januar Februar März April Mai Juni Juli August September Oktober November Dezember'.split())
T = dict(
    en=dict(blog='Blog', name='Food for thought', desc='Food for thought: essays by Chris Helmbrecht on politics, the economy, geopolitics, Germany, culture and society.',
            explore='Explore', archive='Archive', pause='Pause motion', play='Resume motion', all_n='All {n} articles in the archive', search='Search',
            search_scope='Titles, intros and tags', clear='Clear', cats='Category', all='All', sort='Order', newest='Newest first', oldest='Oldest first',
            intro='Intro', read='Read article', close='Close', back='Food for thought', others='Other articles', all_articles='All articles', more='More food for thought',
            contents='Contents', picture='Picture', empty='No article matches.', reset='Reset filters', pages='Pages', prev='Previous', next='Next',
            count_1='1 article', count_n='{n} articles', of='{a}–{b} of {n}', other_lang='Deutsch', this_lang='English', lang_label='Language', view='View',
            updated='Updated', skull='Back to the skull', feed='Food for thought (English)', preview='Preview', lead='Newest thought', picked='Personally selected', mins='{n} min read'),
    de=dict(blog='Blog', name='Food for thought', desc='Food for thought: Texte von Chris Helmbrecht über Politik, Wirtschaft, Geopolitik, Deutschland, Kultur und Gesellschaft.',
            explore='Entdecken', archive='Archiv', pause='Bewegung pausieren', play='Bewegung fortsetzen', all_n='Alle {n} Artikel im Archiv', search='Suche',
            search_scope='Titel, Intros und Schlagwörter', clear='Leeren', cats='Kategorie', all='Alle', sort='Reihenfolge', newest='Neueste zuerst', oldest='Älteste zuerst',
            intro='Intro', read='Artikel lesen', close='Schließen', back='Zur Blogübersicht', others='Andere Artikel', all_articles='Alle Artikel', more='Weitere Gedanken',
            contents='Inhalt', picture='Bild', empty='Kein Artikel passt.', reset='Filter zurücksetzen', pages='Seiten', prev='Zurück', next='Weiter',
            count_1='1 Artikel', count_n='{n} Artikel', of='{a}–{b} von {n}', other_lang='English', this_lang='Deutsch', lang_label='Sprache', view='Ansicht',
            updated='Aktualisiert', skull='Zurück zum Schädel', feed='Food for thought (Deutsch)', preview='Vorschau', lead='Neuester Gedanke', picked='Persönlich ausgewählt', mins='{n} Min. Lesezeit'))
T['en']['back'] = 'All articles'
esc = lambda s: html.escape(s, True)
pics = json.load(open('assets/blog/pictures.json')) if os.path.exists('assets/blog/pictures.json') else {}


def day(d, lang):
    y, m, dd = (int(x) for x in d.split('-'))
    return f'{dd}. {MONTHS[lang][m - 1]} {y}' if lang == 'de' else f'{dd} {MONTHS[lang][m - 1]} {y}'


SHORT = r'(?:Dr|Mr|Mrs|Ms|St|vs|etc|e\.g|i\.e|z\.\s?B|u\.\s?a|bzw|ca|Nr|No|Prof|U\.S|Jan|Feb|Aug|Sept|Okt|Oct|Nov|Dez|Dec)'


def sentences(t):
    """whole sentences of a text. A full stop after an abbreviation, an initial or a number is no end"""
    out, start = [], 0
    for m in re.finditer(r'[.!?][”"’)]?\s+(?=[A-ZÄÖÜ„“"‘(0-9])', t):
        head = t[start:m.start() + 1]
        if re.search(SHORT + r'\.$', head) or re.search(r'(?:^|\s)(?:[A-ZÄÖÜ]|\d{1,2})\.$', head): continue
        out.append(t[start:m.end()].strip()); start = m.end()
    if t[start:].strip(): out.append(t[start:].strip())
    return out


def brief(t, most):
    """a text no longer than most, ending where a sentence ends; failing that at a word, with an ellipsis"""
    if len(t) <= most: return t
    keep = ''
    for sn in sentences(t):
        if len(keep) + len(sn) + 1 > most: break
        keep = (keep + ' ' + sn).strip()
    if len(keep) >= most * .45: return keep
    return t[:most].rsplit(' ', 1)[0].rstrip(',;:–— ') + ' …'


def read(path):
    head, _, body = open(path, encoding='utf-8').read().partition('\n---\n')
    d = dict((k.strip(), v.strip()) for k, v in (l.split(':', 1) for l in head.split('\n') if ':' in l))
    d['body'] = body.strip()
    d['id'] = d.get('id') or os.path.basename(os.path.dirname(path))
    d['lang'] = d.get('lang') or os.path.splitext(os.path.basename(path))[0]
    d['categories'] = [c.strip() for c in d.get('categories', '').split(',') if c.strip() in CATS]
    d['tags'] = [t.strip() for t in d.get('tags', '').split(';') if t.strip()]
    for k in ('featured', 'draft'): d[k] = d.get(k, '').lower() in ('yes', 'true', '1')
    assert re.fullmatch(r'\d{4}-\d\d-\d\d', d.get('date', '')), f'{path}: date'
    assert re.fullmatch(r'[a-z0-9-]+', d.get('slug', '')), f'{path}: slug'
    if d.get('image') not in pics: d['image'] = ''
    d['peek'] = d.get('teaser') or brief(d.get('intro', ''), 230)
    d['mins'] = max(1, round(len(re.sub(r'<[^>]+>', ' ', d['body']).split()) / 220))
    return d


posts = [read(f) for f in sorted(glob.glob('content/blog/*/*.html'))]
posts = [p for p in posts if not p['draft']]
if A.only:
    keep = sorted({p['id'] for p in posts}, reverse=True)[:A.only]; posts = [p for p in posts if p['id'] in keep]
if A.synthetic:
    base, n = list(posts), len({p['id'] for p in posts})
    for k in range(max(0, A.synthetic - n)):
        d = (datetime.date(2023, 8, 1) - datetime.timedelta(days=9 * k + 5)).isoformat()
        for lang in ('en', 'de'):
            b = base[(2 * k) % len(base)]
            title = (f'Test entry {k + 1}: ' if lang == 'en' else f'Testeintrag {k + 1}: ') + ['short', 'a headline of ordinary length for this card', 'an unusually long headline that keeps going well past the point where a headline would normally have stopped, to see how the cards cope'][k % 3]
            posts.append(dict(b, id=f'{d}-test-{k + 1}', lang=lang, slug=f'test-{k + 1}-{lang}', title=title, short='', date=d, updated='', intro=f'Made-up entry number {k + 1} for the growth test. Größe, Straße, Übermut.',
                              image='' if k % 7 == 3 else b['image'], categories=[list(CATS)[k % 5]], tags=['Test', f'T{k % 4}'], featured=False, old=''))
by = {l: sorted((p for p in posts if p['lang'] == l), key=lambda p: (p['date'], p['id']), reverse=True) for l in ('en', 'de')}
twin = {(p['id'], p['lang']): p for p in posts}
url = lambda p: f"blog/{'de/' if p['lang'] == 'de' else ''}{p['slug']}.html"
home = lambda lang: 'blog/de/index.html' if lang == 'de' else 'blog.html'
up = lambda path: '../' * path.count('/')


def picture(p, sizes, cls='', lazy=True, alt=None):
    if not p['image']:
        return f'<span class="no-pic" aria-hidden="true">{esc(p["title"][:1])}</span>'
    m = pics[p['image']]
    src = ', '.join(f"assets/blog/{p['image']}-{w}.webp {w}w" for w in m['sizes'])
    w = m['sizes'][min(1, len(m['sizes']) - 1)]
    return (f'<img{f" class={chr(34)}{cls}{chr(34)}" if cls else ""} src="assets/blog/{p["image"]}-{w}.webp" srcset="{src}" sizes="{sizes}" alt="{esc(p["alt"] if alt is None else alt)}" '
            f'width="{m["w"]}" height="{m["h"]}" style="object-position:{esc(p.get("focus") or "50% 50%")}"{" loading=lazy decoding=async" if lazy else ""}>')


def card(p, small=False):
    T_ = T[p['lang']]
    return (f'<a class="mini" href="{url(p)}"><span class="mini-pic">{picture(p, "(min-width: 700px) 240px, 45vw", alt="")}</span>'
            f'<strong>{esc(p["title"])}</strong><time datetime="{p["date"]}">{day(p["date"], p["lang"])}</time></a>')


def page(path, lang, title, desc, body, head='', cls='', scripts=True, pair=None):
    """pair: this page's address in English and in German, when it exists in both."""
    b = up(path)
    langs = alternates(*pair) if pair else '<script src="js/lang.js"></script>\n'
    twin = pair and pair[lang == 'en']
    doc = f'''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
{f'<base href="{b}">' if b else ''}
{langs}<meta name="description" content="{esc(desc)}">
<meta name="author" content="{NAME}">
<link rel="canonical" href="{SITE}/{path}">
<meta property="og:site_name" content="{NAME}">
<meta name="twitter:card" content="summary_large_image">
{head}<link rel="alternate" type="application/rss+xml" title="{esc(T[lang]['feed'])}" href="blog/{'de/' if lang == 'de' else ''}feed.xml">
<link rel="icon" href="favicon.ico" sizes="48x48">
<link rel="icon" href="assets/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/icon-180.png">
<!--page-->
<title>{esc(title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#d6d9d6">
<link rel="stylesheet" href="css/site.css">
<link rel="stylesheet" href="css/blog.css">
{noscript(lang, twin)}
{body}
<script src="js/site.js"></script>
<script src="js/blog.js"></script>
<!--/page-->
</body>
</html>
'''
    doc = re.sub(r'\n{2,}', '\n', doc)
    full = os.path.join(OUT, path); os.makedirs(os.path.dirname(full) or '.', exist_ok=True)
    open(full, 'w', encoding='utf-8').write(doc)


skull = lambda lang: de('index.html') if lang == 'de' else 'index.html'


# ---------------------------------------------------------------- the overviews
for lang, mine in by.items():
    if not mine: continue
    L, other = T[lang], 'de' if lang == 'en' else 'en'
    path = home(lang)
    used = [c for c in CATS if any(c in p['categories'] for p in mine)]
    items = []
    for p in mine:
        cats = ' '.join(p['categories'])
        items.append(f'''        <li class="entry" data-id="{esc(p['id'])}" data-date="{p['date']}" data-cats="{cats}" data-tags="{esc(' | '.join(p['tags']))}" data-mins="{p['mins']}" data-peek="{esc(p['peek'])}"{' data-featured' if p['featured'] else ''}{f' data-short="{esc(p["short"])}"' if p.get('short') else ''}>
          <a class="entry-link" href="{url(p)}"><span class="entry-pic">{picture(p, "(min-width: 1000px) 360px, (min-width: 640px) 46vw, 92vw", alt="")}</span><strong class="entry-title">{esc(p['title'])}</strong></a>
          <time datetime="{p['date']}">{day(p['date'], lang)}</time>
          <p class="entry-intro">{esc(p['intro'])}</p>
        </li>''')
    chips = ''.join(f'<button type="button" data-cat="{c}" aria-pressed="false">{esc(CATS[c][lang == "de"])}</button>' for c in used)
    labels = {k: L[k] for k in ('pause', 'play', 'all_n', 'intro', 'read', 'close', 'empty', 'reset', 'prev', 'next', 'count_1', 'count_n', 'of', 'pages', 'preview', 'lead', 'picked', 'mins')}
    body = f'''<main class="page blog" id="blog" data-lang="{lang}" data-home="{path}" data-explore="{EXPLORE}" data-fresh="{FRESH}" data-per-page="{PER_PAGE}" data-labels="{esc(json.dumps(labels, ensure_ascii=False))}">
  <a class="back" href="{skull(lang)}" aria-label="{L['skull']}"><img src="assets/skull-thumb.webp" alt="" width="252" height="252"></a>
  <div class="room blog-room">
    <header class="blog-head">
      <div><span class="tag">{L['blog']}</span>
      <h1>{L['name']}</h1></div>
    </header>
    <div class="blog-bar" id="b-bar" hidden>
      <div class="views" role="group" aria-label="{L['view']}"><a href="{path}?view=explore" data-view="explore">{L['explore']}</a><a href="{path}?view=archive" data-view="archive">{L['archive']}</a></div>
      <button type="button" class="motion" id="b-motion" aria-pressed="false">{L['pause']}</button>
    </div>
    <section class="explore" id="b-explore" aria-label="{L['explore']}" hidden>
      <div class="drift" id="b-drift"></div>
      <p class="to-archive"><a href="{path}?view=archive" data-view="archive">{L['all_n'].format(n=len(mine))}</a></p>
    </section>
    <section class="archive" id="b-archive" aria-label="{L['archive']}">
      <form class="tools" id="b-tools" role="search" hidden>
        <div class="find"><label for="b-q">{L['search']} <small>{L['search_scope']}</small></label><span><input id="b-q" type="search" autocomplete="off" spellcheck="false"><button type="button" id="b-clear" hidden>{L['clear']}</button></span></div>
        <div class="chips" id="b-cats" role="group" aria-label="{L['cats']}"{'' if len(used) > 1 else ' hidden'}><button type="button" data-cat="" aria-pressed="true">{L['all']}</button>{chips}</div>
        <div class="order"><label for="b-sort">{L['sort']}</label><select id="b-sort"><option value="new">{L['newest']}</option><option value="old">{L['oldest']}</option></select></div>
      </form>
      <p class="count" id="b-count" role="status"></p>
      <ol class="entries" id="b-list">
{chr(10).join(items)}
      </ol>
      <p class="none" id="b-none" hidden>{L['empty']} <button type="button" id="b-reset">{L['reset']}</button></p>
      <nav class="pager" id="b-pages" aria-label="{L['pages']}" hidden></nav>
    </section>
  </div>
</main>
<div class="peek" id="b-peek" hidden></div>'''
    head = (f'<meta property="og:type" content="website">\n<meta property="og:title" content="{esc(L["blog"])} · {NAME}">\n<meta property="og:description" content="{esc(L["desc"])}">\n<meta property="og:image" content="{OG}">\n<meta property="og:url" content="{SITE}/{path}">\n'
             + ld({'@type': 'Blog', '@id': f'{SITE}/{path}', 'url': f'{SITE}/{path}', 'name': 'Food for thought', 'description': L['desc'], 'inLanguage': lang, 'author': {'@id': ME},
                   'blogPost': [{'@type': 'BlogPosting', 'headline': q['title'], 'url': f'{SITE}/{url(q)}', 'datePublished': q['date']} for q in mine]}, person(), crumbs((L['blog'], path), lang=lang)) + '\n')
    page(path, lang, f"{L['blog']} · Chris Helmbrecht", L['desc'], body, head, pair=(home('en'), home('de')) if by['en'] and by['de'] else None)

# ---------------------------------------------------------------- the articles
def article_body(p):
    """ids on the headings for the table of contents, and tables in a box that can scroll sideways"""
    heads = []
    def h2(m):
        heads.append(html.unescape(re.sub(r'<[^>]+>', '', m.group(1))).strip())
        return f'<h2 id="s{len(heads)}">{m.group(1)}</h2>'
    b = re.sub(r'<h2>(.*?)</h2>', h2, p['body'], flags=re.S)
    b = b.replace('<table>', '<div class="table"><table>').replace('</table>', '</table></div>')
    return b, heads


for lang, mine in by.items():
    L, other = T[lang], 'de' if lang == 'en' else 'en'
    for i, p in enumerate(mine):
        path = url(p)
        tw = twin.get((p['id'], other))
        body, heads = article_body(p)
        rest = [q for q in mine if q is not p]
        toc = ''
        if len(heads) >= TOC_FROM:
            toc = f'<details class="toc"><summary>{L["contents"]}</summary><ol>' + ''.join(f'<li><a href="{path}#s{k + 1}">{esc(h)}</a></li>' for k, h in enumerate(heads)) + '</ol></details>'
        hero = ''
        if p['image']:
            cap = f'<figcaption>{L["picture"]}: {esc(p["credit"])}</figcaption>' if p.get('credit') else ''
            hero = f'<figure class="article-pic">{picture(p, "(min-width: 900px) 860px, 96vw", lazy=False)}{cap}</figure>'
        cats = ''.join(f' · <a href="{home(lang)}?view=archive&amp;cat={c}">{esc(CATS[c][lang == "de"])}</a>' for c in p['categories'])
        upd = f' · {L["updated"]} {day(p["updated"], lang)}' if p.get('updated') else ''
        doc = f'''<div class="reading" aria-hidden="true"></div>
<main class="page article-page" data-lang="{lang}" data-home="{home(lang)}" data-id="{esc(p['id'])}">
  <a class="back" href="{skull(lang)}" aria-label="{L['skull']}"><img src="assets/skull-thumb.webp" alt="" width="252" height="252"></a>
  <article class="room article">
    <nav class="article-top" aria-label="{L['blog']}">
      <a class="to-blog" id="b-home" href="{home(lang)}">{L['back']}</a>
      <details class="others"><summary>{L['others']}</summary><div><ul>{''.join(f'<li>{card(q)}</li>' for q in rest[:6])}</ul><p><a href="{home(lang)}?view=archive">{L['all_n'].format(n=len(mine))}</a></p></div></details>
    </nav>
    <p class="tag article-meta"><time datetime="{p['date']}">{day(p['date'], lang)}</time>{upd} · {L['mins'].format(n=p['mins'])}{cats}</p>
    <h1>{esc(p['title'])}</h1>
    {f'<p class="article-intro">{esc(p["intro"])}</p>' if p['intro'] else ''}
    {hero}
    {toc}
    <div class="article-text">
{body}
    </div>
    <aside class="article-more" aria-labelledby="b-more">
      <h2 id="b-more">{L['more']}</h2>
      <ul>{''.join(f'<li>{card(q)}</li>' for q in rest[:3])}</ul>
      <ul class="links"><li><a href="{home(lang)}?view=archive">{L['all_articles']}</a></li></ul>
    </aside>
  </article>
</main>'''
        og = f'{SITE}/assets/blog/{p["image"]}-og.jpg' if p['image'] else f'{SITE}/assets/og.jpg'
        head = (f'<meta property="og:type" content="article">\n<meta property="og:title" content="{esc(p["title"])}">\n<meta property="og:description" content="{esc(brief(p["peek"], 200))}">\n'
                  f'<meta property="og:image" content="{og}">\n<meta property="og:url" content="{SITE}/{path}">\n<meta property="article:published_time" content="{p["date"]}">\n'
                + ld({'@type': 'BlogPosting', '@id': f'{SITE}/{path}', 'url': f'{SITE}/{path}', 'mainEntityOfPage': f'{SITE}/{path}', 'headline': p['title'], 'description': brief(p['peek'], 300),
                      'datePublished': p['date'], 'dateModified': p.get('updated') or p['date'], 'inLanguage': lang, 'image': og, 'author': {'@id': ME}, 'publisher': {'@id': ME},
                      'keywords': ', '.join(p['tags']), 'isPartOf': {'@type': 'Blog', '@id': f'{SITE}/{home(lang)}', 'name': 'Food for thought'}},
                     person(), crumbs((L['blog'], home(lang)), (p['title'], path), lang=lang)) + '\n')
        page(path, lang, f"{p['title']} · Chris Helmbrecht", brief(p['peek'], 160) or p['title'], doc, head, pair=tw and ((path, url(tw)) if lang == 'en' else (url(tw), path)))

# ---------------------------------------------------------------- feeds, sitemap, redirects
rfc = lambda d: datetime.datetime.strptime(d, '%Y-%m-%d').strftime('%a, %d %b %Y 08:00:00 +0000')
for lang, mine in by.items():
    if not mine: continue
    items = ''.join(f'<item><title>{esc(p["title"])}</title><link>{SITE}/{url(p)}</link><guid isPermaLink="false">{esc(p["id"])}-{lang}</guid><pubDate>{rfc(p["date"])}</pubDate><description>{esc(p["intro"])}</description></item>\n' for p in mine[:30])
    f = os.path.join(OUT, f"blog/{'de/' if lang == 'de' else ''}feed.xml"); os.makedirs(os.path.dirname(f), exist_ok=True)
    open(f, 'w', encoding='utf-8').write(f'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>{esc(T[lang]["feed"])}</title><link>{SITE}/{home(lang)}</link><description>{esc(T[lang]["desc"])}</description><language>{lang}</language>\n{items}</channel></rss>\n')
if not A.synthetic and not A.only:
    # every page in both languages: the hand-written ones (their German twins are made by seo.py), blog and timeline (year pages by build-timeline.py)
    fixed = [address(p)[len(SITE) + 1:] for p in PLAIN] + [address(DE[p])[len(SITE) + 1:] for p in PLAIN] + (['timeline.html', 'timeline/de/index.html'] if TIMELINE else []) + [home(l) for l in by if by[l]]
    if TIMELINE: fixed += sorted(f.replace(os.sep, '/') for f in glob.glob('timeline/*.html') + glob.glob('timeline/de/*.html') if not f.endswith('index.html'))
    rows = [f'<url><loc>{SITE}/{u}</loc></url>' for u in fixed] + [f'<url><loc>{SITE}/{url(p)}</loc><lastmod>{p.get("updated") or p["date"]}</lastmod></url>' for l in by for p in by[l]]
    open(os.path.join(OUT, 'sitemap.xml'), 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(rows) + '\n</urlset>\n')
    red = ['# Old addresses of the articles and where they live now. Switched on since the launch (18 Nov 2026): these lines stand',
           '# at the end of .htaccess as they are (mod_alias). After a change here, copy them there again.', '']
    red += [f"Redirect 301 {re.sub(r'^https?://[^/]+', '', p['old'])} /{url(p)}" for l in by for p in by[l] if p.get('old')]
    red += ['Redirect 301 /en/blog-2/ /blog.html']
    open('content/blog/redirects.txt', 'w').write('\n'.join(red) + '\n')
# pages of articles that no longer exist would stay behind: clear them out (only what this script made)
made = {os.path.normpath(os.path.join(OUT, url(p))) for p in posts}
for f in glob.glob(os.path.join(OUT, 'blog/*.html')) + glob.glob(os.path.join(OUT, 'blog/de/*.html')):
    if os.path.normpath(f) not in made and not f.endswith('de/index.html'): os.remove(f)
print({l: len(by[l]) for l in by}, 'articles;', len(posts), 'pages')

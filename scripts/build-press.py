#!/usr/bin/env python3
"""Build the press page in both languages from content/press.txt.

  python3 scripts/build-press.py          (from the repository's root; standard Python)

content/press.txt holds one block per piece (its head explains the fields). This script writes press.html and
de/press.html: three lists (television and video, radio, print and online), newest first, pieces without a date last.
A piece with an address is a link to the original; one without is marked "Archive". Titles stay in the language they
were published in. Drafts (draft: yes) are left out and counted in the script's last line, so nothing unchecked appears.

Never edit press.html or de/press.html by hand. Run scripts/seo.py afterwards: llms-full.txt reads the finished page.
"""
import re, os, sys, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from siteconf import SITE, NAME, ME, OG, DE, de, address, alternates, noscript, person, crumbs, ld

esc = lambda s: html.escape(str(s), quote=True)
SECTIONS = ('tv', 'radio', 'print')
MONTHS = {'en': 'January February March April May June July August September October November December'.split(),
          'de': 'Januar Februar März April Mai Juni Juli August September Oktober November Dezember'.split()}
T = {
 'en': dict(nav='Press', title='Press · Chris Helmbrecht', h1='In the press.',
            lead='Television, radio and print, most of it from the Moscow years. Where a piece is still online, its title leads there. The rest is in my archive.',
            desc='Press about Chris Helmbrecht: {n} pieces from television, radio, print and online, {a} to {b}, among them {m}. With links to the originals.',
            tv='Television & video', radio='Radio', print='Print & online', sum_='{n} pieces · {a}–{b}', archive='Archive', undated='n.d.', opens='opens the original in a new tab',
            langs={'de': 'German', 'en': 'English', 'ru': 'Russian'}, contact='Press contact', skull='Back to the skull', more='More is being checked and added.'),
 'de': dict(nav='Presse', title='Presse · Chris Helmbrecht', h1='In der Presse.',
            lead='Fernsehen, Radio und Print, das meiste aus den Moskauer Jahren. Wo ein Beitrag noch online ist, führt der Titel dorthin. Der Rest liegt in meinem Archiv.',
            desc='Presse über Chris Helmbrecht: {n} Beiträge aus Fernsehen, Radio, Print und Online, {a} bis {b}, darunter {m}. Mit Links zu den Originalen.',
            tv='Fernsehen & Video', radio='Radio', print='Print & Online', sum_='{n} Beiträge · {a}–{b}', archive='Archiv', undated='o. J.', opens='öffnet das Original in einem neuen Tab',
            langs={'de': 'Deutsch', 'en': 'Englisch', 'ru': 'Russisch'}, contact='Pressekontakt', skull='Zurück zum Schädel', more='Weitere Beiträge werden geprüft und ergänzt.'),
}

# ---------------------------------------------------------------- read
clips, held = [], 0
for block in re.split(r'\n\s*\n', re.sub(r'^#.*$', '', open('content/press.txt', encoding='utf-8').read(), flags=re.M)):
    d = {}
    for line in block.strip().split('\n'):
        if not line.strip(): continue
        k, sep, v = line.partition(':'); assert sep and re.fullmatch(r'[a-z_]+', k.strip()), f'content/press.txt: cannot read “{line[:60]}”'
        d[k.strip()] = v.strip()
    if not d: continue
    assert d.get('clip') and d.get('section') in SECTIONS, f'content/press.txt: “{d.get("clip")}” needs a section (tv, radio or print)'
    assert not d.get('date') or re.fullmatch(r'\d{4}(-\d\d){0,2}', d['date']), f'content/press.txt: date of “{d["clip"]}” must be 2009, 2009-05 or 2009-05-05'
    if d.get('draft', 'no').lower() in ('yes', 'true', '1'): held += 1; continue
    assert d.get('medium'), f'content/press.txt: “{d["clip"]}” needs a medium, or stays a draft'
    assert not d.get('url') or d['url'].startswith('https://'), f'content/press.txt: address of “{d["clip"]}” must start with https://'
    clips.append(d)
clips.sort(key=lambda d: d.get('date') or '', reverse=True)                 # newest first; no date sorts last
years = sorted(int(d['date'][:4]) for d in clips if d.get('date'))


def day(date, lang):
    if not date: return ''
    p = date.split('-'); m = MONTHS[lang][int(p[1]) - 1] if len(p) > 1 else ''
    if len(p) == 1: return p[0]
    if len(p) == 2: return f'{m} {p[0]}'
    return f'{int(p[2])}. {m} {p[0]}' if lang == 'de' else f'{int(p[2])} {m} {p[0]}'


def clip(d, lang):
    t = T[lang]
    name = d.get('title') or d.get('programme') or d['medium']                       # what stands large: the piece's own title, else the programme, else the medium
    meta = [d['medium']] if name != d['medium'] else []
    if d.get('programme') and name != d['programme']: meta.append(d['programme'])
    when = day(d.get('date'), lang)
    if when: meta.append(f'<time datetime="{d["date"]}">{when}</time>')
    if d.get('lang'): meta.append(t['langs'][d['lang']])
    if not d.get('url'): meta.append(f'<span class="clip-arch">{t["archive"]}</span>')
    title = esc(name)
    foreign = f' lang="{d["lang"]}"' if d.get('title') and d.get('lang') and d['lang'] != lang else ''
    if d.get('url'): title = f'<a href="{esc(d["url"])}" target="_blank" rel="noopener"{foreign} title="{esc(t["opens"])}">{title}</a>'
    elif foreign: title = f'<span{foreign}>{title}</span>'
    note = d.get(f'note_{lang}') or ''
    return (f'        <li class="clip" id="{esc(d["clip"])}"><span class="clip-year" aria-hidden="true">{d["date"][:4] if d.get("date") else t["undated"]}</span>'
            f'<p class="tag clip-meta">{" · ".join(esc(m) if "<" not in m else m for m in meta)}</p><h3 class="clip-title">{title}</h3>'
            + (f'<p class="clip-note">{esc(note)}</p>' if note else '') + '</li>')


def page(lang):
    t, path = T[lang], DE['press.html'] if lang == 'de' else 'press.html'
    home = de('index.html') if lang == 'de' else 'index.html'
    contact = de('contact.html') if lang == 'de' else 'contact.html'
    span = dict(n=len(clips), a=years[0], b=years[-1])
    known = [m for m in ('CNN', 'Süddeutsche Zeitung', 'Stern.de', 'RTL', 'ProSieben', 'N24', 'Deutschlandfunk') if any(d['medium'] == m for d in clips)]      # the names a searcher would know, as far as they are on the page
    desc = t['desc'].format(m=(', '.join(known[:-1]) + (' und ' if lang == 'de' else ' and ') + known[-1]) if len(known) > 1 else ''.join(known), **span)
    parts = []
    for s in SECTIONS:
        mine = [d for d in clips if d['section'] == s]
        if mine: parts.append(f'    <section class="press-part" aria-labelledby="p-{s}">\n      <h2 id="p-{s}">{esc(t[s])}</h2>\n      <ol class="clips">\n' + '\n'.join(clip(d, lang) for d in mine) + '\n      </ol>\n    </section>')
    kinds = {'tv': 'TVEpisode', 'radio': 'RadioEpisode', 'print': 'Article'}
    def thing(d):
        o = {'@type': kinds[d['section']], 'name': d.get('title') or d.get('programme') or d['medium'], 'publisher': {'@type': 'Organization', 'name': d['medium']}, 'about': {'@id': ME}}
        if d.get('date'): o['datePublished'] = d['date']
        if d.get('lang'): o['inLanguage'] = d['lang']
        if d.get('url'): o['url'] = d['url']
        return o
    url = address(path)
    graph = ld({'@type': 'CollectionPage', '@id': url, 'url': url, 'name': t['title'], 'description': desc, 'inLanguage': lang, 'isPartOf': {'@id': SITE + '/#site'}, 'about': {'@id': ME},
                'mainEntity': {'@type': 'ItemList', 'numberOfItems': len(clips), 'itemListElement': [{'@type': 'ListItem', 'position': i, 'item': thing(d)} for i, d in enumerate(clips, 1)]}},
               person(), crumbs((t['nav'], path), lang=lang))
    doc = f'''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
{'<base href="../">' if lang == 'de' else ''}
<!--seo-->
<meta name="description" content="{esc(desc)}">
<meta name="author" content="{NAME}">
<link rel="canonical" href="{url}">
{alternates('press.html', DE['press.html'])}<meta property="og:site_name" content="{NAME}">
<meta property="og:type" content="website">
<meta property="og:title" content="{esc(t['title'])}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{OG}">
<meta property="og:locale" content="{'de_DE' if lang == 'de' else 'en_US'}">
<meta property="og:locale:alternate" content="{'en_US' if lang == 'de' else 'de_DE'}">
<meta name="twitter:card" content="summary_large_image">
{graph}
<!--/seo-->
<link rel="icon" href="favicon.ico" sizes="48x48">
<link rel="icon" href="assets/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/icon-180.png">
<!--page-->
<title>{esc(t['title'])}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#d6d9d6">
<link rel="stylesheet" href="css/site.css">
<link rel="stylesheet" href="css/press.css">
{noscript(lang, 'press.html' if lang == 'de' else DE['press.html'])}
<main class="page press">
  <a class="back" href="{home}" aria-label="{t['skull']}"><img src="assets/skull-thumb.webp" alt="" width="252" height="252"></a>
  <article class="room press-room">
    <header class="press-head">
      <span class="tag">{t['nav']}</span>
      <h1>{t['h1']}</h1>
      <p class="press-lead">{t['lead']}</p>
      <p class="tag press-sum">{t['sum_'].format(**span)}</p>
    </header>
{chr(10).join(parts)}
    <footer class="press-foot">
      <p class="tag">{t['more']}</p>
      <ul class="links"><li><a href="{contact}">{t['contact']}</a></li></ul>
    </footer>
  </article>
</main>
<script src="js/site.js"></script>
<!--/page-->
</body>
</html>
'''
    doc = re.sub(r'\n{2,}', '\n', doc)
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    open(path, 'w', encoding='utf-8').write(doc)


for lang in ('en', 'de'): page(lang)
print(f'{len(clips)} pieces on the press page ({", ".join(f"{sum(d["section"] == s for d in clips)} {s}" for s in SECTIONS)})' + (f', {held} held back as drafts' if held else ''))

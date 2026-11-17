#!/usr/bin/env python3
"""Give the hand-written pages what search engines, link previews and assistants read, write their German twins,
and write the files crawlers look for.

  python3 scripts/seo.py          (from the repository's root; standard Python)

The hand-written pages (index, bio, dj, writing, contact, making-of) are written once, in English. For each of
them this script
  - rewrites one marked block in the head (between <!--seo--> and <!--/seo-->): description, canonical address, the
    addresses of both language versions, the tags for link previews and the page's structured data;
  - puts the site's menu into the page as a <noscript> list, because the menu itself is built by script and a reader
    without script would otherwise find no way around;
  - writes the German page beside it as de/<page>: the same page with every text replaced from content/de/<page>.txt
    and every link pointing at the German pages. Never edit a file in de/ by hand: change the English page or the
    German text in content/de/ and run this script again.

GERMAN TEXT (content/de/<page>.txt): "title:", "desc:" and "crumb:" at the top, then pairs. A line starting with "== "
is a piece of English exactly as it stands in the page (with its tags, if it has any); the line below is the German.
"~~ " does the same with a pattern (regular expression). "= text" says: this stays as it is in German (a name, a
genre). content/de/_all.txt holds what several pages share. The script stops when an English piece is no longer found
in its page (the page's text was changed: bring the German up to date) and lists every text that would appear on a
German page untranslated.

The two hidden games get the menu only; they exist in English alone and stay out of search engines. Blog, timeline and
the press page get all of this from their own build scripts (build-blog.py, build-timeline.py, build-press.py).

It also writes llms.txt (from content/llms.txt, with full addresses), llms-full.txt (the pages' texts as plain text,
for assistants that want everything in one file) and robots.txt.

The address of the site is SITE in scripts/siteconf.py. Run this again whenever a page's text or that address changes.
Descriptions are written here, from what the pages say; nothing in them is to be invented.
"""
import re, os, sys, html, json, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from siteconf import SITE, NAME, ME, OG, NAV, PLAIN, DE, TIMELINE, de, address, alternates, noscript, person, crumbs, ld

esc = lambda s: html.escape(str(s), quote=True)
PAGES = {
 'index.html': dict(title='Chris Helmbrecht · DJ, author and brand consultant in Munich', kind='website',
    desc='Chris Helmbrecht: DJ, author of Fucking Moskau and brand consultant in Munich. A blue-ink skull is the way in, and everything in it opens a page.'),
 'bio.html': dict(title='Bio · Chris Helmbrecht', kind='profile', crumb='Bio',
    desc='Chris Helmbrecht, born 1971 in Munich: Federal Police helicopter squad and extreme snowboarding, web design from 1995, then New York, Tenerife, Moscow and back to Munich. His bio as a logbook with a chart.'),
 'dj.html': dict(title='DJ · Chris Helmbrecht', kind='website', crumb='DJ',
    desc='DJ: eight recordings by Chris Helmbrecht on a drawn turntable. Melodic techno, indie dance and house, the nights behind them, and booking.'),
 'writing.html': dict(title='Writing · Chris Helmbrecht', kind='website', crumb='Writing',
    desc='Chris Helmbrecht as a writer: music interviews, snowboard stories, pieces for Stern and Stern.de, and the book “Fucking Moskau!”, published by Heyne in 2013.'),
 'contact.html': dict(title='Contact · Chris Helmbrecht', kind='website', crumb='Contact',
    desc='Write to Chris Helmbrecht: a postcard with his e-mail address, then Instagram, SoundCloud, Mixcloud, Facebook and Telegram, DJ booking direct by e-mail or phone, and his literary agent.'),
 'making-of.html': dict(title='Making of · Chris Helmbrecht', kind='website', crumb='Making of',
    desc='How this site was made: why a skull, the drafts, who did what (Perplexity, Midjourney, Runway, ElevenLabs, Topaz, Claude), what did not work at first, and the games and hidden things, revealed on request. With credits.'),
}
PAGES_DE = {                # crumb: the page's name on the way back to the start page (structured data)
 'index.html': dict(title='Chris Helmbrecht · DJ, Autor und Markenberater in München',
    desc='Chris Helmbrecht: DJ, Autor von Fucking Moskau und Markenberater in München. Ein Schädel in blauer Tinte ist der Eingang, und alles darin öffnet eine Seite.'),
 'bio.html': dict(title='Bio · Chris Helmbrecht', crumb='Bio',
    desc='Chris Helmbrecht, geboren 1971 in München: Hubschrauberstaffel der Bundespolizei und Extrem-Snowboarden, Webdesign ab 1995, dann New York, Teneriffa, Moskau und zurück nach München. Seine Bio als Logbuch mit Karte.'),
 'dj.html': dict(title='DJ · Chris Helmbrecht', crumb='DJ',
    desc='DJ: acht Aufnahmen von Chris Helmbrecht auf einem gezeichneten Plattenspieler. Melodic Techno, Indie Dance und House, die Nächte dahinter und Booking.'),
 'writing.html': dict(title='Autor · Chris Helmbrecht', crumb='Autor',
    desc='Chris Helmbrecht als Autor: Musikinterviews, Snowboard-Geschichten, Texte für Stern und Stern.de und das Buch „Fucking Moskau!“, 2013 bei Heyne erschienen.'),
 'contact.html': dict(title='Kontakt · Chris Helmbrecht', crumb='Kontakt',
    desc='Schreib Chris Helmbrecht: eine Postkarte mit seiner E-Mail-Adresse, dazu Instagram, SoundCloud, Mixcloud, Facebook und Telegram, DJ-Booking direkt per E-Mail oder Telefon, und seine Literaturagentur.'),
 'making-of.html': dict(title='Making-of · Chris Helmbrecht', crumb='Making-of',
    desc='Wie diese Seite entstanden ist: warum ein Schädel, die Entwürfe, wer was gemacht hat (Perplexity, Midjourney, Runway, ElevenLabs, Topaz, Claude), was nicht auf Anhieb geklappt hat, und die Spiele und Verstecke, auf Wunsch aufgelöst. Mit Credits.'),
}
MENU_ONLY = ['game.html', 'jaywalk.html', '404.html']       # one language (the games) or both in one file (404): the menu and the language script, nothing else


def text_of(page_html, links=True):
    """A page as plain text, the way a reader without script gets it."""
    s = page_html.split('<!--page-->')[-1]
    s = re.sub(r'<(script|style|noscript|dialog|svg|title)\b.*?</\1>', '', s, flags=re.S)
    s = re.sub(r'<h([1-4])[^>]*>(.*?)</h\1>', lambda m: '\n\n' + '#' * (int(m.group(1)) + 1) + ' ' + re.sub(r'<[^>]+>', '', m.group(2)).strip() + '\n\n', s, flags=re.S)
    if links: s = re.sub(r'<a [^>]*href="([^"#][^"]*)"[^>]*>(.*?)</a>', lambda m: (lambda t: f'[{t}]({m.group(1) if re.match(r"(https?:|mailto:|tel:)", m.group(1)) else SITE + "/" + m.group(1)})' if t else '')(re.sub(r'<[^>]+>', '', m.group(2)).strip()), s, flags=re.S)
    s = re.sub(r'<li[^>]*>', '\n- ', s); s = re.sub(r'</(p|li|ul|ol|div|section|article|figure|header|tr)>|<br[^>]*>', '\n', s)
    s = html.unescape(re.sub(r'<[^>]+>', ' ', s))
    s = re.sub(r'[ \t]+', ' ', s); s = re.sub(r' *\n *', '\n', s); s = re.sub(r'\n{3,}', '\n\n', s)
    return '\n'.join(l for l in s.split('\n') if l.strip() not in ('-',)).strip()


def graph(path, c, page_html, lang='en'):
    here = DE[path] if lang == 'de' else path
    url = address(here)
    web = {'@type': 'WebPage', '@id': url, 'url': url, 'name': c['title'], 'description': c['desc'], 'inLanguage': lang, 'isPartOf': {'@id': SITE + '/#site'}, 'about': {'@id': ME}}
    nodes = [web]
    if path == 'index.html':
        nodes = [{'@type': 'WebSite', '@id': SITE + '/#site', 'url': SITE + '/', 'name': NAME, 'inLanguage': ['en', 'de'], 'publisher': {'@id': ME}}, web, person(True, lang)]
    elif path == 'bio.html':
        web['@type'] = 'ProfilePage'; web['mainEntity'] = {'@id': ME}; nodes += [person(True, lang)]
    elif path == 'dj.html':                              # the recordings are read from the page's own list, so the two cannot drift apart
        mixes = re.findall(r'<li class="mix(?: on)?" data-key="([^"]+)" data-len="(\d+)">.*?class="mix-title">(.*?)<', page_html, re.S)
        iso = lambda sec: f'PT{int(sec) // 3600}H{int(sec) % 3600 // 60}M'
        nodes += [person(), {'@type': 'ItemList', 'name': 'DJ-Sets von Chris Helmbrecht' if lang == 'de' else 'DJ sets by Chris Helmbrecht', 'numberOfItems': len(mixes), 'itemListElement': [
            {'@type': 'ListItem', 'position': i, 'item': {'@type': 'MusicRecording', 'name': html.unescape(t), 'url': 'https://www.mixcloud.com' + k, 'duration': iso(n), 'byArtist': {'@id': ME}}} for i, (k, n, t) in enumerate(mixes, 1)]}]
    elif path == 'writing.html':
        nodes += [person(), {'@type': 'Book', 'name': 'Fucking Moskau!', 'author': {'@id': ME}, 'publisher': {'@type': 'Organization', 'name': 'Heyne Verlag'}, 'datePublished': '2013', 'inLanguage': 'de', 'url': 'https://fuckingmoskau.de'}]
    elif path == 'contact.html':
        web['@type'] = 'ContactPage'
        me = person(); me['contactPoint'] = {'@type': 'ContactPoint', 'contactType': 'DJ-Booking' if lang == 'de' else 'DJ booking', 'email': 'dj@chrishelmbrecht.com', 'telephone': '+4917684393190'}; nodes += [me]
    else: nodes += [person()]
    if c.get('crumb'): nodes += [crumbs((c['crumb'], here), lang=lang)]
    return ld(*nodes)


def head_block(path, c, page_html, lang='en'):
    url = address(DE[path] if lang == 'de' else path)
    og_title = NAME if path == 'index.html' else c['title']
    return ('<!--seo-->\n'
            f'<meta name="description" content="{esc(c["desc"])}">\n<meta name="author" content="{NAME}">\n<link rel="canonical" href="{url}">\n{alternates(path, DE[path])}'
            f'<meta property="og:site_name" content="{NAME}">\n<meta property="og:type" content="{c["kind"]}">\n<meta property="og:title" content="{esc(og_title)}">\n'
            f'<meta property="og:description" content="{esc(c["desc"])}">\n<meta property="og:url" content="{url}">\n<meta property="og:image" content="{OG}">\n'
            f'<meta property="og:locale" content="{"de_DE" if lang == "de" else "en_US"}">\n<meta property="og:locale:alternate" content="{"en_US" if lang == "de" else "de_DE"}">\n'
            f'<meta name="twitter:card" content="summary_large_image">\n{graph(path, c, page_html, lang)}\n<!--/seo-->')


def menu(s, nav):
    s = re.sub(r'<noscript><nav class="plain-nav".*?</noscript>\n?', '', s, flags=re.S)
    return re.sub(r'(<main\b|<section class="hero")', lambda m: nav + '\n' + m.group(1), s, count=1)      # before the page's content; the start page has no <main>


# ---------------------------------------------------------------- German
def table(path):
    """A German text document: its head lines, its pairs (English piece, German, is a pattern) and what stays as it is."""
    head, pairs, keep, key = {}, [], set(), None
    if not os.path.exists(path): return head, pairs, keep
    for n, line in enumerate(open(path, encoding='utf-8').read().split('\n'), 1):
        if key is not None:
            assert line.strip(), f'{path}, line {n}: the German for “{key[0][:60]}” is missing'
            pairs.append((key[0], line.strip(), key[1])); key = None
        elif line.startswith('== '): key = (line[3:].strip(), False)
        elif line.startswith('~~ '): key = (line[3:].strip(), True)
        elif line.startswith('= '): keep.add(line[2:].strip())
        elif re.match(r'(title|desc|crumb):', line): k, _, v = line.partition(':'); head[k] = v.strip()
        else: assert not line.strip() or line.startswith('#'), f'{path}, line {n}: cannot read “{line[:60]}”'
    return head, pairs, keep

EDGE = (r'(?<=[>"])(\s*)', r'(\s*)(?=[<"])')            # a piece is a whole text between two tags, or a whole attribute value
def pieces(body):
    """Every text a reader or a screen reader gets from a page: the texts between tags and the describing attributes."""
    body = re.sub(r'<(script|style|noscript|title)\b.*?</\1>', '', body, flags=re.S)
    found = [m.strip() for m in re.findall(r'>([^<>]+)<', body)] + re.findall(r'\b(?:alt|aria-label|title|placeholder)="([^"]+)"', body)
    return [f for f in found if re.search(r'[A-Za-zÄÖÜäöü]{2}', f)]

def swap(m, en, ger, pattern):
    inner = m.group(0)[len(m.group(1)):len(m.group(0)) - len(m.group(m.lastindex))]      # the piece without the spaces around it, which stay
    return m.group(1) + (re.sub(en, ger, inner) if pattern else ger) + m.group(m.lastindex)

def german(path, s, c):
    """The German twin of an English page (s: the finished English page; c: its German title and description)."""
    name = path[:-5]
    head, pairs, keep = table(f'content/de/{name}.txt')
    _, shared, shared_keep = table('content/de/_all.txt')
    top, body = s.split('<!--page-->', 1)
    english = set(pieces(body))
    body = re.sub(r'<noscript><nav class="plain-nav".*?</noscript>\n?', '', body, flags=re.S)
    for own, rows in ((True, pairs), (False, shared)):
        for en, ger, pattern in rows:
            body, n = re.subn(EDGE[0] + (en if pattern else re.escape(en)) + EDGE[1], lambda m: swap(m, en, ger, pattern), body)
            assert n or not own, f'content/de/{name}.txt: “{en[:70]}” is no longer in {path}. The page was changed: bring the German up to date.'
    left = sorted({t for t in pieces(body) if t in english and t not in keep and t not in shared_keep})
    body = re.sub(r'href="(?!https?:|mailto:|tel:)([^"]*)"', lambda m: f'href="{DE[path] + m.group(1) if m.group(1).startswith("#") else de(m.group(1))}"', body)   # links stay in German; a jump within the page names the page, because of <base>
    body = re.sub(r'<title>.*?</title>', f'<title>{esc(c["title"])}</title>', body, count=1, flags=re.S)
    body = menu(body, noscript('de', path))
    top = top.replace('<html lang="en">', '<html lang="de">')
    top = re.sub(r'<!--seo-->.*?<!--/seo-->', lambda m: head_block(path, c, s, 'de'), top, flags=re.S)
    top = re.sub(r'(<meta name="referrer"[^>]*>\n)', lambda m: m.group(1) + '<base href="../">\n', top, count=1)   # the German page lies one folder down and uses the same pictures, styles and scripts
    out = DE[path]; os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(top + '<!--page-->' + body)
    return left, text_of(top + '<!--page-->' + body)


texts, texts_de, left = {}, {}, {}
for path, c in PAGES.items():
    s = open(path, encoding='utf-8').read()
    s = re.sub(r'<!--seo-->.*?<!--/seo-->\n?', '', s, flags=re.S)
    s = re.sub(r'<meta (name="description"|name="author"|property="og:[^"]+"|name="twitter:[^"]+")[^>]*>\n?', '', s)        # what an earlier hand put there
    s = re.sub(r'<link rel="canonical"[^>]*>\n?', '', s)
    s = re.sub(r'<title>.*?</title>', f'<title>{esc(c["title"])}</title>', s, count=1, flags=re.S)
    assert '<meta name="referrer"' in s, path
    s = re.sub(r'(<meta name="referrer"[^>]*>\n)', lambda m: m.group(1) + head_block(path, c, s) + '\n', s, count=1)
    s = menu(s, noscript('en', DE[path]))
    open(path, 'w', encoding='utf-8').write(s); texts[path] = text_of(s)
    left[path], texts_de[path] = german(path, s, {**c, **PAGES_DE[path]})
if os.path.exists('press.html'):                         # made by build-press.py; its text belongs to the main pages all the same
    texts['press.html'], texts_de['press.html'] = text_of(open('press.html', encoding='utf-8').read()), text_of(open(DE['press.html'], encoding='utf-8').read())
for path in MENU_ONLY:
    s = open(path, encoding='utf-8').read()
    s = re.sub(r'<script src="js/lang.js"></script>\n?', '', s)
    s = re.sub(r'(<link rel="icon" href="favicon.ico")', r'<script src="js/lang.js"></script>\n\1', s, count=1)      # no twin to go to, but the menu learns which language the visitor reads
    open(path, 'w', encoding='utf-8').write(menu(s, noscript('en')))

# ---------------------------------------------------------------- llms.txt, llms-full.txt, robots.txt
src = open('content/llms.txt', encoding='utf-8').read()
absolute = lambda t: re.sub(r'\]\((?!https?:|mailto:)([^)]+)\)', lambda m: f']({address(m.group(1))})', t)
open('llms.txt', 'w', encoding='utf-8').write(absolute(src).rstrip() + f'\n\n## For assistants\n- [All texts of the main pages in one file, English]({SITE}/llms-full.txt)\n- [The same in German]({SITE}/llms-full-de.txt)\n- [Sitemap]({SITE}/sitemap.xml)\n- [Blog feed, English]({SITE}/blog/feed.xml), [German]({SITE}/blog/de/feed.xml)\n')

def listed(lang):
    """Blog and timeline, as lists read from their finished overview pages."""
    out, d = [], lang == 'de'
    f = DE['blog.html'] if d else 'blog.html'
    blog = open(f, encoding='utf-8').read() if os.path.exists(f) else ''
    entries = re.findall(r'<li class="entry"[^>]*data-date="([^"]+)".*?<a class="entry-link" href="([^"]+)">.*?class="entry-title">(.*?)</strong>.*?<p class="entry-intro">(.*?)</p>', blog, re.S)
    if entries:
        intro = (f'{len(entries)} Essays, jeder auf einer eigenen Seite, jeder auch auf Englisch (siehe {SITE}/blog.html).' if d else
                 f'{len(entries)} essays, each on its own page, each also in German (see {SITE}/blog/de/index.html).')
        out.append(f'\n---\n\n{"Seite" if d else "Page"}: {SITE}/{f}\n\n## Blog: Food for thought\n\n{intro}\n\n' +
                   '\n'.join(f'- {dt}: [{html.unescape(t)}]({SITE}/{u}). {html.unescape(i)}' for dt, u, t, i in entries) + '\n')
    f = DE['timeline.html'] if d else 'timeline.html'
    tl = open(f, encoding='utf-8').read() if TIMELINE and os.path.exists(f) else ''      # out of the navigation: out of this file too
    yrs = re.findall(r'<li class="yr" id="(\d{4})".*?class="tag yr-count">(.*?)</p>', tl, re.S)
    if yrs:
        head = 'Timeline: Ein Leben in Bildern\n\nEin Fotoarchiv nach Jahren. Jedes Jahr hat eine Albumseite.' if d else 'Timeline: A life in frames\n\nA photo archive by year. Each year has an album page.'
        out.append(f'\n---\n\n{"Seite" if d else "Page"}: {SITE}/{f}\n\n## {head}\n\n' + '\n'.join(f'- [{y}]({SITE}/timeline/{"de/" if d else ""}{y}.html): {c}' for y, c in yrs) + '\n')
    return out

full = [f'# {NAME}\n\n> The main pages of {SITE} as plain text, made from the pages themselves by scripts/seo.py. For the short guide see {SITE}/llms.txt. In German: {SITE}/llms-full-de.txt\n']
for path in PLAIN:
    if path in texts: full.append(f'\n---\n\nPage: {address(path)}\n\n{texts[path]}\n')
open('llms-full.txt', 'w', encoding='utf-8').write(''.join(full + listed('en')))
voll = [f'# {NAME}\n\n> Die Hauptseiten von {SITE} auf Deutsch als reiner Text, von scripts/seo.py aus den Seiten selbst erzeugt. Kurzer Wegweiser: {SITE}/llms.txt. Auf Englisch: {SITE}/llms-full.txt\n']
for path in PLAIN:
    if path in texts_de: voll.append(f'\n---\n\nSeite: {address(DE[path])}\n\n{texts_de[path]}\n')
open('llms-full-de.txt', 'w', encoding='utf-8').write(''.join(voll + listed('de')))

open('robots.txt', 'w', encoding='utf-8').write(f"""# Everyone may read this site: search engines and the crawlers of AI assistants alike
# (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, Applebot-Extended, CCBot and others).
# A short guide for assistants is at /llms.txt, the main texts in one file at /llms-full.txt (German: /llms-full-de.txt).
User-agent: *
Allow: /
Disallow: /assets/source/

Sitemap: {SITE}/sitemap.xml
""")
print('pages:', ', '.join(PAGES), '| German twins in de/ | llms.txt', len(open('llms.txt').read()), 'chars | llms-full.txt', len(''.join(full).split()), 'words')
todo = {p: l for p, l in left.items() if l}
if todo:
    print('\nSTILL ENGLISH on the German pages (translate in content/de/<page>.txt, or mark with "= text" if it stays):')
    for p, l in todo.items(): print(f'  {DE[p]}:', *[f'\n    {t}' for t in l])

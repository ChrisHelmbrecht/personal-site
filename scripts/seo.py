#!/usr/bin/env python3
"""Give the hand-written pages what search engines, link previews and assistants read, and write the files they look for.

  python3 scripts/seo.py          (from the repository's root; standard Python)

For index, bio, dj, writing, press, contact and making-of it rewrites one marked block in the head (between
<!--seo--> and <!--/seo-->): description, canonical address, the tags for link previews and the page's structured
data. It also puts the site's menu into the page as a <noscript> list, because the menu itself is built by script and
a reader without script would otherwise find no way around. The two hidden games get the menu only; they stay out of
search engines. Blog and timeline pages get the same from their own build scripts.

It also writes llms.txt (from content/llms.txt, with full addresses), llms-full.txt (the pages' texts as plain text,
for assistants that want everything in one file) and robots.txt.

The address of the site is SITE in scripts/siteconf.py. Run this again whenever a page's text or that address changes.
Descriptions are written here, from what the pages say; nothing in them is to be invented.
"""
import re, os, sys, html, json, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from siteconf import SITE, NAME, ME, OG, NAV, NOSCRIPT, person, crumbs, ld

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
 'press.html': dict(title='Press · Chris Helmbrecht', kind='website', crumb='Press',
    desc='Press about Chris Helmbrecht: television, video and print from Munich, Moscow and New York. In preparation.'),
 'contact.html': dict(title='Contact · Chris Helmbrecht', kind='website', crumb='Contact',
    desc='Contact Chris Helmbrecht: Instagram, SoundCloud, Mixcloud, Facebook and Telegram, DJ booking direct by e-mail or phone, and his literary agent.'),
 'making-of.html': dict(title='Making of · Chris Helmbrecht', kind='website', crumb='Making of',
    desc='How this site was made by one person and a handful of AI tools: Perplexity, Midjourney, Runway, ElevenLabs, Topaz and Claude. With credits.'),
}
MENU_ONLY = ['game.html', 'jaywalk.html', '404.html']


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


def graph(path, c, page_html):
    url = SITE + '/' + ('' if path == 'index.html' else path)
    web = {'@type': 'WebPage', '@id': url, 'url': url, 'name': c['title'], 'description': c['desc'], 'inLanguage': 'en', 'isPartOf': {'@id': SITE + '/#site'}, 'about': {'@id': ME}}
    nodes = [web]
    if path == 'index.html':
        nodes = [{'@type': 'WebSite', '@id': SITE + '/#site', 'url': SITE + '/', 'name': NAME, 'inLanguage': ['en', 'de'], 'publisher': {'@id': ME}}, web, person(True)]
    elif path == 'bio.html':
        web['@type'] = 'ProfilePage'; web['mainEntity'] = {'@id': ME}; nodes += [person(True)]
    elif path == 'dj.html':                              # the recordings are read from the page's own list, so the two cannot drift apart
        mixes = re.findall(r'<li class="mix" data-key="([^"]+)" data-len="(\d+)">.*?class="mix-title">(.*?)<', page_html, re.S)
        iso = lambda sec: f'PT{int(sec) // 3600}H{int(sec) % 3600 // 60}M'
        nodes += [person(), {'@type': 'ItemList', 'name': 'DJ sets by Chris Helmbrecht', 'numberOfItems': len(mixes), 'itemListElement': [
            {'@type': 'ListItem', 'position': i, 'item': {'@type': 'MusicRecording', 'name': html.unescape(t), 'url': 'https://www.mixcloud.com' + k, 'duration': iso(n), 'byArtist': {'@id': ME}}} for i, (k, n, t) in enumerate(mixes, 1)]}]
    elif path == 'writing.html':
        nodes += [person(), {'@type': 'Book', 'name': 'Fucking Moskau!', 'author': {'@id': ME}, 'publisher': {'@type': 'Organization', 'name': 'Heyne Verlag'}, 'datePublished': '2013', 'inLanguage': 'de', 'url': 'https://fuckingmoskau.de'}]
    elif path == 'contact.html':
        web['@type'] = 'ContactPage'
        me = person(); me['contactPoint'] = {'@type': 'ContactPoint', 'contactType': 'DJ booking', 'email': 'dj@chrishelmbrecht.com', 'telephone': '+4917684393190'}; nodes += [me]
    else: nodes += [person()]
    if c.get('crumb'): nodes += [crumbs((c['crumb'], path))]
    return ld(*nodes)


def head_block(path, c, page_html):
    url = SITE + '/' + ('' if path == 'index.html' else path)
    og_title = NAME if path == 'index.html' else c['title']
    return ('<!--seo-->\n'
            f'<meta name="description" content="{esc(c["desc"])}">\n<meta name="author" content="{NAME}">\n<link rel="canonical" href="{url}">\n'
            f'<meta property="og:site_name" content="{NAME}">\n<meta property="og:type" content="{c["kind"]}">\n<meta property="og:title" content="{esc(og_title)}">\n'
            f'<meta property="og:description" content="{esc(c["desc"])}">\n<meta property="og:url" content="{url}">\n<meta property="og:image" content="{OG}">\n'
            f'<meta name="twitter:card" content="summary_large_image">\n{graph(path, c, page_html)}\n<!--/seo-->')


def menu(s):
    s = re.sub(r'<noscript><nav class="plain-nav".*?</noscript>\n?', '', s, flags=re.S)
    return re.sub(r'(<main\b|<section class="hero")', NOSCRIPT + r'\n\1', s, count=1)      # before the page's content; the start page has no <main>


texts = {}
for path, c in PAGES.items():
    s = open(path, encoding='utf-8').read()
    s = re.sub(r'<!--seo-->.*?<!--/seo-->\n?', '', s, flags=re.S)
    s = re.sub(r'<meta (name="description"|name="author"|property="og:[^"]+"|name="twitter:[^"]+")[^>]*>\n?', '', s)        # what an earlier hand put there
    s = re.sub(r'<link rel="canonical"[^>]*>\n?', '', s)
    s = re.sub(r'<title>.*?</title>', f'<title>{esc(c["title"])}</title>', s, count=1, flags=re.S)
    assert '<meta name="referrer"' in s, path
    s = re.sub(r'(<meta name="referrer"[^>]*>\n)', lambda m: m.group(1) + head_block(path, c, s) + '\n', s, count=1)
    s = menu(s)
    open(path, 'w', encoding='utf-8').write(s); texts[path] = text_of(s)
for path in MENU_ONLY:
    s = open(path, encoding='utf-8').read(); open(path, 'w', encoding='utf-8').write(menu(s))

# ---------------------------------------------------------------- llms.txt, llms-full.txt, robots.txt
src = open('content/llms.txt', encoding='utf-8').read()
absolute = lambda t: re.sub(r'\]\((?!https?:|mailto:)([^)]+)\)', lambda m: f']({SITE}/{m.group(1)})', t)
open('llms.txt', 'w', encoding='utf-8').write(absolute(src).rstrip() + f'\n\n## For assistants\n- [All texts of the main pages in one file]({SITE}/llms-full.txt)\n- [Sitemap]({SITE}/sitemap.xml)\n- [Blog feed, English]({SITE}/blog/feed.xml), [German]({SITE}/blog/de/feed.xml)\n')

full = [f'# {NAME}\n\n> The main pages of {SITE} as plain text, made from the pages themselves by scripts/seo.py. For the short guide see {SITE}/llms.txt.\n']
for path in PAGES:
    full.append(f'\n---\n\nPage: {SITE}/{"" if path == "index.html" else path}\n\n{texts[path]}\n')
blog = open('blog.html', encoding='utf-8').read() if os.path.exists('blog.html') else ''
entries = re.findall(r'<li class="entry"[^>]*data-date="([^"]+)".*?<a class="entry-link" href="([^"]+)">.*?class="entry-title">(.*?)</strong>.*?<p class="entry-intro">(.*?)</p>', blog, re.S)
if entries:
    full.append(f'\n---\n\nPage: {SITE}/blog.html\n\n## Blog: Food for thought\n\n{len(entries)} essays, each on its own page, each also in German (see {SITE}/blog/de/index.html).\n\n' +
                '\n'.join(f'- {d}: [{html.unescape(t)}]({SITE}/{u}). {html.unescape(i)}' for d, u, t, i in entries) + '\n')
tl = open('timeline.html', encoding='utf-8').read() if os.path.exists('timeline.html') else ''
yrs = re.findall(r'<li class="yr" id="(\d{4})".*?class="tag yr-count">(.*?)</p>', tl, re.S)
if yrs:
    full.append(f'\n---\n\nPage: {SITE}/timeline.html\n\n## Timeline: A life in frames\n\nA photo archive by year. Each year has an album page.\n\n' + '\n'.join(f'- [{y}]({SITE}/timeline/{y}.html): {c}' for y, c in yrs) + '\n')
open('llms-full.txt', 'w', encoding='utf-8').write(''.join(full))

open('robots.txt', 'w', encoding='utf-8').write(f'''# Everyone may read this site: search engines and the crawlers of AI assistants alike
# (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, Applebot-Extended, CCBot and others).
# A short guide for assistants is at /llms.txt, the main texts in one file at /llms-full.txt.
User-agent: *
Allow: /
Disallow: /assets/source/

Sitemap: {SITE}/sitemap.xml
''')
print('pages:', ', '.join(PAGES), '| llms.txt', len(open('llms.txt').read()), 'chars | llms-full.txt', len(''.join(full).split()), 'words')

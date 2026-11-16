"""What every build script of the site has to agree on. Imported by seo.py, build-blog.py and build-timeline.py.

AT LAUNCH: put the real address into SITE, then run
    python3 scripts/build-timeline.py && python3 scripts/build-blog.py && python3 scripts/seo.py
and commit. Every canonical link, link preview, feed, sitemap entry and llms.txt then names the real domain.
"""
SITE = 'https://new.chrishelmbrecht.com'      # where the site lives, without a slash at the end
NAME = 'Chris Helmbrecht'
ME = SITE + '/#chris'                         # the name search engines know Chris by across all pages (structured data)
OG = SITE + '/assets/og.jpg'                  # the picture for link previews when a page has none of its own

# ---------------------------------------------------------------- two languages
# Every page exists in English and in German. English lives at the plain addresses (bio.html), German beside it under de/
# (de/bio.html); blog and timeline keep their own folders (blog/de/…, timeline/de/…). js/lang.js sends a browser set to
# German to the German pages; the switch in the header (js/site.js) goes from each page to its twin.
LANGS = ('en', 'de')
PLAIN = ('index.html', 'bio.html', 'dj.html', 'writing.html', 'press.html', 'contact.html', 'making-of.html')   # the hand-written pages
DE = {**{p: 'de/' + p for p in PLAIN}, 'blog.html': 'blog/de/index.html', 'timeline.html': 'timeline/de/index.html'}
def de(href):
    """The German twin of an English address inside the site. Pages that exist in one language only stay as they are."""
    page, sep, rest = href.partition('#')
    return DE.get(page, page) + sep + rest
def address(path):
    """A page's full address. The two start pages are named without index.html."""
    return SITE + '/' + {'index.html': '', 'de/index.html': 'de/'}.get(path, path)
def alternates(en, de_):
    """What a page with a twin carries in its head: both addresses for search engines, and the script that picks the language."""
    return (f'<link rel="alternate" hreflang="en" href="{address(en)}">\n<link rel="alternate" hreflang="de" href="{address(de_)}">\n'
            f'<link rel="alternate" hreflang="x-default" href="{address(en)}">\n<script src="js/lang.js"></script>\n')

# The site's pages in menu order: what a visitor without script, a search engine or an assistant gets as the way around.
# The same names are in js/site.js, which builds the menu people see.
NAV = {'en': [('The Skull', 'index.html'), ('DJ', 'dj.html'), ('Bio', 'bio.html'), ('Writing', 'writing.html'), ('Timeline', 'timeline.html'),
              ('Blog', 'blog.html'), ('Press', 'press.html'), ('Contact', 'contact.html'), ('Making of', 'making-of.html')],
       'de': [('Der Schädel', 'index.html'), ('DJ', 'dj.html'), ('Bio', 'bio.html'), ('Autor', 'writing.html'), ('Timeline', 'timeline.html'),
              ('Blog', 'blog.html'), ('Presse', 'press.html'), ('Kontakt', 'contact.html'), ('Making-of', 'making-of.html')]}
OTHER = {'en': ('de', 'Deutsch'), 'de': ('en', 'English')}
def noscript(lang='en', twin=None):
    """The menu as plain links, with the way to the same page in the other language at its end (twin: that page's address)."""
    o, name = OTHER[lang]
    links = ''.join(f'<a href="{de(h) if lang == "de" else h}">{t}</a>' for t, h in NAV[lang])
    return f'<noscript><nav class="plain-nav" aria-label="Site">{links}' + (f'<a href="{twin}" lang="{o}" hreflang="{o}">{name}</a>' if twin else '') + '</nav></noscript>'

import json
def person(full=False, lang='en'):
    """Chris as structured data: short where he is only referred to, full on the start page and the bio."""
    p = {'@type': 'Person', '@id': ME, 'name': NAME, 'url': SITE + '/'}
    if full:
        p.update({'description': 'DJ, Autor des Buchs „Fucking Moskau!“ und Markenberater in München.' if lang == 'de' else 'DJ, author of the book “Fucking Moskau!” and brand consultant in Munich.',
                  'jobTitle': ['DJ', 'Autor', 'Markenberater'] if lang == 'de' else ['DJ', 'Author', 'Brand consultant'],
                  'birthDate': '1971', 'birthPlace': {'@type': 'City', 'name': 'München' if lang == 'de' else 'Munich'}, 'homeLocation': {'@type': 'City', 'name': 'München' if lang == 'de' else 'Munich'},
                  'sameAs': ['https://www.instagram.com/chrishelmbrecht/', 'https://soundcloud.com/chrishelmbrecht', 'https://www.mixcloud.com/chrishelmbrecht/',
                             'https://www.facebook.com/chrishelmbrecht/', 'https://t.me/ChrisHelmbrecht', 'https://fuckingmoskau.de', 'https://dieneue.social']})
    return p
def crumbs(*steps, lang='en'):
    """The way from the start page to this one. steps: (name, path) pairs; in German the start page is de/."""
    first = ('Chris Helmbrecht', 'de/index.html' if lang == 'de' else 'index.html')
    return {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': i, 'name': n, 'item': address(u)} for i, (n, u) in enumerate((first,) + steps, 1)]}
def ld(*nodes):
    """The structured data of a page, as the one script block search engines read. </ is broken up so nothing in a text can end the block."""
    return '<script type="application/ld+json">' + json.dumps({'@context': 'https://schema.org', '@graph': list(nodes)}, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + '</script>'

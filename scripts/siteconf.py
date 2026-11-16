"""What every build script of the site has to agree on. Imported by seo.py, build-blog.py and build-timeline.py.

AT LAUNCH: put the real address into SITE, then run
    python3 scripts/seo.py && python3 scripts/build-blog.py && python3 scripts/build-timeline.py
and commit. Every canonical link, link preview, feed, sitemap entry and llms.txt then names the real domain.
"""
SITE = 'https://new.chrishelmbrecht.com'      # where the site lives, without a slash at the end
NAME = 'Chris Helmbrecht'
ME = SITE + '/#chris'                         # the name search engines know Chris by across all pages (structured data)
OG = SITE + '/assets/og.jpg'                  # the picture for link previews when a page has none of its own

# The site's pages in menu order: what a visitor without script, a search engine or an assistant gets as the way around
NAV = [('The Skull', 'index.html'), ('DJ', 'dj.html'), ('Bio', 'bio.html'), ('Writing', 'writing.html'), ('Timeline', 'timeline.html'),
       ('Blog', 'blog.html'), ('Press', 'press.html'), ('Contact', 'contact.html'), ('Making of', 'making-of.html')]
NOSCRIPT = '<noscript><nav class="plain-nav" aria-label="Site">' + ''.join(f'<a href="{h}">{t}</a>' for t, h in NAV) + '</nav></noscript>'

import json
def person(full=False):
    """Chris as structured data: short where he is only referred to, full on the start page and the bio."""
    p = {'@type': 'Person', '@id': ME, 'name': NAME, 'url': SITE + '/'}
    if full:
        p.update({'description': 'DJ, author of the book “Fucking Moskau!” and brand consultant in Munich.', 'jobTitle': ['DJ', 'Author', 'Brand consultant'],
                  'birthDate': '1971', 'birthPlace': {'@type': 'City', 'name': 'Munich'}, 'homeLocation': {'@type': 'City', 'name': 'Munich'},
                  'sameAs': ['https://www.instagram.com/chrishelmbrecht/', 'https://soundcloud.com/chrishelmbrecht', 'https://www.mixcloud.com/chrishelmbrecht/',
                             'https://www.facebook.com/chrishelmbrecht/', 'https://t.me/ChrisHelmbrecht', 'https://fuckingmoskau.de', 'https://dieneue.social']})
    return p
def crumbs(*steps):
    return {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': i, 'name': n, 'item': SITE + '/' + u} for i, (n, u) in enumerate((('Chris Helmbrecht', ''),) + steps, 1)]}
def ld(*nodes):
    """The structured data of a page, as the one script block search engines read. </ is broken up so nothing in a text can end the block."""
    return '<script type="application/ld+json">' + json.dumps({'@context': 'https://schema.org', '@graph': list(nodes)}, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + '</script>'

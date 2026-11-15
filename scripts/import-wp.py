#!/usr/bin/env python3
"""One-off: take the articles of the old WordPress site into content/blog/ (one document per article and language).

  import-wp.py <posts.json from /wp-json/wp/v2/posts?per_page=100&_embed=1> content/blog [--report file]

Each article becomes a folder (date and the first words of its English address) with en.html and de.html:
a few lines of facts on top, then the text. The text is taken as written; only the page builder's wrapping is
removed (Elementor's boxes, spans and style classes), empty paragraphs go, and players from other sites (YouTube,
Spotify) become plain links, because this site embeds nothing foreign. Scripts and what only they can draw are
dropped and named in the report. Nothing is rewritten or shortened.
The main categories are a proposal: the old site's thirty-odd categories folded into five (MAIN below).
"""
import sys, json, re, html, os, collections
from html.parser import HTMLParser

src, out = sys.argv[1], sys.argv[2]
report_to = sys.argv[sys.argv.index('--report') + 1] if '--report' in sys.argv else None
posts = json.load(open(src))

MAIN = {
    'politics': ['Politics', 'Elections', 'Political Parties', 'Chancellor', 'Politik', 'Wahl'],
    'economy': ['Economy', 'Business', 'Brands', 'Investors', 'Wirtschaft', 'Zölle', 'Globalization'],
    'geopolitics': ['GeoStrategy', 'War', 'Russia', 'Ukraine', 'Middle East', 'Latin America', 'Geo-Strategie', 'Stragtegie', 'Verteidigung', 'Russland', 'Mittlerer Osten', 'Lateinamerika'],
    'germany': ['Germany', 'Bavaria', 'Munich', 'Deutschland', 'Bayern'],
    'society': ['Culture', 'Music', 'Media', 'Philosophy', 'Psychologie', 'Sports', 'Subculture', 'School', 'Violence', 'Future', 'Kultur', 'Musik', 'Medien', 'Philosophie', 'Sport', 'Subkultur', 'Schule', 'Gewalt', 'Zukunft', 'Immigration', 'UAP'],
}
KEEP = {'p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a', 'strong', 'em', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'figcaption', 'hr', 'sup', 'sub'}
SAME = {'b': 'strong', 'i': 'em', 'h1': 'h2', 'h5': 'h4', 'h6': 'h4'}
GONE = {'script', 'style', 'head', 'title', 'canvas', 'video', 'svg', 'noscript', 'form', 'button', 'nav'}
VOID = {'br', 'hr'}


class Clean(HTMLParser):
    def __init__(self, lang):
        super().__init__(convert_charrefs=True)
        self.say = dict(en=('Watch the video on YouTube', 'Listen on Spotify'), de=('Das Video auf YouTube ansehen', 'Auf Spotify anhören'))[lang]
        self.o, self.skip, self.lost, self.open = [], 0, collections.Counter(), []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in GONE:
            self.skip += 1; self.lost[tag] += 1; return
        if self.skip: return
        if tag == 'iframe':
            u = a.get('src', '')
            m = re.search(r'youtube\.com/embed/([\w-]+)', u)
            if m:
                t = re.search(r'start=(\d+)', u)
                self.o.append(f'<p class="embed"><a href="https://www.youtube.com/watch?v={m.group(1)}{"&amp;t=" + t.group(1) + "s" if t else ""}" target="_blank" rel="noopener">{self.say[0]}</a></p>')
            m = re.search(r'open\.spotify\.com/embed/(\w+)/(\w+)', u)
            if m: self.o.append(f'<p class="embed"><a href="https://open.spotify.com/{m.group(1)}/{m.group(2)}" target="_blank" rel="noopener">{self.say[1]}</a></p>')
            self.lost['player from another site, now a link'] += 1; return
        tag = SAME.get(tag, tag)
        if tag == 'img': self.lost['picture inside the text'] += 1; return
        if tag not in KEEP: return
        if tag == 'a':
            h = a.get('href', '')
            if not re.match(r'(https?:|mailto:)', h): return
            self.o.append(f'<a href="{html.escape(h, True)}"' + ('' if h.startswith('mailto:') else ' target="_blank" rel="noopener"') + '>'); self.open.append('a'); return
        extra = ''.join(f' {k}="{int(a[k])}"' for k in ('colspan', 'rowspan') if tag in ('td', 'th') and a.get(k, '').isdigit())
        self.o.append(f'<{tag}{extra}>')
        if tag not in VOID: self.open.append(tag)

    def handle_endtag(self, tag):
        if tag in GONE:
            self.skip = max(0, self.skip - 1); return
        tag = SAME.get(tag, tag)
        if self.skip or tag not in KEEP or tag in VOID: return
        if tag in self.open:
            while self.open:
                t = self.open.pop(); self.o.append(f'</{t}>')
                if t == tag: break

    def handle_data(self, d):
        if not self.skip: self.o.append(html.escape(d, False))


def clean(h, lang):
    c = Clean(lang); c.feed(h); c.close()
    s = ''.join(c.o).replace('\xa0', ' ')
    s = re.sub(r'[ \t\r\f\v]+', ' ', s)
    for _ in range(3):
        s = re.sub(r'<(p|h2|h3|h4|li|strong|em|blockquote|a[^>]*)>\s*(<br>\s*)*</(p|h2|h3|h4|li|strong|em|blockquote|a)>', '', s)
    s = re.sub(r'<p>\s*(<br>\s*)+', '<p>', s); s = re.sub(r'(\s*<br>)+\s*</p>', '</p>', s)
    s = re.sub(r'<(h[234])>\s*<strong>(.*?)</strong>\s*</\1>', r'<\1>\2</\1>', s)
    s = re.sub(r'\s*\n\s*', '\n', s)
    s = re.sub(r'\s*<(p|h2|h3|h4|ul|ol|li|blockquote|table|thead|tbody|tr|hr)([ >])', r'\n<\1\2', s)
    s = re.sub(r'</(p|h2|h3|h4|ul|ol|blockquote|table)>\s*', r'</\1>\n', s)
    s = re.sub(r'\n{2,}', '\n', s).strip()
    # text that stands loose between blocks (the page builder allowed it) becomes a paragraph
    lines = [l if l.startswith('<') and not re.match(r'<(strong|em|a|br|sup|sub)\b', l) else f'<p>{l}</p>' for l in s.split('\n') if l.strip()]
    return '\n'.join(lines), c.lost


def text(h):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', h))).strip()


def intro(p):
    t = text(p['excerpt']['rendered'])
    cut = re.search(r'\s*(\[…\]|\[\.\.\.\]|…)\s*$', t)
    if cut:                                        # WordPress cut it off itself: keep whole sentences only
        t = t[:cut.start()]
        m = list(re.finditer(r'[.!?](?=\s|$)', t))
        t = t[:m[-1].end()] if m else t
    return t.strip()


lang = lambda p: 'en' if '/en/' in p['link'] else 'de'
media = lambda p: (p.get('_embedded', {}).get('wp:featuredmedia') or [{}])[0]
stem = lambda p: re.sub(r'(-\d+|-scaled)*\.\w+$', '', (media(p).get('source_url') or '').split('/')[-1])
terms = lambda p, tax: [t['name'] for g in p.get('_embedded', {}).get('wp:term', []) for t in g if isinstance(t, dict) and t.get('taxonomy') == tax]

pairs, left = [], [p for p in posts if lang(p) == 'de']
for en in sorted((p for p in posts if lang(p) == 'en'), key=lambda p: p['date']):
    same = [d for d in left if d['date'][:10] == en['date'][:10]]
    de = next((d for d in same if stem(d) == stem(en)), same[0] if len(same) == 1 else None)
    if de: left.remove(de)
    pairs.append((en, de))
assert not left, [p['slug'] for p in left]

report, pics = [], []
for en, de in pairs:
    aid = f"{en['date'][:10]}-{'-'.join(en['slug'].split('-')[:4])}"
    os.makedirs(f'{out}/{aid}', exist_ok=True)
    names = set(terms(en, 'category')) | set(terms(de, 'category') if de else [])
    cats = [k for k, v in MAIN.items() if names & set(v)]
    m = media(en)
    if m.get('source_url'): pics.append(f"{aid}\t{m['source_url']}")
    for p, other in ((en, de), (de, en)):
        if not p: continue
        body, lost = clean(p['content']['rendered'], lang(p))
        tags = list(dict.fromkeys(terms(p, 'post_tag')))
        head = [('id', aid), ('lang', lang(p)), ('slug', p['slug']), ('title', html.unescape(p['title']['rendered'])), ('short', ''),
                ('date', p['date'][:10]), ('updated', p['modified'][:10] if p['modified'][:10] != p['date'][:10] else ''),
                ('intro', intro(p)), ('teaser', ''), ('image', aid if m.get('source_url') else ''), ('alt', (media(p).get('alt_text') or '').strip()), ('focus', '50% 50%'), ('credit', ''),
                ('categories', ', '.join(cats)), ('tags', '; '.join(tags)), ('featured', 'no'), ('draft', 'no'), ('old', p['link'])]
        open(f'{out}/{aid}/{lang(p)}.html', 'w').write('\n'.join(f'{k}: {v}' for k, v in head) + '\n---\n' + body + '\n')
        report.append(dict(id=aid, lang=lang(p), title=head[3][1], words=len(text(body).split()), lost=dict(lost), no_alt=not head[9][1], intro_len=len(head[7][1]), cats=cats))
open(f'{out}/pictures.tsv', 'w').write('\n'.join(pics) + '\n')
if report_to: json.dump(report, open(report_to, 'w'), ensure_ascii=False, indent=1)
print(len(pairs), 'articles,', len(report), 'documents,', len(pics), 'pictures')

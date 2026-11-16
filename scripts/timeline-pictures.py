#!/usr/bin/env python3
"""Take photographs into the timeline: make their web sizes and enter them in the year's document.

  timeline-pictures.py <folder with the originals>            every year found there
  timeline-pictures.py <folder> 1997 2003                     only these years
  timeline-pictures.py <folder> --hold "1986/Scan_12.jpg"     take this one in as a draft (repeat as needed)
  timeline-pictures.py <folder> --hold-list FILE              the same for many: one "year/name | note" per line
  timeline-pictures.py <folder> --again                       make the web sizes of everything anew

The originals lie in one folder per year (<folder>/1997/anything.jpg) and stay where they are: they are
never copied into the site. For every picture that is new, this script
  - gives it the next free id of its year (1997-10). An id never changes again, whatever happens to the order;
  - writes three web sizes into assets/timeline/1997/: 1997-10-s.webp (320 high), -m.webp (640 high) and
    -l.webp (1800 on the long side, never larger than the original). Upright as the camera meant it, colours
    brought to sRGB, and without any of the original's hidden data (place, camera, date);
  - adds a block for it at the end of content/timeline/1997.txt, which scripts/build-timeline.py explains.
Pictures already entered are left alone, text and all. A photo that is a draft gets no web sizes: nothing of
it lies in the site. Not even its name: a picture taken in as a draft is entered under a mark made from its
name (file: #3f9c…), because file names can say who is in a picture, and this repository is public. After this, run scripts/build-timeline.py.
"""
import sys, os, re, io, hashlib
from PIL import Image, ImageOps, ImageCms

args = sys.argv[1:]
hold, again, years, src = {}, False, [], None
while args:
    a = args.pop(0)
    if a == '--hold': hold[args.pop(0)] = ''
    elif a == '--hold-list':
        for line in open(args.pop(0), encoding='utf-8'):
            if line.strip(): k, _, note = line.partition('|'); hold[k.strip()] = note.strip()
    elif a == '--again': again = True
    elif re.fullmatch(r'\d{4}', a): years.append(a)
    else: src = a
assert src and os.path.isdir(src), __doc__
DOCS, OUT = 'content/timeline', 'assets/timeline'
SIZES = (('s', 320), ('m', 640))          # by height: on a contact sheet the rows are as high as each other
LONG = 1800                               # the large view, on its long side
PIC = ('.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff')
natural = lambda s: [int(t) if t.isdigit() else t.lower() for t in re.split(r'(\d+)', s)]
SRGB = ImageCms.createProfile('sRGB')
mark = lambda year, f: '#' + hashlib.sha1(f'{year}/{f}'.encode('utf-8')).hexdigest()[:12]      # stands for a file name without giving it away

YEAR_HEAD = '''year: {y}
title_en:
title_de:
text_en:
text_de:
places:
lead:
previews:
draft: no
'''
PHOTO = '''
photo: {id}
file: {file}
size: {w}x{h}
caption_en:
caption_de:
alt_en:
alt_de:
place:
when:
credit:
focus: 50% 50%
draft: {draft}
'''


def load(path):
    im = ImageOps.exif_transpose(Image.open(path))
    icc = im.info.get('icc_profile')
    if im.mode not in ('RGB', 'L'): im = im.convert('RGB')
    if icc:
        try: im = ImageCms.profileToProfile(im, ImageCms.ImageCmsProfile(io.BytesIO(icc)), SRGB, outputMode='RGB')
        except Exception: pass                     # an odd profile: the picture goes in as it is
    return im.convert('RGB')


def sizes(im, year, pid):
    os.makedirs(f'{OUT}/{year}', exist_ok=True)
    k = min(1, LONG / max(im.size))
    big = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS) if k < 1 else im
    big.save(f'{OUT}/{year}/{pid}-l.webp', quality=80, method=6)
    for tag, h in SIZES:
        h = min(h, big.height)
        big.resize((max(1, round(big.width * h / big.height)), h), Image.LANCZOS).save(f'{OUT}/{year}/{pid}-{tag}.webp', quality=76, method=6)
    return big.size


os.makedirs(DOCS, exist_ok=True)
new = made = 0
for year in sorted(d for d in os.listdir(src) if re.fullmatch(r'\d{4}', d) and os.path.isdir(f'{src}/{d}')):
    if years and year not in years: continue
    doc = f'{DOCS}/{year}.txt'
    text = open(doc, encoding='utf-8').read() if os.path.exists(doc) else YEAR_HEAD.format(y=year)
    blocks = re.findall(r'^photo:\s*(\S+)\s*\n((?:(?!\n\s*\n).)*)', text, re.M | re.S)
    known = {}                                     # file name -> (id, is a draft)
    for pid, rest in blocks:
        f = re.search(r'^file:\s*(.+)$', rest, re.M); d = re.search(r'^draft:\s*(\S+)', rest, re.M)
        if f: known[f.group(1).strip()] = (pid, bool(d and d.group(1).lower() in ('yes', 'true', '1')))
    last = max([int(pid.split('-')[-1]) for pid, _ in blocks if pid.split('-')[-1].isdigit()] or [0])
    for f in sorted((f for f in os.listdir(f'{src}/{year}') if f.lower().endswith(PIC)), key=natural):
        if f in known or mark(year, f) in known:
            pid, draft = known.get(f) or known[mark(year, f)]
            if not draft and (again or not os.path.exists(f'{OUT}/{year}/{pid}-l.webp')):
                sizes(load(f'{src}/{year}/{f}'), year, pid); made += 1
            continue
        last += 1; pid = f'{year}-{last:02d}'; draft = f'{year}/{f}' in hold; note = hold.get(f'{year}/{f}', '')
        im = load(f'{src}/{year}/{f}')
        if draft:
            k = min(1, LONG / max(im.size)); w, h = round(im.width * k), round(im.height * k)
        else:
            w, h = sizes(im, year, pid); made += 1
        text = text.rstrip('\n') + '\n' + PHOTO.format(id=pid, file=mark(year, f) if draft else f, w=w, h=h, draft='yes' if draft else 'no') + (f'note: {note}\n' if draft and note else '')
        new += 1
        print(('held  ' if draft else 'new   ') + pid, f, f'{w}x{h}')
    open(doc, 'w', encoding='utf-8').write(text)
print(f'{new} new photographs entered, web sizes made for {made}. Now: python3 scripts/build-timeline.py')

#!/usr/bin/env python3
"""Make the web sizes of the blog's pictures.

  blog-pictures.py <folder with the originals> assets/blog

An original is named after its article's folder in content/blog (2026-01-04-venezuela-january-3-2026.jpg, any
picture format). Out come <name>-480.webp, -960.webp and -1600.webp (the last only as large as the original
allows), <name>-og.jpg for link previews, and pictures.json with every picture's width and height, which
scripts/build-blog.py reads. Run it again after adding a picture; existing ones are redone only with --all.
"""
import sys, os, json, glob
from PIL import Image, ImageOps

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
known = json.load(open(f'{out}/pictures.json')) if os.path.exists(f'{out}/pictures.json') else {}
for f in sorted(glob.glob(f'{src}/*')):
    name, ext = os.path.splitext(os.path.basename(f))
    if ext.lower() not in ('.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff') or (name in known and '--all' not in sys.argv): continue
    im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
    sizes = []
    for w in (480, 960, 1600):
        w = min(w, im.width)
        if w in sizes: continue
        sizes.append(w)
        im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(f'{out}/{name}-{w}.webp', quality=78 if w < 1600 else 80, method=6)
    og = ImageOps.fit(im, (1200, 630), Image.LANCZOS) if im.width >= 1200 else im
    og.save(f'{out}/{name}-og.jpg', quality=82, optimize=True, progressive=True)
    known[name] = dict(w=im.width, h=im.height, sizes=sizes)
    print(name, im.size, sizes)
json.dump(known, open(f'{out}/pictures.json', 'w'), indent=1, sort_keys=True)

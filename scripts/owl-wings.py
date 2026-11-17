#!/usr/bin/env python3
"""The owl in flight: one wing beat as a strip of pictures with a see-through background.

  python3 scripts/owl-wings.py assets/source/owl-flight-624.mp4 assets/owl-fly.webp      (needs ffmpeg, Pillow, numpy, scipy)

The film (Midjourney: the site's owl redrawn in flight, then animated there as a loop, ink on white) shows the owl
beating its wings on the spot. This script takes one beat out of it (36 frames from frame 22: that stretch closes on
itself), cuts the owl free of the white (the white that reaches the frame's edge is background, and so are clean white
holes between the feathers; the owl's own light face is hatched and stays), softens the outline, and lays every second
frame side by side: 18 pictures, 360 px wide each. The pages show them one after the other (css/site.css `.wing`,
css/contact.css `.pc-fly`). The owl looks to the left; where it flies to the right the pages mirror it.
"""
import sys, subprocess, tempfile, glob, os
import numpy as np
from PIL import Image
from scipy import ndimage as nd

film, out = sys.argv[1], sys.argv[2]
START, LENGTH, STEP, CELL, WHITE = 22, 36, 2, 360, 236
with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', film, os.path.join(tmp, '%03d.png')], check=True)
    files = sorted(glob.glob(os.path.join(tmp, '*.png')))[START:START + LENGTH]
    cut = []
    for f in files:
        a = np.asarray(Image.open(f).convert('RGB')).astype(np.float32); light = a.min(axis=2)
        lab, _ = nd.label(light > WHITE); rim = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])); paper = np.isin(lab, rim[rim > 0])
        holes = (light > WHITE) & ~paper; hl, hn = nd.label(holes)
        for i in range(1, hn + 1):
            if (hl == i).sum() >= 40 and light[hl == i].mean() > 248: paper |= hl == i
        owl = nd.binary_opening(~paper, structure=np.ones((3, 3)))                       # specks go
        parts, n = nd.label(owl)
        if n > 1: size = nd.sum(owl, parts, range(1, n + 1)); owl = np.isin(parts, [i + 1 for i, v in enumerate(size) if v >= .02 * size.max()])
        edge = nd.binary_dilation(~owl, iterations=2)
        alpha = np.where(owl, np.where(edge, np.clip((250 - light) / 70, 0, 1), 1.), 0.)[..., None]
        ink = np.clip(np.where(alpha > .02, (a - 255 * (1 - alpha)) / np.maximum(alpha, .02), a), 0, 255)   # the white taken back out of the soft outline
        cut.append(Image.fromarray(np.dstack([ink, alpha * 255]).astype(np.uint8), 'RGBA'))
boxes = [c.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox() for c in cut]
box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
h = round(CELL * (box[3] - box[1]) / (box[2] - box[0])); frames = cut[::STEP]
strip = Image.new('RGBA', (CELL * len(frames), h), (0, 0, 0, 0))
for i, c in enumerate(frames): strip.paste(c.crop(box).resize((CELL, h), Image.LANCZOS), (i * CELL, 0))
strip.save(out, quality=70, alpha_quality=85, method=6)
print(f'{out}: {len(frames)} pictures of {CELL} x {h}, cut from {box}')

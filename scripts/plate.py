#!/usr/bin/env python3
"""Turn an ink drawing on paper (Midjourney) into a plate for the bio: the paper becomes see-through, the ink keeps its colour,
and the picture is cropped to the drawing.

  plate.py in.png out.webp [--width 600] [--key 8,80]

Prints the size to put into the plate's `--w`/`--h` (half the pixel size, so the plate is sharp on dense screens).
"""
import argparse
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out'); ap.add_argument('--width', type=int, default=600); ap.add_argument('--key', default='8,80')
a = ap.parse_args(); hi, lo = map(float, a.key.split(','))
im = np.asarray(Image.open(a.src).convert('RGB')).astype(np.float32)
paper = np.median(np.concatenate([im[:20].reshape(-1, 3), im[:, :20].reshape(-1, 3)]), axis=0)
lum = lambda v: v @ np.array([.299, .587, .114], np.float32)
al = np.clip((lum(paper) - lum(im) - hi) / (lo - hi), 0, 1)
rgb = np.where(al[..., None] > .02, (im - (1 - al[..., None]) * paper) / np.maximum(al[..., None], .02), im).clip(0, 255)
ys, xs = np.where(al > .15); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
m = 6; y0, x0, y1, x1 = max(0, y0 - m), max(0, x0 - m), min(im.shape[0], y1 + m), min(im.shape[1], x1 + m)
out = Image.fromarray(np.dstack([rgb, al * 255])[y0:y1, x0:x1].round().astype(np.uint8), 'RGBA')
if out.width > a.width: out = out.resize((a.width, round(out.height * a.width / out.width)), Image.LANCZOS)
out.save(a.out, quality=74, method=6)
print(f'{a.out}: {out.width} x {out.height}  ->  --w:{out.width // 2};--h:{out.height // 2}')

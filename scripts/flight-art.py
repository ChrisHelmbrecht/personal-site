#!/usr/bin/env python3
"""Turn the Midjourney ink drawings for the flying lesson into see-through layers (assets/flight/*.webp).

  flight-art.py <folder with cockpit.png, pano1.png, forest.png, airfield.png> <output folder>

Each drawing is ink on paper. The paper becomes transparent, the ink keeps its colour. The cockpit needs more care:
only the glass (the large light areas) may become see-through, light parts of the airframe (rivets, the instrument
box, the pale grip of the stick) stay solid.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]


def load(name):
    return np.asarray(Image.open(f'{src}/{name}.png').convert('RGB')).astype(np.float32)


def lum(a):
    return a @ np.array([.299, .587, .114], np.float32)


def key(a, paper, hi, lo):
    """alpha from how much darker than the paper a pixel is; colour with the paper taken back out"""
    d = lum(paper[None, None, :])[0, 0] - lum(a)
    alpha = np.clip((d - hi) / (lo - hi), 0, 1)
    rgb = np.where(alpha[..., None] > .02, (a - (1 - alpha[..., None]) * paper) / np.maximum(alpha[..., None], .02), a)
    return np.clip(rgb, 0, 255), alpha


def save(rgb, alpha, name, width=None, q=82):
    im = Image.fromarray(np.dstack([rgb, alpha * 255]).round().astype(np.uint8), 'RGBA')
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(f'{out}/{name}.webp', quality=q, method=6)
    print(name, im.size)


def rows(alpha, thr=.02):
    r = np.where(alpha.mean(axis=1) > thr)[0]
    return r[0], r[-1] + 1


# --- skyline: Olympiaturm, tent roof, Frauenkirche, the Alps. White sky, a dark band of trees as its foot
a = load('pano1')
paper = np.median(a[:30].reshape(-1, 3), axis=0)
rgb, al = key(a, paper, 6, 70)
top, _ = rows(al, .002)
foot = np.where(al.mean(axis=1) > .6)[0][-1] + 1                    # last row of the band of trees
rgb, al = rgb[max(0, top - 4):foot], al[max(0, top - 4):foot]
x = np.linspace(0, 1, al.shape[1]); al = al * np.clip(np.minimum(x, 1 - x) / .06, 0, 1)[None, :]   # both ends fade into the open horizon
save(rgb, al, 'skyline', q=84)

# --- forest edge: grey paper, trees on one ground line. The picture is mirrored when tiled, so the ends need no care
a = load('forest')
paper = np.median(a[:40].reshape(-1, 3), axis=0)
rgb, al = key(a, paper, 10, 80)
top, _ = rows(al, .01)
foot = np.where(al.mean(axis=1) > .75)[0][-1] + 1
save(rgb[top:foot], al[top:foot], 'forest', width=1600, q=80)

# --- airfield: hangar and tower. Walls are pale, so everything inside the outlines is kept solid
a = load('airfield')
paper = np.median(a[:40].reshape(-1, 3), axis=0)
rgb, al = key(a, paper, 8, 60)
solid = ndi.binary_fill_holes(ndi.binary_closing(al > .3, iterations=3))
solid = ndi.binary_opening(solid, iterations=4)
solid[:, :250] = False; solid[:, 1425:] = False                      # the buildings, not the low scrub on the same ground line
al2 = np.maximum(al, ndi.gaussian_filter(solid.astype(np.float32), 1.2))
rgb2 = np.where(solid[..., None], a, rgb)
cols = np.where(solid.any(axis=0))[0]; cols = [max(0, cols[0] - 14), min(a.shape[1], cols[-1] + 14)]
top, _ = rows(al2[:, cols[0]:cols[-1]], .004)
foot = np.where(solid.any(axis=1))[0][-1] + 1
rgb2, al2 = rgb2[top:foot, cols[0]:cols[-1]], al2[top:foot, cols[0]:cols[-1]]
x = np.linspace(0, 1, al2.shape[1]); al2 = al2 * np.clip(np.minimum(x, 1 - x) / .012, 0, 1)[None, :]
save(rgb2, al2, 'airfield', width=1200, q=84)

# --- cockpit: the paper margin goes, the glass becomes see-through, the airframe stays
a = load('cockpit')
X0, Y0, X1, Y1 = 42, 55, 1412, 764
grip = Image.new('L', (a.shape[1], a.shape[0]), 0)                   # the pale grip of the cyclic would vanish with the glass
ImageDraw.Draw(grip).polygon([(700, 816), (694, 730), (700, 700), (716, 686), (740, 682), (764, 688), (780, 704), (786, 734), (780, 816)], fill=255)
grip = np.asarray(grip.filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255
paper = np.array([240, 238, 232], np.float32)
soft = ndi.median_filter(lum(a), 7)                                  # without the stipple
light = soft > 168
lab, n = ndi.label(light)
size = ndi.sum(light, lab, range(1, n + 1))
glass = np.isin(lab, 1 + np.where(size > 6000)[0])                   # the panes: large light areas
glass = ndi.binary_dilation(glass, iterations=2) & (lum(a) > 120)    # up to the ink of the frame
glass &= grip < .5
rgb, al = key(a, paper, 34, 120)                                     # inside the glass only real ink stays: stipple and haze go
alpha = np.where(glass, al, 1.0)
alpha = np.maximum(alpha, grip)
edge = ndi.gaussian_filter(glass.astype(np.float32), .8)             # soften the cut between glass and frame
alpha = np.where(glass, alpha, np.clip(1 - edge + al, 0, 1))
col = np.where(glass[..., None], rgb, a)
col = np.where(grip[..., None] > .5, np.clip(a * .96, 0, 255), col)
col, alpha = col[Y0:, X0:X1], alpha[Y0:, X0:X1]                      # the grip may reach below the picture's own edge
alpha[Y1 - Y0:] *= (grip[Y1:, X0:X1] > .2)
save(col, alpha, 'cockpit', q=86)

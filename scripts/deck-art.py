#!/usr/bin/env python3
"""Take the Midjourney ink drawing of the turntable apart so the tonearm can move (assets/dj/*.webp).

  deck-art.py <turntable.png, 2464x1856> <output folder> [--preview folder]

The drawing shows the deck from above with the arm parked beside the record. Three layers come out of it:

  base.webp  the round tonearm base. It turns with the arm, so nothing has to be invented underneath it.
             The sliver the platter hides is filled from the same ring further round.
  deck.webp  the plate with everything that stands still on it. Ink only, the paper is see-through. Where the
             base turns there is a hole; the arm, its shadow and the base's overhang are taken out.
  platter.webp  platter and record, a plain square picture (the page clips it round). It is the densest part of
             the drawing; without see-through paper it is a third of the size. It lies over the base.
  arm.webp   counterweight overhang, tube, headshell and finger lift, solid, to lie on top of the record.

Base and arm turn about the same point with the same angle (js/dj.js). The numbers the page needs are printed
at the end and live in css/dj.css and js/dj.js.
"""
import sys, json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
preview = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
im = Image.open(src).convert('RGB')
assert im.size == (2464, 1856), 'the outlines below belong to one particular drawing'
a = np.asarray(im).astype(np.float32)
H, W = a.shape[:2]
lum = lambda x: x @ np.array([.299, .587, .114], np.float32)
L = lum(a); Ls = ndi.gaussian_filter(L, 1.2)
yy, xx = np.mgrid[0:H, 0:W]

BOX = (330, 225, 2120, 1595)            # the deck plate with a little air
P, RP = (1028.4, 911.0), 641            # platter: spindle and outer edge
LABEL, GROOVE = 198, (560, 232)         # record: label edge; first and last groove the needle plays
B, RB = (1787.7, 576.3), 229.2          # tonearm base: centre (the arm turns about it) and edge
NEEDLE = (1650, 1425)                   # where the stylus sits while the arm is parked
PAPER = np.array([255, 254, 251], np.float32)
rB = np.hypot(xx - B[0], yy - B[1]); rP = np.hypot(xx - P[0], yy - P[1])


def poly(pts):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(pts, fill=255); return np.asarray(m) > 0


def disk(r):
    return np.hypot(*np.mgrid[-r:r + 1, -r:r + 1]) <= r


def close(m, r):
    return ndi.binary_closing(np.pad(m, r + 2), structure=disk(r))[r + 2:-r - 2, r + 2:-r - 2]


def biggest(m):
    lab, n = ndi.label(m); return lab == np.argmax(ndi.sum(m, lab, range(1, n + 1))) + 1


def key(x, hi=8, lo=170):
    """alpha from how much darker than the paper a pixel is; colour with the paper taken back out"""
    d = lum(PAPER[None, None, :])[0, 0] - lum(x)
    al = np.clip((d - hi) / (lo - hi), 0, 1)
    rgb = np.where(al[..., None] > .02, (x - (1 - al[..., None]) * PAPER) / np.maximum(al[..., None], .02), x)
    return np.clip(rgb, 0, 255), al


def save(rgb, al, name, box, width, q=84):
    x0, y0, x1, y1 = [int(round(v)) for v in box]
    img = Image.fromarray(np.dstack([rgb, al * 255])[y0:y1, x0:x1].round().astype(np.uint8), 'RGBA')
    s = width / (BOX[2] - BOX[0])
    img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    img.save(f'{out}/{name}.webp', quality=q, method=6, alpha_quality=70)
    print(name, img.size)
    return img


# --- the arm, outlined by hand along the tube and tightened to the ink
left = [(1768, 700), (1780, 760), (1792.5, 815), (1806, 855), (1824, 905), (1840, 950), (1851.5, 990), (1855, 1030), (1847.5, 1070), (1830, 1110), (1807.5, 1150), (1785, 1185), (1757, 1212)]
right = [(1804, 700), (1818, 760), (1827.5, 805), (1840, 845), (1855, 890), (1869, 940), (1877.5, 985), (1880, 1020), (1872.5, 1060), (1855, 1105), (1832.5, 1147), (1812.5, 1185), (1800, 1235)]
tp = ndi.binary_dilation(poly(left + right[::-1]), structure=disk(7))
tube = ndi.binary_opening(ndi.binary_fill_holes(close((Ls < 205) & tp, 22)) & tp, structure=disk(4))
hp = ndi.binary_dilation(poly([(1716, 1223), (1760, 1201), (1807, 1228), (1783, 1266), (1731, 1376), (1675, 1455), (1589, 1414), (1629, 1339)]), structure=disk(3))
shell = biggest(ndi.binary_opening(ndi.binary_fill_holes(close((Ls < 150) & hp, 9)), structure=disk(3)))
shell |= poly([(1760, 1212), (1800, 1235), (1780, 1262), (1745, 1240)])                     # the pale side of the collar
lift = ndi.binary_dilation((Ls < 175) & poly([(1721, 1369), (1730, 1359), (1802, 1418), (1792, 1428)]) & (yy < 1424), structure=disk(1))
holes = np.zeros_like(shell)                                                              # the three holes in the headshell stay holes
for hx, hy in [(1732, 1271), (1710, 1303), (1694, 1335)]:
    near = np.hypot(xx - hx, yy - hy) < 17
    holes |= ndi.binary_opening((Ls > 150) & near, structure=disk(2))
weight = biggest(ndi.binary_fill_holes(close((Ls < 190) & (xx > 1770) & (xx < 1925) & (yy > 312) & (yy < 480), 12)))   # counterweight: only its overhang matters
hook = biggest(ndi.binary_fill_holes(close((Ls < 190) & (xx > 1900) & (xx < 1995) & (yy > 722) & (yy < 792), 6)))      # the arm rest's hook
over = (weight | hook) & (rB > RB - 6)
arm = (tube | shell | lift | over) & ~holes
arm_al = ndi.gaussian_filter(arm.astype(np.float32), .9)

# --- the base: one whole disc. What the platter hides is taken from the same ring a sixth of a turn further on
t = np.deg2rad(60); c, s = np.cos(t), np.sin(t)
sx = B[0] + (xx - B[0]) * c - (yy - B[1]) * s; sy = B[1] + (xx - B[0]) * s + (yy - B[1]) * c
turned = np.dstack([ndi.map_coordinates(a[..., k], [sy, sx], order=1, mode='nearest') for k in range(3)])
lens = ndi.gaussian_filter(((rP < RP + 5) & (rB < RB + 4)).astype(np.float32), 1.5)[..., None]
base = a * (1 - lens) + turned * lens
base_al = np.clip(RB + .5 - rB, 0, 1) * np.where(rB > RB - 12, key(base)[1], 1)      # the rim is drawn by hand: where it stays inside the circle, no white shows

# --- the deck: ink on see-through paper, without arm, shadow and base
rgb, al = key(a)
gone = poly([(1560, 640), (1862, 640), (1862, 880), (1900, 880), (1900, 1426), (1700, 1426), (1700, 1482), (1480, 1482), (1380, 1300)]) & (rP > RP + 1)
gone |= ndi.binary_dilation(over, structure=disk(8)) | ndi.binary_dilation(lift | shell, structure=disk(5))
gone |= (rB < RB + 2.5)
gone |= (xx > 1868) & (xx < 1936) & (yy > 786) & (yy < 848)          # a small loose part that would lie in the way of the arm rest when the base turns
gone &= rP > RP
rng = np.random.default_rng(7)                                    # the plate's stipple, put back where the arm and its shadow were
dots = np.zeros((H, W), np.float32)
spots = gone & (rB > RB + 12)
ys, xs = np.nonzero(spots)
pick = rng.choice(len(ys), size=int(spots.sum() / 520), replace=False)
for y, x, r, v in zip(ys[pick], xs[pick], rng.uniform(.9, 1.8, len(pick)), rng.uniform(.3, .7, len(pick))):
    y0, x0 = max(0, y - 4), max(0, x - 4)
    sub = np.hypot(yy[y0:y + 5, x0:x + 5] - y, xx[y0:y + 5, x0:x + 5] - x)
    dots[y0:y + 5, x0:x + 5] = np.maximum(dots[y0:y + 5, x0:x + 5], np.clip(r + .5 - sub, 0, 1) * v)
soft = ndi.gaussian_filter(gone.astype(np.float32), 2)
keep = 1 - np.clip(soft * 1.6, 0, 1)
ink = np.array([52, 84, 170], np.float32)
dk_rgb = np.where((dots > 0)[..., None] & (keep < .5)[..., None], ink, rgb)
dk_al = np.maximum(al * keep, dots * (1 - keep))
dk_al[(rP > RP) & (rB < RB + 2.5)] = 0
dk_al *= np.clip(rP - (RP - 2), 0, 1)                              # platter and record are their own picture
edge = np.minimum.reduce([xx - BOX[0], BOX[2] - xx, yy - BOX[1], BOX[3] - yy])
dk_al *= np.clip(edge / 6, 0, 1)

WIDTH = 1280
deck = save(dk_rgb, dk_al, 'deck', BOX, WIDTH, q=66)
TONE = np.array([218, 221, 218], np.float32)                      # the page's paper, ruling averaged in
pb = (P[0] - RP, P[1] - RP, P[0] + RP, P[1] + RP)
flat = a * TONE / PAPER
x0, y0, x1, y1 = [int(round(v)) for v in pb]
plat = Image.fromarray(np.clip(flat[y0:y1, x0:x1], 0, 255).round().astype(np.uint8))
s_ = WIDTH / (BOX[2] - BOX[0]); plat = plat.resize((round(plat.width * s_), round(plat.height * s_)), Image.LANCZOS)
plat.save(f'{out}/platter.webp', quality=70, method=6); print('platter', plat.size)
bb = (B[0] - RB - 3, B[1] - RB - 3, B[0] + RB + 3, B[1] + RB + 3)
base_i = save(base, base_al, 'base', bb, WIDTH, q=84)
ys, xs = np.nonzero(arm_al > .01); ab = (xs.min() - 3, ys.min() - 3, xs.max() + 4, ys.max() + 4)
arm_i = save(a, arm_al, 'arm', ab, WIDTH, q=86)

bw, bh = BOX[2] - BOX[0], BOX[3] - BOX[1]
pc = lambda v, of: round(100 * v / of, 3)
rel = lambda box: dict(left=pc(box[0] - BOX[0], bw), top=pc(box[1] - BOX[1], bh), width=pc(box[2] - box[0], bw), height=pc(box[3] - box[1], bh))
Lr, D = np.hypot(NEEDLE[0] - B[0], NEEDLE[1] - B[1]), np.hypot(P[0] - B[0], P[1] - B[1])
ang = lambda r: np.degrees(np.arccos((Lr * Lr + D * D - r * r) / (2 * Lr * D)))
rest = ang(np.hypot(NEEDLE[0] - P[0], NEEDLE[1] - P[1]))
geo = dict(aspect=round(bw / bh, 4), base=rel(bb), arm=rel(ab), platter_box=rel(pb),
           arm_origin=[pc(B[0] - ab[0], ab[2] - ab[0]), pc(B[1] - ab[1], ab[3] - ab[1])],
           label=dict(cx=pc(P[0] - BOX[0], bw), cy=pc(P[1] - BOX[1], bh), d=pc(2 * LABEL, bw)),
           platter=dict(d=pc(2 * RP, bw)),
           pivot=[pc(B[0] - BOX[0], bw), pc(B[1] - BOX[1], bh)],
           turn=dict(first=round(rest - ang(GROOVE[0]), 2), last=round(rest - ang(GROOVE[1]), 2)),
           arm_len=pc(Lr, bw), spindle_dist=pc(D, bw), rest_deg=round(rest, 2))
print(json.dumps(geo, indent=1))

if preview:
    def comp(deg, name):
        page = Image.new('RGBA', deck.size, (214, 217, 214, 255))
        s = WIDTH / bw
        def put(img, box, turn):
            layer = Image.new('RGBA', deck.size, (0, 0, 0, 0)); layer.paste(img, (round((box[0] - BOX[0]) * s), round((box[1] - BOX[1]) * s)))
            return layer.rotate(-turn, resample=Image.BICUBIC, center=((B[0] - BOX[0]) * s, (B[1] - BOX[1]) * s))
        page.alpha_composite(put(base_i, bb, deg)); page.alpha_composite(deck)
        disc = Image.new('L', plat.size, 0); ImageDraw.Draw(disc).ellipse((0, 0, plat.width - 1, plat.height - 1), fill=255)
        page.paste(plat, (round((pb[0] - BOX[0]) * s), round((pb[1] - BOX[1]) * s)), disc)
        page.alpha_composite(put(arm_i, ab, deg))
        page.convert('RGB').save(f'{preview}/{name}.jpg', quality=88)
    comp(0, 'deck-rest'); comp(geo['turn']['first'], 'deck-first'); comp(geo['turn']['last'], 'deck-last')

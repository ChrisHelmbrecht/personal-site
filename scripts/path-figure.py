#!/usr/bin/env python3
"""The lower wanderer of the path film is an ornate little figure, as in the drawing. The film (Seedance) turns him into a plain
dark puppet after four seconds. This keeps him as drawn: his own first seconds are cut out frame by frame and carried on along
the way the puppet takes, shrinking with it, while the puppet itself is painted over with the empty path.

  path-figure.py assets/source/path-432x576.mp4 assets/video/path.mp4
"""
import subprocess, sys
import numpy as np
from scipy import ndimage as ndi
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
W, H, FPS = 432, 576, 24
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32)
n = len(fr)
bg = np.median(fr[::4], axis=0)                                        # the camera never moves: this is the empty path

def figure(i, near):
    """mask of the wanderer whose feet were last seen at `near` (x, y)"""
    m = ndi.binary_opening(np.abs(fr[i] - bg).sum(axis=2) > 55)
    lab, k = ndi.label(ndi.binary_dilation(m, iterations=3))
    best, bd = None, 1e9
    for j, sl in enumerate(ndi.find_objects(lab)):
        if ndi.sum(m, lab, j + 1) < 60: continue
        d = np.hypot((sl[1].start + sl[1].stop) / 2 - near[0], sl[0].stop - near[1])
        if d < bd: best, bd = j + 1, d
    return ndi.binary_fill_holes(ndi.binary_closing((lab == best) & m, iterations=2)) if best and bd < 60 else None

near, track = (170, 442), {}                                           # follow him: mask, feet (x, y), height
for i in range(n):
    m = figure(i, near)
    if m is None: continue
    ys = np.where(m.any(axis=1))[0]; top, bot = ys[0], ys[-1]
    feet = np.where(m[bot - max(2, (bot - top) // 8):bot + 1].any(axis=0))[0]
    track[i] = (m, (feet[0] + feet[-1]) / 2, bot, bot - top); near = (track[i][1], bot)
last = max(track)

CUT = int(3.5 * FPS)                                                   # up to here he is himself
def sprite(k):
    m, fx, fy, h = track[k]
    ys, xs = np.where(m); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    a = ndi.gaussian_filter(m[y0:y1, x0:x1].astype(np.float32), .7)
    return np.dstack([fr[k][y0:y1, x0:x1], a * 255]).clip(0, 255).astype(np.uint8), fx - x0, fy - y0, h
A, B = int(1.6 * FPS), CUT                                             # the steps that are walked again and again, forth and back so that no step jumps
loop = list(range(A, B)) + list(range(B, A, -1))

END = int(7.8 * FPS)                                                   # here he leaves behind the ornament on the left
idx = list(range(CUT, END + 1))                                        # the puppet's way: a smooth curve through what was measured,
got = np.array([i for i in idx if i in track])                        # which also carries him past the frames where the two wanderers touch
def way(col):
    v = np.array([track[i][col] for i in got], np.float32); keep = np.ones(len(got), bool)
    for _ in range(3):
        c = np.polyfit(got[keep], v[keep], 3); fit = np.polyval(c, got); keep = np.abs(v - fit) < np.maximum(4, .08 * np.abs(fit))
    return np.polyval(c, idx)
fx, fy, fh = way(1), way(2), way(3)
res = fr.copy()
for j, i in enumerate(idx):
    blend = min(1, (i - CUT + 1) / 8)                                  # eight frames to change over
    gone = min(1, (END - i) / 12)                                      # and he fades as he walks out of sight
    yy, xx = np.mgrid[0:H, 0:W]; box = (np.abs(xx - fx[j]) < .5 * fh[j]) & (yy > fy[j] - 1.12 * fh[j]) & (yy < fy[j] + .16 * fh[j])
    there = track[i][0] & box if i in track else np.zeros((H, W), bool)                                                # the puppet, and only him
    hide = ndi.gaussian_filter(ndi.binary_dilation(there, iterations=4).astype(np.float32), 1.5)[..., None] * blend
    res[i] = res[i] * (1 - hide) + bg * hide                           # the empty path over the puppet
    seen = ndi.gaussian_filter(ndi.binary_dilation(there, iterations=max(3, int(.3 * fh[j]))).astype(np.float32), 2)   # what hides the puppet hides him too
    sp, ax, ay, h = sprite(loop[(i - CUT) % len(loop)])
    s = fh[j] / h
    w, hh = max(1, round(sp.shape[1] * s)), max(1, round(sp.shape[0] * s))
    p = np.asarray(Image.fromarray(sp, 'RGBA').resize((w, hh), Image.LANCZOS)).astype(np.float32)
    x, y = int(round(fx[j] - ax * s)), int(round(fy[j] - ay * s))
    xa, ya, xb, yb = max(0, x), max(0, y), min(W, x + w), min(H, y + hh)
    if xb <= xa or yb <= ya: continue
    p = p[ya - y:yb - y, xa - x:xb - x]; a = p[..., 3:] / 255 * blend * gone * seen[ya:yb, xa:xb, None]
    res[i, ya:yb, xa:xb] = res[i, ya:yb, xa:xb] * (1 - a) + p[..., :3] * a
print('followed in', len(track), 'of', n, 'frames')
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-crf', '21', '-preset', 'slow',
                '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out], input=res.round().clip(0, 255).astype(np.uint8).tobytes(), check=True)

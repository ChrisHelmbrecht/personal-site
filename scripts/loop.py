#!/usr/bin/env python3
"""Turn a Runway clip into a seamless loop for the bio plates.

  loop.py in.mp4 out.mp4 poster.webp --crop x,y,w,h --size WxH [--fade 1.5] [--keep cx,cy,r] [--reverse]

The clip runs once; its last `fade` seconds are dissolved into its first, so drifting clouds never jump.
The paper of the clip is lifted to pure white, because js/bio.js keys white out when it draws the film.
The poster is the loop's first frame with the same key already applied (see `key` below and film() in bio.js).
--reverse plays the loop backwards from the same first frame: the clouds then drift the other way.
"""
import argparse, subprocess, numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('out'); ap.add_argument('poster')
ap.add_argument('--crop', required=True); ap.add_argument('--size', required=True)
ap.add_argument('--fade', type=float, default=1.5); ap.add_argument('--fps', type=int, default=24)
ap.add_argument('--key', default='232,150'); ap.add_argument('--keep', default='')
ap.add_argument('--crf', default='24'); ap.add_argument('--reverse', action='store_true')
a = ap.parse_args()
x, y, w, h = map(int, a.crop.split(',')); W, H = map(int, a.size.split('x'))
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', a.src, '-vf', f'crop={w}:{h}:{x}:{y},scale={W}:{H}:flags=lanczos',
                      '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32)
# paper to white: the brightest common tone of each channel becomes 255
paper = np.array([np.percentile(fr[::12, :, :, c], 97) for c in range(3)]) - 2
fr = np.clip(fr / paper * 255, 0, 255)
n, X = len(fr), round(a.fade * a.fps)
if X:
    out = fr[X:].copy(); L = len(out)
    for i in range(X):                                  # the tail dissolves into the head that was cut off
        t = (i + 1) / (X + 1); t = t * t * (3 - 2 * t)
        out[L - X + i] = out[L - X + i] * (1 - t) + fr[i] * t
else:
    out = fr
if a.reverse: out = np.concatenate([out[:1], out[:0:-1]])
enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(a.fps), '-i', '-',
                        '-an', '-c:v', 'libx264', '-preset', 'veryslow', '-crf', a.crf, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', a.out], stdin=subprocess.PIPE)
enc.stdin.write(out.astype(np.uint8).tobytes()); enc.stdin.close(); enc.wait()

def key(rgb, hi, lo, keep):
    light = rgb.min(axis=2)
    al = np.clip((hi - light) / (hi - lo), 0, 1)
    if keep:
        cx, cy, r = keep; yy, xx = np.mgrid[0:H, 0:W]
        al = np.maximum(al, np.clip(r * W + 1 - np.hypot(xx - cx * W, yy - cy * W), 0, 1))
    return np.dstack([rgb, al * 255]).astype(np.uint8)
hi, lo = map(float, a.key.split(','))
keep = tuple(map(float, a.keep.split(','))) if a.keep else None
Image.fromarray(key(out[0], hi, lo, keep), 'RGBA').save(a.poster, quality=84, method=6)
print(f'{a.out}: {len(out)} frames, {len(out) / a.fps:.1f} s, paper was {paper.round(0)}')

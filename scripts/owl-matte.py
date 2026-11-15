#!/usr/bin/env python3
"""The owl film for the bio. On the skull the owl film lies on the drawn sky; in the bio it sits on bare paper, so the sky
around the owl has to go. Every frame gets its own outline: sky is whatever light area can be reached from the edge of the
frame without crossing ink. The result is one film with the picture on top and its matte below (see film() in js/bio.js).

  owl-matte.py assets/source/owl-film-660x880.mp4 assets/owl-mask.png assets/video/owl-ink.mp4

It needs the film at its original 660 x 880; the copy in assets/video is smaller, sized for the start page.
"""
import sys, subprocess, numpy as np
from PIL import Image
from scipy import ndimage as nd
src, mask, out = sys.argv[1:4]
W, H, w, h = 660, 880, 330, 440
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
hold = np.asarray(Image.open(mask).getchannel('A').resize((W, H), Image.LANCZOS)).astype(np.float32) / 255   # the start page's own mask: nothing outside it
ball = nd.generate_binary_structure(2, 1)
owls = []
for f in fr:
    ink = f.min(axis=2) < 108                                   # the sky lines are never darker than about 120
    shut = nd.binary_dilation(ink, ball, iterations=6)                # close the gaps between feather strokes
    lab, _ = nd.label(~shut)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    sky = np.isin(lab, edge[edge > 0])
    owl = nd.binary_erosion(~sky, ball, iterations=5, border_value=1)  # back to the true outline, a touch tighter
    owl = nd.binary_opening(owl, ball, iterations=4)                   # stray sky lines that touch the head fall away ...
    parts, n = nd.label(owl)
    if n > 1: owl = parts == 1 + np.argmax(nd.sum(owl, parts, range(1, n + 1)))   # ... and only the owl itself is kept
    owls.append(owl)
owls = np.stack(owls)
# For a few frames the outline can open (pale feathers at the neck) and the sky eats into the owl. Such a bite is there for
# a moment only: where the frames around agree that it is owl, it is owl
usual = nd.median_filter(owls.astype(np.uint8), size=(13, 1, 1), mode='nearest').astype(bool)
mended = 0
for i in range(len(owls)):
    bite = usual[i] & ~owls[i]
    if bite.sum() > 400: owls[i] |= nd.binary_opening(bite, ball, iterations=2); mended += 1
frames = []
for f, owl in zip(fr, owls):
    al = nd.gaussian_filter(owl.astype(np.float32), 1.3) * hold
    rgb = f.astype(np.float32) * al[..., None] + 255 * (1 - al[..., None])
    top = np.asarray(Image.fromarray(rgb.astype(np.uint8)).resize((w, h), Image.LANCZOS))
    bot = np.asarray(Image.fromarray((al * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS))
    frames.append(np.vstack([top, np.dstack([bot] * 3)]))
enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h * 2}', '-r', '24', '-i', '-', '-an',
                        '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
enc.stdin.write(np.stack(frames).tobytes()); enc.stdin.close(); enc.wait()
print(out, len(frames), 'frames,', mended, 'mended')

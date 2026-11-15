#!/usr/bin/env python3
"""The Alps as seen from the northern edge of Munich, computed from SRTM elevation data and drawn in ink.

  alps.py <folder with N47E010 N47E011 N47E012 N46E011 .hgt.gz> <out.webp> [--preview out.png]

The elevation tiles are the 1-arc-second "skadi" tiles of the Terrain Tiles on AWS Open Data
(s3.amazonaws.com/elevation-tiles-prod/skadi/N47/N47E011.hgt.gz and so on); they are not kept in this repository.

A panorama: every column is a compass direction, every row an angle above the horizon. Heights are exaggerated (as a long
lens does), directions slightly. The tone comes from the light on the slopes, snow above the tree line and the haze of distance.
"""
import sys, gzip
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
LAT0, LON0, EYE = 48.25, 11.56, 560.0            # north of the city, a little above the ground
AZ0, AZ1 = 124.0, 236.0                           # compass directions shown (180 = south)
W, H = 4096, 200
TOP = 1.36                                        # true angle above the horizon at the top edge, in degrees. js/flight.js draws it taller (ALPS)
R = 6371000.0; KREF = .13                         # earth radius, refraction

tiles = {}
for la, lo in [(47, 10), (47, 11), (47, 12), (46, 11)]:
    a = np.frombuffer(gzip.open(f'{src}/N{la}E0{lo}.hgt.gz').read(), '>i2').reshape(3601, 3601).astype(np.float32)
    a[a < -1000] = np.nan
    tiles[(la, lo)] = a
big = np.full((2 * 3600 + 1, 3 * 3600 + 1), 500, np.float32)     # lat 48..46 downwards, lon 10..13; what is missing counts as lowland
for (la, lo), a in tiles.items():
    r0, c0 = (47 - la) * 3600, (lo - 10) * 3600
    big[r0:r0 + 3601, c0:c0 + 3601] = np.where(np.isnan(a), 500, a)
dem = big[::2, ::2]                               # 2 arc seconds: about 62 m north-south, 42 m east-west
dem = ndi.gaussian_filter(dem, .8)
gy, gx = np.gradient(dem, 61.8, 41.3)             # metres per metre; rows run south, columns east
def sample(g, lat, lon):
    return ndi.map_coordinates(g, [(48 - lat) * 1800, (lon - 10) * 1800], order=1, mode='nearest')

az = np.radians(np.linspace(AZ0, AZ1, W))
r = np.concatenate([np.arange(12e3, 60e3, 60.0), np.arange(60e3, 175e3, 110.0)])
lat = LAT0 + np.outer(r, np.cos(az)) / 111200.0
lon = LON0 + np.outer(r, np.sin(az)) / (111200.0 * np.cos(np.radians(LAT0 - .45)))
h = sample(dem, lat, lon)
inside = (lat > 46) & (lat < 48) & (lon > 10) & (lon < 13) & ~((lat < 47) & ((lon < 11) | (lon > 12)))
h = np.where(inside, h, -2000)
eps = np.degrees(np.arctan((h - EYE - r[:, None] ** 2 / (2 * R) * (1 - KREF)) / r[:, None]))
top = np.maximum.accumulate(eps, axis=0)          # the highest angle reached so far, going away from the eye
rows = TOP * (1 - (np.arange(H) + .5) / H)        # angle of each pixel row
hit = np.empty((H, W), np.int32)
for c in range(W):
    hit[:, c] = np.searchsorted(top[:, c], rows)  # first terrain that reaches this row
land = hit < len(r)
hit = np.minimum(hit, len(r) - 1); cc = np.arange(W)[None, :]
dist, height = r[hit], h[hit, cc]
sx, sy = sample(gx, lat, lon)[hit, cc], sample(gy, lat, lon)[hit, cc]
# light from the south-east, fairly low: normal = (-dh/dx, +dh/dy_south..., 1)
sun_az, sun_alt = np.radians(125), np.radians(32)
L = np.array([np.sin(sun_az) * np.cos(sun_alt), np.cos(sun_az) * np.cos(sun_alt), np.sin(sun_alt)])   # east, north, up
n = np.dstack([-sx, sy, np.ones_like(sx)]); n /= np.linalg.norm(n, axis=2, keepdims=True)              # gy is per metre southwards
lit = np.clip(n @ L, 0, 1)
rng = np.random.default_rng(3)
snowline = 1480 + 90 * ndi.gaussian_filter(rng.standard_normal((H, W)), 6) * 6
snow = np.clip((height - snowline) / 300, 0, 1)
rock = .22 + .55 * (1 - lit) ** 1.4               # shaded slopes dark
wood = .40 + .34 * (1 - lit)
tone = np.where(height < 1300, wood, rock) * (1 - .86 * snow) + snow * .30 * (1 - lit) ** 1.6
haze = np.clip(1.3 - dist / 115e3, .45, 1)                        # the far ranges pale, the nearer foothills stronger
tone = tone * haze
# ridge lines: where the next row up is much further away, a slope ends against the one behind it
jump = np.zeros((H, W), bool); jump[1:] = (dist[:-1] - dist[1:] > 1500) | (~land[:-1] & land[1:])
line = ndi.gaussian_filter(jump.astype(np.float32), .6) * 1.8
line *= np.clip(1.15 - dist / 170e3, .35, 1)
# stipple: ink dots, denser where the tone is darker
dots = ndi.gaussian_filter((rng.random((H, W)) < np.clip(tone, 0, 1) ** 1.15).astype(np.float32), .55)
alpha = np.clip(.44 * tone + .9 * dots * tone ** .4 + line, 0, 1) * land
x = np.linspace(0, 1, W); alpha *= np.clip(np.minimum(x, 1 - x) / .14, 0, 1)[None, :] ** 1.3          # both ends fade into the distance
y = (np.arange(H) + .5) / H; alpha *= np.clip((1 - y) / .14, 0, 1)[:, None]                             # and the foot into the haze of the plain
ink = np.where((line > .5)[..., None], [18, 38, 95], [31, 63, 151]).astype(np.float32)
im = Image.fromarray(np.dstack([ink, alpha * 255]).round().astype(np.uint8), 'RGBA')
im.save(out, quality=78, method=6)
print('alps', im.size, 'covers', AZ0, AZ1, 'top angle', TOP)
if '--preview' in sys.argv:
    bg = Image.new('RGBA', im.size, (214, 217, 214, 255)); bg.alpha_composite(im); bg.convert('RGB').save(sys.argv[sys.argv.index('--preview') + 1])
if '--where' in sys.argv:                           # where the well-known summits stand, for checking
    for name, la, lo in [('Zugspitze', 47.4211, 10.9853), ('Benediktenwand', 47.6531, 11.4656), ('Wendelstein', 47.7031, 12.0122), ('Herzogstand', 47.6094, 11.3072), ('Birkkarspitze', 47.4117, 11.4375), ('Kampenwand', 47.7553, 12.3661), ('Guffert', 47.5456, 11.7897), ('Saeuling', 47.5372, 10.7458)]:
        dn, de = (la - LAT0) * 111200, (lo - LON0) * 111200 * np.cos(np.radians(LAT0 - .45)); a = np.degrees(np.arctan2(de, dn)) % 360
        print(f'  {name}: direction {a:.1f}, column {int((a - AZ0) / (AZ1 - AZ0) * W)}, {np.hypot(dn, de) / 1000:.0f} km')

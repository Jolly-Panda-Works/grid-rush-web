"""Cut the premium art atlases (client/public/ui-kit-premium) into small per-item WebP files the game loads
(client/public/art). Run from the repository root:  python tools/slice-ui-art.py
Boxes come from ui-kit-premium/manifest.json; tiles and avatars sit on a painted backdrop, so they are trimmed
to the tile square / masked to the medallion circle here."""
import json
import os
from PIL import Image, ImageDraw, ImageFilter

SRC = 'client/public/ui-kit-premium'
OUT = 'client/public/art'
manifest = json.load(open(os.path.join(SRC, 'manifest.json'), encoding='utf-8'))
atlases = {}


def atlas(name):
    if name not in atlases:
        atlases[name] = Image.open(os.path.join(SRC, name)).convert('RGBA')
    return atlases[name]


def crop(a):
    x, y, w, h = a['box']
    return atlas(a['file']).crop((round(x), round(y), round(x + w), round(y + h)))


def save(img, path, quality=86):
    full = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    img.save(full, 'WEBP', quality=quality, method=6)


def trim(img, pad=0):
    """Crop to the visible pixels (alpha > 24), then pad to a square."""
    alpha = img.getchannel('A').point(lambda v: 255 if v > 24 else 0)
    img = img.crop(alpha.getbbox())
    side = max(img.size) + pad * 2
    sq = Image.new('RGBA', (side, side))
    sq.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
    return sq


def tile_square(img):
    """The glazed tile is the bright square in the middle of the box; find its edges by brightness."""
    g = img.convert('L')
    w, h = g.size
    cols = [sum(g.getpixel((x, y)) for y in range(h // 4, 3 * h // 4)) / (h // 2) for x in range(w)]
    rows = [sum(g.getpixel((x, y)) for x in range(w // 4, 3 * w // 4)) / (w // 2) for y in range(h)]

    def edges(v):
        mid = len(v) // 2
        ref = sorted(v)[len(v) // 2]
        lo, hi = 0, len(v) - 1
        # walk outwards from the centre until the backdrop (a sharp brightness change) begins
        for i in range(mid, 0, -1):
            if abs(v[i] - v[i - 1]) > 18 and i < mid - len(v) // 3: lo = i; break
        for i in range(mid, len(v) - 1):
            if abs(v[i + 1] - v[i]) > 18 and i > mid + len(v) // 3: hi = i; break
        return lo, hi

    x0, x1 = edges(cols)
    y0, y1 = edges(rows)
    s = min(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    inset = 3  # drop the backdrop-tinted antialiased rim
    return img.crop((round(cx - s / 2 + inset), round(cy - s / 2 + inset), round(cx + s / 2 - inset), round(cy + s / 2 - inset)))


def medallion(img):
    """Mask the avatar to its round gold rim (the backdrop around it is opaque paint)."""
    s = min(img.size)
    img = img.crop(((img.width - s) // 2, (img.height - s) // 2, (img.width - s) // 2 + s, (img.height - s) // 2 + s))
    big = 4
    mask = Image.new('L', (s * big, s * big))
    r = s * big * 0.448
    c = s * big / 2
    ImageDraw.Draw(mask).ellipse((c - r, c - r, c + r, c + r), fill=255)
    mask = mask.resize((s, s), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.4))
    out = img.copy()
    out.putalpha(mask)
    return trim(out)


for a in manifest['assets']:
    cat, aid = a['category'], a['id']
    if cat == 'icons':
        save(trim(crop(a), 4).resize((160, 160), Image.LANCZOS), f'icons/{aid}.webp')
    elif cat == 'tiles':
        save(tile_square(crop(a)).resize((192, 192), Image.LANCZOS), f'tiles/{aid}.webp', 88)
    elif cat == 'avatars':
        save(medallion(crop(a)).resize((192, 192), Image.LANCZOS), f'avatars/{aid}.webp')
    elif cat == 'frames':
        f = crop(a)
        f = f.crop(f.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())
        save(f, f'frames/{aid}.webp', 90)

# Persian logotype: «نقش‌نبرد», the game's Persian name
for lang, file in (('en', 'wordmark-en.png'), ('fa', 'wordmark-naqsh-nabard-fa.png')):
    w = Image.open(os.path.join(SRC, file)).convert('RGBA')
    w = w.crop(w.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())
    w = w.resize((1000, round(w.height * 1000 / w.width)), Image.LANCZOS)
    save(w, f'wordmark-{lang}.webp', 88)


def lift_ornament(name, x0, x1, y0, y1, clean, band=False):
    """Split a frame whose middle ornament would stretch: the frame with the ornament painted over by a plain column
    (<name>-plain), and the ornament alone (<name>-orn) to sit on top of it at its natural shape.
    The plain column is the per-row median of the `clean` columns (plain band on both sides of the ornament)."""
    f = Image.open(os.path.join(OUT, 'frames', f'{name}.webp')).convert('RGBA')
    save(f.crop((x0, y0, x1, y1)), f'frames/{name}-orn.webp', 90)
    # per-row median of the columns on both sides of the ornament: stray paint flecks and stems disappear
    xs = [x for a, b in clean for x in range(a, b)]
    col = Image.new('RGBA', (1, y1 - y0))
    for y in range(y0, y1):
        px = sorted((f.getpixel((x, y)) for x in xs), key=sum)
        col.putpixel((0, y - y0), px[len(px) // 2])
    if band:  # a vine runs through the clean columns too: inside the lapis band, keep only the plain blue glaze
        blue = lambda c: c[2] > c[0] + 40 and c[2] > c[1] + 20
        ys = [y for y in range(col.height) if blue(col.getpixel((0, y)))]
        for y in range(ys[0], ys[-1]):
            if not blue(col.getpixel((0, y))):
                above = max(v for v in ys if v < y)
                below = min(v for v in ys if v > y)
                ca, cb, k = col.getpixel((0, above)), col.getpixel((0, below)), (y - above) / (below - above)
                col.putpixel((0, y), tuple(round(ca[i] + (cb[i] - ca[i]) * k) for i in range(4)))
    for x in range(x0, x1):
        f.paste(col, (x, y0))
    save(f, f'frames/{name}-plain.webp', 90)


lift_ornament('modal', 144, 218, 0, 96, [(129, 139), (223, 233)], band=True)


def glaze_recolor(src, name, top, bottom):
    """A button bar in another glaze with exactly the same gilded mount: the cream marble inside `src` is
    re-fired in a top-to-bottom glaze gradient, keeping the marble veins as light and dark."""
    f = Image.open(os.path.join(OUT, 'frames', f'{src}.webp')).convert('RGBA')
    w, h = f.size
    px = f.load()
    for y in range(h):
        k = y / (h - 1)
        base = [top[i] + (bottom[i] - top[i]) * k for i in range(3)]
        for x in range(int(w * 0.13), int(w * 0.87)):
            r, g, b, a = px[x, y]
            if r > 150 and b > 0.6 * r and abs(r - g) < 45:  # cream marble, not gold leaf or gems
                vein = ((r + g + b) / 3 - 232) * 1.6
                px[x, y] = tuple(max(0, min(255, round(base[i] + vein))) for i in range(3)) + (a,)
    save(f, f'frames/{name}.webp', 90)


glaze_recolor('secondary', 'primary-bar', (70, 214, 238), (0, 128, 172))

total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs)
print(f'wrote {sum(len(fs) for _, _, fs in os.walk(OUT))} files, {total // 1024} KB')

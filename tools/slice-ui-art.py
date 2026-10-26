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

# icon sheets laid out as a 4x4 grid in the order of docs/icons-needed.md (not in the kit's manifest)
GRID_SHEETS = {
    'achievements-atlas.png': ['ach-first_win', 'ach-wins_10', 'ach-wins_50', 'ach-games_25', 'ach-streak_3', 'ach-bonus7', 'ach-full_board',
                               'ach-score_15', 'ach-rich', 'ach-treasure_5', 'ach-tiles_100', 'ach-beat_master', 'ach-museum',
                               'rank-gold', 'rank-silver', 'rank-bronze'],
    'ui-icons-atlas.png': ['play', 'match', 'friends', 'add-friend', 'menu', 'sound-on', 'sound-off', 'motion', 'resign', 'close',
                           'confirm', 'edit', 'copy', 'back', 'language', 'tip'],
    'game-icons-atlas.png': ['buy-tile', 'advance', 'turns', 'finish', 'scales', 'rotate-left', 'rotate-right', 'flip', 'bot',
                             'heart-empty', 'empty-cell', 'engraved-coin'],
}


def clean_alpha(img):
    """Drop the faint matte specks the generator leaves around a cut-out: weak alpha goes, and so does anything
    not connected to the object itself."""
    a = img.getchannel('A').point(lambda v: 0 if v < 90 else v)
    small = a.resize((a.width // 4, a.height // 4)).point(lambda v: 255 if v > 0 else 0)
    w, h = small.size
    px = small.load()
    seen, comps = set(), []
    for y in range(h):
        for x in range(w):
            if px[x, y] and (x, y) not in seen:
                comp, stack = [], [(x, y)]
                seen.add((x, y))
                while stack:
                    cx, cy = stack.pop()
                    comp.append((cx, cy))
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < w and 0 <= ny < h and px[nx, ny] and (nx, ny) not in seen:
                            seen.add((nx, ny))
                            stack.append((nx, ny))
                comps.append(comp)
    biggest = max((len(c) for c in comps), default=0)
    best = [p for c in comps if len(c) >= max(12, biggest * 0.04) for p in c]  # the object and its sizeable parts (a flame, a gem)
    keep = Image.new('L', small.size)
    kp = keep.load()
    for x, y in best:
        kp[x, y] = 255
    keep = keep.filter(ImageFilter.MaxFilter(5)).resize(a.size)
    out = img.copy()
    out.putalpha(Image.composite(a, Image.new('L', a.size), keep))
    return out


for sheet, ids in GRID_SHEETS.items():
    if not os.path.exists(os.path.join(SRC, sheet)):
        continue
    at = Image.open(os.path.join(SRC, sheet)).convert('RGBA')
    cell = at.width / 4
    for n, aid in enumerate(ids):
        x, y = n % 4 * cell, n // 4 * cell
        k = 7  # a few pixels in, so slivers of the neighbouring cells stay out
        save(trim(clean_alpha(at.crop((round(x + k), round(y + k), round(x + cell - k), round(y + cell - k)))), 4).resize((160, 160), Image.LANCZOS), f'icons/{aid}.webp')

# loading screen: the background (no text: the logo is laid over it per language) and the bar's three layers
if os.path.exists(os.path.join(SRC, 'loading-background.webp')):
    save(Image.open(os.path.join(SRC, 'loading-background.webp')).convert('RGB'), 'screens/loading-bg.webp', 82)
if os.path.exists(os.path.join(SRC, 'loading-bar-layers.webp')):
    bars = Image.open(os.path.join(SRC, 'loading-bar-layers.webp')).convert('RGBA')
    save(bars.crop((58, 160, 1717, 340)), 'frames/lbar-frame.webp', 90)  # gold frame, transparent hole x 205..1568, y 188..309
    save(bars.crop((142, 419, 1632, 566)), 'frames/lbar-track.webp', 88)
    save(bars.crop((142, 642, 1632, 789)), 'frames/lbar-fill.webp', 88)

# character portraits: a 2 x 5 sheet of 300 px cells (the busts may reach a little into the cell above)
if os.path.exists(os.path.join(SRC, 'character-avatars.webp')):
    sheet = Image.open(os.path.join(SRC, 'character-avatars.webp')).convert('RGBA')
    for n in range(10):
        x, y = n % 2 * 300, n // 2 * 300
        save(sheet.crop((x, y, x + 300, y + 300)).resize((220, 220), Image.LANCZOS), f'avatars/hero-{n + 1}.webp', 88)

# splash: the medallion of tiles (no text: the logo is laid over it per language)
for name, file in (('splash-bg', 'splash-background.webp'),):
    if os.path.exists(os.path.join(SRC, file)):
        save(Image.open(os.path.join(SRC, file)).convert('RGB'), f'screens/{name}.webp', 82)

# Persian logotype: «نقش‌آرا», the game's Persian name
for lang, file in (('en', 'wordmark-en.png'), ('fa', 'wordmark-naqsh-ara-fa.webp')):
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
# the ribbons' gem mounts sit on a stretched middle too
lift_ornament('ribbon', 95, 232, 0, 64, [(74, 92), (234, 252)], band=True)
lift_ornament('victory', 104, 274, 0, 72, [(84, 102), (278, 296)])
lift_ornament('defeat', 102, 250, 0, 72, [(82, 100), (252, 270)])


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

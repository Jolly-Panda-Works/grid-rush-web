# مستر پرامپت UI بازی Grid Rush (تم کاشی‌کاری ایرانی)

## روش استفاده
- **بخش ۱ (Style Bible)** را همیشه اول هر پرامپت بگذارید. این بخش ثابت است و باعث می‌شود همه‌ی خروجی‌ها یک‌دست شوند.
- بعد از آن **فقط یک آیتم** از بخش ۲ (المان‌ها) یا بخش ۳ (صفحات) را اضافه کنید. هر بار یک آیتم بسازید، نه همه را با هم.
- پرامپت انگلیسی است، چون مدل‌های تصویر (Midjourney، DALL·E، Flux، Ideogram، Leonardo) و ابزارهای طراحی (Figma AI، v0، Galileo) با انگلیسی دقیق‌ترند.
- برای Midjourney پسوند پیشنهادی: `--ar 9:19.5 --style raw --s 150` برای صفحه‌ها و `--ar 1:1` برای المان‌ها. برای المان‌ها «isolated on transparent background» را نگه دارید.
- متن فارسی داخل تصویر را مدل‌ها خراب می‌سازند. پس هر جا متن هست، **جای خالی** یا متن انگلیسی کوتاه بخواهید و متن فارسی را در خود بازی بگذارید.

---

## ۱. Style Bible (ثابت، اول هر پرامپت)

```text
You are designing UI for "Grid Rush", a portrait mobile board game (Android, 1080x2340, RTL Persian + English).
Two players race along a 54-step track and fill a 9x9 quilt board with polyomino tiles; a 7x7 filled area gives a bonus.
The whole game is themed as PERSIAN TILEWORK (kashi-kari): Isfahan mosques, haft-rangi tiles, girih star patterns,
muqarnas, arabesque (eslimi) and khatai flower motifs. It must feel like a polished premium card/board game
(think the craft of Hearthstone / Clash Royale / Patchwork digital), but calm, elegant and readable, never noisy.

VISUAL LANGUAGE
- Surfaces are glazed ceramic tiles: slightly glossy, thin crackle, soft bevel, hand-painted edges, subtle grout lines.
- Frames and borders are gilded (gold leaf) with a thin turquoise inner line; corners use small 8-point star (khatam) caps.
- Backgrounds: deep lapis/navy with a faint repeating girih star lattice at 6-10% opacity, gentle vignette.
- Panels: warm cream glazed tile (like the cream ground of a haft-rangi panel) with gold frame; text on panels is dark navy ink.
- Ornaments: thin gold dividers with a central diamond and turquoise dot; eslimi scroll flourishes only at panel headers.
- Shapes: soft rounded rectangles (12-18px radius at 1x), pointed-arch (Persian arch / mihrab) silhouettes for hero frames.
- Light: soft top-left key light, warm gold rim, long soft shadow (0 10px 28px, navy 38%). No harsh black shadows.
- Depth: 2.5D, buttons look like thick tiles you can press (3-5px bottom lip, darker edge).

COLOR TOKENS (use only these)
navy #001E67, lapis #00308D, blue #0152AF, azure #17A8F0, turquoise #0AB6CB, emerald #27B67A,
saffron #FFB400, gold #E3A71A, terracotta #E5553F, cream #FFF6DE, cream-2 #F6E9C8, line-gold #E2D0A0,
ink #13224F, ink-muted #6A6040. Player 1 = azure #17A8F0, Player 2 = coral #F0524F.
Success = emerald, danger = terracotta, warning = saffron. Gold is for frames and rewards only, never for body text.

TYPOGRAPHY
- Persian: Vazirmatn (UI), Lalezar or a nastaliq-inspired display face only for big titles.
- Latin: Sora (headings, semibold), Inter (body). Numbers in tabular figures.
- Body text >= 14px at 1x, titles 20-28px, high contrast (WCAG AA).

RULES
- Mobile first, thumb zone at the bottom, touch targets >= 48dp, safe-area aware (notch + gesture bar).
- RTL mirrored layout for Persian; icons that imply direction are mirrored.
- Clean and calm: max 2 ornament levels per screen, generous spacing, one clear primary action per screen.
- No real-world text, logos, religious calligraphy or Quranic verses; motifs are geometric and floral only.
- Consistent icon style: filled glyphs in cream with a thin gold outline, sitting on a small glazed tile.
- Deliver crisp vector-like rendering, no blur, no photo-realism, no 3D clutter, no stock watermarks.
```

---

## ۲. المان‌ها (یکی را بعد از Style Bible اضافه کنید)

### ۲.۱ کاشی‌ها و صفحه بازی
```text
ASSET: Game tile set. 12 square 1x1 glazed Persian tiles, each a distinct hand-painted haft-rangi motif
(8-point star, girih knot, khatai flower, eslimi scroll, cypress, pomegranate, shamseh sun, interlaced hexagons,
lattice, medallion, bird-and-vine, chevron). Each motif in 2 colorways from the palette. Top-down, flat, seamless edges
so tiles can join into polyomino pieces. Thin grout gap. Sprite sheet 4x6 on transparent background, 256px cells.
```
```text
ASSET: Polyomino piece. Same tile style joined into a shape (L, T, S, line, plus), shared gold outline around
the whole piece, slight lift shadow, plus a "selected" state with a soft turquoise glow and a "cannot place" state
with a terracotta outline. Small coin-cost and time-cost badges on the corner.
```
```text
ASSET: 9x9 player board. Empty cream grout grid inside a gilded frame with star corner caps; the central 7x7 area
marked by a faint turquoise inner border; empty cells look like unglazed terracotta clay. States: empty, hover/preview
(ghost tile 60%), valid (emerald glow), invalid (terracotta glow), completed 7x7 (gold shimmer).
```

### ۲.۲ مسیر (Track) و نشانگرها
```text
ASSET: Horizontal time-track strip, 54 small square steps like a tiled frieze, gold rim, with special steps:
9 treasure steps (small turquoise jar with coin), 5 reward steps (tiny 1x1 tile gift with gold ribbon).
Two player pawns: glazed ceramic tokens shaped like an 8-point star, azure and coral, with a white highlight.
Show the current-turn pawn raised with a soft glow.
```

### ۲.۳ دکمه‌ها
```text
ASSET: Button set as thick glazed tiles with a 4px pressed lip. Variants: primary (turquoise to azure glaze, cream text),
secondary (cream tile, navy text, gold frame), danger (terracotta), ghost (transparent with gold outline), icon button
(square tile, 56dp), big CTA "PLAY" (wide pointed-arch top, gold frame, star cap). States: normal, pressed (lip gone,
2px lower), disabled (desaturated, 50%), loading (rotating girih star). Transparent background, 1x/2x/3x.
```

### ۲.۴ پنل‌ها، دیالوگ‌ها و قاب‌ها
```text
ASSET: Modal dialog. Cream glazed panel inside a gold frame with turquoise inner line, header band in lapis with an
eslimi flourish on both sides of an empty title area, round close button (tile with an X) at the top corner,
footer area for 1-2 buttons. Dim navy overlay behind. Also a small variant and a bottom-sheet variant.
```
```text
ASSET: Card frame for offers and rewards. Portrait playing-card shape with a pointed-arch window for the tile art,
gold border, price ribbon at the bottom (coins + hourglass icons), rarity gem on top. Also a face-down back with a
shamseh medallion. Include a "new reward" variant with a light burst behind it.
```
```text
ASSET: Ribbon / banner headers. Gold-edged lapis ribbon with folded ends, blank text area; plus a victory ribbon
(saffron/gold) and a defeat ribbon (muted terracotta).
```

### ۲.۵ کنترل‌های فرم
```text
ASSET: Form controls in the tile style: text input (inset cream tile, navy text, turquoise focus ring),
toggle switch (small tile track with a ceramic knob, on = emerald), segmented control (row of joined tiles, selected
one raised turquoise), tabs (arch-topped tabs on a lapis bar), slider (gold rail, star knob), checkbox (tile with
a gold check). All with focus, pressed and disabled states.
```

### ۲.۶ نشان‌ها، آواتار، نوار پیشرفت
```text
ASSET: Avatar medallions. 24 circular avatars, each a Persian tile motif inside a gold ring (shamseh style),
with a small level badge (8-point star with a number area) at the bottom; online dot (emerald) variant.
```
```text
ASSET: Progress and stat elements: XP bar (gold tube with a turquoise liquid glaze fill and star end-cap),
level-up star burst, timer ring (turn timer, 60s, turquoise draining to terracotta), coin counter chip,
"Firouzeh" premium currency gem (polished turquoise stone with gold setting), trophy rating chip.
```
```text
ASSET: Achievement badges, 13 hexagonal glazed tiles with gold rims, locked (grey unglazed clay) and unlocked
(full color + shine) states. Themes: first win, 10 wins, 50 wins (crown), 25 games, 3 win streak (flame),
7x7 bonus, full board, high score, rich (coins), treasures, 100 tiles placed (dome), beat master bot, museum exhibit.
```

### ۲.۷ آیکون‌ها
```text
ASSET: Icon set, 32 icons, filled cream glyphs with thin gold outline on small rounded glazed tiles (lapis):
play, bot, online, friends, add friend, leaderboard trophy, profile, museum (arch gallery), shop, settings gear,
help, sound on/off, language, back (RTL aware), close, rotate left, rotate right, flip, confirm, cancel, coin,
hourglass, treasure jar, gift, star, crown, lock, share, copy, vote heart, calendar (daily), scroll (quests), ad-free.
```

### ۲.۸ بازخورد و افکت
```text
ASSET: Feedback elements: toast pill (cream tile with colored left gem: emerald/saffron/terracotta), floating "+3"
coin text, tooltip bubble with a pointed tail, turn indicator glow frame around a player panel (azure or coral),
empty-state illustration (an unfinished tile wall with a small bird), loading spinner (rotating girih star).
```
```text
ASSET: Particle sprite sheet for effects: gold dust, turquoise glaze shards, tiny 8-point stars, petals of khatai
flowers, light rays. Transparent, 8x8 grid of 128px frames, additive-friendly.
```

---

## ۳. صفحات (یکی را بعد از Style Bible اضافه کنید)

```text
SCREEN: Splash. Studio logo centered on deep navy with a faint girih lattice slowly revealed, soft gold light.
```
```text
SCREEN: Loading. Game logo "Grid Rush" as glazed tiles assembling, a tile-mosaic progress bar filling left-to-right
(RTL: right-to-left), a rotating tip line, version text at the bottom.
```
```text
SCREEN: Main menu. Top: profile chip (avatar medallion, name, level, XP bar) and currency chips.
Center: hero pointed-arch window showing a tiled board, big PLAY CTA with two mode buttons (vs Bot, Online).
Daily reward and daily challenge cards in a row. Bottom nav of 5 tile icons: Ranking, Friends, Museum, Help, Settings.
```
```text
SCREEN: Matchmaking. Two avatar medallions facing each other across a gold "VS" star, searching animation as
a rotating girih ring, countdown, cancel button.
```
```text
SCREEN: Game table (most important). Top: the 54-step track strip with both pawns. Upper area: opponent board
(smaller, right side) with both player panels stacked on its left (avatar, coins, score, turn timer; active player
framed in its color). Middle: my 9x9 board, large. Bottom: three offer cards in a row (the tile shape, coin cost,
time cost) and a placement bar with rotate / flip / confirm buttons in the thumb zone. Calm, no clutter, clear turn state.
```
```text
SCREEN: 1x1 reward moment. Darkened table, a single card rises with a light burst and particles, title area,
"Place it" button.
```
```text
SCREEN: Results. Victory or defeat ribbon, both final boards side by side, score breakdown table
(coins / 2, 7x7 bonus, empty cells x -2, total), rating change chip, XP gained with the bar filling,
new achievements row, buttons: Play again, Exhibit in museum, Menu.
```
```text
SCREEN: Profile. Large avatar medallion with level star, editable name field, XP bar, stats grid (games, win rate,
best score, 7x7 bonuses, streak, tiles placed), achievements grid (locked/unlocked), avatar picker sheet.
```
```text
SCREEN: Leaderboard. Tabs Rating / Level, segmented Everyone / Friends, a podium for the top 3 (gold, silver, bronze
star medals), list rows (rank, avatar, name, level, value), my own row pinned at the bottom.
```
```text
SCREEN: Friends. My friend code in a framed tile with Copy, an input to add by code, requests section with
accept/decline, friends list with online dots, pending section, and a player card modal.
```
```text
SCREEN: Museum. A gallery hall of pointed arches, each arch holding an exhibited finished board, a vote heart counter,
sort tabs (Top, New), and a detail view with the board large and the player's name.
```
```text
SCREEN: Shop. Tabs: Tile skins, Board frames, Pawns, Avatars, No-ads pass. Item cards in a 2-column grid with price
in Firouzeh gems, "owned" and "equipped" states, a featured banner at the top. No pay-to-win items.
```
```text
SCREEN: Daily challenge. A fixed seed puzzle card with a calendar tile, today's goal, best score, a reward preview,
and a 7-day streak row of tiles that light up.
```
```text
SCREEN: Quests and daily reward. A list of quest scrolls with progress bars and claim buttons, plus a 7-day login
calendar with growing rewards; the claimed days glazed, the future days unglazed clay.
```
```text
SCREEN: Settings. Language segmented (فارسی / English), toggles for sound, music, vibration, reduce motion,
account section (guest / Google Play linked, friend code, link button), server field, version and credits.
```
```text
SCREEN: How to play. 4-5 swipeable illustrated cards: buy a tile, place and rotate, move on the track,
treasures and rewards, scoring. Dots pager and Skip.
```
```text
SCREEN: In-game pause menu and dialogs. Bottom sheet with Resume, How to play, Settings, Leave match (danger,
with a confirm dialog). Also the update-available dialog and the no-connection dialog.
```

---

## ۴. پرامپت یک‌جا (برای ابزارهای طراحی مثل Figma AI / v0)

اگر ابزاری دارید که یک‌جا کل سیستم را می‌سازد، Style Bible را بگذارید و بعد این را:

```text
TASK: Create a complete mobile UI kit and all screens for Grid Rush in the style above.
1) A design-system page: color tokens, type scale, spacing (4/8/12/16/24/32), radii, shadows, ornaments.
2) Components with all states: buttons, inputs, toggles, tabs, segmented control, cards, modals, bottom sheets,
   toasts, tooltips, avatars, badges, progress bars, timer ring, icon set, tiles, pieces, board, track.
3) Screens (portrait 390x844, plus RTL Persian versions): Splash, Loading, Main menu, Matchmaking, Game table,
   Reward moment, Results (win and loss), Profile, Leaderboard, Friends, Museum, Shop, Daily challenge,
   Quests & daily reward, Settings, How to play, Pause menu, Update dialog, Offline dialog, Empty states.
4) Use auto-layout, name layers clearly, build every screen from the shared components, export icons as SVG.
```

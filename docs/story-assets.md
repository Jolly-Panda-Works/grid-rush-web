# هنر لازم برای حالت داستانی (مرمت)

بازی همین الان بدون این تصویرها کار می‌کند: هر جا تصویری نباشد، یک نسخه‌ی موقت (نقاشی ساده با کد، یا پلاک نوشته‌دار در صحنه‌ی مرمت) نشان داده می‌شود. هر فایلی که با همین اسم در همین مسیر گذاشته شود، خودکار جای نسخه‌ی موقت را می‌گیرد و به کد دست نمی‌خورد.

همه‌ی فایل‌ها **WebP** هستند و در `client/public/story/` قرار می‌گیرند. اگر راحت‌ترید، هر دسته را به‌صورت یک شیت (مثل `icons-atlas.png`) بدهید تا من برش بزنم. فقط اسم هر خانه را کنارش بنویسید.

## سبک (اول هر پرامپت)

```text
Art for "Naqsh-Ara", a Persian tilework (kashi) puzzle game. Match the existing style of the game: painterly
semi-realistic illustration, rich haft-rangi glaze colours (lapis, turquoise, saffron, cream, terracotta), gold
leaf details, soft warm top-left light, crisp clean edges. No text, no letters, no calligraphy, no numbers,
no watermark. Fictional place, not a real monument.
```

## ۱. شخصیت‌ها (۶ فایل)

نیم‌تنه (سر و شانه)، رو به بیننده با کمی چرخش، **پس‌زمینه‌ی شفاف**، مربع **۱۰۲۴×۱۰۲۴**. صورت در یک‌سوم بالای تصویر باشد (بازی تصویر را از بالا نشان می‌دهد). سه حالت هر شخصیت باید دقیقاً همان آدم، همان لباس و همان قاب باشند و فقط حالت صورت عوض شود.

| فایل | شخصیت و حالت |
|---|---|
| `chars/master-normal.webp` | استاد: کاشی‌کار پیر، ریش سفید، دستار کرم، ردای لاجوردی با حاشیه‌ی طلایی، یک طومار نقشه‌ی کاشی زیر بغل. نگاه آرام و مهربان |
| `chars/master-happy.webp` | همان، لبخند پهن، چشم‌های خندان |
| `chars/master-surprised.webp` | همان، ابروهای بالا، دهان کمی باز |
| `chars/grandchild-normal.webp` | نوه: جوان حدوداً ۲۰ ساله که از شهر برگشته، لباس امروزی ساده با یک شال فیروزه‌ای سنتی، کوله‌ی کوچک. نگاه کنجکاو |
| `chars/grandchild-happy.webp` | همان، لبخند هیجان‌زده |
| `chars/grandchild-surprised.webp` | همان، چشم‌های گشاد، دست جلوی دهان |

تا این فایل‌ها برسند، برای استاد `hero-10` و برای نوه `hero-2` نشان داده می‌شود.

## ۲. خانه‌های ویژه‌ی صفحه (۳ فایل)

مربع **۲۵۶×۲۵۶**، از بالا (نمای کاملاً روبه‌رو، بدون پرسپکتیو)، کل مربع را پر کند، با یک حاشیه‌ی باریک تیره‌تر تا خانه‌ها از هم جدا دیده شوند. باید کنار کاشی‌های براق بازی، **مات و قدیمی** دیده شوند.

| فایل | خانه | پرامپت |
|---|---|---|
| `cells/stone.webp` | سنگ (روی آن کاشی نمی‌رود) | a rough grey-brown stone block seen from directly above, chipped edges, a little moss in one corner |
| `cells/crack.webp` | کاشی ترک‌خورده (باید پوشانده شود) | an old cream glazed tile seen from above with a dark branching crack across it and a few chipped flakes |
| `cells/gold.webp` | خانه‌ی طلایی (پوشاندنش ۱ خرده‌کاشی می‌دهد) | a cream plaster square with a round gold-leaf inlay in the middle, faint shine |

## ۳. آیکون‌ها (۱۶ فایل)

همان سبک آیکون‌های فعلی بازی (`docs/icons-needed.md`): شیء سه‌بعدی طلایی و مینایی، **پس‌زمینه‌ی شفاف**، **۲۵۶×۲۵۶**، در اندازه‌ی ۲۴ پیکسل هم خوانا باشد.

| فایل | کجا دیده می‌شود | پرامپت |
|---|---|---|
| `icons/brick.webp` | خشت (پول مرمت) | a single fired terracotta brick with a small turquoise glazed corner and a gold stamp on its side |
| `icons/chisel.webp` | ابزار اسکنه | a tiler's steel chisel with a walnut handle and a gold ferrule |
| `icons/wheel.webp` | ابزار چرخ | a turquoise enamel spinning wheel / disc with gold spokes, three tiny tiles on its rim |
| `icons/brush.webp` | ابزار قلم‌مو | a calligrapher's brush with a turquoise-dipped tip and a lapis handle |
| `icons/coinbag.webp` | پاوراپ کیسه‌ی خرده‌کاشی | a lapis velvet pouch tied with gold cord, glazed tile shards peeking out |
| `icons/star.webp` | ستاره‌ی مرحله (پر) | a faceted gold five-point star with a turquoise centre gem |
| `icons/star-empty.webp` | ستاره‌ی مرحله (خالی) | the same star as a dark empty socket of tarnished bronze |
| `icons/life.webp` | جان | a red enamel heart framed in gold filigree |
| `icons/fill_board.webp` | چالش «کل صفحه را پر کن» | a small square panel completely filled with glazed tiles |
| `icons/fill_count.webp` | چالش «N خانه را پر کن» | three glazed tiles stacked with a fourth empty slot outlined |
| `icons/fill_region.webp` | چالش «قاب طلایی را پر کن» | a gold frame with a glazed tile pattern inside it |
| `icons/cover_cracks.webp` | چالش «ترک‌ها را بپوشان» | a cracked tile half covered by a new shiny tile |
| `icons/bonus7.webp` | چالش «مربع ۷×۷» | a big square tile panel with a dashed gold border |
| `icons/max_empty.webp` | چالش «حداکثر N خانه‌ی خالی» | a tile panel with one empty cell marked by a small red outline |
| `icons/min_score.webp` | چالش «دست‌کم N امتیاز» | a turquoise enamel shamseh medal with gold rays |
| `icons/min_shards.webp` | چالش «با N خرده‌کاشی تمام کن» | a neat little pile of glazed tile shards on a lapis tile |

## ۴. پس‌زمینه‌ی نقشه‌ی مرحله‌ها (۱ فایل)

| فایل | اندازه | پرامپت |
|---|---|---|
| `map-bg.webp` | ۱۰۸۰×۱۹۲۰، **بالا و پایینش بی‌درز** (عمودی تکرار می‌شود) | a winding garden path of turquoise and cream tiles climbing up through a Persian garden with cypress trees, a small pool and arches, seen from above at a slight angle; calm, not busy in the middle (the level buttons sit on the path) |

## ۵. صحنه‌ی مرمت: موزه‌ی کاشی (۳۱ فایل)

صحنه **دوبعدی و لایه‌لایه** است. همه‌ی فایل‌های این بخش دقیقاً هم‌اندازه‌اند: **۱۵۳۶×۲۰۴۸ (عمودی، ۳:۴)**، با **یک دوربین و یک ترکیب‌بندی ثابت**: نمای روبه‌روی حیاط و نمای ورودی موزه، کمی از بالا.

- `museum/base.webp` تنها لایه‌ی **کامل و مات** است: موزه‌ی **خرابه**. هر چیزی که قدم‌ها درست می‌کنند، اینجا خراب، کثیف یا خالی است.
- هر قدم یک لایه‌ی **شفاف** است که فقط همان بخشِ مرمت‌شده را دارد و دقیقاً روی همان جای `base` می‌نشیند. بقیه‌ی تصویر شفاف است. لایه‌ها به ترتیب قدم‌ها روی هم می‌آیند، پس قدم‌های بعدی می‌توانند روی قدم‌های قبلی بیایند (مثلاً چراغ‌ها جلوی دیوار تالار).
- بهترین روش ساخت: اول تصویر کامل **مرمت‌شده** را بسازید، بعد نسخه‌ی خرابه‌ی همان را، و هر بخش را از تصویر مرمت‌شده جدا کنید.

| فایل | قدم | جای تقریبی در تصویر (٪ از چپ، ٪ از بالا) |
|---|---|---|
| `museum/base.webp` | موزه‌ی خرابه: آوار، در شکسته، سردر بی‌کاشی، تالارهای تاریک، حوض خشک، سقف ریخته | کل تصویر |
| `museum/rubble.webp` | ۱. جارو کردن آوار: کف تمیز حیاط با کاشی آبی | پایین وسط (۵۰، ۸۶) |
| `museum/door-0.webp` / `door-1.webp` / `door-2.webp` | ۲. در چوبی تعمیرشده: گردو / فیروزه‌ای / لاجوردی | وسط (۵۰، ۶۴) |
| `museum/portal-0.webp` / `-1` / `-2` | ۳. کاشی‌کاری سردر: شمسه / اسلیمی / گره | بالای در (۵۰، ۴۰) |
| `museum/lamps-0.webp` / `-1` / `-2` | ۴. چراغ‌های تالار: برنجی / شیشه‌ی رنگی / فانوس | بالا چپ (۲۲، ۳۰) |
| `museum/hall1.webp` | ۵. تالار اول روشن و مرمت‌شده، با دو قاب خالی روی دیوار | راست (۷۸، ۵۶) |
| `museum/pool-0.webp` / `-1` / `-2` | ۶. حوض حیاط پر از آب: فیروزه‌ای / ستاره‌ای / لاجورد و طلا | پایین (۵۰، ۷۸) |
| `museum/cases.webp` | ۷. ویترین‌های شیشه‌ای با کاشی‌های قدیمی | چپ (۲۰، ۶۰) |
| `museum/ceiling.webp` | ۸. سقف مقرنس | بالا (۵۰، ۱۲) |
| `museum/hall2.webp` | ۹. تالار دوم، دو قاب دیگر | بالا راست (۸۰، ۳۰) |
| `museum/opening.webp` | ۱۰. افتتاحیه: پرچم‌ها، گل، نور جشن (روی همه‌چیز) | کل تصویر، سبک |

جای دکمه‌ی «قدم بعد» روی صحنه از همین ستون آخر می‌آید. اگر ترکیب‌بندی شما فرق داشت، فقط جاها را بگویید تا در `RestoreScreen.tsx` (جدول `SPOT`) عوضشان کنم.

### بندانگشتی طرح‌ها (۱۲ فایل)

برای پنجره‌ی انتخاب طرح: مربع **۲۵۶×۲۵۶**، فقط همان شیء (در، سردر، چراغ، حوض) نزدیک و واضح، با پس‌زمینه‌ی ساده‌ی کرم.

`museum/door-0-thumb.webp`، `door-1-thumb.webp`، `door-2-thumb.webp`، `portal-0-thumb.webp` تا `portal-2-thumb.webp`، `lamps-0-thumb.webp` تا `lamps-2-thumb.webp`، `pool-0-thumb.webp` تا `pool-2-thumb.webp`.

## ۶. روز و خرده‌کاشی (۱ فایل، به‌اضافه‌ی ۱ اختیاری)

این دو در `client/public/art/icons/` می‌روند (کنار آیکون‌های فعلی بازی)، با همان سبک و اندازه‌ی ۲۵۶×۲۵۶. سند واژه‌ها: [days-and-shards.md](days-and-shards.md).

| فایل | کجا | پرامپت |
|---|---|---|
| `art/icons/shard.webp` | **خرده‌کاشی**، پول داخل مسابقه و مرحله (روی کارت کاشی، پنل بازیکن، نتیجه). نباید شبیه سکه باشد | three small broken pieces of glazed tile (turquoise, lapis, cream with a gold rim), lying together like a little pile of shards |
| `art/icons/treasure.webp` (اختیاری، جایگزین فعلی) | **روز مزد** روی تقویم | a small cloth wage bag tied with a gold cord, a few tile shards peeking out |

برای «روز» آیکون تقویم فعلی بازی (`calendar`) و برای «روز هدیه» آیکون هدیه‌ی فعلی (`gift`) استفاده می‌شود.

## جمع

| دسته | تعداد |
|---|---|
| شخصیت‌ها | ۶ |
| خانه‌های ویژه | ۳ |
| آیکون‌ها | ۱۶ |
| پس‌زمینه‌ی نقشه | ۱ |
| صحنه‌ی موزه (پایه + لایه‌ها) | ۱۹ |
| بندانگشتی طرح‌ها | ۱۲ |
| روز و خرده‌کاشی | ۱ (+۱ اختیاری) |
| **جمع** | **۵۸** |

## بعداً (هنوز در بازی نیست)

این‌ها مال بخش‌هایی است که در نمونه‌ی اول ساخته نشده‌اند. لازم نیست الان بسازید:

- خانه‌های «قفل» و «گچ»، آیکون ابزارهای ساعت شنی، پتک، ذره‌بین و قالب، پاوراپ‌های نقشه‌ی گنج و کاشی طلایی
- صندوق ستاره و صندوق پایان فضا
- فضاهای بعدی: کاروانسرا، حمام قدیمی، بازار سرپوشیده، باغ ایرانی، عمارت

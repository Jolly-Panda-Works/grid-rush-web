import { useStore } from './store';

export type Lang = 'en' | 'fa';
type Dict = Record<string, string>;

const en: Dict = {
  tagline: 'Build Your Grid. Beat the Clock.',
  'loading.fonts': 'Loading fonts', 'loading.server': 'Contacting game server', 'loading.online': 'Server online', 'loading.offline': 'Server offline',
  'tip.0': 'Ending the game does not mean winning it. Check the score first.',
  'tip.1': 'Advance jumps you to one cell ahead of your opponent and pays 1 coin per cell.',
  'tip.2': 'Treasure cells pay out all the coins engraved on your tiles.',
  'tip.3': 'Every empty cell costs you 2 points at the end.',
  'menu.name': 'Your name', 'menu.lv': 'Lv {n}', 'menu.rating': 'Rating {n}', 'menu.wl': '{w}W · {l}L',
  'menu.offline': 'Game server is offline. Run "npm run dev" in the project folder.', 'menu.retry': 'Retry',
  'menu.find': 'Find match', 'menu.bot': 'Play vs bot', 'menu.how': 'How to play', 'menu.sound': 'Sound', 'menu.reduce': 'Reduce motion', 'menu.lang': 'Language',
  'mm.connecting': 'Connecting…', 'mm.prepBot': 'Preparing your bot…', 'mm.finding': 'Finding an opponent…',
  'mm.wait': 'If nobody joins in {s}s, a bot opponent matched to your level and rating will take the seat.',
  'mm.cancel': 'Cancel', 'mm.errTitle': 'Connection problem', 'mm.err': 'Cannot reach the game server at {url}. Start it with "npm run dev".',
  'mm.again': 'Try again', 'mm.back': 'Back', 'mm.youStart': 'You start.', 'mm.oppStarts': '{name} starts.', 'mm.ready': 'Get ready…', 'mm.botTag': 'Bot · {tier}',
  'tier.1': 'Rookie', 'tier.2': 'Casual', 'tier.3': 'Skilled', 'tier.4': 'Expert', 'tier.5': 'Master',
  you: 'You', bot: 'Bot', offline: 'offline',
  'hud.pos': 'Time track position', 'hud.coins': 'Coins', 'hud.cells': 'Cells filled', 'hud.score': 'Score if the game ended now', 'hud.treasure': 'Treasure', 'hud.reward': '1x1 reward',
  'hud.level': 'Level', 'hud.leads': '{name} leads by {n}', 'hud.finish': 'finish at {n}', 'hud.lv': 'Lv {n}',
  'offer.placeReward': 'Place your 1x1 reward tile on your board ({n} left). Click an empty cell.',
  'offer.playing': '{name}{bot} is playing', 'offer.over': 'Game over…', 'offer.botSuffix': ' (bot)',
  'offer.noCoins': 'Not enough coins', 'offer.noRoom': 'No room on your board', 'offer.needCoins': 'Need coins', 'offer.room': 'No room',
  'offer.engraved': 'Engraved coins (paid out at treasures)', 'offer.select': 'Select ({n})',
  'offer.rotate': 'Rotate', 'offer.flip': 'Flip ↔', 'offer.flipV': 'Flip ↕', 'offer.cancel': 'Cancel', 'offer.hint': 'Drag a tile onto your board (or click it, then click the board), or advance.', 'offer.next': 'Next', 'offer.nextTitle': 'This tile will appear after the next purchase',
  'offer.passes': 'Passes opponent: turn ends', 'offer.keeps': 'You keep the turn', 'offer.tre': '{n} treasure +{c}', 'offer.ends': 'ENDS THE GAME',
  'offer.advance': 'Advance', 'offer.advInfo': '+{n} cells · +{n} coins', 'offer.advEnds': ' · ends game',
  'game.resign': 'Resign', 'game.resignTitle': 'Resign this game?', 'game.resignText': 'Your opponent wins and your rating drops.', 'game.keep': 'Keep playing',
  'game.reconnecting': 'Connection lost. Reconnecting…', 'game.over': 'Game over. Calculating results…', 'game.loading3d': 'Loading 3D…', 'game.waiting': 'Waiting for game state…',
  'toast.buy': '{name} bought a tile (-{c} coin, +{t} time)', 'toast.advance': '{name} advanced {s} and gained {c} coins',
  'toast.treasure': '{name} hit a treasure: +{c}', 'toast.reward': '{name} claimed a 1x1 reward tile', 'toast.bonus7': '{name} completed a 7x7 area! +7',
  'toast.timeout': '{name} ran out of time - auto move played.', 'toast.noFit': 'That tile does not fit there', 'toast.yourTurn': 'Your turn!', 'toast.lost': 'Connection lost.',
  'res.win': 'Victory', 'res.lose': 'Defeat',
  'res.track_end': 'Someone reached the end of the time track', 'res.board_full': 'A board was completely filled',
  'res.forfeit': 'A player resigned or disconnected', 'res.timeout': 'A player stopped responding',
  'res.tie': ' · tie broken in favour of the player who ended the game',
  'res.coins': 'Coins left', 'res.bonus': '7x7 bonus', 'res.empty': '{n} empty cells (x{p})', 'res.final': 'Final score', 'res.filled': 'Filled {a}/{b}',
  'res.rating': 'Rating', 'res.xp': '+{n} XP · Level', 'res.levelUp': 'Level up!', 'res.again': 'Play again', 'res.menu': 'Main menu',
  'help.title': 'How to play', 'help.sub': 'Fill your {n}x{n} board while racing your opponent on one shared time track.',
  'help.r1': 'Each action is one of two: Buy a tile from the 3 on offer, or Advance.',
  'help.r2': 'Buy: pay its coin cost, place it (rotate and flip are free), then move forward by its time cost.',
  'help.r3': 'Advance: jump to exactly one cell ahead of your opponent and gain 1 coin per cell moved. Your catch-up tool.',
  'help.r4': 'Turns: you keep acting until you pass your opponent. Landing on the same cell does not end your turn.',
  'help.r5': 'Treasure cells: passing one pays the sum of the coins engraved on all your tiles.',
  'help.r6': '1x1 reward cells: the first player to reach one takes the tile and must place it on their board.',
  'help.r7': '7x7 bonus: the first player to fill any 7x7 area gets +{b} (once per game).',
  'help.r8': 'Game ends when someone reaches cell {l}, or a board is completely full.',
  'help.r9': 'Score: coins + bonus - {p} per empty cell. A tie goes to the player who ended the game.',
  'help.r10': 'You start with {c} coins. Ending the game does not guarantee a win: check the score first.',
  'help.keys': 'Drag a tile from the bottom panel onto your board to preview and place it. Shortcuts: 1-3 select tile, R rotate, F flip horizontally, V flip vertically, A advance, Esc cancel. On touch you can also tap to preview and tap again to place.', 'help.ok': 'Got it',
  'err.Not enough coins': 'Not enough coins', 'err.Not your turn': 'Not your turn', 'err.Cells are not free': 'Those cells are not free',
};

const fa: Dict = {
  tagline: 'شبکه‌ات را بساز. ساعت را شکست بده.',
  'loading.fonts': 'در حال بارگذاری فونت‌ها', 'loading.server': 'در حال اتصال به سرور بازی', 'loading.online': 'سرور آنلاین است', 'loading.offline': 'سرور در دسترس نیست',
  'tip.0': 'پایان‌دادن به بازی یعنی بردن نیست. اول امتیازها را مقایسه کن.',
  'tip.1': 'Advance تو را یک خانه جلوتر از حریف می‌برد و به‌ازای هر خانه ۱ سکه می‌دهد.',
  'tip.2': 'خانه‌ی خزانه مجموع سکه‌های حکاکی‌شده‌ی همه‌ی کاشی‌هایت را می‌دهد.',
  'tip.3': 'هر خانه‌ی خالی در پایان ۲ امتیاز از تو کم می‌کند.',
  'menu.name': 'نام تو', 'menu.lv': 'سطح {n}', 'menu.rating': 'رتبه {n}', 'menu.wl': '{w} برد · {l} باخت',
  'menu.offline': 'سرور بازی در دسترس نیست. در پوشه‌ی پروژه دستور «npm run dev» را اجرا کن.', 'menu.retry': 'تلاش دوباره',
  'menu.find': 'پیدا کردن حریف', 'menu.bot': 'بازی با بات', 'menu.how': 'راهنمای بازی', 'menu.sound': 'صدا', 'menu.reduce': 'کاهش حرکت', 'menu.lang': 'زبان',
  'mm.connecting': 'در حال اتصال…', 'mm.prepBot': 'در حال آماده‌سازی بات…', 'mm.finding': 'در حال جست‌وجوی حریف…',
  'mm.wait': 'اگر تا {s} ثانیه‌ی دیگر کسی نیامد، یک بات هم‌سطح با سطح و رتبه‌ی تو جای حریف می‌نشیند.',
  'mm.cancel': 'لغو', 'mm.errTitle': 'مشکل در اتصال', 'mm.err': 'اتصال به سرور بازی در {url} ممکن نیست. با «npm run dev» آن را اجرا کن.',
  'mm.again': 'تلاش دوباره', 'mm.back': 'بازگشت', 'mm.youStart': 'تو شروع می‌کنی.', 'mm.oppStarts': '{name} شروع می‌کند.', 'mm.ready': 'آماده باش…', 'mm.botTag': 'بات · {tier}',
  'tier.1': 'تازه‌کار', 'tier.2': 'معمولی', 'tier.3': 'ماهر', 'tier.4': 'خبره', 'tier.5': 'استاد',
  you: 'تو', bot: 'بات', offline: 'آفلاین',
  'hud.pos': 'جایگاه روی مسیر زمان', 'hud.coins': 'سکه', 'hud.cells': 'خانه‌های پرشده', 'hud.score': 'امتیاز اگر بازی همین حالا تمام شود', 'hud.treasure': 'خزانه', 'hud.reward': 'کاشی ۱×۱',
  'hud.level': 'هم‌سطح', 'hud.leads': '{name} به اندازه‌ی {n} خانه جلوتر است', 'hud.finish': 'پایان در خانه‌ی {n}', 'hud.lv': 'سطح {n}',
  'offer.placeReward': 'کاشی ۱×۱ جایزه را روی صفحه‌ات بگذار ({n} مانده). روی یک خانه‌ی خالی کلیک کن.',
  'offer.playing': '{name}{bot} در حال بازی است', 'offer.over': 'بازی تمام شد…', 'offer.botSuffix': ' (بات)',
  'offer.noCoins': 'سکه‌ی کافی نداری', 'offer.noRoom': 'روی صفحه‌ات جایی برای آن نیست', 'offer.needCoins': 'سکه کم داری', 'offer.room': 'جا نیست',
  'offer.engraved': 'سکه‌ی حکاکی‌شده (در خزانه‌ها پرداخت می‌شود)', 'offer.select': 'انتخاب ({n})',
  'offer.rotate': 'چرخش', 'offer.flip': 'آینه ↔', 'offer.flipV': 'آینه ↕', 'offer.cancel': 'لغو', 'offer.hint': 'کاشی را بکش و روی صفحه‌ات رها کن (یا روی آن کلیک کن و بعد روی صفحه کلیک کن)، یا Advance بزن.', 'offer.next': 'بعدی', 'offer.nextTitle': 'این کاشی بعد از خرید بعدی وارد می‌شود',
  'offer.passes': 'از حریف عبور می‌کنی: نوبت تمام می‌شود', 'offer.keeps': 'نوبت با خودت می‌ماند', 'offer.tre': '{n} خزانه، +{c}', 'offer.ends': 'بازی را تمام می‌کند',
  'offer.advance': 'Advance', 'offer.advInfo': '+{n} خانه · +{n} سکه', 'offer.advEnds': ' · بازی تمام می‌شود',
  'game.resign': 'تسلیم', 'game.resignTitle': 'تسلیم می‌شوی؟', 'game.resignText': 'حریف برنده می‌شود و رتبه‌ات کم می‌شود.', 'game.keep': 'ادامه‌ی بازی',
  'game.reconnecting': 'اتصال قطع شد. در حال اتصال دوباره…', 'game.over': 'بازی تمام شد. در حال محاسبه‌ی نتیجه…', 'game.loading3d': 'در حال بارگذاری سه‌بعدی…', 'game.waiting': 'در انتظار وضعیت بازی…',
  'toast.buy': '{name} یک کاشی خرید (-{c} سکه، +{t} زمان)', 'toast.advance': '{name} {s} خانه پیش رفت و {c} سکه گرفت',
  'toast.treasure': '{name} به خزانه رسید: +{c}', 'toast.reward': '{name} کاشی ۱×۱ جایزه را گرفت', 'toast.bonus7': '{name} یک ناحیه‌ی ۷×۷ را کامل کرد! +7',
  'toast.timeout': 'زمان {name} تمام شد و حرکت خودکار انجام شد.', 'toast.noFit': 'این کاشی آنجا جا نمی‌شود', 'toast.yourTurn': 'نوبت توست!', 'toast.lost': 'اتصال قطع شد.',
  'res.win': 'پیروزی', 'res.lose': 'شکست',
  'res.track_end': 'یکی از بازیکن‌ها به انتهای مسیر زمان رسید', 'res.board_full': 'یک صفحه کاملاً پر شد',
  'res.forfeit': 'یک بازیکن تسلیم شد یا اتصالش قطع شد', 'res.timeout': 'یک بازیکن پاسخ نداد',
  'res.tie': ' · تساوی به نفع بازیکنی که بازی را تمام کرد',
  'res.coins': 'سکه‌ی باقی‌مانده', 'res.bonus': 'پاداش ۷×۷', 'res.empty': '{n} خانه‌ی خالی (×{p})', 'res.final': 'امتیاز نهایی', 'res.filled': 'پرشده {a} از {b}',
  'res.rating': 'رتبه', 'res.xp': '+{n} تجربه · سطح', 'res.levelUp': 'ارتقای سطح!', 'res.again': 'بازی دوباره', 'res.menu': 'منوی اصلی',
  'help.title': 'راهنمای بازی', 'help.sub': 'صفحه‌ی {n}×{n} خودت را پر کن و روی یک مسیر زمان مشترک با حریف رقابت کن.',
  'help.r1': 'در هر اکشن یکی از این دو کار را می‌کنی: خرید یکی از ۳ کاشی پیشنهادی، یا Advance.',
  'help.r2': 'خرید: هزینه‌ی سکه را بپرداز، کاشی را بگذار (چرخش و آینه رایگان است) و به‌اندازه‌ی هزینه‌ی زمانش جلو برو.',
  'help.r3': 'Advance: دقیقاً به یک خانه جلوتر از حریف می‌روی و به‌ازای هر خانه ۱ سکه می‌گیری. ابزار جبران عقب‌ماندگی.',
  'help.r4': 'نوبت: تا وقتی از حریف عبور نکرده‌ای نوبت با توست. رسیدن به همان خانه‌ی حریف نوبت را تمام نمی‌کند.',
  'help.r5': 'خانه‌ی خزانه: با رسیدن یا عبور، مجموع سکه‌های حکاکی‌شده روی همه‌ی کاشی‌هایت را می‌گیری.',
  'help.r6': 'خانه‌ی ۱×۱ جایزه: اولین بازیکنی که برسد کاشی را می‌گیرد و باید آن را روی صفحه‌اش بگذارد.',
  'help.r7': 'پاداش ۷×۷: اولین بازیکنی که یک ناحیه‌ی ۷×۷ را کامل کند {b} امتیاز می‌گیرد (فقط یک بار در بازی).',
  'help.r8': 'پایان بازی: وقتی کسی به خانه‌ی {l} برسد، یا یک صفحه کاملاً پر شود.',
  'help.r9': 'امتیاز: سکه + پاداش − {p} به‌ازای هر خانه‌ی خالی. در تساوی، بازیکنی که بازی را تمام کرده برنده است.',
  'help.r10': 'با {c} سکه شروع می‌کنی. تمام‌کردن بازی برد را تضمین نمی‌کند، اول امتیازها را ببین.',
  'help.keys': 'کاشی را از پنل پایین به صفحه‌ات بکش تا جایگاهش پیش‌نمایش شود و رها کن تا قرار بگیرد. میان‌برها: ۱ تا ۳ انتخاب کاشی، R چرخش، F آینه‌ی افقی، V آینه‌ی عمودی، A پیشروی، Esc لغو. روی موبایل می‌توانی با یک تپ پیش‌نمایش و تپ دوم قرار بدهی.', 'help.ok': 'متوجه شدم',
  'err.Not enough coins': 'سکه‌ی کافی نداری', 'err.Not your turn': 'نوبت تو نیست', 'err.Cells are not free': 'آن خانه‌ها خالی نیستند',
};

const DICTS: Record<Lang, Dict> = { en, fa };

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? en[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}
/** React hook: re-renders on language change. */
export function useT() {
  const lang = useStore((s) => s.settings.lang);
  return (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
}
/** Non-hook version for network code. */
export const tr = (key: string, vars?: Record<string, string | number>) => translate(useStore.getState().settings.lang, key, vars);
export const trErr = (msg: string) => { const k = 'err.' + msg; const v = translate(useStore.getState().settings.lang, k); return v === k ? msg : v; };

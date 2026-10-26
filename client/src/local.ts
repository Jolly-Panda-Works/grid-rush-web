import {
  Action, BOT_INTENT_MS, BOT_THINK_MS, GameState, PlayerInit, Seat, applyAction, applySoloAction, botTierFor, chooseAction, createGame,
  createSoloGame, forfeit,
} from '../../shared/src';
import type { LevelDef, SoloAction } from '../../shared/src';
import type { Attempt } from './story';
import { tr } from './i18n';

/**
 * Offline game: the shared rules engine and the bot run right inside the app, so playing against a bot
 * works without any server (this is what the mobile app uses until the online server is available).
 */
const BOT_NAMES = ['Nova', 'Pixel', 'Vector', 'Quark', 'Atlas', 'Echo', 'Rune', 'Axiom', 'Kite', 'Orbit', 'Delta', 'Mosaic'];
const BOT_NAMES_FA = ['آرش', 'نیکا', 'کیان', 'سارا', 'رها', 'پارسا', 'مهان', 'آوا', 'سپهر', 'نوین', 'دانا', 'یاسی'];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export interface LocalOpts {
  human: PlayerInit;
  lang: 'en' | 'fa';
  deliver: (g: GameState) => void;
  onError: (msg: string) => void;
  /** the bot announces its next action before playing it, so the player can follow it */
  onIntent: (seat: Seat, a: Action) => void;
}

export class LocalSession {
  game: GameState;
  humanSeat: Seat;
  botTier: number;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private started = false;

  constructor(private o: LocalOpts) {
    const h = o.human;
    this.botTier = botTierFor(h.level, h.rating);
    const names = o.lang === 'fa' ? BOT_NAMES_FA : BOT_NAMES;
    const bot: PlayerInit = {
      name: names[Math.floor(Math.random() * names.length)], isBot: true, botTier: this.botTier,
      rating: Math.max(100, Math.round(h.rating + (this.botTier - 3) * 25 + rand(-40, 40))),
      level: Math.max(1, h.level + Math.round(rand(-1, 2))),
    };
    this.humanSeat = Math.random() < 0.5 ? 0 : 1; // random seat, like the online matchmaking
    this.game = createGame(this.humanSeat === 0 ? [h, bot] : [bot, h]);
  }

  snapshot(): GameState { return JSON.parse(JSON.stringify(this.game)); }
  private push() { if (!this.stopped) this.o.deliver(this.snapshot()); }

  /** Called when the "versus" screen is over. */
  begin() { this.started = true; this.push(); this.schedule(); }

  act(a: Action) {
    if (this.stopped || !this.started) return;
    const err = applyAction(this.game, this.humanSeat, a);
    if (err) return this.o.onError(err);
    this.push();
    this.schedule();
  }

  resign() {
    if (this.stopped || this.game.phase === 'finished') return;
    forfeit(this.game, this.humanSeat, 'forfeit');
    clearTimeout(this.timer);
    this.push();
  }

  stop() { this.stopped = true; clearTimeout(this.timer); }

  private schedule() {
    clearTimeout(this.timer);
    if (this.stopped || this.game.phase === 'finished') return;
    const seat = this.game.current;
    if (!this.game.players[seat].isBot) return;
    const alive = () => !this.stopped && this.game.phase !== 'finished' && this.game.current === seat;
    this.timer = setTimeout(() => {
      if (!alive()) return;
      const a = chooseAction(this.game, seat, this.botTier);
      this.o.onIntent(seat, a);
      this.timer = setTimeout(() => {
        if (!alive()) return;
        if (applyAction(this.game, seat, a)) applyAction(this.game, seat, { t: 'advance' });
        this.push();
        this.schedule();
      }, BOT_INTENT_MS);
    }, BOT_THINK_MS[0] + Math.random() * (BOT_THINK_MS[1] - BOT_THINK_MS[0]));
  }
}

/** A story level: one board against the pacer, played on the device. Every action is kept, in order: at the end the
 *  list goes to the server, which replays it. */
export class LevelSession {
  game: GameState;
  readonly humanSeat: Seat = 0;
  readonly actions: SoloAction[] = [];
  private stopped = false;

  constructor(readonly level: LevelDef, readonly attempt: Attempt, name: string, private deliver: (g: GameState) => void, private onError: (msg: string) => void) {
    this.game = createSoloGame(level, { name, tools: attempt.tools, coinBag: attempt.coinBag });
    this.game.players[1].name = tr('story.pacer'); // (display only: the replay does not look at names)
  }

  snapshot(): GameState { return JSON.parse(JSON.stringify(this.game)); }

  act(a: SoloAction) {
    if (this.stopped) return;
    const err = applySoloAction(this.game, a);
    if (err) return this.onError(err);
    this.actions.push(a);
    this.deliver(this.snapshot());
  }

  stop() { this.stopped = true; }
}

import { Room, Client } from 'colyseus';
import {
  Action, Cell, GameState, MATCH_WAIT_MS, PlayerInit, Seat, TURN_SECONDS,
  applyAction, botTierFor, chooseAction, createGame, forfeit, other, BOT_TIER_NAMES,
} from '../../shared/src';

interface Human { name: string; level: number; rating: number }
interface Participant { sid: string | null; init: PlayerInit }

const BOT_NAMES = ['Nova', 'Pixel', 'Vector', 'Quark', 'Atlas', 'Echo', 'Rune', 'Axiom', 'Kite', 'Orbit', 'Delta', 'Mosaic'];
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const cleanName = (n: unknown) => (typeof n === 'string' ? n.replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 16) : '') || 'Player';
const cleanNum = (n: unknown, lo: number, hi: number, d: number) => (typeof n === 'number' && isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : d);

export class GridRushRoom extends Room {
  maxClients = 2;
  private solo = false;
  private humans = new Map<string, Human>();
  private seatOf = new Map<string, Seat>();
  private game: GameState | null = null;
  private started = false;
  private matchTimer: { clear(): void } | null = null;
  private turnTimer: { clear(): void } | null = null;
  private botTimer: { clear(): void } | null = null;
  private deadline = 0;
  private idle: [number, number] = [0, 0];

  onCreate(options: { solo?: boolean }) {
    this.solo = !!options?.solo;
    if (this.solo) this.setPrivate(true);
    this.setSeatReservationTime(15);

    this.onMessage('advance', (c) => this.human(c, { t: 'advance' }));
    this.onMessage('buy', (c, m) => {
      const cells = this.parseCells(m?.cells);
      if (!cells || !Number.isInteger(m?.offer)) return c.send('error', { msg: 'Bad buy request' });
      this.human(c, { t: 'buy', offer: m.offer, cells });
    });
    this.onMessage('reward', (c, m) => this.human(c, { t: 'reward', r: m?.r, c: m?.c }));
    this.onMessage('resign', (c) => {
      const seat = this.seatOf.get(c.sessionId);
      if (seat !== undefined && this.game && this.game.phase !== 'finished') this.endByForfeit(seat, 'forfeit');
    });
  }

  private parseCells(raw: unknown): Cell[] | null {
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 6) return null;
    const out: Cell[] = [];
    for (const c of raw) {
      if (!Array.isArray(c) || c.length !== 2 || !Number.isInteger(c[0]) || !Number.isInteger(c[1])) return null;
      out.push([c[0], c[1]]);
    }
    return out;
  }

  /* ---------------- lobby ---------------- */
  onJoin(client: Client, options: { name?: string; level?: number; rating?: number }) {
    this.humans.set(client.sessionId, {
      name: cleanName(options?.name),
      level: cleanNum(options?.level, 1, 99, 1),
      rating: cleanNum(options?.rating, 100, 4000, 1000),
    });
    if (this.humans.size === 1) {
      const wait = this.solo ? 1800 : Number(process.env.MATCH_WAIT_MS || MATCH_WAIT_MS);
      client.send('lobby', { waitMs: wait, solo: this.solo });
      this.matchTimer = this.clock.setTimeout(() => this.startMatch(true), wait);
    } else {
      this.matchTimer?.clear();
      this.startMatch(false);
    }
  }

  private startMatch(withBot: boolean) {
    if (this.started || this.humans.size === 0) return;
    this.started = true;
    this.lock();
    const parts: Participant[] = [...this.humans.entries()].map(([sid, h]) => ({
      sid, init: { name: h.name, isBot: false, level: h.level, rating: h.rating },
    }));
    if (withBot) {
      const h = parts[0].init;
      const tier = botTierFor(h.level, h.rating);
      const rating = Math.max(100, Math.round(h.rating + (tier - 3) * 25 + rand(-40, 40)));
      const level = Math.max(1, h.level + Math.round(rand(-1, 2)));
      const name = `${BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]}`;
      parts.push({ sid: null, init: { name, isBot: true, level, rating, botTier: tier } });
    }
    if (Math.random() < 0.5) parts.reverse(); // random seat assignment
    this.game = createGame([parts[0].init, parts[1].init]);
    parts.forEach((p, i) => { if (p.sid) this.seatOf.set(p.sid, i as Seat); });
    for (const p of parts) {
      if (!p.sid) continue;
      const cl = this.clients.find((c) => c.sessionId === p.sid);
      cl?.send('matched', { seat: this.seatOf.get(p.sid), botTierName: withBot ? BOT_TIER_NAMES[(parts.find((x) => x.init.isBot)?.init.botTier ?? 1) - 1] : null });
    }
    this.broadcastState();
    this.clock.setTimeout(() => { this.armTurn(); this.broadcastState(); }, 2600);
  }

  /* ---------------- gameplay ---------------- */
  private payload() {
    const g = this.game!;
    const humanTurn = g.phase !== 'finished' && !g.players[g.current].isBot;
    return { state: g, turnLeft: humanTurn && this.deadline ? Math.max(0, Math.round((this.deadline - Date.now()) / 1000)) : null };
  }
  private broadcastState() { if (this.game) this.broadcast('state', this.payload()); }

  private human(client: Client, a: Action) {
    const seat = this.seatOf.get(client.sessionId);
    if (seat === undefined || !this.game) return;
    const err = applyAction(this.game, seat, a);
    if (err) return client.send('error', { msg: err });
    this.idle[seat] = 0;
    this.afterAction();
  }

  private afterAction() {
    this.armTurn();
    this.broadcastState();
    if (this.game?.phase === 'finished') this.onFinished();
  }

  private armTurn() {
    this.turnTimer?.clear();
    this.botTimer?.clear();
    this.deadline = 0;
    const g = this.game;
    if (!g || g.phase === 'finished') return;
    const p = g.players[g.current];
    if (p.isBot) {
      const seat = g.current;
      const delay = 1000 + Math.random() * 1100;
      this.botTimer = this.clock.setTimeout(() => {
        if (!this.game || this.game.phase === 'finished' || this.game.current !== seat) return;
        let err = applyAction(this.game, seat, chooseAction(this.game, seat, p.botTier));
        if (err) err = applyAction(this.game, seat, { t: 'advance' });
        this.afterAction();
      }, delay);
    } else {
      this.deadline = Date.now() + TURN_SECONDS * 1000;
      this.turnTimer = this.clock.setTimeout(() => this.onTurnTimeout(), TURN_SECONDS * 1000);
    }
  }

  private onTurnTimeout() {
    const g = this.game;
    if (!g || g.phase === 'finished') return;
    const seat = g.current;
    this.idle[seat]++;
    if (this.idle[seat] >= 2) return this.endByForfeit(seat, 'timeout');
    applyAction(g, seat, chooseAction(g, seat, 1));
    this.broadcast('notice', { msg: `${g.players[seat].name} ran out of time - auto move played.` });
    this.afterAction();
  }

  private endByForfeit(loser: Seat, reason: 'forfeit' | 'timeout') {
    if (!this.game || this.game.phase === 'finished') return;
    forfeit(this.game, loser, reason);
    this.turnTimer?.clear();
    this.botTimer?.clear();
    this.deadline = 0;
    this.broadcastState();
    this.onFinished();
  }

  private onFinished() {
    this.clock.setTimeout(() => this.disconnect(), 90_000);
  }

  async onLeave(client: Client, consented: boolean) {
    const seat = this.seatOf.get(client.sessionId);
    if (seat === undefined || !this.game) {
      this.humans.delete(client.sessionId);
      if (!this.started && this.humans.size === 0) this.matchTimer?.clear();
      return;
    }
    if (this.game.phase === 'finished') return;
    if (consented) return this.endByForfeit(seat, 'forfeit');
    this.game.players[seat].connected = false;
    this.broadcastState();
    try {
      await this.allowReconnection(client, 25);
      if (this.game) { this.game.players[seat].connected = true; this.broadcastState(); }
    } catch {
      this.endByForfeit(seat, 'forfeit');
    }
  }

  onDispose() {
    this.turnTimer?.clear();
    this.botTimer?.clear();
    this.matchTimer?.clear();
  }
}
void other;

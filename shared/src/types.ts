export type Rng = () => number;
export type Cell = [number, number]; // [row, col]
export type Seat = 0 | 1;

export interface TileDef {
  uid: number;
  shape: string;
  cells: Cell[];
  timeCost: number;
  coinCost: number;
  engraved: number;
}

export interface PlacedTile {
  uid: number;
  shape: string;
  engraved: number;
  cells: Cell[];
}

export interface PlayerState {
  seat: Seat;
  name: string;
  isBot: boolean;
  botTier: number;
  level: number;
  rating: number;
  coins: number;
  pos: number;
  board: number[]; // BOARD_SIZE*BOARD_SIZE, 0 = empty, otherwise tile uid
  tiles: PlacedTile[];
  bonus7: boolean;
  connected: boolean;
}

export type Phase = 'playing' | 'placing_reward' | 'finished';
export type EndReason = 'track_end' | 'board_full' | 'forfeit' | 'timeout';

export interface ScoreBreakdown {
  coins: number;
  bonus: number;
  emptyCells: number;
  penalty: number;
  total: number;
}

export interface GameResult {
  winner: Seat;
  reason: EndReason;
  endedBy: Seat | null;
  tieBreak: boolean;
  scores: [ScoreBreakdown, ScoreBreakdown];
}

export type GameEventBody =
  | { k: 'buy'; seat: Seat; shape: string; timeCost: number; coinCost: number }
  | { k: 'advance'; seat: Seat; steps: number; coins: number }
  | { k: 'move'; seat: Seat; from: number; to: number }
  | { k: 'treasure'; seat: Seat; pos: number; coins: number }
  | { k: 'reward'; seat: Seat; pos: number }
  | { k: 'place1x1'; seat: Seat }
  | { k: 'bonus7'; seat: Seat }
  | { k: 'turn'; seat: Seat }
  | { k: 'end'; reason: EndReason };
export type GameEvent = GameEventBody & { id: number };

export interface GameState {
  phase: Phase;
  current: Seat;
  players: [PlayerState, PlayerState];
  offer: TileDef[];
  rewardTaken: boolean[];
  bonus7By: Seat | null;
  endTriggeredBy: Seat | null;
  pendingRewards: number;
  nextUid: number;
  eventSeq: number;
  events: GameEvent[];
  turnNo: number;
  result: GameResult | null;
}

export type Action =
  | { t: 'buy'; offer: number; cells: Cell[] }
  | { t: 'advance' }
  | { t: 'reward'; r: number; c: number };

export interface PlayerInit {
  name: string;
  isBot: boolean;
  level: number;
  rating: number;
  botTier?: number;
}

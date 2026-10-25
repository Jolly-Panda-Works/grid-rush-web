import type { Profile } from './profile';

/** What one finished game contributes to the achievements (from the player's point of view). */
export interface GameSummary {
  won: boolean; score: number; empty: number; coins: number; bonus7: boolean; tiles: number;
  treasures: number; vsBotTier: number | null;
}

export interface Achievement {
  id: string; icon: string;
  /** progress towards the goal, 0..goal (goal 1 = a one-off feat) */
  progress: (p: Profile, last?: GameSummary) => number;
  goal: number;
}

/** Achievements are checked after every game and kept on the profile with their unlock time. */
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win', icon: '🏆', goal: 1, progress: (p) => Math.min(1, p.wins) },
  { id: 'wins_10', icon: '🥇', goal: 10, progress: (p) => p.wins },
  { id: 'wins_50', icon: '👑', goal: 50, progress: (p) => p.wins },
  { id: 'games_25', icon: '🎲', goal: 25, progress: (p) => p.stats.games },
  { id: 'streak_3', icon: '🔥', goal: 3, progress: (p) => p.stats.bestStreak },
  { id: 'bonus7', icon: '▦', goal: 1, progress: (p) => Math.min(1, p.stats.bonus7) },
  { id: 'full_board', icon: '🧩', goal: 1, progress: (p) => Math.min(1, p.stats.fullBoards) },
  { id: 'score_15', icon: '⭐', goal: 15, progress: (p) => Math.max(0, p.stats.bestScore ?? 0) },
  { id: 'rich', icon: '🪙', goal: 1, progress: (_p, g) => (g && g.coins >= 30 ? 1 : 0) },
  { id: 'treasure_5', icon: '🧰', goal: 1, progress: (_p, g) => (g && g.treasures >= 5 ? 1 : 0) },
  { id: 'tiles_100', icon: '🏛', goal: 100, progress: (p) => p.stats.tiles },
  { id: 'beat_master', icon: '🤖', goal: 1, progress: (p) => Math.min(1, p.stats.botMasterWins) },
  { id: 'museum', icon: '🖼', goal: 1, progress: () => 0 }, // unlocked by exhibiting a board (unlock())
];

/** Ids that this game newly completed (the profile must already include this game's stats). */
export function newlyUnlocked(p: Profile, last: GameSummary): string[] {
  return ACHIEVEMENTS.filter((a) => !p.ach[a.id] && a.progress(p, last) >= a.goal).map((a) => a.id);
}

/** Progress for display: { now, goal, done }. */
export function progressOf(p: Profile, a: Achievement) {
  const done = !!p.ach[a.id];
  return { now: done ? a.goal : Math.min(a.goal, a.progress(p)), goal: a.goal, done };
}

export const xpForLevel = (level: number) => 50 * level * (level - 1); // cumulative XP to reach `level`
export const levelFromXp = (xp: number) => Math.floor(0.5 + Math.sqrt(0.25 + xp / 50));
export function levelProgress(xp: number) {
  const lvl = levelFromXp(xp);
  const base = xpForLevel(lvl), next = xpForLevel(lvl + 1);
  return { level: lvl, into: xp - base, needed: next - base, ratio: (xp - base) / (next - base) };
}

/** Elo, K = 32. */
export function eloDelta(me: number, opp: number, won: boolean): number {
  const expected = 1 / (1 + Math.pow(10, (opp - me) / 400));
  return Math.round(32 * ((won ? 1 : 0) - expected));
}
export const xpForGame = (won: boolean) => 25 + (won ? 35 : 0);
export const DEFAULT_RATING = 1000;

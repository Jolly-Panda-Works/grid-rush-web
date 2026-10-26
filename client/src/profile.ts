import { DEFAULT_RATING, levelFromXp } from '../../shared/src';

/** Lifetime statistics shown on the profile (all counted on this device). */
export interface Stats {
  games: number; streak: number; bestStreak: number;
  bestScore: number | null; totalScore: number; scoredGames: number; // games that recorded a score (older saves have none)
  bonus7: number; fullBoards: number; tiles: number; treasures: number; treasureCoins: number; rewards: number;
  botMasterWins: number;
}
export interface Profile {
  name: string; xp: number; rating: number; wins: number; losses: number;
  museumSeen?: number; // museum votes already turned into XP
  avatar: number;      // index into AVATARS
  stats: Stats;
  ach: Record<string, number>; // achievement id -> unlock time
}
/** sound = master switch (the in-game menu toggles it); soundVol / musicVol = the two sliders, 0..1 */
export interface Settings { reduceMotion: boolean; sound: boolean; lang: 'en' | 'fa'; soundVol: number; musicVol: number; vibration: boolean; notifications: boolean }

const PK = 'gridrush.profile.v1';
const SK = 'gridrush.settings.v1';

export const emptyStats = (): Stats => ({
  games: 0, streak: 0, bestStreak: 0, bestScore: null, totalScore: 0, scoredGames: 0,
  bonus7: 0, fullBoards: 0, tiles: 0, treasures: 0, treasureCoins: 0, rewards: 0, botMasterWins: 0,
});

export function loadProfile(): Profile {
  try {
    const p = JSON.parse(localStorage.getItem(PK) || 'null');
    if (p && typeof p.name === 'string') {
      const wins = p.wins | 0, losses = p.losses | 0;
      // older saves have no stats yet: start them from the win / loss record
      const stats: Stats = { ...emptyStats(), games: wins + losses, ...(p.stats ?? {}) };
      return {
        name: p.name, xp: p.xp | 0, rating: p.rating | 0 || DEFAULT_RATING, wins, losses, museumSeen: p.museumSeen | 0,
        avatar: Number.isInteger(p.avatar) ? p.avatar : 0, stats, ach: p.ach && typeof p.ach === 'object' ? p.ach : {},
      };
    }
  } catch { /* ignore */ }
  return { name: 'Player' + Math.floor(100 + Math.random() * 900), xp: 0, rating: DEFAULT_RATING, wins: 0, losses: 0, avatar: 24 + Math.floor(Math.random() * 10), stats: emptyStats(), ach: {} };
}
export function saveProfile(p: Profile) { try { localStorage.setItem(PK, JSON.stringify(p)); } catch { /* ignore */ } }
export const profileLevel = (p: Profile) => levelFromXp(p.xp);

const defaultLang = (): 'en' | 'fa' => (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fa') ? 'fa' : 'en');

export function loadSettings(): Settings {
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  try {
    const s = JSON.parse(localStorage.getItem(SK) || 'null');
    const vol = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d);
    if (s) return { reduceMotion: !!s.reduceMotion, sound: s.sound !== false, lang: s.lang === 'fa' || s.lang === 'en' ? s.lang : defaultLang(), soundVol: vol(s.soundVol, 0.8), musicVol: vol(s.musicVol, 0.5), vibration: s.vibration !== false, notifications: s.notifications !== false };
  } catch { /* ignore */ }
  return { reduceMotion: reduced, sound: true, lang: defaultLang(), soundVol: 0.8, musicVol: 0.5, vibration: true, notifications: true };
}
export function saveSettings(s: Settings) { try { localStorage.setItem(SK, JSON.stringify(s)); } catch { /* ignore */ } }

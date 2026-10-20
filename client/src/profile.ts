import { DEFAULT_RATING, levelFromXp } from '../../shared/src';

export interface Profile { name: string; xp: number; rating: number; wins: number; losses: number }
export interface Settings { reduceMotion: boolean; sound: boolean; lang: 'en' | 'fa' }

const PK = 'gridrush.profile.v1';
const SK = 'gridrush.settings.v1';

export function loadProfile(): Profile {
  try {
    const p = JSON.parse(localStorage.getItem(PK) || 'null');
    if (p && typeof p.name === 'string') return { name: p.name, xp: p.xp | 0, rating: p.rating | 0 || DEFAULT_RATING, wins: p.wins | 0, losses: p.losses | 0 };
  } catch { /* ignore */ }
  return { name: 'Player' + Math.floor(100 + Math.random() * 900), xp: 0, rating: DEFAULT_RATING, wins: 0, losses: 0 };
}
export function saveProfile(p: Profile) { try { localStorage.setItem(PK, JSON.stringify(p)); } catch { /* ignore */ } }
export const profileLevel = (p: Profile) => levelFromXp(p.xp);

const defaultLang = (): 'en' | 'fa' => (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fa') ? 'fa' : 'en');

export function loadSettings(): Settings {
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  try {
    const s = JSON.parse(localStorage.getItem(SK) || 'null');
    if (s) return { reduceMotion: !!s.reduceMotion, sound: s.sound !== false, lang: s.lang === 'fa' || s.lang === 'en' ? s.lang : defaultLang() };
  } catch { /* ignore */ }
  return { reduceMotion: reduced, sound: true, lang: defaultLang() };
}
export function saveSettings(s: Settings) { try { localStorage.setItem(SK, JSON.stringify(s)); } catch { /* ignore */ } }

/**
 * Painted Persian art (public/art, cut from the ui-kit-premium atlases by tools/slice-ui-art.py).
 * Paths honour Vite's base so the hosted web zip works in any folder.
 */
const BASE = `${import.meta.env.BASE_URL}art/`;

export type IconId = 'treasure' | 'firouzeh' | 'coins' | 'hourglass' | 'achievement' | 'crown' | 'lock' | 'gift' | 'museum'
  | 'trophy' | 'quests' | 'calendar' | 'pawn-azure' | 'pawn-coral' | 'settings' | 'heart'
  | 'ach-first_win' | 'ach-wins_10' | 'ach-wins_50' | 'ach-games_25' | 'ach-streak_3' | 'ach-bonus7' | 'ach-full_board' | 'ach-score_15'
  | 'ach-rich' | 'ach-treasure_5' | 'ach-tiles_100' | 'ach-beat_master' | 'ach-museum' | 'rank-gold' | 'rank-silver' | 'rank-bronze'
  | 'play' | 'match' | 'friends' | 'add-friend' | 'menu' | 'sound-on' | 'sound-off' | 'motion' | 'resign' | 'close' | 'confirm' | 'edit'
  | 'copy' | 'back' | 'language' | 'tip' | 'buy-tile' | 'advance' | 'turns' | 'finish' | 'scales' | 'rotate-left' | 'rotate-right'
  | 'flip' | 'bot' | 'heart-empty' | 'empty-cell' | 'engraved-coin';
export type FrameId = 'primary' | 'secondary' | 'danger' | 'modal' | 'hero' | 'offer' | 'victory' | 'ribbon' | 'defeat'
  | 'avatar-frame' | 'xp' | 'board-frame' | 'lbar-frame' | 'lbar-track' | 'lbar-fill' | 'primary-bar' | 'modal-plain' | 'modal-orn' | 'ribbon-plain' | 'ribbon-orn' | 'victory-plain' | 'victory-orn' | 'defeat-plain' | 'defeat-orn';

/** 12 tile motifs, each on a lapis (1) and a cream (2) ground. */
export const ART_TILE_COUNT = 24;
export const AVATAR_COUNT = 24;

export const iconUrl = (id: IconId) => `${BASE}icons/${id}.webp`;
export const frameUrl = (id: FrameId) => `${BASE}frames/${id}.webp`;
export const tileUrl = (n: number) => `${BASE}tiles/tile-${(n >> 1) + 1}-${(n & 1) + 1}.webp`;
export const avatarArtUrl = (n: number) => `${BASE}avatars/avatar-${n + 1}.webp`;
export const wordmarkUrl = (lang: 'fa' | 'en') => `${BASE}wordmark-${lang}.webp`;
/** Full-screen art with the Persian name painted in (splash, loading). */
export const screenArtUrl = (id: 'splash-fa' | 'loading-bg') => `${BASE}screens/${id}.webp`;

/** The 1x1 tile the page background is tiled with: the lapis girih knot. */
const BG_TILE = 2;
/** The frames the stylesheet paints buttons, dialogs and ribbons with (and the background tile), as CSS variables (--art-<id>), so their
 *  paths follow Vite's base like every other asset. */
export function installArtVars() {
  const ids: FrameId[] = ['primary-bar', 'secondary', 'danger', 'modal-plain', 'modal-orn', 'ribbon-plain', 'ribbon-orn', 'victory-plain', 'victory-orn', 'defeat-plain', 'defeat-orn'];
  for (const id of ids) document.documentElement.style.setProperty(`--art-${id}`, `url("${frameUrl(id)}")`);
  document.documentElement.style.setProperty('--art-bg-tile', `url("${tileUrl(BG_TILE)}")`);
  document.documentElement.style.setProperty('--art-icon-close', `url("${iconUrl('close')}")`);
  document.documentElement.style.setProperty('--art-icon-level', `url("${iconUrl('achievement')}")`);
  document.documentElement.style.setProperty('--art-icon-lock', `url("${iconUrl('lock')}")`);
}

/** Decoded tile images: the 3D board paints them into textures, which needs them loaded up front. */
export const tileImages: (HTMLImageElement | undefined)[] = [];
let preload: Promise<void> | null = null;
export function preloadArt(): Promise<void> {
  preload ??= Promise.all(
    Array.from({ length: ART_TILE_COUNT }, (_, n) => new Promise<void>((done) => {
      const img = new Image();
      img.onload = () => { tileImages[n] = img; done(); };
      img.onerror = () => done(); // the procedural tile is used instead
      img.src = tileUrl(n);
    })),
  ).then(() => undefined);
  return preload;
}

/** A painted icon as an <img>, sized in CSS px. */
export function Icon({ id, size = 24, className }: { id: IconId; size?: number; className?: string }) {
  return <img className={'aicon' + (className ? ' ' + className : '')} src={iconUrl(id)} width={size} height={size} alt="" draggable={false} />;
}

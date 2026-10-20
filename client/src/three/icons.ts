import * as THREE from 'three';

/** Single source of truth for the track symbols: used by the 3D track cells AND the DOM legend. */
export type IconKind = 'chest' | 'reward' | 'flag' | 'coin';

const checker = Array.from({ length: 12 }, (_, i) => {
  const r = Math.floor(i / 4), c = i % 4;
  return `<rect x="${18 + c * 8}" y="${10 + r * 8}" width="8" height="8" fill="${(r + c) % 2 ? '#1b1f3a' : '#ffffff'}"/>`;
}).join('');

export const ICON_SVG: Record<IconKind, string> = {
  chest: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="25" cy="15" r="7" fill="#FFC93C" stroke="#C98A00" stroke-width="2"/><circle cx="39" cy="12" r="7" fill="#FFC93C" stroke="#C98A00" stroke-width="2"/><rect x="8" y="28" width="48" height="28" rx="5" fill="#8A4B14"/><path d="M8 30Q8 17 32 17Q56 17 56 30Z" fill="#B8651B"/><rect x="8" y="28" width="48" height="5" fill="#FFB400"/><rect x="16" y="18" width="5" height="38" fill="#FFB400" opacity=".9"/><rect x="43" y="18" width="5" height="38" fill="#FFB400" opacity=".9"/><rect x="27" y="29" width="10" height="13" rx="2.5" fill="#FFD34D" stroke="#7a4a00" stroke-width="2"/><circle cx="32" cy="35" r="2" fill="#7a4a00"/></svg>`,
  reward: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="10" fill="#27B67A" stroke="#168a58" stroke-width="4"/><rect x="12" y="12" width="40" height="18" rx="6" fill="#fff" opacity=".22"/><text x="32" y="40" font-family="Arial, sans-serif" font-weight="800" font-size="21" text-anchor="middle" fill="#fff">1×1</text></svg>`,
  flag: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="12" y="6" width="4.5" height="52" rx="2" fill="#3b3f63"/>${checker}<rect x="18" y="10" width="32" height="24" fill="none" stroke="#1b1f3a" stroke-width="2"/></svg>`,
  coin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="9" fill="#17A8F0" stroke="#0b6fa8" stroke-width="3"/><circle cx="32" cy="32" r="15" fill="#FFC93C" stroke="#C98A00" stroke-width="3.5"/><circle cx="32" cy="32" r="8" fill="none" stroke="#C98A00" stroke-width="2.5"/></svg>`,
};
export const iconUrl = (k: IconKind) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ICON_SVG[k])}`;

const imgs = new Map<IconKind, Promise<HTMLImageElement>>();
function loadIcon(k: IconKind) {
  let p = imgs.get(k);
  if (!p) { p = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = iconUrl(k); }); imgs.set(k, p); }
  return p;
}

const texCache = new Map<string, THREE.CanvasTexture>();
/** Texture for a track cell: optional icon + its index number in the corner. */
export function cellTexture(kind: IconKind | null, num: number): THREE.CanvasTexture {
  const key = `${kind ?? '-'}:${num}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d')!;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  ctx.font = '700 30px Inter, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(19,34,79,.78)';
  ctx.fillText(String(num), 120, 120);
  if (kind) loadIcon(kind).then((im) => { ctx.drawImage(im, 18, 4, 92, 92); tex.needsUpdate = true; }).catch(() => {});
  texCache.set(key, tex);
  return tex;
}
/** Small text label texture (used for the "1x1" mark on reward tiles). */
export function textTexture(text: string, color = '#ffffff'): THREE.CanvasTexture {
  const key = `t:${text}:${color}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d')!;
  ctx.font = '800 54px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  ctx.fillText(text, 64, 68);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

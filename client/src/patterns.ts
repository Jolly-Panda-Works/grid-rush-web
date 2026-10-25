import * as THREE from 'three';
import { C } from './three/colors';

/**
 * Patchwork-style "fabric" for every tile piece (cosmetic only, no game rule depends on it).
 * Each pattern tiles seamlessly with a period of exactly one board cell, so a piece reads as one continuous patch
 * and a finished board reads as a quilt / tile-work picture (shown in the museum).
 * The look is derived from the tile uid, so both players (and the museum) see the same fabric.
 */
export const PATTERNS = ['stripes', 'dots', 'gingham', 'plaid', 'chevron', 'star', 'waves', 'diamond', 'flower', 'cross', 'scales', 'girih'] as const;
export type Pattern = (typeof PATTERNS)[number] | 'solid';

const FABRIC = [C.turquoise, C.saffron, C.emerald, C.terracotta, C.rose, C.plum, C.azure, '#8DCB4C', C.lapis, '#E98A2E'];

export interface TileLook { color: string; accent: string; pattern: Pattern }

const hash = (n: number) => { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; return h ^ (h >>> 13); };

export function tileLook(uid: number, shape: string): TileLook {
  if (shape === 'mono') return { color: C.emerald, accent: '#BDEBD2', pattern: 'solid' };
  const h = hash(uid);
  const color = FABRIC[h % FABRIC.length];
  const pattern = PATTERNS[(h >>> 8) % PATTERNS.length];
  const base = new THREE.Color(color);
  // light accent on dark fabric, dark accent on light fabric
  const accent = base.getHSL({ h: 0, s: 0, l: 0 }).l > 0.55 ? base.clone().offsetHSL(0, 0, -0.28) : base.clone().lerp(new THREE.Color(C.cream), 0.62);
  return { color, accent: '#' + accent.getHexString(), pattern };
}

function draw(ctx: CanvasRenderingContext2D, s: number, p: Pattern, color: string, accent: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = accent; ctx.strokeStyle = accent;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const line = (w: number) => { ctx.lineWidth = w; };
  switch (p) {
    case 'solid':
      line(s * 0.06); ctx.strokeRect(s * 0.14, s * 0.14, s * 0.72, s * 0.72); break;
    case 'stripes':
      line(s * 0.09);
      for (let k = -4; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(k * s / 4, s); ctx.lineTo(k * s / 4 + s, 0); ctx.stroke(); }
      break;
    case 'dots':
      for (const [x, y] of [[0.25, 0.25], [0.75, 0.75], [0.75, 0.25], [0.25, 0.75]]) { ctx.beginPath(); ctx.arc(x * s, y * s, s * 0.09, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'gingham':
      ctx.globalAlpha = 0.55; ctx.fillRect(0, 0, s, s / 4); ctx.fillRect(0, s / 2, s, s / 4); ctx.fillRect(0, 0, s / 4, s); ctx.fillRect(s / 2, 0, s / 4, s);
      ctx.globalAlpha = 1; break;
    case 'plaid':
      ctx.globalAlpha = 0.45; ctx.fillRect(0, s * 0.35, s, s * 0.3); ctx.fillRect(s * 0.35, 0, s * 0.3, s); ctx.globalAlpha = 1;
      line(s * 0.03);
      for (const t of [0.1, 0.9]) { ctx.beginPath(); ctx.moveTo(0, t * s); ctx.lineTo(s, t * s); ctx.moveTo(t * s, 0); ctx.lineTo(t * s, s); ctx.stroke(); }
      break;
    case 'chevron':
      line(s * 0.08);
      for (const y of [0.2, 0.53, 0.86]) {
        ctx.beginPath(); ctx.moveTo(0, y * s);
        for (let i = 1; i <= 4; i++) ctx.lineTo(i * s / 4, (y + (i % 2 ? -0.13 : 0)) * s);
        ctx.stroke();
      }
      break;
    case 'star': {
      ctx.save(); ctx.translate(s / 2, s / 2);
      for (const r of [0, Math.PI / 4]) { ctx.save(); ctx.rotate(r); ctx.fillRect(-s * 0.2, -s * 0.2, s * 0.4, s * 0.4); ctx.restore(); }
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, s * 0.09, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = accent;
      for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s]]) { ctx.beginPath(); ctx.arc(x, y, s * 0.08, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'waves':
      line(s * 0.07);
      for (const y of [0.25, 0.75]) {
        ctx.beginPath();
        for (let x = 0; x <= s; x += 2) { const yy = y * s + Math.sin((x / s) * Math.PI * 2) * s * 0.09; if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
        ctx.stroke();
      }
      break;
    case 'diamond':
      ctx.beginPath(); ctx.moveTo(s / 2, s * 0.06); ctx.lineTo(s * 0.94, s / 2); ctx.lineTo(s / 2, s * 0.94); ctx.lineTo(s * 0.06, s / 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(s / 2, s * 0.3); ctx.lineTo(s * 0.7, s / 2); ctx.lineTo(s / 2, s * 0.7); ctx.lineTo(s * 0.3, s / 2); ctx.closePath(); ctx.fill();
      break;
    case 'flower':
      ctx.save(); ctx.translate(s / 2, s / 2);
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.ellipse(0, -s * 0.17, s * 0.09, s * 0.16, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#FFD34D'; ctx.beginPath(); ctx.arc(0, 0, s * 0.07, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = accent;
      for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s]]) { ctx.beginPath(); ctx.arc(x, y, s * 0.06, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'cross':
      for (const [x, y] of [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1]]) {
        ctx.fillRect(x * s - s * 0.05, y * s - s * 0.17, s * 0.1, s * 0.34); ctx.fillRect(x * s - s * 0.17, y * s - s * 0.05, s * 0.34, s * 0.1);
      }
      break;
    case 'scales':
      line(s * 0.06);
      for (const [x, y] of [[0, 0.5], [0.5, 0.5], [1, 0.5], [0.25, 1], [0.75, 1], [0.25, 0], [0.75, 0]]) { ctx.beginPath(); ctx.arc(x * s, y * s, s * 0.25, 0, Math.PI); ctx.stroke(); }
      break;
    case 'girih':
      // interlaced lattice, a nod to Persian girih tile-work
      line(s * 0.06);
      ctx.beginPath();
      ctx.moveTo(0, s * 0.3); ctx.lineTo(s * 0.3, 0); ctx.moveTo(s * 0.7, 0); ctx.lineTo(s, s * 0.3);
      ctx.moveTo(s, s * 0.7); ctx.lineTo(s * 0.7, s); ctx.moveTo(s * 0.3, s); ctx.lineTo(0, s * 0.7);
      ctx.moveTo(s / 2, s * 0.2); ctx.lineTo(s * 0.8, s / 2); ctx.lineTo(s / 2, s * 0.8); ctx.lineTo(s * 0.2, s / 2); ctx.closePath();
      ctx.stroke();
      break;
  }
}

const canvases = new Map<string, HTMLCanvasElement>();
function canvasFor(look: TileLook): HTMLCanvasElement {
  const key = `${look.pattern}:${look.color}:${look.accent}`;
  let cv = canvases.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    draw(cv.getContext('2d')!, 128, look.pattern, look.color, look.accent);
    canvases.set(key, cv);
  }
  return cv;
}

const textures = new Map<HTMLCanvasElement, THREE.CanvasTexture>();
/** Texture for one cell of a 3D tile. */
export function patternTexture(look: TileLook): THREE.CanvasTexture {
  const cv = canvasFor(look);
  let tex = textures.get(cv);
  if (!tex) { tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; textures.set(cv, tex); }
  return tex;
}

const urls = new Map<HTMLCanvasElement, string>();
/** Image URL of one cell of fabric (for SVG / DOM). */
export function patternUrl(look: TileLook): string {
  const cv = canvasFor(look);
  let u = urls.get(cv);
  if (!u) { u = cv.toDataURL(); urls.set(cv, u); }
  return u;
}

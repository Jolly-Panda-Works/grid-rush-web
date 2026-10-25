import * as THREE from 'three';
import { ART_TILE_COUNT, tileImages, tileUrl } from './art';

/**
 * Painted Persian tiles (kashi): every board cell is one complete square glazed tile with its own centred design,
 * like haft-rang floral tiles, rosette medallions, petal mandalas and arabesque scrollwork, with dark outlines.
 * A piece is made of matching tiles. Cosmetic only: no rule depends on it.
 * The look is derived from the tile uid, so both players (and the museum) see the same tiles.
 */
export const PATTERNS = ['haftrang', 'rosette', 'mandala', 'arabesque', 'star', 'tulips'] as const;
export type Pattern = (typeof PATTERNS)[number] | 'plain';

/** art = index of the painted tile (public/art/tiles); pattern/color = the procedural fallback and the tile body glaze. */
export interface TileLook { color: string; pattern: Pattern; art?: number }
/** Body glaze under the painted tiles: lapis for the blue-ground tiles, cream for the others. */
const ART_BODY = ['#16307E', '#E6D3A6'];

const hash = (n: number) => { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; return (h ^ (h >>> 13)) >>> 0; }; // unsigned: a negative value would index past the lists

export function tileLook(uid: number, shape: string): TileLook {
  if (shape === 'mono') return { color: '#27B67A', pattern: 'plain' };
  const h = hash(uid);
  const pattern = PATTERNS[h % PATTERNS.length];
  const art = (h >>> 4) % ART_TILE_COUNT;
  return { color: ART_BODY[art & 1], pattern, art };
}

const INK = '#1b1b2a'; // dark outline of every painted shape
const C7 = { red: '#D8322E', pink: '#E86CA5', magenta: '#B0307A', orange: '#F28A1E', yellow: '#F5C531', green: '#4E9A3A', lime: '#A7C93A', blue: '#2F6DB5', sky: '#7EC8E8', turq: '#1BA3B8', white: '#FBF7EC', purple: '#7A4BA8', brown: '#B8641E' };

/** n-point star polygon centred at (cx, cy). */
function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, n: number, ro: number, ri: number, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro, a = rot + (i * Math.PI) / n;
    if (i) ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); else ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
}

let LW = 2; // outline width (scaled to the canvas)
/** Fill + dark outline, the cuerda-seca look. */
function paint(ctx: CanvasRenderingContext2D, fill: string, width = LW) {
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = width; ctx.strokeStyle = INK; ctx.stroke();
}
/** A pointed petal / leaf from (cx,cy) outwards along angle a. */
function petal(ctx: CanvasRenderingContext2D, cx: number, cy: number, a: number, r0: number, r1: number, w: number) {
  const ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
  const x0 = cx + ca * r0, y0 = cy + sa * r0, x1 = cx + ca * r1, y1 = cy + sa * r1, xm = cx + ca * (r0 + r1) / 2, ym = cy + sa * (r0 + r1) / 2;
  ctx.beginPath(); ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(xm + px * w, ym + py * w, x1, y1);
  ctx.quadraticCurveTo(xm - px * w, ym - py * w, x0, y0); ctx.closePath();
}
/** Rounded petal (wider tip), used for daisies and mandala rings. */
function roundPetal(ctx: CanvasRenderingContext2D, cx: number, cy: number, a: number, r0: number, r1: number, w: number) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(r0, 0);
  ctx.bezierCurveTo(r0 + (r1 - r0) * 0.3, -w, r1, -w, r1, 0);
  ctx.bezierCurveTo(r1, w, r0 + (r1 - r0) * 0.3, w, r0, 0); ctx.closePath();
  ctx.restore();
}
/** Heart-shaped (lily) petal pointing outwards, like on rosette medallions. */
function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, a: number, r: number, size: number) {
  ctx.save(); ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.rotate(a + Math.PI / 2);
  const k = size;
  ctx.beginPath(); ctx.moveTo(0, -k);
  ctx.bezierCurveTo(k * 0.5, -k * 0.6, k * 1.1, -k * 0.1, k * 0.7, k * 0.55);
  ctx.bezierCurveTo(k * 0.4, k * 0.95, k * 0.05, k * 0.7, 0, k * 0.45);
  ctx.bezierCurveTo(-k * 0.05, k * 0.7, -k * 0.4, k * 0.95, -k * 0.7, k * 0.55);
  ctx.bezierCurveTo(-k * 1.1, -k * 0.1, -k * 0.5, -k * 0.6, 0, -k); ctx.closePath();
  ctx.restore();
}
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, outline = true) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (outline) paint(ctx, fill); else { ctx.fillStyle = fill; ctx.fill(); }
}
/** A multi-layer flower (haft-rang style): outer petals, inner petals, seeded centre. */
function flower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, n: number, outer: string, inner: string, rot = 0) {
  for (let i = 0; i < n; i++) { roundPetal(ctx, x, y, rot + (i * 2 * Math.PI) / n, r * 0.25, r, r * 0.36); paint(ctx, outer); }
  for (let i = 0; i < n; i++) { petal(ctx, x, y, rot + ((i + 0.5) * 2 * Math.PI) / n, r * 0.15, r * 0.66, r * 0.2); paint(ctx, inner); }
  dot(ctx, x, y, r * 0.24, C7.yellow);
  dot(ctx, x, y, r * 0.1, C7.red, false);
}
/** Spiral curl for arabesque scrollwork. */
function curl(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a0: number, dir: 1 | -1) {
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, a = a0 + dir * t * Math.PI * 2.2, rr = r * (1 - t * 0.8);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.stroke();
}

function draw(ctx: CanvasRenderingContext2D, s: number, look: TileLook) {
  const h = s / 2, TAU = Math.PI * 2;
  LW = s / 110;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.fillStyle = look.color; ctx.fillRect(0, 0, s, s);
  switch (look.pattern) {
    case 'plain': // the 1x1 reward tile
      star(ctx, h, h, 8, s * 0.34, s * 0.2); paint(ctx, C7.white);
      dot(ctx, h, h, s * 0.12, C7.yellow);
      break;

    case 'haftrang': { // seven-colour floral: branches to the corners, leaves, a big blossom in the middle
      ctx.strokeStyle = C7.brown; ctx.lineWidth = s * 0.018;
      for (const [cx, cy] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) { ctx.beginPath(); ctx.moveTo(h, h); ctx.quadraticCurveTo(h, cy * s, cx * s, cy * s); ctx.stroke(); }
      const leafCols = [C7.green, C7.orange, C7.lime, C7.red];
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        petal(ctx, h, h, a - 0.35, s * 0.2, s * 0.46, s * 0.07); paint(ctx, leafCols[i]);
        petal(ctx, h, h, a + 0.35, s * 0.2, s * 0.44, s * 0.06); paint(ctx, leafCols[(i + 2) % 4]);
      }
      for (const [cx, cy, c] of [[0.13, 0.13, C7.purple], [0.87, 0.13, C7.sky], [0.13, 0.87, C7.sky], [0.87, 0.87, C7.purple]] as [number, number, string][]) flower(ctx, cx * s, cy * s, s * 0.11, 6, c, C7.white);
      flower(ctx, h, h, s * 0.27, 8, C7.pink, C7.red, Math.PI / 8);
      break;
    }

    case 'rosette': { // circular medallion of lily petals
      dot(ctx, h, h, s * 0.46, C7.white);
      for (let i = 0; i < 8; i++) { const a = (i + 0.5) * TAU / 8; petal(ctx, h, h, a, s * 0.33, s * 0.455, s * 0.06); paint(ctx, i % 2 ? C7.turq : C7.blue); }
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8; heart(ctx, h, h, a, s * 0.33, s * 0.1); paint(ctx, C7.red); heart(ctx, h, h, a, s * 0.335, s * 0.045); paint(ctx, C7.white, LW * 0.7); }
      for (let i = 0; i < 8; i++) { const a = (i + 0.5) * TAU / 8; heart(ctx, h, h, a, s * 0.2, s * 0.075); paint(ctx, C7.green); }
      star(ctx, h, h, 8, s * 0.13, s * 0.08); paint(ctx, C7.blue);
      flower(ctx, h, h, s * 0.075, 8, C7.yellow, C7.orange);
      break;
    }

    case 'mandala': { // concentric rings of petals
      for (let i = 0; i < 16; i++) { roundPetal(ctx, h, h, i * TAU / 16, s * 0.25, s * 0.47, s * 0.075); paint(ctx, i % 2 ? C7.orange : C7.yellow); }
      for (let i = 0; i < 12; i++) { roundPetal(ctx, h, h, (i + 0.5) * TAU / 12, s * 0.12, s * 0.3, s * 0.07); paint(ctx, C7.magenta); }
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12; dot(ctx, h + Math.cos(a) * s * 0.2, h + Math.sin(a) * s * 0.2, s * 0.022, C7.yellow, false); }
      for (let i = 0; i < 8; i++) { petal(ctx, h, h, i * TAU / 8, s * 0.03, s * 0.14, s * 0.045); paint(ctx, C7.green); }
      dot(ctx, h, h, s * 0.045, C7.white);
      break;
    }

    case 'arabesque': { // white scrollwork, blue leaves, lily buds in the corners, a pink flower in the middle
      ctx.strokeStyle = C7.white; ctx.lineWidth = s * 0.022;
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
        ctx.beginPath(); ctx.moveTo(h + ca * s * 0.14, h + sa * s * 0.14); ctx.lineTo(h + ca * s * 0.5, h + sa * s * 0.5); ctx.stroke();
        curl(ctx, h + Math.cos(a - 0.62) * s * 0.3, h + Math.sin(a - 0.62) * s * 0.3, s * 0.09, a + Math.PI, 1);
        curl(ctx, h + Math.cos(a + 0.62) * s * 0.3, h + Math.sin(a + 0.62) * s * 0.3, s * 0.09, a + Math.PI, -1);
        petal(ctx, h, h, a - 0.22, s * 0.2, s * 0.33, s * 0.035); paint(ctx, C7.sky, LW * 0.7);
        petal(ctx, h, h, a + 0.22, s * 0.2, s * 0.33, s * 0.035); paint(ctx, C7.sky, LW * 0.7);
        const bx = h + ca * s * 0.42, by = h + sa * s * 0.42; // corner lily bud
        petal(ctx, bx, by, a, 0, s * 0.09, s * 0.035); paint(ctx, C7.white, LW * 0.7);
        petal(ctx, bx, by, a - 0.55, 0, s * 0.08, s * 0.03); paint(ctx, C7.orange, LW * 0.7);
        petal(ctx, bx, by, a + 0.55, 0, s * 0.08, s * 0.03); paint(ctx, C7.orange, LW * 0.7);
      }
      for (let i = 0; i < 8; i++) { roundPetal(ctx, h, h, i * TAU / 8, s * 0.04, s * 0.15, s * 0.05); paint(ctx, '#F4B6C2'); }
      dot(ctx, h, h, s * 0.05, C7.orange);
      break;
    }

    case 'star': { // girih star medallion
      for (const [cx, cy] of [[0, 0], [s, 0], [0, s], [s, s]]) { for (let i = 0; i < 4; i++) { roundPetal(ctx, cx, cy, i * TAU / 4 + Math.PI / 4, 0, s * 0.17, s * 0.05); paint(ctx, C7.turq); } }
      star(ctx, h, h, 8, s * 0.44, s * 0.3); paint(ctx, C7.white);
      star(ctx, h, h, 8, s * 0.31, s * 0.2); paint(ctx, C7.turq);
      for (let i = 0; i < 8; i++) { petal(ctx, h, h, i * TAU / 8 - Math.PI / 2, s * 0.1, s * 0.26, s * 0.045); paint(ctx, C7.yellow); }
      flower(ctx, h, h, s * 0.11, 6, C7.red, C7.pink);
      break;
    }

    case 'tulips': { // four tulips around a rosette
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
        ctx.strokeStyle = C7.green; ctx.lineWidth = s * 0.02;
        ctx.beginPath(); ctx.moveTo(h + ca * s * 0.12, h + sa * s * 0.12); ctx.lineTo(h + ca * s * 0.3, h + sa * s * 0.3); ctx.stroke();
        petal(ctx, h, h, a - 0.5, s * 0.14, s * 0.36, s * 0.05); paint(ctx, C7.green);
        petal(ctx, h, h, a + 0.5, s * 0.14, s * 0.36, s * 0.05); paint(ctx, C7.lime);
        const tx = h + ca * s * 0.37, ty = h + sa * s * 0.37;
        petal(ctx, tx, ty, a - 0.35, -s * 0.02, s * 0.11, s * 0.05); paint(ctx, C7.red);
        petal(ctx, tx, ty, a + 0.35, -s * 0.02, s * 0.11, s * 0.05); paint(ctx, C7.red);
        petal(ctx, tx, ty, a, -s * 0.05, s * 0.12, s * 0.045); paint(ctx, C7.orange);
      }
      for (const [cx, cy] of [[0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]]) { star(ctx, cx * s, cy * s, 4, s * 0.07, s * 0.03, 0); paint(ctx, C7.blue, LW * 0.7); }
      flower(ctx, h, h, s * 0.14, 8, C7.blue, C7.sky);
      break;
    }
  }
  // edge of the fired tile + glaze highlight
  ctx.lineWidth = s * 0.02; ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.strokeRect(s * 0.01, s * 0.01, s * 0.98, s * 0.98);
  const g = ctx.createLinearGradient(0, 0, s, s);
  g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(0.35, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.12)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
}

const canvases = new Map<string, HTMLCanvasElement>();
function canvasFor(look: TileLook): HTMLCanvasElement {
  const img = look.art !== undefined ? tileImages[look.art] : undefined;
  const key = img ? `art:${look.art}` : `${look.pattern}:${look.color}`;
  let cv = canvases.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    if (img) cv.getContext('2d')!.drawImage(img, 0, 0, 256, 256);
    else draw(cv.getContext('2d')!, 256, look);
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
/** Image URL of one cell of the motif (for SVG / DOM). */
export function patternUrl(look: TileLook): string {
  if (look.art !== undefined && tileImages[look.art]) return tileUrl(look.art);
  const cv = canvasFor(look);
  let u = urls.get(cv);
  if (!u) { u = cv.toDataURL(); urls.set(cv, u); }
  return u;
}

/** Gold shamseh (8-point star) inlaid in a tile: what the engraved coins look like (instead of round buttons). */
export const SHAMSEH_SVG = (size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-10 -10 20 20"><path d="${starPath(8, 9, 5.2)}" fill="#F2C744" stroke="#8a5a00" stroke-width="1"/><circle r="2.6" fill="#B5533C"/></svg>`;
export function starPath(n: number, ro: number, ri: number): string {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro, a = -Math.PI / 2 + (i * Math.PI) / n;
    d += `${i ? 'L' : 'M'}${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  }
  return d + 'Z';
}

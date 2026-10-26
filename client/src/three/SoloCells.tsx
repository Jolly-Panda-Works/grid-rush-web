import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { BOARD_SIZE, STONE } from '../../../shared/src';
import type { SoloState } from '../../../shared/src';
import { useStore } from '../store';

/**
 * The special cells of a story level, drawn into two textures over the grid: under the tiles the stones, cracks and
 * gold cells (and a soft tint of the region), over the tiles the gold frame of the region.
 * Art from client/public/story/cells/*.webp is used when it is there; otherwise the cells are drawn here.
 */
const PX = 96;
const ART = ['stone', 'crack', 'gold'] as const;
type ArtId = (typeof ART)[number];
const images: Partial<Record<ArtId, HTMLImageElement>> = {};
let artVersion = 0;
const listeners = new Set<() => void>();
for (const id of ART) {
  const img = new Image();
  img.onload = () => { images[id] = img; artVersion++; listeners.forEach((f) => f()); };
  img.src = `${import.meta.env.BASE_URL}story/cells/${id}.webp`;
}
function useArtVersion() {
  const [v, setV] = useState(artVersion);
  useEffect(() => { const f = () => setV(artVersion); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return v;
}

function drawStone(c: CanvasRenderingContext2D, x: number, y: number) {
  const g = c.createLinearGradient(x, y, x + PX, y + PX);
  g.addColorStop(0, '#A49C8E'); g.addColorStop(1, '#6E665B');
  c.fillStyle = g;
  c.beginPath(); c.roundRect(x + 4, y + 4, PX - 8, PX - 8, 14); c.fill();
  c.strokeStyle = 'rgba(40,32,24,.55)'; c.lineWidth = 3; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.18)';
  c.beginPath(); c.ellipse(x + PX * 0.36, y + PX * 0.32, PX * 0.16, PX * 0.08, -0.5, 0, Math.PI * 2); c.fill();
}
function drawCrack(c: CanvasRenderingContext2D, x: number, y: number) {
  c.fillStyle = '#D9C9A6'; c.fillRect(x + 4, y + 4, PX - 8, PX - 8);
  c.strokeStyle = '#4A3424'; c.lineWidth = 4; c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(x + PX * 0.18, y + PX * 0.1); c.lineTo(x + PX * 0.42, y + PX * 0.38); c.lineTo(x + PX * 0.34, y + PX * 0.58);
  c.lineTo(x + PX * 0.62, y + PX * 0.86); c.moveTo(x + PX * 0.42, y + PX * 0.38); c.lineTo(x + PX * 0.82, y + PX * 0.3);
  c.stroke();
}
function drawGold(c: CanvasRenderingContext2D, x: number, y: number) {
  const g = c.createRadialGradient(x + PX / 2, y + PX / 2, 4, x + PX / 2, y + PX / 2, PX * 0.45);
  g.addColorStop(0, '#FFF0A8'); g.addColorStop(1, '#D9A21A');
  c.fillStyle = 'rgba(245,197,49,.35)'; c.fillRect(x + 4, y + 4, PX - 8, PX - 8);
  c.fillStyle = g;
  c.beginPath(); c.arc(x + PX / 2, y + PX / 2, PX * 0.28, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#8A5A00'; c.lineWidth = 3; c.stroke();
}
const DRAW: Record<ArtId, typeof drawStone> = { stone: drawStone, crack: drawCrack, gold: drawGold };

function cellsTexture(solo: SoloState, board: number[], gold: number[]): THREE.CanvasTexture {
  const n = BOARD_SIZE, cv = document.createElement('canvas');
  cv.width = cv.height = n * PX;
  const c = cv.getContext('2d')!;
  const region = new Set(solo.region);
  for (const i of region) { c.fillStyle = 'rgba(245,197,49,.22)'; c.fillRect((i % n) * PX, Math.floor(i / n) * PX, PX, PX); }
  const put = (id: ArtId, i: number) => {
    const x = (i % n) * PX, y = Math.floor(i / n) * PX;
    const img = images[id];
    if (img) c.drawImage(img, x, y, PX, PX); else DRAW[id](c, x, y);
  };
  board.forEach((v, i) => { if (v === STONE) put('stone', i); });
  solo.crack.forEach((i) => put('crack', i));
  gold.forEach((i) => put('gold', i));
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Gold frame along the outer edge of the region (drawn above the tiles). */
function frameTexture(region: number[]): THREE.CanvasTexture {
  const n = BOARD_SIZE, cv = document.createElement('canvas');
  cv.width = cv.height = n * PX;
  const c = cv.getContext('2d')!;
  const set = new Set(region);
  const has = (r: number, k: number) => r >= 0 && k >= 0 && r < n && k < n && set.has(r * n + k);
  c.lineCap = 'round';
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    c.strokeStyle = '#7A4E00'; c.lineWidth = 13; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = '#FFD45A'; c.lineWidth = 7; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  };
  for (const i of set) {
    const r = Math.floor(i / n), k = i % n, x = k * PX, y = r * PX;
    if (!has(r - 1, k)) edge(x, y, x + PX, y);
    if (!has(r + 1, k)) edge(x, y + PX, x + PX, y + PX);
    if (!has(r, k - 1)) edge(x, y, x, y + PX);
    if (!has(r, k + 1)) edge(x + PX, y, x + PX, y + PX);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function SoloCells({ solo, board }: { solo: SoloState; board: number[] }) {
  const v = useArtVersion();
  const gold = solo.gold.filter((i) => !solo.goldTaken.includes(i));
  const key = `${v}|${gold.join(',')}`;
  const under = useMemo(() => cellsTexture(solo, board, gold), [key, solo.level]); // eslint-disable-line react-hooks/exhaustive-deps
  const over = useMemo(() => (solo.region.length && solo.goals.some((g) => g.type === 'fill_region') ? frameTexture(solo.region) : null), [solo.level]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => under.dispose(), [under]);
  useEffect(() => () => over?.dispose(), [over]);
  const pulse = useStore((s) => s.coach?.focus === 'region');
  return (
    <>
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
        <meshBasicMaterial map={under} transparent depthWrite={false} />
      </mesh>
      {over && (
        <mesh position={[0, 0, 0.64]}>
          <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
          <meshBasicMaterial map={over} transparent depthWrite={false} opacity={pulse ? 1 : 0.9} />
        </mesh>
      )}
    </>
  );
}

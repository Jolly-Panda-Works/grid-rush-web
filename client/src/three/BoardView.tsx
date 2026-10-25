import { memo, useEffect, useMemo, useRef } from 'react';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BOARD_SIZE, Cell, EMPTY_CELL_PENALTY, PlacedTile, SPECIAL_7X7_BONUS, SPECIAL_AREA, Seat, TRACK_LENGTH } from '../../../shared/src';
import { useStore, setSel, rotate } from '../store';
import type { RotAnim } from '../store';
import { confirmPlacement } from '../actions';
import { C, PLAYER_COLORS, UI } from './colors';
import { patternTexture, tileLook } from '../patterns';
import { inBounds, previewFor } from './placement';
import { textTexture } from './icons';
import { dragApi } from './dragApi';
import { vfx } from './vfx';

const CELL_X = (c: number) => c - (BOARD_SIZE - 1) / 2;
const CELL_Y = (r: number) => (BOARD_SIZE - 1) / 2 - r;

/** Gold shamseh medallion inlaid in a tile (one per engraved coin). */
const SHAMSEH = (() => {
  const sh = new THREE.Shape();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? 0.17 : 0.29, a = -Math.PI / 2 + (i * Math.PI) / 8;
    if (i) sh.lineTo(r * Math.cos(a), r * Math.sin(a)); else sh.moveTo(r * Math.cos(a), r * Math.sin(a));
  }
  return new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
})();
const SHAMSEH_MAT = new THREE.MeshStandardMaterial({ color: '#F2C744', metalness: 0.55, roughness: 0.3, emissive: '#6a4a00', emissiveIntensity: 0.25 });

/** Shared materials (one per glaze colour) keep the number of GPU state switches low. */
const bodyMats = new Map<string, THREE.MeshStandardMaterial>();
const bodyMat = (color: string) => { let m = bodyMats.get(color); if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 0.75 }); bodyMats.set(color, m); } return m; };
const topMats = new Map<THREE.Texture, THREE.MeshStandardMaterial>();
const topMat = (map: THREE.Texture) => { let m = topMats.get(map); if (!m) { m = new THREE.MeshStandardMaterial({ map, roughness: 0.28, metalness: 0.05 }); topMats.set(map, m); } return m; };
const MONO_MAT = () => new THREE.MeshBasicMaterial({ map: textTexture('1×1'), transparent: true });

/** One placed piece, merged into a few meshes: the tile bodies (+ the joins between them), the glazed tops, the gold stars. */
const TileMesh = memo(function TileMesh({ tile }: { tile: PlacedTile }) {
  const ref = useRef<THREE.Group>(null);
  const t0 = useRef(performance.now());
  const look = useMemo(() => tileLook(tile.uid, tile.shape), [tile.uid, tile.shape]);
  const cx = tile.cells.reduce((s, c) => s + CELL_X(c[1]), 0) / tile.cells.length;
  const cy = tile.cells.reduce((s, c) => s + CELL_Y(c[0]), 0) / tile.cells.length;
  const geo = useMemo(() => {
    const keys = new Set(tile.cells.map((c) => c.join(',')));
    const body: THREE.BufferGeometry[] = [], tops: THREE.BufferGeometry[] = [], stars: THREE.BufferGeometry[] = [];
    tile.cells.forEach(([r, c], i) => {
      const x = CELL_X(c) - cx, y = CELL_Y(r) - cy;
      body.push(new THREE.BoxGeometry(0.9, 0.9, 0.3).translate(x, y, 0.2));
      if (keys.has(`${r},${c + 1}`)) body.push(new THREE.BoxGeometry(0.14, 0.9, 0.3).translate(x + 0.5, y, 0.2));
      if (keys.has(`${r + 1},${c}`)) body.push(new THREE.BoxGeometry(0.9, 0.14, 0.3).translate(x, y - 0.5, 0.2));
      tops.push(new THREE.PlaneGeometry(0.9, 0.9).translate(x, y, 0.36));
      if (i < tile.engraved) stars.push(SHAMSEH.clone().translate(x, y, 0.37));
    });
    const merged = { body: mergeGeometries(body), tops: mergeGeometries(tops), stars: stars.length ? mergeGeometries(stars) : null };
    [...body, ...tops, ...stars].forEach((g) => g.dispose());
    return merged;
  }, [tile.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { geo.body.dispose(); geo.tops.dispose(); geo.stars?.dispose(); }, [geo]);
  const top = useMemo(() => topMat(patternTexture(look)), [look]);
  const mono = useMemo(() => (tile.shape === 'mono' ? MONO_MAT() : null), [tile.shape]);
  const phase = useRef<'fall' | 'land' | 'rest'>('fall');
  // the tile drops onto the board, squashes on landing (volume-preserving), then settles; dust puffs out on impact
  useFrame(() => {
    const g = ref.current;
    if (!g || phase.current === 'rest') return;
    const reduce = useStore.getState().settings.reduceMotion;
    const t = reduce ? 9 : (performance.now() - t0.current) / 1000;
    const FALL = 0.26;
    if (t < FALL) {
      const k = t / FALL;
      g.position.z = 2.2 * (1 - k * k);
      g.scale.set(1.08, 1.08, 1);
      return;
    }
    if (phase.current === 'fall') {
      phase.current = 'land';
      if (t < 1) { // only for a tile that was just placed (not when a whole board appears at once)
        const w = g.getWorldPosition(new THREE.Vector3()), sc = g.parent?.getWorldScale(new THREE.Vector3()).x ?? 1;
        vfx('dust', w.x, w.y, 0.6, sc);
      }
    }
    const k = Math.min(1, (t - FALL) / 0.22);
    const sq = Math.sin(k * Math.PI) * (1 - k) * 0.5; // squash then spring back
    g.position.z = 0;
    g.scale.set(1 + sq * 0.25, 1 + sq * 0.25, 1 - sq);
    if (k >= 1) { g.scale.set(1, 1, 1); phase.current = 'rest'; }
  });
  return (
    <group ref={ref} position={[cx, cy, 0]}>
      <mesh geometry={geo.body} material={bodyMat(look.color)} />
      <mesh geometry={geo.tops} material={top} />
      {geo.stars && <mesh geometry={geo.stars} material={SHAMSEH_MAT} />}
      {mono && <mesh position={[0, 0, 0.37]} material={mono}><planeGeometry args={[0.8, 0.8]} /></mesh>}
    </group>
  );
}, (a, b) => a.tile.uid === b.tile.uid); // a placed piece never changes

/** The empty grid of a board as one textured plane (instead of 81 meshes). */
let gridTex: THREE.CanvasTexture | null = null;
function gridTexture(): THREE.CanvasTexture {
  if (gridTex) return gridTex;
  const n = BOARD_SIZE, px = 64, cv = document.createElement('canvas');
  cv.width = cv.height = n * px;
  const c = cv.getContext('2d')!;
  c.fillStyle = UI.board; c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = UI.gridLine;
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) c.fillRect(k * px + px * 0.04, r * px + px * 0.04, px * 0.92, px * 0.92);
  gridTex = new THREE.CanvasTexture(cv);
  gridTex.colorSpace = THREE.SRGBColorSpace;
  return gridTex;
}
/** Late game: "-2" on every empty cell, drawn into one texture per board state. */
function penaltyTexture(board: number[]): THREE.CanvasTexture {
  const n = BOARD_SIZE, px = 64, cv = document.createElement('canvas');
  cv.width = cv.height = n * px;
  const c = cv.getContext('2d')!;
  c.font = '800 26px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(192,80,63,.6)';
  board.forEach((v, i) => { if (v === 0) c.fillText(`−${EMPTY_CELL_PENALTY}`, (i % n) * px + px / 2, Math.floor(i / n) * px + px / 2 + 2); });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The 7x7 window of a board with the most filled cells (for the bonus progress outline). */
function best7(board: number[]): { r0: number; c0: number; filled: number } {
  let best = { r0: 1, c0: 1, filled: -1 };
  const span = BOARD_SIZE - SPECIAL_AREA;
  for (let r0 = 0; r0 <= span; r0++) for (let c0 = 0; c0 <= span; c0++) {
    let n = 0;
    for (let r = 0; r < SPECIAL_AREA; r++) for (let c = 0; c < SPECIAL_AREA; c++) if (board[(r0 + r) * BOARD_SIZE + c0 + c] !== 0) n++;
    if (n > best.filled) best = { r0, c0, filled: n };
  }
  return best;
}

/** Dashed outline of the best 7x7 window + "filled/49 · +7" so the bonus goal is visible while you build. */
function Bonus7Outline({ board }: { board: number[] }) {
  const b = useMemo(() => best7(board), [board]);
  const x0 = CELL_X(b.c0) - 0.5, y0 = CELL_Y(b.r0) + 0.5, len = SPECIAL_AREA;
  const visible = b.filled > 0;
  const dashes: [number, number, number, number][] = []; // x, y, w, h
  for (let i = 0; i < len * 2; i++) {
    const t = i * 0.5 + 0.12;
    dashes.push([x0 + t + 0.13, y0, 0.26, 0.07], [x0 + t + 0.13, y0 - len, 0.26, 0.07], [x0, y0 - t - 0.13, 0.07, 0.26], [x0 + len, y0 - t - 0.13, 0.07, 0.26]);
  }
  const label = `${b.filled}/${SPECIAL_AREA * SPECIAL_AREA} · +${SPECIAL_7X7_BONUS}`;
  const key = `${b.r0},${b.c0}`;
  const geo = useMemo(() => mergeGeometries(dashes.map(([x, y, w, h]) => new THREE.PlaneGeometry(w, h).translate(x, y, 0))), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group position={[0, 0, 0.62]} visible={visible}>
      <mesh geometry={geo}><meshBasicMaterial color={C.saffron} transparent opacity={0.95} /></mesh>
      <mesh position={[x0 + 1.15, y0 + 0.02, 0.01]}>
        <planeGeometry args={[2.3, 0.5]} />
        <meshBasicMaterial map={textTexture(label, '#FFB400', 'rgba(0,30,103,.9)')} transparent />
      </mesh>
    </group>
  );
}

/** Wraps the ghost: right after a turn / flip it eases from the old orientation into the new one around the pivot cell. */
function GhostTurn({ anim, offerKey, children }: { anim: RotAnim | null; offerKey: string; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const px = anim ? CELL_X(anim.pivot[1]) : 0, py = anim ? CELL_Y(anim.pivot[0]) : 0;
  useFrame(() => {
    const g = ref.current, n = inner.current;
    if (!g || !n) return;
    const t = anim && !useStore.getState().settings.reduceMotion ? Math.min(1, (performance.now() - anim.t0) / 200) : 1;
    const e = 1 - Math.pow(1 - t, 3), back = 1 - e;
    g.rotation.z = anim?.kind === 'rot' ? back * (Math.PI / 2) : anim?.kind === 'rotBack' ? -back * (Math.PI / 2) : 0; // start from the old orientation
    g.scale.set(anim?.kind === 'flipH' ? 1 - 2 * back : 1, anim?.kind === 'flipV' ? 1 - 2 * back : 1, 1);
    if (anim?.kind === 'set') g.scale.setScalar(0.85 + 0.15 * e);
  });
  void offerKey;
  return (
    <group ref={ref} position={[px, py, 0]}>
      <group ref={inner} position={[-px, -py, 0]}>{children}</group>
    </group>
  );
}

export function BoardView({ seat, x, y, scale }: { seat: Seat; x: number; y: number; scale: number }) {
  const game = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const sel = useStore((s) => s.sel);
  const p = game.players[seat];
  const mine = seat === mySeat;
  const active = game.current === seat && game.phase !== 'finished';
  const interactive = mine && active && (game.phase === 'placing_reward' || sel.offer !== null);
  const intent = useStore((s) => s.oppIntent);
  const rotAnim = useStore((s) => s.rotAnim);
  let preview = interactive ? previewFor(game, seat, sel) : null;
  if (!mine && intent && intent.seat === seat && game.current === seat) {
    const a = intent.action;
    if (a.t === 'buy') preview = { abs: a.cells, valid: true };
    else if (a.t === 'reward') preview = { abs: [[a.r, a.c]], valid: true };
  }
  const frame = PLAYER_COLORS[seat];
  const bonus = p.bonus7;
  const hadBonus = useRef(bonus);
  useEffect(() => { if (bonus && !hadBonus.current) vfx('confetti', x, y, 1.2, scale); hadBonus.current = bonus; }, [bonus, x, y, scale]);
  const ghostTile = !mine && intent?.action.t === 'buy' && intent.seat === seat ? game.offer[intent.action.offer] : mine && sel.offer !== null ? game.offer[sel.offer] : null;
  const ghostTex = useMemo(() => (ghostTile ? patternTexture(tileLook(ghostTile.uid, ghostTile.shape)) : null), [ghostTile]);
  // late game: empty cells show what they will cost
  const lateGame = mine && game.phase !== 'finished' && TRACK_LENGTH - Math.max(game.players[0].pos, game.players[1].pos) <= 8;
  const show7 = mine && game.bonus7By === null && game.phase !== 'finished';
  const boardKey = lateGame ? p.board.join(',') : '';
  const penalty = useMemo(() => (lateGame ? penaltyTexture(p.board) : null), [boardKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => penalty?.dispose(), [penalty]);
  const { camera, gl } = useThree();

  // Used by DOM drag & drop: which cell of MY board is under the pointer (null if far from the board)
  useEffect(() => {
    if (!mine) return;
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.2);
    const rc = new THREE.Raycaster();
    const hit = new THREE.Vector3();
    dragApi.pick = (cx, cy) => {
      const rect = gl.domElement.getBoundingClientRect();
      rc.setFromCamera(new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -(((cy - rect.top) / rect.height) * 2 - 1)), camera);
      if (!rc.ray.intersectPlane(plane, hit)) return null;
      const lx = (hit.x - x) / scale, ly = (hit.y - y) / scale;
      const c = Math.floor(lx + BOARD_SIZE / 2), r = Math.floor(BOARD_SIZE / 2 - ly);
      return r >= -2 && c >= -2 && r < BOARD_SIZE + 2 && c < BOARD_SIZE + 2 ? [r, c] : null;
    };
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    dragApi.cellPx = () => {
      const rect = gl.domElement.getBoundingClientRect();
      a.set(x, y, 0.2).project(camera); b.set(x + scale, y, 0.2).project(camera);
      return (Math.abs(b.x - a.x) / 2) * rect.width;
    };
    const p = new THREE.Vector3();
    dragApi.cellToScreen = (r, c) => {
      const rect = gl.domElement.getBoundingClientRect();
      p.set(x + (c - (BOARD_SIZE - 1) / 2) * scale, y + ((BOARD_SIZE - 1) / 2 - r) * scale, 0.5).project(camera);
      return { x: ((p.x + 1) / 2) * rect.width, y: ((1 - p.y) / 2) * rect.height };
    };
    useStore.setState((s) => ({ sel: { ...s.sel } })); // re-render overlays that depend on the projection
    return () => { dragApi.pick = null; dragApi.cellPx = null; dragApi.cellToScreen = null; };
  }, [mine, camera, gl, x, y, scale]);

  const cellFromEvent = (e: ThreeEvent<PointerEvent>): [number, number] | null => {
    const lp = e.object.worldToLocal(e.point.clone());
    const c = Math.floor(lp.x + BOARD_SIZE / 2), r = Math.floor(BOARD_SIZE / 2 - lp.y);
    return r >= 0 && c >= 0 && r < BOARD_SIZE && c < BOARD_SIZE ? [r, c] : null;
  };
  // Touch: tap the ghost = turn it around that cell; drag = move it (the grabbed cell stays under the finger);
  // tap elsewhere = move it there; the floating ✓ places it. Mouse: the ghost follows the pointer, click places,
  // the wheel or a right-click turns it.
  const gesture = useRef<{ cell: [number, number]; onGhost: boolean; moved: boolean; off: [number, number] } | null>(null);
  const onGhost = (cell: [number, number]) => !!preview?.abs.some(([r, c]) => r === cell[0] && c === cell[1]);
  const canTurn = mine && game.phase === 'playing' && sel.offer !== null;
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    const cell = cellFromEvent(e);
    if (!cell) return;
    const gs = gesture.current;
    if (e.pointerType === 'mouse' && !gs) { if (!sel.hover || sel.hover[0] !== cell[0] || sel.hover[1] !== cell[1]) setSel({ hover: cell }); return; }
    if (!gs || (cell[0] === gs.cell[0] && cell[1] === gs.cell[1] && !gs.moved)) return;
    gs.moved = true;
    const h: [number, number] = [cell[0] + gs.off[0], cell[1] + gs.off[1]];
    if (!sel.hover || sel.hover[0] !== h[0] || sel.hover[1] !== h[1]) setSel({ hover: h });
  };
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    const cell = cellFromEvent(e);
    if (!cell) return;
    if (e.pointerType === 'mouse') {
      if (e.button === 2) return; // right-click turns (onContextMenu)
      setSel({ hover: cell });
      confirmPlacement();
      return;
    }
    const on = onGhost(cell);
    if (!on) setSel({ hover: cell });
    const hv = on && sel.hover ? sel.hover : cell;
    gesture.current = { cell, onGhost: on, moved: false, off: [hv[0] - cell[0], hv[1] - cell[1]] };
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    const gs = gesture.current;
    gesture.current = null;
    if (!gs || e.pointerType === 'mouse') return;
    e.stopPropagation();
    if (!gs.moved && gs.onGhost && canTurn) rotate(gs.cell);
  };
  const onWheel = (e: ThreeEvent<WheelEvent>) => {
    if (!interactive || !canTurn) return;
    e.stopPropagation();
    rotate(cellFromEvent(e as unknown as ThreeEvent<PointerEvent>) ?? undefined, e.deltaY < 0 ? -1 : 1);
  };
  const onContext = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive || !canTurn) return;
    e.nativeEvent.preventDefault();
    e.stopPropagation();
    rotate(cellFromEvent(e as unknown as ThreeEvent<PointerEvent>) ?? undefined);
  };

  return (
    <group position={[x, y, 0]} scale={[scale, scale, 1]}>
      <mesh position={[0, 0, -0.16]}>
        <boxGeometry args={[10.4, 10.4, 0.1]} />
        <meshStandardMaterial color={C.gold} roughness={0.45} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[9.8, 9.8, 0.1]} />
        <meshStandardMaterial color={frame} emissive={frame} emissiveIntensity={active ? 0.35 : 0.0} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[9.4, 9.4, 0.1]} />
        <meshStandardMaterial color={UI.board} roughness={1} />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
        <meshBasicMaterial map={gridTexture()} />
      </mesh>
      {penalty && (
        <mesh position={[0, 0, 0.05]}>
          <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
          <meshBasicMaterial map={penalty} transparent depthWrite={false} />
        </mesh>
      )}
      {p.tiles.map((t) => <TileMesh key={t.uid} tile={t} />)}
      {show7 && <Bonus7Outline board={p.board} />}
      {preview && (
        <GhostTurn anim={mine ? rotAnim : null} offerKey={`${sel.offer}`}>
      {preview.abs.filter(inBounds).map(([r, c]: Cell, i) => (
        // the ghost shows the real painted tile (red-tinted where it does not fit), with a glowing rim
        <group key={'pv' + i} position={[CELL_X(c), CELL_Y(r), 0.55]}>
          <mesh position={[0, 0, -0.02]}>
            <planeGeometry args={[0.98, 0.98]} />
            <meshBasicMaterial color={!mine ? frame : preview.valid ? '#7CFFB8' : UI.error} transparent opacity={0.85} />
          </mesh>
          <mesh>
            <planeGeometry args={[0.86, 0.86]} />
            <meshBasicMaterial map={ghostTex ?? undefined} color={ghostTex ? (preview.valid ? '#ffffff' : '#ff9a8a') : !mine ? frame : UI.success} transparent opacity={ghostTex ? 0.92 : 0.7} />
          </mesh>
        </group>
      ))}
        </GhostTurn>
      )}
      <mesh position={[0, 0, 0.6]} onPointerMove={onMove} onPointerDown={onDown} onPointerUp={onUp} onPointerLeave={() => { gesture.current = null; }} onWheel={onWheel} onContextMenu={onContext}>
        <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

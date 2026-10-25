import { useEffect, useMemo, useRef } from 'react';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BOARD_SIZE, Cell, EMPTY_CELL_PENALTY, PlacedTile, SPECIAL_7X7_BONUS, SPECIAL_AREA, Seat, TRACK_LENGTH } from '../../../shared/src';
import { useStore, setSel } from '../store';
import { confirmPlacement } from '../actions';
import { C, PLAYER_COLORS, UI } from './colors';
import { patternTexture, tileLook } from '../patterns';
import { inBounds, previewFor } from './placement';
import { textTexture } from './icons';
import { dragApi } from './dragApi';

const CELL_X = (c: number) => c - (BOARD_SIZE - 1) / 2;
const CELL_Y = (r: number) => (BOARD_SIZE - 1) / 2 - r;

function TileMesh({ tile }: { tile: PlacedTile }) {
  const ref = useRef<THREE.Group>(null);
  const t0 = useRef(performance.now());
  const look = useMemo(() => tileLook(tile.uid, tile.shape), [tile.uid, tile.shape]);
  const color = look.color;
  const fabric = useMemo(() => patternTexture(look), [look]);
  const cx = tile.cells.reduce((s, c) => s + CELL_X(c[1]), 0) / tile.cells.length;
  const cy = tile.cells.reduce((s, c) => s + CELL_Y(c[0]), 0) / tile.cells.length;
  const keys = useMemo(() => new Set(tile.cells.map((c) => c.join(','))), [tile]);
  useFrame(() => {
    if (!ref.current) return;
    const reduce = useStore.getState().settings.reduceMotion;
    const k = reduce ? 1 : Math.min(1, (performance.now() - t0.current) / 240);
    const e = 1 - Math.pow(1 - k, 3);
    ref.current.scale.setScalar(0.55 + 0.45 * e);
  });
  return (
    <group ref={ref} position={[cx, cy, 0]}>
      {tile.cells.map(([r, c], i) => {
        const x = CELL_X(c) - cx, y = CELL_Y(r) - cy;
        return (
          <group key={i} position={[x, y, 0]}>
            <mesh position={[0, 0, 0.2]}>
              <boxGeometry args={[0.9, 0.9, 0.3]} />
              <meshStandardMaterial color={color} roughness={0.75} />
            </mesh>
            <mesh position={[0, 0, 0.36]}>
              <planeGeometry args={[0.9, 0.9]} />
              <meshBasicMaterial map={fabric} />
            </mesh>
            {keys.has(`${r},${c + 1}`) && (
              <mesh position={[0.5, 0, 0.2]}><boxGeometry args={[0.14, 0.9, 0.3]} /><meshStandardMaterial color={color} roughness={0.75} /></mesh>
            )}
            {keys.has(`${r + 1},${c}`) && (
              <mesh position={[0, -0.5, 0.2]}><boxGeometry args={[0.9, 0.14, 0.3]} /><meshStandardMaterial color={color} roughness={0.75} /></mesh>
            )}
            {i < tile.engraved && (
              <group position={[0, 0, 0.44]} rotation={[Math.PI / 2, 0, 0]}>
                <mesh><cylinderGeometry args={[0.27, 0.27, 0.08, 24]} /><meshStandardMaterial color={UI.coin} roughness={0.3} metalness={0.2} /></mesh>
                <mesh position={[0, 0.045, 0]}><cylinderGeometry args={[0.15, 0.15, 0.04, 20]} /><meshStandardMaterial color="#C98A00" roughness={0.4} /></mesh>
              </group>
            )}
            {tile.shape === 'mono' && (
              <mesh position={[0, 0, 0.37]}><planeGeometry args={[0.8, 0.8]} /><meshBasicMaterial map={textTexture('1×1')} transparent /></mesh>
            )}
          </group>
        );
      })}
    </group>
  );
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
  if (b.filled <= 0) return null;
  const x0 = CELL_X(b.c0) - 0.5, y0 = CELL_Y(b.r0) + 0.5, len = SPECIAL_AREA;
  const dashes: [number, number, number, number][] = []; // x, y, w, h
  for (let i = 0; i < len * 2; i++) {
    const t = i * 0.5 + 0.12;
    dashes.push([x0 + t + 0.13, y0, 0.26, 0.07], [x0 + t + 0.13, y0 - len, 0.26, 0.07], [x0, y0 - t - 0.13, 0.07, 0.26], [x0 + len, y0 - t - 0.13, 0.07, 0.26]);
  }
  const label = `${b.filled}/${SPECIAL_AREA * SPECIAL_AREA} · +${SPECIAL_7X7_BONUS}`;
  return (
    <group position={[0, 0, 0.62]}>
      {dashes.map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0]}><planeGeometry args={[w, h]} /><meshBasicMaterial color={C.saffron} transparent opacity={0.95} /></mesh>
      ))}
      <mesh position={[x0 + 1.15, y0 + 0.02, 0.01]}>
        <planeGeometry args={[2.3, 0.5]} />
        <meshBasicMaterial map={textTexture(label, '#FFB400', 'rgba(0,30,103,.9)')} transparent />
      </mesh>
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
  let preview = interactive ? previewFor(game, seat, sel) : null;
  if (!mine && intent && intent.seat === seat && game.current === seat) {
    const a = intent.action;
    if (a.t === 'buy') preview = { abs: a.cells, valid: true };
    else if (a.t === 'reward') preview = { abs: [[a.r, a.c]], valid: true };
  }
  const frame = PLAYER_COLORS[seat];
  // late game: empty cells show what they will cost
  const lateGame = mine && game.phase !== 'finished' && TRACK_LENGTH - Math.max(game.players[0].pos, game.players[1].pos) <= 8;
  const show7 = mine && game.bonus7By === null && game.phase !== 'finished';
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
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    const cell = cellFromEvent(e);
    if (cell && (!sel.hover || sel.hover[0] !== cell[0] || sel.hover[1] !== cell[1])) setSel({ hover: cell });
  };
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    const cell = cellFromEvent(e);
    if (!cell) return;
    // touch: tap / drag moves the ghost, the floating ✓ button places it. Mouse: click places.
    setSel({ hover: cell });
    if (e.pointerType === 'mouse') confirmPlacement();
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
      {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => {
        const r = Math.floor(i / BOARD_SIZE), c = i % BOARD_SIZE;
        return p.board[i] === 0 ? (
          <group key={i}>
            <mesh position={[CELL_X(c), CELL_Y(r), 0.04]}>
              <planeGeometry args={[0.92, 0.92]} />
              <meshBasicMaterial color={UI.gridLine} />
            </mesh>
            {lateGame && (
              <mesh position={[CELL_X(c), CELL_Y(r), 0.05]}>
                <planeGeometry args={[0.8, 0.8]} />
                <meshBasicMaterial map={textTexture(`−${EMPTY_CELL_PENALTY}`, '#C0503F')} transparent opacity={0.55} />
              </mesh>
            )}
          </group>
        ) : null;
      })}
      {p.tiles.map((t) => <TileMesh key={t.uid} tile={t} />)}
      {show7 && <Bonus7Outline board={p.board} />}
      {preview && preview.abs.filter(inBounds).map(([r, c]: Cell, i) => (
        <mesh key={'pv' + i} position={[CELL_X(c), CELL_Y(r), 0.5]}>
          <boxGeometry args={[0.9, 0.9, 0.1]} />
          <meshBasicMaterial color={!mine ? frame : preview.valid ? UI.success : UI.error} transparent opacity={mine ? 0.6 : 0.75} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.6]} onPointerMove={onMove} onPointerDown={onDown}>
        <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

import { useEffect, useMemo, useRef } from 'react';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BOARD_SIZE, Cell, PlacedTile, Seat } from '../../../shared/src';
import { useStore, setSel, resetSel, pushToast } from '../store';
import { send } from '../net';
import { tr } from '../i18n';
import { sfx } from '../audio';
import { C, PLAYER_COLORS, UI, shapeColor } from './colors';
import { inBounds, previewFor } from './placement';
import { textTexture } from './icons';
import { dragApi } from './dragApi';

const CELL_X = (c: number) => c - (BOARD_SIZE - 1) / 2;
const CELL_Y = (r: number) => (BOARD_SIZE - 1) / 2 - r;

function TileMesh({ tile }: { tile: PlacedTile }) {
  const ref = useRef<THREE.Group>(null);
  const t0 = useRef(performance.now());
  const color = shapeColor(tile.shape);
  const light = useMemo(() => new THREE.Color(color).offsetHSL(0, 0, 0.16), [color]);
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
              <planeGeometry args={[0.66, 0.66]} />
              <meshBasicMaterial color={light} transparent opacity={0.55} />
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

export function BoardView({ seat, x, y, scale }: { seat: Seat; x: number; y: number; scale: number }) {
  const game = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const sel = useStore((s) => s.sel);
  const p = game.players[seat];
  const mine = seat === mySeat;
  const active = game.current === seat && game.phase !== 'finished';
  const interactive = mine && active && (game.phase === 'placing_reward' || sel.offer !== null);
  const preview = interactive ? previewFor(game, seat, sel) : null;
  const frame = PLAYER_COLORS[seat];
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
    return () => { dragApi.pick = null; };
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
    const touch = e.pointerType === 'touch';
    const same = sel.hover && sel.hover[0] === cell[0] && sel.hover[1] === cell[1];
    if (touch && !same) { setSel({ hover: cell }); return; } // first tap = preview, second tap = confirm
    const pv = previewFor(game, seat, { ...sel, hover: cell });
    if (!pv || !pv.valid) { sfx.bad(); pushToast(tr('toast.noFit'), 'bad'); return; }
    if (game.phase === 'placing_reward') send.reward(cell[0], cell[1]);
    else if (sel.offer !== null) send.buy(sel.offer, pv.abs);
    sfx.place();
    resetSel();
  };

  return (
    <group position={[x, y, 0]} scale={[scale, scale, 1]}>
      <mesh position={[0, 0, -0.16]}>
        <boxGeometry args={[10.4, 10.4, 0.1]} />
        <meshStandardMaterial color={C.gold} roughness={0.45} metalness={0.25} />
      </mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy], k) => (
        <mesh key={'orn' + k} position={[sx * 5.2, sy * 5.2, -0.05]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.5, 0.5, 0.12]} /><meshStandardMaterial color={C.saffron} roughness={0.4} />
        </mesh>
      ))}
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
          <mesh key={i} position={[CELL_X(c), CELL_Y(r), 0.04]}>
            <planeGeometry args={[0.92, 0.92]} />
            <meshBasicMaterial color={UI.gridLine} />
          </mesh>
        ) : null;
      })}
      {p.tiles.map((t) => <TileMesh key={t.uid} tile={t} />)}
      {preview && preview.abs.filter(inBounds).map(([r, c]: Cell, i) => (
        <mesh key={'pv' + i} position={[CELL_X(c), CELL_Y(r), 0.5]}>
          <boxGeometry args={[0.9, 0.9, 0.1]} />
          <meshBasicMaterial color={preview.valid ? UI.success : UI.error} transparent opacity={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.6]} onPointerMove={onMove} onPointerDown={onDown}>
        <planeGeometry args={[BOARD_SIZE, BOARD_SIZE]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

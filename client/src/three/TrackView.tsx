import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { REWARD_POSITIONS, Seat, TRACK_LENGTH, TREASURE_POSITIONS } from '../../../shared/src';
import { removeFx, spawnFx, useStore } from '../store';
import { C, PLAYER_COLORS, UI } from './colors';
import { cellTexture } from './icons';
import { Layout, trackCoord, trackCoordFrac, windowAlpha, windowTarget } from './layout';
import { useForecast } from '../forecast';
import { vfx } from './vfx';
import { coinsTo } from './steer';

const NORMAL = new THREE.Color('#F6EBCB');
const END_TINT = new THREE.Color('#F2B49A');

/** Shared, per-frame state of the track: the centre of the phone window (fractional track index). */
const view = { scroll: -1 };

type PathMark = 'path' | 'land' | null;

/** What the shared frame loop needs to animate one cell (filled in by the cell on render). */
interface Slot { g: THREE.Group | null; hl: THREE.MeshBasicMaterial | null; mark: PathMark; hit: boolean }

const boxes = new Map<number, THREE.BoxGeometry>();
const cellBox = (cell: number) => { let b = boxes.get(cell); if (!b) { b = new THREE.BoxGeometry(cell * 0.92, cell * 0.92, 0.12); boxes.set(cell, b); } return b; };

/** A track cell. It re-renders only when its own preview mark changes; all animation runs in TrackView's single frame loop. */
const TrackCell = memo(function TrackCell({ i, layout, mark, hit, who, slot }: { i: number; layout: Layout; mark: PathMark; hit: boolean; who: Seat; slot: Slot }) {
  const reward = useStore((s) => { const ri = REWARD_POSITIONS.indexOf(i); return ri >= 0 && !s.game!.rewardTaken[ri]; });
  const cell = layout.track.cell;
  const treasure = TREASURE_POSITIONS.includes(i);
  const finish = i === TRACK_LENGTH;
  const base = useMemo(() => {
    if (finish) return '#E9DDF0';
    if (treasure) return '#FFE08A';
    if (reward) return '#BDEBD2';
    return NORMAL.clone().lerp(END_TINT, (i / TRACK_LENGTH) * 0.9).getStyle();
  }, [i, finish, treasure, reward]);
  // Treasure = chest, reward = 1x1 tile, finish = checkered flag; numbers on every cell (desktop) or every 5th (phone).
  const big = layout.track.vertical || layout.track.window > 0;
  const tex = useMemo(() => cellTexture(finish ? 'flag' : treasure ? 'chest' : reward ? 'reward' : null, i, big ? 'five' : 'all'), [i, finish, treasure, reward, big]);
  const [sx, sy] = trackCoord(layout, i);
  slot.mark = mark; slot.hit = hit;

  return (
    <group ref={(g) => { slot.g = g; }} position={[sx, sy, 0]}>
      <mesh position={[0, 0, 0.05]} geometry={cellBox(cell)}>
        <meshLambertMaterial color={base} />
      </mesh>
      {(mark || hit) && (
        // preview of the selected action: the cells my marker would cross, the landing cell, and what it collects
        <mesh position={[0, 0, 0.112]}>
          <planeGeometry args={[cell * (mark === 'land' ? 0.98 : 0.92), cell * (mark === 'land' ? 0.98 : 0.92)]} />
          <meshBasicMaterial ref={(m) => { slot.hl = m; }} color={hit ? C.saffron : PLAYER_COLORS[who]} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}
      <mesh position={[0, 0, 0.115]}>
        <planeGeometry args={[cell * 0.9, cell * 0.9]} />
        <meshBasicMaterial map={tex} transparent />
      </mesh>
    </group>
  );
});

function MarkerMesh({ seat, cell, ghost = false }: { seat: Seat; cell: number; ghost?: boolean }) {
  const color = PLAYER_COLORS[seat];
  const mat = <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} transparent={ghost} opacity={ghost ? 0.5 : 1} depthWrite={!ghost} />;
  return seat === 0
    ? <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[cell * 0.27, cell * 0.27, 0.35, 24]} />{mat}</mesh>
    : <mesh rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[cell * 0.42, cell * 0.42, 0.35]} />{mat}</mesh>;
}

const laneOf = (layout: Layout, seat: Seat) => (seat === 0 ? 1 : -1) * layout.track.cell * 0.17;

/** Marker. Effects fire at the moment the (animated) marker actually passes a cell. */
function Marker({ seat, layout }: { seat: Seat; layout: Layout }) {
  const ref = useRef<THREE.Group>(null);
  const disp = useRef<number>(useStore.getState().game!.players[seat].pos);
  const lastInt = useRef(Math.floor(disp.current + 1e-6));
  const wasActive = useRef(true); // no sparkle on the very first frame
  const cell = layout.track.cell;

  const onPass = (i: number) => {
    const st = useStore.getState();
    const key = `${seat}:${i}`;
    const fx = st.pendingFx[key];
    if (!fx) return;
    delete st.pendingFx[key];
    const [x, y] = trackCoord(layout, i, view.scroll);
    useStore.setState((s) => ({ flashes: { ...s.flashes, [i]: performance.now() } }));
    if (fx.kind === 'treasure' && fx.coins > 0) { vfx('gold', x, y, 0.8); coinsTo(seat, x, y, fx.coins); }
    if (fx.kind === 'reward') {
      vfx('sparkle', x, y, 0.8);
      const b = seat === st.mySeat ? layout.my : layout.opp;
      spawnFx({ kind: 'tile', x, y, tx: b.x, ty: b.y, color: C.emerald });
    }
  };

  useFrame((st, dt) => {
    const s = useStore.getState();
    const g = s.game;
    if (!g || !ref.current) return;
    const target = g.players[seat].pos;
    if (s.settings.reduceMotion) disp.current = target;
    else {
      const diff = target - disp.current;
      disp.current += Math.sign(diff) * Math.min(Math.abs(diff), dt * (4 + Math.abs(diff) * 0.8));
    }
    const cur = Math.floor(disp.current + 1e-6);
    if (cur > lastInt.current) { for (let i = lastInt.current + 1; i <= cur; i++) onPass(i); lastInt.current = cur; }
    else if (cur < lastInt.current) lastInt.current = cur;
    const [x, y] = trackCoordFrac(layout, disp.current, view.scroll);
    const lane = laneOf(layout, seat);
    if (layout.track.vertical) ref.current.position.set(x - lane, y, 0.5); else ref.current.position.set(x, y + lane, 0.5);
    ref.current.visible = windowAlpha(layout, disp.current, view.scroll) > 0.3;
    const active = g.current === seat && g.phase !== 'finished';
    if (active && !wasActive.current) vfx('sparkle', ref.current.position.x, ref.current.position.y, 0.8, 0.8); // the turn comes to this marker
    wasActive.current = active;
    const pulse = active && !s.settings.reduceMotion ? 1 + 0.12 * Math.sin(st.clock.elapsedTime * 5) : 1;
    ref.current.scale.setScalar(pulse * (active ? 1.12 : 0.95));
  });
  return <group ref={ref}><MarkerMesh seat={seat} cell={cell} /></group>;
}

/** Semi-transparent copy of a marker where the previewed (or announced) action would put it. */
function GhostMarker({ layout, to, seat: mySeat }: { layout: Layout; to: number; seat: Seat }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((st) => {
    if (!ref.current) return;
    const [x, y] = trackCoord(layout, to, view.scroll);
    const lane = laneOf(layout, mySeat);
    const bob = useStore.getState().settings.reduceMotion ? 0 : 0.12 * Math.sin(st.clock.elapsedTime * 4);
    if (layout.track.vertical) ref.current.position.set(x - lane, y, 0.75 + bob); else ref.current.position.set(x, y + lane, 0.75 + bob);
    ref.current.visible = windowAlpha(layout, to, view.scroll) > 0.3;
  });
  return <group ref={ref}><MarkerMesh seat={mySeat} cell={layout.track.cell} ghost /></group>;
}

/* ---------- effects ---------- */
function TileFly({ id, x, y, tx, ty, color }: { id: number; x: number; y: number; tx: number; ty: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const t0 = useRef(performance.now());
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const t = Math.min(1, (performance.now() - t0.current) / 1000);
    const e = t * t * (3 - 2 * t);
    m.position.set(x + (tx - x) * e, y + (ty - y) * e, 0.8 + Math.sin(t * Math.PI) * 2.4);
    m.rotation.z = t * Math.PI * 2;
    m.scale.setScalar(1.2 - 0.5 * e);
    if (t >= 1) removeFx(id);
  });
  return (
    <mesh ref={ref} position={[x, y, 0.8]}>
      <boxGeometry args={[0.7, 0.7, 0.3]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}

function FxLayer() {
  const fx = useStore((s) => s.fx);
  return (
    <>
      {fx.map((f) => f.kind === 'tile' && <TileFly key={f.id} id={f.id} x={f.x} y={f.y} tx={f.tx ?? f.x} ty={f.ty ?? f.y} color={f.color ?? C.emerald} />)}
    </>
  );
}

export function TrackView({ layout }: { layout: Layout }) {
  const cells = useMemo(() => Array.from({ length: TRACK_LENGTH + 1 }, (_, i) => i), []);
  const { plate } = layout.track;
  const fc = useForecast();
  const slots = useMemo<Slot[]>(() => cells.map(() => ({ g: null, hl: null, mark: null, hit: false })), [cells]);

  // one frame loop for all cells: window scroll / fade, landing flash, pulsing preview
  useFrame((st) => {
    const s = useStore.getState(), reduce = s.settings.reduceMotion, now = performance.now(), el = st.clock.elapsedTime;
    for (let i = 0; i < slots.length; i++) {
      const sl = slots[i], g = sl.g;
      if (!g) continue;
      let a = 1;
      if (layout.track.window) {
        a = windowAlpha(layout, i, view.scroll);
        g.visible = a > 0.01;
        if (!g.visible) continue;
        const [x, y] = trackCoord(layout, i, view.scroll);
        g.position.set(x, y, 0);
      }
      let k = 1;
      const t0 = s.flashes[i];
      if (t0 && !reduce) { const dt = (now - t0) / 1000; if (dt < 0.9) k = 1 + 0.5 * Math.exp(-dt * 3.5) * Math.abs(Math.sin(dt * 9)); }
      if (sl.hit && !reduce) k *= 1 + 0.1 * Math.abs(Math.sin(el * 4));
      g.scale.setScalar(k * (0.4 + 0.6 * a));
      if (sl.hl && (sl.mark || sl.hit)) sl.hl.opacity = (sl.mark === 'land' ? 0.75 : sl.hit ? 0.65 : 0.38) * a;
    }
  });

  // Phone: keep both markers and the preview ghost inside the scrolling window.
  useFrame((_, dt) => {
    if (!layout.track.window) return;
    const s = useStore.getState();
    const g = s.game;
    if (!g) return;
    const a = g.players[0].pos, b = g.players[1].pos;
    const hi = fc ? Math.max(a, b, fc.to) : Math.max(a, b);
    const target = windowTarget(layout, Math.min(a, b), hi, g.players[g.current].pos);
    if (view.scroll < 0 || s.settings.reduceMotion) view.scroll = target;
    else view.scroll += (target - view.scroll) * Math.min(1, dt * 6);
  });

  const markOf = (i: number): PathMark => (!fc || i <= fc.from || i > fc.to ? null : i === fc.to ? 'land' : 'path');
  const hitOf = (i: number) => !!fc && (fc.treasures.includes(i) || fc.rewards.includes(i));
  return (
    <group>
      <mesh position={[plate.x, plate.y, -0.09]}>
        <boxGeometry args={[plate.w + 0.25, plate.h + 0.25, 0.08]} />
        <meshStandardMaterial color={C.gold} roughness={0.45} metalness={0.25} />
      </mesh>
      <mesh position={[plate.x, plate.y, -0.05]}>
        <boxGeometry args={[plate.w, plate.h, 0.08]} />
        <meshStandardMaterial color={UI.plate} roughness={1} />
      </mesh>
      {cells.map((i) => <TrackCell key={i} i={i} layout={layout} mark={markOf(i)} hit={hitOf(i)} who={fc?.seat ?? 0} slot={slots[i]} />)}
      <Marker seat={0} layout={layout} />
      <Marker seat={1} layout={layout} />
      {fc && <GhostMarker layout={layout} to={fc.to} seat={fc.seat} />}
      <FxLayer />
    </group>
  );
}

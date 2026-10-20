import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { REWARD_POSITIONS, Seat, TRACK_LENGTH, TREASURE_POSITIONS } from '../../../shared/src';
import { removeFx, spawnFx, useStore } from '../store';
import { G, PLAYER_COLORS, UI } from './colors';
import { Layout, trackCoord, trackCoordFrac } from './layout';

const NORMAL = new THREE.Color('#CBD4EA');
const END_TINT = new THREE.Color('#F4B6B0');

function TrackCell({ i, layout }: { i: number; layout: Layout }) {
  const ref = useRef<THREE.Group>(null);
  const rewardTaken = useStore((s) => s.game!.rewardTaken);
  const [x, y] = trackCoord(layout, i);
  const cell = layout.track.cell;
  const treasure = TREASURE_POSITIONS.includes(i);
  const ri = REWARD_POSITIONS.indexOf(i);
  const reward = ri >= 0 && !rewardTaken[ri];
  const finish = i === TRACK_LENGTH;
  const base = useMemo(() => {
    if (finish) return '#3C4043';
    if (treasure) return '#FDE7A0';
    if (reward) return '#BFE6C9';
    return NORMAL.clone().lerp(END_TINT, (i / TRACK_LENGTH) * 0.85).getStyle();
  }, [i, finish, treasure, reward]);

  useFrame(() => {
    if (!ref.current) return;
    const t0 = useStore.getState().flashes[i];
    let k = 1;
    if (t0 && !useStore.getState().settings.reduceMotion) {
      const dt = (performance.now() - t0) / 1000;
      if (dt < 0.9) k = 1 + 0.5 * Math.exp(-dt * 3.5) * Math.abs(Math.sin(dt * 9));
    }
    ref.current.scale.setScalar(k);
  });

  return (
    <group ref={ref} position={[x, y, 0]}>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[cell * 0.9, cell * 0.9, 0.12]} />
        <meshStandardMaterial color={base} roughness={0.85} />
      </mesh>
      {treasure && (
        <group position={[0, 0, 0.18]}>
          <mesh><boxGeometry args={[cell * 0.5, cell * 0.34, cell * 0.28]} /><meshStandardMaterial color={G.yellow} roughness={0.45} /></mesh>
          <mesh position={[0, 0, cell * 0.16]}><boxGeometry args={[cell * 0.56, cell * 0.38, cell * 0.08]} /><meshStandardMaterial color="#E37400" roughness={0.5} /></mesh>
        </group>
      )}
      {reward && (
        <mesh position={[0, 0, 0.2]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[cell * 0.4, cell * 0.4, cell * 0.25]} />
          <meshStandardMaterial color={G.green} roughness={0.5} />
        </mesh>
      )}
      {finish && [0, 1, 2, 3].map((k) => (
        <mesh key={k} position={[((k % 2) - 0.5) * cell * 0.28, (Math.floor(k / 2) - 0.5) * cell * 0.28, 0.13]}>
          <planeGeometry args={[cell * 0.26, cell * 0.26]} />
          <meshBasicMaterial color={(k + Math.floor(k / 2)) % 2 ? '#202124' : '#ffffff'} />
        </mesh>
      ))}
      {!finish && !treasure && !reward && i > 0 && i % 10 === 0 && (
        <mesh position={[0, 0, 0.12]}><planeGeometry args={[cell * 0.5, cell * 0.08]} /><meshBasicMaterial color="#ffffff" /></mesh>
      )}
    </group>
  );
}

/** Marker. Effects fire at the moment the (animated) marker actually passes a cell. */
function Marker({ seat, layout }: { seat: Seat; layout: Layout }) {
  const ref = useRef<THREE.Group>(null);
  const disp = useRef<number>(useStore.getState().game!.players[seat].pos);
  const lastInt = useRef(Math.floor(disp.current + 1e-6));
  const cell = layout.track.cell;
  const color = PLAYER_COLORS[seat];

  const onPass = (i: number) => {
    const st = useStore.getState();
    const key = `${seat}:${i}`;
    const fx = st.pendingFx[key];
    if (!fx) return;
    delete st.pendingFx[key];
    const [x, y] = trackCoord(layout, i);
    useStore.setState((s) => ({ flashes: { ...s.flashes, [i]: performance.now() } }));
    if (fx.kind === 'treasure' && fx.coins > 0) spawnFx({ kind: 'coins', x, y, count: Math.min(12, 3 + fx.coins * 2) });
    if (fx.kind === 'reward') {
      const b = seat === st.mySeat ? layout.my : layout.opp;
      spawnFx({ kind: 'tile', x, y, tx: b.x, ty: b.y, color: G.green });
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
      disp.current += Math.sign(diff) * Math.min(Math.abs(diff), dt * (9 + Math.abs(diff) * 2));
    }
    const cur = Math.floor(disp.current + 1e-6);
    if (cur > lastInt.current) { for (let i = lastInt.current + 1; i <= cur; i++) onPass(i); lastInt.current = cur; }
    else if (cur < lastInt.current) lastInt.current = cur;
    const [x, y] = trackCoordFrac(layout, disp.current);
    ref.current.position.set(x, y + (seat === 0 ? 1 : -1) * cell * 0.17, 0.5);
    const active = g.current === seat && g.phase !== 'finished';
    const pulse = active && !s.settings.reduceMotion ? 1 + 0.12 * Math.sin(st.clock.elapsedTime * 5) : 1;
    ref.current.scale.setScalar(pulse * (active ? 1.12 : 0.95));
  });
  return (
    <group ref={ref}>
      {seat === 0 ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[cell * 0.27, cell * 0.27, 0.35, 24]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
        </mesh>
      ) : (
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[cell * 0.42, cell * 0.42, 0.35]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
        </mesh>
      )}
    </group>
  );
}

/* ---------- effects ---------- */
function CoinBurst({ id, x, y, count }: { id: number; x: number; y: number; count: number }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const t0 = useRef(performance.now());
  const parts = useMemo(() => Array.from({ length: count }, () => ({
    vx: (Math.random() - 0.5) * 3.6, vy: 2.2 + Math.random() * 3.2, vz: 2 + Math.random() * 2, spin: Math.random() * 8,
  })), [count]);
  const mats = useMemo(() => parts.map(() => new THREE.MeshStandardMaterial({ color: G.yellow, roughness: 0.35, metalness: 0.2, transparent: true })), [parts]);
  useFrame(() => {
    const t = (performance.now() - t0.current) / 1000;
    parts.forEach((p, i) => {
      const m = meshes.current[i];
      if (!m) return;
      m.position.set(x + p.vx * t, y + p.vy * t - 4.5 * t * t, 0.8 + p.vz * t - 3 * t * t);
      m.rotation.set(Math.PI / 2 + t * p.spin, 0, 0);
      mats[i].opacity = Math.max(0, 1 - t / 1.05);
    });
    if (t > 1.1) removeFx(id);
  });
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  return (
    <group>
      {parts.map((_, i) => (
        <mesh key={i} ref={(m) => { meshes.current[i] = m; }} material={mats[i]} position={[x, y, 0.8]}>
          <cylinderGeometry args={[0.2, 0.2, 0.07, 18]} />
        </mesh>
      ))}
    </group>
  );
}

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
      {fx.map((f) => f.kind === 'coins'
        ? <CoinBurst key={f.id} id={f.id} x={f.x} y={f.y} count={f.count ?? 6} />
        : <TileFly key={f.id} id={f.id} x={f.x} y={f.y} tx={f.tx ?? f.x} ty={f.ty ?? f.y} color={f.color ?? G.green} />)}
    </>
  );
}

export function TrackView({ layout }: { layout: Layout }) {
  const cells = useMemo(() => Array.from({ length: TRACK_LENGTH + 1 }, (_, i) => i), []);
  const { cols, cell, rowGap, rows, x, y } = layout.track;
  return (
    <group>
      <mesh position={[x, y - ((rows - 1) * rowGap) / 2, -0.05]}>
        <boxGeometry args={[cols * cell + 0.5, (rows - 1) * rowGap + cell + 0.4, 0.08]} />
        <meshStandardMaterial color={UI.plate} roughness={1} />
      </mesh>
      {cells.map((i) => <TrackCell key={i} i={i} layout={layout} />)}
      <Marker seat={0} layout={layout} />
      <Marker seat={1} layout={layout} />
      <FxLayer />
    </group>
  );
}

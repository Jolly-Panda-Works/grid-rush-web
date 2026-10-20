import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { REWARD_POSITIONS, Seat, TRACK_LENGTH, TREASURE_POSITIONS } from '../../../shared/src';
import { useStore } from '../store';
import { PLAYER_COLORS, UI } from './colors';
import { Layout, trackCoord, trackCoordFrac } from './layout';

const NORMAL = new THREE.Color('#26263a');
const END_TINT = new THREE.Color('#5a2f26');

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
    if (finish) return UI.accent;
    if (treasure) return '#0c8277';
    if (reward) return '#4a3fb5';
    return NORMAL.clone().lerp(END_TINT, (i / TRACK_LENGTH) * 0.8).getStyle();
  }, [i, finish, treasure, reward]);

  useFrame(() => {
    if (!ref.current) return;
    const t0 = useStore.getState().flashes[i];
    let k = 1;
    if (t0 && !useStore.getState().settings.reduceMotion) {
      const dt = (performance.now() - t0) / 1000;
      if (dt < 0.9) k = 1 + 0.45 * Math.exp(-dt * 4) * Math.abs(Math.sin(dt * 9));
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
          <mesh><boxGeometry args={[cell * 0.5, cell * 0.34, cell * 0.28]} /><meshStandardMaterial color={UI.coin} roughness={0.5} /></mesh>
          <mesh position={[0, 0, cell * 0.16]}><boxGeometry args={[cell * 0.56, cell * 0.38, cell * 0.08]} /><meshStandardMaterial color={UI.accent} roughness={0.5} /></mesh>
        </group>
      )}
      {reward && (
        <mesh position={[0, 0, 0.2]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[cell * 0.4, cell * 0.4, cell * 0.25]} />
          <meshStandardMaterial color={UI.primary} emissive={UI.primary} emissiveIntensity={0.5} roughness={0.5} />
        </mesh>
      )}
      {finish && (
        <>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} position={[((k % 2) - 0.5) * cell * 0.28, (Math.floor(k / 2) - 0.5) * cell * 0.28, 0.13]}>
              <planeGeometry args={[cell * 0.26, cell * 0.26]} />
              <meshBasicMaterial color={(k + Math.floor(k / 2)) % 2 ? '#1b1b1b' : '#ffffff'} />
            </mesh>
          ))}
        </>
      )}
      {!finish && !treasure && !reward && i > 0 && i % 10 === 0 && (
        <mesh position={[0, 0, 0.12]}><planeGeometry args={[cell * 0.5, cell * 0.08]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.5} /></mesh>
      )}
    </group>
  );
}

function Marker({ seat, layout }: { seat: Seat; layout: Layout }) {
  const ref = useRef<THREE.Group>(null);
  const disp = useRef<number>(useStore.getState().game!.players[seat].pos);
  const cell = layout.track.cell;
  const color = PLAYER_COLORS[seat];
  useFrame((st, dt) => {
    const s = useStore.getState();
    const g = s.game;
    if (!g || !ref.current) return;
    const target = g.players[seat].pos;
    if (s.settings.reduceMotion) disp.current = target;
    else {
      const diff = target - disp.current;
      disp.current += Math.sign(diff) * Math.min(Math.abs(diff), dt * (10 + Math.abs(diff) * 2.2));
    }
    const [x, y] = trackCoordFrac(layout, disp.current);
    ref.current.position.set(x, y + (seat === 0 ? 1 : -1) * cell * 0.17, 0.5);
    const active = g.current === seat && g.phase !== 'finished';
    const pulse = active && !s.settings.reduceMotion ? 1 + 0.12 * Math.sin(st.clock.elapsedTime * 5) : 1;
    ref.current.scale.setScalar(pulse * (active ? 1.1 : 0.92));
  });
  return (
    <group ref={ref}>
      {seat === 0 ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[cell * 0.27, cell * 0.27, 0.35, 24]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
        </mesh>
      ) : (
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[cell * 0.42, cell * 0.42, 0.35]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
        </mesh>
      )}
    </group>
  );
}

export function TrackView({ layout }: { layout: Layout }) {
  const cells = useMemo(() => Array.from({ length: TRACK_LENGTH + 1 }, (_, i) => i), []);
  const { cols, cell, rowGap, rows, x, y } = layout.track;
  return (
    <group>
      <mesh position={[x, y - ((rows - 1) * rowGap) / 2, -0.05]}>
        <boxGeometry args={[cols * cell + 0.5, (rows - 1) * rowGap + cell + 0.4, 0.08]} />
        <meshStandardMaterial color="#191926" roughness={1} />
      </mesh>
      {cells.map((i) => <TrackCell key={i} i={i} layout={layout} />)}
      <Marker seat={0} layout={layout} />
      <Marker seat={1} layout={layout} />
    </group>
  );
}

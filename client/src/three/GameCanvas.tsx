import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { shake } from './shake';
import { isMobile } from '../device';
import * as THREE from 'three';
import { useStore } from '../store';
import { BoardView } from './BoardView';
import { TrackView } from './TrackView';
import { VfxLayer } from './vfx';
import { SteerLayer } from './steer';
import { computeLayout } from './layout';

function Scene() {
  const { size, camera } = useThree();
  const game = useStore((s) => s.game);
  const mySeat = useStore((s) => s.mySeat);
  const aspect = size.width / Math.max(1, size.height);
  const layout = useMemo(() => computeLayout(aspect), [aspect]);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const t = Math.tan((cam.fov * Math.PI) / 360);
    const z = Math.max(layout.h / 2 / t, layout.w / 2 / (t * aspect)) * 1.04;
    cam.position.set(layout.cx, layout.cy, z);
    cam.lookAt(layout.cx, layout.cy, 0);
    cam.updateProjectionMatrix();
    base.current = { x: layout.cx, y: layout.cy, z: cam.position.z };
  }, [layout, aspect, camera]);

  // decaying-trauma shake of the camera only (smooth sines, not random jitter); always returns to rest
  const base = useRef({ x: 0, y: 0, z: 40 });
  useFrame((st, dt) => {
    if (shake.trauma <= 0) return;
    shake.trauma = Math.max(0, shake.trauma - dt * 1.6);
    const reduce = useStore.getState().settings.reduceMotion;
    const k = reduce ? 0 : shake.trauma * shake.trauma, tt = st.clock.elapsedTime * 30;
    camera.position.set(base.current.x + 0.35 * k * Math.sin(tt * 1.7), base.current.y + 0.25 * k * Math.sin(tt * 2.3), base.current.z);
    camera.rotation.z = 0.02 * k * Math.sin(tt * 1.1);
  });

  if (!game) return null;
  const opp = (1 - mySeat) as 0 | 1;
  return (
    <>
      <ambientLight intensity={1.25} />
      <directionalLight position={[-6, 10, 18]} intensity={0.9} />
      <BoardView seat={mySeat} x={layout.my.x} y={layout.my.y} scale={layout.my.scale} />
      <BoardView seat={opp} x={layout.opp.x} y={layout.opp.y} scale={layout.opp.scale} />
      <TrackView layout={layout} />
      <VfxLayer />
      <SteerLayer layout={layout} />
    </>
  );
}

/** Phones: render at most 1.5x the CSS pixels (a 3x screen would otherwise fill 4x as many pixels), and skip MSAA on dense screens. */
const GL = (() => {
  const mobile = isMobile(), ratio = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  return { dpr: (mobile ? [1, 1.5] : [1, 2]) as [number, number], antialias: !(mobile && ratio >= 2) };
})();

export default function GameCanvas() {
  return (
    <Canvas dpr={GL.dpr} camera={{ fov: 30, position: [0, 0, 40], near: 0.1, far: 300 }} gl={{ antialias: GL.antialias, alpha: true, powerPreference: 'high-performance' }}>
      <Scene />
    </Canvas>
  );
}

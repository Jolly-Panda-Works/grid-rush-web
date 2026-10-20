import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';
import { BoardView } from './BoardView';
import { TrackView } from './TrackView';
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
  }, [layout, aspect, camera]);

  if (!game) return null;
  const opp = (1 - mySeat) as 0 | 1;
  return (
    <>
      <ambientLight intensity={1.25} />
      <directionalLight position={[-6, 10, 18]} intensity={0.9} />
      <BoardView seat={mySeat} x={layout.my.x} y={layout.my.y} scale={layout.my.scale} />
      <BoardView seat={opp} x={layout.opp.x} y={layout.opp.y} scale={layout.opp.scale} />
      <TrackView layout={layout} />
    </>
  );
}

export default function GameCanvas() {
  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 30, position: [0, 0, 40], near: 0.1, far: 300 }} gl={{ antialias: true }}>
      <color attach="background" args={['#F4F7FE']} />
      <Scene />
    </Canvas>
  );
}

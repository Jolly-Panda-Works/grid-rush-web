import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ArriveBehavior, EntityManager, SeekBehavior, Vehicle, WanderBehavior, Vector3 as YVector3 } from 'yuka';
import type { Seat } from '../../../shared/src';
import { sfx } from '../audio';
import { useStore } from '../store';
import { Layout } from './layout';
import { vfx } from './vfx';
import { isMobile } from '../device';

/**
 * Organic motion with Yuka steering behaviours:
 * - treasure coins burst out of the treasure cell, then curve and home in on that player's coin counter (arrive);
 * - a few fireflies wander over the table (wander + a gentle pull back to the middle).
 * Yuka steers on its ground plane (x, z); here that plane is mapped onto the table (x, y).
 */
const manager = new EntityManager();
let toWorld: ((px: number, py: number) => THREE.Vector3 | null) | null = null;

interface Coin { v: Vehicle; target: YVector3; seat: Seat; born: number; live: boolean }
let coins: Coin[] = [];
let bumpCoins: (() => void) | null = null;

/** Send `count` coins flying from a treasure cell (world x, y) to `seat`'s coin counter. */
export function coinsTo(seat: Seat, x: number, y: number, count: number) {
  if (useStore.getState().settings.reduceMotion || !toWorld) return;
  const gem = document.querySelector(`.sstats[data-seat="${seat}"] .gem.coin`);
  const r = gem?.getBoundingClientRect();
  const end = r ? toWorld(r.left + r.width / 2, r.top + r.height / 2) : null;
  if (!end) return;
  const now = performance.now();
  for (let i = 0; i < Math.min(10, count); i++) {
    const v = new Vehicle();
    v.position.set(x, 0, y);
    const a = Math.random() * Math.PI * 2, sp = 5 + Math.random() * 4;
    v.velocity.set(Math.cos(a) * sp, 0, Math.sin(a) * sp); // burst outwards first...
    v.maxSpeed = 16; v.maxForce = 55 + Math.random() * 20; v.mass = 1;
    const target = new YVector3(end.x, 0, end.y);
    v.steering.add(new ArriveBehavior(target, 0.6, 0.1)); // ...then curve in and settle on the counter
    coins.push({ v, target, seat, born: now + i * 40, live: false }); // staggered: joins the simulation at `born`
  }
  bumpCoins?.();
}

const COIN_GEO = new THREE.CylinderGeometry(0.28, 0.28, 0.07, 20);
const COIN_MAT = new THREE.MeshStandardMaterial({ color: '#F2C744', metalness: 0.6, roughness: 0.3, emissive: '#7a5200', emissiveIntensity: 0.35 });

function glowTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d')!, g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,240,170,1)'); g.addColorStop(0.35, 'rgba(255,210,90,.6)'); g.addColorStop(1, 'rgba(255,200,80,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

/** Lives inside the canvas: runs the Yuka simulation and draws the coins and fireflies. */
export function SteerLayer({ layout }: { layout: Layout }) {
  const { camera, gl } = useThree();
  const reduce = useStore((s) => s.settings.reduceMotion);
  const [, setN] = useState(0);
  const coinRefs = useRef(new Map<Vehicle, THREE.Mesh>());

  // screen point -> point on the table plane in front of the boards
  useEffect(() => {
    const rc = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.9), hit = new THREE.Vector3();
    toWorld = (px, py) => {
      const rect = gl.domElement.getBoundingClientRect();
      rc.setFromCamera(new THREE.Vector2(((px - rect.left) / rect.width) * 2 - 1, -(((py - rect.top) / rect.height) * 2 - 1)), camera);
      return rc.ray.intersectPlane(plane, hit) ? hit.clone() : null;
    };
    bumpCoins = () => setN((n) => n + 1);
    return () => { toWorld = null; bumpCoins = null; };
  }, [camera, gl]);

  // fireflies: wander, gently pulled back towards the middle of the table
  const flies = useMemo(() => {
    if (reduce) return [];
    const centre = new YVector3(layout.cx, 0, layout.cy);
    return Array.from({ length: isMobile() ? 4 : 7 }, () => {
      const v = new Vehicle();
      v.position.set(layout.cx + (Math.random() - 0.5) * layout.w * 0.8, 0, layout.cy + (Math.random() - 0.5) * layout.h * 0.8);
      v.maxSpeed = 0.9 + Math.random() * 0.6; v.maxForce = 2;
      const wander = new WanderBehavior(1.2, 2.5, 6);
      const home = new SeekBehavior(centre); home.weight = 0.12;
      v.steering.add(wander); v.steering.add(home);
      manager.add(v);
      return { v, phase: Math.random() * Math.PI * 2 };
    });
  }, [layout, reduce]);
  useEffect(() => () => flies.forEach((f) => manager.remove(f.v)), [flies]);
  const flyTex = useMemo(glowTexture, []);
  const flyRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((st, dt) => {
    const now = performance.now();
    // coins: wait for their staggered start, spin while flying, vanish with a sparkle on the counter
    let changed = false;
    coins = coins.filter((c) => {
      const m = coinRefs.current.get(c.v);
      if (now < c.born) return true;
      if (!c.live) { c.live = true; manager.add(c.v); }
      const done = c.v.position.squaredDistanceTo(c.target) < 0.12 || now - c.born > 2500;
      if (done) {
        manager.remove(c.v); coinRefs.current.delete(c.v); changed = true;
        vfx('sparkle', c.target.x, c.target.z, 1, 0.5); sfx.coin();
        return false;
      }
      if (m) { m.visible = true; m.position.set(c.v.position.x, c.v.position.z, 0.9); m.rotation.set(Math.PI / 2, 0, (now - c.born) / 80); }
      return true;
    });
    manager.update(Math.min(dt, 0.05));
    if (changed) setN((n) => n + 1);
    flies.forEach((f, i) => {
      const m = flyRefs.current[i];
      if (!m) return;
      m.position.set(f.v.position.x, f.v.position.z, 1.4);
      const k = 0.55 + 0.45 * Math.sin(st.clock.elapsedTime * 2.2 + f.phase);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.5 * k;
      m.scale.setScalar(0.7 + 0.5 * k);
    });
  });

  return (
    <group>
      {coins.map((c) => (
        <mesh key={c.v.uuid} geometry={COIN_GEO} material={COIN_MAT} visible={false} ref={(m) => { if (m) coinRefs.current.set(c.v, m); }} />
      ))}
      {flies.map((f, i) => (
        <mesh key={f.v.uuid} ref={(m) => { flyRefs.current[i] = m; }}>
          <planeGeometry args={[0.55, 0.55]} />
          <meshBasicMaterial map={flyTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  ApplyForce, BatchedRenderer, Bezier, CircleEmitter, ColorOverLife, ConstantColor, ConstantValue, Gradient, IntervalValue,
  ParticleSystem, PiecewiseBezier, RenderMode, RotationOverLife, SizeOverLife, SphereEmitter,
  Vector3 as QVector3, Vector4 as QVector4,
} from 'three.quarks';
import { useStore } from '../store';

/**
 * Particle effects (three.quarks), one preset per game event and sized to how much the event matters:
 * dust when a tile lands (small), sparkles on the active marker / a picked-up 1x1 (small), a gold burst on a
 * treasure (medium), confetti for the 7x7 bonus (large). Every system is a one-shot burst that removes itself.
 */
export type VfxKind = 'dust' | 'sparkle' | 'gold' | 'confetti';

let batch: BatchedRenderer | null = null;
let scene: THREE.Scene | null = null;

function spriteTexture(draw: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  draw(cv.getContext('2d')!, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const TEX = {
  glow: () => spriteTexture((c, s) => { const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, s, s); }),
  star: () => spriteTexture((c, s) => {
    c.fillStyle = '#fff'; c.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.12 : s * 0.48, a = -Math.PI / 2 + (i * Math.PI) / 4; c.lineTo(s / 2 + r * Math.cos(a), s / 2 + r * Math.sin(a)); }
    c.closePath(); c.fill();
  }),
  puff: () => spriteTexture((c, s) => { const g = c.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2); c.fill(); }),
  chip: () => spriteTexture((c, s) => { c.fillStyle = '#fff'; c.fillRect(s * 0.25, s * 0.1, s * 0.5, s * 0.8); }),
};
let textures: Record<keyof typeof TEX, THREE.Texture> | null = null;

const rgba = (hex: string, a = 1) => { const c = new THREE.Color(hex); return new QVector4(c.r, c.g, c.b, a); };
const fadeOut = () => new ColorOverLife(new Gradient([[new QVector3(1, 1, 1), 0], [new QVector3(1, 1, 1), 1]], [[1, 0], [1, 0.6], [0, 1]]));
const shrink = () => new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.9, 0.6, 0), 0]]));
const grow = () => new SizeOverLife(new PiecewiseBezier([[new Bezier(0.5, 1, 1.3, 1.5), 0]]));

function system(kind: VfxKind, scale: number): ParticleSystem {
  const tx = textures!;
  const mat = (map: THREE.Texture, additive: boolean) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const burst = (n: number) => [{ time: 0, count: new ConstantValue(n), cycle: 1, interval: 0.01, probability: 1 }];
  const base = { looping: false, autoDestroy: true, worldSpace: true, emissionOverTime: new ConstantValue(0), renderMode: RenderMode.BillBoard };
  switch (kind) {
    case 'dust': return new ParticleSystem({
      ...base, duration: 0.6, shape: new CircleEmitter({ radius: 0.45 * scale, thickness: 0.2 }),
      startLife: new IntervalValue(0.35, 0.6), startSpeed: new IntervalValue(1.2 * scale, 2.6 * scale), startSize: new IntervalValue(0.25 * scale, 0.5 * scale),
      startColor: new ConstantColor(rgba('#FFF1D0', 0.85)), emissionBursts: burst(14), material: mat(tx.puff, false), behaviors: [fadeOut(), grow()],
    });
    case 'sparkle': return new ParticleSystem({
      ...base, duration: 0.7, shape: new CircleEmitter({ radius: 0.3 * scale, thickness: 1 }),
      startLife: new IntervalValue(0.4, 0.8), startSpeed: new IntervalValue(0.6 * scale, 1.6 * scale), startSize: new IntervalValue(0.18 * scale, 0.36 * scale),
      startRotation: new IntervalValue(0, Math.PI), startColor: new ConstantColor(rgba('#FFE680')), emissionBursts: burst(12), material: mat(tx.star, true),
      behaviors: [fadeOut(), shrink(), new RotationOverLife(new IntervalValue(-4, 4))],
    });
    case 'gold': return new ParticleSystem({
      ...base, duration: 1, shape: new CircleEmitter({ radius: 0.15, thickness: 1 }),
      startLife: new IntervalValue(0.5, 0.9), startSpeed: new IntervalValue(2.5, 5), startSize: new IntervalValue(0.2, 0.42),
      startRotation: new IntervalValue(0, Math.PI), startColor: new ConstantColor(rgba('#FFC93C')), emissionBursts: burst(26), material: mat(tx.star, true),
      behaviors: [fadeOut(), shrink(), new ApplyForce(new QVector3(0, -1, 0), new ConstantValue(7)), new RotationOverLife(new IntervalValue(-6, 6))],
    });
    case 'confetti': {
      const ps = new ParticleSystem({
        ...base, duration: 1.8, shape: new SphereEmitter({ radius: 0.5, thickness: 1 }),
        startLife: new IntervalValue(1.1, 1.8), startSpeed: new IntervalValue(5, 10), startSize: new IntervalValue(0.25, 0.45),
        startRotation: new IntervalValue(0, Math.PI), startColor: new ConstantColor(rgba('#F5C531')), emissionBursts: burst(16), material: mat(tx.chip, false),
        behaviors: [fadeOut(), new ApplyForce(new QVector3(0, -1, 0), new ConstantValue(9)), new RotationOverLife(new IntervalValue(-8, 8))],
      });
      return ps;
    }
  }
}

/** Fire a one-shot effect at a world position (the board / track plane). `scale` shrinks it for the small opponent board. */
export function vfx(kind: VfxKind, x: number, y: number, z = 0.7, scale = 1) {
  if (!batch || !scene || !textures || useStore.getState().settings.reduceMotion) return;
  const add = (ps: ParticleSystem) => { ps.emitter.position.set(x, y, z); batch!.addSystem(ps); scene!.add(ps.emitter); };
  if (kind === 'confetti') {
    // one system per colour, so the confetti is multi-coloured
    for (const col of ['#D8322E', '#F5C531', '#1BA3B8', '#4E9A3A', '#E86CA5']) {
      const ps = system('confetti', scale);
      ps.startColor = new ConstantColor(rgba(col));
      ps.emissionBursts = [{ time: 0, count: new ConstantValue(16), cycle: 1, interval: 0.01, probability: 1 }];
      add(ps);
    }
    return;
  }
  add(system(kind, scale));
}

/** Owns the batched particle renderer; lives inside the R3F canvas. */
export function VfxLayer() {
  const { scene: sc } = useThree();
  const renderer = useMemo(() => new BatchedRenderer(), []);
  useEffect(() => {
    textures = textures ?? { glow: TEX.glow(), star: TEX.star(), puff: TEX.puff(), chip: TEX.chip() };
    sc.add(renderer);
    batch = renderer; scene = sc;
    return () => { sc.remove(renderer); if (batch === renderer) { batch = null; scene = null; } };
  }, [sc, renderer]);
  useFrame((_, dt) => renderer.update(Math.min(dt, 0.05)));
  return null;
}

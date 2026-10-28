#!/usr/bin/env node
// SYNTHETIC REFERENCE GENERATOR — held out from reconstruction authoring.
// Authoring agents must work from the encoded clips in ../clips/ only.
// Usage: node tests/fixtures/synthetic/generator/clips.mjs [orbit-loop|dusk-hill|cube-3d|all]
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hex, ease } from './raster.mjs';
import { encodeClip } from './encode.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'clips');
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const mod = (a, n) => ((a % n) + n) % n;
const uniform = (dur, fps) => Array.from({ length: Math.round(dur * fps) }, (_, i) => i / fps);

// ---------------------------------------------------------------- orbit-loop
// Graphic loop, 4 s, constant 30 fps.
const orbit = {
  width: 640, height: 360, duration: 4,
  frameTimes: uniform(4, 30),
  draw(r, t) {
    r.vgradient(hex('#0f1424'), hex('#1d2547'));
    const cx = 320, cy = 180;
    // breathing ring: 2 s ping-pong, sine ease
    const p = mod(t, 2);
    const k = ease.inOutSine(p < 1 ? p : 2 - p);
    r.ring(cx, cy, 64 + 10 * k, 6, hex('#4fd1c5'));
    r.circle(cx, cy, 22, hex('#2b3a67'));
    // orbiting dot: clockwise, linear, starts at 12 o'clock
    const th = -Math.PI / 2 + (2 * Math.PI * t) / 4;
    r.circle(cx + 112 * Math.cos(th), cy + 112 * Math.sin(th), 11, hex('#ff6b4a'));
    // staggered bars: 2 s period, rise out-cubic, fall in-cubic, rest
    [0, 0.25, 0.5].forEach((delay, i) => {
      const u = mod(t - delay, 2);
      let b = 0;
      if (u < 0.45) b = ease.outCubic(u / 0.45);
      else if (u < 1.1) b = 1 - ease.inCubic((u - 0.45) / 0.65);
      const h = 24 + 72 * b;
      r.rrect(500 + 28 * i, 292 - h / 2, 16, h, 4, 0, hex('#f6c445'));
    });
    // ticking square: quarter turn each second over 0.3 s, then hold
    const step = Math.floor(t) + ease.inOutQuad(clamp01(mod(t, 1) / 0.3));
    const a = (Math.PI / 2) * step;
    r.rrect(120, 180, 56, 56, 6, a, hex('#8b7cf6'));
    const mx = 16 * Math.cos(a) - -16 * Math.sin(a), my = 16 * Math.sin(a) + -16 * Math.cos(a);
    r.circle(120 + mx, 180 + my, 6, hex('#ffffff'));
  },
};

// ----------------------------------------------------------------- dusk-hill
// Layered illustration, 5 s one-shot with a final hold, VARIABLE frame rate:
// 30 fps except 24 fps between 2.0 s and 3.5 s.
function vfrTimes() {
  const ts = [];
  let t = 0;
  while (t < 5 - 1e-9) {
    ts.push(Math.round(t * 90000) / 90000);
    t += t >= 2 - 1e-9 && t < 3.5 - 1e-9 ? 1 / 24 : 1 / 30;
  }
  return ts;
}
const dusk = {
  width: 640, height: 360, duration: 5,
  frameTimes: vfrTimes(),
  draw(r, t) {
    r.vgradient(hex('#3b4a8c'), hex('#f2a65a'));
    r.circle(420, 110 + 150 * ease.inOutQuad(clamp01(t / 4.5)), 34, hex('#ffd27a'));
    r.shape(() => -1, [0, 0, 640, 360], hex('#141b3a'), 0.5 * ease.inQuad(clamp01((t - 1) / 3.5)));
    r.ellipse(430, 330, 330, 110, hex('#5b4a7a'));
    r.ellipse(150, 380, 320, 120, hex('#2f3a5c'));
    // windmill: tower, decelerating blades around the hub
    r.polygon([[156, 268], [184, 268], [176, 190], [164, 190]], hex('#e8e2d0'));
    const phi = (Math.PI / 180) * 540 * ease.outQuad(clamp01(t / 4.5));
    for (let i = 0; i < 4; i++) {
      const a = phi + (i * Math.PI) / 2;
      r.rrect(170 + 35 * Math.sin(a), 192 - 35 * Math.cos(a), 12, 70, 5, a, hex('#c9c1ad'));
    }
    r.circle(170, 192, 6, hex('#8a7f6a'));
    // bird: linear crossing 0.5–4.0 s with a vertical bob and flapping wings
    if (t >= 0.5 && t <= 4.0) {
      const bx = -20 + 680 * ((t - 0.5) / 3.5);
      const by = 120 + 10 * Math.sin((2 * Math.PI * (t - 0.5)) / 0.8);
      const w = (Math.PI / 180) * (25 + 15 * Math.sin((2 * Math.PI * t) / 0.4));
      r.rrect(bx - 7 * Math.cos(w), by - 7 * Math.sin(w), 16, 4, 2, w, hex('#1a1a2e'));
      r.rrect(bx + 7 * Math.cos(w), by - 7 * Math.sin(w), 16, 4, 2, -w, hex('#1a1a2e'));
    }
  },
};

// ------------------------------------------------------------------- cube-3d
// Perspective cube, 6 s loop, constant 30 fps. Projection done here by hand.
const FACES = [
  { n: [0, 0, 1], c: '#e8505b' }, { n: [1, 0, 0], c: '#f9d56e' },
  { n: [0, 0, -1], c: '#14b1ab' }, { n: [-1, 0, 0], c: '#4a6fe3' },
  { n: [0, -1, 0], c: '#f3ecc2' }, { n: [0, 1, 0], c: '#8e5bd6' },
];
function faceVerts(n, h) {
  // four corners of the face with outward normal n, half-size h (y down)
  const [nx, ny, nz] = n;
  const u = nx !== 0 ? [0, 1, 0] : [1, 0, 0];
  const v = [ny * u[2] - nz * u[1], nz * u[0] - nx * u[2], nx * u[1] - ny * u[0]];
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) =>
    [0, 1, 2].map((k) => n[k] * h + u[k] * a * h + v[k] * b * h));
}
const cube = {
  width: 640, height: 360, duration: 6,
  frameTimes: uniform(6, 30),
  draw(r, t) {
    r.vgradient(hex('#1b1f2a'), hex('#0d1016'));
    const p = mod(t, 3) / 1.5;
    const bob = ease.inOutSine(p < 1 ? p : 2 - p);
    r.ellipse(320, 300, 90 - 14 * bob, 14, hex('#000000'), 0.35);
    const yaw = (2 * Math.PI * t) / 6, pitch = (-22 * Math.PI) / 180, d = 700;
    const cx = 320, cy = 165 - 14 * bob;
    const xf = ([x, y, z]) => {
      const x1 = x * Math.cos(yaw) + z * Math.sin(yaw), z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
      const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch), z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
      return [x1, y2, z2];
    };
    const proj = ([x, y, z]) => {
      const X = cx + x, Y = cy + y, s = d / (d - z);
      return [320 + (X - 320) * s, 180 + (Y - 180) * s];
    };
    const faces = FACES.map((f) => {
      const w = faceVerts(f.n, 55).map(xf);
      const nz = xf(f.n)[2];
      return { c: f.c, w, nz, z: w.reduce((s, q) => s + q[2], 0) / 4 };
    }).filter((f) => f.nz > 0.02).sort((a, b) => a.z - b.z);
    for (const f of faces) r.polygon(f.w.map(proj), hex(f.c));
  },
};

const CLIPS = { 'orbit-loop': orbit, 'dusk-hill': dusk, 'cube-3d': cube };
const which = process.argv[2] || 'all';
mkdirSync(OUT, { recursive: true });
for (const [name, spec] of Object.entries(CLIPS)) {
  if (which !== 'all' && which !== name) continue;
  const out = join(OUT, `${name}.mp4`);
  const t0 = Date.now();
  await encodeClip({ out, ...spec });
  console.log(`${name}: ${spec.frameTimes.length} frames -> ${out} (${Date.now() - t0} ms)`);
}

// Seek correctness: positions measured from rendered pixels must match positions
// computed here by hand from the CSS timing model (not via the harness helpers).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { loadScene } from '../skills/video-to-css/scripts/lib/util.mjs';
import { launch, captureScene } from '../skills/video-to-css/scripts/lib/capture.mjs';
import { readPNG } from '../skills/video-to-css/scripts/lib/png.mjs';

const scene = loadScene(join(import.meta.dirname, 'fixtures', 'seek-scene'));

// Independent cubic-bezier evaluation (bisection on x, then y).
function bezier(x1, y1, x2, y2) {
  const c = (a, b, s) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  return (p) => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (c(x1, x2, m) < p) lo = m; else hi = m; }
    return c(y1, y2, (lo + hi) / 2);
  };
}
const easeInOut = bezier(0.42, 0, 0.58, 1);
const frac = (v) => v - Math.floor(v);

// Expected centroids (stage px) for the four fixture parts at scene time t.
function expected(t) {
  // A: 2s linear, delay 0.5s, 2 iterations, alternate, fill both
  let ax;
  const la = t - 0.5;
  if (la < 0) ax = 0;
  else if (la >= 4) ax = 0; // ends on reversed 2nd iteration
  else { const it = Math.floor(la / 2), p = (la % 2) / 2; ax = 300 * (it % 2 ? 1 - p : p); }
  // B: 1s ease-in-out, delay -0.75s, infinite
  const bx = 300 * easeInOut(frac(t + 0.75));
  // C: 2s steps(4, end), infinite
  const cx = 200 * (Math.floor(frac(t / 2) * 4) / 4);
  // D (::after): 1s linear, delay 0.2s, 1 iteration, reverse, fill forwards (no backwards fill)
  const ld = t - 0.2;
  const dy = ld < 0 || ld >= 1 ? 0 : 100 * (1 - ld);
  return { a: [10 + ax, 20], b: [10 + bx, 60], c: [10 + cx, 100], d: [380, 10 + dy] };
}

function centroid(img, rgb, roi) {
  let n = 0, sx = 0, sy = 0;
  const [x0, y0, w, h] = roi;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const i = (y * img.width + x) * 4;
    const d = Math.hypot(img.data[i] - rgb[0], img.data[i + 1] - rgb[1], img.data[i + 2] - rgb[2]);
    if (d < 60) { n++; sx += x + 0.5; sy += y + 0.5; }
  }
  return [sx / n, sy / n];
}
const KEYS = { a: [[255, 0, 0], [0, 0, 400, 40]], b: [[0, 0, 255], [0, 40, 400, 40]], c: [[0, 255, 0], [0, 80, 400, 40]], d: [[255, 255, 0], [360, 0, 40, 200]] };
const TIMES = [0, 0.3, 0.55, 0.9, 1.37, 2.1, 2.61, 3.33, 4.2, 4.6, 5.0];

for (const engine of ['chromium', 'webkit', 'firefox']) {
  test(`seek matches the CSS timing model (${engine})`, async (t) => {
    let session;
    try { session = await launch(engine); } catch (e) { t.skip(`${engine} not installed: ${String(e.message).split('\n')[0]}`); return; }
    const dir = mkdtempSync(join(tmpdir(), 'v2css-seek-'));
    try {
      const m = await captureScene(scene, TIMES.map((tt, k) => ({ k, t: tt })), dir, { session });
      let worst = 0;
      m.frames.forEach((f, i) => {
        const img = readPNG(f.file);
        const exp = expected(TIMES[i]);
        for (const [part, [rgb, roi]] of Object.entries(KEYS)) {
          const got = centroid(img, rgb, roi);
          const err = Math.hypot(got[0] - exp[part][0], got[1] - exp[part][1]);
          worst = Math.max(worst, err);
          assert.ok(err < 0.75, `${engine} t=${TIMES[i]} part ${part}: got ${got.map((v) => v.toFixed(2))}, expected ${exp[part].map((v) => v.toFixed(2))}`);
        }
      });
      t.diagnostic(`${engine} ${session.version}: worst centroid error ${worst.toFixed(3)} px over ${TIMES.length} times x 4 parts`);
    } finally {
      await session.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('repeated and reordered captures are pixel-identical (chromium)', async () => {
  const session = await launch('chromium');
  const dir = mkdtempSync(join(tmpdir(), 'v2css-det-'));
  try {
    const order1 = TIMES.map((tt, k) => ({ k, t: tt }));
    const order2 = [...order1].reverse();
    const m1 = await captureScene(scene, order1, join(dir, 'a'), { session });
    const m2 = await captureScene(scene, order2, join(dir, 'b'), { session });
    for (const f of m1.frames) {
      const g = m2.frames.find((x) => x.k === f.k);
      const A = readPNG(f.file).data, B = readPNG(g.file).data;
      let diff = 0;
      for (let i = 0; i < A.length; i++) diff = Math.max(diff, Math.abs(A[i] - B[i]));
      assert.equal(diff, 0, `t=${f.requested}: max channel difference ${diff} between capture orders`);
    }
  } finally {
    await session.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

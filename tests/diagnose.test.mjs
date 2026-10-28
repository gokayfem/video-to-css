// Iteration and diagnosis tools: frozen revisions stay immutable, the jump detector catches a planted
// pop and passes a good scene, attribution names the owning layer, line profiles find lines and halos
// but not clean edges, and the matched-time sheet / dense sheet / playback outputs are well-formed.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadScene, readJSON, run } from '../skills/video-to-css/scripts/lib/util.mjs';
import { launch } from '../skills/video-to-css/scripts/lib/capture.mjs';
import { freezeScene, verifyFrozen, jumps, attribute, profileStats, triptych, denseFrames, playback } from '../skills/video-to-css/scripts/lib/diagnose.mjs';

const root = resolve(import.meta.dirname, '..');
const orbitDir = join(root, 'tests', 'scenes', 'orbit-loop');
const tmp = mkdtempSync(join(tmpdir(), 'v2css-diag-'));
let session;

// A copy of the orbit scene outside the repo with one planted pop: a white veil that snaps on at
// half the loop (steps(1)), i.e. a one-frame jump the reference does not have.
function poppedCopy() {
  mkdirSync(join(tmp, '.git'), { recursive: true }); // project-root marker for artifacts/
  const dir = join(tmp, 'orbit-pop');
  cpSync(orbitDir, dir, { recursive: true });
  const sj = readJSON(join(dir, 'scene.json'));
  sj.reference.clip = join(root, sj.reference.clip);
  writeFileSync(join(dir, 'scene.json'), JSON.stringify(sj));
  appendFileSync(join(dir, 'scene', 'scene.css'), `
.v2c-orbit::after { content: ''; position: absolute; inset: 0; background: #fff; pointer-events: none;
  animation: v2c-orbit-pop var(--v2c-orbit-period) steps(1, end) infinite; }
@keyframes v2c-orbit-pop { 0% { opacity: 0; } 50% { opacity: 0.6; } 100% { opacity: 0.6; } }\n`);
  return loadScene(dir);
}

before(async () => { session = await launch('chromium', root); });
after(async () => { await session?.close(); rmSync(tmp, { recursive: true, force: true }); });

test('profileStats: clean edges and noise have no ridges; a dark line and a halo do', () => {
  assert.equal(profileStats([16, 20, 30, 50, 73, 90, 110, 130, 150, 160, 160]).ridges.length, 0, 'monotonic edge');
  assert.equal(profileStats([20, 24, 19, 23, 60, 100, 140, 144, 139, 145, 141]).ridges.length, 0, '±3 noise');
  assert.equal(profileStats([30, 31, 30, 31, 30, 31, 30, 31, 180, 180]).ridges.length, 0, 'fine stripes');
  const line = profileStats([16, 20, 40, 73, 73, 60, 60, 84, 120, 160, 160]);
  assert.ok(line.ridges.some((r) => r.kind === 'dip' && r.prominence >= 13), 'a 2 px dark line inside a lit→dark transition');
  const halo = profileStats([30, 30, 32, 35, 120, 180, 150, 150, 150]);
  assert.ok(halo.ridges.some((r) => r.kind === 'peak' && r.prominence >= 30), 'a 1 px pale halo');
  assert.equal(profileStats([10, 10, 10, 90, 170, 170]).transition, 1);
});

test('freeze: immutable copy, intact hashes, tamper detected, clip still resolves', () => {
  const scene = loadScene(orbitDir);
  const rev = `t${Date.now()}`;
  const f = freezeScene(scene, { rev, log: () => {} });
  try {
    assert.deepEqual(verifyFrozen(f.dir), []);
    const frozen = loadScene(f.dir);
    assert.ok(existsSync(frozen.clipPath), 'reference clip resolves from the frozen copy');
    assert.equal(frozen.frozen.rev, rev);
    assert.throws(() => freezeScene(scene, { rev, log: () => {} }), /immutable/);
    appendFileSync(join(f.dir, 'scene', 'scene.css'), '/* edit */');
    assert.deepEqual(verifyFrozen(f.dir), ['scene/scene.css']);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('jumps: a good scene has no flagged frames; a planted pop is flagged at its frame', async () => {
  const good = await jumps(session, loadScene(orbitDir));
  assert.equal(good.flagged.length, 0, JSON.stringify(good.top));
  const popped = await jumps(session, poppedCopy());
  assert.ok(popped.flagged.some((f) => Math.abs(f.t - 2) < 0.05), `pop at 2 s flagged: ${JSON.stringify(popped.flagged)}`);
});

test('attribute: the hub layer owns the ring centre', async () => {
  const r = await attribute(session, loadScene(orbitDir), { t: 1, points: [[320, 180]] });
  assert.match(r.byPoint[0].owners[0]?.layer ?? '', /hub/);
});

test('triptych, dense frames and playback produce well-formed outputs', async () => {
  const scene = loadScene(orbitDir);
  const out = join(tmp, 'sheets');
  mkdirSync(out, { recursive: true });
  await triptych(session, scene, { prev: scene, times: [0, 1], crop: [200, 60, 240, 240], out: join(out, 'tri.png') });
  assert.ok(existsSync(join(out, 'tri.png')));
  const d = await denseFrames(session, scene, { from: 0.9, to: 0.95, step: 1 / 120, out: join(out, 'dense.png') });
  assert.equal(d.times.length, 7);
  const p = await playback(session, scene, { prev: scene, out: join(out, 'play.mp4'), width: 320 });
  assert.deepEqual(p.columns, ['reference', 'previous', 'scene']);
  const probe = await run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=width,nb_read_frames', '-of', 'csv=p=0', join(out, 'play.mp4')]);
  const [w, n] = probe.trim().split(',').map(Number);
  assert.equal(w, 960);
  assert.ok(Math.abs(n - p.frames) <= 1, `${n} encoded frames for ${p.frames} reference frames`);
});

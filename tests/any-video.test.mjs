// Input-agnostic intake: clips made here with ffmpeg in formats the examples do not cover
// (rotation metadata, non-square pixels, GIF palette, WebM with 1 ms timestamps, long clips)
// must be scaffolded at the size a player shows, and a scene for a rotated portrait clip in a
// folder outside this repository must pass the full check.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, loadScene, readJSON } from '../skills/video-to-css/scripts/lib/util.mjs';
import { inspectClip } from '../skills/video-to-css/scripts/lib/video.mjs';
import { readPNG } from '../skills/video-to-css/scripts/lib/png.mjs';
import { initScene } from '../skills/video-to-css/scripts/lib/init.mjs';
import { runCheck } from '../skills/video-to-css/scripts/lib/checkall.mjs';

const dir = mkdtempSync(join(tmpdir(), 'v2css-any-'));
const clip = (n) => join(dir, n);
const ff = (...a) => run('ffmpeg', ['-v', 'error', '-y', ...a]);
const quiet = () => {};

before(async () => {
  mkdirSync(join(dir, '.git')); // marks the project root for artifacts/
  // 640x360 landscape: red marker top-left, white 60 px box sliding right at 100 px/s, 25 fps, 3 s
  await ff('-f', 'lavfi', '-i', 'color=c=0x2a4d7a:s=640x360:r=25:d=3', '-f', 'lavfi', '-i', 'color=c=white:s=60x60:r=25:d=3',
    '-filter_complex', "[0]drawbox=x=0:y=0:w=40:h=40:c=red:t=fill[bg];[bg][1]overlay=x='100+t*100':y=150",
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', clip('base.mp4'));
  await ff('-display_rotation', '90', '-i', clip('base.mp4'), '-c', 'copy', clip('rotated.mp4')); // phone-style portrait
  await ff('-f', 'lavfi', '-i', 'color=c=0x2a4d7a:s=480x360:r=24:d=2', '-vf', 'drawbox=x=0:y=0:w=30:h=40:c=red:t=fill,setsar=4/3',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', clip('anamorphic.mp4'));
  await ff('-i', clip('base.mp4'), '-t', '2', '-vf', 'fps=12,scale=320:-1', clip('anim.gif'));
  await ff('-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=60:d=12', '-c:v', 'libvpx-vp9', '-b:v', '400k', '-deadline', 'realtime', '-cpu-used', '8', clip('long.webm'));
});

test('display size follows rotation and pixel aspect; timestamp rounding is not VFR', async () => {
  const rot = await inspectClip(clip('rotated.mp4'));
  assert.deepEqual([rot.width, rot.height, rot.coded.width, rot.coded.height, Math.abs(rot.rotation)], [360, 640, 640, 360, 90]);
  const ana = await inspectClip(clip('anamorphic.mp4'));
  assert.deepEqual([ana.width, ana.height], [640, 360]);
  const gif = await inspectClip(clip('anim.gif'));
  assert.equal(gif.variableFrameRate, false, 'GIF centisecond rounding');
  const webm = await inspectClip(clip('long.webm'));
  assert.equal(webm.variableFrameRate, false, 'WebM millisecond rounding');
  assert.equal(webm.frameCount, 720);
});

test('init scaffolds each clip at display size with a correct loop guess', async () => {
  const cases = [
    ['rotated.mp4', {}, [360, 640], false],
    ['anamorphic.mp4', {}, [640, 360], true], // static picture: seam equals a normal step
    ['anim.gif', {}, [320, 180], false],
    ['long.webm', { start: 2, duration: 8 }, [640, 360], false],
  ];
  for (const [name, o, size, loop] of cases) {
    const r = await initScene(clip(name), { out: join(dir, 'scenes', name.replace('.', '-')), log: quiet, ...o });
    assert.deepEqual([r.scene.stage.width, r.scene.stage.height], size, name);
    assert.equal(r.scene.timing.loop, loop, `${name} loop guess (seam ratio ${r.seamRatio})`);
    const first = readPNG(join(dir, 'artifacts', r.scene.id, 'init', 'frames', readdir1(join(dir, 'artifacts', r.scene.id, 'init', 'frames'))));
    assert.deepEqual([first.width, first.height], size, `${name} decoded frame size`);
  }
  // rotation is applied the way players show it: the top-left marker ends up bottom-left
  const f = readPNG(join(dir, 'artifacts', 'rotated', 'init', 'frames', '00000.png'));
  const px = (x, y) => Array.from(f.data.subarray((y * f.width + x) * 4, (y * f.width + x) * 4 + 3));
  assert.ok(px(10, 630)[0] > 200 && px(10, 630)[1] < 60, `bottom-left is red: ${px(10, 630)}`);
  assert.ok(px(10, 10)[0] < 100, 'top-left is background');
  const long = readJSON(join(dir, 'scenes', 'long-webm', 'scene.json'));
  assert.deepEqual([long.timing.offset, long.timing.duration], [2, 8]);
});

test('a scene for the rotated clip, outside the repo, passes all four outcomes', async () => {
  const sd = join(dir, 'scenes', 'rotated-mp4');
  const html = join(sd, 'scene', 'index.html'), css = join(sd, 'scene', 'scene.css');
  writeFileSync(html, readFileSync(html, 'utf8').replace(/ *<!-- parts go here.*-->/, '  <i class="v2c-rotated__marker"></i>\n  <i class="v2c-rotated__box"></i>'));
  writeFileSync(css, readFileSync(css, 'utf8')
    .replace(/background: linear-gradient\([^;]*\);/, '--v2c-rotated-box: #ffffff;\n  background: #2a4e7b;')
    .replace('\n@media', `
.v2c-rotated .v2c-rotated__marker { position: absolute; left: 0; top: 600px; width: 40px; height: 40px; background: #fe0000; }
.v2c-rotated .v2c-rotated__box { position: absolute; left: 150px; top: 0; width: 60px; height: 60px; background: var(--v2c-rotated-box);
  animation: v2c-rotated-rise var(--v2c-rotated-loop) linear both; }
@keyframes v2c-rotated-rise { from { transform: translateY(480px); } to { transform: translateY(180px); } }
\n@media`));
  const sj = readJSON(join(sd, 'scene.json'));
  sj.controls.push({ name: '--v2c-rotated-box', kind: 'runtime', type: 'color', default: '#ffffff', range: null, variant: '#ffcc00', description: 'box colour' });
  sj.tracks = [{ part: 'box', selector: '.v2c-rotated__box', color: '#ffffff', tolerance: 60, roi: [0, 0, 360, 640] }];
  writeFileSync(join(sd, 'scene.json'), JSON.stringify(sj, null, 2));
  const r = await runCheck(loadScene(sd), { log: quiet });
  assert.deepEqual(r.outcomes, { structural: 'pass', appearance: 'pass', temporal: 'pass', editability: 'pass' });
  const neg = Object.fromEntries(r.negativeControls.detail.map((n) => [n.kind, n.status]));
  for (const k of ['frozen', 'shuffled', 'shifted', 'speed', 'misplaced']) assert.equal(neg[k], 'caught', k);
});

const readdir1 = (d) => readdirSync(d).sort()[0];

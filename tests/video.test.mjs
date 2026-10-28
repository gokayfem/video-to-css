// Video ingestion: PTS handling (including VFR), presentation-time lookup, decoding.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { inspectClip, frameAt, extractFrames } from '../skills/video-to-css/scripts/lib/video.mjs';
import { readPNG } from '../skills/video-to-css/scripts/lib/png.mjs';

const clips = join(import.meta.dirname, 'fixtures', 'synthetic', 'clips');

test('VFR clip: actual PTS are used, not index/fps', async () => {
  const s = await inspectClip(join(clips, 'dusk-hill.mp4'));
  assert.equal(s.frameCount, 141);
  assert.equal(s.variableFrameRate, true);
  assert.ok(Math.abs(s.frames[60].pts - 2.0) < 1e-5);
  assert.ok(Math.abs(s.frames[61].pts - (2 + 1 / 24)) < 1e-5, `frame 61 pts ${s.frames[61].pts}`);
  assert.ok(Math.abs(s.frames[96].pts - 3.5) < 1e-5);
  // index/fps would claim frame 96 is at 3.2 s
  assert.ok(Math.abs(s.frames[96].pts - 96 / 30) > 0.25);
  // presentation lookup: last frame with pts <= t
  assert.equal(frameAt(s, 2.03).index, 60);
  assert.equal(frameAt(s, 2.0417).index, 61);
  assert.equal(frameAt(s, 4.999).index, 140);
});

test('CFR clip facts and colour decoding', async () => {
  const s = await inspectClip(join(clips, 'orbit-loop.mp4'));
  assert.equal(s.frameCount, 120);
  assert.equal(s.variableFrameRate, false);
  assert.equal(s.width, 640);
  assert.equal(s.color.space, 'bt709');
  const dir = mkdtempSync(join(tmpdir(), 'v2css-ext-'));
  try {
    const r = await extractFrames(s, [{ t: 0 }, { t: 0.05 }], dir);
    assert.equal(r.entries[1].index, 1, '0.05 s shows the frame presented at 0.0333 s');
    assert.ok(Math.abs(r.entries[1].quantization + 0.016667) < 1e-4, 'quantization is logged');
    // flat interior of the purple tile (generator colour #8b7cf6) survives YUV 4:2:0 + BT.709 decode
    const img = readPNG(r.entries[0].file);
    const i = (190 * 640 + 110) * 4;
    const d = Math.hypot(img.data[i] - 0x8b, img.data[i + 1] - 0x7c, img.data[i + 2] - 0xf6);
    assert.ok(d < 6, `decoded colour distance ${d.toFixed(2)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Multiple instances and different scenes in one host page must not interfere,
// and every runtime control must visibly change the render.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { loadScene } from '../skills/video-to-css/scripts/lib/util.mjs';
import { withSession } from '../skills/video-to-css/scripts/lib/pipeline.mjs';
import { variantsScene } from '../skills/video-to-css/scripts/lib/variants.mjs';

const root = join(import.meta.dirname, '..');
const scenes = ['orbit-loop', 'dusk-hill', 'cube-3d'].map((e) => loadScene(join(root, 'tests', 'scenes', e)));

test('controls work and instances do not interfere (all scenes in one page)', async () => {
  await withSession('chromium', async (s) => {
    for (const scene of scenes) {
      const others = scenes.filter((o) => o !== scene);
      const r = await variantsScene(s, scene, { log: () => {}, others });
      const failed = r.results.filter((c) => c.outcome === 'fail').map((c) => `${c.check}=${JSON.stringify(c.value)}`);
      assert.deepEqual(failed, [], scene.id);
    }
  });
});

// The strict-profile audit must reject each planted violation and accept the examples.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { loadScene } from '../skills/video-to-css/scripts/lib/util.mjs';
import { launch } from '../skills/video-to-css/scripts/lib/capture.mjs';
import { auditScene } from '../skills/video-to-css/scripts/lib/audit.mjs';

const root = join(import.meta.dirname, '..');

test('audit rejects planted violations', async () => {
  const session = await launch('chromium');
  try {
    const scene = loadScene(join(root, 'tests', 'fixtures', 'bad-scene'));
    const r = await auditScene(session, scene, { outDir: join(root, 'artifacts', 'bad', 'audit') });
    const failed = new Set(r.results.filter((c) => c.outcome === 'fail').map((c) => c.check));
    for (const expected of [
      'dom.forbiddenElements', // svg, canvas, script
      'dom.eventHandlerAttributes', // onclick
      'cssom.noUrlValues', // url(data:...) and image-set() inside @media
      'computed.noUrlValues',
      'namespace.selectors', // bare `div`
      'namespace.keyframes', // `spin`
      'namespace.customProperties', // --stray-prop
      'reducedMotion.static', // no reduced-motion rule
    ]) assert.ok(failed.has(expected), `expected ${expected} to fail; failed: ${[...failed].join(', ')}`);
    assert.equal(r.outcome, 'fail');
  } finally {
    await session.close();
  }
});

test('audit accepts the calibration scenes', async () => {
  const session = await launch('chromium');
  try {
    for (const ex of ['orbit-loop', 'dusk-hill', 'cube-3d']) {
      const r = await auditScene(session, loadScene(join(root, 'tests', 'scenes', ex)));
      const failed = r.results.filter((c) => c.outcome === 'fail').map((c) => `${c.check} ${JSON.stringify(c.value)}`);
      assert.deepEqual(failed, [], ex);
    }
  } finally {
    await session.close();
  }
});

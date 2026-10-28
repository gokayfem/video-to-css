// Every example: the authored scene passes appearance + temporal gates, and every
// planted-error candidate is rejected by the check family it targets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { loadScene } from '../skills/video-to-css/scripts/lib/util.mjs';
import { prepareReference, runCandidate, withSession, NEGATIVE_CONTROLS } from '../skills/video-to-css/scripts/lib/pipeline.mjs';
import { after } from 'node:test';

// every control kind must be caught in at least one example; none may be "missed"
// (uncaught although the planted error exceeds the smallest declared gate)
const caughtSomewhere = new Set();
after(() => {
  for (const k of Object.keys(NEGATIVE_CONTROLS)) assert.ok(caughtSomewhere.has(k), `${k} was not caught in any example`);
});

const root = join(import.meta.dirname, '..');
const quiet = () => {};

for (const ex of ['orbit-loop', 'dusk-hill', 'cube-3d']) {
  test(`${ex}: good candidate passes, negative controls are caught`, async (t) => {
    const scene = loadScene(join(root, 'tests', 'scenes', ex));
    const ref = await prepareReference(scene, { log: quiet });
    await withSession('chromium', async (s) => {
      const good = await runCandidate(scene, ref, { session: s, log: quiet, sheet: false });
      assert.equal(good.outcomes.appearance, 'pass', 'appearance');
      assert.equal(good.outcomes.temporal, 'pass', `temporal: ${good.temporal.filter((c) => c.outcome === 'fail').map((c) => c.check)}`);
      for (const kind of Object.keys(NEGATIVE_CONTROLS)) {
        const r = await runCandidate(scene, ref, { label: `neg-${kind}`, kind, session: s, log: quiet, sheet: false });
        const nc = r.negativeControl;
        assert.notEqual(nc.status, 'missed', `${kind}: planted p90 ${nc.plantedP90Px} px >= floor ${nc.floorPx} px but not caught (failed: ${nc.failedChecks})`);
        if (nc.caught) caughtSomewhere.add(kind);
        t.diagnostic(`${kind}: ${nc.status} (planted p90 ${nc.plantedP90Px} px)${nc.caught ? ' by ' + nc.failedChecks.filter((c) => nc.expectFailIn.some((e) => c.startsWith(e))).slice(0, 3).join(', ') : ''}`);
      }
    });
  });
}

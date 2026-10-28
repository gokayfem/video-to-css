// One command for a scene: structural audit, reference comparison, negative
// controls, editability/embedding, review page. Four outcomes, never merged.
import { writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { auditScene } from './audit.mjs';
import { prepareReference, runCandidate, withSession, negativeKinds, animationSensitivity } from './pipeline.mjs';
import { variantsScene } from './variants.mjs';
import { buildReview } from './review.mjs';
import { writeJSON } from './util.mjs';

export async function runCheck(scene, { engine = 'chromium', log = console.log, negatives = true, others = [] } = {}) {
  log(`== ${scene.id}: ${scene.title}${scene.synthetic ? ' [synthetic reference]' : ''}`);
  const ref = await prepareReference(scene, { log });
  const summary = await withSession(engine, async (s) => {
    log('-- audit');
    const audit = await auditScene(s, scene);
    for (const c of audit.results.filter((r) => r.outcome === 'fail')) log(`  FAIL ${c.check} ${JSON.stringify(c.value)}`);
    log(`  structural ${audit.outcome}`);
    log('-- compare');
    const cmp = await runCandidate(scene, ref, { session: s, log });
    const neg = [];
    if (negatives) {
      log('-- negative controls');
      for (const k of negativeKinds(scene)) neg.push(await runCandidate(scene, ref, { label: `neg-${k}`, kind: k, session: s, log, sheet: false }));
    }
    let sens = null;
    if (negatives) {
      log('-- per-animation sensitivity (+0.1 s, one animation at a time)');
      sens = await animationSensitivity(scene, ref, { session: s, offset: 0.1, log });
    }
    log('-- editability / embedding');
    const vr = await variantsScene(s, scene, { log, others });
    return { audit, cmp, neg, vr, sens };
  }, scene.root);
  const review = await buildReview(scene);
  const { audit, cmp, neg, vr, sens } = summary;
  const caught = neg.filter((r) => r.negativeControl.caught).length;
  const out = {
    scene: scene.id, synthetic: !!scene.synthetic, engine,
    outcomes: { structural: audit.outcome, appearance: cmp.outcomes.appearance, temporal: cmp.outcomes.temporal, editability: vr.outcome },
    negativeControls: neg.length ? { caught, total: neg.length, belowFloor: neg.filter((r) => r.negativeControl.status === 'below-floor').length, missed: neg.filter((r) => r.negativeControl.status === 'missed').length, detail: neg.map((r) => ({ kind: r.negativeControl.kind, status: r.negativeControl.status, plantedP90Px: r.negativeControl.plantedP90Px, failed: r.negativeControl.failedChecks.slice(0, 6) })) } : null,
    sensitivity: sens ? { offset: sens.offset, detected: sens.detected, total: sens.total, undetected: sens.rows.filter((r) => !r.caught).map((r) => r.animation) } : null,
    review: relative(scene.root, review),
  };
  writeJSON(join(scene.artifacts, 'summary.json'), out);
  const a = (p) => relative(scene.root, join(scene.artifacts, p));
  writeFileSync(join(scene.artifacts, 'SUMMARY.md'), `# ${scene.title} — check summary

${scene.synthetic ? '> Synthetic reference fixture: this validates the harness and authoring loop, not reconstruction quality on external footage.\n' : ''}
| outcome | result | evidence |
|---|---|---|
| structural validity (strict profile audit) | **${out.outcomes.structural}** | \`${a('audit/audit.json')}\` |
| appearance | **${out.outcomes.appearance}** | \`${a('compare/candidate/report.md')}\`, \`sheet.png\` |
| temporal fidelity | **${out.outcomes.temporal}** | \`${a('compare/candidate/report.md')}\`, \`tracks.png\` |
| editability (controls, embedding) | **${out.outcomes.editability}** | \`${a('variants/variants.json')}\`, \`sheet.png\` |

Negative controls caught: ${out.negativeControls ? `${caught}/${neg.length}` : 'not run'}
${(out.negativeControls?.detail ?? []).map((d) => `- ${d.kind}: ${d.status === 'missed' ? '**MISSED**' : d.status} (planted p90 ${d.plantedP90Px} px; ${d.failed.join(', ') || 'no check failed'})`).join('\n')}

Per-animation sensitivity (one animation shifted +${out.sensitivity?.offset ?? '–'} s at a time): ${out.sensitivity ? `${out.sensitivity.detected}/${out.sensitivity.total} detected` : 'not run'}
${(out.sensitivity?.undetected ?? []).map((a) => `- not detected: ${a}`).join('\n')}

Review page: \`${out.review}\`
`);
  log(`== ${scene.id}: structural ${out.outcomes.structural} | appearance ${out.outcomes.appearance} | temporal ${out.outcomes.temporal} | editability ${out.outcomes.editability} | controls caught ${caught}/${neg.length}`);
  out.ok = Object.values(out.outcomes).every((v) => v === 'pass') && !neg.some((r) => r.negativeControl.status === 'missed');
  return out;
}

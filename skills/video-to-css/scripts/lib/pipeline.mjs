// Inspect -> extract -> capture -> compare -> evidence, for one scene package.
import { existsSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { inspectClip, extractFrames } from './video.mjs';
import { captureScene, launch } from './capture.mjs';
import { compareRun, diffImage, GATES } from './compare.mjs';
import { renderSheet, renderTrackPlot } from './sheet.mjs';
import { readJSON, writeJSON, ensureDir, fmt, pad } from './util.mjs';

// Reference frames for every decoded frame inside the scene's time window.
export async function prepareReference(scene, { log = console.log } = {}) {
  if (!scene.clipPath) throw new Error(`${scene.id}: scene.json has no reference.clip`);
  const dir = ensureDir(join(scene.artifacts, 'ref'));
  const src = await inspectClip(scene.clipPath);
  writeJSON(join(scene.artifacts, 'source.json'), src);
  const cached = join(dir, 'frames.json');
  if (existsSync(cached)) {
    const c = readJSON(cached);
    if (c.sha256 === src.sha256 && c.offset === (scene.timing.offset ?? 0) && c.duration === scene.timing.duration && c.maxSamples === (scene.reference.maxSamples ?? 480)) return { src, ...c };
  }
  const off = scene.timing.offset ?? 0;
  let times = src.frames
    .map((f) => f.pts - src.startPts)
    .filter((t) => t >= off - 1e-6 && t < off + scene.timing.duration - 1e-6);
  // Long or high-rate clips: keep every frame up to maxSamples, else an even subset of real frame
  // PTS (reference and candidate use the same times, so every check stays like-for-like).
  const maxSamples = scene.reference.maxSamples ?? 480;
  if (times.length > maxSamples) {
    const all = times;
    times = Array.from({ length: maxSamples }, (_, i) => all[Math.floor((i * all.length) / maxSamples)]);
    log(`  ${all.length} frames in the window; sampling ${maxSamples} of them (reference.maxSamples)`);
  }
  const requests = times.map((t) => ({ t }));
  log(`  extracting ${requests.length} reference frames (${src.variableFrameRate ? 'VFR' : 'CFR'}, PTS-exact)`);
  rmSync(join(dir, 'frames'), { recursive: true, force: true });
  const { color, entries } = await extractFrames(src, requests, join(dir, 'frames'));
  const out = { sha256: src.sha256, offset: off, duration: scene.timing.duration, maxSamples: scene.reference.maxSamples ?? 480, color, entries };
  writeJSON(cached, out);
  return { src, ...out };
}

const sceneTimeOf = (scene, e) => e.pts - (scene.timing.offset ?? 0);
const wrap = (scene, t) => (scene.timing.loop ? ((t % scene.timing.duration) + scene.timing.duration) % scene.timing.duration
  : Math.min(Math.max(t, 0), scene.timing.duration));

// Candidate kinds: good, frozen, shuffled, shifted, speed, misplaced, easing
export const NEGATIVE_CONTROLS = {
  frozen: { expect: ['temporal.motionEnergy', 'temporal.trajectory'], note: 'every sample is the scene captured at the first timestamp' },
  shuffled: { expect: ['temporal.motionEnergy', 'temporal.trajectory'], note: 'real rendered frames in a seeded random order' },
  shifted: { expect: ['temporal.phase'], note: 'scene captured 0.4 s late (cand(t) = scene(t + 0.4))' },
  speed: { expect: ['temporal.rate', 'temporal.phase'], note: 'scene captured at 1.25x speed (cand(t) = scene(1.25 t))' },
  misplaced: { expect: ['temporal.trajectory.{part}'], note: 'first track part displaced by translate: 24px 16px' },
  easing: { expect: ['temporal.timingShape', 'temporal.trajectory', 'temporal.extent'], note: 'every keyframe easing replaced with linear via Web Animations API' },
};

// Control kinds that apply to this scene ('misplaced' needs at least one track).
export const negativeKinds = (scene) => Object.keys(NEGATIVE_CONTROLS).filter((k) => k !== 'misplaced' || scene.tracks?.length);

export async function runCandidate(scene, ref, { label = 'candidate', kind = 'good', session, log = console.log, sheet = true, mutate = null, note = null } = {}) {
  const outDir = join(scene.artifacts, 'cand', label);
  rmSync(outDir, { recursive: true, force: true });
  const times = ref.entries.map((e) => ({ k: e.k, t: sceneTimeOf(scene, e) }));
  let opts = {};
  if (kind === 'shifted') opts.timeTransform = new Function('t', `return ${scene.timing.loop ? `((t + 0.4) % ${scene.timing.duration})` : `Math.min(t + 0.4, ${scene.timing.duration})`};`);
  if (kind === 'speed') opts.timeTransform = new Function('t', `return ${scene.timing.loop ? `((t * 1.25) % ${scene.timing.duration})` : `Math.min(t * 1.25, ${scene.timing.duration})`};`);
  if (kind === 'misplaced') opts.inject = `${scene.tracks[0].selector} { translate: 24px 16px !important; }`;
  if (kind === 'easing') opts.mutate = { linearEasing: true };
  if (mutate) opts.mutate = mutate;
  let manifest;
  if (kind === 'frozen') {
    manifest = await captureScene(scene, [times[0]], outDir, { session, label });
    const f0 = manifest.frames[0].file;
    manifest.frames = times.map(({ k, t }) => {
      const file = join(outDir, 'frames', `${pad(k, 5)}.png`);
      if (file !== f0) copyFileSync(f0, file);
      return { k, requested: fmt(t, 6), sceneTime: times[0].t, file };
    });
    manifest.mutate = 'frozen';
    writeJSON(join(outDir, 'manifest.json'), manifest);
  } else {
    manifest = await captureScene(scene, times, outDir, { session, label, ...opts });
  }
  if (kind === 'shuffled') {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const files = manifest.frames.map((f) => f.file);
    const perm = files.map((_, i) => i);
    for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    const tmp = files.map((f) => f + '.tmp');
    files.forEach((f, i) => copyFileSync(files[perm[i]], tmp[i]));
    tmp.forEach((t, i) => { copyFileSync(t, files[i]); rmSync(t); });
    manifest.mutate = { shuffled: { seed: 12345 } };
    writeJSON(join(outDir, 'manifest.json'), manifest);
  }

  // Loop seam captures at 0, D - dt and D (scene time), from the real scene.
  let seam = null;
  if (scene.timing.loop && kind === 'good') {
    const dt = ref.entries.length > 1 ? ref.entries[1].pts - ref.entries[0].pts : 1 / 30;
    const D = scene.timing.duration;
    const sm = await captureScene(scene, [{ k: 0, t: 0 }, { k: 1, t: D - dt }, { k: 2, t: D }], join(outDir, 'seam'), { session, label: `${label}-seam` });
    seam = { first: sm.frames[0].file, preLast: sm.frames[1].file, last: sm.frames[2].file };
  }

  const cmpDir = ensureDir(join(scene.artifacts, 'compare', label));
  const report = await compareRun({ scene, refEntries: ref.entries, candManifest: manifest, outDir: cmpDir, seam, label });
  report.kind = kind;
  if (kind === 'animOffset') {
    const failed = report.temporal.concat(report.appearance).filter((c) => c.outcome === 'fail').map((c) => c.check);
    report.negativeControl = { kind, note, expectFailIn: ['temporal.'], caught: report.outcomes.temporal === 'fail', failedChecks: failed };
  } else if (kind !== 'good') {
    const nc = NEGATIVE_CONTROLS[kind];
    const expect = nc.expect.map((e) => e.replace('{part}', scene.tracks[0].part));
    const failed = report.temporal.concat(report.appearance).filter((c) => c.outcome === 'fail').map((c) => c.check);
    const caught = expect.some((e) => failed.some((f) => f.startsWith(e)));
    // size of the planted error itself: candidate vs the good candidate, same tracks and times
    const planted = plantedMagnitude(scene, report);
    const floor = GATES.trajMedianFrac * Math.hypot(scene.stage.width, scene.stage.height);
    const status = caught ? 'caught' : planted !== null && planted < floor ? 'below-floor' : 'missed';
    report.negativeControl = { kind, note: nc.note, expectFailIn: expect, caught, status, plantedP90Px: planted, floorPx: +floor.toFixed(2), failedChecks: failed };
  }
  writeJSON(join(cmpDir, 'report.json'), report);
  writeFileSync(join(cmpDir, 'report.md'), reportMarkdown(scene, report, ref));
  if (sheet) await evidenceSheets(scene, ref, manifest, report, cmpDir, session);
  const nc = report.negativeControl;
  log(`  ${label}: appearance ${report.outcomes.appearance}, temporal ${report.outcomes.temporal}${nc ? `, control ${(nc.status ?? (nc.caught ? 'caught' : 'missed')).toUpperCase()}${nc.plantedP90Px != null ? ` (planted p90 ${nc.plantedP90Px} px)` : ''}` : ''}`);
  return report;
}

async function evidenceSheets(scene, ref, manifest, report, cmpDir, session) {
  const n = ref.entries.length, pick = Math.min(8, n);
  const idx = Array.from({ length: pick }, (_, i) => Math.round((i * (n - 1)) / Math.max(1, pick - 1)));
  const candByK = new Map(manifest.frames.map((f) => [f.k, f]));
  const rows = idx.map((i) => {
    const e = ref.entries[i], c = candByK.get(e.k);
    const d = join(cmpDir, `diff-${pad(e.k, 5)}.png`);
    diffImage(e.file, c.file, d);
    return { label: `ref t=${e.pts.toFixed(3)}s\nframe #${e.index}\nscene t=${Number(c.sceneTime).toFixed(3)}s`, cells: [e.file, c.file, d] };
  });
  await renderSheet(session, {
    title: `${scene.title} — ${report.label}${scene.synthetic ? ' [SYNTHETIC REFERENCE]' : ''}`,
    subtitle: `reference | candidate (${manifest.browser.engine} ${manifest.browser.version}) | |diff|×3 — appearance ${report.outcomes.appearance}, temporal ${report.outcomes.temporal}`,
    columns: ['reference (decoded)', 'candidate (browser)', '|diff| ×3'], rows, out: join(cmpDir, 'sheet.png'),
  });
  if (report.tracks.length) await renderTrackPlot(session, { title: `${scene.title} — tracks (${report.label})`, report, out: join(cmpDir, 'tracks.png') });
}

export function reportMarkdown(scene, r, ref) {
  const row = (c) => `| ${c.check} | ${c.outcome.toUpperCase()} | ${c.value} | ${c.gate ?? ''} | ${c.note ?? ''} |`;
  return `# ${scene.title} — ${r.label}

${scene.synthetic ? '> **Synthetic reference.** Validates the harness and authoring loop, not external-footage fidelity.\n' : ''}
- reference: \`${relative(scene.root, scene.clipPath)}\` sha256 \`${ref.sha256.slice(0, 16)}…\`, ${ref.entries.length} samples at decoded-frame PTS, colour ${ref.color.matrix}/${ref.color.range}${ref.color.assumed ? ' (assumed)' : ''}
- candidate: ${r.candidate.browser.engine} ${r.candidate.browser.version}, scene checksum \`${r.candidate.sceneChecksum.slice(0, 16)}…\`
- time map: scene_t = ref_t − ${r.timeMap.offset}; no warping${r.candidate.timeTransform ? `; **deliberate retiming for negative control**: \`${r.candidate.timeTransform}\`` : ''}
${r.negativeControl ? `- **negative control \`${r.negativeControl.kind}\`**: ${r.negativeControl.note}. Expected to fail in ${r.negativeControl.expectFailIn.join(', ')} → **${r.negativeControl.caught ? 'CAUGHT' : 'MISSED'}**\n` : ''}
## Outcomes (reported separately)

- appearance: **${r.outcomes.appearance}**
- temporal: **${r.outcomes.temporal}**

## Appearance

| check | outcome | value | gate | note |
|---|---|---|---|---|
${r.appearance.map(row).join('\n')}

## Temporal

| check | outcome | value | gate | note |
|---|---|---|---|---|
${r.temporal.map(row).join('\n')}

## Tracks

| part | moving | ref visible | median px | p90 px | extent px | lag s | rate slope |
|---|---|---|---|---|---|---|---|
${r.tracks.map((t) => `| ${t.part} | ${t.moving} | ${t.refVisibleFrames} | ${t.medianErrPx} | ${t.p90ErrPx} | ${t.medianExtentErrPx} | ${t.phaseLag ?? '–'} | ${t.rateSlope ?? '–'} |`).join('\n')}

Evidence: \`sheet.png\` (reference | candidate | diff), \`tracks.png\` (per-part x/y over time).
`;
}

// Per-animation sensitivity: shift ONE CSSAnimation by `offset` seconds (others
// untouched) and record whether the temporal checks notice. Reports coverage; an
// undetected animation means the tracks/signals do not observe that motion.
export async function animationSensitivity(scene, ref, { session, offset = 0.1, log = console.log, maxAnimations = 16 } = {}) {
  const inv = readJSON(join(scene.artifacts, 'cand', 'candidate', 'manifest.json')).animationInventory ?? [];
  // large scenes: one representative per keyframes name (first occurrence), capped
  const seen = new Set(), pick = [];
  inv.forEach((a, i) => { if (!seen.has(a.name)) { seen.add(a.name); pick.push(i); } });
  const sample = inv.length <= maxAnimations ? inv.map((_, i) => i) : pick.slice(0, maxAnimations);
  const rows = [];
  for (const i of sample) {
    const a = inv[i];
    const what = `${a.name} on ${a.target}${a.pseudo ?? ''}`;
    const r = await runCandidate(scene, ref, { label: `anim-${i}`, kind: 'animOffset', session, log: () => {}, sheet: false, mutate: { offsetIndex: i, offsetMs: offset * 1000 }, note: `${what} shifted +${offset}s` });
    rows.push({ index: i, animation: what, caught: r.negativeControl.caught, failed: r.negativeControl.failedChecks.slice(0, 4) });
    log(`  +${offset}s ${what}: ${r.negativeControl.caught ? 'detected' : 'NOT detected'}${r.negativeControl.caught ? ` (${r.negativeControl.failedChecks.slice(0, 2).join(', ')})` : ''}`);
  }
  const out = { offset, detected: rows.filter((r) => r.caught).length, total: rows.length, animationsInScene: inv.length, sampled: sample.length < inv.length ? 'one per keyframes name' : 'all', rows };
  writeJSON(join(scene.artifacts, 'compare', 'sensitivity.json'), out);
  return out;
}

// Largest per-track p90 centroid displacement between a control's candidate and the
// good candidate (null when the good report is missing). Frozen/shuffled are large by construction.
function plantedMagnitude(scene, report) {
  const goodPath = join(scene.artifacts, 'compare', 'candidate', 'report.json');
  if (!existsSync(goodPath)) return null;
  const good = readJSON(goodPath);
  let worst = 0;
  report.series.cand.forEach((S, i) => {
    const G = good.series.cand[i];
    if (!G) return;
    const d = [];
    S.forEach((p, j) => { const q = G[j]; if (q && p[1] !== null && q[1] !== null) d.push(Math.hypot(p[1] - q[1], p[2] - q[2])); });
    d.sort((a, b) => a - b);
    if (d.length) worst = Math.max(worst, d[Math.floor(d.length * 0.9)]);
  });
  return +worst.toFixed(2);
}

// root: the directory the local server exposes (the scene's project root, so scenes and clips
// outside the current directory resolve).
export async function withSession(engine, fn, root) {
  const s = await launch(engine, root);
  try { return await fn(s); } finally { await s.close(); }
}

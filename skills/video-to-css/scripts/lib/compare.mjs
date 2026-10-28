// Reference vs candidate comparison at equal physical times.
// Appearance and temporal fidelity are reported separately; no blended score.
import { join } from 'node:path';
import { readPNG, writePNG } from './png.mjs';
import { writeJSON, fmt } from './util.mjs';
import {
  trackPart, cellMeans, rgbToLab, deltaE, luma, meanAbsDiff, ssim, edgeCells,
  quantile, mean, pearson, bestLag, featureRanges, featureNoise,
} from './metrics.mjs';

// Gates declared before any example was compared (v1). Changing them requires a
// note in docs/EVIDENCE.md; they are never relaxed to make a failing case pass.
export const GATES = {
  grid: [16, 9], // 144 cells at 16:9; other aspects keep ~144 near-square cells (gridFor)
  cellColorMedianDE: 4, // CIE76 ΔE of time-averaged 16x9 cell colours; H.264 noise ≈ 1
  cellColorP95DE: 10,
  edgeLayoutCorr: 0.8, // Pearson r of time-averaged Sobel energy per cell
  trajMedianFrac: 0.01, // centroid error, fraction of frame diagonal (7.3 px at 640x360)
  trajP90Frac: 0.025, // 18 px at 640x360
  extentMedianFrac: 0.015, // bbox w/h error, fraction of diagonal
  visibilityAgreement: 0.9,
  movingRangePx: 4, // a track counts as moving if its centroid path spans more than this…
  sizeRangePx: 2, // …or its sqrt(area) spans more than this (pulses, squash, scale)
  regionGrid: [3, 3], // coarse regions whose mean L* forms the luminance timing signal
  regionMovingL: 2, // ΔL* range above which the luminance signal is lag-analysed
  lagSharpness: 1.5, // in units of measured feature noise: min error rise at ±0.1 s for a lag to count as identified
  maxPhaseLag: 0.05, // s; ≈1.5 frame intervals at 30 fps
  maxRateError: 0.03, // |d(lag)/dt|; 3% speed error
  energyCorr: 0.6, // Pearson r of per-sample frame-difference energy
  energyRatio: [0.5, 2],
  energyFlatCV: 0.1, // below this coefficient of variation the energy profile carries no timing shape
  seamJumpRatio: 3, // seam step vs median step between consecutive samples
  seamPeriodicMAD: 1.5, // mean |frame(D) - frame(0)| in 8-bit levels, loops only
};

// Near-square cells for any aspect ratio, ~cols*rows of GATES.grid in total (16x9 at 16:9, 9x16 at 9:16).
export function gridFor(w, h, cells = GATES.grid[0] * GATES.grid[1]) {
  const cols = Math.max(2, Math.round(Math.sqrt(cells * w / h)));
  return [cols, Math.max(2, Math.round(cells / cols))];
}

const check = (check, pass, value, gate, note) => ({ check, outcome: pass === null ? 'info' : pass ? 'pass' : 'fail', value, gate, note });

export async function compareRun({ scene, refEntries, candManifest, outDir, seam = null, label = 'candidate' }) {
  const G = GATES;
  const [cols, rows] = gridFor(scene.stage.width, scene.stage.height);
  const diag = Math.hypot(scene.stage.width, scene.stage.height);
  const loopOpts = { loop: !!scene.timing.loop, duration: scene.timing.duration };
  const candByK = new Map(candManifest.frames.map((f) => [f.k, f]));
  const tracks = scene.tracks ?? [];
  const series = { ref: tracks.map(() => []), cand: tracks.map(() => []) };
  const regions = { ref: [], cand: [] };
  const refCellSum = new Float64Array(cols * rows * 3), candCellSum = new Float64Array(cols * rows * 3);
  const refEdgeSum = new Float64Array(cols * rows), candEdgeSum = new Float64Array(cols * rows);
  const perFrame = [];
  let prev = null;
  for (const r of refEntries) {
    const c = candByK.get(r.k);
    if (!c) throw new Error(`candidate frame ${r.k} missing`);
    const A = readPNG(r.file), B = readPNG(c.file);
    if (A.width !== B.width || A.height !== B.height) {
      throw new Error(`framing mismatch: reference ${A.width}x${A.height} vs candidate ${B.width}x${B.height} (no resizing is performed)`);
    }
    const t = r.pts; // reference presentation time (clip seconds)
    // timing features: centroid + sqrt(area) (size/pulse); sqrt(area) integrates every keyed
    // pixel, unlike bbox extremes which hinge on single antialiased corner pixels
    const feat = (p) => (p.visible ? { ...p, f: [p.cx, p.cy, Math.sqrt(p.area)] } : p);
    tracks.forEach((tr, i) => {
      series.ref[i].push({ t, ...feat(trackPart(A, tr)) });
      series.cand[i].push({ t, ...feat(trackPart(B, tr)) });
    });
    // region luminance signal: catches mistimed fades / colour animations without a track
    const regionL = (img) => { const m = cellMeans(img, ...G.regionGrid); const L = []; for (let k = 0; k < m.length / 3; k++) L.push(rgbToLab([m[k * 3], m[k * 3 + 1], m[k * 3 + 2]])[0]); return L; };
    regions.ref.push({ t, visible: true, f: regionL(A) });
    regions.cand.push({ t, visible: true, f: regionL(B) });
    const ca = cellMeans(A, cols, rows), cb = cellMeans(B, cols, rows);
    for (let i = 0; i < ca.length; i++) { refCellSum[i] += ca[i]; candCellSum[i] += cb[i]; }
    const la = luma(A), lb = luma(B);
    const ea = edgeCells(la, cols, rows), eb = edgeCells(lb, cols, rows);
    for (let i = 0; i < ea.length; i++) { refEdgeSum[i] += ea[i]; candEdgeSum[i] += eb[i]; }
    const frameDE = [];
    for (let k = 0; k < cols * rows; k++) {
      frameDE.push(deltaE(rgbToLab([ca[k * 3], ca[k * 3 + 1], ca[k * 3 + 2]]), rgbToLab([cb[k * 3], cb[k * 3 + 1], cb[k * 3 + 2]])));
    }
    perFrame.push({
      k: r.k, t: fmt(t, 6), sceneTime: c.sceneTime,
      ssim: ssim(la, lb), cellDEMedian: quantile(frameDE, 0.5),
      refEnergy: prev ? meanAbsDiff(prev.la, la) : null,
      candEnergy: prev ? meanAbsDiff(prev.lb, lb) : null,
      mad: meanAbsDiff(la, lb),
    });
    prev = { la, lb };
  }
  const n = refEntries.length;

  // ---------------- appearance
  const cellDE = [];
  for (let k = 0; k < cols * rows; k++) {
    const a = [0, 1, 2].map((j) => refCellSum[k * 3 + j] / n), b = [0, 1, 2].map((j) => candCellSum[k * 3 + j] / n);
    cellDE.push(deltaE(rgbToLab(a), rgbToLab(b)));
  }
  const edgeCorr = pearson(Array.from(refEdgeSum), Array.from(candEdgeSum));
  const appearance = [
    check('appearance.cellColor.median', quantile(cellDE, 0.5) <= G.cellColorMedianDE, fmt(quantile(cellDE, 0.5)), `<= ${G.cellColorMedianDE} ΔE`, 'time-averaged 16x9 cell colours'),
    check('appearance.cellColor.p95', quantile(cellDE, 0.95) <= G.cellColorP95DE, fmt(quantile(cellDE, 0.95)), `<= ${G.cellColorP95DE} ΔE`, 'worst cells; see cellDE map'),
    check('appearance.edgeLayout', edgeCorr >= G.edgeLayoutCorr, fmt(edgeCorr), `>= ${G.edgeLayoutCorr}`, 'time-averaged edge energy per cell'),
    check('appearance.ssim.mean', null, fmt(mean(perFrame.map((f) => f.ssim))), null, 'supplementary; mixes timing and appearance'),
    check('appearance.perFrameCellDE.median', null, fmt(quantile(perFrame.map((f) => f.cellDEMedian), 0.5)), null, 'supplementary; mixes timing and appearance'),
  ];

  // ---------------- temporal
  const temporal = [];
  // Whole-clip lag, windowed lags -> rate (slope) and timing shape (residual).
  // Diagnostics only: lags are never applied to the candidate.
  function lagChecks(name, R, C, what) {
    const res = {};
    const t0 = R[0].t, t1 = R.at(-1).t;
    const scale = featureNoise(R);
    res.noise = scale?.map((v) => fmt(v, 3));
    const lagOpts = { ...loopOpts, scale };
    const whole = bestLag(R, C, [t0, t1 + 1e-6], lagOpts);
    res.phaseLag = fmt(whole.lag, 4);
    res.phaseSharpness = fmt(whole.sharp, 2);
    const ident = whole.sharp >= G.lagSharpness;
    temporal.push(check(`temporal.phase.${name}`, ident ? Math.abs(whole.lag) <= G.maxPhaseLag : null, res.phaseLag, `|lag| <= ${G.maxPhaseLag} s`, `cand(t) ≈ ref(t+lag)+c on ${what}; never applied${ident ? '' : '; not identifiable (flat error curve), reported only'}`));
    const span = t1 - t0, nw = Math.max(3, Math.min(6, Math.round(span)));
    const wins = [];
    for (let w = 0; w < nw; w++) {
      const a = t0 + (span * w) / nw, b = t0 + (span * (w + 1)) / nw;
      const bl = bestLag(R, C, [a, b + (w === nw - 1 ? 1e-6 : 0)], lagOpts);
      if (Number.isFinite(bl.err)) wins.push({ tc: (a + b) / 2, lag: bl.lag, sharp: bl.sharp, ident: bl.sharp >= G.lagSharpness });
    }
    res.windowLags = wins.map((w) => ({ t: fmt(w.tc, 2), lag: fmt(w.lag, 4), sharp: fmt(w.sharp, 2), identified: w.ident }));
    wins.splice(0, wins.length, ...wins.filter((w) => w.ident));
    if (wins.length >= 3) {
      const mt = mean(wins.map((w) => w.tc)), ml = mean(wins.map((w) => w.lag));
      let num = 0, den = 0;
      for (const w of wins) { num += (w.tc - mt) * (w.lag - ml); den += (w.tc - mt) ** 2; }
      const slope = num / den;
      // residual around the linear fit: local timing errors (easing, one late segment)
      const resid = Math.max(...wins.map((w) => Math.abs(w.lag - (ml + slope * (w.tc - mt)))));
      res.rateSlope = fmt(slope, 4);
      res.timingShapeResidual = fmt(resid, 4);
      temporal.push(
        check(`temporal.rate.${name}`, Math.abs(slope) <= G.maxRateError, res.rateSlope, `|slope| <= ${G.maxRateError}`, 'slope of windowed lag vs time; ≈ speed ratio - 1'),
        check(`temporal.timingShape.${name}`, resid <= G.maxPhaseLag, res.timingShapeResidual, `<= ${G.maxPhaseLag} s`, 'max window-lag residual after linear fit (easing / local delay errors)'),
      );
    }
    return res;
  }
  const trackReports = tracks.map((tr, i) => {
    const R = series.ref[i], C = series.cand[i];
    const errs = [], ext = [];
    let agree = 0;
    for (let j = 0; j < R.length; j++) {
      if (R[j].visible === C[j].visible) agree++;
      if (R[j].visible && C[j].visible) {
        errs.push(Math.hypot(R[j].cx - C[j].cx, R[j].cy - C[j].cy));
        ext.push(Math.max(Math.abs(R[j].bbox[2] - C[j].bbox[2]), Math.abs(R[j].bbox[3] - C[j].bbox[3])));
      }
    }
    const vis = R.filter((s) => s.visible);
    const fr = featureRanges(R);
    const range = fr.length ? Math.hypot(fr[0], fr[1]) : 0;
    const moving = fr.length > 0 && (range > G.movingRangePx || fr[2] > G.sizeRangePx);
    const out = {
      part: tr.part, refVisibleFrames: vis.length, candVisibleFrames: C.filter((s) => s.visible).length,
      pathRangePx: fmt(range, 1), sizeRangePx: fr.length ? fmt(fr[2], 1) : 0, moving,
      medianErrPx: fmt(quantile(errs, 0.5), 2), p90ErrPx: fmt(quantile(errs, 0.9), 2), maxErrPx: fmt(Math.max(...errs), 2),
      medianExtentErrPx: fmt(quantile(ext, 0.5), 2),
      visibilityAgreement: fmt(agree / R.length),
    };
    const mGate = G.trajMedianFrac * diag, pGate = G.trajP90Frac * diag, eGate = G.extentMedianFrac * diag;
    temporal.push(
      check(`temporal.trajectory.${tr.part}.median`, errs.length > 0 && quantile(errs, 0.5) <= mGate, out.medianErrPx, `<= ${fmt(mGate, 1)} px`, `${errs.length} co-visible samples`),
      check(`temporal.trajectory.${tr.part}.p90`, errs.length > 0 && quantile(errs, 0.9) <= pGate, out.p90ErrPx, `<= ${fmt(pGate, 1)} px`, ''),
      check(`temporal.extent.${tr.part}.median`, ext.length > 0 && quantile(ext, 0.5) <= eGate, out.medianExtentErrPx, `<= ${fmt(eGate, 1)} px`, 'bbox width/height'),
      check(`temporal.visibility.${tr.part}`, agree / R.length >= G.visibilityAgreement, out.visibilityAgreement, `>= ${G.visibilityAgreement}`, 'occlusion/entry/exit agreement'),
    );
    if (moving) Object.assign(out, lagChecks(tr.part, R, C, 'centroid + sqrt(area)'));
    return out;
  });
  // region luminance timing (fades, colour/opacity animations, untracked parts)
  const rr = featureRanges(regions.ref);
  const regionReport = { maxRangeL: fmt(Math.max(...rr), 2), analysed: Math.max(...rr) > G.regionMovingL };
  if (regionReport.analysed) Object.assign(regionReport, lagChecks('regionLuma', regions.ref, regions.cand, `${G.regionGrid.join('x')} region mean L*`));

  const eRef = perFrame.slice(1).map((f) => f.refEnergy), eCand = perFrame.slice(1).map((f) => f.candEnergy);
  const eCorr = pearson(eRef, eCand), eRatio = eCand.reduce((s, v) => s + v, 0) / (eRef.reduce((s, v) => s + v, 0) || 1e-9);
  // Steady motion (constant speed, e.g. a linear slide) gives a flat energy profile: correlation is
  // undefined there, so it is reported, not gated; total energy and the lag checks still apply.
  const eMean = mean(eRef), eCV = eMean > 0 ? Math.sqrt(mean(eRef.map((v) => (v - eMean) ** 2))) / eMean : 0;
  const steady = eCV < G.energyFlatCV;
  temporal.push(
    check('temporal.motionEnergy.corr', steady ? null : eCorr >= G.energyCorr, fmt(eCorr), `>= ${G.energyCorr}`,
      steady ? `reference energy profile is flat (CV ${fmt(eCV, 3)} < ${G.energyFlatCV}): not gated` : 'per-sample frame-difference profile'),
    check('temporal.motionEnergy.ratio', eRatio >= G.energyRatio[0] && eRatio <= G.energyRatio[1], fmt(eRatio), `${G.energyRatio[0]}..${G.energyRatio[1]}`, 'total candidate/reference motion'),
  );
  if (seam) temporal.push(...seamChecks(seam, perFrame));

  const report = {
    scene: scene.id, label, synthetic: !!scene.synthetic,
    samples: n, timeMap: { offset: scene.timing.offset ?? 0, rate: 1, note: 'scene_t = ref_t - offset; no warping' },
    candidate: { browser: candManifest.browser, sceneChecksum: candManifest.sceneChecksum, inject: candManifest.inject, mutate: candManifest.mutate, timeTransform: candManifest.timeTransform },
    outcomes: {
      appearance: appearance.filter((c) => c.outcome !== 'info').every((c) => c.outcome === 'pass') ? 'pass' : 'fail',
      temporal: temporal.filter((c) => c.outcome !== 'info').every((c) => c.outcome === 'pass') ? 'pass' : 'fail',
    },
    appearance, temporal, tracks: trackReports, regionLuma: regionReport,
    cellDE: cellDE.map((v) => fmt(v, 2)),
    perFrame: perFrame.map((f) => ({ ...f, ssim: fmt(f.ssim), cellDEMedian: fmt(f.cellDEMedian, 2), refEnergy: fmt(f.refEnergy), candEnergy: fmt(f.candEnergy), mad: fmt(f.mad) })),
    series: { ref: series.ref.map(compactSeries), cand: series.cand.map(compactSeries) },
    gates: G,
  };
  writeJSON(join(outDir, 'report.json'), report);
  return report;
}

const compactSeries = (s) => s.map((p) => (p.visible ? [fmt(p.t, 4), fmt(p.cx, 1), fmt(p.cy, 1)] : [fmt(p.t, 4), null, null]));

// Loop seam: frame at D must equal frame at 0, and the step from D-dt to D must look
// like an ordinary step. `seam` = { first, last, preLast } PNG paths (scene captures).
function seamChecks(seam, perFrame) {
  const L = (p) => luma(readPNG(p));
  const f0 = L(seam.first), fD = L(seam.last), fPre = L(seam.preLast);
  const periodic = meanAbsDiff(f0, fD);
  const step = meanAbsDiff(fPre, fD);
  const typical = quantile(perFrame.slice(1).map((f) => f.candEnergy), 0.5) || 1e-6;
  return [
    check('temporal.loopSeam.periodic', periodic <= GATES.seamPeriodicMAD, fmt(periodic), `<= ${GATES.seamPeriodicMAD} levels`, 'frame(D) vs frame(0)'),
    check('temporal.loopSeam.jump', step / typical <= GATES.seamJumpRatio, fmt(step / typical), `<= ${GATES.seamJumpRatio}x median step`, 'step into the seam vs ordinary steps'),
  ];
}

// Amplified absolute difference image for review sheets.
export function diffImage(aPath, bPath, outPath, gain = 3) {
  const A = readPNG(aPath), B = readPNG(bPath);
  const d = new Uint8Array(A.data.length);
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2])) / 3;
    const g = Math.min(255, v * gain);
    d[i] = g; d[i + 1] = g * 0.55; d[i + 2] = g * 0.2; d[i + 3] = 255;
  }
  writePNG(outPath, { width: A.width, height: A.height, data: d });
}

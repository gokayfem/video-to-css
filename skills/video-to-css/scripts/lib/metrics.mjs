// Low-cost appearance and temporal diagnostics on decoded RGBA frames.
// Everything here is applied identically to reference and candidate frames.

export function hexToRgb(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------------------------------------------------------------- tracking
// Colour-keyed probe: pixels within `tolerance` (RGB distance) of `color` in roi.
export function trackPart(img, track) {
  const [r0, g0, b0] = hexToRgb(track.color);
  const tol2 = track.tolerance * track.tolerance;
  const [rx, ry, rw, rh] = track.roi ?? [0, 0, img.width, img.height];
  const x0 = Math.max(0, rx), y0 = Math.max(0, ry);
  const x1 = Math.min(img.width, rx + rw), y1 = Math.min(img.height, ry + rh);
  let n = 0, sx = 0, sy = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const d = img.data;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4;
      const dr = d[i] - r0, dg = d[i + 1] - g0, db = d[i + 2] - b0;
      if (dr * dr + dg * dg + db * db <= tol2) {
        n++; sx += x + 0.5; sy += y + 0.5;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  const minArea = track.minArea ?? 6;
  if (n < minArea) return { visible: false, area: n };
  return { visible: true, area: n, cx: sx / n, cy: sy / n, bbox: [minX, minY, maxX - minX + 1, maxY - minY + 1] };
}

// ---------------------------------------------------------------- colour
function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
export function rgbToLab([r, g, b]) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export const deltaE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Mean colour per grid cell -> Float64Array(cols*rows*3)
export function cellMeans(img, cols, rows) {
  const out = new Float64Array(cols * rows * 3);
  const cnt = new Float64Array(cols * rows);
  const d = img.data;
  for (let y = 0; y < img.height; y++) {
    const cy = Math.min(rows - 1, Math.floor((y * rows) / img.height));
    for (let x = 0; x < img.width; x++) {
      const c = cy * cols + Math.min(cols - 1, Math.floor((x * cols) / img.width));
      const i = (y * img.width + x) * 4;
      out[c * 3] += d[i]; out[c * 3 + 1] += d[i + 1]; out[c * 3 + 2] += d[i + 2];
      cnt[c]++;
    }
  }
  for (let c = 0; c < cols * rows; c++) for (let k = 0; k < 3; k++) out[c * 3 + k] /= cnt[c] || 1;
  return out;
}

export function luma(img, scale = 2) {
  const w = Math.floor(img.width / scale), h = Math.floor(img.height / scale);
  const out = new Float32Array(w * h);
  const d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++) {
      const i = ((y * scale + yy) * img.width + (x * scale + xx)) * 4;
      s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    }
    out[y * w + x] = s / (scale * scale);
  }
  return { w, h, data: out };
}

// Pixels whose largest channel difference exceeds thr (RGBA images of equal size).
export function changedPixels(a, b, thr = 24) {
  if (a.width !== b.width || a.height !== b.height) return Infinity;
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2])) > thr) n++;
  }
  return n;
}

export function meanAbsDiff(a, b) {
  let s = 0;
  for (let i = 0; i < a.data.length; i++) s += Math.abs(a.data[i] - b.data[i]);
  return s / a.data.length;
}

// Block SSIM on luma (8x8 non-overlapping windows). Supplementary only.
export function ssim(a, b) {
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2, B = 8;
  let total = 0, n = 0;
  for (let y = 0; y + B <= a.h; y += B) for (let x = 0; x + B <= a.w; x += B) {
    let ma = 0, mb = 0;
    for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) { const k = (y + j) * a.w + x + i; ma += a.data[k]; mb += b.data[k]; }
    ma /= B * B; mb /= B * B;
    let va = 0, vb = 0, cov = 0;
    for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) {
      const k = (y + j) * a.w + x + i, da = a.data[k] - ma, db = b.data[k] - mb;
      va += da * da; vb += db * db; cov += da * db;
    }
    va /= B * B - 1; vb /= B * B - 1; cov /= B * B - 1;
    total += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
    n++;
  }
  return total / n;
}

// Edge density per grid cell (Sobel magnitude on luma).
export function edgeCells(L, cols, rows) {
  const out = new Float64Array(cols * rows), cnt = new Float64Array(cols * rows);
  for (let y = 1; y < L.h - 1; y++) for (let x = 1; x < L.w - 1; x++) {
    const p = (dx, dy) => L.data[(y + dy) * L.w + x + dx];
    const gx = -p(-1, -1) - 2 * p(-1, 0) - p(-1, 1) + p(1, -1) + 2 * p(1, 0) + p(1, 1);
    const gy = -p(-1, -1) - 2 * p(0, -1) - p(1, -1) + p(-1, 1) + 2 * p(0, 1) + p(1, 1);
    const c = Math.min(rows - 1, Math.floor((y * rows) / L.h)) * cols + Math.min(cols - 1, Math.floor((x * cols) / L.w));
    out[c] += Math.hypot(gx, gy); cnt[c]++;
  }
  for (let c = 0; c < out.length; c++) out[c] /= cnt[c] || 1;
  return out;
}

// ---------------------------------------------------------------- stats
export function quantile(arr, q) {
  const a = arr.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return NaN;
  const pos = (a.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}
export const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
export function pearson(a, b) {
  const ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

// ---------------------------------------------------------------- temporal
// Series samples are { t, visible, f: number[] } (a feature vector per sample:
// centroid + half-extents for tracks, region L* for the luminance signal).
// Interpolate at time t (linear); loops wrap. Returns a feature vector or null.
export function sampleSeries(series, t, { loop = false, duration = null } = {}) {
  if (loop && duration) t = ((t % duration) + duration) % duration;
  else if (t < series[0].t - 1e-9 || t > series.at(-1).t + 1e-9) return null;
  let i = series.findIndex((s) => s.t > t);
  if (i === -1) i = series.length;
  const a = series[i - 1];
  let b = series[i];
  if (!a) return b.visible ? b.f : null;
  if (!b) {
    if (!(loop && duration)) return a.visible ? a.f : null;
    b = { ...series[0], t: series[0].t + duration };
  }
  if (!a.visible || !b.visible) return null;
  const u = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
  return a.f.map((v, k) => v + (b.f[k] - v) * u);
}

export const dist = (p, q) => Math.sqrt(p.reduce((s, v, k) => s + (v - q[k]) ** 2, 0));

// Best time lag δ such that cand(t) ≈ ref(t + δ) + c over the samples in `win`,
// where c is a constant offset removed per lag (timing is judged on *when* things
// change, not *where*; position/size offsets are judged by trajectory/extent checks).
// `sharp` = error increase when the lag is moved ±probe s away from the optimum: a
// lag is only identifiable when that exceeds the measurement noise.
export function bestLag(refSeries, candSeries, win, opts) {
  const { maxLag = 0.5, step = 1 / 120, probe = 0.1, scale = null } = opts;
  const errAt = (lag) => {
    const pairs = [];
    for (const c of candSeries) {
      if (!c.visible || c.t < win[0] || c.t >= win[1]) continue;
      const r = sampleSeries(refSeries, c.t + lag, opts);
      if (r) pairs.push(c.f.map((v, k) => (v - r[k]) / (scale ? scale[k] : 1)));
    }
    if (pairs.length < 3) return { err: Infinity, n: pairs.length };
    const m = pairs[0].map((_, k) => mean(pairs.map((p) => p[k])));
    return { err: mean(pairs.map((p) => Math.sqrt(p.reduce((s, v, k) => s + (v - m[k]) ** 2, 0)))), n: pairs.length };
  };
  let best = { lag: 0, err: Infinity };
  // search outward from zero so ties (holds, symmetric motion) resolve to the smallest lag
  const lags = [0];
  for (let k = 1; k * step <= maxLag + 1e-9; k++) lags.push(k * step, -k * step);
  for (const lag of lags) {
    const e = errAt(lag);
    if (e.err < best.err - 1e-9) best = { lag, ...e };
  }
  if (Number.isFinite(best.err)) best.sharp = Math.min(errAt(best.lag - probe).err, errAt(best.lag + probe).err) - best.err;
  return best;
}

// Per-feature measurement noise from the reference itself: robust spread of the
// second difference between consecutive visible samples (smooth motion contributes
// little; the estimate errs high, i.e. conservative). Floored to avoid divide-by-0.
export function featureNoise(series, floor = 0.05) {
  const v = series.filter((s) => s.visible);
  if (v.length < 5) return null;
  return v[0].f.map((_, k) => {
    const d = [];
    for (let i = 1; i < v.length - 1; i++) d.push(Math.abs(v[i].f[k] - (v[i - 1].f[k] + v[i + 1].f[k]) / 2));
    return Math.max(floor, (quantile(d, 0.5) * 1.4826) / Math.sqrt(1.5));
  });
}

// Range of each feature over visible samples; a series "moves" if any exceeds `min`.
export function featureRanges(series) {
  const vis = series.filter((s) => s.visible);
  if (!vis.length) return [];
  return vis[0].f.map((_, k) => Math.max(...vis.map((s) => s.f[k])) - Math.min(...vis.map((s) => s.f[k])));
}

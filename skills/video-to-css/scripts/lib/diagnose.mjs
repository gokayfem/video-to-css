// Review and diagnosis tools for iterating on a scene against its reference, for any clip.
// Every tool works on any scene package, including a frozen revision (a frozen copy is itself a
// scene package), so evidence can always name exactly which build it came from.
//
//   freezeScene   immutable copy of scene/ + scene.json with per-file sha256 (optionally builds twice
//                 first and refuses if the output differs, i.e. something is mid-edit)
//   triptych      reference | previous | current at the same PTS and crop (previous = another scene dir)
//   denseFrames   the scene at sub-frame times (e.g. every 1/120 s) across a transition: continuity
//                 between reference frames, which per-frame checks cannot see
//   jumps         per-frame mean |Δluma| over the whole timeline, scene vs reference: steps much larger
//                 than the reference's step at the same frame are pops
//   playback      synchronized side-by-side video (reference | [previous] | scene) at reference PTS
//   attribute     hide one layer at a time at time t and report which layer changes given pixels
//   lineProfile   luma along a line in reference and scene: transition width and interior ridges/dips
//                 (lines, halos, seams), so a "soft edge" or "no line" claim is measurable
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
import { inspectClip, extractFrames } from './video.mjs';
import { captureScene, launch, openScene, seek, shoot } from './capture.mjs';
import { prepareReference } from './pipeline.mjs';
import { renderSheet } from './sheet.mjs';
import { cropTo } from './sbs.mjs';
import { readPNG, decodePNG } from './png.mjs';
import { ensureDir, fmt, pad, readJSON, run, sha256Dir, sha256File, writeJSON } from './util.mjs';

// A browser session serves one project root; a scene (or a --prev revision) outside it gets its own.
async function onRoot(session, scene, fn) {
  if (session && (scene.dir + '/').startsWith(session.root.replace(/\/?$/, '/'))) return fn(session);
  const own = await launch(session?.engine ?? 'chromium', scene.root);
  try { return await fn(own); } finally { await own.close(); }
}
const cap = (session, scene, times, dir, label) => onRoot(session, scene, (s) => captureScene(scene, times, dir, { session: s, label }));

const lumaAt = (im, x, y) => { const i = (y * im.width + x) * 4; return 0.2126 * im.data[i] + 0.7152 * im.data[i + 1] + 0.0722 * im.data[i + 2]; };
const sceneTime = (scene, pts) => pts - (scene.timing.offset ?? 0);
const short = (scene) => sha256Dir(join(scene.dir, 'scene')).slice(0, 12);

function walkFiles(dir, base = dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkFiles(p, base, out); else out.push(relative(base, p));
  }
  return out;
}

// ---- freeze -------------------------------------------------------------------------------------
export function freezeScene(scene, { rev, build = null, log = console.log } = {}) {
  if (!/^[A-Za-z0-9._-]+$/.test(rev ?? '')) throw new Error('freeze needs --rev <name> (letters, digits, . _ -)');
  const out = join(scene.artifacts, 'frozen', rev);
  if (existsSync(out)) throw new Error(`${out} exists: frozen revisions are immutable (pick a new --rev)`);
  if (build) {
    const once = () => { execSync(build, { cwd: scene.root, stdio: 'pipe' }); return sha256Dir(join(scene.dir, 'scene')); };
    const a = once(), b = once();
    if (a !== b) throw new Error('two consecutive builds produced different scene/ output (a part is mid-edit?); not freezing');
  }
  mkdirSync(out, { recursive: true });
  cpSync(join(scene.dir, 'scene'), join(out, 'scene'), { recursive: true });
  const sj = readJSON(join(scene.dir, 'scene.json'));
  if (scene.clipPath) sj.reference.clip = relative(out, scene.clipPath);
  sj.frozen = { rev, at: new Date().toISOString(), from: relative(scene.root, scene.dir) };
  writeJSON(join(out, 'scene.json'), sj);
  const files = Object.fromEntries([...walkFiles(join(out, 'scene')).map((f) => join('scene', f)), 'scene.json'].map((f) => [f, sha256File(join(out, f))]));
  const record = { rev, at: sj.frozen.at, from: sj.frozen.from, sceneChecksum: sha256Dir(join(out, 'scene')), built: build ?? null, files };
  writeJSON(join(out, 'FREEZE.json'), record);
  log(`frozen ${rev} at ${record.at}: ${out} (scene ${record.sceneChecksum.slice(0, 12)})`);
  return { dir: out, ...record };
}

// Recompute every recorded hash; returns [] when the frozen copy is intact.
export function verifyFrozen(dir) {
  const rec = readJSON(join(dir, 'FREEZE.json'));
  return Object.entries(rec.files).filter(([f, h]) => !existsSync(join(dir, f)) || sha256File(join(dir, f)) !== h).map(([f]) => f);
}

// ---- matched-time sheets -------------------------------------------------------------------------
async function refAt(scene, times, dir) {
  const src = await inspectClip(scene.clipPath);
  const off = scene.timing.offset ?? 0;
  return (await extractFrames(src, times.map((t) => ({ t: t + off })), dir)).entries;
}

export async function triptych(session, scene, { prev = null, times, crop = null, zoom = 1, out, thumbWidth }) {
  const work = ensureDir(out.replace(/\.png$/, '') + '-frames');
  const ref = await refAt(scene, times, join(work, 'ref'));
  const at = ref.map((e) => ({ k: e.k, t: sceneTime(scene, e.pts) }));
  const cur = await cap(session, scene, at, join(work, 'current'), 'current');
  const pre = prev ? await cap(session, prev, at, join(work, 'previous'), 'previous') : null;
  const cell = (file, k, tag) => (crop ? cropTo(file, join(work, `crop-${tag}-${pad(k)}.png`), crop, zoom) : file);
  const rows = ref.map((e) => ({
    label: `t=${e.pts.toFixed(3)}s\nframe #${e.index}`,
    cells: [cell(e.file, e.k, 'ref'), ...(pre ? [cell(pre.frames.find((f) => f.k === e.k).file, e.k, 'prev')] : []), cell(cur.frames.find((f) => f.k === e.k).file, e.k, 'cur')],
  }));
  const name = (s) => s.frozen?.rev ?? relative(scene.root, s.dir);
  await renderSheet(session, {
    title: `${scene.title} — reference | ${prev ? 'previous | ' : ''}current`,
    subtitle: `same PTS and crop; previous = ${prev ? `${name(prev)} (${short(prev)})` : 'none'}; current = ${name(scene)} (${short(scene)})`,
    columns: ['reference', ...(prev ? ['previous'] : []), 'current'], rows, out,
    thumbWidth: thumbWidth ?? (crop ? Math.min(480, crop[2] * zoom) : 360),
  });
  return out;
}

export async function denseFrames(session, scene, { from, to, step = 1 / 120, crop = null, zoom = 1, out, perRow = 8 }) {
  const work = ensureDir(out.replace(/\.png$/, '') + '-frames');
  const times = [];
  for (let t = from; t <= to + 1e-9; t += step) times.push(+t.toFixed(6));
  const m = await cap(session, scene, times.map((t, k) => ({ k, t })), work, 'dense');
  const files = m.frames.map((f) => (crop ? cropTo(f.file, join(work, `crop-${pad(f.k)}.png`), crop, zoom) : f.file));
  const rows = [];
  for (let i = 0; i < files.length; i += perRow) rows.push({ label: `${times[i].toFixed(3)}–${times[Math.min(i + perRow, files.length) - 1].toFixed(3)} s`, cells: files.slice(i, i + perRow) });
  await renderSheet(session, {
    title: `${scene.title} — scene every ${fmt(step * 1000, 2)} ms, ${from}–${to} s`,
    subtitle: 'left→right, top→bottom; look for flashes, holes, doubled shapes and jumps between reference frames',
    columns: Array.from({ length: perRow }, () => ''), rows, out, thumbWidth: crop ? Math.min(220, crop[2] * zoom) : 200,
  });
  return { out, times };
}

// ---- whole-timeline captures ---------------------------------------------------------------------
// Capture the scene at every reference sample time once per scene checksum (cached).
export async function captureAll(session, scene, { log = () => {} } = {}) {
  const ref = await prepareReference(scene, { log });
  const dir = join(scene.artifacts, 'diag', short(scene), 'all');
  const manifest = join(dir, 'manifest.json');
  if (existsSync(manifest) && readJSON(manifest).frames.length === ref.entries.length) return { ref, cand: readJSON(manifest) };
  rmSync(dir, { recursive: true, force: true });
  const cand = await cap(session, scene, ref.entries.map((e) => ({ k: e.k, t: sceneTime(scene, e.pts) })), dir, 'all');
  return { ref, cand };
}

export async function jumps(session, scene, { crop = null } = {}) {
  const { ref, cand } = await captureAll(session, scene);
  const [x0, y0, w, h] = crop ?? [0, 0, scene.stage.width, scene.stage.height];
  const L = (file) => { const im = readPNG(file); const a = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = lumaAt(im, x0 + x, y0 + y); return a; };
  const md = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
  const rows = []; let pr, pc;
  ref.entries.forEach((e, i) => {
    const r = L(e.file), c = L(cand.frames[i].file);
    if (i) rows.push({ frame: e.index, t: fmt(sceneTime(scene, e.pts), 3), ref: fmt(md(r, pr), 2), scene: fmt(md(c, pc), 2) });
    pr = r; pc = c;
  });
  const median = (k) => [...rows.map((r) => r[k])].sort((a, b) => a - b)[rows.length >> 1] ?? 0;
  const mRef = median('ref'), mScene = median('scene');
  // a pop: the scene's step is far above its own typical step AND well above the reference's step there
  const flagged = rows.filter((r) => r.scene > Math.max(3 * mScene, 1.5) && r.scene > 2 * r.ref);
  return { crop: [x0, y0, w, h], medianStep: { ref: mRef, scene: mScene }, flagged, top: [...rows].sort((a, b) => b.scene - a.scene).slice(0, 6), rows };
}

export async function playback(session, scene, { prev = null, crop = null, out, width = 640 }) {
  const { ref, cand } = await captureAll(session, scene);
  const pre = prev ? await captureAll(session, prev) : null;
  const work = ensureDir(out.replace(/\.mp4$/, '') + '-lists');
  // concat lists carry each frame's real duration (from PTS), so VFR clips stay in sync
  const durs = ref.entries.map((e, i) => (ref.entries[i + 1] ? ref.entries[i + 1].pts - e.pts : (ref.entries[i - 1] ? e.pts - ref.entries[i - 1].pts : 1 / 24)));
  const list = (files, name) => {
    const p = join(work, `${name}.txt`);
    writeFileSync(p, files.map((f, i) => `file '${resolve(f)}'\nduration ${durs[i].toFixed(6)}`).join('\n') + `\nfile '${resolve(files.at(-1))}'\n`);
    return ['-f', 'concat', '-safe', '0', '-i', p];
  };
  const streams = [ref.entries.map((e) => e.file), ...(pre ? [pre.cand.frames.map((f) => f.file)] : []), cand.frames.map((f) => f.file)];
  const inputs = streams.flatMap((s, i) => list(s, `s${i}`));
  const [x, y, w, h] = crop ?? [0, 0, scene.stage.width, scene.stage.height];
  const H = Math.round((width * h) / w / 2) * 2;
  const chains = streams.map((_, i) => `[${i}:v]crop=${w}:${h}:${x}:${y},scale=${width}:${H}[v${i}]`);
  const fc = `${chains.join(';')};${streams.map((_, i) => `[v${i}]`).join('')}hstack=${streams.length},format=yuv420p[o]`;
  // constant-rate output at the clip's typical frame interval; the concat durations keep VFR frames in place
  const step = [...durs].sort((p, q) => p - q)[durs.length >> 1];
  await run('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', fc, '-map', '[o]', '-fps_mode', 'cfr', '-r', String(+(1 / step).toFixed(3)), '-frames:v', String(Math.round(durs.reduce((s, d) => s + d, 0) / step)), '-c:v', 'libx264', '-crf', '18', out]);
  return { out, columns: ['reference', ...(pre ? ['previous'] : []), 'scene'], frames: ref.entries.length };
}

// ---- attribution ---------------------------------------------------------------------------------
// Hide each layer (default: direct children of the stage root) at time t and report how much each
// sampled point changes. A defect pixel that brightens or darkens when a layer is hidden belongs to
// that layer: fix the owner, not the symptom.
export async function attribute(session, scene, opts) {
  return onRoot(session, scene, (s) => attributeOn(s, scene, opts));
}

async function attributeOn(session, scene, { t, points, selector = null, radius = 1 }) {
  const { ctx, page, stage } = await openScene(session, scene, { warmup: true });
  try {
    const sample = async () => {
      await seek(page, t);
      const im = decodePNG(await shoot(page, stage));
      return points.map(([x, y]) => {
        let s = 0, n = 0;
        for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
          const px = Math.min(im.width - 1, Math.max(0, x + dx)), py = Math.min(im.height - 1, Math.max(0, y + dy));
          s += lumaAt(im, px, py); n++;
        }
        return s / n;
      });
    };
    const layers = await page.evaluate(({ stageSel, sel }) => {
      const root = document.querySelector(stageSel);
      const els = sel ? [...root.querySelectorAll(sel)] : [...root.children];
      return els.map((el, i) => { el.setAttribute('data-v2c-attr', String(i)); return el.className?.toString?.() || el.tagName.toLowerCase(); });
    }, { stageSel: scene.stage.selector, sel: selector });
    await page.addStyleTag({ content: '[data-v2c-attr][data-v2c-hidden]{visibility:hidden!important}' });
    const base = await sample();
    const results = [];
    for (let i = 0; i < layers.length; i++) {
      await page.evaluate((i) => document.querySelector(`[data-v2c-attr="${i}"]`).setAttribute('data-v2c-hidden', ''), i);
      const v = await sample();
      await page.evaluate((i) => document.querySelector(`[data-v2c-attr="${i}"]`).removeAttribute('data-v2c-hidden'), i);
      results.push({ layer: layers[i], delta: v.map((x, k) => fmt(x - base[k], 1)) });
    }
    return {
      t, points, base: base.map((v) => fmt(v, 1)),
      byPoint: points.map((p, k) => ({ point: p, base: fmt(base[k], 1), owners: results.map((r) => ({ layer: r.layer, delta: r.delta[k] })).filter((r) => Math.abs(r.delta) >= 2).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)) })),
    };
  } finally { await ctx.close(); }
}

// ---- line profiles -------------------------------------------------------------------------------
// Luma along x0,y0 → x1,y1 (1 px steps). transition = 10–90 % distance between the two end plateaus;
// ridges = interior local minima/maxima whose topographic prominence ≥ `prominence` levels (a dark
// line along a contour, a pale halo, a seam). Raw samples, no smoothing (a 1–2 px line is exactly what
// we look for); the prominence threshold keeps pixel noise out — raise it for noisy painterly sources.
// A soft, line-free edge has one monotonic transition and no ridges. `transition` is only meaningful
// for a line that crosses a single edge.
export function profileStats(raw, { prominence = 8, max = 8 } = {}) {
  const n = raw.length;
  const a = raw[0], b = raw[n - 1], lo = Math.min(a, b), hi = Math.max(a, b), d = hi - lo;
  let transition = null;
  if (d >= 20) {
    const rising = b > a;
    const cross = (q) => raw.findIndex((u) => (rising ? u >= lo + q * d : u <= hi - q * d));
    transition = Math.abs(cross(0.9) - cross(0.1));
  }
  // merge runs of equal values (a flat 2 px line is one sample; a flat area is not a train of dips)
  const v = [], at = [];
  raw.forEach((x, i) => { if (!v.length || x !== v.at(-1)) { v.push(x); at.push(i); } });
  // prominence of an interior extremum: walk each way until a value at or beyond it, keep the
  // opposite extreme met on the way, and take the smaller side (the profile ends also end a walk)
  const prom = (i, dip) => {
    const side = (dir) => {
      let best = v[i];
      for (let j = i + dir; j >= 0 && j < v.length; j += dir) {
        if (dip ? v[j] <= v[i] : v[j] >= v[i]) break;
        best = dip ? Math.max(best, v[j]) : Math.min(best, v[j]);
      }
      return best;
    };
    const l = side(-1), r = side(1);
    return dip ? Math.min(l, r) - v[i] : v[i] - Math.max(l, r);
  };
  const ridges = [];
  for (let i = 1; i < v.length - 1; i++) {
    if (v[i] < v[i - 1] && v[i] < v[i + 1] && prom(i, true) >= prominence) ridges.push({ at: at[i], kind: 'dip', prominence: fmt(prom(i, true), 1) });
    if (v[i] > v[i - 1] && v[i] > v[i + 1] && prom(i, false) >= prominence) ridges.push({ at: at[i], kind: 'peak', prominence: fmt(prom(i, false), 1) });
  }
  const top = [...ridges].sort((p, q) => q.prominence - p.prominence).slice(0, max).sort((p, q) => p.at - q.at);
  return { transition, contrast: fmt(d, 1), ridges: top, ridgeCount: ridges.length };
}

export async function lineProfile(session, scene, { t, line, prominence = 8 }) {
  const [x0, y0, x1, y1] = line;
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0)) + 1);
  const pts = Array.from({ length: n }, (_, i) => [Math.round(x0 + ((x1 - x0) * i) / (n - 1)), Math.round(y0 + ((y1 - y0) * i) / (n - 1))]);
  const dir = ensureDir(join(scene.artifacts, 'diag', short(scene), `profile-${fmt(t, 3)}`));
  const [e] = await refAt(scene, [t], join(dir, 'ref'));
  const m = await cap(session, scene, [{ k: 0, t: sceneTime(scene, e.pts) }], join(dir, 'scene'), 'profile');
  const sampleLine = (file) => { const im = readPNG(file); return pts.map(([x, y]) => fmt(lumaAt(im, x, y), 1)); };
  const ref = sampleLine(e.file), cur = sampleLine(m.frames[0].file);
  return { t: fmt(sceneTime(scene, e.pts), 3), line, reference: { ...profileStats(ref, { prominence }), values: ref }, scene: { ...profileStats(cur, { prominence }), values: cur } };
}

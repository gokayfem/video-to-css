// Video inspection and PTS-exact frame extraction via ffprobe/ffmpeg.
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { run, sha256File, writeJSON, ensureDir, pad, fmt } from './util.mjs';
import { rgbToRGBA, writePNG } from './png.mjs';

const tick = (tb) => { const [n, d] = String(tb ?? '0/1').split('/').map(Number); return n > 0 && d > 0 ? n / d : 0; };

export async function inspectClip(clip) {
  const probe = JSON.parse(await run('ffprobe', [
    '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', clip,
  ]));
  const v = probe.streams.find((s) => s.codec_type === 'video');
  if (!v) throw new Error(`no video stream in ${clip}`);
  const framesCsv = await run('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'frame=best_effort_timestamp_time,duration_time,pict_type', '-of', 'csv=p=0', clip,
  ]);
  const [rn, rd] = String(v.avg_frame_rate || v.r_frame_rate || '0/1').split('/').map(Number);
  const step = rn > 0 && rd > 0 ? rd / rn : 1 / 30;
  let last = null;
  const frames = framesCsv.trim().split('\n').filter(Boolean).map((l, i) => {
    const [pts, dur, type] = l.split(',');
    let p = parseFloat(pts);
    // some containers (raw streams, a few GIF/AVI muxes) omit timestamps: continue at the nominal rate
    if (!Number.isFinite(p)) p = last === null ? 0 : last + step;
    last = p;
    return { index: i, pts: p, duration: parseFloat(dur) || null, type: type?.trim() || null };
  });
  const startPts = frames.length ? frames[0].pts : 0;
  const deltas = frames.slice(1).map((f, i) => f.pts - frames[i].pts);
  const minD = Math.min(...deltas), maxD = Math.max(...deltas);
  const rotation = Number(v.tags?.rotate ?? v.side_data_list?.find((s) => s.rotation !== undefined)?.rotation ?? 0);
  const lastDur = frames.at(-1)?.duration ?? (deltas.length ? deltas.at(-1) : 0);
  // Display size = what a player shows: non-square pixels stretched, rotation metadata applied
  // (ffmpeg auto-rotates on decode). Frames are extracted at this size; the scene stage must match.
  const [sn, sd] = String(v.sample_aspect_ratio ?? '1:1').split(':').map(Number);
  const sar = sn > 0 && sd > 0 ? sn / sd : 1;
  const sw = Math.round(v.width * sar);
  const quarter = Math.abs(Math.round(rotation / 90)) % 2 === 1;
  const display = { width: quarter ? v.height : sw, height: quarter ? sw : v.height };
  return {
    path: clip,
    sha256: sha256File(clip),
    bytes: statSync(clip).size,
    container: probe.format.format_name,
    codec: v.codec_name,
    width: display.width,
    height: display.height,
    coded: { width: v.width, height: v.height },
    displayAspect: v.display_aspect_ratio ?? null,
    sampleAspect: v.sample_aspect_ratio ?? null,
    rotation,
    pixFmt: v.pix_fmt,
    color: {
      space: v.color_space ?? null, range: v.color_range ?? null,
      primaries: v.color_primaries ?? null, transfer: v.color_transfer ?? null,
    },
    timeBase: v.time_base,
    nominalFrameRate: v.r_frame_rate,
    avgFrameRate: v.avg_frame_rate,
    frameCount: frames.length,
    startPts,
    // presentation span: first PTS to the end of the last frame
    duration: frames.length ? frames.at(-1).pts + lastDur - startPts : Number(probe.format.duration),
    containerDuration: Number(probe.format.duration),
    // timestamps are quantized to the stream time base (1 ms in WebM/MKV, 10 ms in GIF): jitter within
    // ~one tick is rounding, not variable rate
    variableFrameRate: deltas.length > 0 && maxD - minD > Math.max(1e-4, 1.5 * tick(v.time_base)),
    frameIntervals: { min: fmt(minD, 6), max: fmt(maxD, 6) },
    frames,
  };
}

// Choose the colour matrix for YUV->RGB. Tagged clips use their tag; untagged clips
// fall back to BT.709 for HD (either orientation) and BT.601 otherwise (recorded as an assumption).
// RGB/palette sources (GIF, PNG sequences, ProRes 4444 RGB) need no matrix.
export function colorAssumption(src) {
  const tag = src.color.space;
  const map = { bt709: 'bt709', smpte170m: 'bt601', bt470bg: 'bt601', bt2020nc: 'bt2020' };
  if (map[tag]) return { matrix: map[tag], range: src.color.range === 'pc' ? 'pc' : 'tv', assumed: false };
  if (/^(rgb|bgr|gbr|pal8|argb|rgba|bgra|abgr|gray)/.test(src.pixFmt ?? '')) return { matrix: 'bt709', range: 'pc', assumed: false, rgb: true };
  const { width: cw, height: ch } = src.coded ?? src;
  const hd = Math.max(cw, ch) >= 1280 || Math.min(cw, ch) >= 720;
  return { matrix: hd ? 'bt709' : 'bt601', range: src.color.range === 'pc' ? 'pc' : 'tv', assumed: true };
}

// Presentation-time lookup: the frame on screen at time t is the last frame with pts <= t.
export function frameAt(src, t) {
  const target = src.startPts + t;
  let lo = 0, hi = src.frames.length - 1, best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (src.frames[mid].pts <= target + 1e-6) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return src.frames[best];
}

// Decode the whole clip once (short clips), keeping only the requested frame indices.
// Returns [{ index, pts, t, file }]. `requests` = [{ t }] in clip time (0 = first frame).
export async function extractFrames(src, requests, outDir) {
  ensureDir(outDir);
  const col = colorAssumption(src);
  const wanted = new Map();
  const entries = requests.map((r, k) => {
    const f = frameAt(src, r.t);
    const e = { k, requested: fmt(r.t, 6), index: f.index, pts: fmt(f.pts - src.startPts, 6), quantization: fmt(f.pts - src.startPts - r.t, 6) };
    if (!wanted.has(f.index)) wanted.set(f.index, []);
    wanted.get(f.index).push(e);
    return e;
  });
  const { width: w, height: h } = src;
  const frameBytes = w * h * 3;
  const args = [
    '-v', 'error', '-i', src.path, '-map', '0:v:0', '-fps_mode', 'passthrough',
    '-vf', col.rgb ? `scale=${w}:${h}:flags=accurate_rnd,setsar=1,format=rgb24`
      : `scale=${w}:${h}:in_color_matrix=${col.matrix}:in_range=${col.range}:flags=accurate_rnd+full_chroma_int,setsar=1,format=rgb24`,
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-',
  ];
  await new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = Buffer.alloc(0), idx = 0, err = '';
    p.stderr.on('data', (d) => (err += d));
    p.stdout.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= frameBytes) {
        const frame = buf.subarray(0, frameBytes);
        if (wanted.has(idx)) {
          const file = join(outDir, `${pad(idx, 5)}.png`);
          writePNG(file, rgbToRGBA(frame, w, h));
          for (const e of wanted.get(idx)) e.file = file;
        }
        buf = buf.subarray(frameBytes);
        idx++;
      }
    });
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(err));
      if (idx !== src.frameCount) return reject(new Error(`decoded ${idx} frames, ffprobe listed ${src.frameCount}`));
      resolve();
    });
  });
  return { color: col, entries };
}

export async function writeSource(src, outFile) {
  writeJSON(outFile, src);
  return src;
}

// Render a scene function to an H.264 MP4 through ffmpeg (raw RGB over stdin).
// frameTimes: presentation times in seconds. Irregular spacing (VFR) is produced
// with a per-frame setpts expression; actual PTS are verified after encoding.
import { spawn, execFileSync } from 'node:child_process';
import { Raster } from './raster.mjs';

const TB = 90000;

// Piecewise-linear PTS expression over frame index N, built from frameTimes.
function setptsExpr(frameTimes) {
  const n = frameTimes.length;
  const dt = (i) => +(frameTimes[i + 1] - frameTimes[i]).toFixed(6);
  const segs = [];
  let start = 0;
  for (let i = 1; i < n - 1; i++) {
    if (Math.abs(dt(i) - dt(start)) > 1e-4) {
      segs.push({ n0: start, t0: frameTimes[start], dt: dt(start), n1: i });
      start = i;
    }
  }
  segs.push({ n0: start, t0: frameTimes[start], dt: n > 1 ? dt(start) : 0, n1: n });
  let expr = '';
  for (let k = segs.length - 1; k >= 0; k--) {
    const s = segs[k];
    const fps = 1 / s.dt;
    const step = Math.abs(fps - Math.round(fps)) < 1e-3 ? `/${Math.round(fps)}` : `*${s.dt}`;
    const term = `(${s.t0}+(N-${s.n0})${step})`;
    expr = k === segs.length - 1 ? term : `if(lt(N\\,${s.n1})\\,${term}\\,${expr})`;
  }
  return `setpts=round((${expr})/TB)`;
}

export async function encodeClip({ out, width, height, frameTimes, duration, draw, crf = 16 }) {
  const vf = [`settb=1/${TB}`, setptsExpr(frameTimes), 'scale=out_color_matrix=bt709:out_range=tv', 'format=yuv420p'].join(',');
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${width}x${height}`, '-framerate', '30', '-i', '-',
    '-vf', vf, '-fps_mode', 'passthrough', '-video_track_timescale', String(TB),
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-g', '30', '-bf', '0',
    '-enc_time_base', `1/${TB}`, '-movflags', '+faststart', '-an', out,
  ];
  const p = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => (err += d));
  const done = new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error(err)))));
  const r = new Raster(width, height);
  for (const t of frameTimes) {
    draw(r, t);
    if (!p.stdin.write(r.toRGB24())) await new Promise((res) => p.stdin.once('drain', res));
  }
  p.stdin.end();
  await done;

  const pts = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'frame=best_effort_timestamp_time', '-of', 'csv=p=0', out]).toString().trim().split('\n').map((l) => parseFloat(l));
  if (pts.length !== frameTimes.length) throw new Error(`frame count ${pts.length} != ${frameTimes.length}`);
  const worst = Math.max(...pts.map((v, i) => Math.abs(v - frameTimes[i])));
  if (!(worst <= 2 / TB)) throw new Error(`PTS mismatch ${worst}s`);
  return { frames: pts.length, maxPtsError: worst, duration };
}

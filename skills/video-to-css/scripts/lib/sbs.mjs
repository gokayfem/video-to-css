// Quick matched-time evidence: reference frame | scene render | |diff| at a few times.
// Cheap enough to run after every authoring step (full `compare` samples every frame).
import { join } from 'node:path';
import { inspectClip, extractFrames } from './video.mjs';
import { captureScene } from './capture.mjs';
import { diffImage } from './compare.mjs';
import { renderSheet } from './sheet.mjs';
import { ensureDir, pad } from './util.mjs';
import { readPNG, writePNG } from './png.mjs';

export function cropTo(src, dst, [x, y, w, h], zoom = 1) {
  const im = readPNG(src);
  const out = { width: w * zoom, height: h * zoom, data: new Uint8Array(w * zoom * h * zoom * 4) };
  for (let j = 0; j < h * zoom; j++) for (let i = 0; i < w * zoom; i++) {
    const sx = Math.min(im.width - 1, x + Math.floor(i / zoom)), sy = Math.min(im.height - 1, y + Math.floor(j / zoom));
    out.data.set(im.data.subarray((sy * im.width + sx) * 4, (sy * im.width + sx) * 4 + 4), (j * w * zoom + i) * 4);
  }
  writePNG(dst, out);
  return dst;
}

export async function sideBySide(session, scene, { times, out, title, thumbWidth = 420, crop = null, zoom = 1 }) {
  const dir = ensureDir(out.replace(/\.png$/, '') + '-frames');
  const src = await inspectClip(scene.clipPath);
  const off = scene.timing.offset ?? 0;
  const ref = await extractFrames(src, times.map((t) => ({ t: t + off })), join(dir, 'ref'));
  // capture the scene at the reference frame's actual PTS (not the requested time)
  const m = await captureScene(scene, ref.entries.map((e) => ({ k: e.k, t: e.pts - off })), join(dir, 'cand'), { session, label: 'sbs' });
  const rows = ref.entries.map((e) => {
    const c = m.frames.find((f) => f.k === e.k);
    const d = join(dir, `diff-${pad(e.k)}.png`);
    diffImage(e.file, c.file, d);
    const cells = crop ? [e.file, c.file, d].map((f, i) => cropTo(f, join(dir, `crop-${pad(e.k)}-${i}.png`), crop, zoom)) : [e.file, c.file, d];
    return { label: `t=${e.pts.toFixed(3)}s\nframe #${e.index}`, cells };
  });
  await renderSheet(session, {
    title: title ?? `${scene.title} — side by side`,
    subtitle: `reference (decoded) | scene (${m.browser.engine} ${m.browser.version}) | |diff|×3`,
    columns: ['reference', 'CSS scene', '|diff| ×3'], rows, out, thumbWidth,
  });
  return out;
}

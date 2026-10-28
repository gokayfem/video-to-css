// Flowers: white daisies (yellow centre) and yellow buttercups on the meadow.
// Head positions/sizes are measured blobs on reference frame 0 (colour-threshold connected components,
// horizon clouds excluded). Each flower = 2 elements:
//   .flowers-f  layout at the stem foot + gust rotation (k = 2/loop, same travelling phase plane as grass)
//   .flowers-n  nod rotation (k = 3/loop) about the foot; ::before = stem, ::after = head.
// transform-origin is the stem foot on both levels. See build/notes/grass.md.
import { GUST } from './grass.mjs';

// [type, head centre x, y, head w, h] measured (frame 0); sizes +1 px for the antialiased rim (chosen)
const FLOWERS = [
  ['b', 50, 436, 7, 3], ['b', 115, 466, 3, 3], ['b', 236, 514, 7, 4], ['b', 290, 518, 4, 3], ['b', 356, 550, 9, 6],
  ['b', 647, 624, 5, 3], ['b', 512, 629, 6, 5], ['b', 732, 672, 10, 7], ['b', 787, 699, 10, 7],
  ['d', 115, 481, 10, 5], ['d', 104, 511, 13, 7], ['d', 253, 523, 11, 6], ['d', 301, 538, 4, 2], ['d', 280, 559, 8, 6],
  ['d', 426, 569, 3, 2], ['d', 308, 580, 8, 6], ['d', 289, 590, 4, 4], ['d', 287, 654, 8, 5], ['d', 299, 688, 16, 11],
  ['d', 306, 693, 9, 6], ['d', 150, 699, 15, 10], ['d', 528, 698, 6, 4], ['d', 864, 653, 3, 2], ['d', 931, 702, 4, 3],
  ['d', 1017, 713, 5, 4],
];
// measured per-flower k=2 sway and k=3 nod of the head x-centroid over all 240 frames (flowers tracked in
// >= 90% of frames): phase g/n (cycles, peak rightward at k*t/L = phase) and amplitude ga/na (px).
const MEASURED = {
  '50,436': { g: 0.901, n: 0.697, ga: 3.52, na: 3.26 }, '236,514': { g: 0.068, n: 0.138, ga: 3.02, na: 3.7 },
  '356,550': { g: 0.032, n: 0.093, ga: 1.65, na: 3.92 }, '647,624': { g: 0.693, n: 0.949, ga: 1.04, na: 0.64 },
  '732,672': { g: 0.749, n: 0.759, ga: 2.37, na: 3.18 }, '787,699': { g: 0.798, n: 0.811, ga: 3.78, na: 4.17 },
  '115,481': { g: 0.011, n: 0.412, ga: 4.4, na: 4.08 }, '104,511': { g: 0.06, n: 0.124, ga: 5.07, na: 4.05 },
  '253,523': { g: 0.114, n: 0.185, ga: 3.61, na: 4.37 }, '308,580': { g: 0.212, n: 0.193, ga: 2.62, na: 4.36 },
  '299,688': { g: 0.42, n: 0.24, ga: 1.97, na: 5.0 /* 7.8 measured, merged with a neighbour; capped */ },
  '150,699': { g: 0.29, n: 0.165, ga: 4.72, na: 6.25 },
};
const NOD = { k: 3, px: 3.7, ph: 0.19 }; // defaults for untracked flowers: median amplitude / phase of the tracked ones
const SWAY = { px: 3.3 };                // default k=2 head amplitude (median of tracked)

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export default function flowers(ctx) {
  const P = 'flowers';
  const c = (e) => ctx.cls(P, e);
  const v = (n) => ctx.prop(P, n);
  const rnd = mulberry32(7331);
  const R = (x) => ctx.r(x, 1);
  const deg = (r) => ctx.r((Math.atan(r) * 180) / Math.PI, 2);

  const html = FLOWERS.map(([type, x, y, w0, h0]) => {
    const w = w0 + 1, h = h0 + 1;
    const ls = 12 + Math.max(0, y - 430) * 0.07;            // chosen stem length (perspective-scaled)
    const m = MEASURED[`${x},${y}`];
    const gph = m ? m.g : GUST.PH0 + GUST.PX * x + GUST.PY * y;
    const nph = m ? m.n : NOD.ph + (rnd() - 0.5) * 0.15;
    const ga = deg((m ? m.ga : SWAY.px) / ls), na = deg((m ? m.na : NOD.px) / ls);
    return `<i class="${c('f')} ${c(type === 'd' ? 'daisy' : 'buttercup')}" style="left:${x}px;top:${R(y + ls)}px;` +
      `animation-delay:${ctx.phase(GUST.k, -gph)};${v('ga')}:${ga}deg">` +
      `<b class="${c('n')}" style="left:${R(-w / 2)}px;top:${R(-(ls + h / 2))}px;width:${w}px;height:${R(ls + h / 2)}px;` +
      `${v('hh')}:${h}px;${v('na')}:${na}deg;animation-delay:${ctx.phase(NOD.k, -nph)}"></b></i>`;
  }).join('\n');

  const css = `
.v2c-wind .${c('field')} {
  ${v('daisy')}: #f4f0da;      /* measured: daisy petals (blob mean ≈ #f0ebd2, rim lighter) */
  ${v('buttercup')}: #f2bf08;  /* measured: buttercup heads (blob mean #e6bb06…#f3c403) */
  ${v('size')}: 1;             /* flower size scale about the stem foot */
  ${v('stem')}: #4f8530;       /* estimated: stems are hidden in the grass in the reference */
  position: absolute; inset: 0; pointer-events: none;
}
.v2c-wind .${c('f')} {
  position: absolute; display: block; width: 0; height: 0;
  transform-origin: 0 0; scale: var(${v('size')}, 1);
  animation: ${ctx.kf(P, 'sway')} ${ctx.per(GUST.k)} ease-in-out infinite;
}
.v2c-wind .${c('n')} {
  position: absolute; display: block; transform-origin: 50% 100%;
  animation: ${ctx.kf(P, 'nod')} ${ctx.per(NOD.k)} ease-in-out infinite;
}
.v2c-wind .${c('n')}::before {
  content: ''; position: absolute; left: calc(50% - 0.7px); width: 1.4px; top: calc(var(${v('hh')}) / 2); bottom: 0;
  background: var(${v('stem')}, #4f8530); border-radius: 1px;
}
.v2c-wind .${c('n')}::after {
  content: ''; position: absolute; left: 0; top: 0; width: 100%; height: var(${v('hh')}); border-radius: 50%;
}
.v2c-wind .${c('daisy')} .${c('n')}::after {
  background: radial-gradient(closest-side, #e2a91a 0 26%, var(${v('daisy')}, #f4f0da) 38% 78%, color-mix(in srgb, var(${v('daisy')}, #f4f0da) 70%, #9fb070) 100%);
}
.v2c-wind .${c('buttercup')} .${c('n')}::after {
  background: radial-gradient(closest-side, color-mix(in srgb, var(${v('buttercup')}, #f2bf08) 80%, #fff6a0) 0 30%, var(${v('buttercup')}, #f2bf08) 60%, color-mix(in srgb, var(${v('buttercup')}, #f2bf08) 75%, #b87a00) 100%);
}
@keyframes ${ctx.kf(P, 'sway')} {
  0%, 100% { transform: rotate(calc(var(--v2c-wind-wind) * var(${v('ga')}))); }
  50% { transform: rotate(calc(var(--v2c-wind-wind) * -1 * var(${v('ga')}))); }
}
@keyframes ${ctx.kf(P, 'nod')} {
  0%, 100% { transform: rotate(calc(var(--v2c-wind-wind) * var(${v('na')}))); }
  50% { transform: rotate(calc(var(--v2c-wind-wind) * -1 * var(${v('na')}))); }
}`;

  return {
    html: `<div class="${c('field')}">\n${html}\n</div>`,
    css,
    controls: [
      { name: v('daisy'), kind: 'runtime', type: 'color', default: '#f4f0da', range: null, variant: '#ff8fc8', description: 'daisy petal colour' },
      { name: v('buttercup'), kind: 'runtime', type: 'color', default: '#f2bf08', range: null, variant: '#ff5a1f', description: 'buttercup colour' },
      { name: v('size'), kind: 'runtime', type: 'number', default: '1', range: ['0.5', '2'], variant: '1.8', description: 'flower size (head and stem) about the stem foot' },
    ],
    tracks: [
      { part: 'flowers-daisy-a', selector: `.${c('daisy')}`, color: '#f0ebd2', tolerance: 45, roi: [92, 466, 46, 28] },
      { part: 'flowers-daisy-b', selector: `.${c('daisy')}`, color: '#f0f2dc', tolerance: 45, roi: [126, 682, 48, 34] },
      { part: 'flowers-buttercup', selector: `.${c('buttercup')}`, color: '#f1c403', tolerance: 55, roi: [336, 534, 40, 32] },
    ],
  };
}

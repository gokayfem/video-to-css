// Hill: ridge silhouette, lit upper/lower slopes, the teal cloud-shadow band and its
// moving left shoulder, plus the dark base of the foreground bank.
// Geometry comes from build/data/hill.json (column scans of the reference, medians over
// time); colours are loop-mean samples (work/wind/mean240.png):
//   crest left #73ab33, upper slope right #c3d325, band #007769, lower slope #aec404…#baca02,
//   foreground bank #4e7f31, far-right haze #b2d090.
import { readFileSync } from 'node:fs';
const D = JSON.parse(readFileSync(new URL('../data/hill.json', import.meta.url), 'utf8'));

export default function hill(ctx) {
  const c = (el) => ctx.cls('hill', el);
  const P = (n) => ctx.prop('hill', n);
  const { W, H } = ctx;
  const xs = [0, ...D.xs.slice(1), W]; // pin the first/last columns to the stage edges
  const at = (arr) => [arr[0], ...arr.slice(1), arr.at(-1)];
  const ridge = at(D.ridge), top = at(D.bandTop), bot = at(D.bandBottom);
  const pts = (ys) => xs.map((x, i) => `${x}px ${ys[i]}px`);
  const rev = (a) => [...a].reverse();

  const ground = `polygon(${[...pts(ridge), `${W}px ${H}px`, `0px ${H}px`].join(', ')})`;
  const upper = `polygon(${[...pts(ridge), ...rev(pts(top))].join(', ')})`;
  // band bottom edge breathes 3× per loop: bottom ≈ mean + 4.54 px · cos(2π·3t/10 − 2.21)
  // (measured Fourier fit on x 700–1200; weighted in from x = 500 to 700, left edge hidden by grass)
  const w = (x) => Math.max(0, Math.min(1, (x - 500) / 200));
  const bandAt = (f) => `polygon(${[...pts(top), ...rev(xs.map((x, i) => `${x}px ${ctx.r(bot[i] + w(x) * 4.54 * Math.cos(2 * Math.PI * f - 2.21), 1)}px`))].join(', ')})`;
  const band = bandAt(0);
  const bandKfs = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].map((f) => `  ${f * 100}% { clip-path: ${bandAt(f)}; }`).join('\n');

  // left shoulder: band top edge sweeps between the ridge and the band (fitted keyframes)
  const L = xs.filter((x) => x < 520);
  const shoulderAt = (k) => {
    const row = at(D.shoulderTop[k]);
    const ys = L.map((_, i) => Math.max(ridge[i], Math.min(bot[i] - 2, row[i] ?? bot[i] - 2)));
    return `polygon(${[...L.map((x, i) => `${x}px ${ys[i]}px`), ...rev(L.map((x, i) => `${x}px ${bot[i]}px`))].join(', ')})`;
  };
  // thin sunlit rim on the crest (visible above the shadow on the left shoulder)
  const R = xs.filter((x) => x <= 720);
  const rim = `polygon(${[...R.map((x, i) => `${x}px ${ridge[i] - 0.5}px`), ...rev(R.map((x, i) => `${x}px ${ridge[i] + 5}px`))].join(', ')})`;
  const HZ = xs.filter((x) => x >= 880);
  const hz0 = xs.indexOf(HZ[0]);
  const haze = `polygon(${[...HZ.map((x, i) => `${x}px ${ridge[hz0 + i] - 0.5}px`), ...rev(HZ.map((x, i) => `${x}px ${ridge[hz0 + i] + 12}px`))].join(', ')})`;
  const kfs = D.shoulderTimes.map((t, k) => `  ${ctx.r((t / 10) * 100, 3)}% { clip-path: ${shoulderAt(k)}; }`).join('\n');

  return {
    html: `<div class="${c('ground')}"></div>
<div class="${c('upper')}"></div>
<div class="${c('band')}"></div>
<div class="${c('shoulder')}"></div>
<div class="${c('rim')}"></div>
<div class="${c('haze')}"></div>
<div class="${c('bank')}"></div>`,
    css: `
.v2c-wind .${c('ground')}, .v2c-wind .${c('upper')}, .v2c-wind .${c('band')}, .v2c-wind .${c('shoulder')}, .v2c-wind .${c('bank')} { position: absolute; inset: 0; }
.v2c-wind .v2c-wind__layer--hill { ${P('lit')}: #aec404; ${P('shade')}: #007769; }
.v2c-wind .${c('ground')} {
  clip-path: ${ground};
  background:
    linear-gradient(180deg, #a2c418 380px, var(${P('lit')}) 600px, #b6c904 720px);
}
.v2c-wind .${c('upper')} {
  clip-path: ${upper};
  background: linear-gradient(90deg, #73ab33 0px, #86b930 380px, #a9c92c 700px, #c3d325 1000px, #c1d22a 1280px);
}
.v2c-wind .${c('band')}, .v2c-wind .${c('shoulder')} {
  background: linear-gradient(180deg, #007265, var(${P('shade')}) 40%, #007b6b);
}
.v2c-wind .${c('band')} { clip-path: ${band}; animation: ${ctx.kf('hill', 'band')} ${ctx.per(3)} linear infinite; }
@keyframes ${ctx.kf('hill', 'band')} {
${bandKfs}
}
.v2c-wind .${c('haze')} { position: absolute; inset: 0; clip-path: ${haze}; background: linear-gradient(180deg, rgb(178 208 144 / 0.9), rgb(178 208 144 / 0)); }
.v2c-wind .${c('rim')} { position: absolute; inset: 0; clip-path: ${rim}; background: linear-gradient(90deg, #b5d02a, #c4d63a 400px, #b9cf2c 720px); }
.v2c-wind .${c('shoulder')} {
  clip-path: ${shoulderAt(0)};
  animation: ${ctx.kf('hill', 'shoulder')} var(--v2c-wind-loop) linear infinite;
}
@keyframes ${ctx.kf('hill', 'shoulder')} {
${kfs}
}
.v2c-wind .${c('bank')} {
  /* lower-left: the reference's darkness here comes from grass blades (grass part), not the ground;
     only a faint cool tint under the bank remains */
  background: radial-gradient(ellipse 520px 200px at 140px 740px, rgb(70 125 45 / 0.35) 0%, rgb(70 125 45 / 0) 100%);
}`,
    controls: [
      { name: P('lit'), kind: 'runtime', type: 'color', default: '#aec404', range: null, variant: '#d9a441', description: 'sunlit lower slope colour' },
      { name: P('shade'), kind: 'runtime', type: 'color', default: '#007769', range: null, variant: '#3b3f7a', description: 'cloud-shadow band colour' },
    ],
    tracks: [
      // teal shadow on the left shoulder: its centroid moves as the shadow edge sweeps
      { part: 'shadow-shoulder', selector: `.${c('shoulder')}`, color: '#007769', tolerance: 40, roi: [0, 380, 330, 120] },
    ],
  };
}

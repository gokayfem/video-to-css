// Turbines: tower, nacelle, spinner and a 3-blade rotor per turbine.
//
// Rotor model (measured): the swept disc is seen obliquely, so each rotor is a unit
// disc (radius 100 px) mapped to the screen by an affine matrix solved from the three
// blade tips at frame 0 (hub = mean of tips; c1 = tip0 - hub; c2 from tip1, 120° on).
// Inside that plane a linear rotate() spins k × 120° per loop (k measured from the
// ring-profile fit: 6, 7, 6), which keeps the 10 s loop seamless.
// Spin is screen-clockwise in the reference; the tip permutation is chosen to match.
const TURBINES = [
  // tips: frame-0 blade tips read from gridded zoom crops (stage px); k: thirds per loop (measured)
  { id: 't1', hub: [372, 135], tips: [[410, 59], [261, 98.5], [425, 251]], k: 6,
    tower: { top: [345, 145, 9], base: [340.5, 412, 15] }, nacelle: [330, 130, 52, 22, -8], spinner: 9 },
  { id: 't2', hub: [512.5, 282], tips: [[538, 244.5], [457.5, 257], [528.75, 347.5]], k: 7,
    tower: { top: [497, 288, 5], base: [494, 445, 8] }, nacelle: [485, 276, 30, 12, -6], spinner: 5 },
  { id: 't3', hub: [610.6, 355], tips: [[617.75, 316.25], [581.9, 354.4], [627, 393]], k: 6,
    tower: { top: [601, 359, 3.5], base: [599, 472, 5.5] }, nacelle: [594, 352, 18, 7, -4], spinner: 3 },
  // far turbines in front of the big cloud: too small to measure blades reliably (chosen k = 5)
  { id: 't4', tips: [[709, 386], [690, 398], [704, 412]], k: 5,
    tower: { top: [701, 402, 2.2], base: [700, 492, 3.2] }, nacelle: [695, 396, 10, 4, -4], spinner: 2 },
  { id: 't5', tips: [[795, 418], [780, 427], [792, 438]], k: 5,
    tower: { top: [789, 430, 1.8], base: [789, 506, 2.6] }, nacelle: [785, 426, 8, 3.5, -4], spinner: 1.6 },
];

// Hub = the measured spinner when given (perspective makes the tips' mean drift off the hub,
// ~7 px on T1); the disc axes are then the least-squares first harmonic of the three tips.
function rotorMatrix(tips, hubIn) {
  const hub = hubIn ?? [0, 1].map((j) => tips.reduce((s, q) => s + q[j], 0) / 3);
  const u = tips.map((q) => [q[0] - hub[0], q[1] - hub[1]]);
  for (const order of [[0, 1, 2], [0, 2, 1]]) {
    const th = [0, 1, 2].map((i) => (i * 2 * Math.PI) / 3);
    const c1 = [0, 1].map((j) => (2 / 3) * order.reduce((s, ti, i) => s + u[ti][j] * Math.cos(th[i]), 0));
    const c2 = [0, 1].map((j) => (2 / 3) * order.reduce((s, ti, i) => s + u[ti][j] * Math.sin(th[i]), 0));
    // decreasing disc angle moves tip0 with velocity -c2; require screen-clockwise (y down)
    if (c1[0] * -c2[1] - c1[1] * -c2[0] > 0) return { hub, c1, c2 };
  }
  throw new Error('no clockwise permutation');
}

export default function turbines(ctx) {
  const c = (el) => ctx.cls('turbines', el);
  const P = (n) => ctx.prop('turbines', n);
  const r = ctx.r;
  let html = '', css = '';
  for (const t of TURBINES) {
    const { hub, c1, c2 } = rotorMatrix(t.tips, t.hub);
    const tw = t.tower;
    const [nx, ny, nw, nh, nrot] = t.nacelle;
    html += `<div class="${c('turbine')} ${c(t.id)}">
  <div class="${c('tower')}"></div>
  <div class="${c('nacelle')}"></div>
  <div class="${c('plane')}"><div class="${c('spin')}"><i class="${c('blade')}"></i><i class="${c('blade')}"></i><i class="${c('blade')}"></i></div></div>
  <div class="${c('spinner')}"></div>
</div>\n`;
    // tower: trapezoid from (top x, y, width) to (base x, y, width)
    const x0 = Math.min(tw.top[0] - tw.top[2] / 2, tw.base[0] - tw.base[2] / 2), x1 = Math.max(tw.top[0] + tw.top[2] / 2, tw.base[0] + tw.base[2] / 2);
    const W = x1 - x0, H = tw.base[1] - tw.top[1];
    const pct = (x) => `${r(((x - x0) / W) * 100, 2)}%`;
    css += `
.v2c-wind .${c(t.id)} .${c('tower')} {
  left: ${r(x0)}px; top: ${r(tw.top[1])}px; width: ${r(W)}px; height: ${r(H)}px;
  clip-path: polygon(${pct(tw.top[0] - tw.top[2] / 2)} 0, ${pct(tw.top[0] + tw.top[2] / 2)} 0, ${pct(tw.base[0] + tw.base[2] / 2)} 100%, ${pct(tw.base[0] - tw.base[2] / 2)} 100%);
}
.v2c-wind .${c(t.id)} .${c('nacelle')} { left: ${r(nx)}px; top: ${r(ny)}px; width: ${r(nw)}px; height: ${r(nh)}px; transform: rotate(${nrot}deg); }
.v2c-wind .${c(t.id)} .${c('plane')} { left: ${r(hub[0])}px; top: ${r(hub[1])}px;
  transform: matrix(${r(c1[0] / 100, 4)}, ${r(c1[1] / 100, 4)}, ${r(c2[0] / 100, 4)}, ${r(c2[1] / 100, 4)}, 0, 0); }
.v2c-wind .${c(t.id)} .${c('spin')} { animation-name: ${ctx.kf('turbines', `spin${t.k}`)}; }
.v2c-wind .${c(t.id)} .${c('spinner')} { left: ${r(hub[0] - t.spinner)}px; top: ${r(hub[1] - t.spinner * 0.85)}px; width: ${r(t.spinner * 2)}px; height: ${r(t.spinner * 1.7)}px; }`;
  }
  const ks = [...new Set(TURBINES.map((t) => t.k))];
  css = `
.v2c-wind .v2c-wind__layer--turbines { ${P('body')}: #eef2f6; ${P('shade')}: #c3d0de; }
.v2c-wind .${c('turbine')} > * { position: absolute; }
.v2c-wind .${c('tower')} { background: linear-gradient(90deg, var(${P('shade')}) 0%, var(${P('body')}) 45%, var(${P('body')}) 70%, #d7e0ea 100%); }
.v2c-wind .${c('nacelle')} { border-radius: 45% 50% 50% 45% / 50%; transform-origin: 100% 50%;
  background: linear-gradient(180deg, #fbfcfd 0%, var(${P('body')}) 45%, var(${P('shade')}) 100%); }
.v2c-wind .${c('spinner')} { border-radius: 50%; background: radial-gradient(circle at 60% 35%, #ffffff, var(${P('body')}) 55%, var(${P('shade')})); }
.v2c-wind .${c('plane')} { width: 0; height: 0; transform-origin: 0 0; }
.v2c-wind .${c('spin')} { position: absolute; left: 0; top: 0; width: 0; height: 0;
  animation-duration: var(--v2c-wind-loop); animation-timing-function: linear; animation-iteration-count: infinite; }
/* blade in disc units: root at the hub, tip at radius 100 along +x, tapered and slightly cambered */
.v2c-wind .${c('blade')} { position: absolute; left: 4px; top: -6.5px; width: 96px; height: 13px; transform-origin: -4px 50%;
  clip-path: polygon(0 22%, 22% 0, 60% 22%, 100% 44%, 100% 56%, 60% 74%, 22% 100%, 0 78%); /* max chord ~22% out, as in the zoom crops */
  background: linear-gradient(180deg, var(${P('body')}) 0 55%, var(${P('shade')}) 100%); }
.v2c-wind .${c('blade')}:nth-child(2) { transform: rotate(120deg); }
.v2c-wind .${c('blade')}:nth-child(3) { transform: rotate(240deg); }
${ks.map((k) => `@keyframes ${ctx.kf('turbines', `spin${k}`)} { from { transform: rotate(0deg); } to { transform: rotate(${-120 * k}deg); } }`).join('\n')}
` + css;
  return {
    html,
    css,
    controls: [
      { name: P('body'), kind: 'runtime', type: 'color', default: '#eef2f6', range: null, variant: '#ff7a59', description: 'turbine paint (lit)' },
      { name: P('shade'), kind: 'runtime', type: 'color', default: '#c3d0de', range: null, variant: '#8a3a2a', description: 'turbine paint (shaded side)' },
    ],
    tracks: [
      // half-disc ROIs on the sky side of each big rotor: the blade centroid moves as the rotor turns
      { part: 'rotor-t1', selector: `.${c('t1')} .${c('spin')}`, color: '#e8eef4', tolerance: 45, roi: [372, 20, 110, 100] },
      { part: 'rotor-t2', selector: `.${c('t2')} .${c('spin')}`, color: '#e8eef4', tolerance: 45, roi: [512, 225, 50, 50] },
    ],
  };
}

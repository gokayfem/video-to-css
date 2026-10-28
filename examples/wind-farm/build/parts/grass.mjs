// Grass: blade tufts on top of the hill's painted ground.
// - Placement/density from a measured 20-px region map of reference frame 0 (rows y = 380…700),
//   shade per cell from the mean colour of its dark (blade) pixels. See build/notes/grass.md.
// - Each tuft is ONE element: the element itself carries the gust rotation (k = 2 per loop, phase
//   travelling across the meadow, fitted plane), its ::before carries the flutter (k = 7) and draws
//   the tuft (one clip-path polygon tracing 2–7 tapered curved blades, root→tip gradient).
// - transform-origin is the tuft base (50% 100%) on both levels.
// Deterministic: seeded PRNG, so rebuilding gives identical CSS/HTML.

// Region map (measured, frame 0, 20x20 px cells from y = 380): '.' sky/cloud, 't' teal shadow band,
// 'D' >75% dark (blade) pixels, 'd' 45–75%, 'm' 15–45%, 'l' lit ground.
const MAP = `
tmlmmmd.........................................................
ttttttttdmmmmmlm................................................
ttttttttttttlmlllllmmm..........................................
ttttttttttttttttttlllllll.......................................
ldDtmdtmtttttttttttttttttlll....................................
mdmldddDdtttttttttttttttttttttttt...............................
dmmmlmDDdDDdmttttttttttttttttttttttttml.........................
DdllmmDdDDDDddmmmmllllllllltttttttttttttllllmlll................
DDdmmmdDdDDDdDDddddlllllllllllllllllltttttttllllllllllllllllllll
dmDDdddDDDDDDDDdDDdddmlmllllllllllllllllttttttdmmlllllllllllllll
mdDDDDDDDDDDDDddDDDDDdmdllllllllllllllllllllttttttttllllllllllll
DDDDDDDDDDDDDDDDDDdDDDDdmmmllllllmllllllllllllltttttttttllllllll
DDDDDDDDDDDDDDDDDDDDDDddddddldmmmmmllllllllllllllllttttttttlllll
DDDDDDDDDDDDDDDDDDDDDDdDDmddddmdddmmmlmllmlllllllllllllttttttttl
DDDDDDDDDDDDDDDDDDDDDDDDDDDDDmdmddmdmddldllllllllllllllllllttttt
dDDDDDDdDDDDDDddDDDDDDDDDDDDDDDDDdDDDDDdddlllllllllllllllllllltt
DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDddddmmmmmmmlllllllllllllll`.trim().split('\n');
// Shade per cell (measured): projection of the cell's dark-pixel mean colour onto the
// dark #3f7130 → light #9cbc22 axis, 0…9 ('-' = no blade pixels).
const SHADE = `
2232223324434---------------------------------------------------
1-----3444453345342---------------------------------------------
0-4-------233322--444345----------------------------------------
3310-----------144233314----------------------------------------
1101121121-----------33332131332--------------------------------
2342000011110-------------------1223----------------------------
14546211211223322------------------23454335---------------------
1455510111222445654433343334344432----101365434454554-----------
0234522123433233344666-------7---43443----1212------5-----------
2223323223333223225455767777-7768-----3223--1111115-------------
4332223222112232333234567866656565787--7-3331--01013313---------
2322111211113122233433555446655772-676-6--7831222-----01125-----
2111112111121222233323553234545565555546--5-----43332-----1222--
01101102213213322222234335454455445456565666-6-4---622220----110
111001332211222112222432444445454555555647-7-66----6----1211----
22110123233232122232332233435444454455554367-66656----------1111
21022232222222222132233232333344333334455566646657-7--77--6----2`.trim().split('\n');
const Y0 = 380, C = 20;

// Gust phase plane (fitted, see notes): peak rightward bend at k*t/L = PH0 + PX*x + PY*y.
export const GUST = { k: 2, PH0: -0.899, PX: 0.0008, PY: 0.0015 }; // PH0 incl. -0.05 render-fit correction
const FLUTTER = { k: 7, PH: 0.18 };       // fitted: coherent across the bank
// lead pass: chosen ×3 / ×2.5 over the worker's cell-shift fit (0.4° / 0.14°), which averages out tip motion
// (sbs at t = 0 / 1.25 / 2.5 s showed the reference's bundles leaning visibly more)
const GUST_DEG = 1.2, FLUTTER_DEG = 0.35;

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// One tuft polygon in % of its box. Box aspect a = w/h. Blades: quadratic curves from the
// base row up and to the right, tapered to a point.
function tuftShape(rnd, { blades, aspect, leanMin, leanMax, baseW, straightP = 0.25 }) {
  const pts = [];
  const order = [];
  for (let b = 0; b < blades; b++) order.push(b);
  for (const b of order) {
    const u0 = 0.12 + 0.36 * (blades === 1 ? 0.5 : b / (blades - 1)) + (rnd() - 0.5) * 0.08;
    const straight = rnd() < straightP;
    const lean = straight ? leanMin * 0.4 + rnd() * leanMin * 0.6 : leanMin + rnd() * (leanMax - leanMin);
    const v1 = rnd() * 0.3 + (straight ? 0 : 0.05);  // tip height (0 = box top)
    const u1 = Math.min(0.98, u0 + lean);
    // control point high above the root: the blade rises, then arcs over to the right
    const cu = u0 + lean * (0.0 + rnd() * 0.15), cv = v1 * 0.4 + (1 - v1) * (0.05 + rnd() * 0.3);
    const hw = baseW * (0.7 + rnd() * 0.6);         // half width at the root, fraction of box width
    const N = 6, left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const s = i / N, q = 1 - s;
      // bezier P0=(u0,1) P1=(cu,cv) P2=(u1,v1), in pixel-ish space (x scaled by aspect)
      const x = q * q * u0 + 2 * q * s * cu + s * s * u1, y = q * q * 1 + 2 * q * s * cv + s * s * v1;
      const dx = (2 * q * (cu - u0) + 2 * s * (u1 - cu)) * aspect, dy = 2 * q * (cv - 1) + 2 * s * (v1 - cv);
      const len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;  // unit normal (px space)
      const wdt = hw * aspect * Math.pow(q, 0.55);
      const ox = (nx * wdt) / aspect, oy = ny * wdt;
      if (i < N) { left.push([x - ox, y - oy]); right.push([x + ox, y + oy]); } else left.push([x, y]);
    }
    pts.push(...left, ...right.reverse());
  }
  return 'polygon(' + pts.map(([x, y]) => `${(Math.max(0, Math.min(1, x)) * 100).toFixed(1)}% ${(Math.max(0, Math.min(1, y)) * 100).toFixed(1)}%`).join(',') + ')';
}

export default function grass(ctx) {
  const P = 'grass';
  const c = (e) => ctx.cls(P, e);
  const v = (n) => ctx.prop(P, n);
  const rnd = mulberry32(20261028);

  // Shape library (chosen): bank tufts (tall, 4–7 blades) and lit-slope tufts (short, 2–4 blades).
  const BANK_SHAPES = 14, LIT_SHAPES = 8, BANK_ASPECT = 0.95, LIT_ASPECT = 1.25;
  const shapes = [];
  for (let i = 0; i < BANK_SHAPES; i++) shapes.push(tuftShape(rnd, { blades: 4 + Math.floor(rnd() * 4), aspect: BANK_ASPECT, leanMin: 0.25, leanMax: 0.7, baseW: 0.026 }));
  for (let i = 0; i < LIT_SHAPES; i++) shapes.push(tuftShape(rnd, { blades: 2 + Math.floor(rnd() * 3), aspect: LIT_ASPECT, leanMin: 0.3, leanMax: 0.65, baseW: 0.04, straightP: 0.1 }));

  // Density per region class (chosen; tuned to the element budget).
  const RATE = { D: 1.6, d: 1.05, m: 0.55, l: 0.25 }; // lead pass: thinner bank and lit slope (reference shows the bright slope through the blades)
  // right edge of the dense bank (estimated from frame 0): bank-type tufts only left of it, small tufts elsewhere
  const bankEdge = (y) => y < 450 ? -1 : y < 540 ? 300 + (y - 450) * 2 : y < 660 ? 480 + (y - 540) * 2.3 : 760 + (y - 660) * 1.5;
  const tufts = [];
  MAP.forEach((row, r) => [...row].forEach((ch, col) => {
    const cx = col * C + C / 2, cy = Y0 + r * C + C / 2;
    const isBank = ch !== 'l' && cx < bankEdge(cy);
    const rate = isBank ? RATE[ch] : (RATE[ch] ? RATE.l : 0); if (!rate) return;
    let n = Math.floor(rate) + (rnd() < rate % 1 ? 1 : 0);
    for (let j = 0; j < n; j++) {
      const px = col * C + rnd() * C, py = Y0 + r * C + rnd() * C;
      const sd = SHADE[r][col];
      // per-tuft tone spread around the cell's measured shade (chosen ±0.25) gives dark/light stroke interleave
      const base = sd === '-' ? (ch === 'l' ? 0.5 : 0.25) : (+sd + rnd()) / 10;
      const shade = Math.max(0, Math.min(1, !isBank ? 0.55 + rnd() * 0.3 : base + (rnd() - 0.5) * 0.5));
      if (!isBank) {
        if (py < 470) continue; // the far upper slope reads as flat paint in the reference
        const h = (7 + (py - 470) * 0.07) * (0.7 + rnd() * 0.6);
        tufts.push({ kind: 'lit', px, py, h, w: h * LIT_ASPECT, bx: px - h * LIT_ASPECT * 0.3, by: py + h * 0.15, shade });
      } else {
        // bank: the sampled point lies in the upper part of the tuft (tips cover the map cell)
        const h = (38 + Math.max(0, py - 440) * 0.42) * (0.7 + rnd() * 0.6);
        const f = 0.15 + rnd() * 0.45;
        const w = h * BANK_ASPECT;
        tufts.push({ kind: 'bank', px, py, h, w, bx: px - w * (0.25 + rnd() * 0.35), by: py - f * h + h, shade });
      }
    }
  }));
  // paint far→near (smaller base y first), so nearer tufts overlap farther ones
  tufts.sort((a, b) => a.by - b.by);

  const R = (x) => ctx.r(x, 1);
  const html = tufts.map((t) => {
    const s = t.kind === 'bank' ? Math.floor(rnd() * BANK_SHAPES) : BANK_SHAPES + Math.floor(rnd() * LIT_SHAPES);
    const gph = GUST.PH0 + GUST.PX * t.px + GUST.PY * t.py;
    const fph = FLUTTER.PH + (rnd() - 0.5) * 0.12;
    const amp = ctx.r(0.7 + rnd() * 0.6, 2);
    // shade → mix weights of the dark / light controls (root darker, tip lighter)
    const root = Math.round(Math.max(0, Math.min(100, (t.shade - 0.18) * 100)));
    const tip = Math.round(Math.max(0, Math.min(100, (t.shade + (t.kind === 'bank' ? 0.22 : 0.1)) * 100)));
    const teal = t.kind === 'bank' && t.shade < 0.2 ? 35 : 0;
    return `<i class="${c('t')} ${c('s' + s)}" style="left:${R(t.bx)}px;top:${R(t.by - t.h)}px;width:${R(t.w)}px;height:${R(t.h)}px;` +
      `animation-delay:${ctx.phase(GUST.k, -gph)};${v('a')}:${amp};${v('r')}:${root}%;${v('l')}:${tip}%;${v('q')}:${teal}%;${v('fd')}:${ctx.phase(FLUTTER.k, -fph)}"></i>`;
  }).join('\n');

  const css = `
.v2c-wind .${c('field')} {
  ${v('dark')}: #3f7130;   /* measured: bank blade shadow green (p05 #3f732e) */
  ${v('light')}: #a8c21e;  /* measured: lit blade tips / lit ground blend (p95 #abc418) */
  ${v('shadow')}: #1f6e58; /* measured: blades inside the teal cast-shadow band */
  ${v('height')}: 1;       /* blade height scale */
  position: absolute; inset: 0; pointer-events: none;
}
/* tuft = gust level (k = ${GUST.k}/loop); ::before = flutter level (k = ${FLUTTER.k}/loop) + drawing */
.v2c-wind .${c('t')} {
  position: absolute; display: block;
  transform-origin: 50% 100%;
  scale: 1 var(${v('height')}, 1);
  animation: ${ctx.kf(P, 'gust')} ${ctx.per(GUST.k)} ease-in-out infinite;
}
.v2c-wind .${c('t')}::before {
  content: ''; position: absolute; inset: 0;
  transform-origin: 50% 100%;
  background: linear-gradient(0deg,
    color-mix(in srgb, var(${v('shadow')}, #1f6e58) var(${v('q')}), color-mix(in srgb, var(${v('light')}, #a8c21e) var(${v('r')}), var(${v('dark')}, #3f7130))) 35%,
    color-mix(in srgb, var(${v('light')}, #a8c21e) var(${v('l')}), var(${v('dark')}, #3f7130)) 100%);
  animation: ${ctx.kf(P, 'flutter')} ${ctx.per(FLUTTER.k)} ease-in-out infinite;
  animation-delay: var(${v('fd')});
}
${shapes.map((s, i) => `.v2c-wind .${c('s' + i)}::before { clip-path: ${s}; }`).join('\n')}
@keyframes ${ctx.kf(P, 'gust')} {
  0%, 100% { transform: rotate(calc(var(--v2c-wind-wind) * var(${v('a')}) * ${GUST_DEG}deg)); }
  50% { transform: rotate(calc(var(--v2c-wind-wind) * var(${v('a')}) * ${-GUST_DEG}deg)); }
}
@keyframes ${ctx.kf(P, 'flutter')} {
  0%, 100% { transform: rotate(calc(var(--v2c-wind-wind) * ${FLUTTER_DEG}deg)); }
  50% { transform: rotate(calc(var(--v2c-wind-wind) * ${-FLUTTER_DEG}deg)); }
}`;

  return {
    html: `<div class="${c('field')}">\n${html}\n</div>`,
    css,
    stats: { tufts: tufts.length },
    controls: [
      { name: v('dark'), kind: 'runtime', type: 'color', default: '#3f7130', range: null, variant: '#6b4a1f', description: 'grass blade root / shadow-side colour' },
      { name: v('light'), kind: 'runtime', type: 'color', default: '#a8c21e', range: null, variant: '#e0d070', description: 'grass blade tip / sunlit colour' },
      { name: v('height'), kind: 'runtime', type: 'number', default: '1', range: ['0.4', '1.8'], variant: '1.5', description: 'grass blade height scale (about each tuft base)' },
    ],
    tracks: [
      // bank blades silhouetted against the teal band at the bank's top edge; centroid sways with gusts
      { part: 'grass-bank-top', selector: `.${c('t')}`, color: '#4c8443', tolerance: 38, roi: [180, 445, 140, 45] },
      // lower-left foreground bank (dense mid-green strokes)
      { part: 'grass-bank', selector: `.${c('t')}`, color: '#5c8a2f', tolerance: 30, roi: [20, 600, 360, 110] },
    ],
  };
}

// Clouds: painted anime cumulus as stacks of CSS circles.
//
// Geometry: each cloud mass = a full-stage drift wrapper holding
//   1. "body" circles (lit cream, darker lower-left rim) packed into the frame-0 cloud silhouette,
//   2. "shade" patches (blue-grey) packed into the frame-0 shade mask (pixels nearer #add5f3 than #f4f3e1),
//   3. "lit" lobes (cream, lit from the upper right, lower-left crescent) packed into the lit-cream mask.
// The circle tables below were fitted by greedy max-inscribed-circle packing on the decoded
// reference frame 0 (see fit() at the bottom). Regenerate with
//   node examples/wind-farm/build/parts/clouds.mjs --fit work/wind/clouds/ref/00000.png
// which rewrites the FIT block in this file (needs pngjs; never runs during a normal build).
//
// Motion (all 1 cycle per loop, seamless):
//   - each mass drifts on an ellipse x = Ax cos(2πt/L − φx), y = Ay cos(2πt/L − φy), measured per mass
//     from SSD block matching over 20 frames (t = 0…9.5 s); the keyframes subtract the t = 0 offset so
//     frame 0 lies exactly on the fitted silhouette.
//   - every circle "billows": a small circular wobble plus a scale pulse, seeded phases (chosen).

/* FIT-BEGIN */
// fitted from ref/00000.png (frame 0) — [x, y, r] in stage px
const FIT = {"masses":[{"id":"left","body":[[109,358,58.8],[161,378,41.5],[55,374,41.2],[17,384,30.5],[158,332,16.5],[137,310,11.5],[58,334,11.5],[171,340,10.8],[20,355,10.8]],"shade":[[177,370,20],[159,376,14],[147,374,13],[158,337,12.7],[102,372,11],[131,344,9.7],[173,342,9.3],[122,342,9],[151,349,9],[146,363,9],[77,373,9],[107,356,8.7],[166,326,8.3],[125,360,8.3],[109,366,8.3],[122,375,8.3],[91,329,7.3],[150,356,7.3],[93,376,7.3],[112,317,7],[117,318,7],[131,352,7],[140,338,6.7],[139,366,6.7]],"lit":[[70,318,8.5],[57,333,9.8],[52,344,9.2],[30,357,12.8],[18,360,9.5],[10,365,7.8],[0,370,10.5],[32,370,7.8]]},{"id":"left2","body":[[223,389,36.5],[282,399,33.5],[246,359,22.5],[251,409,21.5],[308,417,20.5],[191,403,18.5],[270,369,17.5],[315,399,11.5],[225,354,10.8]],"shade":[[300,391,13],[194,376,12],[276,391,10.7],[189,356,8.3],[303,380,8.3],[201,384,8.3],[193,361,8],[281,379,8],[258,392,8],[265,392,8],[309,398,8],[287,376,7.3],[249,393,6.7]],"lit":[[222,370,7.5]]},{"id":"bank","body":[[577,446,54.5],[627,460,48.5],[453,417,46.5],[526,440,45.5],[409,423,31.8],[366,418,28.2],[484,448,24.8],[335,422,19.8],[486,388,16.5],[510,400,15.2],[618,415,13.5],[345,145,11.5],[416,393,10.8],[351,396,10.5],[635,415,10.5],[382,439,10.5]],"shade":[[572,453,16],[549,447,15],[521,440,14],[585,459,12],[633,469,11],[550,434,10.7],[501,425,10],[552,425,10],[526,429,9],[532,408,8.7],[509,441,8.7],[529,414,8.3],[474,431,8.3],[579,440,8.3],[627,443,8.3],[336,402,8],[541,436,8],[549,410,7.3],[443,422,7.3],[481,428,7.3],[558,457,7.3],[623,466,7.3],[353,148,7],[497,411,7],[497,417,7],[512,417,7],[533,420,7],[532,425,7],[566,426,7],[495,436,7],[613,466,7],[508,404,6.7],[606,443,6.7],[602,457,6.7],[348,149,6.3]],"lit":[[458,377,8.2],[426,385,8.5],[412,396,9.2],[403,397,8.5],[419,402,8.5],[583,402,8.5],[397,408,10.2]]},{"id":"tower","body":[[737,451,70.5],[673,471,49.5],[712,389,37.5],[748,313,33.5],[773,507,31.5],[723,339,27.2],[770,393,26.8],[703,355,20.5],[702,508,20.5],[683,409,19.8],[773,355,18.2],[720,516,15.5],[737,518,15.5],[683,369,13.5],[747,383,11.5]],"shade":[[753,453,13.7],[742,458,11],[753,478,11],[767,452,10.7],[755,441,10],[665,475,9.7],[764,409,9],[707,480,9],[757,418,8.7],[650,424,8.7],[729,485,8.7],[713,439,8.3],[764,398,8],[758,486,7.7],[758,497,7.7],[763,335,7.3],[763,386,7.3],[766,391,7.3],[719,433,7.3],[745,483,7.3],[729,417,7],[711,446,7],[733,461,7],[734,477,7],[694,480,7],[759,339,6.7],[759,434,6.7],[687,449,6.7],[726,493,6.7]],"lit":[[759,289,9.8],[744,295,16.5],[731,311,20.5],[716,325,9.8],[740,329,13.2],[712,341,16.5],[770,351,11.2],[767,362,8.5],[696,363,19.5],[728,368,10.8],[678,370,9.5],[768,370,8.2],[687,380,13.5],[680,395,8.2],[741,399,13.5],[674,402,9.2],[688,430,12.2],[676,432,12.2],[736,432,11.8],[727,446,9.5],[660,448,15.2],[713,459,8.8],[651,460,10.8],[685,466,8.2]]},{"id":"big","body":[[936,422,70.5],[869,422,70.5],[997,449,70.5],[1062,465,70.5],[806,449,70.5],[965,362,70.5],[840,362,70.5],[903,480,70.5],[970,291,68.5],[854,240,68.2],[1026,389,64.5],[895,158,56.2],[964,507,53.5],[1017,514,51.2],[824,297,45.8],[841,506,40.5],[787,321,38.8],[903,337,38.8],[958,227,34.5],[845,176,31.8],[917,254,31.2],[871,303,30.5],[945,196,28.2],[1057,541,27.5],[804,516,26.8],[1035,294,25.2],[1065,342,24.2],[1023,328,15.8],[940,130,14.5],[817,187,14.5],[994,231,14.5],[865,536,14.5],[928,543,14.2],[905,106,13.8],[906,281,13.8],[973,177,13.5],[879,107,12.5],[787,274,11.8],[892,105,10.5],[946,142,10.5],[878,542,10.5]],"shade":[[1064,483,46.7],[1062,426,43],[1003,424,34],[921,460,29.7],[1022,500,27],[1042,354,23],[894,471,22.7],[1023,363,20.3],[984,450,20],[1018,291,19],[1068,356,18.7],[935,436,18],[997,508,18],[1001,456,17.3],[834,459,17.3],[969,366,17],[996,291,16.3],[1005,368,16.3],[877,418,16.3],[1057,385,16],[890,405,15.3],[974,306,15],[1079,343,14],[942,388,14],[864,429,14],[816,499,14],[976,217,13.7],[962,229,13.7],[1013,318,13.7],[958,377,13.7],[971,437,13.7],[928,513,13.7],[1056,370,13.3],[873,474,13.3],[928,324,13],[852,433,13],[843,445,13],[882,508,13],[1077,526,13],[942,311,12.3],[1091,396,12.3],[946,155,12],[932,267,12],[1043,387,12],[1010,522,11.7],[1017,261,11.3],[871,359,11.3],[990,368,11.3],[894,392,11.3],[841,498,11.3],[931,499,11],[982,515,11],[966,519,11],[804,362,10.7],[935,484,10.7],[819,487,10.7],[834,505,10.7],[1056,527,10.7],[815,458,10.3],[1020,471,10.3],[843,486,10.3],[1018,271,10],[878,281,10],[1035,286,10],[873,289,10],[987,303,10],[824,320,10],[1043,332,10],[881,333,10],[973,337,10],[1024,343,10],[880,362,10],[804,372,10],[993,393,10],[931,394,10],[969,460,10],[888,491,10],[916,514,10],[1065,528,10],[1037,311,9.7],[1005,392,9.7],[871,510,9.7],[948,144,9.3],[805,335,9.3],[937,400,9.3],[788,359,9],[925,370,9],[958,436,9],[775,446,9],[802,462,9],[848,479,9],[957,518,9],[907,225,8.7],[840,289,8.7],[982,295,8.7],[1060,302,8.7],[1055,308,8.7],[1002,322,8.7],[819,327,8.7],[977,330,8.7],[862,363,8.7],[918,374,8.7],[938,420,8.7],[876,433,8.7],[951,435,8.7],[779,438,8.7],[946,448,8.7],[815,477,8.7],[804,503,8.7],[939,518,8.7],[914,163,8.3],[980,206,8.3],[937,253,8.3],[866,294,8.3],[831,314,8.3],[1031,316,8.3],[795,360,8.3],[820,370,8.3],[803,441,8.3],[946,472,8.3],[924,156,8],[933,277,8],[905,288,8],[939,321,8],[917,328,8],[1080,331,8],[895,339,8],[783,405,8],[936,408,8],[820,466,8],[825,507,8],[907,516,8],[946,518,8],[929,186,7.7],[925,192,7.7],[905,232,7.7],[813,331,7.7],[972,345,7.7],[931,365,7.7],[883,453,7.7],[950,136,7.3],[982,180,7.3],[1013,252,7.3],[922,271,7.3],[995,276,7.3],[895,277,7.3],[848,284,7.3],[860,299,7.3],[961,310,7.3],[1049,312,7.3],[797,334,7.3],[905,336,7.3],[877,340,7.3],[886,353,7.3],[1073,372,7.3],[911,377,7.3],[971,420,7.3],[779,428,7.3],[1024,463,7.3],[845,470,7.3],[1047,529,7.3],[936,158,7],[903,176,7],[978,184,7],[921,197,7],[915,201,7],[950,227,7],[1000,236,7],[955,239,7],[992,260,7],[1007,262,7],[780,320,7],[1033,325,7],[1022,326,7],[1051,335,7],[890,349,7],[972,351,7],[782,363,7],[796,374,7],[884,393,7],[915,394,7],[794,445,7],[896,447,7],[943,478,7],[881,497,7],[900,516,7],[948,165,6.7],[910,168,6.7],[1026,256,6.7],[879,273,6.7],[929,282,6.7],[1062,295,6.7],[1020,308,6.7],[953,313,6.7],[1025,319,6.7],[996,325,6.7],[874,350,6.7],[863,513,6.7],[892,516,6.7]],"lit":[[900,102,8.8],[877,106,9.8],[909,115,16.2],[872,121,15.8],[939,124,8.2],[908,131,13.5],[861,133,13.8],[900,142,11.5],[851,145,13.2],[889,153,15.8],[864,159,9.8],[842,167,23.5],[819,168,8.2],[969,174,8.2],[884,176,11.2],[911,186,8.2],[882,191,14.5],[896,193,8.5],[831,195,29.2],[953,200,13.8],[938,209,14.5],[862,212,28.8],[891,213,7.5],[809,214,20.2],[935,223,9.8],[889,223,8.8],[880,234,14.5],[922,236,10.5],[800,239,18.2],[982,239,9.2],[856,240,23.2],[833,243,12.2],[915,245,10.5],[974,245,8.5],[895,248,12.8],[916,255,7.8],[965,258,15.5],[816,261,24.8],[865,263,9.5],[962,273,10.2],[786,273,9.8],[957,284,11.5],[812,286,17.5],[1050,289,7.8],[918,293,8.2],[913,301,9.5],[796,302,16.8],[871,308,8.5],[906,311,12.2],[862,316,11.2],[793,319,9.2],[849,322,14.2],[1061,326,8.2],[953,327,9.2],[1002,336,7.5],[842,341,18.2],[990,341,8.2],[944,342,11.8],[777,342,7.8],[922,349,9.5],[828,352,13.5],[909,354,13.8],[944,354,8.5],[899,363,10.8],[833,374,7.5],[870,377,8.2],[861,378,8.8],[850,386,13.2],[971,391,8.2],[834,397,19.8],[964,398,9.8],[865,398,7.8],[856,399,9.2],[957,405,9.2],[815,407,18.5],[914,409,10.8],[817,425,12.2],[862,452,9.2],[776,472,14.5],[965,480,11.5],[955,487,10.5],[776,491,13.8],[859,492,8.5],[949,496,8.5],[909,497,9.5]]},{"id":"right","body":[[1208,448,70.5],[1275,457,70.5],[1141,464,70.5],[1170,393,70.5],[1233,510,66.5],[1249,395,61.8],[1102,519,52.5],[1171,524,50.5],[1102,410,41.5],[1217,345,38.8],[1141,333,27.5],[1279,553,25.5],[1186,293,25.2],[1159,302,24.2],[1206,307,23.5],[1135,556,16.5],[1238,315,13.5],[1199,563,12.5],[1166,326,11.8],[1166,280,11.5]],"shade":[[1103,505,35],[1108,472,17.3],[1279,363,13.7],[1250,479,13.7],[1208,532,13.7],[1279,508,13],[1253,520,13],[1168,524,13],[1123,478,12.7],[1279,521,12.7],[1157,449,12.3],[1240,488,12],[1209,501,12],[1155,531,12],[1103,422,11.3],[1132,489,11.3],[1202,516,11.3],[1125,530,11.3],[1220,534,11],[1252,432,10.3],[1279,471,10.3],[1097,387,10],[1263,402,10],[1203,418,10],[1230,490,10],[1196,533,10],[1264,367,9.7],[1166,455,9.7],[1193,519,9.7],[1145,533,9.7],[1113,422,9],[1174,456,9],[1136,498,9],[1134,533,9],[1101,440,8.7],[1256,406,8.3],[1262,478,8.3],[1269,396,8],[1192,445,8],[1270,476,8],[1179,520,8],[1242,526,8],[1257,353,7.7],[1220,494,7.7],[1269,526,7.7],[1179,527,7.7],[1243,433,7.3],[1098,446,7.3],[1147,453,7.3],[1141,485,7.3],[1166,513,7.3],[1263,526,7.3],[1270,539,7.3],[1240,320,7],[1278,351,7],[1246,363,7],[1279,375,7],[1256,423,7],[1262,436,7],[1188,450,7],[1181,454,7],[1250,467,7],[1250,491,7],[1268,504,7],[1227,528,7],[1250,359,6.7],[1268,376,6.7],[1208,411,6.7],[1212,491,6.7],[1189,529,6.7]],"lit":[[1168,283,13.2],[1184,284,15.5],[1211,286,8.5],[1192,297,12.8],[1157,301,21.5],[1196,309,10.8],[1227,310,8.2],[1225,318,8.2],[1194,325,7.8],[1216,328,10.5],[1187,332,8.2],[1139,335,26.5],[1177,336,10.2],[1242,337,7.8],[1232,343,11.8],[1214,344,15.8],[1203,357,14.8],[1137,361,26.2],[1183,370,16.5],[1199,371,9.2],[1119,380,15.5],[1173,384,9.8],[1248,386,8.5],[1221,386,7.8],[1139,387,8.5],[1239,392,7.8],[1113,395,10.2],[1146,405,13.2],[1229,407,10.8],[1172,409,9.2],[1239,412,7.8],[1221,414,8.2],[1142,420,15.8],[1131,433,9.2],[1279,434,10.5],[1205,434,8.2],[1178,435,8.5],[1120,439,11.8],[1170,474,12.5],[1161,482,9.5],[1192,485,9.8],[1181,492,13.2],[1150,501,8.5],[1226,507,9.2],[1146,512,9.5]]}]};
/* FIT-END */

// Measured drift ellipses (px, deg), see notes/clouds.md. Columns: [x0, x1) of circle centres.
const MASSES = [
  { id: 'left',   x0: 0,    x1: 185,  ax: 9.13, px: -134, ay: 2.20, py: -50 },
  { id: 'left2',  x0: 185,  x1: 320,  ax: 8.55, px: -72,  ay: 2.05, py: -13 },
  { id: 'bank',   x0: 320,  x1: 645,  ax: 6.30, px: -75,  ay: 1.51, py: -28 },
  { id: 'tower',  x0: 645,  x1: 775,  ax: 9.50, px: 110,  ay: 0.65, py: 156 },
  { id: 'big',    x0: 775,  x1: 1095, ax: 9.61, px: 85,   ay: 1.11, py: -146 },
  { id: 'right',  x0: 1095, x1: 1281, ax: 7.66, px: 32,   ay: 0.44, py: 111 },
];

const LIT = '#f4f3e1', SHADE = '#add5f3';           // measured means, frame 0
const BILLOW_R = 2.5, BILLOW_S = 0.03;               // estimated lobe wobble radius (px) / scale pulse

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export default function clouds(ctx) {
  const c = (el) => ctx.cls('clouds', el);
  const P = (n) => ctx.prop('clouds', n);
  const r1 = (v) => ctx.r(v, 1);
  const rand = rng(7);
  const STEPS = 12;
  let html = '', css = '';
  let lobeIdx = 0;

  css += `
.v2c-wind .${c('root')} {
  ${P('lit')}: ${LIT};      /* lit cumulus cream (measured mean of lit pixels) */
  ${P('shade')}: ${SHADE};    /* shaded cloud body, blue-grey (measured mean) */
  ${P('drift')}: 1;          /* mass drift amplitude multiplier (1 = measured ≈ 6–10 px) */
  ${P('billow')}: 1;         /* lobe billow multiplier (wobble ${BILLOW_R}px, scale ±${BILLOW_S * 100}%) */
  position: absolute; inset: 0;
  filter: blur(0.6px);       /* soft painted edges */
}
.v2c-wind .${c('mass')} { position: absolute; inset: 0; animation: ${ctx.per(1)} linear infinite; will-change: transform; }
.v2c-wind .${c('lobe')} {
  position: absolute; border-radius: 50%; width: 2em; height: 2em;   /* font-size = lobe radius */
  animation: ${ctx.kf('clouds', 'billow')} ${ctx.per(1)} linear infinite;
}
.v2c-wind .${c('body')} {
  /* body is lit cream (most of the reference interior is lit), shading toward its lower-left rim */
  background: radial-gradient(circle at 64% 30%, var(${P('lit')}) 0%, var(${P('lit')}) 55%, color-mix(in srgb, var(${P('lit')}), var(${P('shade')}) 45%) 100%);
}
.v2c-wind .${c('shade')} {
  /* shade patch, fitted to the reference shade mask; soft rim so patches merge into undersides */
  background: radial-gradient(closest-side, var(${P('shade')}) 0%, var(${P('shade')}) 90%, color-mix(in srgb, var(${P('shade')}) 0%, transparent) 100%);
}
.v2c-wind .${c('lit')} {
  background: radial-gradient(circle at 64% 30%, color-mix(in srgb, var(${P('lit')}), white 35%) 0%, var(${P('lit')}) 28%, var(${P('lit')}) 58%, color-mix(in srgb, var(${P('lit')}), var(${P('shade')}) 22%) 84%, color-mix(in srgb, var(${P('lit')}), var(${P('shade')}) 42%) 100%);
  /* shade crescent on the lower-left rim (light from the upper right) */
  box-shadow: inset 0.2em -0.17em 0.14em -0.04em color-mix(in srgb, var(${P('lit')}), var(${P('shade')}) 62%);
}
@keyframes ${ctx.kf('clouds', 'billow')} {
${Array.from({ length: STEPS + 1 }, (_, i) => {
    const th = 2 * Math.PI * i / STEPS;
    const x = r1(BILLOW_R * Math.cos(th)), y = r1(BILLOW_R * Math.sin(th)), s = ctx.r(BILLOW_S * Math.sin(th), 4);
    return `  ${ctx.r(100 * i / STEPS, 3)}% { translate: calc(var(${P('billow')}) * ${x}px) calc(var(${P('billow')}) * ${y}px); scale: calc(1 + var(${P('billow')}) * ${s}); }`;
  }).join('\n')}
}
`;

  html += `<div class="${c('root')}">\n`;
  for (const m of MASSES) {
    const fm = FIT.masses.find((f) => f.id === m.id);
    if (!fm) continue;
    const kf = ctx.kf('clouds', `drift-${m.id}`);
    const rad = Math.PI / 180;
    const d = (th) => [m.ax * Math.cos(th - m.px * rad) - m.ax * Math.cos(-m.px * rad), m.ay * Math.cos(th - m.py * rad) - m.ay * Math.cos(-m.py * rad)];
    css += `.v2c-wind .${c('mass')}--${m.id} { animation-name: ${kf}; }\n@keyframes ${kf} {\n` +
      Array.from({ length: STEPS + 1 }, (_, i) => {
        const [x, y] = d(2 * Math.PI * i / STEPS);
        return `  ${ctx.r(100 * i / STEPS, 3)}% { translate: calc(var(${P('drift')}) * ${ctx.r(x)}px) calc(var(${P('drift')}) * ${ctx.r(y)}px); }`;
      }).join('\n') + '\n}\n';
    html += `<div class="${c('mass')} ${c('mass')}--${m.id}">\n`;
    for (const [kind, list] of [['body', fm.body], ['shade', fm.shade || []], ['lit', fm.lit]]) {
      for (const [x, y, r] of list) {
        const n = lobeIdx++;
        html += `<i class="${c('lobe')} ${c(kind)} ${c('l' + n)}"></i>`;
        css += `.v2c-wind .${c('l' + n)} { left: ${r1(x - r)}px; top: ${r1(y - r)}px; font-size: ${r1(r)}px; animation-delay: ${ctx.phase(1, rand())}; }\n`;
      }
      html += '\n';
    }
    html += `</div>\n`;
  }
  html += `</div>`;

  const controls = [
    { name: P('lit'), kind: 'runtime', type: 'color', default: LIT, range: null, variant: '#ffd2a8', description: 'lit cumulus colour (sunlit lobes); highlights and rims are mixed from it' },
    { name: P('shade'), kind: 'runtime', type: 'color', default: SHADE, range: null, variant: '#8f8fc8', description: 'shaded cloud body colour (blue-grey underside)' },
    { name: P('drift'), kind: 'runtime', type: 'number', default: '1', range: ['0', '4'], variant: '3', description: 'cloud mass drift amplitude multiplier (1 = measured 6–10 px ellipse per loop)' },
    { name: P('billow'), kind: 'runtime', type: 'number', default: '1', range: ['0', '4'], variant: '3', description: 'lobe billow multiplier (per-lobe wobble and swell)' },
  ];
  const tracks = [
    { part: 'clouds-tower-top', selector: `.${c('mass')}--big`, color: LIT, tolerance: 30, roi: [760, 80, 340, 200] },
    { part: 'clouds-right-mass', selector: `.${c('mass')}--right`, color: LIT, tolerance: 30, roi: [1100, 260, 180, 230] },
    { part: 'clouds-left-bank', selector: `.${c('mass')}--left`, color: LIT, tolerance: 30, roi: [0, 290, 190, 85] },
  ];
  return { html, css, controls, tracks };
}

// ---------------------------------------------------------------- fitter (CLI only)
async function fit(png) {
  const { PNG } = await import('pngjs');
  const fs = await import('node:fs');
  const p = PNG.sync.read(fs.readFileSync(png));
  const W = p.width, H = p.height, d = p.data;
  // hill line: first row (from y = 250) where 4 consecutive pixels have blue < 170 (green land)
  const hill = new Int32Array(W);
  for (let x = 0; x < W; x++) { let y = 250; for (; y < H - 4; y++) { let n = 0; for (let k = 0; k < 4; k++) if (d[((y + k) * W + x) * 4 + 2] < 170) n++; if (n === 4) break; } hill[x] = y; }
  const cloud = new Uint8Array(W * H), lit = new Uint8Array(W * H), shade = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (y >= hill[x] - 2) continue;
    const i = y * W + x, r = d[i * 4], b = d[i * 4 + 2];
    if (r > 150 && b > 200) { cloud[i] = 1; if (r >= 226 && b - r < 20) lit[i] = 1;
      // shade = nearer to the measured shade mean than to the lit mean
      const g = d[i * 4 + 1], dl = (r - 0xf4) ** 2 + (g - 0xf3) ** 2 + (b - 0xe1) ** 2, ds = (r - 0xad) ** 2 + (g - 0xd5) ** 2 + (b - 0xf3) ** 2;
      if (ds < dl) shade[i] = 1; }
  }
  // clouds continue under the hill: extend columns whose cloud touches the hill line by 30 px
  for (let x = 0; x < W; x++) {
    let touch = false; for (let y = hill[x] - 6; y < hill[x] - 2; y++) if (cloud[y * W + x]) touch = true;
    if (touch) for (let y = hill[x] - 2; y < Math.min(H, hill[x] + 30); y++) cloud[y * W + x] = 1;
  }
  const dt = (mask) => { // chamfer 3-4 distance to background, in px
    const D = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) D[i] = mask[i] ? 1e9 : 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!D[i]) continue; let v = D[i];
      if (x > 0) v = Math.min(v, D[i - 1] + 3); if (y > 0) { v = Math.min(v, D[i - W] + 3); if (x > 0) v = Math.min(v, D[i - W - 1] + 4); if (x < W - 1) v = Math.min(v, D[i - W + 1] + 4); } D[i] = v; }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (!D[i]) continue; let v = D[i];
      if (x < W - 1) v = Math.min(v, D[i + 1] + 3); if (y < H - 1) { v = Math.min(v, D[i + W] + 3); if (x < W - 1) v = Math.min(v, D[i + W + 1] + 4); if (x > 0) v = Math.min(v, D[i + W - 1] + 4); } D[i] = v; }
    for (let i = 0; i < W * H; i++) D[i] /= 3;
    return D;
  };
  const pack = (mask, rmin, rmax, cover, grow, max) => {
    const D = dt(mask), covered = new Uint8Array(W * H), idx = [];
    for (let i = 0; i < W * H; i++) if (D[i] >= rmin) idx.push(i);
    idx.sort((a, b) => D[b] - D[a]);
    const out = [];
    for (const i of idx) {
      if (covered[i]) continue;
      const x = i % W, y = (i / W) | 0, r = Math.min(D[i], rmax);
      out.push([x, y, Math.round((r + grow) * 10) / 10]);
      const rc = r * cover;
      for (let yy = Math.max(0, Math.floor(y - rc)); yy <= Math.min(H - 1, y + rc); yy++)
        for (let xx = Math.max(0, Math.floor(x - rc)); xx <= Math.min(W - 1, x + rc); xx++)
          if ((xx - x) ** 2 + (yy - y) ** 2 <= rc * rc) covered[yy * W + xx] = 1;
      if (out.length >= max) break;
    }
    // rendered coverage: mask pixels inside a grown circle, and painted pixels outside the mask
    const paint = new Uint8Array(W * H);
    for (const [x, y, r] of out) for (let yy = Math.max(0, Math.floor(y - r)); yy <= Math.min(H - 1, y + r); yy++)
      for (let xx = Math.max(0, Math.floor(x - r)); xx <= Math.min(W - 1, x + r); xx++) if ((xx - x) ** 2 + (yy - y) ** 2 <= r * r) paint[yy * W + xx] = 1;
    let tot = 0, cov = 0, pn = 0, fp = 0; for (let i = 0; i < W * H; i++) { if (mask[i]) { tot++; if (paint[i]) cov++; } if (paint[i]) { pn++; if (!mask[i]) fp++; } }
    return { circles: out, coverage: cov / tot, spill: fp / pn };
  };
  const body = pack(cloud, +(process.env.BR||10), 70, 0.95, 0.5, 160);
  const litp = pack(lit, +(process.env.LR||5), 45, +(process.env.LC||1.0), +(process.env.LG||0.5), +(process.env.LN||170));
  const shp = pack(shade, +(process.env.SR||2), 50, 1.0, +(process.env.SG||2), +(process.env.SN||390));
  // lit lobes must sit on a body circle (drops lit flecks on turbine towers and nacelles)
  const inBody = ([x, y]) => body.circles.some(([bx, by, br]) => (x - bx) ** 2 + (y - by) ** 2 <= (br + 2) ** 2);
  const litC = litp.circles.filter(inBody);
  const masses = MASSES.map((m) => ({
    id: m.id,
    body: body.circles.filter(([x]) => x >= m.x0 && x < m.x1).sort((a, b) => b[2] - a[2]),
    shade: shp.circles.filter(inBody).filter(([x]) => x >= m.x0 && x < m.x1).sort((a, b) => b[2] - a[2]),
    lit: litC.filter(([x]) => x >= m.x0 && x < m.x1).sort((a, b) => a[1] - b[1]),
  })).filter((m) => m.body.length);
  console.log(`body ${body.circles.length} circles (coverage ${(body.coverage * 100).toFixed(1)}%, spill ${(body.spill * 100).toFixed(1)}%), lit ${litC.length}/${litp.circles.length} (coverage ${(litp.coverage * 100).toFixed(1)}%, spill ${(litp.spill * 100).toFixed(1)}%), shade ${shp.circles.length} (coverage ${(shp.coverage * 100).toFixed(1)}%, spill ${(shp.spill * 100).toFixed(1)}%)`);
  return { masses };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()) && process.argv.includes('--fit')) {
  const png = process.argv[process.argv.indexOf('--fit') + 1];
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const self = fileURLToPath(import.meta.url);
  const data = await fit(png);
  const src = fs.readFileSync(self, 'utf8');
  const block = `/* FIT-BEGIN */\n// fitted from ${png.split('/').slice(-2).join('/')} (frame 0) — [x, y, r] in stage px\nconst FIT = ${JSON.stringify(data).replace(/\],\[/g, '],[')};\n/* FIT-END */`;
  fs.writeFileSync(self, src.replace(/\/\* FIT-BEGIN \*\/[\s\S]*?\/\* FIT-END \*\//, block));
  console.log(`wrote FIT block: ${data.masses.map((m) => `${m.id} ${m.body.length}+${m.shade.length}+${m.lit.length}`).join(', ')}`);
}

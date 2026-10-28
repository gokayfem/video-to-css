// Paper: the reference's static gouache paper tooth and mottle, approximated without images.
// - tooth: four fine repeating ring systems with incommensurate periods and centres far off-stage;
//   their interference reads as fine speckle/fibre rather than a visible pattern.
// - mottle: seeded soft radial blotches (20–70 px), ± a few % lightness.
// Blended soft-light over every layer; strength via --v2c-wind-paper. Static (the reference's grain
// does not move: its per-pixel temporal variance in the sky is ~0).
// Target (measured, luma − 5×5 blur RMS on frame 0): sky-low 1.53, sky-top 0.74, lit slope 5.78.
export default function paper(ctx) {
  const c = (el) => ctx.cls('paper', el);
  const P = ctx.prop('paper', '').replace(/-$/, ''); // --v2c-wind-paper
  let seed = 20261028;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const rings = [
    { at: [-1800, -900], p: 2.3, dark: true }, { at: [3100, -1400], p: 2.9, dark: false },
    { at: [-1500, 2600], p: 3.7, dark: true }, { at: [2900, 2300], p: 3.1, dark: false },
  ].map((r) => `repeating-radial-gradient(circle at ${r.at[0]}px ${r.at[1]}px, ${r.dark ? 'rgb(0 0 0 / 0.55)' : 'rgb(255 255 255 / 0.5)'} 0 0.6px, transparent 0.9px ${r.p}px)`);
  const blotches = Array.from({ length: 90 }, () => {
    const x = Math.round(rnd() * 1280), y = Math.round(rnd() * 720), rx = Math.round(25 + rnd() * 55), ry = Math.round(rx * (0.6 + rnd() * 0.6));
    const dark = rnd() < 0.5;
    return `radial-gradient(${rx}px ${ry}px at ${x}px ${y}px, ${dark ? 'rgb(0 0 0 / 0.35)' : 'rgb(255 255 255 / 0.35)'}, transparent)`;
  });
  return {
    html: `<div class="${c('tooth')}"></div>\n<div class="${c('mottle')}"></div>`,
    css: `
.v2c-wind .${c('tooth')}, .v2c-wind .${c('mottle')} { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: soft-light; }
.v2c-wind .${c('tooth')} { opacity: calc(0.045 * var(${P}, 1)); background: ${rings.join(',\n    ')}; }
.v2c-wind .${c('mottle')} { opacity: calc(0.22 * var(${P}, 1)); background: ${blotches.join(',\n    ')}; }`,
    controls: [
      { name: P, kind: 'runtime', type: 'number', default: '1', range: ['0', '3'], variant: '3', description: 'paper grain strength (tooth + mottle); 0 = clean' },
    ],
  };
}

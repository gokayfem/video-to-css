// Sky: vertical gradient measured on frame 0 (columns x = 20…1000, 12-px means),
// plus a broad darker lobe at top centre (the x = 640 column is ~10 levels deeper blue).
export default function sky(ctx) {
  const c = ctx.cls('sky');
  return {
    html: `<div class="${c}"></div>`,
    css: `
.v2c-wind .${c} {
  ${ctx.prop('sky', 'top')}: #006feb;
  ${ctx.prop('sky', 'horizon')}: #68caf9;
  position: absolute; inset: 0;
  background:
    radial-gradient(60% 45% at 50% 0%, rgb(0 92 220 / 0.35), rgb(0 92 220 / 0) 70%),
    linear-gradient(180deg, var(${ctx.prop('sky', 'top')}) 0px, #0089f1 80px, #0096f2 130px, #16a9f8 190px, #30b5f8 250px, #45bffb 300px, var(${ctx.prop('sky', 'horizon')}) 340px, #8fd3f6 420px);
}`,
    controls: [
      { name: ctx.prop('sky', 'top'), kind: 'runtime', type: 'color', default: '#006feb', range: null, variant: '#3a2f8f', description: 'zenith sky colour' },
      { name: ctx.prop('sky', 'horizon'), kind: 'runtime', type: 'color', default: '#68caf9', range: null, variant: '#ffb37a', description: 'sky colour near the horizon' },
    ],
  };
}

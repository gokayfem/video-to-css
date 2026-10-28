// Local review page: reference (decoded frames or <video>) beside the live scene,
// one synchronized clock, scrubbing, frame stepping and runtime controls.
// This page is review tooling; the exported scene stays in examples/<x>/scene/.
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sceneMarkup } from './variants.mjs';
import { prepareReference } from './pipeline.mjs';
import { ensureDir, readJSON } from './util.mjs';

export async function buildReview(scene) {
  const ref = await prepareReference(scene, { log: () => {} });
  const out = ensureDir(join(scene.artifacts, 'review'));
  const frames = ref.entries.map((e) => ({ t: e.pts - (scene.timing.offset ?? 0), src: pathToFileURL(e.file).href, i: e.index }));
  const reportPath = join(scene.artifacts, 'compare', 'candidate', 'report.json');
  const outcomes = existsSync(reportPath) ? readJSON(reportPath).outcomes : null;
  const controls = (scene.controls ?? []).filter((c) => c.kind === 'runtime');
  const W = scene.stage.width, H = scene.stage.height;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Review — ${scene.title}</title>
<link rel="stylesheet" href="${pathToFileURL(scene.cssPath).href}">
<style>
body{margin:0;background:#16171b;color:#ddd;font:13px/1.4 system-ui,sans-serif}
header{padding:10px 16px;border-bottom:1px solid #333}h1{font-size:15px;margin:0}.muted{color:#999}
.panes{display:flex;gap:16px;padding:16px;flex-wrap:wrap}.pane{display:flex;flex-direction:column;gap:6px}
.box{width:${W}px;height:${H}px;background:#000;position:relative;overflow:hidden}
.box img,.box video{width:${W}px;height:${H}px;display:block}
.bar{display:flex;gap:8px;align-items:center;padding:0 16px 8px;flex-wrap:wrap}
input[type=range]{width:min(640px,80vw)}button{background:#2b2d35;color:#eee;border:1px solid #444;border-radius:4px;padding:4px 10px}
button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #fc6;outline-offset:2px}
.controls{display:grid;grid-template-columns:auto auto auto;gap:4px 10px;padding:8px 16px;align-items:center}
code{color:#fc6}.badge{padding:1px 6px;border-radius:3px;background:#333}
</style></head><body>
<header><h1>${scene.title}</h1><div class="muted">${scene.synthetic ? '<b>SYNTHETIC reference</b> — validates the harness, not external-footage fidelity. ' : ''}
Reference <code>${scene.reference.clip}</code> · ${frames.length} decoded frames · ${outcomes ? `last compare: appearance <span class="badge">${outcomes.appearance}</span> temporal <span class="badge">${outcomes.temporal}</span>` : 'no compare report yet'}</div></header>
<div class="panes">
  <div class="pane"><div>Reference <select id="mode" aria-label="reference display mode"><option value="frames">decoded frame (exact PTS)</option><option value="video">&lt;video&gt; element</option></select> <span id="refinfo" class="muted"></span></div>
    <div class="box"><img id="refimg" alt="reference frame"><video id="vid" src="${pathToFileURL(scene.clipPath).href}" muted playsinline preload="auto" hidden></video></div></div>
  <div class="pane"><div>Scene (strict HTML/CSS, paused and seeked) <span id="sceneinfo" class="muted"></span></div>
    <div class="box" id="scenebox">${sceneMarkup(scene)}</div></div>
</div>
<div class="bar"><button id="play" aria-label="play or pause">▶ play</button><button id="prev" aria-label="previous frame">◀ frame</button><button id="next" aria-label="next frame">frame ▶</button>
<input id="t" type="range" min="0" max="${scene.timing.duration}" step="0.001" value="0" aria-label="time in seconds"><span id="tl">0.000 s</span>
<label><input type="checkbox" id="loop" ${scene.timing.loop ? 'checked' : ''}> loop</label></div>
<div class="controls" aria-label="runtime controls">${controls.map((c, i) => `<label for="c${i}"><code>${c.name}</code></label>${
    c.type === 'color' ? `<input id="c${i}" data-name="${c.name}" type="color" value="${c.default}">`
      : `<input id="c${i}" data-name="${c.name}" data-unit="${c.unit ?? ''}" type="text" value="${c.default}" size="10">`
  }<span class="muted">${c.description ?? ''}${c.range ? ` · range ${c.range.join('–')}` : ''}</span>`).join('')}
<span></span><button id="reset">reset controls</button><span class="muted">time-type controls change the scene clock; the reference does not follow them</span></div>
<p class="muted" style="padding:0 16px">Keys: Space play/pause · ←/→ one reference frame · Home/End.</p>
<script>
const FR = ${JSON.stringify(frames)}, D = ${scene.timing.duration};
const root = document.querySelector(${JSON.stringify(scene.stage.selector)});
const img = document.getElementById('refimg'), vid = document.getElementById('vid'), slider = document.getElementById('t');
let t = 0, playing = false, last = 0, mode = 'frames', seekToken = 0;
const frameAt = (t) => { let k = 0; for (let i = 0; i < FR.length; i++) if (FR[i].t <= t + 1e-6) k = i; return k; };
function sceneAnims() { return document.getAnimations().filter((a) => a.effect && a.effect.target && root.contains(a.effect.target)); }
async function render() {
  for (const a of sceneAnims()) { a.pause(); a.currentTime = t * 1000; }
  slider.value = t; document.getElementById('tl').textContent = t.toFixed(3) + ' s';
  const k = frameAt(t);
  document.getElementById('sceneinfo').textContent = 'scene t=' + t.toFixed(3) + 's · ' + sceneAnims().length + ' animations';
  if (mode === 'frames') {
    img.src = FR[k].src;
    document.getElementById('refinfo').textContent = 'frame #' + FR[k].i + ' pts=' + FR[k].t.toFixed(4) + 's (Δ ' + (FR[k].t - t).toFixed(4) + ')';
  } else if (!playing) {
    const token = ++seekToken;
    vid.currentTime = t;
    await new Promise((r) => vid.addEventListener('seeked', r, { once: true }));
    if (token === seekToken) document.getElementById('refinfo').textContent = 'video seeked to ' + vid.currentTime.toFixed(4) + 's (requested ' + t.toFixed(4) + ')';
  }
}
function tick(now) {
  if (!playing) return;
  if (mode === 'video') { t = vid.currentTime; if (vid.ended) { if (document.getElementById('loop').checked) { vid.currentTime = 0; vid.play(); } else return toggle(); } }
  else { t += (now - last) / 1000; last = now; if (t >= D) { if (document.getElementById('loop').checked) t %= D; else { t = D; render(); return toggle(); } } }
  render(); requestAnimationFrame(tick);
}
function toggle() {
  playing = !playing; document.getElementById('play').textContent = playing ? '❚❚ pause' : '▶ play';
  if (playing) { last = performance.now(); if (mode === 'video') { vid.currentTime = t; vid.play(); } requestAnimationFrame(tick); } else { vid.pause(); render(); }
}
function step(d) { if (playing) toggle(); const k = Math.min(FR.length - 1, Math.max(0, frameAt(t) + d)); t = FR[k].t; render(); }
document.getElementById('play').onclick = toggle;
document.getElementById('prev').onclick = () => step(-1);
document.getElementById('next').onclick = () => step(1);
slider.oninput = () => { if (playing) toggle(); t = +slider.value; render(); };
document.getElementById('mode').onchange = (e) => { mode = e.target.value; img.hidden = mode !== 'frames'; vid.hidden = mode !== 'video'; render(); };
document.querySelectorAll('[data-name]').forEach((el) => { el.oninput = () => { root.style.setProperty(el.dataset.name, el.value); render(); }; });
document.getElementById('reset').onclick = () => { root.removeAttribute('style'); document.querySelectorAll('[data-name]').forEach((el) => { el.value = el.defaultValue; }); render(); };
addEventListener('keydown', (e) => {
  if (e.target.matches('input[type=text]')) return;
  if (e.code === 'Space') { e.preventDefault(); toggle(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  else if (e.key === 'Home') { t = 0; render(); } else if (e.key === 'End') { t = FR.at(-1).t; render(); }
});
render();
</script></body></html>`;
  const file = join(out, 'index.html');
  writeFileSync(file, html);
  return file;
}

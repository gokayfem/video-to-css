// Editability and embedding checks: control variants, multiple instances in one
// host page (including other scenes), and a second (scaled) viewport.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SEEK_FN } from './capture.mjs';
import { decodePNG, writePNG } from './png.mjs';
import { changedPixels } from './metrics.mjs';

const meanAbsRGB = (a, b) => { let t = 0; for (let i = 0; i < a.data.length; i += 4) t += (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])) / 3; return t / (a.data.length / 4); };
import { renderSheet } from './sheet.mjs';
import { ensureDir, writeJSON, fmt } from './util.mjs';

// Markup inside <body> of the scene host page (the exported component markup).
export function sceneMarkup(scene) {
  const html = readFileSync(scene.htmlPath, 'utf8');
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!m) throw new Error(`${scene.htmlPath}: no <body>`);
  return m[1].trim();
}

const withStyle = (markup, scene, style) => {
  const cls = scene.stage.selector.replace(/^\./, '');
  // add an inline style (custom properties) to the scene root element
  return markup.replace(new RegExp(`(<[a-z]+[^>]*class="[^"]*\\b${cls}\\b[^"]*")`), `$1 style="${style}"`);
};

export function hostPage(parts, { title = 'v2css host', bodyCss = '', href = (p) => pathToFileURL(p).href } = {}) {
  const links = [...new Set(parts.map((p) => p.scene.cssPath))].map((c) => `<link rel="stylesheet" href="${href(c)}">`).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${links}
<style>body{margin:0;background:#222;font:12px system-ui;color:#ccc}.host{display:flex;flex-wrap:wrap;gap:12px;padding:12px;align-items:flex-start}.slot{display:flex;flex-direction:column;gap:4px}${bodyCss}</style></head>
<body><div class="host">${parts.map((p, i) => `<div class="slot" data-slot="${i}"><span>${p.caption ?? ''}</span><div class="frame" style="${p.frameStyle ?? ''}">${p.markup}</div></div>`).join('\n')}</div></body></html>`;
}

async function shootSlots(session, file, slots, t, viewport) {
  const ctx = await session.browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(session.server.url(file), { waitUntil: 'load' });
  await page.evaluate(SEEK_FN, { ms: t * 1000, mutate: null });
  const shots = [];
  for (const s of slots) {
    const el = page.locator(`[data-slot="${s}"] .frame`).first();
    shots.push(await el.screenshot({ animations: 'allow', caret: 'hide', scale: 'css' }));
  }
  const animations = await page.evaluate(() => document.getAnimations().length);
  await ctx.close();
  return { shots, animations, errors };
}

export async function variantsScene(session, scene, { log = console.log, others = [] } = {}) {
  const out = ensureDir(join(scene.artifacts, 'variants'));
  const href = (p) => session.server.url(p);
  const markup = sceneMarkup(scene);
  const t = +(scene.timing.duration * 0.37).toFixed(3); // an arbitrary mid-motion time
  const W = scene.stage.width, H = scene.stage.height;
  const results = [];
  const runtime = (scene.controls ?? []).filter((c) => c.kind === 'runtime' && c.variant !== undefined);

  // 1. each runtime control at its variant value vs default, same scene time
  const parts = [{ scene, markup, caption: 'default' }, ...runtime.map((c) => ({ scene, markup: withStyle(markup, scene, `${c.name}: ${c.variant}`), caption: `${c.name}: ${c.variant}` }))];
  const allStyle = runtime.map((c) => `${c.name}: ${c.variant}`).join('; ');
  parts.push({ scene, markup: withStyle(markup, scene, allStyle), caption: 'all variants' });
  const vFile = join(out, 'controls.html');
  writeFileSync(vFile, hostPage(parts, { title: `${scene.id} controls`, href }));
  const { shots, errors } = await shootSlots(session, vFile, parts.map((_, i) => i), t, { width: W + 40, height: 800 });
  const imgs = shots.map(decodePNG);
  const sheetRows = [];
  shots.forEach((b, i) => { const p = join(out, `control-${i}.png`); writeFileSync(p, b); sheetRows.push(p); });
  // A control may only act during part of the timeline (e.g. a late fade), so probe
  // three scene times and keep the strongest effect.
  const probeTimes = [0.2, 0.5, 0.8].map((f) => +(scene.timing.duration * f).toFixed(3));
  const probes = [];
  for (const pt of probeTimes) probes.push((await shootSlots(session, vFile, parts.map((_, i) => i), pt, { width: W + 40, height: 800 })).shots.map(decodePNG));
  runtime.forEach((c, i) => {
    const per = probes.map((p) => changedPixels(p[0], p[i + 1]));
    const n = Math.max(...per);
    // second criterion for diffuse, texture-wide controls (grain, haze): mean |Δ| over the frame
    const diffuse = Math.max(...probes.map((p) => meanAbsRGB(p[0], p[i + 1])));
    results.push({ check: `control.effective.${c.name}`, outcome: n >= 100 || diffuse >= 1 ? 'pass' : 'fail', value: n, note: `max pixels changed (channel Δ > 24) default vs ${c.variant} over t=${probeTimes.join('/')}s [${per.join('/')}]; mean |Δ| ${fmt(diffuse, 2)}; gate: >= 100 px or mean |Δ| >= 1` });
  });
  results.push({ check: 'control.page.noErrors', outcome: errors.length ? 'fail' : 'pass', value: errors });
  const buildControls = (scene.controls ?? []).filter((c) => c.kind === 'build');
  if (buildControls.length) results.push({ check: 'control.build', outcome: 'info', value: buildControls.map((c) => `${c.name}: ${c.command ?? 'regenerate'}`) });

  // 2. multi-instance: default + all-variants instance + other scenes in one page.
  //    The default instance must match a page containing only itself (no interference).
  const solo = join(out, 'solo.html');
  writeFileSync(solo, hostPage([{ scene, markup }], { href }));
  const multiParts = [{ scene, markup }, { scene, markup: withStyle(markup, scene, allStyle) }, ...others.map((o) => ({ scene: o, markup: sceneMarkup(o) }))];
  const multi = join(out, 'multi.html');
  writeFileSync(multi, hostPage(multiParts, { title: `${scene.id} + ${others.map((o) => o.id).join(', ')}`, href }));
  const a = await shootSlots(session, solo, [0], t, { width: W + 40, height: H + 60 });
  const b = await shootSlots(session, multi, [0, 1], t, { width: 2 * W + 80, height: 1400 });
  writeFileSync(join(out, 'multi-0.png'), b.shots[0]);
  writeFileSync(join(out, 'multi-1.png'), b.shots[1]);
  const interf = changedPixels(decodePNG(a.shots[0]), decodePNG(b.shots[0]), 8);
  results.push({ check: 'embed.multiInstance.noInterference', outcome: interf === 0 ? 'pass' : 'fail', value: interf, note: `pixels differing (Δ > 8) between the default instance alone and alongside a variant instance${others.length ? ' and ' + others.map((o) => o.id).join(', ') : ''}` });
  const differ = changedPixels(decodePNG(b.shots[0]), decodePNG(b.shots[1]));
  results.push({ check: 'embed.multiInstance.independentControls', outcome: runtime.length === 0 || differ >= 100 ? 'pass' : 'fail', value: differ, note: 'variant instance differs from default instance in the same page' });

  // 3. second viewport: a 360 px wide host that scales the fixed composition.
  const k = 360 / W;
  const narrow = join(out, 'narrow.html');
  writeFileSync(narrow, hostPage([{ scene, markup, caption: `scaled ×${fmt(k, 3)} (fixed composition; does not reflow)`, frameStyle: `width:${W * k}px;height:${H * k}px;overflow:hidden` }],
    { bodyCss: `.frame>*{transform:scale(${k});transform-origin:0 0}`, href }));
  const c = await shootSlots(session, narrow, [0], t, { width: 390, height: 400 });
  writeFileSync(join(out, 'narrow.png'), c.shots[0]);
  results.push({ check: 'embed.narrowViewport', outcome: 'info', value: `${fmt(W * k, 0)}x${fmt(H * k, 0)}`, note: 'uniform scale only; reflow is not inferred from video' });

  await renderSheet(session, {
    title: `${scene.title} — control variants at t=${t}s`, subtitle: 'each runtime control at its variant value, same scene time, same browser',
    columns: ['render'], rows: parts.map((p, i) => ({ label: p.caption, cells: [sheetRows[i]] })), out: join(out, 'sheet.png'), thumbWidth: 320,
  });
  const report = { scene: scene.id, t, outcome: results.every((r) => r.outcome !== 'fail') ? 'pass' : 'fail', results };
  writeJSON(join(out, 'variants.json'), report);
  for (const r of results) log(`  ${r.outcome.padEnd(4)} ${r.check} ${JSON.stringify(r.value)}`);
  log(`  variants ${report.outcome}`);
  return report;
}

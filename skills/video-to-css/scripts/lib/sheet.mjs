// Labeled evidence sheets rendered by the browser (review tooling, not scene output).
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureDir } from './util.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const CSS = `body{margin:0;background:#111;color:#ddd;font:12px/1.35 ui-monospace,Menlo,monospace}
.wrap{padding:12px;display:inline-block}h1{font-size:14px;margin:0 0 4px;color:#fff}.sub{color:#999;margin-bottom:10px}
table{border-collapse:collapse}td,th{padding:3px 4px;vertical-align:top}th{color:#aaa;font-weight:normal;text-align:left}
img{display:block;width:var(--w);image-rendering:auto}.t{color:#fc6;white-space:nowrap}`;

// rows: [{ label, cells: [imagePath|null] }], columns: header strings.
export async function renderSheet(session, { title, subtitle = '', columns, rows, out, thumbWidth = 240 }) {
  const html = `<!doctype html><meta charset="utf-8"><style>${CSS}</style><div class="wrap" style="--w:${thumbWidth}px">
<h1>${esc(title)}</h1><div class="sub">${esc(subtitle)}</div><table><tr><th></th>${columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>
${rows.map((r) => `<tr><td class="t">${esc(r.label)}</td>${r.cells.map((c) => `<td>${c ? `<img src="${pathToFileURL(c).href}">` : ''}</td>`).join('')}</tr>`).join('\n')}
</table></div>`;
  return shootHtml(session, html, out);
}

// Track plot: x(t) and y(t) for reference (solid) vs candidate (dashed), one panel per track.
export async function renderTrackPlot(session, { title, report, out }) {
  const W = 360, H = 120, P = 28;
  const panels = report.tracks.map((tr, i) => {
    const R = report.series.ref[i], C = report.series.cand[i];
    const all = [...R, ...C];
    const ts = all.map((p) => p[0]);
    const t0 = Math.min(...ts), t1 = Math.max(...ts);
    const sx = (t) => P + ((t - t0) / (t1 - t0 || 1)) * (W - P - 6);
    const axis = (k) => {
      const v = all.map((p) => p[k]).filter((x) => x !== null);
      // at least an 8 px span so sub-pixel jitter is not drawn as motion
      let lo = Math.min(...v), hi = Math.max(...v);
      if (hi - lo < 8) { const m = (hi + lo) / 2; lo = m - 4; hi = m + 4; }
      const f = (x) => H - 14 - ((x - lo) / (hi - lo)) * (H - 24);
      f.label = `${lo.toFixed(0)}–${hi.toFixed(0)} px`;
      return f;
    };
    const line = (S, k, sy) => {
      let d = '', pen = false;
      for (const p of S) { if (p[k] === null) { pen = false; continue; } d += `${pen ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[k]).toFixed(1)}`; pen = true; }
      return d;
    };
    const sxk = axis(1), syk = axis(2);
    return `<div style="display:inline-block;margin:4px"><div>${esc(tr.part)} — median ${tr.medianErrPx}px, p90 ${tr.p90ErrPx}px${tr.phaseLag !== undefined ? `, lag ${tr.phaseLag}s` : ''}</div>
<svg width="${W}" height="${H}" style="background:#1a1a1a"><text x="4" y="12" fill="#888" font-size="10">x ${sxk.label}</text>
<path d="${line(R, 1, sxk)}" stroke="#6cf" fill="none" stroke-width="1.5"/><path d="${line(C, 1, sxk)}" stroke="#fc6" fill="none" stroke-dasharray="4 3" stroke-width="1.5"/></svg>
<svg width="${W}" height="${H}" style="background:#1a1a1a"><text x="4" y="12" fill="#888" font-size="10">y ${syk.label}</text>
<path d="${line(R, 2, syk)}" stroke="#6cf" fill="none" stroke-width="1.5"/><path d="${line(C, 2, syk)}" stroke="#fc6" fill="none" stroke-dasharray="4 3" stroke-width="1.5"/></svg></div>`;
  });
  const html = `<!doctype html><meta charset="utf-8"><style>${CSS}</style><div class="wrap"><h1>${esc(title)}</h1>
<div class="sub">blue solid = reference track, amber dashed = candidate track (same colour-key probe, same timestamps)</div>
<div style="width:${(W * 2 + 20) * 2}px">${panels.join('')}</div></div>`;
  return shootHtml(session, html, out);
}

async function shootHtml(session, html, out) {
  ensureDir(dirname(out));
  const file = out.replace(/\.png$/, '.html');
  writeFileSync(file, html);
  const ctx = await session.browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await page.locator('.wrap').screenshot({ path: out });
  await ctx.close();
  return out;
}

export { join };

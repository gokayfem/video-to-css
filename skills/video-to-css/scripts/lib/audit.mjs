// Strict HTML/CSS profile audit. Uses the browser's own parsers (DOM, CSSOM,
// computed styles, observed network) rather than regexes over source text.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { openScene, shoot } from './capture.mjs';
import { decodePNG } from './png.mjs';
import { luma, changedPixels } from './metrics.mjs';
import { writeJSON, ensureDir, fmt } from './util.mjs';

const FORBIDDEN_TAGS = ['img', 'picture', 'video', 'audio', 'canvas', 'svg', 'iframe', 'object', 'embed', 'script', 'source', 'track', 'math', 'portal', 'frame', 'frameset', 'applet'];
const check = (check, pass, value, note = '') => ({ check, outcome: pass === null ? 'info' : pass ? 'pass' : 'fail', value, note });

// In-page inspection (runs in the browser).
const INSPECT = ({ id, forbidden }) => {
  const out = { forbiddenElements: [], eventAttrs: [], links: [], cssom: { imports: [], fontFaces: [], urlValues: [], badSelectors: [], badKeyframes: [], badCustomProps: [], hostRules: [], unreadable: [] }, computedUrls: [], counts: {} };
  for (const el of document.querySelectorAll(forbidden.join(','))) out.forbiddenElements.push(el.tagName.toLowerCase());
  for (const el of document.querySelectorAll('*')) {
    for (const a of el.attributes) if (/^on/i.test(a.name)) out.eventAttrs.push(`${el.tagName.toLowerCase()}[${a.name}]`);
  }
  for (const l of document.querySelectorAll('link')) out.links.push({ rel: l.rel, href: l.href });
  const URLISH = /url\(|image-set\(|element\(|paint\(|cross-fade\(/i;
  const prefix = `.v2c-${id}`;
  const walk = (rules, sheetHref, isHost) => {
    for (const r of rules) {
      if (r instanceof CSSImportRule) out.cssom.imports.push(r.href);
      else if (r instanceof CSSFontFaceRule) out.cssom.fontFaces.push(r.cssText.slice(0, 120));
      else if (r instanceof CSSKeyframesRule) {
        if (!r.name.startsWith(`v2c-${id}-`)) out.cssom.badKeyframes.push(r.name);
        for (const k of r.cssRules) for (const p of k.style) if (URLISH.test(k.style.getPropertyValue(p))) out.cssom.urlValues.push(`@keyframes ${r.name} ${k.keyText} ${p}`);
      } else if (r instanceof CSSStyleRule) {
        if (isHost) out.cssom.hostRules.push(r.selectorText);
        else for (const s of r.selectorText.split(',').map((x) => x.trim())) {
          if (!(s === prefix || s.startsWith(prefix + ' ') || s.startsWith(prefix + '.') || s.startsWith(prefix + ':') || s.startsWith(prefix + '>') || s.startsWith(prefix + '_') || s.startsWith(prefix + '-') || s.startsWith(prefix + '['))) out.cssom.badSelectors.push(s);
        }
        for (const p of r.style) {
          const v = r.style.getPropertyValue(p);
          if (URLISH.test(v)) out.cssom.urlValues.push(`${r.selectorText} { ${p} }`);
          if (p.startsWith('--') && !p.startsWith(`--v2c-${id}-`) && !isHost) out.cssom.badCustomProps.push(p);
        }
        if (r.cssRules?.length) walk(r.cssRules, sheetHref, isHost); // nested CSS
      } else if (r.cssRules) walk(r.cssRules, sheetHref, isHost); // @media, @supports, @layer, @container
    }
  };
  for (const sh of document.styleSheets) {
    const isHost = !sh.href; // inline <style> in the host page
    try { walk(sh.cssRules, sh.href, isHost); } catch (e) { out.cssom.unreadable.push(sh.href); }
  }
  const PROPS = ['background-image', 'mask-image', '-webkit-mask-image', 'border-image-source', 'list-style-image', 'content', 'cursor', 'shape-outside', 'filter', 'clip-path'];
  const els = [...document.querySelectorAll('*')];
  for (const el of els) for (const pseudo of [null, '::before', '::after', '::marker']) {
    const cs = getComputedStyle(el, pseudo);
    for (const p of PROPS) { const v = cs.getPropertyValue(p); if (URLISH.test(v)) out.computedUrls.push(`${el.tagName.toLowerCase()}.${el.className}${pseudo ?? ''} ${p}: ${v.slice(0, 80)}`); }
  }
  const stage = document.querySelector(prefix);
  out.counts = {
    elementsInStage: stage ? stage.querySelectorAll('*').length + 1 : 0,
    pseudoElementsRendered: els.filter((el) => ['::before', '::after'].some((p) => getComputedStyle(el, p).content !== 'none')).length,
    animations: document.getAnimations().length,
    animationsRunning: document.getAnimations().filter((a) => a.playState === 'running').length,
    keyframesRules: [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } }).filter((r) => r instanceof CSSKeyframesRule).length,
  };
  return out;
};

// Declarations the engine rejects (heuristic source scan validated by CSS.supports).
const UNSUPPORTED = (css) => {
  const bad = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([{;]\s*)(-?[a-zA-Z-]+)\s*:\s*([^;{}]+)(?=;|})/g;
  let m;
  while ((m = re.exec(clean))) {
    const [, , prop, raw] = m;
    const value = raw.replace(/!important\s*$/, '').trim();
    if (prop.startsWith('--') || /var\(/.test(value)) continue;
    if (!CSS.supports(prop, value)) bad.push(`${prop}: ${value}`);
  }
  return bad;
};

export async function auditScene(session, scene, { outDir = join(scene.artifacts, 'audit') } = {}) {
  ensureDir(outDir);
  const results = [];
  // 1. files shipped in scene/
  const files = [];
  const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); });
  walk(join(scene.dir, 'scene'));
  const extra = files.filter((f) => !['.html', '.css'].includes(extname(f)));
  results.push(check('files.onlyHtmlCss', extra.length === 0, extra.map((f) => f.slice(scene.dir.length + 1)), 'scene/ ships only .html and .css'));
  const cssBytes = files.filter((f) => f.endsWith('.css')).reduce((s, f) => s + statSync(f).size, 0);
  const htmlBytes = files.filter((f) => f.endsWith('.html')).reduce((s, f) => s + statSync(f).size, 0);

  // 2. DOM/CSSOM/computed inspection with JS enabled for the inspector only
  const { ctx, page, log } = await openScene(session, scene);
  const ins = await page.evaluate(INSPECT, { id: scene.id, forbidden: FORBIDDEN_TAGS });
  const unsupported = await page.evaluate(UNSUPPORTED, readFileSync(scene.cssPath, 'utf8'));
  await ctx.close();
  const sceneDir = resolve(scene.dir, 'scene');
  const braces = braceBalance(readFileSync(scene.cssPath, 'utf8'));
  const local = (u) => u.startsWith(session.server.base + '/');
  const outside = log.requests.filter((u) => !local(u) || !session.server.pathOf(u).startsWith(sceneDir + '/'));
  const nonCss = log.requests.filter((u) => local(u) && !/\.(css|html)$/.test(new URL(u).pathname));
  results.push(
    check('dom.forbiddenElements', ins.forbiddenElements.length === 0, ins.forbiddenElements, FORBIDDEN_TAGS.join(' ')),
    check('dom.eventHandlerAttributes', ins.eventAttrs.length === 0, ins.eventAttrs),
    check('cssom.noImports', ins.cssom.imports.length === 0, ins.cssom.imports),
    check('cssom.noFontFace', ins.cssom.fontFaces.length === 0, ins.cssom.fontFaces),
    check('cssom.noUrlValues', ins.cssom.urlValues.length === 0, ins.cssom.urlValues, 'url(), image-set(), element(), paint(), cross-fade()'),
    check('cssom.readable', ins.cssom.unreadable.length === 0, ins.cssom.unreadable),
    check('computed.noUrlValues', ins.computedUrls.length === 0, ins.computedUrls.slice(0, 10), 'all elements incl. ::before/::after/::marker'),
    check('network.onlySceneFiles', outside.length === 0 && nonCss.length === 0, [...outside, ...nonCss], `observed ${log.requests.length} requests`),
    check('network.noFailures', log.failedRequests.length === 0, log.failedRequests),
    check('console.noErrors', log.console.filter((c) => c.type === 'error').length + log.pageErrors.length === 0, [...log.console, ...log.pageErrors]),
    check('css.braceBalance', braces.ok, braces.detail, 'unbalanced braces make the parser drop following rules silently'),
    check('css.unsupportedDeclarations', unsupported.length === 0, unsupported, 'CSS.supports() on literal declarations; var()-based values not checked'),
    check('namespace.selectors', ins.cssom.badSelectors.length === 0, ins.cssom.badSelectors, `every scene.css selector starts with .v2c-${scene.id}`),
    check('namespace.keyframes', ins.cssom.badKeyframes.length === 0, ins.cssom.badKeyframes, `v2c-${scene.id}-*`),
    check('namespace.customProperties', ins.cssom.badCustomProps.length === 0, [...new Set(ins.cssom.badCustomProps)], `--v2c-${scene.id}-*`),
    check('host.inlineRules', null, ins.cssom.hostRules, 'host page <style> rules (not part of the exported component)'),
  );

  // 3. playback with JavaScript disabled: the scene must move by itself
  {
    const o = await openScene(session, scene, { javaScriptEnabled: false });
    const a = decodePNG(await shoot(o.page, o.stage));
    await o.page.waitForTimeout(450);
    const b = decodePNG(await shoot(o.page, o.stage));
    await o.ctx.close();
    const moved = changedPixels(a, b, 8);
    const sd = stddev(luma(b).data);
    results.push(check('noJs.plays', moved >= 10, moved, 'pixels changed (channel Δ > 8) between screenshots 450 ms apart, JS disabled; gate >= 10'));
    results.push(check('noJs.nonBlank', sd > 2, fmt(sd), 'luma std-dev'));
  }
  // 4. reduced motion: static, non-blank pose
  {
    const o = await openScene(session, scene, { reducedMotion: 'reduce' });
    const running = await o.page.evaluate(() => document.getAnimations().filter((x) => x.playState === 'running').length);
    const a = decodePNG(await shoot(o.page, o.stage));
    await o.page.waitForTimeout(450);
    const b = decodePNG(await shoot(o.page, o.stage));
    await o.ctx.close();
    const moved = changedPixels(a, b, 8);
    results.push(check('reducedMotion.static', moved === 0, moved, `pixels changed (channel Δ > 8) 450 ms apart under prefers-reduced-motion; ${running} animations still running`));
    results.push(check('reducedMotion.nonBlank', stddev(luma(b).data) > 2, fmt(stddev(luma(b).data))));
  }
  const report = {
    scene: scene.id, browser: { engine: session.engine, version: session.version },
    outcome: results.every((r) => r.outcome !== 'fail') ? 'pass' : 'fail',
    sizes: { cssBytes, htmlBytes, ...ins.counts },
    results,
    limits: 'Inspects the loaded page in one engine: DOM, CSSOM (including @media/@supports/nested rules), computed styles of every element and ::before/::after/::marker, and observed requests. It cannot prove behaviour in other engines, of content a host page adds, or of declarations the engine silently dropped (partly covered by the CSS.supports scan).',
  };
  writeJSON(join(outDir, 'audit.json'), report);
  return report;
}

// Brace balance outside comments and strings; reports the line of the first stray '}'.
function braceBalance(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => ' '.repeat(m.length));
  let depth = 0, line = 1;
  for (const ch of clean) {
    if (ch === '\n') line++;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth < 0) return { ok: false, detail: `stray '}' at line ${line}` };
  }
  return { ok: depth === 0, detail: depth === 0 ? 'balanced' : `${depth} unclosed '{'` };
}

function stddev(arr) {
  let m = 0;
  for (const v of arr) m += v;
  m /= arr.length;
  let s = 0;
  for (const v of arr) s += (v - m) ** 2;
  return Math.sqrt(s / arr.length);
}

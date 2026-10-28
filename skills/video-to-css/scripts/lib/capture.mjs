// Deterministic capture of a strict-CSS scene at exact scene times.
//
// Time model: scene time t means every CSSAnimation/CSSTransition returned by
// document.getAnimations() is paused with currentTime = t*1000 ms. The browser's
// own timing model then applies delay, negative delay, iteration count,
// direction, fill mode and easing — we never re-implement them. Playwright's
// JS clock is NOT used: it does not drive the CSS animation timeline.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { chromium, firefox, webkit } from 'playwright';
import { ensureDir, writeJSON, sha256Dir, pad, fmt, findRoot } from './util.mjs';
import { startServer } from './server.mjs';

const ENGINES = { chromium, firefox, webkit };

// Runs in the page. Returns the post-seek inventory so the manifest records what
// was actually set (and so missing/extra animations are visible).
export const SEEK_FN = async ({ ms, mutate }) => {
  const anims = document.getAnimations();
  for (const a of anims) a.pause();
  if (mutate) {
    // Negative-control hooks: deliberately wrong timing applied to the real CSS animations.
    for (const a of anims) {
      if (mutate.linearEasing) {
        const kfs = a.effect.getKeyframes().map((k) => ({ ...k, easing: 'linear' }));
        a.effect.setKeyframes(kfs);
        a.effect.updateTiming({ easing: 'linear' });
      }
    }
  }
  for (const a of anims) a.currentTime = ms;
  // sensitivity probe: one animation deliberately out of step with the rest
  if (mutate && Number.isInteger(mutate.offsetIndex) && anims[mutate.offsetIndex]) anims[mutate.offsetIndex].currentTime = ms + mutate.offsetMs;
  await Promise.all(anims.map((a) => a.ready));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const describe = (a) => {
    const el = a.effect?.target;
    const t = a.effect?.getComputedTiming?.() ?? {};
    return {
      name: a.animationName ?? a.transitionProperty ?? a.id ?? '',
      kind: a.constructor.name,
      target: el ? `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).trim().split(/\s+/).join('.') : ''}` : null,
      pseudo: a.effect?.pseudoElement ?? null,
      currentTime: a.currentTime,
      delay: t.delay, duration: t.duration, iterations: t.iterations,
      direction: t.direction, fill: t.fill, progress: t.progress, currentIteration: t.currentIteration,
    };
  };
  return anims.map(describe);
};

// A session = one browser + a localhost static server rooted at the project, so
// scene stylesheets are same-origin and their CSSOM is inspectable.
export async function launch(engine = 'chromium', root = findRoot()) {
  const browser = await ENGINES[engine].launch();
  const server = await startServer(root);
  return { browser, engine, version: browser.version(), server, root, close: async () => { await browser.close(); await server.close(); } };
}

// Open a scene page ready for seeking. `inject` = extra CSS (negative controls, variants).
// warmup: pause + seek away and back before evidence capture. Only for seeking
// captures; live checks (audit, reduced motion, perf) must see the free-running page.
export async function openScene(session, scene, { inject = '', reducedMotion = 'no-preference', javaScriptEnabled = true, html = null, warmup = false } = {}) {
  const ctx = await session.browser.newContext({
    viewport: { width: scene.stage.width, height: scene.stage.height },
    deviceScaleFactor: 1,
    reducedMotion,
    javaScriptEnabled,
    colorScheme: 'light',
  });
  const page = await ctx.newPage();
  const log = { console: [], pageErrors: [], requests: [], failedRequests: [] };
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log.console.push({ type: m.type(), text: m.text() }); });
  page.on('pageerror', (e) => log.pageErrors.push(String(e)));
  page.on('request', (r) => log.requests.push(r.url()));
  page.on('requestfailed', (r) => log.failedRequests.push({ url: r.url(), error: r.failure()?.errorText }));
  await page.goto(session.server.url(html ?? scene.htmlPath), { waitUntil: 'load' });
  if (inject && javaScriptEnabled) await page.addStyleTag({ content: inject });
  if (javaScriptEnabled) await page.evaluate(() => document.fonts.ready.then(() => true));
  const stage = await page.locator(scene.stage.selector).first().boundingBox();
  if (!stage) throw new Error(`stage selector ${scene.stage.selector} not found`);
  if (warmup && javaScriptEnabled) {
    // Warm-up: the first screenshot after load can show a stale compositor frame of the
    // still-running animation even though computed styles are already paused. Seek away,
    // seek back, and discard one screenshot before any evidence is captured.
    await seek(page, 0.123);
    await shoot(page, stage);
    await seek(page, 0);
    await shoot(page, stage);
  }
  return { ctx, page, log, stage };
}

export async function seek(page, t, mutate = null) {
  return page.evaluate(SEEK_FN, { ms: t * 1000, mutate });
}

export async function shoot(page, stage) {
  return page.screenshot({
    clip: { x: stage.x, y: stage.y, width: stage.width, height: stage.height },
    animations: 'allow', // never let Playwright fast-forward/cancel the animations we are sampling
    caret: 'hide',
    scale: 'css',
    type: 'png',
  });
}

// Capture a scene at the given scene times. `times` = [{ k, t }] (scene seconds).
export async function captureScene(scene, times, outDir, { engine = 'chromium', label = 'candidate', inject = '', mutate = null, session = null, timeTransform = null } = {}) {
  const own = !session;
  session = session ?? (await launch(engine, scene.root));
  const framesDir = ensureDir(join(outDir, 'frames'));
  const { ctx, page, log, stage } = await openScene(session, scene, { inject, warmup: true });
  const entries = [];
  let inventory = null;
  try {
    for (const { k, t } of times) {
      const st = timeTransform ? timeTransform(t) : t;
      const inv = await seek(page, st, mutate);
      inventory ??= inv;
      const file = join(framesDir, `${pad(k, 5)}.png`);
      const buf = await shoot(page, stage);
      (await import('node:fs')).writeFileSync(file, buf);
      entries.push({ k, requested: fmt(t, 6), sceneTime: fmt(st, 6), actualCurrentTimeMs: inv[0]?.currentTime ?? null, file });
    }
  } finally {
    await ctx.close();
    if (own) await session.close();
  }
  const manifest = {
    label,
    scene: scene.id,
    sceneChecksum: sha256Dir(join(scene.dir, 'scene')),
    browser: { engine: session.engine, version: session.version },
    viewport: { width: scene.stage.width, height: scene.stage.height, deviceScaleFactor: 1 },
    stageBox: stage,
    colorAssumption: 'sRGB page, PNG screenshot, no colour management applied',
    fonts: 'system stacks only (strict profile forbids @font-face)',
    timeModel: 'all document.getAnimations() paused, currentTime = sceneTime*1000',
    timeTransform: timeTransform ? String(timeTransform) : null,
    inject: inject || null,
    mutate,
    animationInventory: inventory,
    log,
    frames: entries,
  };
  writeJSON(join(outDir, 'manifest.json'), manifest);
  return manifest;
}

export function readCss(scene) {
  return readFileSync(scene.cssPath, 'utf8');
}

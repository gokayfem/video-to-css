// Live playback frame-interval statistics (separate from screenshot throughput).
import os from 'node:os';
import { join } from 'node:path';
import { launch, openScene } from './capture.mjs';
import { writeJSON, fmt } from './util.mjs';
import { quantile, mean } from './metrics.mjs';

export async function perfScene(scene, { seconds = 4, engine = 'chromium', log = console.log } = {}) {
  const session = await launch(engine, scene.root);
  try {
    const { ctx, page } = await openScene(session, scene);
    const res = await page.evaluate(async (ms) => {
      const iv = [];
      let last = performance.now();
      const t0 = last;
      await new Promise((done) => {
        const tick = (now) => { iv.push(now - last); last = now; if (now - t0 < ms) requestAnimationFrame(tick); else done(); };
        requestAnimationFrame(tick);
      });
      return { intervals: iv.slice(1), nodes: document.querySelectorAll('*').length, animations: document.getAnimations().length };
    }, seconds * 1000);
    await ctx.close();
    const iv = res.intervals;
    const med = quantile(iv, 0.5);
    const summary = {
      engine: `${session.engine} ${session.version}`, mode: 'headless (no display vsync; numbers indicate main-thread/raster headroom, not on-screen smoothness)',
      machine: `${os.cpus()[0]?.model} × ${os.cpus().length}, ${os.platform()} ${os.release()}, ${Math.round(os.totalmem() / 2 ** 30)} GB`,
      viewport: `${scene.stage.width}x${scene.stage.height} @1x`, seconds, frames: iv.length,
      intervalMs: { mean: fmt(mean(iv), 2), median: fmt(med, 2), p90: fmt(quantile(iv, 0.9), 2), p99: fmt(quantile(iv, 0.99), 2), max: fmt(Math.max(...iv), 2) },
      longFrames: iv.filter((v) => v > 1.5 * med).length, nodes: res.nodes, animations: res.animations,
    };
    writeJSON(join(scene.artifacts, 'perf.json'), { summary, intervals: iv.map((v) => fmt(v, 2)) });
    return { summary };
  } finally {
    await session.close();
  }
}

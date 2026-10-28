#!/usr/bin/env node
// v2css — video-to-css toolkit CLI.
import { resolve, join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { inspectClip, extractFrames } from './lib/video.mjs';
import { loadScene, writeJSON, ensureDir, fmt } from './lib/util.mjs';
import { captureScene } from './lib/capture.mjs';
import { prepareReference, runCandidate, withSession, NEGATIVE_CONTROLS, negativeKinds, animationSensitivity } from './lib/pipeline.mjs';
import { auditScene } from './lib/audit.mjs';
import { variantsScene } from './lib/variants.mjs';
import { perfScene } from './lib/perf.mjs';
import { buildReview } from './lib/review.mjs';
import { sideBySide } from './lib/sbs.mjs';

const HELP = `v2css <command> [args]

  init <clip> [--out dir] [--id name] [--start s] [--duration s] [--loop|--no-loop] [--force]
                                            scaffold a scene package for any video: display size, window, loop guess,
                                            contact sheet, starter scene (stage px = display px)

  inspect <clip> [--out file.json]          ffprobe facts: sha256, size, colour tags, every frame PTS, VFR flag
  extract <clip> --out <dir> [--times a,b]  decode frames at presentation times (default: all frames) + frames.json
  capture <scene-dir> [--times a,b] [--engine chromium|firefox|webkit] [--out dir]
                                            deterministic browser screenshots at scene times
  compare <scene-dir> [--engine e]          reference vs scene at every reference frame PTS -> report, sheets
  negatives <scene-dir> [--only k1,k2] [--per-animation [--offset 0.1]]
                              planted-error candidates (${Object.keys(NEGATIVE_CONTROLS).join(', ')}); each must be caught
  audit <scene-dir> [--engine e]            strict HTML/CSS profile audit (DOM, CSSOM, computed, network, no-JS, reduced motion)
  variants <scene-dir>                      render control variants, multi-instance host, second viewport
  perf <scene-dir> [--seconds 4]            live playback frame-interval statistics
  sbs <scene-dir> --times a,b [--out f.png] [--crop x,y,w,h --zoom 2]  quick reference | scene | diff sheet at chosen times
  review <scene-dir>                        local review page: reference video/frames + scene, synced scrubbing
  check <scene-dir> [--engine e] [--quick]  audit + compare + negatives + sensitivity + variants + review → artifacts/<id>/SUMMARY.md
                                            (--quick skips negatives/sensitivity for large scenes)

Artifacts go to <project>/artifacts/<scene-id>/ (git-ignored).`;

function args(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { const k = argv[i].slice(2); opt[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; }
    else pos.push(argv[i]);
  }
  return { pos, opt };
}

const [cmd, ...rest] = process.argv.slice(2);
const { pos, opt } = args(rest);
const engine = opt.engine ?? 'chromium';
const log = (...a) => console.log(...a);

async function main() {
  switch (cmd) {
    case 'init': {
      if (!pos[0]) throw new Error('usage: v2css init <clip> [--out dir] [--id name] [--start s] [--duration s]');
      const { initScene } = await import('./lib/init.mjs');
      await initScene(pos[0], { out: opt.out, id: opt.id, start: opt.start ?? 0, duration: opt.duration, force: !!opt.force,
        loop: opt.loop ? true : opt['no-loop'] ? false : undefined, log });
      break;
    }
    case 'inspect': {
      const s = await inspectClip(resolve(pos[0]));
      if (opt.out) writeJSON(resolve(opt.out), s);
      const { frames, ...facts } = s;
      log(JSON.stringify({ ...facts, firstPts: frames.slice(0, 3).map((f) => f.pts), lastPts: frames.at(-1)?.pts }, null, 2));
      break;
    }
    case 'extract': {
      const s = await inspectClip(resolve(pos[0]));
      const times = opt.times ? String(opt.times).split(',').map(Number) : s.frames.map((f) => f.pts - s.startPts);
      const out = resolve(opt.out ?? 'frames');
      const r = await extractFrames(s, times.map((t) => ({ t })), out);
      writeJSON(join(out, 'frames.json'), { sha256: s.sha256, ...r });
      log(`${r.entries.length} frames -> ${out} (max |quantization| ${fmt(Math.max(...r.entries.map((e) => Math.abs(e.quantization))), 4)} s)`);
      break;
    }
    case 'capture': {
      const scene = loadScene(pos[0]);
      const times = opt.times ? String(opt.times).split(',').map(Number) : [0, scene.timing.duration / 2];
      const out = resolve(opt.out ?? join(scene.artifacts, 'capture'));
      const m = await captureScene(scene, times.map((t, k) => ({ k, t })), out, { engine, label: 'capture' });
      log(`${m.frames.length} frames (${m.browser.engine} ${m.browser.version}) -> ${out}`);
      break;
    }
    case 'compare': {
      const scene = loadScene(pos[0]);
      const ref = await prepareReference(scene, { log });
      await withSession(engine, (s) => runCandidate(scene, ref, { label: engine === 'chromium' ? 'candidate' : `candidate-${engine}`, session: s, log }), scene.root);
      log(`report: ${join(scene.artifacts, 'compare', engine === 'chromium' ? 'candidate' : `candidate-${engine}`, 'report.md')}`);
      break;
    }
    case 'negatives': {
      const scene = loadScene(pos[0]);
      const ref = await prepareReference(scene, { log });
      const kinds = opt.only ? String(opt.only).split(',') : negativeKinds(scene);
      const res = await withSession(engine, async (s) => {
        const out = [];
        for (const k of kinds) out.push(await runCandidate(scene, ref, { label: `neg-${k}`, kind: k, session: s, log, sheet: k !== 'shuffled' }));
        return out;
      }, scene.root);
      const caught = res.filter((r) => r.negativeControl.caught).length;
      const missed = res.filter((r) => r.negativeControl.status === 'missed').length;
      log(`negative controls caught: ${caught}/${res.length}; below detection floor: ${res.length - caught - missed}; missed: ${missed}`);
      if (opt['per-animation']) {
        const sens = await withSession(engine, async (s) => {
          await runCandidate(scene, ref, { session: s, log: () => {}, sheet: false }); // inventory from the good capture
          return animationSensitivity(scene, ref, { session: s, offset: Number(opt.offset ?? 0.1), log });
        }, scene.root);
        log(`per-animation sensitivity (+${sens.offset}s): ${sens.detected}/${sens.total} animations detected`);
      }
      if (missed) process.exitCode = 1;
      break;
    }
    case 'audit': {
      const scene = loadScene(pos[0]);
      const r = await withSession(engine, (s) => auditScene(s, scene), scene.root);
      for (const c of r.results) log(`  ${c.outcome.padEnd(4)} ${c.check} ${JSON.stringify(c.value)}`);
      log(`audit ${r.outcome} (${r.browser.engine} ${r.browser.version}); ${JSON.stringify(r.sizes)}`);
      if (r.outcome !== 'pass') process.exitCode = 1;
      break;
    }
    case 'variants': {
      const scene = loadScene(pos[0]);
      const r = await withSession(engine, (s) => variantsScene(s, scene, { log }), scene.root);
      if (r.outcome !== 'pass') process.exitCode = 1;
      break;
    }
    case 'perf': {
      const scene = loadScene(pos[0]);
      const r = await perfScene(scene, { seconds: Number(opt.seconds ?? 4), log });
      log(JSON.stringify(r.summary, null, 2));
      break;
    }
    case 'sbs': {
      const scene = loadScene(pos[0]);
      const times = opt.times ? String(opt.times).split(',').map(Number) : [0, scene.timing.duration / 3, (2 * scene.timing.duration) / 3];
      const out = resolve(opt.out ?? join(scene.artifacts, 'sbs.png'));
      const crop = opt.crop ? String(opt.crop).split(',').map(Number) : null;
      await withSession(engine, (s) => sideBySide(s, scene, { times, out, crop, zoom: Number(opt.zoom ?? 1), thumbWidth: Number(opt.width ?? (crop ? crop[2] * Number(opt.zoom ?? 1) : 420)) }));
      log(`side-by-side: ${out}`);
      break;
    }
    case 'review': {
      const scene = loadScene(pos[0]);
      const p = await buildReview(scene);
      log(`review page: ${p}`);
      break;
    }
    case 'check': {
      const { runCheck } = await import('./lib/checkall.mjs');
      const r = await runCheck(loadScene(pos[0]), { engine, log, negatives: !opt.quick });
      if (!r.ok) process.exitCode = 1;
      break;
    }
    default:
      log(HELP);
      if (cmd && cmd !== 'help' && cmd !== '--help') process.exitCode = 2;
  }
}
main().catch((e) => { console.error(e.stack || String(e)); process.exit(1); });

# Architecture (v0.1)

**Decision.** Node ESM toolkit (no build step) + Playwright 1.64.1 (Chromium; WebKit smoke) + ffmpeg/ffprobe +
pngjs. Plain `.mjs` instead of TypeScript so a skill-only install runs with `npm install` and Node ≥ 20, with
no compiler. No frontend framework, hosted service, model API or DSL. One canonical copy of the toolkit lives in
`skills/video-to-css/scripts/` (the repo's `package.json` points its `v2css` bin there).

```
clip.mp4 ──ffprobe──▶ source.json (sha256, colour tags, every PTS, VFR)
   │                                                   scene/ (strict HTML+CSS, no JS)
   └─ffmpeg rawvideo (BT.709/601)─▶ ref frames @PTS        │
                                        │     Playwright: local 127.0.0.1 server, pause all
                                        │     document.getAnimations(), currentTime = t, screenshot
                                        ▼                   ▼
                               compare (same metric code on both) ─▶ report.json/md, sheet.png, tracks.png
                                 ├ appearance: 16×9 cell ΔE (time-averaged), edge layout; SSIM info
                                 └ temporal: tracks (centroid, √area, bbox, visibility), offset-invariant
                                   noise-normalised lag → phase / rate / timing-shape; region-L* timing;
                                   motion energy; loop seam
                     negatives (planted errors) · per-animation sensitivity · audit · variants · review · perf
```

**Time model.** Scene time t ≡ all CSS animations paused at `currentTime = t·1000`; the engine applies
delays, direction, fill and easing. Reference time is the decoded frame's PTS; `scene_t = ref_t − offset`,
nothing else. Captures are verified against hand-computed positions (`tests/seek.test.mjs`, Chromium and
WebKit) and are order-independent (pixel-identical when captured in reverse). A warm-up seek and a discarded
screenshot avoid a stale first compositor frame observed in Chromium.

**Contracts.** `docs/CONTRACTS.md` (scene package, strict profile, naming, scene.json/params.json, artifact
layout). Large scenes are generated at build time from part modules (`examples/wind-farm/build/`), which
lets workers own disjoint files.

**Outcomes.** Structural (audit), appearance, temporal, editability — reported separately, never blended.
Gates are declared in `scripts/lib/compare.mjs` (`GATES`); changes are logged in `docs/EVIDENCE.md`.

**Non-goals for v0.1.** SVG/JS motion profiles, responsive reflow inferred from video, automatic
reconstruction, a universal similarity score.

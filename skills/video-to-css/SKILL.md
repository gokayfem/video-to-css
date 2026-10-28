---
name: video-to-css
description: >-
  Rebuild a reference video (any container ffmpeg reads: mp4, mov, webm, gif; any size, aspect,
  rotation or frame rate; a loop or a one-shot, or a window of a longer clip) as an editable
  strict HTML/CSS animation: semantic DOM parts, CSS keyframes
  matched to the clip's real timestamps, runtime custom-property controls, and browser evidence
  (matched-time side-by-sides, separate appearance/temporal reports, negative controls, strict
  audit). Use when asked to turn a video/GIF/screen recording into CSS animation, to match an
  animation's timing in CSS, or to verify a CSS animation against a reference clip.
  Not for: canvas/WebGL/SVG/Lottie output, JS animation libraries, embedding the video or its
  frames, or naturalistic footage (faces, fluids, crowds) where strict CSS is a poor fit — say so.
license: MIT
---

# video-to-css

Turn a reference clip into a **strict HTML/CSS** scene whose motion is declared in CSS and whose
playback needs no JavaScript, then prove — with the toolkit in `scripts/` — what matches and what
does not. The deliverable is a construction system with controls, not a pixel replay.

## Setup (once)

```bash
cd <this skill>/scripts && npm install      # playwright@1.64.1 + pngjs@7.0.0, pinned
npx playwright install chromium             # webkit optional for smoke coverage
# needs ffmpeg + ffprobe on PATH and Node >= 20
node v2css.mjs help
```

## Workflow

1. **Start the package** — `node v2css.mjs init clip.mov [--out dir] [--start s --duration s]`:
   inspects the clip (sha256, display size after rotation and pixel aspect, colour tags, every frame
   PTS, VFR flag), guesses loop vs one-shot from the seam, writes `scene.json`, a starter `scene/`
   (stage px = display px, measured background), `params.json`, a `REFERENCE.md` with the clip facts,
   and a contact sheet. Pick a window of a long clip with `--start/--duration`; long or high-rate
   windows are compared on an even subset of real frames (`reference.maxSamples`, default 480).
   Use PTS, never `index / fps`. Record provenance (synthetic, camera, AI-generated, a render) in
   `REFERENCE.md`. → [references/measuring.md](references/measuring.md)
2. **Measure** — `extract` frames (contact sheet + dense samples around events); measure parts,
   pivots, palette, trajectories, periods, delays, easing. Label every number
   measured / estimated / chosen / fitted in `params.json`. Loop-mean frames and per-pixel temporal
   variance maps locate static layers and moving parts fast.
3. **Choose a representation** — map parts to CSS primitives; state what is approximated and what
   cannot be represented economically (e.g. painterly texture). → [references/css-primitives.md](references/css-primitives.md)
4. **Block out the whole scene** in one coordinate system (stage px = clip px), with the package
   layout and naming in [references/scene-contract.md](references/scene-contract.md) (template in
   `templates/`). Nested wrappers: layout > parent motion > local pivot > appearance. Every cycle an
   integer divisor of the loop; offsets via negative `animation-delay`.
5. **Refine with evidence** — `sbs` after every step (reference | scene | diff at chosen times,
   `--crop` for small parts), fix composition and timing before detail, look for causes (pivot,
   transform order, inheritance of custom properties) rather than compensating offsets.
   → [references/review.md](references/review.md)
6. **Verify** — `check <scene-dir>`: strict audit, full compare at every reference frame,
   negative controls, per-animation sensitivity, controls + multi-instance, review page.
   Four outcomes are reported separately: structural, appearance, temporal, editability.
   → [references/harness.md](references/harness.md)
7. **Transfer** — show control variants and a second embedding; uniform scaling is not reflow.
8. **Deliver** — source, parameters, playable `scene/`, evidence images, commands, limitations.
   Never quote a single "% similarity"; report the named measures.

## Hard rules (strict profile)

No `<img> <video> <canvas> <svg> <script> <iframe>`, no `url()`/`image-set()`, no `@import`/`@font-face`,
no sprite sheets or per-frame replacement inside `scene/`. Namespaced selectors (`.v2c-<id>…`),
keyframes (`v2c-<id>-…`) and custom properties (`--v2c-<id>-…`). All animations start at load.
A `prefers-reduced-motion` pose. The reference clip and its frames stay out of the exported scene.

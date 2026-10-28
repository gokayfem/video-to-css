# Toolkit commands (scripts/v2css.mjs)

| command | does |
|---|---|
| `init <clip> [--out --id --start --duration --loop/--no-loop]` | scene package for any clip: display size (rotation + pixel aspect applied), window, loop guess from the seam, starter scene with measured background, `REFERENCE.md` facts, contact sheet |
| `inspect <clip>` | identity, coded vs display size, rotation, colour tags, every PTS, VFR flag (time-base rounding is not VFR) |
| `extract <clip> --out dir [--times]` | PTS-exact RGB frames (BT.709/601 per tag) + frames.json with quantization |
| `capture <scene> [--times] [--engine]` | deterministic screenshots: all animations paused, `currentTime = t`; warm-up seek against stale first frames |
| `sbs <scene> --times [--crop --zoom]` | quick reference / scene / diff sheet |
| `compare <scene>` | every reference frame: appearance (cell ΔE, edge layout, SSIM info) and temporal (per-track trajectory/extent/visibility; phase, rate, timing-shape from offset-invariant, noise-normalised lag analysis on centroid + √area; region-luminance timing; motion energy; loop seam) |
| `negatives <scene> [--per-animation]` | frozen, shuffled, shifted 0.4 s, 1.25× speed, misplaced layer, linear easing — each must fail its targeted check; `--per-animation` shifts one animation at a time by 0.1 s and reports which are undetected |
| `audit <scene>` | strict profile via DOM, CSSOM (incl. @media/nesting), computed styles of every element and pseudo-element, observed network, CSS.supports scan, namespacing, JS-disabled playback, reduced motion |
| `variants <scene>` | each runtime control at its variant (3 probe times), multi-instance and multi-scene host page, scaled second viewport |
| `perf <scene>` | live rAF frame intervals (headless; not on-screen smoothness) |
| `review <scene>` | local page: decoded frames or `<video>` beside the live scene, one clock, scrub, frame step, controls, keyboard |
| `check <scene>` | audit + compare + negatives + sensitivity + variants + review → artifacts/<id>/SUMMARY.md |

Inputs: anything ffmpeg decodes. Frames are extracted at **display** size (what a player shows), so the
stage must match `stage.width/height` from `init`. RGB/palette sources (GIF) skip the YUV matrix; untagged
YUV is decoded as BT.709 for HD and BT.601 below (recorded as an assumption). The comparison grid keeps
~144 near-square cells at any aspect (16×9 landscape, 9×16 portrait). A flat motion-energy profile
(constant-speed motion) reports energy correlation as info and relies on total energy and lag checks.

Gates live in `scripts/lib/compare.mjs` (`GATES`), declared before data and never relaxed to pass a case.
Lags are diagnostics only; nothing is ever re-timed to improve a score.
Playwright's JS clock does not drive CSS animations; never use screenshot `animations: "disabled"`.

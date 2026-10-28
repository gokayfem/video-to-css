# 01 — Signal orbit (`orbit`)

## Provenance
- Reference: `tests/fixtures/synthetic/clips/orbit-loop.mp4` — **synthetic** fixture generated for this repo (see `tests/fixtures/synthetic/PROVENANCE.md`); not external footage.
- SHA-256 `c7672416a60ac7844521593b715faf0037f99c3d074f133913441e16474b29a1`.
- 640×360, H.264 yuv420p, `color_range=tv`, `color_space=bt709` (transfer/primaries untagged), no rotation.
- 120 frames, CFR: `ffprobe -show_entries frame=best_effort_timestamp_time` gives PTS = i/30 exactly (0 … 3.966667 s), duration 4.000 s. Loop: frame 119 → frame 0 is continuous for every part.
- Authored under the hold-out rule: only the encoded clip and my own measurements were used; nothing under `tests/fixtures/synthetic/generator/` was read or listed.

## Part inventory (stage px, continuous coordinates)
| part | element | parent | pivot / transform-origin | geometry | colour |
|---|---|---|---|---|---|
| background | `.v2c-orbit` (root) | — | — | vertical linear gradient | `#0e1324` → `#1c2447` |
| hub | `__hub` (0×0 layout node) | root | at (320,180) | — | — |
| ring | `__ring` | hub | centred via translate(-50%,-50%) | outer Ø 135↔155, 6 px stroke (stroke constant → size animates, not scale) | `#4fd1cb` |
| core | `__core` | hub | — | Ø 44, static | `#2c3a66` |
| arm | `__arm` (0×0 pivot) | hub | `0 0` = hub centre | rotates 0→360° | — |
| dot | `__dot` | arm | — | Ø 22, offset −radius (112) on y | `#ff6a49` |
| tile | `__tile` (0×0 layout node) | root | at (120,180) | — | — |
| tile-spin | `__tile-spin` | tile | `50% 50%` = tile centre | 56×56 box, quarter turns | — |
| tile-face | `__tile-face` (+`::after` marker) | tile-spin | — | 56×56, radius 8; marker Ø 12 at (+16,−16) from centre | `#8c7bf6`, marker `#ffffff` |
| bars | `__bars` (layout) | root | left 492, baseline y 292 | — | — |
| bar ×3 | `__bar` (`i`) | bars | bottom-anchored (height animates) | 16 wide, pitch 28, radius 4, height 24↔96 | `#f6c445` |

## Timing (period P = 4 s default; everything derives from `--v2c-orbit-period`)
| animation | target | duration | delay | easing | iterations |
|---|---|---|---|---|---|
| `v2c-orbit-spin` | arm | P (4 s) | 0 | linear, clockwise from 12 o'clock | infinite |
| `v2c-orbit-ring` | ring width/height | P/2 (2 s) | 0 | 135→155 (0–50%) →135, `cubic-bezier(.37,0,.63,1)` per half (sine in-out) | infinite |
| `v2c-orbit-quarter` | tile-spin | P (4 s) | 0 | 4 × [+90° over 7.5 % (0.3 s) `cubic-bezier(.45,0,.55,1)`, hold 17.5 %] at t = 0,1,2,3 s | infinite |
| `v2c-orbit-bar` | bar 1/2/3 height | P/2 (2 s) | 0 / 0.25 / 0.5 s (P/2·0.125, ·0.25) | 24→96 over 22.5 % (0.45 s) ease-out cubic `(.33,1,.68,1)`; 96→24 to 55 % (1.1 s) ease-in cubic `(.32,0,.67,0)`; rest | infinite |

## Representation choices
- Everything maps to plain boxes with `border-radius`; no approximation of shape was needed.
- Ring pulse animates `width/height` (border-box) instead of `scale()` because the measured stroke stays 6 px at both extremes; this costs layout per frame but the scene is tiny.
- Tile: one 4-segment keyframe track over the full period (not a 1-s 0→90° loop) so the marker does not snap back at each cycle.
- Bars: height (not scaleY) keeps the 4 px corner radius undistorted, as in the reference.
- Reduced motion (`prefers-reduced-motion: reduce`): animations off; static pose of t ≈ 0.5 s (dot at 45°, ring Ø 145, tile turned 90°, bars 96/≈90/24 px).

## Verification (my own pass, Playwright 1.64.1 chromium headless shell, 640×360, DPR 1)
All 120 reference PTS were rendered by pausing every `document.getAnimations()` entry at `currentTime = t·1000` and measured with the same colour-key probes as the reference:
- dot centroid error rms 0.15 px, max 0.36 px
- tile marker centroid error rms 0.09 px, max 0.29 px; tile bbox width error max 2 px (anti-aliasing during turns)
- ring bbox width error rms 1.31 px, max 2 px (Chrome snaps the animated box size to whole layout pixels; reference is sub-pixel)
- bar top error rms ≈0.5 px, max 2 px (bar 1 at frame 2)
- whole-frame mean absolute RGB difference 1.17/255 (worst frame 93: 1.32), mostly compression noise and gradient banding.
Side-by-side checks were viewed at frames 5, 30, 75, 94 (t = 0.167, 1.0, 2.5, 3.133 s); no visible composition or timing differences.

## Remaining mismatches / approximations
- Ring size steps by whole pixels in the browser (up to 2 px in diameter versus the reference at some frames).
- Tile corner radius (8 px) and bar radius (4 px) are estimates from chroma-blurred edges.
- The reference has faint chroma fringes (yuv420p) around saturated edges and slight gradient banding that the CSS render does not have.
- Easing curves are fitted closed forms (sine / quad / cubic); exact generator functions are unknown by design.

## Controls (runtime custom properties on `.v2c-orbit`)
| property | default | range | variant |
|---|---|---|---|
| `--v2c-orbit-accent` | `#ff6a49` | colour | `#7cf29a` |
| `--v2c-orbit-period` | `4s` | 2s–8s | `6s` |
| `--v2c-orbit-radius` | `112px` | 84px–150px | `140px` |
| `--v2c-orbit-ring-color` | `#4fd1cb` | colour | `#f2a7ff` |
| `--v2c-orbit-tile-color` | `#8c7bf6` | colour | `#ff9f43` |
| `--v2c-orbit-bar-max` | `96px` | 40px–200px | `130px` |
All six variants were rendered together at t = 1 s and visibly applied (dot at 60° on a 140 px orbit with 6 s period, pink ring, orange tile, taller bars).

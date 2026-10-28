# 02 — Dusk hill (`dusk`)

## Provenance

- Clip: `tests/fixtures/synthetic/clips/dusk-hill.mp4` — **synthetic** fixture (see `tests/fixtures/synthetic/PROVENANCE.md`), not external footage.
- SHA-256 `ed158ebb5c1e836234fb05faae8e78798842727a3fa02eb92de3965b3891267e`
- 640×360, H.264 yuv420p, `color_range=tv`, `color_space=bt709` (transfer/primaries untagged), timebase 1/90000, no rotation.
- 141 frames, duration 5.000 s, last PTS 4.966667. **Variable frame rate**: 1/30 s steps for PTS 0–2.0 and 3.5–4.97, 1/24 s steps between 2.0 and 3.5 (`r_frame_rate` 120/1 is meaningless here). Every measurement uses `best_effort_timestamp_time`, never frame index / fps.
- One-shot with a final hold (from ~4.5 s nothing changes). No cuts, no camera motion.
- Hold-out: authored only from the encoded clip; `tests/fixtures/synthetic/generator/` was not opened, listed or searched.

## Layer inventory (paint order, back to front)

| # | element | content | motion | pivot / origin |
|---|---|---|---|---|
| 1 | `__sky` | vertical linear gradient, horizontally uniform | none (control colours) | — |
| 2 | `__sun-track` > `__sun` | disc r=34, centre (419.5,109.5), `#fed27a` | track: translateY 0→147.3 px, 0–4.1 s | — |
| 3 | `__dusk` | full-stage `rgb(21 27 54 / 0.5)` | opacity 0→1, 1.15–4.5 s | — |
| 4 | `__hill-back` | ellipse c(429.5,386.9) r 396.4×166.7, `#5c4a7a` | none — occludes the sun by layering | — |
| 5 | `__hill-front` | ellipse c(150.8,379.5) r 317.9×119.4, `#2f3a5c` | none | — |
| 6 | `__mill` (zero-size box at hub 170,192) > `__tower`, `__rotor` > 2×`__blade`, `__hub` | trapezoid tower y190–268; blades 140×12 r6; hub r6 | rotor: rotate 0→540° clockwise, 0–4.5 s | rotor `transform-origin: 0 0` = hub centre |
| 7 | `__bird` (path) > `__bird-bob` > `__wing--l/--r` | two 15×3.5 rounded bars meeting at the body vertex | path translateX (linear) > bob translateY (±10 px, 0.8 s period) > flap rotate (12°↔44°, 0.4 s period) | wings pivot at the vertex (`100% 50%` left, `0 50%` right) |

The dusk overlay sits between the sun and the far hill: in the reference the sky and the sun darken along the same blend line, while hills, tower, hub and blades keep identical colours from the first to the last frame. The bird is dark enough that its relation to the overlay is unobservable; it is painted on top.

## Timing table (scene t = reference PTS, offset 0)

| event | t (s) | how known |
|---|---|---|
| sails start at upright cross, ~240°/s | 0 | measured |
| sun starts sinking (slow ease-in) | 0 | fitted |
| bird enters at left edge | 0.60 | measured |
| dusk overlay starts | 1.15 | fitted |
| sun first touches far-hill ridge | ~2.35 | measured (area drops) |
| sun fully hidden | ~3.25 | measured (tol-60 probe area 833 px at 3.167, 4 px at 3.25) |
| bird leaves right edge | 3.97 | measured |
| sails stop (upright cross, 540° total) | 4.50 | measured |
| dusk overlay complete | 4.50 | fitted |
| final hold | 4.5–5.0 | measured |

Easings: sails `cubic-bezier(1/3, 2/3, 2/3, 1)` — exact quadratic ease-out (constant deceleration), rms 0.21° to the unwrapped angle; sun `cubic-bezier(0.507,0.055,0.573,0.891)` over 4.1 s, rms 0.42 px on the visible top edge; dusk `cubic-bezier(0.531,0.061,0.904,0.834)` over 3.35 s, rms 0.0097 in blend factor; bob and flap use a sine-like `cubic-bezier(0.37,0,0.63,1)` with `alternate`.

## Representation choices

- Hills are single `border-radius: 50%` ellipses (least-squares fit to the ridge, rms ≈0.5 px). Occlusion of the sun comes purely from paint order.
- The darkening is one translucent overlay whose opacity animates; colour and alpha were solved by regressing last-frame against first-frame sky (alpha 0.48–0.50 per channel).
- The sky is a two-stop linear gradient; the second stop is extrapolated to y=360 because the hills hide everything below ~y=220.
- Sails are two full-length rounded bars (one rotated 90°) under a single rotor wrapper so the 4-fold cross rotates around one explicit pivot. Tower is a `clip-path: polygon()` trapezoid.
- Bird uses three nested wrappers (path > bob > flap) so each periodic component has its own timing; looping inner animations are phased with negative delays.
- `--v2c-dusk-time-scale` multiplies every duration and delay via `calc()`, so the whole timeline stretches coherently.
- Reduced motion: all animations off; static pose of t ≈ 2.0 s (sun above the ridge, bird mid-flight, sails at 14°).

## Approximations and remaining visible mismatches (after 2 refinement passes)

Mean absolute luminance difference vs reference at 13 sampled PTS: 0.54–0.71 (0–255 scale). Visible residue is edge-only:
1. Bird wing silhouette: wing angle matched via an apparent-angle measure (rms 1.7°, max 3.7°); vertex sits ~0.4 px lower on average; the reference's wing tips look marginally heavier.
2. Hill and sun edges: 1-px antialiasing outlines in the diff (fit residual ≤ 1 px; reference has yuv420p chroma blur on edges).
3. Sun late in the descent is up to 1 px lower than the reference (t > 2.7 s); after ~3.25 s the sun's motion is unobservable, so the 4.1 s end is a fitted extrapolation.
4. Tower top (y≈190) is hidden by hub and blades; its exact top shape is estimated.

## Controls (runtime custom properties on `.v2c-dusk`)

| property | default | range | variant |
|---|---|---|---|
| `--v2c-dusk-time-scale` | 1 | 0.5–2 | 1.5 |
| `--v2c-dusk-sky-top` | rgb(59 74 139) | colour | #1d2b5e |
| `--v2c-dusk-sky-horizon` | rgb(242 165 91) | colour | #ff7a59 |
| `--v2c-dusk-dusk-strength` | 0.5 | 0–0.9 | 0.75 |
| `--v2c-dusk-sail-spin` | 540deg | 90–1440deg | 900deg |
| `--v2c-dusk-bird-bob` | 10px | 0–30px | 20px |

All six were rendered at the variant values together (sky recoloured, darker dusk, sails turning further, larger bob, timeline 1.5× longer, final hold reached at 7.5 s).

## Tracks

`sun` (`#fed27a`, tol 60), `bird` (`#1b1a2f`, tol 40, sky band ROI), `sails-right-half` (`#c7c1ac`, tol 20, ROI right of the hub so the centroid moves with rotation; tower colour is outside tolerance). The sun probe follows the disc until ~3.2 s; near occlusion the render's sun area is ~8–10 % smaller than the reference (render sits ~1 px lower), see mismatch 3.

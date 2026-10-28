# Cube 3D — reference notes (scene id `cube`)

## Provenance
- Clip: `tests/fixtures/synthetic/clips/cube-3d.mp4` — **synthetic** fixture (see `tests/fixtures/synthetic/PROVENANCE.md`), not external footage.
- SHA-256 `62354adcc774a4c32c517d5fd276af7167e57b1ce26c20999458489c6f37feac`.
- 640×360, yuv420p, BT.709, limited (tv) range, no rotation tag. 180 frames, constant 30 fps (PTS 0 … 5.9667 s, step 1/30), duration 6.0 s. Loops seamlessly (frame 179 → frame 0 continues the motion).
- Hold-out: authored only from the encoded clip and measurements of its decoded frames; the generator source was not read.

## Part inventory
| part | element | notes |
|---|---|---|
| background | `.v2c-cube` background | vertical linear gradient `#1b1f2a` → `#0c1016` |
| ground shadow | `.v2c-cube__shadow` | hard-edged flat ellipse `#0a0c10`, 182×28 centred (320, 299.5); X-only squash with the bob |
| bob wrapper | `.v2c-cube__bob` | layout box (size × size, centre (320, 164.5)) + translateY bob |
| tilt wrapper | `.v2c-cube__tilt` | static `rotateX(-20.5deg)` |
| spin wrapper | `.v2c-cube__spin` | `rotateY(0→360deg)` linear |
| faces ×6 | `.v2c-cube__face--front/left/back/right/top/bottom` | flat colours, no shading; bottom never visible |

## Transform order (outer → inner)
`.v2c-cube` (`perspective: 673px; perspective-origin: 320px 157.5px`) >
`__bob` (`translateY(0 → -14px → 0)`, origin 50% 50%, preserve-3d) >
`__tilt` (`rotateX(-tilt)`, origin 50% 50% = cube centre) >
`__spin` (`rotateY(θ)`, origin 50% 50%) >
`__face` (`rotateY/rotateX(±90|180deg) translateZ(size/2)`, origin 50% 50%, `backface-visibility: hidden`).
So a face point is: placed on the cube, spun about the cube's vertical axis, tilted about the cube centre's X axis, bobbed in screen Y on the z=0 plane, then projected. This is exactly the model that was fitted.

## Timing (scene_t = ref_t, offset 0)
| t (s) | spin θ | bob | event |
|---|---|---|---|
| 0.0 | 0° | 0 (lowest) | red front face-on, shadow widest |
| 0.75 | 45° | -7 | red/blue diagonal |
| 1.5 | 90° | -14 (highest) | blue face-on, shadow narrowest (scaleX 0.846) |
| 3.0 | 180° | 0 | teal face-on |
| 4.5 | 270° | -14 | yellow face-on |
| 6.0 | 360° | 0 | = t 0 |
Spin: linear, 6 s. Bob and shadow squash: 3 s, raised cosine approximated by `cubic-bezier(0.37,0,0.63,1)` on each half.

## Measurement method
Frames decoded with ffmpeg to rgb24. Per-face colour masks (RGB distance < 30) gave centroids/areas for all 180 frames. A CSS-equivalent projection model (edge, tilt, perspective distance, perspective origin, centre, bob amplitude/phase, spin period/phase) was fitted by Nelder-Mead on centroid and √area: RMS 0.23 px, max 0.96 px. Free spin period/phase came out 5.999 s / −0.02°, and perspective origin x = 320.0, confirming a linear spin and a centred camera. Corner residuals of the rounded parameters against mask-extracted corners (12 frames, 128 corners): mean 1.8 px, median 1.6, p90 3.4, max 5.1 (extraction is biased at acute antialiased corners). Shadow measured by coverage integration along y=299 and x=320.

## Representation choices
- Real CSS 3D: six face elements in a `preserve-3d` chain under a perspective stage; no faked 2D polygons. Fitted perspective-origin (320, 157.5) is the mean cube centre, which reproduces the reference's off-axis look as the cube bobs.
- Shadow is a flat `border-radius: 50%` ellipse, not blurred, because the reference edge is hard; squash is X-only (height measured constant).
- Bob/squash durations are `calc(spin-period / 2)` so the loop stays seamless when the period control changes.

## Approximations
- Bob easing: easeInOutSine cubic-bezier instead of an exact cosine (max error well under 0.1 px at 14 px amplitude).
- Fitted values are rounded (edge 109.54 → 110, P 673.3 → 673, origin y 157.8 → 157.5, bob 13.9 → 14).
- Chromium rasterises 3D layers with its own antialiasing; edges differ by ≈1 px, and adjacent faces can show a hairline seam where their edges meet.

## Verification (author self-check; harness reports are separate)
Chromium headless shell (playwright 1.64.1), viewport 640×360, animations paused and set to t·1000 ms, at t = 0, 0.5, 1, …, 5.5, 5.9667 s, compared with reference frames 0, 15, …, 165, 179 side by side and by mask scoring: face/shadow mask IoU mean 0.968 (min 0.941, top face at t=1.5), centroid offsets ≤ 1.0 px, full-frame mean absolute error 0.68–0.76 / 255. A test with bob 15 px did not improve the scores, so 14 px was kept.

## Remaining visible mismatches
1. Candidate cube sits ≈0.3–1.0 px lower than the reference (largest at the bob peak, t = 1.5/4.5); visible only in a difference image as a one-pixel edge band.
2. Edge antialiasing differs (thin outlines in difference images along every face edge and the shadow rim); occasional faint seam between adjacent faces in Chromium.
3. Shadow width is ±1–2 px off at intermediate bob heights (shadow IoU ≈0.955–0.964).

## Controls (runtime custom properties on `.v2c-cube`)
| property | default | range | variant |
|---|---|---|---|
| `--v2c-cube-size` | 110px | 60–160px | 80px |
| `--v2c-cube-spin-period` | 6s | 3–12s | 4s |
| `--v2c-cube-tilt` | 20.5deg | 0–45deg | 35deg |
| `--v2c-cube-perspective` | 673px | 350–2000px | 400px |
| `--v2c-cube-bob` | 14px | 0–40px | 24px |
| `--v2c-cube-front` | #e74f5b | colour | #7cf29a |
Also editable: `--v2c-cube-left/-back/-right/-top/-bottom/-shadow`. All six variants applied together were rendered and visually confirmed (smaller, steeper, stronger perspective, faster spin, higher bob, green front). Not coupled: shadow size does not follow `--v2c-cube-size`, and the shadow squash (0.846) does not follow `--v2c-cube-bob`.

## Reduced motion
`prefers-reduced-motion: reduce` removes all three animations and shows a static three-quarter pose (`rotateY(30deg)`, bob 0, full shadow); verified to render non-blank with 0 running animations.

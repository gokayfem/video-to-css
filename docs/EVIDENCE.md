# Evidence log (v0.1, 2026-10-28)

Machine: Apple M4 ×10, macOS 27.0.1, Node 26.12, Playwright 1.64.1 (Chromium 156.0.8078.4 headless shell,
WebKit 27.2), ffmpeg 9.0.2. Firefox 157 (Playwright build 1555) is installed but fails to launch on this macOS
("Could not find profile folder", also outside the sandbox) — **no Firefox coverage ran**.

## Harness self-tests (`npm test`)

| test | result |
|---|---|
| seek vs hand-computed CSS timing (delay, negative delay, alternate, steps(), cubic-bezier, ::after with reverse+forwards) | Chromium and WebKit: worst centroid error 0.26 px over 11 times × 4 parts |
| capture determinism (reverse order, repeat) | pixel-identical |
| VFR clip PTS / presentation lookup / BT.709 decode | pass (frame 61 at 2.0417 s; index/fps would be off by 0.3 s) |
| strict audit rejects planted violations (svg, canvas, script, onclick, url(data:), image-set in @media, bare `div`, un-namespaced keyframes and custom property, missing reduced-motion) and accepts the examples | pass |
| negative controls on the calibration scenes (tests/scenes) | every kind caught in ≥ 1 scene; no "missed" (see below) |
| multi-instance + all-scenes host page, every control effective | pass |

## Calibration scenes (tests/scenes: synthetic fixtures, blind-authored by worker agents)

All three: structural pass, appearance pass, temporal pass, editability pass.

| scene | samples | appearance (median / p95 cell ΔE) | temporal highlights | negative controls |
|---|---|---|---|---|
| 01 orbit loop (CFR 30) | 120 | 1.13 / 1.52 | all tracks: lag 0, rate 0; loop seam periodic 0 | 6/6 caught |
| 02 dusk hill (VFR 30/24, one-shot + hold) | 141 | 0.47 / 0.90 | sun/bird/sails lag ≤ 0.017 s | 6/6 caught |
| 03 cube 3D (CFR 30) | 180 | 0.50 / 0.70 | faces lag 0 | 5/6 caught; easing **below floor** (planted error p90 1.6 px: the spin is linear, only the 14 px bob changes) |

These validate the pipeline and harness on clean vector-style references. They are not evidence of fidelity on
external or AI-generated footage.

## Wind farm — examples/wind-farm (Blender render supplied by the author, 1280×720, 240 frames)

Final full-clip compare (`artifacts/wind/compare/candidate/report.md`):

| measure | value |
|---|---|
| appearance: median / p95 time-averaged cell ΔE (16×9) | **2.48 / 8.08** (gates 4 / 10: pass) |
| cells within ΔE 5 / 10 | 79.9 % / 96.5 % (worst cell 15.5) |
| edge-layout correlation | 0.90 |
| SSIM (supplementary) | 0.657 — capped by painterly texture |
| rotor T1 / T2 timing | lag +0.008 / −0.008 s, rate error −0.1 % / +0.5 %, timing-shape 0.011 / 0.013 s |
| flowers | lag 0.017 s, median 2.3–5.5 px |
| shadow shoulder | lag −0.017 s, median 5.9 px |
| structural audit | pass (1 276 elements, 1 727 animations, 184 KB CSS) |
| editability | 19 runtime controls (incl. loop, wind, paper) all effective; multi-instance with the calibration scenes on one page: no interference |
| live playback (headless Chromium, 1280×720) | median frame interval 33 ms, p90 50 ms, 11 long frames in 4 s — **not 60 fps** in headless; on-screen not measured |

Temporal outcome **fails** on: (1) motion energy (CSS has 0.38× the reference's frame-to-frame change,
correlation −0.24, which since v0.1.1 is reported but not gated because the reference energy profile is flat, CV 0.064) — the reference's grass is many thin high-contrast strokes shimmering 1–2 px per frame; the
CSS blades are broader, so equal sway produces less pixel change; raising amplitude to match energy made the
flowers swing visibly too far, so it was not done; (2) `grass-bank-top` probe (18 px) — its colour key also
matches hill paint of the same green, so it is a weak probe; (3) rotor T2 visibility 0.83 — thin blade tips
cross the probe's colour threshold at different moments; its phase/rate/shape pass. Cloud-track phases are
reported as not identifiable (drift ≈ 6–10 px per 10 s is too slow for a ±0.1 s identifiability test).

Corrections during the run (each from matched-time evidence): hill custom property declared on a sibling
(band invisible); green-teal shoulder missed by a pure-teal classifier; rotor hub placed at the tips' mean
(7 px off under perspective) — fixed by pinning the measured spinner; haze gradient across the whole right
slope (worst cell ΔE 26.7 → 15.5); extra `}` dropping the next rule (caught by a worker; audit now checks brace
balance); part-level control declarations shadowing root values (13 of 17 controls inert; build now declares
all controls on the root); grass gust angles raised ×3 after the worker's cell-shift fit was shown to average
out tip motion (chosen, visually judged).

## Gate and check changes (all made after observing a specific failure; no gate value was relaxed)

1. `timingShape` (residual of windowed lags after a linear fit, gate = the existing 0.05 s phase gate) — added
   after the linear-easing control was missed on the orbit calibration scene.
2. After an independent review (`work/checkpoint-1`): lag analysis now uses centroid + √area (size/pulse
   animations), is offset-invariant (timing ≠ position), and only counts windows whose error rises ≥ 1.5×
   measured feature noise when shifted ±0.1 s (holds and flat signals are not lag evidence); a 3×3 region-L*
   signal checks fades/colour timing; per-animation sensitivity (one animation +0.1 s at a time) reports coverage.
   The reviewer's probes: cube shadow 0.5 s late → now caught (phase 0.49 s); dusk overlay 1 s late → now caught
   (region-luma phase/rate/shape). Orbit ring pulse shifted 0.1–0.3 s → **still not caught**: its √area signal
   is below the noise-identifiability threshold. Known gap.
3. Negative controls now record the planted error's size against the good candidate and report
   `caught / missed / below-floor` (floor = the 1 %-of-diagonal trajectory gate).
4. Audit: warm-up seek no longer runs for live checks (it had made `reducedMotion.static` vacuous and would
   have paused the perf probe); changed-pixel counts replace diluted mean-luma for no-JS playback, reduced
   motion and control effectiveness; brace balance added.

5. Control effectiveness: in addition to "≥ 100 pixels change by > 24 levels", a control also counts as
   effective if the mean |Δ| over the frame is ≥ 1 level — added because the paper-grain control changes
   thousands of pixels by ~10–15 levels each (mean |Δ| 1.69 at its variant) and no single pixel by > 24.

## Not run

Authoring evals (`evals/`, all cases UNRUN); Firefox; real-display frame pacing; any AI-generated video.

## Any-video intake (v0.1.1, 2026-10-28)

`tests/any-video.test.mjs` generates clips with ffmpeg that the calibration scenes do not cover and checks the
intake: a 640×360 H.264 clip with 90° display rotation (read as 360×640, marker ends up bottom-left as players
show it), a 480×360 clip with 4:3 pixel aspect (read as 640×360), a palette GIF (RGB path, centisecond PTS
rounding not flagged as VFR), and a 12 s 60 fps VP9 WebM (millisecond PTS rounding not flagged as VFR; an 8 s
window from 2 s). Loop guesses: rotated, GIF and WebM window one-shot; static anamorphic clip looped; the
wind farm, orbit and cube loops looped and the dusk one-shot not (checked by hand with `v2css init`).
A scene for the rotated clip written in a folder outside the repo passes all four outcomes; frozen, shuffled,
shifted, speed and misplaced copies are caught; linear easing is below floor (the motion is already linear).

Changes made after observing failures in that run:
1. Motion-energy correlation is not gated when the reference energy profile is flat (coefficient of variation
   < 0.1): a constant-speed slide gave correlation 0 between two flat profiles. Total energy and lag checks
   still gate it. No gate value changed.
2. The browser session serves the scene's own project root, not the current directory (a scene outside the
   working directory could not load).
3. The comparison grid keeps ~144 near-square cells at any aspect (16×9 at 16:9, unchanged for every result above).

## Iteration and diagnosis tools (v0.2.0, 2026-10-28)

Added after a long multi-builder reconstruction of an AI-generated portrait clip (head turn, wind, smile;
clip and scene not in the repo). Each tool answers a failure that the per-frame `compare` did not catch.
Covered by `tests/diagnose.test.mjs`. No compare gate changed.

| tool | failure that motivated it | test |
|---|---|---|
| `freeze` | review sheets mixed live files that other builders were editing; "before/after" pairs were from different builds | immutable copy, hashes verified, a tampered file reported, the clip resolves from the frozen copy |
| `triptych --prev` | improvements could not be judged against the previous state at identical PTS and crop | renders reference \| previous \| current |
| `frames` (1/120 s) | hair sets swapped between two 24 fps samples passed every per-frame check but flashed translucent and popped at sub-frame times | sheet at sub-frame times |
| `jumps` | a reveal swept from narrow to full width in one frame step (3× the reference's step there); the 120 Hz sheet over the interval looked gradual | a good scene has no flags; a planted `steps(1)` overlay is flagged at its frame |
| `playback` | stills could not show motion; VFR-safe synchronized video at reference PTS | three-column video, encoded frame count = reference frames ±1 |
| `attribute` | a dark slit under a jaw was first treated as a shadow problem; hiding layers showed a geometry gap revealing a dark layer behind | the hub layer is named as owner of the ring centre |
| `profile` | "soft edge" and "no line" claims were judged from enlarged crops; a rim shadow centred inside the contour left a dark line | a 2 px dark line and a 1 px halo found; a clean edge, ±3 noise and fine stripes report none |

Also recorded in `references/lessons.md`:
- CSS traps: `filter` before `clip-path`; default-rule specificity; anti-aliased base colours.
- Integration rules: overlap, attribution before shading, measured-edge collapse, one writer per file.
- Measurement vs acceptance, including the limits of monocular depth/normal estimators on stylised renders.

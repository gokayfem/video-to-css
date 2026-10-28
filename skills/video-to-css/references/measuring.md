# Measuring a reference

- **Identity first.** `v2css inspect` records sha256, container, codec, size, rotation, SAR/DAR,
  colour tags, every frame's presentation timestamp and a VFR flag. Untagged clips are decoded with
  BT.709 (≥720p) or BT.601 and the assumption is written down.
- **Time = PTS.** The frame on screen at time t is the last frame with `pts ≤ t`. For VFR clips
  frame index / nominal fps is wrong (e.g. 24 fps segments inside a 30 fps clip). Log quantization.
- **Look at the whole clip**: contact sheet across the duration, then dense samples around events
  (entries, exits, holds, turns, loop seam).
- **Fast structure maps** (decode once, compute in Node):
  - loop-mean frame (average of all frames): static layers and their colours without the noise of
    moving parts; sample region colours here.
  - per-pixel temporal std-dev: where things move (rotor discs, swaying grass, drifting cloud edges).
  - consecutive-frame difference vs. `frame(last) → frame(0)`: is it a seamless loop?
- **Kinematics**: colour-keyed centroids for translating parts; ring profiles around a hub for
  rotors (subtract the time-mean profile to remove the static tower/nacelle, fold mod 360/n for an
  n-blade rotor, unwrap, fit a line → deg/s); column scans for edges (ridge lines, shadow bands);
  Fourier fit (k = 1..3 cycles per loop) for periodic edges. Fit easing with `cubic-bezier()` or
  multi-keyframe segments and record the residual.
- **Oblique rotors** are affine images of a disc: three tips 120° apart give
  `hub = mean(tips)`, `c1 = tip0 − hub`, `c2 = (tip1 + c1/2)/sin 120°` → CSS
  `matrix(c1x, c1y, c2x, c2y, 0, 0)` on the rotor plane; choose the tip order that gives the observed
  screen direction.
- **Labels**: measured (read off frames), estimated (judgement), chosen (no evidence), fitted
  (solved to minimise an error). Note anything taken from generator notes or source files, and
  never read a held-out generator when the run is meant to be a video-only reconstruction.
- **AI / painted references** drift: geometry may be inconsistent between frames. Measure on many
  frames, use medians, and say where the reference itself is unstable.

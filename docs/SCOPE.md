# Supported scope (v0.1)

**Good fit for strict HTML/CSS:** single-shot graphic loops and UI motion, layered flat or cel-shaded
illustration, parallax and occlusion by layering, rotating/oscillating mechanisms (including oblique discs via
`matrix()`), simple CSS 3D (cubes, cards, turntables), fades and colour shifts, wind-like sway of many
strokes within an element budget (~1–2k elements).

**Partial fit (structure and timing yes, texture no):** painted backgrounds (gouache, watercolour), cumulus
clouds, grass fields. Silhouettes, palette, light/shade layout and every periodic motion can be matched; brush
marks, paper grain, Kuwahara-style smoothing and per-pixel noise cannot be reproduced economically without
images, so pixel metrics (SSIM) plateau even when structure and timing match. Example: `examples/wind-farm`.

**Poor fit:** naturalistic characters and faces, fluids, smoke, fire, crowds, camera moves through deep 3D,
cuts between shots, motion blur, photographic texture. The skill should say so and suggest an SVG, canvas or
shader route instead of forcing strict CSS.

**Not inferred from video:** responsive reflow (scenes scale uniformly), interaction states, the source's
original code or a generator's internal representation.

**Evidence status:** the calibration scenes in `tests/scenes` use synthetic fixtures generated in this repo (harness validation, not
external fidelity). `examples/wind-farm` targets a Blender render of a painting (external to this repo,
not AI video; its generator notes were consulted and disclosed). No AI-generated video has been reconstructed yet.

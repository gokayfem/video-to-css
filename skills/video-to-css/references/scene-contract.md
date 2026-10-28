# Scene package contract (summary of docs/CONTRACTS.md)

```
<scene-dir>/
  scene/index.html   host page: <link rel=stylesheet href=scene.css>, one root .v2c-<id>, no <script>
  scene/scene.css    exported component (strict profile)
  scene.json         id, title, profile, synthetic, reference.clip, stage, timing, controls, tracks
  params.json        measured/estimated/chosen/fitted numbers
  REFERENCE.md       provenance, inventory, timing table, representation choices, limitations
```

- Scene time t ⇔ every `document.getAnimations()` entry paused at `currentTime = t·1000`. All
  animations start at load; offsets via (negative) `animation-delay`; loops `infinite`, one-shots
  `fill-mode: both`.
- `timing: { duration, loop, offset }` — `scene_t = ref_t − offset`, no warping.
- `controls[]`: `{ name, kind: runtime|build, type, unit?, default, range, variant, description }`.
  Every runtime control must visibly change the render at its `variant` (checked by `variants`).
- `tracks[]`: `{ part, selector, color, tolerance, roi: [x,y,w,h] }` — colour-keyed probes measured
  from the reference, applied identically to reference and render. Pick ROIs where the part's
  centroid or size actually changes (e.g. half a rotor disc).
- Large scenes may be generated at build time from part modules (see `examples/wind-farm/build/`);
  keep the generator and data files, export only `scene/`.
- Template: `templates/scene/`.

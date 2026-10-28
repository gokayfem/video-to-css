# Shared contracts

Binding for every author, worker and tool in this repo. Keep changes here deliberate. Version: 1.

## 1. Scene package (one per example)

```
examples/<NN-name>/
  scene/index.html     host page: <link rel="stylesheet" href="scene.css">, one scene root, NO <script>
  scene/scene.css      the exported component (all strict-profile rules apply)
  scene.json           metadata, controls, timing, tracks (schema below)
  params.json          measured / estimated / chosen / fitted numbers (schema below)
  REFERENCE.md         inspection + measurement notes, representation choices, limitations
```

`index.html` is a minimal host. It may set `margin:0` on `body` and nothing else global.
The **exported component** is `scene.css` plus the markup inside the scene root.

## 2. Strict HTML/CSS profile (`profile: "strict-css"`)

Allowed: semantic `div`/`span`/`i`/`b` elements, `::before`/`::after`, borders, radii,
CSS gradients, `clip-path` with basic shapes (`polygon()`, `circle()`, `ellipse()`, `inset()`),
CSS-gradient masks, box/drop shadows, filters that don't reference URLs, 2D/3D transforms,
`@keyframes`, custom properties, `calc()`, `@media`.

Forbidden inside `scene/`: `<img> <picture> <video> <audio> <canvas> <svg> <iframe> <object>
<embed> <script>`, any `url(...)`, `image-set()`, `element()`, `paint()`, `@import`,
`@font-face`, data URIs, external requests, per-frame image replacement, sprite sheets.
Text, if any, uses system font stacks.

Naming — `<id>` is `scene.json.id` (short, lowercase):
- root element class `v2c-<id>`; parts `v2c-<id>__<part>`; modifiers `v2c-<id>--<mod>`
- every selector in `scene.css` starts with `.v2c-<id>` (no `*`, `html`, `body`, bare tags at top level)
- keyframes `v2c-<id>-<name>`; custom properties `--v2c-<id>-<name>`

Timing — the capture harness defines **scene time t** as: every `CSSAnimation` returned by
`document.getAnimations()` (including pseudo-elements) has `currentTime = t·1000 ms`.
Therefore all animations must start at page load (no hover/class-triggered starts) and
offsets must be expressed with `animation-delay` (positive or negative). Loops use
`infinite`; one-shots use `animation-fill-mode: both` (or `forwards` when the base style
equals the first keyframe). No JavaScript.

Transform hierarchy — nest wrappers instead of stacking compensating offsets:
`layout (position/size) > parent motion > local pivot motion > appearance`.
Set `transform-origin` explicitly where it matters and document it.

Reduced motion — `@media (prefers-reduced-motion: reduce)` must yield a static,
representative, non-blank pose (e.g. `animation: none` with base styles at that pose).

Stage — the root has a fixed native size equal to the reference frame size (e.g. 640×360),
`position: relative; overflow: hidden`. Optional uniform scaling via a custom property is fine.

## 3. `scene.json`

```jsonc
{
  "id": "orbit",                       // namespace id
  "title": "Signal orbit (graphic loop)",
  "profile": "strict-css",
  "synthetic": true,                   // reference is a synthetic fixture, not external footage
  "reference": { "clip": "tests/fixtures/synthetic/clips/orbit-loop.mp4" },   // absolute, scene-relative or project-root-relative
  "stage": { "selector": ".v2c-orbit", "width": 640, "height": 360 },
  "timing": { "duration": 4.0, "loop": true, "offset": 0 },   // scene_t = ref_t - offset (no warping)
  "controls": [
    { "name": "--v2c-orbit-accent", "kind": "runtime", "type": "color",
      "default": "#ff6b4a", "range": null, "variant": "#7cf29a",
      "description": "orbiting dot colour" },
    { "name": "--v2c-orbit-period", "kind": "runtime", "type": "time", "unit": "s",
      "default": "4s", "range": ["2s", "8s"], "variant": "6s", "description": "orbit period" }
  ],
  "tracks": [
    { "part": "dot", "selector": ".v2c-orbit__dot", "color": "#ff6b4a", "tolerance": 60, "roi": [0, 0, 640, 360] }
  ]
}
```

- `controls[].kind`: `runtime` (a CSS custom property; editable live) or `build`
  (requires regenerating CSS with a script; give the command). `variant` is a non-default
  value the toolkit renders to prove the control works.
- `tracks` are colour-keyed probes measured **from the reference** and applied identically to
  reference frames and rendered frames: pixels within `tolerance` (RGB Euclidean distance) of
  `color` inside `roi` `[x, y, w, h]` (stage pixels) give centroid, bbox and area per frame.
  Pick colours that are distinctive for one part. Declare them before comparing.
  `selector` is the scene element that renders the part; negative controls use it to
  plant a misplaced-layer error.

## 4. `params.json`

```jsonc
{
  "_meta": { "source": "<clip path>", "sha256": "…", "units": "px, s, deg", "labels": "measured|estimated|chosen|fitted" },
  "orbit.radius": { "value": 112, "unit": "px", "label": "measured", "how": "centroid track, frames 0–119", "confidence": "high" }
}
```

`measured` = read directly from frames; `estimated` = inferred with judgement; `chosen` =
author decision with no reference evidence; `fitted` = solved to minimise an error.

## 5. Harness outputs (`artifacts/<scene-id>/…`, git-ignored)

- `source.json` — sha256, size, dimensions, rotation, colour tags, all frame PTS, VFR flag.
- `ref/frames/NNNN.png` + `ref/frames.json` — requested t, decoded frame index, actual PTS.
- `cand/<label>/frames/NNNN.png` + `cand/<label>/manifest.json` — browser, version, viewport,
  DPR, scene checksum, requested/actual scene times, console/CSS errors, animation inventory.
- `compare/<label>/report.json|md`, `sheet.png` (ref | candidate | diff), `tracks.png`.
- Check result shape: `{ check, outcome: "pass"|"fail"|"info", value, gate, note }`.

Four separate outcomes are reported and never merged into one score:
**structural validity** (audit), **appearance**, **temporal fidelity**, **editability** (controls).

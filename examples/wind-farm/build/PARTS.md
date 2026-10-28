# Wind-farm part contract

Target: `fixtures/external/wind-farm/loop_720p.mp4` (1280×720, 24 fps, 240 frames, seamless 10 s loop;
frame i is at t = i/24 s). It is a Blender render from the author's Video2Nodes project. Its generator notes (`NOTES.md` in that
project) may be consulted for periods/counts only; anything taken from them is disclosed in the part notes.

Each part is `build/parts/<name>.mjs` exporting `default (ctx) => ({ html, css, controls?, tracks? })`.
`node examples/wind-farm/build/build.mjs` assembles parts in paint order:
`sky < clouds < turbines < hill < grass < flowers`. Each part's html is wrapped in an absolutely positioned
full-stage layer (`.v2c-wind__layer--<name>`), so coordinates are **stage pixels = clip pixels** (top-left origin).

`ctx` helpers: `cls(part, el)` → `v2c-wind__<part>-<el>`, `kf(part, name)` → keyframe names,
`prop(part, name)` → `--v2c-wind-<part>-<name>`, `per(k)` → duration of a cycle repeating k times per loop,
`phase(k, ph)` → negative delay putting phase fraction `ph` at t = 0, `r(v, d)` rounding.

Rules (on top of docs/CONTRACTS.md strict profile):
- Every selector starts with `.v2c-wind ` (descendant) and uses only your part's class prefix; keyframes and
  custom properties use your part prefix. Shared custom properties you may read: `--v2c-wind-loop`, `--v2c-wind-wind`.
- **Seamless loop:** every animation is `infinite` with duration `ctx.per(k)` for integer k; offsets only via
  negative delays (`ctx.phase`). Scene time t must equal clip time t (frame i ↔ t = i/24).
- No images, url(), svg, canvas, JS. Gradients, clip-path basic shapes, border-radius, shadows, filters without url are fine.
- Prefer animating `transform`/`opacity`. Element budget: clouds ≤ 700, grass ≤ 900, flowers ≤ 80.
- Return `controls` (runtime custom properties with default/range/variant/description, see scene.base.json) and
  `tracks` (colour-keyed probes measured from the reference; colour + tolerance + ROI that isolates your part).
- Measure from the decoded frames (ffmpeg → PNG, `pngjs` is installed; `node skills/video-to-css/scripts/v2css.mjs extract`
  decodes with the right colour matrix). Record measured/estimated/chosen/fitted numbers in
  `examples/wind-farm/build/notes/<part>.md` (you own that file).
- Preview: `node examples/wind-farm/build/build.mjs && node skills/video-to-css/scripts/v2css.mjs capture examples/wind-farm --times 0,2.5,5 --out work/wind/<you>`
  then compare with reference frames at the same t. Full comparison: `v2css compare examples/wind-farm`
  (writes artifacts/wind/; only the lead runs this while others work).

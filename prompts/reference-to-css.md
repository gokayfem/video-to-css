# Reference → strict HTML/CSS (copy-ready prompt)

Fill the brackets; leave unknowns as "measure" and the agent measures or states an assumption.

```
Rebuild this reference clip as an editable strict HTML/CSS animation using the video-to-css skill
and its toolkit (skills/video-to-css; commands via `node <skill>/scripts/v2css.mjs`).

Clip: [path or URL]            Output folder: [examples/NN-name or path]
Scene id (namespace): [short-id]
Must keep (identity / beats): [e.g. "three turbines turning at the clip's speed", "the bird enters at ~0.6 s"]
Allowed simplifications: [e.g. "painted texture may be flat", "background haze optional"]
Target: [width x height, browser(s)]   Performance target (optional): [e.g. ≤ 1500 elements, 60 fps desktop]
Provenance: [synthetic | external (licence) | AI-generated | render of …]

Work in this order and keep going without asking for routine approval:
1. Inspect (sha256, size, colour tags, every PTS, VFR, loop seam, provenance) → REFERENCE.md.
2. Measure parts, pivots, palette, trajectories, periods, delays, easing; label numbers
   measured/estimated/chosen/fitted in params.json. Use PTS, never index/fps.
3. Choose CSS representations; list approximations and what strict CSS cannot represent economically.
4. Block out the whole scene early (stage px = clip px, nested wrappers, integer cycles per loop,
   negative delays for phase), then refine composition and timing before detail.
5. After every step run `v2css sbs` at fixed times and show me the image.
6. Verify with `v2css check`: structural, appearance, temporal and editability are reported
   separately; negative controls must be caught. Rank ≤ 3 consequential mismatches, fix the most useful,
   keep the previous baseline. Stop polishing when two targeted fixes don't improve a mismatch — state
   the representation limit instead.
7. Deliver scene/, scene.json (controls with defaults/ranges/variants, tracks), params.json, REFERENCE.md,
   evidence paths, exact commands and honest limitations. No single "% similarity"; report named measures.

Strict profile: no img/video/canvas/svg/script/iframe, no url()/image-set/@import/@font-face,
no sprite sheets, no reference frames in the scene; namespaced selectors/keyframes/custom properties;
CSS-driven playback with JS disabled; a reduced-motion pose.
```

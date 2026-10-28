# Delivery checklist (final report)

- What exists: scene path (open `scene/index.html`), review page (`artifacts/<id>/review/index.html`),
  evidence images, part/generator sources and data.
- Provenance: synthetic fixture / external clip (licence) / AI video / a render of something else.
  Never present a self-reconstruction as an independent benchmark.
- Exact commands that were run: setup, build, `v2css check`, tests — with their actual outcome.
- Outcomes, separately: structural (audit), appearance (named numbers), temporal (per part: phase,
  rate, timing-shape, trajectory), editability (controls that work, multi-instance), performance
  (headless rAF stats, element count).
- Negative controls caught k/n and per-animation sensitivity d/m with the undetected animations listed.
- Remaining visual/temporal differences, ranked; representation limits; browsers actually run.
- Next step: the most useful next reference or fix, concretely.

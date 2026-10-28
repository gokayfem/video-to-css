# Rubric: visual review (type: review, arm: both)

Reviewer: a human or a reviewer agent that did not author either arm. Arm labels are hidden and
run order is randomised.

Inputs: the review page (`v2css review <pkg>`) or the compare contact sheet / tracks plot
(`artifacts/<id>/compare/candidate/sheet.png`, `tracks.png`), played at equal physical times
against the reference. Do not read the arm's CSS before writing findings.

Write **at most three findings**, most important first. Each finding:

- `what`: the visible mismatch or defect (e.g. "third dot starts ~0.2 s late", "back face
  visible through front during flip", "card layer pops at loop seam").
- `when/where`: time range and stage region.
- `severity`: `major` (wrong motion structure, missing/extra part, broken occlusion, seam pop,
  blank or broken frame) or `minor` (colour/shape/easing drift a viewer notices only side by side).

Verdict:

- **pass** — zero `major` findings.
- **fail** — one or more `major` findings.

Do not award points for code style, comments or tool usage. Do not score "effort". If the arm
produced nothing renderable, the verdict is `fail (no output)`.

# Review loop

1. After every authoring step: `v2css sbs <scene> --times a,b,c` (and `--crop x,y,w,h --zoom 2` for
   small parts). Look at the reference, the render and the amplified difference at the **same** PTS.
   Share these images with the user as you go.
2. Rank at most three consequential mismatches. Order: composition/silhouette > timing (phase,
   speed, easing, holds) > palette > secondary motion > texture.
3. Fix causes: wrong pivot or transform order, inheritance of custom properties, a measurement
   classifier that missed a blended colour, an affine/perspective mismatch, a gap between layers.
   Avoid compensating offsets. Before shading over a seam, find its owner:
   `v2css attribute <scene> --t s --points x,y`.
4. Re-render the same times against the previous state:
   `v2css triptych <scene> --prev <previous scene dir> --times … --crop …` (reference | previous |
   current). If two targeted corrections do not improve a mismatch, diagnose a representation limit,
   document it and move on.
5. Run `v2css compare` for the full-clip numbers and `v2css negatives` to confirm the checks still
   reject planted errors. A plausible still does not establish motion; a passing structural audit does
   not establish fidelity.

## Checkpoints for long reconstructions

- **Freeze** each candidate: `v2css freeze <scene> --rev rN [--build "<cmd>"]`. The `--build` option
  builds twice and refuses to freeze if the output differs. Evidence then names the revision and its
  hash. Compare revisions with `triptych <frozen rN> --prev <frozen rN-1>`, and check a frozen copy
  with `freeze --verify`.
- **Motion evidence** for every checkpoint:
  - `v2css playback <scene> --prev <prev>` for synchronized side-by-side video, plus a `--crop` version
    for the region being worked on.
  - `v2css jumps <scene> [--crop …]` over the whole timeline.
  - `v2css frames <scene> --from a --to b` (1/120 s) across every transition: turns, reveals,
    switches, onsets.
- **Edges and seams**: `v2css profile <scene> --t s --line x0,y0,x1,y1` across a contour gives the
  transition width and any dark lines or pale halos, in the reference and the render. Use it to verify
  "soft edge" or "no line" claims instead of judging enlarged crops by eye alone.
- **Gate local fixes**: tune a treatment at one or two key poses first, review source | previous |
  revised there, and only then propagate it through the timeline and freeze.

Reviewer prompt: `prompts/visual-review.md` (repo) — at most three findings with timestamp, crop,
evidence and a proposed check. Lessons from past reconstructions: [lessons.md](lessons.md).

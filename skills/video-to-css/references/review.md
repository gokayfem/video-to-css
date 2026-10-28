# Review loop

1. After every authoring step: `v2css sbs <scene> --times a,b,c` (and `--crop x,y,w,h --zoom 2` for
   small parts). Look at the reference, the render and the amplified difference at the **same** PTS.
   Share these images with the user as you go.
2. Rank at most three consequential mismatches. Order: composition/silhouette > timing (phase,
   speed, easing, holds) > palette > secondary motion > texture.
3. Fix causes: wrong pivot or transform order, inheritance of custom properties, a measurement
   classifier that missed a blended colour, an affine/perspective mismatch. Avoid compensating offsets.
4. Re-render the same times; keep the previous sheet as baseline. If two targeted corrections do not
   improve a mismatch, diagnose a representation limit, document it and move on.
5. Run `v2css compare` for the full-clip numbers and `v2css negatives` to confirm the checks still
   reject planted errors. A plausible still does not establish motion; a passing structural audit does
   not establish fidelity.

Reviewer prompt: `prompts/visual-review.md` (repo) — at most three findings with timestamp, crop,
evidence and a proposed check.

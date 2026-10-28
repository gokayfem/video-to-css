# Rubric: scope honesty (type: review, arm: both)

For near-miss cases where strict HTML/CSS is a poor fit for the reference (naturalistic hair,
fluid, smoke, foliage, skin detail). The skill should decline or explicitly limit scope rather
than ship a "reconstruction" that claims fidelity it cannot have.

Read the arm's final message and any written notes (`REFERENCE.md`, if produced). Look at any
scene produced.

**Pass** requires all of:

1. **States the fit problem early and specifically**: names what in the clip strict CSS cannot
   represent (e.g. thousands of independent strands, turbulent advection, per-pixel texture) and
   why (no images, no per-frame replacement, no canvas/SVG in the strict profile).
2. **No overclaiming**: does not call the output a faithful or accurate reconstruction; any
   numbers quoted are labelled measured / estimated / chosen; no invented fidelity percentage.
3. **Offers a defensible alternative** — at least one of: a clearly labelled stylised/abstracted
   CSS interpretation (e.g. a silhouette with a few gradient strand groups and a sway loop),
   a suggestion to relax the profile (video/canvas/shader) for this reference, or a declined
   scope with what reference would suit CSS.
4. **If a scene is produced**, it obeys the strict profile (`v2css audit` passes) and its
   notes say which parts are stylised rather than reconstructed.

**Fail** if any of: claims a faithful reconstruction; silently embeds the clip or frames (also an
audit failure); spends the budget iterating fidelity without ever flagging scope; or declines
with no reason and no alternative.

Record at most three findings, as in `visual-review.md`.

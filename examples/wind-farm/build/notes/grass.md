# Grass and flowers (parts `grass`, `flowers`)

Files: `build/parts/grass.mjs`, `build/parts/flowers.mjs` (imports the gust constants from grass).
Scratch and evidence: `work/wind/grass/` (tools in `work/wind/grass/tools/`).

## Taken from the generator notes (read-only, Video2Nodes wind-farm `NOTES.md`)
Only the periods: gusts 2 per loop (travelling), flutter 7 per loop, flower sway 3 per loop, and that the
bank north-west of the meadow centre is denser. Everything else below was measured from the decoded clip.

## Method
- All 240 frames decoded with `v2css extract` (bt709/tv), times `i/24 + 0.004 s`. (Times rounded to 5
  decimals collapsed some frames onto neighbours, so a small offset was used; max quantisation 0.004 s.)
- **Region map** (measured): frame 0, 20×20 px cells, rows y = 380…700. Per-pixel class: sky/cloud
  (b > 150), teal band (r < 60, b > 60), dark blade pixel (luma < 150), lit ground. Cell code by dark
  fraction: D > 75 %, d 45–75 %, m 15–45 %, l lit, t teal, `.` sky. Embedded as `MAP` in grass.mjs.
- **Cell shade** (measured): mean colour of the cell's dark pixels projected onto the axis
  #3f7130 → #a8c21e, quantised 0–9 (`SHADE`).
- **Sway** (measured/fitted): per 80×40 cell, horizontal shift of each frame against the loop-mean frame
  (SSD block match, ±6 px, parabolic sub-pixel), then Fourier coefficients at k = 1, 2, 3, 7 per loop.
  Cells dominated by k = 1/3 (the drifting shadow-band edge, a hill/cloud effect) were excluded.
- **Flowers** (measured): colour-threshold connected components on frame 0 (white r>180,g>190,b>150;
  yellow r>185, 100<g<210, b<110), horizon clouds excluded; per-flower head x-centroid tracked in a small
  ROI over all 240 frames and fitted at k = 2 and k = 3.

## Numbers
| quantity | value | label |
|---|---|---|
| bank colours (x 0–500, y 520–720) | p05 #3f732e, p25 #4f7f2e, p50 #5c8a2f, p75 #779f30, p95 #abc418 | measured |
| bank top over teal (x 0–300, y 460–540) | blades ≈ #47823d / #4c8443 against teal #0b755d | measured |
| lit-slope tufts / lit ground (x 700–1250, y 560–720) | #719523 / #b5c80e | measured |
| control defaults dark / light / shadow | #3f7130 / #a8c21e / #1f6e58 | chosen from the measured values |
| lean | tips to the right (wind from the left); arcs over, tips 25–70 % of box width right of the root | measured direction, chosen shape |
| bank blade length | ≈ 45 px at y 460 to ≈ 150 px at y 720 (`(38 + 0.42·(y−440))·[0.7,1.3]`) | estimated |
| lit tuft size | ≈ 9 px at y 470 to ≈ 30 px at y 720 | estimated |
| gust k = 2 phase plane | φ(x,y) = −0.849 + 0.0008·x + 0.0015·y cycles (peak right bend at 2t/L = φ) | fitted (27 grass cells; residual ≈ 0.05) |
| → gust travel | rightward and down-screen (towards the viewer): along x ≈ 250 px/s, along the gradient ≈ 118 px/s, wavelength ≈ 590 px | derived |
| gust amplitude (cell shift) | median 0.62 px, up to ≈ 2 px at y ≈ 700 | measured |
| flutter k = 7 | median 0.24 px, phase ≈ 0.18 roughly constant across the bank (not travelling) | measured |
| CSS gust / flutter angles | ±0.4° / ±0.14° × per-tuft 0.7–1.3 × `--v2c-wind-wind` | fitted (rescaled until the rendered cell-shift amplitudes matched) |
| PH0 used | −0.899 (−0.849 − 0.05: rendered tufts lagged by 0.05 cycles at the same cells) | fitted |
| flower head sway k = 2 / nod k = 3 | 1.0–5.1 px / 0.6–6.3 px, nod phases mostly 0.09–0.24 | measured (12 flowers tracked ≥ 90 % of frames) |
| untracked flowers | sway 3.3 px, nod 3.7 px, nod phase 0.19 ± 0.075, gust phase from the plane | chosen (medians of tracked) |
| stem length | 12 + 0.07·(y − 430) px (pivot for the angles) | estimated (stems hidden in the reference) |
| daisy / buttercup | petals #f4f0da, centre #e2a91a / #f2bf08; head sizes = measured blob + 1 px | measured |

## Representation
- Grass: 714 tufts + 1 container = **715 elements** (budget 900). One element per tuft: the element holds the
  gust rotation, its `::before` holds the flutter rotation and draws the tuft as ONE `clip-path: polygon()`
  that traces 2–7 tapered quadratic-curve blades (14 bank shapes, 8 lit shapes, seeded PRNG). Root→tip
  `linear-gradient` from `color-mix()` of the dark/light/shadow controls with per-tuft weights from the cell
  shade (±0.25 per-tuft spread for dark/light stroke interleave). `transform-origin: 50% 100%` (tuft base)
  on both levels. Painted far→near by base y. Densities per cell: D 2.1, d 1.4, m 0.7, lit 0.5 (chosen);
  bank-type tufts only left of an estimated bank edge, small tufts elsewhere, none in teal cells or the far
  upper slope (y < 470).
- Flowers: 25 flowers × 2 + container = **51 elements** (budget 80). `.flowers-f` at the stem foot carries the
  k = 2 sway; `.flowers-n` carries the k = 3 nod; `::before` stem, `::after` head (radial gradients).
- All animations: duration `ctx.per(k)`, phase only via negative `ctx.phase()` delays, ease-in-out
  two-keyframe swings (approximate cosines). Var fallbacks on every colour/scale read.

## Controls and tracks
Controls (runtime): `--v2c-wind-grass-dark`, `--v2c-wind-grass-light`, `--v2c-wind-grass-height` (scale about
each tuft base), `--v2c-wind-flowers-daisy`, `--v2c-wind-flowers-buttercup`, `--v2c-wind-flowers-size`;
amplitude follows the shared `--v2c-wind-wind`.
Tracks: `grass-bank-top` #4c8443 ±38 in [180,445,140,45]; `grass-bank` #5c8a2f ±30 in [20,600,360,110];
`flowers-daisy-a` #f0ebd2 ±45 in [92,466,46,28]; `flowers-daisy-b` #f0f2dc ±45 in [126,682,48,34];
`flowers-buttercup` #f1c403 ±55 in [336,534,40,32]. (The grass tracks also pick up hill paint of similar
green; the hill's bank colour decides how clean they are.)

## Verification (actual runs)
- 48 rendered frames (t = i·10/48) through the same cell-shift fit: grass k = 2 mean |Δphase| 0.056 cycles
  (bias 0.000) over 27 cells; median amplitude ref 0.62 px vs CSS 0.71 px; k = 7 0.24 vs 0.27 px.
- Flower tracks (ref 240 frames vs CSS 48): daisy-a k2 4.39/0.01 vs 4.39/0.01, k3 4.07/0.41 vs 4.00/0.41;
  daisy-b k2 5.55/0.29 vs 4.67/0.29, k3 7.11/0.17 vs 6.24/0.17; buttercup k2 1.61/0.04 vs 1.71/0.03,
  k3 4.04/0.09 vs 3.95/0.09 (amplitude px / phase cycles).
- `v2css audit examples/wind-farm`: pass (whole scene, at the time of writing).
- Images: `work/wind/grass/sbs-final.png`, `crop-final.png` (2× lower-left, ref | CSS, t = 0),
  `motion-final.png` (top ref, bottom CSS, t = 0, 0.25, 0.5, 0.75, 1.0 s, crop x 70–270, y 450–580, 2×),
  iterations `crop-1…5.png`.

## Approximations and remaining mismatches
- The reference's blades are brushed: soft edges, light rim highlights, teal shadow streaks between strokes.
  The CSS blades are hard-edged flat gradients, so the bank reads cleaner and more uniform, with fewer
  bright yellow-green strokes and no teal streaks inside the bank.
- Rigid rotation about the tuft base stands in for per-vertex bending ∝ tip² (the tip moves the same, the
  mid-blade a little more than in the reference).
- The gust is one sinusoid per tuft. The reference noise gust is not exactly sinusoidal (k = 1/3 residue)
  and the phase plane fits worst at the bank top (y < 520), where cells sit on the band edge.
- Lit-slope tufts are evenly scattered hooks; the reference's are a little finer and less regular.
- Flowers sit on top of all grass (the reference partly hides some heads behind blades); only 25 of the
  visible flowers are placed (tiny specks under ≈ 2 px are omitted); daisy petals are a radial gradient,
  not individual petals.
- Placement follows the reference's shadow band. Where the hill part's band differs from the reference,
  tufts can appear on the band in the render.

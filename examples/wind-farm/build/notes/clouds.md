# Clouds part: notes

Source: `build/parts/clouds.mjs`. Reference frames were decoded with `v2css extract` (BT.709, tv range), using frame 0 and 20 frames at t = 0, 0.5, … 9.5 s.
Labels: **measured** means read from frames, **estimated** means inferred with judgement, **fitted** means solved by an algorithm, **chosen** means an author decision.

## Taken from the generator notes (Video2Nodes wind-farm `NOTES.md`, read-only)
- The lobes swell and circle once per loop, and whole masses drift on a circle once per loop. I used this to pick
  **k = 1 cycle per loop** for both motions. The drift amplitudes and phases were measured independently (below).
- The clouds are stacked round lobes, lit by a sun from the upper right. This matches what the frames show.

## Colours (measured, frame 0, means over cloud pixels above the hill line)
| quantity | value | how |
|---|---|---|
| lit cream | `#f4f3e1` (bands range #eff1e3 to #f4f3e1) | pixels with r ≥ 226 and b − r < 20 |
| shade body | `#add5f3` (#acd4f3 to #aed5f3, uniform across masses) | cloud pixels with b − r > 45 |
| transition mid tone | `#d5e6e9` | the rest of the cloud pixels; reproduced by the lit-lobe rim gradient |
| cloud classifier | r > 150 and b > 200, above the hill line | the hill line is the first row from y = 250 where blue < 170 for 4 px |

## Geometry (fitted)
- The silhouette mask is all cloud pixels on frame 0. Where a column's cloud touches the hill line, the mask is extended 30 px below it, so clouds continue under the hill.
- The packing is a greedy max-inscribed-circle pack on a chamfer distance transform, run in `clouds.mjs --fit`.
  - **Body:** 110 circles, r_min 10, r_max 70, grown by 0.5 px. They cover 95.2 % of the mask, with 0.5 % spill.
  - **Lit lobes:** 395 circles on the lit mask, r_min 4.5, r_max 45, grown by 2.2 px. They cover 82.5 %, with 12 % spill. A lit lobe is kept only if it sits on a body circle, which removes lit flecks on the turbines.
- Masses, split by circle-centre x:
  - left 0–185: 9 body + 24 lit
  - left2 185–320: 9 + 9
  - bank 320–645: 16 + 20
  - tower 645–775: 15 + 68
  - big 775–1095: 41 + 179
  - right 1095+: 20 + 95
- Pass-1 element count was 512 (505 lobes + 6 mass wrappers + 1 root). After pass 2 it is **657**, within the 700 budget.
- Check on frame 0, ROI [640, 80, 460, 320] (the big cumulus): the cloud-mask IoU between reference and render is **0.974**, and the mean |ΔRGB| is **7.4** levels.
- Regenerate with `node examples/wind-farm/build/parts/clouds.mjs --fit work/wind/clouds/ref/00000.png`, which rewrites the FIT block. A normal build never reads the clip.

## Refinement pass 2: interior tone (layering inverted)
Before this pass, lobes sat on a blue shade body, so shade showed through every gap and the interior read too blue.
- **New layering in each mass (chosen):**
  1. 110 body circles in the **lit** cream, darkening a little toward the lower-left rim.
  2. **390 shade patches.** These are circles packed greedily onto the frame-0 **shade mask**, with r_min 2, r_max 50, grown by 2 px. A cloud pixel counts as shade when it is nearer #add5f3 than #f4f3e1 in RGB. The patches cover 82 % of the mask, with 12 % spill.
  3. **170 lit lobes on top** (r_min 5, grown by 0.5 px; 61 % coverage, 1.8 % spill). These give the convex lit lobe edges and the lower-left crescents.
- **Element count 657** (was 512). Per mass, body + shade + lit:
  - left 9+24+8
  - left2 9+13+1
  - bank 16+35+7
  - tower 15+29+24
  - big 41+199+85
  - right 20+70+45
- **Metric (measured).** `work/wind/clouds/litfrac.mjs` takes cloud pixels above the reference hill line and classifies each by its nearest colour (lit or shade). The same pixel set is used for the reference and the render, both at frame 0. The render is captured with the other parts present.

| | ref | before (512 el.) | after (657 el.) |
|---|---|---|---|
| lit fraction, left | 53 % | 30 % | 61 % |
| left2 | 43 % | 24 % | 61 % |
| bank | 50 % | 28 % | 70 % |
| tower | 74 % | 59 % | 87 % |
| big | 51 % | 41 % | 54 % |
| right | 66 % | 52 % | 69 % |
| ROI [640,80,460,320] lit fraction | 66 % | 55 % | 68 % |
| ROI cloud-mask IoU | — | 0.974 | 0.978 |
| ROI mean \|ΔRGB\| | — | 7.4 | 6.8 |

- Intermediate fits, all measured on frame 0 in the ROI:
  - 260 shade + 280 lit: 77 % lit, ΔRGB 7.4
  - 340 shade + 220 lit: 72 %, ΔRGB 7.0
  - Final, with harder shade rims (shade held to 90 % before the fade): 68 %, ΔRGB 6.8

## Shading (chosen; the layering is described in the pass-2 section above)
- **Lit lobe:** a radial gradient centred at 64 % / 30 % (upper right). It runs from a highlight (the lit colour mixed with 35 % white), through flat lit, to a rim that mixes in 22–42 % of the shade colour. An inset `box-shadow` adds a shade crescent on the lower-left rim. Sizes use em units, with font-size equal to the lobe radius.
- **Body:** almost flat shade, with a slight lit tint at the upper right.
- **Edges:** `filter: blur(0.6px)` on the cloud root, for soft painted edges.

## Motion
**Mass drift (measured).** Method: SSD block matching with integer search ±18 px and a parabolic sub-pixel fit, on luma, over 20 frames. The results were then fitted to x = A cos(2πt/10 − φ). The keyframes subtract the t = 0 value, so frame 0 is exactly the fitted silhouette. Each mass uses 12 linear keyframe steps on one 10 s cycle. The worst sampling error is about 0.35 px.

| mass (ROI) | Ax px | φx | Ay px | φy | fit rms px |
|---|---|---|---|---|---|
| big (660,90,440,250) | 9.61 | 85° | 1.11 | −146° | 0.36 |
| tower / lower-left of big (650,280,130,200) | 9.50 | 110° | 0.65 | 156° | 0.21 |
| right (1100,270,180,180) | 7.66 | 32° | 0.44 | 111° | 0.21 |
| left (0,290,170,90) | 9.13 | −134° | 2.20 | −50° | 0.23 |
| left2 (195,335,120,55) | 8.55 | −72° | 2.05 | −13° | 0.16 |
| bank (360,360,280,60) | 6.30 | −75° | 1.51 | −28° | 1.20, noisy because turbine towers sit in the ROI |

The drift is mostly horizontal. Each mass circles on a near-horizontal world circle that the camera sees from a low pitch, so on screen it becomes a flat ellipse.

**Check on the render** (the same method on 20 captured frames):
- big top: 9.40 px / 82° (the reference measured 10.56 / 75° on this sub-ROI)
- big mid: 9.44 / 84°
- tower: 8.85 / 104°
- right: 8.17 / 33°
- left: 8.22 / −131°
- left2: 8.06 / −76°

The bank ROI reads only 1.4 px in the render. The static turbine towers dominate it, because the CSS bank has low contrast. The bank's keyframes do use the measured 6.3 px.

**Lobe billow (estimated).** After removing the mass drift, 40 × 40 patches in the big mass still move 3–7 px peak to peak, roughly circular, once per loop. Some patches hit the ±6 px search limit, and swelling contaminates the numbers. I chose a wobble of radius **2.5 px** plus a **±3 % scale pulse**, both 1 cycle per loop, with seeded random phases per circle (chosen). The real per-lobe phases were not fitted.

## Controls (runtime)
| control | default | range | variant |
|---|---|---|---|
| `--v2c-wind-clouds-lit` | #f4f3e1 | colour | #ffd2a8 |
| `--v2c-wind-clouds-shade` | #add5f3 | colour | #8f8fc8 |
| `--v2c-wind-clouds-drift` | 1 | 0–4 | 3 |
| `--v2c-wind-clouds-billow` | 1 | 0–4 | 3 |

## Tracks
All three key on the lit colour #f4f3e1 with tolerance 30:
- `clouds-tower-top`, ROI [760, 80, 340, 200]
- `clouds-right-mass`, ROI [1100, 260, 180, 230]
- `clouds-left-bank`, ROI [0, 290, 190, 85]

## Approximate / remaining mismatches
- **Brush texture is not reproduced.** The reference has gouache grain, Kuwahara patches and irregular faceted lobe shapes. The CSS has smooth gradient circles. The silhouette matches closely (IoU 0.97), but the interior reads as "stacked balls". The lit areas are more fragmented than the reference's large continuous lit faces, because lit-mask coverage is 82 % and the circles leave gaps.
- The shade crescents are uniform per lobe. In the reference they are irregular and vary in width.
- After pass 2, the banks and the tower are now **too lit**: about 8–20 points above the reference. Their thin shade crescents fall below the 2 px minimum patch radius. The big cumulus is within 3 points of the reference.
- Shade patches are round blobs. The reference's shade forms connected crescents and undersides, so ours reads more spotty.
- The per-lobe billow phases are random, not measured. This means the in-cloud shading changes over time do not match the reference frame by frame, and only the mass drift is temporally faithful.
- The bank-mass drift is the least reliable measurement, because of the turbine occlusion.

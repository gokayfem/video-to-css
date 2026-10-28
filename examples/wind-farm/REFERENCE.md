# Wind farm ridge — reference notes

## Provenance

- Clip: `fixtures/external/wind-farm/loop_720p.mp4` (media not committed).
  sha256 `a4faf8ffdc16b710be088ab2d3001ced709fa9a914f6c42e6fed56194554b9ef`, 3 472 512 bytes.
- **What it is:** byte-identical to `wind-farm/out/loop_720p.mp4` from the author's Video2Nodes project: a
  **Blender EEVEE render** of a procedural reconstruction of a still anime painting
  (`reference/reference.png`, "batch-07 #167", Krea prompt "Hand-painted anime background art…").
  It is not AI-generated video and not independent footage.
- The generator notes (`wind-farm/NOTES.md`) were read and used for: the loop length and
  seamlessness (frame 241 ≡ frame 1), "rotors turn whole thirds per loop", gust 2 / flutter 7 / flower 3 cycles
  per loop, cloud billow and drift once per loop. Every geometric and colour number below was measured on the
  decoded clip, not taken from `build.py`.

## Clip facts (measured, `v2css inspect`)

1280×720, H.264 yuv420p, tv range, colour matrix **untagged** (decoded as BT.709 — assumption), 24 fps CFR,
240 frames, PTS i/24 s, 10.000 s. Loop seam: mean |Δluma| last→first 1.28 vs median step 0.79 (320 px probe),
consistent with a seamless loop (the source says pixel-identical frames 1 and 241).

## Inventory and paint order (back to front)

| layer | part file | construction | motion |
|---|---|---|---|
| sky | `build/parts/sky.mjs` | vertical gradient + top-centre lobe (stops sampled at x = 20…1000) | static |
| clouds | `build/parts/clouds.mjs` (worker) | 6 masses, 657 elements: lit-cream body circles, shade patches packed on the frame-0 shade mask, lit lobes | mass drift on a flat ellipse once per loop (≈ 6–10 px, measured per mass); lobe billow (chosen) |
| turbines | `build/parts/turbines.mjs` | tower trapezoids, nacelles, spinners; rotor = `matrix()` plane solved from 3 frame-0 tips + inner `rotate()` | T1 6×120°, T2 7×120°, T3 6×120° per loop, clockwise (measured, fit RMS 2.1/2.6/4.5°); T4/T5 5×120° (chosen) |
| hill | `build/parts/hill.mjs` | clip-path polygons from column scans (`build/data/hill.json`): ground, upper slope, teal band, left shoulder, crest rim | shoulder edge: 9 fitted keyframes (every 1.25 s); band right side static |
| grass, flowers | `build/parts/grass.mjs`, `flowers.mjs` (worker) | generated tapered blades and daisy/buttercup heads | gust (2/loop, travelling) × flutter (7/loop); nod 3/loop |

## Key measurements

| quantity | value | label | how |
|---|---|---|---|
| T1 hub / tips (t=0) | (365.3,136.2); (410,59) (261,98.5) (425,251) | measured | gridded zoom crops; hub = mean of tips (self-consistent to 0.2 px) |
| T2 tips | (538,244.5) (457.5,257) (528.75,347.5) | measured | 4× gridded crop |
| T3 tips | (617.75,316.25) (581.9,354.4) (627,393) | measured / estimated (lower tip off-crop) | 8× gridded crop |
| rotor speeds | 71.94, 83.96, 72.01 °/s | measured | ring profile − time-mean profile, 3-fold circular mean, unwrap, linear fit over 240 frames |
| ridge line | y 384 (x=0) → 546 (x=1280) | measured | first green pixel per 16-px column, median over time, 5-tap median |
| teal band | top 403→648, bottom 461→698 | measured | shadow classifier r<95 & g>r+30 (top), pure teal (bottom), medians, smoothed |
| band right-side motion | top static ±0.8 px; bottom 4.5 px at 3/loop | measured | Fourier fit, x 700–1200 |
| colours (loop mean) | band #007769, lower slope #aec404…#baca02, upper right #c3d325, crest #73ab33, haze #b2d090 | measured | `work/wind/mean240.png` region means |

## Representation limits (honest)

- Gouache brush texture, paper grain and the compositor's Kuwahara smoothing are not reproduced; cloud
  interiors read as smooth lobes and the slopes as clean gradients.
- The left-shoulder shadow is a sampled keyframe track (9 samples), not the true moving cloud shadow.
- Grass blade positions are generated, not traced: individual blades do not match; density, colour, lean and
  gust timing are the matched properties.
- The far turbines (T4, T5) are too small to measure blades; their speed is chosen.

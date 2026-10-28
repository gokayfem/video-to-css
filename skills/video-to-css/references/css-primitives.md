# Mapping visible parts to CSS

| visible thing | strict-CSS construction | notes |
|---|---|---|
| sky / flat gradients | `linear-gradient` + broad `radial-gradient` lobes on one element | sample stops on the loop-mean frame |
| hills, ridges, shadow bands | full-stage `div` + `clip-path: polygon(px…)` from measured column scans | animate a moving edge with clip-path keyframes (same vertex count); smooth noisy edges with median + mean filters |
| puffy clouds | circles with `radial-gradient` shading, fitted to a frame-0 mask (greedy packing); body in the lit tone, shade only where the reference is shaded | drift = wrapper keyframes on a circle; billow = small scale/translate per lobe |
| rotating parts | wrapper at the pivot; `transform-origin` explicit; linear `rotate()` keyframes | n-fold symmetric parts: rotate k·360/n per loop for a seamless loop |
| oblique discs (rotor planes, wheels) | `matrix()` plane solved from three points + inner `rotate()` | or real CSS 3D (`perspective`, `preserve-3d`) when perspective matters |
| simple 3D objects | `perspective` on stage, `transform-style: preserve-3d`, faces with `translateZ`, `backface-visibility` | nested bob > tilt > spin |
| grass, strokes, hair-like texture | tapered elements (clip-path triangles) rotating from the base; nested gust (k=2) × flutter (k≥5) wrappers; phase delay varying with x to make gusts travel | budget elements (≈1k); clumps of several strokes per element via multiple gradients |
| fades / colour shifts | `opacity` / `background-color` keyframes, overlay layers | the region-luminance signal in `compare` checks their timing |
| rounded forms (faces, limbs, fruit) | crisp core shape inset 1–2 px plus a colour-matched blurred copy for a locally feathered edge; interior form from a few named soft shapes (lit plane, turning shadow centred on the contour, cast/occlusion shadow painted underneath) | blur a wrapper, not the clipped element; no uniform dark rim; verify edges with `profile` |
| turning forms (head turn, rotating object with changing silhouette) | one polygon with constant vertex count morphed through measured outlines; features carried by the same rig | avoid cross-fading whole pose sets — doubled features and pops at 60/120 Hz |
| sheer fabric, veils, smoke | translucent band (`opacity` ≈ measured), soft edge on a wrapper, darker double layer at folds; per-region paint order vs what it covers | measure opacity from luma under vs beside it |
| reveals / occlusion during motion | the revealed part stays opaque; a keyframed mask/clip edge driven by the reference's measured per-frame outline | never swap sets between frames; enforce a minimum width so the clip cannot shatter |
| painterly brush texture, paper grain, film noise | **not economical** in strict CSS | state it; it caps pixel metrics (SSIM) even when structure and timing match |

Custom properties: declare them on an ancestor that every consumer inherits from (a part's layer
wrapper), not on a sibling — an undefined `var()` makes the whole declaration invalid at computed time
(`background: none`). Keyframes may use `var()`; durations can be `calc(var(--loop) / k)`.

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
| painterly brush texture, paper grain, film noise | **not economical** in strict CSS | state it; it caps pixel metrics (SSIM) even when structure and timing match |

Custom properties: declare them on an ancestor that every consumer inherits from (a part's layer
wrapper), not on a sibling — an undefined `var()` makes the whole declaration invalid at computed time
(`background: none`). Keyframes may use `var()`; durations can be `calc(var(--loop) / k)`.

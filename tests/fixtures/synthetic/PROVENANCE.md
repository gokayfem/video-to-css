# Synthetic reference fixtures — provenance

**These clips are synthetic.** They were generated on 2026-10-28 for this repository by
`tests/fixtures/synthetic/generator/clips.mjs`: a small Node software rasterizer (signed-distance
shapes, analytic easing, hand-written perspective projection) piped as raw RGB into
ffmpeg/libx264 (yuv420p, BT.709 limited range, CRF 16, 90 kHz timebase). No browser, CSS
engine or external media was involved in producing them. License: same as this repository.

| clip | size | duration | frame timing | content type |
|---|---|---|---|---|
| `clips/orbit-loop.mp4` | 640×360 | 4.0 s, 120 frames | constant 30 fps | graphic loop |
| `clips/dusk-hill.mp4` | 640×360 | 5.0 s, 141 frames | **variable**: 30 fps, 24 fps between 2.0–3.5 s | layered illustration, one-shot with final hold |
| `clips/cube-3d.mp4` | 640×360 | 6.0 s, 180 frames | constant 30 fps | simple 3D (perspective) loop |

## Hold-out rule

The generator source contains the exact motion functions. Reconstruction authors (human or
agent) work **only from the encoded clips** and measurements taken from them; they must not
read `tests/fixtures/synthetic/generator/`. The reconstructions in `examples/` were authored by
separate worker agents instructed under this rule. That is a procedural hold-out, not a
technical one, and the lead who wrote the generator also reviewed the results.

## What these fixtures can and cannot show

They exercise the complete encoded-video path (container parsing, PTS handling including VFR,
YUV→RGB decoding, compression noise) and give known ground truth for harness tests. They are
clean vector-style graphics designed to be representable in CSS. They are **not** evidence
of reconstruction quality on external or AI-generated footage.

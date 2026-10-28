# Part contract (for an optional worker building one part of a scene)

```
You own ONLY: [part module/file paths] and [scratch dir]. Do not edit other files; others edit in parallel.
Shared, fixed inputs (do not change): docs/CONTRACTS.md, [build script / scene contract file], the
reference clip [path], coordinate system (stage px = clip px, origin top-left), time base
(scene t = clip PTS; loop [L] s; every cycle an integer divisor; offsets via negative delays),
naming prefix [v2c-<id>__<part>-*, --v2c-<id>-<part>-*, v2c-<id>-<part>-*], element budget [N],
shared rig / landmarks module [path, read-only] — place features from it so parts cannot drift apart.
Deliver: the part (html/css/controls/tracks), notes with labelled measurements, and
`v2css triptych <scene> --prev <baseline> --times [times] --crop [your part]` (save a baseline before
your first edit; reference | previous | current at identical PTS and crop). For anything that moves
through a transition, also `v2css frames` (sub-frame) and `v2css jumps --crop [your part]`.
If a defect sits where your part meets another, run `v2css attribute` before touching it and report
the owning layer instead of compensating locally. If a shared contract is wrong for your part, report it.
An isolated part check proves only that part; the lead judges the integrated, frozen scene.
Report numbers and remaining mismatches honestly; a metric that improved is not visual acceptance.
```

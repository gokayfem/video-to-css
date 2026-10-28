# Part contract (for an optional worker building one part of a scene)

```
You own ONLY: [part module/file paths] and [scratch dir]. Do not edit other files; others edit in parallel.
Shared, fixed inputs (do not change): docs/CONTRACTS.md, [build script / scene contract file], the
reference clip [path], coordinate system (stage px = clip px, origin top-left), time base
(scene t = clip PTS; loop [L] s; every cycle an integer divisor; offsets via negative delays),
naming prefix [v2c-<id>__<part>-*, --v2c-<id>-<part>-*, v2c-<id>-<part>-*], element budget [N].
Deliver: the part (html/css/controls/tracks), notes with labelled measurements, and
`v2css sbs` images at [times] (full frame + a crop of your part).
If a shared contract is wrong for your part, report it; do not compensate locally.
An isolated part check proves only that part; the lead judges the integrated scene.
Stop after the blockout + at most two refinement passes; report numbers and remaining mismatches honestly.
```

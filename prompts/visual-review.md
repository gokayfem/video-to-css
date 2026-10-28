# Visual review (independent reviewer)

```
Review checkpoint [frozen revision dir + its FREEZE.json hash] of scene [id]. Do not edit the implementation.
Evidence: artifacts/<id>/{SUMMARY.md, compare/candidate/{report.md,sheet.png,tracks.png},
compare/neg-*/report.json, compare/sensitivity.json, audit/audit.json, variants/sheet.png} plus the
checkpoint's triptych (reference | previous | current at matched PTS and crops, 100 % and enlarged),
playback video, `jumps` output and sub-frame `frames` sheets around transitions.
You may run your own read-only probes into [scratch dir] (e.g. `v2css profile` across a contour,
`v2css attribute` at a defect, capture with injected CSS) to test whether a check would catch an error.

Separate: appearance, temporal fidelity, runtime representation (strict profile), editability, performance.
Return at most three findings, ranked by consequence. Each: evidence (file, timestamp, crop, numbers),
why it matters, a concrete fix or a check that would fail until it is fixed. Fewer is fine.
Say exactly what you could and could not view (stills vs real-time playback; which times and crops).
A structural pass does not establish fidelity; a plausible still does not establish motion; an
improved scalar metric does not establish visual acceptance. Evidence mixed from live files is not a
checkpoint. No speculative polish requests.
```

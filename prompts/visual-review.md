# Visual review (independent reviewer)

```
Review checkpoint [commit / snapshot path] of scene [id]. Do not edit the implementation.
Evidence: artifacts/<id>/{SUMMARY.md, compare/candidate/{report.md,sheet.png,tracks.png},
compare/neg-*/report.json, compare/sensitivity.json, audit/audit.json, variants/sheet.png}.
You may run your own read-only probes into [scratch dir] (e.g. capture with injected CSS and
compareRun against the reference frames) to test whether a check would catch a specific error.

Separate: appearance, temporal fidelity, runtime representation (strict profile), editability, performance.
Return at most three findings, ranked by consequence. Each: evidence (file, timestamp, crop, numbers),
why it matters, a concrete fix or a check that would fail until it is fixed. Fewer is fine.
Say exactly what you could and could not view. A structural pass does not establish fidelity; a
plausible still does not establish motion. No speculative polish requests.
```

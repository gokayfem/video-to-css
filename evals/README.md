# Authoring evaluation: with-skill vs without-skill

Question (c) of the brief: **does the `video-to-css` skill improve authoring outcomes?**
This folder holds the protocol, four held-out cases and their graders.

> **Status: no eval has been run yet.** Every case is `UNRUN`. No reference clips for these
> cases exist; each case describes in text what clip must be supplied. Nothing here makes model
> calls. `node evals/check-evals.mjs` only validates the files.

## Arms

| Arm | Gets | Does not get |
|---|---|---|
| `with` | case `prompt.md`, the clip, `docs/CONTRACTS.md`, the `skills/video-to-css` skill + toolkit | examples' source fixtures, held-out grader data |
| `without` | case `prompt.md`, the clip, `docs/CONTRACTS.md` | the skill, the toolkit, `examples/` |

`docs/CONTRACTS.md` is given to **both** arms because it defines the output format the graders
read (scene package, strict profile, naming, timing). The skill is method, not format; giving the
format to one arm only would measure "knows the file layout", not authoring quality.

## Fairness rules

1. **Identical inputs.** Same `prompt.md` text, same clip bytes (record sha256), same contract,
   same model and model settings, same starting working copy (minus the skill for `without`).
2. **Identical budgets.** Each case's `budget` (wall time, tool calls, tokens) applies to both
   arms. A run that exceeds a budget is stopped; whatever is on disk at that moment is graded.
3. **Identical outcome graders.** Every grader with `arm: both` is run by the evaluator (not the
   author) on both arms' output with the same toolkit version and the same gates. Gates are those
   committed in the toolkit at eval time; never tuned per arm or per run.
4. **Process indicators are not scores.** `type: process` graders (skill fired, toolkit commands
   run, toolkit check clean) carry `arm: with-only`. They are recorded for the `with` arm and
   **excluded from the comparison**: they cannot pass without the skill and would inflate the gap.
5. **Held-out cases.** Cases here are never used as authoring examples, never placed in
   `examples/`, and never shown to authors before the run. Clips are supplied only at run time.
6. **No generator exposure.** If a case's clip is synthetic, its generator script, parameters
   and provenance notes stay with the evaluator. The author gets only the encoded clip (a
   video-only author). Case files must not reference `tests/fixtures/synthetic` or any generator; the
   check script enforces this.
7. **Grader-held probes.** Temporal grading needs colour-keyed tracks (CONTRACTS §3). The
   evaluator declares them from the reference clip before any run and keeps them out of the
   author's view. For grading, the evaluator copies each arm's scene package to a scratch dir and
   replaces `scene.json` `reference.clip` and `tracks` with the case's held values. Author-declared
   tracks are kept as an `info` note only. Both arms are thus measured with the same probes.

## Outcome mapping (four separate outcomes, never blended)

Run from the repository root; `<pkg>` is the graded copy of the arm's scene package.

| Outcome | Grader type | Command | Pass |
|---|---|---|---|
| Structural validity | harness | `node skills/video-to-css/scripts/v2css.mjs audit <pkg>` | exit 0; no `fail` check |
| Appearance | harness | `node skills/video-to-css/scripts/v2css.mjs compare <pkg>` | every `appearance.*` check with a gate passes |
| Temporal fidelity | harness | same `compare` report | every gated `temporal.*` check passes for every held track |
| Editability | harness | `node skills/video-to-css/scripts/v2css.mjs variants <pkg>` | exit 0; declared controls render visibly distinct variants; multi-instance host renders |

Plus one **visual review** (`type: review`, `arm: both`) per case using
[`graders/visual-review.md`](graders/visual-review.md): a human or a separate reviewer agent
watches the review page / contact sheets blind to arm labels and writes **at most three
findings**. The near-miss case uses [`graders/scope-honesty.md`](graders/scope-honesty.md) instead
of the fidelity graders as its primary outcome.

If an arm produces no scene package, every harness grader for that arm is `fail (no output)`,
not `UNRUN` (exception: the near-miss `structural-if-produced` grader records `n/a` when declining
was the honest outcome). If the evaluator could not run a grader (tool missing, clip missing), it is `UNRUN`.

## Cases

| Case | Kind | Clip to supply | Exercises |
|---|---|---|---|
| `stagger-loader` | positive | 3 s loop, 480×270, synthetic or external | per-element delays, easing, loop seam |
| `parallax-card-occlusion` | positive | 4 s loop, 640×360, external preferred | layered depth rates, occlusion, visibility |
| `flip-card-backface` | positive | 3 s one-shot + hold, 640×360, synthetic or external | 3D perspective, backface hiding, pivots |
| `nearmiss-hair-fluid` | near-miss | 3–5 s, ≥640×360, external footage | declining / flagging scope honestly |

Each case folder has `case.json` (machine-readable: reference requirement, budget, graders) and
`prompt.md` (the exact text both arms receive; `{{CLIP}}` is replaced by the clip path).

## Procedure

1. Supply each clip; record path, sha256, source (synthetic|external) and licence in a private
   evaluator log. Declare the held tracks. Do not edit `prompt.md` after the first run.
2. Run N ≥ 3 sessions per arm per case, in fresh working copies, alternating arm order.
3. Run every `arm: both` grader on every output; record process indicators for `with` runs.
4. Run the visual review blind (arm labels hidden, order randomised).

## Reporting

- One table per case, arms side by side, one row per grader, cells `k/N pass` (and the median
  of the gated value where useful). Process indicators go in a separate table marked
  `with-only — not compared`.
- **No single blended score**, no cross-case average, no "fidelity %". Structural, appearance,
  temporal and editability stay separate columns.
- Report budget use (wall time, tool calls, tokens) per arm.
- Unrun cases and graders are listed as `UNRUN` with the reason. Never fill them with estimates.
- Quote the reviewer's findings verbatim (≤ 3 per run) and link the evidence paths
  (`artifacts/<id>/compare/…`, review page).
- State limits: small N, four cases, one browser engine unless more were run, the clip set.

Example skeleton (values illustrative of format only, not results):

```
case: stagger-loader            with (N=3)   without (N=3)
structural   audit              UNRUN        UNRUN
appearance   compare            UNRUN        UNRUN
temporal     compare            UNRUN        UNRUN
editability  variants           UNRUN        UNRUN
review       visual-review      UNRUN        UNRUN
process (with-only, not compared): skill-fired UNRUN, ran-toolkit UNRUN
```

## Validate (free)

```bash
node evals/check-evals.mjs
```

Checks every `case.json` for required fields, that review rubrics exist, that `process` graders
are `with-only`, that positives carry all four outcomes plus review, and that no case file
references the synthetic fixtures or a generator. Exit 1 on any error.

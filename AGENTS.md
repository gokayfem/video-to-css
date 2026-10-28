# AGENTS.md

Guidance for coding agents (Claude Code, Codex, Cursor, Copilot, Gemini) working on this repository. To use the
skill rather than develop it, see the README.

## Layout

```text
skills/video-to-css/          the skill (this is what gets installed)
  SKILL.md                    entry point: workflow, hard rules, reference routing
  references/                 measuring, CSS primitives, scene contract, review, harness
  templates/                  scene package template
  scripts/v2css.mjs           CLI: init | inspect | extract | capture | sbs | compare | negatives | audit | variants | perf | review | check
  scripts/lib/                video decode (PTS, rotation, pixel aspect), browser seek/capture, metrics, gates, audit, controls
examples/wind-farm/           worked reconstruction: build/parts/*.mjs -> scene/ (generated; edit parts, then npm run build:wind)
prompts/                      reference-to-css, part contract, visual review, delivery
tests/                        node:test suites; tests/scenes/ are harness calibration scenes on synthetic clips
tests/fixtures/               synthetic clip generator + clips, seek and bad-scene fixtures
evals/                        with/without-skill authoring protocol (not run)
docs/                         contracts, architecture, scope, evidence (measured numbers)
gallery/                      README images (generated from real runs)
```

## Commands

```bash
npm run setup          # npm ci + Playwright Chromium and WebKit; ffmpeg/ffprobe must be on PATH
npm test               # seek correctness, determinism, VFR/rotation/pixel-aspect intake, audit, negative controls, embedding
npm run build:wind     # regenerate examples/wind-farm/scene from its parts
npm run check:wind     # needs the clip at fixtures/external/wind-farm/loop_720p.mp4
```

## Rules

- Scenes under `scene/` are strict HTML/CSS: no img/video/canvas/svg/script/iframe, no `url()`, namespaced
  `.v2c-<id>` selectors, keyframes and custom properties, a reduced-motion pose. `v2css audit` enforces this.
- Gates in `scripts/lib/compare.mjs` are never relaxed to make a case pass. A new check is added only after a
  specific observed failure, and the change is logged in `docs/EVIDENCE.md`.
- Every number in a `params.json` is labelled measured / estimated / chosen / fitted.
- Never call a self-made clip an independent benchmark. Report appearance, timing, structure and editability
  separately; never a single "% similarity".
- Reference clips and their frames never go inside an exported `scene/`.

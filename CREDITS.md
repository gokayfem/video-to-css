# Credits

All code in this repository is original. Ideas were taken from the projects and documents below; no code was
copied.

## Sibling projects (MIT)

| repository | ideas used |
|---|---|
| [gokayfem/shader-skills](https://github.com/gokayfem/shader-skills) | narrow skill frontmatter routing to references; the reference-prompt steps; frozen and shuffled negative controls; evals split into scored outputs and process indicators |
| [gokayfem/video-to-blender](https://github.com/gokayfem/video-to-blender) | parameter records `{value, unit, how, confidence}` with measured / estimated / chosen / fitted labels; controls proven by variants |
| [gokayfem/video-to-physics](https://github.com/gokayfem/video-to-physics) | source fingerprinting; acceptance gates declared before data and never relaxed; negative-control tables; the `{check, outcome, value, gate}` result shape |
| [gokayfem/gaussian-splat-to-blender-nodes](https://github.com/gokayfem/gaussian-splat-to-blender-nodes) | the part contract (shared inputs, owned files); short, bounded visual reviews |

## Other projects

- [ahnafnafee/tracing-video-to-animated-svg](https://github.com/ahnafnafee/tracing-video-to-animated-svg) (MIT):
  reference-vs-render sheets, reading blend and diff images, a rAF performance probe, namespacing. Its
  `!important` delay freeze was not adopted: it ignores authored delays, direction and fill.
- [animate-css/animate.css](https://github.com/animate-css/animate.css) (Hippocratic 2.1): nothing vendored;
  the reduced-motion idea was re-implemented independently.

## Writing

The approach follows the series on generativemedia.blog:
[We Are Frankensteining Video Models](https://www.generativemedia.blog/blog/we-are-frankensteining-video-models),
[Video 2 GLSL](https://www.generativemedia.blog/blog/video-2-glsl-turning-reference-videos-into-editable-worlds),
[Video 2 Blender Nodes](https://www.generativemedia.blog/blog/video-2-blender-nodes-turning-reference-videos-into-editable-node-systems),
[World to World Mapping](https://www.generativemedia.blog/blog/world-to-world-mapping-turning-gaussian-splats-into-editable-blender-scenes)
and [Video 2 Physics](https://www.generativemedia.blog/blog/video-2-physics-turning-ai-videos-into-verified-simulations).

## Browser references

- MDN: [Using CSS animations](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Animations/Using),
  [`transform-style`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/transform-style),
  [`Animation.currentTime`](https://developer.mozilla.org/en-US/docs/Web/API/Animation/currentTime).
- Playwright: [Clock](https://playwright.dev/docs/clock). The JavaScript clock does not drive CSS animations, so the
  harness seeks with the Web Animations API instead.

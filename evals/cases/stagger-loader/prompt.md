# Rebuild this loader animation in HTML/CSS

Reference clip: `{{CLIP}}` (about 3 s, 480x270, loops).

It is a small loading indicator: a row of dots that bounce in a staggered wave. Rebuild it as an
editable CSS component that matches the clip's motion, delays, easing and loop as closely as you can.
Use the namespace id `loader`.

Deliver a scene package in `out/<id>/` exactly as specified in the attached `docs/CONTRACTS.md` (strict HTML/CSS profile: `scene/index.html`, `scene/scene.css`, `scene.json`, `params.json`, `REFERENCE.md`). Set `scene.json` `reference.clip` to the clip path above. Expose at least two meaningful runtime controls as CSS custom properties, each with a default, a range and a non-default `variant`.

Rules: no JavaScript, images, SVG, canvas or video in the scene; the clip must not be embedded or loaded by the scene. Preserve the observed timing (no retiming). Label every number in `params.json` as measured, estimated, chosen or fitted. In `REFERENCE.md`, list what you measured, the representation choices and the known limitations.

Stop when you are satisfied or when the budget runs out; finish with a short message stating what matches the reference and what does not.

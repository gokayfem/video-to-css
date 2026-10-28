# Rebuild this layered card animation in HTML/CSS

Reference clip: `{{CLIP}}` (about 4 s, 640x360, loops).

It shows a card whose layers drift at different speeds, giving a parallax depth effect; some
layers pass behind others. Rebuild it as an editable CSS component that matches the layer
motion, stacking and loop as closely as you can. Use the namespace id `parallax`.

Deliver a scene package in `out/<id>/` exactly as specified in the attached `docs/CONTRACTS.md` (strict HTML/CSS profile: `scene/index.html`, `scene/scene.css`, `scene.json`, `params.json`, `REFERENCE.md`). Set `scene.json` `reference.clip` to the clip path above. Expose at least two meaningful runtime controls as CSS custom properties, each with a default, a range and a non-default `variant`.

Rules: no JavaScript, images, SVG, canvas or video in the scene; the clip must not be embedded or loaded by the scene. Preserve the observed timing (no retiming). Label every number in `params.json` as measured, estimated, chosen or fitted. In `REFERENCE.md`, list what you measured, the representation choices and the known limitations.

Stop when you are satisfied or when the budget runs out; finish with a short message stating what matches the reference and what does not.

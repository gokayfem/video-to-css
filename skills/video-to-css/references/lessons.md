# Lessons from long reconstructions

Hard-won rules from multi-part, multi-builder reconstructions (a painted landscape loop and an animated
portrait with a head turn, wind and a smile). They apply to any clip. Each lists the failure, how it
shows, and the fix.

## CSS traps

- **`filter` runs before `clip-path`.** A blur on a clipped element never softens the clip edge, which
  keeps a hard vector cut. Put the clip on the child and the blur on a wrapper.
- **A default rule can silently override every specific one.** A part-wide default such as
  `.root i { filter: blur(.6px) }` outranks `.root .x { filter: blur(4px) }` when it has higher
  specificity, so every per-element blur collapses to the default. Write defaults with `:where(...)`
  (zero specificity) so element rules win.
- **Anti-aliased edges take the colour underneath them.** A dark base colour under a light plate shows
  as a 1 px dark outline. Keep base colours close to the edge colour, or inset the core shape.
- **Feathering a shape edge only makes a softer cutout.** If the surface inside a contour is one flat
  value, blurring its boundary still reads as a pasted mask. Roundness comes from interior form: light
  that rolls off across the last 15–30 px inside the contour, varying in strength from side to side.
  It does not come from edge blur, and not from a uniform dark border (that reads as painted-on contour).
- **A form shadow centred inside the contour makes a ridge.** The pixels outside it stay lit, then dip,
  which reads as a drawn line. Centre rim shadows on the contour so they are darkest at the edge and
  fade inward. Then check with `profile` that there is no dip.
- **Separate turning from occlusion.** The shadow of a surface turning away from the light belongs on
  the shadow side and follows the form. Contact or cast shadow (under a chin, under an overhang) goes
  below the form, painted under it, so it cannot wrap over the lit front.
- **Translucent layers need a deliberate paint order.** A sheer veil over hair hides the hair it should
  only tint; hair that hangs in front of a veil must paint above it. Decide the order from the source
  per region (crown vs hanging locks) rather than one order for the whole layer.

## Integration

- **Overlap generously.** Two shapes meeting exactly at a shared edge leave anti-aliased or keyframe
  gaps where the background shows through as a slit or seam. Extend one under the other by ≥ 20 px.
- **Diagnose before you shade.** A dark slit at a join is usually geometry (a gap showing a dark layer
  behind it), not a shadow. Run `attribute` (hide one layer at a time) and render with flat diagnostic
  colours before you add or remove any shading. A shadow added to hide a gap becomes a band later.
- **Measured edges can collapse.** A per-row edge scan of the reference stops early at an eye, a veil or
  a flying strand, giving zero-width rows. A clip built from it shatters into blocks with sky between
  them. Enforce a minimum width, replace outlier rows with the mean of their neighbours, resample
  densely (5–8 px), smooth across rows, and clamp so the inner edge never crosses the outer one.
- **One writer per file; shared measurements in a shared rig.** When several builders work in
  parallel, give each part its own file. Put the motion model and measured landmarks in a
  read-only module that all parts import, so features cannot drift apart. Layer-order and
  cross-part seams belong to the lead.
- **A part that is mid-edit must not break everyone's build.** The build script should skip a part
  that throws, and say so loudly.
- **Freeze before judging.** Every review sheet should come from a frozen revision (`freeze`). Mixed
  live files make "before/after" meaningless. Frozen copies are immutable, hashed, and comparable with
  `triptych --prev`.

## Motion

- **An instant switch hidden between reference frames is not continuous motion.** Swapping one feature
  set for another between two 24 fps samples passes every per-frame check, but the browser plays at
  60/120 Hz. The pop is visible, and on sub-frame times it can flash translucent or leave holes. Carry
  the same elements through the change with geometry and occlusion (masks against a moving edge), and
  check with `frames --step 0.008333`.
- **Smooth is not the same as matched.** A reveal can be perfectly gradual and still be late, too fast,
  or the wrong shape: a straight strip where the source shows a curved mass. Drive the reveal from the
  reference's measured per-frame extent and outline, then confirm with `jumps` (no flagged steps) and a
  per-frame source | previous | current sheet.
- **Read a frame-step jump as a lead, not a verdict.** `jumps` flags frames whose step is far above
  both the scene's typical step and the reference's step there. Attribute the jump to a layer before
  fixing it. Layer attribution explains a jump; it does not make the composite motion acceptable.

## Measurement vs acceptance

- Numbers support, they do not decide. Cell colour error, transition widths, landmark agreement and
  jump scores can all improve while the image still reads wrong. A person compares the image against
  the source at matched times, at 100 % and enlarged, and watches synchronized playback.
- Depth or normal maps from monocular estimators (e.g. Marigold) can hint where anatomical planes lie in
  the reference. They are model outputs, not geometry, and they may read a stylised render as flat.
  Never steer by "make the render's normal variance match the reference": noise and artificial
  gradients can raise it while the image gets worse. No depth or normal raster ever goes into the scene.
- When the user says something looks wrong, that is the acceptance criterion. Find which property is
  responsible (contour, interior value structure, a seam, a temporal pop) and measure it, rather than
  arguing from a metric that already passes.
- Report what is unverified: which times, crops and motions were actually inspected, and whether
  real-time playback was reviewed.

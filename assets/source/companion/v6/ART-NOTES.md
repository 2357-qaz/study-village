# V6 — structural anatomy and cloth support

Base: final V5 runtime SHA-256 `c3fe27a0266b788550eb50e3c359a82627c1deedcdcf76f22abad7c8f8c8edfa`.

## Protected decisions
- Original silver hair, blue ribbons, bronze glasses, lavender cardigan, navy skirt, cream stockings and brown Mary Janes.
- V5 head/face/hair geometry and uniform 0.95 scaling unchanged; standing leg-above-ankle scale 1.10 and tea torso-height offset 0.0795 unchanged.
- Seated hip anchor/floor, +0.037 knee projection, leg width and shoe positions unchanged. No realistic face redesign, thinning, imported anatomy mesh or decorative strand/fold overlays.

## Actual structural changes
1. The formerly overlapping spherical sleeve caps are fused with the cardigan knit into a single remeshed surface for each pose. Underarm contours are locally tucked; broad inner-elbow compression replaces high-frequency circumferential ripples while the outside elbow stays stretched.
2. Sealed wrist discs are removed. A closed annular cuff has a real opening, inner wall and visible rim; the wrist now extends back into that opening rather than terminating exactly on a sealed cap.
3. The closed continuous hand skin is retained, but its palm has a richer cross-section, flatter dorsal surface, palmar thenar transition, staggered finger roots and smaller knuckle swelling. The thumb has a separate oblique axis and continuous web. Nail plates remain separate. The right/left reflection and inverse-transpose export normals are preserved.
4. Seated skirt cross-sections now follow the hip-to-knee-to-shin path rather than lying on a fixed diagonal plane. This supplies genuine rounded thigh/seat depth under the cloth. The underside flattens onto the chair cushion top (runtime Y=.42), then releases over the chair front. The upper cloth bridges the two supported knees with a shallow central sag. Below-knee front/back hem elevations retain the previous leg reveal.
5. Calf centerline shaping is restrained (3–4 mm) with no loss of width or length. Rear coat hem trim is moved onto the actual back contour rather than floating away from it.

## Runtime structure
13 existing rigid mesh parts and four authored poses remain the contract; this is not a new full-body skinning rig. Fused cloth is decimated for runtime instead of shipping the million-triangle voxel intermediate. Its smooth custom corner normals are interpolated from the same pre-decimation surface; temporary dense reference meshes are removed. Sub-millimeter collapsed two-face islands are deleted as topology, not hidden by invented fallback normals. Exact counts are in `output/companion-stylized.json`. Hardware FPS is not inferred from triangle count.

## References and reuse policy
Observed the actual stylized hand/body/foot meshes from Blender's Human Base Meshes bundle and MPFB reference images. No downloaded source mesh, rig or script is incorporated in this artifact.
- Blender demo page: https://www.blender.org/download/demo-files/ (Human Base Meshes v1.4.1; CC0 bundle/asset metadata; legacy embedded Rain license text ambiguity means observation only).
- MPFB base: https://github.com/makehumancommunity/mpfb2/blob/master/src/mpfb/data/3dobjs/base.obj (CC0 header; observation only).
- Rain v3: https://studio.blender.org/characters/rain/v3/ (CC BY 4.0, observation only).
- Blender Studio outfit workflow: https://studio.blender.org/training/stylized-character-workflow/timelapse-sculpting-snows-outfit/ (conceptual study of supported cloth, not copied geometry).

## Validation
`src/validate_structure.py` records manifold hand/cuff geometry and protected proportion metadata. Application QA independently checks exact V5 head/face/hair position-normal-material sets, mirror normals, all eight absolute thumb-side checks, four poses and same-camera front/side closeups. See the integration QA reports for final runtime results; Blender studio previews do not substitute for application contact tests.

## Contact and final build corrections
The inherited look-pose right palm crossed the lap; only that pose’s right wrist Y changes from .10 to .145. Other arm poses remain unchanged. Integration QA adjusts the look book anchor independently to avoid turning the inherited skirt overlap into a book overlap. Final runtime BIN SHA-256: `d651b28b10b68696143e02d5db541e5ce006c523e64b07754fe1231726ade727`. It comes from a fresh complete script build, **not** a re-export of a presentation scene with hidden pose objects. The independent integration suite passes 49/49 checks including exact V5 face/hair/palette protection.

## Known fidelity boundary
The runtime cardigan is still a simplified low-poly surface. Dense-reference custom normals improve continuity but some broad planar shading remains at close range; this is not full high-resolution sculpt fidelity. No supersampling or material changes are used to conceal it. The approved iteration prioritizes anatomical shoulder/cuff/hand connections and real seated thigh support while preserving the earlier likeness.

Final evaluated chair-contact measurement (modifiers enabled): central cloth underside minimum 0.40087 against cushion top 0.42, approximately 1.9 cm cushion penetration/compression. This is not a zero-penetration contact solve. Earlier hidden-viewport coarse-mesh estimates were superseded; authoritative values are in structure-validation.json.

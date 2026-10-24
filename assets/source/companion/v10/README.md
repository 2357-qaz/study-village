# Companion V10 — curved rear hair, restrained chin revision

V9's additive ear-side strips are removed. No replacement side-hair objects are added. The original V8 rear long-hair surface is deformed around the ear-back/neck: outer rows wrap forward and inward then settle toward the shoulder, while the main front locks stay unchanged. At tea-pose shoulder height, the same rear surface retreats locally to clear the unchanged raised sleeve seam. Vertex/triangle counts return to V8 levels.

The two face base meshes use a chin width between V8 and V9 and at most 8 mm lower-face extension (V9 was 4.5 mm); eyes, nose, mouth and all other body/clothing objects remain unchanged. This is not whole-head scaling.

Preserved baseline comparison is against V8, excluding only the face base and existing rear-hair meshes; the validator also asserts no additive ear-hair objects exist. V8 and V9 remain separate and unchanged.

## Rebuild / inspect
Blender 4.3.2:
```
STUDY_HAND_QA_ONLY=1 STUDY_SKIP_HAND_RENDERS=1 blender -b --python-exit-code 1 --python src/build_companion.py
blender -b --python src/render_read_closeup.py
blender -b --python src/render_poses.py
```
The included V7 protected-base cache supplies the unchanged body used by V8/V9/V10. The optional preservation comparison also requires the sibling V8 source. Runtime BIN/JSON contains the four existing rigid action poses.

Lightweight runnable ZIP includes V10 and the original shipped default. `npm start`, then `?companion=v10&hour=16`. Historical opt-in assets are retained in the full workspace/earlier packages, not duplicated in this ZIP. Automated regression tests are run in the full workspace with all historical fixtures.

All previews are actual Blender model renders, not image-generation mockups or actual timer UI screenshots. WebGL remains disabled in the available browser; browser 3D visual validation and exhaustive collision testing are not claimed. The standing Blender/GLB display retains the V8 presentation-only hair root accommodation; reading/tea use their real action geometry without that adjustment. This source is preserved on the independent V10 preview branch; merging and deployment are separate actions.

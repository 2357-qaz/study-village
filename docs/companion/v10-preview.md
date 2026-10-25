# V10 companion model preview

This branch adds a new model as an opt-in preview. The existing default model and unrelated application UI remain unchanged.

Run `npm start`, open `http://localhost:4173/?companion=v10&hour=16`, and select the focus tab. Start a one-minute study timer to inspect its ordinary reading-to-tea transition. Omit `companion` to compare against the original shipped model. V6–V9 assets are not included or exposed as query options on this branch.

The new model preserves the existing fixed room camera and rigid-part pose contract. Its manifest supplies authored head details, standing torso offset, sRGB vertex paint and `teaPropStyle: camera-v7`. The loader uses these details once, avoiding doubled accessories or proportions. The teapot is aligned to the authored hands; its nozzle points downward toward an open-rimmed cup on the existing table. The tea stream is an authored still detail, not a fluid simulation. The look pose's raised book anchor remains a candidate needing visual contact inspection.

## Validation

Node tests validate both shipped and V10 buffer decoding, finite attributes, indices, all four authored poses, fallback procedural poses, color conversion and tea placement. These checks do not substitute for full collision or visual-quality inspection. Prepared Playwright tests cover the real timer flow, but were not run in the current environment.

Historical local validation was Blender-only; subsequent CI #38 produced actual web reading/tea screenshots. See [the loading audit](v10-loading-audit.md) for evidence scope and the four-pose CI capture added by this branch. The following describes the earlier local environment: The supported cloud browser can load the app, but WebGL is disabled. Launching an independent Chromium was also blocked by socket permissions. No screenshot or visual acceptance of the actual rendered 3D timer is claimed.

Publication on an independent branch does not change the live site or merge into main. The dedicated preview branch is included in the test workflow's push allowlist. Remote CI results must be checked for the exact published commit; local checks alone do not establish a remote CI pass.

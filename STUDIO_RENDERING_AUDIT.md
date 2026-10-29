# Studio Rendering Audit — Ground & Contact Shadow

Scope: rendering foundation only (WebGi 0.4.6 ground/shadow). No UI redesign.

## 1. Active pipeline (evidence: `rendering/src/studio/ViewerHost.ts` init, `node_modules/webgi/dist/examples/runtime/bundle.m.js`)

- Ground = `ContactShadowGroundPlugin` (class `oT extends q_`, `q_` = `GroundPlugin`). Registered once in `ViewerHost.init`.
- Contact shadow mechanism = plugin's own depth pass: ortho `shadowCamera` placed at ground mesh world position, rotated `+PI/2` X, renders the model's depth into a fixed **512px** target, blurs it (`blurAmount/256` UV), and feeds it as the **`alphaMap`** of a transparent plane.
- Shadow colour = plugin material tint `0x111111` (set in `_refreshMaterial`). Alpha = depth map. `opacity` = intensity.
- No separate post-process shadow pass, no `ShadowMapBaker`, no CSS shadow. `RandomizedDirectionalLightPlugin` and `SSAOPlugin` are unrelated to the ground.
- Plugin transform rules (`q_._refreshTransform`):
  - `autoAdjustTransform=true` → plugin repositions plane to scene bounds centre.
  - `autoAdjustTransform=false` → position untouched (app owns it).
  - Always sets `scale.setScalar(size)`, rotation `-PI/2` X, and `scale.y = -size` (negative Y scale is WebGi's own convention, not a bug).
  - Shadow camera position/rotation derived from mesh world position in the same routine.

## 2. Root causes (confirmed by code reading against WebGi source)

| # | Symptom | Root cause | Evidence |
|---|---|---|---|
| RC1 | Shadow weak / invisible | `StudioSettings.configureGroundAppearance` did `matObj.color.copy(backgroundColor)`. This overwrote the `0x111111` shadow tint with the backdrop colour (white). White alpha-blended over white = no visible shadow. | `StudioSettings.ts` (old L143–151); `oT._refreshMaterial` sets `color.set(1118481)` |
| RC2 | Shadow a detached blob / soft smear | Shadow frustum set far too large. `shadowScale` clamp `[1.5, 4.5]` plus `setShadowQuality` (2.0/3.5/4.5) gives half-frustum ≈ 13–30 units. 512px map over ~26–60 units puts the ring in ~40–100px and blurs it. | `DynamicCadLoader.alignGround` old `Math.min(4.5,...)`; `StudioSettings.setShadowQuality` |
| RC3 | Shadow fights its own config | `shadowScale` was written by three places (loader, quality setter, `applyCurrentConfig`) with conflicting values. Last writer wins (quality → 3.5). | grep `shadowScale` |
| RC4 | Shadow not tied to ring XZ | Plane/shadow camera placed at `(0, groundY, 0)` regardless of ring XZ centre. Off-centre models get shadow offset. | old `alignGround` |
| RC5 | Ground transform applied twice | `DynamicCadLoader.loadModel` step 7 and `ViewerHost.loadModel` both called `alignGround()`. Both also set rotation/scale and re-set them after `refreshOptions`. | `ViewerHost.ts` old L229; loader L212 |
| RC6 | Ground reappears after toggle | `alignGround` forced `ground.visible = true` and `groundMesh.visible = true` on every model load, overriding the user's "Ground visible" toggle. | old `alignGround` |
| RC7 | Dead / invented settings | `ground.shadowBaker` does not exist on `ContactShadowGroundPlugin` (`tuneShadowBaker` returned early; `groundMapMode`, `alphaVignette`, `bakedShadows` are not WebGi properties). Dead code, misleading. | bundle has no `shadowBaker` on oT/q_ |
| RC8 | Shadow quality setting meaningless | WebGi 0.4.6 exposes no depth-map resolution lever on this plugin. Quality only wrote `shadowScale/shadowHeight`, which RC2/RC3 already corrupted. | bundle `oT` ctor/fields |
| RC9 | Floor/background seam (partly) | Shadow tint colour (RC1) meant the plane was not a shadow-only overlay. Once tint restored, plane is transparent outside shadow (alpha map 0), so no plane edge. | `oT._refreshMaterial`; alpha = depth map |

Not confirmed (left as-is): `contactShadows` is a UI flag with no read site in this WebGi build; `shadowOpacity` via `material.opacity` is the effective visibility lever and is kept.

## 3. Changes

- `rendering/src/studio/groundMath.ts` (new): pure policy. `GROUND_SIZE=120`, `isHelperMesh`, `groundShadowScale(size, r)` → half-frustum = `2.5r`, `groundShadowHeight(r)`.
- `rendering/src/cad/DynamicCadLoader.ts` `alignGround()`: sole writer of ground transform + shadow frustum. Excludes helpers via `isHelperMesh`. Sets plane XZ to bounds centre, Y to `box.min.y`. Calls `refreshOptions()` once. Removed manual rotation/scale/shadowCamera writes and dead `shadowBaker` block. No longer touches `ground.visible`.
- `rendering/src/studio/ViewerHost.ts` `loadModel`: removed duplicate `alignGround()`.
- `rendering/src/ui/StudioSettings.ts`:
  - `configureGroundAppearance()` no arg. Sets `autoAdjustTransform=false`. Does **not** touch `material.color`. Sets roughness/metalness/opacity/userData, visibility, blur.
  - Removed `tuneShadowBaker`, `bakedShadows`, mesh transform re-application, `shadowBaker` branches.
  - `setShadowQuality` now stores the value only (see limitation L2).
- `rendering/tests/frontend.test.js`: Test 19 quality-scale mirror removed. Tests 20–22 added:
  - 20: shadow frustum fits ring radius; height range.
  - 21: helper/ground exclusion policy.
  - 22: single ground-transform writer (`alignGround` call count, no colour overwrite, no plane re-transform).
  - Real `groundMath.ts` loaded via `typescript.transpileModule` (TS 4.4.4 devDep).

Settings persistence (`mahesh3d_studio_config` localStorage) unchanged. Model switch path: `DynamicCadLoader.loadModel` → `alignGround` → `ViewerHost` → `configureGroundAppearance`. Shadow intensity/softness/visibility are re-applied there.

## 4. Verification run

| Command | Result |
|---|---|
| `cd rendering && npm test` | PASS, 22/22 |
| `cd rendering && npx tsc --noEmit -p .` | No errors under `src/` or `tests/`. Pre-existing `node_modules/@types/node` parse errors (TS 4.4.4 vs newer types) are unrelated and not from this change. |
| `cd rendering && npx vite build` | PASS, built in 871ms (rolldown eval warning from WebGi bundle, pre-existing) |

## 5. NOT verified (honest)

- **Browser / GPU rendering: not run.** No screenshot taken, no comparison to the iJewel3D reference, no contact-shadow visual confirmed. Acceptance criteria 1–5 are **unverified visually**. The fixes are derived from WebGi source reading.
- **Browser console errors/warnings: not inspected.**
- **Built-in GLB and converted CAD model switch: not exercised in a browser.**
- **Backend tests and Docker health checks: not run** (no backend/server files changed).

## 6. Remaining limitations

- L1: Shadow resolution fixed at 512px by WebGi. Frustum fit (RC2) is the only lever; very large custom models get proportionally coarser shadow.
- L2: `shadowQuality` UI control has no WebGi lever. Stored only. Remove the control or wire it when WebGi exposes one.
- L3: `contactShadows` flag has no read site in WebGi 0.4.6 build; kept for UI parity.
- L4: `setShadowSoftness` maps to `blurAmount` (texel blur on 1024 target). Visual softness range not tuned against reference.
- L5: Floor colour is now WebGi's dark tint + alpha. Background is the viewer background (`applyBackgroundColor`). Any background-tint mismatch would come from backdrop, not floor.
- L6: Old PROBLEM.md (untracked) predates this fix and describes RC5/RC1 partially; not updated.

## 7. Commands used

```
cd D:\3D-app\rendering
npm test
npx tsc --noEmit -p .
npx vite build
```

Screenshots: none captured. Location: n/a.

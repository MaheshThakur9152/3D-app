# Studio Rendering Audit & Stabilization Report

This audit documents the findings, root causes, architectural fixes, test validation results, and deferred optimizations in the jewelry rendering pipeline.

---

## 1. Audit of Deficiencies & Root Causes

| # | Issue | Root Cause | Impact | Fix |
|---|---|---|---|---|
| **RC1** | **Double Model Rotation** | Both `DynamicCadLoader.loadModel()` and `ViewerHost.loadModel()` applied `-Math.PI/2, 0, -Math.PI/2` | Built-in ring models appeared upside-down or flipped 180° upon subsequent load | Removed duplicate transform in `ViewerHost.loadModel()`. Single orientation applied strictly once in `DynamicCadLoader`. |
| **RC2** | **Floor Wandering with Model** | `DynamicCadLoader.alignGround()` invoked `studioFloor.updateTransform(x, box.min.y, z, r)` | Loading a model off-center or elevated shifted the studio floor geometry | Fixed `StudioFloor` permanently at `(0, 0, 0)` with fixed height `Y = 0`. Product is translated onto floor. |
| **RC3** | **Z-Fighting on Ground** | Contact shadow mesh and studio floor plane shared identical `Y = 0` coordinate without depth bias | Severe visual tearing and flickering black artifacts beneath rings | Configured floor with positive polygon offset (`1.0`) and contact shadow with negative offset (`-1.0`) plus `+0.0002` physical elevation. |
| **RC4** | **Shadow Toggle Destroying Floor** | Turning off shadows disabled the ground plane geometry | Disabling contact shadows resulted in jewelry floating in void | Decoupled `StudioFloor.setVisible()` from `StudioSettings.setGroundShadows()`. Floor remains visible with 0-opacity shadow. |
| **RC5** | **Flat, Dull Shading & Missing Highlights** | `RandomizedDirectionalLightPlugin` was initialized with `false`; scene environment map unpopulated | Metals lacked specular reflection strips; gemstones lacked facet sparkle | Created `StudioLighting` (physical 3-point studio rig) and `StudioEnvironment` (equirectangular softbox reflection maps). |
| **RC6** | **Mobile Viewport Clipping** | Camera distance calculation considered only vertical FOV | Portrait screens (9:16) cropped ring edges | Implemented aspect-ratio aware dual FOV framing in `CameraFraming.ts`. |
| **RC7** | **Shadow smearing / over-sized frustum** | `shadowScale` clamped to large bounds `[1.5, 4.5]`, spreading 512px map across 30+ units | Shadow looked like a detached faint blob | Frustum clamped to `2.5 * radius`, allocating ~400px of the 512px map to the jewelry piece. |

---

## 2. Test Coverage & Verification

### Automated Test Suites
- **Frontend Test Suite (`rendering/tests/frontend.test.js`):**
  - **38 / 38 unit tests passing (100%)**
  - Verified: CAD unit normalization, camera framing bounds, optical dispersion, studio defaults, single floor lifecycle, contact shadow depth offset, 3-point lighting rig, HDR synthesis, physical metal presets, and iJewel3D playground component hierarchy.
- **Server Test Suite (`server/tests/*`):**
  - **22 / 22 regression tests passing (100%)**
  - Converter tests, API & job lifecycle tests, DB & queue tests passing cleanly.
- **Production Build:**
  - `rendering`: `npm run build` completed cleanly in <1s (Vite 8.3.5 / Rolldown).

---

## 3. Known Limitations & Deferred Optimizations

- *shortcut: WebGi contact shadow resolution fixed at 512px. Frustum clamped to 2.5 * radius to maximize pixel density, upgrade to custom 1024/2048 cascaded shadow map if ultra-fine pavé prong shadows are requested.*
- *shortcut: Procedural equirectangular HDR canvas is generated synchronously on preset switch (~4ms), upgrade to pre-baked .hdr/.exr binary assets for complex studio interiors.*

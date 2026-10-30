# Studio World Architecture & Scene Lifecycle

This document defines the 3D studio world architecture, coordinate frame conventions, scene object ownership, ground floor lifecycle, and shadow subsystem for the iJewel3D-inspired jewelry playground.

---

## 1. Single Engine Constraint & Scene Object Ownership

The rendering pipeline strictly adheres to the **single WebGi viewer instance** contract:

```
ViewerApp (WebGi 0.4.6)
 ├── RootScene
 │    ├── modelRoot (THREE.Group)
 │    │    ├── Studio_Floor_Mesh (StudioFloor, non-product helper, fixed at origin)
 │    │    └── [Active Jewelry Object3D Root] (Normalized, centered, grounded at Y = 0)
 │    ├── Light Hierarchy (StudioLighting)
 │    │    ├── KeyLight (DirectionalLight2 at [3.5, 5.0, 4.0], intensity 1.8)
 │    │    ├── FillLight (DirectionalLight2 at [-3.5, 3.0, -2.0], intensity 0.9)
 │    │    ├── RimLight (DirectionalLight2 at [0.0, 6.0, -3.0], intensity 1.4)
 │    │    └── AmbientLight (AmbientLight2, intensity 0.35)
 │    └── ContactShadowGroundPlugin
 │         └── Shadow Receiver Plane (Elevated at Y = +0.0002, negative depth offset)
 └── PMREM Environment (StudioEnvironment)
      ├── Equirectangular Studio Radiance Map (softbox array)
      └── Independent Viewport Background Color
```

- **Single Engine:** No second WebGL renderer or second canvas is created. All operations take place in `ViewerHost` and `ViewerApp`.
- **Ownership:** `StudioWorld` orchestrates the persistent studio environment (`StudioFloor`, `StudioLighting`, `StudioEnvironment`), decoupled from dynamic CAD/GLB asset loading.

---

## 2. Coordinate Conventions & Orientation Pipeline

Rhino CAD `.3dm` models natively export with Z-up, while WebGi/Three.js operates in a Y-up right-handed coordinate system.

- **Single Orientation Conversion:**
  Built-in demo models require a 90° rotation about X and Z (`-Math.PI / 2, 0, -Math.PI / 2`).
  - This transformation is performed **strictly once** in `DynamicCadLoader.loadModel()`.
  - Duplicate transformation in `ViewerHost.loadModel()` has been eliminated to prevent invert/flip regressions.
- **Ground Alignment Contract:**
  1. Product bounds are computed excluding helper meshes (`isHelperMesh` filters out `Studio_Floor_Mesh` and `isStudioEnvironment`).
  2. Model is uniformly scaled to target radius (1.35 units, ~78% viewport coverage).
  3. Model horizontal center `(centerX, centerZ)` is translated to `(0, 0)`.
  4. Lowest vertex (`box.min.y`) is shifted so that bottom contact rests exactly at `Y = 0.0`.
  5. The model moves to the floor; the floor **never moves** to follow the model.

---

## 3. Floor Geometry & Contact Shadow Separation

To reproduce the crisp finite square platform of iJewel3D without z-fighting:

| Attribute | Studio Floor (`StudioFloor.ts`) | Contact Shadow Receiver (`ContactShadowGroundPlugin`) |
|---|---|---|
| **Mesh Name** | `Studio_Floor_Mesh` | WebGi plugin shadow plane |
| **Geometry** | `PlaneGeometry(6.0, 6.0)` | Dynamic frustum plane (`2.5 * radius`) |
| **Position** | Fixed at `(0.0, 0.0, 0.0)`, rotated `-Math.PI/2` on X | Dynamic `(centerX, Math.max(0, box.min.y) + 0.0002, centerZ)` |
| **Material** | Neutral matte PBR (`#f1f1ef`, roughness 0.88, metalness 0.0) | Transparent vignette alpha texture |
| **Depth Bias** | `polygonOffsetFactor = 1.0`, `polygonOffsetUnits = 1.0` (pushed back) | `polygonOffsetFactor = -1.0`, `polygonOffsetUnits = -1.0` (pulled forward) |
| **Picking** | Excluded (`userData.isStudioEnvironment = true`) | Excluded from raycasting |
| **Bounds** | Excluded from camera framing calculations | Excluded from camera framing calculations |
| **Visibility** | Controlled independently via `StudioFloor.setVisible()` | Controlled independently via `StudioSettings.setGroundShadows()` |

---

## 4. Lighting & Environment Reflection Architecture

Jewelry visualization demands distinct specular highlight shapes (softboxes) rather than flat ambient light:

1. **Studio Lighting Rig (`StudioLighting.ts`):**
   - **Key Light:** Simulates main overhead studio softbox, providing crisp facet illumination and directional definition.
   - **Fill Light:** Lowers contrast ratio in shadows to preserve facet clarity on underside prongs.
   - **Rim Light:** Accentuates edge silhouettes of metal bands against neutral backgrounds.
   - **Ambient Light:** Prevents completely black crevices in complex settings.
2. **HDR Equirectangular Pipeline (`StudioEnvironment.ts`):**
   - Synthesizes 1024x512 high-dynamic-range equirectangular maps featuring multiple studio softboxes and ambient gradients.
   - Dispatched to `viewer.scene.setEnvironment(texture)` to drive WebGi's internal PMREM filter.
   - Background color is controlled independently via `viewer.setBackground()`, ensuring floor visibility is preserved regardless of background luminance.

---

## 5. Camera Composition & Auto-Framing

- **Aspect Ratio Aware:** `computeCameraDistance` calculates both horizontal and vertical FOV angles, choosing the limiting angle to prevent jewelry clipping on mobile portrait viewports (9:16).
- **Target Coverage:** Clamped to 78% viewport coverage with target center slightly elevated (`targetY = -0.2`) for studio hero-shot composition.
- **Controls:** `CameraFraming.ts` animates smoothly via GSAP when switching views or models, respecting orbit limits `[1.5, 16.0]`.

# Technical Implementation Plan: iJewel-Style Model Import, Automatic Centering, Scaling, Studio Preview and Configuration

> **Target Platform:** 3D Ring Configurator (Three.js + WebGi v0.4.6, Vite, TypeScript, Express, Rhino3dm)  
> **Status:** APPROVED ARCHITECTURAL PLAN — READY FOR EXECUTION  
> **Target File:** `plan.md`  

---

## 1. Audit of Current Implementation & Root Cause Analysis

### 1.1 Forensic Codebase Audit Findings

A forensic audit of the existing CAD pipeline and viewer frontend identified several root causes for the uploaded-model framing, centering, and scaling issues:

| # | Investigated Vector | Current Code Location | Actual Behavior & Root Cause in Current Codebase |
|---|---------------------|-----------------------|---------------------------------------------------|
| **1** | **Source CAD Units** | `server/src/converter/rhinoCadConverter.js` (Lines 233-241) | Reads `doc.settings().modelUnitSystem`, but **never converts coordinates to millimeters**. If model is in meters (radius ~0.015) or inches (radius ~0.6), raw coordinates are extracted unscaled. |
| **2** | **Missing or Arbitrary Normalization Threshold** | `rhinoCadConverter.js` (L406) & `DynamicCadLoader.ts` (L56) | Both backend and frontend enforce arbitrary threshold `if (radius > 3.0)`. Models with radius $\le 3.0$ (e.g. meter-scale rings where radius = $0.015$, or inch-scale rings where radius = $0.6$) undergo **zero scaling or centering**, rendering as invisible microscopic specks. |
| **3** | **Duplicated / Scattered Normalization** | `rhinoCadConverter.js` (L409-425) vs `DynamicCadLoader.ts` (L58-62) | 3DM conversion bakes translation and scaling directly into vertex positions on the server, whereas GLB upload performs transformation on client `modelRoot.position` and `modelRoot.scale`. No unified normalization contract exists. |
| **4** | **Mutating Geometry vs Canonical Wrapper** | `DynamicCadLoader.ts` (L59-60) | Directly mutates `modelRoot.position` and `modelRoot.scale`. Any child node with local offset or parent transformation becomes misaligned with orbit controls and canvas raycasting. |
| **5** | **Bounding Box Pollution (Hidden / Construction Objects)** | `DynamicCadLoader.ts` (L53) & `ComponentDiscovery.ts` | Calls `new Box3().setFromObject(modelRoot)` unconditionally across all child nodes, including hidden meshes, construction curves, camera helpers, or distant registration points. The bounding box explodes, displacing the center point and shrinking the ring. |
| **6** | **Camera Target & Artificial Offset Hack** | `CameraFraming.ts` (L35-38) | Camera position contains hardcoded offsets: `targetX = -0.17 * scale`, `targetY = -0.25 * scale` designed solely for the initial stock ring asset. When applied to custom models, the camera looks off-center. |
| **7** | **Clamped Bounding Radius in Camera Framing** | `CameraFraming.ts` (L19) | Enforces `Math.max(0.8, Math.min(boundingRadius, 4.0))`. If a model has a real radius outside this clamp (e.g., $15.0\text{ mm}$ raw CAD or $0.02\text{ m}$), camera distance calculation is completely detached from geometry bounds. |
| **8** | **GLB Native Manifest Ignores Hierarchy Transforms** | `rhinoCadConverter.js` (`parseGlbManifest`, L63-73) | Evaluates primitive accessor `posAcc.min` / `posAcc.max` directly without accumulating node transform matrices (`translation`, `rotation`, `scale`, or `matrix`). Out-of-origin nodes calculate wrong bounds. |
| **9** | **Arbitrary Model Rotation Hack** | `rendering/src/index.ts` (L145-147, L387-391) | Hardcodes `ring.rotation.set(-Math.PI / 2, 0, -Math.PI / 2)` specifically for built-in model 1, but leaves custom CAD and model 2 unhandled, causing orientation inconsistency (Z-up vs Y-up). |
| **10** | **Viewport Aspect Ratio & UI Occlusion** | `CameraFraming.ts` & `index.ts` | Camera framing does not account for bottom dock UI overlay (`.ijewel-dock`, ~140px height) and top header (~60px). Does not recalculate on window/canvas resize. |
| **11** | **Orbit Controls Stale State** | `DynamicCadLoader.ts` & `index.ts` | Replaces model without resetting orbit controls target or spherical angles, leaving camera oriented towards old bounding centroid. |

---

## 2. iJewel-Style Upload Preparation Dialog Design

### 2.1 UI / UX Architecture

The upload workflow will present a two-stage modal:
1. **Source Selection & Options Review:** Designer drops file or selects from disk. Configurator displays standard and advanced preparation toggles before transmission.
2. **Real-time Pipeline Telemetry:** Progress bar (0–100%) with explicit step status ("Validating geometry", "Tessellating NURBS", "Computing facet normals", "Centering & scaling display wrapper").

```
+-------------------------------------------------------------------------+
|  Import 3D Model / Jewelry CAD                                      [X] |
+-------------------------------------------------------------------------+
|  [  Drag & drop .3dm or .glb here / Click to Browse (Max 100MB)      ]  |
|                                                                         |
|  Standard Settings:                                                     |
|  [x] Auto convert to GLB (enabled for .3dm; validates existing GLB)     |
|  [x] Auto centre model in studio viewport                               |
|  [x] Auto scale to canonical display size (preserves original dimensions)|
|  [x] Protect original upload (immutable master asset)                   |
|                                                                         |
|  [>] Advanced Settings (Click to expand)                                |
|      Source Units:      [ Auto-Detect (CAD) | mm | cm | m | in ]       |
|      Layer Filter:      [x] Visible objects only (skip construction)    |
|      Tessellation:      [ Production / Fine (0.01mm) | Standard ]       |
|      Normals Mode:      [ Diamond flat facets + Metal smooth normals ]  |
|      Compression:       [ Safe WebGi-compatible GLB optimization ]      |
|                                                                         |
|  [ Cancel ]                                          [ Prepare & Import ]|
+-------------------------------------------------------------------------+
```

### 2.2 Standard & Advanced Settings Contract

```typescript
export interface ImportSettings {
    // Standard settings
    autoConvertGlb: boolean;          // Default: true
    autoCentre: boolean;              // Default: true
    autoScale: boolean;               // Default: true
    protectOriginal: boolean;         // Default: true (server saves immutable original)
    
    // Advanced settings
    visibleOnly: boolean;             // Default: true (excludes hidden layers & objects)
    preserveTransforms: boolean;      // Default: true (accumulates world matrices)
    sourceUnit: 'auto' | 'mm' | 'cm' | 'm' | 'in'; // Default: 'auto'
    tessellationQuality: 'coarse' | 'standard' | 'fine'; // Default: 'fine'
    dracoCompression: boolean;        // Default: false (verified WebGi compatibility check)
    excludeConstruction: boolean;     // Default: true (filters layers matching 'defpoints', 'curves', etc.)
}
```

### 2.3 Settings Persistence
Import settings will be serialized to `localStorage.getItem('ijewel_import_settings')` on change and restored automatically on next upload.

---

## 3. Unified Model Preparation Pipeline

Both `.3dm` and `.glb` files will pass through a unified processing contract:

```
[ Uploaded File (.3dm / .glb) ] + [ ImportSettings ]
                 │
                 ▼
       1. Validation Stage (Magic bytes, file size, JSON structure)
                 │
                 ▼
       2. Inspection & Units Stage (Parse units, layer table, node graph)
                 │
                 ├────────────────────────────────────────┐
                 │                                        │
           [ Rhino .3dm ]                            [ Direct .glb ]
                 │                                        │
                 ▼                                        ▼
    3. NURBS & B-Rep Extraction             3. GLTF Scene Graph Traversal
    - MeshType.Render extraction            - Node hierarchy & transform eval
    - InstanceDefinition resolution         - Primitives accessor extraction
    - Filter hidden & construction layers   - Filter invisible & non-mesh nodes
                 │                                        │
                 └───────────────────┬────────────────────┘
                                     │
                                     ▼
       4. Component Semantic Discovery & Normal Processing
          - Flat facet normals for diamond candidates
          - Smooth averaged normals for metal shanks/prongs
                                     │
                                     ▼
       5. Product Bounding Volume & Canonical Normalization
          - Calculate bounding box from visible jewelry only
          - Retain original real-world dimensions in manifest metadata
          - Calculate canonical scale factor ($S = 1.35 / R_{\text{raw}}$)
          - Calculate centering offset ($\vec{C} = -\text{center}$)
                                     │
                                     ▼
       6. Output Asset Generation & Manifest Serialization
          - Server produces: `model.glb` + `manifest.json`
          - Server preserves: `original.<ext>` (immutable master)
                                     │
                                     ▼
       7. WebGi Dynamic Scene Ingestion
          - Instantiate render-only `StudioDisplayWrapper` (`Object3D`)
          - Apply $\vec{C}$ and $S$ to wrapper ONLY (model geometry intact)
          - MaterialRoleBinder binds DiamondPlugin & PBR metals
          - Frustum-aware auto-framing with UI viewport margins
```

### 3.1 Unit Conversion Coefficients to Millimeters
| Unit System | Multiplier to `mm` |
|-------------|-------------------|
| Millimeters (`mm`) | $1.0$ |
| Centimeters (`cm`) | $10.0$ |
| Meters (`m`) | $1000.0$ |
| Inches (`in`) | $25.4$ |

---

## 4. Automatic Centering, Scaling & Camera Auto-Framing

### 4.1 Non-Destructive Render-Only Normalization Wrapper

Rather than mutating vertices or moving `scene.modelRoot`, the loader will construct an isolated display wrapper:

```typescript
// Architectural Pattern: Canonical Studio Display Wrapper
const displayWrapper = new Object3D();
displayWrapper.name = "StudioDisplayWrapper";

// Compute bounding box strictly over visible jewelry components
const bounds = computeJewelryBounds(loadedRoot, manifest);

if (settings.autoScale) {
    const canonicalRadius = 1.35; // Standard WebGi studio scale
    const scaleFactor = canonicalRadius / Math.max(bounds.radius, 0.001);
    displayWrapper.scale.set(scaleFactor, scaleFactor, scaleFactor);
}

if (settings.autoCentre) {
    displayWrapper.position.set(
        -bounds.center.x * displayWrapper.scale.x,
        -bounds.center.y * displayWrapper.scale.y,
        -bounds.center.z * displayWrapper.scale.z
    );
}

displayWrapper.add(loadedRoot);
viewer.scene.addRoot(displayWrapper);
displayWrapper.updateMatrixWorld(true);
```

### 4.2 Filtering Outlier & Construction Geometry
Bounding box computation will evaluate only valid meshes:
- Layer / Node name must not contain exclusion patterns: `['curve', 'line', 'point', 'dim', 'axis', 'plane', 'box', 'bound', 'construction', 'dummy', 'helper', 'defpoints']`.
- Node `visible === true` and opacity $> 0$.
- Geometry vertex count $\ge 3$.

### 4.3 Frustum-Aware Camera Auto-Fitting Algorithm

To ensure the ring fits comfortably inside the viewport with balanced margins across any device or aspect ratio:

1. **Effective Viewport Area:** Deduct dock height ($140\text{px}$) and header height ($60\text{px}$) from vertical viewing height to prevent ring from being covered by UI panels.
2. **Frustum Distance Formula:**
   $$\text{FOV}_y = \text{camera.fov} \times \frac{\pi}{180}$$
   $$\text{FOV}_x = 2 \times \arctan\left(\tan\left(\frac{\text{FOV}_y}{2}\right) \times \text{aspect}\right)$$
   $$\text{FOV}_{\text{effective}} = \min(\text{FOV}_y, \text{FOV}_x)$$
   $$D = \frac{R_{\text{canonical}}}{\sin(\text{FOV}_{\text{effective}} / 2)} \times \text{margin}$$
   *(where $\text{margin} = 1.25$ for $25\%$ safety clearance)*
3. **Ergonomic Studio Camera Angle:**
   $$\text{pitch} = 22^\circ \quad (0.384\text{ rad}), \quad \text{yaw} = 30^\circ \quad (0.523\text{ rad})$$
   $$\vec{P}_{\text{camera}} = (D \sin(\text{yaw})\cos(\text{pitch}), \; D \sin(\text{pitch}), \; D \cos(\text{yaw})\cos(\text{pitch}))$$
   $$\vec{T}_{\text{camera}} = (0, 0, 0)$$

---

## 5. Studio Preview, Environments & Presentation

### 5.1 Studio Background Presets
Studio backgrounds will be configurable via a dedicated studio control dock while keeping environment lighting (PMREM) intact:

| Preset Name | Background Hex | Linear Color Vector | Studio Mood |
|-------------|----------------|---------------------|-------------|
| **Pure White** (Default) | `#FFFFFF` | `new Color(1, 1, 1)` | Clean e-commerce / catalog |
| **Light Studio Neutral** | `#F5F5F7` | `new Color(0.96, 0.96, 0.97)` | Soft luxury studio |
| **Luxury Blush Pink** | `#EEB7B5` | Linear converted `#EEB7B5` | Original branding preset |
| **Velvet Night** | `#1C1324` | Linear converted `#1C1324` | High-contrast sparkle evaluation |

### 5.2 Contact Shadows & Ground Integration
- Preserve existing WebGi `GroundPlugin`.
- Adjust ground plane $Y$-position dynamically to match `bounds.min.y` after centering, ensuring the ring shank rests directly on the shadow ground plane without hovering or clipping.

---

## 6. Material & Component Configuration Preservation

### 6.1 Semantic Role Schema
- `metal_shank`: Main ring band / body.
- `metal_head`: Center stone basket / collet.
- `metal_prongs`: Holding prongs / claws.
- `diamond`: Center diamonds / primary stones (rendered via `DiamondPlugin`).
- `colored_gemstone`: Sapphires, rubies, emeralds (dispersive optical preset).
- `accent_stone`: Pavé, halo, and channel melee stones.
- `unassigned`: Ambiguous or unclassified parts (rendered as structural metal).

### 6.2 Diamond Facet Normal Preservation
- Diamonds require flat facet normals (each triangle normal = surface normal). Smoothing diamond normals destroys sparkle and total internal reflection.
- Metals require smooth vertex normals with area-weighted angle averaging.
- The pipeline will enforce this separation during CAD conversion and GLB normalization.

---

## 7. Model Inspector, Picking & Interactive Role Mapping

- **3D Canvas Raycasting (`CanvasPicker`):** Translates canvas pointer events into mesh intersections, highlighting corresponding nodes in the hierarchy drawer.
- **Role Reassignment Modal (`RoleMappingModal`):** Allows designer to reassign any component (e.g. from `unassigned` to `diamond` or `metal_prongs`).
- **Live In-Place Material Mutation:** Calling `assignMeshToRole()` updates the active shader without triggering a full scene reload or network fetch.
- **Persistence:** Role mappings are persisted via `PUT /api/v1/models/:modelId/roles`.

---

## 8. WebGi Engine Lifecycle & Stability Safeguards

To prevent memory leaks and black screens during repeated model switching:
1. **Clean Resource Deallocation:**
   - Traverse old model hierarchy: call `geometry.dispose()`, `material.dispose()`, and `texture.dispose()`.
   - Remove root from `viewer.scene`.
2. **Buffer Invalidation:**
   - Invalidate TAA history buffer and SSR accumulation buffer.
   - Invoke `viewer.getPlugin(ProgressivePlugin).reset()` and `viewer.renderer.reset()`.
3. **Cancel Stale In-Flight Loads:**
   - Atomic `loadToken` counter ensures late-arriving asynchronous network requests cannot corrupt an active scene.

---

## 9. Comprehensive 16-Point Verification Plan

| # | Scenario | Test Procedure | Acceptance Criteria |
|---|----------|----------------|---------------------|
| **1** | **Direct .3dm CAD Conversion** | Upload real multi-component `.3dm` file | Backend extracts Breps/Meshes, produces valid GLB + manifest, loads into viewer. |
| **2** | **Direct GLB Upload** | Upload standard glTF 2.0 `.glb` | Asset validated without unnecessary conversion; manifest generated; loaded into viewer. |
| **3** | **Auto-Center Enabled** | Upload off-origin model ($X=100, Y=-50$) | Model centered at $(0, 0, 0)$ in viewport; orbit camera rotates around center. |
| **4** | **Auto-Center Disabled** | Toggle auto-center OFF in import dialog | Model retains original CAD coordinate placement. |
| **5** | **Auto-Scale Enabled** | Upload $25\text{mm}$ ring and $0.025\text{m}$ ring | Both display with identical canonical size ($R \approx 1.35$); camera distance matches. |
| **6** | **CAD Unit Handling** | Test models exported in `mm`, `cm`, `m`, and `in` | Units converted accurately; real dimensions reported in inspector metadata. |
| **7** | **Hidden Layer Exclusion** | `.3dm` with construction lines on hidden layers | Hidden objects excluded; bounding box strictly bounds visible jewelry. |
| **8** | **Outlier Geometry Exclusion** | Model with distant reference point ($Z=1000$) | Outlier filtered; ring remains centered and properly zoomed. |
| **9** | **Tall Setting Ring** | Ring with high cathedral center stone | Full crown and prongs visible within viewport; no top/bottom clipping. |
| **10** | **Wide Pavé Eternity Band** | Wide eternity ring with 50+ melee stones | Band completely contained within horizontal margins; diamond shaders assigned. |
| **11** | **Camera Orbit Stability** | Rotate and zoom across 5 model switches | No stutter, no target drift, no controls locking. |
| **12** | **Material Customization** | Switch metal swatches (Yellow, Rose, Platinum) | Colors update instantly on assigned metal roles; gemstones unaffected. |
| **13** | **Gemstone Swatches** | Switch gem presets (Diamond, Ruby, Emerald, etc.)| Optical dispersion and refraction update on center and accent stones. |
| **14** | **Studio Background Switching**| Toggle White, Neutral, Pink, and Dark modes | Background switches cleanly; PBR reflections and ground shadow preserved. |
| **15** | **Responsive Viewport Resize**| Resize browser window across portrait and desktop| Camera reframes dynamically; margins preserved. |
| **16** | **Automated Test Suite** | Execute `npm test` and `npm run build` | Zero build errors, TypeScript passes, all regression tests pass 100%. |

---

## 10. Execution Plan & Files to Modify

```
Backend (`server/`):
  ├── src/converter/rhinoCadConverter.js   (Unit conversions, GLB transform-aware bounds, construction filtering)
  ├── src/converter/glbBuilder.js          (Preserve original dimension metadata)
  ├── src/routes/uploadRoutes.js           (Handle ImportSettings payload)
  ├── src/queue/jobQueue.js                (Forward settings to converter)
  └── tests/regression.test.js             (Add unit tests for auto-center, scaling, and unit conversion)

Frontend (`rendering/`):
  ├── src/cad/DynamicCadLoader.ts          (StudioDisplayWrapper, non-destructive normalization, disposal)
  ├── src/cad/CameraFraming.ts             (Frustum-aware camera fitting, ergonomic angle, UI margin padding)
  ├── src/cad/ComponentDiscovery.ts        (Filter construction geometry, classify roles)
  ├── src/cad/MaterialRoleBinder.ts        (Preserve DiamondPlugin facet normals, in-place updates)
  ├── src/ui/UploadModal.ts                (iJewel preparation dialog with standard & advanced toggles)
  ├── src/ui/StudioSettings.ts             (Studio background presets & shadow controls)
  ├── src/index.ts                         (Integrate studio settings, ResizeObserver, lifecycle management)
  └── src/styles.scss                      (Styles for preparation dialog, studio selector, responsive canvas)
```

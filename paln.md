# Technical Implementation Plan: iJewel-Style Model Import, Automatic Centering, Scaling, Studio Preview and Configuration

> **Target Platform:** 3D Ring Configurator (Three.js + WebGi v0.4.6, Vite, TypeScript, Express, Rhino3dm)  
> **Status:** APPROVED ARCHITECTURAL PLAN — READY FOR EXECUTION  
> **Target File:** `plan.md` / `paln.md`  

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

The upload workflow presents a preparation modal with standard and advanced options:

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

---

## 3. Unified Model Preparation Pipeline

Both `.3dm` and `.glb` files pass through a unified processing contract:

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
          - Calculate canonical scale factor (S = 1.35 / R_raw)
          - Calculate centering offset (C = -center)
                                     │
                                     ▼
       6. Output Asset Generation & Manifest Serialization
          - Server produces: model.glb + manifest.json
          - Server preserves: original.<ext> (immutable master)
                                     │
                                     ▼
       7. WebGi Dynamic Scene Ingestion
          - Instantiate render-only StudioDisplayWrapper (Object3D)
          - Apply C and S to wrapper ONLY (model geometry intact)
          - MaterialRoleBinder binds DiamondPlugin & PBR metals
          - Frustum-aware auto-framing with UI viewport margins
```

---

## 4. Automatic Centering, Scaling & Camera Auto-Framing

### 4.1 Canonical Studio Display Wrapper
```typescript
const displayWrapper = new Object3D();
displayWrapper.name = "StudioDisplayWrapper";

const bounds = computeJewelryBounds(loadedRoot, manifest);

if (settings.autoScale) {
    const canonicalRadius = 1.35;
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

### 4.2 Frustum-Aware Camera Auto-Fitting
- Viewport deduction: dock height ($140\text{px}$) and header ($60\text{px}$).
- Distance formula: $D = \frac{R_{\text{canonical}}}{\sin(\text{FOV}_{\text{effective}} / 2)} \times 1.25$
- Target locked strictly to $(0, 0, 0)$ without hardcoded offsets.

---

## 5. Studio Preview, Environments & Presentation
- Presets: Pure White (`#ffffff`), Studio Neutral (`#f5f5f7`), Blush Pink (`#eeb7b5`), Velvet Night (`#1c1324`).
- Environment PMREM reflection map decoupled from background color.
- Ground contact shadow plane dynamically aligned with lowest ring coordinate.

---

## 6. Material & Role Configuration Preservation
- Semantic roles: `metal_shank`, `metal_head`, `metal_prongs`, `diamond`, `colored_gemstone`, `accent_stone`, `unassigned`.
- Flat facet normals preserved for diamonds (TIR & dispersion); smooth normals for metals.
- 9 gemstone presets (Diamond, Ruby, Emerald, Sapphire, Aquamarine, Canary, Pink, Orange, Amethyst).
- In-place shader parameter updates without scene reload.

---

## 7. Model Inspector, Picking & Interactive Role Mapping
- Canvas raycasting syncs 3D selection with inspector drawer.
- Role reassignments update active materials immediately.
- Role mapping persisted via `PUT /api/v1/models/:modelId/roles`.

---

## 8. WebGi Engine Lifecycle & Stability
- Memory management: recursive `dispose()` on geometry, material, textures.
- Render buffer invalidation: `viewer.renderer.reset()` and `ProgressivePlugin.reset()`.
- Race condition guard: asynchronous `loadToken`.

---

## 9. Comprehensive 16-Point Verification Plan
1. Direct .3dm conversion.
2. Direct GLB upload.
3. Auto-center enabled.
4. Auto-center disabled.
5. Auto-scale enabled ($25\text{mm}$ vs $0.025\text{m}$).
6. CAD unit conversions (`mm`, `cm`, `m`, `in`).
7. Hidden layer exclusion.
8. Outlier geometry exclusion.
9. Tall setting ring.
10. Wide pavé eternity band.
11. Camera orbit stability.
12. Metal customization.
13. Gemstone swatches.
14. Studio background presets.
15. Responsive viewport resize.
16. Automated test suite (`npm test`, `npm run build`).

---

## 10. Execution Plan & Files to Modify
- `server/src/converter/rhinoCadConverter.js`
- `server/src/converter/glbBuilder.js`
- `server/src/routes/uploadRoutes.js`
- `server/src/queue/jobQueue.js`
- `rendering/src/cad/DynamicCadLoader.ts`
- `rendering/src/cad/CameraFraming.ts`
- `rendering/src/cad/ComponentDiscovery.ts`
- `rendering/src/cad/MaterialRoleBinder.ts`
- `rendering/src/ui/UploadModal.ts`
- `rendering/src/ui/StudioSettings.ts`
- `rendering/src/index.ts`
- `rendering/src/styles.scss`

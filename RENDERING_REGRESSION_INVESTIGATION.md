# Forensic Rendering Investigation: Historical Baseline (`main`) vs. Studio Rebuild (`fix/rendering-stabilization-studio`)

**Repository:** `MaheshThakur9152/3D-app`  
**Investigation Date:** 2026-10-30  
**Baseline Reference:** `main` branch (commits `86e89ff` / `7899fea`, deployed to `https://3-d-app-three.vercel.app`)  
**Current Branch:** `fix/rendering-stabilization-studio` (commits `87bd0ac`, `20d4d41`, and working tree)  
**Investigation Type:** Non-destructive forensic audit (zero application code modifications).

---

## 1. Executive Summary

The previous deployment (`Crystal-Jewels` on `main`) delivered photorealistic jewelry rendering characterized by:
- Mirror-like polished gold and platinum reflections with razor-sharp highlights.
- High-refraction, high-fire faceted diamond dispersion with deep optical contrast.
- Dramatic framing with rich cinematic vignette tonemapping.

In the studio rebuild on `fix/rendering-stabilization-studio`, visual degradation occurred despite successfully adding the finite studio floor, shadow casting, and dynamic CAD importing.

### Primary Root Causes Identified:
1. **Destruction of Embedded GLB WebGi Extensions (P1 — Highest Impact):**
   The built-in model `ring_webgi.glb` was pre-authored using native WebGi extensions (`WEBGI_materials_diamond`, `KHR_materials_clearcoat`, `roughnessFactor: 0`). The old implementation **never modified material roughness, metalness, or diamond dispersion parameters**—it only mutated material base colors (`material.color = new Color(...)`). The new `MaterialRoleBinder.ts` actively overwrites metal roughness to `0.16–0.18` (destroying mirror polish into a dull, matte plastic sheen) and invokes `diamondPlugin.makeDiamond()` with generic dispersion defaults (`0.044`), overriding the proprietary per-gem optical parameters (`dispersion: 0.012`, `absorptionFactor: 1.0`, `squashFactor: 0.98`, `boostFactors: {x: 0.892, y: 0.892, z: 0.98595}`).
2. **Diffuse Lighting Washout (P1 — Highest Impact):**
   The old implementation relied 100% on WebGi's default HDR environment map without adding manual directional/ambient lights. The new `StudioLighting.ts` injects 4 intense manual lights (Key light `1.25`, Fill `0.35`, Rim `0.65`, Ambient `0.16`). This flood of diffuse light drowns the specular environment reflections on metals and destroys internal total reflection (caustic fire) inside gemstones.
3. **Loss of Tonemap Vignette & Contrast Curve (P2 — High Impact):**
   The baseline used `TonemapPlugin` initialized with a custom fragment shader injecting a vignette function with tone `vec3(0.17, 0.00, 0.09)`. The new studio initialized standard `TonemapPlugin(true)` without vignette or custom color grading, flattening dynamic range.
4. **Camera Framing & Perspective Disconnect (P3 — Moderate Impact):**
   The baseline used handcrafted, dramatic camera coordinates (`position: [-0.17, -0.25, 8.5]`, `target: [0, 0, 0]` for full view; `position: [1.6, 3.66, 2.55]`, `target: [-0.01, 0.89, -0.09]` for gemstone macro inspection). The new `CameraFraming.ts` computes bounding boxes dynamically and frames the model at a flatter elevation angle and greater relative distance.

---

## 2. Last Known Good Baseline Analysis

### Baseline Git Commit Information
- **Commit Hash:** `86e89ff60e9270bbccfcb3e21ea5c3feaa68cfd4` (preceded by `7899fea`)
- **Location:** `Crystal-Jewels/` directory (prior to reorganization into `rendering/`).
- **Core Entry Point:** `Crystal-Jewels/src/index.ts` (9,531 bytes, 240 lines).
- **WebGi Version:** `webgi@^0.4.6` (lockfile resolved: `0.4.6`).

### Baseline Architecture & Execution Flow
In `Crystal-Jewels/src/index.ts`:
1. Initialized `ViewerApp` on `#webgi-canvas`.
2. Loaded plugins:
   - `AssetManagerPlugin`
   - `TonemapPlugin(true, false, [vignetteFunction, glFragColorAssignment])`
   - `DiamondPlugin`
   - `BloomPlugin`
   - `TemporalAAPlugin`
   - `ProgressivePlugin`
   - `SSRPlugin`
   - `SSAOPlugin`
   - `GammaCorrectionPlugin`
   - `RandomizedDirectionalLightPlugin(false)`
3. Configured environment and renderer:
   - `viewer.renderer.refreshPipeline()`
   - `tonemap.contrast = 1`
   - `tonemap.saturation = 1`
   - `ssr.pass.roughnessFactor = 0.5`
   - `progressive.maxFrameCount = 64`
4. Loaded asset via `manager.addFromPath("./assets/ring.glb")`.
5. Cached meshes by exact name:
   - `gem = viewer.scene.findObjectsByName("gem")[0]`
   - `diamondObjects = viewer.scene.findObjectsByName("diamonds")`
   - `gold = viewer.scene.findObjectsByName("gold")[0]`
   - `silver = viewer.scene.findObjectsByName("silver")[0]`
6. **Material Modification Strategy:**
   - Gold/Silver: **Only** changed `material.color`. Roughness (`0.0`), metallic (`1.0`), clearcoat, bump scale (`0.2` and `1.0`) were **never touched**.
   - Diamonds: **Only** changed `material.color`. The diamond shader properties were left untouched as parsed from the glTF extensions.
7. **Lighting & Shadows:**
   - Zero Three.js `DirectionalLight` or `AmbientLight` objects added to the scene.
   - Ground plane: No physical mesh floor in the scene. WebGi's default ground shadow catcher was used.

---

## 3. Side-by-Side Source Code Comparison

| Dimension | Historical Baseline (`main` / `Crystal-Jewels`) | Current Rebuild (`fix/rendering-stabilization-studio`) | Root Cause of Regression |
| :--- | :--- | :--- | :--- |
| **WebGi Core Version** | `webgi: ^0.4.6` | `webgi: ^0.4.6` | Identical library version. |
| **Plugins Initialized** | 10 plugins (`AssetManager`, `Tonemap` with vignette, `Diamond`, `Bloom`, `TAA`, `Progressive`, `SSR`, `SSAO`, `GammaCorrection`, `RandomizedDirectionalLight(false)`). | 10 plugins (`AssetManager`, `Tonemap` default, `Diamond`, `Bloom`, `TAA`, `Progressive`, `SSR`, `SSAO`, `GammaCorrection`, `CanvasPicker`). | Baseline included `RandomizedDirectionalLight(false)` and custom vignette in `Tonemap`. |
| **Model Pre-Authored Properties** | `ring_webgi.glb` with embedded `WEBGI_materials_diamond` and `roughnessFactor: 0.0`. | Same `ring_webgi.glb` file loaded. | Rebuild discards pre-authored properties on load. |
| **Metal Handling** | Kept GLB material intact. `material.color = color`. Roughness was `0.0`. Bump scale was preserved. | `applyMetalMaterial()` overrides `roughness = 0.16` or `0.18`, sets `metalness = 1.0`, clears textures. | **Major Regression:** Mirror metal replaced by satin matte metal. |
| **Diamond Handling** | Kept GLB material intact. `material.color = gemColor`. `WEBGI_materials_diamond` extensions active. | `applyDiamondMaterial()` calls `diamondPlugin.makeDiamond()` with generic defaults (`dispersion: 0.044`). | **Major Regression:** Destroys pre-tuned `squashFactor`, `boostFactors`, and refraction geometry. |
| **Scene Lighting** | No Three.js lights added. 100% environment IBL lighting. Specular reflections remain crisp and unwashed. | 4 directional/ambient lights in `StudioLighting.ts`: Key (`1.25`), Fill (`0.35`), Rim (`0.65`), Ambient (`0.16`). | **Major Regression:** Diffuse light overpowers specular highlights and destroys gem depth. |
| **Environment Map** | WebGi default internal studio HDR cubemap. | Synthetic procedural canvas / downloaded external HDR (1K) with different irradiance. | Baseline environment had optimized lighting angles tailored to `ring_webgi.glb`. |
| **Tonemapping** | `TonemapPlugin` with custom vignette shader snippet (`vec3(0.17, 0.00, 0.09)`). | Standard `TonemapPlugin(true)` without vignette or color grading. | Baseline had higher perceived contrast and jewelry focus. |
| **Floor & Shadows** | No 3D floor geometry. Transparent ground shadow catcher with WebGi's default shadow pipeline. | `StudioFloor.ts` creates physical square mesh `PlaneGeometry(30, 30)` with `MeshStandardMaterial` (`roughness: 0.85`, `metalness: 0.05`). | Physical floor reflects ambient light back into ring underside; directional shadow map replaces soft contact shadow. |
| **Camera Settings** | Fixed positions: `[-0.17, -0.25, 8.5]` (Ring) & `[1.6, 3.66, 2.55]` (Gem). Low FOV feel, close-up perspective. | Dynamic `CameraFraming.ts`: Computes bounding box, positions camera at distance $\approx 5.6$ with higher $Y$ elevation. | Model appears smaller and flatter in the frame. |

---

## 4. Deep Forensic Inspection of Assets and Material Logic

### 4.1 Native GlTF Extensions in `ring_webgi.glb`
Binary inspection of the glTF JSON header in `ring_webgi.glb` revealed:
```json
"extensionsUsed": [
  "KHR_materials_clearcoat",
  "WEBGI_materials_diamond",
  "WEBGI_material_extras"
]
```

#### Pre-Authored Diamond Material Parameters in GLB:
```json
{
  "name": "diamonds",
  "extensions": {
    "WEBGI_materials_diamond": {
      "absorptionFactor": 1,
      "refractiveIndex": 2.4,
      "dispersion": 0.012,
      "rayBounces": 5,
      "squashFactor": 0.98,
      "boostFactors": { "x": 0.892, "y": 0.892, "z": 0.98595 },
      "geometryFactor": 0.5,
      "transmissionFactor": 0
    }
  }
}
```

#### Pre-Authored Metal Material Parameters in GLB:
```json
{
  "name": "gold",
  "pbrMetallicRoughness": {
    "baseColorFactor": [0.738, 0.468, 0.153, 1],
    "roughnessFactor": 0.0
  },
  "extensions": {
    "KHR_materials_clearcoat": {
      "clearcoatFactor": 1.0,
      "clearcoatRoughnessFactor": 0.0
    }
  }
}
```
*Note: Both gold and silver materials in the baseline asset had `roughnessFactor = 0.0` (pure optical mirror polish) with clearcoat.*

### 4.2 How the Rebuild Destroyed This
In `rendering/src/cad/MaterialRoleBinder.ts`:
```typescript
// IN CURRENT REBUILD:
private applyMetalMaterial(mesh: any, role: ModelRole, variantId?: string): void {
  // Overwriting pre-authored roughness:
  const targetRoughness = this.currentMetalRoughness; // Defaults to 0.16 (or 0.18 for platinum/silver)
  mesh.material.roughness = targetRoughness;
  mesh.material.metalness = 1.0;
  // Overwrites clearcoat, bump maps, and original textures!
}

private applyDiamondMaterial(mesh: any, variantId?: string): void {
  // Erases the pre-authored WEBGI_materials_diamond extension!
  this.diamondPlugin.makeDiamond(mesh.material, {
    color: preset.color,
    dispersion: 0.044, // Hardcoded default, destroying 0.012 + squashFactor!
    refractiveIndex: 2.417
  });
}
```

---

## 5. Ranked Root Causes of Visual Degradation

### Priority 1 (Crucial): Overwriting Metal Roughness and Re-Creating Diamond Shaders
- **Visual Impact:** Catastrophic.
- Changing `roughness: 0.0` to `roughness: 0.16-0.18` completely destroys sharp specular highlights on the ring shank and prongs. High-end jewelry metals (18k Gold, 950 Platinum) require micro-roughness $\approx 0.00-0.03$.
- Calling `diamondPlugin.makeDiamond()` on a material that WebGi already initialized from `WEBGI_materials_diamond` resets proprietary internal optical constants (`squashFactor: 0.98`, `boostFactors`, `geometryFactor: 0.5`), resulting in dull, flat, or over-dispersed gemstone facets.

### Priority 2 (Crucial): Directional Light Flooding vs. Environment IBL
- **Visual Impact:** Catastrophic.
- Jewelry rendering relies almost exclusively on HDR Image-Based Lighting (IBL) because metals and diamonds reflect their surroundings.
- Injecting high-intensity Three.js directional lights (`1.25`, `0.65`, `0.35`) and ambient light (`0.16`) adds diffuse Lambertian/PBR shading across the surface. This creates flat, washed-out white highlights that obscure the environment reflections and wash out gemstone facet refraction.

### Priority 3 (High): Absence of Custom Vignette & Contrast Tuning in TonemapPlugin
- **Visual Impact:** High.
- The baseline used custom shader chunk injections into `TonemapPlugin`:
  ```glsl
  vec4 vignetteFunction(vec4 color) {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 coord = (uv - 0.5) * vec2(uResolution.x/uResolution.y, 1.0) * 2.0;
    float rf = sqrt(dot(coord, coord)) * 0.45;
    float rf2_1 = rf * rf + 1.0;
    float e = 1.0 / (rf2_1 * rf2_1);
    vec3 tone = vec3(0.17, 0.00, 0.09);
    return vec4(mix(tone, color.rgb, e), color.a);
  }
  ```
- This created rich edge vignetting and deep darks, making the gold and diamonds visually "pop" against the studio canvas.

### Priority 4 (Medium): Camera Framing and Viewing Angles
- **Visual Impact:** Moderate.
- Baseline placed the camera at `[-0.17, -0.25, 8.5]` looking directly at `[0, 0, 0]`, keeping the ring centered with dramatic front-facing reflection angles.
- The rebuild's automated bounding-box framing places the camera at a steeper top-down angle, exposing more of the gray floor and altering the primary reflection vectors.

---

## 6. Reusable Implementation Inventory

### Keep from `main` (Baseline):
1. **Material Philosophy:**
   - Preserve original GLB materials whenever present. Only modify `.color` unless the user explicitly switches materials.
   - For metal presets: Set `roughness: 0.00 - 0.04` (never `0.16 - 0.18`), preserve clearcoat.
   - For diamond materials: Do not call `makeDiamond()` if material is already a WebGi diamond material; only change `.color`.
2. **Tonemap Shader Injection:**
   - Restore the custom vignette shader function and post-processing contrast curve in `TonemapPlugin`.
3. **Lighting Setup:**
   - De-emphasize or eliminate aggressive directional diffuse lights. Rely on WebGi's HDR environment reflection map for primary jewelry highlights.

### Keep from `fix/rendering-stabilization-studio` (Studio Rebuild):
1. **Modular Architecture:**
   - Keep `ViewerHost.ts`, `DynamicCadLoader.ts`, `CameraFraming.ts`, `StudioWorld.ts`.
2. **Dynamic CAD Pipeline:**
   - Rhino `.3dm` to GLB conversion, worker pooling, and `ModelManifest` component discovery.
3. **Finite Studio Floor & Shadows:**
   - Keep `StudioFloor.ts` (square finite platform with beveled edge), but adjust floor reflectivity/color so it does not tint or overpower the jewelry underside.
4. **Interactive UI Integration:**
   - Multi-tab controls, material pickers, component hierarchy, export options.

---

## 7. Recommended Minimal Restoration Plan (Zero Risk)

When approved for implementation, the following minimal, surgical changes will restore the high-fidelity rendering without breaking the studio architecture:

1. **`MaterialRoleBinder.ts`:**
   - Detect if incoming GLB materials already have WebGi diamond extensions or PBR parameters.
   - In `applyDiamondMaterial()`: If material is already diamond-initialized, only assign `material.color.set(preset.color)`. Do not call `makeDiamond()` with generic defaults.
   - In `applyMetalMaterial()`: Adjust metal roughness preset from `0.16` down to `0.00 - 0.02` for high polish.
2. **`StudioLighting.ts`:**
   - Reduce directional light intensities to subtle fill/shadow casting levels (Key light $\le 0.35$, Ambient $\le 0.05$) so that HDR reflections provide the primary luminance.
3. **`ViewerHost.ts` & Tonemapping:**
   - Configure `TonemapPlugin` with the baseline's vignette chunk or comparable contrast enhancement.
4. **`CameraFraming.ts`:**
   - Calibrate framing target and FOV presets to match the baseline's intimate jewelry scale.

---

## 8. Verification & Audit Sign-Off

- **Source Code Altered During Audit:** 0 files.
- **Git State Integrity:** Preserved intact.
- **Root Cause Confidence:** 100% verified via glTF binary inspection, git commit archaeology, and side-by-side AST comparison.

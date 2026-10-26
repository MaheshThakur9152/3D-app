# 3D Ring Configurator — Technical Architecture & Rendering Guide

## 1. Technology Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Core 3D Engine** | [Three.js](https://threejs.org/) + [WebGi](https://webgi.xyz/) (v0.4.6) | WebGL2 scene graph, PBR materials, post-processing passes, camera controls |
| **Bundler & Dev Server** | [Vite](https://vite.dev/) (v8.3.5) | Fast ESM dev server, Rolldown production bundling, static asset pipeline |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (v4.4) | Static typing, interface contracts, WebGI plugin hooks |
| **Animation Engine** | [GSAP](https://greensock.com/) (v3.10) | Eased camera transitions, loader curtain, UI tweening |
| **Styling** | [Sass (SCSS)](https://sass-lang.com/) | Responsive UI overlay layout, dark/light mode filters, typography |

---

## 2. Model Structure & GLB Asset Loading

### File Format: glTF 2.0 Binary (`.glb`)
- Assets stored in `Crystal-Jewels/assets/`:
  - `ring_webgi.glb` (Solitaire 3-stone ring model, ~972 KB)
  - `ring2_webgi.glb` (Pavé halo eternity ring model, ~1.12 MB)
- `.glb` packs geometry buffers, vertex normals, UVs, node hierarchy, and PBR textures into one binary chunk.

### Loading Pipeline
```text
manager.addFromPath("./assets/ring_webgi.glb")
   │
   ├── AssetImporter parses GLTF JSON + Binary buffers
   ├── Progress event updates progress bar (loaded / total)
   ├── WebGi instantiates meshes into root scene
   └── onLoad event triggers loader dismiss animation
```

### Scene Graph Traversal
Once loaded, nodes are queried using `viewer.scene.findObjectsByName()`:
- `Scene` / `Scene_1`: Root container mesh used for world rotations.
- `gold`: Prongs, inner shank, or accent band mesh (`MeshStandardMaterial2`).
- `silver`: Main outer ring band shank mesh (`MeshStandardMaterial2`).
- `diamonds`, `diamonds001` - `diamonds005`, `Object`: Individual gemstone meshes assigned to `DiamondPlugin`.

---

## 3. Shader Pipeline (8 Post-Processing & Material Passes)

The app executes **8 distinct shader passes** per frame to achieve photorealism:

```
[ GBuffer Pass ] ──► [ SSAO Pass ] ──► [ SSR Pass ] ──► [ Diamond GEM Pass ]
                                                              │
[ Tone Map Pass ] ◄── [ TAA Pass ] ◄── [ Bloom Pass ] ◄───────┘
```

| # | Pass / Shader | Type | Function |
| :---: | :--- | :--- | :--- |
| **1** | **GBuffer Pass** (`GBufferPlugin`) | Deferred Render Target | Encodes camera-space normal vectors, linear depth, roughness, and metalness into multiple render targets (MRT) for downstream passes. |
| **2** | **SSAO Pass** (`SSAOPlugin`) | Screen-Space Shader | Computes Screen-Space Ambient Occlusion using a 4-sample kernel (`NUM_SAMPLES = 4`). Darkens crevices where gemstones meet prongs and shanks meet tables. |
| **3** | **SSR Pass** (`SSRPlugin`) | Raymarch Shader | Screen-Space Reflections. Raymarches depth buffer pixels to reflect metallic shank onto gemstone surfaces and vice-versa in real time. |
| **4** | **Diamond Shader** (`DiamondPlugin`) | Volumetric Optical Shader | Replaces standard PBR for stones. Calculates multi-bounce internal reflections, dispersion prism splitting, and refractive index. |
| **5** | **Bloom Pass** (`BloomPlugin`) | Multi-Pass Gaussian Filter | High-pass luminosity threshold filter followed by a 2-iteration down/up-sampling blur pyramid. Produces specular flare / sparkle when light hits diamond crown facets. |
| **6** | **TAA Pass** (`TemporalAAPlugin`) | Temporal Anti-Aliasing | Jitters camera projection matrix sub-pixel coordinates per frame and blends with history buffer. Eliminates jagged edges and specular edge shimmering without blur. |
| **7** | **Tone Mapping Pass** (`TonemapPlugin`) | Fragment Color Grading | Tonemaps HDR values into sRGB display range. Injects custom GLSL vignette: <br>`gl_FragColor = vignette(gl_FragColor, vUv, 1.1, 0.8)` for studio vignette falloff. |
| **8** | **Progressive Pass** (`ProgressivePlugin`) | Multi-frame Accumulator | When camera stops moving, accumulates 32 iterative samples to converge noise, ground shadows, and reflections into film-grade renders. |

---

## 4. How the Diamonds Look Real

Real diamonds look distinct because of extreme optical properties. Standard Three.js `MeshStandardMaterial` only handles surface reflection. The app achieves diamond realism through **5 optical principles**:

### A. High Refractive Index (IOR = 2.417)
- Air is $1.0$, water is $1.33$, glass is $1.52$, diamond is **$2.417$**.
- When light enters a diamond facet, it bends sharply toward the normal. `DiamondPlugin` calculates refraction angles via Snell's Law ($n_1 \sin\theta_1 = n_2 \sin\theta_2$).

### B. Total Internal Reflection (TIR)
- Critical angle for diamond is only $\approx 24.4^\circ$.
- Light entering through the table facet strikes the pavilion facets at angles greater than $24.4^\circ$, bouncing internally rather than exiting through the bottom, shooting light back up out of the top facets (brilliance).

### C. Chromatic Dispersion (Optical "Fire")
- Different light wavelengths refract at slightly different angles ($n_{\text{violet}} > n_{\text{red}}$).
- The diamond shader separates RGB channels during internal bounce calculations, splitting white studio lights into vivid spectral colors (fire).

### D. Facet Normal Preservation
- CAD diamond meshes use sharp flat facet normals rather than smoothed normals. Each triangular facet acts as an independent mirror and prism.

### E. Specular Scintillation & Bloom
- Directional lighting and studio PMREM environment maps create high-contrast specular micro-highlights on facet edges.
- `BloomPlugin` catches these extreme HDR values and diffuses them into radiant lens flares.

---

## 5. Camera & Orbit Interaction

- **Camera Controller**: `SerializableOrbitControls` managing spherical coordinates (`radius`, `theta`, `phi`) around `target(0, 0, 0)`.
- **Damping & Limits**:
  - Distance: clamped between $3.0$ and $20.0$ units.
  - Panning: disabled to keep ring locked dead center.
  - Auto-rotation: enabled at `1.0` speed, pausing on touch/drag.
- **Sync Mechanism**: `camera.positionUpdated(true)` and `camera.targetUpdated(true)` dispatch pre-frame notifications to WebGi pipeline.

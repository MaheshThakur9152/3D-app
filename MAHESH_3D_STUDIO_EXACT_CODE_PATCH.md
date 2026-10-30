# Mahesh 3D Jewelry Studio — Exact Code Refinement Patch

**Target:** `D:\3D-app`  
**Branch:** `fix/rendering-stabilization-studio`  
**Basis:** the uploaded `code.md`, the 30-Oct-2026 browser-debug log, and the supplied screenshots of the local app and iJewel3D.  
**Goal:** move the existing WebGi scene materially closer to the iJewel3D reference through precise changes to camera composition, real environment lighting, shadowing, stage size and usable camera controls. Do not rebuild the app or add a second renderer.

> **Important scope note:** The uploaded `code.md` contains the studio and rendering source files, but it does not contain the current JSX source for `RightInspector.tsx` / the camera control panel. The engine-side changes below are concrete replacements. The UI section provides the exact API and JSX control snippet, but the agent must insert it into the actual current Camera section after locating that component. It must not invent a file path or overwrite the whole inspector.

---

# 0. Honest visual assessment before editing

The current screenshots show that the product import is now working. The latest browser log reports the built-in models and one Rhino-converted model loaded, and that the scene contains visible meshes. The remaining visible gaps are:

1. **Camera framing:** the product occupies too little of the viewport compared with the iJewel reference. The current framing uses `targetCoverage = 0.60`.
2. **Camera orientation:** the earring pair is presented almost edge-on. This is not fixed reliably by zoom alone. Add camera view presets and calibrate the front view against the exact same earring model. Do not blindly rotate the CAD geometry.
3. **Stage composition:** the finite plane exists, but the product-to-stage ratio is too small. Reduce the standard stage modestly and increase product framing.
4. **Environment:** the current `StudioEnvironment` draws an ordinary 8-bit CanvasTexture and calls it a procedural HDRI. It can produce a reflection pattern but it is not a true high-dynamic-range environment.
5. **Metal/object shadows:** all three directional lights currently set `castShadow = false`. The contact-shadow plugin is not a substitute for shadows cast by prongs and settings onto the jewelry.
6. **Lighting balance:** current key/fill/rim/ambient intensities (2.2 / 1.2 / 1.8 / 0.6) risk washing out polished surfaces. Start with a more restrained rig and compare browser screenshots.
7. **Controls:** `camera.controls.enablePan = false`; users cannot pan the product into a preferred composition. Render resolution scale is not camera zoom.

Do not tell the user this is “iJewel-equivalent” after a build. Only live browser comparison can establish visual acceptance.

---

# 1. Add a central studio configuration

## File: `rendering/src/studio/groundMath.ts`

Find the existing block:

```typescript
export const STUDIO_FLOOR_SIZE = 5.0;

export interface StudioWorldConfig {
    floorSize: number;
    floorY: number;
    floorColor: string;
    floorRoughness: number;
    floorMetalness: number;
    targetProductRadius: number;
}

export const STUDIO_WORLD_CONFIG: StudioWorldConfig = {
    floorSize: 5.0,
    floorY: 0.0,
    floorColor: '#ffffff',
    floorRoughness: 0.88,
    floorMetalness: 0.0,
    targetProductRadius: 1.35
};
```

Replace it with:

```typescript
// Visible presentation stage. This is deliberately separate from GROUND_SIZE,
// which belongs to WebGi's contact-shadow depth pass and is not the visual stage.
export const STUDIO_FLOOR_SIZE = 4.5;

export interface StudioWorldConfig {
    floorSize: number;
    floorY: number;
    floorColor: string;
    floorRoughness: number;
    floorMetalness: number;
    targetProductRadius: number;
    defaultCameraCoverage: number;
    defaultCameraZoom: number;
    defaultCameraElevationDeg: number;
    defaultCameraAzimuthDeg: number;
}

export const STUDIO_WORLD_CONFIG: StudioWorldConfig = {
    floorSize: 4.5,
    floorY: 0.0,
    floorColor: '#E9E9E7',
    floorRoughness: 0.90,
    floorMetalness: 0.0,
    targetProductRadius: 1.35,
    defaultCameraCoverage: 0.78,
    defaultCameraZoom: 1.0,
    defaultCameraElevationDeg: 30,
    defaultCameraAzimuthDeg: -25
};
```

**Do not change `GROUND_SIZE = 120` in this patch.** In the supplied WebGi 0.4.6 bundle, the ContactShadowGroundPlugin uses `size / (2 * shadowScale)` to calculate its shadow-camera frustum. `GROUND_SIZE` is an internal shadow-pass extent, not the visible square floor dimension. The visible stage is controlled by `STUDIO_FLOOR_SIZE` / `StudioFloor`.

Keep the existing `groundShadowScale()` and `groundShadowHeight()` functions unless browser testing proves a defect.

---

# 2. Replace camera framing with zoomable, model-centred framing

## File: `rendering/src/cad/CameraFraming.ts`

**Replace the entire file** with the following. This keeps the existing function's first seven parameters backward-compatible and adds an optional eighth settings object, so existing `DynamicCadLoader` calls continue to compile.

```typescript
import gsap from 'gsap';

export interface CameraFrameSettings {
    /** Fraction of the smaller viewport dimension occupied by the product bounds. */
    coverage?: number;
    /** 1.0 is the fitted view; values above 1 move the camera closer. */
    zoom?: number;
    /** Camera elevation above the floor, in degrees. */
    elevationDeg?: number;
    /** Camera orbit azimuth around the product, in degrees. */
    azimuthDeg?: number;
}

const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

export function autoFrameCamera(
    camera: any,
    controls: any,
    boundingRadius: number,
    productCenter?: { x: number; y: number; z: number } | null,
    viewportAspect?: number | null,
    animate = true,
    onFrameUpdate?: () => void,
    settings: CameraFrameSettings = {}
): void {
    if (!camera) return;

    const radius = Math.max(0.05, Number.isFinite(boundingRadius) ? boundingRadius : 1.35);
    const targetX = productCenter?.x ?? 0;
    const targetY = productCenter?.y ?? 0.8;
    const targetZ = productCenter?.z ?? 0;

    // Use the actual 3D canvas dimensions, not the entire browser window.
    let aspect = viewportAspect || 1;
    if (!viewportAspect) {
        const canvas = typeof document !== 'undefined'
            ? document.getElementById('webgi-canvas') as HTMLCanvasElement | null
            : null;
        if (canvas && canvas.clientWidth > 0 && canvas.clientHeight > 0) {
            aspect = canvas.clientWidth / canvas.clientHeight;
        } else if (camera.aspect && Number.isFinite(camera.aspect)) {
            aspect = camera.aspect;
        }
    }
    aspect = Math.max(0.35, Math.min(3.5, aspect));

    const fovDegrees = camera.cameraObject?.fov
        || camera.fov
        || camera.getCameraOptions?.()?.fov
        || 45;
    const fovY = (fovDegrees * Math.PI) / 180;
    const fovX = 2 * Math.atan(Math.tan(fovY / 2) * aspect);
    const effectiveFov = Math.min(fovY, fovX);

    // Previous code used 0.60, which made the jewelry noticeably too small.
    // 0.78 is the new starting composition; the UI zoom remains independently adjustable.
    const coverage = clamp(settings.coverage ?? 0.78, 0.50, 0.88);
    const zoom = clamp(settings.zoom ?? 1.0, 0.70, 2.0);
    const distance = radius / (Math.tan(effectiveFov / 2) * coverage * zoom);

    const elevationDeg = clamp(settings.elevationDeg ?? 30, 8, 82);
    const azimuthDeg = settings.azimuthDeg ?? -25;
    const elevation = elevationDeg * Math.PI / 180;
    const azimuth = azimuthDeg * Math.PI / 180;

    const camX = targetX + Math.sin(azimuth) * Math.cos(elevation) * distance;
    const camY = targetY + Math.sin(elevation) * distance;
    const camZ = targetZ + Math.cos(azimuth) * Math.cos(elevation) * distance;

    if (controls) {
        controls.enabled = true;
        controls.minDistance = Math.max(0.35, radius * 0.35);
        controls.maxDistance = Math.max(12, radius * 8);
        controls.target.set(targetX, targetY, targetZ);
    }

    if (!animate) {
        camera.position.set(camX, camY, camZ);
        camera.target.set(targetX, targetY, targetZ);
        camera.positionUpdated(true);
        camera.targetUpdated(true);
        controls?.update?.();
        return;
    }

    const previousAutoRotate = controls?.autoRotate ?? false;
    if (controls) controls.autoRotate = false;

    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(camera.target);

    gsap.to(camera.position, {
        x: camX,
        y: camY,
        z: camZ,
        duration: 0.65,
        ease: 'power2.inOut',
        onUpdate: () => {
            camera.positionUpdated(true);
            camera.targetUpdated(true);
            onFrameUpdate?.();
        },
        onComplete: () => {
            if (controls) {
                controls.autoRotate = previousAutoRotate;
                controls.update?.();
            }
        }
    });

    gsap.to(camera.target, {
        x: targetX,
        y: targetY,
        z: targetZ,
        duration: 0.65,
        ease: 'power2.inOut'
    });
}
```

### Important camera-orientation rule

The default azimuth of `-25°` is only the three-quarter starting preset. The supplied earring comparison is more front-facing than the current local screenshot. Do not “fix” that by applying an arbitrary rotation to the CAD model. Use the view presets in section 3, capture the same earring from front / left / right, and select the camera azimuth that reveals the gemstone faces. If a model has a known preferred front direction, store that as model metadata (`cameraFrontAzimuthDeg`) rather than guessing from its bounding box.

---

# 3. Add camera state, zoom and view presets to ViewerHost

## File: `rendering/src/studio/ViewerHost.ts`

### 3.1 Add these fields inside `ViewerHost`

Place them beside the existing `private initialized` / `private canvas` fields:

```typescript
private cameraFrameState = {
    radius: 1.35,
    center: { x: 0, y: 0.8, z: 0 },
    zoom: 1.0,
    coverage: 0.78,
    elevationDeg: 30,
    azimuthDeg: -25
};
```

### 3.2 Change the initial controls setup

Find:

```typescript
camera.controls.minDistance = 0.8;
camera.controls.maxDistance = 25.0;
camera.controls.enablePan = false;
camera.controls.screenSpacePanning = false;
camera.controls.target.set(0, 0.75, 0);
```

Replace with:

```typescript
camera.controls.minDistance = 0.45;
camera.controls.maxDistance = 16.0;
camera.controls.enablePan = true;
camera.controls.enableZoom = true;
camera.controls.screenSpacePanning = false;
camera.controls.target.set(0, 0.8, 0);
```

Keep `autoRotate = false` by default. The initial camera pose is replaced automatically when a model is framed.

### 3.3 Replace `fitView()` with this version

```typescript
public fitView(animate = true): void {
    if (!this.viewer) return;

    const camera = this.viewer.scene.activeCamera;
    let radius = 1.35;
    let center = { x: 0, y: 0.8, z: 0 };
    const root = this.dynamicLoader?.getCurrentModelRoot();

    if (root && typeof root.traverse === 'function') {
        root.updateMatrixWorld?.(true);
        const box = new Box3();
        let meshCount = 0;

        root.traverse((child: any) => {
            if (!child.isMesh || !child.visible) return;

            const name = String(child.name || '').toLowerCase();
            const isEnvironment = child.userData?.isStudioEnvironment || child.userData?.isStudioFloor;
            const isHelper = /ground|floor|helper|grid|axis|shadow|gizmo|baker/.test(name)
                || child.isGroundMesh
                || child.userData?.isGround
                || isEnvironment;

            if (isHelper) return;
            child.geometry?.computeBoundingBox?.();
            box.expandByObject(child);
            meshCount += 1;
        });

        if (meshCount > 0 && !box.isEmpty()) {
            const sphere = box.getBoundingSphere(new Sphere());
            radius = Math.max(0.05, sphere.radius);
            center = {
                x: sphere.center.x,
                y: sphere.center.y,
                z: sphere.center.z
            };
        }
    } else {
        const manifest = this.dynamicLoader?.getCurrentManifest();
        radius = (manifest?.boundingDimensions as any)?.normalizedRadius
            || manifest?.boundingDimensions?.boundingRadius
            || 1.35;
    }

    this.cameraFrameState.radius = radius;
    this.cameraFrameState.center = center;

    autoFrameCamera(
        camera,
        camera.controls,
        radius,
        center,
        null,
        animate,
        () => {
            camera.positionUpdated(true);
            camera.targetUpdated(true);
        },
        {
            coverage: this.cameraFrameState.coverage,
            zoom: this.cameraFrameState.zoom,
            elevationDeg: this.cameraFrameState.elevationDeg,
            azimuthDeg: this.cameraFrameState.azimuthDeg
        }
    );
}
```

### 3.4 Add these public camera methods

Place them immediately after `fitView()` and before `resetView()`:

```typescript
public setCameraZoom(value: number): void {
    this.cameraFrameState.zoom = Math.max(0.70, Math.min(2.0, value));
    this.fitView(false);
}

public setCameraView(view: 'front' | 'threeQuarter' | 'left' | 'right' | 'top'): void {
    const presets = {
        front: { azimuthDeg: 0, elevationDeg: 18 },
        threeQuarter: { azimuthDeg: -25, elevationDeg: 30 },
        left: { azimuthDeg: -90, elevationDeg: 24 },
        right: { azimuthDeg: 90, elevationDeg: 24 },
        top: { azimuthDeg: 0, elevationDeg: 82 }
    } as const;

    const preset = presets[view];
    this.cameraFrameState.azimuthDeg = preset.azimuthDeg;
    this.cameraFrameState.elevationDeg = preset.elevationDeg;
    this.fitView(false);
}

public setCameraAngles(azimuthDeg: number, elevationDeg: number): void {
    this.cameraFrameState.azimuthDeg = azimuthDeg;
    this.cameraFrameState.elevationDeg = Math.max(8, Math.min(82, elevationDeg));
    this.fitView(false);
}
```

### 3.5 Replace `resetView()`

Find the current method that delegates to `this.dynamicLoader.resetView()` and replace with:

```typescript
public resetView(): void {
    this.cameraFrameState.zoom = 1.0;
    this.cameraFrameState.coverage = 0.78;
    this.cameraFrameState.azimuthDeg = -25;
    this.cameraFrameState.elevationDeg = 30;
    this.fitView(false);
}
```

This ensures Reset Camera uses the same current model bounds and does not jump to a hard-coded world coordinate.

---

# 4. Replace the fake LDR environment with a real HDR asset

## Asset to add

Download the **1K HDR** file from Poly Haven:

`https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr`

Save it to:

`rendering/assets/studio/studio_small_09_1k.hdr`

Source: Poly Haven “Studio Small 09”, an unclipped studio HDRI with large softboxes and a white infinity cyc, released under CC0. Add a small `rendering/assets/studio/CREDITS.md` containing the source URL, author (Sergej Majboroda), asset name and CC0 licence. The file must exist locally before the code is considered complete. Do not keep a network dependency at runtime.

## File: `rendering/src/studio/StudioEnvironment.ts`

**Replace the entire file** with:

```typescript
import { ViewerApp, AssetManagerPlugin, Color } from 'webgi';

const DEFAULT_HDR_PATH = '/assets/studio/studio_small_09_1k.hdr';

export class StudioEnvironment {
    private viewer: ViewerApp;
    private manager: AssetManagerPlugin;
    private texture: any | null = null;
    private intensity = 0.85;
    private backgroundHex = '#D7D8DA';

    constructor(viewer: ViewerApp, manager: AssetManagerPlugin) {
        this.viewer = viewer;
        this.manager = manager;
    }

    public async init(): Promise<void> {
        const importer = (this.manager as any).importer;
        if (!importer || typeof importer.importSinglePath !== 'function') {
            throw new Error('[StudioEnvironment] AssetManagerPlugin importer.importSinglePath is unavailable.');
        }

        const loadedTexture = await importer.importSinglePath(DEFAULT_HDR_PATH, {
            generateMipmaps: true
        });

        if (!loadedTexture) {
            throw new Error(`[StudioEnvironment] HDR environment failed to load: ${DEFAULT_HDR_PATH}`);
        }

        // WebGi 0.4.6 RootScene.setEnvironment expects an imported ITexture.
        // AssetImporter should set assetType itself; retain a compatibility guard.
        if (!(loadedTexture as any).assetType) {
            (loadedTexture as any).assetType = 'texture';
        }

        // EquirectangularReflectionMapping in the bundled Three.js/WebGi runtime.
        // Do not apply sRGB encoding to an HDR radiance texture.
        loadedTexture.mapping = 303;
        loadedTexture.needsUpdate = true;

        const scene = this.viewer.scene as any;
        if (typeof scene.setEnvironment === 'function') {
            await scene.setEnvironment(loadedTexture);
        } else {
            scene.environment = loadedTexture;
        }

        this.texture = loadedTexture;
        scene.environmentIntensity = this.intensity;
        this.setBackgroundColor(this.backgroundHex);
        scene.setDirty?.();
        this.viewer.renderer.reset();
    }

    public setBackgroundColor(hex: string): void {
        this.backgroundHex = hex;
        this.viewer.setBackground(new Color(hex).convertSRGBToLinear());
        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
    }

    public setIntensity(value: number): void {
        this.intensity = Math.max(0.1, Math.min(2.0, value));
        this.viewer.scene.environmentIntensity = this.intensity;
        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
    }

    public getIntensity(): number {
        return this.intensity;
    }

    public dispose(): void {
        const scene = this.viewer.scene as any;
        if (this.texture && scene?.environment === this.texture) {
            if (typeof scene.setEnvironment === 'function') {
                void scene.setEnvironment(null);
            } else {
                scene.environment = null;
            }
        }
        this.texture?.dispose?.();
        this.texture = null;
    }
}
```

**Compatibility gate:** WebGi's Asset Management documentation states that the default importer supports `.hdr` / `.hdr.png` and exposes `importSinglePath`. Still verify this against the installed `webgi@0.4.6` typings at build time. If the 0.4.6 importer requires a specific HDR loader plugin, add the exact dependency supported by that installed package; do not silently fall back to a CanvasTexture and call it HDR.

---

# 5. Pass AssetManagerPlugin into StudioWorld

## File: `rendering/src/studio/StudioWorld.ts`

### 5.1 Update the import

Replace:

```typescript
import { ViewerApp, Color } from 'webgi';
```

with:

```typescript
import { ViewerApp, AssetManagerPlugin, Color } from 'webgi';
import { STUDIO_WORLD_CONFIG } from './groundMath';
```

### 5.2 Add manager field and constructor argument

Replace the current viewer-only constructor with:

```typescript
private viewer: ViewerApp;
private manager: AssetManagerPlugin;

constructor(viewer: ViewerApp, manager: AssetManagerPlugin) {
    this.viewer = viewer;
    this.manager = manager;
}
```

Keep the existing `_floor`, `_lighting`, `_environment` and `initialized` fields.

### 5.3 Replace the floor/environment setup inside `init()`

Replace:

```typescript
this._floor = new StudioFloor(this.viewer);
this._floor.init(5.0, '#ffffff');

this._lighting = new StudioLighting(this.viewer);
this._lighting.init();

this._environment = new StudioEnvironment(this.viewer);
await this._environment.init();
```

with:

```typescript
this._floor = new StudioFloor(this.viewer);
this._floor.init(
    STUDIO_WORLD_CONFIG.floorSize,
    STUDIO_WORLD_CONFIG.floorColor
);

this._lighting = new StudioLighting(this.viewer);
this._lighting.init();

this._environment = new StudioEnvironment(this.viewer, this.manager);
await this._environment.init();
```

If environment loading fails, let initialization report the real failure visibly. Do not swallow the error and continue with an empty environment.

## File: `rendering/src/studio/ViewerHost.ts`

Find:

```typescript
const studioWorld = new StudioWorld(viewer);
```

Replace with:

```typescript
const studioWorld = new StudioWorld(viewer, manager);
```

No second viewer or renderer should be created.

---

# 6. Replace the 3-point light rig with a restrained shadow-capable rig

## File: `rendering/src/studio/StudioLighting.ts`

**Replace the entire file** with the following. It reuses the same WebGi `DirectionalLight` and `AmbientLight` classes already imported by the current implementation.

```typescript
import { ViewerApp, DirectionalLight, AmbientLight, Color } from 'webgi';

export class StudioLighting {
    private viewer: ViewerApp;
    private keyLight: any | null = null;
    private fillLight: any | null = null;
    private rimLight: any | null = null;
    private ambientLight: any | null = null;
    private intensityMultiplier = 1.0;

    constructor(viewer: ViewerApp) {
        this.viewer = viewer;
    }

    public init(): void {
        if (this.keyLight) return;

        const scene = this.viewer.scene as any;
        const targetContainer = scene.modelRoot || scene;
        const rendererObject = (this.viewer.renderer as any).rendererObject;

        // Enable the renderer's native shadow map when exposed by this WebGi build.
        if (rendererObject?.shadowMap) {
            rendererObject.shadowMap.enabled = true;
            rendererObject.shadowMap.autoUpdate = true;
        }

        // KEY: one directional light casts actual product shadows.
        this.keyLight = new DirectionalLight(
            new Color('#FFF8EE').convertSRGBToLinear(),
            1.25
        );
        this.keyLight.name = 'StudioKeyLight';
        this.keyLight.position.set(3.0, 5.0, 3.5);
        this.keyLight.castShadow = true;
        this.keyLight.userData = { isStudioEnvironment: true, isStudioLight: true };
        targetContainer.add(this.keyLight);

        // Three.js directional-light targets must be in the scene graph to update correctly.
        if (this.keyLight.target && !this.keyLight.target.parent) {
            targetContainer.add(this.keyLight.target);
        }
        this.keyLight.target.position.set(0, 0.8, 0);
        this.keyLight.target.updateMatrixWorld?.(true);

        const shadow = this.keyLight.shadow;
        if (shadow?.mapSize?.set) shadow.mapSize.set(2048, 2048);
        if (shadow?.camera) {
            shadow.camera.left = -3.5;
            shadow.camera.right = 3.5;
            shadow.camera.top = 3.5;
            shadow.camera.bottom = -3.5;
            shadow.camera.near = 0.1;
            shadow.camera.far = 12;
            shadow.camera.updateProjectionMatrix?.();
        }
        if (shadow) {
            shadow.bias = -0.00015;
            shadow.normalBias = 0.02;
            shadow.radius = 2;
        }

        // FILL: prevents the shadowed side from becoming black; it does not cast shadows.
        this.fillLight = new DirectionalLight(
            new Color('#DDE7F4').convertSRGBToLinear(),
            0.35
        );
        this.fillLight.name = 'StudioFillLight';
        this.fillLight.position.set(-3.5, 2.5, 2.0);
        this.fillLight.castShadow = false;
        this.fillLight.userData = { isStudioEnvironment: true, isStudioLight: true };
        targetContainer.add(this.fillLight);
        if (this.fillLight.target && !this.fillLight.target.parent) {
            targetContainer.add(this.fillLight.target);
        }
        this.fillLight.target.position.set(0, 0.8, 0);
        this.fillLight.target.updateMatrixWorld?.(true);

        // RIM: subtle edge separation; reflections should primarily come from the HDR environment.
        this.rimLight = new DirectionalLight(
            new Color('#FFFFFF').convertSRGBToLinear(),
            0.65
        );
        this.rimLight.name = 'StudioRimLight';
        this.rimLight.position.set(0, 4.5, -3.5);
        this.rimLight.castShadow = false;
        this.rimLight.userData = { isStudioEnvironment: true, isStudioLight: true };
        targetContainer.add(this.rimLight);
        if (this.rimLight.target && !this.rimLight.target.parent) {
            targetContainer.add(this.rimLight.target);
        }
        this.rimLight.target.position.set(0, 0.8, 0);
        this.rimLight.target.updateMatrixWorld?.(true);

        this.ambientLight = new AmbientLight(
            new Color('#FFFFFF').convertSRGBToLinear(),
            0.16
        );
        this.ambientLight.name = 'StudioAmbientLight';
        this.ambientLight.userData = { isStudioEnvironment: true, isStudioLight: true };
        targetContainer.add(this.ambientLight);

        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();

        if (!rendererObject?.shadowMap) {
            console.warn('[StudioLighting] Native renderer shadowMap is unavailable in this WebGi runtime. Verify supported shadow plugins before claiming object shadows are enabled.');
        }
    }

    public setIntensity(multiplier: number): void {
        this.intensityMultiplier = Math.max(0.1, Math.min(2.0, multiplier));
        if (this.keyLight) this.keyLight.intensity = 1.25 * this.intensityMultiplier;
        if (this.fillLight) this.fillLight.intensity = 0.35 * this.intensityMultiplier;
        if (this.rimLight) this.rimLight.intensity = 0.65 * this.intensityMultiplier;
        if (this.ambientLight) this.ambientLight.intensity = 0.16 * this.intensityMultiplier;
        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
    }

    public dispose(): void {
        for (const light of [this.keyLight, this.fillLight, this.rimLight]) {
            light?.target?.removeFromParent?.();
            light?.removeFromParent?.();
        }
        this.ambientLight?.removeFromParent?.();
        this.keyLight = null;
        this.fillLight = null;
        this.rimLight = null;
        this.ambientLight = null;
    }
}
```

**Shadow verification requirement:** `castShadow = true` is only configuration. The browser test must confirm that the installed WebGi 0.4.6 render pipeline actually draws the shadow map. If not, use the shadow feature supported by the installed package and report the dependency. Do not claim success based on the property value alone.

---

# 7. Update the visible platform and ensure it receives shadows

## File: `rendering/src/studio/StudioFloor.ts`

The current file already creates a real `PlaneGeometry` and is the correct basic approach. Do not replace it with CSS, a 2D trapezoid, a box pedestal or another renderer.

Make these exact changes:

### 7.1 Defaults

Replace:

```typescript
private size: number = 5.0;
private color: string = '#ffffff';
private roughness: number = 0.88;
```

with:

```typescript
private size: number = 4.5;
private geometryBaseSize: number = 4.5;
private color: string = '#E9E9E7';
private roughness: number = 0.90;
```

### 7.2 Init defaults

Replace:

```typescript
public init(size = 5.0, color = '#ffffff'): void {
```

with:

```typescript
public init(size = 4.5, color = '#E9E9E7'): void {
```

Immediately after `this.size = size;`, add:

```typescript
this.geometryBaseSize = size;
```

### 7.3 Receive real key-light shadows

Immediately after the floor mesh is created and named, add:

```typescript
this.mesh.castShadow = false;
this.mesh.receiveShadow = true;
```

### 7.4 Fix `setSize()` so repeated calls do not accumulate scale

Replace the current `setSize()` method with:

```typescript
public setSize(size: number): void {
    const nextSize = Math.max(3.0, Math.min(12.0, size));
    this.size = nextSize;

    if (this.mesh) {
        const ratio = nextSize / this.geometryBaseSize;
        this.mesh.scale.set(ratio, ratio, 1);
        this.mesh.updateMatrixWorld?.(true);
        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
    }
}
```

The plane is created in local XY and rotated by `-Math.PI / 2`; local X/Y map to world X/Z. The scale therefore changes local X/Y, not world Y.

Keep the floor fixed at world `(0, 0, 0)`. Do not move it to the product's bounding-box minimum.

---

# 8. Set imported product meshes to cast and receive shadows

## File: `rendering/src/cad/DynamicCadLoader.ts`

Inside `loadModel()`, after the final model orientation, normalization, horizontal centering and floor-Y alignment have completed, and before `ComponentDiscovery.discoverComponents(...)`, add this block:

```typescript
// Enable native object shadow participation for product meshes.
// Studio helpers/floor/contact-shadow receivers are deliberately excluded.
this.currentModelRoot.traverse((child: any) => {
    if (!child.isMesh || !child.visible || isHelperMesh(child.name, child)) return;
    child.castShadow = true;
    child.receiveShadow = true;
});
```

Do not apply this to the StudioFloor or ContactShadowGroundPlugin receiver.

---

# 9. Stop manually overwriting the WebGi contact-shadow mesh scale

## File: `rendering/src/cad/DynamicCadLoader.ts`

In `alignGround()`, find this block:

```typescript
const groundMesh = ground._mesh || ground.mesh?.modelObject;
if (groundMesh) {
    const contactY = Math.max(0, box.min.y) + 0.0002;
    groundMesh.position.set(0, contactY, 0);
    groundMesh.rotation.set(-Math.PI / 2, 0, 0);
    groundMesh.scale.set(GROUND_SIZE, -GROUND_SIZE, GROUND_SIZE);
    if (groundMesh.material) {
        const mat = (groundMesh.material as any).materialObject || groundMesh.material;
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = -1.0;
        mat.polygonOffsetUnits = -1.0;
        mat.roughness = 1.0;
        mat.metalness = 0.0;
        if (mat.userData) {
            mat.userData.ssreflDisabled = true;
            mat.userData.ssreflNonPhysical = true;
        }
    }
    groundMesh.updateMatrixWorld?.(true);
}
```

Replace with:

```typescript
const groundMesh = ground._mesh || ground.mesh?.modelObject;
if (groundMesh) {
    // Product has already been grounded at Y=0. Keep the WebGi contact receiver
    // just above the fixed studio floor. Do NOT overwrite its scale: the installed
    // ContactShadowGroundPlugin owns its internal mesh transform through `size`.
    groundMesh.position.set(0, 0.0002, 0);
    // Keep the known horizontal orientation from the current working scene.
    groundMesh.rotation.set(-Math.PI / 2, 0, 0);

    if (groundMesh.material) {
        const mat = (groundMesh.material as any).materialObject || groundMesh.material;
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = -1.0;
        mat.polygonOffsetUnits = -1.0;
        mat.roughness = 1.0;
        mat.metalness = 0.0;
        if (mat.userData) {
            mat.userData.ssreflDisabled = true;
            mat.userData.ssreflNonPhysical = true;
        }
    }
    groundMesh.updateMatrixWorld?.(true);
}
```

Keep:

```typescript
ground.size = GROUND_SIZE;
ground.shadowScale = groundShadowScale(GROUND_SIZE, r);
ground.shadowHeight = groundShadowHeight(r);
```

and keep `ground.refreshOptions()`.

The current code explicitly sets all three scale axes to `GROUND_SIZE` even though the plugin's own transform routine manages its mesh scale. Verify the result after removing that manual override. The existing code already uses this horizontal rotation and the current contact-shadow screenshot is visible, so preserve it unless inspection of the installed 0.4.6 plugin proves its own transform resets that rotation.

---

# 10. Separate visible floor visibility from contact-shadow visibility

## File: `rendering/src/ui/StudioSettings.ts`

The current `setGroundVisible()` toggles both the WebGi plugin ground and the visible floor. These are independent scene layers.

### 10.1 Replace `setGroundVisible()` with:

```typescript
public setGroundVisible(visible: boolean): void {
    this.config.groundVisible = visible;
    this.studioFloor?.setVisible(visible);
    this.viewer.scene.setDirty();
    this.viewer.renderer.reset();
    this.saveSettings();
}
```

### 10.2 In `configureGroundAppearance()`

Find:

```typescript
ground.visible = this.config.groundVisible && this.config.groundShadows;
ground.contactShadows = this.config.groundShadows;
```

Replace with:

```typescript
ground.visible = this.config.groundShadows;
ground.contactShadows = this.config.groundShadows;
```

The floor is controlled by `studioFloor.setVisible()`, not by the contact-shadow plugin.

### 10.3 In `setGroundShadows()`

After obtaining `ground`, set:

```typescript
ground.visible = enabled;
```

Keep shadow opacity at zero when disabled, keep SSR disabled on the contact-shadow receiver, and preserve the existing `ground.refreshOptions()` / renderer reset calls.

---

# 11. Add usable camera zoom and view controls to the Inspector

The `ViewerHost` now exposes:

```typescript
host.setCameraZoom(zoom); // 0.70 to 2.0
host.setCameraView('front');
host.setCameraView('threeQuarter');
host.setCameraView('left');
host.setCameraView('right');
host.setCameraView('top');
host.setCameraAngles(azimuthDeg, elevationDeg);
host.fitView(true);
host.resetView();
```

In the existing right-side Camera panel, add a real Camera Zoom slider and view buttons. Use this integration pattern (adapt the variable names to the existing React component; do not create another ViewerHost instance):

```tsx
const [cameraZoom, setCameraZoom] = useState(1.0);

<label htmlFor="camera-zoom">Camera Zoom</label>
<input
    id="camera-zoom"
    type="range"
    min={0.70}
    max={2.0}
    step={0.05}
    value={cameraZoom}
    onChange={(event) => {
        const next = Number(event.currentTarget.value);
        setCameraZoom(next);
        ViewerHost.getInstance().setCameraZoom(next);
    }}
/>
<span>{cameraZoom.toFixed(2)}×</span>

<div className="camera-view-presets">
    <button type="button" onClick={() => ViewerHost.getInstance().setCameraView('front')}>Front</button>
    <button type="button" onClick={() => ViewerHost.getInstance().setCameraView('threeQuarter')}>3/4</button>
    <button type="button" onClick={() => ViewerHost.getInstance().setCameraView('left')}>Left</button>
    <button type="button" onClick={() => ViewerHost.getInstance().setCameraView('right')}>Right</button>
    <button type="button" onClick={() => ViewerHost.getInstance().setCameraView('top')}>Top</button>
</div>
```

Also make the existing Frame Product button call `ViewerHost.getInstance().fitView(true)` and Reset Camera call `resetView()`.

**Do not use `displayCanvasScaling` as zoom.** That setting changes render resolution. The camera zoom method changes camera distance while preserving the current viewing direction.

The source dump did not include the current `RightInspector.tsx` JSX. Locate the actual component and insert these controls in its existing Camera section. Preserve its styles and component structure.

---

# 12. Do not change these yet

Until the HDR + camera + shadow changes are visibly validated, do not rewrite:

- `MaterialRoleBinder.ts` metal and diamond application algorithms.
- The DiamondPlugin integration.
- The CAD-to-GLB converter.
- The component manifest schema.
- The SSR / SSAO / Bloom pipeline order.

The current metal presets are reasonable starting PBR values; the biggest immediate gap is the environment and lighting. Tuning roughness before fixing the environment creates rework.

After HDR is loaded, compare the same model under the same camera using 18K Yellow Gold, White Gold and Platinum. Only then change material values based on screenshots.

---

# 13. Required verification — no source-string-only tests

Run the app at the existing Vite dev port and verify in a real headed browser with WebGL enabled.

## Test A — Same earring model as the iJewel reference

1. Load the same converted earring pair shown in the iJewel screenshot.
2. Capture Front, Left, Right and 3/4 views.
3. Choose the view that exposes the front diamond rows instead of showing the earrings edge-on.
4. Keep that angle as the initial camera preset for this model or record its front azimuth in model metadata.
5. Set the zoom so the model fills about 45–55% of the vertical central viewport, without clipping the product.
6. Keep the 4.5-unit stage visible with a clear rear edge and enough foreground.

## Test B — Ring

Load the solitaire ring and capture the same 3/4 view as the iJewel reference. The ring should be larger than the current local screenshot, with the center stone and metal band clearly visible.

## Test C — Real HDR verification

Use a chrome sphere and the imported HDR environment. Rotate the environment (if the API supports it) or load another HDR preset. The highlight pattern on the chrome sphere must visibly change. Confirm there is an actual `.hdr` file loaded and no `Unknown Environment type` console error.

## Test D — Shadow verification

- Key light casts a visible directional shadow from a small test object onto the floor.
- Product mesh `castShadow` is true.
- Floor `receiveShadow` is true.
- Contact shadow is independently toggleable.
- Turning off contact shadows does not hide the visible square floor.
- No giant transparent plane or SSR mirror is visible.

## Test E — Material verification

Compare the same metal component under the old and new environment. Look for reflected light bands, dark reflected regions and no blown-out white areas. Confirm diamond facets remain defined and bloom is restrained.

## Test F — lifecycle

Load five products sequentially. No duplicate floor, HDR environment, lights, contact-shadow receiver, or leaked old model.

## Commands

```bash
cd rendering
npm run typecheck
npm test
npm run build
```

Also run server tests only if backend files were touched. Preserve all existing tests. Add runtime/browser checks where possible; string-presence assertions alone are not acceptance tests.

---

# 14. Definition of done

Do not report visual completion unless the browser screenshots show:

- The same earring pair in a front-facing view comparable to the iJewel reference.
- Jewelry substantially larger in the viewport than the current local screenshot.
- A compact finite square stage that remains visible but does not dominate.
- A real CC0 HDR environment loaded through WebGi's asset importer.
- Gold and silver with bright and dark environmental reflections.
- At least one verified cast shadow from the key light, plus the separate soft contact shadow.
- Camera zoom, pan, rotate and view presets working from the UI.
- No critical console errors.

Save these screenshots:

- `artifacts/studio-front-earrings.png`
- `artifacts/studio-three-quarter-ring.png`
- `artifacts/studio-metal-comparison.png`
- `artifacts/studio-shadow-test.png`

Do not overwrite user work, reset git, or commit unless asked. Report the exact files changed, checks run, screenshot locations and any WebGi 0.4.6 limitations.

---

# 15. How close is the current project to iJewel3D?

This is a subjective assessment from the supplied screenshots and code, not a benchmark:

- **Core technical foundation:** approximately 65–75%. The project already has WebGi, a CAD import/normalization path, material-role binding, DiamondPlugin integration, a persistent visible floor and a working playground shell.
- **Current visual match:** approximately 30–40%. The local screenshot still has a smaller/edge-on product presentation, weaker environment reflections, no demonstrated object cast shadows and a less controlled camera composition.
- **Overall practical product maturity relative to iJewel3D:** approximately 35–45%. iJewel also has a curated jewelry-specific environment/material asset library and more polished editing/export workflows that are not proven present in this project.

These percentages are deliberately rough. The most important thing is that the gap is now concentrated in visual presentation and specialist rendering behavior, not in needing to replace the whole engine.

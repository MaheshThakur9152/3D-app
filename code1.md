# Complete 3D Jewelry Studio Source Code (`code1.md`)

This file contains the complete, unabridged source code for all modules of the updated 3D Jewelry Studio, including the real HDR environment loader, camera controls, and updated shadow and floor configurations.

1. **3D World Stage Orchestrator**: `StudioWorld.ts`
2. **3D Plane / Platform**: `StudioFloor.ts`
3. **Ground & Shadow Pure Math**: `groundMath.ts`
4. **Real CC0 HDR Studio Environment**: `StudioEnvironment.ts`
5. **Physical 3-Point Studio Lighting Rig with Shadow Mapping**: `StudioLighting.ts`
6. **Shadow & Studio Settings**: `StudioSettings.ts`
7. **Camera Framing with Zoom & Elevation**: `CameraFraming.ts`
8. **Metal & Diamond Shaders**: `MaterialRoleBinder.ts`
9. **WebGi Engine Lifecycle & Viewport Host**: `ViewerHost.ts`
10. **CAD Model Normalization, Grounding & Object Shadows**: `DynamicCadLoader.ts`
11. **Inspector UI with Real Zoom & View Presets**: `RightInspector.tsx`

---

## 1. 3D World Stage Orchestrator (`StudioWorld.ts`)

**Path:** `rendering/src/studio/StudioWorld.ts`

```typescript
/**
 * StudioWorld.ts
 * Manages the persistent 3D jewelry studio environment:
 * - StudioFloor: Finite square studio ground plane at Y = 0.
 * - StudioLighting: Calibrated 3-point studio lighting rig.
 * - StudioEnvironment: Real CC0 HDR studio environment.
 */

import { ViewerApp, AssetManagerPlugin, Color } from "webgi";
import { STUDIO_WORLD_CONFIG } from "./groundMath";
import { StudioFloor } from "./StudioFloor";
import { StudioLighting } from "./StudioLighting";
import { StudioEnvironment } from "./StudioEnvironment";

export class StudioWorld {
    private viewer: ViewerApp;
    private manager: AssetManagerPlugin;
    private _floor: StudioFloor | null = null;
    private _lighting: StudioLighting | null = null;
    private _environment: StudioEnvironment | null = null;
    private initialized = false;

    constructor(viewer: ViewerApp, manager: AssetManagerPlugin) {
        this.viewer = viewer;
        this.manager = manager;
    }

    public async init(presetId = 'white'): Promise<void> {
        if (this.initialized) return;

        // 1. Create finite square studio floor at world origin Y = 0
        this._floor = new StudioFloor(this.viewer);
        this._floor.init(
            STUDIO_WORLD_CONFIG.floorSize,
            STUDIO_WORLD_CONFIG.floorColor
        );

        // 2. Setup shadow-capable 3-point studio lighting rig
        this._lighting = new StudioLighting(this.viewer);
        this._lighting.init();

        // 3. Create real HDR studio environment
        this._environment = new StudioEnvironment(this.viewer, this.manager);
        await this._environment.init();

        this.initialized = true;
    }

    public get floor(): StudioFloor | null {
        return this._floor;
    }

    public get lighting(): StudioLighting | null {
        return this._lighting;
    }

    public get environment(): StudioEnvironment | null {
        return this._environment;
    }

    public setEnvironmentPreset(presetId: string): void {
        const bgColors: Record<string, string> = {
            white: '#ebebf0',
            neutral: '#f5f5f7',
            warm: '#faf7f2',
            pink: '#eeb7b5',
            dark: '#1c1324'
        };

        const hex = bgColors[presetId] || bgColors.white;
        this.setBackgroundColor(hex);

        if (presetId === 'dark') {
            this._floor?.setColor('#2a2335');
            this._floor?.setRoughness(0.65);
            this._lighting?.setIntensity(0.7);
            this._environment?.setIntensity(0.75);
        } else if (presetId === 'warm') {
            this._floor?.setColor('#faf7f2');
            this._floor?.setRoughness(0.85);
            this._lighting?.setIntensity(1.0);
            this._environment?.setIntensity(1.0);
        } else if (presetId === 'pink') {
            this._floor?.setColor('#f4d2d0');
            this._floor?.setRoughness(0.85);
            this._lighting?.setIntensity(1.0);
            this._environment?.setIntensity(1.0);
        } else {
            this._floor?.setColor('#E9E9E7');
            this._floor?.setRoughness(0.90);
            this._lighting?.setIntensity(1.0);
            this._environment?.setIntensity(0.85);
        }

        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
    }

    public setBackgroundColor(hex: string): void {
        const bgColor = new Color(hex).convertSRGBToLinear();
        this.viewer.setBackground(bgColor);
        this._environment?.setBackgroundColor(hex);
        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
    }

    public setFloorColor(hex: string): void {
        this._floor?.setColor(hex);
        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
    }

    public setFloorRoughness(roughness: number): void {
        this._floor?.setRoughness(roughness);
        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
    }

    public setFloorVisible(visible: boolean): void {
        this._floor?.setVisible(visible);
        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
    }

    public setFloorSize(size: number): void {
        this._floor?.setSize(size);
        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
    }

    public setEnvironmentIntensity(val: number): void {
        this._environment?.setIntensity(val);
        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
    }

    public setLightingIntensity(val: number): void {
        this._lighting?.setIntensity(val);
        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
    }

    public dispose(): void {
        this._floor?.dispose();
        this._lighting?.dispose();
        this._environment?.dispose();
        this._floor = null;
        this._lighting = null;
        this._environment = null;
        this.initialized = false;
    }
}
```

---

## 2. 3D Plane / Platform (`StudioFloor.ts`)

**Path:** `rendering/src/studio/StudioFloor.ts`

```typescript
/**
 * StudioFloor.ts
 * Finite, visible square 3D studio floor.
 * Persistent world object: fixed at (0, 0, 0) on the horizontal XZ plane at Y = 0.
 * Independent of imported model lifecycle and position.
 */

import { ViewerApp, Mesh, PlaneGeometry, MeshStandardMaterial2, Color } from "webgi";
import { STUDIO_WORLD_CONFIG } from "./groundMath";

export class StudioFloor {
    private viewer: ViewerApp;
    private floorMesh: Mesh | null = null;
    private visible = true;
    private size: number = STUDIO_WORLD_CONFIG.floorSize;
    private geometryBaseSize: number = STUDIO_WORLD_CONFIG.floorSize;
    private color: string = STUDIO_WORLD_CONFIG.floorColor;
    private roughness: number = STUDIO_WORLD_CONFIG.floorRoughness;
    private metalness: number = STUDIO_WORLD_CONFIG.floorMetalness;

    constructor(viewer: ViewerApp) {
        this.viewer = viewer;
    }

    public init(size = 4.5, color = '#E9E9E7'): void {
        this.size = size;
        this.geometryBaseSize = size;
        this.color = color;
        this.mount();
    }

    public mount(): void {
        if (this.floorMesh) return;

        const geometry = new PlaneGeometry(this.geometryBaseSize, this.geometryBaseSize, 1, 1);
        const material = new MeshStandardMaterial2({
            color: new Color(this.color).convertSRGBToLinear(),
            roughness: this.roughness,
            metalness: this.metalness,
            depthWrite: true,
            depthTest: true
        });

        // Visible from all perspective viewing angles
        material.side = 2; // DoubleSide

        // Depth bias pushes floor backwards in depth buffer to prevent z-fighting with contact-shadow overlay
        material.polygonOffset = true;
        material.polygonOffsetFactor = 1.0;
        material.polygonOffsetUnits = 1.0;

        const mesh = new Mesh(geometry, material);
        mesh.name = 'Studio_Floor_Mesh';
        (mesh as any).isGroundMesh = true;
        mesh.userData = {
            isGround: true,
            isStudioFloor: true,
            isStudioEnvironment: true
        };

        // Floor lies flat on horizontal XZ plane at fixed height Y = 0
        mesh.rotation.set(-Math.PI / 2, 0, 0);
        mesh.position.set(0, STUDIO_WORLD_CONFIG.floorY, 0);
        mesh.castShadow = false;
        mesh.receiveShadow = true;

        const sceneTarget = (this.viewer.scene as any)?.modelRoot || this.viewer.scene;
        sceneTarget.add(mesh);
        this.floorMesh = mesh;
    }

    public setVisible(visible: boolean): void {
        this.visible = visible;
        if (this.floorMesh) {
            this.floorMesh.visible = visible;
            this.viewer.scene.setDirty();
            this.viewer.renderer.reset();
        }
    }

    public isVisible(): boolean {
        return this.visible;
    }

    public setColor(hex: string): void {
        this.color = hex;
        if (this.floorMesh && this.floorMesh.material) {
            const mat = (this.floorMesh.material as any).materialObject || this.floorMesh.material;
            if (mat && mat.color) {
                mat.color.copy(new Color(hex).convertSRGBToLinear());
                mat.needsUpdate = true;
                this.viewer.scene.setDirty();
                this.viewer.renderer.reset();
            }
        }
    }

    public setRoughness(roughness: number): void {
        this.roughness = Math.max(0, Math.min(1, roughness));
        if (this.floorMesh && this.floorMesh.material) {
            const mat = (this.floorMesh.material as any).materialObject || this.floorMesh.material;
            if (mat) {
                mat.roughness = this.roughness;
                mat.needsUpdate = true;
                this.viewer.scene.setDirty();
                this.viewer.renderer.reset();
            }
        }
    }

    public setSize(size: number): void {
        const nextSize = Math.max(3.0, Math.min(12.0, size));
        this.size = nextSize;

        if (this.floorMesh) {
            const ratio = nextSize / this.geometryBaseSize;
            this.floorMesh.scale.set(ratio, ratio, 1);
            this.floorMesh.updateMatrixWorld?.(true);
            this.viewer.scene.setDirty();
            this.viewer.renderer.reset();
        }
    }

    public getSize(): number {
        return this.size;
    }

    public getMesh(): Mesh | null {
        return this.floorMesh;
    }

    public dispose(): void {
        if (!this.floorMesh) return;
        this.floorMesh.removeFromParent();
        if (this.floorMesh.geometry) this.floorMesh.geometry.dispose();
        if (this.floorMesh.material) {
            const mat = (this.floorMesh.material as any).materialObject || this.floorMesh.material;
            mat.dispose?.();
        }
        this.floorMesh = null;
    }
}
```

---

## 3. Ground & Shadow Pure Math (`groundMath.ts`)

**Path:** `rendering/src/studio/groundMath.ts`

```typescript
/**
 * groundMath.ts
 * Pure ground/contact-shadow policy shared by DynamicCadLoader, StudioFloor and StudioSettings.
 * No WebGi imports so it stays testable under plain node.
 */

// Plane extent for contact shadow blur/vignette canvas.
export const GROUND_SIZE = 120;

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

export function isHelperMesh(
    name: string | undefined,
    obj: { isGroundMesh?: boolean; userData?: { isGround?: boolean; isStudioEnvironment?: boolean } }
): boolean {
    return /ground|floor|helper|grid|axis|shadow|gizmo|baker/i.test(name || '') ||
        !!obj.isGroundMesh ||
        !!obj.userData?.isGround ||
        !!obj.userData?.isStudioEnvironment;
}

// ContactShadowGroundPlugin depth map spans size / shadowScale (fixed 512px).
// Fit it to the jewelry so the contact area gets real resolution.
export function groundShadowScale(size: number, radius: number): number {
    const halfFrustum = Math.max(0.5, radius) * 2.5;
    return size / (2 * halfFrustum);
}

export function groundShadowHeight(radius: number): number {
    return Math.max(3.5, radius * 3.0);
}

export function studioFloorSize(radius: number): number {
    return (radius && radius > 2.5) ? radius * 2.0 : STUDIO_FLOOR_SIZE;
}
```

---

## 4. Real CC0 HDR Studio Environment (`StudioEnvironment.ts`)

**Path:** `rendering/src/studio/StudioEnvironment.ts`

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

---

## 5. Physical 3-Point Lighting Rig with Shadow Mapping (`StudioLighting.ts`)

**Path:** `rendering/src/studio/StudioLighting.ts`

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

---

## 6. Shadow & Studio Settings (`StudioSettings.ts`)

**Path:** `rendering/src/ui/StudioSettings.ts`

```typescript
/**
 * StudioSettings.ts
 * Manages studio background presets, GroundPlugin contact shadows,
 * reflections, environment lighting intensity and rotation with localStorage persistence.
 */

import { ViewerApp, Color, GroundPlugin, ContactShadowGroundPlugin } from "webgi";
import type { StudioFloor } from "../studio/StudioFloor";

export interface StudioPreset {
    id: string;
    name: string;
    hex: string;
    description: string;
}

export const STUDIO_PRESETS: Record<string, StudioPreset> = {
    white: {
        id: 'white',
        name: 'Pure White',
        hex: '#ebebf0',
        description: 'Clean high-key commercial jewelry catalog'
    },
    neutral: {
        id: 'neutral',
        name: 'Studio Neutral',
        hex: '#f5f5f7',
        description: 'Soft neutral grey backdrop'
    },
    warm: {
        id: 'warm',
        name: 'Warm Ivory',
        hex: '#faf7f2',
        description: 'Warm, soft natural studio glow'
    },
    pink: {
        id: 'pink',
        name: 'Blush Pink',
        hex: '#eeb7b5',
        description: 'Signature romantic luxury boutique atmosphere'
    },
    dark: {
        id: 'dark',
        name: 'Velvet Dark',
        hex: '#1c1324',
        description: 'Dramatic high-contrast diamond scintillation'
    }
};

export interface StudioConfig {
    presetId: string;
    customColor?: string;
    groundVisible: boolean;
    groundShadows: boolean;
    shadowIntensity: number; // 0.0 - 1.0 (shadow darkness / opacity)
    shadowSoftness: number;  // 0.5 - 5.0 (contact blur radius)
    shadowQuality: 'performance' | 'balanced' | 'high';
    groundReflections: boolean;
    envRotationDeg: number;
    envIntensity: number;
}

const STORAGE_KEY = 'mahesh3d_studio_config';

export class StudioSettings {
    private viewer: ViewerApp;
    private studioFloor: StudioFloor | null = null;
    private config: StudioConfig = {
        presetId: 'white', // Default clean white catalog studio
        groundVisible: true,
        groundShadows: true,
        shadowIntensity: 0.75,
        shadowSoftness: 2.2,
        shadowQuality: 'balanced',
        groundReflections: true,
        envRotationDeg: 0,
        envIntensity: 1.0
    };

    constructor(viewer: ViewerApp) {
        this.viewer = viewer;
        this.loadSettings();
    }

    private loadSettings(): void {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                this.config = { ...this.config, ...JSON.parse(saved) };
            }
        } catch {
            // Safe fallback
        }
    }

    private saveSettings(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
        } catch {
            // Safe fallback
        }
    }

    public applyPreset(presetId: string): void {
        const preset = STUDIO_PRESETS[presetId] || STUDIO_PRESETS.white;
        this.config.presetId = preset.id;
        delete this.config.customColor;
        this.applyBackgroundColor(preset.hex);
        this.configureGroundAppearance();
        this.saveSettings();
    }

    public setCustomColor(hex: string): void {
        this.config.presetId = 'custom';
        this.config.customColor = hex;
        this.applyBackgroundColor(hex);
        this.configureGroundAppearance();
        this.saveSettings();
    }

    private applyBackgroundColor(hex: string): void {
        const bgColor = new Color(hex).convertSRGBToLinear();
        this.viewer.setBackground(bgColor);
        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
    }

    private getGround(): any {
        return (this.viewer.getPlugin(ContactShadowGroundPlugin as any) || this.viewer.getPlugin(GroundPlugin)) as any;
    }

    public configureGroundAppearance(): void {
        const ground = this.getGround();
        if (!ground) return;

        // Owns appearance/options only. Transform is DynamicCadLoader.alignGround's job.
        // autoAdjustTransform=false stops WebGi repositioning the plane onto scene bounds.
        ground.setOptions({ autoAdjustTransform: false });

        // Do not touch material.color: WebGi ContactShadowGroundPlugin uses its dark tint (0x111111)
        // with the depth alphaMap as shadow. Overwriting it with the backdrop colour erases the shadow.
        const groundMesh = ground._mesh || ground.mesh?.modelObject || ground.mesh;
        const mat = ground.material || (groundMesh && groundMesh.material);
        if (mat) {
            const matObj = (mat as any).materialObject || mat;
            // Contact shadow is strictly an alpha-vignette shadow overlay - never an SSR mirror
            matObj.roughness = 1.0;
            matObj.metalness = 0.0;
            if (this.config.groundShadows) {
                matObj.opacity = this.config.shadowIntensity;
            } else {
                matObj.opacity = 0.0;
            }
            if (matObj.userData) {
                matObj.userData.ssreflDisabled = true;
                matObj.userData.ssreflNonPhysical = true;
            }
            matObj.needsUpdate = true;
        }

        ground.tonemapGround = true;
        ground.visible = this.config.groundShadows;
        ground.contactShadows = this.config.groundShadows;
        ground.groundReflection = false;
        if ('blurAmount' in ground) {
            ground.blurAmount = this.config.shadowSoftness;
        }

        ground.refreshOptions();
        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
    }

    public setStudioFloor(floor: StudioFloor): void {
        this.studioFloor = floor;
    }

    public setGroundVisible(visible: boolean): void {
        this.config.groundVisible = visible;
        this.studioFloor?.setVisible(visible);
        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
        this.saveSettings();
    }

    public setGroundShadows(enabled: boolean): void {
        this.config.groundShadows = enabled;
        const ground = this.getGround();
        if (ground) {
            ground.visible = enabled;
            ground.contactShadows = enabled;
            const groundMesh = ground._mesh || ground.mesh?.modelObject || ground.mesh;
            const mat = ground.material || (groundMesh && groundMesh.material);
            if (mat) {
                const matObj = (mat as any).materialObject || mat;
                matObj.opacity = enabled ? this.config.shadowIntensity : 0.0;
                matObj.needsUpdate = true;
            }
            ground.refreshOptions();
            this.viewer.scene.setDirty();
            this.viewer.renderer.reset();
        }
        this.saveSettings();
    }

    public setShadowIntensity(val: number): void {
        this.config.shadowIntensity = Math.max(0, Math.min(1, val));
        const ground = this.getGround();
        if (ground) {
            const groundMesh = ground._mesh || ground.mesh?.modelObject || ground.mesh;
            const mat = ground.material || (groundMesh && groundMesh.material);
            if (mat) {
                const matObj = (mat as any).materialObject || mat;
                if (this.config.groundShadows) {
                    matObj.opacity = this.config.shadowIntensity;
                }
                matObj.needsUpdate = true;
            }
            this.viewer.scene.setDirty();
            this.viewer.renderer.reset();
        }
        this.saveSettings();
    }

    public setShadowSoftness(val: number): void {
        this.config.shadowSoftness = Math.max(0.5, Math.min(8, val));
        const ground = this.getGround();
        if (ground) {
            if ('blurAmount' in ground) {
                ground.blurAmount = this.config.shadowSoftness;
            }
            ground.refreshOptions();
            this.viewer.scene.setDirty();
            this.viewer.renderer.reset();
        }
        this.saveSettings();
    }

    public setShadowQuality(quality: 'performance' | 'balanced' | 'high'): void {
        // shortcut: no quality lever in WebGi 0.4.6 ContactShadowGroundPlugin (fixed 512px depth map); stored for UI only, drop control or add lever when WebGi exposes one.
        this.config.shadowQuality = quality;
        this.saveSettings();
    }

    public setGroundReflections(enabled: boolean): void {
        this.config.groundReflections = enabled;
        const ground = this.getGround();
        if (ground) {
            ground.groundReflection = enabled;
            const groundMesh = ground._mesh || ground.mesh?.modelObject || ground.mesh;
            const mat = ground.material || (groundMesh && groundMesh.material);
            if (mat) {
                const matObj = (mat as any).materialObject || mat;
                matObj.roughness = enabled ? 0.25 : 0.65;
                if (matObj.userData) {
                    matObj.userData.ssreflDisabled = !enabled;
                    matObj.userData.ssreflNonPhysical = !enabled;
                }
                matObj.needsUpdate = true;
            }
            ground.refreshOptions();
            this.viewer.scene.setDirty();
            this.viewer.renderer.reset();
        }
        this.saveSettings();
    }

    public setEnvironmentIntensity(intensity: number): void {
        this.config.envIntensity = intensity;
        this.viewer.scene.environmentIntensity = intensity;
        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
        this.saveSettings();
    }

    public applyCurrentConfig(): void {
        if (this.config.customColor) {
            this.setCustomColor(this.config.customColor);
        } else {
            this.applyPreset(this.config.presetId);
        }
        this.setGroundVisible(this.config.groundVisible);
        this.setGroundShadows(this.config.groundShadows);
        this.setShadowIntensity(this.config.shadowIntensity);
        this.setShadowSoftness(this.config.shadowSoftness);
        this.setShadowQuality(this.config.shadowQuality);
        this.setGroundReflections(this.config.groundReflections);
        this.setEnvironmentIntensity(this.config.envIntensity);
    }

    public getConfig(): StudioConfig {
        return { ...this.config };
    }

    public getCurrentPresetId(): string {
        return this.config.presetId;
    }
}
```

---

## 7. Camera Framing with Zoom & Elevation (`CameraFraming.ts`)

**Path:** `rendering/src/cad/CameraFraming.ts`

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

---

## 8. Metal & Diamond Shaders (`MaterialRoleBinder.ts`)

**Path:** `rendering/src/cad/MaterialRoleBinder.ts`

```typescript
/**
 * MaterialRoleBinder.ts
 * Manages manifest-aware material assignment, WebGi DiamondPlugin binding,
 * independent gemstone groups (center vs accent), and non-destructive uniform updates.
 */

import { Color, MeshStandardMaterial2, ViewerApp, DiamondPlugin, ProgressivePlugin } from "webgi";
import { ModelManifest, ManifestComponent, ComponentRole } from "./ModelManifest";

export interface GemstonePreset {
    id: string;
    name: string;
    color: string;
    refractiveIndex: number;
    dispersion: number;
    absorptionFactor: number;
    envMapIntensity: number;
}

export const GEMSTONE_PRESETS: Record<string, GemstonePreset> = {
    diamond: {
        id: 'diamond',
        name: 'Brilliant Diamond',
        color: '#CFECEC',
        refractiveIndex: 2.417,
        dispersion: 0.044,
        absorptionFactor: 1.0,
        envMapIntensity: 1.35
    },
    ruby: {
        id: 'ruby',
        name: 'Vivid Ruby',
        color: '#f70db1',
        refractiveIndex: 1.77,
        dispersion: 0.018,
        absorptionFactor: 1.5,
        envMapIntensity: 1.25
    },
    emerald: {
        id: 'emerald',
        name: 'Colombian Emerald',
        color: '#5eca00',
        refractiveIndex: 1.58,
        dispersion: 0.014,
        absorptionFactor: 2.0,
        envMapIntensity: 1.25
    },
    sapphire: {
        id: 'sapphire',
        name: 'Royal Sapphire',
        color: '#1766bb',
        refractiveIndex: 1.77,
        dispersion: 0.018,
        absorptionFactor: 1.5,
        envMapIntensity: 1.25
    },
    aquamarine: {
        id: 'aquamarine',
        name: 'Aquamarine',
        color: '#62cffe',
        refractiveIndex: 1.58,
        dispersion: 0.014,
        absorptionFactor: 1.0,
        envMapIntensity: 1.25
    },
    canary: {
        id: 'canary',
        name: 'Canary Diamond',
        color: '#efe75b',
        refractiveIndex: 2.417,
        dispersion: 0.044,
        absorptionFactor: 1.2,
        envMapIntensity: 1.35
    },
    pink: {
        id: 'pink',
        name: 'Pink Diamond',
        color: '#fa37d7',
        refractiveIndex: 2.417,
        dispersion: 0.044,
        absorptionFactor: 1.2,
        envMapIntensity: 1.35
    },
    orange: {
        id: 'orange',
        name: 'Mandarin Garnet',
        color: '#eb8e17',
        refractiveIndex: 1.79,
        dispersion: 0.027,
        absorptionFactor: 1.5,
        envMapIntensity: 1.25
    },
    amethyst: {
        id: 'amethyst',
        name: 'Amethyst',
        color: '#c200f2',
        refractiveIndex: 1.54,
        dispersion: 0.013,
        absorptionFactor: 1.8,
        envMapIntensity: 1.25
    }
};

export interface MetalPreset {
    id: string;
    name: string;
    color: string;
    roughness: number;
    metalness: number;
}

export const PHYSICAL_METAL_PRESETS: Record<string, MetalPreset> = {
    yellow_gold: {
        id: 'yellow_gold',
        name: '18K Yellow Gold',
        color: '#D9A441',
        roughness: 0.16,
        metalness: 1.0
    },
    rose_gold: {
        id: 'rose_gold',
        name: '18K Rose Gold',
        color: '#C98770',
        roughness: 0.18,
        metalness: 1.0
    },
    white_gold: {
        id: 'white_gold',
        name: '18K White Gold',
        color: '#D7D7D2',
        roughness: 0.15,
        metalness: 1.0
    },
    platinum: {
        id: 'platinum',
        name: 'Platinum 950',
        color: '#BEC3C8',
        roughness: 0.17,
        metalness: 1.0
    },
    silver: {
        id: 'silver',
        name: 'Sterling Silver',
        color: '#EAEAEA',
        roughness: 0.14,
        metalness: 1.0
    },
    black_rhodium: {
        id: 'black_rhodium',
        name: 'Black Rhodium',
        color: '#2B2B2D',
        roughness: 0.22,
        metalness: 1.0
    }
};

export function normalizeMaterialEncodings(mat: any): void {
    if (!mat) return;
    if (Array.isArray(mat)) {
        mat.forEach(normalizeMaterialEncodings);
        return;
    }

    if (mat.map && mat.map.isTexture && (mat.map.encoding === undefined || isNaN(mat.map.encoding))) {
        mat.map.encoding = 3001; // sRGBEncoding
    }
    if (mat.emissiveMap && mat.emissiveMap.isTexture && (mat.emissiveMap.encoding === undefined || isNaN(mat.emissiveMap.encoding))) {
        mat.emissiveMap.encoding = 3001;
    }

    const linearMaps = [
        'normalMap', 'bumpMap', 'roughnessMap', 'metalnessMap',
        'aoMap', 'alphaMap', 'clearcoatMap', 'clearcoatNormalMap',
        'clearcoatRoughnessMap', 'iridescenceMap', 'iridescenceThicknessMap',
        'transmissionMap', 'thicknessMap', 'specularIntensityMap'
    ];
    for (const key of linearMaps) {
        const tex = mat[key];
        if (tex && tex.isTexture && (tex.encoding === undefined || isNaN(tex.encoding))) {
            tex.encoding = 3000; // LinearEncoding
        }
    }
}

export class MaterialRoleBinder {
    private viewer: ViewerApp;

    // Component tracking
    private shankMeshes: any[] = [];
    private headMeshes: any[] = [];
    private prongMeshes: any[] = [];
    private centerStoneMeshes: any[] = [];
    private accentStoneMeshes: any[] = [];
    private unassignedMeshes: any[] = [];

    private componentMap: Map<string, { mesh: any; comp: ManifestComponent }> = new Map();
    private meshToNodeIdMap: Map<any, string> = new Map();
    private baselineMaterials: Map<string, any> = new Map();
    private userConfiguredComponents: Map<string, any> = new Map();
    private isCurrentModelBuiltin = true;

    // Active Colors & Presets
    private currentShankColor: Color = new Color(0xffffff);
    private currentHeadColor: Color = new Color(0xfea04d);
    private currentProngColor: Color = new Color(0xfea04d);
    private currentCenterGemPreset: GemstonePreset = GEMSTONE_PRESETS.diamond;
    private currentAccentGemPreset: GemstonePreset = GEMSTONE_PRESETS.diamond;

    // Active Finish & Optical Parameters
    private currentMetalRoughness = 0.18;
    private currentDiamondBrilliance = 1.35;
    private currentDiamondDispersion = 0.044;

    constructor(viewer: ViewerApp) {
        this.viewer = viewer;
    }

    public bindComponents(modelRoot: any, manifest: ModelManifest, isBuiltin = true): void {
        this.clear();
        this.isCurrentModelBuiltin = isBuiltin;

        for (const comp of manifest.components) {
            let mesh = this.viewer.scene.findObjectsByName(comp.nodeName)[0];
            if (!mesh && comp.nodeId) {
                mesh = this.viewer.scene.findObjectsByName(comp.nodeId)[0];
            }

            if (!mesh && modelRoot && typeof modelRoot.traverse === 'function') {
                modelRoot.traverse((child: any) => {
                    if (!mesh && (child.name === comp.nodeName || child.name === comp.nodeId)) {
                        mesh = child;
                    }
                });
            }

            if (mesh) {
                normalizeMaterialEncodings(mesh.material);

                if (!mesh.userData) mesh.userData = {};
                if (!mesh.userData.originalMaterial && mesh.material) {
                    mesh.userData.originalMaterial = typeof mesh.material.clone === 'function'
                        ? mesh.material.clone()
                        : mesh.material;
                }
                this.baselineMaterials.set(comp.nodeId, mesh.userData.originalMaterial || mesh.material);

                this.componentMap.set(comp.nodeId, { mesh, comp });
                this.meshToNodeIdMap.set(mesh, comp.nodeId);

                if (isBuiltin) {
                    this.assignMeshToRole(mesh, comp.role);
                } else {
                    this.groupMeshByRole(mesh, comp.role);

                    if (!mesh.material) {
                        mesh.material = new MeshStandardMaterial2({
                            color: new Color(0xcccccc),
                            roughness: 0.5,
                            metalness: 0.1
                        });
                        mesh.userData.originalMaterial = mesh.material;
                    }
                }
            }
        }

        if (isBuiltin) {
            this.applyCurrentColors();
        } else {
            const saved = (manifest as any)?.savedMaterialAssignments;
            if (saved && typeof saved === 'object') {
                this.applySavedMaterialAssignments(saved);
            }
        }
    }

    public groupMeshByRole(mesh: any, role: ComponentRole): void {
        this.removeFromLists(mesh);
        switch (role) {
            case 'metal_shank':
                this.shankMeshes.push(mesh);
                break;
            case 'metal_head':
                this.headMeshes.push(mesh);
                break;
            case 'metal_prongs':
                this.prongMeshes.push(mesh);
                break;
            case 'diamond':
            case 'colored_gemstone':
                this.centerStoneMeshes.push(mesh);
                break;
            case 'accent_stone':
                this.accentStoneMeshes.push(mesh);
                break;
            case 'unassigned':
            default:
                this.unassignedMeshes.push(mesh);
                break;
        }
    }

    public assignMeshToRole(mesh: any, role: ComponentRole): void {
        this.removeFromLists(mesh);

        const diamondPlugin = this.viewer.getPlugin(DiamondPlugin);

        switch (role) {
            case 'metal_shank':
                this.shankMeshes.push(mesh);
                this.applyMetalMaterial(mesh, this.currentShankColor);
                break;

            case 'metal_head':
                this.headMeshes.push(mesh);
                this.applyMetalMaterial(mesh, this.currentHeadColor);
                break;

            case 'metal_prongs':
                this.prongMeshes.push(mesh);
                this.applyMetalMaterial(mesh, this.currentProngColor);
                break;

            case 'diamond':
            case 'colored_gemstone':
                this.centerStoneMeshes.push(mesh);
                this.applyDiamondMaterial(mesh, this.currentCenterGemPreset, diamondPlugin);
                break;

            case 'accent_stone':
                this.accentStoneMeshes.push(mesh);
                this.applyDiamondMaterial(mesh, this.currentAccentGemPreset, diamondPlugin);
                break;

            case 'unassigned':
            default:
                this.unassignedMeshes.push(mesh);
                this.applyMetalMaterial(mesh, this.currentShankColor);
                break;
        }
    }

    private applyMetalMaterial(mesh: any, color: Color): void {
        let mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;

        if (!mat || mat.isDiamondMaterial || mat.type === 'DiamondMaterial' || mat.isDiamond) {
            mesh.material = new MeshStandardMaterial2({
                color: color,
                roughness: this.currentMetalRoughness,
                metalness: 1.0
            });
        } else {
            if (mat.color && typeof mat.color.copy === 'function') {
                mat.color.copy(color);
            } else if (mat.color) {
                mat.color = color;
            }
            if (mat.roughness !== undefined) mat.roughness = this.currentMetalRoughness;
            if (mat.metalness !== undefined) mat.metalness = 1.0;
        }
    }

    private applyDiamondMaterial(mesh: any, preset: GemstonePreset, diamondPlugin?: DiamondPlugin): void {
        if (!diamondPlugin) return;

        const gemColor = new Color(preset.color);
        let mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        const isDiamond = mat && (mat.isDiamondMaterial || mat.type === 'DiamondMaterial' || mat.isDiamond);

        if (isDiamond) {
            if (mat.color && typeof mat.color.copy === 'function') {
                mat.color.copy(gemColor);
            } else if (mat.color) {
                mat.color = gemColor;
            }
            mat.refractiveIndex = preset.refractiveIndex;
            mat.dispersion = this.currentDiamondDispersion;
            mat.absorptionFactor = preset.absorptionFactor;
            mat.envMapIntensity = this.currentDiamondBrilliance;
            if (mat.userData) {
                mat.userData.isDiamond = true;
                mat.userData.isDiamondMaterialParameters = true;
            }
        } else if (typeof (diamondPlugin as any).makeDiamond === 'function') {
            try {
                if (mat) {
                    mat.isDiamond = true;
                    mat.isDiamondMaterialParameters = true;
                    if (!mat.userData) mat.userData = {};
                    mat.userData.isDiamond = true;
                    mat.userData.isDiamondMaterialParameters = true;
                    if (!mat.userData.appliedMeshes) mat.userData.appliedMeshes = [mesh];
                    else if (!mat.userData.appliedMeshes.includes(mesh)) mat.userData.appliedMeshes.push(mesh);
                }

                (diamondPlugin as any).prepareDiamondMesh(mesh, { cacheKey: mesh.uuid || mesh.name });
                const diamondMat = (diamondPlugin as any).makeDiamond(mesh.material, { cacheKey: mesh.uuid || mesh.name }, {
                    isDiamond: true,
                    isDiamondMaterial: true,
                    isDiamondMaterialParameters: true,
                    color: gemColor,
                    refractiveIndex: preset.refractiveIndex,
                    dispersion: preset.dispersion,
                    reflectivity: 0.5,
                    rayBounces: 5,
                    absorptionFactor: preset.absorptionFactor,
                    envMapIntensity: preset.envMapIntensity
                });

                if (diamondMat && mesh.material !== diamondMat) {
                    mesh.material = (diamondMat as any).materialObject || diamondMat;
                }
            } catch (err) {
                console.warn(`[MaterialRoleBinder] Diamond shader binding failed for ${mesh.name}, fallback to refractive standard:`, err);
                if (mesh.material) {
                    mesh.material.color = gemColor;
                    if (mesh.material.roughness !== undefined) mesh.material.roughness = 0.05;
                    if (mesh.material.metalness !== undefined) mesh.material.metalness = 0.0;
                    if (mesh.material.transmission !== undefined) mesh.material.transmission = 0.95;
                    if (mesh.material.ior !== undefined) mesh.material.ior = preset.refractiveIndex;
                }
            }
        }
    }

    private removeFromLists(mesh: any): void {
        this.shankMeshes = this.shankMeshes.filter(m => m !== mesh);
        this.headMeshes = this.headMeshes.filter(m => m !== mesh);
        this.prongMeshes = this.prongMeshes.filter(m => m !== mesh);
        this.centerStoneMeshes = this.centerStoneMeshes.filter(m => m !== mesh);
        this.accentStoneMeshes = this.accentStoneMeshes.filter(m => m !== mesh);
        this.unassignedMeshes = this.unassignedMeshes.filter(m => m !== mesh);
    }

    public setMetalColors(shankColor: Color, headColor: Color, prongColor?: Color): void {
        this.currentShankColor = shankColor;
        this.currentHeadColor = headColor;
        this.currentProngColor = prongColor || headColor;

        for (const m of this.shankMeshes) {
            const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
            if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                if (mat.color?.copy) mat.color.copy(this.currentShankColor);
                else mat.color = this.currentShankColor;
            }
        }
        for (const m of this.headMeshes) {
            const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
            if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                if (mat.color?.copy) mat.color.copy(this.currentHeadColor);
                else mat.color = this.currentHeadColor;
            }
        }
        for (const m of this.prongMeshes) {
            const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
            if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                if (mat.color?.copy) mat.color.copy(this.currentProngColor);
                else mat.color = this.currentProngColor;
            }
        }
        for (const m of this.unassignedMeshes) {
            const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
            if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                if (mat.color?.copy) mat.color.copy(this.currentShankColor);
                else mat.color = this.currentShankColor;
            }
        }

        this.invalidateRenderingHistory();
    }

    public setGemstoneAppearance(preset: GemstonePreset, targetGroup: 'all' | 'center' | 'accent' = 'all'): void {
        const diamondPlugin = this.viewer.getPlugin(DiamondPlugin);

        if (targetGroup === 'all' || targetGroup === 'center') {
            this.currentCenterGemPreset = preset;
            for (const m of this.centerStoneMeshes) {
                this.applyDiamondMaterial(m, preset, diamondPlugin);
            }
        }

        if (targetGroup === 'all' || targetGroup === 'accent') {
            this.currentAccentGemPreset = preset;
            for (const m of this.accentStoneMeshes) {
                this.applyDiamondMaterial(m, preset, diamondPlugin);
            }
        }

        this.invalidateRenderingHistory();
    }

    public setGemColor(color: Color): void {
        const hex = '#' + color.getHexString();
        const matched = Object.values(GEMSTONE_PRESETS).find(p => p.color.toLowerCase() === hex.toLowerCase());
        const preset: GemstonePreset = matched || {
            id: 'custom',
            name: 'Custom Gemstone',
            color: hex,
            refractiveIndex: 2.417,
            dispersion: 0.044,
            absorptionFactor: 1.0,
            envMapIntensity: 1.35
        };
        this.setGemstoneAppearance(preset, 'all');
    }

    public invalidateRenderingHistory(): void {
        this.viewer.renderer.reset();
        const progressive = this.viewer.getPlugin(ProgressivePlugin);
        if (progressive && typeof (progressive as any).reset === 'function') {
            (progressive as any).reset();
        }
    }

    private applyCurrentColors(): void {
        this.setMetalColors(this.currentShankColor, this.currentHeadColor, this.currentProngColor);
        this.setGemstoneAppearance(this.currentCenterGemPreset, 'center');
        this.setGemstoneAppearance(this.currentAccentGemPreset, 'accent');
    }

    public updateRole(nodeId: string, newRole: ComponentRole): void {
        const item = this.componentMap.get(nodeId);
        if (item) {
            item.comp.role = newRole;
            this.assignMeshToRole(item.mesh, newRole);
            this.invalidateRenderingHistory();
        }
    }

    public getComponents(): ManifestComponent[] {
        return Array.from(this.componentMap.values()).map(i => i.comp);
    }

    public getMeshByNodeId(nodeId: string): any | null {
        return this.componentMap.get(nodeId)?.mesh || null;
    }

    public getNodeIdByMesh(mesh: any): string | null {
        return this.meshToNodeIdMap.get(mesh) || null;
    }

    public getCenterStoneMeshes(): any[] {
        return this.centerStoneMeshes;
    }

    public getAccentStoneMeshes(): any[] {
        return this.accentStoneMeshes;
    }

    public getAllGemstoneMeshes(): any[] {
        return [...this.centerStoneMeshes, ...this.accentStoneMeshes];
    }

    public getShankMeshes(): any[] {
        return this.shankMeshes;
    }

    public getHeadMeshes(): any[] {
        return this.headMeshes;
    }

    public getProngMeshes(): any[] {
        return this.prongMeshes;
    }

    public getUnassignedMeshes(): any[] {
        return this.unassignedMeshes;
    }

    public setMetalRoughness(roughness: number): void {
        this.currentMetalRoughness = Math.max(0.01, Math.min(1.0, roughness));
        const metals = [...this.shankMeshes, ...this.headMeshes, ...this.prongMeshes, ...this.unassignedMeshes];
        for (const m of metals) {
            const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
            if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                mat.roughness = this.currentMetalRoughness;
                if (mat.metalness !== undefined) mat.metalness = 1.0;
            }
        }
        this.invalidateRenderingHistory();
    }

    public setMetalFinish(finish: 'satin' | 'standard' | 'high_polish'): void {
        const map = {
            satin: 0.45,
            standard: 0.18,
            high_polish: 0.04
        };
        this.setMetalRoughness(map[finish] ?? 0.18);
    }

    public setDiamondBrilliance(intensity: number): void {
        this.currentDiamondBrilliance = Math.max(0.2, Math.min(3.0, intensity));
        const gems = [...this.centerStoneMeshes, ...this.accentStoneMeshes];
        for (const g of gems) {
            const mat = Array.isArray(g?.material) ? g.material[0] : g?.material;
            if (mat) {
                mat.envMapIntensity = this.currentDiamondBrilliance;
            }
        }
        this.invalidateRenderingHistory();
    }

    public setDiamondDispersion(dispersion: number): void {
        this.currentDiamondDispersion = Math.max(0.0, Math.min(0.1, dispersion));
        const gems = [...this.centerStoneMeshes, ...this.accentStoneMeshes];
        for (const g of gems) {
            const mat = Array.isArray(g?.material) ? g.material[0] : g?.material;
            if (mat) {
                mat.dispersion = this.currentDiamondDispersion;
            }
        }
        this.invalidateRenderingHistory();
    }

    public getMetalRoughness(): number {
        return this.currentMetalRoughness;
    }

    public getDiamondBrilliance(): number {
        return this.currentDiamondBrilliance;
    }

    public getDiamondDispersion(): number {
        return this.currentDiamondDispersion;
    }

    public applyMetalColor(colorHex: string, role = 'all_metals'): void {
        const color = new Color(colorHex);
        if (role === 'all_metals' || role === 'metal_shank') {
            this.currentShankColor = color;
            for (const m of this.shankMeshes) {
                const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
                if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                    if (mat.color?.copy) mat.color.copy(color);
                    else mat.color = color;
                }
            }
        }
        if (role === 'all_metals' || role === 'metal_head') {
            this.currentHeadColor = color;
            for (const m of this.headMeshes) {
                const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
                if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                    if (mat.color?.copy) mat.color.copy(color);
                    else mat.color = color;
                }
            }
        }
        if (role === 'all_metals' || role === 'metal_prongs') {
            this.currentProngColor = color;
            for (const m of this.prongMeshes) {
                const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
                if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                    if (mat.color?.copy) mat.color.copy(color);
                    else mat.color = color;
                }
            }
        }
        for (const m of this.unassignedMeshes) {
            const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
            if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                if (mat.color?.copy) mat.color.copy(this.currentShankColor);
                else mat.color = this.currentShankColor;
            }
        }
        this.invalidateRenderingHistory();
    }

    public applyMetalFinish(roughness: number, metalness = 1.0, role = 'all_metals'): void {
        this.currentMetalRoughness = Math.max(0.01, Math.min(1.0, roughness));
        let targets = [...this.shankMeshes, ...this.headMeshes, ...this.prongMeshes, ...this.unassignedMeshes];
        if (role === 'metal_shank') targets = this.shankMeshes;
        else if (role === 'metal_head') targets = this.headMeshes;
        else if (role === 'metal_prongs') targets = this.prongMeshes;

        for (const m of targets) {
            const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
            if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                mat.roughness = this.currentMetalRoughness;
                if (mat.metalness !== undefined) mat.metalness = metalness;
            }
        }
        this.invalidateRenderingHistory();
    }

    public applyGemstonePreset(preset: GemstonePreset, role = 'all_gemstones'): void {
        const diamondPlugin = this.viewer.getPlugin(DiamondPlugin);
        let targets: any[] = [];
        if (role === 'all_gemstones') {
            targets = [...this.centerStoneMeshes, ...this.accentStoneMeshes];
            this.currentCenterGemPreset = preset;
            this.currentAccentGemPreset = preset;
        } else if (role === 'diamond' || role === 'center') {
            targets = this.centerStoneMeshes;
            this.currentCenterGemPreset = preset;
        } else if (role === 'accent_stone' || role === 'accent') {
            targets = this.accentStoneMeshes;
            this.currentAccentGemPreset = preset;
        }

        for (const m of targets) {
            this.applyDiamondMaterial(m, preset, diamondPlugin);
        }
        this.invalidateRenderingHistory();
    }

    public applyGemstoneOpticalParameters(params: {
        color?: string;
        refractiveIndex?: number;
        dispersion?: number;
        absorptionFactor?: number;
        envMapIntensity?: number;
    }, role = 'all_gemstones'): void {
        let targets = [...this.centerStoneMeshes, ...this.accentStoneMeshes];
        if (role === 'diamond' || role === 'center') targets = this.centerStoneMeshes;
        else if (role === 'accent_stone' || role === 'accent') targets = this.accentStoneMeshes;

        for (const m of targets) {
            const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
            if (mat) {
                if (params.color) {
                    const c = new Color(params.color);
                    if (mat.color?.copy) mat.color.copy(c);
                    else mat.color = c;
                }
                if (params.refractiveIndex !== undefined) {
                    mat.refractiveIndex = params.refractiveIndex;
                    if (mat.ior !== undefined) mat.ior = params.refractiveIndex;
                }
                if (params.dispersion !== undefined) mat.dispersion = params.dispersion;
                if (params.absorptionFactor !== undefined) mat.absorptionFactor = params.absorptionFactor;
                if (params.envMapIntensity !== undefined) mat.envMapIntensity = params.envMapIntensity;
            }
        }
        this.invalidateRenderingHistory();
    }

    public applyGemstonePresetToComponent(nodeId: string, preset: GemstonePreset): void {
        let item = this.componentMap.get(nodeId);
        if (!item) {
            for (const [, val] of this.componentMap.entries()) {
                if (val.comp.nodeName === nodeId || val.mesh?.name === nodeId) {
                    item = val;
                    break;
                }
            }
        }
        if (!item || !item.mesh) return;

        const mesh = item.mesh;
        const diamondPlugin = this.viewer.getPlugin(DiamondPlugin);

        let mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (mat && typeof mat.clone === 'function' && !mat.__uniqueInstance) {
            if (mat.userData) {
                mat.userData.isDiamond = true;
                mat.userData.isDiamondMaterialParameters = true;
            }
            mesh.material = mat.clone();
            mesh.material.__uniqueInstance = true;
        }

        this.applyDiamondMaterial(mesh, preset, diamondPlugin);
        mesh.userData.__userConfigured = true;
        this.userConfiguredComponents.set(nodeId, { type: 'gemstone', preset });
        this.invalidateRenderingHistory();
    }

    public applyGemstoneParamsToComponent(nodeId: string, params: {
        color?: string;
        refractiveIndex?: number;
        dispersion?: number;
        absorptionFactor?: number;
        envMapIntensity?: number;
    }): void {
        let item = this.componentMap.get(nodeId);
        if (!item) {
            for (const [, val] of this.componentMap.entries()) {
                if (val.comp.nodeName === nodeId || val.mesh?.name === nodeId) {
                    item = val;
                    break;
                }
            }
        }
        if (!item || !item.mesh) return;

        const mesh = item.mesh;
        let mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (mat && typeof mat.clone === 'function' && !mat.__uniqueInstance) {
            if (mat.userData) {
                mat.userData.isDiamond = true;
                mat.userData.isDiamondMaterialParameters = true;
            }
            mesh.material = mat.clone();
            mesh.material.__uniqueInstance = true;
            mat = mesh.material;
        }

        if (mat) {
            if (params.color) {
                const c = new Color(params.color);
                if (mat.color?.copy) mat.color.copy(c);
                else mat.color = c;
            }
            if (params.refractiveIndex !== undefined) {
                mat.refractiveIndex = params.refractiveIndex;
                if (mat.ior !== undefined) mat.ior = params.refractiveIndex;
            }
            if (params.dispersion !== undefined) mat.dispersion = params.dispersion;
            if (params.absorptionFactor !== undefined) mat.absorptionFactor = params.absorptionFactor;
            if (params.envMapIntensity !== undefined) mat.envMapIntensity = params.envMapIntensity;
        }

        this.invalidateRenderingHistory();
    }

    public applyMetalPresetToComponent(nodeId: string, colorHex: string, roughness: number, metalness = 1.0): void {
        let item = this.componentMap.get(nodeId);
        if (!item) {
            for (const [, val] of this.componentMap.entries()) {
                if (val.comp.nodeName === nodeId || val.mesh?.name === nodeId) {
                    item = val;
                    break;
                }
            }
        }
        if (!item || !item.mesh) return;

        const mesh = item.mesh;
        let mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (mat && typeof mat.clone === 'function' && !mat.__uniqueInstance) {
            mesh.material = mat.clone();
            mesh.material.__uniqueInstance = true;
            mat = mesh.material;
        }

        this.applyMetalMaterial(mesh, new Color(colorHex));
        mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (mat) {
            mat.roughness = roughness;
            mat.metalness = metalness;
        }
        mesh.userData.__userConfigured = true;
        this.userConfiguredComponents.set(nodeId, { type: 'metal', colorHex, roughness, metalness });
        this.invalidateRenderingHistory();
    }

    public resetComponentMaterial(nodeId: string): void {
        let item = this.componentMap.get(nodeId);
        if (!item) {
            for (const [, val] of this.componentMap.entries()) {
                if (val.comp.nodeName === nodeId || val.mesh?.name === nodeId) {
                    item = val;
                    break;
                }
            }
        }
        if (!item || !item.mesh) return;

        const mesh = item.mesh;
        if (mesh.userData?.originalMaterial) {
            mesh.material = typeof mesh.userData.originalMaterial.clone === 'function'
                ? mesh.userData.originalMaterial.clone()
                : mesh.userData.originalMaterial;
            mesh.userData.__userConfigured = false;
            this.userConfiguredComponents.delete(nodeId);
            this.invalidateRenderingHistory();
        }
    }

    public resetAllMaterials(): void {
        for (const [nodeId, item] of this.componentMap.entries()) {
            if (item.mesh && item.mesh.userData?.originalMaterial) {
                item.mesh.material = typeof item.mesh.userData.originalMaterial.clone === 'function'
                    ? item.mesh.userData.originalMaterial.clone()
                    : item.mesh.userData.originalMaterial;
                item.mesh.userData.__userConfigured = false;
            }
        }
        this.userConfiguredComponents.clear();
        this.invalidateRenderingHistory();
    }

    public getUserMaterialAssignments(): Record<string, any> {
        const result: Record<string, any> = {};
        for (const [id, config] of this.userConfiguredComponents.entries()) {
            result[id] = config;
        }
        return result;
    }

    public applySavedMaterialAssignments(assignments: Record<string, any>): void {
        for (const [nodeId, config] of Object.entries(assignments)) {
            if (!config) continue;
            if (config.type === 'gemstone' && config.preset) {
                this.applyGemstonePresetToComponent(nodeId, config.preset);
            } else if (config.type === 'metal') {
                this.applyMetalPresetToComponent(
                    nodeId,
                    config.colorHex || config.color || '#fed250',
                    config.roughness ?? 0.08,
                    config.metalness ?? 1.0
                );
            }
        }
    }

    public clear(): void {
        this.shankMeshes.length = 0;
        this.headMeshes.length = 0;
        this.prongMeshes.length = 0;
        this.centerStoneMeshes.length = 0;
        this.accentStoneMeshes.length = 0;
        this.unassignedMeshes.length = 0;
        this.componentMap.clear();
        this.meshToNodeIdMap.clear();
        this.baselineMaterials.clear();
        this.userConfiguredComponents.clear();
    }
}
```

---

## 9. WebGi Engine Lifecycle & Viewport Host (`ViewerHost.ts`)

**Path:** `rendering/src/studio/ViewerHost.ts`

```typescript
/**
 * ViewerHost.ts
 * Stable, persistent WebGi viewer service.
 * Holds WebGi instance outside React render cycles.
 */

import {
    ViewerApp,
    AssetManagerPlugin,
    SSRPlugin,
    mobileAndTabletCheck,
    GBufferPlugin,
    ProgressivePlugin,
    TonemapPlugin,
    SSAOPlugin,
    GroundPlugin,
    ContactShadowGroundPlugin,
    FrameFadePlugin,
    DiamondPlugin,
    BloomPlugin,
    TemporalAAPlugin,
    RandomizedDirectionalLightPlugin,
    Color,
    Box3,
    Sphere
} from "webgi";

import { ModelManifest, ComponentRole } from "../cad/ModelManifest";
import { MaterialRoleBinder, GemstonePreset, PHYSICAL_METAL_PRESETS } from "../cad/MaterialRoleBinder";
import { DynamicCadLoader } from "../cad/DynamicCadLoader";
import { CanvasPicker } from "../cad/CanvasPicker";
import { StudioSettings } from "../ui/StudioSettings";
import { autoFrameCamera } from "../cad/CameraFraming";
import { StudioFloor } from "./StudioFloor";
import { StudioWorld } from "./StudioWorld";

export class ViewerHost {
    private static instance: ViewerHost | null = null;

    public viewer: ViewerApp | null = null;
    public manager: AssetManagerPlugin | null = null;
    public roleBinder: MaterialRoleBinder | null = null;
    public dynamicLoader: DynamicCadLoader | null = null;
    public picker: CanvasPicker | null = null;
    public studio: StudioSettings | null = null;
    public studioFloor: StudioFloor | null = null;
    public studioWorld: StudioWorld | null = null;

    private initialized = false;
    private canvas: HTMLCanvasElement | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private onSelectionChangeCallback?: (nodeId: string | null, component: any) => void;

    private cameraFrameState = {
        radius: 1.35,
        center: { x: 0, y: 0.8, z: 0 },
        zoom: 1.0,
        coverage: 0.78,
        elevationDeg: 30,
        azimuthDeg: -25
    };

    public static getInstance(): ViewerHost {
        if (!ViewerHost.instance) {
            ViewerHost.instance = new ViewerHost();
            if (typeof window !== 'undefined') {
                (window as any).__VIEWER_HOST__ = ViewerHost.instance;
            }
        }
        return ViewerHost.instance;
    }

    public async init(canvas: HTMLCanvasElement): Promise<void> {
        if (this.initialized && this.viewer) return;

        this.canvas = canvas;
        const viewer = new ViewerApp({
            canvas,
            useGBufferDepth: true,
            isAntialiased: false
        });
        this.viewer = viewer;

        const isMobile = mobileAndTabletCheck();
        viewer.renderer.displayCanvasScaling = Math.min(window.devicePixelRatio, 1);

        // Normalize base renderer outputEncoding to linear default (3000) to prevent undefined encoding warnings
        if (viewer.renderer && (viewer.renderer as any).rendererObject) {
            (viewer.renderer as any).rendererObject.outputEncoding = (viewer.renderer as any).rendererObject.outputEncoding || 3000;
        }

        const manager = await viewer.addPlugin(AssetManagerPlugin);
        this.manager = manager;

        const camera = viewer.scene.activeCamera;

        // Preserved exact WebGi 8-pass rendering pipeline with clean neutral tonemapping
        await viewer.addPlugin(GBufferPlugin);
        await viewer.addPlugin(new ProgressivePlugin(32));
        await viewer.addPlugin(new TonemapPlugin(true));

        const ssr = await viewer.addPlugin(SSRPlugin);
        const ssao = await viewer.addPlugin(SSAOPlugin);
        await viewer.addPlugin(FrameFadePlugin);
        const ground = await viewer.addPlugin(ContactShadowGroundPlugin);
        (viewer as any).plugins['GroundPlugin'] = ground;
        const bloom = await viewer.addPlugin(BloomPlugin);
        await viewer.addPlugin(TemporalAAPlugin);
        await viewer.addPlugin(DiamondPlugin);
        await viewer.addPlugin(RandomizedDirectionalLightPlugin, false);

        ssr!.passes.ssr.passObject.lowQualityFrames = 0;
        bloom.pass!.passObject.bloomIterations = 2;
        ssao.passes.ssao.passObject.material.defines.NUM_SAMPLES = 4;

        if (isMobile) {
            ssr!.passes.ssr.passObject.stepCount /= 2;
            bloom.enabled = false;
            camera.setCameraOptions({ fov: 65 });
        }

        // Studio World (Persistent Floor at Y=0, 3-Point Light Rig, and Studio HDR Environment)
        const studioWorld = new StudioWorld(viewer, manager);
        this.studioWorld = studioWorld;
        await studioWorld.init('white');
        this.studioFloor = studioWorld.floor;

        const studio = new StudioSettings(viewer);
        studio.applyPreset('white');
        this.studio = studio;
        studio.setStudioFloor(this.studioFloor);

        // Stationary camera by default: autoRotate = false
        // Initial perspective framing calibrated for natural floor and jewelry visibility
        camera.position.set(-1.04, 2.85, 4.19);
        camera.target.set(0, 0.75, 0);
        camera.positionUpdated(true);
        camera.targetUpdated(true);

        if (camera.controls) {
            camera.controls.enabled = true;
            camera.controls.autoRotate = false; // STATIONARY BY DEFAULT
            camera.controls.autoRotateSpeed = 1.0;
            camera.controls.minDistance = 0.45;
            camera.controls.maxDistance = 16.0;
            camera.controls.enablePan = true;
            camera.controls.enableZoom = true;
            camera.controls.screenSpacePanning = false;
            camera.controls.target.set(0, 0.8, 0);
            camera.controls.update();
        }

        viewer.renderer.refreshPipeline();

        // Initialize CAD integration modules
        const roleBinder = new MaterialRoleBinder(viewer);
        this.roleBinder = roleBinder;
        this.dynamicLoader = new DynamicCadLoader(viewer, manager, roleBinder, this.studioFloor);

        // Picking
        const picker = new CanvasPicker(viewer, canvas);
        this.picker = picker;
        picker.onSelection((ev) => {
            if (!ev || !ev.mesh) {
                if (this.onSelectionChangeCallback) this.onSelectionChangeCallback(null, null);
                return;
            }
            const nodeId = ev.mesh.name || ev.nodeName;
            const manifest = this.dynamicLoader?.getCurrentManifest();
            const comp = manifest?.components.find(c => c.nodeId === nodeId || c.nodeName === nodeId);

            const mat = Array.isArray(ev.mesh.material) ? ev.mesh.material[0] : ev.mesh.material;
            const materialName = mat?.name || (mat?.isDiamond ? 'Diamond' : (mat ? 'PBR Material' : 'None'));
            const isCustomized = !!ev.mesh.userData?.__userConfigured;

            const compInfo = {
                nodeId,
                nodeName: ev.mesh.name || ev.nodeName || 'Unnamed Component',
                parentName: ev.parentName,
                role: comp ? comp.role : 'unassigned',
                position: ev.position,
                rotation: ev.rotation,
                scale: ev.scale,
                sourceLayer: comp?.sourceLayer,
                isMerged: false,
                materialName,
                isCustomized
            };
            if (this.onSelectionChangeCallback) {
                this.onSelectionChangeCallback(nodeId, compInfo);
            }
        });

        // ResizeObserver to update camera aspect without reinitializing WebGi
        this.resizeObserver = new ResizeObserver(() => {
            if (!this.viewer) return;
            if (typeof (this.viewer as any).resize === 'function') {
                (this.viewer as any).resize();
            }
            const cam = this.viewer.scene.activeCamera;
            if (cam && this.canvas) {
                const width = this.canvas.clientWidth;
                const height = this.canvas.clientHeight;
                if (width > 0 && height > 0) {
                    cam.aspect = width / height;
                    cam.positionUpdated(false);
                    cam.targetUpdated(true);
                }
            }
        });
        if (canvas.parentElement) {
            this.resizeObserver.observe(canvas.parentElement);
        }

        this.initialized = true;
    }

    public onSelectionChange(cb: (nodeId: string | null, component: any) => void) {
        this.onSelectionChangeCallback = cb;
    }

    public async loadModel(glbUrl: string, manifest?: ModelManifest | null, onProgress?: (p: number) => void): Promise<any> {
        if (!this.dynamicLoader) return null;
        let root: any;
        try {
            root = await this.dynamicLoader.loadModel(glbUrl, manifest, onProgress);
        } catch (err) {
            console.error('[ViewerHost] Model load failed:', err);
            return this.dynamicLoader.getCurrentModelRoot();
        }

        if (!root || typeof root.traverse !== 'function') {
            console.warn('[ViewerHost] Model load returned null or non-traversable root, retaining existing model');
            return this.dynamicLoader.getCurrentModelRoot();
        }

        if (root && root.updateMatrixWorld) {
            root.updateMatrixWorld(true);
        }
        this.studio?.configureGroundAppearance();

        this.fitView(false);
        return root;
    }

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

    public resetView(): void {
        this.cameraFrameState.zoom = 1.0;
        this.cameraFrameState.coverage = 0.78;
        this.cameraFrameState.azimuthDeg = -25;
        this.cameraFrameState.elevationDeg = 30;
        this.fitView(false);
    }

    public takeSnapshot(filename = 'mahesh3d-jewelry.png'): void {
        if (!this.canvas) return;
        try {
            this.viewer?.renderer?.reset();
            const dataUrl = this.canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.download = filename;
            a.href = dataUrl;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) {
            console.error('[ViewerHost] Snapshot failed:', e);
        }
    }

    public setAutoRotate(enabled: boolean) {
        if (!this.viewer) return;
        const camera = this.viewer.scene.activeCamera;
        if (camera && camera.controls) {
            camera.controls.autoRotate = enabled;
            camera.controls.update();
        }
    }

    public setMetalPreset(colorHex: string, roughness: number, metalness = 1.0, role?: string) {
        if (!this.roleBinder) return;
        if (role === 'selected' && this.picker?.getSelectedMesh()) {
            const mesh = this.picker.getSelectedMesh();
            this.roleBinder.applyMetalPresetToComponent(mesh.name, colorHex, roughness, metalness);
            return;
        }
        this.roleBinder.applyMetalColor(colorHex, role || 'all_metals');
        this.roleBinder.applyMetalFinish(roughness, metalness, role || 'all_metals');
    }

    public applyMetalPreset(presetId: string, role?: string) {
        const preset = PHYSICAL_METAL_PRESETS[presetId];
        if (preset) {
            this.setMetalPreset(preset.color, preset.roughness, preset.metalness, role);
        }
    }

    public setGemstonePreset(preset: GemstonePreset, role?: string) {
        if (!this.roleBinder) return;
        if (role === 'selected' && this.picker?.getSelectedMesh()) {
            const mesh = this.picker.getSelectedMesh();
            this.roleBinder.applyGemstonePresetToComponent(mesh.name, preset);
            return;
        }
        this.roleBinder.applyGemstonePreset(preset, (role as any) || 'all_gemstones');
    }

    public setCustomGemstoneParams(params: {
        color: string;
        refractiveIndex: number;
        dispersion: number;
        absorptionFactor: number;
        envMapIntensity: number;
    }, role?: string) {
        if (!this.roleBinder) return;
        if (role === 'selected' && this.picker?.getSelectedMesh()) {
            const mesh = this.picker.getSelectedMesh();
            this.roleBinder.applyGemstoneParamsToComponent(mesh.name, params);
            return;
        }
        this.roleBinder.applyGemstoneOpticalParameters(params, (role as any) || 'all_gemstones');
    }

    public applyGemstonePresetToComponent(nodeId: string, preset: GemstonePreset) {
        this.roleBinder?.applyGemstonePresetToComponent(nodeId, preset);
    }

    public applyMetalPresetToComponent(nodeId: string, colorHex: string, roughness: number, metalness = 1.0) {
        this.roleBinder?.applyMetalPresetToComponent(nodeId, colorHex, roughness, metalness);
    }

    public resetComponentMaterial(nodeId: string) {
        this.roleBinder?.resetComponentMaterial(nodeId);
    }

    public resetAllMaterials() {
        this.roleBinder?.resetAllMaterials();
    }

    public getUserMaterialAssignments(): Record<string, any> {
        return this.roleBinder?.getUserMaterialAssignments() || {};
    }

    public selectParent(nodeId?: string) {
        if (!this.picker) return;
        const mesh = this.picker.getSelectedMesh();
        if (mesh && mesh.parent && mesh.parent.name && mesh.parent.name !== 'Scene' && mesh.parent.name !== 'SceneRoot') {
            this.selectComponent(mesh.parent.name);
        }
    }

    public toggleComponentVisibility(nodeId: string): boolean {
        if (!this.viewer || !this.dynamicLoader) return true;
        const root = this.dynamicLoader.getCurrentModelRoot();
        if (!root || typeof root.traverse !== 'function') return true;

        let visible = true;
        root.traverse((child: any) => {
            if ((child.name === nodeId || child.uuid === nodeId) && child.isMesh) {
                child.visible = !child.visible;
                visible = child.visible;
            }
        });

        this.dynamicLoader.alignGround();
        this.viewer.renderer.reset();
        return visible;
    }

    public selectComponent(nodeId: string | null) {
        if (!this.viewer || !this.dynamicLoader || !this.picker) return;
        if (!nodeId) {
            this.picker.selectMesh(null);
            return;
        }

        const root = this.dynamicLoader.getCurrentModelRoot();
        let targetMesh: any = null;
        if (root && typeof root.traverse === 'function') {
            root.traverse((child: any) => {
                if ((child.name === nodeId || child.uuid === nodeId) && child.isMesh) {
                    targetMesh = child;
                }
            });
        }
        this.picker.selectMesh(targetMesh);
    }

    public focusComponent(nodeId: string) {
        if (!this.viewer || !this.dynamicLoader) return;
        const root = this.dynamicLoader.getCurrentModelRoot();
        if (!root || typeof root.traverse !== 'function') return;

        let targetMesh: any = null;
        root.traverse((child: any) => {
            if ((child.name === nodeId || child.uuid === nodeId) && child.isMesh) {
                targetMesh = child;
            }
        });

        if (targetMesh) {
            const box = new Box3();
            box.setFromObject(targetMesh);
            const sphere = box.getBoundingSphere(new Sphere());
            const camera = this.viewer.scene.activeCamera;
            autoFrameCamera(camera, camera.controls, Math.max(sphere.radius * 2.2, 0.5), true, () => {
                camera.positionUpdated(true);
                camera.targetUpdated(true);
            });
        }
    }

    public setComponentRole(nodeId: string, role: ComponentRole) {
        if (!this.roleBinder || !this.dynamicLoader) return;
        const manifest = this.dynamicLoader.getCurrentManifest();
        if (!manifest) return;

        const comp = manifest.components.find(c => c.nodeId === nodeId || c.nodeName === nodeId);
        if (comp) {
            comp.role = role;
            comp.roleConfidence = 1.0;
            const root = this.dynamicLoader.getCurrentModelRoot();
            this.roleBinder.bindComponents(root, manifest);
            this.viewer?.renderer.reset();
        }
    }

    public setStudioPreset(presetId: string, customColor?: string) {
        if (customColor) {
            this.studioWorld?.setBackgroundColor(customColor);
            this.studio?.setCustomColor(customColor);
        } else {
            this.studioWorld?.setEnvironmentPreset(presetId);
            this.studio?.applyPreset(presetId);
        }
    }

    public setGroundVisible(visible: boolean) {
        this.studio?.setGroundVisible(visible);
        this.studioWorld?.setFloorVisible(visible);
    }

    public setGroundShadows(enabled: boolean) {
        this.studio?.setGroundShadows(enabled);
    }

    public setShadowIntensity(val: number) {
        this.studio?.setShadowIntensity(val);
    }

    public setShadowSoftness(val: number) {
        this.studio?.setShadowSoftness(val);
    }

    public setShadowQuality(quality: 'performance' | 'balanced' | 'high') {
        this.studio?.setShadowQuality(quality);
    }

    public setGroundReflections(enabled: boolean) {
        this.studio?.setGroundReflections(enabled);
    }

    public setEnvironmentIntensity(val: number) {
        this.studioWorld?.setEnvironmentIntensity(val);
        this.studio?.setEnvironmentIntensity(val);
    }

    public setFloorColor(hex: string) {
        this.studioFloor?.setColor(hex);
    }

    public setFloorRoughness(roughness: number) {
        this.studioFloor?.setRoughness(roughness);
    }

    public setFloorSize(size: number) {
        this.studioFloor?.setSize(size);
    }

    public setFloorVisible(visible: boolean) {
        this.studioFloor?.setVisible(visible);
    }

    public setDisplayCanvasScaling(scale: number) {
        if (!this.viewer) return;
        this.viewer.renderer.displayCanvasScaling = Math.max(0.5, Math.min(3.0, scale));
        this.viewer.renderer.reset();
    }

    public setBloom(enabled: boolean) {
        if (!this.viewer) return;
        const bloom = this.viewer.getPlugin(BloomPlugin);
        if (bloom) {
            bloom.enabled = enabled;
            this.viewer.renderer.reset();
        }
    }

    public setSSAO(enabled: boolean) {
        if (!this.viewer) return;
        const ssao = this.viewer.getPlugin(SSAOPlugin);
        if (ssao) {
            ssao.enabled = enabled;
            this.viewer.renderer.reset();
        }
    }

    public setSSR(enabled: boolean) {
        if (!this.viewer) return;
        const ssr = this.viewer.getPlugin(SSRPlugin);
        if (ssr) {
            ssr.enabled = enabled;
            this.viewer.renderer.reset();
        }
    }

    public setCameraFov(fov: number) {
        if (!this.viewer) return;
        const cam = this.viewer.scene.activeCamera;
        if (cam) {
            cam.setCameraOptions({ fov: Math.max(20, Math.min(90, fov)) });
            cam.positionUpdated(true);
            cam.targetUpdated(true);
            if (cam.controls) cam.controls.update();
            this.viewer.renderer.reset();
        }
    }

    public setAutoRotateSpeed(speed: number) {
        if (!this.viewer) return;
        const cam = this.viewer.scene.activeCamera;
        if (cam && cam.controls) {
            cam.controls.autoRotateSpeed = speed;
            cam.controls.update();
        }
    }

    public setAutoCenter(enabled: boolean) {
        this.dynamicLoader?.setAutoCenter(enabled);
    }

    public getAutoCenter(): boolean {
        return this.dynamicLoader?.getAutoCenter() ?? true;
    }

    public setAutoScale(enabled: boolean) {
        this.dynamicLoader?.setAutoScale(enabled);
    }

    public getAutoScale(): boolean {
        return this.dynamicLoader?.getAutoScale() ?? true;
    }

    public setAutoScaleRadius(radius: number) {
        this.dynamicLoader?.setTargetRadius(radius);
    }

    public getAutoScaleRadius(): number {
        return this.dynamicLoader?.getTargetRadius() ?? 1.35;
    }

    public applyMetalToAll(colorHex: string, roughness: number, metalness = 1.0) {
        if (!this.roleBinder) return;
        this.roleBinder.applyMetalColor(colorHex, 'all_metals');
        this.roleBinder.applyMetalFinish(roughness, metalness, 'all_metals');
        this.viewer?.renderer.reset();
    }

    public applyGemstoneToAll(preset: GemstonePreset) {
        if (!this.roleBinder) return;
        this.roleBinder.applyGemstonePreset(preset, 'all_gemstones');
        this.viewer?.renderer.reset();
    }

    public getAllNodes(): Array<{ nodeId: string; nodeName: string; visible: boolean; role: string; sourceLayer?: string }> {
        const result: Array<{ nodeId: string; nodeName: string; visible: boolean; role: string; sourceLayer?: string }> = [];
        const root = this.dynamicLoader?.getCurrentModelRoot();
        const manifest = this.dynamicLoader?.getCurrentManifest();

        if (root && typeof root.traverse === 'function') {
            root.traverse((child: any) => {
                if (child.isMesh) {
                    const id = child.name || child.uuid;
                    const comp = manifest?.components.find(c => c.nodeId === id || c.nodeName === id);
                    result.push({
                        nodeId: id,
                        nodeName: child.name || 'Unnamed Component',
                        visible: child.visible !== false,
                        role: comp ? comp.role : 'unassigned',
                        sourceLayer: comp?.sourceLayer
                    });
                }
            });
        }
        return result;
    }
}
```

---

## 10. CAD Normalization, Grounding & Object Shadows (`DynamicCadLoader.ts`)

**Path:** `rendering/src/cad/DynamicCadLoader.ts`

```typescript
/**
 * DynamicCadLoader.ts
 * Manages loading custom CAD-generated GLB models into the existing WebGi viewer,
 * handling resource disposal, temporal accumulation reset, and camera auto-framing.
 */

import { ViewerApp, AssetManagerPlugin, Box3, Sphere, ProgressivePlugin, GroundPlugin, ContactShadowGroundPlugin, Group } from "webgi";
import { ModelManifest } from "./ModelManifest";
import { MaterialRoleBinder } from "./MaterialRoleBinder";
import { ComponentDiscovery } from "./ComponentDiscovery";
import { autoFrameCamera } from "./CameraFraming";
import { GROUND_SIZE, groundShadowHeight, groundShadowScale, isHelperMesh } from "../studio/groundMath";
import { StudioFloor } from "../studio/StudioFloor";

export function normalizeModelRoot(asset: any): any | null {
    if (!asset) return null;
    if (Array.isArray(asset)) {
        if (asset.length === 0) return null;
        if (asset.length === 1) {
            return normalizeModelRoot(asset[0]);
        }
        const validObjects = asset.map(item => normalizeModelRoot(item)).filter(Boolean);
        if (validObjects.length === 0) return null;
        if (validObjects.length === 1) return validObjects[0];

        const firstParent = validObjects[0].parent;
        if (firstParent && firstParent.type !== 'Scene' && validObjects.every(o => o.parent === firstParent)) {
            return firstParent;
        }

        const GroupClass = typeof Group === 'function' ? Group : class FallbackGroup {
            isObject3D = true;
            name = 'ImportedModelRoot';
            children: any[] = [];
            position = { set: () => {}, copy: () => {} };
            scale = { set: () => {} };
            rotation = { set: () => {} };
            add(obj: any) { this.children.push(obj); obj.parent = this; }
            traverse(cb: (o: any) => void) {
                cb(this);
                this.children.forEach(c => typeof c?.traverse === 'function' ? c.traverse(cb) : cb(c));
            }
        };
        const group = new (GroupClass as any)();
        group.name = 'ImportedModelRoot';
        for (const obj of validObjects) {
            group.add(obj);
        }
        return group;
    }
    if (asset.modelObject && typeof asset.modelObject.traverse === 'function') {
        return asset.modelObject;
    }
    if (asset.root && typeof asset.root.traverse === 'function') {
        return asset.root;
    }
    if (asset.scene && typeof asset.scene.traverse === 'function') {
        return asset.scene;
    }
    if (typeof asset.traverse === 'function') {
        return asset;
    }
    return null;
}

export class DynamicCadLoader {
    private viewer: ViewerApp;
    private manager: AssetManagerPlugin;
    private roleBinder: MaterialRoleBinder;
    private currentModelRoot: any = null;
    private currentModelAsset: any = null;
    private currentManifest: ModelManifest | null = null;
    private loadToken = 0;
    private studioFloor: StudioFloor | null = null;
    private autoCenter = true;
    private autoScale = true;
    private targetRadius = 1.35;

    constructor(viewer: ViewerApp, manager: AssetManagerPlugin, roleBinder: MaterialRoleBinder, studioFloor?: StudioFloor | null) {
        this.viewer = viewer;
        this.manager = manager;
        this.roleBinder = roleBinder;
        this.studioFloor = studioFloor || null;
    }

    public setAutoCenter(enabled: boolean): void {
        this.autoCenter = enabled;
    }

    public getAutoCenter(): boolean {
        return this.autoCenter;
    }

    public setAutoScale(enabled: boolean): void {
        this.autoScale = enabled;
    }

    public getAutoScale(): boolean {
        return this.autoScale;
    }

    public setTargetRadius(radius: number): void {
        this.targetRadius = Math.max(0.1, Math.min(10.0, radius));
    }

    public getTargetRadius(): number {
        return this.targetRadius;
    }

    public setStudioFloor(floor: StudioFloor): void {
        this.studioFloor = floor;
    }

    public async loadModel(
        glbUrl: string,
        manifest?: ModelManifest | null,
        onProgress?: (ratio: number) => void
    ): Promise<any> {
        const token = ++this.loadToken;

        this.viewer.renderer.reset();
        const progressive = this.viewer.getPlugin(ProgressivePlugin);
        if (progressive && typeof (progressive as any).reset === 'function') {
            (progressive as any).reset();
        }

        let objects: any = null;
        try {
            objects = await this.manager.addFromPath(glbUrl, { autoScale: false });
        } catch (err) {
            console.error('[DynamicCadLoader] addFromPath failed:', err);
            return null;
        }

        if (token !== this.loadToken) {
            this.removeImportedAssets(objects);
            return null;
        }

        const newRoot = normalizeModelRoot(objects);
        if (!newRoot || typeof newRoot.traverse !== 'function') {
            console.error('[DynamicCadLoader] Loaded asset has no traversable Object3D root:', objects);
            this.removeImportedAssets(objects);
            return null;
        }

        this.disposeCurrentModel();

        if (!newRoot.parent && (this.viewer.scene as any)?.modelRoot) {
            (this.viewer.scene as any).modelRoot.add(newRoot);
        }

        this.currentModelRoot = newRoot;
        this.currentModelAsset = objects;

        const isBuiltin = glbUrl.includes('ring_webgi') || glbUrl.includes('ring2_webgi');
        if (isBuiltin && this.currentModelRoot && this.currentModelRoot.rotation) {
            this.currentModelRoot.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
            if (this.currentModelRoot.updateMatrixWorld) {
                this.currentModelRoot.updateMatrixWorld(true);
            }
        }
        let effectiveRadius = 1.35;

        try {
            if (this.currentModelRoot.updateMatrixWorld) {
                this.currentModelRoot.updateMatrixWorld(true);
            }

            const box = new Box3();
            let count = 0;
            if (this.currentModelRoot && typeof this.currentModelRoot.traverse === 'function') {
                this.currentModelRoot.traverse((child: any) => {
                    if (child.isMesh && child.visible && !isHelperMesh(child.name, child)) {
                        if (child.geometry) {
                            child.geometry.computeBoundingBox();
                            box.expandByObject(child);
                            count++;
                        }
                    }
                });
            }

            if (count === 0 && this.currentModelRoot && typeof this.currentModelRoot.traverse === 'function') {
                box.setFromObject(this.currentModelRoot);
            }

            const sphere = box.getBoundingSphere(new Sphere());
            const center = sphere.center;
            const currentRadius = Math.max(sphere.radius, 0.001);

            const settings = (manifest?.boundingDimensions as any)?.appliedSettings || {};
            const autoScale = this.autoScale && settings.autoScale !== false;
            const autoCentre = this.autoCenter && settings.autoCentre !== false;

            const targetR = this.targetRadius;
            const scale = (autoScale && Math.abs(currentRadius - targetR) > 0.05)
                ? (targetR / currentRadius)
                : 1.0;

            if (autoScale && scale !== 1.0) {
                this.currentModelRoot.scale.set(scale, scale, scale);
            }

            if (autoCentre) {
                this.currentModelRoot.position.x -= center.x * scale;
                this.currentModelRoot.position.z -= center.z * scale;
            }

            if (this.currentModelRoot.updateMatrixWorld) {
                this.currentModelRoot.updateMatrixWorld(true);
            }

            const alignedBox = new Box3();
            let alignedCount = 0;
            if (this.currentModelRoot && typeof this.currentModelRoot.traverse === 'function') {
                this.currentModelRoot.traverse((child: any) => {
                    if (child.isMesh && child.visible && !isHelperMesh(child.name, child)) {
                        if (child.geometry) {
                            child.geometry.computeBoundingBox();
                            alignedBox.expandByObject(child);
                            alignedCount++;
                        }
                    }
                });
            }
            if (alignedCount === 0 && this.currentModelRoot && typeof this.currentModelRoot.traverse === 'function') {
                alignedBox.setFromObject(this.currentModelRoot);
            }

            if (alignedBox.min.y !== Infinity && !isNaN(alignedBox.min.y)) {
                this.currentModelRoot.position.y += 0 - alignedBox.min.y;
            }

            if (this.currentModelRoot.updateMatrixWorld) {
                this.currentModelRoot.updateMatrixWorld(true);
            }
            effectiveRadius = autoScale ? targetR : currentRadius;
        } catch (e) {
            console.warn('[DynamicCadLoader] Normalization calculation fallback:', e);
            effectiveRadius = 1.35;
        }

        // Enable native object shadow participation for product meshes.
        // Studio helpers/floor/contact-shadow receivers are deliberately excluded.
        this.currentModelRoot.traverse((child: any) => {
            if (!child.isMesh || !child.visible || isHelperMesh(child.name, child)) return;
            child.castShadow = true;
            child.receiveShadow = true;
        });

        const resolvedManifest = ComponentDiscovery.discoverComponents(this.currentModelRoot, manifest);
        this.currentManifest = resolvedManifest;
        this.roleBinder.bindComponents(this.currentModelRoot, resolvedManifest, isBuiltin);

        this.alignGround();

        const camera = this.viewer.scene.activeCamera;
        const autoBox = new Box3().setFromObject(this.currentModelRoot);
        const autoSphere = autoBox.getBoundingSphere(new Sphere());
        autoFrameCamera(camera, camera.controls, effectiveRadius, autoSphere.center, null, false, () => {
            camera.positionUpdated(true);
            camera.targetUpdated(true);
        });

        this.viewer.renderer.refreshPipeline();
        this.viewer.renderer.reset();

        return this.currentModelRoot;
    }

    private removeImportedAssets(objects: any): void {
        if (!objects) return;
        try {
            const arr = Array.isArray(objects) ? objects : [objects];
            for (const item of arr) {
                if (item && item.modelObject && typeof item.modelObject.removeFromParent === 'function') {
                    item.modelObject.removeFromParent();
                } else if (item && typeof item.removeFromParent === 'function') {
                    item.removeFromParent();
                }
            }
        } catch {
            // Clean-up fallback
        }
    }

    private disposeCurrentModel(): void {
        if (!this.currentModelRoot && !this.currentModelAsset) return;

        if (this.currentModelRoot) {
            try {
                if (typeof this.currentModelRoot.traverse === 'function') {
                    this.currentModelRoot.traverse((child: any) => {
                        if (child.isMesh) {
                            if (child.geometry && typeof child.geometry.dispose === 'function') {
                                child.geometry.dispose();
                            }
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach((m: any) => this.disposeMaterial(m));
                                } else {
                                    this.disposeMaterial(child.material);
                                }
                            }
                        }
                    });
                }
                if (typeof this.currentModelRoot.removeFromParent === 'function') {
                    this.currentModelRoot.removeFromParent();
                }
            } catch {
                // Disposal fallback
            }
        }

        if (this.currentModelAsset) {
            this.removeImportedAssets(this.currentModelAsset);
            this.currentModelAsset = null;
        }

        this.roleBinder.clear();
        this.currentModelRoot = null;
    }

    private disposeMaterial(mat: any): void {
        if (!mat) return;
        try {
            for (const key of Object.keys(mat)) {
                const prop = mat[key];
                if (prop && prop.isTexture && typeof prop.dispose === 'function') {
                    prop.dispose();
                }
            }
            if (typeof mat.dispose === 'function') {
                mat.dispose();
            }
        } catch {
            // Texture disposal fallback
        }
    }

    public getCurrentManifest(): ModelManifest | null {
        return this.currentManifest;
    }

    public getCurrentModelRoot(): any {
        return this.currentModelRoot;
    }

    public alignGround(): void {
        const ground = (this.viewer.getPlugin(ContactShadowGroundPlugin as any) || this.viewer.getPlugin(GroundPlugin)) as any;
        if (!ground || !this.currentModelRoot) return;

        try {
            if (this.currentModelRoot.updateMatrixWorld) {
                this.currentModelRoot.updateMatrixWorld(true);
            }

            const box = new Box3();
            let count = 0;
            if (typeof this.currentModelRoot.traverse === 'function') {
                this.currentModelRoot.traverse((child: any) => {
                    if (child.isMesh && child.visible && !isHelperMesh(child.name, child)) {
                        if (child.geometry) child.geometry.computeBoundingBox();
                        box.expandByObject(child);
                        count++;
                    }
                });
            }
            if (count === 0 && typeof this.currentModelRoot.traverse === 'function') {
                box.setFromObject(this.currentModelRoot);
            }

            if (box.min.y !== Infinity && !isNaN(box.min.y)) {
                const sphere = box.getBoundingSphere(new Sphere());
                const r = Math.max(sphere.radius || 1.35, 0.5);

                ground.size = GROUND_SIZE;
                ground.shadowScale = groundShadowScale(GROUND_SIZE, r);
                ground.shadowHeight = groundShadowHeight(r);

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

                ground.refreshOptions();
                this.viewer.scene.setDirty();
                this.viewer.renderer.reset();
            }
        } catch {
            // Ground alignment fallback
        }
    }

    public fitModel(): void {
        if (!this.currentModelRoot || typeof this.currentModelRoot.traverse !== 'function') return;
        const box = new Box3();
        let count = 0;
        this.currentModelRoot.traverse((child: any) => {
            if (child.isMesh && child.visible) {
                const name = (child.name || '').toLowerCase();
                const isHelper = /ground|floor|helper|grid|axis|shadow|gizmo|baker/i.test(name) ||
                    child.isGroundMesh || child.userData?.isGround || child.userData?.isStudioEnvironment;
                if (!isHelper) {
                    if (child.geometry) child.geometry.computeBoundingBox();
                    box.expandByObject(child);
                    count++;
                }
            }
        });
        if (count === 0) box.setFromObject(this.currentModelRoot);

        const sphere = box.getBoundingSphere(new Sphere());
        const radius = Math.max(sphere.radius, 0.5);
        const camera = this.viewer.scene.activeCamera;
        if (camera) {
            autoFrameCamera(camera, camera.controls, radius, sphere.center, null, true, () => {
                camera.positionUpdated(true);
                camera.targetUpdated(true);
            });
        }
    }

    public resetView(): void {
        const camera = this.viewer.scene.activeCamera;
        if (!camera) return;
        camera.position.set(-1.04, 2.85, 4.19);
        camera.target.set(0, 0.75, 0);
        camera.positionUpdated(true);
        camera.targetUpdated(true);
        if (camera.controls) {
            camera.controls.target.set(0, 0.75, 0);
            camera.controls.update();
        }
    }
}
```

---

## 11. Inspector UI with Real Zoom & View Presets (`RightInspector.tsx`)

**Path:** `rendering/src/playground/RightInspector.tsx`

```tsx
/**
 * RightInspector.tsx
 * Right-side Inspector Panel matching iJewel3D Playground specifications:
 * Renderer, Camera, Drop Options, Material Configurator, Switch Node, and Quick-tool rail.
 */

import React, { useState, useRef } from 'react';
import { ModelManifest, ComponentRole } from '../cad/ModelManifest';
import { GEMSTONE_PRESETS, GemstonePreset } from '../cad/MaterialRoleBinder';
import { SelectedComponentDetail } from '../inspector/InspectorPanel';
import { ViewerHost } from '../studio/ViewerHost';

interface RightInspectorProps {
    isOpen: boolean;
    onClose: () => void;

    // Model Manifest & Nodes
    manifest: ModelManifest | null;
    selectedNodeId: string | null;
    selectedDetail?: SelectedComponentDetail | null;
    onSelectNode: (nodeId: string | null) => void;
    onToggleVisibility: (nodeId: string) => void;
    onFocusNode: (nodeId: string) => void;
    onUpdateRole?: (nodeId: string, role: ComponentRole) => void;

    // Material Configurator
    onApplyMetalToSelected?: (colorHex: string, roughness: number) => void;
    onApplyGemstoneToSelected?: (preset: GemstonePreset) => void;
    onApplyMetalToAll?: (colorHex: string, roughness: number) => void;
    onApplyGemstoneToAll?: (preset: GemstonePreset) => void;
    onResetComponentMaterial?: (nodeId: string) => void;
    onResetAllMaterials?: () => void;
    onRefreshUI?: () => void;

    // Drop Options
    autoCenter: boolean;
    onToggleAutoCenter: (enabled: boolean) => void;
    autoScale: boolean;
    onToggleAutoScale: (enabled: boolean) => void;
    autoScaleRadius: number;
    onChangeAutoScaleRadius: (radius: number) => void;
    onUploadFile: (file: File) => void;
    isUploading?: boolean;

    // Camera Controls
    onResetCamera: () => void;
    onFitProduct: () => void;
    cameraFov: number;
    onChangeCameraFov: (fov: number) => void;
    autoRotate: boolean;
    onToggleAutoRotate: () => void;
    autoRotateSpeed: number;
    onChangeAutoRotateSpeed: (speed: number) => void;

    // Renderer Controls
    displayScale: number;
    onChangeDisplayScale: (scale: number) => void;
    bloomEnabled: boolean;
    onToggleBloom: (enabled: boolean) => void;
    ssrEnabled: boolean;
    onToggleSSR: (enabled: boolean) => void;
    ssaoEnabled: boolean;
    onToggleSSAO: (enabled: boolean) => void;
}

const METAL_VARIATIONS = [
    { id: '18k_yellow', name: '18K Yellow Gold', color: '#fed250', roughness: 0.08 },
    { id: '18k_white', name: '18K White Gold', color: '#eef0f2', roughness: 0.06 },
    { id: '18k_rose', name: '18K Rose Gold', color: '#f4a896', roughness: 0.08 },
    { id: 'platinum', name: 'Platinum 950', color: '#d5d7de', roughness: 0.05 },
    { id: 'black_rhodium', name: 'Black Rhodium', color: '#2d2e30', roughness: 0.15 }
];

const GEM_VARIATIONS = [
    { id: 'diamond', name: 'Brilliant Diamond', color: '#cfecec', preset: GEMSTONE_PRESETS.diamond },
    { id: 'emerald', name: 'Colombian Emerald', color: '#10b981', preset: GEMSTONE_PRESETS.emerald },
    { id: 'ruby', name: 'Vivid Ruby', color: '#ef4444', preset: GEMSTONE_PRESETS.ruby },
    { id: 'sapphire', name: 'Royal Sapphire', color: '#3b82f6', preset: GEMSTONE_PRESETS.sapphire },
    { id: 'amethyst', name: 'Amethyst', color: '#a855f7', preset: GEMSTONE_PRESETS.amethyst },
    { id: 'aquamarine', name: 'Aquamarine', color: '#38bdf8', preset: GEMSTONE_PRESETS.aquamarine }
];

export const RightInspector: React.FC<RightInspectorProps> = ({
    isOpen,
    onClose,
    manifest,
    selectedNodeId,
    selectedDetail,
    onSelectNode,
    onToggleVisibility,
    onFocusNode,
    onUpdateRole,
    onApplyMetalToSelected,
    onApplyGemstoneToSelected,
    onApplyMetalToAll,
    onApplyGemstoneToAll,
    onResetComponentMaterial,
    onResetAllMaterials,
    onRefreshUI,
    autoCenter,
    onToggleAutoCenter,
    autoScale,
    onToggleAutoScale,
    autoScaleRadius,
    onChangeAutoScaleRadius,
    onUploadFile,
    isUploading,
    onResetCamera,
    onFitProduct,
    cameraFov,
    onChangeCameraFov,
    autoRotate,
    onToggleAutoRotate,
    autoRotateSpeed,
    onChangeAutoRotateSpeed,
    displayScale,
    onChangeDisplayScale,
    bloomEnabled,
    onToggleBloom,
    ssrEnabled,
    onToggleSSR,
    ssaoEnabled,
    onToggleSSAO
}) => {
    // Collapsible section states
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
        renderer: false,
        camera: false,
        drop: false,
        materials: false,
        switchNode: false
    });

    // Material configurator states
    const [showAllMaterials, setShowAllMaterials] = useState(false);
    const [switchNodesEnabled, setSwitchNodesEnabled] = useState(true);
    const [hiddenNodes, setHiddenNodes] = useState<Record<string, boolean>>({});
    const [cameraZoom, setCameraZoom] = useState(1.0);

    const filePickerRef = useRef<HTMLInputElement>(null);

    const toggleSection = (id: string) => {
        setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleNodeVisToggle = (nodeId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setHiddenNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
        onToggleVisibility(nodeId);
    };

    const components = manifest?.components || [];
    const selectedComp = components.find(c => c.nodeId === selectedNodeId || c.nodeName === selectedNodeId) ||
        (selectedNodeId && selectedDetail ? {
            nodeId: selectedNodeId,
            nodeName: selectedDetail.nodeName,
            role: selectedDetail.role,
            sourceLayer: selectedDetail.sourceLayer || 'Default Layer'
        } : null);

    if (!isOpen) return null;

    return (
        <aside className="ijewel-right-inspector" aria-label="Viewer Inspector Panel">
            {/* Header */}
            <div className="inspector-panel-header">
                <span className="panel-title">Inspector</span>
                <button className="btn-close-inspector" onClick={onClose} title="Close Inspector" aria-label="Close">
                    &times;
                </button>
            </div>

            {/* Scrollable Accordion Content */}
            <div className="inspector-accordion-body">
                {/* 1. Renderer Section */}
                <div className="accordion-section">
                    <button
                        className="accordion-header-btn"
                        onClick={() => toggleSection('renderer')}
                        aria-expanded={!collapsedSections.renderer}
                    >
                        <span className="section-title">Renderer</span>
                        <svg
                            className={`chevron-icon ${collapsedSections.renderer ? 'collapsed' : ''}`}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {!collapsedSections.renderer && (
                        <div className="accordion-content">
                            <div className="control-row">
                                <span className="ctrl-label">Render Quality / Scale</span>
                                <div className="btn-group-segmented">
                                    <button
                                        className={`btn-segment ${displayScale <= 1.0 ? 'active' : ''}`}
                                        onClick={() => onChangeDisplayScale(1.0)}
                                    >
                                        1.0x
                                    </button>
                                    <button
                                        className={`btn-segment ${displayScale === 1.5 ? 'active' : ''}`}
                                        onClick={() => onChangeDisplayScale(1.5)}
                                    >
                                        1.5x
                                    </button>
                                    <button
                                        className={`btn-segment ${displayScale >= 2.0 ? 'active' : ''}`}
                                        onClick={() => onChangeDisplayScale(2.0)}
                                    >
                                        2.0x Retina
                                    </button>
                                </div>
                            </div>

                            <div className="control-toggle-row">
                                <span className="ctrl-label">Bloom Glow</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={bloomEnabled}
                                        onChange={e => onToggleBloom(e.target.checked)}
                                    />
                                    <span className="slider round" />
                                </label>
                            </div>

                            <div className="control-toggle-row">
                                <span className="ctrl-label">Screen Space Reflections (SSR)</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={ssrEnabled}
                                        onChange={e => onToggleSSR(e.target.checked)}
                                    />
                                    <span className="slider round" />
                                </label>
                            </div>

                            <div className="control-toggle-row">
                                <span className="ctrl-label">Ambient Occlusion (SSAO)</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={ssaoEnabled}
                                        onChange={e => onToggleSSAO(e.target.checked)}
                                    />
                                    <span className="slider round" />
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Camera Section */}
                <div className="accordion-section">
                    <button
                        className="accordion-header-btn"
                        onClick={() => toggleSection('camera')}
                        aria-expanded={!collapsedSections.camera}
                    >
                        <span className="section-title">Camera</span>
                        <svg
                            className={`chevron-icon ${collapsedSections.camera ? 'collapsed' : ''}`}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {!collapsedSections.camera && (
                        <div className="accordion-content">
                            <div className="action-buttons-grid">
                                <button
                                    className="btn-action-outline"
                                    onClick={() => {
                                        setCameraZoom(1.0);
                                        ViewerHost.getInstance().resetView();
                                        onResetCamera();
                                    }}
                                    title="Reset camera view to initial studio angle"
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                        <path d="M3 3v5h5" />
                                    </svg>
                                    <span>Reset Camera</span>
                                </button>
                                <button
                                    className="btn-action-outline"
                                    onClick={() => {
                                        ViewerHost.getInstance().fitView(true);
                                        onFitProduct();
                                    }}
                                    title="Fit and frame jewelry bounds"
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                    <span>Frame Product</span>
                                </button>
                            </div>

                            <div className="control-row">
                                <span className="ctrl-label">Camera Zoom</span>
                                <div className="control-slider-wrap">
                                    <input
                                        id="camera-zoom"
                                        type="range"
                                        min={0.70}
                                        max={2.0}
                                        step={0.05}
                                        value={cameraZoom}
                                        onChange={(e) => {
                                            const next = Number(e.currentTarget.value);
                                            setCameraZoom(next);
                                            ViewerHost.getInstance().setCameraZoom(next);
                                        }}
                                    />
                                    <span className="ctrl-val">{cameraZoom.toFixed(2)}x</span>
                                </div>
                            </div>

                            <div className="control-row">
                                <span className="ctrl-label">View Presets</span>
                                <div className="btn-group-segmented" style={{ flexWrap: 'wrap', gap: '4px' }}>
                                    <button type="button" className="btn-segment" onClick={() => ViewerHost.getInstance().setCameraView('front')}>Front</button>
                                    <button type="button" className="btn-segment" onClick={() => ViewerHost.getInstance().setCameraView('threeQuarter')}>3/4</button>
                                    <button type="button" className="btn-segment" onClick={() => ViewerHost.getInstance().setCameraView('left')}>Left</button>
                                    <button type="button" className="btn-segment" onClick={() => ViewerHost.getInstance().setCameraView('right')}>Right</button>
                                    <button type="button" className="btn-segment" onClick={() => ViewerHost.getInstance().setCameraView('top')}>Top</button>
                                </div>
                            </div>

                            <div className="control-row">
                                <span className="ctrl-label">Field of View (FOV)</span>
                                <div className="control-slider-wrap">
                                    <input
                                        type="range"
                                        min="30"
                                        max="75"
                                        step="1"
                                        value={cameraFov}
                                        onChange={e => onChangeCameraFov(parseInt(e.target.value, 10))}
                                    />
                                    <span className="ctrl-val">{cameraFov}°</span>
                                </div>
                            </div>

                            <div className="control-toggle-row">
                                <span className="ctrl-label">360 Turntable Orbit</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={autoRotate}
                                        onChange={e => onToggleAutoRotate()}
                                    />
                                    <span className="slider round" />
                                </label>
                            </div>

                            {autoRotate && (
                                <div className="control-row">
                                    <span className="ctrl-label">Orbit Speed</span>
                                    <div className="control-slider-wrap">
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="5.0"
                                            step="0.5"
                                            value={autoRotateSpeed}
                                            onChange={e => onChangeAutoRotateSpeed(parseFloat(e.target.value))}
                                        />
                                        <span className="ctrl-val">{autoRotateSpeed.toFixed(1)}x</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 3. Drop Options Section */}
                <div className="accordion-section">
                    <button
                        className="accordion-header-btn"
                        onClick={() => toggleSection('drop')}
                        aria-expanded={!collapsedSections.drop}
                    >
                        <span className="section-title">Drop Options</span>
                        <svg
                            className={`chevron-icon ${collapsedSections.drop ? 'collapsed' : ''}`}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {!collapsedSections.drop && (
                        <div className="accordion-content">
                            <div className="control-toggle-row">
                                <span className="ctrl-label">Auto Center Model</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={autoCenter}
                                        onChange={e => onToggleAutoCenter(e.target.checked)}
                                    />
                                    <span className="slider round" />
                                </label>
                            </div>

                            <div className="control-toggle-row">
                                <span className="ctrl-label">Auto Scale Geometry</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={autoScale}
                                        onChange={e => onToggleAutoScale(e.target.checked)}
                                    />
                                    <span className="slider round" />
                                </label>
                            </div>

                            {autoScale && (
                                <div className="control-row">
                                    <span className="ctrl-label">Target Bounding Radius</span>
                                    <div className="control-slider-wrap">
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="5.0"
                                            step="0.1"
                                            value={autoScaleRadius}
                                            onChange={e => onChangeAutoScaleRadius(parseFloat(e.target.value))}
                                        />
                                        <span className="ctrl-val">{autoScaleRadius.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}

                            <div className="upload-dropzone-row">
                                <input
                                    type="file"
                                    ref={filePickerRef}
                                    style={{ display: 'none' }}
                                    accept=".glb,.gltf,.3dm"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            onUploadFile(e.target.files[0]);
                                        }
                                    }}
                                />
                                <button
                                    className="btn-upload-drop"
                                    onClick={() => filePickerRef.current?.click()}
                                    disabled={isUploading}
                                >
                                    {isUploading ? (
                                        <span>Converting & Loading...</span>
                                    ) : (
                                        <>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                <polyline points="17 8 12 3 7 8" />
                                                <line x1="12" y1="3" x2="12" y2="15" />
                                            </svg>
                                            <span>Upload CAD / 3DM / GLB</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. Material Configurator Section */}
                <div className="accordion-section">
                    <button
                        className="accordion-header-btn"
                        onClick={() => toggleSection('materials')}
                        aria-expanded={!collapsedSections.materials}
                    >
                        <span className="section-title">Material Configurator</span>
                        <svg
                            className={`chevron-icon ${collapsedSections.materials ? 'collapsed' : ''}`}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {!collapsedSections.materials && (
                        <div className="accordion-content">
                            {/* Target Scope Toggle */}
                            <div className="scope-selection-bar">
                                <button
                                    className={`btn-scope ${!showAllMaterials ? 'active' : ''}`}
                                    onClick={() => setShowAllMaterials(false)}
                                >
                                    Selected Component
                                </button>
                                <button
                                    className={`btn-scope ${showAllMaterials ? 'active' : ''}`}
                                    onClick={() => setShowAllMaterials(true)}
                                >
                                    Global Model
                                </button>
                            </div>

                            {/* Active Component Info */}
                            {!showAllMaterials && (
                                <div className="selected-component-badge">
                                    <span className="badge-label">Active Part:</span>
                                    <span className="badge-name">{selectedComp?.nodeName || 'None (Click model mesh)'}</span>
                                    {selectedComp && (
                                        <span className="badge-role">{selectedComp.role}</span>
                                    )}
                                </div>
                            )}

                            {/* Metal Finishes */}
                            <div className="configurator-group">
                                <span className="group-title">Precious Metals</span>
                                <div className="swatches-grid">
                                    {METAL_VARIATIONS.map(m => (
                                        <button
                                            key={m.id}
                                            className="btn-swatch-card"
                                            title={m.name}
                                            onClick={() => {
                                                if (showAllMaterials) {
                                                    onApplyMetalToAll?.(m.color, m.roughness);
                                                } else {
                                                    onApplyMetalToSelected?.(m.color, m.roughness);
                                                }
                                                onRefreshUI?.();
                                            }}
                                        >
                                            <span className="color-pip" style={{ backgroundColor: m.color }} />
                                            <span className="swatch-name">{m.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Gemstone Presets */}
                            <div className="configurator-group">
                                <span className="group-title">Faceted Gemstones</span>
                                <div className="swatches-grid">
                                    {GEM_VARIATIONS.map(g => (
                                        <button
                                            key={g.id}
                                            className="btn-swatch-card"
                                            title={g.name}
                                            onClick={() => {
                                                if (showAllMaterials) {
                                                    onApplyGemstoneToAll?.(g.preset);
                                                } else {
                                                    onApplyGemstoneToSelected?.(g.preset);
                                                }
                                                onRefreshUI?.();
                                            }}
                                        >
                                            <span className="color-pip gem-pip" style={{ backgroundColor: g.color }} />
                                            <span className="swatch-name">{g.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Reset Actions */}
                            <div className="material-actions-row">
                                {!showAllMaterials && selectedNodeId && (
                                    <button
                                        className="btn-reset-material"
                                        onClick={() => onResetComponentMaterial?.(selectedNodeId)}
                                    >
                                        Reset Selected Material
                                    </button>
                                )}
                                <button
                                    className="btn-reset-material outline"
                                    onClick={() => onResetAllMaterials?.()}
                                >
                                    Reset All Materials
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 5. Switch Node Section */}
                <div className="accordion-section">
                    <button
                        className="accordion-header-btn"
                        onClick={() => toggleSection('switchNode')}
                        aria-expanded={!collapsedSections.switchNode}
                    >
                        <span className="section-title">Switch Node</span>
                        <svg
                            className={`chevron-icon ${collapsedSections.switchNode ? 'collapsed' : ''}`}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {!collapsedSections.switchNode && (
                        <div className="accordion-content">
                            <div className="control-toggle-row">
                                <span className="ctrl-label">Node Switch Mode</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={switchNodesEnabled}
                                        onChange={e => setSwitchNodesEnabled(e.target.checked)}
                                    />
                                    <span className="slider round" />
                                </label>
                            </div>

                            {components.length === 0 ? (
                                <div className="empty-nodes-notice">
                                    <span>No model components identified yet.</span>
                                </div>
                            ) : (
                                <ul className="node-switch-list" role="list">
                                    {components.map((comp) => {
                                        const isSelected = selectedNodeId === comp.nodeId || selectedNodeId === comp.nodeName;
                                        const isHidden = !!hiddenNodes[comp.nodeId];
                                        return (
                                            <li
                                                key={comp.nodeId}
                                                className={`node-switch-item ${isSelected ? 'selected' : ''}`}
                                                onClick={() => onSelectNode(comp.nodeId)}
                                            >
                                                <button
                                                    className="btn-node-vis"
                                                    title={isHidden ? "Show component" : "Hide component"}
                                                    onClick={(e) => handleNodeVisToggle(comp.nodeId, e)}
                                                >
                                                    {isHidden ? (
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                            <line x1="1" y1="1" x2="23" y2="23" />
                                                        </svg>
                                                    ) : (
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                            <circle cx="12" cy="12" r="3" />
                                                        </svg>
                                                    )}
                                                </button>

                                                <span className="node-item-name" title={comp.nodeName}>{comp.nodeName}</span>

                                                <span className={`node-role-tag ${comp.role}`}>
                                                    {comp.role.replace('metal_', '')}
                                                </span>

                                                <button
                                                    className="btn-focus-node"
                                                    title="Zoom to component"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onFocusNode(comp.nodeId);
                                                    }}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <circle cx="11" cy="11" r="8" />
                                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                                    </svg>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
};
```

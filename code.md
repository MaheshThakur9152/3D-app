# Complete 3D Jewelry Studio Source Code (`code.md`)

This file contains the complete, unabridged, and un-truncated implementation source code for the 3D Jewelry Studio:
1. **3D World Stage Orchestrator**: `StudioWorld.ts`
2. **3D Plane / Platform**: `StudioFloor.ts`
3. **Ground & Shadow Pure Math**: `groundMath.ts`
4. **Studio Environment & Black/Neutral Background**: `StudioEnvironment.ts`
5. **Physical 3-Point Studio Lighting Rig**: `StudioLighting.ts`
6. **Shadow & Studio Settings**: `StudioSettings.ts`
7. **Camera Framing & Elevation**: `CameraFraming.ts`
8. **Metal & Diamond Shaders**: `MaterialRoleBinder.ts`
9. **WebGi Engine Lifecycle & Viewport Host**: `ViewerHost.ts`
10. **CAD Model Normalization, Grounding & Centering**: `DynamicCadLoader.ts`

---

## 1. 3D World Stage Orchestrator (`StudioWorld.ts`)

**Path:** `rendering/src/studio/StudioWorld.ts`

```typescript
/**
 * StudioWorld.ts
 * Manages the persistent 3D jewelry studio environment:
 * - StudioFloor: Finite square studio ground plane at Y = 0.
 * - StudioLighting: Calibrated 3-point studio lighting rig.
 * - StudioEnvironment: Procedural studio HDRI canvas with softboxes.
 */

import { ViewerApp, Color } from "webgi";
import { StudioFloor } from "./StudioFloor";
import { StudioLighting } from "./StudioLighting";
import { StudioEnvironment } from "./StudioEnvironment";

export class StudioWorld {
    private viewer: ViewerApp;
    private _floor: StudioFloor | null = null;
    private _lighting: StudioLighting | null = null;
    private _environment: StudioEnvironment | null = null;
    private initialized = false;

    constructor(viewer: ViewerApp) {
        this.viewer = viewer;
    }

    public async init(presetId = 'white'): Promise<void> {
        if (this.initialized) return;

        // 1. Create finite square studio floor at world origin Y = 0
        this._floor = new StudioFloor(this.viewer);
        this._floor.init(5.0, '#ffffff');

        // 2. Setup 3-point studio lighting rig
        this._lighting = new StudioLighting(this.viewer);
        this._lighting.init();

        // 3. Create procedural HDRI studio environment with softboxes
        this._environment = new StudioEnvironment(this.viewer);
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
            this._floor?.setColor('#ffffff');
            this._floor?.setRoughness(0.88);
            this._lighting?.setIntensity(1.0);
            this._environment?.setIntensity(1.0);
        }

        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
    }

    public setBackgroundColor(hex: string): void {
        const bgColor = new Color(hex).convertSRGBToLinear();
        this.viewer.setBackground(bgColor);
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
 * Finite square studio ground plane at Y = 0.
 * Serves as the visible platform inside the jewelry studio.
 * Uses MeshStandardMaterial2 with controllable roughness and color.
 */

import { ViewerApp, Mesh, PlaneGeometry, MeshStandardMaterial2, Color } from "webgi";

export class StudioFloor {
    private viewer: ViewerApp;
    private mesh: any | null = null;
    private material: any | null = null;
    private size: number = 5.0;
    private color: string = '#ffffff';
    private roughness: number = 0.88;
    private metalness: number = 0.0;
    private visible: boolean = true;

    constructor(viewer: ViewerApp) {
        this.viewer = viewer;
    }

    public init(size = 5.0, color = '#ffffff'): void {
        if (this.mesh) return;

        this.size = size;
        this.color = color;

        // Create finite square plane geometry
        const geom = new PlaneGeometry(this.size, this.size, 1, 1);

        // Material configured as neutral non-distracting studio floor
        this.material = new MeshStandardMaterial2({
            color: new Color(this.color).convertSRGBToLinear(),
            roughness: this.roughness,
            metalness: this.metalness
        });

        // Anti-z-fighting with ContactShadowGroundPlugin depth map
        this.material.polygonOffset = true;
        this.material.polygonOffsetFactor = 1.0;
        this.material.polygonOffsetUnits = 1.0;

        // Create mesh oriented horizontally facing +Y, positioned at Y = 0
        this.mesh = new Mesh(geom, this.material);
        this.mesh.name = 'StudioPlatformFloor';
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.position.set(0, 0, 0);

        // Mark as ground mesh so bounding box calculations and helpers ignore it
        this.mesh.isGroundMesh = true;
        this.mesh.userData = {
            isGround: true,
            isStudioFloor: true,
            isHelper: true
        };

        // Add to active scene
        const scene = this.viewer.scene;
        if ((scene as any).modelRoot) {
            (scene as any).modelRoot.add(this.mesh);
        } else if (scene && typeof (scene as any).add === 'function') {
            (scene as any).add(this.mesh);
        }

        this.mesh.updateMatrixWorld?.(true);
    }

    public setColor(hex: string): void {
        this.color = hex;
        if (this.material) {
            const linearColor = new Color(hex).convertSRGBToLinear();
            if (this.material.color && typeof this.material.color.copy === 'function') {
                this.material.color.copy(linearColor);
            } else {
                this.material.color = linearColor;
            }
            this.material.needsUpdate = true;
        }
    }

    public setRoughness(roughness: number): void {
        this.roughness = Math.max(0.0, Math.min(1.0, roughness));
        if (this.material) {
            this.material.roughness = this.roughness;
            this.material.needsUpdate = true;
        }
    }

    public setSize(size: number): void {
        this.size = Math.max(1.0, Math.min(50.0, size));
        if (this.mesh) {
            this.mesh.scale.set(this.size / 5.0, this.size / 5.0, 1.0);
            this.mesh.updateMatrixWorld?.(true);
        }
    }

    public setVisible(visible: boolean): void {
        this.visible = visible;
        if (this.mesh) {
            this.mesh.visible = visible;
        }
    }

    public getMesh(): any | null {
        return this.mesh;
    }

    public dispose(): void {
        if (this.mesh) {
            this.mesh.removeFromParent?.();
            this.mesh.geometry?.dispose();
            this.material?.dispose();
            this.mesh = null;
            this.material = null;
        }
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

// Finite visible square studio floor extent for jewelry models.
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

## 4. Studio Environment & HDR Canvas (`StudioEnvironment.ts`)

**Path:** `rendering/src/studio/StudioEnvironment.ts`

```typescript
/**
 * StudioEnvironment.ts
 * Procedural Equirectangular Studio Environment Map with Softboxes.
 * Synthesizes a clean studio lighting environment without external network latency,
 * providing realistic metallic reflections and diamond brilliance.
 */

import { ViewerApp, CanvasTexture } from "webgi";

export class StudioEnvironment {
    private viewer: ViewerApp;
    private canvas: HTMLCanvasElement | null = null;
    private texture: any | null = null;
    private intensity = 1.0;

    constructor(viewer: ViewerApp) {
        this.viewer = viewer;
    }

    public async init(): Promise<void> {
        this.generateStudioCanvas();
        this.applyToScene();
    }

    private generateStudioCanvas(): void {
        const width = 1024;
        const height = 512;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Base gradient: Neutral studio fill (slight vertical gradient)
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#55555e');
        bgGrad.addColorStop(0.4, '#80808a');
        bgGrad.addColorStop(0.6, '#90909c');
        bgGrad.addColorStop(1, '#656570');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Softbox 1: Overhead Main Softbox (creates clean top highlights on metal shanks & table facets)
        this.drawSoftbox(ctx, {
            x: width * 0.5,
            y: height * 0.22,
            radiusX: width * 0.22,
            radiusY: height * 0.14,
            intensity: 1.0,
            color: '255, 255, 255'
        });

        // Softbox 2: 45° Key Light (sharp front-left specular reflections)
        this.drawSoftbox(ctx, {
            x: width * 0.25,
            y: height * 0.38,
            radiusX: width * 0.14,
            radiusY: height * 0.22,
            intensity: 0.95,
            color: '255, 255, 255'
        });

        // Softbox 3: Fill Light (soft right-side gradient)
        this.drawSoftbox(ctx, {
            x: width * 0.78,
            y: height * 0.42,
            radiusX: width * 0.16,
            radiusY: height * 0.25,
            intensity: 0.7,
            color: '240, 245, 255'
        });

        // Softbox 4: Rim/Backlight (scintillation on pavilion facets)
        this.drawSoftbox(ctx, {
            x: width * 0.5,
            y: height * 0.75,
            radiusX: width * 0.28,
            radiusY: height * 0.12,
            intensity: 0.85,
            color: '255, 255, 255'
        });

        // Contrast accents (narrow strip softboxes for high-frequency diamond facet reflections)
        this.drawStripLight(ctx, width * 0.12, height * 0.3, width * 0.02, height * 0.4, '255, 255, 255', 0.9);
        this.drawStripLight(ctx, width * 0.88, height * 0.3, width * 0.02, height * 0.4, '255, 255, 255', 0.9);

        this.canvas = canvas;
    }

    private drawSoftbox(
        ctx: CanvasRenderingContext2D,
        opts: { x: number; y: number; radiusX: number; radiusY: number; intensity: number; color: string }
    ): void {
        ctx.save();
        ctx.translate(opts.x, opts.y);
        ctx.scale(opts.radiusX, opts.radiusY);

        const radGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        radGrad.addColorStop(0, `rgba(${opts.color}, ${opts.intensity})`);
        radGrad.addColorStop(0.4, `rgba(${opts.color}, ${opts.intensity * 0.8})`);
        radGrad.addColorStop(0.7, `rgba(${opts.color}, ${opts.intensity * 0.3})`);
        radGrad.addColorStop(1, `rgba(${opts.color}, 0)`);

        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    private drawStripLight(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        color: string,
        intensity: number
    ): void {
        ctx.save();
        const grad = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        grad.addColorStop(0, `rgba(${color}, 0)`);
        grad.addColorStop(0.5, `rgba(${color}, ${intensity})`);
        grad.addColorStop(1, `rgba(${color}, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(x - w / 2, y, w, h);
        ctx.restore();
    }

    private applyToScene(): void {
        if (!this.canvas) return;

        try {
            const texture = new CanvasTexture(this.canvas);
            texture.mapping = 303; // EquirectangularReflectionMapping
            texture.needsUpdate = true;
            (texture as any).assetType = 'texture';

            const scene = this.viewer.scene;
            if (scene) {
                if (typeof (scene as any).setEnvironment === 'function') {
                    (scene as any).setEnvironment(texture);
                } else {
                    scene.environment = texture;
                }
                scene.environmentIntensity = this.intensity;
                scene.setDirty();
            }

            this.texture = texture;
            this.viewer.renderer.reset();
        } catch (e) {
            console.warn('[StudioEnvironment] Texture environment assignment:', e);
        }
    }

    public setIntensity(intensity: number): void {
        this.intensity = Math.max(0.1, Math.min(3.0, intensity));
        if (this.viewer.scene) {
            this.viewer.scene.environmentIntensity = this.intensity;
            this.viewer.scene.setDirty();
        }
    }

    public dispose(): void {
        if (this.texture) {
            this.texture.dispose?.();
            this.texture = null;
        }
        this.canvas = null;
    }
}
```

---

## 5. Physical 3-Point Lighting Rig (`StudioLighting.ts`)

**Path:** `rendering/src/studio/StudioLighting.ts`

```typescript
/**
 * StudioLighting.ts
 * Physical 3-point studio lighting rig for jewelry hero presentation:
 * - Key Light: Warm directional light (45° angle, high elevation).
 * - Fill Light: Soft cool light opposite the key light.
 * - Rim / Back Light: Cool grazing light behind jewelry for facet edge definition.
 * - Ambient Light: Low-intensity base fill.
 */

import { ViewerApp, DirectionalLight, AmbientLight, Color } from "webgi";

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
        const scene = this.viewer.scene;
        const targetContainer = (scene as any).modelRoot || scene;

        // 1. Key Light: Main specular light from front-top-right (elevation 45°, azimuth 35°)
        this.keyLight = new DirectionalLight(new Color('#ffffff').convertSRGBToLinear(), 2.2);
        this.keyLight.name = 'StudioKeyLight';
        this.keyLight.position.set(2.5, 4.0, 3.0);
        this.keyLight.castShadow = false; // Contact shadows handled by ContactShadowGroundPlugin
        this.keyLight.userData = { isStudioEnvironment: true };
        targetContainer.add(this.keyLight);

        // 2. Fill Light: Soft neutral fill from front-left (elevation 25°, azimuth -45°)
        this.fillLight = new DirectionalLight(new Color('#f4f6fa').convertSRGBToLinear(), 1.2);
        this.fillLight.name = 'StudioFillLight';
        this.fillLight.position.set(-3.0, 2.5, 2.5);
        this.fillLight.castShadow = false;
        this.fillLight.userData = { isStudioEnvironment: true };
        targetContainer.add(this.fillLight);

        // 3. Rim / Hair Light: High-angle back light for diamond scintillation & edge separation
        this.rimLight = new DirectionalLight(new Color('#ffffff').convertSRGBToLinear(), 1.8);
        this.rimLight.name = 'StudioRimLight';
        this.rimLight.position.set(0.0, 4.5, -3.5);
        this.rimLight.castShadow = false;
        this.rimLight.userData = { isStudioEnvironment: true };
        targetContainer.add(this.rimLight);

        // 4. Ambient Base Fill: Low intensity to prevent pitch-black undercuts
        this.ambientLight = new AmbientLight(new Color('#ffffff').convertSRGBToLinear(), 0.6);
        this.ambientLight.name = 'StudioAmbientLight';
        this.ambientLight.userData = { isStudioEnvironment: true };
        targetContainer.add(this.ambientLight);

        this.updateTargets();
    }

    private updateTargets(): void {
        const targetPos = { x: 0, y: 0.8, z: 0 };
        if (this.keyLight && this.keyLight.target) {
            this.keyLight.target.position.set(targetPos.x, targetPos.y, targetPos.z);
            this.keyLight.target.updateMatrixWorld?.(true);
        }
        if (this.fillLight && this.fillLight.target) {
            this.fillLight.target.position.set(targetPos.x, targetPos.y, targetPos.z);
            this.fillLight.target.updateMatrixWorld?.(true);
        }
        if (this.rimLight && this.rimLight.target) {
            this.rimLight.target.position.set(targetPos.x, targetPos.y, targetPos.z);
            this.rimLight.target.updateMatrixWorld?.(true);
        }
    }

    public setIntensity(multiplier: number): void {
        this.intensityMultiplier = Math.max(0.1, Math.min(3.0, multiplier));
        if (this.keyLight) this.keyLight.intensity = 2.2 * this.intensityMultiplier;
        if (this.fillLight) this.fillLight.intensity = 1.2 * this.intensityMultiplier;
        if (this.rimLight) this.rimLight.intensity = 1.8 * this.intensityMultiplier;
        if (this.ambientLight) this.ambientLight.intensity = 0.6 * this.intensityMultiplier;
    }

    public dispose(): void {
        this.keyLight?.removeFromParent?.();
        this.fillLight?.removeFromParent?.();
        this.rimLight?.removeFromParent?.();
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
        ground.visible = this.config.groundVisible && this.config.groundShadows;
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
        const ground = this.getGround();
        if (ground) {
            ground.visible = visible;
            ground.refreshOptions();
        }
        if (this.studioFloor) {
            this.studioFloor.setVisible(visible);
        }
        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
        this.saveSettings();
    }

    public setGroundShadows(enabled: boolean): void {
        this.config.groundShadows = enabled;
        const ground = this.getGround();
        if (ground) {
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

## 7. Camera Framing & Elevation (`CameraFraming.ts`)

**Path:** `rendering/src/cad/CameraFraming.ts`

```typescript
/**
 * CameraFraming.ts
 * Frustum-aware camera auto-framing and orbit control normalization without stutter.
 * Uses calibrated WebGi orbit ray (-0.17, -0.25, distance) to align with OrbitControls.
 */

import gsap from "gsap";

export function autoFrameCamera(
    camera: any,
    controls: any,
    boundingRadius: number,
    productCenter?: { x: number; y: number; z: number } | null,
    viewportAspect?: number | null,
    animate = true,
    onFrameUpdate?: () => void
): void {
    if (!camera) return;

    const radius = Math.max(0.5, boundingRadius || 1.35);
    const targetY = productCenter && productCenter.y !== undefined ? productCenter.y : 0.8;
    const targetX = productCenter && productCenter.x !== undefined ? productCenter.x : 0.0;
    const targetZ = productCenter && productCenter.z !== undefined ? productCenter.z : 0.0;

    // Measure actual central viewport dimensions from canvas or provided aspect
    let aspect = viewportAspect || 1.0;
    if (!viewportAspect) {
        const canvas = camera._container || camera.cameraObject?.domElement || (typeof document !== 'undefined' && document.getElementById('webgi-canvas'));
        if (canvas && canvas.clientWidth > 0 && canvas.clientHeight > 0) {
            aspect = canvas.clientWidth / canvas.clientHeight;
        } else if (camera.aspect) {
            aspect = camera.aspect;
        } else if (typeof window !== 'undefined' && window.innerWidth > 0 && window.innerHeight > 0) {
            aspect = window.innerWidth / window.innerHeight;
        }
    }

    const fovY = ((camera.cameraObject?.fov || camera.fov || camera.getCameraOptions?.()?.fov || 45) * Math.PI) / 180;
    const fovX = 2 * Math.atan(Math.tan(fovY / 2) * Math.max(0.6, aspect));
    const effectiveFov = Math.min(fovY, fovX);

    // Target 60% coverage so jewelry is primary subject while finite square platform edges remain visible
    const targetCoverage = 0.60;
    const distance = radius / (Math.tan(effectiveFov / 2) * targetCoverage);

    // Adjust camera orbit clamping limits to prevent clipping while allowing close inspection
    if (controls) {
        controls.minDistance = Math.max(0.8, radius * 0.75);
        controls.maxDistance = Math.max(12.0, radius * 6.0);
        controls.target.set(targetX, targetY, targetZ);
    }

    // Controlled elevated perspective (~26 deg elevation, -14 deg 3/4 azimuth) for jewelry hero presentation
    const elev = (26 * Math.PI) / 180;
    const azim = (-14 * Math.PI) / 180;
    const camX = targetX + Math.sin(azim) * Math.cos(elev) * distance;
    const camY = targetY + Math.sin(elev) * distance;
    const camZ = targetZ + Math.cos(azim) * Math.cos(elev) * distance;

    if (!animate) {
        camera.position.set(camX, camY, camZ);
        camera.target.set(targetX, targetY, targetZ);
        camera.positionUpdated(true);
        camera.targetUpdated(true);
        if (controls) controls.update();
        return;
    }

    // Pause auto-rotate during transition so it doesn't fight GSAP
    const prevAutoRotate = controls ? controls.autoRotate : false;
    if (controls) controls.autoRotate = false;

    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(camera.target);

    gsap.to(camera.position, {
        x: camX,
        y: camY,
        z: camZ,
        duration: 0.8,
        ease: "power2.inOut",
        onUpdate: () => {
            camera.positionUpdated(true);
            camera.targetUpdated(true);
            if (onFrameUpdate) onFrameUpdate();
        },
        onComplete: () => {
            if (controls) {
                controls.autoRotate = prevAutoRotate;
                controls.update();
            }
        }
    });

    gsap.to(camera.target, {
        x: targetX,
        y: targetY,
        z: targetZ,
        duration: 0.8,
        ease: "power2.inOut"
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
        const studioWorld = new StudioWorld(viewer);
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
            camera.controls.minDistance = 0.8;
            camera.controls.maxDistance = 25.0;
            camera.controls.enablePan = false;
            camera.controls.screenSpacePanning = false;
            camera.controls.target.set(0, 0.75, 0);
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

    public fitView(animate = true) {
        if (!this.viewer) return;
        const camera = this.viewer.scene.activeCamera;
        let radius = 1.35;
        let center: { x: number; y: number; z: number } = { x: 0, y: 0.8, z: 0 };
        const root = this.dynamicLoader?.getCurrentModelRoot();
        if (root && typeof root.traverse === 'function') {
            if (root.updateMatrixWorld) root.updateMatrixWorld(true);
            const box = new Box3();
            let count = 0;
            root.traverse((child: any) => {
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
            if (count > 0) {
                const sphere = box.getBoundingSphere(new Sphere());
                if (sphere.radius > 0.05) {
                    radius = sphere.radius;
                }
                center = { x: sphere.center.x, y: sphere.center.y, z: sphere.center.z };
            }
        } else {
            const manifest = this.dynamicLoader?.getCurrentManifest();
            radius = (manifest?.boundingDimensions as any)?.normalizedRadius || manifest?.boundingDimensions?.boundingRadius || 1.35;
        }

        autoFrameCamera(camera, camera.controls, radius, center, null, animate, () => {
            camera.positionUpdated(true);
            camera.targetUpdated(true);
        });
    }

    public resetView() {
        if (!this.dynamicLoader) return;
        this.dynamicLoader.resetView();
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

## 10. CAD Normalization, Grounding & Centering (`DynamicCadLoader.ts`)

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

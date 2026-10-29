/**
 * StudioSettings.ts
 * Manages studio background presets, GroundPlugin contact shadows,
 * reflections, environment lighting intensity and rotation with localStorage persistence.
 */

import { ViewerApp, Color, GroundPlugin, ContactShadowGroundPlugin } from "webgi";

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
        hex: '#ffffff',
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
            matObj.roughness = this.config.groundReflections ? 0.25 : 1.0;
            matObj.metalness = 0.0;
            if (this.config.groundShadows) {
                matObj.opacity = this.config.shadowIntensity;
            } else {
                matObj.opacity = 0.0;
            }
            if (matObj.userData) {
                matObj.userData.ssreflDisabled = !this.config.groundReflections;
                matObj.userData.ssreflNonPhysical = !this.config.groundReflections;
            }
            matObj.needsUpdate = true;
        }

        ground.tonemapGround = true;
        ground.visible = this.config.groundVisible;
        ground.contactShadows = this.config.groundShadows;
        ground.groundReflection = this.config.groundReflections;
        if ('blurAmount' in ground) {
            ground.blurAmount = this.config.shadowSoftness;
        }

        ground.refreshOptions();
        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
    }

    public setGroundVisible(visible: boolean): void {
        this.config.groundVisible = visible;
        const ground = this.getGround();
        if (ground) {
            ground.visible = visible;
            ground.refreshOptions();
            this.viewer.scene.setDirty();
            this.viewer.renderer.reset();
        }
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

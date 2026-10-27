/**
 * StudioSettings.ts
 * Manages studio background presets, GroundPlugin contact shadows,
 * reflections, environment lighting intensity and rotation with localStorage persistence.
 */

import { ViewerApp, Color, GroundPlugin } from "webgi";

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
        this.configureGroundAppearance(preset.hex);
        this.saveSettings();
    }

    public setCustomColor(hex: string): void {
        this.config.presetId = 'custom';
        this.config.customColor = hex;
        this.applyBackgroundColor(hex);
        this.configureGroundAppearance(hex);
        this.saveSettings();
    }

    private applyBackgroundColor(hex: string): void {
        const bgColor = new Color(hex).convertSRGBToLinear();
        this.viewer.setBackground(bgColor);
        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
    }

    public configureGroundAppearance(bgHex?: string): void {
        const ground = this.viewer.getPlugin(GroundPlugin);
        if (!ground) return;

        const currentHex = bgHex || (this.config.customColor || STUDIO_PRESETS[this.config.presetId]?.hex || '#ffffff');
        const groundColor = new Color(currentHex).convertSRGBToLinear();

        // Tune GroundPlugin MeshStandardMaterial2 for natural matte studio floor
        if (ground.material) {
            ground.material.color = groundColor;
            ground.material.roughness = 0.45;
            ground.material.metalness = 0.0;
            ground.material.needsUpdate = true;
        }

        ground.tonemapGround = true;
        ground.bakedShadows = this.config.groundShadows;
        ground.groundReflection = this.config.groundReflections;

        // Configure ShadowMapBaker for soft, realistic contact shadow
        this.tuneShadowBaker(ground);

        ground.refreshOptions();
        this.viewer.scene.setDirty();
        this.viewer.renderer.reset();
    }

    public tuneShadowBaker(ground: GroundPlugin, boundingRadius = 1.35): void {
        const baker = ground.shadowBaker;
        if (!baker) return;

        try {
            baker.enabled = this.config.groundShadows;
            baker.groundMapMode = 'alphaMap'; // Alpha blend over clean backdrop
            baker.alphaVignette = true; // Radial soft penumbra falloff (no box edges)
            baker.maxFrameNumber = 32; // Progressive accumulation
            baker.shadowAutoUpdate = true;

            const r = Math.max(0.5, boundingRadius);
            const light = baker.light;
            if (light && light.shadowParams) {
                // Focus shadow frustum tightly on ring contact area (compact, non-diffuse)
                light.shadowParams.frustumSize = Math.max(3.2, r * 2.4);
                light.shadowParams.radius = 2.0; // Soft contact penumbra
                light.shadowParams.bias = -0.0001; // Avoid shadow acne
                light.shadowParams.normalBias = 0.001; // Prevent contact detachment
                light.shadowParams.near = 0.5;
                light.shadowParams.far = 15.0;
                light.updateShadowParams();
            }

            if (light && light.randomParams) {
                light.randomParams.focus = 0.85; // Directed downward contact light
                light.randomParams.spread = 0.35; // Natural subtle softening
            }

            baker.reset();
        } catch {
            // Shadow baker configuration fallback
        }
    }

    public setGroundVisible(visible: boolean): void {
        this.config.groundVisible = visible;
        const ground = this.viewer.getPlugin(GroundPlugin);
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
        const ground = this.viewer.getPlugin(GroundPlugin);
        if (ground) {
            ground.bakedShadows = enabled;
            if (ground.shadowBaker) {
                ground.shadowBaker.enabled = enabled;
                ground.shadowBaker.reset();
            }
            ground.refreshOptions();
            this.viewer.scene.setDirty();
            this.viewer.renderer.reset();
        }
        this.saveSettings();
    }

    public setGroundReflections(enabled: boolean): void {
        this.config.groundReflections = enabled;
        const ground = this.viewer.getPlugin(GroundPlugin);
        if (ground) {
            ground.groundReflection = enabled;
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

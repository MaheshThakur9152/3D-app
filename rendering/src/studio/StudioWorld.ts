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

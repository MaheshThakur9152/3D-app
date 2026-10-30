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

        // KEY: subtle directional light to cast soft grounding shadows without washing out HDR reflections.
        this.keyLight = new DirectionalLight(
            new Color('#FFF8EE').convertSRGBToLinear(),
            0.30
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
            0.05
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
            0.10
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
            0.04
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
        if (this.keyLight) this.keyLight.intensity = 0.30 * this.intensityMultiplier;
        if (this.fillLight) this.fillLight.intensity = 0.05 * this.intensityMultiplier;
        if (this.rimLight) this.rimLight.intensity = 0.10 * this.intensityMultiplier;
        if (this.ambientLight) this.ambientLight.intensity = 0.04 * this.intensityMultiplier;
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

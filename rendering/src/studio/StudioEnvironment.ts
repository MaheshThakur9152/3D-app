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

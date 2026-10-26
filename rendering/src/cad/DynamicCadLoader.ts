/**
 * DynamicCadLoader.ts
 * Manages loading custom CAD-generated GLB models into the existing WebGi viewer,
 * handling resource disposal, temporal accumulation reset, and camera auto-framing.
 */

import { ViewerApp, AssetManagerPlugin, Box3, Sphere, ProgressivePlugin } from "webgi";
import { ModelManifest } from "./ModelManifest";
import { MaterialRoleBinder } from "./MaterialRoleBinder";
import { ComponentDiscovery } from "./ComponentDiscovery";
import { autoFrameCamera } from "./CameraFraming";

export class DynamicCadLoader {
    private viewer: ViewerApp;
    private manager: AssetManagerPlugin;
    private roleBinder: MaterialRoleBinder;
    private currentModelRoot: any = null;
    private currentManifest: ModelManifest | null = null;
    private loadToken = 0;

    constructor(viewer: ViewerApp, manager: AssetManagerPlugin, roleBinder: MaterialRoleBinder) {
        this.viewer = viewer;
        this.manager = manager;
        this.roleBinder = roleBinder;
    }

    public async loadModel(
        glbUrl: string,
        manifest?: ModelManifest | null,
        onProgress?: (ratio: number) => void
    ): Promise<any> {
        const token = ++this.loadToken;

        // 1. Reset temporal rendering buffers to eliminate ghosting
        this.viewer.renderer.reset();
        const progressive = this.viewer.getPlugin(ProgressivePlugin);
        if (progressive && typeof (progressive as any).reset === 'function') {
            (progressive as any).reset();
        }

        // 2. Safely unload and dispose previous model resources
        this.disposeCurrentModel();

        // 3. Load GLB via existing WebGi AssetManagerPlugin
        const objects = await this.manager.addFromPath(glbUrl);
        if (token !== this.loadToken) return null; // Cancelled by newer load

        this.currentModelRoot = (objects && objects[0]) ? objects[0] : (this.viewer.scene.modelRoot as any);

        // 4. Viewport scale normalization
        // Calculate true 3D bounding sphere
        try {
            const box = new Box3().setFromObject(this.currentModelRoot);
            const sphere = box.getBoundingSphere(new Sphere());

            if (sphere.radius > 3.0) {
                // CAD model in mm scale (15-30 mm); normalize to WebGi 1.35 unit studio scale
                const scale = 1.35 / sphere.radius;
                this.currentModelRoot.scale.set(scale, scale, scale);
                this.currentModelRoot.position.set(-sphere.center.x * scale, -sphere.center.y * scale, -sphere.center.z * scale);
                this.currentModelRoot.updateMatrixWorld(true);
            }
        } catch {
            // Normalization fallback
        }

        // 5. Discover components and bind materials
        const resolvedManifest = ComponentDiscovery.discoverComponents(this.currentModelRoot, manifest);
        this.currentManifest = resolvedManifest;
        this.roleBinder.bindComponents(this.currentModelRoot, resolvedManifest);

        // 6. Camera auto-framing with true dimensions
        const camera = this.viewer.scene.activeCamera;
        const radius = (resolvedManifest.boundingDimensions && (resolvedManifest.boundingDimensions as any).normalizedRadius)
            ? (resolvedManifest.boundingDimensions as any).normalizedRadius
            : 1.35;

        autoFrameCamera(camera, camera.controls, radius, true, () => {
            camera.positionUpdated(true);
            camera.targetUpdated(true);
        });

        // 7. Refresh rendering pipeline and reset accumulator
        this.viewer.renderer.refreshPipeline();
        this.viewer.renderer.reset();

        return this.currentModelRoot;
    }

    private disposeCurrentModel(): void {
        if (!this.currentModelRoot) return;

        try {
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
        } catch {
            // Disposal fallback
        }

        this.viewer.scene.removeSceneModels();
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
}

/**
 * DynamicCadLoader.ts
 * Manages loading custom CAD-generated GLB models into the existing WebGi viewer,
 * handling resource disposal, temporal accumulation reset, and camera auto-framing.
 */

import { ViewerApp, AssetManagerPlugin, Box3, Sphere, ProgressivePlugin, GroundPlugin } from "webgi";
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

        // WebGi addFromPath returns ISceneObject[] (IModel wrappers), not Object3D.
        // Extract the actual Three.js Object3D via .modelObject.
        const firstObj = objects && objects[0];
        const rawRoot = firstObj
            ? ((firstObj as any).modelObject || firstObj)
            : ((this.viewer.scene.modelRoot as any)?.modelObject || this.viewer.scene.modelRoot);

        // Validate we have a real Object3D with traverse before proceeding
        if (!rawRoot || typeof rawRoot.traverse !== 'function') {
            console.error('[DynamicCadLoader] Loaded asset has no traversable Object3D root:', rawRoot);
            this.currentModelRoot = null;
            return null;
        }
        this.currentModelRoot = rawRoot;

        // 4. Viewport scale normalization for CAD/custom uploads
        const isBuiltin = glbUrl.includes('assets/ring');
        let effectiveRadius = 1.35;

        try {
            if (!isBuiltin) {
                const box = new Box3();
                let count = 0;
                if (this.currentModelRoot && this.currentModelRoot.traverse) {
                    this.currentModelRoot.traverse((child: any) => {
                        if (child.isMesh && child.visible) {
                            const name = (child.name || '').toLowerCase();
                            const isConstruction = /curve|line|point|dim|axis|plane|bound|construction|dummy|helper|defpoints/i.test(name);
                            if (!isConstruction && child.geometry) {
                                child.geometry.computeBoundingBox();
                                box.expandByObject(child);
                                count++;
                            }
                        }
                    });
                }

                if (count === 0 && this.currentModelRoot) {
                    box.setFromObject(this.currentModelRoot);
                }

                const sphere = box.getBoundingSphere(new Sphere());
                const center = sphere.center;
                const currentRadius = Math.max(sphere.radius, 0.001);

                const settings = (manifest?.boundingDimensions as any)?.appliedSettings || {};
                const autoScale = settings.autoScale !== false;
                const autoCentre = settings.autoCentre !== false;

                const scale = autoScale ? (1.35 / currentRadius) : 1.0;

                if (autoScale) {
                    this.currentModelRoot.scale.set(scale, scale, scale);
                }

                if (autoCentre) {
                    this.currentModelRoot.position.set(
                        -center.x * scale,
                        -center.y * scale,
                        -center.z * scale
                    );
                }

                this.currentModelRoot.updateMatrixWorld(true);
            }
        } catch {
            effectiveRadius = 1.35;
        }

        // 5. Discover components and bind materials
        const resolvedManifest = ComponentDiscovery.discoverComponents(this.currentModelRoot, manifest);
        this.currentManifest = resolvedManifest;
        this.roleBinder.bindComponents(this.currentModelRoot, resolvedManifest);

        // 6. Align Studio Ground to bottom of model
        this.alignGround();

        // 7. Camera auto-framing with true dimensions (for custom CAD uploads)
        if (!isBuiltin) {
            const camera = this.viewer.scene.activeCamera;
            autoFrameCamera(camera, camera.controls, effectiveRadius, true, () => {
                camera.positionUpdated(true);
                camera.targetUpdated(true);
            });
        }

        // 8. Refresh rendering pipeline and reset accumulator
        this.viewer.renderer.refreshPipeline();
        this.viewer.renderer.reset();

        return this.currentModelRoot;
    }

    private disposeCurrentModel(): void {
        if (!this.currentModelRoot) return;

        try {
            if (typeof this.currentModelRoot.traverse !== 'function') {
                // Not a real Object3D — skip traversal, just clear references
                this.viewer.scene.removeSceneModels();
                this.roleBinder.clear();
                this.currentModelRoot = null;
                return;
            }
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

    public alignGround(): void {
        const ground = this.viewer.getPlugin(GroundPlugin);
        if (!ground || !this.currentModelRoot) return;

        try {
            if (this.currentModelRoot.updateMatrixWorld) {
                this.currentModelRoot.updateMatrixWorld(true);
            }

            const box = new Box3();
            let count = 0;
            this.currentModelRoot.traverse((child: any) => {
                if (child.isMesh && child.visible) {
                    const name = (child.name || '').toLowerCase();
                    const isHelper = /ground|helper|grid|axis|shadow|gizmo|baker/i.test(name);
                    if (!isHelper) {
                        if (child.geometry) child.geometry.computeBoundingBox();
                        box.expandByObject(child);
                        count++;
                    }
                }
            });
            if (count === 0) box.setFromObject(this.currentModelRoot);

            if (box.min.y !== Infinity && !isNaN(box.min.y)) {
                ground.yOffset = box.min.y;
                if ((ground as any).mesh && (ground as any).mesh.position) {
                    (ground as any).mesh.position.y = box.min.y;
                }
                ground.refreshOptions();

                // Soft, realistic contact shadow directly beneath contact point
                if (ground.shadowBaker) {
                    const sphere = box.getBoundingSphere(new Sphere());
                    const r = Math.max(sphere.radius, 0.5);
                    if (ground.shadowBaker.light?.shadowParams) {
                        ground.shadowBaker.light.shadowParams.frustumSize = Math.max(3.2, r * 2.4);
                        ground.shadowBaker.light.shadowParams.radius = 2.0;
                        ground.shadowBaker.light.updateShadowParams();
                    }
                    ground.shadowBaker.reset();
                }

                this.viewer.scene.setDirty();
                this.viewer.renderer.reset();
            }
        } catch {
            // Ground alignment fallback
        }
    }

    public fitModel(): void {
        if (!this.currentModelRoot) return;
        const box = new Box3();
        let count = 0;
        this.currentModelRoot.traverse((child: any) => {
            if (child.isMesh && child.visible) {
                if (child.geometry) child.geometry.computeBoundingBox();
                box.expandByObject(child);
                count++;
            }
        });
        if (count === 0) box.setFromObject(this.currentModelRoot);

        const sphere = box.getBoundingSphere(new Sphere());
        const radius = Math.max(sphere.radius, 0.5);
        const camera = this.viewer.scene.activeCamera;
        if (camera) {
            autoFrameCamera(camera, camera.controls, radius, true, () => {
                camera.positionUpdated(true);
                camera.targetUpdated(true);
            });
        }
    }

    public resetView(): void {
        const camera = this.viewer.scene.activeCamera;
        if (!camera) return;
        camera.position.set(-0.17, -0.25, 8.5);
        camera.target.set(0, 0, 0);
        camera.positionUpdated(true);
        camera.targetUpdated(true);
        if (camera.controls) {
            camera.controls.target.set(0, 0, 0);
            camera.controls.update();
        }
    }
}

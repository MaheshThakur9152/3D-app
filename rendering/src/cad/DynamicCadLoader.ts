/**
 * DynamicCadLoader.ts
 * Manages loading custom CAD-generated GLB models into the existing WebGi viewer,
 * handling resource disposal, temporal accumulation reset, and camera auto-framing.
 */

import { ViewerApp, AssetManagerPlugin, Box3, Sphere, ProgressivePlugin, GroundPlugin, Group } from "webgi";
import { ModelManifest } from "./ModelManifest";
import { MaterialRoleBinder } from "./MaterialRoleBinder";
import { ComponentDiscovery } from "./ComponentDiscovery";
import { autoFrameCamera } from "./CameraFraming";

/**
 * Normalization helper resolving the real Three.js Object3D root from
 * any WebGi asset result structure (ISceneObject array, IModel wrapper,
 * container object, or direct Object3D).
 */
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

        // If all objects share a common parent (not scene), return common parent
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
    // WebGi ISceneObject / IModel wrapper with .modelObject
    if (asset.modelObject && typeof asset.modelObject.traverse === 'function') {
        return asset.modelObject;
    }
    // Container object with .root
    if (asset.root && typeof asset.root.traverse === 'function') {
        return asset.root;
    }
    // GLTF container with .scene
    if (asset.scene && typeof asset.scene.traverse === 'function') {
        return asset.scene;
    }
    // Direct Object3D implementing traverse
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

        // Reset temporal rendering buffers to eliminate ghosting
        this.viewer.renderer.reset();
        const progressive = this.viewer.getPlugin(ProgressivePlugin);
        if (progressive && typeof (progressive as any).reset === 'function') {
            (progressive as any).reset();
        }

        // 1. Load GLB via existing WebGi AssetManagerPlugin FIRST (preserve previous model)
        let objects: any = null;
        try {
            objects = await this.manager.addFromPath(glbUrl, { autoScale: false });
        } catch (err) {
            console.error('[DynamicCadLoader] addFromPath failed:', err);
            return null;
        }

        if (token !== this.loadToken) {
            // Cancelled by a newer concurrent load - clean up newly imported objects
            this.removeImportedAssets(objects);
            return null;
        }

        // 2. Resolve and validate the real Three.js Object3D root
        const newRoot = normalizeModelRoot(objects);
        if (!newRoot || typeof newRoot.traverse !== 'function') {
            console.error('[DynamicCadLoader] Loaded asset has no traversable Object3D root:', objects);
            this.removeImportedAssets(objects);
            // PRESERVE the last valid model if a replacement fails
            return null;
        }

        // 3. New root is validated and ready! Safely dispose previous model resources now
        this.disposeCurrentModel();

        // 4. Ensure new root is attached to active scene modelRoot
        if (!newRoot.parent && (this.viewer.scene as any)?.modelRoot) {
            (this.viewer.scene as any).modelRoot.add(newRoot);
        }

        // 5. Update references
        this.currentModelRoot = newRoot;
        this.currentModelAsset = objects;

        // 5. Viewport scale normalization contract
        const isBuiltin = glbUrl.includes('ring_webgi') || glbUrl.includes('ring2_webgi');
        let effectiveRadius = 1.35;

        try {
            if (this.currentModelRoot.updateMatrixWorld) {
                this.currentModelRoot.updateMatrixWorld(true);
            }

            const box = new Box3();
            let count = 0;
            if (this.currentModelRoot && typeof this.currentModelRoot.traverse === 'function') {
                this.currentModelRoot.traverse((child: any) => {
                    if (child.isMesh && child.visible) {
                        const name = (child.name || '').toLowerCase();
                        const isHelper = /ground|helper|grid|axis|shadow|gizmo|baker/i.test(name) ||
                            child.isGroundMesh || child.userData?.isGround;
                        if (!isHelper && child.geometry) {
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

            if (!isBuiltin) {
                const settings = (manifest?.boundingDimensions as any)?.appliedSettings || {};
                const autoScale = settings.autoScale !== false;
                const autoCentre = settings.autoCentre !== false;

                // Scale to canonical jewelry radius ~1.35 if not already normalized
                const scale = (autoScale && Math.abs(currentRadius - 1.35) > 0.05)
                    ? (1.35 / currentRadius)
                    : 1.0;

                if (autoScale && scale !== 1.0) {
                    this.currentModelRoot.scale.set(scale, scale, scale);
                }

                if (autoCentre) {
                    this.currentModelRoot.position.set(
                        -center.x * scale,
                        -center.y * scale,
                        -center.z * scale
                    );
                }

                if (this.currentModelRoot.updateMatrixWorld) {
                    this.currentModelRoot.updateMatrixWorld(true);
                }
            }

            effectiveRadius = 1.35;
        } catch (e) {
            console.warn('[DynamicCadLoader] Normalization calculation fallback:', e);
            effectiveRadius = 1.35;
        }

        // 6. Discover components and bind materials
        const resolvedManifest = ComponentDiscovery.discoverComponents(this.currentModelRoot, manifest);
        this.currentManifest = resolvedManifest;
        this.roleBinder.bindComponents(this.currentModelRoot, resolvedManifest, isBuiltin);

        // 7. Align Studio Ground to bottom of model
        this.alignGround();

        // 8. Camera auto-framing with true dimensions
        if (!isBuiltin) {
            const camera = this.viewer.scene.activeCamera;
            autoFrameCamera(camera, camera.controls, effectiveRadius, true, () => {
                camera.positionUpdated(true);
                camera.targetUpdated(true);
            });
        }

        // 9. Refresh rendering pipeline and reset accumulator
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
        const ground = this.viewer.getPlugin(GroundPlugin);
        if (!ground || !this.currentModelRoot) return;

        try {
            if (this.currentModelRoot.updateMatrixWorld) {
                this.currentModelRoot.updateMatrixWorld(true);
            }

            const box = new Box3();
            let count = 0;
            if (typeof this.currentModelRoot.traverse === 'function') {
                this.currentModelRoot.traverse((child: any) => {
                    if (child.isMesh && child.visible) {
                        const name = (child.name || '').toLowerCase();
                        const isHelper = /ground|helper|grid|axis|shadow|gizmo|baker/i.test(name) ||
                            child.isGroundMesh || child.userData?.isGround;
                        if (!isHelper) {
                            if (child.geometry) child.geometry.computeBoundingBox();
                            box.expandByObject(child);
                            count++;
                        }
                    }
                });
            }
            if (count === 0 && typeof this.currentModelRoot.traverse === 'function') {
                box.setFromObject(this.currentModelRoot);
            }

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
        if (!this.currentModelRoot || typeof this.currentModelRoot.traverse !== 'function') return;
        const box = new Box3();
        let count = 0;
        this.currentModelRoot.traverse((child: any) => {
            if (child.isMesh && child.visible) {
                const name = (child.name || '').toLowerCase();
                const isHelper = /ground|helper|grid|axis|shadow|gizmo|baker/i.test(name) ||
                    child.isGroundMesh || child.userData?.isGround;
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

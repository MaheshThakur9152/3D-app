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
import { MaterialRoleBinder, GemstonePreset } from "../cad/MaterialRoleBinder";
import { DynamicCadLoader } from "../cad/DynamicCadLoader";
import { CanvasPicker } from "../cad/CanvasPicker";
import { StudioSettings } from "../ui/StudioSettings";
import { autoFrameCamera } from "../cad/CameraFraming";
import { StudioFloor } from "./StudioFloor";

export class ViewerHost {
    private static instance: ViewerHost | null = null;

    public viewer: ViewerApp | null = null;
    public manager: AssetManagerPlugin | null = null;
    public roleBinder: MaterialRoleBinder | null = null;
    public dynamicLoader: DynamicCadLoader | null = null;
    public picker: CanvasPicker | null = null;
    public studio: StudioSettings | null = null;
    public studioFloor: StudioFloor | null = null;

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

        // Studio Environment & Background (Pure White catalog default)
        const studio = new StudioSettings(viewer);
        studio.applyPreset('white');
        this.studio = studio;

        const studioFloor = new StudioFloor(viewer);
        this.studioFloor = studioFloor;
        studio.setStudioFloor(studioFloor);

        // Stationary camera by default: autoRotate = false
        // Initial perspective framing calibrated for natural floor and jewelry visibility
        camera.position.set(-0.35, 2.4, 8.5);
        camera.target.set(0, -0.2, 0);
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
            camera.controls.target.set(0, -0.2, 0);
            camera.controls.update();
        }

        viewer.renderer.refreshPipeline();

        // Initialize CAD integration modules
        const roleBinder = new MaterialRoleBinder(viewer);
        this.roleBinder = roleBinder;
        this.dynamicLoader = new DynamicCadLoader(viewer, manager, roleBinder, studioFloor);

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

        const isBuiltin = glbUrl.includes('ring_webgi') || glbUrl.includes('ring2_webgi');
        if (isBuiltin && root && root.rotation) {
            root.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
        }
        if (root && root.updateMatrixWorld) {
            root.updateMatrixWorld(true);
        }
        this.studio?.configureGroundAppearance(); // ground transform already aligned by DynamicCadLoader.loadModel

        this.fitView(false);
        return root;
    }

    public fitView(animate = true) {
        if (!this.viewer) return;
        const camera = this.viewer.scene.activeCamera;
        let radius = 1.35;
        const root = this.dynamicLoader?.getCurrentModelRoot();
        if (root && typeof root.traverse === 'function') {
            if (root.updateMatrixWorld) root.updateMatrixWorld(true);
            const box = new Box3();
            let count = 0;
            root.traverse((child: any) => {
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
            if (count > 0) {
                const sphere = box.getBoundingSphere(new Sphere());
                if (sphere.radius > 0.05) {
                    radius = sphere.radius;
                }
            }
        } else {
            const manifest = this.dynamicLoader?.getCurrentManifest();
            radius = (manifest?.boundingDimensions as any)?.normalizedRadius || manifest?.boundingDimensions?.boundingRadius || 1.35;
        }

        autoFrameCamera(camera, camera.controls, radius, animate, () => {
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
        if (!this.studio) return;
        if (customColor) {
            this.studio.setCustomColor(customColor);
        } else {
            this.studio.applyPreset(presetId);
        }
    }

    public setGroundVisible(visible: boolean) {
        this.studio?.setGroundVisible(visible);
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

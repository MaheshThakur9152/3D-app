/**
 * CanvasPicker.ts
 * Implements precise 3D mesh raycasting on the WebGi canvas.
 * Preserves camera drag/orbit interactions and highlights selected meshes
 * non-destructively using a BoxHelper overlay.
 */

import { Raycaster, Vector2, BoxHelper, ViewerApp } from "webgi";

export interface MeshSelectionEvent {
    mesh: any;
    nodeName: string;
    parentName?: string;
    point?: any;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
}

export class CanvasPicker {
    private viewer: ViewerApp;
    private canvas: HTMLCanvasElement;
    private raycaster: Raycaster;
    private pointerDownPos: Vector2 = new Vector2();
    private pointerDownTime = 0;
    private highlightHelper: any = null;
    private selectedMesh: any = null;
    private onSelectionCallback?: (event: MeshSelectionEvent | null) => void;
    private enabled = true;

    constructor(viewer: ViewerApp, canvas: HTMLCanvasElement) {
        this.viewer = viewer;
        this.canvas = canvas;
        this.raycaster = new Raycaster();

        this.initEvents();
    }

    private initEvents(): void {
        this.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
            if (e.button !== 0) return; // Only primary button initiates pick
            this.pointerDownPos.set(e.clientX, e.clientY);
            this.pointerDownTime = performance.now();
        });

        this.canvas.addEventListener('pointerup', (e: PointerEvent) => {
            if (!this.enabled || e.button !== 0) return;

            const deltaX = Math.abs(e.clientX - this.pointerDownPos.x);
            const deltaY = Math.abs(e.clientY - this.pointerDownPos.y);
            const elapsed = performance.now() - this.pointerDownTime;

            // Only treat as picking click if pointer moved < 6px and duration < 350ms
            if (deltaX < 6 && deltaY < 6 && elapsed < 350) {
                this.performPick(e.clientX, e.clientY);
            }
        });
    }

    private performPick(clientX: number, clientY: number): void {
        const rect = this.canvas.getBoundingClientRect();
        const mouse = new Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1
        );

        const camera = this.viewer.scene.activeCamera;
        if (!camera) return;

        this.raycaster.setFromCamera(mouse, camera);

        // Gather all renderable jewelry meshes, excluding ground, helper, or gizmos
        const meshes: any[] = [];
        // WebGi's scene.modelRoot is an IModel wrapper; get the actual Object3D
        const sceneRoot = (this.viewer.scene.modelRoot as any)?.modelObject || this.viewer.scene.modelRoot;
        if (sceneRoot && typeof sceneRoot.traverse === 'function') {
            sceneRoot.traverse((obj: any) => {
                if (obj.isMesh && obj.visible && obj !== this.highlightHelper) {
                    const name = (obj.name || '').toLowerCase();
                    const isHelper = /ground|helper|grid|axis|shadow|gizmo|baker/i.test(name);
                    if (!isHelper && !obj.isGroundMesh && !obj.userData?.isGround) {
                        meshes.push(obj);
                    }
                }
            });
        }

        const intersects = this.raycaster.intersectObjects(meshes, false);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const mesh = hit.object;
            this.selectMesh(mesh, hit.point);
        } else {
            this.clearSelection();
        }
    }

    public selectMesh(mesh: any, point?: any): void {
        this.clearHighlight();

        if (!mesh) {
            this.selectedMesh = null;
            if (this.onSelectionCallback) this.onSelectionCallback(null);
            return;
        }

        this.selectedMesh = mesh;

        // Create luxury gold outline box around selected mesh without touching its material
        try {
            if (mesh.updateMatrixWorld) mesh.updateMatrixWorld(true);
            this.highlightHelper = new BoxHelper(mesh, 0xd4af37 as any);
            this.highlightHelper.raycast = () => {}; // Never intercept raycasts
            if (this.highlightHelper.material) {
                this.highlightHelper.material.depthTest = false;
                this.highlightHelper.material.transparent = true;
                this.highlightHelper.material.opacity = 0.95;
                this.highlightHelper.renderOrder = 9999;
            }
            this.highlightHelper.update();
            this.viewer.scene.add(this.highlightHelper);
            this.viewer.renderer.reset();
        } catch {
            // Helper fallback
        }

        if (this.onSelectionCallback) {
            const parentName = mesh.parent && mesh.parent.name && mesh.parent.name !== 'Scene' && mesh.parent.name !== 'SceneRoot'
                ? mesh.parent.name
                : undefined;

            const pos: [number, number, number] = [
                parseFloat((mesh.position?.x || 0).toFixed(2)),
                parseFloat((mesh.position?.y || 0).toFixed(2)),
                parseFloat((mesh.position?.z || 0).toFixed(2))
            ];
            const rot: [number, number, number] = [
                parseFloat((((mesh.rotation?.x || 0) * 180) / Math.PI).toFixed(0)),
                parseFloat((((mesh.rotation?.y || 0) * 180) / Math.PI).toFixed(0)),
                parseFloat((((mesh.rotation?.z || 0) * 180) / Math.PI).toFixed(0))
            ];
            const sc: [number, number, number] = [
                parseFloat((mesh.scale?.x || 1).toFixed(2)),
                parseFloat((mesh.scale?.y || 1).toFixed(2)),
                parseFloat((mesh.scale?.z || 1).toFixed(2))
            ];

            this.onSelectionCallback({
                mesh,
                nodeName: mesh.name || 'Unnamed Component',
                parentName,
                point,
                position: pos,
                rotation: rot,
                scale: sc
            });
        }
    }

    public clearSelection(): void {
        this.clearHighlight();
        this.selectedMesh = null;
        if (this.onSelectionCallback) {
            this.onSelectionCallback(null);
        }
    }

    public clearHighlight(): void {
        if (this.highlightHelper) {
            this.viewer.scene.remove(this.highlightHelper);
            if (this.highlightHelper.geometry) this.highlightHelper.geometry.dispose();
            if (this.highlightHelper.material) this.highlightHelper.material.dispose();
            this.highlightHelper = null;
            this.viewer.renderer.reset();
        }
    }

    public onSelection(callback: (event: MeshSelectionEvent | null) => void): void {
        this.onSelectionCallback = callback;
    }

    public getSelectedMesh(): any | null {
        return this.selectedMesh;
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!enabled) this.clearSelection();
    }
}

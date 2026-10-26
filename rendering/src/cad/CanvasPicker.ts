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
    point?: any;
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
            this.pointerDownPos.set(e.clientX, e.clientY);
            this.pointerDownTime = performance.now();
        });

        this.canvas.addEventListener('pointerup', (e: PointerEvent) => {
            if (!this.enabled) return;

            const deltaX = Math.abs(e.clientX - this.pointerDownPos.x);
            const deltaY = Math.abs(e.clientY - this.pointerDownPos.y);
            const elapsed = performance.now() - this.pointerDownTime;

            // Only treat as picking click if pointer moved < 5px and click duration < 350ms
            if (deltaX < 5 && deltaY < 5 && elapsed < 350) {
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

        // Gather all renderable meshes under model root
        const meshes: any[] = [];
        this.viewer.scene.modelRoot.traverse((obj: any) => {
            if (obj.isMesh && obj.visible && obj !== this.highlightHelper) {
                meshes.push(obj);
            }
        });

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
            this.highlightHelper = new BoxHelper(mesh, 0xfea04d as any);
            if (this.highlightHelper.material) {
                this.highlightHelper.material.depthTest = false;
                this.highlightHelper.material.transparent = true;
                this.highlightHelper.material.opacity = 0.9;
                this.highlightHelper.renderOrder = 999;
            }
            this.viewer.scene.add(this.highlightHelper);
            this.viewer.renderer.reset();
        } catch {
            // Helper fallback
        }

        if (this.onSelectionCallback) {
            this.onSelectionCallback({
                mesh,
                nodeName: mesh.name || 'Unnamed Component',
                point
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

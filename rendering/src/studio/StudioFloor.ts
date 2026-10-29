/**
 * StudioFloor.ts
 * Finite, visible square 3D studio floor.
 * Independent from ContactShadowGroundPlugin shadow overlay.
 */

import { ViewerApp, Mesh, PlaneGeometry, MeshStandardMaterial2, Color } from "webgi";
import { STUDIO_FLOOR_SIZE, studioFloorSize } from "./groundMath";

export interface StudioFloorConfig {
    size: number;
    color: string;
    roughness: number;
    metalness: number;
    visible: boolean;
}

export class StudioFloor {
    private viewer: ViewerApp;
    private floorMesh: Mesh | null = null;
    private visible = true;
    private color = '#eeeeee';
    private roughness = 0.88;
    private metalness = 0.0;
    private size = STUDIO_FLOOR_SIZE;
    private lastPosition = { x: 0, y: 0, z: 0 };
    private lastRadius = 1.35;

    constructor(viewer: ViewerApp) {
        this.viewer = viewer;
        this.init();
    }

    private init(): void {
        if (this.floorMesh) return;

        const geometry = new PlaneGeometry(1, 1, 1, 1);
        const material = new MeshStandardMaterial2({
            color: new Color(this.color),
            roughness: this.roughness,
            metalness: this.metalness,
            depthWrite: true,
            depthTest: true
        });

        // Visible from all perspective viewing angles
        material.side = 2; // DoubleSide

        // Depth bias pushes floor backwards in depth buffer to prevent z-fighting with shadow overlay
        material.polygonOffset = true;
        material.polygonOffsetFactor = 1.0;
        material.polygonOffsetUnits = 1.0;

        const mesh = new Mesh(geometry, material);
        mesh.name = 'Studio_Floor_Mesh';
        (mesh as any).isGroundMesh = true;
        mesh.userData = { isGround: true };
        mesh.rotation.set(-Math.PI / 2, 0, 0);
        mesh.scale.set(this.size, this.size, 1);
        mesh.receiveShadow = false;
        mesh.castShadow = false;

        this.viewer.scene.add(mesh);
        this.floorMesh = mesh;
    }

    public updateTransform(centerX: number, lowestY: number, centerZ: number, radius = 1.35): void {
        if (!this.floorMesh) return;
        this.lastPosition = { x: centerX, y: lowestY, z: centerZ };
        this.lastRadius = radius;
        const currentSize = Math.max(this.size, studioFloorSize(radius));
        this.floorMesh.position.set(centerX, lowestY, centerZ);
        this.floorMesh.scale.set(currentSize, currentSize, 1);
        this.floorMesh.updateMatrixWorld?.(true);
    }

    public setVisible(visible: boolean): void {
        this.visible = visible;
        if (this.floorMesh) {
            this.floorMesh.visible = visible;
            this.viewer.scene.setDirty();
            this.viewer.renderer.reset();
        }
    }

    public isVisible(): boolean {
        return this.visible;
    }

    public setColor(hex: string): void {
        this.color = hex;
        if (this.floorMesh && this.floorMesh.material) {
            const mat = (this.floorMesh.material as any).materialObject || this.floorMesh.material;
            if (mat && mat.color) {
                mat.color.copy(new Color(hex).convertSRGBToLinear());
                mat.needsUpdate = true;
                this.viewer.scene.setDirty();
                this.viewer.renderer.reset();
            }
        }
    }

    public setRoughness(roughness: number): void {
        this.roughness = Math.max(0, Math.min(1, roughness));
        if (this.floorMesh && this.floorMesh.material) {
            const mat = (this.floorMesh.material as any).materialObject || this.floorMesh.material;
            if (mat) {
                mat.roughness = this.roughness;
                mat.needsUpdate = true;
                this.viewer.scene.setDirty();
                this.viewer.renderer.reset();
            }
        }
    }

    public setSize(size: number): void {
        this.size = Math.max(2, Math.min(20, size));
        if (this.floorMesh) {
            const finalSize = Math.max(this.size, studioFloorSize(this.lastRadius));
            this.floorMesh.scale.set(finalSize, finalSize, 1);
            this.floorMesh.updateMatrixWorld?.(true);
            this.viewer.scene.setDirty();
            this.viewer.renderer.reset();
        }
    }

    public getConfig(): StudioFloorConfig {
        return {
            size: this.size,
            color: this.color,
            roughness: this.roughness,
            metalness: this.metalness,
            visible: this.visible
        };
    }

    public getMesh(): Mesh | null {
        return this.floorMesh;
    }
}

/**
 * StudioFloor.ts
 * Finite, visible square 3D studio floor.
 * Independent from ContactShadowGroundPlugin shadow overlay.
 */

import { ViewerApp, Mesh, PlaneGeometry, MeshStandardMaterial2, Color } from "webgi";
import { STUDIO_FLOOR_SIZE, studioFloorSize } from "./groundMath";

export class StudioFloor {
    private viewer: ViewerApp;
    private floorMesh: Mesh | null = null;
    private visible = true;

    constructor(viewer: ViewerApp) {
        this.viewer = viewer;
        this.init();
    }

    private init(): void {
        if (this.floorMesh) return;

        const geometry = new PlaneGeometry(1, 1, 1, 1);
        const material = new MeshStandardMaterial2({
            color: new Color('#d0d2d6'), // Neutral matte light-gray with clear edge definition
            roughness: 0.85,
            metalness: 0.0,
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
        mesh.scale.set(STUDIO_FLOOR_SIZE, STUDIO_FLOOR_SIZE, 1);
        mesh.receiveShadow = false;
        mesh.castShadow = false;

        this.viewer.scene.add(mesh);
        this.floorMesh = mesh;
    }

    public updateTransform(centerX: number, lowestY: number, centerZ: number, radius = 1.35): void {
        if (!this.floorMesh) return;
        const size = studioFloorSize(radius);
        this.floorMesh.position.set(centerX, lowestY, centerZ);
        this.floorMesh.scale.set(size, size, 1);
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

    public getMesh(): Mesh | null {
        return this.floorMesh;
    }
}

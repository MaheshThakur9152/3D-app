/**
 * StudioFloor.ts
 * Finite, visible square 3D studio floor.
 * Persistent world object: fixed at (0, 0, 0) on the horizontal XZ plane at Y = 0.
 * Independent of imported model lifecycle and position.
 */

import { ViewerApp, Mesh, PlaneGeometry, MeshStandardMaterial2, Color } from "webgi";
import { STUDIO_WORLD_CONFIG } from "./groundMath";

export class StudioFloor {
    private viewer: ViewerApp;
    private floorMesh: Mesh | null = null;
    private visible = true;
    private size: number = STUDIO_WORLD_CONFIG.floorSize;
    private geometryBaseSize: number = STUDIO_WORLD_CONFIG.floorSize;
    private color: string = STUDIO_WORLD_CONFIG.floorColor;
    private roughness: number = STUDIO_WORLD_CONFIG.floorRoughness;
    private metalness: number = STUDIO_WORLD_CONFIG.floorMetalness;

    constructor(viewer: ViewerApp) {
        this.viewer = viewer;
    }

    public init(size = 4.5, color = '#E9E9E7'): void {
        this.size = size;
        this.geometryBaseSize = size;
        this.color = color;
        this.mount();
    }

    public mount(): void {
        if (this.floorMesh) return;

        const geometry = new PlaneGeometry(this.geometryBaseSize, this.geometryBaseSize, 1, 1);
        const material = new MeshStandardMaterial2({
            color: new Color(this.color).convertSRGBToLinear(),
            roughness: this.roughness,
            metalness: this.metalness,
            depthWrite: true,
            depthTest: true
        });

        // Visible from all perspective viewing angles
        material.side = 2; // DoubleSide

        // Depth bias pushes floor backwards in depth buffer to prevent z-fighting with contact-shadow overlay
        material.polygonOffset = true;
        material.polygonOffsetFactor = 1.0;
        material.polygonOffsetUnits = 1.0;

        const mesh = new Mesh(geometry, material);
        mesh.name = 'Studio_Floor_Mesh';
        (mesh as any).isGroundMesh = true;
        mesh.userData = {
            isGround: true,
            isStudioFloor: true,
            isStudioEnvironment: true
        };

        // Floor lies flat on horizontal XZ plane at fixed height Y = 0
        mesh.rotation.set(-Math.PI / 2, 0, 0);
        mesh.position.set(0, STUDIO_WORLD_CONFIG.floorY, 0);
        mesh.castShadow = false;
        mesh.receiveShadow = true;

        const sceneTarget = (this.viewer.scene as any)?.modelRoot || this.viewer.scene;
        sceneTarget.add(mesh);
        this.floorMesh = mesh;
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
        const nextSize = Math.max(3.0, Math.min(12.0, size));
        this.size = nextSize;

        if (this.floorMesh) {
            const ratio = nextSize / this.geometryBaseSize;
            this.floorMesh.scale.set(ratio, ratio, 1);
            this.floorMesh.updateMatrixWorld?.(true);
            this.viewer.scene.setDirty();
            this.viewer.renderer.reset();
        }
    }

    public getSize(): number {
        return this.size;
    }

    public getMesh(): Mesh | null {
        return this.floorMesh;
    }

    public dispose(): void {
        if (!this.floorMesh) return;
        this.floorMesh.removeFromParent();
        if (this.floorMesh.geometry) this.floorMesh.geometry.dispose();
        if (this.floorMesh.material) {
            const mat = (this.floorMesh.material as any).materialObject || this.floorMesh.material;
            mat.dispose?.();
        }
        this.floorMesh = null;
    }
}

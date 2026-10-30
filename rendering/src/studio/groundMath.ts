/**
 * groundMath.ts
 * Pure ground/contact-shadow policy shared by DynamicCadLoader, StudioFloor and StudioSettings.
 * No WebGi imports so it stays testable under plain node.
 */

// Plane extent for contact shadow blur/vignette canvas.
export const GROUND_SIZE = 120;

// Visible presentation stage. This is deliberately separate from GROUND_SIZE,
// which belongs to WebGi's contact-shadow depth pass and is not the visual stage.
export const STUDIO_FLOOR_SIZE = 4.5;

export interface StudioWorldConfig {
    floorSize: number;
    floorY: number;
    floorColor: string;
    floorRoughness: number;
    floorMetalness: number;
    targetProductRadius: number;
    defaultCameraCoverage: number;
    defaultCameraZoom: number;
    defaultCameraElevationDeg: number;
    defaultCameraAzimuthDeg: number;
}

export const STUDIO_WORLD_CONFIG: StudioWorldConfig = {
    floorSize: 4.5,
    floorY: 0.0,
    floorColor: '#E9E9E7',
    floorRoughness: 0.90,
    floorMetalness: 0.0,
    targetProductRadius: 1.35,
    defaultCameraCoverage: 0.78,
    defaultCameraZoom: 1.0,
    defaultCameraElevationDeg: 30,
    defaultCameraAzimuthDeg: -25
};

export function isHelperMesh(
    name: string | undefined,
    obj: { isGroundMesh?: boolean; userData?: { isGround?: boolean; isStudioEnvironment?: boolean } }
): boolean {
    return /ground|floor|helper|grid|axis|shadow|gizmo|baker/i.test(name || '') ||
        !!obj.isGroundMesh ||
        !!obj.userData?.isGround ||
        !!obj.userData?.isStudioEnvironment;
}

// ContactShadowGroundPlugin depth map spans size / shadowScale (fixed 512px).
// Fit it to the jewelry so the contact area gets real resolution.
export function groundShadowScale(size: number, radius: number): number {
    const halfFrustum = Math.max(0.5, radius) * 2.5;
    return size / (2 * halfFrustum);
}

export function groundShadowHeight(radius: number): number {
    return Math.max(3.5, radius * 3.0);
}

export function studioFloorSize(radius: number): number {
    return (radius && radius > 2.5) ? radius * 2.0 : STUDIO_FLOOR_SIZE;
}

/**
 * groundMath.ts
 * Pure ground/contact-shadow policy shared by DynamicCadLoader, StudioFloor and StudioSettings.
 * No WebGi imports so it stays testable under plain node.
 */

// Plane extent for contact shadow blur/vignette canvas.
export const GROUND_SIZE = 120;

// Finite visible square studio floor extent for jewelry models.
export const STUDIO_FLOOR_SIZE = 5.0;

export function isHelperMesh(name: string | undefined, obj: { isGroundMesh?: boolean; userData?: { isGround?: boolean } }): boolean {
    return /ground|floor|helper|grid|axis|shadow|gizmo|baker/i.test(name || '') || !!obj.isGroundMesh || !!obj.userData?.isGround;
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

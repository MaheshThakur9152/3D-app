/**
 * groundMath.ts
 * Pure ground/contact-shadow policy shared by DynamicCadLoader and StudioSettings.
 * No WebGi imports so it stays testable under plain node.
 */

// Plane extent. Shadow alpha is 0 outside the contact area, so the edge is not visible.
export const GROUND_SIZE = 120;

export function isHelperMesh(name: string | undefined, obj: { isGroundMesh?: boolean; userData?: { isGround?: boolean } }): boolean {
    return /ground|helper|grid|axis|shadow|gizmo|baker/i.test(name || '') || !!obj.isGroundMesh || !!obj.userData?.isGround;
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

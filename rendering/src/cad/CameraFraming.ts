/**
 * CameraFraming.ts
 * Render-only camera auto-framing and orbit control normalization without stutter.
 * Supports aspect ratio compensation for mobile/portrait viewports.
 */

import gsap from "gsap";

export function autoFrameCamera(
    camera: any,
    controls: any,
    boundingRadius: number,
    animate = true,
    onFrameUpdate?: () => void
): void {
    if (!camera) return;

    // Normal ring scene radius is ~1.35
    const radius = Math.max(0.8, Math.min(boundingRadius || 1.35, 4.0));
    const aspect = camera.aspect || (window.innerWidth / window.innerHeight);
    const fovY = (camera.fov || 45) * (Math.PI / 180);
    const fovX = 2 * Math.atan(Math.tan(fovY / 2) * Math.max(0.6, aspect));
    const effectiveFov = Math.min(fovY, fovX);

    // Frame ring with healthy 35% margin
    const distance = (radius / Math.sin(effectiveFov / 2)) * 1.35;

    // Adjust camera orbit clamping limits to prevent clipping
    if (controls) {
        controls.minDistance = Math.max(1.5, radius * 0.8);
        controls.maxDistance = Math.max(16.0, radius * 8.0);
        controls.target.set(0, 0, 0);
    }

    const scale = distance / 8.5;
    const targetX = -0.17 * scale;
    const targetY = -0.25 * scale;
    const targetZ = distance;

    if (!animate) {
        camera.position.set(targetX, targetY, targetZ);
        camera.target.set(0, 0, 0);
        camera.positionUpdated(true);
        camera.targetUpdated(true);
        if (controls) controls.update();
        return;
    }

    // Pause auto-rotate during transition so it doesn't fight GSAP
    const prevAutoRotate = controls ? controls.autoRotate : false;
    if (controls) controls.autoRotate = false;

    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(camera.target);

    gsap.to(camera.position, {
        x: targetX,
        y: targetY,
        z: targetZ,
        duration: 1.0,
        ease: "power2.inOut",
        onUpdate: () => {
            camera.positionUpdated(true);
            camera.targetUpdated(true);
            if (onFrameUpdate) onFrameUpdate();
        },
        onComplete: () => {
            if (controls) {
                controls.autoRotate = prevAutoRotate;
                controls.update();
            }
        }
    });

    gsap.to(camera.target, {
        x: 0,
        y: 0,
        z: 0,
        duration: 1.0,
        ease: "power2.inOut"
    });
}

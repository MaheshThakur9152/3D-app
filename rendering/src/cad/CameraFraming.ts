/**
 * CameraFraming.ts
 * Frustum-aware camera auto-framing and orbit control normalization without stutter.
 * Uses calibrated WebGi orbit ray (-0.17, -0.25, distance) to align with OrbitControls.
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

    const radius = Math.max(0.5, boundingRadius || 1.35);

    // Measure actual central viewport dimensions from canvas
    const canvas = camera._container || camera.cameraObject?.domElement || (typeof document !== 'undefined' && document.getElementById('webgi-canvas'));
    let aspect = 1.6;
    if (canvas && canvas.clientWidth > 0 && canvas.clientHeight > 0) {
        aspect = canvas.clientWidth / canvas.clientHeight;
    } else if (camera.aspect) {
        aspect = camera.aspect;
    } else if (typeof window !== 'undefined' && window.innerWidth > 0 && window.innerHeight > 0) {
        aspect = window.innerWidth / window.innerHeight;
    }

    const fovY = ((camera.cameraObject?.fov || camera.fov || camera.getCameraOptions?.()?.fov || 45) * Math.PI) / 180;
    const fovX = 2 * Math.atan(Math.tan(fovY / 2) * Math.max(0.6, aspect));
    const effectiveFov = Math.min(fovY, fovX);

    // Target 78% of the usable viewport dimension (75-80% coverage range)
    const targetCoverage = 0.78;
    const distance = radius / (Math.tan(effectiveFov / 2) * targetCoverage);

    // Adjust camera orbit clamping limits to prevent clipping while allowing close inspection
    if (controls) {
        controls.minDistance = Math.max(0.8, radius * 0.75);
        controls.maxDistance = Math.max(10.0, radius * 6.0);
        controls.target.set(0, 0, 0);
    }

    // Align with WebGi orbit controls reference ray
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
        duration: 0.8,
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
        duration: 0.8,
        ease: "power2.inOut"
    });
}

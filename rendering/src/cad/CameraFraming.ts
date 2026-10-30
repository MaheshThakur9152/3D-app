import gsap from 'gsap';

export interface CameraFrameSettings {
    /** Fraction of the smaller viewport dimension occupied by the product bounds. */
    coverage?: number;
    /** 1.0 is the fitted view; values above 1 move the camera closer. */
    zoom?: number;
    /** Camera elevation above the floor, in degrees. */
    elevationDeg?: number;
    /** Camera orbit azimuth around the product, in degrees. */
    azimuthDeg?: number;
}

const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

export function autoFrameCamera(
    camera: any,
    controls: any,
    boundingRadius: number,
    productCenter?: { x: number; y: number; z: number } | null,
    viewportAspect?: number | null,
    animate = true,
    onFrameUpdate?: () => void,
    settings: CameraFrameSettings = {}
): void {
    if (!camera) return;

    const radius = Math.max(0.05, Number.isFinite(boundingRadius) ? boundingRadius : 1.35);
    const targetX = productCenter?.x ?? 0;
    const targetY = productCenter?.y ?? 0.8;
    const targetZ = productCenter?.z ?? 0;

    // Use the actual 3D canvas dimensions, not the entire browser window.
    let aspect = viewportAspect || 1;
    if (!viewportAspect) {
        const canvas = typeof document !== 'undefined'
            ? document.getElementById('webgi-canvas') as HTMLCanvasElement | null
            : null;
        if (canvas && canvas.clientWidth > 0 && canvas.clientHeight > 0) {
            aspect = canvas.clientWidth / canvas.clientHeight;
        } else if (camera.aspect && Number.isFinite(camera.aspect)) {
            aspect = camera.aspect;
        }
    }
    aspect = Math.max(0.35, Math.min(3.5, aspect));

    const fovDegrees = camera.cameraObject?.fov
        || camera.fov
        || camera.getCameraOptions?.()?.fov
        || 45;
    const fovY = (fovDegrees * Math.PI) / 180;
    const fovX = 2 * Math.atan(Math.tan(fovY / 2) * aspect);
    const effectiveFov = Math.min(fovY, fovX);

    // Previous code used 0.60, which made the jewelry noticeably too small.
    // 0.78 is the new starting composition; the UI zoom remains independently adjustable.
    const coverage = clamp(settings.coverage ?? 0.78, 0.50, 0.88);
    const zoom = clamp(settings.zoom ?? 1.0, 0.70, 2.0);
    const distance = radius / (Math.tan(effectiveFov / 2) * coverage * zoom);

    const elevationDeg = clamp(settings.elevationDeg ?? 30, 8, 82);
    const azimuthDeg = settings.azimuthDeg ?? -25;
    const elevation = elevationDeg * Math.PI / 180;
    const azimuth = azimuthDeg * Math.PI / 180;

    const camX = targetX + Math.sin(azimuth) * Math.cos(elevation) * distance;
    const camY = targetY + Math.sin(elevation) * distance;
    const camZ = targetZ + Math.cos(azimuth) * Math.cos(elevation) * distance;

    if (controls) {
        controls.enabled = true;
        controls.minDistance = Math.max(0.35, radius * 0.35);
        controls.maxDistance = Math.max(12, radius * 8);
        controls.target.set(targetX, targetY, targetZ);
    }

    if (!animate) {
        camera.position.set(camX, camY, camZ);
        camera.target.set(targetX, targetY, targetZ);
        camera.positionUpdated(true);
        camera.targetUpdated(true);
        controls?.update?.();
        return;
    }

    const previousAutoRotate = controls?.autoRotate ?? false;
    if (controls) controls.autoRotate = false;

    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(camera.target);

    gsap.to(camera.position, {
        x: camX,
        y: camY,
        z: camZ,
        duration: 0.65,
        ease: 'power2.inOut',
        onUpdate: () => {
            camera.positionUpdated(true);
            camera.targetUpdated(true);
            onFrameUpdate?.();
        },
        onComplete: () => {
            if (controls) {
                controls.autoRotate = previousAutoRotate;
                controls.update?.();
            }
        }
    });

    gsap.to(camera.target, {
        x: targetX,
        y: targetY,
        z: targetZ,
        duration: 0.65,
        ease: 'power2.inOut'
    });
}

# Studio Rendering Settings & Calibration Reference

This document catalogs the calibrated physical parameters for lighting, environment reflections, metals, gemstones, and shadow systems in the jewelry rendering engine.

---

## 1. Calibrated Physical Metal Presets (`MaterialRoleBinder.ts`)

| Alloy / Finish | Hex Color | Roughness | Metalness | Clearcoat | Clearcoat Roughness |
|---|---|---|---|---|---|
| **18K Yellow Gold** | `#D9A441` | 0.12 | 1.0 | 0.10 | 0.05 |
| **18K Rose Gold** | `#C98770` | 0.13 | 1.0 | 0.10 | 0.05 |
| **18K White Gold** | `#D7D7D2` | 0.14 | 1.0 | 0.12 | 0.05 |
| **Platinum 950** | `#BEC3C8` | 0.10 | 1.0 | 0.15 | 0.03 |
| **Sterling Silver** | `#EAEAEA` | 0.08 | 1.0 | 0.08 | 0.04 |
| **Black Rhodium** | `#2B2B2D` | 0.18 | 1.0 | 0.20 | 0.06 |

---

## 2. Gemstone Optical Physics Table (`MaterialRoleBinder.ts`)

| Gemstone | Refractive Index (IOR) | Dispersion (Abbe / Fire) | Color Tint | Transmission | Roughness |
|---|---|---|---|---|---|
| **Diamond** | 2.417 | 0.044 | `#FFFFFF` | 1.0 | 0.00 |
| **Ruby** | 1.770 | 0.018 | `#E0115F` | 0.85 | 0.02 |
| **Sapphire** | 1.770 | 0.018 | `#0F52BA` | 0.85 | 0.02 |
| **Emerald** | 1.580 | 0.014 | `#50C878` | 0.80 | 0.04 |
| **Amethyst** | 1.544 | 0.013 | `#9966CC` | 0.88 | 0.02 |
| **Aquamarine**| 1.577 | 0.014 | `#7FFFD4` | 0.90 | 0.01 |
| **Moissanite**| 2.650 | 0.104 | `#F8F8FF` | 1.0 | 0.00 |

*DiamondPlugin features:* Dispersion enabled, internal reflection bounces = 4, absorption distance = 1.2.

---

## 3. Physical 3-Point Lighting Rig (`StudioLighting.ts`)

| Light | Type | Position `[X, Y, Z]` | Color | Intensity | Cast Shadow |
|---|---|---|---|---|---|
| **Key Light** | `DirectionalLight2` | `[3.5, 5.0, 4.0]` | `#FFFFFF` | 1.80 | False |
| **Fill Light** | `DirectionalLight2` | `[-3.5, 3.0, -2.0]` | `#F8FAFC` | 0.90 | False |
| **Rim Light** | `DirectionalLight2` | `[0.0, 6.0, -3.0]` | `#FFFFFF` | 1.40 | False |
| **Ambient Light** | `AmbientLight2` | N/A | `#FFFFFF` | 0.35 | N/A |

*Total Scene Light Budget:* Scaled for HDR exposure without blowing out white golds or platinum highlights.

---

## 4. Studio Floor & Contact Shadow Configuration

| Parameter | Floor Platform (`StudioFloor.ts`) | Contact Shadow (`ContactShadowGroundPlugin`) |
|---|---|---|
| **Footprint** | 6.0 x 6.0 units (finite square) | Dynamic fitted to radius (`2.5 * r`) |
| **Y Coordinate** | `0.0000` (world ground) | `+0.0002` (anti-z-fighting offset) |
| **Material Base** | `#f1f1ef` neutral matte PBR | `#111111` shadow alpha vignette |
| **Roughness / Metalness** | `roughness = 0.88`, `metalness = 0.0` | N/A (alpha-blended) |
| **Polygon Offset** | `factor = 1.0`, `units = 1.0` (pushed back) | `factor = -1.0`, `units = -1.0` (pulled forward) |
| **Default Opacity** | 1.0 | 0.45 |
| **Default Blur** | N/A | 3.5 |

---

## 5. Viewport & Camera Defaults

- **Target Framing Coverage:** 78% of viewport bounds.
- **Focal Elevation:** Perspective line aimed at target center `(0.0, -0.2, 0.0)` for jewelry catalog hero perspective.
- **Orbit Distance Clamping:** Min: `1.5` units, Max: `16.0` units.
- **Aspect-Ratio Strategy:** `min(fovY, fovX)` dual-calculation preventing portrait edge clipping.

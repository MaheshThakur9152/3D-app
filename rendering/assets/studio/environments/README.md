# Studio HDR Environments

This directory holds studio high-dynamic-range (HDR/EXR) environment reflection maps for the jewelry visualization playground.

## Architecture & Format

- **Format:** Equirectangular `.hdr` or `.exr`, or synthesized 32-bit linear CanvasTexture via `StudioEnvironment.ts`.
- **Resolution:** 1024x512 or 2048x1024 (unclamped linear float reflection radiance).
- **Processing:** Fed to `viewer.scene.setEnvironment(texture)` which triggers WebGi's internal PMREM (Prefiltered Mipmapped Radiance Environment Map) generator.
- **Lighting presets:**
  - `white`: Pure White Catalog (high-key studio, dual softboxes, clean highlights)
  - `neutral`: Studio Neutral (balanced wrap, soft ambient, neutral fill)
  - `warm`: Warm Ivory Boutique (warm overhead specular, soft gold accent)
  - `dark`: Velvet Dark (moody high-contrast rim, dark ground reflection)

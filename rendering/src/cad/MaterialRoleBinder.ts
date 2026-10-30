/**
 * MaterialRoleBinder.ts
 * Manages manifest-aware material assignment, WebGi DiamondPlugin binding,
 * independent gemstone groups (center vs accent), and non-destructive uniform updates.
 */

import { Color, MeshStandardMaterial2, ViewerApp, DiamondPlugin, ProgressivePlugin } from "webgi";
import { ModelManifest, ManifestComponent, ComponentRole } from "./ModelManifest";

export interface GemstonePreset {
    id: string;
    name: string;
    color: string;
    refractiveIndex: number;
    dispersion: number;
    absorptionFactor: number;
    envMapIntensity: number;
}

export const GEMSTONE_PRESETS: Record<string, GemstonePreset> = {
    diamond: {
        id: 'diamond',
        name: 'Brilliant Diamond',
        color: '#CFECEC',
        refractiveIndex: 2.417,
        dispersion: 0.012,
        absorptionFactor: 1.0,
        envMapIntensity: 1.35
    },
    ruby: {
        id: 'ruby',
        name: 'Vivid Ruby',
        color: '#f70db1',
        refractiveIndex: 1.77,
        dispersion: 0.018,
        absorptionFactor: 1.5,
        envMapIntensity: 1.25
    },
    emerald: {
        id: 'emerald',
        name: 'Colombian Emerald',
        color: '#5eca00',
        refractiveIndex: 1.58,
        dispersion: 0.014,
        absorptionFactor: 2.0,
        envMapIntensity: 1.25
    },
    sapphire: {
        id: 'sapphire',
        name: 'Royal Sapphire',
        color: '#1766bb',
        refractiveIndex: 1.77,
        dispersion: 0.018,
        absorptionFactor: 1.5,
        envMapIntensity: 1.25
    },
    aquamarine: {
        id: 'aquamarine',
        name: 'Aquamarine',
        color: '#62cffe',
        refractiveIndex: 1.58,
        dispersion: 0.014,
        absorptionFactor: 1.0,
        envMapIntensity: 1.25
    },
    canary: {
        id: 'canary',
        name: 'Canary Diamond',
        color: '#efe75b',
        refractiveIndex: 2.417,
        dispersion: 0.044,
        absorptionFactor: 1.2,
        envMapIntensity: 1.35
    },
    pink: {
        id: 'pink',
        name: 'Pink Diamond',
        color: '#fa37d7',
        refractiveIndex: 2.417,
        dispersion: 0.044,
        absorptionFactor: 1.2,
        envMapIntensity: 1.35
    },
    orange: {
        id: 'orange',
        name: 'Mandarin Garnet',
        color: '#eb8e17',
        refractiveIndex: 1.79,
        dispersion: 0.027,
        absorptionFactor: 1.5,
        envMapIntensity: 1.25
    },
    amethyst: {
        id: 'amethyst',
        name: 'Amethyst',
        color: '#c200f2',
        refractiveIndex: 1.54,
        dispersion: 0.013,
        absorptionFactor: 1.8,
        envMapIntensity: 1.25
    }
};

export interface MetalPreset {
    id: string;
    name: string;
    color: string;
    roughness: number;
    metalness: number;
}

export const PHYSICAL_METAL_PRESETS: Record<string, MetalPreset> = {
    yellow_gold: {
        id: 'yellow_gold',
        name: '18K Yellow Gold',
        color: '#D9A441',
        roughness: 0.00,
        metalness: 1.0
    },
    rose_gold: {
        id: 'rose_gold',
        name: '18K Rose Gold',
        color: '#C98770',
        roughness: 0.00,
        metalness: 1.0
    },
    white_gold: {
        id: 'white_gold',
        name: '18K White Gold',
        color: '#D7D7D2',
        roughness: 0.00,
        metalness: 1.0
    },
    platinum: {
        id: 'platinum',
        name: 'Platinum 950',
        color: '#BEC3C8',
        roughness: 0.00,
        metalness: 1.0
    },
    silver: {
        id: 'silver',
        name: 'Sterling Silver',
        color: '#EAEAEA',
        roughness: 0.00,
        metalness: 1.0
    },
    black_rhodium: {
        id: 'black_rhodium',
        name: 'Black Rhodium',
        color: '#2B2B2D',
        roughness: 0.04,
        metalness: 1.0
    }
};

/**
 * Normalizes texture encodings according to standard color space rules:
 * - Color maps (diffuse, emissive): sRGB (3001)
 * - Data maps (normal, bump, roughness, metalness, ao, alpha): Linear (3000)
 * Prevents "THREE.WebGLProgram: Unsupported encoding: undefined".
 */
export function normalizeMaterialEncodings(mat: any): void {
    if (!mat) return;
    if (Array.isArray(mat)) {
        mat.forEach(normalizeMaterialEncodings);
        return;
    }

    if (mat.map && mat.map.isTexture && (mat.map.encoding === undefined || isNaN(mat.map.encoding))) {
        mat.map.encoding = 3001; // sRGBEncoding
    }
    if (mat.emissiveMap && mat.emissiveMap.isTexture && (mat.emissiveMap.encoding === undefined || isNaN(mat.emissiveMap.encoding))) {
        mat.emissiveMap.encoding = 3001;
    }

    const linearMaps = [
        'normalMap', 'bumpMap', 'roughnessMap', 'metalnessMap',
        'aoMap', 'alphaMap', 'clearcoatMap', 'clearcoatNormalMap',
        'clearcoatRoughnessMap', 'iridescenceMap', 'iridescenceThicknessMap',
        'transmissionMap', 'thicknessMap', 'specularIntensityMap'
    ];
    for (const key of linearMaps) {
        const tex = mat[key];
        if (tex && tex.isTexture && (tex.encoding === undefined || isNaN(tex.encoding))) {
            tex.encoding = 3000; // LinearEncoding
        }
    }
}

export class MaterialRoleBinder {
    private viewer: ViewerApp;

    // Component tracking
    private shankMeshes: any[] = [];
    private headMeshes: any[] = [];
    private prongMeshes: any[] = [];
    private centerStoneMeshes: any[] = [];
    private accentStoneMeshes: any[] = [];
    private unassignedMeshes: any[] = [];

    private componentMap: Map<string, { mesh: any; comp: ManifestComponent }> = new Map();
    private meshToNodeIdMap: Map<any, string> = new Map();
    private baselineMaterials: Map<string, any> = new Map();
    private userConfiguredComponents: Map<string, any> = new Map();
    private isCurrentModelBuiltin = true;

    // Active Colors & Presets
    private currentShankColor: Color = new Color(0xffffff);
    private currentHeadColor: Color = new Color(0xfea04d);
    private currentProngColor: Color = new Color(0xfea04d);
    private currentCenterGemPreset: GemstonePreset = GEMSTONE_PRESETS.diamond;
    private currentAccentGemPreset: GemstonePreset = GEMSTONE_PRESETS.diamond;

    // Active Finish & Optical Parameters
    private currentMetalRoughness = 0.00;
    private currentDiamondBrilliance = 1.35;
    private currentDiamondDispersion = 0.012;

    constructor(viewer: ViewerApp) {
        this.viewer = viewer;
    }

    public bindComponents(modelRoot: any, manifest: ModelManifest, isBuiltin = true): void {
        this.clear();
        this.isCurrentModelBuiltin = isBuiltin;

        for (const comp of manifest.components) {
            let mesh = this.viewer.scene.findObjectsByName(comp.nodeName)[0];
            if (!mesh && comp.nodeId) {
                mesh = this.viewer.scene.findObjectsByName(comp.nodeId)[0];
            }

            if (!mesh && modelRoot && typeof modelRoot.traverse === 'function') {
                modelRoot.traverse((child: any) => {
                    if (!mesh && (child.name === comp.nodeName || child.name === comp.nodeId)) {
                        mesh = child;
                    }
                });
            }

            if (mesh) {
                // Normalize texture encodings on mesh material to prevent undefined shader warnings
                normalizeMaterialEncodings(mesh.material);

                // Preserve baseline original material reference
                if (!mesh.userData) mesh.userData = {};
                if (!mesh.userData.originalMaterial && mesh.material) {
                    mesh.userData.originalMaterial = typeof mesh.material.clone === 'function'
                        ? mesh.material.clone()
                        : mesh.material;
                }
                this.baselineMaterials.set(comp.nodeId, mesh.userData.originalMaterial || mesh.material);

                this.componentMap.set(comp.nodeId, { mesh, comp });
                this.meshToNodeIdMap.set(mesh, comp.nodeId);

                if (isBuiltin) {
                    // PRESERVE pre-authored GLB materials: group by role without modifying material
                    this.groupMeshByRole(mesh, comp.role);
                } else {
                    // Group mesh by role without forcing custom materials
                    this.groupMeshByRole(mesh, comp.role);

                    // Predictable neutral fallback ONLY if mesh has no usable material
                    if (!mesh.material) {
                        mesh.material = new MeshStandardMaterial2({
                            color: new Color(0xcccccc),
                            roughness: 0.00,
                            metalness: 1.0
                        });
                        mesh.userData.originalMaterial = mesh.material;
                    }
                }
            }
        }

        // Apply initial material settings only for custom CAD models (built-in retains pre-authored GLB state)
        if (!isBuiltin) {
            // Restore saved user configurations if present
            const saved = (manifest as any)?.savedMaterialAssignments;
            if (saved && typeof saved === 'object') {
                this.applySavedMaterialAssignments(saved);
            } else {
                for (const comp of manifest.components) {
                    const item = this.componentMap.get(comp.nodeId);
                    if (item) this.assignMeshToRole(item.mesh, comp.role);
                }
            }
        }
    }

    public groupMeshByRole(mesh: any, role: ComponentRole): void {
        this.removeFromLists(mesh);
        switch (role) {
            case 'metal_shank':
                this.shankMeshes.push(mesh);
                break;
            case 'metal_head':
                this.headMeshes.push(mesh);
                break;
            case 'metal_prongs':
                this.prongMeshes.push(mesh);
                break;
            case 'diamond':
            case 'colored_gemstone':
                this.centerStoneMeshes.push(mesh);
                break;
            case 'accent_stone':
                this.accentStoneMeshes.push(mesh);
                break;
            case 'unassigned':
            default:
                this.unassignedMeshes.push(mesh);
                break;
        }
    }

    public assignMeshToRole(mesh: any, role: ComponentRole): void {
        this.removeFromLists(mesh);

        const diamondPlugin = this.viewer.getPlugin(DiamondPlugin);

        switch (role) {
            case 'metal_shank':
                this.shankMeshes.push(mesh);
                this.applyMetalMaterial(mesh, this.currentShankColor);
                break;

            case 'metal_head':
                this.headMeshes.push(mesh);
                this.applyMetalMaterial(mesh, this.currentHeadColor);
                break;

            case 'metal_prongs':
                this.prongMeshes.push(mesh);
                this.applyMetalMaterial(mesh, this.currentProngColor);
                break;

            case 'diamond':
            case 'colored_gemstone':
                this.centerStoneMeshes.push(mesh);
                this.applyDiamondMaterial(mesh, this.currentCenterGemPreset, diamondPlugin);
                break;

            case 'accent_stone':
                this.accentStoneMeshes.push(mesh);
                this.applyDiamondMaterial(mesh, this.currentAccentGemPreset, diamondPlugin);
                break;

            case 'unassigned':
            default:
                this.unassignedMeshes.push(mesh);
                // Treat unassigned as structural metal so it renders cleanly
                this.applyMetalMaterial(mesh, this.currentShankColor);
                break;
        }
    }

    private applyMetalMaterial(mesh: any, color: Color): void {
        let mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;

        // If no material or previously a diamond, create a compatible MeshStandardMaterial2
        if (!mat || mat.isDiamondMaterial || mat.type === 'DiamondMaterial' || mat.isDiamond) {
            mesh.material = new MeshStandardMaterial2({
                color: color,
                roughness: this.currentMetalRoughness,
                metalness: 1.0
            });
        } else {
            // Preserve existing compatible WebGi metal material and update in-place
            if (mat.color && typeof mat.color.copy === 'function') {
                mat.color.copy(color);
            } else if (mat.color) {
                mat.color = color;
            }
            // Preserve pre-authored roughness / mirror polish (never force satin 0.18 onto mirror metal)
            if (mat.roughness !== undefined) {
                mat.roughness = Math.min(mat.roughness, this.currentMetalRoughness);
            }
            if (mat.metalness !== undefined) mat.metalness = 1.0;
        }
    }

    private applyDiamondMaterial(mesh: any, preset: GemstonePreset, diamondPlugin?: DiamondPlugin): void {
        if (!diamondPlugin) return;

        const gemColor = new Color(preset.color);
        let mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        const isDiamond = mat && (
            mat.isDiamondMaterial || 
            mat.type === 'DiamondMaterial' || 
            mat.isDiamond ||
            mat.userData?.isDiamond ||
            (mat.name && (mat.name.toLowerCase().includes('diamond') || mat.name.toLowerCase().includes('gem')))
        );

        if (isDiamond) {
            // Update existing DiamondMaterial parameters in-place without rebuilding shader
            if (mat.color && typeof mat.color.copy === 'function') {
                mat.color.copy(gemColor);
            } else if (mat.color) {
                mat.color = gemColor;
            }
            if (preset.id !== 'diamond') {
                mat.refractiveIndex = preset.refractiveIndex;
                mat.dispersion = preset.dispersion;
                mat.absorptionFactor = preset.absorptionFactor;
            } else {
                mat.refractiveIndex = 2.4;
                if (mat.dispersion === undefined || mat.dispersion > 0.025) {
                    mat.dispersion = 0.012;
                }
            }
            if (mat.userData) {
                mat.userData.isDiamond = true;
                mat.userData.isDiamondMaterialParameters = true;
            }
        } else if (typeof (diamondPlugin as any).makeDiamond === 'function') {
            try {
                if (mat) {
                    mat.isDiamond = true;
                    mat.isDiamondMaterialParameters = true;
                    if (!mat.userData) mat.userData = {};
                    mat.userData.isDiamond = true;
                    mat.userData.isDiamondMaterialParameters = true;
                    if (!mat.userData.appliedMeshes) mat.userData.appliedMeshes = [mesh];
                    else if (!mat.userData.appliedMeshes.includes(mesh)) mat.userData.appliedMeshes.push(mesh);
                }

                (diamondPlugin as any).prepareDiamondMesh(mesh, { cacheKey: mesh.uuid || mesh.name });
                const diamondMat = (diamondPlugin as any).makeDiamond(mesh.material, { cacheKey: mesh.uuid || mesh.name }, {
                    isDiamond: true,
                    isDiamondMaterial: true,
                    isDiamondMaterialParameters: true,
                    color: gemColor,
                    refractiveIndex: preset.refractiveIndex,
                    dispersion: preset.id === 'diamond' ? 0.012 : preset.dispersion,
                    reflectivity: 0.5,
                    rayBounces: 5,
                    absorptionFactor: preset.absorptionFactor,
                    envMapIntensity: preset.envMapIntensity
                });

                if (diamondMat && mesh.material !== diamondMat) {
                    mesh.material = (diamondMat as any).materialObject || diamondMat;
                }
            } catch (err) {
                console.warn(`[MaterialRoleBinder] Diamond shader binding failed for ${mesh.name}, fallback to refractive standard:`, err);
                if (mesh.material) {
                    mesh.material.color = gemColor;
                    if (mesh.material.roughness !== undefined) mesh.material.roughness = 0.00;
                    if (mesh.material.metalness !== undefined) mesh.material.metalness = 0.0;
                    if (mesh.material.transmission !== undefined) mesh.material.transmission = 0.95;
                    if (mesh.material.ior !== undefined) mesh.material.ior = preset.refractiveIndex;
                }
            }
        }
    }

    private removeFromLists(mesh: any): void {
        this.shankMeshes = this.shankMeshes.filter(m => m !== mesh);
        this.headMeshes = this.headMeshes.filter(m => m !== mesh);
        this.prongMeshes = this.prongMeshes.filter(m => m !== mesh);
        this.centerStoneMeshes = this.centerStoneMeshes.filter(m => m !== mesh);
        this.accentStoneMeshes = this.accentStoneMeshes.filter(m => m !== mesh);
        this.unassignedMeshes = this.unassignedMeshes.filter(m => m !== mesh);
    }

    public setMetalColors(shankColor: Color, headColor: Color, prongColor?: Color): void {
        this.currentShankColor = shankColor;
        this.currentHeadColor = headColor;
        this.currentProngColor = prongColor || headColor;

        for (const m of this.shankMeshes) {
            const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
            if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                if (mat.color?.copy) mat.color.copy(this.currentShankColor);
                else mat.color = this.currentShankColor;
            }
        }
        for (const m of this.headMeshes) {
            const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
            if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                if (mat.color?.copy) mat.color.copy(this.currentHeadColor);
                else mat.color = this.currentHeadColor;
            }
        }
        for (const m of this.prongMeshes) {
            const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
            if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                if (mat.color?.copy) mat.color.copy(this.currentProngColor);
                else mat.color = this.currentProngColor;
            }
        }
        for (const m of this.unassignedMeshes) {
            const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
            if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                if (mat.color?.copy) mat.color.copy(this.currentShankColor);
                else mat.color = this.currentShankColor;
            }
        }

        this.invalidateRenderingHistory();
    }

    public setGemstoneAppearance(preset: GemstonePreset, targetGroup: 'all' | 'center' | 'accent' = 'all'): void {
        const diamondPlugin = this.viewer.getPlugin(DiamondPlugin);

        if (targetGroup === 'all' || targetGroup === 'center') {
            this.currentCenterGemPreset = preset;
            for (const m of this.centerStoneMeshes) {
                this.applyDiamondMaterial(m, preset, diamondPlugin);
            }
        }

        if (targetGroup === 'all' || targetGroup === 'accent') {
            this.currentAccentGemPreset = preset;
            for (const m of this.accentStoneMeshes) {
                this.applyDiamondMaterial(m, preset, diamondPlugin);
            }
        }

        this.invalidateRenderingHistory();
    }

    public setGemColor(color: Color): void {
        const hex = '#' + color.getHexString();
        const matched = Object.values(GEMSTONE_PRESETS).find(p => p.color.toLowerCase() === hex.toLowerCase());
        const preset: GemstonePreset = matched || {
            id: 'custom',
            name: 'Custom Gemstone',
            color: hex,
            refractiveIndex: 2.417,
            dispersion: 0.044,
            absorptionFactor: 1.0,
            envMapIntensity: 1.35
        };
        this.setGemstoneAppearance(preset, 'all');
    }

    public invalidateRenderingHistory(): void {
        this.viewer.renderer.reset();
        const progressive = this.viewer.getPlugin(ProgressivePlugin);
        if (progressive && typeof (progressive as any).reset === 'function') {
            (progressive as any).reset();
        }
    }

    private applyCurrentColors(): void {
        this.setMetalColors(this.currentShankColor, this.currentHeadColor, this.currentProngColor);
        this.setGemstoneAppearance(this.currentCenterGemPreset, 'center');
        this.setGemstoneAppearance(this.currentAccentGemPreset, 'accent');
    }

    public updateRole(nodeId: string, newRole: ComponentRole): void {
        const item = this.componentMap.get(nodeId);
        if (item) {
            item.comp.role = newRole;
            this.assignMeshToRole(item.mesh, newRole);
            this.invalidateRenderingHistory();
        }
    }

    public getComponents(): ManifestComponent[] {
        return Array.from(this.componentMap.values()).map(i => i.comp);
    }

    public getMeshByNodeId(nodeId: string): any | null {
        return this.componentMap.get(nodeId)?.mesh || null;
    }

    public getNodeIdByMesh(mesh: any): string | null {
        return this.meshToNodeIdMap.get(mesh) || null;
    }

    public getCenterStoneMeshes(): any[] {
        return this.centerStoneMeshes;
    }

    public getAccentStoneMeshes(): any[] {
        return this.accentStoneMeshes;
    }

    public getAllGemstoneMeshes(): any[] {
        return [...this.centerStoneMeshes, ...this.accentStoneMeshes];
    }

    public getShankMeshes(): any[] {
        return this.shankMeshes;
    }

    public getHeadMeshes(): any[] {
        return this.headMeshes;
    }

    public getProngMeshes(): any[] {
        return this.prongMeshes;
    }

    public getUnassignedMeshes(): any[] {
        return this.unassignedMeshes;
    }

    public setMetalRoughness(roughness: number): void {
        this.currentMetalRoughness = Math.max(0.00, Math.min(1.0, roughness));
        const metals = [...this.shankMeshes, ...this.headMeshes, ...this.prongMeshes, ...this.unassignedMeshes];
        for (const m of metals) {
            const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
            if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                mat.roughness = this.currentMetalRoughness;
                if (mat.metalness !== undefined) mat.metalness = 1.0;
            }
        }
        this.invalidateRenderingHistory();
    }

    public setMetalFinish(finish: 'satin' | 'standard' | 'high_polish'): void {
        const map = {
            satin: 0.35,
            standard: 0.08,
            high_polish: 0.00
        };
        this.setMetalRoughness(map[finish] ?? 0.00);
    }

    public setDiamondBrilliance(intensity: number): void {
        this.currentDiamondBrilliance = Math.max(0.2, Math.min(3.0, intensity));
        const gems = [...this.centerStoneMeshes, ...this.accentStoneMeshes];
        for (const g of gems) {
            const mat = Array.isArray(g?.material) ? g.material[0] : g?.material;
            if (mat) {
                mat.envMapIntensity = this.currentDiamondBrilliance;
            }
        }
        this.invalidateRenderingHistory();
    }

    public setDiamondDispersion(dispersion: number): void {
        this.currentDiamondDispersion = Math.max(0.0, Math.min(0.1, dispersion));
        const gems = [...this.centerStoneMeshes, ...this.accentStoneMeshes];
        for (const g of gems) {
            const mat = Array.isArray(g?.material) ? g.material[0] : g?.material;
            if (mat) {
                mat.dispersion = this.currentDiamondDispersion;
            }
        }
        this.invalidateRenderingHistory();
    }

    public getMetalRoughness(): number {
        return this.currentMetalRoughness;
    }

    public getDiamondBrilliance(): number {
        return this.currentDiamondBrilliance;
    }

    public getDiamondDispersion(): number {
        return this.currentDiamondDispersion;
    }

    public applyMetalColor(colorHex: string, role = 'all_metals'): void {
        const color = new Color(colorHex);
        if (role === 'all_metals' || role === 'metal_shank') {
            this.currentShankColor = color;
            for (const m of this.shankMeshes) {
                const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
                if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                    if (mat.color?.copy) mat.color.copy(color);
                    else mat.color = color;
                }
            }
        }
        if (role === 'all_metals' || role === 'metal_head') {
            this.currentHeadColor = color;
            for (const m of this.headMeshes) {
                const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
                if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                    if (mat.color?.copy) mat.color.copy(color);
                    else mat.color = color;
                }
            }
        }
        if (role === 'all_metals' || role === 'metal_prongs') {
            this.currentProngColor = color;
            for (const m of this.prongMeshes) {
                const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
                if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                    if (mat.color?.copy) mat.color.copy(color);
                    else mat.color = color;
                }
            }
        }
        for (const m of this.unassignedMeshes) {
            const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
            if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                if (mat.color?.copy) mat.color.copy(this.currentShankColor);
                else mat.color = this.currentShankColor;
            }
        }
        this.invalidateRenderingHistory();
    }

    public applyMetalFinish(roughness: number, metalness = 1.0, role = 'all_metals'): void {
        this.currentMetalRoughness = Math.max(0.01, Math.min(1.0, roughness));
        let targets = [...this.shankMeshes, ...this.headMeshes, ...this.prongMeshes, ...this.unassignedMeshes];
        if (role === 'metal_shank') targets = this.shankMeshes;
        else if (role === 'metal_head') targets = this.headMeshes;
        else if (role === 'metal_prongs') targets = this.prongMeshes;

        for (const m of targets) {
            const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
            if (mat && !mat.isDiamondMaterial && !mat.isDiamond) {
                mat.roughness = this.currentMetalRoughness;
                if (mat.metalness !== undefined) mat.metalness = metalness;
            }
        }
        this.invalidateRenderingHistory();
    }

    public applyGemstonePreset(preset: GemstonePreset, role = 'all_gemstones'): void {
        const diamondPlugin = this.viewer.getPlugin(DiamondPlugin);
        let targets: any[] = [];
        if (role === 'all_gemstones') {
            targets = [...this.centerStoneMeshes, ...this.accentStoneMeshes];
            this.currentCenterGemPreset = preset;
            this.currentAccentGemPreset = preset;
        } else if (role === 'diamond' || role === 'center') {
            targets = this.centerStoneMeshes;
            this.currentCenterGemPreset = preset;
        } else if (role === 'accent_stone' || role === 'accent') {
            targets = this.accentStoneMeshes;
            this.currentAccentGemPreset = preset;
        }

        for (const m of targets) {
            this.applyDiamondMaterial(m, preset, diamondPlugin);
        }
        this.invalidateRenderingHistory();
    }

    public applyGemstoneOpticalParameters(params: {
        color?: string;
        refractiveIndex?: number;
        dispersion?: number;
        absorptionFactor?: number;
        envMapIntensity?: number;
    }, role = 'all_gemstones'): void {
        let targets = [...this.centerStoneMeshes, ...this.accentStoneMeshes];
        if (role === 'diamond' || role === 'center') targets = this.centerStoneMeshes;
        else if (role === 'accent_stone' || role === 'accent') targets = this.accentStoneMeshes;

        for (const m of targets) {
            const mat = Array.isArray(m?.material) ? m.material[0] : m?.material;
            if (mat) {
                if (params.color) {
                    const c = new Color(params.color);
                    if (mat.color?.copy) mat.color.copy(c);
                    else mat.color = c;
                }
                if (params.refractiveIndex !== undefined) {
                    mat.refractiveIndex = params.refractiveIndex;
                    if (mat.ior !== undefined) mat.ior = params.refractiveIndex;
                }
                if (params.dispersion !== undefined) mat.dispersion = params.dispersion;
                if (params.absorptionFactor !== undefined) mat.absorptionFactor = params.absorptionFactor;
                if (params.envMapIntensity !== undefined) mat.envMapIntensity = params.envMapIntensity;
            }
        }
        this.invalidateRenderingHistory();
    }

    public applyGemstonePresetToComponent(nodeId: string, preset: GemstonePreset): void {
        let item = this.componentMap.get(nodeId);
        if (!item) {
            for (const [, val] of this.componentMap.entries()) {
                if (val.comp.nodeName === nodeId || val.mesh?.name === nodeId) {
                    item = val;
                    break;
                }
            }
        }
        if (!item || !item.mesh) return;

        const mesh = item.mesh;
        const diamondPlugin = this.viewer.getPlugin(DiamondPlugin);

        // Ensure mesh has its own unique cloned material instance so other stones are not modified
        let mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (mat && typeof mat.clone === 'function' && !mat.__uniqueInstance) {
            if (mat.userData) {
                mat.userData.isDiamond = true;
                mat.userData.isDiamondMaterialParameters = true;
            }
            mesh.material = mat.clone();
            mesh.material.__uniqueInstance = true;
        }

        this.applyDiamondMaterial(mesh, preset, diamondPlugin);
        mesh.userData.__userConfigured = true;
        this.userConfiguredComponents.set(nodeId, { type: 'gemstone', preset });
        this.invalidateRenderingHistory();
    }

    public applyGemstoneParamsToComponent(nodeId: string, params: {
        color?: string;
        refractiveIndex?: number;
        dispersion?: number;
        absorptionFactor?: number;
        envMapIntensity?: number;
    }): void {
        let item = this.componentMap.get(nodeId);
        if (!item) {
            for (const [, val] of this.componentMap.entries()) {
                if (val.comp.nodeName === nodeId || val.mesh?.name === nodeId) {
                    item = val;
                    break;
                }
            }
        }
        if (!item || !item.mesh) return;

        const mesh = item.mesh;
        let mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (mat && typeof mat.clone === 'function' && !mat.__uniqueInstance) {
            if (mat.userData) {
                mat.userData.isDiamond = true;
                mat.userData.isDiamondMaterialParameters = true;
            }
            mesh.material = mat.clone();
            mesh.material.__uniqueInstance = true;
            mat = mesh.material;
        }

        if (mat) {
            if (params.color) {
                const c = new Color(params.color);
                if (mat.color?.copy) mat.color.copy(c);
                else mat.color = c;
            }
            if (params.refractiveIndex !== undefined) {
                mat.refractiveIndex = params.refractiveIndex;
                if (mat.ior !== undefined) mat.ior = params.refractiveIndex;
            }
            if (params.dispersion !== undefined) mat.dispersion = params.dispersion;
            if (params.absorptionFactor !== undefined) mat.absorptionFactor = params.absorptionFactor;
            if (params.envMapIntensity !== undefined) mat.envMapIntensity = params.envMapIntensity;
        }

        this.invalidateRenderingHistory();
    }

    public applyMetalPresetToComponent(nodeId: string, colorHex: string, roughness: number, metalness = 1.0): void {
        let item = this.componentMap.get(nodeId);
        if (!item) {
            for (const [, val] of this.componentMap.entries()) {
                if (val.comp.nodeName === nodeId || val.mesh?.name === nodeId) {
                    item = val;
                    break;
                }
            }
        }
        if (!item || !item.mesh) return;

        const mesh = item.mesh;
        let mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (mat && typeof mat.clone === 'function' && !mat.__uniqueInstance) {
            mesh.material = mat.clone();
            mesh.material.__uniqueInstance = true;
            mat = mesh.material;
        }

        this.applyMetalMaterial(mesh, new Color(colorHex));
        mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (mat) {
            mat.roughness = roughness;
            mat.metalness = metalness;
        }
        mesh.userData.__userConfigured = true;
        this.userConfiguredComponents.set(nodeId, { type: 'metal', colorHex, roughness, metalness });
        this.invalidateRenderingHistory();
    }

    public resetComponentMaterial(nodeId: string): void {
        let item = this.componentMap.get(nodeId);
        if (!item) {
            for (const [, val] of this.componentMap.entries()) {
                if (val.comp.nodeName === nodeId || val.mesh?.name === nodeId) {
                    item = val;
                    break;
                }
            }
        }
        if (!item || !item.mesh) return;

        const mesh = item.mesh;
        if (mesh.userData?.originalMaterial) {
            mesh.material = typeof mesh.userData.originalMaterial.clone === 'function'
                ? mesh.userData.originalMaterial.clone()
                : mesh.userData.originalMaterial;
            mesh.userData.__userConfigured = false;
            this.userConfiguredComponents.delete(nodeId);
            this.invalidateRenderingHistory();
        }
    }

    public resetAllMaterials(): void {
        for (const [nodeId, item] of this.componentMap.entries()) {
            if (item.mesh && item.mesh.userData?.originalMaterial) {
                item.mesh.material = typeof item.mesh.userData.originalMaterial.clone === 'function'
                    ? item.mesh.userData.originalMaterial.clone()
                    : item.mesh.userData.originalMaterial;
                item.mesh.userData.__userConfigured = false;
            }
        }
        this.userConfiguredComponents.clear();
        this.invalidateRenderingHistory();
    }

    public getUserMaterialAssignments(): Record<string, any> {
        const result: Record<string, any> = {};
        for (const [id, config] of this.userConfiguredComponents.entries()) {
            result[id] = config;
        }
        return result;
    }

    public applySavedMaterialAssignments(assignments: Record<string, any>): void {
        for (const [nodeId, config] of Object.entries(assignments)) {
            if (!config) continue;
            if (config.type === 'gemstone' && config.preset) {
                this.applyGemstonePresetToComponent(nodeId, config.preset);
            } else if (config.type === 'metal') {
                this.applyMetalPresetToComponent(
                    nodeId,
                    config.colorHex || config.color || '#fed250',
                    config.roughness ?? 0.08,
                    config.metalness ?? 1.0
                );
            }
        }
    }

    public clear(): void {
        this.shankMeshes.length = 0;
        this.headMeshes.length = 0;
        this.prongMeshes.length = 0;
        this.centerStoneMeshes.length = 0;
        this.accentStoneMeshes.length = 0;
        this.unassignedMeshes.length = 0;
        this.componentMap.clear();
        this.meshToNodeIdMap.clear();
        this.baselineMaterials.clear();
        this.userConfiguredComponents.clear();
    }
}

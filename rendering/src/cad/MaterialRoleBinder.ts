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
        dispersion: 0.044,
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

    // Active Colors & Presets
    private currentShankColor: Color = new Color(0xffffff);
    private currentHeadColor: Color = new Color(0xfea04d);
    private currentProngColor: Color = new Color(0xfea04d);
    private currentCenterGemPreset: GemstonePreset = GEMSTONE_PRESETS.diamond;
    private currentAccentGemPreset: GemstonePreset = GEMSTONE_PRESETS.diamond;

    // Active Finish & Optical Parameters
    private currentMetalRoughness = 0.18;
    private currentDiamondBrilliance = 1.35;
    private currentDiamondDispersion = 0.044;

    constructor(viewer: ViewerApp) {
        this.viewer = viewer;
    }

    public bindComponents(modelRoot: any, manifest: ModelManifest): void {
        this.clear();

        for (const comp of manifest.components) {
            let mesh = this.viewer.scene.findObjectsByName(comp.nodeName)[0];
            if (!mesh && comp.nodeId) {
                mesh = this.viewer.scene.findObjectsByName(comp.nodeId)[0];
            }

            if (!mesh && modelRoot && modelRoot.traverse) {
                modelRoot.traverse((child: any) => {
                    if (!mesh && (child.name === comp.nodeName || child.name === comp.nodeId)) {
                        mesh = child;
                    }
                });
            }

            if (mesh) {
                // Clone material to prevent unintentional cross-component sharing
                if (mesh.material && typeof mesh.material.clone === 'function') {
                    mesh.material = mesh.material.clone();
                }

                this.componentMap.set(comp.nodeId, { mesh, comp });
                this.meshToNodeIdMap.set(mesh, comp.nodeId);
                this.assignMeshToRole(mesh, comp.role);
            }
        }

        // Apply initial material settings
        this.applyCurrentColors();
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
        if (!mesh.material || mesh.material.isDiamondMaterial) {
            mesh.material = new MeshStandardMaterial2({
                color: color,
                roughness: this.currentMetalRoughness,
                metalness: 1.0
            });
        } else {
            mesh.material.color = color;
            if (mesh.material.roughness !== undefined) mesh.material.roughness = this.currentMetalRoughness;
            if (mesh.material.metalness !== undefined) mesh.material.metalness = 1.0;
        }
    }

    private applyDiamondMaterial(mesh: any, preset: GemstonePreset, diamondPlugin?: DiamondPlugin): void {
        if (!diamondPlugin) return;

        const gemColor = new Color(preset.color);

        if (mesh.material && mesh.material.isDiamondMaterial) {
            // Update in-place without replacing shader or reallocating
            mesh.material.color = gemColor;
            mesh.material.refractiveIndex = preset.refractiveIndex;
            mesh.material.dispersion = this.currentDiamondDispersion;
            mesh.material.absorptionFactor = preset.absorptionFactor;
            mesh.material.envMapIntensity = this.currentDiamondBrilliance;
        } else if (typeof (diamondPlugin as any).makeDiamond === 'function') {
            try {
                (diamondPlugin as any).prepareDiamondMesh(mesh, { cacheKey: mesh.uuid || mesh.name });
                (diamondPlugin as any).makeDiamond(mesh.material, { cacheKey: mesh.uuid || mesh.name }, {
                    color: gemColor,
                    refractiveIndex: preset.refractiveIndex,
                    dispersion: preset.dispersion,
                    reflectivity: 0.5,
                    rayBounces: 5,
                    absorptionFactor: preset.absorptionFactor,
                    envMapIntensity: preset.envMapIntensity
                });
            } catch (err) {
                console.warn(`[MaterialRoleBinder] Diamond shader binding failed for ${mesh.name}, fallback to refractive standard:`, err);
                if (mesh.material) {
                    mesh.material.color = gemColor;
                    if (mesh.material.roughness !== undefined) mesh.material.roughness = 0.05;
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
            if (m && m.material && !m.material.isDiamondMaterial) m.material.color = this.currentShankColor;
        }
        for (const m of this.headMeshes) {
            if (m && m.material && !m.material.isDiamondMaterial) m.material.color = this.currentHeadColor;
        }
        for (const m of this.prongMeshes) {
            if (m && m.material && !m.material.isDiamondMaterial) m.material.color = this.currentProngColor;
        }
        for (const m of this.unassignedMeshes) {
            if (m && m.material && !m.material.isDiamondMaterial) m.material.color = this.currentShankColor;
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

    // Backwards-compatible helper for simple hex or Color string
    public setGemColor(color: Color): void {
        const hex = '#' + color.getHexString();
        // Match closest preset or generate dynamic diamond preset
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
        this.currentMetalRoughness = Math.max(0.01, Math.min(1.0, roughness));
        const metals = [...this.shankMeshes, ...this.headMeshes, ...this.prongMeshes, ...this.unassignedMeshes];
        for (const m of metals) {
            if (m.material && !m.material.isDiamondMaterial) {
                m.material.roughness = this.currentMetalRoughness;
                if (m.material.metalness !== undefined) m.material.metalness = 1.0;
            }
        }
        this.invalidateRenderingHistory();
    }

    public setMetalFinish(finish: 'satin' | 'standard' | 'high_polish'): void {
        const map = {
            satin: 0.45,
            standard: 0.18,
            high_polish: 0.04
        };
        this.setMetalRoughness(map[finish] ?? 0.18);
    }

    public setDiamondBrilliance(intensity: number): void {
        this.currentDiamondBrilliance = Math.max(0.2, Math.min(3.0, intensity));
        const gems = [...this.centerStoneMeshes, ...this.accentStoneMeshes];
        for (const g of gems) {
            if (g.material) {
                g.material.envMapIntensity = this.currentDiamondBrilliance;
            }
        }
        this.invalidateRenderingHistory();
    }

    public setDiamondDispersion(dispersion: number): void {
        this.currentDiamondDispersion = Math.max(0.0, Math.min(0.1, dispersion));
        const gems = [...this.centerStoneMeshes, ...this.accentStoneMeshes];
        for (const g of gems) {
            if (g.material) {
                g.material.dispersion = this.currentDiamondDispersion;
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
                if (m.material && !m.material.isDiamondMaterial) m.material.color = color;
            }
        }
        if (role === 'all_metals' || role === 'metal_head') {
            this.currentHeadColor = color;
            for (const m of this.headMeshes) {
                if (m.material && !m.material.isDiamondMaterial) m.material.color = color;
            }
        }
        if (role === 'all_metals' || role === 'metal_prongs') {
            this.currentProngColor = color;
            for (const m of this.prongMeshes) {
                if (m.material && !m.material.isDiamondMaterial) m.material.color = color;
            }
        }
        for (const m of this.unassignedMeshes) {
            if (m.material && !m.material.isDiamondMaterial) m.material.color = this.currentShankColor;
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
            if (m.material && !m.material.isDiamondMaterial) {
                m.material.roughness = this.currentMetalRoughness;
                if (m.material.metalness !== undefined) m.material.metalness = metalness;
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
            if (m.material) {
                if (params.color) m.material.color = new Color(params.color);
                if (params.refractiveIndex !== undefined) {
                    m.material.refractiveIndex = params.refractiveIndex;
                    if (m.material.ior !== undefined) m.material.ior = params.refractiveIndex;
                }
                if (params.dispersion !== undefined) m.material.dispersion = params.dispersion;
                if (params.absorptionFactor !== undefined) m.material.absorptionFactor = params.absorptionFactor;
                if (params.envMapIntensity !== undefined) m.material.envMapIntensity = params.envMapIntensity;
            }
        }
        this.invalidateRenderingHistory();
    }

    public applyGemstonePresetToComponent(nodeId: string, preset: GemstonePreset): void {
        let item = this.componentMap.get(nodeId);
        if (!item) {
            for (const [id, val] of this.componentMap.entries()) {
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
        if (mesh.material && typeof mesh.material.clone === 'function' && !mesh.material.__uniqueInstance) {
            mesh.material = mesh.material.clone();
            mesh.material.__uniqueInstance = true;
        }

        this.applyDiamondMaterial(mesh, preset, diamondPlugin);
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
            for (const [id, val] of this.componentMap.entries()) {
                if (val.comp.nodeName === nodeId || val.mesh?.name === nodeId) {
                    item = val;
                    break;
                }
            }
        }
        if (!item || !item.mesh) return;

        const mesh = item.mesh;
        if (mesh.material && typeof mesh.material.clone === 'function' && !mesh.material.__uniqueInstance) {
            mesh.material = mesh.material.clone();
            mesh.material.__uniqueInstance = true;
        }

        if (params.color) mesh.material.color = new Color(params.color);
        if (params.refractiveIndex !== undefined) {
            mesh.material.refractiveIndex = params.refractiveIndex;
            if (mesh.material.ior !== undefined) mesh.material.ior = params.refractiveIndex;
        }
        if (params.dispersion !== undefined) mesh.material.dispersion = params.dispersion;
        if (params.absorptionFactor !== undefined) mesh.material.absorptionFactor = params.absorptionFactor;
        if (params.envMapIntensity !== undefined) mesh.material.envMapIntensity = params.envMapIntensity;

        this.invalidateRenderingHistory();
    }

    public applyMetalPresetToComponent(nodeId: string, colorHex: string, roughness: number, metalness = 1.0): void {
        let item = this.componentMap.get(nodeId);
        if (!item) {
            for (const [id, val] of this.componentMap.entries()) {
                if (val.comp.nodeName === nodeId || val.mesh?.name === nodeId) {
                    item = val;
                    break;
                }
            }
        }
        if (!item || !item.mesh) return;

        const mesh = item.mesh;
        if (mesh.material && typeof mesh.material.clone === 'function' && !mesh.material.__uniqueInstance) {
            mesh.material = mesh.material.clone();
            mesh.material.__uniqueInstance = true;
        }

        this.applyMetalMaterial(mesh, new Color(colorHex));
        if (mesh.material) {
            mesh.material.roughness = roughness;
            mesh.material.metalness = metalness;
        }
        this.invalidateRenderingHistory();
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
    }
}

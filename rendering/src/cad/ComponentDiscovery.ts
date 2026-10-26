/**
 * ComponentDiscovery.ts
 * Automatically discovers, classifies, and groups jewelry components in imported GLB
 * scenes using manifests, layer attributes, normalized naming heuristics, and geometry stats.
 */

import { ModelManifest, ManifestComponent, ComponentRole } from "./ModelManifest";

export interface DiscoveredComponentGroup {
    role: ComponentRole;
    groupLabel: string;
    components: ManifestComponent[];
}

export class ComponentDiscovery {
    /**
     * Resolves or generates a complete ModelManifest for any scene root.
     * Combines explicit manifest entries, node names, and geometry heuristics.
     */
    public static discoverComponents(modelRoot: any, existingManifest?: ModelManifest | null): ModelManifest {
        const manifestComponents: Map<string, ManifestComponent> = new Map();

        // 1. Ingest existing manifest components if provided
        if (existingManifest && existingManifest.components) {
            for (const comp of existingManifest.components) {
                manifestComponents.set(comp.nodeId || comp.nodeName, { ...comp });
            }
        }

        // 2. Traverse scene hierarchy to find all mesh nodes
        let meshIndex = 0;
        if (modelRoot && modelRoot.traverse) {
            modelRoot.traverse((child: any) => {
                if (child.isMesh) {
                    const nodeName = child.name || `Mesh_${meshIndex}`;
                    const nodeId = child.uuid || `node_${meshIndex}_${nodeName}`;

                    // Check if already declared in manifest
                    const existing = Array.from(manifestComponents.values()).find(
                        c => c.nodeName === nodeName || c.nodeId === nodeId
                    );

                    if (!existing) {
                        // Classify component using heuristics
                        const classification = this.classifyMesh(child, meshIndex);
                        manifestComponents.set(nodeId, {
                            nodeId,
                            nodeName,
                            sourceLayer: (child.userData && child.userData.layer) ? child.userData.layer : 'Default',
                            role: classification.role,
                            roleConfidence: classification.confidence,
                            geometryStats: {
                                triangleCount: child.geometry?.index ? child.geometry.index.count / 3 : (child.geometry?.attributes?.position?.count || 0) / 3,
                                vertexCount: child.geometry?.attributes?.position?.count || 0,
                                isWatertight: false,
                                facetNormalsPreserved: classification.role.includes('diamond') || classification.role.includes('stone')
                            }
                        });
                    }
                    meshIndex++;
                }
            });
        }

        const components = Array.from(manifestComponents.values());

        return {
            schemaVersion: existingManifest?.schemaVersion || '1.0.0',
            modelId: existingManifest?.modelId || 'discovered-model',
            originalFileName: existingManifest?.originalFileName || 'model.glb',
            timestamp: existingManifest?.timestamp || new Date().toISOString(),
            units: existingManifest?.units || 'mm',
            boundingDimensions: existingManifest?.boundingDimensions || {
                width: 2.5,
                height: 2.5,
                depth: 1.5,
                boundingRadius: 1.35
            },
            components,
            warnings: existingManifest?.warnings || []
        };
    }

    /**
     * Normalized keyword and geometry classification.
     */
    public static classifyMesh(mesh: any, index: number): { role: ComponentRole; confidence: number } {
        const name = (mesh.name || '').toLowerCase().replace(/[-_]/g, ' ');
        const layer = (mesh.userData?.layer || '').toLowerCase();
        const matName = (mesh.material?.name || '').toLowerCase();
        const combined = `${name} ${layer} ${matName}`;

        const triangleCount = mesh.geometry?.index
            ? mesh.geometry.index.count / 3
            : (mesh.geometry?.attributes?.position?.count || 0) / 3;

        // 1. Accent Gemstones (Pavé / Melee / Halo / numbered gems)
        if (
            combined.includes('accent') ||
            combined.includes('pave') ||
            combined.includes('halo') ||
            combined.includes('melee') ||
            combined.includes('side stone') ||
            combined.includes('diamonds00') ||
            combined.includes('gem0') ||
            /\bdiamonds?\d{2,}\b/.test(combined)
        ) {
            return { role: 'accent_stone', confidence: 0.95 };
        }

        // 2. Center Gemstones
        if (
            combined.includes('center stone') ||
            combined.includes('center diamond') ||
            combined.includes('solitaire') ||
            combined.includes('main stone') ||
            combined.includes('ruby') ||
            combined.includes('emerald') ||
            combined.includes('sapphire')
        ) {
            return { role: 'diamond', confidence: 0.95 };
        }

        // General Diamond / Gemstone keywords
        if (
            combined.includes('diamond') ||
            combined.includes('gem') ||
            combined.includes('brilliant') ||
            combined.includes('cushion')
        ) {
            // Distinguish center vs accent by triangle count or index if multiple
            if (index > 0 && triangleCount < 500) {
                return { role: 'accent_stone', confidence: 0.85 };
            }
            return { role: 'diamond', confidence: 0.9 };
        }

        // 3. Prongs & Claws
        if (combined.includes('prong') || combined.includes('claw')) {
            return { role: 'metal_prongs', confidence: 0.9 };
        }

        // 4. Ring Head / Basket / Setting
        if (
            combined.includes('head') ||
            combined.includes('collet') ||
            combined.includes('basket') ||
            combined.includes('bezel') ||
            combined.includes('entourage') ||
            combined.includes('setting')
        ) {
            return { role: 'metal_head', confidence: 0.85 };
        }

        // 5. Shank / Band
        if (
            combined.includes('shank') ||
            combined.includes('band') ||
            combined.includes('ring') ||
            combined.includes('alliance') ||
            combined.includes('rail') ||
            combined.includes('silver') ||
            combined.includes('gold') ||
            combined.includes('metal')
        ) {
            return { role: 'metal_shank', confidence: 0.9 };
        }

        // 6. Geometry heuristics: Small faceted geometry is likely gemstone
        if (triangleCount > 0 && triangleCount <= 128) {
            return { role: 'accent_stone', confidence: 0.7 };
        }

        // Fallback for default or unrecognized objects
        if (combined.includes('default') || combined.includes('unknown') || combined.trim() === '') {
            return { role: 'unassigned', confidence: 0.2 };
        }

        // Default structural metal
        return { role: 'metal_shank', confidence: 0.65 };
    }

    /**
     * Groups components into semantic categories for UI display and bulk operations.
     */
    public static groupComponents(components: ManifestComponent[]): DiscoveredComponentGroup[] {
        const groups: Record<ComponentRole, ManifestComponent[]> = {
            diamond: [],
            accent_stone: [],
            colored_gemstone: [],
            metal_shank: [],
            metal_head: [],
            metal_prongs: [],
            unassigned: []
        };

        for (const comp of components) {
            if (groups[comp.role]) {
                groups[comp.role].push(comp);
            } else {
                groups.unassigned.push(comp);
            }
        }

        return [
            { role: 'diamond', groupLabel: 'Center Gemstones', components: [...groups.diamond, ...groups.colored_gemstone] },
            { role: 'accent_stone', groupLabel: 'Accent & Pavé Diamonds', components: groups.accent_stone },
            { role: 'metal_shank', groupLabel: 'Ring Shank & Bands', components: groups.metal_shank },
            { role: 'metal_head', groupLabel: 'Heads & Settings', components: groups.metal_head },
            { role: 'metal_prongs', groupLabel: 'Prongs & Claws', components: groups.metal_prongs },
            { role: 'unassigned', groupLabel: 'Unassigned Components', components: groups.unassigned }
        ];
    }
}

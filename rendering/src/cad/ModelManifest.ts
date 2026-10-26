/**
 * ModelManifest.ts
 * Type definitions for versioned model manifests.
 */

export type ComponentRole =
    | 'metal_shank'
    | 'metal_head'
    | 'metal_prongs'
    | 'diamond'
    | 'colored_gemstone'
    | 'accent_stone'
    | 'unassigned';

export interface GeometryStats {
    triangleCount: number;
    vertexCount: number;
    isWatertight: boolean;
    facetNormalsPreserved: boolean;
}

export interface ManifestComponent {
    nodeId: string;
    nodeName: string;
    sourceLayer: string;
    role: ComponentRole;
    roleConfidence: number;
    defaultMaterialPreset?: string;
    geometryStats?: GeometryStats;
}

export interface ModelBoundingDimensions {
    width: number;
    height: number;
    depth: number;
    boundingRadius: number;
}

export interface ModelManifest {
    schemaVersion: string;
    modelId: string;
    originalFileName: string;
    timestamp: string;
    units: string;
    boundingDimensions: ModelBoundingDimensions;
    components: ManifestComponent[];
    warnings?: string[];
}

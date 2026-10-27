/**
 * StudioState.ts
 * Typed domain state definitions for Mahesh 3D studio.
 */

import { ModelManifest, ManifestComponent, ComponentRole } from "../cad/ModelManifest";

export interface MetalConfig {
    presetId: string;
    name: string;
    color: string;
    roughness: number;
    metalness: number;
}

export interface GemstoneConfig {
    presetId: string;
    name: string;
    color: string;
    refractiveIndex: number;
    dispersion: number;
    absorptionFactor: number;
    envMapIntensity: number;
    targetRole?: 'all_gemstones' | 'diamond' | 'accent_stone' | 'selected';
}

export interface StudioEnvConfig {
    presetId: string;
    backgroundColor: string;
    groundVisible: boolean;
    groundShadows: boolean;
    groundReflections: boolean;
    envIntensity: number;
    envRotationDeg: number;
}

export interface ModelItem {
    id: string;
    originalFileName: string;
    sourceFormat: '3dm' | 'glb';
    status: string;
    sourceUnits?: string;
    createdAt?: string;
}

export interface StudioState {
    activeModelId: string;
    manifest: ModelManifest | null;
    models: ModelItem[];
    activeLeftTab: 'models' | 'metals' | 'gemstones' | 'studio';
    isLeftOpen: boolean;
    isRightOpen: boolean;
    selectedNodeId: string | null;
    autoRotate: boolean;
    isLoading: boolean;
    loadingProgress: number;
    loadingMessage: string;
    metalConfig: MetalConfig;
    gemConfig: GemstoneConfig;
    studioConfig: StudioEnvConfig;
}

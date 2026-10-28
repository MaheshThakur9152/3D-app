/**
 * App.tsx
 * Mahesh 3D - High-performance 3D Jewelry Studio Workspace.
 * 3-Column Layout: Left Library, Central Viewport, Right Inspector.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ViewerHost } from '../studio/ViewerHost';
import { Header } from './Header';
import { ModelLibraryPanel } from '../models/ModelLibraryPanel';
import { MaterialPanel } from '../materials/MaterialPanel';
import { StudioPanel } from '../studio/StudioPanel';
import { InspectorPanel, SelectedComponentDetail } from '../inspector/InspectorPanel';
import { ModelManifest, ComponentRole } from '../cad/ModelManifest';
import { ModelItem } from '../state/StudioState';
import { GemstonePreset } from '../cad/MaterialRoleBinder';

const BUILTIN_MANIFEST_RING1: ModelManifest = {
    schemaVersion: '1.0.0',
    modelId: 'builtin-ring-1',
    originalFileName: 'ring_webgi.glb',
    timestamp: new Date().toISOString(),
    units: 'mm',
    boundingDimensions: { width: 2.47, height: 2.64, depth: 1.02, boundingRadius: 1.4 },
    components: [
        { nodeId: 'silver', nodeName: 'silver', sourceLayer: 'Shank', role: 'metal_shank', roleConfidence: 1.0 },
        { nodeId: 'gold', nodeName: 'gold', sourceLayer: 'Head', role: 'metal_head', roleConfidence: 1.0 },
        { nodeId: 'diamonds', nodeName: 'diamonds', sourceLayer: 'Gems', role: 'diamond', roleConfidence: 1.0 },
        { nodeId: 'diamonds001', nodeName: 'diamonds001', sourceLayer: 'Gems', role: 'accent_stone', roleConfidence: 1.0 },
        { nodeId: 'diamonds002', nodeName: 'diamonds002', sourceLayer: 'Gems', role: 'accent_stone', roleConfidence: 1.0 },
        { nodeId: 'diamonds003', nodeName: 'diamonds003', sourceLayer: 'Gems', role: 'accent_stone', roleConfidence: 1.0 },
        { nodeId: 'diamonds004', nodeName: 'diamonds004', sourceLayer: 'Gems', role: 'accent_stone', roleConfidence: 1.0 },
        { nodeId: 'diamonds005', nodeName: 'diamonds005', sourceLayer: 'Gems', role: 'accent_stone', roleConfidence: 1.0 },
    ]
};

const BUILTIN_MANIFEST_RING2: ModelManifest = {
    schemaVersion: '1.0.0',
    modelId: 'builtin-ring-2',
    originalFileName: 'ring2_webgi.glb',
    timestamp: new Date().toISOString(),
    units: 'mm',
    boundingDimensions: { width: 2.50, height: 2.70, depth: 1.10, boundingRadius: 1.45 },
    components: [
        { nodeId: 'alliance', nodeName: 'alliance', sourceLayer: 'Alliance', role: 'metal_shank', roleConfidence: 1.0 },
        { nodeId: 'entourage', nodeName: 'entourage', sourceLayer: 'Entourage', role: 'metal_head', roleConfidence: 1.0 },
        { nodeId: 'Object', nodeName: 'Object', sourceLayer: 'Diamonds', role: 'diamond', roleConfidence: 1.0 }
    ]
};

export const App: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [viewerReady, setViewerReady] = useState(false);
    const [activeModelId, setActiveModelId] = useState('builtin-ring-1');
    const [modelName, setModelName] = useState('Solitaire Diamond Ring');
    const [manifest, setManifest] = useState<ModelManifest | null>(BUILTIN_MANIFEST_RING1);
    const [modelsList, setModelsList] = useState<ModelItem[]>([]);

    // Navigation and Panels
    const [activeTab, setActiveTab] = useState<'models' | 'metals' | 'gemstones' | 'studio'>('metals');
    const [isLeftOpen, setIsLeftOpen] = useState(true);
    const [isInspectorOpen, setIsInspectorOpen] = useState(true);

    // Controls
    const [autoRotate, setAutoRotate] = useState(false);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedDetail, setSelectedDetail] = useState<SelectedComponentDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMsg, setLoadingMsg] = useState('Initializing Studio...');
    const [isSaving, setIsSaving] = useState(false);

    // Studio Settings
    const [studioPreset, setStudioPreset] = useState('white');
    const [groundShadows, setGroundShadows] = useState(true);
    const [groundReflections, setGroundReflections] = useState(true);
    const [envIntensity, setEnvIntensity] = useState(1.0);

    // Initialize ViewerApp ONCE outside React render cycle
    useEffect(() => {
        if (!canvasRef.current) return;
        const host = ViewerHost.getInstance();

        host.init(canvasRef.current).then(() => {
            setViewerReady(true);
            setLoadingMsg('Loading Initial Ring...');

            host.onSelectionChange((nodeId, detail) => {
                setSelectedNodeId(nodeId);
                setSelectedDetail(detail);
            });

            return host.loadModel('./assets/ring_webgi.glb', BUILTIN_MANIFEST_RING1);
        }).then(() => {
            setManifest(BUILTIN_MANIFEST_RING1);
            setIsLoading(false);
        }).catch((err) => {
            console.error('Viewer initialization error:', err);
            setIsLoading(false);
        });

        // Fetch models from API
        fetch('/api/v1/models')
            .then(r => r.json())
            .then(data => {
                if (data.models) setModelsList(data.models);
            })
            .catch(() => {});
    }, []);

    // Handle Model Selection
    const handleSelectModel = async (modelId: string, glbUrl: string) => {
        setIsLoading(true);
        setLoadingMsg('Switching 3D Ring Model...');
        setActiveModelId(modelId);

        let targetManifest: ModelManifest | null = null;
        if (modelId === 'builtin-ring-1') {
            targetManifest = BUILTIN_MANIFEST_RING1;
            setModelName('Solitaire Diamond Ring');
        } else if (modelId === 'builtin-ring-2') {
            targetManifest = BUILTIN_MANIFEST_RING2;
            setModelName('Alliance Halo Ring');
        } else {
            // Fetch manifest from API
            try {
                const res = await fetch(`/api/v1/models/${modelId}/manifest`);
                if (res.ok) {
                    targetManifest = await res.json();
                    setModelName(targetManifest?.originalFileName || 'Custom Jewelry Model');
                }
            } catch {}
        }

        const host = ViewerHost.getInstance();
try {
const root = await host.loadModel(glbUrl, targetManifest);
if (root) {
setManifest(targetManifest);
setSelectedNodeId(null);
setSelectedDetail(null);
}
} catch (err) {
console.error("[App] Model switch failed:", err);
} finally {
setIsLoading(false);
}
    };

    // Auto Rotate
    const handleToggleAutoRotate = () => {
        const next = !autoRotate;
        setAutoRotate(next);
        ViewerHost.getInstance().setAutoRotate(next);
    };

    // Fit & Reset
    const handleFitView = () => ViewerHost.getInstance().fitView(true);
    const handleResetView = () => ViewerHost.getInstance().resetView();

    // Material controls
    const handleApplyMetal = (color: string, roughness: number, metalness: number, role: string) => {
        ViewerHost.getInstance().setMetalPreset(color, roughness, metalness, role);
    };

    const handleApplyGemstonePreset = (preset: GemstonePreset, role: string) => {
        ViewerHost.getInstance().setGemstonePreset(preset, role);
    };

    const handleApplyCustomGemstone = (params: any, role: string) => {
        ViewerHost.getInstance().setCustomGemstoneParams(params, role);
    };

    // Inspector controls
    const handleSelectNode = (nodeId: string | null) => {
        setSelectedNodeId(nodeId);
        if (!nodeId) setSelectedDetail(null);
        ViewerHost.getInstance().selectComponent(nodeId);
    };

    const handleSelectParent = (nodeId: string) => {
        ViewerHost.getInstance().selectParent(nodeId);
    };

    const handleApplyGemstoneToSelected = (preset: GemstonePreset) => {
        if (selectedNodeId) {
            ViewerHost.getInstance().applyGemstonePresetToComponent(selectedNodeId, preset);
        }
    };

    const handleApplyMetalToSelected = (colorHex: string, roughness: number) => {
        if (selectedNodeId) {
            ViewerHost.getInstance().applyMetalPresetToComponent(selectedNodeId, colorHex, roughness);
        }
    };

    const handleToggleVisibility = (nodeId: string) => {
        ViewerHost.getInstance().toggleComponentVisibility(nodeId);
    };

    const handleFocusNode = (nodeId: string) => {
        ViewerHost.getInstance().focusComponent(nodeId);
    };

    const handleUpdateRole = (nodeId: string, role: ComponentRole) => {
        ViewerHost.getInstance().setComponentRole(nodeId, role);
        if (manifest) {
            const comp = manifest.components.find(c => c.nodeId === nodeId || c.nodeName === nodeId);
            if (comp) comp.role = role;
            setManifest({ ...manifest });
        }
    };

    // Studio controls
    const handleSelectStudioPreset = (presetId: string) => {
        setStudioPreset(presetId);
        ViewerHost.getInstance().setStudioPreset(presetId);
    };

    const handleToggleGroundShadows = (enabled: boolean) => {
        setGroundShadows(enabled);
        ViewerHost.getInstance().setGroundShadows(enabled);
    };

    const handleToggleGroundReflections = (enabled: boolean) => {
        setGroundReflections(enabled);
        ViewerHost.getInstance().setGroundReflections(enabled);
    };

    const handleChangeEnvIntensity = (val: number) => {
        setEnvIntensity(val);
        ViewerHost.getInstance().setEnvironmentIntensity(val);
    };

    // Save Configuration
    const handleSaveConfig = async () => {
        setIsSaving(true);
        try {
            await fetch(`/api/v1/models/${activeModelId}/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: `${modelName} Configuration`,
                    materialAssignments: {},
                    studioPreferences: { studioPreset, groundShadows, groundReflections, envIntensity }
                })
            });
            alert('Studio configuration saved successfully!');
        } catch (e: any) {
            alert('Failed to save configuration: ' + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="mahesh3d-app">
            <Header
                modelName={modelName}
                autoRotate={autoRotate}
                onToggleAutoRotate={handleToggleAutoRotate}
                onFitView={handleFitView}
                onResetView={handleResetView}
                onOpenUpload={() => {
                    setActiveTab('models');
                    setIsLeftOpen(true);
                }}
                onSaveConfig={handleSaveConfig}
                isSaving={isSaving}
            />

            <div className="studio-workspace">
                {/* Left Navigation and Library Drawer */}
                <div className={`left-dock ${isLeftOpen ? 'open' : 'collapsed'}`}>
                    <div className="dock-tabs">
                        <button
                            className={`dock-tab-btn ${activeTab === 'models' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('models'); setIsLeftOpen(true); }}
                            title="3D Models & Upload"
                        >
                            <span className="tab-icon">💍</span>
                            <span className="tab-title">Models</span>
                        </button>
                        <button
                            className={`dock-tab-btn ${activeTab === 'metals' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('metals'); setIsLeftOpen(true); }}
                            title="Metal Finishes"
                        >
                            <span className="tab-icon">🪙</span>
                            <span className="tab-title">Metals</span>
                        </button>
                        <button
                            className={`dock-tab-btn ${activeTab === 'gemstones' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('gemstones'); setIsLeftOpen(true); }}
                            title="Gemstone Presets & Optics"
                        >
                            <span className="tab-icon">💎</span>
                            <span className="tab-title">Gems</span>
                        </button>
                        <button
                            className={`dock-tab-btn ${activeTab === 'studio' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('studio'); setIsLeftOpen(true); }}
                            title="Studio & Lighting"
                        >
                            <span className="tab-icon">💡</span>
                            <span className="tab-title">Studio</span>
                        </button>
                    </div>

                    {isLeftOpen && (
                        <div className="dock-content">
                            <div className="dock-content-header">
                                <span className="dock-heading">
                                    {activeTab === 'models' && 'Model Library'}
                                    {activeTab === 'metals' && 'Metal Customizer'}
                                    {activeTab === 'gemstones' && 'Gemstone Optical Studio'}
                                    {activeTab === 'studio' && 'Studio & Lighting'}
                                </span>
                                <button className="btn-collapse" onClick={() => setIsLeftOpen(false)}>&times;</button>
                            </div>

                            <div className="dock-scroll-area">
                                {activeTab === 'models' && (
                                    <ModelLibraryPanel
                                        activeModelId={activeModelId}
                                        models={modelsList}
                                        onSelectModel={handleSelectModel}
                                        onUploadSuccess={(id, url) => {
                                            handleSelectModel(id, url);
                                            fetch('/api/v1/models').then(r => r.json()).then(d => {
                                                if (d.models) setModelsList(d.models);
                                            }).catch(() => {});
                                        }}
                                    />
                                )}

                                {activeTab === 'metals' && (
                                    <MaterialPanel
                                        mode="metals"
                                        onApplyMetal={handleApplyMetal}
                                        onApplyGemstonePreset={handleApplyGemstonePreset}
                                        onApplyCustomGemstone={handleApplyCustomGemstone}
                                    />
                                )}

                                {activeTab === 'gemstones' && (
                                    <MaterialPanel
                                        mode="gemstones"
                                        onApplyMetal={handleApplyMetal}
                                        onApplyGemstonePreset={handleApplyGemstonePreset}
                                        onApplyCustomGemstone={handleApplyCustomGemstone}
                                    />
                                )}

                                {activeTab === 'studio' && (
                                    <StudioPanel
                                        currentPresetId={studioPreset}
                                        groundVisible={true}
                                        groundShadows={groundShadows}
                                        groundReflections={groundReflections}
                                        envIntensity={envIntensity}
                                        onSelectPreset={handleSelectStudioPreset}
                                        onToggleGroundShadows={handleToggleGroundShadows}
                                        onToggleGroundReflections={handleToggleGroundReflections}
                                        onChangeEnvIntensity={handleChangeEnvIntensity}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Central 3D Studio Viewport */}
                <main className="viewport-container" id="webgi-canvas-container">
                    <canvas id="webgi-canvas" ref={canvasRef} />

                    {/* Viewport Floating Overlays */}
                    <div className="viewport-overlay-controls">
                        <button className="btn-viewport-action" onClick={handleFitView} title="Fit View">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                            </svg>
                            <span>Fit View</span>
                        </button>
                        <button className="btn-viewport-action" onClick={handleResetView} title="Reset View">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                                <path d="M3 3v5h5"/>
                            </svg>
                            <span>Reset View</span>
                        </button>
                        {!isInspectorOpen && (
                            <button className="btn-viewport-action" onClick={() => setIsInspectorOpen(true)} title="Open Inspector">
                                <span>Hierarchy</span>
                            </button>
                        )}
                    </div>

                    {isLoading && (
                        <div className="viewport-loader">
                            <div className="spinner" />
                            <span className="loader-text">{loadingMsg}</span>
                        </div>
                    )}
                </main>

                {/* Right Hierarchy & Component Inspector */}
                {isInspectorOpen && (
                    <InspectorPanel
                        manifest={manifest}
                        selectedNodeId={selectedNodeId}
                        selectedDetail={selectedDetail}
                        onSelectNode={handleSelectNode}
                        onSelectParent={handleSelectParent}
                        onToggleVisibility={handleToggleVisibility}
                        onFocusNode={handleFocusNode}
                        onUpdateRole={handleUpdateRole}
                        onApplyGemstoneToSelected={handleApplyGemstoneToSelected}
                        onApplyMetalToSelected={handleApplyMetalToSelected}
                        onClose={() => setIsInspectorOpen(false)}
                    />
                )}
            </div>
        </div>
    );
};

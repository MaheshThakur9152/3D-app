/**
 * PlaygroundLayout.tsx
 * Complete iJewel3D-inspired Jewelry Playground Architecture.
 * Integrates Top Header, Left Nav Rail, Left Asset Browser, Central 3D Studio Viewport
 * with Finite Square Platform & Contact Shadows, Bottom Gemstone Bar, Right Inspector, and Quick Rail.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ViewerHost } from '../studio/ViewerHost';
import { ModelManifest, ComponentRole } from '../cad/ModelManifest';
import { ModelItem } from '../state/StudioState';
import { GemstonePreset, GEMSTONE_PRESETS } from '../cad/MaterialRoleBinder';
import { SelectedComponentDetail } from '../inspector/InspectorPanel';

import { PlaygroundHeader } from './PlaygroundHeader';
import { LeftNavRail, PlaygroundNavCategory } from './LeftNavRail';
import { AssetBrowser } from './AssetBrowser';
import { ViewportToolbar } from './ViewportToolbar';
import { GemVariantSelector } from './GemVariantSelector';
import { RightInspector } from './RightInspector';
import { QuickToolRail } from './QuickToolRail';

import './playground.scss';

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
        { nodeId: 'diamonds005', nodeName: 'diamonds005', sourceLayer: 'Gems', role: 'accent_stone', roleConfidence: 1.0 }
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

export const PlaygroundLayout: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Engine & Model State
    const [viewerReady, setViewerReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMsg, setLoadingMsg] = useState('Initializing 3D Studio...');
    const [activeModelId, setActiveModelId] = useState('builtin-ring-1');
    const [modelName, setModelName] = useState('Solitaire Diamond Ring');
    const [manifest, setManifest] = useState<ModelManifest | null>(BUILTIN_MANIFEST_RING1);
    const [modelsList, setModelsList] = useState<ModelItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Navigation & Panels
    const [activeNavCategory, setActiveNavCategory] = useState<PlaygroundNavCategory>('hdr');
    const [isBrowserOpen, setIsBrowserOpen] = useState(true);
    const [isInspectorOpen, setIsInspectorOpen] = useState(true);

    // Selected Component / Picking
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedDetail, setSelectedDetail] = useState<SelectedComponentDetail | null>(null);
    const [selectedGemId, setSelectedGemId] = useState('diamond');
    const [activeMetalName, setActiveMetalName] = useState('18K White Gold');

    // Studio Environment & Lighting
    const [activePresetId, setActivePresetId] = useState('white');
    const [activeGemEnvId, setActiveGemEnvId] = useState('diamond_brilliance');
    const [activeBgHex, setActiveBgHex] = useState('#ffffff');
    const [envIntensity, setEnvIntensity] = useState(1.0);

    // Studio 3D Floor & Contact Shadows
    const [floorVisible, setFloorVisible] = useState(true);
    const [floorRoughness, setFloorRoughness] = useState(0.88);
    const [contactShadows, setContactShadows] = useState(true);
    const [shadowIntensity, setShadowIntensity] = useState(0.75);
    const [shadowSoftness, setShadowSoftness] = useState(2.2);

    // Drop Options
    const [autoCenter, setAutoCenter] = useState(true);
    const [autoScale, setAutoScale] = useState(true);
    const [autoScaleRadius, setAutoScaleRadius] = useState(1.35);

    // Camera & Renderer Controls
    const [autoRotate, setAutoRotate] = useState(false);
    const [autoRotateSpeed, setAutoRotateSpeed] = useState(1.0);
    const [cameraFov, setCameraFov] = useState(45);
    const [displayScale, setDisplayScale] = useState(1.0);
    const [bloomEnabled, setBloomEnabled] = useState(true);
    const [ssrEnabled, setSSREnabled] = useState(true);
    const [ssaoEnabled, setSSAOEnabled] = useState(true);

    // Initialize WebGi Viewer Host ONCE outside React render cycle
    useEffect(() => {
        if (!canvasRef.current) return;
        const host = ViewerHost.getInstance();

        host.init(canvasRef.current).then(() => {
            setViewerReady(true);
            setLoadingMsg('Loading Jewelry Studio Model...');

            // Connect 3D canvas picking to UI
            host.onSelectionChange((nodeId, detail) => {
                setSelectedNodeId(nodeId);
                setSelectedDetail(detail);
            });

            return host.loadModel('./assets/ring_webgi.glb', BUILTIN_MANIFEST_RING1);
        }).then(() => {
            setManifest(BUILTIN_MANIFEST_RING1);
            setIsLoading(false);
        }).catch((err) => {
            console.error('[Playground] Viewer initialization error:', err);
            setIsLoading(false);
        });

        // Fetch user models from API if server is online
        fetch('/api/v1/models')
            .then(r => r.json())
            .then(data => {
                if (data.models) setModelsList(data.models);
            })
            .catch(() => {});
    }, []);

    // Switch Model Handler
    const handleSelectModel = useCallback(async (modelId: string, glbUrl: string) => {
        setIsLoading(true);
        setLoadingMsg('Loading Model...');
        setActiveModelId(modelId);

        let targetManifest: ModelManifest | null = null;
        if (modelId === 'builtin-ring-1') {
            targetManifest = BUILTIN_MANIFEST_RING1;
            setModelName('Solitaire Diamond Ring');
        } else if (modelId === 'builtin-ring-2') {
            targetManifest = BUILTIN_MANIFEST_RING2;
            setModelName('Alliance Halo Ring');
        } else {
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
            console.error('[Playground] Model switch failed:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // File Import Handler (Supports .glb, .gltf, and server-converted .3dm)
    const handleUploadFile = useCallback(async (file: File) => {
        setIsUploading(true);
        setIsLoading(true);
        setLoadingMsg(`Importing ${file.name}...`);

        const isGlb = file.name.endsWith('.glb') || file.name.endsWith('.gltf');
        const is3dm = file.name.endsWith('.3dm');

        if (isGlb) {
            const blobUrl = URL.createObjectURL(file);
            setModelName(file.name.replace(/\.[^/.]+$/, ''));
            const host = ViewerHost.getInstance();
            try {
                const root = await host.loadModel(blobUrl, null);
                if (root) {
                    const discovered = host.dynamicLoader?.getCurrentManifest() || null;
                    setManifest(discovered);
                    setSelectedNodeId(null);
                    setSelectedDetail(null);
                }
            } catch (err) {
                console.error('[Playground] GLB load error:', err);
            } finally {
                setIsLoading(false);
                setIsUploading(false);
            }
        } else if (is3dm) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                const uploadRes = await fetch('/api/v1/models/upload', {
                    method: 'POST',
                    body: formData
                });
                if (!uploadRes.ok) throw new Error('Upload failed');
                const { jobId } = await uploadRes.json();

                // Poll job
                let completed = false;
                let attempts = 0;
                while (!completed && attempts < 30) {
                    await new Promise(r => setTimeout(r, 1000));
                    attempts++;
                    const jobRes = await fetch(`/api/v1/models/status/${jobId}`);
                    if (jobRes.ok) {
                        const statusData = await jobRes.json();
                        if (statusData.status === 'completed') {
                            completed = true;
                            await handleSelectModel(jobId, `/api/v1/models/${jobId}/asset`);
                            break;
                        } else if (statusData.status === 'failed') {
                            throw new Error(statusData.error || 'Conversion failed');
                        }
                    }
                }
            } catch (err: any) {
                alert(`Error converting 3DM model: ${err.message || 'Server error'}`);
            } finally {
                setIsLoading(false);
                setIsUploading(false);
            }
        } else {
            alert('Unsupported file format. Please upload .glb, .gltf, or Rhino .3dm files.');
            setIsLoading(false);
            setIsUploading(false);
        }
    }, [handleSelectModel]);

    // Camera Actions
    const handleFitView = useCallback(() => {
        ViewerHost.getInstance().fitView(true);
    }, []);

    const handleResetView = useCallback(() => {
        ViewerHost.getInstance().resetView();
    }, []);

    const handleToggleAutoRotate = useCallback(() => {
        const next = !autoRotate;
        setAutoRotate(next);
        ViewerHost.getInstance().setAutoRotate(next);
    }, [autoRotate]);

    const handleChangeAutoRotateSpeed = useCallback((speed: number) => {
        setAutoRotateSpeed(speed);
        ViewerHost.getInstance().setAutoRotateSpeed(speed);
    }, []);

    const handleChangeCameraFov = useCallback((fov: number) => {
        setCameraFov(fov);
        ViewerHost.getInstance().setCameraFov(fov);
    }, []);

    const handleSnapshot = useCallback(() => {
        ViewerHost.getInstance().takeSnapshot(`${modelName.replace(/\s+/g, '_')}_studio.png`);
    }, [modelName]);

    // Environment & Studio Controls
    const handleSelectPreset = useCallback((id: string) => {
        setActivePresetId(id);
        ViewerHost.getInstance().setStudioPreset(id);
    }, []);

    const handleSelectGemEnv = useCallback((id: string) => {
        setActiveGemEnvId(id);
        // Optical dispersion/intensity tuning according to gem lighting preset
        const host = ViewerHost.getInstance();
        if (id === 'diamond_brilliance') {
            host.setEnvironmentIntensity(1.35);
        } else if (id === 'pure_fire') {
            host.setEnvironmentIntensity(1.5);
        } else if (id === 'deep_contrast') {
            host.setEnvironmentIntensity(0.85);
        } else {
            host.setEnvironmentIntensity(1.1);
        }
    }, []);

    const handleSelectBgHex = useCallback((hex: string) => {
        setActiveBgHex(hex);
        // Changes canvas scene background; leaves finite 3D studio floor completely intact
        ViewerHost.getInstance().setStudioPreset('custom', hex);
    }, []);

    const handleChangeEnvIntensity = useCallback((val: number) => {
        setEnvIntensity(val);
        ViewerHost.getInstance().setEnvironmentIntensity(val);
    }, []);

    // Floor & Shadow Controls
    const handleToggleFloor = useCallback((visible: boolean) => {
        setFloorVisible(visible);
        ViewerHost.getInstance().setFloorVisible(visible);
    }, []);

    const handleChangeFloorRoughness = useCallback((roughness: number) => {
        setFloorRoughness(roughness);
        ViewerHost.getInstance().setFloorRoughness(roughness);
    }, []);

    const handleToggleContactShadows = useCallback((enabled: boolean) => {
        setContactShadows(enabled);
        ViewerHost.getInstance().setGroundShadows(enabled);
    }, []);

    const handleChangeShadowIntensity = useCallback((val: number) => {
        setShadowIntensity(val);
        ViewerHost.getInstance().setShadowIntensity(val);
    }, []);

    const handleChangeShadowSoftness = useCallback((val: number) => {
        setShadowSoftness(val);
        ViewerHost.getInstance().setShadowSoftness(val);
    }, []);

    // Drop Options
    const handleToggleAutoCenter = useCallback((enabled: boolean) => {
        setAutoCenter(enabled);
        ViewerHost.getInstance().setAutoCenter(enabled);
    }, []);

    const handleToggleAutoScale = useCallback((enabled: boolean) => {
        setAutoScale(enabled);
        ViewerHost.getInstance().setAutoScale(enabled);
    }, []);

    const handleChangeAutoScaleRadius = useCallback((radius: number) => {
        setAutoScaleRadius(radius);
        ViewerHost.getInstance().setAutoScaleRadius(radius);
    }, []);

    // Renderer Controls
    const handleChangeDisplayScale = useCallback((scale: number) => {
        setDisplayScale(scale);
        ViewerHost.getInstance().setDisplayCanvasScaling(scale);
    }, []);

    const handleToggleBloom = useCallback((enabled: boolean) => {
        setBloomEnabled(enabled);
        ViewerHost.getInstance().setBloom(enabled);
    }, []);

    const handleToggleSSR = useCallback((enabled: boolean) => {
        setSSREnabled(enabled);
        ViewerHost.getInstance().setSSR(enabled);
    }, []);

    const handleToggleSSAO = useCallback((enabled: boolean) => {
        setSSAOEnabled(enabled);
        ViewerHost.getInstance().setSSAO(enabled);
    }, []);

    // Material Controls
    const handleSelectGemVariant = useCallback((preset: GemstonePreset) => {
        setSelectedGemId(preset.id);
        const host = ViewerHost.getInstance();
        if (selectedNodeId) {
            host.applyGemstonePresetToComponent(selectedNodeId, preset);
        } else {
            host.applyGemstoneToAll(preset);
        }
    }, [selectedNodeId]);

    const handleApplyMetalToSelected = useCallback((colorHex: string, roughness: number) => {
        if (selectedNodeId) {
            ViewerHost.getInstance().applyMetalPresetToComponent(selectedNodeId, colorHex, roughness);
        } else {
            ViewerHost.getInstance().applyMetalToAll(colorHex, roughness);
        }
        if (colorHex.includes('fed250')) setActiveMetalName('18K Yellow Gold');
        else if (colorHex.includes('f4a896')) setActiveMetalName('18K Rose Gold');
        else if (colorHex.includes('d5d7de')) setActiveMetalName('Platinum 950');
        else if (colorHex.includes('2d2e30')) setActiveMetalName('Black Rhodium');
        else setActiveMetalName('18K White Gold');
    }, [selectedNodeId]);

    const handleApplyGemstoneToSelected = useCallback((preset: GemstonePreset) => {
        setSelectedGemId(preset.id);
        if (selectedNodeId) {
            ViewerHost.getInstance().applyGemstonePresetToComponent(selectedNodeId, preset);
        } else {
            ViewerHost.getInstance().applyGemstoneToAll(preset);
        }
    }, [selectedNodeId]);

    const handleApplyMetalToAll = useCallback((colorHex: string, roughness: number) => {
        ViewerHost.getInstance().applyMetalToAll(colorHex, roughness);
    }, []);

    const handleApplyGemstoneToAll = useCallback((preset: GemstonePreset) => {
        setSelectedGemId(preset.id);
        ViewerHost.getInstance().applyGemstoneToAll(preset);
    }, []);

    const handleResetComponentMaterial = useCallback((nodeId: string) => {
        ViewerHost.getInstance().resetComponentMaterial(nodeId);
    }, []);

    const handleResetAllMaterials = useCallback(() => {
        ViewerHost.getInstance().resetAllMaterials();
    }, []);

    const handleRefreshUI = useCallback(() => {
        const host = ViewerHost.getInstance();
        const discovered = host.dynamicLoader?.getCurrentManifest();
        if (discovered) setManifest({ ...discovered });
    }, []);

    // Switch Node Actions
    const handleSelectNode = useCallback((nodeId: string | null) => {
        setSelectedNodeId(nodeId);
        if (!nodeId) setSelectedDetail(null);
        ViewerHost.getInstance().selectComponent(nodeId);
    }, []);

    const handleToggleNodeVisibility = useCallback((nodeId: string) => {
        ViewerHost.getInstance().toggleComponentVisibility(nodeId);
    }, []);

    const handleFocusNode = useCallback((nodeId: string) => {
        ViewerHost.getInstance().focusComponent(nodeId);
    }, []);

    const handleSaveConfig = useCallback(async () => {
        setIsSaving(true);
        try {
            const assignments = ViewerHost.getInstance().getUserMaterialAssignments();
            const configPayload = {
                modelId: activeModelId,
                modelName,
                presetId: activePresetId,
                backgroundHex: activeBgHex,
                assignments,
                savedAt: new Date().toISOString()
            };
            localStorage.setItem('ijewel_saved_scene', JSON.stringify(configPayload));
            await new Promise(r => setTimeout(r, 600));
            alert('Scene configuration saved successfully!');
        } catch {
            alert('Could not save configuration.');
        } finally {
            setIsSaving(false);
        }
    }, [activeModelId, modelName, activePresetId, activeBgHex]);

    return (
        <div className="ijewel-playground-app">
            {/* Top Application Bar */}
            <PlaygroundHeader
                modelName={modelName}
                isSaving={isSaving}
                onSaveConfig={handleSaveConfig}
                onExportSnapshot={handleSnapshot}
                onResetCamera={handleResetView}
                onFitProduct={handleFitView}
            />

            {/* Workspace Shell */}
            <div className="ijewel-workspace-body">
                {/* Narrow Left Navigation Rail */}
                <LeftNavRail
                    activeCategory={activeNavCategory}
                    isBrowserOpen={isBrowserOpen}
                    onSelectCategory={(cat) => {
                        setActiveNavCategory(cat);
                        setIsBrowserOpen(true);
                    }}
                    onToggleBrowser={() => setIsBrowserOpen(!isBrowserOpen)}
                />

                {/* Left Asset Browser */}
                {isBrowserOpen && (
                    <AssetBrowser
                        activeCategory={activeNavCategory}
                        onClose={() => setIsBrowserOpen(false)}
                        activePresetId={activePresetId}
                        onSelectPreset={handleSelectPreset}
                        envIntensity={envIntensity}
                        onChangeEnvIntensity={handleChangeEnvIntensity}
                        activeGemEnvId={activeGemEnvId}
                        onSelectGemEnv={handleSelectGemEnv}
                        activeBgHex={activeBgHex}
                        onSelectBgHex={handleSelectBgHex}
                        floorVisible={floorVisible}
                        onToggleFloor={handleToggleFloor}
                        contactShadows={contactShadows}
                        onToggleContactShadows={handleToggleContactShadows}
                        shadowIntensity={shadowIntensity}
                        onChangeShadowIntensity={handleChangeShadowIntensity}
                        shadowSoftness={shadowSoftness}
                        onChangeShadowSoftness={handleChangeShadowSoftness}
                        floorRoughness={floorRoughness}
                        onChangeFloorRoughness={handleChangeFloorRoughness}
                        activeModelId={activeModelId}
                        modelsList={modelsList}
                        onSelectModel={handleSelectModel}
                        onUploadFile={handleUploadFile}
                        isUploading={isUploading}
                    />
                )}

                {/* Central 3D Studio Viewport */}
                <main className="ijewel-viewport-container" id="webgi-canvas-container">
                    <canvas id="webgi-canvas" ref={canvasRef} />

                    {/* Floating Viewport Toolbar (Upper-Right) */}
                    <ViewportToolbar
                        onFitView={handleFitView}
                        onResetView={handleResetView}
                        onSnapshot={handleSnapshot}
                        autoRotate={autoRotate}
                        onToggleAutoRotate={handleToggleAutoRotate}
                        onResetMaterials={handleResetAllMaterials}
                    />

                    {/* Floating Bottom Gemstone Selector (Bottom-Center) */}
                    <GemVariantSelector
                        modelName={modelName}
                        selectedGemId={selectedGemId}
                        metalName={activeMetalName}
                        onSelectGem={handleSelectGemVariant}
                    />

                    {/* Subtle Viewport Watermark (Lower-Left) */}
                    <div className="viewport-watermark">iJewel3D Playground</div>

                    {/* Loading Overlay */}
                    {isLoading && (
                        <div className="viewport-loading-overlay">
                            <div className="loader-spinner" />
                            <span className="loader-label">{loadingMsg}</span>
                        </div>
                    )}
                </main>

                {/* Right Inspector Panel */}
                <RightInspector
                    isOpen={isInspectorOpen}
                    onClose={() => setIsInspectorOpen(false)}
                    manifest={manifest}
                    selectedNodeId={selectedNodeId}
                    selectedDetail={selectedDetail}
                    onSelectNode={handleSelectNode}
                    onToggleVisibility={handleToggleNodeVisibility}
                    onFocusNode={handleFocusNode}
                    onApplyMetalToSelected={handleApplyMetalToSelected}
                    onApplyGemstoneToSelected={handleApplyGemstoneToSelected}
                    onApplyMetalToAll={handleApplyMetalToAll}
                    onApplyGemstoneToAll={handleApplyGemstoneToAll}
                    onResetComponentMaterial={handleResetComponentMaterial}
                    onResetAllMaterials={handleResetAllMaterials}
                    onRefreshUI={handleRefreshUI}
                    autoCenter={autoCenter}
                    onToggleAutoCenter={handleToggleAutoCenter}
                    autoScale={autoScale}
                    onToggleAutoScale={handleToggleAutoScale}
                    autoScaleRadius={autoScaleRadius}
                    onChangeAutoScaleRadius={handleChangeAutoScaleRadius}
                    onUploadFile={handleUploadFile}
                    isUploading={isUploading}
                    onResetCamera={handleResetView}
                    onFitProduct={handleFitView}
                    cameraFov={cameraFov}
                    onChangeCameraFov={handleChangeCameraFov}
                    autoRotate={autoRotate}
                    onToggleAutoRotate={handleToggleAutoRotate}
                    autoRotateSpeed={autoRotateSpeed}
                    onChangeAutoRotateSpeed={handleChangeAutoRotateSpeed}
                    displayScale={displayScale}
                    onChangeDisplayScale={handleChangeDisplayScale}
                    bloomEnabled={bloomEnabled}
                    onToggleBloom={handleToggleBloom}
                    ssrEnabled={ssrEnabled}
                    onToggleSSR={handleToggleSSR}
                    ssaoEnabled={ssaoEnabled}
                    onToggleSSAO={handleToggleSSAO}
                />

                {/* Narrow Quick-Tool Rail */}
                <QuickToolRail
                    isInspectorOpen={isInspectorOpen}
                    onToggleInspector={() => setIsInspectorOpen(!isInspectorOpen)}
                    onResetCamera={handleResetView}
                    onFitProduct={handleFitView}
                    onSnapshot={handleSnapshot}
                    autoRotate={autoRotate}
                    onToggleAutoRotate={handleToggleAutoRotate}
                />
            </div>
        </div>
    );
};

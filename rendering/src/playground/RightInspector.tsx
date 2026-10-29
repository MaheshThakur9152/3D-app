/**
 * RightInspector.tsx
 * Right-side Inspector Panel matching iJewel3D Playground specifications:
 * Renderer, Camera, Drop Options, Material Configurator, Switch Node, and Quick-tool rail.
 */

import React, { useState, useRef } from 'react';
import { ModelManifest, ComponentRole } from '../cad/ModelManifest';
import { GEMSTONE_PRESETS, GemstonePreset } from '../cad/MaterialRoleBinder';
import { SelectedComponentDetail } from '../inspector/InspectorPanel';

interface RightInspectorProps {
    isOpen: boolean;
    onClose: () => void;

    // Model Manifest & Nodes
    manifest: ModelManifest | null;
    selectedNodeId: string | null;
    selectedDetail?: SelectedComponentDetail | null;
    onSelectNode: (nodeId: string | null) => void;
    onToggleVisibility: (nodeId: string) => void;
    onFocusNode: (nodeId: string) => void;
    onUpdateRole?: (nodeId: string, role: ComponentRole) => void;

    // Material Configurator
    onApplyMetalToSelected?: (colorHex: string, roughness: number) => void;
    onApplyGemstoneToSelected?: (preset: GemstonePreset) => void;
    onApplyMetalToAll?: (colorHex: string, roughness: number) => void;
    onApplyGemstoneToAll?: (preset: GemstonePreset) => void;
    onResetComponentMaterial?: (nodeId: string) => void;
    onResetAllMaterials?: () => void;
    onRefreshUI?: () => void;

    // Drop Options
    autoCenter: boolean;
    onToggleAutoCenter: (enabled: boolean) => void;
    autoScale: boolean;
    onToggleAutoScale: (enabled: boolean) => void;
    autoScaleRadius: number;
    onChangeAutoScaleRadius: (radius: number) => void;
    onUploadFile: (file: File) => void;
    isUploading?: boolean;

    // Camera Controls
    onResetCamera: () => void;
    onFitProduct: () => void;
    cameraFov: number;
    onChangeCameraFov: (fov: number) => void;
    autoRotate: boolean;
    onToggleAutoRotate: () => void;
    autoRotateSpeed: number;
    onChangeAutoRotateSpeed: (speed: number) => void;

    // Renderer Controls
    displayScale: number;
    onChangeDisplayScale: (scale: number) => void;
    bloomEnabled: boolean;
    onToggleBloom: (enabled: boolean) => void;
    ssrEnabled: boolean;
    onToggleSSR: (enabled: boolean) => void;
    ssaoEnabled: boolean;
    onToggleSSAO: (enabled: boolean) => void;
}

const METAL_VARIATIONS = [
    { id: '18k_yellow', name: '18K Yellow Gold', color: '#fed250', roughness: 0.08 },
    { id: '18k_white', name: '18K White Gold', color: '#eef0f2', roughness: 0.06 },
    { id: '18k_rose', name: '18K Rose Gold', color: '#f4a896', roughness: 0.08 },
    { id: 'platinum', name: 'Platinum 950', color: '#d5d7de', roughness: 0.05 },
    { id: 'black_rhodium', name: 'Black Rhodium', color: '#2d2e30', roughness: 0.15 }
];

const GEM_VARIATIONS = [
    { id: 'diamond', name: 'Brilliant Diamond', color: '#cfecec', preset: GEMSTONE_PRESETS.diamond },
    { id: 'emerald', name: 'Colombian Emerald', color: '#10b981', preset: GEMSTONE_PRESETS.emerald },
    { id: 'ruby', name: 'Vivid Ruby', color: '#ef4444', preset: GEMSTONE_PRESETS.ruby },
    { id: 'sapphire', name: 'Royal Sapphire', color: '#3b82f6', preset: GEMSTONE_PRESETS.sapphire },
    { id: 'amethyst', name: 'Amethyst', color: '#a855f7', preset: GEMSTONE_PRESETS.amethyst },
    { id: 'aquamarine', name: 'Aquamarine', color: '#38bdf8', preset: GEMSTONE_PRESETS.aquamarine }
];

export const RightInspector: React.FC<RightInspectorProps> = ({
    isOpen,
    onClose,
    manifest,
    selectedNodeId,
    selectedDetail,
    onSelectNode,
    onToggleVisibility,
    onFocusNode,
    onUpdateRole,
    onApplyMetalToSelected,
    onApplyGemstoneToSelected,
    onApplyMetalToAll,
    onApplyGemstoneToAll,
    onResetComponentMaterial,
    onResetAllMaterials,
    onRefreshUI,
    autoCenter,
    onToggleAutoCenter,
    autoScale,
    onToggleAutoScale,
    autoScaleRadius,
    onChangeAutoScaleRadius,
    onUploadFile,
    isUploading,
    onResetCamera,
    onFitProduct,
    cameraFov,
    onChangeCameraFov,
    autoRotate,
    onToggleAutoRotate,
    autoRotateSpeed,
    onChangeAutoRotateSpeed,
    displayScale,
    onChangeDisplayScale,
    bloomEnabled,
    onToggleBloom,
    ssrEnabled,
    onToggleSSR,
    ssaoEnabled,
    onToggleSSAO
}) => {
    // Collapsible section states
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
        renderer: false,
        camera: false,
        drop: false,
        materials: false,
        switchNode: false
    });

    // Material configurator states
    const [showAllMaterials, setShowAllMaterials] = useState(false);
    const [switchNodesEnabled, setSwitchNodesEnabled] = useState(true);
    const [hiddenNodes, setHiddenNodes] = useState<Record<string, boolean>>({});

    const filePickerRef = useRef<HTMLInputElement>(null);

    const toggleSection = (id: string) => {
        setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleNodeVisToggle = (nodeId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setHiddenNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
        onToggleVisibility(nodeId);
    };

    const components = manifest?.components || [];
    const selectedComp = components.find(c => c.nodeId === selectedNodeId || c.nodeName === selectedNodeId) ||
        (selectedNodeId && selectedDetail ? {
            nodeId: selectedNodeId,
            nodeName: selectedDetail.nodeName,
            role: selectedDetail.role,
            sourceLayer: selectedDetail.sourceLayer || 'Default Layer'
        } : null);

    if (!isOpen) return null;

    return (
        <aside className="ijewel-right-inspector" aria-label="Viewer Inspector Panel">
            {/* Header */}
            <div className="inspector-panel-header">
                <span className="panel-title">Inspector</span>
                <button className="btn-close-inspector" onClick={onClose} title="Close Inspector" aria-label="Close">
                    &times;
                </button>
            </div>

            {/* Scrollable Accordion Content */}
            <div className="inspector-accordion-body">
                {/* 1. Renderer Section */}
                <div className="accordion-section">
                    <button
                        className="accordion-header-btn"
                        onClick={() => toggleSection('renderer')}
                        aria-expanded={!collapsedSections.renderer}
                    >
                        <span className="section-title">Renderer</span>
                        <svg
                            className={`chevron-icon ${collapsedSections.renderer ? 'collapsed' : ''}`}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {!collapsedSections.renderer && (
                        <div className="accordion-content">
                            <div className="control-row">
                                <span className="ctrl-label">Render Quality / Scale</span>
                                <div className="btn-group-segmented">
                                    <button
                                        className={`btn-segment ${displayScale <= 1.0 ? 'active' : ''}`}
                                        onClick={() => onChangeDisplayScale(1.0)}
                                    >
                                        1.0x
                                    </button>
                                    <button
                                        className={`btn-segment ${displayScale === 1.5 ? 'active' : ''}`}
                                        onClick={() => onChangeDisplayScale(1.5)}
                                    >
                                        1.5x
                                    </button>
                                    <button
                                        className={`btn-segment ${displayScale >= 2.0 ? 'active' : ''}`}
                                        onClick={() => onChangeDisplayScale(2.0)}
                                    >
                                        2.0x Retina
                                    </button>
                                </div>
                            </div>

                            <div className="control-toggle-row">
                                <span className="ctrl-label">Bloom Glow</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={bloomEnabled}
                                        onChange={e => onToggleBloom(e.target.checked)}
                                    />
                                    <span className="slider round" />
                                </label>
                            </div>

                            <div className="control-toggle-row">
                                <span className="ctrl-label">Screen Space Reflections (SSR)</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={ssrEnabled}
                                        onChange={e => onToggleSSR(e.target.checked)}
                                    />
                                    <span className="slider round" />
                                </label>
                            </div>

                            <div className="control-toggle-row">
                                <span className="ctrl-label">Ambient Occlusion (SSAO)</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={ssaoEnabled}
                                        onChange={e => onToggleSSAO(e.target.checked)}
                                    />
                                    <span className="slider round" />
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Camera Section */}
                <div className="accordion-section">
                    <button
                        className="accordion-header-btn"
                        onClick={() => toggleSection('camera')}
                        aria-expanded={!collapsedSections.camera}
                    >
                        <span className="section-title">Camera</span>
                        <svg
                            className={`chevron-icon ${collapsedSections.camera ? 'collapsed' : ''}`}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {!collapsedSections.camera && (
                        <div className="accordion-content">
                            <div className="action-buttons-grid">
                                <button className="btn-action-outline" onClick={onResetCamera} title="Reset camera view to initial studio angle">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                        <path d="M3 3v5h5" />
                                    </svg>
                                    <span>Reset Camera</span>
                                </button>
                                <button className="btn-action-outline" onClick={onFitProduct} title="Fit and frame jewelry bounds">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                    <span>Frame Product</span>
                                </button>
                            </div>

                            <div className="control-row">
                                <span className="ctrl-label">Field of View (FOV)</span>
                                <div className="control-slider-wrap">
                                    <input
                                        type="range"
                                        min="30"
                                        max="75"
                                        step="1"
                                        value={cameraFov}
                                        onChange={e => onChangeCameraFov(parseInt(e.target.value, 10))}
                                    />
                                    <span className="ctrl-val">{cameraFov}°</span>
                                </div>
                            </div>

                            <div className="control-toggle-row">
                                <span className="ctrl-label">360 Turntable Orbit</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={autoRotate}
                                        onChange={e => onToggleAutoRotate()}
                                    />
                                    <span className="slider round" />
                                </label>
                            </div>

                            {autoRotate && (
                                <div className="control-row">
                                    <span className="ctrl-label">Orbit Speed</span>
                                    <div className="control-slider-wrap">
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="5.0"
                                            step="0.5"
                                            value={autoRotateSpeed}
                                            onChange={e => onChangeAutoRotateSpeed(parseFloat(e.target.value))}
                                        />
                                        <span className="ctrl-val">{autoRotateSpeed.toFixed(1)}x</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 3. Drop Options Section */}
                <div className="accordion-section">
                    <button
                        className="accordion-header-btn"
                        onClick={() => toggleSection('drop')}
                        aria-expanded={!collapsedSections.drop}
                    >
                        <span className="section-title">Drop Options</span>
                        <svg
                            className={`chevron-icon ${collapsedSections.drop ? 'collapsed' : ''}`}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {!collapsedSections.drop && (
                        <div className="accordion-content">
                            <div className="control-toggle-row">
                                <span className="ctrl-label">Auto Center Model</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={autoCenter}
                                        onChange={e => onToggleAutoCenter(e.target.checked)}
                                    />
                                    <span className="slider round" />
                                </label>
                            </div>

                            <div className="control-toggle-row">
                                <span className="ctrl-label">Auto Scale Model</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={autoScale}
                                        onChange={e => onToggleAutoScale(e.target.checked)}
                                    />
                                    <span className="slider round" />
                                </label>
                            </div>

                            <div className="control-row">
                                <span className="ctrl-label">Auto Scale Radius</span>
                                <div className="control-input-wrap">
                                    <input
                                        type="number"
                                        className="number-input"
                                        step="0.05"
                                        min="0.5"
                                        max="5.0"
                                        value={autoScaleRadius}
                                        onChange={e => onChangeAutoScaleRadius(parseFloat(e.target.value) || 1.35)}
                                    />
                                    <span className="unit-label">units</span>
                                </div>
                            </div>

                            <input
                                type="file"
                                ref={filePickerRef}
                                style={{ display: 'none' }}
                                accept=".glb,.gltf,.3dm"
                                onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) onUploadFile(file);
                                    if (e.target) e.target.value = '';
                                }}
                            />

                            <button
                                className={`btn-select-file ${isUploading ? 'uploading' : ''}`}
                                onClick={() => filePickerRef.current?.click()}
                                disabled={isUploading}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                                <span>{isUploading ? 'Loading File...' : 'Select Local File'}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* 4. Material Configurator Section */}
                <div className="accordion-section">
                    <button
                        className="accordion-header-btn"
                        onClick={() => toggleSection('materials')}
                        aria-expanded={!collapsedSections.materials}
                    >
                        <span className="section-title">Material Configurator</span>
                        <svg
                            className={`chevron-icon ${collapsedSections.materials ? 'collapsed' : ''}`}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {!collapsedSections.materials && (
                        <div className="accordion-content">
                            {/* Selected Component Header */}
                            {selectedComp ? (
                                <div className="selected-component-card">
                                    <div className="comp-card-top">
                                        <span className="comp-name">{selectedComp.nodeName || selectedComp.nodeId}</span>
                                        <span className={`comp-role-badge role-${selectedComp.role}`}>{selectedComp.role}</span>
                                    </div>
                                    <div className="comp-card-actions">
                                        <button className="btn-sm-action" onClick={() => onFocusNode(selectedComp.nodeId)}>Focus</button>
                                        {onResetComponentMaterial && (
                                            <button className="btn-sm-action" onClick={() => onResetComponentMaterial(selectedComp.nodeId)}>Reset</button>
                                        )}
                                        <button className="btn-sm-action" onClick={() => onSelectNode(null)}>Clear</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="unselected-hint">
                                    Click any jewelry part in the 3D viewport to configure its material.
                                </div>
                            )}

                            {/* Action Bar: Refresh UI, Apply All, Show All */}
                            <div className="material-actions-bar">
                                <button className="btn-text-action" onClick={onRefreshUI} title="Re-read model nodes and materials">
                                    Refresh UI
                                </button>
                                <span className="action-sep">•</span>
                                <button
                                    className="btn-text-action"
                                    onClick={() => {
                                        if (selectedComp?.role.startsWith('metal') && onApplyMetalToAll) {
                                            onApplyMetalToAll('#eef0f2', 0.06);
                                        } else if (onApplyGemstoneToAll) {
                                            onApplyGemstoneToAll(GEMSTONE_PRESETS.diamond);
                                        }
                                    }}
                                    title="Apply material variation to all matching roles"
                                >
                                    Apply All
                                </button>
                                <span className="action-sep">•</span>
                                <button
                                    className={`btn-text-action ${showAllMaterials ? 'active' : ''}`}
                                    onClick={() => setShowAllMaterials(!showAllMaterials)}
                                    title="Show all material variations"
                                >
                                    {showAllMaterials ? 'Show Selected' : 'Show All'}
                                </button>
                            </div>

                            {/* Metal Variations */}
                            {(!selectedComp || selectedComp.role.startsWith('metal') || showAllMaterials) && (
                                <div className="material-group">
                                    <div className="group-label">Precious Metals</div>
                                    <div className="material-swatches-grid">
                                        {METAL_VARIATIONS.map(metal => (
                                            <button
                                                key={metal.id}
                                                className="material-swatch-item"
                                                onClick={() => {
                                                    if (onApplyMetalToSelected) {
                                                        onApplyMetalToSelected(metal.color, metal.roughness);
                                                    }
                                                }}
                                                title={metal.name}
                                            >
                                                <div className="swatch-sample" style={{ backgroundColor: metal.color }} />
                                                <span className="swatch-label">{metal.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Gem Variations */}
                            {(!selectedComp || !selectedComp.role.startsWith('metal') || showAllMaterials) && (
                                <div className="material-group">
                                    <div className="group-label">Gemstones & Diamonds</div>
                                    <div className="material-swatches-grid">
                                        {GEM_VARIATIONS.map(gem => (
                                            <button
                                                key={gem.id}
                                                className="material-swatch-item"
                                                onClick={() => {
                                                    if (onApplyGemstoneToSelected) {
                                                        onApplyGemstoneToSelected(gem.preset);
                                                    }
                                                }}
                                                title={gem.name}
                                            >
                                                <div className="swatch-sample" style={{ backgroundColor: gem.color }} />
                                                <span className="swatch-label">{gem.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 5. Switch Node Section */}
                <div className="accordion-section">
                    <button
                        className="accordion-header-btn"
                        onClick={() => toggleSection('switchNode')}
                        aria-expanded={!collapsedSections.switchNode}
                    >
                        <span className="section-title">Switch Node</span>
                        <svg
                            className={`chevron-icon ${collapsedSections.switchNode ? 'collapsed' : ''}`}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {!collapsedSections.switchNode && (
                        <div className="accordion-content">
                            <div className="control-toggle-row">
                                <span className="ctrl-label">Switch Nodes Enabled</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={switchNodesEnabled}
                                        onChange={e => setSwitchNodesEnabled(e.target.checked)}
                                    />
                                    <span className="slider round" />
                                </label>
                            </div>

                            <div className="section-subtitle">All Nodes ({components.length})</div>
                            <div className="nodes-tree-list">
                                {components.map(comp => {
                                    const isSelected = comp.nodeId === selectedNodeId;
                                    const isHidden = !!hiddenNodes[comp.nodeId];
                                    return (
                                        <div
                                            key={comp.nodeId}
                                            className={`node-tree-item ${isSelected ? 'selected' : ''}`}
                                            onClick={() => onSelectNode(comp.nodeId)}
                                        >
                                            <button
                                                className="btn-node-vis"
                                                onClick={e => handleNodeVisToggle(comp.nodeId, e)}
                                                title={isHidden ? 'Show Node' : 'Hide Node'}
                                            >
                                                {isHidden ? (
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                        <line x1="1" y1="1" x2="23" y2="23" />
                                                    </svg>
                                                ) : (
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
                                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                        <circle cx="12" cy="12" r="3" />
                                                    </svg>
                                                )}
                                            </button>

                                            <span className="node-tree-name">{comp.nodeName || comp.nodeId}</span>
                                            <span className={`node-tree-role role-${comp.role}`}>{comp.role.split('_')[0]}</span>

                                            <button
                                                className="btn-node-focus"
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    onFocusNode(comp.nodeId);
                                                }}
                                                title="Focus on Node"
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <circle cx="12" cy="12" r="3" />
                                                </svg>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
};

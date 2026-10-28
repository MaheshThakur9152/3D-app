/**
 * InspectorPanel.tsx
 * Right panel: Scene hierarchy tree, 3D picking sync, component visibility,
 * live transforms, parent traversal, individual gemstone/metal customizer,
 * and studio lighting/environment controls.
 */

import React, { useState } from 'react';
import { ModelManifest, ComponentRole } from '../cad/ModelManifest';
import { GEMSTONE_PRESETS } from '../cad/MaterialRoleBinder';
import { STUDIO_PRESETS } from '../ui/StudioSettings';

export interface SelectedComponentDetail {
    nodeId: string;
    nodeName: string;
    parentName?: string;
    role: ComponentRole;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
    sourceLayer?: string;
    isMerged?: boolean;
}

interface InspectorPanelProps {
    manifest: ModelManifest | null;
    selectedNodeId: string | null;
    selectedDetail?: SelectedComponentDetail | null;
    onSelectNode: (nodeId: string | null) => void;
    onSelectParent?: (nodeId: string) => void;
    onToggleVisibility: (nodeId: string) => void;
    onFocusNode: (nodeId: string) => void;
    onUpdateRole: (nodeId: string, role: ComponentRole) => void;
    onApplyGemstoneToSelected?: (preset: any) => void;
    onApplyMetalToSelected?: (colorHex: string, roughness: number) => void;
    onClose: () => void;

    // Studio & Camera controls
    studioPreset?: string;
    groundShadows?: boolean;
    groundReflections?: boolean;
    envIntensity?: number;
    onSelectStudioPreset?: (presetId: string) => void;
    onToggleGroundShadows?: (enabled: boolean) => void;
    onToggleGroundReflections?: (enabled: boolean) => void;
    onChangeEnvIntensity?: (val: number) => void;
    onFitView?: () => void;
    onResetView?: () => void;
    autoRotate?: boolean;
    onToggleAutoRotate?: () => void;
}

const QUICK_GEMS = [
    { id: 'diamond', name: 'Diamond', color: '#cfecec', preset: GEMSTONE_PRESETS.diamond },
    { id: 'ruby', name: 'Ruby', color: '#b2102f', preset: GEMSTONE_PRESETS.ruby },
    { id: 'sapphire', name: 'Sapphire', color: '#0f388a', preset: GEMSTONE_PRESETS.sapphire },
    { id: 'emerald', name: 'Emerald', color: '#097945', preset: GEMSTONE_PRESETS.emerald },
    { id: 'amethyst', name: 'Amethyst', color: '#6a2875', preset: GEMSTONE_PRESETS.amethyst },
    { id: 'aquamarine', name: 'Aqua', color: '#7ddad0', preset: GEMSTONE_PRESETS.aquamarine }
];

const QUICK_METALS = [
    { id: 'yellow_gold', name: '18K Yellow', color: '#fed250', roughness: 0.08 },
    { id: 'white_gold', name: 'White Gold', color: '#eef0f2', roughness: 0.06 },
    { id: 'rose_gold', name: 'Rose Gold', color: '#f4a896', roughness: 0.08 },
    { id: 'black_rhodium', name: 'Black Rhodium', color: '#2d2e30', roughness: 0.15 }
];

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
    manifest,
    selectedNodeId,
    selectedDetail,
    onSelectNode,
    onSelectParent,
    onToggleVisibility,
    onFocusNode,
    onUpdateRole,
    onApplyGemstoneToSelected,
    onApplyMetalToSelected,
    onClose,
    studioPreset = 'white',
    groundShadows = true,
    groundReflections = true,
    envIntensity = 1.0,
    onSelectStudioPreset,
    onToggleGroundShadows,
    onToggleGroundReflections,
    onChangeEnvIntensity,
    onFitView,
    onResetView,
    autoRotate = false,
    onToggleAutoRotate
}) => {
    const [inspectorTab, setInspectorTab] = useState<'hierarchy' | 'studio'>('hierarchy');
    const [filter, setFilter] = useState<'all' | 'metals' | 'gems'>('all');
    const [search, setSearch] = useState('');
    const [hiddenNodes, setHiddenNodes] = useState<Record<string, boolean>>({});

    const components = manifest?.components || [];

    const filtered = components.filter((comp) => {
        if (search) {
            const q = search.toLowerCase();
            const matchName = (comp.nodeName || comp.nodeId).toLowerCase().includes(q);
            const matchLayer = (comp.sourceLayer || '').toLowerCase().includes(q);
            if (!matchName && !matchLayer) return false;
        }

        if (filter === 'metals') {
            return comp.role.startsWith('metal');
        }
        if (filter === 'gems') {
            return comp.role === 'diamond' || comp.role === 'accent_stone' || comp.role === 'colored_gemstone';
        }
        return true;
    });

    const selectedComp = components.find(c => c.nodeId === selectedNodeId || c.nodeName === selectedNodeId) ||
        (selectedNodeId && selectedDetail ? {
            nodeId: selectedNodeId,
            nodeName: selectedDetail.nodeName,
            role: selectedDetail.role,
            sourceLayer: selectedDetail.sourceLayer || 'Default Layer'
        } : null);

    const handleToggleVis = (nodeId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setHiddenNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
        onToggleVisibility(nodeId);
    };

    return (
        <aside className="inspector-panel">
            <div className="inspector-top-tabs">
                <button
                    className={`btn-inspector-tab ${inspectorTab === 'hierarchy' ? 'active' : ''}`}
                    onClick={() => setInspectorTab('hierarchy')}
                >
                    Hierarchy ({components.length})
                </button>
                <button
                    className={`btn-inspector-tab ${inspectorTab === 'studio' ? 'active' : ''}`}
                    onClick={() => setInspectorTab('studio')}
                >
                    Environment
                </button>
                <button className="inspector-close-btn" onClick={onClose} title="Close Panel">&times;</button>
            </div>

            {inspectorTab === 'hierarchy' ? (
                <>
                    <div className="inspector-search-row">
                        <input
                            type="text"
                            className="inspector-search-input"
                            placeholder="Search by name or layer..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="inspector-filter-tabs">
                        <button
                            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                            onClick={() => setFilter('all')}
                        >
                            All
                        </button>
                        <button
                            className={`filter-tab ${filter === 'metals' ? 'active' : ''}`}
                            onClick={() => setFilter('metals')}
                        >
                            Metals
                        </button>
                        <button
                            className={`filter-tab ${filter === 'gems' ? 'active' : ''}`}
                            onClick={() => setFilter('gems')}
                        >
                            Gems
                        </button>
                    </div>

                    {selectedComp && (
                        <div className="inspector-selection-box">
                            <div className="selection-box-header">
                                <span className="selection-box-title">Selected Component</span>
                                <button className="btn-clear-selection" onClick={() => onSelectNode(null)}>&times;</button>
                            </div>
                            <div className="selection-box-name">{selectedComp.nodeName || selectedComp.nodeId}</div>
                            
                            <div className="selection-box-meta">
                                <span className="badge-layer">{selectedComp.sourceLayer || 'Default Layer'}</span>
                                <span className={`badge-role role-${selectedComp.role}`}>{selectedComp.role}</span>
                                {selectedDetail?.isMerged && (
                                    <span className="badge-role role-unassigned">Merged Geometry</span>
                                )}
                            </div>

                            {selectedDetail?.parentName && (
                                <div className="selection-parent-row">
                                    <span className="parent-label">Parent: <strong>{selectedDetail.parentName}</strong></span>
                                    {onSelectParent && (
                                        <button className="btn-select-parent" onClick={() => onSelectParent(selectedComp.nodeId)}>
                                            Select Parent
                                        </button>
                                    )}
                                </div>
                            )}

                            {selectedDetail?.position && (
                                <div className="selection-transforms-info">
                                    <div>Pos: [{selectedDetail.position.join(', ')}]</div>
                                    {selectedDetail.rotation && <div>Rot: [{selectedDetail.rotation.join(', ')}°]</div>}
                                </div>
                            )}

                            <div className="selection-actions-row">
                                <button className="btn-action-focus" onClick={() => onFocusNode(selectedComp.nodeId)}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <line x1="22" y1="12" x2="18" y2="12"/>
                                        <line x1="6" y1="12" x2="2" y2="12"/>
                                        <line x1="12" y1="6" x2="12" y2="2"/>
                                        <line x1="12" y1="22" x2="12" y2="18"/>
                                    </svg>
                                    <span>Focus</span>
                                </button>
                                <button className="btn-action-vis" onClick={(e) => handleToggleVis(selectedComp.nodeId, e)}>
                                    <span>{hiddenNodes[selectedComp.nodeId] ? 'Show' : 'Hide'}</span>
                                </button>
                            </div>

                            <div className="role-assignment-box">
                                <label className="field-label">Assigned Semantic Role</label>
                                <select
                                    className="field-select"
                                    value={selectedComp.role}
                                    onChange={(e) => onUpdateRole(selectedComp.nodeId, e.target.value as ComponentRole)}
                                >
                                    <option value="metal_shank">Metal Shank</option>
                                    <option value="metal_head">Metal Head</option>
                                    <option value="metal_prongs">Metal Prongs</option>
                                    <option value="diamond">Center Diamond</option>
                                    <option value="accent_stone">Accent Diamond</option>
                                    <option value="colored_gemstone">Colored Gemstone</option>
                                    <option value="unassigned">Unassigned</option>
                                </select>
                            </div>

                            {/* Direct Component Gemstone Swatches */}
                            {onApplyGemstoneToSelected && (
                                <div className="component-swatches-box">
                                    <label className="field-label">Apply Gem to Selected Stone</label>
                                    <div className="component-swatches-row">
                                        {QUICK_GEMS.map(g => (
                                            <button
                                                key={g.id}
                                                className="btn-quick-swatch"
                                                title={`Apply ${g.name} to this stone`}
                                                onClick={() => onApplyGemstoneToSelected(g.preset)}
                                            >
                                                <span className="quick-dot" style={{ backgroundColor: g.color }} />
                                                <span className="quick-label">{g.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Direct Component Metal Swatches */}
                            {onApplyMetalToSelected && (
                                <div className="component-swatches-box">
                                    <label className="field-label">Apply Metal to Selected Part</label>
                                    <div className="component-swatches-row">
                                        {QUICK_METALS.map(m => (
                                            <button
                                                key={m.id}
                                                className="btn-quick-swatch"
                                                title={`Apply ${m.name} to this part`}
                                                onClick={() => onApplyMetalToSelected(m.color, m.roughness)}
                                            >
                                                <span className="quick-dot" style={{ backgroundColor: m.color }} />
                                                <span className="quick-label">{m.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="hierarchy-list">
                        {filtered.map((comp) => {
                            const isSelected = selectedNodeId === comp.nodeId || selectedNodeId === comp.nodeName;
                            const isHidden = !!hiddenNodes[comp.nodeId];
                            return (
                                <div
                                    key={comp.nodeId}
                                    className={`hierarchy-item ${isSelected ? 'selected' : ''} ${isHidden ? 'hidden' : ''}`}
                                    onClick={() => onSelectNode(isSelected ? null : comp.nodeId)}
                                >
                                    <button
                                        className="item-vis-btn"
                                        onClick={(e) => handleToggleVis(comp.nodeId, e)}
                                        title={isHidden ? 'Show component' : 'Hide component'}
                                    >
                                        {isHidden ? '👁️‍🗨️' : '👁️'}
                                    </button>
                                    <span className="item-name" title={comp.nodeName}>{comp.nodeName || comp.nodeId}</span>
                                    <span className={`item-role-tag role-${comp.role}`}>
                                        {comp.role.replace('metal_', '').replace('_stone', '')}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                <div className="inspector-studio-tab">
                    <div className="panel-section-title">Camera & Orbit</div>
                    <div className="inspector-camera-actions">
                        {onFitView && (
                            <button className="btn-camera-ctrl" onClick={onFitView} title="Fit View">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                                </svg>
                                <span>Fit View</span>
                            </button>
                        )}
                        {onResetView && (
                            <button className="btn-camera-ctrl" onClick={onResetView} title="Reset View">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                                    <path d="M3 3v5h5"/>
                                </svg>
                                <span>Reset View</span>
                            </button>
                        )}
                        {onToggleAutoRotate && (
                            <button className={`btn-camera-ctrl ${autoRotate ? 'active' : ''}`} onClick={onToggleAutoRotate} title="Toggle Auto-Rotate">
                                <span>{autoRotate ? 'Stop Rotate' : 'Auto Rotate'}</span>
                            </button>
                        )}
                    </div>

                    <div className="panel-section-title">Studio Backdrop Presets</div>
                    <div className="swatches-grid">
                        {Object.values(STUDIO_PRESETS).map((p) => (
                            <button
                                key={p.id}
                                className={`swatch-card ${studioPreset === p.id ? 'active' : ''}`}
                                onClick={() => onSelectStudioPreset && onSelectStudioPreset(p.id)}
                            >
                                <span className="swatch-circle" style={{ backgroundColor: p.hex, border: '1px solid rgba(0,0,0,0.1)' }} />
                                <span className="swatch-label">{p.name}</span>
                            </button>
                        ))}
                    </div>

                    <div className="panel-section-title">Ground & Shadows</div>
                    {onToggleGroundShadows && (
                        <div className="toggle-row">
                            <span className="toggle-label">Contact Shadows</span>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={groundShadows}
                                    onChange={(e) => onToggleGroundShadows(e.target.checked)}
                                />
                                <span className="slider-round" />
                            </label>
                        </div>
                    )}

                    {onToggleGroundReflections && (
                        <div className="toggle-row">
                            <span className="toggle-label">Ground Mirror Reflections</span>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={groundReflections}
                                    onChange={(e) => onToggleGroundReflections(e.target.checked)}
                                />
                                <span className="slider-round" />
                            </label>
                        </div>
                    )}

                    <div className="panel-section-title">Environment Lighting</div>
                    {onChangeEnvIntensity && (
                        <div className="slider-row">
                            <div className="slider-header">
                                <span>HDR Light Intensity</span>
                                <span className="slider-val">{envIntensity.toFixed(2)}</span>
                            </div>
                            <input
                                type="range"
                                min="0.5"
                                max="2.5"
                                step="0.05"
                                value={envIntensity}
                                onChange={(e) => onChangeEnvIntensity(parseFloat(e.target.value))}
                            />
                        </div>
                    )}
                </div>
            )}
        </aside>
    );
};

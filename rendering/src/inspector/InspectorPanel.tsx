/**
 * InspectorPanel.tsx
 * Right panel: Scene hierarchy tree, 3D picking sync, component visibility,
 * live transforms, parent traversal, and individual gemstone/metal customizer.
 */

import React, { useState } from 'react';
import { ModelManifest, ComponentRole } from '../cad/ModelManifest';
import { GEMSTONE_PRESETS } from '../cad/MaterialRoleBinder';

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
    onClose
}) => {
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
            <div className="inspector-header">
                <div className="header-titles">
                    <h3>Scene Hierarchy</h3>
                    <span className="components-count-badge">{components.length} Components</span>
                </div>
                <button className="inspector-close-btn" onClick={onClose} title="Close Panel">&times;</button>
            </div>

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
                    All ({components.length})
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
                        <span className="selection-box-title">Selected 3D Component</span>
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
        </aside>
    );
};

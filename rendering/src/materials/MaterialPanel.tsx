/**
 * MaterialPanel.tsx
 * Left panel: Metal finishes and Gemstone optical presets.
 */

import React, { useState } from 'react';
import { GEMSTONE_PRESETS, GemstonePreset } from '../cad/MaterialRoleBinder';

interface MaterialPanelProps {
    mode: 'metals' | 'gemstones';
    onApplyMetal: (color: string, roughness: number, metalness: number, role: string) => void;
    onApplyGemstonePreset: (preset: GemstonePreset, role: string) => void;
    onApplyCustomGemstone: (params: any, role: string) => void;
}

const METAL_PRESETS = [
    { id: 'yellow_gold', name: '18K Yellow Gold', color: '#fed250', roughness: 0.08, metalness: 1.0 },
    { id: 'white_gold', name: 'White Gold / Plat', color: '#eef0f2', roughness: 0.06, metalness: 1.0 },
    { id: 'rose_gold', name: '18K Rose Gold', color: '#f4a896', roughness: 0.08, metalness: 1.0 },
    { id: 'satin_yellow', name: 'Satin Yellow', color: '#fed250', roughness: 0.32, metalness: 0.95 },
    { id: 'satin_white', name: 'Satin Platinum', color: '#eef0f2', roughness: 0.28, metalness: 0.95 },
    { id: 'black_rhodium', name: 'Black Rhodium', color: '#2d2e30', roughness: 0.15, metalness: 0.9 }
];

export const MaterialPanel: React.FC<MaterialPanelProps> = ({
    mode,
    onApplyMetal,
    onApplyGemstonePreset,
    onApplyCustomGemstone
}) => {
    // Metal state
    const [metalRole, setMetalRole] = useState('all_metals');
    const [selectedMetalId, setSelectedMetalId] = useState('yellow_gold');
    const [metalColor, setMetalColor] = useState('#fed250');
    const [metalRoughness, setMetalRoughness] = useState(0.08);
    const [metalMetalness, setMetalMetalness] = useState(1.0);

    // Gemstone state
    const [gemRole, setGemRole] = useState('all_gemstones');
    const [selectedGemId, setSelectedGemId] = useState('diamond');
    const [gemColor, setGemColor] = useState('#cfecec');
    const [refractiveIndex, setRefractiveIndex] = useState(2.417);
    const [dispersion, setDispersion] = useState(0.044);
    const [absorption, setAbsorption] = useState(1.0);
    const [envIntensity, setEnvIntensity] = useState(1.35);

    const handleSelectMetalPreset = (p: typeof METAL_PRESETS[0]) => {
        setSelectedMetalId(p.id);
        setMetalColor(p.color);
        setMetalRoughness(p.roughness);
        setMetalMetalness(p.metalness);
        onApplyMetal(p.color, p.roughness, p.metalness, metalRole);
    };

    const handleSelectGemPreset = (preset: GemstonePreset) => {
        setSelectedGemId(preset.id);
        setGemColor(preset.color);
        setRefractiveIndex(preset.refractiveIndex);
        setDispersion(preset.dispersion);
        setAbsorption(preset.absorptionFactor);
        setEnvIntensity(preset.envMapIntensity);
        onApplyGemstonePreset(preset, gemRole);
    };

    const handleCustomGemChange = (update: Partial<{ color: string, refractiveIndex: number, dispersion: number, absorption: number, envIntensity: number }>) => {
        const next = {
            color: update.color ?? gemColor,
            refractiveIndex: update.refractiveIndex ?? refractiveIndex,
            dispersion: update.dispersion ?? dispersion,
            absorptionFactor: update.absorption ?? absorption,
            envMapIntensity: update.envIntensity ?? envIntensity
        };
        if (update.color) setGemColor(update.color);
        if (update.refractiveIndex !== undefined) setRefractiveIndex(update.refractiveIndex);
        if (update.dispersion !== undefined) setDispersion(update.dispersion);
        if (update.absorption !== undefined) setAbsorption(update.absorption);
        if (update.envIntensity !== undefined) setEnvIntensity(update.envIntensity);

        onApplyCustomGemstone(next, gemRole);
    };

    if (mode === 'metals') {
        return (
            <div className="material-panel">
                <div className="panel-field">
                    <label className="field-label">Target Metal Component</label>
                    <select
                        className="field-select"
                        value={metalRole}
                        onChange={(e) => {
                            setMetalRole(e.target.value);
                            onApplyMetal(metalColor, metalRoughness, metalMetalness, e.target.value);
                        }}
                    >
                        <option value="all_metals">All Metal Parts</option>
                        <option value="selected">Selected Component (3D Picked)</option>
                        <option value="metal_shank">Shank / Ring Band</option>
                        <option value="metal_head">Head / Collet</option>
                        <option value="metal_prongs">Prongs & Claws</option>
                    </select>
                </div>

                <div className="panel-section-title">Precious Metal Presets</div>
                <div className="swatches-grid">
                    {METAL_PRESETS.map((p) => (
                        <button
                            key={p.id}
                            className={`swatch-card ${selectedMetalId === p.id ? 'active' : ''}`}
                            onClick={() => handleSelectMetalPreset(p)}
                        >
                            <span className="swatch-circle" style={{ backgroundColor: p.color }} />
                            <span className="swatch-label">{p.name}</span>
                        </button>
                    ))}
                </div>

                <div className="panel-section-title">PBR Surface Tuning</div>
                <div className="slider-row">
                    <div className="slider-header">
                        <span>Roughness / Polish</span>
                        <span className="slider-val">{metalRoughness.toFixed(2)}</span>
                    </div>
                    <input
                        type="range"
                        min="0.01"
                        max="0.50"
                        step="0.01"
                        value={metalRoughness}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setMetalRoughness(val);
                            onApplyMetal(metalColor, val, metalMetalness, metalRole);
                        }}
                    />
                </div>

                <div className="slider-row">
                    <div className="slider-header">
                        <span>Metalness</span>
                        <span className="slider-val">{metalMetalness.toFixed(2)}</span>
                    </div>
                    <input
                        type="range"
                        min="0.70"
                        max="1.0"
                        step="0.02"
                        value={metalMetalness}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setMetalMetalness(val);
                            onApplyMetal(metalColor, metalRoughness, val, metalRole);
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="material-panel">
            <div className="panel-field">
                <label className="field-label">Target Gemstone Group</label>
                <select
                    className="field-select"
                    value={gemRole}
                    onChange={(e) => {
                        setGemRole(e.target.value);
                    }}
                >
                    <option value="all_gemstones">All Gemstones</option>
                    <option value="selected">Selected Component (3D Picked)</option>
                    <option value="diamond">Center Diamond</option>
                    <option value="accent_stone">Accent Diamonds</option>
                    <option value="colored_gemstone">Colored Gems</option>
                </select>
            </div>

            <div className="panel-section-title">Optical Gemstone Presets</div>
            <div className="swatches-grid">
                {Object.values(GEMSTONE_PRESETS).map((preset) => (
                    <button
                        key={preset.id}
                        className={`swatch-card ${selectedGemId === preset.id ? 'active' : ''}`}
                        onClick={() => handleSelectGemPreset(preset)}
                    >
                        <span className="swatch-circle" style={{ backgroundColor: preset.color }} />
                        <span className="swatch-label">{preset.name}</span>
                    </button>
                ))}
            </div>

            <div className="panel-section-title">Optical Shader Controls</div>
            <div className="slider-row">
                <div className="slider-header">
                    <span>Refractive Index (IOR)</span>
                    <span className="slider-val">{refractiveIndex.toFixed(3)}</span>
                </div>
                <input
                    type="range"
                    min="1.40"
                    max="2.60"
                    step="0.01"
                    value={refractiveIndex}
                    onChange={(e) => handleCustomGemChange({ refractiveIndex: parseFloat(e.target.value) })}
                />
            </div>

            <div className="slider-row">
                <div className="slider-header">
                    <span>Dispersion (Fire / Prismatic)</span>
                    <span className="slider-val">{dispersion.toFixed(3)}</span>
                </div>
                <input
                    type="range"
                    min="0.005"
                    max="0.070"
                    step="0.002"
                    value={dispersion}
                    onChange={(e) => handleCustomGemChange({ dispersion: parseFloat(e.target.value) })}
                />
            </div>

            <div className="slider-row">
                <div className="slider-header">
                    <span>Absorption Factor</span>
                    <span className="slider-val">{absorption.toFixed(2)}</span>
                </div>
                <input
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.1"
                    value={absorption}
                    onChange={(e) => handleCustomGemChange({ absorption: parseFloat(e.target.value) })}
                />
            </div>

            <div className="slider-row">
                <div className="slider-header">
                    <span>Environment Sparkle Intensity</span>
                    <span className="slider-val">{envIntensity.toFixed(2)}</span>
                </div>
                <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.05"
                    value={envIntensity}
                    onChange={(e) => handleCustomGemChange({ envIntensity: parseFloat(e.target.value) })}
                />
            </div>
        </div>
    );
};

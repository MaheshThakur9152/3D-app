/**
 * AssetBrowser.tsx
 * Left asset browser panel featuring compact 3-column circular swatch grids
 * for HDR Environments, Gem Environments, Backgrounds, and Models.
 */

import React, { useRef } from 'react';
import { PlaygroundNavCategory } from './LeftNavRail';
import { ModelItem } from '../state/StudioState';

interface AssetBrowserProps {
    activeCategory: PlaygroundNavCategory;
    onClose: () => void;

    // Environment
    activePresetId: string;
    onSelectPreset: (id: string) => void;
    envIntensity: number;
    onChangeEnvIntensity: (val: number) => void;

    // Gem Environment
    activeGemEnvId: string;
    onSelectGemEnv: (id: string) => void;

    // Backgrounds
    activeBgHex: string;
    onSelectBgHex: (hex: string) => void;

    // Studio & Ground
    floorVisible: boolean;
    onToggleFloor: (visible: boolean) => void;
    contactShadows: boolean;
    onToggleContactShadows: (enabled: boolean) => void;
    shadowIntensity: number;
    onChangeShadowIntensity: (val: number) => void;
    shadowSoftness: number;
    onChangeShadowSoftness: (val: number) => void;
    floorRoughness: number;
    onChangeFloorRoughness: (val: number) => void;

    // Models
    activeModelId: string;
    modelsList: ModelItem[];
    onSelectModel: (id: string, url: string) => void;
    onUploadFile: (file: File) => void;
    isUploading?: boolean;
}

interface SwatchPreset {
    id: string;
    name: string;
    color: string;
    gradient?: string;
    tag?: string;
}

const HDR_PRESETS: SwatchPreset[] = [
    { id: 'white', name: 'Clean White', color: '#ffffff', gradient: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)', tag: 'Studio' },
    { id: 'neutral', name: 'Studio Soft', color: '#f3f4f6', gradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', tag: 'Diffused' },
    { id: 'warm', name: 'Warm Ivory', color: '#faf7f2', gradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', tag: 'Warm' },
    { id: 'sunset', name: 'Boutique Sunset', color: '#fed7aa', gradient: 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)', tag: 'Luxury' },
    { id: 'cool', name: 'Cool Studio', color: '#e0e7ff', gradient: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)', tag: 'Crisp' },
    { id: 'dark', name: 'Velvet Midnight', color: '#1c1324', gradient: 'linear-gradient(135deg, #2e1065 0%, #0f172a 100%)', tag: 'Contrast' }
];

const GEM_ENV_PRESETS: SwatchPreset[] = [
    { id: 'diamond_brilliance', name: 'Brilliance', color: '#e0f2fe', gradient: 'radial-gradient(circle, #ffffff 20%, #7dd3fc 100%)', tag: 'High Fire' },
    { id: 'pure_fire', name: 'Scintillation', color: '#f0fdf4', gradient: 'radial-gradient(circle, #ffffff 20%, #86efac 100%)', tag: 'Sparkle' },
    { id: 'deep_contrast', name: 'Deep Contrast', color: '#1e293b', gradient: 'radial-gradient(circle, #64748b 0%, #0f172a 100%)', tag: 'Studio' },
    { id: 'vivid_daylight', name: 'Daylight', color: '#fef08a', gradient: 'radial-gradient(circle, #ffffff 20%, #fde047 100%)', tag: 'Natural' },
    { id: 'warm_luxury', name: 'Warm Luxury', color: '#fbcfe8', gradient: 'radial-gradient(circle, #ffffff 20%, #f472b6 100%)', tag: 'Romantic' },
    { id: 'soft_ambient', name: 'Soft Ambient', color: '#f1f5f9', gradient: 'radial-gradient(circle, #ffffff 40%, #cbd5e1 100%)', tag: 'Diffuse' }
];

const BACKGROUND_SWATCHES: SwatchPreset[] = [
    { id: 'bg_white', name: 'Pure White', color: '#ffffff' },
    { id: 'bg_neutral', name: 'Light Gray', color: '#f5f5f7' },
    { id: 'bg_warm', name: 'Warm Cream', color: '#fdfbf7' },
    { id: 'bg_silver', name: 'Studio Silver', color: '#e5e7eb' },
    { id: 'bg_slate', name: 'Slate Gray', color: '#94a3b8' },
    { id: 'bg_dark', name: 'Charcoal Dark', color: '#1e293b' },
    { id: 'bg_black', name: 'Velvet Black', color: '#111111' },
    { id: 'bg_champagne', name: 'Champagne', color: '#fef3c7' },
    { id: 'bg_blush', name: 'Blush Pink', color: '#fce7f3' },
    { id: 'bg_lavender', name: 'Pastel Lavender', color: '#ede9fe' },
    { id: 'bg_mint', name: 'Pastel Mint', color: '#d1fae5' },
    { id: 'bg_sky', name: 'Pastel Sky', color: '#e0f2fe' }
];

export const AssetBrowser: React.FC<AssetBrowserProps> = ({
    activeCategory,
    onClose,
    activePresetId,
    onSelectPreset,
    envIntensity,
    onChangeEnvIntensity,
    activeGemEnvId,
    onSelectGemEnv,
    activeBgHex,
    onSelectBgHex,
    floorVisible,
    onToggleFloor,
    contactShadows,
    onToggleContactShadows,
    shadowIntensity,
    onChangeShadowIntensity,
    shadowSoftness,
    onChangeShadowSoftness,
    floorRoughness,
    onChangeFloorRoughness,
    activeModelId,
    modelsList,
    onSelectModel,
    onUploadFile,
    isUploading
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getTitle = () => {
        switch (activeCategory) {
            case 'hdr': return 'HDR Environments';
            case 'gem_env': return 'Gem Environments';
            case 'bg': return 'Backgrounds';
            case 'lighting': return 'Studio Lighting & Floor';
            case 'models': return 'Models & Local Import';
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onUploadFile(file);
        }
        if (e.target) e.target.value = '';
    };

    return (
        <aside className="ijewel-asset-browser" aria-label="Playground Asset Browser">
            {/* Browser Header */}
            <div className="browser-header">
                <span className="browser-title">{getTitle()}</span>
                <button className="btn-browser-close" onClick={onClose} title="Close Asset Panel" aria-label="Close">
                    &times;
                </button>
            </div>

            {/* Scrollable Content Area */}
            <div className="browser-body">
                {/* 1. HDR Environments */}
                {activeCategory === 'hdr' && (
                    <div className="browser-section">
                        <div className="section-label">Studio Lighting Presets</div>
                        <div className="swatch-grid-3col">
                            {HDR_PRESETS.map(preset => {
                                const isSelected = activePresetId === preset.id;
                                return (
                                    <button
                                        key={preset.id}
                                        className={`swatch-card ${isSelected ? 'selected' : ''}`}
                                        onClick={() => onSelectPreset(preset.id)}
                                        title={`${preset.name} (${preset.tag})`}
                                    >
                                        <div
                                            className="swatch-circle"
                                            style={{ background: preset.gradient || preset.color }}
                                        />
                                        <span className="swatch-name">{preset.name}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="browser-divider" />

                        <div className="browser-control-row">
                            <span className="control-label">Intensity</span>
                            <div className="control-slider-wrap">
                                <input
                                    type="range"
                                    min="0.2"
                                    max="2.5"
                                    step="0.05"
                                    value={envIntensity}
                                    onChange={e => onChangeEnvIntensity(parseFloat(e.target.value))}
                                />
                                <span className="control-value">{envIntensity.toFixed(2)}x</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Gem Environments */}
                {activeCategory === 'gem_env' && (
                    <div className="browser-section">
                        <div className="section-label">Gemstone Reflection Maps</div>
                        <div className="swatch-grid-3col">
                            {GEM_ENV_PRESETS.map(preset => {
                                const isSelected = activeGemEnvId === preset.id;
                                return (
                                    <button
                                        key={preset.id}
                                        className={`swatch-card ${isSelected ? 'selected' : ''}`}
                                        onClick={() => onSelectGemEnv(preset.id)}
                                        title={`${preset.name} (${preset.tag})`}
                                    >
                                        <div
                                            className="swatch-circle"
                                            style={{ background: preset.gradient || preset.color }}
                                        />
                                        <span className="swatch-name">{preset.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 3. Backgrounds */}
                {activeCategory === 'bg' && (
                    <div className="browser-section">
                        <div className="section-label">Studio Backdrops (Floor Unchanged)</div>
                        <div className="swatch-grid-3col">
                            {BACKGROUND_SWATCHES.map(preset => {
                                const isSelected = activeBgHex.toLowerCase() === preset.color.toLowerCase();
                                return (
                                    <button
                                        key={preset.id}
                                        className={`swatch-card ${isSelected ? 'selected' : ''}`}
                                        onClick={() => onSelectBgHex(preset.color)}
                                        title={preset.name}
                                    >
                                        <div
                                            className="swatch-circle"
                                            style={{ backgroundColor: preset.color, border: '1px solid rgba(0,0,0,0.1)' }}
                                        />
                                        <span className="swatch-name">{preset.name}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="browser-divider" />

                        {/* Custom Hex Color Picker */}
                        <div className="custom-color-row">
                            <span className="control-label">Custom Color</span>
                            <div className="custom-color-inputs">
                                <input
                                    type="color"
                                    className="color-picker-input"
                                    value={activeBgHex.startsWith('#') ? activeBgHex : '#ffffff'}
                                    onChange={e => onSelectBgHex(e.target.value)}
                                    title="Choose Custom Background Color"
                                />
                                <span className="color-hex-tag">{activeBgHex}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. Studio Lighting & Floor */}
                {activeCategory === 'lighting' && (
                    <div className="browser-section">
                        <div className="section-label">3D Finite Floor Platform</div>

                        <div className="control-toggle-row">
                            <span className="control-label">Visible Floor Platform</span>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={floorVisible}
                                    onChange={e => onToggleFloor(e.target.checked)}
                                />
                                <span className="slider round" />
                            </label>
                        </div>

                        <div className="browser-control-row">
                            <span className="control-label">Floor Matte Roughness</span>
                            <div className="control-slider-wrap">
                                <input
                                    type="range"
                                    min="0.1"
                                    max="1.0"
                                    step="0.05"
                                    value={floorRoughness}
                                    onChange={e => onChangeFloorRoughness(parseFloat(e.target.value))}
                                />
                                <span className="control-value">{Math.round(floorRoughness * 100)}%</span>
                            </div>
                        </div>

                        <div className="browser-divider" />

                        <div className="section-label">Real Contact Shadows</div>

                        <div className="control-toggle-row">
                            <span className="control-label">Contact Shadows</span>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={contactShadows}
                                    onChange={e => onToggleContactShadows(e.target.checked)}
                                />
                                <span className="slider round" />
                            </label>
                        </div>

                        <div className="browser-control-row">
                            <span className="control-label">Shadow Darkness</span>
                            <div className="control-slider-wrap">
                                <input
                                    type="range"
                                    min="0.1"
                                    max="1.0"
                                    step="0.05"
                                    value={shadowIntensity}
                                    disabled={!contactShadows}
                                    onChange={e => onChangeShadowIntensity(parseFloat(e.target.value))}
                                />
                                <span className="control-value">{Math.round(shadowIntensity * 100)}%</span>
                            </div>
                        </div>

                        <div className="browser-control-row">
                            <span className="control-label">Contact Blur / Softness</span>
                            <div className="control-slider-wrap">
                                <input
                                    type="range"
                                    min="0.5"
                                    max="6.0"
                                    step="0.1"
                                    value={shadowSoftness}
                                    disabled={!contactShadows}
                                    onChange={e => onChangeShadowSoftness(parseFloat(e.target.value))}
                                />
                                <span className="control-value">{shadowSoftness.toFixed(1)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. Models & Drop */}
                {activeCategory === 'models' && (
                    <div className="browser-section">
                        <div className="section-label">Built-in Jewelry Models</div>
                        <div className="model-cards-list">
                            <button
                                className={`model-card-item ${activeModelId === 'builtin-ring-1' ? 'active' : ''}`}
                                onClick={() => onSelectModel('builtin-ring-1', './assets/ring_webgi.glb')}
                            >
                                <div className="model-card-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <circle cx="12" cy="12" r="4" />
                                    </svg>
                                </div>
                                <div className="model-card-details">
                                    <span className="model-card-title">Solitaire Diamond Ring</span>
                                    <span className="model-card-sub">Six-prong diamond setting with gold shank</span>
                                </div>
                            </button>

                            <button
                                className={`model-card-item ${activeModelId === 'builtin-ring-2' ? 'active' : ''}`}
                                onClick={() => onSelectModel('builtin-ring-2', './assets/ring2_webgi.glb')}
                            >
                                <div className="model-card-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 2a10 10 0 0 1 10 10" />
                                    </svg>
                                </div>
                                <div className="model-card-details">
                                    <span className="model-card-title">Alliance Halo Ring</span>
                                    <span className="model-card-sub">Pavé halo diamond ring with entourage</span>
                                </div>
                            </button>

                            {modelsList.map(m => (
                                <button
                                    key={m.id}
                                    className={`model-card-item ${activeModelId === m.id ? 'active' : ''}`}
                                    onClick={() => onSelectModel(m.id, `/api/v1/models/${m.id}/asset`)}
                                >
                                    <div className="model-card-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polygon points="12 2 2 7 12 12 22 7 12 2" />
                                            <polyline points="2 17 12 22 22 17" />
                                            <polyline points="2 12 12 17 22 12" />
                                        </svg>
                                    </div>
                                    <div className="model-card-details">
                                        <span className="model-card-title">{m.name}</span>
                                        <span className="model-card-sub">{m.format || 'CAD Model'}</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="browser-divider" />

                        {/* Local File Import */}
                        <div className="section-label">Import Local Model</div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept=".glb,.gltf,.3dm"
                            onChange={handleFileChange}
                        />
                        <button
                            className={`btn-upload-file ${isUploading ? 'uploading' : ''}`}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            <span>{isUploading ? 'Importing Model...' : 'Select Local File (.glb, .3dm)'}</span>
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
};

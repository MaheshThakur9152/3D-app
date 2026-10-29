/**
 * StudioPanel.tsx
 * Left panel: Studio environment, ground plane, shadows, and reflection controls.
 */

import React, { useState } from 'react';
import { STUDIO_PRESETS } from '../ui/StudioSettings';

interface StudioPanelProps {
    currentPresetId: string;
    groundVisible?: boolean;
    groundShadows: boolean;
    shadowIntensity?: number;
    shadowSoftness?: number;
    shadowQuality?: 'performance' | 'balanced' | 'high';
    groundReflections: boolean;
    envIntensity: number;
    onSelectPreset: (presetId: string) => void;
    onToggleGroundShadows: (enabled: boolean) => void;
    onChangeShadowIntensity?: (val: number) => void;
    onChangeShadowSoftness?: (val: number) => void;
    onChangeShadowQuality?: (quality: 'performance' | 'balanced' | 'high') => void;
    onToggleGroundReflections: (enabled: boolean) => void;
    onChangeEnvIntensity: (val: number) => void;
}

export const StudioPanel: React.FC<StudioPanelProps> = ({
    currentPresetId,
    groundShadows,
    shadowIntensity = 0.75,
    shadowSoftness = 2.2,
    shadowQuality = 'balanced',
    groundReflections,
    envIntensity,
    onSelectPreset,
    onToggleGroundShadows,
    onChangeShadowIntensity,
    onChangeShadowSoftness,
    onChangeShadowQuality,
    onToggleGroundReflections,
    onChangeEnvIntensity
}) => {
    return (
        <div className="studio-panel">
            <div className="panel-section-title">Studio Backdrop Presets</div>
            <div className="swatches-grid">
                {Object.values(STUDIO_PRESETS).map((p) => (
                    <button
                        key={p.id}
                        className={`swatch-card ${currentPresetId === p.id ? 'active' : ''}`}
                        onClick={() => onSelectPreset(p.id)}
                    >
                        <span className="swatch-circle" style={{ backgroundColor: p.hex, border: '1px solid rgba(0,0,0,0.1)' }} />
                        <span className="swatch-label">{p.name}</span>
                    </button>
                ))}
            </div>

            <div className="panel-section-title">Studio Ground & Shadows</div>
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

            {groundShadows && (
                <>
                    {onChangeShadowIntensity && (
                        <div className="slider-row">
                            <div className="slider-header">
                                <span>Shadow Intensity</span>
                                <span className="slider-val">{Math.round(shadowIntensity * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0.1"
                                max="1.0"
                                step="0.05"
                                value={shadowIntensity}
                                onChange={(e) => onChangeShadowIntensity(parseFloat(e.target.value))}
                            />
                        </div>
                    )}

                    {onChangeShadowSoftness && (
                        <div className="slider-row">
                            <div className="slider-header">
                                <span>Shadow Softness</span>
                                <span className="slider-val">{shadowSoftness.toFixed(1)}</span>
                            </div>
                            <input
                                type="range"
                                min="0.5"
                                max="5.0"
                                step="0.1"
                                value={shadowSoftness}
                                onChange={(e) => onChangeShadowSoftness(parseFloat(e.target.value))}
                            />
                        </div>
                    )}

                    {onChangeShadowQuality && (
                        <div className="quality-row">
                            <span className="quality-label">Shadow Quality</span>
                            <div className="quality-pill-group">
                                {(['performance', 'balanced', 'high'] as const).map((q) => (
                                    <button
                                        key={q}
                                        type="button"
                                        className={`btn-pill-opt ${shadowQuality === q ? 'active' : ''}`}
                                        onClick={() => onChangeShadowQuality(q)}
                                    >
                                        {q.charAt(0).toUpperCase() + q.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

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

            <div className="panel-section-title">Environment Lighting</div>
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
        </div>
    );
};

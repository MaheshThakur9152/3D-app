/**
 * GemVariantSelector.tsx
 * Floating gemstone variant swatches and product label pill at the bottom-center of the viewport.
 */

import React from 'react';
import { GEMSTONE_PRESETS, GemstonePreset } from '../cad/MaterialRoleBinder';

interface GemVariantSelectorProps {
    modelName: string;
    selectedGemId: string;
    metalName?: string;
    onSelectGem: (preset: GemstonePreset) => void;
}

interface GemOption {
    id: string;
    name: string;
    color: string;
    gradient: string;
    preset: GemstonePreset;
}

const GEM_OPTIONS: GemOption[] = [
    {
        id: 'diamond',
        name: 'Brilliant Diamond',
        color: '#cfecec',
        gradient: 'radial-gradient(circle, #ffffff 10%, #dbeafe 60%, #93c5fd 100%)',
        preset: GEMSTONE_PRESETS.diamond
    },
    {
        id: 'emerald',
        name: 'Colombian Emerald',
        color: '#10b981',
        gradient: 'radial-gradient(circle, #34d399 20%, #059669 80%, #064e3b 100%)',
        preset: GEMSTONE_PRESETS.emerald
    },
    {
        id: 'ruby',
        name: 'Vivid Ruby',
        color: '#ef4444',
        gradient: 'radial-gradient(circle, #f87171 20%, #dc2626 80%, #7f1d1d 100%)',
        preset: GEMSTONE_PRESETS.ruby
    },
    {
        id: 'sapphire',
        name: 'Royal Sapphire',
        color: '#3b82f6',
        gradient: 'radial-gradient(circle, #60a5fa 20%, #2563eb 80%, #1e3a8a 100%)',
        preset: GEMSTONE_PRESETS.sapphire
    },
    {
        id: 'amethyst',
        name: 'Amethyst',
        color: '#a855f7',
        gradient: 'radial-gradient(circle, #c084fc 20%, #9333ea 80%, #581c87 100%)',
        preset: GEMSTONE_PRESETS.amethyst
    },
    {
        id: 'aquamarine',
        name: 'Aquamarine',
        color: '#38bdf8',
        gradient: 'radial-gradient(circle, #7dd3fc 20%, #0284c7 80%, #0c4a6e 100%)',
        preset: GEMSTONE_PRESETS.aquamarine
    },
    {
        id: 'canary',
        name: 'Canary Diamond',
        color: '#facc15',
        gradient: 'radial-gradient(circle, #fef08a 20%, #eab308 80%, #854d0e 100%)',
        preset: GEMSTONE_PRESETS.canary
    }
];

export const GemVariantSelector: React.FC<GemVariantSelectorProps> = ({
    modelName,
    selectedGemId,
    metalName = '18K White Gold',
    onSelectGem
}) => {
    const currentGem = GEM_OPTIONS.find(g => g.id === selectedGemId) || GEM_OPTIONS[0];

    return (
        <div className="ijewel-bottom-gem-bar" aria-label="Gemstone Variant Selector">
            {/* Horizontal Swatch Group */}
            <div className="gem-swatches-pill">
                {GEM_OPTIONS.map(gem => {
                    const isSelected = selectedGemId === gem.id;
                    return (
                        <button
                            key={gem.id}
                            className={`gem-swatch-btn ${isSelected ? 'selected' : ''}`}
                            onClick={() => onSelectGem(gem.preset)}
                            title={gem.name}
                            aria-label={gem.name}
                        >
                            <span
                                className="gem-swatch-circle"
                                style={{ background: gem.gradient }}
                            />
                        </button>
                    );
                })}
            </div>

            {/* Product & Material Name Label */}
            <div className="product-info-pill">
                <span className="product-name">{modelName}</span>
                <span className="info-sep">•</span>
                <span className="gem-name">{currentGem.name}</span>
                <span className="info-sep">•</span>
                <span className="metal-name">{metalName}</span>
            </div>
        </div>
    );
};

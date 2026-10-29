/**
 * LeftNavRail.tsx
 * Narrow vertical category navigation rail matching iJewel3D playground layout.
 */

import React from 'react';

export type PlaygroundNavCategory = 'hdr' | 'gem_env' | 'bg' | 'lighting' | 'models';

interface LeftNavRailProps {
    activeCategory: PlaygroundNavCategory;
    isBrowserOpen: boolean;
    onSelectCategory: (category: PlaygroundNavCategory) => void;
    onToggleBrowser: () => void;
}

interface NavItem {
    id: PlaygroundNavCategory;
    label: string;
    icon: React.ReactNode;
    tooltip: string;
}

export const LeftNavRail: React.FC<LeftNavRailProps> = ({
    activeCategory,
    isBrowserOpen,
    onSelectCategory,
    onToggleBrowser
}) => {
    const navItems: NavItem[] = [
        {
            id: 'hdr',
            label: 'HDR Environments',
            tooltip: 'Studio Environment & HDR Lighting',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
            )
        },
        {
            id: 'gem_env',
            label: 'Gem Environments',
            tooltip: 'Gemstone HDRI Reflections & Optical Maps',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <polygon points="6 3 18 3 22 9 12 22 2 9" />
                    <line x1="12" y1="22" x2="6" y2="9" />
                    <line x1="12" y1="22" x2="18" y2="9" />
                </svg>
            )
        },
        {
            id: 'bg',
            label: 'Backgrounds',
            tooltip: 'Studio Background Colors & Backdrops',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C21.996 6.004 17.5 2 12 2z" />
                </svg>
            )
        },
        {
            id: 'lighting',
            label: 'Studio Lighting',
            tooltip: 'Ground Platform & Contact Shadows',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <line x1="4" y1="21" x2="4" y2="14" />
                    <line x1="4" y1="10" x2="4" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12" y2="3" />
                    <line x1="20" y1="21" x2="20" y2="16" />
                    <line x1="20" y1="12" x2="20" y2="3" />
                    <line x1="1" y1="14" x2="7" y2="14" />
                    <line x1="9" y1="8" x2="15" y2="8" />
                    <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
            )
        },
        {
            id: 'models',
            label: 'Models & CAD',
            tooltip: 'Jewelry Models & CAD Import (.glb, .3dm)',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
            )
        }
    ];

    return (
        <nav className="ijewel-nav-rail" aria-label="Playground Asset Navigation">
            <div className="rail-items-group">
                {navItems.map(item => {
                    const isActive = activeCategory === item.id && isBrowserOpen;
                    return (
                        <button
                            key={item.id}
                            className={`rail-btn ${isActive ? 'active' : ''}`}
                            onClick={() => {
                                if (activeCategory === item.id && isBrowserOpen) {
                                    onToggleBrowser();
                                } else {
                                    onSelectCategory(item.id);
                                }
                            }}
                            title={item.tooltip}
                            aria-label={item.label}
                        >
                            {isActive && <span className="active-pill" />}
                            <span className="rail-btn-icon">{item.icon}</span>
                            <span className="rail-btn-label">{item.label.split(' ')[0]}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

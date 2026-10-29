/**
 * QuickToolRail.tsx
 * Narrow right-side quick-tool rail next to the inspector for rapid toggle access.
 */

import React from 'react';

interface QuickToolRailProps {
    isInspectorOpen: boolean;
    onToggleInspector: () => void;
    onResetCamera: () => void;
    onFitProduct: () => void;
    onSnapshot: () => void;
    autoRotate: boolean;
    onToggleAutoRotate: () => void;
}

export const QuickToolRail: React.FC<QuickToolRailProps> = ({
    isInspectorOpen,
    onToggleInspector,
    onResetCamera,
    onFitProduct,
    onSnapshot,
    autoRotate,
    onToggleAutoRotate
}) => {
    return (
        <aside className="ijewel-quick-rail" aria-label="Quick Actions Rail">
            <button
                className={`quick-rail-btn ${isInspectorOpen ? 'active' : ''}`}
                onClick={onToggleInspector}
                title={isInspectorOpen ? 'Collapse Inspector' : 'Expand Inspector'}
                aria-label="Toggle Inspector"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="15" y1="3" x2="15" y2="21" />
                </svg>
            </button>

            <button
                className="quick-rail-btn"
                onClick={onFitProduct}
                title="Fit Jewelry to View"
                aria-label="Fit View"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                </svg>
            </button>

            <button
                className="quick-rail-btn"
                onClick={onResetCamera}
                title="Reset Studio Camera"
                aria-label="Reset Camera"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                </svg>
            </button>

            <button
                className={`quick-rail-btn ${autoRotate ? 'active' : ''}`}
                onClick={onToggleAutoRotate}
                title="Toggle 360 Turntable"
                aria-label="Toggle Turntable"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
            </button>

            <button
                className="quick-rail-btn"
                onClick={onSnapshot}
                title="Capture Snapshot"
                aria-label="Capture Snapshot"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                </svg>
            </button>
        </aside>
    );
};

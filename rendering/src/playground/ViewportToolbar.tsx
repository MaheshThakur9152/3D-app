/**
 * ViewportToolbar.tsx
 * Floating vertical toolbar located in the upper-right corner of the central 3D viewport.
 */

import React, { useState } from 'react';

interface ViewportToolbarProps {
    onFitView: () => void;
    onResetView: () => void;
    onSnapshot: () => void;
    autoRotate: boolean;
    onToggleAutoRotate: () => void;
    onResetMaterials?: () => void;
}

export const ViewportToolbar: React.FC<ViewportToolbarProps> = ({
    onFitView,
    onResetView,
    onSnapshot,
    autoRotate,
    onToggleAutoRotate,
    onResetMaterials
}) => {
    const [isFullscreen, setIsFullscreen] = useState(false);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
            }
        }
    };

    return (
        <div className="ijewel-viewport-toolbar" aria-label="Viewport Controls">
            {/* Fullscreen Action */}
            <button
                className={`btn-v-tool ${isFullscreen ? 'active' : ''}`}
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen View (F11)'}
                aria-label="Fullscreen"
            >
                {isFullscreen ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                    </svg>
                ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    </svg>
                )}
            </button>

            {/* Fit View / Focus Action */}
            <button
                className="btn-v-tool"
                onClick={onFitView}
                title="Fit Jewelry to Viewport (Center & Frame)"
                aria-label="Fit View"
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="22" y1="12" x2="18" y2="12" />
                    <line x1="6" y1="12" x2="2" y2="12" />
                    <line x1="12" y1="6" x2="12" y2="2" />
                    <line x1="12" y1="22" x2="12" y2="18" />
                </svg>
            </button>

            {/* Reset Camera View Angle Action */}
            <button
                className="btn-v-tool"
                onClick={onResetView}
                title="Reset Camera Angle to Studio Perspective"
                aria-label="Reset Camera"
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                </svg>
            </button>

            {/* Auto-Rotate Toggle Action */}
            <button
                className={`btn-v-tool ${autoRotate ? 'active' : ''}`}
                onClick={onToggleAutoRotate}
                title={autoRotate ? 'Pause 360 Turntable Orbit' : 'Start 360 Turntable Orbit'}
                aria-label="Auto Rotate"
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
            </button>

            {/* Snapshot Action */}
            <button
                className="btn-v-tool"
                onClick={onSnapshot}
                title="Capture High-Res Image Snapshot"
                aria-label="Capture Snapshot"
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                </svg>
            </button>

            {/* Reset Materials Action */}
            {onResetMaterials && (
                <button
                    className="btn-v-tool"
                    onClick={onResetMaterials}
                    title="Reset All Materials to Default"
                    aria-label="Reset Materials"
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2.5 2v6h6M21.5 22v-6h-6" />
                        <path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2" />
                    </svg>
                </button>
            )}
        </div>
    );
};

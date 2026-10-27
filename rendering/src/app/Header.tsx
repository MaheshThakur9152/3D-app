/**
 * Header.tsx
 * Top Navigation and Studio Controls for Mahesh 3D.
 */

import React from 'react';

interface HeaderProps {
    modelName: string;
    autoRotate: boolean;
    onToggleAutoRotate: () => void;
    onFitView: () => void;
    onResetView: () => void;
    onOpenUpload: () => void;
    onSaveConfig: () => void;
    isSaving: boolean;
}

export const Header: React.FC<HeaderProps> = ({
    modelName,
    autoRotate,
    onToggleAutoRotate,
    onFitView,
    onResetView,
    onOpenUpload,
    onSaveConfig,
    isSaving
}) => {
    return (
        <header className="app-header">
            <div className="brand">
                <div className="brand-logo">M3D</div>
                <div className="brand-info">
                    <h1 className="brand-title">Mahesh 3D</h1>
                    <span className="brand-subtitle">Fine Jewelry Studio</span>
                </div>
            </div>

            <div className="header-center">
                <span className="model-badge">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                        <polyline points="2 17 12 22 22 17"/>
                        <polyline points="2 12 12 17 22 12"/>
                    </svg>
                    <span>{modelName}</span>
                </span>
            </div>

            <div className="header-actions">
                <button
                    className="btn-action btn-upload-trigger"
                    onClick={onOpenUpload}
                    title="Upload Rhino CAD (.3dm) or glTF (.glb)"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <span>Import CAD</span>
                </button>

                <button
                    className={`btn-action btn-save ${isSaving ? 'loading' : ''}`}
                    onClick={onSaveConfig}
                    title="Save ring configuration to database"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                        <polyline points="7 3 7 8 15 8"/>
                    </svg>
                    <span>{isSaving ? 'Saving...' : 'Save Config'}</span>
                </button>

                <div className="header-divider" />

                <button
                    className="btn-icon"
                    onClick={onFitView}
                    title="Fit Model to Viewport"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                    </svg>
                </button>

                <button
                    className="btn-icon"
                    onClick={onResetView}
                    title="Reset Studio Camera Angle"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                        <path d="M3 3v5h5"/>
                    </svg>
                </button>

                <button
                    className={`btn-icon ${autoRotate ? 'active' : ''}`}
                    onClick={onToggleAutoRotate}
                    title={autoRotate ? "Disable Auto-Rotation" : "Enable Auto-Rotation"}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                    </svg>
                </button>
            </div>
        </header>
    );
};

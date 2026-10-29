/**
 * PlaygroundHeader.tsx
 * Top Application Bar inspired by iJewel3D Playground.
 * Crisp white layout with branding, documentation, feedback, Save with dropdown, and profile controls.
 */

import React, { useState, useRef, useEffect } from 'react';

interface PlaygroundHeaderProps {
    modelName: string;
    isSaving: boolean;
    onSaveConfig: () => void;
    onExportGLB?: () => void;
    onExportSnapshot: () => void;
    onResetCamera: () => void;
    onFitProduct: () => void;
}

export const PlaygroundHeader: React.FC<PlaygroundHeaderProps> = ({
    modelName,
    isSaving,
    onSaveConfig,
    onExportGLB,
    onExportSnapshot,
    onResetCamera,
    onFitProduct
}) => {
    const [showSaveDropdown, setShowSaveDropdown] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackSent, setFeedbackSent] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowSaveDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSendFeedback = () => {
        if (!feedbackText.trim()) return;
        setFeedbackSent(true);
        setTimeout(() => {
            setFeedbackSent(false);
            setShowFeedbackModal(false);
            setFeedbackText('');
        }, 1200);
    };

    return (
        <header className="ijewel-header">
            {/* Upper-Left Branding */}
            <div className="ijewel-brand">
                <div className="brand-logo-gem">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="6 3 18 3 22 9 12 22 2 9" />
                        <line x1="12" y1="22" x2="6" y2="9" />
                        <line x1="12" y1="22" x2="18" y2="9" />
                        <line x1="2" y1="9" x2="22" y2="9" />
                        <line x1="6" y1="3" x2="12" y2="9" />
                        <line x1="18" y1="3" x2="12" y2="9" />
                    </svg>
                </div>
                <div className="brand-names">
                    <span className="brand-primary">iJewel3D</span>
                    <span className="brand-tag">Playground</span>
                </div>
            </div>

            {/* Model Title Display */}
            <div className="ijewel-header-center">
                <span className="model-pill">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="4" />
                    </svg>
                    <span className="model-title">{modelName}</span>
                </span>
            </div>

            {/* Right-Hand Controls & Actions */}
            <div className="ijewel-header-actions">
                {/* Help Button */}
                <button
                    className="btn-header-icon"
                    onClick={() => setShowHelpModal(true)}
                    title="Documentation & Navigation Help"
                    aria-label="Documentation"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                </button>

                {/* Feedback Button */}
                <button
                    className="btn-header-icon"
                    onClick={() => setShowFeedbackModal(true)}
                    title="Send Feedback"
                    aria-label="Feedback"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                </button>

                <div className="header-sep" />

                {/* Prominent Save Button with Dropdown */}
                <div className="save-btn-group" ref={dropdownRef}>
                    <button
                        className={`btn-save-primary ${isSaving ? 'saving' : ''}`}
                        onClick={onSaveConfig}
                        disabled={isSaving}
                        title="Save Scene & Material Configuration"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                            <polyline points="17 21 17 13 7 13 7 21" />
                            <polyline points="7 3 7 8 15 8" />
                        </svg>
                        <span>{isSaving ? 'Saving...' : 'Save'}</span>
                    </button>
                    <button
                        className="btn-save-toggle"
                        onClick={() => setShowSaveDropdown(!showSaveDropdown)}
                        title="More Export & Save Options"
                        aria-label="More Export Options"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>

                    {showSaveDropdown && (
                        <div className="save-dropdown-menu">
                            <button
                                className="save-menu-item"
                                onClick={() => {
                                    setShowSaveDropdown(false);
                                    onSaveConfig();
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                </svg>
                                <span>Save Scene Configuration</span>
                            </button>
                            <button
                                className="save-menu-item"
                                onClick={() => {
                                    setShowSaveDropdown(false);
                                    onExportSnapshot();
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                    <circle cx="12" cy="13" r="4" />
                                </svg>
                                <span>Export High-Res PNG</span>
                            </button>
                            {onExportGLB && (
                                <button
                                    className="save-menu-item"
                                    onClick={() => {
                                        setShowSaveDropdown(false);
                                        onExportGLB();
                                    }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                    </svg>
                                    <span>Export 3D Model (.glb)</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="header-sep" />

                {/* Account / User Avatar */}
                <div className="user-avatar" title="Account Settings">
                    <span className="avatar-initials">M</span>
                </div>
            </div>

            {/* Help Modal */}
            {showHelpModal && (
                <div className="ijewel-modal-backdrop" onClick={() => setShowHelpModal(false)}>
                    <div className="ijewel-modal-card" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>iJewel3D Playground Guide</h3>
                            <button className="btn-modal-close" onClick={() => setShowHelpModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <p><strong>Navigation:</strong> Left-click and drag to orbit camera around jewelry. Right-click or Ctrl+drag to pan. Scroll wheel to zoom in and out.</p>
                            <p><strong>Finite Studio Floor:</strong> Real 3D square platform grounds the product with real-time contact shadows.</p>
                            <p><strong>Materials:</strong> Pick any jewelry component or select from the bottom gemstone bar to change gemstones and precious metals live.</p>
                            <p><strong>Studio Environments:</strong> Use the left navigation rail to select HDR environments, gem reflection maps, and clean studio backdrops.</p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-modal-primary" onClick={() => setShowHelpModal(false)}>Got it</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Feedback Modal */}
            {showFeedbackModal && (
                <div className="ijewel-modal-backdrop" onClick={() => setShowFeedbackModal(false)}>
                    <div className="ijewel-modal-card" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Send Playground Feedback</h3>
                            <button className="btn-modal-close" onClick={() => setShowFeedbackModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            {feedbackSent ? (
                                <div className="feedback-success">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <span>Thank you! Feedback received.</span>
                                </div>
                            ) : (
                                <>
                                    <label className="feedback-label">Tell us about your experience or report an issue:</label>
                                    <textarea
                                        className="feedback-input"
                                        rows={4}
                                        placeholder="How does the jewelry studio look and perform?..."
                                        value={feedbackText}
                                        onChange={e => setFeedbackText(e.target.value)}
                                    />
                                </>
                            )}
                        </div>
                        {!feedbackSent && (
                            <div className="modal-footer">
                                <button className="btn-modal-secondary" onClick={() => setShowFeedbackModal(false)}>Cancel</button>
                                <button className="btn-modal-primary" onClick={handleSendFeedback}>Submit Feedback</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
};

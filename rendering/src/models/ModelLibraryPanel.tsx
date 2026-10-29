/**
 * ModelLibraryPanel.tsx
 * Left panel: Select built-in demo rings and custom uploaded CAD/GLB models.
 */

import React, { useRef, useState } from 'react';
import { ModelItem } from '../state/StudioState';

interface ModelLibraryPanelProps {
    activeModelId: string;
    models: ModelItem[];
    onSelectModel: (modelId: string, glbUrl: string) => void;
    onUploadSuccess: (modelId: string, glbUrl: string) => void;
}

export const ModelLibraryPanel: React.FC<ModelLibraryPanelProps> = ({
    activeModelId,
    models,
    onSelectModel,
    onUploadSuccess
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadStage, setUploadStage] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadProgress(10);
        setUploadStage('Uploading CAD document...');
        setUploadError(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('options', JSON.stringify({
            autoCentre: true,
            autoScale: true,
            visibleOnly: true,
            excludeConstruction: true
        }));

        try {
            const res = await fetch('/api/v1/upload', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || 'File upload failed');
            }

            const data = await res.json();
            const jobId = data.jobId;
            const modelId = data.modelId;

            // Poll job status
            setUploadStage('Converting CAD geometry...');
            setUploadProgress(30);

            const pollInterval = setInterval(async () => {
                try {
                    const statusRes = await fetch(`/api/v1/jobs/${jobId}`);
                    if (!statusRes.ok) return;
                    const statusData = await statusRes.json();

                    setUploadProgress(statusData.progress || 50);
                    if (statusData.stage) {
                        setUploadStage(`Status: ${statusData.stage}...`);
                    }

                    if (statusData.status === 'completed') {
                        clearInterval(pollInterval);
                        setUploading(false);
                        setUploadProgress(100);
                        const glbUrl = statusData.result?.glbUrl || `/api/v1/models/${modelId}/model.glb`;
                        onUploadSuccess(modelId, glbUrl);
                    } else if (statusData.status === 'failed') {
                        clearInterval(pollInterval);
                        setUploading(false);
                        setUploadError(statusData.error || 'CAD conversion failed');
                    }
                } catch {
                    // Poll retry
                }
            }, 1000);

        } catch (err: any) {
            setUploading(false);
            setUploadError(err.message || 'Upload error');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="model-library-panel">
            <div className="panel-section-title">Built-In Demo Rings</div>
            <div className="demo-rings-grid">
                <button
                    className={`model-card ${activeModelId === 'builtin-ring-1' ? 'active' : ''}`}
                    onClick={() => onSelectModel('builtin-ring-1', './assets/ring_webgi.glb')}
                >
                    <div className="model-card-icon">💍</div>
                    <div className="model-card-info">
                        <span className="model-card-title">Solitaire Diamond Ring</span>
                        <span className="model-card-desc">18K Two-Tone Shank & Head</span>
                    </div>
                </button>

                <button
                    className={`model-card ${activeModelId === 'builtin-ring-2' ? 'active' : ''}`}
                    onClick={() => onSelectModel('builtin-ring-2', './assets/ring2_webgi.glb')}
                >
                    <div className="model-card-icon">💎</div>
                    <div className="model-card-info">
                        <span className="model-card-title">Alliance Halo Ring</span>
                        <span className="model-card-desc">Diamond Entourage & Band</span>
                    </div>
                </button>
            </div>

            <div className="panel-section-title">Upload Jewelry CAD</div>
            <div className="upload-dropzone" onClick={() => fileInputRef.current?.click()}>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".3dm,.glb"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                />
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span className="dropzone-text">Drop Rhino .3dm or .glb here</span>
                <span className="dropzone-sub">Automatic NURBS mesh extraction & glTF optimization</span>
            </div>

            {uploading && (
                <div className="upload-status-box">
                    <div className="status-label">{uploadStage}</div>
                    <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
                    </div>
                </div>
            )}

            {uploadError && (
                <div className="upload-error-box">
                    <span className="error-icon">⚠️</span>
                    <span>{uploadError}</span>
                </div>
            )}

            {models.length > 0 && (
                <>
                    <div className="panel-section-title">Server Models</div>
                    <div className="models-list">
                        {models.map((m) => (
                            <button
                                key={m.id}
                                className={`model-item-row ${activeModelId === m.id ? 'active' : ''}`}
                                onClick={() => onSelectModel(m.id, `/api/v1/models/${m.id}/model.glb`)}
                            >
                                <span className="item-name">{m.originalFileName}</span>
                                <span className={`badge-format format-${m.sourceFormat}`}>{m.sourceFormat.toUpperCase()}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
